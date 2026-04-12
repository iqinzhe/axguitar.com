// ============================================
// 认证模块 - Supabase Auth 版
// ============================================

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
    
    // 登录 - 直接使用真实邮箱
    async login(username, password) {
        try {
            // 直接使用你的真实邮箱，忽略用户输入的用户名
            const realEmail = 'iqinzhe@gmail.com';
            
            const result = await SUPABASE.login(realEmail, password);
            await this.loadCurrentUser();
            return this.user;
        } catch (error) {
            console.error('Login error:', error);
            alert('登录失败: ' + error.message);
            return null;
        }
    },
    
    async logout() {
        await SUPABASE.logout();
        this.user = null;
        this.profile = null;
    },
    
    isLoggedIn() {
        return this.user !== null;
    },
    
    isAdmin() {
        return this.user?.role === 'admin';
    },
    
    isStoreManager() {
        return this.user?.role === 'store_manager';
    },
    
    getCurrentStoreId() {
        return this.user?.store_id;
    },
    
    getCurrentStoreName() {
        return this.user?.store_name || '未知门店';
    },
    
    async addUser(username, password, name, role, storeId) {
        const email = `${username}@jfgadai.local`;
        return await SUPABASE.createUser(email, password, username, name, role, storeId);
    },
    
    async getAllUsers() {
        return await SUPABASE.getAllUsers();
    },
    
    async deleteUser(userId) {
        return await SUPABASE.deleteUser(userId);
    },
    
    async updateUser(userId, updates) {
        return await SUPABASE.updateUser(userId, updates);
    }
};

window.AUTH = AUTH;
