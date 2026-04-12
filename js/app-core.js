/**
 * ============================================
 * JF GADAI ENTERPRISE - 主应用文件
 * ============================================
 * 
 * 函数目录（使用 Ctrl+F 快速查找）：
 * 
 * 【1. 初始化与路由】
 *    init()                    - 初始化应用
 *    router()                  - 页面路由
 *    refreshCurrentPage()      - 刷新当前页面
 *    navigateTo()              - 页面导航
 *    goBack()                  - 返回上一页
 * 
 * 【2. 登录相关】
 *    renderLogin()             - 渲染登录页面
 *    login()                   - 处理登录
 *    logout()                  - 退出登录
 * 
 * 【3. 仪表板】
 *    renderDashboard()         - 渲染仪表板
 * 
 * 【4. 订单列表】
 *    showOrderTable()          - 显示订单列表
 *    searchOrders()            - 搜索订单
 *    resetSearch()             - 重置搜索
 *    filterOrders()            - 筛选订单状态
 * 
 * 【5. 创建订单】
 *    showCreateOrder()         - 显示创建订单表单
 *    saveOrder()               - 保存新订单
 * 
 * 【6. 订单详情】
 *    viewOrder()               - 查看订单详情
 * 
 * 【7. 支付功能】
 *    showPayment()             - 显示支付页面
 *    payAdminFee()             - 支付管理费
 *    payInterest()             - 支付利息
 *    payPrincipal()            - 支付本金
 * 
 * 【8. 编辑订单】
 *    editOrder()               - 编辑订单
 *    updateOrder()             - 更新订单
 * 
 * 【9. 删除订单】
 *    deleteOrder()             - 删除订单
 * 
 * 【10. 财务报表】
 *     showReport()             - 显示财务报表
 *     exportToCSV()            - 导出CSV
 * 
 * 【11. 付款记录】
 *     showPaymentHistory()     - 显示付款记录
 *     exportPaymentHistoryToCSV() - 导出付款记录CSV
 * 
 * 【12. 备份恢复】
 *     showBackupRestore()      - 显示备份恢复页面
 *     backupData()             - 备份数据
 *     restoreData()            - 恢复数据
 * 
 * 【13. 用户管理】
 *     showUserManagement()     - 显示用户管理
 *     addUser()                - 添加用户
 *     deleteUser()             - 删除用户
 * 
 * 【14. 其他】
 *     toggleLanguage()         - 切换语言
 * 
 * 最后更新: 2026-04-12
 * ============================================
 */

