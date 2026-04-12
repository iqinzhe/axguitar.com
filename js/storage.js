// ============================================
// 存储模块 - 云端版（保留接口兼容性）
// 实际数据全部从 Supabase 读取
// ============================================

const Storage = {
    // 保留 key 用于兼容
    key: "jf_enterprise_db",
    
    // 加载数据（从云端）
    async load() {
        // 不再从 localStorage 加载
        // 数据直接从 Supabase 查询
        // 返回一个兼容旧代码的结构
        return {
            users: [],  // 不再使用本地 users
            orders: [], // 不再使用本地 orders
            settings: {
                admin_fee: 30000,
                interest_rate: 0.10
            }
        };
    },
    
    // 保存数据（云端版 - 空操作）
    save(db) {
        // 不再保存到 localStorage
        // 所有修改直接通过 Supabase API
        console.log('Storage.save called - data already in Supabase');
    },
    
    // 备份（导出为 JSON）
    async backup() {
        const orders = await SUPABASE.getOrders();
        const stores = await SUPABASE.getAllStores();
        const users = await SUPABASE.getAllUsers();
        
        const backupData = {
            version: '2.0',
            exported_at: new Date().toISOString(),
            stores: stores,
            users: users,
            orders: orders
        };
        
        Utils.exportToJSON(backupData, `jf_gadai_backup_${new Date().toISOString().split('T')[0]}.json`);
        return true;
    },
    
    // 恢复（从 JSON 导入）
    async restore(file) {
        try {
            const data = await Utils.importFromJSON(file);
            if (data.orders && data.stores) {
                // 恢复门店
                for (const store of data.stores) {
                    try {
                        await SUPABASE.createStore(store.code, store.name, store.address, store.phone);
                    } catch(e) {
                        console.log('Store already exists or error:', e);
                    }
                }
                
                // 恢复订单（需要重新关联门店）
                for (const order of data.orders) {
                    // 查找门店ID
                    const stores = await SUPABASE.getAllStores();
                    const store = stores.find(s => s.name === order.store_name);
                    if (store) {
                        // 创建订单的逻辑需要适配
                        console.log('Restoring order:', order.order_id);
                    }
                }
                return true;
            }
            return false;
        } catch (err) {
            console.error('Restore failed:', err);
            return false;
        }
    },
    
    // 导出订单 CSV
    async exportOrdersToCSV() {
        const orders = await SUPABASE.getOrders();
        Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
    },
    
    // 导出支付记录 CSV
    async exportPaymentsToCSV() {
        const payments = await SUPABASE.getAllPayments();
        const headers = ['订单ID', '客户', '日期', '类型', '月数', '金额', '说明'];
        const rows = payments.map(p => [
            p.orders.order_id,
            p.orders.customer_name,
            p.date,
            p.type === 'admin_fee' ? '管理费' : (p.type === 'interest' ? '利息' : '本金'),
            p.months || '-',
            SUPABASE.formatCurrency(p.amount),
            p.description || '-'
        ]);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.Storage = Storage;
