// app-dashboard-core.js - v2.0

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 模块降级通知 ====================
    const ModuleFallback = {
        _degradedModules: {},
        async safeCall(moduleName, fn, args, fallbackFn) {
            try {
                if (typeof fn !== 'function') throw new Error('module_not_loaded');
                return await fn.apply(null, args || []);
            } catch (error) {
                const lang = Utils.lang;
                const moduleKey = moduleName + '_' + (error.message || 'unknown');
                if (!this._degradedModules[moduleKey]) {
                    this._degradedModules[moduleKey] = true;
                    const msg = lang === 'id'
                        ? `⚠️ Modul "${moduleName}" gagal dimuat: ${error.message}, kembali ke dashboard.`
                        : `⚠️ 模块 "${moduleName}" 加载失败: ${error.message}，已返回仪表盘。`;
                    if (window.Toast) window.Toast.warning(msg, 5000);
                    this._showBanner(moduleName, error.message);
                }
                if (typeof fallbackFn === 'function') return await fallbackFn();
                if (JF.DashboardCore && typeof JF.DashboardCore.renderDashboard === 'function') {
                    await JF.DashboardCore.renderDashboard();
                    return true;
                }
                console.error('[ModuleFallback] 无法恢复，刷新页面');
                location.reload();
                return null;
            }
        },
        _showBanner(moduleName, errorMsg) {
            const existingBanner = document.getElementById('moduleFallbackBanner');
            if (existingBanner) {
                const content = existingBanner.querySelector('.info-bar-content');
                if (content && !content.textContent.includes(moduleName)) {
                    content.textContent += ' | ' + moduleName;
                }
                return;
            }
            const lang = Utils.lang;
            const banner = document.createElement('div');
            banner.id = 'moduleFallbackBanner';
            banner.className = 'info-bar warning';
            banner.style.cssText = 'position:sticky;top:0;z-index:9999;margin-bottom:12px;border-radius:6px;';
            banner.innerHTML =
                '<span class="info-bar-icon">⚠️</span>' +
                '<div class="info-bar-content">' +
                    '<strong>' + (lang === 'id' ? 'Fitur terdegradasi' : '功能降级') + '</strong> — ' +
                    (lang === 'id' ? `Modul "${moduleName}" gagal dimuat.` : `模块 "${moduleName}" 加载失败。`) +
                '</div>' +
                '<button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 8px;">✖</button>';
            const app = document.getElementById('app');
            if (app && app.firstChild) app.insertBefore(banner, app.firstChild);
        },
        clearAll() {
            this._degradedModules = {};
            const banner = document.getElementById('moduleFallbackBanner');
            if (banner) banner.remove();
        }
    };
    window.ModuleFallback = ModuleFallback;
    JF.ModuleFallback = ModuleFallback;

    // ==================== 逾期更新定时器 ====================
    let _overdueInterval = null;

    // ==================== DashboardCore 主模块 ====================
    const DashboardCore = {
        currentFilter: "all",
        historyStack: [],
        currentPage: "dashboard",
        currentOrderId: null,
        currentCustomerId: null,

        // ---------- 页面状态持久化 ----------
        saveCurrentPageState() {
            try {
                sessionStorage.setItem('jf_current_page', this.currentPage);
                sessionStorage.setItem('jf_current_filter', this.currentFilter);
                if (this.currentOrderId) sessionStorage.setItem('jf_current_order_id', this.currentOrderId);
                else sessionStorage.removeItem('jf_current_order_id');
                if (this.currentCustomerId) sessionStorage.setItem('jf_current_customer_id', this.currentCustomerId);
                else sessionStorage.removeItem('jf_current_customer_id');
                localStorage.setItem('jf_last_page', this.currentPage);
                localStorage.setItem('jf_last_filter', this.currentFilter);
                if (this.currentOrderId) localStorage.setItem('jf_last_order_id', this.currentOrderId);
                else localStorage.removeItem('jf_last_order_id');
                if (this.currentCustomerId) localStorage.setItem('jf_last_customer_id', this.currentCustomerId);
                else localStorage.removeItem('jf_last_customer_id');
            } catch (e) { /* ignore */ }
        },

        restorePageState() {
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
            try {
                sessionStorage.removeItem('jf_current_page');
                sessionStorage.removeItem('jf_current_filter');
                sessionStorage.removeItem('jf_current_order_id');
                sessionStorage.removeItem('jf_current_customer_id');
            } catch (e) { /* ignore */ }
            this.currentOrderId = null;
            this.currentCustomerId = null;
        },

        // ---------- 逾期更新定时器 ----------
        _clearOverdueInterval() {
            if (_overdueInterval) { clearInterval(_overdueInterval); _overdueInterval = null; }
        },

        _startOverdueInterval() {
            this._clearOverdueInterval();
            if (!AUTH.isLoggedIn()) return;
            _overdueInterval = setInterval(async () => {
                try {
                    await SUPABASE.updateOverdueDays();
                    if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') {
                        await this.refreshCurrentPage();
                    }
                } catch (err) { console.warn('[逾期更新] 失败:', err.message); }
            }, 30 * 60 * 1000);
            setTimeout(async () => {
                try {
                    await SUPABASE.updateOverdueDays();
                    if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') {
                        await this.refreshCurrentPage();
                    }
                } catch (err) { /* ignore */ }
            }, 5000);
        },

        // ---------- 初始化 ----------
        async init() {
            ModuleFallback.clearAll();
            document.getElementById("app").innerHTML = Utils.renderSkeleton('default');
            try {
                await AUTH.init();
                const savedState = window._RESTORED_STATE && window._RESTORED_STATE.page ? window._RESTORED_STATE : this.restorePageState();
                if (window._RESTORED_STATE) delete window._RESTORED_STATE;
                const isLoggedIn = AUTH.isLoggedIn();
                if (savedState.page && savedState.page !== 'login' && isLoggedIn) {
                    this.currentPage = savedState.page;
                    this.currentFilter = savedState.filter || "all";
                    this.currentOrderId = savedState.orderId || null;
                    this.currentCustomerId = savedState.customerId || null;
                    await this.refreshCurrentPage();
                } else if (isLoggedIn) {
                    await this.renderDashboard();
                } else {
                    await this.router();
                }
                if (AUTH.isLoggedIn()) this._startOverdueInterval();
            } catch (error) {
                console.error("Init error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat sistem' : '系统加载失败', 5000);
                document.getElementById("app").innerHTML = '<div class="card" style="text-align:center;padding:40px;">' +
                    '<p>' + (Utils.lang === 'id' ? 'Gagal memuat sistem, silakan muat ulang.' : '系统加载失败，请刷新页面。') + '</p>' +
                    '<button onclick="location.reload()" style="margin-top:12px;">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button></div>';
            }
        },

        // ---------- 路由器 ----------
        async router() {
            if (!AUTH.isLoggedIn()) {
                await this.renderLogin();
                return;
            }
            await this.refreshCurrentPage();
        },

        // ---------- 导航 ----------
        navigateTo: function(page, params) {
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

            const pageMap = {
                'dashboard': () => this.renderDashboard(),
                'orderTable': () => JF.OrdersPage.showOrderTable(),
                'customers': () => JF.CustomersPage.showCustomers(),
                'expenses': () => JF.ExpensesPage.showExpenses(),
                'paymentHistory': () => JF.FundsPage.showCashFlowPage(),
                'anomaly': () => JF.AnomalyPage.showAnomaly(),
                'userManagement': () => JF.UsersPage.showUserManagement(),
                'storeManagement': () => JF.StoreManager.renderStoreManagement(),
                'backupRestore': () => JF.BackupStorage.renderBackupUI(),
                'blacklist': () => JF.BlacklistPage.showBlacklist(),
                'viewOrder': () => {
                    if (this.currentOrderId) return JF.OrdersPage.viewOrder(this.currentOrderId);
                    return this.renderDashboard();
                },
                'payment': () => {
                    if (this.currentOrderId) return JF.PaymentPage.showPayment(this.currentOrderId);
                    return this.renderDashboard();
                }
            };

            const handler = pageMap[page];
            if (handler) {
                handler().catch(err => {
                    console.error(`[navigateTo] 页面 ${page} 加载失败:`, err);
                    this.renderDashboard();
                });
            } else {
                this.renderDashboard();
            }
        },

        // ---------- 返回上一页 ----------
        goBack: function() {
            console.log('[DashboardCore] goBack 被调用，历史栈深度:', this.historyStack.length);
            
            if (this.historyStack.length > 0) {
                const prev = this.historyStack.pop();
                console.log('[DashboardCore] 返回到:', prev.page);
                
                this.currentPage = prev.page;
                this.currentOrderId = prev.orderId || null;
                this.currentCustomerId = prev.customerId || null;
                this.currentFilter = prev.filter || "all";
                this.saveCurrentPageState();
                
                this.refreshCurrentPage().catch(err => {
                    console.error('[DashboardCore] goBack 刷新失败:', err);
                    this.renderDashboard();
                });
            } else if (document.referrer && window.history.length > 1) {
                console.log('[DashboardCore] 使用浏览器后退');
                window.history.back();
            } else {
                console.log('[DashboardCore] 默认返回仪表盘');
                this.renderDashboard();
            }
        },

        // ---------- 页面刷新 ----------
        async refreshCurrentPage() {
            const skeletonMap = {
                dashboard: 'dashboard',
                orderTable: 'table',
                customers: 'table',
                paymentHistory: 'table',
                expenses: 'table',
                viewOrder: 'detail',
                payment: 'detail',
            };
            document.getElementById("app").innerHTML = Utils.renderSkeleton(skeletonMap[this.currentPage] || 'default');
            await new Promise(r => setTimeout(r, 100));

            const handlers = {
                dashboard: () => this.renderDashboard(),
                orderTable: () => ModuleFallback.safeCall('OrderList', APP.showOrderTable, [], () => this.renderDashboard()),
                createOrder: () => ModuleFallback.safeCall('CreateOrder', APP.showCreateOrder, [], () => this.renderDashboard()),
                viewOrder: () => {
                    if (this.currentOrderId) return ModuleFallback.safeCall('ViewOrder', APP.viewOrder, [this.currentOrderId], () => this.renderDashboard());
                    return this.renderDashboard();
                },
                payment: () => {
                    if (this.currentOrderId) return ModuleFallback.safeCall('Payment', APP.showPayment, [this.currentOrderId], () => this.renderDashboard());
                    return this.renderDashboard();
                },
                anomaly: () => ModuleFallback.safeCall('Anomaly', APP.showAnomaly, [], () => this.renderDashboard()),
                userManagement: () => ModuleFallback.safeCall('UserManagement', APP.showUserManagement, [], () => this.renderDashboard()),
                storeManagement: () => {
                    if (typeof StoreManager !== 'undefined' && StoreManager.renderStoreManagement) {
                        return ModuleFallback.safeCall('StoreManagement', StoreManager.renderStoreManagement, [], () => this.renderDashboard());
                    }
                    return this.renderDashboard();
                },
                expenses: () => ModuleFallback.safeCall('Expenses', APP.showExpenses, [], () => this.renderDashboard()),
                customers: () => ModuleFallback.safeCall('Customers', APP.showCustomers, [], () => this.renderDashboard()),
                paymentHistory: async () => {
                    const fn = APP.showCashFlowPage || APP.showPaymentHistory;
                    return await ModuleFallback.safeCall('CashFlow', fn, [], () => this.renderDashboard());
                },
                backupRestore: () => {
                    if (typeof BackupStorage !== 'undefined' && BackupStorage.renderBackupUI) {
                        return ModuleFallback.safeCall('Backup', BackupStorage.renderBackupUI, [], () => this.renderDashboard());
                    }
                    return this.renderDashboard();
                },
                customerOrders: () => {
                    if (this.currentCustomerId && APP.showCustomerOrders) {
                        return ModuleFallback.safeCall('CustomerOrders', APP.showCustomerOrders, [this.currentCustomerId], () => this.renderDashboard());
                    }
                    return this.renderDashboard();
                },
                customerPaymentHistory: () => {
                    if (this.currentCustomerId && APP.showCustomerPaymentHistory) {
                        return ModuleFallback.safeCall('CustomerPaymentHistory', APP.showCustomerPaymentHistory, [this.currentCustomerId], () => this.renderDashboard());
                    }
                    return this.renderDashboard();
                },
                blacklist: () => ModuleFallback.safeCall('Blacklist', APP.showBlacklist, [], () => this.renderDashboard()),
            };

            const handler = handlers[this.currentPage];
            if (handler) await handler();
            else await this.renderDashboard();
        },

        // ---------- 登录页面 ----------
        async renderLogin() {
            this.currentPage = 'login';
            this.clearPageState();
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            document.getElementById("app").innerHTML = `
                <div class="login-container">
                    <div class="login-box">
                        <div class="lang-toggle"><button onclick="APP.toggleLanguage()" class="lang-btn">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button></div>
                        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
                            <img src="icons/pagehead-logo.png" alt="JF!" style="height:36px;">
                            <h2 class="login-title" style="margin:0;">JF! by Gadai</h2>
                        </div>
                        <h3>${t('login')}</h3>
                        <div id="loginError" class="info-bar danger" style="display:none;margin-bottom:16px;"><span class="info-bar-icon">⚠️</span><div class="info-bar-content" id="loginErrorMessage"></div></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Email / Username' : '邮箱 / 用户名'}</label><input id="username" placeholder="email@domain.com" autocomplete="username"></div>
                        <div class="form-group" style="position:relative;"><label>${t('password')}</label><input id="password" type="password" placeholder="${t('password')}" autocomplete="current-password"><span onclick="Utils.togglePasswordVisibility('password', this)" style="position:absolute;right:12px;top:38px;cursor:pointer;font-size:18px;">👁️</span></div>
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;"><input type="checkbox" id="rememberMe" style="width:16px;height:16px;cursor:pointer;"><label for="rememberMe" style="cursor:pointer;">${lang === 'id' ? 'Ingat saya' : '记住我'}</label></div>
                        <button onclick="APP.login()" id="loginBtn">${t('login')}</button>
                        <p class="login-note">ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}</p>
                    </div>
                </div>`;
        },

        // ---------- 登录方法 ----------
        async login() {
            const username = document.getElementById("username").value.trim();
            const password = document.getElementById("password").value;
            const rememberMe = document.getElementById("rememberMe").checked;
            const errorDiv = document.getElementById("loginError");
            const errorMsg = document.getElementById("loginErrorMessage");
            const btn = document.getElementById("loginBtn");

            if (errorDiv) errorDiv.style.display = 'none';
            if (!username || !password) {
                if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = Utils.t('fill_all_fields'); }
                return;
            }
            if (btn) { btn.disabled = true; btn.textContent = '...'; }
            AUTH.setRememberMe(rememberMe);
            const user = await AUTH.login(username, password);
            if (!user) {
                if (errorDiv) {
                    errorDiv.style.display = 'flex';
                    errorMsg.textContent = Utils.lang === 'id' ? 'Login gagal. Periksa kembali email/username dan password Anda.' : '登录失败，请检查邮箱/用户名和密码。';
                }
                if (btn) { btn.disabled = false; btn.textContent = Utils.t('login'); }
                return;
            }
            await this.router();
        },

        // ---------- 退出 ----------
        async logout() {
            this._clearOverdueInterval();
            const confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
            if (!confirmed) return;
            this.clearPageState();
            sessionStorage.clear();
            await AUTH.logout();
            await this.router();
        },

        // ---------- 语言切换 ----------
        toggleLanguage() {
            const newLang = Utils.lang === 'id' ? 'zh' : 'id';
            Utils.setLanguage(newLang);
            if (this.currentPage === 'login' || !AUTH.isLoggedIn()) this.renderLogin();
            else this.refreshCurrentPage();
        },

        // ---------- 强制恢复 ----------
        forceRecovery() {
            console.log('[Recovery] 手动强制恢复');
            const appDiv = document.getElementById('app');
            if (!appDiv) return;
            const loadingText = Utils.lang === 'id' ? 'Sedang memulihkan...' : '恢复中...';
            appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;margin:20px;"><div class="loader" style="margin:20px auto;"></div><p>' + loadingText + '</p></div>';
            setTimeout(async () => {
                try {
                    if (AUTH.isLoggedIn()) {
                        await this.refreshCurrentPage();
                    } else {
                        await this.renderLogin();
                    }
                } catch (err) {
                    appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;"><p>⚠️ ' + (Utils.lang === 'id' ? 'Pemulihan gagal, muat ulang halaman.' : '恢复失败，请刷新页面。') + '</p><button onclick="location.reload()" style="margin-top:12px;">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button></div>';
                }
            }, 100);
        },

        // ---------- 渲染仪表盘 ----------
        async renderDashboard() {
            this.currentPage = 'dashboard';
            this.currentOrderId = null;
            this.saveCurrentPageState();

            try {
                const lang = Utils.lang;
                const t = Utils.t.bind(Utils);
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();
                const storeId = profile?.store_id;

                const cacheKey = `dashboard_stats_${isAdmin ? 'admin' : storeId}`;
                const report = await JF.Cache.get(cacheKey, async () => {
                    const client = SUPABASE.getClient();
                    const practiceIds = isAdmin ? await SUPABASE._getPracticeStoreIds() : [];
                    const applyFilter = (q) => {
                        if (isAdmin && practiceIds.length > 0) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                        else if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                        return q;
                    };
                    const [totalRes, activeRes, completedRes, overdueRes] = await Promise.all([
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'completed'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active').gte('overdue_days', 1),
                    ]);
                    const activeData = await applyFilter(client.from('orders').select('loan_amount, admin_fee, admin_fee_paid, service_fee_paid, interest_paid_total, principal_paid')).eq('status', 'active');
                    const allLoanData = await applyFilter(client.from('orders').select('loan_amount'));
                    let totalLoan = 0, adminFees = 0, serviceFees = 0, interest = 0, principal = 0;
                    for (const o of activeData.data || []) {
                        totalLoan += (o.loan_amount || 0);
                        if (o.admin_fee_paid) adminFees += (o.admin_fee || 0);
                        serviceFees += (o.service_fee_paid || 0);
                        interest += (o.interest_paid_total || 0);
                        principal += (o.principal_paid || 0);
                    }
                    let allLoan = 0;
                    for (const o of allLoanData.data || []) allLoan += (o.loan_amount || 0);

                    // 查询总投入资本
                    let totalInjectedCapital = 0;
                    try {
                        let injectionQuery = client.from('capital_injections').select('amount').eq('is_voided', false);
                        if (!isAdmin && storeId) injectionQuery = injectionQuery.eq('store_id', storeId);
                        const { data: injections, error: injError } = await injectionQuery;
                        if (!injError) {
                            totalInjectedCapital = (injections || []).reduce((sum, i) => sum + (i.amount || 0), 0);
                        }
                    } catch (e) { /* 表可能不存在 */ }

                    // 查询在押资金
                    let deployedCapital = 0;
                    try {
                        let deployedQuery = client.from('orders').select('loan_amount').eq('status', 'active');
                        if (!isAdmin && storeId) deployedQuery = deployedQuery.eq('store_id', storeId);
                        const { data: deployedOrders } = await deployedQuery;
                        deployedCapital = (deployedOrders || []).reduce((sum, o) => sum + (o.loan_amount || 0), 0);
                    } catch (e) { /* ignore */ }

                    return {
                        total_orders: totalRes.count || 0, active_orders: activeRes.count || 0,
                        completed_orders: completedRes.count || 0, overdue_orders: overdueRes.count || 0,
                        total_loan_amount: allLoan, total_admin_fees: adminFees,
                        total_service_fees: serviceFees, total_interest: interest, total_principal: principal,
                        total_injected_capital: totalInjectedCapital,
                        deployed_capital: deployedCapital,
                        available_capital: totalInjectedCapital - deployedCapital
                    };
                }, { ttl: 5 * 60 * 1000 });

                const cashFlowCacheKey = `cashflow_v2_${isAdmin ? 'admin' : storeId}`;
                const cashFlow = await JF.Cache.get(cashFlowCacheKey, () => SUPABASE.getCashFlowSummary(), { ttl: 5 * 60 * 1000 });

                const expensesCacheKey = `expenses_${isAdmin ? 'admin' : storeId}`;
                const totalExpenses = await JF.Cache.get(expensesCacheKey, async () => {
                    const client = SUPABASE.getClient();
                    let q = client.from('expenses').select('amount, store_id');
                    if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                    else if (isAdmin) {
                        const practiceIds = await SUPABASE._getPracticeStoreIds();
                        if (practiceIds.length > 0) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                    }
                    const { data } = await q;
                    return (data || []).reduce((sum, e) => sum + (e.amount || 0), 0);
                }, { ttl: 5 * 60 * 1000 });

                const activeDisplay = report.active_orders + (report.overdue_orders > 0 ? ' / ⚠️ ' + report.overdue_orders : '');
                const netProfitBalance = cashFlow.netProfit?.balance || 0;

                const cards = [
                    { label: t('this_month') + '/' + t('total_orders'), value: '...' + '/' + report.total_orders, class: '' },
                    { label: t('active') + ' / ' + t('overdue_days'), value: activeDisplay, class: '' },
                    { label: t('completed'), value: report.completed_orders, class: '' },
                    { label: t('net_profit'), value: Utils.formatCurrency(netProfitBalance), class: netProfitBalance >= 0 ? 'income' : 'expense' },
                    { label: t('admin_fee'), value: Utils.formatCurrency(report.total_admin_fees), class: 'income' },
                    { label: t('service_fee'), value: Utils.formatCurrency(report.total_service_fees), class: 'income' },
                    { label: t('interest'), value: Utils.formatCurrency(report.total_interest), class: 'income' },
                    { label: t('total_expenses'), value: Utils.formatCurrency(totalExpenses), class: 'expense' },
                ];
                const cardsHtml = cards.map(c => `<div class="stat-card"><div class="stat-value ${c.class}">${c.value}</div><div class="stat-label">${c.label}</div></div>`).join('');

                const cashBalance = cashFlow.cash?.balance ?? 0;
                const bankBalance = cashFlow.bank?.balance ?? 0;
                const cashIncome = cashFlow.cash?.income ?? 0;
                const cashExpense = cashFlow.cash?.expense ?? 0;
                const bankIncome = cashFlow.bank?.income ?? 0;
                const bankExpense = cashFlow.bank?.expense ?? 0;

                // ===== 三卡片资金布局 =====
                const totalInjected = report.total_injected_capital || 0;
                const deployed = report.deployed_capital || 0;
                const available = report.available_capital || 0;
                const utilizationPercent = totalInjected > 0 ? (deployed / totalInjected * 100).toFixed(1) : 0;

                const injectButtonHtml = isAdmin ? `
                <button onclick="JF.CapitalModule ? JF.CapitalModule.showCapitalInjectionModal() : Utils.toast.info(lang === 'id' ? 'Modul belum dimuat' : '模块未加载')"
                    class="btn-capital-inject">
                    💉 ${lang === 'id' ? 'Injeksi Modal' : '资本注入'}
                </button>` : `
                <div class="info-bar info" style="margin-top:8px;">
                    <span class="info-bar-icon">ℹ️</span>
                    <div class="info-bar-content">${lang === 'id' ? 'Hanya administrator yang dapat mencatat injeksi modal' : '仅管理员可记录资本注入'}</div>
                </div>`;

                const topRowHtml = `
                <div class="stats-grid stats-grid-2" style="margin-bottom:16px;">
                    <!-- 卡片1：总投入资本 -->
                    <div class="card" style="margin-bottom:0;">
                        <h3>💉 ${lang === 'id' ? 'Total Modal Disetor' : '总投入资本'}</h3>
                        <div class="stat-value" style="font-size:var(--font-2xl);margin-bottom:8px;">${Utils.formatCurrency(totalInjected)}</div>
                        <div class="stat-label" style="margin-bottom:12px;">${lang === 'id' ? 'Modal dasar operasional gadai' : '典当运营基础资本'}</div>
                        ${injectButtonHtml}
                    </div>
                    
                    <!-- 卡片2：在押资金 -->
                    <div class="card" style="margin-bottom:0;">
                        <h3>📋 ${lang === 'id' ? 'Dalam Gadai' : '在押资金'}</h3>
                        <div class="stat-value warning" style="font-size:var(--font-2xl);margin-bottom:8px;">${Utils.formatCurrency(deployed)}</div>
                        <div class="progress-bar" style="margin-bottom:4px;">
                            <div class="progress-fill" style="width:${utilizationPercent}%;background:#f59e0b;"></div>
                        </div>
                        <div class="stat-label" style="margin-bottom:12px;">${utilizationPercent}% ${lang === 'id' ? 'dari total modal' : '占总资本'}</div>
                        <button onclick="APP.navigateTo('orderTable'); setTimeout(function(){ if(APP.filterOrders) APP.filterOrders('active'); }, 300);"
                            class="btn-small primary" style="width:100%;">
                            👁️ ${lang === 'id' ? 'Lihat Pesanan Aktif' : '查看活跃订单'}
                        </button>
                    </div>
                </div>`;

                const bottomCardHtml = `
                <div class="card" style="margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <h3 style="margin:0;padding:0;border:none;">✅ ${lang === 'id' ? 'Dana Tersedia' : '可动用资金'}</h3>
                        <span style="font-size:var(--font-xl);font-weight:700;color:#16a34a;">${Utils.formatCurrency(available)}</span>
                    </div>
                    
                    <div class="cashflow-summary" style="margin-bottom:12px;">
                        <div class="cashflow-stats" style="grid-template-columns:repeat(2,1fr);">
                            <div class="cashflow-item">
                                <div class="label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</div>
                                <div class="value ${cashBalance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashBalance)}</div>
                                <div class="cashflow-detail">${t('inflow')}: +${Utils.formatCurrency(cashIncome)} | ${t('outflow')}: -${Utils.formatCurrency(cashExpense)}</div>
                            </div>
                            <div class="cashflow-item">
                                <div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                                <div class="value ${bankBalance < 0 ? 'negative' : ''}">${Utils.formatCurrency(bankBalance)}</div>
                                <div class="cashflow-detail">${t('inflow')}: +${Utils.formatCurrency(bankIncome)} | ${t('outflow')}: -${Utils.formatCurrency(bankExpense)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="font-size:var(--font-xs);font-weight:600;color:var(--text-secondary);margin-bottom:8px;">
                        🔄 ${lang === 'id' ? 'Transfer Internal' : '内部互转'}
                    </div>
                    <div class="transfer-buttons" style="flex-direction:row;gap:8px;">
                        <button onclick="APP.showTransferModal('cash_to_bank')" class="transfer-btn cash-to-bank" style="flex:1;">🏦→🏧 ${t('cash_to_bank')}</button>
                        <button onclick="APP.showTransferModal('bank_to_cash')" class="transfer-btn bank-to-cash" style="flex:1;">🏧→🏦 ${t('bank_to_cash')}</button>
                        ${isAdmin ? `<button onclick="APP.showTransferModal('store_to_hq')" class="transfer-btn store-to-hq" style="flex:1;">🏢 ${t('submit_to_hq')}</button>` : ''}
                    </div>
                </div>`;

                const capitalPoolHtml = topRowHtml + bottomCardHtml;

                const userRoleText = AUTH.user?.role === 'admin'
                    ? (lang === 'id' ? 'Administrator' : '管理员')
                    : (lang === 'id' ? 'Manajer Toko' : '店长');
                const storeNameDisplay = AUTH.getCurrentStoreName();

                // ===== 工具栏（恢复资本注入按钮） =====
                const capitalizeBtnHtml = `<button onclick="JF.CapitalModule ? JF.CapitalModule.showCapitalInjectionModal() : Utils.toast.info(lang === 'id' ? 'Modul belum dimuat' : '模块未加载')">💉 ${lang === 'id' ? 'Injeksi Modal' : '资本注入'}</button>`;

                const toolbarHtml = isAdmin ? `
                    <div class="toolbar admin-grid no-print">
                        <button onclick="APP.navigateTo('customers')">👥 ${t('customers')}</button>
                        <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                        <button onclick="APP.showCashFlowPage()">💰 ${t('payment_history')}</button>
                        <button onclick="APP.navigateTo('expenses')">📝 ${t('expenses')}</button>
                        ${capitalizeBtnHtml}
                        <button onclick="APP.navigateTo('backupRestore')">📦 ${t('backup_restore')}</button>
                        <button onclick="APP.navigateTo('anomaly')">⚠️ ${t('anomaly_title')}</button>
                        <button onclick="APP.navigateTo('userManagement')">👤 ${t('user_management')}</button>
                        <button onclick="APP.navigateTo('storeManagement')">🏪 ${t('store_management')}</button>
                        <button onclick="APP.logout()">💾 ${t('save_exit')}</button>
                    </div>` : `
                    <div class="toolbar store-grid no-print">
                        <button onclick="APP.navigateTo('customers')">👥 ${t('customers')}</button>
                        <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                        <button onclick="APP.showCashFlowPage()">💰 ${t('payment_history')}</button>
                        <button onclick="APP.navigateTo('expenses')">📝 ${t('expenses')}</button>
                        ${capitalizeBtnHtml}
                        <button onclick="APP.navigateTo('anomaly')">⚠️ ${t('anomaly_title')}</button>
                        <button onclick="APP.navigateTo('backupRestore')">📦 ${t('backup_restore')}</button>
                        <button onclick="APP.logout()">💾 ${t('save_exit')}</button>
                    </div>`;

                const bottomHtml = isAdmin
                    ? `<div class="card dashboard-footer-card">
                        <p><strong>🏪 ${lang === 'id' ? 'Pengguna saat ini' : '当前用户'}:</strong> ${Utils.escapeHtml(AUTH.user?.name || '')} (${userRoleText})</p>
                        <p>📍 ${lang === 'id' ? 'Toko' : '门店'}: ${t('headquarters')}</p>
                        <p>📌 ${t('more_pawn_higher_fee')}</p>
                        <p>🔒 ${t('order_saved_locked')}</p>
                    </div>`
                    : `<div class="card dashboard-footer-card">
                        <p><strong>🏪 ${lang === 'id' ? 'Pengguna saat ini' : '当前用户'}:</strong> ${Utils.escapeHtml(storeNameDisplay)} (${userRoleText})</p>
                        <p>📍 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeNameDisplay)}</p>
                        <p>📌 ${t('contract_pay_info')}</p>
                        <p>🔒 ${t('order_saved_locked')} ${t('more_pawn_higher_fee')}</p>
                    </div>`;

                document.getElementById("app").innerHTML = `
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                            <img src="icons/pagehead-logo.png" alt="JF!" style="height:32px;">
                            <h1 style="margin:0;">JF! by Gadai</h1>
                        </div>
                        <div class="header-actions">
                            <button onclick="APP.toggleLanguage()" class="lang-btn" style="margin-left:8px;">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        </div>
                    </div>
                    <div style="margin:0 0 12px 0;"><h3 style="margin:0;font-size:var(--font-md);font-weight:600;">📋 ${t('operation')}</h3></div>
                    ${toolbarHtml}
                    <div style="margin:0 0 12px 0;"><h3 style="margin:0;font-size:var(--font-md);font-weight:600;">📊 ${t('financial_indicators')}${isAdmin ? ' (' + (lang === 'id' ? 'Semua Toko' : '全部门店') + ')' : ''}</h3></div>
                    <div class="stats-grid">${cardsHtml}</div>
                    <div style="margin:0 0 8px 0;"><h3 style="margin:0;font-size:var(--font-md);font-weight:600;">💰 ${lang === 'id' ? 'Struktur Modal' : '资金结构'}</h3></div>
                    ${capitalPoolHtml}
                    ${bottomHtml}`;

            } catch (err) {
                console.error("renderDashboard error:", err);
                document.getElementById("app").innerHTML = `
                    <div class="card" style="padding:40px;text-align:center;">
                        <p>⚠️ ${Utils.lang === 'id' ? 'Gagal memuat dashboard: ' + err.message : '仪表盘加载失败: ' + err.message}</p>
                        <button onclick="APP.forceRecovery()" style="margin-top:12px;margin-right:8px;">🔄 ${Utils.lang === 'id' ? 'Pulihkan Paksa' : '强制恢复'}</button>
                        <button onclick="location.reload()" style="margin-left:8px;">🔄 ${Utils.lang === 'id' ? 'Muat Ulang' : '刷新'}</button>
                    </div>`;
            }
        },

        showCreateOrder() {
            Utils.toast.info(Utils.lang === 'id' ? 'Pilih nasabah terlebih dahulu' : '请先选择客户', 3000);
            this.navigateTo('customers');
        },

        async invalidateDashboardCache() {
            JF.Cache.clear();
            Utils.toast.info(Utils.lang === 'id' ? 'Cache dihapus' : '缓存已清除', 2000);
        }
    };

    // 挂载到命名空间
    JF.DashboardCore = DashboardCore;

    if (!window.APP) window.APP = {};
    const appMethods = ['init', 'router', 'refreshCurrentPage', 'navigateTo', 'goBack', 'renderLogin', 'login', 'logout', 'toggleLanguage', 'renderDashboard', 'forceRecovery', 'showCreateOrder', 'invalidateDashboardCache', 'saveCurrentPageState', 'restorePageState', 'clearPageState', 'currentFilter', 'historyStack', 'currentPage', 'currentOrderId', 'currentCustomerId'];
    for (const method of appMethods) {
        if (typeof DashboardCore[method] === 'function') {
            window.APP[method] = DashboardCore[method].bind(DashboardCore);
        } else {
            Object.defineProperty(window.APP, method, {
                get() { return DashboardCore[method]; },
                set(v) { DashboardCore[method] = v; },
                enumerable: true,
                configurable: true
            });
        }
    }

    window.APP.sendDailyReminders = DashboardCore.sendDailyReminders || (async function() {
        Utils.toast.info(Utils.lang === 'id' ? 'Fungsi pengingat belum tersedia' : '提醒功能尚未就绪');
    });

    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            console.log('[快捷键] Alt+R 触发强制恢复');
            DashboardCore.forceRecovery();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (DashboardCore && typeof DashboardCore.saveCurrentPageState === 'function') {
            DashboardCore.saveCurrentPageState();
        }
    });

    console.log('✅ JF.DashboardCore v2.4 最终版初始化完成（完整工具栏+三卡片资金布局）');
})();
