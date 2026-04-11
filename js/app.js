const APP = {

    page: "login",
    user: null,

    // ========================
    // 初始化
    // ========================
    init() {

        console.log("🚀 APP INIT");

        if (window.AUTH) {
            AUTH.load();
            this.user = AUTH.user;
        }

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

        if (!AUTH) {
            alert("AUTH 未加载");
            return;
        }

        const ok = AUTH.login(u, p);

        if (!ok) {
            alert("登录失败");
            return;
        }

        this.user = AUTH.user;
        this.page = "dashboard";

        this.render();
    },

    // ========================
    // 打开订单
    // ========================
    openOrders() {

        console.log("OPEN ORDERS");

        this.page = "orders";
        this.render();
    },

    // ========================
    // 回首页
    // ========================
    openDashboard() {

        this.page = "dashboard";
        this.render();
    },

    // ========================
    // 创建订单
    // ========================
    createOrder() {

        if (!this.user) {
            alert("未登录");
            return;
        }

        const name = prompt("客户姓名");
        const phone = prompt("手机号");
        const amount = prompt("本金");
        const rate = prompt("利率");

        if (!name || !phone || !amount) {
            alert("数据不完整");
            return;
        }

        DB.loans.push({
            id: Date.now(),
            name,
            phone,
            principal: Number(amount),
            remaining: Number(amount),
            rate: Number(rate || 10),
            start: new Date().toISOString().slice(0, 10),
            lastInterest: new Date().toISOString().slice(0, 10),
            history: []
        });

        this.render();
    },

    // ========================
    // 渲染核心
    // ========================
    render() {

        const app = document.getElementById("app");

        if (!app) {
            console.error("NO APP ROOT");
            return;
        }

        // 🔐 未登录强制回登录页
        if (!AUTH?.user) {
            app.innerHTML = UI.login();
            return;
        }

        if (this.page === "dashboard") {
            app.innerHTML = UI.dashboard();
            return;
        }

        if (this.page === "orders") {
            app.innerHTML = UI.orders();
            return;
        }

        // fallback
        this.page = "dashboard";
        app.innerHTML = UI.dashboard();
    }
};

// ========================
// 🔥 全局挂载（关键）
// ========================
window.APP = APP;

// ========================
// 自动启动
// ========================
document.addEventListener("DOMContentLoaded", () => {
    APP.init();
});
