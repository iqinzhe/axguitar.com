async login(email, password) {
    console.log("AUTH LOGIN INPUT:", email, password);

    try {
        const result = await SUPABASE.login(email, password);

        console.log("SUPABASE LOGIN RESULT:", result);

        // 🔴 如果 Supabase 返回错误
        if (!result || result.error) {
            alert(result?.error?.message || "登录失败");
            return null;
        }

        // ✅ 加载用户资料
        await this.loadCurrentUser();

        console.log("CURRENT USER:", this.user);

        if (!this.user) {
            alert("登录成功但未获取用户资料（user_profiles问题）");
            return null;
        }

        return this.user;

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        alert(error.message || "系统错误");
        return null;
    }
}
