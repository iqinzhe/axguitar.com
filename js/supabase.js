const SUPABASE_URL = "https://hiupsvsbcdsgoyiieqiv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdXBzdnNiY2RzZ295aWllcWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODA3NjYsImV4cCI6MjA5MTU1Njc2Nn0.qL7Qw0I7Ogws_kMoOAae_fCzkhVm-c7NhLPu8rxaJpU";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let _profileCache = null;

const SupabaseAPI = {
    getClient() { return supabaseClient; },

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

    async getCurrentProfile() {
        if (_profileCache) return _profileCache;
        const user = await this.getCurrentUser();
        if (!user) return null;
        
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error("getCurrentProfile error:", error);
            return null;
        }
        
        if (data.store_id) {
            const { data: storeData, error: storeError } = await supabaseClient
                .from('stores')
                .select('*')
                .eq('id', data.store_id)
                .single();
            if (!storeError && storeData) {
                data.stores = storeData;
            }
        }
        
        _profileCache = data;
        return data;
    },

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
        return profile?.stores?.name || '总部';
    },

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

    async getOrders(filters = {}) {
        const profile = await this.getCurrentProfile();
        let query = supabaseClient.from('orders').select('*');
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
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

    async _getStorePrefix(storeId) {
        if (!storeId) return 'ST';
        const { data, error } = await supabaseClient
            .from('stores')
            .select('name')
            .eq('id', storeId)
            .single();
        if (error || !data) return 'ST';
        const name = data.name.toLowerCase();
        if (name.includes('bangil')) return 'BL';
        if (name.includes('gempol')) return 'GP';
        if (name.includes('sidoarjo')) return 'SO';
        return 'ST';
    },

    // 生成订单ID: 格式 门店前缀-年月-3位序号 (如 BL-2604-001)
    async _generateOrderId(role, storeId) {
        let prefix = 'AD';
        if (role === 'store_manager') {
            prefix = await this._getStorePrefix(storeId);
        }
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yearMonth = `${yy}${mm}`;
        
        // 查询当前月份该前缀的最大序号
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('order_id')
            .like('order_id', `${prefix}-${yearMonth}-%`);
        
        let nextNumber = 1;
        if (orders && orders.length > 0) {
            const numbers = orders.map(o => {
                const match = o.order_id.match(new RegExp(`${prefix}-${yearMonth}-(\\d+)$`));
                return match ? parseInt(match[1], 10) : 0;
            }).filter(n => n > 0);
            if (numbers.length > 0) {
                nextNumber = Math.max(...numbers) + 1;
            }
        }
        
        if (nextNumber > 999) nextNumber = 999;
        const serial = String(nextNumber).padStart(3, '0');
        return `${prefix}-${yearMonth}-${serial}`;
    },

    async createOrder(orderData) {
        const profile = await this.getCurrentProfile();
        const orderId = await this._generateOrderId(profile.role, profile.store_id);
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
            customer_id: orderData.customer_id || null,
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
        if (newPrincipalRemaining <= 0) {
            updates = { ...updates, status: 'completed', monthly_interest: 0 };
        } else {
            updates.monthly_interest = newPrincipalRemaining * 0.10;
        }
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
            total_admin_f
