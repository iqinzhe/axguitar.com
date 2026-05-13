// auth.js - v2.0 (JF 命名空间)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // localStorage 白名单前缀，只清除这些前缀的 key，避免误删第三方数据
    const AUTH_STORAGE_PREFIXES = ['supabase.auth.', 'sb-'];

    const AUTH = {
        user: null,

        // ==================== 登录锁定机制（客户端 UI 缓存层） ====================
        // [高危-1 修复说明]
        // 真正的锁定逻辑已移至服务端（Supabase Edge Function: check-login-lock）。
        // 客户端 localStorage 仅用于缓存"上次服务端返回的锁定状态"以减少请求，
        // 不作为安全边界——攻击者即使清除 localStorage，服务端仍会拒绝请求。
        _localLockCacheKey: 'jf_ui_lock_cache',

        _getLocalLockCache() {
            try {
                const stored = localStorage.getItem(this._localLockCacheKey);
                return stored ? JSON.parse(stored) : {};
            } catch { return {}; }
        },

        _setLocalLockCache(cache) {
            try {
                localStorage.setItem(this._localLockCacheKey, JSON.stringify(cache));
            } catch { /* ignore quota errors */ }
        },

        _clearLocalLockCache() {
            try { localStorage.removeItem(this._localLockCacheKey); } catch { /* ignore */ }
        },

        // 仅读取本地缓存，快速给 UI 反馈（不作为真正的安全边界）
        _isLockedLocally(username) {
            const cache = this._getLocalLockCache();
            const until = cache[username];
            const now = Date.now();
            if (until && until > now) {
                const remainingMinutes = Math.ceil((until - now) / 60000);
                const msg = Utils.lang === 'id'
                    ? `Akun telah dikunci. Silakan coba lagi setelah ${remainingMinutes} menit.`
                    : `账号已锁定，请 ${remainingMinutes} 分钟后重试。`;
                Utils.toast.warning(msg, 5000);
                return true;
            }
            // 缓存已过期，清除
            if (until && until <= now) {
                const cache2 = this._getLocalLockCache();
                delete cache2[username];
                this._setLocalLockCache(cache2);
            }
            return false;
        },

        // 将服务端返回的锁定截止时间写入本地缓存
        _cacheServerLock(username, lockedUntilMs) {
            const cache = this._getLocalLockCache();
            cache[username] = lockedUntilMs;
            this._setLocalLockCache(cache);
        },

        _clearLocalLockForUser(username) {
            const cache = this._getLocalLockCache();
            delete cache[username];
            this._setLocalLockCache(cache);
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
        // [中危-1 修复] 使用白名单前缀，不再使用 includes('token') 过宽匹配
        async forceClearAuth() {
            this.user = null;
            SUPABASE.clearCache();

            // 先执行远程登出，再清理本地存储（顺序调换，避免竞态）
            try {
                await SUPABASE.getClient().auth.signOut();
            } catch (e) {
                console.warn('[Auth] Supabase signOut 失败:', e.message);
            }

            try {
                // localStorage：白名单前缀清除
                const lsKeysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && AUTH_STORAGE_PREFIXES.some(p => key.startsWith(p))) {
                        lsKeysToRemove.push(key);
                    }
                }
                lsKeysToRemove.forEach(key => localStorage.removeItem(key));

                // sessionStorage：同样白名单前缀
                const ssKeysToRemove = [];
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && AUTH_STORAGE_PREFIXES.some(p => key.startsWith(p))) {
                        ssKeysToRemove.push(key);
                    }
                }
                ssKeysToRemove.forEach(key => sessionStorage.removeItem(key));
            } catch (e) {
                console.warn('[Auth] 清除存储失败:', e.message);
            }
        },

        // ==================== 初始化 ====================
        async init() {
            if (Utils.NetworkMonitor && !Utils.NetworkMonitor._initialized) {
                Utils.NetworkMonitor.init();
            } else if (!Utils.NetworkMonitor) {
                this._initLegacyNetworkListener();
            }

            try {
                await this.loadCurrentUser();
            } catch (e) {
                console.warn('[Auth] 加载用户失败，清除认证状态:', e.message);
                await this.forceClearAuth();
            }

            const client = SUPABASE.getClient();
            client.auth.onAuthStateChange(async (event, session) => {
                if (event === 'INITIAL_SESSION') {
                    if (!session) this.user = null;
                    return;
                }

                if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
                    this.user = null;
                    SUPABASE.clearCache();
                    if (JF.DashboardCore && JF.DashboardCore.currentPage !== 'login') {
                        await JF.DashboardCore.renderLogin();
                    }
                } else if (event === 'TOKEN_REFRESHED') {
                    if (session) {
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

            if (!navigator.onLine) showOfflineBanner();
        },

        // ==================== 用户状态查询 ====================
        isLoggedIn()      { return !!this.user; },
        isAdmin()         { return this.user?.role === 'admin'; },
        isStoreManager()  { return this.user?.role === 'store_manager'; },
        isStaff()         { return this.user?.role === 'staff'; },
        canManageOrders() { return ['admin', 'store_manager', 'staff'].includes(this.user?.role); },

        // [优化-2] 异步角色查询统一由 PERMISSION 模块管理，此处仅保留业务需要的两个
        async getFreshRole() {
            try { return (await SUPABASE.getCurrentProfile())?.role || null; }
            catch (e) { console.warn('[AUTH] getFreshRole 失败:', e.message); return null; }
        },

        async getFreshStoreId() {
            try { return (await SUPABASE.getCurrentProfile())?.store_id || null; }
            catch (e) { console.warn('[AUTH] getFreshStoreId 失败:', e.message); return null; }
        },

        getCurrentStoreName() {
            if (this.user?.role === 'admin' && !this.user?.stores?.name && !this.user?.store_name) {
                return Utils.lang === 'id' ? 'Kantor Pusat' : '总部';
            }
            return this.user?.stores?.name || this.user?.store_name || (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
        },

        // ==================== 登录逻辑 ====================
        // [高危-1 修复] 锁定验证分两层：
        //   1. 先查本地缓存（UI 快速反馈，可被绕过，不是安全边界）
        //   2. 服务端 SUPABASE.login 内部调用 Edge Function check-login-lock 做真正验证
        //      服务端返回锁定信息时，写入本地缓存供下次快速展示
        async login(usernameOrEmail, password) {
            try {
                // 本地缓存检查（仅 UI 优化，不是安全边界）
                if (this._isLockedLocally(usernameOrEmail)) return null;

                // 离线拦截
                if (!navigator.onLine) {
                    Utils.toast.error(Utils.lang === 'id'
                        ? 'Tidak ada koneksi internet. Periksa jaringan Anda.'
                        : '无网络连接，请检查网络设置。', 4000);
                    return null;
                }

                // 清除本地 Supabase 缓存（白名单前缀）
                SUPABASE.clearCache();
                this.user = null;
                try {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && AUTH_STORAGE_PREFIXES.some(p => key.startsWith(p))) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                } catch (e) { /* ignore */ }

                // 执行登录（SUPABASE.login 内部负责服务端锁定校验 + 设置 AUTH.user）
                const result = await SUPABASE.login(usernameOrEmail, password);

                if (!result || result.error) {
                    console.error('[Auth] 登录失败:', result?.error);

                    // 若服务端返回锁定信息，写入本地缓存
                    if (result?.lockedUntil) {
                        this._cacheServerLock(usernameOrEmail, result.lockedUntil);
                        const remainingMinutes = Math.ceil((result.lockedUntil - Date.now()) / 60000);
                        Utils.toast.warning(Utils.lang === 'id'
                            ? `Terlalu banyak percobaan. Akun dikunci ${remainingMinutes} menit.`
                            : `登录失败次数过多，账号已锁定 ${remainingMinutes} 分钟。`, 8000);
                    } else {
                        Utils.toast.error(Utils.lang === 'id'
                            ? 'Login gagal: ' + (result?.error?.message || 'Username atau password salah')
                            : '登录失败：' + (result?.error?.message || '用户名或密码错误'), 4000);
                    }

                    if (window.Audit) {
                        window.Audit.logLoginFailure(usernameOrEmail, result?.error?.message || 'invalid_credentials').catch(() => {});
                    }
                    return null;
                }

                // 登录成功，清除本地锁定缓存
                this._clearLocalLockForUser(usernameOrEmail);

                if (!this.user) {
                    console.error('[Auth] 登录后加载用户资料失败');
                    Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat profil pengguna' : '加载用户资料失败', 4000);
                    return null;
                }

                // 检查门店状态
                if (this.user.store_id) {
                    try {
                        const storeData = this.user.stores;
                        const isActive = storeData ? storeData.is_active !== false : true;
                        const storeName = storeData?.name || '';
                        if (!isActive) {
                            await this.logout();
                            Utils.toast.warning(Utils.lang === 'id'
                                ? `Toko "${storeName}" sedang ditutup sementara.\n\nHubungi administrator untuk informasi lebih lanjut.`
                                : `门店 "${storeName}" 已暂停营业。\n\n请联系管理员获取更多信息。`, 6000);
                            return null;
                        }
                    } catch (e) {
                        console.warn('[Auth] 检查门店状态失败:', e.message);
                    }
                }

                if (window.Audit) {
                    window.Audit.logLoginSuccess(this.user.id, this.user.name).catch(() => {});
                }

                return this.user;
            } catch (error) {
                console.error('[Auth] 登录异常:', error);
                Utils.toast.error(Utils.lang === 'id' ? 'Terjadi kesalahan saat login' : '登录时发生错误', 4000);
                return null;
            }
        },

        async loadCurrentUser() {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                this.user = profile || null;
            } catch (e) {
                console.warn('[Auth] loadCurrentUser 失败:', e.message);
                this.user = null;
            }
        },

        // [中危-2 修复] logout() 不再重复设置 user = null，由 forceClearAuth() 统一管理
        async logout() {
            if (this.user && window.Audit) {
                try {
                    await window.Audit.logLogout(this.user.id, this.user.name);
                } catch (e) {
                    console.warn('[Auth] 审计日志记录失败:', e.message);
                }
            }
            this._clearLocalLockCache();
            await this.forceClearAuth(); // forceClearAuth 内部已处理 user = null
        },

        async getAllUsers() {
            try { return await SUPABASE.getAllUsers(); }
            catch (e) { console.warn('[AUTH] getAllUsers 失败:', e.message); return []; }
        },

        // ==================== 用户管理 ====================
        // [优化-1 修复] 改用 auth.admin.createUser 并设置 email_confirm: true，
        //              跳过邮件确认流程，适合管理员后台直接创建账号的场景
        async addUser(username, password, name, role, storeId) {
            const client = SUPABASE.getClient();
            const { data: existing } = await client
                .from('user_profiles').select('username').eq('username', username).single();

            if (existing) {
                const msg = Utils.lang === 'id' ? 'Username sudah digunakan' : '用户名已存在';
                Utils.toast.error(msg);
                throw new Error(msg);
            }

            // 使用 Admin API 创建用户，email_confirm: true 跳过邮件确认
            const { data: authData, error: createError } = await client.auth.admin.createUser({
                email: username,
                password,
                email_confirm: true,
                user_metadata: { name, role, store_id: storeId || null }
            });

            if (createError) throw createError;
            if (!authData?.user) {
                const msg = Utils.lang === 'id' ? 'Gagal membuat pengguna' : '创建用户失败';
                Utils.toast.error(msg);
                throw new Error(msg);
            }

            const { error: profileError } = await client.from('user_profiles').insert({
                id: authData.user.id,
                username,
                email: username,
                name,
                role,
                store_id: storeId || null
            });
            if (profileError) throw profileError;

            if (window.Audit) {
                await window.Audit.logUserCreate(authData.user.id, username, name, role, storeId, this.user?.id);
            }

            return authData.user;
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

        // [高危-2 修复] Auth 清理失败时立即中止，不继续删除 profile，
        //              避免出现"profile 已删但 Auth 账号仍可登录"的悬空账号
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

            // 优先尝试 Edge Function（最可靠）
            try {
                const { error: fnError } = await client.functions.invoke('delete-user', {
                    body: { userId: userProfile.id }
                });
                if (!fnError) {
                    authCleaned = true;
                } else {
                    console.warn('[Auth] delete-user Edge Function 失败:', fnError.message);
                }
            } catch (e) {
                console.warn('[Auth] delete-user Edge Function 未部署或调用异常:', e.message);
            }

            // 降级：尝试 Admin API 废置账号
            if (!authCleaned) {
                try {
                    const randomPassword = crypto.randomUUID
                        ? crypto.randomUUID().replace(/-/g, '') + '!A1'
                        : Math.random().toString(36).slice(-16) + '!A1';
                    const disabledEmail = `disabled_${Date.now()}_${userProfile.id.slice(0, 8)}@placeholder.invalid`;
                    const { error: updateError } = await client.auth.admin.updateUserById(userProfile.id, {
                        password: randomPassword,
                        email: disabledEmail,
                        ban_duration: 'none' // 配合 Supabase ban 功能（若已启用）
                    });
                    if (!updateError) {
                        authCleaned = true;
                    } else {
                        console.warn('[Auth] Admin API 废置账号失败:', updateError.message);
                    }
                } catch (adminError) {
                    console.warn('[Auth] Admin API 不可用:', adminError.message);
                }
            }

            // [高危-2] 两种方式均失败时，中止删除并抛出错误，保持数据一致性
            if (!authCleaned) {
                const msg = Utils.lang === 'id'
                    ? 'Gagal membersihkan akun Auth. Penghapusan dibatalkan untuk menjaga konsistensi data.\n\nHubungi administrator untuk menghapus akun secara manual di Supabase Dashboard.'
                    : 'Auth 账号清理失败，删除操作已中止以保持数据一致性。\n\n请管理员在 Supabase 后台手动删除该用户后重试。';
                Utils.toast.error(msg, 10000);
                throw new Error('[Auth] Auth 账号清理失败，deleteUser 操作中止');
            }

            // Auth 清理成功后，再删除 profile
            const { error } = await client.from('user_profiles').delete().eq('id', userId);
            if (error) throw error;

            if (window.Audit) {
                await window.Audit.logUserDelete(userProfile.id, userProfile.name, userProfile.role, this.user?.id);
            }
            return true;
        },

        // [中危-3 说明] 密码经 HTTPS 传输至 Edge Function，为安全最佳实践，
        // 请确保 reset-user-password Edge Function 的日志中对 newPassword 参数做脱敏处理。
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
                        userId,
                        newPassword,
                        adminId: this.user?.id
                    }
                });
                if (!error) {
                    edgeSuccess = true;
                } else {
                    console.warn('[Auth] reset-user-password Edge Function 失败:', error.message);
                }
            } catch (e) {
                console.warn('[Auth] reset-user-password Edge Function 未部署:', e.message);
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

})();
