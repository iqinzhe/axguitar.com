// audit.js - v2.0（审计日志已启用）

window.Audit = {
    
    /**
     * 核心写入方法：所有日志统一入口
     * @param {string} action - 操作类型标识
     * @param {string|object} details - 操作详情
     */
    async log(action, details) {
        try {
            const user = AUTH.user;
            await supabaseClient.from('audit_logs').insert({
                action: action,
                details: typeof details === 'string' ? details : JSON.stringify(details),
                user_id: user?.id || null,
                user_name: user?.name || 'System',
                created_at: new Date().toISOString()
            });
        } catch (error) {
            // 审计日志写入失败不阻塞主流程
            console.error('审计日志写入失败:', action, error.message);
        }
    },

    // ==================== 登录相关 ====================

    async logLoginSuccess(userId, userName) {
        await this.log('login_success', JSON.stringify({
            user_id: userId,
            user_name: userName,
            login_at: new Date().toISOString()
        }));
    },

    async logLoginFailure(username, reason) {
        await this.log('login_failure', JSON.stringify({
            attempted_username: username,
            reason: reason,
            attempted_at: new Date().toISOString()
        }));
    },

    async logLogout(userId, userName) {
        await this.log('logout', JSON.stringify({
            user_id: userId,
            user_name: userName,
            logout_at: new Date().toISOString()
        }));
    },

    // ==================== 订单相关 ====================

    async logOrderCreate(orderId, customerName, loanAmount) {
        await this.log('order_create', JSON.stringify({
            order_id: orderId,
            customer_name: customerName,
            loan_amount: loanAmount,
            created_at: new Date().toISOString()
        }));
    },

    async logOrderDelete(orderId, customerName, loanAmount, deletedBy) {
        await this.log('order_delete', JSON.stringify({
            order_id: orderId,
            customer_name: customerName,
            loan_amount: loanAmount,
            deleted_by: deletedBy,
            deleted_at: new Date().toISOString()
        }));
    },

    async logOrderAction(orderId, action, details) {
        await this.log('order_' + action, JSON.stringify({
            order_id: orderId,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        }));
    },

    // ==================== 缴费相关 ====================

    async logPayment(orderId, type, amount, method) {
        await this.log('payment', JSON.stringify({
            order_id: orderId,
            type: type,
            amount: amount,
            method: method,
            paid_at: new Date().toISOString()
        }));
    },

    // ==================== 用户管理相关 ====================

    async logUserCreate(newUserId, username, name, role, storeId, createdBy) {
        await this.log('user_create', JSON.stringify({
            new_user_id: newUserId,
            username: username,
            name: name,
            role: role,
            store_id: storeId,
            created_by: createdBy,
            created_at: new Date().toISOString()
        }));
    },

    async logUserDelete(userId, userName, role, deletedBy) {
        await this.log('user_delete', JSON.stringify({
            deleted_user_id: userId,
            deleted_user_name: userName,
            role: role,
            deleted_by: deletedBy,
            deleted_at: new Date().toISOString()
        }));
    },

    async logUserUpdate(userId, before, after, updatedBy) {
        await this.log('user_update', JSON.stringify({
            user_id: userId,
            before: before,
            after: after,
            updated_by: updatedBy,
            updated_at: new Date().toISOString()
        }));
    },

    async logPasswordReset(targetUserId, resetBy) {
        await this.log('password_reset', JSON.stringify({
            target_user_id: targetUserId,
            reset_by: resetBy,
            reset_at: new Date().toISOString()
        }));
    },

    async logUserAction(userId, action, details) {
        await this.log('user_' + action, JSON.stringify({
            user_id: userId,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        }));
    },

    // ==================== 门店相关 ====================

    async logStoreCreate(storeCode, storeName, createdBy) {
        await this.log('store_create', JSON.stringify({
            store_code: storeCode,
            store_name: storeName,
            created_by: createdBy,
            created_at: new Date().toISOString()
        }));
    },

    async logStoreAction(storeId, action, details) {
        await this.log('store_' + action, JSON.stringify({
            store_id: storeId,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        }));
    },

    // ==================== 黑名单相关 ====================

    async logBlacklistAction(customerId, action, reason) {
        await this.log('blacklist_' + action, JSON.stringify({
            customer_id: customerId,
            action: action,
            reason: reason,
            timestamp: new Date().toISOString()
        }));
    },

    // ==================== 备份恢复相关 ====================

    async logBackup(filename, stats, exportedBy) {
        await this.log('backup', JSON.stringify({
            filename: filename,
            stats: stats,
            exported_by: exportedBy,
            exported_at: new Date().toISOString()
        }));
    },

    async logRestore(filename, results, restoredBy) {
        await this.log('restore', JSON.stringify({
            filename: filename,
            results: results,
            restored_by: restoredBy,
            restored_at: new Date().toISOString()
        }));
    },

    async logExport(type, filename, exportedBy) {
        await this.log('export', JSON.stringify({
            type: type,
            filename: filename,
            exported_by: exportedBy,
            exported_at: new Date().toISOString()
        }));
    },

    // ==================== 查询方法 ====================

    /**
     * 获取审计日志（支持多条件筛选）
     * @param {Object} filters
     * @param {string}  [filters.action]    - 操作类型
     * @param {string}  [filters.userId]    - 用户 ID
     * @param {string}  [filters.startDate] - 开始日期 YYYY-MM-DD
     * @param {string}  [filters.endDate]   - 结束日期 YYYY-MM-DD
     * @param {number}  [filters.limit]     - 返回条数上限（默认 500）
     * @returns {Array} 日志记录数组
     */
    async getLogs(filters) {
        if (filters === undefined) filters = {};
        
        let query = supabaseClient
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters.action) {
            query = query.eq('action', filters.action);
        }
        if (filters.userId) {
            query = query.eq('user_id', filters.userId);
        }
        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate + 'T23:59:59');
        }

        var limit = filters.limit || 500;
        query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }
};
