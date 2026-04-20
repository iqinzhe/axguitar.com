// app-dashboard-orders.js - v2.3（移除搜索功能版）

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
            var filters = { status: this.currentFilter, search: '' };
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
                    `;
                    
                    rows += `
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
            .order-double-row-table {
                width: 100%;
                border-collapse: collapse;
            }
            .order-double-row-table th {
                padding: 10px 12px;
                background: var(--gray-100);
                font-weight: 600;
                text-align: left;
            }
            .order-info-row {
                border-top: 1px solid var(--gray-200);
            }
            .order-info-row td {
                padding: 12px 12px 6px 12px;
                border-bottom: none;
            }
            .order-action-row td {
                padding: 6px 12px 12px 12px;
                border-bottom: 1px solid var(--gray-200);
            }
            .order-cell {
                width: 100%;
            }
            .action-cell {
                width: 100%;
            }
            .action-cell .btn-small {
                margin-right: 8px;
                margin-bottom: 4px;
            }
            .order-info {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .order-line1 {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 12px;
                row-gap: 4px;
            }
            .order-line2 {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 16px;
                row-gap: 4px;
                font-size: 0.75rem;
                color: var(--gray-500);
            }
            .order-id {
                font-family: monospace;
                font-weight: 600;
                color: var(--primary-dark);
                background: var(--primary-soft);
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
            }
            .order-customer {
                font-weight: 500;
                color: var(--gray-800);
            }
            .order-collateral::before {
                content: "💎";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            .order-amount::before {
                content: "💰";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            .order-interest::before {
                content: "📈";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            .order-paid::before {
                content: "✅";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            .order-store::before {
                content: "🏪";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            .order-line1 span,
            .order-line2 span {
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                white-space: normal;
                word-break: break-word;
            }
            @media (max-width: 768px) {
                .order-line1 { gap: 8px; }
                .order-line2 { gap: 8px; flex-direction: column; align-items: flex-start; }
                .action-cell .btn-small { display: inline-block; margin: 4px 4px 4px 0; }
                .order-line1 span, .order-line2 span { max-width: 150px; }
            }
            @media (max-width: 480px) {
                .order-line1 span, .order-line2 span { max-width: 100%; }
            }
        `;
        document.head.appendChild(style);
    },
    
    _bindOrderTableEvents: function() {
        const container = document.getElementById('app');
        if (!container) return;
        
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

    // 只保留状态筛选，移除搜索相关方法
    filterOrders: function(status) { 
        this.currentFilter = status; 
        this.showOrderTable(); 
    },

    viewOrder: async function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('Order not found'); this.goBack(); return; }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            
            var payRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'service_fee' ? (lang === 'id' ? 'Service Fee' : '服务费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    payRows += `<tr>
                        <td>${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <\/tr>`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}<\/td><\/tr>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📄 ${t('view')} ${t('order_list')}</h2>
                    <div class="header-actions">    
                        <button class="print-order-detail-btn" data-order-id="${Utils.escapeAttr(order.order_id)}" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                    <p><strong>ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>${lang === 'id' ? 'Status' : '状态'}:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                    <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                    
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
                    <p><strong>${lang === 'id' ? 'Service Fee' : '服务费'}:</strong> ${Utils.formatCurrency(order.service_fee_amount || 0)} (${order.service_fee_percent || 0}%) ${order.service_fee_paid > 0 ? '✅' : '❌'}</p>
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
                        ${order.status === 'active' && !isAdmin ? `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeAttr(order.order_id)}'})" class="success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                        ${order.status === 'completed' ? `<button onclick="APP.printSettlementReceipt('${Utils.escapeAttr(order.order_id)}')" class="success">🧾 ${lang === 'id' ? 'Cetak Bukti Lunas' : '打印结清凭证'}</button>` : ''}
                        <button class="wa-reminder-btn" data-order-id="${Utils.escapeAttr(order.order_id)}" class="warning wa-btn">📱 ${lang === 'id' ? 'WA Pengingat' : 'WA提醒'}</button>
                    </div>
                </div>`;
            
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

    deleteOrder: async function(orderId) {
        var lang = Utils.lang;
        
        try {
            const order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(lang === 'id' ? '订单不存在' : '订单不存在');
                return;
            }
            
            const confirmMsg = lang === 'id'
                ? `⚠️ 确认删除订单？\n\n订单号: ${order.order_id}\n客户: ${order.customer_name}\n贷款金额: ${Utils.formatCurrency(order.loan_amount)}\n状态: ${order.status}\n\n此操作不可恢复，所有相关缴费记录也将被删除。\n\n确定要删除吗？`
                : `⚠️ 确认删除订单？\n\n订单号: ${order.order_id}\n客户: ${order.customer_name}\n贷款金额: ${Utils.formatCurrency(order.loan_amount)}\n状态: ${order.status}\n\n此操作不可恢复，所有相关缴费记录也将被删除。\n\n确定要删除吗？`;
            
            if (!confirm(confirmMsg)) return;
            
            const finalConfirm = lang === 'id'
                ? '最后确认：真的要删除此订单吗？此操作无法撤销。'
                : '最后确认：真的要删除此订单吗？此操作无法撤销。';
            
            if (!confirm(finalConfirm)) return;
            
            await Order.delete(orderId);
            
            if (window.Audit) {
                await window.Audit.log('order_delete', JSON.stringify({
                    order_id: order.order_id,
                    customer_name: order.customer_name,
                    loan_amount: order.loan_amount,
                    deleted_by: AUTH.user?.id,
                    deleted_at: new Date().toISOString()
                }));
            }
            
            alert(Utils.t('order_deleted'));
            await this.showOrderTable();
        } catch (error) {
            console.error("deleteOrder error:", error);
            alert(lang === 'id' ? '删除失败：' + error.message : '删除失败：' + error.message);
        }
    },

    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert(Utils.lang === 'id' ? 'Order tidak ditemukan' : '订单不存在'); return; }
            var lang = Utils.lang;
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)', 
                bank: lang === 'id' ? 'Transfer Bank BNI' : '银行转账 BNI' 
            };
            
            var paymentRows = '';
            for (var p of payments) {
                var typeText = '';
                if (p.type === 'admin_fee') typeText = lang === 'id' ? 'Admin Fee' : '管理费';
                else if (p.type === 'service_fee') typeText = lang === 'id' ? 'Service Fee' : '服务费';
                else if (p.type === 'interest') typeText = lang === 'id' ? 'Bunga' : '利息';
                else if (p.type === 'principal') typeText = lang === 'id' ? 'Pokok' : '本金';
                else typeText = p.type || '-';
                
                var methodText = methodMap[p.payment_method] || (p.payment_method === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'));
                
                paymentRows += `<tr>
                    <td>${Utils.escapeHtml(Utils.formatDate(p.date))}</td>
                    <td>${Utils.escapeHtml(typeText)}</td>
                    <td class="text-right">${Utils.escapeHtml(Utils.formatCurrency(p.amount))}</td>
                    <td>${Utils.escapeHtml(methodText)}</td>
                <\/tr>`;
            }
            
            if (paymentRows === '') {
                paymentRows = `<tr><td colspan="4" class="text-center">${lang === 'id' ? 'Tidak ada pembayaran' : '暂无缴费记录'}<\/td><\/tr>`;
            }
            
            var safeOrderId = Utils.escapeHtml(order.order_id);
            var safeCustomerName = Utils.escapeHtml(order.customer_name);
            var safeCustomerKtp = Utils.escapeHtml(order.customer_ktp || '-');
            var safeCustomerPhone = Utils.escapeHtml(order.customer_phone || '-');
            var safeCustomerAddress = Utils.escapeHtml(order.customer_address || '-');
            var safeCollateralName = Utils.escapeHtml(order.collateral_name);
            var safeNotes = Utils.escapeHtml(order.notes || '-');
            var safeStoreName = Utils.escapeHtml(AUTH.getCurrentStoreName());
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            
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
                    <img src="icons/pagehead-logo.png" alt="JF!" style="height:32px;">
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
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div><strong>${Utils.formatCurrency(remainingPrincipal)}</strong></div></div>
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

    showPaymentHistory: async function() {
        this.currentPage = 'paymentHistory';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        try {
            var allPayments = await SUPABASE.getAllPayments();
            var totalAdminFee = 0, totalServiceFee = 0, totalInterest = 0, totalPrincipal = 0;
            for (var p of allPayments) {
                if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'service_fee') totalServiceFee += p.amount;
                else if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
            }
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', service_fee: lang === 'id' ? 'Service Fee' : '服务费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            var rows = allPayments.length === 0
                ? `<tr><td colspan="9" class="text-center">${Utils.t('no_data')}<\/td><\/tr>`
                : allPayments.map(p => `<tr>
                    <td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td class="customer-name">${Utils.escapeHtml(p.orders?.customer_name || '-')}</td>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                    <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <td class="action-cell"><button class="view-order-from-payment" data-order-id="${Utils.escapeAttr(p.orders?.order_id || '')}" class="btn-small">👁️ ${Utils.t('view')}</button></td>
                <\/tr>`).join('');

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${Utils.t('back')}</button>                  
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalServiceFee)}</div><div>${lang === 'id' ? 'Service Fee' : '服务费'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Bunga' : '利息'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Pokok' : '本金'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal)}</div><div>${lang === 'id' ? 'Total Semua' : '全部总计'}</div></div>
                </div>
                
                <div class="table-container">
                    <table class="payment-table">
                        <thead>
                            <tr><th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th><th>${Utils.t('customer_name')}</th><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th><th>${lang === 'id' ? 'Aksi' : '操作'}</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
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

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

for (var key in DashboardOrders) {
    if (typeof DashboardOrders[key] === 'function') {
        window.APP[key] = DashboardOrders[key];
    }
}

if (!Utils.escapeAttr) {
    Utils.escapeAttr = escapeAttr;
}

console.log('✅ app-dashboard-orders.js v2.3 已加载 - 移除搜索功能');
