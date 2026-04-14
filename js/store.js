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
                <td style="border:1px solid #cbd5e1;padding:8px;"><strong>${Utils.escapeHtml(store.name)}</strong></td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(income)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#ef4444;">${Utils.formatCurrency(expenses)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:${grossProfit >= 0 ? '#10b981' : '#ef4444'};">${Utils.formatCurrency(grossProfit)}</td>
            </tr>`;
        }

        let storeRows = this.stores.map(store => `<tr>
            <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.code)}</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.name)}</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.address || '-')}</td>
            <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.phone || '-')}</td>
            <td style="border:1px solid #cbd5e1;padding:8px;white-space:nowrap;">
                <button onclick="StoreManager.editStore('${store.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${t('edit')}</button>
                <button class="danger" onclick="APP.deleteStore('${store.id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>
            </td>
        </tr>`).join('');

        if (this.stores.length === 0) {
            storeRows = `<tr><td colspan="5" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
            storeStatsRows = `<tr><td colspan="4" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
        }

        document.getElementById("app").innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                <div>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
            </div>

            <div class="card">
                <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 15px;">
                    <div class="stat-card" style="border-right: 1px solid #e2e8f0; margin:0; border-radius:0; box-shadow:none;">
                        <div class="stat-value" style="color:#10b981;">${Utils.formatCurrency(grandTotalIncome)}</div>
                        <div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div>
                    </div>
                    <div class="stat-card" style="border-right: 1px solid #e2e8f0; margin:0; border-radius:0; box-shadow:none;">
                        <div class="stat-value" style="color:#ef4444;">${Utils.formatCurrency(grandTotalExpenses)}</div>
                        <div>${lang === 'id' ? 'Total Pengeluaran' : '总支出'}</div>
                    </div>
                    <div class="stat-card" style="margin:0; border-radius:0; box-shadow:none;">
                        <div class="stat-value" style="color:#3b82f6;">${Utils.formatCurrency(grandTotalGrossProfit)}</div>
                        <div>${lang === 'id' ? 'Total Laba Kotor' : '总毛利'}</div>
                    </div>
                </div>
                <div class="table-container">
                    <table class="table" style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Toko' : '门店'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Pendapatan' : '收入'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Pengeluaran' : '支出'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Laba Kotor' : '毛利'}</th>
                              </tr>
                        </thead>
                        <tbody>${storeStatsRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>${lang === 'id' ? 'Daftar Toko' : '门店列表'}</h3>
                <div class="table-container">
                    <table class="table" style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Kode' : '编码'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Nama' : '名称'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Alamat' : '地址'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Telepon' : '电话'}</th>
                                <th style="border:1px solid #cbd5e1;padding:10px;">${lang === 'id' ? 'Aksi' : '操作'}</th>
                              </table>
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
