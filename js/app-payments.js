// app-payments.js - v8.2（精简拦截提示）

window.APP = window.APP || {};

const PaymentsModule = {

    showPayment: async function(orderId) {
        const profile = await SUPABASE.getCurrentProfile();

        if (!profile) {
            alert(Utils.lang === 'id' ? '请重新登录' : '请重新登录');
            APP.goBack();
            return;
        }

        if (profile.role === 'admin') {
            alert(Utils.lang === 'id' ? '门店业务' : '门店业务');
            APP.goBack();
            return;
        }

        if (!profile.store_id) {
            alert(Utils.lang === 'id' ? '账号未关联门店' : '账号未关联门店');
            APP.goBack();
            return;
        }

        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            
            if (order.store_id !== profile.store_id) {
                alert(Utils.lang === 'id' ? '无权访问此订单' : '无权访问此订单');
                APP.goBack();
                return;
            }

            var { payments } = await SUPABASE.getPaymentHistory(orderId);

            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            
            var loanAmount = order.loan_amount || 0;
            var principalPaid = order.principal_paid || 0;
            var remainingPrincipal = loanAmount - principalPaid;
            var currentMonthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);

            var interestPayments = payments.filter(p => p.type === 'interest' && !p.is_voided);
            var principalPayments = payments.filter(p => p.type === 'principal' && !p.is_voided);
            
            interestPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            principalPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai' : '现金', 
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

            var serviceFeeAmount = order.service_fee_amount || (loanAmount * (order.service_fee_percent || 0) / 100);
            var serviceFeePaid = order.service_fee_paid || 0;
            var isServiceFeePaid = serviceFeePaid >= serviceFeeAmount;

            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? '暂无利息记录' : '暂无利息记录'}</td></tr>`;
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

            var principalRows = '';
            var cumulativePaid = 0;
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? '暂无本金记录' : '暂无本金记录'}</td></tr>`;
            } else {
                for (var i = 0; i < principalPayments.length; i++) {
                    var p = principalPayments[i];
                    cumulativePaid += p.amount;
                    var remainingAfter = loanAmount - cumulativePaid;
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
            var nextInterestNumber = interestPayments.length + 1;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? '缴纳利息与本金' : '缴纳利息与本金'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${Utils.escapeAttr(order.order_id)}')" class="btn-detail">📄 ${lang === 'id' ? '订单详情' : '订单详情'}</button>
                    </div>
                </div>
                
                <div class="card summary-card">
                    <table class="summary-table">
                        <tr><td class="label">${t('customer_name')}</td><td class="value">${Utils.escapeHtml(order.customer_name)}</td>
                            <td class="label">ID</td><td class="value order-id">${Utils.escapeHtml(order.order_id)}</td>
                            <td class="label">${t('loan_amount')}</td><td class="value">${Utils.formatCurrency(loanAmount)}</td>
                        </tr>
                        <tr><td class="label">${lang === 'id' ? '剩余本金' : '剩余本金'}</td>
                            <td class="value ${remainingPrincipal > 0 ? 'warning' : 'success'}">${Utils.formatCurrency(remainingPrincipal)}</td>
                            <td class="label">${lang === 'id' ? '月利息' : '月利息'}</td>
                            <td class="value">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                            <td class="label">${lang === 'id' ? '下次到期' : '下次到期'}</td>
                            <td class="value">${nextDueDate}</td>
                        </tr>
                        <tr><td class="label">${lang === 'id' ? '已付利息' : '已付利息'}</td>
                            <td class="value" colspan="5">${order.interest_paid_months || 0} ${lang === 'id' ? '个月' : '个月'} (${interestPayments.length} 次)</td>
                        </tr>
                    </table>
                </div>
                
                <div class="card action-card">
                    <div class="card-header"><h3>💰 ${lang === 'id' ? '利息缴费' : '利息缴费'}</h3></div>
                    <div class="card-body">
                        <div class="info-box">
                            <span>📌 ${lang === 'id' ? '本次是第' : '本次是第'} <strong>${nextInterestNumber}</strong> ${lang === 'id' ? '次利息支付' : '次利息支付'}</span>
                            <span>💰 ${lang === 'id' ? '应付金额' : '应付金额'}: <strong>${Utils.formatCurrency(nextInterestAmount)}</strong></span>
                        </div>
                        <div class="action-input-group">
                            <label class="action-label">${lang === 'id' ? '收取' : '收取'}:</label>
                            <select id="interestMonths" class="action-select">${interestOptions}</select>
                        </div>
                        <div class="payment-method-group">
                            <div class="payment-method-title">${lang === 'id' ? '入账方式' : '入账方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        <button onclick="APP.payInterestWithMethod('${Utils.escapeAttr(order.order_id)}')" class="btn-action success">✅ ${lang === 'id' ? '确认收款' : '确认收款'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? '利息缴费历史' : '利息缴费历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th class="text-center">${lang === 'id' ? '第几次' : '第几次'}</th><th>${lang === 'id' ? '日期' : '日期'}</th><th class="text-center">${lang === 'id' ? '月数' : '月数'}</th><th class="text-right">${lang === 'id' ? '金额' : '金额'}</th><th>${lang === 'id' ? '方式' : '方式'}</th></tr></thead>
                                <tbody>${interestRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div class="card action-card">
                    <div class="card-header"><h3>🏦 ${lang === 'id' ? '本金还款' : '本金还款'}</h3></div>
                    <div class="card-body">
                        <div class="info-box warning-box">
                            <span>📊 ${lang === 'id' ? '已还本金' : '已还本金'}: <strong>${Utils.formatCurrency(principalPaid)}</strong></span>
                            <span>📊 ${lang === 'id' ? '尚欠本金' : '尚欠本金'}: <strong class="${remainingPrincipal > 0 ? 'text-warning' : 'text-success'}">${Utils.formatCurrency(remainingPrincipal)}</strong></span>
                        </div>
                        <div class="action-input-group">
                            <label class="action-label">${lang === 'id' ? '还款金额' : '还款金额'}:</label>
                            <input type="text" id="principalAmount" class="action-input" placeholder="0">
                        </div>
                        <div class="payment-method-group">
                            <div class="payment-method-title">${lang === 'id' ? '入账方式' : '入账方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ${t('bank')}</label>
                                <label><input type="radio" name="principalTarget" value="cash"> 🏦 ${t('cash')}</label>
                            </div>
                        </div>
                        <button onclick="APP.payPrincipalWithMethod('${Utils.escapeAttr(order.order_id)}')" class="btn-action success">✅ ${lang === 'id' ? '确认收款' : '确认收款'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? '本金还款历史' : '本金还款历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th>${lang === 'id' ? '日期' : '日期'}</th><th class="text-right">${lang === 'id' ? '还款金额' : '还款金额'}</th><th class="text-right">${lang === 'id' ? '累计已还' : '累计已还'}</th><th class="text-right">${lang === 'id' ? '剩余本金' : '剩余本金'}</th><th>${lang === 'id' ? '方式' : '方式'}</th></tr></thead>
                                <tbody>${principalRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>`;

            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            alert(Utils.lang === 'id' ? '加载失败：' + error.message : '加载失败：' + error.message);
            APP.goBack();
        }
    },

    // 其余函数保持不变（payInterestWithMethod, payPrincipalWithMethod, printSettlementReceipt）
    // ... 省略，保持原有代码不变
};

// 辅助函数
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') window.APP[key] = PaymentsModule[key];
}

window.APP.printSettlementReceipt = PaymentsModule.printSettlementReceipt.bind(PaymentsModule);

if (!Utils.escapeAttr) {
    Utils.escapeAttr = escapeAttr;
}

console.log('✅ app-payments.js v8.2 已加载 - 精简拦截提示');
