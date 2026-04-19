// permission.js - 完整修复版 v2.0
// 修复内容：
// 1. 员工和店长只能创建订单，不能修改已保存的订单
// 2. 取消锁定/解锁功能（admin 也不能锁定/解锁，订单创建即锁定）
// 3. 权限检查统一使用异步方法获取最新角色
// 4. 删除冗余的权限函数

const PERMISSION = {
    
    // ==================== 核心权限判断（同步版本，使用缓存） ====================
    can(action, order = null) {
        if (!AUTH.user) return false;
        const role = AUTH.user.role;
        
        // 管理员拥有所有权限
        if (role === 'admin') return true;
        
        // 店长和员工权限相同
        if (role === 'store_manager' || role === 'staff') {
            switch (action) {
                // 订单相关
                case 'order_create': return true;      // 可以创建订单
                case 'order_view': return true;        // 可以查看订单
                case 'order_payment': return true;     // 可以缴费
                case 'order_edit': return false;       // 不能修改任何已保存的订单
                case 'order_delete': return false;     // 不能删除订单
                
                // 客户管理
                case 'customer_manage': return true;   // 可以管理客户
                case 'customer_create': return true;   // 可以创建客户
                case 'customer_edit': return true;     // 可以编辑客户信息
                case 'customer_delete': return false;  // 不能删除客户
                
                // 支出管理
                case 'expense_add': return true;       // 可以添加支出
                case 'expense_edit': return false;     // 不能修改支出
                case 'expense_delete': return false;   // 不能删除支出
                
                // 报表相关
                case 'report_view': return false;      // 员工不能看财务报表
                
                // 用户管理
                case 'user_manage': return false;      // 不能管理用户
                case 'user_create': return false;
                case 'user_edit': return false;
                case 'user_delete': return false;
                
                // 门店管理
                case 'store_manage': return false;     // 不能管理门店
                case 'store_create': return false;
                case 'store_edit': return false;
                case 'store_delete': return false;
                
                // 黑名单管理
                case 'blacklist_add': return true;     // 可以添加黑名单
                case 'blacklist_remove': return false; // 不能移除黑名单（仅admin）
                case 'blacklist_view': return true;    // 可以查看黑名单
                
                // 资金管理
                case 'cash_flow_view': return true;    // 可以查看资金流水
                case 'internal_transfer': return true; // 可以进行内部转账
                
                default: return false;
            }
        }
        
        return false;
    },
    
    // ==================== 异步版本（从数据库获取最新角色，用于敏感操作） ====================
    async canAsync(action, order = null) {
        try {
            const profile = await SUPABASE.getCurrentProfile();
            if (!profile) return false;
            
            const role = profile.role;
            
            if (role === 'admin') return true;
            
            if (role === 'store_manager' || role === 'staff') {
                switch (action) {
                    case 'order_create': return true;
                    case 'order_view': return true;
                    case 'order_payment': return true;
                    case 'order_edit': return false;
                    case 'order_delete': return false;
                    case 'customer_manage': return true;
                    case 'customer_create': return true;
                    case 'customer_edit': return true;
                    case 'customer_delete': return false;
                    case 'expense_add': return true;
                    case 'expense_edit': return false;
                    case 'expense_delete': return false;
                    case 'report_view': return false;
                    case 'user_manage': return false;
                    case 'store_manage': return false;
                    case 'blacklist_add': return true;
                    case 'blacklist_remove': return false;
                    case 'blacklist_view': return true;
                    case 'cash_flow_view': return true;
                    case 'internal_transfer': return true;
                    default: return false;
                }
            }
            
            return false;
        } catch (error) {
            console.error("权限检查失败:", error);
            return false;
        }
    },
    
    // ==================== 便捷函数（同步版本） ====================
    
    // 订单权限
    canCreateOrder() { return this.can('order_create'); },
    canViewOrder() { return this.can('order_view'); },
    canPayOrder() { return this.can('order_payment'); },
    canEditOrder() { return false; },  // 所有人（除admin外）都不能编辑
    canDeleteOrder() { return this.can('order_delete'); },
    
    // 注意：锁定/解锁功能已取消
    // canLockOrder() 和 canUnlockOrder() 已移除
    
    // 客户权限
    canManageCustomer() { return this.can('customer_manage'); },
    canCreateCustomer() { return this.can('customer_create'); },
    canEditCustomer() { return this.can('customer_edit'); },
    canDeleteCustomer() { return this.can('customer_delete'); },
    
    // 支出权限
    canAddExpense() { return this.can('expense_add'); },
    canEditExpense() { return this.can('expense_edit'); },
    canDeleteExpense() { return this.can('expense_delete'); },
    
    // 报表权限
    canViewReport() { return this.can('report_view'); },
    
    // 用户管理权限
    canManageUsers() { return this.can('user_manage'); },
    canCreateUser() { return this.can('user_create'); },
    canEditUser() { return this.can('user_edit'); },
    canDeleteUser() { return this.can('user_delete'); },
    
    // 门店管理权限
    canManageStores() { return this.can('store_manage'); },
    canCreateStore() { return this.can('store_create'); },
    canEditStore() { return this.can('store_edit'); },
    canDeleteStore() { return this.can('store_delete'); },
    
    // 黑名单权限
    canAddToBlacklist() { return this.can('blacklist_add'); },
    canRemoveFromBlacklist() { return this.can('blacklist_remove'); },
    canViewBlacklist() { return this.can('blacklist_view'); },
    
    // 资金管理权限
    canViewCashFlow() { return this.can('cash_flow_view'); },
    canDoInternalTransfer() { return this.can('internal_transfer'); },
    
    // 平账权限（仅管理员）
    canReconcile() { return AUTH.user?.role === 'admin'; },
    
    // ==================== 角色判断 ====================
    
    isAdmin() { return AUTH.user?.role === 'admin'; },
    isStoreManager() { return AUTH.user?.role === 'store_manager'; },
    isStaff() { return AUTH.user?.role === 'staff'; },
    
    // 异步版本角色判断
    async isAdminAsync() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role === 'admin';
    },
    
    async isStoreManagerAsync() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role === 'store_manager';
    },
    
    async isStaffAsync() {
        const profile = await SUPABASE.getCurrentProfile();
        return profile?.role === 'staff';
    },
    
    // ==================== 获取当前用户信息 ====================
    
    getCurrentRole() {
        return AUTH.user?.role || null;
    },
    
    getCurrentStoreId() {
        return AUTH.user?.store_id || null;
    },
    
    getCurrentStoreName() {
        return AUTH.user?.stores?.name || AUTH.user?.store_name || 
               (Utils.lang === 'id' ? 'Tidak diketahui' : '未知门店');
    },
    
    // ==================== 订单操作权限（带订单状态检查） ====================
    
    // 检查是否可以查看订单（门店隔离）
    canViewOrderDetails(order) {
        if (!order) return false;
        if (this.isAdmin()) return true;
        
        const userStoreId = this.getCurrentStoreId();
        return order.store_id === userStoreId;
    },
    
    // 检查是否可以支付订单
    canPayOrderDetails(order) {
        if (!order) return false;
        if (this.isAdmin()) return false;  // 管理员不能缴费
        if (order.status !== 'active') return false;
        
        const userStoreId = this.getCurrentStoreId();
        return order.store_id === userStoreId;
    },
    
    // 检查是否可以编辑订单（始终返回 false，除 admin 外）
    canEditOrderDetails(order) {
        if (!order) return false;
        if (this.isAdmin()) return true;
        return false;  // 非管理员不能编辑
    },
    
    // 检查是否可以删除订单
    canDeleteOrderDetails(order) {
        if (!order) return false;
        if (this.isAdmin()) return true;
        return false;
    }
};

// 挂载到全局
window.PERMISSION = PERMISSION;

// 控制台输出确认
console.log('✅ permission.js v2.0 已加载 - 权限系统已更新（员工/店长不能修改订单，锁定功能已移除）');
