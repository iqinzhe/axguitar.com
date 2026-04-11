const AUTH = {

    user: null,

    // =========================
    // 初始化加载 + 门禁检查
    // =========================
    load() {

        const raw = localStorage.getItem("user");

        if (!raw) {
            this.user = null;
            return;
        }

        try {
            const parsed = JSON.parse(raw);

            // 🔥 基础合法性检查
            if (!parsed.username || !parsed.role) {
                throw new Error("invalid user");
            }

            this.user = parsed;

        } catch (e) {
            console.warn("AUTH INVALID → CLEAR");

            this.user = null;
            localStorage.removeItem("user");
        }
    },

    // =========================
    // 登录
    // =========================
    login(username, password) {

        const found = DB.users.find(u =>
            u.username === username &&
            u.password === password
        );

        if (!found) return false;

        // 🔥 企业级 session（带时间戳）
        const session = {
            username: found.username,
            role: found.role,
            loginTime: Date.now()
        };

        this.user = session;
        localStorage.setItem("user", JSON.stringify(session));

        return true;
    },

    // =========================
    // 登出
    // =========================
    logout() {

        this.user = null;
        localStorage.removeItem("user");

        // 🔥 强制回登录页刷新
        location.reload();
    },

    // =========================
    // 企业级门禁检查（核心）
    // =========================
    guard() {

        // ❌ 没登录直接拦截
        if (!this.user) return false;

        // 🔥 session 过期（24小时）
        const now = Date.now();
        const max = 24 * 60 * 60 * 1000;

        if (now - this.user.loginTime > max) {
            console.warn("SESSION EXPIRED");

            this.logout();
            return false;
        }

        return true;
    },

    // =========================
    // 强制验证（给 APP 用）
    // =========================
    requireAuth() {

        if (!this.guard()) {
            return false;
        }

        return true;
    }
};

// 🔥 必须挂载全局（解决访问问题）
window.AUTH = AUTH;
