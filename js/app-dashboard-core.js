// app-dashboard-core.js - v2.0（修复：刷新后停留当前页面）
window.APP = window.APP || {};

// ========== 逾期更新定时器 ==========
let _overdueUpdateInterval = null;

// ==================== 模块降级通知 ====================
const ModuleFallback = {
    _degradedModules: {},
    
    async safeCall(moduleName, fn, args, fallbackValue) {
        try {
            if (typeof fn !== 'function') throw new Error('module_not_loaded');
            return await fn.apply(null, args || []);
        } catch (error) {
            var lang = Utils.lang;
            var moduleKey = moduleName + '_' + (error.message || 'unknown');
            
            if (!this._degradedModules[moduleKey]) {
                this._degradedModules[moduleKey] = true;
                
                var msg = '';
                if (error.message === 'module_not_loaded') {
                    msg = lang === 'id'
                        ? '⚠️ 模块 "' + moduleName + '" 加载失败，部分功能可能不可用。'
                        : '⚠️ Module "' + moduleName + '" failed to load.';
                } else {
                    msg = lang === 'id'
                        ? '⚠️ 模块 "' + moduleName + '" 发生错误: ' + error.message
                        : '⚠️ Module "' + moduleName + '" error: ' + error.message;
                }
                
                if (window.Toast) {
                    window.Toast.warning(msg, 5000);
                } else {
                    setTimeout(function() { alert(msg); }, 300);
                }
                ModuleFallback._showBanner(moduleName, error.message);
            }
            
            setTimeout(function() {
                delete ModuleFallback._degradedModules[moduleKey];
            }, 10 * 60 * 1000);
            
            return fallbackValue;
        }
    },
    
    _showBanner(moduleName, errorMsg) {
        var existingBanner = document.getElementById('moduleFallbackBanner');
        if (existingBanner) {
            var content = existingBanner.querySelector('.info-bar-content');
            if (content && content.textContent.indexOf(moduleName) === -1) {
                content.textContent += ' | ' + moduleName;
            }
            return;
        }
        
        var lang = Utils.lang;
        var banner = document.createElement('div');
        banner.id = 'moduleFallbackBanner';
        banner.className = 'info-bar warning';
        banner.style.cssText = 'position:sticky;top:0;z-index:9999;margin-bottom:12px;border-radius:6px;';
        banner.innerHTML = '' +
            '<span class="info-bar-icon">⚠️</span>' +
            '<div class="info-bar-content">' +
                '<strong>' + (lang === 'id' ? '功能降级通知' : 'Feature Degraded') + '</strong> — ' +
                (lang === 'id' 
                    ? '模块 "' + moduleName + '" 加载失败，请刷新页面。'
                    : 'Module "' + moduleName + '" failed to load.') +
            '</div>' +
            '<button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 8px;" title="' + (lang === 'id' ? '关闭' : 'Close') + '">✖</button>';
        
        var app = document.getElementById('app');
        if (app && app.firstChild) {
            app.insertBefore(banner, app.firstChild);
        }
    },
    
    clearAll() {
        this._degradedModules = {};
        var banner = document.getElementById('moduleFallbackBanner');
        if (banner) banner.remove();
    }
};

window.ModuleFallback = ModuleFallback;

// ==================== 仪表盘缓存模块 ====================
const DashboardCache = {
    data: new Map(),
    ttl: 5 * 60 * 1000,
    
    getKey(...parts) { return parts.join(':'); },
    
    async get(key, fetcher, forceRefresh = false) {
        if (!forceRefresh) {
            const cached = this.data.get(key);
            if (cached && Date.now() - cached.time < this.ttl) {
                console.log(`[Cache] Hit: ${key}`);
                return cached.value;
            }
        }
        console.log(`[Cache] Miss: ${key}`);
        try {
            const value = await fetcher();
            this.data.set(key, { value, time: Date.now() });
            return value;
        } catch (error) {
            const staleCached = this.data.get(key);
            if (staleCached) {
                console.warn(`[Cache] 使用过期缓存: ${key}`, error.message);
                return staleCached.value;
            }
            throw error;
        }
    },
    
    invalidate(key) {
        if (key) {
            this.data.delete(key);
            console.log(`[Cache] Invalidated: ${key}`);
        } else {
            this.data.clear();
            console.log(`[Cache] Cleared all`);
        }
    }
};

