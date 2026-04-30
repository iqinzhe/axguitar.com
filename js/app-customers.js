// app-customers.js - v2.2 (最终版)
// 适配新计费规则：
//   管理费：≤50万→Rp20,000 / 50万~300万→Rp30,000 / >300万→1%
//   服务费：默认2%，下拉0-5%
//   利率：默认8%，下拉6-10%
//   双语统一：t() 体系

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
            
            var totalCols = 7;
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = '<tr><td colspan="' + totalCols + '" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var i = 0; i < customers.length; i++) {
                    var c = customers[i];
                    var customerId = Utils.escapeHtml(c.customer_id || '-');
                    var name = Utils.escapeHtml(c.name);
                    var phone = Utils.escapeHtml(c.phone || '-');
                    var ktpNumber = Utils.escapeHtml(c.ktp_number || '-');
                    var occupation = Utils.escapeHtml(c.occupation || '-');
                    
                    rows += '<tr class="data-row">' +
                        '<td class="col-id">' + customerId + '</td>' +
                        '<td class="col-name">' + name + '</td>' +
                        '<td class="col-phone">' + phone + '</td>' +
                        '<td class="col-ktp">' + ktpNumber + '</td>' +
                        '<td class="col-occupation">' + occupation + '</td>' +
                        '<td class="text-center">' +
                            '<button onclick="APP.createOrderForCustomer(\'' + Utils.escapeAttr(c.id) + '\')" class="btn-small success" style="background:var(--success-dark);color:white;white-space:nowrap;">➕ ' + t('create_order_for') + '</button>' +
                        '</td>' +
                        '<td class="text-center">' +
                            '<button onclick="APP.showCustomerDetailCard(\'' + Utils.escapeAttr(c.id) + '\')" class="btn-small">📋 ' + t('detail') + '</button>' +
                        '</td>' +
                    '</tr>';
                }
            }

            var addCustomerCardHtml = '';
            if (!isAdmin) {
                addCustomerCardHtml = '' +
                '<div class="card">' +
                    '<h3>➕ ' + t('add_customer') + '</h3>' +
                    '<div class="form-grid order-first-row">' +
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
                        '<div class="form-group">' +
                            '<label>' + t('occupation') + '</label>' +
                            '<input type="text" id="customerOccupation" placeholder="' + (lang === 'id' ? 'Contoh: PNS, Karyawan Swasta' : '例如: 公务员, 企业员工') + '">' +
                        '</div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + t('ktp_address') + '</label>' +
                            '<textarea id="customerKtpAddress" rows="2" placeholder="' + (lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址') + '"></textarea>' +
                        '</div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + t('living_address') + '</label>' +
                            '<div class="address-option">' +
                                '<label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ' + t('same_as_ktp') + '</label>' +
                                '<label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ' + t('different_from_ktp') + '</label>' +
                            '</div>' +
                            '<textarea id="customerLivingAddress" rows="2" placeholder="' + (lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址') + '" style="display:none;margin-top:8px;"></textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP.addCustomer()" class="success" id="addCustomerBtn">💾 ' + t('save_customer') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>👥 ' + t('customers') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + t('print') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Daftar Nasabah' : '客户列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table customer-list-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + t('customer_id') + '</th>' +
                                    '<th class="col-name">' + t('customer_name') + '</th>' +
                                    '<th class="col-ktp">' + t('ktp_number') + '</th>' +
                                    '<th class="col-phone">' + t('phone') + '</th>' +
                                    '<th class="col-occupation">' + t('occupation') + '</th>' +
                                    '<th class="text-center">' + t('create_order_for') + '</th>' +
                                    '<th class="text-center">' + t('action') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                addCustomerCardHtml;
            
        } catch (error) {
            console.error("showCustomers error:", error);
            Utils.toast.error(lang === 'id' ? '加载客户数据失败：' + error.message : 'Gagal memuat data nasabah: ' + error.message);
        }
    },

    // ========== 详情卡片弹窗 ==========
    showCustomerDetailCard: async function(customerId) {
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var isAdmin = AUTH.isAdmin();
        var profile = await SUPABASE.getCurrentProfile();
        
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            if (!customer) throw new Error(t('order_not_found'));
            
            let isBlacklisted = false;
            let blacklistReason = '';
            try {
                const blResult = await SUPABASE.checkBlacklist(customer.id);
                if (blResult.isBlacklisted) {
                    isBlacklisted = true;
                    blacklistReason = blResult.reason;
                }
            } catch(blErr) {
                console.warn('黑名单检查失败:', blErr.message);
            }
            
            const { activeCount, completedCount, abnormalCount } = await SUPABASE.getCustomerOrdersStats(customerId);
            
            var canEdit = isAdmin;
            var canBlacklist = !isBlacklisted;
            var canUnblacklist = isAdmin && isBlacklisted;
            
            var registeredDate = Utils.formatDate(customer.registered_date);
            var ktpAddress = Utils.escapeHtml(customer.ktp_address || customer.address || '-');
            var livingAddress = Utils.escapeHtml(
                customer.living_same_as_ktp !== false 
                    ? t('same_as_ktp')
                    : (customer.living_address || '-')
            );
            
            var orderStatsHtml = '' +
                '<div class="order-stats">' +
                    '<div class="stat-item active" onclick="APP.showCustomerOrdersByStatus(\'' + Utils.escapeAttr(customerId) + '\', \'active\')" style="cursor:pointer;">' +
                        '<span class="stat-number">' + activeCount + '</span>' +
                        '<span class="stat-label">' + t('active_orders') + '</span>' +
                    '</div>' +
                    '<div class="stat-item completed" onclick="APP.showCustomerOrdersByStatus(\'' + Utils.escapeAttr(customerId) + '\', \'completed\')" style="cursor:pointer;">' +
                        '<span class="stat-number">' + completedCount + '</span>' +
                        '<span class="stat-label">' + t('completed_orders') + '</span>' +
                    '</div>' +
                    '<div class="stat-item abnormal" onclick="APP.showCustomerOrdersByStatus(\'' + Utils.escapeAttr(customerId) + '\', \'abnormal\')" style="cursor:pointer;">' +
                        '<span class="stat-number">' + abnormalCount + '</span>' +
                        '<span class="stat-label">' + t('abnormal_orders') + '</span>' +
                    '</div>' +
                '</div>';
            
            var blacklistBadge = '';
            if (isBlacklisted) {
                blacklistBadge = '<div class="info-bar warning" style="margin:0 0 12px 0; padding:6px 12px;"><small>⚠️ ' + Utils.escapeHtml(blacklistReason) + '</small></div>';
            }
            
            var modalHtml = '' +
                '<div id="customerDetailCard" class="modal-overlay customer-detail-card">' +
                    '<div class="modal-content" style="max-width:780px;">' +
                        '<h3 style="display:flex; justify-content:space-between; align-items:center;">' +
                            '<span>📋 ' + t('customer_detail') + ' - ' + Utils.escapeHtml(customer.name) + '</span>' +
                            '<button onclick="document.getElementById(\'customerDetailCard\').remove()" style="background:none; border:none; font-size:20px; cursor:pointer;">✖</button>' +
                        '</h3>' +
                        
                        blacklistBadge +
                        
                        '<div class="form-section">' +
                            '<div class="info-display">' +
                                '<div class="info-display-item">' +
                                    '<span class="info-label">' + t('registered_date') + ':</span>' +
                                    '<span class="info-value">' + registeredDate + '</span>' +
                                '</div>' +
                                '<div class="info-display-item">' +
                                    '<span class="info-label">' + t('ktp_address') + ':</span>' +
                                    '<span class="info-value">' + ktpAddress + '</span>' +
                                '</div>' +
                                '<div class="info-display-item">' +
                                    '<span class="info-label">' + t('living_address') + ':</span>' +
                                    '<span class="info-value">' + livingAddress + '</span>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        
                        '<div class="form-section">' +
                            '<div class="form-section-title">📋 ' + t('order_stats') + '</div>' +
                            orderStatsHtml +
                        '</div>' +
                        
                        '<div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-light); flex-wrap:wrap;">' +
                            (canEdit ? '<button onclick="APP.editCustomerFromCard(\'' + Utils.escapeAttr(customerId) + '\')" class="btn-small" style="background:var(--primary-dark);color:white;">✏️ ' + t('edit') + '</button>' : '') +
                            (canBlacklist ? '<button onclick="APP.blacklistFromCard(\'' + Utils.escapeAttr(customer.id) + '\', \'' + Utils.escapeAttr(customer.name) + '\')" class="btn-small btn-blacklist" style="background:#f97316;color:#fff;">🚫 ' + t('blacklist_customer') + '</button>' : '') +
                            (canUnblacklist ? '<button onclick="APP.unblacklistFromCard(\'' + Utils.escapeAttr(customer.id) + '\')" class="btn-small warning">🔓 ' + t('unblacklist_customer') + '</button>' : '') +
                            '<button onclick="document.getElementById(\'customerDetailCard\').remove()" class="btn-back">✖ ' + t('cancel') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            var oldModal = document.getElementById('customerDetailCard');
            if (oldModal) oldModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
        } catch (error) {
            console.error("showCustomerDetailCard error:", error);
            Utils.toast.error(lang === 'id' ? '加载客户详情失败：' + error.message : 'Gagal memuat detail nasabah: ' + error.message);
        }
    },
    
    editCustomerFromCard: async function(customerId) {
        var modal = document.getElementById('customerDetailCard');
        if (modal) modal.remove();
        await this.editCustomer(customerId);
    },
    
    blacklistFromCard: async function(customerUuid, customerName) {
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        var modal = document.getElementById('customerDetailCard');
        if (modal) modal.remove();
        
        var reason = prompt(
            lang === 'id' 
                ? 'Masukkan alasan blacklist untuk nasabah "' + customerName + '":\n\nContoh: Telat bayar, Penipuan, dll.'
                : '请输入拉黑客户 "' + customerName + '" 的原因：\n\n例如：逾期未还、欺诈等。',
            lang === 'id' ? 'Telat bayar' : '逾期未还'
        );
        
        if (!reason || reason.trim() === '') {
            Utils.toast.warning(t('fill_all_fields'));
            return;
        }
        
        var confirmMsg = lang === 'id' 
            ? '⚠️ Yakin akan blacklist nasabah ini?\n\nNama: ' + customerName + '\nAlasan: ' + reason + '\n\nNasabah yang di-blacklist tidak dapat membuat order baru.'
            : '⚠️ 确认拉黑此客户？\n\n客户名: ' + customerName + '\n原因: ' + reason + '\n\n被拉黑的客户将无法创建新订单。';
        
        var confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            await window.APP.addToBlacklist(customerUuid, reason);
            Utils.toast.success(lang === 'id' ? '✅ Nasabah "' + customerName + '" telah ditambahkan ke blacklist.' : '✅ 客户 "' + customerName + '" 已加入黑名单。');
            await APP.showCustomers();
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + error.message : '拉黑失败：' + error.message);
        }
    },
    
    unblacklistFromCard: async function(customerUuid) {
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        var confirmMsg = lang === 'id' ? 'Yakin ingin membuka blacklist nasabah ini?' : '确认解除此客户的拉黑？';
        var confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            await window.APP.removeFromBlacklist(customerUuid);
            Utils.toast.success(lang === 'id' ? '✅ Blacklist berhasil dibuka' : '✅ 已解除拉黑');
            
            var modal = document.getElementById('customerDetailCard');
            if (modal) modal.remove();
            
            await APP.showCustomers();
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal membuka blacklist: ' + error.message : '解除拉黑失败：' + error.message);
        }
    },
    
    showCustomerOrdersByStatus: async function(customerId, statusType) {
        var lang = Utils.lang;
        
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            if (!customer) return;
            
            await SUPABASE.getCustomerOrdersByStatus(customerId, statusType);
            
            var modal = document.getElementById('customerDetailCard');
            if (modal) modal.remove();
            
            APP.currentCustomerId = customerId;
            APP.showCustomerOrders(customerId);
            
        } catch (error) {
            console.error("showCustomerOrdersByStatus error:", error);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
        }
    },

    toggleLivingAddress: function(value) {
        var el = document.getElementById('customerLivingAddress');
        if (el) el.style.display = value === 'different' ? 'block' : 'none';
    },

    addCustomer: async function() {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        if (isAdmin) {
            Utils.toast.warning(t('store_operation'));
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
        var occupation = document.getElementById("customerOccupation").value.trim();
        var ktpAddress = document.getElementById("customerKtpAddress").value.trim();
        var livingOpt = document.querySelector('input[name="livingAddrOpt"]:checked')?.value || 'same';
        var livingSameAsKtp = livingOpt === 'same';
        var livingAddress = livingSameAsKtp ? null : document.getElementById("customerLivingAddress").value.trim();

        if (!name) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
            Utils.toast.warning(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写');
            return;
        }
        if (!phone) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
            Utils.toast.warning(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写');
            return;
        }

        try {
            const profile = await SUPABASE.getCurrentProfile();
            const storeId = profile?.store_id;
            
            if (!storeId) {
                if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
                Utils.toast.error(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                return;
            }
            
            if (ktp || phone) {
                try {
                    const blacklistedCustomer = await SUPABASE.checkBlacklistDuplicate(ktp, phone);
                    if (blacklistedCustomer) {
                        let reason = '';
                        if (ktp && blacklistedCustomer.ktp_number === ktp) {
                            reason = lang === 'id' 
                                ? '❌ Nomor KTP ' + ktp + ' sudah terdaftar di blacklist (Nasabah: ' + blacklistedCustomer.name + ')\n\nTidak dapat menambahkan nasabah baru dengan data yang sama.'
                                : '❌ 身份证号 ' + ktp + ' 已被拉黑（客户：' + blacklistedCustomer.name + '）\n\n无法添加相同信息的客户。';
                        } else if (phone && blacklistedCustomer.phone === phone) {
                            reason = lang === 'id'
                                ? '❌ Nomor telepon ' + phone + ' sudah terdaftar di blacklist (Nasabah: ' + blacklistedCustomer.name + ')\n\nTidak dapat menambahkan nasabah baru dengan data yang sama.'
                                : '❌ 手机号 ' + phone + ' 已被拉黑（客户：' + blacklistedCustomer.name + '）\n\n无法添加相同信息的客户。';
                        }
                        Utils.toast.error(reason, 5000);
                        if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
                        return;
                    }
                } catch (blErr) {
                    console.warn('黑名单重复检查失败:', blErr.message);
                }
            }
            
            let maxRetries = 8;
            let lastError = null;
            let newCustomer = null;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const prefix = await SUPABASE._getStorePrefix(storeId);
                    const client = SUPABASE.getClient();
                    const { data: customers, error: queryError } = await client
                        .from('customers')
                        .select('customer_id')
                        .like('customer_id', prefix + '%')
                        .order('customer_id', { ascending: false })
                        .limit(1);
                    
                    if (queryError) console.warn("查询最大客户ID失败:", queryError);
                    
                    let maxNumber = 0;
                    if (customers && customers.length > 0) {
                        const match = customers[0].customer_id.match(new RegExp(prefix + '(\\d{3})$'));
                        if (match) maxNumber = parseInt(match[1], 10);
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
                        occupation: occupation || null,
                        ktp_address: ktpAddress || null,
                        address: ktpAddress || null,
                        living_same_as_ktp: livingSameAsKtp,
                        living_address: livingAddress || null,
                        registered_date: Utils.getLocalToday(),
                        created_by: profile.id
                    };
                    
                    const { data, error } = await client
                        .from('customers')
                        .insert(customerData)
                        .select()
                        .single();
                    
                    if (error) {
                        if (error.code === '23505') {
                            console.warn('客户ID ' + customerId + ' 冲突，重试第 ' + (attempt + 1) + '/' + maxRetries + ' 次');
                            lastError = error;
                            await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
                            continue;
                        }
                        throw error;
                    }
                    
                    newCustomer = data;
                    break;
                    
                } catch (err) {
                    if (err.code === '23505' && attempt < maxRetries - 1) continue;
                    throw err;
                }
            }
            
            if (!newCustomer) throw lastError || new Error(lang === 'id' ? 'Gagal menghasilkan ID nasabah unik' : '无法生成唯一的客户ID');
            
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
            Utils.toast.success(lang === 'id' ? 'Nasabah berhasil ditambahkan! ID: ' + newCustomer.customer_id : '客户添加成功！ID: ' + newCustomer.customer_id);
            await APP.showCustomers();
            
        } catch (error) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
            console.error("addCustomer error:", error);
            Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    editCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        if (!isAdmin) { Utils.toast.warning(t('store_operation')); return; }
        
        try {
            const client = SUPABASE.getClient();
            const { data: c, error } = await client.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;
            var livingSame = c.living_same_as_ktp !== false;
            var occupation = c.occupation || '';

            var modal = document.createElement('div');
            modal.id = 'editCustomerModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = '' +
                '<div class="modal-content" style="max-width:600px;">' +
                    '<h3>✏️ ' + t('edit_customer') + '</h3>' +
                    '<div class="form-grid order-first-row">' +
                        '<div class="form-group"><label>' + t('customer_name') + ' *</label><input id="ec_name" value="' + Utils.escapeHtml(c.name) + '"></div>' +
                        '<div class="form-group"><label>' + t('phone') + ' *</label><input id="ec_phone" value="' + Utils.escapeHtml(c.phone || '') + '"></div>' +
                        '<div class="form-group"><label>' + t('ktp_number') + '</label><input id="ec_ktp" value="' + Utils.escapeHtml(c.ktp_number || '') + '"></div>' +
                        '<div class="form-group"><label>' + t('occupation') + '</label><input id="ec_occupation" value="' + Utils.escapeHtml(occupation) + '"></div>' +
                        '<div class="form-group full-width"><label>' + t('ktp_address') + '</label><textarea id="ec_ktpAddr" rows="2">' + Utils.escapeHtml(c.ktp_address || c.address || '') + '</textarea></div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + t('living_address') + '</label>' +
                            '<div class="address-option">' +
                                '<label><input type="radio" name="ec_livingOpt" value="same" ' + (livingSame ? 'checked' : '') + ' onchange="APP._toggleEditLiving(this.value)"> ' + t('same_as_ktp') + '</label>' +
                                '<label><input type="radio" name="ec_livingOpt" value="different" ' + (!livingSame ? 'checked' : '') + ' onchange="APP._toggleEditLiving(this.value)"> ' + t('different_from_ktp') + '</label>' +
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
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data: ' + e.message : '加载失败：' + e.message);
        }
    },

    _toggleEditLiving: function(val) {
        var el = document.getElementById('ec_livingAddr');
        if (el) el.style.display = val === 'different' ? 'block' : 'none';
    },

    _saveEditCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        if (!isAdmin) { Utils.toast.warning(t('store_operation')); return; }
        
        var name = document.getElementById('ec_name').value.trim();
        var phone = document.getElementById('ec_phone').value.trim();
        var ktp = document.getElementById('ec_ktp').value.trim();
        var occupation = document.getElementById('ec_occupation').value.trim();
        var ktpAddr = document.getElementById('ec_ktpAddr').value.trim();
        var livingOpt = document.querySelector('input[name="ec_livingOpt"]:checked')?.value || 'same';
        var livingSame = livingOpt === 'same';
        var livingAddr = livingSame ? null : document.getElementById('ec_livingAddr').value.trim();

        if (!name || !phone) { 
            Utils.toast.warning(lang === 'id' ? 'Nama dan telepon wajib diisi' : '姓名和手机号必须填写');
            return; 
        }

        try {
            const client = SUPABASE.getClient();
            const { error } = await client.from('customers').update({
                name: name, phone: phone, ktp_number: ktp || null,
                occupation: occupation || null, ktp_address: ktpAddr || null,
                address: ktpAddr || null, living_same_as_ktp: livingSame,
                living_address: livingAddr || null, updated_at: Utils.getLocalDateTime()
            }).eq('id', customerId);
            
            if (error) throw error;
            
            document.getElementById('editCustomerModal')?.remove();
            Utils.toast.success(lang === 'id' ? 'Data nasabah diperbarui' : '客户信息已更新');
            
            if (window.APP.clearAnomalyCache) window.APP.clearAnomalyCache();
            
            await APP.showCustomers();
        } catch (e) {
            Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + e.message : '保存失败：' + e.message);
        }
    },

    deleteCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        var confirmed = await Utils.toast.confirm(t('confirm_delete'));
        if (!confirmed) return;
        
        try {
            const client = SUPABASE.getClient();
            const { data: orders, error: ordersError } = await client.from('orders').select('id').eq('customer_id', customerId);
            if (ordersError) throw ordersError;
            
            if (orders && orders.length > 0) {
                for (var i = 0; i < orders.length; i++) {
                    await client.from('payment_history').delete().eq('order_id', orders[i].id);
                }
                await client.from('orders').delete().eq('customer_id', customerId);
            }
            
            await client.from('blacklist').delete().eq('customer_id', customerId);
            
            const { error: customerError } = await client.from('customers').delete().eq('id', customerId);
            if (customerError) throw customerError;
            
            Utils.toast.success(lang === 'id' ? 'Nasabah berhasil dihapus' : '客户已删除');
            
            if (window.APP.clearAnomalyCache) window.APP.clearAnomalyCache();
            
            await APP.showCustomers();
        } catch (e) {
            console.error('删除客户异常:', e);
            Utils.toast.error(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message);
        }
    },

    // ======================================================================
    // 创建订单页面（新计费规则）
    // ======================================================================
    createOrderForCustomer: async function(customerId) {
        var lang = Utils.lang || 'id';
        var t = function(key) { return Utils.t(key); };

        var profile = null;
        try {
            profile = await SUPABASE.getCurrentProfile();
        } catch(e) {
            console.error('获取用户资料失败:', e);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data user' : '加载用户数据失败');
            return;
        }

        var isAdmin = profile?.role === 'admin';

        if (isAdmin) {
            Utils.toast.warning(t('store_operation'));
            return;
        }

        if (!customerId) {
            Utils.toast.warning(lang === 'id' ? 'ID nasabah tidak valid' : '客户ID无效');
            return;
        }

        try {
            const customer = await SUPABASE.getCustomer(customerId);
            if (!customer) {
                throw new Error(lang === 'id' ? 'Data nasabah tidak ditemukan' : '找不到客户数据');
            }

            var blacklistCheck = { isBlacklisted: false };
            try {
                blacklistCheck = await SUPABASE.checkBlacklist(customer.id);
            } catch(blErr) {
                console.warn('黑名单检查失败:', blErr.message);
            }

            if (blacklistCheck && blacklistCheck.isBlacklisted) {
                Utils.toast.error(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。', 4000);
                return;
            }

            try {
                const client = SUPABASE.getClient();
                const { data: existingOrders } = await client
                    .from('orders')
                    .select('status')
                    .eq('customer_id', customerId)
                    .eq('status', 'active');
                if (existingOrders && existingOrders.length > 0) {
                    Utils.toast.warning(lang === 'id' ? 'Nasabah ini masih memiliki pesanan aktif.' : '该客户还有未结清的订单。');
                    return;
                }
            } catch(ordErr) {
                console.warn('活跃订单检查失败:', ordErr.message);
            }

            APP.currentPage = 'createOrder';
            APP.currentCustomerId = customerId;
            
            var occupationDisplay = Utils.escapeHtml(customer.occupation || '-');
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📝 ' + t('create_order') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    // ===== 客户信息 =====
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">👤</span> ' + t('customer_info') +
                        '</div>' +
                        '<div class="info-display">' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('customer_id') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.customer_id || '-') + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('customer_name') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.name) + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('ktp_number') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.ktp_number || '-') + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('phone') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.phone) + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('occupation') + '</span>' +
                                '<span class="info-value">' + occupationDisplay + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('ktp_address') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.ktp_address || customer.address || '-') + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('living_address') + '</span>' +
                                '<span class="info-value">' + (customer.living_same_as_ktp !== false ? t('same_as_ktp') : Utils.escapeHtml(customer.living_address || '-')) + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    // ===== 质押物信息 =====
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">💎</span> ' + t('collateral_info') +
                        '</div>' +
                        '<div class="order-first-row">' +
                            '<div class="form-group">' +
                                '<label>' + t('collateral_name') + ' *</label>' +
                                '<input id="collateral" placeholder="' + t('collateral_name') + '">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' + t('collateral_note') + '</label>' +
                                '<input id="collateralNote" placeholder="' + (lang === 'id' ? 'Contoh: emas 24k, kondisi baik, tahun 2020' : '例如: 24k金, 状况良好, 2020年') + '">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' + t('loan_amount') + ' *</label>' +
                                '<input type="text" id="amount" placeholder="0" class="amount-input" oninput="APP.recalculateAllFees()">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' + t('loan_source') + '</label>' +
                                '<div class="payment-method-selector compact">' +
                                    '<label><input type="radio" name="loanSource" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                    '<label><input type="radio" name="loanSource" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    // ===== 费用明细（新计费规则） =====
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">💰</span> ' + t('fee_details') +
                        '</div>' +
                        
                        // 管理费卡片
                        '<div class="fee-cards-row">' +
                            '<div class="fee-card">' +
                                '<div class="fee-card-label">📋 ' + t('admin_fee') + '</div>' +
                                '<div class="fee-card-body">' +
                                    '<input type="text" id="adminFeeInput" value="0" class="amount-input" readonly style="background:#f8fafc;">' +
                                '</div>' +
                                '<div class="fee-card-hint">' +
                                    '💡 ≤Rp500rb→Rp20rb | Rp500rb~3jt→Rp30rb | >3jt→1%' +
                                '</div>' +
                            '</div>' +
                            
                            // 服务费卡片
                            '<div class="fee-card">' +
                                '<div class="fee-card-label">✨ ' + t('service_fee') + '</div>' +
                                '<div class="fee-card-body">' +
                                    '<select id="serviceFeePercentSelect" onchange="APP.recalculateServiceFee()" style="min-width:80px;">' +
                                        Utils.getServiceFeePercentOptions(2) +
                                    '</select>' +
                                    '<input type="text" id="serviceFeeInput" value="0" class="amount-input" oninput="APP.onServiceFeeManualChange()">' +
                                '</div>' +
                                '<div class="fee-card-hint">💡 ' + (lang === 'id' ? 'Default 2% dari jumlah gadai' : '默认当金金额的2%') + '</div>' +
                            '</div>' +
                        '</div>' +
                        
                        // 入账方式
                        '<div class="payment-method-row">' +
                            '<span class="payment-method-label">📥 ' + t('fee_payment_method') + '</span>' +
                            '<div class="payment-method-selector compact" style="padding:0;">' +
                                '<label><input type="radio" name="feePaymentMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                '<label><input type="radio" name="feePaymentMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                            '</div>' +
                            '<div class="payment-method-hint">💡 ' + t('fee_payment_hint') + '</div>' +
                        '</div>' +
                        
                        // 利率选择
                        '<div class="form-group interest-rate-group">' +
                            '<label>📈 ' + t('interest_rate_select') + '</label>' +
                            '<select id="agreedInterestRateSelect" onchange="APP.recalculateAllFees()">' +
                                Utils.getInterestRateOptions(8) +
                            '</select>' +
                        '</div>' +
                    '</div>' +
                    
                    // ===== 还款方式 =====
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">📅</span> ' + t('repayment_method') +
                        '</div>' +
                        '<div class="repayment-cards-row">' +
                            '<div class="repayment-card selected" id="flexibleCard" onclick="document.getElementById(\'flexibleRadio\').checked=true;APP.toggleRepaymentForm(\'flexible\')">' +
                                '<div class="repayment-card-header">' +
                                    '<input type="radio" name="repaymentType" id="flexibleRadio" value="flexible" checked onchange="APP.toggleRepaymentForm(this.value)">' +
                                    '<span class="repayment-card-title">💰 ' + t('flexible_repayment') + '</span>' +
                                '</div>' +
                                '<div class="repayment-card-desc">' + t('flexible_desc') + '</div>' +
                                '<div class="repayment-card-note">' + t('max_tenor') + '</div>' +
                            '</div>' +
                            '<div class="repayment-card" id="fixedCard" onclick="document.getElementById(\'fixedRadio\').checked=true;APP.toggleRepaymentForm(\'fixed\')">' +
                                '<div class="repayment-card-header">' +
                                    '<input type="radio" name="repaymentType" id="fixedRadio" value="fixed" onchange="APP.toggleRepaymentForm(this.value)">' +
                                    '<span class="repayment-card-title">📅 ' + t('fixed_repayment') + '</span>' +
                                '</div>' +
                                '<div class="repayment-card-desc">' + t('fixed_desc') + '</div>' +
                                '<div class="repayment-card-note">' + (lang === 'id' ? 'Pilihan 1-10 bulan' : '可选1-10个月') + '</div>' +
                            '</div>' +
                            '<div id="flexibleMaxMonthsCard" class="repayment-card extension-card">' +
                                '<div class="repayment-card-header">' +
                                    '<span class="repayment-card-title">📅 ' + t('max_extension') + '</span>' +
                                '</div>' +
                                '<div class="extension-select">' +
                                    '<select id="maxExtensionMonths">' +
                                        '<option value="6">6 ' + t('month') + '</option>' +
                                        '<option value="10" selected>10 ' + t('month') + '</option>' +
                                        '<option value="12">12 ' + t('month') + '</option>' +
                                        '<option value="24">24 ' + t('month') + '</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div class="repayment-card-note extension-note">' + t('extension_limit') + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div id="fixedRepaymentForm" style="display:none;" class="fixed-repayment-form">' +
                            '<div class="form-grid">' +
                                '<div class="form-group">' +
                                    '<label>📅 ' + t('term_months') + '</label>' +
                                    '<select id="repaymentTermSelect" onchange="APP.recalculateAllFees()">' +
                                        Utils.getRepaymentTermOptions(5) +
                                    '</select>' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label>💰 ' + t('monthly_payment') + '</label>' +
                                    '<input type="text" id="monthlyPaymentInput" value="0" class="amount-input" oninput="APP.onMonthlyPaymentManualChange()">' +
                                    '<div class="form-hint">' + t('monthly_payment_rounded') + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    // ===== 备注和按钮 =====
                    '<div class="form-section">' +
                        '<div class="form-group full-width">' +
                            '<label>' + t('notes') + '</label>' +
                            '<textarea id="notes" rows="2" placeholder="' + t('notes') + '"></textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP.saveOrderForCustomer(\'' + Utils.escapeAttr(customerId) + '\')" class="success" id="saveOrderBtn">💾 ' + t('save') + '</button>' +
                            '<button onclick="APP.goBack()">↩️ ' + t('cancel') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            // 绑定金额格式化
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
            
            var serviceFeeInput = document.getElementById("serviceFeeInput");
            if (serviceFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(serviceFeeInput);
            
            var monthlyPaymentInput = document.getElementById("monthlyPaymentInput");
            if (monthlyPaymentInput && Utils.bindAmountFormat) Utils.bindAmountFormat(monthlyPaymentInput);
            
            // 初始计算
            APP.recalculateAllFees();
            
        } catch (error) {
            console.error("createOrderForCustomer 错误:", error);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
        }
    },

    // ======================================================================
    // 保存订单（新计费规则）
    // ======================================================================
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
        
        // 管理费 — 阶梯定价
        var adminFee = Utils.calculateAdminFee(amount);
        
        // 服务费
        var serviceFeePercent = parseFloat(document.getElementById("serviceFeePercentSelect")?.value) || 2;
        var serviceFeeStr = document.getElementById("serviceFeeInput").value;
        var serviceFee = Utils.parseNumberFromCommas(serviceFeeStr) || 0;
        if (serviceFee === 0 && serviceFeePercent > 0) {
            serviceFee = Math.round(amount * serviceFeePercent / 100);
        }
        
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
        
        var loanSource = document.querySelector('input[name="loanSource"]:checked')?.value || 'cash';
        var fullCollateralName = collateralNote ? collateral + ' (' + collateralNote + ')' : collateral;
        
        if (!collateral || !amount || amount <= 0) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); }
            Utils.toast.warning(t('fill_all_fields'));
            return;
        }
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const storeId = profile?.store_id;
            
            if (!storeId) {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); }
                Utils.toast.error(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                return;
            }
            
            const customer = await SUPABASE.getCustomer(customerId);
            
            const blacklistData = await SUPABASE.checkBlacklist(customer.id);
            if (blacklistData.isBlacklisted) {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); }
                Utils.toast.error(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。', 4000);
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
                store_id: storeId,
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
            
            // 记录管理费
            if (adminFee > 0) {
                try {
                    await Order.recordAdminFee(newOrder.order_id, feePaymentMethod, adminFee);
                } catch (adminFeeError) {
                    console.error("管理费收取失败:", adminFeeError);
                }
            }
            
            // 记录服务费
            if (serviceFee > 0) {
                try {
                    await Order.recordServiceFee(newOrder.order_id, 1, feePaymentMethod);
                } catch (serviceFeeError) {
                    console.error("服务费收取失败:", serviceFeeError);
                }
            }
            
            // 记录当金发放
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
            
            var successMsg = repaymentType === 'fixed'
                ? (lang === 'id' 
                    ? '✅ Pesanan berhasil dibuat!\n\nID Pesanan: ' + newOrder.order_id + '\nJenis: Cicilan Tetap\nJangka: ' + repaymentTerm + ' bulan\nAngsuran per bulan: ' + Utils.formatCurrency(monthlyFixedPayment)
                    : '✅ 订单创建成功！\n\n订单号: ' + newOrder.order_id + '\n还款方式: 固定还款\n期限: ' + repaymentTerm + '个月\n每月还款: ' + Utils.formatCurrency(monthlyFixedPayment))
                : (lang === 'id'
                    ? '✅ Pesanan berhasil dibuat!\n\nID Pesanan: ' + newOrder.order_id + '\nJenis: Cicilan Fleksibel\nMaksimal perpanjangan: ' + maxExtensionMonths + ' bulan'
                    : '✅ 订单创建成功！\n\n订单号: ' + newOrder.order_id + '\n还款方式: 灵活还款\n最长可延期: ' + maxExtensionMonths + '个月');
            
            Utils.toast.success(successMsg, 5000);
            
            // 重置表单
            document.getElementById("collateral").value = '';
            document.getElementById("collateralNote").value = '';
            document.getElementById("amount").value = '';
            document.getElementById("notes").value = '';
            
            var svcSelect = document.getElementById("serviceFeePercentSelect");
            if (svcSelect) { svcSelect.value = '2'; delete svcSelect.dataset.manual; }
            
            var svcInput = document.getElementById("serviceFeeInput");
            if (svcInput) { svcInput.value = '0'; delete svcInput.dataset.manual; }
            
            var cashRadio = document.querySelector('input[name="feePaymentMethod"][value="cash"]');
            if (cashRadio) cashRadio.checked = true;
            
            var loanCashRadio = document.querySelector('input[name="loanSource"][value="cash"]');
            if (loanCashRadio) loanCashRadio.checked = true;
            
            var interestSelect = document.getElementById("agreedInterestRateSelect");
            if (interestSelect) interestSelect.value = '8';
            
            var flexibleRadio = document.getElementById("flexibleRadio");
            if (flexibleRadio) { flexibleRadio.checked = true; APP.toggleRepaymentForm('flexible'); }
            
            APP.recalculateAllFees();
            
            var monthlyInput = document.getElementById("monthlyPaymentInput");
            if (monthlyInput) { monthlyInput.value = '0'; delete monthlyInput.dataset.manual; }
            
            document.getElementById("collateral").focus();
            
        } catch (error) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); }
            console.error("saveOrderForCustomer error:", error);
            Utils.toast.error(t('save_failed') + ': ' + error.message);
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); }
        }
    },

    // ======================================================================
    // 费用自动计算（新计费规则）
    // ======================================================================
    recalculateAllFees: function() {
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        
        // 管理费 — 阶梯定价（只读，自动计算）
        var adminFee = Utils.calculateAdminFee(amount);
        var adminFeeInput = document.getElementById('adminFeeInput');
        if (adminFeeInput) {
            adminFeeInput.value = Utils.formatNumberWithCommas(adminFee);
        }
        
        // 服务费
        var serviceFeeSelect = document.getElementById('serviceFeePercentSelect');
        var serviceFeeInput = document.getElementById('serviceFeeInput');
        var percent = serviceFeeSelect ? parseFloat(serviceFeeSelect.value) : 2;
        if (serviceFeeInput && !serviceFeeInput.dataset.manual) {
            var fee = Math.round(amount * percent / 100);
            serviceFeeInput.value = Utils.formatNumberWithCommas(fee);
        }
        
        // 固定还款 — 月供
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

    recalculateServiceFee: function() {
        var select = document.getElementById('serviceFeePercentSelect');
        if (select) select.dataset.manual = 'true';
        
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var percent = select ? parseFloat(select.value) : 2;
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
        var flexibleCardDiv = document.getElementById('flexibleCard');
        var fixedCardDiv = document.getElementById('fixedCard');
        
        if (fixedForm) fixedForm.style.display = value === 'fixed' ? 'block' : 'none';
        if (flexibleCard) flexibleCard.style.display = value === 'flexible' ? 'block' : 'none';
        
        if (flexibleCardDiv) flexibleCardDiv.classList.toggle('selected', value === 'flexible');
        if (fixedCardDiv) fixedCardDiv.classList.toggle('selected', value === 'fixed');
        
        if (value === 'fixed') APP.recalculateAllFees();
    },

    // ==================== 客户订单列表 ====================
    showCustomerOrders: async function(customerId) {
        APP.currentPage = 'customerOrders';
        APP.currentCustomerId = customerId;
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            const client = SUPABASE.getClient();
            const { data: orders, error } = await client
                .from('orders')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            
            var rows = '';
            if (!orders || orders.length === 0) {
                rows = '<tr><td colspan="7" class="text-center">' + t('no_data') + '</tr>';
            } else {
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated');
                    var repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';
                    var repaymentTypeText = o.repayment_type === 'fixed' ? t('fixed_repayment') : t('flexible_repayment');
                    
                    rows += '<tr>' +
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(o.created_at) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.principal_paid) + '</td>' +
                        '<td class="text-center">' + o.interest_paid_months + ' ' + t('month') + '</td>' +
                        '<td class="text-center"><span class="badge badge-repayment-' + repaymentClass + '">' + repaymentTypeText + '</span></td>' +
                        '<td class="text-center"><span class="badge badge-' + sc + '">' + (statusMap[o.status] || o.status) + '</span></td>' +
                    '</tr>';
                    
                    var actionButtons = '';
                    if (o.status === 'active' && !AUTH.isAdmin()) {
                        actionButtons += '<button onclick="APP.navigateTo(\'payment\',{orderId:\'' + Utils.escapeAttr(o.order_id) + '\'})" class="btn-small success">💰 ' + t('pay_fee') + '</button>';
                    }
                    actionButtons += '<button onclick="APP.navigateTo(\'viewOrder\',{orderId:\'' + Utils.escapeAttr(o.order_id) + '\'})" class="btn-small">👁️ ' + t('view') + '</button>';
                    
                    rows += '<tr class="action-row">' +
                        '<td class="action-label">' + t('action') + '</td>' +
                        '<td colspan="6">' +
                            '<div class="action-buttons">' + actionButtons + '</div>' +
                        '</td>' +
                    '</tr>';
                }
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📋 ' + t('customer_orders') + ' - ' + Utils.escapeHtml(customer.name) + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card customer-summary">' +
                    '<p><strong>' + t('customer_id') + ':</strong> ' + Utils.escapeHtml(customer.customer_id || '-') + '</p>' +
                    '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                    '<p><strong>' + t('ktp_number') + ':</strong> ' + Utils.escapeHtml(customer.ktp_number || '-') + '</p>' +
                    '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                    '<p><strong>' + t('occupation') + ':</strong> ' + Utils.escapeHtml(customer.occupation || '-') + '</p>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>📋 ' + t('order_list') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead><tr><th class="col-id">ID</th><th class="col-date">' + t('date') + '</th><th class="col-amount amount">' + t('loan_amount') + '</th><th class="col-amount amount">' + t('principal_paid') + '</th><th class="col-months text-center">' + t('interest') + '</th><th class="col-status text-center">' + t('repayment_type') + '</th><th class="col-status text-center">' + t('status') + '</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
        } catch (error) {
            console.error("showCustomerOrders error:", error);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败');
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
            const customer = await SUPABASE.getCustomer(customerId);
            const client = SUPABASE.getClient();
            const { data: orders } = await client.from('orders').select('id, order_id').eq('customer_id', customerId);
            var orderIds = [];
            if (orders) { for (var i = 0; i < orders.length; i++) { orderIds.push(orders[i].id); } }
            var allPayments = [];
            if (orderIds.length > 0) {
                const { data } = await client.from('payment_history').select('*, orders(order_id, customer_name)').in('order_id', orderIds).order('date', { ascending: false });
                allPayments = data || [];
            }
            var typeMap = { admin_fee: t('admin_fee'), service_fee: t('service_fee'), interest: t('interest'), principal: t('principal') };
            
            var rows = '';
            if (allPayments.length === 0) {
                rows = '<tr><td colspan="7" class="text-center">' + t('no_data') + '</td>';
            } else {
                for (var i = 0; i < allPayments.length; i++) {
                    var p = allPayments[i];
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td class="order-id">' + Utils.escapeHtml(p.orders?.order_id || '-') + '</td>' +
                        '<td class="col-type">' + (typeMap[p.type] || p.type) + '</td>' +
                        '<td class="text-center">' + (p.months ? p.months + ' ' + t('month') : '-') + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="text-center"><span class="badge badge-method-' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                        '<td class="desc-cell">' + Utils.escapeHtml(p.description || '-') + '</td>' +
                    '</tr>';
                }
            }
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + t('payment_history') + ' - ' + Utils.escapeHtml(customer.name) + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card customer-summary">' +
                    '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                    '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                    '<p><strong>' + t('occupation') + ':</strong> ' + Utils.escapeHtml(customer.occupation || '-') + '</p>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>💰 ' + t('payment_history') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead><tr><th class="col-date">' + t('date') + '</th><th class="col-id">' + t('order_id') + '</th><th class="col-type">' + t('type') + '</th><th class="col-months text-center">' + t('month') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + t('payment_method') + '</th><th class="col-desc">' + t('description') + '</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
        } catch (error) {
            console.error("showCustomerPaymentHistory error:", error);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败');
        }
    }
};

// 挂载到 window.APP
for (var key in CustomersModule) {
    if (CustomersModule.hasOwnProperty(key) && typeof CustomersModule[key] === 'function') {
        window.APP[key] = CustomersModule[key];
    }
}
