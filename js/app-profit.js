// app-profit.js - v2.0 (JF 命名空间) 
// 收益处置页面（利润再投入 / 偿还本金）

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
                if (!isAdmin) {
                    Utils.toast.warning(lang === 'id' ? 'Hanya admin' : '仅管理员可操作');
                    return;
                }

                // 管理员可能无 store_id，需要从门店列表选择
                const stores = await SUPABASE.getAllStores();
                const firstStoreId = profile?.store_id || stores[0]?.id;

                let distributableProfit = 0;
                let externalCapitalBalance = 0;

                if (firstStoreId) {
                    distributableProfit = await SUPABASE.getDistributableProfit(firstStoreId);
                    externalCapitalBalance = await SUPABASE.getExternalCapitalBalance(firstStoreId);
                }

                let storeSelectorHtml = '';
                if (!profile?.store_id) {
                    storeSelectorHtml = `
                        <div class="form-group">
                            <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'}</label>
                            <select id="distStoreSelect" onchange="JF.ProfitPage.refreshDistributionStats()">
                                ${stores.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.name)} (${s.code})</option>`).join('')}
                            </select>
                        </div>`;
                } else {
                    storeSelectorHtml = `<p><strong>🏪 ${lang === 'id' ? 'Toko' : '门店'}:</strong> ${Utils.escapeHtml(profile.stores?.name || '')}</p>`;
                }

                const content = `
                    <div class="page-header">
                        <h2>💸 ${lang === 'id' ? 'Distribusi Keuntungan' : '收益处置'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${t('back')}</button>
                        </div>
                    </div>

                    <div class="card">
                        <h3>📊 ${lang === 'id' ? 'Ringkasan' : '汇总'}</h3>
                        <div class="info-cards-row" style="margin-bottom:16px;">
                            <div class="info-item-card">
                                <div class="info-item-label">💰 ${lang === 'id' ? 'Keuntungan Dapat Dialokasi' : '可分配利润'}</div>
                                <div class="info-item-value" id="distributableValue">${Utils.formatCurrency(distributableProfit)}</div>
                            </div>
                            <div class="info-item-card">
                                <div class="info-item-label">🏦 ${lang === 'id' ? 'Modal Eksternal Tersedia' : '可偿还外部本金'}</div>
                                <div class="info-item-value" id="externalBalanceValue">${Utils.formatCurrency(externalCapitalBalance)}</div>
                            </div>
                        </div>
                        ${storeSelectorHtml}
                    </div>

                    <div class="card">
                        <h3>🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</h3>
                        <p>${lang === 'id' ? 'Ubah keuntungan menjadi modal tambahan untuk operasional gadai.' : '将利润转为资本，扩大可放贷资金池。'}</p>
                        <div class="form-group" style="max-width:300px;">
                            <label>${t('amount')} *</label>
                            <input type="text" id="reinvestAmount" class="amount-input" placeholder="0">
                        </div>
                        <div class="form-actions">
                            <button onclick="JF.ProfitPage.executeDistribution('reinvest')" class="btn btn--success">💾 ${lang === 'id' ? 'Reinvestasikan' : '执行再投入'}</button>
                        </div>
                    </div>

                    <div class="card">
                        <h3>📤 ${lang === 'id' ? 'Pengembalian Modal' : '偿还投资本金'}</h3>
                        <p>${lang === 'id' ? 'Kembalikan sebagian modal kepada investor.' : '返还部分投资给股东，回收本金。'}</p>
                        <div class="form-group" style="max-width:300px;">
                            <label>${t('amount')} *</label>
                            <input type="text" id="returnAmount" class="amount-input" placeholder="0">
                        </div>
                        <div class="form-actions">
                            <button onclick="JF.ProfitPage.executeDistribution('return_capital')" class="btn btn--warning">💸 ${lang === 'id' ? 'Kembalikan' : '偿还本金'}</button>
                        </div>
                    </div>
                `;

                document.getElementById('app').innerHTML = content;

                // 绑定金额输入格式化
                Utils.bindAmountFormat(document.getElementById('reinvestAmount'));
                Utils.bindAmountFormat(document.getElementById('returnAmount'));

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

    console.log('✅ JF.ProfitPage v2.0 重构完成（类名统一）');
})();
