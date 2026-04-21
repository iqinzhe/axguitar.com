// permission.js - v1.0

const PERMISSION = {

    // ==================== 内部：权限规则表（单一来源） ====================
    _rules: {
        admin: true, // admin 拥有所有权限
        'store_manager|staff': {
            order_create: true, order_view: true, order_payment: true,
            order_edit: false, order_delete: false,
            customer_manage: true, customer_create: true, customer_edit: true, customer_delete: false,
            expense_add: true, expense_edit: false, expense_delete: false,
            report_view: false,
            user_manage: false, user_create: false, user_edit: false, user_delete: false,
            store_manage: false, store_create: false, store_edit: false, store_delete: false,
            blacklist_add: true, blacklist_remove: false, blacklist_view: true,
            cash_flow_view: true, internal_transfer: true
        }
    },

    _checkByRole(role, action) {
        if (!role) return false;
        if (role === 'admin') return true;
        if (role === 'store_manager' || role === 'staff') {
            return this._rules['store_manager|staff'][action] ?? false;
        }
        return false;
    },

    // ==================== 同步版本（使用缓存） ====================
    can(action) {
        return this._checkByRole(AUTH.user?.role, action);
    },

    // ==================== 异步版本（从数据库获取最新角色，用于敏感操作） ====================
    async canAsync(action) {
        try {
            const profile = await SUPABASE.getCurrentProfile();
            return this._checkByRole(profile?.role, action);
        } catch (error) {
            console.error('权限检查失败:', error);
            return false;
        }
    },

    // ==================== 便捷函数 ====================
    canCreateOrder()        { return this.can('order_create'); },
    canViewOrder()          { return this.can('order_view'); },
    canPayOrder()           { return this.can('order_payment'); },
    canEditOrder()          { return false; },
    canDeleteOrder()        { return this.can('order_delete'); },
    canManageCustomer()     { return this.can('customer_manage'); },
    canCreateCustomer()     { return this.can('customer_create'); },
    canEditCustomer()       { return this.can('customer_edit'); },
    canDeleteCustomer()     { return this.can('customer_delete'); },
    canAddExpense()         { return this.can('expense_add'); },
    canEditExpense()        { return this.can('expense_edit'); },
    canDeleteExpense()      { return this.can('expense_delete'); },
    canViewReport()         { return this.can('report_view'); },
    canManageUsers()        { return this.can('user_manage'); },
    canCreateUser()         { return this.can('user_create'); },
    canEditUser()           { return this.can('user_edit'); },
    canDeleteUser()         { return this.can('user_delete'); },
    canManageStores()       { return this.can('store_manage'); },
    canCreateStore()        { return this.can('store_create'); },
    canEditStore()          { return this.can('store_edit'); },
    canDeleteStore()        { return this.can('store_delete'); },
    canAddToBlacklist()     { return this.can('blacklist_add'); },
    canRemoveFromBlacklist(){ return this.can('blacklist_remove'); },
    canViewBlacklist()      { return this.can('blacklist_view'); },
    canViewCashFlow()       { return this.can('cash_flow_view'); },
    canDoInternalTransfer() { return this.can('internal_transfer'); },
    canReconcile()          { return AUTH.user?.role === 'admin'; },

    // ==================== 角色判断 ====================
    isAdmin()        { return AUTH.user?.role === 'admin'; },
    isStoreManager() { return AUTH.user?.role === 'store_manager'; },
    isStaff()        { return AUTH.user?.role === 'staff'; },

    async isAdminAsync()        { return (await SUPABASE.getCurrentProfile())?.role === 'admin'; },
    async isStoreManagerAsync() { return (await SUPABASE.getCurrentProfile())?.role === 'store_manager'; },
    async isStaffAsync()        { return (await SUPABASE.getCurrentProfile())?.role === 'staff'; },

    // ==================== 当前用户信息 ====================
    getCurrentRole()    { return AUTH.user?.role || null; },
    getCurrentStoreId() { return AUTH.user?.store_id || null; },
    getCurrentStoreName() {
        return AUTH.user?.stores?.name || AUTH.user?.store_name ||
               (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
    },

    // ==================== 带订单状态的权限检查 ====================
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
    }
};

window.PERMISSION = PERMISSION;

