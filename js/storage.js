const Storage = {
    key: "jf_enterprise_db",
    
    load() {
        let db = JSON.parse(localStorage.getItem(this.key));
        
        if (!db) {
            // 初始化数据库
            db = {
                users: [
                    { username: "admin", password: btoa("admin123"), role: "admin", name: "Administrator" },
                    { username: "staff", password: btoa("staff123"), role: "staff", name: "Staff User" }
                ],
                orders: [],
                settings: {
                    admin_fee: 30000,
                    interest_rate: 0.10
                }
            };
        } else {
            // ========== 数据迁移：为旧订单添加新字段 ==========
            db.orders = db.orders.map(order => {
                // 确保支付历史存在
                if (!order.payment_history) order.payment_history = [];
                
                // 确保管理费字段存在
                if (order.admin_fee === undefined) order.admin_fee = 30000;
                if (order.admin_fee_paid === undefined) order.admin_fee_paid = false;
                if (order.admin_fee_paid_date === undefined) order.admin_fee_paid_date = null;
                
                // 确保利息字段存在
                if (order.monthly_interest === undefined) {
                    order.monthly_interest = order.loan_amount * 0.10;
                }
                if (order.interest_paid_months === undefined) order.interest_paid_months = 0;
                if (order.interest_paid_total === undefined) order.interest_paid_total = 0;
                if (order.next_interest_due_date === undefined) {
                    // 修复：使用正确的函数名
                    if (typeof Utils.calculateNextInterestDueDate === 'function') {
                        order.next_interest_due_date = Utils.calculateNextInterestDueDate(order.created_at, 0);
                    } else {
                        // 备用计算逻辑
                        const date = new Date(order.created_at);
                        date.setMonth(date.getMonth() + 1);
                        order.next_interest_due_date = date.toISOString().split('T')[0];
                    }
                }
                
                // 确保本金字段存在
                if (order.principal_paid === undefined) order.principal_paid = 0;
                if (order.principal_remaining === undefined) order.principal_remaining = order.loan_amount;
                
                // 确保状态正确
                if (!order.status) order.status = "active";
                
                return order;
            });
            
            // 保存迁移后的数据
            this.save(db);
        }
        
        return db;
    },
    
    save(db) {
        localStorage.setItem(this.key, JSON.stringify(db));
    },
    
    backup() {
        const db = this.load();
        if (typeof Utils.exportToJSON === 'function') {
            Utils.exportToJSON(db, `jf_gadai_backup_${new Date().toISOString().split('T')[0]}.json`);
        } else {
            console.error('Utils.exportToJSON not available');
        }
    },
    
    async restore(file) {
        try {
            const data = await Utils.importFromJSON(file);
            if (data.users && data.orders) {
                this.save(data);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Restore failed:', err);
            return false;
        }
    }
};

window.Storage = Storage;
