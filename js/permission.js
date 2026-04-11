const PERMISSION = {

    role() {
        return AUTH.user?.role || null;
    },

    canAccess(page) {

        const role = this.role();
        if (!role) return false;

        return DB.roles[role]?.pages.includes(page);
    },

    can(action) {

        const role = this.role();
        if (!role) return false;

        return DB.roles[role]?.actions.includes(action);
    },

    requireLogin() {
        return !!AUTH.user;
    }
};

window.PERMISSION = PERMISSION;
