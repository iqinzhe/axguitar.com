const StoreManager = {
    stores: [],
    _loaded: false,

    async loadStores(force = false) {
        if (!force && this._loaded && this.stores.length > 0) return this.stores;
        this.stores = await SUPABASE.getAllStores();
        this._loaded = true;
        return this.stores;
    },

    async createStore(code, name, address, phone) {
        const newStore = await SUPABASE.createStore(code, name, address, phone);
        this.stores.push(newStore);
        this.stores.sort((a, b) => a.name.localeCompare(b.name));
        return newStore;
    },

    async updateStore(id, updates) {
        const updated = await SUPABASE.updateStore(id, updates);
        const idx = this.stores.findIndex(s => s.id === id);
        if (idx !== -1) this.stores[idx] = { ...this.stores[idx], ...updated };
        return updated;
    },

    async deleteStore(id) {
        await SUPABASE.deleteStore(id);
        this.stores = this.stores.filter(s => s.id !== id);
    },

    async getStoreExpenses(storeId) {
        const { data, error } = await supabaseClient.from('expenses').select('amount, payment_method').eq('store_id', storeId);
        if (error) return { total: 0, cash: 0, bank: 0 };
        const total = data?.reduce((s, e) => s + e.amount, 0) || 0;
        const cash = data?.filter(e => e.payment_method === 'cash').reduce((s, e) => s + e.amount, 0) || 0;
        const bank = data?.filter(e => e.payment_method === 'bank').reduce((s, e) => s + e.amount, 0) || 0;
        return { total, cash, bank };
    },

    async getStoreIncome(storeId) {
        const { data: orders, error } = await supabaseClient.from('orders').select('admin_fee_paid, admin_fee, interest_paid_total').eq('store_id', storeId);
        if (error) return { total: 0, adminFee: 0, interest: 0 };
        const adminFee = orders?.reduce((s, o) => s + (o.admin_fee_paid ? o.admin_fee : 0), 0) || 0;
        const interest = orders?.reduce((s, o) => s + (o.interest_paid_total || 0), 0) || 0;
        return { total: adminFee + interest, adminFee, interest };
    },

    async getStoreCashBalance(storeId) {
        // 获取该门店的所有订单ID
        const { data: orders } = await supabaseClient.from('orders').select('id').eq('store_id', storeId);
        const orderIds = orders?.map(o => o.id) || [];
        
        // 获取收入（按支付方式分类）
        let cashIncome = 0, bankIncome = 0;
        if (orderIds.length > 0) {
            const { data: payments } = await supabaseClient
                .from('payment_history')
                .select('type, amount, payment_method')
                .in('order_id', orderIds);
            
            for (var p of payments || []) {
                if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                    if (p.payment_method === 'cash') cashIncome += p.amount;
                    else if (p.payment_method === 'bank') bankIncome += p.amount;
                }
            }
        }
        
        // 获取支出
        const { data: expenses } = await supabaseClient.from('expenses').select('amount, payment_method').eq('store_id', storeId);
        let cashExpense = 0, bankExpense = 0;
        for (var e of expenses || []) {
            if (e.payment_method === 'cash') cashExpense += e.amount;
            else if (e.payment_method === 'bank') bankExpense += e.amount;
        }
        
        return { cash: cashIncome - cashExpense, bank: bankIncome - bankExpense };
    },

    editStore: async function(storeId) {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        try {
            const { data: store, error } = await supabaseClient
                .from('stores')
                .select('*')
                .eq('id', storeId)
                .single();
            
            if (error) throw error;
            
            var modal = document.createElement('div');
            modal.id = 'editStoreModal';
            modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML = `
                <div style="background:#ffffff;border-radius:12px;padding:24px;width:100%;max-width:500px;">
                    <h3 style="margin-top:0;color:#1e293b;">✏️ ${lang === 'id' ? 'Edit Toko' : '编辑门店'}</h3>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Kode Toko' : '门店编码'} *</label>
                        <input id="editStoreCode" value="${Utils.escapeHtml(store.code)}" readonly style="background:#f1f5f9;cursor:not-allowed;">
                        <small style="color:#64748b;">⚠️ ${lang === 'id' ? 'Kode tidak dapat diubah' : '编码不可修改'}</small>
                    </div>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Nama Toko' : '门店名称'} *</label>
                        <input id="editStoreName" value="${Utils.escapeHtml(store.name)}">
                    </div>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Alamat' : '地址'}</label>
                        <input id="editStoreAddress" value="${Utils.escapeHtml(store.address || '')}">
                    </div>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Telepon' : '电话'}</label>
                        <input id="editStorePhone" value="${Utils.escapeHtml(store.phone || '')}">
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
                        <button onclick="StoreManager._saveEditStore('${storeId}')" class="success">💾 ${t('save')}</button>
                        <button onclick="document.getElementById('editStoreModal').remove()">✖ ${t('cancel')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat data toko' : '加载门店数据失败');
        }
    },

    _saveEditStore: async function(storeId) {
        var lang = Utils.lang;
        var name = document.getElementById('editStoreName').value.trim();
        var address = document.getElementById('editStoreAddress').value.trim();
        var phone = document.getElementById('editStorePhone').value.trim();
        
        if (!name) {
            alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        
        try {
            const { error } = await supabaseClient
                .from('stores')
                .update({ name: name, address: address || null, phone: phone || null })
                .eq('id', storeId);
            
            if (error) throw error;
            
            document.getElementById('editStoreModal')?.remove();
            alert(lang === 'id' ? 'Toko berhasil diperbarui' : '门店已更新');
            await this.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    async renderStoreManagement() {
        await this.loadStores();
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        const cashFlow = await SUPABASE.getCashFlowSummary();

        let storeStatsRows = '';
        let grandTotal = { 
            orders: 0, active: 0, loan: 0, adminFee: 0, interest: 0, 
            principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
        };
        
        for (const store of this.stores) {
            // 获取订单数据
            const { data: orders } = await supabaseClient.from('orders').select('*').eq('store_id', store.id);
            const ords = orders || [];
            const activeOrds = ords.filter(o => o.status === 'active');
            const totalLoan = ords.reduce((s, o) => s + o.loan_amount, 0);
            const totalAdminFee = ords.reduce((s, o) => s + (o.admin_fee_paid ? o.admin_fee : 0), 0);
            const totalInterest = ords.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
            const totalPrincipal = ords.reduce((s, o) => s + (o.principal_paid || 0), 0);
            const totalIncome = totalAdminFee + totalInterest;
            
            // 获取支出
            const expenses = await this.getStoreExpenses(store.id);
            const totalExpenses = expenses.total;
            
            // 获取现金流余额
            const balances = await this.getStoreCashBalance(store.id);
            
            grandTotal.orders += ords.length;
            grandTotal.active += activeOrds.length;
            grandTotal.loan += totalLoan;
            grandTotal.adminFee += totalAdminFee;
            grandTotal.interest += totalInterest;
            grandTotal.principal += totalPrincipal;
            grandTotal.expenses += totalExpenses;
            grandTotal.income += totalIncome;
            grandTotal.cashBalance += balances.cash;
            grandTotal.bankBalance += balances.bank;
            
            storeStatsRows += `<tr>
                <td style="border:1px solid #cbd5e1;padding:8px;"><strong>${Utils.escapeHtml(store.name)}</strong></td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${ords.length}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${activeOrds.length}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(totalLoan)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(totalAdminFee)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(totalInterest)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(totalPrincipal)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(totalIncome)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#ef4444;">${Utils.formatCurrency(totalExpenses)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(balances.cash)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(balances.bank)}</td>
            　　　`;
        }

        let storeRows = '';
        if (this.stores.length === 0) {
            storeRows = `<tr><td colspan="5" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
            storeStatsRows = `<tr><td colspan="11" style="text-align:center;padding:20px;">${t('no_data')}</td></td>`;
        } else {
            for (const store of this.stores) {
                storeRows += `<tr>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.code)}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.name)}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.address || '-')}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.phone || '-')}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;white-space:nowrap;">
                        <button onclick="StoreManager.editStore('${store.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${t('edit')}</button>
                        <button class="danger" onclick="APP.deleteStore('${store.id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>
                    </td>
                　　`;
            }
        }

        document.getElementById("app").innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                <div><button onclick="APP.goBack()">↩️ ${t('back')}</button></div>
            </div>

            <div class="cashflow-summary" style="margin-bottom:20px;">
                <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                <div class="cashflow-stats">
                    <div class="cashflow-item">
                        <div class="label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</div>
                        <div class="value">${Utils.formatCurrency(cashFlow.cash.balance)}</div>
                        <div style="font-size:10px; opacity:0.7;">+${Utils.formatCurrency(cashFlow.cash.income)} / -${Utils.formatCurrency(cashFlow.cash.expense)}</div>
                    </div>
                    <div class="cashflow-item">
                        <div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                        <div class="value">${Utils.formatCurrency(cashFlow.bank.balance)}</div>
                        <div style="font-size:10px; opacity:0.7;">+${Utils.formatCurrency(cashFlow.bank.income)} / -${Utils.formatCurrency(cashFlow.bank.expense)}</div>
                    </div>
                    <div class="cashflow-item">
                        <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
                        <div class="value">${Utils.formatCurrency(cashFlow.total.balance)}</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h3>
                <div class="table-container" style="overflow-x: auto;">
                    <table style="min-width:1000px; width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Toko' : '门店'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${t('total_orders')}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${t('active')}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${t('total_loan')}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Bunga' : '利息'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Pokok' : '本金'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Pendapatan' : '管理费+利息'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Pengeluaran' : '运营支出'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</th>
                            </tr>
                        </thead>
                        <tbody>${storeStatsRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>${lang === 'id' ? 'Daftar Toko' : '门店列表'}</h3>
                <div class="table-container">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Kode' : '编码'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Nama' : '名称'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Alamat' : '地址'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Telepon' : '电话'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${storeRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>${lang === 'id' ? 'Tambah Toko Baru' : '新增门店'}</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Kode Toko' : '门店编码'} *</label>
                        <input id="newStoreCode" placeholder="STORE_004">
                        <small style="color:#64748b;font-size:11px;">${lang === 'id' ? 'Contoh: BL, GP, SO' : '例如: BL, GP, SO'}</small>
                    </div>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Nama Toko' : '门店名称'} *</label>
                        <input id="newStoreName" placeholder="${lang === 'id' ? 'Nama Toko' : '门店名称'}">
                    </div>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Alamat' : '地址'}</label>
                        <input id="newStoreAddress" placeholder="${lang === 'id' ? 'Alamat' : '地址'}">
                    </div>
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Telepon' : '电话'}</label>
                        <input id="newStorePhone" placeholder="${lang === 'id' ? 'Telepon' : '电话'}">
                    </div>
                    <div class="form-actions">
                        <button onclick="APP.addStore()" class="success">➕ ${lang === 'id' ? 'Tambah Toko' : '添加门店'}</button>
                    </div>
                </div>
            </div>
            
            <div class="toolbar">
                <button onclick="APP.printCurrentPage()" class="success print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
            </div>`;
    }
};

window.StoreManager = StoreManager;
