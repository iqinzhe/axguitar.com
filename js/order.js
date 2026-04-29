// order.js - v1.0

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
            admin_fee: data.admin_fee || Utils.calculateAdminFee(data.loan_amount),
            service_fee_percent: data.service_fee_percent !== undefined ? data.service_fee_percent : 2,
            service_fee_amount: data.service_fee_amount || 0,
            notes: data.notes,
            customer_id: data.customer_id || null,
            agreed_interest_rate: data.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT,
            repayment_type: data.repayment_type || 'flexible',
            repayment_term: data.repayment_term || null,
            monthly_fixed_payment: data.monthly_fixed_payment || null,
            max_extension_months: data.max_extension_months || 10
        };
        
        try {
            return await SUPABASE.createOrder(orderData);
        } catch (error) {
            console.error("Order.create error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal membuat pesanan: ' + error.message : '创建订单失败：' + error.message);
            throw error;
        }
    },
    
    // ==================== 管理费记录 ====================
    async recordAdminFee(orderId, paymentMethod, adminFeeAmount) { 
        try {
            return await SUPABASE.recordAdminFee(orderId, paymentMethod, adminFeeAmount);
        } catch (error) {
            console.error("recordAdminFee error:", error);
            Utils.toast.warning(Utils.lang === 'id' ? 'Gagal mencatat biaya admin' : '管理费记录失败');
            throw error;
        }
    },
    
    // ==================== 服务费记录 ====================
    async recordServiceFee(orderId, monthsPaid, paymentMethod) { 
        try {
            return await SUPABASE.recordServiceFee(orderId, monthsPaid, paymentMethod);
        } catch (error) {
            console.error("recordServiceFee error:", error);
            Utils.toast.warning(Utils.lang === 'id' ? 'Gagal mencatat biaya layanan' : '服务费记录失败');
            throw error;
        }
    },
    
    // ==================== 利息记录（灵活还款） ====================
    async recordInterestPayment(orderId, monthsPaid, paymentMethod) { 
        try {
            return await SUPABASE.recordInterestPayment(orderId, monthsPaid, paymentMethod);
        } catch (error) {
            console.error("recordInterestPayment error:", error);
            Utils.toast.warning(Utils.lang === 'id' ? 'Gagal mencatat pembayaran bunga' : '利息记录失败');
            throw error;
        }
    },
    
    // ==================== 本金记录（灵活还款） ====================
    async recordPrincipalPayment(orderId, amount, paymentMethod) { 
        try {
            return await SUPABASE.recordPrincipalPayment(orderId, amount, paymentMethod);
        } catch (error) {
            console.error("recordPrincipalPayment error:", error);
            Utils.toast.warning(Utils.lang === 'id' ? 'Gagal mencatat pembayaran pokok' : '本金记录失败');
            throw error;
        }
    },
    
    // ==================== 贷款发放记录 ====================
    async recordLoanDisbursement(orderId, amount, source, description) {
        try {
            return await SUPABASE.recordLoanDisbursement(orderId, amount, source, description);
        } catch (error) {
            console.error("recordLoanDisbursement error:", error);
            if (error.message === Utils.t('loan_already_disbursed')) {
                Utils.toast.warning(error.message);
            } else {
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mencatat pencairan pinjaman' : '贷款发放记录失败');
            }
            throw error;
        }
    },
    
    // ==================== 固定还款 - 按期还款 ====================
    async recordFixedPayment(orderId, paymentMethod) {
        try {
            return await SUPABASE.recordFixedPayment(orderId, paymentMethod);
        } catch (error) {
            console.error("recordFixedPayment error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal memproses pembayaran cicilan tetap' : '固定还款处理失败');
            throw error;
        }
    },
    
    // ==================== 固定还款 - 提前结清 ====================
    async earlySettleFixedOrder(orderId, paymentMethod) {
        try {
            return await SUPABASE.earlySettleFixedOrder(orderId, paymentMethod);
        } catch (error) {
            console.error("earlySettleFixedOrder error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal memproses pelunasan dipercepat' : '提前结清处理失败');
            throw error;
        }
    },
    
    // ==================== 获取当前月利息（灵活还款用） ====================
    getCurrentMonthlyInterest(order) {
        const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
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
        return order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
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
        try {
            const { payments } = await SUPABASE.getPaymentHistory(orderId); 
            return payments;
        } catch (error) {
            console.error("getPaymentHistory error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
            throw error;
        }
    },
    
    // ==================== 删除订单 ====================
    async delete(orderId) { 
        try {
            return await SUPABASE.deleteOrder(orderId);
        } catch (error) {
            console.error("deleteOrder error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal menghapus pesanan' : '删除订单失败');
            throw error;
        }
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
        
        try {
            return await SUPABASE.updateOrder(orderId, updateData, customerId);
        } catch (error) {
            console.error("updateOrder error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengupdate pesanan' : '更新订单失败');
            throw error;
        }
    },
    
    // ==================== 获取报表 ====================
    async getReport() { 
        try {
            return await SUPABASE.getReport();
        } catch (error) {
            console.error("getReport error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报表失败');
            throw error;
        }
    },
    
    // ==================== 解锁订单 ====================
    async unlockOrder(orderId) { 
        try {
            return await SUPABASE.unlockOrder(orderId);
        } catch (error) {
            console.error("unlockOrder error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal membuka kunci pesanan' : '解锁订单失败');
            throw error;
        }
    },
    
    // ==================== 重新锁定订单 ====================
    async relockOrder(orderId) { 
        try {
            return await SUPABASE.relockOrder(orderId);
        } catch (error) {
            console.error("relockOrder error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengunci pesanan' : '锁定订单失败');
            throw error;
        }
    },
    
    // ==================== 获取订单资金流水 ====================
    async getOrderCashFlow(orderId) {
        try {
            const order = await SUPABASE.getOrder(orderId);
            if (!order) return [];
            return await SUPABASE.getCashFlowRecords(order.store_id);
        } catch (error) {
            console.error("getOrderCashFlow error:", error);
            return [];
        }
    },
    
    // ==================== 更新逾期天数 ====================
    async updateOverdueDays() {
        try {
            return await SUPABASE.updateOverdueDays();
        } catch (error) {
            console.error("updateOverdueDays error:", error);
            return false;
        }
    },
    
    // ==================== 获取订单详情（带权限检查） ====================
    async getOrder(orderId) {
        try {
            return await SUPABASE.getOrder(orderId);
        } catch (error) {
            console.error("getOrder error:", error);
            if (error.message !== Utils.t('unauthorized')) {
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            }
            throw error;
        }
    },
    
    // ==================== 获取所有订单 ====================
    async getOrders(filters) {
        try {
            return await SUPABASE.getOrders(filters);
        } catch (error) {
            console.error("getOrders error:", error);
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
            throw error;
        }
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
