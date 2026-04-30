// utils.js - v1.1 (修复时区Bug：统一使用印尼UTC+7时间)

window.Utils = window.Utils || {};

(function() {
    'use strict';

    // ==================== 语言初始化（强化版） ====================
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

    // ==================== 常量 ====================
    Utils.DEFAULT_AGREED_INTEREST_RATE = 0.08;
    Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT = 8;
    Utils.DEFAULT_MAX_EXTENSION_MONTHS = 10;
    Utils.CURRENCY_SYMBOL = 'Rp';
    Utils.ADMIN_FEE_RATE = 0.02;
    Utils.JAKARTA_UTC_OFFSET = 7 * 60; // UTC+7 偏移量（分钟）

    // ==================== 核心：获取印尼雅加达时间（UTC+7） ====================
    // 修复前：直接使用 new Date() 取本地时间，导致 UTC+8 地区 0:00-1:00 差一天
    // 修复后：统一计算 UTC+7 时间，确保印尼服务器/用户在任何时区都得到正确的"今天"
    
    Utils._getJakartaDate = function() {
        var now = new Date();
        // 获取 UTC 时间戳，加上 7 小时偏移得到雅加达时间
        var utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
        var jakartaMs = utcMs + (7 * 3600000); // UTC+7
        return new Date(jakartaMs);
    };

    // 获取雅加达今天的日期字符串 YYYY-MM-DD
    Utils.getLocalToday = function() {
        var d = Utils._getJakartaDate();
        var year = d.getUTCFullYear();
        var month = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    };

    // 获取雅加达当前日期时间字符串 YYYY-MM-DDTHH:mm:ss.000+07:00
    Utils.getLocalDateTime = function() {
        var d = Utils._getJakartaDate();
        var year = d.getUTCFullYear();
        var month = String(d.getUTCMonth() + 1).padStart(2, '0');
        var day = String(d.getUTCDate()).padStart(2, '0');
        var hours = String(d.getUTCHours()).padStart(2, '0');
        var minutes = String(d.getUTCMinutes()).padStart(2, '0');
        var seconds = String(d.getUTCSeconds()).padStart(2, '0');
        return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds + '.000+07:00';
    };

    // 将任意日期输入转换为雅加达日期字符串 YYYY-MM-DD
    Utils.toLocalDate = function(dateInput) {
        if (!dateInput) return Utils.getLocalToday();
        
        var date;
        if (typeof dateInput === 'string') {
            if (dateInput.includes('T')) {
                var parts = dateInput.split('T')[0].split('-');
                if (parts.length === 3) {
                    return parts[0] + '-' + parts[1] + '-' + parts[2];
                }
            }
            date = new Date(dateInput);
        } else {
            date = dateInput;
        }
        
        if (isNaN(date.getTime())) {
            console.warn('Utils.toLocalDate: 无效日期', dateInput);
            return Utils.getLocalToday();
        }
        
        // 转换为雅加达时间再取日期
        var utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
        var jakartaMs = utcMs + (7 * 3600000);
        var jakartaDate = new Date(jakartaMs);
        
        var year = jakartaDate.getUTCFullYear();
        var month = String(jakartaDate.getUTCMonth() + 1).padStart(2, '0');
        var day = String(jakartaDate.getUTCDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    };

    // 格式化日期为显示字符串
    Utils.formatDate = function(dateStr) {
        if (!dateStr) return '-';
        
        var localDate = Utils.toLocalDate(dateStr);
        if (localDate === '-') return '-';
        
        var parts = localDate.split('-');
        if (parts.length !== 3) return dateStr;
        
        var year = parts[0];
        var month = parts[1];
        var day = parts[2];
        
        if (Utils.lang === 'id') {
            return day + '/' + month + '/' + year;
        }
        return year + '-' + month + '-' + day;
    };

    // 计算下一个到期日（基于雅加达时间）
    Utils.calculateNextDueDate = function(startDate, paidMonths) {
        var start = startDate || Utils.getLocalToday();
        
        var parts = start.split('-');
        if (parts.length !== 3) {
            start = Utils.getLocalToday();
            parts = start.split('-');
        }
        
        // 使用 UTC 方法避免本地时区干扰，手动加月份
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1; // JS 月份从0开始
        var day = parseInt(parts[2], 10);
        
        // 目标月份 = 当前月份 + 已付月数 + 1（下个月到期）
        var totalMonths = month + paidMonths + 1;
        var newYear = year + Math.floor(totalMonths / 12);
        var newMonth = totalMonths % 12;
        
        // 处理月末日期边界（如1月31日 + 1个月 = 2月28/29日）
        var daysInNewMonth = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
        var newDay = Math.min(day, daysInNewMonth);
        
        var resultYear = newYear;
        var resultMonth = String(newMonth + 1).padStart(2, '0');
        var resultDay = String(newDay).padStart(2, '0');
        
        return resultYear + '-' + resultMonth + '-' + resultDay;
    };

    // ==================== Toast 快捷方法 ====================
    Utils.toast = {
        success: function(msg, duration) {
            if (window.Toast) { window.Toast.success(msg, duration); } else { alert(msg); }
        },
        error: function(msg, duration) {
            if (window.Toast) { window.Toast.error(msg, duration); } else { alert(msg); }
        },
        warning: function(msg, duration) {
            if (window.Toast) { window.Toast.warning(msg, duration); } else { alert(msg); }
        },
        info: function(msg, duration) {
            if (window.Toast) { window.Toast.info(msg, duration); } else { alert(msg); }
        },
        confirm: async function(msg, title) {
            if (window.Toast && window.Toast.confirmPromise) {
                return await window.Toast.confirmPromise(msg, title);
            } else {
                return Promise.resolve(confirm(msg));
            }
        }
    };

    Utils.confirm = Utils.toast.confirm;

    // ==================== 语言管理 ====================
    Object.defineProperty(Utils, 'lang', {
        get: function() { return _lang; },
        enumerable: true,
        configurable: false
    });

    Utils.forceSyncLanguage = function() {
        var newLang = localStorage.getItem('jf_lang');
        if (newLang === 'id' || newLang === 'zh') {
            _lang = newLang;
        }
        return _lang;
    };

    Utils.initLanguage = function() {
        _lang = getInitialLang();
        // 翻译字典 — 统一使用 t('key') 的单一真相来源
        _translations = {
            'id': {
                // ===== 通用 =====
                'login': 'Masuk',
                'password': 'Kata Sandi',
                'login_required': 'Silakan login terlebih dahulu',
                'fill_all_fields': 'Harap isi semua bidang',
                'save': 'Simpan',
                'cancel': 'Batal',
                'delete': 'Hapus',
                'edit': 'Ubah',
                'back': 'Kembali',
                'print': 'Cetak',
                'view': 'Lihat',
                'search': 'Cari',
                'export': 'Ekspor',
                'import': 'Impor',
                'confirm_delete': 'Yakin ingin menghapus?',
                'no_data': 'Tidak ada data',
                'loading': 'Memuat...',
                'save_failed': 'Gagal menyimpan',
                'save_success': 'Berhasil disimpan',
                'export_success': 'Ekspor berhasil',
                'backup_complete': 'Cadangan selesai: {orders} pesanan, {customers} nasabah',
                'restore_confirm': '⚠️ Pemulihan akan menimpa data yang ada. Lanjutkan?',
                'order_not_found': 'Pesanan tidak ditemukan',
                'order_deleted': 'Pesanan telah dihapus',
                'order_completed': 'Pesanan sudah lunas',
                'order_locked': 'Pesanan terkunci, tidak dapat diubah',
                'unauthorized': 'Akses ditolak',
                'invalid_amount': 'Jumlah tidak valid',
                'loan_already_disbursed': 'Pinjaman sudah dicairkan',
                'store_operation': 'Operasi ini hanya untuk operator toko',
                'action': 'Aksi',
                'status': 'Status',
                'status_active': 'Aktif',
                'status_completed': 'Lunas',
                'status_liquidated': 'Likuidasi',
                'date': 'Tanggal',
                'amount': 'Jumlah',
                'type': 'Tipe',
                'description': 'Deskripsi',
                'notes': 'Catatan',
                'total_orders': 'Total Pesanan',
                'active': 'Aktif',
                'completed': 'Lunas',
                'total_loan': 'Total Pinjaman',
                'loan_amount': 'Jumlah Pinjaman',
                'admin_fee': 'Biaya Admin',
                'service_fee': 'Biaya Layanan',
                'interest': 'Bunga',
                'principal': 'Pokok',
                'pay_interest': 'Bayar Bunga',
                'return_principal': 'Kembalikan Pokok',
                'payment_due_date': 'Jatuh Tempo',
                'agreed_rate': 'Suku Bunga',
                'customer_name': 'Nama Nasabah',
                'customer_info': 'Info Nasabah',
                'collateral_name': 'Nama Jaminan',
                'collateral_info': 'Info Jaminan',
                'phone': 'Telepon',
                'ktp_number': 'No. KTP',
                'address': 'Alamat',
                'order_id': 'ID Pesanan',
                'order_list': 'Manajemen Pesanan',
                'order_details': 'Detail Pesanan',
                'create_order': 'Buat Pesanan',
                'payment_history': 'Arus Kas',
                'fund_management': 'Manajemen Dana',
                'internal_transfer': 'Transfer Internal',
                'cash_to_bank': 'Brankas→🏧 Bank BNI',
                'bank_to_cash': '🏧 Bank BNI→🏦Brankas',
                'submit_to_hq': 'Setor ke Pusat',
                'cash': 'Kas',
                'bank': 'Bank',
                'inflow': 'Masuk',
                'outflow': 'Keluar',
                'expenses': 'Pengeluaran',
                'customers': 'Nasabah',
                'user_management': 'Manajemen Pengguna',
                'store_management': 'Manajemen Toko',
                'store': 'Toko',
                'backup_restore': 'Cadangan & Pulihkan',
                'save_exit': 'Simpan & Keluar',
                'save_exit_confirm': 'Simpan perubahan dan keluar?',
                'send_reminder': 'Kirim Pengingat',
                'repayment_type': 'Jenis Cicilan',
                'flexible_repayment': 'Cicilan Fleksibel',
                'fixed_repayment': 'Cicilan Tetap',
                'monthly_payment': 'Angsuran Bulanan',
                'remaining_term': 'Sisa Jangka Waktu',
                'early_settlement': 'Pelunasan Dipercepat',
                'more_pawn_higher_fee': 'Semakin besar gadai, semakin besar biaya admin',
                'order_saved_locked': 'Order tersimpan otomatis terkunci',
                'contract_pay_info': 'Bayar bunga sebelum tanggal jatuh tempo',
                'financial_indicators': 'Indikator Bisnis',
                'operation': 'Pusat Manajemen',
                'filter': 'Filter',
                'reset': 'Reset',
                'all': 'Semua',
                'close': 'Tutup',
                'detail': 'Detail',
                'total': 'Total',
                'month': 'bulan',
                'months': 'bulan',
                'payment_method': 'Metode Pembayaran',
                // ===== 异常页面 (问题1补充) =====
                'anomaly_title': 'Situasi Abnormal',
                'overdue_30_days': 'Pesanan Terlambat 30+ Hari',
                'blacklist_title': 'Daftar Hitam Nasabah',
                'all_good': 'Semua pesanan dalam keadaan baik',
                'no_blacklist': 'Tidak ada nasabah di blacklist',
                'load_more': 'Muat Lebih Banyak',
                'remaining': 'tersisa',
                'all_loaded': 'Semua {count} pesanan telah dimuat',
                'enter_liquidation': 'Pesanan ini akan memasuki proses likuidasi',
                'overdue_days': 'Hari Terlambat',
                'blacklist_reason': 'Alasan',
                'blacklist_date': 'Tanggal Blacklist',
                'remove_blacklist': 'Hapus dari Blacklist',
                'blacklist_info': 'Nasabah yang di-blacklist tidak dapat membuat pesanan baru. Hanya administrator yang dapat menghapus dari daftar hitam.',
                'best_performance': 'Kinerja Terbaik Bulan Ini (3 Besar)',
                'worst_performance': 'Kinerja Terendah Bulan Ini (3 Besar)',
                'no_store_data': 'Belum ada data toko bulan ini',
                'ranking_based_on': 'Peringkat berdasarkan data bulan ini',
                // ===== 客户页面补充 =====
                'customer_id': 'ID Nasabah',
                'occupation': 'Pekerjaan',
                'add_customer': 'Tambah Nasabah Baru',
                'save_customer': 'Simpan Nasabah',
                'ktp_address': 'Alamat KTP',
                'living_address': 'Alamat Tinggal',
                'same_as_ktp': 'Sama dengan KTP',
                'different_from_ktp': 'Berbeda (isi manual)',
                'customer_detail': 'Detail Nasabah',
                'registered_date': 'Tanggal Daftar',
                'order_stats': 'Statistik Pesanan',
                'active_orders': 'Berjalan',
                'completed_orders': 'Lunas',
                'abnormal_orders': 'Abnormal',
                'blacklist_customer': 'Blacklist',
                'unblacklist_customer': 'Buka Blacklist',
                'edit_customer': 'Edit Nasabah',
                'customer_orders': 'Order Nasabah',
                'create_order_for': 'Buat Pesanan',
                // ===== 订单页面补充 =====
                'collateral_note': 'Keterangan Barang',
                'loan_source': 'Sumber Dana',
                'fee_details': 'Rincian Biaya',
                'admin_fee_auto': 'Dihitung otomatis',
                'service_fee_auto': 'Dihitung otomatis berdasarkan jumlah gadai',
                'fee_payment_method': 'Metode Pemasukan',
                'fee_payment_hint': 'Admin Fee & Service Fee akan dicatat bersama',
                'interest_rate_select': 'Suku Bunga (Pilih)',
                'repayment_method': 'Metode Cicilan',
                'flexible_desc': 'Bayar bunga dulu, pokok bisa kapan saja',
                'fixed_desc': 'Angsuran tetap per bulan (bunga + pokok)',
                'max_tenor': 'Maksimal 10 bulan',
                'max_extension': 'Maksimal Perpanjangan',
                'extension_limit': 'Batas maksimal perpanjangan bunga sebelum harus lunasi pokok',
                'term_months': 'Jangka Waktu',
                'monthly_payment_rounded': 'Dibulatkan ke Rp 10.000, bisa disesuaikan',
                // ===== 黑名单页面补充 =====
                'blacklist_page_title': 'Daftar Hitam Nasabah',
                'blacklist_list_title': 'Daftar Nasabah Blacklist',
                // ===== 仪表盘补充 =====
                'dashboard_title': 'Dashboard',
                'welcome': 'Selamat datang',
                'net_profit': 'Laba Bersih',
                'manage_orders': 'Kelola semua pesanan',
                'manage_customers': 'Data nasabah',
                'manage_expenses': 'Pengeluaran operasional',
                'view_cashflow': 'Riwayat arus kas',
                'view_transactions': 'Lihat transaksi kas',
                'abnormal_status': 'Pesanan terlambat & blacklist',
                'manage_users': 'Kelola pengguna',
                'manage_stores': 'Kelola toko',
                'backup_restore_data': 'Cadangkan & pulihkan',
                'manage_blacklist': 'Kelola blacklist',
                'view_blacklist': 'Lihat blacklist',
                // ===== 支出页面补充 =====
                'total_expenses': 'Total Pengeluaran',
                'expense_list': 'Daftar Pengeluaran',
                'add_expense': 'Tambah Pengeluaran Baru',
                'save_expense': 'Simpan Pengeluaran',
                'expense_category': 'Kategori / Penyebab',
                'select_category': 'Pilih kategori',
                'expense_method': 'Metode Pembayaran',
                'expense_desc': 'Deskripsi',
                'expense_note': 'Pengeluaran akan dicatat sebagai arus kas keluar (outflow) dari Brankas atau Bank BNI.',
                'reconciled': 'Direkonsiliasi',
                'reconcile': 'Rekonsiliasi',
                'locked': 'Terkunci',
                // ===== 支付页面补充 =====
                'pay_fee': 'Bayar Biaya',
                'payment_page': 'Pembayaran',
                'interest_payment_num': 'Ini adalah pembayaran bunga ke-',
                'times': 'kali',
                'amount_due': 'Jumlah yang harus dibayar',
                'take_months': 'Ambil',
                'confirm_payment': 'Konfirmasi Pembayaran',
                'interest_history': 'Riwayat Pembayaran Bunga',
                'principal_history': 'Riwayat Pengembalian Pokok',
                'principal_paid': 'Pokok Dibayar',
                'remaining_principal': 'Sisa Pokok',
                'payment_amount': 'Jumlah Pembayaran',
                'recording_method': 'Metode Pencatatan',
                'pay_this_month': 'Bayar Angsuran Bulan Ini',
                'progress': 'Progress',
                'this_month': 'Bulan ini',
                'overdue_warning_days': 'Terlambat {days} hari',
                'enter_liquidation_warning': 'Akan memasuki proses likuidasi!',
                'each_installment_includes': 'Setiap angsuran mencakup bunga dan pokok. Pelunasan dipercepat dapat mengurangi sisa bunga.',
                'tip_pay_on_time': 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pembayaran pokok lebih awal dapat mengurangi beban bunga. Setelah lunas, sistem akan membuat tanda terima pelunasan secara otomatis.',
                'settlement_receipt': 'Tanda Terima Pelunasan',
                'print_receipt_confirm': 'Cetak tanda terima pelunasan?',
                // ===== 用户管理补充 =====
                'user_list': 'Daftar Peran',
                'add_user': 'Tambah Peran Baru',
                'login_account': 'Akun Login (Email)',
                'full_name': 'Nama Lengkap',
                'identity_info': 'Informasi Identitas',
                'role': 'Role',
                'current_user': 'Pengguna saat ini',
                'reset_password': 'Reset Password',
                'select_store': 'Pilih toko',
                'unknown_store': 'Toko tidak diketahui',
                'headquarters': 'Kantor Pusat',
                // ===== 门店管理补充 =====
                'store_list': 'Daftar Toko',
                'add_store': 'Tambah Toko Baru',
                'store_code': 'Kode Toko',
                'store_name': 'Nama Toko',
                'store_address': 'Alamat',
                'store_phone': 'Telepon',
                'store_wa': 'Nomor WhatsApp',
                'store_status': 'Status',
                'suspend_store': 'Tutup Sementara',
                'resume_store': 'Buka Kembali',
                'practice_mode': 'Toko Latihan',
                'set_practice': 'Jadikan Toko Latihan',
                'practice_active': 'Mode Latihan (Aktif)',
                'store_summary': 'Ringkasan Keuangan Toko',
                'cashflow_summary': 'Ringkasan Arus Kas',
                'total_all_stores': 'Total Semua Toko',
                // ===== 备份恢复补充 =====
                'backup_data': 'Cadangkan Data',
                'backup_now': 'Cadangkan Sekarang',
                'restore_data': 'Pemulihan Data',
                'restore_now': 'Pulihkan Data',
                'audit_log': 'Log Audit',
                'view_audit': 'Lihat Log Audit',
                'export_orders': 'Ekspor Pesanan',
                'export_payments': 'Ekspor Pembayaran',
                'export_customers': 'Ekspor Nasabah',
                'export_cashflow': 'Ekspor Arus Kas',
                'export_expenses': 'Ekspor Pengeluaran',
                'select_backup_file': 'Pilih File Cadangan',
                'no_file_selected': 'Tidak ada file dipilih',
            },
            'zh': {
                // ===== 通用 =====
                'login': '登录',
                'password': '密码',
                'login_required': '请先登录',
                'fill_all_fields': '请填写所有字段',
                'save': '保存',
                'cancel': '取消',
                'delete': '删除',
                'edit': '修改',
                'back': '返回',
                'print': '打印',
                'view': '查看',
                'search': '搜索',
                'export': '导出',
                'import': '导入',
                'confirm_delete': '确认删除？',
                'no_data': '暂无数据',
                'loading': '加载中...',
                'save_failed': '保存失败',
                'save_success': '保存成功',
                'export_success': '导出成功',
                'backup_complete': '备份完成：{orders} 条订单，{customers} 位客户',
                'restore_confirm': '⚠️ 恢复将覆盖现有数据，确认继续？',
                'order_not_found': '订单未找到',
                'order_deleted': '订单已删除',
                'order_completed': '订单已结清',
                'order_locked': '订单已锁定，不可修改',
                'unauthorized': '无权限访问',
                'invalid_amount': '金额无效',
                'loan_already_disbursed': '贷款已发放',
                'store_operation': '此操作仅限门店操作员',
                'action': '操作',
                'status': '状态',
                'status_active': '进行中',
                'status_completed': '已结清',
                'status_liquidated': '已变卖',
                'date': '日期',
                'amount': '金额',
                'type': '类型',
                'description': '描述',
                'notes': '备注',
                'total_orders': '总订单',
                'active': '进行中',
                'completed': '已结清',
                'total_loan': '总贷款',
                'loan_amount': '贷款金额',
                'admin_fee': '管理费',
                'service_fee': '服务费',
                'interest': '利息',
                'principal': '本金',
                'pay_interest': '缴纳利息',
                'return_principal': '返还本金',
                'payment_due_date': '到期日',
                'agreed_rate': '约定利率',
                'customer_name': '客户姓名',
                'customer_info': '客户信息',
                'collateral_name': '质押物名称',
                'collateral_info': '质押物信息',
                'phone': '电话',
                'ktp_number': '身份证号',
                'address': '地址',
                'order_id': '订单号',
                'order_list': '订单管理',
                'order_details': '订单详情',
                'create_order': '创建订单',
                'payment_history': '资金流水',
                'fund_management': '资金管理',
                'internal_transfer': '内部转账',
                'cash_to_bank': '保险柜→🏧 银行BNI',
                'bank_to_cash': '🏧 银行BNI→🏦保险柜',
                'submit_to_hq': '上缴总部',
                'cash': '现金',
                'bank': '银行',
                'inflow': '流入',
                'outflow': '流出',
                'expenses': '运营支出',
                'customers': '客户管理',
                'user_management': '用户管理',
                'store_management': '门店管理',
                'store': '门店',
                'backup_restore': '备份恢复',
                'save_exit': '保存退出',
                'save_exit_confirm': '保存更改并退出？',
                'send_reminder': '发送提醒',
                'repayment_type': '还款方式',
                'flexible_repayment': '灵活还款',
                'fixed_repayment': '固定还款',
                'monthly_payment': '每月还款',
                'remaining_term': '剩余期限',
                'early_settlement': '提前结清',
                'more_pawn_higher_fee': '典当金额越大，管理费越高',
                'order_saved_locked': '订单保存后自动锁定',
                'contract_pay_info': '请在到期日前支付利息',
                'financial_indicators': '业务指标',
                'operation': '管理中心',
                'filter': '筛选',
                'reset': '重置',
                'all': '全部',
                'close': '关闭',
                'detail': '详情',
                'total': '总计',
                'month': '个月',
                'months': '个月',
                'payment_method': '支付方式',
                // ===== 异常页面补充 =====
                'anomaly_title': '异常状况',
                'overdue_30_days': '逾期30天以上订单',
                'blacklist_title': '客户黑名单',
                'all_good': '所有订单状态良好',
                'no_blacklist': '暂无黑名单客户',
                'load_more': '加载更多',
                'remaining': '剩余',
                'all_loaded': '已加载全部 {count} 条订单',
                'enter_liquidation': '这些订单即将进入变卖程序',
                'overdue_days': '逾期天数',
                'blacklist_reason': '原因',
                'blacklist_date': '拉黑日期',
                'remove_blacklist': '解除黑名单',
                'blacklist_info': '被拉黑的客户无法创建新订单。只有管理员可以解除黑名单。',
                'best_performance': '本月业绩前三排行',
                'worst_performance': '本月业绩后三排行',
                'no_store_data': '本月暂无门店数据',
                'ranking_based_on': '排名基于当月数据',
                // ===== 客户页面补充 =====
                'customer_id': '客户ID',
                'occupation': '职业',
                'add_customer': '新增客户',
                'save_customer': '保存客户',
                'ktp_address': 'KTP地址',
                'living_address': '居住地址',
                'same_as_ktp': '同上KTP',
                'different_from_ktp': '不同（手动填写）',
                'customer_detail': '客户详情',
                'registered_date': '注册日期',
                'order_stats': '订单统计',
                'active_orders': '进行中',
                'completed_orders': '已结清',
                'abnormal_orders': '异常订单',
                'blacklist_customer': '拉黑',
                'unblacklist_customer': '解除拉黑',
                'edit_customer': '编辑客户',
                'customer_orders': '客户订单',
                'create_order_for': '创建订单',
                // ===== 订单页面补充 =====
                'collateral_note': '物品备注',
                'loan_source': '资金来源',
                'fee_details': '费用明细',
                'admin_fee_auto': '自动计算',
                'service_fee_auto': '根据当金金额自动计算',
                'fee_payment_method': '入账方式',
                'fee_payment_hint': '管理费和服务费将一起入账',
                'interest_rate_select': '利率（可选）',
                'repayment_method': '还款方式',
                'flexible_desc': '先付利息，本金随时可还',
                'fixed_desc': '每月固定还款（本金+利息）',
                'max_tenor': '最长10个月',
                'max_extension': '最大展期',
                'extension_limit': '利息延期上限，超出后须结清本金',
                'term_months': '还款期限',
                'monthly_payment_rounded': '取整到Rp 10,000，可手动调整',
                // ===== 黑名单页面补充 =====
                'blacklist_page_title': '客户黑名单',
                'blacklist_list_title': '黑名单客户列表',
                // ===== 仪表盘补充 =====
                'dashboard_title': '仪表盘',
                'welcome': '欢迎',
                'net_profit': '净利润',
                'manage_orders': '管理所有订单',
                'manage_customers': '客户信息管理',
                'manage_expenses': '运营支出管理',
                'view_cashflow': '资金流水记录',
                'view_transactions': '查看现金交易记录',
                'abnormal_status': '逾期订单和黑名单',
                'manage_users': '用户管理',
                'manage_stores': '门店管理',
                'backup_restore_data': '备份与恢复',
                'manage_blacklist': '黑名单管理',
                'view_blacklist': '查看黑名单',
                // ===== 支出页面补充 =====
                'total_expenses': '支出总额',
                'expense_list': '支出列表',
                'add_expense': '新增运营支出',
                'save_expense': '保存支出',
                'expense_category': '类别/原因',
                'select_category': '选择类别',
                'expense_method': '支付方式',
                'expense_desc': '描述',
                'expense_note': '支出将记录为从保险柜或银行流出的资金（流出）。',
                'reconciled': '已平账',
                'reconcile': '平账',
                'locked': '已锁定',
                // ===== 支付页面补充 =====
                'pay_fee': '缴纳费用',
                'payment_page': '缴费',
                'interest_payment_num': '本次是第 ',
                'times': '次利息支付',
                'amount_due': '应付金额',
                'take_months': '收取',
                'confirm_payment': '确认收款',
                'interest_history': '利息缴费历史',
                'principal_history': '本金返还历史',
                'principal_paid': '已还本金',
                'remaining_principal': '剩余本金',
                'payment_amount': '还款金额',
                'recording_method': '入账方式',
                'pay_this_month': '支付本月还款',
                'progress': '进度',
                'this_month': '本月新增',
                'overdue_warning_days': '逾期 {days} 天',
                'enter_liquidation_warning': '将进入变卖程序！',
                'each_installment_includes': '每期还款包含本金和利息，提前结清可减免剩余利息',
                'tip_pay_on_time': '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。',
                'settlement_receipt': '结清凭证',
                'print_receipt_confirm': '是否打印结清凭证？',
                // ===== 用户管理补充 =====
                'user_list': '角色列表',
                'add_user': '新增角色',
                'login_account': '登录账户（邮箱）',
                'full_name': '姓名',
                'identity_info': '身份信息',
                'role': '角色',
                'current_user': '当前用户',
                'reset_password': '重置密码',
                'select_store': '选择门店',
                'unknown_store': '未知门店',
                'headquarters': '总部',
                // ===== 门店管理补充 =====
                'store_list': '门店列表',
                'add_store': '新增门店',
                'store_code': '门店编码',
                'store_name': '门店名称',
                'store_address': '地址',
                'store_phone': '电话',
                'store_wa': 'WhatsApp 号码',
                'store_status': '状态',
                'suspend_store': '暂停营业',
                'resume_store': '恢复营业',
                'practice_mode': '练习门店',
                'set_practice': '设为练习门店',
                'practice_active': '练习模式 (已开启)',
                'store_summary': '门店财务汇总',
                'cashflow_summary': '现金流汇总',
                'total_all_stores': '全部门店合计',
                // ===== 备份恢复补充 =====
                'backup_data': '备份数据',
                'backup_now': '立即备份',
                'restore_data': '恢复数据',
                'restore_now': '恢复数据',
                'audit_log': '审计日志',
                'view_audit': '查看审计日志',
                'export_orders': '导出订单',
                'export_payments': '导出缴费',
                'export_customers': '导出客户',
                'export_cashflow': '导出资金流水',
                'export_expenses': '导出运营支出',
                'select_backup_file': '选择备份文件',
                'no_file_selected': '未选择文件',
            }
        };
    };

    Utils.setLanguage = function(lang) {
        if (lang !== 'id' && lang !== 'zh') return;
        _lang = lang;
        localStorage.setItem('jf_lang', lang);
        for (var key in _listeners) {
            if (typeof _listeners[key] === 'function') {
                try { _listeners[key](lang); } catch(e) {}
            }
        }
    };

    Utils.onLanguageChange = function(id, callback) {
        _listeners[id] = callback;
    };

    Utils.offLanguageChange = function(id) {
        delete _listeners[id];
    };

    Utils.t = function(key) {
        if (!_translations[_lang]) return key;
        return _translations[_lang][key] || key;
    };

    // ==================== 数字/货币工具 ====================
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

    // ==================== 金额格式化绑定到 input ====================
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
        if (initialRaw) {
            inputEl.value = Utils.formatNumberWithCommas(initialRaw);
        }
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
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    Utils.unescapeHtml = function(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    };

    // ==================== 验证工具 ====================
    Utils.isValidEmail = function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    Utils.isValidPhone = function(phone) {
        return /^\+?[\d\s\-()]{6,20}$/.test(phone);
    };

    Utils.isValidKtp = function(ktp) {
        return /^\d{16}$/.test(ktp);
    };

    // ==================== 费用计算 ====================
    Utils.calculateAdminFee = function(loanAmount) {
        if (!loanAmount || loanAmount <= 0) return 0;
        return Math.max(120000, Math.round(loanAmount * Utils.ADMIN_FEE_RATE / 10000) * 10000);
    };

    Utils.calculateServiceFeeNew = function(loanAmount) {
        if (!loanAmount || loanAmount <= 0) return { percent: 0, amount: 0 };
        var percent = loanAmount <= 5000000 ? 5 : loanAmount <= 10000000 ? 3 : 2;
        var amount = Math.round(loanAmount * percent / 100);
        return { percent: percent, amount: amount };
    };

    Utils.calculateFixedMonthlyPayment = function(loanAmount, monthlyRate, months) {
        if (!loanAmount || !months || months <= 0) return 0;
        if (monthlyRate <= 0) return loanAmount / months;
        var pow = Math.pow(1 + monthlyRate, months);
        return (loanAmount * monthlyRate * pow) / (pow - 1);
    };

    Utils.roundMonthlyPayment = function(amount) {
        return Math.ceil(amount / 10000) * 10000;
    };

    // ==================== 下拉选项生成 ====================
    Utils.getInterestRateOptions = function(defaultRate) {
        if (defaultRate === undefined) defaultRate = 8;
        var rates = [5, 6, 7, 8, 9, 10, 12, 15];
        var html = '';
        for (var i = 0; i < rates.length; i++) {
            var selected = rates[i] === defaultRate ? ' selected' : '';
            html += '<option value="' + rates[i] + '"' + selected + '>' + rates[i] + '%</option>';
        }
        return html;
    };

    Utils.getServiceFeePercentOptions = function(defaultPercent) {
        if (defaultPercent === undefined) defaultPercent = 2;
        var options = [0, 1, 2, 3, 5];
        var html = '';
        for (var i = 0; i < options.length; i++) {
            var selected = options[i] === defaultPercent ? ' selected' : '';
            html += '<option value="' + options[i] + '"' + selected + '>' + options[i] + '%</option>';
        }
        return html;
    };

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

    // ==================== CSV / JSON 导入导出 ====================
    Utils.exportToJSON = function(data, filename) {
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    Utils.importFromJSON = function(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    resolve(data);
                } catch(err) {
                    reject(new Error(Utils.lang === 'id' ? 'Format file tidak valid' : '文件格式无效'));
                }
            };
            reader.onerror = function() {
                reject(new Error(Utils.lang === 'id' ? 'Gagal membaca file' : '文件读取失败'));
            };
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
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    Utils.exportPaymentsToCSV = function(payments, filename) {
        if (!payments || payments.length === 0) return;
        var lang = Utils.lang;
        var headers = lang === 'id' 
            ? ['Tanggal', 'ID Pesanan', 'Nasabah', 'Tipe', 'Jumlah', 'Metode', 'Deskripsi']
            : ['日期', '订单号', '客户', '类型', '金额', '支付方式', '描述'];
        var rows = payments.map(function(p) {
            return [
                p.date || '',
                p.orders?.order_id || '-',
                p.orders?.customer_name || '-',
                p.type || '',
                p.amount || 0,
                p.payment_method || '',
                p.description || ''
            ];
        });
        var csv = '\uFEFF' + [headers.join(',')].concat(rows.map(function(r) {
            return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
        })).join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ==================== 密码可见性切换 ====================
    Utils.togglePasswordVisibility = function(inputId, toggleEl) {
        var input = document.getElementById(inputId);
        if (!input) return;
        if (input.type === 'password') {
            input.type = 'text';
            if (toggleEl) toggleEl.textContent = '🙈';
        } else {
            input.type = 'password';
            if (toggleEl) toggleEl.textContent = '👁️';
        }
    };

    // ==================== 骨架屏 ====================
    Utils.renderSkeleton = function(type) {
        var skeletonMap = {
            'dashboard': '' +
                '<div class="card" style="padding:20px;">' +
                    '<div class="skeleton" style="height:20px;width:60%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' +
                    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">' +
                        Array(8).fill('<div class="skeleton" style="height:80px;background:#e2e8f0;border-radius:8px;animation:pulse 1.5s infinite;"></div>').join('') +
                    '</div>' +
                '</div>',
            'table': '' +
                '<div class="card" style="padding:20px;">' +
                    '<div class="skeleton" style="height:20px;width:40%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' +
                    Array(8).fill('<div class="skeleton" style="height:40px;margin-bottom:8px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>').join('') +
                '</div>',
            'detail': '' +
                '<div class="card" style="padding:20px;">' +
                    '<div class="skeleton" style="height:20px;width:50%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' +
                    Array(6).fill('<div class="skeleton" style="height:16px;width:70%;margin-bottom:12px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>').join('') +
                '</div>',
            'default': '' +
                '<div class="card" style="padding:20px;">' +
                    '<div class="skeleton" style="height:20px;width:50%;margin-bottom:16px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>' +
                    Array(4).fill('<div class="skeleton" style="height:40px;margin-bottom:8px;background:#e2e8f0;border-radius:4px;animation:pulse 1.5s infinite;"></div>').join('') +
                '</div>'
        };
        
        var skeletonHtml = skeletonMap[type] || skeletonMap['default'];
        
        var styleEl = document.getElementById('skeletonStyle');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'skeletonStyle';
            styleEl.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }';
            document.head.appendChild(styleEl);
        }
        
        return skeletonHtml;
    };

    // ==================== 网络监控 ====================
    Utils.NetworkMonitor = {
        _initialized: false,
        _isOnline: true,
        _callbacks: [],
        _checkUrl: '',

        init: function() {
            if (this._initialized) return;
            this._initialized = true;
            this._isOnline = navigator.onLine;
            
            if (typeof SUPABASE_URL !== 'undefined') {
                this._checkUrl = SUPABASE_URL + '/rest/v1/';
            } else if (typeof window.SUPABASE_URL !== 'undefined') {
                this._checkUrl = window.SUPABASE_URL + '/rest/v1/';
            } else {
                this._checkUrl = 'https://hiupsvsbcdsgoyiieqiv.supabase.co/rest/v1/';
            }

            var self = this;

            window.addEventListener('online', function() {
                self._isOnline = true;
                self._notify(true);
                self._showToast(Utils.lang === 'id' ? '✅ Koneksi Pulih' : '✅ 网络已恢复');
            });

            window.addEventListener('offline', function() {
                self._isOnline = false;
                self._notify(false);
                self._showBanner();
            });

            setInterval(function() {
                self._checkRealConnectivity().then(function(online) {
                    if (online !== self._isOnline) {
                        self._isOnline = online;
                        self._notify(online);
                        if (online) {
                            self._hideBanner();
                            self._showToast(Utils.lang === 'id' ? '✅ Koneksi Pulih' : '✅ 网络已恢复');
                        } else {
                            self._showBanner();
                        }
                    }
                });
            }, 120000);

            if (!this._isOnline) {
                this._showBanner();
            }
        },

        isOnline: function() {
            return this._isOnline && navigator.onLine;
        },

        onChange: function(callback) {
            this._callbacks.push(callback);
        },

        async _checkRealConnectivity() {
            if (!navigator.onLine) return false;
            try {
                var controller = new AbortController();
                var timeout = setTimeout(function() { controller.abort(); }, 3000);
                var response = await fetch('/icons/favicon-192x192.png', {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-cache'
                });
                clearTimeout(timeout);
                return response.ok;
            } catch (e) {
                return navigator.onLine;
            }
        },

        _notify: function(online) {
            for (var i = 0; i < this._callbacks.length; i++) {
                try { this._callbacks[i](online); } catch(e) {}
            }
        },

        _showBanner: function() {
            var existing = document.getElementById('offlineBanner');
            if (existing) return;
            var banner = document.createElement('div');
            banner.id = 'offlineBanner';
            banner.className = 'info-bar danger';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;border-radius:0;margin:0;text-align:center;justify-content:center;';
            banner.innerHTML = '<span class="info-bar-icon">📡</span><div class="info-bar-content"><strong>' +
                (Utils.lang === 'id' ? 'Koneksi Terputus' : '网络连接已断开') +
                '</strong> — ' +
                (Utils.lang === 'id' ? 'Data mungkin tidak tersimpan.' : '数据可能无法保存。') +
                '</div>';
            document.body.insertBefore(banner, document.body.firstChild);
        },

        _hideBanner: function() {
            var banner = document.getElementById('offlineBanner');
            if (banner) banner.remove();
        },

        _showToast: function(message) {
            if (window.Toast) {
                window.Toast.info(message, 2000);
            } else {
                var toast = document.createElement('div');
                toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:8px 20px;border-radius:20px;z-index:10001;font-size:14px;transition:opacity 0.5s;';
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(function() {
                    toast.style.opacity = '0';
                    setTimeout(function() { toast.remove(); }, 500);
                }, 2000);
            }
        }
    };

    // ==================== 离线操作队列 ====================
    Utils.OfflineQueue = {
        _queue: [],
        _processing: false,
        _storageKey: 'jf_offline_queue',

        init: function() {
            try {
                var stored = localStorage.getItem(this._storageKey);
                if (stored) {
                    this._queue = JSON.parse(stored);
                }
            } catch(e) {
                this._queue = [];
            }
            
            Utils.NetworkMonitor.onChange(function(online) {
                if (online) {
                    Utils.OfflineQueue.processQueue();
                }
            });
        },

        enqueue: function(operation) {
            this._queue.push({
                id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                operation: operation.name || 'unknown',
                data: operation.data,
                timestamp: new Date().toISOString(),
                retries: 0
            });
            this._persist();
            console.log('[OfflineQueue] 操作已入队:', operation.name);
            if (window.Toast) {
                window.Toast.info(Utils.lang === 'id' 
                    ? '📡 Tidak ada koneksi, data akan diproses nanti' 
                    : '📡 无网络连接，数据将在恢复后处理', 3000);
            }
            return true;
        },

        processQueue: async function() {
            if (this._processing || this._queue.length === 0) return;
            if (!Utils.NetworkMonitor.isOnline()) return;

            this._processing = true;
            console.log('[OfflineQueue] 开始处理队列:', this._queue.length, '条待处理');

            while (this._queue.length > 0) {
                var item = this._queue[0];
                try {
                    if (item.operation === 'createOrder' && typeof Order !== 'undefined') {
                        await Order.create(item.data);
                    }
                    this._queue.shift();
                    this._persist();
                } catch (error) {
                    item.retries++;
                    if (item.retries >= 3) {
                        console.error('[OfflineQueue] 操作失败超过3次，丢弃:', item.id);
                        this._queue.shift();
                    } else {
                        console.warn('[OfflineQueue] 重试中 (' + item.retries + '/3):', error.message);
                    }
                    this._persist();
                    break;
                }
            }

            this._processing = false;
            if (this._queue.length === 0) {
                console.log('[OfflineQueue] 队列已清空');
                if (window.Toast) {
                    window.Toast.success(Utils.lang === 'id' ? '✅ Data offline berhasil diproses' : '✅ 离线数据处理完成', 3000);
                }
            }
        },

        _persist: function() {
            try {
                localStorage.setItem(this._storageKey, JSON.stringify(this._queue));
            } catch(e) {}
        },

        getQueueLength: function() {
            return this._queue.length;
        }
    };

    // ==================== 离线支持包装器 ====================
    Utils.wrapWithOfflineSupport = function(fn, operationName) {
        return async function() {
            var args = arguments;
            try {
                return await fn.apply(this, args);
            } catch (error) {
                if (error.message && (
                    error.message.includes('network') || 
                    error.message.includes('fetch') ||
                    error.message.includes('Failed to fetch') ||
                    error.message.includes('NetworkError')
                )) {
                    Utils.OfflineQueue.enqueue({
                        name: operationName,
                        data: args[0]
                    });
                    throw new Error(Utils.lang === 'id'
                        ? 'Tidak ada koneksi. Data akan diproses saat koneksi pulih.'
                        : '无网络连接。数据将在恢复连接后处理。');
                }
                throw error;
            }
        };
    };

    // ==================== 错误上报 ====================
    Utils.ErrorHandler = {
        _errors: [],
        _maxErrors: 50,

        init: function() {
            var self = this;
            window.addEventListener('error', function(e) {
                self.capture(e.error || e.message, 'uncaught');
            });
            window.addEventListener('unhandledrejection', function(e) {
                self.capture(e.reason, 'unhandled_promise');
            });
        },

        capture: function(error, context) {
            if (!error) return;
            var entry = {
                message: error.message || String(error),
                stack: error.stack || '',
                context: context || 'unknown',
                timestamp: new Date().toISOString()
            };
            this._errors.unshift(entry);
            if (this._errors.length > this._maxErrors) {
                this._errors.pop();
            }
            console.error('[ErrorHandler]', context + ':', entry.message, entry.stack ? '\n' + entry.stack : '');
            
            if (window.Toast && context !== 'uncaught' && context !== 'unhandled_promise') {
                window.Toast.error('错误: ' + (error.message || String(error)).substring(0, 100), 4000);
            }
        },

        getRecentErrors: function(count) {
            return this._errors.slice(0, count || 10);
        },

        clear: function() {
            this._errors = [];
        }
    };

    // ==================== 性能标记 ====================
    Utils.PerfMarker = {
        _marks: {},

        start: function(name) {
            this._marks[name] = performance.now();
        },

        end: function(name) {
            var start = this._marks[name];
            if (!start) return -1;
            var duration = performance.now() - start;
            delete this._marks[name];
            console.log('[Perf] ' + name + ': ' + duration.toFixed(1) + 'ms');
            return duration;
        }
    };

    // ==================== 初始化 ====================
    Utils.initLanguage();
    Utils.OfflineQueue.init();

    window.Utils = Utils;
})();
