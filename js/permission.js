const PERMISSION = {

    ROLE: {
        admin: ["ALL"],
        staff: ["CREATE", "VIEW_OWN", "PAY"]
    },

    has(action) {

        if (!AUTH.user) return false;

        if (AUTH.user.role === "admin") return true;

        return this.ROLE[AUTH.user.role].includes(action);
    },

    canViewLoan(loan) {

        if (AUTH.user.role === "admin") return true;

        if (AUTH.user.role === "staff") {
            return loan.staff === AUTH.user.username;
        }

        return false;
    }
};
