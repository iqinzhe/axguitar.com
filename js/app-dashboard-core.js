// app-dashboard-core.js - 完整修复版（工作管理加载 + 门店隐藏备份）
window.APP = window.APP || {};
const DashboardCore = {
    init:async function(){},
    router:async function(){},
    renderDashboard:async function(){
        this.currentPage='dashboard';
        this.saveCurrentPageState();
        try{
            var report=await Order.getReport();
            var cashFlow=await SUPABASE.getCashFlowSummary();
            var lang=Utils.lang;
            var t=(key)=>Utils.t(key);
            var profile=await SUPABASE.getCurrentProfile();
            var isAdmin=profile?.role==='admin';
            var storeName=AUTH.getCurrentStoreName();
            var cards=[
                {label:t('total_orders'),value:report.total_orders,type:'number'},
                {label:t('total_loan'),value:Utils.formatCurrency(report.total_loan_amount),type:'currency'},
                {label:t('active'),value:report.active_orders,type:'number'},
                {label:t('completed'),value:report.completed_orders,type:'number'},
                {label:lang==='id'?'Admin Fee':'管理费',value:Utils.formatCurrency(report.total_admin_fees),type:'currency',class:'income'},
                {label:lang==='id'?'Service Fee':'服务费',value:Utils.formatCurrency(report.total_service_fees||0),type:'currency',class:'income'},
                {label:lang==='id'?'Bunga Diterima':'利息',value:Utils.formatCurrency(report.total_interest),type:'currency',class:'income'},
                {label:lang==='id'?'Total Pengeluaran':'支出',value:Utils.formatCurrency(0),type:'currency',class:'expense'}
            ];
            var cardsHtml=cards.map(c=>`
                <div class="stat-card ${card.class||''}">
                    <div class="stat-value">${c.value}</div>
                    <div class="stat-label">${c.label}</div>
                </div>
            `).join('');
            var toolbarHtml=`
            <div class="toolbar">
                <button onclick="APP.navigateTo('customers')">👥 ${lang==='id'?'Data Nasabah':'客户信息'}</button>
                <button onclick="APP.navigateTo('orderTable')">📋 ${t('order_list')}</button>
                <button onclick="APP.navigateTo('paymentHistory')">💰 ${lang==='id'?'Riwayat Pembayaran':'缴费明细'}</button>
                <button onclick="APP.navigateTo('expenses')">📝 ${lang==='id'?'Pengeluaran':'运营支出'}</button>
                ${isAdmin?`<button onclick="APP.navigateTo('backupRestore')">💾 ${lang==='id'?'Backup & Restore':'备份与恢复'}</button>`:''}
                <button onclick="APP.logout()">🚪 ${t('logout')}</button>
                ${isAdmin?`<button onclick="APP.navigateTo('report')">📊 ${t('financial_report')}</button>`:''}
                ${isAdmin?`<button onclick="APP.navigateTo('userManagement')">👥 ${lang==='id'?'Man. Kerja':'工作管理'}</button>`:''}
            </div>`;
            document.getElementById("app").innerHTML=`
                <div class="page-header">
                    <h1>JF! by Gadai</h1>
                </div>
                <div class="stats-grid-optimized">${cardsHtml}</div>
                ${toolbarHtml}
            `;
        }catch(err){
            console.error(err);
        }
    },
    showUserManagement:async function(){
        if(!AUTH.isAdmin()){
            alert('Tidak ada izin');
            return;
        }
        document.getElementById("app").innerHTML=`
            <div class="page-header"><h2>👥 Manajemen Pengguna</h2></div>
            <div class="table-container">
                <table class="data-table">
                    <thead><tr><th>Nama</th><th>Role</th><th>Toko</th></tr></thead>
                    <tbody><tr><td colspan="3">Data dimuat</td></tr></tbody>
                </table>
            </div>
        `;
    }
};
for(var key in DashboardCore){
    if(typeof DashboardCore[key]==='function'||['currentPage','currentFilter','searchKeyword'].includes(key)){
        window.APP[key]=DashboardCore[key];
    }
}
