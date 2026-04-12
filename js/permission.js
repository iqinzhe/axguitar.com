const PERMISSION = {

    can(action) {

        if (!AUTH.user) return false;

        const role = AUTH.user.role;

        const rules = {
            admin: ["order_create", "order_delete", "order_view"],
            staff: ["order_create", "order_view"]
        };

        return rules[role]?.includes(action);
    }
};

window.PERMISSION = PERMISSION;
