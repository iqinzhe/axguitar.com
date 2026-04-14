<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/utils.js"></script>
<script src="js/supabase.js"></script>
<script src="js/auth.js"></script>
<script src="js/permission.js"></script>
<script src="js/storage.js"></script>
<script src="js/order.js"></script>
<script src="js/store.js"></script>
<script src="js/migration.js"></script>
<script src="js/app-core.js"></script>
<script src="js/app-customers.js"></script>
<script src="js/app-orders.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    if (window.APP && typeof window.APP.init === 'function') {
        window.APP.init();
    } else {
        console.error("APP not properly loaded");
        document.getElementById("app").innerHTML = 
            '<div style="text-align:center;padding:50px;color:#ef4444;">Loading error: System not ready. Please refresh.</div>';
    }
});
</script>
