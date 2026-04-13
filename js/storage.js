// ✅ 修复：清除废弃的 load() / save() 空壳方法
// 系统已全面迁移至 Supabase，本地存储只用于迁移来源读取（由 migration.js 负责）
const Storage = {

    async backup() {
        try {
            const orders = await SUPABASE.getOrders();
            const stores = await SUPABASE.getAllStores();
            const backupData = {
                version: '2.0',
                exported_at: new Date().toISOString(),
                stores,
                orders
            };
            Utils.exportToJSON(backupData, `jf_gadai_backup_${new Date().toISOString().split('T')[0]}.json`);
            alert(Utils.t('backup_downloaded'));
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal backup: ' + err.message : '备份失败：' + err.message);
        }
    },

    async restore(file) {
        try {
            const data = await Utils.importFromJSON(file);
            if (data.orders && data.stores) return true;
            return false;
        } catch (err) {
            return false;
        }
    },

    async exportOrdersToCSV() {
        try {
            const orders = await SUPABASE.getOrders();
            Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    },

    async exportPaymentsToCSV() {
        try {
            const payments = await SUPABASE.getAllPayments();
            const lang = Utils.lang;
            const headers = lang === 'id'
                ? ['ID Pesanan', 'Pelanggan', 'Tanggal', 'Jenis', 'Bulan', 'Jumlah', 'Keterangan']
                : ['订单ID', '客户', '日期', '类型', '月数', '金额', '说明'];
            const rows = payments.map(p => [
                p.orders.order_id,
                p.orders.customer_name,
                p.date,
                p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费')
                    : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息')
                    : (lang === 'id' ? 'Pokok' : '本金'),
                p.months || '-',
                Utils.formatCurrency(p.amount),
                p.description || '-'
            ]);
            const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    }
};

window.Storage = Storage;
