// app-dashboard-anomaly.js - v1.3（自适应高度 + 排除总部）

window.APP = window.APP || {};

const DashboardAnomaly = {

    showAnomaly: async function() {
        this.currentPage = 'anomaly';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            // ========== 1. 逾期30天订单 ==========
            let overdueOrders = [];
            try {
                let query = supabaseClient
                    .from('orders')
                    .select('*, customers(name, phone)')
                    .eq('status', 'active')
                    .gte('overdue_days', 30);
                
                if (!isAdmin && profile?.store_id) {
                    query = query.eq('store_id', profile.store_id);
                }
                
                const { data, error } = await query;
                if (!error) overdueOrders = data || [];
            } catch(e) {
                console.warn("获取逾期订单失败:", e);
            }
            
            // ========== 2. 黑名单客户 ==========
            let blacklist = [];
            try {
                let query = supabaseClient
                    .from('blacklist')
                    .select('*, customers(name, phone, customer_id)');
                
                if (!isAdmin && profile?.store_id) {
                    query = query.eq('store_id', profile.store_id);
                }
                
                const { data, error } = await query;
                if (!error) blacklist = data || [];
            } catch(e) {
                console.warn("获取黑名单失败:", e);
            }
            
            // ========== 3. 门店经营最低项（后3名，排除总部） ==========
            let lowestStores = [];
            // ========== 4. 门店业绩排行（完整排名，排除总部） ==========
            let allStoreRanking = [];
            try {
                const stores = await SUPABASE.getAllStores();
                // 排除总部（STORE_000）
                const businessStores = stores.filter(s => s.code !== 'STORE_000');
                const orders = await SUPABASE.getOrders();
                
                const storeOrderCount = {};
                for (var s of businessStores) {
                    storeOrderCount[s.id] = { name: s.name, code: s.code, count: 0 };
                }
                for (var o of orders) {
                    if (storeOrderCount[o.store_id]) {
                        storeOrderCount[o.store_id].count++;
                    }
                }
                
                const storeArray = Object.values(storeOrderCount);
                storeArray.sort((a, b) => b.count - a.count);
                allStoreRanking = storeArray;
                
                // 最低3名
                const lowest = [...storeArray];
                lowest.sort((a, b) => a.count - b.count);
                lowestStores = lowest.slice(0, Math.min(3, lowest.length));
            } catch(e) {
                console.warn("获取门店数据失败:", e);
            }
            
            // 渲染页面
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>⚠️ ${lang === 'id' ? 'Situasi Abnormal' : '异常状况'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${lang === 'id' ? 'Kembali' : '返回'}</button>
                    </div>
                </div>
                
                <div class="anomaly-grid">
                    
                    <!-- 卡片1：逾期30天订单 -->
                    <div class="anomaly-card anomaly-card-danger">
                        <div class="anomaly-card-header">
                            <span class="anomaly-icon">⚠️</span>
                            <h3>${lang === 'id' ? 'Pesanan Terlambat 30+ Hari' : '逾期30天以上订单'}</h3>
                            <span class="anomaly-badge">${overdueOrders.length}</span>
                        </div>
                        <div class="anomaly-card-body">
                            ${overdueOrders.length === 0 ? 
                                `<div class="empty-state">
                                    <div class="empty-state-icon">✅</div>
                                    <div class="empty-state-text">${lang === 'id' ? 'Semua pesanan dalam keadaan baik' : '所有订单状态良好'}</div>
                                </div>` :
                                `<div class="table-container">
                                    <table class="data-table anomaly-table">
                                        <thead>
                                            <tr>
                                                <th>${lang === 'id' ? 'ID Pesanan' : '订单号'}</th>
                                                <th>${lang === 'id' ? 'Nama Nasabah' : '客户姓名'}</th>
                                                <th class="text-center">${lang === 'id' ? 'Hari Terlambat' : '逾期天数'}</th>
                                                <th class="text-right">${lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额'}</th>
                                                <th class="text-center">${lang === 'id' ? 'Aksi' : '操作'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${overdueOrders.map(o => `
                                                <td>
                                                    <td class="order-id">${Utils.escapeHtml(o.order_id)}<\/td>
                                                    <td>${Utils.escapeHtml(o.customers?.name || o.customer_name)}<\/td>
                                                    <td class="text-center" style="color:#ef4444; font-weight:600;">${o.overdue_days}<\/td>
                                                    <td class="text-right">${Utils.formatCurrency(o.loan_amount)}<\/td>
                                                    <td class="text-center"><button onclick="APP.viewOrder('${o.order_id}')" class="btn-small">${lang === 'id' ? 'Lihat' : '查看'}<\/button><\/td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>`
                            }
                        </div>
                        ${overdueOrders.length > 0 ? `<div class="anomaly-card-footer">
                            <span class="warning-text">💡 ${lang === 'id' ? 'Pesanan ini akan memasuki proses likuidasi' : '这些订单即将进入变卖程序'}</span>
                        </div>` : ''}
                    </div>
                    
                    <!-- 卡片2：黑名单客户 -->
                    <div class="anomaly-card anomaly-card-warning">
                        <div class="anomaly-card-header">
                            <span class="anomaly-icon">🚫</span>
                            <h3>${lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户'}</h3>
                            <span class="anomaly-badge">${blacklist.length}</span>
                        </div>
                        <div class="anomaly-card-body">
                            ${blacklist.length === 0 ? 
                                `<div class="empty-state">
                                    <div class="empty-state-icon">👍</div>
                                    <div class="empty-state-text">${lang === 'id' ? 'Tidak ada nasabah di blacklist' : '暂无黑名单客户'}</div>
                                </div>` :
                                `<div class="table-container">
                                    <table class="data-table anomaly-table">
                                        <thead>
                                            <tr>
                                                <th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th>
                                                <th>${lang === 'id' ? 'Nama' : '姓名'}</th>
                                                <th>${lang === 'id' ? 'Telepon' : '电话'}</th>
                                                <th>${lang === 'id' ? 'Alasan' : '原因'}</th>
                                                <th class="text-center">${lang === 'id' ? 'Aksi' : '操作'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${blacklist.map(b => `
                                                <tr>
                                                    <td class="customer-id">${Utils.escapeHtml(b.customers?.customer_id || '-')}<\/td>
                                                    <td>${Utils.escapeHtml(b.customers?.name || '-')}<\/td>
                                                    <td>${Utils.escapeHtml(b.customers?.phone || '-')}<\/td>
                                                    <td>${Utils.escapeHtml(b.reason)}<\/td>
                                                    <td class="text-center"><button onclick="APP.showCustomerOrders('${b.customer_id}')" class="btn-small">${lang === 'id' ? 'Lihat' : '查看'}<\/button><\/td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>`
                            }
                        </div>
                    </div>
                    
                    <!-- 卡片3：门店经营最低项（后3名，排除总部） -->
                    <div class="anomaly-card anomaly-card-info">
                        <div class="anomaly-card-header">
                            <span class="anomaly-icon">📉</span>
                            <h3>${lang === 'id' ? 'Kinerja Terendah' : '业绩最低门店'}</h3>
                            <span class="anomaly-badge">${lowestStores.length}</span>
                        </div>
                        <div class="anomaly-card-body">
                            ${lowestStores.length === 0 ? 
                                `<div class="empty-state">
                                    <div class="empty-state-icon">📊</div>
                                    <div class="empty-state-text">${lang === 'id' ? 'Belum ada data toko' : '暂无门店数据'}</div>
                                </div>` :
                                `<div class="store-list">
                                    ${lowestStores.map((s, idx) => `
                                        <div class="store-item">
                                            <div class="store-item-info">
                                                <span class="store-item-name">${Utils.escapeHtml(s.name)}</span>
                                                <span class="store-item-code">${Utils.escapeHtml(s.code)}</span>
                                            </div>
                                            <div class="store-item-count ${idx === 0 ? 'lowest' : ''}">
                                                ${s.count} ${lang === 'id' ? 'pesanan' : '订单'}
                                                ${idx === 0 ? ' 🔴' : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>`
                            }
                        </div>
                        <div class="anomaly-card-footer">
                            <span class="info-text">💡 ${lang === 'id' ? 'Paling sedikit pesanan' : '订单数最少'}</span>
                        </div>
                    </div>
                    
                    <!-- 卡片4：门店业绩排行（完整排名，排除总部） -->
                    <div class="anomaly-card anomaly-card-info">
                        <div class="anomaly-card-header">
                            <span class="anomaly-icon">🏆</span>
                            <h3>${lang === 'id' ? 'Peringkat Kinerja Toko' : '门店业绩排行'}</h3>
                            <span class="anomaly-badge">${allStoreRanking.length}</span>
                        </div>
                        <div class="anomaly-card-body">
                            ${allStoreRanking.length === 0 ? 
                                `<div class="empty-state">
                                    <div class="empty-state-icon">📊</div>
                                    <div class="empty-state-text">${lang === 'id' ? 'Belum ada data toko' : '暂无门店数据'}</div>
                                </div>` :
                                `<div class="ranking-list">
                                    ${allStoreRanking.map((s, idx) => `
                                        <div class="ranking-item ${idx === 0 ? 'first' : idx === allStoreRanking.length - 1 ? 'last' : ''}">
                                            <div class="ranking-number">
                                                ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                                            </div>
                                            <div class="ranking-info">
                                                <span class="ranking-name">${Utils.escapeHtml(s.name)}</span>
                                                <span class="ranking-code">${Utils.escapeHtml(s.code)}</span>
                                            </div>
                                            <div class="ranking-count">
                                                ${s.count} ${lang === 'id' ? 'pesanan' : '订单'}
                                                ${idx === 0 ? ' ↑' : idx === allStoreRanking.length - 1 ? ' ↓' : ''}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>`
                            }
                        </div>
                        <div class="anomaly-card-footer">
                            <span class="info-text">💡 ${lang === 'id' ? 'Peringkat berdasarkan total pesanan (eksklusif Kantor Pusat)' : '排名基于订单总数（不含总部）'}</span>
                        </div>
                    </div>
                    
                </div>
                
                <style>
                    .anomaly-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                        align-items: stretch;
                    }
                    
                    .anomaly-card {
                        background: var(--bg-card);
                        border-radius: 12px;
                        border: 1px solid var(--border-light);
                        overflow: hidden;
                        transition: all 0.2s ease;
                        display: flex;
                        flex-direction: column;
                        min-height: auto;
                    }
                    
                    .anomaly-card:hover {
                        box-shadow: var(--shadow-md);
                    }
                    
                    .anomaly-card-header {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 14px 18px;
                        border-bottom: 1px solid var(--border-light);
                        flex-shrink: 0;
                    }
                    
                    .anomaly-icon {
                        font-size: 22px;
                    }
                    
                    .anomaly-card-header h3 {
                        flex: 1;
                        margin: 0;
                        font-size: 0.95rem;
                    }
                    
                    .anomaly-badge {
                        background: var(--primary-soft);
                        color: var(--primary-dark);
                        padding: 2px 8px;
                        border-radius: 20px;
                        font-size: 0.75rem;
                        font-weight: 600;
                    }
                    
                    .anomaly-card-danger .anomaly-badge {
                        background: #fee2e2;
                        color: #dc2626;
                    }
                    
                    .anomaly-card-warning .anomaly-badge {
                        background: #fef3c7;
                        color: #d97706;
                    }
                    
                    .anomaly-card-info .anomaly-badge {
                        background: #e0f2fe;
                        color: #0284c7;
                    }
                    
                    .anomaly-card-body {
                        padding: 14px 18px;
                        flex: 1;
                        overflow-y: auto;
                    }
                    
                    .empty-state {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 20px 16px;
                        text-align: center;
                        color: var(--text-muted);
                    }
                    
                    .empty-state-icon {
                        font-size: 32px;
                        margin-bottom: 8px;
                        opacity: 0.5;
                    }
                    
                    .empty-state-text {
                        font-size: 0.75rem;
                    }
                    
                    .anomaly-card-footer {
                        padding: 8px 16px;
                        background: var(--bg-hover);
                        border-top: 1px solid var(--border-light);
                        font-size: 0.65rem;
                        flex-shrink: 0;
                    }
                    
                    .anomaly-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 0.7rem;
                    }
                    
                    .anomaly-table th,
                    .anomaly-table td {
                        padding: 6px 4px;
                        text-align: left;
                        border-bottom: 1px solid var(--border-light);
                    }
                    
                    .anomaly-table th {
                        font-weight: 600;
                        color: var(--text-secondary);
                        background: var(--bg-hover);
                    }
                    
                    .anomaly-table .order-id,
                    .anomaly-table .customer-id {
                        font-family: monospace;
                        font-weight: 600;
                    }
                    
                    .warning-text {
                        color: #dc2626;
                    }
                    
                    .info-text {
                        color: var(--text-muted);
                    }
                    
                    .store-list {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }
                    
                    .store-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 6px 10px;
                        background: var(--bg-hover);
                        border-radius: 6px;
                    }
                    
                    .store-item-info {
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .store-item-name {
                        font-weight: 600;
                        font-size: 0.8rem;
                    }
                    
                    .store-item-code {
                        font-size: 0.6rem;
                        color: var(--text-muted);
                    }
                    
                    .store-item-count {
                        font-size: 0.9rem;
                        font-weight: 700;
                    }
                    
                    .store-item-count.lowest {
                        color: #dc2626;
                    }
                    
                    .ranking-list {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }
                    
                    .ranking-item {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 6px 8px;
                        background: var(--bg-hover);
                        border-radius: 6px;
                    }
                    
                    .ranking-number {
                        font-size: 0.9rem;
                        min-width: 35px;
                    }
                    
                    .ranking-info {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                    }
                    
                    .ranking-name {
                        font-weight: 600;
                        font-size: 0.8rem;
                    }
                    
                    .ranking-code {
                        font-size: 0.6rem;
                        color: var(--text-muted);
                    }
                    
                    .ranking-count {
                        font-size: 0.8rem;
                        font-weight: 700;
                        text-align: right;
                    }
                    
                    .ranking-item.first {
                        background: #fef3c7;
                        border-left: 3px solid #f59e0b;
                    }
                    
                    .ranking-item.last {
                        background: #fee2e2;
                        border-left: 3px solid #ef4444;
                    }
                    
                    @media (max-width: 768px) {
                        .anomaly-grid {
                            grid-template-columns: 1fr;
                            gap: 12px;
                        }
                    }
                </style>
            `;
            
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
