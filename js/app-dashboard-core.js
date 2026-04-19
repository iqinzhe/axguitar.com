// app-dashboard-core.js - 完整修复版 v4.0
// 修复内容：
// 1. 移除锁定/解锁订单相关的按钮和功能
// 2. 移除编辑订单相关的权限（员工/店长不能编辑）
// 3. 服务费宣传文本改为优惠说明（不写具体数字）
// 4. 统一使用异步权限检查
// 5. 修复 XSS 风险（动态属性转义）
// 6. sessionStorage 不再存储敏感信息

window.APP = window.APP || {};

const DashboardCore = {
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    saveCurrentPageState: function() {
        sessionStorage.setItem('jf_current_page', this.currentPage);
        sessionStorage.setItem('jf_current_filter', this.currentFilter || "all");
        sessionStorage.setItem('jf_current_keyword', this.searchKeyword || "");
    },
    
    restorePageState: function() {
        return {
            page: sessionStorage.getItem('jf_current_page'),
            filter: sessionStorage.getItem('jf_current_filter') || "all",
            keyword: sessionStorage.getItem('jf_current_keyword') || ""
        };
    },
    
    clearPageState: function() {
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_filter');
        sessionStorage.removeItem('jf_current_keyword');
        this.currentOrderId = null;
        this.currentCustomerId = null;
    },

    init: async function() {
        document.getElementById("app").innerHTML = '<div class="loading-container"><div class="loader"></div><p class="loading-text">🔄 Loading system...</p></div>';
        await AUTH.init();
        
        var savedState = this.restorePageState();
        var savedPage = savedState.page;
        var savedFilter = savedState.filter;
        var savedKeyword = savedState.keyword;
        
        if (savedPage && savedPage !== 'login' && AUTH.isLoggedIn()) {
            this.currentPage = savedPage;
            this.currentFilter = savedFilter || "all";
            this.searchKeyword = savedKeyword || "";
            this.currentOrderId = null;
            this.currentCustomerId = null;
            await this.refreshCurrentPage();
        } else {
            await this.router();
        }
    },

    router: async function() {
        if (!AUTH.isLoggedIn()) await this.renderLogin();
        else await this.renderDashboard();
    },

    refreshCurrentPage: async function() {
        var self = this;
        var handlers = {
            dashboard: async () => await self.renderDashboard(),
            orderTable: async () => await self.showOrderTable(),
            createOrder: () => self.showCreateOrder(),
            viewOrder: async () => { 
                if (self.currentOrderId) {
                    await self.viewOrder(self.currentOrderId);
                } else {
                    await self.showOrderTable();
                }
            },
            payment: async () => { 
                if (self.currentOrderId) {
                    await self.showPayment(self.currentOrderId);
                } else {
                    await self.showOrderTable();
                }
            },
            // 注意：editOrder 已移除，员工/店长不能编辑订单
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            expenses: async () => await self.showExpenses(),
            customers: async () => await self.showCustomers(),
            paymentHistory: async () => await self.showPaymentHistory(),
            customerOrders: async () => { 
                if (self.currentCustomerId) {
                    await self.showCustomerOrders(self.currentCustomerId);
                } else {
                    await self.showCustomers();
                }
            },
            customerPaymentHistory: async () => { 
                if (self.currentCustomerId) {
                    await self.showCustomerPaymentHistory(self.currentCustomerId);
                } else {
                    await self.showCustomers();
                }
            },
            blacklist: async () => await self.showBlacklist()
        };
        var handler = handlers[this.currentPage];
        if (handler) await handler();
        else await this.renderDashboard();
    },

    navigateTo: function(page, params) {
        params = params || {};
        this.historyStack.push({
            page: this.currentPage,
            orderId: this.currentOrderId,
            customerId: this.currentCustomerId,
            filter: this.currentFilter,
            keyword: this.searchKeyword
        });
        this.currentPage = page;
        
        if (params.orderId) this.currentOrderId = params.orderId;
        if (params.customerId) this.currentCustomerId = params.customerId;
        
        this.saveCurrentPageState();
        
        var self = this;
        var navHandlers = {
            orderTable: async () => await self.showOrderTable(),
            createOrder: () => self.showCreateOrder(),
            dashboard: async () => await self.renderDashboard(),
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            expenses: async () => await self.showExpenses(),
            customers: async () => await self.showCustomers(),
            paymentHistory: async () => await self.showPaymentHistory(),
            customerOrders: async () => { if (params.customerId) await self.showCustomerOrders(params.customerId); },
            customerPaymentHistory: async () => { if (params.customerId) await self.showCustomerPaymentHistory(params.customerId); },
            viewOrder: async () => { if (params.orderId) await self.viewOrder(params.orderId); },
            payment: async () => { if (params.orderId) await self.showPayment(params.orderId); },
            // 注意：editOrder 已移除
            blacklist: async () => await self.showBlacklist()
        };
        var handler = navHandlers[page];
        if (handler) handler();
        else this.renderDashboard();
    },

    goBack: function() {
        var self = this;
        if (this.historyStack.length > 0) {
            var prev = this.historyStack.pop();
            this.currentPage = prev.page;
            this.currentOrderId = prev.orderId;
            this.currentCustomerId = prev.customerId;
            this.currentFilter = prev.filter || "all";
            this.searchKeyword = prev.keyword || "";
            
            this.saveCurrentPageState();
            
            var backHandlers = {
                orderTable: async () => await self.showOrderTable(),
                dashboard: async () => await self.renderDashboard(),
                viewOrder: async () => { if (prev.orderId) await self.viewOrder(prev.orderId); },
                report: async () => await self.showReport(),
                userManagement: async () => await self.showUserManagement(),
                storeManagement: async () => await StoreManager.renderStoreManagement(),
                expenses: async () => await self.showExpenses(),
                customers: async () => await self.showCustomers(),
                paymentHistory: async () => await self.showPaymentHistory(),
                customerOrders: async () => { if (prev.customerId) await self.showCustomerOrders(prev.customerId); },
                customerPaymentHistory: async () => { if (prev.customerId) await self.showCustomerPaymentHistory(prev.customerId); },
                blacklist: async () => await self.showBlacklist()
            };
            var handler = backHandlers[prev.page];
            if (handler) handler();
            else this.renderDashboard();
        } else {
            this.renderDashboard();
        }
    },

    renderLogin: async function() {
        this.currentPage = 'login';
        this.clearPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        var storedLang = localStorage.getItem('jf_language');
        if (storedLang && (storedLang === 'id' || storedLang === 'zh')) {
            Utils.lang = storedLang;
            lang = Utils.lang;
        }
        
        document.getElementById("app").innerHTML = `
            <div class="login-container">
                <div class="login-box">
                    <div class="lang-toggle">
                        <button onclick="APP.toggleLanguageOnLogin()" class="lang-btn">🌐 ${lang === 'id' ? '中文' : 'Bahasa'}</button>
                    </div>
                    <h2 class="login-title"><img src="icons/pagehead-logo.png" alt="JF!" class="login-logo"> JF! by Gadai</h2>
                    <h3>${t('login')}</h3>
                    <div class="form-group">
                        <label>${Utils.lang === 'id' ? 'Email / Username' : '邮箱 / 用户名'}</label>
                        <input id="username" placeholder="email@domain.com">
                    </div>
                    <div class="form-group">
                        <label>${t('password')}</label>
                        <input id="password" type="password" placeholder="${t('password')}">
                    </div>
                    <button onclick="APP.login()">${t('login')}</button>
                    <p class="login-note">
                        ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}
                    </p>
                </div>
            </div>`;
    },

    login: async function() {
        var username = document.getElementById("username").value.trim();
        var password = document.getElementById("password").value;
        if (!username || !password) { alert(Utils.t('fill_all_fields')); return; }
        var btnEl = document.querySelector('#app button');
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }
        var user = await AUTH.login(username, password);
        if (!user) {
            alert(Utils.t('login_failed'));
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = Utils.t('login'); }
            return;
        }
        var savedLang = localStorage.getItem('jf_language');
        if (savedLang && (savedLang === 'id' || savedLang === 'zh')) {
            Utils.lang = savedLang;
        }
        await this.router();
    },

    logout: async function() {
        this.clearPageState();
        sessionStorage.clear();
        await AUTH.logout();
        await this.router();
    },

    toggleLanguage: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        if (this.currentPage === 'login' || !AUTH.isLoggedIn()) this.renderLogin();
        else this.refreshCurrentPage();
    },

    toggleLanguageOnLogin: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        this.renderLogin();
    },

    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        this.saveCurrentPageState();
        try {
            var report = await Order.getReport();
            var cashFlow = await SUPABASE.getCashFlowSummary();
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var storeName = AUTH.getCurrentStoreName();
            
            var needRemindOrders = await SUPABASE.getOrdersNeedReminder();
            var hasReminders = needRemindOrders.length > 0;
            var hasSentToday = await this.hasSentRemindersToday();
            
            var btnDisabled = hasSentToday;
            var btnHighlight = hasReminders && !hasSentToday;
            
            var totalExpenses = 0;
            try {
                let expenseQuery = supabaseClient.from('expenses').select('amount');
                if (!isAdmin && profile?.store_id) {
                    expenseQuery = expenseQuery.eq('store_id', profile.store_id);
                }
                const { data: expenses } = await expenseQuery;
                totalExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
            } catch(e) { console.warn("获取支出汇总失败:", e); }
            
            var cards = [
                { label: t('total_orders'), value: report.total_orders, type: 'number' },
                { label: t('total_loan'), value: Utils.formatCurrency(report.total_loan_amount), type: 'currency' },
                { label: t('active'), value: report.active_orders, type: 'number' },
                { label: t('completed'), value: report.completed_orders, type: 'number' },
                { label: lang === 'id' ? 'Admin Fee' : '管理费', value: Utils.formatCurrency(report.total_admin_fees), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Service Fee' : '服务费', value: Utils.formatCurrency(report.total_service_fees || 0), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Bunga Diterima' : '已收利息', value: Utils.formatCurrency(report.total_interest), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Total Pengeluaran' : '支出汇总', value: Utils.formatCurrency(totalExpenses), type: 'currency', class: 'expense' }
            ];
            
            var cardsHtml = cards.map(card => `
                <div class="stat-card ${card.class || ''}">
                    <div class="stat-value ${card.class || ''}">${card.value}</div>
                    <div class="stat-label">${card.label}</div>
                </div>
            `).join('');
            
            // 修复：服务费宣传文本改为优惠说明
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h1><img src="icons/pagehead-logo.png" alt="JF!" class="logo-img"> JF! by Gadai</h1>
                    <div class="header-actions">
                        ${this.historyStack.length > 0 ? `<button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>` : ''}
                    </div>
                </div>
                
                <div class="cashflow-summary">
                    <h3>💰 ${lang === 'id' ? '资金管理' : '资金管理'}</h3>
                    
                    ${isAdmin ? `
                    <div class="capital-summary">
                        <div class="capital-summary-text">
                            <span>💰 ${lang === 'id' ? 'Saldo Kas' : '现金余额'}:</span>
                            <strong>${Utils.formatCurrency(cashFlow.cash.balance)}</strong>
                            <span>🏧 ${lang === 'id' ? 'Saldo Bank' : '银行余额'}:</span>
                            <strong>${Utils.formatCurrency(cashFlow.bank.balance)}</strong>
                        </div>
                        <div>
                            <button onclick="APP.showCapitalModal()" class="capital-btn">🏦 ${lang === 'id' ? 'Riwayat Transaksi' : '资金流水'}</button>
                            <button onclick="APP.showInternalTransferHistory()" class="capital-btn" style="margin-left:8px;">🔄 ${lang === 'id' ? 'Riwayat Transfer' : '转账记录'}</button>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="cashflow-stats">
                        <div class="cashflow-item">
                            <div class="label">🏦 ${lang === 'id' ? '保险柜 (现金)' : '保险柜 (现金)'}</div>
                            <div class="value ${cashFlow.cash.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.cash.balance)}</div>
                            <div class="cashflow-detail">
                                ${lang === 'id' ? '收入' : '收入'}: +${Utils.formatCurrency(cashFlow.cash.income)}<br>
                                ${lang === 'id' ? '支出' : '支出'}: -${Utils.formatCurrency(cashFlow.cash.expense)}
                            </div>
                        </div>
                        
                        <div class="cashflow-item">
                            <div class="label">🏧 ${lang === 'id' ? '银行 BNI' : '银行 BNI'}</div>
                            <div class="value ${cashFlow.bank.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.bank.balance)}</div>
                            <div class="cashflow-detail">
                                ${lang === 'id' ? '收入' : '收入'}: +${Utils.formatCurrency(cashFlow.bank.income)}<br>
                                ${lang === 'id' ? '支出' : '支出'}: -${Utils.formatCurrency(cashFlow.bank.expense)}
                            </div>
                        </div>
                        
                        <div class="cashflow-item internal-transfer-item">
                            <div class="label">🔄 ${lang === 'id' ? '内部互转' : '内部互转'}</div>
                            <div class="transfer-buttons">
                                <button onclick="APP.showTransferModal('cash_to_bank')" class="transfer-btn cash-to-bank">
                                    🏦→🏧 ${lang === 'id' ? '现金存入银行' : '现金存入银行'}
                                </button>
                                <button onclick="APP.showTransferModal('bank_to_cash')" class="transfer-btn bank-to-cash">
                                    🏧→🏦 ${lang === 'id' ? '银行取出现金' : '银行取出现金'}
                                </button>
                                ${isAdmin ? `
                                <button onclick="APP.showTransferModal('store_to_hq')" class="transfer-btn store-to-hq">
                                    🏢 ${lang === 'id' ? '上缴总部' : '上缴总部'}
                                </button>
                                ` : ''}
                            </div>
                            <div class="cashflow-detail" style="margin-top:8px;">
                                💡 ${lang === 'id' ? '保险柜现金过多时可存入银行，不足时可从银行提取' : '保险柜现金过多时可存入银行，不足时可从银行提取'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-grid-optimized">
                    ${cardsHtml}
                </div>
                
/* =====================================================
   base.css - 布局优化版 v2.0
   修改内容：
   1. 电脑端：资金管理栏固定1行3列，仪表板栏固定4列2行
   2. 电脑端：工具栏按钮网格布局（管理员5列2行，门店6列1行）
   3. 手机端：资金管理栏单列，仪表板栏2列4行
   4. 手机端：工具栏按钮网格布局，所有字体缩小1号
   5. 底部信息栏文字整体缩小
   ===================================================== */

/* ---------- 1. 全局变量 ---------- */
:root {
    --primary: #2563eb;
    --primary-light: #60a5fa;
    --primary-soft: #dbeafe;
    --primary-dark: #1d4ed8;
    --success: #10b981;
    --success-dark: #059669;
    --success-light: #ecfdf5;
    --warning: #f59e0b;
    --warning-dark: #d97706;
    --warning-light: #fffbeb;
    --danger: #ef4444;
    --danger-dark: #dc2626;
    --danger-light: #fef2f2;
    --gray-50: #f8fafc;
    --gray-100: #f1f5f9;
    --gray-200: #e2e8f0;
    --gray-300: #cbd5e1;
    --gray-400: #94a3b8;
    --gray-500: #64748b;
    --gray-600: #475569;
    --gray-700: #334155;
    --gray-800: #1e293b;
    --gray-900: #0f172a;
    --font-xxs: 0.7rem;
    --font-xs: 0.8rem;
    --font-sm: 0.9rem;
    --font-md: 1rem;
    --font-lg: 1.125rem;
    --font-xl: 1.25rem;
    --font-2xl: 1.35rem;
    --spacing-1: 4px;
    --spacing-2: 8px;
    --spacing-3: 12px;
    --spacing-4: 16px;
    --spacing-5: 20px;
    --spacing-6: 24px;
    --spacing-7: 28px;
    --spacing-8: 32px;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
    --radius-2xl: 20px;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    --transition: all 0.2s ease;
}

/* ---------- 2. 重置与基础 ---------- */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
}

body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif;
    background: var(--gray-50);
    color: var(--gray-800);
    line-height: 1.5;
}

/* ---------- 3. Logo 图片统一大小 ---------- */
h1 img,
.page-header h1 img {
    height: 32px;
    width: auto;
    vertical-align: middle;
}

.login-logo {
    height: 32px;
    width: auto;
    vertical-align: middle;
}

@media (max-width: 480px) {
    h1 img,
    .page-header h2 img,
    h2 img {
        height: 24px;
    }
}

/* ---------- 4. 布局容器 ---------- */
#app {
    max-width: 1400px;
    margin: 0 auto;
    padding: var(--spacing-5);
    background: var(--gray-50);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--spacing-4);
}

/* ---------- 5. 卡片组件 ---------- */
.card {
    background: white;
    border-radius: var(--radius-lg);
    border: 1px solid var(--gray-200);
    box-shadow: var(--shadow-sm);
    padding: var(--spacing-5);
    transition: var(--transition);
    margin-bottom: var(--spacing-5);
}

.card:hover {
    box-shadow: var(--shadow-md);
}

.card h3 {
    font-size: var(--font-md);
    margin-bottom: var(--spacing-4);
    color: var(--gray-800);
    padding-bottom: var(--spacing-2);
    border-bottom: 1px solid var(--gray-200);
}

/* ---------- 6. 页面头部 ---------- */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-5);
    flex-wrap: wrap;
    gap: var(--spacing-3);
}

.page-header h1,
.page-header h2 {
    margin: 0;
    font-size: var(--font-xl);
    font-weight: 600;
}

.header-actions {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    align-items: center;
}

/* =====================================================
   按钮样式
   ===================================================== */

/* 基础按钮样式 */
button {
    padding: var(--spacing-2) var(--spacing-4);
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    font-size: var(--font-xs);
    font-weight: 500;
    cursor: pointer;
    transition: var(--transition);
    background: var(--gray-100);
    color: var(--gray-700);
}

button:hover {
    background: var(--gray-200);
    transform: translateY(-1px);
}

button:active {
    transform: translateY(0);
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

/* 小按钮 */
.btn-small {
    padding: 4px 10px;
    font-size: 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--gray-100);
    border: 1px solid var(--gray-200);
}

.btn-small:hover {
    background: var(--gray-200);
}

/* 返回按钮 */
.btn-back {
    background: var(--gray-100);
    border: 1px solid var(--gray-200);
    color: var(--gray-600);
}

.btn-back:hover {
    background: var(--gray-200);
    color: var(--gray-700);
}

/* 打印按钮 */
.btn-print {
    background: var(--gray-600);
    color: white;
}

.btn-print:hover {
    background: var(--gray-700);
}

/* 导出按钮 */
.btn-export {
    background: var(--success);
    color: white;
}

.btn-export:hover {
    background: var(--success-dark);
}

/* 平账按钮 */
.btn-balance {
    background: var(--warning);
    color: white;
}

.btn-balance:hover {
    background: var(--warning-dark);
}

/* 详情按钮 */
.btn-detail {
    background: var(--primary);
    color: white;
}

.btn-detail:hover {
    background: var(--primary-dark);
}

/* 成功按钮（绿色） */
button.success,
.btn-success {
    background: var(--success);
    color: white;
}

button.success:hover,
.btn-success:hover {
    background: var(--success-dark);
}

/* 警告按钮（橙色） */
button.warning,
.btn-warning {
    background: var(--warning);
    color: white;
}

button.warning:hover,
.btn-warning:hover {
    background: var(--warning-dark);
}

/* 危险按钮（红色） */
button.danger,
.btn-danger {
    background: var(--danger);
    color: white;
}

button.danger:hover,
.btn-danger:hover {
    background: var(--danger-dark);
}

/* 高亮提醒按钮 */
.warning.highlight {
    background: var(--warning);
    color: white;
    box-shadow: 0 0 0 2px var(--warning-light);
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--warning-light); }
    50% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3); }
}

/* 资金管理按钮 */
.capital-btn {
    background: var(--primary);
    color: white;
    padding: var(--spacing-2) var(--spacing-4);
    font-size: var(--font-xs);
}

.capital-btn:hover {
    background: var(--primary-dark);
}

/* 转账按钮 */
.transfer-btn {
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-xs);
    border-radius: var(--radius-md);
    background: var(--gray-100);
    border: 1px solid var(--gray-200);
}

.transfer-btn.cash-to-bank {
    background: #e0f2fe;
    color: #0369a1;
    border-color: #7dd3fc;
}

.transfer-btn.bank-to-cash {
    background: #fef3c7;
    color: #b45309;
    border-color: #fde68a;
}

.transfer-btn.store-to-hq {
    background: #f1f5f9;
    color: #475569;
    border-color: #cbd5e1;
}

.transfer-btn:hover {
    transform: translateY(-1px);
}

/* 缴费操作按钮 */
.btn-action {
    padding: 12px 20px;
    font-size: var(--font-sm);
    width: 100%;
    margin-top: var(--spacing-3);
}

/* =====================================================
   统计卡片网格 - 电脑端：固定4列2行
   ===================================================== */

.stats-grid-optimized {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-5);
}

.stat-card {
    background: white;
    border-radius: var(--radius-lg);
    border: 1px solid var(--gray-200);
    padding: var(--spacing-2) var(--spacing-2);
    text-align: center;
    transition: var(--transition);
}

.stat-card:hover {
    box-shadow: var(--shadow-md);
}

.stat-value {
    font-size: var(--font-md);
    font-weight: 700;
    margin-bottom: var(--spacing-1);
    color: var(--gray-800);
}

.stat-value.income {
    color: var(--success);
}

.stat-value.expense {
    color: var(--danger);
}

.stat-label {
    font-size: var(--font-xs);
    color: var(--gray-500);
    font-weight: 500;
}

/* 统计网格（用于报表页） */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-5);
}

/* =====================================================
   cashflow区块样式 - 电脑端：固定1行3列
   ===================================================== */

.cashflow-summary {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border-radius: var(--radius-xl);
    padding: var(--spacing-5);
    margin-bottom: var(--spacing-5);
    color: white;
}

.cashflow-summary h3 {
    color: white;
    border-bottom-color: rgba(255, 255, 255, 0.2);
    margin-bottom: var(--spacing-4);
}

.cashflow-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-4);
}

.cashflow-item {
    background: rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3) var(--spacing-4);
    backdrop-filter: blur(4px);
}

.cashflow-item .label {
    font-size: var(--font-xs);
    opacity: 0.8;
    margin-bottom: var(--spacing-2);
}

.cashflow-item .value {
    font-size: var(--font-lg);
    font-weight: 700;
}

.cashflow-item .value.negative {
    color: #f87171;
}

.cashflow-detail {
    font-size: 0.7rem;
    opacity: 0.7;
    margin-top: var(--spacing-2);
    line-height: 1.4;
}

/* 内部转账区块 */
.internal-transfer-item {
    grid-column: span 1;
}

.transfer-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-2);
}

/* 资金汇总区块（用于报表页轻量版） */
.cashflow-summary.light {
    background: white;
    border: 1px solid var(--gray-200);
    color: var(--gray-800);
}

.cashflow-summary.light h3 {
    color: var(--gray-800);
    border-bottom-color: var(--gray-200);
}

.cashflow-summary.light .cashflow-item {
    background: var(--gray-50);
}

/* =====================================================
   工具栏 - 电脑端网格布局
   管理员：5列2行（共10个按钮）
   门店：6列1行（共6个按钮）
   注：网格列数由 JS 动态添加类名控制，CSS 提供基础样式
   ===================================================== */

.toolbar {
    display: grid;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-5);
    padding: var(--spacing-3);
    background: white;
    border-radius: var(--radius-md);
    border: 1px solid var(--gray-200);
}

/* 管理员视图：5列2行 */
.toolbar.admin-grid {
    grid-template-columns: repeat(5, 1fr);
}

/* 门店视图：6列1行 */
.toolbar.store-grid {
    grid-template-columns: repeat(6, 1fr);
}

.toolbar button {
    width: 100%;
    text-align: center;
    white-space: nowrap;
}

.toolbar input,
.toolbar select {
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--gray-300);
    font-size: var(--font-sm);
}

/* =====================================================
   底部信息栏 - 文字整体缩小
   ===================================================== */
.card p:last-child,
.card .info-note,
.footer-note {
    font-size: var(--font-xxs);
    color: var(--gray-500);
}

/* =====================================================
   表格样式
   ===================================================== */

table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-xs);
}

th, td {
    padding: 10px 10px;
    border-bottom: 1px solid var(--gray-200);
    text-align: left;
    vertical-align: middle;
}

th {
    font-weight: 600;
    background: var(--gray-50);
    color: var(--gray-700);
    border-bottom: 1px solid var(--gray-300);
    white-space: nowrap;
}

tbody tr:hover {
    background: var(--gray-50);
}

.table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: var(--spacing-3) 0;
}

.action-cell {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
}

.status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 500;
}

.status-active {
    background: var(--success-light);
    color: var(--success-dark);
}

.status-completed {
    background: var(--gray-100);
    color: var(--gray-600);
}

.status-liquidated {
    background: var(--danger-light);
    color: var(--danger-dark);
}

.payment-method-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 500;
}

.method-cash {
    background: #e0f2fe;
    color: #0369a1;
}

.method-bank {
    background: #fef3c7;
    color: #b45309;
}

.order-id {
    font-family: monospace;
    font-weight: 600;
    color: var(--primary-dark);
}

.customer-table th,
.customer-table td {
    padding: 8px 6px;
}

.payment-table th,
.payment-table td {
    padding: 8px 10px;
}

.data-table {
    font-size: 0.75rem;
}

.data-table th {
    background: var(--gray-100);
    font-weight: 600;
}

.report-store-section {
    margin-bottom: var(--spacing-5);
    border: 1px solid var(--gray-200);
    border-radius: var(--radius-lg);
    overflow: hidden;
}

.report-store-header {
    background: var(--primary);
    color: white;
    padding: var(--spacing-3) var(--spacing-4);
    font-weight: 600;
}

.report-store-stats {
    padding: var(--spacing-4);
    background: white;
}

.report-grid-5x2 {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-3);
}

.report-store-stat .label {
    font-size: 0.7rem;
    color: var(--gray-500);
    margin-bottom: 4px;
}

.report-store-stat .value {
    font-size: var(--font-sm);
    font-weight: 600;
}

.report-store-stat .value.income {
    color: var(--success);
}

.report-store-stat .value.expense {
    color: var(--danger);
}

.grand-total-card {
    background: linear-gradient(135deg, var(--primary-soft) 0%, white 100%);
    margin-bottom: var(--spacing-5);
}

/* =====================================================
   缺失业务样式（补充）
   ===================================================== */

.store-info-banner {
    background: var(--primary-soft);
    border-radius: var(--radius-md);
    padding: var(--spacing-3) var(--spacing-4);
    margin: var(--spacing-4) 0;
    font-size: var(--font-xs);
    color: var(--primary-dark);
    text-align: center;
}

.two-col-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-4);
}

.customer-info-display {
    background: var(--gray-50);
    border-radius: var(--radius-md);
    padding: var(--spacing-4);
    margin-bottom: var(--spacing-5);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: var(--spacing-2);
}

.customer-info-display p {
    margin: 0;
    font-size: var(--font-xs);
}

.address-option {
    display: flex;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-2);
}

.address-option label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: normal;
    cursor: pointer;
}

.fee-section {
    background: var(--gray-50);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    margin-bottom: var(--spacing-4);
}

.fee-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
}

.fee-select {
    width: auto !important;
    min-width: 120px;
}

.fee-display {
    background: var(--success-light);
    border-radius: var(--radius-md);
    padding: var(--spacing-2) var(--spacing-3);
    font-size: var(--font-xs);
    color: var(--success-dark);
    font-weight: 500;
}

.reconciled-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 500;
    background: var(--success-light);
    color: var(--success-dark);
}

.locked-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 500;
    background: var(--gray-200);
    color: var(--gray-600);
}

.total-expense {
    color: var(--danger);
    font-weight: 700;
}

/* =====================================================
   表单组件
   ===================================================== */
.form-group {
    margin-bottom: var(--spacing-4);
}

.form-group label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--gray-600);
}

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--gray-300);
    font-family: inherit;
    font-size: var(--font-sm);
    transition: var(--transition);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-4);
}

.form-grid .full-width {
    grid-column: span 2;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    margin-top: var(--spacing-4);
}

/* =====================================================
   模态框
   ===================================================== */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-5);
}

.modal-content {
    background: white;
    border-radius: var(--radius-lg);
    padding: var(--spacing-6);
    width: 100%;
    max-width: 550px;
    max-height: 85vh;
    overflow-y: auto;
}

.modal-content h3 {
    font-size: var(--font-lg);
    margin-bottom: var(--spacing-4);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    margin-top: var(--spacing-5);
}

/* =====================================================
   登录页面
   ===================================================== */
.login-container {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary-soft), var(--gray-50));
}

.login-box {
    width: 320px;
    max-width: 90%;
    background: white;
    padding: var(--spacing-6);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
}

.login-title {
    font-size: 1.25rem;
    margin-bottom: var(--spacing-5);
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex-wrap: nowrap;
    white-space: nowrap;
}

.lang-toggle {
    text-align: right;
    margin-bottom: var(--spacing-3);
}

.lang-btn {
    background: transparent;
    color: var(--primary);
    border: 1px solid var(--gray-200);
    padding: 4px 12px;
    font-size: var(--font-xs);
}

.lang-btn:hover {
    background: var(--primary-soft);
    transform: none;
}

.login-note {
    margin-top: var(--spacing-4);
    font-size: var(--font-xs);
    color: var(--gray-400);
    text-align: center;
}

@media (max-width: 400px) {
    .login-title {
        font-size: 1.1rem;
        gap: 4px;
    }
    .login-logo {
        height: 20px;
    }
}

/* =====================================================
   加载动画
   ===================================================== */
.loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: var(--gray-50);
}

.loader {
    width: 40px;
    height: 40px;
    border: 3px solid var(--gray-200);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.loading-text {
    color: var(--gray-500);
    margin-top: var(--spacing-4);
    font-size: var(--font-sm);
}

/* =====================================================
   错误页面
   ===================================================== */
.error-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: var(--gray-50);
    padding: var(--spacing-5);
}

.error-card {
    max-width: 400px;
    background: white;
    border-radius: var(--radius-xl);
    padding: var(--spacing-8);
    text-align: center;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--gray-200);
}

.error-icon {
    font-size: var(--font-2xl);
    margin-bottom: var(--spacing-4);
}

.error-title {
    color: var(--danger);
    margin-bottom: var(--spacing-2);
    font-size: var(--font-lg);
}

.error-message {
    color: var(--gray-500);
    margin-bottom: var(--spacing-5);
    font-size: var(--font-sm);
}

.error-btn {
    background: var(--primary);
    color: white;
    padding: var(--spacing-2) var(--spacing-6);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--font-sm);
    border: none;
}

/* =====================================================
   工具类
   ===================================================== */
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-left { text-align: left; }
.text-muted { color: var(--gray-400); }
.text-warning { color: var(--warning); }
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }

.mt-1 { margin-top: var(--spacing-1); }
.mt-2 { margin-top: var(--spacing-2); }
.mt-3 { margin-top: var(--spacing-3); }
.mt-4 { margin-top: var(--spacing-4); }
.mb-1 { margin-bottom: var(--spacing-1); }
.mb-2 { margin-bottom: var(--spacing-2); }
.mb-3 { margin-bottom: var(--spacing-3); }
.mb-4 { margin-bottom: var(--spacing-4); }

.income { color: var(--success); }
.expense { color: var(--danger); }

/* =====================================================
   缴费页面专用样式
   ===================================================== */
.summary-card {
    background: var(--gray-50);
    margin-bottom: var(--spacing-4);
}

.summary-table {
    width: 100%;
    border-collapse: collapse;
}

.summary-table td {
    padding: 8px 12px;
    border: none;
}

.summary-table td.label {
    font-weight: 600;
    color: var(--gray-600);
    width: 110px;
    background: var(--gray-100);
    white-space: nowrap;
}

.summary-table td.value {
    color: var(--gray-800);
}

.summary-table td.order-id {
    font-family: monospace;
    font-weight: 700;
    color: var(--primary-dark);
}

.summary-table tr.divider td {
    border-top: 1px solid var(--gray-200);
    padding: 0;
    height: 1px;
}

.summary-table tr.paid-row td {
    background: var(--success-light);
    font-weight: 500;
}

.summary-note {
    font-size: 0.7rem;
    color: var(--gray-500);
    margin-top: var(--spacing-3);
    padding-top: var(--spacing-2);
    border-top: 1px solid var(--gray-200);
}

.action-card {
    margin-bottom: var(--spacing-5);
}

.action-card .card-header {
    margin-bottom: var(--spacing-4);
}

.action-card .card-header h3 {
    margin-bottom: 0;
    border-bottom: none;
}

.action-card .card-body {
    margin-bottom: var(--spacing-4);
}

.info-box {
    background: var(--primary-soft);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    margin-bottom: var(--spacing-4);
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-2);
}

.info-box.warning-box {
    background: var(--warning-light);
}

.info-box strong {
    font-weight: 700;
    color: var(--primary-dark);
}

.action-input-group {
    margin-bottom: var(--spacing-4);
}

.action-label {
    display: block;
    margin-bottom: var(--spacing-2);
    font-weight: 500;
    color: var(--gray-600);
}

.action-select {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--gray-300);
    font-size: var(--font-sm);
}

.action-input {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--gray-300);
    font-size: var(--font-sm);
}

.payment-method-group {
    margin-bottom: var(--spacing-4);
}

.payment-method-title {
    font-weight: 500;
    color: var(--gray-600);
    margin-bottom: var(--spacing-2);
}

.payment-method-options {
    display: flex;
    gap: var(--spacing-4);
    flex-wrap: wrap;
}

.payment-method-options label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    padding: var(--spacing-2) 0;
}

.card-history {
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-4);
    border-top: 1px solid var(--gray-200);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.history-title {
    font-weight: 600;
    margin-bottom: var(--spacing-3);
    color: var(--gray-700);
}

.history-table {
    width: 100%;
    font-size: 0.75rem;
    min-width: 400px;
}

.history-table th,
.history-table td {
    padding: 8px 10px;
    white-space: nowrap;
}

/* =====================================================
   响应式断点 — 平板端（≤1024px）
   ===================================================== */
@media (max-width: 1024px) {
    #app {
        padding: var(--spacing-4);
    }
}

/* =====================================================
   响应式断点 — 手机端（≤768px）
   ===================================================== */
@media (max-width: 768px) {

    /* --- 布局 --- */
    #app {
        padding: var(--spacing-2) var(--spacing-3);
    }

    .card {
        padding: var(--spacing-3);
    }

    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .header-actions {
        width: 100%;
        justify-content: flex-end;
    }

    /* 手机端：所有字体缩小1号 */
    body, .card, button, .stat-value, .stat-label, .toolbar button {
        font-size: 0.85rem;
    }

    /* --- 资金管理栏：单列 --- */
    .cashflow-stats {
        grid-template-columns: 1fr;
        gap: var(--spacing-2);
    }

    .cashflow-item {
        padding: var(--spacing-2) var(--spacing-3);
    }

    .cashflow-item .value {
        font-size: var(--font-md);
    }

    /* --- 仪表板栏：2列4行 --- */
    .stats-grid-optimized {
        grid-template-columns: repeat(2, 1fr);
        gap: var(--spacing-2);
    }

    .stat-card {
        padding: var(--spacing-2);
    }

    .stat-value {
        font-size: var(--font-sm);
    }

    .stat-label {
        font-size: 0.7rem;
    }

    /* --- 工具栏：手机端网格布局 --- */
    .toolbar {
        gap: var(--spacing-2);
        padding: var(--spacing-2);
    }

    /* 管理员视图：2列5行 */
    .toolbar.admin-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    /* 门店视图：3列2行 */
    .toolbar.store-grid {
        grid-template-columns: repeat(3, 1fr);
    }

    .toolbar button {
        font-size: 0.75rem;
        padding: var(--spacing-2);
        min-height: 44px;
        white-space: normal;
        word-break: break-word;
    }

    /* 工具栏输入框 */
    .toolbar input,
    .toolbar select {
        font-size: 0.8rem;
        padding: var(--spacing-2);
    }

    /* 底部信息栏：文字再缩小一号 */
    .card p:last-child,
    .card .info-note,
    .footer-note,
    .summary-note {
        font-size: 0.65rem;
    }

    /* --- 双列网格 → 单列 --- */
    .two-col-grid {
        grid-template-columns: 1fr;
    }

    /* --- 表单 --- */
    .form-grid {
        grid-template-columns: 1fr;
    }

    .form-grid .full-width {
        grid-column: span 1;
    }

    .form-actions {
        flex-direction: column;
    }

    .form-actions button {
        width: 100%;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        padding: 12px var(--spacing-3);
        font-size: 0.9rem;
    }

    /* 按钮最小触摸高度 */
    button {
        min-height: 44px;
    }

    .btn-small {
        min-height: 36px;
    }

    .btn-action {
        min-height: 48px;
        font-size: var(--font-sm);
        padding: 14px 20px;
    }

    /* --- 模态框 --- */
    .modal-overlay {
        padding: var(--spacing-3);
        align-items: flex-start;
    }

    .modal-content {
        margin-top: 10vh;
        padding: var(--spacing-4);
        max-width: calc(100% - 32px);
        max-height: 75vh;
    }

    .modal-actions {
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .modal-actions button {
        width: 100%;
        min-height: 44px;
        padding: 12px;
    }

    /* 转账按钮手机端 */
    .transfer-buttons {
        flex-direction: column;
    }

    .transfer-btn {
        width: 100%;
        text-align: center;
        min-height: 44px;
    }

    /* 操作列按钮组 */
    .action-cell {
        flex-wrap: wrap;
    }

    /* 缴费页面手机端适配 */
    .summary-table,
    .summary-table tbody,
    .summary-table tr,
    .summary-table td {
        display: block;
        width: 100%;
    }

    .summary-table tr.divider {
        display: none;
    }

    .summary-table tr {
        display: flex;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--gray-200);
        padding: var(--spacing-1) 0;
    }

    .summary-table tr:last-child {
        border-bottom: none;
    }

    .summary-table td.label {
        width: 40%;
        min-width: 90px;
        font-size: 0.7rem;
        padding: 6px 8px;
    }

    .summary-table td.value {
        width: 60%;
        font-size: 0.7rem;
        padding: 6px 8px;
        word-break: break-all;
    }

    .summary-table tr.paid-row {
        background: var(--success-light);
        border-radius: var(--radius-sm);
    }

    .info-box {
        flex-direction: column;
        gap: var(--spacing-1);
    }

    .info-box span {
        font-size: 0.7rem;
    }

    th {
        white-space: nowrap;
    }

    td {
        white-space: normal;
        word-break: break-word;
    }

    .history-table th,
    .history-table td {
        white-space: nowrap;
    }
}

/* =====================================================
   响应式断点 — 超小屏（≤390px，如 iPhone SE）
   ===================================================== */
@media (max-width: 390px) {

    #app {
        padding: var(--spacing-2);
    }

    .card {
        padding: var(--spacing-2);
        border-radius: var(--radius-md);
    }

    .page-header h1,
    .page-header h2 {
        font-size: var(--font-md);
    }

    .stats-grid-optimized {
        gap: var(--spacing-1);
    }

    .stat-value {
        font-size: 0.75rem;
    }

    .stat-label {
        font-size: 0.65rem;
    }

    .summary-table td.label {
        width: 45%;
        font-size: 0.65rem;
    }

    .summary-table td.value {
        width: 55%;
        font-size: 0.65rem;
    }

    .btn-action {
        font-size: 0.8rem;
    }

    .login-box {
        padding: var(--spacing-4);
    }

    .toolbar button {
        font-size: 0.7rem;
        padding: var(--spacing-1);
    }
}

/* =====================================================
   打印样式
   ===================================================== */
@media print {
    @page {
        size: A4;
        margin: 15mm 12mm;
    }

    body {
        background: white;
        padding: 0;
        margin: 0;
        font-size: 12pt;
    }

    #app {
        max-width: 100%;
        padding: 0;
        margin: 0;
    }

    .no-print,
    .toolbar button:not(.print-btn),
    button:not(.print-btn),
    .btn-back,
    .btn-export,
    .btn-balance,
    .btn-detail,
    .modal-overlay {
        display: none !important;
    }

    .toolbar {
        display: block !important;
    }

    .print-btn {
        display: inline-block !important;
    }

    .card,
    .stat-card,
    .cashflow-summary {
        border: 1px solid #ccc !important;
        box-shadow: none !important;
        background: white !important;
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .cashflow-summary {
        background: white !important;
        color: black !important;
    }

    .cashflow-summary h3 {
        color: black !important;
        border-bottom-color: #ccc !important;
    }

    .cashflow-item {
        background: #f5f5f5 !important;
        color: black !important;
    }

    thead {
        display: table-header-group;
    }

    table {
        page-break-inside: avoid;
    }

    th, td {
        border: 1px solid #ccc !important;
        white-space: normal !important;
    }
}
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p>⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    showCapitalModal: async function() {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        var stores = await SUPABASE.getAllStores();
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        var currentStoreId = profile?.store_id;
        
        var transactions = [];
        try {
            transactions = await SUPABASE.getCashFlowRecords();
        } catch(e) { console.error(e); }
        
        var transactionRows = '';
        if (transactions.length === 0) {
            transactionRows = `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Belum ada transaksi' : '暂无资金流水'}</td></tr>`;
        } else {
            var typeMap = {
                loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
                admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
                service_fee: lang === 'id' ? '💼 Service Fee' : '💼 服务费',
                interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
                principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
                expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
                investment: lang === 'id' ? '💰 Investasi' : '💰 注资',
                withdrawal: lang === 'id' ? '📤 Penarikan' : '📤 提现',
                internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
                internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
            };
            
            for (var txn of transactions) {
                var directionText = txn.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出');
                var directionClass = txn.direction === 'inflow' ? 'income' : 'expense';
                var methodText = txn.source_target === 'cash' ? '🏦 Tunai' : '🏧 Bank';
                
                transactionRows += `<tr>
                    <td style="padding:8px; white-space:nowrap;">${Utils.formatDate(txn.recorded_at)}</td>
                    <td style="padding:8px;">${typeMap[txn.flow_type] || txn.flow_type}</td>
                    <td style="padding:8px;">${methodText}</td>
                    <td style="padding:8px;">${directionText}</td>
                    <td style="padding:8px; text-align:right;" class="${directionClass}">${Utils.formatCurrency(txn.amount)}</td>
                    <td style="padding:8px; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${Utils.escapeHtml(txn.description || '-')}</td>
                    <td style="padding:8px; text-align:center; font-size:11px;">${txn.orders?.order_id ? Utils.escapeHtml(txn.orders.order_id) : '-'}</td>
                　　　`;
            }
        }
        
        var storeOptions = '<option value="all">' + (lang === 'id' ? 'Semua Toko' : '全部门店') + '</option>';
        for (var store of stores) {
            if (!isAdmin && store.id !== currentStoreId) continue;
            storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)}</option>`;
        }
        
        var modalHtml = `
            <div class="modal-content" style="max-width:1000px; max-height:85vh; overflow-y:auto;">
                <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="margin:0;">🏦 ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</h3>
                    <div style="display:flex; gap:8px;">
                        <button onclick="APP.printCapitalTransactions()" class="btn-small print-btn" style="background:#64748b; color:white;">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.exportCapitalTransactionsToCSV()" class="btn-small" style="background:#10b981; color:white;">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="document.getElementById('capitalModal').remove()" style="background:transparent; color:#64748b; font-size:20px; border:none; cursor:pointer;">✖</button>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
                    <select id="filterStore" style="width:auto; min-width:150px;">
                        ${storeOptions}
                    </select>
                    <select id="filterType" style="width:auto; min-width:120px;">
                        <option value="all">${lang === 'id' ? 'Semua Tipe' : '全部类型'}</option>
                        <option value="loan_disbursement">💰 ${lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放'}</option>
                        <option value="admin_fee">📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</option>
                        <option value="service_fee">💼 ${lang === 'id' ? 'Service Fee' : '服务费'}</option>
                        <option value="interest">📈 ${lang === 'id' ? 'Bunga' : '利息'}</option>
                        <option value="principal">🏦 ${lang === 'id' ? 'Pokok' : '本金'}</option>
                        <option value="expense">📝 ${lang === 'id' ? 'Pengeluaran' : '运营支出'}</option>
                    </select>
                    <select id="filterDirection" style="width:auto; min-width:100px;">
                        <option value="all">${lang === 'id' ? 'Semua Arah' : '全部方向'}</option>
                        <option value="inflow">📈 ${lang === 'id' ? 'Masuk' : '流入'}</option>
                        <option value="outflow">📉 ${lang === 'id' ? 'Keluar' : '流出'}</option>
                    </select>
                    <input type="date" id="filterDateStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}" style="width:auto;">
                    <input type="date" id="filterDateEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}" style="width:auto;">
                    <button onclick="APP.filterCapitalTransactions()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                    <button onclick="APP.resetCapitalFilters()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                </div>
                
                <div class="table-container" style="max-height:450px; overflow-y:auto;" id="capitalTransactionsTable">
                    <table class="data-table" style="width:100%; font-size:13px; border-collapse:collapse;">
                        <thead style="position:sticky; top:0; background:#f1f5f9;">
                            <tr>
                                <th style="padding:8px;">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th style="padding:8px;">${lang === 'id' ? 'Tipe' : '类型'}</th>
                                <th style="padding:8px;">${lang === 'id' ? 'Metode' : '方式'}</th>
                                <th style="padding:8px;">${lang === 'id' ? 'Arah' : '方向'}</th>
                                <th style="padding:8px; text-align:right;">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th style="padding:8px;">${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                <th style="padding:8px;">${lang === 'id' ? 'ID Pesanan' : '订单号'}</th>
                            </tr>
                        </thead>
                        <tbody id="capitalTransactionsBody">
                            ${transactionRows}
                        </tbody>
                    </table>
                </div>
                
                <div class="modal-actions" style="display:flex; justify-content:space-between; margin-top:16px;">
                    <div>
                        <span style="font-size:12px; color:#64748b;">📋 ${lang === 'id' ? 'Total' : '总计'}: <span id="totalAmount">${Utils.formatCurrency(transactions.reduce((s, t) => s + t.amount, 0))}</span></span>
                    </div>
                    <button onclick="document.getElementById('capitalModal').remove()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
                </div>
            </div>
        `;
        
        var modal = document.createElement('div');
        modal.id = 'capitalModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        window._capitalTransactionsData = transactions;
    },

    filterCapitalTransactions: function() {
        var storeId = document.getElementById('filterStore')?.value;
        var type = document.getElementById('filterType')?.value;
        var direction = document.getElementById('filterDirection')?.value;
        var dateStart = document.getElementById('filterDateStart')?.value;
        var dateEnd = document.getElementById('filterDateEnd')?.value;
        
        var transactions = window._capitalTransactionsData || [];
        
        var filtered = transactions.filter(function(txn) {
            if (storeId && storeId !== 'all' && txn.store_id !== storeId) return false;
            if (type && type !== 'all' && txn.flow_type !== type) return false;
            if (direction && direction !== 'all' && txn.direction !== direction) return false;
            if (dateStart && txn.recorded_at < dateStart) return false;
            if (dateEnd && txn.recorded_at > dateEnd) return false;
            return true;
        });
        
        this._renderCapitalTransactionsTable(filtered);
    },
    
    resetCapitalFilters: function() {
        var filterStore = document.getElementById('filterStore');
        var filterType = document.getElementById('filterType');
        var filterDirection = document.getElementById('filterDirection');
        var filterDateStart = document.getElementById('filterDateStart');
        var filterDateEnd = document.getElementById('filterDateEnd');
        
        if (filterStore) filterStore.value = 'all';
        if (filterType) filterType.value = 'all';
        if (filterDirection) filterDirection.value = 'all';
        if (filterDateStart) filterDateStart.value = '';
        if (filterDateEnd) filterDateEnd.value = '';
        
        this.filterCapitalTransactions();
    },
    
    _renderCapitalTransactionsTable: function(transactions) {
        var lang = Utils.lang;
        var tbody = document.getElementById('capitalTransactionsBody');
        if (!tbody) return;
        
        var typeMap = {
            loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
            admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
            service_fee: lang === 'id' ? '💼 Service Fee' : '💼 服务费',
            interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
            principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
            expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
            investment: lang === 'id' ? '💰 Investasi' : '💰 注资',
            withdrawal: lang === 'id' ? '📤 Penarikan' : '📤 提现',
            internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
            internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
        };
        
        var totalAmount = 0;
        var rows = '';
        
        for (var txn of transactions) {
            totalAmount += txn.amount;
            
            var directionText = txn.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出');
            var directionClass = txn.direction === 'inflow' ? 'income' : 'expense';
            var methodText = txn.source_target === 'cash' ? '🏦 Tunai' : '🏧 Bank';
            
            rows += `<tr>
                <td style="padding:8px; white-space:nowrap;">${Utils.formatDate(txn.recorded_at)}</td>
                <td style="padding:8px;">${typeMap[txn.flow_type] || txn.flow_type}</td>
                <td style="padding:8px;">${methodText}</td>
                <td style="padding:8px;">${directionText}</td>
                <td style="padding:8px; text-align:right;" class="${directionClass}">${Utils.formatCurrency(txn.amount)}</td>
                <td style="padding:8px; max-width:200px; overflow:hidden; text-overflow:ellipsis;">${Utils.escapeHtml(txn.description || '-')}</td>
                <td style="padding:8px; text-align:center; font-size:11px;">${txn.orders?.order_id ? Utils.escapeHtml(txn.orders.order_id) : '-'}</td>
            　　　`;
        }
        
        if (rows === '') {
            rows = `<tr><td colspan="7" style="text-align:center; padding:20px;">${lang === 'id' ? 'Tidak ada data' : '暂无数据'}</td></tr>`;
        }
        
        tbody.innerHTML = rows;
        
        var totalSpan = document.getElementById('totalAmount');
        if (totalSpan) {
            totalSpan.textContent = Utils.formatCurrency(totalAmount);
        }
    },
    
    printCapitalTransactions: function() {
        var lang = Utils.lang;
        var transactions = window._capitalTransactionsData || [];
        
        var typeMap = {
            loan_disbursement: lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放',
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            service_fee: lang === 'id' ? 'Service Fee' : '服务费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金',
            expense: lang === 'id' ? 'Pengeluaran' : '运营支出'
        };
        
        var printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JF! by Gadai - ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .header h1 { margin: 0; font-size: 18px; }
            .header p { margin: 5px 0; color: #666; font-size: 11px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: 600; }
            .text-right { text-align: right; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
            @media print { @page { size: A4 landscape; margin: 10mm; } body { margin: 0; } .no-print { display: none; } }
        </style>
        </head><body>
        <div class="header"><h1>JF! by Gadai - ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</h1>
        <p>${lang === 'id' ? 'Tanggal Cetak' : '打印日期'}: ${new Date().toLocaleString()}</p></div>
        <table><thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Tipe' : '类型'}</th><th>${lang === 'id' ? 'Metode' : '方式'}</th><th>${lang === 'id' ? 'Arah' : '方向'}</th><th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead><tbody>`;
        
        for (var txn of transactions) {
            var directionText = txn.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出');
            var methodText = txn.source_target === 'cash' ? 'Tunai' : 'Bank';
            printContent += `<tr><td>${Utils.formatDate(txn.recorded_at)}</td><td>${typeMap[txn.flow_type] || txn.flow_type}</td><td>${methodText}</td><td>${directionText}</td><td class="text-right">${Utils.formatCurrency(txn.amount)}</td><td>${Utils.escapeHtml(txn.description || '-')}</td></tr>`;
        }
        
        printContent += `</tbody></table><div class="footer"><div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div></div>
        <div class="no-print" style="text-align:center; margin-top:20px;"><button onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
        <button onclick="window.close()" style="margin-left:10px;">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button></div></body></html>`;
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    },
    
    exportCapitalTransactionsToCSV: function() {
        var lang = Utils.lang;
        var transactions = window._capitalTransactionsData || [];
        if (transactions.length === 0) { alert(lang === 'id' ? 'Tidak ada data untuk diekspor' : '没有数据可导出'); return; }
        
        var typeMap = {
            loan_disbursement: lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放',
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            service_fee: lang === 'id' ? 'Service Fee' : '服务费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金',
            expense: lang === 'id' ? 'Pengeluaran' : '运营支出'
        };
        
        var headers = lang === 'id' ? ['Tanggal', 'Tipe', 'Metode', 'Arah', 'Jumlah', 'Keterangan', 'ID Pesanan'] : ['日期', '类型', '方式', '方向', '金额', '说明', '订单号'];
        var rows = [];
        for (var txn of transactions) {
            var directionText = txn.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出');
            var methodText = txn.source_target === 'cash' ? 'Tunai' : 'Bank';
            rows.push([
                Utils.formatDate(txn.recorded_at),
                typeMap[txn.flow_type] || txn.flow_type,
                methodText,
                directionText,
                txn.amount,
                txn.description || '',
                txn.orders?.order_id || ''
            ]);
        }
        
        var csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = `jf_cash_flow_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    },

    showUserManagement: async function() {
        this.currentPage = 'userManagement';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        
        if (!isAdmin) {
            alert(lang === 'id' ? 'Hanya administrator yang dapat mengakses halaman ini' : '只有管理员可以访问此页面');
            this.goBack();
            return;
        }
        
        try {
            var users = await AUTH.getAllUsers();
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;
            users.sort((a, b) => (storeMap[a.store_id] || '').localeCompare(storeMap[b.store_id] || ''));

            var userRows = '';
            for (var u of users) {
                var isCurrent = u.id === AUTH.user.id;
                var storeName = storeMap[u.store_id] || '-';
                var roleText = u.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : u.role === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工');
                var usernameDisplay = u.username || u.email || '-';
                var actionHtml = '';
                if (isCurrent) {
                    actionHtml = `<span class="current-user-badge">✅ ${lang === 'id' ? 'Saya' : '当前'}</span>`;
                } else {
                    actionHtml = `<button onclick="APP.editUser('${Utils.escapeAttr(u.id)}')" class="btn-small">✏️ ${t('edit')}</button><button class="btn-small danger" onclick="APP.deleteUser('${Utils.escapeAttr(u.id)}')">🗑️ ${t('delete')}</button>`;
                }
                userRows += `<tr>
                    <td>${Utils.escapeHtml(usernameDisplay)}</td>
                    <td>${Utils.escapeHtml(u.name)}</td>
                    <td>${roleText}</td>
                    <td>${Utils.escapeHtml(storeName)}</td>
                    <td class="action-cell">${actionHtml}</td>
                </tr>`;
            }

            if (users.length === 0) userRows = `<tr><td colspan="5" class="text-center">${t('no_data')}</td></tr>`;

            var storeOptions = `<option value="">${lang === 'id' ? 'Pilih Toko' : '选择门店'}</option>`;
            for (var s of stores) storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>👥 ${t('user_management')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>
                </div>
                <div class="card"><h3>${lang === 'id' ? 'Daftar Pengguna' : '用户列表'}</h3>
                    <div class="table-container"><table class="user-table"><thead><tr><th>${t('username')}</th><th>${lang === 'id' ? 'Nama' : '姓名'}</th><th>${lang === 'id' ? 'Peran' : '角色'}</th><th>${lang === 'id' ? 'Toko' : '门店'}</th><th>${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead><tbody>${userRows}</tbody>}</table></div>
                </div>
                <div class="card"><h3>${lang === 'id' ? 'Tambah Pengguna Baru' : '添加新用户'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${t('username')} *</label><input id="newUsername" placeholder="email@domain.com"></div>
                        <div class="form-group"><label>${t('password')} *</label><input id="newPassword" type="password"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label><input id="newName"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Peran' : '角色'}</label><select id="newRole"><option value="admin">${lang === 'id' ? 'Administrator' : '管理员'}</option><option value="store_manager">${lang === 'id' ? 'Manajer Toko' : '店长'}</option><option value="staff">${lang === 'id' ? 'Staf' : '员工'}</option></select></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Toko' : '门店'}</label><select id="newStoreId">${storeOptions}</select></div>
                        <div class="form-actions"><button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button></div>
                    </div>
                </div>`;
        } catch (error) { console.error("showUserManagement error:", error); alert(Utils.lang === 'id' ? 'Gagal memuat manajemen pengguna' : '加载用户管理失败'); }
    },

    addUser: async function() {
        var username = document.getElementById("newUsername").value.trim();
        var password = document.getElementById("newPassword").value;
        var name = document.getElementById("newName").value.trim();
        var role = document.getElementById("newRole").value;
        var storeId = document.getElementById("newStoreId").value;
        if (!username || !password || !name) { alert(Utils.lang === 'id' ? 'Harap isi semua field' : '请填写所有字段'); return; }
        try { await AUTH.addUser(username, password, name, role, storeId || null); alert((Utils.lang === 'id' ? 'Pengguna "' : '用户 "') + username + '" ' + (Utils.lang === 'id' ? 'berhasil ditambahkan!' : '添加成功！')); await this.showUserManagement(); } 
        catch (error) { alert('Error: ' + error.message); }
    },

    deleteUser: async function(userId) {
        var lang = Utils.lang;
        if (confirm(lang === 'id' ? 'Hapus pengguna ini? Tindakan ini tidak dapat dibatalkan.' : '删除此用户？此操作不可撤销。')) {
            try { await AUTH.deleteUser(userId); await this.showUserManagement(); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    editUser: async function(userId) {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: user, error } = await supabaseClient.from('user_profiles').select('*').eq('id', userId).single();
            if (error) throw error;
            var modal = document.createElement('div');
            modal.id = 'editUserModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><h3>✏️ ${lang === 'id' ? 'Ubah Peran Pengguna' : '修改用户角色'}</h3><div class="form-group"><label>${lang === 'id' ? 'Peran' : '角色'}</label><select id="editRoleSelect"><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>${lang === 'id' ? 'Administrator' : '管理员'}</option><option value="store_manager" ${user.role === 'store_manager' ? 'selected' : ''}>${lang === 'id' ? 'Manajer Toko' : '店长'}</option><option value="staff" ${user.role === 'staff' ? 'selected' : ''}>${lang === 'id' ? 'Staf' : '员工'}</option></select></div><div class="modal-actions"><button onclick="APP._saveUserRole('${Utils.escapeAttr(userId)}')" class="success">💾 ${t('save')}</button><button onclick="document.getElementById('editUserModal').remove()">✖ ${t('cancel')}</button></div></div>`;
            document.body.appendChild(modal);
        } catch (error) { alert(lang === 'id' ? 'Gagal memuat data pengguna' : '加载用户数据失败'); }
    },

    _saveUserRole: async function(userId) {
        var lang = Utils.lang;
        var newRole = document.getElementById('editRoleSelect').value;
        try { await AUTH.updateUser(userId, { role: newRole }); document.getElementById('editUserModal')?.remove(); alert(lang === 'id' ? 'Peran pengguna berhasil diubah' : '用户角色已修改'); await this.showUserManagement(); } 
        catch (error) { alert('Error: ' + error.message); }
    },

    getSenderWANumber: async function(storeId) {
        var storeWANumber = await SUPABASE.getStoreWANumber(storeId);
        return storeWANumber || null;
    },

    generateWAText: function(order, senderNumber) {
        var lang = Utils.lang;
        // 空值保护
        var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
        var monthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);
        var dueDate = Utils.formatDate(order.next_interest_due_date);
        return lang === 'id' 
            ? `Halo *${Utils.escapeHtml(order.customer_name)}*,\n\nKami ingin mengingatkan bahwa pembayaran bunga pinjaman Anda akan jatuh tempo *dalam 2 hari*.\n\n📋 *ID Pesanan:* ${order.order_id}\n💰 *Sisa Pokok:* ${Utils.formatCurrency(remainingPrincipal)}\n📅 *Bunga per Bulan:* ${Utils.formatCurrency(monthlyInterest)}\n⏰ *Tanggal Jatuh Tempo:* ${dueDate}\n\nMohon persiapkan pembayaran Anda.\n\nTerima kasih,\n*${AUTH.getCurrentStoreName()}*\n📞 ${senderNumber}`
            : `您好 *${Utils.escapeHtml(order.customer_name)}*，\n\n温馨提醒，您的贷款利息将在 *2天后* 到期。\n\n📋 *订单号:* ${order.order_id}\n💰 *剩余本金:* ${Utils.formatCurrency(remainingPrincipal)}\n📅 *月利息:* ${Utils.formatCurrency(monthlyInterest)}\n⏰ *到期日:* ${dueDate}\n\n请您提前准备。\n\n感谢您，\n*${AUTH.getCurrentStoreName()}*\n📞 ${senderNumber}`;
    },

    hasSentRemindersToday: async function() {
        var profile = await SUPABASE.getCurrentProfile();
        var today = new Date().toISOString().split('T')[0];
        let query = supabaseClient.from('reminder_logs').select('id', { count: 'exact', head: true }).eq('reminder_date', today);
        if (profile?.role !== 'admin' && profile?.store_id) {
            const { data: orders } = await supabaseClient.from('orders').select('id').eq('store_id', profile.store_id);
            const orderIds = orders?.map(o => o.id) || [];
            if (orderIds.length > 0) query = query.in('order_id', orderIds);
            else return false;
        }
        const { count, error } = await query;
        if (error) return false;
        return count > 0;
    },

    sendWAReminder: async function(orderId) {
        var lang = Utils.lang;
        try {
            var { order } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert(lang === 'id' ? 'Order tidak ditemukan' : '订单不存在'); return; }
            var senderNumber = await this.getSenderWANumber(order.store_id);
            if (!senderNumber) {
                alert(lang === 'id' ? '⚠️ Toko ini belum memiliki nomor WA.' : '⚠️ 该门店未配置 WA 号码。');
                return;
            }
            var waText = this.generateWAText(order, senderNumber);
            var phone = order.customer_phone.replace(/[^0-9]/g, '');
            if (!phone.startsWith('62')) phone = '62' + phone.replace(/^0+/, '');
            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`, '_blank');
            await SUPABASE.logReminder(order.id);
        } catch (error) { alert(lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败'); }
    },

    sendDailyReminders: async function() {
        var lang = Utils.lang;
        var button = document.getElementById('reminderBtn');
        if (button && button.disabled) { alert(lang === 'id' ? 'Pengingat sudah dikirim hari ini.' : '今日已发送过提醒。'); return; }
        try {
            var orders = await SUPABASE.getOrdersNeedReminder();
            if (orders.length === 0) { alert(lang === 'id' ? '📭 Tidak ada pengingat yang perlu dikirim hari ini.' : '📭 今天没有需要发送的提醒。'); return; }
            var validOrders = [];
            for (var order of orders) {
                var senderNumber = await this.getSenderWANumber(order.store_id);
                if (senderNumber) validOrders.push({ order, senderNumber });
            }
            if (validOrders.length === 0) { alert(lang === 'id' ? '⚠️ Tidak dapat mengirim pengingat.' : '⚠️ 无法发送提醒。'); return; }
            if (!confirm(lang === 'id' ? `📱 Akan mengirim ${validOrders.length} pengingat. Lanjutkan?` : `📱 将发送 ${validOrders.length} 条提醒。继续？`)) return;
            if (button) { button.disabled = true; button.textContent = lang === 'id' ? '⏳ Mengirim...' : '⏳ 发送中...'; }
            for (var i = 0; i < validOrders.length; i++) {
                var item = validOrders[i];
                var waText = this.generateWAText(item.order, item.senderNumber);
                var phone = item.order.customer_phone?.replace(/[^0-9]/g, '') || '';
                if (!phone.startsWith('62')) phone = '62' + phone.replace(/^0+/, '');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waText)}`, '_blank');
                await SUPABASE.logReminder(item.order.id);
                if (i < validOrders.length - 1) await new Promise(r => setTimeout(r, 1500));
            }
            alert(lang === 'id' ? `✅ ${validOrders.length} pengingat telah disiapkan.` : `✅ 已准备 ${validOrders.length} 条提醒。`);
            if (button) button.textContent = lang === 'id' ? '✅ Terkirim' : '✅ 已发送';
        } catch (error) {
            if (button) { button.disabled = false; button.textContent = lang === 'id' ? '📱 Kirim Pengingat' : '📱 发送提醒'; }
            alert(lang === 'id' ? 'Gagal mengirim pengingat massal' : '批量发送提醒失败');
        }
    },

    updateStoreWANumber: async function(storeId, waNumber) {
        var lang = Utils.lang;
        waNumber = waNumber.replace(/[^0-9]/g, '');
        try {
            await SUPABASE.updateStoreWANumber(storeId, waNumber || null);
            var msg = document.createElement('div');
            msg.textContent = lang === 'id' ? '✅ Tersimpan' : '✅ 已保存';
            msg.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#22c55e; color:white; padding:10px 20px; border-radius:8px; z-index:10000;';
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 1500);
        } catch (error) { alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message); }
    },

    showCreateOrder: function() { alert('Please select a customer first'); this.navigateTo('customers'); },
    
    getExpensesTotal: async function() {
        const profile = await SUPABASE.getCurrentProfile();
        let query = supabaseClient.from('expenses').select('amount');
        if (profile?.role !== 'admin' && profile?.store_id) query = query.eq('store_id', profile.store_id);
        const { data, error } = await query;
        if (error) throw error;
        return { total: data?.reduce((s, e) => s + e.amount, 0) || 0, items: data };
    },
    
    addStore: async function() {
        var name = document.getElementById("newStoreName").value.trim();
        var address = document.getElementById("newStoreAddress").value;
        var phone = document.getElementById("newStorePhone").value;
        var lang = Utils.lang;
        if (!name) { alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写'); return; }
        try { await StoreManager.createStore(name, address, phone); alert(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功'); await StoreManager.renderStoreManagement(); } 
        catch (error) { console.error("addStore error:", error); alert(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message); }
    },
    
    editStore: async function(storeId) { await StoreManager.editStore(storeId); },
    
    deleteStore: async function(storeId) {
        if (confirm(Utils.lang === 'id' ? 'Hapus toko ini?' : '删除此门店？')) {
            try { await StoreManager.deleteStore(storeId); await StoreManager.renderStoreManagement(); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    showBlacklist: async function() {
        if (typeof window.APP.showBlacklist === 'function') {
            await window.APP.showBlacklist();
        } else {
            alert(Utils.lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
        }
    },

    showTransferModal: async function(transferType) {
        var lang = Utils.lang;
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        
        var title = '';
        var fromLabel = '';
        var toLabel = '';
        var maxAmount = 0;
        var hint = '';
        
        switch(transferType) {
            case 'cash_to_bank':
                title = lang === 'id' ? '🏦→🏧 现金存入银行' : '🏦→🏧 现金存入银行';
                fromLabel = lang === 'id' ? '从保险柜取出' : '从保险柜取出';
                toLabel = lang === 'id' ? '存入银行' : '存入银行';
                const cashFlow = await SUPABASE.getCashFlowSummary();
                maxAmount = cashFlow.cash.balance;
                hint = lang === 'id' ? `保险柜可用余额: ${Utils.formatCurrency(maxAmount)}` : `保险柜可用余额: ${Utils.formatCurrency(maxAmount)}`;
                break;
            case 'bank_to_cash':
                title = lang === 'id' ? '🏧→🏦 银行取出现金' : '🏧→🏦 银行取出现金';
                fromLabel = lang === 'id' ? '从银行取出' : '从银行取出';
                toLabel = lang === 'id' ? '存入保险柜' : '存入保险柜';
                const cashFlow2 = await SUPABASE.getCashFlowSummary();
                maxAmount = cashFlow2.bank.balance;
                hint = lang === 'id' ? `银行可用余额: ${Utils.formatCurrency(maxAmount)}` : `银行可用余额: ${Utils.formatCurrency(maxAmount)}`;
                break;
            case 'store_to_hq':
                if (!isAdmin) {
                    alert(lang === 'id' ? 'Hanya administrator yang dapat melakukan setoran ke kantor pusat' : '只有管理员可以执行上缴总部操作');
                    return;
                }
                title = lang === 'id' ? '🏢 上缴总部' : '🏢 上缴总部';
                fromLabel = lang === 'id' ? '从门店银行取出' : '从门店银行取出';
                toLabel = lang === 'id' ? '上缴总部' : '上缴总部';
                const shopAccount = await SUPABASE.getShopAccount(profile?.store_id);
                maxAmount = shopAccount.bank_balance;
                hint = lang === 'id' ? `门店银行可用余额: ${Utils.formatCurrency(maxAmount)}` : `门店银行可用余额: ${Utils.formatCurrency(maxAmount)}`;
                break;
            default:
                return;
        }
        
        if (maxAmount <= 0) {
            alert(lang === 'id' ? '余额不足，无法进行转账' : '余额不足，无法进行转账');
            return;
        }
        
        var modalHtml = `
            <div class="modal-content" style="max-width:450px;">
                <h3>${title}</h3>
                <div class="form-group">
                    <label>${fromLabel}</label>
                    <input type="text" id="transferAmount" placeholder="0" class="amount-input">
                    <small style="color:#64748b;">${hint}</small>
                </div>
                <div class="form-group">
                    <label>${toLabel}</label>
                    <div class="transfer-info" style="background:#f0fdf4; padding:10px; border-radius:8px;">
                        <strong>→ ${Utils.formatCurrency(0)}</strong> ${lang === 'id' ? '将转入' : '将转入'}
                    </div>
                </div>
                <div class="form-group">
                    <label>${lang === 'id' ? 'Keterangan' : '说明'}</label>
                    <textarea id="transferDesc" rows="2" placeholder="${lang === 'id' ? '转账说明（可选）' : '转账说明（可选）'}"></textarea>
                </div>
                <div class="modal-actions">
                    <button onclick="APP.executeTransfer('${transferType}', ${maxAmount})" class="success">✅ ${lang === 'id' ? 'Konfirmasi Transfer' : '确认转账'}</button>
                    <button onclick="document.getElementById('transferModal').remove()">✖ ${lang === 'id' ? 'Batal' : '取消'}</button>
                </div>
            </div>
        `;
        
        var modal = document.createElement('div');
        modal.id = 'transferModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = modalHtml;
        document.body.appendChild(modal);
        
        var amountInput = document.getElementById('transferAmount');
        if (amountInput && Utils.bindAmountFormat) {
            Utils.bindAmountFormat(amountInput);
            amountInput.addEventListener('input', function() {
                var val = Utils.parseNumberFromCommas(this.value) || 0;
                var transferInfo = document.querySelector('.transfer-info strong');
                if (transferInfo) {
                    transferInfo.innerHTML = Utils.formatCurrency(val);
                }
            });
        }
    },

    executeTransfer: async function(transferType, maxAmount) {
        var lang = Utils.lang;
        var amountStr = document.getElementById('transferAmount').value;
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var description = document.getElementById('transferDesc')?.value || '';
        var profile = await SUPABASE.getCurrentProfile();
        
        if (amount <= 0) {
            alert(lang === 'id' ? 'Masukkan jumlah transfer' : '请输入转账金额');
            return;
        }
        
        if (amount > maxAmount) {
            alert(lang === 'id' ? `Jumlah melebihi saldo. Maksimal: ${Utils.formatCurrency(maxAmount)}` : `金额超过余额。最大: ${Utils.formatCurrency(maxAmount)}`);
            return;
        }
        
        try {
            switch(transferType) {
                case 'cash_to_bank':
                    await SUPABASE.recordInternalTransfer({
                        transfer_type: 'cash_to_bank',
                        from_account: 'cash',
                        to_account: 'bank',
                        amount: amount,
                        description: description || (lang === 'id' ? '现金存入银行' : '现金存入银行'),
                        store_id: profile?.store_id
                    });
                    alert(lang === 'id' ? `✅ 现金存入银行成功: ${Utils.formatCurrency(amount)}` : `✅ 现金存入银行成功: ${Utils.formatCurrency(amount)}`);
                    break;
                    
                case 'bank_to_cash':
                    await SUPABASE.recordInternalTransfer({
                        transfer_type: 'bank_to_cash',
                        from_account: 'bank',
                        to_account: 'cash',
                        amount: amount,
                        description: description || (lang === 'id' ? '银行取出现金' : '银行取出现金'),
                        store_id: profile?.store_id
                    });
                    alert(lang === 'id' ? `✅ 银行取出现金成功: ${Utils.formatCurrency(amount)}` : `✅ 银行取出现金成功: ${Utils.formatCurrency(amount)}`);
                    break;
                    
                case 'store_to_hq':
                    await SUPABASE.remitToHeadquarters(profile?.store_id, amount, description);
                    alert(lang === 'id' ? `✅ 上缴总部成功: ${Utils.formatCurrency(amount)}` : `✅ 上缴总部成功: ${Utils.formatCurrency(amount)}`);
                    break;
            }
            
            document.getElementById('transferModal')?.remove();
            await this.renderDashboard();
            
        } catch (error) {
            alert(lang === 'id' ? '转账失败: ' + error.message : '转账失败：' + error.message);
        }
    },

    showInternalTransferHistory: async function() {
        var lang = Utils.lang;
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        
        if (!isAdmin) {
            alert(lang === 'id' ? 'Hanya administrator yang dapat melihat riwayat transfer internal' : '只有管理员可以查看内部转账记录');
            return;
        }
        
        try {
            var stores = await SUPABASE.getAllStores();
            var transfers = await SUPABASE.getInternalTransfers();
            
            var storeOptions = '<option value="all">' + (lang === 'id' ? 'Semua Toko' : '全部门店') + '</option>';
            for (var store of stores) {
                storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)}</option>`;
            }
            
            var typeMap = {
                'cash_to_bank': lang === 'id' ? '🏦→🏧 现金存入银行' : '🏦→🏧 现金存入银行',
                'bank_to_cash': lang === 'id' ? '🏧→🏦 银行取出现金' : '🏧→🏦 银行取出现金',
                'store_to_hq': lang === 'id' ? '🏢 上缴总部' : '🏢 上缴总部'
            };
            
            var rows = '';
            if (transfers.length === 0) {
                rows = `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Tidak ada data' : '暂无数据'}</td></tr>`;
            } else {
                for (var t of transfers) {
                    rows += `<tr>
                        <td>${Utils.formatDate(t.transfer_date)}</td>
                        <td>${Utils.escapeHtml(t.stores?.name || '-')}</td>
                        <td>${typeMap[t.transfer_type] || t.transfer_type}</td>
                        <td>${t.from_account} → ${t.to_account}</td>
                        <td class="text-right">${Utils.formatCurrency(t.amount)}</td>
                        <td>${Utils.escapeHtml(t.description || '-')}</td>
                        <td>${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>
                    </tr>`;
                }
            }
            
            var modalHtml = `
                <div class="modal-content" style="max-width:900px; max-height:85vh; overflow-y:auto;">
                    <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <h3 style="margin:0;">🔄 ${lang === 'id' ? 'Riwayat Transfer Internal' : '内部转账记录'}</h3>
                        <button onclick="document.getElementById('historyModal').remove()" style="background:transparent; font-size:20px; cursor:pointer;">✖</button>
                    </div>
                    
                    <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
                        <select id="filterStore" style="width:auto; min-width:150px;">
                            ${storeOptions}
                        </select>
                        <select id="filterType" style="width:auto; min-width:150px;">
                            <option value="all">${lang === 'id' ? 'Semua Tipe' : '全部类型'}</option>
                            <option value="cash_to_bank">🏦→🏧 ${lang === 'id' ? '现金存入银行' : '现金存入银行'}</option>
                            <option value="bank_to_cash">🏧→🏦 ${lang === 'id' ? '银行取出现金' : '银行取出现金'}</option>
                            <option value="store_to_hq">🏢 ${lang === 'id' ? '上缴总部' : '上缴总部'}</option>
                        </select>
                        <input type="date" id="filterDateStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                        <input type="date" id="filterDateEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                        <button onclick="APP.filterInternalTransferHistory()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                        <button onclick="APP.resetInternalTransferFilters()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                    </div>
                    
                    <div class="table-container">
                        <table class="data-table" style="width:100%; font-size:13px;">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th>${lang === 'id' ? 'Tipe' : '类型'}</th>
                                    <th>${lang === 'id' ? 'Transfer' : '转账'}</th>
                                    <th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                    <th>${lang === 'id' ? 'Dibuat oleh' : '操作人'}</th>
                                </tr>
                            </thead>
                            <tbody id="transferHistoryBody">
                                ${rows}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="modal-actions" style="margin-top:16px;">
                        <button onclick="APP.exportInternalTransferToCSV()" class="btn-small" style="background:#10b981; color:white;">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="document.getElementById('historyModal').remove()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
                    </div>
                </div>
            `;
            
            var modal = document.createElement('div');
            modal.id = 'historyModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = modalHtml;
            document.body.appendChild(modal);
            
            window._internalTransfersData = transfers;
            
        } catch (error) {
            console.error("showInternalTransferHistory error:", error);
            alert(lang === 'id' ? 'Gagal memuat riwayat transfer' : '加载转账记录失败');
        }
    },

    filterInternalTransferHistory: function() {
        var storeId = document.getElementById('filterStore')?.value;
        var type = document.getElementById('filterType')?.value;
        var dateStart = document.getElementById('filterDateStart')?.value;
        var dateEnd = document.getElementById('filterDateEnd')?.value;
        
        var transfers = window._internalTransfersData || [];
        
        var filtered = transfers.filter(function(t) {
            if (storeId && storeId !== 'all' && t.store_id !== storeId) return false;
            if (type && type !== 'all' && t.transfer_type !== type) return false;
            if (dateStart && t.transfer_date < dateStart) return false;
            if (dateEnd && t.transfer_date > dateEnd) return false;
            return true;
        });
        
        this._renderInternalTransferHistory(filtered);
    },

    resetInternalTransferFilters: function() {
        var filterStore = document.getElementById('filterStore');
        var filterType = document.getElementById('filterType');
        var filterDateStart = document.getElementById('filterDateStart');
        var filterDateEnd = document.getElementById('filterDateEnd');
        
        if (filterStore) filterStore.value = 'all';
        if (filterType) filterType.value = 'all';
        if (filterDateStart) filterDateStart.value = '';
        if (filterDateEnd) filterDateEnd.value = '';
        
        this.filterInternalTransferHistory();
    },

    _renderInternalTransferHistory: function(transfers) {
        var lang = Utils.lang;
        var tbody = document.getElementById('transferHistoryBody');
        if (!tbody) return;
        
        var typeMap = {
            'cash_to_bank': lang === 'id' ? '🏦→🏧 现金存入银行' : '🏦→🏧 现金存入银行',
            'bank_to_cash': lang === 'id' ? '🏧→🏦 银行取出现金' : '🏧→🏦 银行取出现金',
            'store_to_hq': lang === 'id' ? '🏢 上缴总部' : '🏢 上缴总部'
        };
        
        var rows = '';
        if (transfers.length === 0) {
            rows = `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Tidak ada data' : '暂无数据'}</td></tr>`;
        } else {
            for (var t of transfers) {
                rows += `<tr>
                    <td style="padding:8px;">${Utils.formatDate(t.transfer_date)}</td>
                    <td style="padding:8px;">${Utils.escapeHtml(t.stores?.name || '-')}</td>
                    <td style="padding:8px;">${typeMap[t.transfer_type] || t.transfer_type}</td>
                    <td style="padding:8px;">${t.from_account} → ${t.to_account}</td>
                    <td style="padding:8px; text-align:right;">${Utils.formatCurrency(t.amount)}</td>
                    <td style="padding:8px;">${Utils.escapeHtml(t.description || '-')}</td>
                    <td style="padding:8px;">${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>
                </tr>`;
            }
        }
        
        tbody.innerHTML = rows;
    },

    exportInternalTransferToCSV: async function() {
        var lang = Utils.lang;
        var transfers = window._internalTransfersData || [];
        
        if (transfers.length === 0) {
            alert(lang === 'id' ? 'Tidak ada data untuk diekspor' : '没有数据可导出');
            return;
        }
        
        var typeMap = {
            'cash_to_bank': lang === 'id' ? '现金存入银行' : '现金存入银行',
            'bank_to_cash': lang === 'id' ? '银行取出现金' : '银行取出现金',
            'store_to_hq': lang === 'id' ? '上缴总部' : '上缴总部'
        };
        
        var headers = lang === 'id' 
            ? ['Tanggal', 'Toko', 'Tipe Transfer', 'Transfer', 'Jumlah', 'Keterangan', 'Dibuat oleh']
            : ['日期', '门店', '转账类型', '转账', '金额', '说明', '操作人'];
        
        var rows = [];
        for (var t of transfers) {
            rows.push([
                t.transfer_date,
                t.stores?.name || '-',
                typeMap[t.transfer_type] || t.transfer_type,
                `${t.from_account} → ${t.to_account}`,
                t.amount,
                t.description || '-',
                t.created_by_profile?.name || '-'
            ]);
        }
        
        var csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = `jf_internal_transfers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    }
};

// 辅助函数：转义属性值（XSS防护）
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

for (var key in DashboardCore) {
    if (typeof DashboardCore[key] === 'function' || key === 'currentFilter' || key === 'searchKeyword' || 
        key === 'historyStack' || key === 'currentPage' || key === 'currentOrderId' || key === 'currentCustomerId') {
        window.APP[key] = DashboardCore[key];
    }
}

// 添加 escapeAttr 到 Utils
Utils.escapeAttr = escapeAttr;

console.log('✅ app-dashboard-core.js v4.0 已加载 - 锁定功能已移除，编辑权限已限制');
