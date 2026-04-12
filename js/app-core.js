/**
 * ============================================
 * JF GADAI ENTERPRISE - 主应用文件
 * ============================================
 * 函数目录（Ctrl+F 快速查找）：
 * - 初始化与路由: init, router, navigateTo, goBack
 * - 登录相关: renderLogin, login, logout
 * - 仪表板: renderDashboard
 * - 订单列表: showOrderTable, searchOrders, resetSearch, filterOrders
 * - 创建订单: showCreateOrder, saveOrder
 * - 订单详情: viewOrder
 * - 支付功能: showPayment, payAdminFee, payInterest, payPrincipal
 * - 编辑订单: editOrder, updateOrder
 * - 删除订单: deleteOrder
 * - 财务报表: showReport, exportToCSV
 * - 付款记录: showPaymentHistory, exportPaymentHistoryToCSV
 * - 备份恢复: showBackupRestore, backupData, restoreData
 * - 用户管理: showUserManagement, addUser, deleteUser
 * ============================================
 */

window.APP = {
    db: null,
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    
    // ========== 初始化与路由 ==========
    init: function() {
        this.db = Storage.load();
        Utils.setDb(this.db);
        AUTH.init(this.db);
        this.router();
    },
    
    router: function() {
        if (!AUTH.user) this.renderLogin();
        else this.renderDashboard();
    },
    
    toggleLanguage: function() {
        var newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        if (this.currentPage === 'login' || !AUTH.user) {
            this.renderLogin();
        } else {
            this.refreshCurrentPage();
        }
    },
    
    refreshCurrentPage: function() {
        var self = this;
        var handlers = {
            dashboard: function() { self.renderDashboard(); },
            orderTable: function() { self.showOrderTable(); },
            createOrder: function() { self.showCreateOrder(); },
            viewOrder: function() { if (self.currentOrderId) self.viewOrder(self.currentOrderId); },
            payment: function() { if (self.currentOrderId) self.showPayment(self.currentOrderId); },
            editOrder: function() { if (self.currentOrderId) self.editOrder(self.currentOrderId); },
            report: function() { self.showReport(); },
            userManagement: function() { self.showUserManagement(); },
            backupRestore: function() { self.showBackupRestore(); },
            paymentHistory: function() { self.showPaymentHistory(); }
        };
        (handlers[this.currentPage] || handlers.dashboard)();
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
            orderTable: function() { self.showOrderTable(); },
            createOrder: function() { self.showCreateOrder(); },
            dashboard: function() { self.renderDashboard(); },
            report: function() { self.showReport(); },
            userManagement: function() { self.showUserManagement(); },
            backupRestore: function() { self.showBackupRestore(); },
            paymentHistory: function() { self.showPaymentHistory(); },
            viewOrder: function() { if (params.orderId) self.viewOrder(params.orderId); },
            payment: function() { if (params.orderId) self.showPayment(params.orderId); },
            editOrder: function() { if (params.orderId) self.editOrder(params.orderId); }
        };
        (navHandlers[page] || navHandlers.dashboard)();
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
                orderTable: function() { self.showOrderTable(); },
                dashboard: function() { self.renderDashboard(); },
                viewOrder: function() { if (prev.orderId) self.viewOrder(prev.orderId); },
                report: function() { self.showReport(); },
                userManagement: function() { self.showUserManagement(); },
                backupRestore: function() { self.showBackupRestore(); },
                paymentHistory: function() { self.showPaymentHistory(); }
            };
            (backHandlers[prev.page] || backHandlers.dashboard)();
        } else {
            this.renderDashboard();
        }
    },
    
    // ========== 登录相关 ==========
    renderLogin: function() {
        this.currentPage = 'login';
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        document.getElementById("app").innerHTML = '<div class="card" style="max-width: 400px; margin: 50px auto;">' +
            '<div style="text-align: right; margin-bottom: 10px;"><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button></div>' +
            '<h2>JF GADAI ENTERPRISE</h2><h3>' + t('login') + '</h3>' +
            '<div class="form-group"><label>' + t('username') + '</label><input id="username" placeholder="' + t('username') + '"></div>' +
            '<div class="form-group"><label>' + t('password') + '</label><input id="password" type="password" placeholder="' + t('password') + '"></div>' +
            '<button onclick="APP.login()">' + t('login') + '</button>' +
            '<p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">Demo: admin/admin123 | staff/staff123</p></div>';
    },
    
    login: function() {
        var username = document.getElementById("username").value;
        var password = document.getElementById("password").value;
        if (!username || !password) { alert(Utils.t('fill_all_fields')); return; }
        var user = AUTH.login(username, password);
        if (!user) { alert(Utils.t('login_failed')); return; }
        this.router();
    },
    
    logout: function() {
        AUTH.logout();
        this.router();
    },
    
    // ========== 仪表板 ==========
    renderDashboard: function() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        var report = Order.getReport(this.db);
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">' +
            '<h1>🏦 JF GADAI ENTERPRISE</h1>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            (this.historyStack.length > 0 ? '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button>' : '') + '</div></div>' +
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + report.total_orders + '</div><div>' + t('total_orders') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + report.active_orders + '</div><div>' + t('active') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + report.completed_orders + '</div><div>' + t('completed') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_loan_amount) + '</div><div>' + t('total_loan') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_admin_fees) + '</div><div>' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_interest) + '</div><div>' + (lang === 'id' ? 'Bunga Diterima' : '已收利息') + '</div></div></div>' +
            '<div class="toolbar">' +
            '<button onclick="APP.navigateTo(\'createOrder\')">➕ ' + t('create_order') + '</button>' +
            '<button onclick="APP.navigateTo(\'orderTable\')">📋 ' + t('order_list') + '</button>' +
            '<button onclick="APP.navigateTo(\'paymentHistory\')">💰 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '付款记录') + '</button>' +
            (PERMISSION.can("report_view") ? '<button onclick="APP.navigateTo(\'report\')">📊 ' + t('financial_report') + '</button>' : '') +
            (PERMISSION.can("user_manage") ? '<button onclick="APP.navigateTo(\'userManagement\')">👥 ' + t('user_management') + '</button>' : '') +
            (PERMISSION.can("backup_restore") ? '<button onclick="APP.navigateTo(\'backupRestore\')">💾 ' + t('backup_restore') + '</button>' : '') +
            '<button onclick="APP.logout()">🚪 ' + t('logout') + '</button></div>' +
            '<div class="card"><h3>' + t('current_user') + ': ' + AUTH.user.name + ' (' + AUTH.user.role + ')</h3>' +
            '<p>📌 ' + (lang === 'id' ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan (dibayar bulanan)' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)') + '</p></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    // ========== 订单列表 ==========
    showOrderTable: function() {
        this.currentPage = 'orderTable';
        var self = this;
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var filteredOrders = this.db.orders ? this.db.orders.slice() : [];
        if (this.currentFilter !== "all") {
            filteredOrders = filteredOrders.filter(function(o) { return o.status === self.currentFilter; });
        }
        if (this.searchKeyword) {
            var keyword = this.searchKeyword.toLowerCase();
            filteredOrders = filteredOrders.filter(function(o) {
                return (o.customer && o.customer.name && o.customer.name.toLowerCase().indexOf(keyword) !== -1) ||
                       (o.customer && o.customer.phone && o.customer.phone.indexOf(keyword) !== -1) ||
                       (o.order_id && o.order_id.toLowerCase().indexOf(keyword) !== -1);
            });
        }
        filteredOrders.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
        var rows = '';
        if (filteredOrders.length === 0) {
            rows = '<tr><td colspan="9" style="text-align: center;">' + t('no_data') + '</td></tr>';
        } else {
            for (var i = 0; i < filteredOrders.length; i++) {
                var o = filteredOrders[i];
                var statusClass = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-danger');
                var customerName = o.customer ? Utils.escapeHtml(o.customer.name) : '-';
                var collateralName = Utils.escapeHtml(o.collateral_name || '-');
                var loanAmount = Utils.formatCurrency(o.loan_amount || 0);
                var adminFee = Utils.formatCurrency(o.admin_fee || 30000);
                var monthlyInterest = Utils.formatCurrency(o.monthly_interest || 0);
                var paidMonths = o.interest_paid_months || 0;
                var statusText = statusMap[o.status] || o.status;
                var orderId = Utils.escapeHtml(o.order_id);
                rows += '<tr>' +
                    '<td>' + orderId + '</td>' +
                    '<td>' + customerName + '</td>' +
                    '<td>' + collateralName + '</td>' +
                    '<td>' + loanAmount + '</td>' +
                    '<td>' + adminFee + '</td>' +
                    '<td>' + monthlyInterest + '</td>' +
                    '<td>' + paidMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
                    '<td>' +
                        '<button onclick="APP.navigateTo(\'viewOrder\', {orderId: \'' + o.order_id + '\'})">' + t('view') + '</button>' +
                        (o.status === 'active' ? '<button onclick="APP.navigateTo(\'payment\', {orderId: \'' + o.order_id + '\'})">💰 ' + t('save') + '</button>' : '') +
                        (PERMISSION.can("order_delete") ? '<button class="danger" onclick="APP.deleteOrder(\'' + o.order_id + '\')">' + t('delete') + '</button>' : '') +
                    '</td></tr>';
            }
        }
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>📋 ' + t('order_list') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="toolbar">' +
            '<input type="text" id="searchInput" placeholder="🔍 ' + t('search') + '..." style="max-width: 300px;" value="' + Utils.escapeHtml(this.searchKeyword) + '">' +
            '<button onclick="APP.searchOrders()">' + t('search') + '</button>' +
            '<button onclick="APP.resetSearch()">' + t('reset') + '</button>' +
            '<select id="statusFilter" onchange="APP.filterOrders(this.value)">' +
            '<option value="all" ' + (this.currentFilter === 'all' ? 'selected' : '') + '>' + t('total_orders') + '</option>' +
            '<option value="active" ' + (this.currentFilter === 'active' ? 'selected' : '') + '>' + t('active') + '</option>' +
            '<option value="completed" ' + (this.currentFilter === 'completed' ? 'selected' : '') + '>' + t('completed') + '</option></select>' +
            '<button onclick="APP.navigateTo(\'createOrder\')">➕ ' + t('create_order') + '</button></div>' +
            '<div class="table-container"><table><thead><tr>' +
            '<th>ID</th><th>' + t('customer_name') + '</th><th>' + t('collateral_name') + '</th>' +
            '<th>' + t('loan_amount') + '</th><th>' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</th>' +
            '<th>' + (lang === 'id' ? 'Bunga/Bulan' : '月利息') + '</th>' +
            '<th>' + (lang === 'id' ? 'Bunga Dibayar' : '已付利息') + '</th>' +
            '<th>' + t('status_active') + '</th><th>' + t('save') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    searchOrders: function() {
        this.searchKeyword = document.getElementById("searchInput").value;
        this.showOrderTable();
    },
    resetSearch: function() {
        this.searchKeyword = "";
        this.currentFilter = "all";
        this.showOrderTable();
    },
    filterOrders: function(status) {
        this.currentFilter = status;
        this.showOrderTable();
    },
    
    // ========== 创建订单 ==========
    showCreateOrder: function() {
        this.currentPage = 'createOrder';
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>📝 ' + t('create_order') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="card"><h3>' + t('customer_info') + '</h3>' +
            '<div class="form-group"><label>' + t('customer_name') + ' *</label><input id="name" placeholder="' + t('customer_name') + '"></div>' +
            '<div class="form-group"><label>' + t('ktp_number') + ' *</label><input id="ktp" placeholder="' + t('ktp_number') + '"></div>' +
            '<div class="form-group"><label>' + t('phone') + ' *</label><input id="phone" placeholder="' + t('phone') + '"></div>' +
            '<div class="form-group"><label>' + t('address') + '</label><textarea id="address" rows="2" placeholder="' + t('address') + '"></textarea></div>' +
            '<h3>' + t('collateral_info') + '</h3>' +
            '<div class="form-group"><label>' + t('collateral_name') + ' *</label><input id="collateral" placeholder="' + t('collateral_name') + '"></div>' +
            '<div class="form-group"><label>' + t('loan_amount') + ' *</label><input id="amount" type="number" placeholder="' + t('loan_amount') + '"></div>' +
            '<div class="form-group"><label>' + t('notes') + '</label><textarea id="notes" rows="2" placeholder="' + t('notes') + '"></textarea></div>' +
            '<div class="toolbar"><button onclick="APP.saveOrder()">💾 ' + t('save') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('cancel') + '</button></div></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    saveOrder: function() {
        var name = document.getElementById("name").value.trim();
        var ktp = document.getElementById("ktp").value.trim();
        var phone = document.getElementById("phone").value.trim();
        var collateral = document.getElementById("collateral").value.trim();
        var amount = document.getElementById("amount").value;
        if (!name || !ktp || !phone || !collateral || !amount) { alert(Utils.t('fill_all_fields')); return; }
        if (amount <= 0) { alert(Utils.t('loan_amount') + " > 0"); return; }
        var orderData = {
            customer: { name: name, ktp: ktp, phone: phone, address: document.getElementById("address").value },
            collateral_name: collateral,
            loan_amount: Number(amount),
            notes: document.getElementById("notes").value
        };
        var newOrder = Order.create(this.db, orderData);
        alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
        this.goBack();
    },
    
    // ========== 订单详情 ==========
    viewOrder: function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        var order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        if (!order) { alert('Order not found'); this.goBack(); return; }
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
        var paymentHistoryRows = '';
        if (order.payment_history && order.payment_history.length > 0) {
            for (var i = 0; i < order.payment_history.length; i++) {
                var p = order.payment_history[i];
                var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : (p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金'));
                paymentHistoryRows += '<tr><td>' + Utils.formatDate(p.date) + '</td><td>' + typeText + '</td><td>' + (p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-') + '</td><td>' + Utils.formatCurrency(p.amount) + '</td><td>' + Utils.escapeHtml(p.description || '-') + '</td></tr>';
            }
        } else {
            paymentHistoryRows = '<tr><td colspan="5" style="text-align: center;">' + t('no_data') + '</td></tr>';
        }
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>📄 ' + t('view') + ' ' + t('order_list') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="card"><h3>' + (lang === 'id' ? 'Informasi Pesanan' : '订单信息') + '</h3>' +
            '<p><strong>ID:</strong> ' + Utils.escapeHtml(order.order_id) + '</p>' +
            '<p><strong>' + t('status_active') + ':</strong> <span class="status-badge status-' + order.status + '">' + (statusMap[order.status] || order.status) + '</span></p>' +
            '<p><strong>' + (lang === 'id' ? 'Tanggal Dibuat' : '创建日期') + ':</strong> ' + Utils.formatDate(order.created_at) + '</p>' +
            '<p><strong>' + (lang === 'id' ? 'Petugas' : '经办人') + ':</strong> ' + Utils.escapeHtml(order.created_by) + '</p>' +
            '<h3>' + t('customer_info') + '</h3>' +
            '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(order.customer.name) + '</p>' +
            '<p><strong>' + t('ktp_number') + ':</strong> ' + Utils.escapeHtml(order.customer.ktp) + '</p>' +
            '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(order.customer.phone) + '</p>' +
            '<p><strong>' + t('address') + ':</strong> ' + Utils.escapeHtml(order.customer.address) + '</p>' +
            '<h3>' + t('collateral_info') + '</h3>' +
            '<p><strong>' + t('collateral_name') + ':</strong> ' + Utils.escapeHtml(order.collateral_name) + '</p>' +
            '<p><strong>' + t('loan_amount') + ':</strong> ' + Utils.formatCurrency(order.loan_amount) + '</p>' +
            '<h3>💰 ' + (lang === 'id' ? 'Rincian Biaya' : '费用明细') + '</h3>' +
            '<p><strong>' + (lang === 'id' ? 'Admin Fee' : '管理费') + ':</strong> ' + Utils.formatCurrency(order.admin_fee) + ' ' + (order.admin_fee_paid ? '✅ ' + (lang === 'id' ? 'Lunas' : '已付') : '❌ ' + (lang === 'id' ? 'Belum dibayar' : '未付')) + '</p>' +
            '<p><strong>' + (lang === 'id' ? 'Bunga per Bulan' : '月利息') + ':</strong> ' + Utils.formatCurrency(order.monthly_interest) + ' (10%)</p>' +
            '<p><strong>' + (lang === 'id' ? 'Bunga Telah Dibayar' : '已付利息') + ':</strong> ' + order.interest_paid_months + ' ' + (lang === 'id' ? 'bulan' : '个月') + ' (' + Utils.formatCurrency(order.interest_paid_total) + ')</p>' +
            '<p><strong>' + (lang === 'id' ? 'Jatuh Tempo Bunga Berikutnya' : '下次利息到期日') + ':</strong> ' + Utils.formatDate(order.next_interest_due_date) + '</p>' +
            '<p><strong>' + (lang === 'id' ? 'Pokok Dibayar' : '已还本金') + ':</strong> ' + Utils.formatCurrency(order.principal_paid) + '</p>' +
            '<p><strong>' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</strong> ' + Utils.formatCurrency(order.loan_amount - order.principal_paid) + '</p>' +
            '<p><strong>' + t('notes') + ':</strong> ' + Utils.escapeHtml(order.notes) + '</p>' +
            '<h3>📋 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '支付记录') + '</h3>' +
            '<div class="table-container"><table><thead><tr><th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th><th>' + (lang === 'id' ? 'Jenis' : '类型') + '</th><th>' + (lang === 'id' ? 'Bulan' : '月数') + '</th><th>' + (lang === 'id' ? 'Jumlah' : '金额') + '</th><th>' + (lang === 'id' ? 'Keterangan' : '说明') + '</th></tr></thead><tbody>' + paymentHistoryRows + '</tbody></table></div>' +
            '<div class="toolbar"><button onclick="APP.goBack()">↩️ ' + t('back') + '</button>' +
            (order.status === 'active' ? '<button onclick="APP.navigateTo(\'payment\', {orderId: \'' + order.order_id + '\'})">💰 ' + t('save') + '</button>' : '') + '</div></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    // ========== 支付功能 ==========
    showPayment: function(orderId) {
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        var order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        if (!order) return;
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var remainingPrincipal = order.loan_amount - order.principal_paid;
        var currentMonthlyInterest = remainingPrincipal * 0.10;
        var interestOptions = '';
        for (var i = 1; i <= 12; i++) {
            var amount = currentMonthlyInterest * i;
            interestOptions += '<option value="' + i + '">' + i + ' ' + (lang === 'id' ? 'bulan' : '个月') + ' (' + Utils.formatCurrency(amount) + ')</option>';
        }
        var adminFeeSection = !order.admin_fee_paid ?
            '<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;"><h4>📋 ' + (lang === 'id' ? 'Admin Fee' : '管理费') + ' - ' + Utils.formatCurrency(order.admin_fee) + '</h4><button onclick="APP.payAdminFee(\'' + order.order_id + '\')" class="success">✅ ' + (lang === 'id' ? 'Catat Pembayaran Admin Fee' : '记录管理费支付') + '</button></div>' :
            '<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;"><h4>📋 ' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</h4><p>✅ ' + (lang === 'id' ? 'Sudah dibayar' : '已支付') + '</p></div>';
        var principalSection = '';
        if (remainingPrincipal > 0) {
            principalSection = '<div class="form-group"><label>' + (lang === 'id' ? 'Jumlah Pembayaran Pokok' : '本金支付金额') + ':</label><input type="number" id="principalAmount" value="' + remainingPrincipal + '" style="width: 200px;"></div>' +
                '<button onclick="APP.payPrincipal(\'' + order.order_id + '\')" class="success">✅ ' + (lang === 'id' ? 'Bayar Pokok' : '支付本金') + '</button>';
        } else {
            principalSection = '<p>✅ ' + (lang === 'id' ? 'Pokok sudah lunas' : '本金已结清') + '</p>';
        }
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>💰 ' + (lang === 'id' ? 'Pembayaran' : '缴费') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="card"><h3>📋 ' + (lang === 'id' ? 'Informasi Pesanan' : '订单信息') + '</h3>' +
            '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(order.customer.name) + '</p>' +
            '<p><strong>ID Pesanan:</strong> ' + Utils.escapeHtml(order.order_id) + '</p>' +
            '<p><strong>' + t('loan_amount') + ':</strong> ' + Utils.formatCurrency(order.loan_amount) + '</p>' +
            '<p><strong>' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</strong> ' + Utils.formatCurrency(remainingPrincipal) + '</p>' +
            '<p><strong>' + (lang === 'id' ? 'Bunga Bulanan Saat Ini' : '当前月利息') + ':</strong> ' + Utils.formatCurrency(currentMonthlyInterest) + '</p></div>' +
            '<div class="card"><h3>💰 ' + (lang === 'id' ? 'Pilih Jenis Pembayaran' : '选择支付类型') + '</h3>' +
            adminFeeSection +
            '<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;"><h4>💰 ' + (lang === 'id' ? 'Pembayaran Bunga' : '支付利息') + '</h4>' +
            '<div class="form-group"><label>' + (lang === 'id' ? 'Jumlah Bulan' : '月数') + ':</label><select id="interestMonths" style="width: 200px;">' + interestOptions + '</select></div>' +
            '<button onclick="APP.payInterest(\'' + order.order_id + '\')" class="success">✅ ' + (lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息支付') + '</button></div>' +
            '<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;"><h4>🏦 ' + (lang === 'id' ? 'Pembayaran Pokok' : '本金支付') + '</h4>' +
            '<p><strong>' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</strong> ' + Utils.formatCurrency(remainingPrincipal) + '</p>' +
            principalSection + '</div></div>' +
            '<div class="toolbar"><button onclick="APP.goBack()">↩️ ' + t('cancel') + '</button></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    payAdminFee: function(orderId) {
        var lang = Utils.lang;
        if (confirm(lang === 'id' ? 'Konfirmasi penerimaan Admin Fee 30,000 IDR?' : '确认已收取管理费 30,000 IDR？')) {
            Order.recordAdminFee(this.db, orderId);
            alert(lang === 'id' ? 'Admin Fee dicatat!' : '管理费已记录！');
            this.viewOrder(orderId);
        }
    },
    
    payInterest: function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        var lang = Utils.lang;
        var remainingPrincipal = order.loan_amount - order.principal_paid;
        var monthlyInterest = remainingPrincipal * 0.10;
        var amount = monthlyInterest * months;
        if (remainingPrincipal <= 0) {
            alert(lang === 'id' ? 'Pokok sudah lunas, tidak perlu membayar bunga' : '本金已结清，无需支付利息');
            return;
        }
        if (confirm((lang === 'id' ? 'Konfirmasi pembayaran bunga' : '确认支付利息') + '\n' +
            (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ': ' + Utils.formatCurrency(remainingPrincipal) + '\n' +
            (lang === 'id' ? 'Total' : '总计') + ': ' + Utils.formatCurrency(amount) + ' (' + months + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')')) {
            Order.recordInterestPayment(this.db, orderId, months);
            alert(lang === 'id' ? 'Pembayaran bunga dicatat!' : '利息支付已记录！');
            this.viewOrder(orderId);
        }
    },
    
    payPrincipal: function(orderId) {
        var amountInput = document.getElementById("principalAmount");
        var amount = parseFloat(amountInput.value);
        var order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        var lang = Utils.lang;
        var remainingPrincipal = order.loan_amount - order.principal_paid;
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        if (amount > remainingPrincipal) { alert(lang === 'id' ? 'Jumlah melebihi sisa pokok' : '金额超过剩余本金'); return; }
        if (confirm((lang === 'id' ? 'Konfirmasi pembayaran pokok' : '确认支付本金') + ' ' + Utils.formatCurrency(amount) + '?')) {
            Order.recordPrincipalPayment(this.db, orderId, amount);
            if (amount >= remainingPrincipal) {
                alert(lang === 'id' ? 'Pokok lunas! Pesanan selesai.' : '本金已结清！订单完成。');
            } else {
                alert(lang === 'id' ? 'Pembayaran pokok dicatat!' : '本金支付已记录！');
            }
            this.viewOrder(orderId);
        }
    },
    
    // ========== 编辑订单 ==========
    editOrder: function(orderId) {
        this.currentPage = 'editOrder';
        this.currentOrderId = orderId;
        var order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        if (!order) return;
        var t = function(key) { return Utils.t(key); };
        var lang = Utils.lang;
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>✏️ ' + t('edit') + ' ' + t('order_list') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="card">' +
            '<div class="form-group"><label>' + t('customer_name') + '</label><input id="name" value="' + Utils.escapeHtml(order.customer.name) + '"></div>' +
            '<div class="form-group"><label>' + t('ktp_number') + '</label><input id="ktp" value="' + Utils.escapeHtml(order.customer.ktp) + '"></div>' +
            '<div class="form-group"><label>' + t('phone') + '</label><input id="phone" value="' + Utils.escapeHtml(order.customer.phone) + '"></div>' +
            '<div class="form-group"><label>' + t('address') + '</label><textarea id="address">' + Utils.escapeHtml(order.customer.address) + '</textarea></div>' +
            '<div class="form-group"><label>' + t('collateral_name') + '</label><input id="collateral" value="' + Utils.escapeHtml(order.collateral_name) + '"></div>' +
            '<div class="form-group"><label>' + t('notes') + '</label><textarea id="notes">' + Utils.escapeHtml(order.notes) + '</textarea></div>' +
            '<div class="toolbar"><button onclick="APP.updateOrder(\'' + order.order_id + '\')">💾 ' + t('save') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('cancel') + '</button></div></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    updateOrder: function(orderId) {
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
        Order.update(this.db, orderId, updates);
        alert(Utils.t('order_updated'));
        this.goBack();
    },
    
    // ========== 删除订单 ==========
    deleteOrder: function(orderId) {
        if (confirm(Utils.t('confirm_delete'))) {
            Order.delete(this.db, orderId);
            alert(Utils.t('order_deleted'));
            this.showOrderTable();
        }
    },
    
    // ========== 财务报表 ==========
    showReport: function() {
        this.currentPage = 'report';
        var report = Order.getReport(this.db);
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>📊 ' + t('financial_report') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + report.total_orders + '</div><div>' + t('total_orders') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_loan_amount) + '</div><div>' + t('total_loan') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_admin_fees) + '</div><div>' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_interest) + '</div><div>' + (lang === 'id' ? 'Bunga' : '利息收入') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(report.total_principal) + '</div><div>' + (lang === 'id' ? 'Pokok' : '本金回收') + '</div></div></div>' +
            '<div class="toolbar"><button onclick="APP.exportToCSV()">📎 ' + (lang === 'id' ? 'Ekspor CSV' : '导出CSV') + '</button></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    exportToCSV: function() {
        Utils.exportToCSV(this.db.orders, 'jf_gadai_orders_' + new Date().toISOString().split('T')[0] + '.csv');
        alert(Utils.t('export_success'));
    },
    
    // ========== 付款记录 ==========
    showPaymentHistory: function() {
        this.currentPage = 'paymentHistory';
        var lang = Utils.lang;
        var allPayments = [];
        if (this.db.orders) {
            for (var i = 0; i < this.db.orders.length; i++) {
                var order = this.db.orders[i];
                if (order.payment_history && order.payment_history.length) {
                    for (var j = 0; j < order.payment_history.length; j++) {
                        var p = order.payment_history[j];
                        allPayments.push({
                            order_id: order.order_id,
                            customer_name: order.customer ? order.customer.name : '-',
                            date: p.date,
                            type: p.type,
                            months: p.months,
                            amount: p.amount,
                            description: p.description
                        });
                    }
                }
            }
        }
        allPayments.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
        var totalAdminFee = 0, totalInterest = 0, totalPrincipal = 0;
        for (var i = 0; i < allPayments.length; i++) {
            var p = allPayments[i];
            if (p.type === 'admin_fee') totalAdminFee += p.amount;
            else if (p.type === 'interest') totalInterest += p.amount;
            else if (p.type === 'principal') totalPrincipal += p.amount;
        }
        var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
        var rows = '';
        if (allPayments.length === 0) {
            rows = '<tr><td colspan="8" style="text-align: center;">' + Utils.t('no_data') + '</td></tr>';
        } else {
            for (var i = 0; i < allPayments.length; i++) {
                var p = allPayments[i];
                rows += '<tr><td>' + Utils.escapeHtml(p.order_id) + '</td><td>' + Utils.escapeHtml(p.customer_name) + '</td><td>' + Utils.formatDate(p.date) + '</td><td>' + (typeMap[p.type] || p.type) + '</td><td>' + (p.months ? p.months + ' ' + (lang === 'id' ? 'bln' : '个月') : '-') + '</td><td>' + Utils.formatCurrency(p.amount) + '</td><td>' + Utils.escapeHtml(p.description || '-') + '</td><td><button onclick="APP.navigateTo(\'viewOrder\', {orderId: \'' + p.order_id + '\'})">' + Utils.t('view') + '</button></td></tr>';
            }
        }
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>💰 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '付款记录') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + Utils.t('back') + '</button></div></div>' +
            '<div class="stats-grid">' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalAdminFee) + '</div><div>' + (lang === 'id' ? 'Total Admin Fee' : '管理费总额') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalInterest) + '</div><div>' + (lang === 'id' ? 'Total Bunga' : '利息总额') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalPrincipal) + '</div><div>' + (lang === 'id' ? 'Total Pokok' : '本金总额') + '</div></div>' +
            '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalAdminFee + totalInterest + totalPrincipal) + '</div><div>' + (lang === 'id' ? 'Total Semua' : '全部总计') + '</div></div></div>' +
            '<div class="table-container"><table><thead><tr><th>' + (lang === 'id' ? 'ID Pesanan' : '订单ID') + '</th><th>' + Utils.t('customer_name') + '</th><th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th><th>' + (lang === 'id' ? 'Jenis' : '类型') + '</th><th>' + (lang === 'id' ? 'Bulan' : '月数') + '</th><th>' + (lang === 'id' ? 'Jumlah' : '金额') + '</th><th>' + (lang === 'id' ? 'Keterangan' : '说明') + '</th><th>' + Utils.t('save') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
            '<div class="toolbar"><button onclick="APP.exportPaymentHistoryToCSV()">📎 ' + (lang === 'id' ? 'Ekspor CSV' : '导出CSV') + '</button></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    exportPaymentHistoryToCSV: function() {
        alert('导出付款记录功能开发中');
    },
    
    // ========== 备份恢复 ==========
    showBackupRestore: function() {
        this.currentPage = 'backupRestore';
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>💾 ' + t('backup_restore') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="card"><h3>' + (lang === 'id' ? 'Cadangan Data' : '备份数据') + '</h3>' +
            '<button onclick="APP.backupData()">📥 ' + (lang === 'id' ? 'Ekspor File Cadangan' : '导出备份文件') + '</button>' +
            '<h3 style="margin-top: 30px;">' + (lang === 'id' ? 'Pemulihan Data' : '恢复数据') + '</h3>' +
            '<input type="file" id="restoreFile" accept=".json">' +
            '<button onclick="APP.restoreData()">📤 ' + (lang === 'id' ? 'Impor Pemulihan' : '导入恢复') + '</button>' +
            '<p style="margin-top: 10px; color: #f59e0b;">⚠️ ' + (lang === 'id' ? 'Perhatian: Memulihkan data akan menimpa semua data yang ada, harap berhati-hati!' : '注意：恢复数据将覆盖当前所有数据，请谨慎操作！') + '</p></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    backupData: function() {
        Storage.backup();
        alert(Utils.t('backup_downloaded'));
    },
    
    restoreData: async function() {
        var fileInput = document.getElementById("restoreFile");
        var file = fileInput.files[0];
        var lang = Utils.lang;
        if (!file) { alert(lang === 'id' ? 'Pilih file cadangan' : '请选择备份文件'); return; }
        if (confirm(lang === 'id' ? '⚠️ Memulihkan data akan menimpa semua data yang ada, lanjutkan?' : '⚠️ 恢复数据将覆盖所有现有数据，确定继续吗？')) {
            var success = await Storage.restore(file);
            if (success) {
                alert(lang === 'id' ? 'Pemulihan data berhasil! Sistem akan dimuat ulang.' : '数据恢复成功！系统将重新加载。');
                location.reload();
            } else {
                alert(lang === 'id' ? 'Pemulihan gagal: Format file salah' : '恢复失败：文件格式错误');
            }
        }
    },
    
    // ========== 用户管理 ==========
    showUserManagement: function() {
        this.currentPage = 'userManagement';
        var users = this.db.users ? this.db.users.slice() : [];
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        users.sort(function(a, b) { return a.username.localeCompare(b.username); });
        var userRows = '';
        if (users.length === 0) {
            userRows = '<tr><td colspan="4" style="text-align: center;">' + t('no_data') + '</td></tr>';
        } else {
            for (var i = 0; i < users.length; i++) {
                var u = users[i];
                var isCurrent = (u.username === AUTH.user.username);
                userRows += '<tr><td>' + Utils.escapeHtml(u.username) + '</td><td>' + Utils.escapeHtml(u.name) + '</td><td>' + (u.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Staf' : '员工')) + '</td><td>' +
                    (!isCurrent ? '<button class="danger" onclick="APP.deleteUser(\'' + Utils.escapeHtml(u.username) + '\')">' + t('delete') + '</button>' : '<span style="color: #10b981;">✅ ' + (lang === 'id' ? 'Login Saat Ini' : '当前登录') + '</span>') +
                    '</td></tr>';
            }
        }
        var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">' +
            '<h2>👥 ' + t('user_management') + '</h2>' +
            '<div><button onclick="APP.toggleLanguage()">🌐 ' + (lang === 'id' ? '中文' : 'Bahasa Indonesia') + '</button>' +
            '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button></div></div>' +
            '<div class="card"><h3>' + (lang === 'id' ? 'Tambah Pengguna Baru' : '添加新用户') + '</h3>' +
            '<div class="form-group"><label>' + t('username') + ' *</label><input id="newUsername" placeholder="' + t('username') + '" style="width: 250px;"></div>' +
            '<div class="form-group"><label>' + t('password') + ' *</label><input id="newPassword" type="password" placeholder="' + t('password') + '" style="width: 250px;"></div>' +
            '<div class="form-group"><label>' + (lang === 'id' ? 'Nama Lengkap' : '姓名') + ' *</label><input id="newName" placeholder="' + (lang === 'id' ? 'Nama Lengkap' : '姓名') + '" style="width: 250px;"></div>' +
            '<div class="form-group"><label>' + (lang === 'id' ? 'Peran' : '角色') + ' *</label><select id="newRole" style="width: 250px;"><option value="staff">' + (lang === 'id' ? 'Staf' : '员工') + '</option><option value="admin">' + (lang === 'id' ? 'Administrator' : '管理员') + '</option></select></div>' +
            '<button onclick="APP.addUser()" class="success">➕ ' + (lang === 'id' ? 'Tambah Pengguna' : '添加用户') + '</button></div>' +
            '<div class="card"><h3>' + (lang === 'id' ? 'Daftar Pengguna' : '用户列表') + '</h3>' +
            '<p style="color: #94a3b8; font-size: 12px; margin-bottom: 10px;">💡 ' + (lang === 'id' ? 'Total pengguna: ' + users.length : '用户总数: ' + users.length) + '</p>' +
            '<div class="table-container"><table style="width: 100%;"><thead><tr><th>' + t('username') + '</th><th>' + (lang === 'id' ? 'Nama' : '姓名') + '</th><th>' + (lang === 'id' ? 'Peran' : '角色') + '</th><th>' + t('save') + '</th></tr></thead><tbody>' + userRows + '</tbody></table></div></div>';
        document.getElementById("app").innerHTML = html;
    },
    
    addUser: function() {
        var username = document.getElementById("newUsername").value.trim();
        var password = document.getElementById("newPassword").value;
        var name = document.getElementById("newName").value.trim();
        var role = document.getElementById("newRole").value;
        var lang = Utils.lang;
        if (!username) { alert(lang === 'id' ? 'Nama pengguna tidak boleh kosong' : '用户名不能为空'); return; }
        if (!password) { alert(lang === 'id' ? 'Kata sandi tidak boleh kosong' : '密码不能为空'); return; }
        if (!name) { alert(lang === 'id' ? 'Nama lengkap tidak boleh kosong' : '姓名不能为空'); return; }
        var existing = this.db.users.find(function(u) { return u.username === username; });
        if (existing) { alert((lang === 'id' ? 'Nama pengguna "' : '用户名 "') + username + '" ' + (lang === 'id' ? 'sudah ada!' : '已存在！')); return; }
        this.db.users.push({ username: username, password: btoa(password), role: role, name: name });
        Storage.save(this.db);
        alert((lang === 'id' ? 'Pengguna "' : '用户 "') + username + '" ' + (lang === 'id' ? 'berhasil ditambahkan!' : '添加成功！'));
        document.getElementById("newUsername").value = '';
        document.getElementById("newPassword").value = '';
        document.getElementById("newName").value = '';
        document.getElementById("newRole").value = 'staff';
        this.showUserManagement();
    },
    
    deleteUser: function(username) {
        var lang = Utils.lang;
        if (username === AUTH.user.username) { alert(lang === 'id' ? 'Tidak dapat menghapus pengguna yang sedang login!' : '不能删除当前登录的用户！'); return; }
        if (username === 'admin') { alert(lang === 'id' ? 'Tidak dapat menghapus pengguna admin default!' : '不能删除默认管理员账户！'); return; }
        if (confirm((lang === 'id' ? 'Hapus pengguna "' : '删除用户 "') + username + '" ?')) {
            this.db.users = this.db.users.filter(function(u) { return u.username !== username; });
            Storage.save(this.db);
            alert((lang === 'id' ? 'Pengguna "' : '用户 "') + username + '" ' + (lang === 'id' ? 'telah dihapus' : '已删除'));
            this.showUserManagement();
        }
    }
};
