/**
 * AX Guitar 网站核心功能
 * 功能包含：菜单控制、搜索、分享、返回顶部
 * 优化版：添加了点击外部关闭菜单、滚动关闭菜单和ESC键关闭菜单功能
 * 新增：防止菜单与内容重叠的动态padding调整
 * 新增：当前页面菜单项激活状态
 * 新增：顶部栏防缝隙功能（解决移动端顶部栏与屏幕之间的缝隙问题）
 */

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  initMobileMenu();
  setupShare();
  setupBackToTop();
  setActiveMenu();
  setupHoverEffects();
  handleViewportChange(); // 新增：处理移动浏览器视口变化
});

// 移动菜单控制 - 修复汉堡菜单功能
function initMobileMenu() {
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('menu');
  const menuHeight = 50; // 菜单展开后的近似高度
  
  if (hamburger && menu) {
    // 点击汉堡菜单切换显示
    hamburger.addEventListener('click', function(e) {
      e.stopPropagation(); // 防止事件冒泡到document
      const isOpening = !menu.classList.contains('show');
      menu.classList.toggle('show');
      
      // 动态调整body的padding-top防止重叠
      if (isOpening) {
        document.body.style.paddingTop = `calc(var(--top-bar-height) + ${menuHeight}px)`;
      } else {
        document.body.style.paddingTop = 'var(--top-bar-height)';
      }
      
      console.debug('菜单状态:', menu.classList.contains('show'));
    });

    // 点击页面其他地方时，自动关闭菜单
    document.addEventListener('click', function(e) {
      if (menu.classList.contains('show') && 
          !menu.contains(e.target) && 
          !hamburger.contains(e.target)) {
        menu.classList.remove('show');
        // 关闭菜单时恢复原始padding
        document.body.style.paddingTop = 'var(--top-bar-height)';
        console.debug('点击外部，菜单已关闭');
      }
    });

    // 页面滚动时，自动收起菜单（防止遮挡内容）
    window.addEventListener('scroll', function() {
      if (menu.classList.contains('show')) {
        menu.classList.remove('show');
        // 滚动关闭菜单时恢复原始padding
        document.body.style.paddingTop = 'var(--top-bar-height)';
        console.debug('页面滚动，菜单已关闭');
      }
    });

    // 点击 ESC 键关闭菜单
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menu.classList.contains('show')) {
        menu.classList.remove('show');
        // ESC关闭菜单时恢复原始padding
        document.body.style.paddingTop = 'var(--top-bar-height)';
        console.debug('ESC键按下，菜单已关闭');
      }
    });
  }
}

// 分享功能 - 修复分享按钮功能
function setupShare() {
  const shareBtn = document.getElementById('shareBtn');
  
  shareBtn?.addEventListener('click', function() {
    try {
      if (navigator.share) {
        navigator.share({
          title: document.title,
          url: location.href
        });
      } else {
        alert('请手动复制链接分享: ' + location.href);
      }
    } catch (e) {
      console.error('分享失败:', e);
      alert('分享功能出错，请重试');
    }
  });
}

// 返回顶部
function setupBackToTop() {
  const footer = document.getElementById('footerToTop');
  
  footer?.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}

// 设置当前激活的导航菜单项
function setActiveMenu() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const menuLinks = document.querySelectorAll('.menu__link');
  
  menuLinks.forEach(link => {
    // 获取链接的文件名（去除参数）
    const linkHref = link.getAttribute('href');
    const linkPage = linkHref.split('?')[0];
    
    // 普通页面匹配
    if (linkPage === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  console.debug('当前页面:', currentPage, '已设置激活菜单项');
}

// 添加图标悬停效果
function setupHoverEffects() {
  const shareBtn = document.getElementById('shareBtn');
  const menuBtn = document.getElementById('hamburger');
  
  // 分享按钮悬停效果
  shareBtn?.addEventListener('mouseenter', function() {
    this.style.opacity = '0.8';
  });
  
  shareBtn?.addEventListener('mouseleave', function() {
    this.style.opacity = '1';
  });
  
  // 菜单按钮悬停效果
  menuBtn?.addEventListener('mouseenter', function() {
    this.style.opacity = '0.8';
  });
  
  menuBtn?.addEventListener('mouseleave', function() {
    this.style.opacity = '1';
  });
}

// ===== 新增功能：顶部栏防缝隙功能 =====
// 处理移动浏览器视口变化 - 防止顶部栏与屏幕之间出现缝隙
function handleViewportChange() {
  const topBar = document.querySelector('.top-bar');
  if (!topBar) return;
  
  // 添加固定类确保顶部栏始终在顶部
  topBar.classList.add('top-bar--pinned');
  
  // 监听滚动事件，确保顶部栏位置正确
  let lastScrollTop = 0;
  window.addEventListener('scroll', function() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // 确保顶部栏始终紧贴屏幕顶部
    if (scrollTop > lastScrollTop && scrollTop > 50) {
      // 向下滚动
      topBar.style.transform = 'translateY(0)';
    } else {
      // 向上滚动
      topBar.style.transform = 'translateY(0)';
    }
    
    lastScrollTop = scrollTop;
  }, false);
  
  // 监听窗口大小变化（处理移动设备旋转等情况）
  window.addEventListener('resize', function() {
    // 确保顶部栏在窗口大小变化后仍然正确显示
    topBar.style.transform = 'translateY(0)';
  });
  
  console.debug('顶部栏防缝隙功能已启用');
}

// ===== 新增功能：移动设备优化 =====
// 检测是否移动设备
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 移动设备特殊处理
if (isMobileDevice()) {
  // 添加触摸反馈效果
  document.addEventListener('DOMContentLoaded', function() {
    const touchElements = document.querySelectorAll('.menu__link, .compact-nav__item, .btn');
    
    touchElements.forEach(el => {
      el.addEventListener('touchstart', function() {
        this.style.opacity = '0.7';
      });
      
      el.addEventListener('touchend', function() {
        this.style.opacity = '1';
      });
    });
  });
}

// ===== 新增功能：性能优化 =====
// 使用requestAnimationFrame优化滚动性能
let ticking = false;
window.addEventListener('scroll', function() {
  if (!ticking) {
    window.requestAnimationFrame(function() {
      // 这里可以添加需要在滚动时执行的性能敏感操作
      ticking = false;
    });
    ticking = true;
  }
});

// 防抖函数优化 resize 事件
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// 监听防抖后的resize事件
window.addEventListener('resize', debounce(function() {
  console.debug('窗口大小改变，重新计算布局');
  // 这里可以添加需要在窗口大小改变时执行的操作
}, 250));