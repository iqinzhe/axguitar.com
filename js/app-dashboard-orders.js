// app-dashboard-orders.js - v3.2 (完整版，五状态筛选 + 权限控制 + 所有功能完整)
// 功能：订单列表支持 全部/进行中/已逾期/已结清/已变卖 筛选
//       不同状态下顶部操作栏按钮动态可用，逾期高亮，门店默认显示进行中
//       包含完整的打印、缴费历史、管理员修改订单等全部功能

'use strict';

(function () {
    var JF = window.JF || {};
    window.JF = JF;

    var OrdersPage = {
        // ==================== 获取订单数据 ====================
        _fetchOrderData: async function(filters, from, to) {
            var result = await SUPABASE.getOrders(filters, from, to);
            return {
                orders: result.data,
                totalCount: result.totalCount
            };
        },

        // ==================== 构建订单列表 HTML ====================
        buildOrderTableHTML: async function(filters, currentFrom, pageSize) {
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            var isAdmin = PERMISSION.isAdmin();
            var PAGE_SIZE = pageSize || 50;
            var from = currentFrom || 0;
            var to = from + PAGE_SIZE - 1;

            var _a = await Promise.all([
                this._fetchOrderData(filters, from, to),
                SUPABASE.getAllStores()
            ]);
            var ordersResult = _a[0].orders;
            var totalCount = _a[0].totalCount;
            var stores = _a[1];

            var allOrders = ordersResult;
            var currentFromVal = from + allOrders.length;
            var storeMap = {};
            for (var i = 0; i < stores.length; i++) {
                var s = stores[i];
                storeMap[s.id] = s.name;
            }

            var totalCols = isAdmin ? 10 : 9;
            var statusMap = {
                active: t('status_active'),
                completed: t('status_completed'),
                liquidated: t('status_liquidated')
            };
            var overdueText = lang === 'id' ? 'Terlambat' : '已逾期';

            var rows = '';
            for (var idx = 0; idx < allOrders.length; idx++) {
                var o = allOrders[idx];
                var isOverdue = (o.status === 'active' && (o.overdue_days || 0) > 0);
                var displayStatus = o.status;
                if (isOverdue) displayStatus = 'overdue';
                var statusText = isOverdue ? overdueText : (statusMap[o.status] || o.status);
                var storeName = isAdmin ? (storeMap[o.store_id] || '-') : '';
                var nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                var remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                var currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                var repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                var repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';

                var rowClass = 'order-row';
                if (isOverdue) rowClass += ' order-row--overdue';

                rows += '<tr class="' + rowClass + '" data-order-id="' + Utils.escapeHtml(o.order_id) + '" data-order-status="' + o.status + '" data-is-overdue="' + isOverdue + '">' +
                    '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                    '<td class="col-name">' + Utils.escapeHtml(o.customer_name) + '</td>' +
                    '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(currentMonthlyInterest) + '</td>' +
                    '<td class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? 'bln' : '个月') + '</td>' +
                    '<td class="date-cell text-center">' + nextDueDate + '</td>' +
                    '<td class="text-center"><span class="badge badge--' + repaymentClass + '">' + repaymentTypeText + '</span></td>' +
                    '<td class="text-center"><span class="badge badge--' + displayStatus + '">' + statusText + '</span></td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeName) + '</td>' : '') +
                    '</tr>';
            }

            var loadMoreHtml = '';
            if (currentFromVal < totalCount) {
                var remaining = totalCount - currentFromVal;
                loadMoreHtml = '<tr id="loadMoreRow"><td colspan="' + totalCols + '" style="text-align:center;padding:14px;"><button onclick="APP.loadMoreOrders()" class="btn btn--primary btn--sm" style="padding:10px 32px;font-size:14px;">⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多') + ' (' + remaining + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')</button> Nosmoking Nosmoking</td></tr>';
            } else if (totalCount > PAGE_SIZE && allOrders.length > 0) {
                loadMoreHtml = '<tr id="loadMoreRow"><td colspan="' + totalCols + '" style="text-align:center;padding:14px;color:var(--text-muted);">✅ ' + (lang === 'id' ? 'Semua ' + totalCount + ' pesanan telah dimuat' : '已加载全部 ' + totalCount + ' 条订单') + '</td></tr>';
            }

            window._orderTableState = {
                currentFrom: currentFromVal,
                totalCount: totalCount,
                allOrders: allOrders,
                totalCols: totalCols,
                pageSize: PAGE_SIZE,
                filters: filters,
                storeMap: storeMap,
                selectedOrderId: null,
                selectedOrderStatus: null,
                renderOrdersIntoTable: this._renderOrdersIntoTable.bind(this)
            };

            // 筛选下拉选项
            var filterOptions = [
                { value: 'all', label: lang === 'id' ? 'Semua Pesanan' : '全部订单' },
                { value: 'active', label: t('active') },
                { value: 'overdue', label: lang === 'id' ? 'Terlambat' : '已逾期' },
                { value: 'completed', label: t('completed') },
                { value: 'liquidated', label: lang === 'id' ? 'Dijual' : '已变卖' }
            ];
            var filterSelectHtml = '<select id="statusFilter" onchange="APP.filterOrders(this.value)" class="status-filter-select">';
            for (var fi = 0; fi < filterOptions.length; fi++) {
                var opt = filterOptions[fi];
                var selected = (filters.status === opt.value) ? ' selected' : '';
                filterSelectHtml += '<option value="' + opt.value + '"' + selected + '>' + opt.label + '</option>';
            }
            filterSelectHtml += '</select>';

            var content = '' +
                '<div class="page-header">' +
                '<h2>📋 ' + t('order_list') + '</h2>' +
                '<div class="header-actions">' +
                '<button onclick="APP.goBack()" class="btn btn--outline">↩️ ' + t('back') + '</button>' +
                '<button onclick="JF.OrdersPage.printAllOrders()" class="btn btn--outline">🖨️ ' + t('print_order_list') + '</button>' +
                '</div>' +
                '</div>' +
                '<div class="sticky-action-bar">' +
                '<div class="action-bar-inner">' +
                '<div class="action-bar-single-row">' +
                '<span class="action-label-text">' + (lang === 'id' ? 'Operasi' : '操作') + ':</span>' +
                '<span class="action-bar-divider"></span>' +
                '<div class="action-bar-section action-bar-section--filter">' +
                filterSelectHtml +
                '<span id="selectedOrderDisplay" class="selected-order-display">' + (lang === 'id' ? '未选择任何订单' : '未选择任何订单') + '</span>' +
                '</div>' +
                '<span class="action-bar-divider"></span>' +
                '<div class="action-bar-section action-bar-section--view">' +
                (!isAdmin ? '<button id="globalPayBtn" class="btn btn--sm btn--success">💰 ' + (lang === 'id' ? 'Bayar Biaya' : '缴纳费用') + '</button>' : '') +
                '<button id="globalViewBtn" class="btn btn--sm btn--primary">👁️ ' + t('view_detail') + '</button>' +
                '<button id="globalPrintBtn" class="btn btn--sm btn--outline">🖨️ ' + t('print_this_order') + '</button>' +
                '</div>' +
                (isAdmin ? '<span class="action-bar-divider"></span>' +
                '<div class="action-bar-section action-bar-section--edit">' +
                '<button id="globalEditBtn" class="btn btn--sm btn--warning">✏️ ' + (lang === 'id' ? 'Edit Pesanan' : '修改订单') + '</button>' +
                '<button id="globalDeleteBtn" class="btn btn--sm btn--danger">🗑️ ' + t('delete') + '</button>' +
                '</div>' : '') +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="card order-table-card">' +
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
                '<tbody id="orderTableBody">' + rows + loadMoreHtml + '</tbody>' +
                '</table>' +
                '</div>' +
                '</div>';
            return content;
        },

        _renderOrdersIntoTable: function(orders, append) {
            var tbody = document.getElementById('orderTableBody');
            if (!tbody) return;

            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            var isAdmin = PERMISSION.isAdmin();
            var state = window._orderTableState;
            if (!state) return;

            var storeMap = state.storeMap || {};
            var totalCols = state.totalCols;
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var overdueText = lang === 'id' ? 'Terlambat' : '已逾期';

            var rows = '';
            for (var i = 0; i < orders.length; i++) {
                var o = orders[i];
                var isOverdue = (o.status === 'active' && (o.overdue_days || 0) > 0);
                var displayStatus = o.status;
                if (isOverdue) displayStatus = 'overdue';
                var statusText = isOverdue ? overdueText : (statusMap[o.status] || o.status);
                var storeName = isAdmin ? (storeMap[o.store_id] || '-') : '';
                var nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                var remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                var currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                var repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                var repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';
                var rowClass = 'order-row';
                if (isOverdue) rowClass += ' order-row--overdue';

                rows += '<tr class="' + rowClass + '" data-order-id="' + Utils.escapeHtml(o.order_id) + '" data-order-status="' + o.status + '" data-is-overdue="' + isOverdue + '">' +
                    '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                    '<td class="col-name">' + Utils.escapeHtml(o.customer_name) + '</td>' +
                    '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(currentMonthlyInterest) + '</td>' +
                    '<td class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? 'bln' : '个月') + '</td>' +
                    '<td class="date-cell text-center">' + nextDueDate + '</td>' +
                    '<td class="text-center"><span class="badge badge--' + repaymentClass + '">' + repaymentTypeText + '</span></td>' +
                    '<td class="text-center"><span class="badge badge--' + displayStatus + '">' + statusText + '</span></td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeName) + '</td>' : '') +
                    '</tr>';
            }

            if (append) {
                var loadMoreRow = document.getElementById('loadMoreRow');
                if (loadMoreRow) loadMoreRow.remove();
                tbody.insertAdjacentHTML('beforeend', rows);
            } else {
                tbody.innerHTML = rows;
            }
        },

        // ==================== 事件委托：行点击选中 ====================
        _bindRowClickDelegate: function() {
            var tbody = document.getElementById('orderTableBody');
            if (!tbody) return;
            if (tbody._rowClickHandler) {
                tbody.removeEventListener('click', tbody._rowClickHandler);
            }
            var self = this;
            var handler = function(e) {
                var row = e.target.closest('.order-row');
                if (!row) return;
                if (e.target.closest('button')) return;
                var orderId = row.dataset.orderId;
                var orderStatus = row.dataset.orderStatus;
                if (!orderId) return;
                var allRows = document.querySelectorAll('#orderTableBody .order-row');
                for (var i = 0; i < allRows.length; i++) {
                    allRows[i].classList.remove('row-selected');
                }
                row.classList.add('row-selected');
                if (window._orderTableState) {
                    window._orderTableState.selectedOrderId = orderId;
                    window._orderTableState.selectedOrderStatus = orderStatus;
                } else {
                    window._orderTableState = { selectedOrderId: orderId, selectedOrderStatus: orderStatus };
                }
                self._updateSelectedDisplay();
            };
            tbody.addEventListener('click', handler);
            tbody._rowClickHandler = handler;
        },

        _updateSelectedDisplay: function() {
            var displaySpan = document.getElementById('selectedOrderDisplay');
            if (!displaySpan) return;
            var selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            var lang = Utils.lang;
            if (selectedRow && selectedRow.dataset.orderId) {
                var orderId = selectedRow.dataset.orderId;
                displaySpan.textContent = (lang === 'id' ? '✅ Terpilih: ' : '✅ 已选中: ') + orderId;
                displaySpan.style.color = 'var(--success-dark)';
                displaySpan.style.background = 'var(--success-soft, #d1fae5)';
                if (window._orderTableState) {
                    window._orderTableState.selectedOrderId = orderId;
                    window._orderTableState.selectedOrderStatus = selectedRow.dataset.orderStatus;
                }
            } else {
                displaySpan.textContent = lang === 'id' ? '未选择任何订单' : '未选择任何订单';
                displaySpan.style.color = 'var(--primary)';
                displaySpan.style.background = '';
                if (window._orderTableState) {
                    window._orderTableState.selectedOrderId = null;
                    window._orderTableState.selectedOrderStatus = null;
                }
            }
        },

        _clearSelection: function() {
            var selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow) selectedRow.classList.remove('row-selected');
            if (window._orderTableState) {
                window._orderTableState.selectedOrderId = null;
                window._orderTableState.selectedOrderStatus = null;
            }
            this._updateSelectedDisplay();
        },

        _getSelectedOrderId: function() {
            var selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow && selectedRow.dataset.orderId) return selectedRow.dataset.orderId;
            var state = window._orderTableState;
            return state ? state.selectedOrderId : null;
        },

        _getSelectedOrderStatus: function() {
            var selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow && selectedRow.dataset.orderStatus) return selectedRow.dataset.orderStatus;
            var state = window._orderTableState;
            return state ? state.selectedOrderStatus : null;
        },

        _getSelectedIsOverdue: function() {
            var selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow && selectedRow.dataset.isOverdue) return selectedRow.dataset.isOverdue === 'true';
            return false;
        },

        _canEditOrder: function(status, isAdmin) {
            return (isAdmin && status === 'active');
        },

        _canDeleteOrder: function(status, isAdmin) {
            return (isAdmin && status === 'active');
        },

        _canPayOrder: function(status, isAdmin) {
            return (status === 'active');
        },

        // ==================== 全局操作实现 ====================
        _globalViewOrder: async function() {
            var lang = Utils.lang;
            var orderId = this._getSelectedOrderId();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? '请先点击选中一个订单' : '请先点击选中一个订单'); return; }
            await this.viewOrder(orderId);
        },

        _globalPrintOrder: async function() {
            var lang = Utils.lang;
            var orderId = this._getSelectedOrderId();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? '请先选中一个订单' : '请先选中一个订单'); return; }
            await this.printOrder(orderId);
        },

        _globalPayOrder: async function() {
            var lang = Utils.lang;
            var orderId = this._getSelectedOrderId();
            var orderStatus = this._getSelectedOrderStatus();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? '请先选中一个订单' : '请先选中一个订单'); return; }
            if (!this._canPayOrder(orderStatus, PERMISSION.isAdmin())) {
                Utils.toast.warning(lang === 'id' ? '只有进行中的订单可以缴费' : '只有进行中的订单可以缴费');
                return;
            }
            var isOverdue = this._getSelectedIsOverdue();
            if (isOverdue) {
                var confirmMsg = lang === 'id' ? '⚠️ 订单已逾期，缴费将补缴逾期利息。是否继续？' : '⚠️ 订单已逾期，缴费将补缴逾期利息。是否继续？';
                var ok = await Utils.toast.confirm(confirmMsg);
                if (!ok) return;
            }
            await this.payOrder(orderId);
        },

        _globalEditOrder: async function() {
            var lang = Utils.lang;
            var isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) { Utils.toast.warning(lang === 'id' ? '仅管理员可修改订单' : '仅管理员可修改订单'); return; }
            var orderId = this._getSelectedOrderId();
            var orderStatus = this._getSelectedOrderStatus();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? '请先选中一个订单' : '请先选中一个订单'); return; }
            if (!this._canEditOrder(orderStatus, true)) {
                Utils.toast.warning(lang === 'id' ? '只有进行中的订单可以修改' : '只有进行中的订单可以修改');
                return;
            }
            if (JF.AdminEditOrder && JF.AdminEditOrder.adminEditOrder) {
                await JF.AdminEditOrder.adminEditOrder(orderId);
            } else {
                Utils.toast.error(lang === 'id' ? '编辑功能不可用' : '编辑功能不可用');
            }
        },

        _globalDeleteOrder: async function() {
            var lang = Utils.lang;
            var isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) { Utils.toast.warning(lang === 'id' ? '仅管理员可删除订单' : '仅管理员可删除订单'); return; }
            var orderId = this._getSelectedOrderId();
            var orderStatus = this._getSelectedOrderStatus();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? '请先选中一个订单' : '请先选中一个订单'); return; }
            if (!this._canDeleteOrder(orderStatus, true)) {
                Utils.toast.warning(lang === 'id' ? '只有进行中的订单可以删除' : '只有进行中的订单可以删除');
                return;
            }
            await this.deleteOrder(orderId);
            this._clearSelection();
        },

        _bindGlobalEvents: function() {
            var viewBtn = document.getElementById('globalViewBtn');
            var printBtn = document.getElementById('globalPrintBtn');
            var payBtn = document.getElementById('globalPayBtn');
            var editBtn = document.getElementById('globalEditBtn');
            var deleteBtn = document.getElementById('globalDeleteBtn');
            if (viewBtn) viewBtn.onclick = this._globalViewOrder.bind(this);
            if (printBtn) printBtn.onclick = this._globalPrintOrder.bind(this);
            if (payBtn) payBtn.onclick = this._globalPayOrder.bind(this);
            if (editBtn) editBtn.onclick = this._globalEditOrder.bind(this);
            if (deleteBtn) deleteBtn.onclick = this._globalDeleteOrder.bind(this);
        },

        // ==================== 页面渲染入口 ====================
        showOrderTable: async function() {
            APP.currentPage = 'orderTable';
            APP.saveCurrentPageState();
            var isAdmin = PERMISSION.isAdmin();
            var defaultStatus = isAdmin ? 'all' : 'active';
            var currentStatus = APP.currentFilter || defaultStatus;
            if (!isAdmin && currentStatus !== 'active') {
                currentStatus = 'active';
                APP.currentFilter = currentStatus;
            }
            var filters = { status: currentStatus };
            var contentHTML = await this.buildOrderTableHTML(filters, 0, 50);
            document.getElementById("app").innerHTML = contentHTML;
            var self = this;
            setTimeout(function() {
                self._bindRowClickDelegate();
                self._bindGlobalEvents();
                self._updateSelectedDisplay();
            }, 50);
        },

        loadMoreOrders: async function() {
            var state = window._orderTableState;
            if (!state) return;
            var lang = Utils.lang;
            var loadMoreBtn = document.querySelector('#loadMoreRow button');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? '加载中...' : '加载中...');
            }
            try {
                var result = await this._fetchOrderData(state.filters, state.currentFrom, state.currentFrom + state.pageSize - 1);
                var orders = result.orders;
                var totalCount = result.totalCount;
                state.allOrders = state.allOrders.concat(orders);
                state.currentFrom += orders.length;
                state.totalCount = totalCount;
                this._renderOrdersIntoTable(orders, true);
                this._updateLoadMoreRow();
            } catch (err) {
                console.error("loadMoreOrders error:", err);
                if (loadMoreBtn) {
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? '加载更多' : '加载更多');
                }
                Utils.toast.error(lang === 'id' ? '加载更多失败' : '加载更多失败');
            }
        },

        _updateLoadMoreRow: function() {
            var state = window._orderTableState;
            if (!state) return;
            var tbody = document.getElementById('orderTableBody');
            if (!tbody) return;
            var existingRow = document.getElementById('loadMoreRow');
            if (existingRow) existingRow.remove();
            var lang = Utils.lang;
            if (state.currentFrom < state.totalCount) {
                var remaining = state.totalCount - state.currentFrom;
                var btn = '<button onclick="APP.loadMoreOrders()" class="btn btn--primary btn--sm" style="padding:10px 32px;font-size:14px;">⬇️ ' + (lang === 'id' ? '加载更多' : '加载更多') + ' (' + remaining + ' ' + (lang === 'id' ? '剩余' : '剩余') + ')</button>';
                var row = document.createElement('tr');
                row.id = 'loadMoreRow';
                row.innerHTML = '<td colspan="' + state.totalCols + '" style="text-align:center;padding:14px;">' + btn + '</td>';
                tbody.appendChild(row);
            } else if (state.totalCount > 0) {
                var row2 = document.createElement('tr');
                row2.id = 'loadMoreRow';
                row2.innerHTML = '<td colspan="' + state.totalCols + '" style="text-align:center;padding:14px;color:var(--text-muted);">✅ ' + (lang === 'id' ? '已加载全部 ' + state.totalCount + ' 条订单' : '已加载全部 ' + state.totalCount + ' 条订单') + '</td>';
                tbody.appendChild(row2);
            }
        },

        payOrder: function(orderId) {
            APP.navigateTo('payment', { orderId: orderId });
        },

        filterOrders: function(status) {
            APP.currentFilter = status;
            this.showOrderTable();
        },

        viewOrder: async function(orderId) {
            APP.currentPage = 'viewOrder';
            APP.currentOrderId = orderId;
            APP.saveCurrentPageState();
            try {
                var contentHTML = await this.renderViewOrderHTML(orderId);
                document.getElementById("app").innerHTML = contentHTML;
            } catch (error) {
                console.error("viewOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? '加载订单失败' : '加载订单失败');
                APP.goBack();
            }
        },

        deleteOrder: async function(orderId) {
            var confirmed = await Utils.toast.confirm(Utils.t('confirm_delete'));
            if (!confirmed) return;
            try {
                var order = await SUPABASE.getOrder(orderId);
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                await Order.delete(orderId);
                if (window.Audit) await window.Audit.logOrderDelete(order.order_id, order.customer_name, order.loan_amount, AUTH.user ? AUTH.user.name : null);
                Utils.toast.success(Utils.t('order_deleted'));
                if (window.JF && JF.Cache) JF.Cache.clear();
                await this.showOrderTable();
            } catch (error) {
                console.error("deleteOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? '删除失败：' + error.message : '删除失败：' + error.message);
            }
        },

        printOrder: async function(orderId) {
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            try {
                var result = await SUPABASE.getPaymentHistory(orderId);
                var order = result.order;
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                var profile = await SUPABASE.getCurrentProfile();
                var isAdmin = PERMISSION.isAdmin();
                var storeName = '', roleText = '', userName = '';
                try {
                    storeName = AUTH.getCurrentStoreName();
                    roleText = AUTH.isAdmin() ? (lang === 'id' ? '管理员' : '管理员') :
                               AUTH.isStoreManager() ? (lang === 'id' ? '店长' : '店长') : 
                               (lang === 'id' ? '员工' : '员工');
                    userName = AUTH.user ? (AUTH.user.name || '-') : '-';
                } catch (e) { storeName = '-'; roleText = '-'; userName = '-'; }
                var printDateTime = new Date().toLocaleString();
                var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
                var monthlyRate = order.agreed_interest_rate || 0.10;
                var currentMonthlyInterest = remainingPrincipal * monthlyRate;
                var statusText = order.status === 'active' ? (lang === 'id' ? '进行中' : '进行中') :
                                   order.status === 'completed' ? (lang === 'id' ? '已结清' : '已结清') :
                                   (lang === 'id' ? '已变卖' : '已变卖');
                var repaymentText = order.repayment_type === 'fixed' ? (lang === 'id' ? '固定还款' : '固定还款') :
                                     (lang === 'id' ? '灵活还款' : '灵活还款');
                var labels = {
                    order_id: lang === 'id' ? '订单号' : '订单号',
                    customer_name: lang === 'id' ? '客户姓名' : '客户姓名',
                    collateral_name: lang === 'id' ? '质押物名称' : '质押物名称',
                    loan_amount: lang === 'id' ? '贷款金额' : '贷款金额',
                    repayment_type: lang === 'id' ? '还款方式' : '还款方式',
                    status: lang === 'id' ? '状态' : '状态',
                    interest_rate: lang === 'id' ? '约定利率' : '约定利率',
                    monthly_interest: lang === 'id' ? '月利息' : '月利息',
                    remaining_principal: lang === 'id' ? '剩余本金' : '剩余本金'
                };
                var infoItems = [
                    { label: labels.order_id, value: order.order_id },
                    { label: labels.customer_name, value: order.customer_name },
                    { label: labels.collateral_name, value: order.collateral_name },
                    { label: labels.loan_amount, value: Utils.formatCurrency(order.loan_amount) },
                    { label: labels.repayment_type, value: repaymentText },
                    { label: labels.status, value: statusText },
                    { label: labels.interest_rate, value: (monthlyRate * 100).toFixed(0) + '%' },
                    { label: labels.monthly_interest, value: Utils.formatCurrency(currentMonthlyInterest) },
                    { label: labels.remaining_principal, value: Utils.formatCurrency(remainingPrincipal) }
                ];
                var orderInfoGrid = '<div class="order-info-grid">';
                for (var i = 0; i < infoItems.length; i++) {
                    var item = infoItems[i];
                    orderInfoGrid += '<div class="info-item"><div class="label">' + Utils.escapeHtml(item.label) + '</div><div class="value">' + Utils.escapeHtml(item.value) + '</div></div>';
                }
                orderInfoGrid += '</div>';
                var paymentRows = '';
                if (result.payments && result.payments.length > 0) {
                    for (var pIdx = 0; pIdx < result.payments.length; pIdx++) {
                        var p = result.payments[pIdx];
                        var typeText = p.type === 'admin_fee' ? t('admin_fee') : 
                                         p.type === 'service_fee' ? t('service_fee') : 
                                         p.type === 'interest' ? t('interest') : t('principal');
                        paymentRows += '<tr>' +
                            '<td>' + Utils.formatDate(p.date) + '</td>' +
                            '<td>' + Utils.escapeHtml(typeText) + '</td>' +
                            '<td class="text-right">' + Utils.formatCurrency(p.amount) + '</td>' +
                            '<td>' + Utils.escapeHtml(p.payment_method || '-') + '</td>' +
                            '<td>' + Utils.escapeHtml(p.description || '') + '</td>' +
                            '</tr>';
                    }
                } else {
                    paymentRows = '<tr><td colspan="5" class="text-center">' + (lang === 'id' ? '无' : '无') + '</td></tr>';
                }
                var printWindow = window.open('', '_blank');
                printWindow.document.write('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>JF! by Gadai - ' + (lang === 'id' ? '打印订单' : '打印订单') + ' - ' + Utils.escapeHtml(order.order_id) + '</title>\n<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: \'Segoe UI\', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #1e293b; padding: 0; margin: 0; }\n.print-container { padding: 5mm; }\n.print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }\n.print-header .logo { font-size: 14pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }\n.print-header .logo img { height: 28px; width: auto; vertical-align: middle; }\n.print-header-info { font-size: 9pt; color: #475569; margin: 4px 0 8px; text-align: center; white-space: nowrap; }\n.print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; }\n.page-title { font-size: 14pt; font-weight: bold; margin: 12px 0; color: #1e293b; }\n.order-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 24px; margin-bottom: 20px; }\n.info-item { padding: 4px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }\n.info-item .label { font-size: 7pt; color: #64748b; margin-bottom: 2px; }\n.info-item .value { font-size: 10pt; font-weight: 500; color: #1e293b; }\n.card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; break-inside: avoid; }\n.card h3 { font-size: 10pt; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }\ntable { width: 100%; border-collapse: collapse; margin: 6px 0; }\nth { background: #f1f5f9; font-weight: 600; text-align: left; }\nth, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; font-size: 8pt; vertical-align: top; }\n.text-right { text-align: right; }\n.text-center { text-align: center; }\n@media print { @page { size: A4; margin: 0mm 8mm 8mm 8mm; } body { margin: 0; padding: 0; } .print-container { padding: 5mm 0 0 0; } .card { break-inside: avoid; } .info-item { break-inside: avoid; } }\n</style>\n</head>\n<body>\n<div class="print-container">\n<div class="print-header">\n<div class="logo">\n<img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display=\'none\'">\nJF! by Gadai\n</div>\n<div class="print-header-info">\n🏪 ' + (isAdmin ? (lang === 'id' ? '总部' : '总部') : (lang === 'id' ? '门店：' : '门店：') + Utils.escapeHtml(storeName)) + ' &nbsp;|&nbsp; 👤 ' + Utils.escapeHtml(roleText) + ' &nbsp;|&nbsp; 📅 ' + printDateTime + '\n</div>\n</div>\n<h1 class="page-title">📄 ' + (lang === 'id' ? '订单详情' : '订单详情') + '</h1>\n<div class="card">\n<h3>📋 ' + (lang === 'id' ? '订单信息' : '订单信息') + '</h3>\n' + orderInfoGrid + '\n<h3>📋 ' + (lang === 'id' ? '缴费记录' : '缴费记录') + '</h3>\n<table>\n<thead>\n<tr>\n<th>' + t('date') + '</th>\n<th>' + t('type') + '</th>\n<th class="text-right">' + t('amount') + '</th>\n<th>' + t('payment_method') + '</th>\n<th>' + t('description') + '</th>\n</tr>\n</thead>\n<tbody>' + paymentRows + '</tbody>\n</table>\n</div>\n<div class="print-footer">\nJF! by Gadai - ' + (lang === 'id' ? '典当管理系统' : '典当管理系统') + '\n</div>\n</div>\n<script>\nwindow.onload = function() { window.print(); setTimeout(function() { window.close(); }, 800); };\n<\/script>\n</body>\n</html>');
                printWindow.document.close();
            } catch (error) {
                console.error("printOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? '打印订单失败' : '打印订单失败');
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
                    rows = '<tr><td colspan="8" class="text-center">' + t('no_data') + '</td></tr>';
                } else {
                    for (var idx = 0; idx < allPayments.length; idx++) {
                        var p2 = allPayments[idx];
                        var methodClass = p2.payment_method === 'cash' ? 'cash' : 'bank';
                        rows += '<tr>' +
                            '<td class="order-id">' + Utils.escapeHtml(p2.orders ? p2.orders.order_id : '-') + '</td>' +
                            '<td>' + Utils.escapeHtml(p2.orders ? p2.orders.customer_name : '-') + '</td>' +
                            '<td class="date-cell">' + Utils.formatDate(p2.date) + '</td>' +
                            '<td>' + (typeMap[p2.type] || p2.type) + '</td>' +
                            '<td class="text-center">' + (p2.months ? p2.months + (lang === 'id' ? ' 个月' : ' 个月') : '-') + '</td>' +
                            '<td class="amount">' + Utils.formatCurrency(p2.amount) + '</td>' +
                            '<td class="text-center"><span class="badge badge--' + methodClass + '">' + (methodMap[p2.payment_method] || '-') + '</span></td>' +
                            '<td class="desc-cell">' + Utils.escapeHtml(p2.description || '-') + '</td>' +
                            '</tr>';
                    }
                }
                document.getElementById("app").innerHTML = '' +
                    '<div class="page-header"><h2>💰 ' + t('payment_history') + '</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ' + t('back') + '</button><button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ' + t('print') + '</button></div></div>' +
                    '<div class="stats-grid stats-grid--auto">' +
                    '<div class="card card--stat"><div class="stat-value income">' + Utils.formatCurrency(totalAdminFee) + '</div><div class="stat-label">' + t('admin_fee') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value income">' + Utils.formatCurrency(totalServiceFee) + '</div><div class="stat-label">' + t('service_fee') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value income">' + Utils.formatCurrency(totalInterest) + '</div><div class="stat-label">' + t('interest') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value">' + Utils.formatCurrency(totalPrincipal) + '</div><div class="stat-label">' + t('principal') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value">' + Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal) + '</div><div class="stat-label">' + (lang === 'id' ? '全部总计' : '全部总计') + '</div></div>' +
                    '</div>' +
                    '<div class="card">' +
                    '<div class="table-container">' +
                    '<table class="data-table payment-table">' +
                    '<thead><tr><th class="col-id">' + t('order_id') + '</th><th class="col-name">' + t('customer_name') + '</th><th class="col-date">' + t('date') + '</th><th class="col-type">' + t('type') + '</th><th class="col-months text-center">' + (lang === 'id' ? '月数' : '月数') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + (lang === 'id' ? '支付方式' : '支付方式') + '</th><th class="col-desc">' + t('description') + '</th></table></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                    '</div>' +
                    '</div>';
            } catch (error) {
                console.error("showPaymentHistory error:", error);
                Utils.toast.error(lang === 'id' ? '加载缴费记录失败' : '加载缴费记录失败');
            }
        },

        printAllOrders: async function() {
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            var isAdmin = PERMISSION.isAdmin();
            var filters = { status: APP.currentFilter || 'all' };
            try {
                var MAX_PRINT_ORDERS = 500;
                Utils.toast.info(lang === 'id' ? '⏳ 正在准备打印数据...' : '⏳ 正在准备打印数据...', 2000);
                var result = await this._fetchOrderData(filters, 0, MAX_PRINT_ORDERS);
                var orders = result.orders;
                var totalCount = result.totalCount;
                if (totalCount > MAX_PRINT_ORDERS) {
                    Utils.toast.warning(lang === 'id' ? '⚠️ 仅打印前 ' + MAX_PRINT_ORDERS + ' 条订单（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。' : '⚠️ 仅打印前 ' + MAX_PRINT_ORDERS + ' 条订单（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。', 5000);
                }
                if (orders.length === 0) { Utils.toast.warning(lang === 'id' ? '没有可打印的数据' : '没有可打印的数据'); return; }
                var stores = await SUPABASE.getAllStores();
                var storeMap = {};
                for (var sIdx = 0; sIdx < stores.length; sIdx++) { var s = stores[sIdx]; storeMap[s.id] = s.name; }
                var rows = '';
                for (var oIdx = 0; oIdx < orders.length; oIdx++) {
                    var o = orders[oIdx];
                    var nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                    var remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                    var currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                    var repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? '固定' : '固定') : (lang === 'id' ? '灵活' : '灵活');
                    var statusText = o.status === 'active' ? t('status_active') : (o.status === 'completed' ? t('status_completed') : t('status_liquidated'));
                    rows += '<tr>' +
                        '<td>' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td>' + Utils.escapeHtml(o.customer_name) + '</td>' +
                        '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(currentMonthlyInterest) + '</td>' +
                        '<td class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? '个月' : '个月') + '</td>' +
                        '<td class="text-center">' + nextDueDate + '</td>' +
                        '<td class="text-center">' + repaymentTypeText + '</td>' +
                        '<td class="text-center">' + statusText + '</td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeMap[o.store_id] || '-') + '</td>' : '') +
                        '</tr>';
                }
                var headerHtml = '<tr>' +
                    '<th>' + t('order_id') + '</th>' +
                    '<th>' + t('customer_name') + '</th>' +
                    '<th>' + t('collateral_name') + '</th>' +
                    '<th class="amount">' + t('loan_amount') + '</th>' +
                    '<th class="amount">' + (lang === 'id' ? '月利息' : '月利息') + '</th>' +
                    '<th class="text-center">' + (lang === 'id' ? '已付利息' : '已付利息') + '</th>' +
                    '<th class="text-center">' + t('payment_due_date') + '</th>' +
                    '<th class="text-center">' + t('repayment_type') + '</th>' +
                    '<th class="text-center">' + t('status') + '</th>' +
                    (isAdmin ? '<th class="text-center">' + t('store') + '</th>' : '') +
                    '</tr>';
                var storeName = '', roleText = '', userName = '';
                try {
                    storeName = AUTH.getCurrentStoreName();
                    roleText = AUTH.isAdmin() ? (lang === 'id' ? '管理员' : '管理员') :
                               AUTH.isStoreManager() ? (lang === 'id' ? '店长' : '店长') :
                               (lang === 'id' ? '员工' : '员工');
                    userName = AUTH.user ? (AUTH.user.name || '-') : '-';
                } catch (e) { storeName = '-'; roleText = '-'; userName = '-'; }
                var printDateTime = new Date().toLocaleString();
                var printWindow = window.open('', '_blank');
                printWindow.document.write('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>JF! by Gadai - ' + t('print_order_list') + '</title>\n<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: \'Segoe UI\', Arial, sans-serif; font-size: 7.5pt; color: #1e293b; }\n.print-container { padding: 5mm; }\n.print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }\n.print-header .logo { font-size: 13pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }\n.print-header .logo img { height: 26px; width: auto; vertical-align: middle; }\n.print-header-info { font-size: 8pt; color: #475569; margin: 3px 0 6px; text-align: center; }\n.page-title { font-size: 11pt; font-weight: bold; margin: 8px 0 6px; color: #1e293b; }\n.print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; }\ntable { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }\nth { background: #f1f5f9; font-weight: 600; text-align: left; padding: 4px 5px; border: 1px solid #cbd5e1; white-space: nowrap; font-size: 7pt; }\ntd { padding: 4px 5px; border: 1px solid #cbd5e1; font-size: 7pt; vertical-align: top; word-break: break-word; overflow-wrap: break-word; }\n.amount { text-align: right; }\n.text-center { text-align: center; }\ncol.col-id       { width: 22mm; }\ncol.col-customer { width: 32mm; }\ncol.col-collat   { width: 30mm; }\ncol.col-loan     { width: 22mm; }\ncol.col-interest { width: 20mm; }\ncol.col-paid     { width: 14mm; }\ncol.col-due      { width: 18mm; }\ncol.col-type     { width: 13mm; }\ncol.col-status   { width: 14mm; }\ncol.col-store    { width: 19mm; }\n@media print { @page { size: A4 portrait; margin: 8mm; } body { margin: 0; padding: 0; } .print-container { padding: 0; } }\n.print-warning { background: #fef3c7; color: #d97706; padding: 8px; margin-bottom: 12px; border-radius: 4px; font-size: 8pt; text-align: center; }\n</style>\n</head>\n<body>\n<div class="print-container">\n<div class="print-header">\n<div class="logo">\n<img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display=\'none\'">\nJF! by Gadai\n</div>\n<div class="print-header-info">\n🏪 ' + (isAdmin ? (lang === 'id' ? '总部' : '总部') : (lang === 'id' ? '门店：' : '门店：') + Utils.escapeHtml(storeName)) + ' &nbsp;|&nbsp; 👤 ' + Utils.escapeHtml(roleText) + ' &nbsp;|&nbsp; 📅 ' + printDateTime + '\n</div>\n</div>\n' + (totalCount > MAX_PRINT_ORDERS ? '<div class="print-warning">\n⚠️ ' + (lang === 'id' ? '仅打印 ' + orders.length + ' 条订单（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。' : '仅打印 ' + orders.length + ' 条订单（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。') + '\n</div>\n' : '') + '<div class="page-title">📋 ' + t('order_list') + ' &nbsp;<small style="font-size:8pt;font-weight:normal;color:#64748b;">' + (lang === 'id' ? '共' : '共') + ' ' + orders.length + ' ' + (lang === 'id' ? '条订单' : '条订单') + (totalCount > orders.length ? ' (共 ' + totalCount + ')' : '') + '</small></div>\n<table>\n<colgroup>\n<col class="col-id">\n<col class="col-customer">\n<col class="col-collat">\n<col class="col-loan">\n<col class="col-interest">\n<col class="col-paid">\n<col class="col-due">\n<col class="col-type">\n<col class="col-status">\n' + (isAdmin ? '<col class="col-store">' : '') + '\n</colgroup>\n<thead>' + headerHtml + '</thead>\n<tbody>' + rows + '</tbody>\n</table>\n<div class="print-footer">\nJF! by Gadai - ' + (lang === 'id' ? '典当管理系统' : '典当管理系统') + '\n</div>\n</div>\n<script>\nwindow.onload = function() { window.print(); setTimeout(function() { window.close(); }, 800); };\n<\/script>\n</body>\n</html>');
                printWindow.document.close();
            } catch (error) {
                console.error('打印订单列表失败:', error);
                Utils.toast.error(lang === 'id' ? '打印订单列表失败' : '打印订单列表失败');
            }
        },

        renderViewOrderHTML: async function(orderId) {
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            var profile = await SUPABASE.getCurrentProfile();
            var result = await SUPABASE.getPaymentHistory(orderId);
            var isAdmin = PERMISSION.isAdmin();
            var order = result.order;
            var payments = result.payments;
            if (!order) throw new Error('order_not_found');
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            var monthlyRate = order.agreed_interest_rate || 0.10;
            var currentMonthlyInterest = remainingPrincipal * monthlyRate;
            var nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            var repaymentInfoHtml = '';
            if (order.repayment_type === 'fixed') {
                var paidMonths = order.fixed_paid_months || 0;
                var totalMonths = order.repayment_term;
                var fixedPayment = order.monthly_fixed_payment || 0;
                repaymentInfoHtml = '<p><strong>' + t('repayment_type') + ':</strong> 📅 ' + t('fixed_repayment') + ' (' + totalMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + ')</p>' +
                    '<p><strong>' + t('monthly_payment') + ':</strong> ' + Utils.formatCurrency(fixedPayment) + '</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Progress' : '进度') + ':</strong> ' + paidMonths + '/' + totalMonths + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</p>';
            } else {
                repaymentInfoHtml = '<p><strong>' + t('repayment_type') + ':</strong> 💰 ' + t('flexible_repayment') + ' (' + (lang === 'id' ? '最长延期10个月' : '最长延期10个月') + ')</p>';
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
                        '<td class="text-center"><span class="badge badge--' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                        '<td class="desc-cell">' + Utils.escapeHtml(p.description || '-') + '</td>' +
                        '</tr>';
                }
            } else {
                payRows = '<tr><td colspan="6" class="text-center">' + t('no_data') + '</td></tr>';
            }
            var content = '' +
                '<div class="page-header">' +
                '<h2>📄 ' + t('order_details') + '</h2>' +
                '<div class="header-actions">' +
                '<button onclick="APP.goBack()" class="btn btn--outline">↩️ ' + t('back') + '</button>' +
                '<button onclick="APP.printOrder(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--outline">🖨️ ' + t('print') + '</button>' +
                '</div>' +
                '</div>' +
                '<div class="card">' +
                '<div class="order-detail-grid">' +
                '<div class="info-column">' +
                '<h3>📋 ' + (lang === 'id' ? '订单信息' : '订单信息') + '</h3>' +
                '<p><strong>' + t('order_id') + ':</strong> ' + Utils.escapeHtml(order.order_id) + '</p>' +
                '<p><strong>' + t('status') + ':</strong> <span class="badge badge--' + order.status + '">' + (statusMap[order.status] || order.status) + '</span></p>' +
                '<p><strong>' + (lang === 'id' ? '创建日期' : '创建日期') + ':</strong> ' + Utils.formatDate(order.created_at) + '</p>' +
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
                '<h3 style="margin-top:16px;">💰 ' + (lang === 'id' ? '费用明细' : '费用明细') + '</h3>' +
                '<p><strong>' + t('admin_fee') + ':</strong> ' + Utils.formatCurrency(order.admin_fee) + ' ' + (order.admin_fee_paid ? '✅ ' + (lang === 'id' ? '已缴' : '已缴') : '❌ ' + (lang === 'id' ? '未缴' : '未缴')) + '</p>' +
                '<p><strong>' + t('service_fee') + ':</strong> ' + Utils.formatCurrency(order.service_fee_amount || 0) + ' (' + (order.service_fee_percent || 0) + '%) ' + (order.service_fee_amount > 0 ? ((order.service_fee_paid || 0) >= (order.service_fee_amount || 0) ? '✅ ' + (lang === 'id' ? '已缴' : '已缴') : '❌ ' + (lang === 'id' ? '未缴' : '未缴')) : '—') + '</p>' +
                '<p><strong>' + (lang === 'id' ? '月利息（当前）' : '月利息（当前）') + ':</strong> ' + Utils.formatCurrency(currentMonthlyInterest) + ' <small>（' + (lang === 'id' ? '基于剩余本金' : '基于剩余本金') + ' ' + Utils.formatCurrency(remainingPrincipal) + ' × ' + (monthlyRate*100).toFixed(0) + '%）</small></p>' +
                '<p><strong>' + (lang === 'id' ? '已付利息' : '已付利息') + ':</strong> ' + order.interest_paid_months + ' ' + (lang === 'id' ? '个月' : '个月') + ' (' + Utils.formatCurrency(order.interest_paid_total) + ')</p>' +
                '<p><strong>' + (lang === 'id' ? '剩余本金' : '剩余本金') + ':</strong> ' + Utils.formatCurrency(remainingPrincipal) + '</p>' +
                '<p><strong>' + t('payment_due_date') + ':</strong> ' + nextDueDate + '</p>' +
                '<p><strong>' + t('notes') + ':</strong> ' + Utils.escapeHtml(order.notes || '-') + '</p>' +
                '</div>' +
                '</div>' +
                '<div class="info-bar info"><span class="info-bar-icon">💡</span><div class="info-bar-content"><strong>' + (lang === 'id' ? '温馨提示：' : '温馨提示：') + '</strong> ' + (lang === 'id' ? '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。' : '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。') + '</div></div>' +
                '<h3>📋 ' + (lang === 'id' ? '缴费记录' : '缴费记录') + '</h3>' +
                '<div class="table-container"><table class="data-table payment-table"><thead><tr><th class="col-date">' + t('date') + '</th><th class="col-type">' + t('type') + '</th><th class="col-months text-center">' + (lang === 'id' ? '月数' : '月数') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + (lang === 'id' ? '支付方式' : '支付方式') + '</th><th class="col-desc">' + t('description') + '</th></tr></thead><tbody>' + payRows + '</tbody></table></div>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;" class="no-print">' +
                '<button onclick="APP.goBack()" class="btn btn--outline">↩️ ' + t('back') + '</button>' +
                (order.status === 'active' && !isAdmin ? '<button onclick="APP.navigateTo(\'payment\',{orderId:\'' + Utils.escapeHtml(order.order_id) + '\'})" class="btn btn--success">💸 ' + (lang === 'id' ? '缴纳费用' : '缴纳费用') + '</button>' : '') +
                (order.status === 'completed' ? '<button onclick="APP.printSettlementReceipt(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--success">🧾 ' + (lang === 'id' ? '结清凭证' : '结清凭证') + '</button>' : '') +
                '<button onclick="APP.sendWAReminder(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--warning">📱 ' + (lang === 'id' ? 'WA提醒' : 'WA提醒') + '</button>' +
                '</div>' +
                '</div>';
            return content;
        }
    };

    JF.OrdersPage = OrdersPage;

    if (window.APP) {
        window.APP.showOrderTable = OrdersPage.showOrderTable.bind(OrdersPage);
        window.APP.loadMoreOrders = OrdersPage.loadMoreOrders.bind(OrdersPage);
        window.APP.payOrder = OrdersPage.payOrder.bind(OrdersPage);
        window.APP.filterOrders = OrdersPage.filterOrders.bind(OrdersPage);
        window.APP.viewOrder = OrdersPage.viewOrder.bind(OrdersPage);
        window.APP.deleteOrder = OrdersPage.deleteOrder.bind(OrdersPage);
        window.APP.printOrder = OrdersPage.printOrder.bind(OrdersPage);
        window.APP.showPaymentHistory = OrdersPage.showPaymentHistory.bind(OrdersPage);
        window.APP.printAllOrders = OrdersPage.printAllOrders.bind(OrdersPage);
    } else {
        window.APP = {
            showOrderTable: OrdersPage.showOrderTable.bind(OrdersPage),
            loadMoreOrders: OrdersPage.loadMoreOrders.bind(OrdersPage),
            payOrder: OrdersPage.payOrder.bind(OrdersPage),
            filterOrders: OrdersPage.filterOrders.bind(OrdersPage),
            viewOrder: OrdersPage.viewOrder.bind(OrdersPage),
            deleteOrder: OrdersPage.deleteOrder.bind(OrdersPage),
            printOrder: OrdersPage.printOrder.bind(OrdersPage),
            showPaymentHistory: OrdersPage.showPaymentHistory.bind(OrdersPage),
            printAllOrders: OrdersPage.printAllOrders.bind(OrdersPage),
        };
    }

    // 添加逾期行样式
    if (!document.getElementById('orderOverdueStyle')) {
        var style = document.createElement('style');
        style.id = 'orderOverdueStyle';
        style.textContent = '\n            .order-row--overdue { background-color: #fef2f2 !important; border-left: 3px solid #ef4444; }\n            .order-row--overdue:hover { background-color: #fee2e2 !important; }\n            .badge--overdue { background: #fee2e2; color: #dc2626; }\n            .order-row.row-selected { background-color: var(--primary-soft) !important; border-left: 3px solid var(--primary); }\n            .order-row--overdue.row-selected { background-color: #fde68a !important; border-left: 3px solid var(--warning); }\n        ';
        document.head.appendChild(style);
    }
})();

