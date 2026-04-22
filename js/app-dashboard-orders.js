// app-dashboard-orders.js - v1.3（修复：printOrder 中 t 函数定义 + filterOrders this 绑定）

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
                rows = `<tr><td colspan="11" class="text-center">${t('no_data')}<\/td><\/tr>`;
            } else {
                for (var o of orders) {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    var storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                    
                    var nextDueDate = o.next_interest_due_date || '-';
                    var formattedDueDate = nextDueDate !== '-' ? Utils.formatDate(nextDueDate) : '-';
                    
                    var remainingPrincipalForList = (o.loan_amount || 0) - (o.principal_paid || 0);
                    var currentMonthlyInterestForList = remainingPrincipalForList * (o.agreed_interest_rate || 0.08);
                    
                    var repaymentTypeText = o.repayment_type === 'fixed' 
                        ? (lang === 'id' ? 'Tetap' : '固定')
                        : (lang === 'id' ? 'Fleksibel' : '灵活');
                    var repaymentBadge = `<span class="repayment-badge ${o.repayment_type === 'fixed' ? 'badge-fixed' : 'badge-flexible'}">${repaymentTypeText}</span>`;
                    
                    rows += `<tr>
                        <td data-label="${t('order_id')}" class="order-id">${Utils.escapeHtml(o.order_id)}<\/td>
                        <td data-label="${t('customer_name')}" class="order-customer">${Utils.escapeHtml(o.customer_name)}<\/td>
                        <td data-label="${t('collateral_name')}" class="order-collateral">${Utils.escapeHtml(o.collateral_name)}<\/td>
                        <td data-label="${t('loan_amount')}" class="text-right">${Utils.formatCurrency(o.loan_amount)}<\/td>
                        <td data-label="${lang === 'id' ? 'Bunga Bulanan' : '月利息'}" class="text-right">${Utils.formatCurrency(currentMonthlyInterestForList)}<\/td>
                        <td data-label="${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}" class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}<\/td>
                        <td data-label="${t('payment_due_date')}" class="text-center">${formattedDueDate}<\/td>
                        <td data-label="${t('repayment_type')}" class="text-center">${repaymentBadge}<\/td>
                        <td data-label="${t('status')}" class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span><\/td>
                        ${isAdmin ? `<td data-label="${t('store')}" class="text-center">${Utils.escapeHtml(storeName)}<\/td>` : ''}
                    <\/tr>
                    <tr class="action-row">
                        <td class="action-label">${lang === 'id' ? 'Aksi' : '操作'}</td>
                        <td colspan="${isAdmin ? 9 : 8}" class="action-btns">
                            ${o.status === 'active' && !isAdmin ? `<button onclick="APP.payOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                            <button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small">👁️ ${t('view')}</button>
                            <button onclick="APP.printOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small">🖨️ ${t('print')}</button>
                            ${PERMISSION.canDeleteOrder() ? `<button onclick="APP.deleteOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small danger">🗑️ ${t('delete')}</button>` : ''}
                        <\/td>
                    <\/tr>`;
                }
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📋 ${t('order_list')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${t('print')}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="toolbar">
                    <select id="statusFilter" onchange="window.APP.filterOrders(this.value)">
                        <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>${lang === 'id' ? 'Semua Pesanan' : '全部订单'}</option>
                        <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                </div>
                
                <div class="card info-card">
                    <div class="info-card-content">
                        <div class="info-icon">📌</div>
                        <div class="info-text">
                            <strong>${lang === 'id' ? 'Informasi Penting:' : '重要提示：'}</strong> ${lang === 'id' ? 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pembayaran pokok lebih awal dapat mengurangi beban bunga. Setelah lunas, sistem akan membuat tanda terima pelunasan secara otomatis.' : '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。'}
                        </div>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="data-table order-table">
                        <thead>
                            <tr>
                                <th>${t('order_id')}</th>
                                <th>${t('customer_name')}</th>
                                <th>${t('collateral_name')}</th>
                                <th class="text-right">${t('loan_amount')}</th>
                                <th class="text-right">${lang === 'id' ? 'Bunga Bulanan' : '月利息'}</th>
                                <th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                <th class="text-center">${t('payment_due_date')}</th>
                                <th class="text-center">${t('repayment_type')}</th>
                                <th class="text-center">${t('status')}</th>
                                ${isAdmin ? '<th class="text-center">' + t('store') + '</th>' : ''}
                                <th class="text-center">${t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                
                <style>
                    .order-table .order-id {
                        font-family: monospace;
                        font-weight: 600;
                        color: var(--primary-dark);
                    }
                    .order-table .order-customer {
                        font-weight: 500;
                    }
                    .order-table .order-collateral {
                        max-width: 150px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .repayment-badge {
                        display: inline-block;
                        padding: 2px 8px;
                        border-radius: 12px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .badge-fixed {
                        background: #d1fae5;
                        color: #065f46;
                    }
                    .badge-flexible {
                        background: #fed7aa;
                        color: #9a3412;
                    }
                    .info-card {
                        background: #e0f2fe;
                        border-left: 4px solid #0284c7;
                        margin-bottom: 16px;
                    }
                    .info-card-content {
                        display: flex;
                        align-items: flex-start;
                        gap: 12px;
                    }
                    .info-icon {
                        font-size: 20px;
                    }
                    .info-text {
                        flex: 1;
                        font-size: 13px;
                        color: #0c4a6e;
                        line-height: 1.4;
                    }
                    .info-text strong {
                        color: #0369a1;
                    }
                    @media (max-width: 768px) {
                        .order-table .order-collateral {
                            max-width: 100px;
                        }
                    }
                </style>`;
            
            this._addOrderTableStyles();
            
        } catch (err) {
            console.error("showOrderTable error:", err);
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },
    
    _addOrderTableStyles: function() {
        if (document.getElementById('order-table-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'order-table-styles';
        style.textContent = `
            .order-table .order-id {
                font-family: monospace;
                font-weight: 600;
                color: var(--primary-dark);
            }
            .order-table .order-customer {
                font-weight: 500;
            }
            .order-table .order-collateral {
                max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .info-card {
                background: #e0f2fe;
                border-left: 4px solid #0284c7;
                margin-bottom: 16px;
            }
            .info-card-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            .info-icon {
                font-size: 20px;
            }
            .info-text {
                flex: 1;
                font-size: 13px;
                color: #0c4a6e;
                line-height: 1.4;
            }
            .info-text strong {
                color: #0369a1;
            }
            @media (max-width: 768px) {
                .order-table .order-collateral {
                    max-width: 100px;
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    payOrder: function(orderId) {
        console.log('payOrder 被调用，订单ID:', orderId);
        if (!orderId) {
            console.error('订单ID为空');
            return;
        }
        window.APP.navigateTo('payment', { orderId: orderId });
    },

    // 修复：确保 filterOrders 正确绑定 this
    filterOrders: function(status) { 
        var self = this;
        self.currentFilter = status; 
        self.showOrderTable(); 
    },

    viewOrder: async function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { 
                alert(Utils.t('order_not_found')); 
                this.goBack(); 
                return; 
            }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var monthlyRate = order.agreed_interest_rate || 0.08;
            var currentMonthlyInterest = remainingPrincipal * monthlyRate;
            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var payRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee' ? t('admin_fee') : p.type === 'service_fee' ? t('service_fee') : p.type === 'interest' ? t('interest') : t('principal');
                    payRows += `<tr>
                        <td data-label="${t('date')}" class="date-cell">${Utils.formatDate(p.date)}<\/td>
                        <td data-label="${t('type')}">${typeText}<\/td>
                        <td data-label="${lang === 'id' ? 'Bulan' : '月数'}" class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}<\/td>
                        <td data-label="${t('amount')}" class="text-right">${Utils.formatCurrency(p.amount)}<\/td>
                        <td data-label="${lang === 'id' ? 'Metode' : '支付方式'}" class="text-center"><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span><\/td>
                        <td data-label="${t('description')}">${Utils.escapeHtml(p.description || '-')}<\/td>
                    <\/tr>`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}<\/td><\/tr>`;
            }

            var repaymentInfo = '';
            if (order.repayment_type === 'fixed') {
                var paidMonths = order.fixed_paid_months || 0;
                var totalMonths = order.repayment_term;
                var fixedPayment = order.monthly_fixed_payment || 0;
                repaymentInfo = `
                    <p><strong>${t('repayment_type')}:</strong> 📅 ${t('fixed_repayment')} (${totalMonths} ${lang === 'id' ? 'bulan' : '个月'})</p>
                    <p><strong>${t('monthly_payment')}:</strong> ${Utils.formatCurrency(fixedPayment)}</p>
                    <p><strong>${lang === 'id' ? 'Progress' : '进度'}:</strong> ${paidMonths}/${totalMonths} ${lang === 'id' ? 'bulan' : '个月'}</p>
                `;
            } else {
                repaymentInfo = `<p><strong>${t('repayment_type')}:</strong> 💰 ${t('flexible_repayment')} (${lang === 'id' ? 'Maksimal perpanjangan 10 bulan' : '最长延期10个月'})</p>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📄 ${t('order_details')}</h2>
                    <div class="header-actions">    
                        <button onclick="APP.printOrder('${Utils.escapeAttr(order.order_id)}')" class="btn-print print-btn">🖨️ ${t('print')}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>📋 ${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                    <p><strong>${t('order_id')}:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>${t('status')}:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                    <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                    ${repaymentInfo}
                    
                    <h3>👤 ${t('customer_info')}</h3>
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer_name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(order.customer_ktp)}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(order.customer_phone)}</p>
                    <p><strong>${t('address')}:</strong> ${Utils.escapeHtml(order.customer_address)}</p>
                    
                    <h3>💎 ${t('collateral_info')}</h3>
                    <p><strong>${t('collateral_name')}:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                    <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                    
                    <h3>💰 ${lang === 'id' ? 'Rincian Biaya' : '费用明细'}</h3>
                    <p><strong>${t('admin_fee')}:</strong> ${Utils.formatCurrency(order.admin_fee)} ${order.admin_fee_paid ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : '❌ ' + (lang === 'id' ? 'Belum' : '未缴')}</p>
                    <p><strong>${t('service_fee')}:</strong> ${Utils.formatCurrency(order.service_fee_amount || 0)} (${order.service_fee_percent || 0}%) ${(order.service_fee_paid || 0) >= (order.service_fee_amount || 0) && (order.service_fee_amount || 0) > 0 ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : (order.service_fee_amount || 0) === 0 ? '—' : '❌ ' + (lang === 'id' ? 'Belum' : '未缴')}</p>
                    <p><strong>${lang === 'id' ? 'Bunga Bulanan (saat ini)' : '月利息（当前）'}:</strong> ${Utils.formatCurrency(currentMonthlyInterest)} <small style="color:#64748b">（${lang === 'id' ? 'berdasarkan sisa pokok' : '基于剩余本金'} ${Utils.formatCurrency(remainingPrincipal)} × ${(monthlyRate*100).toFixed(0)}%）</small></p>
                    <p><strong>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}:</strong> ${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(order.interest_paid_total)})</p>
                    <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    <p><strong>${t('payment_due_date')}:</strong> ${nextDueDate}</p>
                    <p><strong>${t('notes')}:</strong> ${Utils.escapeHtml(order.notes || '-')}</p>
                    
                    <div class="info-card" style="margin: 16px 0;">
                        <div class="info-card-content">
                            <div class="info-icon">💡</div>
                            <div class="info-text">
                                <strong>${lang === 'id' ? 'Tips:' : '温馨提示：'}</strong> ${lang === 'id' ? 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pembayaran pokok lebih awal dapat mengurangi beban bunga. Setelah lunas, sistem akan membuat tanda terima pelunasan secara otomatis.' : '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。'}
                            </div>
                        </div>
                    </div>
                    
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h3>
                    <div class="table-container">
                        <table class="data-table payment-table">
                            <thead>
                                <tr>
                                    <th>${t('date')}</th>
                                    <th>${t('type')}</th>
                                    <th class="text-center">${lang === 'id' ? 'Bulan' : '月数'}</th>
                                    <th class="text-right">${t('amount')}</th>
                                    <th class="text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                    <th>${t('description')}</th>
                                </tr>
                            </thead>
                            <tbody>${payRows}</tbody>
                        </table>
                    </div>
                    
                    <div class="toolbar" style="margin-top: 16px;">
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                        ${order.status === 'active' && !isAdmin ? `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeAttr(order.order_id)}'})" class="success">💰 ${lang === 'id' ? 'Bayar' : '缴纳费用'}</button>` : ''}
                        ${order.status === 'completed' ? `<button onclick="APP.printSettlementReceipt('${Utils.escapeAttr(order.order_id)}')" class="success">🧾 ${lang === 'id' ? 'Cetak Tanda Terima Pelunasan' : '打印结清凭证'}</button>` : ''}
                        <button onclick="APP.sendWAReminder('${Utils.escapeAttr(order.order_id)}')" class="warning">📱 ${lang === 'id' ? 'Pengingat WA' : 'WA提醒'}</button>
                    </div>
                </div>`;
            
        } catch (error) {
            console.error("viewOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            this.goBack();
        }
    },

    deleteOrder: async function(orderId) {
        var lang = Utils.lang;
        
        if (!confirm(Utils.t('confirm_delete'))) return;
        
        try {
            const order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(Utils.t('order_not_found'));
                return;
            }
            
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
            alert(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    // 修复：printOrder 中添加 t 函数定义
    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { 
                alert(Utils.t('order_not_found')); 
                return; 
            }
            var lang = Utils.lang;
            var t = Utils.t;  // 添加 t 函数定义
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)', 
                bank: lang === 'id' ? 'Transfer Bank BNI' : '银行转账 BNI' 
            };
            
            var paymentRows = '';
            for (var p of payments) {
                var typeText = '';
                if (p.type === 'admin_fee') typeText = t('admin_fee');
                else if (p.type === 'service_fee') typeText = t('service_fee');
                else if (p.type === 'interest') typeText = t('interest');
                else if (p.type === 'principal') typeText = t('principal');
                else typeText = p.type || '-';
                
                var methodText = methodMap[p.payment_method] || (p.payment_method === 'cash' ? 'Tunai' : 'Bank');
                
                paymentRows += `<tr>
                    <td>${Utils.formatDate(p.date)}<\/td>
                    <td>${typeText}<\/td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}<\/td>
                    <td>${methodText}<\/td>
                <\/tr>`;
            }
            
            if (paymentRows === '') {
                paymentRows = `<tr><td colspan="4" class="text-center">${t('no_data')}<\/td><\/tr>`;
            }
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var safeStoreName = AUTH.getCurrentStoreName();
            
            var printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>JF! by Gadai - ${order.order_id}</title>
                    <style>
                        *{margin:0;padding:0;box-sizing:border-box}
                        body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;padding:15mm}
                        .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px}
                        .header h1{font-size:18px}
                        .section{border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:12px}
                        .section h3{font-size:13px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px}
                        .info-row{display:flex;margin-bottom:4px}
                        .info-label{width:100px;font-weight:600}
                        table{width:100%;border-collapse:collapse;margin-top:8px}
                        th,td{border:1px solid #ccc;padding:6px;text-align:left}
                        th{background:#f5f5f5}
                        .text-right{text-align:right}
                        .footer{text-align:center;margin-top:20px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;color:#666}
                        @media print{@page{size:A4;margin:15mm}}
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>JF! by Gadai</h1>
                        <p>${lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证'} | <strong>${order.order_id}</strong> | ${Utils.formatDate(order.created_at)}</p>
                    </div>
                    
                    <div class="section">
                        <h3>${lang === 'id' ? 'Informasi Nasabah' : '客户信息'}</h3>
                        <div class="info-row"><div class="info-label">${t('customer_name')}:</div><div>${order.customer_name}</div></div>
                        <div class="info-row"><div class="info-label">KTP:</div><div>${order.customer_ktp || '-'}</div></div>
                        <div class="info-row"><div class="info-label">${t('phone')}:</div><div>${order.customer_phone || '-'}</div></div>
                        <div class="info-row"><div class="info-label">${t('address')}:</div><div>${order.customer_address || '-'}</div></div>
                    </div>
                    
                    <div class="section">
                        <h3>${lang === 'id' ? 'Jaminan & Pinjaman' : '质押物与贷款'}</h3>
                        <div class="info-row"><div class="info-label">${t('collateral_name')}:</div><div>${order.collateral_name}</div></div>
                        <div class="info-row"><div class="info-label">${t('loan_amount')}:</div><div>${Utils.formatCurrency(order.loan_amount)}</div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div>${Utils.formatCurrency(remainingPrincipal)}</div></div>
                        <div class="info-row"><div class="info-label">${t('notes')}:</div><div>${order.notes || '-'}</div></div>
                    </div>
                    
                    <div class="section">
                        <h3>${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h3>
                        <table>
                            <thead><tr><th>${t('date')}</th><th>${t('type')}</th><th class="text-right">${t('amount')}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th></tr></thead>
                            <tbody>${paymentRows}</tbody>
                        </table>
                    </div>
                    
                    <div class="footer">
                        <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                        <div>${lang === 'id' ? 'Toko' : '门店'}：${safeStoreName}</div>
                        <div>${lang === 'id' ? 'Bukti ini dicetak secara elektronik, tidak perlu tanda tangan' : '本凭证为电子打印，无需签名'}</div>
                    </div>
                    
                    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000)};<\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error("printOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal mencetak pesanan' : '打印订单失败');
        }
    },

    showPaymentHistory: async function() {
        this.currentPage = 'paymentHistory';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = Utils.t;
        try {
            var allPayments = await SUPABASE.getAllPayments();
            var totalAdminFee = 0, totalServiceFee = 0, totalInterest = 0, totalPrincipal = 0;
            for (var p of allPayments) {
                if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'service_fee') totalServiceFee += p.amount;
                else if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
            }
            var typeMap = { admin_fee: t('admin_fee'), service_fee: t('service_fee'), interest: t('interest'), principal: t('principal') };
            var methodMap = { cash: t('cash'), bank: t('bank') };

            var rows = allPayments.length === 0
                ? `<tr><td colspan="9" class="text-center">${t('no_data')}<\/td><\/tr>`
                : allPayments.map(p => `<tr>
                    <td data-label="${t('order_id')}" class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}<\/td>
                    <td data-label="${t('customer_name')}">${Utils.escapeHtml(p.orders?.customer_name || '-')}<\/td>
                    <td data-label="${t('date')}" class="date-cell">${Utils.formatDate(p.date)}<\/td>
                    <td data-label="${t('type')}">${typeMap[p.type] || p.type}<\/td>
                    <td data-label="${lang === 'id' ? 'Bulan' : '月数'}" class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}<\/td>
                    <td data-label="${t('amount')}" class="text-right">${Utils.formatCurrency(p.amount)}<\/td>
                    <td data-label="${lang === 'id' ? 'Metode' : '支付方式'}" class="text-center">${methodMap[p.payment_method] || '-'}<\/td>
                    <td data-label="${t('description')}">${Utils.escapeHtml(p.description || '-')}<\/td>
                <\/tr>
                <tr class="action-row"><td colspan="9"><button onclick="APP.viewOrder('${p.orders?.order_id}')" class="btn-small">${t('view')}<\/button><\/td><\/tr>`).join('');

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${t('payment_history')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${t('print')}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>                  
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${t('admin_fee')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalServiceFee)}</div><div>${t('service_fee')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${t('interest')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${t('principal')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal)}</div><div>${lang === 'id' ? 'Total Keseluruhan' : '全部总计'}</div></div>
                </div>
                
                <div class="table-container">
                    <table class="data-table payment-table">
                        <thead>
                            <tr>
                                <th>${t('order_id')}</th><th>${t('customer_name')}</th><th>${t('date')}</th><th>${t('type')}</th><th class="text-center">${lang === 'id' ? 'Bulan' : '月数'}</th><th class="text-right">${t('amount')}</th><th class="text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${t('description')}</th><th class="text-center">${t('action')}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
        } catch (error) {
            console.error("showPaymentHistory error:", error);
            alert(lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
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
