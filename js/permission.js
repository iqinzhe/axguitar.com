const PERMISSION = {
    can(action) {
        if (!AUTH.user) return false;
        const role = AUTH.user.role;
        const rules = {
            admin: ["order_create","order_view","order_delete","order_edit","order_payment","order_liquidate","user_manage","report_view","backup_restore"],
            store_manager: ["order_create","order_view","order_payment"],
            staff: ["order_create","order_view","order_payment"]
        };
        return rules[role]?.includes(action) || false;
    }
};
window.PERMISSION = PERMISSION;
