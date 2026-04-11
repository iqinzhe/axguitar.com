console.log("APP FILE LOADED");
const APP = {

    page: "dashboard",

    init() {

        console.log("🚀 APP START");

        AUTH.load();

        this.bindEvents();   // 🔥 关键

        this.render();
    },

    bindEvents() {

        const btnOrders = document.getElementById("btnOrders");
        const btnDashboard = document.getElementById("btnDashboard");

        if (btnOrders) {
            btnOrders.addEventListener("click", () => {
                this.openOrders();
            });
        }

        if (btnDashboard) {
            btnDashboard.addEventListener("click", () => {
                this.openDashboard();
            });
        }
    },

    openOrders() {
        this.page = "orders";
        this.render();
    },

    openDashboard() {
        this.page = "dashboard";
        this.render();
    },

    render() {

        const app = document.getElementById("app");

        if (!AUTH?.user) {
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

window.APP = APP;

document.addEventListener("DOMContentLoaded", () => {
    APP.init();
});
window.APP = APP;
