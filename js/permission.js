const PERMISSION = {

    can(action) {

        if (!AUTH.user) return false;

        if (AUTH.user.role === "admin") return true;

        const staffRules = {
            order_create: true,
            order_edit: true,
            order_delete: false,
            customer_view: true
        };

        return !!staffRules[action];
    }
};

window.PERMISSION = PERMISSION;
