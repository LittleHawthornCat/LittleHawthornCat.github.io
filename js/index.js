/* ============================================================
   唯一数据源：site.json
   ============================================================ */

const DATA_URL = "info/site.json";

/* ---------- 1. 读取数据 ---------- */
async function loadSiteData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`无法加载 ${DATA_URL}（HTTP ${res.status}）`);
  try {
    return await res.json();
  } catch {
    throw new Error(`${DATA_URL} 不是合法的 JSON`);
  }
}

/* ---------- 2. 渲染工具 ---------- */
function setText(el, value) {
  if (el) el.textContent = value == null ? "" : value;
}

function setField(panel, field, value) {
  setText(panel.querySelector(`[data-field="${field}"]`), value);
}

/* 生成文章页链接：about.html / project.html / blog.html
   参数优先取 slug / id / no，否则用 fallback（序号） */
function articleUrl(page, item, fallback) {
  const slug =
    item && (item.slug || item.id || item.no);
  const value = slug || fallback;
  return `${page}?id=${encodeURIComponent(value)}`;
}

/* ---------- 3. 分区渲染 ---------- */
function renderHero(h) {
  if (!h) return;
  const tags = document.getElementById("heroTags");
  tags.innerHTML = "";
  (h.tags || []).forEach(t => {
    const s = document.createElement("span");
    s.className = "tag" + (t.variant ? " " + t.variant : "");
    s.textContent = t.text;
    tags.appendChild(s);
  });
  setText(document.getElementById("heroTitleCn"), h.titleCn);
  setText(document.getElementById("heroTitleCy"), h.titleCy);
  setText(document.getElementById("heroLede"), h.lede);
  setText(document.getElementById("heroHint"), h.hint);
}

