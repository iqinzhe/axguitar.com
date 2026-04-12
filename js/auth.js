// ============================================
// 认证模块 - Supabase Auth 版
// ============================================

const AUTH = {
    user: null,
    profile: null,
    
    // 初始化（在 APP.init 中调用）
    async init() {
        // 检查是否有已登录会话
        const session = await SUPABASE.getSession();
        if (session) {
            await this.loadCurrentUser();
        }
        return this.user;
    },
    
    // 加载当前用户信息
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
    
// 登录
async login(username, password) {
    try {
        // 如果输入的是 'admin'，自动映射到真实邮箱
        let loginEmail = username;
        if (username === 'admin') {
            loginEmail = 'iqinzhe@gmail.com';
        } else if (!loginEmail.includes('@')) {
            loginEmail = `${username}@jfgadai.local`;
        }
        
        // 直接使用 supabaseClient 测试
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: loginEmail,
            password: password
        });
        
        if (error) {
            console.error('Login error:', error);
            alert('登录失败: ' + error.message);
            return null;
        }
        
        // 手动设置用户信息
        this.user = {
            id: data.user.id,
            username: 'admin',
            name: 'Administrator',
            role: 'admin',
            store_id: null,
            store_name: '总部'
        };
        
        // 保存到 sessionStorage
        sessionStorage.setItem('jf_current_user', JSON.stringify(this.user));
        
        return this.user;
        
    } catch (error) {
        console.error('Login error:', error);
        alert('登录失败: ' + error.message);
        return null;
    }
},
    
    // 登出
    async logout() {
        await SUPABASE.logout();
        this.user = null;
        this.profile = null;
    },
    
    // 检查是否已登录
    isLoggedIn() {
        return this.user !== null;
    },
    
    // 检查是否为管理员
    isAdmin() {
        return this.user?.role === 'admin';
    },
    
    // 检查是否为店长
    isStoreManager() {
        return this.user?.role === 'store_manager';
    },
    
    // 获取当前门店ID
    getCurrentStoreId() {
        return this.user?.store_id;
    },
    
    // 获取当前门店名称
    getCurrentStoreName() {
        return this.user?.store_name || '未知门店';
    },
    
    // 添加新用户（仅管理员）
    async addUser(username, password, name, role, storeId) {
        const email = `${username}@jfgadai.local`;
        return await SUPABASE.createUser(email, password, username, name, role, storeId);
    },
    
    // 获取所有用户（仅管理员）
    async getAllUsers() {
        return await SUPABASE.getAllUsers();
    },
    
    // 删除用户（仅管理员）
    async deleteUser(userId) {
        return await SUPABASE.deleteUser(userId);
    },
    
    // 更新用户（仅管理员）
    async updateUser(userId, updates) {
        return await SUPABASE.updateUser(userId, updates);
    }
};

window.AUTH = AUTH;
