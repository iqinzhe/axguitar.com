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

    // ✅ 修复：login 是 AUTH 对象的方法（原文件 login 是孤立函数，不属于任何对象）
    async login(email, password) {
        try {
            const result = await SUPABASE.login(email, password);
            if (!result || result.error) {
                return null;
            }
            await this.loadCurrentUser();
            if (!this.user) {
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
