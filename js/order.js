// order.js - v1.2（修复：确保与 supabase.js 方法一致，添加缺失的导出）

const Order = {
    // ==================== 创建订单 ====================
    async create(data) {
        const orderData = {
            customer_name: data.customer.name,
            customer_ktp: data.customer.ktp,
            customer_phone: data.customer.phone,
            customer_address: data.customer.address,
            collateral_name: data.collateral_name,
            loan_amount: data.loan_amount,
            admin_fee: data.admin_fee || 30000,
            service_fee_percent: data.service_fee_percent !== undefined ? data.service_fee_percent : 2,
            notes: data.notes,
            customer_id: data.customer_id || null,
            agreed_interest_rate: data.agreed_interest_rate || 8,
            repayment_type: data.repayment_type || 'flexible',
            repayment_term: data.repayment_term || null
        };
        return await SUPABASE.createOrder(orderData);
    },
    
    // ==================== 管理费记录 ====================
    async recordAdminFee(orderId, paymentMethod, adminFeeAmount) { 
        return await SUPABASE.recordAdminFee(orderId, paymentMethod, adminFeeAmount); 
    },
    
    // ==================== 服务费记录 ====================
    async recordServiceFee(orderId, monthsPaid, paymentMethod) { 
        return await SUPABASE.recordServiceFee(orderId, monthsPaid, paymentMethod); 
    },
    
    // ==================== 利息记录（灵活还款） ====================
    async recordInterestPayment(orderId, monthsPaid, paymentMethod) { 
        return await SUPABASE.recordInterestPayment(orderId, monthsPaid, paymentMethod); 
    },
    
    // ==================== 本金记录（灵活还款） ====================
    async recordPrincipalPayment(orderId, amount, paymentMethod) { 
        return await SUPABASE.recordPrincipalPayment(orderId, amount, paymentMethod); 
    },
    
    // ==================== 贷款发放记录 ====================
    async recordLoanDisbursement(orderId, amount, source, description) {
        return await SUPABASE.recordLoanDisbursement(orderId, amount, source, description);
    },
    
    // ==================== 固定还款 - 按期还款 ====================
    async recordFixedPayment(orderId, paymentMethod) {
        return await SUPABASE.recordFixedPayment(orderId, paymentMethod);
    },
    
    // ==================== 固定还款 - 提前结清 ====================
    async earlySettleFixedOrder(orderId, paymentMethod) {
        return await SUPABASE.earlySettleFixedOrder(orderId, paymentMethod);
    },
    
    // ==================== 获取当前月利息（灵活还款用） ====================
    getCurrentMonthlyInterest(order) {
        const monthlyRate = order.agreed_interest_rate || 0.08;
        return (order.loan_amount - order.principal_paid) * monthlyRate;
    },
    
    // ==================== 获取固定还款每月金额 ====================
    getMonthlyFixedPayment(order) {
        if (order.repayment_type === 'fixed' && order.monthly_fixed_payment) {
            return order.monthly_fixed_payment;
        }
        return 0;
    },
    
    // ==================== 获取固定还款进度 ====================
    getFixedRepaymentProgress(order) {
        if (order.repayment_type !== 'fixed') return null;
        const paidMonths = order.fixed_paid_months || 0;
        const totalMonths = order.repayment_term || 0;
        return {
            paidMonths: paidMonths,
            totalMonths: totalMonths,
            remainingMonths: totalMonths - paidMonths,
            percentage: totalMonths > 0 ? (paidMonths / totalMonths) * 100 : 0
        };
    },
    
    // ==================== 获取当前服务费金额 ====================
    getCurrentServiceFee(order) {
        return order.service_fee_amount || 0;
    },
    
    // ==================== 获取当前服务费百分比 ====================
    getServiceFeePercent(order) {
        return order.service_fee_percent || 0;
    },
    
    // ==================== 获取协商利率 ====================
    getAgreedInterestRate(order) {
        return order.agreed_interest_rate || 0.08;
    },
    
    // ==================== 获取还款方式 ====================
    getRepaymentType(order) {
        return order.repayment_type || 'flexible';
    },
    
    // ==================== 是否为固定还款 ====================
    isFixedRepayment(order) {
        return order.repayment_type === 'fixed';
    },
    
    // ==================== 获取缴费历史 ====================
    async getPaymentHistory(orderId) { 
        const { payments } = await SUPABASE.getPaymentHistory(orderId); 
        return payments; 
    },
    
    // ==================== 删除订单 ====================
    async delete(orderId) { 
        return await SUPABASE.deleteOrder(orderId); 
    },
    
    // ==================== 更新订单 ====================
    async update(orderId, updates, customerId) {
        const updateData = {};
        if (updates.customer) {
            updateData.customer_name = updates.customer.name;
            updateData.customer_ktp = updates.customer.ktp;
            updateData.customer_phone = updates.customer.phone;
            updateData.customer_address = updates.customer.address;
        }
        if (updates.collateral_name) updateData.collateral_name = updates.collateral_name;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.service_fee_percent !== undefined) updateData.service_fee_percent = updates.service_fee_percent;
        if (updates.agreed_interest_rate !== undefined) updateData.agreed_interest_rate = updates.agreed_interest_rate;
        if (updates.repayment_type !== undefined) updateData.repayment_type = updates.repayment_type;
        if (updates.repayment_term !== undefined) updateData.repayment_term = updates.repayment_term;
        return await SUPABASE.updateOrder(orderId, updateData, customerId);
    },
    
    // ==================== 获取报表 ====================
    async getReport() { 
        return await SUPABASE.getReport(); 
    },
    
    // ==================== 解锁订单 ====================
    async unlockOrder(orderId) { 
        return await SUPABASE.unlockOrder(orderId); 
    },
    
    // ==================== 重新锁定订单 ====================
    async relockOrder(orderId) { 
        return await SUPABASE.relockOrder(orderId); 
    },
    
    // ==================== 获取订单资金流水 ====================
    async getOrderCashFlow(orderId) {
        const order = await SUPABASE.getOrder(orderId);
        if (!order) return [];
        return await SUPABASE.getCashFlowRecords(order.store_id);
    },
    
    // ==================== 更新逾期天数 ====================
    async updateOverdueDays() {
        return await SUPABASE.updateOverdueDays();
    },
    
    // ==================== 获取订单详情（带权限检查） ====================
    async getOrder(orderId) {
        return await SUPABASE.getOrder(orderId);
    },
    
    // ==================== 获取所有订单 ====================
    async getOrders(filters) {
        return await SUPABASE.getOrders(filters);
    },
    
    // ==================== 计算固定还款每月金额（工具方法） ====================
    calculateFixedMonthlyPayment(loanAmount, monthlyRate, months) {
        return Utils.calculateFixedMonthlyPayment(loanAmount, monthlyRate, months);
    },
    
    // ==================== 计算下一个到期日 ====================
    calculateNextDueDate(startDate, paidMonths) {
        return SUPABASE.calculateNextDueDate(startDate, paidMonths);
    }
};

window.Order = Order;
