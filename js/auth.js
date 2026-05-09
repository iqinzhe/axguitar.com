// auth.js - v2.0
// 移除 Enter 键监听 + 修复 logout 重复调用 signOut

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const AUTH = {
        user: null,

        // ==================== 登录锁定机制 ====================
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
                const msg = Utils.lang === 'id'
                    ? `Akun telah dikunci. Silakan coba lagi setelah ${remainingMinutes} menit.`
                    : `账号已锁定，请 ${remainingMinutes} 分钟后重试。`;
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

                const msg = Utils.lang === 'id'
                    ? 'Terlalu banyak percobaan login. Akun dikunci selama 15 menit.'
                    : '登录尝试次数过多，账号已锁定15分钟。';
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

        // ==================== 记住我功能 ====================
        _rememberMeKey: 'jf_remember_me',

        isRememberMe() {
            return localStorage.getItem(this._rememberMeKey) === 'true';
        },

        setRememberMe(remember) {
            if (remember) {
                localStorage.setItem(this._rememberMeKey, 'true');
            } else {
                localStorage.removeItem(this._rememberMeKey);
            }
        },

        // ==================== 强制清除认证状态 ====================
        async forceClearAuth() {
            console.log('[Auth] 强制清除认证状态');
            this.user = null;
            SUPABASE.clearCache();
            
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (
                        key.startsWith('supabase.auth.') ||
                        key.startsWith('sb-') ||
                        key.includes('token')
                    )) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && (
                        key.startsWith('supabase.auth.') ||
                        key.startsWith('sb-')
                    )) {
                        sessionStorage.removeItem(key);
                    }
                }
            } catch (e) {
                console.warn('[Auth] 清除存储失败:', e.message);
            }
            
            try {
                await SUPABASE.getClient().auth.signOut();
            } catch (e) {
                console.warn('[Auth] Supabase signOut 失败:', e.message);
            }
        },

        // ==================== 初始化 ====================
        async init() {
            console.log('[Auth] 初始化认证模块...');
            
            if (Utils.NetworkMonitor && !Utils.NetworkMonitor._initialized) {
                Utils.NetworkMonitor.init();
                console.log('📡 增强版网络监控已启动');
            } else if (Utils.NetworkMonitor && Utils.NetworkMonitor._initialized) {
                console.log('📡 网络监控已运行');
            } else {
                this._initLegacyNetworkListener();
            }

            try {
                await this.loadCurrentUser();
                if (this.user) {
                    console.log('[Auth] 用户已登录:', this.user.name);
                } else {
                    console.log('[Auth] 用户未登录');
                }
            } catch (e) {
                console.warn('[Auth] 加载用户失败，清除认证状态:', e.message);
                await this.forceClearAuth();
            }

            const client = SUPABASE.getClient();
            client.auth.onAuthStateChange(async (event, session) => {
                console.log('[Auth] 认证状态变化:', event);

                if (event === 'INITIAL_SESSION') {
                    if (!session) {
                        console.log('[Auth] 初始会话为空，用户未登录');
                        this.user = null;
                    }
                    return;
                }

                if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
                    console.log('[Auth] 用户已登出或被删除');
                    this.user = null;
                    SUPABASE.clearCache();
                    if (JF.DashboardCore && JF.DashboardCore.currentPage !== 'login') {
                        await JF.DashboardCore.renderLogin();
                    }
                } else if (event === 'TOKEN_REFRESHED') {
                    if (session) {
                        console.log('[Auth] Token 已刷新');
                        SUPABASE.clearCache();
                        try {
                            await this.loadCurrentUser();
                        } catch (e) {
                            console.warn('[Auth] Token 刷新后加载用户失败:', e.message);
                            await this.forceClearAuth();
                            if (JF.DashboardCore && JF.DashboardCore.currentPage !== 'login') {
                                await JF.DashboardCore.renderLogin();
                            }
                        }
                    } else {
                        console.warn('[Auth] Token 刷新失败，清除认证状态');
                        await this.forceClearAuth();
                        if (JF.DashboardCore && JF.DashboardCore.currentPage !== 'login') {
                            await JF.DashboardCore.renderLogin();
                        }
                    }
                }
            });

            console.log('[Auth] 认证模块初始化完成');
        },

        // 降级方案：原有简单网络监听
        _initLegacyNetworkListener() {
            if (this._legacyListenerInitialized) return;
            this._legacyListenerInitialized = true;

            const showOfflineBanner = () => {
                if (document.getElementById('offlineBanner')) return;
                const banner = document.createElement('div');
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

            const hideOfflineBanner = () => {
                const banner = document.getElementById('offlineBanner');
                if (banner) banner.remove();
            };

            window.addEventListener('offline', showOfflineBanner);
            window.addEventListener('online', () => {
                hideOfflineBanner();
                Utils.toast.info(Utils.lang === 'id' ? 'Koneksi Pulih' : '网络已恢复', 2000);
            });

            if (!navigator.onLine) {
                showOfflineBanner();
            }
        },

        // ==================== 用户状态查询 ====================
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
                console.log('[Auth] 开始登录:', usernameOrEmail);
                
                if (this._isLocked(usernameOrEmail)) return null;

                const isNetworkAvailable = Utils.NetworkMonitor
                    ? await Utils.NetworkMonitor._checkRealConnectivity()
                    : navigator.onLine;

                if (!isNetworkAvailable) {
                    Utils.toast.error(Utils.lang === 'id'
                        ? 'Tidak ada koneksi internet. Periksa jaringan Anda.'
                        : '无网络连接，请检查网络设置。', 4000);
                    return null;
                }

                await this.forceClearAuth();

                const result = await SUPABASE.login(usernameOrEmail, password);

                if (!result || result.error) {
                    console.error('[Auth] 登录失败:', result?.error);
                    this._recordLoginFailure(usernameOrEmail);
                    Utils.toast.error(Utils.lang === 'id'
                        ? 'Login gagal: ' + (result?.error?.message || 'Username atau password salah')
                        : '登录失败：' + (result?.error?.message || '用户名或密码错误'), 4000);
                    if (window.Audit) {
                        await window.Audit.logLoginFailure(usernameOrEmail, result?.error?.message || 'invalid_credentials');
                    }
                    return null;
                }

                this._resetLoginFailure(usernameOrEmail);

                await this.loadCurrentUser();

                if (!this.user) {
                    console.error('[Auth] 登录后加载用户资料失败');
                    Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat profil pengguna' : '加载用户资料失败', 4000);
                    return null;
                }

                console.log('[Auth] 登录成功:', this.user.name);

                if (this.user.store_id) {
                    try {
                        const storeStatus = await SUPABASE.checkStoreStatus(this.user.store_id);
                        if (!storeStatus.is_active) {
                            await this.logout();
                            Utils.toast.warning(Utils.lang === 'id'
                                ? `Toko "${storeStatus.name}" sedang ditutup sementara.\n\nHubungi administrator untuk informasi lebih lanjut.`
                                : `门店 "${storeStatus.name}" 已暂停营业。\n\n请联系管理员获取更多信息。`, 6000);
                            return null;
                        }
                    } catch (e) {
                        console.warn('[Auth] 检查门店状态失败:', e.message);
                    }
                }

                if (window.Audit) {
                    await window.Audit.logLoginSuccess(this.user.id, this.user.name);
                }

                return this.user;
            } catch (error) {
                console.error('[Auth] 登录异常:', error);
                this._recordLoginFailure(usernameOrEmail);
                Utils.toast.error(Utils.lang === 'id' ? 'Terjadi kesalahan saat login' : '登录时发生错误', 4000);
                return null;
            }
        },

        async loadCurrentUser() {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                if (profile) {
                    this.user = profile;
                    console.log('[Auth] 用户资料已加载:', profile.name);
                } else {
                    this.user = null;
                    console.log('[Auth] 无用户资料');
                }
            } catch (e) {
                console.warn('[Auth] loadCurrentUser 失败:', e.message);
                this.user = null;
            }
        },

        // 【修复 #2】logout 简化，只调用一次 forceClearAuth，避免重复 signOut
        async logout() {
            console.log('[Auth] 执行登出');
            
            if (this.user && window.Audit) {
                try {
                    await window.Audit.logLogout(this.user.id, this.user.name);
                } catch (e) {
                    console.warn('[Auth] 审计日志记录失败:', e.message);
                }
            }
            
            this._clearAllLoginFailures();
            this.user = null;
            
            await this.forceClearAuth();
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
                id: authUser.user.id,
                username,
                email: username,
                name,
                role,
                store_id: storeId || null
            });
            if (profileError) throw profileError;

            if (window.Audit) {
                await window.Audit.logUserCreate(authUser.user.id, username, name, role, storeId, this.user?.id);
            }

            return authUser.user;
        },

        async updateUser(userId, updates) {
            const client = SUPABASE.getClient();
            const { data: beforeData } = await client
                .from('user_profiles').select('*').eq('id', userId).single();

            const { error } = await client.from('user_profiles').update(updates).eq('id', userId);
            if (error) throw error;

            if (window.Audit) {
                await window.Audit.logUserUpdate(userId, beforeData, updates, this.user?.id);
            }
            return true;
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

            try {
                const { error: fnError } = await client.functions.invoke('delete-user', {
                    body: { userId: userProfile.id }
                });
                if (!fnError) {
                    authCleaned = true;
                    console.log('✅ Edge Function 已删除 Auth 账户');
                } else {
                    console.warn('Edge Function 调用失败:', fnError);
                }
            } catch (e) {
                console.warn('Edge Function 未部署或调用失败:', e.message);
            }

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
                        console.warn('Auth 账户清理失败:', updateError?.message);
                    }
                } catch (adminError) {
                    console.warn('Admin API 不可用，Auth 账户未被清理');
                }
            }

            if (!authCleaned) {
                const msg = Utils.lang === 'id'
                    ? 'Pengguna telah dihapus dari sistem, tetapi akun Auth perlu dibersihkan secara manual oleh administrator.\n\nHubungi administrator untuk pembersihan manual.'
                    : '用户已从系统删除，但 Auth 账号需要管理员在后台手动清理。\n\n请联系管理员进行手动清理。';
                Utils.toast.warning(msg, 8000);
            }

            const { error } = await client.from('user_profiles').delete().eq('id', userId);
            if (error) throw error;

            if (window.Audit) {
                await window.Audit.logUserDelete(userProfile.id, userProfile.name, userProfile.role, this.user?.id);
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

            let edgeSuccess = false;
            try {
                const { error } = await client.functions.invoke('reset-user-password', {
                    body: {
                        userId: userId,
                        newPassword: newPassword,
                        adminId: this.user?.id
                    }
                });
                if (!error) {
                    edgeSuccess = true;
                    console.log('✅ Edge Function 已重置密码');
                } else {
                    console.warn('Edge Function 调用失败:', error.message);
                }
            } catch (e) {
                console.warn('Edge Function 未部署:', e.message);
            }

            if (!edgeSuccess) {
                const errorMsg = lang === 'id'
                    ? 'Fungsi reset password tidak tersedia. Hubungi administrator untuk mengaktifkan Edge Function atau lakukan reset manual di Supabase Dashboard.'
                    : '密码重置功能不可用。请联系管理员部署 Edge Function，或在 Supabase 后台手动重置密码。';
                Utils.toast.error(errorMsg, 8000);
                throw new Error(errorMsg);
            }

            if (window.Audit) {
                await window.Audit.logPasswordReset(userId, this.user?.id);
            }

            Utils.toast.success(lang === 'id' ? 'Password berhasil direset' : '密码已重置');
            return true;
        },

        getCurrentUserId()    { return this.user?.id || null; },
        getCurrentUserName()  { return this.user?.name || null; },
        getCurrentUserEmail() { return this.user?.email || this.user?.username || null; },
    };

    // 挂载到命名空间
    JF.Auth = AUTH;
    window.AUTH = AUTH;

    console.log('✅ JF.Auth v2.0（logout 只调用一次 signOut）');
})();
