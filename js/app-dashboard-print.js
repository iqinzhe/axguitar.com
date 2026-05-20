// app-dashboard-print.js - v3.0
// 修复：客户列表、订单列表、支出、资金流水打印 + 页码 + 隐藏分页器
'use strict';
(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const PRINT_CSS = `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #1e293b; }
        .print-container { padding: 5mm; }
        .print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; break-after: avoid; page-break-after: avoid; }
        .print-header .logo { font-size: 14pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .print-header .logo img { height: 28px; width: auto; vertical-align: middle; }
        .print-header-info { font-size: 9pt; color: #475569; margin: 4px 0 8px; text-align: center; }
        .print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; white-space: nowrap; }
        table { width: 100%; border-collapse: collapse; margin: 6px 0; break-inside: auto; page-break-inside: auto; }
        thead { display: table-header-group; }
        tbody tr { break-inside: avoid; page-break-inside: avoid; }
        th { background: #f1f5f9; font-weight: 600; text-align: left; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; font-size: 8pt; vertical-align: top; }
        /* 客户列表列宽：ID窄，地址宽 */
        .customer-list-table col.col-id         { width: 18mm; }
        .customer-list-table col.col-name        { width: 28mm; }
        .customer-list-table col.col-phone       { width: 24mm; }
        .customer-list-table col.col-ktp         { width: 28mm; }
        .customer-list-table col.col-occupation  { width: 20mm; }
        .customer-list-table col.col-address     { width: 48mm; }
        .amount { text-align: right; }
        .text-center { text-align: center; }
        .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; break-inside: auto !important; page-break-inside: auto !important; }
        .card h3 { font-size: 10pt; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .order-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px; margin-bottom: 12px; }
        .info-item { padding: 4px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }
        .info-item .label { font-size: 7pt; color: #64748b; margin-bottom: 2px; }
        .info-item .value { font-size: 9.5pt; font-weight: 500; color: #1e293b; }
        .info-disclaimer { font-size: 7.5pt; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; line-height: 1.5; }
        .order-table th, .order-table td { font-size: 7.5pt; padding: 4px 6px; }
        .anomaly-grid { display: block !important; }
        .anomaly-card { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
        .anomaly-card-header { display: flex; align-items: center; gap: 6px; padding: 5px 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-radius: 6px 6px 0 0; }
        .anomaly-card-header h3 { font-size: 9pt; font-weight: 600; margin: 0; flex: 1; }
        .anomaly-badge { background: #0e7490; color: #fff; font-size: 7pt; padding: 1px 7px; border-radius: 10px; font-weight: 600; }
        .anomaly-card-body { padding: 6px 10px; }
        .anomaly-card-footer { padding: 3px 10px; font-size: 7pt; color: #64748b; border-top: 1px solid #f1f5f9; }
        .anomaly-icon { font-size: 11pt; flex-shrink: 0; }
        .anomaly-table th { font-size: 7pt !important; padding: 3px 5px !important; white-space: nowrap; }
        .anomaly-table td { font-size: 7pt !important; padding: 3px 5px !important; }
        .stat-card-inline { display: flex; align-items: center; gap: 14px; background: #fff5f5; border: 2px solid #fca5a5; border-radius: 6px; padding: 8px 14px; margin-bottom: 10px; }
        .stat-card-inline .stat-label { font-size: 9pt; font-weight: 600; color: #dc2626; white-space: nowrap; }
        .stat-card-inline .stat-value { font-size: 13pt; font-weight: 700; color: #dc2626; font-family: monospace; }
        .col-action, th.col-action, td.col-action { display: none !important; }
        .paginator, [id*="Paginator"], [id*="paginator"], .pagination, [class*="pagination"], [class*="paginator"] { display: none !important; }
        .page-header { break-after: avoid; page-break-after: avoid; margin-bottom: 10px; }
        @media print {
            @page { size: A4 portrait; margin: 8mm; }
            body { margin: 0; padding: 0; }
            .print-container { padding: 0; }
            .anomaly-card { break-inside: avoid; page-break-inside: avoid; }
            .col-action, th.col-action, td.col-action { display: none !important; }
            .paginator, [id*="Paginator"], [id*="paginator"], .pagination, [class*="pagination"], [class*="paginator"] { display: none !important; }
        }
    `;

    function buildHeader(lang, isAdmin, storeName, roleText, dt) {
        return `<div class="print-header">
            <div class="logo"><img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display='none'"> JF! by Gadai</div>
            <div class="print-header-info">
                🏪 ${isAdmin ? (lang==='id'?'Kantor Pusat':'总部') : (lang==='id'?'Toko：':'门店：')+Utils.escapeHtml(storeName)}
                &nbsp;|&nbsp; 👤 ${Utils.escapeHtml(roleText)} &nbsp;|&nbsp; 📅 ${dt}
            </div>
        </div>`;
    }

    function buildFooter(lang) {
        return `<div class="print-footer">JF! by Gadai — ${lang==='id'?'Sistem Manajemen Gadai':'典当管理系统'} &nbsp;|&nbsp; 1/1</div>`;
    }

    const PrintPage = {
        printCurrentPage() { this._doPrint(); },

        _doPrint() {
            const originalApp = document.getElementById("app");
            if (!originalApp) return;
            const printContent = originalApp.cloneNode(true);

            ['.dashboard-v2 .dash-sidebar','.dash-sidebar','.sidebar','#dashSidebar',
             '.dashboard-v2 .dash-topbar','.dash-topbar','.topbar','#dashTopbar',
             '.sidebar-overlay','#sidebarOverlay','.toolbar','.no-print',
             'button','.form-actions','.form-grid','.lang-toggle','.lang-btn-side',
             '#hamburgerBtn','[onclick*="toggleLanguage"]','[onclick*="invalidateDashboardCache"]',
             '[onclick*="forceRecovery"]','.modal-overlay','.modal-content','[id*="loadMore"]',
             '.sidebar-footer','.nav-badge','.header-actions','.page-header button'
            ].forEach(sel => printContent.querySelectorAll(sel).forEach(el => el.remove()));

            const ph = printContent.querySelector('.page-header');
            if (ph) { const ha = ph.querySelector('.header-actions'); if (ha) ha.remove(); }

            printContent.querySelectorAll('.card').forEach(card => {
                const t = card.textContent || '';
                if (['Tambah','新增','Edit','编辑'].some(kw => t.includes(kw)) &&
                    !t.includes('订单号') && !t.includes('ID Pesanan')) card.remove();
            });

            this._cleanForPrint(printContent);
            this._fixCustomerListForPrint(printContent);
            this._fixExpensesForPrint(printContent);
            this._hidePaginators(printContent);
            this._reformatOrderInfoForPrint(printContent);

            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            let storeName = '-', roleText = '-';
            try {
                storeName = AUTH.getCurrentStoreName();
                roleText = AUTH.isAdmin() ? (lang==='id'?'Administrator':'管理员') :
                           AUTH.isStoreManager() ? (lang==='id'?'Manajer Toko':'店长') : (lang==='id'?'Staf':'员工');
            } catch(e) {}
            const dt = new Date().toLocaleString();

            const pw = window.open('', '_blank');
            if (!pw) { Utils.toast.warning(lang==='id'?'Popup diblokir.':'弹出窗口被拦截，请允许后重试。',5000); return; }
            pw.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>JF! by Gadai - ${lang==='id'?'Cetak':'打印'}</title>
<style>${PRINT_CSS}</style></head><body>
<div class="print-container">
${buildHeader(lang,isAdmin,storeName,roleText,dt)}
${printContent.innerHTML}
${buildFooter(lang)}
</div>
<script>window.onload=function(){window.addEventListener('afterprint',function(){window.close();});window.print();};<\/script>
</body></html>`);
            pw.document.close();
        },

        _cleanForPrint(printContent) {
            printContent.querySelectorAll('.action-row,.action-buttons').forEach(el => el.remove());
            ['#loadMoreRow','#blacklistLoadMoreRow'].forEach(sel => { const el = printContent.querySelector(sel); if(el) el.remove(); });
            const ot = printContent.querySelector('.order-table');
            if (ot) { const tb = ot.querySelector('tbody'); if(tb) tb.querySelectorAll('tr').forEach(tr => { if(tr.querySelectorAll('button,.btn').length > 0) tr.remove(); }); }
            printContent.querySelectorAll('select.role-select').forEach(el => { const tr = el.closest('tr'); if(tr) tr.remove(); });
        },

        _hidePaginators(printContent) {
            ['[id*="Paginator"]','[id*="paginator"]','.paginator','.pagination','[class*="pagination"]','[class*="paginator"]'].forEach(sel => {
                try { printContent.querySelectorAll(sel).forEach(el => el.remove()); } catch(e) {}
            });
            // 文字分页信息
            printContent.querySelectorAll('div,p,span').forEach(el => {
                if (el.children.length === 0) {
                    const txt = el.textContent || '';
                    if (/第\s*\d/.test(txt) && /共\s*\d+\s*条/.test(txt)) {
                        let target = el;
                        const wrap = el.closest('[class*="paginator"],[class*="pagination"],p');
                        if (wrap) target = wrap;
                        target.style.display = 'none';
                    }
                }
            });
        },

        // 客户列表：隐藏「创建订单」列，「操作」列改为「地址」，注入 colgroup 控制列宽
        _fixCustomerListForPrint(printContent) {
            const tables = printContent.querySelectorAll('.customer-list-table');
            if (!tables.length) return;
            const lang = Utils.lang;
            tables.forEach(table => {
                // 注入 colgroup 精确控制列宽（地址列最宽）
                if (!table.querySelector('colgroup')) {
                    const cg = document.createElement('colgroup');
                    cg.innerHTML = '<col style="width:16mm"><col style="width:26mm"><col style="width:22mm"><col style="width:26mm"><col style="width:18mm"><col style="width:46mm">';
                    table.prepend(cg);
                }
                const thead = table.querySelector('thead tr');
                if (!thead) return;
                const ths = Array.from(thead.querySelectorAll('th'));
                const n = ths.length;
                if (n < 2) return;
                // 倒数第2=创建订单(隐藏)，倒数第1=操作(改为地址)
                ths[n-2].style.display = 'none';
                ths[n-1].textContent = lang==='id' ? 'Alamat' : '地址';
                table.querySelectorAll('tbody tr').forEach(tr => {
                    const tds = Array.from(tr.querySelectorAll('td'));
                    if (tds.length < n) return;
                    tds[n-2].style.display = 'none';
                    tds[n-1].innerHTML = Utils.escapeHtml(tds[n-1].getAttribute('data-address') || '-');
                    tds[n-1].style.textAlign = 'left';
                });
            });
        },

        // 支出页面：支出总额卡片改为一行，隐藏操作列
        _fixExpensesForPrint(printContent) {
            printContent.querySelectorAll('.card--stat, .card .card--stat').forEach(card => {
                const valEl = card.querySelector('.stat-value');
                const labelEl = card.querySelector('.stat-label');
                if (valEl && labelEl) {
                    const val = valEl.textContent.trim();
                    const label = labelEl.textContent.trim();
                    card.outerHTML = `<div class="stat-card-inline"><span class="stat-label">${Utils.escapeHtml(label)} :</span><span class="stat-value">${Utils.escapeHtml(val)}</span></div>`;
                }
            });
        },

        // 订单详情：重构为 4列3行网格 + 第4行小字说明
        _reformatOrderInfoForPrint(printContent) {
            const cards = printContent.querySelectorAll('.card');
            let orderInfoCard = null;
            for (const card of cards) {
                const text = card.textContent || '';
                if ((text.includes('订单号')||text.includes('ID Pesanan')) &&
                    (text.includes('客户姓名')||text.includes('Nama Nasabah')) &&
                    (text.includes('贷款金额')||text.includes('Jumlah Pinjaman'))) {
                    orderInfoCard = card; break;
                }
            }
            if (!orderInfoCard) return;

            const lines = [];
            const paras = orderInfoCard.querySelectorAll('p');
            if (paras.length > 0) {
                paras.forEach(p => { const t = p.innerText.trim(); if(t) lines.push(t); });
            } else {
                (orderInfoCard.innerText||'').split('\n').forEach(l => { const t = l.trim(); if(t) lines.push(t); });
            }

            const fieldMap = {
                '订单号':'order_id','ID Pesanan':'order_id',
                '客户姓名':'customer_name','Nama Nasabah':'customer_name',
                '质押物名称':'collateral_name','Nama Jaminan':'collateral_name',
                '贷款金额':'loan_amount','Jumlah Pinjaman':'loan_amount',
                '还款方式':'repayment_type','Jenis Cicilan':'repayment_type',
                '约定利率':'interest_rate','Suku Bunga':'interest_rate',
                '月利息':'monthly_interest','Bunga Bulanan':'monthly_interest',
                '剩余本金':'remaining_principal','Sisa Pokok':'remaining_principal',
                '已还本金':'principal_paid','Pokok Terbayar':'principal_paid',
                '已返还本金':'principal_paid',
                '建立订单日期':'order_date','Tanggal Mulai':'order_date',
                '合同到期日':'maturity_date','Tanggal Jatuh Tempo':'maturity_date',
                '每期还款额':'installment_amount','Angsuran Per Periode':'installment_amount',
                '已还期数 / 剩余期数':'paid_remaining_periods','Periode Terbayar / Sisa':'paid_remaining_periods',
                '电话':'phone','No. HP':'phone','电话号码':'phone',
                '地址':'address','Alamat':'address',
                '备注':'notes','Catatan':'notes','备注信息':'notes'
            };

            const fields = {};
            for (const line of lines) {
                for (const [label, key] of Object.entries(fieldMap)) {
                    if (line.startsWith(label)||line.includes(label+':')) {
                        const val = line.replace(label,'').replace(/^[:：\s]+/,'').trim();
                        if (val) fields[key] = val;
                        break;
                    }
                }
            }

            const lang = Utils.lang;
            const L = (zh, id) => lang==='id' ? id : zh;

            const row1 = [
                {label:L('订单号','ID Pesanan'),    value:fields.order_id||'-'},
                {label:L('客户姓名','Nama Nasabah'),value:fields.customer_name||'-'},
                {label:L('电话号码','No. HP'),       value:fields.phone||'-'},
                {label:L('地址','Alamat'),           value:fields.address||'-'},
            ];
            const row2 = [
                {label:L('建立订单日期','Tgl. Mulai'),    value:fields.order_date||'-'},
                {label:L('质押物名称','Nama Jaminan'),    value:fields.collateral_name||'-'},
                {label:L('当金','Jumlah Pinjaman'),       value:fields.loan_amount||'-'},
                {label:L('约定利率','Suku Bunga'),        value:fields.interest_rate||'-'},
            ];
            const row3 = [
                {label:L('还款方式','Jenis Cicilan'),     value:fields.repayment_type||'-'},
                {label:L('已返还本金','Pokok Terbayar'),  value:fields.principal_paid||'-'},
                {label:L('未返还本金','Sisa Pokok'),      value:fields.remaining_principal||'-'},
                {label:L('备注信息','Catatan'),           value:fields.notes||'-'},
            ];

            const renderRow = (items) => items.map(i=>`
                <div class="info-item">
                    <div class="label">${Utils.escapeHtml(i.label)}</div>
                    <div class="value">${Utils.escapeHtml(i.value)}</div>
                </div>`).join('');

            const disclaimer = lang==='id'
                ? '📌 Cicilan bulanan dihitung berdasarkan sisa pokok yang belum dikembalikan. Melunasi pokok lebih awal dapat mengurangi beban cicilan secara efektif.'
                : '📌 每月的还款额度基于未返还的本金计算，及时偿还本金，有效减轻债务负担！';

            const gridHtml = `<div class="order-info-grid">${renderRow(row1)}${renderRow(row2)}${renderRow(row3)}</div><div class="info-disclaimer">${disclaimer}</div>`;

            // 保留缴费记录
            const otherContent = [];
            Array.from(orderInfoCard.children).forEach(child => {
                const txt = child.innerText || child.textContent || '';
                if (child.tagName==='H3' && (txt.includes('缴费记录')||txt.includes('Riwayat')||txt.includes('还款记录'))) {
                    otherContent.push(child.outerHTML);
                    let next = child.nextElementSibling;
                    while(next) { otherContent.push(next.outerHTML); next = next.nextElementSibling; }
                    return;
                }
            });

            orderInfoCard.innerHTML = gridHtml + otherContent.join('');
        }
    };

    JF.PrintPage = PrintPage;
    if (window.APP) {
        window.APP.printCurrentPage = PrintPage.printCurrentPage.bind(PrintPage);
    } else {
        window.APP = { printCurrentPage: PrintPage.printCurrentPage.bind(PrintPage) };
    }
})();
