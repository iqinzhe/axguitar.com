// ==================== 创建订单 ====================
window.APP.showCreateOrder = function() {
    this.currentPage = 'createOrder';
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>📝 ${Utils.t('create_order')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="card">
            <h3>${Utils.t('customer_info')}</h3>
            <div class="form-group"><label>${Utils.t('customer_name')} *</label><input id="name" placeholder="${Utils.t('customer_name')}"></div>
            <div class="form-group"><label>${Utils.t('ktp_number')} *</label><input id="ktp" placeholder="${Utils.t('ktp_number')}"></div>
            <div class="form-group"><label>${Utils.t('phone')} *</label><input id="phone" placeholder="${Utils.t('phone')}"></div>
            <div class="form-group"><label>${Utils.t('address')}</label><textarea id="address" rows="2" placeholder="${Utils.t('address')}"></textarea></div>
            
            <h3>${Utils.t('collateral_info')}</h3>
            <div class="form-group"><label>${Utils.t('collateral_name')} *</label><input id="collateral" placeholder="${Utils.t('collateral_name')}"></div>
            <div class="form-group"><label>${Utils.t('loan_amount')} *</label><input id="amount" type="number" placeholder="${Utils.t('loan_amount')}"></div>
            <div class="form-group"><label>${Utils.t('notes')}</label><textarea id="notes" rows="2" placeholder="${Utils.t('notes')}"></textarea></div>
            
            <div class="form-group"><p style="background: #0f172a; padding: 10px; border-radius: 6px;">📌 ${Utils.t('monthly_fee_calc')}</p></div>
            
            <div class="toolbar">
                <button onclick="APP.saveOrder()">💾 ${Utils.t('save')}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('cancel')}</button>
            </div>
        </div>
    `;
};

window.APP.saveOrder = function() {
    const name = document.getElementById("name").value.trim();
    const ktp = document.getElementById("ktp").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const collateral = document.getElementById("collateral").value.trim();
    const amount = document.getElementById("amount").value;
    
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
    
    Order.create(this.db, orderData);
    alert(Utils.t('order_created'));
    this.goBack();
};

// ==================== 查看订单详情 ====================
window.APP.viewOrder = function(orderId) {
    this.currentPage = 'viewOrder';
    this.currentOrderId = orderId;
    const order = this.db.orders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const status = Utils.checkOrderStatus(order);
    const monthlyPayment = Utils.calculateMonthlyPayment(order.loan_amount);
    const statusMap = {
        active: Utils.t('status_active'),
        completed: Utils.t('status_completed'),
        liquidated: Utils.t('status_liquidated'),
        overdue: Utils.t('status_overdue')
    };
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>📄 ${Utils.t('view')} ${Utils.t('order_list')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="card">
            <h3>${Utils.lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
            <p><strong>ID:</strong> ${Utils.escapeHtml(order.order_id)}</p>
            <p><strong>${Utils.t('status_active')}:</strong> <span class="status-badge status-${status}">${statusMap[status] || status}</span></p>
            <p><strong>${Utils.lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
            <p><strong>${Utils.lang === 'id' ? 'Petugas' : '经办人'}:</strong> ${Utils.escapeHtml(order.created_by)}</p>
            
            <h3>${Utils.t('customer_info')}</h3>
            <p><strong>${Utils.t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer.name)}</p>
            <p><strong>${Utils.t('ktp_number')}:</strong> ${Utils.escapeHtml(order.customer.ktp)}</p>
            <p><strong>${Utils.t('phone')}:</strong> ${Utils.escapeHtml(order.customer.phone)}</p>
            <p><strong>${Utils.t('address')}:</strong> ${Utils.escapeHtml(order.customer.address)}</p>
            
            <h3>${Utils.t('collateral_info')}</h3>
            <p><strong>${Utils.t('collateral_name')}:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
            <p><strong>${Utils.t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
            <p><strong>${Utils.t('monthly_payment')}:</strong> ${Utils.formatCurrency(monthlyPayment)} (10% + 30,000)</p>
            <p><strong>${Utils.lang === 'id' ? 'Bulan Dibayar' : '已缴月数'}:</strong> ${order.paid_months} / 10 (${Utils.lang === 'id' ? 'Siklus' : '周期'} ${order.current_cycle})</p>
            <p><strong>${Utils.lang === 'id' ? 'Total Biaya Dibayar' : '累计缴费'}:</strong> ${Utils.formatCurrency(order.total_paid_fees)}</p>
            <p><strong>${Utils.lang === 'id' ? 'Jatuh Tempo Berikutnya' : '下次缴费日'}:</strong> ${Utils.formatDate(order.next_due_date)}</p>
            <p><strong>${Utils.lang === 'id' ? 'Pembayaran Terakhir' : '最后缴费'}:</strong> ${order.last_payment_date ? Utils.formatDate(order.last_payment_date) : '-'}</p>
            <p><strong>${Utils.t('notes')}:</strong> ${Utils.escapeHtml(order.notes) || '-'}</p>
            
            ${order.completed_at ? `<p><strong>${Utils.lang === 'id' ? 'Tanggal Lunas' : '结清日期'}:</strong> ${Utils.formatDate(order.completed_at)}</p>` : ''}
            ${order.liquidated_at ? `<p><strong>${Utils.lang === 'id' ? 'Tanggal Likuidasi' : '变卖日期'}:</strong> ${Utils.formatDate(order.liquidated_at)}</p>` : ''}
            
            <div class="toolbar">
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
                ${PERMISSION.can("order_payment") && order.status === 'active' ? 
                    `<button onclick="APP.navigateTo('payment', {orderId: '${order.order_id}'})">💰 ${Utils.t('save')}</button>` : ''}
                ${PERMISSION.can("order_edit") && order.status === 'active' ? 
                    `<button onclick="APP.navigateTo('editOrder', {orderId: '${order.order_id}'})">✏️ ${Utils.t('edit')}</button>` : ''}
            </div>
        </div>
    `;
};

