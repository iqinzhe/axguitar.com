// supabase.js - v2.5.1 紧急修复 (deleteStore、earlySettle、updateCustomer、逾期更新容错、利息归零、锁密钥统一)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 安全存储 ====================
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

    // ==================== Supabase 客户端 ====================
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
    const STORES_TTL = 3600000;
    const USERS_TTL = 3600000;

    const safeQuery = async (fn, fallback = null, silent = false) => {
        try {
            return await fn();
        } catch(error) {
            if(!silent) console.warn('[Supabase]', error.message || error);
            if(error.status===401 || (error.message && (error.message.includes('JWT')||error.message.includes('session')))){
                setTimeout(() => JF.DashboardCore?.logout?.(), 1000);
            }
            return fallback;
        }
    };

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

    // ==================== 主 API ====================
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
            try {
                SafeStorage.removeItem('jf_cache_stores');
                SafeStorage.removeItem('jf_cache_users');
            } catch(e) {}
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
                        }
                    }
                } catch(e) {}
            }
            try {
                const { data } = await supabaseClient.from('stores').select('*').order('code');
                _storesCache = data;
                _storesCacheTime = now;
                (data||[]).forEach(s=>{ if(s.prefix){ _storePrefixCache.set(s.id, s.prefix); _storePrefixCache.set(s.code, s.prefix); } });
                try { SafeStorage.setItem('jf_cache_stores', JSON.stringify({ data, time: now })); } catch(e) {}
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
                return { is_active: data?.is_active !== false, name: data?.name || '' };
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

        async _getPracticeStoreIds() {
            const stores = await this.getAllStores();
            return stores.filter(s => s.is_practice).map(s => s.id);
        },

        // ---------- 客户 ----------
        async createCustomer(customerData) { /* 不变 */ },

        async updateCustomer(customerId, customerData) {
            const updates = {
                name: customerData.name, phone: customerData.phone,
                ktp_number: customerData.ktp_number || null,
                ktp_address: customerData.ktp_address || null,
                address: customerData.address || null,   // ❗ 修复：单独使用 address 字段
                living_same_as_ktp: customerData.living_same_as_ktp,
                living_address: customerData.living_address || null,
                occupation: customerData.occupation || null,
                updated_at: nowStr()
            };
            const { error } = await supabaseClient.from('customers').update(updates).eq('id', customerId);
            if(error) throw error;
            return true;
        },

        async getCustomers(filters={}) { /* 不变 */ },

        async getCustomer(customerId) {
            const { data, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if(error) throw error;
            return data;
        },

        // ---------- 黑名单 ----------
        async checkBlacklist(customerId) { /* 不变 */ },
        async addToBlacklist(customerId, reason, blacklistedBy) { /* 不变 */ },
        async removeFromBlacklist(customerId) { /* 不变 */ },
        async getBlacklist(filterStoreId=null, profile=null) { /* 不变 */ },
        escapePostgRESTValue(str) { /* 不变 */ },
        async checkDuplicateCustomer(name, ktpNumber, phone, excludeCustomerId=null) { /* 不变 */ },
        async checkBlacklistDuplicate(ktp, phone) { /* 不变 */ },
        async getCustomerOrdersStats(customerId) { /* 不变 */ },
        async getCustomerOrdersByStatus(customerId, statusType) { /* 不变 */ },
        calculateNextDueDate(startDate, paidMonths) { return Utils.calculateNextDueDate(startDate, paidMonths); },

        // ---------- 资金流水 ----------
        async recordCashFlow(flowData) { /* 不变 */ },

        async updateExpenseWithCashFlow(expenseId, updates) { /* 不变 */ },
        async deleteExpenseWithCashFlow(expenseId) { /* 不变 */ },

        async addExpense(expenseData) { /* 不变 */ },

        async recordLoanDisbursement(orderId, amount, source, description) { /* 不变 */ },

        async recordCapitalInjection(storeId, amount, source, description) { /* 不变 */ },

        async getFullCapitalAnalysis(storeIdParam = null) { /* 不变 */ },
        async getDistributableProfit(storeId) { /* 不变 */ },
        async getExternalCapitalBalance(storeId) { /* 不变 */ },
        async distributeProfit(storeId, amount, type, description) { /* 不变 */ },

        // ---------- 订单 ----------
        async getOrders(filters={}, from, to) { /* 不变 */ },
        async getOrdersLegacy(filters) { /* 不变 */ },
        async getOrder(orderId) { /* 不变 */ },
        async getPaymentHistory(orderId) { /* 不变 */ },

        async createOrder(orderData) { /* 不变 */ },

        async recordAdminFee(orderId, paymentMethod, adminFeeAmount) { /* 不变 */ },
        async recordServiceFee(orderId, months, paymentMethod) { /* 不变 */ },

        // 【修复 3】移除内部锁，由外层统一管理
        async recordInterestPayment(orderId, months, paymentMethod, actualPaid=null) {
            if(paymentMethod===undefined) paymentMethod='cash';
            const profile = await this.getCurrentProfile();
            const currentOrder = await this.getOrder(orderId);
            if(currentOrder.status==='completed') throw new Error(Utils.t('order_completed'));

            // 不再获取内部锁，外层已加锁
            try {
                const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
                const remainPrincipal = (currentOrder.loan_amount||0) - (currentOrder.principal_paid||0);
                const theoreticalInterest = remainPrincipal * monthlyRate * months;
                let paidAmount = (actualPaid!==null && !isNaN(actualPaid) && actualPaid>0) ? actualPaid : theoreticalInterest;
                let interestToRecord = paidAmount, principalAdjustment=0, shortfallToTrack=0;
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
                    interest_shortfall: currentOrder.interest_shortfall||0
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
                // 不再有 loan_amount 修改
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
            } finally {
                // 外层锁由 app-payments 管理
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
            // 【修复 8】确保 monthly_interest 非负
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

        // 【修复 4】earlySettle 添加 monthly_interest:0
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
                monthly_interest: 0,   // ❗ 修复
                fund_status:'returned', completed_at: nowStr(), updated_at: nowStr()
            }).eq('order_id', orderId);
            if(error) throw error;
            if(window.Audit) await window.Audit.logPayment(order.order_id, 'early_settlement', remaining, paymentMethod);
            Utils.toast.success(Utils.lang==='id'?'Pelunasan dipercepat berhasil!':'提前结清成功！');
            return true;
        },

        // 【修复 7】逾期更新增加错误处理
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
            for(let i=0;i<updates.length;i+=BATCH){
                const batch = updates.slice(i,i+BATCH);
                const batchResults = await Promise.allSettled(
                    batch.map(o =>
                        supabaseClient.from('orders')
                            .update({ overdue_days:o.overdue_days, liquidation_status:o.liquidation_status, fund_status:o.fund_status, updated_at:nowStr() })
                            .eq('id', o.id)
                    )
                );
                results.push(...batchResults);
            }
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                console.error(`[updateOverdueDays] ${failed.length} 个更新失败:`, failed.map(f => f.reason?.message || 'unknown'));
            }
            return failed.length === 0;
        },

        async updateOrder(orderId, updateData, customerId) { /* 不变 */ },
        async unlockOrder(orderId) { /* 不变 */ },
        async relockOrder(orderId) { /* 不变 */ },
        async deleteOrder(orderId) { /* 不变 */ },

        async getAllPayments() { /* 不变 */ },
        async getAllUsers(forceRefresh = false) { /* 不变 */ },

        async createStore(code, name, address, phone) { /* 不变 */ },
        async updateStore(id, updates) { /* 不变 */ },

        // 【修复 1】deleteStore 使用 count 判断
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

        async getCashFlowSummary(storeIdParam = null) { /* 不变 */ },
        async getStoreWANumber(storeId) { /* 不变 */ },
        async updateStoreWANumber(storeId, waNumber) { /* 不变 */ },
        async hasReminderSentToday(orderId) { /* 不变 */ },
        async logReminder(orderId) { /* 不变 */ },
        async getOrdersNeedReminder() { /* 不变 */ },
        async getStoreName(storeId) { /* 不变 */ },
        async recordInternalTransfer(transferData) { /* 不变 */ },
        async getInternalTransfers(storeId, startDate, endDate) { /* 不变 */ },
        async getShopAccount(storeId) { /* 不变 */ },
        async remitToHeadquarters(storeId, amount, description) { /* 不变 */ },

        async ensureInterestShortfallColumn() { /* 不变 */ },
    };

    setTimeout(() => safeQuery(() => SupabaseAPI.ensureInterestShortfallColumn?.()), 5000);

    JF.Supabase = SupabaseAPI;
    window.SUPABASE = SupabaseAPI;
    console.log('✅ JF.Supabase v2.5.1 修复完成');
})();
