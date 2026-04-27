// app-dashboard-anomaly.js - v1.0

window.APP = window.APP || {};

// ==================== 异常检测缓存模块 ====================
const AnomalyCache = {
    _data: new Map(),
    _ttl: 3 * 60 * 1000,  // 3分钟缓存

    async get(key, fetcher) {
        const cached = this._data.get(key);
        if (cached && Date.now() - cached.time < this._ttl) {
            console.log('[AnomalyCache] Hit:', key);
            return cached.value;
        }
        console.log('[AnomalyCache] Miss:', key);
        const value = await fetcher();
        this._data.set(key, { value, time: Date.now() });
        return value;
    },

    clear() {
        this._data.clear();
    }
};

// ==================== 异常检测辅助方法 ====================
const AnomalyHelper = {
    /**
     * 获取逾期30天订单（分页 + 聚合统计）
     */
    async getOverdueOrders(profile, page, pageSize) {
        if (page === undefined) page = 0;
        if (pageSize === undefined) pageSize = 50;
        
        const isAdmin = profile?.role === 'admin';
        const storeId = profile?.store_id;
        
        let query = supabaseClient
            .from('orders')
            .select('order_id, customer_name, overdue_days, loan_amount, status, customers(name, phone)', { count: 'exact' })
            .eq('status', 'active')
            .gte('overdue_days', 30)
            .order('overdue_days', { ascending: false });
        
        if (!isAdmin && storeId) {
            query = query.eq('store_id', storeId);
        }
        
        // 分页：使用 .range()
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

    /**
     * 获取黑名单客户（分页 + 聚合统计）
     */
    async getBlacklistCustomers(page, pageSize) {
        if (page === undefined) page = 0;
        if (pageSize === undefined) pageSize = 50;
        
        const from = page * pageSize;
        const to = from + pageSize - 1;
        
        const { data, error, count } = await supabaseClient
            .from('blacklist')
            .select('*, customers(name, phone, customer_id)', { count: 'exact' })
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

    /**
     * 获取本月门店排名数据（限制数据范围到本月，不再拉全量历史订单）
     */
    async getMonthlyStoreRanking(stores) {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
        const monthEnd = today.toISOString().split('T')[0];
        
        // 只拉取本月订单（关键性能优化点）
        const { data: monthlyOrders, error } = await supabaseClient
            .from('orders')
            .select('id, store_id, loan_amount, status, overdue_days')
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd);
        
        if (error) {
            console.warn('获取本月订单失败:', error);
            return { top3: [], bottom3: [] };
        }
        
        // 获取本月还款数据
        const { data: monthlyFlows } = await supabaseClient
            .from('cash_flow_records')
            .select('store_id, amount, order_id')
            .eq('direction', 'inflow')
            .eq('is_voided', false)
            .gte('recorded_at', monthStart);
        
        // 构建 flow 金额快速查找表
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
        
        // 按门店聚合统计
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
        
        // 计算综合排名
        for (const s of eligibleStores) {
            s.rankSum = 0;
        }
        
        // 按订单数从大到小排
        eligibleStores.sort((a, b) => b.orderCount - a.orderCount);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankOrderCount = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按放款额从小到大排（越小风险越低）
        eligibleStores.sort((a, b) => a.totalLoanOutflow - b.totalLoanOutflow);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankLoanOutflow = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按不良订单数从小到大排
        eligibleStores.sort((a, b) => a.badOrders - b.badOrders);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankBadOrders = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按回收额从大到小排
        eligibleStores.sort((a, b) => b.totalRecovery - a.totalRecovery);
        for (let i = 0; i < eligibleStores.length; i++) {
            eligibleStores[i].rankRecovery = i + 1;
            eligibleStores[i].rankSum += (i + 1);
        }
        
        // 按总分从小到大排（越小排名越好）
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
            
            // ========== 并行获取数据（使用聚合查询 + 缓存） ==========
            
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
                    // 兼容两种数据结构：直接字段 或 嵌套 customers
                    var customerName = o.customers?.name || o.customer_name || '-';
                    overdueRows += '<tr>' +
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td>' + Utils.escapeHtml(customerName) + '</td>' +
                        '<td class="text-center expense">' + (o.overdue_days || 0) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="text-center"><button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '</button></td>' +
                    '<tr>';
                }
                
                // 判断是否还有更多
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
                        '<tr>' + Utils.escapeHtml(b.reason) + '</td>' +
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
                        '</table>';
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
            
            // ========== 门店视图：2列布局（逾期30天 + 黑名单） ==========
            if (!isAdmin) {
                document.getElementById("app").innerHTML = '' +
                    '<div class="page-header">' +
                        '<h2>⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</h2>' +
                        '<div class="header-actions">' +
                            '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                            '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="anomaly-grid">' +
                        // 卡片1：逾期30天订单
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
                        
                        // 卡片2：黑名单客户
                        '<div class="anomaly-card anomaly-card-warning">' +
                            '<div class="anomaly-card-header">' +
                                '<span class="anomaly-icon">🚫</span>' +
                                '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah (Semua Toko)' : '黑名单客户（全部门店）') + '</h3>' +
                                '<span class="anomaly-badge">' + blacklistTotalCount + '</span>' +
                            '</div>' +
                            '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                        '</div>' +
                    '</div>';
                
                // 存储状态用于加载更多
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
            
            // ========== 以下为总部视图（isAdmin = true） ==========
            
            // 渲染门店排名前三
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
            
            // 渲染门店排名后三
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
            
            // ========== 总部视图（保持原有4卡片网格布局） ==========
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="anomaly-grid">' +
                    
                    // 卡片1：业绩前三
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
                    
                    // 卡片2：业绩后三
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
                    
                    // 卡片3：逾期30天订单
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
                    
                    // 卡片4：黑名单
                    '<div class="anomaly-card anomaly-card-warning">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🚫</span>' +
                            '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户') + '</h3>' +
                            '<span class="anomaly-badge">' + blacklistTotalCount + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                    '</div>' +
                    
                '</div>';
            
            // 存储状态用于加载更多
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
            
        } catch (error) {
            console.error("showAnomaly error:", error);
            Utils.ErrorHandler.capture(error, 'showAnomaly');
            alert(lang === 'id' ? 'Gagal memuat data abnormal: ' + error.message : '加载异常数据失败：' + error.message);
        }
    },

    // ========== 加载更多逾期订单 ==========
    loadMoreOverdueOrders: async function() {
        var state = window._anomalyOverdueState;
        if (!state) return;
        
        var lang = Utils.lang;
        
        // 禁用按钮
        var loadMoreBtn = document.querySelector('#overdueLoadMoreRow button');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...');
        }
        
        try {
            var nextPage = state.page + 1;
            var result = await AnomalyHelper.getOverdueOrders(state.profile, nextPage, state.pageSize);
            
            // 构建新行HTML
            var newRows = '';
            for (var i = 0; i < result.data.length; i++) {
                var o = result.data[i];
                var customerName = o.customers?.name || o.customer_name || '-';
                newRows += '<tr>' +
                    '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                    '<td>' + Utils.escapeHtml(customerName) + '</td>' +
                    '<td class="text-center expense">' + (o.overdue_days || 0) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                    '<td class="text-center"><button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '</button></td>' +
                '</tr>';
            }
            
            // 移除旧加载更多行
            var oldLoadMoreRow = document.getElementById('overdueLoadMoreRow');
            if (oldLoadMoreRow) oldLoadMoreRow.remove();
            
            // 插入新行
            var tbody = document.querySelector('.anomaly-card-danger table tbody');
            if (tbody) {
                tbody.insertAdjacentHTML('beforeend', newRows);
                
                // 更新状态
                state.page = nextPage;
                state.totalCount = result.totalCount;
                
                // 如果还有更多，追加新的加载更多行
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
                    // 全部加载完毕
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
            // 恢复按钮
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多');
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
                        '<tr>';
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
        }
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
