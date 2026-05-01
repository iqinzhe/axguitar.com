// app.js - 主入口文件 (v1.6 统一登录入口版)
// 修复：仪表盘卡片功能错误 - 银行卡图标应跳转到 paymentHistory
// 添加：手动强制恢复函数 APP.forceRecovery()
// 优化：错误界面添加恢复按钮
// 统一：登录入口委托给 DashboardCore.renderLogin

window.APP = window.APP || {};

// 当前页面状态
APP.currentPage = 'dashboard';
APP.currentFilter = 'all';
APP.currentOrderId = null;
APP.currentCustomerId = null;

// ==================== 手动强制恢复函数 ====================
// 当页面出现白板时，用户可通过控制台调用 APP.forceRecovery() 恢复
// 也可在错误界面点击"强制恢复"按钮调用
APP.forceRecovery = function() {
    console.log('[Recovery] 手动强制恢复执行');
    var appDiv = document.getElementById('app');
    
    if (!appDiv) {
        console.error('[Recovery] app 元素不存在');
        return;
    }
    
    // 显示加载状态
    appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;margin:20px;">' +
        '<div class="loader" style="margin:20px auto;"></div>' +
        '<p>' + (Utils.lang === 'id' ? '正在恢复...' : 'Recovering...') + '</p>' +
        '</div>';
    
    // 延迟执行恢复，让界面有时间渲染加载状态
    setTimeout(function() {
        try {
            if (AUTH && typeof AUTH.isLoggedIn === 'function' && AUTH.isLoggedIn()) {
                // 已登录，恢复仪表盘
                if (typeof window.DashboardCore !== 'undefined' && DashboardCore.renderDashboard) {
                    DashboardCore.renderDashboard();
                } else if (typeof APP.renderDashboard === 'function') {
                    APP.renderDashboard();
                } else {
                    location.reload();
                }
            } else {
                // 未登录，显示登录页 - 统一使用 DashboardCore
                if (typeof window.DashboardCore !== 'undefined' && DashboardCore.renderLogin) {
                    DashboardCore.renderLogin();
                } else if (typeof APP.showLogin === 'function') {
                    APP.showLogin();
                } else {
                    location.reload();
                }
            }
        } catch (error) {
            console.error('[Recovery] 恢复失败:', error);
            appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;">' +
                '<p>⚠️ ' + (Utils.lang === 'id' ? '自动恢复失败，请刷新页面' : 'Auto recovery failed, please refresh') + '</p>' +
                '<button onclick="location.reload()" style="margin-top:12px;">🔄 ' + 
                    (Utils.lang === 'id' ? '刷新页面' : 'Refresh') + '</button>' +
                '</div>';
        }
    }, 100);
};

// 页面状态恢复
APP.saveCurrentPageState = function() {
    try {
        sessionStorage.setItem('jf_current_page', APP.currentPage);
        sessionStorage.setItem('jf_current_filter', APP.currentFilter || 'all');
        if (APP.currentOrderId) sessionStorage.setItem('jf_current_order_id', APP.currentOrderId);
        if (APP.currentCustomerId) sessionStorage.setItem('jf_current_customer_id', APP.currentCustomerId);
        
        localStorage.setItem('jf_last_page', APP.currentPage);
        localStorage.setItem('jf_last_filter', APP.currentFilter || 'all');
        if (APP.currentOrderId) localStorage.setItem('jf_last_order_id', APP.currentOrderId);
        if (APP.currentCustomerId) localStorage.setItem('jf_last_customer_id', APP.currentCustomerId);
    } catch(e) {}
};

// 清除页面状态
APP.clearPageState = function() {
    try {
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_filter');
        sessionStorage.removeItem('jf_current_order_id');
        sessionStorage.removeItem('jf_current_customer_id');
    } catch(e) {}
};

// 切换语言
APP.toggleLanguage = function() {
    var newLang = Utils.lang === 'id' ? 'zh' : 'id';
    Utils.setLanguage(newLang);
    Utils.forceSyncLanguage();
    if (APP.isLoggedIn && APP.isLoggedIn()) {
        if (typeof window.DashboardCore !== 'undefined' && DashboardCore.refreshCurrentPage) {
            DashboardCore.refreshCurrentPage();
        } else if (APP.currentPage === 'dashboard') {
            APP.renderDashboard();
        } else {
            location.reload();
        }
    } else {
        // 未登录时显示登录页，委托给 DashboardCore
        if (typeof window.DashboardCore !== 'undefined' && DashboardCore.renderLogin) {
            DashboardCore.renderLogin();
        } else if (typeof APP.showLogin === 'function') {
            APP.showLogin();
        } else {
            location.reload();
        }
    }
};

