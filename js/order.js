// ============================================
// 订单模块 - Supabase 版
// 保留原有接口，内部调用 SupabaseAPI
// ============================================

const Order = {
    // 创建订单
    async create(data) {
        const orderData = {
            customer_name: data.customer.name,
            customer_ktp: data.customer.ktp,
            customer_phone: data.customer.phone,
            customer_address: data.customer.address,
            collateral_name: data.collateral_name,
            loan_amount: data.loan_amount,
            notes: data.notes
        };
        
        const newOrder = await SUPABASE.createOrder(orderData);
        return newOrder;
    },
    
    // 记录管理费支付
    async recordAdminFee(orderId) {
        return await SUPABASE.recordAdminFee(orderId);
    },
    
    // 记录利息支付
    async recordInterestPayment(orderId, monthsPaid) {
        return await SUPABASE.recordInterestPayment(orderId, monthsPaid);
    },
    
    // 记录本金支付
    async recordPrincipalPayment(orderId, amount) {
        return await SUPABASE.recordPrincipalPayment(orderId, amount);
    },
    
    // 获取当前月利息（基于剩余本金）
    getCurrentMonthlyInterest(order) {
        if (!order) return 0;
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        return remainingPrincipal * 0.10;
    },
    
    // 获取支付历史
    async getPaymentHistory(orderId) {
        const { order, payments } = await SUPABASE.getPaymentHistory(orderId);
        return payments;
    },
    
    // 删除订单
    async delete(orderId) {
        return await SUPABASE.deleteOrder(orderId);
    },
    
    // 编辑订单基本信息
    async update(orderId, updates) {
        const order = await SUPABASE.getOrder(orderId);
        
        const updateData = {};
        if (updates.customer) {
            updateData.customer_name = updates.customer.name;
            updateData.customer_ktp = updates.customer.ktp;
            updateData.customer_phone = updates.customer.phone;
            updateData.customer_address = updates.customer.address;
        }
        if (updates.collateral_name) updateData.collateral_name = updates.collateral_name;
        if (updates.notes) updateData.notes = updates.notes;
        
        return await SUPABASE.updateOrder(orderId, updateData);
    },
    
    // 获取财务报表
    async getReport() {
        return await SUPABASE.getReport();
    },
    
    // 解锁订单（管理员）
    async unlockOrder(orderId) {
        return await SUPABASE.unlockOrder(orderId);
    },
    
    // 重新锁定订单
    async relockOrder(orderId) {
        return await SUPABASE.relockOrder(orderId);
    }
};

window.Order = Order;
