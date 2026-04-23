renderBackupUI: async function() {
    const lang = Utils.lang;
    const t = Utils.t;
    const profile = await SUPABASE.getCurrentProfile();
    const isAdmin = profile?.role === 'admin';
    
    if (!isAdmin) {
        alert(lang === 'id' ? 'Hanya administrator yang dapat mengakses manajemen cadangan' : '只有管理员可以访问备份管理');
        try {
            if (typeof APP !== 'undefined' && typeof APP.goBack === 'function') {
                APP.goBack();
            } else if (typeof window.APP !== 'undefined' && typeof window.APP.goBack === 'function') {
                window.APP.goBack();
            } else if (typeof window.APP !== 'undefined' && typeof window.APP.renderDashboard === 'function') {
                window.APP.renderDashboard();
            } else {
                window.location.reload();
            }
        } catch(e) {
            console.warn("返回失败:", e);
            window.location.reload();
        }
        return;
    }
    
    // 修复：直接使用 lang 判断，避免 t 函数缺少键
    var pageTitle = lang === 'id' ? 'Cadangan & Pemulihan' : '备份恢复';
    
    document.getElementById("app").innerHTML = `
        <div class="page-header">
            <h2>💾 ${pageTitle}</h2>
            <div class="header-actions">
                <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
            </div>
        </div>
        
        <div class="card">
            <h3>📤 ${lang === 'id' ? 'Ekspor Data (Cadangan)' : '导出数据（备份）'}</h3>
            <p>${lang === 'id' 
                ? 'Ekspor semua data (pesanan, nasabah, pengeluaran, pembayaran, dll.) ke file JSON.'
                : '导出所有数据（订单、客户、支出、缴费记录等）为 JSON 文件。'}</p>
            <button onclick="Storage.backup()" class="success">💾 ${lang === 'id' ? 'Cadangkan Sekarang' : '立即备份'}</button>
        </div>
        
        <div class="card">
            <h3>📥 ${lang === 'id' ? 'Impor Data (Pemulihan)' : '导入数据（恢复）'}</h3>
            <p class="warning-text">⚠️ ${lang === 'id' 
                ? 'Memulihkan data akan menimpa data yang ada! Pastikan Anda telah mencadangkan data saat ini.'
                : '恢复数据将覆盖现有数据！请确保已备份当前数据。'}</p>
            <input type="file" id="restoreFile" accept=".json" style="margin-bottom:10px;">
            <button onclick="Storage.restoreFromFile()" class="warning">🔄 ${lang === 'id' ? 'Pulihkan Data' : '恢复数据'}</button>
        </div>
        
        <div class="card">
            <h3>🎯 ${lang === 'id' ? 'Pemulihan Selektif' : '选择性恢复'}</h3>
            <p>${lang === 'id' 
                ? 'Pulihkan hanya jenis data tertentu, tidak mempengaruhi data lainnya.'
                : '仅恢复特定类型的数据，不影响其他数据。'}</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <input type="file" id="selectiveFile" accept=".json" style="margin-bottom:10px; width:100%;">
                <button onclick="Storage.restoreOrdersOnlyFromFile()" class="btn-small">📋 ${lang === 'id' ? 'Pulihkan Pesanan' : '恢复订单'}</button>
                <button onclick="Storage.restoreCustomersOnlyFromFile()" class="btn-small">👥 ${lang === 'id' ? 'Pulihkan Nasabah' : '恢复客户'}</button>
            </div>
        </div>
        
        <div class="card">
            <h3>📊 ${lang === 'id' ? 'Ekspor CSV' : '导出 CSV'}</h3>
            <p>${lang === 'id' 
                ? 'Ekspor ke format CSV, dapat dibuka di Excel.'
                : '导出为 CSV 格式，可在 Excel 中打开。'}</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button onclick="Storage.exportOrdersToCSV()" class="btn-small">📋 ${lang === 'id' ? 'Ekspor Pesanan' : '导出订单'}</button>
                <button onclick="Storage.exportPaymentsToCSV()" class="btn-small">💰 ${lang === 'id' ? 'Ekspor Pembayaran' : '导出缴费'}</button>
                <button onclick="Storage.exportCustomersToCSV()" class="btn-small">👥 ${lang === 'id' ? 'Ekspor Nasabah' : '导出客户'}</button>
            </div>
        </div>
        
        <style>
            .warning-text { color: #e74c3c; margin-bottom: 15px; }
        </style>
    `;
},
