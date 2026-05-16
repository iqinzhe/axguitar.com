// app-blacklist.js - v2.0 (JF 命名空间) 

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const BlacklistPage = {

        // ==================== 辅助函数 ====================
        sanitizeInput(str) {
            if (!str) return '';
            return String(str).replace(/[^\p{L}\p{N}\s\-\.]/gu, '');
        },

        escapePostgRESTValue(str) {
            if (!str) return '';
            return String(str).replace(/[,()\.\[\]]/g, '\\$&');
        },

        // ==================== 黑名单检查 ====================
        async isBlacklisted(customerId) {
            try {
                return await SUPABASE.checkBlacklist(customerId);
            } catch (error) {
                console.error("检查黑名单失败:", error);
                return { isBlacklisted: false };
            }
        },

        // ==================== 加入黑名单 ====================
        async addToBlacklist(customerId, reason) {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();

            if (!reason || reason.trim() === '') {
                throw new Error(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
            }

            // 权限检查：门店操作员只能拉黑自己门店的客户
            if (!PERMISSION.isAdmin()) {
                const client = SUPABASE.getClient();
                const { data: customer, error: customerError } = await client
                    .from('customers')
                    .select('store_id')
                    .eq('id', customerId)
                    .single();

                if (customerError) {
                    console.error("获取客户信息失败:", customerError);
                    throw new Error(lang === 'id' ? 'Gagal mendapatkan data nasabah' : '获取客户信息失败');
                }

                const customerStoreId = customer.store_id ? String(customer.store_id) : null;
                const userStoreId = profile?.store_id ? String(profile?.store_id) : null;

                if (customerStoreId !== userStoreId) {
                    throw new Error(lang === 'id' ? 'Anda hanya dapat blacklist nasabah dari toko sendiri' : '只能拉黑本门店的客户');
                }
            }

            try {
                return await SUPABASE.addToBlacklist(customerId, reason, profile.id);
            } catch (error) {
                console.error("添加黑名单失败:", error);
                throw error;
            }
        },

        // ==================== 解除黑名单 ====================
        async removeFromBlacklist(customerId) {
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();

            if (!PERMISSION.isAdmin()) {
                throw new Error(lang === 'id' ? 'Hanya administrator yang dapat menghapus blacklist' : '只有管理员可以解除黑名单');
            }

            try {
                return await SUPABASE.removeFromBlacklist(customerId);
            } catch (error) {
                console.error("解除黑名单失败:", error);
                throw error;
            }
        },

        // ==================== 获取黑名单列表 ====================
        async getBlacklist() {
            const profile = await SUPABASE.getCurrentProfile();
            return await SUPABASE.getBlacklist(profile?.store_id, profile);
        },

        // ==================== 重复客户检查 ====================
        async checkDuplicateCustomer(name, ktpNumber, phone, excludeCustomerId = null) {
            return await SUPABASE.checkDuplicateCustomer(name, ktpNumber, phone, excludeCustomerId);
        },

        // ==================== 显示黑名单页面 ====================
        async showBlacklist() {
            APP.currentPage = 'blacklist';
            APP.saveCurrentPageState();

            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();

            try {
                const blacklist = await this.getBlacklist();
                const totalCols = isAdmin ? 7 : 6;

                let headerHtml = '<tr>' +
                    '<th class="col-id">' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                    '<th class="col-name">' + t('customer_name') + '</th>' +
                    '<th class="col-name">' + (lang === 'id' ? 'Pekerjaan' : '职业') + '</th>' +
                    '<th class="col-phone">' + t('phone') + '</th>' +
                    '<th>' + (lang === 'id' ? 'Alasan' : '原因') + '</th>' +
                    '<th class="col-date">' + (lang === 'id' ? 'Tanggal Blacklist' : '拉黑日期') + '</th>';

                if (isAdmin) {
                    headerHtml += '<th class="col-action">' + (lang === 'id' ? 'Aksi' : '操作') + '</th>';
                }
                headerHtml += '</tr>';

                let rows = '';
                if (!blacklist || blacklist.length === 0) {
                    rows = '<tr><td colspan="' + totalCols + '" class="text-center">' + t('no_data') + '</td></tr>';
                } else {
                    for (const item of blacklist) {
                        const customer = item.customers;
                        if (!customer) continue;

                        const occupationDisplay = Utils.escapeHtml(customer.occupation || '-');

                        rows += '<tr>' +
                            '<td class="col-id">' + Utils.escapeHtml(customer.customer_id || '-') + '</td>' +
                            '<td class="col-name">' + Utils.escapeHtml(customer.name) + '</td>' +
                            '<td class="col-name">' + occupationDisplay + '</td>' +
                            '<td class="col-phone">' + Utils.escapeHtml(customer.phone || '-') + '</td>' +
                            '<td class="desc-cell">' + Utils.escapeHtml(item.reason) + '</td>' +
                            '<td class="col-date">' + Utils.formatDate(item.blacklisted_at) + '</td>';

                        if (isAdmin) {
                            rows += '<td class="text-center"><button onclick="APP.removeFromBlacklist(\'' + Utils.escapeAttr(customer.id) + '\')" class="btn btn--sm btn--danger">🚫 ' + (lang === 'id' ? 'Hapus' : '解除') + '</button></td>';
                        }

                        rows += '</tr>';
                    }
                }

                document.getElementById("app").innerHTML = '' +
                    '<div class="page-header">' +
                        '<h2>🚫 ' + (lang === 'id' ? 'Daftar Hitam Nasabah' : '客户黑名单') + '</h2>' +
                        '<div class="header-actions">' +
                            '<button onclick="APP.printCurrentPage()" class="btn btn--outline no-print">🖨️ ' + t('print') + '</button>' +
                            '<button onclick="APP.goBack()" class="btn btn--outline no-print">↩️ ' + t('back') + '</button>' +
                        '</div>' +
                    '</div>' +

                    '<div class="info-bar warning">' +
                        '<span class="info-bar-icon">⚠️</span>' +
                        '<div class="info-bar-content">' +
                            '<strong>' + (lang === 'id' ? 'Informasi:' : '提示：') + '</strong> ' +
                            (lang === 'id'
                                ? 'Nasabah yang di-blacklist tidak dapat membuat pesanan baru. Hanya administrator yang dapat menghapus dari daftar hitam.'
                                : '被拉黑的客户无法创建新订单。只有管理员可以解除黑名单。') +
                        '</div>' +
                    '</div>' +

                    '<div class="card">' +
                        '<h3>📋 ' + (lang === 'id' ? 'Daftar Nasabah Blacklist' : '黑名单客户列表') + '</h3>' +
                        '<div class="table-container">' +
                            '<table class="data-table">' +
                                '<thead>' + headerHtml + '</thead>' +
                                '<tbody id="blacklistTableBody"></tbody>' +
                            '</table>' +
                        '</div>' +
                        '<div id="blacklistTablePaginator"></div>' +
                    '</div>';

                // [分页] 黑名单前端分页
                var _blItems = blacklist;
                var _blIsAdmin = isAdmin;
                var _blLang = lang;
                setTimeout(function() {
                    if (window.JF && JF.Pagination && _blItems) {
                        JF.Pagination.render('blacklistTableBody', _blItems, 1, 15, function(item) {
                            var iname = Utils.escapeHtml(item.customer_name || '-');
                            var reason = Utils.escapeHtml(item.reason || '-');
                            var addedDate = Utils.formatDate(item.added_at || item.created_at || '');
                            var addedBy = Utils.escapeHtml(item.added_by_name || '-');
                            var storeName = _blIsAdmin ? Utils.escapeHtml(item.store_name || item.store_id || '-') : '';
                            var removeBtn = (_blIsAdmin || (window.PERMISSION && PERMISSION.isStoreManager()))
                                ? '<button onclick="APP.removeFromBlacklist(\'' + item.id + '\')" class="btn btn--danger btn--sm">🗑️ ' + (_blLang === 'id' ? 'Hapus' : '移除') + '</button>'
                                : '';
                            return '<tr>' +
                                '<td>' + iname + '</td>' +
                                '<td>' + reason + '</td>' +
                                '<td class="text-center">' + addedDate + '</td>' +
                                '<td class="text-center">' + addedBy + '</td>' +
                                (_blIsAdmin ? '<td class="text-center">' + storeName + '</td>' : '') +
                                '<td class="text-center">' + removeBtn + '</td>' +
                                '</tr>';
                        }, {
                            paginatorId: 'blacklistTablePaginator',
                            emptyHtml: '<tr><td colspan="99" style="text-align:center;padding:24px;color:var(--text-muted);">' + (_blLang === 'id' ? 'Daftar hitam kosong' : '黑名单为空') + '</td></tr>'
                        });
                    }
                }, 0);

            } catch (error) {
                console.error("showBlacklist error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat data blacklist: ' + error.message : '加载黑名单失败：' + error.message);
            }
        }
    };

    // 挂载到命名空间
    JF.BlacklistPage = BlacklistPage;

    // 向下兼容：将方法挂载到 APP
    if (window.APP) {
        window.APP.showBlacklist = BlacklistPage.showBlacklist.bind(BlacklistPage);
        window.APP.addToBlacklist = BlacklistPage.addToBlacklist.bind(BlacklistPage);
        window.APP.removeFromBlacklist = BlacklistPage.removeFromBlacklist.bind(BlacklistPage);
        window.APP.isBlacklisted = BlacklistPage.isBlacklisted.bind(BlacklistPage);
        window.APP.getBlacklist = BlacklistPage.getBlacklist.bind(BlacklistPage);
        window.APP.checkDuplicateCustomer = BlacklistPage.checkDuplicateCustomer.bind(BlacklistPage);
    } else {
        window.APP = {
            showBlacklist: BlacklistPage.showBlacklist.bind(BlacklistPage),
            addToBlacklist: BlacklistPage.addToBlacklist.bind(BlacklistPage),
            removeFromBlacklist: BlacklistPage.removeFromBlacklist.bind(BlacklistPage),
            isBlacklisted: BlacklistPage.isBlacklisted.bind(BlacklistPage),
            getBlacklist: BlacklistPage.getBlacklist.bind(BlacklistPage),
            checkDuplicateCustomer: BlacklistPage.checkDuplicateCustomer.bind(BlacklistPage),
        };
    }

})();
