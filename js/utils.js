// utils.js - v1.3 (最终版)
// 管理费：阶梯定价
//   ≤ 500,000 → Rp 20,000
//   500,001 ~ 3,000,000 → Rp 30,000
//   > 3,000,000 → 1%，上不封顶
// 服务费：默认2%，下拉 0-5%
// 利率：默认8%，下拉 6-10%

window.Utils = window.Utils || {};

(function() {
    'use strict';

    // ==================== 常量 ====================
    Utils.DEFAULT_AGREED_INTEREST_RATE = 0.08;
    Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT = 8;
    Utils.DEFAULT_MAX_EXTENSION_MONTHS = 10;
    Utils.CURRENCY_SYMBOL = 'Rp';
    Utils.JAKARTA_UTC_OFFSET = 7 * 60;

    // ==================== 语言初始化 ====================
    var getInitialLang = function() {
        var stored = localStorage.getItem('jf_lang');
        if (stored === 'id' || stored === 'zh') return stored;
        try {
            var browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
            if (browserLang.startsWith('id')) return 'id';
        } catch(e) {}
        return 'zh';
    };
    
    var _lang = getInitialLang();
    var _translations = {};
    var _listeners = {};

    // ==================== 雅加达时间（UTC+7） ====================
    Utils._getJakartaDate = function() {
        var now = new Date();
        var utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        var jakartaMs = utcMs + (7 * 3600000);
        return new Date(jakartaMs);
    };

    Utils.getLocalToday = function() {
        var d = Utils._getJakartaDate();
        return d.getUTCFullYear() + '-' +
               String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
               String(d.getUTCDate()).padStart(2, '0');
    };

    Utils.getLocalDateTime = function() {
        var d = Utils._getJakartaDate();
        return d.getUTCFullYear() + '-' +
               String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
               String(d.getUTCDate()).padStart(2, '0') + 'T' +
               String(d.getUTCHours()).padStart(2, '0') + ':' +
               String(d.getUTCMinutes()).padStart(2, '0') + ':' +
               String(d.getUTCSeconds()).padStart(2, '0') + '.000+07:00';
    };

    Utils.toLocalDate = function(dateInput) {
        if (!dateInput) return Utils.getLocalToday();
        var date;
        if (typeof dateInput === 'string') {
            if (dateInput.includes('T')) {
                var parts = dateInput.split('T')[0].split('-');
                if (parts.length === 3) return parts[0] + '-' + parts[1] + '-' + parts[2];
            }
            date = new Date(dateInput);
        } else {
            date = dateInput;
        }
        if (isNaN(date.getTime())) {
            console.warn('Utils.toLocalDate: 无效日期', dateInput);
            return Utils.getLocalToday();
        }
        var utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
        var jakartaMs = utcMs + (7 * 3600000);
        var jakartaDate = new Date(jakartaMs);
        return jakartaDate.getUTCFullYear() + '-' +
               String(jakartaDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
               String(jakartaDate.getUTCDate()).padStart(2, '0');
    };

    Utils.formatDate = function(dateStr) {
        if (!dateStr) return '-';
        var localDate = Utils.toLocalDate(dateStr);
        if (localDate === '-') return '-';
        var parts = localDate.split('-');
        if (parts.length !== 3) return dateStr;
        if (Utils.lang === 'id') return parts[2] + '/' + parts[1] + '/' + parts[0];
        return parts[0] + '-' + parts[1] + '-' + parts[2];
    };

    Utils.calculateNextDueDate = function(startDate, paidMonths) {
        var start = startDate || Utils.getLocalToday();
        var parts = start.split('-');
        if (parts.length !== 3) {
            start = Utils.getLocalToday();
            parts = start.split('-');
        }
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        var totalMonths = month + paidMonths + 1;
        var newYear = year + Math.floor(totalMonths / 12);
        var newMonth = totalMonths % 12;
        var daysInNewMonth = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
        var newDay = Math.min(day, daysInNewMonth);
        return newYear + '-' + String(newMonth + 1).padStart(2, '0') + '-' + String(newDay).padStart(2, '0');
    };

    // ==================== Toast ====================
    Utils.toast = {
        success: function(msg, duration) { if (window.Toast) window.Toast.success(msg, duration); else alert(msg); },
        error: function(msg, duration) { if (window.Toast) window.Toast.error(msg, duration); else alert(msg); },
        warning: function(msg, duration) { if (window.Toast) window.Toast.warning(msg, duration); else alert(msg); },
        info: function(msg, duration) { if (window.Toast) window.Toast.info(msg, duration); else alert(msg); },
        confirm: async function(msg, title) {
            if (window.Toast && window.Toast.confirmPromise) return await window.Toast.confirmPromise(msg, title);
            return Promise.resolve(confirm(msg));
        }
    };

    // ==================== 语言管理 ====================
    Object.defineProperty(Utils, 'lang', {
        get: function() { return _lang; },
        enumerable: true, configurable: false
    });

    Utils.forceSyncLanguage = function() {
        var newLang = localStorage.getItem('jf_lang');
        if (newLang === 'id' || newLang === 'zh') _lang = newLang;
        return _lang;
    };

    Utils.t = function(key) {
        if (!_translations[_lang]) return key;
        return _translations[_lang][key] || key;
    };

    // ==================== 货币工具 ====================
    Utils.formatCurrency = function(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
        var num = Math.round(amount);
        var neg = num < 0;
        var abs = Math.abs(num);
        var parts = abs.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (neg ? '-Rp ' : 'Rp ') + parts.join(',');
    };

    Utils.formatNumberWithCommas = function(num) {
        if (num === null || num === undefined) return '0';
        var n = parseInt(num, 10);
        if (isNaN(n)) return '0';
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };

    Utils.parseNumberFromCommas = function(str) {
        if (!str) return 0;
        var cleaned = String(str).replace(/[^\d\-]/g, '');
        var num = parseInt(cleaned, 10);
        return isNaN(num) ? 0 : num;
    };

    // ==================== 金额输入绑定 ====================
    Utils.bindAmountFormat = function(inputEl) {
        if (!inputEl) return;
        inputEl.addEventListener('input', function(e) {
            var cursorPos = inputEl.selectionStart;
            var rawValue = inputEl.value.replace(/[^\d]/g, '');
            var formattedValue = Utils.formatNumberWithCommas(rawValue);
            var oldLength = inputEl.value.length;
            inputEl.value = formattedValue;
            var newLength = inputEl.value.length;
            var newCursorPos = cursorPos + (newLength - oldLength);
            if (newCursorPos < 0) newCursorPos = 0;
            if (newCursorPos > newLength) newCursorPos = newLength;
            inputEl.setSelectionRange(newCursorPos, newCursorPos);
        });
        var initialRaw = inputEl.value.replace(/[^\d]/g, '');
        if (initialRaw) inputEl.value = Utils.formatNumberWithCommas(initialRaw);
    };

    // ==================== XSS 防护 ====================
    Utils.escapeHtml = function(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    };

    Utils.escapeAttr = function(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    // ==================== 验证工具 ====================
    Utils.isValidEmail = function(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); };
    Utils.isValidPhone = function(phone) { return /^\+?[\d\s\-()]{6,20}$/.test(phone); };
    Utils.isValidKtp = function(ktp) { return /^\d{16}$/.test(ktp); };

    // ======================================================================
    // 费用计算 — 核心业务逻辑
    // ======================================================================

    /**
     * 管理费 — 阶梯定价
     *
     * 当金金额 ≤ Rp 500,000              → Rp 20,000
     * Rp 500,000 < 当金 ≤ Rp 3,000,000   → Rp 30,000
     * 当金 > Rp 3,000,000                → 当金 × 1%，上不封顶
     *
     * @param {number} loanAmount - 当金金额
     * @returns {number} 管理费
     */
    Utils.calculateAdminFee = function(loanAmount) {
        if (!loanAmount || loanAmount <= 0) return 0;

        if (loanAmount <= 500000) {
            return 20000;
        }

        if (loanAmount <= 3000000) {
            return 30000;
        }

        // > 3,000,000 → 1%，上不封顶
        return Math.round(loanAmount * 0.01);
    };

    /**
     * 服务费 — 默认当金金额的 2%
     *
     * @param {number} loanAmount - 当金金额
     * @param {number} percent - 服务费率（0-5）
     * @returns {{ percent: number, amount: number }}
     */
    Utils.calculateServiceFee = function(loanAmount, percent) {
        if (percent === undefined) percent = 2;
        if (!loanAmount || loanAmount <= 0) return { percent: percent, amount: 0 };
        var amount = Math.round(loanAmount * percent / 100);
        return { percent: percent, amount: amount };
    };

    // 兼容旧接口
    Utils.calculateServiceFeeNew = function(loanAmount) {
        return Utils.calculateServiceFee(loanAmount, 2);
    };

    /**
     * 固定还款 — 每月金额（等额本息公式）
     */
    Utils.calculateFixedMonthlyPayment = function(loanAmount, monthlyRate, months) {
        if (!loanAmount || !months || months <= 0) return 0;
        if (monthlyRate <= 0) return loanAmount / months;
        var pow = Math.pow(1 + monthlyRate, months);
        return (loanAmount * monthlyRate * pow) / (pow - 1);
    };

    /**
     * 取整 — 向上取整到万位
     */
    Utils.roundMonthlyPayment = function(amount) {
        return Math.ceil(amount / 10000) * 10000;
    };

    // ======================================================================
    // 下拉选项生成
    // ======================================================================

    /**
     * 利率选项：10%, 9%, 8%, 7%, 6%（默认 8%）
     */
    Utils.getInterestRateOptions = function(defaultRate) {
        if (defaultRate === undefined) defaultRate = 8;
        var rates = [10, 9, 8, 7, 6];
        var html = '';
        for (var i = 0; i < rates.length; i++) {
            var selected = rates[i] === defaultRate ? ' selected' : '';
            html += '<option value="' + rates[i] + '"' + selected + '>' + rates[i] + '%</option>';
        }
        return html;
    };

    /**
     * 服务费率选项：0%, 1%, 2%, 3%, 4%, 5%（默认 2%）
     */
    Utils.getServiceFeePercentOptions = function(defaultPercent) {
        if (defaultPercent === undefined) defaultPercent = 2;
        var options = [0, 1, 2, 3, 4, 5];
        var html = '';
        for (var i = 0; i < options.length; i++) {
            var selected = options[i] === defaultPercent ? ' selected' : '';
            html += '<option value="' + options[i] + '"' + selected + '>' + options[i] + '%</option>';
        }
        return html;
    };

    /**
     * 还款期限选项：1-10 个月（默认 5 个月）
     */
    Utils.getRepaymentTermOptions = function(defaultMonths) {
        if (defaultMonths === undefined) defaultMonths = 5;
        var html = '';
        var lang = Utils.lang;
        for (var i = 1; i <= 10; i++) {
            var selected = i === defaultMonths ? ' selected' : '';
            html += '<option value="' + i + '"' + selected + '>' + i + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</option>';
        }
        return html;
    };

    // ==================== CSV / JSON 导出 ====================
    Utils.exportToJSON = function(data, filename) {
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    Utils.importFromJSON = function(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try { resolve(JSON.parse(e.target.result)); }
                catch(err) { reject(new Error('格式无效')); }
            };
            reader.onerror = function() { reject(new Error('读取失败')); };
            reader.readAsText(file);
        });
    };

    Utils.exportToCSV = function(data, filename) {
        if (!data || data.length === 0) return;
        var headers = Object.keys(data[0]);
        var rows = data.map(function(row) {
            return headers.map(function(h) {
                var val = row[h];
                if (val === null || val === undefined) val = '';
                return '"' + String(val).replace(/"/g, '""') + '"';
            }).join(',');
        });
        var csv = '\uFEFF' + [headers.join(',')].concat(rows).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    // ==================== 密码切换 ====================
    Utils.togglePasswordVisibility = function(inputId, toggleEl) {
        var input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') { input.type = 'text'; if (toggleEl) toggleEl.textContent = '🙈'; }
        else { input.type = 'password'; if (toggleEl) toggleEl.textContent = '👁️'; }
    };

    // ==================== 骨架屏 ====================
    Utils.renderSkeleton = function(type) {
        var map = {
            'dashboard': '<div class="card" style="padding:20px;"><div class="skeleton" style="height:20px;width:60%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">' + Array(8).fill('<div class="skeleton" style="height:80px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite;"></div>').join('') + '</div></div>',
            'table': '<div class="card" style="padding:20px;"><div class="skeleton" style="height:20px;width:40%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' + Array(8).fill('<div class="skeleton" style="height:40px;margin-bottom:8px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>').join('') + '</div>',
            'detail': '<div class="card" style="padding:20px;"><div class="skeleton" style="height:20px;width:50%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' + Array(6).fill('<div class="skeleton" style="height:16px;width:70%;margin-bottom:12px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>').join('') + '</div>',
            'default': '<div class="card" style="padding:20px;"><div class="skeleton" style="height:20px;width:50%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' + Array(4).fill('<div class="skeleton" style="height:40px;margin-bottom:8px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>').join('') + '</div>'
        };
        var html = map[type] || map['default'];
        if (!document.getElementById('skeletonStyle')) {
            var s = document.createElement('style');
            s.id = 'skeletonStyle';
            s.textContent = '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}';
            document.head.appendChild(s);
        }
        return html;
    };

    // ==================== 错误上报 ====================
    Utils.ErrorHandler = {
        _errors: [], _maxErrors: 50,
        init: function() {
            var self = this;
            window.addEventListener('error', function(e) { self.capture(e.error || e.message, 'uncaught'); });
            window.addEventListener('unhandledrejection', function(e) { self.capture(e.reason, 'unhandled_promise'); });
        },
        capture: function(error, context) {
            if (!error) return;
            var entry = { message: error.message || String(error), stack: error.stack || '', context: context || 'unknown', timestamp: new Date().toISOString() };
            this._errors.unshift(entry);
            if (this._errors.length > this._maxErrors) this._errors.pop();
            console.error('[ErrorHandler]', context + ':', entry.message);
        }
    };

    // ==================== 翻译字典 ====================
    Utils.initLanguage = function() {
        _lang = getInitialLang();
        _translations = {
            'id': {
                'login': 'Masuk', 'password': 'Kata Sandi', 'save': 'Simpan', 'cancel': 'Batal',
                'delete': 'Hapus', 'edit': 'Ubah', 'back': 'Kembali', 'print': 'Cetak', 'view': 'Lihat',
                'search': 'Cari', 'export': 'Ekspor', 'confirm_delete': 'Yakin ingin menghapus?',
                'no_data': 'Tidak ada data', 'loading': 'Memuat...', 'save_failed': 'Gagal menyimpan',
                'save_success': 'Berhasil disimpan', 'order_not_found': 'Pesanan tidak ditemukan',
                'unauthorized': 'Akses ditolak', 'invalid_amount': 'Jumlah tidak valid',
                'store_operation': 'Operasi ini hanya untuk operator toko', 'action': 'Aksi',
                'status': 'Status', 'status_active': 'Aktif', 'status_completed': 'Lunas', 'status_liquidated': 'Likuidasi',
                'date': 'Tanggal', 'amount': 'Jumlah', 'type': 'Tipe', 'description': 'Deskripsi', 'notes': 'Catatan',
                'total_orders': 'Total Pesanan', 'active': 'Aktif', 'completed': 'Lunas', 'total_loan': 'Total Pinjaman',
                'loan_amount': 'Jumlah Pinjaman',
                'admin_fee': 'Biaya Admin',
                'service_fee': 'Biaya Layanan',
                'interest': 'Bunga', 'principal': 'Pokok',
                'pay_interest': 'Bayar Bunga', 'return_principal': 'Kembalikan Pokok',
                'payment_due_date': 'Jatuh Tempo', 'agreed_rate': 'Suku Bunga',
                'customer_name': 'Nama Nasabah', 'customer_info': 'Info Nasabah',
                'collateral_name': 'Nama Jaminan', 'collateral_info': 'Info Jaminan',
                'phone': 'Telepon', 'ktp_number': 'No. KTP', 'address': 'Alamat',
                'order_id': 'ID Pesanan', 'order_list': 'Manajemen Pesanan', 'order_details': 'Detail Pesanan',
                'create_order': 'Buat Pesanan', 'payment_history': 'Arus Kas',
                'fund_management': 'Manajemen Dana', 'internal_transfer': 'Transfer Internal',
                'cash_to_bank': 'Brankas→🏧 Bank BNI', 'bank_to_cash': '🏧 Bank BNI→🏦 Brankas',
                'submit_to_hq': 'Setor ke Pusat',
                'cash': 'Kas', 'bank': 'Bank', 'inflow': 'Masuk', 'outflow': 'Keluar',
                'expenses': 'Pengeluaran', 'customers': 'Nasabah',
                'user_management': 'Manajemen Pengguna', 'store_management': 'Manajemen Toko', 'store': 'Toko',
                'backup_restore': 'Cadangan & Pulihkan', 'save_exit': 'Simpan & Keluar',
                'save_exit_confirm': 'Simpan perubahan dan keluar?',
                'send_reminder': 'Kirim Pengingat',
                'repayment_type': 'Jenis Cicilan', 'flexible_repayment': 'Cicilan Fleksibel', 'fixed_repayment': 'Cicilan Tetap',
                'monthly_payment': 'Angsuran Bulanan', 'remaining_term': 'Sisa Jangka Waktu', 'early_settlement': 'Pelunasan Dipercepat',
                'fill_all_fields': 'Harap isi semua bidang',
                'loan_already_disbursed': 'Pinjaman sudah dicairkan',
                'order_completed': 'Pesanan sudah lunas',
                'order_locked': 'Pesanan terkunci',
                'more_pawn_higher_fee': 'Semakin besar gadai, semakin besar biaya admin',
                'order_saved_locked': 'Order tersimpan otomatis terkunci',
                'contract_pay_info': 'Bayar bunga sebelum tanggal jatuh tempo',
                'admin_fee_auto': 'Dihitung otomatis berdasarkan jumlah gadai',
                'interest_rate_select': 'Suku Bunga (Pilih)',
                'fee_details': 'Rincian Biaya',
                'loan_source': 'Sumber Dana',
                'collateral_note': 'Keterangan Barang',
                'fee_payment_method': 'Metode Pemasukan',
                'fee_payment_hint': 'Admin Fee & Service Fee akan dicatat bersama',
                'repayment_method': 'Metode Cicilan',
                'flexible_desc': 'Bayar bunga dulu, pokok bisa kapan saja',
                'fixed_desc': 'Angsuran tetap per bulan (bunga + pokok)',
                'max_tenor': 'Maksimal 10 bulan',
                'max_extension': 'Maksimal Perpanjangan',
                'extension_limit': 'Batas maksimal perpanjangan bunga sebelum harus lunasi pokok',
                'term_months': 'Jangka Waktu',
                'monthly_payment_rounded': 'Dibulatkan ke Rp 10.000, bisa disesuaikan',
                'customer_id': 'ID Nasabah', 'occupation': 'Pekerjaan',
                'add_customer': 'Tambah Nasabah Baru', 'save_customer': 'Simpan Nasabah',
                'ktp_address': 'Alamat KTP', 'living_address': 'Alamat Tinggal',
                'same_as_ktp': 'Sama dengan KTP', 'different_from_ktp': 'Berbeda (isi manual)',
                'customer_detail': 'Detail Nasabah', 'registered_date': 'Tanggal Daftar',
                'order_stats': 'Statistik Pesanan', 'active_orders': 'Berjalan', 'completed_orders': 'Lunas', 'abnormal_orders': 'Abnormal',
                'blacklist_customer': 'Blacklist', 'unblacklist_customer': 'Buka Blacklist',
                'edit_customer': 'Edit Nasabah', 'customer_orders': 'Order Nasabah', 'create_order_for': 'Buat Pesanan',
                'blacklist_page_title': 'Daftar Hitam Nasabah', 'blacklist_title': 'Daftar Hitam Nasabah',
                'dashboard_title': 'Dashboard', 'welcome': 'Selamat datang', 'net_profit': 'Laba Bersih',
                'manage_orders': 'Kelola semua pesanan', 'manage_customers': 'Data nasabah',
                'manage_expenses': 'Pengeluaran operasional', 'view_cashflow': 'Riwayat arus kas',
                'view_transactions': 'Lihat transaksi kas', 'abnormal_status': 'Pesanan terlambat & blacklist',
                'manage_users': 'Kelola pengguna', 'manage_stores': 'Kelola toko',
                'backup_restore_data': 'Cadangkan & pulihkan', 'manage_blacklist': 'Kelola blacklist', 'view_blacklist': 'Lihat blacklist',
                'total_expenses': 'Total Pengeluaran', 'expense_list': 'Daftar Pengeluaran', 'add_expense': 'Tambah Pengeluaran Baru',
                'pay_fee': 'Bayar Biaya', 'payment_page': 'Pembayaran', 'confirm_payment': 'Konfirmasi Pembayaran',
                'interest_history': 'Riwayat Pembayaran Bunga', 'principal_history': 'Riwayat Pengembalian Pokok',
                'principal_paid': 'Pokok Dibayar', 'remaining_principal': 'Sisa Pokok', 'payment_amount': 'Jumlah Pembayaran',
                'recording_method': 'Metode Pencatatan', 'pay_this_month': 'Bayar Angsuran Bulan Ini',
                'progress': 'Progress', 'this_month': 'Bulan ini',
                'overdue_warning_days': 'Terlambat {days} hari', 'enter_liquidation_warning': 'Akan memasuki proses likuidasi!',
                'each_installment_includes': 'Setiap angsuran mencakup bunga dan pokok. Pelunasan dipercepat dapat mengurangi sisa bunga.',
                'tip_pay_on_time': 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pembayaran pokok lebih awal dapat mengurangi beban bunga.',
                'settlement_receipt': 'Tanda Terima Pelunasan',
                'print_receipt_confirm': 'Cetak tanda terima pelunasan?',
                'user_list': 'Daftar Peran', 'add_user': 'Tambah Peran Baru', 'login_account': 'Akun Login (Email)',
                'full_name': 'Nama Lengkap', 'role': 'Role', 'reset_password': 'Reset Password',
                'select_store': 'Pilih toko', 'headquarters': 'Kantor Pusat',
                'store_list': 'Daftar Toko', 'add_store': 'Tambah Toko Baru', 'store_code': 'Kode Toko',
                'store_name': 'Nama Toko', 'store_address': 'Alamat', 'store_phone': 'Telepon', 'store_wa': 'Nomor WhatsApp',
                'suspend_store': 'Tutup Sementara', 'resume_store': 'Buka Kembali',
                'store_summary': 'Ringkasan Keuangan Toko', 'cashflow_summary': 'Ringkasan Arus Kas',
                'total_all_stores': 'Total Semua Toko',
                'backup_data': 'Cadangkan Data', 'backup_now': 'Cadangkan Sekarang',
                'restore_data': 'Pemulihan Data', 'audit_log': 'Log Audit',
                'export_orders': 'Ekspor Pesanan', 'export_payments': 'Ekspor Pembayaran', 'export_customers': 'Ekspor Nasabah',
                'export_cashflow': 'Ekspor Arus Kas', 'export_expenses': 'Ekspor Pengeluaran',
                'select_backup_file': 'Pilih File Cadangan', 'no_file_selected': 'Tidak ada file dipilih',
                'close': 'Tutup', 'detail': 'Detail', 'total': 'Total', 'month': 'bulan', 'months': 'bulan',
                'payment_method': 'Metode Pembayaran',
                'operation': 'Pusat Manajemen', 'financial_indicators': 'Indikator Bisnis',
                'overdue_30_days': 'Pesanan Terlambat 30+ Hari', 'anomaly_title': 'Situasi Abnormal',
                'overdue_days': 'Hari Terlambat',
            },
            'zh': {
                'login': '登录', 'password': '密码', 'save': '保存', 'cancel': '取消',
                'delete': '删除', 'edit': '修改', 'back': '返回', 'print': '打印', 'view': '查看',
                'search': '搜索', 'export': '导出', 'confirm_delete': '确认删除？',
                'no_data': '暂无数据', 'loading': '加载中...', 'save_failed': '保存失败',
                'save_success': '保存成功', 'order_not_found': '订单未找到',
                'unauthorized': '无权限访问', 'invalid_amount': '金额无效',
                'store_operation': '此操作仅限门店操作员', 'action': '操作',
                'status': '状态', 'status_active': '进行中', 'status_completed': '已结清', 'status_liquidated': '已变卖',
                'date': '日期', 'amount': '金额', 'type': '类型', 'description': '描述', 'notes': '备注',
                'total_orders': '总订单', 'active': '进行中', 'completed': '已结清', 'total_loan': '总贷款',
                'loan_amount': '贷款金额',
                'admin_fee': '管理费',
                'service_fee': '服务费',
                'interest': '利息', 'principal': '本金',
                'pay_interest': '缴纳利息', 'return_principal': '返还本金',
                'payment_due_date': '到期日', 'agreed_rate': '约定利率',
                'customer_name': '客户姓名', 'customer_info': '客户信息',
                'collateral_name': '质押物名称', 'collateral_info': '质押物信息',
                'phone': '电话', 'ktp_number': '身份证号', 'address': '地址',
                'order_id': '订单号', 'order_list': '订单管理', 'order_details': '订单详情',
                'create_order': '创建订单', 'payment_history': '资金流水',
                'fund_management': '资金管理', 'internal_transfer': '内部转账',
                'cash_to_bank': '保险柜→🏧 银行BNI', 'bank_to_cash': '🏧 银行BNI→🏦 保险柜',
                'submit_to_hq': '上缴总部',
                'cash': '现金', 'bank': '银行', 'inflow': '流入', 'outflow': '流出',
                'expenses': '运营支出', 'customers': '客户管理',
                'user_management': '用户管理', 'store_management': '门店管理', 'store': '门店',
                'backup_restore': '备份恢复', 'save_exit': '保存退出',
                'save_exit_confirm': '保存更改并退出？',
                'send_reminder': '发送提醒',
                'repayment_type': '还款方式', 'flexible_repayment': '灵活还款', 'fixed_repayment': '固定还款',
                'monthly_payment': '每月还款', 'remaining_term': '剩余期限', 'early_settlement': '提前结清',
                'fill_all_fields': '请填写所有字段',
                'loan_already_disbursed': '贷款已发放',
                'order_completed': '订单已结清',
                'order_locked': '订单已锁定',
                'more_pawn_higher_fee': '典当金额越大，管理费越高',
                'order_saved_locked': '订单保存后自动锁定',
                'contract_pay_info': '请在到期日前支付利息',
                'admin_fee_auto': '根据当金金额自动计算',
                'interest_rate_select': '利率（可选）',
                'fee_details': '费用明细',
                'loan_source': '资金来源',
                'collateral_note': '物品备注',
                'fee_payment_method': '入账方式',
                'fee_payment_hint': '管理费和服务费将一起入账',
                'repayment_method': '还款方式',
                'flexible_desc': '先付利息，本金随时可还',
                'fixed_desc': '每月固定还款（本金+利息）',
                'max_tenor': '最长10个月',
                'max_extension': '最大展期',
                'extension_limit': '利息延期上限，超出后须结清本金',
                'term_months': '还款期限',
                'monthly_payment_rounded': '取整到Rp 10,000，可手动调整',
                'customer_id': '客户ID', 'occupation': '职业',
                'add_customer': '新增客户', 'save_customer': '保存客户',
                'ktp_address': 'KTP地址', 'living_address': '居住地址',
                'same_as_ktp': '同上KTP', 'different_from_ktp': '不同（手动填写）',
                'customer_detail': '客户详情', 'registered_date': '注册日期',
                'order_stats': '订单统计', 'active_orders': '进行中', 'completed_orders': '已结清', 'abnormal_orders': '异常订单',
                'blacklist_customer': '拉黑', 'unblacklist_customer': '解除拉黑',
                'edit_customer': '编辑客户', 'customer_orders': '客户订单', 'create_order_for': '创建订单',
                'blacklist_page_title': '客户黑名单', 'blacklist_title': '客户黑名单',
                'dashboard_title': '仪表盘', 'welcome': '欢迎', 'net_profit': '净利润',
                'manage_orders': '管理所有订单', 'manage_customers': '客户信息管理',
                'manage_expenses': '运营支出管理', 'view_cashflow': '资金流水记录',
                'view_transactions': '查看现金交易记录', 'abnormal_status': '逾期订单和黑名单',
                'manage_users': '用户管理', 'manage_stores': '门店管理',
                'backup_restore_data': '备份与恢复', 'manage_blacklist': '黑名单管理', 'view_blacklist': '查看黑名单',
                'total_expenses': '支出总额', 'expense_list': '支出列表', 'add_expense': '新增运营支出',
                'pay_fee': '缴纳费用', 'payment_page': '缴费', 'confirm_payment': '确认收款',
                'interest_history': '利息缴费历史', 'principal_history': '本金返还历史',
                'principal_paid': '已还本金', 'remaining_principal': '剩余本金', 'payment_amount': '还款金额',
                'recording_method': '入账方式', 'pay_this_month': '支付本月还款',
                'progress': '进度', 'this_month': '本月新增',
                'overdue_warning_days': '逾期 {days} 天', 'enter_liquidation_warning': '将进入变卖程序！',
                'each_installment_includes': '每期还款包含本金和利息，提前结清可减免剩余利息',
                'tip_pay_on_time': '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担。',
                'settlement_receipt': '结清凭证',
                'print_receipt_confirm': '是否打印结清凭证？',
                'user_list': '角色列表', 'add_user': '新增角色', 'login_account': '登录账户（邮箱）',
                'full_name': '姓名', 'role': '角色', 'reset_password': '重置密码',
                'select_store': '选择门店', 'headquarters': '总部',
                'store_list': '门店列表', 'add_store': '新增门店', 'store_code': '门店编码',
                'store_name': '门店名称', 'store_address': '地址', 'store_phone': '电话', 'store_wa': 'WhatsApp 号码',
                'suspend_store': '暂停营业', 'resume_store': '恢复营业',
                'store_summary': '门店财务汇总', 'cashflow_summary': '现金流汇总',
                'total_all_stores': '全部门店合计',
                'backup_data': '备份数据', 'backup_now': '立即备份',
                'restore_data': '恢复数据', 'audit_log': '审计日志',
                'export_orders': '导出订单', 'export_payments': '导出缴费', 'export_customers': '导出客户',
                'export_cashflow': '导出资金流水', 'export_expenses': '导出运营支出',
                'select_backup_file': '选择备份文件', 'no_file_selected': '未选择文件',
                'close': '关闭', 'detail': '详情', 'total': '总计', 'month': '个月', 'months': '个月',
                'payment_method': '支付方式',
                'operation': '管理中心', 'financial_indicators': '业务指标',
                'overdue_30_days': '逾期30天以上订单', 'anomaly_title': '异常状况',
                'overdue_days': '逾期天数',
            }
        };
    };

    // ==================== 初始化 ====================
    Utils.initLanguage();

    window.Utils = Utils;
})();
