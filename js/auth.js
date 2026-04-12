const AUTH = {
    user: null,
    db: null,
    
    init(db) {
        this.db = db;
        const savedUser = sessionStorage.getItem('jf_current_user');
        if (savedUser) {
            try {
                this.user = JSON.parse(savedUser);
            } catch(e) {}
        }
    },
    
    login(username, password) {
        const user = this.db.users.find(u => u.username === username);
        
        if (!user) {
            console.log('User not found:', username);
            return null;
        }
        
        // 解码密码并比对
        let storedPassword;
        try {
            storedPassword = atob(user.password);
        } catch(e) {
            // 如果密码不是 base64 编码的（旧数据），直接比对
            storedPassword = user.password;
        }
        
        if (storedPassword !== password) {
            console.log('Password incorrect for:', username);
            return null;
        }
        
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
        if (!user) return false;
        
        let storedPassword;
        try {
            storedPassword = atob(user.password);
        } catch(e) {
            storedPassword = user.password;
        }
        
        if (storedPassword !== oldPassword) return false;
        
        user.password = btoa(newPassword);
        Storage.save(this.db);
        return true;
    },
    
    addUser(username, password, role, name) {
        if (this.db.users.find(u => u.username === username)) {
            return false;
        }
        this.db.users.push({
            username: username,
            password: btoa(password),
            role: role,
            name: name
        });
        Storage.save(this.db);
        return true;
    }
};

window.AUTH = AUTH;
