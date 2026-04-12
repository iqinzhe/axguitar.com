const Storage = {
    key: "jf_enterprise_db",
    
    load() {
        let db = JSON.parse(localStorage.getItem(this.key));
        
        if (!db) {
            // 初始化数据库
            db = {
                users: [
                    { 
                        username: "admin", 
                        password: btoa("admin123"), // 编码存储
                        role: "admin",
                        name: "Administrator"
                    },
                    { 
                        username: "staff", 
                        password: btoa("staff123"),
                        role: "staff",
                        name: "Staff User"
                    }
                ],
                orders: [],
                settings: {
                    monthly_fee_rate: 0.10,    // 10%
                    monthly_admin_fee: 30000,   // 30,000 IDR
                    cycle_months: 10            // 10个月周期
                }
            };
            this.save(db);
        } else {
            // 迁移旧数据：为旧订单添加新字段
            db.orders = db.orders.map(order => {
                if (!order.paid_months) {
                    order.paid_months = 0;
                    order.current_cycle = 1;
                    order.total_paid_fees = 0;
                    order.last_payment_date = null;
                    order.next_due_date = Utils.calculateNextDueDate(order.created_at, 0);
                }
                return order;
            });
            this.save(db);
        }
        
        return db;
    },
    
    save(db) {
        localStorage.setItem(this.key, JSON.stringify(db));
    },
    
    // 备份数据
    backup() {
        const db = this.load();
        Utils.exportToJSON(db, `jf_gadai_backup_${new Date().toISOString().split('T')[0]}.json`);
    },
    
    // 恢复数据
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
