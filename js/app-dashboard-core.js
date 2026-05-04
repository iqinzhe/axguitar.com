// app-dashboard-core.js - v2.2 完整版（修复仪表盘渲染缺失）

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ========== 模块降级 ==========
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
                        ? `Modul "${moduleName}" gagal dimuat, kembali ke dashboard.`
                        : `模块 "${moduleName}" 加载失败，已返回仪表盘。`;
                    if (window.Toast) window.Toast.warning(msg, 5000);
                    this._showBanner(moduleName, error.message);
                }
                if (typeof fallbackFn === 'function') return await fallbackFn();
                if (JF.DashboardCore && typeof JF.DashboardCore.renderDashboard === 'function') {
                    await JF.DashboardCore.renderDashboard();
                    return true;
                }
                location.reload();
                return null;
            }
        },
        _showBanner(moduleName, errorMsg) {
            const existingBanner = document.getElementById('moduleFallbackBanner');
            if (existingBanner) {
                const content = existingBanner.querySelector('.info-bar-content');
                if (content && !content.textContent.includes(moduleName)) content.textContent += ' | ' + moduleName;
                return;
            }
            const lang = Utils.lang;
            const banner = document.createElement('div');
            banner.id = 'moduleFallbackBanner';
            banner.className = 'info-bar warning';
            banner.style.cssText = 'position:sticky;top:0;z-index:9999;margin-bottom:12px;border-radius:6px;';
            banner.innerHTML = '<span class="info-bar-icon">⚠️</span><div class="info-bar-content"><strong>' + (lang === 'id' ? 'Fitur terdegradasi' : '功能降级') + '</strong> — ' + (lang === 'id' ? `Modul "${moduleName}" gagal dimuat.` : `模块 "${moduleName}" 加载失败。`) + '</div><button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 8px;">✖</button>';
            const app = document.getElementById('app');
            if (app && app.firstChild) app.insertBefore(banner, app.firstChild);
        },
        clearAll() { this._degradedModules = {}; const b = document.getElementById('moduleFallbackBanner'); if (b) b.remove(); }
    };
    window.ModuleFallback = ModuleFallback;
    JF.ModuleFallback = ModuleFallback;

    let _overdueInterval = null;

    // ========== DashboardCore 主模块 ==========
    const DashboardCore = {
        currentFilter: "all",
        historyStack: [],
        currentPage: "login",
        currentOrderId: null,
        currentCustomerId: null,
        _isInitialized: false,

        // ========== 清理残留遮罩层 ==========
        _cleanupOverlays() {
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.style.display = '';
            }
            const sidebar = document.getElementById('dashSidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                document.body.classList.remove('menu-open');
            }
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => modal.remove());
            document.body.style.overflow = '';
            document.body.style.position = '';
        },

        // ---------- 页面状态持久化 ----------
        saveCurrentPageState() {
            try {
                if (!AUTH.isLoggedIn() || this.currentPage === 'login') return;
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
                const validPages = ['dashboard','orderTable','createOrder','viewOrder','payment','anomaly','userManagement','storeManagement','expenses','customers','paymentHistory','messageCenter','customerOrders','customerPaymentHistory','blacklist'];
                if (page && validPages.includes(page) && AUTH.isLoggedIn()) {
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
        _clearOverdueInterval() { if (_overdueInterval) { clearInterval(_overdueInterval); _overdueInterval = null; } },
        _startOverdueInterval() {
            this._clearOverdueInterval();
            if (!AUTH.isLoggedIn()) return;
            _overdueInterval = setInterval(async () => {
                try { await SUPABASE.updateOverdueDays(); if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') await this.refreshCurrentPage(); } catch (err) { console.warn('[逾期更新] 失败:', err.message); }
            }, 30 * 60 * 1000);
            setTimeout(async () => { try { await SUPABASE.updateOverdueDays(); if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') await this.refreshCurrentPage(); } catch (err) { /* ignore */ } }, 5000);
        },

        // ========== 统一外壳与内容切换 ==========
        async _ensureShell() {
            let shell = document.querySelector('.dashboard-v2');
            if (shell) return shell;
            await this.originalRenderDashboard();
            return document.querySelector('.dashboard-v2');
        },

        async _fullRenderDashboard() { await this.originalRenderDashboard(); },

        async _updateMainContent(htmlContent) {
            const mainEl = document.querySelector('.dash-main');
            if (!mainEl) return;
            mainEl.style.opacity = '0';
            mainEl.innerHTML = htmlContent;
            requestAnimationFrame(() => {
                mainEl.style.transition = 'opacity 0.2s ease';
                mainEl.style.opacity = '1';
                setTimeout(() => { mainEl.style.transition = ''; }, 200);
            });
            mainEl.scrollTop = 0;
        },

        // ========== 刷新当前页面 ==========
        async refreshCurrentPage() {
            if (!AUTH.isLoggedIn()) {
                console.log('[DashboardCore] 用户未登录，显示登录页');
                await this.renderLogin();
                return;
            }
            
            this._cleanupOverlays();
            await this._ensureShell();
            await this._updateSidebarActive();

            const page = this.currentPage;
            if (page === 'dashboard') {
                await this.originalRenderDashboard();
                return;
            }

            let contentHtml = '<div class="card"><p>' + (Utils.lang === 'id' ? 'Memuat...' : '加载中...') + '</p></div>';
            try {
                if (page === 'orderTable') {
                    if (JF.OrdersPage && typeof JF.OrdersPage.buildOrderTableHTML === 'function') {
                        contentHtml = await JF.OrdersPage.buildOrderTableHTML({ status: this.currentFilter }, 0, 50);
                    }
                } else if (page === 'customers') {
                    if (JF.CustomersPage && typeof JF.CustomersPage.buildCustomersHTML === 'function') {
                        contentHtml = await JF.CustomersPage.buildCustomersHTML();
                    }
                } else if (page === 'expenses') {
                    if (JF.ExpensesPage && typeof JF.ExpensesPage.buildExpensesHTML === 'function') {
                        contentHtml = await JF.ExpensesPage.buildExpensesHTML();
                    }
                } else if (page === 'paymentHistory') {
                    if (JF.FundsPage && typeof JF.FundsPage.buildCashFlowPageHTML === 'function') {
                        contentHtml = await JF.FundsPage.buildCashFlowPageHTML();
                    }
                } else if (page === 'anomaly') {
                    if (JF.AnomalyPage && typeof JF.AnomalyPage.buildAnomalyHTML === 'function') {
                        contentHtml = await JF.AnomalyPage.buildAnomalyHTML();
                    }
                } else if (page === 'userManagement') {
                    if (JF.UsersPage && typeof JF.UsersPage.buildUserManagementHTML === 'function') {
                        contentHtml = await JF.UsersPage.buildUserManagementHTML();
                    }
                } else if (page === 'storeManagement') {
                    if (JF.StoreManager && typeof JF.StoreManager.buildStoreManagementHTML === 'function') {
                        contentHtml = await JF.StoreManager.buildStoreManagementHTML();
                    }
                } else if (page === 'backupRestore') {
                    if (JF.BackupStorage && typeof JF.BackupStorage.renderBackupUI === 'function') {
                        await JF.BackupStorage.renderBackupUI();
                        return;
                    }
                    contentHtml = '<div class="card"><p>备份模块不可用</p></div>';
                } else if (page === 'blacklist') {
                    if (JF.BlacklistPage && typeof JF.BlacklistPage.buildBlacklistHTML === 'function') {
                        contentHtml = await JF.BlacklistPage.buildBlacklistHTML();
                    }
                } else if (page === 'messageCenter') {
                    if (JF.MessageCenter && typeof JF.MessageCenter.showMessageCenter === 'function') {
                        await JF.MessageCenter.showMessageCenter();
                        return;
                    }
                    contentHtml = '<div class="card"><p>消息中心模块不可用</p></div>';
                } else if (page === 'viewOrder' && this.currentOrderId) {
                    if (JF.OrdersPage && typeof JF.OrdersPage.renderViewOrderHTML === 'function') {
                        contentHtml = await JF.OrdersPage.renderViewOrderHTML(this.currentOrderId);
                    }
                } else if (page === 'payment' && this.currentOrderId) {
                    if (JF.PaymentPage && typeof JF.PaymentPage.showPayment === 'function') {
                        await JF.PaymentPage.showPayment(this.currentOrderId);
                        return;
                    }
                } else if (page === 'customerOrders' && this.currentCustomerId) {
                    if (JF.CustomersPage && typeof JF.CustomersPage.buildCustomerOrdersHTML === 'function') {
                        contentHtml = await JF.CustomersPage.buildCustomerOrdersHTML(this.currentCustomerId);
                    }
                } else if (page === 'customerPaymentHistory' && this.currentCustomerId) {
                    if (JF.CustomersPage && typeof JF.CustomersPage.buildCustomerPaymentHistoryHTML === 'function') {
                        contentHtml = await JF.CustomersPage.buildCustomerPaymentHistoryHTML(this.currentCustomerId);
                    }
                } else {
                    contentHtml = '<div class="card"><p>⚠️ ' + (Utils.lang === 'id' ? 'Halaman tidak ditemukan' : '页面不存在') + '</p></div>';
                }
                await this._updateMainContent(contentHtml);
                document.querySelectorAll('.amount-input').forEach(el => Utils.bindAmountFormat && Utils.bindAmountFormat(el));
            } catch (err) {
                console.error('[refreshCurrentPage] error:', err);
                await this._updateMainContent('<div class="card"><p>❌ ' + (Utils.lang === 'id' ? 'Gagal memuat halaman' : '页面加载失败') + '</p><button onclick="location.reload()" class="btn btn--sm btn--primary">🔄 Refresh</button></div>');
            }
        },

        async _updateSidebarActive() {
            const navItems = document.querySelectorAll('.nav-item');
            if (!navItems.length) return;
            for (const item of navItems) {
                const onclick = item.getAttribute('onclick') || '';
                const match = onclick.match(/navigateTo\('([^']+)'\)/);
                if (match && match[1] === this.currentPage) item.classList.add('active');
                else item.classList.remove('active');
            }
            const activeOrders = await this._getActiveOrdersCount();
            const badgeSpan = document.querySelector('.nav-item[onclick*="orderTable"] .nav-badge');
            if (badgeSpan) badgeSpan.textContent = activeOrders || '';
        },

        async _getActiveOrdersCount() {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                const client = SUPABASE.getClient();
                let q = client.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active');
                if (profile?.role !== 'admin' && profile?.store_id) q = q.eq('store_id', profile.store_id);
                const { count } = await q;
                return count || 0;
            } catch (e) { return 0; }
        },

        // ---------- 侧边栏控制 ----------
        _toggleSidebar(e) {
            const sidebar = document.getElementById('dashSidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (!sidebar) return;
            const isOpen = sidebar.classList.contains('open');
            if (isOpen) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
                document.body.classList.remove('menu-open');
            } else {
                sidebar.classList.add('open');
                if (overlay) overlay.classList.add('active');
                document.body.classList.add('menu-open');
            }
            if (e && e.stopPropagation) e.stopPropagation();
        },

        _initSidebarCloseOnMain() {
            const mainEl = document.querySelector('.dash-main');
            if (!mainEl) return;
            mainEl.removeEventListener('click', this._handleMainClick);
            this._handleMainClick = (e) => {
                const sidebar = document.getElementById('dashSidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar && sidebar.classList.contains('open')) {
                    if (!sidebar.contains(e.target)) {
                        this._toggleSidebar();
                    }
                }
            };
            mainEl.addEventListener('click', this._handleMainClick);
        },

        _setLang(lang) {
            Utils.setLanguage(lang);
            Utils.forceSyncLanguage();
            this.refreshCurrentPage();
        },

        // ========== 路由和导航 ==========
        navigateTo(page, params) {
            if (!AUTH.isLoggedIn() && page !== 'login') {
                console.log('[DashboardCore] 用户未登录，重定向到登录页');
                this.renderLogin();
                return;
            }
            
            this._cleanupOverlays();
            window.scrollTo(0, 0);
            this.historyStack.push({
                page: this.currentPage,
                orderId: this.currentOrderId,
                customerId: this.currentCustomerId,
                filter: this.currentFilter
            });
            this.currentPage = page;
            if (params) {
                if (params.orderId) this.currentOrderId = params.orderId;
                if (params.customerId) this.currentCustomerId = params.customerId;
            }
            this.saveCurrentPageState();
            this.refreshCurrentPage().catch(err => {
                console.error('导航失败', err);
                this.renderDashboard();
            });
        },

        goBack() {
            this._cleanupOverlays();
            if (this.historyStack.length > 0) {
                const prev = this.historyStack.pop();
                this.currentPage = prev.page;
                this.currentOrderId = prev.orderId || null;
                this.currentCustomerId = prev.customerId || null;
                this.currentFilter = prev.filter || "all";
                this.saveCurrentPageState();
                this.refreshCurrentPage();
            } else {
                this.navigateTo('dashboard');
            }
        },

        // ========== 仪表盘渲染（核心） ==========
        async originalRenderDashboard() {
            if (!AUTH.isLoggedIn()) {
                console.log('[DashboardCore] 用户未登录，显示登录页');
                await this.renderLogin();
                return;
            }
            
            this.currentPage = 'dashboard';
            this.saveCurrentPageState();
            this._cleanupOverlays();

            const appDiv = document.getElementById("app");
            if (appDiv && !appDiv.innerHTML.includes('dashboard-skeleton')) {
                appDiv.innerHTML = Utils.renderSkeleton('dashboard');
            }
            
            try {
                const lang = Utils.lang;
                const t = Utils.t.bind(Utils);
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();
                const storeId = profile?.store_id;

                const cacheKey = `dashboard_v2_${isAdmin ? 'admin' : storeId}`;
                const report = await JF.Cache.get(cacheKey, async () => {
                    const client = SUPABASE.getClient();
                    const practiceIds = isAdmin ? await SUPABASE._getPracticeStoreIds() : [];
                    const applyFilter = function(q) {
                        if (isAdmin && practiceIds.length > 0) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                        else if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                        return q;
                    };
                    const [totalRes, activeRes, completedRes, overdueRes, activeOrdersData, allOrdersData] = await Promise.all([
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'completed'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active').gte('overdue_days', 1),
                        applyFilter(client.from('orders').select('loan_amount, admin_fee, admin_fee_paid, service_fee_amount, service_fee_paid, interest_paid_total, principal_paid')).eq('status', 'active'),
                        applyFilter(client.from('orders').select('loan_amount')),
                    ]);
                    let totalLoanActive = 0, adminFeesCollected = 0, serviceFeesCollected = 0, interestCollected = 0, principalCollected = 0;
                    for (const o of (activeOrdersData.data || [])) {
                        totalLoanActive += (o.loan_amount || 0);
                        if (o.admin_fee_paid) adminFeesCollected += (o.admin_fee || 0);
                        serviceFeesCollected += (o.service_fee_paid || 0);
                        interestCollected += (o.interest_paid_total || 0);
                        principalCollected += (o.principal_paid || 0);
                    }
                    let totalLoanAll = 0;
                    for (const o of (allOrdersData.data || [])) totalLoanAll += (o.loan_amount || 0);
                    let totalInjectedCapital = 0;
                    try {
                        let injQuery = client.from('capital_injections').select('amount').eq('is_voided', false);
                        if (!isAdmin && storeId) injQuery = injQuery.eq('store_id', storeId);
                        const injResult = await injQuery;
                        totalInjectedCapital = (injResult.data || []).reduce((s, i) => s + (i.amount || 0), 0);
                    } catch (e) { /* ignore */ }
                    let deployedCapital = 0;
                    try {
                        let depQuery = client.from('orders').select('loan_amount').eq('status', 'active');
                        if (!isAdmin && storeId) depQuery = depQuery.eq('store_id', storeId);
                        const depResult = await depQuery;
                        deployedCapital = (depResult.data || []).reduce((s, o) => s + (o.loan_amount || 0), 0);
                    } catch (e) { /* ignore */ }

                    let newThisMonth = 0;
                    let newLoanThisMonth = 0;
                    try {
                        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                        let newQuery = client.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', monthStart);
                        if (!isAdmin && storeId) newQuery = newQuery.eq('store_id', storeId);
                        const newResult = await newQuery;
                        newThisMonth = newResult.count || 0;
                        let loanQuery = client.from('orders').select('loan_amount').gte('created_at', monthStart);
                        if (!isAdmin && storeId) loanQuery = loanQuery.eq('store_id', storeId);
                        const loanResult = await loanQuery;
                        newLoanThisMonth = (loanResult.data || []).reduce((s, o) => s + (o.loan_amount || 0), 0);
                    } catch (e) { /* ignore */ }

                    return {
                        total_orders: totalRes.count || 0,
                        active_orders: activeRes.count || 0,
                        completed_orders: completedRes.count || 0,
                        overdue_orders: overdueRes.count || 0,
                        new_this_month: newThisMonth,
                        new_loan_this_month: newLoanThisMonth,
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

                const cashFlowCacheKey = 'cashflow_v2_' + (isAdmin ? 'admin' : storeId);
                const cashFlow = await JF.Cache.get(cashFlowCacheKey, () => SUPABASE.getCashFlowSummary(), { ttl: 3 * 60 * 1000 });
                const expensesCacheKey = 'expenses_v2_' + (isAdmin ? 'admin' : storeId);
                const totalExpenses = await JF.Cache.get(expensesCacheKey, async () => {
                    const client = SUPABASE.getClient();
                    let q = client.from('expenses').select('amount, store_id');
                    if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                    else if (isAdmin) { const practiceIds = await SUPABASE._getPracticeStoreIds(); if (practiceIds.length) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')'); }
                    const expResult = await q;
                    return (expResult.data || []).reduce((s, e) => s + (e.amount || 0), 0);
                }, { ttl: 3 * 60 * 1000 });

                // 消息中心
                let pendingCount = 0;
                let topMessages = [];
                try {
                    if (JF.MessageCenter && typeof JF.MessageCenter.getPendingMessages === 'function') {
                        const messages = await JF.MessageCenter.getPendingMessages();
                        pendingCount = messages.length;
                        topMessages = messages.slice(0, 3);
                    }
                } catch (e) { /* ignore */ }

                const totalOrders = report.total_orders;
                const activeOrders = report.active_orders;
                const completedOrders = report.completed_orders;
                const overdueOrders = report.overdue_orders;
                const newThisMonth = report.new_this_month;
                const newLoanThisMonth = report.new_loan_this_month;
                const completionRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : '0';
                const totalIncome = report.admin_fees_collected + report.service_fees_collected + report.interest_collected;
                const netProfit = totalIncome - totalExpenses;
                const injected = report.total_injected_capital;
                const deployed = report.deployed_capital;
                const available = report.available_capital;
                const utilizationRate = injected > 0 ? ((deployed / injected) * 100).toFixed(1) : '0';
                const cashBalance = (cashFlow.cash && cashFlow.cash.balance) ? cashFlow.cash.balance : 0;
                const bankBalance = (cashFlow.bank && cashFlow.bank.balance) ? cashFlow.bank.balance : 0;
                const cashIncome = (cashFlow.cash && cashFlow.cash.income) ? cashFlow.cash.income : 0;
                const cashExpense = (cashFlow.cash && cashFlow.cash.expense) ? cashFlow.cash.expense : 0;
                const bankIncome = (cashFlow.bank && cashFlow.bank.income) ? cashFlow.bank.income : 0;
                const bankExpense = (cashFlow.bank && cashFlow.bank.expense) ? cashFlow.bank.expense : 0;
                const activeNormal = activeOrders - overdueOrders;
                
                const donutData = [
                    { label: lang === 'id' ? 'Selesai' : '已完成', count: completedOrders, color: '#10b981', pct: totalOrders > 0 ? ((completedOrders/totalOrders)*100).toFixed(1) : '0' },
                    { label: lang === 'id' ? 'Aktif Normal' : '活跃·正常', count: activeNormal >= 0 ? activeNormal : 0, color: '#6366f1', pct: totalOrders > 0 ? ((activeNormal/totalOrders)*100).toFixed(1) : '0' },
                    { label: lang === 'id' ? 'Aktif Terlambat' : '活跃·逾期', count: overdueOrders, color: '#ef4444', pct: totalOrders > 0 ? ((overdueOrders/totalOrders)*100).toFixed(1) : '0' },
                ];
                const totalDonut = donutData.reduce((s, d) => s + d.count, 0) || 1;
                const circumference = 2 * Math.PI * 36;
                let dashOffset = 0;
                let donutPaths = '';
                for (const seg of donutData) {
                    const segLen = (seg.count / totalDonut) * circumference;
                    donutPaths += `<circle cx="50" cy="50" r="36" fill="none" stroke="${seg.color}" stroke-width="14" stroke-dasharray="${segLen} ${circumference - segLen}" stroke-dashoffset="${-dashOffset}" stroke-linecap="round" transform="rotate(-90 50 50)"/>`;
                    dashOffset += segLen;
                }

                const userInitial = (profile?.name || 'A').charAt(0).toUpperCase();
                const userRoleText = isAdmin ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长');
                const storeDisplay = isAdmin ? (lang === 'id' ? 'Kantor Pusat' : '总部') : Utils.escapeHtml(profile?.stores?.name || (lang === 'id' ? 'Toko' : '门店'));
                const topbarSubtitle = isAdmin ? (lang === 'id' ? 'Semua Toko · Data Real-time' : '全部门店 · 实时数据') : (lang === 'id' ? 'Data Toko · Real-time' : '门店数据 · 实时更新');
                const activeBadgeCount = activeOrders;

                let quickActions = [];
                if (isAdmin) {
                    quickActions = [
                        { icon: '👥', label: t('customers'), action: "JF.DashboardCore.navigateTo('customers')", cls: '' },
                        { icon: '📋', label: t('order_list'), action: "JF.DashboardCore.navigateTo('orderTable')", cls: '' },
                        { icon: '💉', label: lang === 'id' ? 'Injeksi Modal' : '资本注入', action: "JF.CapitalModule.showCapitalInjectionModal()", cls: '' },
                        { icon: '⚠️', label: t('anomaly_title'), action: "JF.DashboardCore.navigateTo('anomaly')", cls: '' },
                        { icon: '📝', label: lang === 'id' ? 'Pengeluaran Baru' : '新增支出', action: "JF.DashboardCore.navigateTo('expenses')", cls: '' },
                        { icon: '📦', label: t('backup_restore'), action: "JF.DashboardCore.navigateTo('backupRestore')", cls: '' },
                    ];
                } else {
                    quickActions = [
                        { icon: '👥', label: t('customers'), action: "JF.DashboardCore.navigateTo('customers')", cls: '' },
                        { icon: '📋', label: t('order_list'), action: "JF.DashboardCore.navigateTo('orderTable')", cls: '' },
                        { icon: '💰', label: lang === 'id' ? 'Bayar Biaya' : '缴费收款', action: "JF.DashboardCore.navigateTo('orderTable');setTimeout(function(){if(window.APP && APP.filterOrders)APP.filterOrders('active');},300)", cls: '' },
                        { icon: '⚠️', label: t('anomaly_title'), action: "JF.DashboardCore.navigateTo('anomaly')", cls: '' },
                        { icon: '📝', label: lang === 'id' ? 'Pengeluaran Baru' : '新增支出', action: "JF.DashboardCore.navigateTo('expenses')", cls: '' },
                        { icon: '📦', label: t('backup_restore'), action: "JF.DashboardCore.navigateTo('backupRestore')", cls: '' },
                    ];
                }
                const quickActionsHtml = quickActions.map(q => `<div class="quick-btn${q.cls ? ' ' + q.cls : ''}" onclick="${q.action}"><span class="qb-icon">${q.icon}</span><span class="qb-label">${q.label}</span></div>`).join('');
                
                const incomeItems = [
                    { dot: '#6366f1', label: t('admin_fee'), sub: lang === 'id' ? 'Terkumpul' : '已收取', amt: report.admin_fees_collected, cls: '' },
                    { dot: '#8b5cf6', label: t('service_fee'), sub: lang === 'id' ? 'Bulan ini' : '月累计', amt: report.service_fees_collected, cls: '' },
                    { dot: '#06b6d4', label: t('interest'), sub: lang === 'id' ? 'Bulan ini' : '月累计', amt: report.interest_collected, cls: '' },
                    { dot: '#ef4444', label: lang === 'id' ? 'Pengeluaran' : '支出合计', sub: lang === 'id' ? 'Biaya Operasional' : '运营成本', amt: totalExpenses, cls: 'expense' },
                ];
                const incomeItemsHtml = incomeItems.map(item => `<div class="income-item"><div class="income-dot" style="background:${item.dot}"></div><div><div class="income-name">${item.label}</div><div class="income-sub">${item.sub}</div></div><div class="income-amt${item.cls === 'expense' ? ' expense' : ''}">${item.cls === 'expense' ? '−' : ''}${Utils.formatCurrency(item.amt)}</div></div>`).join('');

                let previewHtml = '';
                if (pendingCount === 0) {
                    previewHtml = `<div class="empty-preview">✅ ${lang === 'id' ? 'Tidak ada pesan tertunda' : '暂无待发送消息'}</div>`;
                } else {
                    previewHtml = `
                        <div class="preview-list">
                            ${topMessages.map(m => `
                                <div class="preview-item ${m.overdueDays > 0 ? 'urgent' : ''}">
                                    <span class="preview-order">${Utils.escapeHtml(m.orderId)}</span>
                                    <span class="preview-name">${Utils.escapeHtml(m.customerName)}</span>
                                    <span class="preview-badge">${m.typeLabel}</span>
                                </div>
                            `).join('')}
                            ${pendingCount > 3 ? `<div class="preview-more" onclick="JF.MessageCenter.showMessageCenter()">${lang === 'id' ? `dan ${pendingCount - 3} pesan lainnya...` : `还有 ${pendingCount - 3} 条消息...`}</div>` : ''}
                        </div>
                    `;
                }

                const finalHtml = `
        <div class="dashboard-v2">
            <div class="sidebar-overlay" id="sidebarOverlay" onclick="JF.DashboardCore._toggleSidebar()"></div>
            <div class="dash-sidebar" id="dashSidebar">
                <div class="sidebar-logo"><div class="logo-mark"><div class="logo-icon">JF</div><div><div class="logo-text">JF! by Gadai</div><div class="logo-sub">${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div></div></div></div>
                <div class="sidebar-user">
                    <div class="user-av">${userInitial}</div>
                    <div class="user-info">
                        <div class="user-name-top">${Utils.escapeHtml(profile?.name || 'User')}</div>
                        <div class="user-detail-row">
                            <span class="user-role">${userRoleText}</span>
                            <span class="user-store-badge">${storeDisplay}</span>
                        </div>
                    </div>
                </div>
                <div class="sidebar-nav">
                    <div class="nav-section-label">${lang === 'id' ? 'Menu Utama' : '主菜单'}</div>
                    <div class="nav-item active" onclick="JF.DashboardCore.navigateTo('dashboard')"><span class="nav-icon">◼</span> ${lang === 'id' ? 'Dasbor' : '仪表盘'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('customers')"><span class="nav-icon">👥</span> ${t('customers')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('orderTable')"><span class="nav-icon">📋</span> ${t('order_list')}${activeBadgeCount > 0 ? `<span class="nav-badge">${activeBadgeCount}</span>` : ''}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('paymentHistory')"><span class="nav-icon">💰</span> ${lang === 'id' ? 'Arus Kas' : '资金流水'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('expenses')"><span class="nav-icon">📝</span> ${t('expenses')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('messageCenter')"><span class="nav-icon">💬</span> ${lang === 'id' ? 'Pusat Pesan' : '消息中心'}${pendingCount > 0 ? `<span class="nav-badge" style="background:#ef4444;">${pendingCount > 99 ? '99+' : pendingCount}</span>` : ''}</div>
                    ${isAdmin ? `<div class="nav-section-label" style="margin-top:8px;">${lang === 'id' ? 'Manajemen' : '管理'}</div>
                    <div class="nav-item" onclick="JF.CapitalModule.showCapitalInjectionModal()"><span class="nav-icon">💉</span> ${lang === 'id' ? 'Injeksi Modal' : '资本注入'}</div>
                    <div class="nav-item" onclick="JF.ProfitPage.showDistributionPage()"><span class="nav-icon">💸</span> ${lang === 'id' ? 'Distribusi Laba' : '收益处置'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('anomaly')"><span class="nav-icon">⚠️</span> ${t('anomaly_title')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('userManagement')"><span class="nav-icon">👤</span> ${t('user_management')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('storeManagement')"><span class="nav-icon">🏪</span> ${t('store_management')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('backupRestore')"><span class="nav-icon">📦</span> ${t('backup_restore')}</div>` : `
                    <div class="nav-section-label" style="margin-top:8px;">${lang === 'id' ? 'Manajemen' : '管理'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('anomaly')"><span class="nav-icon">⚠️</span> ${t('anomaly_title')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('backupRestore')"><span class="nav-icon">📦</span> ${t('backup_restore')}</div>`}
                    <div style="flex:1;"></div>
                    <div class="nav-item danger" onclick="JF.DashboardCore.logout()"><span class="nav-icon">🚪</span> ${t('save_exit')}</div>
                </div>
                <div class="sidebar-footer"><div class="lang-toggle"><div class="lang-btn-side${Utils.lang === 'zh' ? ' active-lang' : ''}" onclick="JF.DashboardCore._setLang('zh')">中文</div><div class="lang-btn-side${Utils.lang === 'id' ? ' active-lang' : ''}" onclick="JF.DashboardCore._setLang('id')">Bahasa</div></div></div>
            </div>
            <div class="dash-topbar">
                <div class="topbar-left"><div class="btn btn--outline" id="hamburgerBtn" onclick="JF.DashboardCore._toggleSidebar()">☰</div><div><div class="topbar-title">${lang === 'id' ? 'Dasbor' : '仪表盘总览'}</div><div class="topbar-sub">${topbarSubtitle}</div></div></div>
                <div class="topbar-right">${overdueOrders > 0 ? `<div class="btn btn--warning" onclick="JF.DashboardCore.navigateTo('anomaly')">⚠️</div>` : ''}<div class="topbar-store-badge">${storeDisplay} · ${userRoleText}</div><div class="btn btn--outline" onclick="JF.DashboardCore.invalidateDashboardCache()">🔄</div></div>
            </div>
            <div class="dash-main">
                <div class="kpi-row">
                    <div class="kpi-card kpi-card--blue">
                        <div class="kpi-icon">📋</div>
                        <div class="kpi-val">${totalOrders}</div>
                        <div class="kpi-label">${lang === 'id' ? 'Total Pesanan' : '累计订单总数'}</div>
                        <div class="kpi-trend">${lang === 'id' ? 'Bulan ini +' : '本月新增 +'}${newThisMonth}</div>
                    </div>
                    <div class="kpi-card kpi-card--green">
                        <div class="kpi-icon">💵</div>
                        <div class="kpi-val green">${Utils.formatCurrency(report.total_loan_amount)}</div>
                        <div class="kpi-label">${lang === 'id' ? 'Total Pinjaman' : '累计放贷总额'}</div>
                        <div class="kpi-trend">${lang === 'id' ? 'Bulan ini +' : '本月发放 +'}${Utils.formatCurrency(newLoanThisMonth)}</div>
                    </div>
                    <div class="kpi-card kpi-card--amber">
                        <div class="kpi-icon">🔄</div>
                        <div class="kpi-val amber">${activeOrders}</div>
                        <div class="kpi-label">${lang === 'id' ? 'Pesanan Aktif' : '活跃在押订单'}</div>
                        ${overdueOrders > 0 ? `<div class="kpi-trend down">${lang === 'id' ? 'Terlambat' : '逾期'} ${overdueOrders} ${lang === 'id' ? 'pesanan' : '笔'} ⚠️</div>` : `<div class="kpi-trend">${lang === 'id' ? 'Semua normal' : '全部正常'} ✅</div>`}
                    </div>
                    <div class="kpi-card kpi-card--green">
                        <div class="kpi-icon">✅</div>
                        <div class="kpi-val green">${completedOrders}</div>
                        <div class="kpi-label">${lang === 'id' ? 'Sudah Ditebus' : '已完成赎回'}</div>
                        <div class="kpi-trend">${lang === 'id' ? 'Tingkat Selesai' : '完成率'} ${completionRate}%</div>
                    </div>
                </div>
                <div class="mid-row">
                    <div class="fund-flow-card">
                        <div class="card-header"><div class="card-title">💰 ${lang === 'id' ? 'Struktur Dana' : '资金结构总览'}</div></div>
                        <div class="fund-total-row">
                            <div class="fund-block fund-block--injected"><div class="fund-block-label">${lang === 'id' ? 'Total Modal Disetor' : '总投入资本'}</div><div class="fund-block-val">${Utils.formatCurrency(injected)}</div><div class="fund-block-sub">${lang === 'id' ? 'Dasar Operasional Gadai' : '典当运营基础'}</div></div>
                            <div class="fund-block fund-block--deployed"><div class="fund-block-label">${lang === 'id' ? 'Dalam Gadai' : '在押资金'}</div><div class="fund-block-val">${Utils.formatCurrency(deployed)}</div><div class="fund-block-sub">${activeOrders} ${lang === 'id' ? 'pesanan aktif' : '笔活跃订单'}</div></div>
                            <div class="fund-block fund-block--free"><div class="fund-block-label">${lang === 'id' ? 'Dana Tersedia' : '可动用资金'}</div><div class="fund-block-val">${Utils.formatCurrency(available)}</div><div class="fund-block-sub">${lang === 'id' ? 'Kas + Bank' : '现金 + 银行'}</div></div>
                        </div>
                        <div class="util-bar-wrap"><div class="util-bar-label"><span>${lang === 'id' ? 'Tingkat Utilisasi' : '资金利用率'}</span><span class="util-bar-pct">${utilizationRate}%</span></div><div class="util-bar-track"><div class="util-bar-fill" style="width:${Math.min(utilizationRate, 100)}%;"></div></div></div>
                        <div class="cash-bank-row">
                            <div class="cash-bank-item">
                                <div class="cb-label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜（现金）'}</div>
                                <div class="cb-val">${Utils.formatCurrency(cashBalance)}</div>
                                <div class="cb-flow">
                                    <span class="in">↑ +${Utils.formatCurrency(cashIncome)}</span>
                                    <span class="out">↓ −${Utils.formatCurrency(cashExpense)}</span>
                                </div>
                            </div>
                            <div class="cash-bank-item">
                                <div class="cb-label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                                <div class="cb-val">${Utils.formatCurrency(bankBalance)}</div>
                                <div class="cb-flow">
                                    <span class="in">↑ +${Utils.formatCurrency(bankIncome)}</span>
                                    <span class="out">↓ −${Utils.formatCurrency(bankExpense)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="transfer-row-v2">
                            <div class="tx-btn-v2" onclick="JF.FundsPage.showTransferModal('cash_to_bank')">🏦→🏧 ${lang === 'id' ? 'Setor ke Bank' : '现金存入银行'}</div>
                            <div class="tx-btn-v2" onclick="JF.FundsPage.showTransferModal('bank_to_cash')">🏧→🏦 ${lang === 'id' ? 'Tarik ke Kas' : '银行取现'}</div>
                            ${isAdmin ? `<div class="tx-btn-v2" onclick="JF.FundsPage.showTransferModal('store_to_hq')">🏢 ${t('submit_to_hq')}</div>` : ''}
                        </div>
                    </div>
                    <div class="income-card"><div class="card-header"><div class="card-title">📊 ${lang === 'id' ? 'Komposisi Pendapatan' : '收入构成'}</div></div><div class="income-items">${incomeItemsHtml}</div><div class="net-profit-box"><div><div class="np-label">${t('net_profit')}</div><div class="np-sub">${lang === 'id' ? 'Admin + Layanan + Bunga − Pengeluaran' : '管理费 + 服务费 + 利息 − 支出'}</div></div><div class="np-val">${Utils.formatCurrency(netProfit)}</div></div></div>
                </div>
                <div class="bottom-row" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="quick-card">
                        <div class="card-header"><div class="card-title">⚡ ${lang === 'id' ? 'Aksi Cepat' : '快捷操作'}</div></div>
                        <div class="quick-grid">${quickActionsHtml}</div>
                    </div>
                    <div class="order-status-card">
                        <div class="card-header"><div class="card-title">🗂 ${lang === 'id' ? 'Distribusi Status Pesanan' : '订单状态分布'}</div></div>
                        <div class="donut-area">
                            <svg class="donut-svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#f1f5f9" stroke-width="14"/>${donutPaths}<text x="50" y="48" text-anchor="middle" font-size="16" font-weight="700" fill="#1a1a2e" font-family="var(--font-mono)">${totalOrders}</text><text x="50" y="60" text-anchor="middle" font-size="7" fill="#94a3b8" font-family="var(--font-sans)">${lang === 'id' ? 'Total Pesanan' : '总订单'}</text></svg>
                            <div class="donut-legend">${donutData.map(d => `<div class="legend-item"><div class="legend-dot" style="background:${d.color}"></div><div><div class="legend-name">${d.label}</div><div class="legend-pct">${d.pct}%</div></div><div class="legend-count">${d.count}</div></div>`).join('')}</div>
                        </div>
                    </div>
                    <div class="message-center-card" style="display:flex; flex-direction:column;">
                        <div class="card-header">
                            <div class="card-title">💬 ${lang === 'id' ? 'Pusat Pesan' : '消息中心'}</div>
                            ${pendingCount > 0 ? `<span class="message-badge">${pendingCount}</span>` : ''}
                            <div class="card-action" onclick="JF.MessageCenter.showMessageCenter()">${lang === 'id' ? 'Lihat Semua →' : '查看全部 →'}</div>
                        </div>
                        <div class="message-preview">
                            ${previewHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
                
                document.getElementById("app").innerHTML = finalHtml;
                this._initSidebarCloseOnMain();
                
                if (!document.getElementById('messageCenterStyle')) {
                    const style = document.createElement('style');
                    style.id = 'messageCenterStyle';
                    style.textContent = `
                        .message-center-card {
                            background: #fff;
                            border-radius: 12px;
                            border: 1px solid #c8d8e8;
                            box-shadow: 0 1px 3px rgba(14, 116, 144, 0.06);
                            padding: 12px;
                            transition: box-shadow 0.2s ease, transform 0.2s ease;
                        }
                        .message-center-card:hover {
                            box-shadow: 0 4px 14px rgba(14, 116, 144, 0.1);
                            transform: translateY(-1px);
                        }
                        .message-badge {
                            background: #ef4444;
                            color: white;
                            font-size: 11px;
                            font-weight: 600;
                            padding: 2px 8px;
                            border-radius: 20px;
                            margin-left: 8px;
                        }
                        .message-preview {
                            margin-top: 8px;
                            flex: 1;
                        }
                        .empty-preview { text-align: center; padding: 20px; color: #94a3b8; font-size: 13px; }
                        .preview-list { display: flex; flex-direction: column; gap: 8px; }
                        .preview-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f8fafc; border-radius: 8px; font-size: 12px; border-left: 3px solid #cbd5e1; }
                        .preview-item.urgent { border-left-color: #ef4444; background: #fef2f2; }
                        .preview-order { font-weight: 600; color: #0e7490; min-width: 80px; }
                        .preview-name { flex: 1; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .preview-badge { font-size: 10px; padding: 2px 6px; border-radius: 12px; background: #e2e8f0; white-space: nowrap; }
                        .preview-item.urgent .preview-badge { background: #fee2e2; color: #dc2626; }
                        .preview-more { text-align: center; font-size: 11px; color: #64748b; padding: 6px; cursor: pointer; }
                        .preview-more:hover { color: #0e7490; text-decoration: underline; }
                        .bottom-row { display: grid; gap: 12px; }
                        @media (max-width: 768px) { .bottom-row { grid-template-columns: 1fr !important; } }
                        @keyframes dashFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                        .kpi-card, .fund-flow-card, .income-card, .quick-card, .order-status-card, .message-center-card { animation: dashFadeIn 0.4s ease forwards; }
                        .kpi-card:nth-child(2) { animation-delay: 0.05s; } .kpi-card:nth-child(3) { animation-delay: 0.10s; } .kpi-card:nth-child(4) { animation-delay: 0.15s; }
                    `;
                    document.head.appendChild(style);
                }
            } catch (err) {
                console.error("originalRenderDashboard error:", err);
                document.getElementById("app").innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p>⚠️ ' + (Utils.lang === 'id' ? 'Gagal memuat dashboard: ' + err.message : '仪表盘加载失败: ' + err.message) + '</p><button onclick="APP.forceRecovery()" class="btn btn--warning" style="margin-right:8px;">🔄 ' + (Utils.lang === 'id' ? 'Pulihkan Paksa' : '强制恢复') + '</button><button onclick="location.reload()" class="btn btn--outline">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button></div>';
            }
        },

        async renderDashboard() {
            if (!AUTH.isLoggedIn()) {
                await this.renderLogin();
                return;
            }
            this.currentPage = 'dashboard';
            this.saveCurrentPageState();
            this._cleanupOverlays();
            if (!document.querySelector('.dashboard-v2')) {
                await this.originalRenderDashboard();
            } else {
                await this.refreshCurrentPage();
            }
        },

        async renderLogin() {
            this.currentPage = 'login';
            this.clearPageState();
            this._cleanupOverlays();
            this._clearOverdueInterval();
            
            const lang = Utils.lang;
            document.getElementById("app").innerHTML = `
                <div class="login-container"><div class="login-box"><div class="lang-toggle"><button onclick="APP.toggleLanguage()" class="btn btn--outline">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button></div><div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;"><img src="icons/pagehead-logo.png" alt="JF!" style="height:36px;"><h2 class="login-title" style="margin:0;">JF! by Gadai</h2></div><h3>${Utils.t('login')}</h3><div id="loginError" class="info-bar danger" style="display:none;margin-bottom:16px;"><span class="info-bar-icon">⚠️</span><div class="info-bar-content" id="loginErrorMessage"></div></div><div class="form-group"><label>${lang === 'id' ? 'Email / Username' : '邮箱 / 用户名'}</label><input id="username" placeholder="email@domain.com" autocomplete="username"></div><div class="form-group" style="position:relative;"><label>${Utils.t('password')}</label><input id="password" type="password" placeholder="${Utils.t('password')}" autocomplete="current-password"><span onclick="Utils.togglePasswordVisibility('password', this)" style="position:absolute;right:12px;top:38px;cursor:pointer;font-size:18px;">👁️</span></div><div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;"><input type="checkbox" id="rememberMe" style="width:16px;height:16px;cursor:pointer;"><label for="rememberMe" style="cursor:pointer;">${lang === 'id' ? 'Ingat saya' : '记住我'}</label></div><button onclick="APP.login()" id="loginBtn" class="btn btn--primary btn--block">${Utils.t('login')}</button><p class="login-note">ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}</p></div></div>`;
        },

        async login() {
            if (this._loginLock) return;
            this._loginLock = true;
            try {
                const username = document.getElementById("username")?.value.trim();
                const password = document.getElementById("password")?.value;
                const rememberMe = document.getElementById("rememberMe")?.checked;
                const errorDiv = document.getElementById("loginError");
                const errorMsg = document.getElementById("loginErrorMessage");
                const btn = document.getElementById("loginBtn");
                if (errorDiv) errorDiv.style.display = 'none';
                if (!username || !password) { if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = Utils.t('fill_all_fields'); } return; }
                if (btn) { btn.disabled = true; btn.textContent = '...'; }
                
                AUTH.setRememberMe(rememberMe);
                if (rememberMe) { localStorage.setItem('jf_remembered_user', username); }
                else { localStorage.removeItem('jf_remembered_user'); }
                
                const user = await AUTH.login(username, password);
                if (!user) {
                    if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = Utils.lang === 'id' ? 'Login gagal. Periksa kembali email/username dan password Anda.' : '登录失败，请检查邮箱/用户名和密码。'; }
                    if (btn) { btn.disabled = false; btn.textContent = Utils.t('login'); }
                    return;
                }
                this.clearPageState();
                this._isInitialized = true;
                this._startOverdueInterval();
                await this.renderDashboard();
            } catch (error) {
                console.error('[DashboardCore] 登录异常:', error);
                const errorDiv = document.getElementById("loginError");
                const errorMsg = document.getElementById("loginErrorMessage");
                if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = error.message || Utils.t('login_failed'); }
            } finally {
                this._loginLock = false;
                const btn = document.getElementById("loginBtn");
                if (btn) { btn.disabled = false; btn.textContent = Utils.t('login'); }
            }
        },

        async logout() {
            this._clearOverdueInterval();
            const confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
            if (!confirmed) return;
            this.clearPageState();
            sessionStorage.clear();
            this._isInitialized = false;
            await AUTH.logout();
            await this.renderLogin();
        },

        toggleLanguage() {
            const newLang = Utils.lang === 'id' ? 'zh' : 'id';
            Utils.setLanguage(newLang);
            if (this.currentPage === 'login' || !AUTH.isLoggedIn()) this.renderLogin();
            else this.refreshCurrentPage();
        },

        forceRecovery() {
            console.log('[Recovery] 手动强制恢复');
            const appDiv = document.getElementById('app');
            if (!appDiv) return;
            const loadingText = Utils.lang === 'id' ? 'Sedang memulihkan...' : '恢复中...';
            appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;margin:20px;"><div class="loader" style="margin:20px auto;"></div><p>' + loadingText + '</p></div>';
            setTimeout(async () => {
                try {
                    if (AUTH.isLoggedIn()) { await this.refreshCurrentPage(); }
                    else { await this.renderLogin(); }
                } catch (err) { 
                    appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;"><p>⚠️ ' + (Utils.lang === 'id' ? 'Pemulihan gagal, muat ulang halaman.' : '恢复失败，请刷新页面。') + '</p><button onclick="location.reload()" class="btn btn--primary" style="margin-top:12px;">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button></div>'; 
                }
            }, 100);
        },

        invalidateDashboardCache() {
            JF.Cache.clear();
            this.refreshCurrentPage();
            Utils.toast.info(Utils.lang === 'id' ? 'Cache dihapus, data diperbarui' : '缓存已清除，数据已刷新', 2000);
        },

        async init() {
            console.log('[DashboardCore] 开始初始化...');
            ModuleFallback.clearAll();
            document.getElementById("app").innerHTML = Utils.renderSkeleton('default');
            
            try {
                await AUTH.init();
                
                if (!AUTH.isLoggedIn()) {
                    console.log('[DashboardCore] 用户未登录，显示登录页面');
                    await this.renderLogin();
                    return;
                }
                
                console.log('[DashboardCore] 用户已登录:', AUTH.user?.name);
                
                const saved = this.restorePageState();
                if (saved.page) {
                    console.log('[DashboardCore] 恢复页面状态:', saved.page);
                    this.currentPage = saved.page;
                    this.currentOrderId = saved.orderId || null;
                    this.currentCustomerId = saved.customerId || null;
                    this.currentFilter = saved.filter || "all";
                    
                    if (this.currentPage !== 'login') {
                        await this.refreshCurrentPage();
                    } else {
                        await this.renderDashboard();
                    }
                } else {
                    console.log('[DashboardCore] 无保存状态，显示仪表盘');
                    await this.renderDashboard();
                }
                
                this._startOverdueInterval();
                this._isInitialized = true;
                
            } catch (error) {
                console.error('[DashboardCore] 初始化异常:', error);
                
                try { await AUTH.forceClearAuth(); } catch (e) { console.warn('[DashboardCore] 清除认证状态失败:', e); }
                
                this.clearPageState();
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat sistem, silakan login ulang' : '系统加载失败，请重新登录', 5000);
                
                setTimeout(() => { this.renderLogin(); }, 1000);
            }
        },
    };

    // ========== 挂载到命名空间 ==========
    JF.DashboardCore = DashboardCore;

    if (!window.APP) {
        window.APP = DashboardCore;
    } else {
        for (const key of Object.keys(DashboardCore)) {
            if (typeof DashboardCore[key] === 'function' && !window.APP[key]) {
                window.APP[key] = DashboardCore[key].bind(DashboardCore);
            }
        }
        window.APP.navigateTo = DashboardCore.navigateTo.bind(DashboardCore);
        window.APP.goBack = DashboardCore.goBack.bind(DashboardCore);
        window.APP.refreshCurrentPage = DashboardCore.refreshCurrentPage.bind(DashboardCore);
        window.APP.renderDashboard = DashboardCore.renderDashboard.bind(DashboardCore);
        window.APP.logout = DashboardCore.logout.bind(DashboardCore);
        window.APP.forceRecovery = DashboardCore.forceRecovery.bind(DashboardCore);
        window.APP.invalidateDashboardCache = DashboardCore.invalidateDashboardCache.bind(DashboardCore);
        window.APP.toggleLanguage = DashboardCore.toggleLanguage.bind(DashboardCore);
        window.APP.login = DashboardCore.login.bind(DashboardCore);
        window.APP.renderLogin = DashboardCore.renderLogin.bind(DashboardCore);
        window.APP.init = DashboardCore.init.bind(DashboardCore);
    }

    window.addEventListener('beforeunload', () => {
        if (JF.DashboardCore) JF.DashboardCore.saveCurrentPageState();
    });

    console.log('✅ JF.DashboardCore v2.2 完整版已加载');
})();
