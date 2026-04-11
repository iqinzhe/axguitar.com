const PERMISSION = {

    // 获取当前角色
    role() {
        return AUTH.user?.role || null;
    },

    // 判断是否登录
    isLogin() {
        return !!AUTH.user;
    },

    // 页面权限
    canAccessPage(page) {

        const role = this.role();
        if (!role) return false;

        const pages = DB.roles?.[role]?.pages || [];

        return pages.includes(page);
    },

    // 操作权限（按钮/行为级）
    can(action) {

        const role = this.role();
        if (!role) return false;

        const actions = DB.roles?.[role]?.actions || [];

        // admin 默认全开
        if (role === "admin") return true;

        return actions.includes(action);
    },

    // 强制校验（页面守卫）
    requireAuth() {

        if (!this.isLogin()) {
            return false;
        }

        return true;
    },

    // UI权限控制（直接隐藏按钮）
    show(element, action) {

        if (!this.can(action)) {
            return "";
        }

        return element;
    }
};

window.PERMISSION = PERMISSION;
