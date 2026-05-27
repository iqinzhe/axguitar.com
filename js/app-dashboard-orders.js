// app-dashboard-orders.js - v2.0 (完整版，五状态筛选 + 权限控制 + 所有功能完整 + 管理员可编辑利息/本金)
// 功能：订单列表支持 全部/进行中/已逾期/已结清/已变卖 筛选
// 费用显示：管理费/服务费为0时显示"免费"

'use strict';

(function () {
    let JF = window.JF || {};
    window.JF = JF;

    let OrdersPage = {
        // ==================== 获取订单数据 ====================
        _fetchOrderData: async function(filters, from, to) {
            // overdue 不是数据库状态值，需转为 active 查询后前端过滤
            let isOverdueFilter = (filters.status === 'overdue');
            let dbFilters = isOverdueFilter ? Object.assign({}, filters, { status: 'active' }) : filters;
            let result = await SUPABASE.getOrders(dbFilters, from, to);
            let orders = result.data;
            if (isOverdueFilter) {
                orders = orders.filter(function(o) { return (o.overdue_days || 0) > 0; });
            }
            return {
                orders: orders,
                totalCount: isOverdueFilter ? orders.length : result.totalCount
            };
        },

        // ==================== 获取费用状态显示 ====================
        _getAdminFeeStatus: function(order, lang) {
            let fee = order.admin_fee || 0;
            if (fee === 0) {
                return '<span class="badge badge--exempt">' + (lang === 'id' ? 'Gratis' : '免费') + '</span>';
            }
            if (order.admin_fee_paid) {
                return '<span class="badge badge--paid">✅ ' + (lang === 'id' ? 'Lunas' : '已缴') + '</span>';
            }
            return '<span class="badge badge--unpaid">❌ ' + (lang === 'id' ? 'Belum' : '未缴') + '</span>';
        },

        _getServiceFeeStatus: function(order, lang) {
            let fee = order.service_fee_amount || 0;
            if (fee === 0) {
                return '<span class="badge badge--exempt">' + (lang === 'id' ? 'Gratis' : '免费') + '</span>';
            }
            let paid = order.service_fee_paid || 0;
            if (paid >= fee) {
                return '<span class="badge badge--paid">✅ ' + (lang === 'id' ? 'Lunas' : '已缴') + '</span>';
            }
            return '<span class="badge badge--unpaid">❌ ' + (lang === 'id' ? 'Belum' : '未缴') + '</span>';
        },

        // ==================== 构建订单列表 HTML ====================
        buildOrderTableHTML: async function(filters, currentFrom, pageSize) {
            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            let isAdmin = PERMISSION.isAdmin();
            let PAGE_SIZE = pageSize || 15;
            let page = (currentFrom && currentFrom > 0) ? currentFrom : 1;
            let from = (page - 1) * PAGE_SIZE;
            let to = from + PAGE_SIZE - 1;

            let _a = await Promise.all([
                this._fetchOrderData(filters, from, to),
                SUPABASE.getAllStores()
            ]);
            let ordersResult = _a[0].orders;
            let totalCount = _a[0].totalCount;
            let stores = _a[1];

            let allOrders = ordersResult;
            let storeMap = {};
            for (var i = 0; i < stores.length; i++) {
                let s = stores[i];
                storeMap[s.id] = s.name;
            }

            let totalCols = isAdmin ? 9 : 8;
            let statusMap = {
                active: t('status_active'),
                completed: t('status_completed'),
                liquidated: t('status_liquidated')
            };
            let overdueText = lang === 'id' ? 'Terlambat' : '已逾期';

            let rows = '';
            for (var idx = 0; idx < allOrders.length; idx++) {
                let o = allOrders[idx];
                let isOverdue = (o.status === 'active' && (o.overdue_days || 0) > 0);
                let displayStatus = o.status;
                if (isOverdue) displayStatus = 'overdue';
                let statusText = isOverdue ? overdueText : (statusMap[o.status] || o.status);
                let storeName = isAdmin ? (storeMap[o.store_id] || '-') : '';
                let remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                let startDate = o.custom_order_date ? Utils.formatDate(o.custom_order_date) : (o.created_at ? Utils.formatDate(o.created_at.substring(0, 10)) : '-');
                let interestRatePct = ((o.agreed_interest_rate || 0) * 100).toFixed(1) + '%';
                let rowClass = 'order-row';
                if (isOverdue) rowClass += ' order-row--overdue';

                rows += '<tr class="' + rowClass + '" data-order-id="' + Utils.escapeHtml(o.order_id) + '" data-order-status="' + o.status + '" data-is-overdue="' + isOverdue + '">' +
                    '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                    '<td class="date-cell text-center">' + startDate + '</td>' +
                    '<td class="col-name">' + Utils.escapeHtml(o.customer_name) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                    '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(remainingPrincipal) + '</td>' +
                    '<td class="text-center">' + interestRatePct + '</td>' +
                    '<td class="text-center"><span class="badge badge--' + displayStatus + '">' + statusText + '</span></td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeName) + '</td>' : '') +
                    '</tr>';
            }

            window._orderTableState = {
                currentFrom: from + allOrders.length,
                totalCount: totalCount,
                allOrders: allOrders,
                totalCols: totalCols,
                pageSize: PAGE_SIZE,
                filters: filters,
                storeMap: storeMap,
                currentPage: page,
                selectedOrderId: null,
                selectedOrderStatus: null,
                renderOrdersIntoTable: this._renderOrdersIntoTable.bind(this)
            };

            let totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
            let paginatorHtml = JF.OrdersPage._buildOrderPaginatorHtml(page, totalPages, PAGE_SIZE, totalCount, filters, lang);

            let filterOptions = [
                { value: 'all', label: lang === 'id' ? 'Semua Pesanan' : '全部订单' },
                { value: 'active', label: t('active') },
                { value: 'overdue', label: lang === 'id' ? 'Terlambat' : '已逾期' },
                { value: 'completed', label: t('completed') },
                { value: 'liquidated', label: lang === 'id' ? 'Dijual' : '已变卖' }
            ];
            let filterSelectHtml = '<select id="statusFilter" onchange="APP.filterOrders(this.value)" class="status-filter-select">';
            for (var fi = 0; fi < filterOptions.length; fi++) {
                let opt = filterOptions[fi];
                let selected = (filters.status === opt.value) ? ' selected' : '';
                filterSelectHtml += '<option value="' + opt.value + '"' + selected + '>' + opt.label + '</option>';
            }
            filterSelectHtml += '</select>';

            let content = '' +
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
                '<span id="selectedOrderDisplay" class="selected-order-display">' + (lang === 'id' ? 'Belum ada pesanan dipilih' : '未选择任何订单') + '</span>' +
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
                '<th class="col-id">'     + t('order_id') + '</th>' +
                '<th class="col-date">'   + (lang === 'id' ? 'Tgl Mulai' : '起始日期') + '</th>' +
                '<th class="col-name">'   + t('customer_name') + '</th>' +
                '<th class="col-amount">' + t('loan_amount') + '</th>' +
                '<th class="col-collat">' + t('collateral_name') + '</th>' +
                '<th class="col-amount">' + (lang === 'id' ? 'Sisa Pokok' : '未还本金') + '</th>' +
                '<th class="col-rate">'   + (lang === 'id' ? 'Suku Bunga' : '利率') + '</th>' +
                '<th class="col-status">' + t('status') + '</th>' +
                (isAdmin ? '<th class="col-store">' + t('store') + '</th>' : '') +
                '</tr>' +
                '</thead>' +
                '<tbody id="orderTableBody">' + rows + '</tbody>' +
                '</table>' +
                '</div>' +
                '</div>' +
                '<div id="orderTablePaginator"></div>';

            setTimeout(function() {
                let el = document.getElementById('orderTablePaginator');
                if (el) el.innerHTML = paginatorHtml;
                JF.OrdersPage._reattachOrderTableEvents();
            }, 0);

            return content;
        },

        _buildOrderPaginatorHtml: function(page, totalPages, pageSize, total, filters, lang) {
            if (total === 0) return '';
            let from = (page - 1) * pageSize + 1;
            let to = Math.min(page * pageSize, total);
            let info = lang === 'id'
                ? '<span class="jf-page-info">' + from + '–' + to + ' / ' + total + '</span>'
                : '<span class="jf-page-info">第 ' + from + '–' + to + ' 条 / 共 ' + total + ' 条</span>';
            let prevDisabled = page <= 1 ? ' disabled' : '';
            let nextDisabled = page >= totalPages ? ' disabled' : '';
            let prevLabel = lang === 'id' ? '‹ Prev' : '‹ 上一页';
            let nextLabel = lang === 'id' ? 'Next ›' : '下一页 ›';
            let filtersJson = JSON.stringify(filters).replace(/'/g, "\\'");

            let pageButtons = '';
            let pages = [];
            if (totalPages <= 7) {
                for (var i = 1; i <= totalPages; i++) pages.push(i);
            } else if (page <= 4) {
                for (var i = 1; i <= 5; i++) pages.push(i);
                pages.push('...'); pages.push(totalPages);
            } else if (page >= totalPages - 3) {
                pages.push(1); pages.push('...');
                for (var i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1); pages.push('...');
                for (var i = page - 1; i <= page + 1; i++) pages.push(i);
                pages.push('...'); pages.push(totalPages);
            }
            for (var pi = 0; pi < pages.length; pi++) {
                let p = pages[pi];
                if (p === '...') {
                    pageButtons += '<span class="jf-page-ellipsis">…</span>';
                } else {
                    let active = p === page ? ' jf-page-active' : '';
                    pageButtons += '<button class="jf-page-btn' + active + '" onclick="JF.OrdersPage.goToOrderPage(' + p + ')">' + p + '</button>';
                }
            }

            let sizes = [15, 25, 50];
            let sizeOpts = sizes.map(function(s) {
                return '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + '</option>';
            }).join('');
            let sizeLabel = lang === 'id' ? 'per hal' : '条/页';
            let sizeSelector = '<select class="jf-page-size-select" onchange="JF.OrdersPage.changeOrderPageSize(this.value)">' + sizeOpts + '</select><span class="jf-page-size-label">' + sizeLabel + '</span>';

            return '<div class="jf-paginator">' +
                info +
                '<div class="jf-page-controls">' +
                '<button class="jf-page-btn jf-page-nav"' + prevDisabled + ' onclick="JF.OrdersPage.goToOrderPage(' + (page-1) + ')">' + prevLabel + '</button>' +
                pageButtons +
                '<button class="jf-page-btn jf-page-nav"' + nextDisabled + ' onclick="JF.OrdersPage.goToOrderPage(' + (page+1) + ')">' + nextLabel + '</button>' +
                '</div>' +
                sizeSelector +
                '</div>';
        },

        goToOrderPage: async function(page) {
            let state = window._orderTableState;
            if (!state) return;
            let lang = Utils.lang;
            let paginator = document.getElementById('orderTablePaginator');
            if (paginator) paginator.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted);">⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...') + '</div>';
            try {
                let html = await JF.OrdersPage.buildOrderTableHTML(state.filters, page, state.pageSize);
                let newHtmlDiv = document.createElement('div');
                newHtmlDiv.innerHTML = html;
                let newCard = newHtmlDiv.querySelector('.order-table-card');
                let newPaginator = newHtmlDiv.querySelector('#orderTablePaginator');
                if (newCard) document.querySelector('.order-table-card').outerHTML = newCard.outerHTML;
                if (newPaginator) document.getElementById('orderTablePaginator').innerHTML = newPaginator.innerHTML;
                JF.OrdersPage._reattachOrderTableEvents();
            } catch(e) {
                console.error('goToOrderPage error:', e);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat halaman' : '加载失败');
            }
        },

        changeOrderPageSize: async function(newSize) {
            let state = window._orderTableState;
            if (!state) return;
            state.pageSize = parseInt(newSize, 10);
            await JF.OrdersPage.goToOrderPage(1);
        },

        _renderOrdersIntoTable: function(orders, append) {
            let tbody = document.getElementById('orderTableBody');
            if (!tbody) return;

            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            let isAdmin = PERMISSION.isAdmin();
            let state = window._orderTableState;
            if (!state) return;

            let storeMap = state.storeMap || {};
            let totalCols = state.totalCols;
            let statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            let overdueText = lang === 'id' ? 'Terlambat' : '已逾期';

            let rows = '';
            for (var i = 0; i < orders.length; i++) {
                let o = orders[i];
                let isOverdue = (o.status === 'active' && (o.overdue_days || 0) > 0);
                let displayStatus = o.status;
                if (isOverdue) displayStatus = 'overdue';
                let statusText = isOverdue ? overdueText : (statusMap[o.status] || o.status);
                let storeName = isAdmin ? (storeMap[o.store_id] || '-') : '';
                let remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                let startDate = o.custom_order_date ? Utils.formatDate(o.custom_order_date) : (o.created_at ? Utils.formatDate(o.created_at.substring(0, 10)) : '-');
                let interestRatePct = ((o.agreed_interest_rate || 0) * 100).toFixed(1) + '%';
                let rowClass = 'order-row';
                if (isOverdue) rowClass += ' order-row--overdue';

                rows += '<tr class="' + rowClass + '" data-order-id="' + Utils.escapeHtml(o.order_id) + '" data-order-status="' + o.status + '" data-is-overdue="' + isOverdue + '">' +
                    '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                    '<td class="date-cell text-center">' + startDate + '</td>' +
                    '<td class="col-name">' + Utils.escapeHtml(o.customer_name) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                    '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                    '<td class="amount">' + Utils.formatCurrency(remainingPrincipal) + '</td>' +
                    '<td class="text-center">' + interestRatePct + '</td>' +
                    '<td class="text-center"><span class="badge badge--' + displayStatus + '">' + statusText + '</span></td>' +
                    (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeName) + '</td>' : '') +
                    '</tr>';
            }

            if (append) {
                let loadMoreRow = document.getElementById('loadMoreRow');
                if (loadMoreRow) loadMoreRow.remove();
                tbody.insertAdjacentHTML('beforeend', rows);
            } else {
                tbody.innerHTML = rows;
            }
        },

        _bindRowClickDelegate: function() {
            let tbody = document.getElementById('orderTableBody');
            if (!tbody) return;
            if (tbody._rowClickHandler) {
                tbody.removeEventListener('click', tbody._rowClickHandler);
            }
            let self = this;
            let handler = function(e) {
                let row = e.target.closest('.order-row');
                if (!row) return;
                if (e.target.closest('button')) return;
                let orderId = row.dataset.orderId;
                let orderStatus = row.dataset.orderStatus;
                if (!orderId) return;
                let allRows = document.querySelectorAll('#orderTableBody .order-row');
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
            let displaySpan = document.getElementById('selectedOrderDisplay');
            if (!displaySpan) return;
            let selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            let lang = Utils.lang;
            if (selectedRow && selectedRow.dataset.orderId) {
                let orderId = selectedRow.dataset.orderId;
                displaySpan.textContent = (lang === 'id' ? '✅ Terpilih: ' : '✅ 已选中: ') + orderId;
                displaySpan.style.color = 'var(--success-dark)';
                displaySpan.style.background = 'var(--success-soft, #d1fae5)';
                if (window._orderTableState) {
                    window._orderTableState.selectedOrderId = orderId;
                    window._orderTableState.selectedOrderStatus = selectedRow.dataset.orderStatus;
                }
            } else {
                displaySpan.textContent = lang === 'id' ? 'Belum ada pesanan dipilih' : '未选择任何订单';
                displaySpan.style.color = 'var(--primary)';
                displaySpan.style.background = '';
                if (window._orderTableState) {
                    window._orderTableState.selectedOrderId = null;
                    window._orderTableState.selectedOrderStatus = null;
                }
            }
        },

        _clearSelection: function() {
            let selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow) selectedRow.classList.remove('row-selected');
            if (window._orderTableState) {
                window._orderTableState.selectedOrderId = null;
                window._orderTableState.selectedOrderStatus = null;
            }
            this._updateSelectedDisplay();
        },

        _getSelectedOrderId: function() {
            let selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow && selectedRow.dataset.orderId) return selectedRow.dataset.orderId;
            let state = window._orderTableState;
            return state ? state.selectedOrderId : null;
        },

        _getSelectedOrderStatus: function() {
            let selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
            if (selectedRow && selectedRow.dataset.orderStatus) return selectedRow.dataset.orderStatus;
            let state = window._orderTableState;
            return state ? state.selectedOrderStatus : null;
        },

        _getSelectedIsOverdue: function() {
            let selectedRow = document.querySelector('#orderTableBody .order-row.row-selected');
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

        _globalViewOrder: async function() {
            let lang = Utils.lang;
            let orderId = this._getSelectedOrderId();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? 'Silakan pilih satu pesanan terlebih dahulu' : '请先点击选中一个订单'); return; }
            await this.viewOrder(orderId);
        },

        _globalPrintOrder: async function() {
            let lang = Utils.lang;
            let orderId = this._getSelectedOrderId();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? 'Silakan pilih satu pesanan' : '请先选中一个订单'); return; }
            await this.printOrder(orderId);
        },

        _globalPayOrder: async function() {
            let lang = Utils.lang;
            let orderId = this._getSelectedOrderId();
            let orderStatus = this._getSelectedOrderStatus();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? 'Silakan pilih satu pesanan' : '请先选中一个订单'); return; }
            if (!this._canPayOrder(orderStatus, PERMISSION.isAdmin())) {
                Utils.toast.warning(lang === 'id' ? 'Hanya pesanan aktif yang dapat dibayar' : '只有进行中的订单可以缴费');
                return;
            }
            let isOverdue = this._getSelectedIsOverdue();
            if (isOverdue) {
                let confirmMsg = lang === 'id' ? '⚠️ Pesanan terlambat. Pembayaran akan mencakup bunga tertunggak. Lanjutkan?' : '⚠️ 订单已逾期，缴费将补缴逾期利息。是否继续？';
                let ok = await Utils.toast.confirm(confirmMsg);
                if (!ok) return;
            }
            await this.payOrder(orderId);
        },

        _globalEditOrder: async function() {
            let lang = Utils.lang;
            let isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) { Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat mengedit pesanan' : '仅管理员可修改订单'); return; }
            let orderId = this._getSelectedOrderId();
            let orderStatus = this._getSelectedOrderStatus();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? 'Silakan pilih satu pesanan' : '请先选中一个订单'); return; }
            if (!this._canEditOrder(orderStatus, true)) {
                Utils.toast.warning(lang === 'id' ? 'Hanya pesanan aktif yang dapat diedit' : '只有进行中的订单可以修改');
                return;
            }
            if (JF.AdminEditOrder && JF.AdminEditOrder.adminEditOrder) {
                await JF.AdminEditOrder.adminEditOrder(orderId);
            } else {
                Utils.toast.error(lang === 'id' ? 'Fitur edit tidak tersedia' : '编辑功能不可用');
            }
        },

        _globalDeleteOrder: async function() {
            let lang = Utils.lang;
            let isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) { Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat menghapus pesanan' : '仅管理员可删除订单'); return; }
            let orderId = this._getSelectedOrderId();
            let orderStatus = this._getSelectedOrderStatus();
            if (!orderId) { Utils.toast.warning(lang === 'id' ? 'Silakan pilih satu pesanan' : '请先选中一个订单'); return; }
            if (!this._canDeleteOrder(orderStatus, true)) {
                Utils.toast.warning(lang === 'id' ? 'Hanya pesanan aktif yang dapat dihapus' : '只有进行中的订单可以删除');
                return;
            }
            await this.deleteOrder(orderId);
            this._clearSelection();
        },

        _bindGlobalEvents: function() {
            let viewBtn = document.getElementById('globalViewBtn');
            let printBtn = document.getElementById('globalPrintBtn');
            let payBtn = document.getElementById('globalPayBtn');
            let editBtn = document.getElementById('globalEditBtn');
            let deleteBtn = document.getElementById('globalDeleteBtn');
            if (viewBtn) viewBtn.onclick = this._globalViewOrder.bind(this);
            if (printBtn) printBtn.onclick = this._globalPrintOrder.bind(this);
            if (payBtn) payBtn.onclick = this._globalPayOrder.bind(this);
            if (editBtn) editBtn.onclick = this._globalEditOrder.bind(this);
            if (deleteBtn) deleteBtn.onclick = this._globalDeleteOrder.bind(this);
        },

        _reattachOrderTableEvents: function() {
            let self = JF.OrdersPage;
            self._bindRowClickDelegate();
            self._bindGlobalEvents();
            self._updateSelectedDisplay();
        },

        showOrderTable: async function() {
            APP.currentPage = 'orderTable';
            APP.saveCurrentPageState();
            let isAdmin = PERMISSION.isAdmin();
            let defaultStatus = isAdmin ? 'all' : 'active';
            let currentStatus = APP.currentFilter || defaultStatus;
            APP.currentFilter = currentStatus;
            let filters = { status: currentStatus };
            let contentHTML = await this.buildOrderTableHTML(filters, 1, 15);
            document.getElementById("app").innerHTML = contentHTML;
            let self = this;
            setTimeout(function() {
                self._bindRowClickDelegate();
                self._bindGlobalEvents();
                self._updateSelectedDisplay();
            }, 50);
        },

        loadMoreOrders: async function() {
            let state = window._orderTableState;
            if (!state) return;
            let lang = Utils.lang;
            let loadMoreBtn = document.querySelector('#loadMoreRow button');
            if (loadMoreBtn) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...');
            }
            try {
                let result = await this._fetchOrderData(state.filters, state.currentFrom, state.currentFrom + state.pageSize - 1);
                let orders = result.orders;
                let totalCount = result.totalCount;
                state.allOrders = state.allOrders.concat(orders);
                state.currentFrom += orders.length;
                state.totalCount = totalCount;
                this._renderOrdersIntoTable(orders, true);
                this._updateLoadMoreRow();
            } catch (err) {
                console.error("loadMoreOrders error:", err);
                if (loadMoreBtn) {
                    loadMoreBtn.disabled = false;
                    loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat lebih banyak' : '加载更多');
                }
                Utils.toast.error(lang === 'id' ? 'Gagal memuat lebih banyak' : '加载更多失败');
            }
        },

        _updateLoadMoreRow: function() {
            let state = window._orderTableState;
            if (!state) return;
            let tbody = document.getElementById('orderTableBody');
            if (!tbody) return;
            let existingRow = document.getElementById('loadMoreRow');
            if (existingRow) existingRow.remove();
            // 有分页器时不显示"加载更多"行，避免两套系统冲突
            let paginator = document.getElementById('orderTablePaginator');
            if (paginator && paginator.innerHTML.trim()) return;
            let lang = Utils.lang;
            if (state.currentFrom < state.totalCount) {
                let remaining = state.totalCount - state.currentFrom;
                let btn = '<button onclick="APP.loadMoreOrders()" class="btn btn--primary btn--sm" style="padding:10px 32px;font-size:14px;">⬇️ ' + (lang === 'id' ? 'Muat lebih banyak' : '加载更多') + ' (' + remaining + ' ' + (lang === 'id' ? 'tersisa' : '剩余') + ')</button>';
                let row = document.createElement('tr');
                row.id = 'loadMoreRow';
                row.innerHTML = '<td colspan="' + state.totalCols + '" style="text-align:center;padding:14px;">' + btn + '</td>';
                tbody.appendChild(row);
            } else if (state.totalCount > 0) {
                let row2 = document.createElement('tr');
                row2.id = 'loadMoreRow';
                row2.innerHTML = '<td colspan="' + state.totalCols + '" style="text-align:center;padding:14px;color:var(--text-muted);">✅ ' + (lang === 'id' ? '已加载全部 ' + state.totalCount + ' 条订单' : '已加载全部 ' + state.totalCount + ' 条订单') + '</td>';
                tbody.appendChild(row2);
            }
        },

        payOrder: function(orderId) {
            APP.navigateTo('payment', { orderId: orderId });
        },

        filterOrders: async function(status) {
            APP.currentFilter = status;
            await this.showOrderTable();
        },

        viewOrder: async function(orderId) {
            APP.navigateTo('viewOrder', { orderId: orderId });
        },

        deleteOrder: async function(orderId) {
            let confirmed = await Utils.toast.confirm(Utils.t('confirm_delete'));
            if (!confirmed) return;
            try {
                let order = await SUPABASE.getOrder(orderId);
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
            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            try {
                let result = await SUPABASE.getPaymentHistory(orderId);
                let order = result.order;
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                let profile = await SUPABASE.getCurrentProfile();
                let isAdmin = PERMISSION.isAdmin();
                let storeName = '', roleText = '', userName = '';
                try {
                    storeName = AUTH.getCurrentStoreName();
                    roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                               AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') : 
                               (lang === 'id' ? 'Staf' : '员工');
                    userName = AUTH.user ? (AUTH.user.name || '-') : '-';
                } catch (e) { storeName = '-'; roleText = '-'; userName = '-'; }
                let printDateTime = new Date().toLocaleString();
                let remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
                let monthlyRate = order.agreed_interest_rate || 0.10;
                let currentMonthlyInterest = remainingPrincipal * monthlyRate;
                let statusText = order.status === 'active' ? (lang === 'id' ? 'Aktif' : '进行中') :
                                   order.status === 'completed' ? (lang === 'id' ? 'Lunas' : '已结清') :
                                   (lang === 'id' ? 'Dijual' : '已变卖');
                let isFixed = order.repayment_type === 'fixed';
                let repaymentText = isFixed ? (lang === 'id' ? 'Cicilan Tetap' : '固定还款') :
                                     (lang === 'id' ? 'Cicilan Bebas' : '灵活还款');

                // 建立订单日期
                let printOrderStartDate = order.custom_order_date
                    ? Utils.formatDate(order.custom_order_date)
                    : (order.created_at ? Utils.formatDate(order.created_at) : '-');

                // 到期日（仅固定还款）
                let printMaturityDateStr = '-';
                if (isFixed && order.repayment_term) {
                    let printStartRaw = order.custom_order_date || order.created_at;
                    if (printStartRaw) {
                        let printMatDate = new Date(printStartRaw);
                        printMatDate.setMonth(printMatDate.getMonth() + (order.repayment_term || 0));
                        printMaturityDateStr = Utils.formatDate(printMatDate.toISOString().substring(0, 10));
                    }
                }

                // 固定还款：期数信息
                let printPaidMonths = order.fixed_paid_months || 0;
                let printTotalMonths = order.repayment_term || 0;
                let printRemainingMonths = printTotalMonths - printPaidMonths;
                let printFixedPayment = order.monthly_fixed_payment || 0;

                let customerPhone = order.customer_phone || order.phone || '-';
                let orderNotes    = order.notes || '-';
                let repayTypeLabel = repaymentText + (isFixed ? ' (' + (order.repayment_term||0) + (lang==='id'?' bln':' 个月') + ')' : '');

                // 统一 3行4列布局（固定/灵活还款共用）
                let infoItems = [
                    // 行1
                    { label: lang==='id' ? 'ID Pesanan'      : '订单号',   value: order.order_id },
                    { label: lang==='id' ? 'Tgl. Mulai'      : '起始日期', value: printOrderStartDate },
                    { label: lang==='id' ? 'Nama Nasabah'    : '客户姓名', value: order.customer_name },
                    { label: lang==='id' ? 'No. HP'          : '电话号码', value: customerPhone },
                    // 行2
                    { label: lang==='id' ? 'Nama Jaminan'    : '质押物品名', value: order.collateral_name },
                    { label: lang==='id' ? 'Jumlah Pinjaman' : '贷款金额',   value: Utils.formatCurrency(order.loan_amount) },
                    { label: lang==='id' ? 'Suku Bunga'      : '约定利率',   value: (monthlyRate*100).toFixed(0)+'%' },
                    { label: lang==='id' ? 'Jenis Cicilan'   : '还款方式',   value: repayTypeLabel },
                    // 行3
                    { label: lang==='id' ? 'Bunga Bulanan'   : '月利息',     value: Utils.formatCurrency(currentMonthlyInterest) },
                    { label: lang==='id' ? 'Sisa Pokok'      : '剩余本金',   value: Utils.formatCurrency(remainingPrincipal) },
                    { label: lang==='id' ? 'Catatan'         : '订单备注',   value: orderNotes },
                    { label: lang==='id' ? 'Status'          : '订单状态',   value: statusText },
                ];
                let orderInfoGrid = '<div class="order-info-grid">';
                for (var i = 0; i < infoItems.length; i++) {
                    let item = infoItems[i];
                    orderInfoGrid += '<div class="info-item"><div class="label">' + Utils.escapeHtml(item.label) + '</div><div class="value">' + Utils.escapeHtml(item.value) + '</div></div>';
                }
                orderInfoGrid += '</div>';
                let paymentRows = '';
                if (result.payments && result.payments.length > 0) {
                    for (var pIdx = 0; pIdx < result.payments.length; pIdx++) {
                        let p = result.payments[pIdx];
                        let typeText = p.type === 'admin_fee' ? t('admin_fee') : 
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
                    paymentRows = '<tr><td colspan="5" class="text-center">' + (lang === 'id' ? 'Tidak ada' : '无') + '</td></tr>';
                }
                let printWindow = window.open('', '_blank');
                printWindow.document.write('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>JF! by Gadai - ' + (lang === 'id' ? 'Detail Pesanan' : '订单详情') + ' - ' + Utils.escapeHtml(order.order_id) + '</title>\n<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: \'Segoe UI\', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #1e293b; }\n.print-container { padding: 5mm; }\n.print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }\n.print-header .logo { font-size: 14pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }\n.print-header .logo img { height: 28px; width: auto; vertical-align: middle; }\n.print-header-info { font-size: 9pt; color: #475569; margin: 4px 0 8px; text-align: center; }\n.print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; white-space: nowrap; }\n.page-title { font-size: 14pt; font-weight: bold; margin: 12px 0; color: #1e293b; }\n.order-info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px; margin-bottom: 12px; }\n.info-item { padding: 4px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }\n.info-item .label { font-size: 7pt; color: #64748b; margin-bottom: 2px; }\n.info-item .value { font-size: 9.5pt; font-weight: 500; color: #1e293b; }\n.info-disclaimer { font-size: 7.5pt; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; line-height: 1.5; }\n.card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; }\n.card h3 { font-size: 10pt; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }\ntable { width: 100%; border-collapse: collapse; margin: 6px 0; }\nthead { display: table-header-group; }\ntbody tr { break-inside: avoid; page-break-inside: avoid; }\nth { background: #f1f5f9; font-weight: 600; text-align: left; }\nth, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; font-size: 8pt; vertical-align: top; }\n.text-right { text-align: right; }\n.text-center { text-align: center; }\n@media print { @page { size: A4; margin: 8mm; } body { margin: 0; padding: 0; } .print-container { padding: 0; } }\n</style>\n</head>\n<body>\n<div class="print-container">\n<div class="print-header">\n<div class="logo">\n<img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display=\'none\'">\nJF! by Gadai\n</div>\n<div class="print-header-info">\n🏪 ' + (isAdmin ? (lang === 'id' ? 'Pusat' : '总部') : (lang === 'id' ? 'Toko: ' : '门店：') + Utils.escapeHtml(storeName)) + ' &nbsp;|&nbsp; 👤 ' + Utils.escapeHtml(roleText) + ' &nbsp;|&nbsp; 📅 ' + printDateTime + '\n</div>\n</div>\n<h1 class="page-title">📄 ' + (lang === 'id' ? 'Detail Pesanan' : '订单详情') + '</h1>\n<div class="card">\n<h3>📋 ' + (lang === 'id' ? 'Informasi Pesanan' : '订单信息') + '</h3>\n' + orderInfoGrid + '\n<h3>📋 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录') + '</h3>\n<table>\n<thead>\n<tr>\n<th>' + t('date') + '</th>\n<th>' + t('type') + '</th>\n<th class="text-right">' + t('amount') + '</th>\n<th>' + t('payment_method') + '</th>\n<th>' + t('description') + '</th>\n</tr>\n</thead>\n<tbody>' + paymentRows + '</tbody>\n</table>\n</div>\n<div class="print-footer">JF! by Gadai — ' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + ' &nbsp;|&nbsp; 1/1</div>\n</div>\n<script>\nwindow.onload = function() { window.print(); setTimeout(function() { window.close(); }, 800); };\n<\/script>\n</body>\n</html>');
                printWindow.document.close();
            } catch (error) {
                console.error("printOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mencetak pesanan' : '打印订单失败');
            }
        },

        showPaymentHistory: async function() {
            APP.currentPage = 'paymentHistory';
            APP.saveCurrentPageState();
            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            try {
                let allPayments = await SUPABASE.getAllPayments();
                let totalAdminFee = 0, totalServiceFee = 0, totalInterest = 0, totalPrincipal = 0;
                for (var i = 0; i < allPayments.length; i++) {
                    let p = allPayments[i];
                    if (p.type === 'admin_fee') totalAdminFee += p.amount;
                    else if (p.type === 'service_fee') totalServiceFee += p.amount;
                    else if (p.type === 'interest') totalInterest += p.amount;
                    else if (p.type === 'principal') totalPrincipal += p.amount;
                }
                let typeMap = { admin_fee: t('admin_fee'), service_fee: t('service_fee'), interest: t('interest'), principal: t('principal') };
                let methodMap = { cash: t('cash'), bank: t('bank') };
                let rows = '';
                if (allPayments.length === 0) {
                    rows = '<tr><td colspan="8" class="text-center">' + t('no_data') + '</td></tr>';
                } else {
                    for (var idx = 0; idx < allPayments.length; idx++) {
                        let p2 = allPayments[idx];
                        let methodClass = p2.payment_method === 'cash' ? 'cash' : 'bank';
                        rows += '<tr>' +
                            '<td class="order-id">' + Utils.escapeHtml(p2.orders ? p2.orders.order_id : '-') + '</td>' +
                            '<td>' + Utils.escapeHtml(p2.orders ? p2.orders.customer_name : '-') + '</td>' +
                            '<td class="date-cell">' + Utils.formatDate(p2.date) + '</td>' +
                            '<td>' + (typeMap[p2.type] || p2.type) + '</td>' +
                            '<td class="text-center">' + (p2.months ? p2.months + (lang === 'id' ? ' bln' : ' 个月') : '-') + '</td>' +
                            '<td class="amount">' + Utils.formatCurrency(p2.amount) + '</td>' +
                            '<td class="text-center"><span class="badge badge--' + methodClass + '">' + (methodMap[p2.payment_method] || '-') + '</span></td>' +
                            '<td class="desc-cell">' + Utils.escapeHtml(p2.description || '-') + '</td>' +
                            '</tr>';
                    }
                }
                document.getElementById("app").innerHTML = '' +
                    '<div class="page-header"><h2>💰 ' + t('payment_history') + '</h2><div class="header-actions"><button onclick="APP.navigateTo(\'orderTable\')" class="btn btn--outline">↩️ ' + t('back') + '</button><button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ' + t('print') + '</button></div></div>' +
                    '<div class="stats-grid stats-grid--auto">' +
                    '<div class="card card--stat"><div class="stat-value income">' + Utils.formatCurrency(totalAdminFee) + '</div><div class="stat-label">' + t('admin_fee') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value income">' + Utils.formatCurrency(totalServiceFee) + '</div><div class="stat-label">' + t('service_fee') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value income">' + Utils.formatCurrency(totalInterest) + '</div><div class="stat-label">' + t('interest') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value">' + Utils.formatCurrency(totalPrincipal) + '</div><div class="stat-label">' + t('principal') + '</div></div>' +
                    '<div class="card card--stat"><div class="stat-value">' + Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal) + '</div><div class="stat-label">' + (lang === 'id' ? 'Total Semua' : '全部总计') + '</div></div>' +
                    '</div>' +
                    '<div class="card">' +
                    '<div class="table-container">' +
                    '<table class="data-table payment-table">' +
                    '<thead><tr><th class="col-id">' + t('order_id') + '</th><th class="col-name">' + t('customer_name') + '</th><th class="col-date">' + t('date') + '</th><th class="col-type">' + t('type') + '</th><th class="col-months text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + (lang === 'id' ? 'Metode Bayar' : '支付方式') + '</th><th class="col-desc">' + t('description') + '</th></tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                    '</div>' +
                    '</div>';
            } catch (error) {
                console.error("showPaymentHistory error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
            }
        },

        printAllOrders: async function() {
            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            let isAdmin = PERMISSION.isAdmin();
            let filters = { status: APP.currentFilter || 'all' };
            try {
                let MAX_PRINT_ORDERS = 500;
                Utils.toast.info(lang === 'id' ? '⏳ Mempersiapkan data cetak...' : '⏳ 正在准备打印数据...', 2000);
                let result = await this._fetchOrderData(filters, 0, MAX_PRINT_ORDERS);
                let orders = result.orders;
                let totalCount = result.totalCount;
                if (totalCount > MAX_PRINT_ORDERS) {
                    Utils.toast.warning(lang === 'id' ? '⚠️ 仅打印前 ' + MAX_PRINT_ORDERS + ' 条订单（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。' : '⚠️ 仅打印前 ' + MAX_PRINT_ORDERS + ' 条订单（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。', 5000);
                }
                if (orders.length === 0) { Utils.toast.warning(lang === 'id' ? 'Tidak ada data untuk dicetak' : '没有可打印的数据'); return; }
                let stores = await SUPABASE.getAllStores();
                let storeMap = {};
                for (var sIdx = 0; sIdx < stores.length; sIdx++) { var s = stores[sIdx]; storeMap[s.id] = s.name; }
                let rows = '';
                for (var oIdx = 0; oIdx < orders.length; oIdx++) {
                    let o = orders[oIdx];
                    let orderStartDate = o.custom_order_date
                        ? Utils.formatDate(o.custom_order_date)
                        : (o.created_at ? Utils.formatDate(o.created_at.substring(0, 10)) : '-');
                    let remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                    let currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                    let repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Bebas' : '灵活');
                    let adminFeeStatus = OrdersPage._getAdminFeeStatus(o, lang);
                    let serviceFeeStatus = OrdersPage._getServiceFeeStatus(o, lang);
                    let statusText = o.status === 'active' ? t('status_active') : (o.status === 'completed' ? t('status_completed') : t('status_liquidated'));
                    rows += '<tr>' +
                        '<td>' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td class="text-center">' + orderStartDate + '</td>' +
                        '<td>' + Utils.escapeHtml(o.customer_name) + '</td>' +
                        '<td>' + Utils.escapeHtml(o.customer_phone || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(o.collateral_name) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(currentMonthlyInterest) + '</td>' +
                        '<td class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? 'bulan' : '个月') + '</td>' +
                        '<td class="text-center">' + repaymentTypeText + '</td>' +
                        '<td class="text-center">' + adminFeeStatus + '</td>' +
                        '<td class="text-center">' + serviceFeeStatus + '</td>' +
                        '<td class="text-center">' + statusText + '</td>' +
                        (isAdmin ? '<td class="text-center">' + Utils.escapeHtml(storeMap[o.store_id] || '-') + '</td>' : '') +
                        '</tr>';
                }
                let headerHtml = '<tr>' +
                    '<th>' + t('order_id') + '</th>' +
                    '<th class="text-center">' + (lang === 'id' ? 'Tgl. Mulai' : '起始日期') + '</th>' +
                    '<th>' + t('customer_name') + '</th>' +
                    '<th>' + (lang === 'id' ? 'No. Telp' : '电话号码') + '</th>' +
                    '<th>' + t('collateral_name') + '</th>' +
                    '<th class="amount">' + t('loan_amount') + '</th>' +
                    '<th class="amount">' + (lang === 'id' ? 'Bunga/Bln' : '月利息') + '</th>' +
                    '<th class="text-center">' + (lang === 'id' ? 'Bln Dibayar' : '已付月数') + '</th>' +
                    '<th class="text-center">' + t('repayment_type') + '</th>' +
                    '<th class="text-center">📋 ' + (lang === 'id' ? 'Admin' : '管理费') + '</th>' +
                    '<th class="text-center">✨ ' + (lang === 'id' ? 'Layanan' : '服务费') + '</th>' +
                    '<th class="text-center">' + t('status') + '</th>' +
                    (isAdmin ? '<th class="text-center">' + t('store') + '</th>' : '') +
                    '</tr>';
                let storeName = '', roleText = '', userName = '';
                try {
                    storeName = AUTH.getCurrentStoreName();
                    roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                               AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') :
                               (lang === 'id' ? 'Staf' : '员工');
                    userName = AUTH.user ? (AUTH.user.name || '-') : '-';
                } catch (e) { storeName = '-'; roleText = '-'; userName = '-'; }
                let printDateTime = new Date().toLocaleString();
                let printWindow = window.open('', '_blank');
                printWindow.document.write('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>JF! by Gadai - ' + (lang === 'id' ? 'Daftar Pesanan' : '订单列表') + '</title>\n<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: \'Segoe UI\', Arial, sans-serif; font-size: 7.5pt; color: #1e293b; }\n.print-container { padding: 5mm; }\n.print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }\n.print-header .logo { font-size: 13pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }\n.print-header .logo img { height: 26px; width: auto; vertical-align: middle; }\n.print-header-info { font-size: 8pt; color: #475569; margin: 3px 0 6px; text-align: center; }\n.page-title { font-size: 11pt; font-weight: bold; margin: 8px 0 6px; color: #1e293b; }\n.print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; white-space: nowrap; }\ntable { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }\nth { background: #f1f5f9; font-weight: 600; text-align: left; padding: 4px 5px; border: 1px solid #cbd5e1; white-space: nowrap; font-size: 7pt; }\ntd { padding: 4px 5px; border: 1px solid #cbd5e1; font-size: 7pt; vertical-align: top; word-break: break-word; overflow-wrap: break-word; }\ntbody tr { break-inside: avoid; page-break-inside: avoid; }\nthead { display: table-header-group; }\n.amount { text-align: right; }\n.text-center { text-align: center; }\ncol.col-id       { width: 14mm; }\ncol.col-start    { width: 16mm; }\ncol.col-customer { width: 24mm; }\ncol.col-phone    { width: 22mm; }\ncol.col-collat   { width: 24mm; }\ncol.col-loan     { width: 20mm; }\ncol.col-interest { width: 18mm; }\ncol.col-paid     { width: 12mm; }\ncol.col-type     { width: 11mm; }\ncol.col-status   { width: 12mm; }\ncol.col-store    { width: 16mm; }\n.print-warning { background: #fef3c7; color: #d97706; padding: 8px; margin-bottom: 12px; border-radius: 4px; font-size: 8pt; text-align: center; }\n@media print { @page { size: A4 landscape; margin: 8mm; } body { margin: 0; padding: 0; } .print-container { padding: 0; } }\n</style>\n</head>\n<body>\n<div class="print-container">\n<div class="print-header">\n<div class="logo">\n<img src="icons/pagehead-logo.png" alt="JF!" onerror="this.style.display=\'none\'">\nJF! by Gadai\n</div>\n<div class="print-header-info">\n🏪 ' + (isAdmin ? (lang === 'id' ? 'Pusat' : '总部') : (lang === 'id' ? 'Toko: ' : '门店：') + Utils.escapeHtml(storeName)) + ' &nbsp;|&nbsp; 👤 ' + Utils.escapeHtml(roleText) + ' &nbsp;|&nbsp; 📅 ' + printDateTime + '\n</div>\n</div>\n' + (totalCount > MAX_PRINT_ORDERS ? '<div class="print-warning">⚠️ ' + (lang === 'id' ? '仅打印 ' + orders.length + ' 条（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。' : '仅打印 ' + orders.length + ' 条（共 ' + totalCount + ' 条）。请使用筛选条件分批打印。') + '</div>\n' : '') + '<div class="page-title">📋 ' + (lang === 'id' ? 'Daftar Pesanan' : '订单列表') + ' &nbsp;<small style="font-size:8pt;font-weight:normal;color:#64748b;">' + (lang === 'id' ? 'Total' : '共') + ' ' + orders.length + ' ' + (lang === 'id' ? 'data' : '条') + '</small></div>\n<table>\n<colgroup>\n<col class="col-id">\n<col class="col-start">\n<col class="col-customer">\n<col class="col-phone">\n<col class="col-collat">\n<col class="col-loan">\n<col class="col-interest">\n<col class="col-paid">\n<col class="col-type">\n<col class="col-status">\n<col class="col-status">\n<col class="col-status">\n' + (isAdmin ? '<col class="col-store">' : '') + '\n</colgroup>\n<thead>' + headerHtml + '</thead>\n<tbody>' + rows + '</tbody>\n</table>\n<div class="print-footer">JF! by Gadai — ' + (lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统') + ' &nbsp;|&nbsp; 1/1</div>\n</div>\n<script>\nwindow.onload = function() { window.print(); setTimeout(function() { window.close(); }, 800); };\n<\/script>\n</body>\n</html>');
                printWindow.document.close();
            } catch (error) {
                console.error('打印订单列表失败:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal mencetak daftar pesanan' : '打印订单列表失败');
            }
        },

        renderViewOrderHTML: async function(orderId) {
            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            let profile = await SUPABASE.getCurrentProfile();
            let result = await SUPABASE.getPaymentHistory(orderId);
            let isAdmin = PERMISSION.isAdmin();
            let order = result.order;
            let payments = result.payments;
            if (!order) throw new Error('order_not_found');
            let statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            let methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
            let remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            let monthlyRate = order.agreed_interest_rate || 0.10;
            let currentMonthlyInterest = remainingPrincipal * monthlyRate;
            let nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
            let adminFeeStatus = order.admin_fee === 0 ? (lang === 'id' ? 'Gratis' : '免费') : (order.admin_fee_paid ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : '❌ ' + (lang === 'id' ? 'Belum' : '未缴'));
            let serviceFeeAmount = order.service_fee_amount || 0;
            let serviceFeePaid = order.service_fee_paid || 0;
            let serviceFeeStatus = serviceFeeAmount === 0 ? (lang === 'id' ? 'Gratis' : '免费') : (serviceFeePaid >= serviceFeeAmount ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : '❌ ' + (lang === 'id' ? 'Belum' : '未缴'));

            // 建立订单日期（优先使用 custom_order_date，否则用 created_at）
            let orderStartDate = order.custom_order_date
                ? Utils.formatDate(order.custom_order_date)
                : (order.created_at ? Utils.formatDate(order.created_at) : '-');

            // 到期日：订单起始日 + 还款期数（月）
            let maturityDateStr = '-';
            if (order.repayment_type === 'fixed' && order.repayment_term) {
                let startRaw = order.custom_order_date || order.created_at;
                if (startRaw) {
                    let matDate = new Date(startRaw);
                    matDate.setMonth(matDate.getMonth() + (order.repayment_term || 0));
                    maturityDateStr = Utils.formatDate(matDate.toISOString().substring(0, 10));
                }
            }

            let repaymentInfoHtml = ''; // 将在 interestCount 计算完后赋值
            // 分离利息和本金表格展示，便于阅读
            let interestRows = '', principalRows = '';
            let interestCount = 0, principalCount = 0;
            for (var j = 0; j < (payments || []).length; j++) {
                let pj = payments[j];
                if (pj.type === 'interest') {
                    interestCount++;
                    let methodClassInt = pj.payment_method === 'cash' ? 'cash' : 'bank';
                    interestRows += '<tr>' +
                        '<td class="text-center">' + interestCount + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(pj.date) + '</td>' +
                        '<td class="text-center">' + (order.repayment_type === 'fixed' ? (lang === 'id' ? 'Ke-' + interestCount : '第 ' + interestCount + ' 次') : ((pj.months || 1) + ' ' + t('month'))) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(pj.amount) + '</td>' +
                        '<td class="text-center"><span class="badge badge--' + methodClassInt + '">' + (methodMap[pj.payment_method] || '-') + '</span></td>' +
                        '</tr>';
                } else if (pj.type === 'principal') {
                    principalCount++;
                    let methodClassPr = pj.payment_method === 'cash' ? 'cash' : 'bank';
                    principalRows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(pj.date) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(pj.amount) + '</td>' +
                        '<td class="text-center"><span class="badge badge--' + methodClassPr + '">' + (methodMap[pj.payment_method] || '-') + '</span></td>' +
                        '</tr>';
                }
            }
            if (interestRows === '') interestRows = '<tr><td colspan="5" class="text-center">' + t('no_data') + '</td></tr>';
            if (principalRows === '') principalRows = '<tr><td colspan="3" class="text-center">' + t('no_data') + '</td></tr>';

            // 修复：repaymentInfoHtml 在 interestCount 确定后构建，确保「已还次数」与「还款记录」一致
            if (order.repayment_type === 'fixed') {
                let totalMonths = order.repayment_term || 0;
                let fixedPayment = order.monthly_fixed_payment || 0;
                let paidCount = interestCount;                          // 以实际还款记录数为准
                let remainingCount = Math.max(0, totalMonths - paidCount);
                repaymentInfoHtml =
                    '<p><strong>' + t('repayment_type') + ':</strong> 📅 ' + t('fixed_repayment') + ' (' + totalMonths + ' ' + (lang === 'id' ? 'kali' : '次') + ')</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Tanggal Mulai' : '建立订单日期') + ':</strong> ' + orderStartDate + '</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Tanggal Jatuh Tempo' : '合同到期日') + ':</strong> ' + maturityDateStr + '</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Angsuran Per Kali' : '每次还款额') + ':</strong> <strong style="color:var(--color-primary)">' + Utils.formatCurrency(fixedPayment) + '</strong></p>' +
                    '<p><strong>' + (lang === 'id' ? 'Kali Terbayar / Sisa' : '已还次数 / 剩余次数') + ':</strong> ' +
                        '<span style="color:var(--color-success)">✅ ' + paidCount + ' ' + (lang === 'id' ? 'kali' : '次') + '</span>' +
                        ' / ' +
                        '<span style="color:var(--color-warning)">⏳ ' + remainingCount + ' ' + (lang === 'id' ? 'kali' : '次') + '</span>' +
                    '</p>';
            } else {
                repaymentInfoHtml =
                    '<p><strong>' + t('repayment_type') + ':</strong> 💰 ' + t('flexible_repayment') + ' (' + (lang === 'id' ? 'Maks. perpanjangan 10 bulan' : '最长延期10个月') + ')</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Tanggal Mulai' : '建立订单日期') + ':</strong> ' + orderStartDate + '</p>';
            }

            let content = '' +
                '<div class="page-header">' +
                '<h2>📄 ' + t('order_details') + '</h2>' +
                '<div class="header-actions">' +
                '<button onclick="APP.navigateTo(\'orderTable\')" class="btn btn--outline">↩️ ' + t('back') + '</button>' +
                '<button onclick="APP.printOrder(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--outline">🖨️ ' + t('print') + '</button>' +
                '</div>' +
                '</div>' +
                '<div class="card">' +
                '<div class="order-detail-grid">' +
                '<div class="info-column">' +
                '<h3>📋 ' + (lang === 'id' ? 'Informasi Pesanan' : '订单信息') + '</h3>' +
                '<p><strong>' + t('order_id') + ':</strong> ' + Utils.escapeHtml(order.order_id) + '</p>' +
                '<p><strong>' + t('status') + ':</strong> <span class="badge badge--' + order.status + '">' + (statusMap[order.status] || order.status) + '</span></p>' +
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
                '<p><strong>' + t('admin_fee') + ':</strong> ' + Utils.formatCurrency(order.admin_fee) + ' — ' + adminFeeStatus + '</p>' +
                '<p><strong>' + t('service_fee') + ':</strong> ' + Utils.formatCurrency(order.service_fee_amount || 0) + ' (' + (order.service_fee_percent || 0) + '%) — ' + serviceFeeStatus + '</p>' +
                (order.repayment_type !== 'fixed' ?
                    '<p><strong>' + (lang === 'id' ? 'Bunga Bulanan (Saat Ini)' : '月利息（当前）') + ':</strong> ' + Utils.formatCurrency(currentMonthlyInterest) + ' <small>（' + (lang === 'id' ? 'Berdasarkan sisa pokok' : '基于剩余本金') + ' ' + Utils.formatCurrency(remainingPrincipal) + ' × ' + (monthlyRate*100).toFixed(0) + '%）</small></p>' +
                    '<p><strong>' + (lang === 'id' ? 'Bunga Terbayar' : '已付利息') + ':</strong> ' + order.interest_paid_months + ' ' + (lang === 'id' ? 'bulan' : '个月') + ' (' + Utils.formatCurrency(order.interest_paid_total) + ')</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Sisa Pokok' : '剩余本金') + ':</strong> ' + Utils.formatCurrency(remainingPrincipal) + '</p>' +
                    '<p><strong>' + t('payment_due_date') + ':</strong> ' + nextDueDate + '</p>'
                :
                    '<p><strong>' + t('notes') + ':</strong> ' + Utils.escapeHtml(order.notes || '-') + '</p>'
                ) +
                (order.repayment_type !== 'fixed' ? '<p><strong>' + t('notes') + ':</strong> ' + Utils.escapeHtml(order.notes || '-') + '</p>' : '') +
                '</div>' +
                '</div>' +
                '<div class="info-bar info"><span class="info-bar-icon">💡</span><div class="info-bar-content"><strong>' + (lang === 'id' ? 'Catatan Penting:' : '温馨提示：') + '</strong> ' +
                (order.repayment_type === 'fixed'
                    ? (lang === 'id' ? 'Setiap angsuran mencakup bunga dan pokok. Pelunasan dipercepat dapat mengurangi sisa bunga.' : '每期还款已包含本金和利息，提前结清可减免剩余利息。')
                    : (lang === 'id' ? 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pelunasan pokok lebih awal dapat mengurangi beban bunga.' : '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。')
                ) + '</div></div>' +
                '<div style="display: flex; gap: 24px; flex-wrap: wrap; margin-top: 16px;">' +
                '<div style="flex: 1; min-width: 280px;">' +
                '<h3>📋 ' + (order.repayment_type === 'fixed' ? (lang === 'id' ? 'Catatan Pembayaran' : '还款记录') : t('interest_history')) + '</h3>' +
                '<div class="table-container"><table class="data-table"><thead><tr><th class="text-center" style="width:50px;">' + (order.repayment_type === 'fixed' ? (lang === 'id' ? 'Ke-' : '次') : t('times')) + '</th><th class="col-date">' + t('date') + '</th><th class="col-months text-center">' + (order.repayment_type === 'fixed' ? (lang === 'id' ? 'Kali' : '次数') : t('month')) + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + t('payment_method') + '</th></tr></thead><tbody>' + interestRows + '</tbody></table></div>' +
                '</div>' +
                (order.repayment_type !== 'fixed' ?
                '<div style="flex: 1; min-width: 280px;">' +
                '<h3>🏦 ' + t('principal_history') + '</h3>' +
                '<div class="table-container"><table class="data-table"><thead><tr><th class="col-date">' + t('date') + '</th><th class="col-amount amount">' + t('amount') + '</th><th class="col-method text-center">' + t('payment_method') + '</th></tr></thead><tbody>' + principalRows + '</tbody></table></div>' +
                '</div>' : '') +
                '</div>' +
                '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;" class="no-print">' +
                '<button onclick="APP.navigateTo(\'orderTable\')" class="btn btn--outline">↩️ ' + t('back') + '</button>' +
                (order.status === 'active' && !isAdmin ? '<button onclick="APP.navigateTo(\'payment\',{orderId:\'' + Utils.escapeHtml(order.order_id) + '\'})" class="btn btn--success">💸 ' + (lang === 'id' ? 'Bayar Biaya' : '缴纳费用') + '</button>' : '') +
                (order.status === 'completed' ? '<button onclick="APP.printSettlementReceipt(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--success">🧾 ' + (lang === 'id' ? 'Bukti Lunas' : '结清凭证') + '</button>' : '') +
                '<button onclick="APP.sendWAReminder(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--warning">📱 ' + (lang === 'id' ? 'Reminder WA' : 'WA提醒') + '</button>' +
                (isAdmin ? '<button onclick="APP.repairOrderFees(\'' + Utils.escapeHtml(order.order_id) + '\')" class="btn btn--outline" style="border-color:#f59e0b;color:#b45309;" title="' + (lang === 'id' ? 'Bersihkan dan sinkronkan catatan biaya admin/layanan sesuai nilai di pesanan' : '清理并同步管理费/服务费流水，使其与订单数据保持一致') + '">🔧 ' + (lang === 'id' ? 'Perbaiki Biaya' : '修复费用流水') + '</button>' : '') +
                '</div>' +
                '</div>';
            return content;
        }
    };

    JF.OrdersPage = OrdersPage;

    if (window.APP) {
        window.APP.showOrderTable = OrdersPage.showOrderTable.bind(OrdersPage);
        window.APP.loadMoreOrders = OrdersPage.loadMoreOrders.bind(OrdersPage);
        window.APP.goToOrderPage = OrdersPage.goToOrderPage.bind(OrdersPage);
        window.APP.changeOrderPageSize = OrdersPage.changeOrderPageSize.bind(OrdersPage);
        JF.OrdersPage = OrdersPage;
        window.APP.payOrder = OrdersPage.payOrder.bind(OrdersPage);
        window.APP.filterOrders = OrdersPage.filterOrders.bind(OrdersPage);
        window.APP.viewOrder = OrdersPage.viewOrder.bind(OrdersPage);
        window.APP.deleteOrder = OrdersPage.deleteOrder.bind(OrdersPage);
        window.APP.printOrder = OrdersPage.printOrder.bind(OrdersPage);
        window.APP.showPaymentHistory = OrdersPage.showPaymentHistory.bind(OrdersPage);
        window.APP.printAllOrders = OrdersPage.printAllOrders.bind(OrdersPage);
        window.APP.repairOrderFees = async function(orderId) {
            let lang = Utils.lang;
            let confirmed = await Utils.toast.confirm(lang === 'id'
                ? '🔧 Perbaiki Catatan Biaya\n\nIni akan menghapus dan menyinkronkan ulang catatan biaya admin/layanan di pesanan ' + orderId + ' sesuai nilai yang tersimpan di pesanan.\n\nLanjutkan?'
                : '🔧 修复费用流水\n\n将清理并重新同步订单 ' + orderId + ' 的管理费/服务费缴费记录，使其与订单中保存的金额保持一致。\n\n确认执行？');
            if (!confirmed) return;
            try {
                await SUPABASE.repairOrderFees(orderId);
                if (window.JF && JF.Cache) JF.Cache.clear();
                Utils.toast.success(lang === 'id' ? '✅ Biaya berhasil diperbaiki!' : '✅ 费用流水已修复！');
                await JF.OrdersPage.viewOrder(orderId);
            } catch (e) {
                Utils.toast.error(e.message || (lang === 'id' ? 'Gagal memperbaiki biaya' : '修复失败'));
            }
        };
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
        let style = document.createElement('style');
        style.id = 'orderOverdueStyle';
        style.textContent = '\n            .order-row--overdue { background-color: #fef2f2 !important; border-left: 3px solid #ef4444; }\n            .order-row--overdue:hover { background-color: #fee2e2 !important; }\n            .badge--overdue { background: #fee2e2; color: #dc2626; }\n            .order-row.row-selected { background-color: var(--primary-soft) !important; border-left: 3px solid var(--primary); }\n            .order-row--overdue.row-selected { background-color: #fde68a !important; border-left: 3px solid var(--warning); }\n        ';
        document.head.appendChild(style);
    }
})();

