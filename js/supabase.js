// supabase.js - v1.9（审计日志集成）

const SUPABASE_URL = "https://hiupsvsbcdsgoyiieqiv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdXBzdnNiY2RzZ295aWllcWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODA3NjYsImV4cCI6MjA5MTU1Njc2Nn0.qL7Qw0I7Ogws_kMoOAae_fCzkhVm-c7NhLPu8rxaJpU";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let _profileCache = null;
let _storePrefixCache = new Map();
let _storesCache = null;
let _storesCacheTime = 0;
const STORES_CACHE_TTL = 5 * 60 * 1000;

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
        _storePrefixCache.clear();
        _storesCache = null;
        _storesCacheTime = 0;
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
        this.clearCache();
        return data;
    },

    async logout() {
        this.clearCache();
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    },

    async getAllStores(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && _storesCache && (now - _storesCacheTime) < STORES_CACHE_TTL) {
            return _storesCache;
        }
        
        const { data, error } = await supabaseClient.from('stores').select('*').order('code');
        if (error) throw error;
        
        _storesCache = data;
        _storesCacheTime = now;
        
        for (var i = 0; i < data.length; i++) {
            var store = data[i];
            if (store.prefix) {
                _storePrefixCache.set(store.id, store.prefix);
                _storePrefixCache.set(store.code, store.prefix);
            }
        }
        
        return data;
    },

    async _getStorePrefix(storeId) {
        if (!storeId) return 'AD';
        
        if (_storePrefixCache.has(storeId)) {
            return _storePrefixCache.get(storeId);
        }
        
        try {
            const { data, error } = await supabaseClient
                .from('stores')
                .select('prefix, code')
                .eq('id', storeId)
                .single();
            
            if (error || !data) {
                console.warn('获取门店 ' + storeId + ' 前缀失败:', error);
                return 'AD';
            }
            
            let prefix = data.prefix;
            if (!prefix && data.code) {
                const codeToPrefixMap = {
                    'STORE_000': 'AD',
                    'STORE_001': 'BL',
                    'STORE_002': 'SO',
                    'STORE_003': 'GP',
                    'STORE_004': 'BJ'
                };
                prefix = codeToPrefixMap[data.code] || 'AD';
            }
            if (!prefix) prefix = 'AD';
            
            _storePrefixCache.set(storeId, prefix);
            if (data.code) _storePrefixCache.set(data.code, prefix);
            
            return prefix;
        } catch (err) {
            console.error("_getStorePrefix error:", err);
            return 'AD';
        }
    },

    async _generateOrderId(role, storeId) {
        let prefix = 'AD';
        if (role !== 'admin') {
            prefix = await this._getStorePrefix(storeId);
        }
        
        const { data: orders, error } = await supabaseClient
            .from('orders')
            .select('order_id')
            .like('order_id', prefix + '%')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let maxNumber = 0;
        if (orders && orders.length > 0) {
            const match = orders[0].order_id.match(new RegExp(prefix + '(\\d{3})$'));
            if (match) {
                maxNumber = parseInt(match[1], 10);
            }
        }
        
        const nextNumber = maxNumber + 1;
        const serial = String(nextNumber).padStart(3, '0');
        
        return prefix + serial;
    },

    async _generateCustomerId(storeId) {
        const prefix = await this._getStorePrefix(storeId);
        
        const { data, error } = await supabaseClient
            .from('customers')
            .select('customer_id')
            .like('customer_id', prefix + '%')
            .order('customer_id', { ascending: false })
            .limit(1);
        
        let maxNumber = 0;
        if (data && data.length > 0) {
            const match = data[0].customer_id.match(new RegExp(prefix + '(\\d{3})$'));
            if (match) {
                maxNumber = parseInt(match[1], 10);
            }
        }
        
        const nextNumber = maxNumber + 1;
        const serial = String(nextNumber).padStart(3, '0');
        
        return prefix + serial;
    },

    async createCustomer(customerData) {
        const profile = await this.getCurrentProfile();
        const storeId = customerData.store_id || profile.store_id;
        
        let retryCount = 0;
        let maxRetries = 5;
        let lastError = null;
        
        while (retryCount < maxRetries) {
            try {
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
                
                if (error) {
                    if (error.code === '23505') {
                        console.warn(`客户ID ${customerId} 已存在，重试第 ${retryCount + 1} 次`);
                        retryCount++;
                        lastError = error;
                        continue;
                    }
                    throw error;
                }
                
                return data;
                
            } catch (err) {
                if (err.code === '23505' && retryCount < maxRetries - 1) {
                    retryCount++;
                    continue;
                }
                throw err;
            }
        }
        
        throw lastError || new Error('无法创建客户，请重试');
    },

    calculateNextDueDate: function(startDate, paidMonths) {
        if (!startDate) {
            startDate = new Date().toISOString().split('T')[0];
        }
        
        let date = new Date(startDate);
        if (isNaN(date.getTime())) {
            console.warn("calculateNextDueDate: 无效的日期", startDate);
            date = new Date();
        }
        
        const originalDay = date.getDate();
        date.setMonth(date.getMonth() + paidMonths + 1);
        
        if (date.getDate() !== originalDay) {
            date.setDate(0);
        }
        
        return date.toISOString().split('T')[0];
    },

    async recordCashFlow(flowData) {
        const profile = await this.getCurrentProfile();
        
        const storeId = flowData.store_id || profile?.store_id;
        if (!storeId) {
            console.error("recordCashFlow: store_id 缺失", flowData);
            throw new Error(Utils.lang === 'id' ? 'ID toko tidak ditemukan' : '门店ID缺失');
        }
        
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
            recorded_at: new Date().toISOString(),
            reference_id: flowData.reference_id || null,
            is_voided: false,
            void_reason: null,
            voided_at: null,
            voided_by: null
        };
        
        console.log("📝 记录资金流水:", record);
        
        const { data, error } = await supabaseClient
            .from('cash_flow_records')
            .insert(record)
            .select()
            .single();
        
        if (error) {
            console.error("recordCashFlow 失败:", error);
            throw error;
        }
        
        console.log("✅ 资金流水记录成功:", data);
        return data;
    },
    
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
                description: '冲销: ' + originalFlow.description,
                reference_id: originalFlow.reference_id
            });
        }
        
        return true;
    },

    async recordLoanDisbursement(orderId, amount, source, description) {
        const order = await this.getOrder(orderId);
        
        const { data: existingFlow, error: checkError } = await supabaseClient
            .from('cash_flow_records')
            .select('id')
            .eq('order_id', order.id)
            .eq('flow_type', 'loan_disbursement')
            .eq('is_voided', false)
            .maybeSingle();
        
        if (existingFlow) {
            throw new Error(Utils.t('loan_already_disbursed'));
        }
        
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

    async getOrders(filters) {
        if (filters === undefined) filters = {};
        const profile = await this.getCurrentProfile();
        let query = supabaseClient.from('orders').select('*');
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        
        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
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

        const profile = await this.getCurrentProfile();
        if (profile?.role !== 'admin' && profile?.store_id && data.store_id !== profile.store_id) {
            throw new Error(Utils.t('unauthorized'));
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
        return { order: order, payments: data };
    },

    async createOrder(orderData) {
        const profile = await this.getCurrentProfile();
        const nowDate = new Date().toISOString().split('T')[0];
        
        const adminFee = orderData.admin_fee || Utils.calculateAdminFee(orderData.loan_amount);
        const serviceFeePercent = orderData.service_fee_percent !== undefined ? orderData.service_fee_percent : 0;
        const serviceFeeAmount = orderData.service_fee_amount || 0;
        const agreedInterestRate = (orderData.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE_PERCENT) / 100;
        const repaymentType = orderData.repayment_type || 'flexible';
        const repaymentTerm = orderData.repayment_term || null;
        
        const targetStoreId = orderData.store_id || profile.store_id;
        
        if (profile.role === 'admin' && !orderData.store_id) {
            throw new Error(Utils.t('store_operation'));
        }
        
        if (!targetStoreId) {
            throw new Error(Utils.lang === 'id' ? 'Toko tidak ditemukan' : '未找到门店');
        }
        
        let retryCount = 0;
        let lastError = null;
        
        while (retryCount < 3) {
            try {
                const orderId = await this._generateOrderId(profile.role, targetStoreId);
                
                let monthlyFixedPayment = null;
                if (repaymentType === 'fixed' && repaymentTerm && repaymentTerm > 0) {
                    if (orderData.monthly_fixed_payment) {
                        monthlyFixedPayment = orderData.monthly_fixed_payment;
                    } else {
                        var calculated = Utils.calculateFixedMonthlyPayment(orderData.loan_amount, agreedInterestRate, repaymentTerm);
                        monthlyFixedPayment = Utils.roundMonthlyPayment(calculated);
                    }
                }
                
                const monthlyInterest = orderData.loan_amount * agreedInterestRate;
                const nextDueDate = this.calculateNextDueDate(nowDate, 0);
                
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
                    next_interest_due_date: nextDueDate,
                    principal_paid: 0,
                    principal_remaining: orderData.loan_amount,
                    status: 'active',
                    store_id: targetStoreId,
                    created_by: profile.id,
                    notes: orderData.notes || '',
                    customer_id: orderData.customer_id || null,
                    is_locked: true,
                    locked_at: new Date().toISOString(),
                    locked_by: profile.id,
                    repayment_type: repaymentType,
                    repayment_term: repaymentTerm,
                    monthly_fixed_payment: monthlyFixedPayment,
                    agreed_interest_rate: agreedInterestRate,
                    agreed_service_fee_rate: serviceFeePercent / 100,
                    fixed_paid_months: 0,
                    overdue_days: 0,
                    liquidation_status: 'normal',
                    max_extension_months: orderData.max_extension_months || 10
                };

                const { data, error } = await supabaseClient.from('orders').insert(newOrder).select().single();
                
                if (error) {
                    if (error.code === '23505') {
                        console.warn('订单ID冲突: ' + orderId + ', 重试第 ' + (retryCount + 1) + ' 次');
                        retryCount++;
                        continue;
                    }
                    throw error;
                }
                
                console.log('✅ 订单创建成功: ' + orderId + ' (还款方式: ' + repaymentType + ')');
                
                // 审计：创建订单
                if (window.Audit) {
                    await window.Audit.logOrderCreate(orderId, orderData.customer_name, orderData.loan_amount);
                }
                
                return data;
                
            } catch (err) {
                if (retryCount >= 2) throw err;
                retryCount++;
                lastError = err;
            }
        }
        throw lastError || new Error(Utils.lang === 'id' ? 'Gagal membuat pesanan' : '创建订单失败');
    },

    async recordAdminFee(orderId, paymentMethod, adminFeeAmount) {
        if (paymentMethod === undefined) paymentMethod = 'cash';
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
            description: Utils.t('admin_fee'),
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
            description: Utils.t('admin_fee') + ' - ' + order.order_id,
            reference_id: order.order_id
        });
        
        // 审计：管理费收款
        if (window.Audit) {
            await window.Audit.logPayment(order.order_id, 'admin_fee', feeAmount, paymentMethod);
        }
        
        return true;
    },

    async recordServiceFee(orderId, months, paymentMethod) {
        if (paymentMethod === undefined) paymentMethod = 'cash';
        const order = await this.getOrder(orderId);
        const profile = await this.getCurrentProfile();
        
        if (order.service_fee_percent <= 0 && order.service_fee_amount <= 0) {
            return true;
        }
        
        if (order.service_fee_paid > 0) {
            return true;
        }
        
        const totalServiceFee = order.service_fee_amount || 0;
        
        if (totalServiceFee <= 0) return true;
        
        const { error: e1 } = await supabaseClient.from('orders').update({
            service_fee_paid: totalServiceFee
        }).eq('order_id', orderId);
        if (e1) throw e1;
        
        const paymentData = {
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'service_fee',
            months: 1,
            amount: totalServiceFee,
            description: Utils.t('service_fee'),
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
            description: Utils.t('service_fee') + ' - ' + order.order_id,
            reference_id: order.order_id
        });
        
        // 审计：服务费收款
        if (window.Audit) {
            await window.Audit.logPayment(order.order_id, 'service_fee', totalServiceFee, paymentMethod);
        }
        
        return true;
    },

    async recordInterestPayment(orderId, months, paymentMethod) {
        if (paymentMethod === undefined) paymentMethod = 'cash';
        const profile = await this.getCurrentProfile();
        const currentOrder = await this.getOrder(orderId);
        
        if (currentOrder.status === 'completed') {
            throw new Error(Utils.t('order_completed'));
        }
        
        const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
        
        const loanAmount = currentOrder.loan_amount || 0;
        const principalPaid = currentOrder.principal_paid || 0;
        const remainingPrincipal = loanAmount - principalPaid;
        const monthlyInterest = remainingPrincipal * monthlyRate;
        const totalInterest = monthlyInterest * months;
        
        const newInterestPaidMonths = (currentOrder.interest_paid_months || 0) + months;
        const newInterestPaidTotal = (currentOrder.interest_paid_total || 0) + totalInterest;
        
        const maxMonths = currentOrder.max_extension_months || 10;
        
        if (newInterestPaidMonths > maxMonths) {
            throw new Error(Utils.lang === 'id' 
                ? '❌ Mencapai batas maksimum perpanjangan (' + maxMonths + ' bulan), harap lunasi pokok segera'
                : '❌ 已达到最大延期期限 (' + maxMonths + '个月)，请尽快结清本金');
        }
        
        const nextDueDate = this.calculateNextDueDate(currentOrder.created_at, newInterestPaidMonths);
        
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update({
                interest_paid_months: newInterestPaidMonths,
                interest_paid_total: newInterestPaidTotal,
                next_interest_due_date: nextDueDate,
                monthly_interest: monthlyInterest,
                updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        const paymentData = {
            order_id: currentOrder.id,
            date: new Date().toISOString().split('T')[0],
            type: 'interest',
            months: months,
            amount: totalInterest,
            description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang === 'id' ? 'bulan' : '个月') + ' (' + (monthlyRate*100).toFixed(1) + '%)',
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        
        const { error: paymentError } = await supabaseClient
            .from('payment_history')
            .insert(paymentData);
        
        if (paymentError) throw paymentError;
        
        await this.recordCashFlow({
            store_id: currentOrder.store_id,
            flow_type: 'interest',
            direction: 'inflow',
            amount: totalInterest,
            source_target: paymentMethod,
            order_id: currentOrder.id,
            customer_id: currentOrder.customer_id,
            description: Utils.t('interest') + ' ' + months + ' ' + (Utils.lang === 'id' ? 'bulan' : '个月') + ' (' + (monthlyRate*100).toFixed(1) + '%)',
            reference_id: currentOrder.order_id
        });
        
        // 审计：利息收款
        if (window.Audit) {
            await window.Audit.logPayment(currentOrder.order_id, 'interest', totalInterest, paymentMethod);
        }
        
        return true;
    },

    async recordPrincipalPayment(orderId, amount, paymentMethod) {
        if (paymentMethod === undefined) paymentMethod = 'cash';
        const profile = await this.getCurrentProfile();
        const currentOrder = await this.getOrder(orderId);
        
        if (currentOrder.status === 'completed') {
            throw new Error(Utils.t('order_completed'));
        }
        
        const loanAmount = currentOrder.loan_amount || 0;
        const principalPaid = currentOrder.principal_paid || 0;
        const remainingPrincipal = loanAmount - principalPaid;
        
        if (remainingPrincipal <= 0) {
            throw new Error(Utils.lang === 'id' ? '❌ Pokok sudah lunas' : '❌ 本金已结清');
        }
        
        let paidAmount = Math.min(amount, remainingPrincipal);
        
        if (paidAmount <= 0) {
            throw new Error(Utils.t('invalid_amount'));
        }
        
        const newPrincipalPaid = principalPaid + paidAmount;
        const newPrincipalRemaining = loanAmount - newPrincipalPaid;
        const monthlyRate = currentOrder.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
        
        let updates = { 
            principal_paid: newPrincipalPaid, 
            principal_remaining: newPrincipalRemaining,
            updated_at: new Date().toISOString()
        };
        
        const isFullRepayment = newPrincipalRemaining <= 0;
        if (isFullRepayment) {
            updates.status = 'completed';
            updates.monthly_interest = 0;
            updates.completed_at = new Date().toISOString();
        } else {
            updates.monthly_interest = newPrincipalRemaining * monthlyRate;
        }
        
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update(updates)
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        const paymentData = {
            order_id: currentOrder.id,
            date: new Date().toISOString().split('T')[0],
            type: 'principal',
            amount: paidAmount,
            description: isFullRepayment ? (Utils.lang === 'id' ? 'LUNAS' : '结清') : (Utils.lang === 'id' ? 'Pembayaran pokok' : '还款'),
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        
        const { error: paymentError } = await supabaseClient
            .from('payment_history')
            .insert(paymentData);
        
        if (paymentError) throw paymentError;
        
        await this.recordCashFlow({
            store_id: currentOrder.store_id,
            flow_type: 'principal',
            direction: 'inflow',
            amount: paidAmount,
            source_target: paymentMethod,
            order_id: currentOrder.id,
            customer_id: currentOrder.customer_id,
            description: isFullRepayment ? (Utils.lang === 'id' ? 'LUNAS' : '结清') : (Utils.lang === 'id' ? 'Pembayaran pokok' : '还款'),
            reference_id: currentOrder.order_id
        });
        
        // 审计：本金还款
        if (window.Audit) {
            await window.Audit.logPayment(currentOrder.order_id, 'principal', paidAmount, paymentMethod);
        }
        
        if (isFullRepayment) {
            alert(Utils.lang === 'id' ? '✅ Pesanan lunas' : '✅ 订单已结清');
        } else {
            alert((Utils.lang === 'id' ? '✅ Pembayaran pokok ' : '✅ 还款 ') + this.formatCurrency(paidAmount) + (Utils.lang === 'id' ? ' telah dicatat' : ' 已记录'));
        }
        
        return true;
    },

    async recordFixedPayment(orderId, paymentMethod) {
        if (paymentMethod === undefined) paymentMethod = 'cash';
        const profile = await this.getCurrentProfile();
        const order = await this.getOrder(orderId);
        
        if (order.status === 'completed') {
            throw new Error(Utils.t('order_completed'));
        }
        
        if (order.repayment_type !== 'fixed') {
            throw new Error(Utils.lang === 'id' ? '❌ Pesanan ini bukan cicilan tetap' : '❌ 此订单不是固定还款模式');
        }
        
        const fixedPayment = order.monthly_fixed_payment;
        const paidMonths = order.fixed_paid_months || 0;
        const remainingMonths = order.repayment_term - paidMonths;
        
        if (remainingMonths <= 0) {
            throw new Error(Utils.lang === 'id' ? '❌ Pesanan sudah lunas' : '❌ 订单已结清');
        }
        
        const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
        const remainingPrincipal = order.principal_remaining;
        const interestAmount = remainingPrincipal * monthlyRate;
        const principalAmount = fixedPayment - interestAmount;
        
        if (fixedPayment <= 0) {
            throw new Error(Utils.lang === 'id' ? '❌ Jumlah angsuran tidak valid' : '❌ 还款金额无效');
        }
        
        const newPrincipalPaid = (order.principal_paid || 0) + principalAmount;
        const newPrincipalRemaining = order.loan_amount - newPrincipalPaid;
        const newFixedPaidMonths = paidMonths + 1;
        const isCompleted = newFixedPaidMonths >= order.repayment_term || newPrincipalRemaining <= 0;
        const newMonthlyInterest = newPrincipalRemaining * monthlyRate;
        
        const nextDueDate = this.calculateNextDueDate(order.created_at, newFixedPaidMonths);
        
        const updates = {
            principal_paid: newPrincipalPaid,
            principal_remaining: newPrincipalRemaining,
            fixed_paid_months: newFixedPaidMonths,
            monthly_interest: newMonthlyInterest,
            interest_paid_months: (order.interest_paid_months || 0) + 1,
            interest_paid_total: (order.interest_paid_total || 0) + interestAmount,
            next_interest_due_date: nextDueDate,
            updated_at: new Date().toISOString()
        };
        
        if (isCompleted) {
            updates.status = 'completed';
            updates.completed_at = new Date().toISOString();
        }
        
        const { error: updateError } = await supabaseClient
            .from('orders')
            .update(updates)
            .eq('order_id', orderId);
        
        if (updateError) throw updateError;
        
        if (interestAmount > 0) {
            const interestPayment = {
                order_id: order.id,
                date: new Date().toISOString().split('T')[0],
                type: 'interest',
                months: 1,
                amount: interestAmount,
                description: (Utils.lang === 'id' ? 'Cicilan tetap - Bunga' : '固定还款-利息') + ' ' + newFixedPaidMonths,
                recorded_by: profile.id,
                payment_method: paymentMethod
            };
            await supabaseClient.from('payment_history').insert(interestPayment);
            
            await this.recordCashFlow({
                store_id: order.store_id,
                flow_type: 'interest',
                direction: 'inflow',
                amount: interestAmount,
                source_target: paymentMethod,
                order_id: order.id,
                customer_id: order.customer_id,
                description: (Utils.lang === 'id' ? 'Cicilan tetap bunga' : '固定还款利息') + ' - ' + order.order_id + ' ' + (Utils.lang === 'id' ? 'ke' : '第') + newFixedPaidMonths,
                reference_id: order.order_id
            });
        }
        
        if (principalAmount > 0) {
            const principalPayment = {
                order_id: order.id,
                date: new Date().toISOString().split('T')[0],
                type: 'principal',
                amount: principalAmount,
                description: (Utils.lang === 'id' ? 'Cicilan tetap - Pokok' : '固定还款-本金') + ' ' + newFixedPaidMonths,
                recorded_by: profile.id,
                payment_method: paymentMethod
            };
            await supabaseClient.from('payment_history').insert(principalPayment);
            
            await this.recordCashFlow({
                store_id: order.store_id,
                flow_type: 'principal',
                direction: 'inflow',
                amount: principalAmount,
                source_target: paymentMethod,
                order_id: order.id,
                customer_id: order.customer_id,
                description: (Utils.lang === 'id' ? 'Cicilan tetap pokok' : '固定还款本金') + ' - ' + order.order_id + ' ' + (Utils.lang === 'id' ? 'ke' : '第') + newFixedPaidMonths,
                reference_id: order.order_id
            });
        }
        
        // 审计：固定还款
        if (window.Audit) {
            await window.Audit.logPayment(order.order_id, 'fixed_installment', fixedPayment, paymentMethod);
        }
        
        return true;
    },

    async earlySettleFixedOrder(orderId, paymentMethod) {
        if (paymentMethod === undefined) paymentMethod = 'cash';
        const profile = await this.getCurrentProfile();
        const order = await this.getOrder(orderId);
        
        if (order.status === 'completed') {
            throw new Error(Utils.t('order_completed'));
        }
        
        if (order.repayment_type !== 'fixed') {
            throw new Error(Utils.lang === 'id' ? '❌ Pesanan ini bukan cicilan tetap' : '❌ 此订单不是固定还款模式');
        }
        
        const paidMonths = order.fixed_paid_months || 0;
        const remainingPrincipal = order.principal_remaining;
        const monthlyRate = order.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE;
        const remainingMonths = order.repayment_term - paidMonths;
        
        const settlementAmount = remainingPrincipal;
        const savedInterest = remainingPrincipal * monthlyRate * remainingMonths;
        
        const confirmMsg = Utils.lang === 'id'
            ? '⚠️ Konfirmasi Pelunasan Dipercepat\n\nPesanan: ' + order.order_id + '\nNasabah: ' + order.customer_name + '\nAngsuran terbayar: ' + paidMonths + '/' + order.repayment_term + '\nSisa Pokok: ' + this.formatCurrency(remainingPrincipal) + '\nBunga yang dihemat: ' + this.formatCurrency(savedInterest) + '\nJumlah Pelunasan: ' + this.formatCurrency(settlementAmount) + '\n\nLanjutkan?'
            : '⚠️ 提前结清确认\n\n订单号: ' + order.order_id + '\n客户: ' + order.customer_name + '\n已还期数: ' + paidMonths + '/' + order.repayment_term + '\n剩余本金: ' + this.formatCurrency(remainingPrincipal) + '\n减免利息: ' + this.formatCurrency(savedInterest) + '\n结清金额: ' + this.formatCurrency(settlementAmount) + '\n\n确认结清？';
        
        if (!confirm(confirmMsg)) return false;
        
        const finalPayment = {
            order_id: order.id,
            date: new Date().toISOString().split('T')[0],
            type: 'principal',
            amount: settlementAmount,
            description: Utils.lang === 'id' ? 'Pelunasan dipercepat - hemat bunga' : '提前结清 - 减免剩余利息',
            recorded_by: profile.id,
            payment_method: paymentMethod
        };
        await supabaseClient.from('payment_history').insert(finalPayment);
        
        await this.recordCashFlow({
            store_id: order.store_id,
            flow_type: 'principal',
            direction: 'inflow',
            amount: settlementAmount,
            source_target: paymentMethod,
            order_id: order.id,
            customer_id: order.customer_id,
            description: (Utils.lang === 'id' ? 'Pelunasan dipercepat' : '提前结清') + ' - ' + order.order_id,
            reference_id: order.order_id
        });
        
        const { error } = await supabaseClient
            .from('orders')
            .update({
                status: 'completed',
                principal_paid: order.loan_amount,
                principal_remaining: 0,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('order_id', orderId);
        
        if (error) throw error;
        
        // 审计：提前结清
        if (window.Audit) {
            await window.Audit.logPayment(order.order_id, 'early_settlement', settlementAmount, paymentMethod);
        }
        
        alert((Utils.lang === 'id' ? '✅ Pelunasan dipercepat berhasil!\nJumlah: ' : '✅ 提前结清成功！\n结清金额: ') + this.formatCurrency(settlementAmount));
        return true;
    },

    async updateOverdueDays() {
        const { data: activeOrders, error } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('status', 'active');
        
        if (error) throw error;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (var i = 0; i < activeOrders.length; i++) {
            var order = activeOrders[i];
            const dueDate = order.next_interest_due_date;
            if (!dueDate) continue;
            
            const due = new Date(dueDate);
            due.setHours(0, 0, 0, 0);
            
            let overdueDays = 0;
            if (today > due) {
                overdueDays = Math.floor((today - due) / (1000 * 60 * 60 * 24));
            }
            
            let liquidationStatus = order.liquidation_status || 'normal';
            if (overdueDays >= 30) {
                liquidationStatus = 'liquidated';
            } else if (overdueDays >= 15) {
                liquidationStatus = 'warning';
            } else {
                liquidationStatus = 'normal';
            }
            
            if (overdueDays !== order.overdue_days || liquidationStatus !== order.liquidation_status) {
                await supabaseClient
                    .from('orders')
                    .update({ overdue_days: overdueDays, liquidation_status: liquidationStatus })
                    .eq('id', order.id);
            }
        }
        
        return true;
    },

    async updateOrder(orderId, updateData, customerId) {
        const currentOrder = await this.getOrder(orderId);
        
        const sensitiveFields = [
            'customer_name', 'customer_ktp', 'customer_phone', 'customer_address',
            'collateral_name', 'loan_amount', 'admin_fee', 'service_fee_percent'
        ];
        
        var isUpdatingSensitive = false;
        for (var i = 0; i < sensitiveFields.length; i++) {
            if (updateData.hasOwnProperty(sensitiveFields[i])) {
                isUpdatingSensitive = true;
                break;
            }
        }
        
        if (currentOrder.is_locked && isUpdatingSensitive) {
            throw new Error(Utils.t('order_locked'));
        }
        
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
            throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat membuka kunci' : '需管理员权限');
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

    async deleteOrder(orderId) {
        const profile = await this.getCurrentProfile();
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat menghapus pesanan' : '需管理员权限');
        }
        const order = await this.getOrder(orderId);
        
        await supabaseClient.from('cash_flow_records').delete().eq('order_id', order.id);
        
        const { error: e1 } = await supabaseClient.from('payment_history').delete().eq('order_id', order.id);
        if (e1) throw e1;
        
        const { error: e2 } = await supabaseClient.from('orders').delete().eq('order_id', orderId);
        if (e2) throw e2;
        
        // 审计：删除订单
        if (window.Audit) {
            await window.Audit.logOrderDelete(order.order_id, order.customer_name, order.loan_amount, profile?.name);
        }
        
        return true;
    },

    async getReport() {
        const orders = await this.getOrders();
        var activeOrders = [];
        for (var i = 0; i < orders.length; i++) {
            if (orders[i].status === 'active') activeOrders.push(orders[i]);
        }
        var totalLoanAmount = 0;
        var totalAdminFees = 0;
        var totalServiceFees = 0;
        var totalInterest = 0;
        var totalPrincipal = 0;
        var expectedMonthlyInterest = 0;
        
        for (var i = 0; i < orders.length; i++) {
            var o = orders[i];
            totalLoanAmount += (o.loan_amount || 0);
            if (o.admin_fee_paid) totalAdminFees += (o.admin_fee || 0);
            totalServiceFees += (o.service_fee_paid || 0);
            totalInterest += (o.interest_paid_total || 0);
            totalPrincipal += (o.principal_paid || 0);
        }
        
        for (var i = 0; i < activeOrders.length; i++) {
            var o = activeOrders[i];
            expectedMonthlyInterest += ((o.loan_amount || 0) - (o.principal_paid || 0)) * (o.agreed_interest_rate || Utils.DEFAULT_AGREED_INTEREST_RATE);
        }
        
        return {
            total_orders: orders.length,
            active_orders: activeOrders.length,
            completed_orders: orders.length - activeOrders.length,
            total_loan_amount: totalLoanAmount,
            total_admin_fees: totalAdminFees,
            total_service_fees: totalServiceFees,
            total_interest: totalInterest,
            total_principal: totalPrincipal,
            expected_monthly_interest: expectedMonthlyInterest
        };
    },

    async getAllPayments() {
        const profile = await this.getCurrentProfile();
        
        let orderQuery = supabaseClient.from('orders').select('id, order_id, customer_name');
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            orderQuery = orderQuery.eq('store_id', profile.store_id);
        }
        
        const { data: accessibleOrders, error: orderError } = await orderQuery;
        
        if (orderError) {
            console.error("获取订单列表失败:", orderError);
            return [];
        }
        
        const accessibleOrderIds = accessibleOrders.map(function(o) { return o.id; });
        
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
        for (var i = 0; i < accessibleOrders.length; i++) {
            orderMap[accessibleOrders[i].id] = accessibleOrders[i];
        }
        
        const result = [];
        for (var i = 0; i < payments.length; i++) {
            result.push(Object.assign({}, payments[i], {
                orders: orderMap[payments[i].order_id] || null
            }));
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
            .from('stores').insert({ code: code, name: name, address: address, phone: phone }).select().single();
        if (error) throw error;
        
        // 审计：创建门店
        if (window.Audit) {
            await window.Audit.logStoreCreate(code, name, AUTH.user?.id);
        }
        
        return data;
    },

    async updateStore(id, updates) {
        const { data, error } = await supabaseClient
            .from('stores').update(updates).eq('id', id).select().single();
        if (error) throw error;
        
        // 审计：更新门店
        if (window.Audit) {
            await window.Audit.logStoreAction(id, 'update', JSON.stringify(updates));
        }
        
        return data;
    },

    async deleteStore(id) {
        const { data: orders, error: ordersError } = await supabaseClient
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', id);
        
        if (ordersError) throw ordersError;
        if (orders && orders.length > 0) {
            throw new Error(Utils.lang === 'id' ? 'Toko memiliki pesanan, tidak dapat dihapus' : '门店有订单，无法删除');
        }
        
        const { data: users, error: usersError } = await supabaseClient
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', id);
        
        if (usersError) throw usersError;
        if (users && users.length > 0) {
            throw new Error(Utils.lang === 'id' ? 'Toko memiliki pengguna, tidak dapat dihapus' : '门店有用户，无法删除');
        }
        
        const { error } = await supabaseClient.from('stores').delete().eq('id', id);
        if (error) throw error;
        
        // 审计：删除门店
        if (window.Audit) {
            await window.Audit.logStoreAction(id, 'delete', '');
        }
        
        return true;
    },

    async getCustomers(filters) {
        if (filters === undefined) filters = {};
        const profile = await this.getCurrentProfile();
        let query = supabaseClient.from('customers').select('*').order('registered_date', { ascending: false });
        
        if (profile?.role !== 'admin' && profile?.store_id) {
            query = query.eq('store_id', profile.store_id);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getCashFlowRecords(storeId, startDate, endDate) {
        const profile = await this.getCurrentProfile();
        const targetStoreId = storeId || profile?.store_id;
        
        if (!targetStoreId && profile?.role !== 'admin') {
            throw new Error('Unauthorized');
        }
        
        let query = supabaseClient
            .from('cash_flow_records')
            .select('*')
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

    async getAllStoreBalances() {
        const { data: allFlows, error } = await supabaseClient
            .from('cash_flow_records')
            .select('store_id, direction, amount, source_target')
            .eq('is_voided', false);
        
        if (error) {
            console.warn('批量获取门店现金流失败:', error);
            return {};
        }
        
        var balances = {};
        for (var i = 0; i < allFlows.length; i++) {
            var flow = allFlows[i];
            var storeId = flow.store_id;
            var amount = flow.amount || 0;
            
            if (!balances[storeId]) {
                balances[storeId] = { cashBalance: 0, bankBalance: 0 };
            }
            
            if (flow.direction === 'inflow') {
                if (flow.source_target === 'cash') {
                    balances[storeId].cashBalance += amount;
                } else if (flow.source_target === 'bank') {
                    balances[storeId].bankBalance += amount;
                }
            } else if (flow.direction === 'outflow') {
                if (flow.source_target === 'cash') {
                    balances[storeId].cashBalance -= amount;
                } else if (flow.source_target === 'bank') {
                    balances[storeId].bankBalance -= amount;
                }
            }
        }
        
        return balances;
    },

    async getAllOrdersSummary() {
        const { data, error } = await supabaseClient
            .from('orders')
            .select('id, store_id, status, loan_amount, admin_fee_paid, admin_fee, interest_paid_total, principal_paid, service_fee_paid');
        
        if (error) throw error;
        return data || [];
    },

    async getAllExpensesSummary() {
        const { data, error } = await supabaseClient
            .from('expenses')
            .select('id, store_id, amount, payment_method');
        
        if (error) throw error;
        return data || [];
    },

    async getAllPaymentsSummary() {
        const { data, error } = await supabaseClient
            .from('payment_history')
            .select('id, order_id, type, amount, payment_method');
        
        if (error) throw error;
        return data || [];
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
        
        for (var i = 0; i < (flows || []).length; i++) {
            var flow = flows[i];
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
        
        for (var i = 0; i < (flows || []).length; i++) {
            var flow = flows[i];
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
        for (var i = 0; i < (flows || []).length; i++) {
            var flow = flows[i];
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
            description: expenseData.category,
            reference_id: data.id
        });
        
        // 审计：运营支出
        if (window.Audit) {
            await window.Audit.log('expense_add', JSON.stringify({
                category: expenseData.category,
                amount: expenseData.amount,
                payment_method: expenseData.payment_method
            }));
        }
        
        return data;
    },

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
        for (var i = 0; i < (orders || []).length; i++) {
            var order = orders[i];
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

    async recordInternalTransfer(transferData) {
        const profile = await this.getCurrentProfile();
        
        if (transferData.amount <= 0) {
            throw new Error(Utils.t('invalid_amount'));
        }
        
        if (transferData.transfer_type === 'cash_to_bank') {
            const cashFlow = await this.getCashFlowSummary();
            if (cashFlow.cash.balance < transferData.amount) {
                throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            }
        } else if (transferData.transfer_type === 'bank_to_cash') {
            const cashFlow = await this.getCashFlowSummary();
            if (cashFlow.bank.balance < transferData.amount) {
                throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            }
        } else if (transferData.transfer_type === 'store_to_hq') {
            const shopAccount = await this.getShopAccount(transferData.store_id || profile?.store_id);
            if (shopAccount.bank_balance < transferData.amount) {
                throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
            }
        }
        
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
        
        await this.recordCashFlow({
            store_id: transferData.store_id || profile?.store_id,
            flow_type: 'internal_transfer_out',
            direction: 'outflow',
            amount: transferData.amount,
            source_target: transferData.from_account === 'hq' ? 'bank' : transferData.from_account,
            description: Utils.lang === 'id' ? 'Transfer keluar' : '转出',
            reference_id: data.id
        });
        
        if (transferData.to_account !== 'hq') {
            await this.recordCashFlow({
                store_id: transferData.store_id || profile?.store_id,
                flow_type: 'internal_transfer_in',
                direction: 'inflow',
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
        
        let query = supabaseClient
            .from('internal_transfers')
            .select('*, stores(name, code), created_by_profile:user_profiles!internal_transfers_created_by_fkey(name)')
            .order('transfer_date', { ascending: false });
        
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

    async getRemittableAmount(storeId) {
        const shopAccount = await this.getShopAccount(storeId);
        return shopAccount.bank_balance;
    },

    async remitToHeadquarters(storeId, amount, description) {
        const profile = await this.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya admin yang dapat menyetor ke pusat' : '需管理员权限');
        }
        
        const shopAccount = await this.getShopAccount(storeId);
        if (shopAccount.bank_balance < amount) {
            throw new Error(Utils.lang === 'id' ? 'Saldo tidak mencukupi' : '余额不足');
        }
        
        const transfer = await this.recordInternalTransfer({
            transfer_type: 'store_to_hq',
            from_account: 'bank',
            to_account: 'hq',
            amount: amount,
            description: description || (Utils.lang === 'id' ? 'Setoran ke kantor pusat' : '上缴总部'),
            store_id: storeId
        });
        
        return transfer;
    },

    formatCurrency(amount) {
        return Utils.formatCurrency(amount);
    },

    formatDate(dateStr) {
        return Utils.formatDate(dateStr);
    }
};

window.SUPABASE = SupabaseAPI;
window.supabaseClient = supabaseClient;
