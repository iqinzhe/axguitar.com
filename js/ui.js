dashboard(stats) {

    const role = AUTH.user?.role;

    return `
        <h2>Dashboard (${role})</h2>

        <div>Total Orders: ${stats.totalOrders}</div>
        <div>Total Amount: ${stats.totalAmount}</div>
        <div>Active: ${stats.active}</div>

        <hr>

        ${PERMISSION.can("order_create") ? `
            <button onclick="APP.openOrderForm()">➕ New Order</button>
        ` : ""}

        <button onclick="APP.logout()">Logout</button>
    `;
}
