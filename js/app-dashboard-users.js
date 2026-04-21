// app-dashboard-users.js - v1.1（统一表格样式）

window.APP = window.APP || {};

const DashboardUsers = {

    showUserManagement: async function() {
        this.currentPage = 'userManagement';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);
        
        try {
            const users = await SUPABASE.getAllUsers();
            const stores = await SUPABASE.getAllStores();
            
            var roleMap = {
                admin: lang === 'id' ? 'Administrator' : '管理员',
                store_manager: lang === 'id' ? 'Manajer Toko' : '店长',
                staff: lang === 'id' ? 'Staf' : '员工'
            };
            
            var rows = '';
            if (users.length === 0) {
                rows = `<tr><td colspan="6" class="text-center">${t('no_data')}<\/td><\/tr>`;
            } else {
                for (var u of users) {
                    var storeName = u.stores?.name || (u.store_id ? (lang === 'id' ? 'Toko tidak diketahui' : '未知门店') : (lang === 'id' ? 'Kantor Pusat' : '总部'));
                    rows += `<tr>
                        <td>${Utils.escapeHtml(u.username)}<\/td>
                        <td>${Utils.escapeHtml(u.name)}<\/td>
                        <td class="text-center">${roleMap[u.role] || u.role}<\/td>
                        <td>${Utils.escapeHtml(storeName)}<\/td>
                        <td class="text-center">${Utils.formatDate(u.created_at)}<\/td>
                        <td class="action-cell">
                            ${AUTH.user?.role === 'admin' && u.id !== AUTH.user?.id ? `
                                <select id="role_${u.id}" onchange="APP._saveUserRole('${u.id}')" class="role-select">
                                    <option value="store_manager" ${u.role === 'store_manager' ? 'selected' : ''}>${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>${lang === 'id' ? 'Staf' : '员工'}</option>
                                </select>
                                <button onclick="APP.deleteUser('${u.id}')" class="btn-small danger">🗑️ ${t('delete')}</button>
                            ` : (u.id === AUTH.user?.id ? (lang === 'id' ? '👤 当前用户' : '👤 当前用户') : '-')}
                        <\/td>
                    <\/tr>`;
                }
            }
            
            var storeOptions = '<option value="">' + (lang === 'id' ? 'Pilih toko' : '选择门店') + '<\/option>';
            for (var s of stores) {
                storeOptions += `<option value="${s.id}">${Utils.escapeHtml(s.name)} (${Utils.escapeHtml(s.code)})<\/option>`;
            }
            
            document.getElementById("app").innerHTML = `
                <div class="page-header">
                    <h2>👥 ${lang === 'id' ? 'Manajemen Operator' : '操作员管理'}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print print-btn">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Daftar Operator' : '操作员列表'}</h3>
                    <div class="table-container">
                        <table class="data-table user-table">
                            <thead>
                                <tr>
                                    <th>${lang === 'id' ? 'Username' : '用户名'}</th>
                                    <th>${lang === 'id' ? 'Nama' : '姓名'}</th>
                                    <th class="text-center">${lang === 'id' ? 'Role' : '角色'}</th>
                                    <th>${lang === 'id' ? 'Toko' : '门店'}</th>
                                    <th class="text-center">${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}</th>
                                    <th class="text-center">${lang === 'id' ? 'Aksi' : '操作'}</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                </div>
                
                <div class="card">
                    <h3>${lang === 'id' ? 'Tambah Operator Baru' : '新增操作员'}</h3>
                    <div class="form-grid">
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Username (Email)' : '用户名（邮箱）'} *</label>
                            <input id="newUsername" placeholder="email@domain.com">
                        </div>
                        <div class="form-group">
                            <label>${t('password')} *</label>
                            <input id="newPassword" type="password" placeholder="${t('password')}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label>
                            <input id="newName" placeholder="${lang === 'id' ? 'Nama Lengkap' : '姓名'}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Role' : '角色'} *</label>
                            <select id="newRole">
                                <option value="store_manager">${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                                <option value="staff">${lang === 'id' ? 'Staf' : '员工'}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Toko' : '门店'}</label>
                            <select id="newStoreId">${storeOptions}</select>
                            <small>${lang === 'id' ? 'Kosongkan untuk akun pusat (admin tidak dapat ditambah)' : '留空表示总部账号（不可添加管理员）'}</small>
                        </div>
                        <div class="form-actions">
                            <button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Operator' : '添加操作员'}</button>
                        </div>
                    </div>
                </div>
                
                <style>
                    .user-table .role-select {
                        padding: 4px 8px;
                        border-radius: 6px;
                        border: 1px solid var(--gray-300);
                        font-size: 0.75rem;
                        margin-right: 8px;
                    }
                    @media (max-width: 768px) {
                        .user-table th, .user-table td {
                            padding: 6px 4px;
                            font-size: 0.7rem;
                        }
                        .user-table .role-select {
                            font-size: 0.65rem;
                            padding: 2px 4px;
                        }
                        .action-cell {
                            flex-direction: column;
                            gap: 4px;
                        }
                        .action-cell .btn-small {
                            width: 100%;
                        }
                    }
                </style>`;
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
        var selectEl = document.getElementById(`role_${userId}`);
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

for (var key in DashboardUsers) {
    if (typeof DashboardUsers[key] === 'function') {
        window.APP[key] = DashboardUsers[key];
    }
}

console.log('✅ app-dashboard-users.js v1.1 已加载 - 统一表格样式');
