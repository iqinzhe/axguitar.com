// storage.js - 完整修复版 v1.0

const Storage = {

    // ==================== 备份功能 ====================
    
    async backup() {
        const lang = Utils.lang;
        try {
            // 显示进度提示
            const loadingMsg = this._showLoading(lang === 'id' ? '正在备份数据...' : '正在备份数据...');
            
            // 获取当前用户信息
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const currentStoreId = profile?.store_id;
            
            // ========== 使用门店隔离的查询方法 ==========
            
            // 1. 订单 - 使用已有的 getOrders()（自动过滤门店）
            const orders = await SUPABASE.getOrders();
            
            // 2. 客户 - 使用已有的 getCustomers()（自动过滤门店）
            const customers = await SUPABASE.getCustomers();
            
            // 3. 支出 - 需要手动过滤（如果非管理员）
            let expensesQuery = supabaseClient.from('expenses').select('*');
            if (!isAdmin && currentStoreId) {
                expensesQuery = expensesQuery.eq('store_id', currentStoreId);
            }
            const expensesResult = await expensesQuery;
            
            // 4. 门店 - 仅管理员可见全部，非管理员只可见自己的门店
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
            
            // 5. 缴费记录 - 使用已有的 getAllPayments()（自动过滤门店）
            const paymentsResult = await SUPABASE.getAllPayments();
            
            // 6. 资金流水 - 使用已有的 getCashFlowRecords()（自动过滤门店）
            const cashFlowsResult = await SUPABASE.getCashFlowRecords();
            
            // 7. 黑名单 - 手动过滤（如果非管理员）
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
            
            // 生成文件名
            const filename = `jf_gadai_backup_${new Date().toISOString().split('T')[0]}_${profile?.name || 'backup'}.json`;
            
            Utils.exportToJSON(backupData, filename);
            this._hideLoading(loadingMsg);
            
            // 记录操作日志
            if (window.Audit) {
                await window.Audit.log('backup', JSON.stringify({
                    filename: filename,
                    stats: backupData.stats,
                    exported_at: backupData.exported_at
                }));
            }
            
            alert(lang === 'id' 
                ? `✅ 备份完成！\n\n已导出 ${backupData.stats.orders_count} 条订单，${backupData.stats.customers_count} 条客户记录。`
                : `✅ 备份完成！\n\n已导出 ${backupData.stats.orders_count} 条订单，${backupData.stats.customers_count} 条客户记录。`);
        } catch (err) {
            console.error("备份失败:", err);
            alert(lang === 'id' ? '❌ 备份失败: ' + err.message : '❌ 备份失败：' + err.message);
        }
    },
    
    // ==================== 恢复功能 ====================
    
    async restore(file) {
        const lang = Utils.lang;
        
        // 检查用户权限（只有管理员可以恢复）
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            alert(lang === 'id' 
                ? '⚠️ 只有管理员可以执行数据恢复操作。'
                : '⚠️ 只有管理员可以执行数据恢复操作。');
            return false;
        }
        
        // 第一次确认
        const confirmMsg = lang === 'id'
            ? '⚠️ 恢复数据将覆盖当前所有数据！\n\n此操作不可撤销。\n\n建议先导出当前数据作为备份。\n\n确定要继续吗？'
            : '⚠️ 恢复数据将覆盖当前所有数据！\n\n此操作不可撤销。\n\n建议先导出当前数据作为备份。\n\n确定要继续吗？';
        
        if (!confirm(confirmMsg)) return false;
        
        // 第二次确认（输入确认码）
        const confirmCode = lang === 'id' ? 'KONFIRMASI' : '确认恢复';
        const codeInput = prompt(lang === 'id'
            ? `请输入 "${confirmCode}" 以确认恢复操作：`
            : `请输入 "${confirmCode}" 以确认恢复操作：`);
        
        if (codeInput !== confirmCode) {
            alert(lang === 'id' ? '恢复操作已取消。' : '恢复操作已取消。');
            return false;
        }
        
        const loadingMsg = this._showLoading(lang === 'id' ? '正在恢复数据...' : '正在恢复数据...');
        
        try {
            const data = await Utils.importFromJSON(file);
            
            // 验证数据格式
            if (!data || !data.data || !data.version) {
                throw new Error(lang === 'id' ? '备份文件格式无效' : '备份文件格式无效');
            }
            
            // 版本兼容性检查
            if (data.version !== '2.0' && data.version !== '3.0' && data.version !== '3.1') {
                if (!confirm(lang === 'id'
                    ? `备份文件版本 (${data.version}) 与当前系统不兼容，继续恢复可能导致问题。是否继续？`
                    : `备份文件版本 (${data.version}) 与当前系统不兼容，继续恢复可能导致问题。是否继续？`)) {
                    this._hideLoading(loadingMsg);
                    return false;
                }
            }
            
            const backupData = data.data;
            
            // 开始事务性恢复
            const results = await this._executeRestore(backupData, profile);
            
            // 清除缓存
            SUPABASE.clearCache();
            
            this._hideLoading(loadingMsg);
            
            // 记录操作日志
            if (window.Audit) {
                await window.Audit.log('restore', JSON.stringify({
                    filename: file.name,
                    results: results,
                    restored_at: new Date().toISOString()
                }));
            }
            
            // 显示恢复结果
            const resultMsg = lang === 'id'
                ? `✅ 恢复完成！\n\n📊 恢复统计：\n• 门店: ${results.stores} 条\n• 客户: ${results.customers} 条\n• 订单: ${results.orders} 条\n• 支出: ${results.expenses} 条\n• 缴费记录: ${results.payments} 条\n• 资金流水: ${results.cashFlows} 条\n• 黑名单: ${results.blacklist} 条\n\n请刷新页面查看数据。`
                : `✅ 恢复完成！\n\n📊 恢复统计：\n• 门店: ${results.stores} 条\n• 客户: ${results.customers} 条\n• 订单: ${results.orders} 条\n• 支出: ${results.expenses} 条\n• 缴费记录: ${results.payments} 条\n• 资金流水: ${results.cashFlows} 条\n• 黑名单: ${results.blacklist} 条\n\n请刷新页面查看数据。`;
            
            alert(resultMsg);
            
            // 刷新当前页面
            window.location.reload();
            
            return true;
            
        } catch (err) {
            console.error("恢复失败:", err);
            this._hideLoading(loadingMsg);
            alert(lang === 'id' ? '❌ 恢复失败: ' + err.message : '❌ 恢复失败：' + err.message);
            return false;
        }
    },
    
    // 执行恢复操作
    async _executeRestore(backupData, profile) {
        const results = {
            stores: 0, customers: 0, orders: 0, 
            expenses: 0, payments: 0, cashFlows: 0, blacklist: 0
        };
        
        // 1. 恢复门店（先删除现有门店，保留总部门店）
        if (backupData.stores && backupData.stores.length > 0) {
            // 获取现有门店ID列表
            const existingStores = await SUPABASE.getAllStores();
            const existingIds = new Set(existingStores.map(s => s.id));
            
            for (const store of backupData.stores) {
                // 跳过总部门店（避免覆盖）
                if (store.code === 'STORE_000') continue;
                
                if (existingIds.has(store.id)) {
                    // 更新现有门店
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
                    // 插入新门店（不保留原ID，避免冲突）
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
        
        // 2. 恢复客户
        if (backupData.customers && backupData.customers.length > 0) {
            for (const customer of backupData.customers) {
                // 检查是否已存在（通过 customer_id）
                const { data: existing } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('customer_id', customer.customer_id)
                    .maybeSingle();
                
                if (existing) {
                    // 更新现有客户
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
                    // 插入新客户
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
        
        // 3. 恢复订单
        if (backupData.orders && backupData.orders.length > 0) {
            for (const order of backupData.orders) {
                // 检查是否已存在
                const { data: existing } = await supabaseClient
                    .from('orders')
                    .select('id')
                    .eq('order_id', order.order_id)
                    .maybeSingle();
                
                if (existing) {
                    // 更新现有订单
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
                            updated_at: new Date().toISOString()
                        })
                        .eq('order_id', order.order_id);
                } else {
                    // 查找对应的客户ID
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
                            is_locked: true
                        });
                    if (!error) results.orders++;
                }
            }
        }
        
        // 4. 恢复缴费记录
        if (backupData.payments && backupData.payments.length > 0) {
            for (const payment of backupData.payments) {
                // 查找订单ID
                const { data: order } = await supabaseClient
                    .from('orders')
                    .select('id')
                    .eq('order_id', payment.orders?.order_id)
                    .maybeSingle();
                
                if (order) {
                    // 检查是否已存在
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
        
        // 5. 恢复支出
        if (backupData.expenses && backupData.expenses.length > 0) {
            for (const expense of backupData.expenses) {
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
        
        // 6. 恢复资金流水
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
                        reference_id: flow.reference_id
                    });
                if (!error) results.cashFlows++;
            }
        }
        
        // 7. 恢复黑名单
        if (backupData.blacklist && backupData.blacklist.length > 0) {
            for (const blacklist of backupData.blacklist) {
                const { error } = await supabaseClient
                    .from('blacklist')
                    .insert({
                        customer_id: blacklist.customer_id,
                        reason: blacklist.reason,
                        store_id: blacklist.store_id,
                        blacklisted_by: profile?.id,
                        blacklisted_at: blacklist.blacklisted_at
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
            alert(lang === 'id' ? '只有管理员可以执行此操作' : '只有管理员可以执行此操作');
            return;
        }
        
        if (!confirm(lang === 'id' ? '⚠️ 仅恢复订单数据？现有订单将被覆盖。' : '⚠️ 仅恢复订单数据？现有订单将被覆盖。')) return;
        
        const loadingMsg = this._showLoading(lang === 'id' ? '正在恢复订单...' : '正在恢复订单...');
        
        try {
            const data = await Utils.importFromJSON(file);
            const orders = data.data?.orders || [];
            
            let successCount = 0;
            for (const order of orders) {
                // 检查是否已存在
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
                ? `✅ 恢复完成！成功恢复 ${successCount}/${orders.length} 条订单。`
                : `✅ 恢复完成！成功恢复 ${successCount}/${orders.length} 条订单。`);
            
            window.location.reload();
        } catch (err) {
            this._hideLoading(loadingMsg);
            alert(lang === 'id' ? '恢复失败: ' + err.message : '恢复失败：' + err.message);
        }
    },
    
    async restoreCustomersOnly(file) {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            alert(lang === 'id' ? '只有管理员可以执行此操作' : '只有管理员可以执行此操作');
            return;
        }
        
        if (!confirm(lang === 'id' ? '⚠️ 仅恢复客户数据？现有客户将被覆盖。' : '⚠️ 仅恢复客户数据？现有客户将被覆盖。')) return;
        
        const loadingMsg = this._showLoading(lang === 'id' ? '正在恢复客户...' : '正在恢复客户...');
        
        try {
            const data = await Utils.importFromJSON(file);
            const customers = data.data?.customers || [];
            
            let successCount = 0;
            for (const customer of customers) {
                const { error } = await supabaseClient.from('customers').insert(customer);
                if (!error) successCount++;
            }
            
            this._hideLoading(loadingMsg);
            
            alert(lang === 'id' 
                ? `✅ 恢复完成！成功恢复 ${successCount}/${customers.length} 条客户记录。`
                : `✅ 恢复完成！成功恢复 ${successCount}/${customers.length} 条客户记录。`);
            
            window.location.reload();
        } catch (err) {
            this._hideLoading(loadingMsg);
            alert(lang === 'id' ? '恢复失败: ' + err.message : '恢复失败：' + err.message);
        }
    },
    
    // ==================== 导出功能 ====================
    
    async exportOrdersToCSV() {
        try {
            const orders = await SUPABASE.getOrders();
            Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
            alert(Utils.lang === 'id' ? '✅ 导出成功！' : '✅ 导出成功！');
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
        }
    },

    async exportPaymentsToCSV() {
        try {
            const payments = await SUPABASE.getAllPayments();
            Utils.exportPaymentsToCSV(payments, `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`);
            alert(Utils.lang === 'id' ? '✅ 导出成功！' : '✅ 导出成功！');
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
            
            alert(lang === 'id' ? '✅ 导出成功！' : '✅ 导出成功！');
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
        
        // 添加动画样式
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
    
    // ==================== 备份管理界面 ====================
    
    renderBackupUI: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        if (!isAdmin) {
            alert(lang === 'id' ? '只有管理员可以访问备份管理' : '只有管理员可以访问备份管理');
            APP.goBack();
            return;
        }
        
        document.getElementById("app").innerHTML = `
            <div class="page-header">
                <h2>💾 ${lang === 'id' ? 'Cadangan & Pemulihan Data' : '数据备份与恢复'}</h2>
                <div class="header-actions">
                    <button onclick="APP.goBack()" class="btn-back">↩️ ${Utils.t('back')}</button>
                </div>
            </div>
            
            <div class="card">
                <h3>📤 ${lang === 'id' ? 'Ekspor Data (Backup)' : '导出数据（备份）'}</h3>
                <p>${lang === 'id' 
                    ? '导出所有数据（订单、客户、支出、缴费记录等）为 JSON 文件。'
                    : '导出所有数据（订单、客户、支出、缴费记录等）为 JSON 文件。'}</p>
                <button onclick="Storage.backup()" class="success">💾 ${lang === 'id' ? 'Backup Sekarang' : '立即备份'}</button>
            </div>
            
            <div class="card">
                <h3>📥 ${lang === 'id' ? 'Impor Data (Restore)' : '导入数据（恢复）'}</h3>
                <p class="warning-text">⚠️ ${lang === 'id' 
                    ? '恢复数据将覆盖现有数据！请确保已备份当前数据。'
                    : '恢复数据将覆盖现有数据！请确保已备份当前数据。'}</p>
                <input type="file" id="restoreFile" accept=".json" style="margin-bottom:10px;">
                <button onclick="Storage.restoreFromFile()" class="warning">🔄 ${lang === 'id' ? 'Restore Data' : '恢复数据'}</button>
            </div>
            
            <div class="card">
                <h3>🎯 ${lang === 'id' ? 'Restore Selektif' : '选择性恢复'}</h3>
                <p>${lang === 'id' 
                    ? '仅恢复特定类型的数据，不影响其他数据。'
                    : '仅恢复特定类型的数据，不影响其他数据。'}</p>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <input type="file" id="selectiveFile" accept=".json" style="margin-bottom:10px; width:100%;">
                    <button onclick="Storage.restoreOrdersOnlyFromFile()" class="btn-small">📋 ${lang === 'id' ? '恢复订单' : '恢复订单'}</button>
                    <button onclick="Storage.restoreCustomersOnlyFromFile()" class="btn-small">👥 ${lang === 'id' ? '恢复客户' : '恢复客户'}</button>
                </div>
            </div>
            
            <div class="card">
                <h3>📊 ${lang === 'id' ? 'Ekspor CSV' : '导出 CSV'}</h3>
                <p>${lang === 'id' 
                    ? '导出为 CSV 格式，可在 Excel 中打开。'
                    : '导出为 CSV 格式，可在 Excel 中打开。'}</p>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button onclick="Storage.exportOrdersToCSV()" class="btn-small">📋 ${lang === 'id' ? 'Ekspor Order' : '导出订单'}</button>
                    <button onclick="Storage.exportPaymentsToCSV()" class="btn-small">💰 ${lang === 'id' ? 'Ekspor Pembayaran' : '导出缴费'}</button>
                    <button onclick="Storage.exportCustomersToCSV()" class="btn-small">👥 ${lang === 'id' ? 'Ekspor Nasabah' : '导出客户'}</button>
                </div>
            </div>
            
            <style>
                .warning-text { color: #e74c3c; margin-bottom: 15px; }
            </style>
        `;
    },
    
    restoreFromFile: async function() {
        const fileInput = document.getElementById('restoreFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? '请选择备份文件' : '请选择备份文件');
            return;
        }
        await this.restore(fileInput.files[0]);
    },
    
    restoreOrdersOnlyFromFile: async function() {
        const fileInput = document.getElementById('selectiveFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? '请选择备份文件' : '请选择备份文件');
            return;
        }
        await this.restoreOrdersOnly(fileInput.files[0]);
    },
    
    restoreCustomersOnlyFromFile: async function() {
        const fileInput = document.getElementById('selectiveFile');
        if (!fileInput || !fileInput.files[0]) {
            alert(Utils.lang === 'id' ? '请选择备份文件' : '请选择备份文件');
            return;
        }
        await this.restoreCustomersOnly(fileInput.files[0]);
    }
};

window.Storage = Storage;

