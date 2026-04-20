// app-dashboard-core.js - v2.1（移除搜索功能）

window.APP = window.APP || {};

const DashboardCore = {
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    saveCurrentPageState: function() {
        sessionStorage.setItem('jf_current_page', this.currentPage);
        sessionStorage.setItem('jf_current_filter', this.currentFilter || "all");
    },
    
    restorePageState: function() {
        return {
            page: sessionStorage.getItem('jf_current_page'),
            filter: sessionStorage.getItem('jf_current_filter') || "all",
            keyword: ""
        };
    },
    
    clearPageState: function() {
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_filter');
        this.currentOrderId = null;
        this.currentCustomerId = null;
    },

    init: async function() {
        document.getElementById("app").innerHTML = '<div class="loading-container"><div class="loader"></div><p class="loading-text">🔄 Loading system...</p></div>';
        await AUTH.init();
        
        var savedState = this.restorePageState();
        var savedPage = savedState.page;
        var savedFilter = savedState.filter;
        
        if (savedPage && savedPage !== 'login' && AUTH.isLoggedIn()) {
            this.currentPage = savedPage;
            this.currentFilter = savedFilter || "all";
            this.searchKeyword = "";
            this.currentOrderId = null;
            this.currentCustomerId = null;
            await this.refreshCurrentPage();
        } else {
            await this.router();
        }
    },

    router: async function() {
        if (!AUTH.isLoggedIn()) await this.renderLogin();
        else await this.renderDashboard();
    },

    refreshCurrentPage: async function() {
        var self = this;
        var handlers = {
            dashboard: async () => await self.renderDashboard(),
            orderTable: async () => await self.showOrderTable(),
            createOrder: () => self.showCreateOrder(),
            viewOrder: async () => { 
                if (self.currentOrderId) {
                    await self.viewOrder(self.currentOrderId);
                } else {
                    await self.showOrderTable();
                }
            },
            payment: async () => { 
                if (self.currentOrderId) {
                    await self.showPayment(self.currentOrderId);
                } else {
                    await self.showOrderTable();
                }
            },
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            expenses: async () => await self.showExpenses(),
            customers: async () => await self.showCustomers(),
            paymentHistory: async () => await self.showPaymentHistory(),
            backupRestore: async () => await Storage.renderBackupUI(),
            customerOrders: async () => { 
                if (self.currentCustomerId) {
                    await self.showCustomerOrders(self.currentCustomerId);
                } else {
                    await self.showCustomers();
                }
            },
            customerPaymentHistory: async () => { 
                if (self.currentCustomerId) {
                    await self.showCustomerPaymentHistory(self.currentCustomerId);
                } else {
                    await self.showCustomers();
                }
            },
            blacklist: async () => await self.showBlacklist()
        };
        var handler = handlers[this.currentPage];
        if (handler) await handler();
        else await this.renderDashboard();
    },

    navigateTo: function(page, params) {
        params = params || {};
        this.historyStack.push({
            page: this.currentPage,
            orderId: this.currentOrderId,
            customerId: this.currentCustomerId,
            filter: this.currentFilter,
            keyword: this.searchKeyword
        });
        this.currentPage = page;
        
        if (params.orderId) this.currentOrderId = params.orderId;
        if (params.customerId) this.currentCustomerId = params.customerId;
        
        this.saveCurrentPageState();
        
        var self = this;
        var navHandlers = {
            orderTable: async () => await self.showOrderTable(),
            createOrder: () => self.showCreateOrder(),
            dashboard: async () => await self.renderDashboard(),
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            expenses: async () => await self.showExpenses(),
            customers: async () => await self.showCustomers(),
            paymentHistory: async () => await self.showPaymentHistory(),
            backupRestore: async () => await Storage.renderBackupUI(),
            customerOrders: async () => { if (params.customerId) await self.showCustomerOrders(params.customerId); },
            customerPaymentHistory: async () => { if (params.customerId) await self.showCustomerPaymentHistory(params.customerId); },
            viewOrder: async () => { if (params.orderId) await self.viewOrder(params.orderId); },
            payment: async () => { if (params.orderId) await self.showPayment(params.orderId); },
            blacklist: async () => await self.showBlacklist()
        };
        var handler = navHandlers[page];
        if (handler) handler();
        else this.renderDashboard();
    },

    goBack: function() {
        var self = this;
        if (this.historyStack.length > 0) {
            var prev = this.historyStack.pop();
            this.currentPage = prev.page;
            this.currentOrderId = prev.orderId;
            this.currentCustomerId = prev.customerId;
            this.currentFilter = prev.filter || "all";
            this.searchKeyword = prev.keyword || "";
            
            this.saveCurrentPageState();
            
            var backHandlers = {
                orderTable: async () => await self.showOrderTable(),
                dashboard: async () => await self.renderDashboard(),
                viewOrder: async () => { if (prev.orderId) await self.viewOrder(prev.orderId); },
                report: async () => await self.showReport(),
                userManagement: async () => await self.showUserManagement(),
                storeManagement: async () => await StoreManager.renderStoreManagement(),
                expenses: async () => await self.showExpenses(),
                customers: async () => await self.showCustomers(),
                paymentHistory: async () => await self.showPaymentHistory(),
                backupRestore: async () => await Storage.renderBackupUI(),
                customerOrders: async () => { if (prev.customerId) await self.showCustomerOrders(prev.customerId); },
                customerPaymentHistory: async () => { if (prev.customerId) await self.showCustomerPaymentHistory(prev.customerId); },
                blacklist: async () => await self.showBlacklist()
            };
            var handler = backHandlers[prev.page];
            if (handler) handler();
            else this.renderDashboard();
        } else {
            this.renderDashboard();
        }
    },

    renderLogin: async function() {
        this.currentPage = 'login';
        this.clearPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        var storedLang = localStorage.getItem('jf_language');
        if (storedLang && (storedLang === 'id' || storedLang === 'zh')) {
            Utils.lang = storedLang;
            lang = Utils.lang;
        }
        
        document.getElementById("app").innerHTML = `
            <div class="login-container">
                <div class="login-box">
                    <div class="lang-toggle">
                        <button onclick="APP.toggleLanguageOnLogin()" class="lang-btn">🌐 ${lang === 'id' ? '中文' : 'Bahasa'}</button>
                    </div>
                    <h2 class="login-title"><img src="icons/pagehead-logo.png" alt="JF!" class="login-logo"> JF! by Gadai</h2>
                    <h3>${t('login')}</h3>
                    <div class="form-group">
                        <label>${Utils.lang === 'id' ? 'Email / Username' : '邮箱 / 用户名'}</label>
                        <input id="username" placeholder="email@domain.com">
                    </div>
                    <div class="form-group">
                        <label>${t('password')}</label>
                        <input id="password" type="password" placeholder="${t('password')}">
                    </div>
                    <button onclick="APP.login()">${t('login')}</button>
                    <p class="login-note">
                        ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}
                    </p>
                </div>
            </div>`;
    },

    login: async function() {
        var username = document.getElementById("username").value.trim();
        var password = document.getElementById("password").value;
        if (!username || !password) { alert(Utils.t('fill_all_fields')); return; }
        var btnEl = document.querySelector('#app button');
        if (btnEl) { btnEl.disabled = true; btnEl.textContent = '...'; }
        var user = await AUTH.login(username, password);
        if (!user) {
            alert(Utils.t('login_failed'));
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = Utils.t('login'); }
            return;
        }
        var savedLang = localStorage.getItem('jf_language');
        if (savedLang && (savedLang === 'id' || savedLang === 'zh')) {
            Utils.lang = savedLang;
        }
        await this.router();
    },

    logout: async function() {
        this.clearPageState();
        sessionStorage.clear();
        await AUTH.logout();
        await this.router();
    },

    toggleLanguage: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        if (this.currentPage === 'login' || !AUTH.isLoggedIn()) this.renderLogin();
        else this.refreshCurrentPage();
    },

    toggleLanguageOnLogin: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        this.renderLogin();
    },

    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        this.saveCurrentPageState();
        try {
            var report = await Order.getReport();
            var cashFlow = await SUPABASE.getCashFlowSummary();
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var storeName = AUTH.getCurrentStoreName();
            
            var needRemindOrders = await SUPABASE.getOrdersNeedReminder();
            var hasReminders = needRemindOrders.length > 0;
            var hasSentToday = await this.hasSentRemindersToday();
            
            var btnDisabled = hasSentToday;
            var btnHighlight = hasReminders && !hasSentToday;
            
            var totalExpenses = 0;
            try {
                let expenseQuery = supabaseClient.from('expenses').select('amount');
                if (!isAdmin && profile?.store_id) {
                    expenseQuery = expenseQuery.eq('store_id', profile.store_id);
                }
                const { data: expenses } = await expenseQuery;
                totalExpenses = expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
            } catch(e) { console.warn("获取支出汇总失败:", e); }
            
            var cards = [
                { label: t('total_orders'), value: report.total_orders, type: 'number' },
                { label: t('total_loan'), value: Utils.formatCurrency(report.total_loan_amount), type: 'currency' },
                { label: t('active'), value: report.active_orders, type: 'number' },
                { label: t('completed'), value: report.completed_orders, type: 'number' },
                { label: lang === 'id' ? 'Admin Fee' : '管理费', value: Utils.formatCurrency(report.total_admin_fees), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Service Fee' : '服务费', value: Utils.formatCurrency(report.total_service_fees || 0), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Bunga Diterima' : '已收利息', value: Utils.formatCurrency(report.total_interest), type: 'currency', class: 'income' },
                { label: lang === 'id' ? 'Total Pengeluaran' : '支出汇总', value: Utils.formatCurrency(totalExpenses), type: 'currency', class: 'expense' }
            ];
            
            var cardsHtml = cards.map(card => `
                <div class="stat-card ${card.class || ''}">
                    <div class="stat-value ${card.class || ''}">${card.value}</div>
                    <div class="stat-label">${card.label}</div>
                </div>
            `).join('');
            
            var toolbarClass = isAdmin ? 'toolbar admin-grid' : 'toolbar store-grid';
            
            var toolbarHtml = `
            <div class="${toolbarClass}">
                <button onclick="APP.navigateTo('customers')">👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</button>
                <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</button>
                <button onclick="APP.navigateTo('expenses')">📝 ${lang === 'id' ? 'Pengeluaran' : '运营支出'}</button>
                <button onclick="APP.navigateTo('backupRestore')">💾 ${lang === 'id' ? 'Backup & Restore' : '备份与恢复'}</button>
                <button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning ${btnHighlight ? 'highlight' : ''}" ${btnDisabled ? 'disabled' : ''}>
                    📱 ${lang === 'id' ? 'Kirim Pengingat' : '发送提醒'} ${hasReminders ? `(${needRemindOrders.length})` : ''}
                </button>
                ${isAdmin ? `<button onclick="APP.navigateTo('report')">📊 ${t('financial_report')}</button>` : ''}
                ${isAdmin ? `<button onclick="APP.navigateTo('userManagement')">👥 ${lang === 'id' ? 'Man. Kerja' : '工作管理'}</button>` : ''}
                ${isAdmin ? `<button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Man. Toko' : '门店管理'}</button>` : ''}
                <button onclick="APP.logout()">🚪 ${t('logout')}</button>
            </div>`;
            
            var bottomHtml = `
            <div class="card">
                <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长')})</h3>
                <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
                <p>📌 ${lang === 'id' ? 'Admin Fee: (dibayar saat kontrak) | Bunga: 10% per bulan | Service Fee: (diskon, dibayar sekali)' : '管理费: (签合同支付) | 利息: 10%/月 | 服务费: (优惠，仅收一次)'}</p>
                <p>🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>
            </div>`;
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h1><img src="icons/pagehead-logo.png" alt="JF!" class="logo-img"> JF! by Gadai</h1>
                    <div class="header-actions">
                        ${this.historyStack.length > 0 ? `<button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>` : ''}
                    </div>
                </div>
                
                <div class="cashflow-summary">
                    <h3>💰 ${lang === 'id' ? '资金管理' : '资金管理'}</h3>
                    
                    ${isAdmin ? `
                    <div class="capital-summary">
                        <div class="capital-summary-text">
                            <span>💰 ${lang === 'id' ? 'Saldo Kas' : '现金余额'}:</span>
                            <strong>${Utils.formatCurrency(cashFlow.cash.balance)}</strong>
                            <span>🏧 ${lang === 'id' ? 'Saldo Bank' : '银行余额'}:</span>
                            <strong>${Utils.formatCurrency(cashFlow.bank.balance)}</strong>
                        </div>
                        <div>
                            <button onclick="APP.showCapitalModal()" class="capital-btn">🏦 ${lang === 'id' ? 'Riwayat Transaksi' : '资金流水'}</button>
                            <button onclick="APP.showInternalTransferHistory()" class="capital-btn" style="margin-left:8px;">🔄 ${lang === 'id' ? 'Riwayat Transfer' : '转账记录'}</button>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="cashflow-stats">
                        <div class="cashflow-item">
                            <div class="label">🏦 ${lang === 'id' ? '保险柜 (现金)' : '保险柜 (现金)'}</div>
                            <div class="value ${cashFlow.cash.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.cash.balance)}</div>
                            <div class="cashflow-detail">
                                ${lang === 'id' ? '收入' : '收入'}: +${Utils.formatCurrency(cashFlow.cash.income)}<br>
                                ${lang === 'id' ? '支出' : '支出'}: -${Utils.formatCurrency(cashFlow.cash.expense)}
                            </div>
                        </div>
                        
                        <div class="cashflow-item">
                            <div class="label">🏧 ${lang === 'id' ? '银行 BNI' : '银行 BNI'}</div>
                            <div class="value ${cashFlow.bank.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.bank.balance)}</div>
                            <div class="cashflow-detail">
                                ${lang === 'id' ? '收入' : '收入'}: +${Utils.formatCurrency(cashFlow.bank.income)}<br>
                                ${lang === 'id' ? '支出' : '支出'}: -${Utils.formatCurrency(cashFlow.bank.expense)}
                            </div>
                        </div>
                        
                        <div class="cashflow-item internal-transfer-item">
                            <div class="label">🔄 ${lang === 'id' ? '内部互转' : '内部互转'}</div>
                            <div class="transfer-buttons">
                                <button onclick="APP.showTransferModal('cash_to_bank')" class="transfer-btn cash-to-bank">
                                    🏦→🏧 ${lang === 'id' ? '现金存入银行' : '现金存入银行'}
                                </button>
                                <button onclick="APP.showTransferModal('bank_to_cash')" class="transfer-btn bank-to-cash">
                                    🏧→🏦 ${lang === 'id' ? '银行取出现金' : '银行取出现金'}
                                </button>
                                ${isAdmin ? `
                                <button onclick="APP.showTransferModal('store_to_hq')" class="transfer-btn store-to-hq">
                                    🏢 ${lang === 'id' ? '上缴总部' : '上缴总部'}
                                </button>
                                ` : ''}
                            </div>
                            <div class="cashflow-detail" style="margin-top:8px;">
                                💡 ${lang === 'id' ? '保险柜现金过多时可存入银行，不足时可从银行提取' : '保险柜现金过多时可存入银行，不足时可从银行提取'}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-grid-optimized">
                    ${cardsHtml}
                </div>
                
                ${toolbarHtml}
                
                ${bottomHtml}
            `;
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p>⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    printCurrentPage: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        var styles = document.querySelector('link[rel="stylesheet"]')?.href || 'main.css';
        var lang = Utils.lang;
        
        var isAdmin = AUTH.isAdmin();
        var storeName = AUTH.getCurrentStoreName();
        var userRole = AUTH.user?.role;
        var roleText = userRole === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : 
                       userRole === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                       (lang === 'id' ? 'Staf' : '员工');
        var userName = AUTH.user?.name || '-';
        var printDateTime = new Date().toLocaleString();
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Print - JF! by Gadai</title>
                <link rel="stylesheet" href="${styles}">
                <style>
                    @media print {
                        @page { size: A4; margin: 15mm 12mm; }
                        body { margin: 0; padding: 0; }
                        .no-print, .toolbar button:not(.print-btn), button:not(.print-btn), .btn-back, .btn-export, .btn-balance, .btn-detail { display: none !important; }
                        .toolbar { display: block !important; text-align: center; }
                        .print-btn { display: inline-block !important; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ccc !important; padding: 8px; }
                        .card, .stat-card, .report-store-section, .cashflow-summary { 
                            border: 1px solid #ccc !important; 
                            box-shadow: none !important; 
                            background: white !important; 
                            page-break-inside: avoid;
                        }
                        thead { display: table-header-group; }
                        .print-footer {
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 9pt;
                            color: #666;
                            border-top: 1px solid #ccc;
                            padding-top: 8px;
                        }
                        .print-header {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            padding-bottom: 10px;
                            border-bottom: 2px solid #333;
                            margin-bottom: 20px;
                        }
                        body { padding-top: 100px; padding-bottom: 50px; }
                    }
                    .print-header { display: none; }
                    .print-footer { display: none; }
                    @media print {
                        .print-header { display: block; }
                        .print-footer { display: block; }
                    }
                    .print-header .logo { font-size: 16pt; font-weight: bold; color: #2563eb; }
                    .print-header .logo img { height: 32px; vertical-align: middle; }
                    .print-store-info { text-align: center; font-size: 10pt; color: #475569; margin: 5px 0; }
                    .print-user-info { text-align: center; font-size: 9pt; color: #64748b; margin-bottom: 10px; }
                    .empty-row-placeholder td { height: 30px; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="logo">
                        <img src="icons/pagehead-logo.png" alt="JF!"> JF! by Gadai
                    </div>
                    <div class="print-store-info">
                        🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}
                        ${isAdmin ? ` (${lang === 'id' ? 'Kantor Pusat' : '总部'})` : ''}
                    </div>
                    <div class="print-user-info">
                        👤 ${lang === 'id' ? 'Dicetak oleh' : '打印人'}: ${Utils.escapeHtml(userName)} (${roleText}) | 
                        📅 ${lang === 'id' ? 'Tanggal Cetak' : '打印日期'}: ${printDateTime}
                    </div>
                </div>
                
                ${printContent.outerHTML}
                
                <div class="print-footer">
                    <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    <div>${lang === 'id' ? 'Terima kasih atas kepercayaan Anda' : '感谢您的信任'}</div>
                    <div>${lang === 'id' ? 'Laporan ini dicetak secara elektronik dan tidak memerlukan tanda tangan' : '本报告为电子打印，无需签名'}</div>
                    <div>🏪 ${Utils.escapeHtml(storeName)} ${isAdmin ? `(${lang === 'id' ? 'Kantor Pusat' : '总部'})` : ''}</div>
                </div>
                
                <script>
                    window.onload = function() {
                        var tables = document.querySelectorAll('table');
                        tables.forEach(function(table) {
                            var tbody = table.querySelector('tbody');
                            if (tbody && tbody.children.length < 8) {
                                var cols = table.querySelector('thead tr')?.children.length || 5;
                                var needRows = 8 - tbody.children.length;
                                for (var i = 0; i < needRows; i++) {
                                    var emptyRow = document.createElement('tr');
                                    emptyRow.className = 'empty-row-placeholder';
                                    for (var j = 0; j < cols; j++) {
                                        var td = document.createElement('td');
                                        td.innerHTML = '&nbsp;';
                                        td.style.border = '1px solid #ccc';
                                        td.style.height = '25px';
                                        emptyRow.appendChild(td);
                                    }
                                    tbody.appendChild(emptyRow);
                                }
                            }
                        });
                        window.print();
                        setTimeout(function() { window.close(); }, 1000);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    showCapitalModal: async function() {
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        
        try {
            let transactions = [];
            if (isAdmin) {
                const { data: allFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('*, orders(order_id, customer_name), stores(name)')
                    .eq('is_voided', false)
                    .order('recorded_at', { ascending: false });
                transactions = allFlows || [];
            } else {
                const profile = await SUPABASE.getCurrentProfile();
                const { data: storeFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('*, orders(order_id, customer_name)')
                    .eq('store_id', profile?.store_id)
                    .eq('is_voided', false)
                    .order('recorded_at', { ascending: false });
                transactions = storeFlows || [];
            }
            
            var typeMap = {
                loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
                admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
                service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
                interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
                principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
                expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
                internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
                internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
            };
            
            var directionMap = {
                inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
                outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
            };
            
            var sourceMap = {
                cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
                bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
            };
            
            var rows = '';
            if (transactions.length === 0) {
                rows = `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td></tr>`;
            } else {
                for (var t of transactions) {
                    rows += `<tr>
                        <td style="white-space:nowrap;">${Utils.formatDate(t.recorded_at)}</td>
                        <td>${typeMap[t.flow_type] || t.flow_type}</td>
                        <td>${directionMap[t.direction] || t.direction}</td>
                        <td>${sourceMap[t.source_target] || t.source_target}</td>
                        <td class="text-right ${t.direction === 'inflow' ? 'income' : 'expense'}">${Utils.formatCurrency(t.amount)}</td>
                        <td>${Utils.escapeHtml(t.description || '-')}</td>
                        <td>${isAdmin ? Utils.escapeHtml(t.stores?.name || '-') : ''}</td>
                    </tr>`;
                }
            }
            
            var modalHtml = `
                <div id="capitalModal" class="modal-overlay">
                    <div class="modal-content" style="max-width:900px;">
                        <h3>🏦 ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</h3>
                        
                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
                            <input type="text" id="capitalFilterDesc" placeholder="🔍 ${lang === 'id' ? 'Cari deskripsi...' : '搜索描述...'}" style="flex:1;">
                            <select id="capitalFilterType" style="width:auto;">
                                <option value="">${lang === 'id' ? 'Semua tipe' : '全部类型'}</option>
                                <option value="loan_disbursement">${lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放'}</option>
                                <option value="admin_fee">${lang === 'id' ? 'Admin Fee' : '管理费'}</option>
                                <option value="service_fee">${lang === 'id' ? 'Service Fee' : '服务费'}</option>
                                <option value="interest">${lang === 'id' ? 'Bunga' : '利息'}</option>
                                <option value="principal">${lang === 'id' ? 'Pokok' : '本金'}</option>
                                <option value="expense">${lang === 'id' ? 'Pengeluaran' : '运营支出'}</option>
                            </select>
                            <input type="date" id="capitalFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                            <input type="date" id="capitalFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                            <button onclick="APP.filterCapitalTransactions()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                            <button onclick="APP.resetCapitalFilters()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                        </div>
                        
                        <div class="table-container" style="max-height:400px; overflow-y:auto;">
                            <table class="data-table" style="min-width:700px;">
                                <thead>
                                    <tr>
                                        <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                        <th>${lang === 'id' ? 'Tipe' : '类型'}</th>
                                        <th>${lang === 'id' ? 'Arah' : '方向'}</th>
                                        <th>${lang === 'id' ? 'Sumber' : '来源/去向'}</th>
                                        <th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        <th>${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                        ${isAdmin ? '<th>' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody id="capitalTransactionsBody">
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                            <button onclick="APP.printCapitalTransactions()" class="btn-print">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="APP.exportCapitalTransactionsToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                            <button onclick="document.getElementById('capitalModal').remove()" class="btn-back">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            window._capitalTransactionsData = transactions;
            
        } catch (error) {
            console.error("showCapitalModal error:", error);
            alert(lang === 'id' ? 'Gagal memuat data transaksi' : '加载交易记录失败');
        }
    },

    filterCapitalTransactions: function() {
        var transactions = window._capitalTransactionsData || [];
        var searchDesc = document.getElementById('capitalFilterDesc')?.value.toLowerCase() || '';
        var filterType = document.getElementById('capitalFilterType')?.value || '';
        var startDate = document.getElementById('capitalFilterStart')?.value;
        var endDate = document.getElementById('capitalFilterEnd')?.value;
        
        var filtered = transactions.filter(t => {
            if (filterType && t.flow_type !== filterType) return false;
            if (searchDesc && !(t.description || '').toLowerCase().includes(searchDesc)) return false;
            if (startDate && t.recorded_at < startDate) return false;
            if (endDate && t.recorded_at > endDate + 'T23:59:59') return false;
            return true;
        });
        
        this._renderCapitalTransactionsTable(filtered);
    },
    
    resetCapitalFilters: function() {
        var descInput = document.getElementById('capitalFilterDesc');
        var typeSelect = document.getElementById('capitalFilterType');
        var startInput = document.getElementById('capitalFilterStart');
        var endInput = document.getElementById('capitalFilterEnd');
        
        if (descInput) descInput.value = '';
        if (typeSelect) typeSelect.value = '';
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        
        this.filterCapitalTransactions();
    },
    
    _renderCapitalTransactionsTable: function(transactions) {
        var tbody = document.getElementById('capitalTransactionsBody');
        if (!tbody) return;
        
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        
        var typeMap = {
            loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
            admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
            service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
            interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
            principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
            expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
            internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
            internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
        };
        
        var directionMap = {
            inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
            outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
        };
        
        var sourceMap = {
            cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
            bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
        };
        
        var rows = '';
        if (transactions.length === 0) {
            rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td></tr>`;
        } else {
            for (var t of transactions) {
                rows += `<tr>
                    <td style="white-space:nowrap;">${Utils.formatDate(t.recorded_at)}</td>
                    <td>${typeMap[t.flow_type] || t.flow_type}</td>
                    <td>${directionMap[t.direction] || t.direction}</td>
                    <td>${sourceMap[t.source_target] || t.source_target}</td>
                    <td class="text-right ${t.direction === 'inflow' ? 'income' : 'expense'}">${Utils.formatCurrency(t.amount)}</td>
                    <td>${Utils.escapeHtml(t.description || '-')}</td>
                    ${isAdmin ? `<td>${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}
                </tr>`;
            }
        }
        
        tbody.innerHTML = rows;
    },
    
    printCapitalTransactions: function() {
        var modalContent = document.querySelector('#capitalModal .modal-content');
        if (!modalContent) return;
        
        var printContent = modalContent.cloneNode(true);
        var lang = Utils.lang;
        var storeName = AUTH.getCurrentStoreName();
        var userName = AUTH.user?.name || '-';
        var printDateTime = new Date().toLocaleString();
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>JF! by Gadai - ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; padding: 15mm; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
                    .header h1 { font-size: 18px; margin: 5px 0; }
                    .store-info { text-align: center; font-size: 10pt; color: #475569; margin: 5px 0; }
                    .user-info { text-align: center; font-size: 9pt; color: #64748b; margin-bottom: 15px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 10px; }
                    th { background: #f1f5f9; font-weight: 700; }
                    .text-right { text-align: right; }
                    .income { color: #10b981; }
                    .expense { color: #ef4444; }
                    .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
                    .no-print { text-align: center; margin-bottom: 15px; }
                    .no-print button { padding: 6px 14px; margin: 0 5px; cursor: pointer; }
                    @media print { .no-print { display: none; } @page { size: A4; margin: 15mm; } }
                </style>
            </head>
            <body>
                <div class="no-print">
                    <button onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    <button onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
                </div>
                <div class="header">
                    <h1>JF! by Gadai</h1>
                    <div class="store-info">🏪 ${Utils.escapeHtml(storeName)}</div>
                    <div class="user-info">👤 ${Utils.escapeHtml(userName)} | 📅 ${printDateTime}</div>
                    <h3>💰 ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</h3>
                </div>
                ${printContent.querySelector('.table-container')?.innerHTML || ''}
                <div class="footer">
                    <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    <div>${lang === 'id' ? 'Laporan ini dicetak secara elektronik dan tidak memerlukan tanda tangan' : '本报告为电子打印，无需签名'}</div>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    },
    
    exportCapitalTransactionsToCSV: function() {
        var transactions = window._capitalTransactionsData || [];
        var lang = Utils.lang;
        
        var headers = lang === 'id'
            ? ['Tanggal', 'Tipe', 'Arah', 'Sumber', 'Jumlah', 'Deskripsi']
            : ['日期', '类型', '方向', '来源/去向', '金额', '描述'];
        
        var typeMap = {
            loan_disbursement: lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放',
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            service_fee: lang === 'id' ? 'Service Fee' : '服务费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金',
            expense: lang === 'id' ? 'Pengeluaran' : '运营支出'
        };
        
        var rows = transactions.map(t => [
            t.recorded_at.split('T')[0],
            typeMap[t.flow_type] || t.flow_type,
            t.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出'),
            t.source_target === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'),
            t.amount,
            t.description || '-'
        ]);
        
        var csvContent = [headers, ...rows].map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = `jf_cash_flow_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    },

    showUserManagement: async function() {
        this.currentPage = 'userManagement';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        try {
            const users = await SUPABASE.getAllUsers();
            const stores = await SUPABASE.getAllStores();
            
            var roleMap = {
                admin: lang === 'id' ? 'Administrator' : '管理员',
                store_manager: lang === 'id' ? 'Manajer Toko' : '店长',
                staff: lang === 'id' ? 'Staf' : '员工'
            };
            
            var rows = '';
            if (users.length === 0) {
                rows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td></tr>`;
            } else {
                for (var u of users) {
                    var storeName = u.stores?.name || (u.store_id ? (lang === 'id' ? 'Toko tidak diketahui' : '未知门店') : (lang === 'id' ? 'Kantor Pusat' : '总部'));
                    rows += `<tr>
                        <td>${Utils.escapeHtml(u.username)}</td>
                        <td>${Utils.escapeHtml(u.name)}</td>
                        <td>${roleMap[u.role] || u.role}</td>
                        <td>${Utils.escapeHtml(storeName)}</td>
                        <td>${Utils.formatDate(u.created_at)}</td>
                        <td class="action-cell">
                            ${AUTH.user?.role === 'admin' && u.id !== AUTH.user?.id ? `
                                <select id="role_${u.id}" onchange="APP._saveUserRole('${u.id}')">
                                    <option value="store_manager" ${u.role === 'store_manager' ? 'selected' : ''}>${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>${lang === 'id' ? 'Staf' : '员工'}</option>
                                </select>
                                <button onclick="APP.deleteUser('${u.id}')" class="btn-small danger">🗑️ ${t('delete')}</button>
                            ` : (u.id === AUTH.user?.id ? (lang === 'id' ? '👤 Anda sendiri' : '👤 当前用户') : '-')}
                        </td>
                    </tr>`;
                }
            }
            
            var storeOptions = '<option value="">' + (lang === 'id' ? 'Pilih toko' : '选择门店') + '</option>';
            for (var s of stores) {
                storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)} (${Utils.escapeHtml(s.code)})</option>`;
            }
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>👥 ${lang === 'id' ? 'Manajemen Operator' : '操作员管理'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Operator' : '操作员列表'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Username' : '用户名'}</th>
                                    <th>${lang === 'id' ? 'Nama' : '姓名'}</th>
                                    <th>${lang === 'id' ? 'Role' : '角色'}</th>
                                    <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}</th>
                                    <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Operator Baru' : '新增操作员'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${lang === 'id' ? 'Username (Email)' : '用户名（邮箱）'} *</label><input id="newUsername" placeholder="email@domain.com"></div>
                        <div class="form-group"><label>${t('password')} *</label><input id="newPassword" type="password" placeholder="${t('password')}"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label><input id="newName" placeholder="${lang === 'id' ? 'Nama Lengkap' : '姓名'}"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Role' : '角色'} *</label>
                            <select id="newRole">
                                <option value="store_manager">${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                                <option value="staff">${lang === 'id' ? 'Staf' : '员工'}</option>
                            </select>
                        </div>
                        <div class="form-group"><label>${lang === 'id' ? 'Toko' : '门店'}</label>
                            <select id="newStoreId">${storeOptions}</select>
                            <small>${lang === 'id' ? 'Kosongkan untuk akun pusat (admin tidak dapat ditambah)' : '留空表示总部账号（不可添加管理员）'}</small>
                        </div>
                        <div class="form-actions"><button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Operator' : '添加操作员'}</button></div>
                    </div>
                </div>`;
        } catch (error) {
            console.error("showUserManagement error:", error);
            alert(lang === 'id' ? 'Gagal memuat data pengguna' : '加载用户数据失败');
        }
    },

    addUser: async function() {
        var lang = Utils.lang;
        var username = document.getElementById("newUsername").value.trim();
        var password = document.getElementById("newPassword").value;
        var name = document.getElementById("newName").value.trim();
        var role = document.getElementById("newRole").value;
        var storeId = document.getElementById("newStoreId").value || null;
        
        if (!username || !password || !name) {
            alert(lang === 'id' ? 'Harap isi semua bidang yang wajib' : '请填写所有必填字段');
            return;
        }
        
        try {
            await AUTH.addUser(username, password, name, role, storeId);
            alert(lang === 'id' ? '✅ Operator berhasil ditambahkan' : '✅ 操作员添加成功');
            await this.showUserManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menambah operator: ' + error.message : '添加操作员失败：' + error.message);
        }
    },

    deleteUser: async function(userId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus operator ini?' : '删除此操作员？')) return;
        
        try {
            await AUTH.deleteUser(userId);
            alert(lang === 'id' ? '✅ Operator berhasil dihapus' : '✅ 操作员已删除');
            await this.showUserManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    editUser: async function(userId) {
        var lang = Utils.lang;
        var newRole = prompt(lang === 'id' ? 'Masukkan role baru (store_manager/staff):' : '请输入新角色 (store_manager/staff):');
        if (!newRole) return;
        if (newRole !== 'store_manager' && newRole !== 'staff') {
            alert(lang === 'id' ? 'Role tidak valid' : '角色无效');
            return;
        }
        
        try {
            await AUTH.updateUser(userId, { role: newRole });
            alert(lang === 'id' ? '✅ Role berhasil diubah' : '✅ 角色已修改');
            await this.showUserManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal mengubah role: ' + error.message : '修改角色失败：' + error.message);
        }
    },

    _saveUserRole: async function(userId) {
        var lang = Utils.lang;
        var selectEl = document.getElementById(`role_${userId}`);
        if (!selectEl) return;
        var newRole = selectEl.value;
        
        try {
            await AUTH.updateUser(userId, { role: newRole });
            alert(lang === 'id' ? '✅ Role berhasil diubah' : '✅ 角色已修改');
        } catch (error) {
            alert(lang === 'id' ? 'Gagal mengubah role: ' + error.message : '修改角色失败：' + error.message);
        }
    },

    getSenderWANumber: async function(storeId) {
        return await SUPABASE.getStoreWANumber(storeId);
    },

    generateWAText: function(order, senderNumber) {
        var lang = Utils.lang;
        var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
        var monthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);
        var dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
        
        if (lang === 'id') {
            return `*Pengingat Pembayaran Bunga - JF! by Gadai*

Kepada Yth. Bapak/Ibu ${order.customer_name}

Kami ingatkan bahwa pembayaran bunga untuk pesanan dengan detail berikut:
📋 *ID Pesanan:* ${order.order_id}
💰 *Sisa Pokok:* ${Utils.formatCurrency(remainingPrincipal)}
📈 *Bunga per Bulan (10%):* ${Utils.formatCurrency(monthlyInterest)}
📅 *Jatuh Tempo:* ${dueDate}

Harap melakukan pembayaran tepat waktu.

Terima kasih atas kepercayaan Anda.

- ${senderNumber || 'JF! by Gadai'}`;
        } else {
            return `*利息缴费提醒 - JF! by Gadai*

尊敬的 ${order.customer_name} 先生/女士：

提醒您以下订单的利息缴费：
📋 *订单号:* ${order.order_id}
💰 *剩余本金:* ${Utils.formatCurrency(remainingPrincipal)}
📈 *月利息 (10%):* ${Utils.formatCurrency(monthlyInterest)}
📅 *到期日:* ${dueDate}

请按时缴费。

感谢您的信任。

- ${senderNumber || 'JF! by Gadai'}`;
        }
    },

    hasSentRemindersToday: async function() {
        var profile = await SUPABASE.getCurrentProfile();
        var today = new Date().toISOString().split('T')[0];
        var storeId = profile?.store_id;
        
        if (!storeId) return false;
        
        var { data, error } = await supabaseClient
            .from('reminder_logs')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('reminder_date', today);
        
        if (error) return false;
        return (data?.length || 0) > 0;
    },

    sendWAReminder: async function(orderId) {
        var lang = Utils.lang;
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(lang === 'id' ? 'Order tidak ditemukan' : '订单不存在');
                return;
            }
            
            var storeId = order.store_id;
            var senderNumber = await SUPABASE.getStoreWANumber(storeId);
            
            if (!senderNumber) {
                alert(lang === 'id' 
                    ? 'Nomor WhatsApp toko belum diatur. Silakan atur di menu Manajemen Toko.'
                    : '门店 WhatsApp 号码未设置，请在门店管理中设置。');
                return;
            }
            
            var customerPhone = order.customer_phone;
            if (!customerPhone) {
                alert(lang === 'id' ? 'Nomor telepon pelanggan tidak tersedia' : '客户手机号不可用');
                return;
            }
            
            var waText = encodeURIComponent(this.generateWAText(order, senderNumber));
            var waUrl = `https://wa.me/${customerPhone}?text=${waText}`;
            window.open(waUrl, '_blank');
            
        } catch (error) {
            console.error("sendWAReminder error:", error);
            alert(lang === 'id' ? 'Gagal mengirim pengingat WA' : '发送 WA 提醒失败');
        }
    },

    sendDailyReminders: async function() {
        var lang = Utils.lang;
        var hasSent = await this.hasSentRemindersToday();
        if (hasSent) {
            alert(lang === 'id' 
                ? 'Pengingat sudah dikirim hari ini. Silakan coba lagi besok.'
                : '今日已发送过提醒，请明天再试。');
            return;
        }
        
        var needRemindOrders = await SUPABASE.getOrdersNeedReminder();
        if (needRemindOrders.length === 0) {
            alert(lang === 'id' 
                ? 'Tidak ada pesanan yang perlu diingatkan hari ini.'
                : '今天没有需要提醒的订单。');
            return;
        }
        
        var confirmMsg = lang === 'id'
            ? `Akan mengirimkan pengingat WA ke ${needRemindOrders.length} nasabah. Lanjutkan?`
            : `将向 ${needRemindOrders.length} 位客户发送 WA 提醒。继续吗？`;
        
        if (!confirm(confirmMsg)) return;
        
        var successCount = 0;
        var failCount = 0;
        
        for (var order of needRemindOrders) {
            try {
                var storeId = order.store_id;
                var senderNumber = await SUPABASE.getStoreWANumber(storeId);
                if (!senderNumber) {
                    failCount++;
                    continue;
                }
                
                var customerPhone = order.customer_phone;
                if (!customerPhone) {
                    failCount++;
                    continue;
                }
                
                var waText = encodeURIComponent(this.generateWAText(order, senderNumber));
                var waUrl = `https://wa.me/${customerPhone}?text=${waText}`;
                window.open(waUrl, '_blank');
                
                await new Promise(resolve => setTimeout(resolve, 1500));
                successCount++;
                
            } catch (e) {
                console.error("发送提醒失败:", e);
                failCount++;
            }
        }
        
        if (successCount > 0) {
            var profile = await SUPABASE.getCurrentProfile();
            var today = new Date().toISOString().split('T')[0];
            await supabaseClient.from('reminder_logs').insert({
                store_id: profile?.store_id,
                reminder_date: today,
                sent_by: profile?.id,
                recipients_count: successCount
            });
        }
        
        alert(lang === 'id'
            ? `✅ Pengingat terkirim! Berhasil: ${successCount}, Gagal: ${failCount}`
            : `✅ 提醒发送完成！成功: ${successCount}, 失败: ${failCount}`);
        
        await this.renderDashboard();
    },

    updateStoreWANumber: async function(storeId, waNumber) {
        var lang = Utils.lang;
        try {
            await SUPABASE.updateStoreWANumber(storeId, waNumber);
            alert(lang === 'id' ? 'Nomor WA berhasil diperbarui' : 'WA 号码已更新');
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memperbarui: ' + error.message : '更新失败：' + error.message);
        }
    },

    showCreateOrder: function() { 
        alert(Utils.lang === 'id' ? 'Silakan pilih nasabah terlebih dahulu' : '请先选择客户'); 
        this.navigateTo('customers'); 
    },
    
    getExpensesTotal: async function() {
        var profile = await SUPABASE.getCurrentProfile();
        let query = supabaseClient.from('expenses').select('amount');
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        const { data } = await query;
        return data?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
    },
    
    addStore: async function() {
        var lang = Utils.lang;
        var name = document.getElementById("newStoreName")?.value.trim();
        var address = document.getElementById("newStoreAddress")?.value.trim();
        var phone = document.getElementById("newStorePhone")?.value.trim();
        
        if (!name) {
            alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        
        try {
            await StoreManager.createStore(name, address, phone);
            alert(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message);
        }
    },
    
    editStore: async function(storeId) { 
        await StoreManager.editStore(storeId); 
    },
    
    deleteStore: async function(storeId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus toko ini?' : '删除此门店？')) return;
        try {
            await StoreManager.deleteStore(storeId);
            alert(lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    showBlacklist: async function() {
        if (typeof window.APP.showBlacklist === 'function') {
            await window.APP.showBlacklist();
        } else {
            alert(Utils.lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
        }
    },

    showTransferModal: async function(transferType) {
        var lang = Utils.lang;
        var title = '';
        var fromLabel = '';
        var toLabel = '';
        var maxAmount = 0;
        var cashFlow = await SUPABASE.getCashFlowSummary();
        
        switch(transferType) {
            case 'cash_to_bank':
                title = lang === 'id' ? '💰 Transfer Kas ke Bank' : '💰 现金存入银行';
                fromLabel = lang === 'id' ? 'Dari Brankas (Tunai)' : '从保险柜（现金）';
                toLabel = lang === 'id' ? 'Ke Bank BNI' : '存入银行 BNI';
                maxAmount = cashFlow.cash.balance;
                break;
            case 'bank_to_cash':
                title = lang === 'id' ? '💰 Tarik Tunai dari Bank' : '💰 银行取现';
                fromLabel = lang === 'id' ? 'Dari Bank BNI' : '从银行 BNI';
                toLabel = lang === 'id' ? 'Ke Brankas (Tunai)' : '存入保险柜（现金）';
                maxAmount = cashFlow.bank.balance;
                break;
            case 'store_to_hq':
                title = lang === 'id' ? '🏢 Setoran ke Kantor Pusat' : '🏢 上缴总部';
                fromLabel = lang === 'id' ? 'Dari Bank Toko' : '从门店银行';
                toLabel = lang === 'id' ? 'Ke Kantor Pusat' : '上缴总部';
                var profile = await SUPABASE.getCurrentProfile();
                var shopAccount = await SUPABASE.getShopAccount(profile?.store_id);
                maxAmount = shopAccount.bank_balance;
                break;
            default:
                return;
        }
        
        if (maxAmount <= 0) {
            alert(lang === 'id' 
                ? `Saldo tidak mencukupi. Saldo saat ini: ${Utils.formatCurrency(maxAmount)}`
                : `余额不足。当前余额: ${Utils.formatCurrency(maxAmount)}`);
            return;
        }
        
        var amount = prompt(
            `${title}\n\n${fromLabel}\n${toLabel}\n\n${lang === 'id' ? 'Maksimal transfer' : '最大转账金额'}: ${Utils.formatCurrency(maxAmount)}\n\n${lang === 'id' ? 'Masukkan jumlah:' : '请输入金额:'}`,
            Utils.formatNumberWithCommas(maxAmount)
        );
        
        if (!amount) return;
        
        var numAmount = Utils.parseNumberFromCommas(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert(lang === 'id' ? 'Jumlah tidak valid' : '金额无效');
            return;
        }
        
        if (numAmount > maxAmount) {
            alert(lang === 'id' 
                ? `Jumlah melebihi saldo. Maksimal: ${Utils.formatCurrency(maxAmount)}`
                : `金额超过余额。最大: ${Utils.formatCurrency(maxAmount)}`);
            return;
        }
        
        var confirmMsg = lang === 'id'
            ? `Konfirmasi transfer:\n\nDari: ${fromLabel}\nKe: ${toLabel}\nJumlah: ${Utils.formatCurrency(numAmount)}\n\nLanjutkan?`
            : `确认转账：\n\n从: ${fromLabel}\n到: ${toLabel}\n金额: ${Utils.formatCurrency(numAmount)}\n\n继续吗？`;
        
        if (confirm(confirmMsg)) {
            await this.executeTransfer(transferType, numAmount);
        }
    },

    executeTransfer: async function(transferType, amount) {
        var lang = Utils.lang;
        var profile = await SUPABASE.getCurrentProfile();
        
        try {
            if (transferType === 'cash_to_bank') {
                await SUPABASE.recordInternalTransfer({
                    transfer_type: 'cash_to_bank',
                    from_account: 'cash',
                    to_account: 'bank',
                    amount: amount,
                    description: lang === 'id' ? 'Transfer kas ke bank' : '现金存入银行',
                    store_id: profile?.store_id
                });
                alert(lang === 'id' 
                    ? `✅ Transfer ${Utils.formatCurrency(amount)} dari Kas ke Bank berhasil`
                    : `✅ 成功转账 ${Utils.formatCurrency(amount)} 从保险柜到银行`);
            } else if (transferType === 'bank_to_cash') {
                await SUPABASE.recordInternalTransfer({
                    transfer_type: 'bank_to_cash',
                    from_account: 'bank',
                    to_account: 'cash',
                    amount: amount,
                    description: lang === 'id' ? 'Tarik tunai dari bank' : '银行取现',
                    store_id: profile?.store_id
                });
                alert(lang === 'id' 
                    ? `✅ Transfer ${Utils.formatCurrency(amount)} dari Bank ke Kas berhasil`
                    : `✅ 成功转账 ${Utils.formatCurrency(amount)} 从银行到保险柜`);
            } else if (transferType === 'store_to_hq') {
                await SUPABASE.remitToHeadquarters(profile?.store_id, amount, lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部');
                alert(lang === 'id' 
                    ? `✅ Setoran ${Utils.formatCurrency(amount)} ke Kantor Pusat berhasil`
                    : `✅ 成功上缴 ${Utils.formatCurrency(amount)} 到总部`);
            }
            
            await this.renderDashboard();
        } catch (error) {
            alert(lang === 'id' ? 'Transfer gagal: ' + error.message : '转账失败：' + error.message);
        }
    },

    showInternalTransferHistory: async function() {
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        
        try {
            var transfers = await SUPABASE.getInternalTransfers();
            
            var typeMap = {
                cash_to_bank: lang === 'id' ? '🏦→🏧 Kas ke Bank' : '🏦→🏧 现金存入银行',
                bank_to_cash: lang === 'id' ? '🏧→🏦 Tarik Tunai' : '🏧→🏦 银行取现',
                store_to_hq: lang === 'id' ? '🏢 Setoran ke Pusat' : '🏢 上缴总部'
            };
            
            var rows = '';
            if (transfers.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录'}</td></tr>`;
            } else {
                for (var t of transfers) {
                    rows += `<tr>
                        <td>${Utils.formatDate(t.transfer_date)}</td>
                        <td>${typeMap[t.transfer_type] || t.transfer_type}</td>
                        <td class="text-right">${Utils.formatCurrency(t.amount)}</td>
                        <td>${Utils.escapeHtml(t.description || '-')}</td>
                        <td>${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>
                        ${isAdmin ? `<td>${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}
                    </tr>`;
                }
            }
            
            var modalHtml = `
                <div id="internalTransferModal" class="modal-overlay">
                    <div class="modal-content" style="max-width:800px;">
                        <h3>🔄 ${lang === 'id' ? 'Riwayat Transfer Internal' : '内部转账记录'}</h3>
                        
                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
                            <input type="date" id="transferFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                            <input type="date" id="transferFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                            <button onclick="APP.filterInternalTransferHistory()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                            <button onclick="APP.resetInternalTransferFilters()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                        </div>
                        
                        <div class="table-container" style="max-height:400px; overflow-y:auto;">
                            <table class="data-table" style="min-width:600px;">
                                <thead>
                                    <tr>
                                        <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                        <th>${lang === 'id' ? 'Jenis Transfer' : '转账类型'}</th>
                                        <th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        <th>${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                        <th>${lang === 'id' ? 'Oleh' : '操作人'}</th>
                                        ${isAdmin ? '<th>' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody id="internalTransferBody">
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                            <button onclick="APP.exportInternalTransferToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                            <button onclick="document.getElementById('internalTransferModal').remove()" class="btn-back">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            window._internalTransfersData = transfers;
            
        } catch (error) {
            console.error("showInternalTransferHistory error:", error);
            alert(lang === 'id' ? 'Gagal memuat riwayat transfer' : '加载转账记录失败');
        }
    },

    filterInternalTransferHistory: function() {
        var transfers = window._internalTransfersData || [];
        var startDate = document.getElementById('transferFilterStart')?.value;
        var endDate = document.getElementById('transferFilterEnd')?.value;
        
        var filtered = transfers.filter(t => {
            if (startDate && t.transfer_date < startDate) return false;
            if (endDate && t.transfer_date > endDate) return false;
            return true;
        });
        
        this._renderInternalTransferHistory(filtered);
    },

    resetInternalTransferFilters: function() {
        var startInput = document.getElementById('transferFilterStart');
        var endInput = document.getElementById('transferFilterEnd');
        
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        
        this.filterInternalTransferHistory();
    },

    _renderInternalTransferHistory: function(transfers) {
        var tbody = document.getElementById('internalTransferBody');
        if (!tbody) return;
        
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        
        var typeMap = {
            cash_to_bank: lang === 'id' ? '🏦→🏧 Kas ke Bank' : '🏦→🏧 现金存入银行',
            bank_to_cash: lang === 'id' ? '🏧→🏦 Tarik Tunai' : '🏧→🏦 银行取现',
            store_to_hq: lang === 'id' ? '🏢 Setoran ke Pusat' : '🏢 上缴总部'
        };
        
        var rows = '';
        if (transfers.length === 0) {
            rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录'}</td></tr>`;
        } else {
            for (var t of transfers) {
                rows += `<tr>
                    <td>${Utils.formatDate(t.transfer_date)}</td
