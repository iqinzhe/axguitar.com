/**
 * AX Guitar 网站核心功能：菜单、分享、返回顶部、当前菜单高亮
 *
 * 精简说明：
 * - 删除了用内联样式改 body.paddingTop 的逻辑（会覆盖 CSS 里的顶栏高度 + 刘海安全区）
 * - 删除了 handleViewportChange（每次滚动都写 transform，效果为零，顶栏贴顶由 CSS 的 position:fixed 保证）
 * - 删除了 UA 嗅探 + touchstart、JS 控制 hover 透明度、空的 rAF/resize 回调
 *   （hover / 按下反馈已改由 main.css 的 :hover / :active 实现）
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  setupShare();
  setupBackToTop();
  setActiveMenu();
});

// ===== 汉堡菜单 =====
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('menu');
  if (!hamburger || !menu) return;

  const isOpen = () => menu.classList.contains('show');
  const setOpen = (open) => {
    menu.classList.toggle('show', open);
    hamburger.setAttribute('aria-expanded', String(open));
  };

  hamburger.setAttribute('aria-controls', 'menu');
  hamburger.setAttribute('aria-expanded', 'false');

  // 菜单是 position:absolute 悬浮在内容上方，不需要再推开页面内容
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!isOpen());
  });

  // 点击菜单和按钮以外的地方关闭
  document.addEventListener('click', (e) => {
    if (isOpen() && !menu.contains(e.target) && !hamburger.contains(e.target)) setOpen(false);
  });

  // 页面滚动时收起
  window.addEventListener('scroll', () => { if (isOpen()) setOpen(false); }, { passive: true });

  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) setOpen(false);
  });
}

// ===== 分享 =====
// 原版 navigator.share() 返回 Promise，try/catch 接不到它的失败（比如用户点了取消）。
// 微信等内置浏览器不支持 navigator.share，这里降级为复制链接。
function setupShare() {
  const shareBtn = document.getElementById('shareBtn');
  if (!shareBtn) return;

  shareBtn.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url: location.href });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(location.href);
        alert('链接已复制，可以粘贴给好友了');
        return;
      }
      throw new Error('unsupported');
    } catch (e) {
      if (e && e.name === 'AbortError') return; // 用户主动取消，不提示
      window.prompt('请手动复制链接分享：', location.href);
    }
  });
}

// ===== 返回顶部 =====
function setupBackToTop() {
  const footer = document.getElementById('footerToTop');
  if (!footer) return;

  footer.addEventListener('click', () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
}

// ===== 当前页面菜单高亮 =====
// 原版只比较文件名，所以在 products.html 上「特色」和「产品」会同时高亮。
// 现在：带参数的链接（如 ?series=d）要参数也一致才高亮；
// 只有当没有任何带参数的链接命中时，才让不带参数的同页链接高亮。
function setActiveMenu() {
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  const links = Array.from(document.querySelectorAll('.menu__link'));

  const info = links.map((link) => {
    const url = new URL(link.getAttribute('href'), location.href);
    return {
      link,
      samePage: url.pathname.split('/').pop() === currentPage,
      hasQuery: url.search !== '',
      exact: url.search !== '' && url.search === location.search,
    };
  });

  const hasExact = info.some((i) => i.samePage && i.exact);

  info.forEach(({ link, samePage, hasQuery, exact }) => {
    const active = samePage && (hasExact ? exact : !hasQuery);
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
