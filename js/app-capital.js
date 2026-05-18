// app-capital.js - v2.0 (JF 命名空间) 
// 门店选择状态持久化（使用 sessionStorage 替代全局变量）
// 包含：资本注入、利润再投入、资金占用报告、资金健康度评估

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const CapitalModule = {

        // ==================== 资本注入 ====================
        showCapitalInjectionModal: async function() {
            const lang = Utils.lang;
            const stores = await SUPABASE.getAllStores();
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' 
                    ? 'Hanya administrator yang dapat mencatat injeksi modal' 
                    : '仅管理员可记录资本注入');
                return;
            }
            
            let storeOptions = '';
            storeOptions = '<select id="injectionStoreId" class="full-width" style="width:100%;padding:10px;border-radius:8px;">';
            for (const store of stores) {
                if (store.code !== 'STORE_000' && (store.is_active !== false)) {
                    storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)} (${store.code})</option>`;
                }
            }
            storeOptions += '</select>';
            
            let storeBalancesHtml = '';
            try {
                const client = SUPABASE.getClient();
                const { data: injections } = await client
                    .from('capital_injections')
                    .select('store_id, amount')
                    .eq('is_voided', false);
                
                const storeCapitalMap = {};
                for (const inj of (injections || [])) {
                    storeCapitalMap[inj.store_id] = (storeCapitalMap[inj.store_id] || 0) + (inj.amount || 0);
                }

                const { data: activeOrders } = await client
                    .from('orders')
                    .select('store_id, loan_amount')
                    .eq('status', 'active');
                
                const storeDeployedMap = {};
                for (const o of (activeOrders || [])) {
                    storeDeployedMap[o.store_id] = (storeDeployedMap[o.store_id] || 0) + (o.loan_amount || 0);
                }

                storeBalancesHtml = `
                    <div class="info-bar info" style="margin:8px 0;font-size:11px;">
                        <span class="info-bar-icon">📊</span>
                        <div class="info-bar-content">
                            <strong>${lang === 'id' ? 'Status Modal per Toko:' : '各门店资本状况:'}</strong>
                            <div style="margin-top:4px;max-height:120px;overflow-y:auto;">
                                ${stores.filter(s => s.code !== 'STORE_000' && s.is_active !== false).map(s => {
                                    const capital = storeCapitalMap[s.id] || 0;
                                    const deployed = storeDeployedMap[s.id] || 0;
                                    const available = capital - deployed;
                                    return `<div style="margin:2px 0;">🏪 ${Utils.escapeHtml(s.name)}: 
                                        💉 ${Utils.formatCurrency(capital)} | 
                                        📋 ${Utils.formatCurrency(deployed)} | 
                                        ✅ ${Utils.formatCurrency(available)}</div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>`;
            } catch (e) {
                console.warn('获取门店资本状况失败:', e);
            }
            
            const modalHtml = `
                <div id="capitalInjectionModal" class="modal-overlay">
                    <div class="modal-content" style="max-width: 600px; width: 90%;">
                        <h3>💰 ${lang === 'id' ? 'Injeksi Modal Baru' : '新增资本注入'}</h3>
                        
                        <div class="form-group">
                            <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'} *</label>
                            ${storeOptions}
                            <div class="form-hint">${lang === 'id' ? 'Pilih toko yang akan menerima injeksi modal' : '选择要注入资金的门店'}</div>
                        </div>
                        
                        ${storeBalancesHtml}
                        
                        <div class="form-group">
                            <label>💰 ${lang === 'id' ? 'Jumlah Injeksi' : '注入金额'} *</label>
                            <input type="text" id="injectionAmount" placeholder="0" class="amount-input" style="width:100%;padding:10px;border-radius:8px;">
                            <div class="form-hint">${lang === 'id' ? 'Masukkan jumlah dalam Rupiah' : '请输入印尼盾金额'}</div>
                        </div>
                        
                        <div class="form-group">
                            <label>🏦 ${lang === 'id' ? 'Sumber Dana' : '资金来源'}</label>
                            <div class="payment-method-selector">
                                <label><input type="radio" name="injectionSource" value="cash" checked> 🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</label>
                                <label><input type="radio" name="injectionSource" value="bank"> 🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</label>
                            </div>
                            <div class="form-hint">${lang === 'id' ? 'Dana akan dicatat masuk ke sumber ini' : '资金将记入此来源'}</div>
                        </div>
                        
                        <div class="form-group">
                            <label>📝 ${lang === 'id' ? 'Deskripsi' : '描述'}</label>
                            <textarea id="injectionDesc" rows="2" placeholder="${lang === 'id' ? 'Contoh: Modal awal toko, Tambahan modal operasional' : '例如: 门店启动资金、运营追加资本'}" style="width:100%;border-radius:8px;"></textarea>
                        </div>
                        
                        <div class="info-bar info" style="margin: 12px 0;">
                            <span class="info-bar-icon">💡</span>
                            <div class="info-bar-content">
                                ${lang === 'id' 
                                    ? 'Injeksi modal akan meningkatkan total modal toko. Dana akan tercatat sebagai arus kas masuk dan dapat digunakan untuk operasional gadai.' 
                                    : '资本注入将增加门店总资本。资金将记录为现金流入，可用于典当业务运营。'}
                            </div>
                        </div>
                        
                        <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;">
                            <button onclick="APP.saveCapitalInjection()" id="saveInjectionBtn" class="btn btn--success" style="padding:8px 20px;">💾 ${lang === 'id' ? 'Simpan' : '保存'}</button>
                            <button onclick="APP.closeCapitalInjectionModal()" class="btn btn--outline" style="padding:8px 20px;">✖ ${lang === 'id' ? 'Batal' : '取消'}</button>
                        </div>
                    </div>
                </div>
            `;
            
            const oldModal = document.getElementById('capitalInjectionModal');
            if (oldModal) oldModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            const amountInput = document.getElementById('injectionAmount');
            if (amountInput && Utils.bindAmountFormat) {
                Utils.bindAmountFormat(amountInput);
            }
        },
        
        closeCapitalInjectionModal: function() {
            const modal = document.getElementById('capitalInjectionModal');
            if (modal) modal.remove();
        },
        
        saveCapitalInjection: async function() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            if (!isAdmin) {
                Utils.toast.error(lang === 'id' ? 'Hanya admin yang dapat mencatat injeksi modal' : '仅管理员可记录资本注入');
                return;
            }
            
            const storeSelect = document.getElementById('injectionStoreId');
            if (!storeSelect || !storeSelect.value) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
            const storeId = storeSelect.value;
            
            const amountStr = document.getElementById('injectionAmount')?.value || '0';
            const amount = Utils.parseNumberFromCommas(amountStr);
            const source = document.querySelector('input[name="injectionSource"]:checked')?.value || 'cash';
            const description = document.getElementById('injectionDesc')?.value.trim() || 
                (lang === 'id' ? 'Injeksi modal' : '资本注入');
            
            if (amount <= 0) {
                Utils.toast.warning(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
                return;
            }
            
            const storeName = document.getElementById('injectionStoreId')?.selectedOptions?.[0]?.text || '';
            
            const confirmMsg = lang === 'id'
                ? `⚠️ Konfirmasi Injeksi Modal\n\nToko: ${storeName}\nJumlah: ${Utils.formatCurrency(amount)}\nSumber: ${source === 'cash' ? 'Tunai (Brankas)' : 'Bank BNI'}\nDeskripsi: ${description}\n\nLanjutkan?`
                : `⚠️ 确认资本注入\n\n门店: ${storeName}\n金额: ${Utils.formatCurrency(amount)}\n来源: ${source === 'cash' ? '现金 (保险柜)' : '银行 BNI'}\n描述: ${description}\n\n确认继续？`;
            
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;
            
            const saveBtn = document.getElementById('saveInjectionBtn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
            }
            
            try {
                await SUPABASE.recordCapitalInjection(storeId, amount, source, description);
                
                Utils.toast.success(lang === 'id' 
                    ? `✅ Injeksi modal ${Utils.formatCurrency(amount)} berhasil dicatat ke ${storeName}`
                    : `✅ 资本注入 ${Utils.formatCurrency(amount)} 已记录到 ${storeName}`);
                
                APP.closeCapitalInjectionModal();
                
                if (JF.Cache) JF.Cache.clear();
                if (typeof window.DashboardCore !== 'undefined' && DashboardCore.refreshCurrentPage) {
                    await DashboardCore.refreshCurrentPage();
                } else if (typeof APP.renderDashboard === 'function') {
                    await APP.renderDashboard();
                } else {
                    location.reload();
                }
                
            } catch (error) {
                console.error('saveCapitalInjection error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = lang === 'id' ? 'Simpan' : '保存';
                }
            }
        },
        
        // ==================== 利润再投入页面 ====================
        showProfitReinvestPage: async function() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            try {
                let stores = [];
                if (isAdmin) {
                    stores = await SUPABASE.getAllStores();
                }
                
                let currentStoreId = profile?.store_id;
                if (isAdmin && stores.length > 0 && !currentStoreId) {
                    // 从 sessionStorage 恢复门店选择状态
                    const savedStoreId = sessionStorage.getItem('jf_profit_reinvest_store_id');
                    if (savedStoreId && stores.some(s => s.id === savedStoreId)) {
                        currentStoreId = savedStoreId;
                    } else {
                        currentStoreId = stores[0]?.id;
                    }
                }
                
                let analysis = null;
                if (currentStoreId) {
                    analysis = await SUPABASE.getFullCapitalAnalysis(currentStoreId);
                } else if (stores.length > 0) {
                    analysis = await SUPABASE.getFullCapitalAnalysis(stores[0].id);
                } else {
                    analysis = await SUPABASE.getFullCapitalAnalysis();
                }
                
                // 保存到 sessionStorage 持久化
                if (currentStoreId) {
                    sessionStorage.setItem('jf_profit_reinvest_store_id', currentStoreId);
                }
                window._currentProfitStoreId = currentStoreId;
                
                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${lang === 'id' ? 'Kembali' : '返回'}</button>
                            <button onclick="APP.printCurrentPage()" class="btn btn--outline">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        </div>
                    </div>
                    
                    ${isAdmin ? `
                    <div class="card">
                        <div class="form-group" style="max-width: 300px;">
                            <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'}</label>
                            <select id="reinvestStoreSelect" onchange="APP.loadProfitReinvestData()" style="width:100%;padding:10px;border-radius:8px;">
                                <option value="">${lang === 'id' ? 'Semua Toko' : '全部门店'}</option>
                                ${stores.filter(s => s.code !== 'STORE_000').map(s => `
                                    <option value="${s.id}" ${currentStoreId === s.id ? 'selected' : ''}>${Utils.escapeHtml(s.name)} (${s.code})</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="card capital-composition-card">
                        <h3>💰 ${lang === 'id' ? 'Komposisi Modal' : '资本构成'}</h3>
                        <div class="capital-composition-stats">
                            <div class="composition-item">
                                <div class="composition-label">🏦 ${lang === 'id' ? 'Injeksi Eksternal' : '外部注资'}</div>
                                <div class="composition-value" id="externalCapitalValue">${Utils.formatCurrency(analysis?.capital_breakdown?.external_injections || 0)}</div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</div>
                                <div class="composition-value success" id="profitReinvestedValue">${Utils.formatCurrency(analysis?.capital_breakdown?.profit_reinvestments || 0)}</div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">📊 ${lang === 'id' ? 'Total Modal' : '总资本'}</div>
                                <div class="composition-value primary" id="totalCapitalValue">${Utils.formatCurrency(analysis?.capital_breakdown?.total_capital || 0)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card profit-stats-card">
                        <h3>📈 ${lang === 'id' ? 'Statistik Keuntungan' : '利润统计'}</h3>
                        <div class="profit-stats-grid">
                            <div class="stat-item">
                                <div class="stat-label">💰 ${lang === 'id' ? 'Keuntungan Kumulatif' : '累计利润'}</div>
                                <div class="stat-value" id="cumulativeProfitValue">${Utils.formatCurrency(analysis?.cumulative_profit || 0)}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">🔄 ${lang === 'id' ? 'Sudah Direinvest' : '已再投入'}</div>
                                <div class="stat-value success" id="reinvestedProfitValue">${Utils.formatCurrency(analysis?.reinvested_profit || 0)}</div>
                                <div class="stat-sub" id="reinvestRateValue">(${(analysis?.profit_reinvest_rate || 0).toFixed(1)}%)</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">⏳ ${lang === 'id' ? 'Siap Direinvest' : '待再投入'}</div>
                                <div class="stat-value warning" id="pendingProfitValue">${Utils.formatCurrency(analysis?.pending_reinvest_profit || 0)}</div>
                            </div>
                        </div>
                        
                        <div id="reinvestActionArea" style="margin-top: var(--spacing-4); text-align: center;">
                            ${(analysis?.pending_reinvest_profit || 0) > 0 ? `
                            <button onclick="APP.executeProfitReinvestment()" class="btn btn--success btn--lg" id="reinvestBtn" style="padding:12px 32px;font-size:16px;">
                                🔄 ${lang === 'id' 
                                    ? `Reinvestasikan ${Utils.formatCurrency(analysis.pending_reinvest_profit)} ke Modal`
                                    : `再投入 ${Utils.formatCurrency(analysis.pending_reinvest_profit)} 到资本`}
                            </button>
                            <button onclick="APP.showPartialReinvestModal()" class="btn btn--sm" style="margin-left: 12px;padding:12px 20px;">
                                ✏️ ${lang === 'id' ? 'Reinvest Sebagian' : '部分再投入'}
                            </button>
                            ` : `
                            <div class="info-bar success" style="margin-top: var(--spacing-4);">
                                <span class="info-bar-icon">✅</span>
                                <div class="info-bar-content">
                                    ${lang === 'id' 
                                        ? 'Semua keuntungan telah direinvestasikan ke modal!'
                                        : '所有利润已全部再投入资本！'}
                                </div>
                            </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="card capital-usage-card">
                        <h3>🏦 ${lang === 'id' ? 'Penggunaan Modal' : '资金使用'}</h3>
                        <div class="usage-stats">
                            <div class="usage-item">
                                <div class="usage-label">📋 ${lang === 'id' ? 'Dalam Gadai' : '在押资金'}</div>
                                <div class="usage-value warning" id="deployedCapitalValue">${Utils.formatCurrency(analysis?.deployed_capital || 0)}</div>
                                <div class="usage-sub" id="deployedOrdersCount">${analysis?.deployed_orders_count || 0} ${lang === 'id' ? 'pesanan' : '笔订单'}</div>
                            </div>
                            <div class="usage-item">
                                <div class="usage-label">💵 ${lang === 'id' ? 'Dapat Digunakan' : '可动用资金'}</div>
                                <div class="usage-value ${(analysis?.available_capital || 0) > 0 ? 'success' : 'danger'}" id="availableCapitalValue">
                                    ${Utils.formatCurrency(analysis?.available_capital || 0)}
                                </div>
                            </div>
                            <div class="usage-item">
                                <div class="usage-label">📊 ${lang === 'id' ? 'Tingkat Okupansi' : '资金占用率'}</div>
                                <div class="usage-value" id="utilizationRateValue">${(analysis?.utilization_rate || 0).toFixed(1)}%</div>
                                <div class="progress-bar" style="margin-top:8px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                                    <div class="progress-fill" id="utilizationProgressFill" style="width: ${Math.min(analysis?.utilization_rate || 0, 100)}%;height:100%;background:${(analysis?.utilization_rate || 0) > 75 ? '#f59e0b' : '#10b981'};border-radius:4px;"></div>
                                </div>
                            </div>
                            <div class="usage-item">
                                <div class="usage-label">⚙️ ${lang === 'id' ? 'Leverage Modal' : '资本杠杆'}</div>
                                <div class="usage-value" id="leverageRatioValue">${(analysis?.leverage_ratio || 0).toFixed(2)}x</div>
                                <div class="usage-sub">${lang === 'id' ? 'Kali lipat dari injeksi' : '倍于外部注资'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card health-card ${analysis?.health_assessment?.overall || 'healthy'}" id="healthCard">
                        <h3>🏥 ${lang === 'id' ? 'Evaluasi Kesehatan Modal' : '资本健康度评估'}</h3>
                        <div class="health-summary" id="healthSummary">${analysis?.health_assessment?.summary || ''}</div>
                        
                        <div id="healthStrengths" ${(analysis?.health_assessment?.strengths?.length || 0) === 0 ? 'style="display:none;"' : ''}>
                            <div class="health-strengths">
                                <strong>✅ ${lang === 'id' ? 'Keunggulan' : '优势'}:</strong>
                                <ul style="margin-left:20px;margin-top:8px;" id="strengthsList">
                                    ${(analysis?.health_assessment?.strengths || []).map(s => `<li>${s}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        
                        <div id="healthIssues" ${(analysis?.health_assessment?.issues?.length || 0) === 0 ? 'style="display:none;"' : ''}>
                            <div class="health-issues">
                                <strong>⚠️ ${lang === 'id' ? 'Perhatian' : '关注'}:</strong>
                                <ul style="margin-left:20px;margin-top:8px;" id="issuesList">
                                    ${(analysis?.health_assessment?.issues || []).map(s => `<li>${s}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3>📜 ${lang === 'id' ? 'Riwayat Reinvestasi Keuntungan' : '利润再投入历史'}</h3>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th class="col-date">${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                        <th class="col-store">${lang === 'id' ? 'Toko' : '门店'}</th>
                                        <th class="col-amount amount">💰 ${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        <th class="col-amount amount">📋 ${lang === 'id' ? 'Admin Fee' : '管理费'}</th>
                                        <th class="col-amount amount">✨ ${lang === 'id' ? 'Service Fee' : '服务费'}</th>
                                        <th class="col-amount amount">📈 ${lang === 'id' ? 'Bunga' : '利息'}</th>
                                        <th class="col-desc">📝 ${lang === 'id' ? 'Deskripsi' : '描述'}</th>
                                    </tr>
                                </thead>
                                <tbody id="reinvestHistoryBody">
                                    <tr><td colspan="7" class="text-center">${lang === 'id' ? 'Memuat...' : '加载中...'}<\/td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div id="reinvestHistoryPaginator"></div>
                    </div>
                `;
                
                await CapitalModule._loadReinvestHistory();
                
            } catch (error) {
                console.error('showProfitReinvestPage error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${lang === 'id' ? 'Kembali' : '返回'}</button>
                        </div>
                    </div>
                    <div class="card" style="text-align:center;padding:40px;">
                        <p style="color:var(--danger);">❌ ${lang === 'id' ? 'Gagal memuat data: ' : '加载失败：'}${error.message}</p>
                        <button onclick="APP.showProfitReinvestPage()" class="btn btn--sm" style="margin-top:16px;">🔄 ${lang === 'id' ? 'Coba Lagi' : '重试'}</button>
                    </div>
                `;
            }
        },
        
        // 加载利润再投入数据 - 使用 sessionStorage 持久化
        loadProfitReinvestData: async function() {
            const lang = Utils.lang;
            const isAdmin = PERMISSION.isAdmin();
            
            let storeId = null;
            if (isAdmin) {
                const storeSelect = document.getElementById('reinvestStoreSelect');
                storeId = storeSelect ? storeSelect.value : null;
                // 保存到 sessionStorage
                if (storeId) {
                    sessionStorage.setItem('jf_profit_reinvest_store_id', storeId);
                }
            } else {
                const profile = await SUPABASE.getCurrentProfile();
                storeId = profile?.store_id;
            }
            
            if (!storeId && isAdmin) {
                const stores = await SUPABASE.getAllStores();
                if (stores.length > 0) {
                    storeId = stores[0]?.id;
                    sessionStorage.setItem('jf_profit_reinvest_store_id', storeId);
                }
            }
            
            if (!storeId) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
            
            window._currentProfitStoreId = storeId;
            
            try {
                const analysis = await SUPABASE.getFullCapitalAnalysis(storeId);
                
                const elements = {
                    externalCapitalValue: analysis?.capital_breakdown?.external_injections || 0,
                    profitReinvestedValue: analysis?.capital_breakdown?.profit_reinvestments || 0,
                    totalCapitalValue: analysis?.capital_breakdown?.total_capital || 0,
                    cumulativeProfitValue: analysis?.cumulative_profit || 0,
                    reinvestedProfitValue: analysis?.reinvested_profit || 0,
                    reinvestRateValue: (analysis?.profit_reinvest_rate || 0).toFixed(1),
                    pendingProfitValue: analysis?.pending_reinvest_profit || 0,
                    deployedCapitalValue: analysis?.deployed_capital || 0,
                    deployedOrdersCount: analysis?.deployed_orders_count || 0,
                    availableCapitalValue: analysis?.available_capital || 0,
                    utilizationRateValue: (analysis?.utilization_rate || 0).toFixed(1),
                    leverageRatioValue: (analysis?.leverage_ratio || 0).toFixed(2)
                };
                
                for (const [id, value] of Object.entries(elements)) {
                    const el = document.getElementById(id);
                    if (el) {
                        if (id === 'reinvestRateValue') {
                            el.textContent = `(${value}%)`;
                        } else if (id === 'deployedOrdersCount') {
                            el.textContent = `${value} ${lang === 'id' ? 'pesanan' : '笔订单'}`;
                        } else if (id === 'utilizationRateValue') {
                            el.textContent = `${value}%`;
                            const progressFill = document.getElementById('utilizationProgressFill');
                            if (progressFill) {
                                const rate = parseFloat(value);
                                progressFill.style.width = `${Math.min(rate, 100)}%`;
                                progressFill.style.background = rate > 75 ? '#f59e0b' : '#10b981';
                            }
                        } else if (id === 'leverageRatioValue') {
                            el.textContent = `${value}x`;
                        } else if (typeof value === 'number') {
                            el.textContent = Utils.formatCurrency(value);
                        }
                    }
                }
                
                const availableEl = document.getElementById('availableCapitalValue');
                if (availableEl) {
                    const available = analysis?.available_capital || 0;
                    availableEl.className = `usage-value ${available > 0 ? 'success' : 'danger'}`;
                }
                
                const healthCard = document.getElementById('healthCard');
                const healthSummary = document.getElementById('healthSummary');
                const strengthsList = document.getElementById('strengthsList');
                const issuesList = document.getElementById('issuesList');
                const healthStrengths = document.getElementById('healthStrengths');
                const healthIssues = document.getElementById('healthIssues');
                
                if (healthCard && analysis?.health_assessment) {
                    healthCard.className = `card health-card ${analysis.health_assessment.overall || 'healthy'}`;
                    if (healthSummary) healthSummary.textContent = analysis.health_assessment.summary || '';
                    
                    if (strengthsList && analysis.health_assessment.strengths) {
                        strengthsList.innerHTML = analysis.health_assessment.strengths.map(s => `<li>${s}</li>`).join('');
                        if (healthStrengths) healthStrengths.style.display = analysis.health_assessment.strengths.length > 0 ? '' : 'none';
                    }
                    
                    if (issuesList && analysis.health_assessment.issues) {
                        issuesList.innerHTML = analysis.health_assessment.issues.map(s => `<li>${s}</li>`).join('');
                        if (healthIssues) healthIssues.style.display = analysis.health_assessment.issues.length > 0 ? '' : 'none';
                    }
                }
                
                const reinvestActionArea = document.getElementById('reinvestActionArea');
                const pendingProfit = analysis?.pending_reinvest_profit || 0;
                if (reinvestActionArea) {
                    if (pendingProfit > 0) {
                        reinvestActionArea.innerHTML = `
                            <button onclick="APP.executeProfitReinvestment()" class="btn btn--success btn--lg" id="reinvestBtn" style="padding:12px 32px;font-size:16px;">
                                🔄 ${lang === 'id' 
                                    ? `Reinvestasikan ${Utils.formatCurrency(pendingProfit)} ke Modal`
                                    : `再投入 ${Utils.formatCurrency(pendingProfit)} 到资本`}
                            </button>
                            <button onclick="APP.showPartialReinvestModal()" class="btn btn--sm" style="margin-left: 12px;padding:12px 20px;">
                                ✏️ ${lang === 'id' ? 'Reinvest Sebagian' : '部分再投入'}
                            </button>
                        `;
                    } else {
                        reinvestActionArea.innerHTML = `
                            <div class="info-bar success" style="margin-top: var(--spacing-4);">
                                <span class="info-bar-icon">✅</span>
                                <div class="info-bar-content">
                                    ${lang === 'id' 
                                        ? 'Semua keuntungan telah direinvestasikan ke modal!'
                                        : '所有利润已全部再投入资本！'}
                                </div>
                            </div>
                        `;
                    }
                }
                
                await CapitalModule._loadReinvestHistory();
                
            } catch (error) {
                console.error('loadProfitReinvestData error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data: ' + error.message : '加载数据失败：' + error.message);
            }
        },
        
        // ==================== 执行利润再投入（全额） ====================
        executeProfitReinvestment: async function() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat melakukan reinvestasi' : '仅管理员可操作利润再投入');
                return;
            }
            
            let storeId = window._currentProfitStoreId;
            if (!storeId && isAdmin) {
                const storeSelect = document.getElementById('reinvestStoreSelect');
                storeId = storeSelect ? storeSelect.value : null;
            }
            if (!storeId) {
                const profileStore = await SUPABASE.getCurrentProfile();
                storeId = profileStore?.store_id;
            }
            if (!storeId) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
            
            try {
                const analysis = await SUPABASE.getFullCapitalAnalysis(storeId);
                const pendingProfit = analysis?.pending_reinvest_profit || 0;
                
                if (pendingProfit <= 0) {
                    Utils.toast.warning(lang === 'id' ? 'Tidak ada keuntungan yang dapat direinvestasi' : '没有可再投入的利润');
                    return;
                }
                
                let storeName = storeId;
                const storeSelectEl = document.getElementById('reinvestStoreSelect');
                if (storeSelectEl && storeSelectEl.selectedOptions?.[0]?.text) {
                    storeName = storeSelectEl.selectedOptions[0].text;
                } else {
                    try {
                        const allStores = await SUPABASE.getAllStores();
                        const found = allStores.find(s => s.id === storeId);
                        if (found) storeName = found.name;
                    } catch(e) { }
                }
                const confirmMsg = lang === 'id'
                    ? `⚠️ Konfirmasi Reinvestasi Keuntungan\n\nToko: ${storeName}\nJumlah: ${Utils.formatCurrency(pendingProfit)}\n\nKeuntungan akan ditambahkan ke modal toko. Lanjutkan?`
                    : `⚠️ 确认利润再投入\n\n门店: ${storeName}\n金额: ${Utils.formatCurrency(pendingProfit)}\n\n利润将转化为门店资本。确认继续？`;
                
                const confirmed = await Utils.toast.confirm(confirmMsg);
                if (!confirmed) return;
                
                const reinvestBtn = document.getElementById('reinvestBtn');
                if (reinvestBtn) {
                    reinvestBtn.disabled = true;
                    reinvestBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memproses...' : '处理中...');
                }
                
                await SUPABASE.distributeProfit(storeId, pendingProfit, 'reinvest', 
                    lang === 'id' ? 'Reinvestasi keuntungan' : '利润再投入');
                
                Utils.toast.success(lang === 'id' 
                    ? `✅ Berhasil mereinvestasi ${Utils.formatCurrency(pendingProfit)} ke modal`
                    : `✅ 成功再投入 ${Utils.formatCurrency(pendingProfit)} 到资本`);
                
                await CapitalModule.loadProfitReinvestData();
                
                if (JF.Cache) JF.Cache.clear();
                
            } catch (error) {
                console.error('executeProfitReinvestment error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal reinvestasi: ' + error.message : '再投入失败：' + error.message);
            } finally {
                const reinvestBtn = document.getElementById('reinvestBtn');
                if (reinvestBtn) {
                    reinvestBtn.disabled = false;
                    reinvestBtn.textContent = lang === 'id' ? 'Reinvestasikan' : '再投入';
                }
            }
        },
        
        // ==================== 显示部分再投入弹窗 ====================
        showPartialReinvestModal: async function() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            if (!isAdmin) {
                Utils.toast.warning(lang === 'id' ? 'Hanya admin yang dapat melakukan reinvestasi' : '仅管理员可操作利润再投入');
                return;
            }
            
            let storeId = window._currentProfitStoreId;
            if (!storeId && isAdmin) {
                const storeSelect = document.getElementById('reinvestStoreSelect');
                storeId = storeSelect ? storeSelect.value : null;
            }
            if (!storeId) {
                const profileStore = await SUPABASE.getCurrentProfile();
                storeId = profileStore?.store_id;
            }
            if (!storeId) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
            
            try {
                const analysis = await SUPABASE.getFullCapitalAnalysis(storeId);
                const maxAmount = analysis?.pending_reinvest_profit || 0;
                
                if (maxAmount <= 0) {
                    Utils.toast.warning(lang === 'id' ? 'Tidak ada keuntungan yang dapat direinvestasi' : '没有可再投入的利润');
                    return;
                }
                
                const oldModal = document.getElementById('partialReinvestModal');
                if (oldModal) oldModal.remove();
                
                const modalHtml = `
                    <div id="partialReinvestModal" class="modal-overlay">
                        <div class="modal-content" style="max-width: 400px;">
                            <h3>✏️ ${lang === 'id' ? 'Reinvestasi Sebagian' : '部分利润再投入'}</h3>
                            <div class="form-group">
                                <label>💰 ${lang === 'id' ? 'Jumlah Reinvestasi' : '再投入金额'}</label>
                                <input type="text" id="partialReinvestAmount" class="amount-input" placeholder="0" style="width:100%;padding:10px;border-radius:8px;">
                                <div class="form-hint">${lang === 'id' ? `Maksimal: ${Utils.formatCurrency(maxAmount)}` : `最大: ${Utils.formatCurrency(maxAmount)}`}</div>
                            </div>
                            <div class="form-group">
                                <label>📝 ${lang === 'id' ? 'Deskripsi' : '描述'}</label>
                                <textarea id="partialReinvestDesc" rows="2" placeholder="${lang === 'id' ? 'Contoh: Reinvestasi keuntungan sebagian' : '例如: 部分利润再投入'}" style="width:100%;border-radius:8px;"></textarea>
                            </div>
                            <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;">
                                <button onclick="APP.confirmPartialReinvest(${maxAmount})" id="partialReinvestBtn" class="btn btn--success">💾 ${lang === 'id' ? 'Reinvestasi' : '再投入'}</button>
                                <button onclick="APP.closePartialReinvestModal()" class="btn btn--outline">✖ ${lang === 'id' ? 'Batal' : '取消'}</button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                
                const amountInput = document.getElementById('partialReinvestAmount');
                if (amountInput && Utils.bindAmountFormat) {
                    Utils.bindAmountFormat(amountInput);
                    amountInput.value = Utils.formatNumberWithCommas(maxAmount);
                }
                
            } catch (error) {
                console.error('showPartialReinvestModal error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal membuka form: ' + error.message : '打开表单失败：' + error.message);
            }
        },
        
        closePartialReinvestModal: function() {
            const modal = document.getElementById('partialReinvestModal');
            if (modal) modal.remove();
        },
        
        confirmPartialReinvest: async function(maxAmount) {
            const lang = Utils.lang;
            
            const amountStr = document.getElementById('partialReinvestAmount')?.value || '0';
            const amount = Utils.parseNumberFromCommas(amountStr);
            const description = document.getElementById('partialReinvestDesc')?.value.trim() || 
                (lang === 'id' ? 'Reinvestasi keuntungan sebagian' : '部分利润再投入');
            
            if (amount <= 0) {
                Utils.toast.warning(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
                return;
            }
            
            if (amount > maxAmount) {
                Utils.toast.warning(lang === 'id' ? `Jumlah melebihi batas maksimal ${Utils.formatCurrency(maxAmount)}` : `金额超过最大限额 ${Utils.formatCurrency(maxAmount)}`);
                return;
            }
            
            let storeId = window._currentProfitStoreId;
            if (!storeId) {
                const storeSelect = document.getElementById('reinvestStoreSelect');
                storeId = storeSelect ? storeSelect.value : null;
            }
            if (!storeId) {
                const profile = await SUPABASE.getCurrentProfile();
                storeId = profile?.store_id;
            }
            if (!storeId) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
            
            const confirmMsg = lang === 'id'
                ? `⚠️ Konfirmasi Reinvestasi\n\nJumlah: ${Utils.formatCurrency(amount)}\nDeskripsi: ${description}\n\nLanjutkan?`
                : `⚠️ 确认再投入\n\n金额: ${Utils.formatCurrency(amount)}\n描述: ${description}\n\n确认继续？`;
            
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;
            
            const confirmBtn = document.getElementById('partialReinvestBtn');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memproses...' : '处理中...');
            }
            
            try {
                await SUPABASE.distributeProfit(storeId, amount, 'reinvest', description);
                
                Utils.toast.success(lang === 'id' 
                    ? `✅ Berhasil mereinvestasi ${Utils.formatCurrency(amount)} ke modal`
                    : `✅ 成功再投入 ${Utils.formatCurrency(amount)} 到资本`);
                
                CapitalModule.closePartialReinvestModal();
                
                await CapitalModule.loadProfitReinvestData();
                
                if (JF.Cache) JF.Cache.clear();
                
            } catch (error) {
                console.error('confirmPartialReinvest error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal reinvestasi: ' + error.message : '再投入失败：' + error.message);
            } finally {
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = lang === 'id' ? 'Reinvestasi' : '再投入';
                }
            }
        },
        
        // ==================== 加载再投入历史 ====================
        _loadReinvestHistory: async function() {
            const lang = Utils.lang;
            const client = SUPABASE.getClient();
            
            const storeSelect = document.getElementById('reinvestStoreSelect');
            let storeId = storeSelect ? storeSelect.value : null;
            
            if (!storeId) {
                const profile = await SUPABASE.getCurrentProfile();
                if (profile?.role !== 'admin') {
                    storeId = profile?.store_id;
                }
            }
            
            let query = client
                .from('capital_accumulation')
                .select('*, stores(name)')
                .order('accumulation_date', { ascending: false })
                .limit(50);
            
            if (storeId) {
                query = query.eq('store_id', storeId);
            }
            
            const { data: accumulations, error } = await query;
            
            const tbody = document.getElementById('reinvestHistoryBody');
            if (!tbody) return;
            
            if (error || !accumulations || accumulations.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Belum ada riwayat' : '暂无记录'}</td></tr>`;
                return;
            }
            
            if (window.JF && JF.Pagination) {
                JF.Pagination.render('reinvestHistoryBody', accumulations, 1, 15, function(acc) {
                    return `<tr>
                        <td class="date-cell">${Utils.formatDate(acc.accumulation_date)}</td>
                        <td>${Utils.escapeHtml(acc.stores?.name || '-')}</td>
                        <td class="amount">${Utils.formatCurrency(acc.total_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.admin_fee_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.service_fee_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.interest_amount || 0)}</td>
                        <td class="desc-cell">${Utils.escapeHtml(acc.description || '-')}</td>
                    </tr>`;
                }, {
                    paginatorId: 'reinvestHistoryPaginator',
                    emptyHtml: `<tr><td colspan="7" class="text-center">${lang === 'id' ? 'Belum ada riwayat' : '暂无记录'}</td></tr>`
                });
            } else {
                let rows = '';
                for (const acc of accumulations) {
                    rows += `<tr>
                        <td class="date-cell">${Utils.formatDate(acc.accumulation_date)}</td>
                        <td>${Utils.escapeHtml(acc.stores?.name || '-')}</td>
                        <td class="amount">${Utils.formatCurrency(acc.total_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.admin_fee_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.service_fee_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.interest_amount || 0)}</td>
                        <td class="desc-cell">${Utils.escapeHtml(acc.description || '-')}</td>
                    </tr>`;
                }
                tbody.innerHTML = rows;
            }
        }
    };

    // 挂载到命名空间
    JF.CapitalModule = CapitalModule;

        // ==================== 月度资金健康报表 ====================
        async buildFundHealthReportHTML() {
            const lang = Utils.lang;
            const client = SUPABASE.getClient();
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';

            // 生成最近6个月的月份列表
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);
                months.push({
                    year: d.getFullYear(),
                    month: d.getMonth() + 1,
                    label: d.toLocaleDateString(lang === 'id' ? 'id-ID' : 'zh-CN', { year: 'numeric', month: 'long' }),
                    start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
                    end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().substring(0, 10)
                });
            }

            // 并行拉取：payment_history（利息/本金/管理费/服务费）+ expenses（支出）+ orders（在外本金）
            const [phRes, expRes, ordersRes, injRes] = await Promise.all([
                client.from('payment_history').select('type, amount, date, payment_method').eq('is_voided', false),
                client.from('expenses').select('amount, date, category').eq('is_voided', false),
                client.from('orders').select('status, loan_amount, principal_paid, created_at').in('status', ['active', 'completed', 'liquidated']),
                client.from('capital_injections').select('amount').eq('is_voided', false)
            ]);

            const payments = phRes.data || [];
            const expenses = expRes.data || [];
            const orders = ordersRes.data || [];
            const totalInjected = (injRes.data || []).reduce((s, r) => s + (r.amount || 0), 0);

            // 当前在外本金
            const deployedNow = orders.filter(o => o.status === 'active').reduce((s, o) => s + (o.loan_amount || 0), 0);
            // 历史累计回笼本金
            const totalPrincipalBack = payments.filter(p => p.type === 'principal').reduce((s, p) => s + (p.amount || 0), 0);

            // 按月聚合
            const monthlyData = months.map(m => {
                const inRange = arr => arr.filter(r => r.date >= m.start && r.date <= m.end);
                const ph = inRange(payments);
                const interest = ph.filter(p => p.type === 'interest').reduce((s, p) => s + (p.amount || 0), 0);
                const adminFee = ph.filter(p => p.type === 'admin_fee').reduce((s, p) => s + (p.amount || 0), 0);
                const serviceFee = ph.filter(p => p.type === 'service_fee').reduce((s, p) => s + (p.amount || 0), 0);
                const principalBack = ph.filter(p => p.type === 'principal').reduce((s, p) => s + (p.amount || 0), 0);
                const principalOut = ph.filter(p => p.type === 'loan_disbursement').reduce((s, p) => s + (p.amount || 0), 0);
                const exp = inRange(expenses).reduce((s, e) => s + (e.amount || 0), 0);
                const trueIncome = interest + adminFee + serviceFee;
                const netProfit = trueIncome - exp;
                return { ...m, interest, adminFee, serviceFee, trueIncome, principalBack, principalOut, exp, netProfit };
            });

            // 累计总计行
            const totals = monthlyData.reduce((t, m) => ({
                interest: t.interest + m.interest,
                adminFee: t.adminFee + m.adminFee,
                serviceFee: t.serviceFee + m.serviceFee,
                trueIncome: t.trueIncome + m.trueIncome,
                principalBack: t.principalBack + m.principalBack,
                principalOut: t.principalOut + m.principalOut,
                exp: t.exp + m.exp,
                netProfit: t.netProfit + m.netProfit,
            }), { interest: 0, adminFee: 0, serviceFee: 0, trueIncome: 0, principalBack: 0, principalOut: 0, exp: 0, netProfit: 0 });

            const fmt = v => Utils.formatCurrency(v);
            const profitColor = v => v >= 0 ? 'color:#16a34a;font-weight:700' : 'color:#dc2626;font-weight:700';

            // 月度明细表格行
            const tableRows = monthlyData.map(m => `
                <tr>
                    <td style="font-weight:600;white-space:nowrap">${m.label}</td>
                    <td class="amount" style="color:#06b6d4">${fmt(m.interest)}</td>
                    <td class="amount" style="color:#6366f1">${fmt(m.adminFee)}</td>
                    <td class="amount" style="color:#8b5cf6">${fmt(m.serviceFee)}</td>
                    <td class="amount;font-weight:700">${fmt(m.trueIncome)}</td>
                    <td class="amount" style="color:#ef4444">−${fmt(m.exp)}</td>
                    <td class="amount" style="${profitColor(m.netProfit)}">${fmt(m.netProfit)}</td>
                    <td class="amount" style="color:#94a3b8">${fmt(m.principalBack)}</td>
                </tr>`).join('');

            const totalRow = `
                <tr style="background:var(--bg-highlight);font-weight:700;border-top:2px solid var(--border-medium)">
                    <td>${lang === 'id' ? '6 Bulan' : '6个月合计'}</td>
                    <td class="amount" style="color:#06b6d4">${fmt(totals.interest)}</td>
                    <td class="amount" style="color:#6366f1">${fmt(totals.adminFee)}</td>
                    <td class="amount" style="color:#8b5cf6">${fmt(totals.serviceFee)}</td>
                    <td class="amount">${fmt(totals.trueIncome)}</td>
                    <td class="amount" style="color:#ef4444">−${fmt(totals.exp)}</td>
                    <td class="amount" style="${profitColor(totals.netProfit)}">${fmt(totals.netProfit)}</td>
                    <td class="amount" style="color:#94a3b8">${fmt(totals.principalBack)}</td>
                </tr>`;

            // 资金健康度评分（简单规则）
            const utilizationRate = totalInjected > 0 ? (deployedNow / totalInjected * 100) : 0;
            let healthScore = 100;
            if (utilizationRate > 90) healthScore -= 20;
            else if (utilizationRate < 30) healthScore -= 10;
            if (totals.netProfit < 0) healthScore -= 30;
            const healthColor = healthScore >= 80 ? '#16a34a' : healthScore >= 60 ? '#d97706' : '#dc2626';
            const healthLabel = healthScore >= 80
                ? (lang === 'id' ? '✅ Sehat' : '✅ 健康')
                : healthScore >= 60
                    ? (lang === 'id' ? '⚠️ Perlu Perhatian' : '⚠️ 需关注')
                    : (lang === 'id' ? '❌ Berisiko' : '❌ 有风险');

            return `
            <div class="page-header">
                <h2>📈 ${lang === 'id' ? 'Laporan Keuangan Bulanan' : '月度资金健康报表'}</h2>
                <div class="header-actions">
                    <button onclick="APP.goBack()" class="btn btn--outline">↩️ ${lang === 'id' ? 'Kembali' : '返回'}</button>
                </div>
            </div>

            <!-- 顶部摘要卡片 -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:16px;">
                <div class="card" style="text-align:center;padding:16px 12px;border-top:4px solid #16a34a">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">💰 ${lang === 'id' ? 'Pendapatan Nyata (6 bln)' : '真实收入（6个月）'}</div>
                    <div style="font-size:20px;font-weight:800;color:#16a34a">${fmt(totals.trueIncome)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${lang === 'id' ? 'Bunga + Admin + Layanan' : '利息 + 管理费 + 服务费'}</div>
                </div>
                <div class="card" style="text-align:center;padding:16px 12px;border-top:4px solid #ef4444">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">📤 ${lang === 'id' ? 'Pengeluaran (6 bln)' : '运营支出（6个月）'}</div>
                    <div style="font-size:20px;font-weight:800;color:#ef4444">−${fmt(totals.exp)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${lang === 'id' ? 'Biaya operasional' : '独立核算，非资金流转'}</div>
                </div>
                <div class="card" style="text-align:center;padding:16px 12px;border-top:4px solid ${totals.netProfit >= 0 ? '#0e7490' : '#dc2626'}">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">📊 ${lang === 'id' ? 'Laba Bersih (6 bln)' : '净利润（6个月）'}</div>
                    <div style="font-size:20px;font-weight:800;${profitColor(totals.netProfit)}">${fmt(totals.netProfit)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${lang === 'id' ? 'Pendapatan − Pengeluaran' : '真实收入 − 运营支出'}</div>
                </div>
                <div class="card" style="text-align:center;padding:16px 12px;border-top:4px solid ${healthColor}">
                    <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">🏦 ${lang === 'id' ? 'Kesehatan Dana' : '资金健康度'}</div>
                    <div style="font-size:20px;font-weight:800;color:${healthColor}">${healthScore}分</div>
                    <div style="font-size:12px;font-weight:600;color:${healthColor};margin-top:2px">${healthLabel}</div>
                </div>
            </div>

            <!-- 资金结构说明 -->
            <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
                <div class="card-header"><div class="card-title">🔄 ${lang === 'id' ? 'Struktur Modal Saat Ini' : '当前资金结构'}</div></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;padding:4px 0 8px">
                    <div style="text-align:center">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${lang === 'id' ? '💼 Total Modal Disetor' : '💼 总投入资本'}</div>
                        <div style="font-size:17px;font-weight:700">${fmt(totalInjected)}</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${lang === 'id' ? '📤 Dalam Gadai (Modal Keluar)' : '📤 在押资金（资金出口②）'}</div>
                        <div style="font-size:17px;font-weight:700;color:var(--primary)">${fmt(deployedNow)}</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${lang === 'id' ? '🔄 Pokok Kembali (Bukan Pendapatan)' : '🔄 已回笼本金（非收入）'}</div>
                        <div style="font-size:17px;font-weight:700;color:#94a3b8">${fmt(totalPrincipalBack)}</div>
                    </div>
                    <div style="text-align:center">
                        <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${lang === 'id' ? '📈 Utilisasi Modal' : '📈 资金利用率'}</div>
                        <div style="font-size:17px;font-weight:700;color:${utilizationRate > 85 ? '#d97706' : '#16a34a'}">${utilizationRate.toFixed(1)}%</div>
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-highlight);border-radius:6px;line-height:1.6">
                    💡 ${lang === 'id'
                        ? '<strong>Prinsip: "Pokok kembali bukan pendapatan"</strong> — Pokok yang kembali adalah modal Anda sendiri yang kembali ke kas, bukan keuntungan. Pendapatan nyata hanya: Bunga + Biaya Admin + Biaya Layanan.'
                        : '<strong>原则：「本金回笼不是收入，是自有资金归位」</strong> — 本金回笼只是您的资金从外部归位，不计入损益。真实收入仅为：利息 + 管理费 + 服务费。'}
                </div>
            </div>

            <!-- 月度明细表 -->
            <div class="card">
                <div class="card-header"><div class="card-title">📅 ${lang === 'id' ? 'Rincian Per Bulan (6 Bulan Terakhir)' : '近6个月明细'}</div></div>
                <div class="table-container">
                    <table class="data-table" style="min-width:700px">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Bulan' : '月份'}</th>
                                <th class="amount" style="color:#06b6d4">${lang === 'id' ? 'Bunga' : '利息收入'}</th>
                                <th class="amount" style="color:#6366f1">${lang === 'id' ? 'Adm.' : '管理费'}</th>
                                <th class="amount" style="color:#8b5cf6">${lang === 'id' ? 'Layanan' : '服务费'}</th>
                                <th class="amount">${lang === 'id' ? 'Total Pendapatan' : '真实收入合计'}</th>
                                <th class="amount" style="color:#ef4444">${lang === 'id' ? 'Pengeluaran' : '运营支出'}</th>
                                <th class="amount">${lang === 'id' ? 'Laba Bersih' : '净利润'}</th>
                                <th class="amount" style="color:#94a3b8">${lang === 'id' ? 'Pokok Kembali' : '本金回笼'}</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}${totalRow}</tbody>
                    </table>
                </div>
                <div style="margin-top:10px;font-size:11px;color:var(--text-muted);padding:8px;border-top:1px solid var(--border-light)">
                    ⚠️ ${lang === 'id'
                        ? '「Pokok Kembali」ditampilkan terpisah dan <strong>tidak termasuk</strong> dalam kolom Pendapatan maupun Laba Bersih, karena merupakan modal Anda sendiri yang kembali.'
                        : '「本金回笼」单独列示，<strong>不计入</strong>真实收入和净利润，因为它是您的自有资金归位，与损益无关。'}
                </div>
            </div>`;
        },

    // ==================== 向下兼容挂载 ====================
    if (window.APP) {
        window.APP.showCapitalInjectionModal = CapitalModule.showCapitalInjectionModal.bind(CapitalModule);
        window.APP.closeCapitalInjectionModal = CapitalModule.closeCapitalInjectionModal.bind(CapitalModule);
        window.APP.saveCapitalInjection = CapitalModule.saveCapitalInjection.bind(CapitalModule);
        window.APP.showProfitReinvestPage = CapitalModule.showProfitReinvestPage.bind(CapitalModule);
        window.APP.loadProfitReinvestData = CapitalModule.loadProfitReinvestData.bind(CapitalModule);
        window.APP.executeProfitReinvestment = CapitalModule.executeProfitReinvestment.bind(CapitalModule);
        window.APP.showPartialReinvestModal = CapitalModule.showPartialReinvestModal.bind(CapitalModule);
        window.APP.closePartialReinvestModal = CapitalModule.closePartialReinvestModal.bind(CapitalModule);
        window.APP.confirmPartialReinvest = CapitalModule.confirmPartialReinvest.bind(CapitalModule);
    } else {
        window.APP = {
            showCapitalInjectionModal: CapitalModule.showCapitalInjectionModal.bind(CapitalModule),
            closeCapitalInjectionModal: CapitalModule.closeCapitalInjectionModal.bind(CapitalModule),
            saveCapitalInjection: CapitalModule.saveCapitalInjection.bind(CapitalModule),
            showProfitReinvestPage: CapitalModule.showProfitReinvestPage.bind(CapitalModule),
            loadProfitReinvestData: CapitalModule.loadProfitReinvestData.bind(CapitalModule),
            executeProfitReinvestment: CapitalModule.executeProfitReinvestment.bind(CapitalModule),
            showPartialReinvestModal: CapitalModule.showPartialReinvestModal.bind(CapitalModule),
            closePartialReinvestModal: CapitalModule.closePartialReinvestModal.bind(CapitalModule),
            confirmPartialReinvest: CapitalModule.confirmPartialReinvest.bind(CapitalModule),
        };
    }

})();
