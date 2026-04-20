// app-dashboard-print.js - v2.2 打印模块（优化版）

window.APP = window.APP || {};

const DashboardPrint = {

    // ==================== 当前页面打印 ====================
    printCurrentPage: function() {
        this._doPrint();
    },

    // 直接打印函数（优化版：移除多余小字，优化页脚排版）
    _doPrint: function() {
        var printContent = document.getElementById("app").cloneNode(true);
        
        // 移除编辑填写客户资料的区域（新增客户卡片）
        var addCustomerCard = printContent.querySelector('.card:last-child');
        if (addCustomerCard && addCustomerCard.innerHTML && addCustomerCard.innerHTML.includes('Tambah Nasabah Baru')) {
            addCustomerCard.remove();
        }
        // 更通用的移除方式：查找包含"新增客户"或"Tambah Nasabah"的卡片
        var allCards = printContent.querySelectorAll('.card');
        for (var i = 0; i < allCards.length; i++) {
            var card = allCards[i];
            if (card.innerHTML && (card.innerHTML.includes('Tambah Nasabah Baru') || 
                card.innerHTML.includes('新增客户') ||
                card.innerHTML.includes('Tambah Nasabah') ||
                (card.querySelector('h3') && card.querySelector('h3').innerText && 
                 (card.querySelector('h3').innerText.includes('Tambah Nasabah') || 
                  card.querySelector('h3').innerText.includes('新增客户'))))) {
                card.remove();
                break;
            }
        }
        
        // 移除任何包含表单输入区域的卡片（新增客户表单）
        var formContainers = printContent.querySelectorAll('.form-grid, .form-actions');
        for (var j = 0; j < formContainers.length; j++) {
            var container = formContainers[j];
            if (container.parentElement && container.parentElement.classList && 
                container.parentElement.classList.contains('card')) {
                container.parentElement.remove();
            }
        }
        
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
        
        // 移除页面中可能存在的顶部多余小字（在图片logo和标题上面的内容）
        var pageHeaderDiv = printContent.querySelector('.page-header');
        if (pageHeaderDiv) {
            // 清理 page-header 中可能存在的多余文本节点
            var headerChildren = pageHeaderDiv.childNodes;
            for (var k = 0; k < headerChildren.length; k++) {
                if (headerChildren[k].nodeType === Node.TEXT_NODE && headerChildren[k].textContent.trim()) {
                    headerChildren[k].textContent = '';
                }
            }
        }
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>JF! by Gadai - Print</title>
                <link rel="stylesheet" href="${styles}">
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        font-size: 11px; 
                        line-height: 1.4; 
                        color: #1e293b; 
                        padding: 0;
                        margin: 0;
                    }
                    .print-container {
                        padding: 15mm;
                    }
                    @media print {
                        @page { 
                            size: A4; 
                            margin: 15mm 12mm; 
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                        }
                        .print-container {
                            padding: 0;
                        }
                        .no-print, 
                        .toolbar button:not(.print-btn), 
                        button:not(.print-btn), 
                        .btn-back, 
                        .btn-export, 
                        .btn-balance, 
                        .btn-detail,
                        .action-cell button,
                        .header-actions button,
                        .lang-toggle,
                        .transfer-buttons button,
                        .capital-btn,
                        #reminderBtn,
                        .form-actions,
                        .action-group-main,
                        .action-group-danger,
                        .address-option input,
                        input[type="radio"],
                        input[type="checkbox"],
                        .payment-method-options label,
                        .fee-options select,
                        .fee-options .fee-display,
                        .toolbar button:not(.print-btn) { 
                            display: none !important; 
                        }
                        .toolbar { 
                            display: block !important; 
                            text-align: center; 
                        }
                        .print-btn { 
                            display: inline-block !important; 
                        }
                        table { 
                            border-collapse: collapse; 
                            width: 100%; 
                        }
                        th, td { 
                            border: 1px solid #ccc !important; 
                            padding: 8px; 
                        }
                        .card, .stat-card, .report-store-section, .cashflow-summary, .customer-summary { 
                            border: 1px solid #ccc !important; 
                            box-shadow: none !important; 
                            background: white !important; 
                            page-break-inside: avoid;
                        }
                        thead { 
                            display: table-header-group; 
                        }
                        .print-footer {
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 9pt;
                            color: #666;
                            border-top: 1px solid #ccc;
                            padding-top: 6px;
                            margin-top: 8px;
                        }
                        .print-header {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            padding-bottom: 8px;
                            border-bottom: 2px solid #333;
                            margin-bottom: 15px;
                        }
                        body { 
                            padding-top: 70px; 
                            padding-bottom: 40px; 
                        }
                    }
                    .print-header { 
                        display: none; 
                    }
                    .print-footer { 
                        display: none; 
                    }
                    @media print {
                        .print-header { 
                            display: block; 
                        }
                        .print-footer { 
                            display: block; 
                        }
                    }
                    .print-header .logo { 
                        font-size: 16pt; 
                        font-weight: bold; 
                        color: #2563eb; 
                    }
                    .print-header .logo img { 
                        height: 28px; 
                        vertical-align: middle; 
                    }
                    .print-store-info { 
                        text-align: center; 
                        font-size: 10pt; 
                        color: #475569; 
                        margin: 3px 0; 
                    }
                    .print-user-info { 
                        text-align: center; 
                        font-size: 9pt; 
                        color: #64748b; 
                        margin-bottom: 6px; 
                    }
                    .empty-row-placeholder td { 
                        height: 25px; 
                    }
                    /* 确保打印时不显示编辑区域 */
                    .form-grid, .form-actions, .address-option, .payment-method-options {
                        display: none !important;
                    }
                    .card:has(.form-grid) {
                        display: none !important;
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="logo">
                        <img src="icons/pagehead-logo.png" alt="JF!" style="height:28px;"> JF! by Gadai
                    </div>
                    <div class="print-store-info">
                        🏪 ${Utils.escapeHtml(storeName)} ${isAdmin ? `(${lang === 'id' ? 'Kantor Pusat' : '总部'})` : ''}
                    </div>
                    <div class="print-user-info">
                        👤 ${Utils.escapeHtml(userName)} (${roleText}) | 📅 ${printDateTime}
                    </div>
                </div>
                
                <div class="print-container">
                    ${printContent.outerHTML}
                </div>
                
                <div class="print-footer">
                    <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'} | 🏪 ${Utils.escapeHtml(storeName)}</div>
                    <div>${lang === 'id' ? 'Terima kasih atas kepercayaan Anda' : '感谢您的信任'}</div>
                </div>
                
                <script>
                    window.onload = function() {
                        // 隐藏打印时不需要的元素
                        var hideElements = document.querySelectorAll('.form-grid, .form-actions, .address-option, .payment-method-options, .action-group-main, .action-group-danger, .header-actions button:not(.print-btn)');
                        hideElements.forEach(function(el) {
                            el.style.display = 'none';
                        });
                        
                        // 隐藏包含新增客户表单的卡片
                        var cards = document.querySelectorAll('.card');
                        cards.forEach(function(card) {
                            if (card.innerText && (card.innerText.includes('Tambah Nasabah Baru') || 
                                card.innerText.includes('新增客户') ||
                                card.innerText.includes('Tambah Nasabah'))) {
                                card.style.display = 'none';
                            }
                        });
                        
                        // 补全表格行数（使打印更美观）
                        var tables = document.querySelectorAll('table');
                        tables.forEach(function(table) {
                            var tbody = table.querySelector('tbody');
                            if (tbody && tbody.children.length < 6) {
                                var cols = table.querySelector('thead tr')?.children.length || 5;
                                var needRows = 6 - tbody.children.length;
                                for (var i = 0; i < needRows; i++) {
                                    var emptyRow = document.createElement('tr');
                                    emptyRow.className = 'empty-row-placeholder';
                                    for (var j = 0; j < cols; j++) {
                                        var td = document.createElement('td');
                                        td.innerHTML = '&nbsp;';
                                        td.style.border = '1px solid #ccc';
                                        td.style.height = '20px';
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
    
    // 生成打印底部（优化版：一行显示）
    _generatePrintFooter: function(lang, storeName) {
        return `
            <div class="footer">
                JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'} | 🏪 ${Utils.escapeHtml(storeName)} | ${lang === 'id' ? 'Terima kasih' : '感谢您的信任'}
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

console.log('✅ app-dashboard-print.js v2.2 已加载 - 打印模块优化版（移除多余小字和编辑区域）');
