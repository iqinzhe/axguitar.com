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

        return `
            <h2>Dashboard</h2>
            <button onclick="APP.openOrders()">Orders</button>
            <button onclick="AUTH.logout()">Logout</button>
        `;
    },

    orders() {

        let html = `<h2>Orders</h2>
        <button onclick="APP.createOrder()">New Order</button>`;

        DB.loans
        .filter(PERMISSION.canViewLoan)
        .forEach(l => {

            html += `
                <div class="card">
                    <b>${l.name}</b><br>
                    Remaining: ${Utils.formatIDR(l.remaining)}<br>

                    <button onclick="APP.payInterest(${l.id})">Interest</button>
                    <button onclick="APP.payPrincipal(${l.id})">Principal</button>
                </div>
            `;
        });

        return html;
    }
};