function renderArchive(a) {
  if (!a) return;
  const panel = document.getElementById("archive");
  setField(panel, "label", a.label);
  setField(panel, "title", a.title);
  setField(panel, "subtitle", a.subtitle);

  const stamp = document.getElementById("archiveStamp");
  stamp.innerHTML = "";
  const main = document.createElement("span");
  main.textContent = a.stamp ? a.stamp.main : "";
  const sub = document.createElement("small");
  sub.textContent = a.stamp ? a.stamp.sub : "";
  stamp.append(main, sub);

  const intro = document.getElementById("archiveIntro");
  intro.innerHTML = (a.intro || []).map(p => `<p>${p}</p>`).join("");

  const grid = document.getElementById("archiveGrid");
  grid.innerHTML = "";
  (a.cards || []).forEach((c, i) => {
    // 档案卡片改为链接，跳转到 about.html
    const card = document.createElement("a");
    card.className = "archive-card reveal";
    card.href = articleUrl("about.html", c, String(i + 1));
    card.style.color = "inherit";
    card.style.textDecoration = "none";
    card.style.setProperty("--reveal-delay", (0.1 * (i + 1)).toFixed(1) + "s");
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
  const panel = document.getElementById("works");
  setField(panel, "label", w.label);
  setField(panel, "title", w.title);
  setField(panel, "subtitle", w.subtitle);
  setField(panel, "desc", w.desc);

  const list = document.getElementById("worksList");
  list.innerHTML = "";
  (w.items || []).forEach((it, i) => {
    const a = document.createElement("a");
    a.className = "work reveal";
    // 工程链接统一指向 project.html
    a.href = articleUrl("project.html", it, String(i + 1));
    a.setAttribute("aria-label", it.name);
    a.style.setProperty("--reveal-delay", (0.1 * (i + 1)).toFixed(1) + "s");
    a.innerHTML = `
      <span class="work-no">${it.no}</span>
      <span class="work-name">${it.name}<em>${it.nameEn || ""}</em></span>
      <span class="work-tag">${it.tag || ""}</span>
      <span class="work-year">${it.year || ""}</span>
      <span class="work-status">${it.status || ""}</span>
      <span class="work-arrow" aria-hidden="true">↗</span>`;
    list.appendChild(a);
  });
}

function renderJournal(j) {
  if (!j) return;
  const panel = document.getElementById("journal");
  setField(panel, "label", j.label);
  setField(panel, "title", j.title);
  setField(panel, "subtitle", j.subtitle);
  setField(panel, "desc", j.desc);

  const wrap = document.getElementById("journalList");
  wrap.innerHTML = "";

  if (j.lead) {
    const lead = document.createElement("a");
    lead.className = "log-lead reveal";
    // 日志 lead 链接统一指向 blog.html
    lead.href = articleUrl("blog.html", j.lead, "lead");
    lead.innerHTML = `
      <div class="ll-meta">${(j.lead.meta || []).map(m => `<span>${m}</span>`).join("")}</div>
      <h3>${j.lead.title}</h3>
      <p>${j.lead.excerpt}</p>
      <div>${(j.lead.tags || []).map(t => `<span class="tag-small">${t}</span>`).join("")}</div>`;
    wrap.appendChild(lead);
  }

  (j.items || []).forEach((it, i) => {
    const a = document.createElement("a");
    a.className = "log-item reveal";
    // 日志条目链接统一指向 blog.html
    a.href = articleUrl("blog.html", it, String(i + 1));
    a.style.setProperty("--reveal-delay", (0.1 * (i + 1)).toFixed(1) + "s");
    a.innerHTML = `
      <div class="li-meta"><span class="no">${it.no}</span><span>${it.date}</span></div>
      <div>
        <h4>${it.title}</h4>
        <p>${it.desc}</p>
        ${(it.tags || []).map(t => `<span class="tag-small">${t}</span>`).join("")}
      </div>`;
    wrap.appendChild(a);
  });
}

function renderContact(c) {
  if (!c) return;
  setText(document.getElementById("contactLabel"), c.label);
  setText(document.getElementById("contactTitle"), c.title);
  setText(document.getElementById("contactDesc"), c.desc);

  const email = document.getElementById("contactEmail");
  email.textContent = c.email || "";
  email.href = "mailto:" + (c.email || "");

  const links = document.getElementById("contactLinks");
  links.innerHTML = "";
  (c.links || []).forEach(l => {
    const a = document.createElement("a");
    a.href = l.href || "#";
    a.innerHTML = `<span>${l.label}</span><span>${l.value}</span>`;
    links.appendChild(a);
  });
}

function renderFooter(f) {
  if (!f) return;
  document.getElementById("footerBar").innerHTML = `
    <span>${f.left || ""}</span>
    <span>${f.center || ""}</span>
    <span class="red">${f.highlight || ""}</span>`;
}

function renderSite(d) {
  if (d.site) {
    if (d.site.title) document.title = d.site.title;
    if (d.site.lang) document.documentElement.lang = d.site.lang;
  }
  setText(document.getElementById("sidebarBrand"), d.brand);

  const nav = document.getElementById("sidebarNav");
  nav.innerHTML = "";
  (d.nav || []).forEach(item => {
    const a = document.createElement("a");
    a.href = "#" + item.target;
    a.dataset.target = item.target;
    a.textContent = item.label;
    if (item.target === "hero") a.classList.add("active");
    nav.appendChild(a);
  });

  renderHero(d.hero);
  renderArchive(d.archive);
  renderWorks(d.works);
  renderJournal(d.journal);
  renderContact(d.contact);
  renderFooter(d.footer);
}

/* ---------- 4. 加载失败提示 ---------- */
function showLoadError(err) {
  // 错误页也需要一个语言标记，这是错误处理逻辑，不是业务数据备份
  document.documentElement.lang = "zh-CN";

  const box = document.createElement("div");
  box.className = "load-error";
  box.innerHTML = `
    <div class="load-error__inner">
      <div class="load-error__label">DATA / ERROR</div>
      <h1>数据加载失败</h1>
      <p>${err.message}</p>
      <p>请确认 <code>${DATA_URL}</code> 与 <code>index.html</code> 位于同一目录，且通过 HTTP 服务器访问（<code>file://</code> 下浏览器会阻止 fetch）。</p>
      <p>例如：<code>python3 -m http.server 8000</code> 或 <code>npx serve</code>。</p>
    </div>`;
  document.body.appendChild(box);
  document.body.classList.add("is-ready");
}

/* ---------- 5. 交互逻辑 ---------- */
function initSite() {
  const sidebarNav = document.getElementById("sidebarNav");
  const links = sidebarNav.querySelectorAll("a");
  const basePanel = document.getElementById("hero");
  const progressBar = document.getElementById("progressBar");

  const openStack = [];
  let zTop = 10;
  const observers = new Map();

  document.querySelectorAll(".panel-inner").forEach(inner => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add("in"), 80);
          io.unobserve(entry.target);
        }
      });
    }, { root: inner, threshold: 0.05, rootMargin: "0px 0px 90px 0px" });
    observers.set(inner, io);
  });

  const getPanel = id => document.querySelector(`[data-panel][id="${id}"]`);

  function openPanelEl(id) {
    const el = getPanel(id);
    if (!el) return;
    clearTimeout(el._closeTimer);
    zTop++;
    el.style.zIndex = zTop;
    el.classList.add("is-open");

    const inner = el.querySelector(".panel-inner");
    const io = observers.get(inner);
    const reveals = el.querySelectorAll(".reveal, .stamp-reveal");

    reveals.forEach(item => {
      item.classList.remove("in");
      if (item.classList.contains("stamp-reveal")) {
        setTimeout(() => {
          if (el.classList.contains("is-open")) item.classList.add("in");
        }, 300);
      } else if (io) {
        io.observe(item);
      }
    });
  }

  function closePanelEl(id) {
    const el = getPanel(id);
    if (!el) return;
    el.classList.remove("is-open");

    const inner = el.querySelector(".panel-inner");
    const io = observers.get(inner);
    const reveals = el.querySelectorAll(".reveal, .stamp-reveal");
    reveals.forEach(item => { if (io) io.unobserve(item); });

    clearTimeout(el._closeTimer);
    el._closeTimer = setTimeout(() => {
      reveals.forEach(item => item.classList.remove("in"));
    }, 800);
  }

  function updateNav() {
    const topId = openStack.length ? openStack[openStack.length - 1] : "hero";
    links.forEach(link => {
      const id = link.dataset.target;
      link.classList.toggle("active", id === topId);
      link.classList.toggle("is-open", openStack.includes(id) && id !== topId);
    });
  }

  function toggleSection(id) {
    if (id === "hero") {
      while (openStack.length) closePanelEl(openStack.pop());
      updateNav();
      updateProgress();
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
    requestAnimationFrame(updateProgress);
  }

  sidebarNav.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    e.preventDefault();
    toggleSection(link.dataset.target);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openStack.length) {
      closePanelEl(openStack.pop());
      updateNav();
      updateProgress();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      document.querySelectorAll(".panel--drawer.is-open").forEach(panel => {
        panel.querySelectorAll(".reveal, .stamp-reveal").forEach(item => item.classList.add("in"));
      });
    }
  });

  function currentScroller() {
    if (!openStack.length) return basePanel.querySelector(".panel-inner");
    const el = getPanel(openStack[openStack.length - 1]);
    return el ? el.querySelector(".panel-inner") : null;
  }

  function updateProgress() {
    const scroller = currentScroller();
    if (!scroller) return;
    const max = scroller.scrollHeight - scroller.clientHeight;
    const p = max > 0 ? Math.min(1, scroller.scrollTop / max) : 0;
    progressBar.style.transform = `scaleX(${p})`;
  }

  document.querySelectorAll(".panel-inner").forEach(inner => {
    inner.addEventListener("scroll", updateProgress, { passive: true });
  });

  /* 首屏视差 */
  const hero = document.querySelector(".hero");
  const heroLogo = document.getElementById("heroLogo");

  if (hero && heroLogo) {
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    let isAnimating = false, rafId = null;

    hero.addEventListener("mousemove", (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2 * 20;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2 * 20;
      if (!isAnimating) {
        isAnimating = true;
        rafId = requestAnimationFrame(animateParallax);
      }
    });

    hero.addEventListener("mouseleave", () => {
      targetX = 0; targetY = 0;
      if (!isAnimating) {
        isAnimating = true;
        rafId = requestAnimationFrame(animateParallax);
      }
    });

    function animateParallax() {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      heroLogo.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        rafId = requestAnimationFrame(animateParallax);
      } else {
        currentX = targetX; currentY = targetY;
        heroLogo.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        isAnimating = false;
        cancelAnimationFrame(rafId);
      }
    }
  }

  updateProgress();
}

/* ---------- 6. 启动 ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await loadSiteData();
    renderSite(data);
    document.body.classList.add("is-ready");
    initSite();
  } catch (err) {
    console.error("[site]", err);
    showLoadError(err);
  }
});