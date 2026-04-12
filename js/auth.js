const AUTH = {
    user: null,
    profile: null,
    
    async init() {
        const session = await SUPABASE.getSession();
        if (session) {
            await this.loadCurrentUser();
        }
        return this.user;
    },
    
    async loadCurrentUser() {
        this.profile = await SUPABASE.getCurrentProfile();
        if (this.profile) {
            this.user = {
                id: this.profile.id,
                username: this.profile.username,
                name: this.profile.name,
                role: this.profile.role,
                store_id: this.profile.store_id,
                store_name: this.profile.stores?.name
            };
        }
        return this.user;
    },
    
    async login(email, password) {
        try {
            const result = await SUPABASE.login(email, password);
            await this.loadCurrentUser();
            return this.user;
        } catch (error) {
            console.error('Login error:', error);
            return null;
        }
    },
    
    async logout() {
        await SUPABASE.logout();
        this.user = null;
        this.profile = null;
    },
    
    isLoggedIn() { return this.user !== null; },
    isAdmin() { return this.user?.role === 'admin'; },
    isStoreManager() { return this.user?.role === 'store_manager'; },
    getCurrentStoreId() { return this.user?.store_id; },
    getCurrentStoreName() { return this.user?.store_name || '未知门店'; },
    
    async getAllUsers() {
        const { data, error } = await SUPABASE.getClient().from('user_profiles').select('*, stores(name)').order('created_at');
        if (error) throw error;
        return data;
    }
};

window.AUTH = AUTH;
