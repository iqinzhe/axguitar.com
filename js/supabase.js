// supabase.js - v2.3 优化版 (JF 统一命名空间，资金池指标版)
// 数据层核心，挂载到 JF.Supabase，向下兼容 window.SUPABASE

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 安全存储（兼容浏览器限制） ====================
    const SafeStorage = {
        _memoryStore: {},
        _storageAvailable: null,
        _cookieEnabled: null,
        _sessionStorageAvailable: null,

        _checkLocalStorage() {
            if (this._storageAvailable !== null) return this._storageAvailable;
            try {
                const key = '__storage_test__';
                localStorage.setItem(key, '1');
                localStorage.removeItem(key);
                this._storageAvailable = true;
                return true;
            } catch (e) {
                console.warn('[SafeStorage] localStorage 被阻止，使用备用方案');
                this._storageAvailable = false;
                return false;
            }
        },

        _checkSessionStorage() {
            if (this._sessionStorageAvailable !== null) return this._sessionStorageAvailable;
            try {
                const key = '__sstest__';
                sessionStorage.setItem(key, '1');
                sessionStorage.removeItem(key);
                this._sessionStorageAvailable = true;
                return true;
            } catch (e) {
                this._sessionStorageAvailable = false;
                return false;
            }
        },

        _checkCookie() {
            if (this._cookieEnabled !== null) return this._cookieEnabled;
            try {
                document.cookie = '__cookie_test__=1;path=/;SameSite=Lax';
                const has = document.cookie.indexOf('__cookie_test__=') !== -1;
                document.cookie = '__cookie_test__=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
                this._cookieEnabled = has;
                return has;
            } catch (e) {
                this._cookieEnabled = false;
                return false;
            }
        },

        _getCookie(name) {
            try {
                const value = '; ' + document.cookie;
                const parts = value.split('; ' + name + '=');
                if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
            } catch (e) { /* ignore */ }
            return null;
        },

        _setCookie(name, value, days) {
            try {
                let expires = '';
                if (days) {
                    const d = new Date();
                    d.setTime(d.getTime() + days * 86400000);
                    expires = ';expires=' + d.toUTCString();
                }
                document.cookie = name + '=' + encodeURIComponent(value) + ';path=/;SameSite=Lax' + expires;
                return true;
            } catch (e) {
                return false;
            }
        },

        _removeCookie(name) {
            try {
                document.cookie = name + '=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
            } catch (e) { /* ignore */ }
        },

        getItem(key) {
            if (this._checkLocalStorage()) {
                try { const v = localStorage.getItem(key); if (v !== null) return v; } catch (e) { /* ignore */ }
            }
            if (this._checkSessionStorage()) {
                try { const v = sessionStorage.getItem(key); if (v !== null) return v; } catch (e) { /* ignore */ }
            }
            if (this._checkCookie()) {
                const v = this._getCookie(key);
                if (v !== null) return v;
            }
            return this._memoryStore[key] || null;
        },

        setItem(key, value) {
            const str = String(value);
            if (this._checkLocalStorage()) { try { localStorage.setItem(key, str); } catch (e) { /* ignore */ } }
            if (this._checkSessionStorage()) { try { sessionStorage.setItem(key, str); } catch (e) { /* ignore */ } }
            if (this._checkCookie()) { this._setCookie(key, str, 365); }
            this._memoryStore[key] = str;
        },

        removeItem(key) {
            if (this._checkLocalStorage()) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
            if (this._checkSessionStorage()) { try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ } }
            if (this._checkCookie()) { this._removeCookie(key); }
            delete this._memoryStore[key];
        },

        clear(prefix = '') {
            if (this._checkLocalStorage()) {
                try {
                    for (const key of Object.keys(localStorage)) {
                        if (!prefix || key.startsWith(prefix)) localStorage.removeItem(key);
                    }
                } catch (e) { /* ignore */ }
            }
            if (this._checkSessionStorage()) {
                try {
                    for (const key of Object.keys(sessionStorage)) {
                        if (!prefix || key.startsWith(prefix)) sessionStorage.removeItem(key);
                    }
                } catch (e) { /* ignore */ }
            }
            if (this._checkCookie()) {
                try {
                    for (const cookie of document.cookie.split(';')) {
                        const name = cookie.trim().split('=')[0];
                        if (!prefix || name.startsWith(prefix)) this._removeCookie(name);
                    }
                } catch (e) { /* ignore */ }
            }
            if (prefix) {
                for (const key of Object.keys(this._memoryStore).filter(k => k.startsWith(prefix))) {
                    delete this._memoryStore[key];
                }
            } else {
                this._memoryStore = {};
            }
        }
    };

    const SafeSessionStorage = {
        _memoryStore: {},

        _checkSessionStorage() {
            try {
                const key = '__sstest__';
                sessionStorage.setItem(key, '1');
                sessionStorage.removeItem(key);
                return true;
            } catch (e) { return false; }
        },

        getItem(key) {
            if (this._checkSessionStorage()) {
                try { return sessionStorage.getItem(key); } catch (e) { /* ignore */ }
            }
            return this._memoryStore[key] || null;
        },

        setItem(key, value) {
            if (this._checkSessionStorage()) {
                try { sessionStorage.setItem(key, value); } catch (e) { /* ignore */ }
            }
            if (value == null) delete this._memoryStore[key];
            else this._memoryStore[key] = String(value);
        },

        removeItem(key) {
            if (this._checkSessionStorage()) { try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ } }
            delete this._memoryStore[key];
        }
    };

    // 挂载到 JF.Storage
    JF.Storage = {
        safe: SafeStorage,
        session: SafeSessionStorage,
    };

    // ==================== Supabase 客户端初始化 ====================
    const SUPABASE_URL = window.APP_CONFIG?.SUPABASE?.URL || '';
    const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE?.ANON_KEY || '';

    let supabaseClient;

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                storage: SafeStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        });
        console.log('✅ Supabase 客户端初始化成功（安全存储）');
    } catch (e) {
        console.warn('自定义存储初始化失败，尝试默认配置:', e.message);
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('⚠️ Supabase 客户端初始化使用默认存储');
    }

    // ==================== 内部缓存 ====================
    let _profileCache = null;
    const _storePrefixCache = new Map();
    let _storesCache = null;
    let _storesCacheTime = 0;
    const STORES_CACHE_TTL = 5 * 60 * 1000; // 5分钟

    // ==================== SupabaseAPI 主对象 ====================
    const SupabaseAPI = {
        getClient() { return supabaseClient; },
        getSafeStorage() { return SafeStorage; },
        getSafeSessionStorage() { return SafeSessionStorage; },

        // ---------- 认证相关 ----------
        async getSession() {
            try {
                const { data, error } = await supabaseClient.auth.getSession();
                if (error) { console.warn('getSession error:', error.message); return null; }
                return data.session;
            } catch (e) { console.warn('getSession exception:', e.message); return null; }
        },

        async getCurrentUser() {
            try {
                const { data, error } = await supabaseClient.auth.getUser();
                if (error) {
                    if (error.message !== 'Auth session missing!') console.warn('getCurrentUser error:', error.message);
                    return null;
                }
                return data?.user || null;
            } catch (e) { console.warn('getCurrentUser exception:', e.message); return null; }
        },

        async getCurrentProfile() {
            if (_profileCache) return _profileCache;
            try {
                const user = await this.getCurrentUser();
                if (!user) return null;
                const { data, error } = await supabaseClient
                    .from('user_profiles').select('*').eq('id', user.id).single();
                if (error) { console.error('getCurrentProfile error:', error.message); return null; }
                if (data?.store_id) {
                    const { data: storeData, error: storeError } = await supabaseClient
                        .from('stores').select('*').eq('id', data.store_id).single();
                    if (!storeError && storeData) data.stores = storeData;
                }
                _profileCache = data;
                if (window.AUTH) window.AUTH.user = data;
                return data;
            } catch (e) { console.warn('getCurrentProfile exception:', e.message); return null; }
        },

        clearCache() {
            _profileCache = null;
            _storePrefixCache.clear();
            _storesCache = null;
            _storesCacheTime = 0;
            if (JF.Cache) JF.Cache.clear();
        },

        async checkStoreStatus(storeId) {
            try {
                const { data, error } = await supabaseClient
                    .from('stores').select('is_active, name').eq('id', storeId).single();
                if (error) { console.warn('检查门店状态失败:', error.message); return { is_active: true, name: 'Unknown' }; }
                return data || { is_active: true, name: 'Unknown' };
            } catch (e) { console.warn('检查门店状态异常:', e.message); return { is_active: true, name: 'Unknown' }; }
        },

        async isAdmin() { const p = await this.getCurrentProfile(); return p?.role === 'admin'; },
        async getCurrentStoreId() { const p = await this.getCurrentProfile(); return p?.store_id; },
        async getCurrentStoreName() { const p = await this.getCurrentProfile(); return p?.stores?.name || 'Kantor'; },

        async login(emailOrUsername, password) {
            let emailToUse = emailOrUsername;
            if (!emailOrUsername.includes('@')) {
                const { data: profileData, error: profileError } = await supabaseClient
                    .from('user_profiles').select('username, email')
                    .or('username.eq.' + emailOrUsername + ',email.eq.' + emailOrUsername)
                    .maybeSingle();
                if (profileError || !profileData) {
                    return { error: { message: Utils.lang === 'id' ? 'Username tidak ditemukan' : '用户名不存在' } };
                }
                emailToUse = profileData.email || profileData.username;
            }
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: emailToUse,
                password: password,
            });
            if (error) return { error };
            this.clearCache();
            if (window.AUTH && data.user) await window.AUTH.loadCurrentUser();
            return data;
        },

        async logout() {
            this.clearCache();
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
        },

        // ---------- 门店相关 ----------
        async getAllStores(forceRefresh = false) {
            const now = Date.now();
            if (!forceRefresh && _storesCache && (now - _storesCacheTime) < STORES_CACHE_TTL) return _storesCache;
            const { data, error } = await supabaseClient.from('stores').select('*').neq('code', 'STORE_000').order('code');
            _storesCache = data;
            _storesCacheTime = now;
            for (const store of data || []) {
                if (store.prefix) {
                    _storePrefixCache.set(store.id, store.prefix);
                    _storePrefixCache.set(store.code, store.prefix);
                }
            }
            return data;
        },

        async _getStorePrefix(storeId) {
            if (!storeId) return 'AD';
            if (_storePrefixCache.has(storeId)) return _storePrefixCache.get(storeId);
            try {
                const { data, error } = await supabaseClient
                    .from('stores').select('prefix, code').eq('id', storeId).single();
                if (error || !data) { console.warn('获取门店前缀失败:', error); return 'AD'; }
                let prefix = data.prefix;
                if (!prefix && data.code) {
                    const map = { 'STORE_000': 'AD', 'STORE_001': 'BL', 'STORE_002': 'SO', 'STORE_003': 'GP', 'STORE_004': 'BJ' };
                    prefix = map[data.code] || 'AD';
                }
                if (!prefix) prefix = 'AD';
                _storePrefixCache.set(storeId, prefix);
                if (data.code) _storePrefixCache.set(data.code, prefix);
                return prefix;
            } catch (err) { console.error('_getStorePrefix error:', err); return 'AD'; }
        },

        _generateOrderId: async function (role, storeId, maxRetries = 10) {
            let prefix = 'AD';
            if (role !== 'admin') prefix = await this._getStorePrefix(storeId);
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const { data: existing, error: queryError } = await supabaseClient
                        .from('orders').select('order_id').like('order_id', prefix + '%')
                        .order('created_at', { ascending: false }).limit(1);
                    if (queryError) {
                        console.warn(`查询最大订单号失败 (${attempt}/${maxRetries}):`, queryError);
                        if (attempt === maxRetries) throw queryError;
                        await new Promise(r => setTimeout(r, 50 * attempt));
                        continue;
                    }
                    let maxNumber = 0;
                    if (existing && existing.length > 0) {
                        const match = existing[0].order_id.match(new RegExp(prefix + '(\\d{3})$'));
                        if (match) maxNumber = parseInt(match[1], 10);
                    }
                    const nextNumber = maxNumber + 1;
                    const serial = String(nextNumber).padStart(3, '0');
                    const newOrderId = prefix + serial;
                    const { data: testData, error: testError } = await supabaseClient
                        .from('orders').select('id').eq('order_id', newOrderId).maybeSingle();
                    if (!testError && testData) {
                        console.warn(`订单ID ${newOrderId} 已存在，重试 ${attempt}/${maxRetries}`);
                        await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
                        continue;
                    }
                    return newOrderId;
                } catch (err) {
                    console.warn(`生成订单ID异常 (${attempt}/${maxRetries}):`, err.message);
                    if (attempt === maxRetries) throw err;
                    await new Promise(r => setTimeout(r, 50 * attempt));
                }
            }
            const timestamp = Date.now().toString().slice(-6);
            const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
            return prefix + timestamp + random;
        },

        _generateCustomerId: async function (storeId, maxRetries = 10) {
            const prefix = await this._getStorePrefix(storeId);
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const { data: existing, error: queryError } = await supabaseClient
                        .from('customers').select('customer_id').like('customer_id', prefix + '%')
                        .order('customer_id', { ascending: false }).limit(1);
                    if (queryError) {
                        if (attempt === maxRetries) throw queryError;
                        await new Promise(r => setTimeout(r, 50 * attempt));
                        continue;
                    }
                    let maxNumber = 0;
                    if (existing && existing.length > 0) {
                        const match = existing[0].customer_id.match(new RegExp(prefix + '(\\d{3})$'));
                        if (match) maxNumber = parseInt(match[1], 10);
                    }
                    const nextNumber = maxNumber + 1;
                    const serial = String(nextNumber).padStart(3, '0');
                    const newCustomerId = prefix + serial;
                    const { data: testData } = await supabaseClient
                        .from('customers').select('id').eq('customer_id', newCustomerId).maybeSingle();
                    if (!testData) return newCustomerId;
                    await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
                } catch (err) {
                    if (attempt === maxRetries) throw err;
                    await new Promise(r => setTimeout(r, 50 * attempt));
                }
            }
            return prefix + Date.now().toString().slice(-6) + String(Math.floor(Math.random() * 100)).padStart(2, '0');
        },

        // ---------- 客户相关 ----------
        async createCustomer(customerData) {
            const profile = await this.getCurrentProfile();
            const storeId = customerData.store_id || profile.store_id;
            let retryCount = 0, maxRetries = 8, lastError = null;
            while (retryCount < maxRetries) {
                try {
                    const customerId = await this._generateCustomerId(storeId, maxRetries);
                    const { data, error } = await supabaseClient.from('customers').insert({
                        customer_id: customerId,
                        store_id: storeId,
                        name: customerData.name,
                        ktp_number: customerData.ktp_number || null,
                        phone: customerData.phone,
                        ktp_address: customerData.ktp_address || null,
                        address: customerData.address || null,
                        living_same_as_ktp: customerData.living_same_as_ktp,
                        living_address: customerData.living_address || null,
                        occupation: customerData.occupation || null,
                        registered_date: customerData.registered_date || Utils.getLocalToday(),
                        created_by: profile.id,
                        updated_at: Utils.getLocalDateTime()
                    }).select().single();
                    if (error) {
                        if (error.code === '23505') {
                            console.warn(`客户ID ${customerId} 冲突，重试 ${retryCount + 1}/${maxRetries}`);
                            retryCount++; lastError = error;
                            await new Promise(r => setTimeout(r, 50 * Math.pow(2, retryCount)));
                            continue;
                        }
                        throw error;
                    }
                    console.log(`✅ 客户创建成功: ${customerId}`);
                    return data;
                } catch (err) {
                    if (err.code === '23505' && retryCount < maxRetries - 1) {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 50 * Math.pow(2, retryCount)));
                        continue;
                    }
                    throw err;
                }
            }
            throw lastError || new Error('无法创建客户，请重试');
        },

        async updateCustomer(customerId, customerData) {
            const profile = await this.getCurrentProfile();
            const updates = {
                name: customerData.name,
                phone: customerData.phone,
                ktp_number: customerData.ktp_number || null,
                ktp_address: customerData.ktp_address || null,
                address: customerData.ktp_address || null,
                living_same_as_ktp: customerData.living_same_as_ktp,
                living_address: customerData.living_address || null,
                occupation: customerData.occupation || null,
                updated_at: Utils.getLocalDateTime()
            };
            const { error } = await supabaseClient.from('customers').update(updates).eq('id', customerId);
            if (error) throw error;
            return true;
        },

        async getCustomers(filters) {
            if (filters === undefined) filters = {};
            const profile = await this.getCurrentProfile();
            const { data: blacklistData } = await supabaseClient.from('blacklist').select('customer_id');
            const blacklistedIds = (blacklistData || []).map(b => b.customer_id);
            let query = supabaseClient.from('customers').select('*').order('registered_date', { ascending: false });
            if (profile?.role !== 'admin' && profile?.store_id) query = query.eq('store_id', profile.store_id);
            if (blacklistedIds.length > 0) query = query.not('id', 'in', '(' + blacklistedIds.join(',') + ')');
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },

        async getCustomer(customerId) {
            const { data, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;
            return data;
        },

        // ---------- 黑名单 ----------
        async checkBlacklist(customerId) {
            const { data, error } = await supabaseClient
                .from('blacklist').select('id, reason').eq('customer_id', customerId).maybeSingle();
            if (error && error.code === '22P02') {
                const { data: customer } = await supabaseClient
                    .from('customers').select('id').eq('customer_id', customerId).single();
                if (customer) {
                    const { data: retryData } = await supabaseClient
                        .from('blacklist').select('id, reason').eq('customer_id', customer.id).maybeSingle();
                    return retryData ? { isBlacklisted: true, reason: retryData.reason } : { isBlacklisted: false };
                }
                return { isBlacklisted: false };
            }
            if (error) throw error;
            return data ? { isBlacklisted: true, reason: data.reason } : { isBlacklisted: false };
        },

        async addToBlacklist(customerId, reason, blacklistedBy) {
            const { data: customer, error: customerError } = await supabaseClient
                .from('customers').select('id, store_id, customer_id, name, occupation').eq('id', customerId).single();
            if (customerError) throw customerError;
            const { data: existing } = await supabaseClient
                .from('blacklist').select('id').eq('customer_id', customer.id).maybeSingle();
            if (existing) throw new Error(Utils.lang === 'id' ? 'Nasabah sudah ada di blacklist' : '客户已在黑名单中');
            const { error: insertError } = await supabaseClient.from('blacklist').insert({
                customer_id: customer.id,
                reason: reason.trim(),
                blacklisted_by: blacklistedBy,
                store_id: customer.store_id
            });
            if (insertError) throw insertError;
            return { customer_id: customer.id, reason: reason.trim() };
        },

        async removeFromBlacklist(customerId) {
            let deleteError = null;
            const { error: directError } = await supabaseClient.from('blacklist').delete().eq('customer_id', customerId);
            if (directError && directError.code === '22P02') {
                const { data: customer } = await supabaseClient
                    .from('customers').select('id').eq('customer_id', customerId).single();
                if (customer) {
                    const { error: retryError } = await supabaseClient
                        .from('blacklist').delete().eq('customer_id', customer.id);
                    deleteError = retryError;
                } else { deleteError = directError; }
            } else { deleteError = directError; }
            if (deleteError) throw deleteError;
            return true;
        },

        async getBlacklist(filterStoreId = null, profile = null) {
            let query = supabaseClient.from('blacklist').select(`
                *, customers:customer_id (
                    id, customer_id, name, ktp_number, phone, occupation, ktp_address, store_id,
                    stores:store_id (name, code)
                ), blacklisted_by_profile:blacklisted_by (name)
            `).order('blacklisted_at', { ascending: false });
            if (profile?.role !== 'admin' && filterStoreId) query = query.eq('customers.store_id', filterStoreId);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },

        escapePostgRESTValue(str) {
            if (!str) return '';
            return String(str).replace(/[,()\.\[\]]/g, '\\$&');
        },

        async checkDuplicateCustomer(name, ktpNumber, phone, excludeCustomerId = null) {
            const filters = [];
            if (name) filters.push({ column: 'name', value: name });
            if (ktpNumber) filters.push({ column: 'ktp_number', value: ktpNumber });
            if (phone) filters.push({ column: 'phone', value: phone });
            if (filters.length === 0) return null;
            const orConditions = filters.map(f => f.column + '.eq.' + this.escapePostgRESTValue(f.value)).join(',');
            let query = supabaseClient.from('customers').select('id, customer_id, name, ktp_number, phone').or(orConditions);
            if (excludeCustomerId) query = query.neq('id', excludeCustomerId);
            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) return null;
            let bestMatch = data[0];
            for (const customer of data) {
                if (customer.name === name && customer.ktp_number === ktpNumber && customer.phone === phone) {
                    bestMatch = customer; break;
                }
            }
            return { isDuplicate: true, existingCustomer: bestMatch };
        },

        async checkBlacklistDuplicate(ktp, phone) {
            if (!ktp && !phone) return null;
            let query = supabaseClient
                .from('blacklist').select('customers!blacklist_customer_id_fkey(id, name, ktp_number, phone, customer_id)');
            const conditions = [];
            if (ktp) conditions.push(`customers.ktp_number.eq.${ktp}`);
            if (phone) conditions.push(`customers.phone.eq.${phone}`);
            if (conditions.length === 0) return null;
            query = query.or(conditions.join(','));
            const { data, error } = await query;
            if (error || !data || data.length === 0) return null;
            return data[0]?.customers || null;
        },

        async getCustomerOrdersStats(customerId) {
            const { data: orders, error } = await supabaseClient
                .from('orders').select('id, order_id, status, created_at')
                .eq('customer_id', customerId).order('created_at', { ascending: false });
            if (error) throw error;
            let activeCount = 0, completedCount = 0, abnormalCount = 0;
            for (const o of orders || []) {
                if (o.status === 'active') activeCount++;
                else if (o.status === 'completed') completedCount++;
                else if (o.status === 'liquidated') abnormalCount++;
            }
            const { count: overdueCount } = await supabaseClient
                .from('orders').select('id', { count: 'exact', head: true })
                .eq('customer_id', customerId).eq('status', 'active').gte('overdue_days', 30);
            abnormalCount += (overdueCount || 0);
            return { activeCount, completedCount, abnormalCount, orders: orders || [] };
        },

        async getCustomerOrdersByStatus(customerId, statusType) {
            let query = supabaseClient.from('orders').select('*')
                .eq('customer_id', customerId).order('created_at', { ascending: false });
            if (statusType === 'active') query = query.eq('status', 'active');
            else if (statusType === 'completed') query = query.eq('status', 'completed');
            else if (statusType === 'abnormal') query = query.or('status.eq.liquidated,and(status.eq.active,overdue_days.gte.30)');
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },

        calculateNextDueDate(startDate, paidMonths) {
            return Utils.calculateNextDueDate(startDate, paidMonths);
        },

        // ---------- 资金流水 ----------
        async recordCashFlow(flowData) {
            const profile = await this.getCurrentProfile();
            const storeId = flowData.store_id || profile?.store_id;
            if (!storeId) throw new Error(Utils.lang === 'id' ? 'ID toko tidak ditemukan' : '门店ID缺失');
            const record = {
                store_id: storeId,
                flow_type: flowData.flow_type,
                direction: flowData.direction,
                amount: flowData.amount,
                source_target: flowData.source_target,
                order_id: flowData.order_id || null,
                customer_id: flowData.customer_id || null,
                description: flowData.description || '',
                recorded_by: profile?.id,
                recorded_at: Utils.getLocalDateTime(),
                reference_id: flowData.reference_id || null,
                is_voided: false
            };
            console.log("📝 记录资金流水:", record);
            const { data, error } = await supabaseClient.from('cash_flow_records').insert(record).select().single();
            if (error) throw error;
            return data;
        },

        async recordLoanDisbursement(orderId, amount, source, description) {
            const order = await this.getOrder(orderId);
            const { data: existingFlow } = await supabaseClient
                .from('cash_flow_records').select('id').eq('order_id', order.id)
                .eq('flow_type', 'loan_disbursement').eq('is_voided', false).maybeSingle();
            if (existingFlow) throw new Error(Utils.t('loan_already_disbursed'));
            const flowRecord = await this.recordCashFlow({
                store_id: order.store_id,
                flow_type: 'loan_disbursement',
                direction: 'outflow',
                amount: amount,
                source_target: source,
                order_id: order.id,
                customer_id: order.customer_id,
                description: description || (Utils.lang === 'id' ? 'Pencairan gadai' : '当金发放') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            return flowRecord;
        },

        // ===== 新增：记录资本注入 =====
        async recordCapitalInjection(storeId, amount, source, description) {
            const profile = await this.getCurrentProfile();
            const targetStoreId = storeId || profile?.store_id;
            if (!targetStoreId) throw new Error(Utils.lang === 'id' ? 'ID toko tidak ditemukan' : '门店ID缺失');
            if (!amount || amount <= 0) throw new Error(Utils.t('invalid_amount'));

            const { data, error } = await supabaseClient.from('capital_injections').insert({
                store_id: targetStoreId,
                amount: amount,
                source: source || 'cash',
                description: description || (Utils.lang === 'id' ? 'Injeksi modal' : '资本注入'),
                injection_date: Utils.getLocalToday(),
                recorded_by: profile?.id,
                is_voided: false,
                created_at: Utils.getLocalDateTime()
            }).select().single();

            if (error) throw error;

            // 同时记录资金流水（入账）
            await this.recordCashFlow({
                store_id: targetStoreId,
                flow_type: 'capital_injection',
                direction: 'inflow',
                amount: amount,
                source_target: source || 'cash',
                description: description || (Utils.lang === 'id' ? 'Injeksi modal' : '资本注入'),
                reference_id: data.id
            });

            console.log(`✅ 资本注入记录成功: ${Utils.formatCurrency(amount)} -> ${targetStoreId}`);
            return data;
        },

        // ===== 新增：获取资本注入总额（辅助方法） =====
        async getTotalInjectedCapital(storeId) {
            const profile = await this.getCurrentProfile();
            const targetStoreId = storeId || profile?.store_id;

            let query = supabaseClient.from('capital_injections')
                .select('amount')
                .eq('is_voided', false);

            if (profile?.role !== 'admin' && targetStoreId) {
                query = query.eq('store_id', targetStoreId);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('查询资本注入失败:', error);
                return 0;
            }
            return (data || []).reduce((sum, i) => sum + (i.amount || 0), 0);
        },

        // ===== 新增：获取在押资金（active状态的贷款总额） =====
        async getDeployedCapital(storeId) {
            const profile = await this.getCurrentProfile();
            const targetStoreId = storeId || profile?.store_id;

            let query = supabaseClient.from('orders')
                .select('loan_amount')
                .eq('status', 'active');

            if (profile?.role !== 'admin' && targetStoreId) {
                query = query.eq('store_id', targetStoreId);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('查询在押资金失败:', error);
                return 0;
            }
            return (data || []).reduce((sum, o) => sum + (o.loan_amount || 0), 0);
        },

        // ---------- 订单核心操作 ----------
        async getOrders(filters, from, to) {
            if (filters === undefined) filters = {};
            const profile = await this.getCurrentProfile();
            let query = supabaseClient.from('orders').select('*', { count: 'exact' });
            if (profile?.role !== 'admin' && profile?.store_id) {
                query = query.eq('store_id', profile.store_id);
            } else if (profile?.role === 'admin' && !filters.includePractice) {
                const practiceIds = await this._getPracticeStoreIds();
                if (practiceIds.length > 0) query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
            if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
            if (from !== undefined && to !== undefined) query = query.range(from, to);
            query = query.order('created_at', { ascending: false });
            const { data, error, count } = await query;
            if (error) throw error;
            return { data: data || [], totalCount: count || 0 };
        },

        async _getPracticeStoreIds() {
            const stores = await this.getAllStores();
            return stores.filter(s => s.is_practice === true).map(s => s.id);
        },

        async getOrdersLegacy(filters) { const result = await this.getOrders(filters); return result.data; },

        async getOrder(orderId) {
            const { data, error } = await supabaseClient.from('orders').select('*').eq('order_id', orderId).single();
            if (error) throw error;
            const profile = await this.getCurrentProfile();
            if (profile?.role !== 'admin' && profile?.store_id && data.store_id !== profile.store_id) {
                throw new Error(Utils.t('unauthorized'));
            }
            return data;
        },

        async getPaymentHistory(orderId) {
            const order = await this.getOrder(orderId);
            const { data, error } = await supabaseClient
                .from('payment_history').select('*').eq('order_id', order.id).order('date', { ascending: false });
            if (error) throw error;
            return { order, payments: data };
        },

        async createOrder(orderData) {
            const profile = await this.getCurrentProfile();
            const nowDate = Utils.getLocalToday();
            const adminFee = orderData.admin_fee || Utils.calculateAdminFee(orderData.loan_amount);
            const serviceFeePercent = orderData.service_fee_percent !== undefined ? orderData.service_fee_percent : 0;
            const serviceFeeAmount = orderData.service_fee_amount || 0;
            const agreedInterestRate = (orderData.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT) / 100;
            const repaymentType = orderData.repayment_type || 'flexible';
            const repaymentTerm = orderData.repayment_term || null;
            const targetStoreId = orderData.store_id || profile.store_id;
            if (profile.role === 'admin' && !orderData.store_id) throw new Error(Utils.t('store_operation'));
            if (!targetStoreId) throw new Error(Utils.lang === 'id' ? 'Toko tidak ditemukan' : '未找到门店');

            let retryCount = 0, lastError = null, newOrder = null;
            while (retryCount < 5) {
                try {
                    const orderId = await this._generateOrderId(profile.role, targetStoreId, 5);
                    let monthlyFixedPayment = null;
                    if (repaymentType === 'fixed' && repaymentTerm && repaymentTerm > 0) {
                        if (orderData.monthly_fixed_payment) {
                            monthlyFixedPayment = orderData.monthly_fixed_payment;
                        } else {
                            const calculated = Utils.calculateFixedMonthlyPayment(orderData.loan_amount, agreedInterestRate, repaymentTerm);
                            monthlyFixedPayment = Utils.roundMonthlyPayment(calculated);
                        }
                    }
                    const monthlyInterest = orderData.loan_amount * agreedInterestRate;
                    const nextDueDate = this.calculateNextDueDate(nowDate, 0);
                    const newOrderData = {
                        order_id: orderId,
                        customer_name: orderData.customer_name,
                        customer_ktp: orderData.customer_ktp,
                        customer_phone: orderData.customer_phone,
                        customer_address: orderData.customer_address || '',
                        collateral_name: orderData.collateral_name,
                        loan_amount: orderData.loan_amount,
                        admin_fee: adminFee,
                        admin_fee_paid: false,
                        service_fee_percent: serviceFeePercent,
                        service_fee_amount: serviceFeeAmount,
                        service_fee_paid: 0,
                        monthly_interest: monthlyInterest,
                        interest_paid_months: 0,
                        interest_paid_total: 0,
                        next_interest_due_date: nextDueDate,
                        principal_paid: 0,
                        principal_remaining: orderData.loan_amount,
                        status: 'active',
                        store_id: targetStoreId,
                        created_by: profile.id,
                        notes: orderData.notes || '',
                        customer_id: orderData.customer_id || null,
                        is_locked: true,
                        locked_at: Utils.getLocalDateTime(),
                        locked_by: profile.id,
                        repayment_type: repaymentType,
                        repayment_term: repaymentTerm,
                        monthly_fixed_payment: monthlyFixedPayment,
                        agreed_interest_rate: agreedInterestRate,
                        agreed_service_fee_rate: serviceFeePercent / 100,
                        fixed_paid_months: 0,
                        overdue_days: 0,
                        liquidation_status: 'normal',
                        max_extension_months: orderData.max_extension_months || 10,
                        fund_status: 'deployed',  // ===== 新增：放款时标记为在押 =====
                        created_at: Utils.getLocalDateTime(),
                        updated_at: Utils.getLocalDateTime()
                    };
                    const { data, error } = await supabaseClient.from('orders').insert(newOrderData).select().single();
                    if (error) {
                        if (error.code === '23505') {
                            console.warn(`订单ID冲突: ${orderId}, 重试第 ${retryCount + 1} 次`);
                            retryCount++; lastError = error;
                            await new Promise(r => setTimeout(r, 100 * (retryCount + 1)));
                            continue;
                        }
                        throw error;
                    }
                    newOrder = data;
                    console.log('✅ 订单创建成功: ' + orderId + ' (还款方式: ' + repaymentType + ', 资金状态: deployed)');
                    break;
                } catch (err) {
                    if (err.code === '23505' && retryCount < 4) {
                        retryCount++;
                        await new Promise(r => setTimeout(r, 100 * (retryCount + 1)));
                        continue;
                    }
                    throw err;
                }
            }
            if (!newOrder) throw lastError || new Error(Utils.lang === 'id' ? 'Gagal membuat pesanan' : '创建订单失败');
            if (window.Audit) await window.Audit.logOrderCreate(newOrder.order_id, orderData.customer_name, orderData.loan_amount);
            return newOrder;
        },

        async recordAdminFee(orderId, paymentMethod, adminFeeAmount) {
            if (paymentMethod === undefined) paymentMethod = 'cash';
            const order = await this.getOrder(orderId);
            const profile = await this.getCurrentProfile();
            const feeAmount = adminFeeAmount || order.admin_fee;
            const { error: e1 } = await supabaseClient.from('orders').update({
                admin_fee_paid: true,
                admin_fee_paid_date: Utils.getLocalToday(),
                admin_fee: feeAmount,
                updated_at: Utils.getLocalDateTime()
            }).eq('order_id', orderId);
            if (e1) throw e1;
            const paymentData = {
                order_id: order.id,
                date: Utils.getLocalToday(),
                type: 'admin_fee',
                amount: feeAmount,
                description: Utils.t('admin_fee'),
                recorded_by: profile.id,
                payment_method: paymentMethod
            };
            const { error: e2 } = await supabaseClient.from('payment_history').insert(paymentData);
            if (e2) throw e2;
            await this.recordCashFlow({
                store_id: order.store_id, flow_type: 'admin_fee', direction: 'inflow',
                amount: feeAmount, source_target: paymentMethod, order_id: order.id,
                customer_id: order.customer_id,
                description: Utils.t('admin_fee') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            if (window.Audit) await window.Audit.logPayment(order.order_id, 'admin_fee', feeAmount, paymentMethod);
            return true;
        },

        async recordServiceFee(orderId, months, paymentMethod) {
            if (paymentMethod === undefined) paymentMethod = 'cash';
            const order = await this.getOrder(orderId);
            const profile = await this.getCurrentProfile();
            if (order.service_fee_percent <= 0 && order.service_fee_amount <= 0) return true;
            if (order.service_fee_paid > 0) return true;
            const totalServiceFee = order.service_fee_amount || 0;
            if (totalServiceFee <= 0) return true;
            const { error: e1 } = await supabaseClient.from('orders').update({
                service_fee_paid: totalServiceFee,
                updated_at: Utils.getLocalDateTime()
            }).eq('order_id', orderId);
            if (e1) throw e1;
            const paymentData = {
                order_id: order.id, date: Utils.getLocalToday(), type: 'service_fee',
                months: 1, amount: totalServiceFee, description: Utils.t('service_fee'),
                recorded_by: profile.id, payment_method: paymentMethod
            };
            const { error: e2 } = await supabaseClient.from('payment_history').insert(paymentData);
            if (e2) throw e2;
            await this.recordCashFlow({
                store_id: order.store_id, flow_type: 'service_fee', direction: 'inflow',
                amount: totalServiceFee, source_target: paymentMethod, order_id: order.id,
                customer_id: order.customer_id,
                description: Utils.t('service_fee') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            if (window.Audit) await window.Audit.logPayment(order.order_id, 'service_fee', totalServiceFee, paymentMethod);
            return true;
        },

        async recordInterestPayment(orderId, months, paymentMethod) {
            if (paymentMethod === undefined) paymentMethod = 'cash';
            const profile = await this.getCurrentProfile();
            const currentOrder = await this.getOrder(orderId);
            if (currentOrder.status === 'completed') throw new Error(Utils.t('order_completed'));

            const lockKey = orderId + '_interest_supabase';
            if (window.APP && window.APP._acquirePaymentLock) {
                if (!window.APP._acquirePaymentLock(lockKey)) {
                    throw new Error(Utils.lang === 'id' ? '⏳ Pembayaran sedang diproses, harap tunggu...' : '⏳ 支付正在处理中，请稍候...');
                }
            }
            try {
                const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
                const loanAmount = currentOrder.loan_amount || 0;
                const principalPaid = currentOrder.principal_paid || 0;
                const remainingPrincipal = loanAmount - principalPaid;
                const totalInterest = remainingPrincipal * monthlyRate * months;
                const newInterestPaidMonths = (currentOrder.interest_paid_months || 0) + months;
                const newInterestPaidTotal = (currentOrder.interest_paid_total || 0) + totalInterest;
                const maxMonths = currentOrder.max_extension_months || 10;
                if (newInterestPaidMonths > maxMonths) {
                    throw new Error(Utils.lang === 'id' ? '❌ Mencapai batas maksimum perpanjangan (' + maxMonths + ' bulan), harap lunasi pokok segera' : '❌ 已达到最大延期期限 (' + maxMonths + '个月)，请尽快结清本金');
                }
                const originalOrderState = {
                    interest_paid_months: currentOrder.interest_paid_months,
                    interest_paid_total: currentOrder.interest_paid_total,
                    next_interest_due_date: currentOrder.next_interest_due_date,
                    monthly_interest: currentOrder.monthly_interest,
                    updated_at: currentOrder.updated_at
                };
                const nextDueDate = this.calculateNextDueDate(currentOrder.created_at, newInterestPaidMonths);
                const { error: updateError } = await supabaseClient.from('orders').update({
                    interest_paid_months: newInterestPaidMonths,
                    interest_paid_total: newInterestPaidTotal,
                    next_interest_due_date: nextDueDate,
                    monthly_interest: monthlyInterest,
                    fund_status: 'extended',  // ===== 新增：续当时标记 =====
                    updated_at: Utils.getLocalDateTime()
                }).eq('order_id', orderId);
                if (updateError) throw updateError;
                const paymentData = {
                    order_id: currentOrder.id,
                    date: Utils.getLocalToday(),
                    type: 'interest',
                    months: months,
                    amount: totalInterest,
                    description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang === 'id' ? 'bulan' : '个月') + ' (' + (monthlyRate*100).toFixed(1) + '%)',
                    recorded_by: profile.id,
                    payment_method: paymentMethod
                };
                const { error: paymentError } = await supabaseClient.from('payment_history').insert(paymentData);
                if (paymentError) {
                    await supabaseClient.from('orders').update(originalOrderState).eq('order_id', orderId);
                    throw paymentError;
                }
                await this.recordCashFlow({
                    store_id: currentOrder.store_id, flow_type: 'interest', direction: 'inflow',
                    amount: totalInterest, source_target: paymentMethod, order_id: currentOrder.id,
                    customer_id: currentOrder.customer_id,
                    description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang === 'id' ? 'bulan' : '个月') + ' (' + (monthlyRate*100).toFixed(1) + '%)',
                    reference_id: currentOrder.order_id
                });
                if (window.Audit) await window.Audit.logPayment(currentOrder.order_id, 'interest', totalInterest, paymentMethod);
                return true;
            } finally {
                if (window.APP && window.APP._releasePaymentLock) window.APP._releasePaymentLock(lockKey);
            }
        },

        async recordPrincipalPayment(orderId, amount, paymentMethod) {
            if (paymentMethod === undefined) paymentMethod = 'cash';
            const profile = await this.getCurrentProfile();
            const currentOrder = await this.getOrder(orderId);
            if (currentOrder.status === 'completed') throw new Error(Utils.t('order_completed'));
            const loanAmount = currentOrder.loan_amount || 0;
            const principalPaid = currentOrder.principal_paid || 0;
            const remainingPrincipal = loanAmount - principalPaid;
            if (remainingPrincipal <= 0) throw new Error(Utils.lang === 'id' ? '❌ Pokok sudah lunas' : '❌ 本金已结清');
            let paidAmount = Math.min(amount, remainingPrincipal);
            if (paidAmount <= 0) throw new Error(Utils.t('invalid_amount'));
            const newPrincipalPaid = principalPaid + paidAmount;
            const newPrincipalRemaining = loanAmount - newPrincipalPaid;
            const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            let updates = {
                principal_paid: newPrincipalPaid,
                principal_remaining: newPrincipalRemaining,
                updated_at: Utils.getLocalDateTime()
            };
            const isFullRepayment = newPrincipalRemaining <= 0;
            if (isFullRepayment) {
                updates.status = 'completed';
                updates.monthly_interest = 0;
                updates.fund_status = 'returned';  // ===== 新增：全额结清时标记为回笼 =====
                updates.completed_at = Utils.getLocalDateTime();
            } else {
                updates.monthly_interest = newPrincipalRemaining * monthlyRate;
            }
            const { error: updateError } = await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
            if (updateError) throw updateError;
            const paymentData = {
                order_id: currentOrder.id,
                date: Utils.getLocalToday(),
                type: 'principal',
                amount: paidAmount,
                description: isFullRepayment ? (Utils.lang === 'id' ? 'LUNAS' : '结清') : (Utils.lang === 'id' ? 'Pembayaran pokok' : '还款'),
                recorded_by: profile.id,
                payment_method: paymentMethod
            };
            const { error: paymentError } = await supabaseClient.from('payment_history').insert(paymentData);
            if (paymentError) throw paymentError;
            await this.recordCashFlow({
                store_id: currentOrder.store_id, flow_type: 'principal', direction: 'inflow',
                amount: paidAmount, source_target: paymentMethod, order_id: currentOrder.id,
                customer_id: currentOrder.customer_id,
                description: isFullRepayment ? (Utils.lang === 'id' ? 'LUNAS' : '结清') : (Utils.lang === 'id' ? 'Pembayaran pokok' : '还款'),
                reference_id: currentOrder.order_id
            });
            if (window.Audit) await window.Audit.logPayment(currentOrder.order_id, 'principal', paidAmount, paymentMethod);
            return true;
        },

        async recordFixedPayment(orderId, paymentMethod) {
            if (paymentMethod === undefined) paymentMethod = 'cash';
            const profile = await this.getCurrentProfile();
            const order = await this.getOrder(orderId);
            if (order.status === 'completed') throw new Error(Utils.t('order_completed'));
            if (order.repayment_type !== 'fixed') throw new Error(Utils.lang === 'id' ? '❌ Pesanan ini bukan cicilan tetap' : '❌ 此订单不是固定还款模式');
            const fixedPayment = order.monthly_fixed_payment;
            const paidMonths = order.fixed_paid_months || 0;
            const remainingMonths = order.repayment_term - paidMonths;
            if (remainingMonths <= 0) throw new Error(Utils.lang === 'id' ? '❌ Pesanan sudah lunas' : '❌ 订单已结清');
            if (fixedPayment <= 0) throw new Error(Utils.lang === 'id' ? '❌ Jumlah angsuran tidak valid' : '❌ 还款金额无效');
            const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            const remainingPrincipal = order.principal_remaining;
            const interestAmount = remainingPrincipal * monthlyRate;
            let principalAmount = fixedPayment - interestAmount;
            if (principalAmount < 0) principalAmount = 0;
            const actualPrincipalPaid = (order.principal_paid || 0) + principalAmount;
            const actualPrincipalRemaining = order.loan_amount - actualPrincipalPaid;
            const newFixedPaidMonths = paidMonths + 1;
            const isCompleted = newFixedPaidMonths >= order.repayment_term || actualPrincipalRemaining <= 0;
            const newMonthlyInterest = actualPrincipalRemaining * monthlyRate;
            const nextDueDate = this.calculateNextDueDate(order.created_at, newFixedPaidMonths);
            const updates = {
                principal_paid: actualPrincipalPaid,
                principal_remaining: actualPrincipalRemaining,
                fixed_paid_months: newFixedPaidMonths,
                monthly_interest: newMonthlyInterest,
                interest_paid_months: (order.interest_paid_months || 0) + 1,
                interest_paid_total: (order.interest_paid_total || 0) + interestAmount,
                next_interest_due_date: nextDueDate,
                updated_at: Utils.getLocalDateTime()
            };
            if (isCompleted) {
                updates.status = 'completed';
                updates.fund_status = 'returned';  // ===== 新增：固定还款结清时标记为回笼 =====
                updates.completed_at = Utils.getLocalDateTime();
            }
            const { error: updateError } = await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
            if (updateError) throw updateError;
            if (interestAmount > 0) {
                await supabaseClient.from('payment_history').insert({
                    order_id: order.id, date: Utils.getLocalToday(), type: 'interest', months: 1,
                    amount: interestAmount, description: (Utils.lang === 'id' ? 'Cicilan tetap - Bunga' : '固定还款-利息') + ' ' + newFixedPaidMonths,
                    recorded_by: profile.id, payment_method: paymentMethod
                });
                await this.recordCashFlow({
                    store_id: order.store_id, flow_type: 'interest', direction: 'inflow',
                    amount: interestAmount, source_target: paymentMethod, order_id: order.id,
                    customer_id: order.customer_id, description: (Utils.lang === 'id' ? 'Cicilan tetap bunga' : '固定还款利息') + ' - ' + order.order_id + ' ' + (Utils.lang === 'id' ? 'ke' : '第') + newFixedPaidMonths,
                    reference_id: order.order_id
                });
            }
            if (principalAmount > 0) {
                await supabaseClient.from('payment_history').insert({
                    order_id: order.id, date: Utils.getLocalToday(), type: 'principal',
                    amount: principalAmount, description: (Utils.lang === 'id' ? 'Cicilan tetap - Pokok' : '固定还款-本金') + ' ' + newFixedPaidMonths,
                    recorded_by: profile.id, payment_method: paymentMethod
                });
                await this.recordCashFlow({
                    store_id: order.store_id, flow_type: 'principal', direction: 'inflow',
                    amount: principalAmount, source_target: paymentMethod, order_id: order.id,
                    customer_id: order.customer_id, description: (Utils.lang === 'id' ? 'Cicilan tetap pokok' : '固定还款本金') + ' - ' + order.order_id + ' ' + (Utils.lang === 'id' ? 'ke' : '第') + newFixedPaidMonths,
                    reference_id: order.order_id
                });
            }
            if (window.Audit) await window.Audit.logPayment(order.order_id, 'fixed_installment', fixedPayment, paymentMethod);
            return true;
        },

        async earlySettleFixedOrder(orderId, paymentMethod) {
            if (paymentMethod === undefined) paymentMethod = 'cash';
            const profile = await this.getCurrentProfile();
            const order = await this.getOrder(orderId);
            if (order.status === 'completed') throw new Error(Utils.t('order_completed'));
            if (order.repayment_type !== 'fixed') throw new Error(Utils.lang === 'id' ? '❌ Pesanan ini bukan cicilan tetap' : '❌ 此订单不是固定还款模式');
            const paidMonths = order.fixed_paid_months || 0;
            const remainingPrincipal = order.principal_remaining;
            const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            const remainingMonths = order.repayment_term - paidMonths;
            const settlementAmount = remainingPrincipal;
            const savedInterest = remainingPrincipal * monthlyRate * remainingMonths;
            const confirmMsg = Utils.lang === 'id'
                ? '⚠️ Konfirmasi Pelunasan Dipercepat\n\nPesanan: ' + order.order_id + '\nNasabah: ' + order.customer_name + '\nAngsuran terbayar: ' + paidMonths + '/' + order.repayment_term + '\nSisa Pokok: ' + Utils.formatCurrency(remainingPrincipal) + '\nBunga yang dihemat: ' + Utils.formatCurrency(savedInterest) + '\nJumlah Pelunasan: ' + Utils.formatCurrency(settlementAmount) + '\n\nLanjutkan?'
                : '⚠️ 提前结清确认\n\n订单号: ' + order.order_id + '\n客户: ' + order.customer_name + '\n已还期数: ' + paidMonths + '/' + order.repayment_term + '\n剩余本金: ' + Utils.formatCurrency(remainingPrincipal) + '\n减免利息: ' + Utils.formatCurrency(savedInterest) + '\n结清金额: ' + Utils.formatCurrency(settlementAmount) + '\n\n确认结清？';
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return false;
            await supabaseClient.from('payment_history').insert({
                order_id: order.id, date: Utils.getLocalToday(), type: 'principal',
                amount: settlementAmount, description: Utils.lang === 'id' ? 'Pelunasan dipercepat - hemat bunga' : '提前结清 - 减免剩余利息',
                recorded_by: profile.id, payment_method: paymentMethod
            });
            await this.recordCashFlow({
                store_id: order.store_id, flow_type: 'principal', direction: 'inflow',
                amount: settlementAmount, source_target: paymentMethod, order_id: order.id,
                customer_id: order.customer_id, description: (Utils.lang === 'id' ? 'Pelunasan dipercepat' : '提前结清') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            const { error } = await supabaseClient.from('orders').update({
                status: 'completed',
                principal_paid: order.loan_amount,
                principal_remaining: 0,
                fund_status: 'returned',  // ===== 新增：提前结清标记为回笼 =====
                completed_at: Utils.getLocalDateTime(),
                updated_at: Utils.getLocalDateTime()
            }).eq('order_id', orderId);
            if (error) throw error;
            if (window.Audit) await window.Audit.logPayment(order.order_id, 'early_settlement', settlementAmount, paymentMethod);
            Utils.toast.success(Utils.lang === 'id' ? '✅ Pelunasan dipercepat berhasil!\nJumlah: ' + Utils.formatCurrency(settlementAmount) : '✅ 提前结清成功！\n结清金额: ' + Utils.formatCurrency(settlementAmount));
            return true;
        },

        async updateOverdueDays() {
            const { data: activeOrders, error } = await supabaseClient.from('orders').select('*').eq('status', 'active');
            if (error) throw error;
            const todayLocal = new Date(); todayLocal.setHours(0, 0, 0, 0);
            for (const order of activeOrders) {
                const dueDate = order.next_interest_due_date;
                if (!dueDate) continue;
                const due = new Date(dueDate); due.setHours(0, 0, 0, 0);
                let overdueDays = 0;
                if (todayLocal > due) overdueDays = Math.floor((todayLocal - due) / 86400000);
                let liquidationStatus = order.liquidation_status || 'normal';
                let fundStatusUpdate = {};
                if (overdueDays >= 30) {
                    liquidationStatus = 'liquidated';
                    fundStatusUpdate.fund_status = 'forfeited';  // ===== 新增：流当时标记 =====
                } else if (overdueDays >= 15) {
                    liquidationStatus = 'warning';
                } else {
                    liquidationStatus = 'normal';
                }
                if (overdueDays !== order.overdue_days || liquidationStatus !== order.liquidation_status) {
                    await supabaseClient.from('orders').update({
                        overdue_days: overdueDays,
                        liquidation_status: liquidationStatus,
                        ...fundStatusUpdate,
                        updated_at: Utils.getLocalDateTime()
                    }).eq('id', order.id);
                }
            }
            return true;
        },

        async updateOrder(orderId, updateData, customerId) {
            const currentOrder = await this.getOrder(orderId);
            const sensitiveFields = ['customer_name','customer_ktp','customer_phone','customer_address','collateral_name','loan_amount','admin_fee','service_fee_percent'];
            let isUpdatingSensitive = false;
            for (const f of sensitiveFields) { if (updateData.hasOwnProperty(f)) { isUpdatingSensitive = true; break; } }
            if (currentOrder.is_locked && isUpdatingSensitive) throw new Error(Utils.t('order_locked'));
            updateData.updated_at = Utils.getLocalDateTime();
            const { data, error } = await supabaseClient.from('orders').update(updateData).eq('order_id', orderId).select().single();
            if (error) throw error;
            if (customerId && (updateData.customer_name || updateData.customer_phone || updateData.customer_ktp)) {
                const customerUpdate = {};
                if (updateData.customer_name) customerUpdate.name = updateData.customer_name;
                if (updateData.customer_phone) customerUpdate.phone = updateData.customer_phone;
                if (updateData.customer_ktp) customerUpdate.ktp_number = updateData.customer_ktp;
                if (updateData.customer_address) { customerUpdate.ktp_address = updateData.customer_address; customerUpdate.address = updateData.customer_address; }
                if (Object.keys(customerUpdate).length > 0) {
                    await supabaseClient.from('customers').update(customerUpdate).eq('id', customerId);
                }
            }
            return data;
        },

        async unlockOrder(orderId) {
            const profile = await this.getCurrentProfile();
            if (profile?.role !== 'admin') throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat membuka kunci' : '需管理员权限');
            const { error } = await supabaseClient.from('orders').update({ is_locked: false, locked_at: null, locked_by: null, updated_at: Utils.getLocalDateTime() }).eq('order_id', orderId);
            if (error) throw error;
            return true;
        },

        async relockOrder(orderId) {
            const profile = await this.getCurrentProfile();
            const { error } = await supabaseClient.from('orders').update({ is_locked: true, locked_at: Utils.getLocalDateTime(), locked_by: profile.id, updated_at: Utils.getLocalDateTime() }).eq('order_id', orderId);
            if (error) throw error;
            return true;
        },

        async deleteOrder(orderId) {
            const profile = await this.getCurrentProfile();
            if (profile?.role !== 'admin') throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat menghapus pesanan' : '需管理员权限');
            const order = await this.getOrder(orderId);
            await supabaseClient.from('cash_flow_records').delete().eq('order_id', order.id);
            const { error: e1 } = await supabaseClient.from('payment_history').delete().eq('order_id', order.id);
            if (e1) throw e1;
            const { error: e2 } = await supabaseClient.from('orders').delete().eq('order_id', orderId);
            if (e2) throw e2;
            if (window.Audit) await window.Audit.logOrderDelete(order.order_id, order.customer_name, order.loan_amount, profile?.name);
            return true;
        },

        async getReport() {
            const orders = await this.getOrdersLegacy();
            let totalLoanAmount = 0, totalAdminFees = 0, totalServiceFees = 0, totalInterest = 0, totalPrincipal = 0, activeCount = 0;
            for (const o of orders) {
                totalLoanAmount += (o.loan_amount || 0);
                if (o.admin_fee_paid) totalAdminFees += (o.admin_fee || 0);
                totalServiceFees += (o.service_fee_paid || 0);
                totalInterest += (o.interest_paid_total || 0);
                totalPrincipal += (o.principal_paid || 0);
                if (o.status === 'active') activeCount++;
            }
            return {
                total_orders: orders.length,
                active_orders: activeCount,
                completed_orders: orders.length - activeCount,
                total_loan_amount: totalLoanAmount,
                total_admin_fees: totalAdminFees,
                total_service_fees: totalServiceFees,
                total_interest: totalInterest,
                total_principal: totalPrincipal
            };
        },

        async getAllPayments() {
            const profile = await this.getCurrentProfile();
            let orderQuery = supabaseClient.from('orders').select('id, order_id, customer_name');
            if (profile?.role !== 'admin' && profile?.store_id) orderQuery = orderQuery.eq('store_id', profile.store_id);
            const { data: accessibleOrders, error: orderError } = await orderQuery;
            if (orderError) return [];
            const accessibleOrderIds = accessibleOrders.map(o => o.id);
            if (accessibleOrderIds.length === 0) return [];
            const { data: payments, error: payError } = await supabaseClient
                .from('payment_history').select('*').in('order_id', accessibleOrderIds).order('date', { ascending: false });
            if (payError) throw payError;
            const orderMap = {};
            for (const o of accessibleOrders) orderMap[o.id] = o;
            return payments.map(p => ({ ...p, orders: orderMap[p.order_id] || null }));
        },

        async getAllUsers() {
            const { data, error } = await supabaseClient.from('user_profiles').select('*, stores(*)').order('name');
            if (error) throw error;
            return data;
        },

        async createStore(code, name, address, phone) {
            const { data, error } = await supabaseClient.from('stores').insert({ code, name, address, phone }).select().single();
            if (error) throw error;
            if (window.Audit) await window.Audit.logStoreCreate(code, name, AUTH.user?.id);
            return data;
        },

        async updateStore(id, updates) {
            const { data, error } = await supabaseClient.from('stores').update(updates).eq('id', id).select().single();
            if (error) throw error;
            if (window.Audit) await window.Audit.logStoreAction(id, 'update', JSON.stringify(updates));
            return data;
        },

        async deleteStore(id) {
            const { data: orders, error: ordersError } = await supabaseClient.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', id);
            if (ordersError) throw ordersError;
            if (orders && orders.length > 0) throw new Error(Utils.lang === 'id' ? 'Toko memiliki pesanan, tidak dapat dihapus' : '门店有订单，无法删除');
            const { error } = await supabaseClient.from('stores').delete().eq('id', id);
            if (error) throw error;
            if (window.Audit) await window.Audit.logStoreAction(id, 'delete', '');
            return true;
        },

        async getCashFlowRecords(storeId, startDate, endDate) {
            const profile = await this.getCurrentProfile();
            const targetStoreId = storeId || profile?.store_id;
            if (!targetStoreId && profile?.role !== 'admin') throw new Error('Unauthorized');
            let query = supabaseClient.from('cash_flow_records').select('*').eq('is_voided', false).order('recorded_at', { ascending: false });
            if (profile?.role !== 'admin' && targetStoreId) query = query.eq('store_id', targetStoreId);
            else if (profile?.role === 'admin' && storeId) query = query.eq('store_id', storeId);
            if (startDate) query = query.gte('recorded_at', startDate);
            if (endDate) query = query.lte('recorded_at', endDate);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },

        // ===== 修改：getCashFlowSummary() 增加资金池三个指标 =====
        async getCashFlowSummary() {
            const profile = await this.getCurrentProfile();
            let query = supabaseClient.from('cash_flow_records').select('direction, amount, source_target, flow_type, store_id').eq('is_voided', false);
            if (profile?.role !== 'admin' && profile?.store_id) {
                query = query.eq('store_id', profile.store_id);
            } else if (profile?.role === 'admin') {
                const practiceIds = await this._getPracticeStoreIds();
                if (practiceIds.length > 0) query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
            const { data: flows, error } = await query;
            if (error) throw error;

            let cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0, operatingIncome = 0, operatingExpense = 0;
            for (const flow of (flows || [])) {
                const amt = flow.amount || 0;
                if (flow.direction === 'inflow') {
                    if (flow.source_target === 'cash') cashIn += amt;
                    else if (flow.source_target === 'bank') bankIn += amt;
                } else {
                    if (flow.source_target === 'cash') cashOut += amt;
                    else if (flow.source_target === 'bank') bankOut += amt;
                }
                if (flow.flow_type === 'expense') operatingExpense += amt;
                else if (flow.flow_type === 'admin_fee' || flow.flow_type === 'service_fee' || flow.flow_type === 'interest') operatingIncome += amt;
            }

            // ===== 新增：查询总投入资本 =====
            let injectionQuery = supabaseClient.from('capital_injections')
                .select('amount')
                .eq('is_voided', false);
            if (profile?.role !== 'admin' && profile?.store_id) {
                injectionQuery = injectionQuery.eq('store_id', profile.store_id);
            }
            const { data: injections } = await injectionQuery;
            const totalInjectedCapital = (injections || []).reduce((sum, i) => sum + (i.amount || 0), 0);

            // ===== 新增：查询在押资金 =====
            let deployedQuery = supabaseClient.from('orders')
                .select('loan_amount')
                .eq('status', 'active');
            if (profile?.role !== 'admin' && profile?.store_id) {
                deployedQuery = deployedQuery.eq('store_id', profile.store_id);
            }
            const { data: deployedOrders } = await deployedQuery;
            const deployedCapital = (deployedOrders || []).reduce((sum, o) => sum + (o.loan_amount || 0), 0);

            // ===== 新增：计算可动用资金 =====
            const availableCapital = totalInjectedCapital - deployedCapital;

            return {
                cash: { income: cashIn, expense: cashOut, netIncome: cashIn - cashOut, balance: cashIn - cashOut },
                bank: { income: bankIn, expense: bankOut, netIncome: bankIn - bankOut, balance: bankIn - bankOut },
                total: { income: cashIn + bankIn, expense: cashOut + bankOut, netIncome: (cashIn + bankIn) - (cashOut + bankOut), balance: (cashIn - cashOut) + (bankIn - bankOut) },
                netProfit: { balance: operatingIncome - operatingExpense, operatingIncome, operatingExpense },
                // ===== 新增：资金池三个指标 =====
                total_injected_capital: totalInjectedCapital,
                deployed_capital: deployedCapital,
                available_capital: availableCapital
            };
        },

        async addExpense(expenseData) {
            const profile = await this.getCurrentProfile();
            const { data, error } = await supabaseClient.from('expenses').insert({
                store_id: expenseData.store_id || profile?.store_id,
                expense_date: expenseData.expense_date || Utils.getLocalToday(),
                category: expenseData.category,
                amount: expenseData.amount,
                description: expenseData.description || null,
                payment_method: expenseData.payment_method,
                created_by: profile?.id,
                is_locked: true,
                is_reconciled: false,
                created_at: Utils.getLocalDateTime(),
                updated_at: Utils.getLocalDateTime()
            }).select().single();
            if (error) throw error;
            await this.recordCashFlow({
                store_id: expenseData.store_id || profile?.store_id,
                flow_type: 'expense',
                direction: 'outflow',
                amount: expenseData.amount,
                source_target: expenseData.payment_method,
                description: expenseData.category,
                reference_id: data.id
            });
            return data;
        },

        async getStoreWANumber(storeId) {
            const { data, error } = await supabaseClient.from('stores').select('wa_number').eq('id', storeId).single();
            if (error && error.code !== 'PGRST116') return null;
            return data?.wa_number || null;
        },

        async updateStoreWANumber(storeId, waNumber) {
            const { error } = await supabaseClient.from('stores').update({ wa_number: waNumber || null, updated_at: Utils.getLocalDateTime() }).eq('id', storeId);
            if (error) throw error;
            return true;
        },

        async hasReminderSentToday(orderId) {
            const today = Utils.getLocalToday();
            const { data, error } = await supabaseClient.from('reminder_logs').select('id').eq('order_id', orderId).eq('reminder_date', today).maybeSingle();
            if (error) throw error;
            return !!data;
        },

        async hasSentRemindersToday() {
            try {
                const today = Utils.getLocalToday();
                const { data, error } = await supabaseClient.from('reminder_logs').select('id', { count: 'exact' }).eq('reminder_date', today);
                if (error) return false;
                return (data?.length || 0) > 0;
            } catch (e) { return false; }
        },

        async logReminder(orderId) {
            const profile = await this.getCurrentProfile();
            const today = Utils.getLocalToday();
            const { error } = await supabaseClient.from('reminder_logs').insert({ order_id: orderId, reminder_date: today, sent_by: profile?.id || null, created_at: Utils.getLocalDateTime() });
            if (error) throw error;
            return true;
        },

        async getOrdersNeedReminder() {
            const profile = await this.getCurrentProfile();
            const reminderDays = 2;
            let query = supabaseClient.from('orders').select('*').eq('status', 'active');
            if (profile?.role !== 'admin' && profile?.store_id) query = query.eq('store_id', profile.store_id);
            const { data: orders, error } = await query;
            if (error) throw error;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const needRemind = [];
            for (const order of (orders || [])) {
                if (!order.next_interest_due_date) continue;
                const due = new Date(order.next_interest_due_date); due.setHours(0, 0, 0, 0);
                const daysUntilDue = Math.ceil((due - today) / 86400000);
                if (daysUntilDue === reminderDays) {
                    const alreadySent = await this.hasReminderSentToday(order.id);
                    if (!alreadySent) needRemind.push(order);
                }
            }
            return needRemind;
        },

        async getStoreName(storeId) {
            const { data, error } = await supabaseClient.from('stores').select('name').eq('id', storeId).single();
            if (error) return '-';
            return data?.name || '-';
        },

        async recordInternalTransfer(transferData) {
            const profile = await this.getCurrentProfile();
            if (transferData.amount <= 0) throw new Error(Utils.t('invalid_amount'));
            if (transferData.transfer_type === 'cash_to_bank') {
                const cf = await this.getCashFlowSummary();
                if (cf.cash.balance < transferData.amount) throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            } else if (transferData.transfer_type === 'bank_to_cash') {
                const cf = await this.getCashFlowSummary();
                if (cf.bank.balance < transferData.amount) throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            } else if (transferData.transfer_type === 'store_to_hq') {
                const shop = await this.getShopAccount(transferData.store_id || profile?.store_id);
                if (shop.bank_balance < transferData.amount) throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            }
            const { data, error } = await supabaseClient.from('internal_transfers').insert({
                transfer_date: transferData.transfer_date || Utils.getLocalToday(),
                transfer_type: transferData.transfer_type,
                from_account: transferData.from_account,
                to_account: transferData.to_account,
                amount: transferData.amount,
                description: transferData.description || '',
                store_id: transferData.store_id || profile?.store_id,
                created_by: profile?.id,
                created_at: Utils.getLocalDateTime()
            }).select().single();
            if (error) throw error;
            await this.recordCashFlow({
                store_id: transferData.store_id || profile?.store_id,
                flow_type: 'internal_transfer_out', direction: 'outflow',
                amount: transferData.amount,
                source_target: transferData.from_account === 'hq' ? 'bank' : transferData.from_account,
                description: Utils.lang === 'id' ? 'Transfer keluar' : '转出',
                reference_id: data.id
            });
            if (transferData.to_account !== 'hq') {
                await this.recordCashFlow({
                    store_id: transferData.store_id || profile?.store_id,
                    flow_type: 'internal_transfer_in', direction: 'inflow',
                    amount: transferData.amount,
                    source_target: transferData.to_account,
                    description: Utils.lang === 'id' ? 'Transfer masuk' : '转入',
                    reference_id: data.id
                });
            }
            return data;
        },

        async getInternalTransfers(storeId, startDate, endDate) {
            const profile = await this.getCurrentProfile();
            let query = supabaseClient.from('internal_transfers')
                .select('*, stores(name, code), created_by_profile:user_profiles!internal_transfers_created_by_fkey(name)')
                .order('transfer_date', { ascending: false });
            if (profile?.role !== 'admin' && profile?.store_id) query = query.eq('store_id', profile.store_id);
            else if (profile?.role === 'admin' && storeId && storeId !== 'all') query = query.eq('store_id', storeId);
            if (startDate) query = query.gte('transfer_date', startDate);
            if (endDate) query = query.lte('transfer_date', endDate);
            const { data, error } = await query;
            if (error) throw error;
            return data;
        },

        async getShopAccount(storeId) {
            const targetStoreId = storeId || await this.getCurrentStoreId();
            if (!targetStoreId) return { cash_balance: 0, bank_balance: 0, total_balance: 0 };
            const { data: flows, error } = await supabaseClient
                .from('cash_flow_records').select('direction, amount, source_target')
                .eq('store_id', targetStoreId).eq('is_voided', false);
            if (error) return { cash_balance: 0, bank_balance: 0, total_balance: 0 };
            let cash = 0, bank = 0;
            for (const f of (flows || [])) {
                const amt = f.amount || 0;
                if (f.direction === 'inflow') {
                    if (f.source_target === 'cash') cash += amt;
                    else if (f.source_target === 'bank') bank += amt;
                } else {
                    if (f.source_target === 'cash') cash -= amt;
                    else if (f.source_target === 'bank') bank -= amt;
                }
            }
            return { cash_balance: cash, bank_balance: bank, total_balance: cash + bank };
        },

        async remitToHeadquarters(storeId, amount, description) {
            const profile = await this.getCurrentProfile();
            if (profile?.role !== 'admin') throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat menyetor ke pusat' : '需管理员权限');
            const shop = await this.getShopAccount(storeId);
            if (shop.bank_balance < amount) throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            return await this.recordInternalTransfer({
                transfer_type: 'store_to_hq',
                from_account: 'bank',
                to_account: 'hq',
                amount: amount,
                description: description || (Utils.lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部'),
                store_id: storeId
            });
        },

        formatCurrency(amount) { return Utils.formatCurrency(amount); },
        formatDate(dateStr) { return Utils.formatDate(dateStr); },
    };

    // 挂载到命名空间
    JF.Supabase = SupabaseAPI;
    window.SUPABASE = SupabaseAPI; // 向下兼容

    console.log('✅ JF.Supabase v2.3 初始化完成（资金池指标版）');
})();
