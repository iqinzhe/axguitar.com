// app.js - v2.1 最终完整版（修复登录状态检查 + 错误恢复）
// JF 命名空间下的主入口，提供全局 APP 方法与协调功能

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // 主协调对象（挂载到 window.APP 以兼容旧版 onClick 绑定）
    const APP = {
        currentPage: 'login',  // 【修复】初始状态改为 login
        currentFilter: 'all',
        currentOrderId: null,
        currentCustomerId: null,
        historyStack: [],
        _isInitialized: false,  // 【修复】新增初始化标志

        // ==================== 【修复】强制恢复 ====================
        forceRecovery() {
            console.log('[Recovery] 手动强制恢复');
            const appDiv = document.getElementById('app');
            if (!appDiv) return;
            
            // 【修复】显示恢复中的提示
            const lang = Utils.lang || 'zh';
            const loadingText = lang === 'id' ? 'Sedang memulihkan...' : '正在恢复...';
            appDiv.innerHTML = `<div class="card" style="text-align:center;padding:40px;margin:20px;">
                <div class="loader" style="margin:20px auto;"></div>
                <p>${loadingText}</p>
            </div>`;
            
            setTimeout(async () => {
                try {
                    // 【修复】先检查登录状态
                    const isLoggedIn = AUTH && AUTH.isLoggedIn && AUTH.isLoggedIn();
                    
                    if (isLoggedIn) {
                        // 已登录，尝试刷新当前页面
                        if (JF.DashboardCore && typeof JF.DashboardCore.refreshCurrentPage === 'function') {
                            await JF.DashboardCore.refreshCurrentPage();
                        } else if (JF.DashboardCore && typeof JF.DashboardCore.renderDashboard === 'function') {
                            await JF.DashboardCore.renderDashboard();
                        } else {
                            location.reload();
                        }
                    } else {
                        // 未登录，显示登录页
                        if (JF.DashboardCore && typeof JF.DashboardCore.renderLogin === 'function') {
                            JF.DashboardCore.renderLogin();
                        } else {
                            APP.showLogin();
                        }
                    }
                } catch (e) {
                    console.error('[Recovery] 恢复失败:', e);
                    appDiv.innerHTML = `<div class="card" style="text-align:center;padding:40px;">
                        <p style="color:var(--danger);">⚠️ ${lang === 'id' ? 'Pemulihan gagal' : '恢复失败'}</p>
                        <button onclick="location.reload()" class="btn btn--primary" style="margin-top:12px;">🔄 ${lang === 'id' ? 'Muat Ulang' : '刷新页面'}</button>
                        <button onclick="APP.forceClearAndReload()" class="btn btn--warning" style="margin-top:12px;margin-left:8px;">🗑️ ${lang === 'id' ? 'Hapus Cache & Muat Ulang' : '清除缓存并刷新'}</button>
                    </div>`;
                }
            }, 100);
        },

        // ==================== 【修复】新增：强制清除并重新加载 ====================
        forceClearAndReload() {
            console.log('[APP] 强制清除所有存储并重新加载');
            try {
                // 清除所有 Supabase 相关存储
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (
                        key.startsWith('supabase.') ||
                        key.startsWith('sb-') ||
                        key.startsWith('jf_')
                    )) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                // 清除 sessionStorage
                sessionStorage.clear();
                
                // 清除所有 cookies
                document.cookie.split(";").forEach(c => {
                    document.cookie = c.replace(/^ +/, "")
                        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                
                console.log('[APP] 已清除 ' + keysToRemove.length + ' 个存储项');
            } catch (e) {
                console.warn('[APP] 清除存储失败:', e.message);
            }
            
            // 延迟重新加载
            setTimeout(() => {
                location.reload();
            }, 500);
        },

        // ==================== 页面状态持久化（委托给 DashboardCore） ====================
        saveCurrentPageState() {
            // 【修复】增加登录检查
            if (!AUTH || !AUTH.isLoggedIn || !AUTH.isLoggedIn()) {
                return;
            }
            
            // 统一委托给 DashboardCore 处理，避免状态不同步
            if (JF.DashboardCore && typeof JF.DashboardCore.saveCurrentPageState === 'function') {
                JF.DashboardCore.saveCurrentPageState();
            } else {
                // 降级：直接保存到 sessionStorage
                try {
                    if (this.currentPage && this.currentPage !== 'login') {
                        sessionStorage.setItem('jf_current_page', this.currentPage);
                        sessionStorage.setItem('jf_current_filter', this.currentFilter || 'all');
                        if (this.currentOrderId) sessionStorage.setItem('jf_current_order_id', this.currentOrderId);
                        if (this.currentCustomerId) sessionStorage.setItem('jf_current_customer_id', this.currentCustomerId);
                        localStorage.setItem('jf_last_page', this.currentPage);
                        localStorage.setItem('jf_last_filter', this.currentFilter || 'all');
                        if (this.currentOrderId) localStorage.setItem('jf_last_order_id', this.currentOrderId);
                        if (this.currentCustomerId) localStorage.setItem('jf_last_customer_id', this.currentCustomerId);
                    }
                } catch (e) { /* ignore */ }
            }
        },

        restorePageState() {
            // 统一委托给 DashboardCore 处理
            if (JF.DashboardCore && typeof JF.DashboardCore.restorePageState === 'function') {
                return JF.DashboardCore.restorePageState();
            }
            // 降级
            try {
                let page = sessionStorage.getItem('jf_current_page') || localStorage.getItem('jf_last_page');
                let filter = sessionStorage.getItem('jf_current_filter') || localStorage.getItem('jf_last_filter') || "all";
                let orderId = sessionStorage.getItem('jf_current_order_id') || localStorage.getItem('jf_last_order_id');
                let customerId = sessionStorage.getItem('jf_current_customer_id') || localStorage.getItem('jf_last_customer_id');
                const validPages = ['dashboard','orderTable','createOrder','viewOrder','payment','anomaly','userManagement','storeManagement','expenses','customers','paymentHistory','backupRestore','customerOrders','customerPaymentHistory','blacklist','messageCenter'];
                
                // 【修复】增加登录检查
                if (page && validPages.includes(page) && page !== 'login' && AUTH && AUTH.isLoggedIn && AUTH.isLoggedIn()) {
                    return { page, filter, orderId, customerId };
                }
                return { page: null, filter: "all", orderId: null, customerId: null };
            } catch (e) { return { page: null, filter: "all", orderId: null, customerId: null }; }
        },

        clearPageState() {
            // 委托给 DashboardCore
            if (JF.DashboardCore && typeof JF.DashboardCore.clearPageState === 'function') {
                JF.DashboardCore.clearPageState();
            } else {
                try {
                    sessionStorage.removeItem('jf_current_page');
                    sessionStorage.removeItem('jf_current_filter');
                    sessionStorage.removeItem('jf_current_order_id');
                    sessionStorage.removeItem('jf_current_customer_id');
                } catch (e) { /* ignore */ }
            }
            this.currentOrderId = null;
            this.currentCustomerId = null;
        },

        // ==================== 语言切换 ====================
        toggleLanguage() {
            const newLang = Utils.lang === 'id' ? 'zh' : 'id';
            Utils.setLanguage(newLang);
            Utils.forceSyncLanguage();
            
            // 【修复】增加登录状态检查
            if (AUTH && AUTH.isLoggedIn && AUTH.isLoggedIn()) {
                if (JF.DashboardCore && typeof JF.DashboardCore.refreshCurrentPage === 'function') {
                    JF.DashboardCore.refreshCurrentPage();
                } else if (this.currentPage === 'dashboard') {
                    this.renderDashboard();
                } else {
                    location.reload();
                }
            } else {
                this.showLogin();
            }
        },

        // ==================== 导航 ====================
        goBack() {
            if (JF.DashboardCore && typeof JF.DashboardCore.goBack === 'function') {
                JF.DashboardCore.goBack();
            } else if (window.history.length > 1 && document.referrer) {
                window.history.back();
            } else {
                this.renderDashboard();
            }
        },

        navigateTo(page, params) {
            // 【修复】如果未登录，不允许导航
            if (!AUTH || !AUTH.isLoggedIn || !AUTH.isLoggedIn()) {
                console.log('[APP] 用户未登录，重定向到登录页');
                this.showLogin();
                return;
            }
            
            if (JF.DashboardCore && typeof JF.DashboardCore.navigateTo === 'function') {
                JF.DashboardCore.navigateTo(page, params);
                return;
            }
            // 降级（极少使用）
            if (params) {
                if (params.orderId) this.currentOrderId = params.orderId;
                if (params.customerId) this.currentCustomerId = params.customerId;
            }
            this.currentPage = page;
            this.saveCurrentPageState();
            this.renderDashboard();
        },

        // ==================== 登录 ====================
        showLogin() {
            if (JF.DashboardCore && typeof JF.DashboardCore.renderLogin === 'function') {
                JF.DashboardCore.renderLogin();
            } else {
                const lang = Utils.lang || 'zh';
                document.getElementById('app').innerHTML = `<div class="login-container"><div class="login-box"><h2>JF! by Gadai</h2><p>${lang === 'id' ? 'Memuat...' : '加载中...'}</p></div></div>`;
            }
        },

        async login() {
            // ---------- 防重入锁 ----------
            if (this._loginLock) return;
            this._loginLock = true;
            try {
                const lang = Utils.lang;
                const t = Utils.t.bind(Utils);
                const username = document.getElementById('username')?.value.trim();
                const password = document.getElementById('password')?.value;
                const rememberMe = document.getElementById('rememberMe')?.checked || false;

                if (!username || !password) {
                    Utils.toast.warning(t('fill_all_fields'));
                    return;
                }

                const loginBtn = document.querySelector('.login-btn');
                const originalText = loginBtn?.innerHTML || '';
                if (loginBtn) {
                    loginBtn.disabled = true;
                    loginBtn.innerHTML = '⏳ ' + (lang === 'id' ? 'Memproses...' : '登录中...');
                }

                try {
                    // 【修复】使用 AUTH 模块登录
                    const result = await AUTH.login(username, password);
                    if (result) {
                        if (rememberMe) {
                            AUTH.setRememberMe(true);
                            localStorage.setItem('jf_remembered_user', username);
                        } else {
                            AUTH.setRememberMe(false);
                            localStorage.removeItem('jf_remembered_user');
                        }
                        
                        Utils.toast.success(lang === 'id' ? 'Login berhasil' : '登录成功');
                        
                        // 【修复】登录成功后清除旧的恢复状态
                        this.clearPageState();
                        
                        if (JF.DashboardCore && typeof JF.DashboardCore.renderDashboard === 'function') {
                            await JF.DashboardCore.renderDashboard();
                        } else {
                            APP.renderDashboard();
                        }
                    } else {
                        if (loginBtn) {
                            loginBtn.disabled = false;
                            loginBtn.innerHTML = originalText;
                        }
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    if (loginBtn) {
                        loginBtn.disabled = false;
                        loginBtn.innerHTML = originalText;
                    }
                    Utils.toast.error(lang === 'id' ? 'Login gagal: ' + error.message : '登录失败：' + error.message);
                }
            } finally {
                this._loginLock = false;
            }
        },

        async logout() {
            const confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
            if (confirmed) {
                // 【修复】使用 AUTH 模块登出
                if (AUTH && typeof AUTH.logout === 'function') {
                    await AUTH.logout();
                }
                
                APP.clearPageState();
                
                // 【修复】清除 sessionStorage
                try {
                    sessionStorage.clear();
                } catch (e) { /* ignore */ }
                
                APP.showLogin();
                
                if (Utils && Utils.toast) {
                    Utils.toast.success(Utils.lang === 'id' ? 'Berhasil keluar' : '已退出登录');
                }
            }
        },

        // ==================== 仪表盘（降级备用） ====================
        async renderDashboard() {
            // 【修复】增加登录检查
            if (!AUTH || !AUTH.isLoggedIn || !AUTH.isLoggedIn()) {
                this.showLogin();
                return;
            }
            
            if (JF.DashboardCore && typeof JF.DashboardCore.renderDashboard === 'function') {
                return await JF.DashboardCore.renderDashboard();
            }
            document.getElementById('app').innerHTML = `<div class="card"><p>Dashboard unavailable</p></div>`;
        },

        // ==================== 导出/导入 ====================
        exportData() {
            if (typeof BackupStorage !== 'undefined' && BackupStorage.backup) {
                BackupStorage.backup();
            } else {
                Utils.toast.error(Utils.t('backup_restore') + ' ' + (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
            }
        },

        importData() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                if (e.target.files?.[0]) {
                    if (typeof BackupStorage !== 'undefined' && BackupStorage.restore) {
                        await BackupStorage.restore(e.target.files[0]);
                    } else {
                        Utils.toast.error(Utils.t('backup_restore') + ' ' + (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
                    }
                }
            };
            input.click();
        },

        // ==================== WA 提醒 ====================
        async sendWAReminder(orderId) {
            try {
                const result = await SUPABASE.getPaymentHistory(orderId);
                const order = result.order;
                if (!order) {
                    Utils.toast.error(Utils.t('order_not_found'));
                    return;
                }
                const storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                if (!storeWA) {
                    Utils.toast.warning(Utils.lang === 'id' ? 'Nomor WhatsApp toko belum diatur' : '门店 WhatsApp 号码未设置');
                    return;
                }
                const customerPhone = order.customer_phone;
                if (!customerPhone) {
                    Utils.toast.warning(Utils.lang === 'id' ? 'Nomor telepon nasabah tidak tersedia' : '客户电话不存在');
                    return;
                }
                let cleanPhone = customerPhone.replace(/[^0-9]/g, '');
                if (!cleanPhone.startsWith('62') && !cleanPhone.startsWith('0')) {
                    cleanPhone = '62' + cleanPhone;
                }
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '62' + cleanPhone.substring(1);
                }
                const waMessage = JF.WAPage ? JF.WAPage.generateWAText(order, storeWA) : '';
                const encodedMessage = encodeURIComponent(waMessage);
                const waUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodedMessage;
                window.open(waUrl, '_blank');
                await SUPABASE.logReminder(order.id);
                Utils.toast.success(Utils.lang === 'id' ? 'Membuka WhatsApp...' : '正在打开 WhatsApp...');
            } catch (error) {
                console.error("sendWAReminder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
            }
        },

        // ==================== 打印 ====================
        printCurrentPage() {
            if (JF.PrintPage && typeof JF.PrintPage.printCurrentPage === 'function') {
                JF.PrintPage.printCurrentPage();
            } else {
                window.print();
            }
        }
    };

    // 挂载到命名空间及全局
    window.APP = Object.assign(window.APP || {}, APP);
    JF.APP = window.APP;

    console.log('[APP] app.js v2.1 加载完成');
    console.log('[APP] 快捷键: Alt+R 恢复页面 | 如果白板请执行 APP.forceRecovery()');

    // Alt+R 快捷键恢复
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            APP.forceRecovery();
        }
    });
    
    // 【修复】增加 Alt+Shift+R 强制清除并重新加载
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            APP.forceClearAndReload();
        }
    });
})();
