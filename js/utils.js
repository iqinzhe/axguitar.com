// utils.js - v1.1（双语支持：登录页面切换语言，界面文字翻译，数据内容保持原样）

const Utils = {
    lang: 'id',  // 默认印尼语
    db: null,
    
    // ==================== 修复高危1：利率常量 ====================
    MONTHLY_INTEREST_RATE: 0.10,  // 月利率 10%
    
    // 服务费百分比选项
    serviceFeePercentOptions: [
        { value: 0, label: '0% (Tidak Ada)' },
        { value: 1, label: '1%' },
        { value: 2, label: '2%' },
        { value: 3, label: '3%' }
    ],

    // 初始化语言（在页面加载时调用）
    initLanguage: function() {
        var storedLang = localStorage.getItem('jf_language');
        if (storedLang === 'id' || storedLang === 'zh') {
            this.lang = storedLang;
        } else {
            // 默认印尼语
            this.lang = 'id';
            localStorage.setItem('jf_language', 'id');
        }
        return this.lang;
    },

    setDb(db) {
        this.db = db;
    },

    // 使用常量计算月利息
    calculateMonthlyInterest(loanAmount) {
        return loanAmount * this.MONTHLY_INTEREST_RATE;
    },

    calculateServiceFee(loanAmount, percent) {
        return loanAmount * (percent / 100);
    },

    calculateNextInterestDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },

    translations: {
        id: {
            // 登录相关
            login: "Masuk", 
            logout: "Keluar", 
            username: "Nama Pengguna", 
            password: "Kata Sandi",
            
            // 通用操作
            save: "Simpan", 
            cancel: "Batal", 
            back: "Kembali", 
            delete: "Hapus", 
            edit: "Edit",
            view: "Lihat", 
            search: "Cari", 
            reset: "Reset", 
            confirm: "Konfirmasi",
            
            // 页面标题
            dashboard: "Dasbor", 
            create_order: "Buat Pesanan", 
            order_list: "Daftar Pesanan",
            financial_report: "Laporan Keuangan",
            user_management: "Manajemen Operator",
            backup_restore: "Cadangan & Pemulihan",
            store_management: "Manajemen Toko",
            expenses: "Pengeluaran Operasional",
            payment_history: "Arus Kas",
            customers: "Data Nasabah",
            blacklist: "Daftar Hitam",
            
            // 订单相关
            total_orders: "Total Pesanan",
            active: "Berjalan", 
            completed: "Lunas", 
            liquidated: "Dilikuidasi",
            total_loan: "Total Pinjaman",
            customer_info: "Informasi Pelanggan",
            customer_name: "Nama Lengkap",
            ktp_number: "Nomor KTP",
            phone: "Nomor Telepon",
            address: "Alamat",
            collateral_info: "Informasi Jaminan",
            collateral_name: "Nama Barang Jaminan",
            loan_amount: "Jumlah Pinjaman",
            notes: "Catatan",
            status_active: "Berjalan",
            status_completed: "Lunas",
            status_liquidated: "Dilikuidasi",
            order_id: "ID Pesanan",
            order_date: "Tanggal Pesanan",
            
            // 提示信息
            fill_all_fields: "Harap isi semua bidang!",
            login_failed: "Login gagal!",
            order_created: "Pesanan berhasil dibuat!",
            order_updated: "Pesanan diperbarui",
            order_deleted: "Pesanan dihapus",
            confirm_delete: "Yakin ingin menghapus?",
            backup_downloaded: "Cadangan diunduh!",
            export_success: "Ekspor berhasil!",
            no_data: "Tidak ada data",
            current_user: "Pengguna saat ini",
            
            // 按钮文字
            print: "Cetak",
            export_csv: "Ekspor CSV",
            
            // 支付方式
            cash: "Tunai", 
            bank: "Bank BNI",
            
            // 费用类型
            service_fee: "Service Fee",
            admin_fee: "Admin Fee",
            interest: "Bunga",
            principal: "Pokok",
            expense: "Pengeluaran",
            profit: "Laba Bersih",
            cash_flow: "Arus Kas",
            inflow: "Masuk",
            outflow: "Keluar",
            loan_disbursement: "Pencairan Pinjaman",
            
            // 其他
            action: "Aksi",
            date: "Tanggal",
            amount: "Jumlah",
            description: "Deskripsi",
            status: "Status",
            save_exit: "Simpan & Keluar",
            send_reminder: "Kirim Pengingat",
            order_details: "Detail Pesanan",
            collateral_note: "Keterangan Barang",
            loan_source: "Sumber Dana Pinjaman",
            service_fee_method: "Metode Pemasukan Service Fee",
            admin_fee_method: "Metode Pemasukan Admin Fee",
            store: "Toko",
            registered_date: "Tanggal Daftar",
            living_address: "Alamat Tinggal",
            ktp_address: "Alamat KTP",
            same_as_ktp: "Sama dengan KTP",
            different: "Berbeda",
            add_customer: "Tambah Nasabah Baru",
            customer_list: "Daftar Nasabah",
            operation: "Operasi Bisnis",
            financial_indicators: "Indikator Keuangan",
            fund_management: "Manajemen Dana",
            internal_transfer: "Transfer Internal",
            cash_to_bank: "Tunai ke Bank",
            bank_to_cash: "Bank ke Tunai",
            submit_to_hq: "Setoran ke Pusat",
            cash_flow_summary: "Ringkasan Arus Kas",
            total_cash: "Total Kas",
            net_profit: "Laba Bersih",
            filter: "Filter",
            clear_filter: "Bersihkan Filter",
            export: "Ekspor",
            close: "Tutup",
            search_description: "Cari deskripsi...",
            all_types: "Semua tipe",
            from_date: "Dari tanggal",
            to_date: "Sampai tanggal"
        },
        zh: {
            // 登录相关
            login: "登录", 
            logout: "退出", 
            username: "用户名", 
            password: "密码",
            
            // 通用操作
            save: "保存", 
            cancel: "取消", 
            back: "返回", 
            delete: "删除", 
            edit: "编辑",
            view: "查看", 
            search: "搜索", 
            reset: "重置", 
            confirm: "确认",
            
            // 页面标题
            dashboard: "仪表板", 
            create_order: "新建订单", 
            order_list: "订单列表",
            financial_report: "财务报表",
            user_management: "操作员管理",
            backup_restore: "备份恢复",
            store_management: "门店管理",
            expenses: "运营支出",
            payment_history: "资金流水",
            customers: "客户信息",
            blacklist: "黑名单",
            
            // 订单相关
            total_orders: "总订单数",
            active: "进行中", 
            completed: "已结清", 
            liquidated: "已变卖",
            total_loan: "贷款总额",
            customer_info: "客户信息",
            customer_name: "客户姓名",
            ktp_number: "KTP号码",
            phone: "手机号",
            address: "地址",
            collateral_info: "典当信息",
            collateral_name: "质押物名称",
            loan_amount: "贷款金额",
            notes: "备注",
            status_active: "进行中",
            status_completed: "已结清",
            status_liquidated: "已变卖",
            order_id: "订单号",
            order_date: "订单日期",
            
            // 提示信息
            fill_all_fields: "请填写所有字段！",
            login_failed: "登录失败！",
            order_created: "订单创建成功！",
            order_updated: "订单已更新",
            order_deleted: "订单已删除",
            confirm_delete: "确定删除？",
            backup_downloaded: "备份已下载！",
            export_success: "导出成功！",
            no_data: "暂无数据",
            current_user: "当前用户",
            
            // 按钮文字
            print: "打印",
            export_csv: "导出CSV",
            
            // 支付方式
            cash: "现金", 
            bank: "银行BNI",
            
            // 费用类型
            service_fee: "服务费",
            admin_fee: "管理费",
            interest: "利息",
            principal: "本金",
            expense: "支出",
            profit: "净利",
            cash_flow: "资金流水",
            inflow: "流入",
            outflow: "流出",
            loan_disbursement: "贷款发放",
            
            // 其他
            action: "操作",
            date: "日期",
            amount: "金额",
            description: "描述",
            status: "状态",
            save_exit: "保存退出",
            send_reminder: "催收提醒",
            order_details: "订单详情",
            collateral_note: "物品备注",
            loan_source: "贷款资金来源",
            service_fee_method: "服务费入账方式",
            admin_fee_method: "管理费入账方式",
            store: "门店",
            registered_date: "注册日期",
            living_address: "居住地址",
            ktp_address: "KTP地址",
            same_as_ktp: "同KTP",
            different: "不同",
            add_customer: "新增客户",
            customer_list: "客户列表",
            operation: "业务操作",
            financial_indicators: "经营指标",
            fund_management: "资金管理",
            internal_transfer: "内部转账",
            cash_to_bank: "现金存入银行",
            bank_to_cash: "银行取现",
            submit_to_hq: "上缴总部",
            cash_flow_summary: "现金流汇总",
            total_cash: "总现金",
            net_profit: "现金净利",
            filter: "筛选",
            clear_filter: "重置",
            export: "导出",
            close: "关闭",
            search_description: "搜索描述...",
            all_types: "全部类型",
            from_date: "开始日期",
            to_date: "结束日期"
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
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0
        }).format(amount);
    },
    
    // 获取原始数值（用于CSV导出）
    getRawAmount(amount) {
        return amount || 0;
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString(this.lang === 'id' ? 'id-ID' : 'zh-CN');
    },

    exportToJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ==================== 修复中危3：CSV导出使用原始数值 ====================
    exportToCSV(orders, filename) {
        const headers = this.lang === 'id'
            ? ['ID Pesanan', 'Pelanggan', 'Pinjaman', 'Admin Fee', 'Service Fee', 'Bunga Bulanan', 'Status', 'Tanggal Dibuat']
            : ['订单ID', '客户', '贷款金额', '管理费', '服务费', '月利息', '状态', '创建日期'];
        const rows = orders.map(o => [
            o.order_id, 
            o.customer_name,
            this.getRawAmount(o.loan_amount),
            this.getRawAmount(o.admin_fee),
            this.getRawAmount(o.service_fee_amount || 0),
            this.getRawAmount(o.monthly_interest),
            o.status, 
            this.formatDate(o.created_at)
        ]);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportPaymentsToCSV(payments, filename) {
        const headers = this.lang === 'id'
            ? ['ID Pesanan', 'Pelanggan', 'Tanggal', 'Jenis', 'Bulan', 'Jumlah', 'Metode', 'Keterangan']
            : ['订单ID', '客户', '日期', '类型', '月数', '金额', '支付方式', '说明'];
        const typeMap = {
            admin_fee: this.lang === 'id' ? 'Admin Fee' : '管理费',
            service_fee: this.lang === 'id' ? 'Service Fee' : '服务费',
            interest: this.lang === 'id' ? 'Bunga' : '利息',
            principal: this.lang === 'id' ? 'Pokok' : '本金'
        };
        const methodMap = {
            cash: this.lang === 'id' ? 'Tunai' : '现金',
            bank: this.lang === 'id' ? 'Bank BNI' : '银行BNI'
        };
        const rows = payments.map(p => [
            p.orders?.order_id || '-',
            p.orders?.customer_name || '-',
            p.date,
            typeMap[p.type] || p.type,
            p.months || '-',
            this.getRawAmount(p.amount),
            methodMap[p.payment_method] || '-',
            p.description || '-'
        ]);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportCashFlowToCSV(flows, filename) {
        const headers = this.lang === 'id'
            ? ['Tanggal', 'Tipe', 'Metode', 'Arah', 'Jumlah', 'Keterangan', 'ID Pesanan']
            : ['日期', '类型', '方式', '方向', '金额', '说明', '订单号'];
        const typeMap = {
            loan_disbursement: this.lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放',
            admin_fee: this.lang === 'id' ? 'Admin Fee' : '管理费',
            service_fee: this.lang === 'id' ? 'Service Fee' : '服务费',
            interest: this.lang === 'id' ? 'Bunga' : '利息',
            principal: this.lang === 'id' ? 'Pokok' : '本金',
            expense: this.lang === 'id' ? 'Pengeluaran' : '运营支出'
        };
        const rows = flows.map(f => [
            this.formatDate(f.recorded_at),
            typeMap[f.flow_type] || f.flow_type,
            f.source_target === 'cash' ? (this.lang === 'id' ? 'Tunai' : '现金') : (this.lang === 'id' ? 'Bank' : '银行'),
            f.direction === 'inflow' ? (this.lang === 'id' ? 'Masuk' : '流入') : (this.lang === 'id' ? 'Keluar' : '流出'),
            this.getRawAmount(f.amount),
            f.description || '-',
            f.orders?.order_id || '-'
        ]);
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
                } catch (err) {
                    reject('Invalid JSON file');
                }
            };
            reader.onerror = () => reject('Error reading file');
            reader.readAsText(file);
        });
    },

    formatNumberWithCommas: function(x) {
        if (x === null || x === undefined || x === '') return '';
        var num = String(x).replace(/[,\s]/g, '');
        if (isNaN(num) || num === '') return '';
        return Number(num).toLocaleString('en-US');
    },

    parseNumberFromCommas: function(x) {
        if (!x) return 0;
        return parseInt(String(x).replace(/[,\s]/g, '')) || 0;
    },

    bindAmountFormat: function(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('input', function(e) {
            var rawValue = e.target.value;
            var num = Utils.parseNumberFromCommas(rawValue);
            if (!isNaN(num) && num !== '') {
                e.target.value = Utils.formatNumberWithCommas(num);
            }
        });
    },

    renderPageHeader: function(title, showBackBtn = true) {
        var lang = this.lang;
        var t = (key) => this.t(key);
        var backBtnHtml = showBackBtn && window.APP && typeof window.APP.goBack === 'function' 
            ? `<button onclick="APP.goBack()">↩️ ${t('back')}</button>` 
            : '';
        return `
            <div class="page-header">
                <h2>${title}</h2>
                <div>${backBtnHtml}</div>
            </div>
        `;
    },

    wrapTableRow: function(cells, isHeader = false) {
        var tag = isHeader ? 'th' : 'td';
        return '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
    },

    getServiceFeeOptionsHtml: function(selectedPercent = 0) {
        var options = '';
        for (var opt of this.serviceFeePercentOptions) {
            var selected = selectedPercent === opt.value ? 'selected' : '';
            options += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        }
        return options;
    }
};

// 在页面加载时初始化语言
Utils.initLanguage();

window.Utils = Utils;

console.log('✅ utils.js v1.1 已加载 - 双语支持（登录页面切换语言）');