// 返回上一页
APP.goBack = function() {
    if (typeof window.DashboardCore !== 'undefined' && DashboardCore.goBack) {
        DashboardCore.goBack();
    } else if (window.history.length > 1 && document.referrer) {
        window.history.back();
    } else {
        APP.renderDashboard();
    }
};

// 导航到指定页面
APP.navigateTo = function(page, params) {
    console.log('[APP] navigateTo:', page, params);
    
    if (typeof window.DashboardCore !== 'undefined' && DashboardCore.navigateTo) {
        DashboardCore.navigateTo(page, params);
        return;
    }
    
    console.log('[APP] navigateTo (fallback):', page, params);
    if (params) {
        if (params.orderId) APP.currentOrderId = params.orderId;
        if (params.customerId) APP.currentCustomerId = params.customerId;
    }
    
    try {
        switch(page) {
            case 'dashboard': APP.renderDashboard(); break;
            case 'orderTable': if (typeof APP.showOrderTable === 'function') APP.showOrderTable(); else APP.renderDashboard(); break;
            case 'customers': if (typeof APP.showCustomers === 'function') APP.showCustomers(); else APP.renderDashboard(); break;
            case 'expenses': if (typeof APP.showExpenses === 'function') APP.showExpenses(); else APP.renderDashboard(); break;
            case 'userManagement': if (typeof APP.showUserManagement === 'function') APP.showUserManagement(); else APP.renderDashboard(); break;
            case 'storeManagement': if (typeof StoreManager !== 'undefined' && typeof StoreManager.renderStoreManagement === 'function') StoreManager.renderStoreManagement(); else APP.renderDashboard(); break;
            case 'anomaly': if (typeof APP.showAnomaly === 'function') APP.showAnomaly(); else APP.renderDashboard(); break;
            case 'paymentHistory': if (typeof APP.showCashFlowPage === 'function') APP.showCashFlowPage(); else if (typeof APP.showPaymentHistory === 'function') APP.showPaymentHistory(); else APP.renderDashboard(); break;
            case 'backupRestore': if (typeof BackupStorage !== 'undefined' && typeof BackupStorage.renderBackupUI === 'function') BackupStorage.renderBackupUI(); else APP.renderDashboard(); break;
            case 'blacklist': if (typeof APP.showBlacklist === 'function') APP.showBlacklist(); else APP.renderDashboard(); break;
            case 'payment': if (params && params.orderId && typeof APP.showPayment === 'function') APP.showPayment(params.orderId); else APP.renderDashboard(); break;
            case 'viewOrder': if (params && params.orderId && typeof APP.viewOrder === 'function') APP.viewOrder(params.orderId); else APP.renderDashboard(); break;
            case 'createOrder': if (params && params.customerId && typeof APP.createOrderForCustomer === 'function') APP.createOrderForCustomer(params.customerId); else APP.renderDashboard(); break;
            default: APP.renderDashboard();
        }
    } catch (error) {
        console.error('[navigateTo] 页面切换错误:', error);
        Utils.toast.error(Utils.lang === 'id' ? '页面加载失败，返回首页' : 'Page load failed, returning to home');
        APP.renderDashboard();
    }
};

// 打印当前页面
APP.printCurrentPage = function() {
    if (window.DashboardPrint && typeof DashboardPrint.printCurrentPage === 'function') {
        DashboardPrint.printCurrentPage();
    } else {
        window.print();
    }
};

