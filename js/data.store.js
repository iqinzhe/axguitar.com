const DB = {

    users: [
        {
            username: "admin",
            password: "123456",
            role: "admin"
        },
        {
            username: "staff",
            password: "123456",
            role: "staff"
        }
    ],

    roles: {

        admin: {
            pages: ["dashboard", "orders", "customers"],
            actions: ["create", "edit", "delete", "view"]
        },

        staff: {
            pages: ["dashboard", "orders"],
            actions: ["view", "create"]
        }
    },

    loans: []
};

window.DB = DB;
