// permission.js - v2.0
// canAddExpenseAmount 增加异步版本，同步方法增加角色刷新提示

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const PERMISSION = {

        // ==================== 业务常量 ====================
        /** 员工单笔支出上限（超过此金额需店长确认） */
        STAFF_EXPENSE_MAX_AMOUNT: 5000000,

        // ==================== 权限规则表 ====================
        _rules: {
            admin: true,
            store_manager: {
                order_create: true,
                order_view: true,
                order_payment: true,
                order_edit: false,
                order_delete: false,
                customer_manage: true,
                customer_create: true,
                customer_edit: true,
                customer_delete: false,
                expense_add: true,
                expense_edit: false,
                expense_delete: false,
                report_view: true,
                cross_store_report_view: false,
                user_manage: false,
                user_create: false,
                user_edit: false,
                user_delete: false,
                store_manage: false,
                store_create: false,
                store_edit: false,
                store_delete: false,
                blacklist_add: true,
                blacklist_remove: false,
                blacklist_view: true,
                cash_flow_view: true,
                internal_transfer: true,
                backup_restore: false,
                profit_distribute: true,
                audit_view: false,
            },
            staff: {
                order_create: true,
                order_view: true,
                order_payment: true,
                order_edit: false,
                order_delete: false,
                customer_manage: true,
                customer_create: true,
                customer_edit: true,
                customer_delete: false,
                expense_add: true,
                expense_edit: false,
                expense_delete: false,
                report_view: false,
                cross_store_report_view: false,
                user_manage: false,
                user_create: false,
                user_edit: false,
                user_delete: false,
                store_manage: false,
                store_create: false,
                store_edit: false,
                store_delete: false,
                blacklist_add: true,
                blacklist_remove: false,
                blacklist_view: true,
                cash_flow_view: true,
                internal_transfer: false,
                backup_restore: false,
                profit_distribute: false,
                audit_view: false,
            },
        },

        _checkByRole(role, action) {
            if (!role) return false;
            if (role === 'admin') return true;
            if (role === 'store_manager') {
                return this._rules['store_manager'][action] ?? false;
            }
            if (role === 'staff') {
                return this._rules['staff'][action] ?? false;
            }
            return false;
        },

        can(action) {
            // 同步检查时增加控制台提示（仅开发环境）
            if (AUTH.user?.role === 'staff' && (action === 'expense_add' || action === 'internal_transfer')) {
                console.debug('[Permission] 同步权限检查:', action, '结果:', this._checkByRole(AUTH.user?.role, action));
            }
            return this._checkByRole(AUTH.user?.role, action);
        },

        async canAsync(action) {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                return this._checkByRole(profile?.role, action);
            } catch (error) {
                console.error('权限检查失败:', error);
                return false;
            }
        },

        // ==================== 门店访问权限检查 ====================
        async checkStoreAccess(storeId) {
            if (this.isAdmin()) return true;

            try {
                const profile = await SUPABASE.getCurrentProfile();
                const userStoreId = profile?.store_id || null;
                if (!userStoreId) return false;
                return storeId === userStoreId;
            } catch (error) {
                console.warn('checkStoreAccess 异常:', error);
                return false;
            }
        },

        async requireStoreAccess(storeId, customMessage) {
            const hasAccess = await this.checkStoreAccess(storeId);
            if (!hasAccess) {
                const msg = customMessage || (
                    Utils.lang === 'id'
                        ? 'Anda tidak memiliki akses ke toko ini'
                        : '您没有访问该门店的权限'
                );
                throw new Error(msg);
            }
        },

        // ====================  支出金额阈值检查（同步版本，带警告） ====================
        canAddExpenseAmount(amount) {
            if (this.isAdmin() || this.isStoreManager()) return true;
            if (this.isStaff()) {
                if (amount > this.STAFF_EXPENSE_MAX_AMOUNT) {
                    console.warn(`[Permission] 员工支出金额 ${Utils.formatCurrency(amount)} 超过限额 ${Utils.formatCurrency(this.STAFF_EXPENSE_MAX_AMOUNT)}`);
                    return false;
                }
                return true;
            }
            return true;
        },

        /**
         * 异步版本支出金额检查（从数据库获取最新角色）
         * @param {number} amount - 支出金额
         * @returns {Promise<boolean>} true: 未超限或用户非员工；false: 超过上限
         */
        async canAddExpenseAmountAsync(amount) {
            const profile = await SUPABASE.getCurrentProfile();
            const role = profile?.role;
            
            if (role === 'admin' || role === 'store_manager') return true;
            if (role === 'staff') {
                if (amount > this.STAFF_EXPENSE_MAX_AMOUNT) {
                    console.warn(`[Permission] 员工支出金额 ${Utils.formatCurrency(amount)} 超过限额 ${Utils.formatCurrency(this.STAFF_EXPENSE_MAX_AMOUNT)}`);
                    return false;
                }
                return true;
            }
            return true;
        },

        getStaffExpenseMaxAmount() {
            return this.STAFF_EXPENSE_MAX_AMOUNT;
        },

        // ==================== 订单相关便捷方法 ====================
        canCreateOrder()     { return this.can('order_create'); },
        canViewOrder()       { return this.can('order_view'); },
        canPayOrder()        { return this.can('order_payment'); },
        canEditOrder()       { return false; },
        canDeleteOrder()     { return this.can('order_delete'); },

        // ==================== 客户相关 ====================
        canManageCustomer()  { return this.can('customer_manage'); },
        canCreateCustomer()  { return this.can('customer_create'); },
        canEditCustomer()    { return this.can('customer_edit'); },
        canDeleteCustomer()  { return this.can('customer_delete'); },

        // ==================== 支出相关 ====================
        canAddExpense()      { return this.can('expense_add'); },
        canEditExpense()     { return this.can('expense_edit'); },
        canDeleteExpense()   { return this.can('expense_delete'); },

        // ==================== 报表 ====================
        canViewReport()              { return this.can('report_view'); },
        canViewCrossStoreReport()    { return this.isAdmin(); },

        // ==================== 用户管理 ====================
        canManageUsers()     { return this.can('user_manage'); },
        canCreateUser()      { return this.can('user_create'); },
        canEditUser()        { return this.can('user_edit'); },
        canDeleteUser()      { return this.can('user_delete'); },

        // ==================== 门店管理 ====================
        canManageStores()    { return this.can('store_manage'); },
        canCreateStore()     { return this.can('store_create'); },
        canEditStore()       { return this.can('store_edit'); },
        canDeleteStore()     { return this.can('store_delete'); },

        // ==================== 黑名单 ====================
        canAddToBlacklist()     { return this.can('blacklist_add'); },
        canRemoveFromBlacklist(){ return this.can('blacklist_remove'); },
        canViewBlacklist()      { return this.can('blacklist_view'); },

        // ==================== 资金流水 ====================
        canViewCashFlow()        { return this.can('cash_flow_view'); },
        canDoInternalTransfer()  { return this.can('internal_transfer'); },

        // ==================== 审计日志 ====================
        canViewAuditLog()        { return this.can('audit_view'); },

        // ==================== 备份恢复 ====================
        canBackup()              { return this.can('backup_restore'); },
        canRestore()             { return this.can('backup_restore'); },

        // ==================== 平账 ====================
        canReconcile()           { return AUTH.user?.role === 'admin'; },

        // ==================== 收益处置 ====================
        canDistributeProfit()    { return this.isAdmin() || this.can('profit_distribute'); },

        // ==================== 角色判断 ====================
        isAdmin()            { return AUTH.user?.role === 'admin'; },
        isStoreManager()     { return AUTH.user?.role === 'store_manager'; },
        isStaff()            { return AUTH.user?.role === 'staff'; },

        async isAdminAsync()        { return (await SUPABASE.getCurrentProfile())?.role === 'admin'; },
        async isStoreManagerAsync() { return (await SUPABASE.getCurrentProfile())?.role === 'store_manager'; },
        async isStaffAsync()        { return (await SUPABASE.getCurrentProfile())?.role === 'staff'; },

        // ==================== 当前用户信息 ====================
        getCurrentRole()     { return AUTH.user?.role || null; },
        getCurrentStoreId()  { return AUTH.user?.store_id || null; },
        getCurrentStoreName() {
            return AUTH.user?.stores?.name || AUTH.user?.store_name ||
                   (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
        },

        // ==================== 含订单状态的权限检查 ====================
        canViewOrderDetails(order) {
            if (!order) return false;
            if (this.isAdmin()) return true;
            return order.store_id === this.getCurrentStoreId();
        },

        canPayOrderDetails(order) {
            if (!order || this.isAdmin() || order.status !== 'active') return false;
            return order.store_id === this.getCurrentStoreId();
        },

        canEditOrderDetails(order) {
            return !!order && this.isAdmin();
        },

        canDeleteOrderDetails(order) {
            return !!order && this.isAdmin();
        },

        // ==================== 门店操作权限 ====================
        canOperateStore(storeId) {
            if (this.isAdmin()) return true;
            return storeId === this.getCurrentStoreId();
        },

        // ==================== 客户操作权限 ====================
        canOperateCustomer(customer) {
            if (this.isAdmin()) return true;
            if (!customer) return false;
            return customer.store_id === this.getCurrentStoreId();
        },
    };

    // 挂载到命名空间
    JF.Permission = PERMISSION;
    window.PERMISSION = PERMISSION;

    console.log('✅ JF.Permission v2.6 修复版（canAddExpenseAmount 增加异步版本 + 同步警告）');
})();
