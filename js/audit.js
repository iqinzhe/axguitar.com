// audit.js - v1.2（优化：抽取 _ts 辅助方法，消除冗余双语字符串）

const Audit = {

    // ==================== 内部：带时间戳的日志数据构建 ====================
    _ts() { return { timestamp: new Date().toISOString() }; },

    // ==================== 核心日志记录 ====================
    async log(action, details, extra = {}) {
        try {
            const profile = await SUPABASE.getCurrentProfile();
            if (!profile) { console.warn('审计日志：未登录用户尝试记录日志'); return; }

            const logData = {
                user_id: profile.id, user_name: profile.name,
                user_role: profile.role, store_id: profile.store_id,
                store_name: profile.stores?.name || null,
                action, details,
                // ip_address 已移除（不再请求第三方API）
                user_agent: navigator.userAgent,
                extra_info: JSON.stringify(extra),
                created_at: new Date().toISOString()
            };

            supabaseClient.from('audit_logs').insert(logData).then(result => {
                if (result.error) console.warn('审计日志写入失败:', result.error.message);
            }).catch(err => console.warn('审计日志写入异常:', err));
        } catch (error) {
            console.warn('审计日志记录失败:', error);
        }
    },

    // ==================== 专用日志方法 ====================
    async logOrderAction(orderId, action, beforeData, afterData) {
        await this.log(`order_${action}`, JSON.stringify({
            order_id: orderId, action,
            before: this._sanitizeData(beforeData),
            after: this._sanitizeData(afterData),
            ...this._ts()
        }));
    },

    async logLogin(userId, success, errorMsg = null) {
        await this.log('login', JSON.stringify({ user_id: userId, success, error_message: errorMsg, ...this._ts() }));
    },

    async logLogout(userId, userName) {
        await this.log('logout', JSON.stringify({ user_id: userId, user_name: userName, ...this._ts() }));
    },

    async logOrderCreate(order) {
        await this.log('order_create', JSON.stringify({
            order_id: order.order_id, customer_name: order.customer_name,
            loan_amount: order.loan_amount, store_id: order.store_id,
            created_at: order.created_at
        }));
    },

    async logOrderDelete(order) {
        await this.log('order_delete', JSON.stringify({
            order_id: order.order_id, customer_name: order.customer_name,
            loan_amount: order.loan_amount, status: order.status,
            deleted_at: new Date().toISOString()
        }));
    },

    async logPayment(orderId, paymentType, amount, method) {
        await this.log('payment', JSON.stringify({ order_id: orderId, payment_type: paymentType, amount, method, ...this._ts() }));
    },

    async logUserAction(action, targetUserId, targetUserName, changes) {
        await this.log(`user_${action}`, JSON.stringify({
            target_user_id: targetUserId, target_user_name: targetUserName, changes, ...this._ts()
        }));
    },

    async logStoreAction(action, storeId, storeName, changes) {
        await this.log(`store_${action}`, JSON.stringify({ store_id: storeId, store_name: storeName, changes, ...this._ts() }));
    },

    async logBlacklistAction(action, customerId, customerName, reason) {
        await this.log(`blacklist_${action}`, JSON.stringify({ customer_id: customerId, customer_name: customerName, reason, ...this._ts() }));
    },

    async logExport(exportType, recordCount) {
        await this.log('export', JSON.stringify({ export_type: exportType, record_count: recordCount, ...this._ts() }));
    },

    async logRestore(filename, results) {
        await this.log('restore', JSON.stringify({ filename, results, ...this._ts() }));
    },

    // ==================== 数据清理 ====================
    _sanitizeData(data) {
        if (!data) return null;
        const sanitized = JSON.parse(JSON.stringify(data));
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        const removeSensitive = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            for (const key of Object.keys(obj)) {
                if (sensitiveFields.some(f => key.toLowerCase().includes(f))) delete obj[key];
                else if (typeof obj[key] === 'object') removeSensitive(obj[key]);
            }
        };
        removeSensitive(sanitized);
        return sanitized;
    },

    // ==================== 查询审计日志 ====================
    async _requireAdmin() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') throw new Error('只有管理员可以查看审计日志');
        return profile;
    },

    async getAuditLogs(filters = {}) {
        await this._requireAdmin();

        let query = supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (filters.user_id)   query = query.eq('user_id', filters.user_id);
        if (filters.action)    query = query.eq('action', filters.action);
        if (filters.startDate) query = query.gte('created_at', filters.startDate);
        if (filters.endDate)   query = query.lte('created_at', filters.endDate);
        if (filters.limit)     query = query.limit(filters.limit);
        if (filters.offset)    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getActionTypes() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') return [];

        const { data, error } = await supabaseClient.from('audit_logs').select('action').order('action');
        if (error) return [];
        return [...new Set(data.map(item => item.action))].sort();
    },

    async getAuditUsers() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') return [];

        const { data, error } = await supabaseClient.from('audit_logs').select('user_id, user_name').order('user_name');
        if (error) return [];

        const userMap = new Map();
        for (const item of data) {
            if (!userMap.has(item.user_id)) userMap.set(item.user_id, { id: item.user_id, name: item.user_name });
        }
        return Array.from(userMap.values());
    },

    async cleanupOldLogs(daysToKeep = 90) {
        await this._requireAdmin();

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const { data, error } = await supabaseClient
            .from('audit_logs').delete().lt('created_at', cutoffDate.toISOString()).select('count');
        if (error) throw error;

        await this.log('audit_cleanup', JSON.stringify({
            days_kept: daysToKeep, deleted_count: data?.length || 0,
            cutoff_date: cutoffDate.toISOString()
        }));
        return data?.length || 0;
    },

    // ==================== 审计日志界面 ====================
    async showAuditLogs() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();

        if (profile?.role !== 'admin') {
            alert('只有管理员可以查看审计日志');
            APP.goBack();
            return;
        }

        if (window.APP?.saveCurrentPageState) {
            window.APP.currentPage = 'auditLogs';
            window.APP.saveCurrentPageState();
        }

        const [[actionTypes, users], logs] = await Promise.all([
            Promise.all([this.getActionTypes(), this.getAuditUsers()]),
            this.getAuditLogs({ limit: 100 })
        ]);

        const actionOptions = '<option value="">' + (lang === 'id' ? '全部操作' : '全部操作') + '</option>'
            + actionTypes.map(a => `<option value="${Utils.escapeAttr(a)}">${Utils.escapeHtml(a)}</option>`).join('');

        const userOptions = '<option value="">' + (lang === 'id' ? '全部用户' : '全部用户') + '</option>'
            + users.map(u => `<option value="${Utils.escapeAttr(u.id)}">${Utils.escapeHtml(u.name)}</option>`).join('');

        document.getElementById('app').innerHTML = `
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
                    <select id="filterUser" style="width:auto; min-width:150px;">${userOptions}</select>
                    <select id="filterAction" style="width:auto; min-width:150px;">${actionOptions}</select>
                    <input type="date" id="filterDateStart">
                    <input type="date" id="filterDateEnd">
                    <button onclick="Audit.filterAuditLogs()" class="btn-small">🔍 ${lang === 'id' ? 'Filter' : '筛选'}</button>
                    <button onclick="Audit.resetAuditFilters()" class="btn-small">🔄 ${lang === 'id' ? 'Reset' : '重置'}</button>
                </div>
            </div>
            <div class="card">
                <h3>📋 ${lang === 'id' ? 'Daftar Log' : '日志列表'}</h3>
                <div class="table-container" style="overflow-x:auto;">
                    <table class="data-table" style="min-width:800px;">
                        <thead><tr>
                            <th>${lang === 'id' ? 'Waktu' : '时间'}</th>
                            <th>${lang === 'id' ? 'Pengguna' : '用户'}</th>
                            <th>${lang === 'id' ? 'Peran' : '角色'}</th>
                            <th>${lang === 'id' ? 'Aksi' : '操作'}</th>
                            <th>${lang === 'id' ? 'Detail' : '详情'}</th>
                            <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                        </tr></thead>
                        <tbody id="auditLogsBody"></tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <h3>🗑️ ${lang === 'id' ? 'Pembersihan Log' : '日志清理'}</h3>
                <p>删除超过指定天数的旧日志。建议保留至少90天。</p>
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
            </div>`;

        window._auditLogsData = logs;
        this._renderAuditLogsTable(logs);
    },

    async filterAuditLogs() {
        const filters = {};
        const userId    = document.getElementById('filterUser')?.value;
        const action    = document.getElementById('filterAction')?.value;
        const dateStart = document.getElementById('filterDateStart')?.value;
        const dateEnd   = document.getElementById('filterDateEnd')?.value;

        if (userId)    filters.user_id   = userId;
        if (action)    filters.action    = action;
        if (dateStart) filters.startDate = dateStart;
        if (dateEnd)   filters.endDate   = dateEnd;

        try {
            const logs = await this.getAuditLogs(filters);
            this._renderAuditLogsTable(logs);
            window._auditLogsData = logs;
        } catch (error) {
            alert('筛选失败：' + error.message);
        }
    },

    resetAuditFilters() {
        ['filterUser', 'filterAction', 'filterDateStart', 'filterDateEnd'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.filterAuditLogs();
    },

    _renderLogDetails(details) {
        try {
            const parsed = JSON.parse(details);
            const str = JSON.stringify(parsed, null, 2);
            return str.length > 100 ? str.substring(0, 100) + '...' : str;
        } catch { return details || '-'; }
    },

    _renderAuditLogsTable(logs) {
        const tbody = document.getElementById('auditLogsBody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无日志记录</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `<tr>
            <td style="white-space:nowrap;">${Utils.formatDate(log.created_at)}</td>
            <td>${Utils.escapeHtml(log.user_name || '-')}</td>
            <td>${Utils.escapeHtml(log.user_role || '-')}</td>
            <td>${Utils.escapeHtml(log.action)}</td>
            <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                title="${Utils.escapeHtml(log.details || '')}">${Utils.escapeHtml(this._renderLogDetails(log.details))}</td>
            <td>${Utils.escapeHtml(log.store_name || '-')}</td>
        </tr>`).join('');
    },

    async exportAuditLogsToCSV() {
        const lang = Utils.lang;
        const logs = window._auditLogsData || await this.getAuditLogs({ limit: 5000 });

        if (logs.length === 0) { alert('没有数据可导出'); return; }

        const headers = lang === 'id'
            ? ['Waktu', 'Pengguna', 'Peran', 'Aksi', 'Detail', 'Toko']
            : ['时间', '用户', '角色', '操作', '详情', '门店'];

        const rows = logs.map(log => [
            log.created_at, log.user_name || '-', log.user_role || '-', log.action,
            (log.details || '-').replace(/\n/g, ' '), log.store_name || '-'
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jf_audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        alert('✅ 导出成功！');
    },

    async cleanupOldLogsFromUI() {
        const days = parseInt(document.getElementById('cleanupDays')?.value || '90');
        if (!confirm(`⚠️ 确认删除超过 ${days} 天的旧日志吗？\n\n此操作不可撤销。`)) return;

        try {
            const deletedCount = await this.cleanupOldLogs(days);
            alert(`✅ 已删除 ${deletedCount} 条超过 ${days} 天的旧日志。`);
            await this.filterAuditLogs();
        } catch (error) {
            alert('清理失败：' + error.message);
        }
    }
};

window.Audit = Audit;

console.log('✅ audit.js v1.2 已加载 - 优化版');
