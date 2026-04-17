// supabase.js - 完整修复版
// 修复内容：
// 1. 本金还款描述使用剩余本金判断（原错误使用贷款总额）
// 2. getCashFlowSummary 添加 profit 字段
// 3. 新增 unlockAdminFee 函数（作废原记录防止重复入账）
// 4. 超额还款确认对话框

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
        try {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) {
                if (error.message !== 'Auth session missing!') {
                    console.warn("getCurrentUser error:", error.message);
                }
                return null;
            }
            return data?.user || null;
        } catch (err) {
            console.warn("getCurrentUser exception:", err.message);
            return null;
        }
    },

    async getCurrentProfile() {
        if (_profileCache) return _profileCache;
        try {
            const user = await this.getCurrentUser();
            if (!user) return null;
            
            const { data, error } = await supabaseClient
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error) {
                console.error("getCurrentProfile error:", error.message);
                return null;
            }
            
            if (data?.store_id) {
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
        } catch (err) {
            console.warn("getCurrentProfile exception:", err.message);
            return null;
        }
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
        return profile?.stores?.name || 'Kantor';
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
        const { data, error } = await supabaseClient.from('stores').select('*').order('code');
        if (error) throw error;
        return data;
    },

    // ==================== 门店代码到前缀的映射 ====================
    
    async _getStorePrefix(storeId) {
        if (!storeId) return 'AD';
        
        const { data, error } = await supabaseClient
            .from('stores')
            .select('code, name')
            .eq('id', storeId)
            .single();
        
        if (error || !data) return 'AD';
        
        const codeToPrefix = {
            'STORE_000': 'AD',
            'STORE_001': 'BL',
            'STORE_002': 'SO',
            'STORE_003': 'GP',
            'STORE_004': 'BJ',
        };
        
        if (data.code && codeToPrefix[data.code]) {
            return codeToPrefix[data.code];
        }
        
        const nameToPrefix = {
            'kantor': 'AD',
            'bangil': 'BL',
            'gempol': 'GP',
            'sidoarjo': 'SO',
            'beji': 'BJ'
        };
        
        const nameLower = data.name.toLowerCase();
        for (const [key, val] of Object.entries(nameToPrefix)) {
            if (nameLower.includes(key)) {
                return val;
            }
        }
        
        return 'AD';
    },

    // ==================== ID 生成器 ====================
    
    async _generateOrderId(role, storeId) {
        let prefix = 'AD';
        if (role !== 'admin') {
            prefix = await this._getStorePrefix(storeId);
        }
        
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateCode = `${yy}${mm}${dd}`;
        
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('order_id')
            .like('order_id', `${prefix}-${dateCode}-%`);
        
        let maxNumber = 0;
        if (orders && orders.length > 0) {
            for (const order of orders) {
                const match = order.order_id.match(new RegExp(`${prefix}-${dateCode}-(\\d+)$`));
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) maxNumber = num;
                }
            }
        }
        
        let nextNumber = maxNumber + 1;
        if (nextNumber > 99) nextNumber = 99;
        const serial = String(nextNumber).padStart(2, '0');
        
        return `${prefix}-${dateCode}-${serial}`;
    },

    async _generateCustomerId(storeId) {
        const prefix = await this._getStorePrefix(storeId);
        
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateCode = `${yy}${mm}${dd}`;
        
        const { data: customers, error } = await supabaseClient
            .from('customers')
            .select('customer_id')
            .like('customer_id', `${prefix}-${dateCode}-%`);
        
        let maxNumber = 0;
        if (customers && customers.length > 0) {
            for (const c of customers) {
                const match = c.customer_id.match(new RegExp(`${prefix}-${dateCode}-(\\d+)$`));
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) maxNumber = num;
                }
            }
        }
        
        const nextNumber = maxNumber + 1;
        const serial = String(nextNumber).padStart(3, '0');
        
        return `${prefix}-${dateCode}-${serial}`;
    },

    // ==================== 订单相关 ====================
    
    async getOrders(filters = {}) {
        const profile = await this.getCurrentProfile();
        let query = supabaseClient.from('orders').select('*, stores(code, name)');
        
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
            .from('orders').select('*, stores(code, name)').eq('order_id', orderId).single();
        if (error) throw error;

        const profile = await this.getCurrentProfile();
        if (profile?.role !== 'admin' && profile?.store_id && data.store_id !== profile.store_id) {
            throw new Error(Utils.lang === 'id' ? 'Tidak ada akses ke order ini' : '无权访问此订单');
        }

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

    async createOrder(orderData) {
        const profile = await this.getCurrentProfile();
        const nowDate = new Date().toISOString().split('T')[0];
        const adminFee = orderData.admin_fee || 30000;
        
        const targetStoreId = orderData.store_id || profile.store_id;
        
        if (profile.role === 'admin' && !orderData.store_id) {
            throw new Error(Utils.lang === 'id' ? 'Administrator tidak dapat membuat order. Silakan login sebagai Manajer Toko atau Staf.' : '管理员不能创建订单，请使用店长或员工账号登录。');
        }
        
        if (!targetStoreId) {
            throw new Error(Utils.lang === 'id' ? 'Toko tidak ditemukan' : '未找到门店信息');
        }
        
        let retryCount = 0;
        let lastError = null;
        
        while (retryCount < 3) {
            try {
                const orderId = await this._generateOrderId(profile.role, targetStoreId);
                
                const newOrder = {
                    order_id: orderId,
                    customer_name: orderData.customer_name,
                    customer_ktp: orderData.customer_ktp,
                    customer_phone: orderData.customer_phone,
                    customer_address: orderData.customer_address || '',
                    collateral_name: orderData.collateral_name,
                    loan_amount: orderData.loan_amount,
                    admin_fee: adminFee,
                    admin_fee_paid: false,
                    monthly_interest: orderData.loan_amount * 0.10,
                    interest_paid_months: 0,
                    interest_paid_total: 0,
                    next_interest_due_date: this.calculateNextDueDate(nowDate, 0),
                    principal_paid: 0,
                    principal_remaining: orderData.loan_amount,
                    status: 'active',
                    store_id: targetStoreId,
                    created_by: profile.id,
                    notes: orderData.notes || '',
                    customer_id: orderData.customer_id || null,
                    is_locked: true,
                    locked_at: new Date().toISOString(),
                    locked_by: profile.id
                };

                const { data, error } = await supabaseClient.from('orders').insert(newOrder).select().single();
                
                if (error) {
                    if (error.code === '23505') {
                        console.warn(`订单ID冲突: ${orderId}, 重试第 ${retryCount + 1} 次`);
                        retryCount++;
                        continue;
                    }
                    throw error;
                }
                
                console.log(`✅ 订单创建成功: ${orderId} (门店: ${targetStoreId})`);
                return data;
                
            } catch (err) {
                if (retryCount >= 2) throw err;
                retryCount++;
                lastError = err;
            }
        }
        throw lastError || new Error('创建订单失败，请重试');
    },

    calculateNextDueDate(startDate, paidMonths) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + paidMonths + 1);
        return date.toISOString().split('T')[0];
    },

    async recordAdminFee(orderId, paymentMethod = 'cash', adminFeeAmount = null) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        const feeAmount = adminFeeAmount || order.admin_fee;
        
        const { error: e1 } = await supabaseClient.from('orders').update({
            admin_fee_paid: true,
            admin_fee_paid_date: new Date().toISOString().split('T')[0],
            admin_fee: feeAmount
        }).eq('order_id', orderId);
        if (e1) throw e1;
        
        const paymentData = {
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'admin_fee',
            amount: feeAmount,
            description: `Administrasi Fee / 管理费 (${this.formatCurrency(feeAmount)})`,
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        
        const { error: e2 } = await supabaseClient.from('payment_history').insert(paymentData);
        if (e2) throw e2;
        return true;
    },

    async recordInterestPayment(orderId, months, paymentMethod = 'cash') {
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
        
        const paymentData = {
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'interest',
            months: months,
            amount: totalInterest,
            description: `Bunga ${months} bulan / 利息${months}个月`,
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        
        const { error: e2 } = await supabaseClient.from('payment_history').insert(paymentData);
        if (e2) throw e2;
        return true;
    },

    // ==================== 本金还款（修复版） ====================
    async recordPrincipalPayment(orderId, amount, paymentMethod = 'cash') {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        const remainingPrincipal = order.loan_amount - order.principal_paid;
        
        // ✅ 修复1：使用剩余本金判断是否超额
        let paidAmount = amount;
        let isAdjusted = false;
        
        if (amount > remainingPrincipal) {
            // ✅ 修复5：超额还款时弹出确认对话框
            const confirmMsg = Utils.lang === 'id' 
                ? `⚠️ Jumlah yang dimasukkan (${this.formatCurrency(amount)}) melebihi sisa pokok (${this.formatCurrency(remainingPrincipal)}).\n\nApakah Anda ingin membayar ${this.formatCurrency(remainingPrincipal)} untuk melunasi pokok?`
                : `⚠️ 输入金额 (${this.formatCurrency(amount)}) 超过剩余本金 (${this.formatCurrency(remainingPrincipal)}).\n\n是否支付 ${this.formatCurrency(remainingPrincipal)} 结清本金？`;
            
            if (!confirm(confirmMsg)) {
                throw new Error(Utils.lang === 'id' ? 'Pembayaran dibatalkan' : '付款已取消');
            }
            paidAmount = remainingPrincipal;
            isAdjusted = true;
        }
        
        const newPrincipalPaid = order.principal_paid + paidAmount;
        const newPrincipalRemaining = order.loan_amount - newPrincipalPaid;
        
        let updates = { 
            principal_paid: newPrincipalPaid, 
            principal_remaining: newPrincipalRemaining 
        };
        
        if (newPrincipalRemaining <= 0) {
            updates = { ...updates, status: 'completed', monthly_interest: 0 };
        } else {
            updates.monthly_interest = newPrincipalRemaining * 0.10;
        }
        
        const { error: e1 } = await supabaseClient.from('orders').update(updates).eq('order_id', orderId);
        if (e1) throw e1;
        
        // ✅ 修复1：使用剩余本金判断是否全额还款
        const isFullRepayment = paidAmount >= remainingPrincipal;
        const description = isFullRepayment 
            ? (Utils.lang === 'id' ? 'Pelunasan Pokok / 全额还款' : '全额还款')
            : (Utils.lang === 'id' ? 'Pembayaran Pokok / 部分还款' : '部分还款');
        
        // 添加调整备注
        const finalDescription = isAdjusted 
            ? `${description} (${Utils.lang === 'id' ? 'jumlah disesuaikan otomatis' : '金额已自动调整'})`
            : description;
        
        const paymentData = {
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'principal',
            amount: paidAmount,
            description: finalDescription,
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        
        const { error: e2 } = await supabaseClient.from('payment_history').insert(paymentData);
        if (e2) throw e2;
        return true;
    },

    // ==================== 解锁管理费（修复版 - 作废原记录） ====================
    async unlockAdminFee(orderId, reason = 'admin_correction') {
        const profile = await this.getCurrentProfile();
        
        // 权限检查：只有管理员可以解锁
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' 
                ? 'Hanya administrator yang dapat membuka kunci Admin Fee' 
                : '只有管理员可以解锁管理费');
        }
        
        const order = await this.getOrder(orderId);
        
        // 1. 标记原有管理费支付记录为已作废
        const { error: markError } = await supabaseClient
            .from('payment_history')
            .update({ 
                is_voided: true, 
                void_reason: reason,
                voided_at: new Date().toISOString(),
                voided_by: profile.id
            })
            .eq('order_id', order.id)
            .eq('type', 'admin_fee');
        
        if (markError) throw markError;
        
        // 2. 解锁管理费（允许重新支付）
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update({ 
                admin_fee_paid: false,
                admin_fee_paid_date: null
            })
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        return true;
    },

    async deleteOrder(orderId) {
        const profile = await this.getCurrentProfile();
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat menghapus order' : '只有管理员可以删除订单');
        }
        const order = await this.getOrder(orderId);
        const { error: e1 } = await supabaseClient.from('payment_history').delete().eq('order_id', order.id);
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient.from('orders').delete().eq('order_id', orderId);
        if (e2) throw e2;
        return true;
    },

    async updateOrder(orderId, updateData, customerId) {
        const { data, error } = await supabaseClient
            .from('orders').update(updateData).eq('order_id', orderId).select().single();
        if (error) throw error;

        if (customerId && (updateData.customer_name || updateData.customer_phone || updateData.customer_ktp)) {
            const customerUpdate = {};
            if (updateData.customer_name) customerUpdate.name = updateData.customer_name;
            if (updateData.customer_phone) customerUpdate.phone = updateData.customer_phone;
            if (updateData.customer_ktp) customerUpdate.ktp_number = updateData.customer_ktp;
            if (updateData.customer_address) {
                customerUpdate.ktp_address = updateData.customer_address;
                customerUpdate.address = updateData.customer_address;
            }
            if (Object.keys(customerUpdate).length > 0) {
                await supabaseClient.from('customers').update(customerUpdate).eq('id', customerId);
            }
        }

        return data;
    },

    async unlockOrder(orderId) {
        const profile = await this.getCurrentProfile();
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat membuka kunci order' : '只有管理员可以解锁订单');
        }
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
            .select('*, orders!left(order_id, customer_name, store_id)')
            .order('date', { ascending: false });
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('orders.store_id', profile.store_id);
        }
        
        const { data, error } = await query;
        if (error) {
            console.warn("Payment query with join failed, falling back:", error);
            const { data: payments, error: payError } = await supabaseClient
                .from('payment_history')
                .select('*')
                .order('date', { ascending: false });
            if (payError) throw payError;
            
            for (var p of payments) {
                const { data: order } = await supabaseClient
                    .from('orders')
                    .select('order_id, customer_name, store_id')
                    .eq('id', p.order_id)
                    .single();
                p.orders = order;
            }
            return payments;
        }
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
        const { data: orders, error: ordersError } = await supabaseClient
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', id);
        
        if (ordersError) throw ordersError;
        if (orders && orders.length > 0) {
            throw new Error(Utils.lang === 'id' 
                ? 'Toko ini masih memiliki order, tidak dapat dihapus' 
                : '该门店还有订单，无法删除');
        }
        
        const { data: users, error: usersError } = await supabaseClient
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', id);
        
        if (usersError) throw usersError;
        if (users && users.length > 0) {
            throw new Error(Utils.lang === 'id' 
                ? 'Toko ini masih memiliki pengguna, tidak dapat dihapus' 
                : '该门店还有用户，无法删除');
        }
        
        const { error } = await supabaseClient.from('stores').delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    // ==================== 客户相关 ====================
    
    async getCustomers(filters = {}) {
        const profile = await this.getCurrentProfile();
        let query = supabaseClient.from('customers').select('*, stores(name, code)').order('registered_date', { ascending: false });
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async createCustomer(customerData) {
        const profile = await this.getCurrentProfile();
        const storeId = customerData.store_id || profile.store_id;
        
        const customerId = await this._generateCustomerId(storeId);
        
        const { data, error } = await supabaseClient
            .from('customers')
            .insert({
                customer_id: customerId,
                store_id: storeId,
                name: customerData.name,
                ktp_number: customerData.ktp_number || null,
                phone: customerData.phone,
                ktp_address: customerData.ktp_address || null,
                address: customerData.address || null,
                living_same_as_ktp: customerData.living_same_as_ktp,
                living_address: customerData.living_address || null,
                registered_date: customerData.registered_date || new Date().toISOString().split('T')[0],
                created_by: profile.id,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },

    // ==================== 资金管理函数 ====================
    
    _generateBizNo: function(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    },

    async getShopAccount(storeId) {
        const profile = await this.getCurrentProfile();
        const targetStoreId = storeId || profile?.store_id;
        
        if (!targetStoreId) {
            return { principal_balance: 0, profit_balance: 0, total_invested: 0, total_withdrawn: 0, total_profit: 0, total_dividend: 0 };
        }
        
        const { data: investments } = await supabaseClient
            .from('capital_transactions')
            .select('amount')
            .eq('target_store_id', targetStoreId)
            .in('type', ['investment', 'reinvestment', 'capital_circulation']);
        
        const totalInvested = (investments || []).reduce((s, t) => s + t.amount, 0);
        
        const { data: withdrawals } = await supabaseClient
            .from('capital_transactions')
            .select('amount')
            .eq('store_id', targetStoreId)
            .eq('type', 'withdrawal');
        
        const totalWithdrawn = (withdrawals || []).reduce((s, t) => s + t.amount, 0);
        
        const { data: dividends } = await supabaseClient
            .from('capital_transactions')
            .select('amount')
            .eq('store_id', targetStoreId)
            .eq('type', 'dividend');
        
        const totalDividend = (dividends || []).reduce((s, t) => s + t.amount, 0);
        
        const { data: orders } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('store_id', targetStoreId);
        
        const orderIds = orders?.map(o => o.id) || [];
        
        let totalProfit = 0;
        if (orderIds.length > 0) {
            const { data: payments } = await supabaseClient
                .from('payment_history')
                .select('type, amount')
                .in('order_id', orderIds)
                .in('type', ['admin_fee', 'interest']);
            
            totalProfit = (payments || []).reduce((s, p) => s + p.amount, 0);
        }
        
        const principalBalance = totalInvested - totalWithdrawn;
        const undistributedProfit = totalProfit - totalDividend;
        
        return {
            principal_balance: principalBalance,
            profit_balance: undistributedProfit,
            total_invested: totalInvested,
            total_withdrawn: totalWithdrawn,
            total_profit: totalProfit,
            total_dividend: totalDividend
        };
    },

    async investToShop(shopId, amount, paymentMethod, description, transactionDate) {
        const profile = await this.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat melakukan investasi' : '只有管理员可以注资');
        }
        
        if (!amount || amount <= 0) {
            throw new Error(Utils.lang === 'id' ? 'Jumlah tidak valid' : '金额无效');
        }
        
        const bizNo = this._generateBizNo('INV');
        
        const { data, error } = await supabaseClient
            .from('capital_transactions')
            .insert({
                biz_no: bizNo,
                store_id: null,
                target_store_id: shopId,
                type: 'investment',
                payment_method: paymentMethod,
                amount: amount,
                description: description || (Utils.lang === 'id' ? 'Investasi modal' : '注资'),
                transaction_date: transactionDate || new Date().toISOString().split('T')[0],
                created_by: profile.id
            })
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                throw new Error(Utils.lang === 'id' ? '重复提交，请稍后再试' : '重复提交，请稍后再试');
            }
            throw error;
        }
        
        return data;
    },

    async withdrawFromShop(shopId, amount, paymentMethod, description, transactionDate) {
        const profile = await this.getCurrentProfile();
        
        if (profile?.role !== 'admin' && profile?.store_id !== shopId) {
            throw new Error(Utils.lang === 'id' ? 'Anda hanya dapat mengelola toko sendiri' : '您只能管理自己的门店');
        }
        
        const account = await this.getShopAccount(shopId);
        
        if (account.principal_balance < amount) {
            throw new Error(Utils.lang === 'id' 
                ? `Sisa pokok tidak mencukupi. Tersedia: ${this.formatCurrency(account.principal_balance)}`
                : `本金余额不足。可用: ${this.formatCurrency(account.principal_balance)}`);
        }
        
        const bizNo = this._generateBizNo('WTD');
        
        const { data, error } = await supabaseClient
            .from('capital_transactions')
            .insert({
                biz_no: bizNo,
                store_id: shopId,
                target_store_id: null,
                type: 'withdrawal',
                payment_method: paymentMethod,
                amount: amount,
                description: description || (Utils.lang === 'id' ? 'Penarikan modal (pembayaran pokok)' : '本金提现'),
                transaction_date: transactionDate || new Date().toISOString().split('T')[0],
                created_by: profile.id
            })
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                throw new Error(Utils.lang === 'id' ? '重复提交，请稍后再试' : '重复提交，请稍后再试');
            }
            throw error;
        }
        
        return data;
    },

    async distributeDividend(shopId, amount, paymentMethod, description, transactionDate) {
        const profile = await this.getCurrentProfile();
        
        if (profile?.role !== 'admin' && profile?.store_id !== shopId) {
            throw new Error(Utils.lang === 'id' ? 'Anda hanya dapat mengelola toko sendiri' : '您只能管理自己的门店');
        }
        
        const account = await this.getShopAccount(shopId);
        
        if (account.profit_balance < amount) {
            throw new Error(Utils.lang === 'id' 
                ? `Sisa laba tidak mencukupi. Tersedia: ${this.formatCurrency(account.profit_balance)}`
                : `未分配利润不足。可用: ${this.formatCurrency(account.profit_balance)}`);
        }
        
        const bizNo = this._generateBizNo('DIV');
        
        const { data, error } = await supabaseClient
            .from('capital_transactions')
            .insert({
                biz_no: bizNo,
                store_id: shopId,
                target_store_id: null,
                type: 'dividend',
                payment_method: paymentMethod,
                amount: amount,
                description: description || (Utils.lang === 'id' ? 'Pembagian dividen / laba' : '利润分红'),
                transaction_date: transactionDate || new Date().toISOString().split('T')[0],
                created_by: profile.id
            })
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') {
                throw new Error(Utils.lang === 'id' ? '重复提交，请稍后再试' : '重复提交，请稍后再试');
            }
            throw error;
        }
        
        return data;
    },

    async getAllShopsCapitalSummary() {
        const stores = await this.getAllStores();
        const summary = [];
        
        for (const store of stores) {
            const account = await this.getShopAccount(store.id);
            summary.push({
                store_id: store.id,
                store_name: store.name,
                store_code: store.code,
                principal_balance: account.principal_balance,
                profit_balance: account.profit_balance,
                total_invested: account.total_invested,
                total_withdrawn: account.total_withdrawn,
                total_profit: account.total_profit,
                total_dividend: account.total_dividend
            });
        }
        
        return summary;
    },

    async getCapitalTransactions() {
        const profile = await this.getCurrentProfile();
        
        let query = supabaseClient
            .from('capital_transactions')
            .select(`
                *,
                source_store:stores!capital_transactions_store_id_fkey(name, code),
                target_store:stores!capital_transactions_target_store_id_fkey(name, code)
            `)
            .order('transaction_date', { ascending: false });
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.or(`store_id.eq.${profile.store_id},target_store_id.eq.${profile.store_id}`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getCapitalSummary(byStore = false) {
        const profile = await this.getCurrentProfile();
        let query = supabaseClient
            .from('capital_transactions')
            .select('type, payment_method, amount, target_store_id, store_id');
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.or(`store_id.eq.${profile.store_id},target_store_id.eq.${profile.store_id}`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (byStore) {
            const storeMap = {};
            for (const t of data || []) {
                const targetId = t.target_store_id;
                if (!storeMap[targetId]) {
                    storeMap[targetId] = { 
                        investment: 0, withdrawal: 0, dividend: 0, 
                        reinvestment: 0, capital_circulation: 0, net: 0
                    };
                }
                if (t.type === 'investment') {
                    storeMap[targetId].investment += t.amount;
                    storeMap[targetId].net += t.amount;
                } else if (t.type === 'withdrawal') {
                    storeMap[targetId].withdrawal += t.amount;
                    storeMap[targetId].net -= t.amount;
                } else if (t.type === 'dividend') {
                    storeMap[targetId].dividend += t.amount;
                    storeMap[targetId].net -= t.amount;
                } else if (t.type === 'reinvestment') {
                    storeMap[targetId].reinvestment += t.amount;
                    storeMap[targetId].net += t.amount;
                } else if (t.type === 'capital_circulation') {
                    storeMap[targetId].capital_circulation += t.amount;
                    storeMap[targetId].net += t.amount;
                }
            }
            return { byStore: storeMap };
        }
        
        let cashInvestment = 0, bankInvestment = 0;
        let cashWithdrawal = 0, bankWithdrawal = 0;
        
        for (const t of data || []) {
            if (t.type === 'investment' || t.type === 'reinvestment' || t.type === 'capital_circulation') {
                if (t.payment_method === 'cash') cashInvestment += t.amount;
                else if (t.payment_method === 'bank') bankInvestment += t.amount;
            } else if (t.type === 'withdrawal' || t.type === 'dividend') {
                if (t.payment_method === 'cash') cashWithdrawal += t.amount;
                else if (t.payment_method === 'bank') bankWithdrawal += t.amount;
            }
        }
        
        return {
            cash: { investment: cashInvestment, withdrawal: cashWithdrawal, net: cashInvestment - cashWithdrawal },
            bank: { investment: bankInvestment, withdrawal: bankWithdrawal, net: bankInvestment - bankWithdrawal }
        };
    },

    // ==================== 现金流汇总（修复版 - 添加 profit 字段） ====================
    async getCashFlowSummary() {
        const profile = await this.getCurrentProfile();
        
        let incomeQuery = supabaseClient.from('payment_history').select('type, amount, payment_method');
        if (profile?.role !== 'admin' && profile?.store_id) {
            const { data: orders } = await supabaseClient.from('orders').select('id').eq('store_id', profile.store_id);
            const orderIds = orders?.map(o => o.id) || [];
            if (orderIds.length > 0) {
                incomeQuery = incomeQuery.in('order_id', orderIds);
            }
        }
        const { data: incomes } = await incomeQuery;
        
        let cashIncome = 0, bankIncome = 0;
        for (const p of incomes || []) {
            if (p.type === 'admin_fee' || p.type === 'interest' || p.type === 'principal') {
                if (p.payment_method === 'cash') cashIncome += p.amount;
                else if (p.payment_method === 'bank') bankIncome += p.amount;
            }
        }
        
        let expenseQuery = supabaseClient.from('expenses').select('amount, payment_method');
        if (profile?.role !== 'admin' && profile?.store_id) {
            expenseQuery = expenseQuery.eq('store_id', profile.store_id);
        }
        const { data: expenses } = await expenseQuery;
        
        let cashExpense = 0, bankExpense = 0;
        for (const e of expenses || []) {
            if (e.payment_method === 'cash') cashExpense += e.amount;
            else if (e.payment_method === 'bank') bankExpense += e.amount;
        }
        
        let capitalQuery = supabaseClient.from('capital_transactions').select('type, payment_method, amount, store_id, target_store_id');
        if (profile?.role !== 'admin' && profile?.store_id) {
            capitalQuery = capitalQuery.or(`store_id.eq.${profile.store_id},target_store_id.eq.${profile.store_id}`);
        }
        const { data: capitals } = await capitalQuery;
        
        let cashInvestment = 0, bankInvestment = 0;
        let cashWithdrawal = 0, bankWithdrawal = 0;
        
        for (const t of capitals || []) {
            if (profile?.role === 'admin') {
                if (t.type === 'investment' || t.type === 'reinvestment' || t.type === 'capital_circulation') {
                    if (t.payment_method === 'cash') cashInvestment += t.amount;
                    else if (t.payment_method === 'bank') bankInvestment += t.amount;
                } else if (t.type === 'withdrawal' || t.type === 'dividend') {
                    if (t.payment_method === 'cash') cashWithdrawal += t.amount;
                    else if (t.payment_method === 'bank') bankWithdrawal += t.amount;
                }
            } else {
                if ((t.target_store_id === profile.store_id) && 
                    (t.type === 'investment' || t.type === 'reinvestment' || t.type === 'capital_circulation')) {
                    if (t.payment_method === 'cash') cashInvestment += t.amount;
                    else if (t.payment_method === 'bank') bankInvestment += t.amount;
                } else if ((t.store_id === profile.store_id) && (t.type === 'withdrawal' || t.type === 'dividend')) {
                    if (t.payment_method === 'cash') cashWithdrawal += t.amount;
                    else if (t.payment_method === 'bank') bankWithdrawal += t.amount;
                }
            }
        }
        
        const cashBalance = (cashInvestment - cashWithdrawal) + cashIncome - cashExpense;
        const bankBalance = (bankInvestment - bankWithdrawal) + bankIncome - bankExpense;
        
        // ✅ 修复2：添加 profit 字段
        let profitBalance = 0;
        
        if (profile?.role === 'admin') {
            const stores = await this.getAllStores();
            let totalProfit = 0;
            for (const store of stores) {
                const account = await this.getShopAccount(store.id);
                totalProfit += account.profit_balance;
            }
            profitBalance = totalProfit;
        } else if (profile?.store_id) {
            const account = await this.getShopAccount(profile.store_id);
            profitBalance = account.profit_balance;
        }
        
        return {
            capital: {
                cash: { investment: cashInvestment, withdrawal: cashWithdrawal, net: cashInvestment - cashWithdrawal },
                bank: { investment: bankInvestment, withdrawal: bankWithdrawal, net: bankInvestment - bankWithdrawal }
            },
            cash: { 
                income: cashIncome, 
                expense: cashExpense, 
                netIncome: cashIncome - cashExpense,
                balance: cashBalance 
            },
            bank: { 
                income: bankIncome, 
                expense: bankExpense, 
                netIncome: bankIncome - bankExpense,
                balance: bankBalance 
            },
            total: { 
                income: cashIncome + bankIncome, 
                expense: cashExpense + bankExpense,
                netIncome: (cashIncome + bankIncome) - (cashExpense + bankExpense),
                balance: cashBalance + bankBalance 
            },
            // ✅ 新增 profit 字段
            profit: {
                balance: profitBalance
            }
        };
    },

    // ==================== WA 提醒相关 API ====================
    
    async getStoreWANumber(storeId) {
        const { data, error } = await supabaseClient
            .from('stores')
            .select('wa_number')
            .eq('id', storeId)
            .single();
        if (error && error.code !== 'PGRST116') return null;
        return data?.wa_number || null;
    },

    async updateStoreWANumber(storeId, waNumber) {
        const { error } = await supabaseClient
            .from('stores')
            .update({ wa_number: waNumber || null })
            .eq('id', storeId);
        if (error) throw error;
        return true;
    },

    async hasReminderSentToday(orderId) {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseClient
            .from('reminder_logs')
            .select('id')
            .eq('order_id', orderId)
            .eq('reminder_date', today)
            .maybeSingle();
        if (error) throw error;
        return !!data;
    },

    async logReminder(orderId) {
        const profile = await this.getCurrentProfile();
        const today = new Date().toISOString().split('T')[0];
        const { error } = await supabaseClient
            .from('reminder_logs')
            .insert({
                order_id: orderId,
                reminder_date: today,
                sent_by: profile?.id || null
            });
        if (error) throw error;
        return true;
    },

    async getOrdersNeedReminder() {
        const profile = await this.getCurrentProfile();
        const reminderDays = 2;
        
        let query = supabaseClient
            .from('orders')
            .select('*')
            .eq('status', 'active');
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        
        const { data: orders, error } = await query;
        if (error) throw error;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const needRemind = [];
        for (const order of orders || []) {
            if (!order.next_interest_due_date) continue;
            
            const dueDate = new Date(order.next_interest_due_date);
            dueDate.setHours(0, 0, 0, 0);
            const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilDue === reminderDays) {
                const alreadySent = await this.hasReminderSentToday(order.id);
                if (!alreadySent) {
                    needRemind.push(order);
                }
            }
        }
        
        return needRemind;
    },

    async getStoreName(storeId) {
        const { data, error } = await supabaseClient
            .from('stores')
            .select('name')
            .eq('id', storeId)
            .single();
        if (error) return '-';
        return data?.name || '-';
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
