// app-dashboard-print.js - v1.8（移除内联样式，使用组件库）

window.APP = window.APP || {};

const DashboardPrint = {

    printCurrentPage: function() {
        this._doPrint();
    },

    _doPrint: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        
        // 移除所有交互元素
        var pageHeader = printContent.querySelector('.page-header');
        if (pageHeader) {
            var headerActions = pageHeader.querySelector('.header-actions');
            if (headerActions) headerActions.remove();
            var buttons = pageHeader.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].remove();
            }
        }
        
        var toolbars = printContent.querySelectorAll('.toolbar');
        for (var i = 0; i < toolbars.length; i++) {
            toolbars[i].remove();
        }
        
        var actionRows = printContent.querySelectorAll('.action-row');
        for (var i = 0; i < actionRows.length; i++) {
            actionRows[i].remove();
        }
        
        var allButtons = printContent.querySelectorAll('button');
        for (var i = 0; i < allButtons.length; i++) {
            allButtons[i].remove();
        }
        
        // 移除新增表单卡片
        var formCards = printContent.querySelectorAll('.card');
        for (var i = formCards.length - 1; i >= 0; i--) {
            var card = formCards[i];
            var cardText = card.textContent || card.innerText || '';
            if (cardText.indexOf('Tambah Nasabah Baru') !== -1 || 
                cardText.indexOf('新增客户') !== -1 ||
                cardText.indexOf('Tambah Operator Baru') !== -1 ||
                cardText.indexOf('新增操作员') !== -1 ||
                cardText.indexOf('Tambah Toko Baru') !== -1 ||
                cardText.indexOf('新增门店') !== -1 ||
                cardText.indexOf('Tambah Pengeluaran Baru') !== -1 ||
                cardText.indexOf('新增运营支出') !== -1) {
                card.remove();
            }
        }
        
        var formActions = printContent.querySelectorAll('.form-actions');
        for (var i = 0; i < formActions.length; i++) {
            formActions[i].remove();
        }
        
        var formGrids = printContent.querySelectorAll('.form-grid');
        for (var i = 0; i < formGrids.length; i++) {
            var parentCard = formGrids[i].closest('.card');
            if (parentCard) {
                parentCard.remove();
            }
        }
        
        var lang = Utils.lang;
        var isAdmin = AUTH.isAdmin();
        var storeName = AUTH.getCurrentStoreName();
        var userRole = AUTH.user?.role;
        var roleText = userRole === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : 
                       userRole === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                       (lang === 'id' ? 'Staf' : '员工');
        var userName = AUTH.user?.name || '-';
        var printDateTime = new Date().toLocaleString();
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write('' +
            '<!DOCTYPE html>' +
            '<html>' +
            '<head>' +
                '<meta charset="UTF-8">' +
                '<title>JF! by Gadai - Print</title>' +
                '<style>' +
                    '* { box-sizing: border-box; margin: 0; padding: 0; }' +
                    'body { ' +
                        'font-family: \'Segoe UI\', Arial, sans-serif; ' +
                        'font-size: 9pt; ' +
                        'line-height: 1.3; ' +
                        'color: #1e293b; ' +
                        'padding: 0;' +
                        'margin: 0;' +
                    '}' +
                    '.print-container { padding: 3mm; }' +
                    '.print-header { text-align: center; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }' +
                    '.print-header .logo { font-size: 12pt; font-weight: bold; color: #2563eb; text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px; }' +
                    '.print-header .logo img { height: 28px; width: auto; vertical-align: middle; }' +
                    '.print-store-info { font-size: 8pt; color: #475569; margin: 2px 0; text-align: center; }' +
                    '.print-user-info { font-size: 7pt; color: #64748b; margin-bottom: 3px; text-align: center; }' +
                    '.print-footer { text-align: center; font-size: 6pt; color: #94a3b8; margin-top: 4px; padding-top: 3px; border-top: 1px solid #e2e8f0; }' +
                    'table { width: 100%; border-collapse: collapse; margin: 4px 0; }' +
                    'th { background: #f1f5f9; font-weight: 600; text-align: left; }' +
                    'th, td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; font-size: 7.5pt; vertical-align: top; }' +
                    '.stats-grid-optimized { display: flex; flex-wrap: wrap; gap: 5px; }' +
                    '.stat-card { flex: 1 1 auto; min-width: 100px; border: 1px solid #ccc; padding: 3px 5px; text-align: left; }' +
                    '.stat-card .stat-value { font-size: 9pt; font-weight: 600; text-align: left; }' +
                    '.stat-card .stat-label { font-size: 6.5pt; text-align: left; }' +
                    '.anomaly-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }' +
                    '.anomaly-card { break-inside: avoid; }' +
                    '.anomaly-card-header h3 { text-align: left; }' +
                    '.cashflow-stats { display: flex; flex-wrap: wrap; gap: 6px; }' +
                    '.cashflow-item { flex: 1; min-width: 120px; text-align: left; }' +
                    '.cashflow-item .label { text-align: left; }' +
                    '.cashflow-item .value { text-align: left; }' +
                    '.card { border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px; margin-bottom: 6px; break-inside: avoid; text-align: left; }' +
                    '.card h3 { font-size: 9pt; margin-bottom: 3px; border-bottom: none; text-align: left; }' +
                    '.card p { text-align: left; }' +
                    '.summary-grid { text-align: left; }' +
                    '.summary-item { text-align: left; }' +
                    '.summary-item .label { text-align: left; }' +
                    '.summary-item .value { text-align: left; }' +
                    '.info-column h3 { text-align: left; }' +
                    '.info-column p { text-align: left; }' +
                    '.customer-info-display p { text-align: left; }' +
                    '.store-item { text-align: left; }' +
                    '.ranking-item { text-align: left; }' +
                    '.dashboard-footer-card p { text-align: left; }' +
                    '.anomaly-table th { text-align: left; }' +
                    '.anomaly-table td { text-align: left; }' +
                    '.empty-state { text-align: left; }' +
                    '.info-bar { text-align: left; }' +
                    '.info-note { text-align: left; }' +
                    '.order-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }' +
                    '.page-header h1, .page-header h2 { text-align: left; }' +
                    '@media print { ' +
                        '@page { size: A4 landscape; margin: 5mm 8mm; } ' +
                        'body { margin: 0; padding: 0; } ' +
                        '.print-container { padding: 0; } ' +
                        '.card, .anomaly-card, .cashflow-item { break-inside: avoid; } ' +
                    '}' +
                '</style>' +
            '</head>' +
            '<body>' +
                '<div class="print-container">' +
                    '<div class="print-header">' +
                        '<div class="logo">' +
                            '<img src="icons/pagehead-logo.png" alt="JF!"> JF! by Gadai' +
                        '</div>' +
                        '<div class="print-store-info">' +
                            '🏪 ' + Utils.escapeHtml(storeName) + ' ' + (isAdmin ? '(' + (lang === 'id' ? 'Kantor Pusat' : '总部') + ')' : '') +
                        '</div>' +
                        '<div class="print-user-info">' +
                            '👤 ' + Utils.escapeHtml(userName) + ' (' + roleText + ') | 📅 ' + printDateTime +
                        '</div>' +
                    '</div>' +
                    printContent.innerHTML +
                    '<div class="print-footer">' +
                        'JF! by Gadai - ' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') +
                    '</div>' +
                '</div>' +
                '<script>' +
                    'window.onload = function() {' +
                        'window.print();' +
                        'setTimeout(function() { window.close(); }, 800);' +
                    '};' +
                '</script>' +
            '</body>' +
            '</html>'
        );
        printWindow.document.close();
    }
};

for (var key in DashboardPrint) {
    if (typeof DashboardPrint[key] === 'function') {
        window.APP[key] = DashboardPrint[key];
    }
}
