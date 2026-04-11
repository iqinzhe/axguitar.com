const APP = {

    page: "dashboard",

    init() {

        AUTH.load();

        if (!PERMISSION.requireLogin()) {
            this.renderLogin();
            return;
        }

        this.bind();
        this.render();
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        if (!AUTH.login(u, p)) {
            alert("Login failed");
            return;
        }

        this.init();
    },

    logout() {
        AUTH.logout();
    },

    bind() {

        document.getElementById("btnDashboard")?.addEventListener("click", () => {
            this.page = "dashboard";
            this.render();
        });

        document.getElementById("btnOrders")?.addEventListener("click", () => {
            this.page = "orders";
            this.render();
        });
    },

    renderLogin() {
        document.getElementById("app").innerHTML = `
            <div style="padding:20px">
                <h2>LOGIN</h2>
                <input id="u" placeholder="username"><br><br>
                <input id="p" placeholder="password"><br><br>
                <button onclick="APP.login()">Login</button>
            </div>
        `;
    },

    render() {

        if (!PERMISSION.canAccess(this.page)) {
            document.getElementById("app").innerHTML = "NO PERMISSION";
            return;
        }

        if (this.page === "dashboard") {
            document.getElementById("app").innerHTML = `
                <h2>Dashboard</h2>
                <button id="btnOrders">Orders</button>
                <button onclick="APP.logout()">Logout</button>
            `;
        }

        if (this.page === "orders") {
            document.getElementById("app").innerHTML = `
                <h2>Orders</h2>
                <button id="btnDashboard">Dashboard</button>
                <button onclick="APP.logout()">Logout</button>
            `;
        }
    }
};

window.APP = APP;

document.addEventListener("DOMContentLoaded", () => {
    APP.init();
});
