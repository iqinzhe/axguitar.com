// app-dashboard-print.js - v1.3（打印优化：多列布局、避免分页）

window.APP = window.APP || {};

const DashboardPrint = {

    printCurrentPage: function() {
        this._doPrint();
    },

    _doPrint: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        
        // 移除页面中可能存在的顶部多余元素
        var pageHeader = printContent.querySelector('.page-header');
        if (pageHeader) {
            var headerActions = pageHeader.querySelector('.header-actions');
            if (headerActions) headerActions.remove();
            var buttons = pageHeader.querySelectorAll('button');
            buttons.forEach(function(btn) { btn.remove(); });
        }
        
        // 移除所有工具栏
        var toolbars = printContent.querySelectorAll('.toolbar');
        toolbars.forEach(function(tb) { tb.remove(); });
        
        // 移除操作行（按钮行）
        var actionRows = printContent.querySelectorAll('.action-row');
        actionRows.forEach(function(ar) { ar.remove(); });
        
        // 移除所有按钮
        var allButtons = printContent.querySelectorAll('button');
        allButtons.forEach(function(btn) { btn.remove(); });
        
        // 移除表单区域
        var formCards = printContent.querySelectorAll('.card');
        formCards.forEach(function(card) {
            if (card.innerHTML && (card.innerHTML.includes('Tambah Nasabah Baru') || 
                card.innerHTML.includes('新增客户') ||
                card.innerHTML.includes('Tambah Operator') ||
                card.innerHTML.includes('新增操作员') ||
                card.innerHTML.includes('Tambah Toko') ||
                card.innerHTML.includes('新增门店'))) {
                card.remove();
            }
        });
        
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
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>JF! by Gadai - Print</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        font-size: 9pt; 
                        line-height: 1.3; 
                        color: #1e293b; 
                        padding: 0;
                        margin: 0;
                    }
                    .print-container {
                        padding: 3mm;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 6px;
                        padding-bottom: 3px;
                        border-bottom: 1px solid #ccc;
                    }
                    .print-header .logo {
                        font-size: 12pt;
                        font-weight: bold;
                        color: #2563eb;
                    }
                    .print-header .logo img {
                        height: 20px;
                        vertical-align: middle;
                    }
                    .print-store-info {
                        text-align: center;
                        font-size: 8pt;
                        color: #475569;
                        margin: 2px 0;
                    }
                    .print-user-info {
                        text-align: center;
                        font-size: 7pt;
                        color: #64748b;
                        margin-bottom: 3px;
                    }
                    .print-footer {
                        text-align: center;
                        font-size: 6pt;
                        color: #94a3b8;
                        margin-top: 4px;
                        padding-top: 3px;
                        border-top: 1px solid #e2e8f0;
                    }
                    
                    /* 表格样式 */
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 4px 0;
                    }
                    th, td {
                        border: 1px solid #cbd5e1;
                        padding: 3px 5px;
                        text-align: left;
                        font-size: 7.5pt;
                        vertical-align: top;
                    }
                    th {
                        background: #f1f5f9;
                        font-weight: 600;
                    }
                    
                    /* 统计卡片多列 */
                    .stats-grid-optimized {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 5px;
                    }
                    .stat-card {
                        flex: 1 1 auto;
                        min-width: 100px;
                        border: 1px solid #ccc;
                        padding: 3px 5px;
                    }
                    .stat-card .stat-value {
                        font-size: 9pt;
                        font-weight: 600;
                    }
                    .stat-card .stat-label {
                        font-size: 6.5pt;
                    }
                    
                    /* 异常状况2列 */
                    .anomaly-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 6px;
                    }
                    .anomaly-card {
                        break-inside: avoid;
                    }
                    
                    /* 现金流3列 */
                    .cashflow-stats {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                    }
                    .cashflow-item {
                        flex: 1;
                        min-width: 120px;
                    }
                    
                    /* 卡片样式 */
                    .card {
                        border: 1px solid #e2e8f0;
                        border-radius: 4px;
                        padding: 5px;
                        margin-bottom: 6px;
                        break-inside: avoid;
                    }
                    .card h3 {
                        font-size: 9pt;
                        margin-bottom: 3px;
                        border-bottom: none;
                    }
                    
                    /* 统一左对齐 */
                    .text-center, .text-right {
                        text-align: left !important;
                    }
                    .text-right {
                        text-align: right !important;
                    }
                    
                    @media print {
                        @page { 
                            size: A4 landscape; 
                            margin: 5mm 8mm; 
                        }
                        body { margin: 0; padding: 0; }
                        .print-container { padding: 0; }
                        .card, .anomaly-card, .cashflow-item {
                            break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="print-header">
                        <div class="logo">
                            <img src="icons/pagehead-logo.png" alt="JF!" style="height:20px;"> JF! by Gadai
                        </div>
                        <div class="print-store-info">
                            🏪 ${Utils.escapeHtml(storeName)} ${isAdmin ? `(${lang === 'id' ? 'Kantor Pusat' : '总部'})` : ''}
                        </div>
                        <div class="print-user-info">
                            👤 ${Utils.escapeHtml(userName)} (${roleText}) | 📅 ${printDateTime}
                        </div>
                    </div>
                    
                    ${printContent.innerHTML}
                    
                    <div class="print-footer">
                        JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}
                    </div>
                </div>
                
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 800);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    _getPrintStyles: function() {
        return `
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:9pt;line-height:1.3;color:#1e293b;padding:3mm}
            .header{text-align:center;margin-bottom:6px;border-bottom:1px solid #ccc;padding-bottom:3px}
            .header h1{font-size:12pt;margin:2px 0}
            .store-info{text-align:center;font-size:8pt;color:#475569;margin:2px 0}
            .user-info{text-align:center;font-size:7pt;color:#64748b;margin-bottom:3px}
            table{width:100%;border-collapse:collapse;margin-top:4px}
            th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:left;font-size:7.5pt}
            th{background:#f1f5f9;font-weight:600}
            .stats-grid-optimized{display:flex;flex-wrap:wrap;gap:5px}
            .stat-card{flex:1 1 auto;min-width:100px;border:1px solid #ccc;padding:3px 5px}
            .anomaly-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
            .cashflow-stats{display:flex;flex-wrap:wrap;gap:6px}
            .cashflow-item{flex:1;min-width:120px}
            .card{border:1px solid #e2e8f0;border-radius:4px;padding:5px;margin-bottom:6px;break-inside:avoid}
            .card h3{font-size:9pt;margin-bottom:3px;border-bottom:none}
            .text-center,.text-right{text-align:left !important}
            .text-right{text-align:right !important}
            @media print{@page{size:A4 landscape;margin:5mm 8mm}body{margin:0;padding:0}}
        `;
    },
    
    _generatePrintHeader: function(title, lang, storeName, userName, printDateTime) {
        return `
            <div class="header">
                <h1>JF! by Gadai</h1>
                <div class="store-info">🏪 ${Utils.escapeHtml(storeName)}</div>
                <div class="user-info">👤 ${Utils.escapeHtml(userName)} | 📅 ${printDateTime}</div>
                <h3>${title}</h3>
            </div>
        `;
    },
    
    _generatePrintFooter: function(lang, storeName) {
        return `
            <div class="footer">
                JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'} | 🏪 ${Utils.escapeHtml(storeName)}
            </div>
        `;
    }
};

for (var key in DashboardPrint) {
    if (typeof DashboardPrint[key] === 'function') {
        window.APP[key] = DashboardPrint[key];
    }
}
