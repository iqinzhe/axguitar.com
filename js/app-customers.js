// app-customers.js - v1.8（修复语法错误）

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
            
            const stores = await SUPABASE.getAllStores();
            const storeMap = {};
            for (var s of stores) {
                storeMap[s.id] = s.name;
            }
            
            var baseCols = 7;
            var totalCols = isAdmin ? baseCols + 1 : baseCols;
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = `<tr><td colspan="${totalCols}" class="text-center">${t('no_data')}</td></tr>`;
            } else {
                for (var c of customers) {
                    var customerId = Utils.escapeHtml(c.customer_id || '-');
                    var registeredDate = Utils.formatDate(c.registered_date);
                    var name = Utils.escapeHtml(c.name);
                    var ktpNumber = Utils.escapeHtml(c.ktp_number || '-');
                    var phone = Utils.escapeHtml(c.phone || '-');
                    var ktpAddress = Utils.escapeHtml(c.ktp_address || c.address || '-');
                    var livingAddress = Utils.escapeHtml(c.living_address || (c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : '-'));
                    var storeName = isAdmin ? Utils.escapeHtml(storeMap[c.store_id] || '-') : '';
                    var escapedId = Utils.escapeAttr(c.id);
                    
                    rows += `<tr>
                        <td>${customerId}</td>
                        <td>${name}</td>
                        <td>${ktpNumber}</td>
                        <td>${phone}</td>
                        <td>${ktpAddress}</td>
                        <td>${livingAddress}</td>
                        <td class="text-center">${registeredDate}</td>
                        ${isAdmin ? `<td class="text-center">${storeName}</td>` : ''}
                    </tr>
                    <tr class="action-row">
                        <td class="action-label">${lang === 'id' ? 'Aksi' : '操作'}</td>
                        <td colspan="${totalCols}" class="action-btns">
                            ${!isAdmin ? `<button onclick="APP.createOrderForCustomer('${escapedId}')" class="btn-small success">➕ ${lang === 'id' ? 'Buat Order' : '建立订单'}</button>` : ''}
                            <button onclick="APP.showCustomerOrders('${escapedId}')" class="btn-small">📋 ${lang === 'id' ? 'Lihat Order' : '查看订单'}</button>
                            ${!isAdmin ? `<button onclick="APP.editCustomer('${escapedId}')" class="btn-small">✏️ ${lang === 'id' ? 'Ubah' : '修改'}</button>` : ''}
                            ${PERMISSION.canDeleteCustomer() ? `<button onclick="APP.deleteCustomer('${escapedId}')" class="btn-small danger">🗑️ ${t('delete')}</button>` : ''}
                            ${!isAdmin ? `<button onclick="APP.blacklistCustomer('${escapedId}')" class="btn-small btn-blacklist">🚫 ${lang === 'id' ? 'Blacklist' : '拉黑'}</button>` : ''}
                        </td>
                    </tr>`;
                }
            }

            var addCustomerCardHtml = '';
            if (!isAdmin) {
                addCustomerCardHtml = `
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
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label>
                            <textarea id="customerKtpAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址'}"></textarea>
                        </div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                            <div class="address-option">
                                <label><input type="radio" name="livingAddrOpt" value="same" checked onchange="window.APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                                <label><input type="radio" name="livingAddrOpt" value="different" onchange="window.APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）'}</label>
                            </div>
                            <textarea id="customerLivingAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址'}" style="display:none;margin-top:8px;"></textarea>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP.addCustomer()" class="success">💾 ${lang === 'id' ? 'Simpan Nasabah' : '保存客户'}</button>
                        </div>
                    </div>
                </div>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</h2>
                    <div class="header-actions">                        
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${t('print')}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <colgroup>
                                <col style="width: 12%; min-width: 100px;">
                                <col style="width: 10%; min-width: 80px;">
                                <col style="width: 12%; min-width: 100px;">
                                <col style="width: 10%; min-width: 90px;">
                                <col style="width: 20%; min-width: 150px;">
                                <col style="width: 20%; min-width: 150px;">
                                <col style="width: 10%; min-width: 90px;">
                                ${isAdmin ? '<col style="width: 6%; min-width: 80px;">' : ''}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th>
                                    <th>${t('customer_name')}</th>
                                    <th>${t('ktp_number')}</th>
                                    <th>${t('phone')}</th>
                                    <th>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</th>
                                    <th>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</th>
                                    <th class="text-center">${lang === 'id' ? 'Tanggal Daftar' : '注册日期'}</th>
                                    ${isAdmin ? '<th class="text-center">' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                ${addCustomerCardHtml}`;
            
            this._addDataTableStyles();
            
        } catch (error) {
            console.error("showCustomers error:", error);
            alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
        }
    },
    
    _addDataTableStyles: function() {
        if (document.getElementById('data-table-styles')) return;
        var style = document.createElement('style');
        style.id = 'data-table-styles';
        style.textContent = `
            .data-table .customer-address { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .btn-blacklist { background: #f97316 !important; color: #fff !important; border-color: #ea580c !important; }
            .btn-blacklist:hover { background: #ea580c !important; }
            @media (max-width: 768px) {
                .data-table .customer-address { max-width: 120px; }
            }
        `;
        document.head.appendChild(style);
    },

    blacklistCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = Utils.t;
        
        try {
            const { data: customer, error: customerError } = await supabaseClient
                .from('customers')
                .select('name, customer_id')
                .eq('id', customerId)
                .single();
            
            if (customerError) throw customerError;
            
            var reason = prompt(
                lang === 'id' 
                    ? `Masukkan alasan blacklist untuk nasabah "${customer.name}" (${customer.customer_id}):\n\nContoh: Telat bayar, Penipuan, dll.`
                    : `请输入拉黑客户 "${customer.name}" (${customer.customer_id}) 的原因：\n\n例如：逾期未还、欺诈等。`,
                lang === 'id' ? 'Telat bayar' : '逾期未还'
            );
            
            if (!reason || reason.trim() === '') {
                alert(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
                return;
            }
            
            if (!confirm(lang === 'id' 
                ? `⚠️ Yakin akan blacklist nasabah ini?\n\nNama: ${customer.name}\nID: ${customer.customer_id}\nAlasan: ${reason}\n\nNasabah yang di-blacklist tidak dapat membuat order baru.`
                : `⚠️ 确认拉黑此客户？\n\n客户名: ${customer.name}\n客户ID: ${customer.customer_id}\n原因: ${reason}\n\n被拉黑的客户将无法创建新订单。`)) {
                return;
            }
            
            if (typeof window.APP.addToBlacklist === 'function') {
                await window.APP.addToBlacklist(customerId, reason);
                alert(lang === 'id' 
                    ? `✅ Nasabah "${customer.name}" telah ditambahkan ke blacklist.`
                    : `✅ 客户 "${customer.name}" 已加入黑名单。`);
                await this.showCustomers();
            } else {
                throw new Error(lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
            }
            
        } catch (error) {
            console.error("blacklistCustomer error:", error);
            alert(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + error.message : '拉黑失败：' + error.message);
        }
    },

    toggleLivingAddress: function(value) {
        var el = document.getElementById('customerLivingAddress');
        if (el) el.style.display = value === 'different' ? 'block' : 'none';
    },

    addCustomer: async function() {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (isAdmin) {
            alert(t('store_operation'));
            return;
        }
        
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
            const storeId = profile?.store_id;
            
            if (!storeId) {
                alert(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                return;
            }
            
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
            alert(t('save_failed') + ': ' + error.message);
        }
    },

    editCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (isAdmin) {
            alert(t('store_operation'));
            return;
        }
        
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
                                <label><input type="radio" name="ec_livingOpt" value="same" ${livingSame ? 'checked' : ''} onchange="window.APP._toggleEditLiving(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                                <label><input type="radio" name="ec_livingOpt" value="different" ${!livingSame ? 'checked' : ''} onchange="window.APP._toggleEditLiving(this.value)"> ${lang === 'id' ? 'Berbeda' : '不同'}</label>
                            </div>
                            <textarea id="ec_livingAddr" rows="2" style="margin-top:8px;${livingSame ? 'display:none;' : ''}">${Utils.escapeHtml(c.living_address || '')}</textarea>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP._saveEditCustomer('${Utils.escapeAttr(customerId)}')" class="success">💾 ${t('save')}</button>
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
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (isAdmin) {
            alert(t('store_operation'));
            return;
        }
        
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
        if (!confirm(Utils.t('confirm_delete'))) return;
        
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

    updateServiceFeeDisplay: function() {
        var amountStr = document.getElementById("amount")?.value || "0";
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var percent = parseInt(document.getElementById("serviceFeePercent")?.value) || 0;
        var serviceFee = amount * (percent / 100);
        var displayEl = document.getElementById("serviceFeeDisplay");
        var hiddenInput = document.getElementById("serviceFeeAmount");
        
        if (displayEl) {
            if (percent > 0 && amount > 0) {
                displayEl.innerHTML = `💰 ${Utils.formatCurrency(serviceFee)} ${Utils.lang === 'id' ? '(dibayar sekali)' : '(一次性支付)'}`;
                displayEl.style.display = "block";
                if (hiddenInput) hiddenInput.value = serviceFee;
            } else if (percent > 0 && amount === 0) {
                displayEl.innerHTML = `📝 ${Utils.lang === 'id' ? 'Masukkan jumlah pinjaman terlebih dahulu' : '请先输入贷款金额'}`;
                displayEl.style.display = "block";
                if (hiddenInput) hiddenInput.value = 0;
            } else {
                displayEl.innerHTML = '';
                displayEl.style.display = "none";
                if (hiddenInput) hiddenInput.value = 0;
            }
        }
    },
    
    updateAdminFeeSelect: function() {
        var select = document.getElementById("adminFeeSelect");
        var selectedValue = select?.value;
        var manualContainer = document.getElementById("adminFeeManualContainer");
        var manualInput = document.getElementById("adminFeeManual");
        var hiddenInput = document.getElementById("adminFeeAmount");
        var displayEl = document.getElementById("adminFeeDisplay");
        
        if (selectedValue === "manual") {
            if (manualContainer) manualContainer.style.display = "block";
            if (displayEl) displayEl.style.display = "none";
            if (manualInput) {
                var manualVal = manualInput.value.replace(/[^0-9]/g, '');
                var num = parseInt(manualVal) || 0;
                if (hiddenInput) hiddenInput.value = num;
                if (displayEl) {
                    displayEl.innerHTML = `📋 ${Utils.formatCurrency(num)} ${Utils.lang === 'id' ? '(dibayar sekali)' : '(一次性支付)'}`;
                    if (num > 0) displayEl.style.display = "block";
                }
            }
        } else {
            if (manualContainer) manualContainer.style.display = "none";
            if (hiddenInput) hiddenInput.value = selectedValue || 30000;
            if (displayEl) {
                var fee = parseInt(selectedValue) || 30000;
                displayEl.innerHTML = `📋 ${Utils.formatCurrency(fee)} ${Utils.lang === 'id' ? '(dibayar sekali)' : '(一次性支付)'}`;
                displayEl.style.display = "block";
            }
            if (manualInput) manualInput.value = "";
        }
    },
    
    updateAdminFeeManual: function() {
        var manualInput = document.getElementById("adminFeeManual");
        var hiddenInput = document.getElementById("adminFeeAmount");
        var select = document.getElementById("adminFeeSelect");
        var displayEl = document.getElementById("adminFeeDisplay");
        
        if (manualInput) {
            var num = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(manualInput.value) : parseInt(manualInput.value.replace(/[,\s]/g, '')) || 0;
            if (hiddenInput) hiddenInput.value = num;
            if (select) select.value = "manual";
            if (displayEl) {
                if (num > 0) {
                    displayEl.innerHTML = `📋 ${Utils.formatCurrency(num)} ${Utils.lang === 'id' ? '(dibayar sekali)' : '(一次性支付)'}`;
                    displayEl.style.display = "block";
                } else {
                    displayEl.style.display = "none";
                }
            }
        }
    },

    createOrderForCustomer: async function(customerId) {
        var lang = Utils.lang || 'id';
        
        var t = function(key) {
            if (typeof Utils.t === 'function') {
                return Utils.t(key);
            }
            var fallback = {
                'customer_has_active_order': lang === 'id' ? 'Nasabah ini masih memiliki pesanan aktif.' : '该客户还有未结清的订单。',
                'blacklisted_cannot_order': lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。',
                'fill_all_fields': lang === 'id' ? 'Harap isi semua bidang!' : '请填写所有字段！',
                'save_failed': lang === 'id' ? 'Gagal menyimpan' : '保存失败',
                'create_order': lang === 'id' ? 'Buat Pesanan' : '新建订单',
                'back': lang === 'id' ? 'Kembali' : '返回',
                'customer_info': lang === 'id' ? 'Informasi Pelanggan' : '客户信息',
                'customer_name': lang === 'id' ? 'Nama Lengkap' : '客户姓名',
                'ktp_number': lang === 'id' ? 'Nomor KTP' : 'KTP号码',
                'phone': lang === 'id' ? 'Nomor Telepon' : '手机号',
                'collateral_info': lang === 'id' ? 'Informasi Jaminan' : '典当信息',
                'collateral_name': lang === 'id' ? 'Nama Barang Jaminan' : '质押物名称',
                'loan_amount': lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额',
                'notes': lang === 'id' ? 'Catatan' : '备注',
                'save': lang === 'id' ? 'Simpan' : '保存',
                'cancel': lang === 'id' ? 'Batal' : '取消',
                'flexible_repayment': lang === 'id' ? 'Cicilan Fleksibel' : '灵活还款',
                'fixed_repayment': lang === 'id' ? 'Cicilan Tetap' : '固定还款',
                'repayment_term': lang === 'id' ? 'Jangka Waktu (Bulan)' : '还款期限（月）',
                'monthly_payment': lang === 'id' ? 'Angsuran per Bulan' : '每月还款额',
                'agreed_rate': lang === 'id' ? 'Suku Bunga Kesepakatan' : '协商利率',
                'agreed_service_fee': lang === 'id' ? 'Biaya Layanan Kesepakatan' : '协商服务费',
                'cash': lang === 'id' ? 'Tunai' : '现金',
                'bank': lang === 'id' ? 'Bank BNI' : '银行BNI'
            };
            return fallback[key] || key;
        };

        var profile = null;
        try {
            profile = await SUPABASE.getCurrentProfile();
        } catch(e) {
            console.error('获取用户资料失败:', e);
            alert(lang === 'id' ? 'Gagal memuat data user' : '加载用户数据失败');
            return;
        }

        var isAdmin = profile?.role === 'admin';

        if (isAdmin) {
            alert(lang === 'id' ? 'Operasi ini hanya untuk operator toko' : '此操作仅限门店操作员');
            return;
        }

        if (!customerId) {
            alert(lang === 'id' ? 'ID nasabah tidak valid' : '客户ID无效');
            return;
        }

        try {
            const { data: customer, error: customerError } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            if (customerError || !customer) {
                throw new Error(lang === 'id' ? 'Data nasabah tidak ditemukan' : '找不到客户数据');
            }

            var blacklistCheck = { isBlacklisted: false };
            try {
                const { data: blData } = await supabaseClient
                    .from('blacklist')
                    .select('id, reason')
                    .eq('customer_id', customerId)
                    .maybeSingle();
                blacklistCheck = blData ? { isBlacklisted: true, reason: blData.reason } : { isBlacklisted: false };
            } catch(blErr) {
                console.warn('黑名单检查失败:', blErr.message);
            }

            if (blacklistCheck && blacklistCheck.isBlacklisted) {
                alert(t('blacklisted_cannot_order'));
                return;
            }

            try {
                const { data: existingOrders } = await supabaseClient
                    .from('orders')
                    .select('status')
                    .eq('customer_id', customerId)
                    .eq('status', 'active');
                if (existingOrders && existingOrders.length > 0) {
                    alert(t('customer_has_active_order'));
                    return;
                }
            } catch(ordErr) {
                console.warn('活跃订单检查失败:', ordErr.message);
            }

            this.currentPage = 'createOrder';
            this.currentCustomerId = customerId;

            var userStoreName = '-';
            var userStoreCode = '-';
            
            if (profile && profile.stores) {
                userStoreName = profile.stores.name || (lang === 'id' ? 'Toko tidak diketahui' : '未知门店');
                userStoreCode = profile.stores.code || '-';
            } else if (profile && profile.store_id) {
                try {
                    const { data: storeData } = await supabaseClient
                        .from('stores')
                        .select('name, code')
                        .eq('id', profile.store_id)
                        .single();
                    if (storeData) {
                        userStoreName = storeData.name || (lang === 'id' ? 'Toko tidak diketahui' : '未知门店');
                        userStoreCode = storeData.code || '-';
                    }
                } catch(e) {
                    userStoreName = lang === 'id' ? 'Toko tidak diketahui' : '未知门店';
                    userStoreCode = '-';
                }
            } else {
                userStoreName = lang === 'id' ? 'Toko tidak diketahui' : '未知门店';
                userStoreCode = '-';
            }
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📝 ${t('create_order')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
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
                    </div>
                    
                    <div class="store-info-banner">
                        <span>🏪 ${lang === 'id' ? 'Order akan dibuat untuk toko' : '订单将创建在门店'}: <strong>${Utils.escapeHtml(userStoreName)} (${Utils.escapeHtml(userStoreCode)})</strong></span>
                    </div>
                    
                    <h3>${t('collateral_info')}</h3>
                    <div class="form-grid two-col-grid">
                        <div class="form-group">
                            <label>${t('collateral_name')} *</label>
                            <input id="collateral" placeholder="${t('collateral_name')}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Keterangan Barang' : '物品备注'}</label>
                            <input id="collateralNote" placeholder="${lang === 'id' ? 'Contoh: emas 24k, kondisi baik, tahun 2020' : '例如: 24k金, 状况良好, 2020年'}">
                            <small style="color:#64748b;">${lang === 'id' ? 'Warna, kondisi, tahun, dll.' : '成色、状况、年份等'}</small>
                        </div>
                        
                        <div class="form-group">
                            <label>${t('loan_amount')} *</label>
                            <input type="text" id="amount" placeholder="${t('loan_amount')}" class="amount-input" oninput="window.APP.calculateFixedPayment()">
                        </div>
                        
                        <div class="repayment-type-group">
                            <label class="repayment-type-label">${lang === 'id' ? '📋 Pilih Jenis Cicilan' : '📋 选择还款方式'}:</label>
                            <div class="repayment-type-options">
                                <label class="repayment-option">
                                    <input type="radio" name="repaymentType" value="flexible" checked onchange="window.APP.toggleRepaymentForm(this.value)">
                                    <span class="option-title">💰 ${t('flexible_repayment')}</span>
                                    <span class="option-desc">${lang === 'id' ? 'Bunga 8%/bulan, bayar bunga dulu, pokok bisa kapan saja' : '利息8%/月，先付利息，本金随时可还'}</span>
                                </label>
                                <label class="repayment-option">
                                    <input type="radio" name="repaymentType" value="fixed" onchange="window.APP.toggleRepaymentForm(this.value)">
                                    <span class="option-title">📅 ${t('fixed_repayment')}</span>
                                    <span class="option-desc">${lang === 'id' ? 'Angsuran tetap per bulan (bunga + pokok), tenor 3-10 bulan' : '每月固定还款（本金+利息），期限3-10个月'}</span>
                                </label>
                            </div>
                        </div>
                        
                        <div id="fixedRepaymentForm" style="display:none;" class="fixed-repayment-form">
                            <div class="form-group">
                                <label>📅 ${t('repayment_term')}</label>
                                <select id="repaymentTerm" class="repayment-term-select" onchange="window.APP.calculateFixedPayment()">
                                    <option value="3">3 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="4">4 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="5" selected>5 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="6">6 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="7">7 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="8">8 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="9">9 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                    <option value="10">10 ${lang === 'id' ? 'bulan' : '个月'}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>💰 ${t('monthly_payment')}</label>
                                <div id="monthlyPaymentDisplay" class="monthly-payment-display">-</div>
                                <small>${lang === 'id' ? 'Jumlah tetap yang harus dibayar setiap bulan' : '每月需支付的固定金额'}</small>
                            </div>
                        </div>
                        
                        <div class="negotiation-form">
                            <div class="form-group">
                                <label>📈 ${t('agreed_rate')}</label>
                                <div class="rate-input-group">
                                    <input type="number" id="agreedInterestRate" value="8" step="0.5" min="3" max="10" style="width:100px;" onchange="window.APP.calculateFixedPayment()">
                                    <span>%</span>
                                    <small style="margin-left:10px;">${lang === 'id' ? 'Default 8%, bisa dinegosiasi 3-10%' : '默认8%，可协商3-10%'}</small>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>✨ ${t('agreed_service_fee')}</label>
                                <div class="rate-input-group">
                                    <input type="number" id="agreedServiceFee" value="2" step="0.5" min="0" max="5" style="width:100px;">
                                    <span>%</span>
                                    <small style="margin-left:10px;">${lang === 'id' ? 'Default 2%, bisa dinegosiasi 0-5%' : '默认2%，可协商0-5%'}</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>💰 ${lang === 'id' ? 'Sumber Dana Pinjaman' : '贷款资金来源'}</label>
                            <div class="payment-method-options">
                                <label><input type="radio" name="loanSource" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="loanSource" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        
                        <div class="form-group full-width">
                            <label>${t('notes')}</label>
                            <textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button onclick="APP.saveOrderWithCustomer('${Utils.escapeAttr(customerId)}')" class="success">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>
                
                <style>
                    .repayment-type-group { grid-column: span 2; margin: 12px 0; padding: 12px; background: var(--gray-50); border-radius: 12px; }
                    .repayment-type-label { font-weight: 600; margin-bottom: 10px; display: block; color: var(--gray-700); }
                    .repayment-type-options { display: flex; gap: 20px; flex-wrap: wrap; }
                    .repayment-option { flex: 1; min-width: 200px; padding: 12px; border: 2px solid var(--gray-300); border-radius: 10px; cursor: pointer; transition: all 0.2s; background: white; }
                    .repayment-option:hover { border-color: var(--primary); background: var(--primary-light); }
                    .repayment-option input { margin-right: 8px; }
                    .repayment-option .option-title { font-weight: 700; display: inline-block; margin-bottom: 4px; }
                    .repayment-option .option-desc { display: block; font-size: 11px; color: var(--gray-500); margin-top: 4px; }
                    .fixed-repayment-form { grid-column: span 2; padding: 12px; background: #f0fdf4; border-radius: 10px; margin: 8px 0; }
                    .monthly-payment-display { font-size: 18px; font-weight: 700; color: var(--success); background: white; padding: 8px 12px; border-radius: 8px; display: inline-block; }
                    .negotiation-form { grid-column: span 2; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; background: #fef3c7; border-radius: 10px; margin: 8px 0; }
                    .rate-input-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
                    .rate-input-group input { text-align: center; }
                    @media (max-width: 768px) { .repayment-type-options { flex-direction: column; } .negotiation-form { grid-template-columns: 1fr; } }
                </style>`;
            
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
            
            this.calculateFixedPayment();
            
        } catch (error) {
            console.error("createOrderForCustomer 错误:", error);
            alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
        }
    },

    toggleRepaymentForm: function(value) {
        var fixedForm = document.getElementById('fixedRepaymentForm');
        if (fixedForm) fixedForm.style.display = value === 'fixed' ? 'block' : 'none';
        if (value === 'fixed') this.calculateFixedPayment();
    },

    calculateFixedPayment: function() {
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var termSelect = document.getElementById('repaymentTerm');
        var months = termSelect ? parseInt(termSelect.value) : 5;
        var rateInput = document.getElementById('agreedInterestRate');
        var monthlyRate = rateInput ? (parseFloat(rateInput.value) || 8) / 100 : 0.08;
        
        var displayEl = document.getElementById('monthlyPaymentDisplay');
        if (displayEl) {
            if (amount > 0 && months > 0) {
                var monthlyPayment = Utils.calculateFixedMonthlyPayment(amount, monthlyRate, months);
                displayEl.innerHTML = Utils.formatCurrency(monthlyPayment);
                displayEl.style.color = '#10b981';
            } else {
                displayEl.innerHTML = amount === 0 ? (Utils.lang === 'id' ? 'Masukkan jumlah pinjaman' : '请输入贷款金额') : '-';
                displayEl.style.color = '#64748b';
            }
        }
    },

    saveOrderWithCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = Utils.t;
        var collateral = document.getElementById("collateral").value.trim();
        var collateralNote = document.getElementById("collateralNote").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var notes = document.getElementById("notes").value;
        
        var agreedInterestRate = parseFloat(document.getElementById("agreedInterestRate")?.value) || 8;
        var agreedServiceFee = parseFloat(document.getElementById("agreedServiceFee")?.value) || 2;
        
        var repaymentTypeRadio = document.querySelector('input[name="repaymentType"]:checked');
        var repaymentType = repaymentTypeRadio ? repaymentTypeRadio.value : 'flexible';
        var repaymentTerm = null;
        
        if (repaymentType === 'fixed') {
            repaymentTerm = parseInt(document.getElementById("repaymentTerm")?.value) || 5;
        }
        
        var loanSource = document.querySelector('input[name="loanSource"]:checked')?.value || 'cash';
        var fullCollateralName = collateralNote ? `${collateral} (${collateralNote})` : collateral;
        
        if (!collateral || !amount || amount <= 0) { alert(t('fill_all_fields')); return; }
        
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            var blacklistCheck = null;
            const { data } = await supabaseClient
                .from('blacklist')
                .select('id')
                .eq('customer_id', customerId)
                .maybeSingle();
            blacklistCheck = data ? { isBlacklisted: true } : { isBlacklisted: false };
            
            if (blacklistCheck && blacklistCheck.isBlacklisted) {
                alert(t('blacklisted_cannot_order'));
                return;
            }
            
            var orderData = {
                customer: { 
                    name: customer.name, 
                    ktp: customer.ktp_number || '', 
                    phone: customer.phone, 
                    address: customer.ktp_address || customer.address || '' 
                },
                collateral_name: fullCollateralName,
                loan_amount: amount,
                notes: notes,
                customer_id: customerId,
                store_id: null,
                admin_fee: 30000,
                service_fee_percent: agreedServiceFee,
                agreed_interest_rate: agreedInterestRate,
                repayment_type: repaymentType,
                repayment_term: repaymentTerm
            };
            
            var newOrder = await Order.create(orderData);
            
            if (agreedServiceFee > 0) {
                try {
                    await Order.recordServiceFee(newOrder.order_id, 1, loanSource);
                } catch (serviceFeeError) {
                    console.error("服务费收取失败:", serviceFeeError);
                }
            }
            
            try {
                await Order.recordAdminFee(newOrder.order_id, loanSource, 30000);
            } catch (adminFeeError) {
                console.error("管理费收取失败:", adminFeeError);
            }
            
            if (amount > 0) {
                try {
                    await Order.recordLoanDisbursement(newOrder.order_id, amount, loanSource, 
                        lang === 'id' ? `Pencairan pinjaman dari ${loanSource === 'cash' ? 'Brankas' : 'Bank BNI'}` : `贷款发放自 ${loanSource === 'cash' ? '保险柜' : '银行BNI'}`);
                } catch (loanError) {
                    console.error("贷款发放记录失败:", loanError);
                }
            }
            
            var monthlyPayment = repaymentType === 'fixed' 
                ? Utils.calculateFixedMonthlyPayment(amount, agreedInterestRate / 100, repaymentTerm)
                : null;
            
            var successMsg = repaymentType === 'fixed'
                ? (lang === 'id' 
                    ? `✅ Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrder.order_id}\nJenis: Cicilan Tetap\nTenor: ${repaymentTerm} bulan\nAngsuran per bulan: ${Utils.formatCurrency(monthlyPayment)}\nBunga: ${agreedInterestRate}%\nService Fee: ${agreedServiceFee}%`
                    : `✅ 订单创建成功！\n\n订单号: ${newOrder.order_id}\n还款方式: 固定还款\n期限: ${repaymentTerm}个月\n每月还款: ${Utils.formatCurrency(monthlyPayment)}\n利率: ${agreedInterestRate}%\n服务费: ${agreedServiceFee}%`)
                : (lang === 'id'
                    ? `✅ Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrder.order_id}\nJenis: Cicilan Fleksibel\nBunga: ${agreedInterestRate}%\nService Fee: ${agreedServiceFee}%\nMaksimal perpanjangan hingga 10 bulan`
                    : `✅ 订单创建成功！\n\n订单号: ${newOrder.order_id}\n还款方式: 灵活还款\n利率: ${agreedInterestRate}%\n服务费: ${agreedServiceFee}%\n最长可延期至10个月`);
            
            alert(successMsg);
            
            if (typeof window.APP !== 'undefined' && typeof window.APP.goBack === 'function') {
                window.APP.goBack();
            } else {
                window.location.reload();
            }
        } catch (error) {
            console.error("saveOrderWithCustomer error:", error);
            alert(t('save_failed') + ': ' + error.message);
        }
    },

    showCustomerOrders: async function(customerId) {
        this.currentPage = 'customerOrders';
        this.currentCustomerId = customerId;
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = Utils.t;
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            const { data: orders, error } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var rows = orders && orders.length > 0 ? orders.map(o => {
                var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                var repaymentTypeText = o.repayment_type === 'fixed' 
                    ? (lang === 'id' ? 'Tetap' : '固定') 
                    : (lang === 'id' ? 'Fleksibel' : '灵活');
                return `<tr>
                    <td data-label="${t('order_id')}" class="order-id">${Utils.escapeHtml(o.order_id)}<\/td>
                    <td data-label="${lang === 'id' ? 'Tanggal' : '日期'}" class="date-cell">${Utils.formatDate(o.created_at)}<\/td>
                    <td data-label="${t('loan_amount')}" class="text-right">${Utils.formatCurrency(o.loan_amount)}<\/td>
                    <td data-label="${lang === 'id' ? 'Pokok Dibayar' : '已还本金'}" class="text-right">${Utils.formatCurrency(o.principal_paid)}<\/td>
                    <td data-label="${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}" class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}<\/td>
                    <td data-label="${lang === 'id' ? 'Jenis' : '方式'}" class="text-center"><span class="repayment-badge ${o.repayment_type === 'fixed' ? 'badge-fixed' : 'badge-flexible'}">${repaymentTypeText}<\/span><\/td>
                    <td data-label="${t('status')}" class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}<\/span><\/td>
                <\/tr>
                <tr class="action-row"><td class="action-label">${lang === 'id' ? 'Aksi' : '操作'}</td><td colspan="7" class="action-btns">
                        ${o.status === 'active' && !AUTH.isAdmin() ? `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeAttr(o.order_id)}'})" class="btn-small success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                        <button onclick="APP.navigateTo('viewOrder',{orderId:'${Utils.escapeAttr(o.order_id)}'})" class="btn-small">👁️ ${t('view')}<\/button>
                    <\/td><\/tr>`;
            }).join('') : `<tr><td colspan="8" class="text-center">${t('no_data')}<\/td><\/tr>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📋 ${lang === 'id' ? 'Order Nasabah' : '客户订单'} - ${Utils.escapeHtml(customer.name)}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card customer-summary">
                    <p><strong>${lang === 'id' ? 'ID Nasabah' : '客户ID'}:</strong> ${Utils.escapeHtml(customer.customer_id || '-')}</p>
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                </div>
                
                <div class="card">
                    <h3>📋 ${t('order_list')}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>ID</th><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th class="text-right">${t('loan_amount')}</th><th class="text-right">${lang === 'id' ? 'Pokok Dibayar' : '已还本金'}</th><th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th><th class="text-center">${lang === 'id' ? 'Jenis' : '方式'}</th><th class="text-center">${lang === 'id' ? 'Status' : '状态'}</th><th class="text-center">${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead>
                            <tbody>${rows}</tbody>
                        <\/table>
                    </div>
                </div>
                
                <style>.repayment-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-fixed{background:#d1fae5;color:#065f46}.badge-flexible{background:#fed7aa;color:#9a3412}</style>`;
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
        var t = Utils.t;
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
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', service_fee: lang === 'id' ? 'Service Fee' : '服务费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            var rows = allPayments.length === 0
                ? `<td><td colspan="7" class="text-center">${t('no_data')}<\/td><\/tr>`
                : allPayments.map(p => `<tr>
                    <td data-label="${t('date')}" class="date-cell">${Utils.formatDate(p.date)}<\/td>
                    <td data-label="${t('order_id')}" class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}<\/td>
                    <td data-label="${t('type')}">${typeMap[p.type] || p.type}<\/td>
                    <td data-label="${lang === 'id' ? 'Bulan' : '月数'}" class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}<\/td>
                    <td data-label="${t('amount')}" class="text-right">${Utils.formatCurrency(p.amount)}<\/td>
                    <td data-label="${lang === 'id' ? 'Metode' : '支付方式'}" class="text-center"><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}<\/span><\/td>
                    <td data-label="${t('description')}">${Utils.escapeHtml(p.description || '-')}<\/td>
                <\/tr>`).join('');
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'} - ${Utils.escapeHtml(customer.name)}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card customer-summary">
                    <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p>
                    <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p>
                </div>
                
                <div class="card">
                    <h3>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead><tr><th>${t('date')}</th><th>${t('order_id')}</th><th>${t('type')}</th><th class="text-center">${lang === 'id' ? 'Bulan' : '月数'}</th><th class="text-right">${t('amount')}</th><th class="text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${t('description')}</th></tr></thead>
                            <tbody>${rows}</tbody>
                        <\/table>
                    </div>
                </div>`;
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

window.APP.updateServiceFeeDisplay = CustomersModule.updateServiceFeeDisplay;
window.APP.updateAdminFeeSelect = CustomersModule.updateAdminFeeSelect;
window.APP.updateAdminFeeManual = CustomersModule.updateAdminFeeManual;
window.APP.toggleRepaymentForm = CustomersModule.toggleRepaymentForm;
window.APP.calculateFixedPayment = CustomersModule.calculateFixedPayment;
window.APP.toggleLivingAddress = CustomersModule.toggleLivingAddress;
window.APP._toggleEditLiving = CustomersModule._toggleEditLiving;
window.APP._saveEditCustomer = CustomersModule._saveEditCustomer;
