const Order = {

    create(db, data) {

        const id = Date.now();

        db.orders.push({
            id,
            customerId: data.customerId,
            amount: data.amount,
            interest: data.interest,
            status: "active",
            createdAt: new Date().toISOString()
        });

        return id;
    },

    delete(db, id) {
        db.orders = db.orders.filter(o => o.id !== id);
    },

    list(db) {
        return db.orders;
    }
};

window.Order = Order;
