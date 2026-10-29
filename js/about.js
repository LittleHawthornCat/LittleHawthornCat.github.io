// js/about.js —— 档案页：统计计数 + 卷宗阅读器 + 音乐库
(function () {
  'use strict';

  const SITE_URL = './info/site.json';
  const MUSIC_URL = './info/music.json';
  const DOC_DIR = './article/about/';
  const BLOG_DIR = './article/blog/';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 工具 ---------- */
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`无法加载 ${url}（HTTP ${res.status}）`);
    return res.json();
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 字数统计：CJK 表意文字按字计，西文/数字连续段按词计，剔除代码围栏
  function countWords(text) {
    const body = text.replace(/```[\s\S]*?```/g, ' ');
    const cjk = (body.match(/[㐀-䶿一-鿿豈-﫿]/g) || []).length;
    const latin = (body.match(/[A-Za-z0-9]+/g) || []).length;
    return cjk + latin;
  }

  // 数字从 0 滚动到目标值
  function countUp(el, target, dur) {
    dur = dur || 1800;
    if (REDUCED || target === 0) { el.textContent = fmt(target); return; }
    const t0 = performance.now();
    (function frame(t) {
      const p = Math.min(1, (t - t0) / dur);
      const e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      el.textContent = fmt(Math.round(target * e));
      if (p < 1) requestAnimationFrame(frame);
    })(t0);
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
    document.body.appendChild(box);
  }

  /* ============================================================
     1. 页首 & 进度条 & 浮现动画
     ============================================================ */
  function initChrome() {
    const main = document.getElementById('pageMain');
    const bar = document.getElementById('progressBar');
    function update() {
      const max = main.scrollHeight - main.clientHeight;
      const p = max > 0 ? Math.min(1, main.scrollTop / max) : 0;
      bar.style.transform = `scaleX(${p})`;
    }
    main.addEventListener('scroll', update, { passive: true });
    update();

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { root: main, threshold: 0.05, rootMargin: '0px 0px 60px 0px' });
    document.querySelectorAll('.page-main .reveal').forEach(el => io.observe(el));
  }

  function renderHead(archive) {
    if (!archive) return;
    const lede = document.getElementById('headLede');
    // 取档案简介第一段作为页首导语（剥掉 HTML 标签）
    if (archive.intro && archive.intro[0]) {
      const tmp = document.createElement('div');
      tmp.innerHTML = archive.intro[0];
      lede.textContent = tmp.textContent;
    }
  }

  /* ============================================================
     2. 统计带：抓取 ess- / nov- 序列文章并实测字数
     ============================================================ */
  const stats = { ready: false, visible: false, words: 0, ess: 0, nov: 0, tracks: 0 };

  async function collectLiteraryStats(siteData) {
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
        const res = await fetch(BLOG_DIR + encodeURIComponent(slug) + '.md', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return { slug, n: countWords(await res.text()) };
      } catch (e) {
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

  function tryRunStats() {
    if (!stats.ready || !stats.visible) return;
    const band = document.getElementById('statsBand');
    band.classList.add('in');
    countUp(document.getElementById('statWords'), stats.words, 2200);
    countUp(document.getElementById('statEss'), stats.ess, 1200);
    countUp(document.getElementById('statNov'), stats.nov, 1200);
    countUp(document.getElementById('statTracks'), stats.tracks, 1200);
    if (stats.words >= 10000) {
      document.getElementById('statWordsSub').textContent =
        `散文 + 小说 · ≈ ${(stats.words / 10000).toFixed(1)} 万字`;
    }
  }

  function initStats(siteData, trackCount) {
    stats.tracks = trackCount;
    const band = document.getElementById('statsBand');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { stats.visible = true; tryRunStats(); io.disconnect(); }
      });
    }, { root: document.getElementById('pageMain'), threshold: 0.25 });
    io.observe(band);

    collectLiteraryStats(siteData).then(() => { stats.ready = true; tryRunStats(); });
  }

  /* ============================================================
     3. 档案文献（选项卡阅读器）
     ============================================================ */
  function initDocs(cards) {
    const tabs = document.getElementById('docTabs');
    const body = document.getElementById('docBody');
    const docs = cards
      .map(c => ({ slug: c.slug || c.id || c.no, title: c.title, no: c.no }))
      .filter(d => d.slug);

    docs.forEach(d => {
      const b = document.createElement('button');
      b.className = 'doc-tab';
      b.dataset.slug = d.slug;
      b.innerHTML = `<span class="no">${esc(d.no || '')}</span><span>${esc(d.title)}</span>`;
      b.addEventListener('click', () => selectDoc(d.slug, true));
      tabs.appendChild(b);
    });

    async function selectDoc(slug, push) {
      tabs.querySelectorAll('.doc-tab').forEach(t => t.classList.toggle('active', t.dataset.slug === slug));
      const doc = docs.find(d => d.slug === slug);
      if (doc) document.title = `${doc.title} · 档案`;
      if (push) history.replaceState(null, '', `?slug=${encodeURIComponent(slug)}`);

      body.innerHTML = '<div class="loading-text">正在调阅卷宗……</div>';
      try {
        const res = await fetch(DOC_DIR + encodeURIComponent(slug) + '.md', { cache: 'no-store' });
        if (!res.ok) throw new Error('NOT_FOUND');
        const text = await res.text();
        body.innerHTML = (typeof renderMarkdownToHTML === 'function')
          ? renderMarkdownToHTML(text)
          : marked.parse(text);
        body.querySelectorAll('pre code').forEach(el => {
          if (/\blanguage-[\w+#.-]+\b/.test(el.className)) hljs.highlightElement(el);
        });
      } catch (e) {
        body.innerHTML = `
          <div style="text-align:center; padding: 48px 20px;">
            <h2 style="color:var(--red); font-family:var(--font-display); font-size:28px;">卷宗缺失</h2>
            <p style="color:var(--ink2); margin-top:16px;">文件 <code>article/about/${esc(slug)}.md</code> 不存在或无法读取。</p>
          </div>`;
      }
    }

    const want = new URLSearchParams(location.search).get('slug');
    const first = docs.some(d => d.slug === want) ? want : (docs[0] && docs[0].slug);
    if (first) selectDoc(first, false);
    else body.innerHTML = '<div class="loading-text">site.json 中没有 archive.cards 数据。</div>';
  }

  /* ============================================================
     4. 音乐库
     ============================================================ */
  // 类别定义：顺序即展示顺序
  const CATS = [
    { key: 'rock',  label: '摇滚', color: '#C0271C' },
    { key: 'ele',   label: '电子', color: '#C9A227' },
    { key: 'pop',   label: '流行', color: '#17161A' },
    { key: 'other', label: '其他', color: '#8A8678' }
  ];
  function catOf(prefix) {
    const hit = CATS.find(c => c.key === prefix);
    return hit || CATS[3];
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

  function initMusic(files) {
    player.tracks = (files || []).map(parseTrack);
    const audio = document.getElementById('audioEl');

    /* --- 音量记忆 --- */
    let vol = 0.8;
    try { vol = parseFloat(localStorage.getItem('dossier_vol')); if (isNaN(vol)) vol = 0.8; } catch (e) {}
    audio.volume = vol;
    document.getElementById('volBar').value = Math.round(vol * 100);

    renderQuota();
    renderFilters();
    renderList();

    /* --- 控件事件 --- */
    document.getElementById('btnPlay').addEventListener('click', togglePlay);
    document.getElementById('btnPrev').addEventListener('click', () => step(-1));
    document.getElementById('btnNext').addEventListener('click', () => step(1));

    const seek = document.getElementById('seekBar');
    seek.addEventListener('input', () => {
      player.seeking = true;
      if (audio.duration) document.getElementById('tCur').textContent = fmtTime(seek.value / 1000 * audio.duration);
    });
    seek.addEventListener('change', () => {
      if (audio.duration) audio.currentTime = seek.value / 1000 * audio.duration;
      player.seeking = false;
    });

    document.getElementById('volBar').addEventListener('input', (e) => {
      audio.volume = e.target.value / 100;
      try { localStorage.setItem('dossier_vol', String(audio.volume)); } catch (err) {}
    });

    audio.addEventListener('timeupdate', () => {
      if (!player.seeking && audio.duration) {
        seek.value = Math.round(audio.currentTime / audio.duration * 1000);
        document.getElementById('tCur').textContent = fmtTime(audio.currentTime);
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      document.getElementById('tDur').textContent = fmtTime(audio.duration);
    });
    audio.addEventListener('play', syncUI);
    audio.addEventListener('pause', syncUI);
    audio.addEventListener('ended', () => step(1));
    audio.addEventListener('error', () => {
      if (player.cur < 0) return;
      setMsg('信号中断：文件缺失或格式不受支持。');
      document.getElementById('radio').classList.remove('playing');
    });
  }

  function renderQuota() {
    const n = player.tracks.length;
    document.getElementById('quotaTotal').textContent = `共 ${n} 轨`;
    const bar = document.getElementById('quotaBar');
    const rows = document.getElementById('quotaRows');
    bar.innerHTML = ''; rows.innerHTML = '';

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

    // 入帧后再设宽，触发过渡动画
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.querySelectorAll('i').forEach(i => i.style.width = i.dataset.w + '%');
      rows.querySelectorAll('.bar i').forEach(i => i.style.width = i.dataset.w + '%');
    }));
  }

  function renderFilters() {
    const wrap = document.getElementById('trackFilters');
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
        renderList();
      });
      wrap.appendChild(b);
    });
  }

  function renderList() {
    const list = document.getElementById('trackList');
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
      });
      list.appendChild(row);
    });
  }

  function playTrack(idx) {
    const t = player.tracks[idx];
    if (!t) return;
    player.cur = idx;
    const audio = document.getElementById('audioEl');
    audio.src = './music/' + encodeURI(t.file);
    audio.play().catch(() => setMsg('浏览器拦截了自动播放，请再点一次。'));

    document.getElementById('radioTitle').textContent = t.title;
    document.getElementById('radioArtist').textContent = t.artist;
    const cat = document.getElementById('radioCat');
    cat.hidden = false;
    cat.textContent = t.cat.label;
    setMsg('');
    document.getElementById('tCur').textContent = '00:00';
    document.getElementById('seekBar').value = 0;
    renderList();
    syncUI();
  }

  function togglePlay() {
    const audio = document.getElementById('audioEl');
    if (player.cur < 0) { if (player.tracks.length) playTrack(0); return; }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function step(d) {
    const n = player.tracks.length;
    if (!n) return;
    playTrack(((player.cur < 0 ? 0 : player.cur) + d + n) % n);
  }

  function syncUI() {
    const audio = document.getElementById('audioEl');
    const playing = !audio.paused && player.cur >= 0;
    document.getElementById('radio').classList.toggle('playing', playing);
    document.getElementById('btnPlay').textContent = playing ? '❚❚' : '▶';
  }

  function setMsg(s) { document.getElementById('radioMsg').textContent = s; }

  function fmtTime(s) {
    if (!isFinite(s)) return '00:00';
    s = Math.floor(s);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /* ============================================================
     启动
     ============================================================ */
  document.addEventListener('DOMContentLoaded', async () => {
    initChrome();
    try {
      const [site, music] = await Promise.all([
        fetchJSON(SITE_URL),
        fetchJSON(MUSIC_URL).catch(e => { console.warn('[about]', e.message); return { tracks: [] }; })
      ]);
      renderHead(site.archive);
      initDocs((site.archive && site.archive.cards) || []);
      initMusic(music.tracks || []);
      initStats(site, (music.tracks || []).length);
    } catch (err) {
      console.error('[about]', err);
      showLoadError(err);
    }
  });
})();
