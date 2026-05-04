// app-state-init.js - v2.2 轻量初始化清理
// 仅在页面加载时清理过期的 session/local storage 恢复状态

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    try {
        // 检查 localStorage 中是否有有效的 supabase 认证 token
        let hasValidToken = false;
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.includes('auth-token')) {
                try {
                    const tokenData = JSON.parse(localStorage.getItem(key));
                    if (tokenData && tokenData.expires_at) {
                        const expiresAt = new Date(tokenData.expires_at * 1000);
                        if (expiresAt > new Date()) {
                            hasValidToken = true;
                        }
                    }
                } catch (e) {
                    // 数据损坏，忽略
                }
                break;
            }
        }

        // 如果没有有效 token，清除所有页面恢复状态（避免误恢复）
        if (!hasValidToken) {
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
                console.warn('[StateInit] 清除恢复状态失败:', e.message);
            }
        }
    } catch (e) {
        // 异常时静默处理
    }

    // 标记初始化完成（仅用于调试，不设置任何恢复状态）
    JF.StateInit = { initialized: true };
    console.log('[StateInit] 状态初始化清理完成');
})();
