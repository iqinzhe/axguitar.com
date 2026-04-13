const StoreManager = {
    // 门店列表本地缓存，增删改后局部更新，不再每次全量重拉
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

    // 获取门店的支出总额
    async getStoreExpenses(storeId) {
        const { data, error } = await supabaseClient
            .from('expenses')
            .select('amount')
            .eq('store_id', storeId);
        if (error) {
            console.error("获取支出失败:", error);
            return 0;
        }
        return data?.reduce((s, e) => s + e.amount, 0) || 0;
    },

    // 获取门店的收入（管理费 + 利息）
    async getStoreIncome(storeId) {
        // 获取该门店的所有订单
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('admin_fee_paid, admin_fee, interest_paid_total')
            .eq('store_id', storeId);
        if (error) {
            console.error("获取收入失败:", error);
            return 0;
        }
        
        const totalAdminFees = orders?.reduce((s, o) => s + (o.admin_fee_paid ? o.admin_fee : 0), 0) || 0;
        const totalInterest = orders?.reduce((s, o) => s + (o.interest_paid_total || 0), 0) || 0;
        return totalAdminFees + totalInterest;
    },

    async renderStoreManagement() {
        // 首次进入强制拉取，后续复用缓存
        await this.loadStores();
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);
        
        // 收集每个门店的支出和收入数据
        let storeStatsHtml = '';
        let grandTotalIncome = 0;
        let grandTotalExpenses = 0;
        let grandTotalGrossProfit = 0;
        
        for (const store of this.stores) {
            const expenses = await this.getStoreExpenses(store.id);
            const income = await this.getStoreIncome(store.id);
            const grossProfit = income - expenses;
            
            grandTotalIncome += income;
            grandTotalExpenses += expenses;
            grandTotalGrossProfit += grossProfit;
            
            storeStatsHtml += `
                <div class="stat-card" style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <div><strong>🏪 ${Utils.escapeHtml(store.name)}</strong></div>
                        <div style="color: #10b981;">💰 ${lang === 'id' ? 'Pendapatan' : '收入'}: ${Utils.formatCurrency(income)}</div>
                        <div style="color: #ef4444;">📝 ${lang === 'id' ? 'Pengeluaran' : '支出'}: ${Utils.formatCurrency(expenses)}</div>
                        <div style="color: #3b82f6;">📊 ${lang === 'id' ? 'Laba Kotor' : '毛利'}: ${Utils.formatCurrency(grossProfit)}</div>
                    </div>
                </div>
            `;
        }

        let storeRows = '';
        for (const store of this.stores) {
            storeRows += `<tr>
                <td>${Utils.escapeHtml(store.code)}</td>
                <td>${Utils.escapeHtml(store.name)}</td>
                <td>${Utils.escapeHtml(store.address || '-')}</td>
                <td>${Utils.escapeHtml(store.phone || '-')}</td>
                <td>
                    <button onclick="APP.editStore('${store.id}')" style="padding: 4px 8px; font-size: 12px;">✏️ ${t('edit')}</button>
                    <button class="danger" onclick="APP.deleteStore('${store.id}')" style="padding: 4px 8px; font-size: 12px;">🗑️ ${t('delete')}</button>
                </td>
            </tr>`;
        }

        const html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>
            
            <!-- 门店统计卡片 -->
            <div class="card">
                <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h3>
                <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 15px;">
                    <div class="stat-card">
                        <div class="stat-value">${Utils.formatCurrency(grandTotalIncome)}</div>
                        <div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Utils.formatCurrency(grandTotalExpenses)}</div>
                        <div>${lang === 'id' ? 'Total Pengeluaran' : '总支出'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Utils.formatCurrency(grandTotalGrossProfit)}</div>
                        <div>${lang === 'id' ? 'Total Laba Kotor' : '总毛利'}</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <h4>${lang === 'id' ? 'Detail per Toko' : '各门店明细'}</h4>
                    ${storeStatsHtml || `<p style="color: #94a3b8;">${lang === 'id' ? 'Tidak ada data' : '暂无数据'}</p>`}
                </div>
            </div>
            
            <div class="card">
                <h3>${lang === 'id' ? 'Tambah Toko Baru' : '新增门店'}</h3>
                <div class="form-group">
                    <label>${lang === 'id' ? 'Kode Toko' : '门店编码'}</label>
                    <input id="newStoreCode" placeholder="STORE_004">
                </div>
                <div class="form-group">
                    <label>${lang === 'id' ? 'Nama Toko' : '门店名称'}</label>
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
                <button onclick="APP.addStore()" class="success">➕ ${lang === 'id' ? 'Tambah Toko' : '添加门店'}</button>
            </div>
            
            <div class="card">
                <h3>${lang === 'id' ? 'Daftar Toko' : '门店列表'}</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Kode' : '编码'}</th>
                                <th>${lang === 'id' ? 'Nama' : '名称'}</th>
                                <th>${lang === 'id' ? 'Alamat' : '地址'}</th>
                                <th>${lang === 'id' ? 'Telepon' : '电话'}</th>
                                <th>${t('save')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${storeRows || `<tr><td colspan="5" style="text-align: center;">${t('no_data')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>`;
        document.getElementById("app").innerHTML = html;
    }
};

window.StoreManager = StoreManager;
