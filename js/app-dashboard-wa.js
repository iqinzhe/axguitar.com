// app-dashboard-wa.js - v1.0
window.APP = window.APP || {};

// ========== WA 提醒模板（精简版：3个核心信息） ==========
window.APP.generateWAText = function(order, senderNumber) {
    var lang = Utils.lang;
    
    // 使用订单自己的利率
    var monthlyRate = order.agreed_interest_rate || 0.08;
    var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
    var currentMonthlyInterest = remainingPrincipal * monthlyRate;
    var dueDate = order.next_interest_due_date 
        ? Utils.formatDate(order.next_interest_due_date) 
        : '-';
    
    // 获取还款类型
    var repaymentType = order.repayment_type || 'flexible';
    
    if (lang === 'id') {
        // ========== 印尼语 - 精简版 ==========
        
        if (repaymentType === 'fixed') {
            var monthlyFixedPayment = order.monthly_fixed_payment || 0;
            var paidMonths = order.fixed_paid_months || 0;
            var totalMonths = order.repayment_term || '?';
            
            return '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                'Kepada Bpk/Ibu ' + order.customer_name + ',\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(monthlyFixedPayment) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                'Angsuran ke-' + (paidMonths + 1) + '/' + totalMonths + '\n\n' +
                'Harap bayar tepat waktu. Terima kasih.\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        } else {
            // 灵活还款
            return '🔔 *Pengingat Pembayaran - JF!*\n\n' +
                'Kepada Bpk/Ibu ' + order.customer_name + ',\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(currentMonthlyInterest) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                'Harap bayar tepat waktu. Terima kasih.\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        }
        
    } else {
        // ========== 中文 - 精简版 ==========
        
        if (repaymentType === 'fixed') {
            var monthlyFixedPaymentZh = order.monthly_fixed_payment || 0;
            var paidMonthsZh = order.fixed_paid_months || 0;
            var totalMonthsZh = order.repayment_term || '?';
            
            return '🔔 *缴费提醒 - JF!*\n\n' +
                '尊敬的 ' + order.customer_name + '，\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(monthlyFixedPaymentZh) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                '第' + (paidMonthsZh + 1) + '/' + totalMonthsZh + '期\n\n' +
                '请按时缴费。感谢信任。\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        } else {
            // 灵活还款
            return '🔔 *缴费提醒 - JF!*\n\n' +
                '尊敬的 ' + order.customer_name + '，\n\n' +
                '📋 ' + order.order_id + '\n' +
                '💰 ' + Utils.formatCurrency(currentMonthlyInterest) + '\n' +
                '📅 ' + dueDate + '\n\n' +
                '请按时缴费。感谢信任。\n\n' +
                '- ' + (senderNumber || 'JF! by Gadai');
        }
    }
};
