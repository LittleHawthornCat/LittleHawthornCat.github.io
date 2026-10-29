// js/blog.js —— 日志阅读页（Swup 无刷新架构版）
// 由 main.js 在每次进入日志页时调用：window.initBlogPage(signal)
(function () {
  'use strict';

  window.initBlogPage = async function (signal) {
    signal = signal || new AbortController().signal;

    const container = document.getElementById('article-container');
    const blogLayout = document.getElementById('blogLayout');
    const progressBar = document.getElementById('progressBar');
    const overlay = document.getElementById('indexOverlay');
    const navList = document.getElementById('navList');
    const currentTitleEl = document.getElementById('currentTitle');
    const btnIndex = document.getElementById('btnIndex');

    // 防御：当前 DOM 不是日志页
    if (!container || !blogLayout) return;

    let articles = [];
    let currentSlug = new URLSearchParams(window.location.search).get('slug');

    /* ---------- 阅读进度条 ---------- */
    blogLayout.addEventListener('scroll', () => {
      const max = blogLayout.scrollHeight - blogLayout.clientHeight;
      progressBar.style.width = max > 0 ? `${(blogLayout.scrollTop / max) * 100}%` : '0%';
    }, { passive: true, signal });

    /* ---------- 目录浮层 ---------- */
    if (btnIndex) {
      btnIndex.addEventListener('click', () => overlay.classList.toggle('show'), { signal });
    }
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('show'); // 点击空白处关闭
      }, { signal });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay) overlay.classList.remove('show');
    }, { signal });

    /* ---------- 拉取目录数据 ---------- */
    try {
      const res = await fetch('./info/site.json', { cache: 'no-store', signal });
      if (!res.ok) throw new Error(`无法加载 site.json（HTTP ${res.status}）`);
      const data = await res.json();
      if (signal.aborted) return;

      if (data.journal) {
        if (data.journal.lead) articles.push(data.journal.lead);
        if (data.journal.items) articles = articles.concat(data.journal.items);
      }

      // 没有指定文章：默认加载第一篇，并把 slug 写进地址栏
      if (!currentSlug && articles.length > 0) {
        currentSlug = articles[0].slug || articles[0].id || articles[0].no;
        history.replaceState(
          { source: 'blog-page', slug: currentSlug },
          '',
          `?slug=${encodeURIComponent(currentSlug)}`
        );
      }

      buildIndex(articles, currentSlug);

      if (currentSlug) {
        loadArticle(currentSlug, signal);
      } else {
        container.innerHTML = '<div style="text-align:center; padding: 50px;">暂无文章</div>';
      }
    } catch (err) {
      if (err.name === 'AbortError' || signal.aborted) return;
      console.error('[blog]', err);
      container.innerHTML = '<div style="color:var(--red);">加载目录失败</div>';
    }

    /* ---------- 生成毛玻璃目录 ---------- */
    function buildIndex(arts, activeSlug) {
      if (!navList) return;
      navList.innerHTML = ''; // 重进页面时避免重复渲染

      const groups = {};
      arts.forEach(art => {
        const tag = (art.tags && art.tags.length > 0) ? art.tags[0] : '未分类';
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(art);
      });

      Object.keys(groups).forEach(tag => {
        const g = document.createElement('div');
        g.className = 'nav-group';
        g.innerHTML = `<div class="nav-group-title">${tag}</div>`;

        groups[tag].forEach(art => {
          const slug = art.slug || art.id || art.no;
          const a = document.createElement('a');
          a.className = `nav-item${slug === activeSlug ? ' active' : ''}`;
          a.dataset.slug = slug;
          a.textContent = art.title;

          a.addEventListener('click', (e) => {
            e.preventDefault();
            overlay.classList.remove('show');
            switchArticle(slug);
          }, { signal });

          g.appendChild(a);
        });
        navList.appendChild(g);
      });
    }

    /* ---------- 无刷新切换文章 ---------- */
    function switchArticle(slug) {
      currentSlug = slug;
      // 打上页面内部条目的标记，供 main.js 的 popstate 兜底识别
      history.pushState({ source: 'blog-page', slug }, '', `?slug=${encodeURIComponent(slug)}`);

      // 平滑滚回顶部
      blogLayout.scrollTo({ top: 0, behavior: 'smooth' });

      loadArticle(slug, signal);

      document.querySelectorAll('.nav-item').forEach(el =>
        el.classList.toggle('active', el.dataset.slug === slug));
    }

    /* ---------- 加载并渲染正文 ---------- */
    async function loadArticle(slug, sig) {
      const art = articles.find(a => (a.slug || a.id || a.no) === slug);
      if (currentTitleEl) currentTitleEl.textContent = art ? art.title : '阅读';
      document.title = art ? `${art.title} · 日志` : '日志';

      container.innerHTML = '<div style="color:var(--red); font-family:var(--font-mono); font-size:12px; letter-spacing:.15em;">正在拉取墨迹...</div>';

      try {
        const res = await fetch(`./article/blog/${encodeURIComponent(slug)}.md`, { signal: sig, cache: 'no-store' });
        if (!res.ok) throw new Error('NOT_FOUND');
        const text = await res.text();
        if (sig && sig.aborted) return;

        container.innerHTML = (typeof renderMarkdownToHTML === 'function')
          ? renderMarkdownToHTML(text)
          : marked.parse(text);

        container.querySelectorAll('pre code').forEach(el => {
          if (/\blanguage-[\w+#.-]+\b/.test(el.className)) hljs.highlightElement(el);
        });
      } catch (err) {
        if (err.name === 'AbortError' || (sig && sig.aborted)) return;
        container.innerHTML = `<h2 style="color:var(--red);">找不到这篇文章</h2><p>${slug}.md 可能已被删除。</p>`;
      }
    }

    /* ---------- 浏览器前进 / 后退 ---------- */
    window.addEventListener('popstate', () => {
      if (signal.aborted) return;

      const s = new URLSearchParams(location.search).get('slug');
      if (s && s !== currentSlug) {
        currentSlug = s;
        blogLayout.scrollTo({ top: 0, behavior: 'smooth' });
        loadArticle(s, signal);
        document.querySelectorAll('.nav-item').forEach(el =>
          el.classList.toggle('active', el.dataset.slug === s));
      }
    }, { signal });
  };
})();
