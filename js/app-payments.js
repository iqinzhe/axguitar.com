// app-payments.js - 完整修复版 v5.5
// 缴费页面只保留：利息缴费 + 本金还款
// 管理费、服务费、贷款发放已在创建订单时完成，此处只显示状态

window.APP = window.APP || {};

const PaymentsModule = {

    showPayment: async function(orderId) {
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;

            var { payments } = await SUPABASE.getPaymentHistory(orderId);

            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            var currentMonthlyInterest = remainingPrincipal * 0.10;

            var interestPayments = payments.filter(p => p.type === 'interest');
            var principalPayments = payments.filter(p => p.type === 'principal');
            
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai' : '现金', 
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

            // 利息缴费历史
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="4" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'} <tr></tr>`;
            } else {
                for (var p of interestPayments) {
                    if (p.is_voided) continue;
                    interestRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-center">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td>${methodMap[p.payment_method] || '-'}</td>
                    </tr>`;
                }
            }

            // 本金还款历史
            var principalRows = '';
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="3" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'} </tr></tr>`;
            } else {
                for (var p of principalPayments) {
                    if (p.is_voided) continue;
                    principalRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td>${methodMap[p.payment_method] || '-'}</td>
                    </tr>`;
                }
            }

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            // 查找管理费和服务费的支付记录（用于显示已缴纳信息）
            var adminFeePayment = payments.find(p => p.type === 'admin_fee' && !p.is_voided);
            var serviceFeePayment = payments.find(p => p.type === 'service_fee' && !p.is_voided);
            
            var adminFeePaidInfo = order.admin_fee_paid && adminFeePayment ?
                `${Utils.formatCurrency(order.admin_fee)} (${methodMap[adminFeePayment.payment_method] || '-'} / ${Utils.formatDate(adminFeePayment.date)})` :
                (order.admin_fee_paid ? `${Utils.formatCurrency(order.admin_fee)}` : 'Belum dibayar');
            
            var serviceFeePaidInfo = (order.service_fee_paid || 0) >= (order.service_fee_amount || 0) && serviceFeePayment ?
                `${Utils.formatCurrency(order.service_fee_amount)} (${methodMap[serviceFeePayment.payment_method] || '-'} / ${Utils.formatDate(serviceFeePayment.date)})` :
                ((order.service_fee_paid || 0) > 0 ? `${Utils.formatCurrency(order.service_fee_paid || 0)}/${Utils.formatCurrency(order.service_fee_amount)}` : 'Belum dibayar');

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran Bunga & Pokok' : '利息 & 本金缴费'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${order.order_id}')" class="btn-detail">📄 ${lang === 'id' ? 'Detail Order' : '订单详情'}</button>
                    </div>
                </div>
                
                <!-- 订单摘要 - 包含所有信息 -->
                <div class="card summary-card">
                    <!-- 客户信息行 -->
                    <div class="summary-row">
                        <div class="summary-field"><span class="field-label">${t('customer_name')}</span><span class="field-value">${Utils.escapeHtml(order.customer_name)}</span></div>
                        <div class="summary-field"><span class="field-label">ID</span><span class="field-value order-id">${Utils.escapeHtml(order.order_id)}</span></div>
                        <div class="summary-field"><span class="field-label">${t('loan_amount')}</span><span class="field-value">${Utils.formatCurrency(order.loan_amount)}</span></div>
                        <div class="summary-field"><span class="field-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</span><span class="field-value ${remainingPrincipal > 0 ? 'warning' : 'success'}">${Utils.formatCurrency(remainingPrincipal)}</span></div>
                        <div class="summary-field"><span class="field-label">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</span><span class="field-value">${Utils.formatCurrency(currentMonthlyInterest)}</span></div>
                        <div class="summary-field"><span class="field-label">${lang === 'id' ? 'Jatuh Tempo' : '下次到期'}</span><span class="field-value">${nextDueDate}</span></div>
                        <div class="summary-field"><span class="field-label">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</span><span class="field-value">${order.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</span></div>
                    </div>
                    <div class="summary-divider"></div>
                    <!-- 典当物品信息行 -->
                    <div class="summary-row">
                        <div class="summary-field"><span class="field-label">💎 ${lang === 'id' ? 'Nama Barang' : '物品名称'}</span><span class="field-value">${Utils.escapeHtml(order.collateral_name || '-')}</span></div>
                        <div class="summary-field"><span class="field-label">${lang === 'id' ? 'Service Fee' : '服务费'}</span><span class="field-value">${order.service_fee_percent || 0}%</span></div>
                        <div class="summary-field"><span class="field-label">📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</span><span class="field-value">${Utils.formatCurrency(order.admin_fee)}</span></div>
                    </div>
                    <div class="summary-divider"></div>
                    <!-- 已缴纳费用信息行 -->
                    <div class="summary-row paid-row">
                        <div class="summary-field"><span class="field-label">✅ ${lang === 'id' ? 'Admin Fee Dibayar' : '管理费已缴'}</span><span class="field-value success-text">${adminFeePaidInfo}</span></div>
                        <div class="summary-field"><span class="field-label">✅ ${lang === 'id' ? 'Service Fee Dibayar' : '服务费已缴'}</span><span class="field-value success-text">${serviceFeePaidInfo}</span></div>
                        <div class="summary-field"><span class="field-label">💰 ${lang === 'id' ? 'Pinjaman Dicairkan' : '贷款已发放'}</span><span class="field-value success-text">${Utils.formatCurrency(order.loan_amount)} (${order.created_at ? Utils.formatDate(order.created_at) : '-'})</span></div>
                    </div>
                    <div class="summary-note">ℹ️ ${lang === 'id' ? 'Admin Fee, Service Fee, dan pencairan pinjaman telah selesai saat pembuatan order.' : '管理费、服务费和贷款发放已在创建订单时完成。'}</div>
                </div>
                
                <!-- 利息缴费区域 -->
                <div class="card action-card">
                    <div class="card-header"><h3>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3></div>
                    <div class="card-body">
                        <div class="action-input-group">
                            <label class="action-label">${lang === 'id' ? 'Ambil untuk' : '收取'}:</label>
                            <select id="interestMonths" class="action-select">${interestOptions}</select>
                        </div>
                        <div class="payment-method-group">
                            <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="btn-action success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息付款'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '方式'}</th></tr></thead>
                                <tbody>${interestRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- 本金还款区域 -->
                <div class="card action-card">
                    <div class="card-header"><h3>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3></div>
                    <div class="card-body">
                        <div class="action-input-group">
                            <label class="action-label">${lang === 'id' ? 'Jumlah bayar' : '还款金额'}:</label>
                            <input type="text" id="principalAmount" class="action-input" placeholder="0">
                        </div>
                        <div class="payment-method-group">
                            <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ${t('bank')}</label>
                                <label><input type="radio" name="principalTarget" value="cash"> 🏦 ${t('cash')}</label>
                            </div>
                        </div>
                        <div class="remaining-info">${lang === 'id' ? 'Sisa pokok' : '剩余本金'}: <strong>${Utils.formatCurrency(remainingPrincipal)}</strong></div>
                        <button onclick="APP.payPrincipalWithMethod('${order.order_id}')" class="btn-action success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '方式'}</th></tr></thead>
                                <tbody>${principalRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
                    .page-header h2 { margin: 0; font-size: 1.25rem; }
                    .header-actions { display: flex; gap: 8px; }
                    .btn-back, .btn-detail { padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; border: none; }
                    .btn-back { background: #64748b; color: white; }
                    .btn-detail { background: #8b5cf6; color: white; }
                    
                    /* 订单摘要卡片 */
                    .summary-card { padding: 12px 16px; margin-bottom: 20px; }
                    .summary-row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 8px; }
                    .summary-field { display: flex; align-items: baseline; gap: 6px; font-size: 0.8rem; }
                    .field-label { color: #64748b; font-weight: 500; min-width: 90px; }
                    .field-value { font-weight: 600; color: #1e293b; }
                    .field-value.warning { color: #f59e0b; }
                    .field-value.success { color: #10b981; }
                    .order-id { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
                    .success-text { color: #10b981; }
                    .summary-divider { height: 1px; background: #e2e8f0; margin: 8px 0; }
                    .summary-note { font-size: 0.7rem; color: #94a3b8; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e2e8f0; text-align: center; }
                    .paid-row { background: #f0fdf4; padding: 6px 8px; border-radius: 8px; margin: 4px 0; }
                    
                    /* 缴费卡片 */
                    .action-card { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                    .action-card .card-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
                    .action-card .card-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
                    .action-card .card-body { padding: 16px; }
                    .action-card .card-history { border-top: 1px solid #e2e8f0; padding: 12px 16px; background: #fafafa; }
                    
                    .action-input-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
                    .action-label { font-weight: 600; font-size: 0.85rem; color: #475569; min-width: 80px; }
                    .action-select { padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; background: white; min-width: 200px; }
                    .action-input { padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; width: 200px; text-align: right; }
                    
                    .payment-method-group { background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin: 12px 0; border: 1px solid #e2e8f0; }
                    .payment-method-title { font-size: 0.7rem; font-weight: 500; color: #64748b; margin-bottom: 6px; }
                    .payment-method-options { display: flex; gap: 20px; flex-wrap: wrap; }
                    .payment-method-options label { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; }
                    
                    .remaining-info { font-size: 0.8rem; color: #64748b; margin: 12px 0; padding: 8px; background: #fef3c7; border-radius: 8px; text-align: center; }
                    .remaining-info strong { color: #d97706; font-size: 1rem; }
                    
                    .btn-action { width: 100%; padding: 10px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: none; margin-top: 8px; }
                    .btn-action.success { background: #16a34a; color: white; }
                    .btn-action.success:hover { background: #15803d; }
                    
                    .history-title { font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 10px; }
                    .history-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
                    .history-table th, .history-table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
                    .history-table th { background: #f1f5f9; font-weight: 600; color: #475569; }
                    .history-table .text-right { text-align: right; }
                    .history-table .text-center { text-align: center; }
                    .text-muted { color: #94a3b8; }
                    
                    @media (max-width: 768px) {
                        .summary-row { flex-direction: column; align-items: flex-start; gap: 8px; }
                        .summary-field { flex-wrap: wrap; }
                        .field-label { min-width: auto; }
                        .action-input-group { flex-direction: column; align-items: stretch; }
                        .action-select, .action-input { width: 100%; }
                        .payment-method-options { justify-content: flex-start; }
                    }
                </style>`;

            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran' : '加载缴费页面失败');
            this.goBack();
        }
    },

    // 利息支付
    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai' : '现金') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        if (confirm(lang === 'id' ? `Konfirmasi pemasukan bunga ${months} bulan via ${methodName}?` : `确认入账利息 ${months} 个月，入账方式：${methodName}？`)) {
            try {
                await Order.recordInterestPayment(orderId, months, method);
                alert(lang === 'id' ? '✅ Bunga berhasil dicatat' : '✅ 利息记录成功');
                window.location.reload();
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    // 本金支付
    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var target = document.querySelector('input[name="principalTarget"]:checked')?.value || 'bank';
        var targetName = target === 'cash' ? (Utils.lang === 'id' ? 'Brankas' : '保险柜') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        if (confirm(lang === 'id' ? `Konfirmasi pemasukan pokok ${Utils.formatCurrency(amount)} ke ${targetName}?` : `确认入账本金 ${Utils.formatCurrency(amount)} 到 ${targetName}？`)) {
            try {
                await Order.recordPrincipalPayment(orderId, amount, target);
                alert(lang === 'id' ? '✅ Pokok berhasil dicatat' : '✅ 本金记录成功');
                window.location.reload();
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    }
};

for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') window.APP[key] = PaymentsModule[key];
}
