const Storage = {
    key: "jf_enterprise_db",
    
    async load() {
        return { users: [], orders: [], settings: { admin_fee: 30000, interest_rate: 0.10 } };
    },
    
    save(db) { console.log('Storage.save - data in Supabase'); },
    
    async backup() {
        const orders = await SUPABASE.getOrders();
        const stores = await SUPABASE.getAllStores();
        const backupData = { version: '2.0', exported_at: new Date().toISOString(), stores, orders };
        Utils.exportToJSON(backupData, `jf_gadai_backup_${new Date().toISOString().split('T')[0]}.json`);
    },
    
    async restore(file) {
        try {
            const data = await Utils.importFromJSON(file);
            if (data.orders && data.stores) return true;
            return false;
        } catch (err) { return false; }
    },
    
    async exportOrdersToCSV() {
        const orders = await SUPABASE.getOrders();
        Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
    },
    
    async exportPaymentsToCSV() {
        const payments = await SUPABASE.getAllPayments();
        const headers = ['订单ID', '客户', '日期', '类型', '月数', '金额', '说明'];
        const rows = payments.map(p => [p.orders.order_id, p.orders.customer_name, p.date, p.type === 'admin_fee' ? '管理费' : (p.type === 'interest' ? '利息' : '本金'), p.months || '-', SUPABASE.formatCurrency(p.amount), p.description || '-']);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

window.Storage = Storage;
