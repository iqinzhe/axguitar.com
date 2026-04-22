// audit.js - v1.1（修复：审计日志功能完整，双语支持和错误处理）

const Audit = {

    // ==================== 内部：带时间戳的日志数据构建 ====================
    _ts() { return { timestamp: new Date().toISOString() }; },

    // ==================== 核心日志记录 ====================
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
                details: typeof details === 'string' ? details : JSON.stringify(details),
                user_agent: navigator.userAgent.substring(0, 500), // 限制长度
                extra_info: JSON.stringify(extra),
                created_at: new Date().toISOString()
            };

            // 异步写入，不阻塞主流程
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
            order_id: orderId, 
            action: action,
            before: this._sanitizeData(beforeData),
            after: this._sanitizeData(afterData),
            ...this._ts()
        }));
    },

    async logLogin(userId, success, errorMsg = null) {
        await this.log('login', JSON.stringify({ 
            user_id: userId, 
            success: success, 
            error_message: errorMsg, 
            ...this._ts() 
        }));
    },

    async logLogout(userId, userName) {
        await this.log('logout', JSON.stringify({ 
            user_id: userId, 
            user_name: userName, 
            ...this._ts() 
        }));
    },

    async logOrderCreate(order) {
        await this.log('order_create', JSON.stringify({
            order_id: order.order_id, 
            customer_name: order.customer_name,
            loan_amount: order.loan_amount, 
            store_id: order.store_id,
            repayment_type: order.repayment_type,
            created_at: order.created_at
        }));
    },

    async logOrderDelete(order) {
        await this.log('order_delete', JSON.stringify({
            order_id: order.order_id, 
            customer_name: order.customer_name,
            loan_amount: order.loan_amount, 
            status: order.status,
            deleted_at: new Date().toISOString()
        }));
    },

    async logPayment(orderId, paymentType, amount, method) {
        await this.log('payment', JSON.stringify({ 
            order_id: orderId, 
            payment_type: paymentType, 
            amount: amount, 
            method: method, 
            ...this._ts() 
        }));
    },

    async logUserAction(action, targetUserId, targetUserName, changes) {
        await this.log(`user_${action}`, JSON.stringify({
            target_user_id: targetUserId, 
            target_user_name: targetUserName, 
            changes: changes, 
            ...this._ts()
        }));
    },

    async logStoreAction(action, storeId, storeName, changes) {
        await this.log(`store_${action}`, JSON.stringify({ 
            store_id: storeId, 
            store_name: storeName, 
            changes: changes, 
            ...this._ts() 
        }));
    },

    async logBlacklistAction(action, customerId, customerName, reason) {
        await this.log(`blacklist_${action}`, JSON.stringify({ 
            customer_id: customerId, 
            customer_name: customerName, 
            reason: reason, 
            ...this._ts() 
        }));
    },

    async logExport(exportType, recordCount) {
        await this.log('export', JSON.stringify({ 
            export_type: exportType, 
            record_count: recordCount, 
            ...this._ts() 
        }));
    },

    async logRestore(filename, results) {
        await this.log('restore', JSON.stringify({ 
            filename: filename, 
            results: results, 
            ...this._ts() 
        }));
    },

    // ==================== 数据清理 ====================
    _sanitizeData(data) {
        if (!data) return null;
        try {
            const sanitized = JSON.parse(JSON.stringify(data));
            const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
            const removeSensitive = (obj) => {
                if (!obj || typeof obj !== 'object') return;
                for (const key of Object.keys(obj)) {
                    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
                        delete obj[key];
                    } else if (typeof obj[key] === 'object') {
                        removeSensitive(obj[key]);
                    }
                }
            };
            removeSensitive(sanitized);
            return sanitized;
        } catch (e) {
            return data;
        }
    },

    // ==================== 查询审计日志 ====================
    async _requireAdmin() {
        const profile = await SUPABASE.getCurrentProfile();
        if (profile?.role !== 'admin') {
            throw new Error(Utils.lang === 'id' ? 'Hanya administrator yang dapat melihat log audit' : '只有管理员可以查看审计日志');
        }
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
        try {
            await this._requireAdmin();
            const { data, error } = await supabaseClient.from('audit_logs').select('action').order('action');
            if (error) return [];
            return [...new Set(data.map(item => item.action))].sort();
        } catch (error) {
            console.warn("获取操作类型失败:", error);
            return [];
        }
    },

    async getAuditUsers() {
        try {
            await this._requireAdmin();
            const { data, error } = await supabaseClient.from('audit_logs').select('user_id, user_name').order('user_name');
            if (error) return [];

            const userMap = new Map();
            for (const item of data) {
                if (item.user_id && !userMap.has(item.user_id)) {
                    userMap.set(item.user_id, { id: item.user_id, name: item.user_name || item.user_id });
                }
            }
            return Array.from(userMap.values());
        } catch (error) {
            console.warn("获取审计用户失败:", error);
            return [];
        }
    },

    async cleanupOldLogs(daysToKeep = 90) {
        await this._requireAdmin();

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
    async showAuditLogs() {
        const lang = Utils.lang;
        const profile = await SUPABASE.getCurrentProfile();

        if (profile?.role !== 'admin') {
            alert(lang === 'id' ? 'Hanya administrator yang dapat melihat log audit' : '只有管理员可以查看审计日志');
            if (typeof APP !== 'undefined' && APP.goBack) {
                APP.goBack();
            }
            return;
        }

        if (window.APP?.saveCurrentPageState) {
            window.APP.currentPage = 'auditLogs';
            window.APP.saveCurrentPageState();
        }

        const [actionTypes, users, logs] = await Promise.all([
            this.getActionTypes(),
            this.getAuditUsers(),
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
                        <tbody id="auditLogsBody"></tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <h3>🗑️ ${lang === 'id' ? 'Pembersihan Log' : '日志清理'}</h3>
                <p>${lang === 'id' ? 'Hapus log yang lebih lama dari hari yang ditentukan. Disarankan menyimpan minimal 90 hari.' : '删除超过指定天数的旧日志。建议保留至少90天。'}</p>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
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
            
            <style>
                .data-table td {
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                @media (max-width: 768px) {
                    .data-table td {
                        white-space: normal;
                        word-break: break-word;
                    }
                }
            </style>`;

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
            alert(Utils.lang === 'id' ? 'Filter gagal: ' + error.message : '筛选失败：' + error.message);
        }
    },

    resetAuditFilters() {
        const ids = ['filterUser', 'filterAction', 'filterDateStart', 'filterDateEnd'];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.value = '';
        }
        this.filterAuditLogs();
    },

    _renderLogDetails(details) {
        if (!details) return '-';
        try {
            const parsed = JSON.parse(details);
            const str = JSON.stringify(parsed, null, 2);
            return str.length > 100 ? str.substring(0, 100) + '...' : str;
        } catch (e) {
            return details.length > 100 ? details.substring(0, 100) + '...' : details;
        }
    },

    _renderAuditLogsTable(logs) {
        const tbody = document.getElementById('auditLogsBody');
        if (!tbody) return;

        if (!logs || logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">' + (Utils.lang === 'id' ? '暂无日志记录' : '暂无日志记录') + '</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td style="white-space:nowrap;">${Utils.formatDate(log.created_at)}</td>
                <td>${Utils.escapeHtml(log.user_name || '-')}</td>
                <td>${Utils.escapeHtml(log.user_role || '-')}</td>
                <td>${Utils.escapeHtml(log.action)}</td>
                <td style="max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
                    title="${Utils.escapeHtml(log.details || '')}">${Utils.escapeHtml(this._renderLogDetails(log.details))}</td>
                <td>${Utils.escapeHtml(log.store_name || '-')}</td>
            </tr>
        `).join('');
    },

    async exportAuditLogsToCSV() {
        const lang = Utils.lang;
        const logs = window._auditLogsData || await this.getAuditLogs({ limit: 5000 });

        if (!logs || logs.length === 0) { 
            alert(lang === 'id' ? 'Tidak ada data untuk diekspor' : '没有数据可导出'); 
            return; 
        }

        const headers = lang === 'id'
            ? ['Waktu', 'Pengguna', 'Peran', 'Aksi', 'Detail', 'Toko']
            : ['时间', '用户', '角色', '操作', '详情', '门店'];

        const rows = logs.map(log => [
            log.created_at, 
            log.user_name || '-', 
            log.user_role || '-', 
            log.action,
            (log.details || '-').replace(/\n/g, ' '), 
            log.store_name || '-'
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
        
        alert(lang === 'id' ? '✅ Ekspor berhasil!' : '✅ 导出成功！');
    },

    async cleanupOldLogsFromUI() {
        const days = parseInt(document.getElementById('cleanupDays')?.value || '90');
        const lang = Utils.lang;
        
        const confirmMsg = lang === 'id'
            ? `⚠️ Yakin menghapus log yang lebih lama dari ${days} hari?\n\nTindakan ini tidak dapat dibatalkan.`
            : `⚠️ 确认删除超过 ${days} 天的旧日志吗？\n\n此操作不可撤销。`;
        
        if (!confirm(confirmMsg)) return;

        try {
            const deletedCount = await this.cleanupOldLogs(days);
            const successMsg = lang === 'id'
                ? `✅ ${deletedCount} log yang lebih lama dari ${days} hari telah dihapus.`
                : `✅ 已删除 ${deletedCount} 条超过 ${days} 天的旧日志。`;
            alert(successMsg);
            await this.filterAuditLogs();
        } catch (error) {
            alert(lang === 'id' ? 'Pembersihan gagal: ' + error.message : '清理失败：' + error.message);
        }
    }
};

window.Audit = Audit;
