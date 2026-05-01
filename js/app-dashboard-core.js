// app-dashboard-core.js - v1.4 (精简修复版)
// 修复核心：ModuleFallback.safeCall 失败时自动恢复仪表盘，绝不返回 null

window.APP = window.APP || {};

// ========== 逾期更新定时器 ==========
let _overdueUpdateInterval = null;

// ==================== 模块降级通知（核心修复） ====================
const ModuleFallback = {
    _degradedModules: {},
    
    async safeCall(moduleName, fn, args, fallbackFn) {
        try {
            if (typeof fn !== 'function') {
                throw new Error('module_not_loaded');
            }
            return await fn.apply(null, args || []);
        } catch (error) {
            const lang = Utils.lang;
            const moduleKey = moduleName + '_' + (error.message || 'unknown');
            
            // 避免重复提示
            if (!this._degradedModules[moduleKey]) {
                this._degradedModules[moduleKey] = true;
                
                const msg = lang === 'id'
                    ? `⚠️ 模块 "${moduleName}" 加载失败: ${error.message}，已返回仪表盘。`
                    : `⚠️ Module "${moduleName}" failed: ${error.message}, returned to dashboard.`;
                
                if (window.Toast) {
                    window.Toast.warning(msg, 5000);
                }
                this._showBanner(moduleName, error.message);
            }
            
            // ========== 核心修复：绝不返回 null，而是恢复页面 ==========
            
            // 1. 如果有 fallbackFn，执行它
            if (typeof fallbackFn === 'function') {
                return await fallbackFn();
            }
            
            // 2. 尝试恢复仪表盘
            if (window.DashboardCore && typeof window.DashboardCore.renderDashboard === 'function') {
                await window.DashboardCore.renderDashboard();
                return true;
            }
            
            // 3. 最后手段：刷新页面
            console.error('[ModuleFallback] 无法恢复，刷新页面');
            location.reload();
            return null;
        }
    },
    
    _showBanner(moduleName, errorMsg) {
        // 移除旧 banner 避免重复
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
        banner.innerHTML = '' +
            '<span class="info-bar-icon">⚠️</span>' +
            '<div class="info-bar-content">' +
                '<strong>' + (lang === 'id' ? '功能降级通知' : 'Feature Degraded') + '</strong> — ' +
                (lang === 'id' 
                    ? '模块 "' + moduleName + '" 加载失败，已返回仪表盘。'
                    : 'Module "' + moduleName + '" failed, returned to dashboard.') +
            '</div>' +
            '<button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 8px;">✖</button>';
        
        const app = document.getElementById('app');
        if (app && app.firstChild) {
            app.insertBefore(banner, app.firstChild);
        }
    },
    
    clearAll() {
        this._degradedModules = {};
        const banner = document.getElementById('moduleFallbackBanner');
        if (banner) banner.remove();
    }
};

window.ModuleFallback = ModuleFallback;

// ==================== 缓存别名 ====================
const DashboardCache = JFCache;

