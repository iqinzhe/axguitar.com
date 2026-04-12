const Order = {

    create(db, data) {

        const order = {
            order_id: Date.now(),

            customer: {
                name: data.customer.name,
                ktp: data.customer.ktp,
                phone: data.customer.phone,
                address: data.customer.address
            },

            collateral_name: data.collateral_name,

            loan_amount: Number(data.loan_amount),
            interest_rate: Number(data.interest_rate),

            status: "active",
            due_date: data.due_date,

            officer: AUTH.user.username,
            created_at: new Date().toLocaleString(),

            notes: data.notes || ""
        };

        db.orders.push(order);

        return order;
    },

    delete(db, id) {
        db.orders = db.orders.filter(o => o.order_id !== id);
    }
};

window.Order = Order;
