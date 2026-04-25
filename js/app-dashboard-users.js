// app-dashboard-users.js - v1.1（修复saveCurrentPageState调用）

window.APP = window.APP || {};

const DashboardUsers = {

    showUserManagement: async function() {
        APP.currentPage = 'userManagement';
        APP.saveCurrentPageState();  // 修复：this → APP
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        
        try {
            var users = await SUPABASE.getAllUsers();
            var stores = await SUPABASE.getAllStores();
            
            var roleMap = {
                admin: lang === 'id' ? 'Administrator' : '管理员',
                store_manager: lang === 'id' ? 'Manajer Toko' : '店长',
                staff: lang === 'id' ? 'Staf' : '员工'
            };
            
            var rows = '';
            if (users.length === 0) {
                rows = '<tr><td colspan="5" class="text-center">' + t('no_data') + '<\/td><\/tr>';
            } else {
                for (var i = 0; i < users.length; i++) {
                    var u = users[i];
                    var storeName = u.stores ? u.stores.name : (u.store_id ? (lang === 'id' ? 'Toko tidak diketahui' : '未知门店') : (lang === 'id' ? 'Kantor Pusat' : '总部'));
                    
                    rows += '<tr>' +
                        '<td>' + Utils.escapeHtml(u.username) + '<\/td>' +
                        '<td>' + Utils.escapeHtml(u.name) + '<\/td>' +
                        '<td class="text-center">' + (roleMap[u.role] || u.role) + '<\/td>' +
                        '<td>' + Utils.escapeHtml(storeName) + '<\/td>' +
                        '<td class="text-center">' + Utils.formatDate(u.created_at) + '<\/td>' +
                    '<\/tr>';
                    
                    // 构建操作按钮
                    var actionButtons = '';
                    
                    if (AUTH.user && AUTH.user.role === 'admin' && u.id !== AUTH.user.id) {
                        // 角色切换下拉
                        actionButtons += '<select id="role_' + u.id + '" onchange="APP._saveUserRole(\'' + u.id + '\')" class="role-select">' +
                            '<option value="store_manager"' + (u.role === 'store_manager' ? ' selected' : '') + '>' + (lang === 'id' ? 'Manajer Toko' : '店长') + '<\/option>' +
                            '<option value="staff"' + (u.role === 'staff' ? ' selected' : '') + '>' + (lang === 'id' ? 'Staf' : '员工') + '<\/option>' +
                        '<\/select>';
                        
                        actionButtons += '<button onclick="APP.editUser(\'' + u.id + '\')" class="btn-small">✏️ ' + t('edit') + '</button>';
                        actionButtons += '<button onclick="APP.resetUserPassword(\'' + u.id + '\', \'' + Utils.escapeAttr(u.name) + '\')" class="btn-small warning">🔑 ' + (lang === 'id' ? 'Reset Password' : '重置密码') + '</button>';
                        actionButtons += '<button onclick="APP.deleteUser(\'' + u.id + '\')" class="btn-small danger">🗑️ ' + t('delete') + '</button>';
                    } else if (AUTH.user && u.id === AUTH.user.id) {
                        actionButtons += '<span style="color:var(--primary);font-weight:600;">👤 ' + (lang === 'id' ? 'Pengguna saat ini' : '当前用户') + '<\/span>';
                    } else {
                        actionButtons += '-';
                    }
                    
                    rows += Utils.renderActionRow({
                        colspan: 5,
                        buttonsHtml: actionButtons
                    });
                }
            }
            
            var storeOptions = '<option value="">' + (lang === 'id' ? 'Pilih toko' : '选择门店') + '<\/option>';
            for (var j = 0; j < stores.length; j++) {
                var s = stores[j];
                storeOptions += '<option value="' + s.id + '">' + Utils.escapeHtml(s.name) + ' (' + Utils.escapeHtml(s.code) + ')<\/option>';
            }
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>👥 ' + (lang === 'id' ? 'Manajemen Operator' : '操作员管理') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ' + t('print') + '</button>' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Daftar Operator' : '操作员列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table user-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th>' + (lang === 'id' ? 'Username' : '用户名') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Nama' : '姓名') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Role' : '角色') + '</th>' +
                                    '<th>' + (lang === 'id' ? 'Toko' : '门店') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Tanggal Dibuat' : '创建日期') + '</th>' +
                                '<\/tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '<\/table>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Tambah Operator Baru' : '新增操作员') + '</h3>' +
                    '<div class="form-grid">' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Username (Email)' : '用户名（邮箱）') + ' *</label>' +
                            '<input id="newUsername" placeholder="email@domain.com">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + t('password') + ' *</label>' +
                            '<input id="newPassword" type="password" placeholder="' + t('password') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Nama Lengkap' : '姓名') + ' *</label>' +
                            '<input id="newName" placeholder="' + (lang === 'id' ? 'Nama Lengkap' : '姓名') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Role' : '角色') + ' *</label>' +
                            '<select id="newRole">' +
                                '<option value="store_manager">' + (lang === 'id' ? 'Manajer Toko' : '店长') + '</option>' +
                                '<option value="staff">' + (lang === 'id' ? 'Staf' : '员工') + '</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Toko' : '门店') + '</label>' +
                            '<select id="newStoreId">' + storeOptions + '</select>' +
                            '<small>' + (lang === 'id' ? 'Kosongkan untuk akun pusat (admin tidak dapat ditambah)' : '留空表示总部账号（不可添加管理员）') + '</small>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP.addUser()" class="success">➕ ' + (lang === 'id' ? 'Tambah Operator' : '添加操作员') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<style>' +
                    '.user-table .role-select { padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 0.75rem; margin-right: 8px; }' +
                    '@media (max-width: 768px) { .user-table th, .user-table td { padding: 6px 4px; font-size: 0.7rem; } .user-table .role-select { font-size: 0.65rem; padding: 2px 4px; } }' +
                '</style>';
        } catch (error) {
            console.error("showUserManagement error:", error);
            alert(lang === 'id' ? 'Gagal memuat data pengguna' : '加载用户数据失败');
        }
    },

    addUser: async function() {
        var lang = Utils.lang;
        var username = document.getElementById("newUsername").value.trim();
        var password = document.getElementById("newPassword").value;
        var name = document.getElementById("newName").value.trim();
        var role = document.getElementById("newRole").value;
        var storeId = document.getElementById("newStoreId").value || null;
        
        if (!username || !password || !name) {
            alert(lang === 'id' ? 'Harap isi semua bidang yang wajib' : '请填写所有必填字段');
            return;
        }
        
        try {
            await AUTH.addUser(username, password, name, role, storeId);
            alert(lang === 'id' ? '✅ Operator berhasil ditambahkan' : '✅ 操作员添加成功');
            await this.showUserManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menambah operator: ' + error.message : '添加操作员失败：' + error.message);
        }
    },

    // ========== 新增：重置用户密码 ==========
    resetUserPassword: async function(userId, userName) {
        var lang = Utils.lang;
        
        if (!confirm(lang === 'id' 
            ? '⚠️ Reset password untuk operator "' + userName + '"?\n\nOperator harus login ulang dengan password baru.'
            : '⚠️ 重置操作员 "' + userName + '" 的密码？\n\n操作员需要使用新密码重新登录。')) {
            return;
        }
        
        var newPassword = prompt(lang === 'id' 
            ? 'Masukkan password baru untuk "' + userName + '":\n\n(Minimal 6 karakter)'
            : '请输入 "' + userName + '" 的新密码：\n\n(至少6个字符)');
        
        if (!newPassword || newPassword.length < 6) {
            alert(lang === 'id' ? 'Password minimal 6 karakter' : '密码至少6个字符');
            return;
        }
        
        var confirmPassword = prompt(lang === 'id' ? 'Konfirmasi password baru:' : '确认新密码：');
        
        if (newPassword !== confirmPassword) {
            alert(lang === 'id' ? 'Password tidak cocok' : '密码不匹配');
            return;
        }
        
        try {
            await AUTH.resetUserPassword(userId, newPassword);
            alert(lang === 'id' ? '✅ Password berhasil direset' : '✅ 密码已重置');
        } catch (error) {
            alert(lang === 'id' ? 'Gagal reset password: ' + error.message : '重置密码失败：' + error.message);
        }
    },

    deleteUser: async function(userId) {
        var lang = Utils.lang;
        if (!confirm(lang === 'id' ? 'Hapus operator ini?' : '删除此操作员？')) return;
        
        try {
            await AUTH.deleteUser(userId);
            alert(lang === 'id' ? '✅ Operator berhasil dihapus' : '✅ 操作员已删除');
            await this.showUserManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
        }
    },

    editUser: async function(userId) {
        var lang = Utils.lang;
        var newRole = prompt(lang === 'id' ? 'Masukkan role baru (store_manager/staff):' : '请输入新角色 (store_manager/staff):');
        if (!newRole) return;
        if (newRole !== 'store_manager' && newRole !== 'staff') {
            alert(lang === 'id' ? 'Role tidak valid' : '角色无效');
            return;
        }
        
        try {
            await AUTH.updateUser(userId, { role: newRole });
            alert(lang === 'id' ? '✅ Role berhasil diubah' : '✅ 角色已修改');
            await this.showUserManagement();
        } catch (error) {
            alert(lang === 'id' ? 'Gagal mengubah role: ' + error.message : '修改角色失败：' + error.message);
        }
    },

    _saveUserRole: async function(userId) {
        var lang = Utils.lang;
        var selectEl = document.getElementById("role_" + userId);
        if (!selectEl) return;
        var newRole = selectEl.value;
        
        try {
            await AUTH.updateUser(userId, { role: newRole });
            alert(lang === 'id' ? '✅ Role berhasil diubah' : '✅ 角色已修改');
        } catch (error) {
            alert(lang === 'id' ? 'Gagal mengubah role: ' + error.message : '修改角色失败：' + error.message);
        }
    }
};

Object.assign(window.APP, DashboardUsers);
