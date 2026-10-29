// js/blog.js
document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('article-container');
  const blogLayout = document.getElementById('blogLayout');
  const progressBar = document.getElementById('progressBar');
  const overlay = document.getElementById('indexOverlay');
  const navList = document.getElementById('navList');
  const currentTitleEl = document.getElementById('currentTitle');

  // URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  let currentSlug = urlParams.get('slug');

  // 滚动进度
  blogLayout.addEventListener('scroll', () => {
    const max = blogLayout.scrollHeight - blogLayout.clientHeight;
    progressBar.style.width = max > 0 ? `${(blogLayout.scrollTop / max) * 100}%` : '0%';
  });

  // 目录开关
  document.getElementById('btnIndex').addEventListener('click', () => {
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('show'); // 点击空白处关闭
  });

  // 1. 获取数据
  let articles = [];
  try {
    const res = await fetch('./info/site.json', { cache: 'no-store' });
    const data = await res.json();
    if (data.journal) {
      if (data.journal.lead) articles.push(data.journal.lead);
      if (data.journal.items) articles = articles.concat(data.journal.items);
    }

    buildIndex(articles, currentSlug);

    // 如果没有指定文章，默认加载第一篇
    if (!currentSlug && articles.length > 0) {
      currentSlug = articles[0].slug || articles[0].id || articles[0].no;
      history.replaceState(null, '', `?slug=${encodeURIComponent(currentSlug)}`);
    }
    
    if (currentSlug) {
      loadArticle(currentSlug);
    } else {
      container.innerHTML = '<div style="text-align:center; padding: 50px;">暂无文章</div>';
    }

  } catch (err) {
    console.error(err);
    container.innerHTML = '<div style="color:red;">加载目录失败</div>';
  }

  // 2. 生成毛玻璃目录
  function buildIndex(arts, activeSlug) {
    const groups = {};
    arts.forEach(art => {
      const tag = (art.tags && art.tags.length > 0) ? art.tags[0] : '未分类';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(art);
    });

    for (const tag in groups) {
      const g = document.createElement('div');
      g.className = 'nav-group';
      g.innerHTML = `<div class="nav-group-title">${tag}</div>`;
      
      groups[tag].forEach(art => {
        const slug = art.slug || art.id || art.no;
        const a = document.createElement('a');
        a.className = `nav-item ${slug === activeSlug ? 'active' : ''}`;
        a.textContent = art.title;
        
        a.addEventListener('click', (e) => {
          e.preventDefault();
          overlay.classList.remove('show');
          switchArticle(slug);
        });
        g.appendChild(a);
      });
      navList.appendChild(g);
    }
  }

  // 3. 无刷新切换文章
  function switchArticle(slug) {
    currentSlug = slug;
    history.pushState(null, '', `?slug=${encodeURIComponent(slug)}`);
    loadArticle(slug);

    // 更新目录高亮
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeItem = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent === articles.find(a => (a.slug || a.id || a.no) === slug)?.title);
    if (activeItem) activeItem.classList.add('active');
  }

  // 4. 加载内容
  async function loadArticle(slug) {
    container.innerHTML = '<div style="color:var(--red);">正在拉取墨迹...</div>';
    blogLayout.scrollTo({ top: 0, behavior: 'instant' });
    
    const art = articles.find(a => (a.slug || a.id || a.no) === slug);
    currentTitleEl.textContent = art ? art.title : '阅读';
    document.title = art ? `${art.title} · 日志` : '日志';

    try {
      const res = await fetch(`./article/blog/${slug}.md`);
      if (!res.ok) throw new Error('NOT_FOUND');
      const text = await res.text();
      
      container.innerHTML = (typeof renderMarkdownToHTML === 'function') 
        ? renderMarkdownToHTML(text) 
        : marked.parse(text);
        
      container.querySelectorAll('pre code').forEach(el => {
        if (/\blanguage-[\w+#.-]+\b/.test(el.className)) hljs.highlightElement(el);
      });
    } catch (err) {
      container.innerHTML = `<h2 style="color:var(--red);">找不到这篇文章</h2><p>${slug}.md 可能已被删除。</p>`;
    }
  }

  // 支持浏览器前进后退
  window.addEventListener('popstate', () => {
    const s = new URLSearchParams(location.search).get('slug');
    if (s && s !== currentSlug) {
      currentSlug = s;
      loadArticle(s);
    }
  });
});