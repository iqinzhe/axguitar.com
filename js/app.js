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

    viewLoans() {
        this.page = "loans";
        this.render();
    },

    pay(id) {
        PaymentService.payInterest(id);
        this.render();
    },

    render() {

        const app = document.getElementById("app");

        if (!AUTH.user) {
            app.innerHTML = UI.login();
            return;
        }

        if (this.page === "dashboard")
            app.innerHTML = UI.dashboard();

        if (this.page === "loans")
            app.innerHTML = UI.loans();
    }
};
