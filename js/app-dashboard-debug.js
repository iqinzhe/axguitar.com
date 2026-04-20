// app-dashboard-debug.js - 调试版入口文件
// 用于开发调试时按正确顺序加载所有拆分后的模块
// 发布时可将所有模块合并为 app-dashboard.js

// 确保所有模块都挂载到同一个 window.APP 对象
window.APP = window.APP || {};

// 注意：此文件需要在所有模块加载完成后执行初始化
// 在 HTML 中应按以下顺序加载：
// 
// <!-- 基础模块（必须先加载） -->
// <script src="js/supabase.js"></script>
// <script src="js/utils.js"></script>
// <script src="js/auth.js"></script>
// <script src="js/permission.js"></script>
// <script src="js/order.js"></script>
// <script src="js/store.js"></script>
// <script src="js/storage.js"></script>
// <script src="js/audit.js"></script>
// <script src="js/migration.js"></script>
//
// <!-- 功能模块（按依赖顺序） -->
// <script src="js/app-blacklist.js"></script>
// <script src="js/app-customers.js"></script>
// <script src="js/app-payments.js"></script>
//
// <!-- 仪表盘拆分模块（按顺序加载） -->
// <script src="js/app-dashboard-core.js"></script>      <!-- 核心：路由、登录、仪表盘 -->
// <script src="js/app-dashboard-funds.js"></script>     <!-- 资金：资金流水、转账 -->
// <script src="js/app-dashboard-users.js"></script>     <!-- 用户：用户管理 -->
// <script src="js/app-dashboard-wa.js"></script>        <!-- 提醒：WA提醒 -->
// <script src="js/app-dashboard-print.js"></script>     <!-- 打印：打印功能 -->
// <script src="js/app-dashboard-orders.js"></script>    <!-- 订单：订单列表、详情 -->
// <script src="js/app-dashboard-expenses.js"></script>  <!-- 支出：运营支出 -->
// <script src="js/app-dashboard-report.js"></script>    <!-- 报表：财务报表 -->
//
// <!-- 入口初始化 -->
// <script src="js/app-dashboard-debug.js"></script>

(function() {
    // 检查所有必需的模块是否已加载
    var requiredModules = [
        'SUPABASE', 'Utils', 'AUTH', 'PERMISSION', 'Order', 
        'StoreManager', 'Storage', 'Audit', 'Migration'
    ];
    
    var optionalModules = [
        'APP.showBlacklist', 'APP.showCustomers', 'APP.showPayment',
        'APP.showOrderTable', 'APP.showExpenses', 'APP.showReport',
        'APP.showCashFlowModal', 'APP.showUserManagement', 'APP.sendDailyReminders',
        'APP.printCurrentPage'
    ];
    
    var missingRequired = [];
    for (var i = 0; i < requiredModules.length; i++) {
        var moduleName = requiredModules[i];
        if (typeof window[moduleName] === 'undefined') {
            missingRequired.push(moduleName);
        }
    }
    
    if (missingRequired.length > 0) {
        console.error('❌ 缺少必需模块:', missingRequired.join(', '));
        console.warn('请确保所有基础模块已正确加载');
    } else {
        console.log('✅ 所有必需模块已加载');
    }
    
    // 检查可选模块（仪表盘功能）
    var loadedCount = 0;
    var totalCount = optionalModules.length;
    for (var j = 0; j < optionalModules.length; j++) {
        var funcName = optionalModules[j];
        var parts = funcName.split('.');
        var obj = window;
        var found = true;
        for (var k = 0; k < parts.length; k++) {
            if (typeof obj[parts[k]] === 'undefined') {
                found = false;
                break;
            }
            obj = obj[parts[k]];
        }
        if (found) loadedCount++;
    }
    
    console.log(`📊 仪表盘功能模块加载状态: ${loadedCount}/${totalCount}`);
    
    // 初始化应用
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof window.APP !== 'undefined' && window.APP && typeof window.APP.init === 'function') {
            console.log('🚀 JF! by Gadai - 初始化中...');
            window.APP.init();
        } else {
            console.error('❌ APP.init 未找到，请检查模块加载顺序');
            // 显示错误提示
            var appDiv = document.getElementById('app');
            if (appDiv) {
                appDiv.innerHTML = `
                    <div class="error-container">
                        <div class="error-card">
                            <div class="error-icon">⚠️</div>
                            <h3 class="error-title">模块加载失败</h3>
                            <p class="error-message">请检查控制台查看详细错误信息</p>
                            <button class="error-btn" onclick="location.reload()">重新加载</button>
                        </div>
                    </div>
                `;
            }
        }
    });
    
    // 导出模块加载状态供调试
    window.__DEBUG_MODULES__ = {
        required: requiredModules.map(function(m) { 
            return { name: m, loaded: typeof window[m] !== 'undefined' };
        }),
        optional: optionalModules.map(function(f) {
            var parts = f.split('.');
            var obj = window;
            for (var i = 0; i < parts.length; i++) {
                if (typeof obj[parts[i]] === 'undefined') {
                    return { name: f, loaded: false };
                }
                obj = obj[parts[i]];
            }
            return { name: f, loaded: true };
        }),
        timestamp: new Date().toISOString()
    };
    
    console.log('🐛 调试模式已启用，可通过 window.__DEBUG_MODULES__ 查看模块加载状态');
})();

console.log('✅ app-dashboard-debug.js 已加载 - 调试版入口文件');
