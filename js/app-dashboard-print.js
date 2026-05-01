// app-dashboard-print.js - v2.0 (JF 命名空间)
// 打印功能模块，挂载到 JF.PrintPage

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const PrintPage = {
        printCurrentPage() {
            this._doPrint();
        },

        _doPrint() {
            const printContent = document.getElementById("app").cloneNode(true);

            // 移除所有交互元素
            const pageHeader = printContent.querySelector('.page-header');
            if (pageHeader) {
                const headerActions = pageHeader.querySelector('.header-actions');
                if (headerActions) headerActions.remove();
                const buttons = pageHeader.querySelectorAll('button');
                for (const btn of buttons) btn.remove();
            }

            const toolbars = printContent.querySelectorAll('.toolbar');
            for (const tb of toolbars) tb.remove();

            const actionRows = printContent.querySelectorAll('.action-row');
            for (const ar of actionRows) ar.remove();

            const allButtons = printContent.querySelectorAll('button');
            for (const btn of allButtons) btn.remove();

            // 移除新增表单卡片
            const formCards = printContent.querySelectorAll('.card');
            for (let i = formCards.length - 1; i >= 0; i--) {
                const card = formCards[i];
                const cardText = card.textContent || card.innerText || '';
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

            const formActions = printContent.querySelectorAll('.form-actions');
            for (const fa of formActions) fa.remove();

            const formGrids = printContent.querySelectorAll('.form-grid');
            for (const fg of formGrids) {
                const parentCard = fg.closest('.card');
                if (parentCard) parentCard.remove();
            }

            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            const storeName = AUTH.getCurrentStoreName();
            const roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                             AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') : (lang === 'id' ? 'Staf' : '员工');
            const userName = AUTH.user?.name || '-';
            const printDateTime = new Date().toLocaleString();

            const printWindow = window.open('', '_blank');
            printWindow.document.write(
                `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>JF! by Gadai - Print</title>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #1e293b; padding: 0; margin: 0; }
                        .print-container { padding: 3mm; }
                        .print-header { text-align: center; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1px solid #ccc; }
                        .print-header .logo { font-size: 12pt; font-weight: bold; color: #2563eb; text-align: center; display: flex; align-items: center; justify-content: center; gap: 10px; }
                        .print-header .logo img { height: 28px; width: auto; vertical-align: middle; }
                        .print-store-info { font-size: 8pt; color: #475569; margin: 2px 0; text-align: center; }
                        .print-user-info { font-size: 7pt; color: #64748b; margin-bottom: 3px; text-align: center; }
                        .print-footer { text-align: center; font-size: 6pt; color: #94a3b8; margin-top: 4px; padding-top: 3px; border-top: 1px solid #e2e8f0; }
                        table { width: 100%; border-collapse: collapse; margin: 4px 0; }
                        th { background: #f1f5f9; font-weight: 600; text-align: left; }
                        th, td { border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; font-size: 7.5pt; vertical-align: top; }
                        .stats-grid-optimized { display: flex; flex-wrap: wrap; gap: 5px; }
                        .stat-card { flex: 1 1 auto; min-width: 100px; border: 1px solid #ccc; padding: 3px 5px; text-align: left; }
                        .stat-card .stat-value { font-size: 9pt; font-weight: 600; text-align: left; }
                        .stat-card .stat-label { font-size: 6.5pt; text-align: left; }
                        .anomaly-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
                        .anomaly-card { break-inside: avoid; }
                        .anomaly-card-header h3 { text-align: left; }
                        .cashflow-stats { display: flex; flex-wrap: wrap; gap: 6px; }
                        .cashflow-item { flex: 1; min-width: 120px; text-align: left; }
                        .cashflow-item .label { text-align: left; }
                        .cashflow-item .value { text-align: left; }
                        .card { border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px; margin-bottom: 6px; break-inside: avoid; text-align: left; }
                        .card h3 { font-size: 9pt; margin-bottom: 3px; border-bottom: none; text-align: left; }
                        .card p { text-align: left; }
                        .summary-grid { text-align: left; }
                        .summary-item { text-align: left; }
                        .summary-item .label { text-align: left; }
                        .summary-item .value { text-align: left; }
                        .info-column h3 { text-align: left; }
                        .info-column p { text-align: left; }
                        .customer-info-display p { text-align: left; }
                        .store-item { text-align: left; }
                        .ranking-item { text-align: left; }
                        .dashboard-footer-card p { text-align: left; }
                        .anomaly-table th { text-align: left; }
                        .anomaly-table td { text-align: left; }
                        .empty-state { text-align: left; }
                        .info-bar { text-align: left; }
                        .info-note { text-align: left; }
                        .order-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                        .page-header h1, .page-header h2 { text-align: left; }
                        @media print {
                            @page { size: A4 landscape; margin: 5mm 8mm; }
                            body { margin: 0; padding: 0; }
                            .print-container { padding: 0; }
                            .card, .anomaly-card, .cashflow-item { break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <div class="print-header">
                            <div class="logo"><img src="icons/pagehead-logo.png" alt="JF!"> JF! by Gadai</div>
                            <div class="print-store-info">🏪 ${Utils.escapeHtml(storeName)} ${isAdmin ? '(' + (lang === 'id' ? 'Kantor Pusat' : '总部') + ')' : ''}</div>
                            <div class="print-user-info">👤 ${Utils.escapeHtml(userName)} (${roleText}) | 📅 ${printDateTime}</div>
                        </div>
                        ${printContent.innerHTML}
                        <div class="print-footer">JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 800);
                        };
                    </script>
                </body>
                </html>`
            );
            printWindow.document.close();
        }
    };

    // 挂载命名空间
    JF.PrintPage = PrintPage;

    // 向下兼容
    if (window.APP) {
        window.APP.printCurrentPage = PrintPage.printCurrentPage.bind(PrintPage);
    } else {
        window.APP = { printCurrentPage: PrintPage.printCurrentPage.bind(PrintPage) };
    }

    console.log('✅ JF.PrintPage v2.0 初始化完成');
})();
