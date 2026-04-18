// app-payments.js - 完整修复版 v5.8
// 修复：订单摘要使用表格布局，服务费显示具体金额
// 修复：使用 Utils.MONTHLY_INTEREST_RATE 常量替代硬编码利率

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
            // 修复高危1：使用利率常量
            var currentMonthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);

            // 获取利息和本金支付记录
            var interestPayments = payments.filter(p => p.type === 'interest' && !p.is_voided);
            var principalPayments = payments.filter(p => p.type === 'principal' && !p.is_voided);
            
            interestPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            principalPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai' : '现金', 
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

            // 服务费具体金额
            var serviceFeeAmount = order.service_fee_amount || (order.loan_amount * (order.service_fee_percent || 0) / 100);

            // 利息缴费历史
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'} <tr></tr>`;
            } else {
                for (var i = 0; i < interestPayments.length; i++) {
                    var p = interestPayments[i];
                    var paymentNumber = i + 1;
                    interestRows += `<tr>
                        <td class="text-center">${paymentNumber}</td>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-center">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td>${methodMap[p.payment_method] || '-'}</td>
                    </tr>`;
                }
            }

            // 本金还款历史
            var principalRows = '';
            var cumulativePaid = 0;
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'} <tr></tr>`;
            } else {
                for (var i = 0; i < principalPayments.length; i++) {
                    var p = principalPayments[i];
                    cumulativePaid += p.amount;
                    var remainingAfter = order.loan_amount - cumulativePaid;
                    principalRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td class="text-right">${Utils.formatCurrency(cumulativePaid)}</td>
                        <td class="text-right ${remainingAfter <= 0 ? 'success-text' : 'warning'}">${Utils.formatCurrency(remainingAfter)}</td>
                        <td>${methodMap[p.payment_method] || '-'}</td>
                    </tr>`;
                }
            }

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            var nextInterestAmount = currentMonthlyInterest;

            // 管理费和服务费支付记录
            var adminFeePayment = payments.find(p => p.type === 'admin_fee' && !p.is_voided);
            var serviceFeePayment = payments.find(p => p.type === 'service_fee' && !p.is_voided);
            
            var adminFeePaidInfo = order.admin_fee_paid && adminFeePayment ?
                `${Utils.formatCurrency(order.admin_fee)} (${methodMap[adminFeePayment.payment_method] || '-'} / ${Utils.formatDate(adminFeePayment.date)})` :
                (order.admin_fee_paid ? `${Utils.formatCurrency(order.admin_fee)}` : 'Belum dibayar');
            
            var serviceFeePaidInfo = (order.service_fee_paid || 0) >= serviceFeeAmount && serviceFeePayment ?
                `${Utils.formatCurrency(serviceFeeAmount)} (${methodMap[serviceFeePayment.payment_method] || '-'} / ${Utils.formatDate(serviceFeePayment.date)})` :
                ((order.service_fee_paid || 0) > 0 ? `${Utils.formatCurrency(order.service_fee_paid || 0)}/${Utils.formatCurrency(serviceFeeAmount)}` : 'Belum dibayar');

            var nextInterestNumber = interestPayments.length + 1;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? '缴纳 "利息 & 本金" 费用' : '缴纳 "利息 & 本金" 费用'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${order.order_id}')" class="btn-detail">📄 ${lang === 'id' ? 'Detail Order' : '订单详情'}</button>
                    </div>
                </div>
                
                <!-- 订单摘要 - 表格布局 -->
                <div class="card summary-card">
                    <table class="summary-table">
                        <!-- 第一行：客户信息 -->
                        <tr>
                            <td class="label">${t('customer_name')}</td>
                            <td class="value">${Utils.escapeHtml(order.customer_name)}</td>
                            <td class="label">ID</td>
                            <td class="value order-id">${Utils.escapeHtml(order.order_id)}</td>
                            <td class="label">${t('loan_amount')}</td>
                            <td class="value">${Utils.formatCurrency(order.loan_amount)}</td>
                        </tr>
                        <!-- 第二行：本金和利息信息 -->
                        <tr>
                            <td class="label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</td>
                            <td class="value ${remainingPrincipal > 0 ? 'warning' : 'success'}">${Utils.formatCurrency(remainingPrincipal)}</td>
                            <td class="label">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</td>
                            <td class="value">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                            <td class="label">${lang === 'id' ? 'Jatuh Tempo' : '下次到期'}</td>
                            <td class="value">${nextDueDate}</td>
                        </tr>
                        <!-- 第三行：已付利息 -->
                        <tr>
                            <td class="label">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</td>
                            <td class="value" colspan="5">${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${interestPayments.length} ${lang === 'id' ? 'kali' : '次'})</td>
                        </tr>
                        <!-- 分隔行 -->
                        <tr class="divider"><td colspan="6"></td></tr>
                        <!-- 第四行：典当物品 -->
                        <tr>
                            <td class="label">💎 ${lang === 'id' ? 'Nama Barang' : '物品名称'}</td>
                            <td class="value" colspan="2">${Utils.escapeHtml(order.collateral_name || '-')}</td>
                            <td class="label">💰 ${lang === 'id' ? 'Service Fee' : '服务费'}</td>
                            <td class="value" colspan="2">${Utils.formatCurrency(serviceFeeAmount)} (${order.service_fee_percent || 0}%)</td>
                        </tr>
                        <tr>
                            <td class="label">📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</td>
                            <td class="value" colspan="2">${Utils.formatCurrency(order.admin_fee)}</td>
                            <td class="label">💰 ${lang === 'id' ? 'Pinjaman Dicairkan' : '贷款已发放'}</td>
                            <td class="value success-text" colspan="2">${Utils.formatCurrency(order.loan_amount)} (${order.created_at ? Utils.formatDate(order.created_at) : '-'})</td>
                        </tr>
                        <!-- 分隔行 -->
                        <tr class="divider"><td colspan="6"></td></tr>
                        <!-- 第五行：已缴纳费用状态 -->
                        <tr class="paid-row">
                            <td class="label">✅ ${lang === 'id' ? 'Admin Fee Dibayar' : '管理费已缴'}</td>
                            <td class="value success-text" colspan="2">${adminFeePaidInfo}</td>
                            <td class="label">✅ ${lang === 'id' ? 'Service Fee Dibayar' : '服务费已缴'}</td>
                            <td class="value success-text" colspan="2">${serviceFeePaidInfo}</td>
                        </tr>
                     </table>
                    <div class="summary-note">ℹ️ ${lang === 'id' ? 'Admin Fee, Service Fee, dan pencairan pinjaman telah selesai saat pembuatan order.' : '管理费、服务费和贷款发放已在创建订单时完成。'}</div>
                </div>
                
                <!-- 利息缴费区域 -->
                <div class="card action-card">
                    <div class="card-header"><h3>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3></div>
                    <div class="card-body">
                        <div class="info-box">
                            <span>📌 ${lang === 'id' ? '本次是第' : '本次是第'} <strong>${nextInterestNumber}</strong> ${lang === 'id' ? '次利息支付' : '次利息支付'}</span>
                            <span>💰 ${lang === 'id' ? '应付金额' : '应付金额'}: <strong>${Utils.formatCurrency(nextInterestAmount)}</strong></span>
                        </div>
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
                        <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="btn-action success">✅ ${lang === 'id' ? '确认收到上月利息' : '确认收到上月利息'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th class="text-center">${lang === 'id' ? 'Ke-' : '第几次'}</th><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th class="text-center">${lang === 'id' ? 'Bulan' : '月数'}</th><th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '方式'}</th></tr></thead>
                                <tbody>${interestRows}</tbody>
                             </table>
                        </div>
                    </div>
                </div>
                
                <!-- 本金还款区域 -->
                <div class="card action-card">
                    <div class="card-header"><h3>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3></div>
                    <div class="card-body">
                        <div class="info-box warning-box">
                            <span>📊 ${lang === 'id' ? '已偿还本金' : '已偿还本金'}: <strong>${Utils.formatCurrency(order.principal_paid)}</strong></span>
                            <span>📊 ${lang === 'id' ? '尚欠本金' : '尚欠本金'}: <strong class="${remainingPrincipal > 0 ? 'text-warning' : 'text-success'}">${Utils.formatCurrency(remainingPrincipal)}</strong></span>
                        </div>
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
                        <button onclick="APP.payPrincipalWithMethod('${order.order_id}')" class="btn-action success">✅ ${lang === 'id' ? '确认收到本金还款' : '确认收到本金还款'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th class="text-right">${lang === 'id' ? 'Jumlah Bayar' : '还款金额'}</th><th class="text-right">${lang === 'id' ? 'Total Dibayar' : '累计已还'}</th><th class="text-right">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</th><th>${lang === 'id' ? 'Metode' : '方式'}</th></tr></thead>
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
                    
                    /* 订单摘要表格样式 */
                    .summary-card { padding: 12px 16px; margin-bottom: 20px; }
                    .summary-table { width: 100%; border-collapse: collapse; }
                    .summary-table td { padding: 8px 6px; border: none; }
                    .summary-table .label { font-weight: 500; color: #64748b; width: 110px; font-size: 0.8rem; }
                    .summary-table .value { font-weight: 600; color: #1e293b; font-size: 0.85rem; }
                    .summary-table .value.warning { color: #f59e0b; }
                    .summary-table .value.success { color: #10b981; }
                    .summary-table .order-id { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block; }
                    .summary-table .divider td { border-top: 1px solid #e2e8f0; padding: 4px 0; }
                    .summary-table .paid-row { background: #f0fdf4; border-radius: 8px; }
                    .summary-table .paid-row td { padding: 6px; }
                    .success-text { color: #10b981; font-weight: 600; }
                    .summary-note { font-size: 0.7rem; color: #94a3b8; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e2e8f0; text-align: center; }
                    
                    /* 缴费卡片 */
                    .action-card { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                    .action-card .card-header { background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
                    .action-card .card-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }
                    .action-card .card-body { padding: 16px; }
                    .action-card .card-history { border-top: 1px solid #e2e8f0; padding: 12px 16px; background: #fafafa; }
                    
                    .info-box { background: #e0f2fe; padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; font-size: 0.85rem; }
                    .warning-box { background: #fef3c7; }
                    .info-box strong { font-size: 1rem; }
                    
                    .action-input-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
                    .action-label { font-weight: 600; font-size: 0.85rem; color: #475569; min-width: 80px; }
                    .action-select { padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; background: white; min-width: 200px; }
                    .action-input { padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.85rem; width: 200px; text-align: right; }
                    
                    .payment-method-group { background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin: 12px 0; border: 1px solid #e2e8f0; }
                    .payment-method-title { font-size: 0.7rem; font-weight: 500; color: #64748b; margin-bottom: 6px; }
                    .payment-method-options { display: flex; gap: 20px; flex-wrap: wrap; }
                    .payment-method-options label { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; cursor: pointer; }
                    
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
                    .text-warning { color: #f59e0b; }
                    .text-success { color: #10b981; }
                    
                    @media (max-width: 768px) {
                        .summary-table, .summary-table tbody, .summary-table tr, .summary-table td { display: block; width: 100%; }
                        .summary-table tr { margin-bottom: 8px; }
                        .summary-table td { display: flex; justify-content: space-between; padding: 4px 0; }
                        .summary-table .label { width: auto; min-width: 100px; }
                        .summary-table .value { text-align: right; }
                        .summary-table .divider td { display: none; }
                        .action-input-group { flex-direction: column; align-items: stretch; }
                        .action-select, .action-input { width: 100%; }
                        .payment-method-options { justify-content: flex-start; }
                        .info-box { flex-direction: column; align-items: center; text-align: center; }
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
        
        var order = await SUPABASE.getOrder(orderId);
        // 修复高危1：使用利率常量计算当前月利息
        var remainingPrincipal = order.loan_amount - order.principal_paid;
        var currentMonthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);
        var nextInterestNumber = (order.interest_paid_months || 0) + 1;
        
        if (confirm(lang === 'id' 
            ? `Konfirmasi penerimaan bunga bulan ke-${nextInterestNumber} untuk order ${order.order_id}?\n\nJumlah: ${Utils.formatCurrency(currentMonthlyInterest * months)}\nMetode: ${methodName}`
            : `确认收到订单 ${order.order_id} 的第 ${nextInterestNumber} 期利息？\n\n金额: ${Utils.formatCurrency(currentMonthlyInterest * months)}\n方式: ${methodName}`)) {
            try {
                await Order.recordInterestPayment(orderId, months, method);
                alert(lang === 'id' ? `✅ Bunga bulan ke-${nextInterestNumber} berhasil dicatat` : `✅ 第 ${nextInterestNumber} 期利息记录成功`);
                window.location.reload();
            } catch (error) { 
                if (error.message && error.message.includes('订单数据已被其他操作修改')) {
                    alert(lang === 'id' 
                        ? '⚠️ 系统繁忙，请稍后点击刷新页面重试。\n\n如果问题持续，请联系管理员。'
                        : '⚠️ 系统繁忙，请稍后点击刷新页面重试。\n\n如果问题持续，请联系管理员。');
                } else {
                    alert('Error: ' + (error.message || error));
                }
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
        
        var order = await SUPABASE.getOrder(orderId);
        var remainingAfter = order.principal_remaining - amount;
        
        if (confirm(lang === 'id' 
            ? `Konfirmasi penerimaan pembayaran pokok untuk order ${order.order_id}?\n\nJumlah: ${Utils.formatCurrency(amount)}\nSisa pokok setelah pembayaran: ${Utils.formatCurrency(remainingAfter)}\nMetode: ${targetName}`
            : `确认收到订单 ${order.order_id} 的本金还款？\n\n金额: ${Utils.formatCurrency(amount)}\n还款后剩余本金: ${Utils.formatCurrency(remainingAfter)}\n方式: ${targetName}`)) {
            try {
                await Order.recordPrincipalPayment(orderId, amount, target);
                alert(lang === 'id' ? '✅ Pembayaran pokok berhasil dicatat' : '✅ 本金还款记录成功');
                window.location.reload();
            } catch (error) {
                if (error.message && error.message.includes('订单数据已被其他操作修改')) {
                    alert(lang === 'id' 
                        ? '⚠️ 系统繁忙，请稍后点击刷新页面重试。\n\n如果问题持续，请联系管理员。'
                        : '⚠️ 系统繁忙，请稍后点击刷新页面重试。\n\n如果问题持续，请联系管理员。');
                } else {
                    alert('Error: ' + (error.message || error));
                }
            }
        }
    }
};

for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') window.APP[key] = PaymentsModule[key];
}
