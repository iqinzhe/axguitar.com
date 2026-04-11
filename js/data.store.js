const DB = {
    users: [
        { username: "admin", password: "123456", role: "admin" },
        { username: "staff", password: "123456", role: "staff" }
    ],

    loans: [
        {
            id: 1,
            name: "Budi",
            phone: "0812",
            principal: 5000000,
            remaining: 5000000,
            rate: 10,
            collateral: "Gold",
            start: "2025-01-01",
            lastInterest: "2025-01-01",
            staff: "staff",
            history: []
        }
    ]
};
