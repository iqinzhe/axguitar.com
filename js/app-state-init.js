// app-state-init.js - v2.1 (JF 命名空间)
// 页面状态恢复模块（在 APP 加载前设置恢复状态）
// 修复：认证失败时不恢复页面状态

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    try {
        // 【修复】先检查是否有有效的认证 session
        // 如果 localStorage 中有 supabase auth token，说明可能已登录
        let hasAuthToken = false;
        try {
            // 检查 localStorage 中是否有 supabase 认证 token
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.includes('auth-token')) {
                    try {
                        const tokenData = JSON.parse(localStorage.getItem(key));
                        // 检查 token 是否过期
                        if (tokenData && tokenData.expires_at) {
                            const expiresAt = new Date(tokenData.expires_at * 1000);
                            if (expiresAt > new Date()) {
                                hasAuthToken = true;
                            } else {
                                console.log('[StateInit] Token 已过期，清除旧状态');
                                // Token 过期，清除恢复状态
                                sessionStorage.removeItem('jf_current_page');
                                sessionStorage.removeItem('jf_current_filter');
                                sessionStorage.removeItem('jf_current_order_id');
                                sessionStorage.removeItem('jf_current_customer_id');
                                localStorage.removeItem('jf_last_page');
                                localStorage.removeItem('jf_last_filter');
                                localStorage.removeItem('jf_last_order_id');
                                localStorage.removeItem('jf_last_customer_id');
                            }
                        }
                    } catch (e) {
                        // token 数据解析失败，可能已损坏
                        console.warn('[StateInit] Token 数据损坏，清除旧状态');
                        sessionStorage.removeItem('jf_current_page');
                        localStorage.removeItem('jf_last_page');
                    }
                    break;
                }
            }
        } catch (e) {
            console.warn('[StateInit] 检查认证 token 失败:', e.message);
        }

        // 【修复】如果没有有效的认证 token，清除所有恢复状态
        if (!hasAuthToken) {
            console.log('[StateInit] 无有效认证 token，清除恢复状态');
            try {
                sessionStorage.removeItem('jf_current_page');
                sessionStorage.removeItem('jf_current_filter');
                sessionStorage.removeItem('jf_current_order_id');
                sessionStorage.removeItem('jf_current_customer_id');
            } catch (e) {
                console.warn('[StateInit] 清除 sessionStorage 失败:', e.message);
            }
            
            // 标记初始化完成（无恢复状态）
            JF.StateInit = { initialized: true, restored: false };
            return;
        }

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
            'customerPaymentHistory', 'blacklist', 'messageCenter'
        ];

        // 【修复】增加登录页判断，登录页不算有效恢复页面
        if (savedPage === 'login') {
            console.log('[StateInit] 上次页面是登录页，清除恢复状态');
            savedPage = null;
            savedOrderId = null;
            savedCustomerId = null;
            
            try {
                sessionStorage.removeItem('jf_current_page');
                localStorage.removeItem('jf_last_page');
            } catch (e) {
                console.warn('[StateInit] 清除登录页状态失败:', e.message);
            }
        }

        // 只有当页面有效时，才设置恢复状态
        if (savedPage && validPages.includes(savedPage)) {
            window._RESTORED_STATE = {
                page: savedPage,
                filter: savedFilter,
                orderId: savedOrderId || null,
                customerId: savedCustomerId || null
            };
            console.log('[StateInit] 页面恢复状态已设置:', savedPage, 
                savedOrderId ? '(订单: ' + savedOrderId + ')' : '',
                savedCustomerId ? '(客户: ' + savedCustomerId + ')' : '');
        } else if (savedPage) {
            // 无效的页面，清除
            console.warn('[StateInit] 无效的恢复页面:', savedPage, '，清除状态');
            try {
                sessionStorage.removeItem('jf_current_page');
                sessionStorage.removeItem('jf_current_filter');
                sessionStorage.removeItem('jf_current_order_id');
                sessionStorage.removeItem('jf_current_customer_id');
                localStorage.removeItem('jf_last_page');
                localStorage.removeItem('jf_last_filter');
                localStorage.removeItem('jf_last_order_id');
                localStorage.removeItem('jf_last_customer_id');
            } catch (e) {
                console.warn('[StateInit] 清除无效状态失败:', e.message);
            }
        } else {
            console.log('[StateInit] 无有效恢复状态，将显示仪表盘');
        }
    } catch (e) {
        console.warn('[StateInit] 读取恢复状态失败:', e);
        
        // 【修复】发生异常时清除所有状态
        try {
            sessionStorage.removeItem('jf_current_page');
            sessionStorage.removeItem('jf_current_filter');
            sessionStorage.removeItem('jf_current_order_id');
            sessionStorage.removeItem('jf_current_customer_id');
        } catch (clearError) {
            console.warn('[StateInit] 异常清除失败:', clearError.message);
        }
    }

    // 标记初始化完成
    JF.StateInit = { initialized: true };
    
    console.log('[StateInit] 状态初始化完成');
})();
