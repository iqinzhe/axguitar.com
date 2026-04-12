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
        Utils.setDb(this.db);
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
        const handlers = {
            dashboard: () => this.renderDashboard(),
            orderTable: () => this.showOrderTable(),
            createOrder: () => this.showCreateOrder(),
            viewOrder: () => this.currentOrderId && this.viewOrder(this.currentOrderId),
            payment: () => this.currentOrderId && this.showPayment(this.currentOrderId),
            editOrder: () => this.currentOrderId && this.editOrder(this.currentOrderId),
            report: () => this.showReport(),
            userManagement: () => this.showUserManagement(),
            backupRestore: () => this.showBackupRestore(),
            paymentHistory: () => this.showPaymentHistory()
        };
        (handlers[this.currentPage] || handlers.dashboard)();
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
        
        const navHandlers = {
            orderTable: () => this.showOrderTable(),
            createOrder: () => this.showCreateOrder(),
            dashboard: () => this.renderDashboard(),
            report: () => this.showReport(),
            userManagement: () => this.showUserManagement(),
            backupRestore: () => this.showBackupRestore(),
            paymentHistory: () => this.showPaymentHistory(),
            viewOrder: () => params.orderId && this.viewOrder(params.orderId),
            payment: () => params.orderId && this.showPayment(params.orderId),
            editOrder: () => params.orderId && this.editOrder(params.orderId)
        };
        (navHandlers[page] || navHandlers.dashboard)();
    },
    
    goBack() {
        if (this.historyStack.length > 0) {
            const prev = this.historyStack.pop();
            this.currentPage = prev.page;
            this.currentOrderId = prev.orderId;
            this.currentFilter = prev.filter || "all";
            this.searchKeyword = prev.keyword || "";
            
            const backHandlers = {
                orderTable: () => this.showOrderTable(),
                dashboard: () => this.renderDashboard(),
                viewOrder: () => prev.orderId && this.viewOrder(prev.orderId),
                report: () => this.showReport(),
                userManagement: () => this.showUserManagement(),
                backupRestore: () => this.showBackupRestore(),
                paymentHistory: () => this.showPaymentHistory()
            };
            (backHandlers[prev.page] || backHandlers.dashboard)();
        } else {
            this.renderDashboard();
        }
    },
    
    // ==================== 登录页面 ====================
    renderLogin() {
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
        document.getElementById("app").innerHTML = `
            <div class="card" style="max-width: 400px; margin: 50px auto;">
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                </div>
                <h2>JF GADAI ENTERPRISE</h2>
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
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                <h1>🏦 JF GADAI ENTERPRISE</h1>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    ${this.historyStack.length > 0 ? '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button>' : ''}
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
                <button onclick="APP.navigateTo('createOrder')">➕ ${t('create_order')}</button>
                <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</button>
                ${PERMISSION.can("report_view") ? '<button onclick="APP.navigateTo(\'report\')">📊 ' + t('financial_report') + '</button>' : ''}
                ${PERMISSION.can("user_manage") ? '<button onclick="APP.navigateTo(\'userManagement\')">👥 ' + t('user_management') + '</button>' : ''}
                ${PERMISSION.can("backup_restore") ? '<button onclick="APP.navigateTo(\'backupRestore\')">💾 ' + t('backup_restore') + '</button>' : ''}
                <button onclick="APP.logout()">🚪 ${t('logout')}</button>
            </div>
            
            <div class="card">
                <h3>${t('current_user')}: ${AUTH.user.name} (${AUTH.user.role})</h3>
                <p>📌 ${lang === 'id' ? 'Biaya Admin: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan (dibayar bulanan)' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
            </div>
        `;
    },
    
    // ==================== 订单列表 ====================
    showOrderTable() {
        this.currentPage = 'orderTable';
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
        let filteredOrders = [...this.db.orders];
        if (this.currentFilter !== "all") {
            filteredOrders = filteredOrders.filter(o => o.status === this.currentFilter);
        }
        if (this.searchKeyword) {
            const keyword = this.searchKeyword.toLowerCase();
            filteredOrders = filteredOrders.filter(o => 
                o.customer.name.toLowerCase().includes(keyword) ||
                o.customer.phone.includes(keyword) ||
                o.order_id.toLowerCase().includes(keyword)
            );
        }
        filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        const statusMap = {
            active: t('status_active'),
            completed: t('status_completed'),
            liquidated: t('status_liquidated')
        };
        
        const rows = filteredOrders.map(o => {
            const statusClass = o.status === 'active' ? 'status-active' : 
                               (o.status === 'completed' ? 'status-completed' : 'status-danger');
            
            return `
                <tr>
                    <td>${Utils.escapeHtml(o.order_id)}</td
                    <td>${Utils.escapeHtml(o.customer.name)}</td
                    <td>${Utils.escapeHtml(o.collateral_name)}</td
                    <td>${Utils.formatCurrency(o.loan_amount)}</td
                    <td>${Utils.formatCurrency(o.admin_fee)}</td
                    <td>${Utils.formatCurrency(o.monthly_interest)}</td
                    <td>${o.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</td
                    <td><span class="status-badge ${statusClass}">${statusMap[o.status] || o.status}</span></td
                    <td>
                        <button onclick="APP.navigateTo('viewOrder', {orderId: '${o.order_id}'})">${t('view')}</button>
                        ${o.status === 'active' ? '<button onclick="APP.navigateTo(\'payment\', {orderId: \'' + o.order_id + '\'})">💰 ' + t('save') + '</button>' : ''}
                        ${PERMISSION.can("order_delete") ? '<button class="danger" onclick="APP.deleteOrder(\'' + o.order_id + '\')">' + t('delete') + '</button>' : ''}
                    </td
                </tr>
            `;
        }).join("");
        
        document.getElementById("app").innerHTML = `
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
                            <th>${t('status_active')}</th><th>${t('save')}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="9">' + t('no_data') + '</td></tr>'}</tbody>
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
    
    // ==================== 创建订单 ====================
    showCreateOrder() {
        this.currentPage = 'createOrder';
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
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
                <div class="form-group"><label>${t('loan_amount')} *</label><input id="amount" type="number" placeholder="${t('loan_amount')}"></div>
                <div class="form-group"><label>${t('notes')}</label><textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea></div>
                
                <div class="form-group">
                    <p style="background: #0f172a; padding: 10px; border-radius: 6px;">
                        📌 ${lang === 'id' ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月'}
                    </p>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.saveOrder()">💾 ${t('save')}</button>
                    <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                </div>
            </div>
        `;
    },
    
    saveOrder() {
        const name = document.getElementById("name").value.trim();
        const ktp = document.getElementById("ktp").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const collateral = document.getElementById("collateral").value.trim();
        const amount = document.getElementById("amount").value;
        const lang = Utils.lang;
        
        if (!name || !ktp || !phone || !collateral || !amount) {
            alert(Utils.t('fill_all_fields'));
            return;
        }
        if (amount <= 0) {
            alert(Utils.t('loan_amount') + " > 0");
            return;
        }
        
        const orderData = {
            customer: { name, ktp, phone, address: document.getElementById("address").value },
            collateral_name: collateral,
            loan_amount: Number(amount),
            notes: document.getElementById("notes").value
        };
        
        const newOrder = Order.create(this.db, orderData);
        alert(Utils.t('order_created') + "\nID: " + newOrder.order_id + "\n" + (lang === 'id' ? 'Admin Fee 30,000 IDR harus dibayar sekarang!' : '管理费 30,000 IDR 请立即收取现金！'));
        
        if (confirm(lang === 'id' ? 'Apakah admin fee sudah dibayar?' : '管理费是否已收取？')) {
            Order.recordAdminFee(this.db, newOrder.order_id);
            alert(lang === 'id' ? 'Admin fee dicatat!' : '管理费已记录！');
        }
        
        this.goBack();
    },
    
    // ==================== 查看订单详情 ====================
    viewOrder(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        const order = this.db.orders.find(o => o.order_id === orderId);
        if (!order) return;
        
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
        const statusMap = {
            active: t('status_active'),
            completed: t('status_completed'),
            liquidated: t('status_liquidated')
        };
        
        const paymentHistoryRows = (order.payment_history || []).map(p => `
            <tr>
                <td>${Utils.formatDate(p.date)}</td
                <td>${p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : (p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金'))}</td
                <td>${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td
                <td>${Utils.formatCurrency(p.amount)}</td
                <td>${Utils.escapeHtml(p.description || '-')}</td
            </tr>
        `).join('');
        
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
                <p><strong>${t('status_active')}:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                <p><strong>${lang === 'id' ? 'Petugas' : '经办人'}:</strong> ${Utils.escapeHtml(order.created_by)}</p>
                
                <h3>${t('customer_info')}</h3>
                <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer.name)}</p>
                <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(order.customer.ktp)}</p>
                <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(order.customer.phone)}</p>
                <p><strong>${t('address')}:</strong> ${Utils.escapeHtml(order.customer.address)}</p>
                
                <h3>${t('collateral_info')}</h3>
                <p><strong>${t('collateral_name')}:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                
                <h3>💰 ${lang === 'id' ? 'Rincian Biaya' : '费用明细'}</h3>
                <p><strong>${lang === 'id' ? 'Admin Fee' : '管理费'}:</strong> ${Utils.formatCurrency(order.admin_fee)} 
                    ${order.admin_fee_paid ? '✅ ' + (lang === 'id' ? 'Lunas' : '已付') : '❌ ' + (lang === 'id' ? 'Belum dibayar' : '未付')}
                </p>
                <p><strong>${lang === 'id' ? 'Bunga per Bulan' : '月利息'}:</strong> ${Utils.formatCurrency(order.monthly_interest)} (10%)</p>
                <p><strong>${lang === 'id' ? 'Bunga Telah Dibayar' : '已付利息'}:</strong> ${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(order.interest_paid_total)})</p>
                <p><strong>${lang === 'id' ? 'Jatuh Tempo Bunga Berikutnya' : '下次利息到期日'}:</strong> ${Utils.formatDate(order.next_interest_due_date)}</p>
                <p><strong>${lang === 'id' ? 'Pokok Dibayar' : '已还本金'}:</strong> ${Utils.formatCurrency(order.principal_paid)}</p>
                <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(order.loan_amount - order.principal_paid)}</p>
                <p><strong>${t('notes')}:</strong> ${Utils.escapeHtml(order.notes) || '-'}</p>
                
                <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '支付记录'}</h3>
                <div class="table-container">
                    <table>
                        <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead>
                        <tbody>${paymentHistoryRows || '<tr><td colspan="5">' + t('no_data') + '</td></tr>'}</tbody>
                    </table>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    ${order.status === 'active' ? '<button onclick="APP.navigateTo(\'payment\', {orderId: \'' + order.order_id + '\'})">💰 ' + t('save') + '</button>' : ''}
                    ${PERMISSION.can("order_edit") && order.status === 'active' ? '<button onclick="APP.navigateTo(\'editOrder\', {orderId: \'' + order.order_id + '\'})">✏️ ' + t('edit') + '</button>' : ''}
                </div>
            </div>
        `;
    },
    
    // ==================== 支付页面 ====================
    showPayment(orderId) {
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        const order = this.db.orders.find(o => o.order_id === orderId);
        if (!order) return;
        
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        
        let interestOptions = '';
        for (let i = 1; i <= 12; i++) {
            const amount = order.monthly_interest * i;
            interestOptions += `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(amount)})</option>`;
        }
        
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>
            
            <div class="card">
                <h3>📋 ${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer.name)}</p>
                <p><strong>ID Pesanan:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                <p><strong>${lang === 'id' ? 'Bunga per Bulan' : '月利息'}:</strong> ${Utils.formatCurrency(order.monthly_interest)} (10%)</p>
                <p><strong>${lang === 'id' ? 'Bunga Telah Dibayar' : '已付利息'}:</strong> ${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</p>
            </div>
            
            <div class="card">
                <h3>💰 ${lang === 'id' ? 'Pilih Jenis Pembayaran' : '选择支付类型'}</h3>
                
                ${!order.admin_fee_paid ? `
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'} - ${Utils.formatCurrency(order.admin_fee)}</h4>
                    <p style="color: #94a3b8; font-size: 12px;">${lang === 'id' ? 'Biaya administrasi dibayar saat kontrak ditandatangani' : '管理费在签合同时支付'}</p>
                    <button onclick="APP.payAdminFee('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Admin Fee' : '记录管理费支付'}</button>
                </div>
                ` : ''}
                
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '支付利息'}</h4>
                    <p style="color: #94a3b8; font-size: 12px;">${lang === 'id' ? 'Bunga 10% per bulan dari jumlah pinjaman' : '利息为贷款金额的10%/月'}</p>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Jumlah Bulan' : '月数'}:</label>
                        <select id="interestMonths" style="width: 200px;">
                            ${interestOptions}
                        </select>
                    </div>
                    <button onclick="APP.payInterest('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息支付'}</button>
                </div>
                
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>🏦 ${lang === 'id' ? 'Pelunasan Pokok' : '本金结清'}</h4>
                    <p style="color: #94a3b8; font-size: 12px;">${lang === 'id' ? 'Lunasi seluruh sisa pokok pinjaman' : '支付全部剩余本金，结清贷款'}</p>
                    <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    ${remainingPrincipal > 0 ? `
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Jumlah Pembayaran Pokok' : '本金支付金额'}:</label>
                        <input type="number" id="principalAmount" value="${remainingPrincipal}" style="width: 200px;">
                    </div>
                    <button onclick="APP.payPrincipalPartial('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                    <button onclick="APP.payPrincipalFull('${order.order_id}')" class="warning" style="margin-top: 10px;">🏦 ${lang === 'id' ? 'Lunasi Semua (Pokok + Bunga)' : '全额结清（本金+利息）'}</button>
                    ` : '<p>✅ ' + (lang === 'id' ? 'Pokok sudah lunas' : '本金已结清') + '</p>'}
                </div>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
            </div>
        `;
    },
    
    payAdminFee(orderId) {
        const lang = Utils.lang;
        if (confirm(lang === 'id' ? 'Konfirmasi penerimaan Admin Fee 30,000 IDR?' : '确认已收取管理费 30,000 IDR？')) {
            Order.recordAdminFee(this.db, orderId);
            alert(lang === 'id' ? 'Admin Fee dicatat!' : '管理费已记录！');
            this.viewOrder(orderId);
        }
    },
    
    payInterest(orderId) {
        const months = parseInt(document.getElementById("interestMonths").value);
        const order = this.db.orders.find(o => o.order_id === orderId);
        const amount = order.monthly_interest * months;
        const lang = Utils.lang;
        
        if (confirm((lang === 'id' ? 'Konfirmasi pembayaran bunga' : '确认支付利息') + ' ' + Utils.formatCurrency(amount) + ' (' + months + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')?')) {
            Order.recordInterestPayment(this.db, orderId, months);
            alert(lang === 'id' ? 'Pembayaran bunga dicatat!' : '利息支付已记录！');
            this.viewOrder(orderId);
        }
    },
    
    payPrincipalPartial(orderId) {
        const amountInput = document.getElementById("principalAmount");
        let amount = parseFloat(amountInput.value);
        const order = this.db.orders.find(o => o.order_id === orderId);
        const lang = Utils.lang;
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        
        if (isNaN(amount) || amount <= 0) {
            alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
            return;
        }
        if (amount > remainingPrincipal) {
            alert(lang === 'id' ? 'Jumlah melebihi sisa pokok' : '金额超过剩余本金');
            return;
        }
        
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
    
    payPrincipalFull(orderId) {
        const order = this.db.orders.find(o => o.order_id === orderId);
        const lang = Utils.lang;
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        
        const totalAmount = remainingPrincipal;
        
        if (confirm((lang === 'id' ? 'Lunasi semua hutang?' : '全额结清？') + '\n' +
            (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ': ' + Utils.formatCurrency(remainingPrincipal) + '\n' +
            (lang === 'id' ? 'Total' : '总计') + ': ' + Utils.formatCurrency(totalAmount))) {
            
            Order.recordPrincipalPayment(this.db, orderId, remainingPrincipal);
            alert(lang === 'id' ? 'Hutang lunas! Pesanan selesai.' : '贷款已结清！订单完成。');
            this.viewOrder(orderId);
        }
    },
    
    // ==================== 编辑订单 ====================
    editOrder(orderId) {
        this.currentPage = 'editOrder';
        this.currentOrderId = orderId;
        const order = this.db.orders.find(o => o.order_id === orderId);
        if (!order) return;
        
        const t = (key) => Utils.t(key);
        const lang = Utils.lang;
        
        document.getElementById("app").innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>✏️ ${t('edit')} ${t('order_list')}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>
            <div class="card">
                <div class="form-group"><label>${t('customer_name')}</label><input id="name" value="${Utils.escapeHtml(order.customer.name)}"></div>
                <div class="form-group"><label>${t('ktp_number')}</label><input id="ktp" value="${Utils.escapeHtml(order.customer.ktp)}"></div>
                <div class="form-group"><label>${t('phone')}</label><input id="phone" value="${Utils.escapeHtml(order.customer.phone)}"></div>
                <div class="form-group"><label>${t('address')}</label><textarea id="address">${Utils.escapeHtml(order.customer.address)}</textarea></div>
                <div class="form-group"><label>${t('collateral_name')}</label><input id="collateral" value="${Utils.escapeHtml(order.collateral_name)}"></div>
                <div class="form-group"><label>${t('notes')}</label><textarea id="notes">${Utils.escapeHtml(order.notes)}</textarea></div>
                
                <div class="toolbar">
                    <button onclick="APP.updateOrder('${order.order_id}')">💾 ${t('save')}</button>
                    <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                </div>
            </div>
        `;
    },
    
    updateOrder(orderId) {
        const updates = {
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
    
    // ==================== 删除订单 ====================
    deleteOrder(orderId) {
        if (confirm(Utils.t('confirm_delete'))) {
            Order.delete(this.db, orderId);
            alert(Utils.t('order_deleted'));
            this.showOrderTable();
        }
    },
    
    // ==================== 财务报表 ====================
    showReport() {
        this.currentPage = 'report';
        const report = Order.getReport(this.db);
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
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
                <button onclick="APP.exportToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
            </div>
        `;
    },
    
    exportToCSV() {
        Utils.exportToCSV(this.db.orders, 'jf_gadai_orders_' + new Date().toISOString().split('T')[0] + '.csv');
        alert(Utils.t('export_success'));
    },
    
    // ==================== 付款记录 ====================
    showPaymentHistory() {
        this.currentPage = 'paymentHistory';
        const lang = Utils.lang;
        
        let allPayments = [];
        this.db.orders.forEach(order => {
            if (order.payment_history && order.payment_history.length > 0) {
                order.payment_history.forEach(payment => {
                    allPayments.push({
                        order_id: order.order_id,
                        customer_name: order.customer.name,
                        ...payment
                    });
                });
            }
        });
        
        allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const totalAdminFee = allPayments.filter(p => p.type === 'admin_fee').reduce((sum, p) => sum + p.amount, 0);
        const totalInterest = allPayments.filter(p => p.type === 'interest').reduce((sum, p) => sum + p.amount, 0);
        const totalPrincipal = allPayments.filter(p => p.type === 'principal').reduce((sum, p) => sum + p.amount, 0);
        
        const typeMap = {
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金'
        };
        
        const rows = allPayments.map(p => `
            <tr>
                <td>${Utils.escapeHtml(p.order_id)}</td
                <td>${Utils.escapeHtml(p.customer_name)}</td
                <td>${Utils.formatDate(p.date)}</td
                <td>${typeMap[p.type] || p.type}</td
                <td>${p.months ? p.months + ' ' + (lang === 'id' ? 'bln' : '个月') : '-'}</td
                <td>${Utils.formatCurrency(p.amount)}</td
                <td>${Utils.escapeHtml(p.description || '-')}</td
                <td><button onclick="APP.navigateTo('viewOrder', {orderId: '${p.order_id}'})">${Utils.t('view')}</button></td
            </tr>
        `).join('');
        
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
                    <thead>
                        <tr>
                            <th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th>
                            <th>${Utils.t('customer_name')}</th>
                            <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                            <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                            <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                            <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                            <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            <th>${Utils.t('save')}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="8">' + Utils.t('no_data') + '</td></tr>'}</tbody>
                </table>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.exportPaymentHistoryToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
            </div>
        `;
    },
    
    exportPaymentHistoryToCSV() {
        const lang = Utils.lang;
        let allPayments = [];
        this.db.orders.forEach(order => {
            if (order.payment_history && order.payment_history.length > 0) {
                order.payment_history.forEach(payment => {
                    allPayments.push({
                        order_id: order.order_id,
                        customer_name: order.customer.name,
                        ...payment
                    });
                });
            }
        });
        
        allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const headers = lang === 'id' ? 
            ['ID Pesanan', 'Pelanggan', 'Tanggal', 'Jenis', 'Bulan', 'Jumlah', 'Keterangan'] :
            ['订单ID', '客户', '日期', '类型', '月数', '金额', '说明'];
        
        const typeMap = {
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金'
        };
        
        const rows = allPayments.map(p => [
            p.order_id,
            p.customer_name,
            p.date,
            typeMap[p.type] || p.type,
            p.months || '',
            p.amount,
            p.description || ''
        ]);
        
        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payment_history_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        
        alert(Utils.t('export_success'));
    },
    
    // ==================== 备份恢复 ====================
    showBackupRestore() {
        this.currentPage = 'backupRestore';
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
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
                <button onclick="APP.backupData()">📥 ${lang === 'id' ? 'Ekspor File Cadangan' : '导出备份文件'}</button>
                <h3 style="margin-top: 30px;">${lang === 'id' ? 'Pemulihan Data' : '恢复数据'}</h3>
                <input type="file" id="restoreFile" accept=".json">
                <button onclick="APP.restoreData()">📤 ${lang === 'id' ? 'Impor Pemulihan' : '导入恢复'}</button>
                <p style="margin-top: 10px; color: #f59e0b;">⚠️ ${lang === 'id' ? 'Perhatian: Memulihkan data akan menimpa semua data yang ada, harap berhati-hati!' : '注意：恢复数据将覆盖当前所有数据，请谨慎操作！'}</p>
            </div>
        `;
    },
    
    backupData() {
        Storage.backup();
        alert(Utils.t('backup_downloaded'));
    },
    
    async restoreData() {
        const fileInput = document.getElementById("restoreFile");
        const file = fileInput.files[0];
        const lang = Utils.lang;
        
        if (!file) {
            alert(lang === 'id' ? 'Pilih file cadangan' : '请选择备份文件');
            return;
        }
        if (confirm(lang === 'id' ? '⚠️ Memulihkan data akan menimpa semua data yang ada, lanjutkan?' : '⚠️ 恢复数据将覆盖所有现有数据，确定继续吗？')) {
            const success = await Storage.restore(file);
            if (success) {
                alert(lang === 'id' ? 'Pemulihan data berhasil! Sistem akan dimuat ulang.' : '数据恢复成功！系统将重新加载。');
                location.reload();
            } else {
                alert(lang === 'id' ? 'Pemulihan gagal: Format file salah' : '恢复失败：文件格式错误');
            }
        }
    },
    
    // ==================== 用户管理 ====================
    showUserManagement() {
        this.currentPage = 'userManagement';
        const users = this.db.users;
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
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
                <div class="form-group"><label>${t('username')}</label><input id="newUsername" placeholder="${t('username')}"></div>
                <div class="form-group"><label>${t('password')}</label><input id="newPassword" type="password" placeholder="${t('password')}"></div>
                <div class="form-group"><label>${lang === 'id' ? 'Nama Lengkap' : '姓名'}</label><input id="newName" placeholder="${lang === 'id' ? 'Nama Lengkap' : '姓名'}"></div>
                <div class="form-group"><label>${lang === 'id' ? 'Peran' : '角色'}</label><select id="newRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
                <button onclick="APP.addUser()">➕ ${lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button>
            </div>
            <div class="card">
                <h3>${lang === 'id' ? 'Pengguna yang Ada' : '现有用户'}</h3>
                <div class="table-container">
                    <table>
                        <thead><tr><th>${t('username')}</th><th>${lang === 'id' ? 'Nama' : '姓名'}</th><th>${lang === 'id' ? 'Peran' : '角色'}</th><th>${t('save')}</th></tr></thead>
                        <tbody>${users.map(u => `
                            <tr>
                                <td>${Utils.escapeHtml(u.username)}</td
                                <td>${Utils.escapeHtml(u.name)}</td
                                <td>${u.role}</td
                                <td>${u.username !== AUTH.user.username ? '<button class="danger" onclick="APP.deleteUser(\'' + u.username + '\')">' + t('delete') + '</button>' : '<span style="color: #94a3b8;">' + (lang === 'id' ? 'Pengguna Saat Ini' : '当前用户') + '</span>'}
                            </td
                        </tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
    },
    
    addUser() {
        const username = document.getElementById("newUsername").value.trim();
        const password = document.getElementById("newPassword").value;
        const name = document.getElementById("newName").value.trim();
        const role = document.getElementById("newRole").value;
        const lang = Utils.lang;
        
        if (!username || !password || !name) {
            alert(Utils.t('fill_all_fields'));
            return;
        }
        if (AUTH.addUser(username, password, role, name)) {
            alert(lang === 'id' ? 'Pengguna berhasil ditambahkan' : '用户添加成功');
            this.showUserManagement();
        } else {
            alert(lang === 'id' ? 'Nama pengguna sudah ada' : '用户名已存在');
        }
    },
    
    deleteUser(username) {
        const lang = Utils.lang;
        if (confirm((lang === 'id' ? 'Hapus pengguna' : '删除用户') + ' "' + username + '"?')) {
            this.db.users = this.db.users.filter(u => u.username !== username);
            Storage.save(this.db);
            alert(lang === 'id' ? 'Pengguna dihapus' : '用户已删除');
            this.showUserManagement();
        }
    },
    
    // ==================== 退出登录 ====================
    logout() {
        AUTH.logout();
        this.router();
    }
};

window.APP = APP;
