// app-payments.js - v2.0 (JF 命名空间) 增加对 liquidated 订单的拦截

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ========== 跨标签页支付锁（基于 sessionStorage，30秒超时） ==========
    const LOCK_TIMEOUT_MS = 30000; // 锁超时时间
    if (!window.APP) window.APP = {};

    window.APP._acquirePaymentLock = function (lockKey) {
        const storageKey = 'payment_lock_' + lockKey;
        const now = Date.now();
        const existing = sessionStorage.getItem(storageKey);
        if (existing) {
            const lockTime = parseInt(existing, 10);
            if (now - lockTime < LOCK_TIMEOUT_MS) {
                return false; // 锁仍有效
            }
            // 超时，清除旧锁
            sessionStorage.removeItem(storageKey);
        }
        sessionStorage.setItem(storageKey, now.toString());
        return true;
    };

    window.APP._releasePaymentLock = function (lockKey) {
        const storageKey = 'payment_lock_' + lockKey;
        sessionStorage.removeItem(storageKey);
    };

    // 幂等性检查（2分钟窗口，客户端辅助，服务端应有唯一索引）
    window.APP._checkIdempotency = async function (orderId, type, amount, paymentMethod) {
        try {
            const client = SUPABASE.getClient();
            const { data: order, error: orderError } = await client
                .from('orders').select('id').eq('order_id', orderId).single();
            if (orderError || !order) return false;

            const now = new Date();
            const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();

            const { data, error } = await client
                .from('payment_history').select('id')
                .eq('order_id', order.id).eq('type', type)
                .eq('amount', amount).eq('payment_method', paymentMethod)
                .gte('created_at', twoMinutesAgo)
                .maybeSingle();
            if (error) return false;
            return !!data;
        } catch (e) { return false; }
    };

    const PaymentPage = {

        // ==================== 辅助：设置按钮加载状态 ====================
        _setButtonLoading(btn, loading) {
            if (!btn) return;
            const lang = Utils.lang;
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

        _disableAllActionButtons() {
            const buttons = document.querySelectorAll('button.btn--success, button.btn--special, button.btn--warning');
            const disabledList = [];
            for (const btn of buttons) {
                if (!btn.disabled) {
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'not-allowed';
                    disabledList.push(btn);
                }
            }
            return disabledList;
        },

        _restoreDisabledButtons(disabledList) {
            for (const btn of disabledList) {
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.cursor = '';
            }
        },

        _findConfirmButton(type) {
            const lang = Utils.lang;
            const buttons = document.querySelectorAll('button.btn--success, button.btn--special');
            const searchTexts = {
                interest: [lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款'],
                principal: [lang === 'id' ? 'Konfirmasi Pembayaran' : '确认收款'],
                fixed: [lang === 'id' ? 'Bayar Angsuran Bulan Ini' : '支付本月还款'],
                early_settle: [lang === 'id' ? 'Pelunasan Dipercepat' : '提前结清']
            };
            const targets = searchTexts[type] || [];
            for (const btn of buttons) {
                for (const text of targets) {
                    if (btn.textContent.includes(text)) {
                        const card = btn.closest('.card');
                        if (type === 'principal' && card &&
                            (card.textContent.includes('Kembalikan Pokok') || card.textContent.includes('返还本金'))) return btn;
                        if (type === 'interest' && card &&
                            (card.textContent.includes('Bayar Bunga') || card.textContent.includes('缴纳利息'))) return btn;
                        if (type === 'fixed' || type === 'early_settle') return btn;
                    }
                }
            }
            return null;
        },

        // ==================== 显示缴费页面 ====================
        async showPayment(orderId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            const profile = await SUPABASE.getCurrentProfile();
            if (!profile) {
                Utils.toast.error(t('login_required'));
                APP.goBack();
                return;
            }
            if (PERMISSION.isAdmin()) {
                document.getElementById("app").innerHTML = `
                    <div class="page-header"><h2>💰 ${t('payment_page')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button></div></div>
                    <div class="card" style="text-align:center;padding:40px 20px;">
                        <div style="font-size:48px;margin-bottom:16px;">🔒</div>
                        <h3 style="color:#64748b;margin-bottom:12px;">${t('store_operation')}</h3>
                        <p style="color:#94a3b8;margin-bottom:16px;">${lang === 'id' ? 'Administrator tidak dapat melakukan pembayaran pesanan. Silakan gunakan akun operator toko.' : '管理员不能执行订单缴费操作。请使用门店操作员账号。'}</p>
                        <button onclick="APP.goBack()" class="btn btn--outline" style="padding:10px 24px;font-size:14px;">↩️ ${t('back')}</button>
                    </div>`;
                return;
            }
            if (!profile.store_id) {
                Utils.toast.error(lang === 'id' ? 'Akun tidak terhubung ke toko' : '账号未关联门店');
                APP.goBack();
                return;
            }

            APP.currentPage = 'payment';
            APP.currentOrderId = orderId;
            APP.saveCurrentPageState();

            try {
                const order = await SUPABASE.getOrder(orderId);
                if (!order) { Utils.toast.error(t('order_not_found')); APP.goBack(); return; }
                if (order.store_id !== profile.store_id) { Utils.toast.error(t('unauthorized')); APP.goBack(); return; }

                // 订单锁定检查（被锁定时给出提示，而不是静默报错跳仪表盘）
                if (order.is_locked) {
                    document.getElementById("app").innerHTML = `
                        <div class="page-header"><h2>💰 ${t('payment_page')}</h2><div class="header-actions"><button onclick="APP.navigateTo('orderTable')" class="btn btn--outline">↩️ ${t('back')}</button></div></div>
                        <div class="card" style="text-align:center;padding:40px 20px;">
                            <div style="font-size:48px;margin-bottom:16px;">🔒</div>
                            <h3 style="color:#64748b;margin-bottom:12px;">${lang === 'id' ? 'Pesanan sedang dikunci' : '订单正在处理中'}</h3>
                            <p style="color:#94a3b8;margin-bottom:16px;">${lang === 'id' ? 'Pesanan ini sedang dalam proses, silakan coba beberapa saat lagi.' : '该订单正在处理中，请稍后再试。'}</p>
                            <button onclick="APP.navigateTo('orderTable')" class="btn btn--outline" style="padding:10px 24px;">↩️ ${t('back')}</button>
                        </div>`;
                    return;
                }

                // ==================== 新增：拦截已变卖订单 ====================
                if (order.status === 'liquidated') {
                    document.getElementById("app").innerHTML = `
                        <div class="page-header">
                            <h2>💰 ${t('payment_page')}</h2>
                            <div class="header-actions">
                                <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                            </div>
                        </div>
                        <div class="card" style="text-align:center;padding:40px 20px;">
                            <div style="font-size:48px;margin-bottom:16px;">⚖️</div>
                            <h3 style="color:var(--danger);margin-bottom:12px;">
                                ${lang === 'id' ? 'Pesanan telah dilikuidasi' : '订单已变卖'}
                            </h3>
                            <p style="color:var(--text-muted);margin-bottom:16px;">
                                ${lang === 'id' 
                                    ? 'Barang jaminan sudah dijual. Tidak dapat melakukan pembayaran lagi.' 
                                    : '抵押物已变卖，无法继续缴费。'}
                            </p>
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        </div>
                    `;
                    return;
                }

                if (window.Audit) {
                    await window.Audit.log('payment_page_view', JSON.stringify({ order_id: order.order_id, customer_name: order.customer_name, viewed_by: profile.name }));
                }

                const { payments } = await SUPABASE.getPaymentHistory(orderId);
                const loanAmount = order.loan_amount || 0;
                const principalPaid = order.principal_paid || 0;
                const remainingPrincipal = loanAmount - principalPaid;
                const monthlyRate = order.agreed_interest_rate || 0.10;
                const currentMonthlyInterest = remainingPrincipal * monthlyRate;

                const interestPayments = payments.filter(p => p.type === 'interest' && !p.is_voided).sort((a, b) => new Date(a.date) - new Date(b.date));
                const principalPayments = payments.filter(p => p.type === 'principal' && !p.is_voided).sort((a, b) => new Date(a.date) - new Date(b.date));
                const methodMap = { cash: lang === 'id' ? 'Tunai' : '现金', bank: lang === 'id' ? 'Bank BNI' : '银行BNI' };

                const serviceFeeAmount = order.service_fee_amount || 0;
                const serviceFeePaid = order.service_fee_paid || 0;
                const isServiceFeePaid = serviceFeePaid >= serviceFeeAmount;

                // 利息历史
                let interestRows = '';
                let lastInterestDate = '';  // 上次缴息日期，用于日期选择器下限
                if (interestPayments.length === 0) {
                    interestRows = `<tr><td colspan="5" class="text-center text-muted">${t('no_data')}</td>`;
                } else {
                    for (let i = 0; i < interestPayments.length; i++) {
                        const p = interestPayments[i];
                        const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                        interestRows += `<tr><td class="text-center">${i + 1}</td><td class="date-cell">${Utils.formatDate(p.date)}</td><td class="text-center">${p.months || 1} ${t('month')}</td><td class="amount">${Utils.formatCurrency(p.amount)}</td><td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>`;
                    }
                    // 取最后一笔利息记录的日期作为日期选择器的最早下限
                    lastInterestDate = interestPayments[interestPayments.length - 1]?.date?.substring(0, 10) || '';
                }
                // 日期选择器：最早不能早于订单创建日，也不能早于上次缴息日，最晚不能超过今天
                const orderCreatedDate = (order.created_at || '').substring(0, 10);
                const interestDateMin = lastInterestDate > orderCreatedDate ? lastInterestDate : orderCreatedDate;
                const interestDateToday = Utils.getLocalToday();
                // 预付款：日期上限放开到今天起3个月后
                const interestDateMax = (() => {
                    const d = new Date(interestDateToday);
                    d.setMonth(d.getMonth() + 3);
                    return d.toISOString().substring(0, 10);
                })();

                // 本金历史
                let principalRows = '';
                let cumulativePaid = 0;
                if (principalPayments.length === 0) {
                    principalRows = `<tr><td colspan="5" class="text-center text-muted">${t('no_data')}</td>`;
                } else {
                    for (const p of principalPayments) {
                        cumulativePaid += p.amount;
                        const remainingAfter = loanAmount - cumulativePaid;
                        const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                        principalRows += `<tr><td class="date-cell">${Utils.formatDate(p.date)}</td><td class="amount">${Utils.formatCurrency(p.amount)}</td><td class="amount">${Utils.formatCurrency(cumulativePaid)}</td><td class="amount ${remainingAfter <= 0 ? 'income' : 'expense'}">${Utils.formatCurrency(remainingAfter)}</td><td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>`;
                    }
                }

                const nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
                const nextInterestNumber = interestPayments.length + 1;

                // 固定还款部分
                let fixedHtml = '';
                if (order.repayment_type === 'fixed') {
                    const paidMonths = order.fixed_paid_months || 0;
                    const totalMonths = order.repayment_term;
                    const remainingMonths = totalMonths - paidMonths;
                    const monthlyPayment = order.monthly_fixed_payment || 0;
                    const overdueDays = order.overdue_days || 0;
                    const overdueWarning = overdueDays > 0
                        ? `<div class="overdue-warning ${overdueDays >= 30 ? 'severe' : 'mild'}">⚠️ ${t('overdue_warning_days', { days: overdueDays })}${overdueDays >= 30 ? ' - ' + t('enter_liquidation_warning') : ''}</div>`
                        : '';
                    const progressPercent = totalMonths > 0 ? (paidMonths / totalMonths) * 100 : 0;
                    fixedHtml = `
                        <div class="card fixed-repayment-card">
                            <div class="card-header"><h3>📅 ${t('fixed_repayment')}</h3><span class="badge badge--fixed">${t('fixed_repayment')}</span></div>
                            <div class="card-body">
                                <div class="info-box success-box">
                                    <div class="info-row"><span>📊 ${t('progress')}:</span><strong>${paidMonths}/${totalMonths} ${t('month')}</strong></div>
                                    <div class="info-row" style="align-items:center;"><span></span><div class="progress-bar"><div class="progress-fill" style="width:${progressPercent}%;"></div></div></div>
                                    <div class="info-row"><span>💰 ${t('monthly_payment')}:</span><strong class="amount-highlight">${Utils.formatCurrency(monthlyPayment)}</strong></div>
                                    <div class="info-row"><span>📅 ${t('payment_due_date')}:</span><strong>${nextDueDate}</strong></div>
                                    <div class="info-row"><span>📈 ${t('remaining_term')}:</span><strong>${remainingMonths} ${t('month')}</strong></div>
                                    ${overdueWarning}
                                </div>
                                <div class="payment-method-group">
                                    <div class="payment-method-title">${t('recording_method')}:</div>
                                    <div class="payment-method-options"><label><input type="radio" name="fixedMethod" value="cash" checked> 🏦 ${t('cash')}</label><label><input type="radio" name="fixedMethod" value="bank"> 🏧 ${t('bank')}</label></div>
                                </div>
                                <div class="action-buttons">
                                    <button onclick="APP.payFixedInstallment('${Utils.escapeAttr(order.order_id)}')" class="btn btn--success" id="fixedPayBtn">✅ ${t('pay_this_month')}</button>
                                    ${remainingMonths > 0 ? `<button onclick="APP.earlySettleFixedOrder('${Utils.escapeAttr(order.order_id)}')" class="btn btn--special" id="earlySettleBtn">🎯 ${t('early_settlement')}</button>` : ''}
                                </div>
                            </div>
                            <div class="card-info"><small>💡 ${t('each_installment_includes')}</small></div>
                        </div>`;
                }

                // 灵活还款部分
                let flexibleHtml = '';
                if (order.repayment_type !== 'fixed') {
                    flexibleHtml = `
                        <div class="payment-double-column">
                            <div class="card" style="min-width:0;overflow-x:hidden;">
                                <div class="card-header"><h3>💰 ${t('pay_interest')}</h3></div>
                                <div class="card-body">
                                    <div class="info-box"><div class="info-row"><span>📌 ${lang === 'id' ? 'Pembayaran Bunga ke-' : '第'}${nextInterestNumber} ${lang === 'id' ? 'kali' : '次'}</span></div><div class="info-row"><span>💰 ${t('amount_due')}:</span><strong>${Utils.formatCurrency(currentMonthlyInterest)}</strong></div><div class="info-row"><span>📈 ${t('agreed_rate')}:</span><strong>${(monthlyRate*100).toFixed(0)}%</strong></div></div>
                                    <div class="action-input-group">
                                        <label class="action-label">🔢 ${lang === 'id' ? 'Jumlah Bulan Dibayar' : '缴纳期数'}:</label>
                                        <select id="interestMonthsSelect" class="amount-input" style="font-size:14px;padding:8px 10px;" onchange="(function(){
                                            var m=parseInt(document.getElementById('interestMonthsSelect').value)||1;
                                            var base=${Math.round(currentMonthlyInterest)};
                                            document.getElementById('interestAmount').value=Utils.formatNumberWithCommas(base*m);
                                            var today='${interestDateToday}';
                                            var d=new Date(today);
                                            d.setMonth(d.getMonth()+(m-1));
                                            var maxD=d.toISOString().substring(0,10);
                                            var dateEl=document.getElementById('interestPaymentDate');
                                            dateEl.max=maxD;
                                            if(dateEl.value>maxD) dateEl.value=maxD;
                                            var hint=document.getElementById('interestDateHint');
                                            if(hint) hint.textContent=m>1?'💡 ${lang === 'id' ? '预付' : '预付'} '+m+' ${lang === 'id' ? '期，入账日期可为未来' : '期，入账日期可选未来'}':'💡 ${lang === 'id' ? `Boleh pilih tanggal sebelumnya untuk mencatat ulang (min: ${interestDateMin})` : `可选择以前日期补录（最早：${interestDateMin}）`}';
                                        })()">
                                            <option value="1">1 ${lang === 'id' ? 'bulan (normal)' : '期（本期）'}</option>
                                            <option value="2">2 ${lang === 'id' ? 'bulan (bayar muka 1 bln)' : '期（预付1期）'}</option>
                                            <option value="3">3 ${lang === 'id' ? 'bulan (bayar muka 2 bln)' : '期（预付2期）'}</option>
                                        </select>
                                        <div class="form-hint" style="font-size:11px;color:var(--text-muted);margin-top:4px;">💡 ${lang === 'id' ? '1 periode = normal; 2/3 periode = bayar di muka' : '选1期=正常缴费；选2/3期=包含预付款'}</div>
                                    </div>
                                    <div class="action-input-group"><label class="action-label">📅 ${lang === 'id' ? 'Tanggal Pembayaran' : '入账日期'}:</label><input type="date" id="interestPaymentDate" class="amount-input" value="${interestDateToday}" min="${interestDateMin}" max="${interestDateToday}" style="font-size:14px;padding:8px 10px;"><div class="form-hint" id="interestDateHint" style="font-size:11px;color:var(--text-muted);margin-top:4px;">💡 ${lang === 'id' ? `Boleh pilih tanggal sebelumnya untuk mencatat ulang (min: ${interestDateMin})` : `可选择以前日期补录（最早：${interestDateMin}）`}</div></div>
                                    <div class="action-input-group"><label class="action-label">${lang === 'id' ? 'Jumlah Dibayar' : '缴纳金额'}:</label><input type="text" id="interestAmount" class="amount-input" placeholder="${Utils.formatCurrency(currentMonthlyInterest)}" value="${Utils.formatNumberWithCommas(Math.round(currentMonthlyInterest))}"><div class="form-hint" style="font-size:11px;color:var(--text-muted);margin-top:4px;">💡 ${lang === 'id' ? `Bunga 1 bln: ${Utils.formatCurrency(currentMonthlyInterest)} | Otomatis dikalikan jumlah bulan` : `1个月利息: ${Utils.formatCurrency(currentMonthlyInterest)} | 金额随期数自动计算`}</div></div>
                                    <div class="payment-method-group"><div class="payment-method-title">${t('recording_method')}:</div><div class="payment-method-options"><label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label><label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label></div></div>
                                    <button onclick="APP.payInterestWithMethod('${Utils.escapeAttr(order.order_id)}')" class="btn btn--success" id="interestConfirmBtn">✅ ${t('confirm_payment')}</button>
                                </div>
                                <div class="card-history"><div class="history-title">📋 ${t('interest_history')}</div><div class="table-container" style="overflow-x:auto;"><table class="data-table history-table" style="min-width:300px;"><thead><tr><th class="text-center" style="width:50px;">${t('times')}</th><th class="col-date">${t('date')}</th><th class="col-months text-center">${t('month')}</th><th class="col-amount amount">${t('amount')}</th><th class="col-method text-center">${t('payment_method')}</th></table></thead><tbody>${interestRows}</tbody></table></div></div>
                            </div>
                            <div class="card" style="min-width:0;overflow-x:hidden;">
                                <div class="card-header"><h3>🏦 ${t('return_principal')}</h3></div>
                                <div class="card-body">
                                    <div class="info-box warning-box"><div class="info-row"><span>📊 ${t('principal_paid')}:</span><strong>${Utils.formatCurrency(principalPaid)}</strong></div><div class="info-row"><span>📊 ${t('remaining_principal')}:</span><strong class="${remainingPrincipal > 0 ? 'expense' : 'income'}">${Utils.formatCurrency(remainingPrincipal)}</strong></div></div>
                                    <div class="action-input-group"><label class="action-label">${t('payment_amount')}:</label><input type="text" id="principalAmount" class="amount-input" placeholder="0"></div>
                                    <div class="payment-method-group"><div class="payment-method-title">${t('recording_method')}:</div><div class="payment-method-options"><label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ${t('bank')}</label><label><input type="radio" name="principalTarget" value="cash"> 🏦 ${t('cash')}</label></div></div>
                                    <button onclick="APP.payPrincipalWithMethod('${Utils.escapeAttr(order.order_id)}')" class="btn btn--success" id="principalConfirmBtn">✅ ${t('confirm_payment')}</button>
                                </div>
                                <div class="card-history"><div class="history-title">📋 ${t('principal_history')}</div><div class="table-container" style="overflow-x:auto;"><table class="data-table history-table" style="min-width:300px;"><thead><tr><th class="col-date">${t('date')}</th><th class="col-amount amount">${t('payment_amount')}</th><th class="col-amount amount">${t('total')} ${t('principal_paid')}</th><th class="col-amount amount">${t('remaining_principal')}</th><th class="col-method text-center">${t('payment_method')}</th></tr></thead><tbody>${principalRows}</tbody></table></div></div>
                            </div>
                        </div>`;
                }

                // 摘要信息
                const adminFeePayment = payments.find(p => p.type === 'admin_fee' && !p.is_voided);
                const serviceFeePayment = payments.find(p => p.type === 'service_fee' && !p.is_voided);
                const adminFeePaidInfo = order.admin_fee_paid && adminFeePayment
                    ? `${Utils.formatCurrency(order.admin_fee)} (${methodMap[adminFeePayment.payment_method] || '-'} / ${Utils.formatDate(adminFeePayment.date)})`
                    : (order.admin_fee_paid ? Utils.formatCurrency(order.admin_fee) : (lang === 'id' ? 'Belum dibayar' : '未缴'));
                const serviceFeePaidInfo = isServiceFeePaid && serviceFeePayment
                    ? `${Utils.formatCurrency(serviceFeeAmount)} (${methodMap[serviceFeePayment.payment_method] || '-'} / ${Utils.formatDate(serviceFeePayment.date)})`
                    : (serviceFeePaid > 0 ? `${Utils.formatCurrency(serviceFeePaid)}/${Utils.formatCurrency(serviceFeeAmount)}` : (lang === 'id' ? 'Belum dibayar' : '未缴'));

                document.getElementById("app").innerHTML = `
                    <div class="page-header"><h2>💰 ${t('payment_page')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button><button onclick="APP.viewOrder('${Utils.escapeAttr(order.order_id)}')" class="btn btn--primary">📄 ${t('order_details')}</button></div></div>
                    <div class="card">
                        <div class="summary-grid">
                            <div class="summary-item"><span class="label">${t('customer_name')}:</span><span class="value">${Utils.escapeHtml(order.customer_name)}</span></div>
                            <div class="summary-item"><span class="label">ID:</span><span class="value order-id">${Utils.escapeHtml(order.order_id)}</span></div>
                            <div class="summary-item"><span class="label">${t('loan_amount')}:</span><span class="value">${Utils.formatCurrency(loanAmount)}</span></div>
                            <div class="summary-item"><span class="label">${t('remaining_principal')}:</span><span class="value ${remainingPrincipal > 0 ? 'warning' : 'success-text'}">${Utils.formatCurrency(remainingPrincipal)}</span></div>
                            <div class="summary-item"><span class="label">${t('interest')}:</span><span class="value">${Utils.formatCurrency(currentMonthlyInterest)}</span></div>
                            <div class="summary-item"><span class="label">${t('payment_due_date')}:</span><span class="value">${nextDueDate}</span></div>
                            <div class="summary-item"><span class="label">${t('repayment_type')}:</span><span class="value">${order.repayment_type === 'fixed' ? '📅 ' + t('fixed_repayment') : '💰 ' + t('flexible_repayment')}${order.repayment_type === 'fixed' ? ' (' + order.repayment_term + ' ' + t('month') + ')' : ''}</span></div>
                            <div class="summary-item"><span class="label">💎 ${t('collateral_name')}:</span><span class="value">${Utils.escapeHtml(order.collateral_name || '-')}</span></div>
                            <div class="summary-item"><span class="label">💰 ${t('service_fee')}:</span><span class="value">${Utils.formatCurrency(serviceFeeAmount)} (${order.service_fee_percent || 0}%) — <span class="income">${serviceFeePaidInfo}</span></span></div>
                            <div class="summary-item"><span class="label">📋 ${t('admin_fee')}:</span><span class="value">${Utils.formatCurrency(order.admin_fee)} — <span class="income">${adminFeePaidInfo}</span></span></div>
                            <div class="summary-item"><span class="label">📈 ${t('agreed_rate')}:</span><span class="value">${((order.agreed_interest_rate || 0.10)*100).toFixed(0)}%</span></div>
                        </div>
                    </div>
                    ${fixedHtml}
                    ${flexibleHtml}`;

                const principalInput = document.getElementById("principalAmount");
                if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
                const interestInput = document.getElementById("interestAmount");
                if (interestInput && Utils.bindAmountFormat) Utils.bindAmountFormat(interestInput);

            } catch (error) {
                console.error("showPayment error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data: ' + error.message : '加载失败：' + error.message);
                // 用 navigateTo 明确跳回订单列表，避免 historyStack 为空时误跳仪表盘
                if (APP.historyStack && APP.historyStack.length > 0) {
                    APP.goBack();
                } else {
                    APP.navigateTo('orderTable');
                }
            }
        },

        // ==================== 利息收款 ====================
        async payInterestWithMethod(orderId) {
            const actualPaid = Utils.getAmountFromInput('interestAmount');
            const method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
            const methodName = method === 'cash' ? Utils.t('cash') : Utils.t('bank');
            const lang = Utils.lang;
            // 读取期数（1=正常，2/3=预付）
            const monthsSelect = document.getElementById('interestMonthsSelect');
            const selectedMonths = monthsSelect ? (parseInt(monthsSelect.value) || 1) : 1;
            const isPrepaid = selectedMonths > 1;
            // 读取日期选择器（补录时可选历史日期，预付时可选未来日期）
            const paymentDateInput = document.getElementById('interestPaymentDate');
            const paymentDate = (paymentDateInput && paymentDateInput.value) ? paymentDateInput.value : Utils.getLocalToday();

            if (isNaN(actualPaid) || actualPaid <= 0) { Utils.toast.warning(Utils.t('invalid_amount')); return; }

            const lockKey = orderId + '_interest';
            if (!window.APP._acquirePaymentLock(lockKey)) {
                Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses di tab lain, harap tunggu...' : '⏳ 支付正在其他标签页处理中，请稍候...'); return;
            }
            const confirmBtn = this._findConfirmButton('interest');
            this._setButtonLoading(confirmBtn, true);
            const disabledButtons = this._disableAllActionButtons();

            try {
                const order = await SUPABASE.getOrder(orderId);

                // 幂等检查（仅对1期正常缴费做，预付跳过以避免误拦截）
                if (!isPrepaid) {
                    const isDuplicate = await window.APP._checkIdempotency(orderId, 'interest', actualPaid, method);
                    if (isDuplicate) {
                        Utils.toast.warning(lang === 'id' ? 'Pembayaran ini sudah tercatat (2 menit terakhir), tidak perlu diproses ulang.' : '此笔付款在2分钟内已记录，无需重复处理。');
                        await PaymentPage.showPayment(orderId); return;
                    }
                }

                const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
                const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
                const theoreticalInterest = remainingPrincipal * monthlyRate;
                const theoreticalTotal = theoreticalInterest * selectedMonths;
                const nextInterestNumber = (order.interest_paid_months || 0) + 1;

                // 预付时只允许足额，不允许少付
                if (isPrepaid && actualPaid < theoreticalTotal) {
                    Utils.toast.warning(lang === 'id'
                        ? `⚠️ Bayar muka ${selectedMonths} bulan harus minimal ${Utils.formatCurrency(theoreticalTotal)}`
                        : `⚠️ 预付 ${selectedMonths} 期需足额缴纳，最少 ${Utils.formatCurrency(theoreticalTotal)}`);
                    return;
                }

                const calcResult = Utils.calculateInterestPartialPayment(order, actualPaid / selectedMonths);

                let shortfallWarning = '';
                if (!isPrepaid && calcResult.principalDeducted < 0) {
                    const shortfall = Math.abs(calcResult.principalDeducted);
                    shortfallWarning = lang === 'id'
                        ? `\n\n⚠️ PERHATIAN: Jumlah yang dibayar KURANG ${Utils.formatCurrency(shortfall)} dari bunga bulan ini.\nKekurangan ini akan dicatat sebagai HUTANG BUNGA dan harus dilunasi pada pembayaran berikutnya.`
                        : `\n\n⚠️ 注意：支付金额不足，比本月利息少 ${Utils.formatCurrency(shortfall)}。\n差额将记录为利息欠款，需在下次还款时补足。`;
                }

                const prepaidNote = isPrepaid
                    ? (lang === 'id'
                        ? `\n🔔 BAYAR MUKA: Membayar ${selectedMonths} bulan sekaligus (ke-${nextInterestNumber} s/d ke-${nextInterestNumber + selectedMonths - 1})\nTotal: ${Utils.formatCurrency(theoreticalTotal)}`
                        : `\n🔔 预付款：一次性缴纳 ${selectedMonths} 期（第${nextInterestNumber}~${nextInterestNumber + selectedMonths - 1}期）\n应付合计: ${Utils.formatCurrency(theoreticalTotal)}`)
                    : '';

                const previewMsg = lang === 'id'
                    ? `📋 Konfirmasi Pembayaran Bunga\nPesanan: ${order.order_id}\nNasabah: ${order.customer_name}\nPeriode: ke-${nextInterestNumber}${isPrepaid ? ` s/d ke-${nextInterestNumber + selectedMonths - 1}` : ''}\nTanggal: ${paymentDate}\nSisa Pokok: ${Utils.formatCurrency(remainingPrincipal)}\nSuku Bunga: ${(monthlyRate*100).toFixed(0)}%\nBunga per bln: ${Utils.formatCurrency(theoreticalInterest)}\nJumlah Dibayar: ${Utils.formatCurrency(actualPaid)}\nMetode: ${methodName}${prepaidNote}${shortfallWarning}\n\nLanjutkan?`
                    : `📋 利息收款确认\n订单号: ${order.order_id}\n客户: ${order.customer_name}\n期数: 第${nextInterestNumber}期${isPrepaid ? `～第${nextInterestNumber + selectedMonths - 1}期` : ''}\n入账日期: ${paymentDate}\n剩余本金: ${Utils.formatCurrency(remainingPrincipal)}\n月利率: ${(monthlyRate*100).toFixed(0)}%\n每期利息: ${Utils.formatCurrency(theoreticalInterest)}\n实际缴纳: ${Utils.formatCurrency(actualPaid)}\n入账方式: ${methodName}${prepaidNote}${shortfallWarning}\n\n确认收款？`;

                const confirmed = await Utils.toast.confirm(previewMsg);
                if (!confirmed) return;

                try {
                    const result = await SUPABASE.recordInterestPayment(orderId, selectedMonths, method, actualPaid, paymentDate);
                    if (result && result.shortfall > 0) {
                        const shortfallMsg = lang === 'id'
                            ? `⚠️ Pembayaran kurang ${Utils.formatCurrency(result.shortfall)}. Hutang bunga total sekarang: ${Utils.formatCurrency((order.interest_shortfall || 0) + result.shortfall)}`
                            : `⚠️ 本次少付 ${Utils.formatCurrency(result.shortfall)}，累计利息欠款：${Utils.formatCurrency((order.interest_shortfall || 0) + result.shortfall)}`;
                        Utils.toast.warning(shortfallMsg, 8000);
                    } else if (isPrepaid) {
                        Utils.toast.success(lang === 'id' ? `✅ Bayar muka ${selectedMonths} bulan berhasil!` : `✅ 预付 ${selectedMonths} 期利息成功！`, 5000);
                    } else {
                        Utils.toast.success(lang === 'id' ? 'Pembayaran bunga berhasil!' : '利息收款成功！');
                    }

                    if (window.Audit) {
                        await window.Audit.logPayment(order.order_id, isPrepaid ? 'interest_prepaid' : 'interest', actualPaid, method);
                        if (result && result.shortfall > 0) {
                            await window.Audit.log('interest_shortfall', JSON.stringify({
                                order_id: order.order_id,
                                paid: actualPaid,
                                shortfall: result.shortfall,
                                total_shortfall: (order.interest_shortfall || 0) + result.shortfall
                            }));
                        }
                    }
                    if (window.JF && JF.Cache) JF.Cache.clear();
                    await PaymentPage.showPayment(orderId);
                } catch (error) {
                    console.error('payInterestWithMethod 事务失败:', error);
                    Utils.toast.error(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
                }
            } catch (error) {
                console.error('payInterestWithMethod error:', error);
                Utils.toast.error(error.message);
            } finally {
                window.APP._releasePaymentLock(lockKey);
                this._setButtonLoading(confirmBtn, false);
                this._restoreDisabledButtons(disabledButtons);
            }
        },

        // ==================== 本金收款（超额还款提示） ====================
        async payPrincipalWithMethod(orderId) {
            const amount = Utils.getAmountFromInput('principalAmount');
            const target = document.querySelector('input[name="principalTarget"]:checked')?.value || 'bank';
            const targetName = target === 'cash' ? Utils.t('cash') : Utils.t('bank');
            const lang = Utils.lang;

            if (isNaN(amount) || amount <= 0) { Utils.toast.warning(Utils.t('invalid_amount')); return; }

            const lockKey = orderId + '_principal';
            if (!window.APP._acquirePaymentLock(lockKey)) {
                Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses di tab lain, harap tunggu...' : '⏳ 支付正在其他标签页处理中，请稍候...'); return;
            }
            const confirmBtn = this._findConfirmButton('principal');
            this._setButtonLoading(confirmBtn, true);
            const disabledButtons = this._disableAllActionButtons();

            try {
                const order = await SUPABASE.getOrder(orderId);
                const loanAmount = order.loan_amount || 0;
                const principalPaid = order.principal_paid || 0;
                const remainingPrincipal = loanAmount - principalPaid;
                const isOverpayment = amount > remainingPrincipal;
                const actualAmount = Math.min(amount, remainingPrincipal);
                const remainingAfter = remainingPrincipal - actualAmount;
                const isFullSettlement = remainingAfter <= 0;

                const isDuplicate = await window.APP._checkIdempotency(orderId, 'principal', actualAmount, target);
                if (isDuplicate) {
                    Utils.toast.warning(lang === 'id' ? 'Pembayaran ini sudah tercatat (2 menit terakhir), tidak perlu diproses ulang.' : '此笔付款在2分钟内已记录，无需重复处理。');
                    await PaymentPage.showPayment(orderId); return;
                }

                let overpaymentWarning = '';
                if (isOverpayment) {
                    overpaymentWarning = lang === 'id'
                        ? `\n\n⚠️ Anda memasukkan ${Utils.formatCurrency(amount)}, tetapi sisa pokok hanya ${Utils.formatCurrency(remainingPrincipal)}.\nYang akan dibayarkan: ${Utils.formatCurrency(actualAmount)}.`
                        : `\n\n⚠️ 您输入了 ${Utils.formatCurrency(amount)}，但剩余本金为 ${Utils.formatCurrency(remainingPrincipal)}，实际将归还 ${Utils.formatCurrency(actualAmount)}。`;
                }

                const previewMsg = lang === 'id'
                    ? `📋 Konfirmasi Pembayaran Pokok\nPesanan: ${order.order_id}\nNasabah: ${order.customer_name}\nTotal Pinjaman: ${Utils.formatCurrency(loanAmount)}\nPokok Dibayar: ${Utils.formatCurrency(principalPaid)}\nSisa Sebelum: ${Utils.formatCurrency(remainingPrincipal)}\n${isOverpayment ? '⚠️ Jumlah melebihi sisa pokok!' : ''}${overpaymentWarning}\nDibayar Sekarang: ${Utils.formatCurrency(actualAmount)}\nSisa Setelah: ${Utils.formatCurrency(remainingAfter)}\nMetode: ${targetName}\n${isFullSettlement ? '🎉 LUNAS' : 'Pembayaran sebagian'}\nLanjutkan?`
                    : `📋 本金还款确认\n订单号: ${order.order_id}\n客户: ${order.customer_name}\n贷款总额: ${Utils.formatCurrency(loanAmount)}\n已还本金: ${Utils.formatCurrency(principalPaid)}\n还款前剩余: ${Utils.formatCurrency(remainingPrincipal)}\n${isOverpayment ? '⚠️ 金额超出剩余本金！' : ''}${overpaymentWarning}\n本次还款: ${Utils.formatCurrency(actualAmount)}\n还款后剩余: ${Utils.formatCurrency(remainingAfter)}\n入账方式: ${targetName}\n${isFullSettlement ? '🎉 全额结清' : '部分还款'}\n确认收款？`;

                const confirmed = await Utils.toast.confirm(previewMsg);
                if (!confirmed) return;

                try {
                    await SUPABASE.recordPrincipalPayment(orderId, actualAmount, target);
                    if (window.Audit) await window.Audit.logPayment(order.order_id, 'principal', actualAmount, target);

                    if (isFullSettlement) {
                        const printConfirm = lang === 'id' ? 'LUNAS!\n\n' + Utils.t('print_receipt_confirm') : '结清成功！\n\n' + Utils.t('print_receipt_confirm');
                        const printConfirmed = await Utils.toast.confirm(printConfirm);
                        if (printConfirmed) { APP.printSettlementReceipt(orderId); return; }
                    }
                    Utils.toast.success(lang === 'id' ? 'Pembayaran pokok berhasil!' : '本金还款成功！');
                    if (window.JF && JF.Cache) JF.Cache.clear();
                    await PaymentPage.showPayment(orderId);
                } catch (error) {
                    console.error('payPrincipalWithMethod 事务失败:', error);
                    Utils.toast.error(error.message || (lang === 'id' ? 'Gagal memproses pembayaran' : '处理失败'));
                }
            } catch (error) {
                console.error('payPrincipalWithMethod error:', error);
                Utils.toast.error(error.message);
            } finally {
                window.APP._releasePaymentLock(lockKey);
                this._setButtonLoading(confirmBtn, false);
                this._restoreDisabledButtons(disabledButtons);
            }
        },

        // ==================== 固定还款 ====================
        async payFixedInstallment(orderId) {
            const method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
            const lang = Utils.lang;
            const lockKey = orderId + '_fixed';
            if (!window.APP._acquirePaymentLock(lockKey)) {
                Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses di tab lain, harap tunggu...' : '⏳ 支付正在其他标签页处理中，请稍候...'); return;
            }
            const confirmBtn = this._findConfirmButton('fixed');
            this._setButtonLoading(confirmBtn, true);
            const disabledButtons = this._disableAllActionButtons();
            try {
                const orderBefore = await SUPABASE.getOrder(orderId);
                const fixedPaymentBefore = orderBefore.monthly_fixed_payment || 0;
                const isDuplicate = await window.APP._checkIdempotency(orderId, 'fixed_installment', fixedPaymentBefore, method);
                if (isDuplicate) {
                    Utils.toast.warning(lang === 'id' ? 'Pembayaran ini sudah tercatat (2 menit terakhir), tidak perlu diproses ulang.' : '此笔付款在2分钟内已记录，无需重复处理。');
                    await PaymentPage.showPayment(orderId); return;
                }
                await SUPABASE.recordFixedPayment(orderId, method);
                if (window.Audit) await window.Audit.logPayment(orderBefore.order_id, 'fixed_installment', fixedPaymentBefore, method);
                if (window.JF && JF.Cache) JF.Cache.clear();
                await PaymentPage.showPayment(orderId);
            } catch (error) {
                console.error('payFixedInstallment error:', error);
                Utils.toast.error(error.message);
            } finally {
                window.APP._releasePaymentLock(lockKey);
                this._setButtonLoading(confirmBtn, false);
                this._restoreDisabledButtons(disabledButtons);
            }
        },

        // ==================== 提前结清 ====================
        async earlySettleFixedOrder(orderId) {
            const method = document.querySelector('input[name="fixedMethod"]:checked')?.value || 'cash';
            const lang = Utils.lang;
            const lockKey = orderId + '_early_settle';
            if (!window.APP._acquirePaymentLock(lockKey)) {
                Utils.toast.warning(lang === 'id' ? '⏳ Pembayaran sedang diproses di tab lain, harap tunggu...' : '⏳ 支付正在其他标签页处理中，请稍候...'); return;
            }
            const confirmBtn = this._findConfirmButton('early_settle');
            this._setButtonLoading(confirmBtn, true);
            const disabledButtons = this._disableAllActionButtons();
            try {
                const orderBefore = await SUPABASE.getOrder(orderId);
                const remainingPrincipal = orderBefore.principal_remaining || orderBefore.loan_amount || 0;
                const isDuplicate = await window.APP._checkIdempotency(orderId, 'early_settlement', remainingPrincipal, method);
                if (isDuplicate) {
                    Utils.toast.warning(lang === 'id' ? 'Pelunasan ini sudah tercatat (2 menit terakhir), tidak perlu diproses ulang.' : '此笔结清在2分钟内已记录，无需重复处理。');
                    await PaymentPage.showPayment(orderId); return;
                }
                await SUPABASE.earlySettleFixedOrder(orderId, method);
                if (window.Audit) await window.Audit.logPayment(orderBefore.order_id, 'early_settlement', remainingPrincipal, method);
                if (window.JF && JF.Cache) JF.Cache.clear();
                await PaymentPage.showPayment(orderId);
            } catch (error) {
                console.error('earlySettleFixedOrder error:', error);
                Utils.toast.error(error.message);
            } finally {
                window.APP._releasePaymentLock(lockKey);
                this._setButtonLoading(confirmBtn, false);
                this._restoreDisabledButtons(disabledButtons);
            }
        },

        // ==================== 打印结清凭证 ====================
        async printSettlementReceipt(orderId) {
            const lang = Utils.lang;
            try {
                const order = await SUPABASE.getOrder(orderId);
                if (!order || order.status !== 'completed') {
                    Utils.toast.error(lang === 'id' ? 'Pesanan belum lunas' : '订单未结清');
                    return;
                }
                const storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                const storeName = await SUPABASE.getStoreName(order.store_id);
                const printWindow = window.open('', '_blank');
                const printDateTime = new Date().toLocaleString();
                const userName = AUTH.user?.name || '-';
                const storeAddress = '';
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head><meta charset="UTF-8"><title>${lang === 'id' ? 'Tanda Terima Pelunasan' : '结清凭证'}</title>
                    <style>
                        *{margin:0;padding:0;box-sizing:border-box}
                        body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;padding:15mm;color:#1e293b}
                        .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:10px}
                        .logo{font-size:16pt;font-weight:bold;color:#2563eb}
                        .store-info{font-size:9pt;color:#475569;margin:5px 0}
                        .title{font-size:18pt;margin:15px 0;color:#10b981}
                        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:20px 0}
                        .info-item{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0}
                        .info-label{font-weight:600}
                        .total-box{margin:20px 0;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;text-align:center}
                        .total-amount{font-size:18pt;font-weight:bold;color:#10b981}
                        .footer{text-align:center;font-size:8pt;color:#94a3b8;margin-top:30px;border-top:1px solid #e2e8f0;padding-top:10px}
                        @media print{body{padding:0} .no-print{display:none}}
                    </style>
                    </head>
                    <body>
                        <div class="header">
                            <div class="logo">JF! by Gadai</div>
                            <div class="store-info">🏪 ${Utils.escapeHtml(storeName)}</div>
                        </div>
                        <div class="title">${lang === 'id' ? '✅ TANDA TERIMA PELUNASAN' : '✅ 结清凭证'}</div>
                        <div class="info-grid">
                            <div class="info-item"><span class="info-label">${lang === 'id' ? 'ID Pesanan' : '订单号'}:</span><span>${Utils.escapeHtml(order.order_id)}</span></div>
                            <div class="info-item"><span class="info-label">${lang === 'id' ? 'Nasabah' : '客户'}:</span><span>${Utils.escapeHtml(order.customer_name)}</span></div>
                            <div class="info-item"><span class="info-label">${lang === 'id' ? 'Jaminan' : '质押物'}:</span><span>${Utils.escapeHtml(order.collateral_name)}</span></div>
                            <div class="info-item"><span class="info-label">${lang === 'id' ? 'Total Pinjaman' : '贷款总额'}:</span><span>${Utils.formatCurrency(order.loan_amount)}</span></div>
                            <div class="info-item"><span class="info-label">${lang === 'id' ? 'Tanggal Lunas' : '结清日期'}:</span><span>${Utils.formatDate(order.completed_at || new Date().toISOString())}</span></div>
                        </div>
                        <div class="total-box">
                            <div>${lang === 'id' ? 'Total Dibayar' : '总计已支付'}</div>
                            <div class="total-amount">${Utils.formatCurrency(order.loan_amount)}</div>
                        </div>
                        <div class="footer">
                            <div>${lang === 'id' ? 'Terima kasih telah menggunakan layanan JF! by Gadai' : '感谢您使用 JF! 典当服务'}</div>
                            <div>${lang === 'id' ? 'Dicetak pada' : '打印时间'}: ${printDateTime} | ${Utils.escapeHtml(userName)}</div>
                        </div>
                        <div class="no-print" style="text-align:center;margin-top:20px;">
                            <button onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="window.close()">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            } catch (error) {
                console.error("printSettlementReceipt error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal mencetak tanda terima' : '打印凭证失败');
            }
        }
    };

    // 挂载到命名空间
    JF.PaymentPage = PaymentPage;

    if (window.APP) {
        window.APP.showPayment = PaymentPage.showPayment.bind(PaymentPage);
        window.APP.payInterestWithMethod = PaymentPage.payInterestWithMethod.bind(PaymentPage);
        window.APP.payPrincipalWithMethod = PaymentPage.payPrincipalWithMethod.bind(PaymentPage);
        window.APP.payFixedInstallment = PaymentPage.payFixedInstallment.bind(PaymentPage);
        window.APP.earlySettleFixedOrder = PaymentPage.earlySettleFixedOrder.bind(PaymentPage);
        window.APP.printSettlementReceipt = PaymentPage.printSettlementReceipt.bind(PaymentPage);
    } else {
        window.APP = {
            showPayment: PaymentPage.showPayment.bind(PaymentPage),
            payInterestWithMethod: PaymentPage.payInterestWithMethod.bind(PaymentPage),
            payPrincipalWithMethod: PaymentPage.payPrincipalWithMethod.bind(PaymentPage),
            payFixedInstallment: PaymentPage.payFixedInstallment.bind(PaymentPage),
            earlySettleFixedOrder: PaymentPage.earlySettleFixedOrder.bind(PaymentPage),
            printSettlementReceipt: PaymentPage.printSettlementReceipt.bind(PaymentPage)
        };
    }

})();
