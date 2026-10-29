// js/main.js

/* ============================================================
   全局生命周期控制器
   ============================================================ */
window.pageAbortController = new AbortController();
window.pageRafId = null;

document.addEventListener('DOMContentLoaded', () => {
  // 0. CDN 未就绪时退化为普通多页应用
  if (typeof Swup === 'undefined') {
    console.warn('[main] Swup 未加载，退化为整页跳转模式');
    initCurrentPage();
    return;
  }

  // 1. 初始化 Swup
  const swup = new Swup({
    containers: ['#swup'],
    animationSelector: '.transition-slide'
  });
  window.__swup = swup;

  // 2. 智能判断：根据是否跨 Panel 自动选择动画
  swup.hooks.on('visit:start', (visit) => {
    const getPanel = (u) => {
      const path = u.pathname;
      const hash = u.hash.replace('#', '');

      // 核心：如果是 index.html 且没有 hash，去读之前记录的面板状态
      const isIndex = path.endsWith('index.html') || path === '/' || path === '';
      if (isIndex && !hash) {
        if (window.currentIndexPanel && window.currentIndexPanel !== 'hero') {
          return window.currentIndexPanel;
        }
        return 'home';
      }

      if (path.includes('about') || hash.includes('archive')) return 'archive';
      if (path.includes('project') || hash.includes('works') || hash.includes('project')) return 'works';
      if (path.includes('blog') || hash.includes('journal')) return 'journal';
      if (hash.includes('contact')) return 'contact';
      return 'home';
    };

    const fromPanel = getPanel(new URL(visit.from.url, window.location.origin));
    const toPanel = getPanel(new URL(visit.to.url, window.location.origin));

    console.log(`[Swup 跳转] ${fromPanel} -> ${toPanel}`);

    if (fromPanel === toPanel) {
      console.log('✅ 触发同 Panel 淡入淡出');
      document.documentElement.classList.add('do-fade');
      document.documentElement.classList.remove('do-slide');
    } else {
      console.log('❌ 触发跨 Panel 滑出');
      document.documentElement.classList.add('do-slide');
      document.documentElement.classList.remove('do-fade');
    }
  });

  // 动画结束后清理类名
  swup.hooks.on('visit:end', () => {
    document.documentElement.classList.remove('do-fade', 'do-slide');
  });

  // 3. 钩子：页面即将离开，强制清理幽灵代码
  swup.hooks.on('page:load', () => {
    window.pageAbortController.abort();
    window.pageAbortController = new AbortController();

    if (window.pageRafId) {
      cancelAnimationFrame(window.pageRafId);
      window.pageRafId = null;
    }
  });

  // 4. 钩子：新页面渲染完毕，挂载新逻辑
  swup.hooks.on('page:view', () => {
    initCurrentPage();
  });

  // 5. popstate 兜底
  window.addEventListener('popstate', () => {
    const st = window.history.state || {};
    if (st.source === 'swup') return;

    const rendered = swup.location.url;
    const now = window.location.pathname + window.location.search;
    if (rendered === now) return;

    if (st.source === 'blog-page' && rendered.includes('blog.html')) return;
    if (st.source === 'project-page' && rendered.includes('project.html')) return;
    if (st.source === 'about-page' && rendered.includes('about.html')) return;

    swup.navigate(window.location.href, { history: 'replace' });
  });

  // 6. 首次直接访问页面时执行
  initCurrentPage();
});

/* ============================================================
   页面分发器：根据当前 URL 决定执行哪个页面的 JS
   ============================================================ */
function initCurrentPage() {
  const path = window.location.pathname;
  const hash = window.location.hash.replace('#', '');
  const signal = window.pageAbortController.signal;

  // 👈 初始化当前状态（离开首页时清空）
  if (path.endsWith('index.html') || path === '/' || path === '') {
    window.currentIndexPanel = hash || 'hero';
  } else {
    window.currentIndexPanel = null;
  }

  updateSidebar(path, hash);

  if (path.includes('blog.html')) {
    if (typeof window.initBlogPage === 'function') window.initBlogPage(signal);
  }
  else if (path.includes('about.html')) {
    if (typeof window.initAboutPage === 'function') window.initAboutPage(signal);
  }
  else if (path.includes('project.html')) {
    if (typeof window.initProjectPage === 'function') window.initProjectPage(signal);
  }
  else {
    if (typeof window.initIndexPage === 'function') {
      window.initIndexPage(hash, signal);
    }
  }
}

/* ============================================================
   辅助：手动同步左侧导航高亮
   ============================================================ */
function updateSidebar(path, hash) {
  const links = document.querySelectorAll('.sidebar-nav a');
  links.forEach(a => a.classList.remove('active'));

  let target = '首页';
  if (path.includes('about.html')) target = '档案';
  else if (path.includes('project.html')) target = '工程';
  else if (path.includes('blog.html')) target = '日志';
  else if (hash === 'archive') target = '档案';
  else if (hash === 'works') target = '工程';
  else if (hash === 'journal') target = '日志';
  else if (hash === 'contact') target = '通讯';

  links.forEach(a => {
    if (a.textContent.trim() === target) {
      a.classList.add('active');
    }
  });
}