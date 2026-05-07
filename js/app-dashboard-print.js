// app-dashboard-print.js - v3.7 根治浏览器打印页眉垃圾行（Chrome 强制隐藏）

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

            const printContent = originalApp.cloneNode(true);

            // ========== 移除不需要的元素 ==========
            const removeSelectors = [
                '.dashboard-v2 .dash-sidebar', '.dash-sidebar', '.sidebar', '#dashSidebar',
                '.dashboard-v2 .dash-topbar', '.dash-topbar', '.topbar', '#dashTopbar',
                '.sidebar-overlay', '#sidebarOverlay', '.toolbar', '.no-print',
                '.action-row', 'button', '.form-actions', '.form-grid', '.lang-toggle',
                '.lang-btn-side', '#hamburgerBtn', '[onclick*="toggleLanguage"]',
                '[onclick*="invalidateDashboardCache"]', '[onclick*="forceRecovery"]',
                '.modal-overlay', '.modal-content', '[id*="loadMore"]', '.sidebar-footer',
                '.nav-badge', '.header-actions', '.page-header button',
                '.print-footer', '.footer-date', '.print-header',
                '.print-date-time', '.current-time'
            ];
            for (const selector of removeSelectors) {
                const elements = printContent.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            }

            const pageHeader = printContent.querySelector('.page-header');
            if (pageHeader) {
                const headerActions = pageHeader.querySelector('.header-actions');
                if (headerActions) headerActions.remove();
            }

            const formCards = printContent.querySelectorAll('.card');
            const removeKeywords = ['Tambah', '新增', 'Edit', '编辑', 'Tambah Pengeluaran', '新增运营支出'];
            for (const card of formCards) {
                const cardText = card.textContent || '';
                if (removeKeywords.some(kw => cardText.includes(kw)) && 
                    !cardText.includes('订单号') && !cardText.includes('ID Pesanan')) {
                    card.remove();
                }
            }

            // ========== 强力清除文本中的垃圾行 ==========
            const walker = document.createTreeWalker(
                printContent,
                NodeFilter.SHOW_TEXT
            );
            const nodesToRemove = [];
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const text = node.nodeValue;
                if (!text) continue;
                const trimmed = text.trim();
                // 匹配包含日期时间 + JF! by Gadai - 打印 的整行
                if (/^(?:\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s+)?JF! by Gadai\s*-\s*(?:打印|Cetak)\s*$/i.test(trimmed) ||
                    /^(?:JF! by Gadai\s*-\s*(?:打印|Cetak))/i.test(trimmed)) {
                    const parent = node.parentNode;
                    if (parent && parent.childNodes.length === 1) {
                        nodesToRemove.push(parent);
                    } else {
                        node.nodeValue = '';
                    }
                }
            }
            nodesToRemove.forEach(el => el.remove());

            // 额外用正则清理 HTML 字符串中的垃圾（安全网）
            let contentHtml = printContent.innerHTML.trim();
            contentHtml = contentHtml
                .replace(/<[^>]*>\s*(?:\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*)?JF! by Gadai\s*-\s*(?:打印|Cetak)\s*<\/[^>]*>/gi, '')
                .replace(/^\s*(?:\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*)?JF! by Gadai\s*-\s*(?:打印|Cetak)\s*$/gim, '');

            // ========== 订单详情格式化 ==========
            this._reformatOrderInfoForPrint(printContent);

            // ========== 表格优化 ==========
            this._fillEmptyRows(printContent);
            this._limitCellLines(printContent);

            // 重新获取清理后的 HTML
            contentHtml = printContent.innerHTML;

            // ========== 页头信息 ==========
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            let storeName = '', roleText = '';
            try {
                storeName = AUTH.getCurrentStoreName();
                roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                           AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                           (lang === 'id' ? 'Staf' : '员工');
            } catch (e) {
                storeName = '-';
                roleText = '-';
            }

            const printDateTime = new Date().toLocaleString();
            const footerBrandText = lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统';

            // ========== 构建打印窗口 ==========
            const printWindow = window.open('', '_blank');
            printWindow.document.write(
                `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <!-- 标题设置为不可见字符，防止浏览器页眉显示文字 -->
                    <title>&#8203;</title>
                    <style>
                        * {
                            box-sizing: border-box;
                            margin: 0;
                            padding: 0;
                        }
                        /* 强制重置所有外边距和内边距 */
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white;
                            font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
                            font-size: 9pt;
                            line-height: 1.4;
                            color: #1e293b;
                        }
                        /* @page 设置：上边距为 0，然后通过 body 上边距控制实际内容位置，以此覆盖浏览器页眉区 */
                        @page {
                            size: A4 portrait;
                            margin: 0mm;  /* 完全清除页边距，再用 body 的 padding 模拟 */
                        }
                        /* 恢复实际需要的边距（原设计为上下 12mm 左右 10mm） */
                        .print-container {
                            margin: 12mm 10mm;
                            padding: 0;
                        }
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
                        ${contentHtml}
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

        _fillEmptyRows(printContent) {
            const MIN_ROWS = 15;
            const tables = printContent.querySelectorAll('table');
            for (const table of tables) {
                const tbody = table.querySelector('tbody');
                if (!tbody) continue;
                const rows = tbody.querySelectorAll('tr:not(.print-empty-rows)');
                const count = rows.length;
                if (count >= MIN_ROWS) continue;
                const firstRow = rows[0] || table.querySelector('thead tr');
                if (!firstRow) continue;
                const colCount = firstRow.querySelectorAll('th, td').length;
                const needed = MIN_ROWS - count;
                for (let i = 0; i < needed; i++) {
                    const tr = document.createElement('tr');
                    tr.className = 'print-empty-rows';
                    for (let j = 0; j < colCount; j++) {
                        const td = document.createElement('td');
                        td.innerHTML = '&nbsp;';
                        tr.appendChild(td);
                    }
                    tbody.appendChild(tr);
                }
            }
        },

        _limitCellLines(printContent) {
            const tds = printContent.querySelectorAll('td');
            for (const td of tds) {
                if (td.querySelector('.cell-text')) continue;
                if (td.closest('.print-empty-rows')) continue;
                const inner = td.innerHTML.trim();
                if (!inner || inner === '&nbsp;') continue;
                if (td.children.length === 0 || (td.children.length === 1 && td.children[0].tagName === 'SPAN')) {
                    const span = document.createElement('span');
                    span.className = 'cell-text';
                    span.innerHTML = inner;
                    td.innerHTML = '';
                    td.appendChild(span);
                }
            }
        },

        _reformatOrderInfoForPrint(printContent) {
            const cards = printContent.querySelectorAll('.card');
            let orderInfoCard = null;
            for (const card of cards) {
                const text = card.textContent || '';
                if ((text.includes('订单号') || text.includes('ID Pesanan')) &&
                    (text.includes('客户姓名') || text.includes('Nama Nasabah')) &&
                    (text.includes('贷款金额') || text.includes('Jumlah Pinjaman'))) {
                    orderInfoCard = card;
                    break;
                }
            }
            if (!orderInfoCard) return;

            const lines = [];
            const paragraphs = orderInfoCard.querySelectorAll('p');
            if (paragraphs.length > 0) {
                for (const p of paragraphs) {
                    const text = p.innerText.trim();
                    if (text && !text.includes('缴费记录') && !text.includes('Riwayat Pembayaran')) {
                        lines.push(text);
                    }
                }
            } else {
                const text = orderInfoCard.innerText;
                const textLines = text.split('\n');
                for (const line of textLines) {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.includes('缴费记录') && !trimmed.includes('订单详情') &&
                        !trimmed.includes('📄') && !trimmed.includes('💰') && !trimmed.includes('打印自')) {
                        lines.push(trimmed);
                    }
                }
            }

            const fieldMap = {
                '订单号': 'order_id',
                'ID Pesanan': 'order_id',
                '客户姓名': 'customer_name',
                'Nama Nasabah': 'customer_name',
                '质押物名称': 'collateral_name',
                'Nama Jaminan': 'collateral_name',
                '贷款金额': 'loan_amount',
                'Jumlah Pinjaman': 'loan_amount',
                '还款方式': 'repayment_type',
                'Jenis Cicilan': 'repayment_type',
                '状态': 'status',
                'Status': 'status',
                '约定利率': 'interest_rate',
                'Suku Bunga': 'interest_rate',
                '月利息': 'monthly_interest',
                'Bunga Bulanan': 'monthly_interest',
                '剩余本金': 'remaining_principal',
                'Sisa Pokok': 'remaining_principal'
            };

            const fields = {};
            for (const line of lines) {
                for (const [label, key] of Object.entries(fieldMap)) {
                    if (line.startsWith(label) || line.includes(label + ' ')) {
                        let value = line.replace(label, '').replace(/^[:：\s]+/, '').trim();
                        if (value) fields[key] = value;
                        break;
                    }
                }
            }

            const lang = Utils.lang;
            const labels = {
                order_id: lang === 'id' ? 'ID Pesanan' : '订单号',
                customer_name: lang === 'id' ? 'Nama Nasabah' : '客户姓名',
                collateral_name: lang === 'id' ? 'Nama Jaminan' : '质押物名称',
                loan_amount: lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额',
                repayment_type: lang === 'id' ? 'Jenis Cicilan' : '还款方式',
                status: lang === 'id' ? 'Status' : '状态',
                interest_rate: lang === 'id' ? 'Suku Bunga' : '约定利率',
                monthly_interest: lang === 'id' ? 'Bunga Bulanan' : '月利息',
                remaining_principal: lang === 'id' ? 'Sisa Pokok' : '剩余本金'
            };

            const infoItems = [
                { label: labels.order_id, value: fields.order_id || '-' },
                { label: labels.customer_name, value: fields.customer_name || '-' },
                { label: labels.collateral_name, value: fields.collateral_name || '-' },
                { label: labels.loan_amount, value: fields.loan_amount || '-' },
                { label: labels.repayment_type, value: fields.repayment_type || '-' },
                { label: labels.status, value: fields.status || '-' },
                { label: labels.interest_rate, value: fields.interest_rate || '-' },
                { label: labels.monthly_interest, value: fields.monthly_interest || '-' },
                { label: labels.remaining_principal, value: fields.remaining_principal || '-' }
            ];

            const gridHtml = `
                <div class="order-info-grid">
                    ${infoItems.map(item => `
                        <div class="info-item">
                            <div class="label">${Utils.escapeHtml(item.label)}</div>
                            <div class="value">${Utils.escapeHtml(item.value)}</div>
                        </div>
                    `).join('')}
                </div>
            `;

            const otherContent = [];
            const children = orderInfoCard.children;
            for (const child of children) {
                if (child.tagName === 'H3' && (child.innerText.includes('缴费记录') || child.innerText.includes('Riwayat Pembayaran'))) {
                    otherContent.push(child.outerHTML);
                    let next = child.nextElementSibling;
                    while (next && (!next.tagName === 'H3' || !next.innerText.includes('订单'))) {
                        otherContent.push(next.outerHTML);
                        next = next.nextElementSibling;
                    }
                    break;
                }
            }

            orderInfoCard.innerHTML = gridHtml + otherContent.join('');
        }
    };

    JF.PrintPage = PrintPage;
    if (window.APP) {
        window.APP.printCurrentPage = PrintPage.printCurrentPage.bind(PrintPage);
    } else {
        window.APP = { printCurrentPage: PrintPage.printCurrentPage.bind(PrintPage) };
    }

    console.log('✅ JF.PrintPage v3.7 根治浏览器打印页眉（@page margin:0 + 空标题 + 内容清理）');
})();
