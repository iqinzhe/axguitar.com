// ============================================
// Supabase 客户端配置
// ============================================

const SUPABASE_URL = "https://hiupsvsbcdsgoyiieqiv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdXBzdnNiY2RzZ295aWllcWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODA3NjYsImV4cCI6MjA5MTU1Njc2Nn0.qL7Qw0I7Ogws_kMoOAae_fCzkhVm-c7NhLPu8rxaJpU";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 全局状态
let currentProfile = null;
let currentSession = null;

const SupabaseAPI = {
    // 获取客户端
    getClient() {
        return supabaseClient;
    },

    // 获取当前会话
    async getSession() {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        currentSession = data.session;
        return currentSession;
    },

    // 获取当前用户
    async getCurrentUser() {
        const { data, error } = await supabaseClient.auth.getUser();
        if (error) return null;
        return data.user;
    },

    // 获取当前用户资料（含门店信息）
    async getCurrentProfile() {
        const user = await this.getCurrentUser();
        if (!user) return null;
        
        // 如果已有缓存且用户相同，返回缓存
        if (currentProfile && currentProfile.id === user.id) {
            return currentProfile;
        }
        
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*, stores(*)')
            .eq('id', user.id)
            .single();
        
        if (error) return null;
        currentProfile = data;
        return data;
    },

    // 清除缓存（登出时调用）
    clearCache() {
        currentProfile = null;
        currentSession = null;
    },

    // 判断是否为管理员
    async isAdmin() {
        const profile = await this.getCurrentProfile();
        return profile?.role === 'admin';
    },

    // 获取当前门店ID
    async getCurrentStoreId() {
        const profile = await this.getCurrentProfile();
        return profile?.store_id;
    },

    // 获取当前门店名称
    async getCurrentStoreName() {
        const profile = await this.getCurrentProfile();
        return profile?.stores?.name || '未知门店';
    },

    // 登录
    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;
        await this.getCurrentProfile();
        return data;
    },

    // 登出
    async logout() {
        this.clearCache();
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    // 注册新用户（仅管理员可调用）
    async createUser(email, password, username, name, role, storeId) {
        const { data, error } = await supabaseClient.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });
        if (error) throw error;
        
        // 创建用户资料
        const { error: profileError } = await supabaseClient
            .from('user_profiles')
            .insert({
                id: data.user.id,
                username: username,
                name: name,
                role: role,
                store_id: storeId,
                created_by: (await this.getCurrentUser()).id
            });
        
        if (profileError) throw profileError;
        return data;
    },

    // 获取所有门店
    async getAllStores() {
        const { data, error } = await supabaseClient
            .from('stores')
            .select('*')
            .order('name');
        if (error) throw error;
        return data;
    },

    // 创建门店（仅管理员）
    async createStore(code, name, address, phone) {
        const { data, error } = await supabaseClient
            .from('stores')
            .insert({
                code: code,
                name: name,
                address: address,
                phone: phone,
                created_by: (await this.getCurrentUser()).id
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // 更新门店（仅管理员）
    async updateStore(id, updates) {
        const { data, error } = await supabaseClient
            .from('stores')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // 删除门店（仅管理员，会清空关联用户的store_id）
    async deleteStore(id) {
        // 先将关联用户的 store_id 设为 null
        await supabaseClient
            .from('user_profiles')
            .update({ store_id: null })
            .eq('store_id', id);
        
        const { error } = await supabaseClient
            .from('stores')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    },

    // 获取所有用户（仅管理员）
    async getAllUsers() {
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .select('*, stores(name)')
            .order('created_at');
        if (error) throw error;
        return data;
    },

    // 更新用户（仅管理员）
    async updateUser(userId, updates) {
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // 删除用户（仅管理员）
    async deleteUser(userId) {
        // 先删除 profile
        await supabaseClient
            .from('user_profiles')
            .delete()
            .eq('id', userId);
        
        // 再删除 auth 用户（需要管理员权限）
        const { error } = await supabaseClient.auth.admin.deleteUser(userId);
        if (error) throw error;
        return true;
    },

    // 获取订单列表（根据权限自动过滤）
    async getOrders(filters = {}) {
        let query = supabaseClient.from('orders').select('*');
        
        const isAdminUser = await this.isAdmin();
        if (!isAdminUser) {
            const storeId = await this.getCurrentStoreId();
            query = query.eq('store_id', storeId);
        }
        
        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }
        
        if (filters.search) {
            query = query.or(`customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,order_id.ilike.%${filters.search}%`);
        }
        
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // 获取单个订单
    async getOrder(orderId) {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('order_id', orderId)
            .single();
        if (error) throw error;
        return data;
    },

    // 获取订单的支付记录
    async getPaymentHistory(orderId) {
        const order = await this.getOrder(orderId);
        const { data, error } = await supabaseClient
            .from('payment_history')
            .select('*')
            .eq('order_id', order.id)
            .order('date', { ascending: false });
        if (error) throw error;
        return { order, payments: data };
    },

    // 创建订单
    async createOrder(orderData) {
        const profile = await this.getCurrentProfile();
        const rolePrefix = profile.role === 'admin' ? 'AD' : 'ST';
        
        // 调用数据库函数生成订单ID
        const { data: orderId, error: idError } = await supabaseClient.rpc('generate_order_id', {
            role_prefix: rolePrefix
        });
        
        if (idError) {
            // 备用生成逻辑
            const now = new Date();
            const yy = now.getFullYear().toString().slice(-2);
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const tempId = `${rolePrefix}-${yy}${mm}-01`;
            orderId = tempId;
        }
        
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
        
        const { data, error } = await supabaseClient
            .from('orders')
            .insert(newOrder)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    calculateNextDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },

    // 记录管理费支付
    async recordAdminFee(orderId) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        
        // 更新订单
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update({
                admin_fee_paid: true,
                admin_fee_paid_date: new Date().toISOString().split('T')[0]
            })
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        // 添加支付记录
        const { error: historyError } = await supabaseClient
            .from('payment_history')
            .insert({
                order_id: order.id,
                date: new Date().toISOString().split('T')[0],
                type: 'admin_fee',
                amount: order.admin_fee,
                description: 'Administrasi Fee / 管理费',
                recorded_by: profile.id
            });
        
        if (historyError) throw historyError;
        return true;
    },

    // 记录利息支付
    async recordInterestPayment(orderId, months) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        if (remainingPrincipal <= 0) {
            throw new Error('本金已结清，无需支付利息');
        }
        
        const monthlyInterest = remainingPrincipal * 0.10;
        const totalInterest = monthlyInterest * months;
        
        // 更新订单
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update({
                interest_paid_months: order.interest_paid_months + months,
                interest_paid_total: order.interest_paid_total + totalInterest,
                next_interest_due_date: this.calculateNextDueDate(order.created_at, order.interest_paid_months + months),
                monthly_interest: monthlyInterest
            })
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        // 添加支付记录
        const { error: historyError } = await supabaseClient
            .from('payment_history')
            .insert({
                order_id: order.id,
                date: new Date().toISOString().split('T')[0],
                type: 'interest',
                months: months,
                amount: totalInterest,
                description: `Bunga ${months} bulan (sisa pokok: ${this.formatCurrency(remainingPrincipal)})`,
                recorded_by: profile.id
            });
        
        if (historyError) throw historyError;
        return true;
    },

    // 记录本金支付
    async recordPrincipalPayment(orderId, amount) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        const paidAmount = Math.min(amount, remainingPrincipal);
        const newPrincipalPaid = order.principal_paid + paidAmount;
        const newPrincipalRemaining = order.loan_amount - newPrincipalPaid;
        
        let updates = {
            principal_paid: newPrincipalPaid,
            principal_remaining: newPrincipalRemaining
        };
        
        // 如果本金全部还清
        if (newPrincipalRemaining <= 0) {
            updates.status = 'completed';
            updates.monthly_interest = 0;
        } else {
            updates.monthly_interest = newPrincipalRemaining * 0.10;
        }
        
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update(updates)
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        // 添加支付记录
        const { error: historyError } = await supabaseClient
            .from('payment_history')
            .insert({
                order_id: order.id,
                date: new Date().toISOString().split('T')[0],
                type: 'principal',
                amount: paidAmount,
                description: paidAmount >= order.loan_amount ? 'Pelunasan Pokok / 本金结清' : 'Pembayaran Pokok / 本金支付',
                recorded_by: profile.id
            });
        
        if (historyError) throw historyError;
        return true;
    },

    // 更新订单（仅管理员，或店长在未锁定状态）
    async updateOrder(orderId, updates) {
        const { data, error } = await supabaseClient
            .from('orders')
            .update(updates)
            .eq('order_id', orderId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // 删除订单（仅管理员）
    async deleteOrder(orderId) {
        const order = await this.getOrder(orderId);
        // 先删除支付记录
        await supabaseClient
            .from('payment_history')
            .delete()
            .eq('order_id', order.id);
        
        // 再删除订单
        const { error } = await supabaseClient
            .from('orders')
            .delete()
            .eq('order_id', orderId);
        
        if (error) throw error;
        return true;
    },

    // 解锁订单（管理员）
    async unlockOrder(orderId) {
        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                is_locked: false,
                locked_at: null,
                locked_by: null
            })
            .eq('order_id', orderId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // 重新锁定订单（管理员修改后）
    async relockOrder(orderId) {
        const profile = await this.getCurrentProfile();
        const { data, error } = await supabaseClient
            .from('orders')
            .update({
                is_locked: true,
                locked_at: new Date().toISOString(),
                locked_by: profile.id
            })
            .eq('order_id', orderId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // 获取财务报表
    async getReport() {
        const orders = await this.getOrders();
        const isAdminUser = await this.isAdmin();
        
        const activeOrders = orders.filter(o => o.status === 'active');
        const completedOrders = orders.filter(o => o.status === 'completed');
        
        const totalLoanAmount = orders.reduce((sum, o) => sum + o.loan_amount, 0);
        const totalAdminFees = orders.reduce((sum, o) => sum + (o.admin_fee_paid ? o.admin_fee : 0), 0);
        const totalInterest = orders.reduce((sum, o) => sum + o.interest_paid_total, 0);
        const totalPrincipal = orders.reduce((sum, o) => sum + o.principal_paid, 0);
        
        let expectedMonthlyInterest = 0;
        activeOrders.forEach(o => {
            const remaining = o.loan_amount - o.principal_paid;
            expectedMonthlyInterest += remaining * 0.10;
        });
        
        return {
            total_orders: orders.length,
            active_orders: activeOrders.length,
            completed_orders: completedOrders.length,
            total_loan_amount: totalLoanAmount,
            total_admin_fees: totalAdminFees,
            total_interest: totalInterest,
            total_principal: totalPrincipal,
            expected_monthly_interest: expectedMonthlyInterest
        };
    },

    // 获取所有支付记录
    async getAllPayments() {
        const isAdminUser = await this.isAdmin();
        
        let query = supabaseClient
            .from('payment_history')
            .select(`
                *,
                orders!inner (
                    order_id,
                    customer_name,
                    store_id
                )
            `)
            .order('date', { ascending: false });
        
        if (!isAdminUser) {
            const storeId = await this.getCurrentStoreId();
            query = query.eq('orders.store_id', storeId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // 格式化货币
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    // 格式化日期
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('id-ID');
    }
};

window.SUPABASE = SupabaseAPI;
window.supabaseClient = supabaseClient;   // 添加这一行
