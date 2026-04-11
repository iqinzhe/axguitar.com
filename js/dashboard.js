const Dashboard = {

    getStats(db) {

        const totalOrders = db.orders.length;

        const totalAmount = db.orders.reduce((sum, o) =>
            sum + Number(o.amount), 0
        );

        const active = db.orders.filter(o => o.status === "active").length;

        return {
            totalOrders,
            totalAmount,
            active
        };
    }
};

window.Dashboard = Dashboard;
