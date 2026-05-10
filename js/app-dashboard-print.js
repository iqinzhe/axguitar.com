// app-dashboard-print.js - v2.0

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
                'button', '.form-actions', '.form-grid', '.lang-toggle',
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

            // ========== 订单列表页面特殊处理：移除操作行，保留完整订单数据 ==========
            this._cleanOrderTableForPrint(printContent);

            // ========== 订单详情页面特殊处理：将订单信息改为3列3行网格 ==========
            this._reformatOrderInfoForPrint(printContent);

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

            // 构建打印页面
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                Utils.toast.warning(lang === 'id'
                    ? 'Popup diblokir. Izinkan popup untuk halaman ini lalu coba lagi.'
                    : '弹出窗口被拦截，请允许本页弹出窗口后重试。', 5000);
                return;
            }
            printWindow.document.write(
                `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>JF! by Gadai - ${lang === 'id' ? 'Cetak' : '打印'}</title>
                    <style>
                        /* ===== 统一打印样式 v3.0 ===== */
                        * { box-sizing: border-box; margin: 0; padding: 0; }

                        /* 隐藏浏览器默认打印戳记（URL / 标题 / 日期）*/
                        @page {
                            size: A4 portrait;
                            margin-top: 26mm;
                            margin-bottom: 16mm;
                            margin-left: 8mm;
                            margin-right: 8mm;
                        }

                        body { 
                            font-family: 'Segoe UI', Arial, sans-serif; 
                            font-size: 9pt; 
                            line-height: 1.4; 
                            color: #1e293b; 
                            padding: 0; 
                            margin: 0; 
                        }

                        /* ===== 统一页眉（每页固定顶部）===== */
                        .print-header {
                            position: fixed;
                            top: 0; left: 0; right: 0;
                            padding: 3mm 8mm 2mm;
                            background: #fff;
                            border-bottom: 2px solid #1e293b;
                            z-index: 999;
                        }
                        .print-header .logo { 
                            font-size: 13pt; 
                            font-weight: bold; 
                            color: #0e7490;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                            margin-bottom: 2px;
                        }
                        .print-header .logo img { height: 24px; width: auto; vertical-align: middle; }
                        .print-header-info {
                            font-size: 8pt;
                            color: #475569;
                            text-align: center;
                            white-space: nowrap;
                        }

                        /* ===== 统一页脚（每页固定底部）===== */
                        .print-footer { 
                            position: fixed;
                            bottom: 0; left: 0; right: 0;
                            padding: 2mm 8mm;
                            background: #fff;
                            border-top: 1px solid #e2e8f0;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            font-size: 7pt; 
                            color: #94a3b8; 
                        }
                        .print-footer .footer-left { text-align: left; }
                        .print-footer .footer-right { text-align: right; }

                        /* 内容区（留出页眉页脚空间）*/
                        .print-container { padding: 0; }

                        table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                        th { background: #f1f5f9; font-weight: 600; text-align: left; }
                        th, td { 
                            border: 1px solid #cbd5e1; 
                            padding: 5px 8px; 
                            text-align: left; 
                            font-size: 8pt; 
                            vertical-align: top; 
                        }
                        .amount { text-align: right; }
                        .text-center { text-align: center; }
                        .card { 
                            border: 1px solid #e2e8f0; 
                            border-radius: 6px; 
                            padding: 8px; 
                            margin-bottom: 10px; 
                            break-inside: avoid;
                        }
                        .card h3 { 
                            font-size: 10pt; 
                            margin-bottom: 6px; 
                            border-bottom: 1px solid #e2e8f0;
                            padding-bottom: 4px;
                        }
                        /* 3列网格样式 */
                        .order-info-grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 12px 24px;
                            margin-bottom: 20px;
                        }
                        .info-item {
                            padding: 4px 0;
                            border-bottom: 1px solid #e2e8f0;
                            break-inside: avoid;
                        }
                        .info-item .label {
                            font-size: 7pt;
                            color: #64748b;
                            margin-bottom: 2px;
                        }
                        .info-item .value {
                            font-size: 10pt;
                            font-weight: 500;
                            color: #1e293b;
                        }
                        /* 订单列表打印专用：缩略表头 */
                        .order-table th {
                            font-size: 7.5pt;
                            padding: 4px 6px;
                            white-space: nowrap;
                        }
                        .order-table td {
                            font-size: 7.5pt;
                            padding: 4px 6px;
                        }
                        .info-bar {
                            padding: 4px 8px;
                            margin-bottom: 8px;
                            font-size: 8pt;
                        }
                        /* 异常状况页面打印优化 */
                        .anomaly-grid { display: block !important; }
                        .anomaly-card {
                            border: 1px solid #e2e8f0;
                            border-radius: 6px;
                            margin-bottom: 10px;
                            break-inside: avoid;
                            page-break-inside: avoid;
                        }
                        .anomaly-card-header {
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            padding: 5px 10px;
                            background: #f8fafc;
                            border-bottom: 1px solid #e2e8f0;
                            border-radius: 6px 6px 0 0;
                        }
                        .anomaly-card-header h3 { font-size: 9pt; font-weight: 600; margin: 0; flex: 1; }
                        .anomaly-badge {
                            background: #0e7490; color: #fff;
                            font-size: 7pt; padding: 1px 7px;
                            border-radius: 10px; font-weight: 600;
                        }
                        .anomaly-card-body { padding: 6px 10px; }
                        .anomaly-card-footer { padding: 3px 10px; font-size: 7pt; color: #64748b; border-top: 1px solid #f1f5f9; }
                        .anomaly-icon { font-size: 11pt; flex-shrink: 0; }
                        .anomaly-table th { font-size: 7pt !important; padding: 3px 5px !important; white-space: nowrap; }
                        .anomaly-table td { font-size: 7pt !important; padding: 3px 5px !important; }
                        /* 排名列表 */
                        .ranking-list { display: flex; flex-direction: column; gap: 5px; padding: 4px 0; }
                        .ranking-item { display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 4px; }
                        .ranking-number { font-size: 14pt; line-height: 1.2; flex-shrink: 0; }
                        .ranking-info { flex: 1; }
                        .ranking-name { display: block; font-weight: 600; font-size: 8.5pt; }
                        .ranking-code { display: block; font-size: 7pt; color: #64748b; }
                        .ranking-count { font-size: 7pt; color: #475569; text-align: right; line-height: 1.6; }
                        .empty-state { text-align: center; padding: 10px; color: #94a3b8; font-size: 8pt; }
                        /* 用户/角色管理：操作行隐藏 */
                        .user-table .action-row,
                        .data-table .action-row { display: none !important; }
                        @media print {
                            @page { size: A4 portrait; margin-top: 26mm; margin-bottom: 16mm; margin-left: 8mm; margin-right: 8mm; }
                            html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            body { margin: 0; padding: 0; }
                            .print-header { position: fixed; top: 0; }
                            .print-footer { position: fixed; bottom: 0; }
                            .print-container { padding: 0; }
                            .card { break-inside: avoid; }
                            .anomaly-card { break-inside: avoid; page-break-inside: avoid; }
                            .user-table .action-row,
                            .data-table .action-row { display: none !important; }
                        }
                    </style>
                </head>
                <body>
                    <!-- ===== 统一页眉（每页继承）===== -->
                    <div class="print-header">
                        <div class="logo">
                            <img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display='none'">
                            JF! by Gadai
                        </div>
                        <div class="print-header-info">
                            🏪 ${isAdmin
                                ? (lang === 'id' ? 'Kantor Pusat' : '总部')
                                : (lang === 'id' ? 'Toko: ' : '门店: ') + Utils.escapeHtml(storeName)
                            } &nbsp;|&nbsp; 👤 ${Utils.escapeHtml(roleText)} &nbsp;|&nbsp; 📅 ${printDateTime}
                        </div>
                    </div>

                    <!-- ===== 统一页脚（每页继承）===== -->
                    <div class="print-footer">
                        <div class="footer-left">JF! by Gadai &nbsp;·&nbsp; ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'} &nbsp;·&nbsp; ${Utils.escapeHtml(roleText)}: ${Utils.escapeHtml(userName)}</div>
                        <div class="footer-right">${lang === 'id' ? 'Halaman' : '第'} <span id="pageNum">1</span>${lang === 'id' ? '' : ' 页'}</div>
                    </div>

                    <!-- ===== 内容区 ===== -->
                    <div class="print-container">
                        ${printContent.innerHTML}
                    </div>
                    <script>
                        window.onload = function() {
                            window.addEventListener('afterprint', function() { window.close(); });
                            window.print();
                        };
                    <\/script>
                </body>
                </html>`
            );
            printWindow.document.close();
        },

        // ========== 清理所有表格中的操作行（订单列表、角色管理等通用） ==========
        _cleanOrderTableForPrint(printContent) {
            // 1. 移除所有表格中的 action-row（通用，覆盖角色管理/订单管理等所有页面）
            printContent.querySelectorAll('.action-row').forEach(row => row.remove());

            // 2. 移除所有操作按钮容器（双重保险）
            printContent.querySelectorAll('.action-buttons').forEach(el => el.remove());

            // 3. 移除加载更多行
            ['#loadMoreRow', '#blacklistLoadMoreRow'].forEach(sel => {
                const el = printContent.querySelector(sel);
                if (el) el.remove();
            });

            // 4. 针对订单表格：再次检查包含 button 的 tr（冗余保护）
            const orderTable = printContent.querySelector('.order-table');
            if (orderTable) {
                const tbody = orderTable.querySelector('tbody');
                if (tbody) {
                    tbody.querySelectorAll('tr').forEach(row => {
                        if (row.querySelectorAll('button, .btn').length > 0) row.remove();
                    });
                }
            }

            // 5. 角色管理 select.role-select 所在行也需移除
            printContent.querySelectorAll('select.role-select').forEach(el => {
                const row = el.closest('tr');
                if (row) row.remove();
            });
        },

        // 重新格式化订单信息为3列3行网格
        _reformatOrderInfoForPrint(printContent) {
            // 查找包含订单信息的卡片
            const cards = printContent.querySelectorAll('.card');
            let orderInfoCard = null;
            
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

})();
