const APP = {

    db: null,

    init() {

        this.db = Storage.load();

        AUTH.init(this.db);
        AUTH.load();

        this.render();
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        if (!AUTH.login(u, p)) {
            alert("Login failed");
            return;
        }

        this.render();
    },

    logout() {
        AUTH.logout();
    },

    render() {

        const app = document.getElementById("app");

        Storage.save(this.db);

        if (!AUTH.user) {
            app.innerHTML = UI.login();
            return;
        }

        const stats = Dashboard.getStats(this.db);
        app.innerHTML = UI.dashboard(stats);
    }
};

window.APP = APP;

document.addEventListener("DOMContentLoaded", () => APP.init());
