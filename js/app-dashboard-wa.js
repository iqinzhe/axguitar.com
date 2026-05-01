// app-dashboard-wa.js - v2.0 (JF 命名空间)
// WA 提醒文本生成模块，挂载到 JF.WA

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const WA = {
        /**
         * 生成 WA 提醒文本（精简版，仅含3个核心信息）
         * @param {Object} order - 订单对象
         * @param {string} senderNumber - 发送方号码
         * @returns {string} 用于 WhatsApp 的文本
         */
        generateText(order, senderNumber) {
            const lang = Utils.lang;
            const monthlyRate = order.agreed_interest_rate || 0.08;
            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const currentMonthlyInterest = remainingPrincipal * monthlyRate;
            const dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            const repaymentType = order.repayment_type || 'flexible';
            const sender = senderNumber || 'JF! by Gadai';

            if (lang === 'id') {
                if (repaymentType === 'fixed') {
                    const monthlyFixedPayment = order.monthly_fixed_payment || 0;
                    const paidMonths = order.fixed_paid_months || 0;
                    const totalMonths = order.repayment_term || '?';
                    return (
                        '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                        `Kepada Bpk/Ibu ${order.customer_name},\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(monthlyFixedPayment)}\n` +
                        `📅 ${dueDate}\n\n` +
                        `Angsuran ke-${paidMonths + 1}/${totalMonths}\n\n` +
                        'Harap bayar tepat waktu. Terima kasih.\n\n' +
                        `- ${sender}`
                    );
                } else {
                    return (
                        '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                        `Kepada Bpk/Ibu ${order.customer_name},\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(currentMonthlyInterest)}\n` +
                        `📅 ${dueDate}\n\n` +
                        'Harap bayar tepat waktu. Terima kasih.\n\n' +
                        `- ${sender}`
                    );
                }
            } else {
                // 中文
                if (repaymentType === 'fixed') {
                    const monthlyFixedPaymentZh = order.monthly_fixed_payment || 0;
                    const paidMonthsZh = order.fixed_paid_months || 0;
                    const totalMonthsZh = order.repayment_term || '?';
                    return (
                        '🔔 *缴费提醒 - JF!*\n\n' +
                        `尊敬的 ${order.customer_name}，\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(monthlyFixedPaymentZh)}\n` +
                        `📅 ${dueDate}\n\n` +
                        `第${paidMonthsZh + 1}/${totalMonthsZh}期\n\n` +
                        '请按时缴费。感谢信任。\n\n' +
                        `- ${sender}`
                    );
                } else {
                    return (
                        '🔔 *缴费提醒 - JF!*\n\n' +
                        `尊敬的 ${order.customer_name}，\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(currentMonthlyInterest)}\n` +
                        `📅 ${dueDate}\n\n` +
                        '请按时缴费。感谢信任。\n\n' +
                        `- ${sender}`
                    );
                }
            }
        }
    };

    // 挂载到命名空间
    JF.WA = WA;
    // 向下兼容：保留 APP.generateWAText 方法
    if (window.APP) {
        window.APP.generateWAText = WA.generateText;
    } else {
        window.APP = { generateWAText: WA.generateText };
    }

    console.log('✅ JF.WA v2.0 初始化完成');
})();
