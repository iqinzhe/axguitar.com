const Utils = {
    lang: localStorage.getItem('jf_language') || 'id',
    db: null,
    
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
        
        const monthOrders = this.db.orders.filter(o => 
            o.order_id && o.order_id.startsWith(`${prefix}-${datePrefix}`)
        );
        const seq = String(monthOrders.length + 1).padStart(2, '0');
        
        return `${prefix}-${datePrefix}-${seq}`;
    },
    
    // 计算月利息 (贷款金额 × 10%)
    calculateMonthlyInterest(loanAmount) {
        return loanAmount * 0.10;
    },
    
    // 计算下一个利息支付日期
    calculateNextInterestDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },
    
    // ==================== 翻译字典 ====================
    translations: {
        id: {
            // 通用
            login: "Masuk",
            logout: "Keluar",
            username: "Nama Pengguna",
            password: "Kata Sandi",
            save: "Simpan",
            cancel: "Batal",
            back: "Kembali",
            delete: "Hapus",
            edit: "Edit",
            view: "Lihat",
            search: "Cari",
            reset: "Reset",
            confirm: "Konfirmasi",
            
            // 业务
            dashboard: "Dasbor",
            create_order: "Buat Pesanan",
            order_list: "Daftar Pesanan",
            financial_report: "Laporan Keuangan",
            user_management: "Manajemen Pengguna",
            backup_restore: "Cadangan & Pemulihan",
            total_orders: "Total Pesanan",
            active: "Berjalan",
            completed: "Lunas",
            liquidated: "Dilikuidasi",
            total_loan: "Total Pinjaman",
            total_fees: "Total Biaya",
            
            // 表单
            customer_info: "Informasi Pelanggan",
            customer_name: "Nama Lengkap",
            ktp_number: "Nomor KTP",
            phone: "Nomor Telepon",
            address: "Alamat",
            collateral_info: "Informasi Jaminan",
            collateral_name: "Nama Barang Jaminan",
            loan_amount: "Jumlah Pinjaman",
            notes: "Catatan",
            monthly_payment: "Pembayaran Bulanan",
            
            // 状态
            status_active: "Berjalan",
            status_completed: "Lunas",
            status_liquidated: "Dilikuidasi",
            status_overdue: "Jatuh Tempo",
            
            // 提示
            fill_all_fields: "Harap isi semua bidang!",
            login_failed: "Login gagal!",
            order_created: "Pesanan berhasil dibuat!",
            order_updated: "Pesanan diperbarui",
            order_deleted: "Pesanan dihapus",
            payment_recorded: "Pembayaran dicatat!",
            confirm_delete: "Yakin ingin menghapus?",
            backup_downloaded: "Cadangan diunduh!",
            export_success: "Ekspor berhasil!",
            no_data: "Tidak ada data",
            
            // 业务规则
            business_rule: "Biaya Admin: 30,000 IDR | Bunga: 10%/bulan",
            current_user: "Pengguna saat ini"
        },
        zh: {
            // 通用
            login: "登录",
            logout: "退出",
            username: "用户名",
            password: "密码",
            save: "保存",
            cancel: "取消",
            back: "返回",
            delete: "删除",
            edit: "编辑",
            view: "查看",
            search: "搜索",
            reset: "重置",
            confirm: "确认",
            
            // 业务
            dashboard: "仪表板",
            create_order: "新建订单",
            order_list: "订单列表",
            financial_report: "财务报表",
            user_management: "用户管理",
            backup_restore: "备份恢复",
            total_orders: "总订单数",
            active: "进行中",
            completed: "已结清",
            liquidated: "已变卖",
            total_loan: "贷款总额",
            total_fees: "费用总额",
            
            // 表单
            customer_info: "客户信息",
            customer_name: "客户姓名",
            ktp_number: "KTP号码",
            phone: "手机号",
            address: "地址",
            collateral_info: "典当信息",
            collateral_name: "质押物名称",
            loan_amount: "贷款金额",
            notes: "备注",
            monthly_payment: "月应缴",
            
            // 状态
            status_active: "进行中",
            status_completed: "已结清",
            status_liquidated: "已变卖",
            status_overdue: "逾期",
            
            // 提示
            fill_all_fields: "请填写所有字段！",
            login_failed: "登录失败！",
            order_created: "订单创建成功！",
            order_updated: "订单已更新",
            order_deleted: "订单已删除",
            payment_recorded: "缴费已记录！",
            confirm_delete: "确定删除？",
            backup_downloaded: "备份已下载！",
            export_success: "导出成功！",
            no_data: "暂无数据",
            
            // 业务规则
            business_rule: "管理费: 30,000 IDR | 利息: 10%/月",
            current_user: "当前用户"
        }
    },
    
    t(key) {
        return this.translations[this.lang][key] || key;
    },
    
    setLanguage(lang) {
        if (lang === 'id' || lang === 'zh') {
            this.lang = lang;
            localStorage.setItem('jf_language', lang);
        }
    },
    
    getLanguage() {
        return this.lang;
    },
    
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },
    
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString(this.lang === 'id' ? 'id-ID' : 'zh-CN');
    },
    
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
    
    exportToCSV(orders, filename) {
        const headers = this.lang === 'id' ? 
            ['ID Pesanan', 'Pelanggan', 'Pinjaman', 'Admin Fee', 'Bunga Bulanan', 'Status', 'Tanggal Dibuat'] :
            ['订单ID', '客户', '贷款金额', '管理费', '月利息', '状态', '创建日期'];
        const rows = orders.map(o => [
            o.order_id, 
            o.customer.name, 
            this.formatCurrency(o.loan_amount), 
            this.formatCurrency(o.admin_fee), 
            this.formatCurrency(o.monthly_interest), 
            o.status, 
            this.formatDate(o.created_at)
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
    
    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    resolve(JSON.parse(e.target.result));
                } catch(err) {
                    reject('Invalid JSON file');
                }
            };
            reader.onerror = () => reject('Error reading file');
            reader.readAsText(file);
        });
    },
    
    savePageState(page, data) {
        sessionStorage.setItem('jf_previous_page', page);
        if (data) sessionStorage.setItem('jf_page_data', JSON.stringify(data));
    },
    
    getPreviousPage() {
        return sessionStorage.getItem('jf_previous_page');
    },
    
    getPageData() {
        const data = sessionStorage.getItem('jf_page_data');
        return data ? JSON.parse(data) : null;
    },
    
    clearPageState() {
        sessionStorage.removeItem('jf_previous_page');
        sessionStorage.removeItem('jf_page_data');
    }
};

window.Utils = Utils;
