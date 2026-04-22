// audit.js - 审计日志功能已禁用
// 如需恢复，请取消注释并恢复 app-dashboard-core.js 和 permission.js 中的相关代码

/*
const Audit = {

    _ts() { return { timestamp: new Date().toISOString() }; },

    async log(action, details, extra = {}) {
        // 功能已禁用
        return;
    },

    async logOrderAction(orderId, action, beforeData, afterData) {
        return;
    },

    async logLogin(userId, success, errorMsg = null) {
        return;
    },

    async logLogout(userId, userName) {
        return;
    },

    async logOrderCreate(order) {
        return;
    },

    async logOrderDelete(order) {
        return;
    },

    async logPayment(orderId, paymentType, amount, method) {
        return;
    },

    async logUserAction(action, targetUserId, targetUserName, changes) {
        return;
    },

    async logStoreAction(action, storeId, storeName, changes) {
        return;
    },

    async logBlacklistAction(action, customerId, customerName, reason) {
        return;
    },

    async logExport(exportType, recordCount) {
        return;
    },

    async logRestore(filename, results) {
        return;
    },

    _sanitizeData(data) {
        return data;
    },

    async _requireAdmin() {
        throw new Error(Utils.lang === 'id' ? 'Fungsi audit dinonaktifkan' : '审计功能已禁用');
    },

    async getAuditLogs(filters = {}) {
        return [];
    },

    async getActionTypes() {
        return [];
    },

    async getAuditUsers() {
        return [];
    },

    async cleanupOldLogs(daysToKeep = 90) {
        return 0;
    },

    async showAuditLogs() {
        const lang = Utils.lang;
        alert(lang === 'id' ? 'Fungsi audit log telah dinonaktifkan' : '审计日志功能已禁用');
        if (typeof window.APP !== 'undefined' && typeof window.APP.goBack === 'function') {
            window.APP.goBack();
        }
    },

    async filterAuditLogs() {
        return;
    },

    resetAuditFilters() {
        return;
    },

    _renderLogDetails(details) {
        return '-';
    },

    _renderAuditLogsTable(logs) {
        return;
    },

    async exportAuditLogsToCSV() {
        alert(Utils.lang === 'id' ? 'Fungsi audit dinonaktifkan' : '审计功能已禁用');
    },

    async cleanupOldLogsFromUI() {
        alert(Utils.lang === 'id' ? 'Fungsi audit dinonaktifkan' : '审计功能已禁用');
    }
};

window.Audit = Audit;
*/
