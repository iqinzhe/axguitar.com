// app-dashboard-report.js - v2.2 表格版（业务报表）

window.APP = window.APP || {};

const DashboardReport = {

    showReport: async function() {
        this.currentPage = 'report';
        this.saveCurrentPageState();
        try {
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            
            console.log('开始加载业务报表数据...');
            const startTime = Date.now();
            
            const [storesResult, allOrdersResult, allExpensesResult, allPaymentsResult, cashFlow, cashFlowRecords] = await Promise.all([
                supabaseClient.from('stores').select('*').order('code'),
                supabaseClient.from('orders').select('*'),
                supabaseClient.from('expenses').select('*'),
                supabaseClient.from('payment_history').select('*'),
                SUPABASE.getCashFlowSummary(),
                SUPABASE.getCashFlowRecords()
            ]);
            
            const stores = storesResult.data || [];
            const allOrders = allOrdersResult.data || [];
            const allExpenses = allExpensesResult.data || [];
            const allPayments = allPaymentsResult.data || [];
            const cashFlows = cashFlowRecords || [];
            
            console.log(`数据加载完成: 门店 ${stores.length} 家, 订单 ${allOrders.length} 条, 支出 ${allExpenses.length} 条, 付款 ${allPayments.length} 条, 资金流 ${cashFlows.length} 条, 耗时 ${Date.now() - startTime}ms`);
            
            const orderStoreMap = {};
            for (const order of allOrders) {
                orderStoreMap[order.id] = order.store_id;
            }
            
            const paymentsByStore = {};
            const expensesByStore = {};
            const ordersByStore = {};
            const cashFlowByStore = {};
            
            for (const payment of allPayments) {
                const storeId = orderStoreMap[payment.order_id];
                if (storeId) {
                    if (!paymentsByStore[storeId]) paymentsByStore[storeId] = [];
                    paymentsByStore[storeId].push(payment);
                }
            }
            
            for (const expense of allExpenses) {
                const storeId = expense.store_id;
                if (storeId) {
                    if (!expensesByStore[storeId]) expensesByStore[storeId] = [];
                    expensesByStore[storeId].push(expense);
                }
            }
            
            for (const order of allOrders) {
                const storeId = order.store_id;
                if (storeId) {
                    if (!ordersByStore[storeId]) ordersByStore[storeId] = [];
                    ordersByStore[storeId].push(order);
                }
            }
            
            for (const flow of cashFlows) {
                const storeId = flow.store_id;
                if (storeId) {
                    if (!cashFlowByStore[storeId]) cashFlowByStore[storeId] = [];
                    cashFlowByStore[storeId].push(flow);
                }
            }

            if (isAdmin) {
                var storeReports = [];
                var grandTotal = { 
                    orders: 0, active: 0, loan: 0, adminFee: 0, serviceFee: 0, interest: 0, 
                    principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0, 
                    grossProfit: 0, netProfit: 0
                };

                for (var store of stores) {
                    const orders = ordersByStore[store.id] || [];
                    const expenses = expensesByStore[store.id] || [];
                    const payments = paymentsByStore[store.id] || [];
                    const flows = cashFlowByStore[store.id] || [];
                    
                    const ords = orders;
                    const activeOrds = ords.filter(o => o.status === 'active');
                    const totalLoan = ords.reduce((s, o) => s + (o.loan_amount || 0), 0);
                    const totalAdminFee = ords.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
                    const totalServiceFee = ords.reduce((s, o) => s + (o.service_fee_paid || 0), 0);
                    const totalInterest = ords.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                    const totalPrincipal = ords.reduce((s, o) => s + (o.principal_paid || 0), 0);
                    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
                    
                    const grossProfit = totalAdminFee + totalServiceFee + totalInterest;
                    
                    let cashBalance = 0, bankBalance = 0;
                    let totalIncomeInflow = 0;
                    let totalOutflow = 0;
                    
                    for (const flow of flows) {
                        const amount = flow.amount || 0;
                        if (flow.direction === 'inflow') {
                            if (flow.source_target === 'cash') cashBalance += amount;
                            else if (flow.source_target === 'bank') bankBalance += amount;
                            if (flow.flow_type !== 'principal') {
                                totalIncomeInflow += amount;
                            }
                        } else if (flow.direction === 'outflow') {
                            if (flow.source_target === 'cash') cashBalance -= amount;
                            else if (flow.source_target === 'bank') bankBalance -= amount;
                            totalOutflow += amount;
                        }
                    }
                    
                    const netProfit = totalIncomeInflow - totalOutflow;

                    storeReports.push({ 
                        store, 
                        ords: ords.length, 
                        active: activeOrds.length, 
                        totalLoan, 
                        totalAdminFee, 
                        totalServiceFee,
                        totalInterest, 
                        totalPrincipal, 
                        totalExpenses, 
                        grossProfit,
                        netProfit,
                        cashBalance,
                        bankBalance
                    });

                    grandTotal.orders += ords.length;
                    grandTotal.active += activeOrds.length;
                    grandTotal.loan += totalLoan;
                    grandTotal.adminFee += totalAdminFee;
                    grandTotal.serviceFee += totalServiceFee;
                    grandTotal.interest += totalInterest;
                    grandTotal.principal += totalPrincipal;
                    grandTotal.expenses += totalExpenses;
                    grandTotal.grossProfit += grossProfit;
                    grandTotal.netProfit += netProfit;
                    grandTotal.cashBalance += cashBalance;
                    grandTotal.bankBalance += bankBalance;
                }

                // ==================== 表格形式展示业务报表 ====================
                var tableRows = '';
                if (storeReports.length === 0) {
                    tableRows = `<tr><td colspan="14" class="text-center">${lang === 'id' ? '暂无门店数据' : '暂无门店数据'}<\/td><\/tr>`;
                } else {
                    for (var r of storeReports) {
                        tableRows += `<tr>
                            <td class="store-name-cell"><strong>${Utils.escapeHtml(r.store.name)}</strong><br><small>${Utils.escapeHtml(r.store.code)}</small></td>
                            <td class="text-center">${r.ords}</td>
                            <td class="text-center">${r.active}</td>
                            <td class="text-right">${Utils.formatCurrency(r.totalLoan)}</td>
                            <td class="text-right income">${Utils.formatCurrency(r.totalAdminFee)}</td>
                            <td class="text-right income">${Utils.formatCurrency(r.totalServiceFee)}</td>
                            <td class="text-right income">${Utils.formatCurrency(r.totalInterest)}</td>
                            <td class="text-right">${Utils.formatCurrency(r.totalPrincipal)}</td>
                            <td class="text-right income">${Utils.formatCurrency(r.grossProfit)}</td>
                            <td class="text-right expense">${Utils.formatCurrency(r.totalExpenses)}</td>
                            <td class="text-right ${r.netProfit >= 0 ? 'income' : 'expense'}">${Utils.formatCurrency(r.netProfit)}</td>
                            <td class="text-right">${Utils.formatCurrency(r.cashBalance)}</td>
                            <td class="text-right">${Utils.formatCurrency(r.bankBalance)}</td>
                            <td class="text-right ${(r.cashBalance + r.bankBalance) >= 0 ? 'income' : 'expense'}">${Utils.formatCurrency(r.cashBalance + r.bankBalance)}</td>
                        </tr>`;
                    }
                }

                // 汇总行
                var summaryRow = `<tr>
                    <td class="store-name-cell"><strong>${lang === 'id' ? '📊 TOTAL SEMUA TOKO' : '📊 全部门店合计'}</strong></td>
                    <td class="text-center"><strong>${grandTotal.orders}</strong></td>
                    <td class="text-center"><strong>${grandTotal.active}</strong></td>
                    <td class="text-right"><strong>${Utils.formatCurrency(grandTotal.loan)}</strong></td>
                    <td class="text-right income"><strong>${Utils.formatCurrency(grandTotal.adminFee)}</strong></td>
                    <td class="text-right income"><strong>${Utils.formatCurrency(grandTotal.serviceFee)}</strong></td>
                    <td class="text-right income"><strong>${Utils.formatCurrency(grandTotal.interest)}</strong></td>
                    <td class="text-right"><strong>${Utils.formatCurrency(grandTotal.principal)}</strong></td>
                    <td class="text-right income"><strong>${Utils.formatCurrency(grandTotal.grossProfit)}</strong></td>
                    <td class="text-right expense"><strong>${Utils.formatCurrency(grandTotal.expenses)}</strong></td>
                    <td class="text-right ${grandTotal.netProfit >= 0 ? 'income' : 'expense'}"><strong>${Utils.formatCurrency(grandTotal.netProfit)}</strong></td>
                    <td class="text-right"><strong>${Utils.formatCurrency(grandTotal.cashBalance)}</strong></td>
                    <td class="text-right"><strong>${Utils.formatCurrency(grandTotal.bankBalance)}</strong></td>
                    <td class="text-right ${(grandTotal.cashBalance + grandTotal.bankBalance) >= 0 ? 'income' : 'expense'}"><strong>${Utils.formatCurrency(grandTotal.cashBalance + grandTotal.bankBalance)}</strong></td>
                </tr>`;

                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>📊 ${lang === 'id' ? 'Laporan Bisnis' : '业务报表'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                        <div class="cashflow-stats" style="display:flex; gap:16px; flex-wrap:wrap;">
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">🏦 ${lang === 'id' ? '保险柜 (现金)' : '保险柜 (现金)'}</div>
                                <div class="value ${cashFlow.cash.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.cash.balance)}</div>
                                <div style="font-size:11px; color:#64748b;">+${Utils.formatCurrency(cashFlow.cash.income)} / -${Utils.formatCurrency(cashFlow.cash.expense)}</div>
                            </div>
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">🏧 ${lang === 'id' ? '银行 BNI' : '银行 BNI'}</div>
                                <div class="value ${cashFlow.bank.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.bank.balance)}</div>
                                <div style="font-size:11px; color:#64748b;">+${Utils.formatCurrency(cashFlow.bank.income)} / -${Utils.formatCurrency(cashFlow.bank.expense)}</div>
                            </div>
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">💰 ${lang === 'id' ? 'Laba Bersih (Kas)' : '现金净利'}</div>
                                <div class="value ${cashFlow.netProfit?.balance >= 0 ? 'income' : 'expense'}">${Utils.formatCurrency(cashFlow.netProfit?.balance || 0)}</div>
                            </div>
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
                                <div class="value">${Utils.formatCurrency(cashFlow.total.balance)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📋 ${lang === 'id' ? 'LAPORAN PER TOKO' : '各门店业务报表'}</h3>
                        <div class="table-container" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
                            <table class="data-table report-table" style="min-width:1200px;">
                                <thead>
                                    <tr>
                                        <th rowspan="2">${lang === 'id' ? 'Toko' : '门店'}</th>
                                        <th colspan="2" class="text-center">${lang === 'id' ? '订单统计' : '订单统计'}</th>
                                        <th rowspan="2" class="text-right">${lang === 'id' ? '贷款总额' : '贷款总额'}</th>
                                        <th colspan="3" class="text-center">${lang === 'id' ? '收入明细' : '收入明细'}</th>
                                        <th rowspan="2" class="text-right">${lang === 'id' ? '本金回收' : '本金回收'}</th>
                                        <th rowspan="2" class="text-right">${lang === 'id' ? '毛利' : '毛利'}</th>
                                        <th rowspan="2" class="text-right">${lang === 'id' ? '运营支出' : '运营支出'}</th>
                                        <th rowspan="2" class="text-right">${lang === 'id' ? '现金净利' : '现金净利'}</th>
                                        <th colspan="3" class="text-center">${lang === 'id' ? '资金余额' : '资金余额'}</th>
                                    </tr>
                                    <tr>
                                        <th class="text-center">${t('total_orders')}</th>
                                        <th class="text-center">${t('active')}</th>
                                        <th class="text-right">${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                        <th class="text-right">${lang === 'id' ? 'Service Fee' : '服务费'}</th>
                                        <th class="text-right">${lang === 'id' ? 'Bunga' : '利息'}</th>
                                        <th class="text-right">🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</th>
                                        <th class="text-right">🏧 ${lang === 'id' ? 'Bank' : '银行'}</th>
                                        <th class="text-right">📊 ${lang === 'id' ? 'Total' : '合计'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                    ${summaryRow}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📌 ${lang === 'id' ? 'KETERANGAN' : '说明'}</h3>
                        <div style="font-size:12px; color:#64748b; line-height:1.6;">
                            <p>• <strong>${lang === 'id' ? '毛利' : '毛利'}</strong> = Admin Fee + Service Fee + Bunga</p>
                            <p>• <strong>${lang === 'id' ? '现金净利' : '现金净利'}</strong> = ${lang === 'id' ? '总流入(不含本金) - 总流出' : '总流入(不含本金) - 总流出'}</p>
                            <p>• <strong>${lang === 'id' ? '资金余额' : '资金余额'}</strong> = ${lang === 'id' ? '基于 cash_flow_records 计算的实时余额' : '基于 cash_flow_records 计算的实时余额'}</p>
                        </div>
                    </div>`;
            } else {
                // 非管理员视图 - 单门店表格形式
                const profile = await SUPABASE.getCurrentProfile();
                const storeId = profile?.store_id;
                const flows = cashFlowByStore[storeId] || [];
                
                const storeOrders = allOrders.filter(o => o.store_id === storeId);
                const storeExpenses = allExpenses.filter(e => e.store_id === storeId);
                const storeOrderIds = storeOrders.map(o => o.id);
                const storePayments = allPayments.filter(p => storeOrderIds.includes(p.order_id));
                
                let cashBalance = 0, bankBalance = 0;
                let totalIncomeInflow = 0;
                let totalOutflow = 0;
                
                for (const flow of flows) {
                    const amount = flow.amount || 0;
                    if (flow.direction === 'inflow') {
                        if (flow.source_target === 'cash') cashBalance += amount;
                        else if (flow.source_target === 'bank') bankBalance += amount;
                        if (flow.flow_type !== 'principal') {
                            totalIncomeInflow += amount;
                        }
                    } else if (flow.direction === 'outflow') {
                        if (flow.source_target === 'cash') cashBalance -= amount;
                        else if (flow.source_target === 'bank') bankBalance -= amount;
                        totalOutflow += amount;
                    }
                }
                
                const netProfit = totalIncomeInflow - totalOutflow;
                
                const totalLoan = storeOrders.reduce((s, o) => s + (o.loan_amount || 0), 0);
                const totalAdminFee = storeOrders.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
                const totalServiceFee = storeOrders.reduce((s, o) => s + (o.service_fee_paid || 0), 0);
                const totalInterest = storeOrders.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                const totalPrincipal = storeOrders.reduce((s, o) => s + (o.principal_paid || 0), 0);
                const totalExpenses = storeExpenses.reduce((s, e) => s + (e.amount || 0), 0);
                const grossProfit = totalAdminFee + totalServiceFee + totalInterest;

                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div class="header-actions">                            
                            <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>💰 ${lang === 'id' ? 'ARUS KAS' : '现金流'}</h3>
                        <div class="cashflow-stats" style="display:flex; gap:16px; flex-wrap:wrap;">
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">🏦 ${t('cash')}</div>
                                <div class="value">${Utils.formatCurrency(cashBalance)}</div>
                            </div>
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">🏧 ${t('bank')}</div>
                                <div class="value">${Utils.formatCurrency(bankBalance)}</div>
                            </div>
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">💰 ${lang === 'id' ? 'Laba Bersih (Kas)' : '现金净利'}</div>
                                <div class="value ${netProfit >= 0 ? 'income' : 'expense'}">${Utils.formatCurrency(netProfit)}</div>
                            </div>
                            <div class="cashflow-item" style="flex:1; min-width:150px;">
                                <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
                                <div class="value">${Utils.formatCurrency(cashBalance + bankBalance)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📋 ${lang === 'id' ? 'LAPORAN KEUANGAN' : '财务报表'}</h3>
                        <div class="table-container" style="overflow-x:auto;">
                            <table class="data-table" style="min-width:600px;">
                                <thead>
                                    <tr>
                                        <th>${lang === 'id' ? 'Metrik' : '指标'}</th>
                                        <th class="text-right">${lang === 'id' ? 'Nilai' : '数值'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td>${t('total_orders')}</td><td class="text-right">${storeOrders.length}</td></tr>
                                    <tr><td>${t('total_loan')}</td><td class="text-right">${Utils.formatCurrency(totalLoan)}</td></tr>
                                    <tr><td>${lang === 'id' ? 'Admin Fee' : '管理费'}</td><td class="text-right income">${Utils.formatCurrency(totalAdminFee)}</td></tr>
                                    <tr><td>${lang === 'id' ? 'Service Fee' : '服务费'}</td><td class="text-right income">${Utils.formatCurrency(totalServiceFee)}</td></tr>
                                    <tr><td>${lang === 'id' ? 'Bunga' : '利息收入'}</td><td class="text-right income">${Utils.formatCurrency(totalInterest)}</td></tr>
                                    <tr><td>${lang === 'id' ? 'Pokok' : '本金回收'}</td><td class="text-right">${Utils.formatCurrency(totalPrincipal)}</td></tr>
                                    <tr><td>📊 ${lang === 'id' ? 'Laba Kotor' : '毛利'}</td><td class="text-right income">${Utils.formatCurrency(grossProfit)}</td></tr>
                                    <tr><td>${lang === 'id' ? 'Total Pengeluaran' : '运营支出'}</td><td class="text-right expense">${Utils.formatCurrency(totalExpenses)}</td></tr>
                                    <tr><td>${lang === 'id' ? 'Laba Sebelum Bunga & Pajak' : '息税前利润'}</td><td class="text-right">${Utils.formatCurrency(grossProfit - totalExpenses)}</td></tr>
                                    <tr><td>💰 ${lang === 'id' ? 'Laba Bersih (Kas)' : '现金净利'}</td><td class="text-right ${netProfit >= 0 ? 'income' : 'expense'}">${Utils.formatCurrency(netProfit)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>`;
            }
            
            if (typeof cashFlow.netProfit === 'undefined') {
                let totalIncomeInflow = 0, totalOutflowAll = 0;
                for (const flow of cashFlows) {
                    if (flow.direction === 'inflow' && flow.flow_type !== 'principal') {
                        totalIncomeInflow += flow.amount;
                    } else if (flow.direction === 'outflow') {
                        totalOutflowAll += flow.amount;
                    }
                }
                cashFlow.netProfit = { balance: totalIncomeInflow - totalOutflowAll };
            }
            
            // 添加报表表格样式
            this._addReportTableStyles();
            
        } catch (err) {
            console.error("showReport error:", err);
            alert(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报告失败');
        }
    },
    
    // 添加报表表格样式
    _addReportTableStyles: function() {
        if (document.getElementById('report-table-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'report-table-styles';
        style.textContent = `
            .report-table th {
                background: var(--gray-100);
                font-weight: 600;
                text-align: center;
                vertical-align: middle;
                padding: 10px 8px;
            }
            .report-table td {
                padding: 10px 8px;
                vertical-align: middle;
            }
            .report-table .store-name-cell {
                font-weight: 500;
                background: var(--gray-50);
            }
            .report-table .text-right {
                text-align: right;
            }
            .report-table .text-center {
                text-align: center;
            }
            .report-table .income {
                color: #10b981;
            }
            .report-table .expense {
                color: #ef4444;
            }
            .report-table tbody tr:hover {
                background: var(--gray-50);
            }
            .report-table tbody tr:last-child {
                border-top: 2px solid var(--gray-400);
                background: var(--gray-100);
                font-weight: 600;
            }
            .cashflow-stats {
                display: flex;
                gap: 16px;
                flex-wrap: wrap;
            }
            .cashflow-item {
                flex: 1;
                min-width: 150px;
                background: var(--gray-50);
                border-radius: 12px;
                padding: 12px 16px;
                text-align: center;
            }
            .cashflow-item .label {
                font-size: 12px;
                color: var(--gray-500);
                margin-bottom: 6px;
            }
            .cashflow-item .value {
                font-size: 18px;
                font-weight: 700;
            }
            .cashflow-item .negative {
                color: #ef4444;
            }
            .cashflow-item .income {
                color: #10b981;
            }
            .cashflow-item .expense {
                color: #ef4444;
            }
            @media (max-width: 768px) {
                .cashflow-item .value {
                    font-size: 14px;
                }
                .report-table th, .report-table td {
                    padding: 6px 4px;
                    font-size: 11px;
                }
            }
        `;
        document.head.appendChild(style);
    }
};

for (var key in DashboardReport) {
    if (typeof DashboardReport[key] === 'function') {
        window.APP[key] = DashboardReport[key];
    }
}

console.log('✅ app-dashboard-report.js v2.2 已加载 - 业务报表表格版');
