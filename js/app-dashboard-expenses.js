// app-dashboard-expenses.js - v2.0 (JF 命名空间)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const ExpensesPage = {
        // ==================== 构建运营支出页面 HTML ====================
        async buildExpensesHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();

            try {
                // 获取支出数据
                const client = SUPABASE.getClient();
                let query = client.from('expenses').select('*, stores(name)').order('expense_date', { ascending: false });
                
                if (!isAdmin && profile?.store_id) {
                    query = query.eq('store_id', profile.store_id);
                }
                
                const { data: expenses, error } = await query;
                if (error) throw error;

                const methodMap = {
                    cash: lang === 'id' ? '🏦 Tunai' : '💰 现金',
                    bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI'
                };

                // 计算总计
                let totalAmount = 0;
                for (const exp of expenses || []) {
                    totalAmount += (exp.amount || 0);
                }

                // 构建表格行
                let rows = '';
                if (!expenses || expenses.length === 0) {
                    rows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td>`;
                } else {
                    for (const exp of expenses) {
                        const methodClass = exp.payment_method === 'cash' ? 'cash' : 'bank';
                        rows += `<tr>
                            <td class="date-cell">${Utils.formatDate(exp.expense_date)}</td>
                            <td class="col-type">${Utils.escapeHtml(exp.category || '-')}</td>
                            <td class="amount">${Utils.formatCurrency(exp.amount)}</td>
                            <td class="text-center"><span class="badge badge--${methodClass}">${methodMap[exp.payment_method] || '-'}</span></td>
                            <td class="desc-cell">${Utils.escapeHtml(exp.description || '-')}</td>
                            ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(exp.stores?.name || '-')}</td>` : ''}
                        </tr>`;
                    }
                }

                const content = `
                    <div class="page-header">
                        <h2>📝 ${t('expenses')}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                            <button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${t('print')}</button>
                        </div>
                    </div>
                    
                    <div class="stats-grid stats-grid--auto">
                        <div class="card card--stat">
                            <div class="stat-value expense">${Utils.formatCurrency(totalAmount)}</div>
                            <div class="stat-label">${t('total_expenses')}</div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>${lang === 'id' ? 'Daftar Pengeluaran' : '支出列表'}</h3>
                        <div class="table-container">
                            <table class="data-table expense-table">
                                <thead>
                                    <tr>
                                        <th class="col-date">${t('date')}</th>
                                        <th class="col-type">${lang === 'id' ? 'Kategori' : '类别'}</th>
                                        <th class="col-amount amount">${t('amount')}</th>
                                        <th class="col-method text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                        <th class="col-desc">${t('description')}</th>
                                        ${isAdmin ? `<th class="col-store text-center">${t('store')}</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>${lang === 'id' ? 'Tambah Pengeluaran Baru' : '新增运营支出'}</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>${t('date')} *</label>
                                <input type="date" id="expenseDate" value="${Utils.getLocalToday()}">
                            </div>
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Kategori' : '类别'} *</label>
                                <select id="expenseCategory">
                                    <option value="${lang === 'id' ? 'Operasional' : '运营'}">${lang === 'id' ? 'Operasional' : '运营'}</option>
                                    <option value="${lang === 'id' ? 'Gaji' : '薪资'}">${lang === 'id' ? 'Gaji' : '薪资'}</option>
                                    <option value="${lang === 'id' ? 'Sewa' : '租金'}">${lang === 'id' ? 'Sewa' : '租金'}</option>
                                    <option value="${lang === 'id' ? 'Listrik & Air' : '水电'}">${lang === 'id' ? 'Listrik & Air' : '水电'}</option>
                                    <option value="${lang === 'id' ? 'Promosi' : '推广'}">${lang === 'id' ? 'Promosi' : '推广'}</option>
                                    <option value="${lang === 'id' ? 'Lainnya' : '其他'}">${lang === 'id' ? 'Lainnya' : '其他'}</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>${t('amount')} *</label>
                                <input type="text" id="expenseAmount" class="amount-input" placeholder="0">
                            </div>
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Metode Pembayaran' : '支付方式'}</label>
                                <select id="expenseMethod">
                                    <option value="cash">🏦 ${lang === 'id' ? 'Tunai' : '现金'}</option>
                                    <option value="bank">🏧 ${lang === 'id' ? 'Bank BNI' : '银行BNI'}</option>
                                </select>
                            </div>
                            <div class="form-group full-width">
                                <label>${t('description')}</label>
                                <textarea id="expenseDesc" rows="2" placeholder="${lang === 'id' ? 'Deskripsi pengeluaran...' : '支出描述...'}"></textarea>
                            </div>
                            <div class="form-actions">
                                <button onclick="APP.addExpense()" class="btn btn--success">💾 ${t('save')}</button>
                            </div>
                        </div>
                    </div>`;

                // 绑定金额输入格式化
                setTimeout(() => {
                    const amountInput = document.getElementById('expenseAmount');
                    if (amountInput && Utils.bindAmountFormat) {
                        Utils.bindAmountFormat(amountInput);
                    }
                }, 100);

                return content;
            } catch (error) {
                console.error("buildExpensesHTML error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data pengeluaran' : '加载支出数据失败');
                return `<div class="card"><p>❌ ${Utils.t('loading_failed', { module: lang === 'id' ? 'pengeluaran' : '支出' })}</p>
                        <button onclick="location.reload()" class="btn btn--sm" style="margin-top:12px;">🔄 ${lang === 'id' ? 'Coba Lagi' : '重试'}</button>
                        </div>`;
            }
        },

        // 供外壳调用的渲染函数
        async renderExpensesHTML() {
            return await this.buildExpensesHTML();
        },

        // 原有的 showExpenses
        async showExpenses() {
            APP.currentPage = 'expenses';
            APP.saveCurrentPageState();
            const contentHTML = await this.buildExpensesHTML();
            document.getElementById("app").innerHTML = contentHTML;
        },

        // 添加支出
        async addExpense() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            
            const expenseDate = document.getElementById('expenseDate')?.value;
            const category = document.getElementById('expenseCategory')?.value;
            const amountStr = document.getElementById('expenseAmount')?.value || '0';
            const amount = Utils.parseNumberFromCommas(amountStr);
            const paymentMethod = document.getElementById('expenseMethod')?.value || 'cash';
            const description = document.getElementById('expenseDesc')?.value.trim();

            if (!expenseDate || !category || amount <= 0) {
                Utils.toast.warning(t('fill_all_fields'));
                return;
            }

            const addBtn = document.querySelector('.card:last-child .btn--success');
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
            }

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const client = SUPABASE.getClient();
                
                const { error } = await client.from('expenses').insert({
                    store_id: profile?.store_id,
                    expense_date: expenseDate,
                    category: category,
                    amount: amount,
                    payment_method: paymentMethod,
                    description: description || null,
                    created_by: profile?.id,
                    is_locked: true,
                    is_reconciled: false,
                    created_at: Utils.getLocalDateTime(),
                    updated_at: Utils.getLocalDateTime()
                });
                
                if (error) throw error;
                
                // 记录现金流
                await SUPABASE.recordCashFlow({
                    store_id: profile?.store_id,
                    flow_type: 'expense',
                    direction: 'outflow',
                    amount: amount,
                    source_target: paymentMethod,
                    description: category
                });
                
                Utils.toast.success(lang === 'id' ? 'Pengeluaran berhasil ditambahkan' : '支出添加成功');
                
                // 刷新页面
                await this.showExpenses();
                
            } catch (error) {
                console.error("addExpense error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal menambahkan: ' + error.message : '添加失败：' + error.message);
            } finally {
                if (addBtn) {
                    addBtn.disabled = false;
                    addBtn.textContent = '💾 ' + t('save');
                }
            }
        }
    };

    // 挂载到命名空间
    JF.ExpensesPage = ExpensesPage;

    // 向下兼容 APP 方法
    if (window.APP) {
        window.APP.showExpenses = ExpensesPage.showExpenses.bind(ExpensesPage);
        window.APP.addExpense = ExpensesPage.addExpense.bind(ExpensesPage);
    } else {
        window.APP = {
            showExpenses: ExpensesPage.showExpenses.bind(ExpensesPage),
            addExpense: ExpensesPage.addExpense.bind(ExpensesPage)
        };
    }

    console.log('✅ JF.ExpensesPage v2.0 初始化完成');
})();
