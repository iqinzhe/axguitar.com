// utils.js - v2.0（补全所有工具函数 + 离线队列 + 网络监控 + 错误上报 + 性能标记）

window.Utils = window.Utils || {};

(function() {
    'use strict';

    var _lang = localStorage.getItem('jf_lang') || 'id';
    var _translations = {};
    var _listeners = {};

    // ==================== 常量 ====================
    Utils.DEFAULT_AGREED_INTEREST_RATE = 0.08;  // 8%
    Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT = 8;
    Utils.DEFAULT_MAX_EXTENSION_MONTHS = 10;
    Utils.CURRENCY_SYMBOL = 'Rp';
    Utils.ADMIN_FEE_RATE = 0.02;  // 2%

    // ==================== 语言管理 ====================
    Object.defineProperty(Utils, 'lang', {
        get: function() { return _lang; },
        enumerable: true,
        configurable: false
    });

    Utils.initLanguage = function() {
        _lang = localStorage.getItem('jf_lang') || 'id';
        _translations = {
            'id': {
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
                'order_list': 'Daftar Pesanan',
                'order_details': 'Detail Pesanan',
                'create_order': 'Buat Pesanan',
                'payment_history': 'Riwayat Pembayaran',
                'fund_management': 'Manajemen Dana',
                'internal_transfer': 'Transfer Internal',
                'cash_to_bank': 'Kas ke Bank',
                'bank_to_cash': 'Bank ke Kas',
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
                'financial_indicators': 'Indikator Keuangan',
                'operation': 'Panel Operasi',
                'filter': 'Filter',
                'reset': 'Reset',
                'all': 'Semua'
            },
            'zh': {
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
                'order_list': '订单列表',
                'order_details': '订单详情',
                'create_order': '创建订单',
                'payment_history': '缴费记录',
                'fund_management': '资金管理',
                'internal_transfer': '内部转账',
                'cash_to_bank': '现金存银行',
                'bank_to_cash': '银行取现',
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
                'save_exit': '保存并退出',
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
                'financial_indicators': '财务指标',
                'operation': '操作面板',
                'filter': '筛选',
                'reset': '重置',
                'all': '全部'
            }
        };
    };

    Utils.setLanguage = function(lang) {
        _lang = lang;
        localStorage.setItem('jf_lang', lang);
        // 触发语言变更事件
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

    Utils.formatDate = function(dateStr) {
        if (!dateStr) return '-';
        try {
            var d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            var day = String(d.getDate()).padStart(2, '0');
            var month = String(d.getMonth() + 1).padStart(2, '0');
            var year = d.getFullYear();
            if (_lang === 'id') {
                return day + '/' + month + '/' + year;
            }
            return year + '-' + month + '-' + day;
        } catch(e) {
            return dateStr;
        }
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
        
        // 初始格式化
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
        return Math.max(30000, Math.round(loanAmount * Utils.ADMIN_FEE_RATE / 10000) * 10000);
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
        // 等额本息公式
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
        for (var i = 1; i <= 10; i++) {
            var selected = i === defaultMonths ? ' selected' : '';
            html += '<option value="' + i + '"' + selected + '>' + i + ' ' + (_lang === 'id' ? 'bulan' : '个月') + '</option>';
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
                    reject(new Error(_lang === 'id' ? 'Format file tidak valid' : '文件格式无效'));
                }
            };
            reader.onerror = function() {
                reject(new Error(_lang === 'id' ? 'Gagal membaca file' : '文件读取失败'));
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
        var headers = _lang === 'id' 
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
        
        // 添加骨架屏动画
        var styleEl = document.getElementById('skeletonStyle');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'skeletonStyle';
            styleEl.textContent = '@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }';
            document.head.appendChild(styleEl);
        }
        
        return skeletonHtml;
    };

    // ==================== 网络监控（增强版） ====================
    Utils.NetworkMonitor = {
        _initialized: false,
        _isOnline: true,
        _callbacks: [],
        _checkUrl: SUPABASE_URL + '/rest/v1/',

        init: function() {
            if (this._initialized) return;
            this._initialized = true;
            this._isOnline = navigator.onLine;

            var self = this;

            window.addEventListener('online', function() {
                self._isOnline = true;
                self._notify(true);
                self._showToast(_lang === 'id' ? '✅ Koneksi Pulih' : '✅ 网络已恢复');
            });

            window.addEventListener('offline', function() {
                self._isOnline = false;
                self._notify(false);
                self._showBanner();
            });

            // 定时检查实际连通性
            setInterval(function() {
                self._checkRealConnectivity().then(function(online) {
                    if (online !== self._isOnline) {
                        self._isOnline = online;
                        self._notify(online);
                        if (online) {
                            self._hideBanner();
                            self._showToast(_lang === 'id' ? '✅ Koneksi Pulih' : '✅ 网络已恢复');
                        } else {
                            self._showBanner();
                        }
                    }
                });
            }, 30000);

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
            try {
                var controller = new AbortController();
                var timeout = setTimeout(function() { controller.abort(); }, 5000);
                var response = await fetch(this._checkUrl, {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-cache'
                });
                clearTimeout(timeout);
                return response.ok;
            } catch (e) {
                return false;
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
                (_lang === 'id' ? 'Koneksi Terputus' : '网络连接已断开') +
                '</strong> — ' +
                (_lang === 'id' ? 'Data mungkin tidak tersimpan.' : '数据可能无法保存。') +
                '</div>';
            document.body.insertBefore(banner, document.body.firstChild);
        },

        _hideBanner: function() {
            var banner = document.getElementById('offlineBanner');
            if (banner) banner.remove();
        },

        _showToast: function(message) {
            var toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:8px 20px;border-radius:20px;z-index:10001;font-size:14px;transition:opacity 0.5s;';
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(function() {
                toast.style.opacity = '0';
                setTimeout(function() { toast.remove(); }, 500);
            }, 2000);
        }
    };

    // ==================== 离线操作队列 ====================
    Utils.OfflineQueue = {
        _queue: [],
        _processing: false,
        _storageKey: 'jf_offline_queue',

        init: function() {
            // 从 storage 恢复队列
            try {
                var stored = localStorage.getItem(this._storageKey);
                if (stored) {
                    this._queue = JSON.parse(stored);
                }
            } catch(e) {
                this._queue = [];
            }
            
            // 监听网络恢复
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
                    // 移除已处理的项
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
                    break;  // 出错后暂停，等待下次触发
                }
            }

            this._processing = false;
            if (this._queue.length === 0) {
                console.log('[OfflineQueue] 队列已清空');
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
                    throw new Error(_lang === 'id'
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
            
            // 可选：上报到服务端
            // this._sendToServer(entry);
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
    // 网络监控由 AUTH.init 启动，避免重复初始化

})();

// 示例：创建订单时自动支持离线队列
async function createOrderWithOfflineSupport(orderData) {
    return Utils.wrapWithOfflineSupport(Order.create, 'createOrder')(orderData);
}
