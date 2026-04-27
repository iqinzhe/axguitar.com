// app-blacklist.js - v1.5（添加详细错误处理和调试日志）

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
        
        console.log("=== addToBlacklist 调试开始 ===");
        console.log("1. 接收参数 - customerId:", customerId, "类型:", typeof customerId);
        console.log("2. 接收参数 - reason:", reason);
        
        // 验证原因
        if (!reason || reason.trim() === '') {
            console.error("原因不能为空");
            throw new Error(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
        }
        
        // 获取当前用户信息
        const profile = await SUPABASE.getCurrentProfile();
        console.log("3. 当前用户 profile:", profile);
        console.log("4. profile.id:", profile?.id, "类型:", typeof profile?.id);
        console.log("5. profile.store_id:", profile?.store_id, "类型:", typeof profile?.store_id);
        console.log("6. profile.role:", profile?.role);
        
        if (!profile) {
            console.error("无法获取当前用户信息");
            throw new Error(lang === 'id' ? 'Gagal mendapatkan data user' : '无法获取用户信息');
        }
        
        // 获取客户信息
        console.log("7. 查询客户信息, customerId:", customerId);
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('id, store_id, customer_id, name')
            .eq('id', customerId)
            .single();
        
        if (customerError) {
            console.error("获取客户信息失败 - 详细错误:", customerError);
            console.error("错误代码:", customerError.code);
            console.error("错误消息:", customerError.message);
            throw new Error(lang === 'id' ? 'Gagal mendapatkan data nasabah: ' + customerError.message : '获取客户信息失败：' + customerError.message);
        }
        
        console.log("8. 客户信息:", customer);
        console.log("9. customer.id:", customer.id, "类型:", typeof customer.id);
        console.log("10. customer.store_id:", customer.store_id, "类型:", typeof customer.store_id);
        console.log("11. customer.customer_id:", customer.customer_id);
        console.log("12. customer.name:", customer.name);
        
        // 权限检查：门店操作员只能拉黑自己门店的客户
        if (profile.role !== 'admin') {
            const customerStoreId = customer.store_id ? String(customer.store_id) : null;
            const userStoreId = profile.store_id ? String(profile.store_id) : null;
            
            console.log("13. 权限检查 - 非管理员模式");
            console.log("14. customerStoreId (String):", customerStoreId);
            console.log("15. userStoreId (String):", userStoreId);
            console.log("16. 是否匹配:", customerStoreId === userStoreId);
            
            if (!customer.store_id) {
                console.error("客户没有关联门店");
                throw new Error(lang === 'id' ? 'Nasabah tidak memiliki toko' : '客户没有关联门店');
            }
            
            if (!profile.store_id) {
                console.error("当前用户没有关联门店");
                throw new Error(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
            }
            
            if (customerStoreId !== userStoreId) {
                console.error("门店不匹配 - 不能拉黑其他门店的客户");
                throw new Error(lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
            }
        } else {
            console.log("13. 权限检查 - 管理员模式，跳过门店检查");
        }
        
        // 检查是否已在黑名单
        console.log("17. 检查是否已在黑名单, customer.id:", customer.id);
        const { data: existing, error: checkError } = await supabaseClient
            .from('blacklist')
            .select('id')
            .eq('customer_id', customer.id)
            .maybeSingle();
        
        if (checkError) {
            console.error("检查黑名单存在性失败:", checkError);
            // 继续执行，不抛出异常
        }
        
        if (existing) {
            console.log("18. 客户已在黑名单中, 黑名单ID:", existing.id);
            throw new Error(lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中');
        }
        console.log("18. 客户不在黑名单中，可以添加");
        
        // 准备插入数据
        const insertData = {
            customer_id: customer.id,
            reason: reason.trim(),
            blacklisted_by: profile.id,
            store_id: customer.store_id
        };
        
        console.log("19. 准备插入黑名单数据:", insertData);
        console.log("20. insertData.customer_id:", insertData.customer_id, "类型:", typeof insertData.customer_id);
        console.log("21. insertData.blacklisted_by:", insertData.blacklisted_by, "类型:", typeof insertData.blacklisted_by);
        console.log("22. insertData.store_id:", insertData.store_id, "类型:", typeof insertData.store_id);
        
        // 执行插入
        try {
            const { data, error } = await supabaseClient
                .from('blacklist')
                .insert(insertData)
                .select('*, customers(*), blacklisted_by_profile:user_profiles!blacklist_blacklisted_by_fkey(name)')
                .single();
            
            if (error) {
                console.error("23. 添加黑名单失败 - 数据库错误:");
                console.error("错误代码:", error.code);
                console.error("错误消息:", error.message);
                console.error("错误详情:", error.details);
                console.error("完整错误对象:", error);
                
                // 根据错误类型给出更友好的提示
                if (error.code === '23503') {
                    throw new Error(lang === 'id' 
                        ? 'Gagal menambahkan ke blacklist: Data referensi tidak valid (customer_id atau blacklisted_by tidak ditemukan)'
                        : '添加黑名单失败：引用数据无效（客户ID或操作用户不存在）');
                } else if (error.code === '23505') {
                    throw new Error(lang === 'id' 
                        ? 'Nasabah sudah ada di blacklist'
                        : '客户已在黑名单中');
                } else {
                    throw new Error(lang === 'id' 
                        ? 'Gagal menambahkan ke blacklist: ' + error.message
                        : '添加黑名单失败：' + error.message);
                }
            }
            
            console.log("24. 黑名单添加成功!");
            console.log("25. 返回数据:", data);
            console.log("=== addToBlacklist 调试结束 ===");
            
            return data;
            
        } catch (insertError) {
            console.error("插入操作异常:", insertError);
            throw insertError;
        }
    },
    
    removeFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        console.log("=== removeFromBlacklist 调试 ===");
        console.log("customerId:", customerId);
        console.log("profile.role:", profile?.role);
        
        if (profile?.role !== 'admin') {
            console.error("非管理员尝试解除黑名单");
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
        
        if (deleteError) {
            console.error("解除黑名单失败:", deleteError);
            throw deleteError;
        }
        
        console.log("解除黑名单成功");
        return true;
    },
    
    getBlacklist: async function() {
        const profile = await SUPABASE.getCurrentProfile();
        
        console.log("=== getBlacklist 调试 ===");
        console.log("profile.role:", profile?.role);
        console.log("profile.store_id:", profile?.store_id);
        
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
            console.log("应用门店过滤: store_id =", profile.store_id);
            query = query.eq('customers.store_id', profile.store_id);
        }
        
        const { data, error } = await query;
        if (error) {
            console.error("获取黑名单列表失败:", error);
            throw error;
        }
        
        console.log("获取到黑名单数量:", data?.length || 0);
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
                        '<td>' + Utils.escapeHtml(customer.customer_id || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(customer.name) + '</td>' +
                        '<td>' + Utils.escapeHtml(customer.phone || '-') + '</td>' +
                        '<td>' + Utils.escapeHtml(item.reason) + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(item.blacklisted_at) + '</td>' +
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

console.log("✅ app-blacklist.js 加载完成 (v1.5 - 添加详细调试日志)");
