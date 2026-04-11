if (!AUTH.guard()) {
    this.page = "login";
    this.render();
    return;
}
const APP = {

    page: "login",

    // ========================
    // 初始化
    // ========================
    init() {
        console.log("APP INIT OK");

        AUTH.load();

        // 🔥 强制首次渲染
        this.render();
    },

    // ========================
    // 登录
    // ========================
    login() {

        const u = document.getElementById("u")?.value;
        const p = document.getElementById("p")?.value;

        if (!u || !p) {
            alert("请输入账号密码");
            return;
        }

        const ok = AUTH.login(u, p);

        if (!ok) {
            alert("登录失败");
            return;
        }

        this.page = "dashboard";
        this.render();
    },

    // ========================
    // 页面切换：订单
    // ========================
    openOrders() {

        console.log("OPEN ORDERS CLICKED");

        this.page = "orders";
        this.render();
    },

    // ========================
    // 返回首页
    // ========================
    openDashboard() {

        this.page = "dashboard";
        this.render();
    },

    // ========================
    // 创建订单
    // ========================
    createOrder() {

        const name = prompt("Name");
        const phone = prompt("Phone");
        const amount = parseFloat(prompt("Principal"));
        const rate = parseFloat(prompt("Rate (%)"));
        const collateral = prompt("Collateral");

        if (!name || !phone || !amount) {
            alert("数据不完整");
            return;
        }

        DB.loans.push({
            id: Date.now(),
            name,
            phone,
            principal: amount,
            remaining: amount,
            rate: rate || 10,
            collateral: collateral || "-",
            start: Utils.today(),
            lastInterest: Utils.today(),
            staff: AUTH.user?.username || "system",
            history: []
        });

        this.render();
    },

    // ========================
    // 付利息
    // ========================
    payInterest(id) {

        PaymentService.payInterest(id);
        this.render();
    },

    // ========================
    // 还本金
    // ========================
    payPrincipal(id) {

        PaymentService.payPrincipal(id);
        this.render();
    },

    // ========================
    // 核心渲染器
    // ========================
    render() {

        const app = document.getElementById("app");

        if (!app) {
            console.error("NO #app ELEMENT FOUND");
            return;
        }

        console.log("RENDER PAGE =>", this.page);

        // ========================
        // 未登录
        // ========================
        if (!AUTH.user) {
            app.innerHTML = UI.login();
            return;
        }

        // ========================
        // dashboard
        // ========================
        if (this.page === "dashboard") {
            app.innerHTML = UI.dashboard();
            return;
        }

        // ========================
        // orders
        // ========================
        if (this.page === "orders") {
            app.innerHTML = UI.orders();
            return;
        }

        // ========================
        // fallback（防白屏）
        // ========================
        console.warn("UNKNOWN PAGE, fallback dashboard");
        app.innerHTML = UI.dashboard();
    }
};

// 🔥 关键：挂到 window（解决 onclick 失效）
window.APP = APP;
