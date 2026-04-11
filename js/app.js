const APP = {

    page: "login",

    init() {
        console.log("APP INIT OK");

        AUTH.load();

        this.render();   // 🔥 强制渲染（关键）
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        const ok = AUTH.login(u, p);

        if (ok) {
            this.page = "dashboard";
        }

        this.render();   // 🔥 必须重新渲染
    },

    openOrders() {
        this.page = "orders";
        this.render();
    },

    createOrder() {

        const name = prompt("Name");
        const phone = prompt("Phone");
        const amount = parseFloat(prompt("Amount"));
        const rate = parseFloat(prompt("Rate"));
        const collateral = prompt("Collateral");

        DB.loans.push({
            id: Date.now(),
            name,
            phone,
            principal: amount,
            remaining: amount,
            rate,
            collateral,
            start: Utils.today(),
            lastInterest: Utils.today(),
            staff: AUTH.user.username,
            history: []
        });

        this.render();
    },

    payInterest(id) {
        PaymentService.payInterest(id);
        this.render();
    },

    payPrincipal(id) {
        PaymentService.payPrincipal(id);
        this.render();
    },

    render() {

        const app = document.getElementById("app");

        if (!app) {
            console.log("NO APP ELEMENT");
            return;
        }

        console.log("RENDER PAGE:", this.page);

        if (!AUTH.user) {
            app.innerHTML = UI.login();
            return;
        }

        if (this.page === "dashboard") {
            app.innerHTML = UI.dashboard();
            return;
        }

        if (this.page === "orders") {
            app.innerHTML = UI.orders();
            return;
        }

        // 🔥 fallback（防空白）
        app.innerHTML = UI.dashboard();
    }
};
