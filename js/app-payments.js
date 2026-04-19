// app-payments.js - 完整修复版 v6.0
// 修复内容：
// 1. 管理员（总部）不能进行缴费操作
// 2. 确保订单属于当前用户门店
// 3. 添加门店关联检查

window.APP = window.APP || {};

const PaymentsModule = {

    showPayment: async function(orderId) {
        // ✅ 权限检查1：总部不能进行缴费操作
        if (AUTH.isAdmin()) {
            alert(Utils.lang === 'id' 
                ? '⚠️ Administrator tidak dapat melakukan pembayaran. Silakan login sebagai Manajer Toko atau Staf.'
                : '⚠️ 管理员不能进行缴费操作。请使用店长或员工账号登录。');
            APP.goBack();
            return;
        }
        
        // ✅ 权限检查2：检查当前用户是否有门店
        const profile = await SUPABASE.getCurrentProfile();
        if (!profile?.store_id) {
            alert(Utils.lang === 'id' 
                ? '⚠️ Akun Anda tidak terhubung dengan toko mana pun. Hubungi administrator.'
                : '⚠️ 您的账号未关联任何门店。请联系管理员。');
            APP.goBack();
            return;
        }
        
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            
            // ✅ 权限检查3：确保订单属于当前用户的门店
            if (order.store_id !== profile.store_id) {
                alert(Utils.lang === 'id' 
                    ? '⚠️ Anda tidak memiliki akses ke pesanan ini. Pesanan ini milik toko lain.'
                    : '⚠️ 您无权访问此订单。此订单属于其他门店。');
                APP.goBack();
                return;
            }

            var { payments } = await SUPABASE.getPaymentHistory(orderId);

            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            var currentMonthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);

            var interestPayments = payments.filter(p => p.type === 'interest' && !p.is_voided);
            var principalPayments = payments.filter(p => p.type === 'principal' && !p.is_voided);
            
            interestPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            principalPayments.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai' : '现金', 
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

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
                principalRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'} </td></tr>`;
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
                
                <div class="card summary-card">
                    <table class="summary-table">
                        <tr>
                            <td class="label">${t('customer_name')}</td>
                            <td class="value">${Utils.escapeHtml(order.customer_name)}</td>
                            <td class="label">ID</td>
                            <td class="value order-id">${Utils.escapeHtml(order.order_id)}</td>
                            <td class="label">${t('loan_amount')}</td>
                            <td class="value">${Utils.formatCurrency(order.loan_amount)}</td>
                        </tr>
                        <tr>
                            <td class="label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</td>
                            <td class="value ${remainingPrincipal > 0 ? 'warning' : 'success'}">${Utils.formatCurrency(remainingPrincipal)}</td>
                            <td class="label">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</td>
                            <td class="value">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                            <td class="label">${lang === 'id' ? 'Jatuh Tempo' : '下次到期'}</td>
                            <td class="value">${nextDueDate}</td>
                        </tr>
                        <tr>
                            <td class="label">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</td>
                            <td class="value" colspan="5">${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${interestPayments.length} ${lang === 'id' ? 'kali' : '次'})</td>
                        </tr>
                        <tr class="divider"><td colspan="6"> ndash;</tr>
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
                        <tr class="divider"><td colspan="6"> ndash;</tr>
                        <tr class="paid-row">
                            <td class="label">✅ ${lang === 'id' ? 'Admin Fee Dibayar' : '管理费已缴'}</td>
                            <td class="value success-text" colspan="2">${adminFeePaidInfo}</td>
                            <td class="label">✅ ${lang === 'id' ? 'Service Fee Dibayar' : '服务费已缴'}</td>
                            <td class="value success-text" colspan="2">${serviceFeePaidInfo}</td>
                        </tr>
                    </table>
                    <div class="summary-note">ℹ️ ${lang === 'id' ? 'Admin Fee, Service Fee, dan pencairan pinjaman telah selesai saat pembuatan order.' : '管理费、服务费和贷款发放已在创建订单时完成。'}</div>
                </div>
                
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
                </div>`;

            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran' : '加载缴费页面失败');
            this.goBack();
        }
    },

    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai' : '现金') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        
        var order = await SUPABASE.getOrder(orderId);
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
