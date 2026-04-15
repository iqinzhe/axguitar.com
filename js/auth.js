const AUTH = {
    user: null,

    async init() {
        try {
            await this.loadCurrentUser();
        } catch (e) {
            console.warn("Auth init error (user not logged in):", e.message);
            this.user = null;
        }
        
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                this.user = null;
                SUPABASE.clearCache();
            } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                SUPABASE.clearCache();
            }
        });
    },

    isLoggedIn() {
        return !!this.user;
    },

    isAdmin() {
        return this.user?.role === 'admin';
    },

    isStoreManager() {
        return this.user?.role === 'store_manager';
    },

    isStaff() {
        return this.user?.role === 'staff';
    },

    canManageOrders() {
        return ['admin', 'store_manager', 'staff'].includes(this.user?.role);
    },

    getCurrentStoreName() {
        if (this.user?.role === 'admin' && !this.user?.stores?.name && !this.user?.store_name) {
            return Utils.lang === 'id' ? 'Kantor Pusat' : '总部';
        }
        return this.user?.stores?.name || this.user?.store_name || (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
    },

    async login(usernameOrEmail, password) {
        try {
            let emailToUse = usernameOrEmail;

            if (!usernameOrEmail.includes('@')) {
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('user_profiles')
                    .select('username')
                    .eq('username', usernameOrEmail)
                    .single();

                if (profileError || !profileData) {
                    console.error("找不到该用户名:", usernameOrEmail);
                    return null;
                }
                emailToUse = profileData.username;
            }

            const result = await SUPABASE.login(emailToUse, password);
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
        try {
            const profile = await SUPABASE.getCurrentProfile();
            if (profile) {
                this.user = profile;
            } else {
                this.user = null;
            }
        } catch (e) {
            // 静默处理，用户未登录时不报错
            console.warn("loadCurrentUser error (user not logged in):", e.message);
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
        // 检查是否已存在
        const { data: existing } = await supabaseClient
            .from('user_profiles')
            .select('username')
            .eq('username', username)
            .single();
        
        if (existing) {
            throw new Error(Utils.lang === 'id' 
                ? 'Username sudah digunakan' 
                : '用户名已存在');
        }
        
        // 使用 Supabase Auth 创建用户
        const { data: authUser, error: signUpError } = await supabaseClient.auth.signUp({
            email: username,
            password: password,
            options: {
                data: {
                    name: name,
                    role: role,
                    store_id: storeId || null
                }
            }
        });
        
        if (signUpError) throw signUpError;
        
        if (!authUser.user) {
            throw new Error(Utils.lang === 'id' 
                ? 'Gagal membuat pengguna' 
                : '创建用户失败');
        }
        
        // 创建用户资料
        const { error: profileError } = await supabaseClient.from('user_profiles').insert({
            id: authUser.user.id,
            username: username,
            name: name,
            role: role,
            store_id: storeId || null
        });
        
        if (profileError) throw profileError;
        
        return authUser.user;
    },

    async deleteUser(userId) {
        // 不能删除自己
        if (userId === this.user?.id) {
            throw new Error(Utils.lang === 'id' 
                ? 'Tidak dapat menghapus akun sendiri' 
                : '不能删除自己的账号');
        }
        
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
