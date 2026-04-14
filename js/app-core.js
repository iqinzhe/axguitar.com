window.APP = {
    currentFilter: "all",
    searchKeyword: "",
    historyStack: [],
    currentPage: "dashboard",
    currentOrderId: null,
    currentCustomerId: null,

    init: async function() {
        document.getElementById("app").innerHTML = '<div style="text-align: center; padding: 50px;">🔄 Loading system...</div>';
        await AUTH.init();
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

    renderLogin: async function() {
        this.currentPage = 'login';
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        document.getElementById("app").innerHTML = `
            <div class="card" style="max-width: 400px; margin: 50px auto;">
                <div style="text-align: right; margin-bottom: 10px;">
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa'}</button>
                </div>
                <h2>🏦 JF! by Gadai</h2>
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
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                    <h1>🏦 JF! by Gadai</h1>
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
                    <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role})</h3>
                    <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
                    <p>📌 ${lang === 'id' ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
                    ${!isAdmin ? `<p style="color: #f59e0b;">🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>` : ''}
                </div>`;
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p style="color:#ef4444;">⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    // ==================== 客户信息模块 (问题1、2、3) ====================

    showCustomers: async function() {
        this.currentPage = 'customers';
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();

        try {
            const profile = await SUPABASE.getCurrentProfile();
            let query = supabaseClient.from('customers').select('*').order('registered_date', { ascending: false });
            if (!isAdmin && profile?.store_id) {
                query = query.eq('store_id', profile.store_id);
            }
            const { data: customers, error } = await query;
            if (error) throw error;

            // 批量查询每个客户的活跃订单（问题2：客户列表操作栏）
            var customerHasActiveOrder = {};
            for (var c of customers) {
                const { data: orders } = await supabaseClient
                    .from('orders').select('status').eq('customer_id', c.id).eq('status', 'active');
                customerHasActiveOrder[c.id] = orders && orders.length > 0;
            }

            var rows = '';
            if (!customers || customers.length === 0) {
                rows = `<tr><td colspan="7" style="text-align: center;">${t('no_data')}</td></tr>`;
            } else {
                for (var c of customers) {
                    var hasActive = customerHasActiveOrder[c.id];
                    // 问题2：Admin 显示 修改+删除+新开订单；店长显示 修改+新开订单
                    rows += `<tr>
                        <td>${Utils.formatDate(c.registered_date)}</td>
                        <td>${Utils.escapeHtml(c.name)}</td>
                        <td>${Utils.escapeHtml(c.ktp_number || '-')}</td>
                        <td>${Utils.escapeHtml(c.phone || '-')}</td>
                        <td>${Utils.escapeHtml(c.ktp_address || c.address || '-')}</td>
                        <td>${Utils.escapeHtml(c.living_address || (c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : '-'))}</td>
                        <td>
                            <button onclick="APP.editCustomer('${c.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${lang === 'id' ? 'Ubah' : '修改'}</button>
                            ${hasActive
                                ? `<button onclick="APP.navigateTo('customerPaymentHistory',{customerId:'${c.id}'})" style="padding:4px 8px;font-size:12px;">💰 ${lang === 'id' ? 'Bayar' : '付款'}</button>`
                                : `<button onclick="APP.createOrderForCustomer('${c.id}')" style="padding:4px 8px;font-size:12px;" class="success">➕ ${lang === 'id' ? 'Buat Order' : '新开订单'}</button>`
                            }
                            ${isAdmin ? `<button onclick="APP.deleteCustomer('${c.id}')" style="padding:4px 8px;font-size:12px;" class="danger">🗑️ ${t('delete')}</button>` : ''}
                        </td>
                    </tr>`;
                }
            }

            // 问题3：新增客户录入 双列布局，列表放上方
            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>

                <!-- 客户列表放在上方 -->
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal Daftar' : '录入日期'}</th>
                                    <th>${t('customer_name')}</th>
                                    <th>${t('ktp_number')}</th>
                                    <th>${t('phone')}</th>
                                    <th>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</th>
                                    <th>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</th>
                                    <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>

                <!-- 新增客户表单放在下方，双列布局 -->
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Nasabah Baru' : '新增客户'}</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${t('customer_name')} *</label>
                            <input type="text" id="customerName" placeholder="${t('customer_name')}">
                        </div>
                        <div class="form-group">
                            <label>${t('phone')} *</label>
                            <input type="text" id="customerPhone" placeholder="${t('phone')}">
                        </div>
                        <div class="form-group">
                            <label>${t('ktp_number')}</label>
                            <input type="text" id="customerKtp" placeholder="${t('ktp_number')}">
                        </div>
                        <div class="form-group">
                            <!-- 占位，保持对齐 -->
                        </div>
                        <!-- 问题1：KTP地址 -->
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label>
                            <textarea id="customerKtpAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址'}"></textarea>
                        </div>
                        <!-- 问题1：居住地址，带"同上KTP"选项 -->
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                            <div class="address-option">
                                <label>
                                    <input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)">
                                    ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}
                                </label>
                                <label>
                                    <input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)">
                                    ${lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）'}
                                </label>
                            </div>
                            <textarea id="customerLivingAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址'}" style="display:none;margin-top:8px;"></textarea>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP.addCustomer()" class="success">💾 ${lang === 'id' ? 'Simpan Nasabah' : '保存客户'}</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
        }
    },

    // 切换居住地址输入框显示/隐藏
    toggleLivingAddress: function(value) {
        var el = document.getElementById('customerLivingAddress');
        if (el) el.style.display = value === 'different' ? 'block' : 'none';
    },

    addCustomer: async function() {
        var lang = Utils.lang;
        var name = document.getElementById("customerName").value.trim();
        var ktp = document.getElementById("customerKtp").value.trim();
        var phone = document.getElementById("customerPhone").value.trim();
        var ktpAddress = document.getElementById("customerKtpAddress").value.trim();
        var livingOpt = document.querySelector('input[name="livingAddrOpt"]:checked')?.value || 'same';
        var livingSameAsKtp = livingOpt === 'same';
        var livingAddress = livingSameAsKtp ? null : document.getElementById("customerLivingAddress").value.trim();

        if (!name) { alert(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写'); return; }
        if (!phone) { alert(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写'); return; }

        try {
            const profile = await SUPABASE.getCurrentProfile();
            const { error } = await supabaseClient.from('customers').insert({
                store_id: profile.store_id,
                name: name,
                ktp_number: ktp || null,
                phone: phone,
                ktp_address: ktpAddress || null,
                address: ktpAddress || null, // 向后兼容旧字段
                living_same_as_ktp: livingSameAsKtp,
                living_address: livingAddress || null,
                registered_date: new Date().toISOString().split('T')[0],
                created_by: profile.id
            });
            if (error) throw error;
            alert(lang === 'id' ? 'Nasabah berhasil ditambahkan' : '客户添加成功');
            await this.showCustomers();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    // 问题2：修改客户信息
    editCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: c, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;
            var livingSame = c.living_same_as_ktp !== false; // 默认为true

            var modal = document.createElement('div');
            modal.id = 'editCustomerModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="background:#1e293b;border-radius:12px;padding:24px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;">
                    <h3 style="margin-top:0;">✏️ ${lang === 'id' ? 'Ubah Data Nasabah' : '修改客户信息'}</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${t('customer_name')} *</label>
                            <input id="ec_name" value="${Utils.escapeHtml(c.name)}">
                        </div>
                        <div class="form-group">
                            <label>${t('phone')} *</label>
                            <input id="ec_phone" value="${Utils.escapeHtml(c.phone || '')}">
                        </div>
                        <div class="form-group">
                            <label>${t('ktp_number')}</label>
                            <input id="ec_ktp" value="${Utils.escapeHtml(c.ktp_number || '')}">
                        </div>
                        <div class="form-group"><!-- 占位 --></div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label>
                            <textarea id="ec_ktpAddr" rows="2">${Utils.escapeHtml(c.ktp_address || c.address || '')}</textarea>
                        </div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                            <div class="address-option">
                                <label>
                                    <input type="radio" name="ec_livingOpt" value="same" ${livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)">
                                    ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}
                                </label>
                                <label>
                                    <input type="radio" name="ec_livingOpt" value="different" ${!livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)">
                                    ${lang === 'id' ? 'Berbeda' : '不同'}
                                </label>
                            </div>
                            <textarea id="ec_livingAddr" rows="2" style="margin-top:8px;${livingSame ? 'display:none;' : ''}">${Utils.escapeHtml(c.living_address || '')}</textarea>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP._saveEditCustomer('${customerId}')" class="success">💾 ${t('save')}</button>
                            <button onclick="document.getElementById('editCustomerModal').remove()">✖ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
        } catch (e) {
            alert(lang === 'id' ? 'Gagal memuat data: ' + e.message : '加载失败：' + e.message);
        }
    },

    _toggleEditLiving: function(val) {
        var el = document.getElementById('ec_livingAddr');
        if (el) el.style.display = val === 'different' ? 'block' : 'none';
    },

    _saveEditCustomer: async function(customerId) {
        var lang = Utils.lang;
        var name = document.getElementById('ec_name').value.trim();
        var phone = document.getElementById('ec_phone').value.trim();
        var ktp = document.getElementById('ec_ktp').value.trim();
        var ktpAddr = document.getElementById('ec_ktpAddr').value.trim();
        var livingOpt = document.querySelector('input[name="ec_livingOpt"]:checked')?.value || 'same';
        var livingSame = livingOpt === 'same';
        var livingAddr = livingSame ? null : document.getElementById('ec_livingAddr').value.trim();

        if (!name || !phone) { alert(lang === 'id' ? 'Nama dan telepon wajib diisi' : '姓名和手机号必须填写'); return; }

        try {
            const { error } = await supabaseClient.from('customers').update({
                name, phone,
                ktp_number: ktp || null,
                ktp_address: ktpAddr || null,
                address: ktpAddr || null,
                living_same_as_ktp: livingSame,
                living_address: livingAddr || null
            }).eq('id', customerId);
            if (error) throw error;
            document.getElementById('editCustomerModal')?.remove();
            alert(lang === 'id' ? 'Data nasabah diperbarui' : '客户信息已更新');
            await this.showCustomers();
        } catch (e) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + e.message : '保存失败：' + e.message);
        }
    },

    // 问题2：删除客户（仅Admin）
    deleteCustomer: async function(customerId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus nasabah ini? Semua order terkait juga akan terhapus.' : '删除此客户？相关订单也将被删除。')) return;
        try {
            // 先删除关联订单的付款记录，再删订单，再删客户
            const { data: orders } = await supabaseClient.from('orders').select('id').eq('customer_id', customerId);
            if (orders && orders.length > 0) {
                for (var o of orders) {
                    await supabaseClient.from('payment_history').delete().eq('order_id', o.id);
                }
                await supabaseClient.from('orders').delete().eq('customer_id', customerId);
            }
            const { error } = await supabaseClient.from('customers').delete().eq('id', customerId);
            if (error) throw error;
            alert(lang === 'id' ? 'Nasabah dihapus' : '客户已删除');
            await this.showCustomers();
        } catch (e) {
            alert(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message);
        }
    },

    createOrderForCustomer: async function(customerId) {
        try {
            const { data: existingOrders } = await supabaseClient
                .from('orders').select('status').eq('customer_id', customerId).eq('status', 'active');
            if (existingOrders && existingOrders.length > 0) {
                alert(Utils.lang === 'id' ? 'Nasabah ini masih memiliki order aktif.' : '该客户还有未结清的订单。');
                return;
            }
            const { data: customer, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;

            this.currentPage = 'createOrder';
            this.currentCustomerId = customerId;
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);

            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>📝 ${t('create_order')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="card">
                    <h3>${t('customer_info')}</h3>
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                    <p><strong>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}:</strong> ${Utils.escapeHtml(customer.ktp_address || customer.address || '-')}</p>
                    <p><strong>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}:</strong> ${customer.living_same_as_ktp !== false ? (lang === 'id' ? 'Sama KTP' : '同KTP') : Utils.escapeHtml(customer.living_address || '-')}</p>
                    <h3>${t('collateral_info')}</h3>
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label>${t('collateral_name')} *</label>
                            <input id="collateral" placeholder="${t('collateral_name')}">
                        </div>
                        <div class="form-group">
                            <label>${t('loan_amount')} *</label>
                            <input type="text" id="amount" placeholder="${t('loan_amount')}" style="text-align: right;">
                        </div>
                        <div class="form-group">
                            <label>${t('notes')}</label>
                            <textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP.saveOrderWithCustomer('${customerId}')">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
        }
    },

    saveOrderWithCustomer: async function(customerId) {
        var collateral = document.getElementById("collateral").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var notes = document.getElementById("notes").value;
        if (!collateral || !amount || amount <= 0) { alert(Utils.t('fill_all_fields')); return; }
        try {
            const { data: customer } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            var orderData = {
                customer: { name: customer.name, ktp: customer.ktp_number || '', phone: customer.phone, address: customer.ktp_address || customer.address || '' },
                collateral_name: collateral, loan_amount: amount, notes: notes, customer_id: customerId
            };
            var newOrder = await Order.create(orderData);
            alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
            this.goBack();
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal menyimpan order: ' + error.message : '保存订单失败：' + error.message);
        }
    },

    showCustomerOrders: async function(customerId) {
        this.currentPage = 'customerOrders';
        this.currentCustomerId = customerId;
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: customer } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            const { data: orders, error } = await supabaseClient.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
            if (error) throw error;
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var rows = orders && orders.length > 0 ? orders.map(o => {
                var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                return `<tr>
                    <td>${Utils.escapeHtml(o.order_id)}</td>
                    <td>${Utils.formatDate(o.created_at)}</td>
                    <td>${Utils.formatCurrency(o.loan_amount)}</td>
                    <td>${Utils.formatCurrency(o.principal_paid)}</td>
                    <td>${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                    <td>
                        <button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})" style="padding:4px 8px;font-size:12px;">👁️ ${t('view')}</button>
                        ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})" style="padding:4px 8px;font-size:12px;">💰 ${lang === 'id' ? 'Bayar' : '付款'}</button>` : ''}
                    </td>
                </tr>`;
            }).join('') : `<tr><td colspan="7" style="text-align:center;">${t('no_data')}</td></tr>`;

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📋 ${lang === 'id' ? 'Order Nasabah' : '客户订单'} - ${Utils.escapeHtml(customer.name)}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="card">
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                </div>
                <div class="card">
                    <h3>📋 ${t('order_list')}</h3>
                    <div class="table-container">
                        <table class="table"><thead><tr>
                            <th>ID</th><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${t('loan_amount')}</th>
                            <th>${lang === 'id' ? 'Pokok Dibayar' : '已还本金'}</th><th>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                            <th>${lang === 'id' ? 'Status' : '状态'}</th><th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                        </tr></thead><tbody>${rows}</tbody></table>
                    </div>
                </div>`;
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败');
        }
    },

    showCustomerPaymentHistory: async function(customerId) {
        this.currentPage = 'customerPaymentHistory';
        this.currentCustomerId = customerId;
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: customer } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            const { data: orders } = await supabaseClient.from('orders').select('id, order_id').eq('customer_id', customerId);
            var orderIds = orders?.map(o => o.id) || [];
            var allPayments = [];
            if (orderIds.length > 0) {
                const { data } = await supabaseClient.from('payment_history').select('*, orders(order_id, customer_name)').in('order_id', orderIds).order('date', { ascending: false });
                allPayments = data || [];
            }
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            var rows = allPayments.length === 0
                ? `<tr><td colspan="6" style="text-align:center;">${t('no_data')}</td></tr>`
                : allPayments.map(p => `<tr>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td>${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td>${Utils.formatCurrency(p.amount)}</td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                </tr>`).join('');
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'} - ${Utils.escapeHtml(customer.name)}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="card">
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                </div>
                <div class="card">
                    <h3>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</h3>
                    <div class="table-container">
                        <table class="table payment-table"><thead><tr>
                            <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                            <th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th>
                            <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                            <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                            <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                            <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                        </tr></thead><tbody>${rows}</tbody></table>
                    </div>
                </div>`;
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败');
        }
    },

    // ==================== 运营支出 (问题3：双列布局，名称改为"运营支出") ====================

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

            var rows = expenses && expenses.length > 0 ? expenses.map(e => `<tr>
                <td>${Utils.formatDate(e.expense_date)}</td>
                <td>${Utils.escapeHtml(e.category)}</td>
                <td>${Utils.formatCurrency(e.amount)}</td>
                <td>${Utils.escapeHtml(e.description || '-')}</td>
                <td>${Utils.escapeHtml(e.stores?.name || '-')}</td>
                <td>${Utils.formatDate(e.created_at)}</td>
            </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;">${t('no_data')}</td></tr>`;

            // 问题3：支出列表放上方，新增表单放下方（双列布局）；名称改为"运营支出"
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📝 ${lang === 'id' ? 'Pengeluaran Operasional' : '运营支出'}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Total Pengeluaran' : '支出总额'}: <span style="color:#ef4444;">${Utils.formatCurrency(totalAmount)}</span></h3>
                </div>

                <!-- 列表放上方 -->
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Pengeluaran' : '支出列表'}</h3>
                    <div class="table-container">
                        <table class="table"><thead><tr>
                            <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                            <th>${lang === 'id' ? 'Kategori' : '类别'}</th>
                            <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                            <th>${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                            <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                            <th>${lang === 'id' ? 'Dibuat' : '创建时间'}</th>
                        </tr></thead><tbody>${rows}</tbody></table>
                    </div>
                </div>

                <!-- 新增表单放下方，双列布局 -->
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出'}</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Tanggal' : '日期'} *</label>
                            <input type="date" id="expenseDate">
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
                </div>`;
            var amountInput = document.getElementById("expenseAmount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat pengeluaran' : '加载支出失败');
        }
    },

    addExpense: async function() {
        var lang = Utils.lang;
        var expenseDate = document.getElementById("expenseDate").value;
        var category = document.getElementById("expenseCategory").value.trim();
        var amountStr = document.getElementById("expenseAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var description = document.getElementById("expenseDescription").value;
        if (!expenseDate) { alert(lang === 'id' ? 'Pilih tanggal pengeluaran' : '请选择日期'); return; }
        if (!category) { alert(lang === 'id' ? 'Masukkan kategori' : '请输入类别'); return; }
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const { error } = await supabaseClient.from('expenses').insert({
                store_id: profile.store_id, expense_date: expenseDate, category, amount,
                description: description || null, created_by: profile.id, is_locked: true
            });
            if (error) throw error;
            alert(lang === 'id' ? 'Pengeluaran berhasil disimpan' : '支出保存成功');
            await this.showExpenses();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    // ==================== 付款明细 (问题5：修复表格错位，纵向延展) ====================

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

            // 问题5修复：用 <tr> 替换错误的 <td>，每行一条记录纵向排列
            var rows = allPayments.length === 0
                ? `<tr><td colspan="8" style="text-align:center;">${Utils.t('no_data')}</td></tr>`
                : allPayments.map(p => `<tr>
                    <td>${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td>${Utils.escapeHtml(p.orders?.customer_name || '-')}</td>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td>${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td>${Utils.formatCurrency(p.amount)}</td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <td><button onclick="APP.navigateTo('viewOrder',{orderId:'${p.orders?.order_id}'})" style="padding:4px 8px;font-size:12px;">👁️ ${Utils.t('view')}</button></td>
                </tr>`).join('');

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款明细'}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button></div>
                </div>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Total Bunga' : '利息总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Total Pokok' : '本金总额'}</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalInterest + totalPrincipal)}</div><div>${lang === 'id' ? 'Total Semua' : '全部总计'}</div></div>
                </div>
                <div class="table-container">
                    <table class="table payment-table">
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
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载付款记录失败');
        }
    },

    // ==================== 财务报表 (问题4：Admin分门店，店长看本店) ====================

    showReport: async function() {
        this.currentPage = 'report';
        try {
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();

            if (isAdmin) {
                // Admin：拉取所有门店数据，分别展示
                var stores = await SUPABASE.getAllStores();
                var storeReports = [];
                var grandTotal = { orders: 0, active: 0, loan: 0, adminFee: 0, interest: 0, principal: 0, expenses: 0, income: 0, profit: 0 };

                for (var store of stores) {
                    // 每个门店的订单
                    const { data: orders } = await supabaseClient.from('orders').select('*').eq('store_id', store.id);
                    const { data: expenses } = await supabaseClient.from('expenses').select('amount').eq('store_id', store.id);

                    var ords = orders || [];
                    var activeOrds = ords.filter(o => o.status === 'active');
                    var totalLoan = ords.reduce((s, o) => s + o.loan_amount, 0);
                    var totalAdminFee = ords.reduce((s, o) => s + (o.admin_fee_paid ? o.admin_fee : 0), 0);
                    var totalInterest = ords.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                    var totalPrincipal = ords.reduce((s, o) => s + (o.principal_paid || 0), 0);
                    var totalExpenses = (expenses || []).reduce((s, e) => s + e.amount, 0);
                    var income = totalAdminFee + totalInterest;
                    var profit = income - totalExpenses;

                    storeReports.push({ store, ords: ords.length, active: activeOrds.length, totalLoan, totalAdminFee, totalInterest, totalPrincipal, totalExpenses, income, profit });

                    grandTotal.orders += ords.length;
                    grandTotal.active += activeOrds.length;
                    grandTotal.loan += totalLoan;
                    grandTotal.adminFee += totalAdminFee;
                    grandTotal.interest += totalInterest;
                    grandTotal.principal += totalPrincipal;
                    grandTotal.expenses += totalExpenses;
                    grandTotal.income += income;
                    grandTotal.profit += profit;
                }

                var storeHtml = storeReports.map(r => `
                    <div class="report-store-section">
                        <div class="report-store-header">🏪 ${Utils.escapeHtml(r.store.name)}</div>
                        <div class="report-store-stats">
                            <div class="report-store-stat"><div class="label">${t('total_orders')}</div><div class="value">${r.ords}</div></div>
                            <div class="report-store-stat"><div class="label">${t('active')}</div><div class="value">${r.active}</div></div>
                            <div class="report-store-stat"><div class="label">${t('total_loan')}</div><div class="value">${Utils.formatCurrency(r.totalLoan)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Admin Fee' : '管理费'}</div><div class="value income">${Utils.formatCurrency(r.totalAdminFee)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Bunga' : '利息'}</div><div class="value income">${Utils.formatCurrency(r.totalInterest)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Pokok' : '本金'}</div><div class="value">${Utils.formatCurrency(r.totalPrincipal)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div><div class="value income">${Utils.formatCurrency(r.income)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Pengeluaran' : '运营支出'}</div><div class="value expense">${Utils.formatCurrency(r.totalExpenses)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Laba Kotor' : '毛利'}</div><div class="value profit">${Utils.formatCurrency(r.profit)}</div></div>
                        </div>
                    </div>`).join('');

                document.getElementById("app").innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                    </div>

                    <!-- 合计 -->
                    <div class="card" style="border:2px solid #3b82f6;">
                        <h3 style="color:#3b82f6;">📊 ${lang === 'id' ? 'TOTAL SEMUA TOKO' : '全部门店合计'}</h3>
                        <div class="stats-grid">
                            <div class="stat-card"><div class="stat-value">${grandTotal.orders}</div><div>${t('total_orders')}</div></div>
                            <div class="stat-card"><div class="stat-value">${grandTotal.active}</div><div>${t('active')}</div></div>
                            <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(grandTotal.loan)}</div><div>${t('total_loan')}</div></div>
                            <div class="stat-card"><div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(grandTotal.income)}</div><div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div></div>
                            <div class="stat-card"><div class="stat-value" style="color:#ef4444;">${Utils.formatCurrency(grandTotal.expenses)}</div><div>${lang === 'id' ? 'Total Pengeluaran' : '总运营支出'}</div></div>
                            <div class="stat-card"><div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(grandTotal.profit)}</div><div>${lang === 'id' ? 'Total Laba Kotor' : '总毛利'}</div></div>
                        </div>
                    </div>

                    <!-- 各门店明细 -->
                    <h3>${lang === 'id' ? 'Detail per Toko' : '各门店明细'}</h3>
                    ${storeHtml}

                    <div class="toolbar">
                        <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                    </div>`;
            } else {
                // 店长：只看本店数据
                var report = await Order.getReport();
                var totalExpenses = 0;
                try { totalExpenses = (await this.getExpensesTotal()).total; } catch(e) {}
                var totalIncome = report.total_admin_fees + report.total_interest;
                var grossProfit = totalIncome - totalExpenses;

                document.getElementById("app").innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-value">${report.total_orders}</div><div>${t('total_orders')}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_loan_amount)}</div><div>${t('total_loan')}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_admin_fees)}</div><div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_interest)}</div><div>${lang === 'id' ? 'Bunga' : '利息收入'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(report.total_principal)}</div><div>${lang === 'id' ? 'Pokok' : '本金回收'}</div></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(totalIncome)}</div><div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div></div>
                        <div class="stat-card"><div class="stat-value" style="color:#ef4444;">${Utils.formatCurrency(totalExpenses)}</div><div>${lang === 'id' ? 'Total Pengeluaran' : '运营支出'}</div></div>
                        <div class="stat-card"><div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(grossProfit)}</div><div>${lang === 'id' ? 'Laba Kotor' : '毛利'}</div></div>
                    </div>
                    <div class="toolbar">
                        <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                    </div>`;
            }
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报告失败');
        }
    },

    // ==================== 用户管理 (问题3：双列布局，列表在上) ====================

    showUserManagement: async function() {
        this.currentPage = 'userManagement';
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            var users = await AUTH.getAllUsers();
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;
            users.sort((a, b) => (storeMap[a.store_id] || '').localeCompare(storeMap[b.store_id] || ''));

            var userRows = users.map(u => {
                var isCurrent = u.id === AUTH.user.id;
                var storeName = storeMap[u.store_id] || '-';
                return `<tr>
                    <td>${Utils.escapeHtml(u.username || u.email || '-')}</td>
                    <td>${Utils.escapeHtml(u.name)}</td>
                    <td>${u.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长')}</td>
                    <td>${Utils.escapeHtml(storeName)}</td>
                    <td>
                        ${isCurrent ? `<span style="color:#10b981;">✅ ${lang === 'id' ? 'Saya' : '当前'}</span>` : ''}
                        ${!isCurrent ? `<button onclick="APP.editUser('${u.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${t('edit')}</button>` : ''}
                        ${!isCurrent ? `<button class="danger" onclick="APP.deleteUser('${u.id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>` : ''}
                    </td>
                </tr>`;
            }).join('');

            var storeOptions = `<option value="">${lang === 'id' ? 'Pilih Toko' : '选择门店'}</option>`;
            for (var s of stores) storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`;

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>👥 ${t('user_management')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>

                <!-- 用户列表放上方 -->
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Pengguna' : '用户列表'}</h3>
                    <div class="table-container">
                        <table class="table"><thead><tr>
                            <th>${t('username')}</th><th>${lang === 'id' ? 'Nama' : '姓名'}</th>
                            <th>${lang === 'id' ? 'Peran' : '角色'}</th><th>${lang === 'id' ? 'Toko' : '门店'}</th>
                            <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                        </tr></thead><tbody>${userRows}</tbody></table>
                    </div>
                </div>

                <!-- 新增用户表单放下方，双列布局 -->
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Pengguna Baru' : '添加新用户'}</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${t('username')} *</label>
                            <input id="newUsername" placeholder="${t('username')}">
                        </div>
                        <div class="form-group">
                            <label>${t('password')} *</label>
                            <input id="newPassword" type="password" placeholder="${t('password')}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label>
                            <input id="newName" placeholder="${lang === 'id' ? 'Nama Lengkap' : '姓名'}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Peran' : '角色'} *</label>
                            <select id="newRole">
                                <option value="store_manager">${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                                <option value="admin">${lang === 'id' ? 'Administrator' : '管理员'}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Toko' : '门店'}</label>
                            <select id="newStoreId">${storeOptions}</select>
                        </div>
                        <div class="form-group"><!-- 占位 --></div>
                        <div class="form-actions">
                            <button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat manajemen pengguna' : '加载用户管理失败');
        }
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

    // ==================== 订单相关 ====================

    showOrderTable: async function() {
        this.currentPage = 'orderTable';
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

            var rows = orders.length === 0
                ? `<tr><td colspan="${isAdmin ? 10 : 9}" style="text-align:center;">${t('no_data')}</td></tr>`
                : orders.map(o => {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    return `<tr>
                        <td>${Utils.escapeHtml(o.order_id)}</td>
                        <td>${Utils.escapeHtml(o.customer_name)}</td>
                        <td>${Utils.escapeHtml(o.collateral_name)}</td>
                        <td>${Utils.formatCurrency(o.loan_amount)}</td>
                        <td>${Utils.formatCurrency(o.admin_fee)}</td>
                        <td>${Utils.formatCurrency(o.monthly_interest || 0)}</td>
                        <td>${o.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'}</td>
                        <td><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                        ${isAdmin ? `<td>${Utils.escapeHtml(storeMap[o.store_id] || '-')}</td>` : ''}
                        <td>
                            <button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})">👁️ ${t('view')}</button>
                            ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})">💰</button>` : ''}
                            ${isAdmin ? `<button class="danger" onclick="APP.deleteOrder('${o.order_id}')">🗑️</button>` : ''}
                            <button onclick="APP.printOrder('${o.order_id}')" class="success">🖨️</button>
                            ${o.is_locked ? '<span>🔒</span>' : ''}
                        </td>
                    </tr>`;
                }).join('');

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📋 ${t('order_list')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>
                <div class="toolbar">
                    <input type="text" id="searchInput" placeholder="🔍 ${t('search')}..." style="max-width:300px;" value="${Utils.escapeHtml(this.searchKeyword)}">
                    <button onclick="APP.searchOrders()">${t('search')}</button>
                    <button onclick="APP.resetSearch()">${t('reset')}</button>
                    <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                        <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>${t('total_orders')}</option>
                        <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                </div>
                <div class="table-container">
                    <table class="table"><thead><tr>
                        <th>ID</th><th>${t('customer_name')}</th><th>${t('collateral_name')}</th>
                        <th>${t('loan_amount')}</th><th>${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                        <th>${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</th>
                        <th>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                        <th>${lang === 'id' ? 'Status' : '状态'}</th>
                        ${isAdmin ? `<th>${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                        <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                    </tr></thead><tbody>${rows}</tbody></table>
                </div>`;
        } catch (err) {
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },

    searchOrders: function() { this.searchKeyword = document.getElementById("searchInput").value; this.showOrderTable(); },
    resetSearch: function() { this.searchKeyword = ""; this.currentFilter = "all"; this.showOrderTable(); },
    filterOrders: function(status) { this.currentFilter = status; this.showOrderTable(); },

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
            var payRows = payments && payments.length > 0 ? payments.map(p => {
                var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                return `<tr>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeText}</td>
                    <td>${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                    <td>${Utils.formatCurrency(p.amount)}</td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                </tr>`;
            }).join('') : `<tr><td colspan="5" style="text-align:center;">${t('no_data')}</td></tr>`;

            var remainingPrincipal = order.loan_amount - order.principal_paid;
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>📄 ${t('view')} ${t('order_list')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
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
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '支付记录'}</h3>
                    <div class="table-container">
                        <table class="table payment-table"><thead><tr>
                            <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                            <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                            <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                            <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                            <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                        </tr></thead><tbody>${payRows}</tbody></table>
                    </div>
                    <div class="toolbar">
                        <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                        ${order.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${order.order_id}'})">💰 ${t('save')}</button>` : ''}
                        ${isAdmin && order.is_locked ? `<button onclick="APP.unlockOrder('${order.order_id}')">🔓 ${lang === 'id' ? 'Buka Kunci' : '解锁'}</button>` : ''}
                        <button onclick="APP.printOrder('${order.order_id}')" class="success">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>
                </div>`;
        } catch (error) {
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
                interestOptions += `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(currentMonthlyInterest * i)})</option>`;
            }
            var adminFeeSection = !order.admin_fee_paid
                ? `<div style="background:#0f172a;padding:15px;border-radius:8px;margin-bottom:15px;">
                    <h4>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'} - ${Utils.formatCurrency(order.admin_fee)}</h4>
                    <button onclick="APP.payAdminFee('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Admin Fee' : '记录管理费'}</button>
                   </div>`
                : `<div style="background:#0f172a;padding:15px;border-radius:8px;margin-bottom:15px;">
                    <p>✅ ${lang === 'id' ? 'Admin Fee sudah dibayar' : '管理费已支付'}</p>
                   </div>`;
            var principalSection = remainingPrincipal > 0
                ? `<div class="form-group"><label>${lang === 'id' ? 'Jumlah Pembayaran Pokok' : '本金支付金额'}:</label>
                   <input type="text" id="principalAmount" value="${remainingPrincipal}" style="width:200px;text-align:right;"></div>
                   <button onclick="APP.payPrincipal('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>`
                : `<p>✅ ${lang === 'id' ? 'Pokok sudah lunas' : '本金已结清'}</p>`;

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
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
                    <div style="background:#0f172a;padding:15px;border-radius:8px;margin-bottom:15px;">
                        <h4>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '支付利息'}</h4>
                        <div class="form-group"><label>${lang === 'id' ? 'Jumlah Bulan' : '月数'}:</label>
                        <select id="interestMonths" style="width:200px;">${interestOptions}</select></div>
                        <button onclick="APP.payInterest('${order.order_id}')" class="success">✅ ${lang === 'id' ? 'Catat Bunga' : '记录利息'}</button>
                    </div>
                    <div style="background:#0f172a;padding:15px;border-radius:8px;margin-bottom:15px;">
                        <h4>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金支付'}</h4>
                        ${principalSection}
                    </div>
                </div>
                <div class="toolbar"><button onclick="APP.goBack()">↩️ ${t('cancel')}</button></div>`;
            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
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
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
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
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var canEdit = AUTH.isAdmin() || (!order.is_locked && AUTH.user.role === 'store_manager');
            if (!canEdit) { alert(lang === 'id' ? 'Order ini sudah terkunci' : '此订单已锁定'); this.goBack(); return; }
            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2>✏️ ${t('edit')}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
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
                            <button onclick="APP.updateOrder('${order.order_id}')">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
        } catch (error) { alert('Error loading order'); this.goBack(); }
    },

    updateOrder: async function(orderId) {
        var updates = {
            customer: { name: document.getElementById("name").value, ktp: document.getElementById("ktp").value, phone: document.getElementById("phone").value, address: document.getElementById("address").value },
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

    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert(Utils.lang === 'id' ? 'Order tidak ditemukan' : '订单不存在'); return; }
            var lang = Utils.lang;
            var totalPrincipalPaid = payments.filter(p => p.type === 'principal').reduce((s, p) => s + p.amount, 0);
            var totalInterestPaid = payments.filter(p => p.type === 'interest').reduce((s, p) => s + p.amount, 0);
            var totalAdminFeePaid = payments.filter(p => p.type === 'admin_fee').reduce((s, p) => s + p.amount, 0);
            var printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print - ${order.order_id}</title>
            <style>body{font-family:'Segoe UI',sans-serif;margin:20px;}.header{text-align:center;margin-bottom:30px;}.section{margin-bottom:20px;border:1px solid #e2e8f0;padding:15px;border-radius:8px;}.section h3{margin:0 0 10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;}.info-row{display:flex;margin-bottom:8px;}.info-label{width:140px;font-weight:bold;color:#475569;}.info-value{flex:1;}.table{width:100%;border-collapse:collapse;margin-top:10px;}.table th,.table td{border:1px solid #e2e8f0;padding:8px;text-align:left;}.table th{background:#f1f5f9;}.remarks{margin-top:20px;padding:15px;background:#fef3c7;border-left:4px solid #f59e0b;font-size:12px;}.no-print{text-align:center;margin-bottom:20px;}@media print{.no-print{display:none;}}</style>
            </head><body>
            <div class="no-print"><button onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button><button onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button></div>
            <div class="header"><h1>🏦 JF! by Gadai</h1><p>${lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证'}</p><p><strong>${order.order_id}</strong></p><p>${Utils.formatDate(order.created_at)}</p></div>
            <div class="section"><h3>📋 ${lang === 'id' ? 'Informasi Pelanggan' : '客户信息'}</h3>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Nama' : '姓名'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_name)}</div></div>
                <div class="info-row"><div class="info-label">KTP:</div><div class="info-value">${Utils.escapeHtml(order.customer_ktp)}</div></div>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Telepon' : '电话'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_phone)}</div></div>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Alamat' : '地址'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_address || '-')}</div></div>
            </div>
            <div class="section"><h3>💎 ${lang === 'id' ? 'Jaminan' : '质押物'}</h3>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Barang' : '物品'}:</div><div class="info-value">${Utils.escapeHtml(order.collateral_name)}</div></div>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pinjaman' : '贷款'}:</div><div class="info-value">${Utils.formatCurrency(order.loan_amount)}</div></div>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div class="info-value">${Utils.formatCurrency(order.loan_amount - order.principal_paid)}</div></div>
            </div>
            <div class="section"><h3>💰 ${lang === 'id' ? 'Ringkasan Pembayaran' : '付款汇总'}</h3>
                <div class="info-row"><div class="info-label">Admin Fee:</div><div class="info-value">${Utils.formatCurrency(totalAdminFeePaid)}</div></div>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Total Bunga' : '利息总额'}:</div><div class="info-value">${Utils.formatCurrency(totalInterestPaid)}</div></div>
                <div class="info-row"><div class="info-label">${lang === 'id' ? 'Total Pokok' : '本金总额'}:</div><div class="info-value">${Utils.formatCurrency(totalPrincipalPaid)}</div></div>
            </div>
            <div class="section"><h3>📋 ${lang === 'id' ? 'Detail Pembayaran' : '付款明细'}</h3>
            <table class="table"><thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead><tbody>
            ${payments.map(p => {
                var tt = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                return `<tr><td>${Utils.formatDate(p.date)}</td><td>${tt}</td><td>${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td><td>${Utils.formatCurrency(p.amount)}</td><td>${Utils.escapeHtml(p.description || '-')}</td></tr>`;
            }).join('')}
            </tbody></table></div>
            <div class="remarks"><h4>📌 ${lang === 'id' ? 'Penting' : '重要提示'}:</h4>
            <p>1. Peminjam wajib membayar sewa modal setiap bulan tepat waktu.</p>
            <p>2. Jika tidak membayar, Pemberi Pinjaman berhak menjual barang jaminan.</p>
            <p>3. Keterlambatan lebih dari 7 hari dikenakan denda 5% per bulan.</p></div>
            <p style="text-align:center;font-size:12px;margin-top:20px;">${lang === 'id' ? 'Dicetak pada' : '打印时间'}: ${new Date().toLocaleString()} | © JF! by Gadai</p>
            </body></html>`;
            var pw = window.open('', '_blank');
            pw.document.write(printContent);
            pw.document.close();
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal mencetak order' : '打印订单失败');
        }
    },

    // ==================== 门店管理 (问题3：新增门店双列，列表在上) ====================

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
