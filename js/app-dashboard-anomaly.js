// app-dashboard-anomaly.js - v1.0 

window.APP = window.APP || {};

// ==================== 异常检测缓存模块（增强版：自动清理 + LRU） ====================
const AnomalyCache = {
    _data: new Map(),
    _ttl: 3 * 60 * 1000,  // 3分钟缓存
    _maxSize: 100,         // 最大缓存条目数
    _cleanupInterval: null,
    _accessOrder: [],      // LRU 访问顺序记录
    
    // 初始化定时清理
    _initCleanup: function() {
        if (this._cleanupInterval) return;
        this._cleanupInterval = setInterval(() => {
            this._cleanupExpired();
        }, 60 * 1000); // 每分钟清理一次
        console.log('[AnomalyCache] 缓存清理定时器已启动');
    },
    
    // 清理过期缓存
    _cleanupExpired: function() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of this._data) {
            if (now - value.time > this._ttl) {
                this._data.delete(key);
                cleanedCount++;
            }
        }
        
        // 清理访问顺序记录中已删除的条目
        this._accessOrder = this._accessOrder.filter(key => this._data.has(key));
        
        if (cleanedCount > 0) {
            console.log(`[AnomalyCache] 清理过期缓存: ${cleanedCount} 条，剩余: ${this._data.size} 条`);
        }
    },
    
    // LRU: 记录访问顺序
    _recordAccess: function(key) {
        const index = this._accessOrder.indexOf(key);
        if (index !== -1) {
            this._accessOrder.splice(index, 1);
        }
        this._accessOrder.push(key);
    },
    
    // 当超过最大容量时，删除最久未使用的条目
    _enforceMaxSize: function() {
        while (this._data.size > this._maxSize && this._accessOrder.length > 0) {
            const lruKey = this._accessOrder.shift();
            if (lruKey && this._data.has(lruKey)) {
                this._data.delete(lruKey);
                console.log(`[AnomalyCache] LRU淘汰: ${lruKey}`);
            }
        }
    },
    
    async get(key, fetcher) {
        this._initCleanup();
        
        const cached = this._data.get(key);
        if (cached && Date.now() - cached.time < this._ttl) {
            console.log('[AnomalyCache] Hit:', key);
            this._recordAccess(key);
            return cached.value;
        }
        
        if (cached) {
            this._data.delete(key);
        }
        
        console.log('[AnomalyCache] Miss:', key);
        const value = await fetcher();
        
        this._data.set(key, { value, time: Date.now() });
        this._recordAccess(key);
        this._enforceMaxSize();
        
        return value;
    },
    
    set(key, value, customTtl = null) {
        this._initCleanup();
        this._data.set(key, { 
            value, 
            time: Date.now(),
            ttl: customTtl || this._ttl
        });
        this._recordAccess(key);
        this._enforceMaxSize();
    },
    
    invalidate(key) {
        if (key) {
            this._data.delete(key);
            const index = this._accessOrder.indexOf(key);
            if (index !== -1) this._accessOrder.splice(index, 1);
            console.log('[AnomalyCache] Invalidated:', key);
        } else {
            this.clear();
        }
    },
    
    clear() {
        this._data.clear();
        this._accessOrder = [];
        console.log('[AnomalyCache] Cleared all');
    },
    
    getStats() {
        const now = Date.now();
        let activeCount = 0;
        for (const [key, value] of this._data) {
            if (now - value.time < this._ttl) activeCount++;
        }
        return {
            total: this._data.size,
            active: activeCount,
            expired: this._data.size - activeCount,
            maxSize: this._maxSize
        };
    },
    
    destroy() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
    }
};

