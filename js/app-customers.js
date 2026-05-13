// app-customers.js - v2.0 (JF 命名空间) 服务费下拉始终可操作，根据选择计算金额

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const CustomersPage = {

        // ==================== 构建客户列表 HTML（活跃订单状态区分） ====================
        async buildCustomersHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();

            try {
                const [customers, stores] = await Promise.all([
                    SUPABASE.getCustomers(),
                    SUPABASE.getAllStores()
                ]);
                const storeMap = {};
                for (const s of stores) storeMap[s.id] = s.name;

                const client = SUPABASE.getClient();
                const customerIds = (customers || []).map(c => c.id);
                const activeOrderMap = {};
                if (customerIds.length > 0) {
                    const BATCH_SIZE = 50;
                    for (let i = 0; i < customerIds.length; i += BATCH_SIZE) {
                        const batch = customerIds.slice(i, i + BATCH_SIZE);
                        const { data: activeOrders } = await client
                            .from('orders')
                            .select('customer_id, order_id')
                            .eq('status', 'active')
                            .in('customer_id', batch);
                        for (const o of (activeOrders || [])) {
                            if (!activeOrderMap[o.customer_id]) {
                                activeOrderMap[o.customer_id] = [];
                            }
                            activeOrderMap[o.customer_id].push(o.order_id);
                        }
                    }
                }

                const totalCols = 7;
                let rows = '';
                if (!customers || customers.length === 0) {
                    rows = `<tr><td colspan="${totalCols}" class="text-center">${t('no_data')}</td></tr>`;
                } else {
                    for (const c of customers) {
                        const customerId = Utils.escapeHtml(c.customer_id || '-');
                        const name = Utils.escapeHtml(c.name);
                        const phone = Utils.escapeHtml(c.phone || '-');
                        const ktpNumber = Utils.escapeHtml(c.ktp_number || '-');
                        const occupation = Utils.escapeHtml(c.occupation || '-');

                        const hasActiveOrders = activeOrderMap[c.id] && activeOrderMap[c.id].length > 0;
                        let createBtnHtml;
                        if (hasActiveOrders) {
                            const orderList = activeOrderMap[c.id].join(', ');
                            createBtnHtml = `<button class="btn btn--sm" style="background:#94a3b8;color:#fff;opacity:0.7;cursor:not-allowed;" disabled
                                title="${lang === 'id' ? 'Memiliki pesanan aktif: ' + orderList : '有活跃订单: ' + orderList}">
                                🔒 ${lang === 'id' ? 'Pesanan Aktif' : '活跃订单中'}
                            </button>`;
                        } else {
                            createBtnHtml = `<button onclick="APP.createOrderForCustomer('${Utils.escapeAttr(c.id)}')" class="btn btn--success btn--sm">➕ ${t('create_order_for')}</button>`;
                        }

                        rows += `<tr class="data-row">
                            <td class="col-id">${customerId}</td>
                            <td class="col-name">${name}</td>
                            <td class="col-phone">${phone}</td>
                            <td class="col-ktp">${ktpNumber}</td>
                            <td class="col-occupation">${occupation}</td>
                            <td class="text-center">${createBtnHtml}</td>
                            <td class="text-center"><button onclick="APP.showCustomerDetailCard('${Utils.escapeAttr(c.id)}')" class="btn btn--sm">📋 ${t('detail')}</button></td>
                        </tr>`;
                    }
                }

                let addCustomerCardHtml = '';
                if (!isAdmin) {
                    addCustomerCardHtml =
                        `<div class="card">
                            <h3>➕ ${t('add_customer')}</h3>
                            <div class="form-grid order-first-row">
                                <div class="form-group"><label>${t('customer_name')} *</label><input type="text" id="customerName" placeholder="${t('customer_name')}"></div>
                                <div class="form-group"><label>${t('phone')} *</label><input type="text" id="customerPhone" placeholder="${t('phone')}"></div>
                                <div class="form-group"><label>${t('ktp_number')}</label><input type="text" id="customerKtp" placeholder="${t('ktp_number')}"></div>
                                <div class="form-group"><label>${t('occupation')} <small style="font-weight:400;color:var(--text-muted);">${lang === 'id' ? '(opsional)' : '(选填)'}</small></label><input type="text" id="customerOccupation" placeholder="${lang === 'id' ? 'Contoh: PNS, Karyawan Swasta' : '例如: 公务员, 企业员工'}"></div>
                                <div class="form-group"><label>📅 ${lang === 'id' ? 'Tanggal Daftar' : '注册日期'} <small style="font-weight:400;color:var(--text-muted);">(${lang === 'id' ? 'bisa diubah untuk data lama' : '可修改为历史日期'})</small></label><input type="date" id="customerRegDate" value="${Utils.getLocalToday()}"></div>
                                <div class="form-group full-width"><label>${t('ktp_address')}</label><textarea id="customerKtpAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址'}"></textarea></div>
                                <div class="form-group full-width">
                                    <label>${t('living_address')}</label>
                                    <div class="address-option">
                                        <label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ${t('same_as_ktp')}</label>
                                        <label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ${t('different_from_ktp')}</label>
                                    </div>
                                    <textarea id="customerLivingAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址'}" style="display:none;margin-top:8px;"></textarea>
                                </div>
                                <div class="form-actions"><button onclick="APP.addCustomer()" class="btn btn--success" id="addCustomerBtn">💾 ${t('save_customer')}</button></div>
                            </div>
                        </div>`;
                }

                const content = `
                    <div class="page-header">
                        <h2>👥 ${t('customers')}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                            <button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${t('print')}</button>
                        </div>
                    </div>
                    <div class="card">
                        <h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                        <div class="table-container">
                            <table class="data-table customer-list-table">
                                <thead><tr>
                                    <th class="col-id">${t('customer_id')}</th>
                                    <th class="col-name">${t('customer_name')}</th>
                                    <th class="col-ktp">${t('ktp_number')}</th>
                                    <th class="col-phone">${t('phone')}</th>
                                    <th class="col-occupation">${t('occupation')}</th>
                                    <th class="text-center">${t('create_order_for')}</th>
                                    <th class="text-center">${t('action')}</th>
                                </tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    ${addCustomerCardHtml}`;
                return content;
            } catch (error) {
                console.error("buildCustomersHTML error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
                return `<div class="card"><p>❌ ${t('loading_failed', { module: '客户' })}</p></div>`;
            }
        },

        async renderCustomersHTML() {
            return await this.buildCustomersHTML();
        },

        async showCustomers() {
            APP.currentPage = 'customers';
            APP.saveCurrentPageState();
            const contentHTML = await this.buildCustomersHTML();
            document.getElementById("app").innerHTML = contentHTML;
        },

        toggleLivingAddress(value) {
            const el = document.getElementById('customerLivingAddress');
            if (el) el.style.display = value === 'different' ? 'block' : 'none';
        },

        // ==================== 添加客户 ====================
        addCustomer: async function () {
            const isAdmin = PERMISSION.isAdmin();
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            if (isAdmin) { Utils.toast.warning(t('store_operation')); return; }

            const addBtn = document.getElementById('addCustomerBtn');
            if (addBtn) { addBtn.disabled = true; addBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...'); }

            const name = document.getElementById("customerName").value.trim();
            const ktp = document.getElementById("customerKtp").value.trim();
            const phone = document.getElementById("customerPhone").value.trim();
            const occupation = document.getElementById("customerOccupation").value.trim();
            const ktpAddress = document.getElementById("customerKtpAddress").value.trim();
            const regDateInput = document.getElementById("customerRegDate");
            const registeredDate = (regDateInput && regDateInput.value) ? regDateInput.value : Utils.getLocalToday();
            const livingOpt = document.querySelector('input[name="livingAddrOpt"]:checked')?.value || 'same';
            const livingSameAsKtp = livingOpt === 'same';
            const livingAddress = livingSameAsKtp ? null : document.getElementById("customerLivingAddress").value.trim();

            if (!name) { if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); } Utils.toast.warning(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写'); return; }
            if (!phone) { if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); } Utils.toast.warning(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写'); return; }

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const storeId = profile?.store_id;
                if (!storeId) { if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); } Utils.toast.error(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店'); return; }

                if (ktp || phone) {
                    try {
                        const blacklistedCustomer = await SUPABASE.checkBlacklistDuplicate(ktp, phone);
                        if (blacklistedCustomer) {
                            let reason = '';
                            if (ktp && blacklistedCustomer.ktp_number === ktp) {
                                reason = lang === 'id'
                                    ? `Nomor KTP ${ktp} sudah terdaftar di blacklist (Nasabah: ${blacklistedCustomer.name})\n\nTidak dapat menambahkan nasabah baru dengan data yang sama.`
                                    : `身份证号 ${ktp} 已被拉黑（客户：${blacklistedCustomer.name}）\n\n无法添加相同信息的客户。`;
                            } else if (phone && blacklistedCustomer.phone === phone) {
                                reason = lang === 'id'
                                    ? `Nomor telepon ${phone} sudah terdaftar di blacklist (Nasabah: ${blacklistedCustomer.name})\n\nTidak dapat menambahkan nasabah baru dengan data yang sama.`
                                    : `手机号 ${phone} 已被拉黑（客户：${blacklistedCustomer.name}）\n\n无法添加相同信息的客户。`;
                            }
                            Utils.toast.error(reason, 5000);
                            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
                            return;
                        }
                    } catch (blErr) { console.warn('黑名单重复检查失败:', blErr.message); }
                }

                let maxRetries = 8, lastError = null, newCustomer = null;
                for (let attempt = 0; attempt < maxRetries; attempt++) {
                    try {
                        const prefix = await SUPABASE._getStorePrefix(storeId);
                        const client = SUPABASE.getClient();
                        const { data: customers, error: queryError } = await client
                            .from('customers').select('customer_id').like('customer_id', prefix + '%')
                            .order('customer_id', { ascending: false }).limit(1);
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
                            customer_id: customerId, store_id: storeId, name,
                            ktp_number: ktp || null, phone, occupation: occupation || null,
                            ktp_address: ktpAddress || null, address: ktpAddress || null,
                            living_same_as_ktp: livingSameAsKtp, living_address: livingAddress || null,
                            registered_date: registeredDate, created_by: profile.id
                        };
                        const { data, error } = await client.from('customers').insert(customerData).select().single();
                        if (error) {
                            if (error.code === '23505') {
                                console.warn(`客户ID ${customerId} 冲突，重试第 ${attempt + 1}/${maxRetries} 次`);
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
                await CustomersPage.showCustomers();
            } catch (error) {
                if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
                console.error("addCustomer error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            }
        },

        // ==================== 客户详情卡片 ====================
        showCustomerDetailCard: async function (customerId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();
            const profile = await SUPABASE.getCurrentProfile();

            try {
                const customer = await SUPABASE.getCustomer(customerId);
                if (!customer) throw new Error(t('order_not_found'));

                let isBlacklisted = false, blacklistReason = '';
                try {
                    const blResult = await SUPABASE.checkBlacklist(customer.id);
                    if (blResult.isBlacklisted) { isBlacklisted = true; blacklistReason = blResult.reason; }
                } catch (blErr) { console.warn('黑名单检查失败:', blErr.message); }

                const { activeCount, completedCount, abnormalCount } = await SUPABASE.getCustomerOrdersStats(customerId);

                const registeredDate = Utils.formatDate(customer.registered_date);
                const ktpAddress = Utils.escapeHtml(customer.ktp_address || customer.address || '-');
                const livingAddress = Utils.escapeHtml(
                    customer.living_same_as_ktp !== false ? t('same_as_ktp') : (customer.living_address || '-')
                );

                const orderStatsHtml =
                    `<div class="order-stats">
                        <div class="stat-item active" onclick="APP.showCustomerOrdersByStatus('${Utils.escapeAttr(customerId)}', 'active')" style="cursor:pointer;">
                            <span class="stat-number">${activeCount}</span><span class="stat-label">${t('active_orders')}</span>
                        </div>
                        <div class="stat-item completed" onclick="APP.showCustomerOrdersByStatus('${Utils.escapeAttr(customerId)}', 'completed')" style="cursor:pointer;">
                            <span class="stat-number">${completedCount}</span><span class="stat-label">${t('completed_orders')}</span>
                        </div>
                        <div class="stat-item abnormal" onclick="APP.showCustomerOrdersByStatus('${Utils.escapeAttr(customerId)}', 'abnormal')" style="cursor:pointer;">
                            <span class="stat-number">${abnormalCount}</span><span class="stat-label">${t('abnormal_orders')}</span>
                        </div>
                    </div>`;

                const blacklistBadge = isBlacklisted
                    ? `<div class="info-bar warning" style="margin:0 0 12px 0; padding:6px 12px;"><small>⚠️ ${Utils.escapeHtml(blacklistReason)}</small></div>` : '';

                const canEdit = isAdmin;
                const canBlacklist = !isBlacklisted;
                const canUnblacklist = isAdmin && isBlacklisted;
                const canDelete = isAdmin;

                const modalHtml =
                    `<div id="customerDetailCard" class="modal-overlay customer-detail-card">
                        <div class="modal-content" style="max-width:780px;">
                            <h3 style="display:flex; justify-content:space-between; align-items:center;">
                                <span>📋 ${t('customer_detail')} - ${Utils.escapeHtml(customer.name)}</span>
                                <button onclick="document.getElementById('customerDetailCard').remove()" style="background:none; border:none; font-size:20px; cursor:pointer;">✖</button>
                            </h3>
                            ${blacklistBadge}
                            <div class="form-section">
                                <div class="info-display">
                                    <div class="info-display-item"><span class="info-label">${t('registered_date')}:</span><span class="info-value">${registeredDate}</span></div>
                                    <div class="info-display-item"><span class="info-label">${t('ktp_address')}:</span><span class="info-value">${ktpAddress}</span></div>
                                    <div class="info-display-item"><span class="info-label">${t('living_address')}:</span><span class="info-value">${livingAddress}</span></div>
                                </div>
                            </div>
                            <div class="form-section">
                                <div class="form-section-title">📋 ${t('order_stats')}</div>
                                ${orderStatsHtml}
                            </div>
                            <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-light); flex-wrap:wrap;">
                                ${canEdit ? `<button onclick="APP.editCustomerFromCard('${Utils.escapeAttr(customerId)}')" class="btn btn--primary btn--sm">✏️ ${t('edit')}</button>` : ''}
                                ${canBlacklist ? `<button onclick="APP.blacklistFromCard('${Utils.escapeAttr(customer.id)}', '${Utils.escapeAttr(customer.name)}')" class="btn btn--danger btn--sm">🚫 ${t('blacklist_customer')}</button>` : ''}
                                ${canUnblacklist ? `<button onclick="APP.unblacklistFromCard('${Utils.escapeAttr(customer.id)}')" class="btn btn--warning btn--sm">🔓 ${t('unblacklist_customer')}</button>` : ''}
                                ${canDelete ? `<button onclick="APP.deleteCustomerFromCard('${Utils.escapeAttr(customer.id)}', '${Utils.escapeAttr(customer.name)}')" class="btn btn--danger btn--sm">🗑️ ${t('delete')}</button>` : ''}
                                <button onclick="document.getElementById('customerDetailCard').remove()" class="btn btn--outline btn--sm">✖ ${t('cancel')}</button>
                            </div>
                        </div>
                    </div>`;

                const oldModal = document.getElementById('customerDetailCard');
                if (oldModal) oldModal.remove();
                document.body.insertAdjacentHTML('beforeend', modalHtml);
            } catch (error) {
                console.error("showCustomerDetailCard error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat detail nasabah' : '加载客户详情失败');
            }
        },

        editCustomerFromCard: async function (customerId) { 
            const modal = document.getElementById('customerDetailCard'); 
            if (modal) modal.remove(); 
            await CustomersPage.editCustomer(customerId); 
        },

        blacklistFromCard: async function (customerUuid, customerName) {
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils); 
            const modal = document.getElementById('customerDetailCard'); 
            if (modal) modal.remove();
            const reason = prompt(lang === 'id' ? `Masukkan alasan blacklist untuk nasabah "${customerName}":\n\nContoh: Telat bayar, Penipuan, dll.` : `请输入拉黑客户 "${customerName}" 的原因：\n\n例如：逾期未还、欺诈等。`, lang === 'id' ? 'Telat bayar' : '逾期未还');
            if (!reason || reason.trim() === '') { Utils.toast.warning(t('fill_all_fields')); return; }
            const confirmMsg = lang === 'id' ? `⚠️ Yakin akan blacklist nasabah ini?\n\nNama: ${customerName}\nAlasan: ${reason}\n\nNasabah yang di-blacklist tidak dapat membuat order baru.` : `⚠️ 确认拉黑此客户？\n\n客户名: ${customerName}\n原因: ${reason}\n\n被拉黑的客户将无法创建新订单。`;
            const confirmed = await Utils.toast.confirm(confirmMsg); 
            if (!confirmed) return;
            try { 
                await window.APP.addToBlacklist(customerUuid, reason); 
                Utils.toast.success(lang === 'id' ? `Nasabah "${customerName}" telah ditambahkan ke blacklist.` : `客户 "${customerName}" 已加入黑名单。`); 
                await CustomersPage.showCustomers(); 
            } catch (error) { 
                Utils.toast.error(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + error.message : '拉黑失败：' + error.message); 
            }
        },

        unblacklistFromCard: async function (customerUuid) {
            const lang = Utils.lang; 
            const confirmMsg = lang === 'id' ? 'Yakin ingin membuka blacklist nasabah ini?' : '确认解除此客户的拉黑？'; 
            const confirmed = await Utils.toast.confirm(confirmMsg); 
            if (!confirmed) return;
            try { 
                await window.APP.removeFromBlacklist(customerUuid); 
                Utils.toast.success(lang === 'id' ? 'Blacklist berhasil dibuka' : '已解除拉黑'); 
                const modal = document.getElementById('customerDetailCard'); 
                if (modal) modal.remove(); 
                await CustomersPage.showCustomers(); 
            } catch (error) { 
                Utils.toast.error(lang === 'id' ? 'Gagal membuka blacklist: ' + error.message : '解除拉黑失败：' + error.message); 
            }
        },

        deleteCustomerFromCard: async function (customerId, customerName) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();
            
            if (!isAdmin) {
                Utils.toast.warning(t('store_operation'));
                return;
            }
            
            try {
                const client = SUPABASE.getClient();
                const { data: activeOrders, error } = await client
                    .from('orders')
                    .select('id, status, order_id')
                    .eq('customer_id', customerId)
                    .eq('status', 'active');
                    
                if (error) throw error;
                
                if (activeOrders && activeOrders.length > 0) {
                    const orderList = activeOrders.map(o => o.order_id).join(', ');
                    Utils.toast.warning(lang === 'id' 
                        ? `Nasabah masih memiliki ${activeOrders.length} pesanan aktif: ${orderList}\n\nSelesaikan pesanan terlebih dahulu sebelum menghapus nasabah.`
                        : `客户仍有 ${activeOrders.length} 个进行中的订单: ${orderList}\n\n请先结清订单再删除客户。`, 6000);
                    return;
                }
                
                const confirmMsg = lang === 'id'
                    ? `⚠️ HAPUS NASABAH "${customerName}"?\n\nSemua data berikut akan dihapus:\n• Data nasabah\n• Semua pesanan (riwayat lengkap)\n• Riwayat pembayaran\n• Catatan blacklist (jika ada)\n\n⚠️ TINDAKAN INI TIDAK DAPAT DIBATALKAN!`
                    : `⚠️ 删除客户 "${customerName}"？\n\n以下数据将被删除：\n• 客户基本信息\n• 所有订单记录\n• 缴费历史记录\n• 黑名单记录（如有）\n\n⚠️ 此操作不可撤销！`;
                
                const confirmed = await Utils.toast.confirm(confirmMsg);
                if (!confirmed) return;
                
                await CustomersPage.deleteCustomer(customerId);
                
                const modal = document.getElementById('customerDetailCard');
                if (modal) modal.remove();
                
                await CustomersPage.showCustomers();
                
            } catch (error) {
                console.error("deleteCustomerFromCard error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
            }
        },

        showCustomerOrdersByStatus: async function (customerId, statusType) {
            const lang = Utils.lang; 
            try { 
                const customer = await SUPABASE.getCustomer(customerId); 
                if (!customer) return; 
                const modal = document.getElementById('customerDetailCard'); 
                if (modal) modal.remove(); 
                APP.currentCustomerId = customerId; 
                APP.showCustomerOrders(customerId); 
            } catch (error) { 
                console.error("showCustomerOrdersByStatus error:", error); 
                Utils.toast.error(lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败'); 
            }
        },

        editCustomer: async function (customerId) {
            const isAdmin = PERMISSION.isAdmin(); 
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils); 
            if (!isAdmin) { Utils.toast.warning(t('store_operation')); return; }
            try {
                const client = SUPABASE.getClient(); 
                const { data: c, error } = await client.from('customers').select('*').eq('id', customerId).single(); 
                if (error) throw error; 
                const livingSame = c.living_same_as_ktp !== false;
                const modal = document.createElement('div'); 
                modal.id = 'editCustomerModal'; 
                modal.className = 'modal-overlay';
                modal.innerHTML = `<div class="modal-content" style="max-width:600px;"><h3>✏️ ${t('edit_customer')}</h3><div class="form-grid order-first-row"><div class="form-group"><label>${t('customer_name')} *</label><input id="ec_name" value="${Utils.escapeHtml(c.name)}"></div><div class="form-group"><label>${t('phone')} *</label><input id="ec_phone" value="${Utils.escapeHtml(c.phone || '')}"></div><div class="form-group"><label>${t('ktp_number')}</label><input id="ec_ktp" value="${Utils.escapeHtml(c.ktp_number || '')}"></div><div class="form-group"><label>${t('occupation')}</label><input id="ec_occupation" value="${Utils.escapeHtml(c.occupation || '')}"></div><div class="form-group full-width"><label>${t('ktp_address')}</label><textarea id="ec_ktpAddr" rows="2">${Utils.escapeHtml(c.ktp_address || c.address || '')}</textarea></div><div class="form-group full-width"><label>${t('living_address')}</label><div class="address-option"><label><input type="radio" name="ec_livingOpt" value="same" ${livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)"> ${t('same_as_ktp')}</label><label><input type="radio" name="ec_livingOpt" value="different" ${!livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)"> ${t('different_from_ktp')}</label></div><textarea id="ec_livingAddr" rows="2" style="margin-top:8px;${livingSame ? 'display:none;' : ''}">${Utils.escapeHtml(c.living_address || '')}</textarea></div><div class="form-actions"><button onclick="APP._saveEditCustomer('${Utils.escapeAttr(customerId)}')" class="btn btn--success">💾 ${t('save')}</button><button onclick="document.getElementById('editCustomerModal').remove()" class="btn btn--outline">✖ ${t('cancel')}</button></div></div></div>`;
                document.body.appendChild(modal);
            } catch (e) { 
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data: ' + e.message : '加载失败：' + e.message); 
            }
        },

        _toggleEditLiving(val) { 
            const el = document.getElementById('ec_livingAddr'); 
            if (el) el.style.display = val === 'different' ? 'block' : 'none'; 
        },

        _saveEditCustomer: async function (customerId) {
            const isAdmin = PERMISSION.isAdmin(); 
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils); 
            if (!isAdmin) { Utils.toast.warning(t('store_operation')); return; }
            const name = document.getElementById('ec_name').value.trim(); 
            const phone = document.getElementById('ec_phone').value.trim(); 
            const ktp = document.getElementById('ec_ktp').value.trim(); 
            const occupation = document.getElementById('ec_occupation').value.trim(); 
            const ktpAddr = document.getElementById('ec_ktpAddr').value.trim(); 
            const livingOpt = document.querySelector('input[name="ec_livingOpt"]:checked')?.value || 'same'; 
            const livingSame = livingOpt === 'same'; 
            const livingAddr = livingSame ? null : document.getElementById('ec_livingAddr').value.trim();
            if (!name || !phone) { Utils.toast.warning(lang === 'id' ? 'Nama dan telepon wajib diisi' : '姓名和手机号必须填写'); return; }
            try {
                const client = SUPABASE.getClient(); 
                const { error } = await client.from('customers').update({ 
                    name, phone, ktp_number: ktp || null, occupation: occupation || null, 
                    ktp_address: ktpAddr || null, address: ktpAddr || null, 
                    living_same_as_ktp: livingSame, living_address: livingAddr || null, 
                    updated_at: Utils.getLocalDateTime() 
                }).eq('id', customerId);
                if (error) throw error; 
                document.getElementById('editCustomerModal')?.remove(); 
                Utils.toast.success(lang === 'id' ? 'Data nasabah diperbarui' : '客户信息已更新'); 
                if (window.APP.clearAnomalyCache) window.APP.clearAnomalyCache(); 
                await CustomersPage.showCustomers();
            } catch (e) { 
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + e.message : '保存失败：' + e.message); 
            }
        },

        deleteCustomer: async function (customerId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const client = SUPABASE.getClient();
            
            const { data: customer } = await client.from('customers').select('name, customer_id').eq('id', customerId).single();
            const customerName = customer?.name || 'Unknown';
            
            try {
                const { data: orders, error: ordersError } = await client
                    .from('orders')
                    .select('id')
                    .eq('customer_id', customerId);
                    
                if (ordersError) throw ordersError;
                
                const orderIds = (orders || []).map(o => o.id);
                
                if (orderIds.length > 0) {
                    const { error: payError } = await client
                        .from('payment_history')
                        .delete()
                        .in('order_id', orderIds);
                    if (payError) console.warn('删除缴费记录失败:', payError.message);
                }
                
                if (orderIds.length > 0) {
                    const { error: flowError } = await client
                        .from('cash_flow_records')
                        .delete()
                        .in('order_id', orderIds);
                    if (flowError) console.warn('删除现金流记录失败:', flowError.message);
                    
                    const { error: refError } = await client
                        .from('cash_flow_records')
                        .delete()
                        .eq('customer_id', customerId);
                    if (refError) console.warn('删除关联现金流失败:', refError.message);
                }
                
                if (orderIds.length > 0) {
                    const { error: remindError } = await client
                        .from('reminder_logs')
                        .delete()
                        .in('order_id', orderIds);
                    if (remindError) console.warn('删除提醒记录失败:', remindError.message);
                }
                
                const { error: orderDeleteError } = await client
                    .from('orders')
                    .delete()
                    .eq('customer_id', customerId);
                if (orderDeleteError) throw orderDeleteError;
                
                const { error: blacklistError } = await client
                    .from('blacklist')
                    .delete()
                    .eq('customer_id', customerId);
                if (blacklistError) console.warn('删除黑名单记录失败:', blacklistError.message);
                
                const { error: customerError } = await client
                    .from('customers')
                    .delete()
                    .eq('id', customerId);
                if (customerError) throw customerError;
                
                if (window.Audit) {
                    await window.Audit.log('customer_delete', JSON.stringify({
                        customer_id: customerId,
                        customer_name: customerName,
                        deleted_by: (await SUPABASE.getCurrentProfile())?.name,
                        deleted_at: new Date().toISOString()
                    }));
                }
                
                Utils.toast.success(lang === 'id' 
                    ? `Nasabah "${customerName}" berhasil dihapus` 
                    : `客户 "${customerName}" 已删除`);
                
                if (window.APP.clearAnomalyCache) window.APP.clearAnomalyCache();
                SUPABASE.clearCache();
                
            } catch (e) {
                console.error('删除客户异常:', e);
                Utils.toast.error(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message);
                throw e;
            }
        },

        // ==================== 为客户创建订单 ====================
        createOrderForCustomer: async function (customerId) {
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils); 
            const profile = await SUPABASE.getCurrentProfile(); 
            if (!profile) { Utils.toast.error(lang === 'id' ? 'Gagal memuat data user' : '加载用户数据失败'); return; }
            if (PERMISSION.isAdmin()) { Utils.toast.warning(t('store_operation')); return; } 
            if (!customerId) { Utils.toast.warning(lang === 'id' ? 'ID nasabah tidak valid' : '客户ID无效'); return; }
            try {
                const customer = await SUPABASE.getCustomer(customerId); 
                if (!customer) throw new Error(lang === 'id' ? 'Data nasabah tidak ditemukan' : '找不到客户数据');
                const blacklistCheck = await SUPABASE.checkBlacklist(customer.id).catch(() => ({ isBlacklisted: false }));
                if (blacklistCheck.isBlacklisted) { Utils.toast.error(lang === 'id' ? 'Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '此客户已被拉黑，无法创建新订单。', 4000); return; }
                const { data: existingOrders } = await SUPABASE.getClient().from('orders').select('status').eq('customer_id', customerId).eq('status', 'active');
                if (existingOrders && existingOrders.length > 0) { Utils.toast.warning(lang === 'id' ? 'Nasabah ini masih memiliki pesanan aktif.' : '该客户还有未结清的订单。'); return; }
                APP.currentPage = 'createOrder'; 
                APP.currentCustomerId = customerId; 
                const occupationDisplay = Utils.escapeHtml(customer.occupation || '-');

                const adminFeeHintText = lang === 'id'
                    ? `• Nilai gadai ≤ Rp500.000 : biaya administrasi Rp20.000\n• Nilai gadai Rp500.000 – Rp3.000.000 : biaya administrasi Rp30.000\n• Nilai gadai > Rp3.000.000 : dikenakan biaya administrasi sebesar 1% dari nilai gadai`
                    : `• 当金 ≤ Rp500,000 ：管理费 Rp20,000\n• 当金 Rp500,000 ～ Rp3,000,000 ：管理费 Rp30,000\n• 当金 > Rp3,000,000 ：按当金的 1% 收取管理费`;

                const serviceFeeHintText = lang === 'id'
                    ? `• Silakan pilih persentase biaya layanan (0% - 12%)\n• Biaya akan dihitung otomatis berdasarkan persentase dan nilai gadai.`
                    : `• 请选择服务费百分比（0% - 12%）\n• 金额将根据百分比和当金自动计算。`;

                const pawnTermHintText = lang === 'id'
                    ? 'Pilih jangka waktu gadai (1-10 bulan). Tanggal jatuh tempo akan dihitung otomatis.'
                    : '选择典当期限（1-10个月）。到期日将自动计算。';

                document.getElementById("app").innerHTML = `
                    <div class="page-header"><h2>📝 ${t('create_order')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button></div></div>
                    <div class="card">
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">👤</span> ${t('customer_info')}</div>
                            <div class="info-display">
                                <div class="info-display-item"><span class="info-label">${t('customer_id')}</span><span class="info-value">${Utils.escapeHtml(customer.customer_id || '-')}</span></div>
                                <div class="info-display-item"><span class="info-label">${t('customer_name')}</span><span class="info-value">${Utils.escapeHtml(customer.name)}</span></div>
                                <div class="info-display-item"><span class="info-label">${t('ktp_number')}</span><span class="info-value">${Utils.escapeHtml(customer.ktp_number || '-')}</span></div>
                                <div class="info-display-item"><span class="info-label">${t('phone')}</span><span class="info-value">${Utils.escapeHtml(customer.phone)}</span></div>
                                <div class="info-display-item"><span class="info-label">${t('occupation')}</span><span class="info-value">${occupationDisplay}</span></div>
                                <div class="info-display-item"><span class="info-label">${t('ktp_address')}</span><span class="info-value">${Utils.escapeHtml(customer.ktp_address || customer.address || '-')}</span></div>
                                <div class="info-display-item"><span class="info-label">${t('living_address')}</span><span class="info-value">${customer.living_same_as_ktp !== false ? t('same_as_ktp') : Utils.escapeHtml(customer.living_address || '-')}</span></div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">💎</span> ${t('collateral_info')}</div>
                            <div class="order-first-row">
                                <div class="form-group"><label>${t('collateral_name')} *</label><input id="collateral" placeholder="${t('collateral_name')}"></div>
                                <div class="form-group"><label>${t('collateral_note')}</label><input id="collateralNote" placeholder="${lang === 'id' ? 'Contoh: emas 24k, kondisi baik, tahun 2020' : '例如: 24k金, 状况良好, 2020年'}"></div>
                                <div class="form-group"><label>${t('loan_amount')} *</label><input type="text" id="amount" placeholder="0" class="amount-input" oninput="APP.recalculateAllFees()"></div>
                                <div class="form-group"><label>${t('loan_source')}</label><div class="payment-method-selector compact"><label><input type="radio" name="loanSource" value="cash" checked> 🏦 ${t('cash')}</label><label><input type="radio" name="loanSource" value="bank"> 🏧 ${t('bank')}</label></div></div>
                                <div class="form-group"><label>📅 ${lang === 'id' ? 'Tanggal Order' : '订单日期'} <small style="font-weight:400;color:var(--text-muted);">(${lang === 'id' ? 'bisa diubah untuk data lama' : '可修改为历史日期'})</small></label><input type="date" id="orderDate" value="${Utils.getLocalToday()}"><div class="form-hint" style="font-size:11px;color:var(--warning,#f59e0b);margin-top:4px;">⚠️ ${lang === 'id' ? 'Tanggal jatuh tempo dihitung dari tanggal ini' : '到期日将从此日期起算'}</div></div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">💰</span> ${t('fee_details')}</div>
                            <div class="fee-cards-row">
                                <div class="fee-card">
                                    <div class="fee-card-label">📋 ${t('admin_fee')} <small style="font-weight:400;text-transform:none;color:var(--text-muted);">(${lang === 'id' ? 'Biaya Tetap' : '固定收费'})</small></div>
                                    <div class="fee-card-body">
                                        <span style="font-weight:700;color:var(--text-primary);margin-right:4px;">Rp</span>
                                        <input type="text" id="adminFeeInput" value="0" class="amount-input" oninput="APP.onAdminFeeManualChange()">
                                    </div>
                                    <div class="fee-card-hint" id="adminFeeHint">${adminFeeHintText}</div>
                                </div>
                                <div class="fee-card">
                                    <div class="fee-card-label">✨ ${t('service_fee')} <small style="font-weight:400;text-transform:none;color:var(--text-muted);">(${lang === 'id' ? 'Pilih Persentase' : '选择百分比'})</small></div>
                                    <div class="fee-card-body" id="serviceFeeDisplay" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                                        <select id="serviceFeePercentSelect" onchange="APP.recalculateServiceFee()" style="min-width:80px;">
                                            ${Array.from({ length: 13 }, (_, i) => `<option value="${i}">${i}%</option>`).join('')}
                                        </select>
                                        <span style="font-weight:700;color:var(--text-primary);">Rp</span>
                                        <input type="text" id="serviceFeeInput" value="0" class="amount-input" readonly style="flex:1;min-width:100px;">
                                    </div>
                                    <div class="fee-card-hint" id="serviceFeeHint">${serviceFeeHintText}</div>
                                </div>
                            </div>
                            <div class="payment-method-row">
                                <span class="payment-method-label">📥 ${t('fee_payment_method')}</span>
                                <div class="payment-method-selector compact" style="padding:0;"><label><input type="radio" name="feePaymentMethod" value="cash" checked> 🏦 ${t('cash')}</label><label><input type="radio" name="feePaymentMethod" value="bank"> 🏧 ${t('bank')}</label></div>
                                <div class="payment-method-hint">💡 ${t('fee_payment_hint')}</div>
                            </div>
                            <div class="form-group interest-rate-group">
                                <label>📈 ${t('interest_rate_select')}</label>
                                <select id="agreedInterestRateSelect" onchange="APP.recalculateAllFees()">${Utils.getInterestRateOptions(10)}</select>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">📅</span> ${t('repayment_method')}</div>
                            <div class="repayment-cards-row">
                                <div class="repayment-card selected" id="flexibleCard" onclick="document.getElementById('flexibleRadio').checked=true;APP.toggleRepaymentForm('flexible')">
                                    <div class="repayment-card-header"><input type="radio" name="repaymentType" id="flexibleRadio" value="flexible" checked onchange="APP.toggleRepaymentForm(this.value)"><span class="repayment-card-title">💰 ${t('flexible_repayment')}</span></div>
                                    <div class="repayment-card-desc">${t('flexible_desc')}</div>
                                </div>
                                <div class="repayment-card extension-card" id="pawnTermCard">
                                    <div class="repayment-card-header"><span class="repayment-card-title">📅 ${lang === 'id' ? 'Jangka Waktu Gadai' : '典当期限'}</span></div>
                                    <div class="extension-select">
                                        <select id="pawnTermSelect" onchange="Utils.updatePawnDueDateDisplay()">
                                            ${Utils.getPawnTermOptions()}
                                        </select>
                                    </div>
                                    <div class="repayment-card-note extension-note" id="pawnDueDateDisplay"></div>
                                    <div class="repayment-card-note" style="font-size:11px;color:var(--text-muted);margin-top:4px;">${pawnTermHintText}</div>
                                </div>
                                <div class="repayment-card" id="fixedCard" onclick="document.getElementById('fixedRadio').checked=true;APP.toggleRepaymentForm('fixed')">
                                    <div class="repayment-card-header"><input type="radio" name="repaymentType" id="fixedRadio" value="fixed" onchange="APP.toggleRepaymentForm(this.value)"><span class="repayment-card-title">📅 ${t('fixed_repayment')}</span></div>
                                    <div class="repayment-card-desc">${t('fixed_desc')}</div>
                                    <div class="repayment-card-note">${lang === 'id' ? 'Pilihan 1-10 bulan' : '可选1-10个月'}</div>
                                </div>
                                <div id="fixedRepaymentForm" style="display:none;" class="fixed-repayment-form">
                                    <div class="form-grid">
                                        <div class="form-group"><label>📅 ${t('term_months')}</label><select id="repaymentTermSelect" onchange="APP.recalculateAllFees()">${Utils.getRepaymentTermOptions(5)}</select></div>
                                        <div class="form-group"><label>💰 ${t('monthly_payment')}</label><input type="text" id="monthlyPaymentInput" value="0" class="amount-input" oninput="APP.onMonthlyPaymentManualChange()"><div class="form-hint">${t('monthly_payment_rounded')}</div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-group full-width"><label>${t('notes')}</label><textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea></div>
                            <div class="form-actions"><button onclick="APP.saveOrderForCustomer('${Utils.escapeAttr(customerId)}')" class="btn btn--success" id="saveOrderBtn">💾 ${t('save')}</button><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('cancel')}</button></div>
                        </div>
                    </div>`;
                
                const amountInput = document.getElementById("amount"); 
                if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
                const adminFeeInput = document.getElementById("adminFeeInput"); 
                if (adminFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(adminFeeInput);
                const serviceFeeInput = document.getElementById("serviceFeeInput"); 
                if (serviceFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(serviceFeeInput);
                const monthlyPaymentInput = document.getElementById("monthlyPaymentInput"); 
                if (monthlyPaymentInput && Utils.bindAmountFormat) Utils.bindAmountFormat(monthlyPaymentInput);
                
                APP.recalculateAllFees();
            } catch (error) { 
                console.error("createOrderForCustomer error:", error); 
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message); 
                if (typeof window.DashboardCore !== 'undefined' && DashboardCore.renderDashboard) DashboardCore.renderDashboard(); 
            }
        },

        // ==================== 保存订单 ====================
        saveOrderForCustomer: async function (customerId) {
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils); 
            const saveBtn = document.getElementById('saveOrderBtn');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...'); }
            const collateral = document.getElementById("collateral").value.trim(); 
            const collateralNote = document.getElementById("collateralNote").value.trim();
            const amount = Utils.getAmountFromInput("amount");
            const notes = document.getElementById("notes").value;
            
            const adminFeeInput = document.getElementById("adminFeeInput");
            let adminFee = adminFeeInput ? Utils.parseNumberFromCommas(adminFeeInput.value) || 0 : 0;
            if (adminFee === 0 && amount > 0) {
                adminFee = Utils.calculateAdminFee(amount);
            }
            
            let serviceFeePercent = parseFloat(document.getElementById("serviceFeePercentSelect")?.value) || 0;
            const serviceFeeStr = document.getElementById("serviceFeeInput")?.value || '0'; 
            let serviceFee = Utils.parseNumberFromCommas(serviceFeeStr) || 0;
            if (serviceFee === 0 && amount > 0 && serviceFeePercent > 0) {
                const result = Utils.calculateServiceFee(amount, serviceFeePercent); 
                serviceFee = result.amount;
            }
            
            const feePaymentMethod = document.querySelector('input[name="feePaymentMethod"]:checked')?.value || 'cash';
            const agreedInterestRate = parseFloat(document.getElementById("agreedInterestRateSelect")?.value) || 10;
            const repaymentTypeRadio = document.querySelector('input[name="repaymentType"]:checked'); 
            const repaymentType = repaymentTypeRadio ? repaymentTypeRadio.value : 'flexible';
            let repaymentTerm = null, monthlyFixedPayment = null;
            
            let pawnTermMonths = null;
            if (repaymentType === 'flexible') {
                const pawnTermSelect = document.getElementById('pawnTermSelect');
                pawnTermMonths = pawnTermSelect ? parseInt(pawnTermSelect.value) : null;
                if (!pawnTermMonths || pawnTermMonths <= 0) {
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); }
                    Utils.toast.warning(lang === 'id' ? 'Silakan pilih Jangka Waktu Gadai terlebih dahulu' : '请先选择典当期限');
                    return;
                }
            }
            
            if (repaymentType === 'fixed') { 
                repaymentTerm = parseInt(document.getElementById("repaymentTermSelect")?.value) || 5; 
                const monthlyStr = document.getElementById("monthlyPaymentInput")?.value; 
                monthlyFixedPayment = Utils.parseNumberFromCommas(monthlyStr) || 0; 
                if (monthlyFixedPayment === 0 && amount > 0) { 
                    const monthlyRate = agreedInterestRate / 100; 
                    monthlyFixedPayment = Utils.roundMonthlyPayment(Utils.calculateFixedMonthlyPayment(amount, monthlyRate, repaymentTerm)); 
                } 
            }
            const loanSource = document.querySelector('input[name="loanSource"]:checked')?.value || 'cash'; 
            const fullCollateralName = collateralNote ? `${collateral} (${collateralNote})` : collateral;
            const orderDateInput = document.getElementById('orderDate');
            const customOrderDate = (orderDateInput && orderDateInput.value) ? orderDateInput.value : Utils.getLocalToday();
            if (!collateral || !amount || amount <= 0) { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); } Utils.toast.warning(t('fill_all_fields')); return; }
            try {
                const profile = await SUPABASE.getCurrentProfile(); 
                const storeId = profile?.store_id; 
                if (!storeId) { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); } Utils.toast.error(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店'); return; }
                const customer = await SUPABASE.getCustomer(customerId); 
                const blacklistData = await SUPABASE.checkBlacklist(customer.id); 
                if (blacklistData.isBlacklisted) { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + t('save'); } Utils.toast.error(lang === 'id' ? 'Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '此客户已被拉黑，无法创建新订单。', 4000); return; }
                const orderData = { 
                    customer: { name: customer.name, ktp: customer.ktp_number || '', phone: customer.phone, address: customer.ktp_address || customer.address || '' }, 
                    collateral_name: fullCollateralName, loan_amount: amount, notes, customer_id: customerId, store_id: storeId, 
                    admin_fee: adminFee, service_fee_percent: serviceFeePercent, service_fee_amount: serviceFee, 
                    agreed_interest_rate: agreedInterestRate, repayment_type: repaymentType, repayment_term: repaymentTerm, 
                    monthly_fixed_payment: monthlyFixedPayment, 
                    pawn_term_months: pawnTermMonths,
                    max_extension_months: 10,
                    custom_order_date: customOrderDate
                };
                const newOrder = await Order.create(orderData);
                if (adminFee > 0) {
                    await Order.recordAdminFee(newOrder.order_id, feePaymentMethod, adminFee).catch(() => {
                        Utils.toast.warning(lang === 'id'
                            ? `⚠️ Pesanan ${newOrder.order_id} tersimpan, tapi biaya admin GAGAL dicatat. Harap catat manual!`
                            : `⚠️ 订单 ${newOrder.order_id} 已保存，但管理费流水记录失败，请手动补录！`, 8000);
                    });
                }
                if (serviceFee > 0) {
                    await Order.recordServiceFee(newOrder.order_id, 1, feePaymentMethod).catch(() => {
                        Utils.toast.warning(lang === 'id'
                            ? `⚠️ Pesanan ${newOrder.order_id} tersimpan, tapi biaya layanan GAGAL dicatat. Harap catat manual!`
                            : `⚠️ 订单 ${newOrder.order_id} 已保存，但服务费流水记录失败，请手动补录！`, 8000);
                    });
                }
                if (amount > 0) {
                    const desc = lang === 'id'
                        ? `Pencairan gadai dari ${loanSource === 'cash' ? 'Brankas' : 'Bank BNI'}`
                        : `当金发放自 ${loanSource === 'cash' ? '保险柜' : '银行BNI'}`;
                    await Order.recordLoanDisbursement(newOrder.order_id, amount, loanSource, desc).catch(() => {
                        Utils.toast.warning(lang === 'id'
                            ? `⚠️ Pesanan ${newOrder.order_id} tersimpan, tapi pencairan dana GAGAL dicatat. Harap catat manual!`
                            : `⚠️ 订单 ${newOrder.order_id} 已保存，但当金发放流水记录失败，请手动补录！`, 8000);
                    });
                }
                const successMsg = repaymentType === 'fixed' ? (lang === 'id' ? `Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrder.order_id}\nJenis: Cicilan Tetap\nJangka: ${repaymentTerm} bulan\nAngsuran per bulan: ${Utils.formatCurrency(monthlyFixedPayment)}` : `订单创建成功！\n\n订单号: ${newOrder.order_id}\n还款方式: 固定还款\n期限: ${repaymentTerm}个月\n每月还款: ${Utils.formatCurrency(monthlyFixedPayment)}`) : (lang === 'id' ? `Pesanan berhasil dibuat!\n\nID Pesanan: ${newOrder.order_id}\nJenis: Cicilan Fleksibel\nJangka Waktu Gadai: ${pawnTermMonths} bulan` : `订单创建成功！\n\n订单号: ${newOrder.order_id}\n还款方式: 灵活还款\n典当期限: ${pawnTermMonths}个月`);
                Utils.toast.success(successMsg, 5000);
                document.getElementById("collateral").value = ''; 
                document.getElementById("collateralNote").value = ''; 
                document.getElementById("amount").value = ''; 
                document.getElementById("notes").value = '';
                const adminFeeEl = document.getElementById("adminFeeInput"); 
                if (adminFeeEl) { adminFeeEl.value = '0'; delete adminFeeEl.dataset.manual; }
                const svcInput = document.getElementById("serviceFeeInput");
                if (svcInput) {
                    svcInput.value = '0';
                    svcInput.readOnly = true;
                    delete svcInput.dataset.manual;
                }
                const svcSelect = document.getElementById("serviceFeePercentSelect");
                if (svcSelect) {
                    svcSelect.value = '0';
                    svcSelect.disabled = true;
                    delete svcSelect.dataset.manual;
                }
                const cashRadio = document.querySelector('input[name="feePaymentMethod"][value="cash"]'); 
                if (cashRadio) cashRadio.checked = true;
                const loanCashRadio = document.querySelector('input[name="loanSource"][value="cash"]'); 
                if (loanCashRadio) loanCashRadio.checked = true;
                const interestSelect = document.getElementById("agreedInterestRateSelect"); 
                if (interestSelect) interestSelect.value = '10';
                const flexibleRadio = document.getElementById("flexibleRadio"); 
                if (flexibleRadio) { flexibleRadio.checked = true; APP.toggleRepaymentForm('flexible'); }
                const pawnTermEl = document.getElementById('pawnTermSelect');
                if (pawnTermEl) pawnTermEl.value = '';
                const pawnDisplay = document.getElementById('pawnDueDateDisplay');
                if (pawnDisplay) pawnDisplay.innerHTML = '';
                APP.recalculateAllFees(); 
                const monthlyInput = document.getElementById("monthlyPaymentInput"); 
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

        // ==================== 费用重算（下拉始终可操作，按选择计算金额） ====================
        recalculateAllFees() {
            const amount = Utils.getAmountFromInput('amount');
            
            const adminFee = Utils.calculateAdminFee(amount);
            const adminFeeInput = document.getElementById('adminFeeInput');
            if (adminFeeInput && !adminFeeInput.dataset.manual) {
                adminFeeInput.value = Utils.formatNumberWithCommas(adminFee);
            }
            this._updateAdminFeeHint(amount);

            const serviceFeeSelect = document.getElementById('serviceFeePercentSelect');
            const serviceFeeInput = document.getElementById('serviceFeeInput');

            // 金额 <= 0 时禁用下拉，输入只读显示 0
            if (amount <= 0) {
                if (serviceFeeSelect) {
                    serviceFeeSelect.disabled = true;
                    serviceFeeSelect.value = '0';
                    delete serviceFeeSelect.dataset.manual;
                }
                if (serviceFeeInput) {
                    serviceFeeInput.value = '0';
                    serviceFeeInput.readOnly = true;
                    delete serviceFeeInput.dataset.manual;
                }
                this._updateServiceFeeHint(amount, 0);
                return;
            }

            // 金额 > 0：下拉始终可用
            if (serviceFeeSelect) serviceFeeSelect.disabled = false;
            if (serviceFeeInput) serviceFeeInput.readOnly = true; // 仅通过下拉控制金额

            // 如果用户未手动选择百分比，设定默认值
            if (serviceFeeSelect && !serviceFeeSelect.dataset.manual) {
                let defaultPercent = 0;
                if (amount > 5000000) defaultPercent = 2;
                else if (amount > 3000000) defaultPercent = 1;
                // <= 3jt 默认 0%
                serviceFeeSelect.value = defaultPercent.toString();
            }

            const percent = serviceFeeSelect ? parseFloat(serviceFeeSelect.value) : 0;
            const result = Utils.calculateServiceFee(amount, percent);
            if (serviceFeeInput) {
                serviceFeeInput.value = Utils.formatNumberWithCommas(result.amount);
            }
            this._updateServiceFeeHint(amount, percent);

            // 固定还款计算
            const repaymentType = document.querySelector('input[name="repaymentType"]:checked')?.value;
            if (repaymentType === 'fixed') { 
                const rateSelect = document.getElementById('agreedInterestRateSelect'); 
                const monthlyRate = rateSelect ? (parseFloat(rateSelect.value) || 10) / 100 : 0.10; 
                const termSelect = document.getElementById('repaymentTermSelect'); 
                const months = termSelect ? parseInt(termSelect.value) : 5; 
                if (amount > 0 && months > 0) { 
                    const monthly = Utils.calculateFixedMonthlyPayment(amount, monthlyRate, months); 
                    const rounded = Utils.roundMonthlyPayment(monthly); 
                    const monthlyInput = document.getElementById('monthlyPaymentInput'); 
                    if (monthlyInput && !monthlyInput.dataset.manual) { 
                        monthlyInput.value = Utils.formatNumberWithCommas(rounded); 
                    } 
                } 
            }
        },

        onAdminFeeManualChange() {
            const input = document.getElementById('adminFeeInput');
            if (input) input.dataset.manual = 'true';
            const amount = Utils.getAmountFromInput('amount');
            this._updateAdminFeeHint(amount);
        },

        _updateAdminFeeHint(amount) {
            const hint = document.getElementById('adminFeeHint');
            if (!hint) return;
            const lang = Utils.lang;
            const adminFee = Utils.calculateAdminFee(amount);
            
            if (amount <= 0) {
                hint.innerHTML = lang === 'id'
                    ? `• Nilai gadai ≤ Rp500.000 : biaya administrasi Rp20.000\n• Nilai gadai Rp500.000 – Rp3.000.000 : biaya administrasi Rp30.000\n• Nilai gadai > Rp3.000.000 : dikenakan biaya administrasi sebesar 1% dari nilai gadai`
                    : `• 当金 ≤ Rp500,000 ：管理费 Rp20,000\n• 当金 Rp500,000 ～ Rp3,000,000 ：管理费 Rp30,000\n• 当金 > Rp3,000,000 ：按当金的 1% 收取管理费`;
            } else {
                let highlightedHint = '';
                let allHints = lang === 'id' 
                    ? `• Nilai gadai ≤ Rp500.000 : biaya administrasi Rp20.000\n• Nilai gadai Rp500.000 – Rp3.000.000 : biaya administrasi Rp30.000\n• Nilai gadai > Rp3.000.000 : dikenakan biaya administrasi sebesar 1% dari nilai gadai`
                    : `• 当金 ≤ Rp500,000 ：管理费 Rp20,000\n• 当金 Rp500,000 ～ Rp3,000,000 ：管理费 Rp30,000\n• 当金 > Rp3,000,000 ：按当金的 1% 收取管理费`;
                
                if (amount <= 500000) {
                    highlightedHint = lang === 'id' ? `📌 Nilai gadai ≤ Rp500.000 : <strong>Rp20.000</strong>\n\n${allHints}` : `📌 当金 ≤ Rp500,000 ：<strong>Rp20,000</strong>\n\n${allHints}`;
                } else if (amount <= 3000000) {
                    highlightedHint = lang === 'id' ? `📌 Nilai gadai Rp500.000–Rp3.000.000 : <strong>Rp30.000</strong>\n\n${allHints}` : `📌 当金 Rp500,000～Rp3,000,000 ：<strong>Rp30,000</strong>\n\n${allHints}`;
                } else {
                    highlightedHint = lang === 'id' ? `🔢 Nilai gadai > Rp3.000.000 : <strong>1%</strong> = ${Utils.formatCurrency(adminFee)}\n\n${allHints}` : `🔢 当金 > Rp3,000,000 ：<strong>1%</strong> = ${Utils.formatCurrency(adminFee)}\n\n${allHints}`;
                }
                hint.innerHTML = highlightedHint;
            }
        },

        _updateServiceFeeHint(amount, percent) {
            const hint = document.getElementById('serviceFeeHint');
            if (!hint) return;
            const lang = Utils.lang;
            
            if (amount <= 0) {
                hint.innerHTML = lang === 'id'
                    ? `• Silakan masukkan nilai gadai terlebih dahulu.`
                    : `• 请先输入当金金额。`;
            } else {
                const feeResult = Utils.calculateServiceFee(amount, percent);
                hint.innerHTML = lang === 'id'
                    ? `🔢 Persentase dipilih: <strong>${feeResult.percent}%</strong> = ${Utils.formatCurrency(feeResult.amount)}`
                    : `🔢 已选百分比: <strong>${feeResult.percent}%</strong> = ${Utils.formatCurrency(feeResult.amount)}`;
            }
        },

        recalculateServiceFee() {
            const select = document.getElementById('serviceFeePercentSelect');
            if (!select) return;
            select.dataset.manual = 'true';
            const amount = Utils.getAmountFromInput('amount');
            if (amount <= 0) return;
            const percent = parseFloat(select.value);
            const result = Utils.calculateServiceFee(amount, percent);
            const input = document.getElementById('serviceFeeInput');
            if (input) {
                input.value = Utils.formatNumberWithCommas(result.amount);
            }
            this._updateServiceFeeHint(amount, percent);
        },

        onServiceFeeManualChange() { 
            // 保留方法，但输入框为 readonly，此方法通常不会被触发，维持兼容性
            const input = document.getElementById('serviceFeeInput'); 
            if (input) input.dataset.manual = 'true'; 
        },

        onMonthlyPaymentManualChange() { 
            const input = document.getElementById('monthlyPaymentInput'); 
            if (input) input.dataset.manual = 'true'; 
        },

        toggleRepaymentForm(value) { 
            const fixedForm = document.getElementById('fixedRepaymentForm'); 
            const pawnTermCard = document.getElementById('pawnTermCard'); 
            const flexibleCard = document.getElementById('flexibleCard'); 
            const fixedCard = document.getElementById('fixedCard'); 
            if (fixedForm) fixedForm.style.display = value === 'fixed' ? 'block' : 'none'; 
            if (pawnTermCard) pawnTermCard.style.display = value === 'flexible' ? 'block' : 'none'; 
            if (flexibleCard) flexibleCard.classList.toggle('selected', value === 'flexible'); 
            if (fixedCard) fixedCard.classList.toggle('selected', value === 'fixed'); 
            if (value === 'fixed') APP.recalculateAllFees(); 
        },

        // ==================== 客户订单列表 ====================
        async showCustomerOrders(customerId) {
            APP.currentPage = 'customerOrders'; 
            APP.currentCustomerId = customerId; 
            APP.saveCurrentPageState();
            const contentHTML = await this.buildCustomerOrdersHTML(customerId);
            document.getElementById("app").innerHTML = contentHTML;
        },

        async buildCustomerOrdersHTML(customerId) {
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils);
            try {
                const customer = await SUPABASE.getCustomer(customerId); 
                const client = SUPABASE.getClient();
                const { data: orders, error } = await client.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }); 
                if (error) throw error;
                const statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
                let rows = '';
                if (!orders || orders.length === 0) { rows = `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`; }
                else { for (const o of orders) { const sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated'); const repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible'; const repaymentText = o.repayment_type === 'fixed' ? t('fixed_repayment') : t('flexible_repayment'); rows += `<tr><td class="order-id">${Utils.escapeHtml(o.order_id)}</td><td class="date-cell">${Utils.formatDate(o.created_at)}</td><td class="amount">${Utils.formatCurrency(o.loan_amount)}</td><td class="amount">${Utils.formatCurrency(o.principal_paid)}</td><td class="text-center">${o.interest_paid_months} ${t('month')}</td><td class="text-center"><span class="badge badge--${repaymentClass}">${repaymentText}</span></td><td class="text-center"><span class="badge badge--${sc}">${statusMap[o.status] || o.status}</span></td></tr>`; let actionButtons = ''; if (o.status === 'active' && !PERMISSION.isAdmin()) actionButtons += `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeAttr(o.order_id)}'})" class="btn btn--success btn--sm">💰 ${t('pay_fee')}</button>`; actionButtons += `<button onclick="APP.navigateTo('viewOrder',{orderId:'${Utils.escapeAttr(o.order_id)}'})" class="btn btn--sm btn--primary">👁️ ${t('view')}</button>`; rows += `<tr class="action-row"><td class="action-label">${t('action')}</td><td colspan="6"><div class="action-buttons">${actionButtons}</div></td></tr>`; } }
                return `<div class="page-header"><h2>📋 ${t('customer_orders')} - ${Utils.escapeHtml(customer.name)}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button></div></div><div class="card customer-summary"><p><strong>${t('customer_id')}:</strong> ${Utils.escapeHtml(customer.customer_id || '-')}</p><p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p><p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p><p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p><p><strong>${t('occupation')}:</strong> ${Utils.escapeHtml(customer.occupation || '-')}</p></div><div class="card"><h3>📋 ${t('order_list')}</h3><div class="table-container"><table class="data-table"><thead><tr><th class="col-id">ID</th><th class="col-date">${t('date')}</th><th class="col-amount amount">${t('loan_amount')}</th><th class="col-amount amount">${t('principal_paid')}</th><th class="col-months text-center">${t('interest')}</th><th class="col-status text-center">${t('repayment_type')}</th><th class="col-status text-center">${t('status')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
            } catch (error) { 
                console.error("buildCustomerOrdersHTML error:", error); 
                return `<div class="card"><p>❌ ${lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败'}</p></div>`; 
            }
        },

        async renderCustomerOrdersHTML(customerId) { return await this.buildCustomerOrdersHTML(customerId); },

        // ==================== 客户缴费历史 ====================
        async showCustomerPaymentHistory(customerId) {
            APP.currentPage = 'customerPaymentHistory'; 
            APP.currentCustomerId = customerId; 
            APP.saveCurrentPageState();
            const contentHTML = await this.buildCustomerPaymentHistoryHTML(customerId);
            document.getElementById("app").innerHTML = contentHTML;
        },

        async buildCustomerPaymentHistoryHTML(customerId) {
            const lang = Utils.lang; 
            const t = Utils.t.bind(Utils); 
            const methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            try {
                const customer = await SUPABASE.getCustomer(customerId); 
                const client = SUPABASE.getClient();
                const { data: orders } = await client.from('orders').select('id, order_id').eq('customer_id', customerId); 
                const orderIds = (orders || []).map(o => o.id); 
                let allPayments = [];
                if (orderIds.length > 0) { const { data } = await client.from('payment_history').select('*, orders(order_id, customer_name)').in('order_id', orderIds).order('date', { ascending: false }); allPayments = data || []; }
                const typeMap = { admin_fee: t('admin_fee'), service_fee: t('service_fee'), interest: t('interest'), principal: t('principal') }; 
                let rows = '';
                if (allPayments.length === 0) { rows = `<tr><td colspan="7" class="text-center">${t('no_data')}</td>`; }
                else { for (const p of allPayments) { const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank'; rows += `<tr><td class="date-cell">${Utils.formatDate(p.date)}</td><td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td><td class="col-type">${typeMap[p.type] || p.type}</td><td class="text-center">${p.months ? p.months + ' ' + t('month') : '-'}</td><td class="amount">${Utils.formatCurrency(p.amount)}</td><td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td><td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td></tr>`; } }
                return `<div class="page-header"><h2>💰 ${t('payment_history')} - ${Utils.escapeHtml(customer.name)}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button></div></div><div class="card customer-summary"><p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p><p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p><p><strong>${t('occupation')}:</strong> ${Utils.escapeHtml(customer.occupation || '-')}</p></div><div class="card"><h3>💰 ${t('payment_history')}</h3><div class="table-container"><table class="data-table"><thead><tr><th class="col-date">${t('date')}</th><th class="col-id">${t('order_id')}</th><th class="col-type">${t('type')}</th><th class="col-months text-center">${t('month')}</th><th class="col-amount amount">${t('amount')}</th><th class="col-method text-center">${t('payment_method')}</th><th class="col-desc">${t('description')}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
            } catch (error) { 
                console.error("buildCustomerPaymentHistoryHTML error:", error); 
                return `<div class="card"><p>❌ ${lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败'}</p></div>`; 
            }
        },

        async renderCustomerPaymentHistoryHTML(customerId) { return await this.buildCustomerPaymentHistoryHTML(customerId); }
    };

    JF.CustomersPage = CustomersPage;

    if (window.APP) {
        window.APP.showCustomers = CustomersPage.showCustomers.bind(CustomersPage);
        window.APP.addCustomer = CustomersPage.addCustomer.bind(CustomersPage);
        window.APP.toggleLivingAddress = CustomersPage.toggleLivingAddress.bind(CustomersPage);
        window.APP.showCustomerDetailCard = CustomersPage.showCustomerDetailCard.bind(CustomersPage);
        window.APP.editCustomerFromCard = CustomersPage.editCustomerFromCard.bind(CustomersPage);
        window.APP.blacklistFromCard = CustomersPage.blacklistFromCard.bind(CustomersPage);
        window.APP.unblacklistFromCard = CustomersPage.unblacklistFromCard.bind(CustomersPage);
        window.APP.deleteCustomerFromCard = CustomersPage.deleteCustomerFromCard.bind(CustomersPage);
        window.APP.showCustomerOrdersByStatus = CustomersPage.showCustomerOrdersByStatus.bind(CustomersPage);
        window.APP.editCustomer = CustomersPage.editCustomer.bind(CustomersPage);
        window.APP._toggleEditLiving = CustomersPage._toggleEditLiving.bind(CustomersPage);
        window.APP._saveEditCustomer = CustomersPage._saveEditCustomer.bind(CustomersPage);
        window.APP.deleteCustomer = CustomersPage.deleteCustomer.bind(CustomersPage);
        window.APP.createOrderForCustomer = CustomersPage.createOrderForCustomer.bind(CustomersPage);
        window.APP.saveOrderForCustomer = CustomersPage.saveOrderForCustomer.bind(CustomersPage);
        window.APP.recalculateAllFees = CustomersPage.recalculateAllFees.bind(CustomersPage);
        window.APP.onAdminFeeManualChange = CustomersPage.onAdminFeeManualChange.bind(CustomersPage);
        window.APP.recalculateServiceFee = CustomersPage.recalculateServiceFee.bind(CustomersPage);
        window.APP.onServiceFeeManualChange = CustomersPage.onServiceFeeManualChange.bind(CustomersPage);
        window.APP.onMonthlyPaymentManualChange = CustomersPage.onMonthlyPaymentManualChange.bind(CustomersPage);
        window.APP.toggleRepaymentForm = CustomersPage.toggleRepaymentForm.bind(CustomersPage);
        window.APP.showCustomerOrders = CustomersPage.showCustomerOrders.bind(CustomersPage);
        window.APP.showCustomerPaymentHistory = CustomersPage.showCustomerPaymentHistory.bind(CustomersPage);
    } else {
        window.APP = {};
    }

})();
