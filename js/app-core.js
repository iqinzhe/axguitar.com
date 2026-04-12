const Order = {
    create(db, data) { ... },
    recordAdminFee(db, orderId) { ... },
    recordInterestPayment(db, orderId, months) { ... },
    recordPrincipalPayment(db, orderId, amount) { ... },
    getReport(db) { ... },
    delete(db, orderId) { ... },
    update(db, orderId, updates) { ... }
};
