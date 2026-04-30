// app.js - 主入口文件 (v1.0)

window.APP = window.APP || {};

// 当前页面状态
APP.currentPage = 'dashboard';
APP.currentFilter = 'all';
APP.currentOrderId = null;
APP.currentCustomerId = null;

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
        APP.renderDashboard();
    } else {
        APP.showLogin();
    }
};

// 返回上一页
APP.goBack = function() {
    var validPages = ['dashboard', 'orderTable', 'customers', 'expenses', 'userManagement', 'storeManagement', 'anomaly', 'paymentHistory', 'backupRestore', 'blacklist'];
    if (window.history.length > 1 && document.referrer) {
        window.history.back();
    } else {
        APP.renderDashboard();
    }
};

// 导航到指定页面
APP.navigateTo = function(page, params) {
    console.log('[APP] navigateTo:', page, params);
    
    if (params) {
        if (params.orderId) APP.currentOrderId = params.orderId;
        if (params.customerId) APP.currentCustomerId = params.customerId;
    }
    
    switch(page) {
        case 'dashboard':
            APP.renderDashboard();
            break;
        case 'orderTable':
            if (typeof APP.showOrderTable === 'function') {
                APP.showOrderTable();
            } else {
                console.error('showOrderTable 未定义');
                APP.renderDashboard();
            }
            break;
        case 'customers':
            if (typeof APP.showCustomers === 'function') {
                APP.showCustomers();
            } else {
                console.error('showCustomers 未定义');
                APP.renderDashboard();
            }
            break;
        case 'expenses':
            if (typeof APP.showExpenses === 'function') {
                APP.showExpenses();
            } else {
                console.error('showExpenses 未定义');
                APP.renderDashboard();
            }
            break;
        case 'userManagement':
            if (typeof APP.showUserManagement === 'function') {
                APP.showUserManagement();
            } else {
                console.error('showUserManagement 未定义');
                APP.renderDashboard();
            }
            break;
        case 'storeManagement':
            if (typeof StoreManager !== 'undefined' && typeof StoreManager.renderStoreManagement === 'function') {
                StoreManager.renderStoreManagement();
            } else {
                console.error('StoreManager.renderStoreManagement 未定义');
                APP.renderDashboard();
            }
            break;
        case 'anomaly':
            if (typeof APP.showAnomaly === 'function') {
                APP.showAnomaly();
            } else {
                console.error('showAnomaly 未定义');
                APP.renderDashboard();
            }
            break;
        case 'paymentHistory':
            if (typeof APP.showPaymentHistory === 'function') {
                APP.showPaymentHistory();
            } else {
                console.error('showPaymentHistory 未定义');
                APP.renderDashboard();
            }
            break;
        case 'backupRestore':
            if (typeof BackupStorage !== 'undefined' && typeof BackupStorage.renderBackupUI === 'function') {
                BackupStorage.renderBackupUI();
            } else {
                console.error('BackupStorage.renderBackupUI 未定义');
                APP.renderDashboard();
            }
            break;
        case 'blacklist':
            if (typeof APP.showBlacklist === 'function') {
                APP.showBlacklist();
            } else {
                console.error('showBlacklist 未定义');
                APP.renderDashboard();
            }
            break;
        case 'payment':
            if (params && params.orderId && typeof APP.showPayment === 'function') {
                APP.showPayment(params.orderId);
            } else {
                console.error('showPayment 未定义或缺少orderId');
                APP.renderDashboard();
            }
            break;
        case 'viewOrder':
            if (params && params.orderId && typeof APP.viewOrder === 'function') {
                APP.viewOrder(params.orderId);
            } else {
                console.error('viewOrder 未定义或缺少orderId');
                APP.renderDashboard();
            }
            break;
        case 'createOrder':
            if (params && params.customerId && typeof APP.createOrderForCustomer === 'function') {
                APP.createOrderForCustomer(params.customerId);
            } else {
                console.error('createOrderForCustomer 未定义或缺少customerId');
                APP.renderDashboard();
            }
            break;
        default:
            APP.renderDashboard();
    }
};

// 打印当前页面
APP.printCurrentPage = function() {
    if (window.APP && typeof window.APP._doPrint === 'function') {
        window.APP._doPrint();
    } else if (window.DashboardPrint && typeof DashboardPrint.printCurrentPage === 'function') {
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
        Utils.toast.error('备份功能不可用');
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
                Utils.toast.error('恢复功能不可用');
            }
        }
    };
    input.click();
};

