// app-dashboard-core.js - v2.5 最终版 (JF 命名空间) - 银行级金融仪表盘
// 主仪表盘与路由核心模块，挂载到 JF.DashboardCore
// 修改：侧边栏精简，功能入口移到仪表盘快捷操作区

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

        // ---------- 渲染仪表盘（v2.0 银行级金融风格，侧边栏精简版） ----------
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

                // ========== 数据获取 ==========
                const cacheKey = `dashboard_v2_${isAdmin ? 'admin' : storeId}`;
                const report = await JF.Cache.get(cacheKey, async () => {
                    const client = SUPABASE.getClient();
                    const practiceIds = isAdmin ? await SUPABASE._getPracticeStoreIds() : [];

                    const applyFilter = function(q) {
                        if (isAdmin && practiceIds.length > 0) {
                            q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                        } else if (!isAdmin && storeId) {
                            q = q.eq('store_id', storeId);
                        }
                        return q;
                    };

                    // 并行获取统计数据
                    const [
                        totalRes, activeRes, completedRes, overdueRes,
                        activeOrdersData, allOrdersData
                    ] = await Promise.all([
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'completed'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active').gte('overdue_days', 1),
                        applyFilter(client.from('orders').select('loan_amount, admin_fee, admin_fee_paid, service_fee_amount, service_fee_paid, interest_paid_total, principal_paid')).eq('status', 'active'),
                        applyFilter(client.from('orders').select('loan_amount')),
                    ]);

                    // 计算费用汇总
                    var totalLoanActive = 0, adminFeesCollected = 0;
                    var serviceFeesCollected = 0, interestCollected = 0, principalCollected = 0;

                    for (var i = 0; i < (activeOrdersData.data || []).length; i++) {
                        var o = activeOrdersData.data[i];
                        totalLoanActive += (o.loan_amount || 0);
                        if (o.admin_fee_paid) adminFeesCollected += (o.admin_fee || 0);
                        serviceFeesCollected += (o.service_fee_paid || 0);
                        interestCollected += (o.interest_paid_total || 0);
                        principalCollected += (o.principal_paid || 0);
                    }

                    var totalLoanAll = 0;
                    for (var j = 0; j < (allOrdersData.data || []).length; j++) {
                        totalLoanAll += (allOrdersData.data[j].loan_amount || 0);
                    }

                    // 资本注入
                    var totalInjectedCapital = 0;
                    try {
                        var injectionQuery = client.from('capital_injections')
                            .select('amount').eq('is_voided', false);
                        if (!isAdmin && storeId) injectionQuery = injectionQuery.eq('store_id', storeId);
                        var injResult = await injectionQuery;
                        totalInjectedCapital = (injResult.data || []).reduce(function(sum, inj) { return sum + (inj.amount || 0); }, 0);
                    } catch (e) { /* ignore */ }

                    // 在押资金
                    var deployedCapital = 0;
                    try {
                        var deployedQuery = client.from('orders')
                            .select('loan_amount').eq('status', 'active');
                        if (!isAdmin && storeId) deployedQuery = deployedQuery.eq('store_id', storeId);
                        var depResult = await deployedQuery;
                        deployedCapital = (depResult.data || []).reduce(function(sum, ord) { return sum + (ord.loan_amount || 0); }, 0);
                    } catch (e) { /* ignore */ }

                    // 本月新增订单数
                    var today = new Date();
                    var monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                        .toISOString().split('T')[0];
                    var newThisMonth = 0;
                    try {
                        var newOrderQuery = client.from('orders')
                            .select('*', { count: 'exact', head: true })
                            .gte('created_at', monthStart);
                        if (!isAdmin && storeId) newOrderQuery = newOrderQuery.eq('store_id', storeId);
                        var newResult = await newOrderQuery;
                        newThisMonth = newResult.count || 0;
                    } catch (e) { /* ignore */ }

                    return {
                        total_orders: totalRes.count || 0,
                        active_orders: activeRes.count || 0,
                        completed_orders: completedRes.count || 0,
                        overdue_orders: overdueRes.count || 0,
                        new_this_month: newThisMonth,
                        total_loan_amount: totalLoanAll,
                        admin_fees_collected: adminFeesCollected,
                        service_fees_collected: serviceFeesCollected,
                        interest_collected: interestCollected,
                        principal_collected: principalCollected,
                        total_injected_capital: totalInjectedCapital,
                        deployed_capital: deployedCapital,
                        available_capital: totalInjectedCapital - deployedCapital,
                    };
                }, { ttl: 3 * 60 * 1000 });

                // 现金流
                var cashFlowCacheKey = 'cashflow_v2_' + (isAdmin ? 'admin' : storeId);
                var cashFlow = await JF.Cache.get(
                    cashFlowCacheKey,
                    function() { return SUPABASE.getCashFlowSummary(); },
                    { ttl: 3 * 60 * 1000 }
                );

                // 支出总额
                var expensesCacheKey = 'expenses_v2_' + (isAdmin ? 'admin' : storeId);
                var totalExpenses = await JF.Cache.get(
                    expensesCacheKey,
                    async function() {
                        var client = SUPABASE.getClient();
                        var q = client.from('expenses').select('amount, store_id');
                        if (!isAdmin && storeId) {
                            q = q.eq('store_id', storeId);
                        } else if (isAdmin) {
                            var practiceIds = await SUPABASE._getPracticeStoreIds();
                            if (practiceIds.length > 0) {
                                q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                            }
                        }
                        var expResult = await q;
                        return (expResult.data || []).reduce(function(sum, e) { return sum + (e.amount || 0); }, 0);
                    },
                    { ttl: 3 * 60 * 1000 }
                );

                // ========== 计算指标 ==========
                var totalOrders = report.total_orders;
                var activeOrders = report.active_orders;
                var completedOrders = report.completed_orders;
                var overdueOrders = report.overdue_orders;
                var newThisMonth = report.new_this_month;
                var completionRate = totalOrders > 0
                    ? ((completedOrders / totalOrders) * 100).toFixed(1)
                    : '0';

                // 净利润
                var totalIncome = report.admin_fees_collected
                    + report.service_fees_collected
                    + report.interest_collected;
                var netProfit = totalIncome - totalExpenses;

                // 资金三格
                var injected = report.total_injected_capital;
                var deployed = report.deployed_capital;
                var available = report.available_capital;
                var utilizationRate = injected > 0
                    ? ((deployed / injected) * 100).toFixed(1)
                    : '0';

                // 现金/银行余额
                var cashBalance = (cashFlow.cash && cashFlow.cash.balance) ? cashFlow.cash.balance : 0;
                var bankBalance = (cashFlow.bank && cashFlow.bank.balance) ? cashFlow.bank.balance : 0;
                var cashIncome = (cashFlow.cash && cashFlow.cash.income) ? cashFlow.cash.income : 0;
                var cashExpense = (cashFlow.cash && cashFlow.cash.expense) ? cashFlow.cash.expense : 0;
                var bankIncome = (cashFlow.bank && cashFlow.bank.income) ? cashFlow.bank.income : 0;
                var bankExpense = (cashFlow.bank && cashFlow.bank.expense) ? cashFlow.bank.expense : 0;

                // 环形图数据
                var activeNormal = activeOrders - overdueOrders;
                if (activeNormal < 0) activeNormal = 0;
                var donutData = [
                    { label: lang === 'id' ? 'Selesai' : '已完成', count: completedOrders,
                      color: '#10b981', pct: totalOrders > 0 ? ((completedOrders/totalOrders)*100).toFixed(1) : '0' },
                    { label: lang === 'id' ? 'Aktif Normal' : '活跃·正常', count: activeNormal,
                      color: '#6366f1', pct: totalOrders > 0 ? ((activeNormal/totalOrders)*100).toFixed(1) : '0' },
                    { label: lang === 'id' ? 'Aktif Terlambat' : '活跃·逾期', count: overdueOrders,
                      color: '#ef4444', pct: totalOrders > 0 ? ((overdueOrders/totalOrders)*100).toFixed(1) : '0' },
                ];

                // 环形图 SVG 计算
                var totalDonut = donutData.reduce(function(s, d) { return s + d.count; }, 0) || 1;
                var circumference = 2 * Math.PI * 36; // r=36
                var dashOffset = 0;
                var donutPaths = '';
                for (var di = 0; di < donutData.length; di++) {
                    var seg = donutData[di];
                    var segLen = (seg.count / totalDonut) * circumference;
                    donutPaths += '<circle cx="50" cy="50" r="36" fill="none" stroke="' + seg.color + '" stroke-width="14"'
                        + ' stroke-dasharray="' + segLen + ' ' + (circumference - segLen) + '"'
                        + ' stroke-dashoffset="' + (-dashOffset) + '"'
                        + ' stroke-linecap="round" transform="rotate(-90 50 50)"/>';
                    dashOffset += segLen;
                }

                // ========== 构建 HTML ==========
                var userInitial = (profile?.name || 'A').charAt(0).toUpperCase();
                var userRoleText = isAdmin
                    ? (lang === 'id' ? 'Administrator' : '管理员')
                    : (lang === 'id' ? 'Manajer Toko' : '店长');
                var storeDisplay = isAdmin
                    ? (lang === 'id' ? 'Kantor Pusat' : '总部')
                    : Utils.escapeHtml(profile?.stores?.name || (lang === 'id' ? 'Toko' : '门店'));
                var topbarSubtitle = isAdmin
                    ? (lang === 'id' ? 'Semua Toko · Data Real-time' : '全部门店 · 实时数据')
                    : (lang === 'id' ? 'Data Toko · Real-time' : '门店数据 · 实时更新');

                // 活跃订单徽章数
                var activeBadgeCount = activeOrders;

                // 快捷操作按钮（角色适配，已移入仪表盘）
                var quickActions;
                if (isAdmin) {
                    quickActions = [
                        { icon: '👥', label: t('customers'), action: "JF.DashboardCore.navigateTo('customers')", cls: '' },
                        { icon: '📋', label: t('order_list'), action: "JF.DashboardCore.navigateTo('orderTable')", cls: '' },
                        { icon: '💉', label: lang === 'id' ? 'Injeksi Modal' : '资本注入', action: "JF.CapitalModule.showCapitalInjectionModal()", cls: '' },
                        { icon: '⚠️', label: t('anomaly_title'), action: "JF.DashboardCore.navigateTo('anomaly')", cls: '' },
                        { icon: '👤', label: t('user_management'), action: "JF.DashboardCore.navigateTo('userManagement')", cls: '' },
                        { icon: '🏪', label: t('store_management'), action: "JF.DashboardCore.navigateTo('storeManagement')", cls: '' },
                        { icon: '📝', label: lang === 'id' ? 'Pengeluaran Baru' : '新增支出', action: "JF.DashboardCore.navigateTo('expenses')", cls: '' },
                        { icon: '📦', label: t('backup_restore'), action: "JF.DashboardCore.navigateTo('backupRestore')", cls: '' },
                        { icon: '🚪', label: t('save_exit'), action: "JF.DashboardCore.logout()", cls: 'red-hover' }
                    ];
                } else {
                    quickActions = [
                        { icon: '👥', label: t('customers'), action: "JF.DashboardCore.navigateTo('customers')", cls: '' },
                        { icon: '📋', label: t('order_list'), action: "JF.DashboardCore.navigateTo('orderTable')", cls: '' },
                        { icon: '💰', label: lang === 'id' ? 'Bayar Biaya' : '缴费收款', action: "JF.DashboardCore.navigateTo('orderTable');setTimeout(function(){if(APP.filterOrders)APP.filterOrders('active');},300)", cls: '' },
                        { icon: '⚠️', label: t('anomaly_title'), action: "JF.DashboardCore.navigateTo('anomaly')", cls: '' },
                        { icon: '📝', label: lang === 'id' ? 'Pengeluaran Baru' : '新增支出', action: "JF.DashboardCore.navigateTo('expenses')", cls: '' },
                        { icon: '📦', label: t('backup_restore'), action: "JF.DashboardCore.navigateTo('backupRestore')", cls: '' },
                        { icon: '🚪', label: t('save_exit'), action: "JF.DashboardCore.logout()", cls: 'red-hover' }
                    ];
                }

                var quickActionsHtml = quickActions.map(function(q) {
                    return '<div class="quick-btn' + (q.cls ? ' ' + q.cls : '') + '" onclick="' + q.action + '">'
                        + '<span class="qb-icon">' + q.icon + '</span>'
                        + '<span class="qb-label">' + q.label + '</span>'
                        + '</div>';
                }).join('');

                // 收入构成项
                var incomeItems = [
                    { dot: '#6366f1', label: t('admin_fee'), sub: lang === 'id' ? 'Terkumpul' : '已收取', amt: report.admin_fees_collected, cls: '' },
                    { dot: '#8b5cf6', label: t('service_fee'), sub: lang === 'id' ? 'Bulan ini' : '月累计', amt: report.service_fees_collected, cls: '' },
                    { dot: '#06b6d4', label: t('interest'), sub: lang === 'id' ? 'Bulan ini' : '月累计', amt: report.interest_collected, cls: '' },
                    { dot: '#ef4444', label: lang === 'id' ? 'Pengeluaran' : '支出合计', sub: lang === 'id' ? 'Biaya Operasional' : '运营成本', amt: totalExpenses, cls: 'expense' },
                ];

                var incomeItemsHtml = incomeItems.map(function(item) {
                    var amtStyle = item.cls === 'expense' ? ' style="color:#dc2626"' : '';
                    var prefix = item.cls === 'expense' ? '−' : '';
                    return '<div class="income-item">'
                        + '<div class="income-dot" style="background:' + item.dot + '"></div>'
                        + '<div>'
                        + '<div class="income-name">' + item.label + '</div>'
                        + '<div class="income-sub">' + item.sub + '</div>'
                        + '</div>'
                        + '<div class="income-amt"' + amtStyle + '>' + prefix + Utils.formatCurrency(item.amt) + '</div>'
                        + '</div>';
                }).join('');

                // ========== 完整 HTML（侧边栏移除管理项和退出按钮） ==========
                document.getElementById("app").innerHTML = ''
                + '<div class="dashboard-v2">'

                    // 侧边栏遮罩
                    + '<div class="sidebar-overlay" id="sidebarOverlay" onclick="JF.DashboardCore._toggleSidebar()"></div>'

                    // 侧边栏
                    + '<div class="dash-sidebar" id="dashSidebar">'
                        + '<div class="sidebar-logo">'
                            + '<div class="logo-mark">'
                                + '<div class="logo-icon">JF</div>'
                                + '<div>'
                                    + '<div class="logo-text">JF! by Gadai</div>'
                                    + '<div class="logo-sub">' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + '</div>'
                                + '</div>'
                            + '</div>'
                        + '</div>'

                        + '<div class="sidebar-user">'
                            + '<div class="user-av">' + userInitial + '</div>'
                            + '<div>'
                                + '<div class="user-name">' + Utils.escapeHtml(profile?.name || 'User') + '</div>'
                                + '<div class="user-role">' + userRoleText + '</div>'
                            + '</div>'
                            + '<div class="user-badge">' + storeDisplay + '</div>'
                        + '</div>'

                        + '<div class="sidebar-nav">'
                            + '<div class="nav-section-label">' + (lang === 'id' ? 'Menu Utama' : '主菜单') + '</div>'

                            + '<div class="nav-item active" onclick="JF.DashboardCore.navigateTo(\'dashboard\')">'
                                + '<span class="nav-icon">◼</span> ' + (lang === 'id' ? 'Dasbor' : '仪表盘')
                            + '</div>'
                            + '<div class="nav-item" onclick="JF.DashboardCore.navigateTo(\'customers\')">'
                                + '<span class="nav-icon">👥</span> ' + t('customers')
                            + '</div>'
                            + '<div class="nav-item" onclick="JF.DashboardCore.navigateTo(\'orderTable\')">'
                                + '<span class="nav-icon">📋</span> ' + t('order_list')
                                + (activeBadgeCount > 0 ? '<span class="nav-badge">' + activeBadgeCount + '</span>' : '')
                            + '</div>'
                            + '<div class="nav-item" onclick="JF.DashboardCore.navigateTo(\'paymentHistory\')">'
                                + '<span class="nav-icon">💰</span> ' + (lang === 'id' ? 'Arus Kas' : '资金流水')
                            + '</div>'
                            + '<div class="nav-item" onclick="JF.DashboardCore.navigateTo(\'expenses\')">'
                                + '<span class="nav-icon">📝</span> ' + t('expenses')
                            + '</div>'
                            + '<div style="flex:1;"></div>'
                        + '</div>'

                        + '<div class="sidebar-footer">'
                            + '<div class="lang-toggle">'
                                + '<div class="lang-btn-side' + (Utils.lang === 'zh' ? ' active-lang' : '') + '"'
                                     + ' onclick="JF.DashboardCore._setLang(\'zh\')">中文</div>'
                                + '<div class="lang-btn-side' + (Utils.lang === 'id' ? ' active-lang' : '') + '"'
                                     + ' onclick="JF.DashboardCore._setLang(\'id\')">Bahasa</div>'
                            + '</div>'
                        + '</div>'
                    + '</div>'

                    // 顶部栏
                    + '<div class="dash-topbar">'
                        + '<div class="topbar-left">'
                            + '<div class="hamburger-btn" id="hamburgerBtn" onclick="JF.DashboardCore._toggleSidebar()">☰</div>'
                            + '<div>'
                                + '<div class="topbar-title">' + (lang === 'id' ? 'Dasbor' : '仪表盘总览') + '</div>'
                                + '<div class="topbar-sub">' + topbarSubtitle + '</div>'
                            + '</div>'
                        + '</div>'
                        + '<div class="topbar-right">'
                            + '<div class="alert-btn-dash" onclick="JF.DashboardCore.navigateTo(\'anomaly\')" title="' + t('anomaly_title') + '">'
                                + '⚠️' + (overdueOrders > 0 ? '<div class="alert-dot"></div>' : '')
                            + '</div>'
                            + '<div class="topbar-store-badge">' + storeDisplay + ' · ' + userRoleText + '</div>'
                            + '<div class="refresh-btn-dash" onclick="JF.DashboardCore.invalidateDashboardCache()" title="' + (lang === 'id' ? 'Segarkan' : '刷新数据') + '">🔄</div>'
                        + '</div>'
                    + '</div>'

                    // 主内容区
                    + '<div class="dash-main">'

                        // KPI 行
                        + '<div class="kpi-row">'
                            + '<div class="kpi-card blue">'
                                + '<div class="kpi-icon">📋</div>'
                                + '<div class="kpi-val">' + totalOrders + '</div>'
                                + '<div class="kpi-label">' + (lang === 'id' ? 'Total Pesanan' : '累计订单总数') + '</div>'
                                + '<div class="kpi-trend">' + (lang === 'id' ? 'Bulan ini +' : '本月新增 +') + newThisMonth + '</div>'
                            + '</div>'
                            + '<div class="kpi-card amber">'
                                + '<div class="kpi-icon">🔄</div>'
                                + '<div class="kpi-val amber">' + activeOrders + '</div>'
                                + '<div class="kpi-label">' + (lang === 'id' ? 'Pesanan Aktif' : '活跃在押订单') + '</div>'
                                + (overdueOrders > 0
                                    ? '<div class="kpi-trend down">' + (lang === 'id' ? 'Terlambat' : '逾期') + ' ' + overdueOrders + ' ' + (lang === 'id' ? 'pesanan' : '笔') + ' ⚠️</div>'
                                    : '<div class="kpi-trend">' + (lang === 'id' ? 'Semua normal' : '全部正常') + ' ✅</div>')
                            + '</div>'
                            + '<div class="kpi-card green">'
                                + '<div class="kpi-icon">✅</div>'
                                + '<div class="kpi-val green">' + completedOrders + '</div>'
                                + '<div class="kpi-label">' + (lang === 'id' ? 'Sudah Ditebus' : '已完成赎回') + '</div>'
                                + '<div class="kpi-trend">' + (lang === 'id' ? 'Tingkat Selesai' : '完成率') + ' ' + completionRate + '%</div>'
                            + '</div>'
                            + '<div class="kpi-card green">'
                                + '<div class="kpi-icon">📈</div>'
                                + '<div class="kpi-val green" style="font-size:1.2rem;">' + Utils.formatCurrency(netProfit) + '</div>'
                                + '<div class="kpi-label">' + t('net_profit') + '</div>'
                                + '<div class="kpi-trend">' + (lang === 'id' ? 'Pendapatan − Pengeluaran' : '收入 − 支出') + '</div>'
                            + '</div>'
                        + '</div>'

                        // 中间行：资金结构 + 收入构成
                        + '<div class="mid-row">'
                            + '<div class="fund-flow-card">'
                                + '<div class="card-header">'
                                    + '<div class="card-title">💰 ' + (lang === 'id' ? 'Struktur Dana' : '资金结构总览') + '</div>'
                                    + '<div class="card-action" onclick="JF.DashboardCore.navigateTo(\'paymentHistory\')">' + (lang === 'id' ? 'Lihat Detail →' : '查看明细 →') + '</div>'
                                + '</div>'

                                + '<div class="fund-total-row">'
                                    + '<div class="fund-block injected">'
                                        + '<div class="fund-block-label">' + (lang === 'id' ? 'Total Modal Disetor' : '总投入资本') + '</div>'
                                        + '<div class="fund-block-val">' + Utils.formatCurrency(injected) + '</div>'
                                        + '<div class="fund-block-sub">' + (lang === 'id' ? 'Dasar Operasional Gadai' : '典当运营基础') + '</div>'
                                    + '</div>'
                                    + '<div class="fund-block deployed">'
                                        + '<div class="fund-block-label">' + (lang === 'id' ? 'Dalam Gadai' : '在押资金') + '</div>'
                                        + '<div class="fund-block-val">' + Utils.formatCurrency(deployed) + '</div>'
                                        + '<div class="fund-block-sub">' + activeOrders + ' ' + (lang === 'id' ? 'pesanan aktif' : '笔活跃订单') + '</div>'
                                    + '</div>'
                                    + '<div class="fund-block free">'
                                        + '<div class="fund-block-label">' + (lang === 'id' ? 'Dana Tersedia' : '可动用资金') + '</div>'
                                        + '<div class="fund-block-val">' + Utils.formatCurrency(available) + '</div>'
                                        + '<div class="fund-block-sub">' + (lang === 'id' ? 'Kas + Bank' : '现金 + 银行') + '</div>'
                                    + '</div>'
                                + '</div>'

                                + '<div class="util-bar-wrap">'
                                    + '<div class="util-bar-label">'
                                        + '<span>' + (lang === 'id' ? 'Tingkat Utilisasi' : '资金利用率') + '</span>'
                                        + '<span class="util-bar-pct">' + utilizationRate + '%</span>'
                                    + '</div>'
                                    + '<div class="util-bar-track">'
                                        + '<div class="util-bar-fill" style="width:' + Math.min(utilizationRate, 100) + '%;"></div>'
                                    + '</div>'
                                + '</div>'

                                + '<div class="cash-bank-row">'
                                    + '<div class="cash-bank-item">'
                                        + '<div class="cb-label">🏦 ' + (lang === 'id' ? 'Brankas (Tunai)' : '保险柜（现金）') + '</div>'
                                        + '<div class="cb-val">' + Utils.formatCurrency(cashBalance) + '</div>'
                                        + '<div class="cb-flow">'
                                            + '<span class="in">↑ +' + Utils.formatCurrency(cashIncome) + '</span> &nbsp;'
                                            + '<span class="out">↓ −' + Utils.formatCurrency(cashExpense) + '</span>'
                                        + '</div>'
                                    + '</div>'
                                    + '<div class="cash-bank-item">'
                                        + '<div class="cb-label">🏧 ' + (lang === 'id' ? 'Bank BNI' : '银行 BNI') + '</div>'
                                        + '<div class="cb-val">' + Utils.formatCurrency(bankBalance) + '</div>'
                                        + '<div class="cb-flow">'
                                            + '<span class="in">↑ +' + Utils.formatCurrency(bankIncome) + '</span> &nbsp;'
                                            + '<span class="out">↓ −' + Utils.formatCurrency(bankExpense) + '</span>'
                                        + '</div>'
                                    + '</div>'
                                + '</div>'

                                + '<div class="transfer-row-v2">'
                                    + '<div class="tx-btn-v2" onclick="APP.showTransferModal(\'cash_to_bank\')">🏦→🏧 ' + (lang === 'id' ? 'Kas ke Bank' : '现金转银行') + '</div>'
                                    + '<div class="tx-btn-v2" onclick="APP.showTransferModal(\'bank_to_cash\')">🏧→🏦 ' + (lang === 'id' ? 'Bank ke Kas' : '银行转现金') + '</div>'
                                    + (isAdmin ? '<div class="tx-btn-v2" onclick="APP.showTransferModal(\'store_to_hq\')">🏢 ' + t('submit_to_hq') + '</div>' : '')
                                + '</div>'
                            + '</div>'

                            + '<div class="income-card">'
                                + '<div class="card-header">'
                                    + '<div class="card-title">📊 ' + (lang === 'id' ? 'Komposisi Pendapatan' : '收入构成') + '</div>'
                                    + '<div class="card-action" onclick="JF.DashboardCore.navigateTo(\'paymentHistory\')">' + (lang === 'id' ? 'Lihat Tagihan →' : '查看账单 →') + '</div>'
                                + '</div>'
                                + '<div class="income-items">'
                                    + incomeItemsHtml
                                + '</div>'
                                + '<div class="net-profit-box">'
                                    + '<div>'
                                        + '<div class="np-label">' + t('net_profit') + '</div>'
                                        + '<div class="np-sub">' + (lang === 'id' ? 'Admin + Layanan + Bunga − Pengeluaran' : '管理费 + 服务费 + 利息 − 支出') + '</div>'
                                    + '</div>'
                                    + '<div class="np-val">' + Utils.formatCurrency(netProfit) + '</div>'
                                + '</div>'
                            + '</div>'
                        + '</div>'

                        // 底部行：快捷操作 + 订单环形图
                        + '<div class="bottom-row">'
                            + '<div class="quick-card">'
                                + '<div class="card-header">'
                                    + '<div class="card-title">⚡ ' + (lang === 'id' ? 'Aksi Cepat' : '快捷操作') + '</div>'
                                + '</div>'
                                + '<div class="quick-grid">'
                                    + quickActionsHtml
                                + '</div>'
                            + '</div>'

                            + '<div class="order-status-card">'
                                + '<div class="card-header">'
                                    + '<div class="card-title">🗂 ' + (lang === 'id' ? 'Distribusi Status Pesanan' : '订单状态分布') + '</div>'
                                    + '<div class="card-action" onclick="JF.DashboardCore.navigateTo(\'orderTable\')">' + (lang === 'id' ? 'Lihat Semua →' : '查看全部 →') + '</div>'
                                + '</div>'
                                + '<div class="donut-area">'
                                    + '<svg class="donut-svg" width="100" height="100" viewBox="0 0 100 100">'
                                        + '<circle cx="50" cy="50" r="36" fill="none" stroke="#f1f5f9" stroke-width="14"/>'
                                        + donutPaths
                                        + '<text x="50" y="48" text-anchor="middle" font-size="16" font-weight="700" fill="#1a1a2e" font-family="var(--font-mono)">' + totalOrders + '</text>'
                                        + '<text x="50" y="60" text-anchor="middle" font-size="7" fill="#94a3b8" font-family="var(--font-sans)">' + (lang === 'id' ? 'Total Pesanan' : '总订单') + '</text>'
                                    + '</svg>'
                                    + '<div class="donut-legend">'
                                        + donutData.map(function(d) {
                                            return '<div class="legend-item">'
                                                + '<div class="legend-dot" style="background:' + d.color + '"></div>'
                                                + '<div>'
                                                    + '<div class="legend-name">' + d.label + '</div>'
                                                    + '<div class="legend-pct">' + d.pct + '%</div>'
                                                + '</div>'
                                                + '<div class="legend-count">' + d.count + '</div>'
                                            + '</div>';
                                        }).join('')
                                    + '</div>'
                                + '</div>'
                            + '</div>'
                        + '</div>'

                    + '</div>'
                + '</div>';

            } catch (err) {
                console.error("renderDashboard v2 error:", err);
                document.getElementById("app").innerHTML = ''
                    + '<div class="card" style="padding:40px;text-align:center;">'
                        + '<p>⚠️ ' + (Utils.lang === 'id' ? 'Gagal memuat dashboard: ' + err.message : '仪表盘加载失败: ' + err.message) + '</p>'
                        + '<button onclick="APP.forceRecovery()" style="margin-top:12px;margin-right:8px;">🔄 ' + (Utils.lang === 'id' ? 'Pulihkan Paksa' : '强制恢复') + '</button>'
                        + '<button onclick="location.reload()" style="margin-left:8px;">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button>'
                    + '</div>';
            }
        },

        showCreateOrder() {
            Utils.toast.info(Utils.lang === 'id' ? 'Pilih nasabah terlebih dahulu' : '请先选择客户', 3000);
            this.navigateTo('customers');
        },

        async invalidateDashboardCache() {
            JF.Cache.clear();
            await this.refreshCurrentPage();
            Utils.toast.info(Utils.lang === 'id' ? 'Cache dihapus, data diperbarui' : '缓存已清除，数据已刷新', 2000);
        },

        // ---------- 侧边栏切换（移动端） ----------
        _toggleSidebar() {
            const sidebar = document.getElementById('dashSidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (!sidebar || !overlay) return;
            const isOpen = sidebar.classList.contains('open');
            if (isOpen) {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
            } else {
                sidebar.classList.add('open');
                overlay.classList.add('active');
            }
        },

        // ---------- 语言切换（仪表盘专用） ----------
        _setLang(lang) {
            if (lang !== 'id' && lang !== 'zh') return;
            Utils.setLanguage(lang);
            Utils.forceSyncLanguage();
            this.invalidateDashboardCache();
        },
    };

    JF.DashboardCore = DashboardCore;

    if (!window.APP) window.APP = {};
    const appMethods = ['init', 'router', 'refreshCurrentPage', 'navigateTo', 'goBack', 'renderLogin', 'login', 'logout', 'toggleLanguage', 'renderDashboard', 'forceRecovery', 'showCreateOrder', 'invalidateDashboardCache', 'saveCurrentPageState', 'restorePageState', 'clearPageState', 'currentFilter', 'historyStack', 'currentPage', 'currentOrderId', 'currentCustomerId'];
    for (let i = 0; i < appMethods.length; i++) {
        const method = appMethods[i];
        if (typeof DashboardCore[method] === 'function') {
            window.APP[method] = DashboardCore[method].bind(DashboardCore);
        } else {
            Object.defineProperty(window.APP, method, {
                get: function() { return DashboardCore[method]; },
                set: function(v) { DashboardCore[method] = v; },
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

    window.addEventListener('beforeunload', function() {
        if (DashboardCore && typeof DashboardCore.saveCurrentPageState === 'function') {
            DashboardCore.saveCurrentPageState();
        }
    });

    console.log('✅ JF.DashboardCore v2.5 初始化完成（侧边栏精简版）');
})();
