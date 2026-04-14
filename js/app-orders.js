// ==================== 订单管理模块 ====================

window.APP_ORDERS = {
    showOrderTable: async function() {
        window.APP.currentPage = 'orderTable';
        window.APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        try {
            var filters = { status: window.APP.currentFilter, search: window.APP.searchKeyword };
            var orders = await SUPABASE.getOrders(filters);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;

            var rows = '';
            if (orders.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 10 : 9}" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
            } else {
                for (var o of orders) {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    rows += `<tr>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(o.order_id)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(o.customer_name)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(o.collateral_name)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(o.loan_amount)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(o.admin_fee)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(o.monthly_interest || 0)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${o.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                        ${isAdmin ? `<td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(storeMap[o.store_id] || '-')}</td>` : ''}
                        <td style="border:1px solid #cbd5e1;padding:8px;white-space:nowrap;">
                            <button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})" style="padding:4px 8px;font-size:12px;">👁️ ${t('view')}</button>
                            ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})" style="padding:4px 8px;font-size:12px;">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                            ${PERMISSION.canDeleteOrder() ? `<button class="danger" onclick="APP_ORDERS.deleteOrder('${o.order_id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>` : ''}
                            <button onclick="APP_ORDERS.printOrder('${o.order_id}')" class="success" style="padding:4px 8px;font-size:12px;">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            ${o.is_locked ? `<span style="font-size:12px;color:#94a3b8;margin-left:4px;">🔒</span>` : ''}
                        </td>
                    </tr>`;
                }
            }

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📋 ${t('order_list')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="toolbar">
                    <input type="text" id="searchInput" placeholder="🔍 ${t('search')}..." style="max-width:300px;" value="${Utils.escapeHtml(window.APP.searchKeyword)}">
                    <button onclick="APP_ORDERS.searchOrders()">${t('search')}</button>
                    <button onclick="APP_ORDERS.resetSearch()">${t('reset')}</button>
                    <select id="statusFilter" onchange="APP_ORDERS.filterOrders(this.value)">
                        <option value="all" ${window.APP.currentFilter === 'all' ? 'selected' : ''}>${t('total_orders')}</option>
                        <option value="active" ${window.APP.currentFilter === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${window.APP.currentFilter === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                    <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                </div>
                <div class="table-container">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:10px;">ID</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${t('customer_name')}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${t('collateral_name')}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${t('loan_amount')}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Status' : '状态'}</th>
                                ${isAdmin ? `<th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } catch (err) {
            console.error("showOrderTable error:", err);
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },

    searchOrders: function() { 
        window.APP.searchKeyword = document.getElementById("searchInput").value; 
        this.showOrderTable(); 
    },
    
    resetSearch: function() { 
        window.APP.searchKeyword = ""; 
        window.APP.currentFilter = "all"; 
        this.showOrderTable(); 
    },
    
    filterOrders: function(status) { 
        window.APP.currentFilter = status; 
        this.showOrderTable(); 
    },

    viewOrder: async function(orderId) {
        window.APP.currentPage = 'viewOrder';
        window.APP.currentOrderId = orderId;
        window.APP.saveCurrentPageState();
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('Order not found'); window.APP.goBack(); return; }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            
            var payRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    payRows += `<tr>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatDate(p.date)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${typeText}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(p.amount)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            } else {
                payRows = `<tr><td colspan="5" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
            }

            var remainingPrincipal = order.loan_amount - order.principal_paid;
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📄 ${t('view')} ${t('order_list')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
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
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '支付记录'}</h3>
                    <div class="table-container">
                        <table class="payment-table" style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Jenis' : '类型'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Bulan' : '月数'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                </tr>
                            </thead>
                            <tbody>${payRows}</tbody>
                        </table>
                    </div>
                    <div class="toolbar">
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                        ${order.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${order.order_id}'})">💰 ${t('save')}</button>` : ''}
                        ${PERMISSION.canUnlockOrder() && order.is_locked ? `<button onclick="APP_ORDERS.unlockOrder('${order.order_id}')">🔓 ${lang === 'id' ? 'Buka Kunci' : '解锁'}</button>` : ''}
                        <button onclick="APP_ORDERS.printOrder('${order.order_id}')" class="success">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>
                </div>`;
        } catch (error) {
            console.error("viewOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            window.APP.goBack();
        }
    },

    unlockOrder: async function(orderId) {
        if (confirm(Utils.lang === 'id' ? 'Buka kunci order ini?' : '解锁此订单？')) {
            try { 
                await Order.unlockOrder(orderId); 
                await this.viewOrder(orderId); 
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    deleteOrder: async function(orderId) {
        if (confirm(Utils.t('confirm_delete'))) {
            try { 
                await Order.delete(orderId); 
                alert(Utils.t('order_deleted')); 
                await this.showOrderTable(); 
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    editOrder: async function(orderId) {
        window.APP.currentPage = 'editOrder';
        window.APP.currentOrderId = orderId;
        window.APP.saveCurrentPageState();
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var canEdit = PERMISSION.canEditOrder(order);
            if (!canEdit) { alert(lang === 'id' ? 'Order ini sudah terkunci' : '此订单已锁定'); window.APP.goBack(); return; }
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>✏️ ${t('edit')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
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
                            <button onclick="APP_ORDERS.updateOrder('${order.order_id}')">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) { 
            console.error("editOrder error:", error);
            alert('Error loading order'); 
            window.APP.goBack(); 
        }
    },

    updateOrder: async function(orderId) {
        var order = await SUPABASE.getOrder(orderId);
        var updates = {
            customer: { 
                name: document.getElementById("name").value, 
                ktp: document.getElementById("ktp").value, 
                phone: document.getElementById("phone").value, 
                address: document.getElementById("address").value 
            },
            collateral_name: document.getElementById("collateral").value,
            notes: document.getElementById("notes").value
        };
        try {
            await Order.update(orderId, updates, order.customer_id);
            if (AUTH.isAdmin()) await Order.relockOrder(orderId);
            alert(Utils.t('order_updated'));
            window.APP.goBack();
        } catch (error) { 
            alert('Error: ' + error.message); 
        }
    },

    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert(Utils.lang === 'id' ? 'Order tidak ditemukan' : '订单不存在'); return; }
            var lang = Utils.lang;
            var totalPrincipalPaid = payments.filter(p => p.type === 'principal').reduce((s, p) => s + p.amount, 0);
            var totalInterestPaid = payments.filter(p => p.type === 'interest').reduce((s, p) => s + p.amount, 0);
            var totalAdminFeePaid = payments.filter(p => p.type === 'admin_fee').reduce((s, p) => s + p.amount, 0);
            
            var printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print - ${order.order_id}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; padding: 12mm 14mm; }
                .header { text-align: center; margin-bottom: 8px; border-bottom: 2px solid #1e293b; padding-bottom: 6px; }
                .header h1 { font-size: 16px; margin-bottom: 2px; }
                .header p { font-size: 11px; color: #475569; margin: 1px 0; }
                .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
                .section { border: 1px solid #cbd5e1; border-radius: 4px; padding: 7px 10px; }
                .section h3 { font-size: 11px; font-weight: 700; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
                .info-row { display: flex; margin-bottom: 3px; }
                .info-label { width: 90px; font-weight: 600; color: #475569; flex-shrink: 0; }
                .info-value { flex: 1; }
                .table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                .table th, .table td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-size: 10px; }
                .table th { background: #f1f5f9; font-weight: 700; }
                .table tr:nth-child(even) { background: #f8fafc; }
                .remarks { margin-top: 8px; padding: 6px 10px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 0 4px 4px 0; font-size: 10px; line-height: 1.5; }
                .remarks h4 { font-size: 10px; font-weight: 700; margin-bottom: 3px; color: #92400e; }
                .remarks p { margin: 1px 0; color: #78350f; }
                .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 5px; }
                .no-print { text-align: center; padding: 10px; background: #f1f5f9; margin-bottom: 10px; border-radius: 6px; }
                .no-print button { margin: 0 5px; padding: 6px 14px; cursor: pointer; border: none; border-radius: 4px; font-size: 13px; }
                .btn-print { background: #3b82f6; color: white; }
                .btn-close { background: #64748b; color: white; }
                @media print {
                    .no-print { display: none; }
                    body { padding: 8mm 10mm; }
                }
            </style>
            </head><body>
            <div class="no-print">
                <button class="btn-print" onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                <button class="btn-close" onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
            </div>
            <div class="header">
                <h1><img src="/icons/system-jf.png" alt="JF!" style="height: 24px; vertical-align: middle;"> JF! by Gadai</h1>
                <p>${lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证'} &nbsp;|&nbsp; <strong>${order.order_id}</strong> &nbsp;|&nbsp; ${Utils.formatDate(order.created_at)}</p>
            </div>
            <div class="two-col">
                <div class="section">
                    <h3>📋 ${lang === 'id' ? 'Informasi Pelanggan' : '客户信息'}</h3>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Nama' : '姓名'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_name)}</div></div>
                    <div class="info-row"><div class="info-label">KTP:</div><div class="info-value">${Utils.escapeHtml(order.customer_ktp || '-')}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Telepon' : '电话'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_phone || '-')}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Alamat' : '地址'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_address || '-')}</div></div>
                </div>
                <div class="section">
                    <h3>💎 ${lang === 'id' ? 'Jaminan & Pinjaman' : '质押物与贷款'}</h3>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Barang' : '物品'}:</div><div class="info-value">${Utils.escapeHtml(order.collateral_name)}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pinjaman' : '贷款'}:</div><div class="info-value"><strong>${Utils.formatCurrency(order.loan_amount)}</strong></div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div class="info-value"><strong>${Utils.formatCurrency(order.loan_amount - order.principal_paid)}</strong></div></div>
                    <div class="info-row"><div class="info-label">Admin Fee:</div><div class="info-value">${Utils.formatCurrency(totalAdminFeePaid)} ${order.admin_fee_paid ? '✅' : '❌'}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Bunga/Bln' : '月利息'}:</div><div class="info-value">${Utils.formatCurrency(order.monthly_interest || 0)}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Bunga Lunas' : '已付利息'}:</div><div class="info-value">${Utils.formatCurrency(totalInterestPaid)}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pokok Lunas' : '已还本金'}:</div><div class="info-value">${Utils.formatCurrency(totalPrincipalPaid)}</div></div>
                </div>
            </div>
            <div class="section">
                <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款明细'}</h3>
                <table class="table"><thead><tr>
                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                    <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                    <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                    <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                </tr></thead><tbody>`;
            
            if (payments.length === 0) {
                printContent += `<tr><td colspan="5" style="text-align:center;color:#94a3b8;">${lang === 'id' ? 'Belum ada pembayaran' : '暂无付款记录'}</td></tr>`;
            } else {
                for (var p of payments) {
                    var tt = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    printContent += `<tr><td style="border:1px solid #cbd5e1;padding:4px 6px;">${Utils.formatDate(p.date)}</td><td style="border:1px solid #cbd5e1;padding:4px 6px;">${tt}</td><td style="border:1px solid #cbd5e1;padding:4px 6px;">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 月') : '-'}</td><td style="border:1px solid #cbd5e1;padding:4px 6px;">${Utils.formatCurrency(p.amount)}</td><td style="border:1px solid #cbd5e1;padding:4px 6px;">${Utils.escapeHtml(p.description || '-')}</td></tr>`;
                }
            }
            
            printContent += `
                </tbody></table>
            </div>
            <div class="remarks">
                <h4>📌 ${lang === 'id' ? 'Penting' : '重要提示'}:</h4>
                <p>1. Peminjam wajib membayar sewa modal setiap bulan tepat waktu. Pembayaran memperpanjang pinjaman 1 bulan.</p>
                <p>2. Jika tidak membayar dan pinjaman belum lunas, Pemberi Pinjaman berhak menjual barang jaminan.</p>
                <p>3. Keterlambatan lebih dari 7 hari dikenakan denda 5% per bulan. Lebih dari 30 hari, barang langsung dijual.</p>
            </div>
            <div class="footer">${lang === 'id' ? 'Dicetak pada' : '打印时间'}: ${new Date().toLocaleString()} &nbsp;|&nbsp; © JF! by Gadai</div>
            </body></html>`;
            
            var pw = window.open('', '_blank');
            pw.document.write(printContent);
            pw.document.close();
        } catch (error) {
            console.error("printOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal mencetak order' : '打印订单失败');
        }
    },

    showCreateOrder: function() {
        alert('Please select a customer first');
        window.APP.navigateTo('customers');
    }
};

// 将订单管理方法挂载到 APP 对象
window.APP.showOrderTable = APP_ORDERS.showOrderTable.bind(APP_ORDERS);
window.APP.searchOrders = APP_ORDERS.searchOrders.bind(APP_ORDERS);
window.APP.resetSearch = APP_ORDERS.resetSearch.bind(APP_ORDERS);
window.APP.filterOrders = APP_ORDERS.filterOrders.bind(APP_ORDERS);
window.APP.viewOrder = APP_ORDERS.viewOrder.bind(APP_ORDERS);
window.APP.unlockOrder = APP_ORDERS.unlockOrder.bind(APP_ORDERS);
window.APP.deleteOrder = APP_ORDERS.deleteOrder.bind(APP_ORDERS);
window.APP.editOrder = APP_ORDERS.editOrder.bind(APP_ORDERS);
window.APP.updateOrder = APP_ORDERS.updateOrder.bind(APP_ORDERS);
window.APP.printOrder = APP_ORDERS.printOrder.bind(APP_ORDERS);
window.APP.showCreateOrder = APP_ORDERS.showCreateOrder.bind(APP_ORDERS);
