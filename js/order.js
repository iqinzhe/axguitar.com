// order.js - 典当订单核心逻辑（支持三资金池）
// 修改：记录管理费/利息时自动入账门店净利，记录本金时根据目标入账不同资金池

const Order = {
    async create(data) {
        // data 中应包含 loan_source: 'cash', 'bank', 'profit'
        const orderData = {
            customer_name: data.customer.name,
            customer_ktp: data.customer.ktp,
            customer_phone: data.customer.phone,
            customer_address: data.customer.address,
            collateral_name: data.collateral_name,
            loan_amount: data.loan_amount,
            admin_fee: data.admin_fee || 30000,
            notes: data.notes,
            customer_id: data.customer_id || null,
            loan_source: data.loan_source || 'bank'  // 新增：资金来源
        };
        return await SUPABASE.createOrder(orderData);
    },
    
    // 管理费：直接入账门店净利
    async recordAdminFee(orderId, paymentMethod, adminFeeAmount) { 
        return await SUPABASE.recordAdminFee(orderId, paymentMethod, adminFeeAmount); 
    },
    
    // 利息：直接入账门店净利
    async recordInterestPayment(orderId, monthsPaid, paymentMethod) { 
        return await SUPABASE.recordInterestPayment(orderId, monthsPaid, paymentMethod); 
    },
    
    // 本金：根据目标返还到不同资金池（bank/cash/profit）
    async recordPrincipalPayment(orderId, amount, paymentMethod, target) { 
        return await SUPABASE.recordPrincipalPayment(orderId, amount, paymentMethod, target); 
    },
    
    getCurrentMonthlyInterest(order) { 
        return (order.loan_amount - order.principal_paid) * 0.10; 
    },
    
    async getPaymentHistory(orderId) { 
        const { payments } = await SUPABASE.getPaymentHistory(orderId); 
        return payments; 
    },
    
    async delete(orderId) { 
        return await SUPABASE.deleteOrder(orderId); 
    },
    
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
    
    async getReport() { 
        return await SUPABASE.getReport(); 
    },
    
    async unlockOrder(orderId) { 
        return await SUPABASE.unlockOrder(orderId); 
    },
    
    async relockOrder(orderId) { 
        return await SUPABASE.relockOrder(orderId); 
    }
};

window.Order = Order;
