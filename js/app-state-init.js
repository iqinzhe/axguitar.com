// app-state-init.js - v2.0 (JF 命名空间)
// 页面状态恢复模块（在 APP 加载前设置恢复状态）

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    try {
        // 从 sessionStorage 读取当前页面状态
        let savedPage = sessionStorage.getItem('jf_current_page');
        let savedFilter = sessionStorage.getItem('jf_current_filter') || "all";
        let savedOrderId = sessionStorage.getItem('jf_current_order_id');
        let savedCustomerId = sessionStorage.getItem('jf_current_customer_id');

        // 如果 sessionStorage 没有，从 localStorage 恢复（备份）
        if (!savedPage) {
            savedPage = localStorage.getItem('jf_last_page');
            savedFilter = localStorage.getItem('jf_last_filter') || "all";
            savedOrderId = localStorage.getItem('jf_last_order_id');
            savedCustomerId = localStorage.getItem('jf_last_customer_id');
        }

        // 验证页面是否有效（防止恢复到无效页面）
        const validPages = [
            'dashboard', 'orderTable', 'createOrder', 'viewOrder', 'payment',
            'anomaly', 'userManagement', 'storeManagement', 'expenses',
            'customers', 'paymentHistory', 'backupRestore', 'customerOrders',
            'customerPaymentHistory', 'blacklist'
        ];

        // 只有当页面有效且不是登录页时，才设置恢复状态
        if (savedPage && validPages.includes(savedPage) && savedPage !== 'login') {
            window._RESTORED_STATE = {
                page: savedPage,
                filter: savedFilter,
                orderId: savedOrderId || null,
                customerId: savedCustomerId || null
            };
            console.log('[StateInit] 页面恢复状态已设置:', savedPage);
        } else {
            console.log('[StateInit] 无有效恢复状态，将显示仪表盘');
        }
    } catch (e) {
        console.warn('[StateInit] 读取恢复状态失败:', e);
    }

    // 标记初始化完成
    JF.StateInit = { initialized: true };
})();
