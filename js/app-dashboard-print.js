// app-dashboard-print.js - v2.3 订单详情打印优化（智能识别订单信息）

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
                        .print-header-info {
                            font-size: 9pt;
                            color: #475569;
                            margin: 4px 0 8px;
                            text-align: center;
                            white-space: nowrap;
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
                        /* 2列网格样式 */
                        .order-info-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
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
                        @media print {
                            /* margin-top: 0 隐藏浏览器自动生成的顶部打印戳记（日期+标题行） */
                            @page { size: A4; margin: 0mm 8mm 8mm 8mm; }
                            body { margin: 0; padding: 0; }
                            .print-container { padding: 5mm 0 0 0; }
                            .card { break-inside: avoid; }
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
                            <div class="print-header-info">
                                🏪 ${isAdmin
                                    ? (lang === 'id' ? 'Kantor Pusat' : '总部')
                                    : (lang === 'id' ? 'Toko：' : '门店：') + Utils.escapeHtml(storeName)
                                } &nbsp;|&nbsp; 👤 ${Utils.escapeHtml(roleText)} &nbsp;|&nbsp; 📅 ${printDateTime}
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

    // 字段映射，包含手机号码
    const fieldMap = {
        '订单号': 'order_id',
        'ID Pesanan': 'order_id',
        '客户姓名': 'customer_name',
        'Nama Nasabah': 'customer_name',
        '手机号码': 'phone',
        'Nomor Telepon': 'phone',
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
                if (value) {
                    fields[key] = value;
                }
                break;
            }
        }
    }

    const lang = Utils.lang;
    const labels = {
        order_id: lang === 'id' ? 'ID Pesanan' : '订单号',
        customer_name: lang === 'id' ? 'Nama Nasabah' : '客户姓名',
        phone: lang === 'id' ? 'Nomor Telepon' : '手机号码',
        collateral_name: lang === 'id' ? 'Nama Jaminan' : '质押物名称',
        loan_amount: lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额',
        repayment_type: lang === 'id' ? 'Jenis Cicilan' : '还款方式',
        status: lang === 'id' ? 'Status' : '状态',
        interest_rate: lang === 'id' ? 'Suku Bunga' : '约定利率',
        monthly_interest: lang === 'id' ? 'Bunga Bulanan' : '月利息',
        remaining_principal: lang === 'id' ? 'Sisa Pokok' : '剩余本金'
    };

    // 10个项目，两列5行
    const infoItems = [
        { label: labels.order_id, value: fields.order_id || '-' },
        { label: labels.customer_name, value: fields.customer_name || '-' },
        { label: labels.phone, value: fields.phone || '-' },
        { label: labels.collateral_name, value: fields.collateral_name || '-' },
        { label: labels.loan_amount, value: fields.loan_amount || '-' },
        { label: labels.repayment_type, value: fields.repayment_type || '-' },
        { label: labels.status, value: fields.status || '-' },
        { label: labels.interest_rate, value: fields.interest_rate || '-' },
        { label: labels.monthly_interest, value: fields.monthly_interest || '-' },
        { label: labels.remaining_principal, value: fields.remaining_principal || '-' }
    ];

    // 使用已有的 order-detail-grid 类名
    const gridHtml = `
        <div class="order-detail-grid">
            ${infoItems.map(item => `
                <div class="info-item">
                    <div class="label">${Utils.escapeHtml(item.label)}</div>
                    <div class="value">${Utils.escapeHtml(item.value)}</div>
                </div>
            `).join('')}
        </div>
    `;

    // 保留缴费记录等其他内容
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

    // 挂载命名空间
    JF.PrintPage = PrintPage;

    // 向下兼容
    if (window.APP) {
        window.APP.printCurrentPage = PrintPage.printCurrentPage.bind(PrintPage);
    } else {
        window.APP = { printCurrentPage: PrintPage.printCurrentPage.bind(PrintPage) };
    }

    console.log('✅ JF.PrintPage v2.3 订单详情打印优化（智能识别订单信息，3列3行网格布局）');
})();
