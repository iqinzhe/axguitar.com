window.APP = {
    db: null,
    currentFilter: "all",
    searchKeyword: "",
    
    init() {
        this.db = Storage.load();
        AUTH.init(this.db);
        this.router();
    },
    
    router() {
        if (!AUTH.user) this.renderLogin();
        else this.renderDashboard();
    },
    
    renderLogin() {
        document.getElementById("app").innerHTML = `
            <div class="card" style="max-width: 400px; margin: 50px auto;">
                <h2>JF GADAI ENTERPRISE</h2>
                <h3>Login / 登录</h3>
                <div class="form-group">
                    <label>Username</label>
                    <input id="username" placeholder="username">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input id="password" type="password" placeholder="password">
                </div>
                <button onclick="APP.login()">Login</button>
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
            alert("请输入用户名和密码");
            return;
        }
        
        const user = AUTH.login(username, password);
        if (!user) {
            alert("Login failed - 用户名或密码错误");
            return;
        }
        
        this.router();
    },
    
    renderDashboard() {
        const report = Order.getReport(this.db);
        
        document.getElementById("app").innerHTML = `
            <h1>🏦 JF GADAI ENTERPRISE</h1>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${report.total_orders}</div>
                    <div>总订单数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.active_orders}</div>
                    <div>进行中</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${report.completed_orders}</div>
                    <div>已结清</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div>
                    <div>贷款总额</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.formatCurrency(report.total_fees_collected)}</div>
                    <div>已收租赁费</div>
                </div>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.showCreateOrder()">➕ 新建订单</button>
                <button onclick="APP.showOrderTable()">📋 订单列表</button>
                ${PERMISSION.can("report_view") ? '<button onclick="APP.showReport()">📊 财务报表</button>' : ''}
                ${PERMISSION.can("user_manage") ? '<button onclick="APP.showUserManagement()">👥 用户管理</button>' : ''}
                ${PERMISSION.can("backup_restore") ? '<button onclick="APP.showBackupRestore()">💾 备份/恢复</button>' : ''}
                <button onclick="APP.logout()">🚪 退出登录</button>
            </div>
            
            <div class="card">
                <h3>当前用户: ${AUTH.user.name} (${AUTH.user.role})</h3>
                <p>📌 业务规则：每月支付资金租赁费(10%) + 管理费(30,000 IDR)，每10个月为一个周期</p>
            </div>
        `;
    },
    
    showOrderTable() {
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
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td>${Utils.formatDate(o.next_due_date)}</td>
                    <td>
                        <button onclick="APP.viewOrder('${o.order_id}')">查看</button>
                        ${PERMISSION.can("order_payment") && o.status === 'active' ? 
                            `<button onclick="APP.showPayment('${o.order_id}')">缴费</button>` : ''}
                        ${PERMISSION.can("order_edit") && o.status === 'active' ? 
                            `<button onclick="APP.editOrder('${o.order_id}')">编辑</button>` : ''}
                        ${PERMISSION.can("order_delete") ? 
                            `<button class="danger" onclick="APP.deleteOrder('${o.order_id}')">删除</button>` : ''}
                    </td>
                </table>
            `;
        }).join("");
        
        document.getElementById("app").innerHTML = `
            <h2>📋 订单列表</h2>
            
            <div class="toolbar">
                <input type="text" id="searchInput" placeholder="🔍 搜索客户名/手机号/订单ID" 
                       style="max-width: 300px;" value="${Utils.escapeHtml(this.searchKeyword)}">
                <button onclick="APP.searchOrders()">搜索</button>
                <button onclick="APP.resetSearch()">重置</button>
                <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                    <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>全部</option>
                    <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>进行中</option>
                    <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>已结清</option>
                    <option value="liquidated" ${this.currentFilter === 'liquidated' ? 'selected' : ''}>已变卖</option>
                </select>
                <button onclick="APP.showCreateOrder()">➕ 新建订单</button>
                <button onclick="APP.renderDashboard()">🏠 返回首页</button>
            </div>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>订单ID</th><th>客户</th><th>质押物</th><th>贷款金额</th>
                            <th>月应缴</th><th>进度</th><th>状态</th><th>下次缴费</th><th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="9">暂无数据</td></tr>'}
                    </tbody>
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
    
    showCreateOrder() {
        document.getElementById("app").innerHTML = `
            <h2>📝 新建典当订单</h2>
            <div class="card">
                <h3>客户信息</h3>
                <div class="form-group">
                    <label>客户姓名 *</label>
                    <input id="name" placeholder="Nama Lengkap">
                </div>
                <div class="form-group">
                    <label>KTP号码 *</label>
                    <input id="ktp" placeholder="Nomor KTP">
                </div>
                <div class="form-group">
                    <label>手机号 *</label>
                    <input id="phone" placeholder="Nomor Telepon">
                </div>
                <div class="form-group">
                    <label>地址</label>
                    <textarea id="address" rows="2" placeholder="Alamat"></textarea>
                </div>
                
                <h3>典当信息</h3>
                <div class="form-group">
                    <label>质押物名称 *</label>
                    <input id="collateral" placeholder="Nama Barang Jaminan">
                </div>
                <div class="form-group">
                    <label>贷款金额 (IDR) *</label>
                    <input id="amount" type="number" placeholder="Jumlah Pinjaman">
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="notes" rows="2" placeholder="Catatan"></textarea>
                </div>
                
                <div class="form-group">
                    <p style="background: #0f172a; padding: 10px; border-radius: 6px;">
                        📌 每月应缴: 贷款金额 × 10% + 30,000 IDR
                    </p>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.saveOrder()">💾 保存订单</button>
                    <button onclick="APP.showOrderTable()">↩️ 取消</button>
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
        
        if (!name || !ktp || !phone || !collateral || !amount) {
            alert("请填写所有必填字段！");
            return;
        }
        
        if (amount <= 0) {
            alert("贷款金额必须大于0");
            return;
        }
        
        const orderData = {
            customer: { name, ktp, phone, address: document.getElementById("address").value },
            collateral_name: collateral,
            loan_amount: Number(amount),
            notes: document.getElementById("notes").value
        };
        
        Order.create(this.db, orderData);
        alert("订单创建成功！");
        this.showOrderTable();
    },
    
    viewOrder(orderId) {
        const order = this.db.orders.find(o => o.order_id === orderId);
        if (!order) return;
        
        const status = Utils.checkOrderStatus(order);
        const monthlyPayment = Utils.calculateMonthlyPayment(order.loan_amount);
        
        document.getElementById("app").innerHTML = `
            <h2>📄 订单详情</h2>
            <div class="card">
                <h3>订单信息</h3>
                <p><strong>订单ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                <p><strong>状态:</strong> <span class="status-badge status-${status}">${status}</span></p>
                <p><strong>创建日期:</strong> ${Utils.formatDate(order.created_at)}</p>
                <p><strong>经办人:</strong> ${Utils.escapeHtml(order.created_by)}</p>
                
                <h3>客户信息</h3>
                <p><strong>姓名:</strong> ${Utils.escapeHtml(order.customer.name)}</p>
                <p><strong>KTP:</strong> ${Utils.escapeHtml(order.customer.ktp)}</p>
                <p><strong>手机:</strong> ${Utils.escapeHtml(order.customer.phone)}</p>
                <p><strong>地址:</strong> ${Utils.escapeHtml(order.customer.address)}</p>
                
                <h3>典当信息</h3>
                <p><strong>质押物:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                <p><strong>贷款金额:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                <p><strong>月应缴:</strong> ${Utils.formatCurrency(monthlyPayment)} (10% + 30,000)</p>
                <p><strong>已缴月数:</strong> ${order.paid_months} / 10 (当前第${order.current_cycle}周期)</p>
                <p><strong>累计缴费:</strong> ${Utils.formatCurrency(order.total_paid_fees)}</p>
                <p><strong>下次缴费日:</strong> ${Utils.formatDate(order.next_due_date)}</p>
                <p><strong>最后缴费:</strong> ${order.last_payment_date ? Utils.formatDate(order.last_payment_date) : '-'}</p>
                <p><strong>备注:</strong> ${Utils.escapeHtml(order.notes) || '-'}</p>
                
                ${order.completed_at ? `<p><strong>结清日期:</strong> ${Utils.formatDate(order.completed_at)}</p>` : ''}
                ${order.liquidated_at ? `<p><strong>变卖日期:</strong> ${Utils.formatDate(order.liquidated_at)}</p>` : ''}
                
                <div class="toolbar">
                    <button onclick="APP.showOrderTable()">↩️ 返回列表</button>
                    ${PERMISSION.can("order_payment") && order.status === 'active' ? 
                        `<button onclick="APP.showPayment('${order.order_id}')">💰 记录缴费</button>` : ''}
                    ${PERMISSION.can("order_edit") && order.status === 'active' ? 
                        `<button onclick="APP.editOrder('${order.order_id}')">✏️ 编辑</button>` : ''}
                </div>
            </div>
        `;
    },
    
    showPayment(orderId) {
        const order = this.db.orders.find(o => o.order_id === orderId);
        if (!order) return;
        
        const monthlyPayment = Utils.calculateMonthlyPayment(order.loan_amount);
        const remainingMonths = 10 - order.paid_months;
        
        document.getElementById("app").innerHTML = `
            <h2>💰 记录缴费</h2>
            <div class="card">
                <p><strong>客户:</strong> ${Utils.escapeHtml(order.customer.name)}</p>
                <p><strong>贷款金额:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                <p><strong>月应缴:</strong> ${Utils.formatCurrency(monthlyPayment)}</p>
                <p><strong>已缴月数:</strong> ${order.paid_months} / 10</p>
                <p><strong>本周期剩余:</strong> ${remainingMonths} 个月</p>
                
                <div class="form-group">
                    <label>缴费月数 *</label>
                    <select id="monthsToPay">
                        <option value="1">1 个月 (${Utils.formatCurrency(monthlyPayment)})</option>
                        <option value="2">2 个月 (${Utils.formatCurrency(monthlyPayment * 2)})</option>
                        <option value="3">3 个月 (${Utils.formatCurrency(monthlyPayment * 3)})</option>
                        <option value="4">4 个月 (${Utils.formatCurrency(monthlyPayment * 4)})</option>
                        <option value="5">5 个月 (${Utils.formatCurrency(monthlyPayment * 5)})</option>
                        ${remainingMonths >= 6 ? `<option value="6">6 个月 (${Utils.formatCurrency(monthlyPayment * 6)})</option>` : ''}
                        ${remainingMonths >= 7 ? `<option value="7">7 个月 (${Utils.formatCurrency(monthlyPayment * 7)})</option>` : ''}
                        ${remainingMonths >= 8 ? `<option value="8">8 个月 (${Utils.formatCurrency(monthlyPayment * 8)})</option>` : ''}
                        ${remainingMonths >= 9 ? `<option value="9">9 个月 (${Utils.formatCurrency(monthlyPayment * 9)})</option>` : ''}
                        <option value="${remainingMonths}">全部 ${remainingMonths} 个月 (结清周期)</option>
                    </select>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.recordPayment('${order.order_id}')">✅ 确认缴费</button>
                    <button onclick="APP.viewOrder('${order.order_id}')">↩️ 取消</button>
                </div>
            </div>
        `;
    },
    
    recordPayment(orderId) {
        const monthsToPay = parseInt(document.getElementById("monthsToPay").value);
        const order = this.db.orders.find(o => o.order_id === orderId);
        
        if (!order) return;
        
        const monthlyPayment = Utils.calculateMonthlyPayment(order.loan_amount);
        const totalAmount = monthlyPayment * monthsToPay;
        
        if (confirm(`确认收到 ${Utils.formatCurrency(totalAmount)} 的缴费吗？\n缴费月数: ${monthsToPay} 个月`)) {
            Order.recordPayment(this.db, orderId, monthsToPay);
            
            const updatedOrder = this.db.orders.find(o => o.order_id === orderId);
            if (updatedOrder.paid_months === 0 && updatedOrder.current_cycle > 1) {
                if (confirm(`已完成第${updatedOrder.current_cycle - 1}周期！是否结清本金？\n本金金额: ${Utils.formatCurrency(updatedOrder.loan_amount)}`)) {
                    Order.settleOrder(this.db, orderId);
                    alert("订单已结清！");
                } else {
                    alert(`已进入第${updatedOrder.current_cycle}周期`);
                }
            }
            
            alert("缴费记录成功！");
            this.viewOrder(orderId);
        }
    },
    
    editOrder(orderId) {
        const order = this.db.orders.find(o => o.order_id === orderId);
        if (!order) return;
        
        document.getElementById("app").innerHTML = `
            <h2>✏️ 编辑订单</h2>
            <div class="card">
                <div class="form-group">
                    <label>客户姓名</label>
                    <input id="name" value="${Utils.escapeHtml(order.customer.name)}">
                </div>
                <div class="form-group">
                    <label>KTP</label>
                    <input id="ktp" value="${Utils.escapeHtml(order.customer.ktp)}">
                </div>
                <div class="form-group">
                    <label>手机号</label>
                    <input id="phone" value="${Utils.escapeHtml(order.customer.phone)}">
                </div>
                <div class="form-group">
                    <label>地址</label>
                    <textarea id="address">${Utils.escapeHtml(order.customer.address)}</textarea>
                </div>
                <div class="form-group">
                    <label>质押物</label>
                    <input id="collateral" value="${Utils.escapeHtml(order.collateral_name)}">
                </div>
                <div class="form-group">
                    <label>贷款金额</label>
                    <input id="amount" type="number" value="${order.loan_amount}">
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="notes">${Utils.escapeHtml(order.notes)}</textarea>
                </div>
                
                <div class="toolbar">
                    <button onclick="APP.updateOrder('${order.order_id}')">💾 保存修改</button>
                    <button onclick="APP.viewOrder('${order.order_id}')">↩️ 取消</button>
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
            loan_amount: document.getElementById("amount").value,
            notes: document.getElementById("notes").value
        };
        
        Order.update(this.db, orderId, updates);
        alert("订单已更新");
        this.viewOrder(orderId);
    },
    
    deleteOrder(orderId) {
        if (confirm("⚠️ 确定要删除这个订单吗？此操作不可恢复！")) {
            Order.delete(this.db, orderId);
            alert("订单已删除");
            this.showOrderTable();
        }
    },
    
    showReport() {
        const report = Order.getReport(this.db);
        const activeOrders = this.db.orders.filter(o => o.status === 'active');
        
        document.getElementById("app").innerHTML = `
            <h2>📊 财务报表</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${report.total_orders}</div>
                    <div>总订单数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div>
                    <div>总贷款金额</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.formatCurrency(report.total_fees_collected)}</div>
                    <div>已收租赁费总额</div>
                </div>
            </div>
            
            <div class="card">
                <h3>📈 预期月收入</h3>
                <table>
                    <thead><tr><th>客户</th><th>贷款金额</th><th>月应缴</th><th>下次缴费日</th></tr></thead>
                    <tbody>
                        ${activeOrders.map(o => `
                            <tr>
                                <td>${Utils.escapeHtml(o.customer.name)}</td>
                                <td>${Utils.formatCurrency(o.loan_amount)}</td>
                                <td>${Utils.formatCurrency(Utils.calculateMonthlyPayment(o.loan_amount))}</td>
                                <td>${Utils.formatDate(o.next_due_date)}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">暂无进行中的订单</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.exportToCSV()">📎 导出CSV</button>
                <button onclick="APP.renderDashboard()">🏠 返回首页</button>
            </div>
        `;
    },
    
    exportToCSV() {
        Utils.exportToCSV(this.db.orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
        alert("导出成功！");
    },
    
    showBackupRestore() {
        document.getElementById("app").innerHTML = `
            <h2>💾 备份与恢复</h2>
            <div class="card">
                <h3>备份数据</h3>
                <button onclick="APP.backupData()">📥 导出备份文件</button>
                
                <h3 style="margin-top: 30px;">恢复数据</h3>
                <input type="file" id="restoreFile" accept=".json">
                <button onclick="APP.restoreData()">📤 导入恢复</button>
                <p style="margin-top: 10px; color: #f59e0b;">⚠️ 注意：恢复数据将覆盖当前所有数据，请谨慎操作！</p>
                
                <div class="toolbar" style="margin-top: 30px;">
                    <button onclick="APP.renderDashboard()">🏠 返回首页</button>
                </div>
            </div>
        `;
    },
    
    backupData() {
        Storage.backup();
        alert("备份文件已下载！");
    },
    
    async restoreData() {
        const fileInput = document.getElementById("restoreFile");
        const file = fileInput.files[0];
        
        if (!file) {
            alert("请选择备份文件");
            return;
        }
        
        if (confirm("⚠️ 恢复数据将覆盖所有现有数据，确定继续吗？")) {
            const success = await Storage.restore(file);
            if (success) {
                alert("数据恢复成功！系统将重新加载。");
                location.reload();
            } else {
                alert("恢复失败：文件格式错误");
            }
        }
    },
    
    showUserManagement() {
        const users = this.db.users;
        
        document.getElementById("app").innerHTML = `
            <h2>👥 用户管理</h2>
            <div class="card">
                <h3>添加新用户</h3>
                <div class="form-group">
                    <label>用户名</label>
                    <input id="newUsername" placeholder="username">
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input id="newPassword" type="password" placeholder="password">
                </div>
                <div class="form-group">
                    <label>姓名</label>
                    <input id="newName" placeholder="Full Name">
                </div>
                <div class="form-group">
                    <label>角色</label>
                    <select id="newRole">
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button onclick="APP.addUser()">➕ 添加用户</button>
            </div>
            
            <div class="card">
                <h3>现有用户</h3>
                <table>
                    <thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>操作</th></tr></thead>
                    <tbody>
                        ${users.map(u => `
                            <tr>
                                <td>${Utils.escapeHtml(u.username)}</td>
                                <td>${Utils.escapeHtml(u.name)}</td>
                                <td>${u.role}</td>
                                <td>
                                    ${u.username !== AUTH.user.username ? 
                                        `<button class="danger" onclick="APP.deleteUser('${u.username}')">删除</button>` : 
                                        '<span style="color: #94a3b8;">当前用户</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.renderDashboard()">🏠 返回首页</button>
            </div>
        `;
    },
    
    addUser() {
        const username = document.getElementById("newUsername").value.trim();
        const password = document.getElementById("newPassword").value;
        const name = document.getElementById("newName").value.trim();
        const role = document.getElementById("newRole").value;
        
        if (!username || !password || !name) {
            alert("请填写所有字段");
            return;
        }
        
        if (AUTH.addUser(username, password, role, name)) {
            alert("用户添加成功");
            this.showUserManagement();
        } else {
            alert("用户名已存在");
        }
    },
    
    deleteUser(username) {
        if (confirm(`确定要删除用户 "${username}" 吗？`)) {
            this.db.users = this.db.users.filter(u => u.username !== username);
            Storage.save(this.db);
            alert("用户已删除");
            this.showUserManagement();
        }
    },
    
    logout() {
        AUTH.logout();
        this.router();
    }
};

window.APP = APP;
