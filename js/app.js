window.APP = {

    db: null,
    currentFilter: "all",

    init() {
        this.db = Storage.load();
        AUTH.init(this.db);
        this.router();
    },

    router() {
        if (!AUTH.user) this.renderLogin();
        else this.renderDashboard();
    },

    renderLogin() {
        document.getElementById("app").innerHTML = `
            <h2>Login / 登录</h2>
            <input id="u" placeholder="username">
            <input id="p" type="password" placeholder="password">
            <button onclick="APP.login()">Login</button>
        `;
    },

    login() {
        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        const user = AUTH.login(u, p);

        if (!user) return alert("Login failed");

        this.router();
    },

    renderDashboard() {
        document.getElementById("app").innerHTML = `
            <h2>Dashboard (${AUTH.user.role})</h2>
            <div>Total Orders: ${this.db.orders.length}</div>

            <button onclick="APP.openOrderTable()">Orders</button>
            <button onclick="APP.logout()">Logout</button>
        `;
    },

    openOrderTable() {

        const rows = this.db.orders.map(o => `
            <tr>
                <td>${o.order_id}</td>
                <td>${o.customer.name}</td>
                <td>${o.collateral_name}</td>
                <td>${o.loan_amount}</td>
                <td>${o.status}</td>
                <td>
                    <button onclick="APP.viewOrder(${o.order_id})">View</button>
                    ${PERMISSION.can("order_delete") ?
                        `<button onclick="APP.deleteOrder(${o.order_id})">Delete</button>` : ""
                    }
                </td>
            </tr>
        `).join("");

        document.getElementById("app").innerHTML = `
            <h2>Orders</h2>

            <button onclick="APP.showCreateOrder()">+ New Order</button>

            <table>
                <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Collateral</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
                ${rows}
            </table>

            <button onclick="APP.renderDashboard()">Back</button>
        `;
    },

    showCreateOrder() {

        document.getElementById("app").innerHTML = `
            <h2>Create Order</h2>

            <input id="name" placeholder="Name">
            <input id="ktp" placeholder="KTP">
            <input id="phone" placeholder="Phone">
            <input id="address" placeholder="Address">

            <input id="collateral" placeholder="Collateral Name">
            <input id="amount" placeholder="Loan Amount">
            <input id="interest" placeholder="Interest %">
            <input id="due" placeholder="Due Date">

            <input id="notes" placeholder="Notes">

            <button onclick="APP.saveOrder()">Save</button>
        `;
    },

    saveOrder() {

        const order = {
            order_id: Date.now(),

            customer: {
                name: document.getElementById("name").value,
                ktp: document.getElementById("ktp").value,
                phone: document.getElementById("phone").value,
                address: document.getElementById("address").value
            },

            collateral_name: document.getElementById("collateral").value,

            loan_amount: Number(document.getElementById("amount").value),
            interest_rate: Number(document.getElementById("interest").value),
            due_date: document.getElementById("due").value,

            status: "active",
            officer: AUTH.user.username,
            created_at: new Date().toLocaleString(),
            notes: document.getElementById("notes").value
        };

        this.db.orders.push(order);

        Storage.save(this.db);

        this.openOrderTable();
    },

    viewOrder(id) {

        const o = this.db.orders.find(x => x.order_id === id);

        document.getElementById("app").innerHTML = `
            <h2>Order Detail</h2>
            <pre>${JSON.stringify(o, null, 2)}</pre>
            <button onclick="APP.openOrderTable()">Back</button>
        `;
    },

    deleteOrder(id) {

        this.db.orders = this.db.orders.filter(o => o.order_id !== id);

        Storage.save(this.db);

        this.openOrderTable();
    },

    logout() {
        AUTH.logout();
        this.router();
    }
};