// 导出数据
APP.exportData = function() {
    if (typeof BackupStorage !== 'undefined' && BackupStorage.backup) {
        BackupStorage.backup();
    } else {
        Utils.toast.error(Utils.t('backup_restore') + ' ' + (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
    }
};

// 导入数据
APP.importData = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async function(e) {
        if (e.target.files && e.target.files[0]) {
            if (typeof BackupStorage !== 'undefined' && BackupStorage.restore) {
                await BackupStorage.restore(e.target.files[0]);
            } else {
                Utils.toast.error(Utils.t('backup_restore') + ' ' + (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
            }
        }
    };
    input.click();
};

// 检查登录状态
APP.isLoggedIn = function() {
    return AUTH && typeof AUTH.isLoggedIn === 'function' && AUTH.isLoggedIn();
};

// ========== 统一登录入口（委托给 DashboardCore） ==========
APP.showLogin = function() {
    // 优先使用 DashboardCore 的登录界面（保持单一入口）
    if (typeof window.DashboardCore !== 'undefined' && DashboardCore.renderLogin) {
        DashboardCore.renderLogin();
        return;
    }
    
    // 降级方案：当 DashboardCore 不可用时使用原始登录界面（极少情况）
    console.warn('[APP] DashboardCore 不可用，使用降级登录界面');
    var lang = Utils.lang;
    var t = function(key) { return Utils.t(key); };
    
    document.getElementById("app").innerHTML = '' +
        '<div class="login-container">' +
            '<div class="login-box">' +
                '<div class="login-header">' +
                    '<img src="icons/pagehead-logo.png" alt="JF!" class="login-logo">' +
                    '<h1>JF! by Gadai</h1>' +
                    '<p>' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + '</p>' +
                '</div>' +
                '<div class="login-form">' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Username / Email' : '用户名/邮箱') + '</label>' +
                        '<input type="text" id="loginUsername" placeholder="' + (lang === 'id' ? 'Masukkan username atau email' : '请输入用户名或邮箱') + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + t('password') + '</label>' +
                        '<div style="display:flex; gap:8px;">' +
                            '<input type="password" id="loginPassword" placeholder="' + t('password') + '" style="flex:1;">' +
                            '<button type="button" onclick="Utils.togglePasswordVisibility(\'loginPassword\', this)" class="btn-small">👁️</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group" style="flex-direction:row; justify-content:space-between;">' +
                        '<label style="display:flex; align-items:center; gap:8px;">' +
                            '<input type="checkbox" id="rememberMe"> ' + (lang === 'id' ? 'Ingat saya' : '记住我') +
                        '</label>' +
                        '<button onclick="APP.toggleLanguage()" class="lang-btn">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
                    '</div>' +
                    '<button onclick="APP.login()" class="login-btn">' + t('login') + '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    
    var passwordInput = document.getElementById('loginPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                APP.login();
            }
        });
    }
    
    if (AUTH.isRememberMe && AUTH.isRememberMe()) {
        var rememberedUser = localStorage.getItem('jf_remembered_user');
        if (rememberedUser) {
            var usernameInput = document.getElementById('loginUsername');
            if (usernameInput) usernameInput.value = rememberedUser;
            document.getElementById('rememberMe').checked = true;
        }
    }
};

