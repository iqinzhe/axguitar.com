// supabase.js - 完整修复版 v5.1
// 修复内容：
// 1. 修复非管理员支付记录过滤不可靠问题（严重2）
// 2. 管理费解锁时同步处理 cash_flow_records（隐患3）
// 3. 乐观锁重试逻辑（本金还款和利息支付）
// 4. 新增现金净利计算函数（剔除本金）

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

    // ==================== 统一资金流向记录 ====================
    
    async recordCashFlow(flowData) {
        const profile = await this.getCurrentProfile();
        const { data, error } = await supabaseClient
            .from('cash_flow_records')
            .insert({
                store_id: flowData.store_id || profile?.store_id,
                flow_type: flowData.flow_type,
                direction: flowData.direction,
                amount: flowData.amount,
                source_target: flowData.source_target,
                order_id: flowData.order_id || null,
                customer_id: flowData.customer_id || null,
                description: flowData.description || '',
                recorded_by: profile?.id,
                recorded_at: new Date().toISOString(),
                reference_id: flowData.reference_id || null,
                is_voided: false,
                void_reason: null,
                voided_at: null,
                voided_by: null
            })
            .select()
            .single();
        
        if (error) throw error;
        return data;
    },
    
    // ==================== 作废资金流记录 ====================
    async voidCashFlow(originalFlowId, reason) {
        const profile = await this.getCurrentProfile();
        
        const { error: voidError } = await supabaseClient
            .from('cash_flow_records')
            .update({
                is_voided: true,
                void_reason: reason,
                voided_at: new Date().toISOString(),
                voided_by: profile?.id
            })
            .eq('id', originalFlowId);
        
        if (voidError) throw voidError;
        
        const { data: originalFlow } = await supabaseClient
            .from('cash_flow_records')
            .select('*')
            .eq('id', originalFlowId)
            .single();
        
        if (originalFlow) {
            await this.recordCashFlow({
                store_id: originalFlow.store_id,
                flow_type: originalFlow.flow_type + '_reversal',
                direction: originalFlow.direction === 'inflow' ? 'outflow' : 'inflow',
                amount: originalFlow.amount,
                source_target: originalFlow.source_target,
                order_id: originalFlow.order_id,
                customer_id: originalFlow.customer_id,
                description: `冲销: ${originalFlow.description} (原因: ${reason})`,
                reference_id: originalFlow.reference_id
            });
        }
        
        return true;
    },

    // ==================== 贷款发放记录（防重复） ====================
    async recordLoanDisbursement(orderId, amount, source, description) {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        
        const { data: existingFlow, error: checkError } = await supabaseClient
            .from('cash_flow_records')
            .select('id')
            .eq('order_id', order.id)
            .eq('flow_type', 'loan_disbursement')
            .eq('is_voided', false)
            .maybeSingle();
        
        if (existingFlow) {
            throw new Error(Utils.lang === 'id' 
                ? 'Pinjaman sudah dicairkan sebelumnya' 
                : '贷款已发放过');
        }
        
        const flowRecord = await this.recordCashFlow({
            store_id: order.store_id,
            flow_type: 'loan_disbursement',
            direction: 'outflow',
            amount: amount,
            source_target: source,
            order_id: order.id,
            customer_id: order.customer_id,
            description: description || `Pencairan pinjaman / 贷款发放 - ${order.order_id}`,
            reference_id: order.order_id
        });
        
        return flowRecord;
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
        const serviceFeePercent = orderData.service_fee_percent || 0;
        
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
                
                const monthlyInterest = orderData.loan_amount * 0.10;
                const serviceFeeAmount = orderData.loan_amount * (serviceFeePercent / 100);
                
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
                    service_fee_percent: serviceFeePercent,
                    service_fee_amount: serviceFeeAmount,
                    service_fee_paid: 0,
                    monthly_interest: monthlyInterest,
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

    // ==================== 管理费记录 ====================
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
        
        await this.recordCashFlow({
            store_id: order.store_id,
            flow_type: 'admin_fee',
            direction: 'inflow',
            amount: feeAmount,
            source_target: paymentMethod,
            order_id: order.id,
            customer_id: order.customer_id,
            description: `Admin Fee / 管理费 - ${order.order_id}`,
            reference_id: order.order_id
        });
        
        return true;
    },

    // ==================== 服务费记录 ====================
    async recordServiceFee(orderId, months, paymentMethod = 'cash') {
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        
        if (order.service_fee_percent <= 0) {
            throw new Error(Utils.lang === 'id' ? 'Service fee tidak diatur untuk order ini' : '该订单未设置服务费');
        }
        
        const serviceFeePerMonth = order.service_fee_amount;
        const totalServiceFee = serviceFeePerMonth * months;
        const newServiceFeePaid = (order.service_fee_paid || 0) + totalServiceFee;
        
        const { error: e1 } = await supabaseClient.from('orders').update({
            service_fee_paid: newServiceFeePaid
        }).eq('order_id', orderId);
        if (e1) throw e1;
        
        const paymentData = {
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'service_fee',
            months: months,
            amount: totalServiceFee,
            description: `Service Fee ${months} bulan (${order.service_fee_percent}%) / 服务费${months}个月`,
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        
        const { error: e2 } = await supabaseClient.from('payment_history').insert(paymentData);
        if (e2) throw e2;
        
        await this.recordCashFlow({
            store_id: order.store_id,
            flow_type: 'service_fee',
            direction: 'inflow',
            amount: totalServiceFee,
            source_target: paymentMethod,
            order_id: order.id,
            customer_id: order.customer_id,
            description: `Service Fee ${months} bulan (${order.service_fee_percent}%) - ${order.order_id}`,
            reference_id: order.order_id
        });
        
        return true;
    },

    // ==================== 利息记录（带乐观锁重试） ====================
    async recordInterestPayment(orderId, months, paymentMethod = 'cash') {
        const profile = await this.getCurrentProfile();
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                const currentOrder = await this.getOrder(orderId);
                const remainingPrincipal = currentOrder.loan_amount - currentOrder.principal_paid;
                
                if (remainingPrincipal <= 0) {
                    throw new Error(Utils.lang === 'id' ? 'Pokok sudah LUNAS' : '本金已结清');
                }
                
                const monthlyInterest = remainingPrincipal * 0.10;
                const totalInterest = monthlyInterest * months;
                
                const newInterestPaidMonths = currentOrder.interest_paid_months + months;
                const newInterestPaidTotal = currentOrder.interest_paid_total + totalInterest;
                
                const { data: updatedOrder, error: updateError } = await supabaseClient
                    .from('orders')
                    .update({
                        interest_paid_months: newInterestPaidMonths,
                        interest_paid_total: newInterestPaidTotal,
                        next_interest_due_date: this.calculateNextDueDate(currentOrder.created_at, newInterestPaidMonths),
                        monthly_interest: monthlyInterest
                    })
                    .eq('order_id', orderId)
                    .eq('interest_paid_months', currentOrder.interest_paid_months)
                    .select();
                
                if (updateError) {
                    if (updateError.code === 'PGRST116') {
                        console.warn(`乐观锁冲突: 订单 ${orderId} 利息支付重试 ${retryCount + 1}/${maxRetries}`);
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            throw new Error(Utils.lang === 'id' 
                                ? '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。'
                                : '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。');
                        }
                        continue;
                    }
                    throw updateError;
                }
                
                if (!updatedOrder || updatedOrder.length === 0) {
                    console.warn(`更新未生效: 订单 ${orderId} 利息支付重试 ${retryCount + 1}/${maxRetries}`);
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error(Utils.lang === 'id' 
                            ? '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。'
                            : '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。');
                    }
                    continue;
                }
                
                // 记录支付历史
                const paymentData = {
                    order_id: currentOrder.id,
                    date: new Date().toISOString().split('T')[0],
                    type: 'interest',
                    months: months,
                    amount: totalInterest,
                    description: `Bunga ${months} bulan / 利息${months}个月`,
                    recorded_by: profile.id,
                    payment_method: paymentMethod
                };
                
                const { error: paymentError } = await supabaseClient
                    .from('payment_history')
                    .insert(paymentData);
                
                if (paymentError) {
                    console.error('支付历史记录失败:', paymentError);
                }
                
                await this.recordCashFlow({
                    store_id: currentOrder.store_id,
                    flow_type: 'interest',
                    direction: 'inflow',
                    amount: totalInterest,
                    source_target: paymentMethod,
                    order_id: currentOrder.id,
                    customer_id: currentOrder.customer_id,
                    description: `Bunga ${months} bulan / 利息 - ${currentOrder.order_id}`,
                    reference_id: currentOrder.order_id
                });
                
                alert(Utils.lang === 'id' ? '✅ Bunga berhasil dicatat' : '✅ 利息记录成功');
                setTimeout(() => window.location.reload(), 500);
                return true;
                
            } catch (error) {
                if (retryCount >= maxRetries - 1) throw error;
                retryCount++;
            }
        }
        
        throw new Error(Utils.lang === 'id' 
            ? '⚠️ 系统繁忙，请稍后重试'
            : '⚠️ 系统繁忙，请稍后重试');
    },

    // ==================== 本金还款（带乐观锁重试） ====================
    async recordPrincipalPayment(orderId, amount, paymentMethod = 'cash') {
        const profile = await this.getCurrentProfile();
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                const currentOrder = await this.getOrder(orderId);
                const remainingPrincipal = currentOrder.loan_amount - currentOrder.principal_paid;
                
                if (remainingPrincipal <= 0) {
                    throw new Error(Utils.lang === 'id' ? 'Pokok sudah LUNAS' : '本金已结清');
                }
                
                let paidAmount = amount;
                let isAdjusted = false;
                
                if (amount > remainingPrincipal) {
                    const confirmMsg = Utils.lang === 'id' 
                        ? `⚠️ Jumlah yang dimasukkan (${this.formatCurrency(amount)}) melebihi sisa pokok (${this.formatCurrency(remainingPrincipal)}).\n\nApakah Anda ingin membayar ${this.formatCurrency(remainingPrincipal)} untuk melunasi pokok?`
                        : `⚠️ 输入金额 (${this.formatCurrency(amount)}) 超过剩余本金 (${this.formatCurrency(remainingPrincipal)}).\n\n是否支付 ${this.formatCurrency(remainingPrincipal)} 结清本金？`;
                    
                    if (!confirm(confirmMsg)) {
                        throw new Error(Utils.lang === 'id' ? 'Pembayaran dibatalkan' : '付款已取消');
                    }
                    paidAmount = remainingPrincipal;
                    isAdjusted = true;
                }
                
                const newPrincipalPaid = currentOrder.principal_paid + paidAmount;
                const newPrincipalRemaining = currentOrder.loan_amount - newPrincipalPaid;
                
                let updates = { 
                    principal_paid: newPrincipalPaid, 
                    principal_remaining: newPrincipalRemaining 
                };
                
                const isCompleted = newPrincipalRemaining <= 0;
                if (isCompleted) {
                    updates.status = 'completed';
                    updates.monthly_interest = 0;
                    updates.completed_at = new Date().toISOString();
                } else {
                    updates.monthly_interest = newPrincipalRemaining * 0.10;
                }
                
                const { data: updatedOrder, error: updateError } = await supabaseClient
                    .from('orders')
                    .update(updates)
                    .eq('order_id', orderId)
                    .eq('principal_paid', currentOrder.principal_paid)
                    .select();
                
                if (updateError) {
                    if (updateError.code === 'PGRST116') {
                        console.warn(`乐观锁冲突: 订单 ${orderId} 本金支付重试 ${retryCount + 1}/${maxRetries}`);
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            throw new Error(Utils.lang === 'id' 
                                ? '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。'
                                : '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。');
                        }
                        continue;
                    }
                    throw updateError;
                }
                
                if (!updatedOrder || updatedOrder.length === 0) {
                    console.warn(`更新未生效: 订单 ${orderId} 本金支付重试 ${retryCount + 1}/${maxRetries}`);
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error(Utils.lang === 'id' 
                            ? '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。'
                            : '⚠️ 订单数据已被其他操作修改，请刷新页面后重试。');
                    }
                    continue;
                }
                
                // 记录支付历史
                const isFullRepayment = paidAmount >= remainingPrincipal;
                const description = isFullRepayment 
                    ? (Utils.lang === 'id' ? '✅ Pelunasan Pokok / 全额还款' : '✅ 全额还款')
                    : (Utils.lang === 'id' ? 'Pembayaran Pokok / 部分还款' : '部分还款');
                
                const finalDescription = isAdjusted 
                    ? `${description} (${Utils.lang === 'id' ? 'jumlah disesuaikan otomatis' : '金额已自动调整'})`
                    : description;
                
                const paymentData = {
                    order_id: currentOrder.id,
                    date: new Date().toISOString().split('T')[0],
                    type: 'principal',
                    amount: paidAmount,
                    description: finalDescription,
                    recorded_by: profile.id,
                    payment_method: paymentMethod
                };
                
                const { error: paymentError } = await supabaseClient
                    .from('payment_history')
                    .insert(paymentData);
                
                if (paymentError) {
                    console.error('支付历史记录失败:', paymentError);
                }
                
                await this.recordCashFlow({
                    store_id: currentOrder.store_id,
                    flow_type: 'principal',
                    direction: 'inflow',
                    amount: paidAmount,
                    source_target: paymentMethod,
                    order_id: currentOrder.id,
                    customer_id: currentOrder.customer_id,
                    description: isFullRepayment ? '全额还款结清' : '部分还款',
                    reference_id: currentOrder.order_id
                });
                
                const successMsg = isFullRepayment
                    ? (Utils.lang === 'id' ? '✅ Pokok LUNAS! Pesanan selesai.' : '✅ 本金已结清！订单完成。')
                    : (Utils.lang === 'id' ? '✅ Pembayaran pokok berhasil' : '✅ 本金还款成功');
                
                alert(successMsg);
                setTimeout(() => window.location.reload(), 500);
                return true;
                
            } catch (error) {
                if (retryCount >= maxRetries - 1) throw error;
                retryCount++;
            }
        }
        
        throw new Error(Utils.lang === 'id' 
            ? '⚠️ 系统繁忙，请稍后重试'
            : '⚠️ 系统繁忙，请稍后重试');
    },

    // ==================== 解锁管理费（同步处理 cash_flow_records） ====================
    async unlockAdminFee(orderId, reason = 'admin_correction') {
        const profile = await this.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' 
                ? 'Hanya administrator yang dapat membuka kunci Admin Fee' 
                : '只有管理员可以解锁管理费');
        }
        
        const order = await this.getOrder(orderId);
        
        const { data: adminFeePayment, error: findError } = await supabaseClient
            .from('payment_history')
            .select('id, amount')
            .eq('order_id', order.id)
            .eq('type', 'admin_fee')
            .eq('is_voided', false)
            .maybeSingle();
        
        if (findError) throw findError;
        
        let adminFeeCashFlow = null;
        if (adminFeePayment) {
            const { data: cashFlow, error: cashFlowError } = await supabaseClient
                .from('cash_flow_records')
                .select('id')
                .eq('reference_id', order.order_id)
                .eq('flow_type', 'admin_fee')
                .eq('is_voided', false)
                .maybeSingle();
            
            if (!cashFlowError && cashFlow) {
                adminFeeCashFlow = cashFlow;
                await this.voidCashFlow(adminFeeCashFlow.id, reason);
            }
        }
        
        if (adminFeePayment) {
            const { error: markError } = await supabaseClient
                .from('payment_history')
                .update({ 
                    is_voided: true, 
                    void_reason: reason,
                    voided_at: new Date().toISOString(),
                    voided_by: profile.id
                })
                .eq('id', adminFeePayment.id);
            
            if (markError) throw markError;
        }
        
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
        
        await supabaseClient.from('cash_flow_records').delete().eq('order_id', order.id);
        
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
            total_service_fees: orders.reduce((s, o) => s + (o.service_fee_paid || 0), 0),
            total_interest: orders.reduce((s, o) => s + o.interest_paid_total, 0),
            total_principal: orders.reduce((s, o) => s + o.principal_paid, 0),
            expected_monthly_interest: activeOrders.reduce((s, o) => s + ((o.loan_amount - o.principal_paid) * 0.10), 0)
        };
    },

    // ==================== 获取所有支付记录（安全过滤） ====================
    async getAllPayments() {
        const profile = await this.getCurrentProfile();
        
        let orderQuery = supabaseClient.from('orders').select('id');
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            orderQuery = orderQuery.eq('store_id', profile.store_id);
        }
        
        const { data: accessibleOrders, error: orderError } = await orderQuery;
        
        if (orderError) {
            console.error("获取订单列表失败:", orderError);
            return [];
        }
        
        const accessibleOrderIds = accessibleOrders.map(o => o.id);
        
        if (accessibleOrderIds.length === 0) {
            return [];
        }
        
        const { data: payments, error: payError } = await supabaseClient
            .from('payment_history')
            .select('*')
            .in('order_id', accessibleOrderIds)
            .order('date', { ascending: false });
        
        if (payError) {
            console.error("获取支付记录失败:", payError);
            throw payError;
        }
        
        const orderMap = {};
        for (const order of accessibleOrders) {
            orderMap[order.id] = order;
        }
        
        const result = [];
        for (const p of payments) {
            result.push({
                ...p,
                orders: orderMap[p.order_id] || null
            });
        }
        
        return result;
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
    
    async getCashFlowRecords(storeId = null, startDate = null, endDate = null) {
        const profile = await this.getCurrentProfile();
        const targetStoreId = storeId || profile?.store_id;
        
        if (!targetStoreId && profile?.role !== 'admin') {
            throw new Error('Unauthorized');
        }
        
        let query = supabaseClient
            .from('cash_flow_records')
            .select('*, orders(order_id, customer_name)')
            .eq('is_voided', false)
            .order('recorded_at', { ascending: false });
        
        if (profile?.role !== 'admin' && targetStoreId) {
            query = query.eq('store_id', targetStoreId);
        } else if (profile?.role === 'admin' && storeId) {
            query = query.eq('store_id', storeId);
        }
        
        if (startDate) {
            query = query.gte('recorded_at', startDate);
        }
        if (endDate) {
            query = query.lte('recorded_at', endDate);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getShopAccount(storeId) {
        const targetStoreId = storeId || await this.getCurrentStoreId();
        
        if (!targetStoreId) {
            return { cash_balance: 0, bank_balance: 0, total_balance: 0 };
        }
        
        const { data: flows, error } = await supabaseClient
            .from('cash_flow_records')
            .select('direction, amount, source_target')
            .eq('store_id', targetStoreId)
            .eq('is_voided', false);
        
        if (error) {
            console.warn("getShopAccount error:", error);
            return { cash_balance: 0, bank_balance: 0, total_balance: 0 };
        }
        
        let cashBalance = 0;
        let bankBalance = 0;
        
        for (const flow of flows || []) {
            const amount = flow.amount || 0;
            if (flow.direction === 'inflow') {
                if (flow.source_target === 'cash') cashBalance += amount;
                else if (flow.source_target === 'bank') bankBalance += amount;
            } else if (flow.direction === 'outflow') {
                if (flow.source_target === 'cash') cashBalance -= amount;
                else if (flow.source_target === 'bank') bankBalance -= amount;
            }
        }
        
        return {
            cash_balance: cashBalance,
            bank_balance: bankBalance,
            total_balance: cashBalance + bankBalance
        };
    },

    async getCashFlowSummary() {
        const profile = await this.getCurrentProfile();
        
        let query = supabaseClient.from('cash_flow_records').select('direction, amount, source_target, flow_type').eq('is_voided', false);
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        
        const { data: flows, error } = await query;
        if (error) throw error;
        
        let cashInflow = 0, cashOutflow = 0;
        let bankInflow = 0, bankOutflow = 0;
        let totalIncome = 0, totalExpense = 0;
        
        for (const flow of flows || []) {
            const amount = flow.amount || 0;
            if (flow.direction === 'inflow') {
                totalIncome += amount;
                if (flow.source_target === 'cash') cashInflow += amount;
                else if (flow.source_target === 'bank') bankInflow += amount;
            } else if (flow.direction === 'outflow') {
                totalExpense += amount;
                if (flow.source_target === 'cash') cashOutflow += amount;
                else if (flow.source_target === 'bank') bankOutflow += amount;
            }
        }
        
        const cashBalance = cashInflow - cashOutflow;
        const bankBalance = bankInflow - bankOutflow;
        
        let incomeInflowExcludingPrincipal = 0;
        let totalOutflowAll = 0;
        for (const flow of flows || []) {
            const amount = flow.amount || 0;
            if (flow.direction === 'inflow' && flow.flow_type !== 'principal') {
                incomeInflowExcludingPrincipal += amount;
            } else if (flow.direction === 'outflow') {
                totalOutflowAll += amount;
            }
        }
        const netProfit = incomeInflowExcludingPrincipal - totalOutflowAll;
        
        return {
            cash: { 
                income: cashInflow, 
                expense: cashOutflow, 
                netIncome: cashInflow - cashOutflow,
                balance: cashBalance 
            },
            bank: { 
                income: bankInflow, 
                expense: bankOutflow, 
                netIncome: bankInflow - bankOutflow,
                balance: bankBalance 
            },
            total: { 
                income: totalIncome, 
                expense: totalExpense,
                netIncome: totalIncome - totalExpense,
                balance: cashBalance + bankBalance 
            },
            netProfit: { balance: netProfit }
        };
    },

    async addExpense(expenseData) {
        const profile = await this.getCurrentProfile();
        
        const { data, error } = await supabaseClient
            .from('expenses')
            .insert({
                store_id: expenseData.store_id || profile?.store_id,
                expense_date: expenseData.expense_date,
                category: expenseData.category,
                amount: expenseData.amount,
                description: expenseData.description || null,
                payment_method: expenseData.payment_method,
                created_by: profile?.id,
                is_locked: true,
                is_reconciled: false
            })
            .select()
            .single();
        
        if (error) throw error;
        
        await this.recordCashFlow({
            store_id: expenseData.store_id || profile?.store_id,
            flow_type: 'expense',
            direction: 'outflow',
            amount: expenseData.amount,
            source_target: expenseData.payment_method,
            description: expenseData.category + (expenseData.description ? ' - ' + expenseData.description : ''),
            reference_id: data.id
        });
        
        return data;
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

    // ==================== 内部转账相关 API ====================

    // 记录内部转账
    async recordInternalTransfer(transferData) {
        const profile = await this.getCurrentProfile();
        
        // 验证金额
        if (transferData.amount <= 0) {
            throw new Error(Utils.lang === 'id' 
                ? 'Jumlah transfer harus lebih dari 0'
                : '转账金额必须大于0');
        }
        
        // 验证余额是否足够
        if (transferData.transfer_type === 'cash_to_bank') {
            const cashFlow = await this.getCashFlowSummary();
            if (cashFlow.cash.balance < transferData.amount) {
                throw new Error(Utils.lang === 'id' 
                    ? `Saldo kas tidak mencukupi. Saldo saat ini: ${this.formatCurrency(cashFlow.cash.balance)}`
                    : `保险柜余额不足。当前余额: ${this.formatCurrency(cashFlow.cash.balance)}`);
            }
        } else if (transferData.transfer_type === 'bank_to_cash') {
            const cashFlow = await this.getCashFlowSummary();
            if (cashFlow.bank.balance < transferData.amount) {
                throw new Error(Utils.lang === 'id' 
                    ? `Saldo bank tidak mencukupi. Saldo saat ini: ${this.formatCurrency(cashFlow.bank.balance)}`
                    : `银行余额不足。当前余额: ${this.formatCurrency(cashFlow.bank.balance)}`);
            }
        } else if (transferData.transfer_type === 'store_to_hq') {
            const shopAccount = await this.getShopAccount(transferData.store_id || profile?.store_id);
            if (shopAccount.bank_balance < transferData.amount) {
                throw new Error(Utils.lang === 'id' 
                    ? `Saldo bank toko tidak mencukupi. Saldo saat ini: ${this.formatCurrency(shopAccount.bank_balance)}`
                    : `门店银行余额不足。当前余额: ${this.formatCurrency(shopAccount.bank_balance)}`);
            }
        }
        
        // 插入转账记录
        const { data, error } = await supabaseClient
            .from('internal_transfers')
            .insert({
                transfer_date: transferData.transfer_date || new Date().toISOString().split('T')[0],
                transfer_type: transferData.transfer_type,
                from_account: transferData.from_account,
                to_account: transferData.to_account,
                amount: transferData.amount,
                description: transferData.description || '',
                store_id: transferData.store_id || profile?.store_id,
                created_by: profile?.id
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // 记录现金流（从来源账户扣除）
        await this.recordCashFlow({
            store_id: transferData.store_id || profile?.store_id,
            flow_type: 'internal_transfer_out',
            direction: 'outflow',
            amount: transferData.amount,
            source_target: transferData.from_account === 'hq' ? 'bank' : transferData.from_account,
            description: `内部转账转出: ${transferData.from_account} → ${transferData.to_account} - ${transferData.description || ''}`,
            reference_id: data.id
        });
        
        // 记录现金流（向目标账户增加）- 上缴总部时目标账户不记录现金流（总部系统单独处理）
        if (transferData.to_account !== 'hq') {
            await this.recordCashFlow({
                store_id: transferData.store_id || profile?.store_id,
                flow_type: 'internal_transfer_in',
                direction: 'inflow',
                amount: transferData.amount,
                source_target: transferData.to_account,
                description: `内部转账转入: ${transferData.from_account} → ${transferData.to_account} - ${transferData.description || ''}`,
                reference_id: data.id
            });
        }
        
        return data;
    },

    // 获取内部转账历史记录
    async getInternalTransfers(storeId = null, startDate = null, endDate = null) {
        const profile = await this.getCurrentProfile();
        
        let query = supabaseClient
            .from('internal_transfers')
            .select('*, stores(name, code), created_by_profile:user_profiles!internal_transfers_created_by_fkey(name)')
            .order('transfer_date', { ascending: false });
        
        // 权限控制：管理员看全部，非管理员只看本门店
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        } else if (profile?.role === 'admin' && storeId && storeId !== 'all') {
            query = query.eq('store_id', storeId);
        }
        
        if (startDate) {
            query = query.gte('transfer_date', startDate);
        }
        if (endDate) {
            query = query.lte('transfer_date', endDate);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // 获取门店可上缴总部的金额（银行余额）
    async getRemittableAmount(storeId) {
        const shopAccount = await this.getShopAccount(storeId);
        // 只能上缴银行账户的资金
        return shopAccount.bank_balance;
    },

    // 上缴总部（门店 → 总部）
    async remitToHeadquarters(storeId, amount, description) {
        const profile = await this.getCurrentProfile();
        
        // 权限检查：只有管理员可以执行上缴总部操作
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' 
                ? 'Hanya administrator yang dapat melakukan setoran ke kantor pusat'
                : '只有管理员可以执行上缴总部操作');
        }
        
        // 检查是否有足够余额
        const shopAccount = await this.getShopAccount(storeId);
        if (shopAccount.bank_balance < amount) {
            throw new Error(Utils.lang === 'id' 
                ? `Saldo bank tidak mencukupi. Saldo saat ini: ${this.formatCurrency(shopAccount.bank_balance)}`
                : `银行余额不足。当前余额: ${this.formatCurrency(shopAccount.bank_balance)}`);
        }
        
        // 记录内部转账
        const transfer = await this.recordInternalTransfer({
            transfer_type: 'store_to_hq',
            from_account: 'bank',
            to_account: 'hq',
            amount: amount,
            description: description || (Utils.lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部'),
            store_id: storeId
        });
        
        return transfer;
    }

window.SUPABASE = SupabaseAPI;
window.supabaseClient = supabaseClient;
