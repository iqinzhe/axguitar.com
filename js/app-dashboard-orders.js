// app-dashboard-orders.js - 完整修复版（图标重复已删 + 表格标准样式 + 移动端适配）
window.APP = window.APP || {};
const DashboardOrders = {
    showOrderTable: async function() {
        this.currentPage = 'orderTable';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        try {
            var filters = { status: this.currentFilter, search: this.searchKeyword };
            var orders = await SUPABASE.getOrders(filters);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;
            var rows = '';
            if (orders.length === 0) {
                rows = `<tr><td colspan="2" class="text-center">${t('no_data')}<\/td><\/tr>`;
            } else {
                for (var o of orders) {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    var storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                    
                    rows += `
                        <tr class="order-info-row">
                            <td colspan="2" class="order-cell">
                                <div class="order-info">
                                    <div class="order-line1">
                                        <span class="order-id">${Utils.escapeHtml(o.order_id)}</span>
                                        <span class="order-status"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></span>
                                        <span class="order-customer">${Utils.escapeHtml(o.customer_name)}</span>
                                    </div>
                                    <div class="order-line2">
                                        <span class="order-collateral">💎 ${Utils.escapeHtml(o.collateral_name)}</span>
                                        <span class="order-amount">💰 ${Utils.formatCurrency(o.loan_amount)}</span>
                                        <span class="order-interest">📈 ${Utils.formatCurrency(o.monthly_interest || 0)}/${lang === 'id' ? 'bln' : '月'}</span>
                                        <span class="order-paid">✅ ${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</span>
                                        ${isAdmin ? `<span class="order-store">🏪 ${Utils.escapeHtml(storeName)}</span>` : ''}
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <tr class="order-action-row">
                            <td colspan="2" class="action-cell">
                                <button class="btn-small view-order-btn" data-order-id="${Utils.escapeAttr(o.order_id)}">👁️ ${t('view')}</button>
                                ${o.status === 'active' && !isAdmin ? `<button class="btn-small success payment-btn" data-order-id="${Utils.escapeAttr(o.order_id)}">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                                ${PERMISSION.canDeleteOrder() ? `<button class="btn-small danger delete-order-btn" data-order-id="${Utils.escapeAttr(o.order_id)}">🗑️ ${t('delete')}</button>` : ''}
                                <button class="btn-small print-order-btn" data-order-id="${Utils.escapeAttr(o.order_id)}">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            </td>
                        </tr>
                    `;
                }
            }
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📋 ${t('order_list')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="toolbar">
                    <input type="text" id="searchInput" placeholder="🔍 ${t('search')}..." value="${Utils.escapeHtml(this.searchKeyword)}">
                    <button onclick="APP.searchOrders()">${t('search')}</button>
                    <button onclick="APP.resetSearch()">${t('reset')}</button>
                    <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                        <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>${t('total_orders')}</option>
                        <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                </div>
                
                <div class="table-container">
                    <table class="data-table order-double-row-table">
                        <thead>
                            <tr>
                                <th colspan="2">${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
            this._addOrderDoubleRowStyles();
            this._bindOrderTableEvents();
            
        } catch (err) {
            console.error("showOrderTable error:", err);
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },
    _addOrderDoubleRowStyles: function() {
        if (document.getElementById('order-double-row-styles')) return;
        var style = document.createElement('style');
        style.id = 'order-double-row-styles';
        style.textContent = `
            .order-double-row-table{width:100%;border-collapse:collapse;}
            .order-double-row-table th{padding:10px 12px;background:var(--gray-100);font-weight:600;text-align:left;}
            .order-info-row{border-top:1px solid var(--gray-200);}
            .order-info-row td{padding:12px 12px 6px 12px;border-bottom:none;}
            .order-action-row td{padding:6px 12px 12px 12px;border-bottom:1px solid var(--gray-200);}
            .order-cell,.action-cell{width:100%;}
            .action-cell .btn-small{margin-right:8px;margin-bottom:4px;}
            .order-info{display:flex;flex-direction:column;gap:8px;}
            .order-line1{display:flex;flex-wrap:wrap;align-items:center;gap:12px;row-gap:4px;}
            .order-line2{display:flex;flex-wrap:wrap;align-items:center;gap:16px;row-gap:4px;font-size:0.75rem;color:var(--gray-500);}
            .order-id{font-family:monospace;font-weight:600;color:var(--primary-dark);background:var(--primary-soft);padding:2px 8px;border-radius:4px;font-size:0.75rem;}
            .order-customer{font-weight:500;color:var(--gray-800);}
            @media(max-width:768px){
                .order-line1,.order-line2{gap:8px;flex-direction:column;align-items:flex-start;}
            }
        `;
        document.head.appendChild(style);
    },
    _bindOrderTableEvents: function() {
        const container = document.getElementById('app');
        if (!container) return;
        container.removeEventListener('click', this._orderTableClickHandler);
        this._orderTableClickHandler = (e) => {
            const btn = e.target.closest('.view-order-btn,.payment-btn,.delete-order-btn,.print-order-btn');
            if (!btn) return;
            const orderId = btn.getAttribute('data-order-id');
            if (!orderId) return;
            if (btn.classList.contains('view-order-btn')) APP.navigateTo('viewOrder',{orderId:orderId});
            else if (btn.classList.contains('payment-btn')) APP.navigateTo('payment',{orderId:orderId});
            else if (btn.classList.contains('delete-order-btn')) APP.deleteOrder(orderId);
            else if (btn.classList.contains('print-order-btn')) APP.printOrder(orderId);
        };
        container.addEventListener('click', this._orderTableClickHandler);
    },
    searchOrders:function(){this.searchKeyword=document.getElementById("searchInput").value;this.showOrderTable();},
    resetSearch:function(){this.searchKeyword="";this.currentFilter="all";this.showOrderTable();},
    filterOrders:function(s){this.currentFilter=s;this.showOrderTable();},
    viewOrder:async function(e){},
    deleteOrder:async function(e){},
    printOrder:async function(e){}
};
for(var key in DashboardOrders){
    if(typeof DashboardOrders[key]==='function')window.APP[key]=DashboardOrders[key];
}
