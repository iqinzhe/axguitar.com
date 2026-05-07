// app-dashboard-print.js - v3.1 A4竖版打印优化（修复顶部多余行、页脚改为@page边距盒）

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
                '.nav-badge', '.header-actions', '.page-header button'
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

            // ========== 移除顶部可能出现的 "JF! by Gadai - 打印" 文本 ==========
            const allElements = printContent.querySelectorAll('*');
            for (const el of allElements) {
                // 针对只包含单个文本节点的元素
                if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                    if (el.textContent.includes('JF! by Gadai - 打印')) {
                        el.remove();
                    }
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
            // 页脚品牌文字（根据语言）
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
                        /* ===== 基础重置 ===== */
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        :root {
                            --footer-brand-text: "${footerBrandText}";
                        }

                        /* ===== 页面设置：A4竖版（上下边距一致，页脚由@page边距盒控制） ===== */
                        @page {
                            size: A4 portrait;
                            margin: 12mm 10mm 12mm 10mm; /* 上 右 下 左 */
                            @bottom-left {
                                content: "JF! by Gadai — " var(--footer-brand-text);
                                font-size: 7.5pt;
                                color: #94a3b8;
                            }
                            @bottom-right {
                                content: counter(page) " / " counter(pages);
                                font-size: 7.5pt;
                                color: #94a3b8;
                            }
                        }

                        /* ===== body 与容器 ===== */
                        html, body {
                            font-family: 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif;
                            font-size: 9pt;
                            line-height: 1.4;
                            color: #1e293b;
                            background: #fff;
                            margin: 0;
                            padding: 0;
                        }

                        /* ===== 页眉：固定在每页顶部（不重复） ===== */
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

                        /* ===== 主内容区（不再需要为固定页脚留白） ===== */
                        .print-container {
                            /* padding-bottom 不再需要，因为页脚由 @page 边距盒实现 */
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

                        /* ===== 统一表格基础 ===== */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;  /* 固定列宽，均匀分布 */
                            margin: 5px 0;
                            font-size: 8pt;
                        }
                        /* 表头 */
                        th {
                            background: #f1f5f9;
                            font-weight: 600;
                            color: #334155;
                            border: 1px solid #cbd5e1;
                            padding: 5px 6px;
                            text-align: left;
                            vertical-align: middle;
                            white-space: nowrap;
                            overflow: hidden;
                            height: 22pt; /* 统一表头行高 */
                            line-height: 1.3;
                        }
                        /* 数据行：统一行高，最多换行一次 */
                        td {
                            border: 1px solid #cbd5e1;
                            padding: 4px 6px;
                            text-align: left;
                            vertical-align: middle;
                            /* 行高统一：单行高度约为 22pt，最多两行 44pt */
                            line-height: 1.35;
                            min-height: 22pt;
                            max-height: 44pt;        /* 限制最多两行高度 */
                            overflow: hidden;
                            /* 超过两行用省略号，但实际靠 display 控制 */
                            white-space: normal;
                            word-break: break-word;
                            /* 限制为最多2行 */
                            display: table-cell;
                        }
                        /* 利用 WebKit 限制最多2行（仅适用于内容单元格内的 span） */
                        td .cell-text {
                            display: -webkit-box;
                            -webkit-line-clamp: 2;
                            -webkit-box-orient: vertical;
                            overflow: hidden;
                        }

                        /* ===== 列宽规则（A4竖版 190mm可用宽） ===== */

                        /* 订单号/ID：较窄 */
                        .col-id, .col-id-narrow   { width: 9%; }
                        /* 日期 */
                        .col-date                  { width: 10%; white-space: nowrap; }
                        /* 状态/方向 */
                        .col-status, .col-status-wide { width: 9%; }
                        /* 月数 */
                        .col-months                { width: 6%; text-align: center; }
                        /* 金额 */
                        .col-amount                { width: 11%; text-align: right; }
                        /* 类型 */
                        .col-type                  { width: 10%; }
                        /* 支付方式/来源 */
                        .col-method                { width: 9%; }
                        /* 门店 */
                        .col-store                 { width: 9%; }
                        /* 姓名/账户 */
                        .col-name                  { width: 13%; }
                        /* 身份证号 */
                        .col-ktp                   { width: 13%; }
                        /* 电话 */
                        .col-phone                 { width: 10%; }
                        /* 职业 */
                        .col-occupation            { width: 10%; }
                        /* 描述（剩余空间，自动占满） */
                        .col-desc                  { width: auto; }
                        /* 操作列（打印时隐藏，但若有保留，不占宽） */
                        .col-action                { width: 0; display: none; }
                        /* 质押物 */
                        .col-collateral            { width: 14%; }

                        /* ===== 对齐辅助 ===== */
                        .amount, .text-right { text-align: right; font-variant-numeric: tabular-nums; }
                        .text-center         { text-align: center; }
                        .text-left           { text-align: left; }

                        /* ===== 徽章扁平化 ===== */
                        .badge {
                            border: 1px solid #999;
                            background: none !important;
                            color: #334155 !important;
                            border-radius: 3px;
                            padding: 1px 4px;
                            font-size: 7pt;
                            display: inline-block;
                        }

                        /* ===== 空行填充（内容不足时填满表格线框） ===== */
                        .print-empty-rows td {
                            height: 22pt;
                            border: 1px solid #cbd5e1;
                            background: #fff;
                        }

                        /* ===== 统计卡片（stats） ===== */
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

                        /* ===== 订单详情信息网格（3列） ===== */
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

                        /* ===== 其他布局 ===== */
                        .order-detail-grid    { grid-template-columns: 1fr 1fr !important; }
                        .anomaly-grid         { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
                        .repayment-cards-row  { grid-template-columns: repeat(3, 1fr) !important; }
                        .info-display         { grid-template-columns: repeat(2, 1fr) !important; border: 1px solid #ccc !important; }
                        .form-grid, .form-grid.form-grid--3, .form-grid.form-grid--4 { grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; }

                        /* ===== 隐藏屏幕专属元素 ===== */
                        .no-print, .toolbar, .action-buttons, .action-row,
                        .modal-overlay, .form-actions, .lang-toggle,
                        .btn-backup-primary, .btn-restore, .btn-blacklist,
                        .capital-btn, .btn-capital-inject { display: none !important; }

                        /* ===== 统计汇总区 ===== */
                        .summary-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 4px !important; }
                        .summary-item { padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 3px; }
                        .summary-item .label { font-size: 7pt; color: #64748b; }
                        .summary-item .value { font-size: 9pt; font-weight: 600; }

                        /* ===== 防止表格跨页断裂（数据行） ===== */
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

        // 空行填充：若表格行数较少，补充空行使表格填满，供手工填写
        _fillEmptyRows(printContent) {
            const MIN_ROWS = 15; // 低于此行数时补空行至此数量
            const tables = printContent.querySelectorAll('table');
            for (const table of tables) {
                const tbody = table.querySelector('tbody');
                if (!tbody) continue;
                const rows = tbody.querySelectorAll('tr:not(.print-empty-rows)');
                const count = rows.length;
                if (count >= MIN_ROWS) continue;
                // 获取列数
                const firstRow = rows[0] || table.querySelector('thead tr');
                if (!firstRow) continue;
                const colCount = firstRow.querySelectorAll('th, td').length;
                const needed = MIN_ROWS - count;
                const fragment = document.createDocumentFragment
                    ? document.createDocumentFragment() : null;
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

        // 行高限制：将单元格内容包裹在 .cell-text span 中，CSS限制最多2行
        _limitCellLines(printContent) {
            const tds = printContent.querySelectorAll('td');
            for (const td of tds) {
                // 跳过已经包装过的或空行填充
                if (td.querySelector('.cell-text')) continue;
                if (td.closest('.print-empty-rows')) continue;
                const inner = td.innerHTML.trim();
                if (!inner || inner === '&nbsp;') continue;
                // 只包装纯文本内容的单元格，跳过含复杂子元素（如按钮、网格）的
                if (td.children.length === 0 || (td.children.length === 1 && td.children[0].tagName === 'SPAN')) {
                    const span = document.createElement('span');
                    span.className = 'cell-text';
                    span.innerHTML = inner;
                    td.innerHTML = '';
                    td.appendChild(span);
                }
            }
        },

        // 重新格式化订单信息为3列3行网格
        _reformatOrderInfoForPrint(printContent) {
            // 查找包含订单信息的卡片
            const cards = printContent.querySelectorAll('.card');
            let orderInfoCard = null;
            let orderInfoHtml = '';
            
            for (const card of cards) {
                const text = card.textContent || '';
                // 检查是否包含订单关键信息
                if ((text.includes('订单号') || text.includes('ID Pesanan')) &&
                    (text.includes('客户姓名') || text.includes('Nama Nasabah')) &&
                    (text.includes('贷款金额') || text.includes('Jumlah Pinjaman'))) {
                    orderInfoCard = card;
                    break;
                }
            }
            
            if (!orderInfoCard) return;
            
            // 提取订单信息（从 p 标签或直接文本中）
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
                // 如果没有 p 标签，从纯文本中提取
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
            
            // 定义需要提取的字段映射
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
            
            // 解析字段值
            const fields = {};
            for (const line of lines) {
                for (const [label, key] of Object.entries(fieldMap)) {
                    if (line.startsWith(label) || line.includes(label + ' ')) {
                        let value = line.replace(label, '').replace(/^[:：\s]+/, '').trim();
                        if (value) {
                            fields[key] = value;
                        }
                        break;
                    }
                }
            }
            
            // 语言判断
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
            
            // 构建3列网格
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
            
            // 保存原始卡片中的其他内容（如缴费记录表格）
            const otherContent = [];
            const children = orderInfoCard.children;
            for (const child of children) {
                if (child.tagName === 'H3' && (child.innerText.includes('缴费记录') || child.innerText.includes('Riwayat Pembayaran'))) {
                    // 保留缴费记录标题和后续内容
                    otherContent.push(child.outerHTML);
                    let next = child.nextElementSibling;
                    while (next && (!next.tagName === 'H3' || !next.innerText.includes('订单'))) {
                        otherContent.push(next.outerHTML);
                        next = next.nextElementSibling;
                    }
                    break;
                }
            }
            
            // 替换卡片内容
            orderInfoCard.innerHTML = gridHtml + otherContent.join('');
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

    console.log('✅ JF.PrintPage v3.1 修复顶部多余行、页脚改写为左右分布品牌与页码');
})();
