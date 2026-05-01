// app-capital.js - 资金管理模块 v2.1 最终版 (JF 命名空间统一版)
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
            
            // 非管理员直接拒绝
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
            
            // 获取当前各门店的资本情况
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
                    <div class="modal-content" style="max-width: 480px;">
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
                            <button onclick="APP.saveCapitalInjection()" id="saveInjectionBtn" class="success" style="padding:8px 20px;">💾 ${lang === 'id' ? 'Simpan' : '保存'}</button>
                            <button onclick="APP.closeCapitalInjectionModal()" class="btn-back" style="padding:8px 20px;">✖ ${lang === 'id' ? 'Batal' : '取消'}</button>
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
            
            // 权限二次确认
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
            
            // 获取门店名称用于确认
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
                
                // 清除缓存，刷新仪表盘
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
        
        // ==================== 利润再投入 ====================
        showProfitReinvestPage: async function() {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            try {
                const analysis = await SUPABASE.getFullCapitalAnalysis();
                
                let stores = [];
                if (isAdmin) {
                    stores = await SUPABASE.getAllStores();
                }
                
                document.getElementById("app").innerHTML = `
                    <div class="page-header">
                        <h2>🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${lang === 'id' ? 'Kembali' : '返回'}</button>
                            <button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        </div>
                    </div>
                    
                    ${isAdmin ? `
                    <div class="card">
                        <div class="form-group" style="max-width: 300px;">
                            <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'}</label>
                            <select id="reinvestStoreSelect" onchange="APP.loadProfitReinvestData()" style="width:100%;padding:10px;border-radius:8px;">
                                <option value="">${lang === 'id' ? 'Semua Toko' : '全部门店'}</option>
                                ${stores.filter(s => s.code !== 'STORE_000').map(s => `
                                    <option value="${s.id}">${Utils.escapeHtml(s.name)} (${s.code})</option>
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
                                <div class="composition-value">${Utils.formatCurrency(analysis.capital_breakdown.external_injections)}</div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">🔄 ${lang === 'id' ? 'Reinvestasi Keuntungan' : '利润再投入'}</div>
                                <div class="composition-value success">${Utils.formatCurrency(analysis.capital_breakdown.profit_reinvestments)}</div>
                            </div>
                            <div class="composition-item">
                                <div class="composition-label">📊 ${lang === 'id' ? 'Total Modal' : '总资本'}</div>
                                <div class="composition-value primary">${Utils.formatCurrency(analysis.capital_breakdown.total_capital)}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card profit-stats-card">
                        <h3>📈 ${lang === 'id' ? 'Statistik Keuntungan' : '利润统计'}</h3>
                        <div class="profit-stats-grid">
                            <div class="stat-item">
                                <div class="stat-label">💰 ${lang === 'id' ? 'Keuntungan Kumulatif' : '累计利润'}</div>
                                <div class="stat-value">${Utils.formatCurrency(analysis.cumulative_profit)}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">🔄 ${lang === 'id' ? 'Sudah Direinvest' : '已再投入'}</div>
                                <div class="stat-value success">${Utils.formatCurrency(analysis.reinvested_profit)}</div>
                                <div class="stat-sub">(${analysis.profit_reinvest_rate.toFixed(1)}%)</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">⏳ ${lang === 'id' ? 'Siap Direinvest' : '待再投入'}</div>
                                <div class="stat-value warning">${Utils.formatCurrency(analysis.pending_reinvest_profit)}</div>
                            </div>
                        </div>
                        
                        ${analysis.pending_reinvest_profit > 0 ? `
                        <div class="reinvest-action" style="margin-top: var(--spacing-4); text-align: center;">
                            <button onclick="APP.executeProfitReinvestment()" class="success btn-large" id="reinvestBtn" style="padding:12px 32px;font-size:16px;">
                                🔄 ${lang === 'id' 
                                    ? `Reinvestasikan ${Utils.formatCurrency(analysis.pending_reinvest_profit)} ke Modal`
                                    : `再投入 ${Utils.formatCurrency(analysis.pending_reinvest_profit)} 到资本`}
                            </button>
                            <button onclick="APP.showPartialReinvestModal()" class="btn-small" style="margin-left: 12px;padding:12px 20px;">
                                ✏️ ${lang === 'id' ? 'Reinvest Sebagian' : '部分再投入'}
                            </button>
                        </div>
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
                    
                    <div class="card capital-usage-card">
                        <h3>🏦 ${lang === 'id' ? 'Penggunaan Modal' : '资金使用'}</h3>
                        <div class="usage-stats">
                            <div class="usage-item">
                                <div class="usage-label">📋 ${lang === 'id' ? 'Dalam Gadai' : '在押资金'}</div>
                                <div class="usage-value warning">${Utils.formatCurrency(analysis.deployed_capital)}</div>
                                <div class="usage-sub">${analysis.deployed_orders_count} ${lang === 'id' ? 'pesanan' : '笔订单'}</div>
                            </div>
                            <div class="usage-item">
                                <div class="usage-label">💵 ${lang === 'id' ? 'Dapat Digunakan' : '可动用资金'}</div>
                                <div class="usage-value ${analysis.available_capital > 0 ? 'success' : 'danger'}">
                                    ${Utils.formatCurrency(analysis.available_capital)}
                                </div>
                            </div>
                            <div class="usage-item">
                                <div class="usage-label">📊 ${lang === 'id' ? 'Tingkat Okupansi' : '资金占用率'}</div>
                                <div class="usage-value">${analysis.utilization_rate.toFixed(1)}%</div>
                                <div class="progress-bar" style="margin-top:8px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
                                    <div class="progress-fill" style="width: ${Math.min(analysis.utilization_rate, 100)}%;height:100%;background:${analysis.utilization_rate > 75 ? '#f59e0b' : '#10b981'};border-radius:4px;"></div>
                                </div>
                            </div>
                            <div class="usage-item">
                                <div class="usage-label">⚙️ ${lang === 'id' ? 'Leverage Modal' : '资本杠杆'}</div>
                                <div class="usage-value">${analysis.leverage_ratio.toFixed(2)}x</div>
                                <div class="usage-sub">${lang === 'id' ? 'Kali lipat dari injeksi' : '倍于外部注资'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card health-card ${analysis.health_assessment.overall}">
                        <h3>🏥 ${lang === 'id' ? 'Evaluasi Kesehatan Modal' : '资本健康度评估'}</h3>
                        <div class="health-summary">${analysis.health_assessment.summary}</div>
                        
                        ${analysis.health_assessment.strengths.length > 0 ? `
                        <div class="health-strengths">
                            <strong>✅ ${lang === 'id' ? 'Keunggulan' : '优势'}:</strong>
                            <ul style="margin-left:20px;margin-top:8px;">
                                ${analysis.health_assessment.strengths.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
                        
                        ${analysis.health_assessment.issues.length > 0 ? `
                        <div class="health-issues">
                            <strong>⚠️ ${lang === 'id' ? 'Perhatian' : '关注'}:</strong>
                            <ul style="margin-left:20px;margin-top:8px;">
                                ${analysis.health_assessment.issues.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
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
                                    <tr><td colspan="7" class="text-center">${lang === 'id' ? 'Memuat...' : '加载中...'}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                
                await CapitalModule._loadReinvestHistory();
                
            } catch (error) {
                console.error('showProfitReinvestPage error:', error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
            }
        },
        
        _loadReinvestHistory: async function() {
            const lang = Utils.lang;
            const client = SUPABASE.getClient();
            
            const storeSelect = document.getElementById('reinvestStoreSelect');
            let storeId = storeSelect ? storeSelect.value : null;
            
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
            
            let rows = '';
            for (const acc of accumulations) {
                rows += `
                    <tr>
                        <td class="date-cell">${Utils.formatDate(acc.accumulation_date)}</td>
                        <td>${Utils.escapeHtml(acc.stores?.name || '-')}</td>
                        <td class="amount">${Utils.formatCurrency(acc.total_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.admin_fee_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.service_fee_amount || 0)}</td>
                        <td class="amount">${Utils.formatCurrency(acc.interest_amount || 0)}</td>
                        <td class="desc-cell">${Utils.escapeHtml(acc.description || '-')}</td>
                    </tr>
                `;
            }
            tbody.innerHTML = rows;
        }
    };

    // 挂载到命名空间
    JF.CapitalModule = CapitalModule;

    // 向下兼容：将方法挂载到 APP
    if (window.APP) {
        window.APP.showCapitalInjectionModal = CapitalModule.showCapitalInjectionModal.bind(CapitalModule);
        window.APP.closeCapitalInjectionModal = CapitalModule.closeCapitalInjectionModal.bind(CapitalModule);
        window.APP.saveCapitalInjection = CapitalModule.saveCapitalInjection.bind(CapitalModule);
        window.APP.showProfitReinvestPage = CapitalModule.showProfitReinvestPage.bind(CapitalModule);
    } else {
        window.APP = {
            showCapitalInjectionModal: CapitalModule.showCapitalInjectionModal.bind(CapitalModule),
            closeCapitalInjectionModal: CapitalModule.closeCapitalInjectionModal.bind(CapitalModule),
            saveCapitalInjection: CapitalModule.saveCapitalInjection.bind(CapitalModule),
            showProfitReinvestPage: CapitalModule.showProfitReinvestPage.bind(CapitalModule),
        };
    }

    console.log('✅ JF.CapitalModule v2.1 最终版初始化完成');
})();
