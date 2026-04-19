// audit.js - 操作日志模块 v1.0
// 功能：
// 1. 记录所有重要操作（登录、登出、订单创建、缴费、删除、用户管理等）
// 2. 支持按用户、操作类型、时间范围筛选
// 3. 仅管理员可查看审计日志
// 4. 自动记录操作前后的数据变化

const Audit = {
    
    // ==================== 核心日志记录 ====================
    
    /**
     * 记录操作日志
     * @param {string} action - 操作类型（如：login, order_create, order_delete, user_update）
     * @param {string} details - 操作详情（JSON字符串）
     * @param {Object} extra - 额外信息（可选）
     */
    async log(action, details, extra = {}) {
        try {
            const profile = await SUPABASE.getCurrentProfile();
            if (!profile) {
                console.warn('审计日志：未登录用户尝试记录日志');
                return;
            }
            
            const logData = {
                user_id: profile.id,
                user_name: profile.name,
                user_role: profile.role,
                store_id: profile.store_id,
                store_name: profile.stores?.name || null,
                action: action,
                details: details,
                ip_address: await this._getClientIP(),
                user_agent: navigator.userAgent,
                extra_info: JSON.stringify(extra),
                created_at: new Date().toISOString()
            };
            
            // 异步写入，不阻塞主流程
            supabaseClient.from('audit_logs').insert(logData).then(result => {
                if (result.error) {
                    console.warn('审计日志写入失败:', result.error.message);
                }
            }).catch(err => {
                console.warn('审计日志写入异常:', err);
            });
            
        } catch (error) {
            console.warn('审计日志记录失败:', error);
        }
    },
    
    /**
     * 获取客户端 IP（通过外部服务）
     */
    async _getClientIP() {
        try {
            // 使用免费 API 获取 IP
            const res = await fetch('https://api.ipify.org?format=json', { timeout: 3000 });
            const data = await res.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    },
    
    // ==================== 专用日志记录方法 ====================
    
    /**
     * 记录订单操作（带前后对比）
     * @param {string} orderId - 订单号
     * @param {string} action - 操作类型
     * @param {Object} beforeData - 操作前的数据
     * @param {Object} afterData - 操作后的数据
     */
    async logOrderAction(orderId, action, beforeData, afterData) {
        const details = {
            order_id: orderId,
            action: action,
            before: this._sanitizeData(beforeData),
            after: this._sanitizeData(afterData),
            timestamp: new Date().toISOString()
        };
        await this.log(`order_${action}`, JSON.stringify(details));
    },
    
    /**
     * 记录登录操作
     * @param {string} userId - 用户ID
     * @param {boolean} success - 是否成功
     * @param {string} errorMsg - 错误信息（可选）
     */
    async logLogin(userId, success, errorMsg = null) {
        await this.log('login', JSON.stringify({
            user_id: userId,
            success: success,
            error_message: errorMsg,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录登出操作
     */
    async logLogout(userId, userName) {
        await this.log('logout', JSON.stringify({
            user_id: userId,
            user_name: userName,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录订单创建
     */
    async logOrderCreate(order) {
        await this.log('order_create', JSON.stringify({
            order_id: order.order_id,
            customer_name: order.customer_name,
            loan_amount: order.loan_amount,
            store_id: order.store_id,
            created_at: order.created_at
        }));
    },
    
    /**
     * 记录订单删除
     */
    async logOrderDelete(order) {
        await this.log('order_delete', JSON.stringify({
            order_id: order.order_id,
            customer_name: order.customer_name,
            loan_amount: order.loan_amount,
            status: order.status,
            deleted_at: new Date().toISOString()
        }));
    },
    
    /**
     * 记录缴费操作
     */
    async logPayment(orderId, paymentType, amount, method) {
        await this.log('payment', JSON.stringify({
            order_id: orderId,
            payment_type: paymentType,
            amount: amount,
            method: method,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录用户管理操作
     */
    async logUserAction(action, targetUserId, targetUserName, changes) {
        await this.log(`user_${action}`, JSON.stringify({
            target_user_id: targetUserId,
            target_user_name: targetUserName,
            changes: changes,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录门店管理操作
     */
    async logStoreAction(action, storeId, storeName, changes) {
        await this.log(`store_${action}`, JSON.stringify({
            store_id: storeId,
            store_name: storeName,
            changes: changes,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录黑名单操作
     */
    async logBlacklistAction(action, customerId, customerName, reason) {
        await this.log(`blacklist_${action}`, JSON.stringify({
            customer_id: customerId,
            customer_name: customerName,
            reason: reason,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录数据导出操作
     */
    async logExport(exportType, recordCount) {
        await this.log('export', JSON.stringify({
            export_type: exportType,
            record_count: recordCount,
            timestamp: new Date().toISOString()
        }));
    },
    
    /**
     * 记录数据恢复操作
     */
    async logRestore(filename, results) {
        await this.log('restore', JSON.stringify({
            filename: filename,
            results: results,
            timestamp: new Date().toISOString()
        }));
    },
    
    // ==================== 数据清理 ====================
    
    /**
     * 清理敏感数据（用于日志记录）
     */
    _sanitizeData(data) {
        if (!data) return null;
        
        // 深拷贝
        const sanitized = JSON.parse(JSON.stringify(data));
        
        // 移除敏感字段
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const removeSensitive = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            for (const key of Object.keys(obj)) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    delete obj[key];
                } else if (typeof obj[key] === 'object') {
                    removeSensitive(obj[key]);
                }
            }
        };
        removeSensitive(sanitized);
        
        return sanitized;
    },
    
    // ==================== 查询审计日志 ====================
    
    /**
     * 查看审计日志（仅管理员）
     * @param {Object} filters - 筛选条件
     * @param {string} filters.user_id - 用户ID
     * @param {string} filters.action - 操作类型
     * @param {string} filters.startDate - 开始日期
     * @param {string} filters.endDate - 结束日期
     * @param {number} filters.limit - 返回数量限制
     * @param {number} filters.offset - 分页偏移
     */
    async getAuditLogs(filters = {}) {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' 
                ? '只有管理员可以查看审计日志'
                : '只有管理员可以查看审计日志');
        }
        
        let query = supabaseClient
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (filters.user_id) {
            query = query.eq('user_id', filters.user_id);
        }
        if (filters.action) {
            query = query.eq('action', filters.action);
        }
        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate);
        }
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },
    
    /**
     * 获取操作类型列表（用于筛选）
     */
    async getActionTypes() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            return [];
        }
        
        const { data, error } = await supabaseClient
            .from('audit_logs')
            .select('action')
            .order('action');
        
        if (error) return [];
        
        // 去重
        const uniqueActions = [...new Set(data.map(item => item.action))];
        return uniqueActions.sort();
    },
    
    /**
     * 获取用户列表（用于筛选）
     */
    async getAuditUsers() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            return [];
        }
        
        const { data, error } = await supabaseClient
            .from('audit_logs')
            .select('user_id, user_name')
            .order('user_name');
        
        if (error) return [];
        
        // 去重
        const userMap = new Map();
        for (const item of data) {
            if (!userMap.has(item.user_id)) {
                userMap.set(item.user_id, {
                    id: item.user_id,
                    name: item.user_name
                });
            }
        }
        
        return Array.from(userMap.values());
    },
    
    /**
     * 清理旧日志（仅管理员，保留指定天数）
     * @param {number} daysToKeep - 保留天数（默认90天）
     */
    async cleanupOldLogs(daysToKeep = 90) {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' 
                ? '只有管理员可以清理审计日志'
                : '只有管理员可以清理审计日志');
        }
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const { data, error } = await supabaseClient
            .from('audit_logs')
            .delete()
            .lt('created_at', cutoffDate.toISOString())
            .select('count');
        
        if (error) throw error;
        
        await this.log('audit_cleanup', JSON.stringify({
            days_kept: daysToKeep,
            deleted_count: data?.length || 0,
            cutoff_date: cutoffDate.toISOString()
        }));
        
        return data?.length || 0;
    },
    
    // ==================== 审计日志界面 ====================
    
    /**
     * 显示审计日志界面（仅管理员）
     */
    async showAuditLogs() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();
        
        if (profile?.role !== 'admin') {
            alert(lang === 'id' ? '只有管理员可以查看审计日志' : '只有管理员可以查看审计日志');
            APP.goBack();
            return;
        }
        
        // 保存当前页面状态
        if (window.APP && typeof window.APP.saveCurrentPageState === 'function') {
            window.APP.currentPage = 'auditLogs';
            window.APP.saveCurrentPageState();
        }
        
        // 获取筛选选项
        const [actionTypes, users] = await Promise.all([
            this.getActionTypes(),
            this.getAuditUsers()
        ]);
        
        // 获取日志数据
        const logs = await this.getAuditLogs({ limit: 100 });
        
        // 构建表格行
        let rows = '';
        if (logs.length === 0) {
            rows = `<tr><td colspan="6" class="text-center">${lang === 'id' ? '暂无日志记录' : '暂无日志记录'}</td><td/tr>`;
        } else {
            for (const log of logs) {
                // 解析详情
                let detailsDisplay = log.details || '-';
                try {
                    const parsed = JSON.parse(log.details);
                    detailsDisplay = JSON.stringify(parsed, null, 2);
                    if (detailsDisplay.length > 100) {
                        detailsDisplay = detailsDisplay.substring(0, 100) + '...';
                    }
                } catch (e) {
                    // 保持原样
                }
                
                rows += `<tr>
                    <td style="white-space:nowrap;">${Utils.formatDate(log.created_at)}</td>
                    <td>${Utils.escapeHtml(log.user_name || '-')}</td>
                    <td>${Utils.escapeHtml(log.user_role || '-')}</td>
                    <td>${Utils.escapeHtml(log.action)}</td>
                    <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${Utils.escapeHtml(log.details || '')}">${Utils.escapeHtml(detailsDisplay)}</td>
                    <td>${Utils.escapeHtml(log.store_name || '-')}</td>
                　　　`;
            }
        }
        
        // 构建操作类型选项
        let actionOptions = '<option value="">' + (lang === 'id' ? '全部操作' : '全部操作') + '</option>';
        for (const action of actionTypes) {
            actionOptions += `<option value="${Utils.escapeAttr(action)}">${Utils.escapeHtml(action)}</option>`;
        }
        
        // 构建用户选项
        let userOptions = '<option value="">' + (lang === 'id' ? '全部用户' : '全部用户') + '</option>';
        for (const user of users) {
            userOptions += `<option value="${Utils.escapeAttr(user.id)}">${Utils.escapeHtml(user.name)}</option>`;
        }
        
        document.getElementById("app").innerHTML = `
            <div class="page-header">
                <h2>📋 ${lang === 'id' ? 'Log Audit' : '审计日志'}</h2>
                <div class="header-actions">
                    <button onclick="APP.goBack()" class="btn-back">↩️ ${Utils.t('back')}</button>
                    <button onclick="Audit.exportAuditLogsToCSV()" class="btn-export">📎 ${lang === 'id' ? 'Ekspor CSV' : '导出CSV'}</button>
                </div>
            </div>
            
            <div class="card">
                <h3>🔍 ${lang === 'id' ? 'Filter Log' : '筛选日志'}</h3>
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
                    <select id="filterUser" style="width:auto; min-width:150px;">
                        ${userOptions}
                    </select>
                    <select id="filterAction" style="width:auto; min-width:150px;">
                        ${actionOptions}
                    </select>
                    <input type="date" id="filterDateStart" placeholder="${lang === 'id' ? 'Dari tanggal' : '开始日期'}">
                    <input type="date" id="filterDateEnd" placeholder="${lang === 'id' ? 'Sampai tanggal' : '结束日期'}">
                    <button onclick="Audit.filterAuditLogs()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                    <button onclick="Audit.resetAuditFilters()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                </div>
            </div>
            
            <div class="card">
                <h3>📋 ${lang === 'id' ? 'Daftar Log' : '日志列表'}</h3>
                <div class="table-container" style="overflow-x:auto;">
                    <table class="data-table" style="min-width:800px;">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Waktu' : '时间'}</th>
                                <th>${lang === 'id' ? 'Pengguna' : '用户'}</th>
                                <th>${lang === 'id' ? 'Peran' : '角色'}</th>
                                <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                                <th>${lang === 'id' ? 'Detail' : '详情'}</th>
                                <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                            </tr>
                        </thead>
                        <tbody id="auditLogsBody">
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="card">
                <h3>🗑️ ${lang === 'id' ? 'Pembersihan Log' : '日志清理'}</h3>
                <p>${lang === 'id' 
                    ? '删除超过指定天数的旧日志。建议保留至少90天。'
                    : '删除超过指定天数的旧日志。建议保留至少90天。'}</p>
                <div style="display:flex; gap:10px; align-items:center;">
                    <select id="cleanupDays">
                        <option value="30">30 ${lang === 'id' ? 'hari' : '天'}</option>
                        <option value="60">60 ${lang === 'id' ? 'hari' : '天'}</option>
                        <option value="90" selected>90 ${lang === 'id' ? 'hari' : '天'}</option>
                        <option value="180">180 ${lang === 'id' ? 'hari' : '天'}</option>
                        <option value="365">365 ${lang === 'id' ? 'hari' : '天'}</option>
                    </select>
                    <button onclick="Audit.cleanupOldLogsFromUI()" class="danger">🗑️ ${lang === 'id' ? 'Bersihkan Log Lama' : '清理旧日志'}</button>
                </div>
            </div>
        `;
        
        // 存储当前日志数据供筛选使用
        window._auditLogsData = logs;
    },
    
    /**
     * 筛选审计日志
     */
    async filterAuditLogs() {
        const userId = document.getElementById('filterUser')?.value;
        const action = document.getElementById('filterAction')?.value;
        const dateStart = document.getElementById('filterDateStart')?.value;
        const dateEnd = document.getElementById('filterDateEnd')?.value;
        
        const filters = {};
        if (userId) filters.user_id = userId;
        if (action) filters.action = action;
        if (dateStart) filters.startDate = dateStart;
        if (dateEnd) filters.endDate = dateEnd;
        
        try {
            const logs = await this.getAuditLogs(filters);
            this._renderAuditLogsTable(logs);
            window._auditLogsData = logs;
        } catch (error) {
            alert(Utils.lang === 'id' ? '筛选失败: ' + error.message : '筛选失败：' + error.message);
        }
    },
    
    /**
     * 重置筛选条件
     */
    resetAuditFilters() {
        const filterUser = document.getElementById('filterUser');
        const filterAction = document.getElementById('filterAction');
        const filterDateStart = document.getElementById('filterDateStart');
        const filterDateEnd = document.getElementById('filterDateEnd');
        
        if (filterUser) filterUser.value = '';
        if (filterAction) filterAction.value = '';
        if (filterDateStart) filterDateStart.value = '';
        if (filterDateEnd) filterDateEnd.value = '';
        
        this.filterAuditLogs();
    },
    
    /**
     * 渲染审计日志表格
     */
    _renderAuditLogsTable(logs) {
        const tbody = document.getElementById('auditLogsBody');
        if (!tbody) return;
        
        const lang = Utils.lang;
        
        let rows = '';
        if (logs.length === 0) {
            rows = `<tr><td colspan="6" class="text-center">${lang === 'id' ? '暂无日志记录' : '暂无日志记录'}</td><td/tr>`;
        } else {
            for (const log of logs) {
                let detailsDisplay = log.details || '-';
                try {
                    const parsed = JSON.parse(log.details);
                    detailsDisplay = JSON.stringify(parsed, null, 2);
                    if (detailsDisplay.length > 100) {
                        detailsDisplay = detailsDisplay.substring(0, 100) + '...';
                    }
                } catch (e) {
                    // 保持原样
                }
                
                rows += `<tr>
                    <td style="white-space:nowrap;">${Utils.formatDate(log.created_at)}</td>
                    <td>${Utils.escapeHtml(log.user_name || '-')}</td>
                    <td>${Utils.escapeHtml(log.user_role || '-')}</td>
                    <td>${Utils.escapeHtml(log.action)}</td>
                    <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${Utils.escapeHtml(log.details || '')}">${Utils.escapeHtml(detailsDisplay)}</td>
                    <td>${Utils.escapeHtml(log.store_name || '-')}</td>
                　　　`;
            }
        }
        
        tbody.innerHTML = rows;
    },
    
    /**
     * 导出审计日志为 CSV
     */
    async exportAuditLogsToCSV() {
        const lang = Utils.lang;
        const logs = window._auditLogsData || await this.getAuditLogs({ limit: 5000 });
        
        if (logs.length === 0) {
            alert(lang === 'id' ? '没有数据可导出' : '没有数据可导出');
            return;
        }
        
        const headers = lang === 'id'
            ? ['Waktu', 'Pengguna', 'Peran', 'Aksi', 'Detail', 'Toko', 'IP Address']
            : ['时间', '用户', '角色', '操作', '详情', '门店', 'IP地址'];
        
        const rows = logs.map(log => [
            log.created_at,
            log.user_name || '-',
            log.user_role || '-',
            log.action,
            (log.details || '-').replace(/\n/g, ' '),
            log.store_name || '-',
            log.ip_address || '-'
        ]);
        
        const csvContent = [headers, ...rows].map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jf_audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert(lang === 'id' ? '✅ 导出成功！' : '✅ 导出成功！');
    },
    
    /**
     * 从 UI 清理旧日志
     */
    async cleanupOldLogsFromUI() {
        const lang = Utils.lang;
        const days = parseInt(document.getElementById('cleanupDays')?.value || '90');
        
        const confirmMsg = lang === 'id'
            ? `⚠️ 确认删除超过 ${days} 天的旧日志吗？\n\n此操作不可撤销。`
            : `⚠️ 确认删除超过 ${days} 天的旧日志吗？\n\n此操作不可撤销。`;
        
        if (!confirm(confirmMsg)) return;
        
        try {
            const deletedCount = await this.cleanupOldLogs(days);
            alert(lang === 'id'
                ? `✅ 已删除 ${deletedCount} 条超过 ${days} 天的旧日志。`
                : `✅ 已删除 ${deletedCount} 条超过 ${days} 天的旧日志。`);
            
            // 刷新日志列表
            await this.filterAuditLogs();
        } catch (error) {
            alert(lang === 'id' ? '清理失败: ' + error.message : '清理失败：' + error.message);
        }
    }
};

window.Audit = Audit;

console.log('✅ audit.js v1.0 已加载 - 操作日志模块已启用');
