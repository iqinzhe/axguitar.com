const AUTH = {

    user: null,
    db: null,

    init(db) {
        this.db = db;
    },

    login(username, password) {

        const user = this.db.users.find(u =>
            u.username === username && u.password === password
        );

        if (!user) return false;

        this.user = {
            username: user.username,
            role: user.role
        };

        localStorage.setItem("user", JSON.stringify(this.user));
        return true;
    },

    load() {
        const u = localStorage.getItem("user");
        if (u) this.user = JSON.parse(u);
    },

    logout() {
        localStorage.removeItem("user");
        location.reload();
    }
};

window.AUTH = AUTH;
