const DB = {
    users: [
        { username: "admin", password: "123456", role: "admin" },
        { username: "staff", password: "123456", role: "staff" }
    ],

    loans: []
};

// demo数据（保证可运行）
DB.loans.push({
    id: 1,
    name: "Budi Santoso",
    phone: "081234",
    principal: 5000000,
    remaining: 5000000,
    rate: 10,
    start: "2025-01-01",
    lastInterest: "2025-01-01",
    staff: "staff",
    history: []
});
