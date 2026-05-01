// store.js - v2.2 (练习模式数据隔离)
// 新增：_cleanPracticeData 方法清理练习数据
// 修复：_getAllStoreCashFlowBalances 排除练习门店
// 优化：togglePracticeMode 关闭练习模式时提供清理选项

const StoreManager = {
    stores: [],
    _loaded: false,

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
        
        var confirmMsg = lang === 'id' 
            ? '⚠️ Yakin akan menonaktifkan toko ini?\n\nOperator toko tidak akan bisa login.\nData toko tetap tersimpan.'
            : '⚠️ 确认暂停此门店？\n\n门店操作员将无法登录。\n门店数据将继续保留。';
        
        var confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            const client = SUPABASE.getClient();
            const { error } = await client
                .from('stores')
                .update({ is_active: false })
                .eq('id', storeId);
            
            if (error) throw error;
            
            var store = StoreManager.stores.find(function(s) { return s.id === storeId; });
            if (store) store.is_active = false;
            
            SUPABASE.clearCache();
            
            Utils.toast.success(lang === 'id' ? '✅ Toko telah dinonaktifkan' : '✅ 门店已暂停营业');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal menonaktifkan: ' + error.message : '暂停失败：' + error.message);
        }
    },

    resumeStore: async function(storeId) {
        var lang = Utils.lang;
        
        var confirmMsg = lang === 'id' ? 'Aktifkan kembali toko ini?' : '恢复此门店营业？';
        var confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            const client = SUPABASE.getClient();
            const { error } = await client
                .from('stores')
                .update({ is_active: true })
                .eq('id', storeId);
            
            if (error) throw error;
            
            var store = StoreManager.stores.find(function(s) { return s.id === storeId; });
            if (store) store.is_active = true;
            
            SUPABASE.clearCache();
            
            Utils.toast.success(lang === 'id' ? '✅ Toko telah diaktifkan kembali' : '✅ 门店已恢复营业');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal mengaktifkan: ' + error.message : '恢复失败：' + error.message);
        }
    },

    editStore: async function(storeId) {
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        
        try {
            const client = SUPABASE.getClient();
            const { data: store, error } = await client
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
                        '<span class="badge badge-' + statusBadgeClass + '">' + statusText + '</span>' +
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
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data toko' : '加载门店数据失败');
        }
    },

    _saveEditStore: async function(storeId) {
        var lang = Utils.lang;
        var name = document.getElementById('editStoreName')?.value.trim();
        var address = document.getElementById('editStoreAddress')?.value.trim();
        var phone = document.getElementById('editStorePhone')?.value.trim();
        var waNumber = document.getElementById('editStoreWA')?.value.trim();
        
        if (!name) {
            Utils.toast.warning(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
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
            
            const client = SUPABASE.getClient();
            const { error } = await client
                .from('stores')
                .update(updates)
                .eq('id', storeId);
            
            if (error) throw error;
            
            const idx = StoreManager.stores.findIndex(s => s.id === storeId);
            if (idx !== -1) {
                StoreManager.stores[idx] = { ...StoreManager.stores[idx], ...updates };
            }
            
            document.getElementById('editStoreModal')?.remove();
            Utils.toast.success(lang === 'id' ? 'Toko berhasil diperbarui' : '门店已更新');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    // ========== 门店WA号码更新方法 ==========
    updateStoreWANumber: async function(storeId, waNumber) {
        var lang = Utils.lang;
        
        if (!storeId) {
            console.error('updateStoreWANumber: storeId 缺失');
            return;
        }
        
        try {
            const client = SUPABASE.getClient();
            const { error } = await client
                .from('stores')
                .update({ wa_number: waNumber || null })
                .eq('id', storeId);
            
            if (error) throw error;
            
            const idx = StoreManager.stores.findIndex(s => s.id === storeId);
            if (idx !== -1) {
                StoreManager.stores[idx].wa_number = waNumber || null;
            }
            
            console.log(`[StoreManager] WA号码已更新: ${storeId} -> ${waNumber}`);
            
            if (window._debugStoreWA) {
                Utils.toast.success(lang === 'id' ? '✅ Nomor WA berhasil diperbarui' : '✅ WA号码已更新');
            }
        } catch (error) {
            console.error('updateStoreWANumber 失败:', error);
            Utils.toast.error(lang === 'id' ? 'Gagal memperbarui nomor WA: ' + error.message : '更新WA号码失败：' + error.message);
        }
    },

    _getAllStoreCashFlowBalances: async function() {
        try {
            const client = SUPABASE.getClient();
            const practiceIds = await SUPABASE._getPracticeStoreIds();
            let query = client
                .from('cash_flow_records')
                .select('store_id, direction, amount, source_target')
                .eq('is_voided', false);
            
            // 排除练习门店
            if (practiceIds.length > 0) {
                query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
            
            const { data: allFlows, error } = await query;
            
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

    // ==================== 练习模式切换 ====================
    togglePracticeMode: async function(storeId, currentIsPractice) {
        var lang = Utils.lang;
        var newValue = !currentIsPractice;
        
        var confirmMsg;
        if (newValue) {
            // 开启练习模式
            confirmMsg = lang === 'id'
                ? '🎓 Jadikan toko ini sebagai Toko Latihan?\n\n📌 Data dari toko latihan TIDAK akan dihitung dalam statistik pusat.\n📌 Cocok untuk akun simulasi / pelatihan staff.\n\n❗ Semua data pesanan dan nasabah toko ini akan otomatis tersembunyi dari laporan pusat.'
                : '🎓 将此门店设为练习门店？\n\n📌 练习门店的数据不会计入总部统计报表。\n📌 适合用于模拟操作/员工培训账号。\n\n❗ 该门店所有订单和客户数据将自动从总部报表中隐藏。';
        } else {
            // 关闭练习模式，转为正式门店
            confirmMsg = lang === 'id'
                ? '⚠️ Kembalikan toko ini ke mode normal?\n\n📌 Data toko akan dihitung kembali dalam statistik pusat.\n\n📌 Anda akan ditanya apakah perlu membersihkan data latihan.'
                : '⚠️ 将此门店恢复为正常门店？\n\n📌 该门店数据将重新计入总部统计报表。\n\n📌 系统将询问是否需要清理练习数据。';
        }
        
        var confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        // 关闭练习模式时，询问是否清理历史数据
        if (!newValue) {
            var cleanChoice = await Utils.toast.confirm(
                lang === 'id'
                    ? '🗑️ Bersihkan data latihan sebelum beralih ke mode normal?\n\n✅ "Ya" = Hapus semua pesanan, nasabah, dan data keuangan toko ini\n❌ "Tidak" = Pertahankan data, toko langsung beroperasi normal\n\nDisarankan pilih "Ya" jika data hanya untuk latihan.'
                    : '🗑️ 切换到正常模式前，是否清理练习数据？\n\n✅ "确认" = 删除该门店所有订单、客户和财务数据\n❌ "取消" = 保留数据，门店直接正常运营\n\n如果数据仅是练习用途，建议选择"确认"。',
                lang === 'id' ? 'Bersihkan Data Latihan' : '清理练习数据'
            );
            
            if (cleanChoice) {
                try {
                    var loadingMsg = document.createElement('div');
                    loadingMsg.id = 'cleanPracticeLoading';
                    loadingMsg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
                    loadingMsg.innerHTML = '<div style="background:white;padding:20px 40px;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:12px;">' +
                        '<div class="loader" style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;"></div>' +
                        '<p style="margin:0;">' + (lang === 'id' ? 'Membersihkan data latihan...' : '正在清理练习数据...') + '</p>' +
                    '</div>';
                    document.body.appendChild(loadingMsg);
                    
                    await StoreManager._cleanPracticeData(storeId);
                    
                    if (loadingMsg.parentElement) loadingMsg.remove();
                    Utils.toast.success(lang === 'id' ? '✅ Data latihan berhasil dibersihkan' : '✅ 练习数据已清理');
                } catch (cleanError) {
                    var errLoading = document.getElementById('cleanPracticeLoading');
                    if (errLoading) errLoading.remove();
                    console.error('清理练习数据失败:', cleanError);
                    Utils.toast.error(lang === 'id' ? '⚠️ Gagal membersihkan data: ' + cleanError.message : '⚠️ 清理数据失败：' + cleanError.message);
                    return;
                }
            } else {
                Utils.toast.info(lang === 'id' ? 'ℹ️ Data latihan dipertahankan, toko akan beroperasi normal' : 'ℹ️ 练习数据已保留，门店将正常运营');
            }
        }
        
        try {
            const client = SUPABASE.getClient();
            const { error } = await client
                .from('stores')
                .update({ is_practice: newValue })
                .eq('id', storeId);
            
            if (error) throw error;
            
            var store = StoreManager.stores.find(function(s) { return s.id === storeId; });
            if (store) store.is_practice = newValue;
            
            // 清除缓存，确保统计立即生效
            SUPABASE.clearCache();
            
            var successMsg = newValue
                ? (lang === 'id' ? '✅ Toko berhasil dijadikan Toko Latihan' : '✅ 已设为练习门店，数据不再计入总部统计')
                : (lang === 'id' ? '✅ Toko kembali ke mode normal' : '✅ 已恢复为正常门店，数据重新计入总部统计');
            Utils.toast.success(successMsg);
            
            await StoreManager.renderStoreManagement();
        } catch (error) {
            Utils.toast.error(lang === 'id' ? 'Gagal mengubah mode: ' + error.message : '切换模式失败：' + error.message);
        }
    },

    /**
     * 清理练习门店的所有业务数据
     * 保留门店本身和用户账号，只删除业务数据
     * @param {string} storeId - 门店ID
     */
    _cleanPracticeData: async function(storeId) {
        var lang = Utils.lang;
        var client = SUPABASE.getClient();
        
        console.log('[StoreManager] 开始清理门店 ' + storeId + ' 的练习数据...');
        
        try {
            // 1. 查找该门店的所有订单ID
            var { data: orders, error: orderError } = await client
                .from('orders')
                .select('id')
                .eq('store_id', storeId);
            
            if (orderError) throw orderError;
            
            var orderIds = (orders || []).map(function(o) { return o.id; });
            console.log('[StoreManager] 找到 ' + orderIds.length + ' 个订单需要清理');
            
            if (orderIds.length > 0) {
                // 2. 删除资金流水记录（按store_id直接删除更彻底）
                var { error: cashFlowError } = await client
                    .from('cash_flow_records')
                    .delete()
                    .eq('store_id', storeId);
                
                if (cashFlowError) {
                    console.warn('[StoreManager] 清理资金流水失败:', cashFlowError.message);
                } else {
                    console.log('[StoreManager] ✅ 资金流水已清理');
                }
                
                // 3. 删除缴费记录
                var { error: paymentError } = await client
                    .from('payment_history')
                    .delete()
                    .in('order_id', orderIds);
                
                if (paymentError) {
                    console.warn('[StoreManager] 清理缴费记录失败:', paymentError.message);
                } else {
                    console.log('[StoreManager] ✅ 缴费记录已清理');
                }
                
                // 4. 删除提醒日志
                var { error: reminderError } = await client
                    .from('reminder_logs')
                    .delete()
                    .in('order_id', orderIds);
                
                if (reminderError) {
                    console.warn('[StoreManager] 清理提醒日志失败:', reminderError.message);
                } else {
                    console.log('[StoreManager] ✅ 提醒日志已清理');
                }
                
                // 5. 删除内部转账记录
                var { error: transferError } = await client
                    .from('internal_transfers')
                    .delete()
                    .eq('store_id', storeId);
                
                if (transferError) {
                    console.warn('[StoreManager] 清理内部转账失败:', transferError.message);
                } else {
                    console.log('[StoreManager] ✅ 内部转账已清理');
                }
                
                // 6. 删除订单
                var { error: orderDeleteError } = await client
                    .from('orders')
                    .delete()
                    .eq('store_id', storeId);
                
                if (orderDeleteError) {
                    console.warn('[StoreManager] 清理订单失败:', orderDeleteError.message);
                } else {
                    console.log('[StoreManager] ✅ 订单已清理');
                }
            }
            
            // 7. 删除支出记录（按store_id删除）
            var { error: expenseError } = await client
                .from('expenses')
                .delete()
                .eq('store_id', storeId);
            
            if (expenseError) {
                console.warn('[StoreManager] 清理支出记录失败:', expenseError.message);
            } else {
                console.log('[StoreManager] ✅ 支出记录已清理');
            }
            
            // 8. 删除该门店的客户
            var { error: customerError } = await client
                .from('customers')
                .delete()
                .eq('store_id', storeId);
            
            if (customerError) {
                console.warn('[StoreManager] 清理客户失败:', customerError.message);
            } else {
                console.log('[StoreManager] ✅ 客户已清理');
            }
            
            // 9. 删除该门店的黑名单
            var { error: blacklistError } = await client
                .from('blacklist')
                .delete()
                .eq('store_id', storeId);
            
            if (blacklistError) {
                console.warn('[StoreManager] 清理黑名单失败:', blacklistError.message);
            } else {
                console.log('[StoreManager] ✅ 黑名单已清理');
            }
            
            // 10. 清除所有缓存，确保统计立即生效
            SUPABASE.clearCache();
            if (window.JFCache) window.JFCache.clear();
            
            console.log('[StoreManager] ✅ 门店 ' + storeId + ' 练习数据清理完成');
            
        } catch (error) {
            console.error('[StoreManager] 清理练习数据异常:', error);
            throw new Error(lang === 'id' 
                ? 'Gagal membersihkan data latihan: ' + error.message 
                : '清理练习数据失败：' + error.message);
        }
    },

    // 核心方法：渲染门店管理页面
    renderStoreManagement: async function() {
        console.log('[StoreManager] 开始加载门店管理页面');
        const lang = Utils.lang;
        const t = function(key) { return Utils.t(key); };
        
        document.getElementById("app").innerHTML = '' +
            '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                '<div class="header-actions">' +
                    '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center; padding:40px;">' +
                '<div class="loader"></div>' +
                '<p>' + (lang === 'id' ? 'Memuat data toko...' : '加载门店数据中...') + '</p>' +
            '</div>';
        
        try {
            await StoreManager.loadStores(true);
            console.log('[StoreManager] 门店列表加载完成:', StoreManager.stores.length, '个门店');
            
            const client = SUPABASE.getClient();
            const [allOrdersResult, allExpensesResult, allPaymentsResult] = await Promise.all([
                client.from('orders').select('id, store_id, status, loan_amount, admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid'),
                client.from('expenses').select('id, store_id, amount, payment_method'),
                client.from('payment_history').select('id, order_id, type, amount, payment_method')
            ]);
            
            const allOrders = allOrdersResult.data || [];
            const allExpenses = allExpensesResult.data || [];
            const allPayments = allPaymentsResult.data || [];
            
            const orderStoreMap = {};
            for (var i = 0; i < allOrders.length; i++) {
                orderStoreMap[allOrders[i].id] = allOrders[i].store_id;
            }
            
            const storeStats = {};
            for (var i = 0; i < StoreManager.stores.length; i++) {
                storeStats[StoreManager.stores[i].id] = { orders: [], expenses: [], payments: [] };
            }
            
            for (var i = 0; i < allOrders.length; i++) {
                var orderStoreId = allOrders[i].store_id;
                if (storeStats[orderStoreId]) {
                    storeStats[orderStoreId].orders.push(allOrders[i]);
                }
            }
            
            for (var i = 0; i < allExpenses.length; i++) {
                var expenseStoreId = allExpenses[i].store_id;
                if (storeStats[expenseStoreId]) {
                    storeStats[expenseStoreId].expenses.push(allExpenses[i]);
                }
            }
            
            for (var i = 0; i < allPayments.length; i++) {
                var paymentStoreId = orderStoreMap[allPayments[i].order_id];
                if (paymentStoreId && storeStats[paymentStoreId]) {
                    storeStats[paymentStoreId].payments.push(allPayments[i]);
                }
            }
            
            const storeBalances = await StoreManager._getAllStoreCashFlowBalances();
            
            var grandTotal = { 
                orders: 0, active: 0, loan: 0, adminFee: 0, serviceFee: 0, interest: 0, 
                principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
            };
            
            var storeStatsRows = '';
            
            for (var i = 0; i < StoreManager.stores.length; i++) {
                var store = StoreManager.stores[i];
                var isPracticeStore = store.is_practice === true;
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
                
                // 练习门店不计入合计
                if (!isPracticeStore) {
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
                }
                
                var storeStatusBadge = '';
                if (store.is_active === false) {
                    storeStatusBadge = ' <span class="badge badge-liquidated">' + (lang === 'id' ? 'DITUTUP' : '已暂停') + '</span>';
                }
                if (isPracticeStore) {
                    storeStatusBadge += ' <span class="badge" style="background:#a78bfa;color:#fff;">' + (lang === 'id' ? 'LATIHAN' : '练习') + '</span>';
                }
                
                // 练习门店行添加特殊样式
                var practiceRowStyle = isPracticeStore ? ' style="background:#f5f3ff;opacity:0.85;"' : '';
                
                storeStatsRows += '<tr' + practiceRowStyle + '>' +
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
            
            var storeRows = '';
            if (StoreManager.stores.length === 0) {
                storeRows = '<tr><td colspan="6" class="text-center">' + t('no_data') + '</td>';
            } else {
                for (var i = 0; i < StoreManager.stores.length; i++) {
                    var store = StoreManager.stores[i];
                    var isActive = store.is_active !== false;
                    var isStorePractice = store.is_practice === true;
                    
                    var statusBadgeHtml = '';
                    if (isActive) {
                        statusBadgeHtml = '<span class="badge badge-active">' + (lang === 'id' ? 'Aktif' : '营业中') + '</span>';
                    } else {
                        statusBadgeHtml = '<span class="badge badge-liquidated">' + (lang === 'id' ? 'Ditutup' : '已暂停') + '</span>';
                    }
                    if (isStorePractice) {
                        statusBadgeHtml += ' <span class="badge" style="background:#a78bfa;color:#fff;">🎓 ' + (lang === 'id' ? 'Latihan' : '练习') + '</span>';
                    }
                    
                    var practiceRowStyle2 = isStorePractice ? ' style="background:#f5f3ff;opacity:0.85;"' : '';
                    
                    storeRows += '<tr' + practiceRowStyle2 + '>' +
                        '<td class="store-code">' + Utils.escapeHtml(store.code) + '</td>' +
                        '<td class="store-name">' + Utils.escapeHtml(store.name) + '</td>' +
                        '<td class="store-address desc-cell">' + Utils.escapeHtml(store.address || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(store.phone || '-') + '</td>' +
                        '<td>' +
                            '<input type="text" id="wa_' + store.id + '" value="' + Utils.escapeHtml(store.wa_number || '') + '" ' +
                                   'placeholder="628xxxxxxxxxx" style="width:140px;font-size:12px;padding:6px;" ' +
                                   'onchange="StoreManager.updateStoreWANumber(\'' + store.id + '\', this.value)">' +
                        '</td>' +
                        '<td class="text-center">' + statusBadgeHtml + '</td>' +
                    '</tr>';
                    
                    var isPractice = store.is_practice === true;
                    var practiceLabel = isPractice
                        ? (lang === 'id' ? '✅ Mode Latihan (Aktif)' : '✅ 练习模式 (已开启)')
                        : (lang === 'id' ? '🎓 Jadikan Toko Latihan' : '🎓 设为练习门店');
                    var practiceBtnStyle = isPractice ? 'style="background:#a78bfa;color:#fff;"' : 'style="background:#ede9fe;color:#6d28d9;"';
                    var practiceBtnTitle = isPractice
                        ? (lang === 'id' ? 'Kembalikan ke mode normal' : '恢复为正常门店')
                        : (lang === 'id' ? 'Jadikan toko latihan (data tidak dihitung)' : '设为练习门店（数据不计入统计）');
                    
                    var actionButtons = '' +
                        '<button onclick="StoreManager.editStore(\'' + store.id + '\')" class="btn-small">✏️ ' + t('edit') + '</button>';
                    
                    if (isActive) {
                        actionButtons += '<button onclick="StoreManager.suspendStore(\'' + store.id + '\')" class="btn-small warning">⏸️ ' + (lang === 'id' ? 'Tutup Sementara' : '暂停营业') + '</button>';
                    } else {
                        actionButtons += '<button onclick="StoreManager.resumeStore(\'' + store.id + '\')" class="btn-small success">▶️ ' + (lang === 'id' ? 'Buka Kembali' : '恢复营业') + '</button>';
                    }
                    
                    actionButtons += '<button onclick="StoreManager.togglePracticeMode(\'' + store.id + '\', ' + isPractice + ')" class="btn-small" ' + practiceBtnStyle + ' title="' + practiceBtnTitle + '">' + practiceLabel + '</button>';
                    actionButtons += '<button class="btn-small danger" onclick="APP.deleteStore(\'' + store.id + '\')">🗑️ ' + t('delete') + '</button>';
                    
                    storeRows += '<tr class="action-row" ' + practiceRowStyle2 + '>' +
                        '<td class="action-label">' + t('action') + '</td>' +
                        '<td colspan="5">' +
                            '<div class="action-buttons">' + actionButtons + '</div>' +
                        '</td>' +
                    '</tr>';
                }
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                    '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
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
                    '<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">' +
                        (lang === 'id' ? '💡 Tidak termasuk Toko Latihan' : '💡 不含练习门店') +
                    '</p>' +
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
                    '<p style="font-size:11px;color:var(--text-muted);margin-top:8px;">' +
                        (lang === 'id' ? '💡 Baris ungu = Toko Latihan (tidak dihitung dalam total)' : '💡 紫色行 = 练习门店（不计入合计）') +
                    '</p>' +
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
                    '<h2>🏪 ' + (lang === 'id' ? 'Manajemen Toko' : '门店管理') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
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

// 挂载 WA 号码更新方法到 APP
if (window.APP) {
    window.APP.updateStoreWANumber = StoreManager.updateStoreWANumber.bind(StoreManager);
} else {
    window.APP = { updateStoreWANumber: StoreManager.updateStoreWANumber.bind(StoreManager) };
}
