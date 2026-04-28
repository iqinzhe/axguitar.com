// app-payments.js - v1.0 (修复：返回键统一右上角)
window.APP = window.APP || {};

// ========== 防重复提交全局锁 ==========
window.APP._paymentLock = {};

window.APP._acquirePaymentLock = function(lockKey) {
    if (window.APP._paymentLock[lockKey]) return false;
    window.APP._paymentLock[lockKey] = true;
    return true;
};

window.APP._releasePaymentLock = function(lockKey) {
    delete window.APP._paymentLock[lockKey];
};

// ========== 幂等性检查：防止重复处理同一笔交易 ==========
window.APP._checkIdempotency = async function(orderId, type, amount, paymentMethod) {
    try {
        // 获取订单内部ID
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('order_id', orderId)
            .single();
        
        if (orderError || !order) return false;
        
        const today = Utils.getLocalToday();
        const { data, error } = await supabaseClient
            .from('payment_history')
            .select('id')
            .eq('order_id', order.id)
            .eq('type', type)
            .eq('amount', amount)
            .eq('payment_method', paymentMethod)
            .gte('date', today)
            .maybeSingle();
        
        if (error) {
            console.warn('幂等性检查失败:', error);
            return false;
        }
        return !!data;
    } catch (err) {
        console.warn('幂等性检查异常:', err);
        return false;
    }
};

// ========== 补偿事务：回滚订单更新 ==========
window.APP._rollbackOrder = async function(orderId, originalState) {
    console.warn('[补偿事务] 开始回滚订单:', orderId);
    try {
        const { error } = await supabaseClient
            .from('orders')
            .update(originalState)
            .eq('order_id', orderId);
        if (error) {
            console.error('[补偿事务] 回滚失败:', error);
            if (window.Audit) {
                await window.Audit.log('rollback_failed', JSON.stringify({
                    order_id: orderId,
                    original_state: originalState,
                    error: error.message
                }));
            }
        } else {
            console.log('[补偿事务] 回滚成功:', orderId);
        }
    } catch (err) {
        console.error('[补偿事务] 回滚异常:', err);
    }
};

// ========== 补偿事务：删除已插入的付款记录 ==========
window.APP._rollbackPaymentHistory = async function(orderInternalId, type, amount, date) {
    console.warn('[补偿事务] 删除付款记录:', orderInternalId, type);
    try {
        const { error } = await supabaseClient
            .from('payment_history')
            .delete()
            .eq('order_id', orderInternalId)
            .eq('type', type)
            .eq('amount', amount)
            .eq('date', date);
        if (error) {
            console.error('[补偿事务] 删除付款记录失败:', error);
        }
    } catch (err) {
        console.error('[补偿事务] 删除付款记录异常:', err);
    }
};

// ========== 补偿事务：删除已插入的资金流水 ==========
window.APP._rollbackCashFlow = async function(orderInternalId, flowType, amount) {
    console.warn('[补偿事务] 删除资金流水:', orderInternalId, flowType);
    try {
        const today = Utils.getLocalToday();
        const { error } = await supabaseClient
            .from('cash_flow_records')
            .delete()
            .eq('order_id', orderInternalId)
            .eq('flow_type', flowType)
            .eq('amount', amount)
            .gte('recorded_at', today);
        if (error) {
            console.error('[补偿事务] 删除资金流水失败:', error);
        }
    } catch (err) {
        console.error('[补偿事务] 删除资金流水异常:', err);
    }
};

