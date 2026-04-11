const STORAGE_KEY = "JF_GADAI_V3_DB";

const Storage = {

    load() {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) return JSON.parse(data);

        const init = {
            users: [
                { username: "admin", password: "123456", role: "admin" },
                { username: "staff", password: "123456", role: "staff" }
            ],
            customers: [],
            orders: []
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
        return init;
    },

    save(db) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
};

window.Storage = Storage;
