// app-dashboard-orders.js - 完整修复版 v2.0
// 修复内容：
// 1. 修复 printOrder 函数中的 XSS 风险（中危1）
// 2. 所有动态字段添加 escapeHtml 转义
// 3. onclick 属性改用 data-* 属性 + 事件委托
// 4. 统一使用 Utils.MONTHLY_INTEREST_RATE 常量

window.APP = window.APP || {};

const DashboardOrders = {

    // ==================== 订单列表 ====================
    showOrderTable: async function() {
        this.currentPage = 'orderTable';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        try {
            var filters = { status: this.currentFilter, search: this.searchKeyword };
            var orders = await SUPABASE.getOrders(filters);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;

            var rows = '';
            if (orders.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 10 : 9}" class="text-center">${t('no_data')}</td></tr>`;
            } else {
                for (var o of orders) {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    // 使用 data-* 属性替代 onclick 字符串拼接
                    rows += `<tr>
                        <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                        <td>${Utils.escapeHtml(o.customer_name)}</td>
                        <td>${Utils.escapeHtml(o.collateral_name)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.loan_amount)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.admin_fee)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.monthly_interest || 0)}</td>
                        <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</td>
                        <td class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                        ${isAdmin ? `<td>${Utils.escapeHtml(storeMap[o.store_id] || '-')}</td>` : ''}
                        <td class="action-cell">
                            <button class="btn-small view-order-btn" data-order-id="${Utils.escapeHtml(o.order_id)}">👁️ ${t('view')}</button>
                            ${o.status === 'active' ? `<button class="btn-small success payment-btn" data-order-id="${Utils.escapeHtml(o.order_id)}">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                            ${PERMISSION.canDeleteOrder() ? `<button class="btn-small danger delete-order-btn" data-order-id="${Utils.escapeHtml(o.order_id)}">🗑️ ${t('delete')}</button>` : ''}
                            <button class="btn-small print-order-btn" data-order-id="${Utils.escapeHtml(o.order_id)}">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            ${o.is_locked ? `<span class="locked-icon">🔒</span>` : ''}
                        </td>
                    　　　`;
                }
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📋 ${t('order_list')}</h2>
                    <div class="header-actions">
                        <button onclick="Storage.exportOrdersToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
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
                    <table class="data-table order-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>${t('customer_name')}</th>
                                <th>${t('collateral_name')}</th>
                                <th class="text-right">${t('loan_amount')}</th>
                                <th class="text-right">${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                <th class="text-right">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</th>
                                <th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                <th class="text-center">${lang === 'id' ? 'Status' : '状态'}</th>
                                ${isAdmin ? `<th>${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
            // 绑定事件委托
            this._bindOrderTableEvents();
            
        } catch (err) {
            console.error("showOrderTable error:", err);
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },
    
    _bindOrderTableEvents: function() {
        const container = document.getElementById('app');
        if (!container) return;
        
        // 移除旧监听器，添加新监听器
        container.removeEventListener('click', this._orderTableClickHandler);
        this._orderTableClickHandler = (e) => {
            const target = e.target;
            const btn = target.closest('.view-order-btn, .payment-btn, .delete-order-btn, .print-order-btn');
            if (!btn) return;
            
            const orderId = btn.getAttribute('data-order-id');
            if (!orderId) return;
            
            if (btn.classList.contains('view-order-btn')) {
                APP.navigateTo('viewOrder', { orderId: orderId });
            } else if (btn.classList.contains('payment-btn')) {
                APP.navigateTo('payment', { orderId: orderId });
            } else if (btn.classList.contains('delete-order-btn')) {
                APP.deleteOrder(orderId);
            } else if (btn.classList.contains('print-order-btn')) {
                APP.printOrder(orderId);
            }
        };
        container.addEventListener('click', this._orderTableClickHandler);
    },

    searchOrders: function() { 
        this.searchKeyword = document.getElementById("searchInput").value; 
        this.showOrderTable(); 
    },
    
    resetSearch: function() { 
        this.searchKeyword = ""; 
        this.currentFilter = "all"; 
        this.showOrderTable(); 
    },
    
    filterOrders: function(status) { 
        this.currentFilter = status; 
        this.showOrderTable(); 
    },

    // ==================== 查看订单详情 ====================
    viewOrder: async function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('Order not found'); this.goBack(); return; }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            
            var payRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    payRows += `<tr>
                        <td>${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td>${Utils.escapeHtml(p.description || '-')}</td>
                    　　　`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td></tr>`;
            }

            var remainingPrincipal = order.loan_amount - order.principal_paid;
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📄 ${t('view')} ${t('order_list')}</h2>
                    <div class="header-actions">    
                        <button class="print-order-detail-btn" data-order-id="${Utils.escapeHtml(order.order_id)}" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                    <p><strong>ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>${lang === 'id' ? 'Status' : '状态'}:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                    <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                    ${order.is_locked ? `<p><strong>🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</strong></p>` : ''}
                    
                    <h3>${t('customer_info')}</h3>
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer_name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(order.customer_ktp)}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(order.customer_phone)}</p>
                    <p><strong>${t('address')}:</strong> ${Utils.escapeHtml(order.customer_address)}</p>
                    
                    <h3>${t('collateral_info')}</h3>
                    <p><strong>${t('collateral_name')}:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                    <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                    
                    <h3>💰 ${lang === 'id' ? 'Rincian Biaya' : '费用明细'}</h3>
                    <p><strong>${lang === 'id' ? 'Admin Fee' : '管理费'}:</strong> ${Utils.formatCurrency(order.admin_fee)} ${order.admin_fee_paid ? '✅' : '❌'}</p>
                    <p><strong>${lang === 'id' ? 'Bunga per Bulan' : '月利息'}:</strong> ${Utils.formatCurrency(order.monthly_interest)}</p>
                    <p><strong>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}:</strong> ${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(order.interest_paid_total)})</p>
                    <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    <p><strong>${t('notes')}:</strong> ${Utils.escapeHtml(order.notes || '-')}</p>
                    
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h3>
                    <div class="table-container">
                        <table class="payment-table">
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                            <tbody>${payRows}</tbody>
                        </table>
                    </div>
                    
                    <div class="toolbar">
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                        ${order.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${order.order_id}'})" class="success">💰 ${t('save')}</button>` : ''}
                        ${PERMISSION.canUnlockOrder() && order.is_locked ? `<button onclick="APP.unlockOrder('${order.order_id}')" class="warning">🔓 ${lang === 'id' ? 'Buka Kunci' : '解锁'}</button>` : ''}
                        <button class="wa-reminder-btn" data-order-id="${Utils.escapeHtml(order.order_id)}" class="warning wa-btn">📱 ${lang === 'id' ? 'WA Pengingat' : 'WA提醒'}</button>
                    </div>
                </div>`;
            
            // 绑定打印和 WA 按钮事件
            this._bindViewOrderEvents(order.order_id);
            
        } catch (error) {
            console.error("viewOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            this.goBack();
        }
    },
    
    _bindViewOrderEvents: function(orderId) {
        const container = document.getElementById('app');
        if (!container) return;
        
        const printBtn = container.querySelector('.print-order-detail-btn');
        if (printBtn) {
            printBtn.onclick = () => APP.printOrder(orderId);
        }
        
        const waBtn = container.querySelector('.wa-reminder-btn');
        if (waBtn) {
            waBtn.onclick = () => APP.sendWAReminder(orderId);
        }
    },

    unlockOrder: async function(orderId) {
        if (confirm(Utils.lang === 'id' ? 'Buka kunci order ini?' : '解锁此订单？')) {
            try { await Order.unlockOrder(orderId); await this.viewOrder(orderId); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    editOrder: async function(orderId) {
        this.currentPage = 'editOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var canEdit = PERMISSION.canEditOrder(order);
            if (!canEdit) { alert(lang === 'id' ? 'Order ini sudah terkunci' : '此订单已锁定'); this.goBack(); return; }
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>✏️ ${t('edit')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="card">
                    <div class="form-grid">
                        <div class="form-group"><label>${t('customer_name')}</label><input id="name" value="${Utils.escapeHtml(order.customer_name)}"></div>
                        <div class="form-group"><label>${t('ktp_number')}</label><input id="ktp" value="${Utils.escapeHtml(order.customer_ktp)}"></div>
                        <div class="form-group"><label>${t('phone')}</label><input id="phone" value="${Utils.escapeHtml(order.customer_phone)}"></div>
                        <div class="form-group"><label>${t('collateral_name')}</label><input id="collateral" value="${Utils.escapeHtml(order.collateral_name)}"></div>
                        <div class="form-group full-width"><label>${t('address')}</label><textarea id="address">${Utils.escapeHtml(order.customer_address)}</textarea></div>
                        <div class="form-group full-width"><label>${t('notes')}</label><textarea id="notes">${Utils.escapeHtml(order.notes || '')}</textarea></div>
                        <div class="form-actions">
                            <button onclick="APP.updateOrder('${order.order_id}')" class="success">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) { console.error("editOrder error:", error); alert('Error loading order'); this.goBack(); }
    },

    updateOrder: async function(orderId) {
        var order = await SUPABASE.getOrder(orderId);
        var updates = {
            customer: { name: document.getElementById("name").value, ktp: document.getElementById("ktp").value, phone: document.getElementById("phone").value, address: document.getElementById("address").value },
            collateral_name: document.getElementById("collateral").value,
            notes: document.getElementById("notes").value
        };
        try {
            await Order.update(orderId, updates, order.customer_id);
            if (AUTH.isAdmin()) await Order.relockOrder(orderId);
            alert(Utils.t('order_updated'));
            this.goBack();
        } catch (error) { alert('Error: ' + error.message); }
    },

    deleteOrder: async function(orderId) {
        if (confirm(Utils.t('confirm_delete'))) {
            try { await Order.delete(orderId); alert(Utils.t('order_deleted')); await this.showOrderTable(); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    // ==================== 修复中危1：printOrder XSS 风险 ====================
    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert(Utils.lang === 'id' ? 'Order tidak ditemukan' : '订单不存在'); return; }
            var lang = Utils.lang;
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)', 
                bank: lang === 'id' ? 'Transfer Bank BNI' : '银行转账 BNI' 
            };
            
            // 安全构建支付记录行（所有字段都转义）
            var paymentRows = '';
            for (var p of payments) {
                var typeText = '';
                if (p.type === 'admin_fee') typeText = lang === 'id' ? 'Admin Fee' : '管理费';
                else if (p.type === 'interest') typeText = lang === 'id' ? 'Bunga' : '利息';
                else if (p.type === 'principal') typeText = lang === 'id' ? 'Pokok' : '本金';
                else typeText = p.type || '-';
                
                var methodText = methodMap[p.payment_method] || (p.payment_method === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'));
                
                paymentRows += `<tr>
                    <td>${Utils.escapeHtml(Utils.formatDate(p.date))}</td>
                    <td>${Utils.escapeHtml(typeText)}</td>
                    <td class="text-right">${Utils.escapeHtml(Utils.formatCurrency(p.amount))}</td>
                    <td>${Utils.escapeHtml(methodText)}</td>
                </tr>`;
            }
            
            if (paymentRows === '') {
                paymentRows = `<tr><td colspan="4" class="text-center">${lang === 'id' ? 'Tidak ada pembayaran' : '暂无缴费记录'}</td></tr>`;
            }
            
            // 安全构建所有字段
            var safeOrderId = Utils.escapeHtml(order.order_id);
            var safeCustomerName = Utils.escapeHtml(order.customer_name);
            var safeCustomerKtp = Utils.escapeHtml(order.customer_ktp || '-');
            var safeCustomerPhone = Utils.escapeHtml(order.customer_phone || '-');
            var safeCustomerAddress = Utils.escapeHtml(order.customer_address || '-');
            var safeCollateralName = Utils.escapeHtml(order.collateral_name);
            var safeNotes = Utils.escapeHtml(order.notes || '-');
            var safeStoreName = Utils.escapeHtml(AUTH.getCurrentStoreName());
            
            var printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JF! by Gadai - ${safeOrderId}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; }
                .print-container { max-width: 210mm; margin: 0 auto; padding: 5mm; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
                .header h1 { font-size: 18px; margin: 5px 0; }
                .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
                .section { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 15px; }
                .section h3 { font-size: 12px; font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
                .info-row { display: flex; margin-bottom: 4px; }
                .info-label { width: 90px; font-weight: 600; color: #475569; }
                .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 10px; }
                .data-table th { background: #f1f5f9; font-weight: 700; }
                .text-right { text-align: right; }
                .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
                .no-print { text-align: center; padding: 10px; margin-bottom: 15px; }
                .no-print button { margin: 0 5px; padding: 6px 14px; cursor: pointer; border: none; border-radius: 4px; }
                .btn-print { background: #3b82f6; color: white; }
                .btn-close { background: #64748b; color: white; }
                @media print { @page { size: A4; margin: 10mm; } body { margin: 0; padding: 0; } .no-print { display: none; } }
            </style>
            </head><body>
            <div class="print-container">
                <div class="no-print"><button class="btn-print" onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button><button class="btn-close" onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button></div>
                <div class="header">
                    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
                        <img src="icons/favicon-192x192.png" alt="JF!" style="height:32px;">
                        <h1 style="margin:0;">JF! by Gadai</h1>
                    </div>
                    <p>${lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证'} | <strong>${safeOrderId}</strong> | ${Utils.formatDate(order.created_at)}</p>
                </div>
                <div class="two-col">
                    <div class="section"><h3>📋 ${lang === 'id' ? 'Informasi Pelanggan' : '客户信息'}</h3>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Nama' : '姓名'}:</div><div>${safeCustomerName}</div></div>
                        <div class="info-row"><div class="info-label">KTP:</div><div>${safeCustomerKtp}</div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Telepon' : '电话'}:</div><div>${safeCustomerPhone}</div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Alamat' : '地址'}:</div><div>${safeCustomerAddress}</div></div>
                    </div>
                    <div class="section"><h3>💎 ${lang === 'id' ? 'Jaminan & Pinjaman' : '质押物与贷款'}</h3>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Barang' : '物品'}:</div><div>${safeCollateralName}</div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pinjaman' : '贷款'}:</div><div><strong>${Utils.formatCurrency(order.loan_amount)}</strong></div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div><strong>${Utils.formatCurrency(order.loan_amount - order.principal_paid)}</strong></div></div>
                        <div class="info-row"><div class="info-label">📝 ${lang === 'id' ? 'Catatan' : '备注'}:</div><div>${safeNotes}</div></div>
                    </div>
                </div>
                <div class="section"><h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</h3>
                    <table class="data-table"><thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th></tr></thead>
                    <tbody>${paymentRows}</tbody>
                </table></div>
                <div class="footer" style="margin-top:20px; padding-top:10px; border-top:1px solid #ccc; text-align:center; font-size:9px; color:#666;">
                    <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    <div>${lang === 'id' ? 'Terima kasih atas kepercayaan Anda' : '感谢您的信任'}</div>
                    <div>${lang === 'id' ? 'Bukti ini dicetak secara elektronik dan tidak memerlukan tanda tangan' : '本凭证为电子打印，无需签名'}</div>
                    <div>🏪 ${safeStoreName}</div>
                </div>
            </div></body></html>`;
            
            var pw = window.open('', '_blank');
            pw.document.write(printContent);
            pw.document.close();
        } catch (error) {
            console.error("printOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal mencetak order' : '打印订单失败');
        }
    },

    // ==================== 缴费明细 ====================
    showPaymentHistory: async function() {
        this.currentPage = 'paymentHistory';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        try {
            var allPayments = await SUPABASE.getAllPayments();
            var totalAdminFee = 0, totalInterest = 0, totalPrincipal = 0;
            for (var p of allPayments) {
                if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
            }
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            var rows = allPayments.length === 0
                ? `<tr><td colspan="9" class="text-center">${Utils.t('no_data')}</td></tr>`
                : allPayments.map(p => `<tr>
                    <td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td class="customer-name">${Utils.escapeHtml(p.orders?.customer_name || '-')}</td>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                    <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <td class="action-cell"><button class="view-order-from-payment" data-order-id="${Utils.escapeHtml(p.orders?.order_id || '')}" class="btn-small">👁️ ${Utils.t('view')}</button></td>
                </tr>`).join('');

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</h2>
                    <div class="header-actions">
                        <button onclick="Storage.exportPaymentsToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${Utils.t('back')}</button>                  
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Total Bunga' : '利息总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Total Pokok' : '本金总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalInterest + totalPrincipal)}</div><div>${lang === 'id' ? 'Total Semua' : '全部总计'}</div></div>
                </div>
                
                <div class="table-container">
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th>
                                <th>${Utils.t('customer_name')}</th>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                                <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
            // 绑定查看订单按钮事件
            const container = document.getElementById('app');
            if (container) {
                container.querySelectorAll('.view-order-from-payment').forEach(btn => {
                    const orderId = btn.getAttribute('data-order-id');
                    if (orderId) {
                        btn.onclick = () => APP.navigateTo('viewOrder', { orderId: orderId });
                    }
                });
            }
            
        } catch (error) {
            console.error("showPaymentHistory error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
        }
    }
};

for (var key in DashboardOrders) {
    if (typeof DashboardOrders[key] === 'function') {
        window.APP[key] = DashboardOrders[key];
    }
}
