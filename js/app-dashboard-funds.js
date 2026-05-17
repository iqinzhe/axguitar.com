// app-dashboard-funds.js - v2.0 (JF 命名空间) 

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

        // 辅助函数：获取类型显示（支持备用匹配）
        _getFlowTypeDisplay(flowType, lang) {
            const typeMap = FundsPage._getFlowTypeMap(lang);
            if (typeMap[flowType]) return typeMap[flowType];
            if (flowType && (flowType.includes('loan') || flowType.includes('disbursement'))) {
                return lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放';
            }
            return flowType || '-';
        },

        // ==================== 构建资金流水页面 HTML ====================
        async buildCashFlowPageHTML() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            const isStaff = PERMISSION.isStaff();

            try {
                let cashFlowTransactions = [];
                const client = SUPABASE.getClient();

                if (isAdmin) {
                    let q = client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('is_voided', false).order('flow_date', { ascending: false }).order('recorded_at', { ascending: false });
                    const practiceIds = await SUPABASE._getPracticeStoreIds();
                    if (practiceIds.length > 0) {
                        q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                    }
                    const { data: allFlows } = await q;
                    cashFlowTransactions = allFlows || [];
                } else if (isStaff) {
                    const { data: staffFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id)
                        .eq('is_voided', false)
                        .eq('recorded_by', profile?.id)
                        .order('flow_date', { ascending: false }).order('recorded_at', { ascending: false });
                    cashFlowTransactions = staffFlows || [];
                } else {
                    const { data: storeFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id).eq('is_voided', false)
                        .order('flow_date', { ascending: false }).order('recorded_at', { ascending: false });
                    cashFlowTransactions = storeFlows || [];
                }

                const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
                const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };

                let rows = '';
                if (cashFlowTransactions.length === 0) {
                    rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td></tr>`;
                } else {
                    for (const t of cashFlowTransactions) {
                        const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, lang);
                        // 注意：移除了每行的作废按钮
                        rows += `<tr>
                            <td class="date-cell">${Utils.formatDate(t.flow_date || t.recorded_at)}</td>
                            <td class="col-type">${typeDisplay}</td>
                            <td class="text-center">${directionMap[t.direction] || t.direction}</td>
                            <td class="text-center">${sourceMap[t.source_target] || t.source_target}</td>
                            <td class="amount">${Utils.formatCurrency(t.amount)}</td>
                            <td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>
                            ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}
                        </tr>`;
                    }
                }

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

                // 管理员视图：7列（日期、类型、方向、来源、金额、描述、门店）
                // 非管理员视图：6列（无门店列）
                const content = `
                    <div class="page-header"><h2>💰 ${lang === 'id' ? 'Riwayat Arus Kas' : '资金流水记录'}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${Utils.t('back')}</button><button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${Utils.t('print')}</button></div></div>
                    ${staffRestrictionHtml}
                    <div class="card">
                        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;" class="no-print">
                            <input type="date" id="cashFlowFilterStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                            <input type="date" id="cashFlowFilterEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                            <button onclick="APP.filterCashFlowPage()" class="btn btn--sm">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                            ${isAdmin ? `<button onclick="APP.showVoidCashFlowModal()" class="btn btn--sm btn--danger">🚫 ${lang === 'id' ? 'Batalkan Transaksi' : '作废流水'}</button>` : ''}
                            ${isAdmin ? `<button onclick="APP.showDiagnoseCashFlowModal()" class="btn btn--sm btn--warning">🔍 ${lang === 'id' ? 'Diagnosa & Bersihkan' : '诊断 & 清理垃圾流水'}</button>` : ''}
                            ${isAdmin ? `<button onclick="APP.showGapDetectiveModal()" class="btn btn--sm btn--outline">🕵️ ${lang === 'id' ? 'Detektif Selisih' : '差额侦探'}</button>` : ''}
                            <button onclick="APP.resetCashFlowPageFilters()" class="btn btn--sm">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                        </div>
                        <div class="table-container">
                            <table class="data-table cashflow-table">
                                <thead>
                                    <tr>
                                        <th class="col-date">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                        <th class="col-type">${lang === 'id' ? 'Tipe' : '类型'}</th>
                                        <th class="col-status text-center">${lang === 'id' ? 'Arah' : '方向'}</th>
                                        <th class="col-method text-center">${lang === 'id' ? 'Sumber' : '来源/去向'}</th>
                                        <th class="col-amount amount">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        <th class="col-desc">${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                        ${isAdmin ? `<th class="col-store text-center">${lang === 'id' ? 'Toko' : '门店'}</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody id="cashFlowPageBody">${rows}</tbody>
                            </table>
                        </div>
                    </div>`;

                window._cashFlowPageData = cashFlowTransactions;
                return content;
            } catch (error) {
                console.error("buildCashFlowPageHTML error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data arus kas' : '加载资金流水失败');
                return `<div class="card"><p>❌ ${Utils.t('loading_failed', { module: '资金流水' })}</p><p style="color:var(--danger);font-size:12px;">${error.message}</p><button onclick="APP.showCashFlowPage()" class="btn btn--sm" style="margin-top:12px;">🔄 ${lang === 'id' ? 'Coba Lagi' : '重试'}</button></div>`;
            }
        },

        async renderCashFlowPageHTML() {
            return await this.buildCashFlowPageHTML();
        },

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
                const tDate = (t.flow_date || t.recorded_at || '').substring(0, 10);
                if (startDate && tDate < startDate) return false;
                if (endDate && tDate > endDate) return false;
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
            const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
            const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };
            let rows = '';
            if (transactions.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td></table>`;
            } else {
                for (const t of transactions) {
                    const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, lang);
                    rows += `<tr>
                        <td class="date-cell">${Utils.formatDate(t.flow_date || t.recorded_at)}</td>
                        <td class="col-type">${typeDisplay}</td>
                        <td class="text-center">${directionMap[t.direction] || t.direction}</td>
                        <td class="text-center">${sourceMap[t.source_target] || t.source_target}</td>
                        <td class="amount">${Utils.formatCurrency(t.amount)}</td>
                        <td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>
                        ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}
                    </tr>`;
                }
            }
            tbody.innerHTML = rows;
        },

        // ==================== 作废流水模态框（管理员） ====================
        async showVoidCashFlowModal() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat membatalkan transaksi' : '仅管理员可作废流水');
                return;
            }

            // 获取当前显示的流水数据（已筛选后的）
            const transactions = window._cashFlowPageData || [];
            
            if (transactions.length === 0) {
                Utils.toast.warning(lang === 'id' ? 'Tidak ada transaksi yang dapat dibatalkan' : '没有可作废的流水记录');
                return;
            }

            // 构建流水列表 HTML
            let listHtml = '';
            for (let i = 0; i < transactions.length; i++) {
                const t = transactions[i];
                const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, lang);
                const dateStr = Utils.formatDate(t.flow_date || t.recorded_at);
                const amountStr = Utils.formatCurrency(t.amount);
                
                listHtml += `
                    <div class="void-item" data-flow-id="${Utils.escapeAttr(t.id)}" data-flow-desc="${Utils.escapeAttr(t.description || '-')}" data-flow-type="${Utils.escapeAttr(typeDisplay)}" data-flow-date="${Utils.escapeAttr(dateStr)}" data-flow-amount="${Utils.escapeAttr(amountStr)}" onclick="APP.selectVoidFlowItem(this)">
                        <div class="void-item-radio"><input type="radio" name="voidFlowSelect" value="${Utils.escapeAttr(t.id)}"></div>
                        <div class="void-item-info">
                            <div class="void-item-date">${dateStr}</div>
                            <div class="void-item-type">${typeDisplay}</div>
                            <div class="void-item-amount">${amountStr}</div>
                            <div class="void-item-desc">${Utils.escapeHtml(t.description || '-')}</div>
                            ${isAdmin ? `<div class="void-item-store">${Utils.escapeHtml(t.stores?.name || '-')}</div>` : ''}
                        </div>
                    </div>
                `;
            }

            const modalHtml = `
                <div id="voidCashFlowModal" class="modal-overlay">
                    <div class="modal-content" style="max-width: 700px; max-height: 80vh; display: flex; flex-direction: column;">
                        <h3>🚫 ${lang === 'id' ? 'Batalkan Transaksi' : '作废流水记录'}</h3>
                        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">
                            ${lang === 'id' 
                                ? 'Pilih transaksi yang akan dibatalkan. Tindakan ini tidak dapat dibatalkan.'
                                : '选择要作废的流水记录。此操作不可撤销。'}
                        </p>
                        <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
                            <input type="text" id="voidSearchInput" placeholder="🔍 ${lang === 'id' ? 'Cari deskripsi atau tipe...' : '搜索描述或类型...'}" style="flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-medium);">
                            <button onclick="APP.filterVoidFlowList()" class="btn btn--sm">🔍 ${lang === 'id' ? 'Cari' : '搜索'}</button>
                            <button onclick="APP.clearVoidFlowSearch()" class="btn btn--sm btn--outline">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                        </div>
                        <div id="voidFlowList" style="flex: 1; overflow-y: auto; border: 1px solid var(--border-light); border-radius: 8px; background: var(--bg-card);">
                            ${listHtml}
                        </div>
                        <div class="modal-actions" style="margin-top: 16px;">
                            <button id="confirmVoidBtn" class="btn btn--danger" disabled>🚫 ${lang === 'id' ? 'Batalkan Terpilih' : '作废选中记录'}</button>
                            <button onclick="APP.closeVoidCashFlowModal()" class="btn btn--outline">✖ ${lang === 'id' ? 'Batal' : '取消'}</button>
                        </div>
                    </div>
                </div>
                <style>
                    .void-item {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px 12px;
                        border-bottom: 1px solid var(--border-light);
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    .void-item:hover {
                        background: var(--bg-hover);
                    }
                    .void-item.selected {
                        background: var(--primary-soft);
                    }
                    .void-item-radio {
                        flex-shrink: 0;
                    }
                    .void-item-radio input {
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                        accent-color: var(--primary);
                    }
                    .void-item-info {
                        flex: 1;
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        gap: 12px;
                        font-size: 13px;
                    }
                    .void-item-date {
                        min-width: 90px;
                        color: var(--text-secondary);
                    }
                    .void-item-type {
                        min-width: 130px;
                        font-weight: 500;
                    }
                    .void-item-amount {
                        min-width: 100px;
                        text-align: right;
                        font-weight: 600;
                        font-family: monospace;
                    }
                    .void-item-desc {
                        flex: 1;
                        color: var(--text-muted);
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .void-item-store {
                        min-width: 100px;
                        color: var(--text-secondary);
                    }
                    @media (max-width: 768px) {
                        .void-item-info { flex-direction: column; align-items: flex-start; gap: 4px; }
                        .void-item-date, .void-item-type, .void-item-amount, .void-item-desc, .void-item-store { width: 100%; }
                        .void-item-amount { text-align: left; }
                    }
                </style>
            `;

            const oldModal = document.getElementById('voidCashFlowModal');
            if (oldModal) oldModal.remove();
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // 保存流水数据供搜索使用
            window._voidFlowListData = transactions;
            window._selectedVoidFlowId = null;

            // 监听单选按钮变化
            const radios = document.querySelectorAll('#voidFlowList input[name="voidFlowSelect"]');
            const confirmBtn = document.getElementById('confirmVoidBtn');
            
            const updateSelection = () => {
                const selectedRadio = document.querySelector('#voidFlowList input[name="voidFlowSelect"]:checked');
                if (selectedRadio) {
                    window._selectedVoidFlowId = selectedRadio.value;
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = `🚫 ${lang === 'id' ? 'Batalkan' : '作废'} ${selectedRadio.closest('.void-item')?.querySelector('.void-item-type')?.textContent || ''}`;
                    }
                    // 高亮选中行
                    document.querySelectorAll('#voidFlowList .void-item').forEach(item => {
                        item.classList.remove('selected');
                    });
                    if (selectedRadio.closest('.void-item')) {
                        selectedRadio.closest('.void-item').classList.add('selected');
                    }
                } else {
                    window._selectedVoidFlowId = null;
                    if (confirmBtn) {
                        confirmBtn.disabled = true;
                        confirmBtn.textContent = `🚫 ${lang === 'id' ? 'Batalkan Terpilih' : '作废选中记录'}`;
                    }
                }
            };

            radios.forEach(radio => {
                radio.addEventListener('change', updateSelection);
            });

            // 点击整行也可选中
            document.querySelectorAll('#voidFlowList .void-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const radio = item.querySelector('input[type="radio"]');
                    if (radio && !e.target.closest('.void-item-radio')) {
                        radio.checked = true;
                        updateSelection();
                    }
                });
            });

            // 确认作废按钮
            if (confirmBtn) {
                confirmBtn.onclick = async () => {
                    const selectedId = window._selectedVoidFlowId;
                    if (!selectedId) {
                        Utils.toast.warning(lang === 'id' ? 'Pilih transaksi terlebih dahulu' : '请先选择要作废的流水');
                        return;
                    }
                    
                    // 找到选中的流水信息
                    const selectedFlow = transactions.find(t => t.id === selectedId);
                    if (!selectedFlow) return;
                    
                    const typeDisplay = FundsPage._getFlowTypeDisplay(selectedFlow.flow_type, lang);
                    const confirmMsg = lang === 'id'
                        ? `⚠️ Batalkan transaksi ini?\n\n📅 ${Utils.formatDate(selectedFlow.flow_date || selectedFlow.recorded_at)}\n📋 ${typeDisplay}\n💰 ${Utils.formatCurrency(selectedFlow.amount)}\n📝 ${selectedFlow.description || '-'}\n\nTindakan ini tidak dapat dibatalkan!\n\nLanjutkan?`
                        : `⚠️ 确认作废此流水？\n\n📅 ${Utils.formatDate(selectedFlow.flow_date || selectedFlow.recorded_at)}\n📋 ${typeDisplay}\n💰 ${Utils.formatCurrency(selectedFlow.amount)}\n📝 ${selectedFlow.description || '-'}\n\n此操作不可撤销！\n\n确认作废？`;
                    
                    const confirmed = await Utils.toast.confirm(confirmMsg);
                    if (!confirmed) return;
                    
                    try {
                        await SUPABASE.voidCashFlowRecord(selectedId);
                        Utils.toast.success(lang === 'id' ? '✅ Transaksi berhasil dibatalkan' : '✅ 流水已作废');
                        FundsPage.closeVoidCashFlowModal();
                        await FundsPage.showCashFlowPage();
                    } catch (err) {
                        console.error('voidCashFlow error:', err);
                        Utils.toast.error((lang === 'id' ? 'Gagal membatalkan: ' : '作废失败：') + err.message);
                    }
                };
            }
        },

        closeVoidCashFlowModal() {
            const modal = document.getElementById('voidCashFlowModal');
            if (modal) modal.remove();
            window._selectedVoidFlowId = null;
            window._voidFlowListData = null;
        },

        filterVoidFlowList() {
            const searchTerm = document.getElementById('voidSearchInput')?.value.toLowerCase() || '';
            const transactions = window._voidFlowListData || [];
            const listContainer = document.getElementById('voidFlowList');
            if (!listContainer) return;
            
            const filtered = transactions.filter(t => {
                const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, Utils.lang);
                const desc = (t.description || '').toLowerCase();
                const type = typeDisplay.toLowerCase();
                const amount = Utils.formatCurrency(t.amount);
                return desc.includes(searchTerm) || type.includes(searchTerm) || amount.includes(searchTerm);
            });
            
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            
            let listHtml = '';
            for (const t of filtered) {
                const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, lang);
                const dateStr = Utils.formatDate(t.flow_date || t.recorded_at);
                const amountStr = Utils.formatCurrency(t.amount);
                const isChecked = window._selectedVoidFlowId === t.id;
                
                listHtml += `
                    <div class="void-item ${isChecked ? 'selected' : ''}" data-flow-id="${Utils.escapeAttr(t.id)}" onclick="APP.selectVoidFlowItem(this, event)">
                        <div class="void-item-radio"><input type="radio" name="voidFlowSelect" value="${Utils.escapeAttr(t.id)}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation()"></div>
                        <div class="void-item-info">
                            <div class="void-item-date">${dateStr}</div>
                            <div class="void-item-type">${typeDisplay}</div>
                            <div class="void-item-amount">${amountStr}</div>
                            <div class="void-item-desc">${Utils.escapeHtml(t.description || '-')}</div>
                            ${isAdmin ? `<div class="void-item-store">${Utils.escapeHtml(t.stores?.name || '-')}</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            if (filtered.length === 0) {
                listHtml = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">${lang === 'id' ? 'Tidak ada transaksi yang cocok' : '没有匹配的流水记录'}</div>`;
            }
            
            listContainer.innerHTML = listHtml;
            
            // 重新绑定事件
            document.querySelectorAll('#voidFlowList input[name="voidFlowSelect"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    const selectedRadio = document.querySelector('#voidFlowList input[name="voidFlowSelect"]:checked');
                    if (selectedRadio) {
                        window._selectedVoidFlowId = selectedRadio.value;
                        document.querySelectorAll('#voidFlowList .void-item').forEach(item => {
                            item.classList.remove('selected');
                        });
                        if (selectedRadio.closest('.void-item')) {
                            selectedRadio.closest('.void-item').classList.add('selected');
                        }
                        const confirmBtn = document.getElementById('confirmVoidBtn');
                        if (confirmBtn) {
                            confirmBtn.disabled = false;
                        }
                    } else {
                        window._selectedVoidFlowId = null;
                        const confirmBtn = document.getElementById('confirmVoidBtn');
                        if (confirmBtn) confirmBtn.disabled = true;
                    }
                });
            });
            
            document.querySelectorAll('#voidFlowList .void-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.void-item-radio')) return;
                    const radio = item.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        const changeEvent = new Event('change');
                        radio.dispatchEvent(changeEvent);
                    }
                });
            });
        },

        clearVoidFlowSearch() {
            const searchInput = document.getElementById('voidSearchInput');
            if (searchInput) searchInput.value = '';
            FundsPage.filterVoidFlowList();
        },

        selectVoidFlowItem(element, event) {
            // 兼容旧调用
            if (event && event.target.closest('.void-item-radio')) return;
            const radio = element.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                const changeEvent = new Event('change');
                radio.dispatchEvent(changeEvent);
            }
        },

        // ==================== 诊断 & 清理垃圾流水（管理员）====================
        async showDiagnoseCashFlowModal() {
            const lang = Utils.lang;
            if (!PERMISSION.isAdmin()) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin' : '仅管理员可操作');
                return;
            }

            // 先弹提示，说明在做什么
            const intro = lang === 'id'
                ? '🔍 Diagnosa Arus Kas\n\nSistem akan menganalisis cash_flow_records dan membandingkan dengan payment_history + orders yang ada sekarang.\n\nTemuan akan ditampilkan sehingga Anda dapat memilih tindakan.\n\nLanjutkan diagnosa?'
                : '🔍 现金流水诊断\n\n系统将扫描 cash_flow_records，与当前 payment_history 和 orders 数据进行比对，找出：\n① 孤立流水（对应订单已删除）\n② 重复流水（同订单同类型同金额多条）\n③ 金额偏差流水（与 payment_history 不一致）\n\n诊断结果会列出，由您选择是否批量清理。\n\n确认开始诊断？';
            const ok = await Utils.toast.confirm(intro);
            if (!ok) return;

            Utils.toast.info(lang === 'id' ? '⏳ Mendiagnosa...' : '⏳ 诊断中，请稍候...', 3000);

            try {
                const result = await SUPABASE.diagnoseCashFlow();
                const { orphaned, duplicates, totalOrphaned, totalDuplicates } = result;

                if (totalOrphaned === 0 && totalDuplicates === 0) {
                    Utils.toast.success(lang === 'id' ? '✅ Tidak ada data rusak ditemukan!' : '✅ 未发现垃圾流水，数据一切正常！');
                    return;
                }

                // 构建诊断报告弹窗
                let orphanRows = '';
                for (const r of orphaned) {
                    orphanRows += `<tr style="background:var(--danger-soft,#fef2f2);">
                        <td style="padding:6px 8px;font-size:12px;">${Utils.formatDate(r.flow_date || r.recorded_at)}</td>
                        <td style="padding:6px 8px;font-size:12px;">${Utils.escapeHtml(r.flow_type)}</td>
                        <td style="padding:6px 8px;font-size:12px;text-align:right;">${Utils.formatCurrency(r.amount)}</td>
                        <td style="padding:6px 8px;font-size:12px;">${Utils.escapeHtml(r.source_target)}</td>
                        <td style="padding:6px 8px;font-size:12px;color:var(--danger);">${lang === 'id' ? 'Pesanan tidak ada' : '订单不存在'}</td>
                        <td style="padding:6px 8px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(r.description || '-')}</td>
                    </tr>`;
                }
                let dupRows = '';
                for (const r of duplicates) {
                    dupRows += `<tr style="background:var(--warning-soft,#fffbeb);">
                        <td style="padding:6px 8px;font-size:12px;">${Utils.formatDate(r.flow_date || r.recorded_at)}</td>
                        <td style="padding:6px 8px;font-size:12px;">${Utils.escapeHtml(r.flow_type)}</td>
                        <td style="padding:6px 8px;font-size:12px;text-align:right;">${Utils.formatCurrency(r.amount)}</td>
                        <td style="padding:6px 8px;font-size:12px;">${Utils.escapeHtml(r.source_target)}</td>
                        <td style="padding:6px 8px;font-size:12px;color:var(--warning-dark,#b45309);">${lang === 'id' ? 'Duplikat' : '重复记录'}</td>
                        <td style="padding:6px 8px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(r.description || '-')}</td>
                    </tr>`;
                }

                const thStyle = 'style="padding:6px 8px;font-size:11px;font-weight:600;background:var(--bg-hover);white-space:nowrap;"';
                const tableHead = `<thead><tr>
                    <th ${thStyle}>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                    <th ${thStyle}>${lang === 'id' ? 'Tipe' : '类型'}</th>
                    <th ${thStyle}>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                    <th ${thStyle}>${lang === 'id' ? 'Sumber' : '来源'}</th>
                    <th ${thStyle}>${lang === 'id' ? 'Masalah' : '问题'}</th>
                    <th ${thStyle}>${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                </tr></thead>`;

                const modalHtml = `
                <div id="diagnoseCashFlowModal" class="modal-overlay">
                    <div class="modal-content" style="max-width:760px;max-height:85vh;display:flex;flex-direction:column;">
                        <h3>🔍 ${lang === 'id' ? 'Hasil Diagnosa Arus Kas' : '现金流水诊断报告'}</h3>
                        <div style="display:flex;gap:16px;margin:12px 0;flex-wrap:wrap;">
                            <div style="background:var(--danger-soft,#fef2f2);border:1px solid var(--danger,#ef4444);border-radius:8px;padding:10px 18px;text-align:center;">
                                <div style="font-size:22px;font-weight:700;color:var(--danger);">${totalOrphaned}</div>
                                <div style="font-size:12px;color:var(--text-secondary);">${lang === 'id' ? 'Arus kas yatim piatu' : '孤立流水（订单不存在）'}</div>
                            </div>
                            <div style="background:var(--warning-soft,#fffbeb);border:1px solid var(--warning,#f59e0b);border-radius:8px;padding:10px 18px;text-align:center;">
                                <div style="font-size:22px;font-weight:700;color:var(--warning-dark,#b45309);">${totalDuplicates}</div>
                                <div style="font-size:12px;color:var(--text-secondary);">${lang === 'id' ? 'Arus kas duplikat' : '重复流水'}</div>
                            </div>
                            <div style="background:var(--bg-hover);border-radius:8px;padding:10px 18px;flex:1;display:flex;align-items:center;">
                                <p style="font-size:12px;color:var(--text-secondary);margin:0;">
                                    ${lang === 'id'
                                        ? '⚠️ Membersihkan akan menandai data ini sebagai <strong>is_voided=true</strong> (soft delete). Data asli tidak akan dihapus secara permanen.'
                                        : '⚠️ 清理操作会将这些记录标记为 <strong>is_voided=true</strong>（软删除），不会永久删除原始数据，可通过数据库恢复。'}
                                </p>
                            </div>
                        </div>
                        <div style="flex:1;overflow-y:auto;border:1px solid var(--border-light);border-radius:8px;">
                            ${totalOrphaned > 0 ? `
                            <div style="padding:8px 12px;background:var(--danger-soft,#fef2f2);font-size:12px;font-weight:600;color:var(--danger);border-bottom:1px solid var(--border-light);">
                                🗑️ ${lang === 'id' ? 'Arus Kas Yatim Piatu' : '孤立流水'} (${totalOrphaned})
                            </div>
                            <div style="overflow-x:auto;">
                            <table style="width:100%;border-collapse:collapse;">${tableHead}<tbody>${orphanRows}</tbody></table>
                            </div>` : ''}
                            ${totalDuplicates > 0 ? `
                            <div style="padding:8px 12px;background:var(--warning-soft,#fffbeb);font-size:12px;font-weight:600;color:var(--warning-dark,#b45309);border-top:${totalOrphaned > 0 ? '1px solid var(--border-light)' : 'none'};border-bottom:1px solid var(--border-light);">
                                ⚠️ ${lang === 'id' ? 'Arus Kas Duplikat' : '重复流水'} (${totalDuplicates})
                            </div>
                            <div style="overflow-x:auto;">
                            <table style="width:100%;border-collapse:collapse;">${tableHead}<tbody>${dupRows}</tbody></table>
                            </div>` : ''}
                        </div>
                        <div class="modal-actions" style="margin-top:16px;gap:10px;display:flex;flex-wrap:wrap;">
                            ${totalOrphaned > 0 ? `<button onclick="APP.cleanOrphanedCashFlows()" class="btn btn--danger">🗑️ ${lang === 'id' ? 'Bersihkan ' + totalOrphaned + ' Arus Kas Yatim' : '清理 ' + totalOrphaned + ' 条孤立流水'}</button>` : ''}
                            ${totalDuplicates > 0 ? `<button onclick="APP.cleanDuplicateCashFlows()" class="btn btn--warning">⚠️ ${lang === 'id' ? 'Bersihkan ' + totalDuplicates + ' Duplikat' : '清理 ' + totalDuplicates + ' 条重复流水'}</button>` : ''}
                            ${(totalOrphaned > 0 || totalDuplicates > 0) ? `<button onclick="APP.cleanAllDirtyCashFlows()" class="btn btn--danger" style="background:var(--danger);">🔥 ${lang === 'id' ? 'Bersihkan Semua (' + (totalOrphaned + totalDuplicates) + ')' : '全部清理 (' + (totalOrphaned + totalDuplicates) + ' 条)'}</button>` : ''}
                            <button onclick="APP.closeDiagnoseCashFlowModal()" class="btn btn--outline">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                        </div>
                    </div>
                </div>`;

                window._diagnoseCashFlowResult = result;
                const old = document.getElementById('diagnoseCashFlowModal');
                if (old) old.remove();
                document.body.insertAdjacentHTML('beforeend', modalHtml);

            } catch (err) {
                console.error('diagnoseCashFlow error:', err);
                Utils.toast.error((lang === 'id' ? 'Gagal: ' : '诊断失败：') + err.message);
            }
        },

        closeDiagnoseCashFlowModal() {
            const modal = document.getElementById('diagnoseCashFlowModal');
            if (modal) modal.remove();
            window._diagnoseCashFlowResult = null;
        },

        async _doCleanCashFlows(ids, successMsg) {
            const lang = Utils.lang;
            if (!ids || ids.length === 0) return;
            const confirmMsg = lang === 'id'
                ? `⚠️ Konfirmasi pembersihan ${ids.length} record arus kas?\n\nData akan ditandai is_voided=true. Tidak dapat dibatalkan dari UI.\n\nLanjutkan?`
                : `⚠️ 确认清理 ${ids.length} 条流水记录？\n\n记录将被标记为 is_voided=true（软删除）。\n此操作无法从界面撤销。\n\n确认清理？`;
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;
            try {
                await SUPABASE.voidCashFlowBatch(ids);
                Utils.toast.success(successMsg);
                FundsPage.closeDiagnoseCashFlowModal();
                if (window.JF && JF.Cache) JF.Cache.clear();
                await FundsPage.showCashFlowPage();
            } catch (err) {
                Utils.toast.error((lang === 'id' ? 'Gagal: ' : '清理失败：') + err.message);
            }
        },

        async cleanOrphanedCashFlows() {
            const lang = Utils.lang;
            const result = window._diagnoseCashFlowResult;
            if (!result) return;
            const ids = result.orphaned.map(r => r.id);
            await FundsPage._doCleanCashFlows(ids, lang === 'id' ? `✅ ${ids.length} arus kas yatim dibersihkan!` : `✅ 已清理 ${ids.length} 条孤立流水！`);
        },

        async cleanDuplicateCashFlows() {
            const lang = Utils.lang;
            const result = window._diagnoseCashFlowResult;
            if (!result) return;
            const ids = result.duplicates.map(r => r.id);
            await FundsPage._doCleanCashFlows(ids, lang === 'id' ? `✅ ${ids.length} duplikat dibersihkan!` : `✅ 已清理 ${ids.length} 条重复流水！`);
        },

        async cleanAllDirtyCashFlows() {
            const lang = Utils.lang;
            const result = window._diagnoseCashFlowResult;
            if (!result) return;
            const ids = [...result.orphaned.map(r => r.id), ...result.duplicates.map(r => r.id)];
            await FundsPage._doCleanCashFlows(ids, lang === 'id' ? `✅ Semua ${ids.length} data rusak dibersihkan!` : `✅ 已清理全部 ${ids.length} 条垃圾流水！`);
        },

        // ==================== 差额侦探（管理员）====================
        // 从数据库实时查询，逐项列出保险柜支出与在押资金的差额组成
        async showGapDetectiveModal() {
            const lang = Utils.lang;
            if (!PERMISSION.isAdmin()) { Utils.toast.warning(lang === 'id' ? 'Hanya admin' : '仅管理员可操作'); return; }

            const old = document.getElementById('gapDetectiveModal');
            if (old) old.remove();

            document.body.insertAdjacentHTML('beforeend', `
            <div id="gapDetectiveModal" class="modal-overlay">
                <div class="modal-content" style="max-width:860px;max-height:90vh;display:flex;flex-direction:column;">
                    <h3>🕵️ ${lang === 'id' ? 'Detektif Selisih Dana' : '差额侦探 — 保险柜 vs 在押资金'}</h3>
                    <div style="text-align:center;padding:40px;color:var(--text-muted);">⏳ ${lang === 'id' ? 'Menganalisa...' : '正在深度分析，请稍候...'}</div>
                    <div class="modal-actions"><button onclick="APP.closeGapDetectiveModal()" class="btn btn--outline">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button></div>
                </div>
            </div>`);

            try {
                const client = SUPABASE.getClient();

                // 并行拉取所有需要的数据
                const [
                    { data: cashOutflows },
                    { data: cashInflows },
                    { data: activeOrders },
                    { data: completedOrders },
                    { data: allDisbursements },
                ] = await Promise.all([
                    client.from('cash_flow_records').select('id,flow_type,amount,direction,description,flow_date,reference_id,order_id').eq('is_voided',false).eq('direction','outflow').eq('source_target','cash').order('flow_date',{ascending:false}),
                    client.from('cash_flow_records').select('id,flow_type,amount,direction,description,flow_date,reference_id,order_id').eq('is_voided',false).eq('direction','inflow').eq('source_target','cash').order('flow_date',{ascending:false}),
                    client.from('orders').select('id,order_id,customer_name,loan_amount,created_at').eq('status','active'),
                    client.from('orders').select('order_id,customer_name,loan_amount,principal_paid,completed_at').eq('status','completed'),
                    client.from('cash_flow_records').select('id,amount,flow_date,description,reference_id,order_id').eq('is_voided',false).eq('flow_type','loan_disbursement'),
                ]);

                const totalCashOut = (cashOutflows||[]).reduce((s,r)=>s+(r.amount||0),0);
                const totalCashIn  = (cashInflows ||[]).reduce((s,r)=>s+(r.amount||0),0);
                const cashBalance  = totalCashIn - totalCashOut;
                const deployedCapital = (activeOrders||[]).reduce((s,o)=>s+(o.loan_amount||0),0);
                const gap = totalCashOut - deployedCapital;

                // ============================================================
                // 新功能①：孤立发放流水 — loan_disbursement 流水里 order_id
                //          指向的 orders 行已不存在（订单被删除后的遗留）
                // ============================================================
                const activeOrderUUIDs  = new Set((activeOrders||[]).map(o=>o.id));
                const completedOrderUUIDs = new Set();
                // 拉取全部 orders UUID（含已完成），用于判断是否真的孤立
                const { data: allOrderUUIDs } = await client.from('orders').select('id');
                const allExistingUUIDs = new Set((allOrderUUIDs||[]).map(o=>o.id));

                const orphanDisb = (allDisbursements||[]).filter(r => r.order_id && !allExistingUUIDs.has(r.order_id));

                // ============================================================
                // 新功能②：缺失发放流水的 active 订单
                //          active 订单在 cash_flow_records 里没有任何
                //          loan_disbursement 记录（已作废的不算）
                // ============================================================
                const disbOrderUUIDs = new Set((allDisbursements||[]).map(r=>r.order_id).filter(Boolean));
                const missingDisbOrders = (activeOrders||[]).filter(o => !disbOrderUUIDs.has(o.id));

                // 支出分组
                const outflowGroups = {};
                for (const r of (cashOutflows||[])) {
                    const k = r.flow_type||'unknown';
                    if (!outflowGroups[k]) outflowGroups[k]={total:0,count:0};
                    outflowGroups[k].total+=(r.amount||0);
                    outflowGroups[k].count++;
                }
                const inflowGroups = {};
                for (const r of (cashInflows||[])) {
                    const k = r.flow_type||'unknown';
                    if (!inflowGroups[k]) inflowGroups[k]={total:0,count:0};
                    inflowGroups[k].total+=(r.amount||0);
                    inflowGroups[k].count++;
                }

                const flowTypeLabel = k => ({
                    loan_disbursement:'当金发放', expense:'运营支出', return_of_capital:'资本返还',
                    capital_injection:'资本注入', interest:'利息收入', principal:'本金归还',
                    admin_fee:'管理费', service_fee:'服务费', internal_transfer:'内部转账',
                    profit_distribution:'利润分配',
                }[k]||k);

                const thS = 'style="padding:7px 10px;font-size:12px;font-weight:600;background:var(--bg-hover);white-space:nowrap;"';
                const tdS = 'style="padding:7px 10px;font-size:12px;"';
                const tdR = 'style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;"';
                const tdD = 'style="padding:7px 10px;font-size:12px;color:var(--danger);"';
                const tdW = 'style="padding:7px 10px;font-size:12px;color:var(--warning-dark,#b45309);"';

                const loanDisbGroup = outflowGroups['loan_disbursement']||{total:0,count:0};
                const principalInflowGroup = inflowGroups['principal']||{total:0,count:0};
                const theoreticalGap = loanDisbGroup.total - deployedCapital - principalInflowGroup.total;

                // 孤立发放流水的总金额（这部分是"假支出"——订单删了但流水还在）
                const orphanTotal = orphanDisb.reduce((s,r)=>s+(r.amount||0),0);
                // 缺失流水的订单贷款总额（这部分是"真支出但未登记"）
                const missingTotal = missingDisbOrders.reduce((s,o)=>s+(o.loan_amount||0),0);

                // 孤立流水行
                let orphanRows = orphanDisb.length ? orphanDisb.map(r=>`
                    <tr style="border-bottom:1px solid var(--border-light);">
                        <td ${tdS}>${Utils.formatDate(r.flow_date)}</td>
                        <td ${tdS} style="padding:7px 10px;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(r.description||'-')}</td>
                        <td ${tdR} style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--danger);">${Utils.formatCurrency(r.amount||0)}</td>
                        <td ${tdS} style="padding:7px 10px;font-size:12px;color:var(--text-muted);font-size:11px;">${r.reference_id||'-'}</td>
                        <td style="padding:7px 10px;text-align:center;">
                            <button onclick="APP.voidOrphanDisbursement('${r.id}')" style="background:var(--danger);color:#fff;border:none;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:12px;">🗑️ 作废</button>
                        </td>
                    </tr>`).join('') :
                    `<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--success);font-size:13px;">✅ 无孤立流水</td></tr>`;

                // 缺失流水订单行
                let missingRows = missingDisbOrders.length ? missingDisbOrders.map(o=>`
                    <tr style="border-bottom:1px solid var(--border-light);">
                        <td ${tdS}>${Utils.escapeHtml(o.order_id)}</td>
                        <td ${tdS}>${Utils.escapeHtml(o.customer_name||'-')}</td>
                        <td ${tdR} style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--warning-dark,#b45309);">${Utils.formatCurrency(o.loan_amount||0)}</td>
                        <td ${tdS}>${Utils.formatDate(o.created_at)}</td>
                        <td style="padding:7px 10px;font-size:12px;color:var(--warning-dark,#b45309);">⚠️ 缺少发放流水</td>
                    </tr>`).join('') :
                    `<tr><td colspan="5" style="text-align:center;padding:14px;color:var(--success);font-size:13px;">✅ 所有在押订单均有发放流水</td></tr>`;

                // 支出汇总行
                let outRows = Object.entries(outflowGroups).sort((a,b)=>b[1].total-a[1].total).map(([k,g])=>`
                    <tr style="${k==='loan_disbursement'?'background:var(--warning-soft,#fffbeb);':''}border-bottom:1px solid var(--border-light);">
                        <td ${tdS}>${flowTypeLabel(k)}</td>
                        <td ${tdR}>${g.count} 笔</td>
                        <td ${tdR} style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--danger);">${Utils.formatCurrency(g.total)}</td>
                    </tr>`).join('');

                let inRows = Object.entries(inflowGroups).sort((a,b)=>b[1].total-a[1].total).map(([k,g])=>`
                    <tr style="border-bottom:1px solid var(--border-light);">
                        <td ${tdS}>${flowTypeLabel(k)}</td>
                        <td ${tdR}>${g.count} 笔</td>
                        <td ${tdR} style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--success);">${Utils.formatCurrency(g.total)}</td>
                    </tr>`).join('');

                const modal = document.getElementById('gapDetectiveModal');
                if (!modal) return;
                modal.querySelector('.modal-content').innerHTML = `
                    <h3>🕵️ ${lang==='id'?'Detektif Selisih Dana':'差额侦探 — 完整资金流向分析'}</h3>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:10px 0;">
                        <div style="background:var(--danger-soft,#fef2f2);border:1px solid var(--danger);border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">总现金支出</div>
                            <div style="font-size:15px;font-weight:600;color:var(--danger);">${Utils.formatCurrency(totalCashOut)}</div>
                        </div>
                        <div style="background:var(--success-soft,#f0fdf4);border:1px solid var(--success);border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">总现金收入</div>
                            <div style="font-size:15px;font-weight:600;color:var(--success);">${Utils.formatCurrency(totalCashIn)}</div>
                        </div>
                        <div style="background:var(--bg-hover);border:1px solid var(--border-light);border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">保险柜余额</div>
                            <div style="font-size:15px;font-weight:600;color:${cashBalance>=0?'var(--success)':'var(--danger)'};">${Utils.formatCurrency(cashBalance)}</div>
                        </div>
                        <div style="background:var(--primary-soft,#cffafe);border:1px solid var(--primary);border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">在押资金 (active)</div>
                            <div style="font-size:15px;font-weight:600;color:var(--primary-dark);">${Utils.formatCurrency(deployedCapital)}</div>
                        </div>
                        <div style="background:var(--warning-soft,#fffbeb);border:1px solid var(--warning,#f59e0b);border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">支出 − 在押 差额</div>
                            <div style="font-size:15px;font-weight:600;color:var(--warning-dark,#b45309);">${Utils.formatCurrency(gap)}</div>
                        </div>
                        <div style="background:${orphanTotal>0?'var(--danger-soft,#fef2f2)':'var(--success-soft,#f0fdf4)'};border:1px solid ${orphanTotal>0?'var(--danger)':'var(--success)'};border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">🗑️ 孤立发放流水</div>
                            <div style="font-size:15px;font-weight:600;color:${orphanTotal>0?'var(--danger)':'var(--success)'};">${orphanTotal>0?Utils.formatCurrency(orphanTotal):'✅ 无'}</div>
                        </div>
                        <div style="background:${missingTotal>0?'var(--warning-soft,#fffbeb)':'var(--success-soft,#f0fdf4)'};border:1px solid ${missingTotal>0?'var(--warning,#f59e0b)':'var(--success)'};border-radius:8px;padding:10px 12px;text-align:center;">
                            <div style="font-size:11px;color:var(--text-muted);">⚠️ 缺失发放流水</div>
                            <div style="font-size:15px;font-weight:600;color:${missingTotal>0?'var(--warning-dark,#b45309)':'var(--success)'};">${missingTotal>0?Utils.formatCurrency(missingTotal):'✅ 无'}</div>
                        </div>
                    </div>

                    ${orphanTotal > 0 ? `
                    <div style="background:var(--danger-soft,#fef2f2);border:1px solid var(--danger);border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:13px;">
                        <strong>🗑️ 发现 ${orphanDisb.length} 条孤立发放流水，合计 ${Utils.formatCurrency(orphanTotal)}</strong><br>
                        <span style="color:var(--text-muted);font-size:12px;">这些流水对应的订单已被删除，但流水仍在统计中，导致保险柜支出虚高。<strong>作废这些流水即可消除该部分差额。</strong></span>
                    </div>` : ''}

                    ${missingTotal > 0 ? `
                    <div style="background:var(--warning-soft,#fffbeb);border:1px solid var(--warning,#f59e0b);border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:13px;">
                        <strong>⚠️ 发现 ${missingDisbOrders.length} 笔在押订单缺少发放流水，合计 ${Utils.formatCurrency(missingTotal)}</strong><br>
                        <span style="color:var(--text-muted);font-size:12px;">这些订单贷款已实际发出，但未登记现金支出流水，导致保险柜少算了这部分出账。需要手动补录发放流水。</span>
                    </div>` : ''}

                    <div style="flex:1;overflow-y:auto;max-height:420px;">

                        <!-- 孤立发放流水（订单已删除的遗留） -->
                        <div style="padding:8px 12px;background:var(--danger-soft,#fef2f2);font-size:12px;font-weight:600;color:var(--danger);border-radius:6px 6px 0 0;border:1px solid var(--border-light);">
                            🗑️ 孤立发放流水（订单已删除，流水仍在统计） — ${orphanDisb.length} 条 ${orphanTotal>0?'/ '+Utils.formatCurrency(orphanTotal):''}
                        </div>
                        <table style="width:100%;border-collapse:collapse;border:1px solid var(--border-light);border-top:none;margin-bottom:14px;">
                            <thead><tr style="background:var(--bg-hover);">
                                <th ${thS}>日期</th><th ${thS}>描述</th><th ${thS} style="text-align:right;">金额</th><th ${thS}>原订单号</th><th ${thS} style="text-align:center;">操作</th>
                            </tr></thead>
                            <tbody>${orphanRows}</tbody>
                        </table>

                        <!-- 缺失发放流水的在押订单 -->
                        <div style="padding:8px 12px;background:var(--warning-soft,#fffbeb);font-size:12px;font-weight:600;color:var(--warning-dark,#b45309);border-radius:6px 6px 0 0;border:1px solid var(--border-light);">
                            ⚠️ 在押订单缺少发放流水（贷款已发但未登记支出） — ${missingDisbOrders.length} 笔 ${missingTotal>0?'/ '+Utils.formatCurrency(missingTotal):''}
                        </div>
                        <table style="width:100%;border-collapse:collapse;border:1px solid var(--border-light);border-top:none;margin-bottom:14px;">
                            <thead><tr style="background:var(--bg-hover);">
                                <th ${thS}>单号</th><th ${thS}>客户</th><th ${thS} style="text-align:right;">贷款额</th><th ${thS}>开单日期</th><th ${thS}>状态</th>
                            </tr></thead>
                            <tbody>${missingRows}</tbody>
                        </table>

                        <!-- 支出汇总 -->
                        <div style="padding:8px 12px;background:var(--danger-soft,#fef2f2);font-size:12px;font-weight:600;color:var(--danger);border-radius:6px 6px 0 0;border:1px solid var(--border-light);">
                            💸 现金支出明细（按科目汇总）
                        </div>
                        <table style="width:100%;border-collapse:collapse;border:1px solid var(--border-light);border-top:none;margin-bottom:14px;">
                            <thead><tr style="background:var(--bg-hover);">
                                <th ${thS}>科目</th><th ${thS} style="text-align:right;">笔数</th><th ${thS} style="text-align:right;">金额</th>
                            </tr></thead>
                            <tbody>${outRows}</tbody>
                            <tfoot><tr style="background:var(--bg-hover);">
                                <td ${tdS}><strong>合计</strong></td>
                                <td ${tdR}>${(cashOutflows||[]).length} 笔</td>
                                <td ${tdR} style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--danger);"><strong>${Utils.formatCurrency(totalCashOut)}</strong></td>
                            </tr></tfoot>
                        </table>

                        <!-- 收入汇总 -->
                        <div style="padding:8px 12px;background:var(--success-soft,#f0fdf4);font-size:12px;font-weight:600;color:var(--success);border-radius:6px 6px 0 0;border:1px solid var(--border-light);">
                            💰 现金收入明细（按科目汇总）
                        </div>
                        <table style="width:100%;border-collapse:collapse;border:1px solid var(--border-light);border-top:none;">
                            <thead><tr style="background:var(--bg-hover);">
                                <th ${thS}>科目</th><th ${thS} style="text-align:right;">笔数</th><th ${thS} style="text-align:right;">金额</th>
                            </tr></thead>
                            <tbody>${inRows}</tbody>
                            <tfoot><tr style="background:var(--bg-hover);">
                                <td ${tdS}><strong>合计</strong></td>
                                <td ${tdR}>${(cashInflows||[]).length} 笔</td>
                                <td ${tdR} style="padding:7px 10px;font-size:12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--success);"><strong>${Utils.formatCurrency(totalCashIn)}</strong></td>
                            </tr></tfoot>
                        </table>
                    </div>

                    <div class="modal-actions" style="margin-top:14px;gap:10px;display:flex;flex-wrap:wrap;">
                        ${orphanDisb.length > 1 ? `<button onclick="APP.voidAllOrphanDisbursements()" class="btn btn--danger">🗑️ 一键作废全部 ${orphanDisb.length} 条孤立流水</button>` : ''}
                        <button onclick="APP.closeGapDetectiveModal()" class="btn btn--outline">✖ 关闭</button>
                    </div>`;

                // 保存孤立流水 ID 供批量作废用
                window._orphanDisbIds = orphanDisb.map(r=>r.id);

            } catch (err) {
                console.error('gapDetective error:', err);
                Utils.toast.error((lang==='id'?'Gagal: ':'分析失败：') + err.message);
                const m = document.getElementById('gapDetectiveModal');
                if (m) m.remove();
            }
        },

        closeGapDetectiveModal() {
            const m = document.getElementById('gapDetectiveModal');
            if (m) m.remove();
            window._orphanDisbIds = null;
        },

        async voidOrphanDisbursement(flowId) {
            const lang = Utils.lang;
            const ok = await Utils.toast.confirm(lang==='id'?`Batalkan arus kas ini?`:`确认作废这条孤立发放流水？\n\n作废后该笔支出将不再计入保险柜统计。`);
            if (!ok) return;
            try {
                await SUPABASE.voidCashFlowBatch([flowId]);
                Utils.toast.success(lang==='id'?'✅ Dibatalkan!':'✅ 已作废！');
                await FundsPage.showGapDetectiveModal();
            } catch (err) {
                Utils.toast.error(err.message);
            }
        },

        async voidAllOrphanDisbursements() {
            const lang = Utils.lang;
            const ids = window._orphanDisbIds || [];
            if (!ids.length) return;
            const ok = await Utils.toast.confirm(`${lang==='id'?'Batalkan semua':'确认一键作废全部'} ${ids.length} ${lang==='id'?'arus kas yatim piatu?':'条孤立发放流水？\n\n作废后这些流水将不再计入保险柜统计。'}`);
            if (!ok) return;
            try {
                await SUPABASE.voidCashFlowBatch(ids);
                Utils.toast.success(lang==='id'?`✅ ${ids.length} dibatalkan!`:`✅ 已作废 ${ids.length} 条孤立流水！`);
                FundsPage.closeGapDetectiveModal();
                if (window.JF && JF.Cache) JF.Cache.clear();
                await FundsPage.showCashFlowPage();
            } catch (err) {
                Utils.toast.error(err.message);
            }
        },

        async showCapitalModal() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            const isStaff = PERMISSION.isStaff();
            try {
                let capitalTransactions = [];
                const client = SUPABASE.getClient();
                if (isAdmin) {
                    let q = client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('is_voided', false).order('flow_date', { ascending: false }).order('recorded_at', { ascending: false });
                    const practiceIds = await SUPABASE._getPracticeStoreIds();
                    if (practiceIds.length > 0) {
                        q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                    }
                    const { data: allFlows } = await q;
                    capitalTransactions = allFlows || [];
                } else if (isStaff) {
                    const { data: staffFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id)
                        .eq('is_voided', false)
                        .eq('recorded_by', profile?.id)
                        .order('flow_date', { ascending: false }).order('recorded_at', { ascending: false });
                    capitalTransactions = staffFlows || [];
                } else {
                    const { data: storeFlows } = await client
                        .from('cash_flow_records').select('*, stores(name)')
                        .eq('store_id', profile?.store_id).eq('is_voided', false)
                        .order('flow_date', { ascending: false }).order('recorded_at', { ascending: false });
                    capitalTransactions = storeFlows || [];
                }

                const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
                const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };

                let rows = '';
                if (capitalTransactions.length === 0) {
                    rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td>`;
                } else {
                    for (const t of capitalTransactions) {
                        const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, lang);
                        rows += `<tr>
                            <td class="date-cell">${Utils.formatDate(t.flow_date || t.recorded_at)}</td>
                            <td class="col-type">${typeDisplay}</td>
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
                window._capitalTransactionsData = capitalTransactions;
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
                const tDate = (t.flow_date || t.recorded_at || '').substring(0, 10);
                if (startDate && tDate < startDate) return false;
                if (endDate && tDate > endDate) return false;
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
            const directionMap = { inflow: lang === 'id' ? '📥 Masuk' : '📥 流入', outflow: lang === 'id' ? '📤 Keluar' : '📤 流出' };
            const sourceMap = { cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜', bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI' };
            let rows = '';
            if (transactions.length === 0) {
                rows = `<tr><td colspan="${isAdmin ? 7 : 6}" class="text-center">${lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录'}</td>`;
            } else {
                for (const t of transactions) {
                    const typeDisplay = FundsPage._getFlowTypeDisplay(t.flow_type, lang);
                    rows += `<tr><td class="date-cell">${Utils.formatDate(t.flow_date || t.recorded_at)}</td><td class="col-type">${typeDisplay}</td><td class="text-center">${directionMap[t.direction] || t.direction}</td><td class="text-center">${sourceMap[t.source_target] || t.source_target}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
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
            const rows = transactions.map(t => [(t.flow_date || t.recorded_at || '').split('T')[0], FundsPage._getFlowTypeDisplay(t.flow_type, lang), t.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出'), t.source_target === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'), t.amount, t.description || '-']);
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
                    rows = `<tr><td colspan="${isAdmin ? 6 : 5}" class="text-center">${lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录'}</td>`;
                } else {
                    for (const t of transfers) {
                        rows += `<tr><td class="date-cell">${Utils.formatDate(t.transfer_date)}</td><td class="text-center">${typeMap[t.transfer_type] || t.transfer_type}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td><td class="text-center">${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
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
                    rows += `<tr><td class="date-cell">${Utils.formatDate(t.transfer_date)}</td><td class="text-center">${typeMap[t.transfer_type] || t.transfer_type}</td><td class="amount">${Utils.formatCurrency(t.amount)}</td><td class="desc-cell">${Utils.escapeHtml(t.description || '-')}</td><td class="text-center">${Utils.escapeHtml(t.created_by_profile?.name || '-')}</td>${isAdmin ? `<td class="text-center">${Utils.escapeHtml(t.stores?.name || '-')}</td>` : ''}</tr>`;
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
        // 新增作废相关方法
        window.APP.showDiagnoseCashFlowModal = FundsPage.showDiagnoseCashFlowModal.bind(FundsPage);
        window.APP.closeDiagnoseCashFlowModal = FundsPage.closeDiagnoseCashFlowModal.bind(FundsPage);
        window.APP.filterVoidFlowList = FundsPage.filterVoidFlowList.bind(FundsPage);
        window.APP.clearVoidFlowSearch = FundsPage.clearVoidFlowSearch.bind(FundsPage);
        window.APP.selectVoidFlowItem = FundsPage.selectVoidFlowItem.bind(FundsPage);
        window.APP.showDiagnoseCashFlowModal = FundsPage.showDiagnoseCashFlowModal.bind(FundsPage);
        window.APP.closeDiagnoseCashFlowModal = FundsPage.closeDiagnoseCashFlowModal.bind(FundsPage);
        window.APP.cleanOrphanedCashFlows = FundsPage.cleanOrphanedCashFlows.bind(FundsPage);
        window.APP.cleanDuplicateCashFlows = FundsPage.cleanDuplicateCashFlows.bind(FundsPage);
        window.APP.cleanAllDirtyCashFlows = FundsPage.cleanAllDirtyCashFlows.bind(FundsPage);
        window.APP.showGapDetectiveModal = FundsPage.showGapDetectiveModal.bind(FundsPage);
        window.APP.closeGapDetectiveModal = FundsPage.closeGapDetectiveModal.bind(FundsPage);
        window.APP.voidOrphanDisbursement = FundsPage.voidOrphanDisbursement.bind(FundsPage);
        window.APP.voidAllOrphanDisbursements = FundsPage.voidAllOrphanDisbursements.bind(FundsPage);
    }

})();
