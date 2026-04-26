// auth.js - v1.4（配合增强版网络监听 + 登录锁定 localStorage）

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
            alert(msg);
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
            alert(msg);
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

    // ==================== 网络状态监听（委托给 Utils.NetworkMonitor） ====================
    // 注意：原有的独立网络监听已移除，改为使用 Utils.NetworkMonitor 增强版
    
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

        supabaseClient.auth.onAuthStateChange((event) => {
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

    // 降级方案：原有简单网络监听（当 Utils.NetworkMonitor 不可用时）
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
            var toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:8px 20px;border-radius:20px;z-index:10001;font-size:14px;transition:opacity 0.5s;';
            toast.textContent = Utils.lang === 'id' ? '✅ Koneksi Pulih' : '✅ 网络已恢复';
            document.body.appendChild(toast);
            setTimeout(function() { 
                toast.style.opacity = '0'; 
                setTimeout(function() { toast.remove(); }, 500); 
            }, 2000);
        };
        
        window.addEventListener('offline', showOfflineBanner);
        window.addEventListener('online', function() {
            hideOfflineBanner();
            showOnlineToast();
        });
        
        // 初始检查
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
            if (this._isLocked(usernameOrEmail)) return null;

            // 检查网络状态（使用增强版检测）
            const isNetworkAvailable = Utils.NetworkMonitor 
                ? await Utils.NetworkMonitor._checkRealConnectivity()
                : navigator.onLine;
            
            if (!isNetworkAvailable) {
                const lang = Utils.lang;
                alert(lang === 'id' 
                    ? '❌ Tidak ada koneksi internet. Periksa jaringan Anda.'
                    : '❌ 无网络连接，请检查网络设置。');
                return null;
            }

            let emailToUse = usernameOrEmail;
            if (!usernameOrEmail.includes('@')) {
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('user_profiles')
                    .select('username, email')
                    .or('username.eq.' + usernameOrEmail + ',email.eq.' + usernameOrEmail)
                    .maybeSingle();

                if (profileError || !profileData) {
                    console.error('找不到该用户名:', usernameOrEmail);
                    this._recordLoginFailure(usernameOrEmail);
                    const lang = Utils.lang;
                    alert(lang === 'id' ? 'Username atau password salah' : '用户名或密码错误');
                    if (window.Audit) {
                        await window.Audit.logLoginFailure(usernameOrEmail, 'username_not_found');
                    }
                    return null;
                }
                emailToUse = profileData.email || profileData.username;
            }

            const result = await SUPABASE.login(emailToUse, password);
            if (!result || result.error) {
                console.error('Login error:', result?.error);
                this._recordLoginFailure(usernameOrEmail);
                const lang = Utils.lang;
                alert(lang === 'id' ? 'Login gagal: ' + (result?.error?.message || 'Username atau password salah') : '登录失败：' + (result?.error?.message || '用户名或密码错误'));
                if (window.Audit) {
                    await window.Audit.logLoginFailure(usernameOrEmail, result?.error?.message || 'invalid_credentials');
                }
                return null;
            }

            this._resetLoginFailure(usernameOrEmail);
            await this.loadCurrentUser();

            if (!this.user) {
                console.error('Failed to load user profile after login');
                const lang = Utils.lang;
                alert(lang === 'id' ? 'Gagal memuat profil pengguna' : '加载用户资料失败');
                return null;
            }

            // 检查门店是否暂停
            if (this.user && this.user.store_id) {
                try {
                    const { data: storeData, error: storeError } = await supabaseClient
                        .from('stores')
                        .select('is_active, name')
                        .eq('id', this.user.store_id)
                        .single();
                    
                    if (!storeError && storeData && storeData.is_active === false) {
                        await this.logout();
                        var lang = Utils.lang;
                        alert(lang === 'id' 
                            ? '⚠️ Toko "' + storeData.name + '" sedang ditutup sementara.\n\nHubungi administrator untuk informasi lebih lanjut.'
                            : '⚠️ 门店 "' + storeData.name + '" 已暂停营业。\n\n请联系管理员获取更多信息。');
                        return null;
                    }
                } catch (e) {
                    console.warn('检查门店状态失败:', e.message);
                }
            }

            // 审计：登录成功
            if (window.Audit) {
                await window.Audit.logLoginSuccess(this.user.id, this.user.name);
            }
            
            return this.user;
        } catch (error) {
            console.error('LOGIN ERROR:', error);
            this._recordLoginFailure(usernameOrEmail);
            const lang = Utils.lang;
            alert(lang === 'id' ? 'Terjadi kesalahan saat login' : '登录时发生错误');
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
        SUPABASE.clearCache();
        await SUPABASE.logout();
    },

    async getAllUsers() { return await SUPABASE.getAllUsers(); },

    // ==================== 用户管理 ====================
    async addUser(username, password, name, role, storeId) {
        const { data: existing } = await supabaseClient
            .from('user_profiles').select('username').eq('username', username).single();

        if (existing) throw new Error(Utils.lang === 'id' ? 'Username sudah digunakan' : '用户名已存在');

        const { data: authUser, error: signUpError } = await supabaseClient.auth.signUp({
            email: username,
            password,
            options: { data: { name, role, store_id: storeId || null } }
        });

        if (signUpError) throw signUpError;
        if (!authUser.user) throw new Error(Utils.lang === 'id' ? 'Gagal membuat pengguna' : '创建用户失败');

        const { error: profileError } = await supabaseClient.from('user_profiles').insert({
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
            throw new Error(Utils.lang === 'id' ? 'Tidak dapat menghapus akun sendiri' : '不能删除自己的账号');
        }

        const { data: userProfile, error: fetchError } = await supabaseClient
            .from('user_profiles').select('id, username, name, role').eq('id', userId).single();
        if (fetchError) throw fetchError;

        let authCleaned = false;
        
        // 方案A：优先尝试 Edge Function 删除 Auth 账户
        try {
            const { data, error } = await supabaseClient.functions.invoke('delete-user', {
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
        
        // 方案B：如果 Edge Function 不可用，尝试禁用用户（改密码和邮箱）
        if (!authCleaned) {
            try {
                const randomPassword = Math.random().toString(36).slice(-12) + '!@#';
                const disabledEmail = 'disabled_' + Date.now() + '@placeholder.com';
                
                const { error: updateError } = await supabaseClient.auth.admin.updateUserById(userProfile.id, {
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
        
        // 警告用户
        if (!authCleaned) {
            const lang = Utils.lang;
            const warningMsg = lang === 'id'
                ? '⚠️ Pengguna telah dihapus dari sistem, tetapi akun Auth perlu dibersihkan secara manual oleh administrator.\n\nHubungi administrator untuk pembersihan manual.'
                : '⚠️ 用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。\n\n请联系管理员进行手动清理。';
            alert(warningMsg);
        }

        // 删除本地 profile
        const { error } = await supabaseClient.from('user_profiles').delete().eq('id', userId);
        if (error) throw error;

        // 审计：删除用户
        if (window.Audit) {
            await window.Audit.logUserDelete(userProfile.id, userProfile.name, userProfile.role, this.user?.id);
        }
        return true;
    },

    async updateUser(userId, updates) {
        const { data: beforeData } = await supabaseClient
            .from('user_profiles').select('*').eq('id', userId).single();

        const { error } = await supabaseClient.from('user_profiles').update(updates).eq('id', userId);
        if (error) throw error;

        // 审计：更新用户
        if (window.Audit) {
            await window.Audit.logUserUpdate(userId, beforeData, updates, this.user?.id);
        }
        return true;
    },

    async resetUserPassword(userId, newPassword) {
        const lang = Utils.lang;
        
        if (this.user?.role !== 'admin') {
            throw new Error(lang === 'id' ? 'Hanya admin yang dapat mereset password' : '只有管理员可以重置密码');
        }
        
        if (!newPassword || newPassword.length < 6) {
            throw new Error(lang === 'id' ? 'Password minimal 6 karakter' : '密码至少6个字符');
        }
        
        // 优先使用 Edge Function
        let edgeSuccess = false;
        try {
            const { data, error } = await supabaseClient.functions.invoke('reset-user-password', {
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
        
        // 如果 Edge Function 不可用，给出明确提示
        if (!edgeSuccess) {
            const errorMsg = lang === 'id'
                ? '❌ Fungsi reset password tidak tersedia. Hubungi administrator untuk mengaktifkan Edge Function atau lakukan reset manual di Supabase Dashboard.'
                : '❌ 密码重置功能不可用。请联系管理员部署 Edge Function，或在 Supabase 后台手动重置密码。';
            throw new Error(errorMsg);
        }
        
        // 审计：重置密码
        if (window.Audit) {
            await window.Audit.logPasswordReset(userId, this.user?.id);
        }
        
        return true;
    },

    getCurrentUserId()    { return this.user?.id || null; },
    getCurrentUserName()  { return this.user?.name || null; },
    getCurrentUserEmail() { return this.user?.email || this.user?.username || null; }
};

window.AUTH = AUTH;
