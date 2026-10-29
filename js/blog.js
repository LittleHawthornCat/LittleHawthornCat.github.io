// js/blog.js

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('article-container');
  const navList = document.getElementById('blogNavList');
  
  // 获取 URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  const currentSlug = urlParams.get('slug') || urlParams.get('id');

  // 1. 加载索引数据
  try {
    const res = await fetch('./info/site.json', { cache: 'no-store' });
    const data = await res.json();
    
    // 合并 journal.lead 和 journal.items
    let articles = [];
    if (data.journal) {
      if (data.journal.lead) articles.push(data.journal.lead);
      if (data.journal.items) articles = articles.concat(data.journal.items);
    }

    renderSidebar(articles, currentSlug);
    
    // 如果没有传 slug，默认加载第一篇文章
    if (!currentSlug && articles.length > 0) {
      const firstSlug = articles[0].slug || articles[0].id || articles[0].no;
      // 不刷新页面，直接替换 URL 并加载
      history.replaceState(null, '', `?slug=${encodeURIComponent(firstSlug)}`);
      loadArticle(firstSlug);
    } else if (currentSlug) {
      loadArticle(currentSlug);
    } else {
      container.innerHTML = '<div class="loading-text" style="color:var(--red)">暂无文章。请在 site.json 中添加 journal 数据。</div>';
    }

  } catch (err) {
    console.error(err);
    navList.innerHTML = '<div style="color:red; padding:20px;">无法加载 site.json 数据</div>';
    container.innerHTML = '<div style="color:red; padding:20px;">目录加载失败，请确保通过 HTTP 服务器访问。</div>';
  }
});

/**
 * 按第一标签分类渲染左侧导航
 */
function renderSidebar(articles, currentSlug) {
  const navList = document.getElementById('blogNavList');
  navList.innerHTML = '';

  // 根据 tags[0] 分组
  const groups = {};
  articles.forEach(art => {
    // 取第一个标签，如果没有则归为“未分类”
    const tag = (art.tags && art.tags.length > 0) ? art.tags[0] : '未分类';
    if (!groups[tag]) groups[tag] = [];
    groups[tag].push(art);
  });

  // 遍历组渲染 DOM
  for (const tag in groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'nav-group';
    groupEl.innerHTML = `<div class="nav-group-title">${tag}</div>`;

    groups[tag].forEach(art => {
      const slug = art.slug || art.id || art.no;
      const title = art.title;
      const isActive = slug === currentSlug ? 'active' : '';
      
      const a = document.createElement('a');
      a.className = `nav-item ${isActive}`;
      a.href = `?slug=${encodeURIComponent(slug)}`;
      a.textContent = title;
      
      // 绑定点击事件（无刷新切换）
      a.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 更新左侧高亮状态
        navList.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        a.classList.add('active');

        // 更新地址栏
        history.pushState(null, '', `?slug=${encodeURIComponent(slug)}`);
        document.title = `${title} - 博客`;
        
        // 加载文章
        loadArticle(slug);
      });

      groupEl.appendChild(a);
    });
    navList.appendChild(groupEl);
  }
}

/**
 * 加载并渲染 Markdown
 */
async function loadArticle(slug) {
  const container = document.getElementById('article-container');
  container.innerHTML = '<div class="loading-text">正在加载文章...</div>';
  
  const filePath = `./article/blog/${slug}.md`;

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error('NOT_FOUND');
    
    const text = await response.text();
    
    // 调用 show_markdown.js 的渲染方法
    if (typeof renderMarkdownToHTML === 'function') {
      container.innerHTML = renderMarkdownToHTML(text);
      
      // 高亮代码
      container.querySelectorAll('pre code').forEach(el => {
        if (/\blanguage-[\w+#.-]+\b/.test(el.className)) hljs.highlightElement(el);
      });
      
      // 调整 iframe 高度
      container.querySelectorAll('.html-frame iframe').forEach(iframe => {
        iframe.onload = function() {
          try {
            const height = this.contentWindow.document.body.scrollHeight;
            this.style.height = (height + 20) + 'px';
          } catch (e) {}
        }
      });
    } else {
      container.innerHTML = marked.parse(text);
    }

    // 滚动右侧内容回顶部
    document.querySelector('.blog-main').scrollTo({ top: 0, behavior: 'smooth' });

  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      container.innerHTML = `
        <div style="text-align:center; padding: 60px 20px;">
          <h2 style="color:var(--red); font-family:var(--font-display); font-size: 32px;">找不到文章</h2>
          <p style="color:var(--ink2); margin-top:20px;">文件 <code>article/blog/${slug}.md</code> 不存在。</p>
          <p style="color:var(--ink3); font-size: 13px;">开发者可能删除了这篇文章，或者还没有部署。</p>
        </div>
      `;
    } else {
      container.innerHTML = `<div style="color:red; padding:20px;">加载失败: ${error.message}</div>`;
    }
  }
}