// 登录方法
APP.login = async function() {
    var lang = Utils.lang;
    var t = Utils.t.bind(Utils);
    
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var rememberMe = document.getElementById('rememberMe')?.checked || false;
    
    if (!username || !password) {
        Utils.toast.warning(t('fill_all_fields'));
        return;
    }
    
    var loginBtn = document.querySelector('.login-btn');
    var originalText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '⏳ ' + (lang === 'id' ? 'Memproses...' : '登录中...');
    
    try {
        var result = await AUTH.login(username, password);
        
        if (result) {
            if (rememberMe) {
                AUTH.setRememberMe(true);
                localStorage.setItem('jf_remembered_user', username);
            } else {
                AUTH.setRememberMe(false);
                localStorage.removeItem('jf_remembered_user');
            }
            
            Utils.toast.success(lang === 'id' ? '✅ Login berhasil' : '✅ 登录成功');
            
            if (typeof window.DashboardCore !== 'undefined' && DashboardCore.router) {
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
};

// 退出登录
APP.logout = async function() {
    var lang = Utils.lang;
    var confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
    if (confirmed) {
        await AUTH.logout();
        APP.clearPageState();
        APP.showLogin();
        Utils.toast.success(lang === 'id' ? '✅ Berhasil keluar' : '✅ 已退出登录');
    }
};

// 渲染仪表盘
APP.renderDashboard = async function() {
    if (typeof window.DashboardCore !== 'undefined' && DashboardCore.renderDashboard) {
        return await DashboardCore.renderDashboard();
    }
    
    APP.currentPage = 'dashboard';
    APP.saveCurrentPageState();
    
    var lang = Utils.lang;
    var t = function(key) { return Utils.t(key); };
    var profile = await SUPABASE.getCurrentProfile();
    var isAdmin = profile?.role === 'admin';
    var storeName = AUTH.getCurrentStoreName();
    var userName = profile?.name || '-';
    
    try {
        var report = await Order.getReport();
        var cashFlow = await SUPABASE.getCashFlowSummary();
        
        document.getElementById("app").innerHTML = '' +
            '<div class="dashboard-container">' +
                '<div class="dashboard-header">' +
                    '<div class="dashboard-title">' +
                        '<h1>🏦 ' + t('dashboard_title') + '</h1>' +
                        '<p>' + t('welcome') + ', ' + Utils.escapeHtml(userName) + ' @ ' + Utils.escapeHtml(storeName) + '</p>' +
                    '</div>' +
                    '<div class="dashboard-actions">' +
                        '<button onclick="APP.toggleLanguage()" class="lang-btn">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa') + '</button>' +
                        '<button onclick="APP.logout()" class="logout-btn">🚪 ' + t('save_exit') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="stats-grid">' +
                    '<div class="stat-card"><div class="stat-value">' + report.total_orders + '</div><div class="stat-label">' + t('total_orders') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value">' + report.active_orders + '</div><div class="stat-label">' + t('active') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_loan_amount) + '</div><div class="stat-label">' + t('total_loan') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value income">' + Utils.formatCurrency(cashFlow.netProfit?.balance || 0) + '</div><div class="stat-label">' + t('net_profit') + '</div></div>' +
                '</div>' +
                
                '<div class="dashboard-grid">' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'orderTable\')"><div class="card-icon">📋</div><div class="card-title">' + t('order_list') + '</div><div class="card-desc">' + t('manage_orders') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'customers\')"><div class="card-icon">👥</div><div class="card-title">' + t('customers') + '</div><div class="card-desc">' + t('manage_customers') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'expenses\')"><div class="card-icon">📝</div><div class="card-title">' + t('expenses') + '</div><div class="card-desc">' + t('manage_expenses') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'paymentHistory\')"><div class="card-icon">💰</div><div class="card-title">' + t('payment_history') + '</div><div class="card-desc">' + t('view_cashflow') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.showCashFlowPage()"><div class="card-icon">🏦</div><div class="card-title">' + (lang === 'id' ? 'Arus Kas' : '资金流水') + '</div><div class="card-desc">' + t('view_transactions') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'anomaly\')"><div class="card-icon">⚠️</div><div class="card-title">' + t('anomaly_title') + '</div><div class="card-desc">' + t('abnormal_status') + '</div></div>';
        
        if (isAdmin) {
            document.getElementById("app").innerHTML +=
                '<div class="dashboard-card" onclick="APP.navigateTo(\'userManagement\')"><div class="card-icon">👥</div><div class="card-title">' + t('user_management') + '</div><div class="card-desc">' + t('manage_users') + '</div></div>' +
                '<div class="dashboard-card" onclick="StoreManager.renderStoreManagement()"><div class="card-icon">🏪</div><div class="card-title">' + t('store_management') + '</div><div class="card-desc">' + t('manage_stores') + '</div></div>' +
                '<div class="dashboard-card" onclick="APP.navigateTo(\'backupRestore\')"><div class="card-icon">💾</div><div class="card-title">' + t('backup_restore') + '</div><div class="card-desc">' + t('backup_restore_data') + '</div></div>' +
                '<div class="dashboard-card" onclick="APP.navigateTo(\'blacklist\')"><div class="card-icon">🚫</div><div class="card-title">' + t('blacklist_title') + '</div><div class="card-desc">' + t('manage_blacklist') + '</div></div>';
        } else {
            document.getElementById("app").innerHTML +=
                '<div class="dashboard-card" onclick="APP.navigateTo(\'blacklist\')"><div class="card-icon">🚫</div><div class="card-title">' + t('blacklist_title') + '</div><div class="card-desc">' + t('view_blacklist') + '</div></div>';
        }
        
        document.getElementById("app").innerHTML += '</div></div>';
        
    } catch (error) {
        console.error("renderDashboard error:", error);
        Utils.toast.error(lang === 'id' ? 'Gagal memuat dashboard' : '加载仪表盘失败');
        // 错误界面添加恢复按钮
        document.getElementById("app").innerHTML = '' +
            '<div class="card" style="text-align:center;padding:40px;">' +
                '<p>⚠️ ' + (lang === 'id' ? '加载仪表盘失败' : 'Dashboard load failed') + '</p>' +
                '<p style="font-size:12px;color:#64748b;margin:8px 0;">' + Utils.escapeHtml(error.message) + '</p>' +
                '<button onclick="APP.forceRecovery()" style="margin-top:12px;margin-right:8px;padding:8px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer;">🔄 ' + 
                    (lang === 'id' ? '强制恢复' : 'Force Recovery') + '</button>' +
                '<button onclick="location.reload()" style="margin-top:12px;padding:8px 20px;">🔄 ' + 
                    (lang === 'id' ? '刷新页面' : 'Refresh') + '</button>' +
            '</div>';
    }
};

// 发送 WA 提醒
APP.sendWAReminder = async function(orderId) {
    var lang = Utils.lang;
    var t = Utils.t.bind(Utils);
    try {
        var result = await SUPABASE.getPaymentHistory(orderId);
        var order = result.order;
        if (!order) {
            Utils.toast.error(t('order_not_found'));
            return;
        }
        
        var storeWA = await SUPABASE.getStoreWANumber(order.store_id);
        if (!storeWA) {
            Utils.toast.warning(lang === 'id' ? 'Nomor WhatsApp toko belum diatur' : '门店 WhatsApp 号码未设置');
            return;
        }
        
        var customerPhone = order.customer_phone;
        if (!customerPhone) {
            Utils.toast.warning(lang === 'id' ? 'Nomor telepon nasabah tidak tersedia' : '客户电话不存在');
            return;
        }
        
        var cleanPhone = customerPhone.replace(/[^0-9]/g, '');
        if (!cleanPhone.startsWith('62') && !cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone;
        }
        if (cleanPhone.startsWith('0')) {
            cleanPhone = '62' + cleanPhone.substring(1);
        }
        
        var waMessage = APP.generateWAText(order, storeWA);
        var encodedMessage = encodeURIComponent(waMessage);
        var waUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodedMessage;
        
        window.open(waUrl, '_blank');
        
        await SUPABASE.logReminder(order.id);
        Utils.toast.success(lang === 'id' ? '✅ Membuka WhatsApp...' : '✅ 正在打开 WhatsApp...');
        
    } catch (error) {
        console.error("sendWAReminder error:", error);
        Utils.toast.error(lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
    }
};

// 导出 APP 到全局
window.APP = APP;

// 在控制台输出可用的恢复命令
console.log('[APP] app.js 加载完成 (v1.6)');
console.log('[APP] 如果出现白板，请在控制台执行 APP.forceRecovery() 恢复页面');

// 可选：注册全局快捷键 Alt+R 恢复页面（方便调试）
document.addEventListener('keydown', function(e) {
    if (e.altKey && e.key === 'r') {
        e.preventDefault();
        console.log('[快捷键] Alt+R 触发强制恢复');
        APP.forceRecovery();
    }
});

// ==================== 资金管理模块方法挂载（确保全局可用） ====================
// 确保资金管理模块的方法被正确暴露到 window.APP

(function() {
    'use strict';
    
    // 检查并挂载资金管理相关方法
    var capitalMethods = [
        'showCapitalInjectionModal',
        'closeCapitalInjectionModal',
        'saveCapitalInjection',
        'showProfitReinvestPage',
        'loadProfitReinvestData',
        'executeProfitReinvestment',
        'showPartialReinvestModal',
        'closePartialReinvestModal',
        'confirmPartialReinvest',
        'showCapitalUtilizationDetail',
        'closeCapitalDetailModal',
        'printCapitalDetail',
        '_loadReinvestHistory'
    ];
    
    for (var i = 0; i < capitalMethods.length; i++) {
        var methodName = capitalMethods[i];
        if (typeof window.APP[methodName] === 'undefined' && typeof CapitalModule !== 'undefined') {
            if (typeof CapitalModule[methodName] === 'function') {
                window.APP[methodName] = CapitalModule[methodName].bind(CapitalModule);
                console.log('[APP] 已挂载资金管理方法:', methodName);
            }
        }
    }
    
    // 确保 _loadCapitalCardData 方法存在（来自 DashboardCore）
    if (typeof window.APP._loadCapitalCardData === 'undefined' && typeof DashboardCore !== 'undefined') {
        if (typeof DashboardCore._loadCapitalCardData === 'function') {
            window.APP._loadCapitalCardData = DashboardCore._loadCapitalCardData.bind(DashboardCore);
            console.log('[APP] 已挂载 DashboardCore._loadCapitalCardData');
        }
    }
    
    console.log('[APP] 资金管理模块方法挂载完成');
})();
