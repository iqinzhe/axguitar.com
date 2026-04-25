// app-blacklist.js - v1.1（修复黑名单功能，使用UUID正确关联）

window.APP = window.APP || {};

// 辅助函数：安全过滤输入（修复：支持更多 Unicode 字符，包括印尼语变音字母）
function sanitizeInput(str) {
    if (!str) return '';
    // 使用更安全的 Unicode 属性匹配方式
    // 允许：字母（包括拉丁扩展区）、数字、空格、中文
    // 保留常用标点：空格、连字符、点号
    return String(str).replace(/[^\p{L}\p{N}\s\-\.]/gu, '');
}

const BlacklistModule = {
    
    // 修复：isBlacklisted 支持两种ID类型（UUID 和 customer_id 字符串）
    isBlacklisted: async function(customerId) {
        // 先尝试用 customerId 直接查询（可能是 UUID）
        let { data, error } = await supabaseClient
            .from('blacklist')
            .select('id, reason')
            .eq('customer_id', customerId)
            .maybeSingle();
        
        if (error && error.code === '22P02') {
            // 如果错误是无效UUID格式，则尝试通过 customers 表查找真实 UUID
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
    
    // 修复：addToBlacklist 使用客户UUID而不是customer_id字符串
    addToBlacklist: async function(customerId, reason) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (!reason || reason.trim() === '') {
            throw new Error(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
        }
        
        // 获取客户的详细信息，包括 store_id
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('id, store_id, customer_id, name')
            .eq('id', customerId)
            .single();
        
        if (customerError) {
            console.error("获取客户信息失败:", customerError);
            throw new Error(lang === 'id' ? 'Gagal mendapatkan data nasabah' : '获取客户信息失败');
        }
        
        // 权限检查
        if (profile?.role !== 'admin' && customer.store_id !== profile?.store_id) {
            throw new Error(lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
        }
        
        // 检查是否已在黑名单中
        const { data: existing, error: checkError } = await supabaseClient
            .from('blacklist')
            .select('id')
            .eq('customer_id', customer.id)  // 使用 UUID
            .maybeSingle();
        
        if (existing) {
            throw new Error(lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中');
        }
        
        // 添加到黑名单
        const { data, error } = await supabaseClient
            .from('blacklist')
            .insert({
                customer_id: customer.id,  // 使用 UUID
                reason: reason.trim(),
                blacklisted_by: profile.id,
                store_id: customer.store_id
            })
            .select('*, customers(*), blacklisted_by_profile:user_profiles!blacklist_blacklisted_by_fkey(name)')
            .single();
        
        if (error) {
            console.error("添加黑名单失败:", error);
            throw error;
        }
        
        return data;
    },
    
    removeFromBlacklist: async function(customerId) {
        var lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(lang === 'id' ? 'Hanya administrator yang dapat menghapus blacklist' : '只有管理员可以解除黑名单');
        }
        
        // 删除黑名单记录（customer_id 可能是 UUID 或 customer_id 字符串）
        let deleteError = null;
        
        // 先尝试直接删除
        const { error: directError } = await supabaseClient
            .from('blacklist')
            .delete()
            .eq('customer_id', customerId);
        
        if (directError && directError.code === '22P02') {
            // 如果是无效UUID格式，尝试通过 customers 表查找真实 UUID
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
    
    // 修复：checkDuplicateCustomer 返回格式优化
    checkDuplicateCustomer: async function(name, ktpNumber, phone, excludeCustomerId = null) {
        // 安全过滤输入
        const safeName = sanitizeInput(name);
        const safeKtp = sanitizeInput(ktpNumber);
        const safePhone = sanitizeInput(phone);
        
        // 使用 Supabase 链式查询
        let query = supabaseClient
            .from('customers')
            .select('id, customer_id, name, ktp_number, phone');
        
        // 构建 OR 条件
        const conditions = [];
        if (safeName) conditions.push(`name.eq.${safeName}`);
        if (safeKtp) conditions.push(`ktp_number.eq.${safeKtp}`);
        if (safePhone) conditions.push(`phone.eq.${safePhone}`);
        
        if (conditions.length === 0) {
            return null;
        }
        
        // 使用 .or() 方法
        query = query.or(conditions.join(','));
        
        if (excludeCustomerId) {
            query = query.neq('id', excludeCustomerId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) return null;
        
        // 检测重复字段 - 准确找出哪个字段重复
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
        
        // 去重 duplicateFields
        const uniqueFields = [...new Set(duplicateFields)];
        
        // 返回最匹配的客户（优先返回所有字段都匹配的）
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
    
    // 显示黑名单列表页面
    showBlacklist: async function() {
        const lang = Utils.lang;
        const t = Utils.t;
        const profile = await SUPABASE.getCurrentProfile();
        const isAdmin = profile?.role === 'admin';
        
        try {
            const blacklist = await this.getBlacklist();
            
            var rows = '';
            if (!blacklist || blacklist.length === 0) {
                rows = '<tr><td colspan="' + (isAdmin ? 6 : 5) + '" class="text-center">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var item of blacklist) {
                    var customer = item.customers;
                    if (!customer) continue;
                    
                    var actionHtml = '';
                    if (isAdmin) {
                        actionHtml = `<button onclick="APP.removeFromBlacklist('${customer.id}')" class="btn-small danger">🚫 ${lang === 'id' ? 'Hapus' : '解除'}</button>`;
                    } else {
                        actionHtml = `<span class="locked-badge">🔒 ${lang === 'id' ? 'Terkunci' : '已锁定'}</span>`;
                    }
                    
                    rows += `<tr>
                        <td data-label="${lang === 'id' ? 'ID Nasabah' : '客户ID'}">${Utils.escapeHtml(customer.customer_id || '-')}</td>
                        <td data-label="${t('customer_name')}">${Utils.escapeHtml(customer.name)}</td>
                        <td data-label="${t('phone')}">${Utils.escapeHtml(customer.phone || '-')}</td>
                        <td data-label="${lang === 'id' ? 'Alasan' : '原因'}">${Utils.escapeHtml(item.reason)}</td>
                        <td data-label="${lang === 'id' ? 'Tanggal Blacklist' : '拉黑日期'}">${Utils.formatDate(item.blacklisted_at)}</td>
                    </tr>
                    <tr class="action-row"><td colspan="${isAdmin ? 6 : 5}">${actionHtml}</td></tr>`;
                }
            }
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>🚫 ${lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${t('print')}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <div class="info-card" style="margin-bottom:16px;">
                        <div class="info-card-content">
                            <div class="info-icon">⚠️</div>
                            <div class="info-text">
                                <strong>${lang === 'id' ? 'Informasi:' : '提示：'}</strong> 
                                ${lang === 'id' 
                                    ? 'Nasabah yang di-blacklist tidak dapat membuat pesanan baru. Hanya administrator yang dapat menghapus dari daftar hitam.'
                                    : '被拉黑的客户无法创建新订单。只有管理员可以解除黑名单。'}
                            </div>
                        </div>
                    </div>
                    
                    <h3>📋 ${lang === 'id' ? 'Daftar Nasabah Blacklist' : '黑名单客户列表'}</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'ID Nasabah' : '客户ID'}</th>
                                    <th>${t('customer_name')}</th>
                                    <th>${t('phone')}</th>
                                    <th>${lang === 'id' ? 'Alasan' : '原因'}</th>
                                    <th>${lang === 'id' ? 'Tanggal Blacklist' : '拉黑日期'}</th>
                                    ${isAdmin ? '<th>' + (lang === 'id' ? 'Aksi' : '操作') + '</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                <style>
                    .info-card {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                    }
                    .info-card .info-text {
                        color: #92400e;
                    }
                    .info-card .info-text strong {
                        color: #b45309;
                    }
                    .locked-badge {
                        display: inline-block;
                        padding: 4px 12px;
                        background: #e2e8f0;
                        color: #64748b;
                        border-radius: 20px;
                        font-size: 0.7rem;
                    }
                </style>`;
                
            this._addBlacklistTableStyles();
            
        } catch (error) {
            console.error("showBlacklist error:", error);
            alert(lang === 'id' ? 'Gagal memuat data blacklist: ' + error.message : '加载黑名单失败：' + error.message);
        }
    },
    
    _addBlacklistTableStyles: function() {
        // 已废弃：action-cell 移至 tables.css 的 action-row 统一处理
    }
};

Object.assign(window.APP, BlacklistModule);
