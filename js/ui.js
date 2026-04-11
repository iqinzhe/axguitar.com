const UI = {

    login() {
        return `
            <h2>Login</h2>
            <input id="u" placeholder="username">
            <input id="p" placeholder="password">
            <button onclick="APP.login()">Login</button>
        `;
    },

    dashboard(stats) {
        return `
            <h2>Dashboard</h2>
            <div>Total Orders: ${stats.totalOrders}</div>
            <div>Total Amount: ${stats.totalAmount}</div>
            <div>Active: ${stats.active}</div>

            <button onclick="APP.logout()">Logout</button>
        `;
    }
};

window.UI = UI;
