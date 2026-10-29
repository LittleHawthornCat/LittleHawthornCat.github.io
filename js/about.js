// js/about.js —— 档案页（Swup 无刷新架构版）
// 由 main.js 在每次进入档案页时调用：window.initAboutPage(signal)
(function () {
  'use strict';

  const SITE_URL = './info/site.json';
  const MUSIC_URL = './info/music.json';
  const DOC_DIR = './article/about/';
  const BLOG_DIR = './article/blog/';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 工具 ---------- */
  function fetchJSON(url, signal) {
    return fetch(url, { cache: 'no-store', signal }).then(res => {
      if (!res.ok) throw new Error(`无法加载 ${url}（HTTP ${res.status}）`);
      return res.json();
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 字数统计：CJK 表意文字按字计，西文/数字连续段按词计，剔除代码围栏
  function countWords(text) {
    const body = text.replace(/```[\s\S]*?```/g, ' ');
    const cjk = (body.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
    const latin = (body.match(/[A-Za-z0-9]+/g) || []).length;
    return cjk + latin;
  }

  // 数字从 0 滚动到目标值（rAF 统一登记到 window.pageRafId）
  function countUp(el, target, dur, signal) {
    dur = dur || 1800;
    if (!el) return;
    if (REDUCED || target === 0) { el.textContent = fmt(target); return; }

    const t0 = performance.now();
    function frame(t) {
      if (signal && signal.aborted) return;
      const p = Math.min(1, (t - t0) / dur);
      const e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      el.textContent = fmt(Math.round(target * e));
      if (p < 1) window.pageRafId = requestAnimationFrame(frame);
    }
    window.pageRafId = requestAnimationFrame(frame);
  }
  function fmt(n) { return n.toLocaleString('en-US'); }

  function showLoadError(err) {
    const box = document.createElement('div');
    box.className = 'load-error';
    box.innerHTML = `
      <div class="load-error__inner">
        <div class="load-error__label">АРХИВ / ERROR</div>
        <h1>数据加载失败</h1>
        <p>${esc(err.message)}</p>
        <p>请确认通过 HTTP 服务器访问本站（<code>file://</code> 下浏览器会阻止 fetch）。</p>
        <p>例如：<code>python3 -m http.server 8000</code> 或 <code>npx serve</code>。</p>
      </div>`;
    (document.getElementById('swup') || document.body).appendChild(box);
  }

  /* ============================================================
     1. 页首 & 进度条 & 浮现动画
     ============================================================ */
  function initChrome(signal) {
    const main = document.getElementById('pageMain');
    const bar = document.getElementById('progressBar');
    if (!main || !bar) return;

    function update() {
      const max = main.scrollHeight - main.clientHeight;
      const p = max > 0 ? Math.min(1, main.scrollTop / max) : 0;
      bar.style.transform = `scaleX(${p})`;
    }
    main.addEventListener('scroll', update, { passive: true, signal });
    update();

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { root: main, threshold: 0.05, rootMargin: '0px 0px 60px 0px' });
    document.querySelectorAll('.page-main .reveal').forEach(el => io.observe(el));
    signal.addEventListener('abort', () => io.disconnect(), { once: true });
  }

  function renderHead(archive) {
    if (!archive) return;
    const lede = document.getElementById('headLede');
    if (archive.intro && archive.intro[0] && lede) {
      const tmp = document.createElement('div');
      tmp.innerHTML = archive.intro[0]; // 数据可信
      lede.textContent = tmp.textContent;
    }
  }

  /* ============================================================
     2. 统计带：抓取 ess- / nov- 序列文章并实测字数
     ============================================================ */
  const stats = { ready: false, visible: false, words: 0, ess: 0, nov: 0, tracks: 0 };

  async function collectLiteraryStats(siteData, signal) {
    const j = siteData.journal || {};
    const pool = [];
    if (j.lead) pool.push(j.lead);
    if (Array.isArray(j.items)) pool.push(...j.items);

    const seen = new Set();
    const lit = pool
      .map(a => a && (a.slug || a.id || a.no))
      .filter(s => s && /^(ess|nov)-/.test(s))
      .filter(s => !seen.has(s) && seen.add(s));

    const results = await Promise.all(lit.map(async slug => {
      try {
        const res = await fetch(BLOG_DIR + encodeURIComponent(slug) + '.md', { cache: 'no-store', signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return { slug, n: countWords(await res.text()) };
      } catch (e) {
        if (e.name === 'AbortError') return null;
        console.warn('[about] 统计跳过（读取失败）：', slug, e.message);
        return null;
      }
    }));

    results.filter(Boolean).forEach(r => {
      stats.words += r.n;
      if (r.slug.startsWith('ess-')) stats.ess++;
      else if (r.slug.startsWith('nov-')) stats.nov++;
    });
  }

  function tryRunStats(signal) {
    if (!stats.ready || !stats.visible) return;
    const band = document.getElementById('statsBand');
    if (!band) return;
    band.classList.add('in');
    countUp(document.getElementById('statWords'), stats.words, 2200, signal);
    countUp(document.getElementById('statEss'), stats.ess, 1200, signal);
    countUp(document.getElementById('statNov'), stats.nov, 1200, signal);
    countUp(document.getElementById('statTracks'), stats.tracks, 1200, signal);
    const sub = document.getElementById('statWordsSub');
    if (stats.words >= 10000 && sub) {
      sub.textContent = `散文 + 小说 · ≈ ${(stats.words / 10000).toFixed(1)} 万字`;
    }
  }

  function initStats(siteData, trackCount, signal) {
    stats.ready = false;
    stats.visible = false;
    stats.words = 0;
    stats.ess = 0;
    stats.nov = 0;
    stats.tracks = trackCount;

    const band = document.getElementById('statsBand');
    const main = document.getElementById('pageMain');
    if (!band || !main) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { stats.visible = true; tryRunStats(signal); io.disconnect(); }
      });
    }, { root: main, threshold: 0.25 });
    io.observe(band);
    signal.addEventListener('abort', () => io.disconnect(), { once: true });

    collectLiteraryStats(siteData, signal).then(() => {
      if (signal.aborted) return;
      stats.ready = true;
      tryRunStats(signal);
    });
  }

  /* ============================================================
     3. 档案文献（选项卡阅读器）
     ============================================================ */
  function initDocs(cards, signal) {
    const tabs = document.getElementById('docTabs');
    const body = document.getElementById('docBody');
    if (!tabs || !body) return;

    const docs = cards
      .map(c => ({ slug: c.slug || c.id || c.no, title: c.title, no: c.no }))
      .filter(d => d.slug);

    docs.forEach(d => {
      const b = document.createElement('button');
      b.className = 'doc-tab';
      b.dataset.slug = d.slug;
      b.innerHTML = `<span class="no">${esc(d.no || '')}</span><span>${esc(d.title)}</span>`;
      b.addEventListener('click', () => selectDoc(d.slug, true), { signal });
      tabs.appendChild(b);
    });

    async function selectDoc(slug, push) {
      tabs.querySelectorAll('.doc-tab').forEach(t => t.classList.toggle('active', t.dataset.slug === slug));
      const doc = docs.find(d => d.slug === slug);
      if (doc) document.title = `${doc.title} · 档案`;
      if (push) {
        // 打上页面内部条目的标记，供 main.js 的 popstate 兜底识别
        history.replaceState({ source: 'about-page', slug }, '', `?slug=${encodeURIComponent(slug)}`);
      }

      body.innerHTML = '<div class="loading-text">正在调阅卷宗……</div>';
      try {
        const res = await fetch(DOC_DIR + encodeURIComponent(slug) + '.md', { cache: 'no-store', signal });
        if (!res.ok) throw new Error('NOT_FOUND');
        const text = await res.text();
        if (signal.aborted) return;

        body.innerHTML = (typeof renderMarkdownToHTML === 'function')
          ? renderMarkdownToHTML(text)
          : marked.parse(text);
        body.querySelectorAll('pre code').forEach(el => {
          if (/\blanguage-[\w+#.-]+\b/.test(el.className)) hljs.highlightElement(el);
        });
      } catch (e) {
        if (e.name === 'AbortError' || signal.aborted) return;
        body.innerHTML = `
          <div style="text-align:center; padding: 48px 20px;">
            <h2 style="color:var(--red); font-family:var(--font-display); font-size:28px;">卷宗缺失</h2>
            <p style="color:var(--ink2); margin-top:16px;">文件 <code>article/about/${esc(slug)}.md</code> 不存在或无法读取。</p>
          </div>`;
      }
    }

    const want = new URLSearchParams(location.search).get('slug');
    const first = docs.some(d => d.slug === want) ? want : (docs[0] && docs[0].slug);
    if (first) {
      // 未带 slug 时补齐地址栏，保证刷新 / 前进后退时能回到同一卷宗
      if (!want) {
        history.replaceState(
          { source: 'about-page', slug: first },
          '',
          `?slug=${encodeURIComponent(first)}`
        );
      }
      selectDoc(first, false);
    } else {
      body.innerHTML = '<div class="loading-text">site.json 中没有 archive.cards 数据。</div>';
    }
  }

  /* ============================================================
     4. 音乐库
     ============================================================ */
  const CATS = [
    { key: 'rock',  label: '摇滚', color: '#C0271C' },
    { key: 'ele',   label: '电子', color: '#C9A227' },
    { key: 'pop',   label: '流行', color: '#17161A' },
    { key: 'other', label: '其他', color: '#8A8678' }
  ];
  function catOf(prefix) {
    return CATS.find(c => c.key === prefix) || CATS[3];
  }

  // 解析 "类别 - 艺术家 - 曲名.ext"
  function parseTrack(file, idx) {
    const base = file.replace(/\.[^.]+$/, '');
    const parts = base.split(' - ').map(s => s.trim());
    const cat = catOf((parts[0] || '').toLowerCase());
    const artist = (parts[1] || '未知艺术家').replace(/_/g, ' & ');
    const title = parts.length > 2 ? parts.slice(2).join(' - ') : (parts[1] || base);
    return { idx, file, title, artist, cat };
  }

  const player = {
    tracks: [],
    cur: -1,
    filter: 'all',
    seeking: false
  };

  function initMusic(files, signal) {
    const audio = document.getElementById('audioEl');
    if (!audio) return;

    // 每次进入页面都重置播放器状态（DOM 是新的一份）
    player.tracks = (files || []).map(parseTrack);
    player.cur = -1;
    player.filter = 'all';
    player.seeking = false;

    /* --- 音量记忆 --- */
    let vol = 0.8;
    try { vol = parseFloat(localStorage.getItem('dossier_vol')); if (isNaN(vol)) vol = 0.8; } catch (e) {}
    audio.volume = vol;
    const volBar = document.getElementById('volBar');
    if (volBar) volBar.value = Math.round(vol * 100);

    renderQuota(signal);
    renderFilters(signal);
    renderList(signal);

    /* --- 控件事件 --- */
    const btnPlay = document.getElementById('btnPlay');
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const seek = document.getElementById('seekBar');

    if (btnPlay) btnPlay.addEventListener('click', togglePlay, { signal });
    if (btnPrev) btnPrev.addEventListener('click', () => step(-1), { signal });
    if (btnNext) btnNext.addEventListener('click', () => step(1), { signal });

    if (seek) {
      seek.addEventListener('input', () => {
        player.seeking = true;
        if (audio.duration) {
          document.getElementById('tCur').textContent = fmtTime(seek.value / 1000 * audio.duration);
        }
      }, { signal });

      seek.addEventListener('change', () => {
        if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
        player.seeking = false;
      }, { signal });
    }

    if (volBar) {
      volBar.addEventListener('input', (e) => {
        audio.volume = e.target.value / 100;
        try { localStorage.setItem('dossier_vol', String(audio.volume)); } catch (err) {}
      }, { signal });
    }

    audio.addEventListener('timeupdate', () => {
      if (!player.seeking && audio.duration && seek) {
        seek.value = Math.round(audio.currentTime / audio.duration * 1000);
        const tCur = document.getElementById('tCur');
        if (tCur) tCur.textContent = fmtTime(audio.currentTime);
      }
    }, { signal });

    audio.addEventListener('loadedmetadata', () => {
      const tDur = document.getElementById('tDur');
      if (tDur) tDur.textContent = fmtTime(audio.duration);
    }, { signal });

    audio.addEventListener('play', () => syncUI(signal), { signal });
    audio.addEventListener('pause', () => syncUI(signal), { signal });
    audio.addEventListener('ended', () => step(1), { signal });
    audio.addEventListener('error', () => {
      if (player.cur < 0) return;
      setMsg('信号中断：文件缺失或格式不受支持。');
      const radio = document.getElementById('radio');
      if (radio) radio.classList.remove('playing');
    }, { signal });

    /* --- 离开页面：暂停播放，避免切页后音乐在后台继续 --- */
    signal.addEventListener('abort', () => {
      try { audio.pause(); } catch (e) {}
    }, { once: true });

    function playTrack(idx) {
      const t = player.tracks[idx];
      if (!t) return;
      player.cur = idx;
      audio.src = './music/' + encodeURI(t.file);
      audio.play().catch(() => setMsg('浏览器拦截了自动播放，请再点一次。'));

      const radioTitle = document.getElementById('radioTitle');
      const radioArtist = document.getElementById('radioArtist');
      const radioCat = document.getElementById('radioCat');
      if (radioTitle) radioTitle.textContent = t.title;
      if (radioArtist) radioArtist.textContent = t.artist;
      if (radioCat) { radioCat.hidden = false; radioCat.textContent = t.cat.label; }

      setMsg('');
      const tCur = document.getElementById('tCur');
      if (tCur) tCur.textContent = '00:00';
      if (seek) seek.value = 0;

      renderList(signal);
      syncUI(signal);
    }

    function togglePlay() {
      if (player.cur < 0) { if (player.tracks.length) playTrack(0); return; }
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    }

    function step(d) {
      const n = player.tracks.length;
      if (!n) return;
      playTrack(((player.cur < 0 ? 0 : player.cur) + d + n) % n);
    }

    function syncUI(sig) {
      const radio = document.getElementById('radio');
      const btn = document.getElementById('btnPlay');
      const playing = !audio.paused && player.cur >= 0;
      if (radio) radio.classList.toggle('playing', playing);
      if (btn) btn.textContent = playing ? '❚❚' : '▶';
    }

    function setMsg(s) {
      const msg = document.getElementById('radioMsg');
      if (msg) msg.textContent = s;
    }

    function renderFilters(sig) {
      const wrap = document.getElementById('trackFilters');
      if (!wrap) return;
      wrap.innerHTML = '';
      const opts = [{ key: 'all', label: '全部' }].concat(CATS);
      opts.forEach(o => {
        const n = o.key === 'all' ? player.tracks.length : player.tracks.filter(t => t.cat.key === o.key).length;
        const b = document.createElement('button');
        b.className = 'tfilter' + (player.filter === o.key ? ' active' : '');
        b.textContent = `${o.label} ${n}`;
        b.addEventListener('click', () => {
          player.filter = o.key;
          wrap.querySelectorAll('.tfilter').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          renderList(sig);
        }, { signal });
        wrap.appendChild(b);
      });
    }

    function renderList(sig) {
      const list = document.getElementById('trackList');
      if (!list) return;
      list.innerHTML = '';
      const shown = player.tracks.filter(t => player.filter === 'all' || t.cat.key === player.filter);
      if (!shown.length) {
        list.innerHTML = '<div class="loading-text">该类别暂无馆藏。</div>';
        return;
      }
      shown.forEach(t => {
        const row = document.createElement('div');
        row.className = 'track' + (t.idx === player.cur ? ' playing' : '');
        row.innerHTML = `
          <span class="t-no">№ ${String(t.idx + 1).padStart(2, '0')}</span>
          <span class="t-title">${esc(t.title)}</span>
          <span class="t-artist">${esc(t.artist)}</span>
          <span class="t-cat">${t.cat.label}</span>`;
        row.addEventListener('click', () => {
          if (t.idx === player.cur) togglePlay();
          else playTrack(t.idx);
        }, { signal });
        list.appendChild(row);
      });
    }

    function renderQuota(sig) {
      const n = player.tracks.length;
      const totalEl = document.getElementById('quotaTotal');
      const bar = document.getElementById('quotaBar');
      const rows = document.getElementById('quotaRows');
      if (!bar || !rows) return;

      if (totalEl) totalEl.textContent = `共 ${n} 轨`;
      bar.innerHTML = '';
      rows.innerHTML = '';

      if (!n) {
        rows.innerHTML = '<div class="quota-empty">馆藏为空 —— 请在 info/music.json 中登记曲目。</div>';
        return;
      }

      const counts = CATS.map(c => ({ cat: c, n: player.tracks.filter(t => t.cat.key === c.key).length }));

      counts.forEach(({ cat, n: c }) => {
        const pct = c / n * 100;
        const seg = document.createElement('i');
        seg.style.background = cat.color;
        seg.dataset.w = pct;
        seg.title = `${cat.label} ${c} 轨`;
        bar.appendChild(seg);

        const row = document.createElement('div');
        row.className = 'quota-row';
        row.innerHTML = `
          <span class="dot" style="background:${cat.color}"></span>
          <span>${cat.label}</span>
          <span class="bar"><i style="background:${cat.color}" data-w="${pct}"></i></span>
          <span class="pct">${c} 轨 · ${pct.toFixed(1)}%</span>`;
        rows.appendChild(row);
      });

      // 入帧后再设宽，触发过渡动画（rAF 统一登记）
      window.pageRafId = requestAnimationFrame(() => {
        if (signal.aborted) return;
        window.pageRafId = requestAnimationFrame(() => {
          if (signal.aborted) return;
          bar.querySelectorAll('i').forEach(i => { i.style.width = i.dataset.w + '%'; });
          rows.querySelectorAll('.bar i').forEach(i => { i.style.width = i.dataset.w + '%'; });
        });
      });
    }
  }

  function fmtTime(s) {
    if (!isFinite(s)) return '00:00';
    s = Math.floor(s);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /* ============================================================
     5. 入口：由 main.js 调用
     ============================================================ */
  window.initAboutPage = async function (signal) {
    signal = signal || new AbortController().signal;

    if (!document.getElementById('pageMain')) return; // 非档案页 DOM

    initChrome(signal);
    try {
      const [site, music] = await Promise.all([
        fetchJSON(SITE_URL, signal),
        fetchJSON(MUSIC_URL, signal).catch(e => {
          if (e.name === 'AbortError') throw e;
          console.warn('[about]', e.message);
          return { tracks: [] };
        })
      ]);
      if (signal.aborted) return;

      renderHead(site.archive);
      initDocs((site.archive && site.archive.cards) || [], signal);
      initMusic(music.tracks || [], signal);
      initStats(site, (music.tracks || []).length, signal);
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) return;
      console.error('[about]', err);
      showLoadError(err);
    }
  };
})();