// ==================== 缴费 ====================
window.APP.showPayment = function(orderId) {
    this.currentPage = 'payment';
    this.currentOrderId = orderId;
    const order = this.db.orders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const monthlyPayment = Utils.calculateMonthlyPayment(order.loan_amount);
    const remainingMonths = 10 - order.paid_months;
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>💰 ${Utils.t('save')} ${Utils.t('monthly_payment')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="card">
            <p><strong>${Utils.t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer.name)}</p>
            <p><strong>${Utils.t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
            <p><strong>${Utils.t('monthly_payment')}:</strong> ${Utils.formatCurrency(monthlyPayment)}</p>
            <p><strong>${Utils.lang === 'id' ? 'Bulan Dibayar' : '已缴月数'}:</strong> ${order.paid_months} / 10</p>
            <p><strong>${Utils.lang === 'id' ? 'Sisa Bulan Ini' : '本周期剩余'}:</strong> ${remainingMonths} ${Utils.lang === 'id' ? 'bulan' : '个月'}</p>
            
            <div class="form-group">
                <label>${Utils.lang === 'id' ? 'Jumlah Bulan Dibayar' : '缴费月数'} *</label>
                <select id="monthsToPay">
                    <option value="1">1 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment)})</option>
                    <option value="2">2 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 2)})</option>
                    <option value="3">3 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 3)})</option>
                    <option value="4">4 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 4)})</option>
                    <option value="5">5 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 5)})</option>
                    ${remainingMonths >= 6 ? `<option value="6">6 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 6)})</option>` : ''}
                    ${remainingMonths >= 7 ? `<option value="7">7 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 7)})</option>` : ''}
                    ${remainingMonths >= 8 ? `<option value="8">8 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 8)})</option>` : ''}
                    ${remainingMonths >= 9 ? `<option value="9">9 ${Utils.lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(monthlyPayment * 9)})</option>` : ''}
                    <option value="${remainingMonths}">${Utils.lang === 'id' ? 'Semua' : '全部'} ${remainingMonths} ${Utils.lang === 'id' ? 'bulan (Lunasi Siklus)' : '个月 (结清周期)'}</option>
                </select>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.recordPayment('${order.order_id}')">✅ ${Utils.t('confirm')}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('cancel')}</button>
            </div>
        </div>
    `;
};

window.APP.recordPayment = function(orderId) {
    const monthsToPay = parseInt(document.getElementById("monthsToPay").value);
    const order = this.db.orders.find(o => o.order_id === orderId);
    if (!order) return;
    
    const monthlyPayment = Utils.calculateMonthlyPayment(order.loan_amount);
    const totalAmount = monthlyPayment * monthsToPay;
    
    if (confirm(`${Utils.t('confirm')} ${Utils.formatCurrency(totalAmount)}?`)) {
        Order.recordPayment(this.db, orderId, monthsToPay);
        
        const updatedOrder = this.db.orders.find(o => o.order_id === orderId);
        if (updatedOrder.paid_months === 0 && updatedOrder.current_cycle > 1) {
            if (confirm(`${Utils.lang === 'id' ? 'Siklus selesai! Lunasi pokok?' : '周期完成！是否结清本金？'}\n${Utils.formatCurrency(updatedOrder.loan_amount)}`)) {
                Order.settleOrder(this.db, orderId);
                alert(Utils.t('completed'));
            } else {
                alert(`${Utils.lang === 'id' ? 'Memasuki siklus' : '进入第'} ${updatedOrder.current_cycle} ${Utils.lang === 'id' ? 'siklus' : '周期'}`);
            }
        }
        alert(Utils.t('payment_recorded'));
        this.goBack();
    }
};

// ==================== 编辑订单 ====================
window.APP.editOrder = function(orderId) {
    this.currentPage = 'editOrder';
    this.currentOrderId = orderId;
    const order = this.db.orders.find(o => o.order_id === orderId);
    if (!order) return;
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>✏️ ${Utils.t('edit')} ${Utils.t('order_list')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="card">
            <div class="form-group"><label>${Utils.t('customer_name')}</label><input id="name" value="${Utils.escapeHtml(order.customer.name)}"></div>
            <div class="form-group"><label>${Utils.t('ktp_number')}</label><input id="ktp" value="${Utils.escapeHtml(order.customer.ktp)}"></div>
            <div class="form-group"><label>${Utils.t('phone')}</label><input id="phone" value="${Utils.escapeHtml(order.customer.phone)}"></div>
            <div class="form-group"><label>${Utils.t('address')}</label><textarea id="address">${Utils.escapeHtml(order.customer.address)}</textarea></div>
            <div class="form-group"><label>${Utils.t('collateral_name')}</label><input id="collateral" value="${Utils.escapeHtml(order.collateral_name)}"></div>
            <div class="form-group"><label>${Utils.t('loan_amount')}</label><input id="amount" type="number" value="${order.loan_amount}"></div>
            <div class="form-group"><label>${Utils.t('notes')}</label><textarea id="notes">${Utils.escapeHtml(order.notes)}</textarea></div>
            
            <div class="toolbar">
                <button onclick="APP.updateOrder('${order.order_id}')">💾 ${Utils.t('save')}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('cancel')}</button>
            </div>
        </div>
    `;
};

