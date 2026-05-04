// app-dashboard-print.js - v2.1 (修复打印时侧边栏和顶部栏的隐藏问题)

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
            
            // 1. 移除侧边栏（Dashboard 专用）- 使用多种选择器确保覆盖
            const sidebarSelectors = [
                '.dashboard-v2 .dash-sidebar',
                '.dash-sidebar',
                '.sidebar',
                '#dashSidebar',
                '[class*="sidebar"]',
                '[class*="Sidebar"]'
            ];
            for (const selector of sidebarSelectors) {
                const elements = printContent.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            }

            // 2. 移除顶部栏（Dashboard 专用）
            const topbarSelectors = [
                '.dashboard-v2 .dash-topbar',
                '.dash-topbar',
                '.topbar',
                '#dashTopbar',
                '[class*="topbar"]',
                '[class*="Topbar"]'
            ];
            for (const selector of topbarSelectors) {
                const elements = printContent.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            }

            // 3. 移除侧边栏遮罩层
            const overlaySelectors = [
                '.sidebar-overlay',
                '#sidebarOverlay',
                '[class*="overlay"]'
            ];
            for (const selector of overlaySelectors) {
                const elements = printContent.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            }

            // 4. 移除页眉中的操作按钮（但不移除页眉本身）
            const pageHeader = printContent.querySelector('.page-header');
            if (pageHeader) {
                const headerActions = pageHeader.querySelector('.header-actions');
                if (headerActions) headerActions.remove();
                // 移除页眉中的所有按钮
                const buttons = pageHeader.querySelectorAll('button');
                for (const btn of buttons) btn.remove();
            }

            // 5. 移除所有工具栏
            const toolbars = printContent.querySelectorAll('.toolbar, .no-print');
            for (const tb of toolbars) tb.remove();

            // 6. 移除所有操作行（表格中的按钮行）
            const actionRows = printContent.querySelectorAll('.action-row');
            for (const ar of actionRows) ar.remove();

            // 7. 移除所有按钮
            const allButtons = printContent.querySelectorAll('button');
            for (const btn of allButtons) btn.remove();

            // 8. 移除新增/编辑表单卡片
            const formCards = printContent.querySelectorAll('.card');
            for (let i = formCards.length - 1; i >= 0; i--) {
                const card = formCards[i];
                const cardText = card.textContent || card.innerText || '';
                const removeKeywords = [
                    'Tambah Nasabah Baru', '新增客户',
                    'Tambah Operator Baru', '新增操作员',
                    'Tambah Toko Baru', '新增门店',
                    'Tambah Pengeluaran Baru', '新增运营支出',
                    'Tambah Peran Baru', '新增角色',
                    'Tambah Toko', '添加门店',
                    'Edit Toko', '编辑门店'
                ];
                if (removeKeywords.some(keyword => cardText.includes(keyword))) {
                    card.remove();
                }
            }

            // 9. 移除表单操作区
            const formActions = printContent.querySelectorAll('.form-actions');
            for (const fa of formActions) fa.remove();

            // 10. 移除包含表单网格且无有效数据的卡片
            const formGrids = printContent.querySelectorAll('.form-grid');
            for (const fg of formGrids) {
                const parentCard = fg.closest('.card');
                if (parentCard) {
                    const hasDataRows = parentCard.querySelector('.data-table, table') !== null;
                    if (!hasDataRows) parentCard.remove();
                }
            }

            // 11. 移除语言切换按钮
            const langToggles = printContent.querySelectorAll('.lang-toggle, .lang-btn-side, [onclick*="toggleLanguage"], [onclick*="setLanguage"]');
            for (const lt of langToggles) lt.remove();

            // 12. 移除汉堡菜单按钮
            const hamburgerBtns = printContent.querySelectorAll('#hamburgerBtn, [onclick*="_toggleSidebar"]');
            for (const btn of hamburgerBtns) btn.remove();

            // 13. 移除刷新按钮
            const refreshBtns = printContent.querySelectorAll('[onclick*="invalidateDashboardCache"], [onclick*="forceRecovery"]');
            for (const btn of refreshBtns) btn.remove();

            // 14. 移除模态框（如果意外包含）
            const modals = printContent.querySelectorAll('.modal-overlay, .modal-content');
            for (const modal of modals) modal.remove();

            // 15. 移除包含 "加载更多" 按钮的行
            const loadMoreRows = printContent.querySelectorAll('[id*="loadMore"], [onclick*="loadMore"]');
            for (const row of loadMoreRows) {
                const tr = row.closest('tr');
                if (tr) tr.remove();
                else row.remove();
            }

            // 16. 移除侧边栏底部区域
            const sidebarFooters = printContent.querySelectorAll('.sidebar-footer, [class*="sidebar-footer"]');
            for (const footer of sidebarFooters) footer.remove();

            // 17. 移除导航徽章（小红点）
            const navBadges = printContent.querySelectorAll('.nav-badge');
            for (const badge of navBadges) badge.remove();

            // 获取当前语言、用户和门店信息
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
            printWindow.document.write(
                `<!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>JF! by Gadai - ${lang === 'id' ? 'Cetak' : '打印'}</title>
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
                        .print-container { padding: 5mm; }
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
                        .print-store-info { 
                            font-size: 9pt; 
                            color: #475569; 
                            margin: 4px 0; 
                            text-align: center; 
                        }
                        .print-user-info { 
                            font-size: 8pt; 
                            color: #64748b; 
                            margin-bottom: 4px; 
                            text-align: center; 
                        }
                        .print-footer { 
                            text-align: center; 
                            font-size: 7pt; 
                            color: #94a3b8; 
                            margin-top: 12px; 
                            padding-top: 6px; 
                            border-top: 1px solid #e2e8f0; 
                        }
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
                        .stats-grid { 
                            display: flex; 
                            flex-wrap: wrap; 
                            gap: 8px; 
                            margin-bottom: 12px;
                        }
                        .card--stat { 
                            flex: 1; 
                            min-width: 100px; 
                            border: 1px solid #ccc; 
                            padding: 6px 10px; 
                            text-align: left;
                        }
                        .card--stat .stat-value { font-size: 11pt; font-weight: 700; }
                        .card--stat .stat-label { font-size: 7pt; color: #64748b; }
                        .badge { 
                            display: inline-block; 
                            padding: 2px 8px; 
                            border-radius: 4px; 
                            font-size: 7pt; 
                            font-weight: 600;
                        }
                        .info-bar { 
                            padding: 8px 12px; 
                            margin-bottom: 10px; 
                            border-radius: 6px;
                            background: #f0f9ff;
                            border-left: 3px solid #0284c7;
                        }
                        .order-detail-grid { 
                            display: grid; 
                            grid-template-columns: 1fr 1fr; 
                            gap: 12px; 
                        }
                        @media print {
                            @page { size: A4; margin: 8mm; }
                            body { margin: 0; padding: 0; }
                            .print-container { padding: 0; }
                            .card, .anomaly-card { break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <div class="print-header">
                            <div class="logo">
                                <img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display='none'">
                                JF! by Gadai
                            </div>
                            <div class="print-store-info">
                                🏪 ${Utils.escapeHtml(storeName)} ${isAdmin ? (lang === 'id' ? '(Kantor Pusat)' : '(总部)') : ''}
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

    console.log('✅ JF.PrintPage v2.1 打印模块已修复（侧边栏/顶部栏已隐藏）');
})();
