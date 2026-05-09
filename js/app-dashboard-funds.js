// app-dashboard-funds.js - v2.0 管理员排除练习门店数据

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const FundsPage = {
        // ==================== 获取流水类型翻译映射 ====================
        _getFlowTypeMap(lang) {
            return {
                loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
                admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
                service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
                interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
                principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
                expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
                internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
                internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入',
                interest_reversal: lang === 'id' ? '↩️ Batal Bunga' : '↩️ 利息冲销',
                principal_reversal: lang === 'id' ? '↩️ Batal Pokok' : '↩️ 本金冲销',
                admin_fee_reversal: lang === 'id' ? '↩️ Batal Admin Fee' : '↩️ 管理费冲销',
                service_fee_reversal: lang === 'id' ? '↩️ Batal Service Fee' : '↩️ 服务费冲销',
                collateral_sale_principal: lang === 'id' ? '💎 Jual Jaminan - Pokok' : '💎 变卖抵押物-本金',
                collateral_sale_interest: lang === 'id' ? '💎 Jual Jaminan - Bunga' : '💎 变卖抵押物-利息',
                collateral_sale_surplus: lang === 'id' ? '💎 Jual Jaminan - Surplus' : '💎 变卖抵押物-盈余',
                collateral_sale_loss: lang === 'id' ? '💎 Jual Jaminan - Rugi' : '💎 变卖抵押物-亏损',
                capital_injection: lang === 'id' ? '💉 Injeksi Modal' : '💉 资本注入',
                profit_reinvest: lang === 'id' ? '🔄 Reinvestasi Laba' : '🔄 利润再投入',
                return_of_capital: lang === 'id' ? '📤 Pengembalian Modal' : '📤 偿还本金',
                dividend_withdrawal: lang === 'id' ? '💸 Penarikan Dividen' : '💸 红利提取',
            };
        },

        // ==================== 构建资金流水页面 HTML（纯内容） ====================
        // 【v2.2 修改】管理员排除练习门店
        async buildCashFlowPageHTML() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            const isStaff = PERMISSION.isStaff();

            try {
                let transactions = [];
                const client = SUPABASE.getClient();

                if (isAdmin) {
                    // 管理员查询时排除练习门店
                    let q = client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('is_voided', false).order('recorded_at', { ascending: false });
                    const practiceIds = await SUPABASE._getPracticeStoreIds();
                    if (practiceIds.length > 0) {
                        q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                    }
                    const { data: allFlows } = await q;
                    transactions = allFlows || [];
                } else if (isStaff) {
                    // 员工仅可查看本人操作的资金流水记录
                    const { data: staffFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id)
                        .eq('is_voided', false)
                        .eq('recorded_by', profile?.id)
                        .order('recorded_at', { ascending: false });
                    transactions = staffFlows || [];
                } else {
                    // 店长：查看本店全部流水
                    const { data: storeFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id).eq('is_voided', false)
                        .order('recorded_at', { ascending: false });
                    transactions = storeFlows || [];
                }

                const typeMap = FundsPage._getFlowTypeMap(lang);
                const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
                const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };

                let rows = '';
                if (transactions.length === 0) {
                    rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td>`;
                } else {
                    for (const t of transactions) {
                        rows += `<tr>
                            <td class="date-cell">${Utils.formatDate(t.recorded_at)}</td>
                            <td>${typeMap[t.flow_type] || t.flow_type}</td>
                            <td class="text-center">${directionMap[t.direction] || t.direction}</td>
                            <td class="text-center">${sourceMap[t.source_target] || t.source_target}</td>
                            <td class="amount">${Utils.formatCurrency(t.amount)}</td>
                            <td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>
                            ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}
                        </tr>`;
                    }
                }

                // 员工受限提示
                let staffRestrictionHtml = '';
                if (isStaff) {
                    staffRestrictionHtml = `
                        <div class="info-bar info" style="margin-bottom: 16px;">
                            <span class="info-bar-icon">🔒</span>
                            <div class="info-bar-content">
                                <strong>${lang === 'id' ? 'Akses Terbatas' : '访问受限'}</strong><br>
                                ${lang === 'id'
                                    ? 'Anda hanya dapat melihat riwayat transaksi yang Anda buat sendiri. Untuk melihat arus kas toko lengkap, hubungi manajer toko.'
                                    : '您仅可查看本人操作的交易记录。如需查看完整门店资金流水，请联系店长。'}
                            </div>
                        </div>
                    `;
                }

                const content = `
                    <div class="page-header"><h2>💰 ${lang === 'id' ? 'Riwayat Arus Kas' : '资金流水记录'}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${Utils.t('back')}</button><button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${Utils.t('print')}</button></div></div>
                    ${staffRestrictionHtml}
                    <div class="card">
                        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;" class="no-print">
                            <input type="date" id="cashFlowFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                            <input type="date" id="cashFlowFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                            <button onclick="APP.filterCashFlowPage()" class="btn btn--sm">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                            <button onclick="APP.resetCashFlowPageFilters()" class="btn btn--sm">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                        </div>
                        <div class="table-container">
                            <table class="data-table cashflow-table">
                                <thead><tr>
                                    <th class="col-date">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                    <th class="col-type">${lang === 'id' ? 'Tipe' : '类型'}</th>
                                    <th class="col-status text-center">${lang === 'id' ? 'Arah' : '方向'}</th>
                                    <th class="col-method text-center">${lang === 'id' ? 'Sumber' : '来源/去向'}</th>
                                    <th class="col-amount amount">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                    <th class="col-desc">${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                    ${isAdmin ? `<th class="col-store text-center">${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                </tr></thead>
                                <tbody id="cashFlowPageBody">${rows}</tbody>
                            </table>
                        </div>
                    </div>`;

                window._cashFlowPageData = transactions;
                return content;
            } catch (error) {
                console.error("buildCashFlowPageHTML error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data arus kas' : '加载资金流水失败');
                return `<div class="card"><p>❌ ${Utils.t('loading_failed', { module: '资金流水' })}</p></div>`;
            }
        },

        // 供外壳调用
        async renderCashFlowPageHTML() {
            return await this.buildCashFlowPageHTML();
        },

        // 原有的 showCashFlowPage
        async showCashFlowPage() {
            APP.currentPage = 'paymentHistory';
            APP.saveCurrentPageState();
            const contentHTML = await this.buildCashFlowPageHTML();
            document.getElementById("app").innerHTML = contentHTML;
        },

        filterCashFlowPage() {
            const transactions = window._cashFlowPageData || [];
            const startDate = document.getElementById('cashFlowFilterStart')?.value;
            const endDate = document.getElementById('cashFlowFilterEnd')?.value;
            const filtered = transactions.filter(t => {
                if (startDate && t.recorded_at < startDate) return false;
                if (endDate && t.recorded_at > endDate + 'T23:59:59') return false;
                return true;
            });
            FundsPage._renderCashFlowPageTable(filtered);
        },

        resetCashFlowPageFilters() {
            document.getElementById('cashFlowFilterStart').value = '';
            document.getElementById('cashFlowFilterEnd').value = '';
            FundsPage.filterCashFlowPage();
        },

        _renderCashFlowPageTable(transactions) {
            const tbody = document.getElementById('cashFlowPageBody');
            if (!tbody) return;
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            const typeMap = FundsPage._getFlowTypeMap(lang);
            const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
            const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };
            let rows = '';
            if (transactions.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td>`;
            } else {
                for (const t of transactions) {
                    rows += `<tr><td class="date-cell">${Utils.formatDate(t.recorded_at)}</td><td>${typeMap[t.flow_type] || t.flow_type}</td><td class="text-center">${directionMap[t.direction] || t.direction}</td><td class="text-center">${sourceMap[t.source_target] || t.source_target}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
                }
            }
            tbody.innerHTML = rows;
        },

        // ==================== 原有弹窗、转账、导出等方法（完整保留） ====================
        // 管理员排除练习门店
        async showCapitalModal() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            const isStaff = PERMISSION.isStaff();
            try {
                let transactions = [];
                const client = SUPABASE.getClient();
                if (isAdmin) {
                    // 管理员查询时排除练习门店
                    let q = client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('is_voided', false).order('recorded_at', { ascending: false });
                    const practiceIds = await SUPABASE._getPracticeStoreIds();
                    if (practiceIds.length > 0) {
                        q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                    }
                    const { data: allFlows } = await q;
                    transactions = allFlows || [];
                } else if (isStaff) {
                    // 员工在弹窗中也仅查看本人记录
                    const { data: staffFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id)
                        .eq('is_voided', false)
                        .eq('recorded_by', profile?.id)
                        .order('recorded_at', { ascending: false });
                    transactions = staffFlows || [];
                } else {
                    const { data: storeFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id).eq('is_voided', false)
                        .order('recorded_at', { ascending: false });
                    transactions = storeFlows || [];
                }

                const typeMap = FundsPage._getFlowTypeMap(lang);
                const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
                const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };

                let rows = '';
                if (transactions.length === 0) {
                    rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td>`;
                } else {
                    for (const t of transactions) {
                        rows += `<tr>
                            <td class="date-cell">${Utils.formatDate(t.recorded_at)}</td>
                            <td>${typeMap[t.flow_type] || t.flow_type}</td>
                            <td class="text-center">${directionMap[t.direction] || t.direction}</td>
                            <td class="text-center">${sourceMap[t.source_target] || t.source_target}</td>
                            <td class="amount">${Utils.formatCurrency(t.amount)}</td>
                            <td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>
                            ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}
                        </tr>`;
                    }
                }

                const oldModal = document.getElementById('capitalModal');
                if (oldModal) oldModal.remove();

                const modalHtml = `
                    <div id="capitalModal" class="modal-overlay">
                        <div class="modal-content" style="max-width:1000px;">
                            <h3>🏦 ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</h3>
                            ${isStaff ? `
                            <div class="info-bar info" style="margin-bottom: 12px;">
                                <span class="info-bar-icon">🔒</span>
                                <div class="info-bar-content">
                                    ${lang === 'id'
                                        ? 'Anda hanya dapat melihat transaksi yang Anda buat sendiri.'
                                        : '您仅可查看本人操作的交易记录。'}
                                </div>
                            </div>
                            ` : ''}
                            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                                <input type="text" id="capitalFilterDesc" placeholder="🔍 ${lang === 'id' ? 'Cari deskripsi...' : '搜索描述...'}" style="flex:1;">
                                <select id="capitalFilterType" style="width:auto;">
                                    <option value="">${lang === 'id' ? 'Semua tipe' : '全部类型'}</option>
                                    <option value="loan_disbursement">${lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放'}</option>
                                    <option value="admin_fee">${lang === 'id' ? 'Admin Fee' : '管理费'}</option>
                                    <option value="service_fee">${lang === 'id' ? 'Service Fee' : '服务费'}</option>
                                    <option value="interest">${lang === 'id' ? 'Bunga' : '利息'}</option>
                                    <option value="principal">${lang === 'id' ? 'Pokok' : '本金'}</option>
                                    <option value="expense">${lang === 'id' ? 'Pengeluaran' : '运营支出'}</option>
                                </select>
                                <input type="date" id="capitalFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                                <input type="date" id="capitalFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                                <button onclick="APP.filterCapitalTransactions()" class="btn btn--sm">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                                <button onclick="APP.resetCapitalFilters()" class="btn btn--sm">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                            </div>
                            <div class="table-container" style="max-height:400px;overflow-y:auto;">
                                <table class="data-table capital-table" style="min-width:700px;">
                                    <thead><tr>
                                        <th class="col-date">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                        <th class="col-type">${lang === 'id' ? 'Tipe' : '类型'}</th>
                                        <th class="col-status text-center">${lang === 'id' ? 'Arah' : '方向'}</th>
                                        <th class="col-method text-center">${lang === 'id' ? 'Sumber' : '来源/去向'}</th>
                                        <th class="col-amount amount">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        <th class="col-desc">${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                        ${isAdmin ? `<th class="col-store text-center">${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                    </tr></thead>
                                    <tbody id="capitalTransactionsBody">${rows}</tbody>
                                </table>
                            </div>
                            <div class="modal-actions">
                                ${!isStaff ? `<button onclick="APP.printCapitalTransactions()" class="btn btn--outline">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                                <button onclick="APP.exportCapitalTransactionsToCSV()" class="btn btn--success">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>` : ''}
                                <button onclick="APP.closeCapitalModal()" class="btn btn--outline">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                            </div>
                        </div>
                    </div>`;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                window._capitalTransactionsData = transactions;
            } catch (error) {
                console.error("showCapitalModal error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data transaksi' : '加载交易记录失败');
            }
        },

        closeCapitalModal() {
            const modal = document.getElementById('capitalModal');
            if (modal) modal.remove();
        },

        filterCapitalTransactions() {
            const transactions = window._capitalTransactionsData || [];
            const searchDesc = document.getElementById('capitalFilterDesc')?.value.toLowerCase() || '';
            const filterType = document.getElementById('capitalFilterType')?.value || '';
            const startDate = document.getElementById('capitalFilterStart')?.value;
            const endDate = document.getElementById('capitalFilterEnd')?.value;
            const filtered = transactions.filter(t => {
                if (filterType && t.flow_type !== filterType) return false;
                if (searchDesc && !(t.description || '').toLowerCase().includes(searchDesc)) return false;
                if (startDate && t.recorded_at < startDate) return false;
                if (endDate && t.recorded_at > endDate + 'T23:59:59') return false;
                return true;
            });
            FundsPage._renderCapitalTransactionsTable(filtered);
        },

        resetCapitalFilters() {
            document.getElementById('capitalFilterDesc').value = '';
            document.getElementById('capitalFilterType').value = '';
            document.getElementById('capitalFilterStart').value = '';
            document.getElementById('capitalFilterEnd').value = '';
            FundsPage.filterCapitalTransactions();
        },

        _renderCapitalTransactionsTable(transactions) {
            const tbody = document.getElementById('capitalTransactionsBody');
            if (!tbody) return;
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            const typeMap = FundsPage._getFlowTypeMap(lang);
            const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
            const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };
            let rows = '';
            if (transactions.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td>`;
            } else {
                for (const t of transactions) {
                    rows += `<tr><td class="date-cell">${Utils.formatDate(t.recorded_at)}</td><td>${typeMap[t.flow_type] || t.flow_type}</td><td class="text-center">${directionMap[t.direction] || t.direction}</td><td class="text-center">${sourceMap[t.source_target] || t.source_target}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
                }
            }
            tbody.innerHTML = rows;
        },

        printCapitalTransactions() {
            const modalContent = document.querySelector('#capitalModal .modal-content');
            if (!modalContent) return;
            const lang = Utils.lang;
            const storeName = AUTH.getCurrentStoreName();
            const userName = AUTH.user?.name || '-';
            const printDateTime = new Date().toLocaleString();
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>JF! by Gadai - ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.4;color:#1e293b;padding:15mm}.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:10px}.header h1{font-size:18px;margin:5px 0}.store-info{text-align:center;font-size:10pt;color:#475569;margin:5px 0}.user-info{text-align:center;font-size:9pt;color:#64748b;margin-bottom:15px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:10px}th{background:#f1f5f9;font-weight:700}.text-right{text-align:right}.text-center{text-align:center}.income{color:#10b981}.expense{color:#ef4444}.footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}.no-print{text-align:center;margin-bottom:15px}.no-print button{margin:0 5px;padding:6px 14px;cursor:pointer;border:none;border-radius:4px}@media print{.no-print{display:none}@page{size:A4;margin:15mm}}</style></head><body><div class="no-print"><button onclick="window.print()">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button><button onclick="window.close()">${lang === 'id' ? 'Tutup' : '关闭'}</button></div><div class="header"><h1>JF! by Gadai</h1><div class="store-info">🏪 ${Utils.escapeHtml(storeName)}</div><div class="user-info">👤 ${Utils.escapeHtml(userName)} | 📅 ${printDateTime}</div><h3>💰 ${lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录'}</h3></div>${modalContent.querySelector('.table-container')?.innerHTML || ''}<div class="footer"><div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div><div>${lang === 'id' ? 'Terima kasih' : '感谢您的信任'}</div></div></body></html>`);
            printWindow.document.close();
        },

        exportCapitalTransactionsToCSV() {
            const transactions = window._capitalTransactionsData || [];
            const lang = Utils.lang;
            const headers = lang === 'id' ? ['Tanggal', 'Tipe', 'Arah', 'Sumber', 'Jumlah', 'Deskripsi'] : ['日期', '类型', '方向', '来源/去向', '金额', '描述'];
            const typeMap = FundsPage._getFlowTypeMap(lang);
            const rows = transactions.map(t => [t.recorded_at.split('T')[0], typeMap[t.flow_type] || t.flow_type, t.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出'), t.source_target === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'), t.amount, t.description || '-']);
            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `jf_cash_flow_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
            Utils.toast.success(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
        },

        async showTransferModal(transferType) {
            const lang = Utils.lang;
            
            // 员工禁止发起内部转账（双重保险：UI层也拦截）
            if (PERMISSION.isStaff()) {
                Utils.toast.warning(lang === 'id'
                    ? 'Hanya manajer toko dan administrator yang dapat melakukan transfer internal.'
                    : '仅店长和管理员可发起内部转账。');
                return;
            }
            
            let title, fromLabel, toLabel, maxAmount;
            const cashFlow = await SUPABASE.getCashFlowSummary();
            switch (transferType) {
                case 'cash_to_bank':
                    title = lang === 'id' ? '💰 Transfer Kas ke Bank' : '💰 现金存入银行';
                    fromLabel = lang === 'id' ? 'Dari Brankas (Tunai)' : '从保险柜（现金）';
                    toLabel = lang === 'id' ? 'Ke Bank BNI' : '存入银行 BNI';
                    maxAmount = cashFlow.cash.balance;
                    break;
                case 'bank_to_cash':
                    title = lang === 'id' ? '💰 Tarik Tunai dari Bank' : '💰 银行取出现金';
                    fromLabel = lang === 'id' ? 'Dari Bank BNI' : '从银行 BNI';
                    toLabel = lang === 'id' ? 'Ke Brankas (Tunai)' : '存入保险柜（现金）';
                    maxAmount = cashFlow.bank.balance;
                    break;
                case 'store_to_hq':
                    title = lang === 'id' ? '🏢 Setoran ke Kantor Pusat' : '🏢 上缴总部';
                    fromLabel = lang === 'id' ? 'Dari Bank Toko' : '从门店银行';
                    toLabel = lang === 'id' ? 'Ke Kantor Pusat' : '上缴总部';
                    const profile = await SUPABASE.getCurrentProfile();
                    const shopAccount = await SUPABASE.getShopAccount(profile?.store_id);
                    maxAmount = shopAccount.bank_balance;
                    break;
                default: return;
            }
            if (maxAmount <= 0) { Utils.toast.warning(lang === 'id' ? '❌ Saldo tidak mencukupi' : '❌ 余额不足'); return; }
            const amountStr = prompt(`${title}\n\n${fromLabel}\n${toLabel}\n\n${lang === 'id' ? 'Maksimal' : '最大'}: ${Utils.formatCurrency(maxAmount)}\n\n${lang === 'id' ? 'Masukkan jumlah:' : '请输入金额:'}`, Utils.formatNumberWithCommas(maxAmount));
            if (!amountStr) return;
            const amount = Utils.parseNumberFromCommas(amountStr);
            if (isNaN(amount) || amount <= 0) { Utils.toast.warning(lang === 'id' ? 'Jumlah tidak valid' : '金额无效'); return; }
            if (amount > maxAmount) { Utils.toast.warning(lang === 'id' ? 'Jumlah melebihi saldo' : '金额超过余额'); return; }
            const confirmMsg = lang === 'id' ? `Konfirmasi transfer:\n\n${fromLabel} → ${toLabel}\n${Utils.formatCurrency(amount)}\n\nLanjutkan?` : `确认转账：\n\n${fromLabel} → ${toLabel}\n${Utils.formatCurrency(amount)}\n\n继续吗？`;
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (confirmed) await FundsPage.executeTransfer(transferType, amount);
        },

        async executeTransfer(transferType, amount) {
            const lang = Utils.lang;
            
            // 员工禁止执行内部转账（双重保险）
            if (PERMISSION.isStaff()) {
                Utils.toast.warning(lang === 'id'
                    ? 'Hanya manajer toko dan administrator yang dapat melakukan transfer internal.'
                    : '仅店长和管理员可发起内部转账。');
                return;
            }
            
            const profile = await SUPABASE.getCurrentProfile();
            try {
                if (transferType === 'cash_to_bank') {
                    await SUPABASE.recordInternalTransfer({ transfer_type: 'cash_to_bank', from_account: 'cash', to_account: 'bank', amount, description: lang === 'id' ? 'Transfer kas ke bank' : '现金存入银行', store_id: profile?.store_id });
                } else if (transferType === 'bank_to_cash') {
                    await SUPABASE.recordInternalTransfer({ transfer_type: 'bank_to_cash', from_account: 'bank', to_account: 'cash', amount, description: lang === 'id' ? 'Tarik tunai dari bank' : '银行取出现金', store_id: profile?.store_id });
                } else if (transferType === 'store_to_hq') {
                    await SUPABASE.remitToHeadquarters(profile?.store_id, amount, lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部');
                }
                Utils.toast.success(lang === 'id' ? '✅ Transfer berhasil' : '✅ 转账成功');
                await APP.renderDashboard();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? '❌ Gagal: ' + error.message : '❌ 失败：' + error.message);
            }
        },

        async showInternalTransferHistory() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            try {
                const transfers = await SUPABASE.getInternalTransfers();
                const typeMap = {
                    cash_to_bank: lang === 'id' ? '🏦→🏧 Kas ke Bank' : '🏦→🏧 现金存入银行',
                    bank_to_cash: lang === 'id' ? '🏧→🏦 Tarik Tunai' : '🏧→🏦 银行取出现金',
                    store_to_hq: lang === 'id' ? '🏢 Setoran ke Pusat' : '🏢 上缴总部',
                };
                let rows = '';
                if (transfers.length === 0) {
                    rows = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-center">${lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录'}</tr>`;
                } else {
                    for (const t of transfers) {
                        rows += `<tr><td class="date-cell">${Utils.formatDate(t.transfer_date)}</td><td>${typeMap[t.transfer_type] || t.transfer_type}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td><td>${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
                    }
                }
                const modalHtml = `<div id="internalTransferModal" class="modal-overlay"><div class="modal-content" style="max-width:800px;"><h3>🔄 ${lang === 'id' ? 'Riwayat Transfer Internal' : '内部转账记录'}</h3><div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;"><input type="date" id="transferFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}"><input type="date" id="transferFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}"><button onclick="APP.filterInternalTransferHistory()" class="btn btn--sm">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button><button onclick="APP.resetInternalTransferFilters()" class="btn btn--sm">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button></div><div class="table-container" style="max-height:400px;overflow-y:auto;"><table class="data-table transfer-table" style="min-width:600px;"><thead><tr><th class="col-date">${lang === 'id' ? 'Tanggal' : '日期'}</th><th class="col-type">${lang === 'id' ? 'Jenis Transfer' : '转账类型'}</th><th class="col-amount amount">${lang === 'id' ? 'Jumlah' : '金额'}</th><th class="col-desc">${lang === 'id' ? 'Deskripsi' : '描述'}</th><th class="col-name">${lang === 'id' ? 'Oleh' : '操作人'}</th>${isAdmin ? `<th class="col-store text-center">${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}</tr></thead><tbody id="internalTransferBody">${rows}</tbody></table></div><div class="modal-actions"><button onclick="APP.exportInternalTransferToCSV()" class="btn btn--success">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button><button onclick="APP.closeInternalTransferModal()" class="btn btn--outline">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button></div></div></div>`;
                const oldModal = document.getElementById('internalTransferModal');
                if (oldModal) oldModal.remove();
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                window._internalTransfersData = transfers;
            } catch (error) {
                console.error("showInternalTransferHistory error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat riwayat transfer' : '加载转账记录失败');
            }
        },

        closeInternalTransferModal() { const modal = document.getElementById('internalTransferModal'); if (modal) modal.remove(); },
        filterInternalTransferHistory() {
            const transfers = window._internalTransfersData || [];
            const startDate = document.getElementById('transferFilterStart')?.value;
            const endDate = document.getElementById('transferFilterEnd')?.value;
            const filtered = transfers.filter(t => {
                if (startDate && t.transfer_date < startDate) return false;
                if (endDate && t.transfer_date > endDate) return false;
                return true;
            });
            FundsPage._renderInternalTransferHistory(filtered);
        },
        resetInternalTransferFilters() { document.getElementById('transferFilterStart').value = ''; document.getElementById('transferFilterEnd').value = ''; FundsPage.filterInternalTransferHistory(); },

        _renderInternalTransferHistory(transfers) {
            const tbody = document.getElementById('internalTransferBody');
            if (!tbody) return;
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            const typeMap = { cash_to_bank: lang === 'id' ? '🏦→🏧 Kas ke Bank' : '🏦→🏧 现金存入银行', bank_to_cash: lang === 'id' ? '🏧→🏦 Tarik Tunai' : '🏧→🏦 银行取出现金', store_to_hq: lang === 'id' ? '🏢 Setoran ke Pusat' : '🏢 上缴总部' };
            let rows = '';
            if (transfers.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-center">${lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录'}</td>`;
            } else {
                for (const t of transfers) {
                    rows += `<tr><td class="date-cell">${Utils.formatDate(t.transfer_date)}</td><td>${typeMap[t.transfer_type] || t.transfer_type}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td><td>${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
                }
            }
            tbody.innerHTML = rows;
        },

        exportInternalTransferToCSV() {
            const transfers = window._internalTransfersData || [];
            const lang = Utils.lang;
            const headers = lang === 'id' ? ['Tanggal', 'Jenis Transfer', 'Jumlah', 'Deskripsi', 'Oleh', 'Toko'] : ['日期', '转账类型', '金额', '描述', '操作人', '门店'];
            const typeMap = { cash_to_bank: lang === 'id' ? 'Kas ke Bank' : '现金存入银行', bank_to_cash: lang === 'id' ? 'Tarik Tunai' : '银行取出现金', store_to_hq: lang === 'id' ? 'Setoran ke Pusat' : '上缴总部' };
            const rows = transfers.map(t => [t.transfer_date, typeMap[t.transfer_type] || t.transfer_type, t.amount, t.description || '-', t.created_by_profile?.name || '-', t.stores?.name || '-']);
            const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `jf_internal_transfers_${new Date().toISOString().split('T')[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
            Utils.toast.success(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
        },
    };

    // 挂载到命名空间
    JF.FundsPage = FundsPage;

    // 向下兼容 APP 方法
    if (window.APP) {
        window.APP.showCashFlowPage = FundsPage.showCashFlowPage.bind(FundsPage);
        window.APP.filterCashFlowPage = FundsPage.filterCashFlowPage.bind(FundsPage);
        window.APP.resetCashFlowPageFilters = FundsPage.resetCashFlowPageFilters.bind(FundsPage);
        window.APP.showCapitalModal = FundsPage.showCapitalModal.bind(FundsPage);
        window.APP.closeCapitalModal = FundsPage.closeCapitalModal.bind(FundsPage);
        window.APP.filterCapitalTransactions = FundsPage.filterCapitalTransactions.bind(FundsPage);
        window.APP.resetCapitalFilters = FundsPage.resetCapitalFilters.bind(FundsPage);
        window.APP.printCapitalTransactions = FundsPage.printCapitalTransactions.bind(FundsPage);
        window.APP.exportCapitalTransactionsToCSV = FundsPage.exportCapitalTransactionsToCSV.bind(FundsPage);
        window.APP.showTransferModal = FundsPage.showTransferModal.bind(FundsPage);
        window.APP.executeTransfer = FundsPage.executeTransfer.bind(FundsPage);
        window.APP.showInternalTransferHistory = FundsPage.showInternalTransferHistory.bind(FundsPage);
        window.APP.closeInternalTransferModal = FundsPage.closeInternalTransferModal.bind(FundsPage);
        window.APP.filterInternalTransferHistory = FundsPage.filterInternalTransferHistory.bind(FundsPage);
        window.APP.resetInternalTransferFilters = FundsPage.resetInternalTransferFilters.bind(FundsPage);
        window.APP.exportInternalTransferToCSV = FundsPage.exportInternalTransferToCSV.bind(FundsPage);
    }

    console.log('✅ JF.FundsPage v2.0 管理员排除练习门店数据');
})();
