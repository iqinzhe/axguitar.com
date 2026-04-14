const AUTH = {
    user: null,

    async init() {
        try {
            await this.loadCurrentUser();
        } catch (e) {
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
        try {
            const { data, error } = await supabaseClient.functions.invoke('create-user', {
                body: { email: username, password, name, role, store_id: storeId || null }
            });
            if (error) throw error;
            return data;
        } catch (fnError) {
            console.warn("Edge Function 不可用，尝试直接调用 admin API:", fnError.message);
            
            if (!SUPABASE_KEY.includes('service_role')) {
                throw new Error(Utils.lang === 'id' 
                    ? 'Tidak dapat membuat pengguna. Silakan deploy Edge Function terlebih dahulu.'
                    : '无法创建用户，请先部署 Edge Function。');
            }
            
            const { data, error } = await supabaseClient.auth.admin.createUser({
                email: username,
                password: password,
                email_confirm: true,
                user_metadata: { name: name, role: role, store_id: storeId }
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
        }
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
