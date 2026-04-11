const AUTH = {

    user: null,

    load() {
        const raw = localStorage.getItem("user");
        if (raw) this.user = JSON.parse(raw);
    },

    login(username, password) {

        const found = DB.users.find(u =>
            u.username === username &&
            u.password === password
        );

        if (!found) return false;

        this.user = {
            username: found.username,
            role: found.role
        };

        localStorage.setItem("user", JSON.stringify(this.user));

        return true;
    },

    logout() {
        this.user = null;
        localStorage.removeItem("user");
        location.reload();
    }
};

window.AUTH = AUTH;
