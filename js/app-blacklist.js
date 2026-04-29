// app-blacklist.js - v1.0 (修复：使用 SUPABASE.getClient() 替代直接使用 supabaseClient)

window.APP = window.APP || {};

// 辅助函数：安全过滤输入
function sanitizeInput(str) {
    if (!str) return '';
    return String(str).replace(/[^\p{L}\p{N}\s\-\.]/gu, '');
}

// 辅助函数：转义 PostgREST 过滤字符串中的特殊字符（保留用于兼容）
function escapePostgRESTValue(str) {
    if (!str) return '';
    // 转义逗号、括号、点号（PostgREST 语法特殊字符）
    return String(str).replace(/[,()\.\[\]]/g, '\\$&');
}

const BlacklistModule = {
    
    // 使用 SUPABASE 封装方法
    isBlacklisted: async function(customerId) {
        try {
            return await SUPABASE.checkBlacklist(customerId);
        } catch (error) {
            console.error("检查黑名单失败:", error);
            return { isBlacklisted: false };
        }
    },
    
    // 使用 SUPABASE 封装方法
    addToBlacklist: async function(customerId, reason) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (!reason || reason.trim() === '') {
            throw new Error(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
        }
        
        // 权限检查：门店操作员只能拉黑自己门店的客户
        if (profile?.role !== 'admin') {
            // 先获取客户信息进行门店校验
            const client = SUPABASE.getClient();
            const { data: customer, error: customerError } = await client
                .from('customers')
                .select('store_id')
                .eq('id', customerId)
                .single();
            
            if (customerError) {
                console.error("获取客户信息失败:", customerError);
                throw new Error(lang === 'id' ? 'Gagal mendapatkan data nasabah' : '获取客户信息失败');
            }
            
            const customerStoreId = customer.store_id ? String(customer.store_id) : null;
            const userStoreId = profile?.store_id ? String(profile?.store_id) : null;
            
            if (customerStoreId !== userStoreId) {
                throw new Error(lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
            }
        }
        
        try {
            return await SUPABASE.addToBlacklist(customerId, reason, profile.id);
        } catch (error) {
            console.error("添加黑名单失败:", error);
            throw error;
        }
    },
    
    // 使用 SUPABASE 封装方法
    removeFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(lang === 'id' ? 'Hanya administrator yang dapat menghapus blacklist' : '只有管理员可以解除黑名单');
        }
        
        try {
            return await SUPABASE.removeFromBlacklist(customerId);
        } catch (error) {
            console.error("解除黑名单失败:", error);
            throw error;
        }
    },
    
    // 使用 SUPABASE 封装方法
    getBlacklist: async function() {
        const profile = await SUPABASE.getCurrentProfile();
        return await SUPABASE.getBlacklist(profile?.store_id, profile);
    },
    
    // 使用 SUPABASE 封装方法（保留原有接口兼容）
    checkDuplicateCustomer: async function(name, ktpNumber, phone, excludeCustomerId = null) {
        return await SUPABASE.checkDuplicateCustomer(name, ktpNumber, phone, excludeCustomerId);
    },
    
    // ========== 显示黑名单列表页面 ==========
    showBlacklist: async function() {
        APP.currentPage = 'blacklist';
        APP.saveCurrentPageState();
        
        const lang = Utils.lang;
        const t = Utils.t;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        try {
            const blacklist = await this.getBlacklist();
            
            // 总列数：ID, 姓名, 职业, 电话, 原因, 日期, 操作(仅admin)
            var totalCols = isAdmin ? 7 : 6;
            
            var headerHtml = '<tr>' +
                '<th class="col-id">' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                '<th class="col-name">' + t('customer_name') + '</th>' +
                '<th class="col-name">' + (lang === 'id' ? 'Pekerjaan' : '职业') + '</th>' +
                '<th class="col-phone">' + t('phone') + '</th>' +
                '<th>' + (lang === 'id' ? 'Alasan' : '原因') + '</th>' +
                '<th class="col-date">' + (lang === 'id' ? 'Tanggal Blacklist' : '拉黑日期') + '</th>';
            
            if (isAdmin) {
                headerHtml += '<th class="col-action">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>';
            }
            headerHtml += '</table>';
            
            var rows = '';
            if (!blacklist || blacklist.length === 0) {
                rows = '<tr><td colspan="' + totalCols + '" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var i = 0; i < blacklist.length; i++) {
                    var item = blacklist[i];
                    var customer = item.customers;
                    if (!customer) continue;
                    
                    var occupationDisplay = Utils.escapeHtml(customer.occupation || '-');
                    
                    rows += '<tr>' +
                        '<td class="col-id">' + Utils.escapeHtml(customer.customer_id || '-') + '</td>' +
                        '<td class="col-name">' + Utils.escapeHtml(customer.name) + '</td>' +
                        '<td class="col-name">' + occupationDisplay + '</td>' +
                        '<td class="col-phone">' + Utils.escapeHtml(customer.phone || '-') + '</td>' +
                        '<td class="desc-cell">' + Utils.escapeHtml(item.reason) + '</td>' +
                        '<td class="col-date">' + Utils.formatDate(item.blacklisted_at) + '</td>';
                    
                    if (isAdmin) {
                        rows += '<td class="text-center"><button onclick="APP.removeFromBlacklist(\'' + Utils.escapeAttr(customer.id) + '\')" class="btn-small danger">🚫 ' + (lang === 'id' ? 'Hapus' : '解除') + '</button></td>';
                    }
                    
                    rows += '</tr>';
                }
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>🚫 ' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print no-print">🖨️ ' + t('print') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back no-print">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="info-bar warning">' +
                    '<span class="info-bar-icon">⚠️</span>' +
                    '<div class="info-bar-content">' +
                        '<strong>' + (lang === 'id' ? 'Informasi:' : '提示：') + '</strong> ' +
                        (lang === 'id' 
                            ? 'Nasabah yang di-blacklist tidak dapat membuat pesanan baru. Hanya administrator yang dapat menghapus dari daftar hitam.'
                            : '被拉黑的客户无法创建新订单。只有管理员可以解除黑名单。') +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<h3>📋 ' + (lang === 'id' ? 'Daftar Nasabah Blacklist' : '黑名单客户列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead>' +
                                headerHtml +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
            
        } catch (error) {
            console.error("showBlacklist error:", error);
            Utils.toast.error(lang === 'id' ? 'Gagal memuat data blacklist: ' + error.message : '加载黑名单失败：' + error.message);
        }
    }
};

Object.assign(window.APP, BlacklistModule);
