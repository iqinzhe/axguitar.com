// store.js - v2.0 卡片式财务汇总（屏幕双列 + 打印每页4张 + 无打印戳记 + 页码）

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const StoreManager = {
        stores: [],
        _loaded: false,

        // ==================== 加载门店列表 ====================
        async loadStores(force = false) {
            console.log('[StoreManager] loadStores, force:', force);
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

        // ==================== 生成门店编码 ====================
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
            const serial = String(nextNumber).padStart(3, '0');
            return 'STORE_' + serial;
        },

        // ==================== 创建门店 ====================
        async createStore(name, address, phone) {
            const code = await StoreManager._generateStoreCode(name);
            const newStore = await SUPABASE.createStore(code, name, address, phone);
            StoreManager.stores.push(newStore);
            StoreManager.stores.sort((a, b) => a.code.localeCompare(b.code));
            return newStore;
        },

        // ==================== 更新门店 ====================
        async updateStore(id, updates) {
            const updated = await SUPABASE.updateStore(id, updates);
            const idx = StoreManager.stores.findIndex(s => s.id === id);
            if (idx !== -1) StoreManager.stores[idx] = { ...StoreManager.stores[idx], ...updated };
            return updated;
        },

        // ==================== 删除门店 ====================
        async deleteStore(id) {
            await SUPABASE.deleteStore(id);
            StoreManager.stores = StoreManager.stores.filter(s => s.id !== id);
        },

        // ==================== 暂停营业 ====================
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

        // ==================== 恢复营业 ====================
        async resumeStore(storeId) {
            const lang = Utils.lang;
            const confirmMsg = lang === 'id' ? 'Aktifkan kembali toko ini?' : '恢复此门店营业？';
            const confirmed = await Utils.toast.confirm(confirmMsg);
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

        // ==================== 编辑门店（弹窗） ====================
        async editStore(storeId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                const client = SUPABASE.getClient();
                const { data: store, error } = await client.from('stores').select('*').eq('id', storeId).single();
                if (error) throw error;

                const isActive = store.is_active !== false;
                const statusText = isActive
                    ? (lang === 'id' ? 'Aktif' : '营业中')
                    : (lang === 'id' ? 'Ditutup' : '已暂停');
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

        // ==================== 保存编辑门店 ====================
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

        // ==================== 更新门店 WA 号码 ====================
        async updateStoreWANumber(storeId, waNumber) {
            const lang = Utils.lang;
            if (!storeId) {
                console.error('updateStoreWANumber: storeId 缺失');
                return;
            }
            try {
                const client = SUPABASE.getClient();
                const { error } = await client.from('stores').update({ wa_number: waNumber || null }).eq('id', storeId);
                if (error) throw error;

                const idx = StoreManager.stores.findIndex(s => s.id === storeId);
                if (idx !== -1) StoreManager.stores[idx].wa_number = waNumber || null;

                console.log(`[StoreManager] WA号码已更新: ${storeId} -> ${waNumber}`);
                if (window._debugStoreWA) {
                    Utils.toast.success(lang === 'id' ? 'Nomor WA berhasil diperbarui' : 'WA号码已更新');
                }
            } catch (error) {
                console.error('updateStoreWANumber 失败:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal memperbarui nomor WA: ' + error.message : '更新WA号码失败：' + error.message);
            }
        },

        // ==================== 获取所有门店现金流余额（排除练习门店） ====================
        async _getAllStoreCashFlowBalances() {
            try {
                const client = SUPABASE.getClient();
                const practiceIds = await SUPABASE._getPracticeStoreIds();
                let query = client.from('cash_flow_records')
                    .select('store_id, direction, amount, source_target')
                    .eq('is_voided', false);

                if (practiceIds.length > 0) {
                    query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                }

                const { data: allFlows, error } = await query;
                if (error) {
                    console.warn('批量获取门店现金流失败:', error);
                    return {};
                }

                const balances = {};
                for (const flow of allFlows || []) {
                    const storeId = flow.store_id;
                    if (!storeId) continue;
                    const amount = flow.amount || 0;

                    if (!balances[storeId]) balances[storeId] = { cashBalance: 0, bankBalance: 0 };

                    if (flow.direction === 'inflow') {
                        if (flow.source_target === 'cash') balances[storeId].cashBalance += amount;
                        else if (flow.source_target === 'bank') balances[storeId].bankBalance += amount;
                    } else if (flow.direction === 'outflow') {
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

        // ==================== 练习模式切换 ====================
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

            // 关闭练习模式时询问是否清理数据
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
                        const errorMsg = lang === 'id'
                            ? `Gagal membersihkan data: ${cleanError.message}\n\nData mungkin tidak lengkap. Silakan hubungi administrator atau coba lagi.`
                            : `清理数据失败：${cleanError.message}\n\n数据可能不完整。请联系管理员或重试。`;
                        Utils.toast.error(errorMsg, 8000);
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

                const successMsg = newValue
                    ? (lang === 'id' ? 'Toko berhasil dijadikan Toko Latihan' : '已设为练习门店，数据不再计入总部统计')
                    : (lang === 'id' ? 'Toko kembali ke mode normal' : '已恢复为正常门店，数据重新计入总部统计');
                Utils.toast.success(successMsg);

                await StoreManager.renderStoreManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal mengubah mode: ' + error.message : '切换模式失败：' + error.message);
            }
        },

        // 增强版清理练习门店数据
        async _cleanPracticeDataEnhanced(storeId) {
            const lang = Utils.lang;
            const client = SUPABASE.getClient();
            const errors = [];

            console.log('[StoreManager] 开始增强版清理门店 ' + storeId + ' 的练习数据...');

            try {
                const { data: orders, error: orderError } = await client
                    .from('orders').select('id').eq('store_id', storeId);
                if (orderError) {
                    errors.push('查询订单失败: ' + orderError.message);
                    throw new Error('查询订单失败: ' + orderError.message);
                }

                const orderIds = (orders || []).map(o => o.id);
                console.log('[StoreManager] 找到 ' + orderIds.length + ' 个订单需要清理');

                const cleanSteps = [];

                cleanSteps.push({
                    name: 'cash_flow_records',
                    exec: async () => {
                        const { error } = await client.from('cash_flow_records').delete().eq('store_id', storeId);
                        if (error) throw error;
                    }
                });

                if (orderIds.length > 0) {
                    cleanSteps.push({
                        name: 'payment_history',
                        exec: async () => {
                            const { error } = await client.from('payment_history').delete().in('order_id', orderIds);
                            if (error) throw error;
                        }
                    });
                    cleanSteps.push({
                        name: 'reminder_logs',
                        exec: async () => {
                            const { error } = await client.from('reminder_logs').delete().in('order_id', orderIds);
                            if (error) throw error;
                        }
                    });
                    cleanSteps.push({
                        name: 'internal_transfers',
                        exec: async () => {
                            const { error } = await client.from('internal_transfers').delete().eq('store_id', storeId);
                            if (error) throw error;
                        }
                    });
                }

                cleanSteps.push({
                    name: 'orders',
                    exec: async () => {
                        const { error } = await client.from('orders').delete().eq('store_id', storeId);
                        if (error) throw error;
                    }
                });
                cleanSteps.push({
                    name: 'expenses',
                    exec: async () => {
                        const { error } = await client.from('expenses').delete().eq('store_id', storeId);
                        if (error) throw error;
                    }
                });
                cleanSteps.push({
                    name: 'customers',
                    exec: async () => {
                        const { error } = await client.from('customers').delete().eq('store_id', storeId);
                        if (error) throw error;
                    }
                });
                cleanSteps.push({
                    name: 'blacklist',
                    exec: async () => {
                        const { error } = await client.from('blacklist').delete().eq('store_id', storeId);
                        if (error) throw error;
                    }
                });

                for (const step of cleanSteps) {
                    try {
                        await step.exec();
                        console.log(`[StoreManager] ✅ ${step.name} 已清理`);
                    } catch (err) {
                        errors.push(`${step.name} 清理失败: ${err.message}`);
                        console.warn(`[StoreManager] ⚠️ ${step.name} 清理失败:`, err.message);
                    }
                }

                SUPABASE.clearCache();
                if (window.JFCache) window.JFCache.clear();

                if (errors.length > 0) {
                    const errorSummary = errors.join('; ');
                    console.warn('[StoreManager] 清理完成但有部分失败:', errorSummary);
                    throw new Error(lang === 'id'
                        ? `Pembersihan selesai dengan ${errors.length} kesalahan: ${errorSummary}`
                        : `清理完成但有 ${errors.length} 个错误: ${errorSummary}`);
                }

                console.log('[StoreManager] ✅ 门店 ' + storeId + ' 练习数据完整清理完成');
            } catch (error) {
                console.error('[StoreManager] 增强版清理练习数据异常:', error);
                throw error;
            }
        },

        // ==================== 构建门店管理 HTML（卡片式财务汇总） ====================
        async buildStoreManagementHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                await StoreManager.loadStores(true);
                console.log('[StoreManager] 门店列表加载完成:', StoreManager.stores.length, '个门店');

                const client = SUPABASE.getClient();
                
                // 获取本月起止日期
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth();
                const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
                const monthEnd = today.toISOString().split('T')[0];
                
                console.log('[StoreManager] 本月统计范围:', monthStart, '~', monthEnd);

                // 查询所有订单
                const { data: allOrders, error: orderError } = await client
                    .from('orders')
                    .select('id, store_id, status, loan_amount, created_at, admin_fee, admin_fee_paid, service_fee_amount, service_fee_paid, interest_paid_total, principal_paid');
                
                if (orderError) {
                    console.error('[StoreManager] 查询订单失败:', orderError);
                }

                // 查询所有支出
                const { data: allExpenses, error: expenseError } = await client
                    .from('expenses')
                    .select('id, store_id, amount, expense_date');
                
                if (expenseError) {
                    console.error('[StoreManager] 查询支出失败:', expenseError);
                }

                // 查询偿还本金
                const { data: returnCapitalData, error: returnError } = await client
                    .from('profit_distributions')
                    .select('store_id, amount')
                    .eq('type', 'return_capital');
                
                if (returnError) {
                    console.warn('[StoreManager] 查询偿还本金失败:', returnError.message);
                }

                // 获取现金流余额
                const storeBalances = await StoreManager._getAllStoreCashFlowBalances();

                // 构建统计数据
                const storeStats = {};
                for (const s of StoreManager.stores) {
                    storeStats[s.id] = {
                        monthNewOrders: 0, monthLoanAmount: 0, monthAdminFee: 0,
                        monthServiceFee: 0, monthInterest: 0, monthExpense: 0,
                        totalOrders: 0, activeOrders: 0, completedOrders: 0,
                        totalLoanAmount: 0, totalAdminFee: 0, totalServiceFee: 0,
                        totalInterest: 0, totalPrincipal: 0, totalExpense: 0,
                        returnCapital: 0, deployedCapital: 0
                    };
                }

                // 统计订单数据
                for (const o of (allOrders || [])) {
                    const sid = o.store_id;
                    if (!storeStats[sid]) continue;
                    
                    const stats = storeStats[sid];
                    stats.totalOrders++;
                    stats.totalLoanAmount += (o.loan_amount || 0);
                    
                    if (o.admin_fee_paid) stats.totalAdminFee += (o.admin_fee || 0);
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

                // 统计本月管理费/服务费/利息
                const allOrderIds = (allOrders || []).map(o => o.id);
                
                if (allOrderIds.length > 0) {
                    const { data: monthAdminFees } = await client
                        .from('payment_history').select('order_id, amount')
                        .eq('type', 'admin_fee').gte('date', monthStart).lte('date', monthEnd)
                        .in('order_id', allOrderIds);
                    
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
                        .eq('type', 'service_fee').gte('date', monthStart).lte('date', monthEnd)
                        .in('order_id', allOrderIds);
                    
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
                        .eq('type', 'interest').gte('date', monthStart).lte('date', monthEnd)
                        .in('order_id', allOrderIds);
                    
                    if (monthInterests) {
                        const orderStoreMap = {};
                        for (const o of (allOrders || [])) orderStoreMap[o.id] = o.store_id;
                        for (const p of monthInterests) {
                            const sid = orderStoreMap[p.order_id];
                            if (sid && storeStats[sid]) storeStats[sid].monthInterest += (p.amount || 0);
                        }
                    }
                }

                // 统计支出数据
                for (const e of (allExpenses || [])) {
                    const sid = e.store_id;
                    if (!storeStats[sid]) continue;
                    storeStats[sid].totalExpense += (e.amount || 0);
                    
                    if (e.expense_date >= monthStart && e.expense_date <= monthEnd) {
                        storeStats[sid].monthExpense += (e.amount || 0);
                    }
                }

                // 统计偿还本金
                for (const rc of (returnCapitalData || [])) {
                    const sid = rc.store_id;
                    if (!storeStats[sid]) continue;
                    storeStats[sid].returnCapital += (rc.amount || 0);
                }

                // 计算利润和可动用资金
                for (const sid of Object.keys(storeStats)) {
                    const s = storeStats[sid];
                    s.monthProfit = s.monthAdminFee + s.monthServiceFee + s.monthInterest - s.monthExpense;
                    s.totalProfit = s.totalAdminFee + s.totalServiceFee + s.totalInterest - s.totalExpense;
                    s.availableCapital = (storeBalances[sid]?.cashBalance || 0) + (storeBalances[sid]?.bankBalance || 0);
                }

                // 合计数据（仅正常门店）
                const grandTotal = {
                    monthNewOrders: 0, activeOrders: 0, completedOrders: 0,
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

                // 收集门店卡片数据（仅正常门店，排除练习门店）
                const storeCards = [];
                for (const store of StoreManager.stores) {
                    const isPractice = store.is_practice === true;
                    const stats = storeStats[store.id] || {};
                    const balance = storeBalances[store.id] || { cashBalance: 0, bankBalance: 0 };

                    if (!isPractice) {
                        grandTotal.monthNewOrders += (stats.monthNewOrders || 0);
                        grandTotal.activeOrders += (stats.activeOrders || 0);
                        grandTotal.completedOrders += (stats.completedOrders || 0);
                        grandTotal.monthLoanAmount += (stats.monthLoanAmount || 0);
                        grandTotal.totalLoanAmount += (stats.totalLoanAmount || 0);
                        grandTotal.monthAdminFee += (stats.monthAdminFee || 0);
                        grandTotal.totalAdminFee += (stats.totalAdminFee || 0);
                        grandTotal.monthServiceFee += (stats.monthServiceFee || 0);
                        grandTotal.totalServiceFee += (stats.totalServiceFee || 0);
                        grandTotal.monthInterest += (stats.monthInterest || 0);
                        grandTotal.totalInterest += (stats.totalInterest || 0);
                        grandTotal.deployedCapital += (stats.deployedCapital || 0);
                        grandTotal.availableCapital += (stats.availableCapital || 0);
                        grandTotal.cashBalance += balance.cashBalance;
                        grandTotal.bankBalance += balance.bankBalance;
                        grandTotal.monthExpense += (stats.monthExpense || 0);
                        grandTotal.totalExpense += (stats.totalExpense || 0);
                        grandTotal.monthProfit += (stats.monthProfit || 0);
                        grandTotal.totalProfit += (stats.totalProfit || 0);
                        grandTotal.returnCapital += (stats.returnCapital || 0);
                        
                        storeCards.push({
                            name: store.name,
                            code: store.code,
                            monthNewOrders: stats.monthNewOrders || 0,
                            activeOrders: stats.activeOrders || 0,
                            completedOrders: stats.completedOrders || 0,
                            monthLoanAmount: stats.monthLoanAmount || 0,
                            totalLoanAmount: stats.totalLoanAmount || 0,
                            monthAdminFee: stats.monthAdminFee || 0,
                            totalAdminFee: stats.totalAdminFee || 0,
                            monthServiceFee: stats.monthServiceFee || 0,
                            totalServiceFee: stats.totalServiceFee || 0,
                            monthInterest: stats.monthInterest || 0,
                            totalInterest: stats.totalInterest || 0,
                            deployedCapital: stats.deployedCapital || 0,
                            availableCapital: stats.availableCapital || 0,
                            cashBalance: balance.cashBalance,
                            bankBalance: balance.bankBalance,
                            monthExpense: stats.monthExpense || 0,
                            totalExpense: stats.totalExpense || 0,
                            monthProfit: stats.monthProfit || 0,
                            totalProfit: stats.totalProfit || 0,
                            returnCapital: stats.returnCapital || 0
                        });
                    }
                }
                // 保存到全局供打印使用
                window._storeCardsData = storeCards;

                // ========== 生成卡片式财务汇总（屏幕显示） ==========
                const fmt = (val) => Utils.formatCurrency(val);
                let cardsHtml = '<div class="store-cards-grid">';
                for (const s of storeCards) {
                    cardsHtml += `
<div class="store-finance-card">
    <div class="card-header">${Utils.escapeHtml(s.name)} <span style="font-size:0.8rem;">(${Utils.escapeHtml(s.code)})</span></div>
    <div class="card-grid">
        <div><strong>📋 本月新增</strong><br>${s.monthNewOrders}</div>
        <div><strong>🔄 进行中/已结清</strong><br>${s.activeOrders} / ${s.completedOrders}</div>
        <div><strong>💰 本月当金</strong><br>${fmt(s.monthLoanAmount)}</div>

        <div><strong>🧾 管理费</strong><br>${fmt(s.monthAdminFee)} / ${fmt(s.totalAdminFee)}</div>
        <div><strong>🛠️ 服务费</strong><br>${fmt(s.monthServiceFee)} / ${fmt(s.totalServiceFee)}</div>
        <div><strong>💸 利息</strong><br>${fmt(s.monthInterest)} / ${fmt(s.totalInterest)}</div>

        <div><strong>📦 在押资金</strong><br>${fmt(s.deployedCapital)}</div>
        <div><strong>💵 可动用资金</strong><br>${fmt(s.availableCapital)}</div>
        <div><strong>🏦 保险柜 / 🏧 BNI</strong><br>${fmt(s.cashBalance)} / ${fmt(s.bankBalance)}</div>

        <div><strong>📉 本月支出</strong><br>${fmt(s.monthExpense)} / ${fmt(s.totalExpense)}</div>
        <div><strong>📈 本月利润</strong><br>${fmt(s.monthProfit)} / ${fmt(s.totalProfit)}</div>
        <div><strong>💳 偿还本金</strong><br>${fmt(s.returnCapital)}</div>
    </div>
</div>`;
                }
                cardsHtml += '</div>';

                // 汇总卡片（合计）
                const summaryHtml = `
<div class="store-summary-card">
    <div class="card-header">📊 ${lang === 'id' ? 'TOTAL SEMUA TOKO' : '全部门店合计'}</div>
    <div class="card-grid summary">
        <div><strong>📋 本月新增</strong><br>${grandTotal.monthNewOrders}</div>
        <div><strong>🔄 进行中/已结清</strong><br>${grandTotal.activeOrders} / ${grandTotal.completedOrders}</div>
        <div><strong>💰 本月当金</strong><br>${fmt(grandTotal.monthLoanAmount)}</div>

        <div><strong>🧾 管理费</strong><br>${fmt(grandTotal.monthAdminFee)} / ${fmt(grandTotal.totalAdminFee)}</div>
        <div><strong>🛠️ 服务费</strong><br>${fmt(grandTotal.monthServiceFee)} / ${fmt(grandTotal.totalServiceFee)}</div>
        <div><strong>💸 利息</strong><br>${fmt(grandTotal.monthInterest)} / ${fmt(grandTotal.totalInterest)}</div>

        <div><strong>📦 在押资金</strong><br>${fmt(grandTotal.deployedCapital)}</div>
        <div><strong>💵 可动用资金</strong><br>${fmt(grandTotal.availableCapital)}</div>
        <div><strong>🏦 保险柜 / 🏧 BNI</strong><br>${fmt(grandTotal.cashBalance)} / ${fmt(grandTotal.bankBalance)}</div>

        <div><strong>📉 本月支出</strong><br>${fmt(grandTotal.monthExpense)} / ${fmt(grandTotal.totalExpense)}</div>
        <div><strong>📈 本月利润</strong><br>${fmt(grandTotal.monthProfit)} / ${fmt(grandTotal.totalProfit)}</div>
        <div><strong>💳 偿还本金</strong><br>${fmt(grandTotal.returnCapital)}</div>
    </div>
</div>`;

                // ==================== 门店列表行（保持不变） ====================
                let storeRows = '';
                if (StoreManager.stores.length === 0) {
                    storeRows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td>`;
                } else {
                    for (const store of StoreManager.stores) {
                        const isActive = store.is_active !== false;
                        const isStorePractice = store.is_practice === true;
                        const isStore000 = (store.code === 'STORE_000');

                        let statusBadgeHtml = isActive
                            ? `<span class="badge badge--active">${lang === 'id' ? 'Aktif' : '营业中'}</span>`
                            : `<span class="badge badge--liquidated">${lang === 'id' ? 'Ditutup' : '已暂停'}</span>`;
                        if (isStorePractice) {
                            statusBadgeHtml += ` <span class="badge" style="background:#a78bfa;color:#fff;">🎓 ${lang === 'id' ? 'Latihan' : '练习'}</span>`;
                        }

                        const practiceRowStyle2 = isStorePractice ? ' style="background:#f5f3ff;opacity:0.85;"' : '';

                        storeRows += `<tr${practiceRowStyle2}>
                            <td class="store-code">${Utils.escapeHtml(store.code)}</td>
                            <td class="store-name">${Utils.escapeHtml(store.name)}</td>
                            <td class="store-address desc-cell">${Utils.escapeHtml(store.address || '-')}</td>
                            <td>${Utils.escapeHtml(store.phone || '-')}</td>
                            <td><input type="text" id="wa_${store.id}" value="${Utils.escapeHtml(store.wa_number || '')}" placeholder="628xxxxxxxxxx" style="width:140px;font-size:12px;padding:6px;" onchange="StoreManager.updateStoreWANumber('${store.id}', this.value)"></td>
                            <td class="text-center">${statusBadgeHtml}</td>
                         </tr>`;

                        const isPractice = store.is_practice === true;
                        const isStore004 = (store.code === 'STORE_004');
                        
                        let actionButtons = '';
                        
                        if (isStore000) {
                            actionButtons = `<button onclick="StoreManager.editStore('${store.id}')" class="btn btn--sm">✏️ ${t('edit')}</button>`;
                            actionButtons += `<span style="color:var(--text-muted);font-size:10px;margin-left:4px;">🔒 ${lang === 'id' ? 'Toko Pusat' : '总部门店'}</span>`;
                        } else {
                            actionButtons = `<button onclick="StoreManager.editStore('${store.id}')" class="btn btn--sm">✏️ ${t('edit')}</button>` +
                                (isActive
                                    ? `<button onclick="StoreManager.suspendStore('${store.id}')" class="btn btn--sm btn--warning">⏸️ ${lang === 'id' ? 'Tutup Sementara' : '暂停营业'}</button>`
                                    : `<button onclick="StoreManager.resumeStore('${store.id}')" class="btn btn--sm btn--success">▶️ ${lang === 'id' ? 'Buka Kembali' : '恢复营业'}</button>`);
                            
                            if (isStore004) {
                                const practiceLabel = isPractice
                                    ? (lang === 'id' ? 'Mode Latihan (Aktif)' : '练习模式 (已开启)')
                                    : (lang === 'id' ? 'Jadikan Toko Latihan' : '设为练习门店');
                                const practiceBtnStyle = isPractice
                                    ? 'background:#a78bfa;color:#fff;'
                                    : 'background:#ede9fe;color:#6d28d9;';
                                const practiceBtnTitle = isPractice
                                    ? (lang === 'id' ? 'Kembalikan ke mode normal' : '恢复为正常门店')
                                    : (lang === 'id' ? 'Jadikan toko latihan (data tidak dihitung)' : '设为练习门店（数据不计入统计）');
                                
                                actionButtons += `<button onclick="StoreManager.togglePracticeMode('${store.id}', ${isPractice})" class="btn btn--sm" style="${practiceBtnStyle}" title="${practiceBtnTitle}">${practiceLabel}</button>`;
                            }
                            
                            actionButtons += `<button class="btn btn--sm btn--danger" onclick="APP.deleteStore('${store.id}')">🗑️ ${t('delete')}</button>`;
                        }

                        storeRows += `<tr class="action-row"${practiceRowStyle2}>
                            <td class="action-label">${t('action')}</td>
                            <td colspan="5"><div class="action-buttons">${actionButtons}</div></td>
                         </tr>`;
                    }
                }

                // ==================== 构建完整页面 ====================
                const content = `
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                        <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                            <button onclick="StoreManager.printStoreFinanceSummary()" class="btn btn--outline">🖨️ ${lang === 'id' ? 'Cetak Ringkasan' : '打印财务汇总'}</button>
                        </div>
                    </div>
                    <div class="card cashflow-card no-print">
                        <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                        <div class="cashflow-stats">
                            <div class="cashflow-item-card">
                                <div class="label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</div>
                                <div class="value ${grandTotal.cashBalance < 0 ? 'negative' : ''}">${Utils.formatCurrency(grandTotal.cashBalance)}</div>
                            </div>
                            <div class="cashflow-item-card">
                                <div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                                <div class="value ${grandTotal.bankBalance < 0 ? 'negative' : ''}">${Utils.formatCurrency(grandTotal.bankBalance)}</div>
                            </div>
                            <div class="cashflow-item-card">
                                <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
                                <div class="value">${Utils.formatCurrency(grandTotal.cashBalance + grandTotal.bankBalance)}</div>
                            </div>
                        </div>
                        <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">💡 ${lang === 'id' ? 'Tidak termasuk Toko Latihan' : '不含练习门店'}</p>
                    </div>
                    <div class="card">
                        <h3>📊 ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</h3>
                        ${cardsHtml}
                        ${summaryHtml}
                        <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">💡 ${lang === 'id' ? 'Format: Bulan Ini / Total' : '格式: 本月 / 累计'}</p>
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

                console.log('[StoreManager] 门店管理页面内容构建完成');
                return content;

            } catch (error) {
                console.error('[StoreManager] 构建页面失败:', error);
                const lang = Utils.lang;
                return `<div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                        <h2>🏪 ${lang === 'id' ? 'Manajemen Toko' : '门店管理'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${Utils.t('back')}</button>
                        </div>
                    </div>
                    <div class="card" style="text-align:center;padding:40px;">
                        <p style="color:var(--danger);">❌ ${lang === 'id' ? 'Gagal memuat data: ' : '加载失败：'}${error.message}</p>
                        <details style="margin-top:16px;text-align:left;">
                            <summary style="cursor:pointer;">${lang === 'id' ? 'Detail Error' : '错误详情'}</summary>
                            <pre style="margin-top:8px;padding:8px;background:#f1f5f9;border-radius:4px;overflow:auto;font-size:11px;">${Utils.escapeHtml(error.stack || error.message)}</pre>
                        </details>
                        <button onclick="StoreManager.renderStoreManagement()" class="btn btn--sm" style="margin-top:16px;">🔄 ${lang === 'id' ? 'Coba Lagi' : '重试'}</button>
                        <button onclick="APP.goBack()" class="btn btn--sm" style="margin-top:16px;margin-left:8px;">↩️ ${lang === 'id' ? 'Kembali' : '返回'}</button>
                    </div>`;
            }
        },

        // ==================== 打印门店财务汇总（卡片式，每页4张，无打印戳记，带页码） ====================
        printStoreFinanceSummary() {
            const lang = Utils.lang;
            const cards = window._storeCardsData || [];
            if (cards.length === 0) {
                Utils.toast.warning(lang === 'id' ? 'Tidak ada data toko' : '没有门店数据');
                return;
            }

            const isAdmin = PERMISSION.isAdmin();
            let storeName = '', roleText = '', userName = '';
            try {
                storeName = AUTH.getCurrentStoreName();
                roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                           AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                           (lang === 'id' ? 'Staf' : '员工');
                userName = AUTH.user?.name || '-';
            } catch (e) { /* ignore */ }

            const printDateTime = new Date().toLocaleString();
            const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const periodEnd = new Date().toISOString().split('T')[0];

            const fmt = (val) => Utils.formatCurrency(val);
            const totalCards = cards.length;
            const totalPages = Math.ceil(totalCards / 4);

            let cardsHtml = '';
            for (let i = 0; i < cards.length; i++) {
                const s = cards[i];
                cardsHtml += `
<div style="border: 1px solid #000; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; page-break-inside: avoid; background: #fff; width: 98%; margin-left: auto; margin-right: auto; font-size: 9pt;">
    <div style="font-weight: bold; font-size: 11pt; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 1px solid #ccc; text-align: center;">
        ${Utils.escapeHtml(s.name)} (${Utils.escapeHtml(s.code)})
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px; line-height: 1.5;">
        <div><strong>📋 本月新增</strong><br>${s.monthNewOrders}</div>
        <div><strong>🔄 进行中/已结清</strong><br>${s.activeOrders} / ${s.completedOrders}</div>
        <div><strong>💰 本月当金</strong><br>${fmt(s.monthLoanAmount)}</div>

        <div><strong>🧾 管理费</strong><br>${fmt(s.monthAdminFee)} / ${fmt(s.totalAdminFee)}</div>
        <div><strong>🛠️ 服务费</strong><br>${fmt(s.monthServiceFee)} / ${fmt(s.totalServiceFee)}</div>
        <div><strong>💸 利息</strong><br>${fmt(s.monthInterest)} / ${fmt(s.totalInterest)}</div>

        <div><strong>📦 在押资金</strong><br>${fmt(s.deployedCapital)}</div>
        <div><strong>💵 可动用资金</strong><br>${fmt(s.availableCapital)}</div>
        <div><strong>🏦 保险柜 / 🏧 BNI</strong><br>${fmt(s.cashBalance)} / ${fmt(s.bankBalance)}</div>

        <div><strong>📉 本月支出</strong><br>${fmt(s.monthExpense)} / ${fmt(s.totalExpense)}</div>
        <div><strong>📈 本月利润</strong><br>${fmt(s.monthProfit)} / ${fmt(s.totalProfit)}</div>
        <div><strong>💳 偿还本金</strong><br>${fmt(s.returnCapital)}</div>
    </div>
</div>`;
                // 每4张卡片分页（最后一张后不加分页）
                if ((i + 1) % 4 === 0 && i !== cards.length - 1) {
                    cardsHtml += '<div style="page-break-after: always; break-after: page;"></div>';
                }
            }

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>JF! by Gadai - ${lang === 'id' ? 'Ringkasan Keuangan Toko' : '门店财务汇总'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', 'Courier New', monospace;
            background: #fff;
            margin: 0;
            padding: 0;
        }
        /* 关键：移除浏览器默认打印戳记，添加自定义页码 */
        @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
            /* 移除所有默认页眉页脚 - 这是移除打印戳记的关键 */
            @top-center {
                content: none;
            }
            @top-left {
                content: none;
            }
            @top-right {
                content: none;
            }
            @bottom-left {
                content: none;
            }
            @bottom-right {
                content: none;
            }
            /* 添加自定义页码 - 一行显示 */
            @bottom-center {
                content: "JF! by Gadai --- 典当管理系统 --- " counter(page) "/" counter(pages);
                font-size: 8pt;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-weight: normal;
                color: #666;
            }
        }
        .print-container {
            margin: 0;
            padding: 0;
        }
        .print-header {
            text-align: center;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #1e293b;
        }
        .print-header .logo {
            font-size: 14pt;
            font-weight: bold;
            color: #0e7490;
        }
        .print-header-info {
            font-size: 9pt;
            color: #475569;
            margin-top: 4px;
        }
        /* 确保每个卡片内部不跨页 */
        .print-container > div {
            break-inside: avoid;
            page-break-inside: avoid;
        }
        /* 分页标记 */
        .page-break {
            page-break-after: always;
            break-after: page;
        }
    </style>
</head>
<body>
    <div class="print-container">
        <div class="print-header">
            <div class="logo">JF! by Gadai</div>
            <div class="print-header-info">
                🏪 ${isAdmin ? (lang === 'id' ? 'Kantor Pusat' : '总部') : (lang === 'id' ? 'Toko：' : '门店：') + Utils.escapeHtml(storeName)}
                &nbsp;|&nbsp; 👤 ${Utils.escapeHtml(roleText)}
                &nbsp;|&nbsp; 📅 ${printDateTime}
            </div>
            <div class="print-header-info" style="font-size:8pt;">
                📆 ${lang === 'id' ? 'Periode' : '统计期间'} : ${periodStart} ~ ${periodEnd}
                &nbsp;|&nbsp; 📄 ${lang === 'id' ? 'Halaman' : '第'} 1 / ${totalPages} ${lang === 'id' ? 'halaman' : '页'}
            </div>
        </div>
        ${cardsHtml}
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 100);
        };
    <\/script>
</body>
</html>
            `);
            printWindow.document.close();
        },

        // 供外壳调用的渲染函数
        async renderStoreManagementHTML() {
            return await this.buildStoreManagementHTML();
        },

        // 原有的 renderStoreManagement（兼容直接调用）
        async renderStoreManagement() {
            const contentHTML = await this.buildStoreManagementHTML();
            document.getElementById("app").innerHTML = contentHTML;
        }
    };

    // 挂载到命名空间
    JF.StoreManager = StoreManager;
    window.StoreManager = StoreManager;

    // 向下兼容 APP 方法
    window.APP = window.APP || {};
    window.APP.addStore = async function () {
        const name = document.getElementById('newStoreName')?.value.trim();
        const address = document.getElementById('newStoreAddress')?.value.trim();
        const phone = document.getElementById('newStorePhone')?.value.trim();
        if (!name) {
            Utils.toast.warning(Utils.lang === 'id' ? 'Nama toko harus diisi' : '门店名称必须填写');
            return;
        }
        try {
            await StoreManager.createStore(name, address, phone);
            Utils.toast.success(Utils.lang === 'id' ? 'Toko berhasil ditambahkan' : '门店添加成功');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal menambah toko: ' + error.message : '添加门店失败：' + error.message);
        }
    };
    window.APP.deleteStore = async function (storeId) {
        const confirmed = await Utils.toast.confirm(Utils.t('confirm_delete'));
        if (!confirmed) return;
        try {
            await StoreManager.deleteStore(storeId);
            Utils.toast.success(Utils.lang === 'id' ? 'Toko berhasil dihapus' : '门店已删除');
            await StoreManager.renderStoreManagement();
        } catch (error) {
            Utils.toast.error(Utils.lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
        }
    };

    console.log('✅ JF.StoreManager v2.0 卡片式财务汇总（屏幕双列 + 打印每页4张 + 无打印戳记 + 页码）');
})();
