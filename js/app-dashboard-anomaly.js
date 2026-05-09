// app-dashboard-anomaly.js - v2.0
// 增加更完善的防重复请求机制 + 移除按钮禁用时的状态残留

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const AnomalyPage = {

        // ---------- 辅助数据获取 ----------
        async _getOverdueOrdersRange(profile, minDays, maxDays) {
            const isAdmin = profile?.role === 'admin';
            const storeId = profile?.store_id;
            const client = SUPABASE.getClient();
            let query = client
                .from('orders')
                .select('order_id, customer_name, overdue_days, loan_amount, status')
                .eq('status', 'active')
                .gte('overdue_days', minDays)
                .lte('overdue_days', maxDays)
                .order('overdue_days', { ascending: false });

            if (!isAdmin && storeId) {
                query = query.eq('store_id', storeId);
            } else if (isAdmin) {
                const practiceIds = await SUPABASE._getPracticeStoreIds();
                if (practiceIds.length > 0) {
                    query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                }
            }
            const { data, error } = await query;
            if (error) { console.warn('获取逾期订单失败:', error); return []; }
            return data || [];
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
                    if (flow.order_id) flowAmountByOrder[flow.order_id] = (flowAmountByOrder[flow.order_id] || 0) + (flow.amount || 0);
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
                if ((order.overdue_days || 0) >= 15 && order.status === 'active') storeStats[order.store_id].badOrders++;
                storeStats[order.store_id].totalRecovery += (flowAmountByOrder[order.id] || 0);
            }

            let eligibleStores = Object.values(storeStats);
            if (eligibleStores.length === 0) return { top3: [], bottom3: [] };

            const rankByField = (field, asc = true) => {
                eligibleStores.sort((a, b) => asc ? a[field] - b[field] : b[field] - a[field]);
                for (let i = 0; i < eligibleStores.length; i++) {
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

        // ---------- 构建页面 ----------
        async buildAnomalyHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();

                const cacheKeyBase = `overdue_range_${isAdmin ? 'admin' : profile?.store_id}`;
                const [collectionOrders, preAuctionOrders, auctionOrders] = await Promise.all([
                    JF.Cache.get(`${cacheKeyBase}_10_19`, () => this._getOverdueOrdersRange(profile, 10, 19), { ttl: 3 * 60 * 1000 }),
                    JF.Cache.get(`${cacheKeyBase}_20_29`, () => this._getOverdueOrdersRange(profile, 20, 29), { ttl: 3 * 60 * 1000 }),
                    JF.Cache.get(`${cacheKeyBase}_30_999`, () => this._getOverdueOrdersRange(profile, 30, 999), { ttl: 3 * 60 * 1000 })
                ]);

                const blacklistResult = await JF.Cache.get('blacklist_customers_0',
                    () => AnomalyPage._getBlacklistCustomers(0, 50),
                    { ttl: 3 * 60 * 1000 }
                );
                const blacklist = blacklistResult.data;
                const blacklistTotalCount = blacklistResult.totalCount;

                let top3 = [], bottom3 = [];
                if (isAdmin) {
                    const stores = await SUPABASE.getAllStores();
                    const rankingResult = await JF.Cache.get('monthly_store_ranking',
                        () => AnomalyPage._getMonthlyStoreRanking(stores),
                        { ttl: 5 * 60 * 1000 }
                    );
                    top3 = rankingResult.top3;
                    bottom3 = rankingResult.bottom3;
                }

                const buildStageCard = (cfg) => {
                    const { orders, stageKey, titleId, titleZh, icon, color, showAuctionBtn } = cfg;
                    if (orders.length === 0) {
                        return `<div class="anomaly-card" style="border-left:4px solid ${color}">
                            <div class="anomaly-card-header"><span class="anomaly-icon">${icon}</span><h3>${lang === 'id' ? titleId : titleZh}</h3><span class="anomaly-badge">0</span></div>
                            <div class="anomaly-card-body"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">${lang === 'id' ? 'Tidak ada pesanan' : '暂无订单'}</div></div></div>
                        </div>`;
                    }
                    let rows = '';
                    for (const o of orders) {
                        rows += `<tr>
                            <td class="order-id">${Utils.escapeHtml(o.order_id)}</td>
                            <td>${Utils.escapeHtml(o.customer_name)}</td>
                            <td class="text-center expense">${o.overdue_days || 0}</td>
                            <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                            <td class="text-center">
                                <button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm">👁️ ${lang==='id'?'Lihat':'查看'}</button>
                                ${stageKey==='collection'?`<button onclick="AnomalyPage.sendWAForStage('${Utils.escapeAttr(o.order_id)}','collection')" class="btn btn--sm" style="margin-left:4px;">📱 ${lang==='id'?'Kirim WA':'催收提醒'}</button>`:''}
                                ${stageKey==='pre_auction'?`<button onclick="AnomalyPage.sendWAForStage('${Utils.escapeAttr(o.order_id)}','pre_auction')" class="btn btn--sm" style="margin-left:4px;">📣 ${lang==='id'?'Pemberitahuan':'发送公告'}</button>`:''}
                                ${stageKey==='auction'&&showAuctionBtn?`<button onclick="AnomalyPage.startAuction('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--danger" style="margin-left:4px;">⚖️ ${lang==='id'?'Mulai Likuidasi':'启动变卖'}</button>`:''}
                            </td>
                        </tr>`;
                    }
                    const table = `<table class="data-table anomaly-table"><thead><tr><th class="col-id">${lang==='id'?'ID Pesanan':'订单号'}</th><th class="col-name">${lang==='id'?'Nama Nasabah':'客户姓名'}</th><th class="col-months text-center">${lang==='id'?'Hari Terlambat':'逾期天数'}</th><th class="col-amount amount">${lang==='id'?'Jumlah Pinjaman':'贷款金额'}</th><th class="text-center">${lang==='id'?'Aksi':'操作'}</th></tr></thead><tbody>${rows}</tbody></table>`;
                    let footer = '';
                    if (stageKey==='pre_auction') footer = `<div class="anomaly-card-footer"><span class="warning-text">💡 ${lang==='id'?'10 hari lagi memasuki proses likuidasi':'10天后将进入变卖程序'}</span></div>`;
                    else if (stageKey==='auction') footer = `<div class="anomaly-card-footer"><span class="danger-text">⚖️ ${lang==='id'?'Pesanan dalam proses likuidasi':'订单已进入变卖程序'}</span></div>`;
                    return `<div class="anomaly-card" style="border-left:4px solid ${color}">
                        <div class="anomaly-card-header"><span class="anomaly-icon">${icon}</span><h3>${lang==='id'?titleId:titleZh}</h3><span class="anomaly-badge">${orders.length}</span></div>
                        <div class="anomaly-card-body">${table}</div>
                        ${footer}
                    </div>`;
                };

                const stageCardsHtml = [
                    { stageKey:'collection', titleId:'Pengumpulan (10-19 Hari)', titleZh:'催收提醒期 (10-19天)', icon:'📞', color:'#f59e0b', orders:collectionOrders, showAuctionBtn:false },
                    { stageKey:'pre_auction', titleId:'Pemberitahuan (20-29 Hari)', titleZh:'公告预告期 (20-29天)', icon:'📣', color:'#f97316', orders:preAuctionOrders, showAuctionBtn:false },
                    { stageKey:'auction', titleId:'Likuidasi (30+ Hari)', titleZh:'正式变卖期 (≥30天)', icon:'⚖️', color:'#ef4444', orders:auctionOrders, showAuctionBtn:true }
                ].map(buildStageCard).join('');

                const buildBlacklistTable = () => {
                    if (!blacklist.length) return `<div class="empty-state"><div class="empty-state-icon">👍</div><div class="empty-state-text">${lang==='id'?'Tidak ada nasabah di blacklist':'暂无黑名单客户'}</div></div>`;
                    let rows = '';
                    for (const b of blacklist) {
                        rows += `<tr><td>${Utils.escapeHtml(b.customers?.customer_id || '-')}</td><td>${Utils.escapeHtml(b.customers?.name || '-')}</td><td>${Utils.escapeHtml(b.customers?.phone || '-')}</td><td>${Utils.escapeHtml(b.reason)}</td></tr>`;
                    }
                    let loadMoreHtml = '';
                    if (blacklistTotalCount > blacklist.length) {
                        loadMoreHtml = `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreBlacklist()" class="btn btn--sm btn--primary" id="blacklistLoadMoreBtn">⬇️ ${lang==='id'?'Muat Lebih Banyak':'加载更多'} (${blacklistTotalCount - blacklist.length} ${lang==='id'?'tersisa':'剩余'})</button></td></tr>`;
                    }
                    return `<div class="table-container"><table class="data-table anomaly-table"><thead><tr><th class="col-id">${lang==='id'?'ID Nasabah':'客户ID'}</th><th class="col-name">${lang==='id'?'Nama':'姓名'}</th><th class="col-phone">${lang==='id'?'Telepon':'电话'}</th><th>${lang==='id'?'Alasan':'原因'}</th></tr></thead><tbody>${rows}${loadMoreHtml}</tbody></table></div>`;
                };

                const buildRankingList = (stores, type) => {
                    if (!stores.length) return `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">${lang==='id'?'Belum ada data toko bulan ini':'本月暂无门店数据'}</div></div>`;
                    let items = '';
                    stores.forEach((s, idx) => {
                        const medal = type === 'top' ? (idx===0?'🥇':idx===1?'🥈':'🥉') : (idx===0?'🔴':idx===1?'🟡':'🟠');
                        const className = type==='top' ? (idx===0?'first':'') : (idx===0?'last':'');
                        items += `<div class="ranking-item ${className}">
                            <div class="ranking-number">${medal}</div>
                            <div class="ranking-info"><span class="ranking-name">${Utils.escapeHtml(s.name)}</span><span class="ranking-code">${Utils.escapeHtml(s.code)}</span></div>
                            <div class="ranking-count">${lang==='id'?'Pesanan':'订单'}: ${s.orderCount}<br>${lang==='id'?'Pinjaman':'贷款'}: ${Utils.formatCurrency(s.totalLoanOutflow)}<br>${lang==='id'?'Buruk':'不良'}: ${s.badOrders}<br>${lang==='id'?'Pemulihan':'回收'}: ${Utils.formatCurrency(s.totalRecovery)}</div>
                        </div>`;
                    });
                    return `<div class="ranking-list">${items}</div>`;
                };

                let contentGrid = '';
                if (!isAdmin) {
                    contentGrid = `
                        <div class="anomaly-grid">
                            ${stageCardsHtml}
                            <div class="anomaly-card anomaly-card-warning">
                                <div class="anomaly-card-header"><span class="anomaly-icon">🚫</span><h3>${lang==='id'?'Daftar Hitam Nasabah':'黑名单客户'}</h3><span class="anomaly-badge">${blacklistTotalCount}</span></div>
                                <div class="anomaly-card-body">${buildBlacklistTable()}</div>
                            </div>
                        </div>`;
                } else {
                    contentGrid = `
                        <div class="anomaly-grid">
                            <div class="anomaly-card anomaly-card-info">
                                <div class="anomaly-card-header"><span class="anomaly-icon">🏆</span><h3>${lang==='id'?'Kinerja Terbaik Bulan Ini (3 Besar)':'本月业绩前三'}</h3><span class="anomaly-badge">${top3.length}</span></div>
                                <div class="anomaly-card-body">${buildRankingList(top3, 'top')}</div>
                            </div>
                            <div class="anomaly-card anomaly-card-info">
                                <div class="anomaly-card-header"><span class="anomaly-icon">📉</span><h3>${lang==='id'?'Kinerja Terendah Bulan Ini (3 Besar)':'本月业绩后三'}</h3><span class="anomaly-badge">${bottom3.length}</span></div>
                                <div class="anomaly-card-body">${buildRankingList(bottom3, 'bottom')}</div>
                            </div>
                            ${stageCardsHtml}
                            <div class="anomaly-card anomaly-card-warning">
                                <div class="anomaly-card-header"><span class="anomaly-icon">🚫</span><h3>${lang==='id'?'Daftar Hitam Nasabah':'黑名单客户'}</h3><span class="anomaly-badge">${blacklistTotalCount}</span></div>
                                <div class="anomaly-card-body">${buildBlacklistTable()}</div>
                            </div>
                        </div>`;
                }

                const content = `
                    <div class="page-header"><h2>⚠️ ${t('anomaly_title')}</h2><div class="header-actions"><button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button><button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${t('print')}</button></div></div>
                    ${contentGrid}`;

                // 初始化黑名单加载状态（增加加载锁标志和按钮状态追踪）
                window._anomalyBlacklistState = { 
                    page: 0, 
                    pageSize: 50, 
                    totalCount: blacklistTotalCount,
                    isLoadingMore: false,
                    lastLoadTime: 0  // 【修复 #9】增加时间戳防止快速重复点击
                };
                return content;
            } catch (error) {
                console.error("buildAnomalyHTML error:", error);
                Utils.toast.error(Utils.t('loading_failed', { module: '异常页面' }));
                return `<div class="card"><p>❌ ${Utils.t('loading_failed', { module: '异常页面' })}</p></div>`;
            }
        },

        async sendWAForStage(orderId, stage) {
            const lang = Utils.lang;
            try {
                const order = await SUPABASE.getOrder(orderId);
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                const storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                const customerPhone = order.customer_phone;
                if (!customerPhone) { Utils.toast.warning(lang==='id'?'Nomor telepon nasabah tidak tersedia':'客户电话不存在'); return; }

                let msg = '';
                if (stage === 'collection') {
                    msg = lang === 'id'
                        ? `⚠️ *Peringatan Keterlambatan*\n\nKepada Yth. ${order.customer_name},\nPesanan Anda *${order.order_id}* telah *terlambat ${order.overdue_days} hari*.\n\nSegera lakukan pembayaran untuk menghindari tindakan lebih lanjut.\n\nTerima kasih.\n- JF! by Gadai`
                        : `⚠️ *逾期催收通知*\n\n尊敬的 ${order.customer_name}，\n您的订单 *${order.order_id}* 已逾期 *${order.overdue_days}* 天，请尽快缴费，避免进入下一步程序。\n\n- JF! by Gadai`;
                } else if (stage === 'pre_auction') {
                    msg = lang === 'id'
                        ? `📣 *PEMBERITAHUAN PENTING*\n\nKepada Yth. ${order.customer_name},\nPesanan Anda *${order.order_id}* telah *terlambat ${order.overdue_days} hari*.\n\nJika dalam *10 hari* ke depan tidak dilunasi, kami akan memulai proses *likuidasi barang jaminan*.\n\nSegera hubungi kami.\n- JF! by Gadai`
                        : `📣 *重要公告*\n\n尊敬的 ${order.customer_name}，\n您的订单 *${order.order_id}* 已逾期 *${order.overdue_days}* 天。若 *10天内* 仍未结清，将依法启动 *抵押物变卖*。\n\n请速联系处理。\n- JF! by Gadai`;
                } else {
                    msg = JF.WAPage.generateWAText(order, storeWA);
                }

                let cleanPhone = customerPhone.replace(/[^0-9]/g, '');
                if (!cleanPhone.startsWith('62')) {
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
                    else cleanPhone = '62' + cleanPhone;
                }
                window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                await SUPABASE.logReminder(order.id);
                Utils.toast.success(lang==='id'?'✅ Membuka WhatsApp...':'✅ 正在打开 WhatsApp...');
            } catch (error) {
                console.error("sendWAForStage error:", error);
                Utils.toast.error(lang==='id'?'Gagal mengirim pesan':'发送消息失败');
            }
        },

        async startAuction(orderId) {
            const lang = Utils.lang;
            const confirmed = await Utils.toast.confirm(lang==='id'
                ? '⚠️ Mulai proses likuidasi? Tindakan ini tidak dapat dibatalkan.'
                : '⚠️ 确定启动变卖程序？此操作不可逆。');
            if (!confirmed) return;
            try {
                const client = SUPABASE.getClient();
                const order = await SUPABASE.getOrder(orderId);
                if (!order) throw new Error('Order not found');
                await client.from('orders').update({
                    status: 'liquidated',
                    liquidation_status: 'liquidated',
                    fund_status: 'forfeited',
                    updated_at: Utils.getLocalDateTime()
                }).eq('order_id', orderId);
                await SUPABASE.recordCashFlow({
                    store_id: order.store_id,
                    flow_type: 'collateral_sale_principal',
                    direction: 'inflow',
                    amount: order.loan_amount,
                    source_target: 'cash',
                    order_id: order.id,
                    description: lang==='id'?'Likuidasi jaminan':'抵押物变卖',
                    reference_id: order.order_id
                });
                Utils.toast.success(lang==='id'?'✅ Proses likuidasi dimulai':'✅ 变卖程序已启动');
                if (JF.DashboardCore?.refreshCurrentPage) await JF.DashboardCore.refreshCurrentPage();
                else if (APP.showAnomaly) await APP.showAnomaly();
            } catch (error) {
                console.error("startAuction error:", error);
                Utils.toast.error(lang==='id'?'Gagal: '+error.message:'失败：'+error.message);
            }
        },

        // 【修复 #9】loadMoreBlacklist - 增强防重复机制
        async loadMoreBlacklist() {
            const state = window._anomalyBlacklistState;
            if (!state) return;
            
            // 防止重复点击（锁机制 + 时间戳双重保护）
            const now = Date.now();
            if (state.isLoadingMore) {
                return;
            }
            if (state.lastLoadTime && (now - state.lastLoadTime) < 1000) {
                Utils.toast.warning(Utils.lang === 'id' ? 'Mohon tunggu sebentar' : '请稍后再试', 1000);
                return;
            }
            
            state.isLoadingMore = true;
            state.lastLoadTime = now;
            
            const lang = Utils.lang;
            const loadMoreRow = document.querySelector('#blacklistLoadMoreRow');
            const btn = loadMoreRow?.querySelector('button');
            const originalBtnText = btn?.textContent || '';
            
            if (btn) { 
                btn.disabled = true; 
                btn.textContent = '⏳ ' + (lang==='id'?'Memuat...':'加载中...'); 
            }
            
            try {
                const nextPage = state.page + 1;
                const result = await AnomalyPage._getBlacklistCustomers(nextPage, state.pageSize);
                let newRows = '';
                for (const b of result.data) {
                    newRows += `<tr><td>${Utils.escapeHtml(b.customers?.customer_id||'-')}</td><td>${Utils.escapeHtml(b.customers?.name||'-')}</td><td>${Utils.escapeHtml(b.customers?.phone||'-')}</td><td>${Utils.escapeHtml(b.reason)}</td></tr>`;
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
                        const loadMoreHtml = `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreBlacklist()" class="btn btn--sm btn--primary" id="blacklistLoadMoreBtn">⬇️ ${lang==='id'?'Muat Lebih Banyak':'加载更多'} (${result.totalCount - loadedCount} ${lang==='id'?'tersisa':'剩余'})</button> </tr>`;
                        tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                    } else {
                        tbody.insertAdjacentHTML('beforeend', `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;color:var(--text-muted);">✅ ${lang==='id'?`Semua ${result.totalCount} data telah dimuat`:`已加载全部 ${result.totalCount} 条数据`}</tr>`);
                    }
                }
            } catch (err) {
                console.error("loadMoreBlacklist error:", err);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data' : '加载失败');
                // 恢复按钮状态
                const restoredRow = document.querySelector('#blacklistLoadMoreRow');
                const restoredBtn = restoredRow?.querySelector('button');
                if (restoredBtn) {
                    restoredBtn.disabled = false;
                    restoredBtn.textContent = originalBtnText || '⬇️ ' + (lang==='id'?'Muat Lebih Banyak':'加载更多');
                }
            } finally {
                state.isLoadingMore = false;
            }
        },

        clearAnomalyCache() {
            JF.Cache.clear();
            Utils.toast.info('缓存已清除', 2000);
        },

        async renderAnomalyHTML() { return await this.buildAnomalyHTML(); },
        async showAnomaly() {
            APP.currentPage = 'anomaly';
            APP.saveCurrentPageState();
            document.getElementById("app").innerHTML = await this.buildAnomalyHTML();
        }
    };

    // 挂载
    JF.AnomalyPage = AnomalyPage;
    window.APP = window.APP || {};
    window.APP.showAnomaly = AnomalyPage.showAnomaly.bind(AnomalyPage);
    window.APP.loadMoreBlacklist = AnomalyPage.loadMoreBlacklist.bind(AnomalyPage);
    window.APP.clearAnomalyCache = AnomalyPage.clearAnomalyCache.bind(AnomalyPage);

})();
