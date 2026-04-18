// app-payments.js - 完整修复版 v5.3
// 排版优化：所有摘要信息合并到一个紧凑的栏框
// 利息缴费和本金还款样式统一

window.APP = window.APP || {};

const PaymentsModule = {

    showPayment: async function(orderId) {
        this.currentPage = 'payment';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) return;

            var { payments } = await SUPABASE.getPaymentHistory(orderId);

            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var remainingPrincipal = order.loan_amount - order.principal_paid;
            var currentMonthlyInterest = remainingPrincipal * 0.10;
            var isAdmin = AUTH.isAdmin();

            // 分离各类支付记录
            var interestPayments = payments.filter(p => p.type === 'interest');
            var principalPayments = payments.filter(p => p.type === 'principal');
            
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai' : '现金', 
                bank: lang === 'id' ? 'Bank BNI' : '银行BNI'
            };

            // 利息缴费历史
            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="4" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'} </tr></tr>`;
            } else {
                for (var p of interestPayments) {
                    if (p.is_voided) continue;
                    interestRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-center">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td>${methodMap[p.payment_method] || '-'}</td>
                    </tr>`;
                }
            }

            // 本金还款历史
            var principalRows = '';
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="3" class="text-center text-muted">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'} </tr></tr>`;
            } else {
                for (var p of principalPayments) {
                    if (p.is_voided) continue;
                    principalRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td>${methodMap[p.payment_method] || '-'}</td>
                    </tr>`;
                }
            }

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            // 管理费和服务费状态
            var adminFeeStatus = order.admin_fee_paid ? 
                `<span class="status-badge status-success">✅ ${lang === 'id' ? 'Lunas' : '已缴'}</span>` : 
                `<span class="status-badge status-warning">⚠️ ${lang === 'id' ? 'Belum' : '未缴'}</span>`;
            
            var totalServiceFeePaid = order.service_fee_paid || 0;
            var expectedServiceFee = (order.service_fee_amount || 0);
            var serviceFeeStatus = expectedServiceFee > 0 ?
                (totalServiceFeePaid >= expectedServiceFee ? 
                    `<span class="status-badge status-success">✅ ${lang === 'id' ? 'Lunas' : '已缴'}</span>` : 
                    `<span class="status-badge status-warning">⚠️ ${lang === 'id' ? 'Belum lunas' : '未缴清'}</span>`) :
                `<span class="status-badge status-muted">-</span>`;

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran Bunga & Pokok' : '利息 & 本金缴费'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                        <button onclick="APP.viewOrder('${order.order_id}')" class="btn-detail">📄 ${lang === 'id' ? 'Detail Order' : '订单详情'}</button>
                    </div>
                </div>
                
                <!-- 订单摘要 - 紧凑合并版 -->
                <div class="card summary-card">
                    <div class="summary-sections">
                        <!-- 第一行：客户信息 -->
                        <div class="summary-row">
                            <div class="summary-field">
                                <span class="field-label">${t('customer_name')}</span>
                                <span class="field-value">${Utils.escapeHtml(order.customer_name)}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">ID</span>
                                <span class="field-value order-id">${Utils.escapeHtml(order.order_id)}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">${t('loan_amount')}</span>
                                <span class="field-value">${Utils.formatCurrency(order.loan_amount)}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</span>
                                <span class="field-value ${remainingPrincipal > 0 ? 'text-warning' : 'text-success'}">${Utils.formatCurrency(remainingPrincipal)}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</span>
                                <span class="field-value">${Utils.formatCurrency(currentMonthlyInterest)}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">${lang === 'id' ? 'Jatuh Tempo' : '下次到期'}</span>
                                <span class="field-value">${nextDueDate}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</span>
                                <span class="field-value">${order.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</span>
                            </div>
                        </div>
                        
                        <!-- 第二行：典当物品信息 -->
                        <div class="summary-divider"></div>
                        <div class="summary-row">
                            <div class="summary-field">
                                <span class="field-label">💎 ${lang === 'id' ? 'Nama Barang' : '物品名称'}</span>
                                <span class="field-value">${Utils.escapeHtml(order.collateral_name || '-')}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">${lang === 'id' ? 'Service Fee' : '服务费'}</span>
                                <span class="field-value">${order.service_fee_percent || 0}%</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</span>
                                <span class="field-value">${Utils.formatCurrency(order.admin_fee)}</span>
                            </div>
                            <div class="summary-field">
                                <span class="field-label">📋 ${lang === 'id' ? 'Status Admin Fee' : '管理费状态'}</span>
                                ${adminFeeStatus}
                            </div>
                            <div class="summary-field">
                                <span class="field-label">💰 ${lang === 'id' ? 'Status Service Fee' : '服务费状态'}</span>
                                ${serviceFeeStatus}
                            </div>
                        </div>
                    </div>
                    <div class="summary-note">
                        ℹ️ ${lang === 'id' ? 'Admin Fee dan Service Fee telah dibayar saat pembuatan order.' : '管理费和服务费已在创建订单时缴纳。'}
                    </div>
                </div>
                
                <!-- 利息缴费区域 -->
                <div class="card action-card interest-card">
                    <div class="card-header">
                        <h3>💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3>
                    </div>
                    <div class="card-body">
                        <div class="action-input-group">
                            <label class="action-label">${lang === 'id' ? 'Ambil untuk' : '收取'}:</label>
                            <select id="interestMonths" class="action-select">${interestOptions}</select>
                        </div>
                        <div class="payment-method-group">
                            <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="btn-action success">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息付款'}</button>
                    </div>
                    <div class="card-history">
                        <div class="history-title">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</div>
                        <div class="table-container">
                            <table class="history-table">
                                <thead><tr><th>${lang === 'id' ? 'Tanggal' : '日期'}</th><th>${lang === 'id' ? 'Bulan' : '月数'}</th><th>${lang === 'id' ? 'Jumlah' : '金额'}</th><th>${lang === 'id' ? 'Metode' : '方式'}</th></tr></thead>
                                <tbody>${interestRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- 本金还款区域（样式与利息缴费一致） -->
                <div class="card action-card principal-card">
                    <div class="card-header">
                        <h3>🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3>
                    </div>
                    <div class="card-body">
                        <div class="action-input-group">
                            <label class="action-label">${lang === 'id' ? 'Jumlah bayar' : '还款金额'}:</label>
                            <input type="text" id="principalAmount" class="action-input" placeholder="0">
                        </div>
                        <div class="payment-method-group">
                            <div class="payment-method-title">${lang === 'id' ? 'Metode Pemasukan' : '入账方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="principalTarget" value="bank" checked> 🏧 ${t('bank')}</label>
                                <label                                <label><input type><input type="radio" name="principal="radio" name="principalTarget" value="cash">Target" value="cash"> 🏦 ${ 🏦 ${t('t('cash')cash')}</label>
                           }</label>
                            </div </div>
                        </div>
                        </div>
                       >
                        <div <div class="remaining-info">
                            class="remaining-info">
                            ${lang ${lang === ' === 'id'id' ? ' ? 'SisaSisa pokok pokok' :' : '剩余 '剩余本金'}: <本金'}: <strong>strong>${Utils${Utils.formatCurrency.formatCurrency(remaining(remainingPrincipal)}</strongPrincipal)}</strong>
                       >
                        </div </div>
                       >
                        <button <button onclick=" onclick="APP.payPrincipalAPP.payPrincipalWithMethodWithMethod('${('${order.order_id}')" class="order.order_id}')" class="btn-action success">✅ ${lang ===btn-action success">✅ ${lang === 'id 'id' ? 'Bay' ? 'Bayar Pokok'ar Pokok' : ' : '支付本金支付本金'}</'}</buttonbutton>
                    </>
                    </div>
div>
                    <div class="card                    <div class="card-history">
                       -history">
                        <div class <div class="history-title">📋="history-title">📋 ${lang ${lang === ' === 'id' ? 'id'Riway ? 'at PembRiwayat Pembayaran Pokokayaran Pokok' :' : '本金还款历史 '本金还款历史'}</'}</div>
                       div>
                        <div class="table-container">
 <div class="table                           -container">
 <table class="history                            <table class="history-table">
-table">
                                                               <thead> <thead><tr><th<tr><th>${>${lang ===lang === 'id 'id' ?' ? 'Tanggal' : ' 'Tanggal'日期'}</th : '日期'><th}</th>${><th>${lang === 'idlang === 'id' ?' ? 'J 'Jumlah' : 'umlah'金额'}</th : '金额'><th}</th>${><th>${lang ===lang === 'id 'id'' ? ? 'Met 'Metode'ode' : ' : '方式'方式'}</th></tr>}</th</thead>
                               ></tr></thead <tbody>
                                <tbody>${>${principalRowsprincipalRows}</tbody>
                            }</tbody</table>
                        </>
                            </table>
div>
                        </                    </div>
div>
                    </                </div>
                </div>
div>
                
                               
                <style <style>
>
                                       .page .page-header {-header { display: display: flex; flex; justify-content: space justify-content-between;: space-between; align-items align-items: center: center; margin; margin-bottom:-bottom: 16 16px; flex-wrap:px; flex wrap;-wrap: gap: wrap; gap: 10px 10px; }
                   ; }
                    .page .page-header h2 {-header h2 { margin: margin: 0; 0; font-size: 1.25rem; font-size: 1.25rem; }
                    }
                    .header .header-actions { display-actions { display: flex; gap: : flex; gap8px: ; }
8px; }
                    .btn                   -back, .btn-back, .btn .btn-detail-detail { padding: 6px { padding: 6px 12px; border-radius:  12px; border-radius: 6px6px; font; font-size:-size:  0.80.8rem;rem; cursor cursor: pointer;: pointer; border: none; border: none; }
                    }
                    .btn .btn-back {-back { background: background: #647 #64748b48b; color: white; color: white; }
                    .; }
                    .btn-dbtn-detail {etail { background: background: #8b5cf6 #8b5; colorcf6; color: white; }
                    
                   : white; }
 /*                     
                   订单摘要 /* 订单摘要 - 紧凑样式 */
 - 紧凑样式 */
                    .summary                    .-card {summary-card { padding: 12px padding: 12px 16px; 16px; margin-bottom: 20px margin-bottom: 20px; }
; }
                    .                    .summary-sections {summary-sections { display display: flex; flex: flex; flex-direction:-direction: column; gap: 8 column; gap: 8px;px; }
                    .summary }
                    .summary-row {-row { display: flex; flex-wrap display: flex; flex-wrap: wrap; gap: 16px: wrap; gap: 16px; align-items; align-items: center; }
                    .summary-field { display: flex; align-items:: center; }
                    .summary-field { display: flex; align-items: baseline; gap: baseline; gap: 6 6px; font-size: px; font-size0.: 0.8rem8rem; }
; }
                    .                    .field-labelfield-label { color: # { color64748b;: #64748b; font-weight font-weight: 500; min-width: 500;: 70 min-widthpx; }
                    .: 70px; }
field-value { font                    .field-value { font-weight:-weight:  600; color600; color: #: #1e293b1e293b; }
                    .order-id; }
 { font                    .order-id { font-family:-family: monospace; background monospace; background: #: #f1f5f1f5f9; paddingf9; padding: 2px 6: 2px 6px; border-radiuspx; border-radius: : 4px; }
                    .4px; }
                    .text-wtext-warning { color: #farning { color: #f59e59e0b; }
                    .text-success { color0b; }
                    .text-success { color: #: #10b981; }
                   10b981; }
                    .summary-divider .summary-divider { height: 1px { height: 1px; background; background: #: #e2e2e8e8f0; marginf0: 4px; margin:  04px 0; }
; }
                    .                    .summary-nsummary-note {ote { font-size font-size: 0.7rem; color: 0.7rem: #; color94a3b: #94a8;3b8; margin-top: 8px margin-top: 8px; padding; padding-top:-top: 6 6px;px; border-top border-top: 1px: 1px dashed dashed #e #e2e8f2e8f0; text-align0;: center; }
                    
                    text-align: center; }
                    
                    /*  /* 状态标签状态标签 */
                    .status */
                    .status-badge { display: inline-badge { display: inline-block;-block; padding: 2px  padding: 28pxpx ; border-radius: 128px; border-radius: 12px; font-sizepx; font-size: : 0.0.7rem7rem; font-weight:; font-weight: 500 500; }
                    .status-success { background; }
                    .status-success { background: #: #d1fae5;d1fae5; color: color: #065 #065f46; }
                    .status-warning { background:f46; }
                    .status-warning { background: #fed7aa #fed7aa; color; color: #92400: #92400e; }
                    .statuse; }
                    .status-muted-muted { background { background: #: #f1f1f5f9f5f9; color:; color: # #64748b;64748b; }
                    
 }
                    
                    /*                    /* 缴费卡片 缴费卡片 - 统一样式 */
                    .action - 统一样式 */
                    .action-card { margin-bottom: 20px;-card { margin-bottom: 20px; border: border: 1 1px solidpx solid #e #e2e8f2e8f0; border-radius0; border-radius: : 12px;12px; overflow overflow: hidden; }
: hidden; }
                    .                    .action-card .cardaction-card .card-header { background:-header { background: #f8f #f8fafcafc; padding: ; padding: 12px12 16px;px 16px; border-bottom border-bottom: 1px solid #: 1pxe2 solid #e8f0e2e8f0; }
                    .action-card; }
                    .action-card .card .card-header h3 {-header h margin:3 { margin: 0; font 0-size: 1rem;; font-size: font-weight 1rem; font-weight: 600;: 600; }
                    .action }
                    .action-card .card-body { padding-card .card-body { padding: : 16px16px; }
                    .action-card .card-history {; }
                    .action-card .card-history { border-top: border-top: 1px solid 1px solid #e2e #e2e8f0; padding:8f0; 12 padding: 12px px 16px; background: #16px; background: #fafafafafafa; }
; }
                    
                    .action-input-group                    
                    .action-input-group { display { display: flex; align-items:: flex; align-items: center; gap center; gap: 12px; flex: 12-wrap: wrappx; flex-wrap; margin-bottom: 16: wrap; margin-bottom: 16px;px; }
                    .action }
                    .action-label {-label { font-weight: 600; font-size: font-weight: 600; 0. font-size: 85rem0.85rem; color: #; color: #475569; min-width: 80475569; min-width: 80px; }
                   px; }
                    .action .action-select { padding:-select { 8px 12px padding: 8px ; border12px; border-radius: 8-radius:px; 8px; border: border: 1px solid #c 1px solid #cbd5e1bd5; fonte1; font-size:-size: 0.85 0.85rem; background: whiterem; background; min: white; min-width: 200-width: 200px;px; }
                    }
                    .action-input { padding: .action-input { padding: 8 8px px 12px; border12px-radius:; border-radius: 8px; border: 8px; 1px solid border: 1px solid #c #cbd5bd5e1; fonte1-size: 0.85; font-size: 0rem;.85 width: 200rem; width: 200px; text-align: rightpx; text-align; }
                    
                   : right; }
                    
                    .payment .payment-method-method-group {-group { background: background: #f #f8fafc; border8fafc-radius:; border-radius: 8 8px;px; padding: 10px  padding: 10px 1212pxpx; margin: ; margin: 12px 012px; border 0; border: : 1px1px solid # solid #e2e8f0e2e8f0; }
                    .; }
                    .payment-method-titlepayment-method-title { font { font-size:-size: 0 0.7rem; font-weight: .7rem; font-weight: 500;500; color: color: #647 #64748b; margin48b; margin-bottom:-bottom: 6 6px; }
                    .paymentpx; }
                   -method .payment-options { display: flex-method-options { display: flex; gap: 20px; gap: 20px; flex; flex-wrap:-wrap: wrap; wrap; }
                    .payment-method }
                    .payment-method-options-options label label { display: { display: inline inline-flex; align-items: center; gap-flex; align-items: center; gap: 6px; font-size: 0.: 6px; font-size: 0.8rem; cursor: pointer; }
8rem; cursor: pointer                    
                    .remaining; }
                    
                    .remaining-info { font-info { font-size:-size: 0 0.8rem;.8rem; color: color: #647 #64748b48b; margin; margin: 12px 0; padding:: 12px 0; padding: 8px; 8 background:px; background: #f #fef3ef3c7c7; border-radius:; border-radius: 8px; text-align 8px; text-align: center: center; }
; }
                    .remaining-info                    . strong {remaining-info strong { color: # colord97706;: #d977 font-size06;: 1 font-size: 1rem; }
rem; }
                    
                    .btn-action {                    
                    .btn-action { width width: 100%;: 100%; padding: 10 padding:px; border-radius:  10px; border-radius: 8px; font8px; font-size:-size: 0.85 0.85rem; font-weight: 600;rem; font-weight: 600; cursor: cursor: pointer pointer; border: none;; border: margin-top:  none; margin-top: 8px; }
8px; }
                    .btn-action                    .btn-action.success {.success { background: #16 background: #16a34a34a;a; color: white; }
                    color: white; }
                    .btn-action.success:hover { .btn background: #158-action.success:hover {03d background: #15803d; }
                    
                    .history; }
                    
                    .history-title { font-size-title { font-size: 0.: 0.8rem8rem; font; font-weight: 600-weight: 600; color; color: #: #475569475569; margin-bottom:; margin-bottom:  10px; }
                   10px; }
                    .history-table { width: .history-table { width: 100 100%; border%; border-coll-collapseapse: collapse; font: collapse; font-size: 0.75-size: 0.75rem;rem; }
                    }
                    .history-table th .history-table th, ., .history-tablehistory-table td { td { border: 1 border: 1px solidpx solid #e #e2e2e8f0;8f0; padding: 6 padding: 6px 8pxpx 8px; text-align:; text-align: left; left; }
                    }
                    .history-table th .history-table { background: #f1 th { background: #ff51f5f9; font-weight:f9; font-weight: 600 600; color: #475569; }
                    .; color: #475569; }
                    .historyhistory-table .-table .text-righttext-right { text-align: { text right; }
                   -align: right; }
                    .history .history-table .-table .text-center { text-align:text-center { text-align: center; }
                    .text center; }
                    .text-muted-muted { color { color: #94a: #3b94a3b8;8; }
                    
                    /* 响应式 */
 }
                    
                    /* 响应                    @式 */
media (max-width                    @media (max-width: 768px: ) {
                        .summary-row768px) {
                        .summary-row { gap { gap: 8px; }
                        .: 8px; }
                        .summary-fieldsummary-field { flex { flex-wrap: wrap-wrap: wrap; min; min-width:-width: calc( calc(50%50% - 8px - 8px); }
); }
                        .                        .field-label { minfield-label-width: { min auto; }
                       -width: auto; }
                        .action-input .action-input-group { flex-direction: column-group { flex-direction: column; align; align-items:-items: stretch; }
                        .action stretch; }
                        .action-select,-select, .action .action-input { width: 100-input { width: 100%; }
                        .%; }
                        .payment-mpayment-method-options { justify-contentethod-options {: flex justify-content: flex-start; }
                    }
               -start; }
                    </style>`;

 }
                </style            var>`;

            var principalInput = document principalInput = document.getElementById("principalAmount.getElementById("principalAmount");
           ");
            if ( if (principalInputprincipalInput && Utils.bindAmountFormat && Utils.bind) UtAmountFormatils.bindAmountFormat) Utils.bind(principalAmountFormat(principalInput);
Input);
            
                   
        } catch (error } catch (error) {
            console.error("showPayment error:",) {
            console.error("showPayment error:", error);
 error);
            alert            alert(Utils.lang === 'id'(Utils.lang === 'id' ? ? 'G 'Gagalagal memuat memuat halaman pembay halamanaran' : ' pembayaran'加载缴费 : '页面失败');
           加载缴费页面失败');
            this.go this.goBack();
        }
Back();
        }
    },

    },

    //    // 利息 利息支付
    pay支付
InterestWithMethod:    payInterestWith async functionMethod: async function(orderId(orderId) {
        var) {
        var months = months = parseInt(document.getElementById(" parseInt(document.getElementById("interestMoninterestMonths").ths").value);
value);
        var        var method = method = document.querySelector('input[name=" document.querySelector('input[name="interestMethod"]:interestMethod"]:checked')?.value || 'cash';
        varchecked')?.value || 'cash';
        var methodName = method methodName = method === ' === 'cash' ? (cash' ? (Utils.langUtils.lang === 'id' ? ' === 'id' ? 'TunTunai' : 'ai' : '现金') : (Utils现金') : (Utils.lang === '.lang === 'id'id' ? 'Bank B ? 'Bank BNI'NI' : ' : '银行BNI');
银行BNI');
        var        var lang = Utils lang = Utils.lang;
.lang;
        if (confirm        if (confirm(lang(lang === ' === 'id' ? `id' ? `KonfKonfirmasi pemasirmasi pemasukan bungaukan bunga ${months} bulan ${months} bulan via ${ via ${methodName}?`methodName}? : `确认入账利息 ${months}` : `确认入账利息 ${months} 个月，入 个月，账方式入账方式：${methodName}？：${methodName}？`))`)) {
            {
            try {
 try {
                await                await Order. Order.recordrecordInterestPaymentInterestPayment(order(orderId, months, method);
Id, months,                alert method);
                alert(lang(lang === ' === 'id'id' ? '✅ B ? '✅ Bunga berunga berhasil dichasil dicatat' : 'atat' : '✅ ✅ 利息记录成功');
                window利息记录成功');
                window.location.reload();
.location.reload();
            }            } catch ( catch (error) {error) { 
 
                alert('Error: ' + error                alert('Error: ' + error.message); 
           .message); }
        
            }
        }
    },

    }
    },

    //  // 本金支付本金支付
    payPrincipal
    payPrincipalWithMethod: asyncWithMethod: async function(order function(orderId)Id) {
        var amount {
        var amountStr =Str = document.getElementById("principal document.getElementByIdAmount").("principalAmount").value;
        varvalue;
 amount =        var amount = Utils.parseNumberFromCom Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(mas(amountStramountStr) :) : parseInt(amountStr.replace(/ parseInt(amountStr.replace(/[,\[,\s]/g,s]/g, '')) || 0;
        var target = document.querySelector '')) || 0;
        var target = document.querySelector('input[name="principalTarget"]:checked('input[name="principalTarget"]:checked')?.value')?.value || 'bank';
 || 'bank';
        var targetName        var targetName = target = target === ' === 'cash'cash' ? ( ? (Utils.langUtils.lang === 'id' ? 'Brankas' : '保险柜') : === 'id' ? 'Brankas' : '保险柜') : (Utils (Utils.lang === 'id.lang === 'id' ?' ? 'Bank BNI 'Bank BNI' :' : '银行BNI');
        '银行BNI var lang = Ut');
        var lang = Utils.langils.lang;
       ;
        if (isNaN if (isNaN(amount(amount) ||) || amount <= 0 amount <=) { 0) { alert(lang === alert(lang === 'id 'id' ?' ? 'Mas 'Masukkan jumlahukkan jumlah yang valid yang valid' : '请输入有效金额' : ''); return请输入有效金额'); return; }
        if; }
        if (confirm (confirm(lang(lang === 'id' === ' ? `id' ? `KonfKonfirmasiirmasi pemasukan pokok ${ pemasukan pokok ${Utils.formatUtils.formatCurrency(Currency(amount)}amount)} ke ${ ke ${targetNametargetName}?}?` : `确认` : `确认入账入账本金 ${本金 ${Utils.formatUtils.formatCurrency(Currency(amount)}amount)} 到 ${target 到 ${targetName}Name}？`？`)) {
)) {
            try            try {
                {
                await await Order.recordPrincipalPayment Order.record(orderIdPrincipalPayment(orderId, amount, amount, target, target);
               );
                alert(l alert(lang === 'idang === 'id' ?' ? '✅ '✅ Pokok Pokok berhasil berhasil dicatat' : dicatat' : '✅ 本金记录成功');
                window.location.reload();
            } catch (error '✅ 本金记录成功');
                window.location.reload();
            } catch (error) {) { 
                
                alert(' alert('Error:Error: ' + ' + error.message); 
 error.message            }
); 
            }
        }
        }
       }
 }
};

for};

for (var key in (var key in PaymentsModule PaymentsModule) {
) {
    if    if (typeof (typeof PaymentsModule[key] PaymentsModule === '[key] === 'function')function') window. window.APP[keyAPP[key] =] = PaymentsModule PaymentsModule[key];
[key];
}
