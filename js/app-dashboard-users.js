// app-dashboard-users.js - v2.1 (JF 命名空间) - 支持外壳渲染，完整版
// 用户管理页面模块，挂载到 JF.UsersPage

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const UsersPage = {

        // ==================== 构建用户管理 HTML（纯内容） ====================
        async buildUserManagementHTML() {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);

            try {
                const users = await SUPABASE.getAllUsers();
                const stores = await SUPABASE.getAllStores();
                const roleMap = {
                    admin: lang === 'id' ? 'Administrator' : '管理员',
                    store_manager: lang === 'id' ? 'Manajer Toko' : '店长',
                    staff: lang === 'id' ? 'Staf' : '员工',
                };

                // 构建用户列表行
                let rows = '';
                if (users.length === 0) {
                    rows = `<tr><td colspan="5" class="text-center">${t('no_data')}</td></tr>`;
                } else {
                    for (const u of users) {
                        const storeName = u.stores ? u.stores.name : (u.store_id ? (lang === 'id' ? 'Toko tidak diketahui' : '未知门店') : (lang === 'id' ? 'Kantor Pusat' : '总部'));
                        let nameDisplay = Utils.escapeHtml(u.name);
                        if (u.ktp_number) nameDisplay += `<br><small style="color:var(--text-muted);">${lang === 'id' ? 'KTP: ' : '身份证: '}${Utils.escapeHtml(u.ktp_number)}</small>`;
                        if (u.phone) nameDisplay += `<br><small style="color:var(--text-muted);">📱 ${Utils.escapeHtml(u.phone)}</small>`;

                        rows += `<tr>
                            <td>${Utils.escapeHtml(u.username)}</td>
                            <td>${nameDisplay}</td>
                            <td class="text-center">${roleMap[u.role] || u.role}</td>
                            <td>${Utils.escapeHtml(storeName)}</td>
                            <td class="date-cell text-center">${Utils.formatDate(u.created_at)}</td>
                        </tr>`;

                        // 操作行
                        let actionButtons = '';
                        if (AUTH.user && AUTH.user.role === 'admin' && u.id !== AUTH.user.id) {
                            actionButtons += `<select id="role_${u.id}" onchange="APP._saveUserRole('${u.id}')" class="role-select">
                                <option value="store_manager"${u.role === 'store_manager' ? ' selected' : ''}>${lang === 'id' ? 'Manajer Toko' : '店长'}</option>
                                <option value="staff"${u.role === 'staff' ? ' selected' : ''}>${lang === 'id' ? 'Staf' : '员工'}</option>
                            </select>`;
                            actionButtons += `<button onclick="APP.editUser('${u.id}')" class="btn-small">✏️ ${t('edit')}</button>`;
                            actionButtons += `<button onclick="APP.resetUserPassword('${u.id}', '${Utils.escapeAttr(u.name)}')" class="btn-small warning">🔑 ${lang === 'id' ? 'Reset Password' : '重置密码'}</button>`;
                            actionButtons += `<button onclick="APP.deleteUser('${u.id}')" class="btn-small danger">🗑️ ${t('delete')}</button>`;
                        } else if (AUTH.user && u.id === AUTH.user.id) {
                            actionButtons += `<span style="color:var(--primary);font-weight:600;">👤 ${lang === 'id' ? 'Pengguna saat ini' : '当前用户'}</span>`;
                        } else {
                            actionButtons += '-';
                        }

                        rows += `<tr class="action-row">
                            <td class="action-label">${lang === 'id' ? 'Aksi' : '操作'}</td>
                            <td colspan="4"><div class="action-buttons">${actionButtons}</div></td>
                        </tr>`;
                    }
                }

                // 门店下拉选项
                const storeOptions = `<option value="">${lang === 'id' ? 'Pilih toko' : '选择门店'}</option>` +
                    stores.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.name)} (${Utils.escapeHtml(s.code)})</option>`).join('');

                const content = `
                    <div class="page-header">
                        <h2>👥 ${lang === 'id' ? 'Manajemen Peran' : '角色管理'}</h2>
                        <div class="header-actions">
                            <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                            <button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ${t('print')}</button>
                        </div>
                    </div>
                    <div class="card">
                        <h3>${lang === 'id' ? 'Daftar Peran' : '角色列表'}</h3>
                        <div class="table-container">
                            <table class="data-table user-table">
                                <thead>
                                    <tr>
                                        <th class="col-name">${lang === 'id' ? 'Akun Login' : '登录账户'}</th>
                                        <th class="col-name">${lang === 'id' ? 'Informasi Identitas' : '身份信息'}</th>
                                        <th class="col-status text-center">${lang === 'id' ? 'Role' : '角色'}</th>
                                        <th class="col-store">${lang === 'id' ? 'Toko' : '门店'}</th>
                                        <th class="col-date text-center">${lang === 'id' ? 'Tanggal Dibuat' : '创建日期'}</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="card">
                        <h3>${lang === 'id' ? 'Tambah Peran Baru' : '新增角色'}</h3>
                        <div class="form-grid form-grid-3">
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Akun Login (Email)' : '登录账户（邮箱）'} *</label>
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
                                <label>${lang === 'id' ? 'Nomor KTP' : '身份证号'}</label>
                                <input id="newKtp" placeholder="${lang === 'id' ? 'Nomor KTP' : '身份证号'}">
                            </div>
                            <div class="form-group">
                                <label>${lang === 'id' ? 'Telepon' : '电话'}</label>
                                <input id="newPhone" placeholder="${lang === 'id' ? 'Nomor Telepon' : '电话号码'}">
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
                                <div class="form-hint">${lang === 'id' ? 'Kosongkan untuk akun pusat (admin tidak dapat ditambah)' : '留空表示总部账号（不可添加管理员）'}</div>
                            </div>
                            <div class="form-actions">
                                <button onclick="APP.addUser()" class="success">➕ ${lang === 'id' ? 'Tambah Peran' : '添加角色'}</button>
                            </div>
                        </div>
                    </div>`;
                return content;
            } catch (error) {
                console.error("buildUserManagementHTML error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data pengguna' : '加载用户数据失败');
                return `<div class="card"><p>❌ ${Utils.t('loading_failed', { module: '用户管理' })}</p></div>`;
            }
        },

        // 供外壳调用的渲染函数
        async renderUserManagementHTML() {
            return await this.buildUserManagementHTML();
        },

        // 原有的 showUserManagement（兼容直接调用）
        async showUserManagement() {
            APP.currentPage = 'userManagement';
            APP.saveCurrentPageState();
            const contentHTML = await this.buildUserManagementHTML();
            document.getElementById("app").innerHTML = contentHTML;
        },

        // ==================== 用户操作（完整保留） ====================
        async addUser() {
            const lang = Utils.lang;
            const username = document.getElementById("newUsername").value.trim();
            const password = document.getElementById("newPassword").value;
            const name = document.getElementById("newName").value.trim();
            const ktp = document.getElementById("newKtp").value.trim();
            const phone = document.getElementById("newPhone").value.trim();
            const role = document.getElementById("newRole").value;
            const storeId = document.getElementById("newStoreId").value || null;

            if (!username || !password || !name) {
                Utils.toast.warning(lang === 'id' ? 'Harap isi semua bidang yang wajib' : '请填写所有必填字段');
                return;
            }

            try {
                await AUTH.addUser(username, password, name, role, storeId);
                // 更新 KTP 和电话
                if (ktp || phone) {
                    const client = SUPABASE.getClient();
                    const { data: userData } = await client.from('user_profiles').select('id').eq('username', username).single();
                    if (userData) {
                        const updates = {};
                        if (ktp) updates.ktp_number = ktp;
                        if (phone) updates.phone = phone;
                        await AUTH.updateUser(userData.id, updates);
                    }
                }
                Utils.toast.success(lang === 'id' ? '✅ Peran berhasil ditambahkan' : '✅ 角色添加成功');
                await UsersPage.showUserManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal menambah peran: ' + error.message : '添加角色失败：' + error.message);
            }
        },

        async editUser(userId) {
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            try {
                const client = SUPABASE.getClient();
                const { data: user, error } = await client.from('user_profiles').select('*, stores(*)').eq('id', userId).single();
                if (error) throw error;

                const stores = await SUPABASE.getAllStores();
                const storeOptions = `<option value="">${lang === 'id' ? 'Tidak ada (Kantor Pusat)' : '无（总部）'}</option>` +
                    stores.map(s => `<option value="${s.id}"${user.store_id === s.id ? ' selected' : ''}>${Utils.escapeHtml(s.name)} (${Utils.escapeHtml(s.code)})</option>`).join('');
                const roleOptions =
                    `<option value="store_manager"${user.role === 'store_manager' ? ' selected' : ''}>${lang === 'id' ? 'Manajer Toko' : '店长'}</option>` +
                    `<option value="staff"${user.role === 'staff' ? ' selected' : ''}>${lang === 'id' ? 'Staf' : '员工'}</option>`;

                const modal = document.createElement('div');
                modal.id = 'editUserModal';
                modal.className = 'modal-overlay';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width:500px;">
                        <h3>✏️ ${lang === 'id' ? 'Edit Peran' : '编辑角色'}</h3>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Akun Login (Email)' : '登录账户（邮箱）'}</label>
                            <input value="${Utils.escapeHtml(user.username || user.email || '')}" readonly>
                            <div class="form-hint">⚠️ ${lang === 'id' ? 'Akun login tidak dapat diubah' : '登录账户不可修改'}</div>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Nama Lengkap' : '姓名'} *</label>
                            <input id="editUserName" value="${Utils.escapeHtml(user.name || '')}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Nomor KTP' : '身份证号'}</label>
                            <input id="editUserKtp" value="${Utils.escapeHtml(user.ktp_number || '')}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Telepon' : '电话'}</label>
                            <input id="editUserPhone" value="${Utils.escapeHtml(user.phone || '')}">
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Role' : '角色'} *</label>
                            <select id="editUserRole">${roleOptions}</select>
                        </div>
                        <div class="form-group">
                            <label>${lang === 'id' ? 'Toko' : '门店'}</label>
                            <select id="editUserStoreId">${storeOptions}</select>
                        </div>
                        <div class="modal-actions">
                            <button onclick="APP._saveEditUser('${userId}')" class="success">💾 ${t('save')}</button>
                            <button onclick="document.getElementById('editUserModal').remove()" class="btn-back">✖ ${t('cancel')}</button>
                        </div>
                    </div>`;
                document.body.appendChild(modal);
            } catch (error) {
                console.error("editUser error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data peran' : '加载角色数据失败');
            }
        },

        async _saveEditUser(userId) {
            const lang = Utils.lang;
            const name = document.getElementById('editUserName')?.value.trim();
            const ktp = document.getElementById('editUserKtp')?.value.trim();
            const phone = document.getElementById('editUserPhone')?.value.trim();
            const role = document.getElementById('editUserRole')?.value;
            const storeId = document.getElementById('editUserStoreId')?.value || null;

            if (!name) {
                Utils.toast.warning(lang === 'id' ? 'Nama harus diisi' : '姓名必须填写');
                return;
            }
            try {
                const updates = { name, role, store_id: storeId };
                if (ktp) updates.ktp_number = ktp;
                if (phone) updates.phone = phone;
                await AUTH.updateUser(userId, updates);
                document.getElementById('editUserModal')?.remove();
                Utils.toast.success(lang === 'id' ? '✅ Data peran berhasil diperbarui' : '✅ 角色信息已更新');
                await UsersPage.showUserManagement();
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal menyimpan: ' + error.message : '保存失败：' + error.message);
            }
        },

        async resetUserPassword(userId, userName) {
            const lang = Utils.lang;
            const confirmMsg = lang === 'id'
                ? `⚠️ Reset password untuk "${userName}"?\n\nHarus login ulang dengan password baru.`
                : `⚠️ 重置 "${userName}" 的密码？\n\n需要使用新密码重新登录。`;
            const confirmed = await Utils.toast.confirm(confirmMsg);
            if (!confirmed) return;

            const newPassword = prompt(lang === 'id'
                ? `Masukkan password baru untuk "${userName}":\n\n(Minimal 6 karakter)`
                : `请输入 "${userName}" 的新密码：\n\n(至少6个字符)`);
            if (!newPassword || newPassword.length < 6) {
                Utils.toast.warning(lang === 'id' ? 'Password minimal 6 karakter' : '密码至少6个字符');
                return;
            }
            const confirmPassword = prompt(lang === 'id' ? 'Konfirmasi password baru:' : '确认新密码：');
            if (newPassword !== confirmPassword) {
                Utils.toast.warning(lang === 'id' ? 'Password tidak cocok' : '密码不匹配');
                return;
            }
            try {
                await AUTH.resetUserPassword(userId, newPassword);
                Utils.toast.success(lang === 'id' ? '✅ Password berhasil direset' : '✅ 密码已重置');
            } catch (error) {
                Utils.toast.error(lang === 'id' ? 'Gagal reset password: ' + error.message : '重置密码失败：' + error.message);
            }
        },

        async deleteUser(userId) {
            const msg = Utils.lang === 'id' ? 'Hapus peran ini?' : '删除此角色？';
            const confirmed = await Utils.toast.confirm(msg);
            if (!confirmed) return;
            try {
                await AUTH.deleteUser(userId);
                Utils.toast.success(Utils.lang === 'id' ? '✅ Peran berhasil dihapus' : '✅ 角色已删除');
                await UsersPage.showUserManagement();
            } catch (error) {
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal menghapus: ' + error.message : '删除失败：' + error.message);
            }
        },

        _saveUserRole(userId) {
            const selectEl = document.getElementById("role_" + userId);
            if (!selectEl) return;
            const newRole = selectEl.value;
            AUTH.updateUser(userId, { role: newRole })
                .then(() => Utils.toast.success(Utils.lang === 'id' ? '✅ Role berhasil diubah' : '✅ 角色已修改'))
                .catch(error => Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengubah role: ' + error.message : '修改角色失败：' + error.message));
        }
    };

    // 挂载到命名空间
    JF.UsersPage = UsersPage;

    // 向下兼容 APP 方法
    if (window.APP) {
        window.APP.showUserManagement = UsersPage.showUserManagement.bind(UsersPage);
        window.APP.addUser = UsersPage.addUser.bind(UsersPage);
        window.APP.editUser = UsersPage.editUser.bind(UsersPage);
        window.APP._saveEditUser = UsersPage._saveEditUser.bind(UsersPage);
        window.APP.resetUserPassword = UsersPage.resetUserPassword.bind(UsersPage);
        window.APP.deleteUser = UsersPage.deleteUser.bind(UsersPage);
        window.APP._saveUserRole = UsersPage._saveUserRole.bind(UsersPage);
    } else {
        window.APP = {
            showUserManagement: UsersPage.showUserManagement.bind(UsersPage),
            addUser: UsersPage.addUser.bind(UsersPage),
            editUser: UsersPage.editUser.bind(UsersPage),
            _saveEditUser: UsersPage._saveEditUser.bind(UsersPage),
            resetUserPassword: UsersPage.resetUserPassword.bind(UsersPage),
            deleteUser: UsersPage.deleteUser.bind(UsersPage),
            _saveUserRole: UsersPage._saveUserRole.bind(UsersPage),
        };
    }

    console.log('✅ JF.UsersPage v2.1 初始化完成（支持外壳渲染，完整版）');
})();
