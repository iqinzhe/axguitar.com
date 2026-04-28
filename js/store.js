// store.js - v1.3（完全避免 this 绑定问题）
const StoreManager = {
    stores: [],
    _loaded: false,

    // 使用 StoreManager. 而不是 this.
    loadStores: async function(force = false) {
        console.log('[StoreManager] loadStores 被调用, force:', force);
        if (!force && StoreManager._loaded && StoreManager.stores.length > 0) {
            console.log('[StoreManager] 使用缓存的门店数据:', StoreManager.stores.length);
            return StoreManager.stores;
        }
        try {
            StoreManager.stores = await SUPABASE.getAllStores();
            StoreManager._loaded = true;
            console.log('[StoreManager] 门店数据加载完成:', StoreManager.stores.length);
            return StoreManager.stores;
        } catch (err) {
            console.error('[StoreManager] loadStores 失败:', err);
            throw err;
        }
    },

    _generateStoreCode: async function(name) {
        await StoreManager.loadStores(true);
        
        const nameLower = name.toLowerCase();
        if (nameLower.includes('kantor') || nameLower.includes('pusat') || nameLower.includes('总部')) {
            return 'STORE_000';
        }
        
        let maxNumber = 0;
        for (var i = 0; i < StoreManager.stores.length; i++) {
            var store = StoreManager.stores[i];
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

    createStore: async function(name, address, phone) {
        const code = await StoreManager._generateStoreCode(name);
        const newStore = await SUPABASE.createStore(code, name, address, phone);
        StoreManager.stores.push(newStore);
        StoreManager.stores.sort(function(a, b) { return a.code.localeCompare(b.code); });
        return newStore;
    },

    updateStore: async function(id, updates) {
        const updated = await SUPABASE.updateStore(id, updates);
        const idx = StoreManager.stores.findIndex(function(s) { return s.id === id; });
        if (idx !== -1) StoreManager.stores[idx] = Object.assign({}, StoreManager.stores[idx], updated);
        return updated;
    },

    deleteStore: async function(id) {
        await SUPABASE.deleteStore(id);
        StoreManager.stores = StoreManager.stores.filter(function(s) { return s.id !== id; });
    },

    suspendStore: async function(storeId) {
        var lang = Utils.lang;
        
        if (!confirm(lang === 'id' 
            ? '⚠️ Yakin akan menonaktifkan toko ini?\n\nOperator toko tidak akan bisa login.\nData toko tetap tersimpan.'
            : '⚠️ 确认暂停此门店？\n\n门店操作员将无法登录。\n门店数据将继续保留。')) {
            return;
        }
        
        try {
            const { error } = await supabaseClient
                .from('stores')
                .update({ is_active: false })
                .eq('id', storeId);
            
            if (error) throw error;
            
            var store = StoreManager.stores.find(function(s) { return s.id === storeId; });
            if (store) store.is_active = false;
            
            alert(lang === 'id' ? '✅ Toko telah dinonaktifkan' : '✅ 门店已暂停营业');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menonaktifkan: ' + error.message : '暂停失败：' + error.message);
        }
    },

    resumeStore: async function(storeId) {
        var lang = Utils.lang;
        
        if (!confirm(lang === 'id' ? 'Aktifkan kembali toko ini?' : '恢复此门店营业？')) return;
        
        try {
            const { error } = await supabaseClient
                .from('stores')
                .update({ is_active: true })
                .eq('id', storeId);
            
            if (error) throw error;
            
            var store = StoreManager.stores.find(function(s) { return s.id === storeId; });
            if (store) store.is_active = true;
            
            alert(lang === 'id' ? '✅ Toko telah diaktifkan kembali' : '✅ 门店已恢复营业');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal mengaktifkan: ' + error.message : '恢复失败：' + error.message);
        }
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
            
            var isActive = store.is_active !== false;
            var statusText = isActive 
                ? (lang === 'id' ? 'Aktif' : '营业中')
                : (lang === 'id' ? 'Ditutup' : '已暂停');
            var statusBadgeClass = isActive ? 'active' : 'liquidated';
            
            var modal = document.createElement('div');
            modal.id = 'editStoreModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = '' +
                '<div class="modal-content" style="max-width:500px;">' +
                    '<h3>✏️ ' + (lang === 'id' ? 'Edit Toko' : '编辑门店') + '</h3>' +
                    
                    '<div style="margin-bottom:16px;">' +
                        '<span class="status-badge ' + statusBadgeClass + '">' + statusText + '</span>' +
                    '</div>' +
                    
                    '<div class="form-group">' +
                        '<label>' + (lang === 'id' ? 'Kode Toko' : '门店编码') + '</label>' +
                        '<input value="' + Utils.escapeHtml(store.code) + '" readonly>' +
                        '<div class="form-hint">⚠️ ' + (lang === 'id' ? 'Kode tidak dapat diubah' : '编码不可修改') + '</div>' +
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
                        '<div class="form-hint">' + (lang === 'id' ? 'Contoh: 6281234567890 (tanpa +)' : '示例: 6281234567890 (不带+)') + '</div>' +
                    '</div>' +
                    '<div class="modal-actions">' +
                        '<button onclick="StoreManager._saveEditStore(\'' + storeId + '\')" class="success">💾 ' + t('save') + '</button>' +
                        '<button onclick="document.getElementById(\'editStoreModal\').remove()" class="btn-back">✖ ' + t('cancel') + '</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memuat data toko' : '加载门店数据失败');
        }
    },

    _saveEditStore: async function(storeId) {
        var lang = Utils.lang;
        var name = document.getElementById('editStoreName')?.value.trim();
        var address = document.getElementById('editStoreAddress')?.value.trim();
        var phone = document.getElementById('editStorePhone')?.value.trim();
        var waNumber = document.getElementById('editStoreWA')?.value.trim();
        
        if (!name) {
            alert(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        
        try {
            var updates = { 
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
            await StoreManager.renderStoreManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    _getAllStoreCashFlowBalances: async function() {
        try {
            const { data: allFlows, error } = await supabaseClient
                .from('cash_flow_records')
                .select('store_id, direction, amount, source_target')
                .eq('is_voided', false);
            
            if (error) {
                console.warn('批量获取门店现金流失败:', error);
                return {};
            }
            
            var balances = {};
            const flows = allFlows || [];
            
            for (var i = 0; i < flows.length; i++) {
                var flow = flows[i];
                var storeId = flow.store_id;
                if (!storeId) continue;
                
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
            
            // 确保所有门店都有余额对象
            if (StoreManager.stores && StoreManager.stores.length > 0) {
                for (var j = 0; j < StoreManager.stores.length; j++) {
                    var s = StoreManager.stores[j];
                    if (!balances[s.id]) {
                        balances[s.id] = { cashBalance: 0, bankBalance: 0 };
                    }
                }
            }
            
            return balances;
        } catch (error) {
            console.error('_getAllStoreCashFlowBalances 异常:', error);
            return {};
        }
    },

    // 核心方法：渲染门店管理页面
    renderStoreManagement: async function() {
        console.log('[StoreManager] 开始加载门店管理页面');
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
        // 显示加载状态
        document.getElementById("app").innerHTML = '' +
            '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
                    '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + t('back') + '</button>' +
                    '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                '</div>' +
                '<div class="header-actions">' +
                    '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center; padding:40px;">' +
                '<div class="loader"></div>' +
                '<p>' + (lang === 'id' ? 'Memuat data toko...' : '加载门店数据中...') + '</p>' +
            '</div>';
        
        try {
            // 关键修复：使用 StoreManager.loadStores 而不是 this.loadStores
            console.log('[StoreManager] 调用 StoreManager.loadStores...');
            await StoreManager.loadStores(true);
            console.log('[StoreManager] 门店列表加载完成:', StoreManager.stores.length, '个门店');
            
            // 并行获取数据
            console.log('[StoreManager] 获取订单、支出、付款数据...');
            const [allOrdersResult, allExpensesResult, allPaymentsResult] = await Promise.all([
                supabaseClient.from('orders').select('id, store_id, status, loan_amount, admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid'),
                supabaseClient.from('expenses').select('id, store_id, amount, payment_method'),
                supabaseClient.from('payment_history').select('id, order_id, type, amount, payment_method')
            ]);
            
            const allOrders = allOrdersResult.data || [];
            const allExpenses = allExpensesResult.data || [];
            const allPayments = allPaymentsResult.data || [];
            
            console.log('[StoreManager] 订单数量:', allOrders.length, '支出数量:', allExpenses.length, '付款数量:', allPayments.length);
            
            // 构建订单门店映射
            const orderStoreMap = {};
            for (var i = 0; i < allOrders.length; i++) {
                orderStoreMap[allOrders[i].id] = allOrders[i].store_id;
            }
            
            // 初始化门店统计
            const storeStats = {};
            for (var i = 0; i < StoreManager.stores.length; i++) {
                storeStats[StoreManager.stores[i].id] = { orders: [], expenses: [], payments: [] };
            }
            
            // 统计订单
            for (var i = 0; i < allOrders.length; i++) {
                var orderStoreId = allOrders[i].store_id;
                if (storeStats[orderStoreId]) {
                    storeStats[orderStoreId].orders.push(allOrders[i]);
                }
            }
            
            // 统计支出
            for (var i = 0; i < allExpenses.length; i++) {
                var expenseStoreId = allExpenses[i].store_id;
                if (storeStats[expenseStoreId]) {
                    storeStats[expenseStoreId].expenses.push(allExpenses[i]);
                }
            }
            
            // 统计付款
            for (var i = 0; i < allPayments.length; i++) {
                var paymentStoreId = orderStoreMap[allPayments[i].order_id];
                if (paymentStoreId && storeStats[paymentStoreId]) {
                    storeStats[paymentStoreId].payments.push(allPayments[i]);
                }
            }
            
            // 获取门店余额
            console.log('[StoreManager] 获取门店余额...');
            const storeBalances = await StoreManager._getAllStoreCashFlowBalances();
            
            // 计算汇总
            var grandTotal = { 
                orders: 0, active: 0, loan: 0, adminFee: 0, serviceFee: 0, interest: 0, 
                principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
            };
            
            var storeStatsRows = '';
            
            for (var i = 0; i < StoreManager.stores.length; i++) {
                var store = StoreManager.stores[i];
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
                
                var storeStatusBadge = '';
                if (store.is_active === false) {
                    storeStatusBadge = ' <span class="status-badge liquidated">' + (lang === 'id' ? 'DITUTUP' : '已暂停') + '</span>';
                }
                
                storeStatsRows += '<tr>' +
                    '<td class="store-name-cell"><strong>' + Utils.escapeHtml(store.name) + storeStatusBadge + '</strong><br><small>' + Utils.escapeHtml(store.code) + '</small></td>' +
                    '<td class="text-center">' + ordsCount + '</td>' +
                    '<td class="text-center">' + activeCount + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(totalLoan) + '</td>' +
                    '<td class="amount income">' + Utils.formatCurrency(totalAdminFee) + '</td>' +
                    '<td class="amount income">' + Utils.formatCurrency(totalServiceFee) + '</td>' +
                    '<td class="amount income">' + Utils.formatCurrency(totalInterest) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(totalPrincipal) + '</td>' +
                    '<td class="amount income">' + Utils.formatCurrency(totalIncome) + '</td>' +
                    '<td class="amount expense">' + Utils.formatCurrency(totalExpenses) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(cashBalance) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(bankBalance) + '</td>' +
                '</tr>';
            }
            
            var summaryRow = '<tr style="background:#f1f5f9; font-weight:bold;">' +
                '<td class="store-name-cell"><strong>' + (lang === 'id' ? '📊 TOTAL SEMUA TOKO' : '📊 全部门店合计') + '</strong></td>' +
                '<td class="text-center"><strong>' + grandTotal.orders + '</strong></td>' +
                '<td class="text-center"><strong>' + grandTotal.active + '</strong></td>' +
                '<td class="amount"><strong>' + Utils.formatCurrency(grandTotal.loan) + '</strong></td>' +
                '<td class="amount income"><strong>' + Utils.formatCurrency(grandTotal.adminFee) + '</strong></td>' +
                '<td class="amount income"><strong>' + Utils.formatCurrency(grandTotal.serviceFee) + '</strong></td>' +
                '<td class="amount income"><strong>' + Utils.formatCurrency(grandTotal.interest) + '</strong></td>' +
                '<td class="amount"><strong>' + Utils.formatCurrency(grandTotal.principal) + '</strong></td>' +
                '<td class="amount income"><strong>' + Utils.formatCurrency(grandTotal.income) + '</strong></td>' +
                '<td class="amount expense"><strong>' + Utils.formatCurrency(grandTotal.expenses) + '</strong></td>' +
                '<td class="amount"><strong>' + Utils.formatCurrency(grandTotal.cashBalance) + '</strong></td>' +
                '<td class="amount"><strong>' + Utils.formatCurrency(grandTotal.bankBalance) + '</strong></td>' +
            '</tr>';
            
            // 生成门店列表行
            var storeRows = '';
            if (StoreManager.stores.length === 0) {
                storeRows = '<tr><td colspan="6" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var i = 0; i < StoreManager.stores.length; i++) {
                    var store = StoreManager.stores[i];
                    var isActive = store.is_active !== false;
                    var statusBadge = isActive 
                        ? '<span class="status-badge active">' + (lang === 'id' ? 'Aktif' : '营业中') + '</span>'
                        : '<span class="status-badge liquidated">' + (lang === 'id' ? 'Ditutup' : '已暂停') + '</span>';
                    
                    storeRows += '<tr>' +
                        '<td class="store-code">' + Utils.escapeHtml(store.code) + '</td>' +
                        '<td class="store-name">' + Utils.escapeHtml(store.name) + '</td>' +
                        '<td class="store-address desc-cell">' + Utils.escapeHtml(store.address || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(store.phone || '-') + '</td>' +
                        '<td>' +
                            '<input type="text" id="wa_' + store.id + '" value="' + Utils.escapeHtml(store.wa_number || '') + '" ' +
                                   'placeholder="628xxxxxxxxxx" style="width:140px;font-size:12px;padding:6px;" ' +
                                   'onchange="APP.updateStoreWANumber(\'' + store.id + '\', this.value)">' +
                        '</td>' +
                        '<td class="text-center">' + statusBadge + '</td>' +
                    '</tr>';
                    
                    var actionButtons = '' +
                        '<button onclick="StoreManager.editStore(\'' + store.id + '\')" class="btn-small">✏️ ' + t('edit') + '</button>';
                    
                    if (isActive) {
                        actionButtons += '<button onclick="StoreManager.suspendStore(\'' + store.id + '\')" class="btn-small warning">⏸️ ' + (lang === 'id' ? 'Tutup Sementara' : '暂停营业') + '</button>';
                    } else {
                        actionButtons += '<button onclick="StoreManager.resumeStore(\'' + store.id + '\')" class="btn-small success">▶️ ' + (lang === 'id' ? 'Buka Kembali' : '恢复营业') + '</button>';
                    }
                    
                    actionButtons += '<button class="btn-small danger" onclick="APP.deleteStore(\'' + store.id + '\')">🗑️ ' + t('delete') + '</button>';
                    
                    storeRows += '<tr class="action-row">' +
                        '<td class="action-label">' + t('action') + '</td>' +
                        '<td colspan="5">' +
                            '<div class="action-buttons">' + actionButtons + '</div>' +
                        '</td>' +
                    '</tr>';
                }
            }
            
            // 渲染完整页面
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                    '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
                        '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + t('back') + '</button>' +
                        '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                    '</div>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '</div>' +
                '</div>' +
                
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
                '</div>' +
                
                '<div class="card">' +
                    '<h3>📊 ' + (lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总') + '</h3>' +
                    '<div class="table-container" style="overflow-x: auto;">' +
                        '<table class="data-table store-stats-table" style="min-width: 800px;">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'Toko' : '门店') + '</th>' +
                                    '<th class="text-center">' + t('total_orders') + '</th>' +
                                    '<th class="text-center">' + t('active') + '</th>' +
                                    '<th class="amount">' + t('total_loan') + '</th>' +
                                    '<th class="amount">' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</th>' +
                                    '<th class="amount">' + (lang === 'id' ? 'Service Fee' : '服务费') + '</th>' +
                                    '<th class="amount">' + (lang === 'id' ? 'Bunga' : '利息') + '</th>' +
                                    '<th class="amount">' + (lang === 'id' ? 'Pokok' : '本金') + '</th>' +
                                    '<th class="amount">' + (lang === 'id' ? 'Pendapatan' : '收入') + '</th>' +
                                    '<th class="amount">' + (lang === 'id' ? 'Pengeluaran' : '运营支出') + '</th>' +
                                    '<th class="amount">🏦 ' + (lang === 'id' ? 'Brankas' : '保险柜') + '</th>' +
                                    '<th class="amount">🏧 ' + (lang === 'id' ? 'Bank BNI' : '银行BNI') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + storeStatsRows + summaryRow + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Daftar Toko' : '门店列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table store-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + (lang === 'id' ? 'Kode' : '编码') + '</th>' +
                                    '<th class="col-name">' + (lang === 'id' ? 'Nama' : '名称') + '</th>' +
                                    '<th class="col-address">' + (lang === 'id' ? 'Alamat' : '地址') + '</th>' +
                                    '<th class="col-phone">' + (lang === 'id' ? 'Telepon' : '电话') + '</th>' +
                                    '<th class="col-phone">📱 WA</th>' +
                                    '<th class="col-status text-center">' + (lang === 'id' ? 'Status' : '状态') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + storeRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Tambah Toko Baru' : '新增门店') + '</h3>' +
                    '<div class="form-grid">' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Nama Toko' : '门店名称') + ' *</label>' +
                            '<input id="newStoreName" placeholder="' + (lang === 'id' ? 'Contoh: Bangil, Gempol' : '例如: Bangil, Gempol') + '">' +
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
                '</div>';
            
            console.log('[StoreManager] 门店管理页面渲染完成');
            
        } catch (error) {
            console.error('[StoreManager] 渲染失败:', error);
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                    '<div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">' +
                        '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + t('back') + '</button>' +
                        '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                    '</div>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card" style="text-align:center; padding:40px;">' +
                    '<p style="color:var(--danger);">❌ ' + (lang === 'id' ? 'Gagal memuat data: ' : '加载失败：') + error.message + '</p>' +
                    '<details style="margin-top:16px; text-align:left;">' +
                        '<summary style="cursor:pointer;">' + (lang === 'id' ? 'Detail Error' : '错误详情') + '</summary>' +
                        '<pre style="margin-top:8px; padding:8px; background:#f1f5f9; border-radius:4px; overflow:auto; font-size:11px;">' + Utils.escapeHtml(error.stack || error.message) + '</pre>' +
                    '</details>' +
                    '<button onclick="StoreManager.renderStoreManagement()" class="btn-small" style="margin-top:16px;">🔄 ' + (lang === 'id' ? 'Coba Lagi' : '重试') + '</button>' +
                    '<button onclick="APP.goBack()" class="btn-small" style="margin-top:16px; margin-left:8px;">↩️ ' + (lang === 'id' ? 'Kembali' : '返回') + '</button>' +
                '</div>';
        }
    }
};

// 挂载到 window
window.StoreManager = StoreManager;
