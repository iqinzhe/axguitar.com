// app-dashboard-core.js - v3.1（性能优化：聚合查询替代全量加载 + 数据缓存 + 滚动重置）

window.APP = window.APP || {};

// ==================== 仪表盘缓存模块 ====================
const DashboardCache = {
    data: new Map(),
    ttl: 5 * 60 * 1000,  // 5分钟缓存
    
    getKey(...parts) {
        return parts.join(':');
    },
    
    async get(key, fetcher, forceRefresh = false) {
        if (!forceRefresh) {
            const cached = this.data.get(key);
            if (cached && Date.now() - cached.time < this.ttl) {
                console.log(`[Cache] Hit: ${key}`);
                return cached.value;
            }
        }
        console.log(`[Cache] Miss: ${key}`);
        const value = await fetcher();
        this.data.set(key, { value, time: Date.now() });
        return value;
    },
    
    invalidate(key) {
        if (key) {
            this.data.delete(key);
            console.log(`[Cache] Invalidated: ${key}`);
        } else {
            this.data.clear();
            console.log(`[Cache] Cleared all`);
        }
    },
    
    // 批量失效
    invalidateMany(keys) {
        for (const key of keys) {
            this.data.delete(key);
        }
        console.log(`[Cache] Invalidated: ${keys.join(', ')}`);
    }
};

