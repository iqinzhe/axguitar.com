// app-dashboard-expenses.js - v2.0 (JF 命名空间)
// 支出管理页面模块，挂载到 JF.ExpensesPage

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const ExpensesPage = {
        // ==================== 显示支出列表 ====================
        async showExpenses() {
            APP.currentPage = 'expenses';
            APP.saveCurrentPageState();
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();
                const storeId = profile?.store_id;

                // 获取门店列表用于显示门店名
                const storesData = await SUPABASE.getAllStores();
                const storeMap = {};
                for (const s of storesData) storeMap[s.id] = s.name;

                // 获取支出数据
                const client = SUPABASE.getClient();
                let query = client.from('expenses').select('*').order('expense_date', { ascending: false });
                if (!isAdmin && storeId) {
                    query = query.eq('store_id', storeId);
                }
                const { data: expenses, error } = await query;
                if (error) throw error;

                const finalExpenses = expenses || [];
                let totalAmount = 0;
                for (const e of finalExpenses) totalAmount += (e.amount || 0);

                const todayDate = new Date().toISOString().split('T')[0];
                const totalCols = isAdmin ? 7 : 6;

                // 构建表格行
                let rows = '';
                if (finalExpenses.length === 0) {
                    rows = `<tr><td colspan="${totalCols}" class="text-center">${t('no_data')}</td></tr>`;
                } else {
                    for (const e of finalExpenses) {
                        const methodText = e.payment_method === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank BNI' : '银行BNI');
                        const storeName = storeMap[e.store_id] || e.store_id || '-';

                        let actionHtml = '';
                        if (isAdmin) {
                            if (!e.is_reconciled) {
                                actionHtml += `<button onclick="APP.editExpense('${e.id}')" class="btn-small">✏️ ${t('edit')}</button> `;
                                actionHtml += `<button class="btn-small danger" onclick="APP.deleteExpense('${e.id}')">🗑️ ${t('delete')}</button> `;
                            } else {
                                actionHtml += `<span class="reconciled-badge">✅ ${lang === 'id' ? 'Direkonsiliasi' : '已平账'}</span> `;
                            }
                            if (!e.is_reconciled) {
                                actionHtml += `<button onclick="APP.balanceExpenses()" class="btn-small warning">⚖️ ${lang === 'id' ? 'Rekonsiliasi' : '平账'}</button>`;
                            }
                        } else {
                            actionHtml += `<span class="locked-badge">🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</span>`;
                        }

                        rows += `<tr>
                            <td class="date-cell">${Utils.formatDate(e.expense_date)}</td>
                            <td class="expense-category">${Utils.escapeHtml(e.category)}</td>
                            <td class="amount">${Utils.formatCurrency(e.amount)}</td>
                            <td class="text-center">${methodText}</td>
                            <td class="desc-cell">${Utils.escapeHtml(e.description || '-')}</td>
                            ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeName)}</td>` : ''}
                            <td class="text-center" style="white-space:nowrap;">${actionHtml}</td>
                        </tr>`;
                    }
                }

                // 类别选项
                const expenseCategories = lang === 'id'
                    ? ['Listrik', 'Air', 'Internet', 'Gaji Karyawan', 'Sewa Tempat', 'ATK', 'Perbaikan', 'Transportasi', 'Lainnya']
                    : ['电费', '水费', '网络费', '员工工资', '场地租金', '办公用品', '维修', '交通费', '其他'];
                const categoryOptions = expenseCategories.map(c => `<option value="${c}">${c}</option>`).join('');

                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>📝 ${lang === 'id' ? 'Pengeluaran Operasional' : '运营支出'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                            <button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        </div>
                    </div>
                    <div class="card">
                        <div class="stat-card" style="border:2px solid var(--danger);padding:var(--spacing-3) var(--spacing-4);">
                            <div class="stat-value expense">${Utils.formatCurrency(totalAmount)}</div>
                            <div class="stat-label">${lang === 'id' ? 'Total Pengeluaran' : '支出总额'}</div>
                        </div>
                    </div>
                    <div class="card">
                        <h3>${lang === 'id' ? 'Daftar Pengeluaran' : '支出列表'}</h3>
                        <div class="table-container">
                            <table class="data-table expense-table">
                                <thead>
                                    <tr>
                                        <th class="col-date">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                        <th class="col-type">${lang === 'id' ? 'Kategori' : '类别'}</th>
                                        <th class="col-amount amount">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        <th class="col-method text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                        <th class="col-desc">${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                        ${isAdmin ? `<th class="col-store text-center">${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                        <th class="col-action text-center">${lang === 'id' ? 'Aksi' : '操作'}</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <h3>${lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出'}</h3>
                        <div class="form-grid form-grid-4">
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Tanggal' : '日期'} *</label>
                                <input type="date" id="expenseDate" value="${todayDate}">
                            </div>
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Jumlah' : '金额'} *</label>
                                <input type="text" id="expenseAmount" placeholder="0" class="amount-input">
                            </div>
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Kategori / Penyebab' : '类别/原因'} *</label>
                                <select id="expenseCategory">
                                    <option value="">${lang === 'id' ? 'Pilih kategori' : '选择类别'}</option>
                                    ${categoryOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Metode Pembayaran' : '支付方式'} *</label>
                                <select id="expenseMethod">
                                    <option value="cash">🏦 ${t('cash')}</option>
                                    <option value="bank">🏧 ${t('bank')}</option>
                                </select>
                            </div>
                            <div class="form-group full-width">
                                <label>${lang === 'id' ? 'Deskripsi' : '描述'}</label>
                                <textarea id="expenseDescription" rows="2" placeholder="${lang === 'id' ? 'Catatan tambahan' : '备注'}"></textarea>
                            </div>
                            <div class="form-actions">
                                <button onclick="APP.addExpense()" class="success">💾 ${lang === 'id' ? 'Simpan Pengeluaran' : '保存支出'}</button>
                            </div>
                        </div>
                        <p class="info-note">💡 ${lang === 'id' ? 'Pengeluaran akan dicatat sebagai arus kas keluar (outflow) dari Brankas atau Bank BNI.' : '支出将记录为从保险柜或银行流出的资金（流出）。'}</p>
                    </div>`;

                // 绑定金额输入格式化
                const amountInput = document.getElementById("expenseAmount");
                if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
            } catch (error) {
                console.error("showExpenses error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat pengeluaran: ' + error.message : '加载支出失败：' + error.message);
            }
        },

        // ==================== 添加支出 ====================
        async addExpense() {
            const lang = Utils.lang;
            const expenseDate = document.getElementById("expenseDate").value || new Date().toISOString().split('T')[0];
            const category = document.getElementById("expenseCategory").value.trim();
            const amountStr = document.getElementById("expenseAmount").value;
            const amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
            const description = document.getElementById("expenseDescription").value;
            const paymentMethod = document.getElementById("expenseMethod").value;

            if (!category) { Utils.toast.warning(lang === 'id' ? 'Masukkan kategori' : '请输入类别'); return; }
            if (isNaN(amount) || amount <= 0) { Utils.toast.warning(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }

            try {
                const profile = await SUPABASE.getCurrentProfile();
                await SUPABASE.addExpense({
                    store_id: profile.store_id,
                    expense_date: expenseDate,
                    category,
                    amount,
                    description: description || null,
                    payment_method: paymentMethod
                });
                Utils.toast.success(lang === 'id' ? 'Pengeluaran berhasil disimpan' : '支出保存成功');
                await ExpensesPage.showExpenses();
            } catch (error) {
                console.error("addExpense error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            }
        },

        // ==================== 编辑支出 ====================
        async editExpense(expenseId) {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat mengubah pengeluaran' : '仅管理员可修改支出记录');
                return;
            }
            try {
                const client = SUPABASE.getClient();
                const { data: expense, error } = await client.from('expenses').select('*').eq('id', expenseId).single();
                if (error) throw error;
                if (expense.is_reconciled) {
                    Utils.toast.warning(lang === 'id' ? 'Pengeluaran sudah direkonsiliasi, tidak dapat diubah' : '支出已平账，不可修改');
                    return;
                }
                const newAmount = prompt(lang === 'id' ? 'Masukkan jumlah baru:' : '请输入新金额:', expense.amount);
                if (newAmount && !isNaN(parseFloat(newAmount))) {
                    await client.from('expenses').update({ amount: parseFloat(newAmount) }).eq('id', expenseId);
                    Utils.toast.success(lang === 'id' ? 'Pengeluaran berhasil diubah' : '支出已修改');
                    await ExpensesPage.showExpenses();
                }
            } catch (error) {
                console.error("editExpense error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal mengubah: ' + error.message : '修改失败：' + error.message);
            }
        },

        // ==================== 删除支出 ====================
        async deleteExpense(expenseId) {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat menghapus pengeluaran' : '仅管理员可删除支出记录');
                return;
            }
            const confirmed = await Utils.toast.confirm(lang === 'id' ? 'Hapus pengeluaran ini?' : '删除此支出记录？');
            if (!confirmed) return;
            try {
                const client = SUPABASE.getClient();
                await client.from('expenses').delete().eq('id', expenseId);
                Utils.toast.success(lang === 'id' ? 'Pengeluaran dihapus' : '支出已删除');
                await ExpensesPage.showExpenses();
            } catch (error) {
                console.error("deleteExpense error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
            }
        },

        // ==================== 平账 ====================
        async balanceExpenses() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat melakukan rekonsiliasi' : '仅管理员可执行平账操作');
                return;
            }

            const period = prompt(lang === 'id'
                ? 'Pilih periode rekonsiliasi:\n1 = Bulan ini\n2 = 6 bulan terakhir\n3 = 12 bulan terakhir\n4 = Tahun ini\n5 = Kustom'
                : '选择平账周期：\n1 = 本月\n2 = 最近6个月\n3 = 最近12个月\n4 = 本年\n5 = 自定义');
            if (!period) return;

            let startDate, endDate;
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth();
            switch (period) {
                case '1': startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
                case '2': startDate = new Date(currentYear, currentMonth - 5, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
                case '3': startDate = new Date(currentYear - 1, currentMonth, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
                case '4': startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0]; endDate = today.toISOString().split('T')[0]; break;
                case '5':
                    startDate = prompt(lang === 'id' ? 'Masukkan tanggal mulai (YYYY-MM-DD):' : '请输入开始日期 (YYYY-MM-DD):');
                    endDate = prompt(lang === 'id' ? 'Masukkan tanggal akhir (YYYY-MM-DD):' : '请输入结束日期 (YYYY-MM-DD):');
                    if (!startDate || !endDate) return;
                    break;
                default: return;
            }

            const confirmMsg = lang === 'id'
                ? `Rekonsiliasi pengeluaran dari ${startDate} sampai ${endDate}?`
                : `确认平账 ${startDate} 至 ${endDate} 期间的支出？`;
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;

            try {
                const client = SUPABASE.getClient();
                const { data: expensesToUpdate, error: fetchError } = await client
                    .from('expenses').select('id').gte('expense_date', startDate).lte('expense_date', endDate).eq('is_reconciled', false);
                if (fetchError) throw fetchError;
                const count = expensesToUpdate ? expensesToUpdate.length : 0;
                if (count === 0) {
                    Utils.toast.info(lang === 'id' ? 'Tidak ada pengeluaran yang perlu direkonsiliasi' : '没有需要平账的支出记录');
                    return;
                }
                const profile = await SUPABASE.getCurrentProfile();
                await client.from('expenses').update({
                    is_reconciled: true,
                    reconciled_at: new Date().toISOString(),
                    reconciled_by: profile?.id || null
                }).gte('expense_date', startDate).lte('expense_date', endDate).eq('is_reconciled', false);
                const successMsg = lang === 'id'
                    ? `✅ Rekonsiliasi selesai! ${count} pengeluaran telah direkonsiliasi.`
                    : `✅ 平账完成！已平账 ${count} 条支出记录。`;
                Utils.toast.success(successMsg);
                await ExpensesPage.showExpenses();
            } catch (error) {
                console.error("balanceExpenses error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal rekonsiliasi: ' + error.message : '平账失败：' + error.message);
            }
        }
    };

    // 挂载到命名空间
    JF.ExpensesPage = ExpensesPage;

    // 向下兼容：将方法挂载到 APP
    if (window.APP) {
        window.APP.showExpenses = ExpensesPage.showExpenses.bind(ExpensesPage);
        window.APP.addExpense = ExpensesPage.addExpense.bind(ExpensesPage);
        window.APP.editExpense = ExpensesPage.editExpense.bind(ExpensesPage);
        window.APP.deleteExpense = ExpensesPage.deleteExpense.bind(ExpensesPage);
        window.APP.balanceExpenses = ExpensesPage.balanceExpenses.bind(ExpensesPage);
    } else {
        window.APP = {
            showExpenses: ExpensesPage.showExpenses.bind(ExpensesPage),
            addExpense: ExpensesPage.addExpense.bind(ExpensesPage),
            editExpense: ExpensesPage.editExpense.bind(ExpensesPage),
            deleteExpense: ExpensesPage.deleteExpense.bind(ExpensesPage),
            balanceExpenses: ExpensesPage.balanceExpenses.bind(ExpensesPage),
        };
    }

    console.log('✅ JF.ExpensesPage v2.0 初始化完成');
})();
