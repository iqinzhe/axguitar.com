// app-customers.js - 完整修复版
// 修复内容：客户ID生成显示、Admin可选择门店、Admin创建订单可选门店

window.APP = window.APP || {};

const CustomersModule = {

    showCustomers: async function() {
        this.currentPage = 'customers';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();

        try {
            const customers = await SUPABASE.getCustomers();
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 9 : 8}" class="text-center">${t('no_data')}</td></tr>`;
            } else {
                for (var c of customers) {
                    rows += `<tr>
                        <td class="customer-id-cell">${Utils.escapeHtml(c.customer_id || '-')}</td>
                        <td class="date-cell">${Utils.formatDate(c.registered_date)}</td>
                        <td class="name-cell">${Utils.escapeHtml(c.name)}</td>
                        <td class="ktp-cell">${Utils.escapeHtml(c.ktp_number || '-')}</td>
                        <td class="phone-cell">${Utils.escapeHtml(c.phone || '-')}</td>
                        <td class="address-cell">${Utils.escapeHtml(c.ktp_address || c.address || '-')}</td>
                        <td class="address-cell">${Utils.escapeHtml(c.living_address || (c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : '-'))}</td>
                        ${isAdmin ? `<td class="store-cell">${Utils.escapeHtml(c.stores?.name || '-')} (${Utils.escapeHtml(c.stores?.code || '-')})</td>` : ''}
                        <td class="action-cell">
                            <button onclick="APP.editCustomer('${c.id}')" class="btn-small">✏️ ${lang === 'id' ? 'Ubah' : '修改'}</button>
                            <button onclick="APP.createOrderForCustomer('${c.id}')" class="btn-small success">➕ ${lang === 'id' ? 'Buat Order' : '建立订单'}</button>
                            ${PERMISSION.canDeleteCustomer() ? `<button onclick="APP.deleteCustomer('${c.id}')" class="btn-small danger">🗑️ ${t('delete')}</button>` : ''}
                        </td>
                    　　　`;
                }
            }

            // 获取门店列表（Admin需要选择门店）
            var stores = await SUPABASE.getAllStores();
            var storeOptions = '<option value="">-- ' + (lang === 'id' ? 'Pilih Toko' : '选择门店') + ' --</option>';
            for (var store of stores) {
                storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)} (${Utils.escapeHtml(store.code || '-')})</option>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                    <div class="table-container">
                        <table class="customer-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th>
                                    <th>${lang === 'id' ? 'Tanggal Daftar' : '录入日期'}</th>
                                    <th>${t('customer_name')}</th>
                                    <th>${t('ktp_number')}</th>
                                    <th>${t('phone')}</th>
                                    <th>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</th>
                                    <th>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</th>
                                    ${isAdmin ? `<th>${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
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
                        ${isAdmin ? `
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Toko' : '门店'} *</label>
                            <select id="customerStoreId">
                                ${storeOptions}
                            </select>
                        </div>
                        ` : ''}
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label>
                            <textarea id="customerKtpAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址'}"></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                            <div class="address-option">
                                <label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                                <label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）'}</label>
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
                </div>
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .customer-table { width: 100%; border-collapse: collapse; }
                    .customer-table th, .customer-table td { border: 1px solid #cbd5e1; padding: 8px; }
                    .customer-table th { background: #f8fafc; font-weight: 600; }
                    .customer-id-cell, .date-cell, .ktp-cell, .phone-cell, .store-cell { white-space: nowrap; }
                    .address-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .action-cell { white-space: nowrap; }
                    .btn-small { padding: 4px 8px; font-size: 12px; margin: 0 2px; }
                    .text-center { text-align: center; }
                    @media (max-width: 768px) {
                        .customer-table th, .customer-table td { font-size: 12px; padding: 6px; }
                        .address-cell { max-width: 120px; }
                    }
                </style>`;
        } catch (error) {
            console.error("showCustomers error:", error);
            alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
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
        
        var isAdmin = AUTH.isAdmin();
        var storeId;
        
        if (isAdmin) {
            storeId = document.getElementById("customerStoreId")?.value;
            if (!storeId) {
                alert(lang === 'id' ? 'Harap pilih toko' : '请选择门店');
                return;
            }
        } else {
            const profile = await SUPABASE.getCurrentProfile();
            storeId = profile?.store_id;
            if (!storeId) {
                alert(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                return;
            }
        }

        if (!name) { alert(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写'); return; }
        if (!phone) { alert(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写'); return; }

        try {
            const profile = await SUPABASE.getCurrentProfile();
            
            const customerData = {
                store_id: storeId,
                name: name,
                ktp_number: ktp || null,
                phone: phone,
                ktp_address: ktpAddress || null,
                address: ktpAddress || null,
                living_same_as_ktp: livingSameAsKtp,
                living_address: livingAddress || null,
                registered_date: new Date().toISOString().split('T')[0],
                created_by: profile.id
            };
            
            const newCustomer = await SUPABASE.createCustomer(customerData);
            
            alert(lang === 'id' ? `Nasabah berhasil ditambahkan! ID: ${newCustomer.customer_id}` : `客户添加成功！ID: ${newCustomer.customer_id}`);
            await this.showCustomers();
        } catch (error) {
            console.error("addCustomer error:", error);
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
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:600px;">
                    <h3>✏️ ${lang === 'id' ? 'Ubah Data Nasabah' : '修改客户信息'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${t('customer_name')} *</label><input id="ec_name" value="${Utils.escapeHtml(c.name)}"></div>
                        <div class="form-group"><label>${t('phone')} *</label><input id="ec_phone" value="${Utils.escapeHtml(c.phone || '')}"></div>
                        <div class="form-group"><label>${t('ktp_number')}</label><input id="ec_ktp" value="${Utils.escapeHtml(c.ktp_number || '')}"></div>
                        <div class="form-group full-width"><label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label><textarea id="ec_ktpAddr" rows="2">${Utils.escapeHtml(c.ktp_address || c.address || '')}</textarea></div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                            <div class="address-option">
                                <label><input type="radio" name="ec_livingOpt" value="same" ${livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                                <label><input type="radio" name="ec_livingOpt" value="different" ${!livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)"> ${lang === 'id' ? 'Berbeda' : '不同'}</label>
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
            
            if (!document.getElementById('modal-styles')) {
                var style = document.createElement('style');
                style.id = 'modal-styles';
                style.textContent = `
                    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
                    .modal-content { background: #ffffff; border-radius: 12px; padding: 24px; width: 100%; max-height: 90vh; overflow-y: auto; }
                `;
                document.head.appendChild(style);
            }
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
                name: name,
                phone: phone,
                ktp_number: ktp || null,
                ktp_address: ktpAddr || null,
                address: ktpAddr || null,
                living_same_as_ktp: livingSame,
                living_address: livingAddr || null,
                updated_at: new Date().toISOString()
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
            const { data: orders, error: ordersError } = await supabaseClient.from('orders').select('id').eq('customer_id', customerId);
            if (ordersError) throw ordersError;
            
            if (orders && orders.length > 0) {
                for (var o of orders) {
                    await supabaseClient.from('payment_history').delete().eq('order_id', o.id);
                }
                await supabaseClient.from('orders').delete().eq('customer_id', customerId);
            }
            
            const { error: customerError } = await supabaseClient.from('customers').delete().eq('id', customerId);
            if (customerError) throw customerError;
            
            alert(lang === 'id' ? 'Nasabah berhasil dihapus' : '客户已删除');
            await this.showCustomers();
        } catch (e) {
            console.error('删除客户异常:', e);
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
            
            const { data: customer, error } = await supabaseClient
                .from('customers')
                .select('*, stores(name, code)')
                .eq('id', customerId)
                .single();
            if (error) throw error;

            this.currentPage = 'createOrder';
            this.currentCustomerId = customerId;
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            
            var stores = await SUPABASE.getAllStores();
            var storeOptions = '';
            for (var store of stores) {
                storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)} (${Utils.escapeHtml(store.code || '-')})</option>`;
            }
            
            var defaultStoreId = customer.store_id;
            
            var storeSelectionHtml = '';
            if (isAdmin) {
                storeSelectionHtml = `
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Pilih Toko' : '选择门店'} *</label>
                        <select id="orderStoreId">
                            ${storeOptions}
                        </select>
                    </div>
                    <script>
                        setTimeout(function() {
                            var select = document.getElementById('orderStoreId');
                            if (select) select.value = '${defaultStoreId}';
                        }, 100);
                    </script>
                `;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📝 ${t('create_order')}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card">
                    <h3>${t('customer_info')}</h3>
                    <div class="customer-info-display">
                        <p><strong>${lang === 'id' ? 'ID Nasabah' : '客户ID'}:</strong> ${Utils.escapeHtml(customer.customer_id || '-')}</p>
                        <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                        <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p>
                        <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                        <p><strong>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}:</strong> ${Utils.escapeHtml(customer.ktp_address || customer.address || '-')}</p>
                        <p><strong>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}:</strong> ${customer.living_same_as_ktp !== false ? (lang === 'id' ? 'Sama KTP' : '同KTP') : Utils.escapeHtml(customer.living_address || '-')}</p>
                        <p><strong>${lang === 'id' ? 'Toko Asal' : '所属门店'}:</strong> ${Utils.escapeHtml(customer.stores?.name || '-')} (${Utils.escapeHtml(customer.stores?.code || '-')})</p>
                    </div>
                    <h3>${t('collateral_info')}</h3>
                    <div class="form-grid">
                        ${storeSelectionHtml}
                        <div class="form-group full-width"><label>${t('collateral_name')} *</label><input id="collateral" placeholder="${t('collateral_name')}"></div>
                        <div class="form-group"><label>${t('loan_amount')} *</label><input type="text" id="amount" placeholder="${t('loan_amount')}" class="amount-input"></div>
                        <div class="form-group full-width"><label>${t('notes')}</label><textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea></div>
                        <div class="form-actions">
                            <button onclick="APP.saveOrderWithCustomer('${customerId}')" class="success">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .customer-info-display { background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
                    .customer-info-display p { margin: 6px 0; }
                    .amount-input { text-align: right; }
                </style>`;
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) {
            console.error("createOrderForCustomer error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
        }
    },

    saveOrderWithCustomer: async function(customerId) {
        var collateral = document.getElementById("collateral").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var notes = document.getElementById("notes").value;
        
        var isAdmin = AUTH.isAdmin();
        var storeId = null;
        if (isAdmin) {
            storeId = document.getElementById("orderStoreId")?.value;
            if (!storeId) {
                alert(Utils.lang === 'id' ? 'Harap pilih toko' : '请选择门店');
                return;
            }
        }
        
        if (!collateral || !amount || amount <= 0) { alert(Utils.t('fill_all_fields')); return; }
        
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            var orderData = {
                customer: { name: customer.name, ktp: customer.ktp_number || '', phone: customer.phone, address: customer.ktp_address || customer.address || '' },
                collateral_name: collateral,
                loan_amount: amount,
                notes: notes,
                customer_id: customerId,
                store_id: storeId
            };
            
            var newOrder = await Order.create(orderData);
            alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
            this.goBack();
        } catch (error) {
            console.error("saveOrderWithCustomer error:", error);
            alert(Utils.lang === 'id' ? 'Gagal menyimpan order: ' + error.message : '保存订单失败：' + error.message);
        }
    },

    showCustomerOrders: async function(customerId) {
        this.currentPage = 'customerOrders';
        this.currentCustomerId = customerId;
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*, stores(name, code)')
                .eq('id', customerId)
                .single();
            const { data: orders, error } = await supabaseClient
                .from('orders')
                .select('*, stores(code, name)')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var rows = orders && orders.length > 0 ? orders.map(o => {
                var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                return `<tr>
                    <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                    <td class="date-cell">${Utils.formatDate(o.created_at)}</td>
                    <td class="text-right">${Utils.formatCurrency(o.loan_amount)}</td>
                    <td class="text-right">${Utils.formatCurrency(o.principal_paid)}</td>
                    <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                    <td class="action-cell">
                        <button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})" class="btn-small">👁️ ${t('view')}</button>
                        ${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})" class="btn-small success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                    </td>
                　　　`;
            }).join('') : `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📋 ${lang === 'id' ? 'Order Nasabah' : '客户订单'} - ${Utils.escapeHtml(customer.name)}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card customer-summary">
                    <p><strong>${lang === 'id' ? 'ID Nasabah' : '客户ID'}:</strong> ${Utils.escapeHtml(customer.customer_id || '-')}</p>
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                    <p><strong>${lang === 'id' ? 'Toko' : '门店'}:</strong> ${Utils.escapeHtml(customer.stores?.name || '-')}</p>
                </div>
                <div class="card">
                    <h3>📋 ${t('order_list')}</h3>
                    <div class="table-container">
                        <table class="order-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th class="text-right">${t('loan_amount')}</th>
                                    <th class="text-right">${lang === 'id' ? 'Pokok Dibayar' : '已还本金'}</th>
                                    <th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                    <th class="text-center">${lang === 'id' ? 'Status' : '状态'}</th>
                                    <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .customer-summary { background: #f8fafc; }
                    .customer-summary p { margin: 6px 0; }
                    .order-table { width: 100%; border-collapse: collapse; }
                    .order-table th, .order-table td { border: 1px solid #cbd5e1; padding: 8px; }
                    .order-table th { background: #f8fafc; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .btn-small { padding: 4px 8px; font-size: 12px; margin: 0 2px; }
                </style>`;
        } catch (error) {
            console.error("showCustomerOrders error:", error);
            alert(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败');
        }
    },

    showCustomerPaymentHistory: async function(customerId) {
        this.currentPage = 'customerPaymentHistory';
        this.currentCustomerId = customerId;
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
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
                ? `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`
                : allPayments.map(p => `<tr>
                    <td class="date-cell">${Utils.formatDate(p.date)}</td>
                    <td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                    <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                　　　`).join('');
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'} - ${Utils.escapeHtml(customer.name)}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card customer-summary">
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                </div>
                <div class="card">
                    <h3>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</h3>
                    <div class="table-container">
                        <table class="payment-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th>
                                    <th>${lang === 'id' ? 'Jenis' : '类型'}</th>
                                    <th>${lang === 'id' ? 'Bulan' : '月数'}</th>
                                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                    <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .customer-summary { background: #f8fafc; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                </style>`;
        } catch (error) {
            console.error("showCustomerPaymentHistory error:", error);
            alert(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败');
        }
    }
};

for (var key in CustomersModule) {
    if (typeof CustomersModule[key] === 'function') {
        window.APP[key] = CustomersModule[key];
    }
}
