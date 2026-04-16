// app-dashboard.js - 入口文件
// 此文件只负责将各个模块的功能合并到 window.APP
// 实际功能分布在以下文件中：
// - app-dashboard-core.js    (核心功能)
// - app-dashboard-orders.js  (订单功能)
// - app-dashboard-report.js  (报表功能)
// - app-dashboard-expenses.js (支出功能)
// - app-dashboard-print.js   (打印功能)

// 注意：各个模块已经自动合并到 window.APP
// 此文件只需确保所有模块已加载即可

// 初始化入口（由 core 模块提供）
if (typeof window.APP !== 'undefined' && window.APP && typeof window.APP.init === 'function') {
    // init 已经在 core 模块中定义，无需重复
    console.log('✅ JF! by Gadai - 所有模块加载完成');
} else {
    console.error('❌ 模块加载失败，请检查文件顺序');
}
