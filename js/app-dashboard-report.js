// app-dashboard-report.js - 报表功能模块
// 包含：财务报表、门店财务汇总

window.APP = window.APP || {};

const DashboardReport = {

    // ==================== 财务报表 ====================
    showReport: async function() {
        this.currentPage = 'report';
        this.saveCurrentPageState();
        try {
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var isAdmin = AUTH.isAdmin();
            
            console.log('开始加载财务报表数据...');
            const startTime = Date.now();
            
            const [storesResult, allOrdersResult, allExpensesResult, allPaymentsResult, cashFlow] = await Promise.all([
                supabaseClient.from('stores').select('*').order('code'),
                supabaseClient.from('orders').select('*'),
                supabaseClient.from('expenses').select('*'),
                supabaseClient.from('payment_history').select('*'),
                SUPABASE.getCashFlowSummary()
            ]);
            
            const stores = storesResult.data || [];
            const allOrders = allOrdersResult.data || [];
            const allExpenses = allExpensesResult.data || [];
            const allPayments = allPaymentsResult.data || [];
            
            console.log(`数据加载完成: 门店 ${stores.length} 家, 订单 ${allOrders.length} 条, 支出 ${allExpenses.length} 条, 付款 ${allPayments.length} 条, 耗时 ${Date.now() - startTime}ms`);
            
            const orderStoreMap = {};
            for (const order of allOrders) {
                orderStoreMap[order.id] = order.store_id;
            }
            
            const paymentsByStore = {};
            const expensesByStore = {};
            const ordersByStore = {};
            
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

            if (isAdmin) {
                var storeReports = [];
                var grandTotal = { 
                    orders: 0, active: 0, loan: 0, adminFee: 0, interest: 0, 
                    principal: 0, expenses: 0, income: 0, cashBalance: 0, bankBalance: 0 
                };

                for (var store of stores) {
                    const orders = ordersByStore[store.id] || [];
                    const expenses = expensesByStore[store.id] || [];
                    const payments = paymentsByStore[store.id] || [];
                    
                    const ords = orders;
                    const activeOrds = ords.filter(o => o.status === 'active');
                    const totalLoan = ords.reduce((s, o) => s + (o.loan_amount || 0), 0);
                    const totalAdminFee = ords.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
                    const totalInterest = ords.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                    const totalPrincipal = ords.reduce((s, o) => s + (o.principal_paid || 0), 0);
                    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
                    const totalIncome = totalAdminFee + totalInterest;
                    
                    let cashIncome = 0, bankIncome = 0;
                    for (const p of payments) {
                        if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                            if (p.payment_method === 'cash') cashIncome += p.amount;
                            else if (p.payment_method === 'bank') bankIncome += p.amount;
                        }
                    }
                    let cashExpense = 0, bankExpense = 0;
                    for (const e of expenses) {
                        if (e.payment_method === 'cash') cashExpense += e.amount;
                        else if (e.payment_method === 'bank') bankExpense += e.amount;
                    }
                    const cashBalance = cashIncome - cashExpense;
                    const bankBalance = bankIncome - bankExpense;

                    storeReports.push({ 
                        store, 
                        ords: ords.length, 
                        active: activeOrds.length, 
                        totalLoan, 
                        totalAdminFee, 
                        totalInterest, 
                        totalPrincipal, 
                        totalExpenses, 
                        totalIncome,
                        cashBalance,
                        bankBalance
                    });

                    grandTotal.orders += ords.length;
                    grandTotal.active += activeOrds.length;
                    grandTotal.loan += totalLoan;
                    grandTotal.adminFee += totalAdminFee;
                    grandTotal.interest += totalInterest;
                    grandTotal.principal += totalPrincipal;
                    grandTotal.expenses += totalExpenses;
                    grandTotal.income += totalIncome;
                    grandTotal.cashBalance += cashBalance;
                    grandTotal.bankBalance += bankBalance;
                }

                var storeHtml = storeReports.length === 0 
                    ? `<div class="report-store-section"><div class="report-store-header">${lang === 'id' ? 'Tidak ada toko' : '暂无门店'}</div></div>`
                    : storeReports.map(r => `
                    <div class="report-store-section">
                        <div class="report-store-header">🏪 ${Utils.escapeHtml(r.store.name)} (${Utils.escapeHtml(r.store.code || '-')})</div>
                        <div class="report-store-stats report-grid-5x2">
                            <div class="report-store-stat"><div class="label">${t('total_orders')}</div><div class="value">${r.ords}</div></div>
                            <div class="report-store-stat"><div class="label">${t('active')}</div><div class="value">${r.active}</div></div>
                            <div class="report-store-stat"><div class="label">${t('total_loan')}</div><div class="value">${Utils.formatCurrency(r.totalLoan)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div><div class="value income">${Utils.formatCurrency(r.totalAdminFee)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Bunga' : '利息收入总额'}</div><div class="value income">${Utils.formatCurrency(r.totalInterest)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Pokok' : '本金'}</div><div class="value">${Utils.formatCurrency(r.totalPrincipal)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pendapatan' : '管理费+利息合计'}</div><div class="value income">${Utils.formatCurrency(r.totalIncome)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pengeluaran' : '运营支出总额'}</div><div class="value expense">${Utils.formatCurrency(r.totalExpenses)}</div></div>
                            <div class="report-store-stat"><div class="label">🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</div><div class="value">${Utils.formatCurrency(r.cashBalance)}</div></div>
                            <div class="report-store-stat"><div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</div><div class="value">${Utils.formatCurrency(r.bankBalance)}</div></div>
                        </div>
                    </div>`).join('');

                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div class="header-actions">
                            <button onclick="Storage.exportOrdersToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                            <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>                      
                        </div>
                    </div>
                    
                    <div class="cashflow-summary">
                        <h3>💰 ${lang === 'id' ? 'RINGKASAN ARUS KAS' : '现金流汇总'}</h3>
                        <div class="cashflow-stats">
                            <div class="cashflow-item"><div class="label">🏦 ${t('cash')}</div><div class="value">${Utils.formatCurrency(cashFlow.cash.balance)}</div></div>
                            <div class="cashflow-item"><div class="label">🏧 ${t('bank')}</div><div class="value">${Utils.formatCurrency(cashFlow.bank.balance)}</div></div>
                            <div class="cashflow-item"><div class="label">📊 ${lang === 'id' ? 'Total' : '总计'}</div><div class="value">${Utils.formatCurrency(cashFlow.total.balance)}</div></div>
                        </div>
                    </div>
                    
                    <div class="card grand-total-card">
                        <h3>📊 ${lang === 'id' ? 'TOTAL SEMUA TOKO' : '全部门店合计'}</h3>
                        <div class="report-store-stats report-grid-5x2">
                            <div class="report-store-stat"><div class="label">${t('total_orders')}</div><div class="stat-value">${grandTotal.orders}</div></div>
                            <div class="report-store-stat"><div class="label">${t('active')}</div><div class="stat-value">${grandTotal.active}</div></div>
                            <div class="report-store-stat"><div class="label">${t('total_loan')}</div><div class="stat-value">${Utils.formatCurrency(grandTotal.loan)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Admin Fee' : '管理费总额'}</div><div class="stat-value income">${Utils.formatCurrency(grandTotal.adminFee)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Bunga' : '利息收入总额'}</div><div class="stat-value income">${Utils.formatCurrency(grandTotal.interest)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Pokok' : '本金'}</div><div class="stat-value">${Utils.formatCurrency(grandTotal.principal)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pendapatan' : '管理费+利息合计'}</div><div class="stat-value income">${Utils.formatCurrency(grandTotal.income)}</div></div>
                            <div class="report-store-stat"><div class="label">${lang === 'id' ? 'Total Pengeluaran' : '运营支出总额'}</div><div class="stat-value expense">${Utils.formatCurrency(grandTotal.expenses)}</div></div>
                            <div class="report-store-stat"><div class="label">🏦 ${lang === 'id' ? 'Brankas' : '保险柜'}</div><div class="stat-value">${Utils.formatCurrency(grandTotal.cashBalance)}</div></div>
                            <div class="report-store-stat"><div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</div><div class="stat-value">${Utils.formatCurrency(grandTotal.bankBalance)}</div></div>
                        </div>
                    </div>
                    
                    <h3>${lang === 'id' ? 'Detail per Toko' : '各门店明细'}</h3>
                    ${storeHtml}`;
            } else {
                const profile = await SUPABASE.getCurrentProfile();
                const storeId = profile?.store_id;
                
                const storeOrders = allOrders.filter(o => o.store_id === storeId);
                const storeExpenses = allExpenses.filter(e => e.store_id === storeId);
                const storeOrderIds = storeOrders.map(o => o.id);
                const storePayments = allPayments.filter(p => storeOrderIds.includes(p.order_id));
                
                let cashIncome = 0, bankIncome = 0;
                for (const p of storePayments) {
                    if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                        if (p.payment_method === 'cash') cashIncome += p.amount;
                        else if (p.payment_method === 'bank') bankIncome += p.amount;
                    }
                }
                let cashExpense = 0, bankExpense = 0;
                for (const e of storeExpenses) {
                    if (e.payment_method === 'cash') cashExpense += e.amount;
                    else if (e.payment_method === 'bank') bankExpense += e.amount;
                }
                const cashBalance = cashIncome - cashExpense;
                const bankBalance = bankIncome - bankExpense;
                
                const totalLoan = storeOrders.reduce((s, o) => s + (o.loan_amount || 0), 0);
                const totalAdminFee = storeOrders.reduce((s, o) => s + (o.admin_fee_paid ? (o.admin_fee || 0) : 0), 0);
                const totalInterest = storeOrders.reduce((s, o) => s + (o.interest_paid_total || 0), 0);
                const totalPrincipal = storeOrders.reduce((s, o) => s + (o.principal_paid || 0), 0);
                const totalExpenses = storeExpenses.reduce((s, e) => s + (e.amount || 0), 0);
                const totalIncome = totalAdminFee + totalInterest;
                const grossProfit = totalIncome - totalExpenses;

                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>📊 ${t('financial_report')}</h2>
                        <div class="header-actions">                            
                            <button onclick="Storage.exportOrdersToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                            <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        </div>
                    </div>
                    
                    <div class="cashflow-summary">
                        <h3>💰 ${lang === 'id' ? 'ARUS KAS' : '现金流'}</h3>
                        <div class="cashflow-stats">
                            <div class="cashflow-item"><div class="label">🏦 ${t('cash')}</div><div class="value">${Utils.formatCurrency(cashBalance)}</div></div>
                            <div class="cashflow-item"><div class="label">🏧 ${t('bank')}</div><div class="value">${Utils.formatCurrency(bankBalance)}</div></div>
                            <div class="cashflow-item"><div class="label">📊 ${lang === 'id' ? 'Total' : '总计'}</div><div class="value">${Utils.formatCurrency(cashBalance + bankBalance)}</div></div>
                        </div>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-value">${storeOrders.length}</div><div>${t('total_orders')}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalLoan)}</div><div>${t('total_loan')}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>${lang === 'id' ? 'Admin Fee' : '管理费'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>${lang === 'id' ? 'Bunga' : '利息收入'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>${lang === 'id' ? 'Pokok' : '本金回收'}</div></div>
                    </div>
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-value income">${Utils.formatCurrency(totalIncome)}</div><div>${lang === 'id' ? 'Total Pendapatan' : '总收入'}</div></div>
                        <div class="stat-card"><div class="stat-value expense">${Utils.formatCurrency(totalExpenses)}</div><div>${lang === 'id' ? 'Total Pengeluaran' : '运营支出'}</div></div>
                        <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(grossProfit)}</div><div>${lang === 'id' ? 'Laba Kotor' : '毛利'}</div></div>
                    </div>`;
            }
        } catch (err) {
            console.error("showReport error:", err);
            alert(Utils.lang === 'id' ? 'Gagal memuat laporan' : '加载报告失败');
        }
    }
};

for (var key in DashboardReport) {
    if (typeof DashboardReport[key] === 'function') {
        window.APP[key] = DashboardReport[key];
    }
}
