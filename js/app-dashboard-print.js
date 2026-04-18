// app-dashboard-print.js - 打印功能模块
// 包含：打印当前页、保存PDF、打印选项
// 修改：打印时自动添加门店/总部信息

window.APP = window.APP || {};

const DashboardPrint = {

    // ==================== 打印/PDF 功能 ====================
    
    saveAsPDF: function() {
        var lang = Utils.lang;
        var printContent = document.getElementById("app").cloneNode(true);
        
        // 获取当前门店/总部信息
        var isAdmin = AUTH.isAdmin();
        var storeName = AUTH.getCurrentStoreName();
        var userRole = AUTH.user?.role;
        var roleText = userRole === 'admin' ? (lang === 'id' ? 'Administrator' : '管理员') : 
                       userRole === 'store_manager' ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                       (lang === 'id' ? 'Staf' : '员工');
        var userName = AUTH.user?.name || '-';
        var printDateTime = new Date().toLocaleString();
        
        var styles = '';
        var styleNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
        styleNodes.forEach(function(style) {
            if (style.tagName === 'STYLE') {
                styles += style.innerHTML;
            } else if (style.href) {
                styles += `<link rel="stylesheet" href="${style.href}">`;
            }
        });
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>JF! by Gadai - ${lang === 'id' ? 'Laporan' : '报表'}</title>
                ${styles}
                <style>
                    @media print {
                        @page { size: A4; margin: 15mm 12mm; }
                        body { margin: 0; padding: 0; font-size: 12pt; }
                        .no-print, .toolbar button:not(.print-btn), button:not(.print-btn), .btn-back, .btn-export, .btn-balance, .btn-detail { display: none !important; }
                        .toolbar { display: block !important; text-align: center; }
                        .print-btn { display: inline-block !important; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ccc !important; padding: 8px; text-align: left; }
                        .card, .stat-card, .report-store-section, .cashflow-summary { 
                            border: 1px solid #ccc !important; 
                            box-shadow: none !important; 
                            background: white !important; 
                            page-break-inside: avoid;
                            break-inside: avoid;
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
                            margin-top: 20px;
                        }
                        .print-header {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            margin-bottom: 20px;
                            padding-bottom: 10px;
                            border-bottom: 2px solid #333;
                        }
                        body { padding-top: 100px; padding-bottom: 50px; }
                    }
                    .print-header { display: none; }
                    .print-footer { display: none; }
                    @media print {
                        .print-header { display: block; }
                        .print-footer { display: block; }
                    }
                    .print-logo { text-align: center; margin-bottom: 10px; }
                    .print-logo img { height: 36px; vertical-align: middle; }
                    .print-title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; }
                    .print-store-info { text-align: center; font-size: 10pt; color: #475569; margin-bottom: 15px; }
                    .print-user-info { text-align: center; font-size: 9pt; color: #64748b; margin-bottom: 10px; }
                    .empty-row-placeholder td { height: 30px; }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="print-logo">
                        <img src="icons/favicon-192x192.png" alt="JF!"> JF! by Gadai
                    </div>
                    <div class="print-title">${lang === 'id' ? 'Laporan Sistem Manajemen Gadai' : '典当管理系统报表'}</div>
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
                            if (tbody && tbody.children.length < 10) {
                                var cols = table.querySelector('thead tr')?.children.length || 5;
                                var needRows = 10 - tbody.children.length;
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

    printCurrentPage: function() {
        var lang = Utils.lang;
        
        var modal = document.createElement('div');
        modal.id = 'printOptionsModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;text-align:center;">
                <h3>🖨️ ${lang === 'id' ? 'Opsi Cetak' : '打印选项'}</h3>
                <div style="display:flex;flex-direction:column;gap:12px;margin:20px 0;">
                    <button onclick="APP._doPrint()" class="success" style="padding:12px;">🖨️ ${lang === 'id' ? 'Cetak Langsung' : '直接打印'}</button>
                    <button onclick="APP.saveAsPDF()" class="warning" style="padding:12px;">📄 ${lang === 'id' ? 'Simpan sebagai PDF' : '另存为PDF'}</button>
                    <button onclick="document.getElementById('printOptionsModal').remove()" style="background:#64748b;">✖ ${lang === 'id' ? 'Batal' : '取消'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    _doPrint: function() {
        document.getElementById('printOptionsModal')?.remove();
        
        var printContent = document.getElementById("app").cloneNode(true);
        var styles = document.querySelector('link[rel="stylesheet"]')?.href || 'main.css';
        var lang = Utils.lang;
        
        // 获取当前门店/总部信息
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
                        <img src="/icon-192.png" alt="JF!"> JF! by Gadai
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
    }
};

for (var key in DashboardPrint) {
    if (typeof DashboardPrint[key] === 'function') {
        window.APP[key] = DashboardPrint[key];
    }
}