// 检查登录状态
APP.isLoggedIn = function() {
    return AUTH && typeof AUTH.isLoggedIn === 'function' && AUTH.isLoggedIn();
};

// 显示登录页面
APP.showLogin = function() {
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
    
    // 绑定回车键
    var passwordInput = document.getElementById('loginPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                APP.login();
            }
        });
    }
    
    // 恢复记住的用户名
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
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;
    var rememberMe = document.getElementById('rememberMe')?.checked || false;
    
    if (!username || !password) {
        Utils.toast.warning(Utils.lang === 'id' ? 'Harap isi username dan password' : '请填写用户名和密码');
        return;
    }
    
    var loginBtn = document.querySelector('.login-btn');
    var originalText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '⏳ ' + (Utils.lang === 'id' ? 'Memproses...' : '登录中...');
    
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
            
            Utils.toast.success(Utils.lang === 'id' ? '✅ Login berhasil' : '✅ 登录成功');
            APP.renderDashboard();
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Login error:', error);
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
        Utils.toast.error(Utils.lang === 'id' ? 'Login gagal: ' + error.message : '登录失败：' + error.message);
    }
};

// 退出登录
APP.logout = async function() {
    var confirmed = await Utils.toast.confirm(
        Utils.lang === 'id' ? 'Yakin ingin keluar?' : '确认退出登录？'
    );
    if (confirmed) {
        await AUTH.logout();
        APP.clearPageState();
        APP.showLogin();
        Utils.toast.success(Utils.lang === 'id' ? '✅ Berhasil keluar' : '✅ 已退出登录');
    }
};

// 渲染仪表盘
APP.renderDashboard = async function() {
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
                        '<h1>🏦 ' + (lang === 'id' ? 'Dashboard' : '仪表盘') + '</h1>' +
                        '<p>' + (lang === 'id' ? 'Selamat datang' : '欢迎') + ', ' + Utils.escapeHtml(userName) + ' @ ' + Utils.escapeHtml(storeName) + '</p>' +
                    '</div>' +
                    '<div class="dashboard-actions">' +
                        '<button onclick="APP.toggleLanguage()" class="lang-btn">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa') + '</button>' +
                        '<button onclick="APP.logout()" class="logout-btn">🚪 ' + (lang === 'id' ? 'Keluar' : '退出') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="stats-grid">' +
                    '<div class="stat-card"><div class="stat-value">' + report.total_orders + '</div><div class="stat-label">' + t('total_orders') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value">' + report.active_orders + '</div><div class="stat-label">' + t('active') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_loan_amount) + '</div><div class="stat-label">' + t('total_loan') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value income">' + Utils.formatCurrency(cashFlow.netProfit?.balance || 0) + '</div><div class="stat-label">' + (lang === 'id' ? 'Laba Bersih' : '净利润') + '</div></div>' +
                '</div>' +
                
                '<div class="dashboard-grid">' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'orderTable\')"><div class="card-icon">📋</div><div class="card-title">' + t('order_list') + '</div><div class="card-desc">' + (lang === 'id' ? 'Kelola semua pesanan' : '管理所有订单') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'customers\')"><div class="card-icon">👥</div><div class="card-title">' + t('customers') + '</div><div class="card-desc">' + (lang === 'id' ? 'Data nasabah' : '客户信息管理') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'expenses\')"><div class="card-icon">📝</div><div class="card-title">' + t('expenses') + '</div><div class="card-desc">' + (lang === 'id' ? 'Pengeluaran operasional' : '运营支出管理') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'paymentHistory\')"><div class="card-icon">💰</div><div class="card-title">' + t('payment_history') + '</div><div class="card-desc">' + (lang === 'id' ? 'Riwayat arus kas' : '资金流水记录') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.showCapitalModal()"><div class="card-icon">🏦</div><div class="card-title">' + (lang === 'id' ? 'Arus Kas' : '资金流水') + '</div><div class="card-desc">' + (lang === 'id' ? 'Lihat transaksi kas' : '查看现金交易记录') + '</div></div>' +
                    '<div class="dashboard-card" onclick="APP.navigateTo(\'anomaly\')"><div class="card-icon">⚠️</div><div class="card-title">' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</div><div class="card-desc">' + (lang === 'id' ? 'Pesanan terlambat & blacklist' : '逾期订单和黑名单') + '</div></div>';
        
        if (isAdmin) {
            document.getElementById("app").innerHTML +=
                '<div class="dashboard-card" onclick="APP.navigateTo(\'userManagement\')"><div class="card-icon">👥</div><div class="card-title">' + t('user_management') + '</div><div class="card-desc">' + (lang === 'id' ? 'Kelola pengguna' : '用户管理') + '</div></div>' +
                '<div class="dashboard-card" onclick="StoreManager.renderStoreManagement()"><div class="card-icon">🏪</div><div class="card-title">' + t('store_management') + '</div><div class="card-desc">' + (lang === 'id' ? 'Kelola toko' : '门店管理') + '</div></div>' +
                '<div class="dashboard-card" onclick="APP.navigateTo(\'backupRestore\')"><div class="card-icon">💾</div><div class="card-title">' + t('backup_restore') + '</div><div class="card-desc">' + (lang === 'id' ? 'Cadangkan & pulihkan' : '备份与恢复') + '</div></div>' +
                '<div class="dashboard-card" onclick="APP.navigateTo(\'blacklist\')"><div class="card-icon">🚫</div><div class="card-title">' + (lang === 'id' ? 'Blacklist' : '黑名单') + '</div><div class="card-desc">' + (lang === 'id' ? 'Kelola blacklist' : '黑名单管理') + '</div></div>';
        } else {
            document.getElementById("app").innerHTML +=
                '<div class="dashboard-card" onclick="APP.navigateTo(\'blacklist\')"><div class="card-icon">🚫</div><div class="card-title">' + (lang === 'id' ? 'Blacklist' : '黑名单') + '</div><div class="card-desc">' + (lang === 'id' ? 'Lihat blacklist' : '查看黑名单') + '</div></div>';
        }
        
        document.getElementById("app").innerHTML += '</div></div>';
        
    } catch (error) {
        console.error("renderDashboard error:", error);
        Utils.toast.error(lang === 'id' ? 'Gagal memuat dashboard' : '加载仪表盘失败');
    }
};

