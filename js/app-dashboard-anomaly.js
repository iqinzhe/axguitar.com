// app-dashboard-anomaly.js - v1.0

window.APP = window.APP || {};

// ==================== 异常检测辅助方法（使用 SUPABASE 封装） ====================
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
        
        for (let idx = 0; idx < eligibleStores.length; idx++) {
            eligibleStores[idx].rankSum = 0;
        }
        
        eligibleStores.sort((a, b) => b.orderCount - a.orderCount);
        for (let idx = 0; idx < eligibleStores.length; idx++) {
            eligibleStores[idx].rankOrderCount = idx + 1;
            eligibleStores[idx].rankSum += (idx + 1);
        }
        
        eligibleStores.sort((a, b) => a.totalLoanOutflow - b.totalLoanOutflow);
        for (let idx = 0; idx < eligibleStores.length; idx++) {
            eligibleStores[idx].rankLoanOutflow = idx + 1;
            eligibleStores[idx].rankSum += (idx + 1);
        }
        
        eligibleStores.sort((a, b) => a.badOrders - b.badOrders);
        for (let idx = 0; idx < eligibleStores.length; idx++) {
            eligibleStores[idx].rankBadOrders = idx + 1;
            eligibleStores[idx].rankSum += (idx + 1);
        }
        
        eligibleStores.sort((a, b) => b.totalRecovery - a.totalRecovery);
        for (let idx = 0; idx < eligibleStores.length; idx++) {
            eligibleStores[idx].rankRecovery = idx + 1;
            eligibleStores[idx].rankSum += (idx + 1);
        }
        
        eligibleStores.sort((a, b) => a.rankSum - b.rankSum);
        
        // ========== 修复：当门店数量不足时，top3 和 bottom3 不应重叠 ==========
        const totalCount = eligibleStores.length;
        
        if (totalCount === 1) {
            // 只有1家门店：top3 显示它，bottom3 为空
            const top3 = eligibleStores.slice(0, 1);
            return { top3, bottom3: [] };
        }
        
        if (totalCount === 2) {
            // 只有2家门店：top3 显示全部2家，bottom3 为空
            const top3 = eligibleStores.slice(0, 2);
            return { top3, bottom3: [] };
        }
        
        if (totalCount === 3) {
            // 只有3家门店：top3 显示全部3家，bottom3 显示第3名（最后1家）
            const top3 = eligibleStores.slice(0, 3);
            const bottom3 = eligibleStores.slice(-1).reverse();
            return { top3, bottom3 };
        }
        
        // 4家及以上：正常取 top3 和 bottom3
        const top3 = eligibleStores.slice(0, Math.min(3, totalCount));
        const bottom3 = eligibleStores.slice(-Math.min(3, totalCount)).reverse();
        
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
            
            // 逾期30天订单（分页加载，初始50条）- 使用统一缓存
            const overdueCacheKey = 'overdue_orders_' + (isAdmin ? 'admin' : storeId) + '_0';
            const overdueResult = await JFCache.get(overdueCacheKey, 
                () => AnomalyHelper.getOverdueOrders(profile, 0, 50),
                { ttl: 3 * 60 * 1000 }
            );
            var overdueOrders = overdueResult.data;
            var overdueTotalCount = overdueResult.totalCount;
            
            // 黑名单客户（分页加载，初始50条）- 使用统一缓存
            const blacklistCacheKey = 'blacklist_customers_0';
            const blacklistResult = await JFCache.get(blacklistCacheKey,
                () => AnomalyHelper.getBlacklistCustomers(0, 50),
                { ttl: 3 * 60 * 1000 }
            );
            var blacklist = blacklistResult.data;
            var blacklistTotalCount = blacklistResult.totalCount;
            
            // 门店排名（仅总部需要）- 使用统一缓存
            var top3 = [], bottom3 = [];
            if (isAdmin) {
                const stores = await SUPABASE.getAllStores();
                const rankingCacheKey = 'monthly_store_ranking';
                const rankingResult = await JFCache.get(rankingCacheKey,
                    () => AnomalyHelper.getMonthlyStoreRanking(stores),
                    { ttl: 5 * 60 * 1000 }
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
                for (let overdueIdx = 0; overdueIdx < overdueOrders.length; overdueIdx++) {
                    var o = overdueOrders[overdueIdx];
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
                for (let blIdx = 0; blIdx < blacklist.length; blIdx++) {
                    var b = blacklist[blIdx];
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
            
            // ========== 总部视图：门店排名渲染 ==========
            
            var top3Html = '';
            if (top3.length === 0) {
                top3Html = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko bulan ini' : '本月暂无门店数据') + '</div>' +
                    '</div>';
            } else {
                var top3Items = '';
                for (let topIdx = 0; topIdx < top3.length; topIdx++) {
                    var s = top3[topIdx];
                    var medal = topIdx === 0 ? '🥇' : topIdx === 1 ? '🥈' : '🥉';
                    top3Items += '' +
                        '<div class="ranking-item ' + (topIdx === 0 ? 'first' : '') + '">' +
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
                for (let bottomIdx = 0; bottomIdx < bottom3.length; bottomIdx++) {
                    var store = bottom3[bottomIdx];
                    var mark = bottomIdx === 0 ? '🔴' : bottomIdx === 1 ? '🟡' : '🟠';
                    bottom3Items += '' +
                        '<div class="ranking-item ' + (bottomIdx === 0 ? 'last' : '') + '">' +
                            '<div class="ranking-number">' + mark + '</div>' +
                            '<div class="ranking-info">' +
                                '<span class="ranking-name">' + Utils.escapeHtml(store.name) + '</span>' +
                                '<span class="ranking-code">' + Utils.escapeHtml(store.code) + '</span>' +
                            '</div>' +
                            '<div class="ranking-count" style="font-size:var(--font-xxs);text-align:right;line-height:1.6;">' +
                                (lang === 'id' ? '订单: ' : '订单: ') + store.orderCount + '<br>' +
                                (lang === 'id' ? '放款: ' : '放款: ') + Utils.formatCurrency(store.totalLoanOutflow) + '<br>' +
                                (lang === 'id' ? '不良: ' : '不良: ') + store.badOrders + '<br>' +
                                (lang === 'id' ? '回收: ' : '回收: ') + Utils.formatCurrency(store.totalRecovery) +
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
                console.log('[AnomalyCache] 统计:', JFCache.getStats());
            }
            
        } catch (error) {
            console.error("showAnomaly error:", error);
            Utils.ErrorHandler.capture(error, 'showAnomaly');
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data abnormal: ' + error.message : '加载异常数据失败：' + error.message);
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
            for (let loadIdx = 0; loadIdx < result.data.length; loadIdx++) {
                var o = result.data[loadIdx];
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
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
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
            for (let loadIdx = 0; loadIdx < result.data.length; loadIdx++) {
                var b = result.data[loadIdx];
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
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
        }
    },
    
    // 手动清除异常页面缓存（使用统一缓存模块）
    clearAnomalyCache: function() {
        JFCache.clear();
        Utils.toast.info('缓存已清除', 2000);
        console.log('[JFCache] 已手动清除所有缓存');
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
