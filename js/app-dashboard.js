// app-dashboard.js - 仪表板、登录、路由、报表模块（完整优化版）
// 包含：注资/提现功能、手机端响应式优化

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
            
            // 格式化注资显示
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
                    
                    <!-- 注资汇总行（仅管理员可见） -->
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
                    ${isAdmin ? `<button onclick="APP.navigateTo('report')">📊 ${t('financial_report')}</button>` : ''}
                    ${isAdmin ? `<button onclick="APP.navigateTo('userManagement')">👥 ${t('user_management')}</button>` : ''}
                    ${isAdmin ? `<button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</button>` : ''}
                    <button onclick="APP.logout()">🚪 ${t('logout')}</button>
                </div>
                
                <div class="card">
                    <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : AUTH.user.role === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工')})</h3>
                    <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
                    <p>📌 ${lang === 'id' ? 'Admin Fee: (dibayar saat kontrak) | Bunga: 10% per bulan' : '管理费: (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
                    ${!isAdmin ? `<p style="color: #f59e0b;">🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>` : ''}
                </div>`;
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p style="color:#ef4444;">⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    // ==================== 注资/提现模态框（新增）====================
    showCapitalModal: async function() {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        // 获取当前资金流水
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
        
        // 绑定金额格式化
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

    // ==================== 其他方法保持不变 ====================
    // showReport, showUserManagement, showExpenses, showPaymentHistory, 
    // showOrderTable, viewOrder, editOrder, deleteOrder, printOrder, 
    // showCreateOrder, getExpensesTotal, addStore, editStore, deleteStore
    // 这些方法已经在之前的代码中提供，此处省略重复代码
    // ... (请保留之前已有的所有方法)
};

// 将 DashboardModule 的方法合并到 window.APP
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
