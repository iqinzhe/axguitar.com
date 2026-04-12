window.APP = {

    db: null,
    currentFilter: "all",

    // =========================
    // INIT
    // =========================
    init() {

        this.db = Storage.load();
        AUTH.init(this.db);

        this.router();
    },

    // =========================
    // ROUTER
    // =========================
    router() {

        if (!AUTH.user) {
            this.renderLogin();
        } else {
            this.renderDashboard();
        }
    },

    // =========================
    // LOGIN PAGE
    // =========================
    renderLogin() {

        document.getElementById("app").innerHTML = `
            <h2>Login / 登录</h2>

            <input id="u" placeholder="username / 用户名">
            <input id="p" type="password" placeholder="password / 密码">

            <button onclick="APP.login()">Login</button>
        `;
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        const user = AUTH.login(u, p);

        if (!user) {
            alert("Login failed / 登录失败");
            return;
        }

        this.router();
    },

    // =========================
    // DASHBOARD
    // =========================
    renderDashboard() {

        const total = this.db.orders.length;

        document.getElementById("app").innerHTML = `
            <h2>Dashboard / 仪表盘</h2>

            <div>
                User: ${AUTH.user.username} (${AUTH.user.role})
            </div>

            <div>Total Orders / 订单总数: ${total}</div>

            <br>

            <button onclick="APP.openOrderTable()">Orders / 订单管理</button>
            <button onclick="APP.logout()">Logout / 登出</button>
        `;
    },

    // =========================
    // ORDER TABLE
    // =========================
    openOrderTable() {

        let orders = this.db.orders || [];

        // filter
        if (this.currentFilter !== "all") {
            orders = orders.filter(o => o.status === this.currentFilter);
        }

        const rows = orders.map(o => `
            <tr>
                <td>${o.order_id}</td>
                <td>${o.customer.name}</td>
                <td>${o.collateral_name}</td>
                <td>${o.loan_amount}</td>
                <td>${o.status}</td>
                <td>
                    <button onclick="APP.viewOrder(${o.order_id})">View</button>

                    ${PERMISSION.can("order_delete") ? `
                        <button onclick="APP.deleteOrder(${o.order_id})">Delete</button>
                    ` : ""}
                </td>
            </tr>
        `).join("");

        document.getElementById("app").innerHTML = `
            <h2>Orders / 订单列表</h2>

            <div>
                Filter:
                <button onclick="APP.setFilter('all')">All</button>
                <button onclick="APP.setFilter('active')">Active</button>
                <button onclick="APP.setFilter('overdue')">Overdue</button>
                <button onclick="APP.setFilter('paid')">Paid</button>
            </div>

            <br>

            ${PERMISSION.can("order_create") ? `
                <button onclick="APP.showCreateOrder()">+ New Order / 新建订单</button>
            ` : ""}

            <table border="1" cellpadding="5" width="100%">
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

            <br>

            <button onclick="APP.renderDashboard()">Back</button>
        `;
    },

    setFilter(status) {
        this.currentFilter = status;
        this.openOrderTable();
    },

    // =========================
    // CREATE ORDER PAGE
    // =========================
    showCreateOrder() {

        document.getElementById("app").innerHTML = `
            <h2>New Order / 新订单</h2>

            <h3>Customer</h3>
            <input id="name" placeholder="Nama / 姓名">
            <input id="ktp" placeholder="KTP / 身份证">
            <input id="phone" placeholder="HP / 手机号">
            <input id="address" placeholder="Alamat / 地址">

            <h3>Collateral</h3>
            <input id="collateral" placeholder="Barang / 质押物 (iPhone 13)">

            <h3>Loan</h3>
            <input id="amount" placeholder="Jumlah / 金额">
            <input id="interest" placeholder="Bunga / 利率 %">
            <input id="due" placeholder="Jatuh Tempo / 到期日">

            <h3>Notes</h3>
            <input id="notes" placeholder="Catatan / 备注">

            <br>

            <button onclick="APP.saveOrder()">Save / 保存</button>
            <button onclick="APP.openOrderTable()">Back</button>
        `;
    },

    // =========================
    // SAVE ORDER
    // =========================
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

    // =========================
    // VIEW ORDER
    // =========================
    viewOrder(id) {

        const o = this.db.orders.find(x => x.order_id === id);

        document.getElementById("app").innerHTML = `
            <h2>Order Detail / 订单详情</h2>

            <pre>
Order ID: ${o.order_id}

Customer:
Name: ${o.customer.name}
KTP: ${o.customer.ktp}
Phone: ${o.customer.phone}
Address: ${o.customer.address}

Collateral: ${o.collateral_name}

Loan: ${o.loan_amount}
Interest: ${o.interest_rate}%

Status: ${o.status}
Due: ${o.due_date}

Officer: ${o.officer}
Created: ${o.created_at}

Notes: ${o.notes}
            </pre>

            <button onclick="APP.openOrderTable()">Back</button>
        `;
    },

    // =========================
    // DELETE ORDER
    // =========================
    deleteOrder(id) {

        this.db.orders = this.db.orders.filter(o => o.order_id !== id);

        Storage.save(this.db);

        this.openOrderTable();
    },

    // =========================
    // LOGOUT
    // =========================
    logout() {

        AUTH.logout();

        this.router();
    }
};
