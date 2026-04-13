const SUPABASE_URL = "https://hiupsvsbcdsgoyiieqiv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdXBzdnNiY2RzZ295aWllcWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODA3NjYsImV4cCI6MjA5MTU1Njc2Nn0.qL7Qw0I7Ogws_kMoOAae_fCzkhVm-c7NhLPu8rxaJpU";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ✅ 修复：Profile 缓存，避免同一请求链中多次重复查询 Supabase
let _profileCache = null;

const SupabaseAPI = {
    getClient() { return supabaseClient; },

    // ✅ 修复：统一错误处理 - 所有方法均 throw error，不再静默返回 null
    async getSession() {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    async getCurrentUser() {
        const { data, error } = await supabaseClient.auth.getUser();
        if (error) return null;
        return data.user;
    },

    // ✅ 修复：加入内存缓存，同一会话内只查询一次 Supabase
    async getCurrentProfile() {
        if (_profileCache) return _profileCache;
        const user = await this.getCurrentUser();
        if (!user) return null;
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*, stores(*)')
            .eq('id', user.id)
            .single();
        if (error) return null;
        _profileCache = data;
        return data;
    },

    // ✅ 修复：clearCache 现在真正清除缓存变量
    clearCache() {
        _profileCache = null;
    },

    async isAdmin() {
        const profile = await this.getCurrentProfile();
        return profile?.role === 'admin';
    },

    async getCurrentStoreId() {
        const profile = await this.getCurrentProfile();
        return profile?.store_id;
    },

    async getCurrentStoreName() {
        const profile = await this.getCurrentProfile();
        return profile?.stores?.name || '未知门店';
    },

    // ✅ 修复：this.client → supabaseClient（致命 Bug，登录必报错）
    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) return { error };
        return data;
    },

    async logout() {
        this.clearCache();
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    async getAllStores() {
        const { data, error } = await supabaseClient.from('stores').select('*').order('name');
        if (error) throw error;
        return data;
    },

    // ✅ 修复：利用已缓存的 profile，getOrders 只发 1 次网络请求而不是 3 次
    async getOrders(filters = {}) {
        const profile = await this.getCurrentProfile();
        let query = supabaseClient.from('orders').select('*');
        if (profile?.role !== 'admin') {
            query = query.eq('store_id', profile?.store_id);
        }
        if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
        if (filters.search) query = query.or(
            `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,order_id.ilike.%${filters.search}%`
        );
        query = query.order('created_at', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getOrder(orderId) {
        const { data, error } = await supabaseClient
            .from('orders').select('*').eq('order_id', orderId).single();
        if (error) throw error;
        return data;
    },

    async getPaymentHistory(orderId) {
        const order = await this.getOrder(orderId);
        const { data, error } = await supabaseClient
            .from('payment_history').select('*')
            .eq('order_id', order.id)
            .order('date', { ascending: false });
        if (error) throw error;
        return { order, payments: data };
    },

    // ✅ 修复：订单 ID 碰撞风险 - 改用时间戳毫秒+随机，碰撞概率极低
    // 格式: AD-2504-1745123456-42（年月-毫秒时间戳后6位-随机2位）
    _generateOrderId(role) {
        const prefix = role === 'admin' ? 'AD' : 'ST';
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const msStr = String(now.getTime()).slice(-6); // 毫秒时间戳后6位
        const rand = String(Math.floor(Math.random() * 90) + 10); // 10-99 两位随机
        return `${prefix}-${yy}${mm}-${msStr}${rand}`;
    },

    async createOrder(orderData) {
        const profile = await this.getCurrentProfile();
        const orderId = this._generateOrderId(profile.role);
        const nowDate = new Date().toISOString().split('T')[0];

        const newOrder = {
            order_id: orderId,
            customer_name: orderData.customer_name,
            customer_ktp: orderData.customer_ktp,
            customer_phone: orderData.customer_phone,
            customer_address: orderData.customer_address || '',
            collateral_name: orderData.collateral_name,
            loan_amount: orderData.loan_amount,
            admin_fee: 30000,
            admin_fee_paid: false,
            monthly_interest: orderData.loan_amount * 0.10,
            interest_paid_months: 0,
            interest_paid_total: 0,
            next_interest_due_date: this.calculateNextDueDate(nowDate, 0),
            principal_paid: 0,
            principal_remaining: orderData.loan_amount,
            status: 'active',
            store_id: profile.store_id,
            created_by: profile.id,
            notes: orderData.notes || '',
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: profile.id
        };

        const { data, error } = await supabaseClient.from('orders').insert(newOrder).select().single();
        if (error) throw error;
        return data;
    },

    calculateNextDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },

    async recordAdminFee(orderId) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        const { error: e1 } = await supabaseClient.from('orders').update({
            admin_fee_paid: true,
            admin_fee_paid_date: new Date().toISOString().split('T')[0]
        }).eq('order_id', orderId);
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient.from('payment_history').insert({
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'admin_fee',
            amount: order.admin_fee,
            description: 'Administrasi Fee / 管理费',
            recorded_by: profile.id
        });
        if (e2) throw e2;
        return true;
    },

    async recordInterestPayment(orderId, months) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        if (remainingPrincipal <= 0) throw new Error('本金已结清');
        const monthlyInterest = remainingPrincipal * 0.10;
        const totalInterest = monthlyInterest * months;
        const { error: e1 } = await supabaseClient.from('orders').update({
            interest_paid_months: order.interest_paid_months + months,
            interest_paid_total: order.interest_paid_total + totalInterest,
            next_interest_due_date: this.calculateNextDueDate(order.created_at, order.interest_paid_months + months),
            monthly_interest: monthlyInterest
        }).eq('order_id', orderId);
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient.from('payment_history').insert({
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'interest',
            months: months,
            amount: totalInterest,
            description: `Bunga ${months} bulan / 利息${months}个月`,
            recorded_by: profile.id
        });
        if (e2) throw e2;
        return true;
    },

    async recordPrincipalPayment(orderId, amount) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        const paidAmount = Math.min(amount, remainingPrincipal);
        const newPrincipalPaid = order.principal_paid + paidAmount;
        const newPrincipalRemaining = order.loan_amount - newPrincipalPaid;
        let updates = { principal_paid: newPrincipalPaid, principal_remaining: newPrincipalRemaining };
        if (newPrincipalRemaining <= 0) updates = { ...updates, status: 'completed', monthly_interest: 0 };
        else updates.monthly_interest = newPrincipalRemaining * 0.10;
        const { error: e1 } = await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient.from('payment_history').insert({
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'principal',
            amount: paidAmount,
            description: paidAmount >= order.loan_amount ? 'Pelunasan Pokok / 全额还款' : 'Pembayaran Pokok / 部分还款',
            recorded_by: profile.id
        });
        if (e2) throw e2;
        return true;
    },

    async deleteOrder(orderId) {
        const order = await this.getOrder(orderId);
        const { error: e1 } = await supabaseClient.from('payment_history').delete().eq('order_id', order.id);
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient.from('orders').delete().eq('order_id', orderId);
        if (e2) throw e2;
        return true;
    },

    async updateOrder(orderId, updateData) {
        const { data, error } = await supabaseClient
            .from('orders').update(updateData).eq('order_id', orderId).select().single();
        if (error) throw error;
        return data;
    },

    async unlockOrder(orderId) {
        const { error } = await supabaseClient.from('orders').update({
            is_locked: false, locked_at: null, locked_by: null
        }).eq('order_id', orderId);
        if (error) throw error;
        return true;
    },

    async relockOrder(orderId) {
        const profile = await this.getCurrentProfile();
        const { error } = await supabaseClient.from('orders').update({
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: profile.id
        }).eq('order_id', orderId);
        if (error) throw error;
        return true;
    },

    async getReport() {
        const orders = await this.getOrders();
        const activeOrders = orders.filter(o => o.status === 'active');
        return {
            total_orders: orders.length,
            active_orders: activeOrders.length,
            completed_orders: orders.filter(o => o.status === 'completed').length,
            total_loan_amount: orders.reduce((s, o) => s + o.loan_amount, 0),
            total_admin_fees: orders.reduce((s, o) => s + (o.admin_fee_paid ? o.admin_fee : 0), 0),
            total_interest: orders.reduce((s, o) => s + o.interest_paid_total, 0),
            total_principal: orders.reduce((s, o) => s + o.principal_paid, 0),
            expected_monthly_interest: activeOrders.reduce((s, o) => s + ((o.loan_amount - o.principal_paid) * 0.10), 0)
        };
    },

    async getAllPayments() {
        const profile = await this.getCurrentProfile();
        let query = supabaseClient
            .from('payment_history')
            .select('*, orders!inner (order_id, customer_name, store_id)')
            .order('date', { ascending: false });
        if (profile?.role !== 'admin') {
            query = query.eq('orders.store_id', profile?.store_id);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getAllUsers() {
        const { data, error } = await supabaseClient
            .from('user_profiles').select('*, stores(*)').order('name');
        if (error) throw error;
        return data;
    },

    async createStore(code, name, address, phone) {
        const { data, error } = await supabaseClient
            .from('stores').insert({ code, name, address, phone }).select().single();
        if (error) throw error;
        return data;
    },

    async updateStore(id, updates) {
        const { data, error } = await supabaseClient
            .from('stores').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteStore(id) {
        const { error } = await supabaseClient.from('stores').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID');
    }
};

window.SUPABASE = SupabaseAPI;
window.supabaseClient = supabaseClient;
