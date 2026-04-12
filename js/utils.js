const Utils = {
    // HTML转义防止XSS
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    
    // 格式化货币 (IDR)
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },
    
    // 格式化日期
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID');
    },
    
    // 计算每月应缴总额
    calculateMonthlyPayment(loanAmount) {
        const fee = loanAmount * 0.10; // 10% 资金租赁费
        return fee + 30000; // + 管理费 30,000
    },
    
    // 计算下一个缴费日期
    calculateNextDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },
    
    // 检查订单状态
    checkOrderStatus(order) {
        if (order.status !== 'active') return order.status;
        
        const today = new Date();
        const nextDue = new Date(order.next_due_date);
        
        if (today > nextDue) {
            return 'overdue';
        }
        return 'active';
    },
    
    // 生成唯一ID
    generateId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    },
    
    // 导出数据为JSON文件
    exportToJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // 导出为CSV
    exportToCSV(orders, filename) {
        const headers = ['订单ID', '客户姓名', 'KTP', '手机号', '质押物', '贷款金额', '月应缴', '已缴月数', '状态', '创建日期', '下次缴费日'];
        const rows = orders.map(o => [
            o.order_id,
            o.customer.name,
            o.customer.ktp,
            o.customer.phone,
            o.collateral_name,
            o.loan_amount,
            Utils.formatCurrency(Utils.calculateMonthlyPayment(o.loan_amount)),
            o.paid_months,
            Utils.checkOrderStatus(o),
            Utils.formatDate(o.created_at),
            Utils.formatDate(o.next_due_date)
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
    
    // 导入JSON数据
    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject('Invalid JSON file');
                }
            };
            reader.onerror = () => reject('Error reading file');
            reader.readAsText(file);
        });
    }
};

window.Utils = Utils;
