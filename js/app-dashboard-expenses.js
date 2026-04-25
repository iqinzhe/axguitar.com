// app-dashboard-expenses.js - v1.9（修复 this.saveCurrentPageState 上下文错误、统一使用 APP 调用）

window.APP = window.APP || {};

const DashboardExpenses = {

    showExpenses: async function() {
        APP.currentPage = 'expenses';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        try {
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            const storesData = await SUPABASE.getAllStores();
            const storeMap = {};
            for (var i = 0; i < storesData.length; i++) {
                storeMap[storesData[i].id] = storesData[i].name;
            }
            
            var finalExpenses = [];
            
            try {
                var query = supabaseClient
                    .from('expenses')
                    .select('*')
                    .order('expense_date', { ascending: false });
                
                if (!isAdmin && profile?.store_id) {
                    query = query.eq('store_id', profile.store_id);
                }
                
                const { data: expenses, error } = await query;
                
                if (error) throw error;
                finalExpenses = expenses || [];
            } catch (queryError) {
                console.error("查询支出数据失败:", queryError);
                finalExpenses = [];
            }
            
            var totalAmount = 0;
            for (var i = 0; i < finalExpenses.length; i++) {
                totalAmount += finalExpenses[i].amount || 0;
            }
            var todayDate = new Date().toISOString().split('T')[0];

            var totalCols = isAdmin ? 7 : 6;
            
            var rows = '';
            if (finalExpenses.length === 0) {
                rows = '<tr><td colspan="' + totalCols + '" class="text-center">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < finalExpenses.length; i++) {
                    var e = finalExpenses[i];
                    var canEdit = isAdmin && !e.is_reconciled;
                    var methodText = (e.payment_method === 'cash') ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank BNI' : '银行BNI');
                    var storeName = storeMap[e.store_id] || e.store_id || '-';
                    
                    var actionHtml = '';
                    if (canEdit) {
                        actionHtml += '<button onclick="APP.editExpense(\'' + e.id + '\')" class="btn-small">✏️ ' + t('edit') + '</button> ';
                        actionHtml += '<button class="btn-small danger" onclick="APP.deleteExpense(\'' + e.id + '\')">🗑️ ' + t('delete') + '</button>';
                    } else if (e.is_reconciled) {
                        actionHtml += '<span class="reconciled-badge">✅ ' + (lang === 'id' ? 'Direkonsiliasi' : '已平账') + '</span>';
                    } else if (!isAdmin) {
                        actionHtml += '<span class="locked-badge">🔒 ' + (lang === 'id' ? 'Terkunci' : '已锁定') + '</span>';
                    }
                    
                    if (isAdmin && !e.is_reconciled) {
                        actionHtml += ' <button onclick="APP.balanceExpenses()" class="btn-small btn-balance">⚖️ ' + (lang === 'id' ? 'Rekonsiliasi' : '平账') + '</button>';
                    }
                    
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(e.expense_date) + '<\/td>' +
                        '<td class="expense-category">' + Utils.escapeHtml(e.category) + '<\/td>' +
                        '<td class="text-right">' + Utils.formatCurrency(e.amount) + '<\/td>' +
                        '<td class="text-center">' + methodText + '<\/td>' +
                        '<td class="expense-desc">' + Utils.escapeHtml(e.description || '-') + '<\/td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeName) + '<\/td>' : '') +
                        '<td class="text-center action-cell">' + actionHtml + '<\/td>' +
                    '<\/tr>';
                }
            }

            var expenseCategories = lang === 'id' 
                ? ['Listrik', 'Air', 'Internet', 'Gaji Karyawan', 'Sewa Tempat', 'ATK', 'Perbaikan', 'Transportasi', 'Lainnya']
                : ['电费', '水费', '网络费', '员工工资', '场地租金', '办公用品', '维修', '交通费', '其他'];

            var categoryOptions = '';
            for (var j = 0; j < expenseCategories.length; j++) {
                categoryOptions += '<option value="' + expenseCategories[j] + '">' + expenseCategories[j] + '<\/option>';
            }

            var pageHtml = '' +
                '<div class="page-header">' +
                    '<h2>📝 ' + (lang === 'id' ? 'Pengeluaran Operasional' : '运营支出') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Total Pengeluaran' : '支出总额') + ': <span class="total-expense" style="color:var(--danger);">' + Utils.formatCurrency(totalAmount) + '</span></h3>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Daftar Pengeluaran' : '支出列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table expense-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Kategori' : '类别') + '</th>' +
                                    '<th class="text-right">' + (lang === 'id' ? 'Jumlah' : '金额') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Metode' : '支付方式') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Deskripsi' : '描述') + '</th>' +
                                    (isAdmin ? '<th class="text-center">' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : '') +
                                    '<th class="text-center">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出') + '</h3>' +
                    '<div class="form-grid">' +
                        '<div class="form-group"><label>' + (lang === 'id' ? 'Tanggal' : '日期') + ' *</label><input type="date" id="expenseDate" value="' + todayDate + '"></div>' +
                        '<div class="form-group"><label>' + (lang === 'id' ? 'Jumlah' : '金额') + ' *</label><input type="text" id="expenseAmount" placeholder="0" class="amount-input"></div>' +
                        '<div class="form-group"><label>' + (lang === 'id' ? 'Kategori / Penyebab' : '类别/原因') + ' *</label>' +
                            '<select id="expenseCategory">' +
                                '<option value="">' + (lang === 'id' ? 'Pilih kategori' : '选择类别') + '</option>' +
                                categoryOptions +
                            '</select>' +
                        '</div>' +
                        '<div class="form-group"><label>' + (lang === 'id' ? 'Metode Pembayaran' : '支付方式') + ' *</label>' +
                            '<select id="expenseMethod">' +
                                '<option value="cash">🏦 ' + t('cash') + '</option>' +
                                '<option value="bank">🏧 ' + t('bank') + '</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="form-group full-width"><label>' + (lang === 'id' ? 'Deskripsi' : '描述') + '</label>' +
                            '<textarea id="expenseDescription" rows="2" placeholder="' + (lang === 'id' ? 'Catatan tambahan' : '备注') + '"></textarea>' +
                        '</div>' +
                        '<div class="form-actions"><button onclick="APP.addExpense()" class="success">💾 ' + (lang === 'id' ? 'Simpan Pengeluaran' : '保存支出') + '</button></div>' +
                    '</div>' +
                    '<p class="info-note" style="margin-top:12px; font-size:12px; color:#64748b;">' +
                        '💡 ' + (lang === 'id' ? 'Pengeluaran akan dicatat sebagai arus kas keluar (outflow) dari Brankas atau Bank BNI.' : '支出将记录为从保险柜或银行流出的资金（流出）。') +
                    '</p>' +
                '</div>' +
                '<style>' +
                    '.expense-table .date-cell { white-space: nowrap; }' +
                    '.expense-table .expense-category { font-weight: 500; }' +
                    '.expense-table .expense-desc { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
                    '.expense-table .action-cell { white-space: nowrap; }' +
                    '.expense-table .action-cell .btn-small { margin: 1px 2px; }' +
                    '.reconciled-badge, .locked-badge { display: inline-block; padding: 4px 8px; border-radius: 20px; font-size: 0.7rem; }' +
                    '.reconciled-badge { background: #ecfdf5; color: #065f46; }' +
                    '.locked-badge { background: #f1f5f9; color: #64748b; }' +
                    '.btn-balance { background: #f59e0b !important; color: white !important; }' +
                    '.btn-balance:hover { background: #d97706 !important; }' +
                    '@media (max-width: 768px) { .expense-table .expense-desc { max-width: 100px; } .expense-table th, .expense-table td { padding: 6px 4px; font-size: 0.7rem; } }' +
                '</style>';
            
            document.getElementById("app").innerHTML = pageHtml;
            
            var amountInput = document.getElementById("expenseAmount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        } catch (error) {
            console.error("showExpenses error:", error);
            alert(lang === 'id' ? 'Gagal memuat pengeluaran: ' + error.message : '加载支出失败：' + error.message);
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
            
            await SUPABASE.addExpense({
                store_id: profile.store_id,
                expense_date: expenseDate,
                category: category,
                amount: amount,
                description: description || null,
                payment_method: paymentMethod
            });
            
            alert(lang === 'id' ? 'Pengeluaran berhasil disimpan' : '支出保存成功');
            await APP.showExpenses();
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
                const newAmountNum = parseFloat(newAmount);
                
                await supabaseClient.from('expenses').update({ amount: newAmountNum }).eq('id', expenseId);
                
                alert(lang === 'id' ? 'Pengeluaran berhasil diubah' : '支出已修改');
                await APP.showExpenses();
            }
        } catch (error) {
            console.error("editExpense error:", error);
            alert(lang === 'id' ? 'Gagal mengubah: ' + error.message : '修改失败：' + error.message);
        }
    },

    deleteExpense: async function(expenseId) {
        var lang = Utils.lang;
        
        var confirmMsg = lang === 'id' ? 'Hapus pengeluaran ini?' : '删除此支出记录？';
        if (!confirm(confirmMsg)) return;
        
        try {
            await supabaseClient.from('expenses').delete().eq('id', expenseId);
            alert(lang === 'id' ? 'Pengeluaran dihapus' : '支出已删除');
            await APP.showExpenses();
        } catch (error) {
            console.error("deleteExpense error:", error);
            alert(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    balanceExpenses: async function() {
        var lang = Utils.lang;
        var profile = null;
        try { profile = await SUPABASE.getCurrentProfile(); } catch(e) { console.warn(e); }
        var isAdmin = profile?.role === 'admin';
        if (!isAdmin) {
            alert(lang === 'id' ? 'Hanya admin yang dapat melakukan rekonsiliasi' : '仅管理员可执行平账操作');
            return;
        }
        var period = prompt(lang === 'id' 
            ? 'Pilih periode rekonsiliasi:\n1 = Bulan ini\n2 = 6 bulan terakhir\n3 = 12 bulan terakhir\n4 = Tahun ini\n5 = Kustom' 
            : '选择平账周期：\n1 = 本月\n2 = 最近6个月\n3 = 最近12个月\n4 = 本年\n5 = 自定义');
        if (!period) return;
        
        var startDate, endDate, today = new Date(), currentYear = today.getFullYear(), currentMonth = today.getMonth();
        switch(period) {
            case '1': 
                startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0]; 
                endDate = today.toISOString().split('T')[0]; 
                break;
            case '2': 
                startDate = new Date(currentYear, currentMonth - 5, 1).toISOString().split('T')[0]; 
                endDate = today.toISOString().split('T')[0]; 
                break;
            case '3': 
                startDate = new Date(currentYear - 1, currentMonth, 1).toISOString().split('T')[0]; 
                endDate = today.toISOString().split('T')[0]; 
                break;
            case '4': 
                startDate = new Date(currentYear, 0, 1).toISOString().split('T')[0]; 
                endDate = today.toISOString().split('T')[0]; 
                break;
            case '5': 
                startDate = prompt(lang === 'id' ? 'Masukkan tanggal mulai (YYYY-MM-DD):' : '请输入开始日期 (YYYY-MM-DD):'); 
                endDate = prompt(lang === 'id' ? 'Masukkan tanggal akhir (YYYY-MM-DD):' : '请输入结束日期 (YYYY-MM-DD):'); 
                if (!startDate || !endDate) return; 
                break;
            default: return;
        }
        
        if (!confirm(lang === 'id' 
            ? 'Rekonsiliasi pengeluaran dari ' + startDate + ' sampai ' + endDate + '?' 
            : '确认平账 ' + startDate + ' 至 ' + endDate + ' 期间的支出？')) return;
        
        try {
            const { data: expensesToUpdate, error: fetchError } = await supabaseClient
                .from('expenses')
                .select('id')
                .gte('expense_date', startDate)
                .lte('expense_date', endDate)
                .eq('is_reconciled', false);
            
            if (fetchError) throw fetchError;
            
            var count = expensesToUpdate ? expensesToUpdate.length : 0;
            
            if (count === 0) {
                alert(lang === 'id' ? 'Tidak ada pengeluaran yang perlu direkonsiliasi' : '没有需要平账的支出记录');
                return;
            }
            
            await supabaseClient
                .from('expenses')
                .update({ 
                    is_reconciled: true, 
                    reconciled_at: new Date().toISOString(), 
                    reconciled_by: profile?.id || null
                })
                .gte('expense_date', startDate)
                .lte('expense_date', endDate)
                .eq('is_reconciled', false);
            
            alert(lang === 'id' 
                ? '✅ Rekonsiliasi selesai! ' + count + ' pengeluaran telah direkonsiliasi.' 
                : '✅ 平账完成！已平账 ' + count + ' 条支出记录。');
            
            await APP.showExpenses();
            
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
