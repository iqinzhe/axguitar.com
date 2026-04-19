// auth.js - v1.0


const AUTH = {
    user: null,
    
    // 登录失败记录（前端临时方案）
    _loginAttempts: {},
    _lockedUntil: {},

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
                // 刷新后重新加载用户信息
                this.loadCurrentUser();
            }
        });
        
        // 绑定 ENTER 键登录
        this._bindEnterKeyLogin();
    },
    
    _bindEnterKeyLogin() {
        document.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                const appDiv = document.getElementById('app');
                if (appDiv && appDiv.querySelector('.login-box')) {
                    if (typeof window.APP.login === 'function') {
                        await window.APP.login();
                    }
                }
            }
        });
    },
    
    // 检查账号是否被锁定
    _isLocked(username) {
        const now = Date.now();
        const lockedUntil = this._lockedUntil[username];
        if (lockedUntil && lockedUntil > now) {
            const remainingMinutes = Math.ceil((lockedUntil - now) / 60000);
            alert(Utils.lang === 'id' 
                ? `⚠️ 账号已锁定，请 ${remainingMinutes} 分钟后重试`
                : `⚠️ 账号已锁定，请 ${remainingMinutes} 分钟后重试`);
            return true;
        }
        if (lockedUntil && lockedUntil <= now) {
            delete this._lockedUntil[username];
            delete this._loginAttempts[username];
        }
        return false;
    },
    
    // 记录登录失败
    _recordLoginFailure(username) {
        const now = Date.now();
        if (!this._loginAttempts[username]) {
            this._loginAttempts[username] = { count: 0, firstAttempt: now };
        }
        this._loginAttempts[username].count++;
        
        // 5分钟内失败5次，锁定15分钟
        const elapsed = now - this._loginAttempts[username].firstAttempt;
        if (elapsed <= 5 * 60 * 1000 && this._loginAttempts[username].count >= 5) {
            this._lockedUntil[username] = now + 15 * 60 * 1000;
            delete this._loginAttempts[username];
            return true; // 已锁定
        }
        
        // 超过5分钟重置计数
        if (elapsed > 5 * 60 * 1000) {
            this._loginAttempts[username] = { count: 1, firstAttempt: now };
        }
        return false; // 未锁定
    },
    
    // 重置登录失败记录
    _resetLoginFailure(username) {
        delete this._loginAttempts[username];
        delete this._lockedUntil[username];
    },

    isLoggedIn() {
        return !!this.user;
    },

    // ==================== 同步权限判断（使用缓存，快速响应） ====================
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
    
    // ==================== 异步权限判断（从数据库获取最新数据，用于敏感操作） ====================
    async isAdminAsync() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role === 'admin';
    },
    
    async isStoreManagerAsync() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role === 'store_manager';
    },
    
    async isStaffAsync() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role === 'staff';
    },
    
    async getFreshRole() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role || null;
    },
    
    async getFreshStoreId() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.store_id || null;
    },

    getCurrentStoreName() {
        if (this.user?.role === 'admin' && !this.user?.stores?.name && !this.user?.store_name) {
            return Utils.lang === 'id' ? 'Kantor Pusat' : '总部';
        }
        return this.user?.stores?.name || this.user?.store_name || (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
    },

    // ==================== 登录逻辑 ====================
    async login(usernameOrEmail, password) {
        try {
            // 检查是否被锁定
            if (this._isLocked(usernameOrEmail)) {
                return null;
            }
            
            let emailToUse = usernameOrEmail;

            // 如果输入不包含 @，则通过 username 或 email 查询实际的 email
            if (!usernameOrEmail.includes('@')) {
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('user_profiles')
                    .select('username, email')
                    .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
                    .maybeSingle();

                if (profileError || !profileData) {
                    console.error("找不到该用户名:", usernameOrEmail);
                    this._recordLoginFailure(usernameOrEmail);
                    return null;
                }
                // 使用 email 字段（如果存在）或 username 字段
                emailToUse = profileData.email || profileData.username;
            }

            const result = await SUPABASE.login(emailToUse, password);
            if (!result || result.error) {
                console.error("Login error:", result?.error);
                this._recordLoginFailure(usernameOrEmail);
                return null;
            }
            
            // 登录成功，重置失败记录
            this._resetLoginFailure(usernameOrEmail);
            
            await this.loadCurrentUser();
            if (!this.user) {
                console.error("Failed to load user profile after login");
                return null;
            }
            
            // 记录登录成功日志
            await this._logLoginSuccess(this.user.id);
            
            return this.user;
        } catch (error) {
            console.error("LOGIN ERROR:", error);
            this._recordLoginFailure(usernameOrEmail);
            return null;
        }
    },
    
    // 记录登录成功日志
    async _logLoginSuccess(userId) {
        try {
            if (window.Audit && typeof window.Audit.log === 'function') {
                await window.Audit.log('login_success', JSON.stringify({
                    user_id: userId,
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (e) {
            console.warn("登录日志记录失败:", e);
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
            console.warn("loadCurrentUser error (user not logged in):", e.message);
            this.user = null;
        }
    },

    async logout() {
        // 记录登出日志
        if (this.user && window.Audit) {
            await window.Audit.log('logout', JSON.stringify({
                user_id: this.user.id,
                user_name: this.user.name,
                timestamp: new Date().toISOString()
            }));
        }
        
        this.user = null;
        SUPABASE.clearCache();
        await SUPABASE.logout();
    },

    async getAllUsers() {
        return await SUPABASE.getAllUsers();
    },

    // ==================== 用户管理 ====================
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
            email: username,
            name: name,
            role: role,
            store_id: storeId || null
        });
        
        if (profileError) throw profileError;
        
        // 记录操作日志
        if (window.Audit) {
            await window.Audit.log('user_create', JSON.stringify({
                new_user_id: authUser.user.id,
                username: username,
                name: name,
                role: role,
                store_id: storeId,
                created_by: this.user?.id
            }));
        }
        
        return authUser.user;
    },

    async deleteUser(userId) {
        // 不能删除自己
        if (userId === this.user?.id) {
            throw new Error(Utils.lang === 'id' 
                ? 'Tidak dapat menghapus akun sendiri' 
                : '不能删除自己的账号');
        }
        
        // 获取用户信息以获取 auth 用户 ID
        const { data: userProfile, error: fetchError } = await supabaseClient
            .from('user_profiles')
            .select('id, username, name, role')
            .eq('id', userId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 记录被删除的用户信息（用于日志）
        const deletedUserInfo = {
            id: userProfile.id,
            username: userProfile.username,
            name: userProfile.name,
            role: userProfile.role,
            deleted_by: this.user?.id,
            deleted_by_name: this.user?.name,
            deleted_at: new Date().toISOString()
        };
        
        // 尝试调用 Edge Function 删除 Auth 用户
        try {
            const { data: edgeData, error: edgeError } = await supabaseClient.functions.invoke('delete-user', {
                body: { userId: userProfile.id }
            });
            
            if (edgeError) {
                console.warn("Edge Function 调用失败，尝试直接删除:", edgeError);
                alert(Utils.lang === 'id'
                    ? '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。'
                    : '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。');
            }
        } catch (e) {
            console.warn("Edge Function 未部署，仅删除 user_profiles:", e);
            alert(Utils.lang === 'id'
                ? '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。'
                : '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。');
        }
        
        // 删除 user_profiles 记录
        const { error } = await supabaseClient.from('user_profiles').delete().eq('id', userId);
        if (error) throw error;
        
        // 记录操作日志
        if (window.Audit) {
            await window.Audit.log('user_delete', JSON.stringify(deletedUserInfo));
        }
        
        return true;
    },

    async updateUser(userId, updates) {
        // 获取更新前的用户信息
        const { data: beforeData } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        const { error } = await supabaseClient.from('user_profiles').update(updates).eq('id', userId);
        if (error) throw error;
        
        // 记录操作日志
        if (window.Audit) {
            await window.Audit.log('user_update', JSON.stringify({
                user_id: userId,
                before: beforeData,
                after: updates,
                updated_by: this.user?.id,
                updated_at: new Date().toISOString()
            }));
        }
        
        return true;
    },
    
    // ==================== 获取当前用户信息 ====================
    
    getCurrentUserId() {
        return this.user?.id || null;
    },
    
    getCurrentUserName() {
        return this.user?.name || null;
    },
    
    getCurrentUserEmail() {
        return this.user?.email || this.user?.username || null;
    }
};

window.AUTH = AUTH;

// 控制台输出确认
console.log('✅ auth.js v3.0 已加载 - 权限检查已统一，锁定功能已移除');
