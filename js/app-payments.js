// app-payments.js - 缴费管理、资金去向模块

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

            var interestPayments = payments.filter(p => p.type === 'interest');
            var principalPayments = payments.filter(p => p.type === 'principal');
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            var interestRows = '';
            if (interestPayments.length === 0) {
                interestRows = `<tr><td colspan="5" style="text-align:center;color:#94a3b8;font-size:12px;padding:12px;">${lang === 'id' ? 'Belum ada pembayaran bunga' : '暂无利息记录'}</td></tr>`;
            } else {
                for (var p of interestPayments) {
                    interestRows += `<tr>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatDate(p.date)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${p.months || 1} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(p.amount)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;"><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td style="border:1px solid #cbd5e1;padding:8px;font-size:11px;">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            }

            var principalRows = '';
            if (principalPayments.length === 0) {
                principalRows = `<tr><td colspan="4" style="text-align:center;color:#94a3b8;font-size:12px;padding:12px;">${lang === 'id' ? 'Belum ada pembayaran pokok' : '暂无本金记录'}</td></tr>`;
            } else {
                for (var p of principalPayments) {
                    principalRows += `<tr>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatDate(p.date)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${Utils.formatCurrency(p.amount)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;"><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td style="border:1px solid #cbd5e1;padding:8px;font-size:11px;">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            }

            // 管理费选项 - 包含手工录入输入框
            var adminFeeOptions = `
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <select id="adminFeeAmount" style="width:auto;min-width:150px;">
                        <option value="30000">Rp 30.000</option>
                        <option value="40000">Rp 40.000</option>
                        <option value="50000">Rp 50.000</option>
                        <option value="custom">${lang === 'id' ? 'Input Manual' : '手工录入'}</option>
                    </select>
                    <input type="text" id="customAdminFee" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}" style="width:150px;display:none;text-align:right;">
                </div>
            `;

            var adminFeeSection = !order.admin_fee_paid
                ? `<div style="background:#f8fafc;padding:12px 15px;border-radius:8px;margin-bottom:12px;border-left:3px solid #f59e0b;">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                        <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ❌ ${lang === 'id' ? 'Belum dibayar' : '未支付'}</span>
                        <div class="payment-method-group" style="margin:0;padding:8px;background:#ffffff;">
                            <div class="payment-method-title" style="margin-bottom:5px;">${lang === 'id' ? 'Metode Pembayaran' : '支付方式'}:</div>
                            <div class="payment-method-options">
                                <label><input type="radio" name="adminFeeMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                                <label><input type="radio" name="adminFeeMethod" value="bank"> 🏧 ${t('bank')}</label>
                            </div>
                        </div>
                        ${adminFeeOptions}
                        <button onclick="APP.payAdminFeeWithMethod('${order.order_id}')" class="success" style="margin:0;">✅ ${lang === 'id' ? 'Catat Pembayaran' : '记录收款'}</button>
                    </div>
                   </div>`
                : `<div style="background:#f8fafc;padding:10px 15px;border-radius:8px;margin-bottom:12px;border-left:3px solid #10b981;">
                    <span>📋 <strong>${lang === 'id' ? 'Admin Fee' : '管理费'}</strong>: ${Utils.formatCurrency(order.admin_fee)} ✅ ${lang === 'id' ? 'Sudah dibayar' : '已支付'} (${Utils.formatDate(order.admin_fee_paid_date)})</span>
                   </div>`;

            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            var interestOptions = [1, 2, 3].map(i =>
                `<option value="${i}">${i} ${lang === 'id' ? 'bulan' : '个月'} = ${Utils.formatCurrency(currentMonthlyInterest * i)}</option>`
            ).join('');

            var principalInputSection = remainingPrincipal > 0
                ? `<div style="margin-bottom:15px;">
                    <div class="payment-method-group" style="margin-bottom:10px;">
                        <div class="payment-method-title">${lang === 'id' ? 'Metode Pembayaran Pokok' : '本金支付方式'}:</div>
                        <div class="payment-method-options">
                            <label><input type="radio" name="principalMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                            <label><input type="radio" name="principalMethod" value="bank"> 🏧 ${t('bank')}</label>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <label style="color:#475569;white-space:nowrap;">${lang === 'id' ? 'Jumlah bayar pokok' : '本次还款金额'} (IDR):</label>
                        <input type="text" id="principalAmount" placeholder="${lang === 'id' ? 'Masukkan jumlah' : '输入金额'}" style="width:180px;text-align:right;margin:0;">
                        <button onclick="APP.payPrincipalWithMethod('${order.order_id}')" class="success" style="margin:0;">✅ ${lang === 'id' ? 'Bayar Pokok' : '支付本金'}</button>
                    </div>
                    <p style="font-size:12px;color:#64748b;margin-top:8px;">${lang === 'id' ? 'Sisa pokok' : '剩余本金'}: <strong style="color:#1e293b;">${Utils.formatCurrency(remainingPrincipal)}</strong></p>
                   </div>`
                : `<p style="color:#10b981;">✅ ${lang === 'id' ? 'Pokok sudah LUNAS' : '本金已全部结清'}</p>`;

            document.getElementById("app").innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h2>💰 ${lang === 'id' ? 'Pembayaran' : '缴费'}</h2>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>
                <div class="card" style="padding:14px 18px;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
                        <div><div style="font-size:11px;color:#64748b;">${t('customer_name')}</div><div style="font-weight:600;">${Utils.escapeHtml(order.customer_name)}</div></div>
                        <div><div style="font-size:11px;color:#64748b;">ID</div><div style="font-weight:600;">${Utils.escapeHtml(order.order_id)}</div></div>
                        <div><div style="font-size:11px;color:#64748b;">${t('loan_amount')}</div><div style="font-weight:600;">${Utils.formatCurrency(order.loan_amount)}</div></div>
                        <div><div style="font-size:11px;color:#64748b;">${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}</div><div style="font-weight:600;color:${remainingPrincipal > 0 ? '#f59e0b' : '#10b981'};">${Utils.formatCurrency(remainingPrincipal)}</div></div>
                        <div><div style="font-size:11px;color:#64748b;">${lang === 'id' ? 'Bunga/Bulan' : '月利息'}</div><div style="font-weight:600;color:#3b82f6;">${Utils.formatCurrency(currentMonthlyInterest)}</div></div>
                        <div><div style="font-size:11px;color:#64748b;">${lang === 'id' ? 'Jatuh Tempo Bunga' : '下次利息到期'}</div><div style="font-weight:600;">${nextDueDate}</div></div>
                        <div><div style="font-size:11px;color:#64748b;">${lang === 'id' ? 'Bunga Dibayar' : '已付利息期数'}</div><div style="font-weight:600;">${order.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</div></div>
                    </div>
                </div>
                ${adminFeeSection}
                <div class="card">
                    <h3 style="margin-bottom:12px;">💰 ${lang === 'id' ? 'Pembayaran Bunga' : '利息缴费'}</h3>
                    <p style="font-size:12px;color:#64748b;margin-bottom:10px;">${lang === 'id' ? '📌 Setiap pembayaran memperpanjang pinjaman 1 bulan secara otomatis' : '📌 每次付息后自动延续1个月，到期日同步更新'}</p>
                    <div class="payment-method-group">
                        <div class="payment-method-title">${lang === 'id' ? 'Metode Pembayaran Bunga' : '利息支付方式'}:</div>
                        <div class="payment-method-options">
                            <label><input type="radio" name="interestMethod" value="cash" checked> 🏦 ${t('cash')}</label>
                            <label><input type="radio" name="interestMethod" value="bank"> 🏧 ${t('bank')}</label>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
                        <label style="color:#475569;white-space:nowrap;">${lang === 'id' ? 'Bayar untuk' : '支付'}:</label>
                        <select id="interestMonths" style="width:auto;min-width:200px;margin:0;">${interestOptions}</select>
                        <button onclick="APP.payInterestWithMethod('${order.order_id}')" class="success" style="margin:0;">✅ ${lang === 'id' ? 'Catat Pembayaran Bunga' : '记录利息付款'}</button>
                    </div>
                    <h4 style="font-size:13px;margin-bottom:6px;color:#64748b;">📋 ${lang === 'id' ? 'Riwayat Pembayaran Bunga' : '利息缴费历史'}</h4>
                    <div class="table-container" style="margin-top:0;">
                        <table style="min-width:500px;width:100%;border-collapse:collapse;">
                            <thead><tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Bulan' : '月数'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr></thead>
                            <tbody>${interestRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom:12px;">🏦 ${lang === 'id' ? 'Pembayaran Pokok' : '本金还款'}</h3>
                    <p style="font-size:12px;color:#64748b;margin-bottom:10px;">${lang === 'id' ? `📌 Total pinjaman: ${Utils.formatCurrency(order.loan_amount)} | Sudah dibayar: ${Utils.formatCurrency(order.principal_paid)} | Sisa: ${Utils.formatCurrency(remainingPrincipal)}` : `📌 贷款总额: ${Utils.formatCurrency(order.loan_amount)} | 已还: ${Utils.formatCurrency(order.principal_paid)} | 剩余: ${Utils.formatCurrency(remainingPrincipal)}`}</p>
                    ${principalInputSection}
                    <h4 style="font-size:13px;margin-top:14px;margin-bottom:6px;color:#64748b;">📋 ${lang === 'id' ? 'Riwayat Pembayaran Pokok' : '本金还款历史'}</h4>
                    <div class="table-container" style="margin-top:0;">
                        <table style="min-width:400px;width:100%;border-collapse:collapse;">
                            <thead><tr style="background:#f8fafc;">
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                <th style="border:1px solid #cbd5e1;padding:8px;">${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr></thead>
                            <tbody>${principalRows}</tbody>
                        </table>
                    </div>
                </div>
                <div class="toolbar">
                    <button onclick="APP.viewOrder('${order.order_id}')">📄 ${lang === 'id' ? 'Lihat Detail Order' : '查看订单详情'}</button>
                    <button onclick="APP.goBack()">↩️ ${t('back')}</button>
                </div>`;

            // 初始化管理费手工录入输入框
            var adminFeeSelect = document.getElementById('adminFeeAmount');
            var customAdminFee = document.getElementById('customAdminFee');
            
            if (adminFeeSelect) {
                adminFeeSelect.addEventListener('change', function() {
                    if (customAdminFee) {
                        customAdminFee.style.display = this.value === 'custom' ? 'inline-block' : 'none';
                    }
                });
            }
            
            if (customAdminFee && Utils.bindAmountFormat) {
                Utils.bindAmountFormat(customAdminFee);
            }
            
            var principalInput = document.getElementById("principalAmount");
            if (principalInput && Utils.bindAmountFormat) Utils.bindAmountFormat(principalInput);
            
        } catch (error) {
            console.error("showPayment error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat halaman pembayaran' : '加载缴费页面失败');
            this.goBack();
        }
    },

    payAdminFeeWithMethod: async function(orderId) {
        var method = document.querySelector('input[name="adminFeeMethod"]:checked')?.value || 'cash';
        var adminFeeSelect = document.getElementById('adminFeeAmount');
        var customAdminFeeInput = document.getElementById('customAdminFee');
        var adminFeeAmount = 30000;
        
        if (adminFeeSelect) {
            if (adminFeeSelect.value === 'custom') {
                adminFeeAmount = Utils.parseNumberFromCommas(customAdminFeeInput?.value || '0');
                if (isNaN(adminFeeAmount) || adminFeeAmount <= 0) {
                    alert(Utils.lang === 'id' ? 'Masukkan jumlah admin fee yang valid' : '请输入有效的管理费金额');
                    return;
                }
            } else {
                adminFeeAmount = parseInt(adminFeeSelect.value);
            }
        }
        
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        if (confirm(Utils.lang === 'id' ? `Konfirmasi penerimaan Admin Fee ${Utils.formatCurrency(adminFeeAmount)} via ${methodName}?` : `确认已收取管理费 ${Utils.formatCurrency(adminFeeAmount)}，支付方式：${methodName}？`)) {
            try { 
                await Order.recordAdminFee(orderId, method, adminFeeAmount); 
                await this.showPayment(orderId); 
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    payInterestWithMethod: async function(orderId) {
        var months = parseInt(document.getElementById("interestMonths").value);
        var method = document.querySelector('input[name="interestMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        if (confirm((lang === 'id' ? `Konfirmasi pembayaran bunga ${months} bulan via ${methodName}?` : `确认支付利息 ${months} 个月，支付方式：${methodName}？`))) {
            try {
                await Order.recordInterestPayment(orderId, months, method);
                await this.showPayment(orderId);
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    },

    payPrincipalWithMethod: async function(orderId) {
        var amountStr = document.getElementById("principalAmount").value;
        var amount = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(amountStr) : parseInt(amountStr.replace(/[,\s]/g, '')) || 0;
        var method = document.querySelector('input[name="principalMethod"]:checked')?.value || 'cash';
        var methodName = method === 'cash' ? (Utils.lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)') : (Utils.lang === 'id' ? 'Bank BNI' : '银行BNI');
        var lang = Utils.lang;
        if (isNaN(amount) || amount <= 0) { alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额'); return; }
        if (confirm((lang === 'id' ? `Konfirmasi pembayaran pokok ${Utils.formatCurrency(amount)} via ${methodName}?` : `确认支付本金 ${Utils.formatCurrency(amount)}，支付方式：${methodName}？`))) {
            try {
                await Order.recordPrincipalPayment(orderId, amount, method);
                await this.showPayment(orderId);
            } catch (error) { 
                alert('Error: ' + error.message); 
            }
        }
    }
};

// 合并到 window.APP
for (var key in PaymentsModule) {
    if (typeof PaymentsModule[key] === 'function') {
        window.APP[key] = PaymentsModule[key];
    }
}
