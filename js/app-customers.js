// app-customers.js - 完整最终版
// 权限：拉黑（店长/员工），解除（仅管理员），查看黑名单（管理员看全部，店长看本店）
// 布局：客户列表（上方）→ 新增客户（中间）→ 黑名单列表（下方）
// 修改：客户列表操作按钮只保留 "➕ 建立订单" 和 "🚫 拉黑"
// 修改：新建订单时增加资金来源选择（银行BNI/保险柜/门店净利）

window.APP = window.APP || {};

const CustomersModule = {

    showCustomers: async function() {
        this.currentPage = 'customers';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        var canBlacklist = !isAdmin;

        try {
            const customers = await SUPABASE.getCustomers();
            
            var blacklistStatus = {};
            var blacklistData = [];
            blacklistData = await APP.getBlacklist();
            for (var b of blacklistData) {
                blacklistStatus[b.customer_id] = b.reason;
            }
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 9 : 8}" class="text-center">${lang === 'id' ? 'Tidak ada data nasabah' : '暂无客户数据'}</td></tr>`;
            } else {
                for (var c of customers) {
                    var isBlacklisted = blacklistStatus[c.id];
                    var blacklistBadge = '';
                    var blacklistReason = '';
                    if (isBlacklisted) {
                        blacklistBadge = '<span class="status-badge status-liquidated" style="margin-left:5px;" title="' + Utils.escapeHtml(blacklistStatus[c.id]) + '">🚫 BLACKLIST</span>';
                        blacklistReason = '<small style="color:#dc2626; display:block; font-size:10px;">原因: ' + Utils.escapeHtml(blacklistStatus[c.id].substring(0, 30)) + '</small>';
                    }
                    
                    rows += `<tr>
                        <td class="customer-id-cell">${Utils.escapeHtml(c.customer_id || '-')}${blacklistBadge}${blacklistReason}</td>
                        <td class="date-cell">${Utils.formatDate(c.registered_date)}</td>
                        <td class="name-cell">${Utils.escapeHtml(c.name)}</td>
                        <td class="ktp-cell">${Utils.escapeHtml(c.ktp_number || '-')}</td>
                        <td class="phone-cell">${Utils.escapeHtml(c.phone || '-')}</td>
                        <td class="address-cell">${Utils.escapeHtml(c.ktp_address || c.address || '-')}</td>
                        <td class="address-cell">${Utils.escapeHtml(c.living_address || (c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : '-'))}</td>
                        ${isAdmin ? `<td class="store-cell">${Utils.escapeHtml(c.stores?.name || '-')} (${Utils.escapeHtml(c.stores?.code || '-')})</td>` : ''}
                        <td class="action-cell">
                            <button onclick="APP.createOrderForCustomer('${c.id}')" class="btn-small success">➕ ${lang === 'id' ? 'Buat Order' : '建立订单'}</button>
                            ${canBlacklist && !isBlacklisted ? `<button onclick="APP.showBlacklistCustomerModal('${c.id}', '${Utils.escapeHtml(c.name)}')" class="btn-small" style="background:#d97706;color:white;">🚫 ${lang === 'id' ? 'Blacklist' : '拉黑'}</button>` : ''}
                            ${isAdmin && isBlacklisted ? `<button onclick="APP.removeFromBlacklist('${c.id}')" class="btn-small success">🔓 ${lang === 'id' ? 'Hapus Blacklist' : '解除拉黑'}</button>` : ''}
                        </td>
                    　　　`;
                }
            }

            var addCustomerCardHtml = '';
            if (!isAdmin) {
                addCustomerCardHtml = `
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Nasabah Baru' : '新增客户'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${t('customer_name')} *</label><input type="text" id="customerName" placeholder="${t('customer_name')}"></div>
                        <div class="form-group"><label>${t('phone')} *</label><input type="text" id="customerPhone" placeholder="${t('phone')}"></div>
                        <div class="form-group"><label>${t('ktp_number')}</label><input type="text" id="customerKtp" placeholder="${t('ktp_number')}"></div>
                        <div class="form-group full-width"><label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label><textarea id="customerKtpAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址'}"></textarea></div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                            <div class="address-option">
                                <label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                                <label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）'}</label>
                            </div>
                            <textarea id="customerLivingAddress" rows="2" placeholder="${lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址'}" style="display:none;margin-top:8px;"></textarea>
                        </div>
                        <div class="form-actions"><button onclick="APP.addCustomer()" class="success">💾 ${lang === 'id' ? 'Simpan Nasabah' : '保存客户'}</button></div>
                    </div>
                </div>`;
            }
            
            var blacklistRows = '';
            var blacklistCount = blacklistData.length;
            if (blacklistCount > 0) {
                for (var item of blacklistData) {
                    var customer = item.customers;
                    blacklistRows += `<tr>
                        <td class="customer-id-cell">${Utils.escapeHtml(customer?.customer_id || '-')}</td>
                        <td class="name-cell">${Utils.escapeHtml(customer?.name || '-')}</td>
                        <td class="ktp-cell">${Utils.escapeHtml(customer?.ktp_number || '-')}</td>
                        <td class="phone-cell">${Utils.escapeHtml(customer?.phone || '-')}</td>
                        <td style="max-width:250px;">${Utils.escapeHtml(item.reason)}</td>
                        <td class="date-cell">${Utils.formatDate(item.blacklisted_at)}</td>
                        <td class="action-cell">
                            ${isAdmin ? `<button onclick="APP.removeFromBlacklist('${customer.id}')" class="btn-small success">🔓 ${lang === 'id' ? 'Hapus' : '解除'}</button>` : ''}
                        </td>
                    　　　`;
                }
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>👥 ${lang === 'id' ? 'Data Nasabah' : '客户信息'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="card"><h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                    <div class="table-container"><table class="customer-table"><thead><tr><th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th><th>${lang === 'id' ? 'Tanggal Daftar' : '录入日期'}</th><th>${t('customer_name')}</th><th>${t('ktp_number')}</th><th>${t('phone')}</th><th>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</th><th>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</th>${isAdmin ? `<th>${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}<th>${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead><tbody>${rows}</tbody></table></div>
                </div>
                ${addCustomerCardHtml}
                <div class="card" style="margin-top:20px; background:#fef2f2;"><div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom:12px;"><h3 style="margin:0; color:#dc2626;">🚫 ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'} (${blacklistCount})</h3><div style="display:flex; gap:8px;"><button onclick="APP.printBlacklistOnly()" class="btn-small print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button><button onclick="APP.exportBlacklistOnlyToCSV()" class="btn-small" style="background:#10b981; color:white;">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button></div></div>
                    <div class="table-container"><table class="customer-table" style="font-size:13px;"><thead><tr><th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th><th>${t('customer_name')}</th><th>${t('ktp_number')}</th><th>${t('phone')}</th><th>${lang === 'id' ? 'Alasan' : '拉黑原因'}</th><th>${lang === 'id' ? 'Tanggal' : '拉黑日期'}</th><th>${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead><tbody>${blacklistCount > 0 ? blacklistRows : `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Belum ada nasabah dalam blacklist' : '暂无黑名单客户'}</td>`}</tbody></table></div>
                </div>
                <style>
                    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                    .customer-table { width: 100%; border-collapse: collapse; }
                    .customer-table th, .customer-table td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
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
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        if (isAdmin) {
            alert(lang === 'id' ? 'Administrator tidak dapat menambah nasabah. Silakan login sebagai Manajer Toko atau Staf.' : '管理员不能添加客户，请使用店长或员工账号登录。');
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
            const duplicate = await APP.checkDuplicateCustomer(name, ktp, phone);
            if (duplicate && duplicate.isDuplicate) {
                var fieldText = '';
                if (duplicate.duplicateFields.includes('name')) fieldText += lang === 'id' ? 'Nama' : '姓名';
                if (duplicate.duplicateFields.includes('ktp')) fieldText += fieldText ? ', KTP' : 'KTP';
                if (duplicate.duplicateFields.includes('phone')) fieldText += fieldText ? ', Telepon' : '电话';
                alert(lang === 'id' ? `⚠️ Data sudah terdaftar! (${fieldText} sudah digunakan)\nID Nasabah: ${duplicate.existingCustomer.customer_id}` : `⚠️ 信息已存在！(${fieldText} 已被使用)\n客户ID: ${duplicate.existingCustomer.customer_id}`);
                return;
            }
        } catch (err) { console.warn("查重检查失败:", err); }

        try {
            const profile = await SUPABASE.getCurrentProfile();
            const storeId = profile?.store_id;
            if (!storeId) { alert(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店'); return; }
            const customerData = {
                store_id: storeId, name: name, ktp_number: ktp || null, phone: phone,
                ktp_address: ktpAddress || null, address: ktpAddress || null,
                living_same_as_ktp: livingSameAsKtp, living_address: livingAddress || null,
                registered_date: new Date().toISOString().split('T')[0], created_by: profile.id
            };
            const newCustomer = await SUPABASE.createCustomer(customerData);
            alert(lang === 'id' ? `Nasabah berhasil ditambahkan! ID: ${newCustomer.customer_id}` : `客户添加成功！ID: ${newCustomer.customer_id}`);
            await this.showCustomers();
        } catch (error) {
            console.error("addCustomer error:", error);
            if (error.code === '23505') {
                alert(lang === 'id' ? '⚠️ Data nasabah sudah terdaftar! (Nama, KTP, atau Telepon sudah digunakan)' : '⚠️ 客户信息已存在！（姓名、KTP或电话已被使用）');
            } else {
                alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            }
        }
    },

    editCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        if (isAdmin) { alert(lang === 'id' ? 'Administrator tidak dapat mengubah nasabah.' : '管理员不能修改客户信息。'); return; }
        var t = (key) => Utils.t(key);
        try {
            const { data: c, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;
            var livingSame = c.living_same_as_ktp !== false;
            var modal = document.createElement('div');
            modal.id = 'editCustomerModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `<div class="modal-content" style="max-width:600px;"><h3>✏️ ${lang === 'id' ? 'Ubah Data Nasabah' : '修改客户信息'}</h3>
                <div class="form-grid">
                    <div class="form-group"><label>${t('customer_name')} *</label><input id="ec_name" value="${Utils.escapeHtml(c.name)}"></div>
                    <div class="form-group"><label>${t('phone')} *</label><input id="ec_phone" value="${Utils.escapeHtml(c.phone || '')}"></div>
                    <div class="form-group"><label>${t('ktp_number')}</label><input id="ec_ktp" value="${Utils.escapeHtml(c.ktp_number || '')}"></div>
                    <div class="form-group full-width"><label>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}</label><textarea id="ec_ktpAddr" rows="2">${Utils.escapeHtml(c.ktp_address || c.address || '')}</textarea></div>
                    <div class="form-group full-width"><label>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}</label>
                        <div class="address-option">
                            <label><input type="radio" name="ec_livingOpt" value="same" ${livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                            <label><input type="radio" name="ec_livingOpt" value="different" ${!livingSame ? 'checked' : ''} onchange="APP._toggleEditLiving(this.value)"> ${lang === 'id' ? 'Berbeda' : '不同'}</label>
                        </div>
                        <textarea id="ec_livingAddr" rows="2" style="margin-top:8px;${livingSame ? 'display:none;' : ''}">${Utils.escapeHtml(c.living_address || '')}</textarea>
                    </div>
                    <div class="form-actions"><button onclick="APP._saveEditCustomer('${customerId}')" class="success">💾 ${t('save')}</button><button onclick="document.getElementById('editCustomerModal').remove()">✖ ${t('cancel')}</button></div>
                </div></div>`;
            document.body.appendChild(modal);
            if (!document.getElementById('modal-styles')) {
                var style = document.createElement('style');
                style.id = 'modal-styles';
                style.textContent = `.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; } .modal-content { background: #ffffff; border-radius: 12px; padding: 24px; width: 100%; max-height: 90vh; overflow-y: auto; }`;
                document.head.appendChild(style);
            }
        } catch (e) { alert(lang === 'id' ? 'Gagal memuat data: ' + e.message : '加载失败：' + e.message); }
    },

    _toggleEditLiving: function(val) {
        var el = document.getElementById('ec_livingAddr');
        if (el) el.style.display = val === 'different' ? 'block' : 'none';
    },

    _saveEditCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        if (isAdmin) { alert(lang === 'id' ? 'Administrator tidak dapat mengubah nasabah.' : '管理员不能修改客户信息。'); return; }
        var name = document.getElementById('ec_name').value.trim();
        var phone = document.getElementById('ec_phone').value.trim();
        var ktp = document.getElementById('ec_ktp').value.trim();
        var ktpAddr = document.getElementById('ec_ktpAddr').value.trim();
        var livingOpt = document.querySelector('input[name="ec_livingOpt"]:checked')?.value || 'same';
        var livingSame = livingOpt === 'same';
        var livingAddr = livingSame ? null : document.getElementById('ec_livingAddr').value.trim();
        if (!name || !phone) { alert(lang === 'id' ? 'Nama dan telepon wajib diisi' : '姓名和手机号必须填写'); return; }
        try {
            const duplicate = await APP.checkDuplicateCustomer(name, ktp, phone, customerId);
            if (duplicate && duplicate.isDuplicate) {
                var fieldText = '';
                if (duplicate.duplicateFields.includes('name')) fieldText += lang === 'id' ? 'Nama' : '姓名';
                if (duplicate.duplicateFields.includes('ktp')) fieldText += fieldText ? ', KTP' : 'KTP';
                if (duplicate.duplicateFields.includes('phone')) fieldText += fieldText ? ', Telepon' : '电话';
                alert(lang === 'id' ? `⚠️ Data sudah terdaftar! (${fieldText} sudah digunakan)\nID Nasabah: ${duplicate.existingCustomer.customer_id}` : `⚠️ 信息已存在！(${fieldText} 已被使用)\n客户ID: ${duplicate.existingCustomer.customer_id}`);
                return;
            }
            const { error } = await supabaseClient.from('customers').update({
                name: name, phone: phone, ktp_number: ktp || null, ktp_address: ktpAddr || null, address: ktpAddr || null,
                living_same_as_ktp: livingSame, living_address: livingAddr || null, updated_at: new Date().toISOString()
            }).eq('id', customerId);
            if (error) throw error;
            document.getElementById('editCustomerModal')?.remove();
            alert(lang === 'id' ? 'Data nasabah diperbarui' : '客户信息已更新');
            await this.showCustomers();
        } catch (e) { alert(lang === 'id' ? 'Gagal menyimpan: ' + e.message : '保存失败：' + e.message); }
    },

    deleteCustomer: async function(customerId) {
        var lang = Utils.lang;
        const blacklistCheck = await APP.isBlacklisted(customerId);
        if (blacklistCheck.isBlacklisted) {
            if (!confirm(lang === 'id' ? `Nasabah ini dalam BLACKLIST. Hapus dari blacklist terlebih dahulu?` : `该客户在黑名单中，是否先解除拉黑再删除？`)) return;
            await APP.removeFromBlacklist(customerId);
        }
        if (!confirm(lang === 'id' ? 'Hapus nasabah ini? Semua order terkait juga akan terhapus.' : '删除此客户？相关订单也将被删除。')) return;
        try {
            const { data: orders, error: ordersError } = await supabaseClient.from('orders').select('id').eq('customer_id', customerId);
            if (ordersError) throw ordersError;
            if (orders && orders.length > 0) {
                for (var o of orders) await supabaseClient.from('payment_history').delete().eq('order_id', o.id);
                await supabaseClient.from('orders').delete().eq('customer_id', customerId);
            }
            const { error: customerError } = await supabaseClient.from('customers').delete().eq('id', customerId);
            if (customerError) throw customerError;
            alert(lang === 'id' ? 'Nasabah berhasil dihapus' : '客户已删除');
            await this.showCustomers();
        } catch (e) { alert(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message); }
    },

    createOrderForCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        if (isAdmin) {
            alert(lang === 'id' ? 'Administrator tidak dapat membuat order. Silakan login sebagai Manajer Toko atau Staf.' : '管理员不能创建订单，请使用店长或员工账号登录。');
            return;
        }
        const blacklistCheck = await APP.isBlacklisted(customerId);
        if (blacklistCheck.isBlacklisted) {
            alert(lang === 'id' ? `🚫 Nasabah ini dalam BLACKLIST!\nAlasan: ${blacklistCheck.reason}\nTidak dapat membuat order baru.` : `🚫 该客户已被拉黑！\n原因: ${blacklistCheck.reason}\n无法创建新订单。`);
            return;
        }
        try {
            const { data: existingOrders } = await supabaseClient.from('orders').select('status').eq('customer_id', customerId).eq('status', 'active');
            if (existingOrders && existingOrders.length > 0) { alert(Utils.lang === 'id' ? 'Nasabah ini masih memiliki order aktif.' : '该客户还有未结清的订单。'); return; }
            const { data: customer, error } = await supabaseClient.from('customers').select('*, stores(name, code)').eq('id', customerId).single();
            if (error) throw error;
            this.currentPage = 'createOrder';
            this.currentCustomerId = customerId;
            var t = (key) => Utils.t(key);
            const profile = await SUPABASE.getCurrentProfile();
            const userStoreName = profile?.stores?.name || (lang === 'id' ? 'Toko tidak diketahui' : '未知门店');
            const userStoreCode = profile?.stores?.code || '-';
            var cashFlow = await SUPABASE.getCashFlowSummary();
            var cashBalance = cashFlow.cash?.balance ?? 0;
            var bankBalance = cashFlow.bank?.balance ?? 0;
            var profitBalance = cashFlow.profit?.balance ?? 0;
            document.getElementById("app").innerHTML = `
                <div class="page-header"><h2>📝 ${t('create_order')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button></div></div>
                <div class="card"><h3>${t('customer_info')}</h3>
                    <div class="customer-info-display"><p><strong>${lang === 'id' ? 'ID Nasabah' : '客户ID'}:</strong> ${Utils.escapeHtml(customer.customer_id || '-')}</p><p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p><p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p><p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p><p><strong>${lang === 'id' ? 'Alamat KTP' : 'KTP地址'}:</strong> ${Utils.escapeHtml(customer.ktp_address || customer.address || '-')}</p><p><strong>${lang === 'id' ? 'Alamat Tinggal' : '居住地址'}:</strong> ${customer.living_same_as_ktp !== false ? (lang === 'id' ? 'Sama KTP' : '同KTP') : Utils.escapeHtml(customer.living_address || '-')}</p><p><strong>${lang === 'id' ? 'Toko Asal' : '所属门店'}:</strong> ${Utils.escapeHtml(customer.stores?.name || '-')} (${Utils.escapeHtml(customer.stores?.code || '-')})</p></div>
                    <div class="store-info-banner" style="background:#e0f2fe; padding:10px 15px; border-radius:8px; margin-bottom:16px;"><span>🏪 ${lang === 'id' ? 'Order akan dibuat untuk toko' : '订单将创建在门店'}: <strong>${Utils.escapeHtml(userStoreName)} (${Utils.escapeHtml(userStoreCode)})</strong></span></div>
                    <h3>${t('collateral_info')}</h3>
                    <div class="form-grid">
                        <div class="form-group full-width"><label>${t('collateral_name')} *</label><input id="collateral" placeholder="${t('collateral_name')}"></div>
                        <div class="form-group"><label>${t('loan_amount')} *</label><input type="text" id="amount" placeholder="${t('loan_amount')}" class="amount-input"></div>
                        <div class="form-group"><label>💰 ${lang === 'id' ? 'Sumber Dana Pinjaman' : '贷款资金来源'} *</label>
                            <select id="loanSource">
                                <option value="bank">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'} (${Utils.formatCurrency(bankBalance)})</option>
                                <option value="cash">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'} (${Utils.formatCurrency(cashBalance)})</option>
                                <option value="profit">📊 ${lang === 'id' ? 'Laba Bersih Toko' : '门店净利'} (${Utils.formatCurrency(profitBalance)})</option>
                            </select>
                        </div>
                        <div class="form-group full-width"><label>${t('notes')}</label><textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea></div>
                        <div class="form-actions"><button onclick="APP.saveOrderWithCustomer('${customerId}')" class="success">💾 ${t('save')}</button><button onclick="APP.goBack()">↩️ ${t('cancel')}</button></div>
                    </div>
                </div>
                <style>.customer-info-display{background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px}.customer-info-display p{margin:6px 0}.amount-input{text-align:right}</style>`;
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) { console.error("createOrderForCustomer error:", error); alert(Utils.lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败'); }
    },

    saveOrderWithCustomer: async function(customerId) {
        var collateral = document.getElementById("collateral").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var notes = document.getElementById("notes").value;
        var loanSource = document.getElementById("loanSource").value;
        if (!collateral || !amount || amount <= 0) { alert(Utils.t('fill_all_fields')); return; }
        try {
            const { data: customer } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            var orderData = {
                customer: { name: customer.name, ktp: customer.ktp_number || '', phone: customer.phone, address: customer.ktp_address || customer.address || '' },
                collateral_name: collateral, loan_amount: amount, notes: notes, customer_id: customerId, store_id: null, loan_source: loanSource
            };
            var newOrder = await Order.create(orderData);
            alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
            this.goBack();
        } catch (error) { console.error("saveOrderWithCustomer error:", error); alert(Utils.lang === 'id' ? 'Gagal menyimpan order: ' + error.message : '保存订单失败：' + error.message); }
    },

    showBlacklistCustomerModal: async function(customerId, customerName) {
        var lang = Utils.lang;
        const { isBlacklisted } = await APP.isBlacklisted(customerId);
        if (isBlacklisted) { alert(lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中'); return; }
        var modal = document.createElement('div');
        modal.id = 'blacklistModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal-content" style="max-width:450px;"><h3>🚫 ${lang === 'id' ? 'Blacklist Nasabah' : '拉黑客户'}</h3><p><strong>${Utils.escapeHtml(customerName)}</strong></p><div class="form-group"><label>${lang === 'id' ? 'Alasan Blacklist' : '拉黑原因'} *</label><textarea id="blacklistReason" rows="3" style="width:100%;" placeholder="${lang === 'id' ? 'Contoh: Sering telat bayar, Tidak kooperatif, dll' : '例如：经常逾期、不配合等'}"></textarea></div><div class="modal-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;"><button onclick="APP.confirmAddToBlacklist('${customerId}')" class="danger" style="background:#dc2626;color:white;">🚫 ${lang === 'id' ? 'Blacklist' : '确认拉黑'}</button><button onclick="document.getElementById('blacklistModal').remove()">✖ ${lang === 'id' ? 'Batal' : '取消'}</button></div></div>`;
        document.body.appendChild(modal);
    },

    confirmAddToBlacklist: async function(customerId) {
        var lang = Utils.lang;
        var reason = document.getElementById('blacklistReason')?.value.trim();
        if (!reason) { alert(lang === 'id' ? 'Harap isi alasan blacklist' : '请填写拉黑原因'); return; }
        try {
            await APP.addToBlacklist(customerId, reason);
            document.getElementById('blacklistModal')?.remove();
            alert(lang === 'id' ? '✅ Nasabah berhasil diblacklist' : '✅ 客户已拉黑');
            await this.showCustomers();
        } catch (error) { alert(lang === 'id' ? 'Gagal: ' + error.message : '失败：' + error.message); }
    },

    removeFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus nasabah ini dari daftar hitam?' : '确定将此客户移出黑名单？')) return;
        try {
            await APP.removeFromBlacklist(customerId);
            alert(lang === 'id' ? '✅ Nasabah dihapus dari daftar hitam' : '✅ 客户已移出黑名单');
            await this.showCustomers();
        } catch (error) { alert(lang === 'id' ? 'Gagal: ' + error.message : '失败：' + error.message); }
    },

    printBlacklistOnly: async function() {
        var lang = Utils.lang;
        var blacklistData = await APP.getBlacklist();
        if (blacklistData.length === 0) { alert(lang === 'id' ? 'Tidak ada data blacklist' : '暂无黑名单数据'); return; }
        var printContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JF! by Gadai - ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;margin:20px;font-size:12px}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px}.header h1{margin:0;font-size:18px;color:#dc2626}.header p{margin:5px 0;color:#666;font-size:11px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#fef3c7;font-weight:600}.footer{margin-top:20px;text-align:center;font-size:10px;color:#666;border-top:1px solid #ccc;padding-top:10px}@media print{@page{size:A4 landscape;margin:10mm}body{margin:0}.no-print{display:none}}</style></head><body><div class="header"><h1>🚫 JF! by Gadai - ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</h1><p>${lang === 'id' ? 'Tanggal Cetak' : '打印日期'}: ${new Date().toLocaleString()}</p></div><table><thead><tr><th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th><th>${lang === 'id' ? 'Nama' : '姓名'}</th><th>${lang === 'id' ? 'KTP' : 'KTP'}</th><th>${lang === 'id' ? 'Telepon' : '电话'}</th><th>${lang === 'id' ? 'Alasan' : '拉黑原因'}</th><th>${lang === 'id' ? 'Tanggal' : '拉黑日期'}</th></tr></thead><tbody>`;
        for (var item of blacklistData) {
            var customer = item.customers;
            printContent += `<tr><td style="padding:8px;">${Utils.escapeHtml(customer?.customer_id || '-')}</td><td style="padding:8px;">${Utils.escapeHtml(customer?.name || '-')}</td><td style="padding:8px;">${Utils.escapeHtml(customer?.ktp_number || '-')}</td><td style="padding:8px;">${Utils.escapeHtml(customer?.phone || '-')}</td><td style="padding:8px;">${Utils.escapeHtml(item.reason)}</td><td style="padding:8px;">${Utils.formatDate(item.blacklisted_at)}</td></tr>`;
        }
        printContent += `</tbody></table><div class="footer"><div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div></div><div class="no-print" style="text-align:center; margin-top:20px;"><button onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button><button onclick="window.close()" style="margin-left:10px;">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button></div></body></html>`;
        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    },

    exportBlacklistOnlyToCSV: async function() {
        var lang = Utils.lang;
        var blacklistData = await APP.getBlacklist();
        if (blacklistData.length === 0) { alert(lang === 'id' ? 'Tidak ada data untuk diekspor' : '没有数据可导出'); return; }
        var headers = lang === 'id' ? ['ID Nasabah', 'Nama', 'KTP', 'Telepon', 'Alasan', 'Tanggal Diblacklist'] : ['客户ID', '姓名', 'KTP号', '电话', '拉黑原因', '拉黑日期'];
        var rows = [];
        for (var item of blacklistData) {
            var customer = item.customers;
            rows.push([customer?.customer_id || '-', customer?.name || '-', customer?.ktp_number || '-', customer?.phone || '-', item.reason, Utils.formatDate(item.blacklisted_at)]);
        }
        var csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = `jf_blacklist_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    },

    showCustomerOrders: async function(customerId) {
        this.currentPage = 'customerOrders';
        this.currentCustomerId = customerId;
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        try {
            const { data: customer } = await supabaseClient.from('customers').select('*, stores(name, code)').eq('id', customerId).single();
            const { data: orders, error } = await supabaseClient.from('orders').select('*, stores(code, name)').eq('customer_id', customerId).order('created_at', { ascending: false });
            if (error) throw error;
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var rows = orders && orders.length > 0 ? orders.map(o => {
                var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                return `<tr><td class="order-id">${Utils.escapeHtml(o.order_id)}</td><td class="date-cell">${Utils.formatDate(o.created_at)}</td><td class="text-right">${Utils.formatCurrency(o.loan_amount)}</td><td class="text-right">${Utils.formatCurrency(o.principal_paid)}</td><td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td><td class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td><td class="action-cell"><button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})" class="btn-small">👁️ ${t('view')}</button>${o.status === 'active' ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})" class="btn-small success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}</td></tr>`;
            }).join('') : `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`;
            document.getElementById("app").innerHTML = `<div class="page-header"><h2>📋 ${lang === 'id' ? 'Order Nasabah' : '客户订单'} - ${Utils.escapeHtml(customer.name)}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button></div></div><div class="card customer-summary"><p><strong>${lang === 'id' ? 'ID Nasabah' : '客户ID'}:</strong> ${Utils.escapeHtml(customer.customer_id || '-')}</p><p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p><p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(customer.ktp_number || '-')}</p><p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p><p><strong>${lang === 'id' ? 'Toko' : '门店'}:</strong> ${Utils.escapeHtml(customer.stores?.name || '-')}</p></div><div class="card"><h3>📋 ${t('order_list')}</h3><div class="table-container"><table class="order-table"><thead><tr><th>ID</th><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th class="text-right">${t('loan_amount')}</th><th class="text-right">${lang === 'id' ? 'Pokok Dibayar' : '已还本金'}</th><th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th><th class="text-center">${lang === 'id' ? 'Status' : '状态'}</th><th>${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead><tbody>${rows}</tbody></table></div></div><style>.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.customer-summary{background:#f8fafc}.customer-summary p{margin:6px 0}.order-table{width:100%;border-collapse:collapse}.order-table th,.order-table td{border:1px solid #cbd5e1;padding:8px}.order-table th{background:#f8fafc}.text-right{text-align:right}.text-center{text-align:center}.btn-small{padding:4px 8px;font-size:12px;margin:0 2px}</style>`;
        } catch (error) { console.error("showCustomerOrders error:", error); alert(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败'); }
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
            var rows = allPayments.length === 0 ? `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>` : allPayments.map(p => `<tr><td class="date-cell">${Utils.formatDate(p.date)}</td><td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td><td>${typeMap[p.type] || p.type}</td><td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td><td class="text-right">${Utils.formatCurrency(p.amount)}</td><td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td><td>${Utils.escapeHtml(p.description || '-')}</td></tr>`).join('');
            document.getElementById("app").innerHTML = `<div class="page-header"><h2>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'} - ${Utils.escapeHtml(customer.name)}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button></div></div><div class="card customer-summary"><p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(customer.name)}</p><p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(customer.phone)}</p></div><div class="card"><h3>💰 ${lang === 'id' ? 'Riwayat Pembayaran' : '付款记录'}</h3><div class="table-container"><table class="payment-table"><thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'ID Pesanan' : '订单ID'}</th><th>${lang === 'id' ? 'Jenis' : '类型'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '支付方式'}</th><th>${lang === 'id' ? 'Keterangan' : '说明'}</th></tr></thead><tbody>${rows}</tbody></table></div></div><style>.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.customer-summary{background:#f8fafc}.text-right{text-align:right}.text-center{text-align:center}</style>`;
        } catch (error) { console.error("showCustomerPaymentHistory error:", error); alert(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败'); }
    }
};

for (var key in CustomersModule) {
    if (typeof CustomersModule[key] === 'function') window.APP[key] = CustomersModule[key];
}
