const Order = {
    // 创建订单
    create(db, data) {
        const now = new Date();
        const createdDate = now.toISOString().split('T')[0];
        
        // 设置数据库引用供Utils使用
        Utils.setDb(db);
        
        const order = {
            order_id: Utils.generateOrderId(AUTH.user.role),
            
            customer: {
                name: Utils.escapeHtml(data.customer.name),
                ktp: Utils.escapeHtml(data.customer.ktp),
                phone: Utils.escapeHtml(data.customer.phone),
                address: Utils.escapeHtml(data.customer.address)
            },
            
            collateral_name: Utils.escapeHtml(data.collateral_name),
            loan_amount: Number(data.loan_amount),
            
            // 费用结构
            admin_fee: 30000,                    // 管理费 (固定30,000)
            admin_fee_paid: false,               // 管理费是否已支付
            admin_fee_paid_date: null,           // 管理费支付日期
            
            monthly_interest: Number(data.loan_amount) * 0.10,  // 月利息 10%
            interest_paid_months: 0,             // 已支付利息月数
            interest_paid_total: 0,              // 累计支付利息总额
            next_interest_due_date: Utils.calculateNextInterestDueDate(createdDate, 0),  // 下次利息到期日
            
            // 本金相关
            principal_paid: 0,                   // 已还本金
            principal_remaining: Number(data.loan_amount),  // 剩余本金
            
            // 状态: active(进行中), completed(已结清), liquidated(已变卖)
            status: "active",
            
            // 支付记录
            payment_history: [],                  // 每笔支付明细
            
            created_at: createdDate,
            created_by: AUTH.user.username,
            notes: Utils.escapeHtml(data.notes || "")
        };
        
        db.orders.push(order);
        Storage.save(db);
        return order;
    },
    
    // 记录管理费支付 (现金收取)
    recordAdminFee(db, orderId) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order || order.admin_fee_paid) return false;
        
        order.admin_fee_paid = true;
        order.admin_fee_paid_date = new Date().toISOString().split('T')[0];
        
        // 添加支付记录
        order.payment_history.push({
            date: new Date().toISOString().split('T')[0],
            type: "admin_fee",
            amount: order.admin_fee,
            description: "Administrasi Fee / 管理费"
        });
        
        Storage.save(db);
        return true;
    },
    
    // 记录利息支付
    recordInterestPayment(db, orderId, monthsPaid) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        const totalInterest = order.monthly_interest * monthsPaid;
        
        order.interest_paid_months += monthsPaid;
        order.interest_paid_total += totalInterest;
        order.next_interest_due_date = Utils.calculateNextInterestDueDate(order.created_at, order.interest_paid_months);
        
        // 添加支付记录
        order.payment_history.push({
            date: new Date().toISOString().split('T')[0],
            type: "interest",
            months: monthsPaid,
            amount: totalInterest,
            description: `Bunga ${monthsPaid} bulan / ${monthsPaid}个月利息`
        });
        
        Storage.save(db);
        return true;
    },
    
    // 记录本金支付 (结清)
    recordPrincipalPayment(db, orderId, amount) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        const paidAmount = Math.min(amount, order.principal_remaining);
        
        order.principal_paid += paidAmount;
        order.principal_remaining -= paidAmount;
        
        // 添加支付记录
        order.payment_history.push({
            date: new Date().toISOString().split('T')[0],
            type: "principal",
            amount: paidAmount,
            description: paidAmount >= order.loan_amount ? "Pelunasan Pokok / 本金结清" : "Pembayaran Pokok / 本金支付"
        });
        
        // 如果本金全部还清，订单完成
        if (order.principal_remaining <= 0) {
            order.status = "completed";
            order.completed_at = new Date().toISOString().split('T')[0];
        }
        
        Storage.save(db);
        return true;
    },
    
    // 获取支付历史
    getPaymentHistory(db, orderId) {
        const order = db.orders.find(o => o.order_id === orderId);
        return order ? order.payment_history : [];
    },
    
    // 删除订单
    delete(db, orderId) {
        db.orders = db.orders.filter(o => o.order_id !== orderId);
        Storage.save(db);
    },
    
    // 编辑订单基本信息
    update(db, orderId, updates) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        if (updates.customer) {
            order.customer = {...order.customer, ...updates.customer};
            for (let key in order.customer) {
                order.customer[key] = Utils.escapeHtml(order.customer[key]);
            }
        }
        if (updates.collateral_name) order.collateral_name = Utils.escapeHtml(updates.collateral_name);
        if (updates.notes) order.notes = Utils.escapeHtml(updates.notes);
        
        Storage.save(db);
        return true;
    },
    
    // 获取财务报表
    getReport(db) {
        const orders = db.orders;
        const activeOrders = orders.filter(o => o.status === 'active');
        const completedOrders = orders.filter(o => o.status === 'completed');
        
        const totalLoanAmount = orders.reduce((sum, o) => sum + o.loan_amount, 0);
        const totalAdminFeesCollected = orders.reduce((sum, o) => sum + (o.admin_fee_paid ? o.admin_fee : 0), 0);
        const totalInterestCollected = orders.reduce((sum, o) => sum + o.interest_paid_total, 0);
        const totalPrincipalCollected = orders.reduce((sum, o) => sum + o.principal_paid, 0);
        
        return {
            total_orders: orders.length,
            active_orders: activeOrders.length,
            completed_orders: completedOrders.length,
            total_loan_amount: totalLoanAmount,
            total_admin_fees: totalAdminFeesCollected,
            total_interest: totalInterestCollected,
            total_principal: totalPrincipalCollected
        };
    }
};

window.Order = Order;
