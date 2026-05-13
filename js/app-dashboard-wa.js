// app-dashboard-wa.js - v2.0 (JF 命名空间)
// WA 提醒模板模块，挂载到 JF.WAPage

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const WAPage = {
        /**
         * 生成 WhatsApp 提醒消息（纯文本，不转义，用于发送）
         * @param {Object} order - 订单数据
         * @param {string} senderNumber - 发送者门店 WA 号码
         * @returns {string} WA 消息文本（纯文本）
         */
        generateWAText(order, senderNumber) {
            const lang = Utils.lang;
            const monthlyRate = order.agreed_interest_rate || 0.10;
            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const currentMonthlyInterest = remainingPrincipal * monthlyRate;
            const dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            const repaymentType = order.repayment_type || 'flexible';

            // 客户名保持原样，WA 客户端能正确显示
            const customerName = order.customer_name || '';

            if (lang === 'id') {
                if (repaymentType === 'fixed') {
                    const monthlyFixedPayment = order.monthly_fixed_payment || 0;
                    const paidMonths = order.fixed_paid_months || 0;
                    const totalMonths = order.repayment_term || '?';
                    return (
                        '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                        `Kepada Bpk/Ibu ${customerName},\n\n` +
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
                        `Kepada Bpk/Ibu ${customerName},\n\n` +
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
                        `尊敬的 ${customerName}，\n\n` +
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
                        `尊敬的 ${customerName}，\n\n` +
                        `📋 ${order.order_id}\n` +
                        `💰 ${Utils.formatCurrency(currentMonthlyInterest)}\n` +
                        `📅 ${dueDate}\n\n` +
                        '请按时缴费。感谢信任。\n\n' +
                        `- ${senderNumber || 'JF! by Gadai'}`
                    );
                }
            }
        },

        /**
         * 生成安全的 HTML 预览文本（已转义特殊字符，可安全用于 innerHTML）
         * @param {Object} order - 订单数据
         * @param {string} senderNumber - 发送者门店 WA 号码
         * @returns {string} 转义后的安全文本（保留换行符为 <br>）
         */
        generateWASafeHTMLPreview(order, senderNumber) {
            const lang = Utils.lang;
            const monthlyRate = order.agreed_interest_rate || 0.10;
            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const currentMonthlyInterest = remainingPrincipal * monthlyRate;
            const dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            const repaymentType = order.repayment_type || 'flexible';

            // 转义客户名，防止 XSS
            const customerName = Utils.escapeHtml(order.customer_name || '');
            const orderId = Utils.escapeHtml(order.order_id || '');

            if (lang === 'id') {
                if (repaymentType === 'fixed') {
                    const monthlyFixedPayment = Utils.formatCurrency(order.monthly_fixed_payment || 0);
                    const paidMonths = order.fixed_paid_months || 0;
                    const totalMonths = order.repayment_term || '?';
                    return (
                        '🔔 <b>Pengingat Pembayaran - JF!</b><br><br>' +
                        `Kepada Bpk/Ibu ${customerName},<br><br>` +
                        `📋 ${orderId}<br>` +
                        `💰 ${monthlyFixedPayment}<br>` +
                        `📅 ${dueDate}<br><br>` +
                        `Angsuran ke-${paidMonths + 1}/${totalMonths}<br><br>` +
                        'Harap bayar tepat waktu. Terima kasih.<br><br>' +
                        `- ${Utils.escapeHtml(senderNumber || 'JF! by Gadai')}`
                    );
                } else {
                    const interestAmount = Utils.formatCurrency(currentMonthlyInterest);
                    return (
                        '🔔 <b>Pengingat Pembayaran - JF!</b><br><br>' +
                        `Kepada Bpk/Ibu ${customerName},<br><br>` +
                        `📋 ${orderId}<br>` +
                        `💰 ${interestAmount}<br>` +
                        `📅 ${dueDate}<br><br>` +
                        'Harap bayar tepat waktu. Terima kasih.<br><br>' +
                        `- ${Utils.escapeHtml(senderNumber || 'JF! by Gadai')}`
                    );
                }
            } else {
                if (repaymentType === 'fixed') {
                    const monthlyFixedPayment = Utils.formatCurrency(order.monthly_fixed_payment || 0);
                    const paidMonths = order.fixed_paid_months || 0;
                    const totalMonths = order.repayment_term || '?';
                    return (
                        '🔔 <b>缴费提醒 - JF!</b><br><br>' +
                        `尊敬的 ${customerName}，<br><br>` +
                        `📋 ${orderId}<br>` +
                        `💰 ${monthlyFixedPayment}<br>` +
                        `📅 ${dueDate}<br><br>` +
                        `第${paidMonths + 1}/${totalMonths}期<br><br>` +
                        '请按时缴费。感谢信任。<br><br>' +
                        `- ${Utils.escapeHtml(senderNumber || 'JF! by Gadai')}`
                    );
                } else {
                    const interestAmount = Utils.formatCurrency(currentMonthlyInterest);
                    return (
                        '🔔 <b>缴费提醒 - JF!</b><br><br>' +
                        `尊敬的 ${customerName}，<br><br>` +
                        `📋 ${orderId}<br>` +
                        `💰 ${interestAmount}<br>` +
                        `📅 ${dueDate}<br><br>` +
                        '请按时缴费。感谢信任。<br><br>' +
                        `- ${Utils.escapeHtml(senderNumber || 'JF! by Gadai')}`
                    );
                }
            }
        }
    };

    // 挂载到命名空间
    JF.WAPage = WAPage;
    // 向下兼容
    if (window.APP) {
        window.APP.generateWAText = WAPage.generateWAText.bind(WAPage);
        window.APP.generateWASafeHTMLPreview = WAPage.generateWASafeHTMLPreview.bind(WAPage);
    } else {
        window.APP = {
            generateWAText: WAPage.generateWAText.bind(WAPage),
            generateWASafeHTMLPreview: WAPage.generateWASafeHTMLPreview.bind(WAPage)
        };
    }

})();
