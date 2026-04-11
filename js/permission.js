const PERMISSION = {

    ROLE: {
        admin: ["ALL"],
        staff: ["CREATE", "PAY", "VIEW_OWN"]
    },

    has(action) {

        if (!AUTH.user) return false;

        if (AUTH.user.role === "admin") return true;

        return this.ROLE[AUTH.user.role].includes(action);
    },

    canViewLoan(l) {

        if (AUTH.user.role === "admin") return true;

        return l.staff === AUTH.user.username;
    }
};
