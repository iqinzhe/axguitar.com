const AUTH = {

    user: null,

    login(u, p) {

        const found = DB.users.find(x =>
            x.username === u && x.password === p
        );

        if (!found) return false;

        this.user = found;
        localStorage.setItem("user", JSON.stringify(found));

        return true;
    },

    load() {
        this.user = JSON.parse(localStorage.getItem("user"));
    },

    logout() {
        localStorage.removeItem("user");
        location.reload();
    }
};