const PaymentsModule = {

    // ========== 辅助：设置按钮加载状态 ==========
    _setButtonLoading: function(btn, loading) {
        if (!btn) return;
        var lang = Utils.lang;
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = '⏳ ' + (lang === 'id' ? 'Memproses...' : '处理中...');
            btn.style.cursor = 'wait';
            btn.style.opacity = '0.7';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
            btn.style.cursor = '';
            btn.style.opacity = '';
            delete btn.dataset.originalHtml;
        }
    },

    // ========== 辅助：禁用页面所有操作按钮 ==========
    _disableAllActionButtons: function() {
        var buttons = document.querySelectorAll('button.btn-action, button.success, button.early-settle');
        var disabledList = [];
        for (var i = 0; i < buttons.length; i++) {
            if (!buttons[i].disabled) {
                buttons[i].disabled = true;
                buttons[i].style.opacity = '0.6';
                buttons[i].style.cursor = 'not-allowed';
                disabledList.push(buttons[i]);
            }
        }
        return disabledList;
    },

    // ========== 辅助：恢复被禁用的按钮 ==========
    _restoreDisabledButtons: function(disabledList) {
        for (var i = 0; i < disabledList.length; i++) {
            disabledList[i].disabled = false;
            disabledList[i].style.opacity = '';
            disabledList[i].style.cursor = '';
        }
    },

    // ========== 辅助：查找确认按钮 ==========
    _findConfirmButton: function(type) {
        var lang = Utils.lang;
        var buttons = document.querySelectorAll('button.btn-action.success');
        var searchTexts = {
            'interest': [lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款'],
            'principal': [lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款'],
            'fixed': [lang === 'id' ? 'Bayar Angsuran Bulan Ini' : '支付本月还款'],
            'early_settle': [lang === 'id' ? 'Pelunasan Dipercepat' : '提前结清']
        };
        
        var targets = searchTexts[type] || [];
        for (var i = 0; i < buttons.length; i++) {
            for (var j = 0; j < targets.length; j++) {
                if (buttons[i].textContent.indexOf(targets[j]) !== -1) {
                    var card = buttons[i].closest('.card-body');
                    if (type === 'principal' && card && 
                        (card.textContent.indexOf('Kembalikan Pokok') !== -1 || 
                         card.textContent.indexOf('返还本金') !== -1)) {
                        return buttons[i];
                    }
                    if (type === 'interest' && card && 
                        (card.textContent.indexOf('Bayar Bunga') !== -1 || 
                         card.textContent.indexOf('缴纳利息') !== -1)) {
                        return buttons[i];
                    }
                    if (type === 'fixed' || type === 'early_settle') {
                        return buttons[i];
                    }
                }
            }
        }
        return null;
    },

    showPayment: async function(orderId) {
        var lang = Utils.lang;

        const profile = await SUPABASE.getCurrentProfile();

        if (!profile) {
            if (window.Toast) {
                window.Toast.error(Utils.t('login_required'));
            } else {
                alert(Utils.t('login_required'));
            }
            APP.goBack();
            return;
        }

        // 管理员禁止操作订单
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
            if (window.Toast) {
                window.Toast.error(Utils.lang === 'id' ? 'Akun tidak terhubung ke toko' : '账号未关联门店');
            } else {
                alert(Utils.lang === 'id' ? 'Akun tidak terhubung ke toko' : '账号未关联门店');
            }
            APP.goBack();
            return;
        }

        APP.currentPage = 'payment';
        APP.currentOrderId = orderId;
        APP.saveCurrentPageState();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) {
                if (window.Toast) {
                    window.Toast.error(Utils.t('order_not_found'));
                } else {
                    alert(Utils.t('order_not_found'));
                }
                APP.goBack();
                return;
            }
            
            if (order.store_id !== profile.store_id) {
                if (window.Toast) {
                    window.Toast.error(Utils.t('unauthorized'));
                } else {
                    alert(Utils.t('unauthorized'));
                }
                APP.goBack();
                return;
            }

            if (window.Audit) {
                await window.Audit.log('payment_page_view', JSON.stringify({
                    order_id: order.order_id,
                    customer_name: order.customer_name,
                    viewed_by: profile.name
                }));
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

            // ========== 利息历史行 ==========
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = '<tr><td colspan="5" class="text-center text-muted">' + t('no_data') + '</td></table>';
            } else {
                for (var i = 0; i < interestPayments.length; i++) {
                    var p = interestPayments[i];
                    var paymentNumber = i + 1;
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    interestRows += '<tr>' +
                        '<td class="text-center">' + paymentNumber + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td class="text-center">' + (p.months || 1) + ' ' + (lang === 'id' ? 'bln' : '个月') + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="text-center"><span class="payment-method-badge ' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                    '</tr>';
                }
            }

            // ========== 本金历史行 ==========
            var principalRows = '';
            var cumulativePaid = 0;
            if (principalPayments.length === 0) {
                principalRows = '<tr><td colspan="5" class="text-center text-muted">' + t('no_data') + 'NonNull';
            } else {
                for (var i = 0; i < principalPayments.length; i++) {
                    var p = principalPayments[i];
                    cumulativePaid += p.amount;
                    var remainingAfter = loanAmount - cumulativePaid;
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    principalRows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(cumulativePaid) + '</td>' +
                        '<td class="amount ' + (remainingAfter <= 0 ? 'income' : 'expense') + '">' + Utils.formatCurrency(remainingAfter) + '</td>' +
                        '<td class="text-center"><span class="payment-method-badge ' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                    '</tr>';
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

            // ========== 固定还款板块 ==========
            var fixedRepaymentHtml = '';
            if (order.repayment_type === 'fixed') {
                var paidMonths = order.fixed_paid_months || 0;
                var totalMonths = order.repayment_term;
                var remainingMonths = totalMonths - paidMonths;
                var monthlyFixedPayment = order.monthly_fixed_payment || 0;
                var overdueDays = order.overdue_days || 0;
                
                var overdueWarning = '';
                if (overdueDays > 0) {
                    var severityClass = overdueDays >= 30 ? 'severe' : 'mild';
                    overdueWarning = '<div class="overdue-warning ' + severityClass + '">' +
                        '⚠️ ' + (lang === 'id' ? 'Terlambat ' + overdueDays + ' hari' : '逾期 ' + overdueDays + ' 天') +
                        (overdueDays >= 30 ? (lang === 'id' ? ' - Akan memasuki proses likuidasi!' : ' - 将进入变卖程序！') : '') +
                    '</div>';
                }
                
                var progressPercent = totalMonths > 0 ? (paidMonths / totalMonths) * 100 : 0;
                
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
                                '</div>' +
                                '<div class="info-row" style="align-items:center;">' +
                                    '<span></span>' +
                                    '<div class="progress-bar">' +
                                        '<div class="progress-fill" style="width:' + progressPercent + '%;"></div>' +
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
                                '<button onclick="APP.payFixedInstallment(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success" id="fixedPayBtn">' +
                                    '✅ ' + (lang === 'id' ? 'Bayar Angsuran Bulan Ini' : '支付本月还款') +
                                '</button>' +
                                (remainingMonths > 0 ? '<button onclick="APP.earlySettleFixedOrder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action early-settle" id="earlySettleBtn">🎯 ' + t('early_settlement') + '</button>' : '') +
                            '</div>' +
                        '</div>' +
                        '<div class="card-info">' +
                            '<small>💡 ' + (lang === 'id' ? 'Setiap angsuran mencakup bunga dan pokok. Pelunasan dipercepat dapat mengurangi sisa bunga.' : '每期还款包含本金和利息，提前结清可减免剩余利息') + '</small>' +
                        '</div>' +
                    '</div>';
            }

            // ========== 灵活还款板块 ==========
            var flexibleRepaymentHtml = '';
            if (order.repayment_type !== 'fixed') {
                flexibleRepaymentHtml = '' +
                    '<div class="payment-double-column">' +
                        '<div class="card action-card" style="min-width:0;overflow-x:hidden;">' +
                            '<div class="card-header"><h3>💰 ' + (lang === 'id' ? 'Bayar Bunga' : '缴纳利息') + '</h3></div>' +
                            '<div class="card-body">' +
                                '<div class="info-box">' +
                                    '<div class="info-row">' +
                                        '<span>📌 ' + (lang === 'id' ? 'Ini adalah pembayaran bunga ke-' : '本次是第 ') + '<strong>' + nextInterestNumber + '</strong> ' + (lang === 'id' ? 'kali' : '次利息支付') + '</span>' +
                                    '</div>' +
                                    '<div class="info-row">' +
                                        '<span>💰 ' + (lang === 'id' ? 'Jumlah yang harus dibayar' : '应付金额') + ':</span>' +
                                        '<strong>' + Utils.formatCurrency(currentMonthlyInterest) + '</strong>' +
                                    '</div>' +
                                    '<div class="info-row">' +
                                        '<span>📈 ' + t('agreed_rate') + ':</span>' +
                                        '<strong>' + (monthlyRate*100).toFixed(0) + '%</strong>' +
                                    '</div>' +
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
                                '<button onclick="APP.payInterestWithMethod(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success" id="interestConfirmBtn">✅ ' + (lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款') + '</button>' +
                            '</div>' +
                            '<div class="card-history">' +
                                '<div class="history-title">📋 ' + (lang === 'id' ? 'Riwayat ' + t('pay_interest') : t('pay_interest') + '历史') + '</div>' +
                                '<div class="table-container" style="overflow-x:auto;">' +
                                    '<table class="data-table history-table" style="min-width:300px;">' +
                                        '<thead><tr><th class="text-center" style="width:50px;">' + (lang === 'id' ? 'Ke-' : '第几次') + '</th><th class="col-date">' + t('date') + '</th><th class="col-months text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + (lang === 'id' ? 'Metode' : '方式') + '</th> vain</thead>' +
                                        '<tbody>' + interestRows + '</tbody>' +
                                    '</table>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="card action-card" style="min-width:0;overflow-x:hidden;">' +
                            '<div class="card-header"><h3>🏦 ' + (lang === 'id' ? 'Kembalikan Pokok' : '返还本金') + '</h3></div>' +
                            '<div class="card-body">' +
                                '<div class="info-box warning-box">' +
                                    '<div class="info-row">' +
                                        '<span>📊 ' + (lang === 'id' ? 'Pokok Dibayar' : '已还本金') + ':</span>' +
                                        '<strong>' + Utils.formatCurrency(principalPaid) + '</strong>' +
                                    '</div>' +
                                    '<div class="info-row">' +
                                        '<span>📊 ' + (lang === 'id' ? 'Sisa Pokok' : '尚欠本金') + ':</span>' +
                                        '<strong class="' + (remainingPrincipal > 0 ? 'expense' : 'income') + '">' + Utils.formatCurrency(remainingPrincipal) + '</strong>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="action-input-group">' +
                                    '<label class="action-label">' + (lang === 'id' ? 'Jumlah Pembayaran' : '还款金额') + ':</label>' +
                                    '<input type="text" id="principalAmount" class="action-input amount-input" placeholder="0">' +
                                '</div>' +
                                '<div class="payment-method-group">' +
                                    '<div class="payment-method-title">' + (lang === 'id' ? 'Metode Pencatatan' : '入账方式') + ':</div>' +
                                    '<div class="payment-method-options">' +
                                        '<label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ' + t('bank') + '</label>' +
                                        '<label><input type="radio" name="principalTarget" value="cash"> 🏦 ' + t('cash') + '</label>' +
                                    '</div>' +
                                '</div>' +
                                '<button onclick="APP.payPrincipalWithMethod(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success" id="principalConfirmBtn">✅ ' + (lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款') + '</button>' +
                            '</div>' +
                            '<div class="card-history">' +
                                '<div class="history-title">📋 ' + (lang === 'id' ? 'Riwayat ' + t('return_principal') : t('return_principal') + '历史') + '</div>' +
                                '<div class="table-container" style="overflow-x:auto;">' +
                                    '<table class="data-table history-table" style="min-width:300px;">' +
                                        '<thead><tr><th class="col-date">' + t('date') + '</th><th class="col-amount amount">' + (lang === 'id' ? 'Jumlah Dibayar' : '还款金额') + '</th><th class="col-amount amount">' + (lang === 'id' ? 'Total Dibayar' : '累计已还') + '</th><th class="col-amount amount">' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + '</th><th class="col-method text-center">' + (lang === 'id' ? 'Metode' : '方式') + '</th> vain</thead>' +
                                        '<tbody>' + principalRows + '</tbody>' +
                                    '</table>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
            }

            // ========== 组装页面 ==========
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + (lang === 'id' ? 'Pembayaran' : '缴纳费用') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.viewOrder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-detail">📄 ' + t('order_details') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<div class="summary-grid">' +
                        '<div class="summary-item"><span class="label">' + t('customer_name') + ':</span><span class="value">' + Utils.escapeHtml(order.customer_name) + '</span></div>' +
                        '<div class="summary-item"><span class="label">ID:</span><span class="value order-id">' + Utils.escapeHtml(order.order_id) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('loan_amount') + ':</span><span class="value">' + Utils.formatCurrency(loanAmount) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</span><span class="value ' + (remainingPrincipal > 0 ? 'warning' : 'success-text') + '">' + Utils.formatCurrency(remainingPrincipal) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + (lang === 'id' ? 'Bunga Bulanan' : '月利息') + ':</span><span class="value">' + Utils.formatCurrency(currentMonthlyInterest) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('payment_due_date') + ':</span><span class="value">' + nextDueDate + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('repayment_type') + ':</span><span class="value">' + (order.repayment_type === 'fixed' ? '📅 ' + t('fixed_repayment') : '💰 ' + t('flexible_repayment')) + (order.repayment_type === 'fixed' ? ' (' + order.repayment_term + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')' : '') + '</span></div>' +
                        '<div class="summary-item"><span class="label">💎 ' + t('collateral_name') + ':</span><span class="value">' + Utils.escapeHtml(order.collateral_name || '-') + '</span></div>' +
                        '<div class="summary-item"><span class="label">💰 ' + t('service_fee') + ':</span><span class="value">' + Utils.formatCurrency(serviceFeeAmount) + ' (' + (order.service_fee_percent || 0) + '%)</span></div>' +
                        '<div class="summary-item"><span class="label">📋 ' + t('admin_fee') + ':</span><span class="value">' + Utils.formatCurrency(order.admin_fee) + '</span></div>' +
                        '<div class="summary-item"><span class="label">📈 ' + t('agreed_rate') + ':</span><span class="value">' + ((order.agreed_interest_rate || 0.08)*100).toFixed(0) + '%</span></div>' +
                        '<div class="summary-item"><span class="label">✅ ' + t('admin_fee') + ':</span><span class="value income">' + adminFeePaidInfo + '</span></div>' +
                        '<div class="summary-item"><span class="label">✅ ' + t('service_fee') + ':</span><span class="value income">' + serviceFeePaidInfo + '</span></div>' +
                    '</div>' +
                '</div>' +
                fixedRepaymentHtml +
                flexibleRepaymentHtml;

            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            Utils.ErrorHandler.capture(error, 'showPayment');
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data: ' + error.message : '加载失败：' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal memuat data: ' + error.message : '加载失败：' + error.message);
            }
            APP.goBack();
        }
    },

    // ========== 利息收款（防重复提交 + 幂等性 + 补偿事务 + 时区统一） ==========
    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? Utils.t('cash') : Utils.t('bank');
        var lang = Utils.lang;
        
        if (!window.APP._acquirePaymentLock(orderId + '_interest')) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            } else {
                alert(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            }
            return;
        }
        
        var confirmBtn = this._findConfirmButton('interest');
        this._setButtonLoading(confirmBtn, true);
        var disabledButtons = this._disableAllActionButtons();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            
            var monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            var loanAmount = order.loan_amount || 0;
            var principalPaid = order.principal_paid || 0;
            var remainingPrincipal = loanAmount - principalPaid;
            var monthlyInterest = remainingPrincipal * monthlyRate;
            var totalInterest = monthlyInterest * months;
            
            var isDuplicate = await window.APP._checkIdempotency(orderId, 'interest', totalInterest, method);
            if (isDuplicate) {
                if (window.Toast) {
                    window.Toast.warning(lang === 'id' 
                        ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔付款已记录，无需重复处理。');
                } else {
                    alert(lang === 'id' 
                        ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔付款已记录，无需重复处理。');
                }
                await PaymentsModule.showPayment(orderId);
                return;
            }
            
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

            var confirmed = window.Toast ? await window.Toast.confirmPromise(previewMsg) : confirm(previewMsg);
            if (!confirmed) return;
            
            var originalOrderState = {
                interest_paid_months: order.interest_paid_months,
                interest_paid_total: order.interest_paid_total,
                next_interest_due_date: order.next_interest_due_date,
                monthly_interest: order.monthly_interest,
                updated_at: order.updated_at
            };
            
            var orderInternalId = order.id;
            var paymentDate = Utils.getLocalToday();
            
            try {
                var newInterestPaidMonths = (order.interest_paid_months || 0) + months;
                var newInterestPaidTotal = (order.interest_paid_total || 0) + totalInterest;
                var nextDueDate = SUPABASE.calculateNextDueDate(order.created_at, newInterestPaidMonths);
                
                const { error: updateError } = await supabaseClient
                    .from('orders')
                    .update({
                        interest_paid_months: newInterestPaidMonths,
                        interest_paid_total: newInterestPaidTotal,
                        next_interest_due_date: nextDueDate,
                        monthly_interest: monthlyInterest,
                        updated_at: Utils.getLocalDateTime()
                    })
                    .eq('order_id', orderId);
                
                if (updateError) throw new Error('更新订单失败: ' + updateError.message);
                
                const paymentData = {
                    order_id: orderInternalId,
                    date: paymentDate,
                    type: 'interest',
                    months: months,
                    amount: totalInterest,
                    description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang === 'id' ? 'bulan' : '个月') + ' (' + (monthlyRate*100).toFixed(1) + '%)',
                    recorded_by: (await SUPABASE.getCurrentProfile())?.id,
                    payment_method: method
                };
                
                const { error: paymentError } = await supabaseClient
                    .from('payment_history')
                    .insert(paymentData);
                
                if (paymentError) {
                    await window.APP._rollbackOrder(orderId, originalOrderState);
                    throw new Error('插入付款记录失败: ' + paymentError.message);
                }
                
                await SUPABASE.recordCashFlow({
                    store_id: order.store_id,
                    flow_type: 'interest',
                    direction: 'inflow',
                    amount: totalInterest,
                    source_target: method,
                    order_id: orderInternalId,
                    customer_id: order.customer_id,
                    description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang === 'id' ? 'bulan' : '个月') + ' (' + (monthlyRate*100).toFixed(1) + '%)',
                    reference_id: order.order_id
                });
                
                if (window.Audit) {
                    await window.Audit.logPayment(order.order_id, 'interest', totalInterest, method);
                }
                
                if (window.Toast) {
                    window.Toast.success(lang === 'id' ? '✅ Pembayaran bunga berhasil!' : '✅ 利息收款成功！');
                } else {
                    alert(lang === 'id' ? '✅ Pembayaran bunga berhasil!' : '✅ 利息收款成功！');
                }
                await PaymentsModule.showPayment(orderId);
                
            } catch (error) {
                console.error('payInterestWithMethod 事务失败:', error);
                await window.APP._rollbackPaymentHistory(orderInternalId, 'interest', totalInterest, paymentDate);
                if (window.Toast) {
                    window.Toast.error(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
                } else {
                    alert(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
                }
            }
            
        } catch (error) {
            console.error('payInterestWithMethod error:', error);
            Utils.ErrorHandler.capture(error, 'payInterestWithMethod');
            if (window.Toast) {
                window.Toast.error(error.message);
            } else {
                alert(error.message);
            }
        } finally {
            window.APP._releasePaymentLock(orderId + '_interest');
            this._setButtonLoading(confirmBtn, false);
            this._restoreDisabledButtons(disabledButtons);
        }
    },

    // ========== 本金收款（防重复提交 + 幂等性 + 补偿事务 + 时区统一） ==========
    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var target = document.querySelector('input[name="principalTarget"]:checked')?.value || 'bank';
        var targetName = target === 'cash' ? Utils.t('cash') : Utils.t('bank');
        var lang = Utils.lang;
        
        if (isNaN(amount) || amount <= 0) {
            if (window.Toast) {
                window.Toast.warning(Utils.t('invalid_amount'));
            } else {
                alert(Utils.t('invalid_amount'));
            }
            return;
        }
        
        if (!window.APP._acquirePaymentLock(orderId + '_principal')) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            } else {
                alert(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            }
            return;
        }
        
        var confirmBtn = this._findConfirmButton('principal');
        this._setButtonLoading(confirmBtn, true);
        var disabledButtons = this._disableAllActionButtons();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            
            var loanAmount = order.loan_amount || 0;
            var principalPaid = order.principal_paid || 0;
            var remainingPrincipal = loanAmount - principalPaid;
            var actualAmount = Math.min(amount, remainingPrincipal);
            var remainingAfter = remainingPrincipal - actualAmount;
            var isFullSettlement = remainingAfter <= 0;
            
            var isDuplicate = await window.APP._checkIdempotency(orderId, 'principal', actualAmount, target);
            if (isDuplicate) {
                if (window.Toast) {
                    window.Toast.warning(lang === 'id' 
                        ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔付款已记录，无需重复处理。');
                } else {
                    alert(lang === 'id' 
                        ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔付款已记录，无需重复处理。');
                }
                await PaymentsModule.showPayment(orderId);
                return;
            }
            
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

            var confirmed = window.Toast ? await window.Toast.confirmPromise(previewMsg) : confirm(previewMsg);
            if (!confirmed) return;
            
            var originalOrderState = {
                principal_paid: order.principal_paid,
                principal_remaining: order.principal_remaining,
                status: order.status,
                monthly_interest: order.monthly_interest,
                completed_at: order.completed_at,
                updated_at: order.updated_at
            };
            
            var orderInternalId = order.id;
            var paymentDate = Utils.getLocalToday();
            var monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            
            try {
                var newPrincipalPaid = principalPaid + actualAmount;
                var newPrincipalRemaining = loanAmount - newPrincipalPaid;
                
                var updates = { 
                    principal_paid: newPrincipalPaid, 
                    principal_remaining: newPrincipalRemaining,
                    updated_at: Utils.getLocalDateTime()
                };
                
                if (isFullSettlement) {
                    updates.status = 'completed';
                    updates.monthly_interest = 0;
                    updates.completed_at = Utils.getLocalDateTime();
                } else {
                    updates.monthly_interest = newPrincipalRemaining * monthlyRate;
                }
                
                const { error: updateError } = await supabaseClient
                    .from('orders')
                    .update(updates)
                    .eq('order_id', orderId);
                
                if (updateError) throw new Error('更新订单失败: ' + updateError.message);
                
                const paymentData = {
                    order_id: orderInternalId,
                    date: paymentDate,
                    type: 'principal',
                    amount: actualAmount,
                    description: isFullSettlement ? (Utils.lang === 'id' ? 'LUNAS' : '结清') : (Utils.lang === 'id' ? 'Pembayaran pokok' : '还款'),
                    recorded_by: (await SUPABASE.getCurrentProfile())?.id,
                    payment_method: target
                };
                
                const { error: paymentError } = await supabaseClient
                    .from('payment_history')
                    .insert(paymentData);
                
                if (paymentError) {
                    await window.APP._rollbackOrder(orderId, originalOrderState);
                    throw new Error('插入付款记录失败: ' + paymentError.message);
                }
                
                await SUPABASE.recordCashFlow({
                    store_id: order.store_id,
                    flow_type: 'principal',
                    direction: 'inflow',
                    amount: actualAmount,
                    source_target: target,
                    order_id: orderInternalId,
                    customer_id: order.customer_id,
                    description: isFullSettlement ? (Utils.lang === 'id' ? 'LUNAS' : '结清') : (Utils.lang === 'id' ? 'Pembayaran pokok' : '还款'),
                    reference_id: order.order_id
                });
                
                if (window.Audit) {
                    await window.Audit.logPayment(order.order_id, 'principal', actualAmount, target);
                }
                
                if (isFullSettlement) {
                    var printConfirm = lang === 'id'
                        ? '✅ LUNAS!\n\nCetak tanda terima pelunasan?'
                        : '✅ 结清成功！\n\n是否打印结清凭证？';
                    var printConfirmed = window.Toast ? await window.Toast.confirmPromise(printConfirm) : confirm(printConfirm);
                    if (printConfirmed) {
                        APP.printSettlementReceipt(orderId);
                        return;
                    }
                }
                
                if (window.Toast) {
                    window.Toast.success(lang === 'id' ? '✅ Pembayaran pokok berhasil!' : '✅ 本金还款成功！');
                } else {
                    alert(lang === 'id' ? '✅ Pembayaran pokok berhasil!' : '✅ 本金还款成功！');
                }
                await PaymentsModule.showPayment(orderId);
                
            } catch (error) {
                console.error('payPrincipalWithMethod 事务失败:', error);
                await window.APP._rollbackPaymentHistory(orderInternalId, 'principal', actualAmount, paymentDate);
                if (window.Toast) {
                    window.Toast.error(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
                } else {
                    alert(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
                }
            }
            
        } catch (error) {
            console.error('payPrincipalWithMethod error:', error);
            Utils.ErrorHandler.capture(error, 'payPrincipalWithMethod');
            if (window.Toast) {
                window.Toast.error(error.message);
            } else {
                alert(error.message);
            }
        } finally {
            window.APP._releasePaymentLock(orderId + '_principal');
            this._setButtonLoading(confirmBtn, false);
            this._restoreDisabledButtons(disabledButtons);
        }
    },

    // ========== 固定还款 ==========
    payFixedInstallment: async function(orderId) {
        var method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
        var lang = Utils.lang;
        
        if (!window.APP._acquirePaymentLock(orderId + '_fixed')) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            } else {
                alert(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            }
            return;
        }
        
        var confirmBtn = this._findConfirmButton('fixed');
        this._setButtonLoading(confirmBtn, true);
        var disabledButtons = this._disableAllActionButtons();
        
        try {
            var orderBefore = await SUPABASE.getOrder(orderId);
            var fixedPaymentBefore = orderBefore.monthly_fixed_payment || 0;
            
            var isDuplicate = await window.APP._checkIdempotency(orderId, 'fixed_installment', fixedPaymentBefore, method);
            if (isDuplicate) {
                if (window.Toast) {
                    window.Toast.warning(lang === 'id' 
                        ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔付款已记录，无需重复处理。');
                } else {
                    alert(lang === 'id' 
                        ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔付款已记录，无需重复处理。');
                }
                await PaymentsModule.showPayment(orderId);
                return;
            }
            
            var originalOrderState = {
                principal_paid: orderBefore.principal_paid,
                principal_remaining: orderBefore.principal_remaining,
                fixed_paid_months: orderBefore.fixed_paid_months,
                monthly_interest: orderBefore.monthly_interest,
                interest_paid_months: orderBefore.interest_paid_months,
                interest_paid_total: orderBefore.interest_paid_total,
                next_interest_due_date: orderBefore.next_interest_due_date,
                status: orderBefore.status,
                updated_at: orderBefore.updated_at
            };
            
            await SUPABASE.recordFixedPayment(orderId, method);
            
            if (window.Audit) {
                await window.Audit.logPayment(orderBefore.order_id, 'fixed_installment', fixedPaymentBefore, method);
            }
            
            await PaymentsModule.showPayment(orderId);
            
        } catch (error) {
            console.error('payFixedInstallment error:', error);
            Utils.ErrorHandler.capture(error, 'payFixedInstallment');
            if (window.Toast) {
                window.Toast.error(error.message);
            } else {
                alert(error.message);
            }
        } finally {
            window.APP._releasePaymentLock(orderId + '_fixed');
            this._setButtonLoading(confirmBtn, false);
            this._restoreDisabledButtons(disabledButtons);
        }
    },

    // ========== 提前结清 ==========
    earlySettleFixedOrder: async function(orderId) {
        var method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
        var lang = Utils.lang;
        
        if (!window.APP._acquirePaymentLock(orderId + '_early_settle')) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            } else {
                alert(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
            }
            return;
        }
        
        var confirmBtn = this._findConfirmButton('early_settle');
        this._setButtonLoading(confirmBtn, true);
        var disabledButtons = this._disableAllActionButtons();
        
        try {
            var orderBefore = await SUPABASE.getOrder(orderId);
            var remainingPrincipal = orderBefore.principal_remaining || orderBefore.loan_amount || 0;
            
            var isDuplicate = await window.APP._checkIdempotency(orderId, 'early_settlement', remainingPrincipal, method);
            if (isDuplicate) {
                if (window.Toast) {
                    window.Toast.warning(lang === 'id' 
                        ? '⚠️ Pelunasan ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔结清已记录，无需重复处理。');
                } else {
                    alert(lang === 'id' 
                        ? '⚠️ Pelunasan ini sudah tercatat, tidak perlu diproses ulang.' 
                        : '⚠️ 此笔结清已记录，无需重复处理。');
                }
                await PaymentsModule.showPayment(orderId);
                return;
            }
            
            await SUPABASE.earlySettleFixedOrder(orderId, method);
            
            if (window.Audit) {
                await window.Audit.logPayment(orderBefore.order_id, 'early_settlement', remainingPrincipal, method);
            }
            
            await PaymentsModule.showPayment(orderId);
            
        } catch (error) {
            console.error('earlySettleFixedOrder error:', error);
            Utils.ErrorHandler.capture(error, 'earlySettleFixedOrder');
            if (window.Toast) {
                window.Toast.error(error.message);
            } else {
                alert(error.message);
            }
        } finally {
            window.APP._releasePaymentLock(orderId + '_early_settle');
            this._setButtonLoading(confirmBtn, false);
            this._restoreDisabledButtons(disabledButtons);
        }
    },

    // ==================== 打印结清凭证 ====================
    printSettlementReceipt: async function(orderId) {
        try {
            var result = await SUPABASE.getPaymentHistory(orderId);
            var order = result.order;
            var payments = result.payments;
            if (!order) return;
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);

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
                : Utils.formatDate(Utils.getLocalToday());

            var safeOrderId = Utils.escapeHtml(order.order_id);
            var safeCustomer = Utils.escapeHtml(order.customer_name);
            var safeKtp = Utils.escapeHtml(order.customer_ktp || '-');
            var safePhone = Utils.escapeHtml(order.customer_phone || '-');
            var safeCollateral = Utils.escapeHtml(order.collateral_name || '-');
            var safeStore = Utils.escapeHtml(AUTH.getCurrentStoreName ? AUTH.getCurrentStoreName() : '-');
            var safeLoanAmount = Utils.formatCurrency(order.loan_amount);
            var safeTotalAdminFee = Utils.formatCurrency(totalAdminFee);
            var safeTotalServiceFee = Utils.formatCurrency(totalServiceFee);
            var safeTotalInterest = Utils.formatCurrency(totalInterest);
            var safeTotalPrincipal = Utils.formatCurrency(totalPrincipal);
            var safeGrandTotal = Utils.formatCurrency(grandTotal);
            var safeInterestPaidMonths = order.interest_paid_months || 0;

            if (window.Audit) {
                await window.Audit.log('print_settlement_receipt', JSON.stringify({
                    order_id: order.order_id,
                    customer_name: order.customer_name,
                    total_paid: grandTotal,
                    printed_by: AUTH.user?.name || 'System'
                }));
            }

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
                        '<img src="icons/pagehead-logo.png" alt="JF!">' +
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
                    '<div class="row"><span class="lbl">' + (lang === 'id' ? 'Pinjaman Awal' : '原始贷款') + '</span><span class="val">' + safeLoanAmount + '</span></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>💰 ' + (lang === 'id' ? 'Ringkasan Pembayaran' : '付款汇总') + '</h3>' +
                    '<div class="row"><span class="lbl">' + t('admin_fee') + '</span><span class="val">' + safeTotalAdminFee + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('service_fee') + '</span><span class="val">' + safeTotalServiceFee + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('interest') + '</span><span class="val">' + safeTotalInterest + ' (' + safeInterestPaidMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')</span></div>' +
                    '<div class="row"><span class="lbl">' + t('principal') + '</span><span class="val">' + safeTotalPrincipal + '</span></div>' +
                    '<div class="total-row"><span>' + (lang === 'id' ? 'Total Dibayar' : '累计已付总额') + '</span><span>' + safeGrandTotal + '</span></div>' +
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
            Utils.ErrorHandler.capture(error, 'printSettlementReceipt');
            if (window.Toast) {
                window.Toast.error(Utils.lang === 'id' ? 'Gagal mencetak' : '打印失败');
            } else {
                alert(Utils.lang === 'id' ? 'Gagal mencetak' : '打印失败');
            }
            APP.navigateTo('orderTable');
        }
    }
};

for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') window.APP[key] = PaymentsModule[key];
}

window.APP.printSettlementReceipt = PaymentsModule.printSettlementReceipt.bind(PaymentsModule);
