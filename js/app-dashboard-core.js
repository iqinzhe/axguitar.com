// app-dashboard-core.js - v2.0

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
        sessionStorage.setItem('jf_current_keyword', this.searchKeyword || "");
    },
    
    restorePageState: function() {
        return {
            page: sessionStorage.getItem('jf_current_page'),
            filter: sessionStorage.getItem('jf_current_filter') || "all",
            keyword: sessionStorage.getItem('jf_current_keyword') || ""
        };
    },
    
    clearPageState: function() {
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_filter');
        sessionStorage.removeItem('jf_current_keyword');
        this.currentOrderId = null;
        this.currentCustomerId = null;
    },

    init: async function() {
        document.getElementById("app").innerHTML = '<div class="loading-container"><div class="loader"></div><p class="loading-text">🔄 Loading system...</p></div>';
        await AUTH.init();
        
        var savedState = this.restorePageState();
        var savedPage = savedState.page;
        var savedFilter = savedState.filter;
        var savedKeyword = savedState.keyword;
        
        if (savedPage && savedPage !== 'login' && AUTH.isLoggedIn()) {
            this.currentPage = savedPage;
            this.currentFilter = savedFilter || "all";
            this.searchKeyword = savedKeyword || "";
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
            
            // 工具栏按钮：移除导出CSV，添加备份与恢复
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

    // ==================== 简化打印功能：直接打印，不弹选项 ====================
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

    // ==================== 以下函数保持原样（未修改部分） ====================
    
    showCapitalModal: async function() {
        // ... 保持原有代码不变 ...
        // 为避免文件过长，此处省略，实际使用时请保留原函数内容
    },

    filterCapitalTransactions: function() {
        // ... 保持原有代码不变 ...
    },
    
    resetCapitalFilters: function() {
        // ... 保持原有代码不变 ...
    },
    
    _renderCapitalTransactionsTable: function(transactions) {
        // ... 保持原有代码不变 ...
    },
    
    printCapitalTransactions: function() {
        // ... 保持原有代码不变 ...
    },
    
    exportCapitalTransactionsToCSV: function() {
        // ... 保持原有代码不变 ...
    },

    showUserManagement: async function() {
        // ... 保持原有代码不变 ...
    },

    addUser: async function() {
        // ... 保持原有代码不变 ...
    },

    deleteUser: async function(userId) {
        // ... 保持原有代码不变 ...
    },

    editUser: async function(userId) {
        // ... 保持原有代码不变 ...
    },

    _saveUserRole: async function(userId) {
        // ... 保持原有代码不变 ...
    },

    getSenderWANumber: async function(storeId) {
        // ... 保持原有代码不变 ...
    },

    generateWAText: function(order, senderNumber) {
        // ... 保持原有代码不变 ...
    },

    hasSentRemindersToday: async function() {
        // ... 保持原有代码不变 ...
    },

    sendWAReminder: async function(orderId) {
        // ... 保持原有代码不变 ...
    },

    sendDailyReminders: async function() {
        // ... 保持原有代码不变 ...
    },

    updateStoreWANumber: async function(storeId, waNumber) {
        // ... 保持原有代码不变 ...
    },

    showCreateOrder: function() { alert('Please select a customer first'); this.navigateTo('customers'); },
    
    getExpensesTotal: async function() {
        // ... 保持原有代码不变 ...
    },
    
    addStore: async function() {
        // ... 保持原有代码不变 ...
    },
    
    editStore: async function(storeId) { await StoreManager.editStore(storeId); },
    
    deleteStore: async function(storeId) {
        // ... 保持原有代码不变 ...
    },

    showBlacklist: async function() {
        if (typeof window.APP.showBlacklist === 'function') {
            await window.APP.showBlacklist();
        } else {
            alert(Utils.lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
        }
    },

    showTransferModal: async function(transferType) {
        // ... 保持原有代码不变 ...
    },

    executeTransfer: async function(transferType, maxAmount) {
        // ... 保持原有代码不变 ...
    },

    showInternalTransferHistory: async function() {
        // ... 保持原有代码不变 ...
    },

    filterInternalTransferHistory: function() {
        // ... 保持原有代码不变 ...
    },

    resetInternalTransferFilters: function() {
        // ... 保持原有代码不变 ...
    },

    _renderInternalTransferHistory: function(transfers) {
        // ... 保持原有代码不变 ...
    },

    exportInternalTransferToCSV: async function() {
        // ... 保持原有代码不变 ...
    }
};

// 辅助函数：转义属性值（XSS防护）
function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

for (var key in DashboardCore) {
    if (typeof DashboardCore[key] === 'function' || key === 'currentFilter' || key === 'searchKeyword' || 
        key === 'historyStack' || key === 'currentPage' || key === 'currentOrderId' || key === 'currentCustomerId') {
        window.APP[key] = DashboardCore[key];
    }
}

// 添加 escapeAttr 到 Utils
if (typeof Utils !== 'undefined') {
    Utils.escapeAttr = escapeAttr;
}

console.log('✅ app-dashboard-core.js v2.0 已加载 - 移除导出CSV，添加备份恢复入口，简化打印');
