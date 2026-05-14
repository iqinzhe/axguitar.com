// app-dashboard-orders.js - v2.1 (JF 命名空间) 
// 新增：行点击选中高亮 + 顶部操作栏（单选模式）

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

            const [{ orders, totalCount }, stores] = await Promise.all([
                this._fetchOrderData(filters, from, to),
                SUPABASE.getAllStores()
            ]);
            const allOrders = orders;
            let currentFromVal = from + allOrders.length;
            const storeMap = {};
            for (const s of stores) storeMap[s.id] = s.name;

            const totalCols = isAdmin ? 10 : 9;
            const statusMap = {
                active: t('status_active'),
                completed: t('status_completed'),
                liquidated: t('status_liquidated')
            };

            let rows = '';
            for (const o of allOrders) {
                const sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated');
                const storeName = isAdmin ? storeMap[o.store_id] || '-' : '';
                const nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                const remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                const currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                const repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                const repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';

                rows += `<tr class="order-row" data-order-id="${Utils.escapeHtml(o.order_id)}">
                    <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                    <td class="col-name">${Utils.escapeHtml(o.customer_name)}</td>
                    <td>${Utils.escapeHtml(o.collateral_name)}</td>
                    <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                    <td class="amount">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                    <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td class="date-cell text-center">${nextDueDate}</td>
                    <td class="text-center"><span class="badge badge--${repaymentClass}">${repaymentTypeText}</span></td>
                    <td class="text-center"><span class="badge badge--${sc}">${statusMap[o.status] || o.status}</span></td>
                    ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeName)}</td>` : ''}
                </tr>`;
            }

            let loadMoreHtml = '';
            if (currentFromVal < totalCount) {
                const remaining = totalCount - currentFromVal;
                loadMoreHtml = `<tr id="loadMoreRow"><td colspan="${totalCols}" style="text-align:center;padding:14px;"><button onclick="APP.loadMoreOrders()" class="btn btn--primary btn--sm" style="padding:10px 32px;font-size:14px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${remaining} ${lang === 'id' ? 'tersisa' : '剩余'})</button></td></tr>`;
            } else if (totalCount > PAGE_SIZE && allOrders.length > 0) {
                loadMoreHtml = `<tr id="loadMoreRow"><td colspan="${totalCols}" style="text-align:center;padding:14px;color:var(--text-muted);">✅ ${lang === 'id' ? `Semua ${totalCount} pesanan telah dimuat` : `已加载全部 ${totalCount} 条订单`}</td></tr>`;
            }

            window._orderTableState = {
                currentFrom: currentFromVal,
                totalCount,
                allOrders,
                totalCols,
                pageSize: PAGE_SIZE,
                filters,
                storeMap,
                selectedOrderId: null,
                renderOrdersIntoTable: this._renderOrdersIntoTable.bind(this)
            };

            // 构建顶部操作按钮（根据角色显示不同按钮）
            let actionButtonsHtml = '';
            if (!isAdmin) {
                // 门店账户：只有查看和打印
                actionButtonsHtml = `
                    <button id="globalViewBtn" class="btn btn--sm btn--primary">👁️ ${t('view_detail')}</button>
                    <button id="globalPrintBtn" class="btn btn--sm btn--outline">🖨️ ${t('print_this_order')}</button>
                `;
            } else {
                // 管理员：全部按钮
                actionButtonsHtml = `
                    <button id="globalViewBtn" class="btn btn--sm btn--primary">👁️ ${t('view_detail')}</button>
                    <button id="globalPrintBtn" class="btn btn--sm btn--outline">🖨️ ${t('print_this_order')}</button>
                    <button id="globalEditBtn" class="btn btn--sm btn--warning">✏️ ${lang === 'id' ? 'Edit Pesanan' : '修改订单'}</button>
                    <button id="globalDeleteBtn" class="btn btn--sm btn--danger">🗑️ ${t('delete')}</button>
                `;
            }

            const content = `
                <div class="page-header">
                    <h2>📋 ${t('order_list')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        <button onclick="JF.OrdersPage.printAllOrders()" class="btn btn--outline">🖨️ ${t('print_order_list')}</button>
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
                <!-- 全局操作栏 -->
                <div class="card" style="margin-bottom: 12px; padding: 12px 16px; background: var(--bg-hover);">
                    <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                        <span style="font-weight: 600; color: var(--text-secondary);">${lang === 'id' ? 'Aksi untuk pesanan terpilih' : '已选订单操作'}:</span>
                        <div class="action-buttons" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${actionButtonsHtml}
                        </div>
                        <span id="selectedOrderDisplay" style="font-size: 12px; color: var(--primary); margin-left: auto;">${lang === 'id' ? 'Belum ada pesanan dipilih' : '未选择任何订单'}</span>
                    </div>
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
                const currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                const repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                const repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';

                rows += `<tr class="order-row" data-order-id="${Utils.escapeHtml(o.order_id)}">
                    <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                    <td class="col-name">${Utils.escapeHtml(o.customer_name)}</td>
                    <td>${Utils.escapeHtml(o.collateral_name)}</td>
                    <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                    <td class="amount">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                    <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                    <td class="date-cell text-center">${nextDueDate}</td>
                    <td class="text-center"><span class="badge badge--${repaymentClass}">${repaymentTypeText}</span></td>
                    <td class="text-center"><span class="badge badge--${sc}">${statusMap[o.status] || o.status}</span></td>
                    ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeName)}</td>` : ''}
                </tr>`;
            }

            if (append) {
                const loadMoreRow = document.getElementById('loadMoreRow');
                if (loadMoreRow) loadMoreRow.remove();
                tbody.insertAdjacentHTML('beforeend', rows);
                // 为新添加的行绑定点击事件
                this._bindRowClickEvents();
            } else {
                tbody.innerHTML = rows;
            }
        },

        // 绑定行点击选中事件
        _bindRowClickEvents() {
            const state = window._orderTableState;
            if (!state) return;
            
            const rows = document.querySelectorAll('#orderTableBody .order-row');
            const selectedDisplay = document.getElementById('selectedOrderDisplay');
            const lang = Utils.lang;
            
            rows.forEach(row => {
                // 移除旧的事件监听，重新绑定
                row.removeEventListener('click', this._rowClickHandler);
                // 创建绑定到实例的处理函数
                const handler = (e) => {
                    // 如果点击的是按钮或按钮内部元素，不触发选中
                    if (e.target.closest('button')) return;
                    
                    e.stopPropagation();
                    const orderId = row.dataset.orderId;
                    
                    // 移除所有行的选中样式
                    rows.forEach(r => r.classList.remove('row-selected'));
                    
                    // 添加当前行的选中样式
                    row.classList.add('row-selected');
                    
                    // 更新状态
                    state.selectedOrderId = orderId;
                    
                    // 更新显示
                    if (selectedDisplay) {
                        selectedDisplay.innerHTML = `${lang === 'id' ? '✅ Terpilih' : '✅ 已选中'}: ${Utils.escapeHtml(orderId)}`;
                        selectedDisplay.style.color = 'var(--success-dark)';
                    }
                };
                row.addEventListener('click', handler);
                // 存储handler以便后续清理（可选）
                row._clickHandler = handler;
            });
        },

        _rowClickHandler: null, // 占位，实际在绑定时创建

        // 清除选中高亮
        _clearSelection() {
            const state = window._orderTableState;
            if (!state) return;
            
            const rows = document.querySelectorAll('#orderTableBody .order-row');
            rows.forEach(r => r.classList.remove('row-selected'));
            state.selectedOrderId = null;
            
            const selectedDisplay = document.getElementById('selectedDisplay');
            if (selectedDisplay) {
                const lang = Utils.lang;
                selectedDisplay.innerHTML = lang === 'id' ? 'Belum ada pesanan dipilih' : '未选择任何订单';
                selectedDisplay.style.color = 'var(--primary)';
            }
        },

        // 获取当前选中的订单号
        _getSelectedOrderId() {
            const state = window._orderTableState;
            if (!state || !state.selectedOrderId) return null;
            return state.selectedOrderId;
        },

        // 全局操作：查看订单
        async _globalViewOrder() {
            const lang = Utils.lang;
            const orderId = this._getSelectedOrderId();
            if (!orderId) {
                Utils.toast.warning(lang === 'id' ? 'Silakan pilih pesanan terlebih dahulu' : '请先选择要操作的订单');
                return;
            }
            await this.viewOrder(orderId);
        },

        // 全局操作：打印订单
        async _globalPrintOrder() {
            const lang = Utils.lang;
            const orderId = this._getSelectedOrderId();
            if (!orderId) {
                Utils.toast.warning(lang === 'id' ? 'Silakan pilih pesanan terlebih dahulu' : '请先选择要操作的订单');
                return;
            }
            await this.printOrder(orderId);
        },

        // 全局操作：修改订单（仅管理员）
        async _globalEditOrder() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya administrator yang dapat mengedit pesanan' : '仅管理员可修改订单');
                return;
            }
            const orderId = this._getSelectedOrderId();
            if (!orderId) {
                Utils.toast.warning(lang === 'id' ? 'Silakan pilih pesanan terlebih dahulu' : '请先选择要操作的订单');
                return;
            }
            if (JF.AdminEditOrder && JF.AdminEditOrder.adminEditOrder) {
                await JF.AdminEditOrder.adminEditOrder(orderId);
            } else {
                Utils.toast.error(lang === 'id' ? 'Fungsi edit tidak tersedia' : '编辑功能不可用');
            }
        },

        // 全局操作：删除订单（仅管理员）
        async _globalDeleteOrder() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya administrator yang dapat menghapus pesanan' : '仅管理员可删除订单');
                return;
            }
            const orderId = this._getSelectedOrderId();
            if (!orderId) {
                Utils.toast.warning(lang === 'id' ? 'Silakan pilih pesanan terlebih dahulu' : '请先选择要操作的订单');
                return;
            }
            await this.deleteOrder(orderId);
            // 删除后清除选中状态
            this._clearSelection();
        },

        // 初始化全局按钮事件
        _initGlobalButtons() {
            const viewBtn = document.getElementById('globalViewBtn');
            const printBtn = document.getElementById('globalPrintBtn');
            const editBtn = document.getElementById('globalEditBtn');
            const deleteBtn = document.getElementById('globalDeleteBtn');
            
            if (viewBtn) {
                viewBtn.onclick = () => this._globalViewOrder();
            }
            if (printBtn) {
                printBtn.onclick = () => this._globalPrintOrder();
            }
            if (editBtn) {
                editBtn.onclick = () => this._globalEditOrder();
            }
            if (deleteBtn) {
                deleteBtn.onclick = () => this._globalDeleteOrder();
            }
        },

        async renderOrderTableHTML(filters) {
            const mergedFilters = Object.assign({ status: 'all' }, filters || {});
            return await this.buildOrderTableHTML(mergedFilters, 0, 50);
        },

        async renderViewOrderHTML(orderId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            const [profile, result] = await Promise.all([
                SUPABASE.getCurrentProfile(),
                SUPABASE.getPaymentHistory(orderId)
            ]);
            const isAdmin = PERMISSION.isAdmin();

            const order = result.order;
            const payments = result.payments;
            if (!order) throw new Error('order_not_found');

            const statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            const methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };

            const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
            const monthlyRate = order.agreed_interest_rate || 0.10;
            const currentMonthlyInterest = remainingPrincipal * monthlyRate;
            const nextDueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';

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

            let payRows = '';
            if (payments && payments.length > 0) {
                for (const p of payments) {
                    const typeText = p.type === 'admin_fee' ? t('admin_fee') : p.type === 'service_fee' ? t('service_fee') : p.type === 'interest' ? t('interest') : t('principal');
                    const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    payRows += `<tr>
                        <td class="date-cell">${Utils.formatDate(p.date)}</td>
                        <td>${typeText}</td>
                        <td class="text-center">${p.months ? p.months + ' ' + (lang === 'id' ? 'bulan' : '个月') : '-'}</td>
                        <td class="amount">${Utils.formatCurrency(p.amount)}</td>
                        <td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>
                        <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                    </tr>`;
                }
            } else {
                payRows = `<tr><td colspan="6" class="text-center">${t('no_data')}</td></tr>`;
            }

            const content = `
                <div class="page-header">
                    <h2>📄 ${t('order_details')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        <button onclick="APP.printOrder('${Utils.escapeHtml(order.order_id)}')" class="btn btn--outline">🖨️ ${t('print')}</button>
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
                        ${order.status === 'active' && !isAdmin ? `<button onclick="APP.navigateTo('payment',{orderId:'${Utils.escapeHtml(order.order_id)}'})" class="btn btn--success">💸 ${lang === 'id' ? 'Bayar Biaya' : '缴纳费用'}</button>` : ''}
                        ${order.status === 'completed' ? `<button onclick="APP.printSettlementReceipt('${Utils.escapeHtml(order.order_id)}')" class="btn btn--success">🧾 ${lang === 'id' ? 'Tanda Terima Pelunasan' : '结清凭证'}</button>` : ''}
                        <button onclick="APP.sendWAReminder('${Utils.escapeHtml(order.order_id)}')" class="btn btn--warning">📱 ${lang === 'id' ? 'WA提醒' : 'WA提醒'}</button>
                    </div>
                </div>`;
            return content;
        },

        async showOrderTable() {
            APP.currentPage = 'orderTable';
            APP.saveCurrentPageState();
            const filters = { status: APP.currentFilter || 'all' };
            const contentHTML = await this.buildOrderTableHTML(filters, 0, 50);
            document.getElementById("app").innerHTML = contentHTML;
            // 绑定行点击事件和全局按钮事件
            setTimeout(() => {
                this._bindRowClickEvents();
                this._initGlobalButtons();
            }, 100);
        },

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
                // 重新绑定新行的点击事件
                this._bindRowClickEvents();
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

        payOrder(orderId) {
            APP.navigateTo('payment', { orderId });
        },

        filterOrders(status) {
            APP.currentFilter = status;
            this.showOrderTable();
        },

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

        async deleteOrder(orderId) {
            const confirmed = await Utils.toast.confirm(Utils.t('confirm_delete'));
            if (!confirmed) return;
            try {
                const order = await SUPABASE.getOrder(orderId);
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                await Order.delete(orderId);
                if (window.Audit) await window.Audit.logOrderDelete(order.order_id, order.customer_name, order.loan_amount, AUTH.user?.name);
                Utils.toast.success(Utils.t('order_deleted'));
                if (window.JF && JF.Cache) JF.Cache.clear();
                await this.showOrderTable();
            } catch (error) {
                console.error("deleteOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal hapus: ' + error.message : '删除失败：' + error.message);
            }
        },

        async printOrder(orderId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            try {
                const result = await SUPABASE.getPaymentHistory(orderId);
                const order = result.order;
                if (!order) {
                    Utils.toast.error(Utils.t('order_not_found'));
                    return;
                }

                const profile = await SUPABASE.getCurrentProfile();
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

                const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
                const monthlyRate = order.agreed_interest_rate || 0.10;
                const currentMonthlyInterest = remainingPrincipal * monthlyRate;
                const statusText = order.status === 'active' ? (lang === 'id' ? 'Aktif' : '进行中') :
                                   order.status === 'completed' ? (lang === 'id' ? 'Lunas' : '已结清') :
                                   (lang === 'id' ? 'Likuidasi' : '已变卖');
                const repaymentText = order.repayment_type === 'fixed' ? (lang === 'id' ? 'Cicilan Tetap' : '固定还款') :
                                     (lang === 'id' ? 'Cicilan Fleksibel' : '灵活还款');

                const labels = {
                    order_id: lang === 'id' ? 'ID Pesanan' : '订单号',
                    customer_name: lang === 'id' ? 'Nama Nasabah' : '客户姓名',
                    collateral_name: lang === 'id' ? 'Nama Jaminan' : '质押物名称',
                    loan_amount: lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额',
                    repayment_type: lang === 'id' ? 'Jenis Cicilan' : '还款方式',
                    status: lang === 'id' ? 'Status' : '状态',
                    interest_rate: lang === 'id' ? 'Suku Bunga' : '约定利率',
                    monthly_interest: lang === 'id' ? 'Bunga Bulanan' : '月利息',
                    remaining_principal: lang === 'id' ? 'Sisa Pokok' : '剩余本金'
                };

                const infoItems = [
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

                const orderInfoGrid = `
                    <div class="order-info-grid">
                        ${infoItems.map(item => `
                            <div class="info-item">
                                <div class="label">${Utils.escapeHtml(item.label)}</div>
                                <div class="value">${Utils.escapeHtml(item.value)}</div>
                            </div>
                        `).join('')}
                    </div>
                `;

                let paymentRows = '';
                if (result.payments && result.payments.length > 0) {
                    for (const p of result.payments) {
                        const typeText = p.type === 'admin_fee' ? t('admin_fee') : 
                                         p.type === 'service_fee' ? t('service_fee') : 
                                         p.type === 'interest' ? t('interest') : t('principal');
                        paymentRows += `<tr>
                            <td>${Utils.formatDate(p.date)}</td>
                            <td>${Utils.escapeHtml(typeText)}</td>
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
                        <title>JF! by Gadai - ${lang === 'id' ? 'Cetak Pesanan' : '打印订单'} - ${Utils.escapeHtml(order.order_id)}</title>
                        <style>
                            * { box-sizing: border-box; margin: 0; padding: 0; }
                            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; line-height: 1.3; color: #1e293b; padding: 0; margin: 0; }
                            .print-container { padding: 5mm; }
                            .print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }
                            .print-header .logo { font-size: 14pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }
                            .print-header .logo img { height: 28px; width: auto; vertical-align: middle; }
                            .print-header-info { font-size: 9pt; color: #475569; margin: 4px 0 8px; text-align: center; white-space: nowrap; }
                            .print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 12px; padding-top: 6px; border-top: 1px solid #e2e8f0; }
                            .page-title { font-size: 14pt; font-weight: bold; margin: 12px 0; color: #1e293b; }
                            .order-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 24px; margin-bottom: 20px; }
                            .info-item { padding: 4px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }
                            .info-item .label { font-size: 7pt; color: #64748b; margin-bottom: 2px; }
                            .info-item .value { font-size: 10pt; font-weight: 500; color: #1e293b; }
                            .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; break-inside: avoid; }
                            .card h3 { font-size: 10pt; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                            table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                            th { background: #f1f5f9; font-weight: 600; text-align: left; }
                            th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; font-size: 8pt; vertical-align: top; }
                            .text-right { text-align: right; }
                            .text-center { text-align: center; }
                            @media print {
                                @page { size: A4; margin: 0mm 8mm 8mm 8mm; }
                                body { margin: 0; padding: 0; }
                                .print-container { padding: 5mm 0 0 0; }
                                .card { break-inside: avoid; }
                                .info-item { break-inside: avoid; }
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
                            <h1 class="page-title">📄 ${lang === 'id' ? 'Detail Pesanan' : '订单详情'}</h1>
                            <div class="card">
                                <h3>📋 ${lang === 'id' ? 'Informasi Pesanan' : '订单信息'}</h3>
                                ${orderInfoGrid}
                                <h3>📋 ${lang === 'id' ? 'Riwayat Pembayaran' : '缴费记录'}</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>${t('date')}</th>
                                            <th>${t('type')}</th>
                                            <th class="text-right">${t('amount')}</th>
                                            <th>${t('payment_method')}</th>
                                            <th>${t('description')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>${paymentRows}</tbody>
                                </table>
                            </div>
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
                    </html>
                `);
                printWindow.document.close();
            } catch (error) {
                console.error("printOrder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mencetak pesanan' : '打印订单失败');
            }
        },

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
                    rows = `<tr><td colspan="8" class="text-center">${t('no_data')}</td></tr>`;
                } else {
                    for (const p of allPayments) {
                        const methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                        rows += `<tr>
                            <td class="order-id">${Utils.escapeHtml(p.orders?.order_id || '-')}</td>
                            <td>${Utils.escapeHtml(p.orders?.customer_name || '-')}</td>
                            <td class="date-cell">${Utils.formatDate(p.date)}</td>
                            <td>${typeMap[p.type] || p.type}</td>
                            <td class="text-center">${p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-'}</td>
                            <td class="amount">${Utils.formatCurrency(p.amount)}</td>
                            <td class="text-center"><span class="badge badge--${methodClass}">${methodMap[p.payment_method] || '-'}</span></td>
                            <td class="desc-cell">${Utils.escapeHtml(p.description || '-')}</td>
                        </tr>`;
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
        },

        // printAllOrders - 增加数据量限制和分页提示
        async printAllOrders() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const isAdmin = PERMISSION.isAdmin();

            const filters = { status: APP.currentFilter || 'all' };

            try {
                const MAX_PRINT_ORDERS = 500;
                
                Utils.toast.info(lang === 'id' 
                    ? '⏳ Sedang menyiapkan data untuk dicetak...' 
                    : '⏳ 正在准备打印数据...', 2000);
                
                const { orders: allOrdersResult, totalCount } = await this._fetchOrderData(filters, 0, MAX_PRINT_ORDERS);
                const orders = allOrdersResult;
                
                if (totalCount > MAX_PRINT_ORDERS) {
                    Utils.toast.warning(lang === 'id' 
                        ? `⚠️ Hanya ${MAX_PRINT_ORDERS} dari ${totalCount} pesanan yang akan dicetak. Gunakan filter untuk mencetak sebagian.`
                        : `⚠️ 仅打印前 ${MAX_PRINT_ORDERS} 条订单（共 ${totalCount} 条）。请使用筛选条件分批打印。`, 5000);
                }
                
                if (orders.length === 0) {
                    Utils.toast.warning(lang === 'id' ? 'Tidak ada data untuk dicetak' : '没有可打印的数据');
                    return;
                }
                
                const stores = await SUPABASE.getAllStores();
                const storeMap = {};
                for (const s of stores) storeMap[s.id] = s.name;

                let rows = '';
                for (const o of orders) {
                    const nextDueDate = o.next_interest_due_date ? Utils.formatDate(o.next_interest_due_date) : '-';
                    const remainingPrincipal = (o.loan_amount || 0) - (o.principal_paid || 0);
                    const currentMonthlyInterest = remainingPrincipal * (o.agreed_interest_rate || 0.10);
                    const repaymentTypeText = o.repayment_type === 'fixed' ? (lang === 'id' ? 'Tetap' : '固定') : (lang === 'id' ? 'Fleksibel' : '灵活');
                    const statusText = o.status === 'active' ? t('status_active') : (o.status === 'completed' ? t('status_completed') : t('status_liquidated'));

                    rows += `<tr>
                        <td>${Utils.escapeHtml(o.order_id)}</td>
                        <td>${Utils.escapeHtml(o.customer_name)}</td>
                        <td>${Utils.escapeHtml(o.collateral_name)}</td>
                        <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                        <td class="amount">${Utils.formatCurrency(currentMonthlyInterest)}</td>
                        <td class="text-center">${o.interest_paid_months} ${lang === 'id' ? 'bln' : '个月'}</td>
                        <td class="text-center">${nextDueDate}</td>
                        <td class="text-center">${repaymentTypeText}</td>
                        <td class="text-center">${statusText}</td>
                        ${isAdmin ? `<td class="text-center">${Utils.escapeHtml(storeMap[o.store_id] || '-')}</td>` : ''}
                    </tr>`;
                }

                const headerHtml = `
                    <tr>
                        <th>${t('order_id')}</th>
                        <th>${t('customer_name')}</th>
                        <th>${t('collateral_name')}</th>
                        <th class="amount">${t('loan_amount')}</th>
                        <th class="amount">${lang === 'id' ? 'Bunga Bulanan' : '月利息'}</th>
                        <th class="text-center">${lang === 'id' ? 'Bunga Dibayar' : '已付利息'}</th>
                        <th class="text-center">${t('payment_due_date')}</th>
                        <th class="text-center">${t('repayment_type')}</th>
                        <th class="text-center">${t('status')}</th>
                        ${isAdmin ? `<th class="text-center">${t('store')}</th>` : ''}
                    </tr>`;

                let storeName = '', roleText = '', userName = '';
                try {
                    storeName = AUTH.getCurrentStoreName();
                    roleText = AUTH.isAdmin() ? (lang === 'id' ? 'Administrator' : '管理员') :
                               AUTH.isStoreManager() ? (lang === 'id' ? 'Manajer Toko' : '店长') :
                               (lang === 'id' ? 'Staf' : '员工');
                    userName = AUTH.user?.name || '-';
                } catch (e) { storeName = '-'; roleText = '-'; userName = '-'; }
                const printDateTime = new Date().toLocaleString();

                const printWindow = window.open('', '_blank');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>JF! by Gadai - ${t('print_order_list')}</title>
                        <style>
                            * { box-sizing: border-box; margin: 0; padding: 0; }
                            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 7.5pt; color: #1e293b; }
                            .print-container { padding: 5mm; }
                            .print-header { text-align: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #1e293b; }
                            .print-header .logo { font-size: 13pt; font-weight: bold; color: #0e7490; display: flex; align-items: center; justify-content: center; gap: 8px; }
                            .print-header .logo img { height: 26px; width: auto; vertical-align: middle; }
                            .print-header-info { font-size: 8pt; color: #475569; margin: 3px 0 6px; text-align: center; }
                            .page-title { font-size: 11pt; font-weight: bold; margin: 8px 0 6px; color: #1e293b; }
                            .print-footer { text-align: center; font-size: 7pt; color: #94a3b8; margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; }
                            table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
                            th { background: #f1f5f9; font-weight: 600; text-align: left; padding: 4px 5px; border: 1px solid #cbd5e1; white-space: nowrap; font-size: 7pt; }
                            td { padding: 4px 5px; border: 1px solid #cbd5e1; font-size: 7pt; vertical-align: top; word-break: break-word; overflow-wrap: break-word; }
                            .amount { text-align: right; }
                            .text-center { text-align: center; }
                            col.col-id       { width: 22mm; }
                            col.col-customer { width: 32mm; }
                            col.col-collat   { width: 30mm; }
                            col.col-loan     { width: 22mm; }
                            col.col-interest { width: 20mm; }
                            col.col-paid     { width: 14mm; }
                            col.col-due      { width: 18mm; }
                            col.col-type     { width: 13mm; }
                            col.col-status   { width: 14mm; }
                            col.col-store    { width: 19mm; }
                            @media print {
                                @page { size: A4 portrait; margin: 8mm; }
                                body { margin: 0; padding: 0; }
                                .print-container { padding: 0; }
                            }
                            .print-warning {
                                background: #fef3c7;
                                color: #d97706;
                                padding: 8px;
                                margin-bottom: 12px;
                                border-radius: 4px;
                                font-size: 8pt;
                                text-align: center;
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
                            ${totalCount > MAX_PRINT_ORDERS ? `
                            <div class="print-warning">
                                ⚠️ ${lang === 'id' 
                                    ? `Hanya ${orders.length} dari ${totalCount} pesanan yang dicetak. Gunakan filter untuk mencetak sebagian.`
                                    : `仅打印 ${orders.length} 条订单（共 ${totalCount} 条）。请使用筛选条件分批打印。`}
                            </div>
                            ` : ''}
                            <div class="page-title">📋 ${t('order_list')} &nbsp;<small style="font-size:8pt;font-weight:normal;color:#64748b;">${lang === 'id' ? 'Total' : '共'} ${orders.length} ${lang === 'id' ? 'pesanan' : '条订单'} ${totalCount > orders.length ? `(dari ${totalCount})` : ''}</small></div>
                            <table>
                                <colgroup>
                                    <col class="col-id">
                                    <col class="col-customer">
                                    <col class="col-collat">
                                    <col class="col-loan">
                                    <col class="col-interest">
                                    <col class="col-paid">
                                    <col class="col-due">
                                    <col class="col-type">
                                    <col class="col-status">
                                    ${isAdmin ? '<col class="col-store">' : ''}
                                </colgroup>
                                <thead>${headerHtml}</thead>
                                <tbody>${rows}</tbody>
                            </table>
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
                    </html>
                `);
                printWindow.document.close();
            } catch (error) {
                console.error('打印订单列表失败:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal mencetak daftar pesanan' : '打印订单列表失败');
            }
        }
    };

    // 挂载 OrdersPage 到命名空间
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
        window.APP.adminEditOrder = null;  // 占位，实际由下方独立 IIFE 覆盖
        window.APP.adminSaveOrder = null;
        window.APP.adminCancelEdit = null;
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
        };
    }

    // 添加选中行的CSS样式
    const style = document.createElement('style');
    style.textContent = `
        .order-row {
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .order-row:hover {
            background-color: var(--bg-hover);
        }
        .order-row.row-selected {
            background-color: var(--primary-soft) !important;
            border-left: 3px solid var(--primary);
        }
        .order-table .order-row.row-selected td:first-child {
            border-left-color: var(--primary);
        }
    `;
    document.head.appendChild(style);

})();

// ==================== 独立的管理员修改订单模块（确保函数存在且可靠） ====================
(function() {
    // 确保 JF 命名空间存在
    if (!window.JF) window.JF = {};

    // 定义管理员编辑订单对象
    const AdminEditOrder = {
        /**
         * 管理员编辑订单 - 解锁订单并显示编辑表单
         * @param {string} orderId 订单号
         */
        async adminEditOrder(orderId) {
            if (!PERMISSION.isAdmin()) {
                Utils.toast.error(Utils.lang === 'id' ? 'Hanya administrator yang dapat mengedit pesanan' : '仅管理员可修改订单');
                return;
            }
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            try {
                const order = await SUPABASE.getOrder(orderId);
                if (!order) throw new Error('订单不存在');

                // 解锁订单
                await SUPABASE.unlockOrder(orderId);

                const today = Utils.getLocalToday();
                const orderDate = (order.created_at || '').substring(0, 10) || today;

                document.getElementById('app').innerHTML = `
                    <div class="page-header">
                        <h2>✏️ ${lang === 'id' ? 'Edit Pesanan' : '修改订单'} — ${Utils.escapeHtml(orderId)}</h2>
                        <div class="header-actions">
                            <button onclick="JF.AdminEditOrder.adminCancelEdit('${Utils.escapeHtml(orderId)}')" class="btn btn--outline">↩️ ${t('cancel')}</button>
                        </div>
                    </div>
                    <div class="card">
                        <div class="info-bar warning"><span class="info-bar-icon">⚠️</span>
                            <div class="info-bar-content"><strong>${lang === 'id' ? 'Mode Edit Admin' : '管理员编辑模式'}：</strong>
                            ${lang === 'id' ? 'Pesanan telah dibuka kuncinya. Setelah simpan, pesanan akan dikunci kembali secara otomatis.' : '订单已临时解锁。保存后将自动重新锁定。'}</div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">📋</span> ${lang === 'id' ? 'Informasi Dasar' : '基本信息'}</div>
                            <div class="form-grid">
                                <div class="form-group"><label>${lang === 'id' ? 'Tanggal Pesanan' : '订单日期'}</label>
                                    <input type="date" id="edit_order_date" value="${orderDate}" max="${today}"></div>
                                <div class="form-group"><label>${t('collateral_name')}</label>
                                    <input type="text" id="edit_collateral" value="${Utils.escapeHtml(order.collateral_name || '')}"></div>
                                <div class="form-group"><label>${t('loan_amount')}</label>
                                    <input type="text" id="edit_loan_amount" class="amount-input" value="${Utils.formatNumberWithCommas(order.loan_amount || 0)}"></div>
                                <div class="form-group"><label>${t('notes')}</label>
                                    <input type="text" id="edit_notes" value="${Utils.escapeHtml(order.notes || '')}"></div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">👤</span> ${t('customer_info')}</div>
                            <div class="form-grid">
                                <div class="form-group"><label>${t('customer_name')}</label>
                                    <input type="text" id="edit_customer_name" value="${Utils.escapeHtml(order.customer_name || '')}"></div>
                                <div class="form-group"><label>${t('ktp_number')}</label>
                                    <input type="text" id="edit_customer_ktp" value="${Utils.escapeHtml(order.customer_ktp || '')}"></div>
                                <div class="form-group"><label>${t('phone')}</label>
                                    <input type="text" id="edit_customer_phone" value="${Utils.escapeHtml(order.customer_phone || '')}"></div>
                                <div class="form-group"><label>${t('address')}</label>
                                    <input type="text" id="edit_customer_address" value="${Utils.escapeHtml(order.customer_address || '')}"></div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">💰</span> ${lang === 'id' ? 'Rincian Biaya' : '费用明细'}</div>
                            <div class="form-grid">
                                <div class="form-group"><label>${t('admin_fee')} (Rp)</label>
                                    <input type="text" id="edit_admin_fee" class="amount-input" value="${Utils.formatNumberWithCommas(order.admin_fee || 0)}">
                                    <div class="form-hint">💡 ${lang === 'id' ? 'Isi 0 untuk dibebaskan' : '填0即为免除'}</div></div>
                                <div class="form-group"><label>${t('service_fee')} (Rp)</label>
                                    <input type="text" id="edit_service_fee" class="amount-input" value="${Utils.formatNumberWithCommas(order.service_fee_amount || 0)}">
                                    <div class="form-hint">💡 ${lang === 'id' ? 'Isi 0 untuk dibebaskan' : '填0即为免除'}</div></div>
                                <div class="form-group"><label>${t('service_fee')} %</label>
                                    <input type="number" id="edit_service_fee_percent" value="${order.service_fee_percent || 0}" min="0" max="10" step="0.5"></div>
                                <div class="form-group"><label>${lang === 'id' ? 'Suku Bunga (%)' : '月利率 (%)'}</label>
                                    <select id="edit_interest_rate">${Utils.getInterestRateOptions((order.agreed_interest_rate || 0.10) * 100)}</select></div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">📅</span> ${t('repayment_type')}</div>
                            <div class="form-grid">
                                <div class="form-group"><label>${t('repayment_type')}</label>
                                    <select id="edit_repayment_type">
                                        <option value="flexible" ${order.repayment_type === 'flexible' ? 'selected' : ''}>${t('flexible_repayment')}</option>
                                        <option value="fixed" ${order.repayment_type === 'fixed' ? 'selected' : ''}>${t('fixed_repayment')}</option>
                                    </select></div>
                                <div class="form-group"><label>${t('term_months')} ${lang === 'id' ? '(Cicilan Tetap)' : '（固定期数）'}</label>
                                    <input type="number" id="edit_repayment_term" value="${order.repayment_term || ''}" min="1" max="10" placeholder="${lang === 'id' ? 'Kosong jika fleksibel' : '灵活还款可留空'}"></div>
                                <div class="form-group"><label>${t('monthly_payment')} (Rp)</label>
                                    <input type="text" id="edit_monthly_payment" class="amount-input" value="${Utils.formatNumberWithCommas(order.monthly_fixed_payment || 0)}"></div>
                                <div class="form-group"><label>${lang === 'id' ? 'Jangka Gadai (bln)' : '典当期限（月）'}</label>
                                    <input type="number" id="edit_pawn_term" value="${order.pawn_term_months || ''}" min="1" max="36" placeholder="${lang === 'id' ? 'Kosong jika tidak ada' : '无则留空'}"></div>
                                <div class="form-group"><label>${lang === 'id' ? 'Batas Perpanjangan (bln)' : '最大延期月数'}</label>
                                    <input type="number" id="edit_max_extension" value="${order.max_extension_months || 10}" min="1" max="36"></div>
                            </div>
                        </div>
                        <div class="form-section">
                            <div class="form-section-title"><span class="section-icon">💳</span> ${lang === 'id' ? 'Status Pembayaran Biaya' : '费用缴纳状态'}</div>
                            <div class="form-grid">
                                <div class="form-group"><label>${t('admin_fee')} ${lang === 'id' ? 'Lunas?' : '已缴？'}</label>
                                    <select id="edit_admin_fee_paid">
                                        <option value="true" ${order.admin_fee_paid ? 'selected' : ''}>${lang === 'id' ? '✅ Sudah' : '✅ 已缴'}</option>
                                        <option value="false" ${!order.admin_fee_paid ? 'selected' : ''}>${lang === 'id' ? '❌ Belum' : '❌ 未缴'}</option>
                                    </select></div>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button onclick="JF.AdminEditOrder.adminSaveOrder('${Utils.escapeHtml(orderId)}')" class="btn btn--success" id="adminSaveBtn">
                                💾 ${lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'}
                            </button>
                            <button onclick="JF.AdminEditOrder.adminCancelEdit('${Utils.escapeHtml(orderId)}')" class="btn btn--outline">↩️ ${t('cancel')}</button>
                        </div>
                    </div>`;

                // 绑定金额格式化
                ['edit_loan_amount', 'edit_admin_fee', 'edit_service_fee', 'edit_monthly_payment'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && Utils.bindAmountFormat) Utils.bindAmountFormat(el);
                });

            } catch (error) {
                console.error('adminEditOrder error:', error);
                Utils.toast.error(error.message || (Utils.lang === 'id' ? 'Gagal membuka pesanan' : '打开订单失败'));
            }
        },

        async adminSaveOrder(orderId) {
            if (!PERMISSION.isAdmin()) {
                Utils.toast.error(Utils.lang === 'id' ? 'Hanya administrator yang dapat menyimpan perubahan' : '仅管理员可保存修改');
                return;
            }
            const lang = Utils.lang;
            const saveBtn = document.getElementById('adminSaveBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
            }

            try {
                const loanAmount    = Utils.parseNumberFromCommas(document.getElementById('edit_loan_amount')?.value) || 0;
                const adminFee      = Utils.parseNumberFromCommas(document.getElementById('edit_admin_fee')?.value) ?? 0;
                const serviceFee    = Utils.parseNumberFromCommas(document.getElementById('edit_service_fee')?.value) ?? 0;
                const servicePct    = parseFloat(document.getElementById('edit_service_fee_percent')?.value) || 0;
                const interestRate  = parseFloat(document.getElementById('edit_interest_rate')?.value) || 10;
                const repayType     = document.getElementById('edit_repayment_type')?.value || 'flexible';
                const repayTerm     = parseInt(document.getElementById('edit_repayment_term')?.value) || null;
                const monthlyPmt    = Utils.parseNumberFromCommas(document.getElementById('edit_monthly_payment')?.value) || 0;
                const pawnTerm      = parseInt(document.getElementById('edit_pawn_term')?.value) || null;
                const maxExtension  = parseInt(document.getElementById('edit_max_extension')?.value) || 10;
                const adminFeePaid  = document.getElementById('edit_admin_fee_paid')?.value === 'true';
                const orderDate     = document.getElementById('edit_order_date')?.value || Utils.getLocalToday();

                const collateral    = document.getElementById('edit_collateral')?.value.trim() || '';
                const custName      = document.getElementById('edit_customer_name')?.value.trim() || '';
                const custKtp       = document.getElementById('edit_customer_ktp')?.value.trim() || '';
                const custPhone     = document.getElementById('edit_customer_phone')?.value.trim() || '';
                const custAddress   = document.getElementById('edit_customer_address')?.value.trim() || '';
                const notes         = document.getElementById('edit_notes')?.value.trim() || '';

                if (!collateral || loanAmount <= 0) {
                    Utils.toast.warning(lang === 'id' ? 'Agunan dan jumlah pinjaman wajib diisi' : '抵押物和贷款金额不能为空');
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'); }
                    return;
                }

                const agreedRate = interestRate / 100;
                const remainingPrincipal = loanAmount; // 管理员修改贷款金额后重新计算
                const monthlyInterest = remainingPrincipal * agreedRate;

                const updates = {
                    collateral_name: collateral,
                    loan_amount: loanAmount,
                    monthly_interest: monthlyInterest,
                    admin_fee: adminFee,
                    admin_fee_paid: adminFeePaid,
                    service_fee_amount: serviceFee,
                    service_fee_percent: servicePct,
                    agreed_interest_rate: agreedRate,
                    agreed_service_fee_rate: servicePct / 100,
                    repayment_type: repayType,
                    repayment_term: repayTerm,
                    monthly_fixed_payment: monthlyPmt || null,
                    pawn_term_months: pawnTerm,
                    max_extension_months: maxExtension,
                    customer_name: custName,
                    customer_ktp: custKtp,
                    customer_phone: custPhone,
                    customer_address: custAddress,
                    notes: notes,
                    created_at: orderDate + 'T00:00:00.000Z',
                    updated_at: new Date().toISOString()
                };

                const client = SUPABASE.getClient();
                const { error: updErr } = await client.from('orders').update(updates).eq('order_id', orderId);
                if (updErr) throw updErr;

                // 保存后自动重新锁定
                await SUPABASE.relockOrder(orderId);

                Utils.toast.success(lang === 'id' ? '✅ Pesanan berhasil diperbarui dan dikunci kembali!' : '✅ 订单已修改并重新锁定！');
                if (window.JF && JF.Cache) JF.Cache.clear();
                await JF.OrdersPage.viewOrder(orderId);

            } catch (error) {
                console.error('adminSaveOrder error:', error);
                Utils.toast.error(error.message || (lang === 'id' ? 'Gagal menyimpan' : '保存失败'));
                try { await SUPABASE.relockOrder(orderId); } catch(e) {}
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan & Kunci Kembali' : '保存并重新锁定'); }
            }
        },

        async adminCancelEdit(orderId) {
            try { await SUPABASE.relockOrder(orderId); } catch(e) {}
            await JF.OrdersPage.viewOrder(orderId);
        }
    };

    // 挂载到 JF 命名空间（全局可访问）
    JF.AdminEditOrder = AdminEditOrder;

    // 同时挂载到 APP 以兼容旧的调用方式
    if (!window.APP) window.APP = {};
    window.APP.adminEditOrder  = AdminEditOrder.adminEditOrder.bind(AdminEditOrder);
    window.APP.adminSaveOrder  = AdminEditOrder.adminSaveOrder.bind(AdminEditOrder);
    window.APP.adminCancelEdit = AdminEditOrder.adminCancelEdit.bind(AdminEditOrder);

})();
