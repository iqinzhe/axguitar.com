// storage.js - v2.0 (JF 命名空间) 
// 备份恢复时 cash_flow 增加去重保护

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const BackupStorage = {

        // ==================== 备份功能 ====================
        async backup() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            let loadingDiv = null;
            try {
                loadingDiv = this._showLoading(lang === 'id' ? 'Mencadangkan data...' : '正在备份数据...');

                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = profile?.role === 'admin';
                const currentStoreId = profile?.store_id;

                const client = SUPABASE.getClient();

                // [优化] 所有备份数据并行加载（原为 7 次串行请求）
                let expensesQuery = client.from('expenses').select('*');
                if (!isAdmin && currentStoreId) {
                    expensesQuery = expensesQuery.eq('store_id', currentStoreId);
                }

                let storesPromise;
                if (isAdmin) {
                    storesPromise = SUPABASE.getAllStores();
                } else if (currentStoreId) {
                    storesPromise = client.from('stores').select('*').eq('id', currentStoreId)
                        .then(r => r.data || []);
                } else {
                    storesPromise = Promise.resolve([]);
                }

                const [
                    orders,
                    customers,
                    expensesResult,
                    storesResult,
                    paymentsResult,
                    cashFlowsResult,
                    blacklistResult
                ] = await Promise.all([
                    SUPABASE.getOrdersLegacy(),
                    SUPABASE.getCustomers(),
                    expensesQuery,
                    storesPromise,
                    SUPABASE.getAllPayments(),
                    SUPABASE.getCashFlowRecords(),
                    client.from('blacklist').select('*')
                ]);

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
                this._hideLoading(loadingDiv);

                if (window.Audit) {
                    await window.Audit.logBackup(filename, backupData.stats, profile?.name);
                }

                const successMsg = t('backup_complete', { orders: backupData.stats.orders_count, customers: backupData.stats.customers_count });
                Utils.toast.success(successMsg, 5000);
            } catch (err) {
                this._hideLoading(loadingDiv);
                console.error("备份失败:", err);
                Utils.ErrorHandler.capture(err, 'BackupStorage.backup');
                Utils.toast.error(lang === 'id' ? '❌ Cadangan gagal: ' + err.message : '❌ 备份失败：' + err.message);
            }
        },

        // ==================== 恢复功能 ====================
        async restore(file) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            let loadingDiv = null;

            const profile = await SUPABASE.getCurrentProfile();
            if (profile?.role !== 'admin') {
                Utils.toast.warning(lang === 'id'
                    ? '⚠️ Hanya administrator yang dapat melakukan pemulihan data.'
                    : '⚠️ 只有管理员可以执行数据恢复操作。');
                return false;
            }

            const confirmed = await Utils.toast.confirm(t('restore_confirm'));
            if (!confirmed) return false;

            const confirmCode = lang === 'id' ? 'KONFIRMASI' : '确认恢复';
            const codeInput = prompt(lang === 'id'
                ? `Ketik "${confirmCode}" untuk konfirmasi pemulihan data:`
                : `请输入 "${confirmCode}" 以确认恢复操作：`);

            if (codeInput !== confirmCode) {
                Utils.toast.warning(lang === 'id' ? 'Pemulihan data dibatalkan.' : '恢复操作已取消。');
                return false;
            }

            loadingDiv = this._showLoading(lang === 'id' ? 'Memulihkan data...' : '正在恢复数据...');

            try {
                const data = await Utils.importFromJSON(file);
                if (!data || !data.data || !data.version) {
                    throw new Error(lang === 'id' ? 'Format file cadangan tidak valid' : '备份文件格式无效');
                }

                if (data.version !== '2.0' && data.version !== '3.0' && data.version !== '3.1' && data.version !== '3.2') {
                    const confirmVersion = lang === 'id'
                        ? `Versi file cadangan (${data.version}) tidak kompatibel dengan sistem saat ini. Lanjutkan?`
                        : `备份文件版本 (${data.version}) 与当前系统不兼容，继续恢复可能导致问题。是否继续？`;
                    const versionConfirmed = await Utils.toast.confirm(confirmVersion);
                    if (!versionConfirmed) {
                        this._hideLoading(loadingDiv);
                        return false;
                    }
                }

                const backupData = data.data;
                const results = await this._executeRestore(backupData, profile);

                SUPABASE.clearCache();
                this._hideLoading(loadingDiv);

                if (window.Audit) {
                    await window.Audit.logRestore(file.name, results, profile?.name);
                }

                const resultMsg = lang === 'id'
                    ? `✅ Pemulihan selesai!\n\n📊 Statistik pemulihan:\n• Toko: ${results.stores}\n• Nasabah: ${results.customers}\n• Pesanan: ${results.orders}\n• Pengeluaran: ${results.expenses}\n• Pembayaran: ${results.payments}\n• Arus kas: ${results.cashFlows}\n• Daftar hitam: ${results.blacklist}\n\nSegarkan halaman untuk melihat data.`
                    : `✅ 恢复完成！\n\n📊 恢复统计：\n• 门店: ${results.stores}\n• 客户: ${results.customers}\n• 订单: ${results.orders}\n• 支出: ${results.expenses}\n• 缴费记录: ${results.payments}\n• 资金流水: ${results.cashFlows}\n• 黑名单: ${results.blacklist}\n\n请刷新页面查看数据。`;

                Utils.toast.success(resultMsg, 8000);
                window.location.reload();
                return true;
            } catch (err) {
                this._hideLoading(loadingDiv);
                console.error("恢复失败:", err);
                Utils.ErrorHandler.capture(err, 'BackupStorage.restore');
                Utils.toast.error(lang === 'id' ? '❌ Pemulihan gagal: ' + err.message : '❌ 恢复失败：' + err.message);
                return false;
            }
        },

        async _executeRestore(backupData, profile) {
            const results = { stores: 0, customers: 0, orders: 0, expenses: 0, payments: 0, cashFlows: 0, blacklist: 0 };
            const client = SUPABASE.getClient();

            if (backupData.stores?.length > 0) {
                const existingStores = await SUPABASE.getAllStores();
                const existingIds = new Set(existingStores.map(s => s.id));
                for (const store of backupData.stores) {
                    if (store.code === 'STORE_000') continue;
                    if (existingIds.has(store.id)) {
                        await client.from('stores').update({
                            name: store.name, address: store.address, phone: store.phone, wa_number: store.wa_number
                        }).eq('id', store.id);
                    } else {
                        await client.from('stores').insert({
                            code: store.code, name: store.name, address: store.address, phone: store.phone, wa_number: store.wa_number
                        });
                    }
                    results.stores++;
                }
            }

            if (backupData.customers?.length > 0) {
                for (const customer of backupData.customers) {
                    const { data: existing } = await client.from('customers').select('id').eq('customer_id', customer.customer_id).maybeSingle();
                    if (existing) {
                        await client.from('customers').update({
                            name: customer.name, ktp_number: customer.ktp_number, phone: customer.phone,
                            ktp_address: customer.ktp_address, living_address: customer.living_address,
                            living_same_as_ktp: customer.living_same_as_ktp, updated_at: new Date().toISOString()
                        }).eq('id', existing.id);
                    } else {
                        const { error } = await client.from('customers').insert({
                            customer_id: customer.customer_id, store_id: customer.store_id,
                            name: customer.name, ktp_number: customer.ktp_number, phone: customer.phone,
                            ktp_address: customer.ktp_address, living_address: customer.living_address,
                            living_same_as_ktp: customer.living_same_as_ktp,
                            registered_date: customer.registered_date, created_by: profile?.id
                        });
                        if (!error) results.customers++;
                    }
                }
            }

            if (backupData.orders?.length > 0) {
                for (const order of backupData.orders) {
                    const { data: existing } = await client.from('orders').select('id').eq('order_id', order.order_id).maybeSingle();
                    if (existing) {
                        await client.from('orders').update({
                            customer_name: order.customer_name, customer_ktp: order.customer_ktp,
                            customer_phone: order.customer_phone, customer_address: order.customer_address,
                            collateral_name: order.collateral_name, loan_amount: order.loan_amount,
                            admin_fee: order.admin_fee, admin_fee_paid: order.admin_fee_paid,
                            service_fee_percent: order.service_fee_percent, service_fee_amount: order.service_fee_amount,
                            service_fee_paid: order.service_fee_paid, monthly_interest: order.monthly_interest,
                            interest_paid_months: order.interest_paid_months, interest_paid_total: order.interest_paid_total,
                            next_interest_due_date: order.next_interest_due_date, principal_paid: order.principal_paid,
                            principal_remaining: order.principal_remaining, status: order.status, notes: order.notes,
                            repayment_type: order.repayment_type, repayment_term: order.repayment_term,
                            monthly_fixed_payment: order.monthly_fixed_payment, agreed_interest_rate: order.agreed_interest_rate,
                            fixed_paid_months: order.fixed_paid_months, overdue_days: order.overdue_days,
                            liquidation_status: order.liquidation_status, updated_at: new Date().toISOString()
                        }).eq('order_id', order.order_id);
                    } else {
                        let customerId = null;
                        if (order.customer_id) {
                            const { data: customer } = await client.from('customers').select('id').eq('customer_id', order.customer_id).maybeSingle();
                            if (customer) customerId = customer.id;
                        }
                        const { error } = await client.from('orders').insert({
                            order_id: order.order_id, customer_name: order.customer_name,
                            customer_ktp: order.customer_ktp, customer_phone: order.customer_phone,
                            customer_address: order.customer_address, collateral_name: order.collateral_name,
                            loan_amount: order.loan_amount, admin_fee: order.admin_fee,
                            admin_fee_paid: order.admin_fee_paid, service_fee_percent: order.service_fee_percent,
                            service_fee_amount: order.service_fee_amount, service_fee_paid: order.service_fee_paid,
                            monthly_interest: order.monthly_interest, interest_paid_months: order.interest_paid_months,
                            interest_paid_total: order.interest_paid_total, next_interest_due_date: order.next_interest_due_date,
                            principal_paid: order.principal_paid, principal_remaining: order.principal_remaining,
                            status: order.status, store_id: order.store_id, customer_id: customerId,
                            notes: order.notes, created_at: order.created_at, is_locked: true,
                            repayment_type: order.repayment_type, repayment_term: order.repayment_term,
                            monthly_fixed_payment: order.monthly_fixed_payment, agreed_interest_rate: order.agreed_interest_rate,
                            fixed_paid_months: order.fixed_paid_months, overdue_days: order.overdue_days,
                            liquidation_status: order.liquidation_status
                        });
                        if (!error) results.orders++;
                    }
                }
            }

            if (backupData.payments?.length > 0) {
                for (const payment of backupData.payments) {
                    const { data: order } = await client.from('orders').select('id').eq('order_id', payment.orders?.order_id).maybeSingle();
                    if (order) {
                        const { data: existing } = await client.from('payment_history').select('id')
                            .eq('order_id', order.id).eq('date', payment.date).eq('type', payment.type).eq('amount', payment.amount).maybeSingle();
                        if (!existing) {
                            await client.from('payment_history').insert({
                                order_id: order.id, date: payment.date, type: payment.type, months: payment.months,
                                amount: payment.amount, description: payment.description, payment_method: payment.payment_method,
                                recorded_by: profile?.id
                            });
                            results.payments++;
                        }
                    }
                }
            }

            if (backupData.expenses?.length > 0) {
                for (const expense of backupData.expenses) {
                    const { data: existing } = await client.from('expenses').select('id')
                        .eq('store_id', expense.store_id).eq('expense_date', expense.expense_date)
                        .eq('category', expense.category).eq('amount', expense.amount).maybeSingle();
                    if (!existing) {
                        await client.from('expenses').insert({
                            store_id: expense.store_id, expense_date: expense.expense_date,
                            category: expense.category, amount: expense.amount, description: expense.description,
                            payment_method: expense.payment_method, created_by: profile?.id, is_locked: true
                        });
                        results.expenses++;
                    }
                }
            }

            // cash_flow 恢复时增加去重保护
            if (backupData.cash_flows?.length > 0) {
                for (const flow of backupData.cash_flows) {
                    let isDuplicate = false;
                    
                    try {
                        let dupQuery = client.from('cash_flow_records').select('id');
                        
                        if (flow.reference_id) {
                            dupQuery = dupQuery.eq('reference_id', flow.reference_id);
                        } 
                        else if (flow.store_id && flow.recorded_at && flow.amount && flow.flow_type) {
                            const recordedDate = new Date(flow.recorded_at);
                            const startTime = new Date(recordedDate.getTime() - 10000).toISOString();
                            const endTime = new Date(recordedDate.getTime() + 10000).toISOString();
                            
                            dupQuery = dupQuery
                                .eq('store_id', flow.store_id)
                                .eq('flow_type', flow.flow_type)
                                .eq('amount', flow.amount)
                                .gte('recorded_at', startTime)
                                .lte('recorded_at', endTime);
                        }
                        else if (flow.store_id && flow.description && flow.amount) {
                            dupQuery = dupQuery
                                .eq('store_id', flow.store_id)
                                .eq('amount', flow.amount)
                                .ilike('description', flow.description);
                        }
                        
                        const { data: existing, error: dupError } = await dupQuery.limit(1);
                        if (!dupError && existing && existing.length > 0) {
                            isDuplicate = true;
                        }
                    } catch (dupCheckError) {
                        console.warn('[Restore] 去重检查失败，继续插入:', dupCheckError.message);
                        isDuplicate = false;
                    }
                    
                    if (!isDuplicate) {
                        const { error } = await client.from('cash_flow_records').insert({
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
            }

            if (backupData.blacklist?.length > 0) {
                for (const bl of backupData.blacklist) {
                    const { error } = await client.from('blacklist').insert({
                        customer_id: bl.customer_id, reason: bl.reason, store_id: bl.store_id,
                        blacklisted_by: profile?.id, blacklisted_at: bl.blacklisted_at || new Date().toISOString()
                    });
                    if (!error) results.blacklist++;
                }
            }

            return results;
        },

        // ==================== 导出功能 ====================
        async exportOrdersToCSV() {
            try {
                const orders = await SUPABASE.getOrdersLegacy();
                Utils.exportToCSV(orders, `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`);
                if (window.Audit) await window.Audit.logExport('orders', `jf_gadai_orders_${new Date().toISOString().split('T')[0]}.csv`, AUTH.user?.name);
                Utils.toast.success(Utils.t('export_success'));
            } catch (err) {
                Utils.ErrorHandler.capture(err, 'BackupStorage.exportOrdersToCSV');
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
            }
        },

        async exportPaymentsToCSV() {
            try {
                const payments = await SUPABASE.getAllPayments();
                Utils.exportToCSV(payments, `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`);
                if (window.Audit) await window.Audit.logExport('payments', `jf_gadai_payments_${new Date().toISOString().split('T')[0]}.csv`, AUTH.user?.name);
                Utils.toast.success(Utils.t('export_success'));
            } catch (err) {
                Utils.ErrorHandler.capture(err, 'BackupStorage.exportPaymentsToCSV');
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
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
                    c.customer_id, c.name, c.ktp_number || '-', c.phone,
                    c.ktp_address || '-', c.living_same_as_ktp ? (lang === 'id' ? 'Sama KTP' : '同KTP') : (c.living_address || '-'), c.registered_date
                ]);
                const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `jf_gadai_customers_${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                if (window.Audit) await window.Audit.logExport('customers', a.download, AUTH.user?.name);
                Utils.toast.success(Utils.t('export_success'));
            } catch (err) {
                Utils.ErrorHandler.capture(err, 'BackupStorage.exportCustomersToCSV');
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal ekspor: ' + err.message : '导出失败：' + err.message);
            }
        },

        async exportCashFlowToCSV() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            try {
                const client = SUPABASE.getClient();
                let query = client.from('cash_flow_records').select('*, stores(name)').eq('is_voided', false).order('recorded_at', { ascending: false });
                if (!isAdmin && profile?.store_id) query = query.eq('store_id', profile.store_id);
                const { data: flows, error } = await query;
                if (error) throw error;
                const typeMap = {
                    loan_disbursement: lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放',
                    admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
                    service_fee: lang === 'id' ? 'Service Fee' : '服务费',
                    interest: lang === 'id' ? 'Bunga' : '利息',
                    principal: lang === 'id' ? 'Pokok' : '本金',
                    expense: lang === 'id' ? 'Pengeluaran' : '运营支出',
                };
                const headers = lang === 'id' ? ['Tanggal', 'Tipe', 'Arah', 'Sumber', 'Jumlah', 'Deskripsi', 'Toko'] : ['日期', '类型', '方向', '来源/去向', '金额', '描述', '门店'];
                const rows = (flows || []).map(flow => [
                    Utils.formatDate(flow.flow_date || flow.recorded_at), typeMap[flow.flow_type] || flow.flow_type,
                    flow.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出'),
                    flow.source_target === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'),
                    flow.amount, flow.description || '-', isAdmin ? (flow.stores?.name || '-') : ''
                ]);
                const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `jf_cashflow_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                if (window.Audit) await window.Audit.logExport('cash_flow', a.download, profile?.name);
                Utils.toast.success(lang === 'id' ? '✅ Ekspor arus kas berhasil!' : '✅ 资金流水导出成功！');
            } catch (err) {
                console.error("exportCashFlowToCSV error:", err);
                Utils.toast.error(lang === 'id' ? 'Gagal ekspor arus kas' : '资金流水导出失败');
            }
        },

        async exportExpensesToCSV() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            try {
                const client = SUPABASE.getClient();
                let query = client.from('expenses').select('*, stores(name)').order('expense_date', { ascending: false });
                if (!isAdmin && profile?.store_id) query = query.eq('store_id', profile.store_id);
                const { data: expenses, error } = await query;
                if (error) throw error;
                const methodMap = { cash: lang === 'id' ? 'Tunai' : '现金', bank: lang === 'id' ? 'Bank BNI' : '银行BNI' };
                const headers = lang === 'id' ? ['Tanggal', 'Kategori', 'Jumlah', 'Metode', 'Deskripsi', 'Toko'] : ['日期', '类别', '金额', '支付方式', '描述', '门店'];
                const rows = (expenses || []).map(exp => [
                    Utils.formatDate(exp.expense_date), exp.category || '-', exp.amount,
                    methodMap[exp.payment_method] || exp.payment_method, exp.description || '-',
                    isAdmin ? (exp.stores?.name || '-') : ''
                ]);
                const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `jf_expenses_${new Date().toISOString().split('T')[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                if (window.Audit) await window.Audit.logExport('expenses', a.download, profile?.name);
                Utils.toast.success(lang === 'id' ? '✅ Ekspor pengeluaran berhasil!' : '✅ 运营支出导出成功！');
            } catch (err) {
                console.error("exportExpensesToCSV error:", err);
                Utils.toast.error(lang === 'id' ? 'Gagal ekspor pengeluaran' : '运营支出导出失败');
            }
        },

        // ==================== 文件选择处理 ====================
        onFileSelected(input) {
            const fileNameSpan = document.getElementById('restoreFileName');
            if (!fileNameSpan) return;
            const lang = Utils.lang;
            if (input.files && input.files.length > 0) {
                fileNameSpan.textContent = '📄 ' + input.files[0].name;
            } else {
                fileNameSpan.textContent = lang === 'id' ? 'Tidak ada file dipilih' : '未选择文件';
            }
        },

        // ==================== 备份恢复 UI ====================
        async renderBackupUI() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';

            const pageTitle = lang === 'id' ? 'Cadangan & Pemulihan' : '备份恢复';
            const backText = lang === 'id' ? 'Kembali' : '返回';

            if (!isAdmin) {
                document.getElementById("app").innerHTML =
                    `<div class="page-header"><h2>💾 ${pageTitle}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn-back">↩️ ${backText}</button></div></div>
                    <div class="backup-grid backup-grid-store">
                        <div class="backup-card backup-card-store-primary">
                            <h3>📤 ${lang === 'id' ? 'Cadangkan Data Toko' : '备份本门店数据'}</h3>
                            <p>${lang === 'id' ? 'Cadangkan data toko Anda (pesanan, nasabah, pengeluaran, pembayaran) ke file JSON.' : '备份本门店数据（订单、客户、支出、缴费记录）为 JSON 文件。'}</p>
                            <button onclick="BackupStorage.backup()" class="btn-backup-store-primary">${lang === 'id' ? '💾 Cadangkan Sekarang' : '💾 立即备份'}</button>
                        </div>
                        <div class="backup-card backup-card-store-secondary">
                            <h3>📊 ${lang === 'id' ? 'Ekspor Data' : '导出数据'}</h3>
                            <p>${lang === 'id' ? 'Ekspor data ke format CSV' : '导出数据为 CSV 格式'}</p>
                            <div style="margin-bottom:12px;"><div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-secondary);">${lang === 'id' ? '📁 Data Bisnis' : '📁 业务数据'}</div>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                    <button onclick="BackupStorage.exportOrdersToCSV()" class="btn-small">📋 ${lang === 'id' ? 'Ekspor Pesanan' : '导出订单'}</button>
                                    <button onclick="BackupStorage.exportPaymentsToCSV()" class="btn-small">💰 ${lang === 'id' ? 'Ekspor Pembayaran' : '导出缴费'}</button>
                                    <button onclick="BackupStorage.exportCustomersToCSV()" class="btn-small">👥 ${lang === 'id' ? 'Ekspor Nasabah' : '导出客户'}</button>
                                </div>
                            </div>
                            <div><div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-secondary);">💰 ${lang === 'id' ? 'Data Keuangan' : '财务数据'}</div>
                                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                    <button onclick="BackupStorage.exportCashFlowToCSV()" class="btn-small">💸 ${lang === 'id' ? 'Ekspor Arus Kas' : '导出资金流水'}</button>
                                    <button onclick="BackupStorage.exportExpensesToCSV()" class="btn-small">📝 ${lang === 'id' ? 'Ekspor Pengeluaran' : '导出运营支出'}</button>
                                </div>
                            </div>
                        </div>
                    </div>`;
                return;
            }

            document.getElementById("app").innerHTML =
                `<div class="page-header"><h2>💾 ${pageTitle}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn-back">↩️ ${backText}</button></div></div>
                <div class="backup-grid">
                    <div class="backup-card backup-card-primary">
                        <h3>📤 ${lang === 'id' ? 'Cadangkan Data' : '备份数据'}</h3>
                        <p>${lang === 'id' ? 'Cadangkan semua data (pesanan, nasabah, pengeluaran, pembayaran, dll.) ke file JSON.' : '备份所有数据（订单、客户、支出、缴费记录等）为 JSON 文件。'}</p>
                        <button onclick="BackupStorage.backup()" class="btn-backup-primary">💾 ${lang === 'id' ? 'Cadangkan Sekarang' : '立即备份'}</button>
                    </div>
                    <div class="backup-card backup-card-secondary">
                        <h3>📊 ${lang === 'id' ? 'Ekspor Data' : '导出数据'}</h3>
                        <p>${lang === 'id' ? 'Ekspor data ke format CSV, dapat dibuka di Excel.' : '导出为 CSV 格式，可在 Excel 中打开。'}</p>
                        <div style="margin-bottom:16px;"><div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-secondary);border-left:3px solid var(--primary);padding-left:8px;">📁 ${lang === 'id' ? 'Data Bisnis' : '业务数据'}</div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button onclick="BackupStorage.exportOrdersToCSV()" class="btn-small">📋 ${lang === 'id' ? 'Ekspor Pesanan' : '导出订单'}</button>
                                <button onclick="BackupStorage.exportPaymentsToCSV()" class="btn-small">💰 ${lang === 'id' ? 'Ekspor Pembayaran' : '导出缴费'}</button>
                                <button onclick="BackupStorage.exportCustomersToCSV()" class="btn-small">👥 ${lang === 'id' ? 'Ekspor Nasabah' : '导出客户'}</button>
                            </div>
                        </div>
                        <div><div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-secondary);border-left:3px solid var(--success);padding-left:8px;">💰 ${lang === 'id' ? 'Data Keuangan' : '财务数据'}</div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button onclick="BackupStorage.exportCashFlowToCSV()" class="btn-small">💸 ${lang === 'id' ? 'Ekspor Arus Kas' : '导出资金流水'}</button>
                                <button onclick="BackupStorage.exportExpensesToCSV()" class="btn-small">📝 ${lang === 'id' ? 'Ekspor Pengeluaran' : '导出运营支出'}</button>
                            </div>
                        </div>
                    </div>
                    <div class="backup-card backup-card-secondary">
                        <h3>📥 ${lang === 'id' ? 'Pemulihan Data' : '恢复数据'}</h3>
                        <p>${lang === 'id' ? 'Pulihkan data dari file cadangan.' : '从备份文件恢复数据。'}</p>
                        <p class="warning-text-small">⚠️ ${lang === 'id' ? 'PERINGATAN: Akan menimpa data yang ada!' : '警告：将覆盖现有数据！'}</p>
                        <div class="file-upload-wrapper" style="margin-bottom:10px;">
                            <input type="file" id="restoreFile" accept=".json" style="display:none;" onchange="BackupStorage.onFileSelected(this)">
                            <button onclick="document.getElementById('restoreFile').click()" class="btn-small" style="width:100%;">📂 ${lang === 'id' ? 'Pilih File Cadangan' : '选择备份文件'}</button>
                            <span id="restoreFileName" style="display:block;margin-top:4px;font-size:12px;color:#64748b;">${lang === 'id' ? 'Tidak ada file dipilih' : '未选择文件'}</span>
                        </div>
                        <button onclick="BackupStorage.restoreFromFile()" class="btn-restore">🔄 ${lang === 'id' ? 'Pulihkan Data' : '恢复数据'}</button>
                    </div>
                    <div class="backup-card backup-card-secondary">
                        <h3>📝 ${lang === 'id' ? 'Log Audit' : '审计日志'}</h3>
                        <p>${lang === 'id' ? 'Lihat riwayat operasi sistem: login, pembayaran, penghapusan, dll.' : '查看系统操作记录：登录、缴费、删除等。'}</p>
                        <button onclick="BackupStorage.showAuditLog()" class="btn-small primary">🔍 ${lang === 'id' ? 'Lihat Log Audit' : '查看审计日志'}</button>
                    </div>
                </div>`;
        },

        restoreFromFile() {
            const fileInput = document.getElementById('restoreFile');
            if (!fileInput || !fileInput.files[0]) {
                Utils.toast.warning(Utils.lang === 'id' ? 'Pilih file cadangan terlebih dahulu' : '请选择备份文件');
                return;
            }
            this.restore(fileInput.files[0]);
        },

        // ==================== 审计日志 ====================
        async showAuditLog() {
            const lang = Utils.lang;

            if (!PERMISSION.canViewAuditLog()) {
                Utils.toast.warning(lang === 'id'
                    ? 'Hanya administrator yang dapat melihat log audit.'
                    : '仅管理员可查看审计日志。');
                return;
            }

            const oldModal = document.getElementById('auditLogModal');
            if (oldModal) oldModal.remove();

            try {
                const users = await SUPABASE.getAllUsers();
                const logs = await window.Audit.getLogs({ limit: 200 });

                const actionMap = {
                    login_success: lang === 'id' ? '✅ Login Berhasil' : '✅ 登录成功',
                    login_failure: lang === 'id' ? '❌ Login Gagal' : '❌ 登录失败',
                    logout: lang === 'id' ? '🚪 Logout' : '🚪 退出',
                    order_create: lang === 'id' ? '📋 Buat Pesanan' : '📋 创建订单',
                    order_delete: lang === 'id' ? '🗑️ Hapus Pesanan' : '🗑️ 删除订单',
                    payment: lang === 'id' ? '💰 Pembayaran' : '💰 缴费',
                    interest_payment_calc: lang === 'id' ? '🧮 Kalkulasi Bunga' : '🧮 利息计算',
                    interest_adjustment: lang === 'id' ? '⚙️ Penyesuaian Bunga' : '⚙️ 利息调整',
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
                    export: lang === 'id' ? '📎 Ekspor' : '📎 导出',
                    customer_delete: lang === 'id' ? '🗑️ Hapus Nasabah' : '🗑️ 删除客户',
                    profit_distribution: lang === 'id' ? '💸 Distribusi Laba' : '💸 收益处置',
                    payment_page_view: lang === 'id' ? '👁️ Lihat Halaman Bayar' : '👁️ 查看缴费页',
                };

                let rows = '';
                if (logs.length === 0) {
                    rows = `<tr><td colspan="4" class="text-center">${lang === 'id' ? 'Tidak ada log' : '暂无记录'}</td>`;
                } else {
                    for (const log of logs) {
                        const actionText = actionMap[log.action] || log.action;
                        let detailsText = '';
                        try {
                            const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                            if (details) {
                                if (details.order_id) detailsText = '📋 ' + Utils.escapeHtml(details.order_id);
                                else if (details.username) detailsText = '👤 ' + Utils.escapeHtml(details.username);
                                else if (details.store_name) detailsText = '🏪 ' + Utils.escapeHtml(details.store_name);
                                else if (details.filename) detailsText = '📄 ' + Utils.escapeHtml(details.filename);
                                else if (details.amount) detailsText = '💰 ' + Utils.formatCurrency(details.amount);
                                else detailsText = Utils.escapeHtml(log.details || '').substring(0, 80);
                            }
                        } catch (e) { detailsText = Utils.escapeHtml(String(log.details || '')).substring(0, 80); }
                        rows += `<td><td class="date-cell">${Utils.formatDate(log.created_at)}</td><td>${actionText}</td><td>${Utils.escapeHtml(log.user_name || '-')}</td><td class="desc-cell">${detailsText}</td></tr>`;
                    }
                }

                const userOptions = `<option value="">${lang === 'id' ? 'Semua pengguna' : '全部用户'}</option>` + users.map(u => `<option value="${u.id}">${Utils.escapeHtml(u.name)}</option>`).join('');
                const actionOptions = `<option value="">${lang === 'id' ? 'Semua aksi' : '全部操作'}</option>` + Object.entries(actionMap).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

                const modalHtml =
                    `<div id="auditLogModal" class="modal-overlay">
                        <div class="modal-content" style="max-width:900px;">
                            <h3>📝 ${lang === 'id' ? 'Log Audit' : '审计日志'}</h3>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                                <select id="auditFilterAction">${actionOptions}</select>
                                <select id="auditFilterUser">${userOptions}</select>
                                <input type="date" id="auditFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                                <input type="date" id="auditFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                                <button onclick="BackupStorage.filterAuditLog()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                                <button onclick="BackupStorage.resetAuditFilter()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                            </div>
                            <div class="table-container" style="max-height:450px;overflow-y:auto;">
                                <table class="data-table">
                                    <thead><tr><th class="col-date">${lang === 'id' ? 'Waktu' : '时间'}</th><th class="col-type">${lang === 'id' ? 'Aksi' : '操作'}</th><th class="col-name">${lang === 'id' ? 'Pengguna' : '用户'}</th><th class="col-desc">${lang === 'id' ? 'Detail' : '详情'}</th></tr></thead>
                                    <tbody id="auditLogBody">${rows}</tbody>
                                </table>
                            </div>
                            <div class="modal-actions">
                                <button onclick="BackupStorage.exportAuditLogCSV()" class="btn-small">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                                <button onclick="document.getElementById('auditLogModal').remove()" class="btn-small">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                            </div>
                        </div>
                    </div>`;

                document.body.insertAdjacentHTML('beforeend', modalHtml);
                window._auditLogData = logs;
                window._auditUsersData = users;
            } catch (error) {
                console.error("showAuditLog error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat log audit: ' + error.message : '加载审计日志失败：' + error.message);
            }
        },

        filterAuditLog() {
            const logs = window._auditLogData || [];
            const actionFilter = document.getElementById('auditFilterAction')?.value || '';
            const userFilter = document.getElementById('auditFilterUser')?.value || '';
            const startDate = document.getElementById('auditFilterStart')?.value || '';
            const endDate = document.getElementById('auditFilterEnd')?.value || '';
            const filtered = logs.filter(log => {
                if (actionFilter && log.action !== actionFilter) return false;
                if (userFilter && log.user_id !== userFilter) return false;
                if (startDate && log.created_at < startDate) return false;
                if (endDate && log.created_at > endDate + 'T23:59:59') return false;
                return true;
            });
            BackupStorage._renderAuditLogTable(filtered);
        },

        resetAuditFilter() {
            document.getElementById('auditFilterAction').value = '';
            document.getElementById('auditFilterUser').value = '';
            document.getElementById('auditFilterStart').value = '';
            document.getElementById('auditFilterEnd').value = '';
            BackupStorage.filterAuditLog();
        },

        _renderAuditLogTable(logs) {
            const tbody = document.getElementById('auditLogBody');
            if (!tbody) return;
            const lang = Utils.lang;
            const actionMap = {
                login_success: lang === 'id' ? '✅ Login Berhasil' : '✅ 登录成功',
                login_failure: lang === 'id' ? '❌ Login Gagal' : '❌ 登录失败',
                logout: lang === 'id' ? '🚪 Logout' : '🚪 退出',
                order_create: lang === 'id' ? '📋 Buat Pesanan' : '📋 创建订单',
                order_delete: lang === 'id' ? '🗑️ Hapus Pesanan' : '🗑️ 删除订单',
                payment: lang === 'id' ? '💰 Pembayaran' : '💰 缴费',
                interest_payment_calc: lang === 'id' ? '🧮 Kalkulasi Bunga' : '🧮 利息计算',
                interest_adjustment: lang === 'id' ? '⚙️ Penyesuaian Bunga' : '⚙️ 利息调整',
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
                export: lang === 'id' ? '📎 Ekspor' : '📎 导出',
                customer_delete: lang === 'id' ? '🗑️ Hapus Nasabah' : '🗑️ 删除客户',
                profit_distribution: lang === 'id' ? '💸 Distribusi Laba' : '💸 收益处置',
                payment_page_view: lang === 'id' ? '👁️ Lihat Halaman Bayar' : '👁️ 查看缴费页',
            };
            let rows = '';
            if (logs.length === 0) {
                rows = `<tr><td colspan="4" class="text-center">${lang === 'id' ? 'Tidak ada log' : '暂无记录'}</td>`;
            } else {
                for (const log of logs) {
                    let detailsText = '';
                    try {
                        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                        if (details) {
                            if (details.order_id) detailsText = '📋 ' + Utils.escapeHtml(details.order_id);
                            else if (details.username) detailsText = '👤 ' + Utils.escapeHtml(details.username);
                            else if (details.store_name) detailsText = '🏪 ' + Utils.escapeHtml(details.store_name);
                            else if (details.filename) detailsText = '📄 ' + Utils.escapeHtml(details.filename);
                            else if (details.amount) detailsText = '💰 ' + Utils.formatCurrency(details.amount);
                            else detailsText = Utils.escapeHtml(log.details || '').substring(0, 80);
                        }
                    } catch (e) { detailsText = Utils.escapeHtml(String(log.details || '')).substring(0, 80); }
                    rows += `<tr><td class="date-cell">${Utils.formatDate(log.created_at)}</td><td>${actionMap[log.action] || log.action}</td><td>${Utils.escapeHtml(log.user_name || '-')}</td><td class="desc-cell">${detailsText}</td></tr>`;
                }
            }
            tbody.innerHTML = rows;
        },

        exportAuditLogCSV() {
            const logs = window._auditLogData || [];
            const lang = Utils.lang;
            const headers = lang === 'id' ? ['Waktu', 'Aksi', 'Pengguna', 'Detail'] : ['时间', '操作', '用户', '详情'];
            const rows = logs.map(log => [log.created_at, log.action, log.user_name || '-', (log.details || '').substring(0, 200)]);
            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `jf_audit_log_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
            if (window.Audit) window.Audit.logExport('audit_log', a.download, AUTH.user?.name);
            Utils.toast.success(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
        },

        // ==================== 辅助函数 ====================
        _showLoading(message) {
            const div = document.createElement('div');
            div.id = 'backup-loading';
            div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
            div.innerHTML = `<div style="background:white;padding:20px 40px;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:12px;"><div class="loader" style="width:40px;height:40px;border:4px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin 1s linear infinite;"></div><p style="margin:0;">${message}</p></div>`;
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
        }
    };

    // 挂载到命名空间
    JF.BackupStorage = BackupStorage;
    window.BackupStorage = BackupStorage;

})();
