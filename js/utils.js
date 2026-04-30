<!-- 1. 配置和第三方库 -->
<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- 2. 核心工具模块 -->
<script src="utils.js"></script>
<script src="toast.js"></script>
<script src="cache.js"></script>
<script src="supabase.js"></script>
<script src="auth.js"></script>

<!-- 3. 权限模块 -->
<script src="permission.js"></script>
<script src="audit.js"></script>

<!-- 4. 业务模块（注意：不要重复加载 app-dashboard-core.js） -->
<script src="order.js"></script>
<script src="app-state-init.js"></script>
<script src="app.js"></script>

<!-- 5. 功能模块 -->
<script src="app-blacklist.js"></script>
<script src="app-customers.js"></script>
<script src="app-dashboard-anomaly.js"></script>
<script src="app-dashboard-orders.js"></script>  <!-- 只保留这一个，删除 app-dashboard-core.js -->
<script src="app-dashboard-expenses.js"></script>
<script src="app-dashboard-funds.js"></script>
<script src="app-dashboard-print.js"></script>
<script src="app-dashboard-users.js"></script>
<script src="app-dashboard-wa.js"></script>
<script src="app-payments.js"></script>
<script src="store.js"></script>
<script src="storage.js"></script>
<script src="migration.js"></script>
