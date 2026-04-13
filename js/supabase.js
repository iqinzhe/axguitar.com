const SUPABASE_URL = "https://hiupsvsbcdsgoyiieqiv.supabase.co";
const SUPABASE_KEY = "sb_publishable_ghhdmrulAv5Dt5Rcz9fFyQ_P98L1I5f";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===============================
// 🔥 AUTH FIX STATE（新增，不破坏原逻辑）
// ===============================
window.AUTH_STATE = {
    isRecovery: false
};

// 监听 Auth 状态（只新增，不影响你原业务）
supabaseClient.auth.onAuthStateChange((event, session) => {

    console.log("AUTH EVENT:", event);

    if (event === "PASSWORD_RECOVERY") {
        window.AUTH_STATE.isRecovery = true;
    }

    if (event === "SIGNED_OUT") {
        window.AUTH_STATE.isRecovery = false;
    }
});

// ===============================
// Supabase API（你原代码 + 修复）
// ===============================
const SupabaseAPI = {

    getClient() {
        return supabaseClient;
    },

    // ===============================
    // SESSION
    // ===============================
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

    // ===============================
    // PROFILE（原样保留）
    // ===============================
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

    clearCache() {
        _profileCache = null;
    },

    // ===============================
    // 🔥 LOGIN（原样保留）
    // ===============================
    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) return { error };
        return data;
    },

    async logout() {
        this.clearCache();
        window.AUTH_STATE.isRecovery = false;

        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    // ===============================
    // 🔥 RESET FLOW 修复关键点（新增）
    // ===============================

    async handleRecovery() {
        const { error } =
            await supabaseClient.auth.exchangeCodeForSession();

        if (error) {
            console.error("Recovery error:", error);
        }

        window.AUTH_STATE.isRecovery = true;
    },

    async updatePassword(newPassword) {
        const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) return { error };
        return data;
    },

    // ===============================
    // 以下全部：你原代码（完全保留）
    // ===============================
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

    async getAllStores() {
        const { data, error } = await supabaseClient
            .from('stores')
            .select('*')
            .order('name');

        if (error) throw error;
        return data;
    },

    async getOrders(filters = {}) {
        const profile = await this.getCurrentProfile();

        let query = supabaseClient.from('orders').select('*');

        if (profile?.role !== 'admin') {
            query = query.eq('store_id', profile?.store_id);
        }

        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }

        if (filters.search) {
            query = query.or(
                `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,order_id.ilike.%${filters.search}%`
            );
        }

        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;

        return data;
    },

    async getOrder(orderId) {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('order_id', orderId)
            .single();

        if (error) throw error;
        return data;
    },

    async deleteOrder(orderId) {
        const order = await this.getOrder(orderId);

        await supabaseClient
            .from('payment_history')
            .delete()
            .eq('order_id', order.id);

        await supabaseClient
            .from('orders')
            .delete()
            .eq('order_id', orderId);

        return true;
    },

    // ===============================
    // FORMAT（原样保留）
    // ===============================
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('id-ID');
    }
};

// ===============================
// GLOBAL EXPORT
// ===============================
window.SUPABASE = SupabaseAPI;
window.supabaseClient = supabaseClient;
