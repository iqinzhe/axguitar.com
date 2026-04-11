const UI = {

    login() {
        return `
            <h2>Login</h2>
            <input id="u" placeholder="username">
            <input id="p" type="password" placeholder="password">
            <button onclick="APP.login()">Login</button>
        `;
    },

    dashboard() {

        const total = DB.loans.reduce((a, b) => a + b.principal, 0);

        return `
            <h2>Dashboard</h2>
            <div>Total Loan: ${Utils.formatIDR(total)}</div>

            <button onclick="APP.viewLoans()">Loans</button>
            <button onclick="AUTH.logout()">Logout</button>
        `;
    },

    loans() {

        return DB.loans
            .filter(PERMISSION.canViewLoan)
            .map(l => `
                <div class="card">
                    <b>${l.name}</b><br>
                    Remaining: ${Utils.formatIDR(l.remaining)}<br>

                    <button onclick="APP.pay(${l.id})">
                        Pay Interest
                    </button>
                </div>
            `).join("");
    }
};
