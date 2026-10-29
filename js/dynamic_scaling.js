//动态补偿：只抵消系统级缩放，用户的浏览器缩放保留
//记录首次 screen.width 作基线 → 系统缩放 = 基线 / 当前 → 只对系统缩放做补偿 → 浏览器缩放不动。
;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZoomCompensator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SNAP = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function snap(v, tol) {
    tol = tol || 0.04;
    for (var i = 0; i < SNAP.length; i++) if (Math.abs(v - SNAP[i]) <= tol) return SNAP[i];
    return r3(v);
  }
  function detectOS() {
    var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/Win/i.test(p)) return 'windows';
    if (/Mac/i.test(p)) return 'macos';
    if (/Linux|X11|CrOS/i.test(p)) return 'linux';
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
    return 'other';
  }
  function hasZoom() {
    var el = document.createElement('div');
    el.style.zoom = '1.5';
    return el.style.zoom === '1.5';
  }

  function ZoomCompensator(opts) {
    if (!(this instanceof ZoomCompensator)) return new ZoomCompensator(opts);

    this.opts = Object.assign({
      baseDpr: null,              // null → 自动推断（普通屏 1，Retina 2）
      compensateSystem: 'auto',   // 'auto' | true | false；macOS 自动 false
      compensateBrowser: false,   // 是否也抵消浏览器缩放（默认 false：尊重用户）
      smooth: true,
      smoothDuration: 180,
      tolerance: 0.02,            // 补偿值偏离 1 在此范围内不动作
      pollInterval: 1000,         // 轮询兜底，0 关闭
      target: null,               // 补偿元素，默认 documentElement
      storageKey: '__zoom_comp__',
      onChange: null,             // (scale, info)
      onInfo: null,               // (info)
      autoStart: true
    }, opts);

    this.os = detectOS();
    this.hasZoom = hasZoom();
    this._store = this._makeStore(this.opts.storageKey);

    this.baseDpr = this.opts.baseDpr != null ? this.opts.baseDpr : this._suggestBaseDpr();

    // 基线：首次访问的 screen.width + dpr
    this.baseline = this._store.get('baseline', null) || this._captureBaseline();
    // 用户手动锁定值（null = 未锁定）
    this.manual = this._store.get('manual', null);

    this._scale = 1;
    this._info = null;
    this._timer = null;
    this._cleanupMql = null;
    this._onResize = this.check.bind(this);

    if (this.opts.autoStart) this.start();
  }

  /* ========== baseDpr 推断 ========== */
  ZoomCompensator.prototype._suggestBaseDpr = function () {
    var dpr = window.devicePixelRatio || 1;
    var pw = (screen.width || 0) * dpr;
    var ph = (screen.height || 0) * dpr;
    var shortSide = Math.min(pw, ph), longSide = Math.max(pw, ph);
    if (this.os === 'macos' && dpr >= 2) return 2;                 // Retina
    if (shortSide >= 2000 || longSide >= 3800) return Math.max(1, Math.round(dpr)); // 4K+
    return 1;
  };

  /* ========== 基线 ========== */
  ZoomCompensator.prototype._captureBaseline = function () {
    var b = {
      dpr: window.devicePixelRatio || 1,
      screenW: screen.width || 0,
      ts: Date.now()
    };
    this._store.set('baseline', b);
    return b;
  };

  /* ========== 核心：计算补偿值 ========== */
  ZoomCompensator.prototype._resolve = function () {
    var dpr = window.devicePixelRatio || 1;
    var screenW = screen.width || 1;
    var b = this.baseline;

    // 系统缩放（相对基线）：Windows 上系统放大→screen.width 缩小→比值>1
    var sysZoom = (b.screenW > 0 && screenW > 0) ? snap(b.screenW / screenW) : 1;
    var totalZoom = r3(dpr / this.baseDpr);
    var userZoom = r3(totalZoom / sysZoom);

    // 补偿决策
    var compensate = 1;
    var doSys = this.opts.compensateSystem === true ||
                (this.opts.compensateSystem !== false && this.os !== 'macos' && this.os !== 'ios');
    if (doSys) compensate *= 1 / sysZoom;
    if (this.opts.compensateBrowser) compensate *= 1 / userZoom;

    // 用户手动值最优先
    if (this.manual != null) compensate = this.manual;

    // 归一化 + 吸附，避免抖动
    compensate = snap(compensate);
    if (Math.abs(compensate - 1) < this.opts.tolerance) compensate = 1;

    return {
      dpr: dpr,
      baseDpr: this.baseDpr,
      screenW: screenW,
      sysZoom: r3(sysZoom),
      userZoom: r3(userZoom),
      totalZoom: r3(totalZoom),
      compensate: r3(compensate),
      os: this.os,
      manual: this.manual
    };
  };

  /* ========== 检测 + 应用 ========== */
  ZoomCompensator.prototype.check = function (force) {
    var info = this._resolve();
    this._info = info;

    if (force || Math.abs(info.compensate - this._scale) > 1e-3) {
      this._apply(info.compensate);
      if (typeof this.opts.onChange === 'function') this.opts.onChange(info.compensate, info);
    }
    if (typeof this.opts.onInfo === 'function') this.opts.onInfo(info);
    return info;
  };

  /* ========== 应用（平滑 / 降级） ========== */
  ZoomCompensator.prototype._apply = function (scale) {
    var el = this.opts.target || document.documentElement;
    var from = this._scale;
    this._scale = scale;

    if (!this.hasZoom) {
      // transform 降级（会创建包含块，position:fixed 失效）
      el.style.transformOrigin = '0 0';
      el.style.transform = scale === 1 ? '' : 'scale(' + scale + ')';
      if (scale < 1) el.style.width = (100 / scale) + '%';
      else el.style.width = '';
      return;
    }

    if (!this.opts.smooth || Math.abs(scale - from) < 0.001) {
      el.style.zoom = scale === 1 ? '' : String(scale);
      return;
    }

    var dur = this.opts.smoothDuration;
    var start = performance.now();
    (function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var v = from + (scale - from) * t;
      el.style.zoom = v === 1 ? '' : String(v);
      if (t < 1) requestAnimationFrame(frame);
    })(performance.now());
  };

  /* ========== 监听 ========== */
  ZoomCompensator.prototype._watchDpr = function () {
    if (typeof window.matchMedia !== 'function') return;
    var self = this, mql;
    function onChange() {
      if (mql) {
        if (mql.removeEventListener) mql.removeEventListener('change', onChange);
        else if (mql.removeListener) mql.removeListener(onChange);
      }
      mql = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
      self.check();
    }
    onChange();
    this._cleanupMql = function () {
      if (!mql) return;
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else if (mql.removeListener) mql.removeListener(onChange);
    };
  };

  ZoomCompensator.prototype.start = function () {
    if (this._timer) return this;
    var self = this;
    window.addEventListener('resize', this._onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', this._onResize);
    this._watchDpr();
    if (this.opts.pollInterval > 0) {
      this._timer = setInterval(function () { self.check(); }, this.opts.pollInterval);
    }
    this.check(true);
    return this;
  };

  ZoomCompensator.prototype.stop = function () {
    window.removeEventListener('resize', this._onResize);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._onResize);
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._cleanupMql) { this._cleanupMql(); this._cleanupMql = null; }
    return this;
  };

  ZoomCompensator.prototype.destroy = function () {
    this.stop();
    this._apply(1);
    this._scale = 1;
    return this;
  };

  /* ========== 手动覆盖 / 重新校准 ========== */
  ZoomCompensator.prototype.setManual = function (scale) {
    if (scale == null) return this.clearManual();
    this.manual = Number(scale);
    this._store.set('manual', this.manual);
    return this.check(true);
  };
  ZoomCompensator.prototype.clearManual = function () {
    this.manual = null;
    this._store.remove('manual');
    return this.check(true);
  };
  // 把当前状态设为新基线（用户点"以当前为准"或换显示器后调用）
  ZoomCompensator.prototype.recalibrate = function () {
    this.baseline = this._captureBaseline();
    return this.check(true);
  };

  /* ========== 存储（localStorage 不可用则降级内存） ========== */
  ZoomCompensator.prototype._makeStore = function (key) {
    var mem = {};
    var ok = (function () {
      try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
      catch (e) { return false; }
    })();
    return {
      get: function (k, d) {
        try { var v = ok ? localStorage.getItem(key + ':' + k) : mem[k]; return v == null ? d : JSON.parse(v); }
        catch (e) { return d; }
      },
      set: function (k, v) {
        try { var s = JSON.stringify(v); if (ok) localStorage.setItem(key + ':' + k, s); else mem[k] = s; } catch (e) {}
      },
      remove: function (k) {
        try { if (ok) localStorage.removeItem(key + ':' + k); else delete mem[k]; } catch (e) {}
      }
    };
  };

  /* ========== 静态诊断 ========== */
  ZoomCompensator.diagnose = function (opts) {
    return new ZoomCompensator(Object.assign({ autoStart: false }, opts || {}))._resolve();
  };

  return ZoomCompensator;
});