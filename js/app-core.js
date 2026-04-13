window.APP = {
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,

    init: async function() {
        document.getElementById("app").innerHTML = '<div style="text-align: center; padding: 50px;">🔄 Loading system...</div>';
        await AUTH.init();
        // ✅ 修复：删除 Utils.setDb({}) 废弃调用，数据已全部在 Supabase
        await this.router();
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
            backupRestore: () => self.showBackupRestore(),
            paymentHistory: async () => await self.showPaymentHistory(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            migration: () => Migration.renderMigrationUI()
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
            filter: this.currentFilter,
            keyword: this.searchKeyword
        });
        this.currentPage = page;
        if (params.orderId) this.currentOrderId = params.orderId;
        var self = this;
        var navHandlers = {
            orderTable: async () => await self.showOrderTable(),
            createOrder: () => self.showCreateOrder(),
            dashboard: async () => await self.renderDashboard(),
            report: async () => await self.showReport(),
            userManagement: async () => await self.showUserManagement(),
            backupRestore: () => self.showBackupRestore(),
            paymentHistory: async () => await self.showPaymentHistory(),
            storeManagement: async () => await StoreManager.renderStoreManagement(),
            migration: () => Migration.renderMigrationUI(),
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
            this.currentFilter = prev.filter || "all";
            this.searchKeyword = prev.keyword || "";
            var backHandlers = {
                orderTable: async () => await self.showOrderTable(),
                dashboard: async () => await self.renderDashboard(),
                viewOrder: async () => { if (prev.orderId) await self.viewOrder(prev.orderId); },
                report: async () => await self.showReport(),
                userManagement: async () => await self.showUserManagement(),
                backupRestore: () => self.showBackupRestore(),
                paymentHistory: async () => await self.showPaymentHistory(),
                storeManagement: async () => await StoreManager.renderStoreManagement()
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
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        document.getElementById("app").innerHTML = `
            <div class="card" style="max-width: 400px; margin: 50px auto;">
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                </div>
                <h2>🏦 JF GADAI ENTERPRISE</h2>
                <h3>${t('login')}</h3>
                <div class="form-group">
                    <label>${t('username')}</label>
                    <input id="username" placeholder="${t('username')}">
                </div>
                <div class="form-group">
                    <label>${t('password')}</label>
                    <input id="password" type="password" placeholder="${t('password')}">
                </div>
                <button onclick="APP.login()">${t('login')}</button>
                <p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">
                    ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}
                </p>
            </div>`;
    },

    // ✅ 修复：删除所有调试 console.log，错误提示改为语言感知
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
        await this.router();
    },

    logout: async function() {
        await AUTH.logout();
        await this.router();
    },

    renderDashboard: async function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        try {
            var report = await Order.getReport();
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            var storeName = AUTH.getCurrentStoreName();
            var html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                    <h1>🏦 JF GADAI ENTERPRISE</h1>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        ${this.historyStack.length > 0 ? `<button onclick="APP.goBack()">↩️ ${t('back')}</button>` : ''}
                    </div>
                </div>

renderDashboard: async function() {
    this.currentPage = 'dashboard';
    this.currentOrderId = null;
    try {
        var report = await Order.getReport();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        var storeName = AUTH.getCurrentStoreName();
        
        // 新的统计卡片 HTML（2列 x 2行布局）
        var statsHtml = `
            <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr);">
                <div class="stat-card">
                    <div class="stat-value">${report.total_orders}</div>
                    <div>${t('total_orders')}</div>
                    <div class="stat-sub" style="font-size: 14px; color: #94a3b8;">${Utils.formatCurrency(report.total_loan_amount)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.active_orders}</div>
                    <div>${t('active')}</div>
                    <div class="stat-sub" style="font-size: 14px; color: #94a3b8;">${t('completed')}: ${report.completed_orders}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.formatCurrency(report.total_admin_fees)}</div>
                    <div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div>
                    <div class="stat-sub" style="font-size: 14px; color: #94a3b8;">${lang === 'id' ? 'Bunga' : '利息'}: ${Utils.formatCurrency(report.total_interest)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.formatCurrency(report.total_expenses)}</div>
                    <div>${lang === 'id' ? 'Total Pengeluaran' : '支出总额'}</div>
                    <div class="stat-sub" style="font-size: 14px; color: #94a3b8;">${lang === 'id' ? 'Rasio' : '占比'}: ${report.expense_ratio}%</div>
                </div>
            </div>
        `;
        
        var html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                <h1>🏦 JF GADAI ENTERPRISE</h1>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    ${this.historyStack.length > 0 ? `<button onclick="APP.goBack()">↩️ ${t('back')}</button>` : ''}
                </div>
            </div>
            ${statsHtml}
            <div class="toolbar">
                <button onclick="APP.navigateTo('createOrder')">➕ ${t('create_order')}</button>
                <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</button>
                ${isAdmin ? `<button onclick="APP.navigateTo('report')">📊 ${t('financial_report')}</button>` : ''}
                ${isAdmin ? `<button onclick="APP.navigateTo('userManagement')">👥 ${t('user_management')}</button>` : ''}
                ${isAdmin ? `<button onclick="APP.navigateTo('storeManagement')">🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</button>` : ''}
                ${isAdmin ? `<button onclick="APP.navigateTo('migration')">📦 ${lang === 'id' ? 'Migrasi Data' : '数据迁移'}</button>` : ''}
                <button onclick="APP.navigateTo('backupRestore')">💾 ${t('backup_restore')}</button>
                <button onclick="APP.logout()">🚪 ${t('logout')}</button>
            </div>
            <div class="card">
                <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role})</h3>
                <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
                <p>📌 ${lang === 'id'
                    ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan'
                    : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
                ${!isAdmin ? `<p style="color: #f59e0b;">🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>` : ''}
            </div>`;
        document.getElementById("app").innerHTML = html;
    } catch (err) {
        document.getElementById("app").innerHTML = `<div class="card"><p style="color:#ef4444;">⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
    }
},

    showOrderTable: async function() {
        this.currentPage = 'orderTable';
        var self = this;
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            var filters = { status: this.currentFilter, search: this.searchKeyword };
            var orders = await SUPABASE.getOrders(filters);
            var isAdmin = AUTH.isAdmin();
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var rows = '';
            if (orders.length === 0) {
                rows = `<tr><td colspan="9" style="text-align: center;">${t('no_data')}</td></tr>`;
            } else {
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var statusClass = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    var canEdit = isAdmin || (!o.is_locked && AUTH.user.role === 'store_manager');
                    rows += `<tr>
                        <td>${Utils.escapeHtml(o.order_id)}</td>
                        <td>${Utils.escapeHtml(o.customer_name)}</td>
                        <td>${Utils.escapeHtml(o.collateral_name)}</td>
                        <td>${Utils.formatCurrency(o.loan_amount)}</td>
                        <td>${Utils.formatCurrency(o.admin_fee)}</td>
                        <td>${Utils.formatCurrency(o.monthly_interest || 0)}</td>
                        <td>${o.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</td>
                        <td><span class="status-badge ${statusClass}">${statusMap[o.status] || o.status}</span></td>
                        <td>
                            <button onclick="APP.navigateTo('viewOrder', {orderId: '${o.order_id}'})">${t('view')}</button>
                            ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment', {orderId: '${o.order_id}'})">💰</button>` : ''}
                            ${canEdit ? `<button onclick="APP.navigateTo('editOrder', {orderId: '${o.order_id}'})">✏️</button>` : ''}
                            ${isAdmin ? `<button class="danger" onclick="APP.deleteOrder('${o.order_id}')">🗑️</button>` : ''}
                            ${o.is_locked ? `<span title="${lang === 'id' ? 'Terkunci' : '已锁定'}">🔒</span>` : ''}
                        </td>
                    </tr>`;
                }
            }
            var html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📋 ${t('order_list')}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="toolbar">
                    <input type="text" id="searchInput" placeholder="🔍 ${t('search')}..." style="max-width: 300px;" value="${Utils.escapeHtml(this.searchKeyword)}">
                    <button onclick="APP.searchOrders()">${t('search')}</button>
                    <button onclick="APP.resetSearch()">${t('reset')}</button>
                    <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                        <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>${t('total_orders')}</option>
                        <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                    <button onclick="APP.navigateTo('createOrder')">➕ ${t('create_order')}</button>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th><th>${t('customer_name')}</th><th>${t('collateral_name')}</th>
                                <th>${t('loan_amount')}</th><th>${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                <th>${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</th>
                                <th>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                <th>${lang === 'id' ? 'Status' : '状态'}</th>
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            document.getElementById("app").innerHTML = html;
        } catch (err) {
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },

    searchOrders: function() { this.searchKeyword = document.getElementById("searchInput").value; this.showOrderTable(); },
    resetSearch: function() { this.searchKeyword = ""; this.currentFilter = "all"; this.showOrderTable(); },
    filterOrders: function(status) { this.currentFilter = status; this.showOrderTable(); },

    showCreateOrder: function() {
        this.currentPage = 'createOrder';
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>📝 ${t('create_order')}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>
            <div class="card">
                <h3>${t('customer_info')}</h3>
                <div class="form-group"><label>${t('customer_name')} *</label><input id="name" placeholder="${t('customer_name')}"></div>
                <div class="form-group"><label>${t('ktp_number')} *</label><input id="ktp" placeholder="${t('ktp_number')}"></div>
                <div class="form-group"><label>${t('phone')} *</label><input id="phone" placeholder="${t('phone')}"></div>
                <div class="form-group"><label>${t('address')}</label><textarea id="address" rows="2" placeholder="${t('address')}"></textarea></div>
                <h3>${t('collateral_info')}</h3>
                <div class="form-group"><label>${t('collateral_name')} *</label><input id="collateral" placeholder="${t('collateral_name')}"></div>
                <div class="form-group"><label>${t('loan_amount')} *</label><input id="amount" type="number" min="1" placeholder="${t('loan_amount')}"></div>
                <div class="form-group"><label>${t('notes')}</label><textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea></div>
                <div class="toolbar">
                    <button onclick="APP.saveOrder()">💾 ${t('save')}</button>
                    <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                </div>
            </div>`;
    },

    saveOrder: async function() {
        var name = document.getElementById("name").value.trim();
        var ktp = document.getElementById("ktp").value.trim();
        var phone = document.getElementById("phone").value.trim();
        var collateral = document.getElementById("collateral").value.trim();
        var amount = document.getElementById("amount").value;
        var address = document.getElementById("address").value;
        var notes = document.getElementById("notes").value;
        if (!name || !ktp || !phone || !collateral || !amount) { alert(Utils.t('fill_all_fields')); return; }
        if (Number(amount) <= 0) { alert(Utils.t('loan_amount') + " > 0"); return; }
        try {
            var orderData = { customer: { name, ktp, phone, address }, collateral_name: collateral, loan_amount: Number(amount), notes };
            var newOrder = await Order.create(orderData);
            alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
            this.goBack();
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal menyimpan order: ' + error.message : '保存订单失败：' + error.message);
        }
    },

    viewOrder: async function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('Order not found'); this.goBack(); return; }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var paymentHistoryRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee'
                        ? (lang === 'id' ? 'Admin Fee' : '管理费')
                        : p.type === 'interest'
                            ? (lang === 'id' ? 'Bunga' : '利息')
                            : (lang === 'id' ? 'Pokok' : '本金');
                    paymentHistoryRows += `<tr>
                        <td>${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td>${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td>${Utils.formatCurrency(p.amount)}</td>
                        <td>${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            } else {
                paymentHistoryRows = `<tr><td colspan="5" style="text-align: center;">${t('no_data')}</td></tr>`;
            }
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📄 ${t('view')} ${t('order_list')}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                    <p><strong>ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>${lang === 'id' ? 'Status' : '状态'}:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                    <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                    ${order.is_locked ? `<p><strong>🔒 ${lang === 'id' ? 'Status: Terkunci' : '状态：已锁定'}</strong></p>` : ''}
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
                    <p><strong>${t('notes')}:</strong> ${Utils.escapeHtml(order.notes)}</p>
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '支付记录'}</h3>
                    <div class="table-container">
                        <table>
                            <thead><tr>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                                <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr></thead>
                            <tbody>${paymentHistoryRows}</tbody>
                        </table>
                    </div>
                    <div class="toolbar">
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                        ${order.status === 'active' ? `<button onclick="APP.navigateTo('payment', {orderId: '${order.order_id}'})">💰 ${t('save')}</button>` : ''}
                        ${isAdmin && order.is_locked ? `<button onclick="APP.unlockOrder('${order.order_id}')">🔓 ${lang === 'id' ? 'Buka Kunci' : '解锁'}</button>` : ''}
                    </div>
                </div>`;
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            this.goBack();
        }
    },

    unlockOrder: async function(orderId) {
        if (confirm(Utils.lang === 'id' ? 'Buka kunci order ini untuk edit?' : '解锁此订单以进行编辑？')) {
            try { await Order.unlockOrder(orderId); await this.viewOrder(orderId); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    showPayment: async function(orderId) {
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            var currentMonthlyInterest = remainingPrincipal * 0.10;
            var interestOptions = '';
            for (var i = 1; i <= 12; i++) {
                var amt = currentMonthlyInterest * i;
                interestOptions += `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(amt)})</option>`;
            }
            var adminFeeSection = !order.admin_fee_paid
                ? `<div style="background:#1e293b;padding:15px;border-radius:8px;margin-bottom:15px;">
                    <h4>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'} - ${Utils.formatCurrency(order.admin_fee)}</h4>
                    <button onclick="APP.payAdminFee('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Admin Fee' : '记录管理费支付'}</button>
                   </div>`
                : `<div style="background:#1e293b;padding:15px;border-radius:8px;margin-bottom:15px;">
                    <h4>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</h4>
                    <p>✅ ${lang === 'id' ? 'Sudah dibayar' : '已支付'}</p>
                   </div>`;
            var principalSection = remainingPrincipal > 0
                ? `<div class="form-group"><label>${lang === 'id' ? 'Jumlah Pembayaran Pokok' : '本金支付金额'}:</label>
                   <input type="number" id="principalAmount" value="${remainingPrincipal}" style="width:200px;"></div>
                   <button onclick="APP.payPrincipal('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>`
                : `<p>✅ ${lang === 'id' ? 'Pokok sudah lunas' : '本金已结清'}</p>`;
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="card">
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer_name)}</p>
                    <p><strong>ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                    <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    <p><strong>${lang === 'id' ? 'Bunga Bulanan' : '月利息'}:</strong> ${Utils.formatCurrency(currentMonthlyInterest)}</p>
                </div>
                <div class="card">
                    ${adminFeeSection}
                    <div style="background:#1e293b;padding:15px;border-radius:8px;margin-bottom:15px;">
                        <h4>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '支付利息'}</h4>
                        <div class="form-group"><label>${lang === 'id' ? 'Jumlah Bulan' : '月数'}:</label>
                        <select id="interestMonths" style="width:200px;">${interestOptions}</select></div>
                        <button onclick="APP.payInterest('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息支付'}</button>
                    </div>
                    <div style="background:#1e293b;padding:15px;border-radius:8px;margin-bottom:15px;">
                        <h4>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金支付'}</h4>
                        ${principalSection}
                    </div>
                </div>
                <div class="toolbar"><button onclick="APP.goBack()">↩️ ${t('cancel')}</button></div>`;
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran' : '加载支付页面失败');
            this.goBack();
        }
    },

    payAdminFee: async function(orderId) {
        if (confirm(Utils.lang === 'id' ? 'Konfirmasi penerimaan Admin Fee 30,000 IDR?' : '确认已收取管理费 30,000 IDR？')) {
            try { await Order.recordAdminFee(orderId); await this.viewOrder(orderId); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    payInterest: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        if (confirm((Utils.lang === 'id' ? 'Konfirmasi pembayaran bunga ' : '确认支付利息 ') + months + (Utils.lang === 'id' ? ' bulan?' : ' 个月？'))) {
            try { await Order.recordInterestPayment(orderId, months); await this.viewOrder(orderId); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    payPrincipal: async function(orderId) {
        var amount = parseFloat(document.getElementById("principalAmount").value);
        if (isNaN(amount) || amount <= 0) { alert(Utils.lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        if (confirm((Utils.lang === 'id' ? 'Konfirmasi pembayaran pokok ' : '确认支付本金 ') + Utils.formatCurrency(amount) + '?')) {
            try { await Order.recordPrincipalPayment(orderId, amount); await this.viewOrder(orderId); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    editOrder: async function(orderId) {
        this.currentPage = 'editOrder';
        this.currentOrderId = orderId;
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;
            var t = (key) => Utils.t(key);
            var lang = Utils.lang;
            var canEdit = AUTH.isAdmin() || (!order.is_locked && AUTH.user.role === 'store_manager');
            if (!canEdit) { alert(lang === 'id' ? 'Order ini sudah terkunci' : '此订单已锁定，无法编辑'); this.goBack(); return; }
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>✏️ ${t('edit')} ${t('order_list')}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="card">
                    <div class="form-group"><label>${t('customer_name')}</label><input id="name" value="${Utils.escapeHtml(order.customer_name)}"></div>
                    <div class="form-group"><label>${t('ktp_number')}</label><input id="ktp" value="${Utils.escapeHtml(order.customer_ktp)}"></div>
                    <div class="form-group"><label>${t('phone')}</label><input id="phone" value="${Utils.escapeHtml(order.customer_phone)}"></div>
                    <div class="form-group"><label>${t('address')}</label><textarea id="address">${Utils.escapeHtml(order.customer_address)}</textarea></div>
                    <div class="form-group"><label>${t('collateral_name')}</label><input id="collateral" value="${Utils.escapeHtml(order.collateral_name)}"></div>
                    <div class="form-group"><label>${t('notes')}</label><textarea id="notes">${Utils.escapeHtml(order.notes)}</textarea></div>
                    <div class="toolbar">
                        <button onclick="APP.updateOrder('${order.order_id}')">💾 ${t('save')}</button>
                        <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                    </div>
                </div>`;
        } catch (error) { alert('Error loading order for edit'); this.goBack(); }
    },

    updateOrder: async function(orderId) {
        var updates = {
            customer: {
                name: document.getElementById("name").value,
                ktp: document.getElementById("ktp").value,
                phone: document.getElementById("phone").value,
                address: document.getElementById("address").value
            },
            collateral_name: document.getElementById("collateral").value,
            notes: document.getElementById("notes").value
        };
        try {
            await Order.update(orderId, updates);
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

    showReport: async function() {
        this.currentPage = 'report';
        try {
            var report = await Order.getReport();
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📊 ${t('financial_report')}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${report.total_orders}</div><div>${t('total_orders')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div><div>${t('total_loan')}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_admin_fees)}</div><div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_interest)}</div><div>${lang === 'id' ? 'Bunga' : '利息收入'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_principal)}</div><div>${lang === 'id' ? 'Pokok' : '本金回收'}</div></div>
                </div>
                <div class="toolbar">
                    <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                </div>`;
        } catch (err) { alert(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报告失败'); }
    },

    showPaymentHistory: async function() {
        this.currentPage = 'paymentHistory';
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
                ? `<tr><td colspan="8" style="text-align: center;">${Utils.t('no_data')}</td></tr>`
                : allPayments.map(p => `<tr>
                    <td>${Utils.escapeHtml(p.orders.order_id)}</td>
                    <td>${Utils.escapeHtml(p.orders.customer_name)}</td>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td>${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td>${Utils.formatCurrency(p.amount)}</td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <td><button onclick="APP.navigateTo('viewOrder', {orderId: '${p.orders.order_id}'})">${Utils.t('view')}</button></td>
                </tr>`).join('');
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Total Bunga' : '利息总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Total Pokok' : '本金总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalInterest + totalPrincipal)}</div><div>${lang === 'id' ? 'Total Semua' : '全部总计'}</div></div>
                </div>
                <div class="table-container">
                    <table>
                        <thead><tr>
                            <th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th>
                            <th>${Utils.t('customer_name')}</th>
                            <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                            <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                            <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                            <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                            <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
                <div class="toolbar">
                    <button onclick="Storage.exportPaymentsToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                </div>`;
        } catch (error) { alert(Utils.lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载付款记录失败'); }
    },

    showBackupRestore: function() {
        this.currentPage = 'backupRestore';
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>💾 ${t('backup_restore')}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>
            <div class="card">
                <h3>${lang === 'id' ? 'Cadangan Data' : '备份数据'}</h3>
                <button onclick="Storage.backup()">📥 ${lang === 'id' ? 'Ekspor File Cadangan' : '导出备份文件'}</button>
                <h3 style="margin-top: 30px;">${lang === 'id' ? 'Pemulihan Data' : '恢复数据'}</h3>
                <input type="file" id="restoreFile" accept=".json">
                <button onclick="APP.restoreData()">📤 ${lang === 'id' ? 'Impor Pemulihan' : '导入恢复'}</button>
                <p style="margin-top: 10px; color: #f59e0b;">⚠️ ${lang === 'id' ? 'Perhatian: Memulihkan data akan menimpa semua data yang ada!' : '注意：恢复数据将覆盖当前所有数据，请谨慎操作！'}</p>
            </div>`;
    },

    restoreData: async function() {
        var file = document.getElementById("restoreFile").files[0];
        if (!file) { alert(Utils.lang === 'id' ? 'Pilih file cadangan' : '请选择备份文件'); return; }
        if (confirm(Utils.lang === 'id' ? '⚠️ Lanjutkan pemulihan data?' : '⚠️ 确定继续恢复数据吗？')) {
            var success = await Storage.restore(file);
            if (success) { alert(Utils.lang === 'id' ? 'Pemulihan berhasil! Sistem akan dimuat ulang.' : '恢复成功！系统将重新加载。'); location.reload(); }
            else { alert(Utils.lang === 'id' ? 'Pemulihan gagal: Format file salah' : '恢复失败：文件格式错误'); }
        }
    },

    showUserManagement: async function() {
        this.currentPage = 'userManagement';
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            var users = await AUTH.getAllUsers();
            var stores = await SUPABASE.getAllStores();
            var userRows = '';
            for (var u of users) {
                var isCurrent = (u.id === AUTH.user.id);
                var storeName = u.stores?.name || '-';
                userRows += `<tr>
                    <td>${Utils.escapeHtml(u.username || u.email || '-')}</td>
                    <td>${Utils.escapeHtml(u.name)}</td>
                    <td>${u.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长')}</td>
                    <td>${Utils.escapeHtml(storeName)}</td>
                    <td>
                        ${isCurrent ? `<span style="color:#10b981;">✅ ${lang === 'id' ? 'Saya' : '当前'}</span>` : ''}
                        ${!isCurrent ? `<button onclick="APP.editUser('${u.id}')">✏️ ${t('edit')}</button>` : ''}
                        ${!isCurrent ? `<button class="danger" onclick="APP.deleteUser('${u.id}')">🗑️ ${t('delete')}</button>` : ''}
                    </td>
                </tr>`;
            }
            var storeOptions = `<option value="">${lang === 'id' ? 'Pilih Toko' : '选择门店'}</option>`;
            for (var s of stores) storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`;
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>👥 ${t('user_management')}</h2>
                    <div>
                        <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Pengguna Baru' : '添加新用户'}</h3>
                    <div class="form-group"><label>${t('username')} *</label><input id="newUsername" placeholder="${t('username')}" style="width:250px;"></div>
                    <div class="form-group"><label>${t('password')} *</label><input id="newPassword" type="password" placeholder="${t('password')}" style="width:250px;"></div>
                    <div class="form-group"><label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label><input id="newName" placeholder="${lang === 'id' ? 'Nama Lengkap' : '姓名'}" style="width:250px;"></div>
                    <div class="form-group"><label>${lang === 'id' ? 'Peran' : '角色'} *</label>
                        <select id="newRole" style="width:250px;">
                            <option value="store_manager">${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                            <option value="admin">${lang === 'id' ? 'Administrator' : '管理员'}</option>
                        </select>
                    </div>
                    <div class="form-group"><label>${lang === 'id' ? 'Toko' : '门店'}</label><select id="newStoreId" style="width:250px;">${storeOptions}</select></div>
                    <button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Pengguna' : '用户列表'}</h3>
                    <div class="table-container">
                        <table><thead><tr>
                            <th>${t('username')}</th><th>${lang === 'id' ? 'Nama' : '姓名'}</th>
                            <th>${lang === 'id' ? 'Peran' : '角色'}</th><th>${lang === 'id' ? 'Toko' : '门店'}</th>
                            <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                        </tr></thead>
                        <tbody>${userRows}</tbody>
                        </table>
                    </div>
                </div>`;
        } catch (error) { alert(Utils.lang === 'id' ? 'Gagal memuat manajemen pengguna' : '加载用户管理失败'); }
    },

    addUser: async function() {
        var username = document.getElementById("newUsername").value.trim();
        var password = document.getElementById("newPassword").value;
        var name = document.getElementById("newName").value.trim();
        var role = document.getElementById("newRole").value;
        var storeId = document.getElementById("newStoreId").value;
        if (!username || !password || !name) { alert(Utils.lang === 'id' ? 'Harap isi semua field' : '请填写所有字段'); return; }
        try {
            await AUTH.addUser(username, password, name, role, storeId || null);
            alert((Utils.lang === 'id' ? 'Pengguna "' : '用户 "') + username + '" ' + (Utils.lang === 'id' ? 'berhasil ditambahkan!' : '添加成功！'));
            document.getElementById("newUsername").value = '';
            document.getElementById("newPassword").value = '';
            document.getElementById("newName").value = '';
            await this.showUserManagement();
        } catch (error) { alert('Error: ' + error.message); }
    },

    deleteUser: async function(userId) {
        if (confirm(Utils.lang === 'id' ? 'Hapus pengguna ini?' : '删除此用户？')) {
            try { await AUTH.deleteUser(userId); await this.showUserManagement(); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    editUser: async function(userId) {
        var newRole = prompt(Utils.lang === 'id' ? 'Masukkan peran baru (admin/store_manager):' : '输入新角色 (admin/store_manager):');
        if (newRole && (newRole === 'admin' || newRole === 'store_manager')) {
            try { await AUTH.updateUser(userId, { role: newRole }); await this.showUserManagement(); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    addStore: async function() {
        var code = document.getElementById("newStoreCode").value.trim();
        var name = document.getElementById("newStoreName").value.trim();
        var address = document.getElementById("newStoreAddress").value;
        var phone = document.getElementById("newStorePhone").value;
        if (!code || !name) { alert(Utils.lang === 'id' ? 'Kode dan nama toko harus diisi' : '门店编码和名称必须填写'); return; }
        try { await StoreManager.createStore(code, name, address, phone); await StoreManager.renderStoreManagement(); }
        catch (error) { alert('Error: ' + error.message); }
    },

    editStore: async function(storeId) {
        var newName = prompt(Utils.lang === 'id' ? 'Masukkan nama toko baru:' : '输入新门店名称:');
        if (newName) {
            try { await StoreManager.updateStore(storeId, { name: newName }); await StoreManager.renderStoreManagement(); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    deleteStore: async function(storeId) {
        if (confirm(Utils.lang === 'id' ? 'Hapus toko ini?' : '删除此门店？')) {
            try { await StoreManager.deleteStore(storeId); await StoreManager.renderStoreManagement(); }
            catch (error) { alert('Error: ' + error.message); }
        }
    }
};
