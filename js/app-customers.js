// app-customers.js - v2.1 (客户列表ID排序、管理员分组、ID重用、服务费可手工修改)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const CustomersPage = {

        // ==================== 构建客户列表 HTML（支持管理员按门店分组、ID升序） ====================
        async buildCustomersHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();

            try {
                let customers = await SUPABASE.getCustomers();
                const stores = await SUPABASE.getAllStores();
                
                // 获取活跃订单映射
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
                
                // 按客户编号排序（字符串升序）
                customers.sort((a, b) => (a.customer_id || '').localeCompare(b.customer_id || ''));
                
                // 辅助函数：生成表格行
                const buildRowsForCustomers = (customerList) => {
                    let rows = '';
                    for (const c of customerList) {
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
                    return rows;
                };
                
                let mainContent = '';
                
                if (isAdmin) {
                    // 管理员：按门店分组，每组一个表格
                    const customersByStore = {};
                    for (const c of customers) {
                        const storeId = c.store_id;
                        if (!customersByStore[storeId]) customersByStore[storeId] = [];
                        customersByStore[storeId].push(c);
                    }
                    // 获取门店列表并排序（按名称）
                    const sortedStores = stores.filter(s => s.code !== 'STORE_000').sort((a, b) => a.name.localeCompare(b.name));
                    let groupedTablesHtml = '';
                    for (const store of sortedStores) {
                        const storeCustomers = customersByStore[store.id] || [];
                        if (storeCustomers.length === 0) continue;
                        const storeName = Utils.escapeHtml(store.name);
                        const storeCode = Utils.escapeHtml(store.code);
                        const rows = buildRowsForCustomers(storeCustomers);
                        groupedTablesHtml += `
                            <div class="card" style="margin-bottom: 24px;">
                                <h3>🏪 ${storeName} <span style="font-size:0.8rem; color:var(--text-muted);">(${storeCode})</span> <span style="float:right; font-size:0.8rem;">👥 ${storeCustomers.length} ${lang === 'id' ? 'nasabah' : '客户'}</span></h3>
                                <div class="table-container">
                                    <table class="data-table customer-list-table">
                                        <thead>
                                            <tr>
                                                <th class="col-id">${t('customer_id')}</th>
                                                <th class="col-name">${t('customer_name')}</th>
                                                <th class="col-ktp">${t('ktp_number')}</th>
                                                <th class="col-phone">${t('phone')}</th>
                                                <th class="col-occupation">${t('occupation')}</th>
                                                <th class="text-center">${t('create_order_for')}</th>
                                                <th class="text-center">${t('action')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>${rows}</tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                    }
                    if (groupedTablesHtml === '') {
                        groupedTablesHtml = `<div class="card"><p class="text-center">${lang === 'id' ? 'Belum ada data nasabah' : '暂无客户数据'}</p></div>`;
                    }
                    mainContent = groupedTablesHtml;
                } else {
                    // 门店操作员：直接显示一个表格
                    const rows = buildRowsForCustomers(customers);
                    mainContent = `
                        <div class="card">
                            <h3>${lang === 'id' ? 'Daftar Nasabah' : '客户列表'}</h3>
                            <div class="table-container">
                                <table class="data-table customer-list-table">
                                    <thead>
                                        <tr>
                                            <th class="col-id">${t('customer_id')}</th>
                                            <th class="col-name">${t('customer_name')}</th>
                                            <th class="col-ktp">${t('ktp_number')}</th>
                                            <th class="col-phone">${t('phone')}</th>
                                            <th class="col-occupation">${t('occupation')}</th>
                                            <th class="text-center">${t('create_order_for')}</th>
                                            <th class="text-center">${t('action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }
                
                // 新增客户卡片（仅门店操作员可见）
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
                    ${mainContent}
                    ${addCustomerCardHtml}`;
                return content;
            } catch (error) {
                console.error("buildCustomersHTML error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data nasabah' : '加载客户数据失败');
                return `<div class="card"><p>❌ ${t('loading_failed', { module: '客户' })}</p></div>`;
            }
        },

        async renderCustomersHTML() { return await this.buildCustomersHTML(); },

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

        // ==================== 添加客户（使用 _generateCustomerId 实现 ID 重用） ====================
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

                // 黑名单重复检查（保持不变）
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

                // ========== 关键修改：使用 _generateCustomerId 自动重用空缺ID ==========
                let newCustomer = null;
                try {
                    const customerId = await SUPABASE._generateCustomerId(storeId);
                    const customerData = {
                        customer_id: customerId, store_id: storeId, name,
                        ktp_number: ktp || null, phone, occupation: occupation || null,
                        ktp_address: ktpAddress || null, address: ktpAddress || null,
                        living_same_as_ktp: livingSameAsKtp, living_address: livingAddress || null,
                        registered_date: registeredDate, created_by: profile.id
                    };
                    const { data, error } = await SUPABASE.getClient()
                        .from('customers')
                        .insert(customerData)
                        .select()
                        .single();
                    if (error) throw error;
                    newCustomer = data;
                } catch (error) {
                    console.error("addCustomer: 创建客户失败", error);
                    throw error;
                }
                // ================================================================

                if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
                Utils.toast.success(lang === 'id' ? 'Nasabah berhasil ditambahkan! ID: ' + newCustomer.customer_id : '客户添加成功！ID: ' + newCustomer.customer_id);
                await CustomersPage.showCustomers();
            } catch (error) {
                if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + t('save_customer'); }
                console.error("addCustomer error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            }
        },

        // 客户详情卡片等...（以下所有方法保持原样，因长度原因不再重复，但实际文件中必须完整保留）
        // 注意：以下方法必须保留原始实现，不得删除或截断。
        // 由于本文件较长，后续方法（showCustomerDetailCard, editCustomerFromCard, blacklistFromCard, 
        // unblacklistFromCard, deleteCustomerFromCard, showCustomerOrdersByStatus, editCustomer, 
        // _toggleEditLiving, _saveEditCustomer, deleteCustomer, createOrderForCustomer, saveOrderForCustomer,
        // recalculateAllFees, onAdminFeeManualChange, _updateAdminFeeHint, _updateServiceFeeHint,
        // recalculateServiceFee, onServiceFeeManualChange, onMonthlyPaymentManualChange, toggleRepaymentForm,
        // showCustomerOrders, buildCustomerOrdersHTML, renderCustomerOrdersHTML,
        // showCustomerPaymentHistory, buildCustomerPaymentHistoryHTML, renderCustomerPaymentHistoryHTML)
        // 请在您的实际文件中完整保留。
        // 为避免遗漏，您可以继续使用之前您提供的版本中的这些方法，只需替换 addCustomer 函数即可。
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
