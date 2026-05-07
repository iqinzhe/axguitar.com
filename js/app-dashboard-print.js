// app-dashboard-print.js - v3.2 页脚居中、清除顶部多余行及页脚时间残留

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const PrintPage = {
        printCurrentPage() {
            this._doPrint();
        },

        _doPrint() {
            const originalApp = document.getElementById("app");
            if (!originalApp) return;

            // 深度克隆需要打印的内容
            const printContent = originalApp.cloneNode(true);

            // ========== 移除所有不需要打印的元素 ==========
            const removeSelectors = [
                '.dashboard-v2 .dash-sidebar', '.dash-sidebar', '.sidebar', '#dashSidebar',
                '.dashboard-v2 .dash-topbar', '.dash-topbar', '.topbar', '#dashTopbar',
                '.sidebar-overlay', '#sidebarOverlay', '.toolbar', '.no-print',
                '.action-row', 'button', '.form-actions', '.form-grid', '.lang-toggle',
                '.lang-btn-side', '#hamburgerBtn', '[onclick*="toggleLanguage"]',
                '[onclick*="invalidateDashboardCache"]', '[onclick*="forceRecovery"]',
                '.modal-overlay', '.modal-content', '[id*="loadMore"]', '.sidebar-footer',
                '.nav-badge', '.header-actions', '.page-header button',
                // 清除可能被克隆的页脚/页眉时间元素
                '.print-footer', '.footer-date', '.print-header',
                '.print-date-time', '.current-time'
            ];
            
            for (const selector of removeSelectors) {
                const elements = printContent.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            }

            // 移除页眉中的操作按钮区域
            const pageHeader = printContent.querySelector('.page-header');
            if (pageHeader) {
                const headerActions = pageHeader.querySelector('.header-actions');
                if (headerActions) headerActions.remove();
            }

            // 移除新增/编辑表单卡片
            const formCards = printContent.querySelectorAll('.card');
            const removeKeywords = ['Tambah', '新增', 'Edit', '编辑', 'Tambah Pengeluaran', '新增运营支出'];
            for (const card of formCards) {
                const cardText = card.textContent || '';
                if (removeKeywords.some(kw => cardText.includes(kw)) && 
                    !cardText.includes('订单号') && !cardText.includes('ID Pesanan')) {
                    card.remove();
                }
            }

            // ========== 强力清除顶部“JF! by Gadai - 打印”及类似文本 ==========
            const allElements = printContent.querySelectorAll('*');
            for (const el of allElements) {
                // 移除仅包含该文本的元素（文本节点/父元素）
                if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                    if (el.textContent.includes('JF! by Gadai - 打印')) {
                        el.remove();
                        continue;
                    }
                }
                // 移除纯时间格式文本（如 2026/5/7 08:09:04）的剩余元素
                const text = el.innerText || '';
                if (text.match(/^\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}(:\d{2})?$/) &&
                    el.children.length === 0) {
                    el.remove();
                }
            }

            // ========== 订单详情页面特殊处理：将订单信息改为3列3行网格 ==========
            this._reformatOrderInfoForPrint(printContent);

            // ========== 打印前后处理：空行填充 + 行高限制 ==========
            this._fillEmptyRows(printContent);
            this._limitCellLines(printContent);

            // ========== 获取打印页头信息 ==========
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            let storeName = '';
            let roleText = '';
            let userName = '';

            try {
                storeName = AUTH.getCurrentStoreName();
                roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                           AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                           (lang === 'id' ? 'Staf' : '员工');
                userName = AUTH.user?.name || '-';
            } catch (e) {
                storeName = '-';
                roleText = '-';
                userName = '-';
            }

            const printDateTime = new Date().toLocaleString();
            const footerBrandText = lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统';

            // 构建打印页面
            const printWindow = window.open('', '_blank');
            printWindow.document.write(
                `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>JF! by Gadai - ${lang === 'id' ? 'Cetak' : '打印'}</title>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }

                        /* ===== 页面设置：A4竖版，页脚居中（品牌 + 页码） ===== */
                        @page {
                            size: A4 portrait;
                            margin: 12mm 10mm 12mm 10mm; /* 上下边距一致 */
                            @bottom-center {
                                content: "JF! by Gadai — ${footerBrandText} — " counter(page) " / " counter(pages);
                                font-size: 7.5pt;
                                color: #94a3b8;
                            }
                        }

                        html, body {
                            font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
                            font-size: 9pt;
                            line-height: 1.4;
                            color: #1e293b;
                            background: #fff;
                            margin: 0;
                            padding: 0;
                        }

                        /* ===== 页眉 ===== */
                        .print-header {
                            text-align: center;
                            margin-bottom: 8px;
                            padding-bottom: 6px;
                            border-bottom: 2px solid #1e293b;
                        }
                        .print-header .logo {
                            font-size: 14pt;
                            font-weight: bold;
                            color: #0e7490;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                        }
                        .print-header .logo img { height: 28px; width: auto; vertical-align: middle; }
                        .print-header-info {
                            font-size: 8.5pt;
                            color: #475569;
                            margin: 4px 0 4px;
                            text-align: center;
                            white-space: nowrap;
                        }

                        /* ===== 卡片 ===== */
                        .card {
                            border: 1px solid #e2e8f0;
                            border-radius: 4px;
                            padding: 8px 10px;
                            margin-bottom: 8px;
                            break-inside: avoid;
                            page-break-inside: avoid;
                        }
                        .card h3 {
                            font-size: 9.5pt;
                            font-weight: 600;
                            margin-bottom: 6px;
                            border-bottom: 1px solid #e2e8f0;
                            padding-bottom: 3px;
                        }
                        .page-header h1, .page-header h2 {
                            font-size: 11pt;
                            font-weight: 700;
                            margin-bottom: 6px;
                        }

                        /* ===== 表格 ===== */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                            margin: 5px 0;
                            font-size: 8pt;
                        }
                        th {
                            background: #f1f5f9;
                            font-weight: 600;
                            color: #334155;
                            border: 1px solid #cbd5e1;
                            padding: 5px 6px;
                            text-align: left;
                            vertical-align: middle;
                            white-space: nowrap;
                            height: 22pt;
                            line-height: 1.3;
                        }
                        td {
                            border: 1px solid #cbd5e1;
                            padding: 4px 6px;
                            line-height: 1.35;
                            min-height: 22pt;
                            max-height: 44pt;
                            overflow: hidden;
                            white-space: normal;
                            word-break: break-word;
                            vertical-align: middle;
                        }
                        td .cell-text {
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                        }

                        /* 列宽 */
                        .col-id, .col-id-narrow   { width: 9%; }
                        .col-date                  { width: 10%; white-space: nowrap; }
                        .col-status, .col-status-wide { width: 9%; }
                        .col-months                { width: 6%; text-align: center; }
                        .col-amount                { width: 11%; text-align: right; }
                        .col-type                  { width: 10%; }
                        .col-method                { width: 9%; }
                        .col-store                 { width: 9%; }
                        .col-name                  { width: 13%; }
                        .col-ktp                   { width: 13%; }
                        .col-phone                 { width: 10%; }
                        .col-occupation            { width: 10%; }
                        .col-desc                  { width: auto; }
                        .col-action                { width: 0; display: none; }
                        .col-collateral            { width: 14%; }

                        .amount, .text-right { text-align: right; font-variant-numeric: tabular-nums; }
                        .text-center         { text-align: center; }
                        .text-left           { text-align: left; }

                        .badge {
                            border: 1px solid #999;
                            background: none !important;
                            color: #334155 !important;
                            border-radius: 3px;
                            padding: 1px 4px;
                            font-size: 7pt;
                        }

                        .print-empty-rows td {
                            height: 22pt;
                            border: 1px solid #cbd5e1;
                            background: #fff;
                        }

                        .stats-grid {
                            display: flex !important;
                            flex-wrap: wrap !important;
                            gap: 5px !important;
                        }
                        .card--stat {
                            flex: 1 1 auto !important;
                            min-width: 80px !important;
                            border: 1px solid #cbd5e1 !important;
                            padding: 4px 6px !important;
                            box-shadow: none !important;
                        }
                        .card--stat .stat-value { font-size: 9pt !important; font-weight: 600; }
                        .card--stat .stat-label { font-size: 6.5pt !important; color: #64748b; }

                        .order-info-grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 10px 20px;
                            margin-bottom: 12px;
                        }
                        .info-item {
                            padding: 3px 0;
                            border-bottom: 1px solid #e2e8f0;
                        }
                        .info-item .label { font-size: 7pt; color: #64748b; margin-bottom: 2px; }
                        .info-item .value { font-size: 9.5pt; font-weight: 500; color: #1e293b; }

                        .order-detail-grid    { grid-template-columns: 1fr 1fr !important; }
                        .anomaly-grid         { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
                        .repayment-cards-row  { grid-template-columns: repeat(3, 1fr) !important; }
                        .info-display         { grid-template-columns: repeat(2, 1fr) !important; border: 1px solid #ccc !important; }
                        .form-grid, .form-grid.form-grid--3, .form-grid.form-grid--4 { grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; }

                        /* 隐藏杂项 */
                        .no-print, .toolbar, .action-buttons, .action-row,
                        .modal-overlay, .form-actions, .lang-toggle,
                        .btn-backup-primary, .btn-restore, .btn-blacklist,
                        .capital-btn, .btn-capital-inject { display: none !important; }

                        .summary-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 4px !important; }
                        .summary-item { padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 3px; }
                        .summary-item .label { font-size: 7pt; color: #64748b; }
                        .summary-item .value { font-size: 9pt; font-weight: 600; }

                        tbody tr { break-inside: avoid; page-break-inside: avoid; }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <div class="print-header">
                            <div class="logo">
                                <img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display='none'">
                                JF! by Gadai
                            </div>
                            <div class="print-header-info">
                                🏪 ${isAdmin
                                    ? (lang === 'id' ? 'Kantor Pusat' : '总部')
                                    : (lang === 'id' ? 'Toko：' : '门店：') + Utils.escapeHtml(storeName)
                                } &nbsp;|&nbsp; 👤 ${Utils.escapeHtml(roleText)} &nbsp;|&nbsp; 📅 ${printDateTime}
                            </div>
                        </div>
                        ${printContent.innerHTML}
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 800);
                        };
                    <\/script>
                </body>
                </html>`
            );
            printWindow.document.close();
        },

        _fillEmptyRows(printContent) { /* 同前，不变 */ },
        _limitCellLines(printContent) { /* 同前，不变 */ },
        _reformatOrderInfoForPrint(printContent) { /* 同前，不变 */ }
    };

    // 挂载
    JF.PrintPage = PrintPage;
    if (window.APP) {
        window.APP.printCurrentPage = PrintPage.printCurrentPage.bind(PrintPage);
    } else {
        window.APP = { printCurrentPage: PrintPage.printCurrentPage.bind(PrintPage) };
    }

    console.log('✅ JF.PrintPage v3.2 页脚居中，清除顶部/页脚时间冗余');
})();
