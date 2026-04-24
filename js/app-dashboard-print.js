// app-dashboard-print.js - v1.2（优化打印样式，移除重复元素）

window.APP = window.APP || {};

const DashboardPrint = {

    // ==================== 当前页面打印 ====================
    printCurrentPage: function() {
        this._doPrint();
    },

    // 直接打印函数（优化版：移除多余元素，优化页脚排版）
    _doPrint: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        
        // 移除页面中可能存在的顶部多余元素（按钮区域）
        var pageHeader = printContent.querySelector('.page-header');
        if (pageHeader) {
            var headerActions = pageHeader.querySelector('.header-actions');
            if (headerActions) headerActions.remove();
            // 保留标题文字，移除按钮
            var buttons = pageHeader.querySelectorAll('button');
            buttons.forEach(function(btn) { btn.remove(); });
        }
        
        // 移除所有工具栏
        var toolbars = printContent.querySelectorAll('.toolbar');
        toolbars.forEach(function(tb) { tb.remove(); });
        
        // 移除操作行（按钮行）
        var actionRows = printContent.querySelectorAll('.action-row');
        actionRows.forEach(function(ar) { ar.remove(); });
        
        // 移除编辑填写客户资料的区域
        var addCustomerCard = printContent.querySelector('.card:last-child');
        if (addCustomerCard && addCustomerCard.innerHTML && 
            (addCustomerCard.innerHTML.includes('Tambah Nasabah Baru') || 
             addCustomerCard.innerHTML.includes('新增客户'))) {
            addCustomerCard.remove();
        }
        
        // 移除任何包含表单输入区域的卡片
        var formContainers = printContent.querySelectorAll('.form-grid, .form-actions, .address-option, .payment-method-options');
        formContainers.forEach(function(container) {
            if (container.parentElement && container.parentElement.classList && 
                container.parentElement.classList.contains('card')) {
                container.parentElement.remove();
            }
        });
        
        // 移除所有按钮
        var allButtons = printContent.querySelectorAll('button');
        allButtons.forEach(function(btn) { btn.remove(); });
        
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
                        font-size: 10pt; 
                        line-height: 1.3; 
                        color: #1e293b; 
                        padding: 0;
                        margin: 0;
                    }
                    .print-container {
                        padding: 4mm;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 8px;
                        padding-bottom: 4px;
                        border-bottom: 1px solid #ccc;
                    }
                    .print-header .logo {
                        font-size: 14pt;
                        font-weight: bold;
                        color: #2563eb;
                    }
                    .print-header .logo img {
                        height: 24px;
                        vertical-align: middle;
                    }
                    .print-store-info {
                        text-align: center;
                        font-size: 9pt;
                        color: #475569;
                        margin: 2px 0;
                    }
                    .print-user-info {
                        text-align: center;
                        font-size: 8pt;
                        color: #64748b;
                        margin-bottom: 4px;
                    }
                    .print-footer {
                        text-align: center;
                        font-size: 7pt;
                        color: #94a3b8;
                        margin-top: 6px;
                        padding-top: 4px;
                        border-top: 1px solid #e2e8f0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 6px 0;
                    }
                    th, td {
                        border: 1px solid #cbd5e1;
                        padding: 4px 6px;
                        text-align: left;
                        font-size: 8pt;
                    }
                    th {
                        background: #f1f5f9;
                        font-weight: 600;
                    }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .card {
                        border: 1px solid #e2e8f0;
                        border-radius: 6px;
                        padding: 8px;
                        margin-bottom: 8px;
                        break-inside: avoid;
                    }
                    .card h3 {
                        font-size: 10pt;
                        margin-bottom: 4px;
                        border-bottom: none;
                    }
                    @media print {
                        @page { 
                            size: A4 landscape; 
                            margin: 6mm 8mm; 
                        }
                        body { margin: 0; padding: 0; }
                        .print-container { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="print-header">
                        <div class="logo">
                            <img src="icons/pagehead-logo.png" alt="JF!" style="height:24px;"> JF! by Gadai
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
                        JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'} | ${lang === 'id' ? 'Terima kasih' : '感谢您的信任'}
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

    // 获取打印样式（供其他模块复用）
    _getPrintStyles: function() {
        return `
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;line-height:1.3;color:#1e293b;padding:4mm}
            .header{text-align:center;margin-bottom:8px;border-bottom:1px solid #ccc;padding-bottom:4px}
            .header h1{font-size:14pt;margin:2px 0}
            .store-info{text-align:center;font-size:9pt;color:#475569;margin:2px 0}
            .user-info{text-align:center;font-size:8pt;color:#64748b;margin-bottom:4px}
            table{width:100%;border-collapse:collapse;margin-top:6px}
            th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;font-size:8pt}
            th{background:#f1f5f9;font-weight:600}
            .text-right{text-align:right}
            .text-center{text-align:center}
            .card{border:1px solid #e2e8f0;border-radius:6px;padding:8px;margin-bottom:8px;break-inside:avoid}
            .footer{text-align:center;font-size:7pt;color:#94a3b8;margin-top:6px;padding-top:4px;border-top:1px solid #e2e8f0}
            @media print{@page{size:A4 landscape;margin:6mm 8mm}body{margin:0;padding:0}}
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
                JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'} | 🏪 ${Utils.escapeHtml(storeName)}
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