window.APP = {
    db: null,
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    
    // ==================== 1. 初始化与路由 ====================
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
    
    toggleLanguage() {
        const newLang = Utils.lang === 'id' ? 'zh' : 'id';
        Utils.setLanguage(newLang);
        if (this.currentPage === 'login' || !AUTH.user) {
            this.renderLogin();
        } else {
            this.refreshCurrentPage();
        }
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
    
    navigateTo(page, params) {
        params = params || {};
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
    
    // ==================== 2. 登录相关 ====================
    renderLogin() {
        this.currentPage = 'login';
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
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
    
    logout() {
        AUTH.logout();
        this.router();
    },
    
    // ==================== 3. 仪表板 ====================
    renderDashboard() {
        this.currentPage = 'dashboard';
        this.currentOrderId = null;
        const report = Order.getReport(this.db);
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
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
                <p>📌 ${lang === 'id' ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan (dibayar bulanan)' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
            </div>
        `;
    },
    
    // ==================== 4. 订单列表 ====================
    showOrderTable() {
        this.currentPage = 'orderTable';
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
        let filteredOrders = [];
        if (this.db.orders && this.db.orders.length > 0) {
            filteredOrders = [...this.db.orders];
        }
        
        if (this.currentFilter !== "all") {
            filteredOrders = filteredOrders.filter(function(o) { return o.status === this.currentFilter; }.bind(this));
        }
        
        if (this.searchKeyword) {
            const keyword = this.searchKeyword.toLowerCase();
            filteredOrders = filteredOrders.filter(function(o) {
                return (o.customer && o.customer.name && o.customer.name.toLowerCase().includes(keyword)) ||
                       (o.customer && o.customer.phone && o.customer.phone.includes(keyword)) ||
                       (o.order_id && o.order_id.toLowerCase().includes(keyword));
            }.bind(this));
        }
        
        filteredOrders.sort(function(a, b) {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        
        const statusMap = {
            active: t('status_active'),
            completed: t('status_completed'),
            liquidated: t('status_liquidated')
        };
        
        let rows = '';
        if (filteredOrders.length === 0) {
            rows = '<tr><td colspan="9" style="text-align: center;">' + t('no_data') + '</td></tr>';
        } else {
            rows = filteredOrders.map(function(o) {
                const statusClass = o.status === 'active' ? 'status-active' : 
                                   (o.status === 'completed' ? 'status-completed' : 'status-danger');
                const customerName = o.customer ? Utils.escapeHtml(o.customer.name) : '-';
                const collateralName = Utils.escapeHtml(o.collateral_name || '-');
                const loanAmount = Utils.formatCurrency(o.loan_amount || 0);
                const adminFee = Utils.formatCurrency(o.admin_fee || 30000);
                const monthlyInterest = Utils.formatCurrency(o.monthly_interest || 0);
                const paidMonths = o.interest_paid_months || 0;
                const statusText = statusMap[o.status] || o.status;
                const orderId = Utils.escapeHtml(o.order_id);
                
                return `
                    <tr>
                        <td>${orderId}</td>
                        <td>${customerName}</td>
                        <td>${collateralName}</td>
                        <td>${loanAmount}</td>
                        <td>${adminFee}</td>
                        <td>${monthlyInterest}</td>
                        <td>${paidMonths} ${lang === 'id' ? 'bulan' : '个月'}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>
                            <button onclick="APP.navigateTo('viewOrder', {orderId: '${o.order_id}'})">${t('view')}</button>
                            ${o.status === 'active' ? '<button onclick="APP.navigateTo(\'payment\', {orderId: \'' + o.order_id + '\'})">💰 ' + t('save') + '</button>' : ''}
                            ${PERMISSION.can("order_delete") ? '<button class="danger" onclick="APP.deleteOrder(\'' + o.order_id + '\')">' + t('delete') + '</button>' : ''}
                        </td>
                    </tr>
                `;
            }.bind(this)).join('');
        }
        
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
                            <th>ID</th>
                            <th>${t('customer_name')}</th>
                            <th>${t('collateral_name')}</th>
                            <th>${t('loan_amount')}</th>
                            <th>${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                            <th>${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</th>
                            <th>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                            <th>${t('status_active')}</th>
                            <th>${t('save')}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
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
    
    // ==================== 5. 创建订单 ====================
    showCreateOrder() {
        this.currentPage = 'createOrder';
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
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
            customer: { name: name, ktp: ktp, phone: phone, address: document.getElementById("address").value },
            collateral_name: collateral,
            loan_amount: Number(amount),
            notes: document.getElementById("notes").value
        };
        
        const newOrder = Order.create(this.db, orderData);
        alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
        
        this.goBack();
    },
    
    // ==================== 6. 订单详情 ====================
    viewOrder(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        const order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        if (!order) {
            alert('Order not found');
            this.goBack();
            return;
        }
        
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
        const statusMap = {
            active: t('status_active'),
            completed: t('status_completed'),
            liquidated: t('status_liquidated')
        };
        
        let paymentHistoryRows = '';
        if (order.payment_history && order.payment_history.length > 0) {
            paymentHistoryRows = order.payment_history.map(function(p) {
                let typeText = '';
                if (p.type === 'admin_fee') typeText = lang === 'id' ? 'Admin Fee' : '管理费';
                else if (p.type === 'interest') typeText = lang === 'id' ? 'Bunga' : '利息';
                else typeText = lang === 'id' ? 'Pokok' : '本金';
                
                return `
                    <tr>
                        <td>${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td>${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td>${Utils.formatCurrency(p.amount)}</td>
                        <td>${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>
                `;
            }).join('');
        } else {
            paymentHistoryRows = '<tr><td colspan="5" style="text-align: center;">' + t('no_data') + '</td></tr>';
        }
        
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
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                                <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr>
                        </thead>
                        <tbody>${paymentHistoryRows}</tbody>
                    </table>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                    ${order.status === 'active' ? '<button onclick="APP.navigateTo(\'payment\', {orderId: \'' + order.order_id + '\'})">💰 ' + t('save') + '</button>' : ''}
                </div>
            </div>
        `;
    },
    
    // ==================== 7. 支付功能 ====================
    showPayment(orderId) {
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        const order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        if (!order) return;
        
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        const currentMonthlyInterest = remainingPrincipal * 0.10;
        
        let interestOptions = '';
        for (var i = 1; i <= 12; i++) {
            const amount = currentMonthlyInterest * i;
            interestOptions += '<option value="' + i + '">' + i + ' ' + (lang === 'id' ? 'bulan' : '个月') + ' (' + Utils.formatCurrency(amount) + ')</option>';
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
                <p><strong>${lang === 'id' ? 'Bunga Bulanan Saat Ini' : '当前月利息'}:</strong> ${Utils.formatCurrency(currentMonthlyInterest)}</p>
            </div>
            
            <div class="card">
                <h3>💰 ${lang === 'id' ? 'Pilih Jenis Pembayaran' : '选择支付类型'}</h3>
                
                ${!order.admin_fee_paid ? `
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'} - ${Utils.formatCurrency(order.admin_fee)}</h4>
                    <button onclick="APP.payAdminFee('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Admin Fee' : '记录管理费支付'}</button>
                </div>
                ` : '<div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;"><h4>📋 ' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</h4><p>✅ ' + (lang === 'id' ? 'Sudah dibayar' : '已支付') + '</p></div>'}
                
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '支付利息'}</h4>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Jumlah Bulan' : '月数'}:</label>
                        <select id="interestMonths" style="width: 200px;">
                            ${interestOptions}
                        </select>
                    </div>
                    <button onclick="APP.payInterest('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息支付'}</button>
                </div>
                
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金支付'}</h4>
                    <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    ${remainingPrincipal > 0 ? `
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Jumlah Pembayaran Pokok' : '本金支付金额'}:</label>
                        <input type="number" id="principalAmount" value="${remainingPrincipal}" style="width: 200px;">
                    </div>
                    <button onclick="APP.payPrincipal('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
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
        const order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        const lang = Utils.lang;
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        const monthlyInterest = remainingPrincipal * 0.10;
        const amount = monthlyInterest * months;
        
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
    
    payPrincipal(orderId) {
        const amountInput = document.getElementById("principalAmount");
        let amount = parseFloat(amountInput.value);
        const order = this.db.orders.find(function(o) { return o.order_id === orderId; });
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
    
    // ==================== 8. 编辑订单 ====================
    editOrder(orderId) {
        this.currentPage = 'editOrder';
        this.currentOrderId = orderId;
        const order = this.db.orders.find(function(o) { return o.order_id === orderId; });
        if (!order) return;
        
        const t = function(key) { return Utils.t(key); };
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
    
    // ==================== 9. 删除订单 ====================
    deleteOrder(orderId) {
        if (confirm(Utils.t('confirm_delete'))) {
            Order.delete(this.db, orderId);
            alert(Utils.t('order_deleted'));
            this.showOrderTable();
        }
    },
    
    // ==================== 10. 财务报表 ====================
    showReport() {
        this.currentPage = 'report';
        const report = Order.getReport(this.db);
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
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
    
    // ==================== 11. 付款记录 ====================
    showPaymentHistory() {
        this.currentPage = 'paymentHistory';
        const lang = Utils.lang;
        
        let allPayments = [];
        if (this.db.orders) {
            for (var i = 0; i < this.db.orders.length; i++) {
                var order = this.db.orders[i];
                if (order.payment_history && order.payment_history.length > 0) {
                    for (var j = 0; j < order.payment_history.length; j++) {
                        var payment = order.payment_history[j];
                        allPayments.push({
                            order_id: order.order_id,
                            customer_name: order.customer ? order.customer.name : '-',
                            date: payment.date,
                            type: payment.type,
                            months: payment.months,
                            amount: payment.amount,
                            description: payment.description
                        });
                    }
                }
            }
        }
        
        allPayments.sort(function(a, b) {
            return new Date(b.date) - new Date(a.date);
        });
        
        var totalAdminFee = 0;
        var totalInterest = 0;
        var totalPrincipal = 0;
        for (var i = 0; i < allPayments.length; i++) {
            var p = allPayments[i];
            if (p.type === 'admin_fee') totalAdminFee += p.amount;
            else if (p.type === 'interest') totalInterest += p.amount;
            else if (p.type === 'principal') totalPrincipal += p.amount;
        }
        
        var typeMap = {
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金'
        };
        
        var rows = '';
        if (allPayments.length === 0) {
            rows = '<tr><td colspan="8" style="text-align: center;">' + Utils.t('no_data') + '</td></tr>';
        } else {
            for (var i = 0; i < allPayments.length; i++) {
                var p = allPayments[i];
                rows += `
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
                `;
            }
        }
        
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
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },
    
    exportPaymentHistoryToCSV: function() {
        // 简化版本，如需完整功能请告知
        alert('导出功能开发中');
    },
    
    // ==================== 12. 备份恢复 ====================
    showBackupRestore: function() {
        this.currentPage = 'backupRestore';
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        
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
    
    backupData: function() {
        Storage.backup();
        alert(Utils.t('backup_downloaded'));
    },
    
    restoreData: async function() {
        var fileInput = document.getElementById("restoreFile");
        var file = fileInput.files[0];
        var lang = Utils.lang;
        
        if (!file) {
            alert(lang === 'id' ? 'Pilih file cadangan' : '请选择备份文件');
            return;
        }
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
    
    // ==================== 13. 用户管理 ====================
    showUserManagement: function() {
        this.currentPage = 'userManagement';
        var users = this.db.users ? [...this.db.users] : [];
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        
        users.sort(function(a, b) {
            return a.username.localeCompare(b.username);
        });
        
        var userRows = '';
        if (users.length === 0) {
            userRows = '<tr><td colspan="4" style="text-align: center;">' + t('no_data') + '
