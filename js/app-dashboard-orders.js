// app-dashboard-orders.js - v1.0 
window.APP = window.APP || {};

const DashboardOrders = {
    showOrderTable: async function() {
        APP.currentPage = 'orderTable';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var profile = await SUPABASE.getCurrentProfile();
        var isAdmin = profile?.role === 'admin';
        
        // 分页状态
        var PAGE_SIZE = 50;
        var currentFrom = 0;
        var totalCount = 0;
        var allOrders = [];
        
        try {
            var filters = { status: APP.currentFilter, search: '' };
            
            // 首次加载
            var result = await SUPABASE.getOrders(filters, currentFrom, currentFrom + PAGE_SIZE - 1);
            allOrders = result.data;
            totalCount = result.totalCount;
            currentFrom += PAGE_SIZE;
            
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            
            var stores = await SUPABASE.getAllStores();
            var storeMap = {};
            for (var i = 0; i < stores.length; i++) {
                storeMap[stores[i].id] = stores[i].name;
            }
            
            var baseCols = 9;
            var totalCols = isAdmin ? baseCols + 1 : baseCols;
            
            // 渲染表格的辅助函数
            var renderOrdersIntoTable = function(orders, append) {
                var tbody = document.getElementById('orderTableBody');
                if (!tbody) return;
                
                var rows = '';
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated');
                    var storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                    
                    var nextDueDate = o.next_interest_due_date || '-';
                    var formattedDueDate = nextDueDate !== '-' ? Utils.formatDate(nextDueDate) : '-';
                    
                    var remainingPrincipalForList = (o.loan_amount || 0) - (o.principal_paid || 0);
                    var currentMonthlyInterestForList = remainingPrincipalForList * (o.agreed_interest_rate || 0.08);
                    
                    var repaymentTypeText = o.repayment_type === 'fixed' 
                        ? (lang === 'id' ? 'Tetap' : '固定')
                        : (lang === 'id' ? 'Fleksibel' : '灵活');
                    var repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';
                    
                    rows += '<tr>' +
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td>' + Utils.escapeHtml(o.customer_name) + '</td>' +
                        '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(currentMonthlyInterestForList) + '</td>' +
                        '<td class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? 'bln' : '个月') + '</td>' +
                        '<td class="date-cell text-center">' + formattedDueDate + '</td>' +
                        '<td class="text-center"><span class="repayment-badge ' + repaymentClass + '">' + repaymentTypeText + '</span></td>' +
                        '<td class="text-center"><span class="status-badge ' + sc + '">' + (statusMap[o.status] || o.status) + '</span></td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeName) + '</td>' : '') +
                    '</tr>';
                    
                    // 操作行
                    var actionButtons = '';
                    if (o.status === 'active' && !isAdmin) {
                        actionButtons += '<button onclick="APP.payOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small success">💸 ' + (lang === 'id' ? '续费' : '缴费') + '</button>';
                    }
                    actionButtons += '<button onclick="APP.viewOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">👁️ ' + t('view') + '</button>';
                    actionButtons += '<button onclick="APP.printOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small">🖨️ ' + t('print') + '</button>';
                    if (PERMISSION.canDeleteOrder()) {
                        actionButtons += '<button onclick="APP.deleteOrder(\'' + Utils.escapeAttr(o.order_id) + '\')" class="btn-small danger">🗑️ ' + t('delete') + '</button>';
                    }
                    
                    rows += '<tr class="action-row">' +
                        '<td class="action-label">' + t('action') + '</td>' +
                        '<td colspan="' + (totalCols - 1) + '">' +
                            '<div class="action-buttons">' + actionButtons + '</div>' +
                        '</td>' +
                    '</tr>';
                }
                
                if (append) {
                    var loadMoreRow = document.getElementById('loadMoreRow');
                    if (loadMoreRow) loadMoreRow.remove();
                    tbody.insertAdjacentHTML('beforeend', rows);
                } else {
                    tbody.innerHTML = rows;
                }
                
                updateLoadMoreArea();
            };
            
            var updateLoadMoreArea = function() {
                var tbody = document.getElementById('orderTableBody');
                if (!tbody) return;
                
                var existingRow = document.getElementById('loadMoreRow');
                if (existingRow) existingRow.remove();
                
                if (currentFrom < totalCount) {
                    var remaining = totalCount - currentFrom;
                    var loadMoreHtml = '<tr id="loadMoreRow"><td colspan="' + totalCols + '" style="text-align:center;padding:14px;">' +
                        '<button onclick="APP.loadMoreOrders()" class="btn-small primary" style="padding:10px 32px;font-size:14px;">' +
                        '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多') + 
                        ' (' + remaining + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')' +
                        '</button></td></tr>';
                    tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                } else if (totalCount > PAGE_SIZE) {
                    var doneHtml = '<tr id="loadMoreRow"><td colspan="' + totalCols + '" style="text-align:center;padding:14px;color:var(--text-muted);">' +
                        '✅ ' + (lang === 'id' ? 'Semua ' + totalCount + ' pesanan telah dimuat' : '已加载全部 ' + totalCount + ' 条订单') +
                        '</td></tr>';
                    tbody.insertAdjacentHTML('beforeend', doneHtml);
                }
            };
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📋 ' + t('order_list') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + t('print') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="toolbar no-print">' +
                    '<select id="statusFilter" onchange="APP.filterOrders(this.value)">' +
                        '<option value="all" ' + (APP.currentFilter === 'all' ? 'selected' : '') + '>' + (lang === 'id' ? 'Semua Pesanan' : '全部订单') + '</option>' +
                        '<option value="active" ' + (APP.currentFilter === 'active' ? 'selected' : '') + '>' + t('active') + '</option>' +
                        '<option value="completed" ' + (APP.currentFilter === 'completed' ? 'selected' : '') + '>' + t('completed') + '</option>' +
                    '</select>' +
                '</div>' +
                
                '<div class="info-bar info">' +
                    '<span class="info-bar-icon">📌</span>' +
                    '<div class="info-bar-content">' +
                        '<strong>' + (lang === 'id' ? 'Total' : '共') + ' ' + totalCount + ' ' + (lang === 'id' ? 'pesanan' : '条订单') + '</strong> — ' + 
                        (lang === 'id' ? 'Menampilkan ' + Math.min(PAGE_SIZE, totalCount) + ' pertama' : '显示前 ' + Math.min(PAGE_SIZE, totalCount) + ' 条') +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<div class="table-container">' +
                        '<table class="data-table order-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + t('order_id') + '</th>' +
                                    '<th class="col-name">' + t('customer_name') + '</th>' +
                                    '<th>' + t('collateral_name') + '</th>' +
                                    '<th class="col-amount amount">' + t('loan_amount') + '</th>' +
                                    '<th class="col-amount amount">' + (lang === 'id' ? 'Bunga Bulanan' : '月利息') + '</th>' +
                                    '<th class="col-months text-center">' + (lang === 'id' ? 'Bunga Dibayar' : '已付利息') + '</th>' +
                                    '<th class="col-date text-center">' + t('payment_due_date') + '</th>' +
                                    '<th class="col-status text-center">' + t('repayment_type') + '</th>' +
                                    '<th class="col-status text-center">' + t('status') + '</th>' +
                                    (isAdmin ? '<th class="col-store text-center">' + t('store') + '</th>' : '') +
                                '</tr>' +
                            '</thead>' +
                            '<tbody id="orderTableBody"></tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
            
            renderOrdersIntoTable(allOrders, false);
            
            window._orderTableState = {
                currentFrom: currentFrom,
                totalCount: totalCount,
                allOrders: allOrders,
                totalCols: totalCols,
                pageSize: PAGE_SIZE,
                filters: filters,
                storeMap: storeMap,
                renderOrdersIntoTable: renderOrdersIntoTable
            };
            
        } catch (err) {
            console.error("showOrderTable error:", err);
            Utils.ErrorHandler.capture(err, 'showOrderTable');
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
            } else {
                alert(lang === 'id' ? 'Gagal memuat daftar pesanan' : '加载订单列表失败');
            }
        }
    },
    
    // ==================== 加载更多订单 ====================
    loadMoreOrders: async function() {
        var state = window._orderTableState;
        if (!state) return;
        
        var lang = Utils.lang;
        var loadMoreBtn = document.querySelector('#loadMoreRow button');
        if (loadMoreBtn) {
            loadMoreBtn.disabled = true;
            loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...');
        }
        
        try {
            var result = await SUPABASE.getOrders(state.filters, state.currentFrom, state.currentFrom + state.pageSize - 1);
            var newOrders = result.data;
            
            state.allOrders = state.allOrders.concat(newOrders);
            state.currentFrom += result.data.length;
            state.totalCount = result.totalCount;
            
            state.renderOrdersIntoTable(newOrders, true);
            
        } catch (err) {
            console.error("loadMoreOrders error:", err);
            Utils.ErrorHandler.capture(err, 'loadMoreOrders');
            
            if (loadMoreBtn) {
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多');
            }
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat lebih banyak' : '加载更多失败');
            } else {
                alert(lang === 'id' ? 'Gagal memuat lebih banyak' : '加载更多失败');
            }
        }
    },
    
    payOrder: function(orderId) {
        console.log('payOrder 被调用，订单ID:', orderId);
        if (!orderId) {
            console.error('订单ID为空');
            return;
        }
        APP.navigateTo('payment', { orderId: orderId });
    },

    filterOrders: function(status) { 
        APP.currentFilter = status; 
        APP.showOrderTable(); 
    },

    viewOrder: async function(orderId) {
        APP.currentPage = 'viewOrder';
        APP.currentOrderId = orderId;
        APP.saveCurrentPageState();
        try {
            var result = await SUPABASE.getPaymentHistory(orderId);
            var order = result.order;
            var payments = result.payments;
            if (!order) { 
                if (window.Toast) {
                    window.Toast.error(Utils.t('order_not_found'));
                } else {
                    alert(Utils.t('order_not_found'));
                }
                APP.goBack(); 
                return; 
            }
            var lang = Utils.lang;
            var t = function(key) { return Utils.t(key); };
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var monthlyRate = order.agreed_interest_rate || 0.08;
            var currentMonthlyInterest = remainingPrincipal * monthlyRate;
            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            
            var repaymentInfoHtml = '';
            if (order.repayment_type === 'fixed') {
                var paidMonths = order.fixed_paid_months || 0;
                var totalMonths = order.repayment_term;
                var fixedPayment = order.monthly_fixed_payment || 0;
                repaymentInfoHtml = '' +
                    '<p><strong>' + t('repayment_type') + ':</strong> 📅 ' + t('fixed_repayment') + ' (' + totalMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')</p>' +
                    '<p><strong>' + t('monthly_payment') + ':</strong> ' + Utils.formatCurrency(fixedPayment) + '</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Progress' : '进度') + ':</strong> ' + paidMonths + '/' + totalMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</p>';
            } else {
                repaymentInfoHtml = '<p><strong>' + t('repayment_type') + ':</strong> 💰 ' + t('flexible_repayment') + ' (' + (lang === 'id' ? 'Maksimal perpanjangan 10 bulan' : '最长延期10个月') + ')</p>';
            }

            var payRows = '';
            if (payments && payments.length > 0) {
                for (var i = 0; i < payments.length; i++) {
                    var p = payments[i];
                    var typeText = p.type === 'admin_fee' ? t('admin_fee') : p.type === 'service_fee' ? t('service_fee') : p.type === 'interest' ? t('interest') : t('principal');
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    payRows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td>' + typeText + '</td>' +
                        '<td class="text-center">' + (p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-') + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="text-center"><span class="payment-method-badge ' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                        '<td class="desc-cell">' + Utils.escapeHtml(p.description || '-') + '</td>' +
                    '</tr>';
                }
            } else {
                payRows = '<tr><td colspan="6" class="text-center">' + t('no_data') + '</td></tr>';
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📄 ' + t('order_details') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printOrder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="btn-print">🖨️ ' + t('print') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<div class="order-detail-grid">' +
                        '<div class="info-column">' +
                            '<h3>📋 ' + (lang === 'id' ? 'Informasi Pesanan' : '订单信息') + '</h3>' +
                            '<p><strong>' + t('order_id') + ':</strong> ' + Utils.escapeHtml(order.order_id) + '</p>' +
                            '<p><strong>' + t('status') + ':</strong> <span class="status-badge ' + order.status + '">' + (statusMap[order.status] || order.status) + '</span></p>' +
                            '<p><strong>' + (lang === 'id' ? 'Tanggal Dibuat' : '创建日期') + ':</strong> ' + Utils.formatDate(order.created_at) + '</p>' +
                            repaymentInfoHtml +
                            '<h3 style="margin-top:16px;">👤 ' + t('customer_info') + '</h3>' +
                            '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(order.customer_name) + '</p>' +
                            '<p><strong>' + t('ktp_number') + ':</strong> ' + Utils.escapeHtml(order.customer_ktp) + '</p>' +
                            '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(order.customer_phone) + '</p>' +
                            '<p><strong>' + t('address') + ':</strong> ' + Utils.escapeHtml(order.customer_address) + '</p>' +
                        '</div>' +
                        '<div class="info-column">' +
                            '<h3>💎 ' + t('collateral_info') + '</h3>' +
                            '<p><strong>' + t('collateral_name') + ':</strong> ' + Utils.escapeHtml(order.collateral_name) + '</p>' +
                            '<p><strong>' + t('loan_amount') + ':</strong> ' + Utils.formatCurrency(order.loan_amount) + '</p>' +
                            '<h3 style="margin-top:16px;">💰 ' + (lang === 'id' ? 'Rincian Biaya' : '费用明细') + '</h3>' +
                            '<p><strong>' + t('admin_fee') + ':</strong> ' + Utils.formatCurrency(order.admin_fee) + ' ' + (order.admin_fee_paid ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : '❌ ' + (lang === 'id' ? 'Belum' : '未缴')) + '</p>' +
                            '<p><strong>' + t('service_fee') + ':</strong> ' + Utils.formatCurrency(order.service_fee_amount || 0) + ' (' + (order.service_fee_percent || 0) + '%) ' + ((order.service_fee_paid || 0) >= (order.service_fee_amount || 0) && (order.service_fee_amount || 0) > 0 ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : (order.service_fee_amount || 0) === 0 ? '—' : '❌ ' + (lang === 'id' ? 'Belum' : '未缴')) + '</p>' +
                            '<p><strong>' + (lang === 'id' ? 'Bunga Bulanan (saat ini)' : '月利息（当前）') + ':</strong> ' + Utils.formatCurrency(currentMonthlyInterest) + ' <small>（' + (lang === 'id' ? 'berdasarkan sisa pokok' : '基于剩余本金') + ' ' + Utils.formatCurrency(remainingPrincipal) + ' × ' + (monthlyRate*100).toFixed(0) + '%）</small></p>' +
                            '<p><strong>' + (lang === 'id' ? 'Bunga Dibayar' : '已付利息') + ':</strong> ' + order.interest_paid_months + ' ' + (lang === 'id' ? 'bulan' : '个月') + ' (' + Utils.formatCurrency(order.interest_paid_total) + ')</p>' +
                            '<p><strong>' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</strong> ' + Utils.formatCurrency(remainingPrincipal) + '</p>' +
                            '<p><strong>' + t('payment_due_date') + ':</strong> ' + nextDueDate + '</p>' +
                            '<p><strong>' + t('notes') + ':</strong> ' + Utils.escapeHtml(order.notes || '-') + '</p>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="info-bar info">' +
                        '<span class="info-bar-icon">💡</span>' +
                        '<div class="info-bar-content">' +
                            '<strong>' + (lang === 'id' ? 'Tips:' : '温馨提示：') + '</strong> ' + 
                            (lang === 'id' ? 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pembayaran pokok lebih awal dapat mengurangi beban bunga. Setelah lunas, sistem akan membuat tanda terima pelunasan secara otomatis.' : '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。') +
                        '</div>' +
                    '</div>' +
                    
                    '<h3>📋 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table payment-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-date">' + t('date') + '</th>' +
                                    '<th class="col-type">' + t('type') + '</th>' +
                                    '<th class="col-months text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th>' +
                                    '<th class="col-amount amount">' + t('amount') + '</th>' +
                                    '<th class="col-method text-center">' + (lang === 'id' ? 'Metode' : '支付方式') + '</th>' +
                                    '<th class="col-desc">' + t('description') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + payRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                    
                    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;" class="no-print">' +
                        '<button onclick="APP.goBack()">↩️ ' + t('back') + '</button>' +
                        (order.status === 'active' && !isAdmin ? '<button onclick="APP.navigateTo(\'payment\',{orderId:\'' + Utils.escapeAttr(order.order_id) + '\'})" class="success">💸 ' + (lang === 'id' ? '续费缴费' : '缴纳费用') + '</button>' : '') +
                        (order.status === 'completed' ? '<button onclick="APP.printSettlementReceipt(\'' + Utils.escapeAttr(order.order_id) + '\')" class="success">🧾 ' + (lang === 'id' ? '结清凭证' : '结清凭证') + '</button>' : '') +
                        '<button onclick="APP.sendWAReminder(\'' + Utils.escapeAttr(order.order_id) + '\')" class="warning">📱 ' + (lang === 'id' ? 'WA提醒' : 'WA提醒') + '</button>' +
                    '</div>' +
                '</div>';
            
        } catch (error) {
            console.error("viewOrder error:", error);
            Utils.ErrorHandler.capture(error, 'viewOrder');
            if (window.Toast) {
                window.Toast.error(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            } else {
                alert(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            }
            APP.goBack();
        }
    },

    deleteOrder: async function(orderId) {
        var lang = Utils.lang;
        
        var confirmed = window.Toast ? await window.Toast.confirmPromise(Utils.t('confirm_delete')) : confirm(Utils.t('confirm_delete'));
        if (!confirmed) return;
        
        try {
            const order = await SUPABASE.getOrder(orderId);
            if (!order) {
                if (window.Toast) {
                    window.Toast.error(Utils.t('order_not_found'));
                } else {
                    alert(Utils.t('order_not_found'));
                }
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
            
            if (window.Toast) {
                window.Toast.success(Utils.t('order_deleted'));
            } else {
                alert(Utils.t('order_deleted'));
            }
            await APP.showOrderTable();
        } catch (error) {
            console.error("deleteOrder error:", error);
            Utils.ErrorHandler.capture(error, 'deleteOrder');
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
            }
        }
    },

    // ==================== 打印订单（XSS 修复版） ====================
    printOrder: async function(orderId) {
        try {
            var result = await SUPABASE.getPaymentHistory(orderId);
            var order = result.order;
            var payments = result.payments;
            if (!order) { 
                if (window.Toast) {
                    window.Toast.error(Utils.t('order_not_found'));
                } else {
                    alert(Utils.t('order_not_found'));
                }
                return; 
            }
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils); 
            var methodMap = { 
                cash: lang === 'id' ? 'Tunai (Brankas)' : '现金 (保险柜)', 
                bank: lang === 'id' ? 'Transfer Bank BNI' : '银行转账 BNI' 
            };
            
            var safeOrderId = Utils.escapeHtml(order.order_id);
            var safeCustomerName = Utils.escapeHtml(order.customer_name);
            var safeCustomerKtp = Utils.escapeHtml(order.customer_ktp || '-');
            var safeCustomerPhone = Utils.escapeHtml(order.customer_phone || '-');
            var safeCustomerAddress = Utils.escapeHtml(order.customer_address || '-');
            var safeCollateral = Utils.escapeHtml(order.collateral_name || '-');
            var safeNotes = Utils.escapeHtml(order.notes || '-');
            
            var paymentRows = '';
            for (var i = 0; i < payments.length; i++) {
                var p = payments[i];
                var typeText = '';
                if (p.type === 'admin_fee') typeText = t('admin_fee');
                else if (p.type === 'service_fee') typeText = t('service_fee');
                else if (p.type === 'interest') typeText = t('interest');
                else if (p.type === 'principal') typeText = t('principal');
                else typeText = p.type || '-';
                
                var methodText = methodMap[p.payment_method] || (p.payment_method === 'cash' ? 'Tunai' : 'Bank');
                var safeDate = Utils.formatDate(p.date);
                var safeAmount = Utils.formatCurrency(p.amount);
                
                paymentRows += '<td>' +
                    '<td class="col-date">' + safeDate + '</td>' +
                    '<td>' + typeText + '</td>' +
                    '<td class="text-right">' + safeAmount + '</td>' +
                    '<td>' + methodText + '</td>' +
                '</tr>';
            }
            
            if (paymentRows === '') {
                paymentRows = '<tr><td colspan="4" class="text-center">' + t('no_data') + 'NonNull';
            }
            
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var safeStoreName = Utils.escapeHtml(AUTH.getCurrentStoreName());
            var safeLoanAmount = Utils.formatCurrency(order.loan_amount);
            var safeRemainingPrincipal = Utils.formatCurrency(remainingPrincipal);
            var safeCreatedAt = Utils.formatDate(order.created_at);
            
            var printWindow = window.open('', '_blank');
            printWindow.document.write('' +
                '<!DOCTYPE html>' +
                '<html>' +
                '<head>' +
                    '<meta charset="UTF-8">' +
                    '<title>JF! by Gadai - ' + safeOrderId + '</title>' +
                    '<style>' +
                        '*{margin:0;padding:0;box-sizing:border-box}' +
                        'body{font-family:\'Segoe UI\',Arial,sans-serif;font-size:12px;padding:15mm}' +
                        '.header{text-align:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px}' +
                        '.header h1{font-size:18px}' +
                        '.section{border:1px solid #ccc;border-radius:6px;padding:12px;margin-bottom:12px}' +
                        '.section h3{font-size:13px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px}' +
                        '.info-row{display:flex;margin-bottom:4px}' +
                        '.info-label{width:100px;font-weight:600}' +
                        'table{width:100%;border-collapse:collapse;margin-top:8px}' +
                        'th,td{border:1px solid #ccc;padding:6px;text-align:left}' +
                        'th{background:#f5f5f5}' +
                        '.text-right{text-align:right}' +
                        '.footer{text-align:center;margin-top:20px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;color:#666}' +
                        '@media print{@page{size:A4;margin:15mm}}' +
                    '</style>' +
                '</head>' +
                '<body>' +
                    '<div class="header">' +
                        '<h1>JF! by Gadai</h1>' +
                        '<p>' + (lang === 'id' ? 'Bukti Transaksi Gadai' : '典当交易凭证') + ' | <strong>' + safeOrderId + '</strong> | ' + safeCreatedAt + '</p>' +
                    '</div>' +
                    '<div class="section">' +
                        '<h3>' + (lang === 'id' ? 'Informasi Nasabah' : '客户信息') + '</h3>' +
                        '<div class="info-row"><div class="info-label">' + t('customer_name') + ':</div><div>' + safeCustomerName + '</div></div>' +
                        '<div class="info-row"><div class="info-label">KTP:</div><div>' + safeCustomerKtp + '</div></div>' +
                        '<div class="info-row"><div class="info-label">' + t('phone') + ':</div><div>' + safeCustomerPhone + '</div></div>' +
                        '<div class="info-row"><div class="info-label">' + t('address') + ':</div><div>' + safeCustomerAddress + '</div></div>' +
                    '</div>' +
                    '<div class="section">' +
                        '<h3>' + (lang === 'id' ? 'Jaminan & Pinjaman' : '质押物与贷款') + '</h3>' +
                        '<div class="info-row"><div class="info-label">' + t('collateral_name') + ':</div><div>' + safeCollateral + '</div></div>' +
                        '<div class="info-row"><div class="info-label">' + t('loan_amount') + ':</div><div>' + safeLoanAmount + '</div></div>' +
                        '<div class="info-row"><div class="info-label">' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</div><div>' + safeRemainingPrincipal + '</div></div>' +
                        '<div class="info-row"><div class="info-label">' + t('notes') + ':</div><div>' + safeNotes + '</div></div>' +
                    '</div>' +
                    '<div class="section">' +
                        '<h3>' + (lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录') + '</h3>' +
                        '<table>' +
                            '<thead><tr><th>' + t('date') + '</th><th>' + t('type') + '</th><th class="text-right">' + t('amount') + '</th><th>' + (lang === 'id' ? 'Metode' : '支付方式') + '</th></tr></thead>' +
                            '<tbody>' + paymentRows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                    '<div class="footer">' +
                        '<div>JF! by Gadai - ' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + '</div>' +
                        '<div>' + (lang === 'id' ? 'Toko' : '门店') + '：' + safeStoreName + '</div>' +
                        '<div>' + (lang === 'id' ? 'Bukti ini dicetak secara elektronik, tidak perlu tanda tangan' : '本凭证为电子打印，无需签名') + '</div>' +
                    '</div>' +
                    '<script>window.onload=function(){window.print();setTimeout(function(){window.close();},1000)};<\/script>' +
                '</body>' +
                '</html>'
            );
            printWindow.document.close();
        } catch (error) {
            console.error("printOrder error:", error);
            Utils.ErrorHandler.capture(error, 'printOrder');
            if (window.Toast) {
                window.Toast.error(Utils.lang === 'id' ? 'Gagal mencetak pesanan' : '打印订单失败');
            } else {
                alert(Utils.lang === 'id' ? 'Gagal mencetak pesanan' : '打印订单失败');
            }
        }
    },

    showPaymentHistory: async function() {
        APP.currentPage = 'paymentHistory';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        try {
            var allPayments = await SUPABASE.getAllPayments();
            var totalAdminFee = 0, totalServiceFee = 0, totalInterest = 0, totalPrincipal = 0;
            for (var i = 0; i < allPayments.length; i++) {
                var p = allPayments[i];
                if (p.type === 'admin_fee') totalAdminFee += p.amount;
                else if (p.type === 'service_fee') totalServiceFee += p.amount;
                else if (p.type === 'interest') totalInterest += p.amount;
                else if (p.type === 'principal') totalPrincipal += p.amount;
            }
            var typeMap = { admin_fee: t('admin_fee'), service_fee: t('service_fee'), interest: t('interest'), principal: t('principal') };
            var methodMap = { cash: t('cash'), bank: t('bank') };

            var rows = '';
            if (allPayments.length === 0) {
                rows = '<tr><td colspan="8" class="text-center">' + t('no_data') + 'NonNull';
            } else {
                for (var i = 0; i < allPayments.length; i++) {
                    var p = allPayments[i];
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    rows += '<table>' +
                        '<td class="order-id">' + Utils.escapeHtml(p.orders?.order_id || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(p.orders?.customer_name || '-') + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td>' + (typeMap[p.type] || p.type) + '</td>' +
                        '<td class="text-center">' + (p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-') + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="text-center"><span class="payment-method-badge ' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                        '<td class="desc-cell">' + Utils.escapeHtml(p.description || '-') + '</td>' +
                    '</tr>';
                }
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + t('payment_history') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + t('print') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="stats-grid stats-grid-auto">' +
                    '<div class="stat-card"><div class="stat-value income">' + Utils.formatCurrency(totalAdminFee) + '</div><div class="stat-label">' + t('admin_fee') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value income">' + Utils.formatCurrency(totalServiceFee) + '</div><div class="stat-label">' + t('service_fee') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value income">' + Utils.formatCurrency(totalInterest) + '</div><div class="stat-label">' + t('interest') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalPrincipal) + '</div><div class="stat-label">' + t('principal') + '</div></div>' +
                    '<div class="stat-card"><div class="stat-value">' + Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal) + '</div><div class="stat-label">' + (lang === 'id' ? 'Total Keseluruhan' : '全部总计') + '</div></div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<div class="table-container">' +
                        '<table class="data-table payment-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + t('order_id') + '</th>' +
                                    '<th class="col-name">' + t('customer_name') + '</th>' +
                                    '<th class="col-date">' + t('date') + '</th>' +
                                    '<th class="col-type">' + t('type') + '</th>' +
                                    '<th class="col-months text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th>' +
                                    '<th class="col-amount amount">' + t('amount') + '</th>' +
                                    '<th class="col-method text-center">' + (lang === 'id' ? 'Metode' : '支付方式') + '</th>' +
                                    '<th class="col-desc">' + t('description') + '</th>' +
'</table>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
            
        } catch (error) {
            console.error("showPaymentHistory error:", error);
            Utils.ErrorHandler.capture(error, 'showPaymentHistory');
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
            } else {
                alert(lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
            }
        }
    }
};

for (var key in DashboardOrders) {
    if (typeof DashboardOrders[key] === 'function') {
        window.APP[key] = DashboardOrders[key];
    }
}
