const APP = {

    db: null,

    init() {

        this.db = Storage.load();

        AUTH.init(this.db);
        AUTH.load();

        this.render();
    },

    login() {

        const u = document.getElementById("u").value;
        const p = document.getElementById("p").value;

        if (!AUTH.login(u, p)) {
            alert("Login failed");
            return;
        }

        this.render();
    },

    logout() {
        AUTH.logout();
    },

    render() {

        const app = document.getElementById("app");

        Storage.save(this.db);

        if (!AUTH.user) {
            app.innerHTML = UI.login();
            return;
        }

        const stats = Dashboard.getStats(this.db);
        app.innerHTML = UI.dashboard(stats);
    }
};

window.APP = APP;

document.addEventListener("DOMContentLoaded", () => APP.init());

openOrderForm() {

    const app = document.getElementById("app");

    app.innerHTML = `
        <h2>New Order</h2>

        <table border="1" cellpadding="6">
            <tr>
                <td>Customer Name</td>
                <td><input id="cname"></td>
            </tr>

            <tr>
                <td>Phone</td>
                <td><input id="cphone"></td>
            </tr>

            <tr>
                <td>Amount</td>
                <td><input id="amount"></td>
            </tr>

            <tr>
                <td>Interest %</td>
                <td><input id="interest"></td>
            </tr>
        </table>

        <button onclick="APP.saveOrder()">Save</button>
        <button onclick="APP.render()">Back</button>
    `;
}
saveOrder() {

    const name = document.getElementById("cname").value;
    const phone = document.getElementById("cphone").value;
    const amount = Number(document.getElementById("amount").value);
    const interest = Number(document.getElementById("interest").value);

    if (!name || !phone || !amount) {
        alert("Fill all fields");
        return;
    }

    // 找或创建客户
    let customer = this.db.customers.find(c => c.phone === phone);

    if (!customer) {
        customer = {
            id: Date.now(),
            name,
            phone
        };
        this.db.customers.push(customer);
    }

    // 创建订单
    Order.create(this.db, {
        customerId: customer.id,
        amount,
        interest
    });

    Storage.save(this.db);

    alert("Order created");

    this.render();
}