window.APP.updateOrder = function(orderId) {
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
    alert(Utils.t('order_updated'));
    this.goBack();
};

// ==================== 删除订单 ====================
window.APP.deleteOrder = function(orderId) {
    if (confirm(Utils.t('confirm_delete'))) {
        Order.delete(this.db, orderId);
        alert(Utils.t('order_deleted'));
        this.showOrderTable();
    }
};

// ==================== 财务报表 ====================
window.APP.showReport = function() {
    this.currentPage = 'report';
    const report = Order.getReport(this.db);
    const activeOrders = this.db.orders.filter(o => o.status === 'active');
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>📊 ${Utils.t('financial_report')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-value">${report.total_orders}</div><div>${Utils.t('total_orders')}</div></div>
            <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div><div>${Utils.t('total_loan')}</div></div>
            <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_fees_collected)}</div><div>${Utils.t('total_fees')}</div></div>
        </div>
        <div class="card">
            <h3>📈 ${Utils.lang === 'id' ? 'Pendapatan Bulanan yang Diharapkan' : '预期月收入'}</h3>
            <div class="table-container">
                <table>
                    <thead><tr><th>${Utils.t('customer_name')}</th><th>${Utils.t('loan_amount')}</th><th>${Utils.t('monthly_payment')}</th><th>${Utils.lang === 'id' ? 'Jatuh Tempo' : '下次缴费日'}</th></tr></thead>
                    <tbody>${activeOrders.map(o => `<tr><td>${Utils.escapeHtml(o.customer.name)}</td><td>${Utils.formatCurrency(o.loan_amount)}</td><td>${Utils.formatCurrency(Utils.calculateMonthlyPayment(o.loan_amount))}</td><td>${Utils.formatDate(o.next_due_date)}</td></tr>`).join('') || `<tr><td colspan="4">${Utils.t('no_data')}</td></tr>`}</tbody>
                </table>
            </div>
        </div>
        <div class="toolbar"><button onclick="APP.exportToCSV()">📎 ${Utils.lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button></div>
    `;
};

window.APP.exportToCSV = function() {
    Utils.exportToCSV(this.db.orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
    alert(Utils.t('export_success'));
};

// ==================== 备份恢复 ====================
window.APP.showBackupRestore = function() {
    this.currentPage = 'backupRestore';
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>💾 ${Utils.t('backup_restore')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="card">
            <h3>${Utils.lang === 'id' ? 'Cadangan Data' : '备份数据'}</h3>
            <button onclick="APP.backupData()">📥 ${Utils.lang === 'id' ? 'Ekspor File Cadangan' : '导出备份文件'}</button>
            <h3 style="margin-top: 30px;">${Utils.lang === 'id' ? 'Pemulihan Data' : '恢复数据'}</h3>
            <input type="file" id="restoreFile" accept=".json">
            <button onclick="APP.restoreData()">📤 ${Utils.lang === 'id' ? 'Impor Pemulihan' : '导入恢复'}</button>
            <p style="margin-top: 10px; color: #f59e0b;">⚠️ ${Utils.lang === 'id' ? 'Perhatian: Memulihkan data akan menimpa semua data yang ada, harap berhati-hati!' : '注意：恢复数据将覆盖当前所有数据，请谨慎操作！'}</p>
        </div>
    `;
};

