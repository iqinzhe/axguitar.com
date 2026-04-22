// utils.js - v1.5（新增：KTP验证、手机号验证、订单金额预览辅助）

const Utils = {
    lang: 'id',
    db: null,

    MONTHLY_INTEREST_RATE: 0.10,

    serviceFeePercentOptions: [
        { value: 0, label: '0% (Tidak Ada)' },
        { value: 1, label: '1%' },
        { value: 2, label: '2%' },
        { value: 3, label: '3%' }
    ],

    initLanguage() {
        const stored = localStorage.getItem('jf_language');
        this.lang = (stored === 'id' || stored === 'zh') ? stored : 'id';
        if (!stored) localStorage.setItem('jf_language', 'id');
        return this.lang;
    },

    setDb(db) { this.db = db; },

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

    // 固定还款计算函数
    calculateFixedMonthlyPayment: function(loanAmount, monthlyRate, months) {
        if (monthlyRate === 0) return loanAmount / months;
        const rate = monthlyRate;
        const denominator = Math.pow(1 + rate, months) - 1;
        if (denominator === 0) return loanAmount / months;
        return loanAmount * rate * Math.pow(1 + rate, months) / denominator;
    },

    calculateFixedPaymentSplit: function(remainingPrincipal, monthlyRate, fixedPayment) {
        const interest = remainingPrincipal * monthlyRate;
        const principal = Math.min(fixedPayment - interest, remainingPrincipal);
        return {
            interest: Math.max(0, interest),
            principal: Math.max(0, principal)
        };
    },

    // ========== 翻译函数 ==========
    translations: {
        id: {
            login: "Masuk", logout: "Keluar", username: "Nama Pengguna", password: "Kata Sandi",
            save: "Simpan", cancel: "Batal", back: "Kembali", delete: "Hapus", edit: "Edit",
            view: "Lihat", search: "Cari", reset: "Reset", confirm: "Konfirmasi",
            dashboard: "Dasbor", create_order: "Buat Pesanan", order_list: "Daftar Pesanan",
            financial_report: "Laporan Keuangan", user_management: "Manajemen Operator",
            backup_restore: "Cadangan & Pemulihan", store_management: "Manajemen Toko",
            expenses: "Pengeluaran Operasional", payment_history: "Arus Kas",
            customers: "Data Nasabah", blacklist: "Daftar Hitam",
            total_orders: "Total Pesanan", active: "Berjalan", completed: "Lunas",
            liquidated: "Dilikuidasi", total_loan: "Total Pinjaman",
            customer_info: "Informasi Pelanggan", customer_name: "Nama Lengkap",
            ktp_number: "Nomor KTP", phone: "Nomor Telepon", address: "Alamat",
            collateral_info: "Informasi Jaminan", collateral_name: "Nama Barang Jaminan",
            loan_amount: "Jumlah Pinjaman", notes: "Catatan",
            status_active: "Berjalan", status_completed: "Lunas", status_liquidated: "Dilikuidasi",
            order_id: "ID Pesanan", order_date: "Tanggal Pesanan",
            fill_all_fields: "Harap isi semua bidang!", login_failed: "Login gagal!",
            order_created: "Pesanan berhasil dibuat!", order_updated: "Pesanan diperbarui",
            order_deleted: "Pesanan dihapus", confirm_delete: "Yakin ingin menghapus?",
            backup_downloaded: "Cadangan diunduh!", export_success: "Ekspor berhasil!",
            no_data: "Tidak ada data", current_user: "Pengguna saat ini",
            print: "Cetak", export_csv: "Ekspor CSV",
            cash: "Tunai", bank: "Bank BNI",
            service_fee: "Service Fee", admin_fee: "Admin Fee", interest: "Bunga",
            principal: "Pokok", expense: "Pengeluaran", profit: "Laba Bersih",
            cash_flow: "Arus Kas", inflow: "Masuk", outflow: "Keluar",
            loan_disbursement: "Pencairan Pinjaman",
            action: "Aksi", date: "Tanggal", amount: "Jumlah", description: "Deskripsi",
            status: "Status", save_exit: "Simpan & Keluar", send_reminder: "Kirim Pengingat",
            order_details: "Detail Pesanan", collateral_note: "Keterangan Barang",
            loan_source: "Sumber Dana Pinjaman", service_fee_method: "Metode Pemasukan Service Fee",
            admin_fee_method: "Metode Pemasukan Admin Fee", store: "Toko",
            registered_date: "Tanggal Daftar", living_address: "Alamat Tinggal",
            ktp_address: "Alamat KTP", same_as_ktp: "Sama dengan KTP", different: "Berbeda",
            add_customer: "Tambah Nasabah Baru", customer_list: "Daftar Nasabah",
            operation: "Operasi Bisnis", financial_indicators: "Indikator Keuangan",
            fund_management: "Manajemen Dana", internal_transfer: "Transfer Internal",
            cash_to_bank: "Tunai ke Bank", bank_to_cash: "Bank ke Tunai",
            submit_to_hq: "Setoran ke Pusat", cash_flow_summary: "Ringkasan Arus Kas",
            total_cash: "Total Kas", net_profit: "Laba Bersih", filter: "Filter",
            clear_filter: "Bersihkan Filter", export: "Ekspor", close: "Tutup",
            search_description: "Cari deskripsi...", all_types: "Semua tipe",
            from_date: "Dari tanggal", to_date: "Sampai tanggal",
            fixed_repayment: "Cicilan Tetap", flexible_repayment: "Cicilan Fleksibel",
            repayment_type: "Jenis Cicilan", repayment_term: "Jangka Waktu (Bulan)",
            monthly_payment: "Angsuran per Bulan", agreed_rate: "Suku Bunga Kesepakatan",
            agreed_service_fee: "Biaya Layanan Kesepakatan", payment_due_date: "Tanggal Jatuh Tempo",
            overdue_days: "Hari Terlambat", liquidation_warning: "⚠️ Terlambat 30 hari akan memasuki proses likuidasi",
            early_settlement: "Pelunasan Dipercepat", interest_rebate: "Diskon Bunga",
            remaining_term: "Sisa Jangka Waktu", confirm_early_settlement: "Konfirmasi Pelunasan Dipercepat",
            store_operation: "Operasi Toko", save_failed: "Gagal menyimpan",
            order_not_found: "Pesanan tidak ditemukan", unauthorized: "Tidak memiliki akses",
            order_locked: "Pesanan terkunci", loan_already_disbursed: "Pinjaman sudah dicairkan",
            backup_complete: "✅ Cadangan selesai!\n\nTelah mengekspor {orders} pesanan, {customers} data nasabah.",
            restore_confirm: "⚠️ Pemulihan data akan menimpa semua data saat ini!\n\nTindakan ini tidak dapat dibatalkan.\n\nDisarankan untuk mengekspor data saat ini sebagai cadangan terlebih dahulu.\n\nYakin ingin melanjutkan?",
            save_exit_confirm: "💾 Konfirmasi simpan dan keluar?\n\nSistem akan menyimpan data secara otomatis, lalu keluar.",
            login_required: "Silakan login kembali", invalid_amount: "Jumlah tidak valid",
            payment_success: "Pembayaran berhasil", order_completed: "Pesanan sudah lunas",
            customer_has_active_order: "Nasabah ini masih memiliki pesanan aktif.",
            blacklisted_cannot_order: "❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.",
            interest_recorded: "Bunga {amount} telah dicatat", principal_recorded: "Pembayaran pokok {amount} telah dicatat",
            fixed_installment_paid: "Angsuran ke-{month} berhasil dibayar!\nBunga: {interest}\nPokok: {principal}\nSisa angsuran: {remaining} bulan",
            early_settlement_success: "✅ Pelunasan dipercepat berhasil!\nJumlah pelunasan: {amount}",
            confirm_logout: "Apakah Anda yakin ingin keluar? Data yang belum disimpan akan hilang.",
            // 新增验证提示
            invalid_ktp: "Nomor KTP harus 16 digit angka",
            invalid_phone: "Nomor telepon tidak valid (minimal 9 digit)"
        },
        zh: {
            login: "登录", logout: "退出", username: "用户名", password: "密码",
            save: "保存", cancel: "取消", back: "返回", delete: "删除", edit: "编辑",
            view: "查看", search: "搜索", reset: "重置", confirm: "确认",
            dashboard: "仪表板", create_order: "新建订单", order_list: "订单管理",
            financial_report: "业务报表", user_management: "员工管理",
            backup_restore: "备份恢复", store_management: "门店管理",
            expenses: "运营支出", payment_history: "资金流水",
            customers: "客户信息", blacklist: "黑名单",
            total_orders: "订单总数", active: "进行中", completed: "已结清",
            liquidated: "已变卖", total_loan: "贷款总额",
            customer_info: "客户信息", customer_name: "客户姓名",
            ktp_number: "KTP号码", phone: "手机号", address: "地址",
            collateral_info: "典当信息", collateral_name: "质押物名称",
            loan_amount: "贷款金额", notes: "备注",
            status_active: "进行中", status_completed: "已结清", status_liquidated: "已变卖",
            order_id: "订单号", order_date: "订单日期",
            fill_all_fields: "请填写所有字段！", login_failed: "登录失败！",
            order_created: "订单创建成功！", order_updated: "订单已更新",
            order_deleted: "订单已删除", confirm_delete: "确定删除？",
            backup_downloaded: "备份已下载！", export_success: "导出成功！",
            no_data: "暂无数据", current_user: "当前用户",
            print: "打印", export_csv: "导出CSV",
            cash: "现金", bank: "银行BNI",
            service_fee: "服务费", admin_fee: "管理费", interest: "利息",
            principal: "本金", expense: "支出", profit: "净利",
            cash_flow: "资金流水", inflow: "流入", outflow: "流出",
            loan_disbursement: "贷款发放",
            action: "操作", date: "日期", amount: "金额", description: "描述",
            status: "状态", save_exit: "保存退出", send_reminder: "催收提醒",
            order_details: "订单详情", collateral_note: "物品备注",
            loan_source: "贷款资金来源", service_fee_method: "服务费入账方式",
            admin_fee_method: "管理费入账方式", store: "门店",
            registered_date: "注册日期", living_address: "居住地址",
            ktp_address: "KTP地址", same_as_ktp: "同KTP", different: "不同",
            add_customer: "新增客户", customer_list: "客户列表",
            operation: "业务操作", financial_indicators: "经营指标",
            fund_management: "资金管理", internal_transfer: "内部转账",
            cash_to_bank: "现金存入银行", bank_to_cash: "银行取现",
            submit_to_hq: "上缴总部", cash_flow_summary: "现金流汇总",
            total_cash: "总现金", net_profit: "现金净利", filter: "筛选",
            clear_filter: "重置", export: "导出", close: "关闭",
            search_description: "搜索描述...", all_types: "全部类型",
            from_date: "开始日期", to_date: "结束日期",
            fixed_repayment: "固定还款", flexible_repayment: "灵活还款",
            repayment_type: "还款方式", repayment_term: "还款期限（月）",
            monthly_payment: "每月还款额", agreed_rate: "协商利率",
            agreed_service_fee: "协商服务费", payment_due_date: "到期日",
            overdue_days: "逾期天数", liquidation_warning: "⚠️ 逾期30天将进入变卖程序",
            early_settlement: "提前结清", interest_rebate: "利息减免",
            remaining_term: "剩余期数", confirm_early_settlement: "确认提前结清",
            store_operation: "门店业务", save_failed: "保存失败",
            order_not_found: "订单不存在", unauthorized: "无权访问",
            order_locked: "订单已锁定", loan_already_disbursed: "贷款已发放",
            backup_complete: "✅ 备份完成！\n\n已导出 {orders} 条订单，{customers} 条客户记录。",
            restore_confirm: "⚠️ 恢复数据将覆盖当前所有数据！\n\n此操作不可撤销。\n\n建议先导出当前数据作为备份。\n\n确定要继续吗？",
            save_exit_confirm: "💾 确认保存并退出登录？\n\n系统将自动保存当前数据，然后退出。",
            login_required: "请重新登录", invalid_amount: "金额无效",
            payment_success: "支付成功", order_completed: "订单已结清",
            customer_has_active_order: "该客户还有未结清的订单。",
            blacklisted_cannot_order: "❌ 此客户已被拉黑，无法创建新订单。",
            interest_recorded: "利息 {amount} 已记录", principal_recorded: "还款 {amount} 已记录",
            fixed_installment_paid: "第{month}期还款成功！\n利息: {interest}\n本金: {principal}\n剩余期数: {remaining}个月",
            early_settlement_success: "✅ 提前结清成功！\n结清金额: {amount}",
            confirm_logout: "确定要退出登录吗？未保存的数据将丢失。",
            // 新增验证提示
            invalid_ktp: "KTP号码必须为16位数字",
            invalid_phone: "手机号无效（至少9位数字）"
        }
    },

    t: function(key) {
        if (!key || typeof key !== 'string') return '';
        const langTranslations = this.translations[this.lang];
        if (!langTranslations) return key;
        const text = langTranslations[key];
        if (text === undefined) {
            console.warn(`缺少翻译键: ${key}`);
            return key;
        }
        return text;
    },

    setLanguage: function(lang) {
        if (lang === 'id' || lang === 'zh') {
            this.lang = lang;
            localStorage.setItem('jf_language', lang);
        }
    },

    getLanguage: function() { return this.lang; },

    escapeHtml: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    escapeAttr: function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
            .replace(/`/g, '&#96;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    formatCurrency: function(amount) {
        var num = amount || 0;
        try {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(num);
        } catch(e) {
            var formatted = Math.round(num).toLocaleString('id-ID');
            return 'Rp ' + formatted;
        }
    },

    getRawAmount: function(amount) { return amount || 0; },

    formatDate: function(dateStr) {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString(this.lang === 'id' ? 'id-ID' : 'zh-CN');
        } catch(e) {
            return '-';
        }
    },

    exportToJSON: function(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this._downloadBlob(blob, filename);
    },

    _downloadBlob: function(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    _buildAndDownloadCSV: function(headers, rows, filename) {
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        this._downloadBlob(blob, filename);
    },

    exportToCSV: function(orders, filename) {
        const isId = this.lang === 'id';
        const headers = isId
            ? ['ID Pesanan', 'Pelanggan', 'Pinjaman', 'Admin Fee', 'Service Fee', 'Bunga Bulanan', 'Status', 'Tanggal Dibuat']
            : ['订单ID', '客户', '贷款金额', '管理费', '服务费', '月利息', '状态', '创建日期'];
        const rows = orders.map(o => [
            o.order_id, o.customer_name,
            this.getRawAmount(o.loan_amount), this.getRawAmount(o.admin_fee),
            this.getRawAmount(o.service_fee_amount || 0), this.getRawAmount(o.monthly_interest),
            o.status, this.formatDate(o.created_at)
        ]);
        this._buildAndDownloadCSV(headers, rows, filename);
    },

    exportPaymentsToCSV: function(payments, filename) {
        const isId = this.lang === 'id';
        const headers = isId
            ? ['ID Pesanan', 'Pelanggan', 'Tanggal', 'Jenis', 'Bulan', 'Jumlah', 'Metode', 'Keterangan']
            : ['订单ID', '客户', '日期', '类型', '月数', '金额', '支付方式', '说明'];
        const typeMap = {
            admin_fee:   isId ? 'Admin Fee'  : '管理费',
            service_fee: isId ? 'Service Fee': '服务费',
            interest:    isId ? 'Bunga'      : '利息',
            principal:   isId ? 'Pokok'      : '本金'
        };
        const methodMap = {
            cash: isId ? 'Brankas'  : '保险柜',
            bank: isId ? 'Bank BNI' : '银行BNI'
        };
        const rows = payments.map(p => [
            p.orders?.order_id || '-', p.orders?.customer_name || '-',
            p.date, typeMap[p.type] || p.type,
            p.months || '-', this.getRawAmount(p.amount),
            methodMap[p.payment_method] || '-', p.description || '-'
        ]);
        this._buildAndDownloadCSV(headers, rows, filename);
    },

    exportCashFlowToCSV: function(flows, filename) {
        const isId = this.lang === 'id';
        const headers = isId
            ? ['Tanggal', 'Tipe', 'Metode', 'Arah', 'Jumlah', 'Keterangan', 'ID Pesanan']
            : ['日期', '类型', '方式', '方向', '金额', '说明', '订单号'];
        const typeMap = {
            loan_disbursement: isId ? 'Pencairan Pinjaman' : '贷款发放',
            admin_fee:         isId ? 'Admin Fee'          : '管理费',
            service_fee:       isId ? 'Service Fee'        : '服务费',
            interest:          isId ? 'Bunga'              : '利息',
            principal:         isId ? 'Pokok'              : '本金',
            expense:           isId ? 'Pengeluaran'        : '运营支出'
        };
        const rows = flows.map(f => [
            this.formatDate(f.recorded_at),
            typeMap[f.flow_type] || f.flow_type,
            f.source_target === 'cash' ? (isId ? 'Brankas' : '保险柜') : (isId ? 'Bank' : '银行'),
            f.direction === 'inflow'   ? (isId ? 'Masuk'   : '流入')   : (isId ? 'Keluar' : '流出'),
            this.getRawAmount(f.amount),
            f.description || '-',
            f.orders?.order_id || '-'
        ]);
        this._buildAndDownloadCSV(headers, rows, filename);
    },

    importFromJSON: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try { resolve(JSON.parse(e.target.result)); }
                catch { reject('Invalid JSON file'); }
            };
            reader.onerror = () => reject('Error reading file');
            reader.readAsText(file);
        });
    },

    formatNumberWithCommas: function(x) {
        if (x === null || x === undefined || x === '') return '';
        const num = String(x).replace(/[,\s]/g, '');
        if (isNaN(num) || num === '') return '';
        return Number(num).toLocaleString('en-US');
    },

    parseNumberFromCommas: function(x) {
        if (!x) return 0;
        return parseInt(String(x).replace(/[,\s]/g, '')) || 0;
    },

    bindAmountFormat: function(inputElement) {
        if (!inputElement) return;
        inputElement.addEventListener('input', (e) => {
            const num = Utils.parseNumberFromCommas(e.target.value);
            if (!isNaN(num) && num !== '') {
                e.target.value = Utils.formatNumberWithCommas(num);
            }
        });
    },

    // ========== 新增验证函数 ==========
    validateKTP: function(ktp) {
        if (!ktp) return true; // 允许为空
        const cleaned = String(ktp).replace(/\s/g, '');
        return /^\d{16}$/.test(cleaned);
    },

    validatePhone: function(phone) {
        if (!phone) return false;
        const cleaned = String(phone).replace(/\D/g, '');
        return cleaned.length >= 9 && cleaned.length <= 15;
    },

    // ========== 订单金额预览辅助（返回预览HTML片段） ==========
    getOrderPreviewHtml: function(loanAmount, interestPercent, servicePercent) {
        const amount = loanAmount || 0;
        const monthlyInterest = amount * (interestPercent / 100);
        const serviceFee = amount * (servicePercent / 100);
        const adminFee = 30000;
        const lang = this.lang;
        return `<div class="preview-box" style="background:var(--primary-soft); padding:12px; border-radius:12px; margin:12px 0; display:flex; flex-wrap:wrap; gap:16px; justify-content:space-between;">
                    <span><strong>💰 ${lang==='id'?'Bunga bulanan':'月利息'}:</strong> ${this.formatCurrency(monthlyInterest)} (${interestPercent}%)</span>
                    <span><strong>📋 ${lang==='id'?'Admin Fee':'管理费'}:</strong> ${this.formatCurrency(adminFee)}</span>
                    <span><strong>✨ ${lang==='id'?'Service Fee':'服务费'}:</strong> ${this.formatCurrency(serviceFee)} (${servicePercent}%)</span>
                </div>`;
    },

    renderPageHeader: function(title, showBackBtn = true) {
        const backBtnHtml = showBackBtn && window.APP && typeof window.APP.goBack === 'function'
            ? `<button onclick="APP.goBack()">↩️ ${this.t('back')}</button>` : '';
        return `<div class="page-header"><h2>${title}</h2><div>${backBtnHtml}</div></div>`;
    },

    wrapTableRow: function(cells, isHeader = false) {
        const tag = isHeader ? 'th' : 'td';
        return '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>';
    },

    getServiceFeeOptionsHtml: function(selectedPercent = 0) {
        return this.serviceFeePercentOptions.map(opt =>
            `<option value="${opt.value}" ${selectedPercent === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');
    }
};

// 初始化语言
Utils.initLanguage();
window.Utils = Utils;
