// app-dashboard-print.js - v2.1 打印模块（从 core.js 扩展）

window.APP = window.APP || {};

const DashboardPrint = {

    // ==================== 当前页面打印 ====================
    printCurrentPage: function() {
        this._doPrint();
    },

    // 直接打印函数
    _doPrint: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        var styles = document.querySelector('link[rel="stylesheet"]')?.href || 'main.css';
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
                <title>Print - JF! by Gadai</title>
                <link rel="stylesheet" href="${styles}">
                <style>
                    @media print {
                        @page { size: A4; margin: 15mm 12mm; }
                        body { margin: 0; padding: 0; }
                        .no-print, .toolbar button:not(.print-btn), button:not(.print-btn), .btn-back, .btn-export, .btn-balance, .btn-detail { display: none !important; }
                        .toolbar { display: block !important; text-align: center; }
                        .print-btn { display: inline-block !important; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ccc !important; padding: 8px; }
                        .card, .stat-card, .report-store-section, .cashflow-summary { 
                            border: 1px solid #ccc !important; 
                            box-shadow: none !important; 
                            background: white !important; 
                            page-break-inside: avoid;
                        }
                        thead { display: table-header-group; }
                        .print-footer {
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 9pt;
                            color: #666;
                            border-top: 1px solid #ccc;
                            padding-top: 8px;
                        }
                        .print-header {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            padding-bottom: 10px;
                            border-bottom: 2px solid #333;
                            margin-bottom: 20px;
                        }
                        body { padding-top: 100px; padding-bottom: 50px; }
                    }
                    .print-header { display: none; }
                    .print-footer { display: none; }
                    @media print {
                        .print-header { display: block; }
                        .print-footer { display: block; }
                    }
                    .print-header .logo { font-size: 16pt; font-weight: bold; color: #2563eb; }
                    .print-header .logo img { height: 32px; vertical-align: middle; }
                    .print-store-info { text-align: center; font-size: 10pt; color: #475569; margin: 5px 0; }
                    .print-user-info { text-align: center; font-size: 9pt; color: #64748b; margin-bottom: 10px; }
                    .empty-row-placeholder td { height: 30px; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="logo">
                        <img src="icons/pagehead-logo.png" alt="JF!"> JF! by Gadai
                    </div>
                    <div class="print-store-info">
                        🏪 ${lang === 'id' ? 'Toko' : '门店'}: ${Utils.escapeHtml(storeName)}
                        ${isAdmin ? ` (${lang === 'id' ? 'Kantor Pusat' : '总部'})` : ''}
                    </div>
                    <div class="print-user-info">
                        👤 ${lang === 'id' ? 'Dicetak oleh' : '打印人'}: ${Utils.escapeHtml(userName)} (${roleText}) | 
                        📅 ${lang === 'id' ? 'Tanggal Cetak' : '打印日期'}: ${printDateTime}
                    </div>
                </div>
                
                ${printContent.outerHTML}
                
                <div class="print-footer">
                    <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    <div>${lang === 'id' ? 'Terima kasih atas kepercayaan Anda' : '感谢您的信任'}</div>
                    <div>${lang === 'id' ? 'Laporan ini dicetak secara elektronik dan tidak memerlukan tanda tangan' : '本报告为电子打印，无需签名'}</div>
                    <div>🏪 ${Utils.escapeHtml(storeName)} ${isAdmin ? `(${lang === 'id' ? 'Kantor Pusat' : '总部'})` : ''}</div>
                </div>
                
                <script>
                    window.onload = function() {
                        var tables = document.querySelectorAll('table');
                        tables.forEach(function(table) {
                            var tbody = table.querySelector('tbody');
                            if (tbody && tbody.children.length < 8) {
                                var cols = table.querySelector('thead tr')?.children.length || 5;
                                var needRows = 8 - tbody.children.length;
                                for (var i = 0; i < needRows; i++) {
                                    var emptyRow = document.createElement('tr');
                                    emptyRow.className = 'empty-row-placeholder';
                                    for (var j = 0; j < cols; j++) {
                                        var td = document.createElement('td');
                                        td.innerHTML = '&nbsp;';
                                        td.style.border = '1px solid #ccc';
                                        td.style.height = '25px';
                                        emptyRow.appendChild(td);
                                    }
                                    tbody.appendChild(emptyRow);
                                }
                            }
                        });
                        window.print();
                        setTimeout(function() { window.close(); }, 1000);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    // ==================== 资金流水打印（从 funds 模块调用的辅助函数） ====================
    // 注意：printCapitalTransactions 和 printCashFlowModal 已经在 funds.js 中实现
    // 这里提供通用的打印样式辅助函数
    
    // 获取打印样式（供其他模块复用）
    _getPrintStyles: function() {
        return `
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;line-height:1.4;color:#1e293b;padding:15mm}
            .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:10px}
            .header h1{font-size:18px;margin:5px 0}
            .store-info{text-align:center;font-size:10pt;color:#475569;margin:5px 0}
            .user-info{text-align:center;font-size:9pt;color:#64748b;margin-bottom:15px}
            table{width:100%;border-collapse:collapse;margin-top:15px}
            th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:10px}
            th{background:#f1f5f9;font-weight:700}
            .text-right{text-align:right}
            .income{color:#10b981}
            .expense{color:#ef4444}
            .footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
            .no-print{text-align:center;margin-bottom:15px}
            .no-print button{margin:0 5px;padding:6px 14px;cursor:pointer;border:none;border-radius:4px}
            @media print{.no-print{display:none}@page{size:A4;margin:15mm}}
        `;
    },
    
    // 生成打印头部
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
    
    // 生成打印底部
    _generatePrintFooter: function(lang, storeName) {
        return `
            <div class="footer">
                <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                <div>${lang === 'id' ? 'Laporan ini dicetak secara elektronik dan tidak memerlukan tanda tangan' : '本报告为电子打印，无需签名'}</div>
            </div>
        `;
    }
};

// 合并到 window.APP
for (var key in DashboardPrint) {
    if (typeof DashboardPrint[key] === 'function') {
        window.APP[key] = DashboardPrint[key];
    }
}

console.log('✅ app-dashboard-print.js v2.1 已加载 - 打印模块（扩展版）');
