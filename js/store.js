// store.js - v2.0 (JF 命名空间) 卡片式财务汇总
// [新增] 门店操作员财务汇总独立页面

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const StoreManager = {
        stores: [],
        _loaded: false,

        async loadStores(force = false) {
            if (!force && StoreManager._loaded && StoreManager.stores.length > 0) {
                return StoreManager.stores;
            }
            try {
                StoreManager.stores = await SUPABASE.getAllStores();
                StoreManager._loaded = true;
                return StoreManager.stores;
            } catch (err) {
                console.error('[StoreManager] loadStores 失败:', err);
                throw err;
            }
        },

        async _generateStoreCode(name) {
            await StoreManager.loadStores(true);
            const nameLower = name.toLowerCase();
            if (nameLower.includes('kantor') || nameLower.includes('pusat') || nameLower.includes('总部')) {
                return 'STORE_000';
            }
            let maxNumber = 0;
            for (const store of StoreManager.stores) {
                const match = store.code?.match(/STORE_(\d+)/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) maxNumber = num;
                }
            }
            const nextNumber = Math.max(1, maxNumber + 1);
            return 'STORE_' + String(nextNumber).padStart(3, '0');
        },

        async createStore(name, address, phone) {
            const code = await StoreManager._generateStoreCode(name);
            const newStore = await SUPABASE.createStore(code, name, address, phone);
            StoreManager.stores.push(newStore);
            StoreManager.stores.sort((a, b) => a.code.localeCompare(b.code));
            return newStore;
        },

        async updateStore(id, updates) {
            const updated = await SUPABASE.updateStore(id, updates);
            const idx = StoreManager.stores.findIndex(s => s.id === id);
            if (idx !== -1) StoreManager.stores[idx] = { ...StoreManager.stores[idx], ...updated };
            return updated;
        },

        async deleteStore(id) {
            const lang = Utils.lang;
            const client = SUPABASE.getClient();
            
            const tablesToCheck = [
                { table: 'orders', description: lang === 'id' ? 'pesanan' : '订单' },
                { table: 'customers', description: lang === 'id' ? 'nasabah' : '客户' },
                { table: 'expenses', description: lang === 'id' ? 'pengeluaran' : '支出记录' },
                { table: 'blacklist', description: lang === 'id' ? 'blacklist' : '黑名单' },
                { table: 'capital_injections', description: lang === 'id' ? 'injeksi modal' : '资本注入' },
                { table: 'profit_distributions', description: lang === 'id' ? 'distribusi laba' : '收益处置' },
                { table: 'internal_transfers', description: lang === 'id' ? 'transfer internal' : '内部转账' },
                { table: 'cash_flow_records', description: lang === 'id' ? 'arus kas' : '资金流水' }
            ];
            
            for (const { table, description } of tablesToCheck) {
                try {
                    const { count, error } = await client
                        .from(table)
                        .select('*', { count: 'exact', head: true })
                        .eq('store_id', id);
                    
                    if (error) {
                        debugLog('[WARN]',`[StoreManager] 检查表 ${table} 失败:`, error.message);
                        continue;
                    }
                    
                    if (count > 0) {
                        const errorMsg = lang === 'id'
                            ? `Toko ini memiliki ${count} ${description}. Tidak dapat dihapus.`
                            : `该门店包含 ${count} 条${description}，无法删除。`;
                        throw new Error(errorMsg);
                    }
                } catch (checkError) {
                    if (checkError.message && (checkError.message.includes('无法删除') || checkError.message.includes('Tidak dapat dihapus'))) {
                        throw checkError;
                    }
                    debugLog('[WARN]',`[StoreManager] 检查表 ${table} 时发生异常:`, checkError.message);
                }
            }
            
            try {
                const { error } = await client.from('stores').delete().eq('id', id);
                if (error) throw error;
                StoreManager.stores = StoreManager.stores.filter(s => s.id !== id);
                if (window.Audit) {
                    await window.Audit.logStoreAction(id, 'delete', '门店已删除');
                }
                Utils.toast.success(lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
            } catch (error) {
                console.error('[StoreManager] deleteStore 执行失败:', error);
                throw error;
            }
        },

        async suspendStore(storeId) {
            const lang = Utils.lang;
            const confirmMsg = lang === 'id'
                ? '⚠️ Yakin akan menonaktifkan toko ini?\n\nOperator toko tidak akan bisa login.\nData toko tetap tersimpan.'
                : '⚠️ 确认暂停此门店？\n\n门店操作员将无法登录。\n门店数据将继续保留。';
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;
            try {
                const client = SUPABASE.getClient();
                const { error } = await client.from('stores').update({ is_active: false }).eq('id', storeId);
                if (error) throw error;
                const store = StoreManager.stores.find(s => s.id === storeId);
                if (store) store.is_active = false;
                SUPABASE.clearCache();
                Utils.toast.success(lang === 'id' ? 'Toko telah dinonaktifkan' : '门店已暂停营业');
                await StoreManager.renderStoreManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal menonaktifkan: ' + error.message : '暂停失败：' + error.message);
            }
        },

        async resumeStore(storeId) {
            const lang = Utils.lang;
            const confirmed = await Utils.toast.confirm(lang === 'id' ? 'Aktifkan kembali toko ini?' : '恢复此门店营业？');
            if (!confirmed) return;
            try {
                const client = SUPABASE.getClient();
                const { error } = await client.from('stores').update({ is_active: true }).eq('id', storeId);
                if (error) throw error;
                const store = StoreManager.stores.find(s => s.id === storeId);
                if (store) store.is_active = true;
                SUPABASE.clearCache();
                Utils.toast.success(lang === 'id' ? 'Toko telah diaktifkan kembali' : '门店已恢复营业');
                await StoreManager.renderStoreManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal mengaktifkan: ' + error.message : '恢复失败：' + error.message);
            }
        },

        async editStore(storeId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            try {
                const client = SUPABASE.getClient();
                const { data: store, error } = await client.from('stores').select('*').eq('id', storeId).single();
                if (error) throw error;
                const isActive = store.is_active !== false;
                const statusText = isActive ? (lang === 'id' ? 'Aktif' : '营业中') : (lang === 'id' ? 'Ditutup' : '已暂停');
                const statusBadgeClass = isActive ? 'active' : 'liquidated';
                const modal = document.createElement('div');
                modal.id = 'editStoreModal';
                modal.className = 'modal-overlay';
                modal.innerHTML =
                    `<div class="modal-content" style="max-width:500px;">
                        <h3>✏️ ${lang === 'id' ? 'Edit Toko' : '编辑门店'}</h3>
                        <div style="margin-bottom:16px;">
                            <span class="badge badge--${statusBadgeClass}">${statusText}</span>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Kode Toko' : '门店编码'}</label>
                            <input value="${Utils.escapeHtml(store.code)}" readonly>
                            <div class="form-hint">⚠️ ${lang === 'id' ? 'Kode tidak dapat diubah' : '编码不可修改'}</div>
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
                        <div class="form-group">
                            <label>📱 ${lang === 'id' ? 'Nomor WhatsApp' : 'WhatsApp 号码'}</label>
                            <input id="editStoreWA" value="${Utils.escapeHtml(store.wa_number || '')}" placeholder="628xxxxxxxxxx">
                            <div class="form-hint">${lang === 'id' ? 'Contoh: 6281234567890 (tanpa +)' : '示例: 6281234567890 (不带+)'}</div>
                        </div>
                        <div class="modal-actions">
                            <button onclick="StoreManager._saveEditStore('${storeId}')" class="btn btn--success">💾 ${t('save')}</button>
                            <button onclick="document.getElementById('editStoreModal').remove()" class="btn btn--outline">✖ ${t('cancel')}</button>
                        </div>
                    </div>`;
                document.body.appendChild(modal);
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data toko' : '加载门店数据失败');
            }
        },

        async _saveEditStore(storeId) {
            const lang = Utils.lang;
            const name = document.getElementById('editStoreName')?.value.trim();
            const address = document.getElementById('editStoreAddress')?.value.trim();
            const phone = document.getElementById('editStorePhone')?.value.trim();
            const waNumber = document.getElementById('editStoreWA')?.value.trim();
            if (!name) {
                Utils.toast.warning(lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
                return;
            }
            try {
                const updates = { name, address: address || null, phone: phone || null };
                if (waNumber) updates.wa_number = waNumber;
                const client = SUPABASE.getClient();
                const { error } = await client.from('stores').update(updates).eq('id', storeId);
                if (error) throw error;
                const idx = StoreManager.stores.findIndex(s => s.id === storeId);
                if (idx !== -1) StoreManager.stores[idx] = { ...StoreManager.stores[idx], ...updates };
                document.getElementById('editStoreModal')?.remove();
                Utils.toast.success(lang === 'id' ? 'Toko berhasil diperbarui' : '门店已更新');
                await StoreManager.renderStoreManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            }
        },

        async updateStoreWANumber(storeId, waNumber) {
            if (!storeId) return;
            try {
                const client = SUPABASE.getClient();
                const { error } = await client.from('stores').update({ wa_number: waNumber || null }).eq('id', storeId);
                if (error) throw error;
                const idx = StoreManager.stores.findIndex(s => s.id === storeId);
                if (idx !== -1) StoreManager.stores[idx].wa_number = waNumber || null;
            } catch (error) {
                console.error('updateStoreWANumber 失败:', error);
            }
        },

        async _getAllStoreCashFlowBalances() {
            try {
                const client = SUPABASE.getClient();
                const practiceIds = await SUPABASE._getPracticeStoreIds();
                let query = client.from('cash_flow_records')
                    .select('store_id, direction, amount, source_target')
                    .eq('is_voided', false);
                if (practiceIds.length > 0) query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                const { data: allFlows, error } = await query;
                if (error) { debugLog('[WARN]','批量获取门店现金流失败:', error); return {}; }
                const balances = {};
                for (const flow of allFlows || []) {
                    const storeId = flow.store_id;
                    if (!storeId) continue;
                    const amount = flow.amount || 0;
                    if (!balances[storeId]) balances[storeId] = { cashBalance: 0, bankBalance: 0 };
                    if (flow.direction === 'inflow') {
                        if (flow.source_target === 'cash') balances[storeId].cashBalance += amount;
                        else if (flow.source_target === 'bank') balances[storeId].bankBalance += amount;
                    } else {
                        if (flow.source_target === 'cash') balances[storeId].cashBalance -= amount;
                        else if (flow.source_target === 'bank') balances[storeId].bankBalance -= amount;
                    }
                }
                for (const s of StoreManager.stores) {
                    if (!balances[s.id]) balances[s.id] = { cashBalance: 0, bankBalance: 0 };
                }
                return balances;
            } catch (error) {
                console.error('_getAllStoreCashFlowBalances 异常:', error);
                return {};
            }
        },

        async togglePracticeMode(storeId, currentIsPractice) {
            const lang = Utils.lang;
            const newValue = !currentIsPractice;
            let confirmMsg;
            if (newValue) {
                confirmMsg = lang === 'id'
                    ? '🎓 Jadikan toko ini sebagai Toko Latihan?\n\n📌 Data dari toko latihan TIDAK akan dihitung dalam statistik pusat.\n📌 Cocok untuk akun simulasi / pelatihan staff.\n\n❗ Semua data pesanan dan nasabah toko ini akan otomatis tersembunyi dari laporan pusat.'
                    : '🎓 将此门店设为练习门店？\n\n📌 练习门店的数据不会计入总部统计报表。\n📌 适合用于模拟操作/员工培训账号。\n\n❗ 该门店所有订单和客户数据将自动从总部报表中隐藏。';
            } else {
                confirmMsg = lang === 'id'
                    ? '⚠️ Kembalikan toko ini ke mode normal?\n\n📌 Data toko akan dihitung kembali dalam statistik pusat.\n\n📌 Anda akan ditanya apakah perlu membersihkan data latihan.'
                    : '⚠️ 将此门店恢复为正常门店？\n\n📌 该门店数据将重新计入总部统计报表。\n\n📌 系统将询问是否需要清理练习数据。';
            }
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;
            if (!newValue) {
                const cleanChoice = await Utils.toast.confirm(
                    lang === 'id'
                        ? '🗑️ Bersihkan data latihan sebelum beralih ke mode normal?\n\n✅ "Ya" = Hapus semua pesanan, nasabah, dan data keuangan toko ini\n❌ "Tidak" = Pertahankan data, toko langsung beroperasi normal\n\nDisarankan pilih "Ya" jika data hanya untuk latihan.'
                        : '🗑️ 切换到正常模式前，是否清理练习数据？\n\n✅ "确认" = 删除该门店所有订单、客户和财务数据\n❌ "取消" = 保留数据，门店直接正常运营\n\n如果数据仅是练习用途，建议选择"确认"。',
                    lang === 'id' ? 'Bersihkan Data Latihan' : '清理练习数据'
                );
                if (cleanChoice) {
                    try {
                        const loadingMsg = document.createElement('div');
                        loadingMsg.id = 'cleanPracticeLoading';
                        loadingMsg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
                        loadingMsg.innerHTML = '<div style="background:white;padding:20px 40px;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:12px;"><div class="loader" style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;"></div><p style="margin:0;">' + (lang === 'id' ? 'Membersihkan data latihan...' : '正在清理练习数据...') + '</p></div>';
                        document.body.appendChild(loadingMsg);
                        await StoreManager._cleanPracticeDataEnhanced(storeId);
                        if (loadingMsg.parentElement) loadingMsg.remove();
                        Utils.toast.success(lang === 'id' ? 'Data latihan berhasil dibersihkan' : '练习数据已清理');
                    } catch (cleanError) {
                        const errLoading = document.getElementById('cleanPracticeLoading');
                        if (errLoading) errLoading.remove();
                        console.error('清理练习数据失败:', cleanError);
                        Utils.toast.error(lang === 'id' ? `Gagal membersihkan data: ${cleanError.message}` : `清理数据失败：${cleanError.message}`, 8000);
                        return;
                    }
                } else {
                    Utils.toast.info(lang === 'id' ? 'Data latihan dipertahankan, toko akan beroperasi normal' : '练习数据已保留，门店将正常运营');
                }
            }
            try {
                const client = SUPABASE.getClient();
                const { error } = await client.from('stores').update({ is_practice: newValue }).eq('id', storeId);
                if (error) throw error;
                const store = StoreManager.stores.find(s => s.id === storeId);
                if (store) store.is_practice = newValue;
                SUPABASE.clearCache();
                Utils.toast.success(newValue
                    ? (lang === 'id' ? 'Toko berhasil dijadikan Toko Latihan' : '已设为练习门店，数据不再计入总部统计')
                    : (lang === 'id' ? 'Toko kembali ke mode normal' : '已恢复为正常门店，数据重新计入总部统计'));
                await StoreManager.renderStoreManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal mengubah mode: ' + error.message : '切换模式失败：' + error.message);
            }
        },

        async _cleanPracticeDataEnhanced(storeId) {
            const client = SUPABASE.getClient();
            const { data: orders, error: orderError } = await client.from('orders').select('id').eq('store_id', storeId);
            if (orderError) throw new Error('查询订单失败: ' + orderError.message);
            const orderIds = (orders || []).map(o => o.id);
            const cleanSteps = [];
            cleanSteps.push({ name: 'cash_flow_records', exec: async () => await client.from('cash_flow_records').delete().eq('store_id', storeId) });
            if (orderIds.length > 0) {
                cleanSteps.push({ name: 'payment_history', exec: async () => await client.from('payment_history').delete().in('order_id', orderIds) });
                cleanSteps.push({ name: 'reminder_logs', exec: async () => await client.from('reminder_logs').delete().in('order_id', orderIds) });
                cleanSteps.push({ name: 'internal_transfers', exec: async () => await client.from('internal_transfers').delete().eq('store_id', storeId) });
            }
            cleanSteps.push({ name: 'orders', exec: async () => await client.from('orders').delete().eq('store_id', storeId) });
            cleanSteps.push({ name: 'expenses', exec: async () => await client.from('expenses').delete().eq('store_id', storeId) });
            cleanSteps.push({ name: 'customers', exec: async () => await client.from('customers').delete().eq('store_id', storeId) });
            cleanSteps.push({ name: 'blacklist', exec: async () => await client.from('blacklist').delete().eq('store_id', storeId) });
            for (const step of cleanSteps) {
                try { await step.exec(); } catch (e) { debugLog('[WARN]',`清理 ${step.name} 失败:`, e.message); }
            }
            SUPABASE.clearCache();
            if (window.JFCache) window.JFCache.clear();
        },

        // ==================== 获取门店财务统计数据 ====================
        async _getStoreFinanceStats(storeId) {
            const client = SUPABASE.getClient();
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const monthEnd = Utils.getLocalToday();

            // 获取订单数据
            const { data: orders, error: orderError } = await client
                .from('orders')
                .select('id, store_id, status, loan_amount, created_at, admin_fee, admin_fee_paid, service_fee_amount, service_fee_paid, interest_paid_total, principal_paid')
                .eq('store_id', storeId);
            if (orderError) console.error('[StoreManager] 查询订单失败:', orderError);

            // 获取支出数据
            const { data: expenses, error: expenseError } = await client
                .from('expenses').select('id, store_id, amount, expense_date')
                .eq('store_id', storeId);
            if (expenseError) console.error('[StoreManager] 查询支出失败:', expenseError);

            // 获取偿还本金数据
            const { data: returnCapitalData, error: returnError } = await client
                .from('profit_distributions').select('store_id, amount').eq('type', 'return_capital').eq('store_id', storeId);
            if (returnError) debugLog('[WARN]','[StoreManager] 查询偿还本金失败:', returnError.message);

            // 获取现金流余额
            const { data: flows, error: flowError } = await client
                .from('cash_flow_records')
                .select('direction, amount, source_target')
                .eq('store_id', storeId)
                .eq('is_voided', false);
            
            let cashBalance = 0, bankBalance = 0;
            if (!flowError && flows) {
                for (const f of flows) {
                    const amt = f.amount || 0;
                    if (f.direction === 'inflow') {
                        if (f.source_target === 'cash') cashBalance += amt;
                        else if (f.source_target === 'bank') bankBalance += amt;
                    } else {
                        if (f.source_target === 'cash') cashBalance -= amt;
                        else if (f.source_target === 'bank') bankBalance -= amt;
                    }
                }
            }

            const stats = {
                monthNewOrders: 0, monthLoanAmount: 0, monthAdminFee: 0,
                monthServiceFee: 0, monthInterest: 0, monthExpense: 0,
                totalOrders: 0, activeOrders: 0, completedOrders: 0,
                totalLoanAmount: 0, totalAdminFee: 0, totalServiceFee: 0,
                totalInterest: 0, totalPrincipal: 0, totalExpense: 0,
                returnCapital: 0, deployedCapital: 0,
                cashBalance: cashBalance, bankBalance: bankBalance,
                availableCapital: cashBalance + bankBalance
            };

            const orderIds = [];
            for (const o of (orders || [])) {
                orderIds.push(o.id);
                stats.totalOrders++;
                stats.totalLoanAmount += (o.loan_amount || 0);
                // Bug3修复：totalAdminFee 改从 payment_history 查询，与月度管理费口径统一
                // 原来用 o.admin_fee_paid ? o.admin_fee : 0，当管理员手动调整过管理费时会与实收金额不符
                stats.totalServiceFee += (o.service_fee_paid || 0);
                stats.totalInterest += (o.interest_paid_total || 0);
                stats.totalPrincipal += (o.principal_paid || 0);
                if (o.status === 'active') {
                    stats.activeOrders++;
                    stats.deployedCapital += (o.loan_amount || 0) - (o.principal_paid || 0);
                } else if (o.status === 'completed') {
                    stats.completedOrders++;
                }
                if (o.created_at && o.created_at >= monthStart && o.created_at <= monthEnd + 'T23:59:59') {
                    stats.monthNewOrders++;
                    stats.monthLoanAmount += (o.loan_amount || 0);
                }
            }

            // 获取本月及累计费用（统一从 payment_history 查询，确保管理费/服务费/利息口径一致）
            if (orderIds.length > 0) {
                const { data: allAdminFees } = await client
                    .from('payment_history').select('order_id, amount, date')
                    .eq('type', 'admin_fee').in('order_id', orderIds);
                if (allAdminFees) {
                    for (const p of allAdminFees) {
                        stats.totalAdminFee += (p.amount || 0);
                        if (p.date >= monthStart && p.date <= monthEnd) stats.monthAdminFee += (p.amount || 0);
                    }
                }
                
                const { data: monthServiceFees } = await client
                    .from('payment_history').select('order_id, amount')
                    .eq('type', 'service_fee').gte('date', monthStart).lte('date', monthEnd).in('order_id', orderIds);
                if (monthServiceFees) {
                    for (const p of monthServiceFees) stats.monthServiceFee += (p.amount || 0);
                }
                
                const { data: monthInterests } = await client
                    .from('payment_history').select('order_id, amount')
                    .eq('type', 'interest').gte('date', monthStart).lte('date', monthEnd).in('order_id', orderIds);
                if (monthInterests) {
                    for (const p of monthInterests) stats.monthInterest += (p.amount || 0);
                }
            }

            // 统计支出
            for (const e of (expenses || [])) {
                stats.totalExpense += (e.amount || 0);
                if (e.expense_date >= monthStart && e.expense_date <= monthEnd) {
                    stats.monthExpense += (e.amount || 0);
                }
            }

            // 统计偿还本金
            for (const rc of (returnCapitalData || [])) {
                stats.returnCapital += (rc.amount || 0);
            }

            stats.monthProfit = stats.monthAdminFee + stats.monthServiceFee + stats.monthInterest - stats.monthExpense;
            stats.totalProfit = stats.totalAdminFee + stats.totalServiceFee + stats.totalInterest - stats.totalExpense;

            return stats;
        },

        // ==================== 构建财务汇总卡片 HTML ====================
        _buildFinanceCardHTML(stats, storeName, storeCode, lang) {
            const fmt = (val) => Utils.formatCurrency(val);
            return `
<div class="store-finance-card">
    <div class="card-header">${Utils.escapeHtml(storeName)} <span style="font-size:0.8rem;">(${Utils.escapeHtml(storeCode)})</span></div>
    <div class="card-grid">
        <div><strong>📋 ${lang === 'id' ? 'Pesanan Baru / Total' : '本月新增订单 / 单数总计'}</strong><br>${stats.monthNewOrders} / ${stats.totalOrders}</div>
        <div><strong>🔄 ${lang === 'id' ? 'Aktif / Lunas' : '进行中订单/已结清订单'}</strong><br>${stats.activeOrders} / ${stats.completedOrders}</div>
        <div><strong>💰 ${lang === 'id' ? 'Pinjaman Bulan Ini' : '本月当金'}</strong><br>${fmt(stats.monthLoanAmount)}</div>

        <div><strong>🧾 ${lang === 'id' ? 'Admin Bulan Ini / Total Admin' : '本月管理费 / 累管理费'}</strong><br>${fmt(stats.monthAdminFee)} / ${fmt(stats.totalAdminFee)}</div>
        <div><strong>🛠️ ${lang === 'id' ? 'Layanan Bulan Ini / Total Layanan' : '本月服务费 / 累计服务费'}</strong><br>${fmt(stats.monthServiceFee)} / ${fmt(stats.totalServiceFee)}</div>
        <div><strong>💸 ${lang === 'id' ? 'Bunga Bulan Ini / Total Bunga' : '本月利息 / 累计利息'}</strong><br>${fmt(stats.monthInterest)} / ${fmt(stats.totalInterest)}</div>

        <div><strong>📦 ${lang === 'id' ? 'Dana Terjamin' : '在押资金'}</strong><br>${fmt(stats.deployedCapital)}</div>
        <div><strong>💵 ${lang === 'id' ? 'Dana Tersedia' : '可动用资金'}</strong><br>${fmt(stats.availableCapital)}</div>
        <div><strong>🏦 ${lang === 'id' ? 'Brankas / Bank BNI' : '保险柜现金 / 银行BNI存款'}</strong><br>${fmt(stats.cashBalance)} / ${fmt(stats.bankBalance)}</div>

        <div><strong>📉 ${lang === 'id' ? 'Pengeluaran Bulan Ini / Total' : '本月支出 / 累支出'}</strong><br>${fmt(stats.monthExpense)} / ${fmt(stats.totalExpense)}</div>
        <div><strong>📈 ${lang === 'id' ? 'Laba Bulan Ini / Total Laba' : '本月利润 / 累计利润'}</strong><br>${fmt(stats.monthProfit)} / ${fmt(stats.totalProfit)}</div>
        <div><strong>💳 ${lang === 'id' ? 'Cicilan Pokok' : '偿还本金'}</strong><br>${fmt(stats.returnCapital)}</div>
    </div>
</div>`;
        },

        // ==================== 独立显示财务汇总（供侧边栏调用） ====================
        async showStoreFinance() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            
            APP.currentPage = 'storeFinance';
            APP.saveCurrentPageState();
            
            try {
                let stats, storeName, storeCode;
                
                if (isAdmin) {
                    // 管理员：显示门店选择器 + 选中的门店财务汇总
                    const stores = await SUPABASE.getAllStores();
                    const validStores = stores.filter(s => s.code !== 'STORE_000');
                    
                    let selectedStoreId = sessionStorage.getItem('jf_store_finance_selected');
                    if (!selectedStoreId || !validStores.find(s => s.id === selectedStoreId)) {
                        selectedStoreId = validStores[0]?.id || null;
                    }
                    
                    const storeSelector = `
                        <div class="form-group" style="max-width: 300px; margin-bottom: 16px;">
                            <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'}</label>
                            <select id="storeFinanceSelect" onchange="StoreManager.refreshStoreFinance()" style="width:100%;padding:8px;border-radius:6px;">
                                ${validStores.map(s => `<option value="${s.id}" ${selectedStoreId === s.id ? 'selected' : ''}>${Utils.escapeHtml(s.name)} (${s.code})</option>`).join('')}
                            </select>
                        </div>
                    `;
                    
                    if (selectedStoreId) {
                        const selectedStore = validStores.find(s => s.id === selectedStoreId);
                        storeName = selectedStore.name;
                        storeCode = selectedStore.code;
                        stats = await StoreManager._getStoreFinanceStats(selectedStoreId);
                        sessionStorage.setItem('jf_store_finance_selected', selectedStoreId);
                    } else {
                        stats = { totalOrders: 0 };
                        storeName = lang === 'id' ? 'Tidak ada toko' : '无门店';
                        storeCode = '-';
                    }
                    
                    const financeHtml = stats.totalOrders !== undefined ? StoreManager._buildFinanceCardHTML(stats, storeName, storeCode, lang) : `<div class="empty-state">${lang === 'id' ? 'Tidak ada data' : '暂无数据'}</div>`;
                    
                    document.getElementById("app").innerHTML = `
                        <div class="page-header">
                            <h2>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h2>
                            <div class="header-actions">
                                <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                                <button onclick="StoreManager.printCurrentFinance()" class="btn btn--outline">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            </div>
                        </div>
                        ${storeSelector}
                        <div class="card">
                            <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan' : '财务汇总'}</h3>
                            <div class="store-cards-grid" id="storeFinanceContainer">
                                ${financeHtml}
                            </div>
                            <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">💡 ${lang === 'id' ? 'Format: Bulan Ini / Total' : '格式: 本月 / 累计'}</p>
                        </div>
                    `;
                    
                    window._currentFinanceStoreId = selectedStoreId;
                    
                } else {
                    // 门店操作员：直接显示本门店财务汇总
                    const storeId = profile?.store_id;
                    if (!storeId) {
                        document.getElementById("app").innerHTML = `<div class="card"><p>${lang === 'id' ? 'Tidak ada data toko' : '没有门店数据'}</p><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button></div>`;
                        return;
                    }
                    
                    const currentStore = StoreManager.stores.find(s => s.id === storeId);
                    storeName = currentStore?.name || profile?.stores?.name || (lang === 'id' ? 'Toko' : '门店');
                    storeCode = currentStore?.code || '-';
                    stats = await StoreManager._getStoreFinanceStats(storeId);
                    
                    const financeHtml = StoreManager._buildFinanceCardHTML(stats, storeName, storeCode, lang);
                    
                    document.getElementById("app").innerHTML = `
                        <div class="page-header">
                            <h2>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h2>
                            <div class="header-actions">
                                <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                                <button onclick="StoreManager.printCurrentFinance()" class="btn btn--outline">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            </div>
                        </div>
                        <div class="card">
                            <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan' : '财务汇总'} - ${Utils.escapeHtml(storeName)}</h3>
                            <div class="store-cards-grid" id="storeFinanceContainer">
                                ${financeHtml}
                            </div>
                            <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">💡 ${lang === 'id' ? 'Format: Bulan Ini / Total' : '格式: 本月 / 累计'}</p>
                        </div>
                    `;
                }
                
                // 添加样式
                if (!document.getElementById('storeFinanceStyle')) {
                    const style = document.createElement('style');
                    style.id = 'storeFinanceStyle';
                    style.textContent = `
                        .store-cards-grid {
                            display: flex !important;
                            flex-direction: column !important;
                            gap: 16px !important;
                        }
                        .store-finance-card .card-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 10px;
                        }
                        @media screen and (max-width: 768px) {
                            .store-finance-card .card-grid {
                                grid-template-columns: 1fr !important;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
            } catch (error) {
                console.error('[showStoreFinance] 错误:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data keuangan' : '加载财务数据失败');
                document.getElementById("app").innerHTML = `<div class="card"><p>❌ ${error.message}</p><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button></div>`;
            }
        },
        
        async refreshStoreFinance() {
            const select = document.getElementById('storeFinanceSelect');
            if (!select) return;
            const storeId = select.value;
            if (storeId) {
                sessionStorage.setItem('jf_store_finance_selected', storeId);
                await StoreManager.showStoreFinance();
            }
        },
        
        async printCurrentFinance() {
            const lang = Utils.lang;
            const container = document.getElementById('storeFinanceContainer');
            if (!container || !container.innerHTML.trim()) {
                Utils.toast.warning(lang === 'id' ? 'Tidak ada data untuk dicetak' : '没有数据可打印');
                return;
            }
            
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            let storeName = '', roleText = '', userName = '';
            try {
                storeName = AUTH.getCurrentStoreName();
                roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') : AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工');
                userName = AUTH.user?.name || '-';
            } catch (e) { /* ignore */ }
            
            const printDateTime = new Date().toLocaleString();
            const isZh = lang !== 'id';
            
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Utils.toast.warning(lang === 'id' ? 'Popup diblokir. Izinkan popup untuk halaman ini lalu coba lagi.' : '弹出窗口被拦截，请允许本页弹出窗口后重试。', 5000);
                return;
            }
            
            const cardsHtml = container.innerHTML;
            
            printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>JF! by Gadai - ${isZh ? '门店财务汇总' : 'Ringkasan Keuangan Toko'}</title>
    <style>${(window.JF?.PrintPage?.PRINT_CSS) || ""}</style>
</head>
<body>
    <div class="ph">
        <div class="ph-logo">JF! by Gadai</div>
        <div class="ph-info">
            🏪 ${isAdmin ? (isZh ? '总部' : 'Kantor Pusat') : (isZh ? '门店：' : 'Toko: ') + Utils.escapeHtml(storeName)}
            &nbsp;|&nbsp; 👤 ${Utils.escapeHtml(roleText)}
            &nbsp;|&nbsp; 📅 ${printDateTime}
        </div>
    </div>
    ${cardsHtml}
    <div class="pf">
        JF! by Gadai &nbsp;·&nbsp; ${isZh ? '典当管理系统' : 'Sistem Manajemen Gadai'}
    </div>
    <script>
        window.onload = function() {
            window.addEventListener('afterprint', function() { window.close(); });
            window.print();
        };
    <\/script>
</body>
</html>`);
            printWindow.document.close();
        },

        // ==================== 原有的 renderStoreManagement（管理员完整视图） ====================
        async renderStoreManagement() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            const profile = await SUPABASE.getCurrentProfile();
            
            if (!isAdmin) {
                // 门店操作员：直接显示财务汇总页面
                await StoreManager.showStoreFinance();
                return;
            }
            
            // 管理员：显示完整门店管理页面
            document.getElementById("app").innerHTML = await StoreManager.buildStoreManagementHTML();
        },

        async buildStoreManagementHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = true; // 只有管理员进入此方法
            
            try {
                await StoreManager.loadStores(true);
                const client = SUPABASE.getClient();
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth();
                const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
                const monthEnd = Utils.getLocalToday();

                let orderQuery = client.from('orders')
                    .select('id, store_id, status, loan_amount, created_at, admin_fee, admin_fee_paid, service_fee_amount, service_fee_paid, interest_paid_total, principal_paid');
                
                const { data: allOrders, error: orderError } = await orderQuery;
                if (orderError) console.error('[StoreManager] 查询订单失败:', orderError);

                let expenseQuery = client.from('expenses').select('id, store_id, amount, expense_date');
                const { data: allExpenses, error: expenseError } = await expenseQuery;
                if (expenseError) console.error('[StoreManager] 查询支出失败:', expenseError);

                const { data: returnCapitalData, error: returnError } = await client
                    .from('profit_distributions').select('store_id, amount').eq('type', 'return_capital');
                if (returnError) debugLog('[WARN]','[StoreManager] 查询偿还本金失败:', returnError.message);

                const storeBalances = await StoreManager._getAllStoreCashFlowBalances();

                const storeStats = {};
                const storesToProcess = StoreManager.stores.filter(s => s.code !== 'STORE_000');

                for (const s of storesToProcess) {
                    storeStats[s.id] = {
                        id: s.id, name: s.name, code: s.code,
                        monthNewOrders: 0, monthLoanAmount: 0, monthAdminFee: 0,
                        monthServiceFee: 0, monthInterest: 0, monthExpense: 0,
                        totalOrders: 0, activeOrders: 0, completedOrders: 0,
                        totalLoanAmount: 0, totalAdminFee: 0, totalServiceFee: 0,
                        totalInterest: 0, totalPrincipal: 0, totalExpense: 0,
                        returnCapital: 0, deployedCapital: 0
                    };
                }

                for (const o of (allOrders || [])) {
                    const sid = o.store_id;
                    if (!storeStats[sid]) continue;
                    const stats = storeStats[sid];
                    stats.totalOrders++;
                    stats.totalLoanAmount += (o.loan_amount || 0);
                    // Bug3修复：totalAdminFee 移到下方从 payment_history 统一查询
                    stats.totalServiceFee += (o.service_fee_paid || 0);
                    stats.totalInterest += (o.interest_paid_total || 0);
                    stats.totalPrincipal += (o.principal_paid || 0);
                    if (o.status === 'active') {
                        stats.activeOrders++;
                        stats.deployedCapital += (o.loan_amount || 0) - (o.principal_paid || 0);
                    } else if (o.status === 'completed') {
                        stats.completedOrders++;
                    }
                    if (o.created_at && o.created_at >= monthStart && o.created_at <= monthEnd + 'T23:59:59') {
                        stats.monthNewOrders++;
                        stats.monthLoanAmount += (o.loan_amount || 0);
                    }
                }

                // Bug3修复：orderStoreMap 提取到外层只构建一次，三处查询复用，同时消除重复声明
                const orderStoreMap = {};
                for (const o of (allOrders || [])) orderStoreMap[o.id] = o.store_id;

                const allOrderIds = (allOrders || []).map(o => o.id);
                if (allOrderIds.length > 0) {
                    // 管理费查全量（含累计），与月度口径统一，不再使用 orders.admin_fee 字段
                    const { data: allAdminFees } = await client
                        .from('payment_history').select('order_id, amount, date')
                        .eq('type', 'admin_fee').in('order_id', allOrderIds);
                    if (allAdminFees) {
                        for (const p of allAdminFees) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) {
                                storeStats[sid].totalAdminFee += (p.amount || 0);
                                if (p.date >= monthStart && p.date <= monthEnd) storeStats[sid].monthAdminFee += (p.amount || 0);
                            }
                        }
                    }
                    const { data: monthServiceFees } = await client
                        .from('payment_history').select('order_id, amount')
                        .eq('type', 'service_fee').gte('date', monthStart).lte('date', monthEnd).in('order_id', allOrderIds);
                    if (monthServiceFees) {
                        for (const p of monthServiceFees) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) storeStats[sid].monthServiceFee += (p.amount || 0);
                        }
                    }
                    const { data: monthInterests } = await client
                        .from('payment_history').select('order_id, amount')
                        .eq('type', 'interest').gte('date', monthStart).lte('date', monthEnd).in('order_id', allOrderIds);
                    if (monthInterests) {
                        for (const p of monthInterests) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) storeStats[sid].monthInterest += (p.amount || 0);
                        }
                    }
                }
                if (allOrderIds.length > 0) {
                    const { data: monthAdminFees } = await client
                        .from('payment_history').select('order_id, amount')
                        .eq('type', 'admin_fee').gte('date', monthStart).lte('date', monthEnd).in('order_id', allOrderIds);
                    if (monthAdminFees) {
                        const orderStoreMap = {};
                        for (const o of (allOrders || [])) orderStoreMap[o.id] = o.store_id;
                        for (const p of monthAdminFees) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) storeStats[sid].monthAdminFee += (p.amount || 0);
                        }
                    }
                    
                    const { data: monthServiceFees } = await client
                        .from('payment_history').select('order_id, amount')
                        .eq('type', 'service_fee').gte('date', monthStart).lte('date', monthEnd).in('order_id', allOrderIds);
                    if (monthServiceFees) {
                        const orderStoreMap = {};
                        for (const o of (allOrders || [])) orderStoreMap[o.id] = o.store_id;
                        for (const p of monthServiceFees) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) storeStats[sid].monthServiceFee += (p.amount || 0);
                        }
                    }
                    
                    const { data: monthInterests } = await client
                        .from('payment_history').select('order_id, amount')
                        .eq('type', 'interest').gte('date', monthStart).lte('date', monthEnd).in('order_id', allOrderIds);
                    if (monthInterests) {
                        const orderStoreMap = {};
                        for (const o of (allOrders || [])) orderStoreMap[o.id] = o.store_id;
                        for (const p of monthInterests) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) storeStats[sid].monthInterest += (p.amount || 0);
                        }
                    }
                }

                for (const e of (allExpenses || [])) {
                    const sid = e.store_id;
                    if (!storeStats[sid]) continue;
                    storeStats[sid].totalExpense += (e.amount || 0);
                    if (e.expense_date >= monthStart && e.expense_date <= monthEnd) {
                        storeStats[sid].monthExpense += (e.amount || 0);
                    }
                }

                for (const rc of (returnCapitalData || [])) {
                    const sid = rc.store_id;
                    if (!storeStats[sid]) continue;
                    storeStats[sid].returnCapital += (rc.amount || 0);
                }

                for (const sid of Object.keys(storeStats)) {
                    const s = storeStats[sid];
                    s.monthProfit = s.monthAdminFee + s.monthServiceFee + s.monthInterest - s.monthExpense;
                    s.totalProfit = s.totalAdminFee + s.totalServiceFee + s.totalInterest - s.totalExpense;
                    const balance = storeBalances[sid] || { cashBalance: 0, bankBalance: 0 };
                    s.cashBalance = balance.cashBalance;
                    s.bankBalance = balance.bankBalance;
                    s.availableCapital = balance.cashBalance + balance.bankBalance;
                }

                const statsArray = Object.values(storeStats);
                window._storeCardsData = statsArray;

                const fmt = (val) => Utils.formatCurrency(val);
                
                const buildStoreFinanceCard = (stats) => {
                    return `
<div class="store-finance-card">
    <div class="card-header">${Utils.escapeHtml(stats.name)} <span style="font-size:0.8rem;">(${Utils.escapeHtml(stats.code)})</span></div>
    <div class="card-grid">
        <div><strong>📋 ${lang === 'id' ? 'Pesanan Baru / Total' : '本月新增订单 / 单数总计'}</strong><br>${stats.monthNewOrders} / ${stats.totalOrders}</div>
        <div><strong>🔄 ${lang === 'id' ? 'Aktif / Lunas' : '进行中订单/已结清订单'}</strong><br>${stats.activeOrders} / ${stats.completedOrders}</div>
        <div><strong>💰 ${lang === 'id' ? 'Pinjaman Bulan Ini' : '本月当金'}</strong><br>${fmt(stats.monthLoanAmount)}</div>

        <div><strong>🧾 ${lang === 'id' ? 'Admin Bulan Ini / Total Admin' : '本月管理费 / 累管理费'}</strong><br>${fmt(stats.monthAdminFee)} / ${fmt(stats.totalAdminFee)}</div>
        <div><strong>🛠️ ${lang === 'id' ? 'Layanan Bulan Ini / Total Layanan' : '本月服务费 / 累计服务费'}</strong><br>${fmt(stats.monthServiceFee)} / ${fmt(stats.totalServiceFee)}</div>
        <div><strong>💸 ${lang === 'id' ? 'Bunga Bulan Ini / Total Bunga' : '本月利息 / 累计利息'}</strong><br>${fmt(stats.monthInterest)} / ${fmt(stats.totalInterest)}</div>

        <div><strong>📦 ${lang === 'id' ? 'Dana Terjamin' : '在押资金'}</strong><br>${fmt(stats.deployedCapital)}</div>
        <div><strong>💵 ${lang === 'id' ? 'Dana Tersedia' : '可动用资金'}</strong><br>${fmt(stats.availableCapital)}</div>
        <div><strong>🏦 ${lang === 'id' ? 'Brankas / Bank BNI' : '保险柜现金 / 银行BNI存款'}</strong><br>${fmt(stats.cashBalance)} / ${fmt(stats.bankBalance)}</div>

        <div><strong>📉 ${lang === 'id' ? 'Pengeluaran Bulan Ini / Total' : '本月支出 / 累支出'}</strong><br>${fmt(stats.monthExpense)} / ${fmt(stats.totalExpense)}</div>
        <div><strong>📈 ${lang === 'id' ? 'Laba Bulan Ini / Total Laba' : '本月利润 / 累计利润'}</strong><br>${fmt(stats.monthProfit)} / ${fmt(stats.totalProfit)}</div>
        <div><strong>💳 ${lang === 'id' ? 'Cicilan Pokok' : '偿还本金'}</strong><br>${fmt(stats.returnCapital)}</div>
    </div>
</div>`;
                };

                let cardsHtml = '';
                if (statsArray.length > 0) {
                    cardsHtml = '<div class="store-cards-grid">';
                    for (const stats of statsArray) {
                        cardsHtml += buildStoreFinanceCard(stats);
                    }
                    cardsHtml += '</div>';
                    
                    if (statsArray.length > 1) {
                        const grandTotal = {
                            monthNewOrders: 0, totalOrders: 0, activeOrders: 0, completedOrders: 0,
                            monthLoanAmount: 0, totalLoanAmount: 0,
                            monthAdminFee: 0, totalAdminFee: 0,
                            monthServiceFee: 0, totalServiceFee: 0,
                            monthInterest: 0, totalInterest: 0,
                            deployedCapital: 0, availableCapital: 0,
                            cashBalance: 0, bankBalance: 0,
                            monthExpense: 0, totalExpense: 0,
                            monthProfit: 0, totalProfit: 0,
                            returnCapital: 0
                        };
                        
                        for (const stats of statsArray) {
                            grandTotal.monthNewOrders += stats.monthNewOrders;
                            grandTotal.totalOrders += stats.totalOrders;
                            grandTotal.activeOrders += stats.activeOrders;
                            grandTotal.completedOrders += stats.completedOrders;
                            grandTotal.monthLoanAmount += stats.monthLoanAmount;
                            grandTotal.totalLoanAmount += stats.totalLoanAmount;
                            grandTotal.monthAdminFee += stats.monthAdminFee;
                            grandTotal.totalAdminFee += stats.totalAdminFee;
                            grandTotal.monthServiceFee += stats.monthServiceFee;
                            grandTotal.totalServiceFee += stats.totalServiceFee;
                            grandTotal.monthInterest += stats.monthInterest;
                            grandTotal.totalInterest += stats.totalInterest;
                            grandTotal.deployedCapital += stats.deployedCapital;
                            grandTotal.availableCapital += stats.availableCapital;
                            grandTotal.cashBalance += stats.cashBalance;
                            grandTotal.bankBalance += stats.bankBalance;
                            grandTotal.monthExpense += stats.monthExpense;
                            grandTotal.totalExpense += stats.totalExpense;
                            grandTotal.monthProfit += stats.monthProfit;
                            grandTotal.totalProfit += stats.totalProfit;
                            grandTotal.returnCapital += stats.returnCapital;
                        }
                        
                        cardsHtml += `
<div class="store-summary-card">
    <div class="card-header">📊 ${lang === 'id' ? 'TOTAL SEMUA TOKO' : '全部门店合计'}</div>
    <div class="card-grid summary">
        <div><strong>📋 ${lang === 'id' ? 'Pesanan Baru / Total' : '本月新增订单 / 单数总计'}</strong><br>${grandTotal.monthNewOrders} / ${grandTotal.totalOrders}</div>
        <div><strong>🔄 ${lang === 'id' ? 'Aktif / Lunas' : '进行中订单/已结清订单'}</strong><br>${grandTotal.activeOrders} / ${grandTotal.completedOrders}</div>
        <div><strong>💰 ${lang === 'id' ? 'Pinjaman Bulan Ini' : '本月当金'}</strong><br>${fmt(grandTotal.monthLoanAmount)}</div>

        <div><strong>🧾 ${lang === 'id' ? 'Admin Bulan Ini / Total Admin' : '本月管理费 / 累管理费'}</strong><br>${fmt(grandTotal.monthAdminFee)} / ${fmt(grandTotal.totalAdminFee)}</div>
        <div><strong>🛠️ ${lang === 'id' ? 'Layanan Bulan Ini / Total Layanan' : '本月服务费 / 累计服务费'}</strong><br>${fmt(grandTotal.monthServiceFee)} / ${fmt(grandTotal.totalServiceFee)}</div>
        <div><strong>💸 ${lang === 'id' ? 'Bunga Bulan Ini / Total Bunga' : '本月利息 / 累计利息'}</strong><br>${fmt(grandTotal.monthInterest)} / ${fmt(grandTotal.totalInterest)}</div>

        <div><strong>📦 ${lang === 'id' ? 'Dana Terjamin' : '在押资金'}</strong><br>${fmt(grandTotal.deployedCapital)}</div>
        <div><strong>💵 ${lang === 'id' ? 'Dana Tersedia' : '可动用资金'}</strong><br>${fmt(grandTotal.availableCapital)}</div>
        <div><strong>🏦 ${lang === 'id' ? 'Brankas / Bank BNI' : '保险柜现金 / 银行BNI存款'}</strong><br>${fmt(grandTotal.cashBalance)} / ${fmt(grandTotal.bankBalance)}</div>

        <div><strong>📉 ${lang === 'id' ? 'Pengeluaran Bulan Ini / Total' : '本月支出 / 累支出'}</strong><br>${fmt(grandTotal.monthExpense)} / ${fmt(grandTotal.totalExpense)}</div>
        <div><strong>📈 ${lang === 'id' ? 'Laba Bulan Ini / Total Laba' : '本月利润 / 累计利润'}</strong><br>${fmt(grandTotal.monthProfit)} / ${fmt(grandTotal.totalProfit)}</div>
        <div><strong>💳 ${lang === 'id' ? 'Cicilan Pokok' : '偿还本金'}</strong><br>${fmt(grandTotal.returnCapital)}</div>
    </div>
</div>`;
                    }
                }

                let totalCashBalance = 0, totalBankBalance = 0;
                for (const stats of statsArray) {
                    totalCashBalance += stats.cashBalance || 0;
                    totalBankBalance += stats.bankBalance || 0;
                }

                let storeRows = '';
                for (const store of StoreManager.stores) {
                    if (store.code === 'STORE_000') continue;
                    const isActive = store.is_active !== false;
                    const isStorePractice = store.is_practice === true;
                    let statusBadgeHtml = isActive
                        ? `<span class="badge badge--active">${lang === 'id' ? 'Aktif' : '营业中'}</span>`
                        : `<span class="badge badge--liquidated">${lang === 'id' ? 'Ditutup' : '已暂停'}</span>`;
                    if (isStorePractice) statusBadgeHtml += ` <span class="badge" style="background:#a78bfa;color:#fff;">🎓 ${lang === 'id' ? 'Latihan' : '练习'}</span>`;
                    const practiceRowStyle2 = isStorePractice ? ' style="background:#f5f3ff;opacity:0.85;"' : '';
                    storeRows += `<tr${practiceRowStyle2}>
                        <td class="store-code">${Utils.escapeHtml(store.code)}<\/td>
                        <td class="store-name">${Utils.escapeHtml(store.name)}<\/td>
                        <td class="store-address desc-cell">${Utils.escapeHtml(store.address || '-')}<\/td>
                        <td>${Utils.escapeHtml(store.phone || '-')}<\/td>
                        <td><input type="text" id="wa_${store.id}" value="${Utils.escapeHtml(store.wa_number || '')}" placeholder="628xxxxxxxxxx" style="width:140px;font-size:12px;padding:6px;" onchange="StoreManager.updateStoreWANumber('${store.id}', this.value)"><\/td>
                        <td class="text-center">${statusBadgeHtml}<\/td>
                      </tr>`;

                    let actionButtons = '';
                    actionButtons = `<button onclick="StoreManager.editStore('${store.id}')" class="btn btn--sm">✏️ ${t('edit')}</button>` +
                        (isActive
                            ? `<button onclick="StoreManager.suspendStore('${store.id}')" class="btn btn--sm btn--warning">⏸️ ${lang === 'id' ? 'Tutup Sementara' : '暂停营业'}</button>`
                            : `<button onclick="StoreManager.resumeStore('${store.id}')" class="btn btn--sm btn--success">▶️ ${lang === 'id' ? 'Buka Kembali' : '恢复营业'}</button>`);
                    const isStore004 = (store.code === 'STORE_004');
                    if (isStore004) {
                        const isPractice = store.is_practice === true;
                        const practiceLabel = isPractice ? (lang === 'id' ? 'Mode Latihan (Aktif)' : '练习模式 (已开启)') : (lang === 'id' ? 'Jadikan Toko Latihan' : '设为练习门店');
                        const practiceBtnStyle = isPractice ? 'background:#a78bfa;color:#fff;' : 'background:#ede9fe;color:#6d28d9;';
                        actionButtons += `<button onclick="StoreManager.togglePracticeMode('${store.id}', ${isPractice})" class="btn btn--sm" style="${practiceBtnStyle}">${practiceLabel}</button>`;
                    }
                    actionButtons += `<button class="btn btn--sm btn--danger" onclick="APP.deleteStore('${store.id}')">🗑️ ${t('delete')}</button>`;
                    storeRows += `<tr class="action-row"${practiceRowStyle2}>
                        <td class="action-label">${t('action')}<\/td>
                        <td colspan="5"><div class="action-buttons">${actionButtons}</div><\/td>
                      </tr>`;
                }

                const content = `
                    <style>
                        .store-cards-grid {
                            display: flex !important;
                            flex-direction: column !important;
                            gap: 16px !important;
                        }
                        .store-finance-card .card-grid,
                        .store-summary-card .card-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 10px;
                        }
                        @media screen and (max-width: 768px) {
                            .store-finance-card .card-grid,
                            .store-summary-card .card-grid {
                                grid-template-columns: 1fr !important;
                            }
                        }
                    </style>
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                        <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                            <button onclick="StoreManager.printStoreFinanceSummary()" class="btn btn--outline">🖨️ ${lang === 'id' ? 'Cetak Ringkasan' : '打印财务汇总'}</button>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h3>
                        ${cardsHtml || `<div class="empty-state"><div class="empty-state-text">${lang === 'id' ? 'Belum ada data keuangan' : '暂无财务数据'}</div></div>`}
                        <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">💡 ${lang === 'id' ? 'Format: Bulan Ini / Total' : '格式: 本月 / 累计'}</p>
                    </div>
                    
                    <div class="card cashflow-card no-print">
                        <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                        <div class="cashflow-stats">
                            <div class="cashflow-item-card">
                                <div class="label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</div>
                                <div class="value ${totalCashBalance < 0 ? 'negative' : ''}">${Utils.formatCurrency(totalCashBalance)}</div>
                            </div>
                            <div class="cashflow-item-card">
                                <div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                                <div class="value ${totalBankBalance < 0 ? 'negative' : ''}">${Utils.formatCurrency(totalBankBalance)}</div>
                            </div>
                            <div class="cashflow-item-card">
                                <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
                                <div class="value">${Utils.formatCurrency(totalCashBalance + totalBankBalance)}</div>
                            </div>
                        </div>
                        <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">💡 ${lang === 'id' ? 'Tidak termasuk Toko Latihan' : '不含练习门店'}</p>
                    </div>
                    
                    <div class="card no-print">
                        <h3>${lang === 'id' ? 'Daftar Toko' : '门店列表'}</h3>
                        <div class="table-container">
                            <table class="data-table store-table">
                                <thead>
                                    <tr>
                                        <th class="col-id">${lang === 'id' ? 'Kode' : '编码'}</th>
                                        <th class="col-name">${lang === 'id' ? 'Nama' : '名称'}</th>
                                        <th class="col-address">${lang === 'id' ? 'Alamat' : '地址'}</th>
                                        <th class="col-phone">${lang === 'id' ? 'Telepon' : '电话'}</th>
                                        <th class="col-phone">📱 WA</th>
                                        <th class="col-status text-center">${lang === 'id' ? 'Status' : '状态'}</th>
                                    </tr>
                                </thead>
                                <tbody>${storeRows}</tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="card no-print">
                        <h3>${lang === 'id' ? 'Tambah Toko Baru' : '新增门店'}</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Nama Toko' : '门店名称'} *</label>
                                <input id="newStoreName" placeholder="${lang === 'id' ? 'Contoh: Bangil, Gempol' : '例如: Bangil, Gempol'}">
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
                                <button onclick="APP.addStore()" class="btn btn--success">➕ ${lang === 'id' ? 'Tambah Toko' : '添加门店'}</button>
                            </div>
                        </div>
                    </div>`;

                return content;
            } catch (error) {
                console.error('[StoreManager] 构建页面失败:', error);
                return `<div class="page-header"><h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${Utils.t('back')}</button></div></div>
                    <div class="card" style="text-align:center;padding:40px;"><p>❌ ${lang === 'id' ? 'Gagal memuat data: ' : '加载失败：'}${error.message}</p><button onclick="StoreManager.renderStoreManagement()" class="btn btn--sm" style="margin-top:16px;">🔄 ${lang === 'id' ? 'Coba Lagi' : '重试'}</button></div>`;
            }
        },

        async renderStoreManagementHTML() { return await this.buildStoreManagementHTML(); }
    };

    // 挂载到命名空间
    JF.StoreManager = StoreManager;
    window.StoreManager = StoreManager;

    window.APP = window.APP || {};
    window.APP.addStore = async function () {
        const name = document.getElementById('newStoreName')?.value.trim();
        const address = document.getElementById('newStoreAddress')?.value.trim();
        const phone = document.getElementById('newStorePhone')?.value.trim();
        if (!name) { Utils.toast.warning(Utils.lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写'); return; }
        try {
            await StoreManager.createStore(name, address, phone);
            Utils.toast.success(Utils.lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
            await StoreManager.renderStoreManagement();
        } catch (error) { Utils.toast.error(error.message); }
    };
    window.APP.deleteStore = async function (storeId) {
        if (!await Utils.toast.confirm(Utils.t('confirm_delete'))) return;
        try { await StoreManager.deleteStore(storeId); Utils.toast.success(Utils.lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除'); await StoreManager.renderStoreManagement(); }
        catch (error) { Utils.toast.error(error.message); }
    };

})();
