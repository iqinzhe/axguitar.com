// app-state-init.js - v2.3 修复版
// 在页面加载时检查 token 有效性，无有效 token 则清除所有页面恢复状态，防止未登录时错误恢复页面

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    try {
        // 检查 localStorage 中是否有有效的 supabase 认证 token
        let hasValidToken = false;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Supabase v2 的 token key 格式为 sb-<project>-auth-token
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                try {
                    const tokenData = JSON.parse(localStorage.getItem(key));
                    // tokenData 结构：{ access_token, expires_at (unix秒), ... }
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

        // 如果没有有效 token，清除所有页面恢复状态（避免未登录时错误恢复）
        if (!hasValidToken) {
            try {
                // 【v2.3】清除新版本 key（JSON 对象格式）
                sessionStorage.removeItem('jf_current_state');
                localStorage.removeItem('jf_last_state');

                // 兼容旧版本 key（分散的字符串格式），防止残留数据干扰
                sessionStorage.removeItem('jf_current_page');
                sessionStorage.removeItem('jf_current_filter');
                sessionStorage.removeItem('jf_current_order_id');
                sessionStorage.removeItem('jf_current_customer_id');
                localStorage.removeItem('jf_last_page');
                localStorage.removeItem('jf_last_filter');
                localStorage.removeItem('jf_last_order_id');
                localStorage.removeItem('jf_last_customer_id');

                console.log('[StateInit] 无有效 token，已清除所有页面恢复状态');
            } catch (e) {
                console.warn('[StateInit] 清除恢复状态失败:', e.message);
            }
        } else {
            console.log('[StateInit] 检测到有效 token，保留页面恢复状态');
        }
    } catch (e) {
        // 异常时静默处理，不影响正常启动
    }

    JF.StateInit = { initialized: true };
    console.log('[StateInit] v2.3 状态初始化清理完成');
})();
