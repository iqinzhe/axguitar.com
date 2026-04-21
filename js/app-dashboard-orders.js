// app-dashboard-orders.js - v1.0

window.APP = window.APP || {};

const DashboardOrders = {

    showOrderTable: async function() {
        this.currentPage = 'orderTable';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        try {
            var filters = { status: this.currentFilter, search: '' };
            var orders = await SUPABASE.getOrders(filters);
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var s of stores) storeMap[s.id] = s.name;

            var rows = '';
            if (orders.length === 0) {
                rows = `<tr><td colspan="10" class="text-center">${t('no_data')}<\/td><\/tr>`;
            } else {
                for (var o of orders) {
                    var sc = o.status === 'active' ? 'status-active' : (o.status === 'completed' ? 'status-completed' : 'status-liquidated');
                    var storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                    
                    var nextDueDate = o.next_interest_due_date || '-';
                    var formattedDueDate = nextDueDate !== '-' ? Utils.formatDate(nextDueDate) : '-';
                    
                    var remainingPrincipalForList = (o.loan_amount || 0) - (o.principal_paid || 0);
                    var currentMonthlyInterestForList = remainingPrincipalForList * (Utils.MONTHLY_INTEREST_RATE || 0.10);
                    
                    rows += `<tr>
                        <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                        <td class="order-customer">${Utils.escapeHtml(o.customer_name)}</td>
                        <td class="order-collateral">${Utils.escapeHtml(o.collateral_name)}</td>
                        <td class="text-right">${Utils.formatCurrency(o.loan_amount)}</td>
                        <td class="text-right">${Utils.formatCurrency(currentMonthlyInterestForList)}</td>
                        <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-center">${formattedDueDate}</td>
                        <td class="text-center"><span class="status-badge ${sc}">${statusMap[o.status] || o.status}</span></td>
                        ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeName)}</td>` : ''}
                        <td class="action-cell">
                            <button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small">👁️ 查看详情</button>
                            ${o.status === 'active' && !isAdmin ? `<button onclick="APP.payOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small success">💰 缴纳费用</button>` : ''}
                            ${PERMISSION.canDeleteOrder() ? `<button onclick="APP.deleteOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small danger">🗑️ 删除订单</button>` : ''}
                            <button onclick="APP.printOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small">🖨️ 打印凭证</button>
                        </td>
                    </tr>`;
                }
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📋 ${t('order_list')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ 打印</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ 返回</button>
                    </div>
                </div>
                
                <div class="toolbar">
                    <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                        <option value="all" ${this.currentFilter === 'all' ? 'selected' : ''}>全部订单</option>
                        <option value="active" ${this.currentFilter === 'active' ? 'selected' : ''}>进行中</option>
                        <option value="completed" ${this.currentFilter === 'completed' ? 'selected' : ''}>已结清</option>
                    </select>
                </div>
                
                <div class="card info-card">
                    <div class="info-card-content">
                        <div class="info-icon">📌</div>
                        <div class="info-text">
                            <strong>重要提示：</strong> 请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。
                        </div>
                    </div>
                </div>
                
                <div class="table-container">
                    <table class="data-table order-table">
                        <thead>
                            <tr>
                                <th>订单号</th>
                                <th>客户姓名</th>
                                <th>质押物</th>
                                <th class="text-right">贷款金额</th>
                                <th class="text-right">月利息</th>
                                <th class="text-center">已付利息</th>
                                <th class="text-center">下次到期</th>
                                <th class="text-center">状态</th>
                                ${isAdmin ? '<th class="text-center">门店</th>' : ''}
                                <th class="text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
            this._addOrderTableStyles();
            
        } catch (err) {
            console.error("showOrderTable error:", err);
            alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
        }
    },
    
    _addOrderTableStyles: function() {
        if (document.getElementById('order-table-styles')) return;
        
        var style = document.createElement('style');
        style.id = 'order-table-styles';
        style.textContent = `
            .order-table .order-id {
                font-family: monospace;
                font-weight: 600;
                color: var(--primary-dark);
            }
            .order-table .order-customer {
                font-weight: 500;
            }
            .order-table .order-collateral {
                max-width: 150px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .info-card {
                background: #e0f2fe;
                border-left: 4px solid #0284c7;
                margin-bottom: 16px;
            }
            .info-card-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            .info-icon {
                font-size: 20px;
            }
            .info-text {
                flex: 1;
                font-size: 13px;
                color: #0c4a6e;
                line-height: 1.4;
            }
            .info-text strong {
                color: #0369a1;
            }
            @media (max-width: 768px) {
                .order-table .order-collateral {
                    max-width: 100px;
                }
            }
        `;
        document.head.appendChild(style);
    },
    
    payOrder: function(orderId) {
        console.log('payOrder 被调用，订单ID:', orderId);
        if (!orderId) {
            console.error('订单ID为空');
            return;
        }
        window.APP.navigateTo('payment', { orderId: orderId });
    },

    filterOrders: function(status) { 
        this.currentFilter = status; 
        this.showOrderTable(); 
    },

    viewOrder: async function(orderId) {
        this.currentPage = 'viewOrder';
        this.currentOrderId = orderId;
        this.saveCurrentPageState();
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('Order not found'); this.goBack(); return; }
            var lang = Utils.lang;
            var t = (key) => Utils.t(key);
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var currentMonthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);
            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var payRows = '';
            if (payments && payments.length > 0) {
                for (var p of payments) {
                    var typeText = p.type === 'admin_fee' ? (lang === 'id' ? 'Admin Fee' : '管理费') : p.type === 'service_fee' ? (lang === 'id' ? 'Service Fee' : '服务费') : p.type === 'interest' ? (lang === 'id' ? 'Bunga' : '利息') : (lang === 'id' ? 'Pokok' : '本金');
                    payRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                        <td><span class="payment-method-badge ${p.payment_method === 'cash' ? 'method-cash' : 'method-bank'}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td>${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}<\/td><\/tr>`;
            }

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>📄 订单详情</h2>
                    <div class="header-actions">    
                        <button onclick="APP.printOrder('${Utils.escapeAttr(order.order_id)}')" class="btn-print print-btn">🖨️ 打印订单</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ 返回</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>📋 订单信息</h3>
                    <p><strong>订单号:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                    <p><strong>状态:</strong> <span class="status-badge status-${order.status}">${statusMap[order.status] || order.status}</span></p>
                    <p><strong>创建日期:</strong> ${Utils.formatDate(order.created_at)}</p>
                    
                    <h3>👤 客户信息</h3>
                    <p><strong>客户姓名:</strong> ${Utils.escapeHtml(order.customer_name)}</p>
                    <p><strong>KTP号码:</strong> ${Utils.escapeHtml(order.customer_ktp)}</p>
                    <p><strong>联系电话:</strong> ${Utils.escapeHtml(order.customer_phone)}</p>
                    <p><strong>地址:</strong> ${Utils.escapeHtml(order.customer_address)}</p>
                    
                    <h3>💎 典当信息</h3>
                    <p><strong>质押物名称:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                    <p><strong>贷款金额:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                    
                    <h3>💰 费用明细</h3>
                    <p><strong>管理费:</strong> ${Utils.formatCurrency(order.admin_fee)} ${order.admin_fee_paid ? '✅ 已缴' : '❌ 未缴'}</p>
                    <p><strong>服务费:</strong> ${Utils.formatCurrency(order.service_fee_amount || 0)} (${order.service_fee_percent || 0}%) ${(order.service_fee_paid || 0) >= (order.service_fee_amount || 0) && (order.service_fee_amount || 0) > 0 ? '✅ 已缴' : (order.service_fee_amount || 0) === 0 ? '—' : '❌ 未缴'}</p>
                    <p><strong>月利息（当前）:</strong> ${Utils.formatCurrency(currentMonthlyInterest)} <small style="color:#64748b">（基于剩余本金 ${Utils.formatCurrency(remainingPrincipal)} × 10%）</small></p>
                    <p><strong>已付利息:</strong> ${order.interest_paid_months} 个月 (${Utils.formatCurrency(order.interest_paid_total)})</p>
                    <p><strong>剩余本金:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                    <p><strong>下次利息到期日:</strong> ${nextDueDate}</p>
                    <p><strong>备注:</strong> ${Utils.escapeHtml(order.notes || '-')}</p>
                    
                    <div class="info-card" style="margin: 16px 0;">
                        <div class="info-card-content">
                            <div class="info-icon">💡</div>
                            <div class="info-text">
                                <strong>温馨提示：</strong> 请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。
                            </div>
                        </div>
                    </div>
                    
                    <h3>📋 缴费记录</h3>
                    <div class="table-container">
                        <table class="data-table payment-table">
                            <thead>
                                <tr><th>日期</th><th>类型</th><th class="text-center">月数</th><th class="text-right">金额</th><th class="text-center">支付方式</th><th>说明</th></tr>
                            </thead>
                            <tbody>${payRows}</tbody>
                        </table>
                    </div>
                    
                    <div class="toolbar" style="margin-top: 16px;">
                        <button onclick="APP.goBack()">↩️ 返回</button>
                        ${order.status === 'active' && !isAdmin ? `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeAttr(order.order_id)}'})" class="success">💰 缴纳费用</button>` : ''}
                        ${order.status === 'completed' ? `<button onclick="APP.printSettlementReceipt('${Utils.escapeAttr(order.order_id)}')" class="success">🧾 打印结清凭证</button>` : ''}
                        <button onclick="APP.sendWAReminder('${Utils.escapeAttr(order.order_id)}')" class="warning">📱 WA提醒</button>
                    </div>
                </div>`;
            
        } catch (error) {
            console.error("viewOrder error:", error);
            alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            this.goBack();
        }
    },

    deleteOrder: async function(orderId) {
        var lang = Utils.lang;
        
        if (!confirm(lang === 'id' ? '确定删除？' : '确定删除？')) return;
        
        try {
            const order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(lang === 'id' ? '订单不存在' : '订单不存在');
                return;
            }
            
            await Order.delete(orderId);
            
            if (window.Audit) {
                await window.Audit.log('order_delete', JSON.stringify({
                    order_id: order.order_id,
                    customer_name: order.customer_name,
                    loan_amount: order.loan_amount,
                    deleted_by: AUTH.user?.id,
                    deleted_at: new Date().toISOString()
                }));
            }
            
            alert(Utils.t('order_deleted'));
            await this.showOrderTable();
        } catch (error) {
            console.error("deleteOrder error:", error);
            alert(lang === 'id' ? '删除失败：' + error.message : '删除失败：' + error.message);
        }
    },

    printOrder: async function(orderId) {
        try {
            var { order, payments } = await SUPABASE.getPaymentHistory(orderId);
            if (!order) { alert('订单不存在'); return; }
            var lang = Utils.lang;
            var methodMap = { 
                cash: lang === 'id' ? '现金 (保险柜)' : '现金 (保险柜)', 
                bank: lang === 'id' ? '银行转账 BNI' : '银行转账 BNI' 
            };
            
            var paymentRows = '';
            for (var p of payments) {
                var typeText = '';
                if (p.type === 'admin_fee') typeText = '管理费';
                else if (p.type === 'service_fee') typeText = '服务费';
                else if (p.type === 'interest') typeText = '利息';
                else if (p.type === 'principal') typeText = '本金';
                else typeText = p.type || '-';
                
                var methodText = methodMap[p.payment_method] || (p.payment_method === 'cash' ? '现金' : '银行');
                
                paymentRows += `<tr>
                    <td>${Utils.formatDate(p.date)}</td>
                    <td>${typeText}</td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                    <td>${methodText}</td>
                <\/tr>`;
            }
            
            if (paymentRows === '') {
                paymentRows = `<tr><td colspan="4" class="text-center">暂无缴费记录<\/td><\/tr>`;
            }
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var safeStoreName = AUTH.getCurrentStoreName();
            
            var printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>JF! by Gadai - ${order.order_id}</title>
                    <style>
                        *{margin:0;padding:0;box-sizing:border-box}
                        body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;padding:15mm}
                        .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px}
                        .header h1{font-size:18px}
                        .section{border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:12px}
                        .section h3{font-size:13px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px}
                        .info-row{display:flex;margin-bottom:4px}
                        .info-label{width:100px;font-weight:600}
                        table{width:100%;border-collapse:collapse;margin-top:8px}
                        th,td{border:1px solid #ccc;padding:6px;text-align:left}
                        th{background:#f5f5f5}
                        .text-right{text-align:right}
                        .footer{text-align:center;margin-top:20px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;color:#666}
                        @media print{@page{size:A4;margin:15mm}}
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>JF! by Gadai</h1>
                        <p>典当交易凭证 | <strong>${order.order_id}</strong> | ${Utils.formatDate(order.created_at)}</p>
                    </div>
                    
                    <div class="section">
                        <h3>客户信息</h3>
                        <div class="info-row"><div class="info-label">客户姓名：</div><div>${order.customer_name}</div></div>
                        <div class="info-row"><div class="info-label">KTP：</div><div>${order.customer_ktp || '-'}</div></div>
                        <div class="info-row"><div class="info-label">电话：</div><div>${order.customer_phone || '-'}</div></div>
                        <div class="info-row"><div class="info-label">地址：</div><div>${order.customer_address || '-'}</div></div>
                    </div>
                    
                    <div class="section">
                        <h3>质押物与贷款</h3>
                        <div class="info-row"><div class="info-label">质押物：</div><div>${order.collateral_name}</div></div>
                        <div class="info-row"><div class="info-label">贷款金额：</div><div>${Utils.formatCurrency(order.loan_amount)}</div></div>
                        <div class="info-row"><div class="info-label">剩余本金：</div><div>${Utils.formatCurrency(remainingPrincipal)}</div></div>
                        <div class="info-row"><div class="info-label">备注：</div><div>${order.notes || '-'}</div></div>
                    </div>
                    
                    <div class="section">
                        <h3>缴费记录</h3>
                        <table>
                            <thead><tr><th>日期</th><th>类型</th><th class="text-right">金额</th><th>支付方式</th></tr></thead>
                            <tbody>${paymentRows}</tbody>
                        </table>
                    </div>
                    
                    <div class="footer">
                        <div>JF! by Gadai - 典当管理系统</div>
                        <div>门店：${safeStoreName}</div>
                        <div>本凭证为电子打印，无需签名</div>
                    </div>
                    
                    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000)};<\/script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error("printOrder error:", error);
            alert('打印订单失败');
        }
    },

    showPaymentHistory: async function() {
        this.currentPage = 'paymentHistory';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        try {
            var allPayments = await SUPABASE.getAllPayments();
            var totalAdminFee = 0, totalServiceFee = 0, totalInterest = 0, totalPrincipal = 0;
            for (var p of allPayments) {
                if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'service_fee') totalServiceFee += p.amount;
                else if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
            }
            var typeMap = { admin_fee: '管理费', service_fee: '服务费', interest: '利息', principal: '本金' };
            var methodMap = { cash: '现金', bank: '银行BNI' };

            var rows = allPayments.length === 0
                ? `<tr><td colspan="9" class="text-center">暂无数据<\/td><\/tr>`
                : allPayments.map(p => `<tr>
                    <td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                    <td>${Utils.escapeHtml(p.orders?.customer_name || '-')}</td>
                    <td class="date-cell">${Utils.formatDate(p.date)}</td>
                    <td>${typeMap[p.type] || p.type}</td>
                    <td class="text-center">${p.months ? p.months + (lang === 'id' ? ' 个月' : ' 个月') : '-'}</td>
                    <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                    <td class="text-center">${methodMap[p.payment_method] || '-'}</td>
                    <td>${Utils.escapeHtml(p.description || '-')}</td>
                    <td class="action-cell"><button onclick="APP.viewOrder('${p.orders?.order_id}')" class="btn-small">查看</button></td>
                <\/tr>`).join('');

            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>💰 缴费明细</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ 打印</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ 返回</button>                  
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee)}</div><div>管理费</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalServiceFee)}</div><div>服务费</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalInterest)}</div><div>利息</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div>本金</div></div>
                    <div class="stat-card"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal)}</div><div>全部总计</div></div>
                </div>
                
                <div class="table-container">
                    <table class="data-table payment-table">
                        <thead>
                            <tr>
                                <th>订单ID</th><th>客户姓名</th><th>日期</th><th>类型</th><th class="text-center">月数</th><th class="text-right">金额</th><th class="text-center">支付方式</th><th>说明</th><th class="text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
            
        } catch (error) {
            console.error("showPaymentHistory error:", error);
            alert('加载缴费记录失败');
        }
    }
};

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/`/g, '&#96;');
}

for (var key in DashboardOrders) {
    if (typeof DashboardOrders[key] === 'function') {
        window.APP[key] = DashboardOrders[key];
    }
}

if (!Utils.escapeAttr) {
    Utils.escapeAttr = escapeAttr;
}

