// app-capital.js - 资金管理模块 v1.0
// 包含：资本注入、利润再投入、资金占用报告、资金健康度评估

window.APP = window.APP || {};

const CapitalModule = {

    // ==================== 资本注入 ====================
    
    /**
     * 显示资本注入模态框
     */
    showCapitalInjectionModal: async function() {
        const lang = Utils.lang;
        const stores = await SUPABASE.getAllStores();
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        let storeOptions = '';
        if (isAdmin) {
            storeOptions = '<select id="injectionStoreId" class="full-width" style="width:100%;padding:10px;border-radius:8px;">';
            for (const store of stores) {
                if (store.code !== 'STORE_000' && (store.is_active !== false)) {
                    storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)} (${store.code})</option>`;
                }
            }
            storeOptions += '</select>';
        }
        
        const modalHtml = `
            <div id="capitalInjectionModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 450px;">
                    <h3>💰 ${lang === 'id' ? 'Injeksi Modal Baru' : '新增资本注入'}</h3>
                    
                    ${isAdmin ? `
                    <div class="form-group">
                        <label>🏪 ${lang === 'id' ? 'Pilih Toko' : '选择门店'}</label>
                        ${storeOptions}
                    </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label>💰 ${lang === 'id' ? 'Jumlah Injeksi' : '注入金额'}</label>
                        <input type="text" id="injectionAmount" placeholder="0" class="amount-input" style="width:100%;padding:10px;border-radius:8px;">
                    </div>
                    
                    <div class="form-group">
                        <label>🏦 ${lang === 'id' ? 'Sumber Dana' : '资金来源'}</label>
                        <div class="payment-method-selector">
                            <label><input type="radio" name="injectionSource" value="cash" checked> 🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</label>
                            <label><input type="radio" name="injectionSource" value="bank"> 🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>📝 ${lang === 'id' ? 'Deskripsi' : '描述'}</label>
                        <textarea id="injectionDesc" rows="2" placeholder="${lang === 'id' ? 'Catatan tambahan' : '备注说明'}" style="width:100%;border-radius:8px;"></textarea>
                    </div>
                    
                    <div class="info-bar info" style="margin: 12px 0;">
                        <span class="info-bar-icon">💡</span>
                        <div class="info-bar-content">
                            ${lang === 'id' 
                                ? 'Injeksi modal akan meningkatkan total modal yang tersedia untuk operasional.' 
                                : '资本注入将增加可用于运营的总资本。'}
                        </div>
                    </div>
                    
                    <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;">
                        <button onclick="APP.saveCapitalInjection()" class="success" style="padding:8px 20px;">💾 ${lang === 'id' ? 'Simpan' : '保存'}</button>
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
    
    /**
     * 关闭资本注入模态框
     */
    closeCapitalInjectionModal: function() {
        const modal = document.getElementById('capitalInjectionModal');
        if (modal) modal.remove();
    },
    
    /**
     * 保存资本注入
     */
    saveCapitalInjection: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        let storeId = null;
        if (isAdmin) {
            const storeSelect = document.getElementById('injectionStoreId');
            if (!storeSelect) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
            storeId = storeSelect.value;
            if (!storeId) {
                Utils.toast.warning(lang === 'id' ? 'Pilih toko terlebih dahulu' : '请先选择门店');
                return;
            }
        } else {
            storeId = profile?.store_id;
            if (!storeId) {
                Utils.toast.error(lang === 'id' ? 'Tidak ada toko yang terhubung' : '未关联门店');
                return;
            }
        }
        
        const amountStr = document.getElementById('injectionAmount')?.value || '0';
        const amount = Utils.parseNumberFromCommas(amountStr);
        const source = document.querySelector('input[name="injectionSource"]:checked')?.value || 'cash';
        const description = document.getElementById('injectionDesc')?.value.trim() || '';
        
        if (amount <= 0) {
            Utils.toast.warning(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
            return;
        }
        
        const confirmMsg = lang === 'id'
            ? `⚠️ Konfirmasi Injeksi Modal\n\nJumlah: ${Utils.formatCurrency(amount)}\nSumber: ${source === 'cash' ? 'Tunai' : 'Bank'}\n\nLanjutkan?`
            : `⚠️ 确认资本注入\n\n金额: ${Utils.formatCurrency(amount)}\n来源: ${source === 'cash' ? '现金' : '银行'}\n\n确认继续？`;
        
        const confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        const saveBtn = document.querySelector('#capitalInjectionModal .success');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
        }
        
        try {
            await SUPABASE.recordCapitalInjection(storeId, amount, source, description);
            
            Utils.toast.success(lang === 'id' 
                ? `✅ Injeksi modal ${Utils.formatCurrency(amount)} berhasil dicatat`
                : `✅ 资本注入 ${Utils.formatCurrency(amount)} 已记录`);
            
            APP.closeCapitalInjectionModal();
            
            // 刷新当前页面
            if (typeof window.DashboardCore !== 'undefined' && DashboardCore.refreshCurrentPage) {
                await DashboardCore.refreshCurrentPage();
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
    
    /**
     * 显示利润再投入页面
     */
    showProfitReinvestPage: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        try {
            // 获取分析数据
            const analysis = await SUPABASE.getFullCapitalAnalysis();
            
            // 获取门店列表（如果是admin）
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
                
                <!-- 资本构成卡片 -->
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
                
                <!-- 利润统计卡片 -->
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
                
                <!-- 资金占用状态 -->
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
                
                <!-- 健康度评估 -->
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
                
                <!-- 利润再投入历史 -->
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
            
            // 加载历史记录
            await CapitalModule._loadReinvestHistory();
            
        } catch (error) {
            console.error('showProfitReinvestPage error:', error);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data' : '加载数据失败');
        }
    },
    
    /**
     * 加载再投入历史
     */
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
                    <td class="amount">${Utils.formatCurrency(acc.amount)}</td>
                    <td class="amount">${Utils.formatCurrency(acc.from_admin_fee || 0)}</td>
                    <td class="amount">${Utils.formatCurrency(acc.from_service_fee || 0)}</td>
                    <td class="amount">${Utils.formatCurrency(acc.from_interest || 0)}</td>
                    <td class="desc-cell">${Utils.escapeHtml(acc.description || '-')}</td>
                </tr>
            `;
        }
        
        tbody.innerHTML = rows;
    },
    
    /**
     * 加载利润再投入数据（admin切换门店时）
     */
    loadProfitReinvestData: async function() {
        await CapitalModule.showProfitReinvestPage();
    },
    
    /**
     * 执行利润再投入（全额）
     */
    executeProfitReinvestment: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        let storeId = null;
        if (isAdmin) {
            const storeSelect = document.getElementById('reinvestStoreSelect');
            if (storeSelect && storeSelect.value) {
                storeId = storeSelect.value;
            }
        }
        
        try {
            // 获取待转化利润
            const pendingProfit = await SUPABASE.getPendingReinvestProfit(storeId);
            
            if (pendingProfit <= 0) {
                Utils.toast.warning(lang === 'id' 
                    ? 'Tidak ada keuntungan yang dapat direinvest'
                    : '没有可再投入的利润');
                return;
            }
            
            const confirmMsg = lang === 'id'
                ? `⚠️ Konfirmasi Reinvestasi Keuntungan\n\nJumlah: ${Utils.formatCurrency(pendingProfit)}\n\nKeuntungan ini akan ditambahkan ke modal dan dapat digunakan untuk pendanaan baru.\n\nLanjutkan?`
                : `⚠️ 确认利润再投入\n\n金额: ${Utils.formatCurrency(pendingProfit)}\n\n该利润将转化为资本，可用于新的放款业务。\n\n确认继续？`;
            
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;
            
            const reinvestBtn = document.getElementById('reinvestBtn');
            if (reinvestBtn) {
                reinvestBtn.disabled = true;
                reinvestBtn.textContent = '⏳ ' + (lang === 'id' ? 'Memproses...' : '处理中...');
            }
            
            const result = await SUPABASE.reinvestProfit({
                storeId: storeId,
                amount: pendingProfit,
                periodStart: null,
                periodEnd: null,
                description: lang === 'id' 
                    ? 'Reinvestasi semua keuntungan yang tersedia'
                    : '全部利润再投入'
            });
            
            Utils.toast.success(lang === 'id'
                ? `✅ Berhasil reinvestasi ${Utils.formatCurrency(result.reinvested_amount)}`
                : `✅ 成功再投入 ${Utils.formatCurrency(result.reinvested_amount)}`);
            
            // 刷新页面
            await CapitalModule.showProfitReinvestPage();
            
        } catch (error) {
            console.error('executeProfitReinvestment error:', error);
            Utils.toast.error(error.message);
            const reinvestBtn = document.getElementById('reinvestBtn');
            if (reinvestBtn) {
                reinvestBtn.disabled = false;
                reinvestBtn.textContent = lang === 'id' 
                    ? `Reinvestasikan ke Modal`
                    : `再投入到资本`;
            }
        }
    },
    
    /**
     * 显示部分再投入模态框
     */
    showPartialReinvestModal: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        let storeId = null;
        if (isAdmin) {
            const storeSelect = document.getElementById('reinvestStoreSelect');
            if (storeSelect && storeSelect.value) {
                storeId = storeSelect.value;
            }
        }
        
        const pendingProfit = await SUPABASE.getPendingReinvestProfit(storeId);
        
        if (pendingProfit <= 0) {
            Utils.toast.warning(lang === 'id' 
                ? 'Tidak ada keuntungan yang dapat direinvest'
                : '没有可再投入的利润');
            return;
        }
        
        const modalHtml = `
            <div id="partialReinvestModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 400px;">
                    <h3>✏️ ${lang === 'id' ? 'Reinvestasi Sebagian' : '部分再投入'}</h3>
                    
                    <div class="info-bar info" style="margin-bottom: 16px;">
                        <span class="info-bar-icon">💰</span>
                        <div class="info-bar-content">
                            ${lang === 'id' 
                                ? `Keuntungan tersedia: ${Utils.formatCurrency(pendingProfit)}`
                                : `可用利润: ${Utils.formatCurrency(pendingProfit)}`}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>💰 ${lang === 'id' ? 'Jumlah Reinvestasi' : '再投入金额'}</label>
                        <input type="text" id="partialReinvestAmount" class="amount-input" 
                               value="${Utils.formatNumberWithCommas(pendingProfit)}" style="width:100%;padding:10px;border-radius:8px;">
                    </div>
                    
                    <div class="form-group">
                        <label>📝 ${lang === 'id' ? 'Deskripsi (Opsional)' : '描述（可选）'}</label>
                        <textarea id="partialReinvestDesc" rows="2" 
                            placeholder="${lang === 'id' ? 'Catatan reinvestasi' : '再投入备注'}" style="width:100%;border-radius:8px;"></textarea>
                    </div>
                    
                    <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;">
                        <button onclick="APP.confirmPartialReinvest()" class="success" style="padding:8px 20px;">
                            🔄 ${lang === 'id' ? 'Reinvestasi' : '再投入'}
                        </button>
                        <button onclick="APP.closePartialReinvestModal()" class="btn-back" style="padding:8px 20px;">
                            ✖ ${lang === 'id' ? 'Batal' : '取消'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const oldModal = document.getElementById('partialReinvestModal');
        if (oldModal) oldModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const amountInput = document.getElementById('partialReinvestAmount');
        if (amountInput && Utils.bindAmountFormat) {
            Utils.bindAmountFormat(amountInput);
        }
    },
    
    /**
     * 关闭部分再投入模态框
     */
    closePartialReinvestModal: function() {
        const modal = document.getElementById('partialReinvestModal');
        if (modal) modal.remove();
    },
    
    /**
     * 确认部分再投入
     */
    confirmPartialReinvest: async function() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        let storeId = null;
        if (isAdmin) {
            const storeSelect = document.getElementById('reinvestStoreSelect');
            if (storeSelect && storeSelect.value) {
                storeId = storeSelect.value;
            }
        }
        
        const amountStr = document.getElementById('partialReinvestAmount')?.value || '0';
        const amount = Utils.parseNumberFromCommas(amountStr);
        const description = document.getElementById('partialReinvestDesc')?.value.trim() || '';
        
        const pendingProfit = await SUPABASE.getPendingReinvestProfit(storeId);
        
        if (amount <= 0) {
            Utils.toast.warning(lang === 'id' ? 'Jumlah tidak valid' : '金额无效');
            return;
        }
        
        if (amount > pendingProfit) {
            Utils.toast.warning(lang === 'id' 
                ? `Jumlah melebihi keuntungan tersedia (${Utils.formatCurrency(pendingProfit)})`
                : `金额超过可用利润 (${Utils.formatCurrency(pendingProfit)})`);
            return;
        }
        
        const confirmMsg = lang === 'id'
            ? `Reinvestasi ${Utils.formatCurrency(amount)}?`
            : `再投入 ${Utils.formatCurrency(amount)}？`;
        
        const confirmed = await Utils.toast.confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            await SUPABASE.reinvestProfit({
                storeId: storeId,
                amount: amount,
                periodStart: null,
                periodEnd: null,
                description: description || (lang === 'id' ? 'Reinvestasi sebagian keuntungan' : '部分利润再投入')
            });
            
            Utils.toast.success(lang === 'id'
                ? `✅ Berhasil reinvestasi ${Utils.formatCurrency(amount)}`
                : `✅ 成功再投入 ${Utils.formatCurrency(amount)}`);
            
            CapitalModule.closePartialReinvestModal();
            await CapitalModule.showProfitReinvestPage();
            
        } catch (error) {
            console.error('confirmPartialReinvest error:', error);
            Utils.toast.error(error.message);
        }
    },
    
    // ==================== 资金占用详情 ====================
    
    /**
     * 显示资金占用详情模态框
     */
    showCapitalUtilizationDetail: async function() {
        const lang = Utils.lang;
        
        try {
            const report = await SUPABASE.getCapitalUtilizationReport();
            
            const modalHtml = `
                <div id="capitalDetailModal" class="modal-overlay">
                    <div class="modal-content" style="max-width: 800px;">
                        <h3>📊 ${lang === 'id' ? 'Detail Okupansi Modal' : '资金占用详情'}</h3>
                        
                        <div class="capital-summary-detail">
                            <div class="summary-row">
                                <span class="label">💰 ${lang === 'id' ? 'Total Modal' : '总资本'}:</span>
                                <span class="value primary">${Utils.formatCurrency(report.total_capital)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">📋 ${lang === 'id' ? 'Dalam Gadai' : '在押资金'}:</span>
                                <span class="value warning">${Utils.formatCurrency(report.deployed_capital)}</span>
                                <span class="sub">(${report.deployed_orders_count} ${lang === 'id' ? 'pesanan' : '笔订单'})</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">💵 ${lang === 'id' ? 'Dapat Digunakan' : '可动用资金'}:</span>
                                <span class="value success">${Utils.formatCurrency(report.available_capital)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">📈 ${lang === 'id' ? 'Tingkat Okupansi' : '资金占用率'}:</span>
                                <span class="value ${report.utilization_rate > 75 ? 'warning' : ''}">${report.utilization_rate.toFixed(1)}%</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">🏦 ${lang === 'id' ? 'Saldo Kas' : '现金余额'}:</span>
                                <span class="value">${Utils.formatCurrency(report.cash_balance)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">🏧 ${lang === 'id' ? 'Saldo Bank' : '银行余额'}:</span>
                                <span class="value">${Utils.formatCurrency(report.bank_balance)}</span>
                            </div>
                            <div class="summary-row">
                                <span class="label">⚖️ ${lang === 'id' ? 'Varians' : '账实差异'}:</span>
                                <span class="value ${report.balance_variance !== 0 ? 'warning' : 'success'}">
                                    ${Utils.formatCurrency(report.balance_variance)}
                                    ${report.balance_variance !== 0 ? (lang === 'id' ? ' (Perlu rekonsiliasi)' : ' (需盘点核对)') : ''}
                                </span>
                            </div>
                        </div>
                        
                        <div class="capital-health-status ${report.health_status}" style="margin:16px 0;padding:12px;border-radius:8px;">
                            <strong>🏥 ${lang === 'id' ? 'Status Kesehatan' : '健康状态'}:</strong> ${report.health_message}
                        </div>
                        
                        ${report.deployed_orders && report.deployed_orders.length > 0 ? `
                        <div class="capital-orders" style="margin-top:16px;">
                            <h4>📋 ${lang === 'id' ? 'Pesanan dalam Gadai' : '在押订单列表'}</h4>
                            <div class="table-container">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>${lang === 'id' ? 'ID Pesanan' : '订单号'}</th>
                                            <th>${lang === 'id' ? 'Nasabah' : '客户'}</th>
                                            <th class="amount">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${report.deployed_orders.map(o => `
                                            <tr>
                                                <td>${Utils.escapeHtml(o.order_id)}</td>
                                                <td>${Utils.escapeHtml(o.customer_name || '-')}</td>
                                                <td class="amount">${Utils.formatCurrency(o.loan_amount)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;margin-top:16px;">
                            <button onclick="APP.printCapitalDetail()" class="btn-print" style="padding:8px 20px;">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                            <button onclick="APP.closeCapitalDetailModal()" class="btn-back" style="padding:8px 20px;">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                        </div>
                    </div>
                </div>
            `;
            
            const oldModal = document.getElementById('capitalDetailModal');
            if (oldModal) oldModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
        } catch (error) {
            console.error('showCapitalUtilizationDetail error:', error);
            Utils.toast.error(lang === 'id' 
                ? 'Gagal memuat data okupansi modal: ' + error.message
                : '加载资金占用数据失败：' + error.message);
        }
    },
    
    /**
     * 关闭资金占用详情模态框
     */
    closeCapitalDetailModal: function() {
        const modal = document.getElementById('capitalDetailModal');
        if (modal) modal.remove();
    },
    
    /**
     * 打印资金占用详情
     */
    printCapitalDetail: function() {
        const modalContent = document.querySelector('#capitalDetailModal .modal-content');
        if (!modalContent) return;
        
        const printContent = modalContent.cloneNode(true);
        const lang = Utils.lang;
        const storeName = AUTH.getCurrentStoreName();
        const printDateTime = new Date().toLocaleString();
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>JF! by Gadai - ${lang === 'id' ? 'Laporan Okupansi Modal' : '资金占用报告'}</title>
                <style>
                    *{box-sizing:border-box;margin:0;padding:0}
                    body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;padding:15mm}
                    .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #1e293b;padding-bottom:10px}
                    .header h1{font-size:18px;margin:5px 0}
                    .store-info{text-align:center;font-size:10pt;color:#475569;margin:5px 0}
                    table{width:100%;border-collapse:collapse;margin-top:15px}
                    th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:10px}
                    th{background:#f1f5f9;font-weight:700}
                    .text-right{text-align:right}
                    .text-center{text-align:center}
                    .amount{text-align:right}
                    .primary{color:#2563eb}
                    .warning{color:#d97706}
                    .success{color:#059669}
                    .footer{text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px}
                    @media print{@page{size:A4;margin:15mm}}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>JF! by Gadai</h1>
                    <div class="store-info">🏪 ${Utils.escapeHtml(storeName)} | 📅 ${printDateTime}</div>
                    <h3>📊 ${lang === 'id' ? 'Laporan Okupansi Modal' : '资金占用报告'}</h3>
                </div>
                ${printContent.innerHTML}
                <div class="footer">
                    JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    }
};

// 挂载到 window.APP
for (const key in CapitalModule) {
    if (typeof CapitalModule[key] === 'function') {
        window.APP[key] = CapitalModule[key];
    }
}

console.log('✅ app-capital.js 加载完成');
