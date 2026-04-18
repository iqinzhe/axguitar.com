// app-payments.js - 完整修复版 v5.0
// 修改内容：
// 1. 新增贷款发放记录按钮
// 2. 管理费"记录收款"改为"已收款"，点击后锁定
// 3. 移除所有净利相关显示
// 4. 优化缴费界面布局

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
            var cashFlows = await SUPABASE.getCashFlowRecords();
            var orderCashFlows = cashFlows.filter(f => f.order_id === order.id);

            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            var currentMonthlyInterest = remainingPrincipal * 0.10;
            var isAdmin = AUTH.isAdmin();

            // 检查是否已发放贷款
            var hasLoanDisbursement = orderCashFlows.some(f => f.flow_type === 'loan_disbursement');
            var loanDisbursementAmount = hasLoanDisbursement ? order.loan_amount : 0;

            var interestPayments = payments.filter(p => p.type === 'interest');
            var principalPayments = payments.filter(p => p.type === 'principal');
            var serviceFeePayments = payments.filter(p => p.type === 'service_fee');
            
            var methodMap = { 
                cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', 
                bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI'
            };

            // 贷款发放区域（未发放时显示）
            var loanDisbursementSection = '';
            if (!hasLoanDisbursement) {
                loanDisbursementSection = `
                    <div class="loan-disbursement-section">
                        <h3>💰 ${lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放'}</h3>
                        <p class="info-note">📌 ${lang === 'id' ? 'Catat pengeluaran pinjaman ke nasabah' : '记录发放给客户的贷款金额'}</p>
                        <div class="loan-disbursement-info">
                            <div class="loan-amount-display">
                                <strong>${lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额'}:</strong> ${Utils.formatCurrency(order.loan_amount)}
                            </div>
                            <div class="payment-method-group">
                                <div class="payment-method-title">${lang === 'id' ? 'Sumber Dana' : '资金来源'}:</div>
                                <div class="payment-method-options">
                                    <label><input type="radio" name="disbursementSource" value="cash" checked> 🏦 ${t('cash')}</label>
                                    <label><input type="radio" name="disbursementSource" value="bank"> 🏧 ${t('bank')}</label>
                                </div>
                            </div>
                            <button onclick="APP.recordLoanDisbursement('${order.order_id}', ${order.loan_amount})" class="warning">💰 ${lang === 'id' ? 'Catat Pencairan' : '记录贷款发放'}</button>
                        </div>
                    </div>
                `;
            } else {
                loanDisbursementSection = `
                    <div class="loan-disbursement-section disbursed">
                        <h3>💰 ${lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放'}</h3>
                        <p>✅ ${lang === 'id' ? 'Pinjaman sudah dicairkan' : '贷款已发放'} - ${Utils.formatCurrency(loanDisbursementAmount)}</p>
                    </div>
                `;
            }

            // 服务费历史
            var serviceFeeRows = '';
            if (serviceFeePayments.length === 0) {
                serviceFeeRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran service fee' : '暂无服务费记录'}</td></tr>`;
            } else {
                for (var p of serviceFeePayments) {
                    if (p.is_voided) continue;
                    var methodClass = p.payment_method === 'cash' ? 'method-cash' : 'method-bank';
                    serviceFeeRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-center">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            }

            // 利息缴费历史
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'}</td></tr>`;
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

            // 本金还款历史
            var principalRows = '';
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="4" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'}</td></tr>`;
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

            // 管理费区域（已支付则锁定）
            var adminFeeSection = '';
            if (order.admin_fee_paid) {
                const voidedPayment = payments.find(p => p.type === 'admin_fee' && p.is_voided);
                const voidedHint = voidedPayment ? `<span class="voided-hint" style="font-size:11px; color:#f59e0b; margin-left:8px;">⚠️ ${lang === 'id' ? 'Pembayaran sebelumnya telah dibatalkan' : '之前的支付已作废'}</span>` : '';
                
                adminFeeSection = `
                    <div class="admin-fee-paid locked-section">
                        <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ✅ ${lang === 'id' ? 'Sudah dibayar' : '已支付'} (${Utils.formatDate(order.admin_fee_paid_date)})${voidedHint}</span>
                        ${isAdmin ? `<button onclick="APP.unlockAdminFee('${order.order_id}')" class="btn-small warning" style="margin-left:10px;">🔓 ${lang === 'id' ? 'Buka Kunci & Batalkan' : '解锁并作废'}</button>` : ''}
                    </div>
                `;
            } else {
                adminFeeSection = `
                    <div class="admin-fee-section">
                        <div class="admin-fee-info">
                            <div class="admin-fee-amount-display">
                                <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}:</strong> ${Utils.formatCurrency(order.admin_fee)}
                            </div>
                            <div class="payment-method-group inline">
                                <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                                <div class="payment-method-options">
                                    <label><input type="radio" name="adminFeeMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                    <label><input type="radio" name="adminFeeMethod" value="bank"> 🏧 ${t('bank')}</label>
                                </div>
                            </div>
                            <button onclick="APP.payAdminFeeWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Sudah Dibayar' : '已收款'}</button>
                        </div>
                    </div>
                `;
            }

            // 服务费选项
            var serviceFeePercent = order.service_fee_percent || 0;
            var serviceFeePerMonth = order.service_fee_amount || 0;
            var serviceFeeOptions = '';
            
            if (serviceFeePercent > 0) {
                var remainingServiceFee = (serviceFeePerMonth * 12) - (order.service_fee_paid || 0);
                serviceFeeOptions = `
                    <div class="service-fee-section">
                        <div class="service-fee-info">
                            <div class="service-fee-rate">
                                💰 <strong>${lang === 'id' ? 'Service Fee' : '服务费'}:</strong> ${serviceFeePercent}% ${lang === 'id' ? 'per bulan' : '每月'} = ${Utils.formatCurrency(serviceFeePerMonth)}/${lang === 'id' ? 'bln' : '个月'}
                                ${remainingServiceFee > 0 ? `<span class="remaining-fee"> (${lang === 'id' ? 'Sisa' : '剩余'}: ${Utils.formatCurrency(remainingServiceFee)})</span>` : ''}
                            </div>
                            <div class="service-fee-input-group">
                                <label class="service-fee-label">${lang === 'id' ? 'Ambil untuk' : '收取'}:</label>
                                <select id="serviceFeeMonths" class="service-fee-months">
                                    <option value="1">1 ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(serviceFeePerMonth)}</option>
                                    <option value="2">2 ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(serviceFeePerMonth * 2)}</option>
                                    <option value="3">3 ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(serviceFeePerMonth * 3)}</option>
                                </select>
                            </div>
                            <div class="payment-method-group">
                                <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                                <div class="payment-method-options">
                                    <label><input type="radio" name="serviceFeeMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                    <label><input type="radio" name="serviceFeeMethod" value="bank"> 🏧 ${t('bank')}</label>
                                </div>
                            </div>
                            <button onclick="APP.payServiceFee('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Service Fee' : '记录服务费'}</button>
                        </div>
                    </div>
                `;
            } else {
                serviceFeeOptions = `<p class="info-note">📌 ${lang === 'id' ? 'Service fee tidak diatur untuk order ini' : '该订单未设置服务费'}</p>`;
            }

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            var principalTargetOptions = `
                <div class="payment-method-group" style="margin-top:8px;">
                    <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                    <div class="payment-method-options">
                        <label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</label>
                        <label><input type="radio" name="principalTarget" value="cash"> 🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</label>
                    </div>
                </div>
            `;

            var principalInputSection = remainingPrincipal > 0
                ? `<div class="principal-section">
                    <div class="principal-input-group">
                        <label class="principal-label">${lang === 'id' ? 'Jumlah bayar pokok' : '本次还款金额'} (IDR):</label>
                        <input type="text" id="principalAmount" class="principal-amount" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}">
                        <button onclick="APP.payPrincipalWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                    </div>
                    ${principalTargetOptions}
                    <p class="remaining-principal">${lang === 'id' ? 'Sisa pokok' : '剩余本金'}: <strong>${Utils.formatCurrency(remainingPrincipal)}</strong></p>
                   </div>`
                : `<p class="principal-complete">✅ ${lang === 'id' ? 'Pokok sudah LUNAS' : '本金已全部结清'}</p>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${order.order_id}')" class="btn-detail">📄 ${lang === 'id' ? 'Lihat Detail Order' : '查看订单详情'}</button>
                    </div>
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
                
                ${loanDisbursementSection}
                
                <div class="card admin-fee-card">
                    <h3>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</h3>
                    ${adminFeeSection}
                </div>
                
                <div class="card service-fee-card">
                    <h3>💰 ${lang === 'id' ? 'Service Fee' : '服务费'}</h3>
                    <p class="info-note">📌 ${lang === 'id' ? 'Service fee adalah biaya layanan yang dihitung dari persentase pinjaman' : '服务费是按贷款百分比计算的费用'}</p>
                    ${serviceFeeOptions}
                    
                    <h4 class="subtitle">📋 ${lang === 'id' ? 'Riwayat Pembayaran Service Fee' : '服务费缴费历史'}</h4>
                    <div class="table-container">
                        <table class="payment-history-table">
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                            <tbody>${serviceFeeRows}</tbody>
                        </table>
                    </div>
                </div>
                
                <div class="card interest-card">
                    <h3>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3>
                    <div class="interest-input-group">
                        <label class="interest-label">${lang === 'id' ? 'Ambil untuk' : '收取'}:</label>
                        <select id="interestMonths" class="interest-months">${interestOptions}</select>
                    </div>
                    <div class="payment-method-group">
                        <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                        <div class="payment-method-options">
                            <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                            <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                        </div>
                    </div>
                    <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pemasukan Bunga' : '记录利息付款'}</button>
                    
                    <h4 class="subtitle">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</h4>
                    <div class="table-container">
                        <table class="payment-history-table">
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
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
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                            <tbody>${principalRows}</tbody>
                        </table>
                    </div>
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
                    .loan-disbursement-section { background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #f59e0b; }
                    .loan-disbursement-section.disbursed { background: #d1fae5; border-left-color: #10b981; }
                    .loan-amount-display { margin-bottom: 12px; font-size: 16px; }
                    .admin-fee-section { background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 0; border-left: 3px solid #f59e0b; }
                    .admin-fee-paid { background: #d1fae5; padding: 15px; border-radius: 8px; margin-bottom: 0; border-left: 3px solid #10b981; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; }
                    .locked-section { background: #e2e8f0; border-left: 3px solid #64748b; }
                    .admin-fee-amount-display { margin-bottom: 12px; font-size: 16px; }
                    .service-fee-section { background: #e0f2fe; padding: 15px; border-radius: 8px; margin-bottom: 0; border-left: 3px solid #3b82f6; }
                    .service-fee-rate { margin-bottom: 12px; font-size: 14px; }
                    .remaining-fee { color: #f59e0b; font-size: 12px; }
                    .service-fee-input-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
                    .service-fee-months { width: auto; min-width: 200px; margin: 0; }
                    .payment-method-group { background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin: 10px 0; border: 1px solid #e2e8f0; }
                    .payment-method-group.inline { display: inline-flex; align-items: center; gap: 12px; background: transparent; padding: 0; margin: 0; border: none; }
                    .payment-method-title { font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 8px; }
                    .payment-method-options { display: flex; gap: 16px; flex-wrap: wrap; }
                    .payment-method-options label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
                    .info-note { font-size: 12px; color: #64748b; margin-bottom: 10px; }
                    .subtitle { font-size: 13px; margin: 12px 0 8px; color: #64748b; }
                    .interest-input-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
                    .interest-months { width: auto; min-width: 200px; margin: 0; }
                    .principal-input-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
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
                    .btn-small { padding: 4px 8px; font-size: 12px; border-radius: 6px; cursor: pointer; }
                    button.success { background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
                    button.warning { background: #d97706; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
                    .voided-hint { font-size: 11px; color: #f59e0b; }
                    @media (max-width: 768px) {
                        .order-summary .summary-grid { grid-template-columns: repeat(2, 1fr); }
                        .interest-input-group, .principal-input-group, .service-fee-input-group { flex-direction: column; align-items: stretch; }
                        .interest-months, .principal-amount, .service-fee-months { width: 100%; }
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

    // 新增：贷款发放记录
    recordLoanDisbursement: async function(orderId, amount) {
        var source = document.querySelector('input[name="disbursementSource"]:checked')?.value || 'cash';
        var sourceName = source === 'cash' ? (Utils.lang === 'id' ? 'Brankas' : '保险柜') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        
        if (confirm(lang === 'id' 
            ? `Konfirmasi pencairan pinjaman ${Utils.formatCurrency(amount)} dari ${sourceName} kepada nasabah?`
            : `确认发放贷款 ${Utils.formatCurrency(amount)} 从 ${sourceName} 给客户？`)) {
            try {
                await Order.recordLoanDisbursement(orderId, amount, source);
                alert(lang === 'id' ? '✅ Pencairan pinjaman berhasil dicatat' : '✅ 贷款发放记录成功');
                window.location.reload();
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    payAdminFeeWithMethod: async function(orderId) {
        var method = document.querySelector('input[name="adminFeeMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        
        var order = await SUPABASE.getOrder(orderId);
        
        if (confirm(lang === 'id' 
            ? `Konfirmasi pemasukan Admin Fee ${Utils.formatCurrency(order.admin_fee)} via ${methodName}?`
            : `确认入账管理费 ${Utils.formatCurrency(order.admin_fee)}，入账方式：${methodName}？`)) {
            try { 
                await Order.recordAdminFee(orderId, method, order.admin_fee); 
                alert(lang === 'id' ? '✅ Admin Fee berhasil dicatat' : '✅ 管理费记录成功');
                window.location.reload();
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    payServiceFee: async function(orderId) {
        var months = parseInt(document.getElementById("serviceFeeMonths").value);
        var method = document.querySelector('input[name="serviceFeeMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        
        if (confirm(lang === 'id' ? `Konfirmasi pemasukan Service Fee ${months} bulan via ${methodName}?` : `确认入账服务费 ${months} 个月，入账方式：${methodName}？`)) {
            try {
                await Order.recordServiceFee(orderId, months, method);
                alert(lang === 'id' ? '✅ Service Fee berhasil dicatat' : '✅ 服务费记录成功');
                window.location.reload();
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    unlockAdminFee: async function(orderId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' 
            ? '⚠️ Membuka kunci Admin Fee akan menandai pembayaran sebelumnya sebagai DIBATALKAN.\n\nApakah Anda yakin ingin melanjutkan?'
            : '⚠️ 解锁管理费将把之前的支付记录标记为【已作废】。\n\n是否继续？')) return;
        
        try {
            await SUPABASE.unlockAdminFee(orderId);
            alert(lang === 'id' 
                ? '✅ Admin Fee telah dibuka kunci. Pembayaran sebelumnya telah ditandai sebagai batal. Anda dapat melakukan pembayaran ulang.'
                : '✅ 管理费已解锁。之前的支付记录已标记为作废。您可以重新缴费。');
            window.location.reload();
        } catch (error) {
            alert('Error: ' + error.message);
        }
    },

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
