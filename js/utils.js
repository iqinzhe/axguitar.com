const Utils = {
    lang: localStorage.getItem('jf_language') || 'id',
    db: null,  // 需要引用数据库来获取当天订单数
    
    // 设置数据库引用
    setDb(db) {
        this.db = db;
    },
    
    // 生成订单ID (格式: AD-2604-01 或 ST-2604-01)
    generateOrderId(role) {
        const prefix = role === 'admin' ? 'AD' : 'ST';
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const datePrefix = yy + mm;
        
        // 获取本月同类型订单数量
        const monthOrders = this.db.orders.filter(o => 
            o.order_id.startsWith(`${prefix}-${datePrefix}`)
        );
        const seq = String(monthOrders.length + 1).padStart(2, '0');
        
        return `${prefix}-${datePrefix}-${seq}`;
    },
    
    // 计算月利息 (贷款金额 × 10%)
    calculateMonthlyInterest(loanAmount) {
        return loanAmount * 0.10;
    },
    
    // 计算下一个利息支付日期 (每月固定日，默认使用贷款发放日)
    calculateNextInterestDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },
    
    // 翻译字典 (保持不变，省略...)
    translations: {
        id: { /* 同上 */ },
        zh: { /* 同上 */ }
    },
    
    t(key) { return this.translations[this.lang][key] || key; },
    setLanguage(lang) { this.lang = lang; localStorage.setItem('jf_language', lang); },
    getLanguage() { return this.lang; },
    escapeHtml(str) { if (!str) return ''; return String(str).replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); },
    formatCurrency(amount) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount); },
    formatDate(dateStr) { if (!dateStr) return '-'; const date = new Date(dateStr); return date.toLocaleDateString(this.lang === 'id' ? 'id-ID' : 'zh-CN'); },
    exportToJSON(data, filename) { const jsonStr = JSON.stringify(data, null, 2); const blob = new Blob([jsonStr], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); },
    
    exportToCSV(orders, filename) {
        const headers = this.lang === 'id' ? 
            ['ID Pesanan', 'Pelanggan', 'Pinjaman', 'Admin Fee', 'Bunga Bulanan', 'Status', 'Tanggal Dibuat'] :
            ['订单ID', '客户', '贷款金额', '管理费', '月利息', '状态', '创建日期'];
        const rows = orders.map(o => [o.order_id, o.customer.name, this.formatCurrency(o.loan_amount), this.formatCurrency(o.admin_fee), this.formatCurrency(o.monthly_interest), o.status, this.formatDate(o.created_at)]);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    },
    
    importFromJSON(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => { try { resolve(JSON.parse(e.target.result)); } catch(err) { reject('Invalid JSON file'); } }; reader.onerror = () => reject('Error reading file'); reader.readAsText(file); }); },
    
    savePageState(page, data) { sessionStorage.setItem('jf_previous_page', page); if (data) sessionStorage.setItem('jf_page_data', JSON.stringify(data)); },
    getPreviousPage() { return sessionStorage.getItem('jf_previous_page'); },
    getPageData() { const data = sessionStorage.getItem('jf_page_data'); return data ? JSON.parse(data) : null; },
    clearPageState() { sessionStorage.removeItem('jf_previous_page'); sessionStorage.removeItem('jf_page_data'); }
};

window.Utils = Utils;
