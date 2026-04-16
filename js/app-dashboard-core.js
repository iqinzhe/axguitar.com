    // ==================== 资金管理模态框（完整版：启动资金/本金提取/利润分红/利润再投资/本金循环）====================
    showCapitalModal: async function() {
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        var profile = await SUPABASE.getCurrentProfile();
        
        var stores = await SUPABASE.getAllStores();
        var currentStoreId = profile?.store_id;
        
        // 构建门店选项
        var storeOptions = '';
        for (var store of stores) {
            if (!isAdmin && store.id !== currentStoreId) continue;
            storeOptions += `<option value="${store.id}">${Utils.escapeHtml(store.name)} (${Utils.escapeHtml(store.code || '-')})</option>`;
        }
        
        var transactions = [];
        try {
            transactions = await SUPABASE.getCapitalTransactions();
        } catch(e) { console.error(e); }
        
        // 根据角色构建交易类型选项（双语）
        var typeOptions = '';
        if (isAdmin) {
            typeOptions = `
                <option value="investment">💰 ${lang === 'id' ? 'Modal Awal' : '启动资金'}</option>
                <option value="withdrawal">📤 ${lang === 'id' ? 'Penarikan Modal' : '本金提取'}</option>
                <option value="dividend">📊 ${lang === 'id' ? 'Dividen' : '利润分红'}</option>
            `;
        } else {
            typeOptions = `
                <option value="reinvestment">🔄 ${lang === 'id' ? 'Reinvestasi Laba (Bunga)' : '利润再投资（利息）'}</option>
                <option value="capital_circulation">🔄 ${lang === 'id' ? 'Sirkulasi Modal (Pokok)' : '本金循环（回收本金）'}</option>
            `;
        }
        
        // 构建历史记录表格行（双语）
        var typeMap = {
            investment: lang === 'id' ? '💰 Modal Awal' : '💰 启动资金',
            withdrawal: lang === 'id' ? '📤 Penarikan Modal' : '📤 本金提取',
            dividend: lang === 'id' ? '📊 Dividen' : '📊 利润分红',
            reinvestment: lang === 'id' ? '🔄 Reinvestasi Laba' : '🔄 利润再投资',
            capital_circulation: lang === 'id' ? '🔄 Sirkulasi Modal' : '🔄 本金循环'
        };
        
        var transactionRows = '';
        if (transactions.length === 0) {
            transactionRows = `<tr><td colspan="6" class="text-center">${lang === 'id' ? 'Belum ada transaksi modal' : '暂无资金记录'}</td></tr>`;
        } else {
            for (var txn of transactions.slice(0, 10)) {
                var sourceStoreName = txn.source_store?.name || '-';
                var targetStoreName = txn.target_store?.name || '-';
                var flowText = sourceStoreName === targetStoreName ? targetStoreName : `${sourceStoreName} → ${targetStoreName}`;
                var isIncome = (txn.type === 'investment' || txn.type === 'reinvestment' || txn.type === 'capital_circulation');
                transactionRows += `<tr>
                    <td class="date-cell">${Utils.formatDate(txn.transaction_date)}</td>
                    <td class="text-center">${typeMap[txn.type] || txn.type}</td>
                    <td class="text-center">${txn.payment_method === 'cash' ? '🏦 ' + (lang === 'id' ? 'Tunai' : '现金') : '🏧 ' + (lang === 'id' ? 'Bank' : '银行')}</td>
                    <td class="text-center">${flowText}</td>
                    <td class="text-right ${isIncome ? 'income' : 'expense'}">${Utils.formatCurrency(txn.amount)}</td>
                    <td class="desc-cell">${Utils.escapeHtml(txn.description || '-')}</td>
                　　　`;
            }
        }
        
        // 非 Admin 时隐藏流向选择（利润再投资和本金循环自动使用当前门店）
        var targetStoreHtml = '';
        if (isAdmin) {
            targetStoreHtml = `
                <div class="form-group" id="capitalTargetStoreGroup">
                    <label>${lang === 'id' ? 'Aliran Dana' : '资金流向'}</label>
                    <select id="capitalTargetStore">
                        ${storeOptions}
                    </select>
                    <small style="color:#64748b;font-size:11px;display:block;margin-top:4px;">
                        💡 ${lang === 'id' ? 'Pilih toko penerima dana' : '选择资金接收方门店'}
                    </small>
                </div>
            `;
        }
        
        var modal = document.createElement('div');
        modal.id = 'capitalModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:750px;">
                <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <h3 style="margin:0;">🏦 ${lang === 'id' ? 'Kelola Modal' : '资金管理'}</h3>
                    <button onclick="document.getElementById('capitalModal').remove()" style="background:transparent;color:#64748b;font-size:20px;border:none;cursor:pointer;">✖</button>
                </div>
                
                <div class="modal-section" style="margin-bottom:24px;">
                    <h4 style="margin:0 0 12px 0;">📝 ${lang === 'id' ? 'Tambah Transaksi Baru' : '新增交易'}</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Tipe' : '类型'}</label>
                            <select id="capitalType">
                                ${typeOptions}
                            </select>
                            ${!isAdmin ? `<small style="color:#64748b;font-size:11px;display:block;margin-top:4px;">💡 ${lang === 'id' ? 'Catat penggunaan dana untuk modal kerja' : '记录资金用于运营投入'}</small>` : ''}
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Metode' : '方式'}</label>
                            <select id="capitalMethod">
                                <option value="cash">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜（现金）'}</option>
                                <option value="bank">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</option>
                            </select>
                        </div>
                        ${targetStoreHtml}
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Jumlah (IDR)' : '金额'}</label>
                            <input type="text" id="capitalAmount" placeholder="0" class="amount-input">
                        </div>
                        <div class="form-group full-width">
                            <label>${lang === 'id' ? 'Keterangan' : '说明'}</label>
                            <input type="text" id="capitalDesc" placeholder="${lang === 'id' ? 'Contoh: Reinvestasi bunga, Sirkulasi modal' : '例如：利息再投资、本金循环'}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Tanggal' : '日期'}</label>
                            <input type="date" id="capitalDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                    </div>
                    <div class="form-actions" style="margin-top:16px;">
                        <button onclick="APP.saveCapitalTransaction()" class="success">💾 ${lang === 'id' ? 'Simpan Transaksi' : '保存交易'}</button>
                    </div>
                </div>
                
                <h4 style="margin:16px 0 12px 0;">📋 ${lang === 'id' ? 'Riwayat Transaksi Modal' : '资金流水记录'}</h4>
                <div class="table-container" style="max-height:300px;overflow-y:auto;">
                    <table class="data-table" style="width:100%;">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'Tipe' : '类型'}</th>
                                <th>${lang === 'id' ? 'Metode' : '方式'}</th>
                                <th>${lang === 'id' ? 'Aliran Dana' : '资金流向'}</th>
                                <th class="text-right">${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Keterangan' : '说明'}</th>
                            </tr>
                        </thead>
                        <tbody>${transactionRows}</tbody>
                    </table>
                </div>
                
                <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
                    <button onclick="document.getElementById('capitalModal').remove()">${lang === 'id' ? 'Tutup' : '关闭'}</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        var amountInput = document.getElementById('capitalAmount');
        if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
        
        // 非 Admin 时，类型切换不需要额外处理（因为没有流向选择）
        if (isAdmin) {
            var typeSelect = document.getElementById('capitalType');
            var targetStoreGroup = document.getElementById('capitalTargetStoreGroup');
            if (typeSelect && targetStoreGroup) {
                typeSelect.addEventListener('change', function() {
                    // 所有类型都需要选择流向，保持显示
                    targetStoreGroup.style.display = 'block';
                });
            }
        }
    },

    saveCapitalTransaction: async function() {
        var lang = Utils.lang;
        var type = document.getElementById('capitalType').value;
        var paymentMethod = document.getElementById('capitalMethod').value;
        var amountStr = document.getElementById('capitalAmount').value;
        var amount = Utils.parseNumberFromCommas(amountStr);
        var description = document.getElementById('capitalDesc').value.trim();
        var transactionDate = document.getElementById('capitalDate').value;
        var isAdmin = AUTH.isAdmin();
        
        if (!amount || amount <= 0) {
            alert(lang === 'id' ? 'Masukkan jumlah yang valid' : '请输入有效金额');
            return;
        }
        
        var targetStoreId = null;
        var targetStoreName = '';
        
        if (isAdmin) {
            targetStoreId = document.getElementById('capitalTargetStore')?.value;
            if (!targetStoreId) {
                alert(lang === 'id' ? 'Harap pilih aliran dana' : '请选择资金流向');
                return;
            }
            var stores = await SUPABASE.getAllStores();
            var targetStore = stores.find(s => s.id === targetStoreId);
            targetStoreName = targetStore?.name || '-';
        } else {
            // 非 Admin：利润再投资或本金循环，自动使用当前门店
            const profile = await SUPABASE.getCurrentProfile();
            targetStoreId = profile.store_id;
            var currentStore = await SUPABASE.getStoreName(targetStoreId);
            targetStoreName = currentStore;
        }
        
        var typeText = '';
        var methodText = paymentMethod === 'cash' ? (lang === 'id' ? 'Brankas' : '保险柜') : 'Bank BNI';
        
        if (type === 'investment') {
            typeText = lang === 'id' ? 'Modal Awal' : '启动资金';
        } else if (type === 'withdrawal') {
            typeText = lang === 'id' ? 'Penarikan Modal' : '本金提取';
        } else if (type === 'dividend') {
            typeText = lang === 'id' ? 'Dividen' : '利润分红';
        } else if (type === 'reinvestment') {
            typeText = lang === 'id' ? 'Reinvestasi Laba' : '利润再投资';
        } else if (type === 'capital_circulation') {
            typeText = lang === 'id' ? 'Sirkulasi Modal' : '本金循环';
        }
        
        var confirmMsg = lang === 'id' 
            ? `Konfirmasi ${typeText} ${Utils.formatCurrency(amount)} via ${methodText}\nToko: ${targetStoreName}?`
            : `确认${typeText} ${Utils.formatCurrency(amount)}，方式：${methodText}\n门店：${targetStoreName}？`;
        
        if (!confirm(confirmMsg)) return;
        
        try {
            const profile = await SUPABASE.getCurrentProfile();
            
            // 根据类型设置描述默认值
            var defaultDesc = '';
            if (type === 'reinvestment') {
                defaultDesc = lang === 'id' ? 'Reinvestasi laba dari bunga' : '利息利润再投资';
            } else if (type === 'capital_circulation') {
                defaultDesc = lang === 'id' ? 'Sirkulasi modal dari pokok kembali' : '回收本金循环使用';
            } else if (type === 'investment') {
                defaultDesc = lang === 'id' ? 'Modal awal' : '启动资金';
            } else if (type === 'withdrawal') {
                defaultDesc = lang === 'id' ? 'Penarikan modal' : '本金提取';
            } else if (type === 'dividend') {
                defaultDesc = lang === 'id' ? 'Pembagian dividen' : '利润分红';
            }
            
            await SUPABASE.addCapitalTransaction({
                store_id: profile.store_id,
                target_store_id: targetStoreId,
                type: type,
                payment_method: paymentMethod,
                amount: amount,
                description: description || defaultDesc,
                transaction_date: transactionDate
            });
            alert(lang === 'id' ? 'Transaksi modal berhasil disimpan' : '资金交易保存成功');
            document.getElementById('capitalModal')?.remove();
            await this.renderDashboard();
        } catch (error) {
            console.error("saveCapitalTransaction error:", error);
            alert(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
        }
    },
