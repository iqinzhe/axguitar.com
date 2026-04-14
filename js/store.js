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
        const { data, error } = await supabaseClient.from('expenses').select('amount').eq('store_id', storeId);
        if (error) return 0;
        return data?.reduce((s, e) => s + e.amount, 0) || 0;
    },

    async getStoreIncome(storeId) {
        const { data: orders, error } = await supabaseClient.from('orders').select('admin_fee_paid, admin_fee, interest_paid_total').eq('store_id', storeId);
        if (error) return 0;
        const totalAdminFees = orders?.reduce((s, o) => s + (o.admin_fee_paid ? o.admin_fee : 0), 0) || 0;
        const totalInterest = orders?.reduce((s, o) => s + (o.interest_paid_total || 0), 0) || 0;
        return totalAdminFees + totalInterest;
    },

    async renderStoreManagement() {
        await this.loadStores();
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);

        // 门店财务汇总
        let storeStatsRows = '';
        let grandTotalIncome = 0, grandTotalExpenses = 0, grandTotalGrossProfit = 0;
        for (const store of this.stores) {
            const expenses = await this.getStoreExpenses(store.id);
            const income = await this.getStoreIncome(store.id);
            const grossProfit = income - expenses;
            grandTotalIncome += income;
            grandTotalExpenses += expenses;
            grandTotalGrossProfit += grossProfit;
            storeStatsRows += `<tr>
                <td><strong>${Utils.escapeHtml(store.name)}</strong></td>
                <td style="color:#10b981;">${Utils.formatCurrency(income)}</td>
                <td style="color:#ef4444;">${Utils.formatCurrency(expenses)}</td>
                <td style="color:${grossProfit >= 0 ? '#10b981' : '#ef4444'};">${Utils.formatCurrency(grossProfit)}</td>
            </tr>`;
        }

        // 门店列表
        let storeRows = this.stores.map(store => `<tr>
            <td>${Utils.escapeHtml(store.code)}</td>
            <td>${Utils.escapeHtml(store.name)}</td>
            <td>${Utils.escapeHtml(store.address || '-')}</td>
            <td>${Utils.escapeHtml(store.phone || '-')}</td>
            <td>
                <button onclick="APP.editStore('${store.id}')">✏️ ${t('edit')}</button>
                <button class="danger" onclick="APP.deleteStore('${store.id}')">🗑️ ${t('delete')}</button>
            </td>
        </tr>`).join('');

        // 问题3：列表在上，新增表单在下，双列布局
        document.getElementById("app").innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>

            <!-- 财务汇总 -->
            <div class="card">
                <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h3>
                <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:15px;">
                    <div class="stat-card"><div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(grandTotalIncome)}</div><div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:#ef4444;">${Utils.formatCurrency(grandTotalExpenses)}</div><div>${lang === 'id' ? 'Total Pengeluaran' : '总支出'}</div></div>
                    <div class="stat-card"><div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(grandTotalGrossProfit)}</div><div>${lang === 'id' ? 'Total Laba Kotor' : '总毛利'}</div></div>
                </div>
                <div class="table-container">
                    <table class="table"><thead><tr>
                        <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                        <th>${lang === 'id' ? 'Pendapatan' : '收入'}</th>
                        <th>${lang === 'id' ? 'Pengeluaran' : '支出'}</th>
                        <th>${lang === 'id' ? 'Laba Kotor' : '毛利'}</th>
                    </tr></thead>
                    <tbody>${storeStatsRows || `<tr><td colspan="4" style="text-align:center;">${t('no_data')}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>

            <!-- 门店列表放上方 -->
            <div class="card">
                <h3>${lang === 'id' ? 'Daftar Toko' : '门店列表'}</h3>
                <div class="table-container">
                    <table class="table"><thead><tr>
                        <th>${lang === 'id' ? 'Kode' : '编码'}</th>
                        <th>${lang === 'id' ? 'Nama' : '名称'}</th>
                        <th>${lang === 'id' ? 'Alamat' : '地址'}</th>
                        <th>${lang === 'id' ? 'Telepon' : '电话'}</th>
                        <th>${t('save')}</th>
                    </tr></thead>
                    <tbody>${storeRows || `<tr><td colspan="5" style="text-align:center;">${t('no_data')}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>

            <!-- 新增门店表单放下方，双列布局 -->
            <div class="card">
                <h3>${lang === 'id' ? 'Tambah Toko Baru' : '新增门店'}</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Kode Toko' : '门店编码'} *</label>
                        <input id="newStoreCode" placeholder="STORE_004">
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
            </div>`;
    }
};

window.StoreManager = StoreManager;
