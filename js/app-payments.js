// app-payments.js - 缴费管理、资金去向模块（类名优化版）

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
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'}</td></tr>`;
            } else {
                for (var p of interestPayments) {
                    interestRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-center">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                    　　　`;
                }
            }

            var principalRows = '';
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="4" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'}</td></tr>`;
            } else {
                for (var p of principalPayments) {
                    principalRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                    　　　`;
                }
            }

            var adminFeeOptions = `
                <div class="admin-fee-input-group">
                    <select id="adminFeeAmount" class="admin-fee-select">
                        <option value="30000">Rp 30.000</option>
                        <option value="40000">Rp 40.000</option>
                        <option value="50000">Rp 50.000</option>
                        <option value="custom">${lang === 'id' ? 'Input Manual' : '手工录入'}</option>
                    </select>
                    <input type="text" id="customAdminFee" class="admin-fee-custom" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}" style="display:none;">
                </div>
            `;

            var adminFeeSection = !order.admin_fee_paid
                ? `<div class="admin-fee-section">
                    <div class="admin-fee-info">
                        <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ❌ ${lang === 'id' ? 'Belum dibayar' : '未支付'}</span>
                        <div class="payment-method-group inline">
                            <div class="payment-method-title">${lang === 'id' ? 'Metode Pembayaran' : '支付方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="adminFeeMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="adminFeeMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        ${adminFeeOptions}
                        <button onclick="APP.payAdminFeeWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran' : '记录收款'}</button>
                    </div>
                   </div>`
                : `<div class="admin-fee-paid">
                    <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ✅ ${lang === 'id' ? 'Sudah dibayar' : '已支付'} (${Utils.formatDate(order.admin_fee_paid_date)})</span>
                   </div>`;

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            var principalInputSection = remainingPrincipal > 0
                ? `<div class="principal-section">
                    <div class="payment-method-group">
                        <div class="payment-method-title">${lang === 'id' ? 'Metode Pembayaran Pokok' : '本金支付方式'}:</div>
                        <div class="payment-method-options">
                            <label><input type="radio" name="principalMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                            <label><input type="radio" name="principalMethod" value="bank"> 🏧 ${t('bank')}</label>
                        </div>
                    </div>
                    <div class="principal-input-group">
                        <label class="principal-label">${lang === 'id' ? 'Jumlah bayar pokok' : '本次还款金额'} (IDR):</label>
                        <input type="text" id="principalAmount" class="principal-amount" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}">
                        <button onclick="APP.payPrincipalWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                    </div>
                    <p class="remaining-principal">${lang === 'id' ? 'Sisa pokok' : '剩余本金'}: <strong>${Utils.formatCurrency(remainingPrincipal)}</strong></p>
                   </div>`
                : `<p class="principal-complete">✅ ${lang === 'id' ? 'Pokok sudah LUNAS' : '本金已全部结清'}</p>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card order-summary">
                    <div class="summary-grid">
                        <div class="summary-item"><div class="summary-label">${t('customer_name')}</div><div class="summary-value">${Utils.escapeHtml(order.customer_name)}</div></div>
                        <div class="summary-item"><div class="summary-label">ID</div><div class="summary-value order-id">${Utils.escapeHtml(order.order_id)}</div></div>
                        <div class="summary-item"><div class="summary-label">${t('loan_amount')}</div><div class="summary-value">${Utils.formatCurrency(order.loan_amount)}</div></div>
                        <div class="summary-item"><div class="summary-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</div><div class="summary-value ${remainingPrincipal > 0 ? 'warning' : 'success'}">${Utils.formatCurrency(remainingPrincipal)}</div></div>
                        <div class="summary-item"><div class="summary-label">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</div><div class="summary-value primary">${Utils.formatCurrency(currentMonthlyInterest)}</div></div>
                        <div class="summary-item"><div class="summary-label">${lang === 'id' ? 'Jatuh Tempo Bunga' : '下次利息到期'}</div><div class="summary-value">${nextDueDate}</div></div>
                        <div class="summary-item"><div class="summary-label">${lang === 'id' ? 'Bunga Dibayar' : '已付利息期数'}</div><div class="summary-value">${order.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</div></div>
                    </div>
                </div>
                ${adminFeeSection}
                <div class="card interest-card">
                    <h3>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3>
                    <p class="info-note">📌 ${lang === 'id' ? 'Setiap pembayaran memperpanjang pinjaman 1 bulan secara otomatis' : '📌 每次付息后自动延续1个月，到期日同步更新'}</p>
                    <div class="payment-method-group">
                        <div class="payment-method-title">${lang === 'id' ? 'Metode Pembayaran Bunga' : '利息支付方式'}:</div>
                        <div class="payment-method-options">
                            <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                            <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                        </div>
                    </div>
                    <div class="interest-input-group">
                        <label class="interest-label">${lang === 'id' ? 'Bayar untuk' : '支付'}:</label>
                        <select id="interestMonths" class="interest-months">${interestOptions}</select>
                        <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息付款'}</button>
                    </div>
                    <h4 class="subtitle">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</h4>
                    <div class="table-container">
                        <table class="payment-history-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                    <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                </tr>
                            </thead>
                            <tbody>${interestRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="card principal-card">
                    <h3>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3>
                    <p class="info-note">📌 ${lang === 'id' ? `Total pinjaman: ${Utils.formatCurrency(order.loan_amount)} | Sudah dibayar: ${Utils.formatCurrency(order.principal_paid)} | Sisa: ${Utils.formatCurrency(remainingPrincipal)}` : `📌 贷款总额: ${Utils.formatCurrency(order.loan_amount)} | 已还: ${Utils.formatCurrency(order.principal_paid)} | 剩余: ${Utils.formatCurrency(remainingPrincipal)}`}</p>
                    ${principalInputSection}
                    <h4 class="subtitle">📋 ${lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史'}</h4>
                    <div class="table-container">
                        <table class="payment-history-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                    <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                </tr>
                            </thead>
                            <tbody>${principalRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="toolbar">
                    <button onclick="APP.viewOrder('${order.order_id}')">📄 ${lang === 'id' ? 'Lihat Detail Order' : '查看订单详情'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .order-summary .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
                    .summary-item { background: #f8fafc; padding: 10px; border-radius: 8px; }
                    .summary-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
                    .summary-value { font-weight: 600; font-size: 14px; }
                    .summary-value.warning { color: #f59e0b; }
                    .summary-value.success { color: #10b981; }
                    .summary-value.primary { color: #3b82f6; }
                    .order-id { font-family: monospace; }
                    .admin-fee-section { background: #fef3c7; padding: 12px 15px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid #f59e0b; }
                    .admin-fee-paid { background: #d1fae5; padding: 10px 15px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid #10b981; }
                    .admin-fee-input-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
                    .admin-fee-select { width: auto; min-width: 150px; margin: 0; }
                    .admin-fee-custom { width: 150px; }
                    .payment-method-group.inline { display: inline-flex; align-items: center; gap: 8px; background: transparent; padding: 0; margin: 0; }
                    .info-note { font-size: 12px; color: #64748b; margin-bottom: 10px; }
                    .subtitle { font-size: 13px; margin: 12px 0 8px; color: #64748b; }
                    .interest-input-group, .principal-input-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                    .interest-months { width: auto; min-width: 200px; margin: 0; }
                    .principal-amount { width: 180px; text-align: right; }
                    .remaining-principal { font-size: 12px; color: #64748b; margin-top: 8px; }
                    .principal-complete { color: #10b981; font-weight: 500; }
                    .payment-history-table { width: 100%; border-collapse: collapse; }
                    .payment-history-table th, .payment-history-table td { border: 1px solid #cbd5e1; padding: 8px; }
                    .payment-history-table th { background: #f8fafc; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .text-muted { color: #94a3b8; }
                    .desc-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    @media (max-width: 768px) {
                        .order-summary .summary-grid { grid-template-columns: repeat(2, 1fr); }
                        .interest-input-group, .principal-input-group { flex-direction: column; align-items: stretch; }
                        .interest-months, .principal-amount { width: 100%; }
                    }
                </style>`;

            var adminFeeSelect = document.getElementById('adminFeeAmount');
            var customAdminFee = document.getElementById('customAdminFee');
            
            if (adminFeeSelect) {
                adminFeeSelect.addEventListener('change', function() {
                    if (customAdminFee) {
                        customAdminFee.style.display = this.value === 'custom' ? 'inline-block' : 'none';
                    }
                });
            }
            
            if (customAdminFee && Utils.bindAmountFormat) {
                Utils.bindAmountFormat(customAdminFee);
            }
            
            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran' : '加载缴费页面失败');
            this.goBack();
        }
    },

    payAdminFeeWithMethod: async function(orderId) {
        var method = document.querySelector('input[name="adminFeeMethod"]:checked')?.value || 'cash';
        var adminFeeSelect = document.getElementById('adminFeeAmount');
        var customAdminFeeInput = document.getElementById('customAdminFee');
        var adminFeeAmount = 30000;
        
        if (adminFeeSelect) {
            if (adminFeeSelect.value === 'custom') {
                adminFeeAmount = Utils.parseNumberFromCommas(customAdminFeeInput?.value || '0');
                if (isNaN(adminFeeAmount) || adminFeeAmount <= 0) {
                    alert(Utils.lang === 'id' ? 'Masukkan jumlah admin fee yang valid' : '请输入有效的管理费金额');
                    return;
                }
            } else {
                adminFeeAmount = parseInt(adminFeeSelect.value);
            }
        }
        
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        if (confirm(Utils.lang === 'id' ? `Konfirmasi penerimaan Admin Fee ${Utils.formatCurrency(adminFeeAmount)} via ${methodName}?` : `确认已收取管理费 ${Utils.formatCurrency(adminFeeAmount)}，支付方式：${methodName}？`)) {
            try { 
                await Order.recordAdminFee(orderId, method, adminFeeAmount); 
                await this.showPayment(orderId); 
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        if (confirm((lang === 'id' ? `Konfirmasi pembayaran bunga ${months} bulan via ${methodName}?` : `确认支付利息 ${months} 个月，支付方式：${methodName}？`))) {
            try {
                await Order.recordInterestPayment(orderId, months, method);
                await this.showPayment(orderId);
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var method = document.querySelector('input[name="principalMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        if (confirm((lang === 'id' ? `Konfirmasi pembayaran pokok ${Utils.formatCurrency(amount)} via ${methodName}?` : `确认支付本金 ${Utils.formatCurrency(amount)}，支付方式：${methodName}？`))) {
            try {
                await Order.recordPrincipalPayment(orderId, amount, method);
                await this.showPayment(orderId);
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    }
};

// 合并到 window.APP
for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') {
        window.APP[key] = PaymentsModule[key];
    }
}
