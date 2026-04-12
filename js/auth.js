const AUTH = {

    user: null,

    init(db) {
        this.db = db;
    },

    login(username, password) {

        const user = this.db.users.find(u =>
            u.username === username && u.password === password
        );

        if (!user) return null;

        this.user = user;
        return user;
    },

    logout() {
        this.user = null;
    }
};

window.AUTH = AUTH;
