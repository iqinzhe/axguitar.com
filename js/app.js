// app.js - v2.0 统一入口 (JF 命名空间)
// 主入口文件，整合全局初始化、路由、登录、仪表盘等核心功能

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // 主应用对象
    const APP = {
        // 页面状态
        currentPage: 'dashboard',
        currentFilter: 'all',
        currentOrderId: null,
        currentCustomerId: null,

        // 历史栈（用于返回按钮）
        historyStack: [],

        // ==================== 强制恢复函数 ====================
        forceRecovery() {
            console.log('[Recovery] 手动强制恢复执行');
            const appDiv = document.getElementById('app');
            if (!appDiv) {
                console.error('[Recovery] app 元素不存在');
                return;
            }
            appDiv.innerHTML = `<div class="card" style="text-align:center;padding:40px;margin:20px;">
                <div class="loader" style="margin:20px auto;"></div>
                <p>${Utils.lang === 'id' ? '正在恢复...' : 'Recovering...'}</p>
            </div>`;
            setTimeout(() => {
                try {
                    if (AUTH.isLoggedIn()) {
                        if (typeof DashboardCore !== 'undefined' && DashboardCore.renderDashboard) {
                            DashboardCore.renderDashboard();
                        } else {
                            location.reload();
                        }
                    } else {
                        APP.showLogin();
                    }
                } catch (error) {
                    console.error('[Recovery] 恢复失败:', error);
                    appDiv.innerHTML = `<div class="card" style="text-align:center;padding:40px;">
                        <p>⚠️ ${Utils.lang === 'id' ? '自动恢复失败，请刷新页面' : 'Auto recovery failed, please refresh'}</p>
                        <button onclick="location.reload()" style="margin-top:12px;">🔄 ${Utils.lang === 'id' ? '刷新页面' : 'Refresh'}</button>
                    </div>`;
                }
            }, 100);
        },

        // ==================== 状态持久化 ====================
        saveCurrentPageState() {
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
        },

        clearPageState() {
            try {
                sessionStorage.removeItem('jf_current_page');
                sessionStorage.removeItem('jf_current_filter');
                sessionStorage.removeItem('jf_current_order_id');
                sessionStorage.removeItem('jf_current_customer_id');
            } catch (e) { /* ignore */ }
            this.currentOrderId = null;
            this.currentCustomerId = null;
        },

        // ==================== 语言切换 ====================
        toggleLanguage() {
            Utils.setLanguage(Utils.lang === 'id' ? 'zh' : 'id');
            Utils.forceSyncLanguage();
            if (AUTH.isLoggedIn()) {
                if (typeof DashboardCore !== 'undefined' && DashboardCore.refreshCurrentPage) {
                    DashboardCore.refreshCurrentPage();
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
            if (typeof DashboardCore !== 'undefined' && DashboardCore.goBack) {
                DashboardCore.goBack();
            } else if (window.history.length > 1 && document.referrer) {
                window.history.back();
            } else {
                this.renderDashboard();
            }
        },

        navigateTo(page, params) {
            if (typeof DashboardCore !== 'undefined' && DashboardCore.navigateTo) {
                DashboardCore.navigateTo(page, params);
                return;
            }
            // 降级处理
            console.log('[APP] navigateTo (fallback):', page, params);
            if (params) {
                if (params.orderId) this.currentOrderId = params.orderId;
                if (params.customerId) this.currentCustomerId = params.customerId;
            }
            this.currentPage = page;
            this.saveCurrentPageState();
            // 调用对应页面方法（已挂载到 APP 上）
            const handler = this[`show${page.charAt(0).toUpperCase() + page.slice(1)}`] || this.renderDashboard;
            handler.call(this);
        },

        // ==================== 登录相关 ====================
        showLogin() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            document.getElementById("app").innerHTML = `
                <div class="login-container">
                    <div class="login-box">
                        <div class="login-header">
                            <img src="icons/pagehead-logo.png" alt="JF!" class="login-logo">
                            <h1>JF! by Gadai</h1>
                            <p>${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</p>
                        </div>
                        <div class="login-form">
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Username / Email' : '用户名/邮箱'}</label>
                                <input type="text" id="loginUsername" placeholder="${lang === 'id' ? 'Masukkan username atau email' : '请输入用户名或邮箱'}">
                            </div>
                            <div class="form-group">
                                <label>${t('password')}</label>
                                <div style="display:flex;gap:8px;">
                                    <input type="password" id="loginPassword" placeholder="${t('password')}" style="flex:1;">
                                    <button type="button" onclick="Utils.togglePasswordVisibility('loginPassword', this)" class="btn-small">👁️</button>
                                </div>
                            </div>
                            <div class="form-group" style="flex-direction:row;justify-content:space-between;">
                                <label style="display:flex;align-items:center;gap:8px;">
                                    <input type="checkbox" id="rememberMe"> ${lang === 'id' ? 'Ingat saya' : '记住我'}
                                </label>
                                <button onclick="APP.toggleLanguage()" class="lang-btn">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                            </div>
                            <button onclick="APP.login()" class="login-btn">${t('login')}</button>
                        </div>
                    </div>
                </div>`;

            const passwordInput = document.getElementById('loginPassword');
            if (passwordInput) {
                passwordInput.addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') APP.login();
                });
            }
            if (AUTH.isRememberMe && AUTH.isRememberMe()) {
                const rememberedUser = localStorage.getItem('jf_remembered_user');
                if (rememberedUser) {
                    const usernameInput = document.getElementById('loginUsername');
                    if (usernameInput) usernameInput.value = rememberedUser;
                    document.getElementById('rememberMe').checked = true;
                }
            }
        },

        async login() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe')?.checked || false;

            if (!username || !password) {
                Utils.toast.warning(t('fill_all_fields'));
                return;
            }

            const loginBtn = document.querySelector('.login-btn');
            const originalText = loginBtn.innerHTML;
            loginBtn.disabled = true;
            loginBtn.innerHTML = '⏳ ' + (lang === 'id' ? 'Memproses...' : '登录中...');

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
                    if (typeof DashboardCore !== 'undefined' && DashboardCore.router) {
                        await DashboardCore.router();
                    } else {
                        APP.renderDashboard();
                    }
                } else {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalText;
                }
            } catch (error) {
                console.error('Login error:', error);
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalText;
                Utils.toast.error(lang === 'id' ? 'Login gagal: ' + error.message : '登录失败：' + error.message);
            }
        },

        async logout() {
            const lang = Utils.lang;
            const confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
            if (confirmed) {
                await AUTH.logout();
                APP.clearPageState();
                APP.showLogin();
                Utils.toast.success(lang === 'id' ? '✅ Berhasil keluar' : '✅ 已退出登录');
            }
        },

        // ==================== 仪表盘 ====================
        async renderDashboard() {
            if (typeof DashboardCore !== 'undefined' && DashboardCore.renderDashboard) {
                return await DashboardCore.renderDashboard();
            }
            // 降级到简易仪表盘（此处省略，由 DashboardCore 完全处理）
        },

        // ==================== 导出/导入功能 ====================
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
            input.onchange = async function (e) {
                if (e.target.files && e.target.files[0]) {
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
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            try {
                const result = await SUPABASE.getPaymentHistory(orderId);
                const order = result.order;
                if (!order) {
                    Utils.toast.error(t('order_not_found'));
                    return;
                }
                const storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                if (!storeWA) {
                    Utils.toast.warning(lang === 'id' ? 'Nomor WhatsApp toko belum diatur' : '门店 WhatsApp 号码未设置');
                    return;
                }
                const customerPhone = order.customer_phone;
                if (!customerPhone) {
                    Utils.toast.warning(lang === 'id' ? 'Nomor telepon nasabah tidak tersedia' : '客户电话不存在');
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
                Utils.toast.success(lang === 'id' ? '✅ Membuka WhatsApp...' : '✅ 正在打开 WhatsApp...');
            } catch (error) {
                console.error("sendWAReminder error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
            }
        },

        // ==================== 打印 ====================
        printCurrentPage() {
            if (typeof window.DashboardPrint !== 'undefined' && DashboardPrint.printCurrentPage) {
                DashboardPrint.printCurrentPage();
            } else {
                window.print();
            }
        }
    };

    // 挂载到命名空间
    JF.APP = APP;
    window.APP = APP; // 完全兼容

    // 在控制台输出可用的恢复命令
    console.log('[APP] app.js 加载完成 (v2.0 JF)');
    console.log('[APP] 如果出现白板，请在控制台执行 APP.forceRecovery() 恢复页面');

    // 注册全局快捷键 Alt+R 恢复页面
    document.addEventListener('keydown', function (e) {
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            console.log('[快捷键] Alt+R 触发强制恢复');
            APP.forceRecovery();
        }
    });
})();
