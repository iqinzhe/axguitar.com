// permission.js - v2.3 统一权限模块 (JF 命名空间)
// v2.1 新增：checkStoreAccess / requireStoreAccess 通用门店权限检查
// v2.2 新增：store_manager 与 staff 权限规则拆分；store_manager 可处置本店收益
// v2.3 修复：禁止员工发起内部转账（internal_transfer 仅限 store_manager 及以上）

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const PERMISSION = {

        // ==================== 权限规则表（单一来源） ====================
        _rules: {
            admin: true,
            // store_manager：分店经理，可处置本店收益
            store_manager: {
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
                // 收益处置：分店经理可处置本店收益
                profit_distribute: true,
                // 审计日志查看（仅管理员）
                audit_view: false,
            },
            // staff：普通员工，不可处置收益，不可发起内部转账
            staff: {
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
                // 【v2.3 修复】禁止员工发起内部转账，资金调拨需店长及以上权限
                internal_transfer: false,
                // 备份恢复（仅管理员）
                backup_restore: false,
                // 收益处置：员工不可操作
                profit_distribute: false,
                // 审计日志查看（仅管理员）
                audit_view: false,
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
            if (role === 'store_manager') {
                return this._rules['store_manager'][action] ?? false;
            }
            if (role === 'staff') {
                return this._rules['staff'][action] ?? false;
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

        // ==================== 门店访问权限检查 ====================
        /**
         * 异步检查当前登录用户是否有权访问指定门店
         * @param {string|null} storeId - 要访问的门店ID，null 表示无门店（如总部）
         * @returns {Promise<boolean>} true: 有权限；false: 无权限
         */
        async checkStoreAccess(storeId) {
            // 管理员总有权限
            if (this.isAdmin()) return true;

            // 非管理员：必须有自己的 storeId，且与目标 storeId 一致
            try {
                const profile = await SUPABASE.getCurrentProfile();
                const userStoreId = profile?.store_id || null;
                // 如果用户没有门店，无法访问任何门店数据
                if (!userStoreId) return false;
                // 要求目标门店ID与用户门店ID相同
                return storeId === userStoreId;
            } catch (error) {
                console.warn('checkStoreAccess 异常:', error);
                return false;
            }
        },

        /**
         * 异步检查门店访问权限，若权限不足则抛出错误
         * @param {string|null} storeId
         * @param {string} [customMessage] - 可选自定义错误信息
         * @returns {Promise<void>}
         */
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

        // ==================== 审计日志 ====================
        canViewAuditLog()    { return this.can('audit_view'); },

        // ==================== 备份恢复 ====================
        canBackup()          { return this.can('backup_restore'); },
        canRestore()         { return this.can('backup_restore'); },

        // ==================== 平账 ====================
        canReconcile()       { return AUTH.user?.role === 'admin'; },

        // ==================== 收益处置 ====================
        // admin 始终可操作；store_manager 可处置本店收益；staff 不可操作
        canDistributeProfit() { return this.isAdmin() || this.can('profit_distribute'); },

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

    console.log('✅ JF.Permission v2.3 初始化完成（禁止员工发起内部转账，预留审计日志权限项）');
})();
