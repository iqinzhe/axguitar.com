// utils.js - 完整最终版 v3.0
// 修改内容：
// 1. 新增服务费相关翻译
// 2. 新增服务费百分比选项
// 3. 更新导出CSV格式（包含服务费）

const Utils = {
    lang: localStorage.getItem('jf_language') || 'id',
    db: null,

    setDb(db) {
        this.db = db;
    },

    calculateMonthlyInterest(loanAmount) {
        return loanAmount * 0.10;
    },

    calculateServiceFee(loanAmount, percent) {
        return loanAmount * (percent / 100);
    },

    calculateNextInterestDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },

    // 服务费百分比选项
    serviceFeePercentOptions: [
        { value: 0, label: '0% (Tidak Ada)' },
        { value: 1, label: '1%' },
        { value: 2, label: '2%' },
        { value: 3, label: '3%' }
    ],

    translations: {
        id: {
            login: "Masuk", logout: "Keluar", username: "Nama Pengguna", password: "Kata Sandi",
            save: "Simpan", cancel: "Batal", back: "Kembali", delete: "Hapus", edit: "Edit",
            view: "Lihat", search: "Cari", reset: "Reset", confirm: "Konfirmasi",
            dashboard: "Dasbor", create_order: "Buat Pesanan", order_list: "Daftar Pesanan",
            financial_report: "Laporan Keuangan",
            user_management: "Manajemen Operator",
            backup_restore: "Cadangan & Pemulihan", total_orders: "Total Pesanan",
            active: "Berjalan", completed: "Lunas", liquidated: "Dilikuidasi",
            total_loan: "Total Pinjaman", customer_info: "Informasi Pelanggan",
            customer_name: "Nama Lengkap", ktp_number: "Nomor KTP", phone: "Nomor Telepon",
            address: "Alamat", collateral_info: "Informasi Jaminan", collateral_name: "Nama Barang Jaminan",
            loan_amount: "Jumlah Pinjaman", notes: "Catatan", status_active: "Berjalan",
            status_completed: "Lunas", status_liquidated: "Dilikuidasi",
            fill_all_fields: "Harap isi semua bidang!", login_failed: "Login gagal!",
            order_created: "Pesanan berhasil dibuat!", order_updated: "Pesanan diperbarui",
            order_deleted: "Pesanan dihapus", confirm_delete: "Yakin ingin menghapus?",
            backup_downloaded: "Cadangan diunduh!", export_success: "Ekspor berhasil!",
            no_data: "Tidak ada data", current_user: "Pengguna saat ini",
            print: "Cetak", export_csv: "Ekspor CSV", cash: "Tunai", bank: "Bank BNI",
            service_fee: "Service Fee", admin_fee: "Admin Fee", interest: "Bunga",
            principal: "Pokok", expense: "Pengeluaran", profit: "Laba Bersih",
            cash_flow: "Arus Kas", inflow: "Masuk", outflow: "Keluar",
            loan_disbursement: "Pencairan Pinjaman"
        },
        zh: {
            login: "登录", logout: "退出", username: "用户名", password: "密码",
            save: "保存", cancel: "取消", back: "返回", delete: "删除", edit: "编辑",
            view: "查看", search: "搜索", reset: "重置", confirm: "确认",
            dashboard: "仪表板", create_order: "新建订单", order_list: "订单列表",
            financial_report: "财务报表",
            user_management: "操作员管理",
            backup_restore: "备份恢复", total_orders: "总订单数", active: "进行中", completed: "已结清", liquidated: "已变卖",
            total_loan: "贷款总额", customer_info: "客户信息", customer_name: "客户姓名",
            ktp_number: "KTP号码", phone: "手机号", address: "地址", collateral_info: "典当信息",
            collateral_name: "质押物名称", loan_amount: "贷款金额", notes: "备注",
            status_active: "进行中", status_completed: "已结清", status_liquidated: "已变卖",
            fill_all_fields: "请填写所有字段！", login_failed: "登录失败！",
            order_created: "订单创建成功！", order_updated: "订单已更新", order_deleted: "订单已删除",
            confirm_delete: "确定删除？", backup_downloaded: "备份已下载！", export_success: "导出成功！",
            no_data: "暂无数据", current_user: "当前用户",
            print: "打印", export_csv: "导出CSV", cash: "现金", bank: "银行BNI",
            service_fee: "服务费", admin_fee: "管理费", interest: "利息",
            principal: "本金", expense: "支出", profit: "净利",
            cash_flow: "资金流水", inflow: "流入", outflow: "流出",
            loan_disbursement: "贷款发放"
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

    exportToCSV(orders, filename) {
        const headers = this.lang === 'id'
            ? ['ID Pesanan', 'Pelanggan', 'Pinjaman', 'Admin Fee', 'Service Fee', 'Bunga Bulanan', 'Status', 'Tanggal Dibuat']
            : ['订单ID', '客户', '贷款金额', '管理费', '服务费', '月利息', '状态', '创建日期'];
        const rows = orders.map(o => [
            o.order_id, o.customer_name,
            this.formatCurrency(o.loan_amount),
            this.formatCurrency(o.admin_fee),
            this.formatCurrency(o.service_fee_amount || 0),
            this.formatCurrency(o.monthly_interest),
            o.status, this.formatDate(o.created_at)
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
            this.formatCurrency(p.amount),
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
            this.formatCurrency(f.amount),
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

    // 获取服务费百分比选项HTML
    getServiceFeeOptionsHtml: function(selectedPercent = 0) {
        var options = '';
        for (var opt of this.serviceFeePercentOptions) {
            var selected = selectedPercent === opt.value ? 'selected' : '';
            options += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        }
        return options;
    }
};

window.Utils = Utils;
