// js/project.js —— 工程页（Swup 无刷新架构版）
// 由 main.js 在每次进入工程页时调用：window.initProjectPage(signal)
(function () {
  'use strict';

  const SITE_URL = './info/site.json';
  const PROJ_DIR = './article/project/';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 状态 → 样式类
  function statusClass(s) {
    if (/建造中|进行中/.test(s)) return 'st-build';
    if (/测试/.test(s)) return 'st-test';
    if (/已投产|已完成|上线/.test(s)) return 'st-done';
    return '';
  }

  function showLoadError(err) {
    const box = document.createElement('div');
    box.className = 'load-error';
    box.innerHTML = `
      <div class="load-error__inner">
        <div class="load-error__label">ПРОЕКТ / ERROR</div>
        <h1>数据加载失败</h1>
        <p>${esc(err.message)}</p>
        <p>请确认通过 HTTP 服务器访问本站（<code>file://</code> 下浏览器会阻止 fetch）。</p>
        <p>例如：<code>python3 -m http.server 8000</code> 或 <code>npx serve</code>。</p>
      </div>`;
    (document.getElementById('swup') || document.body).appendChild(box);
  }

  let works = [];

  /* ---------- 进度条 ---------- */
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
  }

  /* ---------- 渲染 ---------- */
  function renderHead(w) {
    const desc = document.getElementById('projDesc');
    if (desc) desc.textContent = w.desc || '';

    const countEl = document.getElementById('projCount');
    if (countEl) countEl.textContent = `${works.length} 项`;

    const chips = document.getElementById('projChips');
    if (!chips) return;
    chips.innerHTML = '';

    const total = document.createElement('span');
    total.className = 'pchip';
    total.innerHTML = `工程总数<b>${works.length}</b>`;
    chips.appendChild(total);

    const byStatus = {};
    works.forEach(it => { byStatus[it.status] = (byStatus[it.status] || 0) + 1; });
    Object.keys(byStatus).forEach(s => {
      const c = document.createElement('span');
      c.className = 'pchip';
      c.innerHTML = `${esc(s)}<b>${byStatus[s]}</b>`;
      chips.appendChild(c);
    });
  }

  function renderAside(signal) {
    const list = document.getElementById('projList');
    if (!list) return;
    list.innerHTML = '';

    works.forEach((it) => {
      const slug = it.slug || it.id || it.no;
      const b = document.createElement('button');
      b.className = 'proj-item';
      b.dataset.slug = slug;
      b.innerHTML = `
        <span class="pi-no">${esc(it.no || '')}</span>
        <span class="pi-name">${esc(it.name)}<em>${esc(it.nameEn || '')}</em></span>
        <span class="pi-status ${statusClass(it.status || '')}">${esc(it.status || '未知')}</span>`;
      b.addEventListener('click', () => select(slug, true, signal), { signal });
      list.appendChild(b);
    });
  }

  async function select(slug, push, signal) {
    const it = works.find(x => (x.slug || x.id || x.no) === slug);
    if (!it) return;

    document.querySelectorAll('.proj-item').forEach(el =>
      el.classList.toggle('active', el.dataset.slug === slug));

    const crumbHere = document.getElementById('crumbHere');
    const crumbMeta = document.getElementById('crumbMeta');
    if (crumbHere) crumbHere.textContent = it.name;
    if (crumbMeta) crumbMeta.textContent = `${it.tag || ''} · ${it.year || ''} · ${it.status || ''}`;
    document.title = `${it.name} · 工程`;
    if (push) {
      // 打上页面内部条目的标记，供 main.js 的 popstate 兜底识别
      history.pushState({ source: 'project-page', slug }, '', `?slug=${encodeURIComponent(slug)}`);
    }

    const body = document.getElementById('projBody');
    if (!body) return;
    body.innerHTML = '<div class="loading-text">正在展开图纸……</div>';

    try {
      const res = await fetch(PROJ_DIR + encodeURIComponent(slug) + '.md', { cache: 'no-store', signal });
      if (!res.ok) throw new Error('NOT_FOUND');
      const text = await res.text();
      if (signal && signal.aborted) return;

      body.innerHTML = (typeof renderMarkdownToHTML === 'function')
        ? renderMarkdownToHTML(text)
        : marked.parse(text);
      body.querySelectorAll('pre code').forEach(el => {
        if (/\blanguage-[\w+#.-]+\b/.test(el.className)) hljs.highlightElement(el);
      });
    } catch (e) {
      if (e.name === 'AbortError' || (signal && signal.aborted)) return;
      body.innerHTML = `
        <div style="text-align:center; padding: 48px 20px;">
          <h2 style="color:var(--red); font-family:var(--font-display); font-size:28px;">图纸缺失</h2>
          <p style="color:var(--ink2); margin-top:16px;">文件 <code>article/project/${esc(slug)}.md</code> 不存在或无法读取。</p>
        </div>`;
    }

    const main = document.getElementById('pageMain');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- 入口 ---------- */
  window.initProjectPage = async function (signal) {
    signal = signal || new AbortController().signal;

    if (!document.getElementById('pageMain')) return; // 非工程页 DOM

    initChrome(signal);
    try {
      const res = await fetch(SITE_URL, { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`无法加载 ${SITE_URL}（HTTP ${res.status}）`);
      const data = await res.json();
      if (signal.aborted) return;

      const w = data.works || {};
      works = (w.items || []).map(it => ({ ...it, slug: it.slug || it.id || it.no }));

      renderHead(w);
      renderAside(signal);

      const want = new URLSearchParams(location.search).get('slug');
      const first = works.find(x => x.slug === want) ? want : (works[0] && works[0].slug);
      if (first) {
        // 未带 slug 时补齐地址栏，保证刷新 / 前进后退时能回到同一张图纸
        if (!want) {
          history.replaceState(
            { source: 'project-page', slug: first },
            '',
            `?slug=${encodeURIComponent(first)}`
          );
        }
        select(first, false, signal);
      } else {
        const body = document.getElementById('projBody');
        if (body) body.innerHTML = '<div class="loading-text">site.json 中没有 works.items 数据。</div>';
      }

      window.addEventListener('popstate', () => {
        if (signal.aborted) return;
        const s = new URLSearchParams(location.search).get('slug');
        if (s && works.some(x => x.slug === s)) select(s, false, signal);
      }, { signal });
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) return;
      console.error('[project]', err);
      showLoadError(err);
    }
  };
})();
