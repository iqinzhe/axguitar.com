// app-customers.js - v2.1（双行显示修正版）

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
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = `<tr><td colspan="2" class="text-center">${t('no_data')}<\/td><\/tr>`;
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
                    
                    // 第一行：客户基本信息
                    rows += `
                        <tr class="customer-info-row">
                            <td colspan="2" class="customer-cell">
                                <div class="customer-info">
                                    <div class="customer-line1">
                                        <span class="customer-id">${customerId}</span>
                                        <span class="customer-date">${registeredDate}</span>
                                        <span class="customer-name">${name}</span>
                                        <span class="customer-phone">📞 ${phone}</span>
                                    </div>
                                    <div class="customer-line2">
                                        <span class="customer-ktp">🪪 ${ktpNumber}</span>
                                        <span class="customer-ktp-addr">🏠 ${ktpAddress}</span>
                                        <span class="customer-living-addr">📍 ${livingAddress}</span>
                                        ${isAdmin ? `<span class="customer-store">🏪 ${storeName}</span>` : ''}
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                    
                    // 第二行：操作按钮
                    rows += `
                        <tr class="customer-action-row">
                            <td colspan="2" class="action-cell">
                                ${!isAdmin ? `<button onclick="APP.editCustomer('${c.id}')" class="btn-small">✏️ ${lang === 'id' ? 'Ubah' : '修改'}</button>` : ''}
                                ${!isAdmin ? `<button onclick="APP.createOrderForCustomer('${c.id}')" class="btn-small success">➕ ${lang === 'id' ? 'Buat Order' : '建立订单'}</button>` : ''}
                                ${!isAdmin ? `<button onclick="APP.blacklistCustomer('${c.id}')" class="btn-small warning">🚫 ${lang === 'id' ? 'Blacklist' : '拉黑'}</button>` : ''}
                                ${PERMISSION.canDeleteCustomer() ? `<button onclick="APP.deleteCustomer('${c.id}')" class="btn-small danger">🗑️ ${t('delete')}</button>` : ''}
                            </td>
                        </tr>
                    `;
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
                                <label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Sama dengan KTP' : '同上KTP'}</label>
                                <label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ${lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）'}</label>
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
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                    <div class="table-container">
                        <table class="customer-double-row-table">
                            <thead>
                                <tr>
                                    <th colspan="2">${lang === 'id' ? 'Data Nasabah' : '客户资料'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                ${addCustomerCardHtml}`;
                
            this._addDoubleRowStyles();
            
        } catch (error) {
            console.error("showCustomers error:", error);
            alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
        }
    },
    
    // 添加客户双行显示的CSS样式
    _addDoubleRowStyles: function() {
        if (document.getElementById('customer-double-row-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'customer-double-row-styles';
        style.textContent = `
            /* 客户列表双行显示样式 */
            .customer-double-row-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .customer-double-row-table th {
                padding: 10px 12px;
                background: var(--gray-100);
                font-weight: 600;
                text-align: left;
            }
            
            /* 客户信息行 */
            .customer-info-row {
                border-top: 1px solid var(--gray-200);
            }
            
            .customer-info-row td {
                padding: 12px 12px 6px 12px;
                border-bottom: none;
            }
            
            /* 操作按钮行 */
            .customer-action-row td {
                padding: 6px 12px 12px 12px;
                border-bottom: 1px solid var(--gray-200);
            }
            
            .customer-cell {
                width: 100%;
            }
            
            .action-cell {
                width: 100%;
            }
            
            .action-cell .btn-small {
                margin-right: 8px;
                margin-bottom: 4px;
            }
            
            .customer-info {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .customer-line1 {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 12px;
                row-gap: 4px;
            }
            
            .customer-line2 {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 16px;
                row-gap: 4px;
                font-size: 0.75rem;
                color: var(--gray-500);
            }
            
            .customer-id {
                font-family: monospace;
                font-weight: 600;
                color: var(--primary-dark);
                background: var(--primary-soft);
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
            }
            
            .customer-name {
                font-weight: 600;
                color: var(--gray-800);
            }
            
            .customer-date {
                font-size: 0.7rem;
                color: var(--gray-500);
            }
            
            .customer-phone::before {
                content: "📞";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            
            .customer-ktp::before {
                content: "🪪";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            
            .customer-ktp-addr::before {
                content: "🏠";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            
            .customer-living-addr::before {
                content: "📍";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            
            .customer-store::before {
                content: "🏪";
                font-size: 0.65rem;
                margin-right: 2px;
            }
            
            /* 限制文字最多2行 */
            .customer-line1 span,
            .customer-line2 span {
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                white-space: normal;
                word-break: break-word;
            }
            
            /* 手机端适配 */
            @media (max-width: 768px) {
                .customer-line1 {
                    gap: 8px;
                }
                .customer-line2 {
                    gap: 8px;
                    flex-direction: column;
                    align-items: flex-start;
                }
                .action-cell .btn-small {
                    display: inline-block;
                    margin: 4px 4px 4px 0;
                }
                .customer-line1 span,
                .customer-line2 span {
                    max-width: 150px;
                }
            }
            
            @media (max-width: 480px) {
                .customer-line1 span,
                .customer-line2 span {
                    max-width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    },

    blacklistCustomer: async function(customerId) {
        var lang = Utils.lang;
        
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
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    editCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        
        if (isAdmin) {
            alert(lang === 'id' ? 'Administrator tidak dapat mengubah nasabah.' : '管理员不能修改客户信息。');
            return;
        }
        
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
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        
        if (isAdmin) {
            alert(lang === 'id' ? 'Administrator tidak dapat mengubah nasabah.' : '管理员不能修改客户信息。');
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

    // ==================== 辅助函数 ====================
    
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

    // ==================== 创建订单 ====================
    createOrderForCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        
        if (isAdmin) {
            alert(lang === 'id' ? 'Administrator tidak dapat membuat order. Silakan login sebagai Manajer Toko atau Staf.' : '管理员不能创建订单，请使用店长或员工账号登录。');
            return;
        }
        
        try {
            const { data: existingOrders } = await supabaseClient
                .from('orders').select('status').eq('customer_id', customerId).eq('status', 'active');
            if (existingOrders && existingOrders.length > 0) {
                alert(Utils.lang === 'id' ? 'Nasabah ini masih memiliki order aktif.' : '该客户还有未结清的订单。');
                return;
            }
            
            const { data: customer, error } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            if (error) throw error;

            this.currentPage = 'createOrder';
            this.currentCustomerId = customerId;
            var t = (key) => Utils.t(key);
            
            const profile = await SUPABASE.getCurrentProfile();
            const userStoreName = profile?.stores?.name || (lang === 'id' ? 'Toko tidak diketahui' : '未知门店');
            const userStoreCode = profile?.stores?.code || '-';

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
                            <input type="text" id="amount" placeholder="${t('loan_amount')}" class="amount-input" oninput="APP.updateServiceFeeDisplay()">
                        </div>
                        <div class="form-group">
                            <label>💰 ${lang === 'id' ? 'Sumber Dana Pinjaman' : '贷款资金来源'}</label>
                            <div class="payment-method-options">
                                <label><input type="radio" name="loanSource" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="loanSource" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                            <small style="color:#64748b;">${lang === 'id' ? 'Dana pinjaman berasal dari' : '贷款资金从哪里发放'}</small>
                        </div>
                        
                        <div class="form-group fee-section">
                            <label>💰 ${lang === 'id' ? 'Service Fee' : '服务费'}</label>
                            <div class="fee-options">
                                <select id="serviceFeePercent" class="fee-select" onchange="APP.updateServiceFeeDisplay()">
                                    <option value="0">0% ${lang === 'id' ? '(Tidak Ada)' : '(无)'}</option>
                                    <option value="1">1%</option>
                                    <option value="2">2%</option>
                                    <option value="3">3%</option>
                                </select>
                                <div id="serviceFeeDisplay" class="fee-display" style="display:none;"></div>
                                <input type="hidden" id="serviceFeeAmount" value="0">
                                <small style="color:#64748b; display:block; margin-top:6px;">${lang === 'id' ? 'Dihitung dari jumlah pinjaman, dibayar sekali' : '按贷款金额计算，一次性支付'}</small>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>📋 ${lang === 'id' ? 'Metode Pemasukan Service Fee' : '服务费入账方式'}</label>
                            <div class="payment-method-options">
                                <label><input type="radio" name="serviceFeeMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="serviceFeeMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        
                        <div class="form-group fee-section">
                            <label>📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</label>
                            <div class="fee-options">
                                <select id="adminFeeSelect" class="fee-select" onchange="APP.updateAdminFeeSelect()">
                                    <option value="30000">Rp 30.000</option>
                                    <option value="40000">Rp 40.000</option>
                                    <option value="50000">Rp 50.000</option>
                                    <option value="manual">✏️ ${lang === 'id' ? 'Input Manual' : '手动输入'}</option>
                                </select>
                                <div id="adminFeeManualContainer" style="display:none; margin-top:8px;">
                                    <input type="text" id="adminFeeManual" placeholder="${Utils.formatCurrency(0)}" class="amount-input" style="width:100%;" oninput="APP.updateAdminFeeManual()">
                                </div>
                                <div id="adminFeeDisplay" class="fee-display">📋 ${Utils.formatCurrency(30000)} ${lang === 'id' ? '(dibayar sekali)' : '(一次性支付)'}</div>
                                <input type="hidden" id="adminFeeAmount" value="30000">
                                <small style="color:#64748b; display:block; margin-top:6px;">${lang === 'id' ? 'Biaya administrasi, dibayar sekali' : '管理费，一次性支付'}</small>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>📋 ${lang === 'id' ? 'Metode Pemasukan Admin Fee' : '管理费入账方式'}</label>
                            <div class="payment-method-options">
                                <label><input type="radio" name="adminFeeMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="adminFeeMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        
                        <div class="form-group full-width">
                            <label>${t('notes')}</label>
                            <textarea id="notes" rows="2" placeholder="${t('notes')}"></textarea>
                        </div>
                        
                        <div class="form-actions">
                            <button onclick="APP.saveOrderWithCustomer('${customerId}')" class="success">💾 ${t('save')}</button>
                            <button onclick="APP.goBack()">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                </div>`;
            
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
            
            var manualInput = document.getElementById("adminFeeManual");
            if (manualInput && Utils.bindAmountFormat) Utils.bindAmountFormat(manualInput);
            
            this.updateServiceFeeDisplay();
            
        } catch (error) {
            console.error("createOrderForCustomer error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
        }
    },

    saveOrderWithCustomer: async function(customerId) {
        var lang = Utils.lang;
        var collateral = document.getElementById("collateral").value.trim();
        var collateralNote = document.getElementById("collateralNote").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var notes = document.getElementById("notes").value;
        
        var serviceFeePercent = parseInt(document.getElementById("serviceFeePercent").value) || 0;
        var serviceFeeAmount = amount * (serviceFeePercent / 100);
        var serviceFeeMethod = document.querySelector('input[name="serviceFeeMethod"]:checked')?.value || 'cash';
        
        var adminFeeAmount = parseInt(document.getElementById("adminFeeAmount").value) || 0;
        var adminFeeMethod = document.querySelector('input[name="adminFeeMethod"]:checked')?.value || 'cash';
        
        var loanSource = document.querySelector('input[name="loanSource"]:checked')?.value || 'cash';
        
        var fullCollateralName = collateralNote ? `${collateral} (${collateralNote})` : collateral;
        
        if (!collateral || !amount || amount <= 0) { alert(Utils.t('fill_all_fields')); return; }
        
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            var orderData = {
                customer: { 
                    name: customer.name, 
                    ktp: customer.ktp_number || '', 
                    phone: customer.phone, 
                    address: customer.ktp_address || customer.address || '' 
                },
                collateral_name: fullCollateralName,
                loan_amount: amount,
                service_fee_percent: serviceFeePercent,
                notes: notes,
                customer_id: customerId,
                store_id: null
            };
            
            var newOrder = await Order.create(orderData);
            
            if (amount > 0) {
                try {
                    await Order.recordLoanDisbursement(newOrder.order_id, amount, loanSource, 
                        lang === 'id' ? `Pencairan pinjaman dari ${loanSource === 'cash' ? 'Brankas' : 'Bank BNI'}` : `贷款发放自 ${loanSource === 'cash' ? '保险柜' : '银行BNI'}`);
                    console.log(`✅ 贷款发放: ${Utils.formatCurrency(amount)} 来源: ${loanSource}`);
                } catch (loanError) {
                    console.error("贷款发放记录失败:", loanError);
                    alert(lang === 'id' 
                        ? `⚠️ 订单已创建，但贷款发放记录失败: ${loanError.message}`
                        : `⚠️ 订单已创建，但贷款发放记录失败: ${loanError.message}`);
                }
            }
            
            if (serviceFeeAmount > 0) {
                try {
                    await Order.recordServiceFee(newOrder.order_id, 1, serviceFeeMethod);
                    console.log(`✅ 服务费已收取: ${Utils.formatCurrency(serviceFeeAmount)} 方式: ${serviceFeeMethod}`);
                } catch (serviceFeeError) {
                    console.error("服务费收取失败:", serviceFeeError);
                    alert(lang === 'id' 
                        ? `⚠️ 订单已创建，但服务费收取失败: ${serviceFeeError.message}`
                        : `⚠️ 订单已创建，但服务费收取失败: ${serviceFeeError.message}`);
                }
            }
            
            if (adminFeeAmount > 0) {
                try {
                    await Order.recordAdminFee(newOrder.order_id, adminFeeMethod, adminFeeAmount);
                    console.log(`✅ 管理费已收取: ${Utils.formatCurrency(adminFeeAmount)} 方式: ${adminFeeMethod}`);
                } catch (adminFeeError) {
                    console.error("管理费收取失败:", adminFeeError);
                    alert(lang === 'id' 
                        ? `⚠️ 订单已创建，但管理费收取失败: ${adminFeeError.message}`
                        : `⚠️ 订单已创建，但管理费收取失败: ${adminFeeError.message}`);
                }
            }
            
            alert(Utils.t('order_created') + "\nID: " + newOrder.order_id);
            this.goBack();
        } catch (error) {
            console.error("saveOrderWithCustomer error:", error);
            alert(lang === 'id' ? 'Gagal menyimpan order: ' + error.message : '保存订单失败：' + error.message);
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
                return `<tr>
                    <td class="order-id">${Utils.escapeHtml(o.order_id)}<\/td>
                    <td class="date-cell">${Utils.formatDate(o.created_at)}<\/td>
                    <td class="text-right">${Utils.formatCurrency(o.loan_amount)}<\/td>
                    <td class="text-right">${Utils.formatCurrency(o.principal_paid)}<\/td>
                    <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}<\/td>
                    <td class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}<\/span><\/td>
                    <td class="action-cell">
                        <button onclick="APP.navigateTo('viewOrder',{orderId:'${o.order_id}'})" class="btn-small">👁️ ${t('view')}<\/button>
                        ${o.status === 'active' && !AUTH.isAdmin() ? `<button onclick="APP.navigateTo('payment',{orderId:'${o.order_id}'})" class="btn-small success">💰 ${lang === 'id' ? 'Bayar' : '缴费'}</button>` : ''}
                    <\/td>
                <\/tr>`;
            }).join('') : `<td><td colspan="7" class="text-center">${t('no_data')}<\/td><\/tr>`;

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
                </div>`;
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
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', service_fee: lang === 'id' ? 'Service Fee' : '服务费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            var rows = allPayments.length === 0
                ? `<tr><td colspan="7" class="text-center">${t('no_data')}<\/td><\/tr>`
                : allPayments.map(p => `<tr>
                    <td class="date-cell">${Utils.formatDate(p.date)}<\/td>
                    <td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}<\/td>
                    <td>${typeMap[p.type] || p.type}<\/td>
                    <td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}<\/td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}<\/td>
                    <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}<\/span><\/td>
                    <td>${Utils.escapeHtml(p.description || '-')}<\/td>
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

console.log('✅ app-customers.js v2.1 已加载 - 双行显示修正版（客户信息和操作分行）');
