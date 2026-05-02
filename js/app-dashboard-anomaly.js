// app-dashboard-anomaly.js - v2.1 (JF 命名空间) - 支持外壳渲染，完整版
// 异常检测页面模块，挂载到 JF.AnomalyPage

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const AnomalyPage = {

        // ==================== 辅助数据获取方法 ====================
        async _getOverdueOrders(profile, page = 0, pageSize = 50) {
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            const client = SUPABASE.getClient();
            let query = client
                .from('orders')
                .select('order_id, customer_name, overdue_days, loan_amount, status', { count: 'exact' })
                .eq('status', 'active')
                .gte('overdue_days', 30)
                .order('overdue_days', { ascending: false });

            if (!isAdmin && storeId) {
                query = query.eq('store_id', storeId);
            }
            const { data, error, count } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) { console.warn('获取逾期订单失败:', error); return { data: [], totalCount: 0 }; }
            return { data: data || [], totalCount: count || 0 };
        },

        async _getBlacklistCustomers(page = 0, pageSize = 50) {
            const client = SUPABASE.getClient();
            const { data, error, count } = await client
                .from('blacklist')
                .select('*, customers!blacklist_customer_id_fkey(name, phone, customer_id)', { count: 'exact' })
                .order('blacklisted_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) { console.warn('获取黑名单失败:', error); return { data: [], totalCount: 0 }; }
            return { data: data || [], totalCount: count || 0 };
        },

        async _getMonthlyStoreRanking(stores) {
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
            const monthEnd = today.toISOString().split('T')[0];

            const client = SUPABASE.getClient();
            const { data: monthlyOrders, error } = await client
                .from('orders')
                .select('id, store_id, loan_amount, status, created_at, overdue_days')
                .gte('created_at', monthStart)
                .lte('created_at', monthEnd);
            if (error) { console.warn('获取本月订单失败:', error); return { top3: [], bottom3: [] }; }

            const { data: monthlyFlows } = await client
                .from('cash_flow_records')
                .select('store_id, amount, order_id')
                .eq('direction', 'inflow')
                .eq('is_voided', false)
                .gte('recorded_at', monthStart);

            const flowAmountByOrder = {};
            if (monthlyFlows) {
                for (const flow of monthlyFlows) {
                    if (flow.order_id) {
                        flowAmountByOrder[flow.order_id] = (flowAmountByOrder[flow.order_id] || 0) + (flow.amount || 0);
                    }
                }
            }

            const storeInfoMap = {};
            for (const store of stores) {
                storeInfoMap[store.id] = { id: store.id, name: store.name, code: store.code, isActive: store.is_active !== false, isPractice: store.is_practice === true };
            }

            const storeStats = {};
            for (const order of (monthlyOrders || [])) {
                const s = storeInfoMap[order.store_id];
                if (!s || !s.isActive || s.code === 'STORE_000' || s.isPractice) continue;
                if (!storeStats[order.store_id]) {
                    storeStats[order.store_id] = {
                        id: order.store_id, name: s.name, code: s.code,
                        orderCount: 0, totalLoanOutflow: 0, badOrders: 0, totalRecovery: 0
                    };
                }
                storeStats[order.store_id].orderCount++;
                storeStats[order.store_id].totalLoanOutflow += (order.loan_amount || 0);
                if ((order.overdue_days || 0) >= 15 && order.status === 'active') {
                    storeStats[order.store_id].badOrders++;
                }
                storeStats[order.store_id].totalRecovery += (flowAmountByOrder[order.id] || 0);
            }

            let eligibleStores = Object.values(storeStats);
            if (eligibleStores.length === 0) return { top3: [], bottom3: [] };

            // 计算综合排名（多维度加权）
            const rankByField = (field, asc = true) => {
                eligibleStores.sort((a, b) => asc ? a[field] - b[field] : b[field] - a[field]);
                for (let i = 0; i < eligibleStores.length; i++) {
                    eligibleStores[i][`rank_${field}`] = i + 1;
                    eligibleStores[i].rankSum = (eligibleStores[i].rankSum || 0) + i + 1;
                }
            };
            eligibleStores.forEach(s => s.rankSum = 0);
            rankByField('orderCount', false);
            rankByField('totalLoanOutflow', true);
            rankByField('badOrders', true);
            rankByField('totalRecovery', false);
            eligibleStores.sort((a, b) => a.rankSum - b.rankSum);

            if (eligibleStores.length === 1) return { top3: eligibleStores.slice(0, 1), bottom3: [] };
            if (eligibleStores.length === 2) return { top3: eligibleStores.slice(0, 2), bottom3: [] };
            if (eligibleStores.length === 3) return { top3: eligibleStores.slice(0, 3), bottom3: eligibleStores.slice(-1).reverse() };
            return {
                top3: eligibleStores.slice(0, 3),
                bottom3: eligibleStores.slice(-3).reverse()
            };
        },

        // ==================== 构建异常页面 HTML（纯内容） ====================
        async buildAnomalyHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();
                const storeId = profile?.store_id;

                const overdueCacheKey = `overdue_orders_${isAdmin ? 'admin' : storeId}_0`;
                const overdueResult = await JF.Cache.get(overdueCacheKey,
                    () => AnomalyPage._getOverdueOrders(profile, 0, 50),
                    { ttl: 3 * 60 * 1000 }
                );
                const overdueOrders = overdueResult.data;
                const overdueTotalCount = overdueResult.totalCount;

                const blacklistCacheKey = 'blacklist_customers_0';
                const blacklistResult = await JF.Cache.get(blacklistCacheKey,
                    () => AnomalyPage._getBlacklistCustomers(0, 50),
                    { ttl: 3 * 60 * 1000 }
                );
                const blacklist = blacklistResult.data;
                const blacklistTotalCount = blacklistResult.totalCount;

                let top3 = [], bottom3 = [];
                if (isAdmin) {
                    const stores = await SUPABASE.getAllStores();
                    const rankingCacheKey = 'monthly_store_ranking';
                    const rankingResult = await JF.Cache.get(rankingCacheKey,
                        () => AnomalyPage._getMonthlyStoreRanking(stores),
                        { ttl: 5 * 60 * 1000 }
                    );
                    top3 = rankingResult.top3;
                    bottom3 = rankingResult.bottom3;
                }

                // 构建逾期30天订单表格
                const buildOverdueTable = () => {
                    if (overdueOrders.length === 0) {
                        return `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">${lang === 'id' ? 'Semua pesanan dalam keadaan baik' : '所有订单状态良好'}</div></div>`;
                    }
                    let rows = '';
                    for (const o of overdueOrders) {
                        rows += `<tr>
                            <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                            <td>${Utils.escapeHtml(o.customer_name)}</td>
                            <td class="text-center expense">${o.overdue_days || 0}</td>
                            <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                            <td class="text-center"><button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small">${lang === 'id' ? 'Lihat' : '查看'}</button></td>
                        </tr>`;
                    }
                    let loadMoreHtml = '';
                    if (overdueTotalCount > overdueOrders.length) {
                        loadMoreHtml = `<tr id="overdueLoadMoreRow"><td colspan="5" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreOverdueOrders()" class="btn-small primary" style="padding:8px 24px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${overdueTotalCount - overdueOrders.length} ${lang === 'id' ? 'tersisa' : '剩余'})</button></td></tr>`;
                    }
                    return `<div class="table-container"><table class="data-table anomaly-table"><thead><tr><th class="col-id">${lang === 'id' ? 'ID Pesanan' : '订单号'}</th><th class="col-name">${lang === 'id' ? 'Nama Nasabah' : '客户姓名'}</th><th class="col-months text-center">${lang === 'id' ? 'Hari Terlambat' : '逾期天数'}</th><th class="col-amount amount">${lang === 'id' ? 'Jumlah Pinjaman' : '贷款金额'}</th><th class="text-center" style="width:60px;">${lang === 'id' ? 'Aksi' : '操作'}</th></tr></thead><tbody>${rows}${loadMoreHtml}</tbody></table></div>`;
                };

                // 构建黑名单表格
                const buildBlacklistTable = () => {
                    if (blacklist.length === 0) {
                        return `<div class="empty-state"><div class="empty-state-icon">👍</div><div class="empty-state-text">${lang === 'id' ? 'Tidak ada nasabah di blacklist' : '暂无黑名单客户'}</div></div>`;
                    }
                    let rows = '';
                    for (const b of blacklist) {
                        rows += `<tr><td>${Utils.escapeHtml(b.customers?.customer_id || '-')}</td><td>${Utils.escapeHtml(b.customers?.name || '-')}</td><td>${Utils.escapeHtml(b.customers?.phone || '-')}</td><td>${Utils.escapeHtml(b.reason)}</td></tr>`;
                    }
                    let loadMoreHtml = '';
                    if (blacklistTotalCount > blacklist.length) {
                        loadMoreHtml = `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreBlacklist()" class="btn-small primary" style="padding:8px 24px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${blacklistTotalCount - blacklist.length} ${lang === 'id' ? 'tersisa' : '剩余'})</button></td></tr>`;
                    }
                    return `<div class="table-container"><table class="data-table anomaly-table"><thead><tr><th class="col-id">${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th><th class="col-name">${lang === 'id' ? 'Nama' : '姓名'}</th><th class="col-phone">${lang === 'id' ? 'Telepon' : '电话'}</th><th>${lang === 'id' ? 'Alasan' : '原因'}</th></tr></thead><tbody>${rows}${loadMoreHtml}</tbody></table></div>`;
                };

                // 构建排名列表
                const buildRankingList = (stores, type) => {
                    if (stores.length === 0) return `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">${lang === 'id' ? 'Belum ada data toko bulan ini' : '本月暂无门店数据'}</div></div>`;
                    let items = '';
                    stores.forEach((s, idx) => {
                        const medal = type === 'top' ? (idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉') : (idx === 0 ? '🔴' : idx === 1 ? '🟡' : '🟠');
                        const className = type === 'top' ? (idx === 0 ? 'first' : '') : (idx === 0 ? 'last' : '');
                        items += `<div class="ranking-item ${className}">
                            <div class="ranking-number">${medal}</div>
                            <div class="ranking-info"><span class="ranking-name">${Utils.escapeHtml(s.name)}</span><span class="ranking-code">${Utils.escapeHtml(s.code)}</span></div>
                            <div class="ranking-count" style="font-size:var(--font-xs);text-align:right;line-height:1.6;">
                                ${lang === 'id' ? 'Pesanan' : '订单'}: ${s.orderCount}<br>
                                ${lang === 'id' ? 'Pinjaman' : '放款'}: ${Utils.formatCurrency(s.totalLoanOutflow)}<br>
                                ${lang === 'id' ? 'Buruk' : '不良'}: ${s.badOrders}<br>
                                ${lang === 'id' ? 'Pemulihan' : '回收'}: ${Utils.formatCurrency(s.totalRecovery)}
                            </div>
                        </div>`;
                    });
                    return `<div class="ranking-list">${items}</div>`;
                };

                // 根据角色构建不同布局
                let contentGrid = '';
                if (!isAdmin) {
                    contentGrid = `
                        <div class="anomaly-grid">
                            <div class="anomaly-card anomaly-card-danger">
                                <div class="anomaly-card-header"><span class="anomaly-icon">⚠️</span><h3>${lang === 'id' ? 'Pesanan Terlambat 30+ Hari' : '逾期30天以上订单'}</h3><span class="anomaly-badge">${overdueTotalCount}</span></div>
                                <div class="anomaly-card-body">${buildOverdueTable()}</div>
                                ${overdueOrders.length > 0 ? `<div class="anomaly-card-footer"><span class="warning-text">💡 ${lang === 'id' ? 'Pesanan ini akan memasuki proses likuidasi' : '这些订单即将进入变卖程序'}</span></div>` : ''}
                            </div>
                            <div class="anomaly-card anomaly-card-warning">
                                <div class="anomaly-card-header"><span class="anomaly-icon">🚫</span><h3>${lang === 'id' ? 'Daftar Hitam Nasabah (Semua Toko)' : '黑名单客户（全部门店）'}</h3><span class="anomaly-badge">${blacklistTotalCount}</span></div>
                                <div class="anomaly-card-body">${buildBlacklistTable()}</div>
                            </div>
                        </div>`;
                } else {
                    contentGrid = `
                        <div class="anomaly-grid">
                            <div class="anomaly-card anomaly-card-info">
                                <div class="anomaly-card-header"><span class="anomaly-icon">🏆</span><h3>${lang === 'id' ? 'Kinerja Terbaik Bulan Ini (3 Besar)' : '本月业绩前三排行'}</h3><span class="anomaly-badge">${top3.length}</span></div>
                                <div class="anomaly-card-body">${buildRankingList(top3, 'top')}</div>
                                <div class="anomaly-card-footer"><span class="info-text">💡 ${lang === 'id' ? 'Peringkat berdasarkan data bulan ini' : '排名基于当月数据'}</span></div>
                            </div>
                            <div class="anomaly-card anomaly-card-info">
                                <div class="anomaly-card-header"><span class="anomaly-icon">📉</span><h3>${lang === 'id' ? 'Kinerja Terendah Bulan Ini (3 Besar)' : '本月业绩后三排行'}</h3><span class="anomaly-badge">${bottom3.length}</span></div>
                                <div class="anomaly-card-body">${buildRankingList(bottom3, 'bottom')}</div>
                                <div class="anomaly-card-footer"><span class="info-text">💡 ${lang === 'id' ? 'Peringkat berdasarkan data bulan ini' : '排名基于当月数据'}</span></div>
                            </div>
                            <div class="anomaly-card anomaly-card-danger">
                                <div class="anomaly-card-header"><span class="anomaly-icon">⚠️</span><h3>${lang === 'id' ? 'Pesanan Terlambat 30+ Hari' : '逾期30天以上订单'}</h3><span class="anomaly-badge">${overdueTotalCount}</span></div>
                                <div class="anomaly-card-body">${buildOverdueTable()}</div>
                                ${overdueOrders.length > 0 ? `<div class="anomaly-card-footer"><span class="warning-text">💡 ${lang === 'id' ? 'Pesanan ini akan memasuki proses likuidasi' : '这些订单即将进入变卖程序'}</span></div>` : ''}
                            </div>
                            <div class="anomaly-card anomaly-card-warning">
                                <div class="anomaly-card-header"><span class="anomaly-icon">🚫</span><h3>${lang === 'id' ? 'Daftar Hitam Nasabah' : '黑名单客户'}</h3><span class="anomaly-badge">${blacklistTotalCount}</span></div>
                                <div class="anomaly-card-body">${buildBlacklistTable()}</div>
                            </div>
                        </div>`;
                }

                const content = `
                    <div class="page-header"><h2>⚠️ ${t('anomaly_title')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button><button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ${t('print')}</button></div></div>
                    ${contentGrid}`;

                // 保存状态，供加载更多功能使用
                window._anomalyOverdueState = { page: 0, pageSize: 50, totalCount: overdueTotalCount, profile, isAdmin, storeId };
                window._anomalyBlacklistState = { page: 0, pageSize: 50, totalCount: blacklistTotalCount };

                return content;

            } catch (error) {
                console.error("buildAnomalyHTML error:", error);
                Utils.toast.error(Utils.t('loading_failed', { module: '异常页面' }));
                return `<div class="card"><p>❌ ${Utils.t('loading_failed', { module: '异常页面' })}</p></div>`;
            }
        },

        // 供外壳调用的渲染函数
        async renderAnomalyHTML() {
            return await this.buildAnomalyHTML();
        },

        // 原有的 showAnomaly（兼容直接调用）
        async showAnomaly() {
            APP.currentPage = 'anomaly';
            APP.saveCurrentPageState();
            const contentHTML = await this.buildAnomalyHTML();
            document.getElementById("app").innerHTML = contentHTML;
        },

        // ==================== 加载更多逾期订单 ====================
        async loadMoreOverdueOrders() {
            const state = window._anomalyOverdueState;
            if (!state) return;
            const lang = Utils.lang;
            const btn = document.querySelector('#overdueLoadMoreRow button');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...'); }

            try {
                const nextPage = state.page + 1;
                const result = await AnomalyPage._getOverdueOrders(state.profile, nextPage, state.pageSize);
                let newRows = '';
                for (const o of result.data) {
                    newRows += `<tr><td class="order-id">${Utils.escapeHtml(o.order_id)}</td><td>${Utils.escapeHtml(o.customer_name)}</td><td class="text-center expense">${o.overdue_days || 0}</td><td class="amount">${Utils.formatCurrency(o.loan_amount)}</td><td class="text-center"><button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn-small">${lang === 'id' ? 'Lihat' : '查看'}</button></td></tr>`;
                }
                const oldRow = document.getElementById('overdueLoadMoreRow');
                if (oldRow) oldRow.remove();
                const tbody = document.querySelector('.anomaly-card-danger table tbody');
                if (tbody) {
                    tbody.insertAdjacentHTML('beforeend', newRows);
                    state.page = nextPage;
                    state.totalCount = result.totalCount;
                    const loadedCount = (nextPage + 1) * state.pageSize;
                    if (result.totalCount > loadedCount) {
                        const loadMoreHtml = `<tr id="overdueLoadMoreRow"><td colspan="5" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreOverdueOrders()" class="btn-small primary" style="padding:8px 24px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${result.totalCount - loadedCount} ${lang === 'id' ? 'tersisa' : '剩余'})</button></td></tr>`;
                        tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                    } else {
                        tbody.insertAdjacentHTML('beforeend', `<tr id="overdueLoadMoreRow"><td colspan="5" style="text-align:center;padding:10px;color:var(--text-muted);">✅ ${lang === 'id' ? `Semua ${result.totalCount} pesanan telah dimuat` : `已加载全部 ${result.totalCount} 条订单`}</td></tr>`);
                    }
                }
            } catch (err) {
                console.error("loadMoreOverdueOrders error:", err);
                if (btn) { btn.disabled = false; btn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'); }
            }
        },

        // ==================== 加载更多黑名单 ====================
        async loadMoreBlacklist() {
            const state = window._anomalyBlacklistState;
            if (!state) return;
            const lang = Utils.lang;
            const btn = document.querySelector('#blacklistLoadMoreRow button');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...'); }

            try {
                const nextPage = state.page + 1;
                const result = await AnomalyPage._getBlacklistCustomers(nextPage, state.pageSize);
                let newRows = '';
                for (const b of result.data) {
                    newRows += `<tr><td>${Utils.escapeHtml(b.customers?.customer_id || '-')}</td><td>${Utils.escapeHtml(b.customers?.name || '-')}</td><td>${Utils.escapeHtml(b.customers?.phone || '-')}</td><td>${Utils.escapeHtml(b.reason)}</td></tr>`;
                }
                const oldRow = document.getElementById('blacklistLoadMoreRow');
                if (oldRow) oldRow.remove();
                const tbody = document.querySelector('.anomaly-card-warning table tbody');
                if (tbody) {
                    tbody.insertAdjacentHTML('beforeend', newRows);
                    state.page = nextPage;
                    state.totalCount = result.totalCount;
                    const loadedCount = (nextPage + 1) * state.pageSize;
                    if (result.totalCount > loadedCount) {
                        const loadMoreHtml = `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreBlacklist()" class="btn-small primary" style="padding:8px 24px;">⬇️ ${lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'} (${result.totalCount - loadedCount} ${lang === 'id' ? 'tersisa' : '剩余'})</button></td></tr>`;
                        tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                    } else {
                        tbody.insertAdjacentHTML('beforeend', `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;color:var(--text-muted);">✅ ${lang === 'id' ? `Semua ${result.totalCount} data telah dimuat` : `已加载全部 ${result.totalCount} 条数据`}</td></tr>`);
                    }
                }
            } catch (err) {
                console.error("loadMoreBlacklist error:", err);
                if (btn) { btn.disabled = false; btn.textContent = '⬇️ ' + (lang === 'id' ? 'Muat Lebih Banyak' : '加载更多'); }
            }
        },

        // 手动清除异常页面缓存
        clearAnomalyCache() {
            JF.Cache.clear();
            Utils.toast.info('缓存已清除', 2000);
        }
    };

    // 挂载到命名空间
    JF.AnomalyPage = AnomalyPage;

    // 向下兼容 APP 方法
    if (window.APP) {
        window.APP.showAnomaly = AnomalyPage.showAnomaly.bind(AnomalyPage);
        window.APP.loadMoreOverdueOrders = AnomalyPage.loadMoreOverdueOrders.bind(AnomalyPage);
        window.APP.loadMoreBlacklist = AnomalyPage.loadMoreBlacklist.bind(AnomalyPage);
        window.APP.clearAnomalyCache = AnomalyPage.clearAnomalyCache.bind(AnomalyPage);
    } else {
        window.APP = {
            showAnomaly: AnomalyPage.showAnomaly.bind(AnomalyPage),
            loadMoreOverdueOrders: AnomalyPage.loadMoreOverdueOrders.bind(AnomalyPage),
            loadMoreBlacklist: AnomalyPage.loadMoreBlacklist.bind(AnomalyPage),
            clearAnomalyCache: AnomalyPage.clearAnomalyCache.bind(AnomalyPage)
        };
    }

    console.log('✅ JF.AnomalyPage v2.1 初始化完成（支持外壳渲染，完整版）');
})();
