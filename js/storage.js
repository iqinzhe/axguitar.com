const DB = {
    loans: [],
    logs: [],
    currentUser: {
        username: "admin",
        role: "admin"
    }
};

// 初始化示例数据
(function init() {

    DB.loans.push({
        id: 1,
        name: "Budi Santoso",
        phone: "08123456789",
        principal: 5000000,
        remainingPrincipal: 5000000,
        interestRate: 10,
        startDate: "2025-01-01",
        lastInterestDate: "2025-01-01",
        collateral: "Emas",
        paymentHistory: []
    });

    DB.loans.push({
        id: 2,
        name: "Siti Aminah",
        phone: "085712345678",
        principal: 3000000,
        remainingPrincipal: 2500000,
        interestRate: 12,
        startDate: "2025-02-01",
        lastInterestDate: "2025-02-01",
        collateral: "HP",
        paymentHistory: []
    });
})();
