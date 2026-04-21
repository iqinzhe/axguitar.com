// app-dashboard-core.js - v3.0 优化版（添加工具栏标题）

window.APP = window.APP || {};

const DashboardCore = {
    currentFilter: "all",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    // ==================== 页面状态管理 ====================
    saveCurrentPageState: function() {
        sessionStorage.setItem('jf_current_page', this.currentPage);
        sessionStorage.setItem('jf_current_filter', this.currentFilter || "all");
    },
    
    restorePageState: function() {
        return {
            page: sessionStorage.getItem('jf_current_page'),
            filter: sessionStorage.getItem('jf_current_filter') || "all"
        };
    },
    
    clearPageState: function() {
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_filter');
        this.currentOrderId = null;
        this.currentCustomerId = null;
    },

    // ==================== 初始化与路由 ====================
    init: async function() {
        document.getElementById("app").innerHTML = '<div class="loading-container"><div class="loader"></div><p class="loading-text">🔄 Loading system...</p></div>';
        await AUTH.init();
        
        var savedState = this.restorePageState();
        var savedPage = savedState.page;
        var savedFilter = savedState.filter;
        
        if (savedPage && savedPage !== 'login' && AUTH.isLoggedIn()) {
            this.currentPage = savedPage;
            this.currentFilter = savedFilter || "all";
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
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            expenses: async () => await self.showExpenses(),
            customers: async () => await self.showCustomers(),
            paymentHistory: async () => await self.showPaymentHistory(),
            backupRestore: async () => await Storage.renderBackupUI(),
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
            filter: this.currentFilter
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
            backupRestore: async () => await Storage.renderBackupUI(),
            customerOrders: async () => { if (params.customerId) await self.showCustomerOrders(params.customerId); },
            customerPaymentHistory: async () => { if (params.customerId) await self.showCustomerPaymentHistory(params.customerId); },
            viewOrder: async () => { if (params.orderId) await self.viewOrder(params.orderId); },
            payment: async () => { if (params.orderId) await self.showPayment(params.orderId); },
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
                backupRestore: async () => await Storage.renderBackupUI(),
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

    // ==================== 登录认证 ====================
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

    // ==================== 保存退出功能（带确认提示） ====================
    logout: async function() {
        var lang = Utils.lang;
        var confirmMsg = lang === 'id' 
            ? '💾 确认保存并退出登录？\n\n系统将自动保存当前数据，然后退出。'
            : '💾 确认保存并退出登录？\n\n系统将自动保存当前数据，然后退出。';
        
        if (!confirm(confirmMsg)) return;
        
        var loadingMsg = this._showSavingMessage(lang === 'id' ? '正在保存数据...' : '正在保存数据...');
        
        try {
            await this._saveCurrentPageData();
            this._hideSavingMessage(loadingMsg);
            
            var exitMsg = lang === 'id' 
                ? '✅ 数据已保存，正在退出...'
                : '✅ 数据已保存，正在退出...';
            alert(exitMsg);
            
        } catch (saveError) {
            console.error("保存数据失败:", saveError);
            this._hideSavingMessage(loadingMsg);
            
            var errorMsg = lang === 'id'
                ? '⚠️ 保存数据失败：' + saveError.message + '\n\n是否仍然退出？'
                : '⚠️ 保存数据失败：' + saveError.message + '\n\n是否仍然退出？';
            
            if (!confirm(errorMsg)) return;
        }
        
        this.clearPageState();
        sessionStorage.clear();
        await AUTH.logout();
        await this.router();
    },
    
    _showSavingMessage: function(message) {
        var div = document.createElement('div');
        div.id = 'saving-overlay';
        div.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10001; display:flex; align-items:center; justify-content:center;';
        div.innerHTML = `<div style="background:white; padding:20px 40px; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:12px;">
            <div class="loader" style="width:36px; height:36px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <p style="margin:0; font-size:14px;">${message}</p>
        </div>`;
        document.body.appendChild(div);
        
        if (!document.getElementById('saving-spinner-style')) {
            var style = document.createElement('style');
            style.id = 'saving-spinner-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        return div;
    },
    
    _hideSavingMessage: function(element) {
        if (element && element.remove) element.remove();
    },
    
    _saveCurrentPageData: async function() {
        var currentPage = this.currentPage;
        
        switch(currentPage) {
            case 'customers':
                var customerName = document.getElementById("customerName");
                if (customerName && customerName.value && customerName.value.trim()) {
                    console.log("检测到未保存的客户信息，正在自动保存...");
                    if (typeof window.APP.addCustomer === 'function') {
                        await window.APP.addCustomer();
                    }
                }
                break;
                
            case 'expenses':
                var expenseAmount = document.getElementById("expenseAmount");
                if (expenseAmount && expenseAmount.value && parseFloat(expenseAmount.value.replace(/[,\s]/g, '')) > 0) {
                    console.log("检测到未保存的支出信息，正在自动保存...");
                    if (typeof window.APP.addExpense === 'function') {
                        await window.APP.addExpense();
                    }
                }
                break;
                
            default:
                console.log(`当前页面 (${currentPage}) 无需自动保存数据`);
                break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
        return true;
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

    // ==================== 仪表盘 ====================
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
            var hasSentToday = await APP.hasSentRemindersToday();
            
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
            
            const allOrders = await SUPABASE.getOrders();
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            
            const thisMonthOrders = allOrders.filter(order => {
                const orderDate = new Date(order.created_at);
                return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
            });
            const thisMonthOrderCount = thisMonthOrders.length;
            
            let totalInflowExcludingPrincipal = 0;
            let totalOutflow = 0;
            
            const allCashFlows = await SUPABASE.getCashFlowRecords();
            for (const flow of allCashFlows || []) {
                const amount = flow.amount || 0;
                if (flow.direction === 'inflow' && flow.flow_type !== 'principal') {
                    totalInflowExcludingPrincipal += amount;
                } else if (flow.direction === 'outflow') {
                    totalOutflow += amount;
                }
            }
            const deficit = totalOutflow - totalInflowExcludingPrincipal;
            
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            
            const completedOrders = allOrders.filter(order => order.status === 'completed');
            const expiredOrders = completedOrders.filter(order => {
                const completedDate = order.completed_at || order.updated_at;
                if (!completedDate) return false;
                return new Date(completedDate) < twoYearsAgo;
            });
            
            if (expiredOrders.length > 0) {
                console.log(`检测到 ${expiredOrders.length} 个已结清超过2年的订单，正在自动清理...`);
                for (const expiredOrder of expiredOrders) {
                    try {
                        await supabaseClient.from('cash_flow_records').delete().eq('order_id', expiredOrder.id);
                        await supabaseClient.from('payment_history').delete().eq('order_id', expiredOrder.id);
                        await supabaseClient.from('orders').delete().eq('id', expiredOrder.id);
                        console.log(`已清理过期订单: ${expiredOrder.order_id}`);
                    } catch (cleanErr) {
                        console.warn(`清理订单 ${expiredOrder.order_id} 失败:`, cleanErr);
                    }
                }
            }
            
            const updatedOrders = await SUPABASE.getOrders();
            const activeOrdersCount = updatedOrders.filter(o => o.status === 'active').length;
            const completedOrdersCount = updatedOrders.filter(o => o.status === 'completed').length;
            
            var cards = [
                { label: `${lang === 'id' ? '本月新增' : '本月新增'}/${t('total_orders')}`, value: `${thisMonthOrderCount}/${report.total_orders}`, type: 'text' },
                { label: lang === 'id' ? '赤字 (流出-收入)' : '赤字 (流出-收入)', value: Utils.formatCurrency(deficit), type: 'currency', class: deficit >= 0 ? 'expense' : 'income' },
                { label: t('active'), value: activeOrdersCount, type: 'number' },
                { label: `${lang === 'id' ? '已结清' : '已结清'} / ${lang === 'id' ? '已失效' : '已失效'}`, value: `${completedOrdersCount} / ${expiredOrders.length}`, type: 'text' },
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
            
            // ==================== 添加工具栏标题 ====================
            var toolbarTitleHtml = `
                <div style="margin: 20px 0 12px 0;">
                    <h3>📋 ${lang === 'id' ? '经营管理中心' : '经营管理中心'}</h3>
                </div>
            `;
            
            var toolbarHtml = '';
if (isAdmin) {
    toolbarHtml = `
    <div class="toolbar admin-grid">
        <button onclick="APP.navigateTo('customers')">👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</button>
        <button onclick="APP.navigateTo('orderTable')">📋 ${lang === 'id' ? 'Manajemen Pesanan' : '订单管理'}</button>
        <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang === 'id' ? 'Arus Kas' : '资金流水'}</button>
        <button onclick="APP.navigateTo('expenses')">📝 ${lang === 'id' ? 'Pengeluaran' : '运营支出'}</button>
        <button onclick="APP.navigateTo('backupRestore')">💾 ${lang === 'id' ? 'Backup & Restore' : '数据管理'}</button>
        <button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ${btnHighlight ? 'highlight' : ''}" ${btnDisabled ? 'disabled' : ''}>
            🔔 ${lang === 'id' ? 'Kirim Pengingat' : '催收提醒'} ${hasReminders ? `(${needRemindOrders.length})` : ''}
        </button>
        <button onclick="APP.navigateTo('report')">📊 ${lang === 'id' ? 'Laporan Bisnis' : '业务报表'}</button>
        <button onclick="APP.navigateTo('userManagement')">👤 ${lang === 'id' ? 'Man. Kerja' : '员工管理'}</button>
        <button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Man. Toko' : '门店管理'}</button>
        <button onclick="APP.logout()">💾 ${lang === 'id' ? 'Simpan & Keluar' : '退出系统'}</button>
    </div>`;
} else {
    toolbarHtml = `
    <div class="toolbar store-grid">
        <button onclick="APP.navigateTo('customers')">👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</button>
        <button onclick="APP.navigateTo('orderTable')">📋 ${lang === 'id' ? 'Manajemen Pesanan' : '订单管理'}</button>
        <button onclick="APP.showCashFlowModal()">💰 ${lang === 'id' ? 'Arus Kas' : '资金流水'}</button>
        <button onclick="APP.navigateTo('expenses')">📝 ${lang === 'id' ? 'Pengeluaran' : '运营支出'}</button>
        <button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ${btnHighlight ? 'highlight' : ''}" ${btnDisabled ? 'disabled' : ''}>
            🔔 ${lang === 'id' ? 'Kirim Pengingat' : '催收提醒'} ${hasReminders ? `(${needRemindOrders.length})` : ''}
        </button>
        <button onclick="APP.logout()">💾 ${lang === 'id' ? 'Simpan & Keluar' : '退出系统'}</button>
    </div>`;
}
            
            var cashFlowHtml = '';
            if (isAdmin) {
                cashFlowHtml = `
                <div class="cashflow-summary">
                    <h3>💰 ${lang === 'id' ? '资金管理汇总 (全部门店)' : '资金管理汇总 (全部门店)'}</h3>
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
                                <button onclick="APP.showTransferModal('store_to_hq')" class="transfer-btn store-to-hq">
                                    🏢 ${lang === 'id' ? '上缴总部' : '上缴总部'}
                                </button>
                            </div>
                            <div class="cashflow-detail" style="margin-top:8px;">
                                💡 ${lang === 'id' ? '保险柜现金过多时可存入银行，不足时可从银行提取' : '保险柜现金过多时可存入银行，不足时可从银行提取'}
                            </div>
                        </div>
                    </div>
                </div>`;
            } else {
                cashFlowHtml = `
                <div class="cashflow-summary">
                    <h3>💰 ${lang === 'id' ? '资金管理' : '资金管理'}</h3>
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
                            </div>
                            <div class="cashflow-detail" style="margin-top:8px;">
                                💡 ${lang === 'id' ? '保险柜现金过多时可存入银行，不足时可从银行提取' : '保险柜现金过多时可存入银行，不足时可从银行提取'}
                            </div>
                        </div>
                    </div>
                </div>`;
            }
            
            var cardsTitleHtml = '';
            if (isAdmin) {
                cardsTitleHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="margin:0;">📊 ${lang === 'id' ? '经营指标汇总 (全部门店)' : '经营指标汇总 (全部门店)'}</h3>
                </div>`;
            } else {
                cardsTitleHtml = `<div style="margin-bottom:12px;">
                    <h3 style="margin:0;">📊 ${lang === 'id' ? '经营指标' : '经营指标'}</h3>
                </div>`;
            }
            
            var bottomHtml = `
            <div class="card">
                <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长')})</h3>
                <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}${isAdmin ? ` (${lang === 'id' ? 'Kantor Pusat - Seluruh Toko' : '总部 - 全部门店'})` : ''}</p>
                <p>📌 ${lang === 'id' ? 'Admin Fee: (dibayar saat kontrak) | Bunga: 10% per bulan | Service Fee: (diskon, dibayar sekali)' : '管理费: (签合同支付) | 利息: 10%/月 | 服务费: (优惠，仅收一次)'}</p>
                <p>🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>
            </div>`;
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h1><img src="icons/pagehead-logo.png" alt="JF!" class="logo-img"> JF! by Gadai</h1>
                    <div class="header-actions">
                        ${this.historyStack.length > 0 ? `<button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>` : ''}
                    </div>
                </div>
                
                ${cashFlowHtml}
                
                ${cardsTitleHtml}
                <div class="stats-grid-optimized">
                    ${cardsHtml}
                </div>
                
                ${toolbarTitleHtml}
                ${toolbarHtml}
                
                ${bottomHtml}
            `;
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p>⚠️ ${err.message}</p><button onclick="APP.logout()">💾 ${Utils.lang === 'id' ? 'Simpan & Keluar' : '保存退出'}</button></div>`;
        }
    },

    // ==================== 辅助函数 ====================
    showCreateOrder: function() { 
        alert(Utils.lang === 'id' ? 'Silakan pilih nasabah terlebih dahulu' : '请先选择客户'); 
        this.navigateTo('customers'); 
    },
    
    getExpensesTotal: async function() {
        var profile = await SUPABASE.getCurrentProfile();
        let query = supabaseClient.from('expenses').select('amount');
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        const { data } = await query;
        return data?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
    },
    
    showBlacklist: async function() {
        if (typeof window.APP.showBlacklist === 'function') {
            await window.APP.showBlacklist();
        } else {
            alert(Utils.lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
        }
    },

    // ==================== 门店管理辅助 ====================
    addStore: async function() {
        var lang = Utils.lang;
        var name = document.getElementById("newStoreName")?.value.trim();
        var address = document.getElementById("newStoreAddress")?.value.trim();
        var phone = document.getElementById("newStorePhone")?.value.trim();
        
        if (!name) {
            alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        
        try {
            await StoreManager.createStore(name, address, phone);
            alert(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message);
        }
    },
    
    editStore: async function(storeId) { 
        await StoreManager.editStore(storeId); 
    },
    
    deleteStore: async function(storeId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus toko ini?' : '删除此门店？')) return;
        try {
            await StoreManager.deleteStore(storeId);
            alert(lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
        }
    }
};

// 合并到 window.APP
for (var key in DashboardCore) {
    if (typeof DashboardCore[key] === 'function' || 
        key === 'currentFilter' || key === 'historyStack' || 
        key === 'currentPage' || key === 'currentOrderId' || key === 'currentCustomerId') {
        window.APP[key] = DashboardCore[key];
    }
}

console.log('✅ app-dashboard-core.js v3.0 已加载 - 添加工具栏标题');
