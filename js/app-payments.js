// app-payments.js - v1.2（修复表格头部HTML错误、管理员提示优化、打印Logo路径）

window.APP = window.APP || {};

const PaymentsModule = {

    showPayment: async function(orderId) {
        var lang = Utils.lang;

        const profile = await SUPABASE.getCurrentProfile();

        if (!profile) {
            alert(Utils.t('login_required'));
            APP.goBack();
            return;
        }

        // 修复6：管理员禁止操作订单的提示方式优化 - 改为友好页面而非弹窗
        if (profile.role === 'admin') {
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + (lang === 'id' ? 'Pembayaran' : '缴纳费用') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card" style="text-align:center; padding:40px 20px;">' +
                    '<div style="font-size:48px; margin-bottom:16px;">🔒</div>' +
                    '<h3 style="color:#64748b; margin-bottom:12px;">' + 
                        (lang === 'id' 
                            ? 'Fitur Ini Khusus Operator Toko' 
                            : '此功能仅限门店操作员使用') + 
                    '</h3>' +
                    '<p style="color:#94a3b8; margin-bottom:8px;">' +
                        (lang === 'id' 
                            ? 'Administrator tidak dapat melakukan pembayaran pesanan.' 
                            : '管理员不能执行订单缴费操作。') +
                    '</p>' +
                    '<p style="color:#94a3b8; margin-bottom:16px;">' +
                        (lang === 'id' 
                            ? 'Silakan gunakan akun operator toko untuk mengakses halaman pembayaran.' 
                            : '请使用门店操作员账号访问缴费页面。') +
                    '</p>' +
                    '<button onclick="APP.goBack()" class="btn-back" style="padding:10px 24px; font-size:14px;">↩️ ' + 
                        (lang === 'id' ? 'Kembali ke Dashboard' : '返回仪表盘') + 
                    '</button>' +
                '</div>';
            return;
        }

        if (!profile.store_id) {
            alert(Utils.lang === 'id' ? 'Akun tidak terhubung ke toko' : '账号未关联门店');
            APP.goBack();
            return;
        }

        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(Utils.t('order_not_found'));
                APP.goBack();
                return;
            }
            
            if (order.store_id !== profile.store_id) {
                alert(Utils.t('unauthorized'));
                APP.goBack();
                return;
            }

            var result = await SUPABASE.getPaymentHistory(orderId);
            var payments = result.payments;

            var t = Utils.t.bind(Utils);
            
            var loanAmount = order.loan_amount || 0;
            var principalPaid = order.principal_paid || 0;
            var remainingPrincipal = loanAmount - principalPaid;
            var monthlyRate = order.agreed_interest_rate || 0.08;
            var currentMonthlyInterest = remainingPrincipal * monthlyRate;

            var interestPayments = payments.filter(function(p) { return p.type === 'interest' && !p.is_voided; });
            var principalPayments = payments.filter(function(p) { return p.type === 'principal' && !p.is_voided; });
            
            interestPayments.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
            principalPayments.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
            
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai' : '现金', 
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

            var serviceFeeAmount = order.service_fee_amount || (loanAmount * (order.service_fee_percent || 0) / 100);
            var serviceFeePaid = order.service_fee_paid || 0;
            var isServiceFeePaid = serviceFeePaid >= serviceFeeAmount;

            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = '<tr><td colspan="5" class="text-center text-muted">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < interestPayments.length; i++) {
                    var p = interestPayments[i];
                    var paymentNumber = i + 1;
                    interestRows += '<tr>' +
                        '<td data-label="' + (lang === 'id' ? 'Ke-' : '第几次') + '" class="text-center">' + paymentNumber + '<\/td>' +
                        '<td data-label="' + t('date') + '" class="date-cell">' + Utils.formatDate(p.date) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Bulan' : '月数') + '" class="text-center">' + (p.months || 1) + ' ' + (lang === 'id' ? 'bln' : '个月') + '<\/td>' +
                        '<td data-label="' + t('amount') + '" class="text-right">' + Utils.formatCurrency(p.amount) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Metode' : '方式') + '">' + (methodMap[p.payment_method] || '-') + '<\/td>' +
                    '<\/tr>';
                }
            }

            var principalRows = '';
            var cumulativePaid = 0;
            if (principalPayments.length === 0) {
                principalRows = '<tr><td colspan="5" class="text-center text-muted">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < principalPayments.length; i++) {
                    var p = principalPayments[i];
                    cumulativePaid += p.amount;
                    var remainingAfter = loanAmount - cumulativePaid;
                    principalRows += '<tr>' +
                        '<td data-label="' + t('date') + '" class="date-cell">' + Utils.formatDate(p.date) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Jumlah Dibayar' : '还款金额') + '" class="text-right">' + Utils.formatCurrency(p.amount) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Total Dibayar' : '累计已还') + '" class="text-right">' + Utils.formatCurrency(cumulativePaid) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + '" class="text-right ' + (remainingAfter <= 0 ? 'success-text' : 'warning') + '">' + Utils.formatCurrency(remainingAfter) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Metode' : '方式') + '">' + (methodMap[p.payment_method] || '-') + '<\/td>' +
                    '<\/tr>';
                }
            }

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var interestOptions = [1, 2, 3].map(function(i) {
                return '<option value="' + i + '">' + i + ' ' + (lang === 'id' ? 'bulan' : '个月') + ' = ' + Utils.formatCurrency(currentMonthlyInterest * i) + '</option>';
            }).join('');

            var nextInterestNumber = interestPayments.length + 1;

            var adminFeePayment = payments.find(function(p) { return p.type === 'admin_fee' && !p.is_voided; });
            var serviceFeePayment = payments.find(function(p) { return p.type === 'service_fee' && !p.is_voided; });
            
            var adminFeePaidInfo = order.admin_fee_paid && adminFeePayment
                ? Utils.formatCurrency(order.admin_fee) + ' (' + (methodMap[adminFeePayment.payment_method] || '-') + ' / ' + Utils.formatDate(adminFeePayment.date) + ')'
                : (order.admin_fee_paid ? Utils.formatCurrency(order.admin_fee) : (lang === 'id' ? 'Belum dibayar' : '未缴'));
            
            var serviceFeePaidInfo = isServiceFeePaid && serviceFeePayment
                ? Utils.formatCurrency(serviceFeeAmount) + ' (' + (methodMap[serviceFeePayment.payment_method] || '-') + ' / ' + Utils.formatDate(serviceFeePayment.date) + ')'
                : (serviceFeePaid > 0 ? Utils.formatCurrency(serviceFeePaid) + '/' + Utils.formatCurrency(serviceFeeAmount) : (lang === 'id' ? 'Belum dibayar' : '未缴'));

            // 固定还款板块
            var fixedRepaymentHtml = '';
            if (order.repayment_type === 'fixed') {
                var paidMonths = order.fixed_paid_months || 0;
                var totalMonths = order.repayment_term;
                var remainingMonths = totalMonths - paidMonths;
                var monthlyFixedPayment = order.monthly_fixed_payment || 0;
                var overdueDays = order.overdue_days || 0;
                
                var overdueWarning = '';
                if (overdueDays > 0) {
                    overdueWarning = '<div class="overdue-warning ' + (overdueDays >= 30 ? 'critical' : 'warning') + '">' +
                        '⚠️ ' + (lang === 'id' ? 'Terlambat ' + overdueDays + ' hari' : '逾期 ' + overdueDays + ' 天') +
                        (overdueDays >= 30 ? (lang === 'id' ? ' - Akan memasuki proses likuidasi!' : ' - 将进入变卖程序！') : '') +
                    '</div>';
                }
                
                fixedRepaymentHtml = '' +
                    '<div class="card action-card fixed-repayment-card">' +
                        '<div class="card-header">' +
                            '<h3>📅 ' + t('fixed_repayment') + '</h3>' +
                            '<span class="repayment-badge fixed-badge">' + t('fixed_repayment') + '</span>' +
                        '</div>' +
                        '<div class="card-body">' +
                            '<div class="info-box success-box">' +
                                '<div class="info-row">' +
                                    '<span>📊 ' + (lang === 'id' ? 'Progress' : '进度') + ':</span>' +
                                    '<strong>' + paidMonths + '/' + totalMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</strong>' +
                                    '<div class="progress-bar">' +
                                        '<div class="progress-fill" style="width: ' + (paidMonths/totalMonths)*100 + '%;"></div>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="info-row">' +
                                    '<span>💰 ' + t('monthly_payment') + ':</span>' +
                                    '<strong class="amount-highlight">' + Utils.formatCurrency(monthlyFixedPayment) + '</strong>' +
                                '</div>' +
                                '<div class="info-row">' +
                                    '<span>📅 ' + t('payment_due_date') + ':</span>' +
                                    '<strong>' + nextDueDate + '</strong>' +
                                '</div>' +
                                '<div class="info-row">' +
                                    '<span>📈 ' + t('remaining_term') + ':</span>' +
                                    '<strong>' + remainingMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</strong>' +
                                '</div>' +
                                overdueWarning +
                            '</div>' +
                            '<div class="payment-method-group">' +
                                '<div class="payment-method-title">' + (lang === 'id' ? 'Metode Pencatatan' : '入账方式') + ':</div>' +
                                '<div class="payment-method-options">' +
                                    '<label><input type="radio" name="fixedMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                    '<label><input type="radio" name="fixedMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="action-buttons">' +
                                '<button onclick="APP.payFixedInstallment(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success">' +
                                    '✅ ' + (lang === 'id' ? 'Bayar Angsuran Bulan Ini' : '支付本月还款') +
                                '</button>' +
                                (remainingMonths > 0 ? '<button onclick="APP.earlySettleFixedOrder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action early-settle">🎯 ' + t('early_settlement') + '</button>' : '') +
                            '</div>' +
                        '</div>' +
                        '<div class="card-info">' +
                            '<small>💡 ' + (lang === 'id' ? 'Setiap angsuran mencakup bunga dan pokok. Pelunasan dipercepat dapat mengurangi sisa bunga.' : '每期还款包含本金和利息，提前结清可减免剩余利息') + '</small>' +
                        '</div>' +
                    '</div>';
            }

            // 灵活还款板块
            var flexibleRepaymentHtml = '';
            if (order.repayment_type !== 'fixed') {
                flexibleRepaymentHtml = '' +
                    '<div class="payment-double-column">' +
                        '<!-- 利息卡片 -->' +
                        '<div class="card action-card">' +
                            '<div class="card-header"><h3>💰 ' + t('interest') + '</h3></div>' +
                            '<div class="card-body">' +
                                '<div class="info-box">' +
                                    '<span>📌 ' + (lang === 'id' ? 'Ini adalah pembayaran bunga ke-' : '本次是第 ') + '<strong>' + nextInterestNumber + '</strong> ' + (lang === 'id' ? 'kali' : '次利息支付') + '</span>' +
                                    '<span>💰 ' + (lang === 'id' ? 'Jumlah yang harus dibayar' : '应付金额') + ': <strong>' + Utils.formatCurrency(currentMonthlyInterest) + '</strong></span>' +
                                    '<span>📈 ' + t('agreed_rate') + ': <strong>' + (monthlyRate*100).toFixed(0) + '%</strong></span>' +
                                '</div>' +
                                '<div class="action-input-group">' +
                                    '<label class="action-label">' + (lang === 'id' ? 'Ambil' : '收取') + ':</label>' +
                                    '<select id="interestMonths" class="action-select">' + interestOptions + '</select>' +
                                '</div>' +
                                '<div class="payment-method-group">' +
                                    '<div class="payment-method-title">' + (lang === 'id' ? 'Metode Pencatatan' : '入账方式') + ':</div>' +
                                    '<div class="payment-method-options">' +
                                        '<label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                        '<label><input type="radio" name="interestMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                    '</div>' +
                                '</div>' +
                                '<button onclick="APP.payInterestWithMethod(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success">✅ ' + (lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款') + '</button>' +
                            '</div>' +
                            '<div class="card-history">' +
                                '<div class="history-title">📋 ' + (lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史') + '</div>' +
                                '<div class="table-container">' +
                                    '<table class="history-table">' +
                                        '<thead><tr><th class="text-center">' + (lang === 'id' ? 'Ke-' : '第几次') + '</th><th>' + t('date') + '</th><th class="text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th><th class="text-right">' + t('amount') + '</th><th>' + (lang === 'id' ? 'Metode' : '方式') + '</th></tr></thead>' +
                                        '<tbody>' + interestRows + '</tbody>' +
                                    '</table>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<!-- 本金卡片 -->' +
                        '<div class="card action-card">' +
                            '<div class="card-header"><h3>🏦 ' + t('principal') + '</h3></div>' +
                            '<div class="card-body">' +
                                '<div class="info-box warning-box">' +
                                    '<span>📊 ' + (lang === 'id' ? 'Pokok Dibayar' : '已还本金') + ': <strong>' + Utils.formatCurrency(principalPaid) + '</strong></span>' +
                                    '<span>📊 ' + (lang === 'id' ? 'Sisa Pokok' : '尚欠本金') + ': <strong class="' + (remainingPrincipal > 0 ? 'text-warning' : 'text-success') + '">' + Utils.formatCurrency(remainingPrincipal) + '</strong></span>' +
                                '</div>' +
                                '<div class="action-input-group">' +
                                    '<label class="action-label">' + (lang === 'id' ? 'Jumlah Pembayaran' : '还款金额') + ':</label>' +
                                    '<input type="text" id="principalAmount" class="action-input" placeholder="0">' +
                                '</div>' +
                                '<div class="payment-method-group">' +
                                    '<div class="payment-method-title">' + (lang === 'id' ? 'Metode Pencatatan' : '入账方式') + ':</div>' +
                                    '<div class="payment-method-options">' +
                                        '<label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ' + t('bank') + '</label>' +
                                        '<label><input type="radio" name="principalTarget" value="cash"> 🏦 ' + t('cash') + '</label>' +
                                    '</div>' +
                                '</div>' +
                                '<button onclick="APP.payPrincipalWithMethod(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success">✅ ' + (lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款') + '</button>' +
                            '</div>' +
                            '<div class="card-history">' +
                                '<div class="history-title">📋 ' + (lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史') + '</div>' +
                                '<div class="table-container">' +
                                    '<table class="history-table">' +
                                        // 修复1b：修正 </th> 与 </thead> 顺序
                                        '<thead><tr><th>' + t('date') + '</th><th class="text-right">' + (lang === 'id' ? 'Jumlah Dibayar' : '还款金额') + '</th><th class="text-right">' + (lang === 'id' ? 'Total Dibayar' : '累计已还') + '</th><th class="text-right">' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + '</th><th>' + (lang === 'id' ? 'Metode' : '方式') + '</th></tr></thead>' +
                                        '<tbody>' + principalRows + '</tbody>' +
                                    '</table>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + (lang === 'id' ? 'Pembayaran' : '缴纳费用') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.viewOrder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-detail">📄 ' + t('order_details') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card summary-card">' +
                    '<div class="summary-grid">' +
                        '<div class="summary-item"><span class="label">' + t('customer_name') + ':</span><span class="value">' + Utils.escapeHtml(order.customer_name) + '</span></div>' +
                        '<div class="summary-item"><span class="label">ID:</span><span class="value order-id">' + Utils.escapeHtml(order.order_id) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('loan_amount') + ':</span><span class="value">' + Utils.formatCurrency(loanAmount) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</span><span class="value ' + (remainingPrincipal > 0 ? 'warning' : 'success') + '">' + Utils.formatCurrency(remainingPrincipal) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + (lang === 'id' ? 'Bunga Bulanan' : '月利息') + ':</span><span class="value">' + Utils.formatCurrency(currentMonthlyInterest) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('payment_due_date') + ':</span><span class="value">' + nextDueDate + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('repayment_type') + ':</span><span class="value">' + (order.repayment_type === 'fixed' ? '📅 ' + t('fixed_repayment') : '💰 ' + t('flexible_repayment')) + (order.repayment_type === 'fixed' ? ' (' + order.repayment_term + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')' : '') + '</span></div>' +
                        '<div class="summary-item"><span class="label">💎 ' + t('collateral_name') + ':</span><span class="value">' + Utils.escapeHtml(order.collateral_name || '-') + '</span></div>' +
                        '<div class="summary-item"><span class="label">💰 ' + t('service_fee') + ':</span><span class="value">' + Utils.formatCurrency(serviceFeeAmount) + ' (' + (order.service_fee_percent || 0) + '%)</span></div>' +
                        '<div class="summary-item"><span class="label">📋 ' + t('admin_fee') + ':</span><span class="value">' + Utils.formatCurrency(order.admin_fee) + '</span></div>' +
                        '<div class="summary-item"><span class="label">📈 ' + t('agreed_rate') + ':</span><span class="value">' + ((order.agreed_interest_rate || 0.08)*100).toFixed(0) + '%</span></div>' +
                        '<div class="summary-item"><span class="label">✅ ' + t('admin_fee') + ':</span><span class="value success-text">' + adminFeePaidInfo + '</span></div>' +
                        '<div class="summary-item"><span class="label">✅ ' + t('service_fee') + ':</span><span class="value success-text">' + serviceFeePaidInfo + '</span></div>' +
                    '</div>' +
                '</div>' +
                fixedRepaymentHtml +
                flexibleRepaymentHtml +
                '<style>' +
                    '.fixed-repayment-card { background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #10b981; }' +
                    '.repayment-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }' +
                    '.fixed-badge { background: #10b981; color: white; }' +
                    '.info-box .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }' +
                    '.info-box .info-row:last-child { border-bottom: none; }' +
                    '.progress-bar { flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-left: 10px; }' +
                    '.progress-fill { height: 100%; background: #10b981; transition: width 0.3s; }' +
                    '.amount-highlight { font-size: 18px; color: #10b981; }' +
                    '.overdue-warning { padding: 8px 12px; border-radius: 8px; margin-top: 10px; font-size: 13px; font-weight: 600; }' +
                    '.overdue-warning.warning { background: #fef3c7; color: #d97706; }' +
                    '.overdue-warning.critical { background: #fee2e2; color: #dc2626; }' +
                    '.action-buttons { display: flex; gap: 12px; margin-top: 15px; flex-wrap: wrap; }' +
                    '.btn-action.early-settle { background: #8b5cf6 !important; color: white !important; border-color: #7c3aed !important; }' +
                    '.btn-action.early-settle:hover { background: #7c3aed !important; }' +
                    '.card-info { margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; font-size: 11px; color: #64748b; }' +
                    '.summary-table { width: 100%; border-collapse: collapse; }' +
                    '.summary-table td { padding: 6px 8px; }' +
                    '.summary-table .label { font-weight: 600; color: #475569; width: 90px; }' +
                    '.summary-table .value { color: #1e293b; }' +
                    '.summary-table .order-id { font-family: monospace; font-weight: 600; }' +
                    '.summary-table .warning { color: #d97706; }' +
                    '.summary-table .success-text { color: #10b981; }' +
                    '.history-table { width: 100%; font-size: 12px; border-collapse: collapse; }' +
                    '.history-table th, .history-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }' +
                    '.history-table th { background: #f8fafc; font-weight: 600; }' +
                    '.text-center { text-align: center; }' +
                    '.text-right { text-align: right; }' +
                    '.text-success { color: #10b981; }' +
                    '@media (max-width: 768px) { .action-buttons { flex-direction: column; } .btn-action { width: 100%; } .summary-table .label { width: 70px; font-size: 11px; } .history-table { font-size: 10px; } }' +
                '</style>';

            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            alert(lang === 'id' ? 'Gagal memuat data: ' + error.message : '加载失败：' + error.message);
            APP.goBack();
        }
    },

    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? Utils.t('cash') : Utils.t('bank');
        var lang = Utils.lang;
        
        var order = await SUPABASE.getOrder(orderId);
        
        var loanAmount = order.loan_amount || 0;
        var principalPaid = order.principal_paid || 0;
        var remainingPrincipal = loanAmount - principalPaid;
        var monthlyRate = order.agreed_interest_rate || 0.08;
        var currentMonthlyInterest = remainingPrincipal * monthlyRate;
        var totalInterest = currentMonthlyInterest * months;
        var nextInterestNumber = (order.interest_paid_months || 0) + 1;
        var endNumber = nextInterestNumber + months - 1;
        
        var previewMsg = lang === 'id'
            ? '📋 Konfirmasi Pembayaran Bunga\n' +
              'Pesanan: ' + order.order_id + '\n' +
              'Nasabah: ' + order.customer_name + '\n' +
              'Periode: ke-' + nextInterestNumber + (months > 1 ? ' sampai ke-' + endNumber : '') + '\n' +
              'Sisa Pokok: ' + Utils.formatCurrency(remainingPrincipal) + '\n' +
              'Suku Bunga: ' + (monthlyRate*100).toFixed(0) + '%\n' +
              'Bulan: ' + months + ' bulan\n' +
              'Jumlah Dibayar: ' + Utils.formatCurrency(totalInterest) + '\n' +
              'Metode: ' + methodName + '\n' +
              'Lanjutkan?'
            : '📋 利息收款确认\n' +
              '订单号: ' + order.order_id + '\n' +
              '客户: ' + order.customer_name + '\n' +
              '期数: 第' + nextInterestNumber + '期' + (months > 1 ? ' 至 第' + endNumber + '期' : '') + '\n' +
              '剩余本金: ' + Utils.formatCurrency(remainingPrincipal) + '\n' +
              '月利率: ' + (monthlyRate*100).toFixed(0) + '%\n' +
              '收取月数: ' + months + ' 个月\n' +
              '本次收款: ' + Utils.formatCurrency(totalInterest) + '\n' +
              '入账方式: ' + methodName + '\n' +
              '确认收款？';

        if (confirm(previewMsg)) {
            try {
                await Order.recordInterestPayment(orderId, months, method);
                await this.showPayment(orderId);
            } catch (error) {
                console.error('payInterestWithMethod error:', error);
                alert(error.message);
            }
        }
    },

    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var target = document.querySelector('input[name="principalTarget"]:checked')?.value || 'bank';
        var targetName = target === 'cash' ? Utils.t('cash') : Utils.t('bank');
        var lang = Utils.lang;
        
        if (isNaN(amount) || amount <= 0) {
            alert(Utils.t('invalid_amount'));
            return;
        }
        
        var order = await SUPABASE.getOrder(orderId);
        
        var loanAmount = order.loan_amount || 0;
        var principalPaid = order.principal_paid || 0;
        var remainingPrincipal = loanAmount - principalPaid;
        var actualAmount = Math.min(amount, remainingPrincipal);
        var remainingAfter = remainingPrincipal - actualAmount;
        var isFullSettlement = remainingAfter <= 0;
        
        var previewMsg = lang === 'id'
            ? '📋 Konfirmasi Pembayaran Pokok\n' +
              'Pesanan: ' + order.order_id + '\n' +
              'Nasabah: ' + order.customer_name + '\n' +
              'Total Pinjaman: ' + Utils.formatCurrency(loanAmount) + '\n' +
              'Pokok Dibayar: ' + Utils.formatCurrency(principalPaid) + '\n' +
              'Sisa Sebelum: ' + Utils.formatCurrency(remainingPrincipal) + '\n' +
              'Dibayar Sekarang: ' + Utils.formatCurrency(actualAmount) + '\n' +
              'Sisa Setelah: ' + Utils.formatCurrency(remainingAfter) + '\n' +
              'Metode: ' + targetName + '\n' +
              (isFullSettlement ? '🎉 LUNAS' : 'Pembayaran sebagian') + '\n' +
              'Lanjutkan?'
            : '📋 本金还款确认\n' +
              '订单号: ' + order.order_id + '\n' +
              '客户: ' + order.customer_name + '\n' +
              '贷款总额: ' + Utils.formatCurrency(loanAmount) + '\n' +
              '已还本金: ' + Utils.formatCurrency(principalPaid) + '\n' +
              '还款前剩余: ' + Utils.formatCurrency(remainingPrincipal) + '\n' +
              '本次还款: ' + Utils.formatCurrency(actualAmount) + '\n' +
              '还款后剩余: ' + Utils.formatCurrency(remainingAfter) + '\n' +
              '入账方式: ' + targetName + '\n' +
              (isFullSettlement ? '🎉 全额结清' : '部分还款') + '\n' +
              '确认收款？';

        if (confirm(previewMsg)) {
            try {
                await Order.recordPrincipalPayment(orderId, actualAmount, target);
                
                if (isFullSettlement) {
                    var printConfirm = lang === 'id'
                        ? '✅ LUNAS!\n\nCetak tanda terima pelunasan?'
                        : '✅ 结清成功！\n\n是否打印结清凭证？';
                    if (confirm(printConfirm)) {
                        APP.printSettlementReceipt(orderId);
                        return;
                    }
                }
                
                await this.showPayment(orderId);
            } catch (error) {
                console.error('payPrincipalWithMethod error:', error);
                alert(error.message);
            }
        }
    },

    payFixedInstallment: async function(orderId) {
        var method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
        
        try {
            await SUPABASE.recordFixedPayment(orderId, method);
            await this.showPayment(orderId);
        } catch (error) {
            console.error('payFixedInstallment error:', error);
            alert(error.message);
        }
    },

    earlySettleFixedOrder: async function(orderId) {
        var method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
        
        try {
            await SUPABASE.earlySettleFixedOrder(orderId, method);
            await this.showPayment(orderId);
        } catch (error) {
            console.error('earlySettleFixedOrder error:', error);
            alert(error.message);
        }
    },

    // 修复9：打印结清凭证 Logo 使用绝对路径
    printSettlementReceipt: async function(orderId) {
        try {
            var result = await SUPABASE.getPaymentHistory(orderId);
            var order = result.order;
            var payments = result.payments;
            if (!order) return;
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            var methodMap = {
                cash: lang === 'id' ? 'Tunai' : '现金',
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

            var totalInterest = 0, totalPrincipal = 0, totalAdminFee = 0, totalServiceFee = 0;
            for (var i = 0; i < payments.length; i++) {
                var p = payments[i];
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

            // 修复9：Logo 使用绝对路径 /icons/pagehead-logo.png
            var html = '' +
            '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
            '<title>' + (lang === 'id' ? 'Tanda Terima Pelunasan' : '结清凭证') + ' - ' + safeOrderId + '</title>' +
            '<style>' +
                '*{box-sizing:border-box;margin:0;padding:0}' +
                'body{font-family:\'Segoe UI\',Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff}' +
                '.wrap{max-width:160mm;margin:0 auto;padding:6mm}' +
                '.no-print{text-align:center;padding:10px;margin-bottom:12px}' +
                '.no-print button{margin:0 5px;padding:7px 18px;cursor:pointer;border:none;border-radius:4px;font-size:13px}' +
                '.btn-p{background:#16a34a;color:#fff}.btn-c{background:#64748b;color:#fff}' +
                '.header{text-align:center;border-bottom:2px solid #16a34a;padding-bottom:10px;margin-bottom:14px}' +
                '.header-logo{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px}' +
                '.header-logo img{height:32px;width:auto}' +
                '.header-logo h1{font-size:22px;margin:0;color:#16a34a}' +
                '.badge{display:inline-block;background:#dcfce7;color:#16a34a;border:1px solid #86efac;border-radius:6px;padding:3px 14px;font-weight:700;font-size:13px;margin-top:4px}' +
                '.section{border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-bottom:10px}' +
                '.section h3{font-size:11px;font-weight:700;color:#475569;margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:4px}' +
                '.row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:11px}' +
                '.lbl{color:#64748b;min-width:90px}' +
                '.val{font-weight:600;text-align:right}' +
                '.total-row{display:flex;justify-content:space-between;padding:7px 0;border-top:2px solid #16a34a;margin-top:6px;font-size:13px;font-weight:700;color:#16a34a}' +
                '.stamp{text-align:center;border:3px solid #16a34a;border-radius:50%;width:80px;height:80px;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:10px auto;color:#16a34a;font-weight:700;font-size:11px}' +
                '.footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px}' +
                '@media print{@page{size:A5;margin:8mm}body{margin:0}.no-print{display:none}}' +
            '</style></head><body>' +
            '<div class="wrap">' +
                '<div class="no-print">' +
                    '<button class="btn-p" onclick="window.print()">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '<button class="btn-c" onclick="window.close()">' + (lang === 'id' ? 'Tutup' : '关闭') + '</button>' +
                '</div>' +
                '<div class="header">' +
                    '<div class="header-logo">' +
                        '<img src="/icons/pagehead-logo.png" alt="JF!">' +
                        '<h1>JF! by Gadai</h1>' +
                    '</div>' +
                    '<div><span class="badge">✅ ' + (lang === 'id' ? 'TANDA TERIMA PELUNASAN' : '结清凭证') + '</span></div>' +
                    '<div style="margin-top:6px;font-size:11px;color:#475569">' + (lang === 'id' ? 'Tanggal Lunas' : '结清日期') + ': <strong>' + completedAt + '</strong> &nbsp;|&nbsp; ' + (lang === 'id' ? 'ID Pesanan' : '订单号') + ': <strong>' + safeOrderId + '</strong></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>👤 ' + (lang === 'id' ? 'Informasi Nasabah' : '客户信息') + '</h3>' +
                    '<div class="row"><span class="lbl">' + (lang === 'id' ? 'Nama' : '姓名') + '</span><span class="val">' + safeCustomer + '</span></div>' +
                    '<div class="row"><span class="lbl">KTP</span><span class="val">' + safeKtp + '</span></div>' +
                    '<div class="row"><span class="lbl">' + (lang === 'id' ? 'Telepon' : '电话') + '</span><span class="val">' + safePhone + '</span></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>💎 ' + (lang === 'id' ? 'Jaminan' : '质押物') + '</h3>' +
                    '<div class="row"><span class="lbl">' + (lang === 'id' ? 'Nama Barang' : '物品名称') + '</span><span class="val">' + safeCollateral + '</span></div>' +
                    '<div class="row"><span class="lbl">' + (lang === 'id' ? 'Pinjaman Awal' : '原始贷款') + '</span><span class="val">' + Utils.formatCurrency(order.loan_amount) + '</span></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>💰 ' + (lang === 'id' ? 'Ringkasan Pembayaran' : '付款汇总') + '</h3>' +
                    '<div class="row"><span class="lbl">' + t('admin_fee') + '</span><span class="val">' + Utils.formatCurrency(totalAdminFee) + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('service_fee') + '</span><span class="val">' + Utils.formatCurrency(totalServiceFee) + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('interest') + '</span><span class="val">' + Utils.formatCurrency(totalInterest) + ' (' + (order.interest_paid_months || 0) + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')</span></div>' +
                    '<div class="row"><span class="lbl">' + t('principal') + '</span><span class="val">' + Utils.formatCurrency(totalPrincipal) + '</span></div>' +
                    '<div class="total-row"><span>' + (lang === 'id' ? 'Total Dibayar' : '累计已付总额') + '</span><span>' + Utils.formatCurrency(grandTotal) + '</span></div>' +
                '</div>' +
                '<div class="stamp">' +
                    '<div style="font-size:18px">✅</div>' +
                    '<div>' + (lang === 'id' ? 'LUNAS' : '结清') + '</div>' +
                '</div>' +
                '<div class="footer">' +
                    '<div>🏪 ' + safeStore + ' &nbsp;|&nbsp; JF! by Gadai</div>' +
                    '<div style="margin-top:3px">' + (lang === 'id' ? 'Terima kasih atas kepercayaan Anda' : '感谢您的信任') + '</div>' +
                '</div>' +
            '</div></body></html>';

            var pw = window.open('', '_blank');
            pw.document.write(html);
            pw.document.close();
            setTimeout(function() {
                try { pw.print(); } catch(e) {}
                APP.navigateTo('orderTable');
            }, 800);
        } catch (error) {
            console.error('printSettlementReceipt error:', error);
            alert(Utils.lang === 'id' ? 'Gagal mencetak' : '打印失败');
            APP.navigateTo('orderTable');
        }
    }
};

// 合并到 window.APP
for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') window.APP[key] = PaymentsModule[key];
}

window.APP.printSettlementReceipt = PaymentsModule.printSettlementReceipt.bind(PaymentsModule);
