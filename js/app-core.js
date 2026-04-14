// ==================== 核心应用模块 ====================

window.APP = {
    currentPage: 'dashboard',
    currentCustomerId: null,
    currentOrderId: null,
    currentFilter: 'all',
    searchKeyword: '',
    pageHistory: [],

    // 初始化应用
    init: async function() {
        try {
            // 初始化语言
            if (!Utils.lang) {
                Utils.lang = localStorage.getItem('jf_language') || 'id';
            }
            
            // 初始化 Supabase 认证
            await AUTH.init();
            
            // 检查登录状态
            if (AUTH.isLoggedIn()) {
                await this.showDashboard();
            } else {
                this.showLogin();
            }
        } catch (error) {
            console.error("初始化失败:", error);
            document.getElementById("app").innerHTML = 
                '<div style="text-align:center;padding:50px;color:#ef4444;">系统初始化失败: ' + error.message + '</div>';
        }
    },

    // 显示登录界面
    showLogin: function() {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        document.getElementById("app").innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;min-height:100vh;">
                <div class="card" style="max-width:400px;width:100%;">
                    <div style="text-align:center;margin-bottom:20px;">
                        <img src="/icons/android-chrome-192x192.png" alt="JF!" style="width:64px;height:64px;">
                        <h2>JF! by Gadai</h2>
                        <p style="color:#64748b;">${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</p>
                    </div>
                    <div class="form-group">
                        <label>${t('username')}</label>
                        <input type="text" id="loginUsername" placeholder="admin@example.com">
                    </div>
                    <div class="form-group">
                        <label>${t('password')}</label>
                        <input type="password" id="loginPassword" placeholder="••••••">
                    </div>
                    <button onclick="APP.doLogin()" style="width:100%;">${t('login')}</button>
                    <div style="margin-top:15px;text-align:center;">
                        <button onclick="APP.toggleLanguage()" style="background:#64748b;">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    </div>
                </div>
            </div>
        `;
        
        // 绑定回车键
        document.getElementById("loginPassword")?.addEventListener("keypress", function(e) {
            if (e.key === "Enter") APP.doLogin();
        });
    },

    // 执行登录
    doLogin: async function() {
        var username = document.getElementById("loginUsername").value.trim();
        var password = document.getElementById("loginPassword").value;
        
        if (!username || !password) {
            alert(Utils.lang === 'id' ? 'Harap isi username dan password' : '请填写用户名和密码');
            return;
        }
        
        var result = await AUTH.login(username, password);
        if (result) {
            await this.showDashboard();
        } else {
            alert(Utils.lang === 'id' ? 'Login gagal! Periksa username dan password.' : '登录失败！请检查用户名和密码。');
        }
    },

    // 显示仪表板
    showDashboard: async function() {
        this.currentPage = 'dashboard';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        
        try {
            var report = await SUPABASE.getReport();
            var userName = AUTH.user?.name || (lang === 'id' ? 'Pengguna' : '用户');
            var storeName = AUTH.getCurrentStoreName();
            
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <div>
                        <h1>🏪 JF! by Gadai</h1>
                        <p style="color:#64748b;">${lang === 'id' ? 'Selamat datang' : '欢迎'}, ${Utils.escapeHtml(userName)} | ${Utils.escapeHtml(storeName)}</p>
                    </div>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.logout()" class="danger">🚪 ${t('logout')}</button>
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${report.total_orders}</div>
                        <div>${t('total_orders')}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color:#10b981;">${report.active_orders}</div>
                        <div>${t('active')}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color:#3b82f6;">${report.completed_orders}</div>
                        <div>${t('completed')}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div>
                        <div>${t('total_loan')}</div>
                    </div>
                </div>
                
                <div class="card">
                    <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan' : '财务汇总'}</h3>
                    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));">
                        <div class="stat-card">
                            <div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(report.total_admin_fees)}</div>
                            <div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" style="color:#f59e0b;">${Utils.formatCurrency(report.total_interest)}</div>
                            <div>${lang === 'id' ? 'Total Bunga' : '总利息'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(report.total_admin_fees + report.total_interest)}</div>
                            <div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.navigateTo('customers')">👥 ${lang === 'id' ? 'Nasabah' : '客户管理'}</button>
                    <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                    <button onclick="APP.navigateTo('financialReport')">💰 ${t('financial_report')}</button>
                    ${AUTH.isAdmin() ? `<button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</button>` : ''}
                    ${PERMISSION.canManageUsers() ? `<button onclick="APP.navigateTo('userManagement')">👤 ${t('user_management')}</button>` : ''}
                    <button onclick="APP.navigateTo('expenseManagement')">📝 ${lang === 'id' ? 'Pengeluaran' : '支出管理'}</button>
                    <button onclick="APP.navigateTo('migration')">📦 ${lang === 'id' ? 'Migrasi' : '数据迁移'}</button>
                    <button onclick="Storage.backup()">💾 ${t('backup_restore')}</button>
                </div>
            `;
        } catch (error) {
            console.error("Dashboard error:", error);
            document.getElementById("app").innerHTML = '<div style="text-align:center;padding:50px;color:#ef4444;">加载失败: ' + error.message + '</div>';
        }
    },

    // 导航到指定页面
    navigateTo: function(page, params = {}) {
        this.pageHistory.push(this.currentPage);
        
        switch(page) {
            case 'customers':
                APP_CUSTOMERS.showCustomers();
                break;
            case 'orderTable':
                APP_ORDERS.showOrderTable();
                break;
            case 'viewOrder':
                if (params.orderId) {
                    this.currentOrderId = params.orderId;
                    APP_ORDERS.viewOrder(params.orderId);
                }
                break;
            case 'payment':
                if (params.orderId) {
                    this.currentOrderId = params.orderId;
                    if (window.APP_PAYMENT) APP_PAYMENT.showPayment(params.orderId);
                    else alert("Payment module not loaded");
                }
                break;
            case 'customerPaymentHistory':
                if (params.customerId) {
                    this.currentCustomerId = params.customerId;
                    APP_CUSTOMERS.showCustomerPaymentHistory(params.customerId);
                }
                break;
            case 'financialReport':
                if (window.APP_REPORT) APP_REPORT.showFinancialReport();
                else alert("Report module not loaded");
                break;
            case 'userManagement':
                if (window.APP_USERS) APP_USERS.showUserManagement();
                else alert("User management module not loaded");
                break;
            case 'storeManagement':
                StoreManager.renderStoreManagement();
                break;
            case 'expenseManagement':
                if (window.APP_EXPENSE) APP_EXPENSE.showExpenseManagement();
                else alert("Expense module not loaded");
                break;
            case 'migration':
                Migration.renderMigrationUI();
                break;
            default:
                this.showDashboard();
        }
    },

    // 返回上一页
    goBack: function() {
        var prevPage = this.pageHistory.pop();
        if (prevPage) {
            this.navigateTo(prevPage);
        } else {
            this.showDashboard();
        }
    },

    // 打印当前页面
    printCurrentPage: function() {
        window.print();
    },

    // 切换语言
    toggleLanguage: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        // 重新加载当前页面
        if (this.currentPage === 'dashboard') {
            this.showDashboard();
        } else if (this.currentPage === 'customers') {
            APP_CUSTOMERS.showCustomers();
        } else if (this.currentPage === 'orderTable') {
            APP_ORDERS.showOrderTable();
        } else {
            location.reload();
        }
    },

    // 退出登录
    logout: async function() {
        if (confirm(Utils.lang === 'id' ? 'Yakin ingin keluar?' : '确定要退出吗？')) {
            await AUTH.logout();
            this.pageHistory = [];
            this.showLogin();
        }
    },

    // 保存当前页面状态
    saveCurrentPageState: function() {
        // 状态已在导航时保存
    },

    // 恢复页面状态
    restorePageState: function() {
        // 可根据需要实现
    }
};

// 挂载额外的方法
window.APP.goBack = window.APP.goBack.bind(window.APP);
window.APP.navigateTo = window.APP.navigateTo.bind(window.APP);
window.APP.toggleLanguage = window.APP.toggleLanguage.bind(window.APP);
window.APP.logout = window.APP.logout.bind(window.APP);
window.APP.printCurrentPage = window.APP.printCurrentPage.bind(window.APP);
window.APP.doLogin = window.APP.doLogin.bind(window.APP);
window.APP.showDashboard = window.APP.showDashboard.bind(window.APP);
window.APP.showLogin = window.APP.showLogin.bind(window.APP);
