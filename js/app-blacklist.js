// app-blacklist.js - 黑名单管理模块
// 权限：拉黑（店长/员工），解除（仅管理员），查看（管理员看全部，店长看本店）

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
    
    // ==================== 拉黑客户（店长/员工可用） ====================
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
        
        // 获取客户信息，验证门店权限（店长只能拉黑自己门店的客户）
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('store_id')
            .eq('id', customerId)
            .single();
        
        if (customerError) throw customerError;
        
        // 如果不是管理员，检查是否是自己门店的客户
        if (profile?.role !== 'admin' && customer.store_id !== profile?.store_id) {
            throw new Error(Utils.lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
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
    
    // ==================== 解除黑名单（仅管理员） ====================
    removeFromBlacklist: async function(customerId) {
        const profile = await SUPABASE.getCurrentProfile();
        
        // 只有管理员可以解除黑名单
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
    
    // ==================== 获取黑名单列表（权限控制） ====================
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
        
        // 店长只能看到自己门店的黑名单客户
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('customers.store_id', profile.store_id);
        }
        
        const { data, error } = await query;
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
    }
};

// 合并到 window.APP
for (var key in BlacklistModule) {
    if (typeof BlacklistModule[key] === 'function') {
        window.APP[key] = BlacklistModule[key];
    }
}
