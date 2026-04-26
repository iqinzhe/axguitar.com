// app-dashboard-anomaly.js - v2.1（兼容 getOrdersLegacy、错误上报）

window.APP = window.APP || {};

const DashboardAnomaly = {

    showAnomaly: async function() {
        APP.currentPage = 'anomaly';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            
            // 并行获取所有数据
            const [
                overdueResult,
                blacklistResult,
                stores,
                orders
            ] = await Promise.all([
                // Q1: 逾期30天订单
                (async function() {
                    try {
                        let query = supabaseClient
                            .from('orders')
                            .select('*, customers(name, phone)')
                            .eq('status', 'active')
                            .gte('overdue_days', 30);
                        
                        if (!isAdmin && storeId) {
                            query = query.eq('store_id', storeId);
                        }
                        
                        const { data, error } = await query;
                        if (error) { console.warn("获取逾期订单失败:", error); return []; }
                        return data || [];
                    } catch(e) {
                        console.warn("获取逾期订单失败:", e);
                        return [];
                    }
                })(),
                
                // Q2: 黑名单客户
                (async function() {
                    try {
                        let query = supabaseClient
                            .from('blacklist')
                            .select('*, customers(name, phone, customer_id)');
                        
                        if (!isAdmin && storeId) {
                            query = query.eq('store_id', storeId);
                        }
                        
                        const { data, error } = await query;
                        if (error) { console.warn("获取黑名单失败:", error); return []; }
                        return data || [];
                    } catch(e) {
                        console.warn("获取黑名单失败:", e);
                        return [];
                    }
                })(),
                
                // Q3: 所有门店
                SUPABASE.getAllStores(),
                
                // Q4: 所有订单（用于排名计算）—— 使用兼容方法
                SUPABASE.getOrdersLegacy()
            ]);
            
            var overdueOrders = overdueResult;
            var blacklist = blacklistResult;
            
            // ========== 本月日期范围 ==========
            var today = new Date();
            var currentMonth = today.getMonth();
            var currentYear = today.getFullYear();
            var monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
            var monthEnd = today.toISOString().split('T')[0];
            
            // ========== 门店映射表 ==========
            var storeInfoMap = {};
            for (var i = 0; i < stores.length; i++) {
                storeInfoMap[stores[i].id] = {
                    id: stores[i].id,
                    name: stores[i].name,
                    code: stores[i].code,
                    isActive: stores[i].is_active !== false
                };
            }
            
            // ========== 按月统计各门店数据 ==========
            var storeMonthlyStats = {};
            for (var i = 0; i < stores.length; i++) {
                var s = stores[i];
                storeMonthlyStats[s.id] = {
                    id: s.id,
                    name: s.name,
                    code: s.code,
                    isActive: s.is_active !== false,
                    orderCount: 0,
                    totalLoanOutflow: 0,
                    badOrders: 0,
                    totalRecovery: 0
                };
            }
            
            // 计算当月订单的当金流出
            var monthlyOrderIds = [];
            for (var i = 0; i < orders.length; i++) {
                var o = orders[i];
                var orderDate = o.created_at ? o.created_at.split('T')[0] : '';
                
                if (orderDate >= monthStart && orderDate <= monthEnd) {
                    monthlyOrderIds.push(o.id);
                    
                    if (storeMonthlyStats[o.store_id]) {
                        storeMonthlyStats[o.store_id].orderCount++;
                        storeMonthlyStats[o.store_id].totalLoanOutflow += (o.loan_amount || 0);
                        
                        // 不良客户订单：逾期 ≥ 15 天
                        if ((o.overdue_days || 0) >= 15 && o.status === 'active') {
                            storeMonthlyStats[o.store_id].badOrders++;
                        }
                    }
                }
            }
            
            // 计算当月资金回收数额
            if (monthlyOrderIds.length > 0) {
                var { data: monthlyFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('store_id, amount')
                    .eq('direction', 'inflow')
                    .eq('is_voided', false)
                    .in('order_id', monthlyOrderIds);
                
                if (monthlyFlows) {
                    for (var i = 0; i < monthlyFlows.length; i++) {
                        var f = monthlyFlows[i];
                        if (storeMonthlyStats[f.store_id]) {
                            storeMonthlyStats[f.store_id].totalRecovery += (f.amount || 0);
                        }
                    }
                }
            }
            
            // ========== 构建排行数组（排除总部 + 排除暂停营业） ==========
            var eligibleStores = [];
            var storeKeys = Object.keys(storeMonthlyStats);
            for (var i = 0; i < storeKeys.length; i++) {
                var s = storeMonthlyStats[storeKeys[i]];
                if (s.code === 'STORE_000') continue;
                if (!s.isActive) continue;
                eligibleStores.push(s);
            }
            
            // ========== 4项指标综合排名 ==========
            for (var i = 0; i < eligibleStores.length; i++) {
                eligibleStores[i].rankSum = 0;
            }
            
            // 指标1：订单总数（越多越好）
            eligibleStores.sort(function(a, b) { return b.orderCount - a.orderCount; });
            for (var i = 0; i < eligibleStores.length; i++) {
                eligibleStores[i].rankOrderCount = i + 1;
                eligibleStores[i].rankSum += (i + 1);
            }
            
            // 指标2：当金流出总额（越少越好）
            eligibleStores.sort(function(a, b) { return a.totalLoanOutflow - b.totalLoanOutflow; });
            for (var i = 0; i < eligibleStores.length; i++) {
                eligibleStores[i].rankLoanOutflow = i + 1;
                eligibleStores[i].rankSum += (i + 1);
            }
            
            // 指标3：不良客户订单（越少越好）
            eligibleStores.sort(function(a, b) { return a.badOrders - b.badOrders; });
            for (var i = 0; i < eligibleStores.length; i++) {
                eligibleStores[i].rankBadOrders = i + 1;
                eligibleStores[i].rankSum += (i + 1);
            }
            
            // 指标4：资金回收数额（越多越好）
            eligibleStores.sort(function(a, b) { return b.totalRecovery - a.totalRecovery; });
            for (var i = 0; i < eligibleStores.length; i++) {
                eligibleStores[i].rankRecovery = i + 1;
                eligibleStores[i].rankSum += (i + 1);
            }
            
            // 按综合得分排序（越低越好）
            eligibleStores.sort(function(a, b) { return a.rankSum - b.rankSum; });
            
            var top3 = eligibleStores.slice(0, Math.min(3, eligibleStores.length));
            var bottom3 = eligibleStores.slice(-Math.min(3, eligibleStores.length)).reverse();
            
            // ========== 渲染：门店业绩前三排行 ==========
            var top3Html = '';
            if (top3.length === 0) {
                top3Html = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko' : '暂无门店数据') + '</div>' +
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
            
            // ========== 渲染：门店业绩后三排行 ==========
            var bottom3Html = '';
            if (bottom3.length === 0) {
                bottom3Html = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko' : '暂无门店数据') + '</div>' +
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
            
            // ========== 渲染：逾期30天订单 ==========
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
                    overdueRows += '<tr>' +
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td>' + Utils.escapeHtml(o.customers?.name || o.customer_name) + '</td>' +
                        '<td class="text-center expense">' + o.overdue_days + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="text-center"><button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '</button></td>' +
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
                            '<tbody>' + overdueRows + '</tbody>' +
                        '</table>' +
                    '</div>';
            }
            
            // ========== 渲染：黑名单客户 ==========
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
                            '<tbody>' + blacklistRows + '</tbody>' +
                        '</table>' +
                    '</div>';
            }
            
            // ========== 组装页面 ==========
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="anomaly-grid">' +
                    
                    // 卡片1：门店业绩前三排行
                    '<div class="anomaly-card anomaly-card-info">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🏆</span>' +
                            '<h3>' + (lang === 'id' ? 'Kinerja Terbaik (3 Besar)' : '业绩前三排行') + '</h3>' +
                            '<span class="anomaly-badge">' + top3.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + top3Html + '</div>' +
                        '<div class="anomaly-card-footer">' +
                            '<span class="info-text">💡 ' + (lang === 'id' ? 'Peringkat berdasarkan data bulan ini (tidak termasuk pusat & toko tutup)' : '排名基于当月数据（不含总部及暂停门店）') + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                    // 卡片2：门店业绩后三排行
                    '<div class="anomaly-card anomaly-card-info">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">📉</span>' +
                            '<h3>' + (lang === 'id' ? 'Kinerja Terendah (3 Besar)' : '业绩后三排行') + '</h3>' +
                            '<span class="anomaly-badge">' + bottom3.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + bottom3Html + '</div>' +
                        '<div class="anomaly-card-footer">' +
                            '<span class="info-text">💡 ' + (lang === 'id' ? 'Peringkat berdasarkan data bulan ini (tidak termasuk pusat & toko tutup)' : '排名基于当月数据（不含总部及暂停门店）') + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                    // 卡片3：逾期30天订单
                    '<div class="anomaly-card anomaly-card-danger">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">⚠️</span>' +
                            '<h3>' + (lang === 'id' ? 'Pesanan Terlambat 30+ Hari' : '逾期30天以上订单') + '</h3>' +
                            '<span class="anomaly-badge">' + overdueOrders.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + overdueTableHtml + '</div>' +
                        (overdueOrders.length > 0 ? 
                            '<div class="anomaly-card-footer">' +
                                '<span class="warning-text">💡 ' + (lang === 'id' ? 'Pesanan ini akan memasuki proses likuidasi' : '这些订单即将进入变卖程序') + '</span>' +
                            '</div>' : '') +
                    '</div>' +
                    
                    // 卡片4：黑名单客户
                    '<div class="anomaly-card anomaly-card-warning">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🚫</span>' +
                            '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户') + '</h3>' +
                            '<span class="anomaly-badge">' + blacklist.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                    '</div>' +
                    
                '</div>';
            
        } catch (error) {
            console.error("showAnomaly error:", error);
            Utils.ErrorHandler.capture(error, 'showAnomaly');
            alert(lang === 'id' ? 'Gagal memuat data abnormal' : '加载异常数据失败');
        }
    }
};

for (var key in DashboardAnomaly) {
    if (typeof DashboardAnomaly[key] === 'function') {
        window.APP[key] = DashboardAnomaly[key];
    }
}
