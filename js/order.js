const Order = {
    async create(data) {
        const orderData = {
            customer_name: data.customer.name,
            customer_ktp: data.customer.ktp,
            customer_phone: data.customer.phone,
            customer_address: data.customer.address,
            collateral_name: data.collateral_name,
            loan_amount: data.loan_amount,
            notes: data.notes,
            customer_id: data.customer_id || null
        };
        return await SUPABASE.createOrder(orderData);
    },
    async recordAdminFee(orderId) { return await SUPABASE.recordAdminFee(orderId); },
    async recordInterestPayment(orderId, monthsPaid) { return await SUPABASE.recordInterestPayment(orderId, monthsPaid); },
    async recordPrincipalPayment(orderId, amount) { return await SUPABASE.recordPrincipalPayment(orderId, amount); },
    getCurrentMonthlyInterest(order) { return (order.loan_amount - order.principal_paid) * 0.10; },
    async getPaymentHistory(orderId) { const { payments } = await SUPABASE.getPaymentHistory(orderId); return payments; },

    // FIX: delete 增加权限验证（在 supabase.js 层面已做，这里保持一致）
    async delete(orderId) { return await SUPABASE.deleteOrder(orderId); },

    // FIX: update 传递 customerId 以同步 customers 表
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
        return await SUPABASE.updateOrder(orderId, updateData, customerId);
    },

    async getReport() { return await SUPABASE.getReport(); },
    async unlockOrder(orderId) { return await SUPABASE.unlockOrder(orderId); },
    async relockOrder(orderId) { return await SUPABASE.relockOrder(orderId); }
};
window.Order = Order;