// ==================== 聚合查询辅助方法 ====================
const DashboardStatsHelper = {
    async getDashboardStats(profile) {
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        const client = SUPABASE.getClient();
        
        const practiceIds = isAdmin ? await SUPABASE._getPracticeStoreIds() : [];
        const applyPracticeFilter = function(q) {
            if (isAdmin && practiceIds.length > 0) {
                q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
            return q;
        };
        
        const totalCountPromise = (() => {
            let q = client.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            else q = applyPracticeFilter(q);
            return q;
        })();
        
        const activeCountPromise = (() => {
            let q = client.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            else q = applyPracticeFilter(q);
            q = q.eq('status', 'active');
            return q;
        })();
        
        const completedCountPromise = (() => {
            let q = client.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            else q = applyPracticeFilter(q);
            q = q.eq('status', 'completed');
            return q;
        })();
        
        const overdueCountPromise = (() => {
            let q = client.from('orders').select('*', { count: 'exact', head: true });
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            else q = applyPracticeFilter(q);
            q = q.eq('status', 'active').gte('overdue_days', 1);
            return q;
        })();
        
        const activeOrdersPromise = (() => {
            let q = client.from('orders').select('admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid, loan_amount');
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            else q = applyPracticeFilter(q);
            q = q.eq('status', 'active');
            return q;
        })();
        
        const allOrdersLoanPromise = (() => {
            let q = client.from('orders').select('loan_amount');
            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
            else q = applyPracticeFilter(q);
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
        
        const client = SUPABASE.getClient();
        
        let overdueQuery = client.from('orders').select('*', { count: 'exact', head: true });
        if (!isAdmin && storeId) overdueQuery = overdueQuery.eq('store_id', storeId);
        overdueQuery = overdueQuery.eq('status', 'active').gte('overdue_days', 30);
        
        let blacklistQuery = client.from('blacklist').select('*', { count: 'exact', head: true });
        
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
        
        const client = SUPABASE.getClient();
        
        const { data: monthlyOrders, error } = await client
            .from('orders')
            .select('id, store_id, loan_amount, status, created_at, overdue_days')
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd);
        
        if (error) throw error;
        
        const { data: monthlyFlows } = await client
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
        
        const totalCount = eligibleStores.length;
        
        if (totalCount === 1) return { top3: eligibleStores.slice(0, 1), bottom3: [] };
        if (totalCount === 2) return { top3: eligibleStores.slice(0, 2), bottom3: [] };
        if (totalCount === 3) return { top3: eligibleStores.slice(0, 3), bottom3: eligibleStores.slice(-1).reverse() };
        
        return {
            top3: eligibleStores.slice(0, Math.min(3, eligibleStores.length)),
            bottom3: eligibleStores.slice(-Math.min(3, eligibleStores.length)).reverse()
        };
    }
};

// ==================== DashboardCore 主模块 ====================
const DashboardCore = {
    currentFilter: "all",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    saveCurrentPageState: function() {
        try {
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
        } catch(e) {}
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

    _clearOverdueUpdateInterval: function() {
        if (_overdueUpdateInterval) {
            clearInterval(_overdueUpdateInterval);
            _overdueUpdateInterval = null;
        }
    },

    _startOverdueUpdateInterval: function() {
        this._clearOverdueUpdateInterval();
        if (!AUTH.isLoggedIn()) return;
        
        _overdueUpdateInterval = setInterval(async () => {
            try {
                await SUPABASE.updateOverdueDays();
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
                if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') {
                    await this.refreshCurrentPage();
                }
            } catch (err) {}
        }, 5000);
    },

    _ensureModuleLoaded: function(moduleName, moduleFn) {
        return typeof moduleFn === 'function';
    },

    // 检查今天是否已发送过提醒
    hasSentRemindersToday: async function() {
        try {
            if (SUPABASE && typeof SUPABASE.hasSentRemindersToday === 'function') {
                return await SUPABASE.hasSentRemindersToday();
            }
            const today = Utils.getLocalToday();
            const client = SUPABASE.getClient();
            const { data, error } = await client
                .from('reminder_logs')
                .select('id', { count: 'exact' })
                .eq('reminder_date', today);
            if (error) return false;
            return (data?.length || 0) > 0;
        } catch (e) {
            return false;
        }
    },

    // 发送每日提醒
    sendDailyReminders: async function() {
        var lang = Utils.lang;
        
        var reminderBtn = document.getElementById('reminderBtn');
        if (reminderBtn && reminderBtn.disabled) {
            Utils.toast.warning(lang === 'id' ? 'Pengingat sudah dikirim hari ini' : '今日提醒已发送过');
            return;
        }
        
        try {
            const needRemindOrders = await SUPABASE.getOrdersNeedReminder();
            
            if (needRemindOrders.length === 0) {
                Utils.toast.info(lang === 'id' ? 'Tidak ada pesanan yang perlu diingatkan hari ini' : '今日没有需要提醒的订单');
                return;
            }
            
            var confirmed = await Utils.toast.confirm(
                lang === 'id' 
                    ? 'Kirim pengingat WhatsApp ke ' + needRemindOrders.length + ' nasabah yang akan jatuh tempo dalam 2 hari?'
                    : '向 ' + needRemindOrders.length + ' 位将在2天内到期的客户发送 WhatsApp 提醒？'
            );
            
            if (!confirmed) return;
            
            var successCount = 0;
            var failCount = 0;
            
            for (var i = 0; i < needRemindOrders.length; i++) {
                var order = needRemindOrders[i];
                try {
                    var storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                    if (!storeWA) {
                        failCount++;
                        continue;
                    }
                    
                    var customerPhone = order.customer_phone;
                    if (!customerPhone) {
                        failCount++;
                        continue;
                    }
                    
                    var cleanPhone = customerPhone.replace(/[^0-9]/g, '');
                    if (!cleanPhone.startsWith('62') && !cleanPhone.startsWith('0')) {
                        cleanPhone = '62' + cleanPhone;
                    }
                    if (cleanPhone.startsWith('0')) {
                        cleanPhone = '62' + cleanPhone.substring(1);
                    }
                    
                    var waMessage = window.APP.generateWAText(order, storeWA);
                    var encodedMessage = encodeURIComponent(waMessage);
                    var waUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodedMessage;
                    
                    window.open(waUrl, '_blank');
                    await SUPABASE.logReminder(order.id);
                    successCount++;
                    await new Promise(r => setTimeout(r, 500));
                } catch (err) {
                    console.error('发送提醒失败:', order.order_id, err);
                    failCount++;
                }
            }
            
            Utils.toast.success(
                lang === 'id'
                    ? '✅ Pengingat terkirim: ' + successCount + ' berhasil, ' + failCount + ' gagal'
                    : '✅ 提醒发送完成：成功 ' + successCount + ' 条，失败 ' + failCount + ' 条',
                5000
            );
            
            await this.refreshCurrentPage();
        } catch (error) {
            console.error('sendDailyReminders error:', error);
            Utils.toast.error(lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
        }
    },

    init: async function() {
        var lang = Utils.lang || 'zh';
        
        if (window.Toast && !window.Toast._initialized) {
            window.Toast._initialized = true;
        }
        
        Utils.ErrorHandler.init();
        ModuleFallback.clearAll();
        
        document.getElementById("app").innerHTML = '' +
            '<div class="loading-container">' +
                '<div class="loader"></div>' +
                '<p class="loading-text">' + (lang === 'id' ? '🔄 Memuat sistem...' : '🔄 Loading system...') + '</p>' +
            '</div>';
        
        try {
            await AUTH.init();
            
            var savedState = null;
            if (window._RESTORED_STATE && window._RESTORED_STATE.page) {
                savedState = window._RESTORED_STATE;
                delete window._RESTORED_STATE;
            } else {
                savedState = this.restorePageState();
            }
            
            var savedPage = savedState.page;
            var savedFilter = savedState.filter;
            var savedOrderId = savedState.orderId;
            var savedCustomerId = savedState.customerId;
            
            const isLoggedIn = AUTH.isLoggedIn();
            
            if (savedPage && savedPage !== 'login' && isLoggedIn) {
                this.currentPage = savedPage;
                this.currentFilter = savedFilter || "all";
                this.currentOrderId = savedOrderId || null;
                this.currentCustomerId = savedCustomerId || null;
                await this.refreshCurrentPage();
            } else if (isLoggedIn) {
                await this.renderDashboard();
            } else {
                await this.router();
            }
            
            if (AUTH.isLoggedIn()) {
                this._startOverdueUpdateInterval();
            }
        } catch (error) {
            console.error("Init error:", error);
            Utils.toast.error(lang === 'id' ? '系统加载失败，请刷新页面' : 'System load failed, please refresh', 5000);
            document.getElementById("app").innerHTML = '' +
                '<div class="card" style="text-align:center;padding:40px;">' +
                    '<p>' + (lang === 'id' ? '系统加载失败，请刷新页面' : 'System load failed, please refresh') + '</p>' +
                    '<button onclick="location.reload()" style="margin-top:12px;">🔄 ' + (lang === 'id' ? '刷新页面' : 'Refresh') + '</button>' +
                '</div>';
        }
    },

    router: async function() {
        if (!AUTH.isLoggedIn()) {
            await this.renderLogin();
            return;
        }
        await this.refreshCurrentPage();
    },

    refreshCurrentPage: async function() {
        var self = this;
        
        // 显示骨架屏
        var skeletonType = 'default';
        if (this.currentPage === 'dashboard') skeletonType = 'dashboard';
        else if (this.currentPage === 'orderTable' || this.currentPage === 'customers' || 
                 this.currentPage === 'paymentHistory' || this.currentPage === 'expenses') skeletonType = 'table';
        else if (this.currentPage === 'viewOrder' || this.currentPage === 'payment') skeletonType = 'detail';
        
        document.getElementById("app").innerHTML = Utils.renderSkeleton(skeletonType);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 页面处理器映射
        const handlers = {
            dashboard: async () => {
                try {
                    await self.renderDashboard();
                } catch (e) {
                    console.error("renderDashboard failed:", e);
                    Utils.toast.error('加载仪表盘失败', 4000);
                    document.getElementById("app").innerHTML = '' +
                        '<div class="card" style="text-align:center;padding:40px;">' +
                            '<p>⚠️ ' + (Utils.lang === 'id' ? '加载仪表盘失败' : 'Dashboard load failed') + '</p>' +
                            '<button onclick="APP.forceRecovery()" style="margin-top:12px;margin-right:8px;">🔄 ' + 
                                (Utils.lang === 'id' ? '强制恢复' : 'Force Recovery') + '</button>' +
                            '<button onclick="location.reload()">🔄 ' + (Utils.lang === 'id' ? '刷新页面' : 'Refresh') + '</button>' +
                        '</div>';
                }
            },
            orderTable: () => ModuleFallback.safeCall('Daftar Pesanan', window.APP.showOrderTable, [], () => self.renderDashboard()),
            createOrder: () => ModuleFallback.safeCall('Buat Pesanan', window.APP.showCreateOrder, [], () => self.renderDashboard()),
            viewOrder: async () => {
                if (self.currentOrderId && self._ensureModuleLoaded('viewOrder', window.APP.viewOrder)) {
                    return await ModuleFallback.safeCall('Detail Pesanan', window.APP.viewOrder, [self.currentOrderId], () => self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            payment: async () => {
                if (self.currentOrderId && self._ensureModuleLoaded('showPayment', window.APP.showPayment)) {
                    return await ModuleFallback.safeCall('Pembayaran', window.APP.showPayment, [self.currentOrderId], () => self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            anomaly: () => ModuleFallback.safeCall('Situasi Abnormal', window.APP.showAnomaly, [], () => self.renderDashboard()),
            userManagement: () => ModuleFallback.safeCall('Manajemen Peran', window.APP.showUserManagement, [], () => self.renderDashboard()),
            storeManagement: () => {
                if (typeof StoreManager !== 'undefined' && typeof StoreManager.renderStoreManagement === 'function') {
                    return ModuleFallback.safeCall('Manajemen Toko', StoreManager.renderStoreManagement, [], () => self.renderDashboard());
                }
                return self.renderDashboard();
            },
            expenses: () => ModuleFallback.safeCall('Pengeluaran', window.APP.showExpenses, [], () => self.renderDashboard()),
            customers: () => ModuleFallback.safeCall('Nasabah', window.APP.showCustomers, [], () => self.renderDashboard()),
            paymentHistory: async () => {
                const fn = window.APP.showCashFlowPage || window.APP.showPaymentHistory;
                return await ModuleFallback.safeCall('Arus Kas', fn, [], () => self.renderDashboard());
            },
            backupRestore: () => {
                if (typeof BackupStorage !== 'undefined' && typeof BackupStorage.renderBackupUI === 'function') {
                    return ModuleFallback.safeCall('Cadangan', BackupStorage.renderBackupUI, [], () => self.renderDashboard());
                }
                return self.renderDashboard();
            },
            customerOrders: async () => {
                if (self.currentCustomerId && self._ensureModuleLoaded('showCustomerOrders', window.APP.showCustomerOrders)) {
                    return await ModuleFallback.safeCall('Order Nasabah', window.APP.showCustomerOrders, [self.currentCustomerId], () => self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            customerPaymentHistory: async () => {
                if (self.currentCustomerId && self._ensureModuleLoaded('showCustomerPaymentHistory', window.APP.showCustomerPaymentHistory)) {
                    return await ModuleFallback.safeCall('Riwayat Nasabah', window.APP.showCustomerPaymentHistory, [self.currentCustomerId], () => self.renderDashboard());
                }
                return await self.renderDashboard();
            },
            blacklist: () => ModuleFallback.safeCall('Daftar Hitam', window.APP.showBlacklist, [], () => self.renderDashboard())
        };
        
        const handler = handlers[this.currentPage];
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
        
        this.saveCurrentPageState();
        
        var self = this;
        
        // 直接刷新当前页面
        this.refreshCurrentPage();
    },

    goBack: function() {
        if (this.historyStack.length > 0) {
            var prev = this.historyStack.pop();
            this.currentPage = prev.page;
            this.currentOrderId = prev.orderId;
            this.currentCustomerId = prev.customerId;
            this.currentFilter = prev.filter || "all";
            this.saveCurrentPageState();
            this.refreshCurrentPage();
        } else {
            this.renderDashboard();
        }
    },

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
                        '<span onclick="Utils.togglePasswordVisibility(\'password\', this)" style="position:absolute;right:12px;top:38px;cursor:pointer;font-size:18px;">👁️</span>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">' +
                        '<input type="checkbox" id="rememberMe" style="width:16px;height:16px;cursor:pointer;">' +
                        '<label for="rememberMe" style="cursor:pointer;">' + (lang === 'id' ? 'Ingat saya' : '记住我') + '</label>' +
                    '</div>' +
                    '<button onclick="APP.login()" id="loginBtn">' + t('login') + '</button>' +
                    '<p class="login-note">ℹ️ ' + (lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号') + '</p>' +
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

    logout: async function() {
        this._clearOverdueUpdateInterval();
        var confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
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

    // ==================== 仪表盘渲染 ====================
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
            
            const cacheKey = 'dashboard_stats_' + (isAdmin ? 'admin' : storeId);
            const report = await DashboardCache.get(cacheKey, 
                () => DashboardStatsHelper.getDashboardStats(profile),
                { ttl: 5 * 60 * 1000 }
            );
            
            const cashFlowCacheKey = 'cashflow_v2_' + (isAdmin ? 'admin' : storeId);
            const cashFlow = await DashboardCache.get(cashFlowCacheKey,
                async () => await SUPABASE.getCashFlowSummary(),
                { ttl: 5 * 60 * 1000 }
            );
            
            const expensesCacheKey = 'expenses_' + (isAdmin ? 'admin' : storeId);
            const totalExpenses = await DashboardCache.get(expensesCacheKey, async () => {
                const client = SUPABASE.getClient();
                let query = client.from('expenses').select('amount');
                if (!isAdmin && storeId) query = query.eq('store_id', storeId);
                const { data } = await query;
                let sum = 0;
                for (const ex of (data || [])) sum += (ex.amount || 0);
                return sum;
            }, { ttl: 5 * 60 * 1000 });
            
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
            
            const monthOrdersCacheKey = 'month_orders_' + (isAdmin ? 'admin' : storeId) + '_' + currentYear + '_' + currentMonth;
            let thisMonthOrderCount = await DashboardCache.get(monthOrdersCacheKey, async () => {
                const client = SUPABASE.getClient();
                let query = client.from('orders').select('created_at', { count: 'exact', head: true });
                if (!isAdmin && storeId) query = query.eq('store_id', storeId);
                query = query.gte('created_at', monthStart);
                const { count } = await query;
                return count || 0;
            }, { ttl: 10 * 60 * 1000 });
            
            const needRemindOrders = await SUPABASE.getOrdersNeedReminder();
            const hasReminders = needRemindOrders.length > 0;
            
            let hasSentToday = false;
            try {
                hasSentToday = await this.hasSentRemindersToday();
            } catch(e) {}
            
            const btnDisabled = hasSentToday;
            const btnHighlight = hasReminders && !hasSentToday;
            const overdueOrdersCount = report.overdue_orders || 0;
            const activeDisplay = report.active_orders + (overdueOrdersCount > 0 ? ' / ⚠️ ' + overdueOrdersCount : '');
            const netProfitBalance = cashFlow.netProfit?.balance || 0;
            const operatingIncome = cashFlow.netProfit?.operatingIncome || 0;
            const operatingExpense = cashFlow.netProfit?.operatingExpense || 0;
            
            const cards = [
                { label: t('this_month') + '/' + t('total_orders'), value: thisMonthOrderCount + '/' + report.total_orders, class: '' },
                { label: t('active') + ' / ' + t('overdue_days'), value: activeDisplay, class: '' },
                { label: t('completed'), value: report.completed_orders, class: '' },
                { label: t('net_profit'), value: Utils.formatCurrency(netProfitBalance), class: netProfitBalance >= 0 ? 'income' : 'expense' },
                { label: t('admin_fee'), value: Utils.formatCurrency(report.total_admin_fees), class: 'income' },
                { label: t('service_fee'), value: Utils.formatCurrency(report.total_service_fees || 0), class: 'income' },
                { label: t('interest'), value: Utils.formatCurrency(report.total_interest), class: 'income' },
                { label: t('total_expenses'), value: Utils.formatCurrency(totalExpenses), class: 'expense' }
            ];
            
            var cardsHtml = '';
            for (var i = 0; i < cards.length; i++) {
                var subtitleHtml = '';
                if (cards[i].label === t('net_profit') && (operatingIncome > 0 || operatingExpense > 0)) {
                    subtitleHtml = '<div class="stat-subtitle" style="font-size:10px;color:var(--text-muted);margin-top:2px;">' +
                        (lang === 'id' ? 'Pendapatan' : '收入') + ': ' + Utils.formatCurrency(operatingIncome) +
                        ' | ' + (lang === 'id' ? 'Biaya' : '支出') + ': ' + Utils.formatCurrency(operatingExpense) +
                        '</div>';
                }
                cardsHtml += '<div class="stat-card">' +
                    '<div class="stat-value ' + cards[i].class + '">' + cards[i].value + '</div>' +
                    '<div class="stat-label">' + cards[i].label + '</div>' +
                    subtitleHtml +
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
                                '<button onclick="APP.showTransferModal(\'cash_to_bank\')" class="transfer-btn cash-to-bank">' + t('cash_to_bank') + '</button>' +
                                '<button onclick="APP.showTransferModal(\'bank_to_cash\')" class="transfer-btn bank-to-cash">' + t('bank_to_cash') + '</button>' +
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
                                '<button onclick="APP.showTransferModal(\'cash_to_bank\')" class="transfer-btn cash-to-bank">' + t('cash_to_bank') + '</button>' +
                                '<button onclick="APP.showTransferModal(\'bank_to_cash\')" class="transfer-btn bank-to-cash">' + t('bank_to_cash') + '</button>' +
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
                    '<button onclick="APP.navigateTo(\'anomaly\')">⚠️ ' + t('anomaly_title') + '</button>' +
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
                    '<button onclick="APP.navigateTo(\'anomaly\')">⚠️ ' + t('anomaly_title') + '</button>' +
                    '<button onclick="APP.navigateTo(\'backupRestore\')">📦 ' + t('backup_restore') + '</button>' +
                    '<button onclick="APP.logout()">💾 ' + t('save_exit') + '</button>' +
                '</div>';
            }
            
            var userRoleText = AUTH.user?.role === 'admin' 
                ? (lang === 'id' ? 'Administrator' : '管理员') 
                : (lang === 'id' ? 'Manajer Toko' : '店长');
            var storeNameDisplay = AUTH.getCurrentStoreName();
            
            var bottomHtml = '';
            if (isAdmin) {
                bottomHtml = '' +
                '<div class="card dashboard-footer-card">' +
                    '<p><strong>🏪 ' + (lang === 'id' ? 'Pengguna saat ini' : '当前用户') + ':</strong> ' + Utils.escapeHtml(AUTH.user?.name || '') + ' (' + userRoleText + ')</p>' +
                    '<p>📍 ' + (lang === 'id' ? 'Toko' : '门店') + ': ' + t('headquarters') + '</p>' +
                    '<p>📌 ' + t('more_pawn_higher_fee') + '</p>' +
                    '<p>🔒 ' + t('order_saved_locked') + '</p>' +
                '</div>';
            } else {
                bottomHtml = '' +
                '<div class="card dashboard-footer-card">' +
                    '<p><strong>🏪 ' + (lang === 'id' ? 'Pengguna saat ini' : '当前用户') + ':</strong> ' + Utils.escapeHtml(storeNameDisplay) + ' (' + userRoleText + ')</p>' +
                    '<p>📍 ' + (lang === 'id' ? 'Toko' : '门店') + ': ' + Utils.escapeHtml(storeNameDisplay) + '</p>' +
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
            Utils.toast.error('加载仪表盘失败: ' + err.message, 5000);
            document.getElementById("app").innerHTML = '' +
                '<div class="card" style="padding:40px;text-align:center;">' +
                    '<p>⚠️ ' + (Utils.lang === 'id' ? '加载仪表盘失败: ' + err.message : 'Dashboard load failed: ' + err.message) + '</p>' +
                    '<button onclick="APP.forceRecovery()" style="margin-top:12px;margin-right:8px;">🔄 ' + (Utils.lang === 'id' ? '强制恢复' : 'Force Recovery') + '</button>' +
                    '<button onclick="location.reload()" style="margin-left:8px;">🔄 ' + (Utils.lang === 'id' ? '刷新页面' : 'Refresh') + '</button>' +
                '</div>';
        }
    },

    showCreateOrder: function() { 
        Utils.toast.info(Utils.lang === 'id' ? '请先选择客户' : 'Please select a customer first', 3000);
        this.navigateTo('customers'); 
    },
    
    showBlacklist: async function() {
        if (window.APP.showBlacklist && typeof window.APP.showBlacklist === 'function') {
            await ModuleFallback.safeCall('Daftar Hitam', window.APP.showBlacklist, [], null);
        } else {
            Utils.toast.warning(Utils.lang === 'id' ? '黑名单模块加载中，请稍后重试' : 'Blacklist module loading, please try again later');
            this.renderDashboard();
        }
    },

    addStore: async function() {
        var lang = Utils.lang;
        var name = document.getElementById("newStoreName")?.value.trim();
        var address = document.getElementById("newStoreAddress")?.value.trim();
        var phone = document.getElementById("newStorePhone")?.value.trim();
        
        if (!name) {
            Utils.toast.warning(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        
        try {
            if (typeof StoreManager !== 'undefined') {
                await StoreManager.createStore(name, address, phone);
                Utils.toast.success(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
                await StoreManager.renderStoreManagement();
            }
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message);
        }
    },
    
    editStore: async function(storeId) { 
        if (typeof StoreManager !== 'undefined') await StoreManager.editStore(storeId); 
    },
    
    deleteStore: async function(storeId) {
        var lang = Utils.lang;
        var confirmed = await Utils.toast.confirm(Utils.t('confirm_delete'));
        if (!confirmed) return;
        try {
            if (typeof StoreManager !== 'undefined') {
                await StoreManager.deleteStore(storeId);
                Utils.toast.success(lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
                await StoreManager.renderStoreManagement();
            }
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
        }
    },
    
    invalidateDashboardCache: function() {
        JFCache.clear();
        Utils.toast.info(Utils.lang === 'id' ? '缓存已清除' : 'Cache cleared', 2000);
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
window.APP.sendDailyReminders = DashboardCore.sendDailyReminders.bind(DashboardCore);
window.APP.hasSentRemindersToday = DashboardCore.hasSentRemindersToday.bind(DashboardCore);

window.addEventListener('beforeunload', function() {
    if (window.APP && typeof window.APP.saveCurrentPageState === 'function') {
        window.APP.saveCurrentPageState();
    }
});
