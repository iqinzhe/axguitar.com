// app-dashboard-anomaly.js - v1.1（修复saveCurrentPageState调用）

window.APP = window.APP || {};

const DashboardAnomaly = {

    showAnomaly: async function() {
        APP.currentPage = 'anomaly';
        APP.saveCurrentPageState();  // 修复：this → APP
        var lang = Utils.lang;
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            
            // ========== 优化：并行获取所有异常数据 ==========
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
            
            // ========== 基于已有数据计算门店业绩 ==========
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
            
            // 最低3名
            var lowest = storeArray.slice().sort(function(a, b) { return a.count - b.count; });
            var lowestStores = lowest.slice(0, Math.min(3, lowest.length));
            
            // ========== 渲染页面 ==========
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
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '<\/td>' +
                        '<td>' + Utils.escapeHtml(o.customers?.name || o.customer_name) + '<\/td>' +
                        '<td class="text-center" style="color:#ef4444; font-weight:600;">' + o.overdue_days + '<\/td>' +
                        '<td class="text-right">' + Utils.formatCurrency(o.loan_amount) + '<\/td>' +
                        '<td class="text-center"><button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '<\/button><\/td>' +
                    '<\/tr>';
                }
                overdueTableHtml = '' +
                    '<div class="table-container">' +
                        '<table class="data-table anomaly-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'ID Pesanan' : '订单号') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Nama Nasabah' : '客户姓名') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Hari Terlambat' : '逾期天数') + '</th>' +
                                    '<th class="text-right">' + (lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                                '<\/tr>' +
                            '</thead>' +
                            '<tbody>' + overdueRows + '</tbody>' +
                        '<\/table>' +
                    '</div>';
            }
            
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
                        '<td class="customer-id">' + Utils.escapeHtml(b.customers?.customer_id || '-') + '<\/td>' +
                        '<td>' + Utils.escapeHtml(b.customers?.name || '-') + '<\/td>' +
                        '<td>' + Utils.escapeHtml(b.customers?.phone || '-') + '<\/td>' +
                        '<td>' + Utils.escapeHtml(b.reason) + '<\/td>' +
                        '<td class="text-center"><button onclick="APP.showCustomerOrders(\'' + b.customer_id + '\')" class="btn-small">' + (lang === 'id' ? 'Lihat' : '查看') + '<\/button><\/td>' +
                    '<\/tr>';
                }
                blacklistTableHtml = '' +
                    '<div class="table-container">' +
                        '<table class="data-table anomaly-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Nama' : '姓名') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Telepon' : '电话') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Alasan' : '原因') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                                '<\/tr>' +
                            '</thead>' +
                            '<tbody>' + blacklistRows + '</tbody>' +
                        '<\/table>' +
                    '</div>';
            }
            
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
                            '<div class="store-item-count ' + (i === 0 ? 'lowest' : '') + '">' +
                                s.count + ' ' + (lang === 'id' ? 'pesanan' : '订单') +
                                (i === 0 ? ' 🔴' : '') +
                            '</div>' +
                        '</div>';
                }
                lowestStoresHtml = '<div class="store-list">' + storeItems + '</div>';
            }
            
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
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>⚠️ ' + (lang === 'id' ? 'Situasi Abnormal' : '异常状况') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="anomaly-grid">' +
                    
                    '<!-- 卡片1：逾期30天订单 -->' +
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
                    
                    '<!-- 卡片2：黑名单客户 -->' +
                    '<div class="anomaly-card anomaly-card-warning">' +
                        '<div class="anomaly-card-header">' +
                            '<span class="anomaly-icon">🚫</span>' +
                            '<h3>' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户') + '</h3>' +
                            '<span class="anomaly-badge">' + blacklist.length + '</span>' +
                        '</div>' +
                        '<div class="anomaly-card-body">' + blacklistTableHtml + '</div>' +
                    '</div>' +
                    
                    '<!-- 卡片3：门店经营最低项（后3名） -->' +
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
                    
                    '<!-- 卡片4：门店业绩排行 -->' +
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
                    
                '</div>' +
                
                '<style>' +
                    '.anomaly-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; align-items: stretch; }' +
                    '.anomaly-card { background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-light); overflow: hidden; transition: all 0.2s ease; display: flex; flex-direction: column; min-height: 380px; }' +
                    '.anomaly-card:hover { box-shadow: var(--shadow-md); }' +
                    '.anomaly-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border-light); flex-shrink: 0; }' +
                    '.anomaly-icon { font-size: 24px; }' +
                    '.anomaly-card-header h3 { flex: 1; margin: 0; font-size: 1rem; }' +
                    '.anomaly-badge { background: var(--primary-soft); color: var(--primary-dark); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }' +
                    '.anomaly-card-danger .anomaly-badge { background: #fee2e2; color: #dc2626; }' +
                    '.anomaly-card-warning .anomaly-badge { background: #fef3c7; color: #d97706; }' +
                    '.anomaly-card-info .anomaly-badge { background: #e0f2fe; color: #0284c7; }' +
                    '.anomaly-card-body { padding: 16px 20px; flex: 1; overflow-y: auto; }' +
                    '.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: var(--text-muted); }' +
                    '.empty-state-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.5; }' +
                    '.empty-state-text { font-size: 0.85rem; }' +
                    '.anomaly-card-footer { padding: 12px 20px; background: var(--bg-hover); border-top: 1px solid var(--border-light); font-size: 0.7rem; flex-shrink: 0; }' +
                    '.anomaly-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }' +
                    '.anomaly-table th, .anomaly-table td { padding: 8px 6px; text-align: left; border-bottom: 1px solid var(--border-light); }' +
                    '.anomaly-table th { font-weight: 600; color: var(--text-secondary); background: var(--bg-hover); }' +
                    '.anomaly-table .order-id, .anomaly-table .customer-id { font-family: monospace; font-weight: 600; }' +
                    '.warning-text { color: #dc2626; }' +
                    '.info-text { color: var(--text-muted); }' +
                    '.store-list { display: flex; flex-direction: column; gap: 8px; }' +
                    '.store-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-hover); border-radius: 8px; }' +
                    '.store-item-info { display: flex; flex-direction: column; }' +
                    '.store-item-name { font-weight: 600; font-size: 0.85rem; }' +
                    '.store-item-code { font-size: 0.65rem; color: var(--text-muted); }' +
                    '.store-item-count { font-size: 1rem; font-weight: 700; }' +
                    '.store-item-count.lowest { color: #dc2626; }' +
                    '.ranking-list { display: flex; flex-direction: column; gap: 6px; }' +
                    '.ranking-item { display: flex; align-items: center; gap: 12px; padding: 8px 10px; background: var(--bg-hover); border-radius: 8px; }' +
                    '.ranking-number { font-size: 1.1rem; min-width: 45px; }' +
                    '.ranking-info { flex: 1; display: flex; flex-direction: column; }' +
                    '.ranking-name { font-weight: 600; font-size: 0.85rem; }' +
                    '.ranking-code { font-size: 0.65rem; color: var(--text-muted); }' +
                    '.ranking-count { font-size: 0.9rem; font-weight: 700; text-align: right; }' +
                    '.ranking-item.first { background: #fef3c7; border-left: 3px solid #f59e0b; }' +
                    '.ranking-item.last { background: #fee2e2; border-left: 3px solid #ef4444; }' +
                    '@media (max-width: 768px) { .anomaly-grid { grid-template-columns: 1fr; gap: 16px; } .anomaly-card { min-height: auto; } }' +
                '</style>';
            
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
