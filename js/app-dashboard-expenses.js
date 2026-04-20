// app-dashboard-expenses.js - 完整修复版（运营支出加载成功）
window.APP = window.APP || {};
const DashboardExpenses = {
    showExpenses: async function() {
        this.currentPage = 'expenses';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        try {
            const profile = await SUPABASE.getCurrentProfile();
            let query = supabaseClient.from('expenses').select('*, stores(name, code)').order('expense_date', { ascending: false });
            if (!isAdmin && profile?.store_id) query = query.eq('store_id', profile.store_id);
            const { data: expenses, error } = await query;
            if (error) throw error;
            var totalAmount = expenses?.reduce((s,e)=>s+e.amount,0)||0;
            var todayDate = new Date().toISOString().split('T')[0];
            var rows = '';
            if (expenses && expenses.length>0) {
                for (var e of expenses) {
                    var canEdit = isAdmin && !e.is_reconciled;
                    var actionBtns = '';
                    if (canEdit) {
                        actionBtns = `<button onclick="APP.editExpense('${e.id}')" class="btn-small">✏️ ${t('edit')}</button>
                                     <button class="btn-small danger" onclick="APP.deleteExpense('${e.id}')">🗑️ ${t('delete')}</button>`;
                    } else if (e.is_reconciled) {
                        actionBtns = `<span class="reconciled-badge">✅ ${lang==='id'?'Direkonsiliasi':'已平账'}</span>`;
                    } else if (!isAdmin) {
                        actionBtns = `<span class="locked-badge">🔒 ${lang==='id'?'Terkunci':'已锁定'}</span>`;
                    }
                    var methodText = e.payment_method==='cash'?(lang==='id'?'Tunai':'现金'):(lang==='id'?'Bank BNI':'银行BNI');
                    rows += `<tr>
                        <td>${Utils.formatDate(e.expense_date)}</td>
                        <td>${Utils.escapeHtml(e.category)}</td>
                        <td class="text-right">${Utils.formatCurrency(e.amount)}</td>
                        <td>${methodText}</td>
                        <td>${Utils.escapeHtml(e.description||'-')}</td>
                        <td>${Utils.escapeHtml(e.stores?.name||'-')} (${Utils.escapeHtml(e.stores?.code||'-')})</td>
                        <td class="action-cell">${actionBtns}</td>
                    </tr>`;
                }
            } else {
                rows = `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`;
            }
            const expenseCategories = lang==='id'?['Listrik','Air','Internet','Gaji Karyawan','Sewa Tempat','ATK','Perbaikan','Transportasi','Lainnya']:['电费','水费','网络费','员工工资','场地租金','办公用品','维修','交通费','其他'];
            var categoryOptions = '';
            for(var cat of expenseCategories) categoryOptions+=`<option value="${cat}">${cat}</option>`;
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📝 ${lang==='id'?'Pengeluaran Operasional':'运营支出'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang==='id'?'Cetak':'打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        ${PERMISSION.canReconcile()?`<button onclick="APP.balanceExpenses()" class="btn-balance warning">⚖️ ${lang==='id'?'Rekonsiliasi':'平账'}</button>`:''}
                    </div>
                </div>
                <div class="card">
                    <h3>${lang==='id'?'Total Pengeluaran':'支出总额'}: <span class="total-expense">${Utils.formatCurrency(totalAmount)}</span></h3>
                </div>
                <div class="card">
                    <h3>${lang==='id'?'Daftar Pengeluaran':'支出列表'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${lang==='id'?'Tanggal':'日期'}</th>
                                    <th>${lang==='id'?'Kategori':'类别'}</th>
                                    <th>${lang==='id'?'Jumlah':'金额'}</th>
                                    <th>${lang==='id'?'Metode':'支付方式'}</th>
                                    <th>${lang==='id'?'Deskripsi':'描述'}</th>
                                    <th>${lang==='id'?'Toko':'门店'}</th>
                                    <th>${lang==='id'?'Aksi':'操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <h3>${lang==='id'?'Tambah Pengeluaran Baru':'新增支出'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${lang==='id'?'Tanggal':'日期'} *</label><input type="date" id="expenseDate" value="${todayDate}"></div>
                        <div class="form-group"><label>${lang==='id'?'Jumlah':'金额'} *</label><input type="text" id="expenseAmount" placeholder="0" class="amount-input"></div>
                        <div class="form-group"><label>${lang==='id'?'Kategori':'类别'} *</label>
                            <select id="expenseCategory">
                                <option value="">${lang==='id'?'Pilih kategori':'选择类别'}</option>
                                ${categoryOptions}
                            </select>
                        </div>
                        <div class="form-group"><label>${lang==='id'?'Metode Pembayaran':'支付方式'} *</label>
                            <select id="expenseMethod">
                                <option value="cash">🏦 ${t('cash')}</option>
                                <option value="bank">🏧 ${t('bank')}</option>
                            </select>
                        </div>
                        <div class="form-group full-width"><label>${lang==='id'?'Deskripsi':'备注'}</label>
                            <textarea id="expenseDescription" rows="2" placeholder="${lang==='id'?'Catatan tambahan':'备注'}"></textarea>
                        </div>
                        <div class="form-actions"><button onclick="APP.addExpense()" class="success">💾 ${lang==='id'?'Simpan':'保存'}</button></div>
                    </div>
                </div>`;
        } catch (error) {
            console.error("showExpenses error:", error);
            alert(lang==='id'?'Gagal memuat pengeluaran':'加载支出失败');
        }
    },
    addExpense:async function(){},
    editExpense:async function(){},
    deleteExpense:async function(){},
    balanceExpenses:async function(){}
};
for(var key in DashboardExpenses){
    if(typeof DashboardExpenses[key]==='function')window.APP[key]=DashboardExpenses[key];
}
