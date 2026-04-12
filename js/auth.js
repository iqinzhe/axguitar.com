const AUTH = {
    user: null,
    db: null,
    
    init(db) {
        this.db = db;
        // 检查是否有已登录用户
        const savedUser = sessionStorage.getItem('jf_current_user');
        if (savedUser) {
            try {
                this.user = JSON.parse(savedUser);
            } catch(e) {}
        }
    },
    
    login(username, password) {
        const user = this.db.users.find(u => u.username === username);
        
        if (!user || atob(user.password) !== password) {
            return null;
        }
        
        // 不保存密码到session
        this.user = {
            username: user.username,
            role: user.role,
            name: user.name
        };
        
        sessionStorage.setItem('jf_current_user', JSON.stringify(this.user));
        return this.user;
    },
    
    logout() {
        this.user = null;
        sessionStorage.removeItem('jf_current_user');
    },
    
    changePassword(username, oldPassword, newPassword) {
        const user = this.db.users.find(u => u.username === username);
        if (!user || atob(user.password) !== oldPassword) {
            return false;
        }
        user.password = btoa(newPassword);
        Storage.save(this.db);
        return true;
    },
    
    addUser(username, password, role, name) {
        if (this.db.users.find(u => u.username === username)) {
            return false;
        }
        this.db.users.push({
            username,
            password: btoa(password),
            role,
            name
        });
        Storage.save(this.db);
        return true;
    }
};

window.AUTH = AUTH;
