// audit.js - 审计日志功能已禁用（保留空方法兼容调用）
window.Audit = {
    log: async function() { return; },
    logOrderAction: async function() { return; },
    logLogin: async function() { return; },
    logLogout: async function() { return; },
    logOrderCreate: async function() { return; },
    logOrderDelete: async function() { return; },
    logPayment: async function() { return; },
    logUserAction: async function() { return; },
    logStoreAction: async function() { return; },
    logBlacklistAction: async function() { return; },
    logExport: async function() { return; },
    logRestore: async function() { return; }
};
