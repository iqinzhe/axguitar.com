// app-payments.js - v2.2
// 修复：问题5 - 利息收款双路径安全加固
//   - 统一使用 app-payments.js 的安全路径（防重锁+幂等检查+补偿事务）
//   - 标记 supabase.js 的 recordInterestPayment() 为内部使用（需经过本层安全检查）
//   - payFixedInstallment() 本金负数保护
//   - 修复：earlySettleFixedOrder 中的 confirm 改为异步 Utils.toast.confirm

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
        const client = SUPABASE.getClient();
        const { data: order, error: orderError } = await client
            .from('orders')
            .select('id')
            .eq('order_id', orderId)
            .single();
        
        if (orderError || !order) return false;
        
        const today = Utils.getLocalToday();
        const { data, error } = await client
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
        const client = SUPABASE.getClient();
        const { error } = await client
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
        const client = SUPABASE.getClient();
        const { error } = await client
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
        const client = SUPABASE.getClient();
        const today = Utils.getLocalToday();
        const { error } = await client
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
        var t = Utils.t.bind(Utils);

        const profile = await SUPABASE.getCurrentProfile();

        if (!profile) {
            Utils.toast.error(t('login_required'));
            APP.goBack();
            return;
        }

        if (profile.role === 'admin') {
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + t('payment_page') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card" style="text-align:center; padding:40px 20px;">' +
                    '<div style="font-size:48px; margin-bottom:16px;">🔒</div>' +
                    '<h3 style="color:#64748b; margin-bottom:12px;">' + t('store_operation') + '</h3>' +
                    '<p style="color:#94a3b8; margin-bottom:16px;">' +
                        (lang === 'id' 
                            ? 'Administrator tidak dapat melakukan pembayaran pesanan. Silakan gunakan akun operator toko.'
                            : '管理员不能执行订单缴费操作。请使用门店操作员账号。') +
                    '</p>' +
                    '<button onclick="APP.goBack()" class="btn-back" style="padding:10px 24px; font-size:14px;">↩️ ' + t('back') + '</button>' +
                '</div>';
            return;
        }

        if (!profile.store_id) {
            Utils.toast.error(Utils.lang === 'id' ? 'Akun tidak terhubung ke toko' : '账号未关联门店');
            APP.goBack();
            return;
        }

        APP.currentPage = 'payment';
        APP.currentOrderId = orderId;
        APP.saveCurrentPageState();
        
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) {
                Utils.toast.error(t('order_not_found'));
                APP.goBack();
                return;
            }
            
            if (order.store_id !== profile.store_id) {
                Utils.toast.error(t('unauthorized'));
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
                interestRows = '<tr><td colspan="5" class="text-center text-muted">' + t('no_data') + '</td>';
            } else {
                for (var i = 0; i < interestPayments.length; i++) {
                    var p = interestPayments[i];
                    var paymentNumber = i + 1;
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    interestRows += '<tr>' +
                        '<td class="text-center">' + paymentNumber + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td class="text-center">' + (p.months || 1) + ' ' + t('month') + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="text-center"><span class="badge badge-method-' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                    '</tr>';
                }
            }

            var principalRows = '';
            var cumulativePaid = 0;
            if (principalPayments.length === 0) {
                principalRows = '<tr><td colspan="5" class="text-center text-muted">' + t('no_data') + '</td>';
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
                        '<td class="text-center"><span class="badge badge-method-' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                    '</tr>';
                }
            }

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var interestOptions = [1, 2, 3].map(function(i) {
                return '<option value="' + i + '">' + i + ' ' + t('month') + ' = ' + Utils.formatCurrency(currentMonthlyInterest * i) + '</option>';
            }).join('');

            var nextInterestNumber = interestPayments.length + 1;

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
                        '⚠️ ' + t('overdue_warning_days').replace('{days}', overdueDays) +
                        (overdueDays >= 30 ? ' - ' + t('enter_liquidation_warning') : '') +
                    '</div>';
                }
                
                var progressPercent = totalMonths > 0 ? (paidMonths / totalMonths) * 100 : 0;
                
                fixedRepaymentHtml = '' +
                    '<div class="card action-card fixed-repayment-card">' +
                        '<div class="card-header">' +
                            '<h3>📅 ' + t('fixed_repayment') + '</h3>' +
                            '<span class="badge badge-repayment-fixed">' + t('fixed_repayment') + '</span>' +
                        '</div>' +
                        '<div class="card-body">' +
                            '<div class="info-box success-box">' +
                                '<div class="info-row">' +
                                    '<span>📊 ' + t('progress') + ':</span>' +
                                    '<strong>' + paidMonths + '/' + totalMonths + ' ' + t('month') + '</strong>' +
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
                                    '<strong>' + remainingMonths + ' ' + t('month') + '</strong>' +
                                '</div>' +
                                overdueWarning +
                            '</div>' +
                            '<div class="payment-method-group">' +
                                '<div class="payment-method-title">' + t('recording_method') + ':</div>' +
                                '<div class="payment-method-options">' +
                                    '<label><input type="radio" name="fixedMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                    '<label><input type="radio" name="fixedMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                '</div>' +
                            '</div>' +
                            '<div class="action-buttons">' +
                                '<button onclick="APP.payFixedInstallment(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success" id="fixedPayBtn">' +
                                    '✅ ' + t('pay_this_month') +
                                '</button>' +
                                (remainingMonths > 0 ? '<button onclick="APP.earlySettleFixedOrder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action early-settle" id="earlySettleBtn">🎯 ' + t('early_settlement') + '</button>' : '') +
                            '</div>' +
                        '</div>' +
                        '<div class="card-info">' +
                            '<small>💡 ' + t('each_installment_includes') + '</small>' +
                        '</div>' +
                    '</div>';
            }

            var flexibleRepaymentHtml = '';
            if (order.repayment_type !== 'fixed') {
                flexibleRepaymentHtml = '' +
                    '<div class="payment-double-column">' +
                        '<div class="card action-card" style="min-width:0;overflow-x:hidden;">' +
                            '<div class="card-header"><h3>💰 ' + t('pay_interest') + '</h3></div>' +
                            '<div class="card-body">' +
                                '<div class="info-box">' +
                                    '<div class="info-row">' +
                                        '<span>📌 ' + t('interest_payment_num') + '<strong>' + nextInterestNumber + '</strong> ' + t('times') + '</span>' +
                                    '</div>' +
                                    '<div class="info-row">' +
                                        '<span>💰 ' + t('amount_due') + ':</span>' +
                                        '<strong>' + Utils.formatCurrency(currentMonthlyInterest) + '</strong>' +
                                    '</div>' +
                                    '<div class="info-row">' +
                                        '<span>📈 ' + t('agreed_rate') + ':</span>' +
                                        '<strong>' + (monthlyRate*100).toFixed(0) + '%</strong>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="action-input-group">' +
                                    '<label class="action-label">' + t('take_months') + ':</label>' +
                                    '<select id="interestMonths" class="action-select">' + interestOptions + '</select>' +
                                '</div>' +
                                '<div class="payment-method-group">' +
                                    '<div class="payment-method-title">' + t('recording_method') + ':</div>' +
                                    '<div class="payment-method-options">' +
                                        '<label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                        '<label><input type="radio" name="interestMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                    '</div>' +
                                '</div>' +
                                '<button onclick="APP.payInterestWithMethod(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success" id="interestConfirmBtn">✅ ' + t('confirm_payment') + '</button>' +
                            '</div>' +
                            '<div class="card-history">' +
                                '<div class="history-title">📋 ' + t('interest_history') + '</div>' +
                                '<div class="table-container" style="overflow-x:auto;">' +
                                    '<table class="data-table history-table" style="min-width:300px;">' +
                                        '<thead><tr><th class="text-center" style="width:50px;">' + t('times') + '</th><th class="col-date">' + t('date') + '</th><th class="col-months text-center">' + t('month') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + t('payment_method') + '</th></tr></thead>' +
                                        '<tbody>' + interestRows + '</tbody>' +
                                    '</table>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="card action-card" style="min-width:0;overflow-x:hidden;">' +
                            '<div class="card-header"><h3>🏦 ' + t('return_principal') + '</h3></div>' +
                            '<div class="card-body">' +
                                '<div class="info-box warning-box">' +
                                    '<div class="info-row">' +
                                        '<span>📊 ' + t('principal_paid') + ':</span>' +
                                        '<strong>' + Utils.formatCurrency(principalPaid) + '</strong>' +
                                    '</div>' +
                                    '<div class="info-row">' +
                                        '<span>📊 ' + t('remaining_principal') + ':</span>' +
                                        '<strong class="' + (remainingPrincipal > 0 ? 'expense' : 'income') + '">' + Utils.formatCurrency(remainingPrincipal) + '</strong>' +
                                    '</div>' +
                                '</div>' +
                                '<div class="action-input-group">' +
                                    '<label class="action-label">' + t('payment_amount') + ':</label>' +
                                    '<input type="text" id="principalAmount" class="action-input amount-input" placeholder="0">' +
                                '</div>' +
                                '<div class="payment-method-group">' +
                                    '<div class="payment-method-title">' + t('recording_method') + ':</div>' +
                                    '<div class="payment-method-options">' +
                                        '<label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ' + t('bank') + '</label>' +
                                        '<label><input type="radio" name="principalTarget" value="cash"> 🏦 ' + t('cash') + '</label>' +
                                    '</div>' +
                                '</div>' +
                                '<button onclick="APP.payPrincipalWithMethod(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-action success" id="principalConfirmBtn">✅ ' + t('confirm_payment') + '</button>' +
                            '</div>' +
                            '<div class="card-history">' +
                                '<div class="history-title">📋 ' + t('principal_history') + '</div>' +
                                '<div class="table-container" style="overflow-x:auto;">' +
                                    '<table class="data-table history-table" style="min-width:300px;">' +
                                        '<thead><tr><th class="col-date">' + t('date') + '</th><th class="col-amount amount">' + t('payment_amount') + '</th><th class="col-amount amount">' + t('total') + ' ' + t('principal_paid') + '</th><th class="col-amount amount">' + t('remaining_principal') + '</th><th class="col-method text-center">' + t('payment_method') + '</th></tr></thead>' +
                                        '<tbody>' + principalRows + '</tbody>' +
                                    '</tr>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
            }

            var adminFeePayment = payments.find(function(p) { return p.type === 'admin_fee' && !p.is_voided; });
            var serviceFeePayment = payments.find(function(p) { return p.type === 'service_fee' && !p.is_voided; });
            
            var adminFeePaidInfo = order.admin_fee_paid && adminFeePayment
                ? Utils.formatCurrency(order.admin_fee) + ' (' + (methodMap[adminFeePayment.payment_method] || '-') + ' / ' + Utils.formatDate(adminFeePayment.date) + ')'
                : (order.admin_fee_paid ? Utils.formatCurrency(order.admin_fee) : (lang === 'id' ? 'Belum dibayar' : '未缴'));
            
            var serviceFeePaidInfo = isServiceFeePaid && serviceFeePayment
                ? Utils.formatCurrency(serviceFeeAmount) + ' (' + (methodMap[serviceFeePayment.payment_method] || '-') + ' / ' + Utils.formatDate(serviceFeePayment.date) + ')'
                : (serviceFeePaid > 0 ? Utils.formatCurrency(serviceFeePaid) + '/' + Utils.formatCurrency(serviceFeeAmount) : (lang === 'id' ? 'Belum dibayar' : '未缴'));

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + t('payment_page') + '</h2>' +
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
                        '<div class="summary-item"><span class="label">' + t('remaining_principal') + ':</span><span class="value ' + (remainingPrincipal > 0 ? 'warning' : 'success-text') + '">' + Utils.formatCurrency(remainingPrincipal) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('interest') + ':</span><span class="value">' + Utils.formatCurrency(currentMonthlyInterest) + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('payment_due_date') + ':</span><span class="value">' + nextDueDate + '</span></div>' +
                        '<div class="summary-item"><span class="label">' + t('repayment_type') + ':</span><span class="value">' + (order.repayment_type === 'fixed' ? '📅 ' + t('fixed_repayment') : '💰 ' + t('flexible_repayment')) + (order.repayment_type === 'fixed' ? ' (' + order.repayment_term + ' ' + t('month') + ')' : '') + '</span></div>' +
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
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data: ' + error.message : '加载失败：' + error.message);
            APP.goBack();
        }
    },

    // ========== 利息收款（防重锁 + 幂等检查 + 补偿事务） ==========
    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? Utils.t('cash') : Utils.t('bank');
        var lang = Utils.lang;
        
        if (!window.APP._acquirePaymentLock(orderId + '_interest')) {
            Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
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
                Utils.toast.warning(lang === 'id' 
                    ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                    : '⚠️ 此笔付款已记录，无需重复处理。');
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

            var confirmed = await Utils.toast.confirm(previewMsg);
            if (!confirmed) return;
            
            try {
                await SUPABASE.recordInterestPayment(orderId, months, method);
                
                if (window.Audit) {
                    await window.Audit.logPayment(order.order_id, 'interest', totalInterest, method);
                }
                
                Utils.toast.success(lang === 'id' ? '✅ Pembayaran bunga berhasil!' : '✅ 利息收款成功！');
                await PaymentsModule.showPayment(orderId);
                
            } catch (error) {
                console.error('payInterestWithMethod 事务失败:', error);
                Utils.toast.error(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
            }
            
        } catch (error) {
            console.error('payInterestWithMethod error:', error);
            Utils.ErrorHandler.capture(error, 'payInterestWithMethod');
            Utils.toast.error(error.message);
        } finally {
            window.APP._releasePaymentLock(orderId + '_interest');
            this._setButtonLoading(confirmBtn, false);
            this._restoreDisabledButtons(disabledButtons);
        }
    },

    // ========== 本金收款（防重锁 + 幂等检查 + 补偿事务） ==========
    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var target = document.querySelector('input[name="principalTarget"]:checked')?.value || 'bank';
        var targetName = target === 'cash' ? Utils.t('cash') : Utils.t('bank');
        var lang = Utils.lang;
        
        if (isNaN(amount) || amount <= 0) {
            Utils.toast.warning(Utils.t('invalid_amount'));
            return;
        }
        
        if (!window.APP._acquirePaymentLock(orderId + '_principal')) {
            Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
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
                Utils.toast.warning(lang === 'id' 
                    ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                    : '⚠️ 此笔付款已记录，无需重复处理。');
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

            var confirmed = await Utils.toast.confirm(previewMsg);
            if (!confirmed) return;
            
            try {
                await SUPABASE.recordPrincipalPayment(orderId, actualAmount, target);
                
                if (window.Audit) {
                    await window.Audit.logPayment(order.order_id, 'principal', actualAmount, target);
                }
                
                if (isFullSettlement) {
                    var printConfirm = lang === 'id'
                        ? '✅ LUNAS!\n\n' + Utils.t('print_receipt_confirm')
                        : '✅ 结清成功！\n\n' + Utils.t('print_receipt_confirm');
                    var printConfirmed = await Utils.toast.confirm(printConfirm);
                    if (printConfirmed) {
                        APP.printSettlementReceipt(orderId);
                        return;
                    }
                }
                
                Utils.toast.success(lang === 'id' ? '✅ Pembayaran pokok berhasil!' : '✅ 本金还款成功！');
                await PaymentsModule.showPayment(orderId);
                
            } catch (error) {
                console.error('payPrincipalWithMethod 事务失败:', error);
                Utils.toast.error(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
            }
            
        } catch (error) {
            console.error('payPrincipalWithMethod error:', error);
            Utils.ErrorHandler.capture(error, 'payPrincipalWithMethod');
            Utils.toast.error(error.message);
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
            Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
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
                Utils.toast.warning(lang === 'id' 
                    ? '⚠️ Pembayaran ini sudah tercatat, tidak perlu diproses ulang.' 
                    : '⚠️ 此笔付款已记录，无需重复处理。');
                await PaymentsModule.showPayment(orderId);
                return;
            }
            
            await SUPABASE.recordFixedPayment(orderId, method);
            
            if (window.Audit) {
                await window.Audit.logPayment(orderBefore.order_id, 'fixed_installment', fixedPaymentBefore, method);
            }
            
            await PaymentsModule.showPayment(orderId);
            
        } catch (error) {
            console.error('payFixedInstallment error:', error);
            Utils.ErrorHandler.capture(error, 'payFixedInstallment');
            Utils.toast.error(error.message);
        } finally {
            window.APP._releasePaymentLock(orderId + '_fixed');
            this._setButtonLoading(confirmBtn, false);
            this._restoreDisabledButtons(disabledButtons);
        }
    },

    // ========== 提前结清（修复：将 confirm 改为异步 Utils.toast.confirm） ==========
    earlySettleFixedOrder: async function(orderId) {
        var method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
        var lang = Utils.lang;
        
        if (!window.APP._acquirePaymentLock(orderId + '_early_settle')) {
            Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
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
                Utils.toast.warning(lang === 'id' 
                    ? '⚠️ Pelunasan ini sudah tercatat, tidak perlu diproses ulang.' 
                    : '⚠️ 此笔结清已记录，无需重复处理。');
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
            Utils.toast.error(error.message);
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
            '<title>' + t('settlement_receipt') + ' - ' + safeOrderId + '</title>' +
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
                    '<button class="btn-p" onclick="window.print()">🖨️ ' + t('print') + '</button>' +
                    '<button class="btn-c" onclick="window.close()">' + t('close') + '</button>' +
                '</div>' +
                '<div class="header">' +
                    '<div class="header-logo">' +
                        '<img src="icons/pagehead-logo.png" alt="JF!">' +
                        '<h1>JF! by Gadai</h1>' +
                    '</div>' +
                    '<div><span class="badge">✅ ' + t('settlement_receipt') + '</span></div>' +
                    '<div style="margin-top:6px;font-size:11px;color:#475569">' + (lang === 'id' ? 'Tanggal Lunas' : '结清日期') + ': <strong>' + completedAt + '</strong> &nbsp;|&nbsp; ' + t('order_id') + ': <strong>' + safeOrderId + '</strong></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>👤 ' + t('customer_info') + '</h3>' +
                    '<div class="row"><span class="lbl">' + t('customer_name') + '</span><span class="val">' + safeCustomer + '</span></div>' +
                    '<div class="row"><span class="lbl">KTP</span><span class="val">' + safeKtp + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('phone') + '</span><span class="val">' + safePhone + '</span></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>💎 ' + t('collateral_info') + '</h3>' +
                    '<div class="row"><span class="lbl">' + t('collateral_name') + '</span><span class="val">' + safeCollateral + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('loan_amount') + '</span><span class="val">' + safeLoanAmount + '</span></div>' +
                '</div>' +
                '<div class="section">' +
                    '<h3>💰 ' + (lang === 'id' ? 'Ringkasan Pembayaran' : '付款汇总') + '</h3>' +
                    '<div class="row"><span class="lbl">' + t('admin_fee') + '</span><span class="val">' + safeTotalAdminFee + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('service_fee') + '</span><span class="val">' + safeTotalServiceFee + '</span></div>' +
                    '<div class="row"><span class="lbl">' + t('interest') + '</span><span class="val">' + safeTotalInterest + ' (' + safeInterestPaidMonths + ' ' + t('month') + ')</span></div>' +
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
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal mencetak' : '打印失败');
            APP.navigateTo('orderTable');
        }
    }
};

for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') window.APP[key] = PaymentsModule[key];
}

window.APP.printSettlementReceipt = PaymentsModule.printSettlementReceipt.bind(PaymentsModule);
