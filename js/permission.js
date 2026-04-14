// FIX #3: 完整权限系统 - 正确区分 admin / store_manager / staff 三个角色
const PERMISSION = {
    can(action) {
        if (!AUTH.user) return false;
        const role = AUTH.user.role;
        const rules = {
            admin: [
                "order_create", "order_view", "order_delete", "order_edit",
                "order_payment", "order_unlock", "order_liquidate",
                "user_manage", "store_manage", "report_view",
                "backup_restore", "expense_edit", "expense_delete",
                "customer_delete", "expense_reconcile"
            ],
            store_manager: [
                "order_create", "order_view", "order_payment",
                "order_edit_unlocked", "expense_add",
                "customer_manage", "report_view"
            ],
            staff: [
                "order_create", "order_view", "order_payment",
                "expense_add", "customer_manage"
            ]
        };
        return rules[role]?.includes(action) || false;
    },

    // 便捷方法
    canDeleteOrder()    { return this.can("order_delete"); },
    canEditOrder(order) {
        if (!AUTH.user) return false;
        if (AUTH.user.role === 'admin') return true;
        // store_manager / staff 只能编辑未锁定的订单
        return !order.is_locked && (AUTH.user.role === 'store_manager' || AUTH.user.role === 'staff');
    },
    canManageUsers()    { return this.can("user_manage"); },
    canManageStores()   { return this.can("store_manage"); },
    canViewReport()     { return this.can("report_view"); },
    canUnlockOrder()    { return this.can("order_unlock"); },
    canReconcile()      { return this.can("expense_reconcile"); },
    canDeleteCustomer() { return this.can("customer_delete"); },
    canDeleteExpense()  { return this.can("expense_delete"); },
    canEditExpense()    { return this.can("expense_edit"); },
    isAdmin()           { return AUTH.user?.role === 'admin'; },
    isStoreManager()    { return AUTH.user?.role === 'store_manager'; },
    isStaff()           { return AUTH.user?.role === 'staff'; }
};

window.PERMISSION = PERMISSION;
