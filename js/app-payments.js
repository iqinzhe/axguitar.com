// app-payments.js - v8.1（修复：PaymentsModule 对象缺少闭合括号 — 缴费按钮失效根因）

window.APP = window.APP || {};

const PaymentsModule = {

    showPayment: async function(orderId) {
        // ✅ 统一使用 SUPABASE.getCurrentProfile() 作为唯一角色数据源
        const profile = await SUPABASE.getCurrentProfile();

        // 检查1：用户是否已登录
        if (!profile) {
            alert(Utils.lang === 'id'
                ? '⚠️ 您的会话已过期，请重新登录。'
                : '⚠️ 您的会话已过期，请重新登录。');
            APP.goBack();
            return;
        }

        // 检查2：admin 不能进行缴费操作（总部账号不做业务）
        if (profile.role === 'admin') {
            alert(Utils.lang === 'id'
                ? '⚠️ Administrator tidak dapat melakukan pembayaran. Silakan login sebagai Manajer Toko atau Staf.'
                : '⚠️ 管理员不能进行缴费操作。请使用店长或员工账号登录。');
            APP.goBack();
            return;
        }

        // 检查3：门店员工必须关联门店
        if (!profile.store_id) {
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
            
            // 检查4：确保订单属于当前用户的门店
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
            
            // 空值保护：剩余本金和月利息计算
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

            // 利息缴费历史
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'}</td></tr>`;
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
                principalRows = `<tr><td colspan="5" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'}</td></tr>`;
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

            var adminFeePayment = payments.find(p => p.type === 'admin_fee' && !p.is_voided);
            var serviceFeePayment = payments.find(p => p.type === 'service_fee' && !p.is_voided);
            
            var adminFeePaidInfo = order.admin_fee_paid && adminFeePayment
                ? `${Utils.formatCurrency(order.admin_fee)} (${methodMap[adminFeePayment.payment_method] || '-'} / ${Utils.formatDate(adminFeePayment.date)})`
                : (order.admin_fee_paid ? `${Utils.formatCurrency(order.admin_fee)}` : 'Belum dibayar');
            
            var serviceFeePaidInfo = isServiceFeePaid && serviceFeePayment
                ? `${Utils.formatCurrency(serviceFeeAmount)} (${methodMap[serviceFeePayment.payment_method] || '-'} / ${Utils.formatDate(serviceFeePayment.date)})`
                : (serviceFeePaid > 0 ? `${Utils.formatCurrency(serviceFeePaid)}/${Utils.formatCurrency(serviceFeeAmount)}` : 'Belum dibayar');

            var nextInterestNumber = interestPayments.length + 1;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? '缴纳 "利息 & 本金" 费用' : '缴纳 "利息 & 本金" 费用'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${Utils.escapeAttr(order.order_id)}')" class="btn-detail">📄 ${lang === 'id' ? 'Detail Order' : '订单详情'}</button>
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
                            <td class="value">${Utils.formatCurrency(loanAmount)}</td>
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
                            <td class="value" colspan="5">${order.interest_paid_months || 0} ${lang === 'id' ? 'bulan' : '个月'} (${interestPayments.length} ${lang === 'id' ? 'kali' : '次'})</td>
                        </tr>
                        <tr class="divider"><td colspan="6"></td></tr>
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
                            <td class="value success-text" colspan="2">${Utils.formatCurrency(loanAmount)} (${order.created_at ? Utils.formatDate(order.created_at) : '-'})</td>
                        </tr>
                        <tr class="divider"><td colspan="6"></td></tr>
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
                        <button onclick="APP.payInterestWithMethod('${Utils.escapeAttr(order.order_id)}')" class="btn-action success">✅ ${lang === 'id' ? '确认收到上月利息' : '确认收到上月利息'}</button>
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
                            <span>📊 ${lang === 'id' ? '已偿还本金' : '已偿还本金'}: <strong>${Utils.formatCurrency(principalPaid)}</strong></span>
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
                        <button onclick="APP.payPrincipalWithMethod('${Utils.escapeAttr(order.order_id)}')" class="btn-action success">✅ ${lang === 'id' ? '确认收到本金还款' : '确认收到本金还款'}</button>
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
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran: ' + error.message : '加载缴费页面失败：' + error.message);
            APP.goBack();
        }
    },

    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金（保险柜）') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        
        var order = await SUPABASE.getOrder(orderId);
        
        // 空值保护
        var loanAmount = order.loan_amount || 0;
        var principalPaid = order.principal_paid || 0;
        var remainingPrincipal = loanAmount - principalPaid;
        var monthlyRate = Utils.MONTHLY_INTEREST_RATE || 0.10;
        var currentMonthlyInterest = remainingPrincipal * monthlyRate;
        var totalInterest = currentMonthlyInterest * months;
        var nextInterestNumber = (order.interest_paid_months || 0) + 1;
        var endNumber = nextInterestNumber + months - 1;
        
        // 详细预览明细（替代简单confirm）
        var previewMsg = lang === 'id'
            ? [
                `📋 KONFIRMASI PENERIMAAN BUNGA`,
                `────────────────────────────`,
                `Order   : ${order.order_id}`,
                `Nasabah : ${order.customer_name}`,
                `────────────────────────────`,
                `Periode : Bunga ke-${nextInterestNumber}${months > 1 ? ` s/d ke-${endNumber}` : ''}`,
                `Pokok saat ini : ${Utils.formatCurrency(remainingPrincipal)}`,
                `Bunga/bulan (${(monthlyRate*100).toFixed(0)}%) : ${Utils.formatCurrency(currentMonthlyInterest)}`,
                `Jumlah bulan   : ${months} bulan`,
                `────────────────────────────`,
                `TOTAL DITERIMA : ${Utils.formatCurrency(totalInterest)}`,
                `Metode : ${methodName}`,
                `────────────────────────────`,
                `Konfirmasi penerimaan?`
              ].join('\n')
            : [
                `📋 利息收款确认`,
                `────────────────────────────`,
                `订单号  : ${order.order_id}`,
                `客户    : ${order.customer_name}`,
                `────────────────────────────`,
                `期数    : 第${nextInterestNumber}期${months > 1 ? ` 至 第${endNumber}期` : ''}`,
                `当前剩余本金 : ${Utils.formatCurrency(remainingPrincipal)}`,
                `月利率 (${(monthlyRate*100).toFixed(0)}%) : ${Utils.formatCurrency(currentMonthlyInterest)}/月`,
                `收取月数     : ${months} 个月`,
                `────────────────────────────`,
                `本次收款合计 : ${Utils.formatCurrency(totalInterest)}`,
                `入账方式 : ${methodName}`,
                `────────────────────────────`,
                `确认收款？`
              ].join('\n');

        if (confirm(previewMsg)) {
            try {
                await Order.recordInterestPayment(orderId, months, method);
                await this.showPayment(orderId);
            } catch (error) {
                console.error('payInterestWithMethod error:', error);
            }
        }
    },

    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var target = document.querySelector('input[name="principalTarget"]:checked')?.value || 'bank';
        var targetName = target === 'cash' ? (Utils.lang === 'id' ? 'Brankas (Tunai)' : '保险柜（现金）') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        
        if (isNaN(amount) || amount <= 0) {
            alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
            return;
        }
        
        var order = await SUPABASE.getOrder(orderId);
        
        // 空值保护
        var loanAmount = order.loan_amount || 0;
        var principalPaid = order.principal_paid || 0;
        var remainingPrincipal = loanAmount - principalPaid;
        var actualAmount = Math.min(amount, remainingPrincipal); // 不超过剩余本金
        var remainingAfter = remainingPrincipal - actualAmount;
        var isFullSettlement = remainingAfter <= 0;
        
        // 详细预览明细
        var previewMsg = lang === 'id'
            ? [
                `📋 KONFIRMASI PEMBAYARAN POKOK`,
                `────────────────────────────`,
                `Order   : ${order.order_id}`,
                `Nasabah : ${order.customer_name}`,
                `────────────────────────────`,
                `Total Pinjaman     : ${Utils.formatCurrency(loanAmount)}`,
                `Sudah Dibayar      : ${Utils.formatCurrency(principalPaid)}`,
                `Sisa Sebelum Bayar : ${Utils.formatCurrency(remainingPrincipal)}`,
                `────────────────────────────`,
                `Jumlah Pembayaran  : ${Utils.formatCurrency(actualAmount)}`,
                `Sisa Setelah Bayar : ${Utils.formatCurrency(remainingAfter)}`,
                `Metode : ${targetName}`,
                `────────────────────────────`,
                isFullSettlement
                    ? `🎉 PELUNASAN PENUH - Order akan ditandai SELESAI`
                    : `📊 Pembayaran Sebagian`,
                `────────────────────────────`,
                `Konfirmasi pembayaran?`
              ].join('\n')
            : [
                `📋 本金还款确认`,
                `────────────────────────────`,
                `订单号  : ${order.order_id}`,
                `客户    : ${order.customer_name}`,
                `────────────────────────────`,
                `贷款总额     : ${Utils.formatCurrency(loanAmount)}`,
                `已还本金     : ${Utils.formatCurrency(principalPaid)}`,
                `还款前剩余   : ${Utils.formatCurrency(remainingPrincipal)}`,
                `────────────────────────────`,
                `本次还款金额 : ${Utils.formatCurrency(actualAmount)}`,
                `还款后剩余   : ${Utils.formatCurrency(remainingAfter)}`,
                `入账方式 : ${targetName}`,
                `────────────────────────────`,
                isFullSettlement
                    ? `🎉 全额结清 — 订单将标记为"已结清"`
                    : `📊 部分还款`,
                `────────────────────────────`,
                `确认收款？`
              ].join('\n');

        if (confirm(previewMsg)) {
            try {
                await Order.recordPrincipalPayment(orderId, actualAmount, target);
                
                // 结清后：提示打印结清凭证
                if (isFullSettlement) {
                    var printConfirm = lang === 'id'
                        ? `✅ Pelunasan berhasil! Order ${order.order_id} telah selesai.\n\nCetak bukti pelunasan untuk nasabah?`
                        : `✅ 结清成功！订单 ${order.order_id} 已完成。\n\n是否打印结清凭证给客户？`;
                    if (confirm(printConfirm)) {
                        APP.printSettlementReceipt(orderId);
                        return;
                    }
                }
                
                await this.showPayment(orderId);
            } catch (error) {
                console.error('payPrincipalWithMethod error:', error);
            }
        }
    },

    // ==================== 结清凭证打印 ====================
    printSettlementReceipt: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) return;
            var lang = Utils.lang;
            var methodMap = {
                cash: lang === 'id' ? 'Tunai (Brankas)' : '现金（保险柜）',
                bank: lang === 'id' ? 'Transfer Bank BNI' : '银行转账 BNI'
            };

            // 汇总各类付款
            var totalInterest = 0, totalPrincipal = 0, totalAdminFee = 0, totalServiceFee = 0;
            for (var p of payments) {
                if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
                else if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'service_fee') totalServiceFee += p.amount;
            }
            var grandTotal = totalInterest + totalPrincipal + totalAdminFee + totalServiceFee;

            var completedAt = order.completed_at
                ? Utils.formatDate(order.completed_at)
                : new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'zh-CN');

            var safeOrderId = Utils.escapeHtml(order.order_id);
            var safeCustomer = Utils.escapeHtml(order.customer_name);
            var safeKtp = Utils.escapeHtml(order.customer_ktp || '-');
            var safePhone = Utils.escapeHtml(order.customer_phone || '-');
            var safeCollateral = Utils.escapeHtml(order.collateral_name || '-');
            var safeStore = Utils.escapeHtml(AUTH.getCurrentStoreName ? AUTH.getCurrentStoreName() : '-');

            var html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>${lang === 'id' ? 'Bukti Pelunasan' : '结清凭证'} - ${safeOrderId}</title>
            <style>
                *{box-sizing:border-box;margin:0;padding:0}
                body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff}
                .wrap{max-width:160mm;margin:0 auto;padding:6mm}
                .no-print{text-align:center;padding:10px;margin-bottom:12px}
                .no-print button{margin:0 5px;padding:7px 18px;cursor:pointer;border:none;border-radius:4px;font-size:13px}
                .btn-p{background:#16a34a;color:#fff}.btn-c{background:#64748b;color:#fff}
                .header{text-align:center;border-bottom:2px solid #16a34a;padding-bottom:10px;margin-bottom:14px}
                .header h1{font-size:20px;color:#16a34a;margin:6px 0 2px}
                .badge{display:inline-block;background:#dcfce7;color:#16a34a;border:1px solid #86efac;border-radius:6px;padding:3px 14px;font-weight:700;font-size:13px;margin-top:4px}
                .section{border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-bottom:10px}
                .section h3{font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}
                .row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px}
                .lbl{color:#64748b;min-width:90px}
                .val{font-weight:600;text-align:right}
                .total-row{display:flex;justify-content:space-between;padding:7px 0;border-top:2px solid #16a34a;margin-top:6px;font-size:13px;font-weight:700;color:#16a34a}
                .stamp{text-align:center;border:3px solid #16a34a;border-radius:50%;width:80px;height:80px;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:10px auto;color:#16a34a;font-weight:700;font-size:11px}
                .footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px}
                @media print{@page{size:A5;margin:8mm}body{margin:0}.no-print{display:none}}
            </style></head><body>
            <div class="wrap">
                <div class="no-print">
                    <button class="btn-p" onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    <button class="btn-c" onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
                </div>
                <div class="header">
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px">
                        <img src="icons/pagehead-logo.png" alt="JF!" style="height:28px">
                        <h1>JF! by Gadai</h1>
                    </div>
                    <div><span class="badge">✅ ${lang === 'id' ? 'BUKTI PELUNASAN' : '结清凭证'}</span></div>
                    <div style="margin-top:6px;font-size:11px;color:#475569">${lang === 'id' ? 'Tanggal Lunas' : '结清日期'}: <strong>${completedAt}</strong> &nbsp;|&nbsp; ${lang === 'id' ? 'No. Order' : '订单号'}: <strong>${safeOrderId}</strong></div>
                </div>
                
                <div class="section">
                    <h3>👤 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</h3>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Nama' : '姓名'}</span><span class="val">${safeCustomer}</span></div>
                    <div class="row"><span class="lbl">KTP</span><span class="val">${safeKtp}</span></div>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Telepon' : '电话'}</span><span class="val">${safePhone}</span></div>
                </div>
                
                <div class="section">
                    <h3>💎 ${lang === 'id' ? 'Barang Jaminan' : '质押物'}</h3>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Nama Barang' : '物品名称'}</span><span class="val">${safeCollateral}</span></div>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Pinjaman Awal' : '原始贷款'}</span><span class="val">${Utils.formatCurrency(order.loan_amount)}</span></div>
                </div>
                
                <div class="section">
                    <h3>💰 ${lang === 'id' ? 'Ringkasan Pembayaran' : '付款汇总'}</h3>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Admin Fee' : '管理费'}</span><span class="val">${Utils.formatCurrency(totalAdminFee)}</span></div>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Service Fee' : '服务费'}</span><span class="val">${Utils.formatCurrency(totalServiceFee)}</span></div>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Total Bunga' : '利息总额'}</span><span class="val">${Utils.formatCurrency(totalInterest)} (${order.interest_paid_months || 0} ${lang === 'id' ? 'bln' : '个月'})</span></div>
                    <div class="row"><span class="lbl">${lang === 'id' ? 'Total Pokok' : '本金总额'}</span><span class="val">${Utils.formatCurrency(totalPrincipal)}</span></div>
                    <div class="total-row"><span>${lang === 'id' ? 'TOTAL DIBAYAR' : '累计已付总额'}</span><span>${Utils.formatCurrency(grandTotal)}</span></div>
                </div>
                
                <div class="stamp">
                    <div style="font-size:18px">✅</div>
                    <div>${lang === 'id' ? 'LUNAS' : '已结清'}</div>
                </div>
                
                <div class="footer">
                    <div>🏪 ${safeStore} &nbsp;|&nbsp; JF! by Gadai ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    <div style="margin-top:3px">${lang === 'id' ? 'Dokumen ini adalah bukti resmi pelunasan. Barang jaminan dapat diambil.' : '本凭证为正式结清证明，质押物可凭此领取。'}</div>
                    <div style="margin-top:3px">${lang === 'id' ? 'Terima kasih atas kepercayaan Anda.' : '感谢您的信任。'}</div>
                </div>
            </div></body></html>`;

            var pw = window.open('', '_blank');
            pw.document.write(html);
            pw.document.close();
            setTimeout(() => {
                try { pw.print(); } catch(e) {}
                APP.navigateTo('orderTable');
            }, 800);
        } catch (error) {
            console.error('printSettlementReceipt error:', error);
            alert(Utils.lang === 'id' ? 'Gagal mencetak bukti pelunasan' : '打印结清凭证失败');
            APP.navigateTo('orderTable');
        }
    }
};

// 辅助函数：转义属性值
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

// 结清凭证单独挂载（确保任意模块均可调用）
window.APP.printSettlementReceipt = PaymentsModule.printSettlementReceipt.bind(PaymentsModule);

// 添加 escapeAttr 到 Utils（如果尚未添加）
if (!Utils.escapeAttr) {
    Utils.escapeAttr = escapeAttr;
}

console.log('✅ app-payments.js v8.1 已加载 - 修复 PaymentsModule 缺少闭合括号（缴费按钮失效根因）');
