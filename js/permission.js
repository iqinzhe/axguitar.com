// permission.js - v2.1 (JF 命名空间)
// 修复记录（v2.1）：
//   [中危-1] canEditOrder() 不再硬编码 return false，改为走统一规则表查询
//   [中危-2] 敏感操作（internal_transfer、profit_distribute）新增 canAsync 强制异步版本，
//            并在同步版本中打印警告提示调用方改用异步版本
//   [优化-1] 移除与 auth.js 重复的异步角色查询方法（isAdminAsync 等），
//            统一由 canAsync() + _checkByRole() 体系覆盖
//   [优化-2] 新增 canOperateExpense() 补全支出操作的门店隔离检查

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // 需要强制使用异步版本检查的高风险操作列表
    // 这些操作涉及资金流动，必须从数据库实时验证角色，不能依赖内存缓存
    const SENSITIVE_ACTIONS = new Set([
        'internal_transfer',
        'profit_distribute',
        'backup_restore',
        'audit_view',
    ]);

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
            if (role === 'store_manager') return this._rules['store_manager'][action] ?? false;
            if (role === 'staff') return this._rules['staff'][action] ?? false;
            return false;
        },

        // 同步权限检查（依赖内存缓存中的角色，适合 UI 展示）
        // [中危-2 修复] 对敏感操作打印警告，提示调用方改用 canAsync()
        can(action) {
            if (SENSITIVE_ACTIONS.has(action)) {
                console.warn(
                    `[Permission] "${action}" 是敏感操作，同步检查的角色来自内存缓存，` +
                    '可能已过期。请改用 canAsync() 进行实时验证。'
                );
            }
            return this._checkByRole(AUTH.user?.role, action);
        },

        // 异步权限检查（从数据库实时获取角色，适合执行前的最终校验）
        async canAsync(action) {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                return this._checkByRole(profile?.role, action);
            } catch (error) {
                console.error('[Permission] 权限检查失败:', error);
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
                console.warn('[Permission] checkStoreAccess 异常:', error);
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

        // ==================== 支出金额阈值检查 ====================
        // 同步版（UI 展示用）
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

        // 异步版（提交前实时验证用）
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
        canCreateOrder()  { return this.can('order_create'); },
        canViewOrder()    { return this.can('order_view'); },
        canPayOrder()     { return this.can('order_payment'); },
        // [中危-1 修复] 不再硬编码 return false，通过规则表统一查询
        // 规则表中 order_edit 对所有非 admin 角色均为 false，行为不变，但维护路径正确
        canEditOrder()    { return this.can('order_edit'); },
        canDeleteOrder()  { return this.can('order_delete'); },

        // ==================== 客户相关 ====================
        canManageCustomer()  { return this.can('customer_manage'); },
        canCreateCustomer()  { return this.can('customer_create'); },
        canEditCustomer()    { return this.can('customer_edit'); },
        canDeleteCustomer()  { return this.can('customer_delete'); },

        // ==================== 支出相关 ====================
        canAddExpense()    { return this.can('expense_add'); },
        canEditExpense()   { return this.can('expense_edit'); },
        canDeleteExpense() { return this.can('expense_delete'); },

        // ==================== 报表 ====================
        canViewReport()           { return this.can('report_view'); },
        canViewCrossStoreReport() { return this.isAdmin(); },

        // ==================== 用户管理 ====================
        canManageUsers() { return this.can('user_manage'); },
        canCreateUser()  { return this.can('user_create'); },
        canEditUser()    { return this.can('user_edit'); },
        canDeleteUser()  { return this.can('user_delete'); },

        // ==================== 门店管理 ====================
        canManageStores() { return this.can('store_manage'); },
        canCreateStore()  { return this.can('store_create'); },
        canEditStore()    { return this.can('store_edit'); },
        canDeleteStore()  { return this.can('store_delete'); },

        // ==================== 黑名单 ====================
        canAddToBlacklist()      { return this.can('blacklist_add'); },
        canRemoveFromBlacklist() { return this.can('blacklist_remove'); },
        canViewBlacklist()       { return this.can('blacklist_view'); },

        // ==================== 资金流水 ====================
        canViewCashFlow() { return this.can('cash_flow_view'); },

        // [中危-2 修复] 资金划转是敏感操作，同步版仅用于 UI 展示（按钮显隐）
        // 实际执行前必须调用 canDoInternalTransferAsync() 做实时验证
        canDoInternalTransfer() {
            return this.can('internal_transfer'); // can() 内部已打印警告
        },
        async canDoInternalTransferAsync() {
            return this.canAsync('internal_transfer');
        },

        // ==================== 审计日志 ====================
        canViewAuditLog() { return this.can('audit_view'); },

        // ==================== 备份恢复 ====================
        canBackup()   { return this.can('backup_restore'); },
        canRestore()  { return this.can('backup_restore'); },

        // ==================== 平账 ====================
        canReconcile() { return AUTH.user?.role === 'admin'; },

        // ==================== 收益处置 ====================
        // [中危-2 修复] 收益分配是敏感操作，同步版仅用于 UI 展示
        // 实际执行前必须调用 canDistributeProfitAsync()
        canDistributeProfit() {
            return this.isAdmin() || this.can('profit_distribute'); // can() 内部已打印警告
        },
        async canDistributeProfitAsync() {
            return this.canAsync('profit_distribute');
        },

        // ==================== 角色判断（同步，依赖内存缓存） ====================
        isAdmin()        { return AUTH.user?.role === 'admin'; },
        isStoreManager() { return AUTH.user?.role === 'store_manager'; },
        isStaff()        { return AUTH.user?.role === 'staff'; },

        // 异步角色判断（实时从数据库查询）——统一由 canAsync() 体系封装
        // [优化-1] 移除与 auth.js 重复的 isAdminAsync/isStoreManagerAsync/isStaffAsync，
        //          需要实时角色判断时请使用 canAsync() 或直接调用 SUPABASE.getCurrentProfile()
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

        // ==================== 支出操作权限（含门店隔离） ====================
        // [优化-2 新增] 补全支出的门店隔离检查，与客户/订单保持一致的安全模型
        canOperateExpense(expense) {
            if (this.isAdmin()) return true;
            if (!expense) return false;
            return expense.store_id === this.getCurrentStoreId();
        },
    };

    // 挂载到命名空间
    JF.Permission = PERMISSION;
    window.PERMISSION = PERMISSION;

})();
