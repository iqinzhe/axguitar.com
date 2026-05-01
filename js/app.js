// app.js - v2.0 最终完整版（修复版 - 语言判断和状态管理委托）
// JF 命名空间下的主入口，提供全局 APP 方法与协调功能

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // 主协调对象（挂载到 window.APP 以兼容旧版 onClick 绑定）
    const APP = {
        currentPage: 'dashboard',
        currentFilter: 'all',
        currentOrderId: null,
        currentCustomerId: null,
        historyStack: [],

        // ==================== 强制恢复（修复语言判断） ====================
        forceRecovery() {
            console.log('[Recovery] 手动强制恢复');
            const appDiv = document.getElementById('app');
            if (!appDiv) return;
            // 修复：印尼语显示印尼语，中文显示中文
            const loadingText = Utils.lang === 'id' ? 'Sedang memulihkan...' : '正在恢复...';
            appDiv.innerHTML = `<div class="card" style="text-align:center;padding:40px;margin:20px;">
                <div class="loader" style="margin:20px auto;"></div>
                <p>${loadingText}</p>
            </div>`;
            setTimeout(() => {
                try {
                    if (AUTH.isLoggedIn()) {
                        if (JF.DashboardCore?.renderDashboard) {
                            JF.DashboardCore.renderDashboard();
                        } else {
                            location.reload();
                        }
                    } else {
                        APP.showLogin();
                    }
                } catch (e) {
                    console.error(e);
                    location.reload();
                }
            }, 100);
        },

        // ==================== 页面状态持久化（委托给 DashboardCore） ====================
        saveCurrentPageState() {
            // 统一委托给 DashboardCore 处理，避免状态不同步
            if (JF.DashboardCore && typeof JF.DashboardCore.saveCurrentPageState === 'function') {
                JF.DashboardCore.saveCurrentPageState();
            } else {
                // 降级：直接保存到 sessionStorage
                try {
                    sessionStorage.setItem('jf_current_page', this.currentPage);
                    sessionStorage.setItem('jf_current_filter', this.currentFilter || 'all');
                    if (this.currentOrderId) sessionStorage.setItem('jf_current_order_id', this.currentOrderId);
                    if (this.currentCustomerId) sessionStorage.setItem('jf_current_customer_id', this.currentCustomerId);
                    localStorage.setItem('jf_last_page', this.currentPage);
                    localStorage.setItem('jf_last_filter', this.currentFilter || 'all');
                    if (this.currentOrderId) localStorage.setItem('jf_last_order_id', this.currentOrderId);
                    if (this.currentCustomerId) localStorage.setItem('jf_last_customer_id', this.currentCustomerId);
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
                const validPages = ['dashboard','orderTable','createOrder','viewOrder','payment','anomaly','userManagement','storeManagement','expenses','customers','paymentHistory','backupRestore','customerOrders','customerPaymentHistory','blacklist'];
                if (page && validPages.includes(page) && page !== 'login') {
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
            Utils.setLanguage(Utils.lang === 'id' ? 'zh' : 'id');
            Utils.forceSyncLanguage();
            if (AUTH.isLoggedIn()) {
                if (JF.DashboardCore?.refreshCurrentPage) {
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
            if (JF.DashboardCore?.goBack) {
                JF.DashboardCore.goBack();
            } else if (window.history.length > 1 && document.referrer) {
                window.history.back();
            } else {
                this.renderDashboard();
            }
        },

        navigateTo(page, params) {
            if (JF.DashboardCore?.navigateTo) {
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
            if (JF.DashboardCore?.renderLogin) {
                JF.DashboardCore.renderLogin();
            } else {
                document.getElementById('app').innerHTML = `<div class="login-container"><div class="login-box"><h2>JF! by Gadai</h2><p>Loading...</p></div></div>`;
            }
        },

        async login() {
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
                const result = await AUTH.login(username, password);
                if (result) {
                    if (rememberMe) {
                        AUTH.setRememberMe(true);
                        localStorage.setItem('jf_remembered_user', username);
                    } else {
                        AUTH.setRememberMe(false);
                        localStorage.removeItem('jf_remembered_user');
                    }
                    Utils.toast.success(lang === 'id' ? '✅ Login berhasil' : '✅ 登录成功');
                    if (JF.DashboardCore?.router) {
                        await JF.DashboardCore.router();
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
        },

        async logout() {
            const confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
            if (confirmed) {
                await AUTH.logout();
                APP.clearPageState();
                APP.showLogin();
                Utils.toast.success(Utils.lang === 'id' ? '✅ Berhasil keluar' : '✅ 已退出登录');
            }
        },

        // ==================== 仪表盘（降级备用） ====================
        async renderDashboard() {
            if (JF.DashboardCore?.renderDashboard) {
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
                const waMessage = JF.WAPage.generateWAText(order, storeWA);
                const encodedMessage = encodeURIComponent(waMessage);
                const waUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodedMessage;
                window.open(waUrl, '_blank');
                await SUPABASE.logReminder(order.id);
                Utils.toast.success(Utils.lang === 'id' ? '✅ Membuka WhatsApp...' : '✅ 正在打开 WhatsApp...');
            } catch (error) {
                console.error("sendWAReminder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
            }
        },

        // ==================== 打印 ====================
        printCurrentPage() {
            if (JF.PrintPage?.printCurrentPage) {
                JF.PrintPage.printCurrentPage();
            } else {
                window.print();
            }
        }
    };

    // 挂载到命名空间及全局
    window.APP = Object.assign(window.APP || {}, APP);
    JF.APP = window.APP;

    console.log('[APP] app.js v2.0 最终版加载完成');
    console.log('[APP] 如果出现白板，请在控制台执行 APP.forceRecovery() 恢复页面');

    // Alt+R 快捷键恢复
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            APP.forceRecovery();
        }
    });
})();
