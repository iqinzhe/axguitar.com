// app-dashboard-wa.js - v2.0 (JF 命名空间)
// WA 提醒模板模块，挂载到 JF.WAPage

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const WAPage = {
        /**
         * 生成 WhatsApp 提醒消息（精简版：3 个核心信息）
         * @param {Object} order - 订单数据
         * @param {string} senderNumber - 发送者门店 WA 号码
         * @returns {string} 编码后的 WA 消息文本
         */
        generateWAText(order, senderNumber) {
            const lang = Utils.lang;
            const monthlyRate = order.agreed_interest_rate || 0.10;
            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const currentMonthlyInterest = remainingPrincipal * monthlyRate;
            const dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            const repaymentType = order.repayment_type || 'flexible';

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
                        `- ${senderNumber || 'JF! by Gadai'}`
                    );
                } else {
                    return (
                        '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                        `Kepada Bpk/Ibu ${order.customer_name},\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(currentMonthlyInterest)}\n` +
                        `📅 ${dueDate}\n\n` +
                        'Harap bayar tepat waktu. Terima kasih.\n\n' +
                        `- ${senderNumber || 'JF! by Gadai'}`
                    );
                }
            } else {
                if (repaymentType === 'fixed') {
                    const monthlyFixedPayment = order.monthly_fixed_payment || 0;
                    const paidMonths = order.fixed_paid_months || 0;
                    const totalMonths = order.repayment_term || '?';
                    return (
                        '🔔 *缴费提醒 - JF!*\n\n' +
                        `尊敬的 ${order.customer_name}，\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(monthlyFixedPayment)}\n` +
                        `📅 ${dueDate}\n\n` +
                        `第${paidMonths + 1}/${totalMonths}期\n\n` +
                        '请按时缴费。感谢信任。\n\n' +
                        `- ${senderNumber || 'JF! by Gadai'}`
                    );
                } else {
                    return (
                        '🔔 *缴费提醒 - JF!*\n\n' +
                        `尊敬的 ${order.customer_name}，\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(currentMonthlyInterest)}\n` +
                        `📅 ${dueDate}\n\n` +
                        '请按时缴费。感谢信任。\n\n' +
                        `- ${senderNumber || 'JF! by Gadai'}`
                    );
                }
            }
        }
    };

    // 挂载到命名空间
    JF.WAPage = WAPage;
    // 向下兼容：保持原有的 APP.generateWAText 函数
    if (window.APP) {
        window.APP.generateWAText = WAPage.generateWAText.bind(WAPage);
    } else {
        window.APP = { generateWAText: WAPage.generateWAText.bind(WAPage) };
    }

    console.log('✅ JF.WAPage v2.0 初始化完成');
})();
