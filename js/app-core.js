// ==================== 主核心文件 ====================

window.APP = {
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
        document.getElementById("app").innerHTML = '<div style="text-align: center; padding: 50px;">🔄 Loading system...</div>';
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
                    .no-print, .toolbar button:not(.print-btn) { display: none !important; }
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
            <div class="card" style="max-width: 400px; margin: 50px auto;">
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="APP.toggleLanguageOnLogin()">🌐 ${lang === 'id' ? '中文' : 'Bahasa'}</button>
                </div>
                <h2><img src="/icons/system-jf.png" alt="JF!" style="height: 32px; vertical-align: middle;"> JF! by Gadai</h2>
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
                <p style="margin-top: 15px; font-size: 12px; color: #64748b;">
                    ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}
                </p>
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

    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        this.saveCurrentPageState();
        try {
            var report = await Order.getReport();
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            var storeName = AUTH.getCurrentStoreName();
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                    <h1><img src="/icons/system-jf.png" alt="JF!" style="height: 32px; vertical-align: middle;"> JF! by Gadai</h1>
                    <div>${this.historyStack.length > 0 ? `<button onclick="APP.goBack()">↩️ ${t('back')}</button>` : ''}</div>
                </div>
                <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr);">
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
                    <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款明细'}</button>
                    <button onclick="APP.navigateTo('expenses')">📝 ${lang === 'id' ? 'Pengeluaran' : '运营支出'}</button>
                    ${isAdmin ? `<button onclick="APP.navigateTo('report')">📊 ${t('financial_report')}</button>` : ''}
                    ${isAdmin ? `<button onclick="APP.navigateTo('userManagement')">👥 ${t('user_management')}</button>` : ''}
                    ${isAdmin ? `<button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</button>` : ''}
                    <button onclick="APP.logout()">🚪 ${t('logout')}</button>
                </div>
                <div class="card">
                    <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : AUTH.user.role === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工')})</h3>
                    <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
                    <p>📌 ${lang === 'id' ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
                    ${!isAdmin ? `<p style="color: #f59e0b;">🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>` : ''}
                </div>`;
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p style="color:#ef4444;">⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    // ==================== 运营支出模块 ====================

    getExpensesTotal: async function() {
        const profile = await SUPABASE.getCurrentProfile();
        let query = supabaseClient.from('expenses').select('amount');
        if (profile?.role !== 'admin' && profile?.store_id) query = query.eq('store_id', profile.store_id);
        const { data, error } = await query;
        if (error) throw error;
        return { total: data?.reduce((s, e) => s + e.amount, 0) || 0, items: data };
    },

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
                        actionBtns = `
                            <button onclick="APP.editExpense('${e.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${t('edit')}</button>
                            <button class="danger" onclick="APP.deleteExpense('${e.id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>
                        `;
                    } else if (e.is_reconciled) {
                        actionBtns = `<span style="color:#10b981;font-size:11px;">✅ ${lang === 'id' ? 'Direkonsiliasi' : '已平账'}</span>`;
                    } else if (!isAdmin) {
                        actionBtns = `<span style="color:#94a3b8;font-size:11px;">🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</span>`;
                    }
                    rows += `<tr>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatDate(e.expense_date)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(e.category)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(e.amount)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(e.description || '-')}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(e.stores?.name || '-')}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;white-space:nowrap;">${actionBtns}</td>
                    </tr>`;
                }
            } else {
                rows = `<tr><td colspan="6" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
            }

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📝 ${lang === 'id' ? 'Pengeluaran Operasional' : '运营支出'}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Total Pengeluaran' : '支出总额'}: <span style="color:#ef4444;">${Utils.formatCurrency(totalAmount)}</span></h3>
                </div>

                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Pengeluaran' : '支出列表'}</h3>
                    <div class="table-container">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;">
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Kategori' : '类别'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出'}</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Tanggal' : '日期'} *</label>
                            <input type="date" id="expenseDate" value="${todayDate}" style="background:#ffffff;color:#1e293b;">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Jumlah' : '金额'} *</label>
                            <input type="text" id="expenseAmount" placeholder="0" style="text-align:right;">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Kategori / Penyebab' : '类别/原因'} *</label>
                            <input type="text" id="expenseCategory" placeholder="${lang === 'id' ? 'Contoh: Listrik, Gaji' : '例如：电费、工资'}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Deskripsi' : '描述'}</label>
                            <textarea id="expenseDescription" rows="2" placeholder="${lang === 'id' ? 'Catatan tambahan' : '备注'}"></textarea>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP.addExpense()" class="success">💾 ${lang === 'id' ? 'Simpan Pengeluaran' : '保存支出'}</button>
                        </div>
                    </div>
                </div>
                <div class="toolbar">
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    ${PERMISSION.canReconcile() ? `<button onclick="APP.balanceExpenses()" class="warning" style="background:#8b5cf6;">⚖️ ${lang === 'id' ? 'Rekonsiliasi' : '平账'}</button>` : ''}
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
        if (!expenseDate) {
            expenseDate = new Date().toISOString().split('T')[0];
        }
        var category = document.getElementById("expenseCategory").value.trim();
        var amountStr = document.getElementById("expenseAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var description = document.getElementById("expenseDescription").value;
        
        if (!category) { alert(lang === 'id' ? 'Masukkan kategori' : '请输入类别'); return; }
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            
            const { data, error } = await supabaseClient.from('expenses').insert({
                store_id: profile.store_id, 
                expense_date: expenseDate,
                category: category, 
                amount: amount,
                description: description || null, 
                created_by: profile.id, 
                is_locked: true,
                is_reconciled: false
            }).select();
            
            if (error) {
                console.error("添加支出错误:", error);
                throw error;
            }
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
            const { data: expense, error } = await supabaseClient
                .from('expenses')
                .select('*')
                .eq('id', expenseId)
                .single();
            if (error) throw error;
            
            if (expense.is_reconciled) {
                alert(lang === 'id' ? 'Pengeluaran sudah direkonsiliasi, tidak dapat diubah' : '支出已平账，不可修改');
                return;
            }
            
            var newAmount = prompt(lang === 'id' ? 'Masukkan jumlah baru:' : '请输入新金额:', expense.amount);
            if (newAmount && !isNaN(parseFloat(newAmount))) {
                const { error: updateError } = await supabaseClient
                    .from('expenses')
                    .update({ amount: parseFloat(newAmount) })
                    .eq('id', expenseId);
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
            const { error } = await supabaseClient
                .from('expenses')
                .delete()
                .eq('id', expenseId);
            
            if (error) {
                console.error("删除支出错误:", error);
                throw error;
            }
            
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
        
        var period = prompt(
            lang === 'id' 
                ? 'Pilih periode rekonsiliasi:\n1 = Bulan ini\n2 = 6 bulan terakhir\n3 = 12 bulan terakhir\n4 = Tahun ini\n5 = Kustom (input manual)'
                : '选择平账周期：\n1 = 本月\n2 = 最近6个月\n3 = 最近12个月\n4 = 本年\n5 = 自定义（手动输入）'
        );
        
        if (!period) return;
        
        var startDate, endDate;
        var today = new Date();
        var currentYear = today.getFullYear();
        var currentMonth = today.getMonth();
        
        switch(period) {
            case '1':
                startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case '2':
                startDate = new Date(currentYear, currentMonth - 5, 1).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case '3':
                startDate = new Date(currentYear - 1, currentMonth, 1).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case '4':
                startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0];
                endDate = today.toISOString().split('T')[0];
                break;
            case '5':
                startDate = prompt(lang === 'id' ? 'Masukkan tanggal mulai (YYYY-MM-DD):' : '请输入开始日期 (YYYY-MM-DD):');
                endDate = prompt(lang === 'id' ? 'Masukkan tanggal akhir (YYYY-MM-DD):' : '请输入结束日期 (YYYY-MM-DD):');
                if (!startDate || !endDate) return;
                break;
            default:
                return;
        }
        
        if (!confirm(lang === 'id' 
            ? `Rekonsiliasi pengeluaran dari ${startDate} sampai ${endDate}? Tindakan ini tidak dapat dibatalkan.`
            : `确认平账 ${startDate} 至 ${endDate} 期间的支出？此操作不可撤销。`)) {
            return;
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('expenses')
                .update({ 
                    is_reconciled: true, 
                    reconciled_at: new Date().toISOString(),
                    reconciled_by: AUTH.user.id 
                })
                .gte('expense_date', startDate)
                .lte('expense_date', endDate)
                .eq('is_reconciled', false);
            
            if (error) throw error;
            
            var count = data?.length || 0;
            alert(lang === 'id' 
                ? `Rekonsiliasi selesai! ${count} pengeluaran telah direkonsiliasi.`
                : `平账完成！已平账 ${count} 条支出记录。`);
            
            await this.showExpenses();
        } catch (error) {
            console.error("balanceExpenses error:", error);
            alert(lang === 'id' ? 'Gagal rekonsiliasi: ' + error.message : '平账失败：' + error.message);
        }
    },

    // ==================== 付款明细 ====================

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
            var typeMap = {
                admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
                interest: lang === 'id' ? 'Bunga' : '利息',
                principal: lang === 'id' ? 'Pokok' : '本金'
            };

            var rows = allPayments.length === 0
                ? `<tr><td colspan="8" style="text-align:center;padding:20px;">${Utils.t('no_data')}
