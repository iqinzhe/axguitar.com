// app-dashboard-orders.js - v2.1 (JF 命名空间) 补全 printOrder 方法

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const OrdersPage = {
        // ==================== 获取订单数据 ====================
        async _fetchOrderData(filters, from, to) {
            const result = await SUPABASE.getOrders(filters, from, to);
            return {
                orders: result.data,
                totalCount: result.totalCount
            };
        },

        // ==================== 构建订单列表 HTML（纯内容） ====================
        async buildOrderTableHTML(filters, currentFrom, pageSize) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();
            const PAGE_SIZE = pageSize || 50;
            let from = currentFrom || 0;
            let to = from + PAGE_SIZE - 1;

            // 获取数据
            const { orders, totalCount } = await this._fetchOrderData(filters, from, to);
            const allOrders = orders;
            let currentFromVal = from + allOrders.length;

            // 获取门店映射
            const stores = await SUPABASE.getAllStores();
            const storeMap = {};
            for (const s of stores) storeMap[s.id] = s.name;

            const totalCols = isAdmin ? 10 : 9;
            const statusMap = {
                active: t('status_active'),
                completed: t('status_completed'),
                liquidated: t('status_liquidated')
            };

            // 构建表格行
            let rows = '';
            for (const o of allOrders) {
                const sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated');
                const storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                const nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                const remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                const currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.08);
                const repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                const repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';

                rows += `<tr>
                    <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                    <td>${Utils.escapeHtml(o.customer_name)}</td>
                    <td>${Utils.escapeHtml(o.collateral_name)}</td>
                    <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                    <td class="amount">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                    <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td class="date-cell text-center">${nextDueDate}</td>
                    <td class="text-center"><span class="badge badge--${repaymentClass}">${repaymentTypeText}</span></td>
                    <td class="text-center"><span class="badge badge--${sc}">${statusMap[o.status] || o.status}</span></td>
                    ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeName)}</td>` : ''}
                </tr>`;

                // 操作行
                let actionButtons = '';
                if (o.status === 'active' && !isAdmin) {
                    actionButtons += `<button onclick="APP.payOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--success btn--sm">💸 ${lang === 'id' ? 'Bayar Biaya' : '缴纳费用'}</button>`;
                }
                actionButtons += `<button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--primary">👁️ ${t('view')}</button>`;
                actionButtons += `<button onclick="APP.printOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--outline">🖨️ ${t('print')}</button>`;
                if (PERMISSION.canDeleteOrder()) {
                    actionButtons += `<button onclick="APP.deleteOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--danger">🗑️ ${t('delete')}</button>`;
                }

                rows += `<tr class="action-row">
                    <td class="action-label">${t('action')}</td>
                    <td colspan="${totalCols - 1}"><div class="action-buttons">${actionButtons}</div></td>
                </tr>`;
            }

            // 加载更多区域
            let loadMoreHtml = '';
            if (currentFromVal < totalCount) {
                const remaining = totalCount - currentFromVal;
                loadMoreHtml = `<tr id="loadMoreRow"><td colspan="${totalCols}" style="text-align:center;padding:14px;"><button onclick="APP.loadMoreOrders()" class="btn btn--primary btn--sm" style="padding:10px 32px;font-size:14px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${remaining} ${lang === 'id' ? 'tersisa' : '剩余'})</button></td></tr>`;
            } else if (totalCount > PAGE_SIZE && allOrders.length > 0) {
                loadMoreHtml = `<tr id="loadMoreRow"><td colspan="${totalCols}" style="text-align:center;padding:14px;color:var(--text-muted);">✅ ${lang === 'id' ? `Semua ${totalCount} pesanan telah dimuat` : `已加载全部 ${totalCount} 条订单`}</td></tr>`;
            }

            // 设置全局分页状态
            window._orderTableState = {
                currentFrom: currentFromVal,
                totalCount,
                allOrders,
                totalCols,
                pageSize: PAGE_SIZE,
                filters,
                storeMap,
                renderOrdersIntoTable: this._renderOrdersIntoTable.bind(this)
            };

            const content = `
                <div class="page-header">
                    <h2>📋 ${t('order_list')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        <button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${t('print')}</button>
                    </div>
                </div>
                <div class="toolbar no-print">
                    <select id="statusFilter" onchange="APP.filterOrders(this.value)">
                        <option value="all" ${filters.status === 'all' ? 'selected' : ''}>${lang === 'id' ? 'Semua Pesanan' : '全部订单'}</option>
                        <option value="active" ${filters.status === 'active' ? 'selected' : ''}>${t('active')}</option>
                        <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>${t('completed')}</option>
                    </select>
                </div>
                <div class="info-bar info">
                    <span class="info-bar-icon">📌</span>
                    <div class="info-bar-content"><strong>${lang === 'id' ? 'Total' : '共'} ${totalCount} ${lang === 'id' ? 'pesanan' : '条订单'}</strong> — ${lang === 'id' ? `Menampilkan ${Math.min(PAGE_SIZE, totalCount)} pertama` : `显示前 ${Math.min(PAGE_SIZE, totalCount)} 条`}</div>
                </div>
                <div class="card">
                    <div class="table-container">
                        <table class="data-table order-table">
                            <thead>
                                <tr>
                                    <th class="col-id">${t('order_id')}</th>
                                    <th class="col-name">${t('customer_name')}</th>
                                    <th>${t('collateral_name')}</th>
                                    <th class="col-amount amount">${t('loan_amount')}</th>
                                    <th class="col-amount amount">${lang === 'id' ? 'Bunga Bulanan' : '月利息'}</th>
                                    <th class="col-months text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                                    <th class="col-date text-center">${t('payment_due_date')}</th>
                                    <th class="col-status text-center">${t('repayment_type')}</th>
                                    <th class="col-status text-center">${t('status')}</th>
                                    ${isAdmin ? `<th class="col-store text-center">${t('store')}</th>` : ''}
                                </tr>
                            </thead>
                            <tbody id="orderTableBody">${rows}${loadMoreHtml}</tbody>
                        </table>
                    </div>
                </div>`;
            return content;
        },

        // 辅助：追加渲染订单行
        _renderOrdersIntoTable(orders, append) {
            const tbody = document.getElementById('orderTableBody');
            if (!tbody) return;

            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();
            const state = window._orderTableState;
            if (!state) return;

            const storeMap = state.storeMap || {};
            const totalCols = state.totalCols;
            const statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };

            let rows = '';
            for (const o of orders) {
                const sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated');
                const storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                const nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                const remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                const currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.08);
                const repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                const repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';

                rows += `<tr>
                    <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                    <td>${Utils.escapeHtml(o.customer_name)}</td>
                    <td>${Utils.escapeHtml(o.collateral_name)}</td>
                    <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                    <td class="amount">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                    <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td class="date-cell text-center">${nextDueDate}</td>
                    <td class="text-center"><span class="badge badge--${repaymentClass}">${repaymentTypeText}</span></td>
                    <td class="text-center"><span class="badge badge--${sc}">${statusMap[o.status] || o.status}</span></td>
                    ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeName)}</td>` : ''}
                </tr>`;

                let actionButtons = '';
                if (o.status === 'active' && !isAdmin) {
                    actionButtons += `<button onclick="APP.payOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--success btn--sm">💸 ${lang === 'id' ? 'Bayar Biaya' : '缴纳费用'}</button>`;
                }
                actionButtons += `<button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--primary">👁️ ${t('view')}</button>`;
                actionButtons += `<button onclick="APP.printOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--outline">🖨️ ${t('print')}</button>`;
                if (PERMISSION.canDeleteOrder()) {
                    actionButtons += `<button onclick="APP.deleteOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--danger">🗑️ ${t('delete')}</button>`;
                }

                rows += `<tr class="action-row">
                    <td class="action-label">${t('action')}</td>
                    <td colspan="${totalCols - 1}"><div class="action-buttons">${actionButtons}</div></td>
                </tr>`;
            }

            if (append) {
                const loadMoreRow = document.getElementById('loadMoreRow');
                if (loadMoreRow) loadMoreRow.remove();
                tbody.insertAdjacentHTML('beforeend', rows);
            } else {
                tbody.innerHTML = rows;
            }
        },

        // ==================== 供外壳调用的渲染函数 ====================
        async renderOrderTableHTML(filters) {
            const mergedFilters = Object.assign({ status: 'all' }, filters || {});
            return await this.buildOrderTableHTML(mergedFilters, 0, 50);
        },

        // ==================== 订单详情 HTML ====================
        async renderViewOrderHTML(orderId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();

            const result = await SUPABASE.getPaymentHistory(orderId);
            const order = result.order;
            const payments = result.payments;
            if (!order) throw new Error('order_not_found');

            const statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            const methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const monthlyRate = order.agreed_interest_rate || 0.08;
            const currentMonthlyInterest = remainingPrincipal * monthlyRate;
            const nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';

            // 还款方式信息
            let repaymentInfoHtml = '';
            if (order.repayment_type === 'fixed') {
                const paidMonths = order.fixed_paid_months || 0;
                const totalMonths = order.repayment_term;
                const fixedPayment = order.monthly_fixed_payment || 0;
                repaymentInfoHtml = `<p><strong>${t('repayment_type')}:</strong> 📅 ${t('fixed_repayment')} (${totalMonths} ${lang === 'id' ? 'bulan' : '个月'})</p>
                    <p><strong>${t('monthly_payment')}:</strong> ${Utils.formatCurrency(fixedPayment)}</p>
                    <p><strong>${lang === 'id' ? 'Progress' : '进度'}:</strong> ${paidMonths}/${totalMonths} ${lang === 'id' ? 'bulan' : '个月'}</p>`;
            } else {
                repaymentInfoHtml = `<p><strong>${t('repayment_type')}:</strong> 💰 ${t('flexible_repayment')} (${lang === 'id' ? 'Maksimal perpanjangan 10 bulan' : '最长延期10个月'})</p>`;
            }

            // 缴费记录
            let payRows = '';
            if (payments && payments.length > 0) {
                for (const p of payments) {
                    const typeText = p.type === 'admin_fee' ? t('admin_fee') : p.type === 'service_fee' ? t('service_fee') : p.type === 'interest' ? t('interest') : t('principal');
                    const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    payRows += `<tr><td class="date-cell">${Utils.formatDate(p.date)}</td><td>${typeText}</td><td class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td><td class="amount">${Utils.formatCurrency(p.amount)}</td><td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td><td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td></tr>`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td>`;
            }

            const content = `
                <div class="page-header">
                    <h2>📄 ${t('order_details')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        <button onclick="APP.printOrder('${Utils.escapeAttr(order.order_id)}')" class="btn btn--outline">🖨️ ${t('print')}</button>
                    </div>
                </div>
                <div class="card">
                    <div class="order-detail-grid">
                        <div class="info-column">
                            <h3>📋 ${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                            <p><strong>${t('order_id')}:</strong> ${Utils.escapeHtml(order.order_id)}</p>
                            <p><strong>${t('status')}:</strong> <span class="badge badge--${order.status}">${statusMap[order.status] || order.status}</span></p>
                            <p><strong>${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}:</strong> ${Utils.formatDate(order.created_at)}</p>
                            ${repaymentInfoHtml}
                            <h3 style="margin-top:16px;">👤 ${t('customer_info')}</h3>
                            <p><strong>${t('customer_name')}:</strong> ${Utils.escapeHtml(order.customer_name)}</p>
                            <p><strong>${t('ktp_number')}:</strong> ${Utils.escapeHtml(order.customer_ktp)}</p>
                            <p><strong>${t('phone')}:</strong> ${Utils.escapeHtml(order.customer_phone)}</p>
                            <p><strong>${t('address')}:</strong> ${Utils.escapeHtml(order.customer_address)}</p>
                        </div>
                        <div class="info-column">
                            <h3>💎 ${t('collateral_info')}</h3>
                            <p><strong>${t('collateral_name')}:</strong> ${Utils.escapeHtml(order.collateral_name)}</p>
                            <p><strong>${t('loan_amount')}:</strong> ${Utils.formatCurrency(order.loan_amount)}</p>
                            <h3 style="margin-top:16px;">💰 ${lang === 'id' ? 'Rincian Biaya' : '费用明细'}</h3>
                            <p><strong>${t('admin_fee')}:</strong> ${Utils.formatCurrency(order.admin_fee)} ${order.admin_fee_paid ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : '❌ ' + (lang === 'id' ? 'Belum' : '未缴')}</p>
                            <p><strong>${t('service_fee')}:</strong> ${Utils.formatCurrency(order.service_fee_amount || 0)} (${order.service_fee_percent || 0}%) ${order.service_fee_amount > 0 ? ((order.service_fee_paid || 0) >= (order.service_fee_amount || 0) ? '✅ ' + (lang === 'id' ? 'Lunas' : '已缴') : '❌ ' + (lang === 'id' ? 'Belum' : '未缴')) : '—'}</p>
                            <p><strong>${lang === 'id' ? 'Bunga Bulanan (saat ini)' : '月利息（当前）'}:</strong> ${Utils.formatCurrency(currentMonthlyInterest)} <small>（${lang === 'id' ? 'berdasarkan sisa pokok' : '基于剩余本金'} ${Utils.formatCurrency(remainingPrincipal)} × ${(monthlyRate*100).toFixed(0)}%）</small></p>
                            <p><strong>${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}:</strong> ${order.interest_paid_months} ${lang === 'id' ? 'bulan' : '个月'} (${Utils.formatCurrency(order.interest_paid_total)})</p>
                            <p><strong>${lang === 'id' ? 'Sisa Pokok' : '剩余本金'}:</strong> ${Utils.formatCurrency(remainingPrincipal)}</p>
                            <p><strong>${t('payment_due_date')}:</strong> ${nextDueDate}</p>
                            <p><strong>${t('notes')}:</strong> ${Utils.escapeHtml(order.notes || '-')}</p>
                        </div>
                    </div>
                    <div class="info-bar info"><span class="info-bar-icon">💡</span><div class="info-bar-content"><strong>${lang === 'id' ? 'Tips:' : '温馨提示：'}</strong> ${lang === 'id' ? 'Harap bayar bunga sebelum tanggal jatuh tempo setiap bulan. Pembayaran pokok lebih awal dapat mengurangi beban bunga. Setelah lunas, sistem akan membuat tanda terima pelunasan secara otomatis.' : '请于每月到期日前支付利息。提前偿还本金可有效减少利息负担，结清后系统将自动生成结清凭证。'}</div></div>
                    <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h3>
                    <div class="table-container"><table class="data-table payment-table"><thead><tr><th class="col-date">${t('date')}</th><th class="col-type">${t('type')}</th><th class="col-months text-center">${lang === 'id' ? 'Bulan' : '月数'}</th><th class="col-amount amount">${t('amount')}</th><th class="col-method text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th><th class="col-desc">${t('description')}</th></tr></thead><tbody>${payRows}</tbody></table></div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;" class="no-print">
                        <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        ${order.status === 'active' && !isAdmin ? `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeAttr(order.order_id)}'})" class="btn btn--success">💸 ${lang === 'id' ? 'Bayar Biaya' : '缴纳费用'}</button>` : ''}
                        ${order.status === 'completed' ? `<button onclick="APP.printSettlementReceipt('${Utils.escapeAttr(order.order_id)}')" class="btn btn--success">🧾 ${lang === 'id' ? '结清凭证' : '结清凭证'}</button>` : ''}
                        <button onclick="APP.sendWAReminder('${Utils.escapeAttr(order.order_id)}')" class="btn btn--warning">📱 ${lang === 'id' ? 'WA提醒' : 'WA提醒'}</button>
                    </div>
                </div>`;
            return content;
        },

        // ==================== 原有的 showOrderTable（兼容直接调用） ====================
        async showOrderTable() {
            APP.currentPage = 'orderTable';
            APP.saveCurrentPageState();
            const filters = { status: APP.currentFilter || 'all' };
            const contentHTML = await this.buildOrderTableHTML(filters, 0, 50);
            document.getElementById("app").innerHTML = contentHTML;
        },

        // ==================== 加载更多订单 ====================
        async loadMoreOrders() {
            const state = window._orderTableState;
            if (!state) return;
            const lang = Utils.lang;
            const loadMoreBtn = document.querySelector('#loadMoreRow button');
            if (loadMoreBtn) { loadMoreBtn.disabled = true; loadMoreBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...'); }

            try {
                const { orders, totalCount } = await this._fetchOrderData(state.filters, state.currentFrom, state.currentFrom + state.pageSize - 1);
                state.allOrders = state.allOrders.concat(orders);
                state.currentFrom += orders.length;
                state.totalCount = totalCount;

                this._renderOrdersIntoTable(orders, true);
                this._updateLoadMoreRow();
            } catch (err) {
                console.error("loadMoreOrders error:", err);
                if (loadMoreBtn) { loadMoreBtn.disabled = false; loadMoreBtn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'); }
                Utils.toast.error(lang === 'id' ? 'Gagal memuat lebih banyak' : '加载更多失败');
            }
        },

        _updateLoadMoreRow() {
            const state = window._orderTableState;
            if (!state) return;
            const tbody = document.getElementById('orderTableBody');
            if (!tbody) return;
            const existingRow = document.getElementById('loadMoreRow');
            if (existingRow) existingRow.remove();

            const lang = Utils.lang;
            if (state.currentFrom < state.totalCount) {
                const remaining = state.totalCount - state.currentFrom;
                const btn = `<button onclick="APP.loadMoreOrders()" class="btn btn--primary btn--sm" style="padding:10px 32px;font-size:14px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${remaining} ${lang === 'id' ? 'tersisa' : '剩余'})</button>`;
                const row = document.createElement('tr');
                row.id = 'loadMoreRow';
                row.innerHTML = `<td colspan="${state.totalCols}" style="text-align:center;padding:14px;">${btn}</td>`;
                tbody.appendChild(row);
            } else if (state.totalCount > 0) {
                const row = document.createElement('tr');
                row.id = 'loadMoreRow';
                row.innerHTML = `<td colspan="${state.totalCols}" style="text-align:center;padding:14px;color:var(--text-muted);">✅ ${lang === 'id' ? `Semua ${state.totalCount} pesanan telah dimuat` : `已加载全部 ${state.totalCount} 条订单`}</td>`;
                tbody.appendChild(row);
            }
        },

        // 快捷跳转到缴费页
        payOrder(orderId) {
            APP.navigateTo('payment', { orderId });
        },

        // 切换筛选状态
        filterOrders(status) {
            APP.currentFilter = status;
            this.showOrderTable();
        },

        // ==================== 查看订单详情 ====================
        async viewOrder(orderId) {
            APP.currentPage = 'viewOrder';
            APP.currentOrderId = orderId;
            APP.saveCurrentPageState();

            try {
                const contentHTML = await this.renderViewOrderHTML(orderId);
                document.getElementById("app").innerHTML = contentHTML;
            } catch (error) {
                console.error("viewOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
                APP.goBack();
            }
        },

        // ==================== 删除订单 ====================
        async deleteOrder(orderId) {
            const confirmed = await Utils.toast.confirm(Utils.t('confirm_delete'));
            if (!confirmed) return;
            try {
                const order = await SUPABASE.getOrder(orderId);
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                await Order.delete(orderId);
                if (window.Audit) await window.Audit.logOrderDelete(order.order_id, order.customer_name, order.loan_amount, AUTH.user?.name);
                Utils.toast.success(Utils.t('order_deleted'));
                await this.showOrderTable();
            } catch (error) {
                console.error("deleteOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
            }
        },

        // ==================== 补全：打印单个订单 ====================
        async printOrder(orderId) {
            const lang = Utils.lang;
            try {
                const result = await SUPABASE.getPaymentHistory(orderId);
                const order = result.order;
                if (!order) {
                    Utils.toast.error(Utils.t('order_not_found'));
                    return;
                }

                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();
                const storeName = isAdmin ? (lang === 'id' ? 'Kantor Pusat' : '总部') : (profile?.stores?.name || '-');
                const userName = profile?.name || '-';
                const printDateTime = new Date().toLocaleString();

                const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
                const monthlyRate = order.agreed_interest_rate || 0.08;
                const currentMonthlyInterest = remainingPrincipal * monthlyRate;
                const statusText = order.status === 'active' ? (lang === 'id' ? 'Aktif' : '进行中') :
                                   order.status === 'completed' ? (lang === 'id' ? 'Lunas' : '已结清') :
                                   (lang === 'id' ? 'Likuidasi' : '已变卖');
                const repaymentText = order.repayment_type === 'fixed' ? (lang === 'id' ? 'Cicilan Tetap' : '固定还款') :
                                     (lang === 'id' ? 'Cicilan Fleksibel' : '灵活还款');

                let paymentRows = '';
                if (result.payments && result.payments.length > 0) {
                    for (const p of result.payments) {
                        paymentRows += `<tr>
                            <td>${Utils.formatDate(p.date)}</td>
                            <td>${Utils.escapeHtml(p.type)}</td>
                            <td class="text-right">${Utils.formatCurrency(p.amount)}</td>
                            <td>${Utils.escapeHtml(p.payment_method || '-')}</td>
                            <td>${Utils.escapeHtml(p.description || '')}</td>
                        </tr>`;
                    }
                } else {
                    paymentRows = `<tr><td colspan="5" class="text-center">${lang === 'id' ? 'Tidak ada' : '无'}</td></tr>`;
                }

                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>Print Order - ${Utils.escapeHtml(order.order_id)}</title>
                        <style>
                            body { font-family: Arial, sans-serif; font-size: 11pt; padding: 2cm; }
                            h1 { font-size: 16pt; margin-bottom: 0.5cm; }
                            table { width: 100%; border-collapse: collapse; margin: 1cm 0; }
                            th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
                            th { background: #eee; font-weight: bold; }
                            .text-right { text-align: right; }
                            .text-center { text-align: center; }
                            @media print { body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        <h1>${lang === 'id' ? 'Detail Pesanan' : '订单详情'}</h1>
                        <table>
                            <tr><td><strong>${Utils.t('order_id')}</strong></td><td>${Utils.escapeHtml(order.order_id)}</td></tr>
                            <tr><td><strong>${Utils.t('customer_name')}</strong></td><td>${Utils.escapeHtml(order.customer_name)}</td></tr>
                            <tr><td><strong>${Utils.t('collateral_name')}</strong></td><td>${Utils.escapeHtml(order.collateral_name)}</td></tr>
                            <tr><td><strong>${Utils.t('loan_amount')}</strong></td><td>${Utils.formatCurrency(order.loan_amount)}</td></tr>
                            <tr><td><strong>${Utils.t('repayment_type')}</strong></td><td>${repaymentText}</td></tr>
                            <tr><td><strong>${Utils.t('status')}</strong></td><td>${statusText}</td></tr>
                            <tr><td><strong>${Utils.t('agreed_rate')}</strong></td><td>${(monthlyRate * 100).toFixed(0)}%</td></tr>
                            <tr><td><strong>${lang === 'id' ? 'Bunga Bulanan' : '月利息'}</strong></td><td>${Utils.formatCurrency(currentMonthlyInterest)}</td></tr>
                            <tr><td><strong>${Utils.t('remaining_principal')}</strong></td><td>${Utils.formatCurrency(remainingPrincipal)}</td></tr>
                        </table>
                        <h2>${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>${Utils.t('date')}</th>
                                    <th>${Utils.t('type')}</th>
                                    <th>${Utils.t('amount')}</th>
                                    <th>${Utils.t('payment_method')}</th>
                                    <th>${Utils.t('description')}</th>
                                </tr>
                            </thead>
                            <tbody>${paymentRows}</tbody>
                        </table>
                        <p style="text-align:center; font-size:9pt; margin-top:1cm;">
                            ${lang === 'id' ? 'Dicetak dari' : '打印自'} JF! by Gadai - ${printDateTime}
                        </p>
                        <script>window.print(); setTimeout(function(){ window.close(); }, 500);</script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            } catch (error) {
                console.error("printOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mencetak pesanan' : '打印订单失败');
            }
        },

        // ==================== 显示缴费历史汇总 ====================
        async showPaymentHistory() {
            APP.currentPage = 'paymentHistory';
            APP.saveCurrentPageState();
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            try {
                const allPayments = await SUPABASE.getAllPayments();
                let totalAdminFee = 0, totalServiceFee = 0, totalInterest = 0, totalPrincipal = 0;
                for (const p of allPayments) {
                    if (p.type === 'admin_fee') totalAdminFee += p.amount;
                    else if (p.type === 'service_fee') totalServiceFee += p.amount;
                    else if (p.type === 'interest') totalInterest += p.amount;
                    else if (p.type === 'principal') totalPrincipal += p.amount;
                }
                const typeMap = { admin_fee: t('admin_fee'), service_fee: t('service_fee'), interest: t('interest'), principal: t('principal') };
                const methodMap = { cash: t('cash'), bank: t('bank') };

                let rows = '';
                if (allPayments.length === 0) {
                    rows = `<tr><td colspan="8" class="text-center">${t('no_data')}</td>`;
                } else {
                    for (const p of allPayments) {
                        const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                        rows += `<tr><td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td><td>${Utils.escapeHtml(p.orders?.customer_name || '-')}</td><td class="date-cell">${Utils.formatDate(p.date)}</td><td>${typeMap[p.type] || p.type}</td><td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td><td class="amount">${Utils.formatCurrency(p.amount)}</td><td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td><td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td></tr>`;
                    }
                }

                document.getElementById("app").innerHTML = `
                    <div class="page-header"><h2>💰 ${t('payment_history')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button><button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${t('print')}</button></div></div>
                    <div class="stats-grid stats-grid--auto">
                        <div class="card card--stat"><div class="stat-value income">${Utils.formatCurrency(totalAdminFee)}</div><div class="stat-label">${t('admin_fee')}</div></div>
                        <div class="card card--stat"><div class="stat-value income">${Utils.formatCurrency(totalServiceFee)}</div><div class="stat-label">${t('service_fee')}</div></div>
                        <div class="card card--stat"><div class="stat-value income">${Utils.formatCurrency(totalInterest)}</div><div class="stat-label">${t('interest')}</div></div>
                        <div class="card card--stat"><div class="stat-value">${Utils.formatCurrency(totalPrincipal)}</div><div class="stat-label">${t('principal')}</div></div>
                        <div class="card card--stat"><div class="stat-value">${Utils.formatCurrency(totalAdminFee + totalServiceFee + totalInterest + totalPrincipal)}</div><div class="stat-label">${lang === 'id' ? 'Total Keseluruhan' : '全部总计'}</div></div>
                    </div>
                    <div class="card">
                        <div class="table-container">
                            <table class="data-table payment-table">
                                <thead><tr><th class="col-id">${t('order_id')}</th><th class="col-name">${t('customer_name')}</th><th class="col-date">${t('date')}</th><th class="col-type">${t('type')}</th><th class="col-months text-center">${lang === 'id' ? 'Bulan' : '月数'}</th><th class="col-amount amount">${t('amount')}</th><th class="col-method text-center">${lang === 'id' ? 'Metode' : '支付方式'}</th><th class="col-desc">${t('description')}</th></tr></thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>`;
            } catch (error) {
                console.error("showPaymentHistory error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
            }
        }
    };

    // 挂载到命名空间
    JF.OrdersPage = OrdersPage;

    // 向下兼容 APP 方法
    if (window.APP) {
        window.APP.showOrderTable = OrdersPage.showOrderTable.bind(OrdersPage);
        window.APP.loadMoreOrders = OrdersPage.loadMoreOrders.bind(OrdersPage);
        window.APP.payOrder = OrdersPage.payOrder.bind(OrdersPage);
        window.APP.filterOrders = OrdersPage.filterOrders.bind(OrdersPage);
        window.APP.viewOrder = OrdersPage.viewOrder.bind(OrdersPage);
        window.APP.deleteOrder = OrdersPage.deleteOrder.bind(OrdersPage);
        window.APP.printOrder = OrdersPage.printOrder.bind(OrdersPage);
        window.APP.showPaymentHistory = OrdersPage.showPaymentHistory.bind(OrdersPage);
    }

    console.log('✅ JF.OrdersPage v2.1 补全完成（printOrder 实现，移除空方法）');
})();
