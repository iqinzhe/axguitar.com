const Utils = {
    // 当前语言
    lang: localStorage.getItem('jf_language') || 'id', // id = 印尼语, zh = 中文
    
    // 翻译字典
    translations: {
        id: {
            // 通用
            app_title: "JF GADAI ENTERPRISE",
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
            loading: "Memuat sistem...",
            
            // 业务
            dashboard: "Dasbor",
            create_order: "Buat Pesanan Baru",
            order_list: "Daftar Pesanan",
            financial_report: "Laporan Keuangan",
            user_management: "Manajemen Pengguna",
            backup_restore: "Cadangan & Pemulihan",
            total_orders: "Total Pesanan",
            active: "Berjalan",
            completed: "Lunas",
            liquidated: "Dilikuidasi",
            total_loan: "Total Pinjaman",
            total_fees: "Total Biaya Diterima",
            
            // 表单
            customer_info: "Informasi Pelanggan",
            customer_name: "Nama Lengkap",
            ktp_number: "Nomor KTP",
            phone: "Nomor Telepon",
            address: "Alamat",
            collateral_info: "Informasi Jaminan",
            collateral_name: "Nama Barang Jaminan",
            loan_amount: "Jumlah Pinjaman (IDR)",
            notes: "Catatan",
            monthly_payment: "Pembayaran Bulanan",
            
            // 状态
            status_active: "Berjalan",
            status_completed: "Lunas",
            status_liquidated: "Dilikuidasi",
            status_overdue: "Jatuh Tempo",
            
            // 提示
            fill_all_fields: "Harap isi semua bidang yang wajib diisi!",
            login_failed: "Login gagal - Nama pengguna atau kata sandi salah",
            order_created: "Pesanan berhasil dibuat!",
            order_updated: "Pesanan telah diperbarui",
            order_deleted: "Pesanan dihapus",
            payment_recorded: "Pembayaran berhasil dicatat!",
            confirm_delete: "⚠️ Yakin ingin menghapus pesanan ini? Tindakan ini tidak dapat dibatalkan!",
            backup_downloaded: "File cadangan berhasil diunduh!",
            export_success: "Ekspor berhasil!",
            no_data: "Tidak ada data",
            
            // 业务规则
            business_rule: "Aturan Bisnis: Biaya sewa modal bulanan (10%) + Biaya administrasi (30,000 IDR), periode 10 bulan per siklus",
            current_user: "Pengguna saat ini",
            monthly_fee_calc: "Pinjaman × 10% + 30,000 IDR"
        },
        zh: {
            // 通用
            app_title: "JF GADAI ENTERPRISE",
            login: "登录",
            logout: "退出登录",
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
            loading: "系统加载中...",
            
            // 业务
            dashboard: "仪表板",
            create_order: "新建订单",
            order_list: "订单列表",
            financial_report: "财务报表",
            user_management: "用户管理",
            backup_restore: "备份与恢复",
            total_orders: "总订单数",
            active: "进行中",
            completed: "已结清",
            liquidated: "已变卖",
            total_loan: "贷款总额",
            total_fees: "已收租赁费",
            
            // 表单
            customer_info: "客户信息",
            customer_name: "客户姓名",
            ktp_number: "KTP号码",
            phone: "手机号",
            address: "地址",
            collateral_info: "典当信息",
            collateral_name: "质押物名称",
            loan_amount: "贷款金额 (IDR)",
            notes: "备注",
            monthly_payment: "月应缴",
            
            // 状态
            status_active: "进行中",
            status_completed: "已结清",
            status_liquidated: "已变卖",
            status_overdue: "逾期",
            
            // 提示
            fill_all_fields: "请填写所有必填字段！",
            login_failed: "登录失败 - 用户名或密码错误",
            order_created: "订单创建成功！",
            order_updated: "订单已更新",
            order_deleted: "订单已删除",
            payment_recorded: "缴费记录成功！",
            confirm_delete: "⚠️ 确定要删除这个订单吗？此操作不可恢复！",
            backup_downloaded: "备份文件已下载！",
            export_success: "导出成功！",
            no_data: "暂无数据",
            
            // 业务规则
            business_rule: "业务规则：每月支付资金租赁费(10%) + 管理费(30,000 IDR)，每10个月为一个周期",
            current_user: "当前用户",
            monthly_fee_calc: "贷款金额 × 10% + 30,000 IDR"
        }
    },
    
    // 获取翻译文本
    t(key) {
        return this.translations[this.lang][key] || key;
    },
    
    // 切换语言
    setLanguage(lang) {
        if (lang === 'id' || lang === 'zh') {
            this.lang = lang;
            localStorage.setItem('jf_language', lang);
            return true;
        }
        return false;
    },
    
    // 获取当前语言
    getLanguage() {
        return this.lang;
    },
    
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
        return date.toLocaleDateString(this.lang === 'id' ? 'id-ID' : 'zh-CN');
    },
    
    // 计算每月应缴总额
    calculateMonthlyPayment(loanAmount) {
        const fee = loanAmount * 0.10;
        return fee + 30000;
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
        const headers = this.lang === 'id' ? 
            ['ID Pesanan', 'Nama Pelanggan', 'KTP', 'Telepon', 'Nama Jaminan', 'Jumlah Pinjaman', 'Bayar Bulanan', 'Bulan Dibayar', 'Status', 'Tanggal Dibuat', 'Jatuh Tempo Berikutnya'] :
            ['订单ID', '客户姓名', 'KTP', '手机号', '质押物', '贷款金额', '月应缴', '已缴月数', '状态', '创建日期', '下次缴费日'];
        
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
    },
    
    // 保存页面状态到 sessionStorage (用于返回上一页)
    savePageState(page, data) {
        sessionStorage.setItem('jf_previous_page', page);
        if (data) {
            sessionStorage.setItem('jf_page_data', JSON.stringify(data));
        }
    },
    
    // 获取上一页状态
    getPreviousPage() {
        return sessionStorage.getItem('jf_previous_page');
    },
    
    getPageData() {
        const data = sessionStorage.getItem('jf_page_data');
        return data ? JSON.parse(data) : null;
    },
    
    // 清除页面状态
    clearPageState() {
        sessionStorage.removeItem('jf_previous_page');
        sessionStorage.removeItem('jf_page_data');
    }
};

window.Utils = Utils;