// ==================== 异常检测辅助方法 ====================
const AnomalyHelper = {
    async getOverdueOrders(profile, page, pageSize) {
        if (page === undefined) page = 0;
        if (pageSize === undefined) pageSize = 50;
        
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        let query = supabaseClient
            .from('orders')
            .select('order_id, customer_name, overdue_days, loan_amount, status', { count: 'exact' })
            .eq('status', 'active')
            .gte('overdue_days', 30)
            .order('overdue_days', { ascending: false });
        
        if (!isAdmin && storeId) {
            query = query.eq('store_id', storeId);
        }
        
        const from = page * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
        
        const { data, error, count } = await query;
        
        if (error) {
            console.warn('获取逾期订单失败:', error);
            return { data: [], totalCount: 0 };
        }
        
        return { 
            data: data || [], 
            totalCount: count || 0 
        };
    },

    async getBlacklistCustomers(page, pageSize) {
        if (page === undefined) page = 0;
        if (pageSize === undefined) pageSize = 50;
        
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data, error, count } = await supabaseClient
            .from('blacklist')
            .select('*, customers!blacklist_customer_id_fkey(name, phone, customer_id)', { count: 'exact' })
            .order('blacklisted_at', { ascending: false })
            .range(from, to);
        
        if (error) {
            console.warn('获取黑名单失败:', error);
            return { data: [], totalCount: 0 };
        }
        
        return {
            data: data || [],
            totalCount: count || 0
        };
    },

    async getMonthlyStoreRanking(stores) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const monthEnd = today.toISOString().split('T')[0];
        
        const { data: monthlyOrders, error } = await supabaseClient
            .from('orders')
            .select('id, store_id, loan_amount, status, overdue_days')
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd);
        
        if (error) {
            console.warn('获取本月订单失败:', error);
            return { top3: [], bottom3: [] };
        }
        
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
        
        if (eligibleStores.length === 0) {
            return { top3: [], bottom3: [] };
        }
        
        for (const s of eligibleStores) {
            s.rankSum = 0;
        }
        
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
        
        const top3 = eligibleStores.slice(0, Math.min(3, eligibleStores.length));
        const bottom3 = eligibleStores.slice(-Math.min(3, eligibleStores.length)).reverse();
        
        return { top3, bottom3 };
    }
};

