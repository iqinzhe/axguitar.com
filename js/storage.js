// storage.js - v1.1（客户恢复添加去重、支出恢复添加去重）

const Storage = {

    // ==================== 备份功能 ====================
    
    async backup() {
        const lang = Utils.lang;
        const t = Utils.t;
        try {
            const loadingMsg = this._showLoading(lang === 'id' ? 'Mencadangkan data...' : '正在备份数据...');
            
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const currentStoreId = profile?.store_id;
            
            const orders = await SUPABASE.getOrders();
            const customers = await SUPABASE.getCustomers();
            
            let expensesQuery = supabaseClient.from('expenses').select('*');
            if (!isAdmin && currentStoreId) {
                expensesQuery = expensesQuery.eq('store_id', currentStoreId);
            }
            const expensesResult = await expensesQuery;
            
            let storesResult = [];
            if (isAdmin) {
                storesResult = await SUPABASE.getAllStores();
            } else if (currentStoreId) {
                const { data: storeData } = await supabaseClient
                    .from('stores')
                    .select('*')
                    .eq('id', currentStoreId);
                storesResult = storeData || [];
            }
            
            const paymentsResult = await SUPABASE.getAllPayments();
            const cashFlowsResult = await SUPABASE.getCashFlowRecords();
            
            let blacklistQuery = supabaseClient.from('blacklist').select('*');
            if (!isAdmin && currentStoreId) {
                blacklistQuery = blacklistQuery.eq('store_id', currentStoreId);
            }
            const blacklistResult = await blacklistQuery;
            
            const backupData = {
                version: '3.1',
                exported_at: new Date().toISOString(),
                exported_by: profile?.name || 'Unknown',
                exported_by_id: profile?.id,
                store_id: currentStoreId,
                is_admin: isAdmin,
                data: {
                    stores: storesResult || [],
                    orders: orders || [],
                    customers: customers || [],
                    expenses: expensesResult.data || [],
                    payments: paymentsResult || [],
                    cash_flows: cashFlowsResult || [],
                    blacklist: blacklistResult.data || []
                },
                stats: {
                    stores_count: storesResult?.length || 0,
                    orders_count: orders?.length || 0,
                    customers_count: customers?.length || 0,
                    expenses_count: expensesResult.data?.length || 0,
                    payments_count: paymentsResult?.length || 0,
                    cash_flows_count: cashFlowsResult?.length || 0,
                    blacklist_count: blacklistResult.data?.length || 0
                }
            };
            
            const filename = `jf_gadai_backup_${new Date().toISOString().split('T')[0]}_${profile?.name || 'backup'}.json`;
            
            Utils.exportToJSON(backupData, filename);
            this._hideLoading(loadingMsg);
            
            if (window.Audit) {
                await window.Audit.log('backup', JSON.stringify({
                    filename: filename,
                    stats: backupData.stats,
                    exported_at: backupData.exported_at
                }));
            }
            
            const successMsg = t('backup_complete')
                .replace('{orders}', backupData.stats.orders_count)
                .replace('{customers}', backupData.stats.customers_count);
            alert(successMsg);
        } catch (err) {
            console.error("备份失败:", err);
            alert(lang === 'id' ? '❌ Cadangan gagal: ' + err.message : '❌ 备份失败：' + err.message);
        }
    },
    
    // ==================== 恢复功能 ====================
    
    async restore(file) {
        const lang = Utils.lang;
        const t = Utils.t;
        
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            alert(lang === 'id' 
                ? '⚠️ Hanya administrator yang dapat melakukan pemulihan data.'
                : '⚠️ 只有管理员可以执行数据恢复操作。');
            return false;
        }
        
        const confirmMsg = t('restore_confirm');
        if (!confirm(confirmMsg)) return false;
        
        const confirmCode = lang === 'id' ? 'KONFIRMASI' : '确认恢复';
        const codeInput = prompt(lang === 'id'
            ? `Ketik "${confirmCode}" untuk konfirmasi pemulihan data:`
            : `请输入 "${confirmCode}" 以确认恢复操作：`);
        
        if (codeInput !== confirmCode) {
            alert(lang === 'id' ? 'Pemulihan data dibatalkan.' : '恢复操作已取消。');
            return false;
        }
        
        const loadingMsg = this._showLoading(lang === 'id' ? 'Memulihkan data...' : '正在恢复数据...');
        
        try {
            const data = await Utils.importFromJSON(file);
            
            if (!data || !data.data || !data.version) {
                throw new Error(lang === 'id' ? 'Format file cadangan tidak valid' : '备份文件格式无效');
            }
            
            if (data.version !== '2.0' && data.version !== '3.0' && data.version !== '3.1') {
                if (!confirm(lang === 'id'
                    ? `Versi file cadangan (${data.version}) tidak kompatibel dengan sistem saat ini. Lanjutkan?`
                    : `备份文件版本 (${data.version}) 与当前系统不兼容，继续恢复可能导致问题。是否继续？`)) {
                    this._hideLoading(loadingMsg);
                    return false;
                }
            }
            
            const backupData = data.data;
            const results = await this._executeRestore(backupData, profile);
            
            SUPABASE.clearCache();
            this._hideLoading(loadingMsg);
            
            if (window.Audit) {
                await window.Audit.log('restore', JSON.stringify({
                    filename: file.name,
                    results: results,
                    restored_at: new Date().toISOString()
                }));
            }
            
            const resultMsg = lang === 'id'
                ? `✅ Pemulihan selesai!\n\n📊 Statistik pemulihan:\n• Toko: ${results.stores}\n• Nasabah: ${results.customers}\n• Pesanan: ${results.orders}\n• Pengeluaran: ${results.expenses}\n• Pembayaran: ${results.payments}\n• Arus kas: ${results.cashFlows}\n• Daftar hitam: ${results.blacklist}\n\nSegarkan halaman untuk melihat data.`
                : `✅ 恢复完成！\n\n📊 恢复统计：\n• 门店: ${results.stores}\n• 客户: ${results.customers}\n• 订单: ${results.orders}\n• 支出: ${results.expenses}\n• 缴费记录: ${results.payments}\n• 资金流水: ${results.cashFlows}\n• 黑名单: ${results.blacklist}\n\n请刷新页面查看数据。`;
            
            alert(resultMsg);
            window.location.reload();
            return true;
            
        } catch (err) {
            console.error("恢复失败:", err);
            this._hideLoading(loadingMsg);
            alert(lang === 'id' ? '❌ Pemulihan gagal: ' + err.message : '❌ 恢复失败：' + err.message);
            return false;
        }
    },
    
    async _executeRestore(backupData, profile) {
        const results = {
            stores: 0, customers: 0, orders: 0, 
            expenses: 0, payments: 0, cashFlows: 0, blacklist: 0
        };
        
        if (backupData.stores && backupData.stores.length > 0) {
            const existingStores = await SUPABASE.getAllStores();
            const existingIds = new Set(existingStores.map(s => s.id));
            
            for (const store of backupData.stores) {
                if (store.code === 'STORE_000') continue;
                
                if (existingIds.has(store.id)) {
                    await supabaseClient
                        .from('stores')
                        .update({
                            name: store.name,
                            address: store.address,
                            phone: store.phone,
                            wa_number: store.wa_number
                        })
                        .eq('id', store.id);
                } else {
                    const { error } = await supabaseClient
                        .from('stores')
                        .insert({
                            code: store.code,
                            name: store.name,
                            address: store.address,
                            phone: store.phone,
                            wa_number: store.wa_number
                        });
                    if (error) console.warn('门店插入失败:', store.name, error.message);
                }
                results.stores++;
            }
        }
        
        if (backupData.customers && backupData.customers.length > 0) {
            for (const customer of backupData.customers) {
                const { data: existing } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('customer_id', customer.customer_id)
                    .maybeSingle();
                
                if (existing) {
                    await supabaseClient
                        .from('customers')
                        .update({
                            name: customer.name,
                            ktp_number: customer.ktp_number,
                            phone: customer.phone,
                            ktp_address: customer.ktp_address,
                            living_address: customer.living_address,
                            living_same_as_ktp: customer.living_same_as_ktp,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                } else {
                    const { error } = await supabaseClient
                        .from('customers')
                        .insert({
                            customer_id: customer.customer_id,
                            store_id: customer.store_id,
                            name: customer.name,
                            ktp_number: customer.ktp_number,
                            phone: customer.phone,
                            ktp_address: customer.ktp_address,
                            living_address: customer.living_address,
                            living_same_as_ktp: customer.living_same_as_ktp,
                            registered_date: customer.registered_date,
                            created_by: profile?.id
                        });
                    if (!error) results.customers++;
                }
            }
        }
        
        if (backupData.orders && backupData.orders.length > 0) {
            for (const order of backupData.orders) {
                const { data: existing } = await supabaseClient
                    .from('orders')
                    .select('id')
                    .eq('order_id', order.order_id)
                    .maybeSingle();
                
                if (existing) {
                    await supabaseClient
                        .from('orders')
                        .update({
                            customer_name: order.customer_name,
                            customer_ktp: order.customer_ktp,
                            customer_phone: order.customer_phone,
                            customer_address: order.customer_address,
                            collateral_name: order.collateral_name,
                            loan_amount: order.loan_amount,
                            admin_fee: order.admin_fee,
                            admin_fee_paid: order.admin_fee_paid,
                            service_fee_percent: order.service_fee_percent,
                            service_fee_amount: order.service_fee_amount,
                            service_fee_paid: order.service_fee_paid,
                            monthly_interest: order.monthly_interest,
                            interest_paid_months: order.interest_paid_months,
                            interest_paid_total: order.interest_paid_total,
                            next_interest_due_date: order.next_interest_due_date,
                            principal_paid: order.principal_paid,
                            principal_remaining: order.principal_remaining,
                            status: order.status,
                            notes: order.notes,
                            repayment_type: order.repayment_type,
                            repayment_term: order.repayment_term,
                            monthly_fixed_payment: order.monthly_fixed_payment,
                            agreed_interest_rate: order.agreed_interest_rate,
                            fixed_paid_months: order.fixed_paid_months,
                            overdue_days: order.overdue_days,
                            liquidation_status: order.liquidation_status,
                            updated_at: new Date().toISOString()
                        })
                        .eq('order_id', order.order_id);
                } else {
                    let customerId = null;
                    if (order.customer_id) {
                        const { data: customer } = await supabaseClient
                            .from('customers')
                            .select('id')
                            .eq('customer_id', order.customer_id)
                            .maybeSingle();
                        if (customer) customerId = customer.id;
                    }
                    
                    const { error } = await supabaseClient
                        .from('orders')
                        .insert({
                            order_id: order.order_id,
                            customer_name: order.customer_name,
                            customer_ktp: order.customer_ktp,
                            customer_phone: order.customer_phone,
                            customer_address: order.customer_address,
                            collateral_name: order.collateral_name,
                            loan_amount: order.loan_amount,
                            admin_fee: order.admin_fee,
                            admin_fee_paid: order.admin_fee_paid,
                            service_fee_percent: order.service_fee_percent,
                            service_fee_amount: order.service_fee_amount,
                            service_fee_paid: order.service_fee_paid,
                            monthly_interest: order.monthly_interest,
                            interest_paid_months: order.interest_paid_months,
                            interest_paid_total: order.interest_paid_total,
                            next_interest_due_date: order.next_interest_due_date,
                            principal_paid: order.principal_paid,
                            principal_remaining: order.principal_remaining,
                            status: order.status,
                            store_id: order.store_id,
                            customer_id: customerId,
                            notes: order.notes,
                            created_at: order.created_at,
                            is_locked: true,
                            repayment_type: order.repayment_type,
                            repayment_term: order.repayment_term,
                            monthly_fixed_payment: order.monthly_fixed_payment,
                            agreed_interest_rate: order.agreed_interest_rate,
                            fixed_paid_months: order.fixed_paid_months,
                            overdue_days: order.overdue_days,
                            liquidation_status: order.liquidation_status
                        });
                    if (!error) results.orders++;
                }
            }
        }
        
        if (backupData.payments && backupData.payments.length > 0) {
            for (const payment of backupData.payments) {
                const { data: order } = await supabaseClient
                    .from('orders')
                    .select('id')
                    .eq('order_id', payment.orders?.order_id)
                    .maybeSingle();
                
                if (order) {
                    const { data: existing } = await supabaseClient
                        .from('payment_history')
                        .select('id')
                        .eq('order_id', order.id)
                        .eq('date', payment.date)
                        .eq('type', payment.type)
                        .eq('amount', payment.amount)
                        .maybeSingle();
                    
                    if (!existing) {
                        await supabaseClient
                            .from('payment_history')
                            .insert({
                                order_id: order.id,
                                date: payment.date,
                                type: payment.type,
                                months: payment.months,
                                amount: payment.amount,
                                description: payment.description,
                                payment_method: payment.payment_method,
                                recorded_by: profile?.id
                            });
                        results.payments++;
                    }
                }
            }
        }
        
        // 修复7：expenses 添加去重逻辑（按日期+类别+金额+门店去重）
        if (backupData.expenses && backupData.expenses.length > 0) {
            for (const expense of backupData.expenses) {
                // 检查是否已存在相同的支出记录
                const { data: existing } = await supabaseClient
                    .from('expenses')
                    .select('id')
                    .eq('store_id', expense.store_id)
                    .eq('expense_date', expense.expense_date)
                    .eq('category', expense.category)
                    .eq('amount', expense.amount)
                    .maybeSingle();
                
                if (!existing) {
                    const { error } = await supabaseClient
                        .from('expenses')
                        .insert({
                            store_id: expense.store_id,
                            expense_date: expense.expense_date,
                            category: expense.category,
                            amount: expense.amount,
                            description: expense.description,
                            payment_method: expense.payment_method,
                            created_by: profile?.id,
                            is_locked: true
                        });
                    if (!error) results.expenses++;
                }
                // 如果已存在，跳过（不重复插入）
            }
        }
        
        if (backupData.cash_flows && backupData.cash_flows.length > 0) {
            for (const flow of backupData.cash_flows) {
                const { error } = await supabaseClient
                    .from('cash_flow_records')
                    .insert({
                        store_id: flow.store_id,
                        flow_type: flow.flow_type,
                        direction: flow.direction,
                        amount: flow.amount,
                        source_target: flow.source_target,
                        order_id: flow.order_id,
                        customer_id: flow.customer_id,
                        description: flow.description,
                        recorded_by: profile?.id,
                        recorded_at: flow.recorded_at,
                        reference_id: flow.reference_id,
                        is_voided: flow.is_voided || false
                    });
                if (!error) results.cashFlows++;
            }
        }
        
        if (backupData.blacklist && backupData.blacklist.length > 0) {
            for (const blacklist of backupData.blacklist) {
                const { error } = await supabaseClient
                    .from('blacklist')
                    .insert({
                        customer_id: blacklist.customer_id,
                        reason: blacklist.reason,
                        store_id: blacklist.store_id,
                        blacklisted_by: profile?.id,
                        blacklisted_at: blacklist.blacklisted_at || new Date().toISOString()
                    });
                if (!error) results.blacklist++;
            }
        }
        
        return results;
    },
    
    // ==================== 选择性恢复 ====================
    
    async restoreOrdersOnly(file) {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            alert(lang === 'id' ? 'Hanya administrator yang dapat melakukan operasi ini' : '只有管理员可以执行此操作');
            return;
        }
        
        if (!confirm(lang === 'id' ? '⚠️ Pulihkan hanya data pesanan? Pesanan yang ada akan ditimpa.' : '⚠️ 仅恢复订单数据？现有订单将被覆盖。')) return;
        
        const loadingMsg = this._showLoading(lang === 'id' ? 'Memulihkan pesanan...' : '正在恢复订单...');
        
        try {
            const data = await Utils.importFromJSON(file);
            const orders = data.data?.orders || [];
            
            let successCount = 0;
            for (const order of orders) {
                const { data: existing } = await supabaseClient
                    .from('orders')
                    .select('id')
                    .eq('order_id', order.order_id)
                    .maybeSingle();
                
                if (existing) {
                    await supabaseClient
                        .from('orders')
                        .update(order)
                        .eq('order_id', order.order_id);
                } else {
                    const { error } = await supabaseClient.from('orders').insert(order);
                    if (!error) successCount++;
                }
            }
            
            this._hideLoading(loadingMsg);
            alert(lang === 'id' 
                ? `✅ Pemulihan selesai! Berhasil memulihkan ${successCount}/${orders.length} pesanan.`
                : `✅ 恢复完成！成功恢复 ${successCount}/${orders.length} 条订单。`);
            window.location.reload();
        } catch (err) {
            this._hideLoading(loadingMsg);
            alert(lang === 'id' ? 'Pemulihan gagal: ' + err.message : '恢复失败：' + err.message);
        }
    },
    
    // 修复4：restoreCustomersOnly 添加重复检查
    async restoreCustomersOnly(file) {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            alert(lang === 'id' ? 'Hanya administrator yang dapat melakukan operasi ini' : '只有管理员可以执行此操作');
            return;
        }
        
        if (!confirm(lang === 'id' ? '⚠️ Pulihkan hanya data nasabah? Nasabah yang ada akan ditimpa.' : '⚠️ 仅恢复客户数据？现有客户将被覆盖。')) return;
        
        const loadingMsg = this._showLoading(lang === 'id' ? 'Memulihkan nasabah...' : '正在恢复客户...');
        
        try {
            const data = await Utils.importFromJSON(file);
            const customers = data.data?.customers || [];
            
            var successCount = 0;
            var skippedCount = 0;
            
            for (const customer of customers) {
                // 检查是否已存在相同 customer_id 的客户
                const { data: existing } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('customer_id', customer.customer_id)
                    .maybeSingle();
                
                if (existing) {
                    // 已存在，更新而非插入
                    const { error: updateError } = await supabaseClient
                        .from('customers')
                        .update({
                            name: customer.name,
                            ktp_number: customer.ktp_number,
                            phone: customer.phone,
                            ktp_address: customer.ktp_address,
                            living_address: customer.living_address,
                            living_same_as_ktp: customer.living_same_as_ktp,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                    if (!updateError) skippedCount++;
                } else {
                    const { error } = await supabaseClient.from('customers').insert(customer);
                    if (!error) successCount++;
                }
            }
            
            this._hideLoading(loadingMsg);
            alert(lang === 'id' 
                ? `✅ Pemulihan selesai! Berhasil memulihkan ${successCount} nasabah baru, ${skippedCount} nasabah diperbarui.`
                : `✅ 恢复完成！成功恢复 ${successCount} 条新客户记录，${skippedCount} 条已存在记录已更新。`);
            window.location.reload();
        } catch (err) {
            this._hideLoading(loadingMsg);
            alert(lang === 'id' ? 'Pemulihan gagal: ' + err.message : '恢复失败：' + err.message);
        }
    },
    
    // ==================== 导出功能 ====================
    
    async exportOrdersToCSV() {
        try {
            const orders = await SUPABASE.getOrders();
            Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
            alert(Utils.t('export_success'));
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    },

    async exportPaymentsToCSV() {
        try {
            const payments = await SUPABASE.getAllPayments();
            Utils.exportPaymentsToCSV(payments, `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`);
            alert(Utils.t('export_success'));
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    },
    
    async exportCustomersToCSV() {
        try {
            const customers = await SUPABASE.getCustomers();
            const lang = Utils.lang;
            const headers = lang === 'id'
                ? ['ID Nasabah', 'Nama', 'No. KTP', 'Telepon', 'Alamat KTP', 'Alamat Tinggal', 'Tanggal Daftar']
                : ['客户ID', '姓名', 'KTP号码', '电话', 'KTP地址', '居住地址', '注册日期'];
            
            const rows = customers.map(c => [
                c.customer_id,
                c.name,
                c.ktp_number || '-',
                c.phone,
                c.ktp_address || '-',
                c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : (c.living_address || '-'),
                c.registered_date
            ]);
            
            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `jf_gadai_customers_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            alert(Utils.t('export_success'));
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    },
    
    // ==================== 辅助函数 ====================
    
    _showLoading(message) {
        const div = document.createElement('div');
        div.id = 'backup-loading';
        div.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center;';
        div.innerHTML = `<div style="background:white; padding:20px 40px; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:12px;">
            <div class="loader" style="width:40px; height:40px; border:4px solid #e2e8f0; border-top-color:#2563eb; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <p style="margin:0;">${message}</p>
        </div>`;
        document.body.appendChild(div);
        
        if (!document.getElementById('loader-style')) {
            const style = document.createElement('style');
            style.id = 'loader-style';
            style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
        
        return div;
    },
    
    _hideLoading(element) {
        if (element && element.remove) element.remove();
    },
    
    renderBackupUI: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        if (!isAdmin) {
            alert(lang === 'id' ? 'Hanya administrator yang dapat mengakses manajemen cadangan' : '只有管理员可以访问备份管理');
            try {
                if (typeof APP !== 'undefined' && typeof APP.goBack === 'function') {
                    APP.goBack();
                } else if (typeof window.APP !== 'undefined' && typeof window.APP.goBack === 'function') {
                    window.APP.goBack();
                } else if (typeof window.APP !== 'undefined' && typeof window.APP.renderDashboard === 'function') {
                    window.APP.renderDashboard();
                } else {
                    window.location.reload();
                }
            } catch(e) {
                console.warn("返回失败:", e);
                window.location.reload();
            }
            return;
        }
        
        var pageTitle = lang === 'id' ? 'Cadangan & Pemulihan' : '备份恢复';
        var backText = lang === 'id' ? 'Kembali' : '返回';
        
        var backupTitle = lang === 'id' ? '📤 Cadangkan Data' : '📤 备份数据';
        var backupDesc = lang === 'id' 
            ? 'Cadangkan semua data (pesanan, nasabah, pengeluaran, pembayaran, dll.) ke file JSON.'
            : '备份所有数据（订单、客户、支出、缴费记录等）为 JSON 文件。';
        var backupBtnText = lang === 'id' ? '💾 Cadangkan Sekarang' : '💾 立即备份';
        
        var restoreTitle = lang === 'id' ? '📥 Pemulihan Data' : '📥 恢复数据';
        var restoreDesc = lang === 'id' 
            ? 'Pulihkan data dari file cadangan.'
            : '从备份文件恢复数据。';
        var restoreWarning = lang === 'id' 
            ? '⚠️ PERINGATAN: Akan menimpa data yang ada!'
            : '⚠️ 警告：将覆盖现有数据！';
        var restoreBtnText = lang === 'id' ? '🔄 Pulihkan Data' : '🔄 恢复数据';
        
        var selectiveTitle = lang === 'id' ? '🎯 Pemulihan Selektif' : '🎯 选择性恢复';
        var selectiveDesc = lang === 'id' 
            ? 'Pulihkan hanya jenis data tertentu.'
            : '仅恢复特定类型的数据。';
        var restoreOrdersText = lang === 'id' ? '📋 Pulihkan Pesanan' : '📋 恢复订单';
        var restoreCustomersText = lang === 'id' ? '👥 Pulihkan Nasabah' : '👥 恢复客户';
        
        var exportTitle = lang === 'id' ? '📊 Ekspor CSV' : '📊 导出 CSV';
        var exportDesc = lang === 'id' 
            ? 'Ekspor ke format CSV, dapat dibuka di Excel.'
            : '导出为 CSV 格式，可在 Excel 中打开。';
        var exportOrdersText = lang === 'id' ? '📋 Ekspor Pesanan' : '📋 导出订单';
        var exportPaymentsText = lang === 'id' ? '💰 Ekspor Pembayaran' : '💰 导出缴费';
        var exportCustomersText = lang === 'id' ? '👥 Ekspor Nasabah' : '👥 导出客户';
        
        document.getElementById("app").innerHTML = `
            <div class="page-header">
                <h2>💾 ${pageTitle}</h2>
                <div class="header-actions">
                    <button onclick="APP.goBack()" class="btn-back">↩️ ${backText}</button>
                </div>
            </div>
            
            <div class="backup-grid">
                <!-- 左上：备份数据 -->
                <div class="backup-card backup-card-primary">
                    <h3>${backupTitle}</h3>
                    <p>${backupDesc}</p>
                    <button onclick="Storage.backup()" class="btn-backup-primary">${backupBtnText}</button>
                </div>
                
                <!-- 右上：导出 CSV -->
                <div class="backup-card backup-card-secondary">
                    <h3>${exportTitle}</h3>
                    <p>${exportDesc}</p>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button onclick="Storage.exportOrdersToCSV()" class="btn-small">${exportOrdersText}</button>
                        <button onclick="Storage.exportPaymentsToCSV()" class="btn-small">${exportPaymentsText}</button>
                        <button onclick="Storage.exportCustomersToCSV()" class="btn-small">${exportCustomersText}</button>
                    </div>
                </div>
                
                <!-- 左下：恢复数据 -->
                <div class="backup-card backup-card-secondary">
                    <h3>${restoreTitle}</h3>
                    <p>${restoreDesc}</p>
                    <p class="warning-text-small">${restoreWarning}</p>
                    <input type="file" id="restoreFile" accept=".json" style="margin-bottom:10px; width:100%;">
                    <button onclick="Storage.restoreFromFile()" class="btn-restore">${restoreBtnText}</button>
                </div>
                
                <!-- 右下：选择性恢复 -->
                <div class="backup-card backup-card-secondary">
                    <h3>${selectiveTitle}</h3>
                    <p>${selectiveDesc}</p>
                    <input type="file" id="selectiveFile" accept=".json" style="margin-bottom:10px; width:100%;">
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button onclick="Storage.restoreOrdersOnlyFromFile()" class="btn-small">${restoreOrdersText}</button>
                        <button onclick="Storage.restoreCustomersOnlyFromFile()" class="btn-small">${restoreCustomersText}</button>
                    </div>
                </div>
            </div>
            
            <style>
                .backup-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
                
                .backup-card {
                    background: var(--bg-card);
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid var(--border-light);
                    transition: all 0.2s ease;
                }
                
                .backup-card-primary {
                    background: linear-gradient(135deg, #e8f4e8 0%, #d4ecd4 100%);
                    border-left: 4px solid #10b981;
                }
                
                .backup-card-primary h3 {
                    color: #065f46;
                    font-size: 1.2rem;
                    margin-bottom: 12px;
                }
                
                .backup-card-primary p {
                    color: #065f46;
                    margin-bottom: 16px;
                    line-height: 1.5;
                }
                
                .btn-backup-primary {
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s ease;
                }
                
                .btn-backup-primary:hover {
                    background: #059669;
                    transform: translateY(-1px);
                }
                
                .backup-card-secondary {
                    background: var(--bg-card);
                }
                
                .backup-card-secondary h3 {
                    font-size: 1rem;
                    margin-bottom: 10px;
                    color: var(--text-primary);
                }
                
                .backup-card-secondary p {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 12px;
                }
                
                .warning-text-small {
                    font-size: 0.7rem !important;
                    color: #e74c3c !important;
                    background: #fee2e2;
                    padding: 6px 10px;
                    border-radius: 6px;
                    margin-bottom: 12px;
                }
                
                .btn-restore {
                    background: #f59e0b;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s ease;
                }
                
                .btn-restore:hover {
                    background: #d97706;
                }
                
                @media (max-width: 768px) {
                    .backup-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }
                }
            </style>
        `;
    },
    
    restoreFromFile: async function() {
        const fileInput = document.getElementById('restoreFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? 'Pilih file cadangan terlebih dahulu' : '请选择备份文件');
            return;
        }
        await this.restore(fileInput.files[0]);
    },
    
    restoreOrdersOnlyFromFile: async function() {
        const fileInput = document.getElementById('selectiveFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? 'Pilih file cadangan terlebih dahulu' : '请选择备份文件');
            return;
        }
        await this.restoreOrdersOnly(fileInput.files[0]);
    },
    
    restoreCustomersOnlyFromFile: async function() {
        const fileInput = document.getElementById('selectiveFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? 'Pilih file cadangan terlebih dahulu' : '请选择备份文件');
            return;
        }
        await this.restoreCustomersOnly(fileInput.files[0]);
    }
};

window.Storage = Storage;
