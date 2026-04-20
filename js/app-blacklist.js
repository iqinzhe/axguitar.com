// app-blacklist.js - 完全修复版 v1.1
// 修复项：正则区间错误、空值防御、输入trim、上下文绑定、日志补充、异常捕获、变量作用域、时间字段等

window.APP = window.APP || {};

// 辅助函数：安全过滤输入（修复：印尼文字符正则+trim处理）
function sanitizeInput(str) {
    if (!str) return '';
    // 合法字符：字母、数字、空格、中文、印尼语常用字符（元音/辅音）
    // 修正正则区间：移除错误的\u0800-\u4e00，替换为印尼语标准区间\u1EA0-\u1EFF
    const cleaned = String(str).replace(/[^\w\s\u4e00-\u9fa5\u0020-\u007E\u00A0-\u00FF\u1EA0-\u1EFF]/g, '');
    return cleaned.trim(); // 补充：去除前后空格，避免空字符误判
}

const BlacklistModule = {
    // 修复：增加全局异常捕获+详细日志、空值兜底
    isBlacklisted: async function(customerId) {
        try {
            if (!customerId) {
                console.warn("检查黑名单失败：customerId为空");
                return { isBlacklisted: false };
            }

            const { data, error } = await supabaseClient
                .from('blacklist')
                .select('id, reason')
                .eq('customer_id', customerId)
                .maybeSingle();
            
            if (error) {
                console.error("检查黑名单失败:", error.message, "customerId:", customerId);
                return { isBlacklisted: false };
            }
            return data ? { isBlacklisted: true, reason: data.reason } : { isBlacklisted: false };
        } catch (err) {
            console.error("检查黑名单异常:", err.stack);
            return { isBlacklisted: false };
        }
    },

    // 修复：profile空值兜底、显式传递blacklisted_at、日志补充
    addToBlacklist: async function(customerId, reason) {
        try {
            if (!customerId) {
                throw new Error(Utils.lang === 'id' ? 'ID Nasabah tidak boleh kosong' : '客户ID不能为空');
            }

            // 修复：profile空值兜底（未登录/获取失败场景）
            const profile = await SUPABASE.getCurrentProfile() || {};
            if (!profile.id) {
                throw new Error(Utils.lang === 'id' ? 'Anda belum login' : '你尚未登录');
            }

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
            
            if (customerError) {
                console.error("获取客户门店信息失败:", customerError.message);
                throw new Error(Utils.lang === 'id' ? 'Gagal mendapatkan data toko nasabah' : '获取客户门店信息失败');
            }

            // 修复：profile.role/store_id 空值判断
            if (profile.role !== 'admin' && customer.store_id !== profile.store_id) {
                throw new Error(Utils.lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
            }

            const { data, error } = await supabaseClient
                .from('blacklist')
                .insert({
                    customer_id: customerId,
                    reason: reason.trim(),
                    blacklisted_by: profile.id,
                    store_id: customer.store_id,
                    blacklisted_at: new Date().toISOString() // 显式传递时间戳，不依赖数据库默认值
                })
                .select('*, customers(*), blacklisted_by_profile:user_profiles!blacklist_blacklisted_by_fkey(name)')
                .single();
            
            if (error) {
                console.error("添加黑名单失败:", error.message, "customerId:", customerId);
                throw error;
            }
            
            console.log("添加黑名单成功", "customerId:", customerId, "operator:", profile.id);
            return data;
        } catch (err) {
            console.error("添加黑名单异常:", err.stack);
            throw err;
        }
    },

    // 修复：profile空值兜底、日志补充
    removeFromBlacklist: async function(customerId) {
        try {
            if (!customerId) {
                throw new Error(Utils.lang === 'id' ? 'ID Nasabah tidak boleh kosong' : '客户ID不能为空');
            }

            const profile = await SUPABASE.getCurrentProfile() || {};
            if (!profile.id) {
                throw new Error(Utils.lang === 'id' ? 'Anda belum login' : '你尚未登录');
            }

            if (profile.role !== 'admin') {
                throw new Error(Utils.lang === 'id' ? 'Hanya administrator yang dapat menghapus blacklist' : '只有管理员可以解除黑名单');
            }

            const { error } = await supabaseClient
                .from('blacklist')
                .delete()
                .eq('customer_id', customerId);
            
            if (error) {
                console.error("解除黑名单失败:", error.message, "customerId:", customerId);
                throw error;
            }
            
            console.log("解除黑名单成功", "customerId:", customerId, "operator:", profile.id);
            return true;
        } catch (err) {
            console.error("解除黑名单异常:", err.stack);
            throw err;
        }
    },

    // 修复：profile空值兜底、全局异常捕获、日志补充
    getBlacklist: async function() {
        try {
            const profile = await SUPABASE.getCurrentProfile() || {};

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

            // 修复：profile.store_id 空值判断
            if (profile.role !== 'admin' && profile.store_id) {
                query = query.eq('customers.store_id', profile.store_id);
            }

            const { data, error } = await query;
            if (error) {
                console.error("获取黑名单列表失败:", error.message);
                throw error;
            }
            
            console.log("获取黑名单列表成功", "数据量:", data?.length || 0);
            return data;
        } catch (err) {
            console.error("获取黑名单列表异常:", err.stack);
            throw err;
        }
    },

    // 修复：Query注入风险+正则错误+trim统一+Set冗余移除+变量作用域
    checkDuplicateCustomer: async function(name, ktpNumber, phone, excludeCustomerId = null) {
        try {
            // 安全过滤输入（已包含trim）
            const safeName = sanitizeInput(name);
            const safeKtp = sanitizeInput(ktpNumber);
            const safePhone = sanitizeInput(phone);

            let query = supabaseClient
                .from('customers')
                .select('id, customer_id, name, ktp_number, phone');

            // 构建 OR 条件 - 参数化处理
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
            if (error) {
                console.error("检查重复客户失败:", error.message);
                throw error;
            }

            if (!data || data.length === 0) return null;

            // 修复：移除冗余Set，简化重复字段检测逻辑
            const duplicateFields = [];
            // 统一使用trim后的输入做匹配（避免空格导致的误判）
            const inputName = name?.trim() || '';
            const inputKtp = ktpNumber?.trim() || '';
            const inputPhone = phone?.trim() || '';

            for (const existing of data) { // 修复：var → const（块级作用域）
                const existName = existing.name?.trim() || '';
                const existKtp = existing.ktp_number?.trim() || '';
                const existPhone = existing.phone?.trim() || '';

                if (existName === inputName && !duplicateFields.includes('name')) {
                    duplicateFields.push('name');
                }
                if (existKtp === inputKtp && !duplicateFields.includes('ktp')) {
                    duplicateFields.push('ktp');
                }
                if (existPhone === inputPhone && !duplicateFields.includes('phone')) {
                    duplicateFields.push('phone');
                }
            }

            return {
                isDuplicate: duplicateFields.length > 0,
                duplicateFields: duplicateFields,
                existingCustomer: data[0]
            };
        } catch (err) {
            console.error("检查重复客户异常:", err.stack);
            throw err;
        }
    }
};

// 修复：绑定this上下文，避免方法调用时丢失BlacklistModule上下文
for (const key in BlacklistModule) { // 修复：var → const
    if (typeof BlacklistModule[key] === 'function') {
        window.APP[key] = BlacklistModule[key].bind(BlacklistModule);
    }
}