const DashboardAnomaly = {

    showAnomaly: async function() {
        APP.currentPage = 'anomaly';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            
            // 逾期30天订单（分页加载，初始50条）
            const overdueCacheKey = 'overdue_orders_' + (isAdmin ? 'admin' : storeId) + '_0';
            const overdueResult = await AnomalyCache.get(overdueCacheKey, 
                () => AnomalyHelper.getOverdueOrders(profile, 0, 50)
            );
            var overdueOrders = overdueResult.data;
            var overdueTotalCount = overdueResult.totalCount;
            
            // 黑名单客户（分页加载，初始50条）
            const blacklistCacheKey = 'blacklist_customers_0';
            const blacklistResult = await AnomalyCache.get(blacklistCacheKey,
                () => AnomalyHelper.getBlacklistCustomers(0, 50)
            );
            var blacklist = blacklistResult.data;
            var blacklistTotalCount = blacklistResult.totalCount;
            
            // 门店排名（仅总部需要）
            var top3 = [], bottom3 = [];
            if (isAdmin) {
                const stores = await SUPABASE.getAllStores();
                const rankingCacheKey = 'monthly_store_ranking';
                const rankingResult = await AnomalyCache.get(rankingCacheKey,
                    () => AnomalyHelper.getMonthlyStoreRanking(stores)
                );
                top3 = rankingResult.top3;
                bottom3 = rankingResult.bottom3;
            }
            
            // ========== 逾期30天订单渲染 ==========
            var overdueTableHtml = '';
            if (overdueOrders.length === 0) {
                overdueTableHtml = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">✅</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Semua pesanan dalam keadaan baik' : '所有订单状态良好') + '</div>' +
                    '</div>';
            } else {
                var overdueRows = '';
                for (var i = 0; i < overdueOrders.length; i++) {
                    var o = overdueOrders[i];
                    var customerName = o.customer_name || '-';
                    overdueRows += '<tr>' +
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td>' + Utils.escapeHtml(customerName) + '</td>' +
                        '<td class="text-center expense">' + (o.overdue_days || 0) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="text-center"><button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '</button></td>' +
                    '</tr>';
                }
                
                var loadMoreHtml = '';
                if (overdueTotalCount > overdueOrders.length) {
                    loadMoreHtml = '' +
                        '<tr id="overdueLoadMoreRow">' +
                            '<td colspan="5" style="text-align:center;padding:10px;">' +
                                '<button onclick="APP.loadMoreOverdueOrders()" class="btn-small primary" style="padding:8px 24px;">' +
                                    '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多') + 
                                    ' (' + (overdueTotalCount - overdueOrders.length) + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')' +
                                '</button>' +
                            '</td>' +
                        '</tr>';
                }
                
                overdueTableHtml = '' +
                    '<div class="table-container">' +
                        '<table class="data-table anomaly-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + (lang === 'id' ? 'ID Pesanan' : '订单号') + '</th>' +
                                    '<th class="col-name">' + (lang === 'id' ? 'Nama Nasabah' : '客户姓名') + '</th>' +
                                    '<th class="col-months text-center">' + (lang === 'id' ? 'Hari Terlambat' : '逾期天数') + '</th>' +
                                    '<th class="col-amount amount">' + (lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额') + '</th>' +
                                    '<th class="text-center" style="width:60px;">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + overdueRows + loadMoreHtml + '</tbody>' +
                        '</table>' +
                    '</div>';
            }
            
            // ========== 黑名单客户渲染 ==========
            var blacklistTableHtml = '';
            if (blacklist.length === 0) {
                blacklistTableHtml = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">👍</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Tidak ada nasabah di blacklist' : '暂无黑名单客户') + '</div>' +
                    '</div>';
            } else {
                var blacklistRows = '';
                for (var i = 0; i < blacklist.length; i++) {
                    var b = blacklist[i];
                    blacklistRows += '<tr>' +
                        '<td>' + Utils.escapeHtml(b.customers?.customer_id || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(b.customers?.name || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(b.customers?.phone || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(b.reason) + '</td>' +
                    '</tr>';
                }
                
                var blacklistLoadMoreHtml = '';
                if (blacklistTotalCount > blacklist.length) {
                    blacklistLoadMoreHtml = '' +
                        '<tr id="blacklistLoadMoreRow">' +
                            '<td colspan="4" style="text-align:center;padding:10px;">' +
                                '<button onclick="APP.loadMoreBlacklist()" class="btn-small primary" style="padding:8px 24px;">' +
                                    '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多') + 
                                    ' (' + (blacklistTotalCount - blacklist.length) + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')' +
                                '</button>' +
                            '</td>' +
                        '</tr>';
                }
                
                blacklistTableHtml = '' +
                    '<div class="table-container">' +
                        '<table class="data-table anomaly-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                                    '<th class="col-name">' + (lang === 'id' ? 'Nama' : '姓名') + '</th>' +
                                    '<th class="col-phone">' + (lang === 'id' ? 'Telepon' : '电话') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Alasan' : '原因') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + blacklistRows + blacklistLoadMoreHtml + '</tbody>' +
                        '</table>' +
                    '</div>';
            }
            
            // ========== 门店视图：2列布局 ==========
            if (!isAdmin) {
                document.getElementById("app").innerHTML = '' +
                    '<div class="page-header">' +
                        '<h2>⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</h2>' +
                        '<div class="header-actions">' +
                            '<button onclick="APP.goBack()" class="btn-back">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                            '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="anomaly-grid">' +
                        '<div class="anomaly-card anomaly-card-danger">' +
                            '<div class="anomaly-card-header">' +
                                '<span class="anomaly-icon">⚠️</span>' +
                                '<h3>' + (lang === 'id' ? 'Pesanan Terlambat 30+ Hari' : '逾期30天以上订单') + '</h3>' +
                                '<span class="anomaly-badge">' + overdueTotalCount + '</span>' +
                            '</div>' +
                            '<div class="anomaly-card-body">' + overdueTableHtml + '</div>' +
                            (overdueOrders.length > 0 ? 
                                '<div class="anomaly-card-footer">' +
                                    '<span class="warning-text">💡 ' + (lang === 'id' ? 'Pesanan ini akan memasuki proses likuidasi' : '这些订单即将进入变卖程序') + '</span>' +
                                '</div>' : '') +
                        '</div>' +
                        
                        '<div class="anomaly-card anomaly-card-warning">' +
                            '<div class="anomaly-card-header">' +
                                '<span class="anomaly-icon">🚫</span>' +
                                '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah (Semua Toko)' : '黑名单客户（全部门店）') + '</h3>' +
                                '<span class="anomaly-badge">' + blacklistTotalCount + '</span>' +
                            '</div>' +
                            '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                        '</div>' +
                    '</div>';
                
                window._anomalyOverdueState = {
                    page: 0,
                    pageSize: 50,
                    totalCount: overdueTotalCount,
                    profile: profile,
                    isAdmin: isAdmin,
                    storeId: storeId
                };
                window._anomalyBlacklistState = {
                    page: 0,
                    pageSize: 50,
                    totalCount: blacklistTotalCount
                };
                
                return;
            }
            
            // ========== 总部视图 ==========
            var top3Html = '';
            if (top3.length === 0) {
                top3Html = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko bulan ini' : '本月暂无门店数据') + '</div>' +
                    '</div>';
            } else {
                var top3Items = '';
                for (var i = 0; i < top3.length; i++) {
                    var s = top3[i];
                    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                    top3Items += '' +
                        '<div class="ranking-item ' + (i === 0 ? 'first' : '') + '">' +
                            '<div class="ranking-number">' + medal + '</div>' +
                            '<div class="ranking-info">' +
                                '<span class="ranking-name">' + Utils.escapeHtml(s.name) + '</span>' +
                                '<span class="ranking-code">' + Utils.escapeHtml(s.code) + '</span>' +
                            '</div>' +
                            '<div class="ranking-count" style="font-size:var(--font-xxs);text-align:right;line-height:1.6;">' +
                                (lang === 'id' ? '订单: ' : '订单: ') + s.orderCount + '<br>' +
                                (lang === 'id' ? '放款: ' : '放款: ') + Utils.formatCurrency(s.totalLoanOutflow) + '<br>' +
                                (lang === 'id' ? '不良: ' : '不良: ') + s.badOrders + '<br>' +
                                (lang === 'id' ? '回收: ' : '回收: ') + Utils.formatCurrency(s.totalRecovery) +
                            '</div>' +
                        '</div>';
                }
                top3Html = '<div class="ranking-list">' + top3Items + '</div>';
            }
            
            var bottom3Html = '';
            if (bottom3.length === 0) {
                bottom3Html = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko bulan ini' : '本月暂无门店数据') + '</div>' +
                    '</div>';
            } else {
                var bottom3Items = '';
                for (var i = 0; i < bottom3.length; i++) {
                    var s = bottom3[i];
                    var mark = i === 0 ? '🔴' : i === 1 ? '🟡' : '🟠';
                    bottom3Items += '' +
                        '<div class="ranking-item ' + (i === 0 ? 'last' : '') + '">' +
                            '<div class="ranking-number">' + mark + '</div>' +
                            '<div class="ranking-info">' +
                                '<span class="ranking-name">' + Utils.escapeHtml(s.name) + '</span>' +
                                '<span class="ranking-code">' + Utils.escapeHtml(s.code) + '</span>' +
                            '</div>' +
                            '<div class="ranking-count" style="font-size:var(--font-xxs);text-align:right;line-height:1.6;">' +
                                (lang === 'id' ? '订单: ' : '订单: ') + s.orderCount + '<br>' +
                                (lang === 'id' ? '放款: ' : '放款: ') + Utils.formatCurrency(s.totalLoanOutflow) + '<br>' +
                                (lang === 'id' ? '不良: ' : '不良: ') + s.badOrders + '<br>' +
                                (lang === 'id' ? '回收: ' : '回收: ') + Utils.formatCurrency(s.totalRecovery) +
                            '</div>' +
                        '</div>';
                }
                bottom3Html = '<div class="ranking-list">' + bottom3Items + '</div>';
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="anomaly-grid">' +
                    '<div class="anomaly-card anomaly-card-info">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🏆</span>' +
                            '<h3>' + (lang === 'id' ? 'Kinerja Terbaik Bulan Ini (3 Besar)' : '本月业绩前三排行') + '</h3>' +
                            '<span class="anomaly-badge">' + top3.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + top3Html + '</div>' +
                        '<div class="anomaly-card-footer">' +
                            '<span class="info-text">💡 ' + (lang === 'id' ? 'Peringkat berdasarkan data bulan ini' : '排名基于当月数据') + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="anomaly-card anomaly-card-info">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">📉</span>' +
                            '<h3>' + (lang === 'id' ? 'Kinerja Terendah Bulan Ini (3 Besar)' : '本月业绩后三排行') + '</h3>' +
                            '<span class="anomaly-badge">' + bottom3.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + bottom3Html + '</div>' +
                        '<div class="anomaly-card-footer">' +
                            '<span class="info-text">💡 ' + (lang === 'id' ? 'Peringkat berdasarkan data bulan ini' : '排名基于当月数据') + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="anomaly-card anomaly-card-danger">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">⚠️</span>' +
                            '<h3>' + (lang === 'id' ? 'Pesanan Terlambat 30+ Hari' : '逾期30天以上订单') + '</h3>' +
                            '<span class="anomaly-badge">' + overdueTotalCount + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + overdueTableHtml + '</div>' +
                        (overdueOrders.length > 0 ? 
                            '<div class="anomaly-card-footer">' +
                                '<span class="warning-text">💡 ' + (lang === 'id' ? 'Pesanan ini akan memasuki proses likuidasi' : '这些订单即将进入变卖程序') + '</span>' +
                            '</div>' : '') +
                    '</div>' +
                    
                    '<div class="anomaly-card anomaly-card-warning">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🚫</span>' +
                            '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户') + '</h3>' +
                            '<span class="anomaly-badge">' + blacklistTotalCount + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                    '</div>' +
                '</div>';
            
            window._anomalyOverdueState = {
                page: 0,
                pageSize: 50,
                totalCount: overdueTotalCount,
                profile: profile,
                isAdmin: isAdmin,
                storeId: storeId
            };
            window._anomalyBlacklistState = {
                page: 0,
                pageSize: 50,
                totalCount: blacklistTotalCount
            };
            
            if (window._debugAnomalyCache !== false) {
                console.log('[AnomalyCache] 统计:', AnomalyCache.getStats());
            }
            
        } catch (error) {
            console.error("showAnomaly error:", error);
            Utils.ErrorHandler.capture(error, 'showAnomaly');
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data abnormal: ' + error.message : '加载异常数据失败：' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal memuat data abnormal: ' + error.message : '加载异常数据失败：' + error.message);
            }
        }
    },

    // ========== 加载更多逾期订单 ==========
    loadMoreOverdueOrders: async function() {
        var state = window._anomalyOverdueState;
        if (!state) return;
        
        var lang = Utils.lang;
        
        var loadMoreBtn = document.querySelector('#overdueLoadMoreRow button');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...');
        }
        
        try {
            var nextPage = state.page + 1;
            var result = await AnomalyHelper.getOverdueOrders(state.profile, nextPage, state.pageSize);
            
            var newRows = '';
            for (var i = 0; i < result.data.length; i++) {
                var o = result.data[i];
                var customerName = o.customer_name || '-';
                newRows += '<tr>' +
                    '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                    '<td>' + Utils.escapeHtml(customerName) + '</td>' +
                    '<td class="text-center expense">' + (o.overdue_days || 0) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                    '<td class="text-center"><button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '</button></td>' +
                '</tr>';
            }
            
            var oldLoadMoreRow = document.getElementById('overdueLoadMoreRow');
            if (oldLoadMoreRow) oldLoadMoreRow.remove();
            
            var tbody = document.querySelector('.anomaly-card-danger table tbody');
            if (tbody) {
                tbody.insertAdjacentHTML('beforeend', newRows);
                
                state.page = nextPage;
                state.totalCount = result.totalCount;
                
                var loadedCount = (nextPage + 1) * state.pageSize;
                if (result.totalCount > loadedCount) {
                    var loadMoreHtml = '' +
                        '<tr id="overdueLoadMoreRow">' +
                            '<td colspan="5" style="text-align:center;padding:10px;">' +
                                '<button onclick="APP.loadMoreOverdueOrders()" class="btn-small primary" style="padding:8px 24px;">' +
                                    '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多') + 
                                    ' (' + (result.totalCount - loadedCount) + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')' +
                                '</button>' +
                            '</td>' +
                        '</tr>';
                    tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                } else {
                    var doneHtml = '' +
                        '<tr id="overdueLoadMoreRow">' +
                            '<td colspan="5" style="text-align:center;padding:10px;color:var(--text-muted);">' +
                                '✅ ' + (lang === 'id' ? 'Semua ' + result.totalCount + ' pesanan telah dimuat' : '已加载全部 ' + result.totalCount + ' 条订单') +
                            '</td>' +
                        '</tr>';
                    tbody.insertAdjacentHTML('beforeend', doneHtml);
                }
            }
            
        } catch (err) {
            console.error("loadMoreOverdueOrders error:", err);
            Utils.ErrorHandler.capture(err, 'loadMoreOverdueOrders');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多');
            }
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
            }
        }
    },

    // ========== 加载更多黑名单 ==========
    loadMoreBlacklist: async function() {
        var state = window._anomalyBlacklistState;
        if (!state) return;
        
        var lang = Utils.lang;
        
        var loadMoreBtn = document.querySelector('#blacklistLoadMoreRow button');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...');
        }
        
        try {
            var nextPage = state.page + 1;
            var result = await AnomalyHelper.getBlacklistCustomers(nextPage, state.pageSize);
            
            var newRows = '';
            for (var i = 0; i < result.data.length; i++) {
                var b = result.data[i];
                newRows += '<tr>' +
                    '<td>' + Utils.escapeHtml(b.customers?.customer_id || '-') + '</td>' +
                    '<td>' + Utils.escapeHtml(b.customers?.name || '-') + '</td>' +
                    '<td>' + Utils.escapeHtml(b.customers?.phone || '-') + '</td>' +
                    '<td>' + Utils.escapeHtml(b.reason) + '</td>' +
                '</tr>';
            }
            
            var oldLoadMoreRow = document.getElementById('blacklistLoadMoreRow');
            if (oldLoadMoreRow) oldLoadMoreRow.remove();
            
            var tbody = document.querySelector('.anomaly-card-warning table tbody');
            if (tbody) {
                tbody.insertAdjacentHTML('beforeend', newRows);
                
                state.page = nextPage;
                state.totalCount = result.totalCount;
                
                var loadedCount = (nextPage + 1) * state.pageSize;
                if (result.totalCount > loadedCount) {
                    var loadMoreHtml = '' +
                        '<tr id="blacklistLoadMoreRow">' +
                            '<td colspan="4" style="text-align:center;padding:10px;">' +
                                '<button onclick="APP.loadMoreBlacklist()" class="btn-small primary" style="padding:8px 24px;">' +
                                    '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多') + 
                                    ' (' + (result.totalCount - loadedCount) + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')' +
                                '</button>' +
                            '</td>' +
                        '</tr>';
                    tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                } else {
                    var doneHtml = '' +
                        '<tr id="blacklistLoadMoreRow">' +
                            '<td colspan="4" style="text-align:center;padding:10px;color:var(--text-muted);">' +
                                '✅ ' + (lang === 'id' ? 'Semua ' + result.totalCount + ' data telah dimuat' : '已加载全部 ' + result.totalCount + ' 条数据') +
                            '</td>' +
                        '</tr>';
                    tbody.insertAdjacentHTML('beforeend', doneHtml);
                }
            }
            
        } catch (err) {
            console.error("loadMoreBlacklist error:", err);
            Utils.ErrorHandler.capture(err, 'loadMoreBlacklist');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多');
            }
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
            }
        }
    },
    
    // 手动清除异常页面缓存
    clearAnomalyCache: function() {
        AnomalyCache.clear();
        if (window.Toast) {
            window.Toast.info('缓存已清除', 2000);
        }
        console.log('[AnomalyCache] 已手动清除所有缓存');
    }
};

// 挂载方法到 window.APP
for (var key in DashboardAnomaly) {
    if (typeof DashboardAnomaly[key] === 'function') {
        window.APP[key] = DashboardAnomaly[key];
    }
}

// 挂载加载更多方法
window.APP.loadMoreOverdueOrders = DashboardAnomaly.loadMoreOverdueOrders.bind(DashboardAnomaly);
window.APP.loadMoreBlacklist = DashboardAnomaly.loadMoreBlacklist.bind(DashboardAnomaly);
window.APP.clearAnomalyCache = DashboardAnomaly.clearAnomalyCache.bind(DashboardAnomaly);
