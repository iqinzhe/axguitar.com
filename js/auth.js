// auth.js - v1.0 (修复：使用 SUPABASE.getClient() 替代直接使用 supabaseClient)

const AUTH = {
    user: null,

    // ==================== 登录锁定机制（使用 localStorage） ====================

    _getLoginAttempts() {
        const stored = localStorage.getItem('jf_login_attempts');
        return stored ? JSON.parse(stored) : {};
    },

    _setLoginAttempts(attempts) {
        localStorage.setItem('jf_login_attempts', JSON.stringify(attempts));
    },

    _getLockedUntil() {
        const stored = localStorage.getItem('jf_locked_until');
        return stored ? JSON.parse(stored) : {};
    },

    _setLockedUntil(locked) {
        localStorage.setItem('jf_locked_until', JSON.stringify(locked));
    },

    _clearAllLoginFailures() {
        localStorage.removeItem('jf_login_attempts');
        localStorage.removeItem('jf_locked_until');
    },

    _isLocked(username) {
        const lockedUntil = this._getLockedUntil();
        const until = lockedUntil[username];
        const now = Date.now();
        
        if (until && until > now) {
            const remainingMinutes = Math.ceil((until - now) / 60000);
            const lang = Utils.lang;
            const msg = lang === 'id' 
                ? '⚠️ Akun telah dikunci. Silakan coba lagi setelah ' + remainingMinutes + ' menit.'
                : '⚠️ 账号已锁定，请 ' + remainingMinutes + ' 分钟后重试。';
            Utils.toast.warning(msg, 5000);
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
        if (elapsed <= 5 * 60 * 1000 && attempts[username].count >= 5) {
            lockedUntil[username] = now + 15 * 60 * 1000;
            delete attempts[username];
            this._setLockedUntil(lockedUntil);
            this._setLoginAttempts(attempts);
            
            const lang = Utils.lang;
            const msg = lang === 'id' 
                ? '⚠️ Terlalu banyak percobaan login. Akun dikunci selama 15 menit.'
                : '⚠️ 登录尝试次数过多，账号已锁定15分钟。';
            Utils.toast.warning(msg, 8000);
            return true;
        }
        
        if (elapsed > 5 * 60 * 1000) {
            attempts[username] = { count: 1, firstAttempt: now };
        }
        this._setLoginAttempts(attempts);
        return false;
    },

    _resetLoginFailure(username) {
        const attempts = this._getLoginAttempts();
        const lockedUntil = this._getLockedUntil();
        delete attempts[username];
        delete lockedUntil[username];
        this._setLoginAttempts(attempts);
        this._setLockedUntil(lockedUntil);
    },

    // 跨标签页同步 - 监听 storage 事件
    _initStorageSync() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'jf_login_attempts' || e.key === 'jf_locked_until') {
                console.log('[Auth] 登录锁定状态已同步');
            }
        });
    },

    // ==================== 记住我功能 ====================
    _rememberMeKey: 'jf_remember_me',

    isRememberMe: function() {
        return localStorage.getItem(this._rememberMeKey) === 'true';
    },

    setRememberMe: function(remember) {
        if (remember) {
            localStorage.setItem(this._rememberMeKey, 'true');
        } else {
            localStorage.removeItem(this._rememberMeKey);
        }
    },

    // ==================== 初始化 ====================
    async init() {
        // 初始化增强版网络监控（如果存在）
        if (Utils.NetworkMonitor && !Utils.NetworkMonitor._initialized) {
            Utils.NetworkMonitor.init();
            console.log('📡 增强版网络监控已由 Auth 模块启动');
        } else if (Utils.NetworkMonitor && Utils.NetworkMonitor._initialized) {
            console.log('📡 网络监控已运行');
        } else {
            // 降级：使用原有简单网络监听
            this._initLegacyNetworkListener();
        }

        // 初始化跨标签页同步
        this._initStorageSync();

        try {
            await this.loadCurrentUser();
        } catch (e) {
            console.warn('Auth init error (user not logged in):', e.message);
            this.user = null;
        }

        // 使用 SUPABASE.getClient() 统一客户端引用
        const client = SUPABASE.getClient();
        client.auth.onAuthStateChange((event) => {
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

    // 降级方案：原有简单网络监听
    _initLegacyNetworkListener() {
        if (this._legacyListenerInitialized) return;
        this._legacyListenerInitialized = true;
        
        var showOfflineBanner = function() {
            var existing = document.getElementById('offlineBanner');
            if (existing) return;
            
            var banner = document.createElement('div');
            banner.id = 'offlineBanner';
            banner.className = 'info-bar danger';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;border-radius:0;margin:0;text-align:center;justify-content:center;';
            banner.innerHTML = '<span class="info-bar-icon">📡</span><div class="info-bar-content"><strong>' + 
                (Utils.lang === 'id' ? 'Koneksi Terputus' : '网络连接已断开') + 
                '</strong> — ' + 
                (Utils.lang === 'id' ? 'Data mungkin tidak tersimpan.' : '数据可能无法保存。') + 
                '</div>';
            document.body.insertBefore(banner, document.body.firstChild);
        };
        
        var hideOfflineBanner = function() {
            var banner = document.getElementById('offlineBanner');
            if (banner) banner.remove();
        };
        
        var showOnlineToast = function() {
            Utils.toast.info(Utils.lang === 'id' ? '✅ Koneksi Pulih' : '✅ 网络已恢复', 2000);
        };
        
        window.addEventListener('offline', showOfflineBanner);
        window.addEventListener('online', function() {
            hideOfflineBanner();
            showOnlineToast();
        });
        
        if (!navigator.onLine) {
            showOfflineBanner();
        }
    },

    _bindEnterKeyLogin() {
        document.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && document.getElementById('app')?.querySelector('.login-box')) {
                if (typeof window.APP?.login === 'function') await window.APP.login();
            }
        });
    },

    isLoggedIn()      { return !!this.user; },
    isAdmin()         { return this.user?.role === 'admin'; },
    isStoreManager()  { return this.user?.role === 'store_manager'; },
    isStaff()         { return this.user?.role === 'staff'; },
    canManageOrders() { return ['admin', 'store_manager', 'staff'].includes(this.user?.role); },

    async isAdminAsync()        { return (await SUPABASE.getCurrentProfile())?.role === 'admin'; },
    async isStoreManagerAsync() { return (await SUPABASE.getCurrentProfile())?.role === 'store_manager'; },
    async isStaffAsync()        { return (await SUPABASE.getCurrentProfile())?.role === 'staff'; },

    async getFreshRole()    { return (await SUPABASE.getCurrentProfile())?.role || null; },
    async getFreshStoreId() { return (await SUPABASE.getCurrentProfile())?.store_id || null; },

    getCurrentStoreName() {
        if (this.user?.role === 'admin' && !this.user?.stores?.name && !this.user?.store_name) {
            return Utils.lang === 'id' ? 'Kantor Pusat' : '总部';
        }
        return this.user?.stores?.name || this.user?.store_name || (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
    },

    // ==================== 登录逻辑 ====================
    async login(usernameOrEmail, password) {
        try {
            // 1. 检查锁定状态
            if (this._isLocked(usernameOrEmail)) return null;

            // 2. 检查网络状态
            const isNetworkAvailable = Utils.NetworkMonitor 
                ? await Utils.NetworkMonitor._checkRealConnectivity()
                : navigator.onLine;
            
            if (!isNetworkAvailable) {
                const lang = Utils.lang;
                Utils.toast.error(lang === 'id' 
                    ? '❌ Tidak ada koneksi internet. Periksa jaringan Anda.'
                    : '❌ 无网络连接，请检查网络设置。', 4000);
                return null;
            }

            // 3. 使用 SUPABASE 统一方法登录
            const result = await SUPABASE.login(usernameOrEmail, password);
            
            if (!result || result.error) {
                console.error('Login error:', result?.error);
                this._recordLoginFailure(usernameOrEmail);
                const lang = Utils.lang;
                Utils.toast.error(lang === 'id' 
                    ? 'Login gagal: ' + (result?.error?.message || 'Username atau password salah') 
                    : '登录失败：' + (result?.error?.message || '用户名或密码错误'), 4000);
                if (window.Audit) {
                    await window.Audit.logLoginFailure(usernameOrEmail, result?.error?.message || 'invalid_credentials');
                }
                return null;
            }

            // 4. 重置失败计数
            this._resetLoginFailure(usernameOrEmail);
            
            // 5. 加载用户资料
            await this.loadCurrentUser();

            if (!this.user) {
                console.error('Failed to load user profile after login');
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat profil pengguna' : '加载用户资料失败', 4000);
                return null;
            }

            // ========== 新增：标记练习身份 ==========
this.user._isPractice = this.user?.stores?.is_practice || false;
            
            // 6. 检查门店状态
            if (this.user && this.user.store_id) {
                try {
                    const storeStatus = await SUPABASE.checkStoreStatus(this.user.store_id);
                    if (!storeStatus.is_active) {
                        await this.logout();
                        var lang = Utils.lang;
                        Utils.toast.warning(lang === 'id' 
                            ? '⚠️ Toko "' + storeStatus.name + '" sedang ditutup sementara.\n\nHubungi administrator untuk informasi lebih lanjut.'
                            : '⚠️ 门店 "' + storeStatus.name + '" 已暂停营业。\n\n请联系管理员获取更多信息。', 6000);
                        return null;
                    }
                } catch (e) {
                    console.warn('检查门店状态失败:', e.message);
                }
            }

            // 7. 审计：登录成功
            if (window.Audit) {
                await window.Audit.logLoginSuccess(this.user.id, this.user.name);
            }
            
            return this.user;
        } catch (error) {
            console.error('LOGIN ERROR:', error);
            this._recordLoginFailure(usernameOrEmail);
            Utils.toast.error(Utils.lang === 'id' ? 'Terjadi kesalahan saat login' : '登录时发生错误', 4000);
            return null;
        }
    },

    async loadCurrentUser() {
        try {
            this.user = (await SUPABASE.getCurrentProfile()) || null;
        } catch (e) {
            console.warn('loadCurrentUser error:', e.message);
            this.user = null;
        }
    },

    async logout() {
        // 审计：退出登录
        if (this.user && window.Audit) {
            await window.Audit.logLogout(this.user.id, this.user.name);
        }
        this._clearAllLoginFailures();
        this.user = null;
        await SUPABASE.logout();
    },

    async getAllUsers() { return await SUPABASE.getAllUsers(); },

    // ==================== 用户管理 ====================
    async addUser(username, password, name, role, storeId) {
        const client = SUPABASE.getClient();
        const { data: existing } = await client
            .from('user_profiles').select('username').eq('username', username).single();

        if (existing) {
            const msg = Utils.lang === 'id' ? 'Username sudah digunakan' : '用户名已存在';
            Utils.toast.error(msg);
            throw new Error(msg);
        }

        const { data: authUser, error: signUpError } = await client.auth.signUp({
            email: username,
            password,
            options: { data: { name, role, store_id: storeId || null } }
        });

        if (signUpError) throw signUpError;
        if (!authUser.user) {
            const msg = Utils.lang === 'id' ? 'Gagal membuat pengguna' : '创建用户失败';
            Utils.toast.error(msg);
            throw new Error(msg);
        }

        const { error: profileError } = await client.from('user_profiles').insert({
            id: authUser.user.id, username, email: username, name, role, store_id: storeId || null
        });
        if (profileError) throw profileError;

        // 审计：创建用户
        if (window.Audit) {
            await window.Audit.logUserCreate(authUser.user.id, username, name, role, storeId, this.user?.id);
        }

        return authUser.user;
    },

    async deleteUser(userId) {
        if (userId === this.user?.id) {
            const msg = Utils.lang === 'id' ? 'Tidak dapat menghapus akun sendiri' : '不能删除自己的账号';
            Utils.toast.error(msg);
            throw new Error(msg);
        }

        const client = SUPABASE.getClient();
        const { data: userProfile, error: fetchError } = await client
            .from('user_profiles').select('id, username, name, role').eq('id', userId).single();
        if (fetchError) throw fetchError;

        let authCleaned = false;
        
        // 方案A：优先尝试 Edge Function 删除 Auth 账户
        try {
            const { data, error } = await client.functions.invoke('delete-user', {
                body: { userId: userProfile.id }
            });
            if (!error) {
                authCleaned = true;
                console.log('✅ Edge Function 已删除 Auth 账户');
            } else {
                console.warn('Edge Function 调用失败:', error);
            }
        } catch (e) {
            console.warn('Edge Function 未部署或调用失败:', e.message);
        }
        
        // 方案B：如果 Edge Function 不可用，尝试禁用用户
        if (!authCleaned) {
            try {
                const randomPassword = Math.random().toString(36).slice(-12) + '!@#';
                const disabledEmail = 'disabled_' + Date.now() + '@placeholder.com';
                
                const { error: updateError } = await client.auth.admin.updateUserById(userProfile.id, {
                    password: randomPassword,
                    email: disabledEmail
                });
                
                if (!updateError) {
                    authCleaned = true;
                    console.log('✅ 已禁用 Auth 账户（密码和邮箱已更改）');
                } else {
                    console.warn('Auth 账户清理失败，需要管理员手动处理:', updateError?.message);
                }
            } catch (adminError) {
                console.warn('Admin API 不可用，Auth 账户未被清理');
            }
        }
        
        if (!authCleaned) {
            const lang = Utils.lang;
            const warningMsg = lang === 'id'
                ? '⚠️ Pengguna telah dihapus dari sistem, tetapi akun Auth perlu dibersihkan secara manual oleh administrator.\n\nHubungi administrator untuk pembersihan manual.'
                : '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。\n\n请联系管理员进行手动清理。';
            Utils.toast.warning(warningMsg, 8000);
        }

        const { error } = await client.from('user_profiles').delete().eq('id', userId);
        if (error) throw error;

        // 审计：删除用户
        if (window.Audit) {
            await window.Audit.logUserDelete(userProfile.id, userProfile.name, userProfile.role, this.user?.id);
        }
        return true;
    },

    async updateUser(userId, updates) {
        const client = SUPABASE.getClient();
        const { data: beforeData } = await client
            .from('user_profiles').select('*').eq('id', userId).single();

        const { error } = await client.from('user_profiles').update(updates).eq('id', userId);
        if (error) throw error;

        // 审计：更新用户
        if (window.Audit) {
            await window.Audit.logUserUpdate(userId, beforeData, updates, this.user?.id);
        }
        return true;
    },

    async resetUserPassword(userId, newPassword) {
        const lang = Utils.lang;
        const client = SUPABASE.getClient();
        
        if (this.user?.role !== 'admin') {
            const msg = lang === 'id' ? 'Hanya admin yang dapat mereset password' : '只有管理员可以重置密码';
            Utils.toast.error(msg);
            throw new Error(msg);
        }
        
        if (!newPassword || newPassword.length < 6) {
            const msg = lang === 'id' ? 'Password minimal 6 karakter' : '密码至少6个字符';
            Utils.toast.warning(msg);
            throw new Error(msg);
        }
        
        // 优先使用 Edge Function
        let edgeSuccess = false;
        try {
            const { data, error } = await client.functions.invoke('reset-user-password', {
                body: { 
                    userId: userId,
                    newPassword: newPassword,
                    adminId: this.user?.id
                }
            });
            
            if (error) {
                console.warn('Edge Function 调用失败:', error.message);
            } else {
                edgeSuccess = true;
                console.log('✅ Edge Function 已重置密码');
            }
        } catch (e) {
            console.warn('Edge Function 未部署:', e.message);
        }
        
        if (!edgeSuccess) {
            const errorMsg = lang === 'id'
                ? '❌ Fungsi reset password tidak tersedia. Hubungi administrator untuk mengaktifkan Edge Function atau lakukan reset manual di Supabase Dashboard.'
                : '❌ 密码重置功能不可用。请联系管理员部署 Edge Function，或在 Supabase 后台手动重置密码。';
            Utils.toast.error(errorMsg, 8000);
            throw new Error(errorMsg);
        }
        
        // 审计：重置密码
        if (window.Audit) {
            await window.Audit.logPasswordReset(userId, this.user?.id);
        }
        
        Utils.toast.success(lang === 'id' ? '✅ Password berhasil direset' : '✅ 密码已重置');
        
        return true;
    },

    getCurrentUserId()    { return this.user?.id || null; },
    getCurrentUserName()  { return this.user?.name || null; },
    getCurrentUserEmail() { return this.user?.email || this.user?.username || null; }
};

window.AUTH = AUTH;
