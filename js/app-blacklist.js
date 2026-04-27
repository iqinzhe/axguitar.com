// app-blacklist.js - v1.6（修复多个外键关系导致的嵌入错误）
window.APP = window.APP || {};

// 辅助函数：安全过滤输入
function sanitizeInput(str) {
    if (!str) return '';
    return String(str).replace(/[^\p{L}\p{N}\s\-\.]/gu, '');
}

const BlacklistModule = {
    
    isBlacklisted: async function(customerId) {
        let { data, error } = await supabaseClient
            .from('blacklist')
            .select('id, reason')
            .eq('customer_id', customerId)
            .maybeSingle();
        
        if (error && error.code === '22P02') {
            try {
                const { data: customer } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('customer_id', customerId)
                    .single();
                
                if (customer) {
                    const { data: retryData, error: retryError } = await supabaseClient
                        .from('blacklist')
                        .select('id, reason')
                        .eq('customer_id', customer.id)
                        .maybeSingle();
                    
                    if (retryError) {
                        console.error("检查黑名单失败:", retryError);
                        return { isBlacklisted: false };
                    }
                    return retryData ? { isBlacklisted: true, reason: retryData.reason } : { isBlacklisted: false };
                }
            } catch (e) {
                console.warn("通过customer_id查找客户失败:", e.message);
            }
            return { isBlacklisted: false };
        }
        
        if (error) {
            console.error("检查黑名单失败:", error);
            return { isBlacklisted: false };
        }
        return data ? { isBlacklisted: true, reason: data.reason } : { isBlacklisted: false };
    },
    
    addToBlacklist: async function(customerId, reason) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (!reason || reason.trim() === '') {
            throw new Error(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
        }
        
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('id, store_id, customer_id, name')
            .eq('id', customerId)
            .single();
        
        if (customerError) {
            console.error("获取客户信息失败:", customerError);
            throw new Error(lang === 'id' ? 'Gagal mendapatkan data nasabah' : '获取客户信息失败');
        }
        
        // 权限检查：门店操作员只能拉黑自己门店的客户
        if (profile?.role !== 'admin') {
            const customerStoreId = customer.store_id ? String(customer.store_id) : null;
            const userStoreId = profile?.store_id ? String(profile?.store_id) : null;
            
            if (customerStoreId !== userStoreId) {
                throw new Error(lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
            }
        }
        
        // 检查是否已在黑名单
        const { data: existing, error: checkError } = await supabaseClient
            .from('blacklist')
            .select('id')
            .eq('customer_id', customer.id)
            .maybeSingle();
        
        if (existing) {
            throw new Error(lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中');
        }
        
        // 插入黑名单记录（不使用 .select() 嵌套查询，避免多个外键关系错误）
        const insertData = {
            customer_id: customer.id,
            reason: reason.trim(),
            blacklisted_by: profile.id,
            store_id: customer.store_id
        };
        
        const { error: insertError } = await supabaseClient
            .from('blacklist')
            .insert(insertData);
        
        if (insertError) {
            console.error("添加黑名单失败:", insertError);
            throw new Error(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + insertError.message : '添加黑名单失败：' + insertError.message);
        }
        
        // 重新获取完整数据用于返回（可选）
        const { data: newBlacklist, error: fetchError } = await supabaseClient
            .from('blacklist')
            .select('*')
            .eq('customer_id', customer.id)
            .single();
        
        if (fetchError) {
            console.warn("获取新黑名单记录失败:", fetchError);
            // 即使获取失败，插入已经成功
        }
        
        return newBlacklist || { customer_id: customer.id, reason: reason.trim() };
    },
    
    removeFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(lang === 'id' ? 'Hanya administrator yang dapat menghapus blacklist' : '只有管理员可以解除黑名单');
        }
        
        let deleteError = null;
        
        const { error: directError } = await supabaseClient
            .from('blacklist')
            .delete()
            .eq('customer_id', customerId);
        
        if (directError && directError.code === '22P02') {
            try {
                const { data: customer } = await supabaseClient
                    .from('customers')
                    .select('id')
                    .eq('customer_id', customerId)
                    .single();
                
                if (customer) {
                    const { error: retryError } = await supabaseClient
                        .from('blacklist')
                        .delete()
                        .eq('customer_id', customer.id);
                    deleteError = retryError;
                } else {
                    deleteError = directError;
                }
            } catch (e) {
                deleteError = directError;
            }
        } else {
            deleteError = directError;
        }
        
        if (deleteError) throw deleteError;
        return true;
    },
    
    getBlacklist: async function() {
        const profile = await SUPABASE.getCurrentProfile();
        
        let query = supabaseClient
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
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('customers.store_id', profile.store_id);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    checkDuplicateCustomer: async function(name, ktpNumber, phone, excludeCustomerId = null) {
        const safeName = sanitizeInput(name);
        const safeKtp = sanitizeInput(ktpNumber);
        const safePhone = sanitizeInput(phone);
        
        let query = supabaseClient
            .from('customers')
            .select('id, customer_id, name, ktp_number, phone');
        
        const conditions = [];
        if (safeName) conditions.push(`name.eq.${safeName}`);
        if (safeKtp) conditions.push(`ktp_number.eq.${safeKtp}`);
        if (safePhone) conditions.push(`phone.eq.${safePhone}`);
        
        if (conditions.length === 0) {
            return null;
        }
        
        query = query.or(conditions.join(','));
        
        if (excludeCustomerId) {
            query = query.neq('id', excludeCustomerId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) return null;
        
        const duplicateFields = [];
        const duplicateInfo = {
            name: null,
            ktp: null,
            phone: null
        };
        
        for (var existing of data) {
            if (existing.name === name && !duplicateInfo.name) {
                duplicateFields.push('name');
                duplicateInfo.name = existing;
            }
            if (existing.ktp_number === ktpNumber && !duplicateInfo.ktp) {
                duplicateFields.push('ktp');
                duplicateInfo.ktp = existing;
            }
            if (existing.phone === phone && !duplicateInfo.phone) {
                duplicateFields.push('phone');
                duplicateInfo.phone = existing;
            }
        }
        
        const uniqueFields = [...new Set(duplicateFields)];
        
        let bestMatch = data[0];
        for (var customer of data) {
            if (customer.name === name && customer.ktp_number === ktpNumber && customer.phone === phone) {
                bestMatch = customer;
                break;
            }
        }
        
        return {
            isDuplicate: true,
            duplicateFields: uniqueFields,
            existingCustomer: bestMatch,
            duplicateInfo: duplicateInfo
        };
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
            
            var rows = '';
            if (!blacklist || blacklist.length === 0) {
                rows = '<tr><td colspan="' + (isAdmin ? 6 : 5) + '" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var item of blacklist) {
                    var customer = item.customers;
                    if (!customer) continue;
                    
                    var actionHtml = '';
                    if (isAdmin) {
                        actionHtml = '<button onclick="APP.removeFromBlacklist(\'' + Utils.escapeAttr(customer.id) + '\')" class="btn-small danger">🚫 ' + (lang === 'id' ? 'Hapus' : '解除') + '</button>';
                    } else {
                        actionHtml = '<span class="locked-badge">🔒 ' + (lang === 'id' ? 'Terkunci' : '已锁定') + '</span>';
                    }
                    
                    rows += '<tr>' +
                        '<td class="col-id">' + Utils.escapeHtml(customer.customer_id || '-') + '</td>' +
                        '<td class="col-name">' + Utils.escapeHtml(customer.name) + '</td>' +
                        '<td class="col-phone">' + Utils.escapeHtml(customer.phone || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(item.reason) + '</td>' +
                        '<td class="col-date">' + Utils.formatDate(item.blacklisted_at) + '</td>' +
                    '</tr>' +
                    '<tr class="action-row">' +
                        '<td class="action-label">' + (lang === 'id' ? 'Aksi' : '操作') + '</td>' +
                        '<td colspan="' + (isAdmin ? 5 : 4) + '">' +
                            '<div class="action-buttons">' + actionHtml + '</div>' +
                        '</td>' +
                    '</tr>';
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
                                '<tr>' +
                                    '<th class="col-id">' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                                    '<th class="col-name">' + t('customer_name') + '</th>' +
                                    '<th class="col-phone">' + t('phone') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Alasan' : '原因') + '</th>' +
                                    '<th class="col-date">' + (lang === 'id' ? 'Tanggal Blacklist' : '拉黑日期') + '</th>' +
                                    (isAdmin ? '<th class="col-action">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' : '') +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
            
        } catch (error) {
            console.error("showBlacklist error:", error);
            alert(lang === 'id' ? 'Gagal memuat data blacklist: ' + error.message : '加载黑名单失败：' + error.message);
        }
    }
};

Object.assign(window.APP, BlacklistModule);