// ==================== 聚合查询辅助方法 ====================
const DashboardStatsHelper = {
    /**
     * 获取仪表盘统计数据（使用聚合查询，不拉取全量订单）
     */
    async getDashboardStats(profile) {
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        // 构建基础查询条件
        let baseQuery = supabaseClient.from('orders');
        if (!isAdmin && storeId) {
            baseQuery = baseQuery.eq('store_id', storeId);
        }
        
        // 并行执行多个聚合查询
        const [
            totalCountResult,
            activeCountResult,
            completedCountResult,
            overdueCountResult,
            activeOrdersData,
            loanSumData
        ] = await Promise.all([
            baseQuery.select('*', { count: 'exact', head: true }),
            baseQuery.eq('status', 'active').select('*', { count: 'exact', head: true }),
            baseQuery.eq('status', 'completed').select('*', { count: 'exact', head: true }),
            baseQuery.eq('status', 'active').gte('overdue_days', 1).select('*', { count: 'exact', head: true }),
            // 获取活跃订单的财务数据用于汇总
            baseQuery.eq('status', 'active').select('admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid, loan_amount'),
            // 获取所有订单的贷款金额统计
            baseQuery.select('loan_amount')
        ]);
        
        // 计算汇总金额（仅对活跃订单，数据量已大幅减少）
        let totalAdminFees = 0;
        let totalServiceFees = 0;
        let totalInterest = 0;
        let totalPrincipal = 0;
        let totalActiveLoanAmount = 0;
        
        const activeOrders = activeOrdersData?.data || [];
        for (const order of activeOrders) {
            if (order.admin_fee_paid) totalAdminFees += (order.admin_fee || 0);
            totalServiceFees += (order.service_fee_paid || 0);
            totalInterest += (order.interest_paid_total || 0);
            totalPrincipal += (order.principal_paid || 0);
            totalActiveLoanAmount += (order.loan_amount || 0);
        }
        
        // 计算总贷款金额（全量订单）
        let totalLoanAmount = 0;
        const allOrdersLoanData = loanSumData?.data || [];
        for (const order of allOrdersLoanData) {
            totalLoanAmount += (order.loan_amount || 0);
        }
        
        return {
            total_orders: totalCountResult?.count || 0,
            active_orders: activeCountResult?.count || 0,
            completed_orders: completedCountResult?.count || 0,
            overdue_orders: overdueCountResult?.count || 0,
            total_loan_amount: totalLoanAmount,
            total_active_loan_amount: totalActiveLoanAmount,
            total_admin_fees: totalAdminFees,
            total_service_fees: totalServiceFees,
            total_interest: totalInterest,
            total_principal: totalPrincipal
        };
    },
    
    /**
     * 获取异常状况统计数据（仅统计，不拉取全部明细）
     */
    async getAnomalyStats(profile) {
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        let query = supabaseClient.from('orders');
        if (!isAdmin && storeId) {
            query = query.eq('store_id', storeId);
        }
        
        const [overdue30Result, blacklistResult] = await Promise.all([
            query.eq('status', 'active').gte('overdue_days', 30).select('*', { count: 'exact', head: true }),
            supabaseClient.from('blacklist').select('*', { count: 'exact', head: true })
        ]);
        
        return {
            overdue30Count: overdue30Result?.count || 0,
            blacklistCount: blacklistResult?.count || 0
        };
    },
    
    /**
     * 获取本月门店排名数据（使用聚合查询）
     */
    async getMonthlyStoreRanking(profile, stores) {
        const isAdmin = profile?.role === 'admin';
        if (!isAdmin) return null;
        
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const monthEnd = today.toISOString().split('T')[0];
        
        // 获取本月所有订单（只获取必要字段）
        const { data: monthlyOrders, error } = await supabaseClient
            .from('orders')
            .select('id, store_id, loan_amount, status, created_at, overdue_days')
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd);
        
        if (error) throw error;
        
        // 获取本月还款记录
        const { data: monthlyFlows } = await supabaseClient
            .from('cash_flow_records')
            .select('store_id, amount, order_id')
            .eq('direction', 'inflow')
            .eq('is_voided', false)
            .gte('recorded_at', monthStart);
        
        // 构建 flow 金额映射
        const flowAmountByOrder = {};
        if (monthlyFlows) {
            for (const flow of monthlyFlows) {
                if (flow.order_id) {
                    flowAmountByOrder[flow.order_id] = (flowAmountByOrder[flow.order_id] || 0) + (flow.amount || 0);
                }
            }
        }
        
        // 门店映射
        const storeInfoMap = {};
        for (const store of stores) {
            storeInfoMap[store.id] = {
                id: store.id,
                name: store.name,
                code: store.code,
                isActive: store.is_active !== false
            };
        }
        
        // 统计各门店数据
        const storeStats = {};
        for (const order of (monthlyOrders || [])) {
            const s = storeInfoMap[order.store_id];
            if (!s || !s.isActive || s.code === 'STORE_000') continue;
            
            if (!storeStats[order.store_id]) {
                storeStats[order.store_id] = {
                    id: order.store_id,
                    name: s.name,
                    code: s.code,
                    orderCount: 0,
                    totalLoanOutflow: 0,
                    badOrders: 0,
                    totalRecovery: 0
                };
            }
            
            storeStats[order.store_id].orderCount++;
            storeStats[order.store_id].totalLoanOutflow += (order.loan_amount || 0);
            
            if ((order.overdue_days || 0) >= 15 && order.status === 'active') {
                storeStats[order.store_id].badOrders++;
            }
            
            storeStats[order.store_id].totalRecovery += (flowAmountByOrder[order.id] || 0);
        }
        
        // 转换为数组并计算排名
        let eligibleStores = Object.values(storeStats);
        
        if (eligibleStores.length === 0) return { top3: [], bottom3: [] };
        
        // 计算排名分数
        for (const s of eligibleStores) {
            s.rankSum = 0;
        }
        
        // 按订单数排序
        eligibleStores.sort((a, b) => b.orderCount - a.orderCount);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankOrderCount = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按放款额排序（从小到大，越小越好）
        eligibleStores.sort((a, b) => a.totalLoanOutflow - b.totalLoanOutflow);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankLoanOutflow = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按不良订单数排序（从小到大，越小越好）
        eligibleStores.sort((a, b) => a.badOrders - b.badOrders);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankBadOrders = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按回收额排序（从大到小，越大越好）
        eligibleStores.sort((a, b) => b.totalRecovery - a.totalRecovery);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankRecovery = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按总分排序
        eligibleStores.sort((a, b) => a.rankSum - b.rankSum);
        
        const top3 = eligibleStores.slice(0, Math.min(3, eligibleStores.length));
        const bottom3 = eligibleStores.slice(-Math.min(3, eligibleStores.length)).reverse();
        
        return { top3, bottom3 };
    }
};