// ==================== 管理员修改订单模块（完整实现，支持逐条编辑利息/本金记录） ====================
(function() {
    if (!window.JF) window.JF = {};

    let _editPayments = [];
    let _nextTmpId = -1;

    let AdminEditOrder = {

        _renderPaymentEditor: function(lang) {
            let interest  = _editPayments.filter(function(p){ return p.type === 'interest'  && !p._deleted; });
            let principal = _editPayments.filter(function(p){ return p.type === 'principal' && !p._deleted; });
            let methodOpts = '<option value="cash">' + (lang === 'id' ? 'Tunai' : '现金') + '</option>' +
                             '<option value="bank">' + (lang === 'id' ? 'Bank' : '银行') + '</option>';

            function rowHtml(p) {
                let mid = 'pm_' + (p.id < 0 ? 'new' + Math.abs(p.id) : p.id);
                let isInterest = p.type === 'interest';
                let mthHtml = isInterest
                    ? '<input type="number" id="' + mid + '_months" value="' + (p.months || 1) + '" min="1" max="12" step="1" style="width:60px;padding:5px 6px;border-radius:5px;border:1px solid var(--border-light);font-size:13px;" title="' + (lang === 'id' ? 'Periode' : '期数') + '">'
                    : '<span style="color:var(--text-muted);font-size:12px;">—</span>';
                let methodSel = '<select id="' + mid + '_method" style="padding:5px 6px;border-radius:5px;border:1px solid var(--border-light);font-size:13px;">' +
                    methodOpts.replace('value="' + p.payment_method + '"', 'value="' + p.payment_method + '" selected') +
                    '</select>';
                return '<tr id="' + mid + '_row" style="border-bottom:1px solid var(--border-light);">' +
                    '<td style="padding:7px 8px;"><input type="date" id="' + mid + '_date" value="' + (p.date || '') + '" style="padding:5px 6px;border-radius:5px;border:1px solid var(--border-light);font-size:13px;"></td>' +
                    '<td style="padding:7px 8px;"><input type="text" id="' + mid + '_amount" value="' + Utils.formatNumberWithCommas(p.amount || 0) + '" class="amount-input" style="width:130px;padding:5px 6px;border-radius:5px;border:1px solid var(--border-light);font-size:13px;"></td>' +
                    '<td style="padding:7px 8px;">' + mthHtml + '</td>' +
                    '<td style="padding:7px 8px;">' + methodSel + '</td>' +
                    '<td style="padding:7px 8px;"><input type="text" id="' + mid + '_desc" value="' + Utils.escapeHtml(p.description || '') + '" placeholder="' + (lang === 'id' ? 'Catatan (opsional)' : '备注（可选）') + '" style="width:100%;padding:5px 6px;border-radius:5px;border:1px solid var(--border-light);font-size:13px;"></td>' +
                    '<td style="padding:7px 8px;text-align:center;">' +
                    '<button onclick="JF.AdminEditOrder._deletePaymentRow(' + p.id + ')" style="background:var(--danger);color:#fff;border:none;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:12px;">🗑️</button>' +
                    '</td>' +
                    '</tr>';
            }

            let iRows = interest.length ? interest.map(rowHtml).join('') :
                '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px;">' + (lang === 'id' ? 'Belum ada catatan' : '暂无记录') + '</td></tr>';
            let pRows = principal.length ? principal.map(rowHtml).join('') :
                '<tr><td colspan="6" style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px;">' + (lang === 'id' ? 'Belum ada catatan' : '暂无记录') + '</td></tr>';

            let thStyle = 'style="padding:7px 8px;background:var(--bg-hover);font-size:12px;font-weight:600;color:var(--text-secondary);white-space:nowrap;"';
            let tableHead = '<thead><tr>' +
                '<th ' + thStyle + '>' + (lang === 'id' ? 'Tanggal' : '日期') + '</th>' +
                '<th ' + thStyle + '>' + (lang === 'id' ? 'Jumlah (Rp)' : '金额 (Rp)') + '</th>' +
                '<th ' + thStyle + '>' + (lang === 'id' ? 'Periode' : '期数') + '</th>' +
                '<th ' + thStyle + '>' + (lang === 'id' ? 'Metode' : '方式') + '</th>' +
                '<th ' + thStyle + '>' + (lang === 'id' ? 'Catatan' : '备注') + '</th>' +
                '<th ' + thStyle + '>' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' +
                '</tr></thead>';

            let today = Utils.getLocalToday();

            return '<div class="form-section" id="payment_editor_section">' +
                '<div class="form-section-title"><span class="section-icon">💰</span> ' + (lang === 'id' ? 'Catatan Pembayaran Bunga (edit per baris)' : '利息缴纳记录（逐条编辑）') + '</div>' +
                '<div style="overflow-x:auto;margin-bottom:10px;">' +
                '<table style="width:100%;border-collapse:collapse;" id="interest_records_table">' +
                tableHead + '<tbody id="interest_rows">' + iRows + '</tbody>' +
                '</table></div>' +
                '<button onclick="JF.AdminEditOrder._addPaymentRow(\'interest\')" style="background:var(--primary);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;margin-bottom:18px;">＋ ' + (lang === 'id' ? 'Tambah Catatan Bunga' : '新增利息记录') + '</button>' +
                '<div class="form-section-title" style="margin-top:4px;"><span class="section-icon">🏦</span> ' + (lang === 'id' ? 'Catatan Pengembalian Pokok (edit per baris)' : '返还本金记录（逐条编辑）') + '</div>' +
                '<div style="overflow-x:auto;margin-bottom:10px;">' +
                '<table style="width:100%;border-collapse:collapse;" id="principal_records_table">' +
                tableHead + '<tbody id="principal_rows">' + pRows + '</tbody>' +
                '</table></div>' +
                '<button onclick="JF.AdminEditOrder._addPaymentRow(\'principal\')" style="background:var(--success);color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;">＋ ' + (lang === 'id' ? 'Tambah Catatan Pokok' : '新增本金记录') + '</button>' +
                '</div>';
        },

        _deletePaymentRow: function(pid) {
            let p = _editPayments.find(function(x){ return x.id === pid; });
            if (!p) return;
            p._deleted = true;
            let mid = 'pm_' + (pid < 0 ? 'new' + Math.abs(pid) : pid);
            let row = document.getElementById(mid + '_row');
            if (row) row.style.display = 'none';
        },

        _addPaymentRow: function(type) {
            let lang = Utils.lang;
            let today = Utils.getLocalToday();
            let newRec = { id: _nextTmpId--, type: type, date: today, amount: 0, payment_method: 'cash', months: 1, description: '', _new: true };
            _editPayments.push(newRec);
            let tbody = document.getElementById(type === 'interest' ? 'interest_rows' : 'principal_rows');
            if (!tbody) return;
            let emptyRow = tbody.querySelector('td[colspan]');
            if (emptyRow) emptyRow.closest('tr').remove();
            let sec = document.getElementById('payment_editor_section');
            if (sec) sec.outerHTML = AdminEditOrder._renderPaymentEditor(lang);
            AdminEditOrder._bindPaymentAmountInputs();
        },

        _bindPaymentAmountInputs: function() {
            _editPayments.filter(function(p){ return !p._deleted; }).forEach(function(p) {
                let mid = 'pm_' + (p.id < 0 ? 'new' + Math.abs(p.id) : p.id);
                let el = document.getElementById(mid + '_amount');
                if (el && Utils.bindAmountFormat) Utils.bindAmountFormat(el);
            });
        },

        _collectPaymentEdits: function() {
            let toDelete = [], toUpdate = [], toAdd = [];
            _editPayments.forEach(function(p) {
                let mid = 'pm_' + (p.id < 0 ? 'new' + Math.abs(p.id) : p.id);
                if (p._deleted) {
                    if (!p._new) toDelete.push(p.id);
                    return;
                }
                let dateEl   = document.getElementById(mid + '_date');
                let amtEl    = document.getElementById(mid + '_amount');
                let mthEl    = document.getElementById(mid + '_months');
                let methEl   = document.getElementById(mid + '_method');
                let descEl   = document.getElementById(mid + '_desc');
                let date   = dateEl   ? dateEl.value   : p.date;
                let amount = amtEl    ? (Utils.parseNumberFromCommas(amtEl.value) || 0) : p.amount;
                let months = mthEl    ? (parseInt(mthEl.value) || 1) : p.months;
                let method = methEl   ? methEl.value   : p.payment_method;
                let desc   = descEl   ? descEl.value.trim() : p.description;

                if (p._new) {
                    toAdd.push({ type: p.type, date: date, amount: amount, payment_method: method, months: months, description: desc });
                } else {
                    toUpdate.push({ id: p.id, date: date, amount: amount, payment_method: method, months: months, description: desc });
                }
            });
            return { toDelete: toDelete, toUpdate: toUpdate, toAdd: toAdd };
        },

        adminEditOrder: async function(orderId) {
            if (!PERMISSION.isAdmin()) {
                Utils.toast.error(Utils.lang === 'id' ? 'Hanya admin yang dapat mengedit pesanan' : '仅管理员可修改订单');
                return;
            }
            let lang = Utils.lang;
            let t = Utils.t.bind(Utils);
            try {
                let order = await SUPABASE.getOrder(orderId);
                if (!order) throw new Error('订单不存在');
                await SUPABASE.unlockOrder(orderId);

                let histResult = await SUPABASE.getPaymentHistory(orderId);
                _editPayments = (histResult.payments || [])
                    .filter(function(p){ return p.type === 'interest' || p.type === 'principal'; })
                    .map(function(p){ return {
                        id: p.id, type: p.type,
                        date: (p.date || '').substring(0, 10),
                        amount: p.amount || 0,
                        payment_method: p.payment_method || 'cash',
                        months: p.months || 1,
                        description: p.description || '',
                        _deleted: false, _new: false
                    }; });
                _nextTmpId = -1;

                let today = Utils.getLocalToday();
                let orderDateStr = order.custom_order_date || (order.created_at || '').substring(0, 10) || today;
                let remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);

                let paymentEditorHtml = this._renderPaymentEditor(lang);

                document.getElementById('app').innerHTML =
                    '<div class="page-header">' +
                    '<h2>✏️ ' + (lang === 'id' ? 'Edit Pesanan' : '修改订单') + ' — ' + Utils.escapeHtml(orderId) + '</h2>' +
                    '<div class="header-actions">' +
                    '<button onclick="JF.AdminEditOrder.adminCancelEdit(\'' + Utils.escapeHtml(orderId) + '\')" class="btn btn--outline">↩️ ' + t('cancel') + '</button>' +
                    '</div></div>' +
                    '<div class="card">' +
                    '<div class="info-bar warning"><span class="info-bar-icon">⚠️</span>' +
                    '<div class="info-bar-content"><strong>' + (lang === 'id' ? 'Mode Edit Admin' : '管理员编辑模式') + '：</strong>' +
                    (lang === 'id' ? 'Pesanan dibuka sementara, akan dikunci otomatis setelah disimpan. Perubahan catatan pembayaran akan langsung mempengaruhi ringkasan bunga/pokok.' : '订单已临时解锁，保存后自动重新锁定。缴费记录的修改将直接影响利息/本金汇总统计。') + '</div></div>' +

                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">📋</span> ' + (lang === 'id' ? 'Informasi Dasar' : '基本信息') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + (lang === 'id' ? 'Tanggal Pesanan' : '订单日期') + '</label>' +
                    '<input type="date" id="edit_order_date" value="' + orderDateStr + '" max="' + today + '"></div>' +
                    '<div class="form-group"><label>' + t('collateral_name') + '</label>' +
                    '<input type="text" id="edit_collateral" value="' + Utils.escapeHtml(order.collateral_name || '') + '"></div>' +
                    '<div class="form-group"><label>' + t('loan_amount') + '</label>' +
                    '<input type="text" id="edit_loan_amount" class="amount-input" value="' + Utils.formatNumberWithCommas(order.loan_amount || 0) + '"></div>' +
                    '<div class="form-group"><label>' + t('notes') + '</label>' +
                    '<input type="text" id="edit_notes" value="' + Utils.escapeHtml(order.notes || '') + '"></div>' +
                    '</div></div>' +

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
                    '</div></div>' +

                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">💰</span> ' + (lang === 'id' ? 'Rincian Biaya' : '费用明细') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('admin_fee') + ' (Rp)</label>' +
                    '<input type="text" id="edit_admin_fee" class="amount-input" value="' + Utils.formatNumberWithCommas(order.admin_fee || 0) + '">' +
                    '<div class="form-hint">💡 ' + (lang === 'id' ? 'Isi 0 = Gratis' : '填0即为免费') + '</div></div>' +
                    '<div class="form-group"><label>' + t('service_fee') + ' (Rp)</label>' +
                    '<input type="text" id="edit_service_fee" class="amount-input" value="' + Utils.formatNumberWithCommas(order.service_fee_amount || 0) + '">' +
                    '<div class="form-hint">💡 ' + (lang === 'id' ? 'Isi 0 = Gratis' : '填0即为免费') + '</div></div>' +
                    '<div class="form-group"><label>' + t('service_fee') + ' %</label>' +
                    '<input type="number" id="edit_service_fee_percent" value="' + (order.service_fee_percent || 0) + '" min="0" max="10" step="0.5"></div>' +
                    '<div class="form-group"><label>' + (lang === 'id' ? 'Suku Bunga Bulanan (%)' : '月利率 (%)') + '</label>' +
                    '<select id="edit_interest_rate">' + Utils.getInterestRateOptions((order.agreed_interest_rate || 0.10) * 100) + '</select></div>' +
                    '</div></div>' +

                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">📅</span> ' + t('repayment_type') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('repayment_type') + '</label>' +
                    '<select id="edit_repayment_type">' +
                    '<option value="flexible"' + (order.repayment_type === 'flexible' ? ' selected' : '') + '>' + t('flexible_repayment') + '</option>' +
                    '<option value="fixed"' + (order.repayment_type === 'fixed' ? ' selected' : '') + '>' + t('fixed_repayment') + '</option>' +
                    '</select></div>' +
                    '<div class="form-group"><label>' + t('term_months') + ' ' + (lang === 'id' ? '(Cicilan Tetap)' : '（固定期数）') + '</label>' +
                    '<input type="number" id="edit_repayment_term" value="' + (order.repayment_term || '') + '" min="1" max="10" placeholder="' + (lang === 'id' ? 'Kosongkan untuk cicilan bebas' : '灵活还款可留空') + '"></div>' +
                    '<div class="form-group"><label>' + t('monthly_payment') + ' (Rp)</label>' +
                    '<input type="text" id="edit_monthly_payment" class="amount-input" value="' + Utils.formatNumberWithCommas(order.monthly_fixed_payment || 0) + '"></div>' +
                    '<div class="form-group"><label>' + (lang === 'id' ? 'Masa Gadai (Bulan)' : '典当期限（月）') + '</label>' +
                    '<input type="number" id="edit_pawn_term" value="' + (order.pawn_term_months || '') + '" min="1" max="36" placeholder="' + (lang === 'id' ? 'Kosongkan jika tidak ada' : '无则留空') + '"></div>' +
                    '<div class="form-group"><label>' + (lang === 'id' ? 'Maks. Bulan Perpanjangan' : '最大延期月数') + '</label>' +
                    '<input type="number" id="edit_max_extension" value="' + (order.max_extension_months || 10) + '" min="1" max="36"></div>' +
                    '</div></div>' +

                    '<div class="form-section">' +
                    '<div class="form-section-title"><span class="section-icon">💳</span> ' + (lang === 'id' ? 'Status Pembayaran Biaya' : '费用缴纳状态') + '</div>' +
                    '<div class="form-grid">' +
                    '<div class="form-group"><label>' + t('admin_fee') + ' ' + (lang === 'id' ? 'Sudah Dibayar?' : '已缴？') + '</label>' +
                    '<select id="edit_admin_fee_paid">' +
                    '<option value="true"' + (order.admin_fee_paid ? ' selected' : '') + '>' + (lang === 'id' ? '✅ Sudah' : '✅ 已缴') + '</option>' +
                    '<option value="false"' + (!order.admin_fee_paid ? ' selected' : '') + '>' + (lang === 'id' ? '❌ Belum' : '❌ 未缴') + '</option>' +
                    '</select></div>' +
                    '</div></div>' +

                    paymentEditorHtml +

                    '<div class="info-bar info" style="margin-top:4px;"><span class="info-bar-icon">💡</span>' +
                    '<div class="info-bar-content">' + (lang === 'id' ? 'Setelah disimpan, sistem akan menghitung ulang otomatis: jumlah bunga terbayar, total bunga, pokok terbayar, sisa pokok, dan status pesanan.' : '保存后，系统将根据以上缴费记录自动重新计算：已付利息期数、已付利息总额、已还本金、剩余本金、订单状态。') + '</div></div>' +

                    '<div class="form-actions">' +
                    '<button onclick="JF.AdminEditOrder.adminSaveOrder(\'' + Utils.escapeHtml(orderId) + '\')" class="btn btn--success" id="adminSaveBtn">' +
                    '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定') +
                    '</button>' +
                    '<button onclick="JF.AdminEditOrder.adminCancelEdit(\'' + Utils.escapeHtml(orderId) + '\')" class="btn btn--outline">↩️ ' + t('cancel') + '</button>' +
                    '</div></div>';

                ['edit_loan_amount', 'edit_admin_fee', 'edit_service_fee', 'edit_monthly_payment'].forEach(function(id) {
                    let el = document.getElementById(id);
                    if (el && Utils.bindAmountFormat) Utils.bindAmountFormat(el);
                });
                this._bindPaymentAmountInputs();

            } catch (error) {
                console.error('adminEditOrder error:', error);
                Utils.toast.error(error.message || (Utils.lang === 'id' ? 'Gagal membuka pesanan' : '打开订单失败'));
            }
        },

        adminSaveOrder: async function(orderId) {
            if (!PERMISSION.isAdmin()) {
                Utils.toast.error(Utils.lang === 'id' ? 'Hanya admin yang dapat menyimpan perubahan' : '仅管理员可保存修改');
                return;
            }
            let lang = Utils.lang;
            let saveBtn = document.getElementById('adminSaveBtn');
            if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...'); }
            try {
                let loanAmount   = Utils.parseNumberFromCommas(document.getElementById('edit_loan_amount') ? document.getElementById('edit_loan_amount').value : null) || 0;
                let adminFee     = Utils.parseNumberFromCommas(document.getElementById('edit_admin_fee') ? document.getElementById('edit_admin_fee').value : null) || 0;
                let serviceFee   = Utils.parseNumberFromCommas(document.getElementById('edit_service_fee') ? document.getElementById('edit_service_fee').value : null) || 0;
                let servicePct   = parseFloat(document.getElementById('edit_service_fee_percent') ? document.getElementById('edit_service_fee_percent').value : 0) || 0;
                let interestRate = parseFloat(document.getElementById('edit_interest_rate') ? document.getElementById('edit_interest_rate').value : 0) || 10;
                let repayType    = document.getElementById('edit_repayment_type') ? document.getElementById('edit_repayment_type').value : 'flexible';
                let repayTerm    = parseInt(document.getElementById('edit_repayment_term') ? document.getElementById('edit_repayment_term').value : 0) || null;
                let monthlyPmt   = Utils.parseNumberFromCommas(document.getElementById('edit_monthly_payment') ? document.getElementById('edit_monthly_payment').value : null) || 0;
                let pawnTerm     = parseInt(document.getElementById('edit_pawn_term') ? document.getElementById('edit_pawn_term').value : 0) || null;
                let maxExtension = parseInt(document.getElementById('edit_max_extension') ? document.getElementById('edit_max_extension').value : 0) || 10;
                let adminFeePaid = (document.getElementById('edit_admin_fee_paid') ? document.getElementById('edit_admin_fee_paid').value : 'false') === 'true';
                let orderDate    = document.getElementById('edit_order_date') ? (document.getElementById('edit_order_date').value || Utils.getLocalToday()) : Utils.getLocalToday();
                let collateral   = document.getElementById('edit_collateral') ? document.getElementById('edit_collateral').value.trim() : '';
                let custName     = document.getElementById('edit_customer_name') ? document.getElementById('edit_customer_name').value.trim() : '';
                let custKtp      = document.getElementById('edit_customer_ktp') ? document.getElementById('edit_customer_ktp').value.trim() : '';
                let custPhone    = document.getElementById('edit_customer_phone') ? document.getElementById('edit_customer_phone').value.trim() : '';
                let custAddress  = document.getElementById('edit_customer_address') ? document.getElementById('edit_customer_address').value.trim() : '';
                let notes        = document.getElementById('edit_notes') ? document.getElementById('edit_notes').value.trim() : '';

                if (!collateral || loanAmount <= 0) {
                    Utils.toast.warning(lang === 'id' ? 'Nama jaminan dan jumlah pinjaman tidak boleh kosong' : '抵押物和贷款金额不能为空');
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'); }
                    return;
                }

                let payEdits = this._collectPaymentEdits();
                let allRecs = payEdits.toUpdate.concat(payEdits.toAdd);
                for (var ri = 0; ri < allRecs.length; ri++) {
                    let rec = allRecs[ri];
                    if (!rec.date) { Utils.toast.warning(lang === 'id' ? 'Tanggal catatan pembayaran tidak boleh kosong' : '缴费记录日期不能为空'); if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'); } return; }
                    if (!rec.amount || rec.amount <= 0) { Utils.toast.warning(lang === 'id' ? 'Jumlah catatan pembayaran harus lebih dari 0' : '缴费记录金额必须大于0'); if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'); } return; }
                }

                let order = await SUPABASE.getOrder(orderId);
                let agreedRate = interestRate / 100;

                let updates = {
                    collateral_name: collateral, loan_amount: loanAmount,
                    admin_fee: adminFee, admin_fee_paid: adminFeePaid && adminFee > 0,
                    service_fee_amount: serviceFee, service_fee_percent: servicePct,
                    agreed_interest_rate: agreedRate, agreed_service_fee_rate: servicePct / 100,
                    repayment_type: repayType, repayment_term: repayTerm,
                    monthly_fixed_payment: monthlyPmt || null,
                    pawn_term_months: pawnTerm, max_extension_months: maxExtension,
                    customer_name: custName, customer_ktp: custKtp,
                    customer_phone: custPhone, customer_address: custAddress,
                    notes: notes,
                    custom_order_date: orderDate,
                    created_at: orderDate + 'T00:00:00.000Z',
                    updated_at: new Date().toISOString()
                };
                // 同步重算 pawn_due_date：订单日期或典当期限变更时，本金到期日必须随之更新。
                // 否则本金到期提醒和催收判断仍基于旧日期，与 next_interest_due_date 的修复不一致。
                if (repayType === 'flexible' && pawnTerm && pawnTerm > 0) {
                    updates.pawn_due_date = Utils.calculatePawnDueDate(orderDate, pawnTerm);
                } else if (repayType !== 'flexible') {
                    updates.pawn_due_date = null;
                }
                let client = SUPABASE.getClient();
                let res = await client.from('orders').update(updates).eq('order_id', orderId);
                if (res.error) throw res.error;

                await SUPABASE.syncFeesAfterAdminEdit(orderId, adminFee, adminFeePaid && adminFee > 0, serviceFee, orderDate);
                // BUG修复：传入新订单日期，使 adminSyncPaymentRecords 能正确重算
                // next_interest_due_date 和 overdue_days（否则仪表盘逾期状态不会立即更新）
                await SUPABASE.adminSyncPaymentRecords(orderId, payEdits, orderDate);
                // BUG修复：保存后立即重跑逾期计算，不等定时器（每18分钟才触发一次）
                try { await SUPABASE.updateOverdueDays(); } catch(e) { debugLog('[WARN]','[adminSaveOrder] updateOverdueDays 失败:', e.message); }
                await SUPABASE.relockOrder(orderId);

                Utils.toast.success(lang === 'id' ? '✅ Pesanan berhasil diubah dan dikunci kembali!' : '✅ 订单已修改并重新锁定！');
                if (window.JF && JF.Cache) JF.Cache.clear();
                await JF.OrdersPage.viewOrder(orderId);
            } catch (error) {
                console.error('adminSaveOrder error:', error);
                Utils.toast.error(error.message || (lang === 'id' ? 'Gagal menyimpan' : '保存失败'));
                try { await SUPABASE.relockOrder(orderId); } catch(e) {}
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'); }
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
