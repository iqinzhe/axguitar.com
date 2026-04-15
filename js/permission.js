// permission.js - 权限系统 v2.0
// 角色定义：
// - admin: 全部权限
// - store_manager: 店长权限（审核订单、锁单）
// - staff: 员工权限（录入、修改、保存）

const PERMISSION = {
    can(action, order = null) {
        if (!AUTH.user) return false;
        const role = AUTH.user.role;
        
        if (role === 'admin') return true;
        
        if (role === 'store_manager') {
            switch (action) {
                case 'order_create': return true;
                case 'order_view': return true;
                case 'order_payment': return true;
                case 'order_edit': return order && !order.is_locked;
                case 'order_lock': return order && !order.is_locked;
                case 'order_unlock': return false;
                case 'order_delete': return false;
                case 'customer_manage': return true;
                case 'expense_add': return true;
                case 'expense_edit': return false;
                case 'expense_delete': return false;
                case 'report_view': return true;
                case 'user_manage': return false;
                case 'store_manage': return false;
                default: return false;
            }
        }
        
        if (role === 'staff') {
            switch (action) {
                case 'order_create': return true;
                case 'order_view': return true;
                case 'order_payment': return true;
                case 'order_edit': return order && !order.is_locked;
                case 'order_lock': return false;
                case 'order_unlock': return false;
                case 'order_delete': return false;
                case 'customer_manage': return true;
                case 'expense_add': return true;
                case 'expense_edit': return false;
                case 'expense_delete': return false;
                case 'report_view': return false;
                case 'user_manage': return false;
                case 'store_manage': return false;
                default: return false;
            }
        }
        
        return false;
    },

    canDeleteOrder() { return this.can('order_delete'); },
    
    canEditOrder(order) {
        if (!order) return false;
        return this.can('order_edit', order);
    },
    
    canLockOrder(order) {
        if (!order) return false;
        return this.can('order_lock', order);
    },
    
    canUnlockOrder() { 
        return AUTH.user?.role === 'admin'; 
    },
    
    canManageUsers() { return this.can('user_manage'); },
    canManageStores() { return this.can('store_manage'); },
    canViewReport() { return this.can('report_view'); },
    canReconcile() { return AUTH.user?.role === 'admin'; },
    canDeleteCustomer() { return AUTH.user?.role === 'admin'; },
    canDeleteExpense() { return AUTH.user?.role === 'admin'; },
    canEditExpense() { return AUTH.user?.role === 'admin'; },
    
    isAdmin() { return AUTH.user?.role === 'admin'; },
    isStoreManager() { return AUTH.user?.role === 'store_manager'; },
    isStaff() { return AUTH.user?.role === 'staff'; }
};

window.PERMISSION = PERMISSION;
