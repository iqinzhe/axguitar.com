// app-blacklist.js - 黑名单管理模块
// 功能：拉黑客户、解除黑名单、黑名单列表、创建订单时检查

window.APP = window.APP || {};

const BlacklistModule = {
    
    // ==================== 检查客户是否在黑名单中 ====================
    isBlacklisted: async function(customerId) {
        const { data, error } = await supabaseClient
            .from('blacklist')
            .select('id, reason')
            .eq('customer_id', customerId)
            .maybeSingle();
        
        if (error) {
            console.error("检查黑名单失败:", error);
            return false;
        }
        return data ? { isBlacklisted: true, reason: data.reason } : { isBlacklisted: false };
    },
    
    // ==================== 拉黑客户 ====================
    addToBlacklist: async function(customerId, reason) {
        const profile = await SUPABASE.getCurrentProfile();
        
        if (!reason || reason.trim() === '') {
            throw new Error(Utils.lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
        }
        
        // 检查是否已在黑名单
        const check = await this.isBlacklisted(customerId);
        if (check.isBlacklisted) {
            throw new Error(Utils.lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中');
        }
        
        const { data, error } = await supabaseClient
            .from('blacklist')
            .insert({
                customer_id: customerId,
                reason: reason.trim(),
                blacklisted_by: profile.id
            })
            .select('*, customers(*), blacklisted_by_profile:user_profiles!blacklist_blacklisted_by_fkey(name)')
            .single();
        
        if (error) throw error;
        return data;
    },
    
    // ==================== 解除黑名单 ====================
    removeFromBlacklist: async function(customerId) {
        const { error } = await supabaseClient
            .from('blacklist')
            .delete()
            .eq('customer_id', customerId);
        
        if (error) throw error;
        return true;
    },
    
    // ==================== 获取黑名单列表 ====================
    getBlacklist: async function() {
        const { data, error } = await supabaseClient
            .from('blacklist')
            .select(`
                *,
                customers:customer_id (
                    id, customer_id, name, ktp_number, phone, ktp_address, store_id,
                    stores:store_id (name, code)
                ),
                blacklisted_by_profile:blacklisted_by (name)
            `)
            .order('blacklisted_at', { ascending: false });
        
        if (error) throw error;
        return data;
    },
    
    // ==================== 检查客户信息是否重复 ====================
    checkDuplicateCustomer: async function(name, ktpNumber, phone, excludeCustomerId = null) {
        let query = supabaseClient
            .from('customers')
            .select('id, customer_id, name, ktp_number, phone')
            .or(`name.eq.${name},ktp_number.eq.${ktpNumber},phone.eq.${phone}`);
        
        if (excludeCustomerId) {
            query = query.neq('id', excludeCustomerId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) return null;
        
        // 找出具体哪些字段重复
        const duplicateFields = [];
        for (var existing of data) {
            if (existing.name === name && !duplicateFields.includes('name')) duplicateFields.push('name');
            if (existing.ktp_number === ktpNumber && !duplicateFields.includes('ktp')) duplicateFields.push('ktp');
            if (existing.phone === phone && !duplicateFields.includes('phone')) duplicateFields.push('phone');
        }
        
        return {
            isDuplicate: true,
            duplicateFields: duplicateFields,
            existingCustomer: data[0]
        };
    },
    
    // ==================== 显示黑名单管理页面 ====================
    showBlacklist: async function() {
        this.currentPage = 'blacklist';
        this.saveCurrentPageState();
        
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        var isAdmin = AUTH.isAdmin();
        
        try {
            var blacklist = await this.getBlacklist();
            
            var rows = '';
            if (blacklist.length === 0) {
                rows = `<tr><td colspan="8" class="text-center">${lang === 'id' ? 'Belum ada nasabah dalam blacklist' : '暂无黑名单客户'}</td></tr>`;
            } else {
                for (var item of blacklist) {
                    var customer = item.customers;
                    var storeName = customer?.stores?.name || '-';
                    var blacklistedBy = item.blacklisted_by_profile?.name || '-';
                    
                    rows += `<tr>
                        <td class="customer-id-cell">${Utils.escapeHtml(customer?.customer_id || '-')}</td>
                        <td class="name-cell">${Utils.escapeHtml(customer?.name || '-')}</td>
                        <td class="ktp-cell">${Utils.escapeHtml(customer?.ktp_number || '-')}</td>
                        <td class="phone-cell">${Utils.escapeHtml(customer?.phone || '-')}</td>
                        <td class="store-cell">${Utils.escapeHtml(storeName)}</td>
                        <td class="reason-cell" style="max-width:250px;">${Utils.escapeHtml(item.reason)}</td>
                        <td class="date-cell">${Utils.formatDate(item.blacklisted_at)}</td>
                        <td class="action-cell">
                            ${isAdmin ? `<button onclick="APP.removeFromBlacklist('${customer.id}')" class="btn-small success">🔓 ${lang === 'id' ? 'Hapus' : '解除'}</button>` : ''}
                            <button onclick="APP.viewCustomerFromBlacklist('${customer.id}')" class="btn-small">👁️ ${t('view')}</button>
                        </td>
                    　　　`;
                }
            }
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>🚫 ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.exportBlacklistToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>🚫 ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</h3>
                    <p class="info-note" style="color:#dc2626; margin-bottom:12px;">
                        ⚠️ ${lang === 'id' ? 'Nasabah dalam daftar hitam TIDAK DAPAT membuat order baru.' : '黑名单客户无法创建新订单。'}
                    </p>
                    <div class="table-container">
                        <table class="data-table blacklist-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th>
                                    <th>${t('customer_name')}</th>
                                    <th>${t('ktp_number')}</th>
                                    <th>${t('phone')}</th>
                                    <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th>${lang === 'id' ? 'Alasan' : '拉黑原因'}</th>
                                    <th>${lang === 'id' ? 'Tanggal' : '拉黑日期'}</th>
                                    <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                <style>
                    .blacklist-table th, .blacklist-table td {
                        border: 1px solid #cbd5e1;
                        padding: 8px;
                        vertical-align: top;
                    }
                    .blacklist-table th {
                        background: #fef3c7;
                        color: #92400e;
                    }
                    .reason-cell {
                        font-size: 12px;
                        line-height: 1.4;
                    }
                </style>
            `;
        } catch (error) {
            console.error("showBlacklist error:", error);
            alert(lang === 'id' ? 'Gagal memuat daftar hitam' : '加载黑名单失败');
        }
    },
    
    // ==================== 从黑名单查看客户详情 ====================
    viewCustomerFromBlacklist: async function(customerId) {
        this.currentPage = 'customerOrders';
        this.currentCustomerId = customerId;
        this.saveCurrentPageState();
        await this.showCustomerOrders(customerId);
    },
    
    // ==================== 解除黑名单 ====================
    removeFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus nasabah ini dari daftar hitam?' : '确定将此客户移出黑名单？')) {
            return;
        }
        
        try {
            await this.removeFromBlacklist(customerId);
            alert(lang === 'id' ? '✅ Nasabah dihapus dari daftar hitam' : '✅ 客户已移出黑名单');
            await this.showBlacklist();
        } catch (error) {
            console.error("removeFromBlacklist error:", error);
            alert(lang === 'id' ? 'Gagal menghapus: ' + error.message : '移除失败：' + error.message);
        }
    },
    
    // ==================== 导出黑名单为 CSV ====================
    exportBlacklistToCSV: async function() {
        var lang = Utils.lang;
        var blacklist = await this.getBlacklist();
        
        if (blacklist.length === 0) {
            alert(lang === 'id' ? 'Tidak ada data untuk diekspor' : '没有数据可导出');
            return;
        }
        
        var headers = lang === 'id'
            ? ['ID Nasabah', 'Nama', 'KTP', 'Telepon', 'Toko', 'Alasan', 'Tanggal Diblacklist', 'Diblacklist Oleh']
            : ['客户ID', '姓名', 'KTP号', '电话', '门店', '拉黑原因', '拉黑日期', '操作人'];
        
        var rows = [];
        for (var item of blacklist) {
            var customer = item.customers;
            rows.push([
                customer?.customer_id || '-',
                customer?.name || '-',
                customer?.ktp_number || '-',
                customer?.phone || '-',
                customer?.stores?.name || '-',
                item.reason,
                Utils.formatDate(item.blacklisted_at),
                item.blacklisted_by_profile?.name || '-'
            ]);
        }
        
        var csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = `jf_blacklist_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    },
    
    // ==================== 打印黑名单 ====================
    printBlacklist: async function() {
        var lang = Utils.lang;
        var blacklist = await this.getBlacklist();
        
        var printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>JF! by Gadai - ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; font-size: 12px; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .header h1 { margin: 0; font-size: 18px; color: #dc2626; }
                    .header p { margin: 5px 0; color: #666; font-size: 11px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                    th { background: #fef3c7; font-weight: 600; }
                    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
                    @media print { @page { size: A4 landscape; margin: 10mm; } body { margin: 0; } .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚫 JF! by Gadai - ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</h1>
                    <p>${lang === 'id' ? 'Tanggal Cetak' : '打印日期'}: ${new Date().toLocaleString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th>
                            <th>${lang === 'id' ? 'Nama' : '姓名'}</th>
                            <th>${lang === 'id' ? 'KTP' : 'KTP'}</th>
                            <th>${lang === 'id' ? 'Telepon' : '电话'}</th>
                            <th>${lang === 'id' ? 'Alasan' : '拉黑原因'}</th>
                            <th>${lang === 'id' ? 'Tanggal' : '拉黑日期'}</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        for (var item of blacklist) {
            var customer = item.customers;
            printContent += `<tr>
                <td>${Utils.escapeHtml(customer?.customer_id || '-')}</td>
                <td>${Utils.escapeHtml(customer?.name || '-')}</td>
                <td>${Utils.escapeHtml(customer?.ktp_number || '-')}</td>
                <td>${Utils.escapeHtml(customer?.phone || '-')}</td>
                <td>${Utils.escapeHtml(item.reason)}</td>
                <td>${Utils.formatDate(item.blacklisted_at)}</td>
            </tr>`;
        }
        
        printContent += `
                    </tbody>
                </table>
                <div class="footer">
                    <div>JF! by Gadai - ${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div>
                    <div>${lang === 'id' ? 'Nasabah dalam daftar ini TIDAK DAPAT membuat order baru' : '此名单中的客户无法创建新订单'}</div>
                </div>
                <div class="no-print" style="text-align:center; margin-top:20px;">
                    <button onclick="window.print()" style="padding:8px 16px;">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                    <button onclick="window.close()" style="padding:8px 16px; margin-left:10px;">✖ ${lang === 'id' ? 'Tutup' : '关闭'}</button>
                </div>
            </body>
            </html>
        `;
        
        var printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
    }
};

// 合并到 window.APP
for (var key in BlacklistModule) {
    if (typeof BlacklistModule[key] === 'function') {
        window.APP[key] = BlacklistModule[key];
    }
}
