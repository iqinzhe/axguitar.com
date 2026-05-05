// lazy-loader.js - v1.0
// 延迟加载非首屏必需的 JS 模块，提升首屏加载速度
// 在页面完全加载后，按序动态插入 <script> 标签

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 配置：非首屏必需的模块列表 ====================
    // 这些模块只在用户点击导航时才会使用，首屏不需要
    const deferredModules = [
        'js/app-capital.js',
        'js/app-profit.js',
        'js/app-dashboard-anomaly.js',
        'js/app-dashboard-expenses.js',
        'js/app-dashboard-funds.js',
        'js/app-dashboard-orders.js',
        'js/app-dashboard-print.js',
        'js/app-dashboard-users.js',
        'js/app-dashboard-wa.js',
        'js/app-message-center.js',
        'js/app-customers.js',
        'js/app-blacklist.js',
        'js/app-payments.js'
    ];

    // ==================== 状态 ====================
    let loadedCount = 0;
    let totalCount = deferredModules.length;
    let _started = false;

    // ==================== 加载单个脚本 ====================
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = () => {
                loadedCount++;
                console.log(`[LazyLoader] ✅ Loaded (${loadedCount}/${totalCount}): ${src}`);
                resolve();
            };
            script.onerror = () => {
                loadedCount++;
                console.warn(`[LazyLoader] ❌ Failed (${loadedCount}/${totalCount}): ${src}`);
                // 加载失败不阻塞后续模块
                resolve();
            };
            document.body.appendChild(script);
        });
    }

    // ==================== 顺序加载所有模块 ====================
    async function loadAllDeferred() {
        if (_started) return;
        _started = true;

        console.log(`[LazyLoader] 开始加载 ${totalCount} 个非核心模块...`);

        // 逐个加载，保证依赖顺序
        for (const src of deferredModules) {
            await loadScript(src);
        }

        console.log('[LazyLoader] ✅ 全部非核心模块加载完成');
        JF.LazyLoader = { loaded: true, loadedCount, totalCount };
    }

    // ==================== 启动时机 ====================
    function start() {
        // 在页面 load 事件后延迟 200ms 开始加载
        // 给浏览器足够时间完成首屏渲染
        setTimeout(loadAllDeferred, 200);
    }

    if (document.readyState === 'complete') {
        start();
    } else {
        window.addEventListener('load', start);
    }
})();
