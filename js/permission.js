// permission.js - v2.0 统一权限模块 (JF 命名空间)

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const PERMISSION = {

        // ==================== 权限规则表（单一来源） ====================
        _rules: {
            admin: true,
            'store_manager|staff': {
                // 订单
                order_create: true,
                order_view: true,
                order_payment: true,
                order_edit: false,
                order_delete: false,
                // 客户
                customer_manage: true,
                customer_create: true,
                customer_edit: true,
                customer_delete: false,
                // 支出
                expense_add: true,
                expense_edit: false,
                expense_delete: false,
                // 报表
                report_view: false,
                // 用户管理（仅管理员）
                user_manage: false,
                user_create: false,
                user_edit: false,
                user_delete: false,
                // 门店管理（仅管理员）
                store_manage: false,
                store_create: false,
                store_edit: false,
                store_delete: false,
                // 黑名单
                blacklist_add: true,
                blacklist_remove: false,
                blacklist_view: true,
                // 资金流水
                cash_flow_view: true,
                internal_transfer: true,
                // 备份恢复（仅管理员）
                backup_restore: false,
            },
        },

        /**
         * 根据角色同步检查权限
         * @param {string} role
         * @param {string} action
         * @returns {boolean}
         */
        _checkByRole(role, action) {
            if (!role) return false;
            if (role === 'admin') return true;
            if (role === 'store_manager' || role === 'staff') {
                return this._rules['store_manager|staff'][action] ?? false;
            }
            return false;
        },

        /**
         * 同步权限检查（使用缓存角色）
         */
        can(action) {
            return this._checkByRole(AUTH.user?.role, action);
        },

        /**
         * 异步权限检查（从数据库获取最新角色）
         */
        async canAsync(action) {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                return this._checkByRole(profile?.role, action);
            } catch (error) {
                console.error('权限检查失败:', error);
                return false;
            }
        },

        // ==================== 订单相关便捷方法 ====================
        canCreateOrder()     { return this.can('order_create'); },
        canViewOrder()       { return this.can('order_view'); },
        canPayOrder()        { return this.can('order_payment'); },
        canEditOrder()       { return false; },  // 订单保存后不可编辑
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
        canViewReport()      { return this.can('report_view'); },

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
        canAddToBlacklist()  { return this.can('blacklist_add'); },
        canRemoveFromBlacklist() { return this.can('blacklist_remove'); },
        canViewBlacklist()   { return this.can('blacklist_view'); },

        // ==================== 资金流水 ====================
        canViewCashFlow()    { return this.can('cash_flow_view'); },
        canDoInternalTransfer() { return this.can('internal_transfer'); },

        // ==================== 备份恢复 ====================
        canBackup()          { return this.can('backup_restore'); },
        canRestore()         { return this.can('backup_restore'); },

        // ==================== 平账 ====================
        canReconcile()       { return AUTH.user?.role === 'admin'; },

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
    window.PERMISSION = PERMISSION; // 向下兼容

    console.log('✅ JF.Permission v2.0 初始化完成');
})();
