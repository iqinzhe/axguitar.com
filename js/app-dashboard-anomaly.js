// app-dashboard-anomaly.js - v2.0 (JF 命名空间) 
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

            // 实时计算逾期：基于 next_interest_due_date 与今天的差值
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            // 逾期 minDays 对应的日期上限：today - minDays
            const maxDueDate = new Date(todayDate);
            maxDueDate.setDate(maxDueDate.getDate() - minDays);
            const maxDueDateStr = maxDueDate.toISOString().split('T')[0];
            // 逾期 maxDays 对应的日期下限：today - maxDays
            const minDueDate = new Date(todayDate);
            minDueDate.setDate(minDueDate.getDate() - maxDays);
            const minDueDateStr = minDueDate.toISOString().split('T')[0];

            let query = client
                .from('orders')
                .select('order_id, customer_name, next_interest_due_date, loan_amount, status')
                .eq('status', 'active')
                .not('next_interest_due_date', 'is', null)
                .lte('next_interest_due_date', maxDueDateStr)
                .gte('next_interest_due_date', minDueDateStr)
                .order('next_interest_due_date', { ascending: true });

            if (!isAdmin && storeId) {
                query = query.eq('store_id', storeId);
            } else if (isAdmin) {
                const practiceIds = await SUPABASE._getPracticeStoreIds();
                if (practiceIds.length > 0) {
                    query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                }
            }
            const { data, error } = await query;
            if (error) { debugLog('[WARN]','获取逾期订单失败:', error); return []; }

            // 前端补充实时 overdue_days 字段供显示用
            const todayStr = todayDate.toISOString().split('T')[0];
            return (data || []).map(o => {
                const dueDateStr = o.next_interest_due_date;
                const dueTime = new Date(dueDateStr).getTime();
                const overdueDays = Math.floor((todayDate.getTime() - dueTime) / (window.JF_TIME?.MS_DAY || 86400000));
                return { ...o, overdue_days: overdueDays };
            });
        },

        async _getBlacklistCustomers(page = 0, pageSize = 50) {
            const client = SUPABASE.getClient();
            const { data, error, count } = await client
                .from('blacklist')
                .select('*, customers!blacklist_customer_id_fkey(name, phone, customer_id)', { count: 'exact' })
                .order('blacklisted_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) { debugLog('[WARN]','获取黑名单失败:', error); return { data: [], totalCount: 0 }; }
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
                .select('id, store_id, loan_amount, status, created_at, custom_order_date, next_interest_due_date')
                .gte('created_at', monthStart)
                .lte('created_at', monthEnd);
            if (error) { debugLog('[WARN]','获取本月订单失败:', error); return { top3: [], bottom3: [] }; }

            // 实时计算逾期门店
            const todayForRanking = new Date();
            todayForRanking.setHours(0, 0, 0, 0);
            const todayRankStr = todayForRanking.toISOString().split('T')[0];

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
                // 实时判断逾期：next_interest_due_date 超过今天 15 天以上
                const isRealOverdue = order.status === 'active' &&
                    order.next_interest_due_date &&
                    order.next_interest_due_date < todayRankStr;
                const dueTime = order.next_interest_due_date ? new Date(order.next_interest_due_date).getTime() : null;
                const realOverdueDays = dueTime ? Math.floor((todayForRanking.getTime() - dueTime) / (window.JF_TIME?.MS_DAY || 86400000)) : 0;
                if (isRealOverdue && realOverdueDays >= 15) storeStats[order.store_id].badOrders++;
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
                    JF.Cache.get(`${cacheKeyBase}_1_7`, () => this._getOverdueOrdersRange(profile, 1, 7), { ttl: 3 * 60 * 1000 }),
                    JF.Cache.get(`${cacheKeyBase}_8_20`, () => this._getOverdueOrdersRange(profile, 8, 20), { ttl: 3 * 60 * 1000 }),
                    JF.Cache.get(`${cacheKeyBase}_21_999`, () => this._getOverdueOrdersRange(profile, 21, 999), { ttl: 3 * 60 * 1000 })
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
                            <td class="order-id">${Utils.escapeHtml(o.order_id)}<\/td>
                            <td>${Utils.escapeHtml(o.customer_name)}<\/td>
                            <td class="text-center expense">${o.overdue_days || 0}<\/td>
                            <td class="amount">${Utils.formatCurrency(o.loan_amount)}<\/td>
                            <td class="text-center">
                                <button onclick="APP.viewOrder('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm">👁️ ${lang==='id'?'Lihat':'查看'}<\/button>
                                ${stageKey==='collection'?`<button onclick="AnomalyPage.sendWAForStage('${Utils.escapeAttr(o.order_id)}','collection')" class="btn btn--sm" style="margin-left:4px;">📱 ${lang==='id'?'Kirim WA':'催收提醒'}<\/button>`:''}
                                ${stageKey==='pre_auction'?`<button onclick="AnomalyPage.sendWAForStage('${Utils.escapeAttr(o.order_id)}','pre_auction')" class="btn btn--sm" style="margin-left:4px;">📣 ${lang==='id'?'Pemberitahuan':'发送公告'}<\/button>`:''}
                                ${stageKey==='auction'&&showAuctionBtn?`<button onclick="AnomalyPage.startAuction('${Utils.escapeAttr(o.order_id)}')" class="btn btn--sm btn--danger" style="margin-left:4px;">⚖️ ${lang==='id'?'Mulai Likuidasi':'启动变卖'}<\/button>`:''}
                            <\/td>
                        </tr>`;
                    }
                    const table = `<table class="data-table anomaly-table"><thead><tr><th class="col-id">${lang==='id'?'ID Pesanan':'订单号'}</th><th class="col-name">${lang==='id'?'Nama Nasabah':'客户姓名'}</th><th class="col-months text-center">${lang==='id'?'Hari Terlambat':'逾期天数'}</th><th class="col-amount amount">${lang==='id'?'Jumlah Pinjaman':'贷款金额'}</th><th class="text-center">${lang==='id'?'Aksi':'操作'}</th></tr></thead><tbody>${rows}</tbody></table>`;
                    let footer = '';
                    if (stageKey==='pre_auction') footer = `<div class="anomaly-card-footer"><span class="warning-text">💡 ${lang==='id'?'Segera akan memasuki proses likuidasi':'即将进入变卖程序'}</span></div>`;
                    else if (stageKey==='auction') footer = `<div class="anomaly-card-footer"><span class="danger-text">⚖️ ${lang==='id'?'Pesanan dalam proses likuidasi':'订单已进入变卖程序'}</span></div>`;
                    return `<div class="anomaly-card" style="border-left:4px solid ${color}">
                        <div class="anomaly-card-header"><span class="anomaly-icon">${icon}</span><h3>${lang==='id'?titleId:titleZh}</h3><span class="anomaly-badge">${orders.length}</span></div>
                        <div class="anomaly-card-body">${table}</div>
                        ${footer}
                    </div>`;
                };

                const stageCardsHtml = [
                    { stageKey:'collection', titleId:'Pengumpulan (1-7 Hari)', titleZh:'催收提醒期 (1-7天)', icon:'📞', color:'#f59e0b', orders:collectionOrders, showAuctionBtn:false },
                    { stageKey:'pre_auction', titleId:'Pemberitahuan (8-20 Hari)', titleZh:'公告预告期 (8-20天)', icon:'📣', color:'#f97316', orders:preAuctionOrders, showAuctionBtn:false },
                    { stageKey:'auction', titleId:'Likuidasi (21+ Hari)', titleZh:'正式变卖期 (≥21天)', icon:'⚖️', color:'#ef4444', orders:auctionOrders, showAuctionBtn:true }
                ].map(buildStageCard).join('');

                const buildBlacklistTable = () => {
                    if (!blacklist.length) return `<div class="empty-state"><div class="empty-state-icon">👍</div><div class="empty-state-text">${lang==='id'?'Tidak ada nasabah di blacklist':'暂无黑名单客户'}</div></div>`;
                    let rows = '';
                    for (const b of blacklist) {
                        rows += `<tr><td>${Utils.escapeHtml(b.customers?.customer_id || '-')}<\/td><td>${Utils.escapeHtml(b.customers?.name || '-')}<\/td><td>${Utils.escapeHtml(b.customers?.phone || '-')}<\/td><td>${Utils.escapeHtml(b.reason)}<\/td></tr>`;
                    }
                    let loadMoreHtml = '';
                    if (blacklistTotalCount > blacklist.length) {
                        loadMoreHtml = `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreBlacklist()" class="btn btn--sm btn--primary" id="blacklistLoadMoreBtn">⬇️ ${lang==='id'?'Muat Lebih Banyak':'加载更多'} (${blacklistTotalCount - blacklist.length} ${lang==='id'?'tersisa':'剩余'})</button><\/td><\/tr>`;
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
                    lastLoadTime: 0  // 增加时间戳防止快速重复点击
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
            // BUG-03修复：原来一律以 loan_amount 按 collateral_sale_principal 入账，
            // 既不区分盈余/亏损，也不支持填写实际变卖金额，导致资金台账严重失真。
            // 修复：弹出实际变卖金额输入框，并按本金回收/利息回收/盈余/亏损分拆流水。
            const lang = Utils.lang;
            const client = SUPABASE.getClient();

            // 第一步：获取订单信息
            let order;
            try {
                order = await SUPABASE.getOrder(orderId);
                if (!order) throw new Error('Order not found');
            } catch(e) {
                Utils.toast.error(lang==='id'?'Gagal memuat pesanan: '+e.message:'加载订单失败：'+e.message);
                return;
            }

            const loanAmount = order.loan_amount || 0;
            const accruedInterest = (order.monthly_interest || 0) + (order.interest_shortfall || 0);
            const totalOwed = loanAmount + accruedInterest;

            // 第二步：询问实际变卖金额
            const promptMsg = lang==='id'
                ? `⚖️ Konfirmasi Likuidasi Jaminan

Pesanan: ${order.order_id}
Nasabah: ${order.customer_name}

Pokok: ${Utils.formatCurrency(loanAmount)}
Bunga terutang: ${Utils.formatCurrency(accruedInterest)}
Total tagihan: ${Utils.formatCurrency(totalOwed)}

Masukkan harga jual aktual jaminan (Rp):`
                : `⚖️ 确认变卖抵押物

订单号：${order.order_id}
客户：${order.customer_name}

本金：${Utils.formatCurrency(loanAmount)}
应收利息：${Utils.formatCurrency(accruedInterest)}
合计应收：${Utils.formatCurrency(totalOwed)}

请输入实际变卖所得金额（Rp）：`;

            const inputStr = prompt(promptMsg, Utils.formatNumberWithCommas ? Utils.formatNumberWithCommas(loanAmount) : String(loanAmount));
            if (inputStr === null) return; // 用户取消

            const salePrice = Utils.parseNumberFromCommas ? Utils.parseNumberFromCommas(inputStr) : parseFloat(inputStr.replace(/[,.]/g, ''));
            if (isNaN(salePrice) || salePrice < 0) {
                Utils.toast.warning(lang==='id'?'Jumlah tidak valid':'金额无效');
                return;
            }

            // 第三步：最终确认
            const surplus = salePrice - totalOwed;
            const summaryMsg = lang==='id'
                ? `📊 Ringkasan Likuidasi:

Harga jual: ${Utils.formatCurrency(salePrice)}
Pokok kembali: ${Utils.formatCurrency(Math.min(salePrice, loanAmount))}
Bunga kembali: ${Utils.formatCurrency(Math.max(0, Math.min(salePrice - loanAmount, accruedInterest)))}
${surplus > 0 ? 'Surplus: ' + Utils.formatCurrency(surplus) : surplus < 0 ? 'Kurang (rugi): ' + Utils.formatCurrency(Math.abs(surplus)) : 'Impas'}

⚠️ Tindakan ini tidak dapat dibatalkan!
Lanjutkan?`
                : `📊 变卖结算预览：

变卖所得：${Utils.formatCurrency(salePrice)}
回收本金：${Utils.formatCurrency(Math.min(salePrice, loanAmount))}
回收利息：${Utils.formatCurrency(Math.max(0, Math.min(salePrice - loanAmount, accruedInterest)))}
${surplus > 0 ? '盈余：'+Utils.formatCurrency(surplus) : surplus < 0 ? '亏损：'+Utils.formatCurrency(Math.abs(surplus)) : '持平'}

⚠️ 此操作不可逆！
确认变卖？`;

            const confirmed = await Utils.toast.confirm(summaryMsg);
            if (!confirmed) return;

            try {
                const today = Utils.getLocalToday();

                // 更新订单状态
                await client.from('orders').update({
                    status: 'liquidated',
                    liquidation_status: 'liquidated',
                    fund_status: 'forfeited',
                    updated_at: Utils.getLocalDateTime()
                }).eq('order_id', orderId);

                // 拆分流水：本金回收部分
                const principalRecovered = Math.min(salePrice, loanAmount);
                if (principalRecovered > 0) {
                    await SUPABASE.recordCashFlow({
                        store_id: order.store_id,
                        flow_type: 'collateral_sale_principal',
                        direction: 'inflow',
                        amount: principalRecovered,
                        source_target: 'cash',
                        order_id: order.id,
                        description: (lang==='id'?'Likuidasi - Pokok':'变卖-本金回收') + ' - ' + order.order_id,
                        reference_id: order.order_id,
                        flow_date: today
                    });
                }

                // 拆分流水：利息回收部分
                const remaining1 = salePrice - principalRecovered;
                const interestRecovered = Math.max(0, Math.min(remaining1, accruedInterest));
                if (interestRecovered > 0) {
                    await SUPABASE.recordCashFlow({
                        store_id: order.store_id,
                        flow_type: 'collateral_sale_interest',
                        direction: 'inflow',
                        amount: interestRecovered,
                        source_target: 'cash',
                        order_id: order.id,
                        description: (lang==='id'?'Likuidasi - Bunga':'变卖-利息回收') + ' - ' + order.order_id,
                        reference_id: order.order_id,
                        flow_date: today
                    });
                }

                // 拆分流水：盈余或亏损
                if (surplus > 0) {
                    await SUPABASE.recordCashFlow({
                        store_id: order.store_id,
                        flow_type: 'collateral_sale_surplus',
                        direction: 'inflow',
                        amount: surplus,
                        source_target: 'cash',
                        order_id: order.id,
                        description: (lang==='id'?'Likuidasi - Surplus':'变卖-盈余') + ' - ' + order.order_id,
                        reference_id: order.order_id,
                        flow_date: today
                    });
                } else if (surplus < 0) {
                    await SUPABASE.recordCashFlow({
                        store_id: order.store_id,
                        flow_type: 'collateral_sale_loss',
                        direction: 'outflow',
                        amount: Math.abs(surplus),
                        source_target: 'cash',
                        order_id: order.id,
                        description: (lang==='id'?'Likuidasi - Rugi':'变卖-亏损') + ' - ' + order.order_id,
                        reference_id: order.order_id,
                        flow_date: today
                    });
                }

                Utils.toast.success(lang==='id'?'✅ Likuidasi selesai dicatat':'✅ 变卖流水已全部记录');
                if (JF.DashboardCore?.refreshCurrentPage) await JF.DashboardCore.refreshCurrentPage();
                else if (APP.showAnomaly) await APP.showAnomaly();
            } catch (error) {
                console.error("startAuction error:", error);
                Utils.toast.error(lang==='id'?'Gagal: '+error.message:'失败：'+error.message);
            }
        },

        // 加载更多黑名单 - 时间限
        async loadMoreBlacklist() {
            const state = window._anomalyBlacklistState;
            if (!state) return;
            
            // 防止重复点击（锁机制 + 时间戳双重保护）
            const now = Date.now();
            if (state.isLoadingMore) {
                return;
            }
            // 时间限制
            if (state.lastLoadTime && (now - state.lastLoadTime) < 500) {
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
                    newRows += `<tr><td>${Utils.escapeHtml(b.customers?.customer_id||'-')}<\/td><td>${Utils.escapeHtml(b.customers?.name||'-')}<\/td><td>${Utils.escapeHtml(b.customers?.phone||'-')}<\/td><td>${Utils.escapeHtml(b.reason)}<\/td><\/tr>`;
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
                        const loadMoreHtml = `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;"><button onclick="APP.loadMoreBlacklist()" class="btn btn--sm btn--primary" id="blacklistLoadMoreBtn">⬇️ ${lang==='id'?'Muat Lebih Banyak':'加载更多'} (${result.totalCount - loadedCount} ${lang==='id'?'tersisa':'剩余'})</button><\/td><\/tr>`;
                        tbody.insertAdjacentHTML('beforeend', loadMoreHtml);
                    } else {
                        tbody.insertAdjacentHTML('beforeend', `<tr id="blacklistLoadMoreRow"><td colspan="4" style="text-align:center;padding:10px;color:var(--text-muted);">✅ ${lang==='id'?`Semua ${result.totalCount} data telah dimuat`:`已加载全部 ${result.totalCount} 条数据`}<\/td><\/tr>`);
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
