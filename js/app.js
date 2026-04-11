window.APP = {

    init() {

        console.log("APP init start");

        try {

            // 1. 初始化数据
            if (typeof Storage !== "undefined") {
                this.db = Storage.load() || { users: [], orders: [] };
            } else {
                this.db = { users: [], orders: [] };
            }

            // 2. 初始化 auth
            if (typeof AUTH !== "undefined") {
                AUTH.init(this.db);
            }

            // 3. 判断登录状态
            if (AUTH.user) {
                this.renderDashboard();
            } else {
                this.renderLogin();
            }

            console.log("APP init done");

        } catch (e) {
            console.error("APP init error:", e);
            document.getElementById("app").innerHTML =
                "❌ Init error: " + e.message;
        }
    },

    renderLogin() {
        document.getElementById("app").innerHTML = `
            <h2>Login</h2>

            <input id="u" placeholder="username"><br><br>
            <input id="p" type="password" placeholder="password"><br><br>

            <button onclick="APP.login()">Login</button>
        `;
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        const user = AUTH.login(u, p);

        if (!user) {
            alert("Login failed");
            return;
        }

        this.renderDashboard();
    },

    renderDashboard() {

        const role = AUTH.user.role;

        document.getElementById("app").innerHTML = `
            <h2>Dashboard</h2>

            <div>Role: ${role}</div>

            <div>Total Orders: ${(this.db.orders || []).length}</div>

            <button onclick="APP.createOrder()">New Order</button>
            <button onclick="APP.logout()">Logout</button>
        `;
    },

    createOrder() {

        const id = Date.now();

        this.db.orders.push({
            id,
            amount: 1000,
            time: new Date().toISOString()
        });

        Storage.save(this.db);

        this.renderDashboard();
    },

    logout() {
        AUTH.logout();
        this.renderLogin();
    }
};
