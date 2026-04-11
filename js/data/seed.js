const DB = {
    currentUser: null,

    users: [
        { id:1, username:"admin", password:"123456", role:"SUPER_ADMIN", name:"Owner" },
        { id:2, username:"staff", password:"123456", role:"OPERATOR", name:"Staff" }
    ],

    loans: [],
    logs: []
};
