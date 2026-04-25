// app-customers.js - v3.0（重构创建订单页面：三卡片布局、费用卡片统合、保存后清空表单）

window.APP = window.APP || {};

const CustomersModule = {

    showCustomers: async function() {
        APP.currentPage = 'customers';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var isAdmin = AUTH.isAdmin();

        try {
            const customers = await SUPABASE.getCustomers();
            
            const stores = await SUPABASE.getAllStores();
            const storeMap = {};
            for (var i = 0; i < stores.length; i++) {
                storeMap[stores[i].id] = stores[i].name;
            }
            
            var baseCols = 7;
            var totalCols = isAdmin ? baseCols + 1 : baseCols;
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = '<tr><td colspan="' + totalCols + '" class="text-center">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < customers.length; i++) {
                    var c = customers[i];
                    var customerId = Utils.escapeHtml(c.customer_id || '-');
                    var registeredDate = Utils.formatDate(c.registered_date);
                    var name = Utils.escapeHtml(c.name);
                    var ktpNumber = Utils.escapeHtml(c.ktp_number || '-');
                    var phone = Utils.escapeHtml(c.phone || '-');
                    var ktpAddress = Utils.escapeHtml(c.ktp_address || c.address || '-');
                    var livingAddress = Utils.escapeHtml(c.living_address || (c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : '-'));
                    var storeName = isAdmin ? Utils.escapeHtml(storeMap[c.store_id] || '-') : '';
                    var escapedId = Utils.escapeAttr(c.id);
                    
                    rows += '<tr>' +
                        '<td>' + customerId + '<\/td>' +
                        '<td>' + name + '<\/td>' +
                        '<td>' + ktpNumber + '<\/td>' +
                        '<td>' + phone + '<\/td>' +
                        '<td>' + ktpAddress + '<\/td>' +
                        '<td>' + livingAddress + '<\/td>' +
                        '<td class="text-center">' + registeredDate + '<\/td>' +
                        (isAdmin ? '<td class="text-center">' + storeName + '<\/td>' : '') +
                    '<\/tr>';
                    
                    var actionButtons = '';
                    
                    if (!isAdmin) {
                        actionButtons += '<button onclick="APP.createOrderForCustomer(\'' + escapedId + '\')" class="btn-small success">➕ ' + (lang === 'id' ? 'Buat Order' : '建立订单') + '</button>';
                    }
                    
                    actionButtons += '<button onclick="APP.showCustomerOrders(\'' + escapedId + '\')" class="btn-small">📋 ' + (lang === 'id' ? 'Lihat Order' : '查看订单') + '</button>';
                    
                    if (isAdmin) {
                        actionButtons += '<button onclick="APP.editCustomer(\'' + escapedId + '\')" class="btn-small">✏️ ' + (lang === 'id' ? 'Ubah' : '修改') + '</button>';
                    }
                    
                    if (isAdmin) {
                        actionButtons += '<button onclick="APP.deleteCustomer(\'' + escapedId + '\')" class="btn-small danger">🗑️ ' + t('delete') + '</button>';
                    }
                    
                    if (!isAdmin) {
                        actionButtons += '<button onclick="APP.blacklistCustomer(\'' + escapedId + '\')" class="btn-small btn-blacklist">🚫 ' + (lang === 'id' ? 'Blacklist' : '拉黑') + '</button>';
                    }
                    
                    if (isAdmin) {
                        actionButtons += '<button onclick="APP.removeCustomerFromBlacklist(\'' + escapedId + '\')" class="btn-small warning">🔓 ' + (lang === 'id' ? 'Buka Blacklist' : '解除拉黑') + '</button>';
                    }
                    
                    rows += Utils.renderActionRow({
                        colspan: totalCols,
                        buttonsHtml: actionButtons
                    });
                }
            }

            var addCustomerCardHtml = '';
            if (!isAdmin) {
                addCustomerCardHtml = '' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Tambah Nasabah Baru' : '新增客户') + '</h3>' +
                    '<div class="form-grid form-grid-three-col">' +
                        '<div class="form-group">' +
                            '<label>' + t('customer_name') + ' *</label>' +
                            '<input type="text" id="customerName" placeholder="' + t('customer_name') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + t('phone') + ' *</label>' +
                            '<input type="text" id="customerPhone" placeholder="' + t('phone') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + t('ktp_number') + '</label>' +
                            '<input type="text" id="customerKtp" placeholder="' + t('ktp_number') + '">' +
                        '</div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + '</label>' +
                            '<textarea id="customerKtpAddress" rows="2" placeholder="' + (lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址') + '"></textarea>' +
                        '</div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + '</label>' +
                            '<div class="address-option address-option-inline">' +
                                '<label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ' + (lang === 'id' ? 'Sama dengan KTP' : '同上KTP') + '</label>' +
                                '<label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ' + (lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）') + '</label>' +
                            '</div>' +
                            '<textarea id="customerLivingAddress" rows="2" placeholder="' + (lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址') + '" style="display:none;margin-top:8px;"></textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP.addCustomer()" class="success" id="addCustomerBtn">💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>👥 ' + (lang === 'id' ? 'Data Nasabah' : '客户信息') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ' + t('print') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Daftar Nasabah' : '客户列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table customer-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                                    '<th>' + t('customer_name') + '</th>' +
                                    '<th>' + t('ktp_number') + '</th>' +
                                    '<th>' + t('phone') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Tanggal Daftar' : '注册日期') + '</th>' +
                                    (isAdmin ? '<th class="text-center">' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : '') +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                addCustomerCardHtml;
            
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
        style.textContent = '' +
            '.customer-table th, .customer-table td { padding: 8px 6px; font-size: 0.75rem; }' +
            '.customer-table th:nth-child(1), .customer-table td:nth-child(1) { width: 90px; min-width: 80px; }' +
            '.customer-table th:nth-child(2), .customer-table td:nth-child(2) { width: 120px; min-width: 100px; }' +
            '.customer-table th:nth-child(3), .customer-table td:nth-child(3) { width: 130px; min-width: 110px; }' +
            '.customer-table th:nth-child(4), .customer-table td:nth-child(4) { width: 110px; min-width: 90px; }' +
            '.customer-table th:nth-child(5), .customer-table td:nth-child(5) { width: auto; min-width: 140px; max-width: 220px; word-break: break-word; white-space: normal; }' +
            '.customer-table th:nth-child(6), .customer-table td:nth-child(6) { width: auto; min-width: 140px; max-width: 220px; word-break: break-word; white-space: normal; }' +
            '.customer-table th:nth-child(7), .customer-table td:nth-child(7) { width: 90px; min-width: 80px; white-space: nowrap; }' +
            '.address-option-inline { display: flex; gap: 24px; flex-wrap: nowrap; }' +
            '.address-option-inline label { white-space: nowrap; }' +
            '.btn-blacklist { background: #f97316 !important; color: #fff !important; border-color: #ea580c !important; }' +
            '.btn-blacklist:hover { background: #ea580c !important; }' +
            '.fee-calc-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }' +
            '.fee-calc-row .fee-label { min-width: 60px; font-weight: 600; font-size: 0.8rem; }' +
            '.fee-calc-row input { width: 150px; }' +
            '.fee-calc-row select { width: auto; min-width: 80px; }' +
            '.max-extension-config { margin-top: 10px; padding: 8px 12px; background: #f8fafc; border-radius: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }' +
            '.max-extension-config label { font-size: 0.8rem; font-weight: 600; color: #475569; white-space: nowrap; }' +
            '.max-extension-config select { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; }' +
            '@media (max-width: 768px) { ' +
                '.customer-table th, .customer-table td { font-size: 0.7rem; padding: 6px 4px; } ' +
                '.address-option-inline { flex-direction: column; gap: 8px; } ' +
                '.fee-calc-row { flex-direction: column; align-items: flex-start; } ' +
                '.fee-calc-row input { width: 100%; } ' +
                '.max-extension-config { flex-direction: column; align-items: flex-start; } ' +
            '}';
        document.head.appendChild(style);
    },

    removeCustomerFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        
        if (!confirm(lang === 'id' ? 'Yakin ingin membuka blacklist nasabah ini?' : '确认解除此客户的拉黑？')) return;
        
        try {
            await window.APP.removeFromBlacklist(customerId);
            alert(lang === 'id' ? '✅ Blacklist berhasil dibuka' : '✅ 已解除拉黑');
            await APP.showCustomers();
        } catch (error) {
            var errMsg = error.message || error.details || error.code || JSON.stringify(error);
            alert(lang === 'id' ? 'Gagal membuka blacklist: ' + errMsg : '解除拉黑失败：' + errMsg);
        }
    },

    blacklistCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = Utils.t;
        
        try {
            const { data: customer, error: customerError } = await supabaseClient
                .from('customers')
                .select('id, name, customer_id, store_id')
                .eq('id', customerId)
                .single();
            
            if (customerError) {
                console.error("获取客户信息失败:", customerError);
                alert(lang === 'id' ? 'Gagal mendapatkan data nasabah' : '获取客户信息失败');
                return;
            }
            
            var reason = prompt(
                lang === 'id' 
                    ? 'Masukkan alasan blacklist untuk nasabah "' + customer.name + '" (' + customer.customer_id + '):\n\nContoh: Telat bayar, Penipuan, dll.'
                    : '请输入拉黑客户 "' + customer.name + '" (' + customer.customer_id + ') 的原因：\n\n例如：逾期未还、欺诈等。',
                lang === 'id' ? 'Telat bayar' : '逾期未还'
            );
            
            if (!reason || reason.trim() === '') {
                alert(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
                return;
            }
            
            if (!confirm(lang === 'id' 
                ? '⚠️ Yakin akan blacklist nasabah ini?\n\nNama: ' + customer.name + '\nID: ' + customer.customer_id + '\nAlasan: ' + reason + '\n\nNasabah yang di-blacklist tidak dapat membuat order baru.'
                : '⚠️ 确认拉黑此客户？\n\n客户名: ' + customer.name + '\n客户ID: ' + customer.customer_id + '\n原因: ' + reason + '\n\n被拉黑的客户将无法创建新订单。')) {
                return;
            }
            
            if (typeof window.APP.addToBlacklist === 'function') {
                await window.APP.addToBlacklist(customer.id, reason);
                alert(lang === 'id' 
                    ? '✅ Nasabah "' + customer.name + '" telah ditambahkan ke blacklist.'
                    : '✅ 客户 "' + customer.name + '" 已加入黑名单。');
                await APP.showCustomers();
            } else {
                throw new Error(lang === 'id' ? 'Modul blacklist belum dimuat' : '黑名单模块未加载');
            }
            
        } catch (error) {
            var errMsg = error.message || error.details || error.code || JSON.stringify(error);
            console.error("blacklistCustomer error:", error);
            alert(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + errMsg : '拉黑失败：' + errMsg);
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
        
        var addBtn = document.getElementById('addCustomerBtn');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
        }
        
        var name = document.getElementById("customerName").value.trim();
        var ktp = document.getElementById("customerKtp").value.trim();
        var phone = document.getElementById("customerPhone").value.trim();
        var ktpAddress = document.getElementById("customerKtpAddress").value.trim();
        var livingOpt = document.querySelector('input[name="livingAddrOpt"]:checked')?.value || 'same';
        var livingSameAsKtp = livingOpt === 'same';
        var livingAddress = livingSameAsKtp ? null : document.getElementById("customerLivingAddress").value.trim();

        if (!name) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); }
            alert(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写');
            return;
        }
        if (!phone) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); }
            alert(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写');
            return;
        }

        try {
            const profile = await SUPABASE.getCurrentProfile();
            const storeId = profile?.store_id;
            
            if (!storeId) {
                if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); }
                alert(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                return;
            }
            
            let maxRetries = 5;
            let lastError = null;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const prefix = await SUPABASE._getStorePrefix(storeId);
                    
                    const { data: customers, error: queryError } = await supabaseClient
                        .from('customers')
                        .select('customer_id')
                        .like('customer_id', prefix + '%')
                        .order('customer_id', { ascending: false })
                        .limit(1);
                    
                    if (queryError) {
                        console.warn("查询最大客户ID失败:", queryError);
                    }
                    
                    let maxNumber = 0;
                    if (customers && customers.length > 0) {
                        const match = customers[0].customer_id.match(new RegExp(prefix + '(\\d{3})$'));
                        if (match) {
                            maxNumber = parseInt(match[1], 10);
                        }
                    }
                    
                    const nextNumber = maxNumber + 1;
                    const serial = String(nextNumber).padStart(3, '0');
                    const customerId = prefix + serial;
                    
                    const customerData = {
                        customer_id: customerId,
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
                    
                    const { data, error } = await supabaseClient
                        .from('customers')
                        .insert(customerData)
                        .select()
                        .single();
                    
                    if (error) {
                        if (error.code === '23505') {
                            console.warn(`客户ID ${customerId} 已存在，重试第 ${attempt + 1} 次`);
                            lastError = error;
                            continue;
                        }
                        throw error;
                    }
                    
                    if (addBtn) {
                        addBtn.disabled = false;
                        addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户');
                    }
                    alert(lang === 'id' ? 'Nasabah berhasil ditambahkan! ID: ' + customerId : '客户添加成功！ID: ' + customerId);
                    await APP.showCustomers();
                    return;
                    
                } catch (err) {
                    if (err.code === '23505' && attempt < maxRetries - 1) {
                        continue;
                    }
                    throw err;
                }
            }
            
            throw lastError || new Error(lang === 'id' ? 'Gagal menghasilkan ID nasabah unik' : '无法生成唯一的客户ID');
            
        } catch (error) {
            if (addBtn) { 
                addBtn.disabled = false; 
                addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); 
            }
            console.error("addCustomer error:", error);
            var errMsg = error.message || error.details || error.code || (lang === 'id' ? 'Gagal menyimpan' : '保存失败');
            alert(lang === 'id' ? 'Gagal menyimpan: ' + errMsg : '保存失败：' + errMsg);
        }
    },

    editCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (!isAdmin) {
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
            modal.innerHTML = '' +
                '<div class="modal-content" style="max-width:600px;">' +
                    '<h3>✏️ ' + (lang === 'id' ? 'Ubah Data Nasabah' : '修改客户信息') + '</h3>' +
                    '<div class="form-grid form-grid-three-col">' +
                        '<div class="form-group"><label>' + t('customer_name') + ' *</label><input id="ec_name" value="' + Utils.escapeHtml(c.name) + '"></div>' +
                        '<div class="form-group"><label>' + t('phone') + ' *</label><input id="ec_phone" value="' + Utils.escapeHtml(c.phone || '') + '"></div>' +
                        '<div class="form-group"><label>' + t('ktp_number') + '</label><input id="ec_ktp" value="' + Utils.escapeHtml(c.ktp_number || '') + '"></div>' +
                        '<div class="form-group full-width"><label>' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + '</label><textarea id="ec_ktpAddr" rows="2">' + Utils.escapeHtml(c.ktp_address || c.address || '') + '</textarea></div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + '</label>' +
                            '<div class="address-option address-option-inline">' +
                                '<label><input type="radio" name="ec_livingOpt" value="same" ' + (livingSame ? 'checked' : '') + ' onchange="APP._toggleEditLiving(this.value)"> ' + (lang === 'id' ? 'Sama dengan KTP' : '同上KTP') + '</label>' +
                                '<label><input type="radio" name="ec_livingOpt" value="different" ' + (!livingSame ? 'checked' : '') + ' onchange="APP._toggleEditLiving(this.value)"> ' + (lang === 'id' ? 'Berbeda' : '不同') + '</label>' +
                            '</div>' +
                            '<textarea id="ec_livingAddr" rows="2" style="margin-top:8px;' + (livingSame ? 'display:none;' : '') + '">' + Utils.escapeHtml(c.living_address || '') + '</textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP._saveEditCustomer(\'' + Utils.escapeAttr(customerId) + '\')" class="success">💾 ' + t('save') + '</button>' +
                            '<button onclick="document.getElementById(\'editCustomerModal\').remove()">✖ ' + t('cancel') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
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
        
        if (!isAdmin) {
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
            await APP.showCustomers();
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
                for (var i = 0; i < orders.length; i++) {
                    await supabaseClient.from('payment_history').delete().eq('order_id', orders[i].id);
                }
                await supabaseClient.from('orders').delete().eq('customer_id', customerId);
            }
            
            const { error: customerError } = await supabaseClient.from('customers').delete().eq('id', customerId);
            if (customerError) throw customerError;
            
            alert(lang === 'id' ? 'Nasabah berhasil dihapus' : '客户已删除');
            await APP.showCustomers();
        } catch (e) {
            console.error('删除客户异常:', e);
            alert(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message);
        }
    },

    // ==================== 核心：创建订单页面（重构版） ====================
    createOrderForCustomer: async function(customerId) {
        var lang = Utils.lang || 'id';
        var t = function(key) { return Utils.t(key); };

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
                alert(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。');
                return;
            }

            try {
                const { data: existingOrders } = await supabaseClient
                    .from('orders')
                    .select('status')
                    .eq('customer_id', customerId)
                    .eq('status', 'active');
                if (existingOrders && existingOrders.length > 0) {
                    alert(lang === 'id' ? 'Nasabah ini masih memiliki pesanan aktif.' : '该客户还有未结清的订单。');
                    return;
                }
            } catch(ordErr) {
                console.warn('活跃订单检查失败:', ordErr.message);
            }

            APP.currentPage = 'createOrder';
            APP.currentCustomerId = customerId;
            
            // 获取当前选中的还款方式（用于页面初始化）
            var currentRepaymentType = 'flexible';
            
            // ========== 重构后的页面布局 ==========
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📝 ' + t('create_order') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<h3>' + t('customer_info') + '</h3>' +
                    '<div class="customer-info-display">' +
                        '<p><strong>' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + ':</strong> ' + Utils.escapeHtml(customer.customer_id || '-') + '</p>' +
                        '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                        '<p><strong>' + t('ktp_number') + ':</strong> ' + Utils.escapeHtml(customer.ktp_number || '-') + '</p>' +
                        '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                        '<p><strong>' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + ':</strong> ' + Utils.escapeHtml(customer.ktp_address || customer.address || '-') + '</p>' +
                        '<p><strong>' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + ':</strong> ' + (customer.living_same_as_ktp !== false ? (lang === 'id' ? 'Sama KTP' : '同KTP') : Utils.escapeHtml(customer.living_address || '-')) + '</p>' +
                    '</div>' +
                    
                    '<h3>💎 ' + t('collateral_info') + '</h3>' +
                    '<div class="form-grid order-form-grid">' +
                        '<div class="form-group">' +
                            '<label>' + t('collateral_name') + ' *</label>' +
                            '<input id="collateral" placeholder="' + t('collateral_name') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Keterangan Barang' : '物品备注') + '</label>' +
                            '<input id="collateralNote" placeholder="' + (lang === 'id' ? 'Contoh: emas 24k, kondisi baik, tahun 2020' : '例如: 24k金, 状况良好, 2020年') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Jumlah Gadai' : '当金金额') + ' *</label>' +
                            '<input type="text" id="amount" placeholder="0" class="amount-input" oninput="APP.recalculateAllFees()">' +
                        '</div>' +
                        '<div class="form-group fund-source-group">' +
                            '<label>' + (lang === 'id' ? 'Sumber Dana' : '资金来源') + '</label>' +
                            '<div class="payment-method-options fund-source-options">' +
                                '<label><input type="radio" name="loanSource" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                '<label><input type="radio" name="loanSource" value="bank"> 🏧 ' + t('bank') + '</label>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    '<!-- 费用卡片：管理费 + 服务费（统一入账方式） -->' +
                    '<div class="fee-card">' +
                        '<h3>💰 ' + (lang === 'id' ? 'Biaya Administrasi & Layanan' : '管理费与服务费') + '</h3>' +
                        
                        '<div class="fee-row">' +
                            '<div class="fee-label">📋 ' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</div>' +
                            '<div class="fee-value">' +
                                '<input type="text" id="adminFeeInput" value="0" class="amount-input fee-amount" oninput="APP.onAdminFeeManualChange()">' +
                                '<small>' + (lang === 'id' ? 'Otomatis dihitung dari jumlah gadai' : '根据当金自动计算') + '</small>' +
                            '</div>' +
                        '</div>' +
                        
                        '<div class="fee-row">' +
                            '<div class="fee-label">✨ ' + (lang === 'id' ? 'Service Fee' : '服务费') + '</div>' +
                            '<div class="fee-value fee-value-row">' +
                                '<select id="serviceFeePercentSelect" onchange="APP.recalculateServiceFee()" class="fee-percent-select">' +
                                    Utils.getServiceFeePercentOptions(2) +
                                '</select>' +
                                '<input type="text" id="serviceFeeInput" value="0" class="amount-input fee-amount" oninput="APP.onServiceFeeManualChange()">' +
                                '<small>' + (lang === 'id' ? 'Otomatis dihitung dari jumlah gadai' : '根据当金自动计算') + '</small>' +
                            '</div>' +
                        '</div>' +
                        
                        '<div class="fee-row payment-method-row">' +
                            '<div class="fee-label">📥 ' + (lang === 'id' ? 'Metode Pemasukan' : '入账方式') + '</div>' +
                            '<div class="fee-value">' +
                                '<div class="payment-method-options fee-payment-options">' +
                                    '<label><input type="radio" name="feePaymentMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                    '<label><input type="radio" name="feePaymentMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                '</div>' +
                                '<small style="color:#64748b;">' + (lang === 'id' ? 'Admin Fee & Service Fee akan dicatat bersama' : '管理费和服务费将一起入账') + '</small>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="form-group interest-rate-group">' +
                        '<label>📈 ' + (lang === 'id' ? 'Suku Bunga (Pilih)' : '利率（可选）') + '</label>' +
                        '<select id="agreedInterestRateSelect" onchange="APP.recalculateAllFees()">' +
                            Utils.getInterestRateOptions(8) +
                        '</select>' +
                    '</div>' +
                    
                    '<!-- 三卡片布局 -->' +
                    '<div class="repayment-cards-row">' +
                        '<div class="repayment-card" onclick="document.getElementById(\'flexibleRadio\').checked=true;APP.toggleRepaymentForm(\'flexible\')">' +
                            '<div class="repayment-card-header">' +
                                '<input type="radio" name="repaymentType" id="flexibleRadio" value="flexible" checked onchange="APP.toggleRepaymentForm(this.value)">' +
                                '<span class="repayment-card-title">💰 ' + (lang === 'id' ? 'Cicilan Fleksibel' : '灵活还款') + '</span>' +
                            '</div>' +
                            '<div class="repayment-card-desc">' + (lang === 'id' ? 'Bayar bunga dulu, pokok bisa kapan saja' : '先付利息，本金随时可还') + '</div>' +
                            '<div class="repayment-card-note">' + (lang === 'id' ? 'Maksimal 10 bulan' : '最长10个月') + '</div>' +
                        '</div>' +
                        
                        '<div class="repayment-card" onclick="document.getElementById(\'fixedRadio\').checked=true;APP.toggleRepaymentForm(\'fixed\')">' +
                            '<div class="repayment-card-header">' +
                                '<input type="radio" name="repaymentType" id="fixedRadio" value="fixed" onchange="APP.toggleRepaymentForm(this.value)">' +
                                '<span class="repayment-card-title">📅 ' + (lang === 'id' ? 'Cicilan Tetap' : '固定还款') + '</span>' +
                            '</div>' +
                            '<div class="repayment-card-desc">' + (lang === 'id' ? 'Angsuran tetap per bulan (bunga + pokok)' : '每月固定还款（本金+利息）') + '</div>' +
                            '<div class="repayment-card-note">' + (lang === 'id' ? 'Pilihan 1-10 bulan' : '可选1-10个月') + '</div>' +
                        '</div>' +
                        
                        '<div id="flexibleMaxMonthsCard" class="repayment-card extension-card">' +
                            '<div class="repayment-card-header">' +
                                '<span class="repayment-card-title">📅 ' + (lang === 'id' ? 'Maksimal Perpanjangan' : '最大展期') + '</span>' +
                            '</div>' +
                            '<div class="extension-select">' +
                                '<select id="maxExtensionMonths">' +
                                    '<option value="6">6 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                    '<option value="10" selected>10 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                    '<option value="12">12 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                    '<option value="24">24 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                '</select>' +
                            '</div>' +
                            '<div class="repayment-card-note extension-note">' + (lang === 'id' ? 'Batas maksimal perpanjangan bunga sebelum harus lunasi pokok' : '利息延期上限，超出后须结清本金') + '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div id="fixedRepaymentForm" style="display:none;" class="fixed-repayment-form">' +
                        '<div class="form-group">' +
                            '<label>📅 ' + (lang === 'id' ? 'Jangka Waktu' : '还款期限') + '</label>' +
                            '<select id="repaymentTermSelect" onchange="APP.recalculateAllFees()">' +
                                Utils.getRepaymentTermOptions(5) +
                            '</select>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>💰 ' + (lang === 'id' ? 'Angsuran Bulanan (Otomatis, bisa diubah)' : '每月还款（自动计算，可修改）') + '</label>' +
                            '<input type="text" id="monthlyPaymentInput" value="0" class="amount-input" oninput="APP.onMonthlyPaymentManualChange()">' +
                            '<small style="color:#64748b;">' + (lang === 'id' ? 'Dibulatkan ke Rp 10.000, bisa disesuaikan' : '取整到Rp 10,000，可手动调整') + '</small>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="form-group full-width">' +
                        '<label>' + t('notes') + '</label>' +
                        '<textarea id="notes" rows="2" placeholder="' + t('notes') + '"></textarea>' +
                    '</div>' +
                    
                    '<div class="form-actions">' +
                        '<button onclick="APP.saveOrderForCustomer(\'' + Utils.escapeAttr(customerId) + '\')" class="success" id="saveOrderBtn">💾 ' + (lang === 'id' ? 'Simpan' : '保存') + '</button>' +
                        '<button onclick="APP.goBack()">↩️ ' + t('cancel') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<style>' +
                    '.order-form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }' +
                    '.order-form-grid .form-group { margin-bottom: 0; }' +
                    
                    '.fee-card { background: #f8fafc; border-radius: 12px; padding: 16px; margin: 12px 0; border: 1px solid #e2e8f0; }' +
                    '.fee-card h3 { margin: 0 0 12px 0; font-size: 1rem; color: #1e293b; }' +
                    '.fee-row { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }' +
                    '.fee-row .fee-label { min-width: 100px; font-weight: 600; font-size: 0.85rem; color: #475569; padding-top: 8px; }' +
                    '.fee-row .fee-value { flex: 1; min-width: 200px; }' +
                    '.fee-value-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }' +
                    '.fee-amount { width: 180px; }' +
                    '.fee-percent-select { width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; }' +
                    '.fee-payment-options { display: flex; gap: 20px; align-items: center; }' +
                    '.fee-payment-options label { display: inline-flex; align-items: center; gap: 6px; font-weight: normal; cursor: pointer; }' +
                    '.fee-payment-options input[type="radio"] { width: 16px; height: 16px; margin: 0; }' +
                    '.fee-row small { display: block; font-size: 11px; color: #64748b; margin-top: 4px; }' +
                    
                    '.repayment-cards-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 16px 0; }' +
                    '.repayment-card { background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; cursor: pointer; transition: all 0.2s; }' +
                    '.repayment-card:hover { border-color: #2563eb; background: #eff6ff; }' +
                    '.repayment-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }' +
                    '.repayment-card-header input[type="radio"] { width: 18px; height: 18px; margin: 0; cursor: pointer; }' +
                    '.repayment-card-title { font-weight: 700; font-size: 0.95rem; color: #1e293b; }' +
                    '.repayment-card-desc { font-size: 0.75rem; color: #64748b; margin-bottom: 6px; }' +
                    '.repayment-card-note { font-size: 0.7rem; color: #94a3b8; }' +
                    '.extension-card .repayment-card-header { margin-bottom: 12px; }' +
                    '.extension-select select { width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.9rem; background: white; margin-bottom: 8px; }' +
                    '.extension-note { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #d97706; }' +
                    
                    '.interest-rate-group { margin: 12px 0; }' +
                    '.interest-rate-group select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #cbd5e1; }' +
                    
                    '.fixed-repayment-form { padding: 16px; background: #f0fdf4; border-radius: 10px; margin: 8px 0; border: 1px solid #bbf7d0; }' +
                    
                    '@media (max-width: 768px) { ' +
                        '.order-form-grid { grid-template-columns: 1fr; gap: 12px; margin-bottom: 12px; }' +
                        '.repayment-cards-row { grid-template-columns: 1fr; gap: 12px; }' +
                        '.fee-row { flex-direction: column; gap: 8px; }' +
                        '.fee-row .fee-label { padding-top: 0; }' +
                        '.fee-value-row { flex-direction: column; align-items: stretch; }' +
                        '.fee-percent-select { width: 100%; }' +
                        '.fee-amount { width: 100%; }' +
                        '.fund-source-options .payment-method-options { flex-direction: row; flex-wrap: wrap; }' +
                        '.fee-payment-options { flex-direction: row; flex-wrap: wrap; }' +
                    '}' +
                    
                    '@media (min-width: 769px) and (max-width: 1024px) { ' +
                        '.order-form-grid { grid-template-columns: repeat(2, 1fr); }' +
                    '}' +
                '</style>';
            
            // 绑定金额格式化
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
            
            var adminFeeInput = document.getElementById("adminFeeInput");
            if (adminFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(adminFeeInput);
            
            var serviceFeeInput = document.getElementById("serviceFeeInput");
            if (serviceFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(serviceFeeInput);
            
            var monthlyPaymentInput = document.getElementById("monthlyPaymentInput");
            if (monthlyPaymentInput && Utils.bindAmountFormat) Utils.bindAmountFormat(monthlyPaymentInput);
            
            // 初始化计算
            APP.recalculateAllFees();
            
        } catch (error) {
            console.error("createOrderForCustomer 错误:", error);
            alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
        }
    },

    // ==================== 保存订单（重构版：保存后清空表单，停留当前页） ====================
    saveOrderForCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        var saveBtn = document.getElementById('saveOrderBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
        }
        
        var collateral = document.getElementById("collateral").value.trim();
        var collateralNote = document.getElementById("collateralNote").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var notes = document.getElementById("notes").value;
        
        // 管理费
        var adminFeeStr = document.getElementById("adminFeeInput").value;
        var adminFee = Utils.parseNumberFromCommas(adminFeeStr) || Utils.calculateAdminFee(amount);
        
        // 服务费
        var serviceFeePercent = parseFloat(document.getElementById("serviceFeePercentSelect")?.value) || 0;
        var serviceFeeStr = document.getElementById("serviceFeeInput").value;
        var serviceFee = Utils.parseNumberFromCommas(serviceFeeStr) || 0;
        if (serviceFee === 0 && serviceFeePercent > 0) {
            serviceFee = Math.round(amount * serviceFeePercent / 100);
        }
        
        // 管理费+服务费的统一入账方式
        var feePaymentMethod = document.querySelector('input[name="feePaymentMethod"]:checked')?.value || 'cash';
        
        // 利率
        var agreedInterestRate = parseFloat(document.getElementById("agreedInterestRateSelect")?.value) || 8;
        
        // 还款方式
        var repaymentTypeRadio = document.querySelector('input[name="repaymentType"]:checked');
        var repaymentType = repaymentTypeRadio ? repaymentTypeRadio.value : 'flexible';
        var repaymentTerm = null;
        var monthlyFixedPayment = null;
        var maxExtensionMonths = 10;
        
        if (repaymentType === 'fixed') {
            repaymentTerm = parseInt(document.getElementById("repaymentTermSelect")?.value) || 5;
            var monthlyStr = document.getElementById("monthlyPaymentInput").value;
            monthlyFixedPayment = Utils.parseNumberFromCommas(monthlyStr) || 0;
            if (monthlyFixedPayment === 0 && amount > 0) {
                var monthlyRate = agreedInterestRate / 100;
                monthlyFixedPayment = Utils.roundMonthlyPayment(Utils.calculateFixedMonthlyPayment(amount, monthlyRate, repaymentTerm));
            }
        } else {
            maxExtensionMonths = parseInt(document.getElementById('maxExtensionMonths')?.value) || 10;
        }
        
        // 当金资金来源（贷款发放的入账方式）
        var loanSource = document.querySelector('input[name="loanSource"]:checked')?.value || 'cash';
        var fullCollateralName = collateralNote ? collateral + ' (' + collateralNote + ')' : collateral;
        
        if (!collateral || !amount || amount <= 0) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存'); }
            alert(t('fill_all_fields'));
            return;
        }
        
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            // 检查黑名单
            const { data: blacklistData } = await supabaseClient
                .from('blacklist')
                .select('id')
                .eq('customer_id', customerId)
                .maybeSingle();
            
            if (blacklistData) {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存'); }
                alert(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。');
                return;
            }
            
            // 创建订单
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
                admin_fee: adminFee,
                service_fee_percent: serviceFeePercent,
                service_fee_amount: serviceFee,
                agreed_interest_rate: agreedInterestRate,
                repayment_type: repaymentType,
                repayment_term: repaymentTerm,
                monthly_fixed_payment: monthlyFixedPayment,
                max_extension_months: maxExtensionMonths
            };
            
            var newOrder = await Order.create(orderData);
            
            // 记录管理费（使用 feePaymentMethod）
            if (adminFee > 0) {
                try {
                    await Order.recordAdminFee(newOrder.order_id, feePaymentMethod, adminFee);
                } catch (adminFeeError) {
                    console.error("管理费收取失败:", adminFeeError);
                }
            }
            
            // 记录服务费（使用 feePaymentMethod）
            if (serviceFee > 0) {
                try {
                    await Order.recordServiceFee(newOrder.order_id, 1, feePaymentMethod);
                } catch (serviceFeeError) {
                    console.error("服务费收取失败:", serviceFeeError);
                }
            }
            
            // 记录当金发放（使用 loanSource）
            if (amount > 0) {
                try {
                    var disbursementDesc = lang === 'id' 
                        ? 'Pencairan gadai dari ' + (loanSource === 'cash' ? 'Brankas' : 'Bank BNI')
                        : '当金发放自 ' + (loanSource === 'cash' ? '保险柜' : '银行BNI');
                    await Order.recordLoanDisbursement(newOrder.order_id, amount, loanSource, disbursementDesc);
                } catch (loanError) {
                    console.error("当金发放记录失败:", loanError);
                }
            }
            
            // 成功提示
            var successMsg = repaymentType === 'fixed'
                ? (lang === 'id' 
                    ? '✅ Pesanan berhasil dibuat!\n\nID Pesanan: ' + newOrder.order_id + '\nJenis: Cicilan Tetap\nJangka: ' + repaymentTerm + ' bulan\nAngsuran per bulan: ' + Utils.formatCurrency(monthlyFixedPayment)
                    : '✅ 订单创建成功！\n\n订单号: ' + newOrder.order_id + '\n还款方式: 固定还款\n期限: ' + repaymentTerm + '个月\n每月还款: ' + Utils.formatCurrency(monthlyFixedPayment))
                : (lang === 'id'
                    ? '✅ Pesanan berhasil dibuat!\n\nID Pesanan: ' + newOrder.order_id + '\nJenis: Cicilan Fleksibel\nMaksimal perpanjangan: ' + maxExtensionMonths + ' bulan'
                    : '✅ 订单创建成功！\n\n订单号: ' + newOrder.order_id + '\n还款方式: 灵活还款\n最长可延期: ' + maxExtensionMonths + '个月');
            
            alert(successMsg);
            
            // ========== 清空表单，停留在当前页面 ==========
            document.getElementById("collateral").value = '';
            document.getElementById("collateralNote").value = '';
            document.getElementById("amount").value = '';
            document.getElementById("notes").value = '';
            
            // 重置金额为 0 的显示
            var amountInput = document.getElementById("amount");
            if (amountInput) amountInput.value = '';
            
            // 重置管理费和服务费
            var adminFeeInput = document.getElementById("adminFeeInput");
            if (adminFeeInput) adminFeeInput.value = '0';
            
            var serviceFeePercentSelect = document.getElementById("serviceFeePercentSelect");
            if (serviceFeePercentSelect) serviceFeePercentSelect.value = '2';
            
            var serviceFeeInput = document.getElementById("serviceFeeInput");
            if (serviceFeeInput) serviceFeeInput.value = '0';
            
            // 重置入账方式为默认（现金）
            var cashRadio = document.querySelector('input[name="feePaymentMethod"][value="cash"]');
            if (cashRadio) cashRadio.checked = true;
            
            var loanCashRadio = document.querySelector('input[name="loanSource"][value="cash"]');
            if (loanCashRadio) loanCashRadio.checked = true;
            
            // 重置利率为默认 8%
            var interestSelect = document.getElementById("agreedInterestRateSelect");
            if (interestSelect) interestSelect.value = '8';
            
            // 重置还款方式为灵活还款
            var flexibleRadio = document.getElementById("flexibleRadio");
            if (flexibleRadio) {
                flexibleRadio.checked = true;
                APP.toggleRepaymentForm('flexible');
            }
            
            // 重新计算费用
            APP.recalculateAllFees();
            
            // 聚焦到质押物名称输入框，方便继续创建订单
            document.getElementById("collateral").focus();
            
        } catch (error) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存'); }
            console.error("saveOrderForCustomer error:", error);
            var errMsg = error.message || error.details || error.code || JSON.stringify(error);
            alert(t('save_failed') + ': ' + errMsg);
        } finally {
            // 恢复按钮状态
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存');
            }
        }
    },

    recalculateAllFees: function() {
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        
        var adminFee = Utils.calculateAdminFee(amount);
        var adminFeeInput = document.getElementById('adminFeeInput');
        if (adminFeeInput && !adminFeeInput.dataset.manual) {
            adminFeeInput.value = Utils.formatNumberWithCommas(adminFee);
        }
        
        var serviceFeeData = Utils.calculateServiceFeeNew(amount);
        var serviceFeeSelect = document.getElementById('serviceFeePercentSelect');
        var serviceFeeInput = document.getElementById('serviceFeeInput');
        if (serviceFeeSelect && !serviceFeeSelect.dataset.manual) {
            serviceFeeSelect.value = serviceFeeData.percent;
        }
        if (serviceFeeInput && !serviceFeeInput.dataset.manual) {
            serviceFeeInput.value = Utils.formatNumberWithCommas(serviceFeeData.amount);
        }
        
        var repaymentType = document.querySelector('input[name="repaymentType"]:checked')?.value;
        if (repaymentType === 'fixed') {
            var rateSelect = document.getElementById('agreedInterestRateSelect');
            var monthlyRate = rateSelect ? (parseFloat(rateSelect.value) || 8) / 100 : 0.08;
            var termSelect = document.getElementById('repaymentTermSelect');
            var months = termSelect ? parseInt(termSelect.value) : 5;
            
            if (amount > 0 && months > 0) {
                var monthlyPayment = Utils.calculateFixedMonthlyPayment(amount, monthlyRate, months);
                var rounded = Utils.roundMonthlyPayment(monthlyPayment);
                var monthlyInput = document.getElementById('monthlyPaymentInput');
                if (monthlyInput && !monthlyInput.dataset.manual) {
                    monthlyInput.value = Utils.formatNumberWithCommas(rounded);
                }
            }
        }
    },

    onAdminFeeManualChange: function() {
        var input = document.getElementById('adminFeeInput');
        if (input) input.dataset.manual = 'true';
    },

    recalculateServiceFee: function() {
        var select = document.getElementById('serviceFeePercentSelect');
        if (select) select.dataset.manual = 'true';
        
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var percent = select ? parseFloat(select.value) : 0;
        var fee = Math.round(amount * percent / 100);
        
        var input = document.getElementById('serviceFeeInput');
        if (input) {
            input.value = Utils.formatNumberWithCommas(fee);
            input.dataset.manual = 'true';
        }
    },

    onServiceFeeManualChange: function() {
        var input = document.getElementById('serviceFeeInput');
        if (input) input.dataset.manual = 'true';
    },

    onMonthlyPaymentManualChange: function() {
        var input = document.getElementById('monthlyPaymentInput');
        if (input) input.dataset.manual = 'true';
    },

    toggleRepaymentForm: function(value) {
        var fixedForm = document.getElementById('fixedRepaymentForm');
        var flexibleCard = document.getElementById('flexibleMaxMonthsCard');
        if (fixedForm) fixedForm.style.display = value === 'fixed' ? 'block' : 'none';
        if (flexibleCard) flexibleCard.style.display = value === 'flexible' ? 'block' : 'none';
        
        // 更新卡片的选中样式
        var flexibleCardDiv = document.querySelector('.repayment-card:has(#flexibleRadio)');
        var fixedCardDiv = document.querySelector('.repayment-card:has(#fixedRadio)');
        if (flexibleCardDiv) {
            if (value === 'flexible') {
                flexibleCardDiv.classList.add('repayment-card-active');
            } else {
                flexibleCardDiv.classList.remove('repayment-card-active');
            }
        }
        if (fixedCardDiv) {
            if (value === 'fixed') {
                fixedCardDiv.classList.add('repayment-card-active');
            } else {
                fixedCardDiv.classList.remove('repayment-card-active');
            }
        }
        
        if (value === 'fixed') APP.recalculateAllFees();
    },

    showCustomerOrders: async function(customerId) {
        APP.currentPage = 'customerOrders';
        APP.currentCustomerId = customerId;
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
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
            
            var rows = '';
            if (!orders || orders.length === 0) {
                rows = '<tr><td colspan="8" class="text-center">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    var repaymentTypeText = o.repayment_type === 'fixed' 
                        ? (lang === 'id' ? 'Tetap' : '固定') 
                        : (lang === 'id' ? 'Fleksibel' : '灵活');
                    
                    rows += '<tr>' +
                        '<td data-label="' + t('order_id') + '" class="order-id">' + Utils.escapeHtml(o.order_id) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Tanggal' : '日期') + '" class="date-cell">' + Utils.formatDate(o.created_at) + '<\/td>' +
                        '<td data-label="' + t('loan_amount') + '" class="text-right">' + Utils.formatCurrency(o.loan_amount) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Pokok Dibayar' : '已还本金') + '" class="text-right">' + Utils.formatCurrency(o.principal_paid) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Bunga Dibayar' : '已付利息') + '" class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? 'bln' : '个月') + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Jenis' : '方式') + '" class="text-center"><span class="repayment-badge ' + (o.repayment_type === 'fixed' ? 'badge-fixed' : 'badge-flexible') + '">' + repaymentTypeText + '<\/span><\/td>' +
                        '<td data-label="' + t('status') + '" class="text-center"><span class="status-badge ' + sc + '">' + (statusMap[o.status] || o.status) + '<\/span><\/td>' +
                    '<\/tr>';
                    
                    var actionButtons = '';
                    if (o.status === 'active' && !AUTH.isAdmin()) {
                        actionButtons += '<button onclick="APP.navigateTo(\'payment\',{orderId:\'' + Utils.escapeAttr(o.order_id) + '\'})" class="btn-small success">💰 ' + (lang === 'id' ? 'Bayar' : '缴费') + '</button>';
                    }
                    actionButtons += '<button onclick="APP.navigateTo(\'viewOrder\',{orderId:\'' + Utils.escapeAttr(o.order_id) + '\'})" class="btn-small">👁️ ' + t('view') + '<\/button>';
                    
                    rows += Utils.renderActionRow({
                        colspan: 7,
                        buttonsHtml: actionButtons
                    });
                }
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📋 ' + (lang === 'id' ? 'Order Nasabah' : '客户订单') + ' - ' + Utils.escapeHtml(customer.name) + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card customer-summary">' +
                    '<p><strong>' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + ':</strong> ' + Utils.escapeHtml(customer.customer_id || '-') + '</p>' +
                    '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                    '<p><strong>' + t('ktp_number') + ':</strong> ' + Utils.escapeHtml(customer.ktp_number || '-') + '</p>' +
                    '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>📋 ' + t('order_list') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead><tr><th>ID</th><th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th><th class="text-right">' + t('loan_amount') + '</th><th class="text-right">' + (lang === 'id' ? 'Pokok Dibayar' : '已还本金') + '</th><th class="text-center">' + (lang === 'id' ? 'Bunga Dibayar' : '已付利息') + '</th><th class="text-center">' + (lang === 'id' ? 'Jenis' : '方式') + '</th><th class="text-center">' + (lang === 'id' ? 'Status' : '状态') + '</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '<\/table>' +
                    '</div>' +
                '</div>' +
                '<style>.repayment-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-fixed{background:#d1fae5;color:#065f46}.badge-flexible{background:#fed7aa;color:#9a3412}</style>';
        } catch (error) {
            console.error("showCustomerOrders error:", error);
            alert(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败');
        }
    },

    showCustomerPaymentHistory: async function(customerId) {
        APP.currentPage = 'customerPaymentHistory';
        APP.currentCustomerId = customerId;
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
        try {
            const { data: customer } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            const { data: orders } = await supabaseClient.from('orders').select('id, order_id').eq('customer_id', customerId);
            var orderIds = [];
            if (orders) {
                for (var i = 0; i < orders.length; i++) {
                    orderIds.push(orders[i].id);
                }
            }
            var allPayments = [];
            if (orderIds.length > 0) {
                const { data } = await supabaseClient.from('payment_history').select('*, orders(order_id, customer_name)').in('order_id', orderIds).order('date', { ascending: false });
                allPayments = data || [];
            }
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', service_fee: lang === 'id' ? 'Service Fee' : '服务费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            
            var rows = '';
            if (allPayments.length === 0) {
                rows = '<tr><td colspan="7" class="text-center">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < allPayments.length; i++) {
                    var p = allPayments[i];
                    rows += '<tr>' +
                        '<td data-label="' + t('date') + '" class="date-cell">' + Utils.formatDate(p.date) + '<\/td>' +
                        '<td data-label="' + t('order_id') + '" class="order-id">' + Utils.escapeHtml(p.orders?.order_id || '-') + '<\/td>' +
                        '<td data-label="' + t('type') + '">' + (typeMap[p.type] || p.type) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Bulan' : '月数') + '" class="text-center">' + (p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-') + '<\/td>' +
                        '<td data-label="' + t('amount') + '" class="text-right">' + Utils.formatCurrency(p.amount) + '<\/td>' +
                        '<td data-label="' + (lang === 'id' ? 'Metode' : '支付方式') + '" class="text-center"><span class="payment-method-badge ' + (p.payment_method === 'cash' ? 'method-cash' : 'method-bank') + '">' + (methodMap[p.payment_method] || '-') + '<\/span><\/td>' +
                        '<td data-label="' + t('description') + '">' + Utils.escapeHtml(p.description || '-') + '<\/td>' +
                    '<\/tr>';
                }
            }
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '付款记录') + ' - ' + Utils.escapeHtml(customer.name) + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card customer-summary">' +
                    '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                    '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>💰 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '付款记录') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead><tr><th>' + t('date') + '</th><th>' + t('order_id') + '</th><th>' + t('type') + '</th><th class="text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th><th class="text-right">' + t('amount') + '</th><th class="text-center">' + (lang === 'id' ? 'Metode' : '支付方式') + '</th><th>' + t('description') + '</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '<\/table>' +
                    '</div>' +
                '</div>';
        } catch (error) {
            console.error("showCustomerPaymentHistory error:", error);
            alert(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败');
        }
    }
};

// 将所有以大写字母开头的方法挂载到 window.APP
for (var key in CustomersModule) {
    if (typeof CustomersModule[key] === 'function') {
        window.APP[key] = CustomersModule[key];
    }
}

// 确保内部辅助函数也挂载到 APP
window.APP.recalculateAllFees = CustomersModule.recalculateAllFees;
window.APP.onAdminFeeManualChange = CustomersModule.onAdminFeeManualChange;
window.APP.recalculateServiceFee = CustomersModule.recalculateServiceFee;
window.APP.onServiceFeeManualChange = CustomersModule.onServiceFeeManualChange;
window.APP.onMonthlyPaymentManualChange = CustomersModule.onMonthlyPaymentManualChange;
window.APP.toggleRepaymentForm = CustomersModule.toggleRepaymentForm;
window.APP.toggleLivingAddress = CustomersModule.toggleLivingAddress;
window.APP._toggleEditLiving = CustomersModule._toggleEditLiving;
window.APP._saveEditCustomer = CustomersModule._saveEditCustomer;
window.APP.saveOrderForCustomer = CustomersModule.saveOrderForCustomer;
