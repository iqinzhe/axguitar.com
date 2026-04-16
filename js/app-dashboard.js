// app-dashboard.js - 完整版（包含所有功能）
// 包含：仪表盘、登录、路由、报表、注资/提现、WA提醒（按钮闪烁/禁用逻辑）

window.APP = window.APP || {};

const DashboardModule = {
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    saveCurrentPageState: function() {
        sessionStorage.setItem('jf_current_page', this.currentPage);
        sessionStorage.setItem('jf_current_orderId', this.currentOrderId || '');
        sessionStorage.setItem('jf_current_customerId', this.currentCustomerId || '');
        sessionStorage.setItem('jf_current_filter', this.currentFilter);
        sessionStorage.setItem('jf_current_keyword', this.searchKeyword);
    },

    init: async function() {
        document.getElementById("app").innerHTML = '<div class="loading-container"><div class="loader"></div><p class="loading-text">🔄 Loading system...</p></div>';
        await AUTH.init();
        
        var savedPage = sessionStorage.getItem('jf_current_page');
        var savedOrderId = sessionStorage.getItem('jf_current_orderId');
        var savedCustomerId = sessionStorage.getItem('jf_current_customerId');
        var savedFilter = sessionStorage.getItem('jf_current_filter');
        var savedKeyword = sessionStorage.getItem('jf_current_keyword');
        
        if (savedPage && savedPage !== 'login' && AUTH.isLoggedIn()) {
            this.currentPage = savedPage;
            this.currentOrderId = savedOrderId || null;
            this.currentCustomerId = savedCustomerId || null;
            this.currentFilter = savedFilter || "all";
            this.searchKeyword = savedKeyword || "";
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
            viewOrder: async () => { if (self.currentOrderId) await self.viewOrder(self.currentOrderId); },
            payment: async () => { if (self.currentOrderId) await self.showPayment(self.currentOrderId); },
            editOrder: async () => { if (self.currentOrderId) await self.editOrder(self.currentOrderId); },
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            expenses: async () => await self.showExpenses(),
            customers: async () => await self.showCustomers(),
            paymentHistory: async () => await self.showPaymentHistory(),
            customerOrders: async () => { if (self.currentCustomerId) await self.showCustomerOrders(self.currentCustomerId); },
            customerPaymentHistory: async () => { if (self.currentCustomerId) await self.showCustomerPaymentHistory(self.currentCustomerId); }
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
            customerOrders: async () => { if (params.customerId) await self.showCustomerOrders(params.customerId); },
            customerPaymentHistory: async () => { if (params.customerId) await self.showCustomerPaymentHistory(params.customerId); },
            viewOrder: async () => { if (params.orderId) await self.viewOrder(params.orderId); },
            payment: async () => { if (params.orderId) await self.showPayment(params.orderId); },
            editOrder: async () => { if (params.orderId) await self.editOrder(params.orderId); }
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
                customerOrders: async () => { if (prev.customerId) await self.showCustomerOrders(prev.customerId); },
                customerPaymentHistory: async () => { if (prev.customerId) await self.showCustomerPaymentHistory(prev.customerId); }
            };
            var handler = backHandlers[prev.page];
            if (handler) handler();
            else this.renderDashboard();
        } else {
            this.renderDashboard();
        }
    },

    printCurrentPage: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        var printWindow = window.open('', '_blank');
        var styles = document.querySelector('link[rel="stylesheet"]')?.href || 'main.css';
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Print - JF! by Gadai</title>
                <link rel="stylesheet" href="${styles}">
                <style>
                    body { padding: 20px; background: white; color: black; }
                    .no-print, .toolbar button:not(.print-btn), button:not(.print-btn) { display: none !important; }
                    .toolbar { display: block !important; }
                    .print-btn { display: inline-block !important; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ccc; padding: 8px; }
                    .card, .stat-card, .report-store-section { background: white; border: 1px solid #ccc; color: black; }
                    .stat-value { color: #333; }
                    @media print {
                        body { margin: 0; padding: 10mm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${printContent.outerHTML}
                <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    renderLogin: async function() {
        this.currentPage = 'login';
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
                    <h2 class="login-title"><img src="/icons/system-jf.png" alt="JF!" class="login-logo"> JF! by Gadai</h2>
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
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_orderId');
        sessionStorage.removeItem('jf_current_customerId');
        sessionStorage.removeItem('jf_current_filter');
        sessionStorage.removeItem('jf_current_keyword');
        
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

    // ==================== 仪表盘（核心）====================
    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        this.saveCurrentPageState();
        try {
            var report = await Order.getReport();
            var cashFlow = await SUPABASE.getCashFlowSummary();
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            var storeName = AUTH.getCurrentStoreName();
            
            // 检查今日是否有需要提醒的客户（用于按钮状态）
            var needRemindOrders = await SUPABASE.getOrdersNeedReminder();
            var hasReminders = needRemindOrders.length > 0;
            var hasSentToday = await this.hasSentRemindersToday();
            
            // 按钮状态：如果今日已发送，则禁用；如果今日有提醒但未发送，则高亮
            var btnDisabled = hasSentToday;
            var btnHighlight = hasReminders && !hasSentToday;
            
            var cashInvestment = cashFlow.capital?.cash?.investment || 0;
            var cashWithdrawal = cashFlow.capital?.cash?.withdrawal || 0;
            var bankInvestment = cashFlow.capital?.bank?.investment || 0;
            var bankWithdrawal = cashFlow.capital?.bank?.withdrawal || 0;
            
            document.getElementById("app").innerHTML = `
                <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                    <h1><img src="/icons/system-jf.png" alt="JF!" style="height: 32px; vertical-align: middle;"> JF! by Gadai</h1>
                    <div>${this.historyStack.length > 0 ? `<button onclick="APP.goBack()">↩️ ${t('back')}</button>` : ''}</div>
                </div>
                
                <div class="cashflow-summary">
                    <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                    
                    ${isAdmin ? `
                    <div class="capital-summary" style="display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2); flex-wrap: wrap; gap: 10px;">
                        <div style="font-size: 12px;">
                            <span style="opacity:0.8;">💰 ${lang === 'id' ? 'Total Investasi' : '总投资'}:</span>
                            <strong>${Utils.formatCurrency(cashInvestment + bankInvestment)}</strong>
                            <span style="opacity:0.8; margin-left: 12px;">📤 ${lang === 'id' ? 'Penarikan' : '提现'}:</span>
                            <strong>${Utils.formatCurrency(cashWithdrawal + bankWithdrawal)}</strong>
                        </div>
                        <div>
                            <button onclick="APP.showCapitalModal()" class="capital-btn" style="background: rgba(255,255,255,0.2); border: none; padding: 4px 12px; font-size: 12px; border-radius: 6px;">🏦 ${lang === 'id' ? 'Kelola Modal' : '资金管理'}</button>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="cashflow-stats">
                        <div class="cashflow-item">
                            <div class="label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</div>
                            <div class="value ${cashFlow.cash.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.cash.balance)}</div>
                            <div style="font-size:10px; opacity:0.7;">
                                ${lang === 'id' ? 'Modal' : '本金'}: +${Utils.formatCurrency(cashInvestment)} / -${Utils.formatCurrency(cashWithdrawal)}<br>
                                ${lang === 'id' ? 'Operasional' : '运营'}: +${Utils.formatCurrency(cashFlow.cash.income)} / -${Utils.formatCurrency(cashFlow.cash.expense)}
                            </div>
                        </div>
                        <div class="cashflow-item">
                            <div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                            <div class="value ${cashFlow.bank.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.bank.balance)}</div>
                            <div style="font-size:10px; opacity:0.7;">
                                ${lang === 'id' ? 'Modal' : '本金'}: +${Utils.formatCurrency(bankInvestment)} / -${Utils.formatCurrency(bankWithdrawal)}<br>
                                ${lang === 'id' ? 'Operasional' : '运营'}: +${Utils.formatCurrency(cashFlow.bank.income)} / -${Utils.formatCurrency(cashFlow.bank.expense)}
                            </div>
                        </div>
                        <div class="cashflow-item">
                            <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
                            <div class="value">${Utils.formatCurrency(cashFlow.total.balance)}</div>
                            <div style="font-size:10px; opacity:0.7;">
                                📈 ${lang === 'id' ? 'Laba/Rugi' : '盈亏'}: ${Utils.formatCurrency(cashFlow.total.netIncome)}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${report.total_orders}</div><div>${t('total_orders')}</div></div>
                    <div class="stat-card"><div class="stat-value">${report.active_orders}</div><div>${t('active')}</div></div>
                    <div class="stat-card"><div class="stat-value">${report.completed_orders}</div><div>${t('completed')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div><div>${t('total_loan')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_admin_fees)}</div><div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_interest)}</div><div>${lang === 'id' ? 'Bunga Diterima' : '已收利息'}</div></div>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.navigateTo('customers')">👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</button>
                    <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                    <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</button>
                    <button onclick="APP.navigateTo('expenses')">📝 ${lang === 'id' ? 'Pengeluaran' : '运营支出'}</button>
                    <button id="reminderBtn" onclick="APP.sendDailyReminders()" class="warning" style="background:${btnHighlight ? '#25D366' : '#94a3b8'}; opacity:${btnDisabled ? '0.5' : '1'}; ${btnDisabled ? 'cursor: not-allowed;' : ''}" ${btnDisabled ? 'disabled' : ''}>
                        📱 ${lang === 'id' ? 'Kirim Pengingat' : '发送提醒'} ${hasReminders ? `(${needRemindOrders.length})` : ''}
                    </button>
                    ${isAdmin ? `<button onclick="APP.navigateTo('report')">📊 ${t('financial_report')}</button>` : ''}
                    ${isAdmin ? `<button onclick="APP.navigateTo('userManagement')">👥 ${t('user_management')}</button>` : ''}
                    ${isAdmin ? `<button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</button>` : ''}
                    <button onclick="APP.logout()">🚪 ${t('logout')}</button>
                </div>
                
<div class="card" style="padding: 8px 16px; margin-bottom: 0;">
    <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600;">${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : AUTH.user.role === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工')})</h3>
    <p style="margin: 2px 0; line-height: 1.3;">🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
    <p style="margin: 2px 0; line-height: 1.3;">📌 ${lang === 'id' ? 'Admin Fee: (dibayar saat kontrak) | Bunga: 10% per bulan' : '管理费: (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
    ${!isAdmin ? `<p style="margin: 2px 0; line-height: 1.3; color: #f59e0b;">🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>` : ''}
</div>
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p style="color:#ef4444;">⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    // ==================== 注资/提现模态框 ====================
    showCapitalModal: async function() {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        var transactions = [];
        try {
            transactions = await SUPABASE.getCapitalTransactions();
        } catch(e) { console.error(e); }
        
        var transactionRows = '';
        if (transactions.length === 0) {
            transactionRows = `<tr><td colspan="5" class="text-center" style="padding: 20px;">${lang === 'id' ? 'Belum ada transaksi modal' : '暂无资金记录'}</td></tr>`;
        } else {
            var typeMap = {
                investment: lang === 'id' ? '💰 Investasi' : '💰 注资',
                withdrawal: lang === 'id' ? '📤 Penarikan' : '📤 提现',
                dividend: lang === 'id' ? '📊 Dividen' : '📊 分红'
            };
            for (var txn of transactions.slice(0, 10)) {
                transactionRows += `<tr>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">${Utils.formatDate(txn.transaction_date)}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">${typeMap[txn.type] || txn.type}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${txn.payment_method === 'cash' ? '🏦 ' + (lang === 'id' ? 'Tunai' : '现金') : '🏧 ' + (lang === 'id' ? 'Bank' : '银行')}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; ${txn.type === 'investment' ? 'color: #10b981;' : 'color: #ef4444;'}">${Utils.formatCurrency(txn.amount)}</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${Utils.escapeHtml(txn.description || '-')}</td>
                　　`;
            }
        }
        
        var modal = document.createElement('div');
        modal.id = 'capitalModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 550px; max-height: 85vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin:0;">🏦 ${lang === 'id' ? 'Kelola Modal' : '资金管理'}</h3>
                    <button onclick="document.getElementById('capitalModal').remove()" style="background: none; color: #64748b; font-size: 20px; border: none; cursor: pointer;">✖</button>
                </div>
                
                <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; font-size: 14px;">📝 ${lang === 'id' ? 'Tambah Transaksi Baru' : '新增交易'}</h4>
                    <div class="form-grid" style="gap: 12px;">
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Tipe' : '类型'}</label>
                            <select id="capitalType" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                                <option value="investment">💰 ${lang === 'id' ? 'Investasi (Tambah Modal)' : '注资（增加本金）'}</option>
                                <option value="withdrawal">📤 ${lang === 'id' ? 'Penarikan (Ambil Modal)' : '提现（取出本金）'}</option>
                                <option value="dividend">📊 ${lang === 'id' ? 'Dividen (Bagi Hasil)' : '分红（利润分配）'}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Metode' : '方式'}</label>
                            <select id="capitalMethod" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                                <option value="cash">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜（现金）'}</option>
                                <option value="bank">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Jumlah (IDR)' : '金额'}</label>
                            <input type="text" id="capitalAmount" placeholder="0" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; text-align: right;">
                        </div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Keterangan' : '说明'}</label>
                            <input type="text" id="capitalDesc" placeholder="${lang === 'id' ? 'Contoh: Modal awal, Setoran modal, dll' : '例如：初始资金、注资等'}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Tanggal' : '日期'}</label>
                            <input type="date" id="capitalDate" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        </div>
                    </div>
                    <div class="form-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
                        <button onclick="APP.saveCapitalTransaction()" class="success" style="padding: 8px 16px;">💾 ${lang === 'id' ? 'Simpan Transaksi' : '保存交易'}</button>
                    </div>
                </div>
                
                <h4 style="margin: 0 0 12px 0; font-size: 14px;">📋 ${lang === 'id' ? 'Riwayat Transaksi Modal' : '资金流水记录'}</h4>
                <div class="table-container" style="max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc;">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc;">${lang === 'id' ? 'Tipe' : '类型'}</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc;">${lang === 'id' ? 'Metode' : '方式'}</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc;">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th style="padding: 8px; border: 1px solid #cbd5e1; background: #f8fafc;">${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr>
                        </thead>
                        <tbody>${transactionRows}</tbody>
                    </table>
                </div>
                
                <div class="modal-actions" style="margin-top: 16px; display: flex; justify-content: flex-end;">
                    <button onclick="document.getElementById('capitalModal').remove()" style="padding: 8px 16px; background: #64748b;">${lang === 'id' ? 'Tutup' : '关闭'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        var amountInput = document.getElementById('capitalAmount');
        if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
    },

    saveCapitalTransaction: async function() {
        var lang = Utils.lang;
        var type = document.getElementById('capitalType').value;
        var paymentMethod = document.getElementById('capitalMethod').value;
        var amountStr = document.getElementById('capitalAmount').value;
        var amount = Utils.parseNumberFromCommas(amountStr);
        var description = document.getElementById('capitalDesc').value.trim();
        var transactionDate = document.getElementById('capitalDate').value;
        
        if (!amount || amount <= 0) {
            alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
            return;
        }
        
        var typeText = type === 'investment' ? (lang === 'id' ? 'investasi' : '注资') : 
                       type === 'withdrawal' ? (lang === 'id' ? 'penarikan' : '提现') : 
                       (lang === 'id' ? 'dividen' : '分红');
        var methodText = paymentMethod === 'cash' ? (lang === 'id' ? 'Brankas' : '保险柜') : 'Bank BNI';
        
        if (!confirm(lang === 'id' ? 
            `Konfirmasi ${typeText} ${Utils.formatCurrency(amount)} via ${methodText}?` : 
            `确认${typeText} ${Utils.formatCurrency(amount)}，方式：${methodText}？`)) {
            return;
        }
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            await SUPABASE.addCapitalTransaction({
                store_id: profile.store_id,
                type: type,
                payment_method: paymentMethod,
                amount: amount,
                description: description || (type === 'investment' ? (lang === 'id' ? 'Setoran modal awal' : '初始注资') : ''),
                transaction_date: transactionDate
            });
            alert(lang === 'id' ? 'Transaksi modal berhasil disimpan' : '资金交易保存成功');
            document.getElementById('capitalModal')?.remove();
            await this.renderDashboard();
        } catch (error) {
            console.error("saveCapitalTransaction error:", error);
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    // ==================== WA 提醒功能 ====================

    getSenderWANumber: async function(storeId) {
        var storeWANumber = await SUPABASE.getStoreWANumber(storeId);
        if (storeWANumber) {
            return storeWANumber;
        }
        return null;
    },

    generateWAText: function(order, senderNumber) {
        var lang = Utils.lang;
        var remainingPrincipal = order.loan_amount - order.principal_paid;
        var monthlyInterest = remainingPrincipal * 0.10;
        var dueDate = Utils.formatDate(order.next_interest_due_date);
        
        return lang === 'id' 
            ? `Halo *${Utils.escapeHtml(order.customer_name)}*,

Kami ingin mengingatkan bahwa pembayaran bunga pinjaman Anda akan jatuh tempo *dalam 2 hari*.

📋 *ID Pesanan:* ${order.order_id}
💰 *Sisa Pokok:* ${Utils.formatCurrency(remainingPrincipal)}
📅 *Bunga per Bulan:* ${Utils.formatCurrency(monthlyInterest)}
⏰ *Tanggal Jatuh Tempo:* ${dueDate}

Mohon persiapkan pembayaran Anda.

Terima kasih,
*${AUTH.getCurrentStoreName()}*
📞 ${senderNumber}`

            : `您好 *${Utils.escapeHtml(order.customer_name)}*，

温馨提醒，您的贷款利息将在 *2天后* 到期。

📋 *订单号:* ${order.order_id}
💰 *剩余本金:* ${Utils.formatCurrency(remainingPrincipal)}
📅 *月利息:* ${Utils.formatCurrency(monthlyInterest)}
⏰ *到期日:* ${dueDate}

请您提前准备。

感谢您，
*${AUTH.getCurrentStoreName()}*
📞 ${senderNumber}`;
    },

    copyToClipboard: async function(text) {
        var lang = Utils.lang;
        try {
            await navigator.clipboard.writeText(text);
            alert(lang === 'id' ? '✅ Teks berhasil disalin! Buka WhatsApp dan paste.' : '✅ 文本已复制！请打开 WhatsApp 粘贴发送。');
        } catch (err) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert(lang === 'id' ? '✅ Teks berhasil disalin!' : '✅ 文本已复制！');
        }
    },

    hasSentRemindersToday: async function() {
        var profile = await SUPABASE.getCurrentProfile();
        var today = new Date().toISOString().split('T')[0];
        
        let query = supabaseClient
            .from('reminder_logs')
            .select('id', { count: 'exact', head: true })
            .eq('reminder_date', today);
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            const { data: orders } = await supabaseClient
                .from('orders')
                .select('id')
                .eq('store_id', profile.store_id);
            const orderIds = orders?.map(o => o.id) || [];
            if (orderIds.length > 0) {
                query = query.in('order_id', orderIds);
            } else {
                return false;
            }
        }
        
        const { count, error } = await query;
        if (error) return false;
        return count > 0;
    },

    sendWAReminder: async function(orderId) {
        var lang = Utils.lang;
        try {
            var { order } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) {
                alert(lang === 'id' ? 'Order tidak ditemukan' : '订单不存在');
                return;
            }
            
            var senderNumber = await this.getSenderWANumber(order.store_id);
            if (!senderNumber) {
                alert(lang === 'id' 
                    ? '⚠️ Toko ini belum memiliki nomor WA. Silakan isi nomor WA di halaman Manajemen Toko.'
                    : '⚠️ 该门店未配置 WA 号码，请在门店管理中填写。');
                return;
            }
            
            var waText = this.generateWAText(order, senderNumber);
            
            var phone = order.customer_phone.replace(/[^0-9]/g, '');
            if (!phone.startsWith('62')) {
                phone = '62' + phone.replace(/^0+/, '');
            }
            
            var waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
            window.open(waUrl, '_blank');
            
            await SUPABASE.logReminder(order.id);
            
        } catch (error) {
            console.error("sendWAReminder error:", error);
            alert(lang === 'id' ? 'Gagal mengirim pengingat: ' + error.message : '发送提醒失败：' + error.message);
        }
    },

    sendDailyReminders: async function() {
        var lang = Utils.lang;
        var button = document.getElementById('reminderBtn');
        
        // 检查按钮是否禁用
        if (button && button.disabled) {
            alert(lang === 'id' ? 'Pengingat sudah dikirim hari ini.' : '今日已发送过提醒。');
            return;
        }
        
        try {
            var orders = await SUPABASE.getOrdersNeedReminder();
            
            if (orders.length === 0) {
                alert(lang === 'id' ? '📭 Tidak ada pengingat yang perlu dikirim hari ini.' : '📭 今天没有需要发送的提醒。');
                return;
            }
            
            // 过滤没有 WA 号码的门店
            var validOrders = [];
            var skippedStores = [];
            
            for (var order of orders) {
                var senderNumber = await this.getSenderWANumber(order.store_id);
                if (senderNumber) {
                    validOrders.push({ order, senderNumber });
                } else {
                    var storeName = await SUPABASE.getStoreName(order.store_id);
                    if (!skippedStores.includes(storeName)) {
                        skippedStores.push(storeName);
                    }
                }
            }
            
            if (validOrders.length === 0) {
                var msg = lang === 'id'
                    ? `⚠️ Tidak dapat mengirim pengingat. ${skippedStores.length > 0 ? `Toko ${skippedStores.join(', ')} belum memiliki nomor WA.` : ''}`
                    : `⚠️ 无法发送提醒。${skippedStores.length > 0 ? `门店 ${skippedStores.join(', ')} 未配置 WA 号码。` : ''}`;
                alert(msg);
                return;
            }
            
            var confirmMsg = lang === 'id'
                ? `📱 Akan mengirim ${validOrders.length} pengingat.${skippedStores.length > 0 ? `\n\n⚠️ Melewatkan ${skippedStores.length} order dari toko tanpa WA.` : ''}\n\nLanjutkan?`
                : `📱 将发送 ${validOrders.length} 条提醒。${skippedStores.length > 0 ? `\n\n⚠️ 跳过 ${skippedStores.length} 条来自未配置 WA 门店的订单。` : ''}\n\n继续？`;
            
            if (!confirm(confirmMsg)) return;
            
            // 禁用按钮
            if (button) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.backgroundColor = '#94a3b8';
                button.innerText = lang === 'id' ? '⏳ Mengirim...' : '⏳ 发送中...';
            }
            
            try {
                for (var i = 0; i < validOrders.length; i++) {
                    var item = validOrders[i];
                    var waText = this.generateWAText(item.order, item.senderNumber);
                    var phone = item.order.customer_phone?.replace(/[^0-9]/g, '') || '';
                    if (!phone.startsWith('62')) {
                        phone = '62' + phone.replace(/^0+/, '');
                    }
                    
                    var waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
                    window.open(waUrl, '_blank');
                    
                    await SUPABASE.logReminder(item.order.id);
                    
                    if (i < validOrders.length - 1) {
                        await new Promise(r => setTimeout(r, 1500));
                    }
                }
                
                alert(lang === 'id' 
                    ? `✅ ${validOrders.length} pengingat telah disiapkan.`
                    : `✅ 已准备 ${validOrders.length} 条提醒。`);
                
                if (button) {
                    button.innerText = lang === 'id' ? '✅ Terkirim' : '✅ 已发送';
                }
                
            } catch (err) {
                if (button) {
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.style.backgroundColor = '#25D366';
                    button.innerText = lang === 'id' ? '📱 Kirim Pengingat' : '📱 发送提醒';
                }
                throw err;
            }
            
        } catch (error) {
            console.error("sendDailyReminders error:", error);
            alert(lang === 'id' ? 'Gagal mengirim pengingat massal' : '批量发送提醒失败');
            
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.backgroundColor = '#25D366';
                button.innerText = lang === 'id' ? '📱 Kirim Pengingat' : '📱 发送提醒';
            }
        }
    },

    updateStoreWANumber: async function(storeId, waNumber) {
        var lang = Utils.lang;
        waNumber = waNumber.replace(/[^0-9]/g, '');
        
        try {
            await SUPABASE.updateStoreWANumber(storeId, waNumber || null);
            
            var msg = document.createElement('div');
            msg.textContent = lang === 'id' ? '✅ Tersimpan' : '✅ 已保存';
            msg.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#10b981; color:white; padding:8px 16px; border-radius:8px; z-index:9999;';
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 1500);
            
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    // ==================== 订单列表 ====================
    showOrderTable: async function() {
        this.currentPage = 'orderTable';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        try {
            var filters = { status: this.currentFilter, search: this.searchKeyword };
            var orders = await SUPABASE.getOrders(filters);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;

            var rows = '';
            if (orders.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 10 : 9}" class="text-center">${t('no_data')}</td></tr>`;
            } else {
                for (var o of orders) {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    rows += `<tr>
                        <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                        <td>${Utils.escapeHtml(o.customer_name)}</td>
                        <td>${Utils.escapeHtml(o.collateral_name)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.loan_amount)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.admin_fee)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.monthly_interest || 0)}</td>
                        <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</td>
                        <td class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                        ${isAdmin ? `<td>${Utils.escapeHtml(storeMap[o.store_id] || '-')}</td>` : ''}
                        <td class="action-cell">
                            <button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})" class="btn-small">👁️ ${t('view')}</button>
                            ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})" class="btn-small success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                            ${PERMISSION.canDeleteOrder() ? `<button class="danger btn-small" onclick="APP.deleteOrder('${o.order_id}')">🗑️ ${t('delete')}</button>` : ''}
                            <button onclick="APP.printOrder('${o.order_id}')" class="btn-small print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            ${o.is_locked ? `<span class="locked-icon">🔒</span>` : ''}
                        </td>
                    　　　`;
                }
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📋 ${t('order_list')}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="toolbar">
                    <input type="text" id="searchInput" placeholder="🔍 ${t('search')}..." value="${Utils.escapeHtml(this.searchKeyword)}">
                    <button onclick="APP.searchOrders()">${t('search')}</button>
                    <button onclick="APP.resetSearch()">${t('reset')}</button>
                    <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                        <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>${t('total_orders')}</option>
                        <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                    <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                </div>
                <div class="table-container">
                    <table class="data-table order-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>${t('customer_name')}</th>
                                <th>${t('collateral_name')}</th>
                                <th class="text-right">${t('loan_amount')}</th>
                                <th class="text-right">${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                <th class="text-right">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</th>
                                <th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                <th class="text-center">${lang === 'id' ? 'Status' : '状态'}</th>
                                ${isAdmin ? `<th>${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } catch (err) {
            console.error("showOrderTable error:", err);
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },

    searchOrders: function() { this.searchKeyword = document.getElementById("searchInput").value; this.showOrderTable(); },
    resetSearch: function() { this.searchKeyword = ""; this.currentFilter = "all"; this.showOrderTable(); },
    filterOrders: function(status) { this.currentFilter = status; this.showOrderTable(); },

    // ==================== 查看订单详情 ====================
    viewOrder: async function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('Order not found'); this.goBack(); return; }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            
            var payRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    payRows += `<tr>
                        <td>${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td>${Utils.escapeHtml(p.description || '-')}</td>
                    　　　`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td></tr>`;
            }

            var remainingPrincipal = order.loan_amount - order.principal_paid;
            document.getElementById("app").innerHTML = `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📄 ${t('view')} ${t('order_list')}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                    <p><strong>ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>${lang === 'id' ? 'Status' : '状态'}:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                    <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                    ${order.is_locked ? `<p><strong>🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</strong></p>` : ''}
                    
                    <h3>${t('customer_info')}</h3>
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer_name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(order.customer_ktp)}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(order.customer_phone)}</p>
                    <p><strong>${t('address')}:</strong> ${Utils.escapeHtml(order.customer_address)}</p>
                    
                    <h3>${t('collateral_info')}</h3>
                    <p><strong>${t('collateral_name')}:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                    <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                    
                    <h3>💰 ${lang === 'id' ? 'Rincian Biaya' : '费用明细'}</h3>
                    <p><strong>${lang === 'id' ? 'Admin Fee' : '管理费'}:</strong> ${Utils.formatCurrency(order.admin_fee)} ${order.admin_fee_paid ? '✅' : '❌'}</p>
                    <p><strong>${lang === 'id' ? 'Bunga per Bulan' : '月利息'}:</strong> ${Utils.formatCurrency(order.monthly_interest)}</p>
                    <p><strong>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}:</strong> ${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(order.interest_paid_total)})</p>
                    <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    <p><strong>${t('notes')}:</strong> ${Utils.escapeHtml(order.notes || '-')}</p>
                    
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h3>
                    <div class="table-container">
                        <table class="payment-table">
                            <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                            <tbody>${payRows}</tbody>
                        </table>
                    </div>
                    
                    <div class="toolbar">
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                        ${order.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${order.order_id}'})" class="success">💰 ${t('save')}</button>` : ''}
                        ${PERMISSION.canUnlockOrder() && order.is_locked ? `<button onclick="APP.unlockOrder('${order.order_id}')" class="warning">🔓 ${lang === 'id' ? 'Buka Kunci' : '解锁'}</button>` : ''}
                        <button onclick="APP.sendWAReminder('${order.order_id}')" class="warning" style="background:#25D366;">📱 ${lang === 'id' ? 'WA Pengingat' : 'WA提醒'}</button>
                        <button onclick="APP.printOrder('${order.order_id}')" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>
                </div>`;
        } catch (error) {
            console.error("viewOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            this.goBack();
        }
    },

    unlockOrder: async function(orderId) {
        if (confirm(Utils.lang === 'id' ? 'Buka kunci order ini?' : '解锁此订单？')) {
            try { await Order.unlockOrder(orderId); await this.viewOrder(orderId); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    editOrder: async function(orderId) {
        this.currentPage = 'editOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var canEdit = PERMISSION.canEditOrder(order);
            if (!canEdit) { alert(lang === 'id' ? 'Order ini sudah terkunci' : '此订单已锁定'); this.goBack(); return; }
            document.getElementById("app").innerHTML = `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>✏️ ${t('edit')}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card">
                    <div class="form-grid">
                        <div class="form-group"><label>${t('customer_name')}</label><input id="name" value="${Utils.escapeHtml(order.customer_name)}"></div>
                        <div class="form-group"><label>${t('ktp_number')}</label><input id="ktp" value="${Utils.escapeHtml(order.customer_ktp)}"></div>
                        <div class="form-group"><label>${t('phone')}</label><input id="phone" value="${Utils.escapeHtml(order.customer_phone)}"></div>
                        <div class="form-group"><label>${t('collateral_name')}</label><input id="collateral" value="${Utils.escapeHtml(order.collateral_name)}"></div>
                        <div class="form-group full-width"><label>${t('address')}</label><textarea id="address">${Utils.escapeHtml(order.customer_address)}</textarea></div>
                        <div class="form-group full-width"><label>${t('notes')}</label><textarea id="notes">${Utils.escapeHtml(order.notes || '')}</textarea></div>
                        <div class="form-actions">
                            <button onclick="APP.updateOrder('${order.order_id}')" class="success">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) { console.error("editOrder error:", error); alert('Error loading order'); this.goBack(); }
    },

    updateOrder: async function(orderId) {
        var order = await SUPABASE.getOrder(orderId);
        var updates = {
            customer: { name: document.getElementById("name").value, ktp: document.getElementById("ktp").value, phone: document.getElementById("phone").value, address: document.getElementById("address").value },
            collateral_name: document.getElementById("collateral").value,
            notes: document.getElementById("notes").value
        };
        try {
            await Order.update(orderId, updates, order.customer_id);
            if (AUTH.isAdmin()) await Order.relockOrder(orderId);
            alert(Utils.t('order_updated'));
            this.goBack();
        } catch (error) { alert('Error: ' + error.message); }
    },

    deleteOrder: async function(orderId) {
        if (confirm(Utils.t('confirm_delete'))) {
            try { await Order.delete(orderId); alert(Utils.t('order_deleted')); await this.showOrderTable(); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert(Utils.lang === 'id' ? 'Order tidak ditemukan' : '订单不存在'); return; }
            var lang = Utils.lang;
            var methodMap = { cash: lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)', bank: lang === 'id' ? 'Transfer Bank BNI' : '银行转账 BNI' };
            
            var printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JF! by Gadai - ${order.order_id}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; }
                .print-container { max-width: 210mm; margin: 0 auto; padding: 5mm; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
                .header h1 { font-size: 18px; margin: 5px 0; }
                .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
                .section { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 15px; }
                .section h3 { font-size: 12px; font-weight: 700; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
                .info-row { display: flex; margin-bottom: 4px; }
                .info-label { width: 90px; font-weight: 600; color: #475569; }
                .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 10px; }
                .data-table th { background: #f1f5f9; font-weight: 700; }
                .text-right { text-align: right; }
                .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
                .no-print { text-align: center; padding: 10px; margin-bottom: 15px; }
                .no-print button { margin: 0 5px; padding: 6px 14px; cursor: pointer; border: none; border-radius: 4px; }
                .btn-print { background: #3b82f6; color: white; }
                .btn-close { background: #64748b; color: white; }
                @media print { @page { size: A4; margin: 10mm; } body { margin: 0; padding: 0; } .no-print { display: none; } }
            </style>
            </head><body>
            <div class="print-container">
                <div class="no-print"><button class="btn-print" onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button><button class="btn-close" onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button></div>
                <div class="header"><h1>JF! by Gadai</h1><p>${lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证'} | <strong>${order.order_id}</strong> | ${Utils.formatDate(order.created_at)}</p></div>
                <div class="two-col">
                    <div class="section"><h3>📋 ${lang === 'id' ? 'Informasi Pelanggan' : '客户信息'}</h3>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Nama' : '姓名'}:</div><div>${Utils.escapeHtml(order.customer_name)}</div></div>
                        <div class="info-row"><div class="info-label">KTP:</div><div>${Utils.escapeHtml(order.customer_ktp || '-')}</div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Telepon' : '电话'}:</div><div>${Utils.escapeHtml(order.customer_phone || '-')}</div></div>
                    </div>
                    <div class="section"><h3>💎 ${lang === 'id' ? 'Jaminan & Pinjaman' : '质押物与贷款'}</h3>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Barang' : '物品'}:</div><div>${Utils.escapeHtml(order.collateral_name)}</div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pinjaman' : '贷款'}:</div><div><strong>${Utils.formatCurrency(order.loan_amount)}</strong></div></div>
                        <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div><strong>${Utils.formatCurrency(order.loan_amount - order.principal_paid)}</strong></div></div>
                    </div>
                </div>
                <div class="section"><h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</h3>
                    <table class="data-table"><thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th></tr></thead>
                    <tbody>`;
            for (var p of payments) {
                var tt = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                printContent += `<tr><td>${Utils.formatDate(p.date)}</td><td>${tt}</td><td class="text-right">${Utils.formatCurrency(p.amount)}</td><td>${methodMap[p.payment_method] || '-'}</td></tr>`;
            }
            printContent += `</tbody></table></div><div class="footer">${lang === 'id' ? 'Dicetak pada' : '打印时间'}: ${new Date().toLocaleString()} | © JF! by Gadai</div></div></body></html>`;
            var pw = window.open('', '_blank');
            pw.document.write(printContent);
            pw.document.close();
        } catch (error) { console.error("printOrder error:", error); alert(Utils.lang === 'id' ? 'Gagal mencetak order' : '打印订单失败'); }
    },

    showCreateOrder: function() { alert('Please select a customer first'); this.navigateTo('customers'); },
    
    getExpensesTotal: async function() {
        const profile = await SUPABASE.getCurrentProfile();
        let query = supabaseClient.from('expenses').select('amount');
        if (profile?.role !== 'admin' && profile?.store_id) query = query.eq('store_id', profile.store_id);
        const { data, error } = await query;
        if (error) throw error;
        return { total: data?.reduce((s, e) => s + e.amount, 0) || 0, items: data };
    },
    
    addStore: async function() {
        var code = document.getElementById("newStoreCode").value.trim();
        var name = document.getElementById("newStoreName").value.trim();
        var address = document.getElementById("newStoreAddress").value;
        var phone = document.getElementById("newStorePhone").value;
        var lang = Utils.lang;
        if (!code || !name) { alert(lang === 'id' ? 'Kode dan nama toko harus diisi' : '门店编码和名称必须填写'); return; }
        try { await StoreManager.createStore(code, name, address, phone); alert(lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功'); await StoreManager.renderStoreManagement(); } 
        catch (error) { console.error("addStore error:", error); alert(lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message); }
    },
    
    editStore: async function(storeId) { await StoreManager.editStore(storeId); },
    
    deleteStore: async function(storeId) {
        if (confirm(Utils.lang === 'id' ? 'Hapus toko ini?' : '删除此门店？')) {
            try { await StoreManager.deleteStore(storeId); await StoreManager.renderStoreManagement(); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    // ==================== 用户管理 ====================
    showUserManagement: async function() {
        this.currentPage = 'userManagement';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            var users = await AUTH.getAllUsers();
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;
            users.sort((a, b) => (storeMap[a.store_id] || '').localeCompare(storeMap[b.store_id] || ''));

            var userRows = '';
            for (var u of users) {
                var isCurrent = u.id === AUTH.user.id;
                var storeName = storeMap[u.store_id] || '-';
                var roleText = u.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : u.role === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工');
                var usernameDisplay = u.username || u.email || '-';
                var actionHtml = '';
                if (isCurrent) {
                    actionHtml = `<span style="color:#10b981;">✅ ${lang === 'id' ? 'Saya' : '当前'}</span>`;
                } else {
                    actionHtml = `<button onclick="APP.editUser('${u.id}')" class="btn-small">✏️ ${t('edit')}</button><button class="danger btn-small" onclick="APP.deleteUser('${u.id}')">🗑️ ${t('delete')}</button>`;
                }
                userRows += `<tr>
                    <td>${Utils.escapeHtml(usernameDisplay)}</td>
                    <td>${Utils.escapeHtml(u.name)}</td>
                    <td>${roleText}</td>
                    <td>${Utils.escapeHtml(storeName)}</td>
                    <td class="action-cell">${actionHtml}</td>
                　　`;
            }

            if (users.length === 0) userRows = `<tr><td colspan="5" class="text-center">${t('no_data')}</td></tr>`;

            var storeOptions = `<option value="">${lang === 'id' ? 'Pilih Toko' : '选择门店'}</option>`;
            for (var s of stores) storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>👥 ${t('user_management')}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card"><h3>${lang === 'id' ? 'Daftar Pengguna' : '用户列表'}</h3>
                    <div class="table-container"><table class="user-table"><thead><tr><th>${t('username')}</th><th>${lang === 'id' ? 'Nama' : '姓名'}</th><th>${lang === 'id' ? 'Peran' : '角色'}</th><th>${lang === 'id' ? 'Toko' : '门店'}</th><th>${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead><tbody>${userRows}</tbody></table></div>
                </div>
                <div class="card"><h3>${lang === 'id' ? 'Tambah Pengguna Baru' : '添加新用户'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${t('username')} *</label><input id="newUsername" placeholder="email@domain.com"></div>
                        <div class="form-group"><label>${t('password')} *</label><input id="newPassword" type="password"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label><input id="newName"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Peran' : '角色'}</label><select id="newRole"><option value="admin">${lang === 'id' ? 'Administrator' : '管理员'}</option><option value="store_manager">${lang === 'id' ? 'Manajer Toko' : '店长'}</option><option value="staff">${lang === 'id' ? 'Staf' : '员工'}</option></select></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Toko' : '门店'}</label><select id="newStoreId">${storeOptions}</select></div>
                        <div class="form-actions"><button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button></div>
                    </div>
                </div>
                <div class="toolbar"><button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button></div>`;
        } catch (error) { console.error("showUserManagement error:", error); alert(Utils.lang === 'id' ? 'Gagal memuat manajemen pengguna' : '加载用户管理失败'); }
    },

    addUser: async function() {
        var username = document.getElementById("newUsername").value.trim();
        var password = document.getElementById("newPassword").value;
        var name = document.getElementById("newName").value.trim();
        var role = document.getElementById("newRole").value;
        var storeId = document.getElementById("newStoreId").value;
        if (!username || !password || !name) { alert(Utils.lang === 'id' ? 'Harap isi semua field' : '请填写所有字段'); return; }
        try { await AUTH.addUser(username, password, name, role, storeId || null); alert((Utils.lang === 'id' ? 'Pengguna "' : '用户 "') + username + '" ' + (Utils.lang === 'id' ? 'berhasil ditambahkan!' : '添加成功！')); await this.showUserManagement(); } 
        catch (error) { alert('Error: ' + error.message); }
    },

    deleteUser: async function(userId) {
        if (confirm(Utils.lang === 'id' ? 'Hapus pengguna ini?' : '删除此用户？')) {
            try { await AUTH.deleteUser(userId); await this.showUserManagement(); } 
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    editUser: async function(userId) {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: user, error } = await supabaseClient.from('user_profiles').select('*').eq('id', userId).single();
            if (error) throw error;
            var modal = document.createElement('div');
            modal.id = 'editUserModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content"><h3>✏️ ${lang === 'id' ? 'Ubah Peran Pengguna' : '修改用户角色'}</h3><div class="form-group"><label>${lang === 'id' ? 'Peran' : '角色'}</label><select id="editRoleSelect"><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>${lang === 'id' ? 'Administrator' : '管理员'}</option><option value="store_manager" ${user.role === 'store_manager' ? 'selected' : ''}>${lang === 'id' ? 'Manajer Toko' : '店长'}</option><option value="staff" ${user.role === 'staff' ? 'selected' : ''}>${lang === 'id' ? 'Staf' : '员工'}</option></select></div><div class="modal-actions"><button onclick="APP._saveUserRole('${userId}')" class="success">💾 ${t('save')}</button><button onclick="document.getElementById('editUserModal').remove()">✖ ${t('cancel')}</button></div></div>`;
            document.body.appendChild(modal);
        } catch (error) { alert(lang === 'id' ? 'Gagal memuat data pengguna' : '加载用户数据失败'); }
    },

    _saveUserRole: async function(userId) {
        var lang = Utils.lang;
        var newRole = document.getElementById('editRoleSelect').value;
        try { await AUTH.updateUser(userId, { role: newRole }); document.getElementById('editUserModal')?.remove(); alert(lang === 'id' ? 'Peran pengguna berhasil diubah' : '用户角色已修改'); await this.showUserManagement(); } 
        catch (error) { alert('Error: ' + error.message); }
    },

    // ==================== 财务报表 ====================
    showReport: async function() {
        this.currentPage = 'report';
        this.saveCurrentPageState();
        try {
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            
            console.log('开始加载财务报表数据...');
            const startTime = Date.now();
            
            const [storesResult, allOrdersResult, allExpensesResult, allPaymentsResult, cashFlow] = await Promise.all([
                supabaseClient.from('stores').select('*').order('name'),
                supabaseClient.from('orders').select('*'),
                supabaseClient.from('expenses').select('*'),
                supabaseClient.from('payment_history').select('*'),
                SUPABASE.getCashFlowSummary()
            ]);
            
            const stores = storesResult.data || [];
            const allOrders = allOrdersResult.data || [];
            const allExpenses = allExpensesResult.data || [];
            const allPayments = allPaymentsResult.data || [];
            
            console.log(`数据加载完成: 门店 ${stores.length} 家, 订单 ${allOrders.length} 条, 支出 ${allExpenses.length} 条, 付款 ${allPayments.length} 条, 耗时 ${Date.now() - startTime}ms`);
            
            const orderStoreMap = {};
            for (const order of allOrders) {
                orderStoreMap[order.id] = order.store_id;
            }
            
            const paymentsByStore = {};
            const expensesByStore = {};
            const ordersByStore = {};
            
            for (const payment of allPayments) {
                const storeId = orderStoreMap[payment.order_id];
                if (storeId) {
                    if (!paymentsByStore[storeId]) paymentsByStore[storeId] = [];
                    paymentsByStore[storeId].push(payment);
                }
            }
            
            for (const expense of allExpenses) {
                const storeId = expense.store_id;
                if (storeId) {
                    if (!expensesByStore[storeId]) expensesByStore[storeId] = [];
                    expensesByStore[storeId].push(expense);
                }
            }
            
            for (const order of allOrders) {
                const storeId = order.store_id;
                if (storeId) {
                    if (!ordersByStore[storeId]) ordersByStore[storeId] = [];
                    ordersByStore[storeId].push(order);
                }
            }

            if (isAdmin) {
                var storeReports = [];
                var grandTotal = { 
                    orders: 0, active: 0, loan: 0, adminFee: 0, interest: 0, 
                    principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
                };

                for (var store of stores) {
                    const orders = ordersByStore[store.id] || [];
                    const expenses = expensesByStore[store.id] || [];
                    const payments = paymentsByStore[store.id] || [];
                    
                    const ords = orders;
                    const activeOrds = ords.filter(o => o.status === 'active');
                    const totalLoan = ords.reduce((s, o) => s + (o.loan_amount || 0), 0);
                    const totalAdminFee = ords.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
                    const totalInterest = ords.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                    const totalPrincipal = ords.reduce((s, o) => s + (o.principal_paid || 0), 0);
                    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
                    const totalIncome = totalAdminFee + totalInterest;
                    
                    let cashIncome = 0, bankIncome = 0;
                    for (const p of payments) {
                        if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                            if (p.payment_method === 'cash') cashIncome += p.amount;
                            else if (p.payment_method === 'bank') bankIncome += p.amount;
                        }
                    }
                    let cashExpense = 0, bankExpense = 0;
                    for (const e of expenses) {
                        if (e.payment_method === 'cash') cashExpense += e.amount;
                        else if (e.payment_method === 'bank') bankExpense += e.amount;
                    }
                    const cashBalance = cashIncome - cashExpense;
                    const bankBalance = bankIncome - bankExpense;

                    storeReports.push({ 
                        store, 
                        ords: ords.length, 
                        active: activeOrds.length, 
                        totalLoan, 
                        totalAdminFee, 
                        totalInterest, 
                        totalPrincipal, 
                        totalExpenses, 
                        totalIncome,
                        cashBalance,
                        bankBalance
                    });

                    grandTotal.orders += ords.length;
                    grandTotal.active += activeOrds.length;
                    grandTotal.loan += totalLoan;
                    grandTotal.adminFee += totalAdminFee;
                    grandTotal.interest += totalInterest;
                    grandTotal.principal += totalPrincipal;
                    grandTotal.expenses += totalExpenses;
                    grandTotal.income += totalIncome;
                    grandTotal.cashBalance += cashBalance;
                    grandTotal.bankBalance += bankBalance;
                }

                var storeHtml = storeReports.length === 0 
                    ? `<div class="report-store-section"><div class="report-store-header">${lang === 'id' ? 'Tidak ada toko' : '暂无门店'}</div></div>`
                    : storeReports.map(r => `
                    <div class="report-store-section">
                        <div class="report-store-header">🏪 ${Utils.escapeHtml(r.store.name)}</div>
                        <div class="report-store-stats report-grid-5x2">
                            <div class="report-store-stat"><div class="label">${t('total_orders')}</div><div class="value">${r.ords}</div></div>
                            <div class="report-store-stat"><div class="label">${t('active')}</div><div class="value">${r.active}</div></div>
                            <div class="report-store-stat"><div class="label">${t('total_loan')}</div><div class="value">${Utils.formatCurrency(r.totalLoan)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div><div class="value income">${Utils.formatCurrency(r.totalAdminFee)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Bunga' : '利息收入总额'}</div><div class="value income">${Utils.formatCurrency(r.totalInterest)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Pokok' : '本金'}</div><div class="value">${Utils.formatCurrency(r.totalPrincipal)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pendapatan' : '管理费+利息合计'}</div><div class="value income">${Utils.formatCurrency(r.totalIncome)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pengeluaran' : '运营支出总额'}</div><div class="value expense">${Utils.formatCurrency(r.totalExpenses)}</div></div>
                            <div class="report-store-stat"><div class="label">🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</div><div class="value">${Utils.formatCurrency(r.cashBalance)}</div></div>
                            <div class="report-store-stat"><div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</div><div class="value">${Utils.formatCurrency(r.bankBalance)}</div></div>
                        </div>
                    </div>`).join('');

                document.getElementById("app").innerHTML = `
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                    </div>
                    
                    <div class="cashflow-summary" style="margin-bottom:20px;">
                        <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                        <div class="cashflow-stats">
                            <div class="cashflow-item"><div class="label">🏦 ${t('cash')}</div><div class="value">${Utils.formatCurrency(cashFlow.cash.balance)}</div></div>
                            <div class="cashflow-item"><div class="label">🏧 ${t('bank')}</div><div class="value">${Utils.formatCurrency(cashFlow.bank.balance)}</div></div>
                            <div class="cashflow-item"><div class="label">📊 ${lang === 'id' ? 'Total' : '总计'}</div><div class="value">${Utils.formatCurrency(cashFlow.total.balance)}</div></div>
                        </div>
                    </div>
                    
                    <div class="card" style="border:2px solid #3b82f6;">
                        <h3 style="color:#3b82f6;">📊 ${lang === 'id' ? 'TOTAL SEMUA TOKO' : '全部门店合计'}</h3>
                        <div class="report-store-stats report-grid-5x2" style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                            <div class="report-store-stat"><div class="label">${t('total_orders')}</div><div class="stat-value" style="font-size:20px;">${grandTotal.orders}</div></div>
                            <div class="report-store-stat"><div class="label">${t('active')}</div><div class="stat-value" style="font-size:20px;">${grandTotal.active}</div></div>
                            <div class="report-store-stat"><div class="label">${t('total_loan')}</div><div class="stat-value" style="font-size:16px;">${Utils.formatCurrency(grandTotal.loan)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div><div class="stat-value income" style="font-size:16px;">${Utils.formatCurrency(grandTotal.adminFee)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Bunga' : '利息收入总额'}</div><div class="stat-value income" style="font-size:16px;">${Utils.formatCurrency(grandTotal.interest)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Pokok' : '本金'}</div><div class="stat-value" style="font-size:16px;">${Utils.formatCurrency(grandTotal.principal)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pendapatan' : '管理费+利息合计'}</div><div class="stat-value income" style="font-size:16px;">${Utils.formatCurrency(grandTotal.income)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pengeluaran' : '运营支出总额'}</div><div class="stat-value expense" style="font-size:16px;">${Utils.formatCurrency(grandTotal.expenses)}</div></div>
                            <div class="report-store-stat"><div class="label">🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</div><div class="stat-value" style="font-size:16px;">${Utils.formatCurrency(grandTotal.cashBalance)}</div></div>
                            <div class="report-store-stat"><div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</div><div class="stat-value" style="font-size:16px;">${Utils.formatCurrency(grandTotal.bankBalance)}</div></div>
                        </div>
                    </div>
                    
                    <h3>${lang === 'id' ? 'Detail per Toko' : '各门店明细'}</h3>
                    ${storeHtml}
                    
                    <div class="toolbar">
                        <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>`;
            } else {
                const profile = await SUPABASE.getCurrentProfile();
                const storeId = profile?.store_id;
                
                const storeOrders = allOrders.filter(o => o.store_id === storeId);
                const storeExpenses = allExpenses.filter(e => e.store_id === storeId);
                const storeOrderIds = storeOrders.map(o => o.id);
                const storePayments = allPayments.filter(p => storeOrderIds.includes(p.order_id));
                
                let cashIncome = 0, bankIncome = 0;
                for (const p of storePayments) {
                    if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                        if (p.payment_method === 'cash') cashIncome += p.amount;
                        else if (p.payment_method === 'bank') bankIncome += p.amount;
                    }
                }
                let cashExpense = 0, bankExpense = 0;
                for (const e of storeExpenses) {
                    if (e.payment_method === 'cash') cashExpense += e.amount;
                    else if (e.payment_method === 'bank') bankExpense += e.amount;
                }
                const cashBalance = cashIncome - cashExpense;
                const bankBalance = bankIncome - bankExpense;
                
                const totalLoan = storeOrders.reduce((s, o) => s + (o.loan_amount || 0), 0);
                const totalAdminFee = storeOrders.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
                const totalInterest = storeOrders.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                const totalPrincipal = storeOrders.reduce((s, o) => s + (o.principal_paid || 0), 0);
                const totalExpenses = storeExpenses.reduce((s, e) => s + (e.amount || 0), 0);
                const totalIncome = totalAdminFee + totalInterest;
                const grossProfit = totalIncome - totalExpenses;

                document.getElementById("app").innerHTML = `
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                    </div>
                    
                    <div class="cashflow-summary" style="margin-bottom:20px;">
                        <h3>💰 ${lang === 'id' ? 'ARUS KAS' : '现金流'}</h3>
                        <div class="cashflow-stats">
                            <div class="cashflow-item"><div class="label">🏦 ${t('cash')}</div><div class="value">${Utils.formatCurrency(cashBalance)}</div></div>
                            <div class="cashflow-item"><div class="label">🏧 ${t('bank')}</div><div class="value">${Utils.formatCurrency(bankBalance)}</div></div>
                            <div class="cashflow-item"><div class="label">📊 ${lang === 'id' ? 'Total' : '总计'}</div><div class="value">${Utils.formatCurrency(cashBalance + bankBalance)}</div></div>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-value">${storeOrders.length}</div><div>${t('total_orders')}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalLoan)}</div><div>${t('total_loan')}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Bunga' : '利息收入'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Pokok' : '本金回收'}</div></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(totalIncome)}</div><div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div></div>
                        <div class="stat-card"><div class="stat-value" style="color:#ef4444;">${Utils.formatCurrency(totalExpenses)}</div><div>${lang === 'id' ? 'Total Pengeluaran' : '运营支出'}</div></div>
                        <div class="stat-card"><div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(grossProfit)}</div><div>${lang === 'id' ? 'Laba Kotor' : '毛利'}</div></div>
                    </div>
                    <div class="toolbar">
                        <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>`;
            }
        } catch (err) {
            console.error("showReport error:", err);
            alert(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报告失败');
        }
    },

    // ==================== 运营支出 ====================
    showExpenses: async function() {
        this.currentPage = 'expenses';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        try {
            const profile = await SUPABASE.getCurrentProfile();
            let query = supabaseClient.from('expenses').select('*, stores(name)').order('expense_date', { ascending: false });
            if (!isAdmin && profile?.store_id) query = query.eq('store_id', profile.store_id);
            const { data: expenses, error } = await query;
            if (error) throw error;
            var totalAmount = expenses?.reduce((s, e) => s + e.amount, 0) || 0;
            var todayDate = new Date().toISOString().split('T')[0];

            var rows = '';
            if (expenses && expenses.length > 0) {
                for (var e of expenses) {
                    var canEdit = isAdmin && !e.is_reconciled;
                    var actionBtns = '';
                    if (canEdit) {
                        actionBtns = `<button onclick="APP.editExpense('${e.id}')" class="btn-small">✏️ ${t('edit')}</button>
                                     <button class="danger btn-small" onclick="APP.deleteExpense('${e.id}')">🗑️ ${t('delete')}</button>`;
                    } else if (e.is_reconciled) {
                        actionBtns = `<span class="reconciled-badge">✅ ${lang === 'id' ? 'Direkonsiliasi' : '已平账'}</span>`;
                    } else if (!isAdmin) {
                        actionBtns = `<span class="locked-badge">🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</span>`;
                    }
                    var methodText = e.payment_method === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank BNI' : '银行BNI');
                    rows += `<tr>
                        <td>${Utils.formatDate(e.expense_date)}</td>
                        <td>${Utils.escapeHtml(e.category)}</td>
                        <td class="text-right">${Utils.formatCurrency(e.amount)}</td>
                        <td>${methodText}</td>
                        <td>${Utils.escapeHtml(e.description || '-')}</td>
                        <td>${Utils.escapeHtml(e.stores?.name || '-')}</td>
                        <td class="action-cell">${actionBtns}</td>
                    　　　`;
                }
            } else {
                rows = `<td><td colspan="7" class="text-center">${t('no_data')}</td></tr>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📝 ${lang === 'id' ? 'Pengeluaran Operasional' : '运营支出'}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Total Pengeluaran' : '支出总额'}: <span class="total-expense">${Utils.formatCurrency(totalAmount)}</span></h3>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Pengeluaran' : '支出列表'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th>${lang === 'id' ? 'Kategori' : '类别'}</th>
                                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                    <th>${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                    <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${lang === 'id' ? 'Tanggal' : '日期'} *</label><input type="date" id="expenseDate" value="${todayDate}"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Jumlah' : '金额'} *</label><input type="text" id="expenseAmount" placeholder="0" class="amount-input"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Kategori / Penyebab' : '类别/原因'} *</label><input type="text" id="expenseCategory" placeholder="${lang === 'id' ? 'Contoh: Listrik, Gaji' : '例如：电费、工资'}"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Metode Pembayaran' : '支付方式'} *</label>
                            <select id="expenseMethod">
                                <option value="cash">🏦 ${t('cash')}</option>
                                <option value="bank">🏧 ${t('bank')}</option>
                            </select>
                        </div>
                        <div class="form-group full-width"><label>${lang === 'id' ? 'Deskripsi' : '描述'}</label><textarea id="expenseDescription" rows="2" placeholder="${lang === 'id' ? 'Catatan tambahan' : '备注'}"></textarea></div>
                        <div class="form-actions"><button onclick="APP.addExpense()" class="success">💾 ${lang === 'id' ? 'Simpan Pengeluaran' : '保存支出'}</button></div>
                    </div>
                </div>
                <div class="toolbar">
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    ${PERMISSION.canReconcile() ? `<button onclick="APP.balanceExpenses()" class="warning">⚖️ ${lang === 'id' ? 'Rekonsiliasi' : '平账'}</button>` : ''}
                </div>`;
            var amountInput = document.getElementById("expenseAmount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) {
            console.error("showExpenses error:", error);
            alert(lang === 'id' ? 'Gagal memuat pengeluaran' : '加载支出失败');
        }
    },

    addExpense: async function() {
        var lang = Utils.lang;
        var expenseDate = document.getElementById("expenseDate").value;
        if (!expenseDate) expenseDate = new Date().toISOString().split('T')[0];
        var category = document.getElementById("expenseCategory").value.trim();
        var amountStr = document.getElementById("expenseAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var description = document.getElementById("expenseDescription").value;
        var paymentMethod = document.getElementById("expenseMethod").value;
        
        if (!category) { alert(lang === 'id' ? 'Masukkan kategori' : '请输入类别'); return; }
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const { error } = await supabaseClient.from('expenses').insert({
                store_id: profile.store_id, expense_date: expenseDate, category: category, amount: amount,
                description: description || null, created_by: profile.id, is_locked: true, is_reconciled: false,
                payment_method: paymentMethod
            });
            if (error) throw error;
            alert(lang === 'id' ? 'Pengeluaran berhasil disimpan' : '支出保存成功');
            await this.showExpenses();
        } catch (error) {
            console.error("addExpense error:", error);
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    editExpense: async function(expenseId) {
        var lang = Utils.lang;
        try {
            const { data: expense, error } = await supabaseClient.from('expenses').select('*').eq('id', expenseId).single();
            if (error) throw error;
            if (expense.is_reconciled) {
                alert(lang === 'id' ? 'Pengeluaran sudah direkonsiliasi, tidak dapat diubah' : '支出已平账，不可修改');
                return;
            }
            var newAmount = prompt(lang === 'id' ? 'Masukkan jumlah baru:' : '请输入新金额:', expense.amount);
            if (newAmount && !isNaN(parseFloat(newAmount))) {
                const { error: updateError } = await supabaseClient.from('expenses').update({ amount: parseFloat(newAmount) }).eq('id', expenseId);
                if (updateError) throw updateError;
                alert(lang === 'id' ? 'Pengeluaran berhasil diubah' : '支出已修改');
                await this.showExpenses();
            }
        } catch (error) {
            console.error("editExpense error:", error);
            alert(lang === 'id' ? 'Gagal mengubah: ' + error.message : '修改失败：' + error.message);
        }
    },

    deleteExpense: async function(expenseId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus pengeluaran ini?' : '删除此支出记录？')) return;
        try {
            const { error } = await supabaseClient.from('expenses').delete().eq('id', expenseId);
            if (error) throw error;
            alert(lang === 'id' ? 'Pengeluaran dihapus' : '支出已删除');
            await this.showExpenses();
        } catch (error) {
            console.error("deleteExpense error:", error);
            alert(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    balanceExpenses: async function() {
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        if (!isAdmin) {
            alert(lang === 'id' ? 'Hanya admin yang dapat melakukan rekonsiliasi' : '只有管理员可以执行平账操作');
            return;
        }
        var period = prompt(lang === 'id' ? 'Pilih periode rekonsiliasi:\n1 = Bulan ini\n2 = 6 bulan terakhir\n3 = 12 bulan terakhir\n4 = Tahun ini\n5 = Kustom' : '选择平账周期：\n1 = 本月\n2 = 最近6个月\n3 = 最近12个月\n4 = 本年\n5 = 自定义');
        if (!period) return;
        var startDate, endDate, today = new Date(), currentYear = today.getFullYear(), currentMonth = today.getMonth();
        switch(period) {
            case '1': startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '2': startDate = new Date(currentYear, currentMonth - 5, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '3': startDate = new Date(currentYear - 1, currentMonth, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '4': startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '5': startDate = prompt(lang === 'id' ? 'Masukkan tanggal mulai (YYYY-MM-DD):' : '请输入开始日期 (YYYY-MM-DD):'); endDate = prompt(lang === 'id' ? 'Masukkan tanggal akhir (YYYY-MM-DD):' : '请输入结束日期 (YYYY-MM-DD):'); if (!startDate || !endDate) return; break;
            default: return;
        }
        if (!confirm(lang === 'id' ? `Rekonsiliasi pengeluaran dari ${startDate} sampai ${endDate}?` : `确认平账 ${startDate} 至 ${endDate} 期间的支出？`)) return;
        try {
            const { data, error } = await supabaseClient.from('expenses').update({ is_reconciled: true, reconciled_at: new Date().toISOString(), reconciled_by: AUTH.user.id }).gte('expense_date', startDate).lte('expense_date', endDate).eq('is_reconciled', false);
            if (error) throw error;
            var count = data?.length || 0;
            alert(lang === 'id' ? `Rekonsiliasi selesai! ${count} pengeluaran telah direkonsiliasi.` : `平账完成！已平账 ${count} 条支出记录。`);
            await this.showExpenses();
        } catch (error) {
            console.error("balanceExpenses error:", error);
            alert(lang === 'id' ? 'Gagal rekonsiliasi: ' + error.message : '平账失败：' + error.message);
        }
    },

    // ==================== 缴费明细 ====================
    showPaymentHistory: async function() {
        this.currentPage = 'paymentHistory';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        try {
            var allPayments = await SUPABASE.getAllPayments();
            var totalAdminFee = 0, totalInterest = 0, totalPrincipal = 0;
            for (var p of allPayments) {
                if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
            }
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            var rows = allPayments.length === 0
                ? `<tr><td colspan="9" class="text-center">${Utils.t('no_data')}</td></tr>`
                : allPayments.map(p => `<tr>
                    <td>${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td>${Utils.escapeHtml(p.orders?.customer_name || '-')}</td>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td>${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                    <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <td class="action-cell"><button onclick="APP.navigateTo('viewOrder',{orderId:'${p.orders?.order_id}'})" class="btn-small">👁️ ${Utils.t('view')}</button></td>
                　　`).join('');

            document.getElementById("app").innerHTML = `
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费明细'}</h2>
                    <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
                </div>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Total Bunga' : '利息总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Total Pokok' : '本金总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalInterest + totalPrincipal)}</div><div>${lang === 'id' ? 'Total Semua' : '全部总计'}</div></div>
                </div>
                <div class="table-container">
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th>
                                <th>${Utils.t('customer_name')}</th>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                                <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="toolbar">
                    <button onclick="Storage.exportPaymentsToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                </div>`;
        } catch (error) {
            console.error("showPaymentHistory error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
        }
    }
};

// 合并到 window.APP
for (var key in DashboardModule) {
    if (typeof DashboardModule[key] === 'function' || key === 'currentFilter' || key === 'searchKeyword' || 
        key === 'historyStack' || key === 'currentPage' || key === 'currentOrderId' || key === 'currentCustomerId') {
        window.APP[key] = DashboardModule[key];
    }
}

window.APP.getExpensesTotal = DashboardModule.getExpensesTotal;
window.APP.addStore = DashboardModule.addStore;
window.APP.editStore = DashboardModule.editStore;
window.APP.deleteStore = DashboardModule.deleteStore;
window.APP.showCapitalModal = DashboardModule.showCapitalModal;
window.APP.saveCapitalTransaction = DashboardModule.saveCapitalTransaction;
window.APP.getSenderWANumber = DashboardModule.getSenderWANumber;
window.APP.generateWAText = DashboardModule.generateWAText;
window.APP.copyToClipboard = DashboardModule.copyToClipboard;
window.APP.sendWAReminder = DashboardModule.sendWAReminder;
window.APP.sendDailyReminders = DashboardModule.sendDailyReminders;
window.APP.updateStoreWANumber = DashboardModule.updateStoreWANumber;
window.APP.hasSentRemindersToday = DashboardModule.hasSentRemindersToday;
