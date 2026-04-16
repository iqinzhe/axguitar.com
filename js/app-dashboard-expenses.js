// app-dashboard-expenses.js - 支出功能模块
// 包含：运营支出、平账功能

window.APP = window.APP || {};

const DashboardExpenses = {

    // ==================== 运营支出 ====================
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
            var totalAmount = expenses?.reduce((s, e) => s + e.amount, 0) || 0;
            var todayDate = new Date().toISOString().split('T')[0];

            var rows = '';
            if (expenses && expenses.length > 0) {
                for (var e of expenses) {
                    var canEdit = isAdmin && !e.is_reconciled;
                    var actionBtns = '';
                    if (canEdit) {
                        actionBtns = `<button onclick="APP.editExpense('${e.id}')" class="btn-small">✏️ ${t('edit')}</button>
                                     <button class="btn-small danger" onclick="APP.deleteExpense('${e.id}')">🗑️ ${t('delete')}</button>`;
                    } else if (e.is_reconciled) {
                        actionBtns = `<span class="reconciled-badge">✅ ${lang === 'id' ? 'Direkonsiliasi' : '已平账'}</span>`;
                    } else if (!isAdmin) {
                        actionBtns = `<span class="locked-badge">🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</span>`;
                    }
                    var methodText = e.payment_method === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank BNI' : '银行BNI');
                    rows += `<tr>
                        <td>${Utils.formatDate(e.expense_date)}</td>
                        <td>${Utils.escapeHtml(e.category)}</td>
                        <td class="text-right">${Utils.formatCurrency(e.amount)}</td>
                        <td>${methodText}</td>
                        <td>${Utils.escapeHtml(e.description || '-')}</td>
                        <td>${Utils.escapeHtml(e.stores?.name || '-')} (${Utils.escapeHtml(e.stores?.code || '-')})</td>
                        <td class="action-cell">${actionBtns}</td>
                    </tr>`;
                }
            } else {
                rows = `<tr><td colspan="7" class="text-center">${t('no_data')}</td></tr>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📝 ${lang === 'id' ? 'Pengeluaran Operasional' : '运营支出'}</h2>
                    <div class="header-actions">                      
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        ${PERMISSION.canReconcile() ? `<button onclick="APP.balanceExpenses()" class="btn-balance warning">⚖️ ${lang === 'id' ? 'Rekonsiliasi' : '平账'}</button>` : ''}
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Total Pengeluaran' : '支出总额'}: <span class="total-expense">${Utils.formatCurrency(totalAmount)}</span></h3>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Pengeluaran' : '支出列表'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th>${lang === 'id' ? 'Kategori' : '类别'}</th>
                                    <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                    <th>${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                    <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出'}</h3>
                    <div class="form-grid">
                        <div class="form-group"><label>${lang === 'id' ? 'Tanggal' : '日期'} *</label><input type="date" id="expenseDate" value="${todayDate}"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Jumlah' : '金额'} *</label><input type="text" id="expenseAmount" placeholder="0" class="amount-input"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Kategori / Penyebab' : '类别/原因'} *</label><input type="text" id="expenseCategory" placeholder="${lang === 'id' ? 'Contoh: Listrik, Gaji' : '例如：电费、工资'}"></div>
                        <div class="form-group"><label>${lang === 'id' ? 'Metode Pembayaran' : '支付方式'} *</label>
                            <select id="expenseMethod">
                                <option value="cash">🏦 ${t('cash')}</option>
                                <option value="bank">🏧 ${t('bank')}</option>
                            </select>
                        </div>
                        <div class="form-group full-width"><label>${lang === 'id' ? 'Deskripsi' : '描述'}</label><textarea id="expenseDescription" rows="2" placeholder="${lang === 'id' ? 'Catatan tambahan' : '备注'}"></textarea></div>
                        <div class="form-actions"><button onclick="APP.addExpense()" class="success">💾 ${lang === 'id' ? 'Simpan Pengeluaran' : '保存支出'}</button></div>
                    </div>
                </div>`;
            var amountInput = document.getElementById("expenseAmount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) {
            console.error("showExpenses error:", error);
            alert(lang === 'id' ? 'Gagal memuat pengeluaran' : '加载支出失败');
        }
    },

    addExpense: async function() {
        var lang = Utils.lang;
        var expenseDate = document.getElementById("expenseDate").value;
        if (!expenseDate) expenseDate = new Date().toISOString().split('T')[0];
        var category = document.getElementById("expenseCategory").value.trim();
        var amountStr = document.getElementById("expenseAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var description = document.getElementById("expenseDescription").value;
        var paymentMethod = document.getElementById("expenseMethod").value;
        
        if (!category) { alert(lang === 'id' ? 'Masukkan kategori' : '请输入类别'); return; }
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const { error } = await supabaseClient.from('expenses').insert({
                store_id: profile.store_id, expense_date: expenseDate, category: category, amount: amount,
                description: description || null, created_by: profile.id, is_locked: true, is_reconciled: false,
                payment_method: paymentMethod
            });
            if (error) throw error;
            alert(lang === 'id' ? 'Pengeluaran berhasil disimpan' : '支出保存成功');
            await this.showExpenses();
        } catch (error) {
            console.error("addExpense error:", error);
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },

    editExpense: async function(expenseId) {
        var lang = Utils.lang;
        try {
            const { data: expense, error } = await supabaseClient.from('expenses').select('*').eq('id', expenseId).single();
            if (error) throw error;
            if (expense.is_reconciled) {
                alert(lang === 'id' ? 'Pengeluaran sudah direkonsiliasi, tidak dapat diubah' : '支出已平账，不可修改');
                return;
            }
            var newAmount = prompt(lang === 'id' ? 'Masukkan jumlah baru:' : '请输入新金额:', expense.amount);
            if (newAmount && !isNaN(parseFloat(newAmount))) {
                const { error: updateError } = await supabaseClient.from('expenses').update({ amount: parseFloat(newAmount) }).eq('id', expenseId);
                if (updateError) throw updateError;
                alert(lang === 'id' ? 'Pengeluaran berhasil diubah' : '支出已修改');
                await this.showExpenses();
            }
        } catch (error) {
            console.error("editExpense error:", error);
            alert(lang === 'id' ? 'Gagal mengubah: ' + error.message : '修改失败：' + error.message);
        }
    },

    deleteExpense: async function(expenseId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus pengeluaran ini?' : '删除此支出记录？')) return;
        try {
            const { error } = await supabaseClient.from('expenses').delete().eq('id', expenseId);
            if (error) throw error;
            alert(lang === 'id' ? 'Pengeluaran dihapus' : '支出已删除');
            await this.showExpenses();
        } catch (error) {
            console.error("deleteExpense error:", error);
            alert(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    balanceExpenses: async function() {
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        if (!isAdmin) {
            alert(lang === 'id' ? 'Hanya admin yang dapat melakukan rekonsiliasi' : '只有管理员可以执行平账操作');
            return;
        }
        var period = prompt(lang === 'id' ? 'Pilih periode rekonsiliasi:\n1 = Bulan ini\n2 = 6 bulan terakhir\n3 = 12 bulan terakhir\n4 = Tahun ini\n5 = Kustom' : '选择平账周期：\n1 = 本月\n2 = 最近6个月\n3 = 最近12个月\n4 = 本年\n5 = 自定义');
        if (!period) return;
        var startDate, endDate, today = new Date(), currentYear = today.getFullYear(), currentMonth = today.getMonth();
        switch(period) {
            case '1': startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '2': startDate = new Date(currentYear, currentMonth - 5, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '3': startDate = new Date(currentYear - 1, currentMonth, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '4': startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
            case '5': startDate = prompt(lang === 'id' ? 'Masukkan tanggal mulai (YYYY-MM-DD):' : '请输入开始日期 (YYYY-MM-DD):'); endDate = prompt(lang === 'id' ? 'Masukkan tanggal akhir (YYYY-MM-DD):' : '请输入结束日期 (YYYY-MM-DD):'); if (!startDate || !endDate) return; break;
            default: return;
        }
        if (!confirm(lang === 'id' ? `Rekonsiliasi pengeluaran dari ${startDate} sampai ${endDate}?` : `确认平账 ${startDate} 至 ${endDate} 期间的支出？`)) return;
        try {
            const { data, error } = await supabaseClient.from('expenses').update({ is_reconciled: true, reconciled_at: new Date().toISOString(), reconciled_by: AUTH.user.id }).gte('expense_date', startDate).lte('expense_date', endDate).eq('is_reconciled', false);
            if (error) throw error;
            var count = data?.length || 0;
            alert(lang === 'id' ? `Rekonsiliasi selesai! ${count} pengeluaran telah direkonsiliasi.` : `平账完成！已平账 ${count} 条支出记录。`);
            await this.showExpenses();
        } catch (error) {
            console.error("balanceExpenses error:", error);
            alert(lang === 'id' ? 'Gagal rekonsiliasi: ' + error.message : '平账失败：' + error.message);
        }
    }
};

for (var key in DashboardExpenses) {
    if (typeof DashboardExpenses[key] === 'function') {
        window.APP[key] = DashboardExpenses[key];
    }
}
