const Storage = {

    key: "jf_enterprise_db",

    load() {
        let db = JSON.parse(localStorage.getItem(this.key));

        if (!db) {
            db = {
                users: [
                    { username: "admin", password: "123", role: "admin" },
                    { username: "staff", password: "123", role: "staff" }
                ],
                orders: []
            };
        }

        return db;
    },

    save(db) {
        localStorage.setItem(this.key, JSON.stringify(db));
    }
};

window.Storage = Storage;