// 发送 WA 提醒
APP.sendWAReminder = async function(orderId) {
    var lang = Utils.lang;
    try {
        var result = await SUPABASE.getPaymentHistory(orderId);
        var order = result.order;
        if (!order) {
            Utils.toast.error(lang === 'id' ? 'Pesanan tidak ditemukan' : '订单不存在');
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

// 生成 WA 文本
APP.generateWAText = function(order, senderNumber) {
    var lang = Utils.lang;
    var monthlyRate = order.agreed_interest_rate || 0.08;
    var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
    var currentMonthlyInterest = remainingPrincipal * monthlyRate;
    var dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
    var repaymentType = order.repayment_type || 'flexible';
    
    if (lang === 'id') {
        if (repaymentType === 'fixed') {
            var monthlyFixedPayment = order.monthly_fixed_payment || 0;
            var paidMonths = order.fixed_paid_months || 0;
            var totalMonths = order.repayment_term || '?';
            return '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                'Kepada Bpk/Ibu ' + order.customer_name + ',\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(monthlyFixedPayment) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                'Angsuran ke-' + (paidMonths + 1) + '/' + totalMonths + '\n\n' +
                'Harap bayar tepat waktu. Terima kasih.\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        } else {
            return '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                'Kepada Bpk/Ibu ' + order.customer_name + ',\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(currentMonthlyInterest) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                'Harap bayar tepat waktu. Terima kasih.\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        }
    } else {
        if (repaymentType === 'fixed') {
            var monthlyFixedPaymentZh = order.monthly_fixed_payment || 0;
            var paidMonthsZh = order.fixed_paid_months || 0;
            var totalMonthsZh = order.repayment_term || '?';
            return '🔔 *缴费提醒 - JF!*\n\n' +
                '尊敬的 ' + order.customer_name + '，\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(monthlyFixedPaymentZh) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                '第' + (paidMonthsZh + 1) + '/' + totalMonthsZh + '期\n\n' +
                '请按时缴费。感谢信任。\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        } else {
            return '🔔 *缴费提醒 - JF!*\n\n' +
                '尊敬的 ' + order.customer_name + '，\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(currentMonthlyInterest) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                '请按时缴费。感谢信任。\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        }
    }
};

// 导出 APP 到全局
window.APP = APP;

console.log('[APP] app.js 加载完成，APP.init 已定义:', typeof APP.init);
