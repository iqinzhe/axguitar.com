async getCurrentProfile() {
    if (_profileCache) return _profileCache;
    try {
        const user = await this.getCurrentUser();
        if (!user) {
            console.log('[Supabase] 未获取到当前用户');
            return null;
        }
        
        // 使用正确的字段名（id 对应 user_profiles 的主键）
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)  // user.id 对应 user_profiles.id
            .maybeSingle();  // 使用 maybeSingle 避免 406 错误
        
        if (error) {
            // 如果是 406 (Not Acceptable)，说明没有匹配的记录
            if (error.code === 'PGRST116') {
                console.warn('[Supabase] 用户资料不存在:', user.id);
                return null;
            }
            console.error("[Supabase] getCurrentProfile error:", error.message);
            return null;
        }
        
        if (data?.store_id) {
            const { data: storeData, error: storeError } = await supabaseClient
                .from('stores')
                .select('*')
                .eq('id', data.store_id)
                .maybeSingle();
            if (!storeError && storeData) {
                data.stores = storeData;
            }
        }
        
        _profileCache = data;
        return data;
    } catch (err) {
        console.warn("[Supabase] getCurrentProfile exception:", err.message);
        return null;
    }
},
