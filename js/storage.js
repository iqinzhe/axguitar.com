// storage.js - v1.0
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
            
            const orders = await SUPABASE.getOrdersLegacy();
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
            
            // 黑名单：门店也备份全部门店的黑名单（因为需要共享）
            let blacklistQuery = supabaseClient.from('blacklist').select('*');
            // 门店备份时，黑名单只备份涉及本门店客户的记录
            // 但为了数据完整性，还是备份全部黑名单
            
            const blacklistResult = await blacklistQuery;
            
            const backupData = {
                version: '3.2',
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
                await window.Audit.logBackup(filename, backupData.stats, profile?.name);
            }
            
            const successMsg = t('backup_complete')
                .replace('{orders}', backupData.stats.orders_count)
                .replace('{customers}', backupData.stats.customers_count);
            alert(successMsg);
        } catch (err) {
            console.error("备份失败:", err);
            Utils.ErrorHandler.capture(err, 'Storage.backup');
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
            
            if (data.version !== '2.0' && data.version !== '3.0' && data.version !== '3.1' && data.version !== '3.2') {
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
                await window.Audit.logRestore(file.name, results, profile?.name);
            }
            
            const resultMsg = lang === 'id'
                ? `✅ Pemulihan selesai!\n\n📊 Statistik pemulihan:\n• Toko: ${results.stores}\n• Nasabah: ${results.customers}\n• Pesanan: ${results.orders}\n• Pengeluaran: ${results.expenses}\n• Pembayaran: ${results.payments}\n• Arus kas: ${results.cashFlows}\n• Daftar hitam: ${results.blacklist}\n\nSegarkan halaman untuk melihat data.`
                : `✅ 恢复完成！\n\n📊 恢复统计：\n• 门店: ${results.stores}\n• 客户: ${results.customers}\n• 订单: ${results.orders}\n• 支出: ${results.expenses}\n• 缴费记录: ${results.payments}\n• 资金流水: ${results.cashFlows}\n• 黑名单: ${results.blacklist}\n\n请刷新页面查看数据。`;
            
            alert(resultMsg);
            window.location.reload();
            return true;
            
        } catch (err) {
            console.error("恢复失败:", err);
            Utils.ErrorHandler.capture(err, 'Storage.restore');
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
        
        if (backupData.expenses && backupData.expenses.length > 0) {
            for (const expense of backupData.expenses) {
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
                const { data: existing } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('customer_id', customer.customer_id)
                    .maybeSingle();
                
                if (existing) {
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
            const orders = await SUPABASE.getOrdersLegacy();
            Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
            if (window.Audit) {
                await window.Audit.logExport('orders', `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`, AUTH.user?.name);
            }
            alert(Utils.t('export_success'));
        } catch (err) {
            Utils.ErrorHandler.capture(err, 'Storage.exportOrdersToCSV');
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    },

    async exportPaymentsToCSV() {
        try {
            const payments = await SUPABASE.getAllPayments();
            Utils.exportPaymentsToCSV(payments, `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`);
            if (window.Audit) {
                await window.Audit.logExport('payments', `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`, AUTH.user?.name);
            }
            alert(Utils.t('export_success'));
        } catch (err) {
            Utils.ErrorHandler.capture(err, 'Storage.exportPaymentsToCSV');
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
            
            if (window.Audit) {
                await window.Audit.logExport('customers', `jf_gadai_customers_${new Date().toISOString().split('T')[0]}.csv`, AUTH.user?.name);
            }
            alert(Utils.t('export_success'));
        } catch (err) {
            Utils.ErrorHandler.capture(err, 'Storage.exportCustomersToCSV');
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
    
    // ==================== 备份恢复 UI ====================
renderBackupUI: async function() {
    const lang = Utils.lang;
    const profile = await SUPABASE.getCurrentProfile();
    const isAdmin = profile?.role === 'admin';
    
    var pageTitle = lang === 'id' ? 'Cadangan & Pemulihan' : '备份恢复';
    var backText = lang === 'id' ? 'Kembali' : '返回';
    
    var exportTitle = lang === 'id' ? '📊 Ekspor CSV' : '📊 导出 CSV';
    var exportDesc = lang === 'id' 
        ? 'Ekspor ke format CSV, dapat dibuka di Excel.'
        : '导出为 CSV 格式，可在 Excel 中打开。';
    var exportOrdersText = lang === 'id' ? '📋 Ekspor Pesanan' : '📋 导出订单';
    var exportPaymentsText = lang === 'id' ? '💰 Ekspor Pembayaran' : '💰 导出缴费';
    var exportCustomersText = lang === 'id' ? '👥 Ekspor Nasabah' : '👥 导出客户';
    
    // ========== 门店视图：只显示备份本门店数据和导出本门店数据 ==========
    if (!isAdmin) {
        var backupTitle = lang === 'id' ? '📤 Cadangkan Data Toko' : '📤 备份本门店数据';
        var backupDesc = lang === 'id' 
            ? 'Cadangkan data toko Anda (pesanan, nasabah, pengeluaran, pembayaran) ke file JSON.'
            : '备份本门店数据（订单、客户、支出、缴费记录）为 JSON 文件。';
        var backupBtnText = lang === 'id' ? '💾 Cadangkan Sekarang' : '💾 立即备份';
        
        document.getElementById("app").innerHTML = '' +
            '<div class="page-header">' +
                '<h2>💾 ' + pageTitle + '</h2>' +
                '<div class="header-actions">' +
                    '<button onclick="APP.goBack()" class="btn-back">↩️ ' + backText + '</button>' +
                '</div>' +
            '</div>' +
            
            '<div class="backup-grid backup-grid-store">' +
                '<!-- 卡片1：备份本门店数据 -->' +
                '<div class="backup-card backup-card-store-primary">' +
                    '<h3>' + backupTitle + '</h3>' +
                    '<p>' + backupDesc + '</p>' +
                    '<button onclick="Storage.backup()" class="btn-backup-store-primary">' + backupBtnText + '</button>' +
                '</div>' +
                
                '<!-- 卡片2：导出本门店数据 -->' +
                '<div class="backup-card backup-card-store-secondary">' +
                    '<h3>' + exportTitle + '</h3>' +
                    '<p>' + exportDesc + '</p>' +
                    '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                        '<button onclick="Storage.exportOrdersToCSV()" class="btn-small">' + exportOrdersText + '</button>' +
                        '<button onclick="Storage.exportPaymentsToCSV()" class="btn-small">' + exportPaymentsText + '</button>' +
                        '<button onclick="Storage.exportCustomersToCSV()" class="btn-small">' + exportCustomersText + '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        return;
    }
    
    // ========== 管理员视图：完整功能（保持不变） ==========
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
    
    var auditTitle = lang === 'id' ? '📝 Log Audit' : '📝 审计日志';
    var auditDesc = lang === 'id'
        ? 'Lihat riwayat operasi sistem: login, pembayaran, penghapusan, dll.'
        : '查看系统操作记录：登录、缴费、删除等。';
    var auditViewBtnText = lang === 'id' ? '🔍 Lihat Log Audit' : '🔍 查看审计日志';
    
    var html = '' +
        '<div class="page-header">' +
            '<h2>💾 ' + pageTitle + '</h2>' +
            '<div class="header-actions">' +
                '<button onclick="APP.goBack()" class="btn-back">↩️ ' + backText + '</button>' +
            '</div>' +
        '</div>' +
        
        '<div class="backup-grid">' +
            '<!-- 备份数据 -->' +
            '<div class="backup-card backup-card-primary">' +
                '<h3>' + backupTitle + '</h3>' +
                '<p>' + backupDesc + '</p>' +
                '<button onclick="Storage.backup()" class="btn-backup-primary">' + backupBtnText + '</button>' +
            '</div>' +
            
            '<!-- 导出 CSV -->' +
            '<div class="backup-card backup-card-secondary">' +
                '<h3>' + exportTitle + '</h3>' +
                '<p>' + exportDesc + '</p>' +
                '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
                    '<button onclick="Storage.exportOrdersToCSV()" class="btn-small">' + exportOrdersText + '</button>' +
                    '<button onclick="Storage.exportPaymentsToCSV()" class="btn-small">' + exportPaymentsText + '</button>' +
                    '<button onclick="Storage.exportCustomersToCSV()" class="btn-small">' + exportCustomersText + '</button>' +
                '</div>' +
            '</div>' +
            
            '<!-- 恢复数据 -->' +
            '<div class="backup-card backup-card-secondary">' +
                '<h3>' + restoreTitle + '</h3>' +
                '<p>' + restoreDesc + '</p>' +
                '<p class="warning-text-small">' + restoreWarning + '</p>' +
                '<input type="file" id="restoreFile" accept=".json" style="margin-bottom:10px; width:100%;">' +
                '<button onclick="Storage.restoreFromFile()" class="btn-restore">' + restoreBtnText + '</button>' +
            '</div>' +
            
            '<!-- 审计日志 -->' +
            '<div class="backup-card backup-card-secondary">' +
                '<h3>' + auditTitle + '</h3>' +
                '<p>' + auditDesc + '</p>' +
                '<button onclick="Storage.showAuditLog()" class="btn-small primary">' + auditViewBtnText + '</button>' +
            '</div>' +
        '</div>';
    
    document.getElementById("app").innerHTML = html;
},

    restoreFromFile: async function() {
        const fileInput = document.getElementById('restoreFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? 'Pilih file cadangan terlebih dahulu' : '请选择备份文件');
            return;
        }
        await this.restore(fileInput.files[0]);
    },

    // ==================== 审计日志 ====================

    showAuditLog: async function() {
        const lang = Utils.lang;
        
        const oldModal = document.getElementById('auditLogModal');
        if (oldModal) oldModal.remove();
        
        try {
            const users = await SUPABASE.getAllUsers();
            const logs = await window.Audit.getLogs({ limit: 200 });
            
            var actionMap = {
                login_success: lang === 'id' ? '✅ Login Berhasil' : '✅ 登录成功',
                login_failure: lang === 'id' ? '❌ Login Gagal' : '❌ 登录失败',
                logout: lang === 'id' ? '🚪 Logout' : '🚪 退出',
                order_create: lang === 'id' ? '📋 Buat Pesanan' : '📋 创建订单',
                order_delete: lang === 'id' ? '🗑️ Hapus Pesanan' : '🗑️ 删除订单',
                payment: lang === 'id' ? '💰 Pembayaran' : '💰 缴费',
                user_create: lang === 'id' ? '👤 Tambah User' : '👤 新增用户',
                user_delete: lang === 'id' ? '👤 Hapus User' : '👤 删除用户',
                user_update: lang === 'id' ? '✏️ Ubah User' : '✏️ 修改用户',
                password_reset: lang === 'id' ? '🔑 Reset Password' : '🔑 重置密码',
                store_create: lang === 'id' ? '🏪 Tambah Toko' : '🏪 新增门店',
                store_update: lang === 'id' ? '✏️ Ubah Toko' : '✏️ 修改门店',
                store_delete: lang === 'id' ? '🗑️ Hapus Toko' : '🗑️ 删除门店',
                blacklist_add: lang === 'id' ? '🚫 Tambah Blacklist' : '🚫 加入黑名单',
                blacklist_remove: lang === 'id' ? '🔓 Buka Blacklist' : '🔓 解除黑名单',
                backup: lang === 'id' ? '💾 Cadangan' : '💾 备份',
                restore: lang === 'id' ? '📥 Pemulihan' : '📥 恢复',
                export: lang === 'id' ? '📎 Ekspor' : '📎 导出'
            };
            
            var rows = '';
            if (logs.length === 0) {
                rows = '<tr><td colspan="4" class="text-center">' + (lang === 'id' ? 'Tidak ada log' : '暂无记录') + '</td></tr>';
            } else {
                for (var i = 0; i < logs.length; i++) {
                    var log = logs[i];
                    var actionText = actionMap[log.action] || log.action;
                    var detailsText = '';
                    
                    try {
                        var details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                        if (details) {
                            if (details.order_id) {
                                detailsText = '📋 ' + Utils.escapeHtml(details.order_id);
                            } else if (details.username) {
                                detailsText = '👤 ' + Utils.escapeHtml(details.username);
                            } else if (details.store_name) {
                                detailsText = '🏪 ' + Utils.escapeHtml(details.store_name);
                            } else if (details.filename) {
                                detailsText = '📄 ' + Utils.escapeHtml(details.filename);
                            } else if (details.customer_id) {
                                detailsText = '👥 ' + Utils.escapeHtml(details.customer_id);
                            } else {
                                detailsText = Utils.escapeHtml(log.details || '').substring(0, 80);
                            }
                        }
                    } catch (e) {
                        detailsText = Utils.escapeHtml(String(log.details || '')).substring(0, 80);
                    }
                    
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(log.created_at) + '</td>' +
                        '<td>' + actionText + '</td>' +
                        '<td>' + Utils.escapeHtml(log.user_name || '-') + '</td>' +
                        '<td class="desc-cell">' + detailsText + '</td>' +
                    '</tr>';
                }
            }
            
            var userOptions = '<option value="">' + (lang === 'id' ? 'Semua pengguna' : '全部用户') + '</option>';
            for (var j = 0; j < users.length; j++) {
                userOptions += '<option value="' + users[j].id + '">' + Utils.escapeHtml(users[j].name) + '</option>';
            }
            
            var actionOptions = '<option value="">' + (lang === 'id' ? 'Semua aksi' : '全部操作') + '</option>';
            var actionKeys = Object.keys(actionMap);
            for (var k = 0; k < actionKeys.length; k++) {
                actionOptions += '<option value="' + actionKeys[k] + '">' + actionMap[actionKeys[k]] + '</option>';
            }
            
            var modalHtml = '' +
                '<div id="auditLogModal" class="modal-overlay">' +
                    '<div class="modal-content" style="max-width:900px;">' +
                        '<h3>📝 ' + (lang === 'id' ? 'Log Audit' : '审计日志') + '</h3>' +
                        
                        '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">' +
                            '<select id="auditFilterAction">' + actionOptions + '</select>' +
                            '<select id="auditFilterUser">' + userOptions + '</select>' +
                            '<input type="date" id="auditFilterStart" placeholder="' + (lang === 'id' ? 'Dari tanggal' : '开始日期') + '">' +
                            '<input type="date" id="auditFilterEnd" placeholder="' + (lang === 'id' ? 'Sampai tanggal' : '结束日期') + '">' +
                            '<button onclick="Storage.filterAuditLog()" class="btn-small">🔍 ' + (lang === 'id' ? 'Filter' : '筛选') + '</button>' +
                            '<button onclick="Storage.resetAuditFilter()" class="btn-small">🔄 ' + (lang === 'id' ? 'Reset' : '重置') + '</button>' +
                        '</div>' +
                        
                        '<div class="table-container" style="max-height:450px; overflow-y:auto;">' +
                            '<table class="data-table">' +
                                '<thead>' +
                                    '<tr>' +
                                        '<th class="col-date">' + (lang === 'id' ? 'Waktu' : '时间') + '</th>' +
                                        '<th class="col-type">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                                        '<th class="col-name">' + (lang === 'id' ? 'Pengguna' : '用户') + '</th>' +
                                        '<th class="col-desc">' + (lang === 'id' ? 'Detail' : '详情') + '</th>' +
                                    '</tr>' +
                                '</thead>' +
                                '<tbody id="auditLogBody">' + rows + '</tbody>' +
                            '</table>' +
                        '</div>' +
                        
                        '<div class="modal-actions">' +
                            '<button onclick="Storage.exportAuditLogCSV()" class="btn-small">📎 ' + (lang === 'id' ? 'Ekspor CSV' : '导出CSV') + '</button>' +
                            '<button onclick="document.getElementById(\'auditLogModal\').remove()" class="btn-small">✖ ' + (lang === 'id' ? 'Tutup' : '关闭') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            window._auditLogData = logs;
            window._auditUsersData = users;
            
        } catch (error) {
            console.error("showAuditLog error:", error);
            Utils.ErrorHandler.capture(error, 'Storage.showAuditLog');
            alert(lang === 'id' ? 'Gagal memuat log audit: ' + error.message : '加载审计日志失败：' + error.message);
        }
    },

    filterAuditLog: function() {
        var logs = window._auditLogData || [];
        var actionFilter = document.getElementById('auditFilterAction')?.value || '';
        var userFilter = document.getElementById('auditFilterUser')?.value || '';
        var startDate = document.getElementById('auditFilterStart')?.value || '';
        var endDate = document.getElementById('auditFilterEnd')?.value || '';
        
        var filtered = logs.filter(function(log) {
            if (actionFilter && log.action !== actionFilter) return false;
            if (userFilter && log.user_id !== userFilter) return false;
            if (startDate && log.created_at < startDate) return false;
            if (endDate && log.created_at > endDate + 'T23:59:59') return false;
            return true;
        });
        Storage._renderAuditLogTable(filtered);
    },

    resetAuditFilter: function() {
        var actionEl = document.getElementById('auditFilterAction');
        var userEl = document.getElementById('auditFilterUser');
        var startEl = document.getElementById('auditFilterStart');
        var endEl = document.getElementById('auditFilterEnd');
        if (actionEl) actionEl.value = '';
        if (userEl) userEl.value = '';
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
        Storage.filterAuditLog();
    },

    _renderAuditLogTable: function(logs) {
        var tbody = document.getElementById('auditLogBody');
        if (!tbody) return;
        
        var lang = Utils.lang;
        var actionMap = {
            login_success: lang === 'id' ? '✅ Login Berhasil' : '✅ 登录成功',
            login_failure: lang === 'id' ? '❌ Login Gagal' : '❌ 登录失败',
            logout: lang === 'id' ? '🚪 Logout' : '🚪 退出',
            order_create: lang === 'id' ? '📋 Buat Pesanan' : '📋 创建订单',
            order_delete: lang === 'id' ? '🗑️ Hapus Pesanan' : '🗑️ 删除订单',
            payment: lang === 'id' ? '💰 Pembayaran' : '💰 缴费',
            user_create: lang === 'id' ? '👤 Tambah User' : '👤 新增用户',
            user_delete: lang === 'id' ? '👤 Hapus User' : '👤 删除用户',
            user_update: lang === 'id' ? '✏️ Ubah User' : '✏️ 修改用户',
            password_reset: lang === 'id' ? '🔑 Reset Password' : '🔑 重置密码',
            store_create: lang === 'id' ? '🏪 Tambah Toko' : '🏪 新增门店',
            store_update: lang === 'id' ? '✏️ Ubah Toko' : '✏️ 修改门店',
            store_delete: lang === 'id' ? '🗑️ Hapus Toko' : '🗑️ 删除门店',
            blacklist_add: lang === 'id' ? '🚫 Tambah Blacklist' : '🚫 加入黑名单',
            blacklist_remove: lang === 'id' ? '🔓 Buka Blacklist' : '🔓 解除黑名单',
            backup: lang === 'id' ? '💾 Cadangan' : '💾 备份',
            restore: lang === 'id' ? '📥 Pemulihan' : '📥 恢复',
            export: lang === 'id' ? '📎 Ekspor' : '📎 导出'
        };
        
        var rows = '';
        if (logs.length === 0) {
            rows = '<tr><td colspan="4" class="text-center">' + (lang === 'id' ? 'Tidak ada log' : '暂无记录') + 'NonNull';
        } else {
            for (var i = 0; i < logs.length; i++) {
                var log = logs[i];
                var detailsText = '';
                try {
                    var details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                    if (details) {
                        if (details.order_id) {
                            detailsText = '📋 ' + Utils.escapeHtml(details.order_id);
                        } else if (details.username) {
                            detailsText = '👤 ' + Utils.escapeHtml(details.username);
                        } else if (details.store_name) {
                            detailsText = '🏪 ' + Utils.escapeHtml(details.store_name);
                        } else if (details.filename) {
                            detailsText = '📄 ' + Utils.escapeHtml(details.filename);
                        } else if (details.customer_id) {
                            detailsText = '👥 ' + Utils.escapeHtml(details.customer_id);
                        } else {
                            detailsText = Utils.escapeHtml(log.details || '').substring(0, 80);
                        }
                    }
                } catch (e) {
                    detailsText = Utils.escapeHtml(String(log.details || '')).substring(0, 80);
                }
                
                rows += '<tr>' +
                    '<td class="date-cell">' + Utils.formatDate(log.created_at) + '</td>' +
                    '<td>' + (actionMap[log.action] || log.action) + '</td>' +
                    '<td>' + Utils.escapeHtml(log.user_name || '-') + '</td>' +
                    '<td class="desc-cell">' + detailsText + '</td>' +
                '</tr>';
            }
        }
        tbody.innerHTML = rows;
    },

    exportAuditLogCSV: function() {
        var logs = window._auditLogData || [];
        var lang = Utils.lang;
        
        var headers = lang === 'id'
            ? ['Waktu', 'Aksi', 'Pengguna', 'Detail']
            : ['时间', '操作', '用户', '详情'];
        
        var rows = logs.map(function(log) {
            return [
                log.created_at,
                log.action,
                log.user_name || '-',
                (log.details || '').substring(0, 200)
            ];
        });
        
        var csvContent = [headers].concat(rows).map(function(row) {
            return row.map(function(cell) { return '"' + String(cell || '').replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'jf_audit_log_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        
        if (window.Audit) {
            window.Audit.logExport('audit_log', 'jf_audit_log_' + new Date().toISOString().split('T')[0] + '.csv', AUTH.user?.name);
        }
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    }
};

window.Storage = Storage;
