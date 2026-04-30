// app.js - 主入口文件

window.APP = window.APP || {};

// 当前页面状态
APP.currentPage = 'dashboard';
APP.currentFilter = 'all';
APP.currentOrderId = null;
APP.currentCustomerId = null;

// 页面状态恢复
APP.saveCurrentPageState = function() {
    try {
        sessionStorage.setItem('jf_current_page', APP.currentPage);
        sessionStorage.setItem('jf_current_filter', APP.currentFilter || 'all');
        if (APP.currentOrderId) sessionStorage.setItem('jf_current_order_id', APP.currentOrderId);
        if (APP.currentCustomerId) sessionStorage.setItem('jf_current_customer_id', APP.currentCustomerId);
        
        localStorage.setItem('jf_last_page', APP.currentPage);
        localStorage.setItem('jf_last_filter', APP.currentFilter || 'all');
        if (APP.currentOrderId) localStorage.setItem('jf_last_order_id', APP.currentOrderId);
        if (APP.currentCustomerId) localStorage.setItem('jf_last_customer_id', APP.currentCustomerId);
    } catch(e) {}
};

// 清除页面状态
APP.clearPageState = function() {
    try {
        sessionStorage.removeItem('jf_current_page');
        sessionStorage.removeItem('jf_current_filter');
        sessionStorage.removeItem('jf_current_order_id');
        sessionStorage.removeItem('jf_current_customer_id');
    } catch(e) {}
};

// 切换语言
APP.toggleLanguage = function() {
    var newLang = Utils.lang === 'id' ? 'zh' : 'id';
    Utils.setLanguage(newLang);
    Utils.forceSyncLanguage();
    if (APP.isLoggedIn && APP.isLoggedIn()) {
        APP.renderDashboard();
    } else {
        APP.showLogin();
    }
};

// 返回上一页
APP.goBack = function() {
    var validPages = ['dashboard', 'orderTable', 'customers', 'expenses', 'userManagement', 'storeManagement', 'anomaly', 'paymentHistory', 'backupRestore', 'blacklist'];
    if (window.history.length > 1 && document.referrer) {
        window.history.back();
    } else {
        APP.renderDashboard();
    }
};

// 导航到指定页面
APP.navigateTo = function(page, params) {
    if (params) {
        if (params.orderId) APP.currentOrderId = params.orderId;
        if (params.customerId) APP.currentCustomerId = params.customerId;
    }
    
    switch(page) {
        case 'dashboard':
            APP.renderDashboard();
            break;
        case 'orderTable':
            APP.showOrderTable();
            break;
        case 'customers':
            APP.showCustomers();
            break;
        case 'expenses':
            APP.showExpenses();
            break;
        case 'userManagement':
            APP.showUserManagement();
            break;
        case 'storeManagement':
            StoreManager.renderStoreManagement();
            break;
        case 'anomaly':
            APP.showAnomaly();
            break;
        case 'paymentHistory':
            APP.showPaymentHistory();
            break;
        case 'backupRestore':
            BackupStorage.renderBackupUI();
            break;
        case 'blacklist':
            APP.showBlacklist();
            break;
        case 'payment':
            if (params && params.orderId) {
                APP.showPayment(params.orderId);
            }
            break;
        case 'viewOrder':
            if (params && params.orderId) {
                APP.viewOrder(params.orderId);
            }
            break;
        default:
            APP.renderDashboard();
    }
};

// 打印当前页面
APP.printCurrentPage = function() {
    if (window.APP && typeof window.APP._doPrint === 'function') {
        window.APP._doPrint();
    } else if (window.DashboardPrint) {
        DashboardPrint.printCurrentPage();
    } else {
        window.print();
    }
};

// 导出数据
APP.exportData = function() {
    BackupStorage.backup();
};

// 导入数据
APP.importData = function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async function(e) {
        if (e.target.files && e.target.files[0]) {
            await BackupStorage.restore(e.target.files[0]);
        }
    };
    input.click();
};

// 检查登录状态
APP.isLoggedIn = function() {
    return AUTH && AUTH.isLoggedIn();
};

// 初始化应用
APP.init = async function() {
    console.log('[APP] 初始化开始...');
    
    // 显示加载状态
    var appElement = document.getElementById('app');
    if (appElement) {
        appElement.innerHTML = '<div class="loading-container" style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="loader"></div><p style="margin-left:12px;">' + (Utils.lang === 'id' ? 'Memuat...' : '加载中...') + '</p></div>';
    }
    
    // 初始化错误处理
    if (Utils.ErrorHandler) Utils.ErrorHandler.init();
    
    // 初始化网络监控
    if (Utils.NetworkMonitor) Utils.NetworkMonitor.init();
    
    // 初始化 AUTH
    await AUTH.init();
    
    // 检查登录状态
    if (AUTH.isLoggedIn()) {
        // 恢复页面状态
        if (window._RESTORED_STATE && window._RESTORED_STATE.page) {
            var restored = window._RESTORED_STATE;
            APP.currentPage = restored.page;
            APP.currentFilter = restored.filter || 'all';
            APP.currentOrderId = restored.orderId;
            APP.currentCustomerId = restored.customerId;
            
            APP.navigateTo(restored.page, {
                orderId: restored.orderId,
                customerId: restored.customerId
            });
        } else {
            APP.renderDashboard();
        }
    } else {
        APP.showLogin();
    }
    
    console.log('[APP] 初始化完成');
};

// 导出到全局
window.APP = APP;