// ==================== 聚合查询辅助方法 ====================
const DashboardStatsHelper = {
    async getDashboardStats(profile) {
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        const totalCountPromise = (() => {
            let q = supabaseClient.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            return q;
        })();
        
        const activeCountPromise = (() => {
            let q = supabaseClient.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            q = q.eq('status', 'active');
            return q;
        })();
        
        const completedCountPromise = (() => {
            let q = supabaseClient.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            q = q.eq('status', 'completed');
            return q;
        })();
        
        const overdueCountPromise = (() => {
            let q = supabaseClient.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            q = q.eq('status', 'active').gte('overdue_days', 1);
            return q;
        })();
        
        const activeOrdersPromise = (() => {
            let q = supabaseClient.from('orders').select('admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid, loan_amount');
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            q = q.eq('status', 'active');
            return q;
        })();
        
        const allOrdersLoanPromise = (() => {
            let q = supabaseClient.from('orders').select('loan_amount');
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            return q;
        })();
        
        const [
            totalCountResult,
            activeCountResult,
            completedCountResult,
            overdueCountResult,
            activeOrdersData,
            loanSumData
        ] = await Promise.all([
            totalCountPromise,
            activeCountPromise,
            completedCountPromise,
            overdueCountPromise,
            activeOrdersPromise,
            allOrdersLoanPromise
        ]);
        
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
    
    async getAnomalyStats(profile) {
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        let overdueQuery = supabaseClient.from('orders').select('*', { count: 'exact', head: true });
        if (!isAdmin && storeId) overdueQuery = overdueQuery.eq('store_id', storeId);
        overdueQuery = overdueQuery.eq('status', 'active').gte('overdue_days', 30);
        
        let blacklistQuery = supabaseClient.from('blacklist').select('*', { count: 'exact', head: true });
        
        const [overdue30Result, blacklistResult] = await Promise.all([
            overdueQuery,
            blacklistQuery
        ]);
        
        return {
            overdue30Count: overdue30Result?.count || 0,
            blacklistCount: blacklistResult?.count || 0
        };
    },
    
    async getMonthlyStoreRanking(profile, stores) {
        const isAdmin = profile?.role === 'admin';
        if (!isAdmin) return null;
        
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const monthEnd = today.toISOString().split('T')[0];
        
        const { data: monthlyOrders, error } = await supabaseClient
            .from('orders')
            .select('id, store_id, loan_amount, status, created_at, overdue_days')
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd);
        
        if (error) throw error;
        
        const { data: monthlyFlows } = await supabaseClient
            .from('cash_flow_records')
            .select('store_id, amount, order_id')
            .eq('direction', 'inflow')
            .eq('is_voided', false)
            .gte('recorded_at', monthStart);
        
        const flowAmountByOrder = {};
        if (monthlyFlows) {
            for (const flow of monthlyFlows) {
                if (flow.order_id) {
                    flowAmountByOrder[flow.order_id] = (flowAmountByOrder[flow.order_id] || 0) + (flow.amount || 0);
                }
            }
        }
        
        const storeInfoMap = {};
        for (const store of stores) {
            storeInfoMap[store.id] = {
                id: store.id,
                name: store.name,
                code: store.code,
                isActive: store.is_active !== false
            };
        }
        
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
        
        let eligibleStores = Object.values(storeStats);
        if (eligibleStores.length === 0) return { top3: [], bottom3: [] };
        
        for (const s of eligibleStores) s.rankSum = 0;
        
        eligibleStores.sort((a, b) => b.orderCount - a.orderCount);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankOrderCount = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        eligibleStores.sort((a, b) => a.totalLoanOutflow - b.totalLoanOutflow);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankLoanOutflow = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        eligibleStores.sort((a, b) => a.badOrders - b.badOrders);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankBadOrders = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        eligibleStores.sort((a, b) => b.totalRecovery - a.totalRecovery);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankRecovery = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        eligibleStores.sort((a, b) => a.rankSum - b.rankSum);
        
        return {
            top3: eligibleStores.slice(0, Math.min(3, eligibleStores.length)),
            bottom3: eligibleStores.slice(-Math.min(3, eligibleStores.length)).reverse()
        };
    }
};

