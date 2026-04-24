// app-dashboard-funds.js - v1.2（资金流水改为独立页面）

window.APP = window.APP || {};

const DashboardFunds = {

    showCapitalModal: async function() {
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        
        try {
            var transactions = [];
            if (isAdmin) {
                const { data: allFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('*')
                    .eq('is_voided', false)
                    .order('recorded_at', { ascending: false });
                transactions = allFlows || [];
            } else {
                const profile = await SUPABASE.getCurrentProfile();
                const { data: storeFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('*')
                    .eq('store_id', profile?.store_id)
                    .eq('is_voided', false)
                    .order('recorded_at', { ascending: false });
                transactions = storeFlows || [];
            }
            
            var typeMap = {
                loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
                admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
                service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
                interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
                principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
                expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
                internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
                internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
            };
            
            var directionMap = {
                inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
                outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
            };
            
            var sourceMap = {
                cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
                bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
            };
            
            var rows = '';
            if (transactions.length === 0) {
                rows = '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="text-center">' + (lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < transactions.length; i++) {
                    var t = transactions[i];
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(t.recorded_at) + '</td>' +
                        '<td>' + (typeMap[t.flow_type] || t.flow_type) + '</td>' +
                        '<td class="text-center">' + (directionMap[t.direction] || t.direction) + '</td>' +
                        '<td class="text-center">' + (sourceMap[t.source_target] || t.source_target) + '</td>' +
                        '<td class="text-right ' + (t.direction === 'inflow' ? 'income' : 'expense') + '">' + Utils.formatCurrency(t.amount) + '</td>' +
                        '<td class="flow-desc">' + Utils.escapeHtml(t.description || '-') + '</td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(t.stores?.name || '-') + '</td>' : '') +
                    '<\/tr>';
                }
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="modal-overlay">' +
                    '<div class="modal-content" style="max-width:1000px;">' +
                        '<h3>🏦 ' + (lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录') + '</h3>' +
                        '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">' +
                            '<input type="text" id="capitalFilterDesc" placeholder="🔍 ' + (lang === 'id' ? 'Cari deskripsi...' : '搜索描述...') + '" style="flex:1;">' +
                            '<select id="capitalFilterType" style="width:auto;">' +
                                '<option value="">' + (lang === 'id' ? 'Semua tipe' : '全部类型') + '</option>' +
                                '<option value="loan_disbursement">' + (lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放') + '</option>' +
                                '<option value="admin_fee">' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</option>' +
                                '<option value="service_fee">' + (lang === 'id' ? 'Service Fee' : '服务费') + '</option>' +
                                '<option value="interest">' + (lang === 'id' ? 'Bunga' : '利息') + '</option>' +
                                '<option value="principal">' + (lang === 'id' ? 'Pokok' : '本金') + '</option>' +
                                '<option value="expense">' + (lang === 'id' ? 'Pengeluaran' : '运营支出') + '</option>' +
                            '</select>' +
                            '<input type="date" id="capitalFilterStart" placeholder="' + (lang === 'id' ? 'Dari tanggal' : '开始日期') + '">' +
                            '<input type="date" id="capitalFilterEnd" placeholder="' + (lang === 'id' ? 'Sampai tanggal' : '结束日期') + '">' +
                            '<button onclick="APP.filterCapitalTransactions()" class="btn-small">🔍 ' + (lang === 'id' ? 'Filter' : '筛选') + '</button>' +
                            '<button onclick="APP.resetCapitalFilters()" class="btn-small">🔄 ' + (lang === 'id' ? 'Reset' : '重置') + '</button>' +
                        '</div>' +
                        '<div class="table-container" style="max-height:400px; overflow-y:auto;">' +
                            '<table class="data-table capital-table" style="min-width:700px;">' +
                                '<thead>' +
                                    '<tr>' +
                                        '<th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th>' +
                                        '<th>' + (lang === 'id' ? 'Tipe' : '类型') + '</th>' +
                                        '<th class="text-center">' + (lang === 'id' ? 'Arah' : '方向') + '</th>' +
                                        '<th class="text-center">' + (lang === 'id' ? 'Sumber' : '来源/去向') + '</th>' +
                                        '<th class="text-right">' + (lang === 'id' ? 'Jumlah' : '金额') + '</th>' +
                                        '<th>' + (lang === 'id' ? 'Deskripsi' : '描述') + '</th>' +
                                        (isAdmin ? '<th class="text-center">' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : '') +
                                    '</tr>' +
                                '</thead>' +
                                '<tbody id="capitalTransactionsBody">' +
                                    rows +
                                '</tbody>' +
                            '</table>' +
                        '</div>' +
                        '<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">' +
                            '<button onclick="APP.printCapitalTransactions()" class="btn-print">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                            '<button onclick="APP.exportCapitalTransactionsToCSV()" class="btn-export">📎 ' + (lang === 'id' ? 'Ekspor CSV' : '导出CSV') + '</button>' +
                            '<button onclick="document.getElementById(\'capitalModal\').remove()" class="btn-back">✖ ' + (lang === 'id' ? 'Tutup' : '关闭') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            document.body.insertAdjacentHTML('beforeend', document.getElementById("app").querySelector('.modal-overlay').outerHTML);
            document.getElementById("app").innerHTML = document.getElementById("app").querySelector('.modal-overlay').outerHTML;
            
            window._capitalTransactionsData = transactions;
            this._addFundsTableStyles();
        } catch (error) {
            console.error("showCapitalModal error:", error);
            alert(lang === 'id' ? 'Gagal memuat data transaksi' : '加载交易记录失败');
        }
    },

    // ========== 修改：资金流水改为独立页面（非模态框） ==========
    showCashFlowModal: async function() {
        if (typeof this.showPaymentHistory === 'function' && this !== window.APP) {
            return;
        }
        APP.navigateTo('paymentHistory');
    },

    showCashFlowPage: async function() {
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        
        try {
            var transactions = [];
            
            if (isAdmin) {
                const { data: allFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('*')
                    .eq('is_voided', false)
                    .order('recorded_at', { ascending: false });
                transactions = allFlows || [];
            } else {
                const { data: storeFlows } = await supabaseClient
                    .from('cash_flow_records')
                    .select('*')
                    .eq('store_id', profile?.store_id)
                    .eq('is_voided', false)
                    .order('recorded_at', { ascending: false });
                transactions = storeFlows || [];
            }
            
            var typeMap = {
                loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
                admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
                service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
                interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
                principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
                expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
                internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
                internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
            };
            
            var directionMap = {
                inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
                outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
            };
            
            var sourceMap = {
                cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
                bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
            };
            
            var rows = '';
            if (transactions.length === 0) {
                rows = '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="text-center">' + (lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < transactions.length; i++) {
                    var t = transactions[i];
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(t.recorded_at) + '<\/td>' +
                        '<td>' + (typeMap[t.flow_type] || t.flow_type) + '<\/td>' +
                        '<td class="text-center">' + (directionMap[t.direction] || t.direction) + '<\/td>' +
                        '<td class="text-center">' + (sourceMap[t.source_target] || t.source_target) + '<\/td>' +
                        '<td class="text-right ' + (t.direction === 'inflow' ? 'income' : 'expense') + '">' + Utils.formatCurrency(t.amount) + '<\/td>' +
                        '<td class="flow-desc">' + Utils.escapeHtml(t.description || '-') + '<\/td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(t.stores?.name || '-') + '<\/td>' : '') +
                    '<\/tr>';
                }
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + (lang === 'id' ? 'Riwayat Arus Kas' : '资金流水记录') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ' + t('print') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">' +
                        '<input type="date" id="cashFlowFilterStart" placeholder="' + (lang === 'id' ? 'Dari tanggal' : '开始日期') + '">' +
                        '<input type="date" id="cashFlowFilterEnd" placeholder="' + (lang === 'id' ? 'Sampai tanggal' : '结束日期') + '">' +
                        '<button onclick="APP.filterCashFlowPage()" class="btn-small">🔍 ' + (lang === 'id' ? 'Filter' : '筛选') + '</button>' +
                        '<button onclick="APP.resetCashFlowPageFilters()" class="btn-small">🔄 ' + (lang === 'id' ? 'Reset' : '重置') + '</button>' +
                    '</div>' +
                    '<div class="table-container">' +
                        '<table class="data-table cashflow-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Tipe' : '类型') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Arah' : '方向') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Sumber' : '来源/去向') + '</th>' +
                                    '<th class="text-right">' + (lang === 'id' ? 'Jumlah' : '金额') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Deskripsi' : '描述') + '</th>' +
                                    (isAdmin ? '<th class="text-center">' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : '') +
                                '</tr>' +
                            '</thead>' +
                            '<tbody id="cashFlowPageBody">' +
                                rows +
                            '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<style>' +
                    '.cashflow-table .date-cell { white-space: nowrap; }' +
                    '.cashflow-table .flow-desc { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
                    '.cashflow-table .income { color: var(--success); }' +
                    '.cashflow-table .expense { color: var(--danger); }' +
                    '@media (max-width: 768px) { .cashflow-table .flow-desc { max-width: 150px; } .cashflow-table th, .cashflow-table td { padding: 6px 4px; font-size: 0.7rem; } }' +
                '</style>';
            
            window._cashFlowPageData = transactions;
        } catch (error) {
            console.error("showCashFlowPage error:", error);
            alert(lang === 'id' ? 'Gagal memuat data arus kas' : '加载资金流水失败');
        }
    },

    filterCashFlowPage: function() {
        var transactions = window._cashFlowPageData || [];
        var startDate = document.getElementById('cashFlowFilterStart')?.value;
        var endDate = document.getElementById('cashFlowFilterEnd')?.value;
        
        var filtered = transactions.filter(function(t) {
            if (startDate && t.recorded_at < startDate) return false;
            if (endDate && t.recorded_at > endDate + 'T23:59:59') return false;
            return true;
        });
        this._renderCashFlowPageTable(filtered);
    },

    resetCashFlowPageFilters: function() {
        var startInput = document.getElementById('cashFlowFilterStart');
        var endInput = document.getElementById('cashFlowFilterEnd');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        this.filterCashFlowPage();
    },

    _renderCashFlowPageTable: function(transactions) {
        var tbody = document.getElementById('cashFlowPageBody');
        if (!tbody) return;
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        var typeMap = {
            loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
            admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
            service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
            interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
            principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
            expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
            internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
            internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
        };
        var directionMap = {
            inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
            outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
        };
        var sourceMap = {
            cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
            bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
        };
        var rows = '';
        if (transactions.length === 0) {
            rows = '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="text-center">' + (lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录') + '<\/td><\/tr>';
        } else {
            for (var i = 0; i < transactions.length; i++) {
                var t = transactions[i];
                rows += '<tr>' +
                    '<td class="date-cell">' + Utils.formatDate(t.recorded_at) + '<\/td>' +
                    '<td>' + (typeMap[t.flow_type] || t.flow_type) + '<\/td>' +
                    '<td class="text-center">' + (directionMap[t.direction] || t.direction) + '<\/td>' +
                    '<td class="text-center">' + (sourceMap[t.source_target] || t.source_target) + '<\/td>' +
                    '<td class="text-right ' + (t.direction === 'inflow' ? 'income' : 'expense') + '">' + Utils.formatCurrency(t.amount) + '<\/td>' +
                    '<td class="flow-desc">' + Utils.escapeHtml(t.description || '-') + '<\/td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(t.stores?.name || '-') + '<\/td>' : '') +
                '<\/tr>';
            }
        }
        tbody.innerHTML = rows;
    },
    
    _addFundsTableStyles: function() {
        if (document.getElementById('funds-table-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'funds-table-styles';
        style.textContent = '' +
            '.capital-table .date-cell { white-space: nowrap; }' +
            '.capital-table .flow-desc { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
            '.capital-table .income { color: var(--success); }' +
            '.capital-table .expense { color: var(--danger); }' +
            '@media (max-width: 768px) { .capital-table .flow-desc { max-width: 150px; } .capital-table th, .capital-table td { padding: 6px 4px; font-size: 0.7rem; } }';
        document.head.appendChild(style);
    },

    filterCapitalTransactions: function() {
        var transactions = window._capitalTransactionsData || [];
        var searchDesc = document.getElementById('capitalFilterDesc')?.value.toLowerCase() || '';
        var filterType = document.getElementById('capitalFilterType')?.value || '';
        var startDate = document.getElementById('capitalFilterStart')?.value;
        var endDate = document.getElementById('capitalFilterEnd')?.value;
        
        var filtered = transactions.filter(function(t) {
            if (filterType && t.flow_type !== filterType) return false;
            if (searchDesc && !(t.description || '').toLowerCase().includes(searchDesc)) return false;
            if (startDate && t.recorded_at < startDate) return false;
            if (endDate && t.recorded_at > endDate + 'T23:59:59') return false;
            return true;
        });
        this._renderCapitalTransactionsTable(filtered);
    },
    
    resetCapitalFilters: function() {
        var descInput = document.getElementById('capitalFilterDesc');
        var typeSelect = document.getElementById('capitalFilterType');
        var startInput = document.getElementById('capitalFilterStart');
        var endInput = document.getElementById('capitalFilterEnd');
        if (descInput) descInput.value = '';
        if (typeSelect) typeSelect.value = '';
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        this.filterCapitalTransactions();
    },
    
    _renderCapitalTransactionsTable: function(transactions) {
        var tbody = document.getElementById('capitalTransactionsBody');
        if (!tbody) return;
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        var typeMap = {
            loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
            admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
            service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
            interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
            principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
            expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
            internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
            internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
        };
        var directionMap = {
            inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
            outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
        };
        var sourceMap = {
            cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
            bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
        };
        var rows = '';
        if (transactions.length === 0) {
            rows = '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="text-center">' + (lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录') + '<\/td><\/tr>';
        } else {
            for (var i = 0; i < transactions.length; i++) {
                var t = transactions[i];
                rows += '<tr>' +
                    '<td class="date-cell">' + Utils.formatDate(t.recorded_at) + '</td>' +
                    '<td>' + (typeMap[t.flow_type] || t.flow_type) + '</td>' +
                    '<td class="text-center">' + (directionMap[t.direction] || t.direction) + '</td>' +
                    '<td class="text-center">' + (sourceMap[t.source_target] || t.source_target) + '</td>' +
                    '<td class="text-right ' + (t.direction === 'inflow' ? 'income' : 'expense') + '">' + Utils.formatCurrency(t.amount) + '</td>' +
                    '<td class="flow-desc">' + Utils.escapeHtml(t.description || '-') + '</td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(t.stores?.name || '-') + '</td>' : '') +
                '<\/tr>';
            }
        }
        tbody.innerHTML = rows;
    },
    
    printCapitalTransactions: function() {
        var modalContent = document.querySelector('#capitalModal .modal-content');
        if (!modalContent) return;
        var printContent = modalContent.cloneNode(true);
        var lang = Utils.lang;
        var storeName = AUTH.getCurrentStoreName();
        var userName = AUTH.user?.name || '-';
        var printDateTime = new Date().toLocaleString();
        var printWindow = window.open('', '_blank');
        printWindow.document.write('' +
            '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
                '<meta charset="UTF-8">' +
                '<title>JF! by Gadai - ' + (lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录') + '</title>' +
                '<style>' +
                    '*{box-sizing:border-box;margin:0;padding:0}' +
                    'body{font-family:\'Segoe UI\',Arial,sans-serif;font-size:11px;line-height:1.4;color:#1e293b;padding:15mm}' +
                    '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:10px}' +
                    '.header h1{font-size:18px;margin:5px 0}' +
                    '.store-info{text-align:center;font-size:10pt;color:#475569;margin:5px 0}' +
                    '.user-info{text-align:center;font-size:9pt;color:#64748b;margin-bottom:15px}' +
                    'table{width:100%;border-collapse:collapse;margin-top:15px}' +
                    'th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:10px}' +
                    'th{background:#f1f5f9;font-weight:700}' +
                    '.text-right{text-align:right}' +
                    '.text-center{text-align:center}' +
                    '.income{color:#10b981}' +
                    '.expense{color:#ef4444}' +
                    '.footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}' +
                    '.no-print{text-align:center;margin-bottom:15px}' +
                    '.no-print button{margin:0 5px;padding:6px 14px;cursor:pointer;border:none;border-radius:4px}' +
                    '@media print{.no-print{display:none}@page{size:A4;margin:15mm}}' +
                '</style>' +
            '</head>' +
            '<body>' +
                '<div class="no-print">' +
                    '<button onclick="window.print()">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '<button onclick="window.close()">' + (lang === 'id' ? 'Tutup' : '关闭') + '</button>' +
                '</div>' +
                '<div class="header">' +
                    '<h1>JF! by Gadai</h1>' +
                    '<div class="store-info">🏪 ' + Utils.escapeHtml(storeName) + '</div>' +
                    '<div class="user-info">👤 ' + Utils.escapeHtml(userName) + ' | 📅 ' + printDateTime + '</div>' +
                    '<h3>💰 ' + (lang === 'id' ? 'Riwayat Transaksi Kas' : '资金流水记录') + '</h3>' +
                '</div>' +
                (printContent.querySelector('.table-container')?.innerHTML || '') +
                '<div class="footer">' +
                    '<div>JF! by Gadai - ' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + '</div>' +
                    '<div>' + (lang === 'id' ? 'Terima kasih' : '感谢您的信任') + '</div>' +
                '</div>' +
            '</body>' +
            '</html>'
        );
        printWindow.document.close();
    },
    
    exportCapitalTransactionsToCSV: function() {
        var transactions = window._capitalTransactionsData || [];
        var lang = Utils.lang;
        var headers = lang === 'id'
            ? ['Tanggal', 'Tipe', 'Arah', 'Sumber', 'Jumlah', 'Deskripsi']
            : ['日期', '类型', '方向', '来源/去向', '金额', '描述'];
        var typeMap = {
            loan_disbursement: lang === 'id' ? 'Pencairan Pinjaman' : '贷款发放',
            admin_fee: lang === 'id' ? 'Admin Fee' : '管理费',
            service_fee: lang === 'id' ? 'Service Fee' : '服务费',
            interest: lang === 'id' ? 'Bunga' : '利息',
            principal: lang === 'id' ? 'Pokok' : '本金',
            expense: lang === 'id' ? 'Pengeluaran' : '运营支出'
        };
        var rows = transactions.map(function(t) {
            return [
                t.recorded_at.split('T')[0],
                typeMap[t.flow_type] || t.flow_type,
                t.direction === 'inflow' ? (lang === 'id' ? 'Masuk' : '流入') : (lang === 'id' ? 'Keluar' : '流出'),
                t.source_target === 'cash' ? (lang === 'id' ? 'Tunai' : '现金') : (lang === 'id' ? 'Bank' : '银行'),
                t.amount,
                t.description || '-'
            ];
        });
        var csvContent = [headers].concat(rows).map(function(row) {
            return row.map(function(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'jf_cash_flow_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    },

    filterCashFlowModal: function() {
        var transactions = window._cashFlowModalData || [];
        var startDate = document.getElementById('cashFlowFilterStart')?.value;
        var endDate = document.getElementById('cashFlowFilterEnd')?.value;
        
        var filtered = transactions.filter(function(t) {
            if (startDate && t.recorded_at < startDate) return false;
            if (endDate && t.recorded_at > endDate + 'T23:59:59') return false;
            return true;
        });
        this._renderCashFlowModalTable(filtered);
    },
    
    resetCashFlowFilters: function() {
        var startInput = document.getElementById('cashFlowFilterStart');
        var endInput = document.getElementById('cashFlowFilterEnd');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        this.filterCashFlowModal();
    },
    
    _renderCashFlowModalTable: function(transactions) {
        var tbody = document.getElementById('cashFlowModalBody');
        if (!tbody) return;
        var lang = Utils.lang;
        var typeMap = {
            loan_disbursement: lang === 'id' ? '💰 Pencairan Pinjaman' : '💰 贷款发放',
            admin_fee: lang === 'id' ? '📋 Admin Fee' : '📋 管理费',
            service_fee: lang === 'id' ? '✨ Service Fee' : '✨ 服务费',
            interest: lang === 'id' ? '📈 Bunga' : '📈 利息',
            principal: lang === 'id' ? '🏦 Pokok' : '🏦 本金',
            expense: lang === 'id' ? '📝 Pengeluaran' : '📝 运营支出',
            internal_transfer_out: lang === 'id' ? '🔄 Transfer Keluar' : '🔄 转出',
            internal_transfer_in: lang === 'id' ? '🔄 Transfer Masuk' : '🔄 转入'
        };
        var directionMap = {
            inflow: lang === 'id' ? '📥 Masuk' : '📥 流入',
            outflow: lang === 'id' ? '📤 Keluar' : '📤 流出'
        };
        var sourceMap = {
            cash: lang === 'id' ? '🏦 Brankas' : '🏦 保险柜',
            bank: lang === 'id' ? '🏧 Bank BNI' : '🏧 银行BNI'
        };
        var rows = '';
        if (transactions.length === 0) {
            rows = '<tr><td colspan="6" class="text-center">' + (lang === 'id' ? 'Tidak ada transaksi' : '暂无交易记录') + '<\/td><\/tr>';
        } else {
            for (var i = 0; i < transactions.length; i++) {
                var t = transactions[i];
                rows += '<tr>' +
                    '<td class="date-cell">' + Utils.formatDate(t.recorded_at) + '<\/td>' +
                    '<td>' + (typeMap[t.flow_type] || t.flow_type) + '<\/td>' +
                    '<td class="text-center">' + (directionMap[t.direction] || t.direction) + '<\/td>' +
                    '<td class="text-center">' + (sourceMap[t.source_target] || t.source_target) + '<\/td>' +
                    '<td class="text-right ' + (t.direction === 'inflow' ? 'income' : 'expense') + '">' + Utils.formatCurrency(t.amount) + '<\/td>' +
                    '<td class="flow-desc">' + Utils.escapeHtml(t.description || '-') + '<\/td>' +
                '<\/tr>';
            }
        }
        tbody.innerHTML = rows;
    },
    
    printCashFlowModal: function() {
        var modalContent = document.querySelector('#cashFlowModal .modal-content');
        if (!modalContent) return;
        var printContent = modalContent.cloneNode(true);
        var lang = Utils.lang;
        var storeName = AUTH.getCurrentStoreName();
        var userName = AUTH.user?.name || '-';
        var printDateTime = new Date().toLocaleString();
        var printWindow = window.open('', '_blank');
        printWindow.document.write('' +
            '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
                '<meta charset="UTF-8">' +
                '<title>JF! by Gadai - ' + (lang === 'id' ? 'Riwayat Arus Kas' : '资金流水记录') + '</title>' +
                '<style>' +
                    '*{box-sizing:border-box;margin:0;padding:0}' +
                    'body{font-family:\'Segoe UI\',Arial,sans-serif;font-size:11px;line-height:1.4;color:#1e293b;padding:15mm}' +
                    '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:10px}' +
                    '.header h1{font-size:18px;margin:5px 0}' +
                    '.store-info{text-align:center;font-size:10pt;color:#475569;margin:5px 0}' +
                    '.user-info{text-align:center;font-size:9pt;color:#64748b;margin-bottom:15px}' +
                    'table{width:100%;border-collapse:collapse;margin-top:15px}' +
                    'th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:10px}' +
                    'th{background:#f1f5f9;font-weight:700}' +
                    '.text-right{text-align:right}' +
                    '.text-center{text-align:center}' +
                    '.income{color:#10b981}' +
                    '.expense{color:#ef4444}' +
                    '.footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}' +
                    '.no-print{text-align:center;margin-bottom:15px}' +
                    '@media print{.no-print{display:none}@page{size:A4;margin:15mm}}' +
                '</style>' +
            '</head>' +
            '<body>' +
                '<div class="no-print">' +
                    '<button onclick="window.print()">🖨️ ' + (lang === 'id' ? 'Cetak' : '打印') + '</button>' +
                    '<button onclick="window.close()">' + (lang === 'id' ? 'Tutup' : '关闭') + '</button>' +
                '</div>' +
                '<div class="header">' +
                    '<h1>JF! by Gadai</h1>' +
                    '<div class="store-info">🏪 ' + Utils.escapeHtml(storeName) + '</div>' +
                    '<div class="user-info">👤 ' + Utils.escapeHtml(userName) + ' | 📅 ' + printDateTime + '</div>' +
                    '<h3>💰 ' + (lang === 'id' ? 'Riwayat Arus Kas' : '资金流水记录') + '</h3>' +
                '</div>' +
                (printContent.querySelector('.table-container')?.innerHTML || '') +
                '<div class="footer">' +
                    '<div>JF! by Gadai - ' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + '</div>' +
                    '<div>' + (lang === 'id' ? 'Terima kasih' : '感谢您的信任') + '</div>' +
                '</div>' +
            '</body>' +
            '</html>'
        );
        printWindow.document.close();
    },

    showTransferModal: async function(transferType) {
        var lang = Utils.lang;
        var title = '';
        var fromLabel = '';
        var toLabel = '';
        var maxAmount = 0;
        var cashFlow = await SUPABASE.getCashFlowSummary();
        
        switch(transferType) {
            case 'cash_to_bank':
                title = lang === 'id' ? '💰 Transfer Kas ke Bank' : '💰 现金存入银行';
                fromLabel = lang === 'id' ? 'Dari Brankas (Tunai)' : '从保险柜（现金）';
                toLabel = lang === 'id' ? 'Ke Bank BNI' : '存入银行 BNI';
                maxAmount = cashFlow.cash.balance;
                break;
            case 'bank_to_cash':
                title = lang === 'id' ? '💰 Tarik Tunai dari Bank' : '💰 银行取现';
                fromLabel = lang === 'id' ? 'Dari Bank BNI' : '从银行 BNI';
                toLabel = lang === 'id' ? 'Ke Brankas (Tunai)' : '存入保险柜（现金）';
                maxAmount = cashFlow.bank.balance;
                break;
            case 'store_to_hq':
                title = lang === 'id' ? '🏢 Setoran ke Kantor Pusat' : '🏢 上缴总部';
                fromLabel = lang === 'id' ? 'Dari Bank Toko' : '从门店银行';
                toLabel = lang === 'id' ? 'Ke Kantor Pusat' : '上缴总部';
                var profile = await SUPABASE.getCurrentProfile();
                var shopAccount = await SUPABASE.getShopAccount(profile?.store_id);
                maxAmount = shopAccount.bank_balance;
                break;
            default:
                return;
        }
        
        if (maxAmount <= 0) {
            alert(lang === 'id' ? '❌ Saldo tidak mencukupi' : '❌ 余额不足');
            return;
        }
        
        var amount = prompt(
            title + '\n\n' + fromLabel + '\n' + toLabel + '\n\n' + (lang === 'id' ? 'Maksimal' : '最大') + ': ' + Utils.formatCurrency(maxAmount) + '\n\n' + (lang === 'id' ? 'Masukkan jumlah:' : '请输入金额:'),
            Utils.formatNumberWithCommas(maxAmount)
        );
        
        if (!amount) return;
        
        var numAmount = Utils.parseNumberFromCommas(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert(lang === 'id' ? 'Jumlah tidak valid' : '金额无效');
            return;
        }
        
        if (numAmount > maxAmount) {
            alert(lang === 'id' ? 'Jumlah melebihi saldo' : '金额超过余额');
            return;
        }
        
        var confirmMsg = lang === 'id'
            ? 'Konfirmasi transfer:\n\n' + fromLabel + ' → ' + toLabel + '\n' + Utils.formatCurrency(numAmount) + '\n\nLanjutkan?'
            : '确认转账：\n\n' + fromLabel + ' → ' + toLabel + '\n' + Utils.formatCurrency(numAmount) + '\n\n继续吗？';
        
        if (confirm(confirmMsg)) {
            await this.executeTransfer(transferType, numAmount);
        }
    },

    executeTransfer: async function(transferType, amount) {
        var lang = Utils.lang;
        var profile = await SUPABASE.getCurrentProfile();
        
        try {
            if (transferType === 'cash_to_bank') {
                await SUPABASE.recordInternalTransfer({
                    transfer_type: 'cash_to_bank',
                    from_account: 'cash',
                    to_account: 'bank',
                    amount: amount,
                    description: lang === 'id' ? 'Transfer kas ke bank' : '现金存入银行',
                    store_id: profile?.store_id
                });
                alert(lang === 'id' ? '✅ Transfer berhasil' : '✅ 转账成功');
            } else if (transferType === 'bank_to_cash') {
                await SUPABASE.recordInternalTransfer({
                    transfer_type: 'bank_to_cash',
                    from_account: 'bank',
                    to_account: 'cash',
                    amount: amount,
                    description: lang === 'id' ? 'Tarik tunai dari bank' : '银行取现',
                    store_id: profile?.store_id
                });
                alert(lang === 'id' ? '✅ Transfer berhasil' : '✅ 转账成功');
            } else if (transferType === 'store_to_hq') {
                await SUPABASE.remitToHeadquarters(profile?.store_id, amount, lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部');
                alert(lang === 'id' ? '✅ Setoran berhasil' : '✅ 上缴成功');
            }
            
            await APP.renderDashboard();
        } catch (error) {
            alert(lang === 'id' ? '❌ Gagal: ' + error.message : '❌ 失败：' + error.message);
        }
    },

    showInternalTransferHistory: async function() {
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        
        try {
            var transfers = await SUPABASE.getInternalTransfers();
            
            var typeMap = {
                cash_to_bank: lang === 'id' ? '🏦→🏧 Kas ke Bank' : '🏦→🏧 现金存入银行',
                bank_to_cash: lang === 'id' ? '🏧→🏦 Tarik Tunai' : '🏧→🏦 银行取现',
                store_to_hq: lang === 'id' ? '🏢 Setoran ke Pusat' : '🏢 上缴总部'
            };
            
            var rows = '';
            if (transfers.length === 0) {
                rows = '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="text-center">' + (lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < transfers.length; i++) {
                    var t = transfers[i];
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(t.transfer_date) + '<\/td>' +
                        '<td>' + (typeMap[t.transfer_type] || t.transfer_type) + '<\/td>' +
                        '<td class="text-right">' + Utils.formatCurrency(t.amount) + '<\/td>' +
                        '<td>' + Utils.escapeHtml(t.description || '-') + '<\/td>' +
                        '<td>' + Utils.escapeHtml(t.created_by_profile?.name || '-') + '<\/td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(t.stores?.name || '-') + '<\/td>' : '') +
                    '<\/tr>';
                }
            }
            
            var modalHtml = '' +
                '<div id="internalTransferModal" class="modal-overlay">' +
                    '<div class="modal-content" style="max-width:800px;">' +
                        '<h3>🔄 ' + (lang === 'id' ? 'Riwayat Transfer Internal' : '内部转账记录') + '</h3>' +
                        '<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">' +
                            '<input type="date" id="transferFilterStart" placeholder="' + (lang === 'id' ? 'Dari tanggal' : '开始日期') + '">' +
                            '<input type="date" id="transferFilterEnd" placeholder="' + (lang === 'id' ? 'Sampai tanggal' : '结束日期') + '">' +
                            '<button onclick="APP.filterInternalTransferHistory()" class="btn-small">🔍 ' + (lang === 'id' ? 'Filter' : '筛选') + '</button>' +
                            '<button onclick="APP.resetInternalTransferFilters()" class="btn-small">🔄 ' + (lang === 'id' ? 'Reset' : '重置') + '</button>' +
                        '</div>' +
                        '<div class="table-container" style="max-height:400px; overflow-y:auto;">' +
                            '<table class="data-table transfer-table" style="min-width:600px;">' +
                                '<thead>' +
                                    '<tr>' +
                                        '<th>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th>' +
                                        '<th>' + (lang === 'id' ? 'Jenis Transfer' : '转账类型') + '</th>' +
                                        '<th class="text-right">' + (lang === 'id' ? 'Jumlah' : '金额') + '</th>' +
                                        '<th>' + (lang === 'id' ? 'Deskripsi' : '描述') + '</th>' +
                                        '<th>' + (lang === 'id' ? 'Oleh' : '操作人') + '</th>' +
                                        (isAdmin ? '<th class="text-center">' + (lang === 'id' ? 'Toko' : '门店') + '</th>' : '') +
                                    '</tr>' +
                                '</thead>' +
                                '<tbody id="internalTransferBody">' +
                                    rows +
                                '</tbody>' +
                            '</table>' +
                        '</div>' +
                        '<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">' +
                            '<button onclick="APP.exportInternalTransferToCSV()" class="btn-export">📎 ' + (lang === 'id' ? 'Ekspor CSV' : '导出CSV') + '</button>' +
                            '<button onclick="document.getElementById(\'internalTransferModal\').remove()" class="btn-back">✖ ' + (lang === 'id' ? 'Tutup' : '关闭') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            window._internalTransfersData = transfers;
        } catch (error) {
            console.error("showInternalTransferHistory error:", error);
            alert(lang === 'id' ? 'Gagal memuat riwayat transfer' : '加载转账记录失败');
        }
    },

    filterInternalTransferHistory: function() {
        var transfers = window._internalTransfersData || [];
        var startDate = document.getElementById('transferFilterStart')?.value;
        var endDate = document.getElementById('transferFilterEnd')?.value;
        
        var filtered = transfers.filter(function(t) {
            if (startDate && t.transfer_date < startDate) return false;
            if (endDate && t.transfer_date > endDate) return false;
            return true;
        });
        this._renderInternalTransferHistory(filtered);
    },

    resetInternalTransferFilters: function() {
        var startInput = document.getElementById('transferFilterStart');
        var endInput = document.getElementById('transferFilterEnd');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        this.filterInternalTransferHistory();
    },

    _renderInternalTransferHistory: function(transfers) {
        var tbody = document.getElementById('internalTransferBody');
        if (!tbody) return;
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        var typeMap = {
            cash_to_bank: lang === 'id' ? '🏦→🏧 Kas ke Bank' : '🏦→🏧 现金存入银行',
            bank_to_cash: lang === 'id' ? '🏧→🏦 Tarik Tunai' : '🏧→🏦 银行取现',
            store_to_hq: lang === 'id' ? '🏢 Setoran ke Pusat' : '🏢 上缴总部'
        };
        var rows = '';
        if (transfers.length === 0) {
            rows = '<tr><td colspan="' + (isAdmin ? 7 : 6) + '" class="text-center">' + (lang === 'id' ? 'Tidak ada riwayat transfer' : '暂无转账记录') + '<\/td><\/tr>';
        } else {
            for (var i = 0; i < transfers.length; i++) {
                var t = transfers[i];
                rows += '<tr>' +
                    '<td class="date-cell">' + Utils.formatDate(t.transfer_date) + '<\/td>' +
                    '<td>' + (typeMap[t.transfer_type] || t.transfer_type) + '<\/td>' +
                    '<td class="text-right">' + Utils.formatCurrency(t.amount) + '<\/td>' +
                    '<td>' + Utils.escapeHtml(t.description || '-') + '<\/td>' +
                    '<td>' + Utils.escapeHtml(t.created_by_profile?.name || '-') + '<\/td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(t.stores?.name || '-') + '<\/td>' : '') +
                '<\/tr>';
            }
        }
        tbody.innerHTML = rows;
    },

    exportInternalTransferToCSV: async function() {
        var transfers = window._internalTransfersData || [];
        var lang = Utils.lang;
        var headers = lang === 'id'
            ? ['Tanggal', 'Jenis Transfer', 'Jumlah', 'Deskripsi', 'Oleh', 'Toko']
            : ['日期', '转账类型', '金额', '描述', '操作人', '门店'];
        var typeMap = {
            cash_to_bank: lang === 'id' ? 'Kas ke Bank' : '现金存入银行',
            bank_to_cash: lang === 'id' ? 'Tarik Tunai' : '银行取现',
            store_to_hq: lang === 'id' ? 'Setoran ke Pusat' : '上缴总部'
        };
        var rows = transfers.map(function(t) {
            return [
                t.transfer_date,
                typeMap[t.transfer_type] || t.transfer_type,
                t.amount,
                t.description || '-',
                t.created_by_profile?.name || '-',
                t.stores?.name || '-'
            ];
        });
        var csvContent = [headers].concat(rows).map(function(row) {
            return row.map(function(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'jf_internal_transfers_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        URL.revokeObjectURL(url);
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    }
};

for (var key in DashboardFunds) {
    if (typeof DashboardFunds[key] === 'function') {
        window.APP[key] = DashboardFunds[key];
    }
}
