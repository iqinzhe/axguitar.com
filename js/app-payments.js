// app-payments.js - 完整修复版 v5.2
// 正确逻辑：创建订单时已收取管理费和服务费
// 缴费页面只处理：利息缴纳 + 本金还款

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
            var isAdmin = AUTH.isAdmin();

            // 分离各类支付记录（只显示利息和本金）
            var interestPayments = payments.filter(p => p.type === 'interest');
            var principalPayments = payments.filter(p => p.type === 'principal');
            
            // 获取管理费和服务费记录（仅用于显示已缴纳状态）
            var adminFeePayments = payments.filter(p => p.type === 'admin_fee' && !p.is_voided);
            var serviceFeePayments = payments.filter(p => p.type === 'service_fee' && !p.is_voided);
            
            var methodMap = { 
                cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', 
                bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI'
            };

            // ========== 典当物品信息 ==========
            var collateralInfoHtml = `
                <div class="card collateral-info-card">
                    <h3>💎 ${lang === 'id' ? 'Informasi Jaminan' : '典当物品信息'}</h3>
                    <div class="collateral-info-grid">
                        <div class="collateral-item">
                            <div class="collateral-label">${lang === 'id' ? 'Nama Barang' : '物品名称'}</div>
                            <div class="collateral-value">${Utils.escapeHtml(order.collateral_name || '-')}</div>
                        </div>
                        <div class="collateral-item">
                            <div class="collateral-label">${lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额'}</div>
                            <div class="collateral-value">${Utils.formatCurrency(order.loan_amount)}</div>
                        </div>
                        <div class="collateral-item">
                            <div class="collateral-label">${lang === 'id' ? 'Service Fee' : '服务费比例'}</div>
                            <div class="collateral-value">${order.service_fee_percent || 0}%</div>
                        </div>
                        <div class="collateral-item">
                            <div class="collateral-label">${lang === 'id' ? 'Admin Fee' : '管理费'}</div>
                            <div class="collateral-value">${Utils.formatCurrency(order.admin_fee)}</div>
                        </div>
                    </div>
                </div>
            `;

            // ========== 已缴纳费用汇总（只读，仅供参考） ==========
            var adminFeeStatus = order.admin_fee_paid ? 
                `✅ ${lang === 'id' ? 'Sudah dibayar' : '已缴纳'} (${Utils.formatDate(order.admin_fee_paid_date)})` : 
                `⚠️ ${lang === 'id' ? 'Belum dibayar' : '未缴纳'}`;
            
            var totalServiceFeePaid = order.service_fee_paid || 0;
            var expectedServiceFee = (order.service_fee_amount || 0);
            var serviceFeeStatus = expectedServiceFee > 0 ?
                (totalServiceFeePaid >= expectedServiceFee ? 
                    `✅ ${lang === 'id' ? 'Sudah dibayar' : '已缴纳'} (${Utils.formatCurrency(totalServiceFeePaid)}/${Utils.formatCurrency(expectedServiceFee)})` : 
                    `⚠️ ${lang === 'id' ? 'Belum lunas' : '未缴清'} (${Utils.formatCurrency(totalServiceFeePaid)}/${Utils.formatCurrency(expectedServiceFee)})`) :
                `ℹ️ ${lang === 'id' ? 'Tidak ada' : '无'}`;

            var paidSummaryHtml = `
                <div class="card paid-summary-card">
                    <h3>📋 ${lang === 'id' ? 'Ringkasan Pembayaran Awal' : '初期费用汇总'}</h3>
                    <div class="paid-summary-grid">
                        <div class="paid-item">
                            <div class="paid-label">📋 Admin Fee</div>
                            <div class="paid-value">${Utils.formatCurrency(order.admin_fee)}</div>
                            <div class="paid-status ${order.admin_fee_paid ? 'success' : 'warning'}">${adminFeeStatus}</div>
                        </div>
                        <div class="paid-item">
                            <div class="paid-label">💰 Service Fee</div>
                            <div class="paid-value">${Utils.formatCurrency(expectedServiceFee)}</div>
                            <div class="paid-status ${totalServiceFeePaid >= expectedServiceFee && expectedServiceFee > 0 ? 'success' : 'muted'}">${serviceFeeStatus}</div>
                        </div>
                    </div>
                    <div class="info-note" style="margin-top:12px; font-size:11px;">
                        ℹ️ ${lang === 'id' ? 'Admin Fee dan Service Fee telah dibayar saat pembuatan order.' : '管理费和服务费已在创建订单时缴纳。'}
                    </div>
                </div>
            `;

            // ========== 利息缴费历史 ==========
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'} </tr></tr>`;
            } else {
                for (var p of interestPayments) {
                    if (p.is_voided) continue;
                    var methodClass = p.payment_method === 'cash' ? 'method-cash' : 'method-bank';
                    interestRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-center">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            }

            // ========== 本金还款历史 ==========
            var principalRows = '';
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="4" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'} </tr></tr>`;
            } else {
                for (var p of principalPayments) {
                    if (p.is_voided) continue;
                    var methodClass = p.payment_method === 'cash' ? 'method-cash' : 'method-bank';
                    principalRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            }

            // ========== 利息到期日 ==========
            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            // ========== 利息选项（1-3个月） ==========
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            // ========== 利息入账方式 ==========
            var interestMethodHtml = `
                <div class="payment-method-group">
                    <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                    <div class="payment-method-options">
                        <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                        <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                    </div>
                </div>
            `;

            // ========== 本金还款区域 ==========
            var principalInputSection = remainingPrincipal > 0
                ? `<div class="principal-section">
                    <div class="principal-input-group">
                        <label class="principal-label">${lang === 'id' ? 'Jumlah bayar pokok' : '本次还款金额'} (IDR):</label>
                        <input type="text" id="principalAmount" class="principal-amount" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}">
                        <button onclick="APP.payPrincipalWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                    </div>
                    <div class="payment-method-group">
                        <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                        <div class="payment-method-options">
                            <label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</label>
                            <label><input type="radio" name="principalTarget" value="cash"> 🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</label>
                        </div>
                    </div>
                    <p class="remaining-principal">${lang === 'id' ? 'Sisa pokok' : '剩余本金'}: <strong>${Utils.formatCurrency(remainingPrincipal)}</strong></p>
                   </div>`
                : `<p class="principal-complete">✅ ${lang === 'id' ? 'Pokok sudah LUNAS' : '本金已全部结清'}</p>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran Bunga & Pokok' : '利息 & 本金缴费'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${order.order_id}')" class="btn-detail">📄 ${lang === 'id' ? 'Lihat Detail Order' : '查看订单详情'}</button>
                    </div>
                </div>
                
                <!-- 订单摘要 -->
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
                
                <!-- 典当物品信息 -->
                ${collateralInfoHtml}
                
                <!-- 初期费用汇总（只读，仅供参考） -->
                ${paidSummaryHtml}
                
                <!-- 利息缴费区域 -->
                <div class="card interest-card">
                    <h3>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3>
                    <p class="info-note">📌 ${lang === 'id' ? 'Bunga dihitung dari sisa pokok, 10% per bulan' : '利息按剩余本金计算，每月10%'}</p>
                    <div class="interest-input-group">
                        <label class="interest-label">${lang === 'id' ? 'Ambil untuk' : '收取'}:</label>
                        <select id="interestMonths" class="interest-months">${interestOptions}</select>
                    </div>
                    ${interestMethodHtml}
                    <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息付款'}</button>
                    
                    <h4 class="subtitle">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</h4>
                    <div class="table-container">
                        <table class="payment-history-table">
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                            <tbody>${interestRows}</tbody>
                        </table>
                    </div>
                </div>
                
                <!-- 本金还款区域 -->
                <div class="card principal-card">
                    <h3>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3>
                    <p class="info-note">📌 ${lang === 'id' ? 'Bayar pokok bisa dicicil. Setelah lunas, order akan selesai.' : '本金可分批还款。还清后订单结清。'}</p>
                    ${principalInputSection}
                    <h4 class="subtitle">📋 ${lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史'}</h4>
                    <div class="table-container">
                        <table class="payment-history-table">
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                            <tbody>${principalRows}</tbody>
                        </table>
                    </div>
                </div>
                
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    
                    /* 订单摘要 */
                    .order-summary .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
                    .summary-item { background: #f8fafc; padding: 10px; border-radius: 8px; }
                    .summary-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
                    .summary-value { font-weight: 600; font-size: 14px; }
                    .summary-value.warning { color: #f59e0b; }
                    .summary-value.success { color: #10b981; }
                    .summary-value.primary { color: #3b82f6; }
                    .order-id { font-family: monospace; }
                    
                    /* 典当物品信息 */
                    .collateral-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
                    .collateral-item { background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; }
                    .collateral-label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
                    .collateral-value { font-weight: 600; font-size: 14px; }
                    
                    /* 初期费用汇总 */
                    .paid-summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
                    .paid-item { background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; }
                    .paid-label { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
                    .paid-value { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
                    .paid-status { font-size: 11px; padding: 2px 8px; border-radius: 12px; display: inline-block; }
                    .paid-status.success { background: #d1fae5; color: #065f46; }
                    .paid-status.warning { background: #fed7aa; color: #92400e; }
                    .paid-status.muted { background: #f1f5f9; color: #64748b; }
                    
                    /* 通用 */
                    .payment-method-group { background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin: 10px 0; border: 1px solid #e2e8f0; }
                    .payment-method-title { font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 8px; }
                    .payment-method-options { display: flex; gap: 16px; flex-wrap: wrap; }
                    .payment-method-options label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
                    
                    .info-note { font-size: 12px; color: #64748b; margin-bottom: 10px; }
                    .subtitle { font-size: 13px; margin: 12px 0 8px; color: #64748b; }
                    
                    /* 利息 */
                    .interest-input-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                    .interest-months { width: auto; min-width: 200px; margin: 0; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    
                    /* 本金 */
                    .principal-input-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                    .principal-amount { width: 200px; text-align: right; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .remaining-principal { font-size: 12px; color: #64748b; margin-top: 8px; }
                    .principal-complete { color: #10b981; font-weight: 500; text-align: center; padding: 16px; background: #d1fae5; border-radius: 8px; }
                    
                    /* 表格 */
                    .payment-history-table { width: 100%; border-collapse: collapse; }
                    .payment-history-table th, .payment-history-table td { border: 1px solid #cbd5e1; padding: 8px; }
                    .payment-history-table th { background: #f8fafc; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .text-muted { color: #94a3b8; }
                    .desc-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    
                    .btn-small { padding: 4px 8px; font-size: 12px; border-radius: 6px; cursor: pointer; }
                    button.success { background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
                    
                    /* 响应式 */
                    @media (max-width: 768px) {
                        .order-summary .summary-grid { grid-template-columns: repeat(2, 1fr); }
                        .collateral-info-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
                        .paid-summary-grid { grid-template-columns: 1fr; gap: 8px; }
                        .interest-input-group, .principal-input-group { flex-direction: column; align-items: stretch; }
                        .interest-months, .principal-amount { width: 100%; }
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
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
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
