// js/main.js

/* ============================================================
   全局生命周期控制器
   ============================================================ */
// 用于统一销毁旧页面的所有事件监听（解决滚动、鼠标移动导致的卡顿）
window.pageAbortController = new AbortController();
// 用于统一销毁旧页面的动画帧（解决视差动画、进度条导致的卡顿）
window.pageRafId = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1. 初始化 Swup
  const swup = new Swup({
    plugins: [new SwupPersistPlugin()],
    animationSelector: '.transition-slide' // 确保你的内容区包裹层有这个类名
  });

  // 2. 钩子：页面即将离开，强制清理幽灵代码！
  swup.hooks.on('page:load', () => {
    // 销毁旧页面的所有 window / DOM 监听器
    window.pageAbortController.abort();
    window.pageAbortController = new AbortController();

    // 停止旧页面的所有 requestAnimationFrame
    if (window.pageRafId) {
      cancelAnimationFrame(window.pageRafId);
      window.pageRafId = null;
    }
  });

  // 3. 钩子：新页面渲染完毕，挂载新逻辑
  swup.hooks.on('page:view', () => {
    initCurrentPage();
  });

  // 4. 首次直接访问页面时执行
  initCurrentPage();
});

/* ============================================================
   页面分发器：根据当前 URL 决定执行哪个页面的 JS
   ============================================================ */
function initCurrentPage() {
  const path = window.location.pathname;
  const hash = window.location.hash.replace('#', '');
  const signal = window.pageAbortController.signal;

  // 同步左侧导航的高亮状态
  updateSidebar(path, hash);

  // 根据路径调用对应页面的全局初始化函数（必须传入 signal）
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
    // 默认认为是 index.html 或者 /
    if (typeof window.initIndexPage === 'function') {
      window.initIndexPage(hash, signal);
    }
  }
}

/* ============================================================
   辅助：手动同步左侧导航高亮（因为侧边栏被永久锁死了）
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