const DashboardCore = {
    currentFilter: "all",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

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

    init: async function() {
        // 初始化全局错误处理
        Utils.ErrorHandler.init();
        
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
        
        // 先渲染骨架屏
        var skeletonType = 'default';
        if (this.currentPage === 'dashboard') skeletonType = 'dashboard';
        else if (this.currentPage === 'orderTable' || this.currentPage === 'customers' || 
                 this.currentPage === 'paymentHistory' || this.currentPage === 'expenses') skeletonType = 'table';
        else if (this.currentPage === 'viewOrder' || this.currentPage === 'payment') skeletonType = 'detail';
        
        document.getElementById("app").innerHTML = Utils.renderSkeleton(skeletonType);
        
        // 短暂延迟让骨架屏渲染
        await new Promise(function(resolve) { setTimeout(resolve, 100); });
        
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
            paymentHistory: async () => { 
                if (typeof window.APP.showCashFlowPage === 'function') await window.APP.showCashFlowPage();
                else if (typeof window.APP.showPaymentHistory === 'function') await window.APP.showPaymentHistory();
                else await self.renderDashboard();
            },
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
        // 滚动到顶部
        window.scrollTo(0, 0);
        
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
                if (typeof window.APP.showCashFlowPage === 'function') window.APP.showCashFlowPage();
                else if (typeof window.APP.showPaymentHistory === 'function') window.APP.showPaymentHistory();
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
                    if (typeof window.APP.showCashFlowPage === 'function') window.APP.showCashFlowPage();
                    else if (typeof window.APP.showPaymentHistory === 'function') window.APP.showPaymentHistory();
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

    // ==================== 登录页 ====================
    renderLogin: async function() {
        this.currentPage = 'login';
        this.clearPageState();
        
        Utils.initLanguage();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        
        document.getElementById("app").innerHTML = '' +
            '<div class="login-container">' +
                '<div class="login-box">' +
                    '<div class="lang-toggle">' +
                        '<button onclick="APP.toggleLanguageOnLogin()" class="lang-btn">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">' +
                        '<img src="icons/pagehead-logo.png" alt="JF!" style="height:36px;">' +
                        '<h2 class="login-title" style="margin:0;">JF! by Gadai</h2>' +
                    '</div>' +
                    '<h3>' + t('login') + '</h3>' +
                    
                    '<div id="loginError" class="info-bar danger" style="display:none;margin-bottom:16px;">' +
                        '<span class="info-bar-icon">⚠️</span>' +
                        '<div class="info-bar-content" id="loginErrorMessage"></div>' +
                    '</div>' +
                    
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Email / Username' : '邮箱 / 用户名') + '</label>' +
                        '<input id="username" placeholder="email@domain.com" autocomplete="username">' +
                    '</div>' +
                    '<div class="form-group" style="position:relative;">' +
                        '<label>' + t('password') + '</label>' +
                        '<input id="password" type="password" placeholder="' + t('password') + '" autocomplete="current-password">' +
                        '<span onclick="Utils.togglePasswordVisibility(\'password\', this)" style="position:absolute;right:12px;top:38px;cursor:pointer;font-size:18px;user-select:none;z-index:2;">👁️</span>' +
                    '</div>' +
                    
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;font-size:var(--font-sm);">' +
                        '<input type="checkbox" id="rememberMe" style="width:16px;height:16px;cursor:pointer;">' +
                        '<label for="rememberMe" style="cursor:pointer;font-weight:500;">' + 
                            (lang === 'id' ? 'Ingat saya' : '记住我') + 
                        '</label>' +
                    '</div>' +
                    
                    '<button onclick="APP.login()" id="loginBtn">' + t('login') + '</button>' +
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
        var rememberMe = document.getElementById("rememberMe").checked;
        var errorDiv = document.getElementById("loginError");
        var errorMsg = document.getElementById("loginErrorMessage");
        var btnEl = document.getElementById("loginBtn");
        
        if (errorDiv) errorDiv.style.display = 'none';
        
        if (!username || !password) {
            if (errorDiv) {
                errorDiv.style.display = 'flex';
                errorMsg.textContent = Utils.t('fill_all_fields');
            }
            return;
        }
        
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }
        
        AUTH.setRememberMe(rememberMe);
        
        var user = await AUTH.login(username, password);
        if (!user) {
            if (errorDiv) {
                errorDiv.style.display = 'flex';
                errorMsg.textContent = Utils.lang === 'id' 
                    ? 'Login gagal. Periksa kembali email/username dan password Anda.'
                    : '登录失败，请检查邮箱/用户名和密码。';
            }
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = Utils.t('login'); }
            return;
        }
        await this.router();
    },

    clearLoginError: function() {
        var errorDiv = document.getElementById('loginError');
        if (errorDiv) errorDiv.style.display = 'none';
    },

    logout: async function() {
        var confirmMsg = Utils.t('save_exit_confirm');
        
        if (!confirm(confirmMsg)) return;
        
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

    // ==================== 仪表盘（性能优化版：使用聚合查询 + 缓存） ====================
    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        this.saveCurrentPageState();
        
        try {
            var lang = Utils.lang;
            var t = function(key) { return Utils.t(key); };
            
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            
            // 使用缓存获取统计数据（5分钟有效期）
            const cacheKey = DashboardCache.getKey('dashboard_stats', isAdmin ? 'admin' : storeId);
            const report = await DashboardCache.get(cacheKey, 
                () => DashboardStatsHelper.getDashboardStats(profile)
            );
            
            // 获取现金流数据（保持原有逻辑，但使用缓存）
            const cashFlowCacheKey = DashboardCache.getKey('cashflow', isAdmin ? 'admin' : storeId);
            const cashFlow = await DashboardCache.get(cashFlowCacheKey,
                async () => {
                    const allCashFlows = await SUPABASE.getCashFlowRecords();
                    const storeSpecificCashFlows = !isAdmin && storeId 
                        ? await supabaseClient.from('cash_flow_records')
                            .select('direction, amount, source_target, flow_type')
                            .eq('store_id', storeId)
                            .eq('is_voided', false)
                            .then(res => res.data || [])
                        : [];
                    return this._calculateCashFlowSummary(allCashFlows, isAdmin, storeId, storeSpecificCashFlows);
                }
            );
            
            // 获取支出汇总
            const expensesCacheKey = DashboardCache.getKey('expenses', isAdmin ? 'admin' : storeId);
            const totalExpenses = await DashboardCache.get(expensesCacheKey, async () => {
                let query = supabaseClient.from('expenses').select('amount');
                if (!isAdmin && storeId) {
                    query = query.eq('store_id', storeId);
                }
                const { data } = await query;
                let sum = 0;
                for (const ex of (data || [])) sum += (ex.amount || 0);
                return sum;
            });
            
            // 获取本月订单数
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
            
            const monthOrdersCacheKey = DashboardCache.getKey('month_orders', isAdmin ? 'admin' : storeId, currentYear, currentMonth);
            let thisMonthOrderCount = await DashboardCache.get(monthOrdersCacheKey, async () => {
                let query = supabaseClient.from('orders').select('created_at', { count: 'exact', head: true });
                if (!isAdmin && storeId) query = query.eq('store_id', storeId);
                query = query.gte('created_at', monthStart);
                const { count } = await query;
                return count || 0;
            });
            
            // 获取催收提醒数据
            const needRemindOrders = await SUPABASE.getOrdersNeedReminder();
            const hasReminders = needRemindOrders.length > 0;
            let hasSentToday = false;
            try {
                hasSentToday = await (window.APP.hasSentRemindersToday ? window.APP.hasSentRemindersToday() : Promise.resolve(false));
            } catch(e) {
                hasSentToday = false;
            }
            const btnDisabled = hasSentToday;
            const btnHighlight = hasReminders && !hasSentToday;
            
            // 统计逾期订单数（使用 report 中的值）
            const overdueOrdersCount = report.overdue_orders || 0;
            const activeDisplay = report.active_orders + (overdueOrdersCount > 0 ? ' / ⚠️ ' + overdueOrdersCount : '');
            
            // 计算赤字
            const flowsForDeficit = await DashboardCache.get(DashboardCache.getKey('flows_for_deficit', isAdmin ? 'admin' : storeId), async () => {
                let flows;
                if (!isAdmin && storeId) {
                    const { data } = await supabaseClient
                        .from('cash_flow_records')
                        .select('direction, amount, flow_type')
                        .eq('store_id', storeId)
                        .eq('is_voided', false);
                    flows = data || [];
                } else {
                    const { data } = await supabaseClient
                        .from('cash_flow_records')
                        .select('direction, amount, flow_type')
                        .eq('is_voided', false);
                    flows = data || [];
                }
                return flows;
            });
            
            let totalInflowExcludingPrincipal = 0;
            let totalOutflow = 0;
            for (const f of flowsForDeficit) {
                const amount = f.amount || 0;
                if (f.direction === 'inflow' && f.flow_type !== 'principal') {
                    totalInflowExcludingPrincipal += amount;
                } else if (f.direction === 'outflow') {
                    totalOutflow += amount;
                }
            }
            const deficit = totalOutflow - totalInflowExcludingPrincipal;
            
            // 统计卡片数据
            const cards = [
                { label: (lang === 'id' ? 'Bulan ini' : '本月新增') + '/' + t('total_orders'), value: thisMonthOrderCount + '/' + report.total_orders, class: '' },
                { label: lang === 'id' ? 'Defisit (Keluar - Masuk)' : '赤字 (流出-流入)', value: Utils.formatCurrency(deficit), class: deficit >= 0 ? 'expense' : 'income' },
                { label: lang === 'id' ? 'Berjalan / Jatuh Tempo' : '进行中 / 逾期单', value: activeDisplay, class: '' },
                { label: (lang === 'id' ? 'Lunas' : '已结清'), value: report.completed_orders, class: '' },
                { label: t('admin_fee'), value: Utils.formatCurrency(report.total_admin_fees), class: 'income' },
                { label: t('service_fee'), value: Utils.formatCurrency(report.total_service_fees || 0), class: 'income' },
                { label: lang === 'id' ? 'Bunga Diterima' : '已收利息', value: Utils.formatCurrency(report.total_interest), class: 'income' },
                { label: lang === 'id' ? 'Total Pengeluaran' : '支出汇总', value: Utils.formatCurrency(totalExpenses), class: 'expense' }
            ];
            
            var cardsHtml = '';
            for (var i = 0; i < cards.length; i++) {
                cardsHtml += '<div class="stat-card">' +
                    '<div class="stat-value ' + cards[i].class + '">' + cards[i].value + '</div>' +
                    '<div class="stat-label">' + cards[i].label + '</div>' +
                '</div>';
            }
            
            var cashBalance = cashFlow.cash?.balance ?? 0;
            var bankBalance = cashFlow.bank?.balance ?? 0;
            var cashIncome = cashFlow.cash?.income ?? 0;
            var cashExpense = cashFlow.cash?.expense ?? 0;
            var bankIncome = cashFlow.bank?.income ?? 0;
            var bankExpense = cashFlow.bank?.expense ?? 0;
            
            // 资金管理区块
            var cashFlowHtml = '';
            if (isAdmin) {
                cashFlowHtml = '' +
                '<div class="cashflow-summary">' +
                    '<h3>💰 ' + t('fund_management') + ' (' + (lang === 'id' ? 'Semua Toko' : '全部门店') + ')</h3>' +
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
                        '<div class="cashflow-item">' +
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
                    '<h3>💰 ' + t('fund_management') + '</h3>' +
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
                        '<div class="cashflow-item">' +
                            '<div class="label">🔄 ' + t('internal_transfer') + '</div>' +
                            '<div class="transfer-buttons">' +
                                '<button onclick="APP.showTransferModal(\'cash_to_bank\')" class="transfer-btn cash-to-bank">🏦→🏧 ' + t('cash_to_bank') + '</button>' +
                                '<button onclick="APP.showTransferModal(\'bank_to_cash\')" class="transfer-btn bank-to-cash">🏧→🏦 ' + t('bank_to_cash') + '</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }
            
            // 工具栏
            var toolbarHtml = '';
            if (isAdmin) {
                toolbarHtml = '' +
                '<div class="toolbar admin-grid no-print">' +
                    '<button onclick="APP.navigateTo(\'customers\')">👥 ' + t('customers') + '</button>' +
                    '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
                    '<button onclick="APP.showCashFlowPage()">💰 ' + t('payment_history') + '</button>' +
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
                '<div class="toolbar store-grid no-print" style="grid-template-columns: repeat(4, 1fr);">' +
                    '<button onclick="APP.navigateTo(\'customers\')">👥 ' + t('customers') + '</button>' +
                    '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
                    '<button onclick="APP.showCashFlowPage()">💰 ' + t('payment_history') + '</button>' +
                    '<button onclick="APP.navigateTo(\'expenses\')">📝 ' + t('expenses') + '</button>' +
                    '<button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ' + (btnHighlight ? 'highlight' : '') + '" ' + (btnDisabled ? 'disabled' : '') + '>🔔 ' + t('send_reminder') + ' ' + (hasReminders ? '(' + needRemindOrders.length + ')' : '') + '</button>' +
                    '<button onclick="APP.navigateTo(\'anomaly\')">⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</button>' +
                    '<button onclick="APP.navigateTo(\'backupRestore\')">💾 ' + t('backup_restore') + '</button>' +
                    '<button onclick="APP.logout()">💾 ' + t('save_exit') + '</button>' +
                '</div>';
            }
            
            // 底部信息
            var userRoleText = AUTH.user.role === 'admin' 
                ? (lang === 'id' ? 'Administrator' : '管理员') 
                : (lang === 'id' ? 'Manajer Toko' : '店长');
            var storeName = AUTH.getCurrentStoreName();
            
            var bottomHtml = '';
            if (isAdmin) {
                bottomHtml = '' +
                '<div class="card dashboard-footer-card">' +
                    '<p><strong>🏪 ' + (lang === 'id' ? 'Pengguna saat ini' : '当前用户') + ':</strong> ' + Utils.escapeHtml(AUTH.user.name) + ' (' + userRoleText + ')</p>' +
                    '<p>📍 ' + (lang === 'id' ? 'Toko' : '门店') + ': ' + (lang === 'id' ? 'Kantor Pusat' : '总部') + '</p>' +
                    '<p>📌 ' + t('more_pawn_higher_fee') + '</p>' +
                    '<p>🔒 ' + t('order_saved_locked') + '</p>' +
                '</div>';
            } else {
                bottomHtml = '' +
                '<div class="card dashboard-footer-card">' +
                    '<p><strong>🏪 ' + (lang === 'id' ? 'Pengguna saat ini' : '当前用户') + ':</strong> ' + Utils.escapeHtml(storeName) + ' (' + userRoleText + ')</p>' +
                    '<p>📍 ' + (lang === 'id' ? 'Toko' : '门店') + ': ' + Utils.escapeHtml(storeName) + '</p>' +
                    '<p>📌 ' + t('contract_pay_info') + '</p>' +
                    '<p>🔒 ' + t('order_saved_locked') + ' ' + t('more_pawn_higher_fee') + '</p>' +
                '</div>';
            }
            
            var backButtonHtml = (this.historyStack.length > 0) ? '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + t('back') + '</button>' : '';

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<div style="display:flex;align-items:center;gap:12px;">' +
                        '<img src="icons/pagehead-logo.png" alt="JF!" style="height:32px;">' +
                        '<h1 style="margin:0;">JF! by Gadai</h1>' +
                    '</div>' +
                    '<div class="header-actions">' +
                        backButtonHtml +
                    '</div>' +
                '</div>' +
                '<div style="margin:0 0 12px 0;">' +
                    '<h3 style="margin:0;font-size:var(--font-md);font-weight:600;">📋 ' + t('operation') + '</h3>' +
                '</div>' +
                toolbarHtml +
                '<div style="margin:0 0 12px 0;">' +
                    '<h3 style="margin:0;font-size:var(--font-md);font-weight:600;">📊 ' + t('financial_indicators') + (isAdmin ? ' (' + (lang === 'id' ? 'Semua Toko' : '全部门店') + ')' : '') + '</h3>' +
                '</div>' +
                '<div class="stats-grid">' + cardsHtml + '</div>' +
                cashFlowHtml +
                bottomHtml;
            
        } catch (err) {
            console.error("renderDashboard error:", err);
            Utils.ErrorHandler.capture(err, 'renderDashboard');
            document.getElementById("app").innerHTML = '<div class="card"><p>⚠️ ' + err.message + '</p><button onclick="APP.logout()">💾 ' + Utils.t('save_exit') + '</button></div>';
        }
    },

    _calculateReport: function(orders) {
        // 保留原方法用于兼容，但实际仪表盘不再调用全量版本
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
                var rate = o.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
                expectedMonthlyInterest += remainingPrincipal * rate;
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
    
    _calculateCashFlowSummary: function(allFlows, isAdmin, storeId, storeSpecificCashFlows) {
        var cashInflow = 0, cashOutflow = 0;
        var bankInflow = 0, bankOutflow = 0;
        
        var flowsToUse = [];
        if (!isAdmin && storeSpecificCashFlows && Array.isArray(storeSpecificCashFlows)) {
            flowsToUse = storeSpecificCashFlows;
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
    },
    
    // 暴露缓存失效方法供外部调用（在创建订单、缴费等操作后调用）
    invalidateDashboardCache: function() {
        DashboardCache.invalidate();
    }
};

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

// 导出缓存失效方法
window.APP.invalidateDashboardCache = DashboardCore.invalidateDashboardCache.bind(DashboardCore);
