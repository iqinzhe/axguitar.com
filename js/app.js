const APP = {

    page: "login",

    init() {
        AUTH.load();
        this.render();
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        if (AUTH.login(u, p)) {
            this.page = "dashboard";
        }

        this.render();
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

        if (!AUTH.user) {
            app.innerHTML = UI.login();
            return;
        }

        if (this.page === "dashboard") {
            app.innerHTML = UI.dashboard();
        }

        if (this.page === "orders") {
            app.innerHTML = UI.orders();
        }
    }
};
