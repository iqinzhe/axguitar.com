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

    async renderStoreManagement() {
        // 首次进入强制拉取，后续复用缓存
        await this.loadStores();
        const lang = Utils.lang;
        const t = (key) => Utils.t(key);

        let storeRows = '';
        for (const store of this.stores) {
            storeRows += `<tr>
                <td>${Utils.escapeHtml(store.code)}</td>
                <td>${Utils.escapeHtml(store.name)}</td>
                <td>${Utils.escapeHtml(store.address || '-')}</td>
                <td>${Utils.escapeHtml(store.phone || '-')}</td>
                <td>
                    <button onclick="APP.editStore('${store.id}')">✏️ ${t('edit')}</button>
                    <button class="danger" onclick="APP.deleteStore('${store.id}')">🗑️ ${t('delete')}</button>
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
