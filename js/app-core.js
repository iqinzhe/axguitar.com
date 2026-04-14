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

    // 登录页面专用语言切换
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

    // 通用打印方法
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
        
        // 确保语言已正确加载
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
        // 确保登录后使用已保存的语言
        var savedLang = localStorage.getItem('jf_language');
        if (savedLang && (savedLang === 'id' || savedLang === 'zh')) {
            Utils.lang = savedLang;
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
                    <h3>${t('current_user')}: ${Utils.escapeHtml(AUTH.user.name)} (${AUTH.user.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长')})</h3>
                    <p>🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}</p>
                    <p>📌 ${lang === 'id' ? 'Admin Fee: 30,000 IDR (dibayar saat kontrak) | Bunga: 10% per bulan' : '管理费: 30,000 IDR (签合同支付) | 利息: 10%/月 (每月支付)'}</p>
                    ${!isAdmin ? `<p style="color: #f59e0b;">🔒 ${lang === 'id' ? 'Order yang sudah disimpan tidak dapat diubah' : '已保存的订单不可修改'}</p>` : ''}
                </div>`;
        } catch (err) {
            document.getElementById("app").innerHTML = `<div class="card"><p style="color:#ef4444;">⚠️ ${err.message}</p><button onclick="APP.logout()">🚪 ${Utils.t('logout')}</button></div>`;
        }
    },

    // ==================== 客户信息模块 ====================

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

            document.getElementById("app").innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</h2>
                    <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
                </div>

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
                        <div class="form-group"></div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label>
                            <textarea id="customerKtpAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址'}"></textarea>
                        </div>
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
                </div>
                <div class="toolbar">
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                </div>`;
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
        }
    },

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
                address: ktpAddress || null,
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

    editCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: c, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;
            var livingSame = c.living_same_as_ktp !== false;

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
                        <div class="form-group"></div>
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

    deleteCustomer: async function(customerId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus nasabah ini? Semua order terkait juga akan terhapus.' : '删除此客户？相关订单也将被删除。')) return;
        try {
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

    // ==================== 运营支出 ====================

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
                </div>
                <div class="toolbar">
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
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

    // ==================== 付款明细 ====================

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
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                </div>`;
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载付款记录失败');
        }
    },

    // ==================== 财务报表 ====================

    showReport: async function() {
        this.currentPage = 'report';
        try {
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();

            if (isAdmin) {
                var stores = await SUPABASE.getAllStores();
                var storeReports = [];
                var grandTotal = { orders: 0, active: 0, loan: 0, adminFee: 0, interest: 0, principal: 0, expenses: 0, income: 0, profit: 0 };

                for (var store of stores) {
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

                var storeHtml = storeReports.length === 0 
                    ? `<div class="report-store-section"><div class="report-store-header">${lang === 'id' ? 'Tidak ada toko' : '暂无门店'}</div><div class="report-store-stats"><div class="report-store-stat">-</div></div></div>`
                    : storeReports.map(r => `
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

                    <div class="card" style="border:2px solid #3b82f6;">
                        <h3 style="color:#3b82f6;">📊 ${lang === 'id' ? 'TOTAL SEMUA TOKO' : '全部门店合计'}</h3>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #334155; border-radius: 8px; overflow: hidden;">
                            <div class="stat-card" style="border-right: 1px solid #334155; border-bottom: 1px solid #334155; margin:0; border-radius:0;">
                                <div class="stat-value">${grandTotal.orders}</div>
                                <div>${t('total_orders')}</div>
                            </div>
                            <div class="stat-card" style="border-right: 1px solid #334155; border-bottom: 1px solid #334155; margin:0; border-radius:0;">
                                <div class="stat-value">${grandTotal.active}</div>
                                <div>${t('active')}</div>
                            </div>
                            <div class="stat-card" style="border-bottom: 1px solid #334155; margin:0; border-radius:0;">
                                <div class="stat-value">${Utils.formatCurrency(grandTotal.loan)}</div>
                                <div>${t('total_loan')}</div>
                            </div>
                            <div class="stat-card" style="border-right: 1px solid #334155; margin:0; border-radius:0;">
                                <div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(grandTotal.income)}</div>
                                <div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div>
                            </div>
                            <div class="stat-card" style="border-right: 1px solid #334155; margin:0; border-radius:0;">
                                <div class="stat-value" style="color:#ef4444;">${Utils.formatCurrency(grandTotal.expenses)}</div>
                                <div>${lang === 'id' ? 'Total Pengeluaran' : '总运营支出'}</div>
                            </div>
                            <div class="stat-card" style="margin:0; border-radius:0;">
                                <div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(grandTotal.profit)}</div>
                                <div>${lang === 'id' ? 'Total Laba Kotor' : '总毛利'}</div>
                            </div>
                        </div>
                    </div>

                    <h3>${lang === 'id' ? 'Detail per Toko' : '各门店明细'}</h3>
                    ${storeHtml}

                    <div class="toolbar">
                        <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>`;
            } else {
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
                        <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    </div>`;
            }
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报告失败');
        }
    },

    // ==================== 用户管理 ====================
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

        // 修复：正确构建表格行，确保列数匹配
        var userRows = '';
        for (var u of users) {
            var isCurrent = u.id === AUTH.user.id;
            var storeName = storeMap[u.store_id] || '-';
            var roleText = u.role === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长');
            var actionHtml = '';
            if (isCurrent) {
                actionHtml = `<span style="color:#10b981;">✅ ${lang === 'id' ? 'Saya' : '当前'}</span>`;
            } else {
                actionHtml = `
                    <button onclick="APP.editUser('${u.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${t('edit')}</button>
                    <button class="danger" onclick="APP.deleteUser('${u.id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>
                `;
            }
            userRows += `<tr>
                <td style="border:1px solid #334155;padding:8px;">${Utils.escapeHtml(u.username || u.email || '-')}</td>
                <td style="border:1px solid #334155;padding:8px;">${Utils.escapeHtml(u.name)}</td>
                <td style="border:1px solid #334155;padding:8px;">${roleText}</td>
                <td style="border:1px solid #334155;padding:8px;">${Utils.escapeHtml(storeName)}</td>
                <td style="border:1px solid #334155;padding:8px;white-space:nowrap;">${actionHtml}</td>
            </tr>`;
        }

        if (users.length === 0) {
            userRows = `<tr><td colspan="5" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
        }

        var storeOptions = `<option value="">${lang === 'id' ? 'Pilih Toko' : '选择门店'}</option>`;
        for (var s of stores) {
            storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`;
        }

        document.getElementById("app").innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2>👥 ${t('user_management')}</h2>
                <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
            </div>

            <div class="card">
                <h3>${lang === 'id' ? 'Daftar Pengguna' : '用户列表'}</h3>
                <div class="table-container">
                    <table class="table" style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#0f172a;">
                                <th style="border:1px solid #334155;padding:10px;text-align:left;">${t('username')}</th>
                                <th style="border:1px solid #334155;padding:10px;text-align:left;">${lang === 'id' ? 'Nama' : '姓名'}</th>
                                <th style="border:1px solid #334155;padding:10px;text-align:left;">${lang === 'id' ? 'Peran' : '角色'}</th>
                                <th style="border:1px solid #334155;padding:10px;text-align:left;">${lang === 'id' ? 'Toko' : '门店'}</th>
                                <th style="border:1px solid #334155;padding:10px;text-align:left;">${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${userRows}</tbody>
                    </table>
                </div>
            </div>

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
                    <div class="form-group"></div>
                    <div class="form-actions">
                        <button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Pengguna' : '添加用户'}</button>
                    </div>
                </div>
            </div>
            <div class="toolbar">
                <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
            </div>`;
    } catch (error) {
        console.error("showUserManagement error:", error);
        alert(Utils.lang === 'id' ? 'Gagal memuat manajemen pengguna: ' + error.message : '加载用户管理失败：' + error.message);
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
                ? `<td><td colspan="${isAdmin ? 10 : 9}" style="text-align:center;">${t('no_data')}</td></tr>`
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
                            ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                            ${isAdmin ? `<button class="danger" onclick="APP.deleteOrder('${o.order_id}')">🗑️ ${t('delete')}</button>` : ''}
                            <button onclick="APP.printOrder('${o.order_id}')" class="success">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            ${o.is_locked ? `<span style="font-size:12px;color:#94a3b8;">🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</span>` : ''}
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
                    <button onclick="Storage.exportOrdersToCSV()">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                    <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
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

            var { payments } = await SUPABASE.getPaymentHistory(orderId);

            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            var currentMonthlyInterest = remainingPrincipal * 0.10;

            var interestPayments = payments.filter(p => p.type === 'interest');
            var principalPayments = payments.filter(p => p.type === 'principal');
            var adminFeePayments = payments.filter(p => p.type === 'admin_fee');

            var interestRows = interestPayments.length === 0
                ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;font-size:12px;">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'}</td></tr>`
                : interestPayments.map(p => `<tr>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td>${Utils.formatCurrency(p.amount)}</td>
                    <td style="font-size:11px;color:#94a3b8;">${Utils.escapeHtml(p.description || '-')}</td>
                  </tr>`).join('');

            var principalRows = principalPayments.length === 0
                ? `<tr><td colspan="3" style="text-align:center;color:#94a3b8;font-size:12px;">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'}</td></tr>`
                : principalPayments.map(p => `<tr>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${Utils.formatCurrency(p.amount)}</td>
                    <td style="font-size:11px;color:#94a3b8;">${Utils.escapeHtml(p.description || '-')}</td>
                  </tr>`).join('');

            var adminFeeSection = !order.admin_fee_paid
                ? `<div style="background:#0f172a;padding:12px 15px;border-radius:8px;margin-bottom:12px;border-left:3px solid #f59e0b;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                        <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ❌ ${lang === 'id' ? 'Belum dibayar' : '未支付'}</span>
                        <button onclick="APP.payAdminFee('${order.order_id}')" class="success" style="margin:0;">✅ ${lang === 'id' ? 'Catat Pembayaran' : '记录收款'}</button>
                    </div>
                   </div>`
                : `<div style="background:#0f172a;padding:10px 15px;border-radius:8px;margin-bottom:12px;border-left:3px solid #10b981;">
                    <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ✅ ${lang === 'id' ? 'Sudah dibayar' : '已支付'} (${Utils.formatDate(order.admin_fee_paid_date)})</span>
                   </div>`;

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            var principalInputSection = remainingPrincipal > 0
                ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                    <label style="color:#cbd5e1;white-space:nowrap;">${lang === 'id' ? 'Jumlah bayar pokok' : '本次还款金额'} (IDR):</label>
                    <input type="text" id="principalAmount" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}" style="width:180px;text-align:right;margin:0;">
                    <button onclick="APP.payPrincipal('${order.order_id}')" class="success" style="margin:0;">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                   </div>
                   <p style="font-size:12px;color:#94a3b8;">${lang === 'id' ? 'Sisa pokok' : '剩余本金'}: <strong style="color:#f1f5f9;">${Utils.formatCurrency(remainingPrincipal)}</strong></p>`
                : `<p style="color:#10b981;">✅ ${lang === 'id' ? 'Pokok sudah LUNAS' : '本金已全部结清'}</p>`;

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>

                <div class="card" style="padding:14px 18px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
                        <div><div style="font-size:11px;color:#94a3b8;">${t('customer_name')}</div><div style="font-weight:600;">${Utils.escapeHtml(order.customer_name)}</div></div>
                        <div><div style="font-size:11px;color:#94a3b8;">ID</div><div style="font-weight:600;">${Utils.escapeHtml(order.order_id)}</div></div>
                        <div><div style="font-size:11px;color:#94a3b8;">${t('loan_amount')}</div><div style="font-weight:600;">${Utils.formatCurrency(order.loan_amount)}</div></div>
                        <div><div style="font-size:11px;color:#94a3b8;">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</div><div style="font-weight:600;color:${remainingPrincipal > 0 ? '#f59e0b' : '#10b981'};">${Utils.formatCurrency(remainingPrincipal)}</div></div>
                        <div><div style="font-size:11px;color:#94a3b8;">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</div><div style="font-weight:600;color:#3b82f6;">${Utils.formatCurrency(currentMonthlyInterest)}</div></div>
                        <div><div style="font-size:11px;color:#94a3b8;">${lang === 'id' ? 'Jatuh Tempo Bunga' : '下次利息到期'}</div><div style="font-weight:600;">${nextDueDate}</div></div>
                        <div><div style="font-size:11px;color:#94a3b8;">${lang === 'id' ? 'Bunga Dibayar' : '已付利息期数'}</div><div style="font-weight:600;">${order.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</div></div>
                    </div>
                </div>

                ${adminFeeSection}

                <div class="card">
                    <h3 style="margin-bottom:12px;">💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3>
                    <p style="font-size:12px;color:#94a3b8;margin-bottom:10px;">
                        ${lang === 'id'
                            ? '📌 Setiap pembayaran memperpanjang pinjaman 1 bulan secara otomatis'
                            : '📌 每次付息后自动延续1个月，到期日同步更新'}
                    </p>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
                        <label style="color:#cbd5e1;white-space:nowrap;">${lang === 'id' ? 'Bayar untuk' : '支付'}:</label>
                        <select id="interestMonths" style="width:auto;min-width:200px;margin:0;">${interestOptions}</select>
                        <button onclick="APP.payInterest('${order.order_id}')" class="success" style="margin:0;">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息付款'}</button>
                    </div>

                    <h4 style="font-size:13px;margin-bottom:6px;color:#94a3b8;">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息付款历史'}</h4>
                    <div class="table-container" style="margin-top:0;">
                        <table class="table" style="min-width:400px;">
                            <thead><tr>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr></thead>
                            <tbody>${interestRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <h3 style="margin-bottom:12px;">🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3>
                    <p style="font-size:12px;color:#94a3b8;margin-bottom:10px;">
                        ${lang === 'id'
                            ? `📌 Total pinjaman: ${Utils.formatCurrency(order.loan_amount)} | Sudah dibayar: ${Utils.formatCurrency(order.principal_paid)} | Sisa: ${Utils.formatCurrency(remainingPrincipal)}`
                            : `📌 贷款总额: ${Utils.formatCurrency(order.loan_amount)} | 已还: ${Utils.formatCurrency(order.principal_paid)} | 剩余: ${Utils.formatCurrency(remainingPrincipal)}`}
                    </p>
                    ${principalInputSection}

                    <h4 style="font-size:13px;margin-top:14px;margin-bottom:6px;color:#94a3b8;">📋 ${lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史'}</h4>
                    <div class="table-container" style="margin-top:0;">
                        <table class="table" style="min-width:360px;">
                            <thead><tr>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr></thead>
                            <tbody>${principalRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="toolbar">
                    <button onclick="APP.viewOrder('${order.order_id}')">📄 ${lang === 'id' ? 'Lihat Detail Order' : '查看订单详情'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>`;

            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);

        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran' : '加载支付页面失败');
            this.goBack();
        }
    },

    payAdminFee: async function(orderId) {
        if (confirm(Utils.lang === 'id' ? 'Konfirmasi penerimaan Admin Fee 30,000 IDR?' : '确认已收取管理费 30,000 IDR？')) {
            try { await Order.recordAdminFee(orderId); await this.showPayment(orderId); }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    payInterest: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var lang = Utils.lang;
        if (confirm((lang === 'id' ? 'Konfirmasi pembayaran bunga ' : '确认支付利息 ') + months + (lang === 'id' ? ' bulan?' : ' 个月？'))) {
            try {
                await Order.recordInterestPayment(orderId, months);
                await this.showPayment(orderId);
            }
            catch (error) { alert('Error: ' + error.message); }
        }
    },

    payPrincipal: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var lang = Utils.lang;
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        if (confirm((lang === 'id' ? 'Konfirmasi pembayaran pokok ' : '确认支付本金 ') + Utils.formatCurrency(amount) + '?')) {
            try {
                await Order.recordPrincipalPayment(orderId, amount);
                await this.showPayment(orderId);
            }
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
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.4; color: #1e293b; padding: 12mm 14mm; }
                .header { text-align: center; margin-bottom: 8px; border-bottom: 2px solid #1e293b; padding-bottom: 6px; }
                .header h1 { font-size: 16px; margin-bottom: 2px; }
                .header p { font-size: 11px; color: #475569; margin: 1px 0; }
                .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
                .section { border: 1px solid #cbd5e1; border-radius: 4px; padding: 7px 10px; }
                .section h3 { font-size: 11px; font-weight: 700; margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
                .info-row { display: flex; margin-bottom: 3px; }
                .info-label { width: 90px; font-weight: 600; color: #475569; flex-shrink: 0; }
                .info-value { flex: 1; }
                .table { width: 100%; border-collapse: collapse; margin-top: 5px; }
                .table th, .table td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; font-size: 10px; }
                .table th { background: #f1f5f9; font-weight: 700; }
                .table tr:nth-child(even) { background: #f8fafc; }
                .remarks { margin-top: 8px; padding: 6px 10px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 0 4px 4px 0; font-size: 10px; line-height: 1.5; }
                .remarks h4 { font-size: 10px; font-weight: 700; margin-bottom: 3px; color: #92400e; }
                .remarks p { margin: 1px 0; color: #78350f; }
                .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 5px; }
                .no-print { text-align: center; padding: 10px; background: #f1f5f9; margin-bottom: 10px; border-radius: 6px; }
                .no-print button { margin: 0 5px; padding: 6px 14px; cursor: pointer; border: none; border-radius: 4px; font-size: 13px; }
                .btn-print { background: #3b82f6; color: white; }
                .btn-close { background: #64748b; color: white; }
                @media print {
                    .no-print { display: none; }
                    body { padding: 8mm 10mm; }
                }
            </style>
            </head><body>
            <div class="no-print">
                <button class="btn-print" onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                <button class="btn-close" onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
            </div>
            <div class="header">
                <h1><img src="/icons/system-jf.png" alt="JF!" style="height: 24px; vertical-align: middle;"> JF! by Gadai</h1>
                <p>${lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证'} &nbsp;|&nbsp; <strong>${order.order_id}</strong> &nbsp;|&nbsp; ${Utils.formatDate(order.created_at)}</p>
            </div>
            <div class="two-col">
                <div class="section">
                    <h3>📋 ${lang === 'id' ? 'Informasi Pelanggan' : '客户信息'}</h3>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Nama' : '姓名'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_name)}</div></div>
                    <div class="info-row"><div class="info-label">KTP:</div><div class="info-value">${Utils.escapeHtml(order.customer_ktp || '-')}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Telepon' : '电话'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_phone || '-')}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Alamat' : '地址'}:</div><div class="info-value">${Utils.escapeHtml(order.customer_address || '-')}</div></div>
                </div>
                <div class="section">
                    <h3>💎 ${lang === 'id' ? 'Jaminan & Pinjaman' : '质押物与贷款'}</h3>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Barang' : '物品'}:</div><div class="info-value">${Utils.escapeHtml(order.collateral_name)}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pinjaman' : '贷款'}:</div><div class="info-value"><strong>${Utils.formatCurrency(order.loan_amount)}</strong></div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</div><div class="info-value"><strong>${Utils.formatCurrency(order.loan_amount - order.principal_paid)}</strong></div></div>
                    <div class="info-row"><div class="info-label">Admin Fee:</div><div class="info-value">${Utils.formatCurrency(totalAdminFeePaid)} ${order.admin_fee_paid ? '✅' : '❌'}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Bunga/Bln' : '月利息'}:</div><div class="info-value">${Utils.formatCurrency(order.monthly_interest || 0)}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Bunga Lunas' : '已付利息'}:</div><div class="info-value">${Utils.formatCurrency(totalInterestPaid)}</div></div>
                    <div class="info-row"><div class="info-label">${lang === 'id' ? 'Pokok Lunas' : '已还本金'}:</div><div class="info-value">${Utils.formatCurrency(totalPrincipalPaid)}</div></div>
                </div>
            </div>
            <div class="section">
                <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款明细'}</h3>
                <table class="table"><thead><tr>
                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                    <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                    <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                    <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                </tr></thead><tbody>
                ${payments.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:#94a3b8;">${lang === 'id' ? 'Belum ada pembayaran' : '暂无付款记录'}</td></tr>` :
                payments.map(p => {
                    var tt = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    return `<tr><td>${Utils.formatDate(p.date)}</td><td>${tt}</td><td>${p.months ? p.months + (lang === 'id' ? ' bln' : ' 月') : '-'}</td><td>${Utils.formatCurrency(p.amount)}</td><td>${Utils.escapeHtml(p.description || '-')}</td></tr>`;
                }).join('')}
                </tbody></table>
            </div>
            <div class="remarks">
                <h4>📌 ${lang === 'id' ? 'Penting' : '重要提示'}:</h4>
                <p>1. Peminjam wajib membayar sewa modal setiap bulan tepat waktu. Pembayaran memperpanjang pinjaman 1 bulan.</p>
                <p>2. Jika tidak membayar dan pinjaman belum lunas, Pemberi Pinjaman berhak menjual barang jaminan.</p>
                <p>3. Keterlambatan lebih dari 7 hari dikenakan denda 5% per bulan. Lebih dari 30 hari, barang langsung dijual.</p>
            </div>
            <div class="footer">${lang === 'id' ? 'Dicetak pada' : '打印时间'}: ${new Date().toLocaleString()} &nbsp;|&nbsp; © JF! by Gadai</div>
            </body></html>`;
            var pw = window.open('', '_blank');
            pw.document.write(printContent);
            pw.document.close();
        } catch (error) {
            alert(Utils.lang === 'id' ? 'Gagal mencetak order' : '打印订单失败');
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
