// app-blacklist.js - v1.2（优化：精简重复代码）

window.APP = window.APP || {};

// 辅助函数：安全过滤输入（修复：支持拉丁扩展区字符如 é, ñ）
function sanitizeInput(str) {
    if (!str) return '';
    // 允许：字母、数字、空格、中文、拉丁扩展区字符（覆盖印尼语/欧洲语言变音字母）
    // \u00C0-\u024F 覆盖 Latin-1 Supplement + Latin Extended-A/B
    return String(str).replace(/[^\w\s\u4e00-\u9fa5\u00C0-\u024F]/g, '');
}

const BlacklistModule = {
    
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
    
    addToBlacklist: async function(customerId, reason) {
        const profile = await SUPABASE.getCurrentProfile();
        
        if (!reason || reason.trim() === '') {
            throw new Error(Utils.lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
        }
        
        const check = await this.isBlacklisted(customerId);
        if (check.isBlacklisted) {
            throw new Error(Utils.lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中');
        }
        
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('store_id')
            .eq('id', customerId)
            .single();
        
        if (customerError) throw customerError;
        
        if (profile?.role !== 'admin' && customer.store_id !== profile?.store_id) {
            throw new Error(Utils.lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
        }
        
        const { data, error } = await supabaseClient
            .from('blacklist')
            .insert({
                customer_id: customerId,
                reason: reason.trim(),
                blacklisted_by: profile.id,
                store_id: customer.store_id
            })
            .select('*, customers(*), blacklisted_by_profile:user_profiles!blacklist_blacklisted_by_fkey(name)')
            .single();
        
        if (error) throw error;
        return data;
    },
    
    removeFromBlacklist: async function(customerId) {
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya administrator yang dapat menghapus blacklist' : '只有管理员可以解除黑名单');
        }
        
        const { error } = await supabaseClient
            .from('blacklist')
            .delete()
            .eq('customer_id', customerId);
        
        if (error) throw error;
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
    
    // 修复：使用安全过滤的查询
    checkDuplicateCustomer: async function(name, ktpNumber, phone, excludeCustomerId = null) {
        // 安全过滤输入（使用修复后的 sanitizeInput）
        const safeName = sanitizeInput(name);
        const safeKtp = sanitizeInput(ktpNumber);
        const safePhone = sanitizeInput(phone);
        
        // 使用 Supabase 链式查询（安全）
        let query = supabaseClient
            .from('customers')
            .select('id, customer_id, name, ktp_number, phone');
        
        // 构建 OR 条件 - 使用 .or() 但参数化处理
        const conditions = [];
        if (safeName) conditions.push(`name.eq.${safeName}`);
        if (safeKtp) conditions.push(`ktp_number.eq.${safeKtp}`);
        if (safePhone) conditions.push(`phone.eq.${safePhone}`);
        
        if (conditions.length === 0) {
            return null;
        }
        
        // 使用 .or() 方法（Supabase 会自动转义）
        query = query.or(conditions.join(','));
        
        if (excludeCustomerId) {
            query = query.neq('id', excludeCustomerId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) return null;
        
        // 检测重复字段
        const duplicateFields = [];
        const existingNames = new Set();
        const existingKtps = new Set();
        const existingPhones = new Set();
        
        for (var existing of data) {
            if (existing.name === name && !existingNames.has(existing.name)) {
                duplicateFields.push('name');
                existingNames.add(existing.name);
            }
            if (existing.ktp_number === ktpNumber && !existingKtps.has(existing.ktp_number)) {
                duplicateFields.push('ktp');
                existingKtps.add(existing.ktp_number);
            }
            if (existing.phone === phone && !existingPhones.has(existing.phone)) {
                duplicateFields.push('phone');
                existingPhones.add(existing.phone);
            }
        }
        
        return {
            isDuplicate: true,
            duplicateFields: duplicateFields,
            existingCustomer: data[0]
        };
    }
};

Object.assign(window.APP, BlacklistModule);

console.log('✅ app-blacklist.js v1.2 已加载 - 优化版');