// ==================== 管理员修改订单模块（完整实现） ====================
(function() {
    if (!window.JF) window.JF = {};

    var AdminEditOrder = {
        adminEditOrder: async function(orderId) {
            if (!PERMISSION.isAdmin()) {
                Utils.toast.error(Utils.lang === 'id' ? '仅管理员可修改订单' : '仅管理员可修改订单');
                return;
            }
            var lang = Utils.lang;
            var t = Utils.t.bind(Utils);
            try {
                var order = await SUPABASE.getOrder(orderId);
                if (!order) throw new Error('订单不存在');
                await SUPABASE.unlockOrder(orderId);
                var today = Utils.getLocalToday();
                var orderDate = (order.created_at || '').substring(0, 10) || today;
                document.getElementById('app').innerHTML = '' +
                    '<div class="page-header">' +
                    '<h2>✏️ ' + (lang === 'id' ? '修改订单' : '修改订单') + ' — ' + Utils.escapeHtml(orderId) + '</h2>' +
                    '<div class="header-actions">' +
                    '<button onclick="JF.AdminEditOrder.adminCancelEdit(\'' + Utils.escapeHtml(orderId) + '\')" class="btn btn--outline">↩️ ' + t('cancel') + '</button>' +
                    '</div>' +
                    '</div>' +
                    '<div class="card">' +
                    '<div class="info-bar warning"><span class="info-bar-icon">⚠️</span>' +
                    '<div class="info-bar-content"><strong>' + (lang === 'id' ? '管理员编辑模式' : '管理员编辑模式') + '：</strong>' +
                    (lang === 'id' ? '订单已临时解锁。保存后将自动重新锁定。' : '订单已临时解锁。保存后将自动重新锁定。') + '</div>' +
                    '</div>' +
                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">📋</span> ' + (lang === 'id' ? '基本信息' : '基本信息') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + (lang === 'id' ? '订单日期' : '订单日期') + '</label>' +
                    '<input type="date" id="edit_order_date" value="' + orderDate + '" max="' + today + '"></div>' +
                    '<div class="form-group"><label>' + t('collateral_name') + '</label>' +
                    '<input type="text" id="edit_collateral" value="' + Utils.escapeHtml(order.collateral_name || '') + '"></div>' +
                    '<div class="form-group"><label>' + t('loan_amount') + '</label>' +
                    '<input type="text" id="edit_loan_amount" class="amount-input" value="' + Utils.formatNumberWithCommas(order.loan_amount || 0) + '"></div>' +
                    '<div class="form-group"><label>' + t('notes') + '</label>' +
                    '<input type="text" id="edit_notes" value="' + Utils.escapeHtml(order.notes || '') + '"></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">👤</span> ' + t('customer_info') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('customer_name') + '</label>' +
                    '<input type="text" id="edit_customer_name" value="' + Utils.escapeHtml(order.customer_name || '') + '"></div>' +
                    '<div class="form-group"><label>' + t('ktp_number') + '</label>' +
                    '<input type="text" id="edit_customer_ktp" value="' + Utils.escapeHtml(order.customer_ktp || '') + '"></div>' +
                    '<div class="form-group"><label>' + t('phone') + '</label>' +
                    '<input type="text" id="edit_customer_phone" value="' + Utils.escapeHtml(order.customer_phone || '') + '"></div>' +
                    '<div class="form-group"><label>' + t('address') + '</label>' +
                    '<input type="text" id="edit_customer_address" value="' + Utils.escapeHtml(order.customer_address || '') + '"></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">💰</span> ' + (lang === 'id' ? '费用明细' : '费用明细') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('admin_fee') + ' (Rp)</label>' +
                    '<input type="text" id="edit_admin_fee" class="amount-input" value="' + Utils.formatNumberWithCommas(order.admin_fee || 0) + '">' +
                    '<div class="form-hint">💡 ' + (lang === 'id' ? '填0即为免除' : '填0即为免除') + '</div></div>' +
                    '<div class="form-group"><label>' + t('service_fee') + ' (Rp)</label>' +
                    '<input type="text" id="edit_service_fee" class="amount-input" value="' + Utils.formatNumberWithCommas(order.service_fee_amount || 0) + '">' +
                    '<div class="form-hint">💡 ' + (lang === 'id' ? '填0即为免除' : '填0即为免除') + '</div></div>' +
                    '<div class="form-group"><label>' + t('service_fee') + ' %</label>' +
                    '<input type="number" id="edit_service_fee_percent" value="' + (order.service_fee_percent || 0) + '" min="0" max="10" step="0.5"></div>' +
                    '<div class="form-group"><label>' + (lang === 'id' ? '月利率 (%)' : '月利率 (%)') + '</label>' +
                    '<select id="edit_interest_rate">' + Utils.getInterestRateOptions((order.agreed_interest_rate || 0.10) * 100) + '</select></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">📅</span> ' + t('repayment_type') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('repayment_type') + '</label>' +
                    '<select id="edit_repayment_type">' +
                    '<option value="flexible"' + (order.repayment_type === 'flexible' ? ' selected' : '') + '>' + t('flexible_repayment') + '</option>' +
                    '<option value="fixed"' + (order.repayment_type === 'fixed' ? ' selected' : '') + '>' + t('fixed_repayment') + '</option>' +
                    '</select></div>' +
                    '<div class="form-group"><label>' + t('term_months') + ' ' + (lang === 'id' ? '（固定期数）' : '（固定期数）') + '</label>' +
                    '<input type="number" id="edit_repayment_term" value="' + (order.repayment_term || '') + '" min="1" max="10" placeholder="' + (lang === 'id' ? '灵活还款可留空' : '灵活还款可留空') + '"></div>' +
                    '<div class="form-group"><label>' + t('monthly_payment') + ' (Rp)</label>' +
                    '<input type="text" id="edit_monthly_payment" class="amount-input" value="' + Utils.formatNumberWithCommas(order.monthly_fixed_payment || 0) + '"></div>' +
                    '<div class="form-group"><label>' + (lang === 'id' ? '典当期限（月）' : '典当期限（月）') + '</label>' +
                    '<input type="number" id="edit_pawn_term" value="' + (order.pawn_term_months || '') + '" min="1" max="36" placeholder="' + (lang === 'id' ? '无则留空' : '无则留空') + '"></div>' +
                    '<div class="form-group"><label>' + (lang === 'id' ? '最大延期月数' : '最大延期月数') + '</label>' +
                    '<input type="number" id="edit_max_extension" value="' + (order.max_extension_months || 10) + '" min="1" max="36"></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">💳</span> ' + (lang === 'id' ? '费用缴纳状态' : '费用缴纳状态') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('admin_fee') + ' ' + (lang === 'id' ? '已缴？' : '已缴？') + '</label>' +
                    '<select id="edit_admin_fee_paid">' +
                    '<option value="true"' + (order.admin_fee_paid ? ' selected' : '') + '>' + (lang === 'id' ? '✅ 已缴' : '✅ 已缴') + '</option>' +
                    '<option value="false"' + (!order.admin_fee_paid ? ' selected' : '') + '>' + (lang === 'id' ? '❌ 未缴' : '❌ 未缴') + '</option>' +
                    '</select></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="form-actions">' +
                    '<button onclick="JF.AdminEditOrder.adminSaveOrder(\'' + Utils.escapeHtml(orderId) + '\')" class="btn btn--success" id="adminSaveBtn">' +
                    '💾 ' + (lang === 'id' ? '保存并重新锁定' : '保存并重新锁定') +
                    '</button>' +
                    '<button onclick="JF.AdminEditOrder.adminCancelEdit(\'' + Utils.escapeHtml(orderId) + '\')" class="btn btn--outline">↩️ ' + t('cancel') + '</button>' +
                    '</div>' +
                    '</div>';
                ['edit_loan_amount', 'edit_admin_fee', 'edit_service_fee', 'edit_monthly_payment'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if (el && Utils.bindAmountFormat) Utils.bindAmountFormat(el);
                });
            } catch (error) {
                console.error('adminEditOrder error:', error);
                Utils.toast.error(error.message || (Utils.lang === 'id' ? '打开订单失败' : '打开订单失败'));
            }
        },

        adminSaveOrder: async function(orderId) {
            if (!PERMISSION.isAdmin()) {
                Utils.toast.error(Utils.lang === 'id' ? '仅管理员可保存修改' : '仅管理员可保存修改');
                return;
            }
            var lang = Utils.lang;
            var saveBtn = document.getElementById('adminSaveBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⏳ ' + (lang === 'id' ? '保存中...' : '保存中...');
            }
            try {
                var loanAmount    = Utils.parseNumberFromCommas(document.getElementById('edit_loan_amount') ? document.getElementById('edit_loan_amount').value : null) || 0;
                var adminFee      = Utils.parseNumberFromCommas(document.getElementById('edit_admin_fee') ? document.getElementById('edit_admin_fee').value : null) || 0;
                var serviceFee    = Utils.parseNumberFromCommas(document.getElementById('edit_service_fee') ? document.getElementById('edit_service_fee').value : null) || 0;
                var servicePct    = parseFloat(document.getElementById('edit_service_fee_percent') ? document.getElementById('edit_service_fee_percent').value : 0) || 0;
                var interestRate  = parseFloat(document.getElementById('edit_interest_rate') ? document.getElementById('edit_interest_rate').value : 0) || 10;
                var repayType     = document.getElementById('edit_repayment_type') ? document.getElementById('edit_repayment_type').value : 'flexible';
                var repayTerm     = parseInt(document.getElementById('edit_repayment_term') ? document.getElementById('edit_repayment_term').value : 0) || null;
                var monthlyPmt    = Utils.parseNumberFromCommas(document.getElementById('edit_monthly_payment') ? document.getElementById('edit_monthly_payment').value : null) || 0;
                var pawnTerm      = parseInt(document.getElementById('edit_pawn_term') ? document.getElementById('edit_pawn_term').value : 0) || null;
                var maxExtension  = parseInt(document.getElementById('edit_max_extension') ? document.getElementById('edit_max_extension').value : 0) || 10;
                var adminFeePaid  = (document.getElementById('edit_admin_fee_paid') ? document.getElementById('edit_admin_fee_paid').value : 'false') === 'true';
                var orderDate     = document.getElementById('edit_order_date') ? (document.getElementById('edit_order_date').value || Utils.getLocalToday()) : Utils.getLocalToday();
                var collateral    = document.getElementById('edit_collateral') ? document.getElementById('edit_collateral').value.trim() : '';
                var custName      = document.getElementById('edit_customer_name') ? document.getElementById('edit_customer_name').value.trim() : '';
                var custKtp       = document.getElementById('edit_customer_ktp') ? document.getElementById('edit_customer_ktp').value.trim() : '';
                var custPhone     = document.getElementById('edit_customer_phone') ? document.getElementById('edit_customer_phone').value.trim() : '';
                var custAddress   = document.getElementById('edit_customer_address') ? document.getElementById('edit_customer_address').value.trim() : '';
                var notes         = document.getElementById('edit_notes') ? document.getElementById('edit_notes').value.trim() : '';
                if (!collateral || loanAmount <= 0) {
                    Utils.toast.warning(lang === 'id' ? '抵押物和贷款金额不能为空' : '抵押物和贷款金额不能为空');
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? '保存并重新锁定' : '保存并重新锁定'); }
                    return;
                }
                var agreedRate = interestRate / 100;
                var remainingPrincipal = loanAmount;
                var monthlyInterest = remainingPrincipal * agreedRate;
                var updates = {
                    collateral_name: collateral, loan_amount: loanAmount, monthly_interest: monthlyInterest,
                    admin_fee: adminFee, admin_fee_paid: adminFeePaid, service_fee_amount: serviceFee,
                    service_fee_percent: servicePct, agreed_interest_rate: agreedRate,
                    agreed_service_fee_rate: servicePct / 100, repayment_type: repayType, repayment_term: repayTerm,
                    monthly_fixed_payment: monthlyPmt || null, pawn_term_months: pawnTerm, max_extension_months: maxExtension,
                    customer_name: custName, customer_ktp: custKtp, customer_phone: custPhone, customer_address: custAddress,
                    notes: notes, created_at: orderDate + 'T00:00:00.000Z', updated_at: new Date().toISOString()
                };
                var client = SUPABASE.getClient();
                var errorObj = await client.from('orders').update(updates).eq('order_id', orderId);
                if (errorObj.error) throw errorObj.error;
                // [修复] 管理员修改订单后，同步管理费和服务费的 payment_history 和 cash_flow_records
                // 锁定订单里的金额和状态是合同基准，必须与流水保持一致
                await SUPABASE.syncFeesAfterAdminEdit(orderId, adminFee, adminFeePaid, serviceFee, orderDate);
                await SUPABASE.relockOrder(orderId);
                Utils.toast.success(lang === 'id' ? '✅ 订单已修改并重新锁定！' : '✅ 订单已修改并重新锁定！');
                if (window.JF && JF.Cache) JF.Cache.clear();
                await JF.OrdersPage.viewOrder(orderId);
            } catch (error) {
                console.error('adminSaveOrder error:', error);
                Utils.toast.error(error.message || (lang === 'id' ? '保存失败' : '保存失败'));
                try { await SUPABASE.relockOrder(orderId); } catch(e) {}
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? '保存并重新锁定' : '保存并重新锁定'); }
            }
        },

        adminCancelEdit: async function(orderId) {
            try { await SUPABASE.relockOrder(orderId); } catch(e) {}
            await JF.OrdersPage.viewOrder(orderId);
        }
    };

    JF.AdminEditOrder = AdminEditOrder;

    if (!window.APP) window.APP = {};
    window.APP.adminEditOrder  = AdminEditOrder.adminEditOrder.bind(AdminEditOrder);
    window.APP.adminSaveOrder  = AdminEditOrder.adminSaveOrder.bind(AdminEditOrder);
    window.APP.adminCancelEdit = AdminEditOrder.adminCancelEdit.bind(AdminEditOrder);
})();
