// order.js - 完整修复版 v1.0
// 修改内容：
// 1. 新增服务费记录函数 recordServiceFee
// 2. 新增贷款发放记录函数 recordLoanDisbursement
// 3. 移除本金还款的 profit 选项参数
// 4. 利息还款参数调整

const Order = {
    async create(data) {
        const orderData = {
            customer_name: data.customer.name,
            customer_ktp: data.customer.ktp,
            customer_phone: data.customer.phone,
            customer_address: data.customer.address,
            collateral_name: data.collateral_name,
            loan_amount: data.loan_amount,
            admin_fee: data.admin_fee || 30000,
            service_fee_percent: data.service_fee_percent || 0,
            notes: data.notes,
            customer_id: data.customer_id || null
        };
        return await SUPABASE.createOrder(orderData);
    },
    
    // 管理费记录
    async recordAdminFee(orderId, paymentMethod, adminFeeAmount) { 
        return await SUPABASE.recordAdminFee(orderId, paymentMethod, adminFeeAmount); 
    },
    
    // 服务费记录（新增）
    async recordServiceFee(orderId, monthsPaid, paymentMethod) { 
        return await SUPABASE.recordServiceFee(orderId, monthsPaid, paymentMethod); 
    },
    
    // 利息记录
    async recordInterestPayment(orderId, monthsPaid, paymentMethod) { 
        return await SUPABASE.recordInterestPayment(orderId, monthsPaid, paymentMethod); 
    },
    
    // 本金记录（移除 profit 选项）
    async recordPrincipalPayment(orderId, amount, paymentMethod) { 
        return await SUPABASE.recordPrincipalPayment(orderId, amount, paymentMethod); 
    },
    
    // 贷款发放记录（新增）
    async recordLoanDisbursement(orderId, amount, source, description) {
        return await SUPABASE.recordLoanDisbursement(orderId, amount, source, description);
    },
    
    // 获取当前月利息
    getCurrentMonthlyInterest(order) { 
        return (order.loan_amount - order.principal_paid) * 0.10; 
    },
    
    // 获取当前服务费金额
    getCurrentServiceFee(order) {
        return order.service_fee_amount || 0;
    },
    
    // 获取当前服务费百分比
    getServiceFeePercent(order) {
        return order.service_fee_percent || 0;
    },
    
    // 获取缴费历史
    async getPaymentHistory(orderId) { 
        const { payments } = await SUPABASE.getPaymentHistory(orderId); 
        return payments; 
    },
    
    // 删除订单
    async delete(orderId) { 
        return await SUPABASE.deleteOrder(orderId); 
    },
    
    // 更新订单
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
        return await SUPABASE.updateOrder(orderId, updateData, customerId);
    },
    
    // 获取报表
    async getReport() { 
        return await SUPABASE.getReport(); 
    },
    
    // 解锁订单
    async unlockOrder(orderId) { 
        return await SUPABASE.unlockOrder(orderId); 
    },
    
    // 重新锁定订单
    async relockOrder(orderId) { 
        return await SUPABASE.relockOrder(orderId); 
    },
    
    // 获取订单资金流水
    async getOrderCashFlow(orderId) {
        const order = await SUPABASE.getOrder(orderId);
        if (!order) return [];
        return await SUPABASE.getCashFlowRecords(order.store_id);
    }
};

window.Order = Order;
