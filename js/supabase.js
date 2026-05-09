// supabase.js - v2.0
// 1. deleteOrder 完整清理现金流（order_id + reference_id）
// 2. 统一利息少付逻辑，确保前后端一致
// 3. 缓存 practiceIds，避免重复查询

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 安全存储（精简实现） ====================
    const SafeStorage = {
        _memoryStore: {},
        _lsOk: null, _ssOk: null, _cookieOk: null,
        _checkLS() {
            if (this._lsOk === null) {
                try { localStorage.setItem('_t','1'); localStorage.removeItem('_t'); this._lsOk = true; }
                catch(e) { this._lsOk = false; }
            }
            return this._lsOk;
        },
        _checkSS() {
            if (this._ssOk === null) {
                try { sessionStorage.setItem('_t','1'); sessionStorage.removeItem('_t'); this._ssOk = true; }
                catch(e) { this._ssOk = false; }
            }
            return this._ssOk;
        },
        _checkCookie() {
            if (this._cookieOk === null) {
                try {
                    document.cookie = '_tc=1;path=/;SameSite=Lax';
                    this._cookieOk = document.cookie.indexOf('_tc=') !== -1;
                    document.cookie = '_tc=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT';
                } catch(e) { this._cookieOk = false; }
            }
            return this._cookieOk;
        },
        _getCookie(n) {
            try {
                const v = `; ${document.cookie}`.split(`; ${n}=`);
                return v.length === 2 ? decodeURIComponent(v.pop().split(';').shift()) : null;
            } catch(e) { return null; }
        },
        _setCookie(n, v, d) {
            try {
                let e = '';
                if(d){ const dt = new Date(); dt.setTime(dt.getTime()+d*864e5); e = `;expires=${dt.toUTCString()}`; }
                document.cookie = `${n}=${encodeURIComponent(v)};path=/;SameSite=Lax${e}`;
                return true;
            } catch(e) { return false; }
        },
        _removeCookie(n) {
            try { document.cookie = `${n}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`; } catch(e) {}
        },
        getItem(key) {
            if(this._checkLS()){ try { const v=localStorage.getItem(key); if(v!==null) return v; } catch(e){} }
            if(this._checkSS()){ try { const v=sessionStorage.getItem(key); if(v!==null) return v; } catch(e){} }
            if(this._checkCookie()){ const v=this._getCookie(key); if(v!==null) return v; }
            return this._memoryStore[key] || null;
        },
        setItem(key, value) {
            const str = String(value);
            if(this._checkLS()){ try { localStorage.setItem(key, str); } catch(e){} }
            if(this._checkSS()){ try { sessionStorage.setItem(key, str); } catch(e){} }
            if(this._checkCookie()){ this._setCookie(key, str, 365); }
            this._memoryStore[key] = str;
        },
        removeItem(key) {
            if(this._checkLS()){ try { localStorage.removeItem(key); } catch(e){} }
            if(this._checkSS()){ try { sessionStorage.removeItem(key); } catch(e){} }
            if(this._checkCookie()){ this._removeCookie(key); }
            delete this._memoryStore[key];
        },
        clear(prefix='') {
            if(this._checkLS()){
                try { Object.keys(localStorage).filter(k=>!prefix||k.startsWith(prefix)).forEach(k=>localStorage.removeItem(k)); } catch(e){}
            }
            if(this._checkSS()){
                try { Object.keys(sessionStorage).filter(k=>!prefix||k.startsWith(prefix)).forEach(k=>sessionStorage.removeItem(k)); } catch(e){}
            }
            if(this._checkCookie()){
                try { document.cookie.split(';').forEach(c=>{ const n=c.trim().split('=')[0]; if(!prefix||n.startsWith(prefix)) this._removeCookie(n); }); } catch(e){}
            }
            if(prefix){ Object.keys(this._memoryStore).filter(k=>k.startsWith(prefix)).forEach(k=>delete this._memoryStore[k]); }
            else { this._memoryStore = {}; }
        }
    };

    JF.Storage = { safe: SafeStorage };

    // ==================== Supabase 客户端初始化 ====================
    const SUPABASE_URL = window.APP_CONFIG?.SUPABASE?.URL || '';
    const SUPABASE_KEY = window.APP_CONFIG?.SUPABASE?.ANON_KEY || '';
    let supabaseClient;

    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { storage: SafeStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
            global: { headers: { 'X-Client-Info': 'jf-gadai-v3' } }
        });
        console.log('✅ Supabase 客户端初始化成功');
    } catch(e) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.warn('⚠️ Supabase 初始化降级');
    }

    // ==================== 通用工具 ====================
    let _profileCache = null;
    const _storePrefixCache = new Map();
    let _storesCache = null, _storesCacheTime = 0;
    const STORES_TTL = 3600000; // 1小时
    const USERS_TTL = 3600000;   // 1小时
    
    // 缓存 practiceIds
    let _practiceStoreIdsCache = null;
    let _practiceStoreIdsCacheTime = 0;
    const PRACTICE_IDS_TTL = 5 * 60 * 1000; // 5分钟

    // 安全查询包装器
    const safeQuery = async (fn, fallback = null, silent = false) => {
        try {
            return await fn();
        } catch(error) {
            if(!silent) console.warn('[Supabase]', error.message || error);
            if(error.status===401 || (error.message && (error.message.includes('JWT')||error.message.includes('session')))){
                // 增加 DashboardCore 存在性检查
                if (JF.DashboardCore && typeof JF.DashboardCore.logout === 'function') {
                    setTimeout(() => JF.DashboardCore.logout(), 1000);
                } else {
                    console.warn('[Supabase] DashboardCore.logout 不可用，无法自动登出');
                }
            }
            return fallback;
        }
    };

    // 自动应用门店过滤（管理员不过滤，可查看所有门店）
    const applyStoreFilter = (query, profile, storeIdParam) => {
        if(!profile) return query;
        if(profile.role === 'admin') {
            if(storeIdParam && storeIdParam !== 'all') {
                return query.eq('store_id', storeIdParam);
            }
            return query;
        }
        if(profile.store_id) return query.eq('store_id', profile.store_id);
        return query;
    };

    // ==================== 排除练习门店的通用过滤函数 ====================
    const excludePracticeStores = async (query, profile, options = {}) => {
        if (!profile) return query;
        const { includePractice = false } = options;
        if (profile.role === 'admin' && !includePractice) {
            const practiceIds = await SupabaseAPI._getPracticeStoreIds();
            if (practiceIds.length > 0) {
                query = query.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
        }
        return query;
    };

    const todayStr = () => Utils.getLocalToday();
    const nowStr = () => Utils.getLocalDateTime();

    // ==================== SupabaseAPI 主对象 ====================
    const SupabaseAPI = {
        getClient: () => supabaseClient,
        getSafeStorage: () => SafeStorage,

        // ---------- 认证 ----------
        async getSession() {
            return safeQuery(async () => {
                const { data, error } = await supabaseClient.auth.getSession();
                if(error) throw error;
                return data?.session || null;
            }, null, true);
        },

        async getCurrentUser() {
            return safeQuery(async () => {
                const { data, error } = await supabaseClient.auth.getUser();
                if(error) throw error;
                return data?.user || null;
            }, null, true);
        },

        async getCurrentProfile() {
            const session = await this.getSession();
            if(!session){ _profileCache = null; return null; }
            if(_profileCache) return _profileCache;

            const user = await this.getCurrentUser();
            if(!user) return null;
            const { data, error } = await supabaseClient
                .from('user_profiles').select('*').eq('id', user.id).single();
            if(error) { _profileCache = null; return null; }
            if(data?.store_id){
                try {
                    const { data: store } = await supabaseClient
                        .from('stores').select('*').eq('id', data.store_id).single();
                    if(store) data.stores = store;
                } catch(e){}
            }
            _profileCache = data;
            if(window.AUTH) window.AUTH.user = data;
            return data;
        },

        clearCache() {
            _profileCache = null;
            _storePrefixCache.clear();
            _storesCache = null;
            _storesCacheTime = 0;
            _practiceStoreIdsCache = null;
            _practiceStoreIdsCacheTime = 0;
            try {
                SafeStorage.removeItem('jf_cache_stores');
                SafeStorage.removeItem('jf_cache_users');
            } catch(e) { /* ignore */ }
            JF.Cache?.clear?.();
        },

        async isAdmin() { const p = await this.getCurrentProfile(); return p?.role === 'admin'; },
        async getCurrentStoreId() { const p = await this.getCurrentProfile(); return p?.store_id; },
        async getCurrentStoreName() { const p = await this.getCurrentProfile(); return p?.stores?.name || 'Kantor'; },

        async login(emailOrUsername, password) {
            if(!supabaseClient) throw new Error('客户端未初始化');
            let emailToUse = emailOrUsername;
            if(!emailOrUsername.includes('@')){
                const { data } = await safeQuery(() => supabaseClient
                    .from('user_profiles')
                    .select('username, email')
                    .or(`username.eq.${emailOrUsername},email.eq.${emailOrUsername}`)
                    .maybeSingle());
                if(!data) throw new Error(Utils.lang==='id'?'Username tidak ditemukan':'用户名不存在');
                emailToUse = data.email || data.username;
            }
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email: emailToUse, password });
            if(error) throw error;
            this.clearCache();
            if(window.AUTH && data.user) await window.AUTH.loadCurrentUser();
            return data;
        },

        async logout() {
            this.clearCache();
            if(!supabaseClient) return;
            try { await supabaseClient.auth.signOut(); } catch(e){}
        },

        // ---------- 门店 ----------
        async getAllStores(forceRefresh = false) {
            if(!supabaseClient) return [];
            const now = Date.now();
            if(!forceRefresh && _storesCache && (now - _storesCacheTime) < STORES_TTL) return _storesCache;
            
            if(!forceRefresh) {
                try {
                    const lsData = SafeStorage.getItem('jf_cache_stores');
                    if(lsData) {
                        const parsed = JSON.parse(lsData);
                        if(parsed && parsed.data && (now - parsed.time) < STORES_TTL) {
                            _storesCache = parsed.data;
                            _storesCacheTime = parsed.time;
                            (parsed.data||[]).forEach(s=>{ if(s.prefix){ _storePrefixCache.set(s.id, s.prefix); _storePrefixCache.set(s.code, s.prefix); } });
                            return parsed.data;
                        } else if(parsed && parsed.data) {
                            SafeStorage.removeItem('jf_cache_stores');
                            console.log('[Supabase] 门店缓存已过期，已删除');
                        }
                    }
                } catch(e) { /* ignore */ }
            }
            
            try {
                const { data } = await supabaseClient.from('stores').select('*').order('code');
                _storesCache = data;
                _storesCacheTime = now;
                (data||[]).forEach(s=>{ if(s.prefix){ _storePrefixCache.set(s.id, s.prefix); _storePrefixCache.set(s.code, s.prefix); } });
                try {
                    SafeStorage.setItem('jf_cache_stores', JSON.stringify({ data, time: now }));
                } catch(e) { /* ignore */ }
                return data;
            } catch(e){ return _storesCache || []; }
        },

        async checkStoreStatus(storeId) {
            if (!supabaseClient) return { is_active: true, name: '' };
            try {
                const { data, error } = await supabaseClient
                    .from('stores')
                    .select('is_active, name')
                    .eq('id', storeId)
                    .single();
                if (error) throw error;
                return { 
                    is_active: data?.is_active !== false, 
                    name: data?.name || '' 
                };
            } catch (error) {
                console.warn('[Supabase] checkStoreStatus failed:', error.message);
                return { is_active: true, name: '' };
            }
        },

        async _getStorePrefix(storeId) {
            if(!storeId) return 'AD';
            if(_storePrefixCache.has(storeId)) return _storePrefixCache.get(storeId);
            try {
                const { data } = await supabaseClient.from('stores').select('prefix, code').eq('id', storeId).single();
                const map = { STORE_001:'BL', STORE_002:'SO', STORE_003:'GP', STORE_004:'BJ' };
                let p = data?.prefix || map[data?.code] || 'AD';
                _storePrefixCache.set(storeId, p);
                if(data?.code) _storePrefixCache.set(data.code, p);
                return p;
            } catch(e){ return 'AD'; }
        },

        async _generateOrderId(role, storeId, maxRetries=10) {
            if(!supabaseClient) throw new Error('客户端未初始化');
            const prefix = role==='admin' ? 'AD' : await this._getStorePrefix(storeId);
            for(let attempt=1; attempt<=maxRetries; attempt++){
                try {
                    const { data: existing } = await supabaseClient
                        .from('orders').select('order_id').like('order_id', prefix+'%')
                        .order('created_at', { ascending: false }).limit(1);
                    let maxNum = 0;
                    if(existing?.length){
                        const m = existing[0].order_id.match(new RegExp(prefix+'(\\d{3})$'));
                        if(m) maxNum = parseInt(m[1],10);
                    }
                    const oid = prefix + String(maxNum+1).padStart(3,'0');
                    const { data: dup } = await supabaseClient.from('orders').select('id').eq('order_id', oid).maybeSingle();
                    if(!dup) return oid;
                    await new Promise(r => setTimeout(r, 50*attempt));
                } catch(err){
                    if(attempt===maxRetries) throw err;
                    await new Promise(r => setTimeout(r, 50*attempt));
                }
            }
            return prefix + Date.now().toString().slice(-6) + String(Math.floor(Math.random()*1000)).padStart(3,'0');
        },

        async _generateCustomerId(storeId, maxRetries=10) {
            const prefix = await this._getStorePrefix(storeId);
            for(let attempt=1; attempt<=maxRetries; attempt++){
                try {
                    const { data: existing } = await supabaseClient
                        .from('customers').select('customer_id').like('customer_id', prefix+'%')
                        .order('customer_id', { ascending: false }).limit(1);
                    let maxNum = 0;
                    if(existing?.length){
                        const m = existing[0].customer_id.match(new RegExp(prefix+'(\\d{3})$'));
                        if(m) maxNum = parseInt(m[1],10);
                    }
                    const cid = prefix + String(maxNum+1).padStart(3,'0');
                    const { data: dup } = await supabaseClient.from('customers').select('id').eq('customer_id', cid).maybeSingle();
                    if(!dup) return cid;
                    await new Promise(r => setTimeout(r, 50*attempt));
                } catch(err){
                    if(attempt===maxRetries) throw err;
                    await new Promise(r => setTimeout(r, 50*attempt));
                }
            }
            return prefix + Date.now().toString().slice(-6) + String(Math.floor(Math.random()*100)).padStart(2,'0');
        },

        /* 缓存 practiceIds */
        async _getPracticeStoreIds(forceRefresh = false) {
            const now = Date.now();
            if (!forceRefresh && _practiceStoreIdsCache && (now - _practiceStoreIdsCacheTime) < PRACTICE_IDS_TTL) {
                return _practiceStoreIdsCache;
            }
            
            const stores = await this.getAllStores(forceRefresh);
            const practiceIds = stores.filter(s => s.is_practice === true).map(s => s.id);
            
            _practiceStoreIdsCache = practiceIds;
            _practiceStoreIdsCacheTime = now;
            
            return practiceIds;
        },

        // ---------- 客户 ----------
        async createCustomer(customerData) {
            if(!supabaseClient) throw new Error('客户端未初始化');
            const profile = await this.getCurrentProfile();
            const storeId = customerData.store_id || profile?.store_id;
            let lastError;
            for(let attempt=0; attempt<8; attempt++){
                try {
                    const customerId = await this._generateCustomerId(storeId, 8);
                    const { data, error } = await supabaseClient.from('customers').insert({
                        customer_id: customerId, store_id: storeId, name: customerData.name,
                        ktp_number: customerData.ktp_number || null, phone: customerData.phone,
                        ktp_address: customerData.ktp_address || null, address: customerData.address || null,
                        living_same_as_ktp: customerData.living_same_as_ktp,
                        living_address: customerData.living_address || null,
                        occupation: customerData.occupation || null,
                        registered_date: customerData.registered_date || todayStr(),
                        created_by: profile?.id, updated_at: nowStr()
                    }).select().single();
                    if(error){
                        if(error.code==='23505'){ lastError=error; await new Promise(r=>setTimeout(r,50*(attempt+1))); continue; }
                        throw error;
                    }
                    console.log(`✅ 客户创建: ${customerId}`);
                    return data;
                } catch(e){
                    if(e.code==='23505' && attempt<7){ lastError=e; await new Promise(r=>setTimeout(r,50*(attempt+1))); continue; }
                    throw e;
                }
            }
            throw lastError || new Error(Utils.lang==='id'?'Gagal membuat nasabah':'客户创建失败');
        },

        async updateCustomer(customerId, customerData) {
            const updates = {
                name: customerData.name, phone: customerData.phone,
                ktp_number: customerData.ktp_number || null,
                ktp_address: customerData.ktp_address || null,
                address: customerData.address || null,
                living_same_as_ktp: customerData.living_same_as_ktp,
                living_address: customerData.living_address || null,
                occupation: customerData.occupation || null,
                updated_at: nowStr()
            };
            const { error } = await supabaseClient.from('customers').update(updates).eq('id', customerId);
            if(error) throw error;
            return true;
        },

        async getCustomers(filters={}) {
            if(!supabaseClient) return [];
            const profile = await this.getCurrentProfile();
            try {
                const { data: bl } = await supabaseClient.from('blacklist').select('customer_id');
                const blackIds = (bl||[]).map(b=>b.customer_id);
                let q = supabaseClient.from('customers').select('*').order('registered_date', { ascending: false });
                if(profile?.role !== 'admin' && profile?.store_id) q = q.eq('store_id', profile.store_id);
                if(blackIds.length) q = q.not('id','in',`(${blackIds.join(',')})`);
                const { data } = await q;
                return data;
            } catch(e){ return []; }
        },

        async getCustomer(customerId) {
            const { data, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if(error) throw error;
            return data;
        },

        // ---------- 黑名单 ----------
        async checkBlacklist(customerId) {
            if(!supabaseClient) return { isBlacklisted: false };
            try {
                const { data } = await supabaseClient.from('blacklist').select('id, reason').eq('customer_id', customerId).maybeSingle();
                if(data) return { isBlacklisted: true, reason: data.reason };
                if(!data && customerId){
                    const { data: cust } = await supabaseClient.from('customers').select('id').eq('customer_id', customerId).single();
                    if(cust){
                        const { data: d2 } = await supabaseClient.from('blacklist').select('id, reason').eq('customer_id', cust.id).maybeSingle();
                        if(d2) return { isBlacklisted: true, reason: d2.reason };
                    }
                }
                return { isBlacklisted: false };
            } catch(e){ return { isBlacklisted: false }; }
        },

        async addToBlacklist(customerId, reason, blacklistedBy) {
            const { data: cust } = await supabaseClient.from('customers').select('id, store_id, customer_id, name, occupation').eq('id', customerId).single();
            if(!cust) throw new Error('客户不存在');
            const { data: exist } = await supabaseClient.from('blacklist').select('id').eq('customer_id', cust.id).maybeSingle();
            if(exist) throw new Error(Utils.lang==='id'?'Nasabah sudah ada di blacklist':'客户已在黑名单中');
            const { error } = await supabaseClient.from('blacklist').insert({
                customer_id: cust.id, reason: reason.trim(),
                blacklisted_by: blacklistedBy, store_id: cust.store_id
            });
            if(error) throw error;
            return { customer_id: cust.id, reason: reason.trim() };
        },

        async removeFromBlacklist(customerId) {
            let error;
            const { error: e1 } = await supabaseClient.from('blacklist').delete().eq('customer_id', customerId);
            if(e1 && e1.code==='22P02'){
                const { data: cust } = await supabaseClient.from('customers').select('id').eq('customer_id', customerId).single();
                if(cust){ const { error: e2 } = await supabaseClient.from('blacklist').delete().eq('customer_id', cust.id); error = e2; }
                else error = e1;
            } else error = e1;
            if(error) throw error;
            return true;
        },

        async getBlacklist(filterStoreId=null, profile=null) {
            if(!profile) profile = await this.getCurrentProfile();
            let q = supabaseClient.from('blacklist').select(`
                *, customers:customer_id (
                    id, customer_id, name, ktp_number, phone, occupation, ktp_address, store_id,
                    stores:store_id (name, code)
                ), blacklisted_by_profile:blacklisted_by (name)
            `).order('blacklisted_at', { ascending: false });
            if(profile?.role !== 'admin' && filterStoreId) q = q.eq('customers.store_id', filterStoreId);
            const { data, error } = await q;
            if(error) throw error;
            return data;
        },

        escapePostgRESTValue(str) {
            if(!str) return '';
            return String(str).replace(/[,()\.\[\]]/g, '\\$&');
        },

        async checkDuplicateCustomer(name, ktpNumber, phone, excludeCustomerId=null) {
            if(!supabaseClient) return null;
            const filters = [];
            if(name) filters.push({ col:'name', val:name });
            if(ktpNumber) filters.push({ col:'ktp_number', val:ktpNumber });
            if(phone) filters.push({ col:'phone', val:phone });
            if(!filters.length) return null;
            const orCond = filters.map(f=>`${f.col}.eq.${this.escapePostgRESTValue(f.val)}`).join(',');
            let q = supabaseClient.from('customers').select('id, customer_id, name, ktp_number, phone').or(orCond);
            if(excludeCustomerId) q = q.neq('id', excludeCustomerId);
            const { data } = await q;
            if(!data?.length) return null;
            let bestMatch = data[0];
            for(const c of data){ if(c.name===name && c.ktp_number===ktpNumber && c.phone===phone){ bestMatch=c; break; } }
            return { isDuplicate: true, existingCustomer: bestMatch };
        },

        async checkBlacklistDuplicate(ktp, phone) {
            if(!supabaseClient || (!ktp && !phone)) return null;
            const conds = [];
            if(ktp) conds.push(`customers.ktp_number.eq.${ktp}`);
            if(phone) conds.push(`customers.phone.eq.${phone}`);
            if(!conds.length) return null;
            const { data } = await supabaseClient
                .from('blacklist')
                .select('customers!blacklist_customer_id_fkey(id, name, ktp_number, phone, customer_id)')
                .or(conds.join(','));
            return data?.[0]?.customers || null;
        },

        async getCustomerOrdersStats(customerId) {
            if(!supabaseClient) return { activeCount:0, completedCount:0, abnormalCount:0, orders:[] };
            const { data: orders } = await supabaseClient
                .from('orders').select('id, order_id, status, created_at')
                .eq('customer_id', customerId).order('created_at', { ascending: false });
            let active=0, completed=0, abnormal=0;
            (orders||[]).forEach(o=>{
                if(o.status==='active') active++;
                else if(o.status==='completed') completed++;
                else if(o.status==='liquidated') abnormal++;
            });
            try {
                const { count } = await supabaseClient
                    .from('orders').select('id', { count:'exact', head:true })
                    .eq('customer_id', customerId).eq('status','active').gte('overdue_days',30);
                abnormal += (count||0);
            } catch(e){}
            return { activeCount:active, completedCount:completed, abnormalCount:abnormal, orders:orders||[] };
        },

        async getCustomerOrdersByStatus(customerId, statusType) {
            let q = supabaseClient.from('orders').select('*')
                .eq('customer_id', customerId).order('created_at', { ascending: false });
            if(statusType==='active') q = q.eq('status','active');
            else if(statusType==='completed') q = q.eq('status','completed');
            else if(statusType==='abnormal') q = q.or('status.eq.liquidated,and(status.eq.active,overdue_days.gte.30)');
            const { data } = await q;
            return data||[];
        },

        calculateNextDueDate(startDate, paidMonths) {
            return Utils.calculateNextDueDate(startDate, paidMonths);
        },

        // ---------- 资金流水 ----------
        async recordCashFlow(flowData) {
            const profile = await this.getCurrentProfile();
            const storeId = flowData.store_id || profile?.store_id;
            if(!storeId) throw new Error(Utils.lang==='id'?'ID toko tidak ditemukan':'门店ID缺失');
            const record = {
                store_id: storeId, flow_type: flowData.flow_type,
                direction: flowData.direction, amount: flowData.amount,
                source_target: flowData.source_target, order_id: flowData.order_id || null,
                customer_id: flowData.customer_id || null, description: flowData.description || '',
                recorded_by: profile?.id, recorded_at: nowStr(),
                reference_id: flowData.reference_id || null, is_voided: false
            };
            const { data, error } = await supabaseClient.from('cash_flow_records').insert(record).select().single();
            if(error) throw error;
            return data;
        },

        async updateExpenseWithCashFlow(expenseId, updates) {
            const profile = await this.getCurrentProfile();
            if(profile?.role!=='admin') throw new Error(Utils.lang==='id'?'Hanya admin yang dapat mengubah pengeluaran':'仅管理员可修改支出');
            const { data: old } = await supabaseClient.from('expenses').select('*').eq('id', expenseId).single();
            if(old.is_reconciled) throw new Error(Utils.lang==='id'?'Pengeluaran sudah direkonsiliasi, tidak dapat diubah':'支出已平账，不可修改');
            const upd = { ...updates, updated_at: nowStr(), updated_by: profile.id };
            const { error: upErr } = await supabaseClient.from('expenses').update(upd).eq('id', expenseId);
            if(upErr) throw upErr;
            if(updates.amount!==undefined && updates.amount!==old.amount){
                const diff = updates.amount - old.amount;
                const { data: cfs } = await supabaseClient.from('cash_flow_records')
                    .select('id, amount').eq('reference_id', expenseId).eq('flow_type','expense').eq('is_voided',false).limit(1);
                if(cfs?.length){
                    await supabaseClient.from('cash_flow_records')
                        .update({ amount: cfs[0].amount + diff, description: updates.category||old.category })
                        .eq('id', cfs[0].id);
                } else if(diff!==0){
                    await this.recordCashFlow({
                        store_id: old.store_id, flow_type: 'expense_adjustment',
                        direction: diff>0?'outflow':'inflow', amount: Math.abs(diff),
                        source_target: old.payment_method,
                        description: `支出调整: ${old.category} (原:${Utils.formatCurrency(old.amount)})`,
                        reference_id: expenseId
                    });
                }
            }
            return true;
        },

        async deleteExpenseWithCashFlow(expenseId) {
            const profile = await this.getCurrentProfile();
            if(profile?.role!=='admin') throw new Error(Utils.lang==='id'?'Hanya admin yang dapat menghapus pengeluaran':'仅管理员可删除支出记录');
            const { data: expense } = await supabaseClient.from('expenses').select('*').eq('id', expenseId).single();
            const { error: voidErr } = await supabaseClient.from('cash_flow_records')
                .update({ is_voided:true, voided_at:nowStr(), voided_by:profile.id })
                .eq('reference_id', expenseId).eq('flow_type','expense');
            if(voidErr){
                await supabaseClient.from('cash_flow_records').delete().eq('reference_id', expenseId).eq('flow_type','expense');
            }
            const { error: delErr } = await supabaseClient.from('expenses').delete().eq('id', expenseId);
            if(delErr) throw delErr;
            return true;
        },

        /* 员工支出金额后端验证 + 管理员门店逻辑优化 */
        async addExpense(expenseData) {
            if (!supabaseClient) throw new Error('客户端未初始化');
            const profile = await this.getCurrentProfile();
            
            // 员工支出金额后端验证
            if (profile?.role === 'staff') {
                const maxAmount = window.PERMISSION?.STAFF_EXPENSE_MAX_AMOUNT || 5000000;
                if (expenseData.amount > maxAmount) {
                    throw new Error(Utils.lang === 'id' 
                        ? `Jumlah pengeluaran melebihi batas staf (maks ${Utils.formatCurrency(maxAmount)})`
                        : `支出金额超过员工限额 (上限 ${Utils.formatCurrency(maxAmount)})`);
                }
            }
            
            let targetStoreId = expenseData.store_id || profile?.store_id;
            
            // 管理员无门店时查找 STORE_000，若不存在则提示创建
            if (profile?.role === 'admin' && !targetStoreId) {
                const stores = await this.getAllStores();
                const hqStore = stores.find(s => s.code === 'STORE_000');
                if (hqStore) {
                    targetStoreId = hqStore.id;
                } else {
                    throw new Error(Utils.lang === 'id' 
                        ? 'Tidak dapat menentukan toko. Silakan buat toko pusat (STORE_000) terlebih dahulu di Manajemen Toko.'
                        : '无法确定门店。请先在门店管理中创建总部门店 (STORE_000)。');
                }
            }
            
            if (!targetStoreId) {
                throw new Error(Utils.lang === 'id' ? 'ID toko tidak ditemukan' : '门店ID缺失');
            }
            
            const amountValue = typeof expenseData.amount === 'number' 
                ? expenseData.amount 
                : parseFloat(expenseData.amount);
            
            if (isNaN(amountValue) || amountValue <= 0) {
                throw new Error(Utils.t('invalid_amount'));
            }
            
            const insertData = {
                store_id: targetStoreId,
                expense_date: expenseData.expense_date || Utils.getLocalToday(),
                category: expenseData.category,
                amount: amountValue,
                description: expenseData.description || null,
                payment_method: expenseData.payment_method || 'cash',
                created_by: profile?.id
            };
            
            try {
                const { data, error } = await supabaseClient
                    .from('expenses')
                    .insert(insertData)
                    .select()
                    .single();
                    
                if (error) {
                    console.error('[addExpense] Supabase错误:', error);
                    throw error;
                }
                
                try {
                    await this.recordCashFlow({
                        store_id: targetStoreId,
                        flow_type: 'expense',
                        direction: 'outflow',
                        amount: amountValue,
                        source_target: expenseData.payment_method || 'cash',
                        description: expenseData.category,
                        reference_id: data.id
                    });
                } catch (flowError) {
                    console.warn('[addExpense] 现金流记录失败:', flowError.message);
                }
                
                return data;
            } catch (error) {
                console.error('[addExpense] 失败:', error);
                throw error;
            }
        },

        async recordLoanDisbursement(orderId, amount, source, description) {
            const order = await this.getOrder(orderId);
            const { data: exist } = await supabaseClient.from('cash_flow_records')
                .select('id').eq('order_id', order.id).eq('flow_type','loan_disbursement').eq('is_voided',false).maybeSingle();
            if(exist) throw new Error(Utils.t('loan_already_disbursed'));
            return await this.recordCashFlow({
                store_id: order.store_id, flow_type:'loan_disbursement', direction:'outflow',
                amount, source_target: source, order_id: order.id, customer_id: order.customer_id,
                description: description || (Utils.lang==='id'?'Pencairan gadai':'当金发放') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
        },

        async recordCapitalInjection(storeId, amount, source, description) {
            const profile = await this.getCurrentProfile();
            const targetStoreId = storeId || profile?.store_id;
            if(!targetStoreId) throw new Error(Utils.lang==='id'?'ID toko tidak ditemukan':'门店ID缺失');
            if(!amount || amount<=0) throw new Error(Utils.t('invalid_amount'));
            if(profile?.role!=='admin') throw new Error(Utils.lang==='id'?'Hanya admin yang dapat mencatat injeksi modal':'仅管理员可记录资本注入');
            const { data, error } = await supabaseClient.from('capital_injections').insert({
                store_id: targetStoreId, amount, source: source||'cash',
                description: description || (Utils.lang==='id'?'Injeksi modal':'资本注入'),
                injection_date: todayStr(), recorded_by: profile.id,
                is_voided: false, created_at: nowStr()
            }).select().single();
            if(error) throw error;
            await this.recordCashFlow({
                store_id: targetStoreId, flow_type:'capital_injection', direction:'inflow',
                amount, source_target: source||'cash',
                description: description || (Utils.lang==='id'?'Injeksi modal':'资本注入'),
                reference_id: data.id
            });
            return data;
        },

        // ===== 完整业务方法 =====
        async getFullCapitalAnalysis(storeIdParam = null) {
            const profile = await this.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            let targetStoreId = storeIdParam;
            if (!targetStoreId && !isAdmin) targetStoreId = profile?.store_id;

            const cashFlowSummary = await this.getCashFlowSummary(targetStoreId);

            let injectionQuery = supabaseClient.from('capital_injections')
                .select('*').eq('is_voided', false);
            injectionQuery = applyStoreFilter(injectionQuery, profile, targetStoreId);
            injectionQuery = await excludePracticeStores(injectionQuery, profile);
            const { data: injections } = await injectionQuery;

            const externalInjections = (injections || []).filter(i => i.source !== 'profit');
            const profitReinvestments = (injections || []).filter(i => i.source === 'profit');

            const totalExternalCapital = externalInjections.reduce((sum, i) => sum + (i.amount || 0), 0);
            const totalProfitReinvested = profitReinvestments.reduce((sum, i) => sum + (i.amount || 0), 0);
            const totalCapital = totalExternalCapital + totalProfitReinvested;

            let orderQuery = supabaseClient.from('orders')
                .select('loan_amount, status, store_id').eq('status', 'active');
            orderQuery = applyStoreFilter(orderQuery, profile, targetStoreId);
            orderQuery = await excludePracticeStores(orderQuery, profile);
            const { data: activeOrders } = await orderQuery;
            const deployedCapital = (activeOrders || []).reduce((sum, o) => sum + (o.loan_amount || 0), 0);
            const availableCapital = totalCapital - deployedCapital;
            const utilizationRate = totalCapital > 0 ? (deployedCapital / totalCapital) * 100 : 0;

            const operatingIncome = cashFlowSummary.netProfit?.operatingIncome || 0;
            const operatingExpense = cashFlowSummary.netProfit?.operatingExpense || 0;
            const cumulativeProfit = operatingIncome - operatingExpense;
            const pendingReinvestProfit = cumulativeProfit - totalProfitReinvested;
            const profitReinvestRate = cumulativeProfit > 0 ? (totalProfitReinvested / cumulativeProfit) * 100 : 0;

            const leverageRatio = totalExternalCapital > 0 ? totalCapital / totalExternalCapital : 1;
            const deployedOrdersCount = activeOrders?.length || 0;

            const capitalBreakdown = {
                external_injections: totalExternalCapital,
                profit_reinvestments: totalProfitReinvested,
                total_capital: totalCapital
            };

            let overall = 'healthy';
            const strengths = [];
            const issues = [];
            if (utilizationRate > 75) {
                issues.push(Utils.lang === 'id' ? 'Utilisasi modal tinggi (>75%), resiko likuiditas' : '资金利用率过高 (>75%)，有流动性风险');
                overall = 'warning';
            } else if (utilizationRate < 30) {
                issues.push(Utils.lang === 'id' ? 'Utilisasi modal rendah (<30%), potensi pertumbuhan terlewat' : '资金利用率偏低 (<30%)，可能错失增长机会');
                overall = 'warning';
            } else {
                strengths.push(Utils.lang === 'id' ? `Utilisasi modal optimal (${utilizationRate.toFixed(1)}%)` : `资金利用率适中 (${utilizationRate.toFixed(1)}%)`);
            }
            if (leverageRatio > 2.5) {
                strengths.push(Utils.lang === 'id' ? `Leverage tinggi (${leverageRatio.toFixed(2)}x), ekspansi agresif` : `杠杆率较高 (${leverageRatio.toFixed(2)}x)，扩张积极`);
            } else if (leverageRatio < 1.2) {
                issues.push(Utils.lang === 'id' ? 'Leverage rendah, pertumbuhan lambat' : '杠杆率偏低，增长缓慢');
            } else {
                strengths.push(Utils.lang === 'id' ? `Leverage sehat (${leverageRatio.toFixed(2)}x)` : `杠杆率健康 (${leverageRatio.toFixed(2)}x)`);
            }
            if (availableCapital < 0) {
                issues.push(Utils.lang === 'id' ? 'Modal negatif! Segera injeksi modal' : '资本为负！请立即注资');
                overall = 'critical';
            } else if (availableCapital > 0 && availableCapital < totalCapital * 0.1) {
                issues.push(Utils.lang === 'id' ? 'Modal cadangan tipis, perlu injeksi' : '储备资金不足，建议注资');
                overall = 'warning';
            } else if (availableCapital > totalCapital * 0.3) {
                strengths.push(Utils.lang === 'id' ? 'Cadangan modal kuat' : '储备资金充足');
            }
            let summary = '';
            if (overall === 'healthy') {
                summary = Utils.lang === 'id' ? '✅ Struktur modal sehat, operasional stabil' : '✅ 资本结构健康，运营稳定';
            } else if (overall === 'warning') {
                summary = Utils.lang === 'id' ? '⚠️ Perlu perhatian pada struktur modal' : '⚠️ 资本结构需关注';
            } else {
                summary = Utils.lang === 'id' ? '🔴 Kondisi modal kritis, perlu tindakan segera' : '🔴 资本状况危急，需立即处理';
            }
            return {
                capital_breakdown: capitalBreakdown,
                cumulative_profit: cumulativeProfit,
                reinvested_profit: totalProfitReinvested,
                pending_reinvest_profit: Math.max(0, pendingReinvestProfit),
                profit_reinvest_rate: profitReinvestRate,
                deployed_capital: deployedCapital,
                deployed_orders_count: deployedOrdersCount,
                available_capital: Math.max(0, availableCapital),
                utilization_rate: utilizationRate,
                leverage_ratio: leverageRatio,
                health_assessment: { overall, summary, strengths, issues }
            };
        },

        async getDistributableProfit(storeId) {
            const profile = await this.getCurrentProfile();
            const targetStoreId = storeId || profile?.store_id;
            if(!targetStoreId) throw new Error('Store ID missing');
            const cashFlowSummary = await this.getCashFlowSummary(targetStoreId);
            const totalIncome = cashFlowSummary.netProfit?.operatingIncome || 0;
            const totalExpense = cashFlowSummary.netProfit?.operatingExpense || 0;
            const { data: distributions } = await supabaseClient
                .from('profit_distributions').select('amount').eq('store_id', targetStoreId).eq('type','reinvest');
            const reinvested = (distributions||[]).reduce((sum,d)=>sum+(d.amount||0),0);
            return Math.max(0, totalIncome - totalExpense - reinvested);
        },

        async getExternalCapitalBalance(storeId) {
            const targetStoreId = storeId || (await this.getCurrentProfile())?.store_id;
            if(!targetStoreId) return 0;
            const { data: injections } = await supabaseClient
                .from('capital_injections').select('amount').eq('store_id', targetStoreId)
                .eq('is_voided', false).neq('source','profit');
            const totalInjected = (injections||[]).reduce((sum,i)=>sum+(i.amount||0),0);
            const { data: returns } = await supabaseClient
                .from('profit_distributions').select('amount').eq('store_id', targetStoreId)
                .eq('type','return_capital');
            const totalReturned = (returns||[]).reduce((sum,r)=>sum+(r.amount||0),0);
            return Math.max(0, totalInjected - totalReturned);
        },

        async distributeProfit(storeId, amount, type, description) {
            const profile = await this.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            const isStoreManager = profile?.role === 'store_manager';
            if (!isAdmin && !isStoreManager) throw new Error('Admin or store manager only');
            const targetStoreId = storeId || profile.store_id;
            if(!targetStoreId) throw new Error('Store ID missing');
            if (isStoreManager && targetStoreId !== profile.store_id) {
                throw new Error('Store manager can only distribute profit for their own store');
            }
            if(!amount || amount<=0) throw new Error('Invalid amount');
            if(type==='reinvest'){
                const available = await this.getDistributableProfit(targetStoreId);
                if(amount>available) throw new Error('Insufficient distributable profit');
            }

            const { data: distribution, error: distError } = await supabaseClient
                .from('profit_distributions').insert({
                    store_id: targetStoreId, amount, type,
                    description: description || (type==='reinvest'?'Profit Reinvestment':'Return of Capital'),
                    recorded_by: profile.id, created_at: new Date().toISOString()
                }).select().single();
            if(distError) throw distError;
            if(type==='reinvest'){
                await this.recordCashFlow({
                    store_id: targetStoreId, flow_type:'profit_reinvest', direction:'inflow',
                    amount, source_target:'cash', description:'利润再投入', reference_id: distribution.id
                });
                await supabaseClient.from('capital_injections').insert({
                    store_id: targetStoreId, amount, source:'profit',
                    injection_date: new Date().toISOString().split('T')[0],
                    description:'利润再投入', recorded_by: profile.id, is_voided: false
                });
            } else if(type==='return_capital'){
                const externalBalance = await this.getExternalCapitalBalance(targetStoreId);
                const principalPart = Math.min(amount, externalBalance);
                const dividendPart  = amount - principalPart;

                if(principalPart > 0){
                    await this.recordCashFlow({
                        store_id: targetStoreId, flow_type:'return_of_capital', direction:'outflow',
                        amount: principalPart, source_target:'cash',
                        description: (Utils.lang==='id' ? 'Pengembalian modal' : '偿还投资本金')
                            + (dividendPart > 0 ? ` (${Utils.formatCurrency(principalPart)})` : ''),
                        reference_id: distribution.id
                    });
                }
                if(dividendPart > 0){
                    await this.recordCashFlow({
                        store_id: targetStoreId, flow_type:'dividend_withdrawal', direction:'outflow',
                        amount: dividendPart, source_target:'cash',
                        description: (Utils.lang==='id'
                            ? `Penarikan dividen (${Utils.formatCurrency(dividendPart)})`
                            : `红利提取 (${Utils.formatCurrency(dividendPart)})`),
                        reference_id: distribution.id
                    });
                }
                const splitNote = dividendPart > 0
                    ? (Utils.lang==='id'
                        ? `Modal: ${Utils.formatCurrency(principalPart)}, Dividen: ${Utils.formatCurrency(dividendPart)}`
                        : `本金: ${Utils.formatCurrency(principalPart)}，红利: ${Utils.formatCurrency(dividendPart)}`)
                    : null;
                if(splitNote){
                    await supabaseClient.from('profit_distributions')
                        .update({ description: splitNote })
                        .eq('id', distribution.id);
                }
            }
            return distribution;
        },

        // ---------- 订单核心 ----------
        async getOrders(filters={}, from, to) {
            const profile = await this.getCurrentProfile();
            const practiceIds = (profile?.role === 'admin') ? await this._getPracticeStoreIds() : [];
            let q = supabaseClient.from('orders').select('*', { count:'exact' });
            if (practiceIds.length > 0) {
                q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
            if(profile?.role !== 'admin' && profile?.store_id) {
                q = q.eq('store_id', profile.store_id);
            }
            if(filters.status && filters.status!=='all') q = q.eq('status', filters.status);
            if(from!==undefined && to!==undefined) q = q.range(from, to);
            q = q.order('created_at', { ascending: false });
            const { data, error, count } = await q;
            if(error) throw error;
            return { data: data||[], totalCount: count||0 };
        },

        async getOrdersLegacy(filters) { const res = await this.getOrders(filters); return res.data; },

        async getOrder(orderId) {
            const { data, error } = await supabaseClient.from('orders').select('*').eq('order_id', orderId).single();
            if(error) throw error;
            const profile = await this.getCurrentProfile();
            if(profile?.role!=='admin' && profile?.store_id && data.store_id!==profile.store_id) throw new Error(Utils.t('unauthorized'));
            return data;
        },

        async getPaymentHistory(orderId) {
            const order = await this.getOrder(orderId);
            const { data } = await supabaseClient.from('payment_history').select('*').eq('order_id', order.id).order('date', { ascending: false });
            return { order, payments: data };
        },

        async createOrder(orderData) {
            if(!supabaseClient) throw new Error('客户端未初始化');
            const profile = await this.getCurrentProfile();
            const nowDate = todayStr();
            const adminFee = orderData.admin_fee || Utils.calculateAdminFee(orderData.loan_amount);
            const serviceFeePercent = orderData.service_fee_percent !== undefined ? orderData.service_fee_percent : 0;
            const serviceFeeAmount = orderData.service_fee_amount || 0;
            const agreedInterestRate = (orderData.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT) / 100;
            const repaymentType = orderData.repayment_type || 'flexible';
            const repaymentTerm = orderData.repayment_term || null;
            const targetStoreId = orderData.store_id || profile.store_id;
            if(profile.role==='admin' && !orderData.store_id) throw new Error(Utils.t('store_operation'));
            if(!targetStoreId) throw new Error(Utils.lang==='id'?'Toko tidak ditemukan':'未找到门店');

            const pawnTermMonths = (repaymentType === 'flexible' && orderData.pawn_term_months) 
                ? parseInt(orderData.pawn_term_months) : null;
            const pawnDueDate = (repaymentType === 'flexible' && pawnTermMonths)
                ? Utils.calculatePawnDueDate(nowDate, pawnTermMonths) : null;

            let retryCount=0, lastError=null, newOrder=null;
            while(retryCount<5){
                try {
                    const orderId = await this._generateOrderId(profile.role, targetStoreId, 5);
                    let monthlyFixedPayment = null;
                    if(repaymentType==='fixed' && repaymentTerm && repaymentTerm>0){
                        monthlyFixedPayment = orderData.monthly_fixed_payment ||
                            Utils.roundMonthlyPayment(Utils.calculateFixedMonthlyPayment(orderData.loan_amount, agreedInterestRate, repaymentTerm));
                    }
                    const monthlyInterest = orderData.loan_amount * agreedInterestRate;
                    const nextDueDate = (repaymentType === 'flexible' && pawnDueDate) 
                        ? pawnDueDate 
                        : this.calculateNextDueDate(nowDate, 0);
                    const newOrderData = {
                        order_id: orderId, customer_name: orderData.customer_name,
                        customer_ktp: orderData.customer_ktp, customer_phone: orderData.customer_phone,
                        customer_address: orderData.customer_address || '',
                        collateral_name: orderData.collateral_name, loan_amount: orderData.loan_amount,
                        admin_fee: adminFee, admin_fee_paid: false,
                        service_fee_percent: serviceFeePercent, service_fee_amount: serviceFeeAmount,
                        service_fee_paid: 0, monthly_interest: monthlyInterest,
                        interest_paid_months: 0, interest_paid_total: 0,
                        next_interest_due_date: nextDueDate,
                        principal_paid: 0, principal_remaining: orderData.loan_amount,
                        status: 'active', store_id: targetStoreId, created_by: profile.id,
                        notes: orderData.notes || '', customer_id: orderData.customer_id || null,
                        is_locked: true, locked_at: nowStr(), locked_by: profile.id,
                        repayment_type: repaymentType, repayment_term: repaymentTerm,
                        monthly_fixed_payment: monthlyFixedPayment, agreed_interest_rate: agreedInterestRate,
                        agreed_service_fee_rate: serviceFeePercent / 100, fixed_paid_months: 0,
                        overdue_days: 0, liquidation_status: 'normal',
                        max_extension_months: orderData.max_extension_months || 10,
                        pawn_term_months: pawnTermMonths,
                        pawn_due_date: pawnDueDate,
                        fund_status: 'deployed',
                        created_at: nowStr(), updated_at: nowStr()
                    };
                    const { data, error } = await supabaseClient.from('orders').insert(newOrderData).select().single();
                    if(error){
                        if(error.code==='23505'){ retryCount++; lastError=error; await new Promise(r=>setTimeout(r,100*(retryCount+1))); continue; }
                        throw error;
                    }
                    newOrder = data;
                    console.log('✅ 订单创建成功: ' + orderId + 
                        (pawnTermMonths ? ` | 典当期限: ${pawnTermMonths}个月 | 到期日: ${pawnDueDate}` : ''));
                    break;
                } catch(err){
                    if(err.code==='23505' && retryCount<4){ retryCount++; await new Promise(r=>setTimeout(r,100*(retryCount+1))); continue; }
                    throw err;
                }
            }
            if(!newOrder) throw lastError || new Error(Utils.lang==='id'?'Gagal membuat pesanan':'创建订单失败');
            if(window.Audit) await window.Audit.logOrderCreate(newOrder.order_id, orderData.customer_name, orderData.loan_amount);
            return newOrder;
        },

        async recordAdminFee(orderId, paymentMethod, adminFeeAmount) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const order = await this.getOrder(orderId);
            const profile = await this.getCurrentProfile();
            const feeAmount = adminFeeAmount || order.admin_fee;
            const { error: e1 } = await supabaseClient.from('orders').update({
                admin_fee_paid: true, admin_fee_paid_date: todayStr(),
                admin_fee: feeAmount, updated_at: nowStr()
            }).eq('order_id', orderId);
            if(e1) throw e1;
            const paymentData = {
                order_id: order.id, date: todayStr(), type:'admin_fee',
                amount: feeAmount, description: Utils.t('admin_fee'),
                recorded_by: profile.id, payment_method: paymentMethod
            };
            await supabaseClient.from('payment_history').insert(paymentData);
            await this.recordCashFlow({
                store_id: order.store_id, flow_type:'admin_fee', direction:'inflow',
                amount: feeAmount, source_target: paymentMethod, order_id: order.id,
                customer_id: order.customer_id, description: Utils.t('admin_fee') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            if(window.Audit) await window.Audit.logPayment(order.order_id, 'admin_fee', feeAmount, paymentMethod);
            return true;
        },

        async recordServiceFee(orderId, months, paymentMethod) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const order = await this.getOrder(orderId);
            if(order.service_fee_percent<=0 && order.service_fee_amount<=0) return true;
            if(order.service_fee_paid>0) return true;
            const totalServiceFee = order.service_fee_amount || 0;
            if(totalServiceFee<=0) return true;
            const { error: e1 } = await supabaseClient.from('orders').update({
                service_fee_paid: totalServiceFee, updated_at: nowStr()
            }).eq('order_id', orderId);
            if(e1) throw e1;
            const paymentData = {
                order_id: order.id, date: todayStr(), type:'service_fee',
                months:1, amount: totalServiceFee, description: Utils.t('service_fee'),
                recorded_by: (await this.getCurrentProfile()).id, payment_method: paymentMethod
            };
            await supabaseClient.from('payment_history').insert(paymentData);
            await this.recordCashFlow({
                store_id: order.store_id, flow_type:'service_fee', direction:'inflow',
                amount: totalServiceFee, source_target: paymentMethod, order_id: order.id,
                customer_id: order.customer_id, description: Utils.t('service_fee') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            if(window.Audit) await window.Audit.logPayment(order.order_id, 'service_fee', totalServiceFee, paymentMethod);
            return true;
        },

        /* 统一利息少付逻辑 - 确保前后端一致 */
        async recordInterestPayment(orderId, months, paymentMethod, actualPaid=null) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const profile = await this.getCurrentProfile();
            const currentOrder = await this.getOrder(orderId);
            if(currentOrder.status==='completed') throw new Error(Utils.t('order_completed'));

            try {
                const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
                const remainPrincipal = (currentOrder.loan_amount||0) - (currentOrder.principal_paid||0);
                const theoreticalInterest = remainPrincipal * monthlyRate * months;
                let paidAmount = (actualPaid!==null && !isNaN(actualPaid) && actualPaid>0) ? actualPaid : theoreticalInterest;
                let interestToRecord = paidAmount, principalAdjustment=0, shortfallToTrack=0;
                
                /* 统一少付/超额处理逻辑 */
                if(paidAmount >= theoreticalInterest){
                    interestToRecord = theoreticalInterest;
                    principalAdjustment = paidAmount - theoreticalInterest;
                } else {
                    interestToRecord = paidAmount;
                    shortfallToTrack = theoreticalInterest - paidAmount;
                }
                
                const newPaidMonths = (currentOrder.interest_paid_months||0) + months;
                const newPaidTotal = (currentOrder.interest_paid_total||0) + interestToRecord;
                const newShortfall = (currentOrder.interest_shortfall||0) + shortfallToTrack;
                const maxMonths = currentOrder.max_extension_months || 10;
                if(newPaidMonths>maxMonths && newShortfall>0){
                    throw new Error(Utils.lang==='id'?`❌ Mencapai batas maksimum perpanjangan (${maxMonths} bulan)`:`❌ 已达到最大延期期限 (${maxMonths}个月)`);
                }
                const originalState = {
                    interest_paid_months: currentOrder.interest_paid_months,
                    interest_paid_total: currentOrder.interest_paid_total,
                    next_interest_due_date: currentOrder.next_interest_due_date,
                    monthly_interest: currentOrder.monthly_interest,
                    updated_at: currentOrder.updated_at,
                    interest_shortfall: currentOrder.interest_shortfall||0,
                    principal_paid: currentOrder.principal_paid,
                    principal_remaining: currentOrder.principal_remaining,
                    status: currentOrder.status
                };
                const nextDue = this.calculateNextDueDate(currentOrder.created_at, newPaidMonths);
                const updates = {
                    interest_paid_months: newPaidMonths,
                    interest_paid_total: newPaidTotal,
                    interest_shortfall: newShortfall,
                    next_interest_due_date: nextDue,
                    monthly_interest: remainPrincipal * monthlyRate,
                    fund_status: 'extended',
                    updated_at: nowStr()
                };
                if(principalAdjustment>0){
                    const newPrincipalPaid = (currentOrder.principal_paid||0) + principalAdjustment;
                    const newPrincipalRemaining = (currentOrder.loan_amount||0) - newPrincipalPaid;
                    updates.principal_paid = newPrincipalPaid;
                    updates.principal_remaining = newPrincipalRemaining;
                    if(newPrincipalRemaining<=0){
                        updates.status = 'completed';
                        updates.completed_at = nowStr();
                    }
                }
                
                const { error: updateErr } = await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
                if(updateErr) throw updateErr;
                
                if(interestToRecord>0){
                    const paymentData = {
                        order_id: currentOrder.id, date: todayStr(), type:'interest',
                        months, amount: interestToRecord,
                        description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang==='id'?'bulan':'个月') + ' (' + (monthlyRate*100).toFixed(1)+'%)',
                        recorded_by: profile.id, payment_method: paymentMethod
                    };
                    const { error: payErr } = await supabaseClient.from('payment_history').insert(paymentData);
                    if(payErr){
                        await supabaseClient.from('orders').update(originalState).eq('order_id', orderId);
                        throw payErr;
                    }
                    await this.recordCashFlow({
                        store_id: currentOrder.store_id, flow_type:'interest', direction:'inflow',
                        amount: interestToRecord, source_target: paymentMethod, order_id: currentOrder.id,
                        customer_id: currentOrder.customer_id,
                        description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang==='id'?'bulan':'个月'),
                        reference_id: currentOrder.order_id
                    });
                }
                if(principalAdjustment>0){
                    await supabaseClient.from('payment_history').insert({
                        order_id: currentOrder.id, date: todayStr(), type:'principal',
                        amount: principalAdjustment,
                        description: (Utils.lang==='id'?'Kelebihan bunga dipotong pokok':'超额利息抵扣本金'),
                        recorded_by: profile.id, payment_method: paymentMethod
                    });
                    await this.recordCashFlow({
                        store_id: currentOrder.store_id, flow_type:'principal', direction:'inflow',
                        amount: principalAdjustment, source_target: paymentMethod, order_id: currentOrder.id,
                        customer_id: currentOrder.customer_id,
                        description: (Utils.lang==='id'?'Kelebihan bunga dipotong pokok':'超额利息抵扣本金'),
                        reference_id: currentOrder.order_id
                    });
                }
                if(shortfallToTrack>0) console.warn(`订单 ${orderId} 利息少付 ${Utils.formatCurrency(shortfallToTrack)}`);
                if(window.Audit) await window.Audit.logPayment(currentOrder.order_id, 'interest', interestToRecord, paymentMethod);
                return { paidAmount, interestToRecord, shortfall: shortfallToTrack };
            } catch (error) {
                throw error;
            }
        },

        async recordPrincipalPayment(orderId, amount, paymentMethod) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const profile = await this.getCurrentProfile();
            const currentOrder = await this.getOrder(orderId);
            if(currentOrder.status==='completed') throw new Error(Utils.t('order_completed'));
            const remaining = (currentOrder.loan_amount||0) - (currentOrder.principal_paid||0);
            if(remaining<=0) throw new Error(Utils.lang==='id'?'Pokok sudah lunas':'本金已结清');
            let paid = Math.min(amount, remaining);
            if(paid<=0) throw new Error(Utils.t('invalid_amount'));
            const newPaid = (currentOrder.principal_paid||0) + paid;
            const newRemaining = (currentOrder.loan_amount||0) - newPaid;
            const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            let updates = { principal_paid: newPaid, principal_remaining: newRemaining, updated_at: nowStr() };
            const isFull = newRemaining <= 0;
            if(isFull){
                updates.status = 'completed';
                updates.monthly_interest = 0;
                updates.fund_status = 'returned';
                updates.completed_at = nowStr();
            } else {
                updates.monthly_interest = newRemaining * monthlyRate;
            }
            const { error: updErr } = await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
            if(updErr) throw updErr;
            await supabaseClient.from('payment_history').insert({
                order_id: currentOrder.id, date: todayStr(), type:'principal',
                amount: paid,
                description: isFull ? (Utils.lang==='id'?'LUNAS':'结清') : (Utils.lang==='id'?'Pembayaran pokok':'还款'),
                recorded_by: profile.id, payment_method: paymentMethod
            });
            await this.recordCashFlow({
                store_id: currentOrder.store_id, flow_type:'principal', direction:'inflow',
                amount: paid, source_target: paymentMethod, order_id: currentOrder.id,
                customer_id: currentOrder.customer_id,
                description: isFull ? (Utils.lang==='id'?'LUNAS':'结清') : (Utils.lang==='id'?'Pembayaran pokok':'还款'),
                reference_id: currentOrder.order_id
            });
            if(window.Audit) await window.Audit.logPayment(currentOrder.order_id, 'principal', paid, paymentMethod);
            return true;
        },

        async recordFixedPayment(orderId, paymentMethod) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const profile = await this.getCurrentProfile();
            const order = await this.getOrder(orderId);
            if(order.status==='completed') throw new Error(Utils.t('order_completed'));
            if(order.repayment_type!=='fixed') throw new Error(Utils.lang==='id'?'Bukan cicilan tetap':'不是固定还款');
            const fixedPayment = order.monthly_fixed_payment;
            const paidMonths = order.fixed_paid_months||0;
            const remainMonths = order.repayment_term - paidMonths;
            if(remainMonths<=0) throw new Error(Utils.lang==='id'?'Pesanan sudah lunas':'订单已结清');
            if(fixedPayment<=0) throw new Error(Utils.lang==='id'?'Jumlah angsuran tidak valid':'还款金额无效');
            const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
            const interestAmt = order.principal_remaining * monthlyRate;
            let principalAmt = fixedPayment - interestAmt;
            if(principalAmt<0) principalAmt=0;
            const newPrincipalPaid = (order.principal_paid||0) + principalAmt;
            const newPrincipalRemaining = order.loan_amount - newPrincipalPaid;
            const newFixedPaid = paidMonths + 1;
            const isCompleted = newFixedPaid >= order.repayment_term || newPrincipalRemaining <= 0;
            const newMonthlyInterest = Math.max(0, (newPrincipalRemaining > 0 ? newPrincipalRemaining * monthlyRate : 0));
            const updates = {
                principal_paid: newPrincipalPaid, principal_remaining: newPrincipalRemaining,
                fixed_paid_months: newFixedPaid, monthly_interest: newMonthlyInterest,
                interest_paid_months: (order.interest_paid_months||0) + 1,
                interest_paid_total: (order.interest_paid_total||0) + interestAmt,
                next_interest_due_date: this.calculateNextDueDate(order.created_at, newFixedPaid),
                updated_at: nowStr()
            };
            if(isCompleted){ updates.status='completed'; updates.fund_status='returned'; updates.completed_at=nowStr(); }
            await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
            if(interestAmt>0){
                await supabaseClient.from('payment_history').insert({
                    order_id: order.id, date: todayStr(), type:'interest', months:1,
                    amount: interestAmt, description: (Utils.lang==='id'?'Cicilan tetap - Bunga':'固定还款-利息') + ' ' + newFixedPaid,
                    recorded_by: profile.id, payment_method: paymentMethod
                });
                await this.recordCashFlow({
                    store_id: order.store_id, flow_type:'interest', direction:'inflow',
                    amount: interestAmt, source_target: paymentMethod, order_id: order.id,
                    customer_id: order.customer_id,
                    description: (Utils.lang==='id'?'Cicilan tetap bunga':'固定还款利息') + ' - ' + order.order_id,
                    reference_id: order.order_id
                });
            }
            if(principalAmt>0){
                await supabaseClient.from('payment_history').insert({
                    order_id: order.id, date: todayStr(), type:'principal',
                    amount: principalAmt, description: (Utils.lang==='id'?'Cicilan tetap - Pokok':'固定还款-本金') + ' ' + newFixedPaid,
                    recorded_by: profile.id, payment_method: paymentMethod
                });
                await this.recordCashFlow({
                    store_id: order.store_id, flow_type:'principal', direction:'inflow',
                    amount: principalAmt, source_target: paymentMethod, order_id: order.id,
                    customer_id: order.customer_id,
                    description: (Utils.lang==='id'?'Cicilan tetap pokok':'固定还款本金') + ' - ' + order.order_id,
                    reference_id: order.order_id
                });
            }
            if(window.Audit) await window.Audit.logPayment(order.order_id, 'fixed_installment', fixedPayment, paymentMethod);
            return true;
        },

        async earlySettleFixedOrder(orderId, paymentMethod) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const profile = await this.getCurrentProfile();
            const order = await this.getOrder(orderId);
            if(order.status==='completed') throw new Error(Utils.t('order_completed'));
            if(order.repayment_type!=='fixed') throw new Error(Utils.lang==='id'?'Bukan cicilan tetap':'不是固定还款');
            const remaining = order.principal_remaining;
            await supabaseClient.from('payment_history').insert({
                order_id: order.id, date: todayStr(), type:'principal',
                amount: remaining, description: Utils.lang==='id'?'Pelunasan dipercepat':'提前结清',
                recorded_by: profile.id, payment_method: paymentMethod
            });
            await this.recordCashFlow({
                store_id: order.store_id, flow_type:'principal', direction:'inflow',
                amount: remaining, source_target: paymentMethod, order_id: order.id,
                customer_id: order.customer_id,
                description: (Utils.lang==='id'?'Pelunasan dipercepat':'提前结清') + ' - ' + order.order_id,
                reference_id: order.order_id
            });
            const { error } = await supabaseClient.from('orders').update({
                status:'completed', principal_paid: order.loan_amount, principal_remaining:0,
                monthly_interest: 0,
                fund_status:'returned', completed_at: nowStr(), updated_at: nowStr()
            }).eq('order_id', orderId);
            if(error) throw error;
            if(window.Audit) await window.Audit.logPayment(order.order_id, 'early_settlement', remaining, paymentMethod);
            Utils.toast.success(Utils.lang==='id'?'Pelunasan dipercepat berhasil!':'提前结清成功！');
            return true;
        },

        /* updateOverdueDays 失败时写入审计日志 */
        async updateOverdueDays() {
            if(!supabaseClient) return false;
            const { data: activeOrders, error } = await supabaseClient
                .from('orders')
                .select('id, next_interest_due_date, overdue_days, liquidation_status, fund_status')
                .eq('status', 'active');
            if(error) throw error;
            if(!activeOrders?.length) return true;
            const today = new Date(); today.setHours(0,0,0,0);
            const updates = [];
            for(const o of activeOrders){
                if(!o.next_interest_due_date) continue;
                const due = new Date(o.next_interest_due_date); due.setHours(0,0,0,0);
                let overdue = 0;
                if(today > due) overdue = Math.floor((today - due)/86400000);
                let status = o.liquidation_status||'normal';
                let fund = o.fund_status;
                if(overdue>=30){ status='auction'; fund='forfeited'; }
                else if(overdue>=20) status='pre_auction';
                else if(overdue>=10) status='collection';
                else status='normal';
                if(overdue!==o.overdue_days || status!==o.liquidation_status || fund!==o.fund_status){
                    updates.push({ id:o.id, overdue_days:overdue, liquidation_status:status, fund_status:fund });
                }
            }
            if(!updates.length) return true;
            const BATCH=20;
            const results = [];
            const failedOrders = [];
            for(let i=0;i<updates.length;i+=BATCH){
                const batch = updates.slice(i,i+BATCH);
                const batchResults = await Promise.allSettled(
                    batch.map(async (o) => {
                        const { error: updateError } = await supabaseClient.from('orders')
                            .update({ overdue_days:o.overdue_days, liquidation_status:o.liquidation_status, fund_status:o.fund_status, updated_at:nowStr() })
                            .eq('id', o.id);
                        if (updateError) throw updateError;
                        return o.id;
                    })
                );
                for (let j = 0; j < batchResults.length; j++) {
                    const result = batchResults[j];
                    if (result.status === 'rejected') {
                        failedOrders.push({ orderId: batch[j].id, error: result.reason?.message || 'unknown' });
                    }
                }
                results.push(...batchResults);
            }
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.error(`[updateOverdueDays] ${failed.length} 个更新失败:`, failed.map(f => f.reason?.message || 'unknown'));
                /* 写入审计日志 */
                if (window.Audit) {
                    await window.Audit.log('overdue_update_failed', JSON.stringify({
                        failed_count: failed.length,
                        failed_orders: failedOrders.slice(0, 10),
                        timestamp: nowStr()
                    }));
                }
            }
            return failed.length === 0;
        },

        async updateOrder(orderId, updateData, customerId) {
            const currentOrder = await this.getOrder(orderId);
            const sensitive = ['customer_name','customer_ktp','customer_phone','customer_address','collateral_name','loan_amount','admin_fee','service_fee_percent'];
            const isUpdatingSensitive = sensitive.some(f=>updateData.hasOwnProperty(f));
            if(currentOrder.is_locked && isUpdatingSensitive) throw new Error(Utils.t('order_locked'));
            updateData.updated_at = nowStr();
            const { data, error } = await supabaseClient.from('orders').update(updateData).eq('order_id', orderId).select().single();
            if(error) throw error;
            if(customerId && (updateData.customer_name || updateData.customer_phone || updateData.customer_ktp)){
                const cUpd = {};
                if(updateData.customer_name) cUpd.name = updateData.customer_name;
                if(updateData.customer_phone) cUpd.phone = updateData.customer_phone;
                if(updateData.customer_ktp) cUpd.ktp_number = updateData.customer_ktp;
                if(updateData.customer_address){ cUpd.ktp_address = updateData.customer_address; cUpd.address = updateData.customer_address; }
                if(Object.keys(cUpd).length) await supabaseClient.from('customers').update(cUpd).eq('id', customerId);
            }
            return data;
        },

        async unlockOrder(orderId) {
            const profile = await this.getCurrentProfile();
            if(profile?.role!=='admin') throw new Error(Utils.lang==='id'?'Hanya admin':'需管理员权限');
            const { error } = await supabaseClient.from('orders').update({ is_locked:false, locked_at:null, locked_by:null, updated_at:nowStr() }).eq('order_id', orderId);
            if(error) throw error;
            return true;
        },

        async relockOrder(orderId) {
            const profile = await this.getCurrentProfile();
            const { error } = await supabaseClient.from('orders').update({ is_locked:true, locked_at:nowStr(), locked_by:profile.id, updated_at:nowStr() }).eq('order_id', orderId);
            if(error) throw error;
            return true;
        },

        /* deleteOrder 完整清理现金流 */
        async deleteOrder(orderId) {
            const profile = await this.getCurrentProfile();
            if(profile?.role!=='admin') throw new Error(Utils.lang==='id'?'Hanya admin yang dapat menghapus pesanan':'需管理员权限');
            const order = await this.getOrder(orderId);
            
            // 清理 order_id 关联的现金流
            const { error: voidErr1 } = await supabaseClient.from('cash_flow_records')
                .update({ is_voided:true, voided_at:nowStr(), voided_by:profile.id })
                .eq('order_id', order.id);
            if(voidErr1){
                await supabaseClient.from('cash_flow_records').delete().eq('order_id', order.id);
            }
            
            // 清理 reference_id 关联的现金流（重要补充）
            const { error: voidErr2 } = await supabaseClient.from('cash_flow_records')
                .update({ is_voided:true, voided_at:nowStr(), voided_by:profile.id })
                .eq('reference_id', order.order_id);
            if(voidErr2){
                await supabaseClient.from('cash_flow_records').delete().eq('reference_id', order.order_id);
            }
            
            // 清理缴费记录
            await supabaseClient.from('payment_history').delete().eq('order_id', order.id);
            
            // 清理提醒记录
            await supabaseClient.from('reminder_logs').delete().eq('order_id', order.id);
            
            // 最后删除订单
            const { error: delErr } = await supabaseClient.from('orders').delete().eq('order_id', orderId);
            if(delErr) throw delErr;
            
            if(window.Audit) await window.Audit.logOrderDelete(order.order_id, order.customer_name, order.loan_amount, profile?.name);
            return true;
        },

        async getAllPayments() {
            if (!supabaseClient) return [];
            const profile = await this.getCurrentProfile();
            const practiceIds = (profile?.role === 'admin') ? await this._getPracticeStoreIds() : [];
            let orderQuery = supabaseClient.from('orders').select('id, order_id, customer_name');
            if (practiceIds.length > 0) {
                orderQuery = orderQuery.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
            }
            if(profile?.role !== 'admin' && profile?.store_id) {
                orderQuery = orderQuery.eq('store_id', profile.store_id);
            }
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

        async getAllUsers(forceRefresh = false) {
            if (!supabaseClient) return [];
            const now = Date.now();
            
            if(!forceRefresh) {
                try {
                    const lsData = SafeStorage.getItem('jf_cache_users');
                    if(lsData) {
                        const parsed = JSON.parse(lsData);
                        if(parsed && parsed.data && (now - parsed.time) < USERS_TTL) {
                            return parsed.data;
                        } else if(parsed && parsed.data) {
                            SafeStorage.removeItem('jf_cache_users');
                            console.log('[Supabase] 用户缓存已过期，已删除');
                        }
                    }
                } catch(e) { /* ignore */ }
            }
            
            const { data, error } = await supabaseClient.from('user_profiles').select('*, stores(*)').order('name');
            if (error) throw error;
            
            try {
                SafeStorage.setItem('jf_cache_users', JSON.stringify({ data, time: now }));
            } catch(e) { /* ignore */ }
            
            return data;
        },

        async createStore(code, name, address, phone) {
            if (!supabaseClient) throw new Error('客户端未初始化');
            const { data, error } = await supabaseClient.from('stores').insert({ code, name, address, phone }).select().single();
            if (error) throw error;
            if (window.Audit) await window.Audit.logStoreCreate(code, name, AUTH.user?.id);
            return data;
        },

        async updateStore(id, updates) {
            if (!supabaseClient) throw new Error('客户端未初始化');
            const { data, error } = await supabaseClient.from('stores').update(updates).eq('id', id).select().single();
            if (error) throw error;
            if (window.Audit) await window.Audit.logStoreAction(id, 'update', JSON.stringify(updates));
            return data;
        },

        async deleteStore(id) {
            if (!supabaseClient) throw new Error('客户端未初始化');
            const { count, error: ordersError } = await supabaseClient
                .from('orders').select('*', { count: 'exact', head: true }).eq('store_id', id);
            if (ordersError) throw ordersError;
            if (count > 0) throw new Error(Utils.lang === 'id' ? 'Toko memiliki pesanan, tidak dapat dihapus' : '门店有订单，无法删除');
            const { error } = await supabaseClient.from('stores').delete().eq('id', id);
            if (error) throw error;
            if (window.Audit) await window.Audit.logStoreAction(id, 'delete', '');
            return true;
        },

        async getCashFlowSummary(storeIdParam = null) {
            if (!supabaseClient) return { cash: { balance: 0 }, bank: { balance: 0 }, total: { balance: 0 }, netProfit: { operatingIncome: 0, operatingExpense: 0 }, total_injected_capital: 0, deployed_capital: 0, available_capital: 0 };
            
            const profile = await this.getCurrentProfile();
            const isAdmin = profile?.role === 'admin';
            
            let targetStoreId = storeIdParam;
            if (!targetStoreId) {
                if (isAdmin) {
                    targetStoreId = null;
                } else {
                    targetStoreId = profile?.store_id;
                }
            }
            
            let query = supabaseClient.from('cash_flow_records')
                .select('direction, amount, source_target, flow_type, store_id')
                .eq('is_voided', false);
            
            if (targetStoreId) {
                query = query.eq('store_id', targetStoreId);
            } else if (!isAdmin && profile?.store_id) {
                query = query.eq('store_id', profile.store_id);
            }
            if (isAdmin && !targetStoreId) {
                query = await excludePracticeStores(query, profile);
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

            let injectionQuery = supabaseClient.from('capital_injections')
                .select('amount, source')
                .eq('is_voided', false)
                .neq('source', 'profit');
            
            if (targetStoreId) {
                injectionQuery = injectionQuery.eq('store_id', targetStoreId);
            } else if (!isAdmin && profile?.store_id) {
                injectionQuery = injectionQuery.eq('store_id', profile.store_id);
            }
            if (isAdmin && !targetStoreId) {
                injectionQuery = await excludePracticeStores(injectionQuery, profile);
            }
            
            const { data: injections } = await injectionQuery;
            const totalInjectedCapital = (injections || []).reduce((sum, i) => sum + (i.amount || 0), 0);

            let deployedQuery = supabaseClient.from('orders')
                .select('loan_amount')
                .eq('status', 'active');
            
            if (targetStoreId) {
                deployedQuery = deployedQuery.eq('store_id', targetStoreId);
            } else if (!isAdmin && profile?.store_id) {
                deployedQuery = deployedQuery.eq('store_id', profile.store_id);
            }
            if (isAdmin && !targetStoreId) {
                deployedQuery = await excludePracticeStores(deployedQuery, profile);
            }
            
            const { data: deployedOrders } = await deployedQuery;
            const deployedCapital = (deployedOrders || []).reduce((sum, o) => sum + (o.loan_amount || 0), 0);

            return {
                cash: { income: cashIn, expense: cashOut, netIncome: cashIn - cashOut, balance: cashIn - cashOut },
                bank: { income: bankIn, expense: bankOut, netIncome: bankIn - bankOut, balance: bankIn - bankOut },
                total: { income: cashIn + bankIn, expense: cashOut + bankOut, netIncome: (cashIn + bankIn) - (cashOut + bankOut), balance: (cashIn - cashOut) + (bankIn - bankOut) },
                netProfit: { balance: operatingIncome - operatingExpense, operatingIncome, operatingExpense },
                total_injected_capital: totalInjectedCapital,
                deployed_capital: deployedCapital,
                available_capital: totalInjectedCapital - deployedCapital
            };
        },

        async getStoreWANumber(storeId) {
            if (!supabaseClient) return null;
            const { data, error } = await supabaseClient.from('stores').select('wa_number').eq('id', storeId).single();
            if (error && error.code !== 'PGRST116') return null;
            return data?.wa_number || null;
        },

        async updateStoreWANumber(storeId, waNumber) {
            if (!supabaseClient) throw new Error('客户端未初始化');
            const { error } = await supabaseClient.from('stores').update({ wa_number: waNumber || null, updated_at: Utils.getLocalDateTime() }).eq('id', storeId);
            if (error) throw error;
            return true;
        },

        async hasReminderSentToday(orderId) {
            if (!supabaseClient) return false;
            const today = Utils.getLocalToday();
            const { data, error } = await supabaseClient.from('reminder_logs').select('id').eq('order_id', orderId).eq('reminder_date', today).maybeSingle();
            if (error) throw error;
            return !!data;
        },

        async logReminder(orderId) {
            if (!supabaseClient) return false;
            const profile = await this.getCurrentProfile();
            const today = Utils.getLocalToday();
            const { error } = await supabaseClient.from('reminder_logs').insert({ order_id: orderId, reminder_date: today, sent_by: profile?.id || null, created_at: Utils.getLocalDateTime() });
            if (error) throw error;
            return true;
        },

        async getOrdersNeedReminder() {
            if (!supabaseClient) return [];
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
            if (!supabaseClient) return '-';
            const { data, error } = await supabaseClient.from('stores').select('name').eq('id', storeId).single();
            if (error) return '-';
            return data?.name || '-';
        },

        async recordInternalTransfer(transferData) {
            if (!supabaseClient) throw new Error('客户端未初始化');
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
                transfer_type: transferData.transfer_type, from_account: transferData.from_account,
                to_account: transferData.to_account, amount: transferData.amount,
                description: transferData.description || '',
                store_id: transferData.store_id || profile?.store_id,
                created_by: profile?.id, created_at: Utils.getLocalDateTime()
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
                    amount: transferData.amount, source_target: transferData.to_account,
                    description: Utils.lang === 'id' ? 'Transfer masuk' : '转入',
                    reference_id: data.id
                });
            }
            return data;
        },

        async getInternalTransfers(storeId, startDate, endDate) {
            if (!supabaseClient) return [];
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
            if (!supabaseClient) return { cash_balance: 0, bank_balance: 0, total_balance: 0 };
            const targetStoreId = storeId || await this.getCurrentStoreId();
            if (!targetStoreId) return { cash_balance: 0, bank_balance: 0, total_balance: 0 };
            
            let query = supabaseClient.from('cash_flow_records')
                .select('direction, amount, source_target')
                .eq('store_id', targetStoreId)
                .eq('is_voided', false);
            
            const { data: flows, error } = await query;
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
            if (!supabaseClient) throw new Error('客户端未初始化');
            const profile = await this.getCurrentProfile();
            if (profile?.role !== 'admin') throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat menyetor ke pusat' : '需管理员权限');
            const shop = await this.getShopAccount(storeId);
            if (shop.bank_balance < amount) throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            return await this.recordInternalTransfer({
                transfer_type: 'store_to_hq', from_account: 'bank', to_account: 'hq',
                amount: amount,
                description: description || (Utils.lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部'),
                store_id: storeId
            });
        },

        /* RPC 调用前检查函数是否存在 */
        async ensureInterestShortfallColumn() {
            try {
                const session = await this.getSession();
                if (!session) {
                    console.log('[Supabase] 无有效会话，跳过列检查');
                    return;
                }
                
                const { data, error } = await supabaseClient
                    .from('orders')
                    .select('interest_shortfall')
                    .limit(1);
                    
                if (error) {
                    if (error.message && error.message.includes('column "interest_shortfall" does not exist')) {
                        console.log('[Supabase] interest_shortfall 列不存在，尝试添加...');
                        try {
                            /* 先检查 RPC 函数是否存在 */
                            let rpcExists = false;
                            try {
                                const { data: funcCheck } = await supabaseClient.rpc('check_function_exists', { 
                                    function_name: 'add_interest_shortfall_column' 
                                });
                                rpcExists = !!funcCheck;
                            } catch (checkErr) {
                                // 如果 check_function_exists 不存在，尝试直接调用
                                console.warn('[Supabase] 无法检查 RPC 是否存在，尝试直接调用');
                                rpcExists = true; // 假设存在，让 try-catch 处理
                            }
                            
                            if (rpcExists) {
                                const { error: alterError } = await supabaseClient.rpc('add_interest_shortfall_column');
                                if (alterError) {
                                    console.warn('[Supabase] 无法自动添加 interest_shortfall 列');
                                    console.warn('[Supabase] 请在 Supabase SQL Editor 中执行:');
                                    console.warn('ALTER TABLE orders ADD COLUMN interest_shortfall BIGINT DEFAULT 0;');
                                } else {
                                    console.log('[Supabase] ✅ interest_shortfall 列已添加');
                                }
                            } else {
                                console.warn('[Supabase] RPC 函数 add_interest_shortfall_column 不存在');
                                console.warn('[Supabase] 请在 Supabase SQL Editor 中执行:');
                                console.warn('ALTER TABLE orders ADD COLUMN interest_shortfall BIGINT DEFAULT 0;');
                            }
                        } catch (alterException) {
                            console.warn('[Supabase] 添加列失败:', alterException.message);
                            console.warn('[Supabase] 请在 Supabase SQL Editor 中手动执行:');
                            console.warn('ALTER TABLE orders ADD COLUMN interest_shortfall BIGINT DEFAULT 0;');
                        }
                    } else if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                        console.log('[Supabase] 认证已过期，跳过列检查');
                    } else {
                        console.warn('[Supabase] 列检查查询失败:', error.message);
                    }
                }
            } catch (e) {
                console.warn('[Supabase] 检查 interest_shortfall 列异常:', e.message);
            }
        },
    };

    // 延迟列检查
    setTimeout(() => safeQuery(() => SupabaseAPI.ensureInterestShortfallColumn?.()), 5000);

    JF.Supabase = SupabaseAPI;
    window.SUPABASE = SupabaseAPI;
    console.log('✅ JF.Supabase v2.0');
})();
