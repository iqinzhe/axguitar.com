// app-dashboard-core.js - v1.7（修复：flowsToAnalyze 空值处理 + 门店登录兼容）

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
            orderTable: async () => { if (typeof window.APP.showOrderTable === 'function') await window.APP.showOrderTable(); else await self.renderDashboard(); },
            createOrder: () => { if (typeof window.APP.showCreateOrder === 'function') window.APP.showCreateOrder(); else self.showCreateOrder(); },
            viewOrder: async () => { 
                if (self.currentOrderId && typeof window.APP.viewOrder === 'function') {
                    await window.APP.viewOrder(self.currentOrderId);
                } else {
                    await self.renderDashboard();
                }
            },
            payment: async () => { 
                if (self.currentOrderId && typeof window.APP.showPayment === 'function') {
                    await window.APP.showPayment(self.currentOrderId);
                } else {
                    await self.renderDashboard();
                }
            },
            anomaly: async () => { if (typeof window.APP.showAnomaly === 'function') await window.APP.showAnomaly(); else await self.renderDashboard(); },
            userManagement: async () => { if (typeof window.APP.showUserManagement === 'function') await window.APP.showUserManagement(); else await self.renderDashboard(); },
            storeManagement: async () => { if (typeof StoreManager.renderStoreManagement === 'function') await StoreManager.renderStoreManagement(); else await self.renderDashboard(); },
            expenses: async () => { if (typeof window.APP.showExpenses === 'function') await window.APP.showExpenses(); else await self.renderDashboard(); },
            customers: async () => { if (typeof window.APP.showCustomers === 'function') await window.APP.showCustomers(); else await self.renderDashboard(); },
            paymentHistory: async () => { if (typeof window.APP.showPaymentHistory === 'function') await window.APP.showPaymentHistory(); else await self.renderDashboard(); },
            backupRestore: async () => { if (typeof Storage.renderBackupUI === 'function') await Storage.renderBackupUI(); else await self.renderDashboard(); },
            customerOrders: async () => { 
                if (self.currentCustomerId && typeof window.APP.showCustomerOrders === 'function') {
                    await window.APP.showCustomerOrders(self.currentCustomerId);
                } else {
                    await self.renderDashboard();
                }
            },
            customerPaymentHistory: async () => { 
                if (self.currentCustomerId && typeof window.APP.showCustomerPaymentHistory === 'function') {
                    await window.APP.showCustomerPaymentHistory(self.currentCustomerId);
                } else {
                    await self.renderDashboard();
                }
            },
            blacklist: async () => { if (typeof window.APP.showBlacklist === 'function') await window.APP.showBlacklist(); else await self.renderDashboard(); }
        };
        var handler = handlers[this.currentPage];
        if (handler) await handler();
        else await self.renderDashboard();
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
        
        switch(page) {
            case 'orderTable':
                if (typeof window.APP.showOrderTable === 'function') window.APP.showOrderTable();
                else self.renderDashboard();
                break;
            case 'createOrder':
                if (typeof window.APP.showCreateOrder === 'function') window.APP.showCreateOrder();
                else self.showCreateOrder();
                break;
            case 'dashboard':
                self.renderDashboard();
                break;
            case 'anomaly':
                if (typeof window.APP.showAnomaly === 'function') window.APP.showAnomaly();
                else self.renderDashboard();
                break;
            case 'userManagement':
                if (typeof window.APP.showUserManagement === 'function') window.APP.showUserManagement();
                else self.renderDashboard();
                break;
            case 'storeManagement':
                if (typeof StoreManager.renderStoreManagement === 'function') StoreManager.renderStoreManagement();
                else self.renderDashboard();
                break;
            case 'expenses':
                if (typeof window.APP.showExpenses === 'function') window.APP.showExpenses();
                else self.renderDashboard();
                break;
            case 'customers':
                if (typeof window.APP.showCustomers === 'function') window.APP.showCustomers();
                else self.renderDashboard();
                break;
            case 'paymentHistory':
                if (typeof window.APP.showPaymentHistory === 'function') window.APP.showPaymentHistory();
                else self.renderDashboard();
                break;
            case 'backupRestore':
                if (typeof Storage.renderBackupUI === 'function') Storage.renderBackupUI();
                else self.renderDashboard();
                break;
            case 'customerOrders':
                if (params.customerId && typeof window.APP.showCustomerOrders === 'function') {
                    window.APP.showCustomerOrders(params.customerId);
                } else {
                    self.renderDashboard();
                }
                break;
            case 'customerPaymentHistory':
                if (params.customerId && typeof window.APP.showCustomerPaymentHistory === 'function') {
                    window.APP.showCustomerPaymentHistory(params.customerId);
                } else {
                    self.renderDashboard();
                }
                break;
            case 'viewOrder':
                if (params.orderId && typeof window.APP.viewOrder === 'function') {
                    window.APP.viewOrder(params.orderId);
                } else {
                    self.renderDashboard();
                }
                break;
            case 'payment':
                if (params.orderId && typeof window.APP.showPayment === 'function') {
                    window.APP.showPayment(params.orderId);
                } else {
                    self.renderDashboard();
                }
                break;
            case 'blacklist':
                if (typeof window.APP.showBlacklist === 'function') window.APP.showBlacklist();
                else self.renderDashboard();
                break;
            default:
                self.renderDashboard();
        }
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
            
            switch(prev.page) {
                case 'orderTable':
                    if (typeof window.APP.showOrderTable === 'function') window.APP.showOrderTable();
                    else self.renderDashboard();
                    break;
                case 'dashboard':
                    self.renderDashboard();
                    break;
                case 'viewOrder':
                    if (prev.orderId && typeof window.APP.viewOrder === 'function') {
                        window.APP.viewOrder(prev.orderId);
                    } else {
                        self.renderDashboard();
                    }
                    break;
                case 'anomaly':
                    if (typeof window.APP.showAnomaly === 'function') window.APP.showAnomaly();
                    else self.renderDashboard();
                    break;
                case 'userManagement':
                    if (typeof window.APP.showUserManagement === 'function') window.APP.showUserManagement();
                    else self.renderDashboard();
                    break;
                case 'storeManagement':
                    if (typeof StoreManager.renderStoreManagement === 'function') StoreManager.renderStoreManagement();
                    else self.renderDashboard();
                    break;
                case 'expenses':
                    if (typeof window.APP.showExpenses === 'function') window.APP.showExpenses();
                    else self.renderDashboard();
                    break;
                case 'customers':
                    if (typeof window.APP.showCustomers === 'function') window.APP.showCustomers();
                    else self.renderDashboard();
                    break;
                case 'paymentHistory':
                    if (typeof window.APP.showPaymentHistory === 'function') window.APP.showPaymentHistory();
                    else self.renderDashboard();
                    break;
                case 'backupRestore':
                    if (typeof Storage.renderBackupUI === 'function') Storage.renderBackupUI();
                    else self.renderDashboard();
                    break;
                case 'customerOrders':
                    if (prev.customerId && typeof window.APP.showCustomerOrders === 'function') {
                        window.APP.showCustomerOrders(prev.customerId);
                    } else {
                        self.renderDashboard();
                    }
                    break;
                case 'customerPaymentHistory':
                    if (prev.customerId && typeof window.APP.showCustomerPaymentHistory === 'function') {
                        window.APP.showCustomerPaymentHistory(prev.customerId);
                    } else {
                        self.renderDashboard();
                    }
                    break;
                case 'blacklist':
                    if (typeof window.APP.showBlacklist === 'function') window.APP.showBlacklist();
                    else self.renderDashboard();
                    break;
                default:
                    self.renderDashboard();
            }
        } else {
            this.renderDashboard();
        }
    },

    // ==================== 登录认证 ====================
    renderLogin: async function() {
        this.currentPage = 'login';
        this.clearPageState();
        
        Utils.initLanguage();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        document.getElementById("app").innerHTML = '' +
            '<div class="login-container">' +
                '<div class="login-box">' +
                    '<div class="lang-toggle">' +
                        '<button onclick="APP.toggleLanguageOnLogin()" class="lang-btn">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
                    '</div>' +
                    '<h2 class="login-title"><img src="icons/pagehead-logo.png" alt="JF!" class="login-logo"> JF! by Gadai</h2>' +
                    '<h3>' + t('login') + '</h3>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Email / Username' : '邮箱 / 用户名') + '</label>' +
                        '<input id="username" placeholder="email@domain.com">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + t('password') + '</label>' +
                        '<input id="password" type="password" placeholder="' + t('password') + '">' +
                    '</div>' +
                    '<button onclick="APP.login()">' + t('login') + '</button>' +
                    '<p class="login-note">' +
                        'ℹ️ ' + (lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号') +
                    '</p>' +
                '</div>' +
            '</div>';
    },

    toggleLanguageOnLogin: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        this.renderLogin();
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
        await this.router();
    },

    // ==================== 保存退出功能 ====================
    logout: async function() {
        var confirmMsg = Utils.t('save_exit_confirm');
        
        if (!confirm(confirmMsg)) return;
        
        var hasUnsavedData = this._checkHasUnsavedData();
        
        if (hasUnsavedData) {
            var loadingMsg = this._showSavingMessage(Utils.lang === 'id' ? 'Menyimpan data...' : '正在保存数据...');
            try {
                await this._saveCurrentPageData();
                this._hideSavingMessage(loadingMsg);
            } catch (saveError) {
                console.error("保存数据失败:", saveError);
                this._hideSavingMessage(loadingMsg);
                var errorMsg = Utils.lang === 'id'
                    ? '⚠️ Gagal menyimpan data: ' + saveError.message + 'Tetap keluar?'
                    : '⚠️ 保存数据失败：' + saveError.message + '是否仍然退出？';
                if (!confirm(errorMsg)) return;
            }
        }
        
        this.clearPageState();
        sessionStorage.clear();
        await AUTH.logout();
        await this.router();
    },
    
    _checkHasUnsavedData: function() {
        var currentPage = this.currentPage;
        
        switch(currentPage) {
            case 'customers':
                var customerName = document.getElementById("customerName");
                if (customerName && customerName.value && customerName.value.trim()) {
                    return true;
                }
                break;
                
            case 'expenses':
                var expenseAmount = document.getElementById("expenseAmount");
                if (expenseAmount && expenseAmount.value && parseFloat(expenseAmount.value.replace(/[,\s]/g, '')) > 0) {
                    return true;
                }
                break;
                
            default:
                break;
        }
        
        return false;
    },
    
    _showSavingMessage: function(message) {
        var div = document.createElement('div');
        div.id = 'saving-overlay';
        div.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10001; display:flex; align-items:center; justify-content:center;';
        div.innerHTML = '<div style="background:white; padding:20px 40px; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:12px;">' +
            '<div class="loader" style="width:36px; height:36px; border:3px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>' +
            '<p style="margin:0; font-size:14px;">' + message + '</p>' +
        '</div>';
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
        var hasSaved = false;
        
        switch(currentPage) {
            case 'customers':
                var customerName = document.getElementById("customerName");
                if (customerName && customerName.value && customerName.value.trim()) {
                    console.log("检测到未保存的客户信息，正在自动保存...");
                    if (typeof window.APP.addCustomer === 'function') {
                        await window.APP.addCustomer();
                        hasSaved = true;
                    }
                }
                break;
                
            case 'expenses':
                var expenseAmount = document.getElementById("expenseAmount");
                if (expenseAmount && expenseAmount.value && parseFloat(expenseAmount.value.replace(/[,\s]/g, '')) > 0) {
                    console.log("检测到未保存的支出信息，正在自动保存...");
                    if (typeof window.APP.addExpense === 'function') {
                        await window.APP.addExpense();
                        hasSaved = true;
                    }
                }
                break;
                
            default:
                console.log('当前页面 (' + currentPage + ') 无需自动保存数据');
                break;
        }
        
        if (hasSaved) {
            await new Promise(function(resolve) { setTimeout(resolve, 300); });
        }
        
        return true;
    },

    toggleLanguage: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        if (this.currentPage === 'login' || !AUTH.isLoggedIn()) this.renderLogin();
        else this.refreshCurrentPage();
    },

    // ==================== 仪表盘 ====================
    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        this.saveCurrentPageState();
        
        try {
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            
            // 构建并行查询列表
            const queries = [
                SUPABASE.getOrders(),
                SUPABASE.getCashFlowRecords(),
                SUPABASE.getOrdersNeedReminder(),
                SUPABASE.getAllStores()
            ];
            
            if (isAdmin) {
                queries.push(
                    supabaseClient.from('expenses').select('amount')
                );
            } else if (storeId) {
                queries.push(
                    supabaseClient.from('expenses').select('amount').eq('store_id', storeId)
                );
            } else {
                queries.push(Promise.resolve({ data: [] }));
            }
            
            if (!isAdmin && storeId) {
                queries.push(
                    supabaseClient.from('cash_flow_records')
                        .select('direction, amount, source_target, flow_type')
                        .eq('store_id', storeId)
                        .eq('is_voided', false)
                );
            } else {
                queries.push(Promise.resolve([]));
            }
            
            const [
                allOrders,
                allCashFlows,
                needRemindOrders,
                stores,
                expensesResult,
                storeSpecificCashFlows
            ] = await Promise.all(queries);
            
            // 计算报表
            var report = this._calculateReport(allOrders);
            
            // 构建门店映射
            var storeMap = {};
            for (var s of stores) {
                storeMap[s.id] = s.name;
            }
            
            // 计算本月新增订单数
            var today = new Date();
            var currentMonth = today.getMonth();
            var currentYear = today.getFullYear();
            var thisMonthOrderCount = 0;
            for (var i = 0; i < allOrders.length; i++) {
                var orderDate = new Date(allOrders[i].created_at);
                if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
                    thisMonthOrderCount++;
                }
            }
            
            // 计算总支出
            var totalExpenses = 0;
            var expenses = expensesResult?.data || expensesResult || [];
            if (Array.isArray(expenses)) {
                for (var i = 0; i < expenses.length; i++) {
                    totalExpenses += (expenses[i].amount || 0);
                }
            }
            
            // 计算资金流水摘要
            var cashFlow = this._calculateCashFlowSummary(allCashFlows, isAdmin, storeId, storeSpecificCashFlows);
            
            // 修复：安全处理 flowsToAnalyze
            var flowsToAnalyze = [];
            if (!isAdmin && storeSpecificCashFlows && Array.isArray(storeSpecificCashFlows)) {
                flowsToAnalyze = storeSpecificCashFlows;
            } else if (allCashFlows && Array.isArray(allCashFlows)) {
                flowsToAnalyze = allCashFlows;
            }
            
            var totalInflowExcludingPrincipal = 0;
            var totalOutflow = 0;
            for (var i = 0; i < flowsToAnalyze.length; i++) {
                var f = flowsToAnalyze[i];
                var amount = f.amount || 0;
                if (f.direction === 'inflow' && f.flow_type !== 'principal') {
                    totalInflowExcludingPrincipal += amount;
                } else if (f.direction === 'outflow') {
                    totalOutflow += amount;
                }
            }
            var deficit = totalOutflow - totalInflowExcludingPrincipal;
            
            // 清理过期订单
            var twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            
            var expiredOrders = [];
            for (var i = 0; i < allOrders.length; i++) {
                var o = allOrders[i];
                if (o.status === 'completed') {
                    var completedDate = o.completed_at || o.updated_at;
                    if (completedDate && new Date(completedDate) < twoYearsAgo) {
                        expiredOrders.push(o);
                    }
                }
            }
            
            if (expiredOrders.length > 0) {
                console.log('检测到 ' + expiredOrders.length + ' 个已结清超过2年的订单，正在自动清理...');
                for (var i = 0; i < expiredOrders.length; i++) {
                    try {
                        await supabaseClient.from('cash_flow_records').delete().eq('order_id', expiredOrders[i].id);
                        await supabaseClient.from('payment_history').delete().eq('order_id', expiredOrders[i].id);
                        await supabaseClient.from('orders').delete().eq('id', expiredOrders[i].id);
                        console.log('已清理过期订单: ' + expiredOrders[i].order_id);
                    } catch (cleanErr) {
                        console.warn('清理订单 ' + expiredOrders[i].order_id + ' 失败:', cleanErr);
                    }
                }
                var updatedOrders = await SUPABASE.getOrders();
            } else {
                var updatedOrders = allOrders;
            }
            
            // 计算活跃和已完成订单数
            var activeOrdersCount = 0;
            var completedOrdersCount = 0;
            for (var i = 0; i < updatedOrders.length; i++) {
                if (updatedOrders[i].status === 'active') activeOrdersCount++;
                else if (updatedOrders[i].status === 'completed') completedOrdersCount++;
            }
            var expiredCount = expiredOrders.length;
            
            // 渲染仪表盘
            var storeName = AUTH.getCurrentStoreName();
            var hasReminders = needRemindOrders.length > 0;
            var hasSentToday = false;
            try {
                hasSentToday = await (window.APP.hasSentRemindersToday ? window.APP.hasSentRemindersToday() : Promise.resolve(false));
            } catch(e) {
                hasSentToday = false;
            }
            var btnDisabled = hasSentToday;
            var btnHighlight = hasReminders && !hasSentToday;
            
            // 卡片数据
            var cards = [
                { label: (lang === 'id' ? 'Bulan ini' : '本月新增') + '/' + t('total_orders'), value: thisMonthOrderCount + '/' + report.total_orders, type: 'text' },
                { label: lang === 'id' ? 'Defisit (Keluar - Masuk)' : '赤字 (流出-流入)', value: Utils.formatCurrency(deficit), type: 'currency', class: deficit >= 0 ? 'expense' : 'income' },
                { label: t('active'), value: activeOrdersCount, type: 'number' },
                { label: (lang === 'id' ? 'Lunas' : '已结清') + ' / ' + (lang === 'id' ? 'Kedaluwarsa' : '已失效'), value: completedOrdersCount + ' / ' + expiredCount, type: 'text' },
                { label: t('admin_fee'), value: Utils.formatCurrency(report.total_admin_fees), type: 'currency', class: 'income' },
                { label: t('service_fee'), value: Utils.formatCurrency(report.total_service_fees || 0), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Bunga Diterima' : '已收利息', value: Utils.formatCurrency(report.total_interest), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Total Pengeluaran' : '支出汇总', value: Utils.formatCurrency(totalExpenses), type: 'currency', class: 'expense' }
            ];
            
            var cardsHtml = '';
            for (var i = 0; i < cards.length; i++) {
                cardsHtml += '<div class="stat-card ' + (cards[i].class || '') + '">' +
                    '<div class="stat-value ' + (cards[i].class || '') + '">' + cards[i].value + '</div>' +
                    '<div class="stat-label">' + cards[i].label + '</div>' +
                '</div>';
            }
            
            var cardsTitleHtml = '';
            if (isAdmin) {
                cardsTitleHtml = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
                    '<h3 style="margin:0; font-size:16px; font-weight:600; color: var(--gray-700);">📊 ' + t('financial_indicators') + ' (' + (lang === 'id' ? 'Semua Toko' : '全部门店') + ')</h3>' +
                '</div>';
            } else {
                cardsTitleHtml = '<div style="margin-bottom:12px;">' +
                    '<h3 style="margin:0; font-size:16px; font-weight:600; color: var(--gray-700);">📊 ' + t('financial_indicators') + '</h3>' +
                '</div>';
            }
            
            var toolbarTitleHtml = '<div style="margin: 20px 0 12px 0;">' +
                '<h3 style="margin:0; font-size:16px; font-weight:600; color: var(--gray-700);">📋 ' + t('operation') + '</h3>' +
            '</div>';
            
            var cashBalance = cashFlow.cash?.balance ?? 0;
            var bankBalance = cashFlow.bank?.balance ?? 0;
            var cashIncome = cashFlow.cash?.income ?? 0;
            var cashExpense = cashFlow.cash?.expense ?? 0;
            var bankIncome = cashFlow.bank?.income ?? 0;
            var bankExpense = cashFlow.bank?.expense ?? 0;
            
            var cashFlowHtml = '';
            if (isAdmin) {
                cashFlowHtml = '' +
                '<div class="cashflow-summary">' +
                    '<h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">💰 ' + t('fund_management') + ' (' + (lang === 'id' ? 'Semua Toko' : '全部门店') + ')</h3>' +
                    '<div class="cashflow-stats">' +
                        '<div class="cashflow-item">' +
                            '<div class="label">🏦 ' + (lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)') + '</div>' +
                            '<div class="value ' + (cashBalance < 0 ? 'negative' : '') + '">' + Utils.formatCurrency(cashBalance) + '</div>' +
                            '<div class="cashflow-detail">' +
                                t('inflow') + ': +' + Utils.formatCurrency(cashIncome) + '<br>' +
                                t('outflow') + ': -' + Utils.formatCurrency(cashExpense) +
                            '</div>' +
                        '</div>' +
                        '<div class="cashflow-item">' +
                            '<div class="label">🏧 ' + (lang === 'id' ? 'Bank BNI' : '银行 BNI') + '</div>' +
                            '<div class="value ' + (bankBalance < 0 ? 'negative' : '') + '">' + Utils.formatCurrency(bankBalance) + '</div>' +
                            '<div class="cashflow-detail">' +
                                t('inflow') + ': +' + Utils.formatCurrency(bankIncome) + '<br>' +
                                t('outflow') + ': -' + Utils.formatCurrency(bankExpense) +
                            '</div>' +
                        '</div>' +
                        '<div class="cashflow-item internal-transfer-item">' +
                            '<div class="label">🔄 ' + t('internal_transfer') + '</div>' +
                            '<div class="transfer-buttons">' +
                                '<button onclick="APP.showTransferModal(\'cash_to_bank\')" class="transfer-btn cash-to-bank">🏦→🏧 ' + t('cash_to_bank') + '</button>' +
                                '<button onclick="APP.showTransferModal(\'bank_to_cash\')" class="transfer-btn bank-to-cash">🏧→🏦 ' + t('bank_to_cash') + '</button>' +
                                '<button onclick="APP.showTransferModal(\'store_to_hq\')" class="transfer-btn store-to-hq">🏢 ' + t('submit_to_hq') + '</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            } else {
                cashFlowHtml = '' +
                '<div class="cashflow-summary">' +
                    '<h3 style="margin:0 0 16px 0; font-size:16px; font-weight:600;">💰 ' + t('fund_management') + '</h3>' +
                    '<div class="cashflow-stats">' +
                        '<div class="cashflow-item">' +
                            '<div class="label">🏦 ' + (lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)') + '</div>' +
                            '<div class="value ' + (cashBalance < 0 ? 'negative' : '') + '">' + Utils.formatCurrency(cashBalance) + '</div>' +
                            '<div class="cashflow-detail">' +
                                t('inflow') + ': +' + Utils.formatCurrency(cashIncome) + '<br>' +
                                t('outflow') + ': -' + Utils.formatCurrency(cashExpense) +
                            '</div>' +
                        '</div>' +
                        '<div class="cashflow-item">' +
                            '<div class="label">🏧 ' + (lang === 'id' ? 'Bank BNI' : '银行 BNI') + '</div>' +
                            '<div class="value ' + (bankBalance < 0 ? 'negative' : '') + '">' + Utils.formatCurrency(bankBalance) + '</div>' +
                            '<div class="cashflow-detail">' +
                                t('inflow') + ': +' + Utils.formatCurrency(bankIncome) + '<br>' +
                                t('outflow') + ': -' + Utils.formatCurrency(bankExpense) +
                            '</div>' +
                        '</div>' +
                        '<div class="cashflow-item internal-transfer-item">' +
                            '<div class="label">🔄 ' + t('internal_transfer') + '</div>' +
                            '<div class="transfer-buttons">' +
                                '<button onclick="APP.showTransferModal(\'cash_to_bank\')" class="transfer-btn cash-to-bank">🏦→🏧 ' + t('cash_to_bank') + '</button>' +
                                '<button onclick="APP.showTransferModal(\'bank_to_cash\')" class="transfer-btn bank-to-cash">🏧→🏦 ' + t('bank_to_cash') + '</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }
            
            var toolbarHtml = '';
            if (isAdmin) {
                toolbarHtml = '' +
                '<div class="toolbar admin-grid">' +
                    '<button onclick="APP.navigateTo(\'customers\')">👥 ' + t('customers') + '</button>' +
                    '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
                    '<button onclick="APP.navigateTo(\'paymentHistory\')">💰 ' + t('payment_history') + '</button>' +
                    '<button onclick="APP.navigateTo(\'expenses\')">📝 ' + t('expenses') + '</button>' +
                    '<button onclick="APP.navigateTo(\'backupRestore\')">💾 ' + t('backup_restore') + '</button>' +
                    '<button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ' + (btnHighlight ? 'highlight' : '') + '" ' + (btnDisabled ? 'disabled' : '') + '>🔔 ' + t('send_reminder') + ' ' + (hasReminders ? '(' + needRemindOrders.length + ')' : '') + '</button>' +
                    '<button onclick="APP.navigateTo(\'anomaly\')">⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</button>' +
                    '<button onclick="APP.navigateTo(\'userManagement\')">👤 ' + t('user_management') + '</button>' +
                    '<button onclick="APP.navigateTo(\'storeManagement\')">🏪 ' + t('store_management') + '</button>' +
                    '<button onclick="APP.logout()">💾 ' + t('save_exit') + '</button>' +
                '</div>';
            } else {
                toolbarHtml = '' +
                '<div class="toolbar store-grid">' +
                    '<button onclick="APP.navigateTo(\'customers\')">👥 ' + t('customers') + '</button>' +
                    '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
                    '<button onclick="APP.showCashFlowModal()">💰 ' + t('payment_history') + '</button>' +
                    '<button onclick="APP.navigateTo(\'expenses\')">📝 ' + t('expenses') + '</button>' +
                    '<button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ' + (btnHighlight ? 'highlight' : '') + '" ' + (btnDisabled ? 'disabled' : '') + '>🔔 ' + t('send_reminder') + ' ' + (hasReminders ? '(' + needRemindOrders.length + ')' : '') + '</button>' +
                    '<button onclick="APP.logout()">💾 ' + t('save_exit') + '</button>' +
                '</div>';
            }
            
            var bottomHtml = '' +
'<div class="card dashboard-footer-card">' +
    '<h3>' + t('current_user') + ': ' + Utils.escapeHtml(AUTH.user.name) + ' (' + (AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长')) + ')</h3>' +
    '<p>🏪 ' + t('store') + ': ' + Utils.escapeHtml(storeName) + (isAdmin ? ' (' + (lang === 'id' ? 'Kantor Pusat - Seluruh Toko' : '总部 - 全部门店') + ')' : '') + '</p>' +
    '<p>📌 ' + (lang === 'id' ? 'Admin Fee: (dibayar saat kontrak) | Bunga: 10% per bulan | Service Fee: (diskon, dibayar sekali)' : '管理费: (签合同支付) | 利息: 10%/月 | 服务费: (优惠，仅收一次)') + '</p>' +
    '<p>🔒 ' + (lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改') + '</p>' +
'</div>';
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h1><img src="icons/pagehead-logo.png" alt="JF!" class="logo-img"> JF! by Gadai</h1>' +
                    '<div class="header-actions">' +
                        (this.historyStack.length > 0 ? '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' : '') +
                    '</div>' +
                '</div>' +
                cashFlowHtml +
                cardsTitleHtml +
                '<div class="stats-grid-optimized">' + cardsHtml + '</div>' +
                toolbarTitleHtml +
                toolbarHtml +
                bottomHtml;
            
        } catch (err) {
            console.error("renderDashboard error:", err);
            document.getElementById("app").innerHTML = '<div class="card"><p>⚠️ ' + err.message + '</p><button onclick="APP.logout()">💾 ' + Utils.t('save_exit') + '</button></div>';
        }
    },

    // ==================== 辅助方法 ====================
    
    _calculateReport: function(orders) {
        var totalLoanAmount = 0;
        var totalAdminFees = 0;
        var totalServiceFees = 0;
        var totalInterest = 0;
        var totalPrincipal = 0;
        var activeCount = 0;
        var completedCount = 0;
        var expectedMonthlyInterest = 0;
        
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            totalLoanAmount += (o.loan_amount || 0);
            
            if (o.admin_fee_paid) totalAdminFees += (o.admin_fee || 0);
            totalServiceFees += (o.service_fee_paid || 0);
            totalInterest += (o.interest_paid_total || 0);
            totalPrincipal += (o.principal_paid || 0);
            
            if (o.status === 'active') {
                activeCount++;
                var remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                expectedMonthlyInterest += remainingPrincipal * (o.agreed_interest_rate || 0.08);
            } else if (o.status === 'completed') {
                completedCount++;
            }
        }
        
        return {
            total_orders: orders.length,
            active_orders: activeCount,
            completed_orders: completedCount,
            total_loan_amount: totalLoanAmount,
            total_admin_fees: totalAdminFees,
            total_service_fees: totalServiceFees,
            total_interest: totalInterest,
            total_principal: totalPrincipal,
            expected_monthly_interest: expectedMonthlyInterest
        };
    },
    
    _calculateCashFlowSummary: function(allFlows, isAdmin, storeId, storeSpecificFlows) {
        var cashInflow = 0, cashOutflow = 0;
        var bankInflow = 0, bankOutflow = 0;
        
        var flowsToUse = [];
        if (!isAdmin && storeSpecificFlows && Array.isArray(storeSpecificFlows)) {
            flowsToUse = storeSpecificFlows;
        } else if (allFlows && Array.isArray(allFlows)) {
            flowsToUse = allFlows;
        }
        
        for (var i = 0; i < flowsToUse.length; i++) {
            var flow = flowsToUse[i];
            var amount = flow.amount || 0;
            if (flow.direction === 'inflow') {
                if (flow.source_target === 'cash') cashInflow += amount;
                else if (flow.source_target === 'bank') bankInflow += amount;
            } else if (flow.direction === 'outflow') {
                if (flow.source_target === 'cash') cashOutflow += amount;
                else if (flow.source_target === 'bank') bankOutflow += amount;
            }
        }
        
        return {
            cash: { income: cashInflow, expense: cashOutflow, balance: cashInflow - cashOutflow },
            bank: { income: bankInflow, expense: bankOutflow, balance: bankInflow - bankOutflow }
        };
    },

    showCreateOrder: function() { 
        alert(Utils.lang === 'id' ? 'Silakan pilih nasabah terlebih dahulu' : '请先选择客户'); 
        this.navigateTo('customers'); 
    },
    
    showBlacklist: async function() {
        if (typeof window.APP.showBlacklist === 'function') {
            await window.APP.showBlacklist();
        } else {
            alert(Utils.lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
        }
    },

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
        if (!confirm(Utils.t('confirm_delete'))) return;
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
    if (typeof DashboardCore[key] === 'function' && 
        key !== 'showExpenses' && key !== 'showOrderTable' && key !== 'showReport' && 
        key !== 'showUserManagement' && key !== 'showCustomers' && key !== 'showPaymentHistory' && 
        key !== 'viewOrder' && key !== 'showPayment' && key !== 'showCustomerOrders' && 
        key !== 'showCustomerPaymentHistory') {
        window.APP[key] = DashboardCore[key];
    }
}

window.APP.currentFilter = DashboardCore.currentFilter;
window.APP.historyStack = DashboardCore.historyStack;
window.APP.currentPage = DashboardCore.currentPage;
window.APP.currentOrderId = DashboardCore.currentOrderId;
window.APP.currentCustomerId = DashboardCore.currentCustomerId;
