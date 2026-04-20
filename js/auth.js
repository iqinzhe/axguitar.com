// auth.js - 完整修复版 v3.1

const AUTH = {
    user: null,
    
    // ==================== 登录锁定机制（sessionStorage 持久化） ====================
    
    _getLoginAttempts() {
        const stored = sessionStorage.getItem('jf_login_attempts');
        return stored ? JSON.parse(stored) : {};
    },
    
    _setLoginAttempts(attempts) {
        sessionStorage.setItem('jf_login_attempts', JSON.stringify(attempts));
    },
    
    _getLockedUntil() {
        const stored = sessionStorage.getItem('jf_locked_until');
        return stored ? JSON.parse(stored) : {};
    },
    
    _setLockedUntil(locked) {
        sessionStorage.setItem('jf_locked_until', JSON.stringify(locked));
    },
    
    _isLocked(username) {
        const lockedUntil = this._getLockedUntil();
        const until = lockedUntil[username];
        const now = Date.now();
        if (until && until > now) {
            const remainingMinutes = Math.ceil((until - now) / 60000);
            alert(Utils.lang === 'id' 
                ? `⚠️ 账号已锁定，请 ${remainingMinutes} 分钟后重试`
                : `⚠️ 账号已锁定，请 ${remainingMinutes} 分钟后重试`);
            return true;
        }
        if (until && until <= now) {
            const attempts = this._getLoginAttempts();
            delete lockedUntil[username];
            delete attempts[username];
            this._setLockedUntil(lockedUntil);
            this._setLoginAttempts(attempts);
        }
        return false;
    },
    
    _recordLoginFailure(username) {
        const attempts = this._getLoginAttempts();
        const lockedUntil = this._getLockedUntil();
        const now = Date.now();
        
        if (!attempts[username]) {
            attempts[username] = { count: 0, firstAttempt: now };
        }
        attempts[username].count++;
        
        const elapsed = now - attempts[username].firstAttempt;
        // 5分钟内失败5次，锁定15分钟
        if (elapsed <= 5 * 60 * 1000 && attempts[username].count >= 5) {
            lockedUntil[username] = now + 15 * 60 * 1000;
            delete attempts[username];
            this._setLockedUntil(lockedUntil);
            this._setLoginAttempts(attempts);
            return true; // 已锁定
        }
        
        // 超过5分钟重置计数
        if (elapsed > 5 * 60 * 1000) {
            attempts[username] = { count: 1, firstAttempt: now };
        }
        
        this._setLoginAttempts(attempts);
        return false; // 未锁定
    },
    
    _resetLoginFailure(username) {
        const attempts = this._getLoginAttempts();
        const lockedUntil = this._getLockedUntil();
        delete attempts[username];
        delete lockedUntil[username];
        this._setLoginAttempts(attempts);
        this._setLockedUntil(lockedUntil);
    },
    
    _clearAllLoginFailures() {
        sessionStorage.removeItem('jf_login_attempts');
        sessionStorage.removeItem('jf_locked_until');
    },

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
                this.loadCurrentUser();
            }
        });
        
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

    isLoggedIn() {
        return !!this.user;
    },

    // ==================== 同步权限判断 ====================
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
    
    // ==================== 异步权限判断 ====================
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
            
            await this._logLoginSuccess(this.user.id);
            
            return this.user;
        } catch (error) {
            console.error("LOGIN ERROR:", error);
            this._recordLoginFailure(usernameOrEmail);
            return null;
        }
    },
    
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
        if (this.user && window.Audit) {
            await window.Audit.log('logout', JSON.stringify({
                user_id: this.user.id,
                user_name: this.user.name,
                timestamp: new Date().toISOString()
            }));
        }
        
        // 清理锁定记录
        this._clearAllLoginFailures();
        
        this.user = null;
        SUPABASE.clearCache();
        await SUPABASE.logout();
    },

    async getAllUsers() {
        return await SUPABASE.getAllUsers();
    },

    // ==================== 用户管理 ====================
    async addUser(username, password, name, role, storeId) {
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
        
        const { error: profileError } = await supabaseClient.from('user_profiles').insert({
            id: authUser.user.id,
            username: username,
            email: username,
            name: name,
            role: role,
            store_id: storeId || null
        });
        
        if (profileError) throw profileError;
        
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
        if (userId === this.user?.id) {
            throw new Error(Utils.lang === 'id' 
                ? 'Tidak dapat menghapus akun sendiri' 
                : '不能删除自己的账号');
        }
        
        const { data: userProfile, error: fetchError } = await supabaseClient
            .from('user_profiles')
            .select('id, username, name, role')
            .eq('id', userId)
            .single();
        
        if (fetchError) throw fetchError;
        
        const deletedUserInfo = {
            id: userProfile.id,
            username: userProfile.username,
            name: userProfile.name,
            role: userProfile.role,
            deleted_by: this.user?.id,
            deleted_by_name: this.user?.name,
            deleted_at: new Date().toISOString()
        };
        
        try {
            const { error: edgeError } = await supabaseClient.functions.invoke('delete-user', {
                body: { userId: userProfile.id }
            });
            
            if (edgeError) {
                console.warn("Edge Function 调用失败:", edgeError);
                alert(Utils.lang === 'id'
                    ? '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。'
                    : '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。');
            }
        } catch (e) {
            console.warn("Edge Function 未部署:", e);
            alert(Utils.lang === 'id'
                ? '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。'
                : '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。');
        }
        
        const { error } = await supabaseClient.from('user_profiles').delete().eq('id', userId);
        if (error) throw error;
        
        if (window.Audit) {
            await window.Audit.log('user_delete', JSON.stringify(deletedUserInfo));
        }
        
        return true;
    },

    async updateUser(userId, updates) {
        const { data: beforeData } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        const { error } = await supabaseClient.from('user_profiles').update(updates).eq('id', userId);
        if (error) throw error;
        
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

console.log('✅ auth.js v3.1 已加载 - 登录锁定使用 sessionStorage 持久化');