window.APP.backupData = function() {
    Storage.backup();
    alert(Utils.t('backup_downloaded'));
};

window.APP.restoreData = async function() {
    const fileInput = document.getElementById("restoreFile");
    const file = fileInput.files[0];
    if (!file) {
        alert(Utils.lang === 'id' ? 'Pilih file cadangan' : '请选择备份文件');
        return;
    }
    if (confirm(Utils.lang === 'id' ? '⚠️ Memulihkan data akan menimpa semua data yang ada, lanjutkan?' : '⚠️ 恢复数据将覆盖所有现有数据，确定继续吗？')) {
        const success = await Storage.restore(file);
        if (success) {
            alert(Utils.lang === 'id' ? 'Pemulihan data berhasil! Sistem akan dimuat ulang.' : '数据恢复成功！系统将重新加载。');
            location.reload();
        } else {
            alert(Utils.lang === 'id' ? 'Pemulihan gagal: Format file salah' : '恢复失败：文件格式错误');
        }
    }
};

// ==================== 用户管理 ====================
window.APP.showUserManagement = function() {
    this.currentPage = 'userManagement';
    const users = this.db.users;
    
    document.getElementById("app").innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2>👥 ${Utils.t('user_management')}</h2>
            <div>
                <button onclick="APP.toggleLanguage()">🌐 ${Utils.lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
            </div>
        </div>
        <div class="card">
            <h3>${Utils.lang === 'id' ? 'Tambah Pengguna Baru' : '添加新用户'}</h3>
            <div class="form-group"><label>${Utils.t('username')}</label><input id="newUsername" placeholder="${Utils.t('username')}"></div>
            <div class="form-group"><label>${Utils.t('password')}</label><input id="newPassword" type="password" placeholder="${Utils.t('password')}"></div>
            <div class="form-group"><label>${Utils.lang === 'id' ? 'Nama Lengkap' : '姓名'}</label><input id="newName" placeholder="${Utils.lang === 'id' ? 'Nama Lengkap' : '姓名'}"></div>
            <div class="form-group"><label>${Utils.lang === 'id' ? 'Peran' : '角色'}</label><select id="newRole"><option value="staff">Staff</option><option value="admin">Admin</option></select></div>
            <button onclick="APP.addUser()">➕ ${Utils.lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button>
        </div>
        <div class="card">
            <h3>${Utils.lang === 'id' ? 'Pengguna yang Ada' : '现有用户'}</h3>
            <div class="table-container">
                <table>
                    <thead><tr><th>${Utils.t('username')}</th><th>${Utils.lang === 'id' ? 'Nama' : '姓名'}</th><th>${Utils.lang === 'id' ? 'Peran' : '角色'}</th><th>${Utils.t('save')}</th></tr></thead>
                    <tbody>${users.map(u => `<tr><td>${Utils.escapeHtml(u.username)}</td><td>${Utils.escapeHtml(u.name)}</td><td>${u.role}</td><td>${u.username !== AUTH.user.username ? `<button class="danger" onclick="APP.deleteUser('${u.username}')">${Utils.t('delete')}</button>` : `<span style="color: #94a3b8;">${Utils.lang === 'id' ? 'Pengguna Saat Ini' : '当前用户'}</span>`}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
    `;
};

window.APP.addUser = function() {
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;
    const name = document.getElementById("newName").value.trim();
    const role = document.getElementById("newRole").value;
    
    if (!username || !password || !name) {
        alert(Utils.t('fill_all_fields'));
        return;
    }
    if (AUTH.addUser(username, password, role, name)) {
        alert(Utils.lang === 'id' ? 'Pengguna berhasil ditambahkan' : '用户添加成功');
        this.showUserManagement();
    } else {
        alert(Utils.lang === 'id' ? 'Nama pengguna sudah ada' : '用户名已存在');
    }
};

window.APP.deleteUser = function(username) {
    if (confirm(`${Utils.lang === 'id' ? 'Hapus pengguna' : '删除用户'} "${username}"?`)) {
        this.db.users = this.db.users.filter(u => u.username !== username);
        Storage.save(this.db);
        alert(Utils.lang === 'id' ? 'Pengguna dihapus' : '用户已删除');
        this.showUserManagement();
    }
};
