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
        generateWAText(order, senderNumber, messageType = 'upcoming') {
            const lang = Utils.lang;
            const monthlyRate = order.agreed_interest_rate || 0.10;
            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const currentMonthlyInterest = Math.round(remainingPrincipal * monthlyRate);
            const dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            const repaymentType = order.repayment_type || 'flexible';
            const customerName = order.customer_name || '';
            const collateral = order.collateral_name || '-';
            const overdueDays = order.overdue_days || 0;
            const isOverdue = messageType === 'overdue' || overdueDays > 0;
            const sender = senderNumber || 'JF! by Gadai';

            if (lang === 'id') {
                const greeting = isOverdue
                    ? `⚠️ *Pemberitahuan Keterlambatan - JF! by Gadai*`
                    : `🔔 *Pengingat Pembayaran - JF! by Gadai*`;

                let amountLine = '';
                let installmentLine = '';
                if (repaymentType === 'fixed') {
                    const amt = order.monthly_fixed_payment || 0;
                    const paid = order.fixed_paid_months || 0;
                    const total = order.repayment_term || '?';
                    amountLine = `💳 Angsuran ke-${paid + 1} dari ${total}: *${Utils.formatCurrency(amt)}*`;
                    installmentLine = `📊 Sisa angsuran: ${Math.max(0, total - paid)} kali`;
                } else {
                    amountLine = `💳 Bunga bulan ini: *${Utils.formatCurrency(currentMonthlyInterest)}*`;
                    installmentLine = `📊 Sisa pokok gadai: ${Utils.formatCurrency(remainingPrincipal)}`;
                }

                const overdueNote = isOverdue
                    ? `\n⚠️ *Terlambat ${overdueDays} hari* — mohon segera lakukan pembayaran untuk menghindari denda tambahan.`
                    : `\n✅ Jatuh tempo: *${dueDate}* (2 hari lagi)\nMohon lakukan pembayaran sebelum jatuh tempo.`;

                return (
                    `${greeting}\n\n` +
                    `Yth. Bpk/Ibu *${customerName}*,\n\n` +
                    `📋 No. Pesanan : *${order.order_id}*\n` +
                    `🏷️ Barang Jaminan: *${collateral}*\n` +
                    `${amountLine}\n` +
                    `${installmentLine}\n` +
                    `📅 Tgl. Jatuh Tempo: *${dueDate}*\n` +
                    `${overdueNote}\n\n` +
                    `Untuk konfirmasi atau pertanyaan, silakan hubungi kami.\n` +
                    `Terima kasih atas kepercayaan Anda 🙏\n\n` +
                    `— *${sender}*`
                );
            } else {
                const greeting = isOverdue
                    ? `⚠️ *还款逾期通知 - JF! by Gadai*`
                    : `🔔 *还款到期提醒 - JF! by Gadai*`;

                let amountLine = '';
                let installmentLine = '';
                if (repaymentType === 'fixed') {
                    const amt = order.monthly_fixed_payment || 0;
                    const paid = order.fixed_paid_months || 0;
                    const total = order.repayment_term || '?';
                    amountLine = `💳 第 ${paid + 1}/${total} 次还款金额：*${Utils.formatCurrency(amt)}*`;
                    installmentLine = `📊 剩余还款次数：${Math.max(0, total - paid)} 次`;
                } else {
                    amountLine = `💳 本月利息金额：*${Utils.formatCurrency(currentMonthlyInterest)}*`;
                    installmentLine = `📊 当前未还本金：${Utils.formatCurrency(remainingPrincipal)}`;
                }

                const overdueNote = isOverdue
                    ? `\n⚠️ *已逾期 ${overdueDays} 天*，请尽快完成还款，以避免产生额外费用。`
                    : `\n✅ 还款日期：*${dueDate}*（距今还有 2 天）\n请在到期前完成还款，避免逾期。`;

                return (
                    `${greeting}\n\n` +
                    `尊敬的 *${customerName}* 您好，\n\n` +
                    `📋 订单编号：*${order.order_id}*\n` +
                    `🏷️ 质押物品：*${collateral}*\n` +
                    `${amountLine}\n` +
                    `${installmentLine}\n` +
                    `📅 还款日期：*${dueDate}*\n` +
                    `${overdueNote}\n\n` +
                    `如有疑问请随时联系我们，感谢您的信任 🙏\n\n` +
                    `— *${sender}*`
                );
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
