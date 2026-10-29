/* ============================================================
   js/index.js —— 首页（Swup 无刷新架构版）
   由 main.js 在每次进入首页时调用：window.initIndexPage(hash, signal)
   ============================================================ */
(function () {
  'use strict';

  const DATA_URL = 'info/site.json';

  const $ = (id) => document.getElementById(id);

  /* ---------- 1. 读取数据（支持 AbortSignal） ---------- */
  async function loadSiteData(signal) {
    const res = await fetch(DATA_URL, { cache: 'no-store', signal });
    if (!res.ok) throw new Error(`无法加载 ${DATA_URL}（HTTP ${res.status}）`);
    try {
      return await res.json();
    } catch {
      throw new Error(`${DATA_URL} 不是合法的 JSON`);
    }
  }

  /* ---------- 2. 渲染工具 ---------- */
  function setText(el, value) {
    if (el) el.textContent = value == null ? '' : value;
  }

  function setField(panel, field, value) {
    if (panel) setText(panel.querySelector(`[data-field="${field}"]`), value);
  }

  /* 生成文章页链接：about.html / project.html / blog.html
     参数优先取 slug / id / no，否则用 fallback（序号） */
  function articleUrl(page, item, fallback) {
    const slug = item && (item.slug || item.id || item.no);
    const value = slug || fallback;
    return `${page}?slug=${encodeURIComponent(value)}`;
  }

  /* ---------- 3. 分区渲染 ---------- */
  function renderHero(h) {
    if (!h) return;
    const tags = $('heroTags');
    if (!tags) return;
    tags.innerHTML = '';
    (h.tags || []).forEach(t => {
      const s = document.createElement('span');
      s.className = 'tag' + (t.variant ? ' ' + t.variant : '');
      s.textContent = t.text;
      tags.appendChild(s);
    });
    setText($('heroTitleCn'), h.titleCn);
    setText($('heroTitleCy'), h.titleCy);
    setText($('heroLede'), h.lede);
    setText($('heroHint'), h.hint);
  }

  function renderArchive(a) {
    if (!a) return;
    const panel = $('archive');
    setField(panel, 'label', a.label);
    setField(panel, 'title', a.title);
    setField(panel, 'subtitle', a.subtitle);

    const stamp = $('archiveStamp');
    if (stamp) {
      stamp.innerHTML = '';
      const main = document.createElement('span');
      main.textContent = a.stamp ? a.stamp.main : '';
      const sub = document.createElement('small');
      sub.textContent = a.stamp ? a.stamp.sub : '';
      stamp.append(main, sub);
    }

    const intro = $('archiveIntro');
    if (intro) intro.innerHTML = (a.intro || []).map(p => `<p>${p}</p>`).join('');

    const grid = $('archiveGrid');
    if (!grid) return;
    grid.innerHTML = '';
    (a.cards || []).forEach((c, i) => {
      // 档案卡片 → about.html 详情页
      const card = document.createElement('a');
      card.className = 'archive-card reveal';
      card.href = articleUrl('about.html', c, String(i + 1));
      card.style.color = 'inherit';
      card.style.textDecoration = 'none';
      card.style.setProperty('--reveal-delay', (0.1 * (i + 1)).toFixed(1) + 's');
      card.innerHTML = `
        <div class="card-top"><span>${c.no}</span><span>${c.date}</span></div>
        <div class="card-body">
          <h3 class="card-title">${c.title}</h3>
          <p class="card-desc">${c.desc}</p>
        </div>
        <div class="card-foot"><span>${c.footLeft}</span><span>${c.footRight}</span></div>`;
      grid.appendChild(card);
    });
  }

  function renderWorks(w) {
    if (!w) return;
    const panel = $('works');
    setField(panel, 'label', w.label);
    setField(panel, 'title', w.title);
    setField(panel, 'subtitle', w.subtitle);
    setField(panel, 'desc', w.desc);

    const list = $('worksList');
    if (!list) return;
    list.innerHTML = '';
    (w.items || []).forEach((it, i) => {
      const a = document.createElement('a');
      a.className = 'work reveal';
      a.href = articleUrl('project.html', it, String(i + 1));
      a.setAttribute('aria-label', it.name);
      a.style.setProperty('--reveal-delay', (0.1 * (i + 1)).toFixed(1) + 's');
      a.innerHTML = `
        <span class="work-no">${it.no}</span>
        <span class="work-name">${it.name}<em>${it.nameEn || ''}</em></span>
        <span class="work-tag">${it.tag || ''}</span>
        <span class="work-year">${it.year || ''}</span>
        <span class="work-status">${it.status || ''}</span>
        <span class="work-arrow" aria-hidden="true">↗</span>`;
      list.appendChild(a);
    });
  }

  function renderJournal(j) {
    if (!j) return;
    const panel = $('journal');
    setField(panel, 'label', j.label);
    setField(panel, 'title', j.title);
    setField(panel, 'subtitle', j.subtitle);
    setField(panel, 'desc', j.desc);

    const wrap = $('journalList');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (j.lead) {
      const lead = document.createElement('a');
      lead.className = 'log-lead reveal';
      lead.href = articleUrl('blog.html', j.lead, 'lead');
      lead.innerHTML = `
        <div class="ll-meta">${(j.lead.meta || []).map(m => `<span>${m}</span>`).join('')}</div>
        <h3>${j.lead.title}</h3>
        <p>${j.lead.excerpt}</p>
        <div>${(j.lead.tags || []).map(t => `<span class="tag-small">${t}</span>`).join('')}</div>`;
      wrap.appendChild(lead);
    }

    (j.items || []).forEach((it, i) => {
      const a = document.createElement('a');
      a.className = 'log-item reveal';
      a.href = articleUrl('blog.html', it, String(i + 1));
      a.style.setProperty('--reveal-delay', (0.1 * (i + 1)).toFixed(1) + 's');
      a.innerHTML = `
        <div class="li-meta"><span class="no">${it.no}</span><span>${it.date}</span></div>
        <div>
          <h4>${it.title}</h4>
          <p>${it.desc}</p>
          ${(it.tags || []).map(t => `<span class="tag-small">${t}</span>`).join('')}
        </div>`;
      wrap.appendChild(a);
    });
  }

  function renderContact(c) {
    if (!c) return;
    setText($('contactLabel'), c.label);
    setText($('contactTitle'), c.title);
    setText($('contactDesc'), c.desc);

    const email = $('contactEmail');
    if (email) {
      email.textContent = c.email || '';
      email.href = 'mailto:' + (c.email || '');
    }

    const links = $('contactLinks');
    if (!links) return;
    links.innerHTML = '';
    (c.links || []).forEach(l => {
      const a = document.createElement('a');
      a.href = l.href || '#';
      a.innerHTML = `<span>${l.label}</span><span>${l.value}</span>`;
      links.appendChild(a);
    });
  }

  function renderFooter(f) {
    const bar = $('footerBar');
    if (!bar || !f) return;
    bar.innerHTML = `
      <span>${f.left || ''}</span>
      <span>${f.center || ''}</span>
      <span class="red">${f.highlight || ''}</span>`;
  }

  function renderSite(d) {
    if (d.site) {
      if (d.site.title) document.title = d.site.title;
      if (d.site.lang) document.documentElement.lang = d.site.lang;
    }
    setText($('sidebarBrand'), d.brand);

    const nav = $('sidebarNav');
    if (nav) {
      nav.innerHTML = '';
      (d.nav || []).forEach(item => {
        const a = document.createElement('a');
        // 侧栏是持久化元素：统一用 index.html + hash，保证其它页面点击也能回到首页抽屉
        a.href = item.target === 'hero' ? 'index.html' : `index.html#${item.target}`;
        a.dataset.target = item.target;
        a.textContent = item.label;
        nav.appendChild(a);
      });
    }

    renderHero(d.hero);
    renderArchive(d.archive);
    renderWorks(d.works);
    renderJournal(d.journal);
    renderContact(d.contact);
    renderFooter(d.footer);
  }

  /* ---------- 4. 加载失败提示 ---------- */
  function showLoadError(err) {
    document.documentElement.lang = 'zh-CN';

    const box = document.createElement('div');
    box.className = 'load-error';
    box.innerHTML = `
      <div class="load-error__inner">
        <div class="load-error__label">DATA / ERROR</div>
        <h1>数据加载失败</h1>
        <p>${err.message}</p>
        <p>请确认 <code>${DATA_URL}</code> 与 <code>index.html</code> 位于同一目录，且通过 HTTP 服务器访问（<code>file://</code> 下浏览器会阻止 fetch）。</p>
        <p>例如：<code>python3 -m http.server 8000</code> 或 <code>npx serve</code>。</p>
      </div>`;
    // 放进 #swup 内，切页时随内容一起销毁
    ($('swup') || document.body).appendChild(box);
    document.body.classList.add('is-ready');
  }

  /* ============================================================
     5. 首页交互（抽屉 / 进度条 / 视差 / Hash 直达）
     ============================================================ */
  function initSite(hash, signal) {
    const sidebarNav = $('sidebarNav');
    const basePanel = $('hero');
    const progressBar = $('progressBar');
    if (!sidebarNav || !basePanel || !progressBar) return;

    const links = sidebarNav.querySelectorAll('a');
    const openStack = [];
    const observers = new Map();
    const timers = new Set();
    let zTop = 10;

    /* ---- 计时器（切页统一清理，避免迟到回调操作旧 DOM） ---- */
    function later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!signal.aborted) fn();
      }, ms);
      timers.add(id);
      return id;
    }

    /* ---- 面板内的浮现观察器 ---- */
    document.querySelectorAll('.panel-inner').forEach(inner => {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            later(() => entry.target.classList.add('in'), 80);
            io.unobserve(entry.target);
          }
        });
      }, { root: inner, threshold: 0.05, rootMargin: '0px 0px 90px 0px' });
      observers.set(inner, io);
    });

    const getPanel = id => document.querySelector(`[data-panel][id="${id}"]`);

    function openPanelEl(id) {
      const el = getPanel(id);
      if (!el) return;
      if (el._closeTimer) {
        clearTimeout(el._closeTimer);
        timers.delete(el._closeTimer);
        el._closeTimer = null;
      }
      el.style.zIndex = ++zTop;
      el.classList.add('is-open');

      const inner = el.querySelector('.panel-inner');
      const io = observers.get(inner);
      const reveals = el.querySelectorAll('.reveal, .stamp-reveal');

      reveals.forEach(item => {
        item.classList.remove('in');
        if (item.classList.contains('stamp-reveal')) {
          later(() => {
            if (el.classList.contains('is-open')) item.classList.add('in');
          }, 300);
        } else if (io) {
          io.observe(item);
        }
      });
    }

    function closePanelEl(id) {
      const el = getPanel(id);
      if (!el) return;
      el.classList.remove('is-open');

      const inner = el.querySelector('.panel-inner');
      const io = observers.get(inner);
      const reveals = el.querySelectorAll('.reveal, .stamp-reveal');
      reveals.forEach(item => { if (io) io.unobserve(item); });

      el._closeTimer = later(() => {
        reveals.forEach(item => item.classList.remove('in'));
      }, 800);
    }

    function updateNav() {
      const topId = openStack.length ? openStack[openStack.length - 1] : 'hero';
      links.forEach(link => {
        const id = link.dataset.target;
        link.classList.toggle('active', id === topId);
        link.classList.toggle('is-open', openStack.includes(id) && id !== topId);
      });
    }

    function toggleSection(id) {
      window.currentIndexPanel = id;
      if (id === 'hero') {
        while (openStack.length) closePanelEl(openStack.pop());
        updateNav();
        queueProgress();
        return;
      }
      const idx = openStack.indexOf(id);
      const isTop = idx === openStack.length - 1 && idx !== -1;

      if (isTop) {
        openStack.pop();
        closePanelEl(id);
      } else if (idx !== -1) {
        while (openStack.length - 1 > idx) closePanelEl(openStack.pop());
      } else {
        openStack.push(id);
        openPanelEl(id);
      }
      updateNav();
      queueProgress();
    }

    /* ---- 侧栏点击（持久化侧栏 → 每次进首页都重新绑定，signal 兜底） ---- */
    sidebarNav.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      e.preventDefault();
      toggleSection(link.dataset.target || 'hero');
    }, { signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openStack.length) {
        closePanelEl(openStack.pop());
        updateNav();
        queueProgress();
      }
    }, { signal });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        document.querySelectorAll('.panel--drawer.is-open').forEach(panel => {
          panel.querySelectorAll('.reveal, .stamp-reveal').forEach(item => item.classList.add('in'));
        });
      }
    }, { signal });

    /* ---- 进度条 ---- */
    let progressQueued = false;

    function currentScroller() {
      if (!openStack.length) return basePanel.querySelector('.panel-inner');
      const el = getPanel(openStack[openStack.length - 1]);
      return el ? el.querySelector('.panel-inner') : null;
    }

    function updateProgress() {
      const scroller = currentScroller();
      if (!scroller) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const p = max > 0 ? Math.min(1, scroller.scrollTop / max) : 0;
      progressBar.style.transform = `scaleX(${p})`;
    }

    function queueProgress() {
      if (progressQueued || signal.aborted) return;
      progressQueued = true;
      window.pageRafId = requestAnimationFrame(() => {
        progressQueued = false;
        if (signal.aborted) return;
        updateProgress();
      });
    }

    document.querySelectorAll('.panel-inner').forEach(inner => {
      inner.addEventListener('scroll', queueProgress, { passive: true, signal });
    });

    /* ---- 首屏视差（rAF 受全局 pageRafId / signal 管理） ---- */
    const hero = document.querySelector('.hero');
    const heroLogo = $('heroLogo');

    if (hero && heroLogo) {
      let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
      let isAnimating = false;

      function animateParallax() {
        if (signal.aborted) { isAnimating = false; return; }
        currentX += (targetX - currentX) * 0.1;
        currentY += (targetY - currentY) * 0.1;
        heroLogo.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
          window.pageRafId = requestAnimationFrame(animateParallax);
        } else {
          currentX = targetX;
          currentY = targetY;
          heroLogo.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
          isAnimating = false;
          window.pageRafId = null;
        }
      }

      function kickParallax() {
        if (!isAnimating && !signal.aborted) {
          isAnimating = true;
          window.pageRafId = requestAnimationFrame(animateParallax);
        }
      }

      hero.addEventListener('mousemove', (e) => {
        targetX = (e.clientX / window.innerWidth - 0.5) * 2 * 20;
        targetY = (e.clientY / window.innerHeight - 0.5) * 2 * 20;
        kickParallax();
      }, { signal });

      hero.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
        kickParallax();
      }, { signal });
    }

    /* ---- Hash 直达：从其它页面跳回 index.html#journal 时，无动画开抽屉 ---- */
    function openFromHash(id) {
      if (!id || !getPanel(id)) return false;

      // 临时注入 <style>，只关闭面板的滑动过渡，保证"瞬间就位"
      const style = document.createElement('style');
      style.id = 'index-hash-instant';
      style.textContent = '.panel--drawer, .panel--base { transition: none !important; }';
      document.head.appendChild(style);

      // 清空旧栈，直接压入目标面板
      while (openStack.length) openStack.pop();
      openStack.push(id);
      openPanelEl(id);
      updateNav();
      updateProgress();

      // 两帧之后恢复过渡动画（保留站内点击面板时的滑入动效）
      window.pageRafId = requestAnimationFrame(() => {
        if (signal.aborted) { style.remove(); return; }
        window.pageRafId = requestAnimationFrame(() => {
          if (!signal.aborted) updateProgress();
          style.remove();
          window.pageRafId = null;
        });
      });
      return true;
    }

    /* ---- 切页清理 ---- */
    signal.addEventListener('abort', () => {
      timers.forEach(clearTimeout);
      timers.clear();
      observers.forEach(io => io.disconnect());
      observers.clear();
      cancelAnimationFrame(window.pageRafId);
      window.pageRafId = null;
      const style = $('index-hash-instant');
      if (style) style.remove();
    }, { once: true });

    updateProgress();
    if (hash) openFromHash(hash.replace(/^#/, ''));
  }

  /* ============================================================
     6. 入口：由 main.js 调用
     ============================================================ */
  window.initIndexPage = async function (hash, signal) {
    signal = signal || new AbortController().signal;
    try {
      const data = await loadSiteData(signal);
      if (signal.aborted) return;
      renderSite(data);
      document.body.classList.add('is-ready');
      // 兜底：导航参数里的 hash 为空时，读一次当前地址栏
      const target = hash || window.location.hash.replace(/^#/, '');
      initSite(target, signal);
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) return;
      console.error('[site]', err);
      showLoadError(err);
    }
  };
})();
