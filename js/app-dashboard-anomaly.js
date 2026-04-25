// app-dashboard-anomaly.js - v1.2（移除内联样式，使用组件库）

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
            
            // 并行获取所有异常数据
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
                
                // Q4: 所有订单（用于排名计算）
                SUPABASE.getOrders()
            ]);
            
            var overdueOrders = overdueResult;
            var blacklist = blacklistResult;
            
            // 基于已有数据计算门店业绩
            var storeOrderCount = {};
            for (var i = 0; i < stores.length; i++) {
                storeOrderCount[stores[i].id] = { 
                    name: stores[i].name, 
                    code: stores[i].code, 
                    count: 0 
                };
            }
            for (var i = 0; i < orders.length; i++) {
                if (storeOrderCount[orders[i].store_id]) {
                    storeOrderCount[orders[i].store_id].count++;
                }
            }
            
            var storeArray = [];
            for (var key in storeOrderCount) {
                if (storeOrderCount.hasOwnProperty(key)) {
                    storeArray.push(storeOrderCount[key]);
                }
            }
            storeArray.sort(function(a, b) { return b.count - a.count; });
            var allStoreRanking = storeArray;
            
            var lowest = storeArray.slice().sort(function(a, b) { return a.count - b.count; });
            var lowestStores = lowest.slice(0, Math.min(3, lowest.length));
            
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
            
            // ========== 渲染：最低业绩门店 ==========
            var lowestStoresHtml = '';
            if (lowestStores.length === 0) {
                lowestStoresHtml = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko' : '暂无门店数据') + '</div>' +
                    '</div>';
            } else {
                var storeItems = '';
                for (var i = 0; i < lowestStores.length; i++) {
                    var s = lowestStores[i];
                    storeItems += '' +
                        '<div class="store-item">' +
                            '<div class="store-item-info">' +
                                '<span class="store-item-name">' + Utils.escapeHtml(s.name) + '</span>' +
                                '<span class="store-item-code">' + Utils.escapeHtml(s.code) + '</span>' +
                            '</div>' +
                            '<div class="store-item-count' + (i === 0 ? ' lowest' : '') + '">' +
                                s.count + ' ' + (lang === 'id' ? 'pesanan' : '订单') +
                                (i === 0 ? ' 🔴' : '') +
                            '</div>' +
                        '</div>';
                }
                lowestStoresHtml = '<div class="store-list">' + storeItems + '</div>';
            }
            
            // ========== 渲染：门店排名 ==========
            var rankingHtml = '';
            if (allStoreRanking.length === 0) {
                rankingHtml = '' +
                    '<div class="empty-state">' +
                        '<div class="empty-state-icon">📊</div>' +
                        '<div class="empty-state-text">' + (lang === 'id' ? 'Belum ada data toko' : '暂无门店数据') + '</div>' +
                    '</div>';
            } else {
                var rankingItems = '';
                for (var i = 0; i < allStoreRanking.length; i++) {
                    var s = allStoreRanking[i];
                    var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
                    var rankClass = i === 0 ? 'first' : i === allStoreRanking.length - 1 ? 'last' : '';
                    rankingItems += '' +
                        '<div class="ranking-item ' + rankClass + '">' +
                            '<div class="ranking-number">' + medal + '</div>' +
                            '<div class="ranking-info">' +
                                '<span class="ranking-name">' + Utils.escapeHtml(s.name) + '</span>' +
                                '<span class="ranking-code">' + Utils.escapeHtml(s.code) + '</span>' +
                            '</div>' +
                            '<div class="ranking-count">' +
                                s.count + ' ' + (lang === 'id' ? 'pesanan' : '订单') +
                                (i === 0 ? ' ↑' : i === allStoreRanking.length - 1 ? ' ↓' : '') +
                            '</div>' +
                        '</div>';
                }
                rankingHtml = '<div class="ranking-list">' + rankingItems + '</div>';
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
                    
                    // 卡片1：逾期30天订单
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
                    
                    // 卡片2：黑名单客户
                    '<div class="anomaly-card anomaly-card-warning">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🚫</span>' +
                            '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户') + '</h3>' +
                            '<span class="anomaly-badge">' + blacklist.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                    '</div>' +
                    
                    // 卡片3：最低业绩门店
                    '<div class="anomaly-card anomaly-card-info">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">📉</span>' +
                            '<h3>' + (lang === 'id' ? 'Kinerja Terendah' : '业绩最低门店') + '</h3>' +
                            '<span class="anomaly-badge">' + lowestStores.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + lowestStoresHtml + '</div>' +
                        '<div class="anomaly-card-footer">' +
                            '<span class="info-text">💡 ' + (lang === 'id' ? 'Paling sedikit pesanan' : '订单数最少') + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                    // 卡片4：门店业绩排行
                    '<div class="anomaly-card anomaly-card-info">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🏆</span>' +
                            '<h3>' + (lang === 'id' ? 'Peringkat Kinerja Toko' : '门店业绩排行') + '</h3>' +
                            '<span class="anomaly-badge">' + allStoreRanking.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + rankingHtml + '</div>' +
                        '<div class="anomaly-card-footer">' +
                            '<span class="info-text">💡 ' + (lang === 'id' ? 'Peringkat berdasarkan total pesanan' : '排名基于订单总数') + '</span>' +
                        '</div>' +
                    '</div>' +
                    
                '</div>';
            
        } catch (error) {
            console.error("showAnomaly error:", error);
            alert(lang === 'id' ? 'Gagal memuat data abnormal' : '加载异常数据失败');
        }
    }
};

for (var key in DashboardAnomaly) {
    if (typeof DashboardAnomaly[key] === 'function') {
        window.APP[key] = DashboardAnomaly[key];
    }
}
