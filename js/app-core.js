window.APP = {
    db: null,
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    
    // ==================== 初始化 ====================
    init() {
        this.db = Storage.load();
        AUTH.init(this.db);
        this.router();
    },
    
    router() {
        if (!AUTH.user) this.renderLogin();
        else this.renderDashboard();
    },
    
    // ==================== 语言切换 ====================
    toggleLanguage() {
        const newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        this.refreshCurrentPage();
    },
    
    refreshCurrentPage() {
        switch (this.currentPage) {
            case 'dashboard': this.renderDashboard(); break;
            case 'orderTable': this.showOrderTable(); break;
            case 'createOrder': this.showCreateOrder(); break;
            case 'viewOrder': if (this.currentOrderId) this.viewOrder(this.currentOrderId); break;
            case 'payment': if (this.currentOrderId) this.showPayment(this.currentOrderId); break;
            case 'editOrder': if (this.currentOrderId) this.editOrder(this.currentOrderId); break;
            case 'report': this.showReport(); break;
            case 'userManagement': this.showUserManagement(); break;
            case 'backupRestore': this.showBackupRestore(); break;
            default: this.renderDashboard();
        }
    },
    
    // ==================== 页面导航 ====================
    navigateTo(page, params = {}) {
        this.historyStack.push({
            page: this.currentPage,
            orderId: this.currentOrderId,
            filter: this.currentFilter,
            keyword: this.searchKeyword
        });
        
        this.currentPage = page;
        if (params.orderId) this.currentOrderId = params.orderId;
        
        const handlers = {
            orderTable: () => this.showOrderTable(),
            createOrder: () => this.showCreateOrder(),
            dashboard: () => this.renderDashboard(),
            report: () => this.showReport(),
            userManagement: () => this.showUserManagement(),
            backupRestore: () => this.showBackupRestore(),
            viewOrder: () => params.orderId && this.viewOrder(params.orderId),
            payment: () => params.orderId && this.showPayment(params.orderId),
            editOrder: () => params.orderId && this.editOrder(params.orderId)
        };
        
        (handlers[page] || handlers.dashboard)();
    },
    
    goBack() {
        if (this.historyStack.length > 0) {
            const prev = this.historyStack.pop();
            this.currentPage = prev.page;
            this.currentOrderId = prev.orderId;
            this.currentFilter = prev.filter || "all";
            this.searchKeyword = prev.keyword || "";
            
            const restoreHandlers = {
                orderTable: () => this.showOrderTable(),
                dashboard: () => this.renderDashboard(),
                viewOrder: () => prev.orderId && this.viewOrder(prev.orderId),
                report: () => this.showReport(),
                userManagement: () => this.showUserManagement(),
                backupRestore: () => this.showBackupRestore()
            };
            
            (restoreHandlers[prev.page] || restoreHandlers.dashboard)();
        } else {
            this.renderDashboard();
        }
    },
    
    // ==================== 登录页面 ====================
    renderLogin() {
        document.getElementById("app").innerHTML = `
            <div class="card" style="max-width: 400px; margin: 50px auto;">
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                </div>
                <h2>JF GADAI ENTERPRISE</h2>
                <h3>${Utils.t('login')}</h3>
                <div class="form-group">
                    <label>${Utils.t('username')}</label>
                    <input id="username" placeholder="${Utils.t('username')}">
                </div>
                <div class="form-group">
                    <label>${Utils.t('password')}</label>
                    <input id="password" type="password" placeholder="${Utils.t('password')}">
                </div>
                <button onclick="APP.login()">${Utils.t('login')}</button>
                <p style="margin-top: 15px; font-size: 12px; color: #94a3b8;">
                    Demo: admin/admin123 | staff/staff123
                </p>
            </div>
        `;
    },
    
    login() {
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        
        if (!username || !password) {
            alert(Utils.t('fill_all_fields'));
            return;
        }
        
        const user = AUTH.login(username, password);
        if (!user) {
            alert(Utils.t('login_failed'));
            return;
        }
        
        this.router();
    },
    
    // ==================== 仪表板 ====================
    renderDashboard() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        const report = Order.getReport(this.db);
        
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                <h1>🏦 JF GADAI ENTERPRISE</h1>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    ${this.historyStack.length > 0 ? `<button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>` : ''}
                </div>
            </div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${report.total_orders}</div><div>${Utils.t('total_orders')}</div></div>
                <div class="stat-card"><div class="stat-value">${report.active_orders}</div><div>${Utils.t('active')}</div></div>
                <div class="stat-card"><div class="stat-value">${report.completed_orders}</div><div>${Utils.t('completed')}</div></div>
                <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div><div>${Utils.t('total_loan')}</div></div>
                <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_fees_collected)}</div><div>${Utils.t('total_fees')}</div></div>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.navigateTo('createOrder')">➕ ${Utils.t('create_order')}</button>
                <button onclick="APP.navigateTo('orderTable')">📋 ${Utils.t('order_list')}</button>
                ${PERMISSION.can("report_view") ? `<button onclick="APP.navigateTo('report')">📊 ${Utils.t('financial_report')}</button>` : ''}
                ${PERMISSION.can("user_manage") ? `<button onclick="APP.navigateTo('userManagement')">👥 ${Utils.t('user_management')}</button>` : ''}
                ${PERMISSION.can("backup_restore") ? `<button onclick="APP.navigateTo('backupRestore')">💾 ${Utils.t('backup_restore')}</button>` : ''}
                <button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button>
            </div>
            
            <div class="card">
                <h3>${Utils.t('current_user')}: ${AUTH.user.name} (${AUTH.user.role})</h3>
                <p>📌 ${Utils.t('business_rule')}</p>
            </div>
        `;
    },
    
    // ==================== 订单列表 ====================
    showOrderTable() {
        this.currentPage = 'orderTable';
        
        let filteredOrders = [...this.db.orders];
        if (this.currentFilter !== "all") {
            filteredOrders = filteredOrders.filter(o => o.status === this.currentFilter);
        }
        if (this.searchKeyword) {
            const keyword = this.searchKeyword.toLowerCase();
            filteredOrders = filteredOrders.filter(o => 
                o.customer.name.toLowerCase().includes(keyword) ||
                o.customer.phone.includes(keyword) ||
                o.order_id.includes(keyword)
            );
        }
        filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const statusMap = {
            active: Utils.t('status_active'),
            completed: Utils.t('status_completed'),
            liquidated: Utils.t('status_liquidated'),
            overdue: Utils.t('status_overdue')
        };
        
        const rows = filteredOrders.map(o => {
            const status = Utils.checkOrderStatus(o);
            const statusClass = status === 'active' ? 'status-active' : 
                               (status === 'completed' ? 'status-completed' : 'status-danger');
            const monthlyPayment = Utils.calculateMonthlyPayment(o.loan_amount);
            
            return `
                <tr>
                    <td>${Utils.escapeHtml(o.order_id)}</td>
                    <td>${Utils.escapeHtml(o.customer.name)}</td>
                    <td>${Utils.escapeHtml(o.collateral_name)}</td>
                    <td>${Utils.formatCurrency(o.loan_amount)}</td>
                    <td>${Utils.formatCurrency(monthlyPayment)}</td>
                    <td>${o.paid_months}/10</td>
                    <td><span class="status-badge ${statusClass}">${statusMap[status] || status}</span></td>
                    <td>${Utils.formatDate(o.next_due_date)}</td>
                    <td>
                        <button onclick="APP.navigateTo('viewOrder', {orderId: '${o.order_id}'})">${Utils.t('view')}</button>
                        ${PERMISSION.can("order_payment") && o.status === 'active' ? 
                            `<button onclick="APP.navigateTo('payment', {orderId: '${o.order_id}'})">${Utils.t('save')}</button>` : ''}
                        ${PERMISSION.can("order_edit") && o.status === 'active' ? 
                            `<button onclick="APP.navigateTo('editOrder', {orderId: '${o.order_id}'})">${Utils.t('edit')}</button>` : ''}
                        ${PERMISSION.can("order_delete") ? 
                            `<button class="danger" onclick="APP.deleteOrder('${o.order_id}')">${Utils.t('delete')}</button>` : ''}
                    </td>
                </tr>
            `;
        }).join("");
        
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>📋 ${Utils.t('order_list')}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
                </div>
            </div>
            <div class="toolbar">
                <input type="text" id="searchInput" placeholder="🔍 ${Utils.t('search')}..." style="max-width: 300px;" value="${Utils.escapeHtml(this.searchKeyword)}">
                <button onclick="APP.searchOrders()">${Utils.t('search')}</button>
                <button onclick="APP.resetSearch()">${Utils.t('reset')}</button>
                <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                    <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>${Utils.t('total_orders')}</option>
                    <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>${Utils.t('active')}</option>
                    <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>${Utils.t('completed')}</option>
                    <option value="liquidated" ${this.currentFilter === 'liquidated' ? 'selected' : ''}>${Utils.t('liquidated')}</option>
                </select>
                <button onclick="APP.navigateTo('createOrder')">➕ ${Utils.t('create_order')}</button>
            </div>
            <div class="table-container">
                <table>
                    <thead><tr>
                        <th>ID</th><th>${Utils.t('customer_name')}</th><th>${Utils.t('collateral_name')}</th>
                        <th>${Utils.t('loan_amount')}</th><th>${Utils.t('monthly_payment')}</th>
                        <th>${Utils.t('active')}</th><th>${Utils.t('status_active')}</th>
                        <th>${Utils.lang === 'id' ? 'Jatuh Tempo' : '下次缴费'}</th><th>${Utils.t('save')}</th>
                    </tr></thead>
                    <tbody>${rows || `<tr><td colspan="9">${Utils.t('no_data')}</td></tr>`}</tbody>
                </table>
            </div>
        `;
    },
    
    searchOrders() {
        this.searchKeyword = document.getElementById("searchInput").value;
        this.showOrderTable();
    },
    
    resetSearch() {
        this.searchKeyword = "";
        this.currentFilter = "all";
        this.showOrderTable();
    },
    
    filterOrders(status) {
        this.currentFilter = status;
        this.showOrderTable();
    },
    
    // ==================== 退出登录 ====================
    logout() {
        AUTH.logout();
        this.router();
    }
};
