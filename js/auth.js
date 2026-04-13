const AUTH = {
    user: null,

    async init() {
        try {
            await this.loadCurrentUser();
        } catch (e) {
            this.user = null;
        }
    },

    isLoggedIn() {
        return !!this.user;
    },

    isAdmin() {
        return this.user?.role === 'admin';
    },

    getCurrentStoreName() {
        return this.user?.stores?.name || this.user?.store_name || '未知门店';
    },

    async login(email, password) {
        try {
            const result = await SUPABASE.login(email, password);
            if (!result || result.error) {
                console.error("Login error:", result?.error);
                return null;
            }
            await this.loadCurrentUser();
            if (!this.user) {
                console.error("Failed to load user profile after login");
                return null;
            }
            return this.user;
        } catch (error) {
            console.error("LOGIN ERROR:", error);
            return null;
        }
    },

    async loadCurrentUser() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile) {
            this.user = profile;
        } else {
            this.user = null;
        }
    },

    async logout() {
        this.user = null;
        SUPABASE.clearCache();
        await SUPABASE.logout();
    },

    async getAllUsers() {
        return await SUPABASE.getAllUsers();
    },

    // ⚠️ 注意：此方法需要 Service Role Key 才能正常工作
    // 当前使用 anon key 会失败，建议改用 Edge Function 或添加 SERVICE_ROLE_KEY
    async addUser(username, password, name, role, storeId) {
        // 通过 Supabase Auth 创建用户，再写入 user_profiles
        const { data, error } = await supabaseClient.auth.admin.createUser({
            email: username,
            password: password,
            email_confirm: true
        });
        if (error) throw error;
        const { error: profileError } = await supabaseClient.from('user_profiles').insert({
            id: data.user.id,
            username: username,
            name: name,
            role: role,
            store_id: storeId || null
        });
        if (profileError) throw profileError;
        return data.user;
    },

    async deleteUser(userId) {
        const { error } = await supabaseClient.from('user_profiles').delete().eq('id', userId);
        if (error) throw error;
        return true;
    },

    async updateUser(userId, updates) {
        const { error } = await supabaseClient.from('user_profiles').update(updates).eq('id', userId);
        if (error) throw error;
        return true;
    }
};

window.AUTH = AUTH;
