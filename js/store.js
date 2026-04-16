// store.js - 完整修复版
// 门店编码自动生成：STORE_000, STORE_001, STORE_002...

const StoreManager = {
    stores: [],
    _loaded: false,

    async loadStores(force = false) {
        if (!force && this._loaded && this.stores.length > 0) return this.stores;
        this.stores = await SUPABASE.getAllStores();
        this._loaded = true;
        return this.stores;
    },

    async _generateStoreCode(name) {
        await this.loadStores(true);
        
        // 总部固定为 STORE_000
        const nameLower = name.toLowerCase();
        if (nameLower.includes('kantor') || nameLower.includes('pusat') || nameLower.includes('总部')) {
            return 'STORE_000';
        }
        
        // 获取现有门店的最大序号
        let maxNumber = 0;
        for (const store of this.stores) {
            const match = store.code?.match(/STORE_(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) maxNumber = num;
            }
        }
        
        // 下一个序号（从1开始，因为0是总部）
        const nextNumber = Math.max(1, maxNumber + 1);
        const serial = String(nextNumber).padStart(3, '0');
        
        return `STORE_${serial}`;
    },

    async createStore(name, address, phone) {
        const code = await this._generateStoreCode(name);
        const newStore = await SUPABASE.createStore(code, name, address, phone);
        this.stores.push(newStore);
        this.stores.sort((a, b) => a.code.localeCompare(b.code));
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
        
        console.log('开始加载门店管理数据...');
        
        const [allOrdersResult, allExpensesResult, allPaymentsResult, cashFlow] = await Promise.all([
            supabaseClient.from('orders').select('id, store_id, status, loan_amount, admin_fee_paid, admin_fee, interest_paid_total, principal_paid'),
            supabaseClient.from('expenses').select('id, store_id, amount, payment_method'),
            supabaseClient.from('payment_history').select('id, order_id, type, amount, payment_method'),
            SUPABASE.getCashFlowSummary()
        ]);
        
        const allOrders = allOrdersResult.data || [];
        const allExpenses = allExpensesResult.data || [];
        const allPayments = allPaymentsResult.data || [];
        
        console.log(`数据加载完成: 订单 ${allOrders.length} 条, 支出 ${allExpenses.length} 条, 付款 ${allPayments.length} 条`);
        
        const orderStoreMap = {};
        for (const order of allOrders) {
            orderStoreMap[order.id] = order.store_id;
        }
        
        const storeStats = {};
        for (const store of this.stores) {
            storeStats[store.id] = { orders: [], expenses: [], payments: [] };
        }
        
        for (const order of allOrders) {
            const storeId = order.store_id;
            if (storeStats[storeId]) storeStats[storeId].orders.push(order);
        }
        
        for (const expense of allExpenses) {
            const storeId = expense.store_id;
            if (storeStats[storeId]) storeStats[storeId].expenses.push(expense);
        }
        
        for (const payment of allPayments) {
            const storeId = orderStoreMap[payment.order_id];
            if (storeId && storeStats[storeId]) storeStats[storeId].payments.push(payment);
        }
        
        let grandTotal = { 
            orders: 0, active: 0, loan: 0, adminFee: 0, interest: 0, 
            principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
        };
        
        let storeStatsRows = '';
        
        for (const store of this.stores) {
            const stats = storeStats[store.id] || { orders: [], expenses: [], payments: [] };
            const orders = stats.orders;
            const expenses = stats.expenses;
            const payments = stats.payments;
            
            const ordsCount = orders.length;
            const activeCount = orders.filter(o => o.status === 'active').length;
            const totalLoan = orders.reduce((s, o) => s + (o.loan_amount || 0), 0);
            const totalAdminFee = orders.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
            const totalInterest = orders.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
            const totalPrincipal = orders.reduce((s, o) => s + (o.principal_paid || 0), 0);
            const totalIncome = totalAdminFee + totalInterest;
            const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
            
            let cashIncome = 0, bankIncome = 0;
            for (const p of payments) {
                if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                    if (p.payment_method === 'cash') cashIncome += p.amount;
                    else if (p.payment_method === 'bank') bankIncome += p.amount;
                }
            }
            let cashExpense = 0, bankExpense = 0;
            for (const e of expenses) {
                if (e.payment_method === 'cash') cashExpense += e.amount;
                else if (e.payment_method === 'bank') bankExpense += e.amount;
            }
            const cashBalance = cashIncome - cashExpense;
            const bankBalance = bankIncome - bankExpense;
            
            grandTotal.orders += ordsCount;
            grandTotal.active += activeCount;
            grandTotal.loan += totalLoan;
            grandTotal.adminFee += totalAdminFee;
            grandTotal.interest += totalInterest;
            grandTotal.principal += totalPrincipal;
            grandTotal.expenses += totalExpenses;
            grandTotal.income += totalIncome;
            grandTotal.cashBalance += cashBalance;
            grandTotal.bankBalance += bankBalance;
            
            storeStatsRows += `<tr>
                <td style="border:1px solid #cbd5e1;padding:8px;"><strong>${Utils.escapeHtml(store.name)}</strong><br><small style="color:#64748b;">${Utils.escapeHtml(store.code)}</small></td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${ordsCount}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${activeCount}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(totalLoan)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(totalAdminFee)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(totalInterest)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(totalPrincipal)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#10b981;">${Utils.formatCurrency(totalIncome)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;color:#ef4444;">${Utils.formatCurrency(totalExpenses)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(cashBalance)}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(bankBalance)}</td>
            　　　`;
        }

        let storeRows = '';
        if (this.stores.length === 0) {
            storeRows = `<tr><td colspan="6" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
            storeStatsRows = `<tr><td colspan="11" style="text-align:center;padding:20px;">${t('no_data')}</td></tr>`;
        } else {
            for (const store of this.stores) {
                storeRows += `<tr>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.code)}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.name)}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.address || '-')}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.escapeHtml(store.phone || '-')}</td>
                    <td style="border:1px solid #cbd5e1;padding:8px;">
                        <input type="text" id="wa_${store.id}" value="${Utils.escapeHtml(store.wa_number || '')}" 
                               placeholder="628xxxxxxxxxx" style="width:140px; font-size:12px; padding:6px;" 
                               onchange="APP.updateStoreWANumber('${store.id}', this.value)">
                    </td>
                    <td style="border:1px solid #cbd5e1;padding:8px;white-space:nowrap;">
                        <button onclick="StoreManager.editStore('${store.id}')" style="padding:4px 8px;font-size:12px;">✏️ ${t('edit')}</button>
                        <button class="danger" onclick="APP.deleteStore('${store.id}')" style="padding:4px 8px;font-size:12px;">🗑️ ${t('delete')}</button>
                    </td>
                　　　`;
            }
        }

        document.getElementById("app").innerHTML = `
            <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
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
                    <table class="data-table" style="min-width:1000px;">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                <th>${t('total_orders')}</th>
                                <th>${t('active')}</th>
                                <th>${t('total_loan')}</th>
                                <th>${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                <th>${lang === 'id' ? 'Bunga' : '利息'}</th>
                                <th>${lang === 'id' ? 'Pokok' : '本金'}</th>
                                <th>${lang === 'id' ? 'Pendapatan' : '管理费+利息'}</th>
                                <th>${lang === 'id' ? 'Pengeluaran' : '运营支出'}</th>
                                <th>🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</th>
                                <th>🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</th>
                            </tr>
                        </thead>
                        <tbody>${storeStatsRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3>${lang === 'id' ? 'Daftar Toko' : '门店列表'}</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Kode' : '编码'}</th>
                                <th>${lang === 'id' ? 'Nama' : '名称'}</th>
                                <th>${lang === 'id' ? 'Alamat' : '地址'}</th>
                                <th>${lang === 'id' ? 'Telepon' : '电话'}</th>
                                <th>📱 WA</th>
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            </tr>
                        </thead>
                        <tbody>${storeRows}</tbody>
                    </table>
                </div>
                <p style="font-size:12px; color:#64748b; margin-top:8px;">
                    💡 ${lang === 'id' ? 'Kode toko dibuat otomatis. Klik pada kolom WA untuk mengedit nomor. Contoh: 6281234567890' : '门店编码自动生成。点击 WA 列编辑号码。示例: 6281234567890'}
                </p>
            </div>

            <div class="card">
                <h3>${lang === 'id' ? 'Tambah Toko Baru' : '新增门店'}</h3>
                <div class="form-grid">
                    <div class="form-group">
                        <label>${lang === 'id' ? 'Nama Toko' : '门店名称'} *</label>
                        <input id="newStoreName" placeholder="${lang === 'id' ? 'Contoh: Bangil, Gempol' : '例如: Bangil, Gempol'}">
                        <small style="color:#64748b;font-size:11px;">${lang === 'id' ? 'Kode toko akan dibuat otomatis (STORE_XXX)' : '门店编码将自动生成 (STORE_XXX)'}</small>
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
            </div>
            <style>
                .data-table td input { width: 140px; font-size: 12px; padding: 6px; border-radius: 6px; border: 1px solid #cbd5e1; }
                .data-table td input:focus { outline: none; border-color: #2563eb; }
            </style>
        `;
    }
};

window.StoreManager = StoreManager;