const DashboardCore = {
    currentFilter: "all",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    // ========== 页面状态持久化（刷新后停留当前页面） ==========
    saveCurrentPageState: function() {
        try {
            // 保存到 sessionStorage（当前会话）
            sessionStorage.setItem('jf_current_page', this.currentPage || '');
            sessionStorage.setItem('jf_current_filter', this.currentFilter || "all");
            if (this.currentOrderId) {
                sessionStorage.setItem('jf_current_order_id', this.currentOrderId);
            } else {
                sessionStorage.removeItem('jf_current_order_id');
            }
            if (this.currentCustomerId) {
                sessionStorage.setItem('jf_current_customer_id', this.currentCustomerId);
            } else {
                sessionStorage.removeItem('jf_current_customer_id');
            }
            
            // 保存到 localStorage（持久化）
            localStorage.setItem('jf_last_page', this.currentPage);
            localStorage.setItem('jf_last_filter', this.currentFilter);
            if (this.currentOrderId) {
                localStorage.setItem('jf_last_order_id', this.currentOrderId);
            } else {
                localStorage.removeItem('jf_last_order_id');
            }
            if (this.currentCustomerId) {
                localStorage.setItem('jf_last_customer_id', this.currentCustomerId);
            } else {
                localStorage.removeItem('jf_last_customer_id');
            }
            
            console.log('[State] 已保存页面状态:', this.currentPage);
        } catch(e) {
            console.warn('[State] 保存状态失败:', e);
        }
    },
    
    restorePageState: function() {
        try {
            let page = sessionStorage.getItem('jf_current_page');
            let filter = sessionStorage.getItem('jf_current_filter') || "all";
            let orderId = sessionStorage.getItem('jf_current_order_id');
            let customerId = sessionStorage.getItem('jf_current_customer_id');
            
            if (!page) {
                page = localStorage.getItem('jf_last_page');
                filter = localStorage.getItem('jf_last_filter') || "all";
                orderId = localStorage.getItem('jf_last_order_id');
                customerId = localStorage.getItem('jf_last_customer_id');
            }
            
            const validPages = ['dashboard', 'orderTable', 'createOrder', 'viewOrder', 'payment', 
                                'anomaly', 'userManagement', 'storeManagement', 'expenses', 
                                'customers', 'paymentHistory', 'backupRestore', 'customerOrders', 
                                'customerPaymentHistory', 'blacklist'];
            
            if (page && validPages.includes(page) && page !== 'login') {
                console.log('[State] 从存储恢复页面:', page);
                return { page, filter, orderId, customerId };
            }
            return { page: null, filter: "all", orderId: null, customerId: null };
        } catch(e) {
            return { page: null, filter: "all", orderId: null, customerId: null };
        }
    },
    
    clearPageState: function() {
        try {
            sessionStorage.removeItem('jf_current_page');
            sessionStorage.removeItem('jf_current_filter');
            sessionStorage.removeItem('jf_current_order_id');
            sessionStorage.removeItem('jf_current_customer_id');
        } catch(e) {}
        this.currentOrderId = null;
        this.currentCustomerId = null;
    },

    // ========== 清理逾期更新定时器 ==========
    _clearOverdueUpdateInterval: function() {
        if (_overdueUpdateInterval) {
            clearInterval(_overdueUpdateInterval);
            _overdueUpdateInterval = null;
            console.log('[逾期更新] 定时器已清理');
        }
    },

    // ========== 启动逾期更新定时器 ==========
    _startOverdueUpdateInterval: function() {
        this._clearOverdueUpdateInterval();
        
        if (!AUTH.isLoggedIn()) return;
        
        _overdueUpdateInterval = setInterval(async () => {
            try {
                await SUPABASE.updateOverdueDays();
                console.log('[逾期更新] 自动更新完成', new Date().toLocaleTimeString());
                if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') {
                    await this.refreshCurrentPage();
                }
            } catch (err) {
                console.warn('[逾期更新] 失败:', err.message);
            }
        }, 30 * 60 * 1000);
        
        setTimeout(async () => {
            try {
                await SUPABASE.updateOverdueDays();
                console.log('[逾期更新] 初始化更新完成');
                if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') {
                    await this.refreshCurrentPage();
                }
            } catch (err) {
                console.warn('[逾期更新] 初始化失败:', err.message);
            }
        }, 5000);
    },

    // ========== init 方法 - 修复：刷新后停留当前页面 ==========
    init: async function() {
        var lang = Utils.lang || 'zh';
        
        // 初始化 Toast 系统
        if (window.Toast && !window.Toast._initialized) {
            window.Toast._initialized = true;
            console.log('✅ Toast 通知系统已初始化');
        }
        
        Utils.ErrorHandler.init();
        ModuleFallback.clearAll();
        
        // 显示加载界面
        document.getElementById("app").innerHTML = '' +
            '<div class="loading-container">' +
                '<div class="loader"></div>' +
                '<p class="loading-text">' + 
                    (lang === 'id' ? '🔄 Memuat sistem...' : '🔄 Loading system...') + 
                '</p>' +
            '</div>';
        
        // 设置超时
        var initTimeout = setTimeout(function() {
            var currentLang = Utils.lang || 'zh';
            var timeoutDiv = document.getElementById('initTimeout');
            if (!timeoutDiv) {
                var div = document.createElement('div');
                div.id = 'initTimeout';
                div.className = 'info-bar warning';
                div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;max-width:400px;text-align:center;';
                div.innerHTML = '' +
                    '<div class="info-bar-content">' +
                        '<strong>' + (currentLang === 'id' ? '⏳ Memuat terlalu lama' : '⏳ 加载超时') + '</strong>' +
                        '<p>' + (currentLang === 'id' 
                            ? 'Sistem membutuhkan waktu lebih lama dari biasanya. Silakan periksa koneksi internet Anda dan muat ulang halaman.'
                            : '系统加载时间超过预期，请检查网络连接后刷新页面重试。') + '</p>' +
                        '<button onclick="location.reload()" style="margin-top:8px;padding:6px 16px;background:#f59e0b;color:#fff;border:none;border-radius:4px;cursor:pointer;">' +
                            (currentLang === 'id' ? '🔄 Muat Ulang' : '🔄 刷新页面') +
                        '</button>' +
                    '</div>';
                document.getElementById("app").appendChild(div);
            }
        }, 15000);
        
        try {
            // 初始化认证
            await AUTH.init();
            
            clearTimeout(initTimeout);
            var timeoutEl = document.getElementById('initTimeout');
            if (timeoutEl) timeoutEl.remove();
            
            // 检查是否已登录
            const isLoggedIn = AUTH.isLoggedIn();
            
            if (!isLoggedIn) {
                // 未登录，显示登录页
                await this.renderLogin();
                return;
            }
            
            // ========== 关键：恢复预加载的页面状态 ==========
            var targetPage = null;
            var targetOrderId = null;
            var targetCustomerId = null;
            var targetFilter = null;
            
            // 优先使用预加载的状态（从 HTML 设置）
            if (window.__PRELOADED_PAGE) {
                targetPage = window.__PRELOADED_PAGE;
                targetOrderId = window.__PRELOADED_ORDER_ID;
                targetCustomerId = window.__PRELOADED_CUSTOMER_ID;
                targetFilter = window.__PRELOADED_FILTER;
                console.log('[Init] 使用预加载状态:', targetPage);
                // 清除预加载变量
                delete window.__PRELOADED_PAGE;
                delete window.__PRELOADED_ORDER_ID;
                delete window.__PRELOADED_CUSTOMER_ID;
                delete window.__PRELOADED_FILTER;
            } else {
                // 降级：从存储中读取
                targetPage = sessionStorage.getItem('jf_current_page');
                if (!targetPage) targetPage = localStorage.getItem('jf_last_page');
                targetOrderId = sessionStorage.getItem('jf_current_order_id') || localStorage.getItem('jf_last_order_id');
                targetCustomerId = sessionStorage.getItem('jf_current_customer_id') || localStorage.getItem('jf_last_customer_id');
                targetFilter = sessionStorage.getItem('jf_current_filter') || localStorage.getItem('jf_last_filter') || 'all';
                if (targetPage) {
                    console.log('[Init] 从存储读取状态:', targetPage);
                }
            }
            
            // 验证目标页面
            const validPages = ['dashboard', 'orderTable', 'createOrder', 'viewOrder', 'payment', 
                                'anomaly', 'userManagement', 'storeManagement', 'expenses', 
                                'customers', 'paymentHistory', 'backupRestore', 'customerOrders', 
                                'customerPaymentHistory', 'blacklist'];
            
            if (targetPage && validPages.includes(targetPage) && targetPage !== 'login') {
                // 恢复保存的页面
                this.currentPage = targetPage;
                this.currentFilter = targetFilter || 'all';
                this.currentOrderId = targetOrderId || null;
                this.currentCustomerId = targetCustomerId || null;
                
                // 保存恢复的状态
                this.saveCurrentPageState();
                
                console.log('[Init] 恢复页面到:', this.currentPage, 
                            '订单ID:', this.currentOrderId, 
                            '客户ID:', this.currentCustomerId);
                
                // 刷新当前页面
                await this.refreshCurrentPage();
            } else {
                // 没有保存的页面，显示仪表盘
                console.log('[Init] 无保存状态，显示仪表盘');
                await this.renderDashboard();
            }
            
            // 启动逾期更新定时器
            if (AUTH.isLoggedIn()) {
                this._startOverdueUpdateInterval();
            }
            
        } catch (error) {
            console.error("Init error:", error);
            clearTimeout(initTimeout);
            
            var errorMsg = (Utils.lang === 'id'
                ? '⚠️ 系统加载失败: ' + error.message
                : '⚠️ System load failed: ' + error.message);
            
            if (window.Toast) {
                window.Toast.error(errorMsg, 5000);
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="card" style="text-align:center;padding:40px;">' +
                    '<p>' + errorMsg + '</p>' +
                    '<button onclick="location.reload()" style="margin-top:12px;">🔄 ' + 
                        (Utils.lang === 'id' ? 'Muat Ulang' : '刷新页面') + '</button>' +
                '</div>';
        }
    },

    router: async function() {
        if (!AUTH.isLoggedIn()) await this.renderLogin();
        else await this.renderDashboard();
    },

    refreshCurrentPage: async function() {
        var self = this;
        
        var skeletonType = 'default';
        if (this.currentPage === 'dashboard') skeletonType = 'dashboard';
        else if (this.currentPage === 'orderTable' || this.currentPage === 'customers' || 
                 this.currentPage === 'paymentHistory' || this.currentPage === 'expenses') skeletonType = 'table';
        else if (this.currentPage === 'viewOrder' || this.currentPage === 'payment') skeletonType = 'detail';
        
        document.getElementById("app").innerHTML = Utils.renderSkeleton(skeletonType);
        
        await new Promise(function(resolve) { setTimeout(resolve, 100); });
        
        var handlers = {
            dashboard: async () => {
                try {
                    await self.renderDashboard();
                } catch (e) {
                    console.error("renderDashboard failed:", e);
                    if (window.Toast) window.Toast.error('加载仪表盘失败，请刷新页面', 4000);
                    document.getElementById("app").innerHTML = '' +
                        '<div class="card" style="text-align:center;padding:40px;">' +
                            '<p>' + (Utils.lang === 'id' ? '⚠️ 加载仪表盘失败，请刷新页面。' : '⚠️ Dashboard load failed.') + '</p>' +
                            '<button onclick="location.reload()">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button>' +
                        '</div>';
                }
            },
            orderTable: () => ModuleFallback.safeCall('Daftar Pesanan', window.APP.showOrderTable, [], self.renderDashboard()),
            createOrder: () => ModuleFallback.safeCall('Buat Pesanan', window.APP.showCreateOrder, [], null),
            viewOrder: async () => { 
                if (self.currentOrderId) {
                    return await ModuleFallback.safeCall('Detail Pesanan', window.APP.viewOrder, [self.currentOrderId], self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            payment: async () => { 
                if (self.currentOrderId) {
                    return await ModuleFallback.safeCall('Pembayaran', window.APP.showPayment, [self.currentOrderId], self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            anomaly: () => ModuleFallback.safeCall('Situasi Abnormal', window.APP.showAnomaly, [], self.renderDashboard()),
            userManagement: () => ModuleFallback.safeCall('Manajemen Peran', window.APP.showUserManagement, [], self.renderDashboard()),
            storeManagement: () => {
                if (typeof StoreManager !== 'undefined' && typeof StoreManager.renderStoreManagement === 'function') {
                    return ModuleFallback.safeCall('Manajemen Toko', StoreManager.renderStoreManagement, [], self.renderDashboard());
                }
                return self.renderDashboard();
            },
            expenses: () => ModuleFallback.safeCall('Pengeluaran', window.APP.showExpenses, [], self.renderDashboard()),
            customers: () => ModuleFallback.safeCall('Nasabah', window.APP.showCustomers, [], self.renderDashboard()),
            paymentHistory: async () => {
                if (typeof window.APP.showCashFlowPage === 'function') {
                    return await ModuleFallback.safeCall('Arus Kas', window.APP.showCashFlowPage, [], self.renderDashboard());
                }
                if (typeof window.APP.showPaymentHistory === 'function') {
                    return await ModuleFallback.safeCall('Riwayat Pembayaran', window.APP.showPaymentHistory, [], self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            backupRestore: () => {
                if (typeof Storage !== 'undefined' && typeof Storage.renderBackupUI === 'function') {
                    return ModuleFallback.safeCall('Cadangan', Storage.renderBackupUI, [], self.renderDashboard());
                }
                return self.renderDashboard();
            },
            customerOrders: async () => { 
                if (self.currentCustomerId && typeof window.APP.showCustomerOrders === 'function') {
                    return await ModuleFallback.safeCall('Order Nasabah', window.APP.showCustomerOrders, [self.currentCustomerId], self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            customerPaymentHistory: async () => { 
                if (self.currentCustomerId && typeof window.APP.showCustomerPaymentHistory === 'function') {
                    return await ModuleFallback.safeCall('Riwayat Nasabah', window.APP.showCustomerPaymentHistory, [self.currentCustomerId], self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            blacklist: () => ModuleFallback.safeCall('Daftar Hitam', window.APP.showBlacklist, [], self.renderDashboard())
        };
        
        var handler = handlers[this.currentPage];
        if (handler) await handler();
        else await self.renderDashboard();
    },

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
        
        // 关键：保存状态
        this.saveCurrentPageState();
        
        var self = this;
        var moduleMap = {
            'orderTable':       { fn: window.APP.showOrderTable,       name: 'Daftar Pesanan' },
            'createOrder':      { fn: window.APP.showCreateOrder,      name: 'Buat Pesanan' },
            'dashboard':        { fn: self.renderDashboard,            name: 'Dashboard', isCore: true },
            'anomaly':          { fn: window.APP.showAnomaly,          name: 'Situasi Abnormal' },
            'userManagement':   { fn: window.APP.showUserManagement,   name: 'Manajemen Peran' },
            'storeManagement':  { 
                fn: typeof StoreManager !== 'undefined' ? StoreManager.renderStoreManagement : null, 
                name: 'Manajemen Toko' 
            },
            'expenses':         { fn: window.APP.showExpenses,         name: 'Pengeluaran' },
            'customers':        { fn: window.APP.showCustomers,        name: 'Nasabah' },
            'backupRestore':    { 
                fn: typeof Storage !== 'undefined' ? Storage.renderBackupUI : null, 
                name: 'Cadangan' 
            },
            'blacklist':        { fn: window.APP.showBlacklist,        name: 'Daftar Hitam' }
        };
        
        var mapped = moduleMap[page];
        if (mapped) {
            if (mapped.isCore) {
                mapped.fn.call(self);
            } else {
                ModuleFallback.safeCall(mapped.name, mapped.fn, [], null).then(function(result) {
                    if (result === null) self.renderDashboard();
                });
            }
            return;
        }
        
        var specialHandlers = {
            'paymentHistory': function() {
                var fn = window.APP.showCashFlowPage || window.APP.showPaymentHistory;
                ModuleFallback.safeCall('Arus Kas', fn, [], null).then(function(r) {
                    if (r === null) self.renderDashboard();
                });
            },
            'customerOrders': function() {
                if (params.customerId && typeof window.APP.showCustomerOrders === 'function') {
                    ModuleFallback.safeCall('Order Nasabah', window.APP.showCustomerOrders, [params.customerId], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                } else self.renderDashboard();
            },
            'customerPaymentHistory': function() {
                if (params.customerId && typeof window.APP.showCustomerPaymentHistory === 'function') {
                    ModuleFallback.safeCall('Riwayat Nasabah', window.APP.showCustomerPaymentHistory, [params.customerId], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                } else self.renderDashboard();
            },
            'viewOrder': function() {
                if (params.orderId) {
                    ModuleFallback.safeCall('Detail Pesanan', window.APP.viewOrder, [params.orderId], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                } else self.renderDashboard();
            },
            'payment': function() {
                if (params.orderId) {
                    ModuleFallback.safeCall('Pembayaran', window.APP.showPayment, [params.orderId], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                } else self.renderDashboard();
            }
        };
        
        var special = specialHandlers[page];
        if (special) { special(); return; }
        
        self.renderDashboard();
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
            
            var backMap = {
                'orderTable':    { fn: window.APP.showOrderTable,     name: 'Daftar Pesanan' },
                'dashboard':     { fn: self.renderDashboard,          name: 'Dashboard', isCore: true },
                'viewOrder':     { fn: window.APP.viewOrder,          name: 'Detail Pesanan', param: prev.orderId },
                'anomaly':       { fn: window.APP.showAnomaly,        name: 'Situasi Abnormal' },
                'userManagement':{ fn: window.APP.showUserManagement, name: 'Manajemen Peran' },
                'storeManagement':{ 
                    fn: typeof StoreManager !== 'undefined' ? StoreManager.renderStoreManagement : null, 
                    name: 'Manajemen Toko' 
                },
                'expenses':      { fn: window.APP.showExpenses,       name: 'Pengeluaran' },
                'customers':     { fn: window.APP.showCustomers,      name: 'Nasabah' },
                'backupRestore': { 
                    fn: typeof Storage !== 'undefined' ? Storage.renderBackupUI : null, 
                    name: 'Cadangan' 
                },
                'blacklist':     { fn: window.APP.showBlacklist,      name: 'Daftar Hitam' }
            };
            
            var back = backMap[prev.page];
            if (back) {
                if (back.isCore) {
                    back.fn.call(self);
                } else if (back.param) {
                    ModuleFallback.safeCall(back.name, back.fn, [back.param], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                } else {
                    ModuleFallback.safeCall(back.name, back.fn, [], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                }
                return;
            }
            
            switch(prev.page) {
                case 'paymentHistory':
                    var fnPH = window.APP.showCashFlowPage || window.APP.showPaymentHistory;
                    ModuleFallback.safeCall('Arus Kas', fnPH, [], null).then(function(r) {
                        if (r === null) self.renderDashboard();
                    });
                    break;
                case 'payment':
                    if (prev.orderId) {
                        ModuleFallback.safeCall('Pembayaran', window.APP.showPayment, [prev.orderId], null).then(function(r) {
                            if (r === null) self.renderDashboard();
                        });
                    } else self.renderDashboard();
                    break;
                case 'customerOrders':
                    if (prev.customerId && typeof window.APP.showCustomerOrders === 'function') {
                        ModuleFallback.safeCall('Order Nasabah', window.APP.showCustomerOrders, [prev.customerId], null).then(function(r) {
                            if (r === null) self.renderDashboard();
                        });
                    } else self.renderDashboard();
                    break;
                case 'customerPaymentHistory':
                    if (prev.customerId && typeof window.APP.showCustomerPaymentHistory === 'function') {
                        ModuleFallback.safeCall('Riwayat Nasabah', window.APP.showCustomerPaymentHistory, [prev.customerId], null).then(function(r) {
                            if (r === null) self.renderDashboard();
                        });
                    } else self.renderDashboard();
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
        this._clearOverdueUpdateInterval();
        
        var confirmMsg = Utils.t('save_exit_confirm');
        var confirmed = window.Toast ? await window.Toast.confirmPromise(confirmMsg) : confirm(confirmMsg);
        if (!confirmed) return;
        
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

    // ==================== 仪表盘 ====================
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
            
            const cacheKey = DashboardCache.getKey('dashboard_stats', isAdmin ? 'admin' : storeId);
            const report = await DashboardCache.get(cacheKey, 
                () => DashboardStatsHelper.getDashboardStats(profile)
            );
            
            const cashFlowCacheKey = DashboardCache.getKey('cashflow', isAdmin ? 'admin' : storeId);
            const cashFlow = await DashboardCache.get(cashFlowCacheKey,
                async () => {
                    const allCashFlows = await SUPABASE.getCashFlowRecords();
                    return this._calculateCashFlowSummary(allCashFlows, isAdmin, storeId);
                }
            );
            
            const expensesCacheKey = DashboardCache.getKey('expenses', isAdmin ? 'admin' : storeId);
            const totalExpenses = await DashboardCache.get(expensesCacheKey, async () => {
                let query = supabaseClient.from('expenses').select('amount');
                if (!isAdmin && storeId) query = query.eq('store_id', storeId);
                const { data } = await query;
                let sum = 0;
                for (const ex of (data || [])) sum += (ex.amount || 0);
                return sum;
            });
            
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
            
            const overdueOrdersCount = report.overdue_orders || 0;
            const activeDisplay = report.active_orders + (overdueOrdersCount > 0 ? ' / ⚠️ ' + overdueOrdersCount : '');
            
            const flowsForDeficit = await DashboardCache.get(DashboardCache.getKey('flows_for_deficit', isAdmin ? 'admin' : storeId), async () => {
                let q = supabaseClient.from('cash_flow_records').select('direction, amount, flow_type').eq('is_voided', false);
                if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                const { data } = await q;
                return data || [];
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
            
            const cards = [
                { label: (lang === 'id' ? 'Bulan ini' : '本月新增') + '/' + t('total_orders'), value: thisMonthOrderCount + '/' + report.total_orders, class: '' },
                { label: lang === 'id' ? 'Berjalan / Jatuh Tempo' : '进行中 / 逾期单', value: activeDisplay, class: '' },
                { label: (lang === 'id' ? 'Lunas' : '已结清'), value: report.completed_orders, class: '' },
                { label: lang === 'id' ? 'Defisit (Keluar - Masuk)' : '赤字 (流出-流入)', value: Utils.formatCurrency(deficit), class: deficit >= 0 ? 'expense' : 'income' },
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
            
            var toolbarHtml = '';
            if (isAdmin) {
                toolbarHtml = '' +
                '<div class="toolbar admin-grid no-print">' +
                    '<button onclick="APP.navigateTo(\'customers\')">👥 ' + t('customers') + '</button>' +
                    '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
                    '<button onclick="APP.showCashFlowPage()">💰 ' + t('payment_history') + '</button>' +
                    '<button onclick="APP.navigateTo(\'expenses\')">📝 ' + t('expenses') + '</button>' +
                    '<button onclick="APP.navigateTo(\'backupRestore\')">📦 ' + t('backup_restore') + '</button>' +
                    '<button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ' + (btnHighlight ? 'highlight' : '') + '" ' + (btnDisabled ? 'disabled' : '') + '>🔔 ' + t('send_reminder') + ' ' + (hasReminders ? '(' + needRemindOrders.length + ')' : '') + '</button>' +
                    '<button onclick="APP.navigateTo(\'anomaly\')">⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</button>' +
                    '<button onclick="APP.navigateTo(\'userManagement\')">👤 ' + t('user_management') + '</button>' +
                    '<button onclick="APP.navigateTo(\'storeManagement\')">🏪 ' + t('store_management') + '</button>' +
                    '<button onclick="APP.logout()">💾 ' + t('save_exit') + '</button>' +
                '</div>';
            } else {
                toolbarHtml = '' +
                '<div class="toolbar store-grid no-print">' +
                    '<button onclick="APP.navigateTo(\'customers\')">👥 ' + t('customers') + '</button>' +
                    '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
                    '<button onclick="APP.showCashFlowPage()">💰 ' + t('payment_history') + '</button>' +
                    '<button onclick="APP.navigateTo(\'expenses\')">📝 ' + t('expenses') + '</button>' +
                    '<button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ' + (btnHighlight ? 'highlight' : '') + '" ' + (btnDisabled ? 'disabled' : '') + '>🔔 ' + t('send_reminder') + ' ' + (hasReminders ? '(' + needRemindOrders.length + ')' : '') + '</button>' +
                    '<button onclick="APP.navigateTo(\'anomaly\')">⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</button>' +
                    '<button onclick="APP.navigateTo(\'backupRestore\')">📦 ' + t('backup_restore') + '</button>' +
                    '<button onclick="APP.logout()">💾 ' + t('save_exit') + '</button>' +
                '</div>';
            }
            
            var userRoleText = AUTH.user?.role === 'admin' 
                ? (lang === 'id' ? 'Administrator' : '管理员') 
                : (lang === 'id' ? 'Manajer Toko' : '店长');
            var storeName = AUTH.getCurrentStoreName();
            
            var bottomHtml = '';
            if (isAdmin) {
                bottomHtml = '' +
                '<div class="card dashboard-footer-card">' +
                    '<p><strong>🏪 ' + (lang === 'id' ? 'Pengguna saat ini' : '当前用户') + ':</strong> ' + Utils.escapeHtml(AUTH.user?.name || '') + ' (' + userRoleText + ')</p>' +
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
                '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                    '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
                        backButtonHtml +
                        '<img src="icons/pagehead-logo.png" alt="JF!" style="height:32px;">' +
                        '<h1 style="margin:0;">JF! by Gadai</h1>' +
                    '</div>' +
                    '<div class="header-actions">' +
                        (this.currentPage !== 'dashboard' ? 
                            '<button onclick="APP.navigateTo(\'dashboard\')" class="btn-back" style="background:var(--primary);color:white;">🏠 ' + (lang === 'id' ? 'Beranda' : '首页') + '</button>' : 
                            '') +
                        '<button onclick="APP.toggleLanguage()" class="lang-btn" style="margin-left:8px;">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
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
            if (window.Toast) window.Toast.error('加载仪表盘失败: ' + err.message, 5000);
            document.getElementById("app").innerHTML = '' +
                '<div class="card" style="padding:40px;text-align:center;">' +
                    '<p style="margin-bottom:16px;">⚠️ ' + (Utils.lang === 'id' ? '加载仪表盘失败: ' + err.message : 'Dashboard load failed: ' + err.message) + '</p>' +
                    '<button onclick="APP.logout()">💾 ' + Utils.t('save_exit') + '</button>' +
                    '<button onclick="location.reload()" style="margin-left:8px;">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新页面') + '</button>' +
                '</div>';
        }
    },

    _calculateCashFlowSummary: function(allFlows, isAdmin, storeId) {
        var cashInflow = 0, cashOutflow = 0;
        var bankInflow = 0, bankOutflow = 0;
        
        var flowsToUse = allFlows || [];
        
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
        if (window.Toast) {
            window.Toast.info(Utils.lang === 'id' ? '请先选择客户' : 'Please select a customer first', 3000);
        } else {
            alert(Utils.lang === 'id' ? 'Silakan pilih nasabah terlebih dahulu' : '请先选择客户');
        }
        this.navigateTo('customers'); 
    },
    
    showBlacklist: async function() {
        await ModuleFallback.safeCall('Daftar Hitam', window.APP.showBlacklist, [], null);
    },

    addStore: async function() {
        var lang = Utils.lang;
        var name = document.getElementById("newStoreName")?.value.trim();
        var address = document.getElementById("newStoreAddress")?.value.trim();
        var phone = document.getElementById("newStorePhone")?.value.trim();
        
        if (!name) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            } else {
                alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            }
            return;
        }
        
        try {
            if (typeof StoreManager !== 'undefined') {
                await StoreManager.createStore(name, address, phone);
                if (window.Toast) {
                    window.Toast.success(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
                } else {
                    alert(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
                }
                await StoreManager.renderStoreManagement();
            }
        } catch (error) {
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message);
            }
        }
    },
    
    editStore: async function(storeId) { 
        if (typeof StoreManager !== 'undefined') await StoreManager.editStore(storeId); 
    },
    
    deleteStore: async function(storeId) {
        var lang = Utils.lang;
        var confirmed = window.Toast ? await window.Toast.confirmPromise(Utils.t('confirm_delete')) : confirm(Utils.t('confirm_delete'));
        if (!confirmed) return;
        try {
            if (typeof StoreManager !== 'undefined') {
                await StoreManager.deleteStore(storeId);
                if (window.Toast) {
                    window.Toast.success(lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
                } else {
                    alert(lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
                }
                await StoreManager.renderStoreManagement();
            }
        } catch (error) {
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
            }
        }
    },
    
    invalidateDashboardCache: function() {
        DashboardCache.invalidate();
    }
};

// 挂载方法到 window.APP
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
window.APP.invalidateDashboardCache = DashboardCore.invalidateDashboardCache.bind(DashboardCore);
