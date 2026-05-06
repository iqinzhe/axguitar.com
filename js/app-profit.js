// app-profit.js - v2.2 (JF 命名空间)
// 收益处置页面（利润再投入 / 偿还本金）
// v2.1：store_manager 可处置本店收益（admin 可处置所有门店）
// v2.2：电脑端3列布局，手机端单列布局

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const ProfitPage = {
        async showDistributionPage() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = profile?.role === 'admin';
                const isStoreManager = profile?.role === 'store_manager';

                // 仅 admin 和 store_manager 可操作
                if (!isAdmin && !isStoreManager) {
                    Utils.toast.warning(lang === 'id' ? 'Hanya admin atau manajer toko' : '仅管理员或分店经理可操作');
                    return;
                }

                // admin 可选择任意门店；store_manager 锁定本店
                const stores = isAdmin ? await SUPABASE.getAllStores() : null;
                const firstStoreId = isAdmin
                    ? (profile?.store_id || stores[0]?.id)
                    : profile?.store_id;

                if (!firstStoreId) {
                    Utils.toast.warning(lang === 'id' ? 'Toko tidak ditemukan' : '未找到关联门店，请联系管理员');
                    return;
                }

                let distributableProfit = 0;
                let externalCapitalBalance = 0;

                if (firstStoreId) {
                    distributableProfit = await SUPABASE.getDistributableProfit(firstStoreId);
                    externalCapitalBalance = await SUPABASE.getExternalCapitalBalance(firstStoreId);
                }

                let storeSelectorHtml = '';
                if (isAdmin && !profile?.store_id) {
                    // admin 无固定门店：显示下拉选择器
                    storeSelectorHtml = `
                        <div class="form-group" style="margin-top: 12px;">
                            <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'}</label>
                            <select id="distStoreSelect" onchange="JF.ProfitPage.refreshDistributionStats()" style="width:100%;padding:8px;border-radius:6px;">
                                ${stores.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.name)} (${s.code})</option>`).join('')}
                            </select>
                        </div>`;
                } else {
                    // admin 绑定了门店 或 store_manager：显示只读门店名，不允许切换
                    const storeName = profile?.stores?.name || profile?.store_name || firstStoreId;
                    storeSelectorHtml = `
                        <p style="margin-top: 12px; margin-bottom: 0; padding: 8px; background: var(--bg-hover); border-radius: 6px;">
                            <strong>🏪 ${lang === 'id' ? 'Toko' : '门店'}:</strong> ${Utils.escapeHtml(storeName)}
                        </p>
                        <input type="hidden" id="distStoreSelect" value="${firstStoreId}">
                    `;
                }

                // 添加响应式样式（如果还没有添加过）
                if (!document.getElementById('profitPageStyles')) {
                    const style = document.createElement('style');
                    style.id = 'profitPageStyles';
                    style.textContent = `
                        .profit-cards-grid {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 16px;
                            align-items: stretch;
                        }
                        @media (max-width: 768px) {
                            .profit-cards-grid {
                                grid-template-columns: 1fr !important;
                                gap: 12px !important;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }

                const content = `
                    <div class="page-header">
                        <h2>💸 ${lang === 'id' ? 'Distribusi Keuntungan' : '收益处置'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        </div>
                    </div>

                    <div class="profit-cards-grid">
                        <!-- 汇总卡片 -->
                        <div class="card" style="margin-bottom: 0; display: flex; flex-direction: column;">
                            <h3>📊 ${lang === 'id' ? 'Ringkasan' : '汇总'}</h3>
                            <div style="flex: 1;">
                                <div class="info-item-card">
                                    <div class="info-item-label">💰 ${lang === 'id' ? 'Keuntungan Dapat Dialokasi' : '可分配利润'}</div>
                                    <div class="info-item-value" id="distributableValue">${Utils.formatCurrency(distributableProfit)}</div>
                                </div>
                                <div class="info-item-card" style="margin-top: 16px;">
                                    <div class="info-item-label">🏦 ${lang === 'id' ? 'Modal Eksternal Tersedia' : '可偿还外部本金'}</div>
                                    <div class="info-item-value" id="externalBalanceValue">${Utils.formatCurrency(externalCapitalBalance)}</div>
                                </div>
                            </div>
                            ${storeSelectorHtml}
                        </div>
                        
                        <!-- 利润再投入卡片 -->
                        <div class="card" style="margin-bottom: 0; display: flex; flex-direction: column;">
                            <h3>🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</h3>
                            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; flex: 1;">${lang === 'id' ? 'Ubah keuntungan menjadi modal tambahan untuk operasional gadai.' : '将利润转为资本，扩大可放贷资金池。'}</p>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label>${t('amount')} *</label>
                                <input type="text" id="reinvestAmount" class="amount-input" placeholder="0" style="width: 100%;">
                            </div>
                            <button onclick="JF.ProfitPage.executeDistribution('reinvest')" class="btn btn--success" style="width: 100%;">💾 ${lang === 'id' ? 'Reinvestasikan' : '执行再投入'}</button>
                        </div>
                        
                        <!-- 偿还投资本金卡片 -->
                        <div class="card" style="margin-bottom: 0; display: flex; flex-direction: column;">
                            <h3>📤 ${lang === 'id' ? 'Pengembalian Modal' : '偿还投资本金'}</h3>
                            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; flex: 1;">${lang === 'id' ? 'Kembalikan sebagian modal kepada investor.' : '返还部分投资给股东，回收本金。'}</p>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label>${t('amount')} *</label>
                                <input type="text" id="returnAmount" class="amount-input" placeholder="0" style="width: 100%;">
                            </div>
                            <button onclick="JF.ProfitPage.executeDistribution('return_capital')" class="btn btn--warning" style="width: 100%;">💸 ${lang === 'id' ? 'Kembalikan' : '偿还本金'}</button>
                        </div>
                    </div>
                `;

                document.getElementById('app').innerHTML = content;

                // 绑定金额输入格式化
                const reinvestInput = document.getElementById('reinvestAmount');
                const returnInput = document.getElementById('returnAmount');
                if (reinvestInput && Utils.bindAmountFormat) Utils.bindAmountFormat(reinvestInput);
                if (returnInput && Utils.bindAmountFormat) Utils.bindAmountFormat(returnInput);

            } catch (error) {
                console.error(error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat halaman' : '页面加载失败');
            }
        },

        async refreshDistributionStats() {
            const storeId = document.getElementById('distStoreSelect')?.value;
            if (!storeId) return;
            const distributable = await SUPABASE.getDistributableProfit(storeId);
            const external = await SUPABASE.getExternalCapitalBalance(storeId);
            document.getElementById('distributableValue').textContent = Utils.formatCurrency(distributable);
            document.getElementById('externalBalanceValue').textContent = Utils.formatCurrency(external);
        },

        async executeDistribution(type) {
            const lang = Utils.lang;
            const storeSelect = document.getElementById('distStoreSelect');
            const storeId = storeSelect?.value || AUTH.user?.store_id;
            if (!storeId) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }

            const amountField = type === 'reinvest' ? 'reinvestAmount' : 'returnAmount';
            const amountStr = document.getElementById(amountField)?.value || '0';
            const amount = Utils.parseNumberFromCommas(amountStr);
            if (!amount || amount <= 0) {
                Utils.toast.warning(Utils.t('invalid_amount'));
                return;
            }

            const confirmMsg = lang === 'id'
                ? `⚠️ Konfirmasi ${type === 'reinvest' ? 'Reinvestasi' : 'Pengembalian Modal'}\n\nJumlah: ${Utils.formatCurrency(amount)}\n\nLanjutkan?`
                : `⚠️ 确认${type === 'reinvest' ? '再投入' : '偿还本金'}\n\n金额: ${Utils.formatCurrency(amount)}\n\n继续?`;

            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;

            try {
                await SUPABASE.distributeProfit(storeId, amount, type);
                Utils.toast.success(lang === 'id' ? '✅ Operasi berhasil' : '✅ 操作成功');
                JF.Cache.clear();
                APP.goBack();
            } catch (error) {
                Utils.toast.error(error.message);
            }
        }
    };

    // 挂载到命名空间和全局 APP
    JF.ProfitPage = ProfitPage;
    window.APP = window.APP || {};
    window.APP.showDistributionPage = ProfitPage.showDistributionPage.bind(ProfitPage);

    console.log('✅ JF.ProfitPage v2.2 更新完成（电脑端3列布局，手机端单列）');
})();
