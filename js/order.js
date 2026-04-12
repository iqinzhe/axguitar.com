const Order = {
    // 创建订单
    create(db, data) {
        const now = new Date();
        const createdDate = now.toISOString().split('T')[0];
        
        const order = {
            order_id: Utils.generateId(),
            
            customer: {
                name: Utils.escapeHtml(data.customer.name),
                ktp: Utils.escapeHtml(data.customer.ktp),
                phone: Utils.escapeHtml(data.customer.phone),
                address: Utils.escapeHtml(data.customer.address)
            },
            
            collateral_name: Utils.escapeHtml(data.collateral_name),
            loan_amount: Number(data.loan_amount),
            
            // 业务字段
            paid_months: 0,
            current_cycle: 1,
            total_paid_fees: 0,
            last_payment_date: null,
            
            status: "active",
            created_at: createdDate,
            created_by: AUTH.user.username,
            
            notes: Utils.escapeHtml(data.notes || "")
        };
        
        // 计算下次缴费日期
        order.next_due_date = Utils.calculateNextDueDate(createdDate, 0);
        
        db.orders.push(order);
        Storage.save(db);
        
        return order;
    },
    
    // 记录支付
    recordPayment(db, orderId, monthsPaid) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        const monthlyAmount = Utils.calculateMonthlyPayment(order.loan_amount);
        const totalAmount = monthlyAmount * monthsPaid;
        
        order.paid_months += monthsPaid;
        order.total_paid_fees += totalAmount;
        order.last_payment_date = new Date().toISOString().split('T')[0];
        
        // 检查是否满10个月
        if (order.paid_months >= 10) {
            // 进入下一个周期或完成
            if (order.status === 'active') {
                order.current_cycle++;
                order.paid_months = order.paid_months - 10;
                
                // 更新下次缴费日期
                order.next_due_date = Utils.calculateNextDueDate(order.created_at, order.paid_months);
            }
        } else {
            // 更新下次缴费日期
            order.next_due_date = Utils.calculateNextDueDate(order.created_at, order.paid_months);
        }
        
        Storage.save(db);
        return true;
    },
    
    // 结清订单（支付本金）
    settleOrder(db, orderId) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        order.status = "completed";
        order.completed_at = new Date().toISOString().split('T')[0];
        
        Storage.save(db);
        return true;
    },
    
    // 变卖质押物
    liquidateOrder(db, orderId) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        order.status = "liquidated";
        order.liquidated_at = new Date().toISOString().split('T')[0];
        
        Storage.save(db);
        return true;
    },
    
    // 删除订单
    delete(db, orderId) {
        db.orders = db.orders.filter(o => o.order_id !== orderId);
        Storage.save(db);
    },
    
    // 编辑订单
    update(db, orderId, updates) {
        const order = db.orders.find(o => o.order_id === orderId);
        if (!order) return false;
        
        if (updates.customer) {
            order.customer = {...order.customer, ...updates.customer};
        }
        if (updates.collateral_name) order.collateral_name = Utils.escapeHtml(updates.collateral_name);
        if (updates.loan_amount) order.loan_amount = Number(updates.loan_amount);
        if (updates.notes) order.notes = Utils.escapeHtml(updates.notes);
        
        Storage.save(db);
        return true;
    },
    
    // 获取财务报表
    getReport(db) {
        const orders = db.orders;
        const activeOrders = orders.filter(o => o.status === 'active');
        const completedOrders = orders.filter(o => o.status === 'completed');
        const liquidatedOrders = orders.filter(o => o.status === 'liquidated');
        
        const totalLoanAmount = orders.reduce((sum, o) => sum + o.loan_amount, 0);
        const totalFeesCollected = orders.reduce((sum, o) => sum + o.total_paid_fees, 0);
        
        return {
            total_orders: orders.length,
            active_orders: activeOrders.length,
            completed_orders: completedOrders.length,
            liquidated_orders: liquidatedOrders.length,
            total_loan_amount: totalLoanAmount,
            total_fees_collected: totalFeesCollected,
            monthly_fee_collection: this.getMonthlyCollection(db)
        };
    },
    
    getMonthlyCollection(db) {
        const monthlyData = {};
        db.orders.forEach(order => {
            if (order.last_payment_date) {
                const month = order.last_payment_date.substring(0, 7);
                if (!monthlyData[month]) monthlyData[month] = 0;
                // 简化：这里应该从支付记录获取，当前使用total_paid_fees估算
            }
        });
        return monthlyData;
    }
};

window.Order = Order;
