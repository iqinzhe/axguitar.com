// store.js - v1.3（优化：批量获取门店现金流，避免 N+1 查询）

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
        
        const nameLower = name.toLowerCase();
        if (nameLower.includes('kantor') || nameLower.includes('pusat') || nameLower.includes('总部')) {
            return 'STORE_000';
        }
        
        let maxNumber = 0;
        for (var i = 0; i < this.stores.length; i++) {
            var store = this.stores[i];
            const match = store.code?.match(/STORE_(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNumber) maxNumber = num;
            }
        }
        
        const nextNumber = Math.max(1, maxNumber + 1);
        const serial = String(nextNumber).padStart(3, '0');
        
        return 'STORE_' + serial;
    },

    async createStore(name, address, phone) {
        const code = await this._generateStoreCode(name);
        const newStore = await SUPABASE.createStore(code, name, address, phone);
        this.stores.push(newStore);
        this.stores.sort(function(a, b) { return a.code.localeCompare(b.code); });
        return newStore;
    },

    async updateStore(id, updates) {
        const updated = await SUPABASE.updateStore(id, updates);
        const idx = this.stores.findIndex(function(s) { return s.id === id; });
        if (idx !== -1) this.stores[idx] = Object.assign({}, this.stores[idx], updated);
        return updated;
    },

    async deleteStore(id) {
        await SUPABASE.deleteStore(id);
        this.stores = this.stores.filter(function(s) { return s.id !== id; });
    },

    editStore: async function(storeId) {
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        
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
            modal.innerHTML = '' +
                '<div style="background:#ffffff;border-radius:12px;padding:24px;width:100%;max-width:500px;">' +
                    '<h3 style="margin-top:0;color:#1e293b;">✏️ ' + (lang === 'id' ? 'Edit Toko' : '编辑门店') + '</h3>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Kode Toko' : '门店编码') + ' *</label>' +
                        '<input id="editStoreCode" value="' + Utils.escapeHtml(store.code) + '" readonly style="background:#f1f5f9;cursor:not-allowed;">' +
                        '<small style="color:#64748b;">⚠️ ' + (lang === 'id' ? 'Kode tidak dapat diubah' : '编码不可修改') + '</small>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Nama Toko' : '门店名称') + ' *</label>' +
                        '<input id="editStoreName" value="' + Utils.escapeHtml(store.name) + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Alamat' : '地址') + '</label>' +
                        '<input id="editStoreAddress" value="' + Utils.escapeHtml(store.address || '') + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Telepon' : '电话') + '</label>' +
                        '<input id="editStorePhone" value="' + Utils.escapeHtml(store.phone || '') + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>📱 ' + (lang === 'id' ? 'Nomor WhatsApp' : 'WhatsApp 号码') + '</label>' +
                        '<input id="editStoreWA" value="' + Utils.escapeHtml(store.wa_number || '') + '" placeholder="628xxxxxxxxxx">' +
                        '<small>' + (lang === 'id' ? 'Contoh: 6281234567890 (tanpa +)' : '示例: 6281234567890 (不带+)') + '</small>' +
                    '</div>' +
                    '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">' +
                        '<button onclick="StoreManager._saveEditStore(\'' + storeId + '\')" class="success">💾 ' + t('save') + '</button>' +
                        '<button onclick="document.getElementById(\'editStoreModal\').remove()">✖ ' + t('cancel') + '</button>' +
                    '</div>' +
                '</div>';
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
        var waNumber = document.getElementById('editStoreWA').value.trim();
        
        if (!name) {
            alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        
        try {
            const updates = { 
                name: name, 
                address: address || null, 
                phone: phone || null 
            };
            if (waNumber) {
                updates.wa_number = waNumber;
            }
            
            const { error } = await supabaseClient
                .from('stores')
                .update(updates)
                .eq('id', storeId);
            
            if (error) throw error;
            
            document.getElementById('editStoreModal')?.remove();
            alert(lang === 'id' ? 'Toko berhasil diperbarui' : '门店已更新');
            await this.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    // ========== 优化：批量获取所有门店现金流 ==========
    async _getAllStoreCashFlowBalances() {
        try {
            // 一次性查询所有门店的现金流记录
            const { data: allFlows, error } = await supabaseClient
                .from('cash_flow_records')
                .select('store_id, direction, amount, source_target')
                .eq('is_voided', false);
            
            if (error) {
                console.warn('批量获取门店现金流失败:', error);
                return {};
            }
            
            // 按门店分组计算余额
            var balances = {};
            for (var i = 0; i < allFlows.length; i++) {
                var flow = allFlows[i];
                var storeId = flow.store_id;
                var amount = flow.amount || 0;
                
                if (!balances[storeId]) {
                    balances[storeId] = { cashBalance: 0, bankBalance: 0 };
                }
                
                if (flow.direction === 'inflow') {
                    if (flow.source_target === 'cash') {
                        balances[storeId].cashBalance += amount;
                    } else if (flow.source_target === 'bank') {
                        balances[storeId].bankBalance += amount;
                    }
                } else if (flow.direction === 'outflow') {
                    if (flow.source_target === 'cash') {
                        balances[storeId].cashBalance -= amount;
                    } else if (flow.source_target === 'bank') {
                        balances[storeId].bankBalance -= amount;
                    }
                }
            }
            
            // 确保所有门店都有初始值
            for (var j = 0; j < this.stores.length; j++) {
                var s = this.stores[j];
                if (!balances[s.id]) {
                    balances[s.id] = { cashBalance: 0, bankBalance: 0 };
                }
            }
            
            return balances;
        } catch (error) {
            console.error('批量获取门店余额失败:', error);
            return {};
        }
    },

    async renderStoreManagement() {
        await this.loadStores();
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
        console.log('开始加载门店管理数据...');
        
        // 并行加载所有数据
        const [
            allOrdersResult,
            allExpensesResult,
            allPaymentsResult,
            storeBalances
        ] = await Promise.all([
            supabaseClient.from('orders').select('id, store_id, status, loan_amount, admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid'),
            supabaseClient.from('expenses').select('id, store_id, amount, payment_method'),
            supabaseClient.from('payment_history').select('id, order_id, type, amount, payment_method'),
            this._getAllStoreCashFlowBalances()  // 优化点：批量获取
        ]);
        
        const allOrders = allOrdersResult.data || [];
        const allExpenses = allExpensesResult.data || [];
        const allPayments = allPaymentsResult.data || [];
        
        console.log('数据加载完成: 订单 ' + allOrders.length + ' 条, 支出 ' + allExpenses.length + ' 条, 付款 ' + allPayments.length + ' 条');
        
        // 构建订单到门店的映射
        const orderStoreMap = {};
        for (var i = 0; i < allOrders.length; i++) {
            orderStoreMap[allOrders[i].id] = allOrders[i].store_id;
        }
        
        // 初始化门店统计
        const storeStats = {};
        for (var i = 0; i < this.stores.length; i++) {
            storeStats[this.stores[i].id] = { orders: [], expenses: [], payments: [] };
        }
        
        for (var i = 0; i < allOrders.length; i++) {
            var order = allOrders[i];
            var orderStoreId = order.store_id;
            if (storeStats[orderStoreId]) storeStats[orderStoreId].orders.push(order);
        }
        
        for (var i = 0; i < allExpenses.length; i++) {
            var expense = allExpenses[i];
            var expenseStoreId = expense.store_id;
            if (storeStats[expenseStoreId]) storeStats[expenseStoreId].expenses.push(expense);
        }
        
        for (var i = 0; i < allPayments.length; i++) {
            var payment = allPayments[i];
            var paymentStoreId = orderStoreMap[payment.order_id];
            if (paymentStoreId && storeStats[paymentStoreId]) storeStats[paymentStoreId].payments.push(payment);
        }
        
        var grandTotal = { 
            orders: 0, active: 0, loan: 0, adminFee: 0, serviceFee: 0, interest: 0, 
            principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
        };
        
        var storeStatsRows = '';
        
        for (var i = 0; i < this.stores.length; i++) {
            var store = this.stores[i];
            var stats = storeStats[store.id] || { orders: [], expenses: [], payments: [] };
            var orders = stats.orders;
            var expenses = stats.expenses;
            
            var ordsCount = orders.length;
            var activeCount = 0;
            var totalLoan = 0;
            var totalAdminFee = 0;
            var totalServiceFee = 0;
            var totalInterest = 0;
            var totalPrincipal = 0;
            
            for (var j = 0; j < orders.length; j++) {
                var o = orders[j];
                totalLoan += (o.loan_amount || 0);
                if (o.admin_fee_paid) totalAdminFee += (o.admin_fee || 0);
                totalServiceFee += (o.service_fee_paid || 0);
                totalInterest += (o.interest_paid_total || 0);
                totalPrincipal += (o.principal_paid || 0);
                if (o.status === 'active') activeCount++;
            }
            
            var totalIncome = totalAdminFee + totalServiceFee + totalInterest;
            var totalExpenses = 0;
            for (var j = 0; j < expenses.length; j++) {
                totalExpenses += (expenses[j].amount || 0);
            }
            
            // 从批量获取的余额中取值（不再是单独查询）
            var balance = storeBalances[store.id] || { cashBalance: 0, bankBalance: 0 };
            var cashBalance = balance.cashBalance;
            var bankBalance = balance.bankBalance;
            
            grandTotal.orders += ordsCount;
            grandTotal.active += activeCount;
            grandTotal.loan += totalLoan;
            grandTotal.adminFee += totalAdminFee;
            grandTotal.serviceFee += totalServiceFee;
            grandTotal.interest += totalInterest;
            grandTotal.principal += totalPrincipal;
            grandTotal.expenses += totalExpenses;
            grandTotal.income += totalIncome;
            grandTotal.cashBalance += cashBalance;
            grandTotal.bankBalance += bankBalance;
            
            storeStatsRows += '<tr>' +
                '<td class="store-name-cell"><strong>' + Utils.escapeHtml(store.name) + '</strong><br><small>' + Utils.escapeHtml(store.code) + '</small></td>' +
                '<td class="text-center">' + ordsCount + '</td>' +
                '<td class="text-center">' + activeCount + '</td>' +
                '<td class="text-right">' + Utils.formatCurrency(totalLoan) + '</td>' +
                '<td class="text-right income">' + Utils.formatCurrency(totalAdminFee) + '</td>' +
                '<td class="text-right income">' + Utils.formatCurrency(totalServiceFee) + '</td>' +
                '<td class="text-right income">' + Utils.formatCurrency(totalInterest) + '</td>' +
                '<td class="text-right">' + Utils.formatCurrency(totalPrincipal) + '</td>' +
                '<td class="text-right income">' + Utils.formatCurrency(totalIncome) + '</td>' +
                '<td class="text-right expense">' + Utils.formatCurrency(totalExpenses) + '</td>' +
                '<td class="text-right">' + Utils.formatCurrency(cashBalance) + '</td>' +
                '<td class="text-right">' + Utils.formatCurrency(bankBalance) + '</td>' +
            '</tr>';
        }
        
        // 汇总行
        var summaryRow = '<tr>' +
            '<td class="store-name-cell"><strong>' + (lang === 'id' ? '📊 TOTAL SEMUA TOKO' : '📊 全部门店合计') + '</strong></td>' +
            '<td class="text-center"><strong>' + grandTotal.orders + '</strong></td>' +
            '<td class="text-center"><strong>' + grandTotal.active + '</strong></td>' +
            '<td class="text-right"><strong>' + Utils.formatCurrency(grandTotal.loan) + '</strong></td>' +
            '<td class="text-right income"><strong>' + Utils.formatCurrency(grandTotal.adminFee) + '</strong></td>' +
            '<td class="text-right income"><strong>' + Utils.formatCurrency(grandTotal.serviceFee) + '</strong></td>' +
            '<td class="text-right income"><strong>' + Utils.formatCurrency(grandTotal.interest) + '</strong></td>' +
            '<td class="text-right"><strong>' + Utils.formatCurrency(grandTotal.principal) + '</strong></td>' +
            '<td class="text-right income"><strong>' + Utils.formatCurrency(grandTotal.income) + '</strong></td>' +
            '<td class="text-right expense"><strong>' + Utils.formatCurrency(grandTotal.expenses) + '</strong></td>' +
            '<td class="text-right"><strong>' + Utils.formatCurrency(grandTotal.cashBalance) + '</strong></td>' +
            '<td class="text-right"><strong>' + Utils.formatCurrency(grandTotal.bankBalance) + '</strong></td>' +
        '</tr>';

        var storeRows = '';
        if (this.stores.length === 0) {
            storeRows = '<tr><td colspan="6" class="text-center">' + t('no_data') + '<\/td><\/tr>';
        } else {
            for (var i = 0; i < this.stores.length; i++) {
                var store = this.stores[i];
                storeRows += '<tr>' +
                    '<td class="store-code">' + Utils.escapeHtml(store.code) + '</td>' +
                    '<td class="store-name">' + Utils.escapeHtml(store.name) + '</td>' +
                    '<td class="store-address">' + Utils.escapeHtml(store.address || '-') + '</td>' +
                    '<td>' + Utils.escapeHtml(store.phone || '-') + '</td>' +
                    '<td>' +
                        '<input type="text" id="wa_' + store.id + '" value="' + Utils.escapeHtml(store.wa_number || '') + '" ' +
                               'placeholder="628xxxxxxxxxx" style="width:140px; font-size:12px; padding:6px;" ' +
                               'onchange="APP.updateStoreWANumber(\'' + store.id + '\', this.value)">' +
                    '</td>' +
                '</tr>';
                
                var actionButtons = '' +
                    '<button onclick="StoreManager.editStore(\'' + store.id + '\')" class="btn-small">✏️ ' + t('edit') + '</button>' +
                    '<button class="btn-small danger" onclick="APP.deleteStore(\'' + store.id + '\')">🗑️ ' + t('delete') + '</button>';
                
                storeRows += Utils.renderActionRow({
                    colspan: 5,
                    buttonsHtml: actionButtons
                });
            }
        }

        document.getElementById("app").innerHTML = '' +
            '<div class="page-header">' +
                '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                '<div class="header-actions">' +
                    '<button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                '</div>' +
            '</div>' +

            '<!-- 现金流汇总卡片 -->' +
            '<div class="card cashflow-card">' +
                '<h3>💰 ' + (lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总') + '</h3>' +
                '<div class="cashflow-stats">' +
                    '<div class="cashflow-item-card">' +
                        '<div class="label">🏦 ' + (lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)') + '</div>' +
                        '<div class="value ' + (grandTotal.cashBalance < 0 ? 'negative' : '') + '">' + Utils.formatCurrency(grandTotal.cashBalance) + '</div>' +
                    '</div>' +
                    '<div class="cashflow-item-card">' +
                        '<div class="label">🏧 ' + (lang === 'id' ? 'Bank BNI' : '银行 BNI') + '</div>' +
                        '<div class="value ' + (grandTotal.bankBalance < 0 ? 'negative' : '') + '">' + Utils.formatCurrency(grandTotal.bankBalance) + '</div>' +
                    '</div>' +
                    '<div class="cashflow-item-card">' +
                        '<div class="label">📊 ' + (lang === 'id' ? 'Total Kas' : '总现金') + '</div>' +
                        '<div class="value">' + Utils.formatCurrency(grandTotal.cashBalance + grandTotal.bankBalance) + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cashflow-note">' +
                    '💡 ' + (lang === 'id' ? 'Saldo berdasarkan catatan arus kas (cash_flow_records) - mencakup semua transaksi masuk dan keluar.' : '余额基于资金流记录 (cash_flow_records) - 包含所有流入流出交易。') +
                '</div>' +
            '</div>' +

            '<!-- 门店财务汇总表格 -->' +
            '<div class="card">' +
                '<h3>📊 ' + (lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总') + '</h3>' +
                '<div class="table-container" style="overflow-x: auto;">' +
                    '<table class="data-table store-stats-table" style="min-width: 800px;">' +
                        '<thead>' +
                            '<tr>' +
                                '<th>' + (lang === 'id' ? 'Toko' : '门店') + '</th>' +
                                '<th class="text-center">' + t('total_orders') + '</th>' +
                                '<th class="text-center">' + t('active') + '</th>' +
                                '<th class="text-right">' + t('total_loan') + '</th>' +
                                '<th class="text-right">' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</th>' +
                                '<th class="text-right">' + (lang === 'id' ? 'Service Fee' : '服务费') + '</th>' +
                                '<th class="text-right">' + (lang === 'id' ? 'Bunga' : '利息') + '</th>' +
                                '<th class="text-right">' + (lang === 'id' ? 'Pokok' : '本金') + '</th>' +
                                '<th class="text-right">' + (lang === 'id' ? 'Pendapatan' : '收入') + '</th>' +
                                '<th class="text-right">' + (lang === 'id' ? 'Pengeluaran' : '运营支出') + '</th>' +
                                '<th class="text-right">🏦 ' + (lang === 'id' ? 'Brankas' : '保险柜') + '</th>' +
                                '<th class="text-right">🏧 ' + (lang === 'id' ? 'Bank BNI' : '银行BNI') + '</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' +
                            storeStatsRows +
                            summaryRow +
                        '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>' +

            '<!-- 门店列表 -->' +
            '<div class="card">' +
                '<h3>' + (lang === 'id' ? 'Daftar Toko' : '门店列表') + '</h3>' +
                '<div class="table-container">' +
                    '<table class="data-table store-table">' +
                        '<thead>' +
                            '<tr>' +
                                '<th>' + (lang === 'id' ? 'Kode' : '编码') + '</th>' +
                                '<th>' + (lang === 'id' ? 'Nama' : '名称') + '</th>' +
                                '<th>' + (lang === 'id' ? 'Alamat' : '地址') + '</th>' +
                                '<th>' + (lang === 'id' ? 'Telepon' : '电话') + '</th>' +
                                '<th>📱 WA</th>' +
                                '<th class="text-center">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' + storeRows + '</tbody>' +
                    '</table>' +
                '</div>' +
                '<p style="font-size:12px; color:#64748b; margin-top:8px;">' +
                    '💡 ' + (lang === 'id' ? 'Kode toko dibuat otomatis. Klik pada kolom WA untuk mengedit nomor. Contoh: 6281234567890' : '门店编码自动生成。点击 WA 列编辑号码。示例: 6281234567890') +
                '</p>' +
            '</div>' +

            '<!-- 新增门店 -->' +
            '<div class="card">' +
                '<h3>' + (lang === 'id' ? 'Tambah Toko Baru' : '新增门店') + '</h3>' +
                '<div class="form-grid">' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Nama Toko' : '门店名称') + ' *</label>' +
                        '<input id="newStoreName" placeholder="' + (lang === 'id' ? 'Contoh: Bangil, Gempol' : '例如: Bangil, Gempol') + '">' +
                        '<small style="color:#64748b;font-size:11px;">' + (lang === 'id' ? 'Kode toko akan dibuat otomatis (STORE_XXX)' : '门店编码将自动生成 (STORE_XXX)') + '</small>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Alamat' : '地址') + '</label>' +
                        '<input id="newStoreAddress" placeholder="' + (lang === 'id' ? 'Alamat' : '地址') + '">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Telepon' : '电话') + '</label>' +
                        '<input id="newStorePhone" placeholder="' + (lang === 'id' ? 'Telepon' : '电话') + '">' +
                    '</div>' +
                    '<div class="form-actions">' +
                        '<button onclick="APP.addStore()" class="success">➕ ' + (lang === 'id' ? 'Tambah Toko' : '添加门店') + '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            
            '<style>' +
                '.store-table .store-code { font-family: monospace; font-weight: 600; color: var(--primary-dark); }' +
                '.store-table .store-name { font-weight: 500; }' +
                '.store-table .store-address { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
                '.store-table td input { width: 140px; font-size: 12px; padding: 6px; border-radius: 6px; border: 1px solid #cbd5e1; }' +
                '.store-table td input:focus { outline: none; border-color: #2563eb; }' +
                '.store-stats-table .store-name-cell { font-weight: 500; background: #f8fafc; }' +
                '.store-stats-table tbody tr:last-child { border-top: 2px solid #cbd5e1; background: #f1f5f9; }' +
                '.cashflow-card { margin-bottom: 20px; }' +
                '.cashflow-stats { display: flex; gap: 16px; flex-wrap: wrap; }' +
                '.cashflow-item-card { flex: 1; min-width: 180px; background: #f8fafc; border-radius: 12px; padding: 16px; transition: all 0.2s ease; }' +
                '.cashflow-item-card:hover { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }' +
                '.cashflow-item-card .label { font-size: 13px; color: #64748b; margin-bottom: 8px; }' +
                '.cashflow-item-card .value { font-size: 22px; font-weight: 700; color: #1e293b; }' +
                '.cashflow-item-card .value.negative { color: #ef4444; }' +
                '.cashflow-item-card .sub { font-size: 11px; color: #94a3b8; margin-top: 6px; }' +
                '.cashflow-note { font-size: 11px; color: #64748b; margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; }' +
                '@media (max-width: 640px) { .cashflow-stats { flex-direction: column; } .cashflow-item-card { min-width: auto; } .store-table .store-address { max-width: 120px; } .store-table td input { width: 100px; font-size: 10px; } }' +
            '</style>';
    }
};

window.StoreManager = StoreManager;
