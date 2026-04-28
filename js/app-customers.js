// app-customers.js - v1.0 
window.APP = window.APP || {};

const CustomersModule = {

    showCustomers: async function() {
        APP.currentPage = 'customers';
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var isAdmin = AUTH.isAdmin();

        try {
            const customers = await SUPABASE.getCustomers();
            
            const stores = await SUPABASE.getAllStores();
            const storeMap = {};
            for (var i = 0; i < stores.length; i++) {
                storeMap[stores[i].id] = stores[i].name;
            }
            
            // 列数：ID,姓名,身份证,手机号,职业,创建订单按钮,操作 = 7列
            var totalCols = 7;
            
            var rows = '';
            if (!customers || customers.length === 0) {
                rows = '<tr><td colspan="' + totalCols + '" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var i = 0; i < customers.length; i++) {
                    var c = customers[i];
                    var customerId = Utils.escapeHtml(c.customer_id || '-');
                    var name = Utils.escapeHtml(c.name);
                    var phone = Utils.escapeHtml(c.phone || '-');
                    var ktpNumber = Utils.escapeHtml(c.ktp_number || '-');
                    var occupation = Utils.escapeHtml(c.occupation || '-');
                    
                    rows += '<tr class="data-row">' +
                        '<td class="col-id">' + customerId + '</td>' +
                        '<td class="col-name">' + name + '</td>' +
                        '<td class="col-phone">' + phone + '</td>' +
                        '<td class="col-ktp">' + ktpNumber + '</td>' +
                        '<td class="col-occupation">' + occupation + '</td>' +
                        '<td class="text-center">' +
                            '<button onclick="APP.createOrderForCustomer(\'' + Utils.escapeAttr(c.id) + '\')" class="btn-small success" style="background:var(--success-dark);color:white;white-space:nowrap;">➕ ' + (lang === 'id' ? 'Buat Pesanan' : '创建订单') + '</button>' +
                        '</td>' +
                        '<td class="text-center">' +
                            '<button onclick="APP.showCustomerDetailCard(\'' + Utils.escapeAttr(c.id) + '\')" class="btn-small">📋 ' + (lang === 'id' ? 'Detail' : '详情') + '</button>' +
                        '</td>' +
                    '</tr>';
                }
            }

            var addCustomerCardHtml = '';
            if (!isAdmin) {
                addCustomerCardHtml = '' +
                '<div class="card">' +
                    '<h3>➕ ' + (lang === 'id' ? 'Tambah Nasabah Baru' : '新增客户') + '</h3>' +
                    '<div class="form-grid order-first-row">' +
                        '<div class="form-group">' +
                            '<label>' + t('customer_name') + ' *</label>' +
                            '<input type="text" id="customerName" placeholder="' + t('customer_name') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + t('phone') + ' *</label>' +
                            '<input type="text" id="customerPhone" placeholder="' + t('phone') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + t('ktp_number') + '</label>' +
                            '<input type="text" id="customerKtp" placeholder="' + t('ktp_number') + '">' +
                        '</div>' +
                        '<div class="form-group">' +
                            '<label>' + (lang === 'id' ? 'Pekerjaan' : '职业') + '</label>' +
                            '<input type="text" id="customerOccupation" placeholder="' + (lang === 'id' ? 'Contoh: PNS, Karyawan Swasta' : '例如: 公务员, 企业员工') + '">' +
                        '</div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + '</label>' +
                            '<textarea id="customerKtpAddress" rows="2" placeholder="' + (lang === 'id' ? 'Alamat sesuai KTP' : 'KTP证上的地址') + '"></textarea>' +
                        '</div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + '</label>' +
                            '<div class="address-option">' +
                                '<label><input type="radio" name="livingAddrOpt" value="same" checked onchange="APP.toggleLivingAddress(this.value)"> ' + (lang === 'id' ? 'Sama dengan KTP' : '同上KTP') + '</label>' +
                                '<label><input type="radio" name="livingAddrOpt" value="different" onchange="APP.toggleLivingAddress(this.value)"> ' + (lang === 'id' ? 'Berbeda (isi manual)' : '不同（手动填写）') + '</label>' +
                            '</div>' +
                            '<textarea id="customerLivingAddress" rows="2" placeholder="' + (lang === 'id' ? 'Alamat tinggal sebenarnya' : '实际居住地址') + '" style="display:none;margin-top:8px;"></textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP.addCustomer()" class="success" id="addCustomerBtn">💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }

            // 添加内联样式优化表格
            var inlineStyles = '' +
                '<style>' +
                    '/* 客户列表表格 - 电脑端优化 */' +
                    '@media (min-width: 769px) {' +
                        '.customer-list-table {' +
                            'table-layout: fixed;' +
                            'width: 100%;' +
                        '}' +
                        '.customer-list-table .col-id { width: 10%; }' +
                        '.customer-list-table .col-name { width: 12%; padding-left: 12px; }' +
                        '.customer-list-table .col-ktp { width: 14%; }' +
                        '.customer-list-table .col-phone { width: 12%; white-space: nowrap; }' +
                        '.customer-list-table .col-occupation { width: 12%; }' +
                        '.customer-list-table td:nth-child(6) { width: 13%; }' +
                        '.customer-list-table td:nth-child(7) { width: 8%; }' +
                        '.customer-list-table .col-address-ktp,' +
                        '.customer-list-table .col-address-living,' +
                        '.customer-list-table .col-store,' +
                        '.customer-list-table .date-cell {' +
                            'display: none;' +
                        '}' +
                    '}' +
                    '/* 手机端保持原有样式 */' +
                    '@media (max-width: 768px) {' +
                        '.customer-list-table .col-address-ktp,' +
                        '.customer-list-table .col-address-living {' +
                            'display: table-cell;' +
                        '}' +
                    '}' +
                    '/* 详情卡片样式 */' +
                    '.customer-detail-card .order-stats {' +
                        'display: flex;' +
                        'gap: 16px;' +
                        'flex-wrap: wrap;' +
                        'margin: 16px 0;' +
                        'padding: 12px;' +
                        'background: var(--bg-hover);' +
                        'border-radius: var(--radius-md);' +
                    '}' +
                    '.customer-detail-card .stat-item {' +
                        'flex: 1;' +
                        'text-align: center;' +
                        'cursor: pointer;' +
                        'transition: transform 0.2s;' +
                        'padding: 8px;' +
                        'border-radius: var(--radius-sm);' +
                    '}' +
                    '.customer-detail-card .stat-item:hover {' +
                        'background: var(--border-light);' +
                        'transform: translateY(-2px);' +
                    '}' +
                    '.customer-detail-card .stat-number {' +
                        'font-size: 24px;' +
                        'font-weight: 700;' +
                        'display: block;' +
                    '}' +
                    '.customer-detail-card .stat-label {' +
                        'font-size: var(--font-xs);' +
                        'color: var(--text-secondary);' +
                    '}' +
                    '.customer-detail-card .stat-item.active .stat-number { color: var(--primary); }' +
                    '.customer-detail-card .stat-item.completed .stat-number { color: var(--success-dark); }' +
                    '.customer-detail-card .stat-item.abnormal .stat-number { color: var(--danger); }' +
                '</style>';
            
            document.getElementById("app").innerHTML = inlineStyles + '' +
                '<div class="page-header">' +
                    '<h2>👥 ' + (lang === 'id' ? 'Data Nasabah' : '客户信息') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                        '<button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ' + t('print') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>' + (lang === 'id' ? 'Daftar Nasabah' : '客户列表') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table customer-list-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-id">' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</th>' +
                                    '<th class="col-name">' + t('customer_name') + '</th>' +
                                    '<th class="col-ktp">' + t('ktp_number') + '</th>' +
                                    '<th class="col-phone">' + t('phone') + '</th>' +
                                    '<th class="col-occupation">' + (lang === 'id' ? 'Pekerjaan' : '职业') + '</th>' +
                                    '<th class="text-center">' + (lang === 'id' ? 'Buat Pesanan' : '创建订单') + '</th>' +
                                    '<th class="text-center">' + t('action') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                addCustomerCardHtml;
            
        } catch (error) {
            console.error("showCustomers error:", error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? '加载客户数据失败：' + error.message : 'Gagal memuat data nasabah: ' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
            }
        }
    },

    // ========== 详情卡片弹窗（只显示列表中没有的字段：注册日期、KTP地址、居住地址） ==========
    showCustomerDetailCard: async function(customerId) {
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var isAdmin = AUTH.isAdmin();
        var profile = await SUPABASE.getCurrentProfile();
        
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            if (!customer) throw new Error(lang === 'id' ? 'Nasabah tidak ditemukan' : '客户不存在');
            
            // 检查黑名单状态
            let isBlacklisted = false;
            let blacklistReason = '';
            try {
                const { data: blData } = await supabaseClient
                    .from('blacklist')
                    .select('reason')
                    .eq('customer_id', customer.id)
                    .maybeSingle();
                if (blData) {
                    isBlacklisted = true;
                    blacklistReason = blData.reason;
                }
            } catch(blErr) {
                console.warn('黑名单检查失败:', blErr.message);
            }
            
            // 获取客户的所有订单
            const { data: orders, error: ordersError } = await supabaseClient
                .from('orders')
                .select('id, order_id, status, created_at')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            
            if (ordersError) throw ordersError;
            
            // 统计订单状态
            let activeCount = 0;
            let completedCount = 0;
            let abnormalCount = 0;
            
            for (var i = 0; i < (orders || []).length; i++) {
                var o = orders[i];
                if (o.status === 'active') {
                    activeCount++;
                } else if (o.status === 'completed') {
                    completedCount++;
                } else if (o.status === 'liquidated') {
                    abnormalCount++;
                }
            }
            
            // 获取逾期订单数量（额外查询逾期>=30天的活跃订单）
            try {
                const { count: overdueCount } = await supabaseClient
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('customer_id', customerId)
                    .eq('status', 'active')
                    .gte('overdue_days', 30);
                abnormalCount += (overdueCount || 0);
            } catch(e) {
                console.warn('获取逾期订单失败:', e);
            }
            
            // 权限控制
            var canEdit = isAdmin;
            var canBlacklist = !isBlacklisted;
            var canUnblacklist = isAdmin && isBlacklisted;
            
            // 获取注册日期、KTP地址、居住地址（列表中没有的补充信息）
            var registeredDate = Utils.formatDate(customer.registered_date);
            var ktpAddress = Utils.escapeHtml(customer.ktp_address || customer.address || '-');
            var livingAddress = Utils.escapeHtml(
                customer.living_same_as_ktp !== false 
                    ? (lang === 'id' ? 'Sama KTP' : '同KTP') 
                    : (customer.living_address || '-')
            );
            
            // 构建订单统计HTML（可点击跳转）
            var orderStatsHtml = '' +
                '<div class="order-stats">' +
                    '<div class="stat-item active" onclick="APP.showCustomerOrdersByStatus(\'' + Utils.escapeAttr(customerId) + '\', \'active\')" style="cursor:pointer;">' +
                        '<span class="stat-number">' + activeCount + '</span>' +
                        '<span class="stat-label">' + (lang === 'id' ? 'Berjalan' : '进行中') + '</span>' +
                    '</div>' +
                    '<div class="stat-item completed" onclick="APP.showCustomerOrdersByStatus(\'' + Utils.escapeAttr(customerId) + '\', \'completed\')" style="cursor:pointer;">' +
                        '<span class="stat-number">' + completedCount + '</span>' +
                        '<span class="stat-label">' + (lang === 'id' ? 'Lunas' : '已结清') + '</span>' +
                    '</div>' +
                    '<div class="stat-item abnormal" onclick="APP.showCustomerOrdersByStatus(\'' + Utils.escapeAttr(customerId) + '\', \'abnormal\')" style="cursor:pointer;">' +
                        '<span class="stat-number">' + abnormalCount + '</span>' +
                        '<span class="stat-label">' + (lang === 'id' ? 'Abnormal' : '异常订单') + '</span>' +
                    '</div>' +
                '</div>';
            
            // 黑名单状态徽章
            var blacklistBadge = '';
            if (isBlacklisted) {
                blacklistBadge = '<div class="info-bar warning" style="margin:0 0 12px 0; padding:6px 12px;"><small>⚠️ ' + Utils.escapeHtml(blacklistReason) + '</small></div>';
            }
            
            // 构建弹窗卡片HTML
            var modalHtml = '' +
                '<div id="customerDetailCard" class="modal-overlay customer-detail-card">' +
                    '<div class="modal-content" style="max-width:780px;">' +
                        '<h3 style="display:flex; justify-content:space-between; align-items:center;">' +
                            '<span>📋 ' + (lang === 'id' ? 'Detail Nasabah' : '客户详情') + ' - ' + Utils.escapeHtml(customer.name) + '</span>' +
                            '<button onclick="document.getElementById(\'customerDetailCard\').remove()" style="background:none; border:none; font-size:20px; cursor:pointer;">✖</button>' +
                        '</h3>' +
                        
                        blacklistBadge +
                        
                        '<div class="form-section">' +
                            '<div class="info-display">' +
                                '<div class="info-display-item">' +
                                    '<span class="info-label">' + (lang === 'id' ? 'Tanggal Daftar' : '注册日期') + ':</span>' +
                                    '<span class="info-value">' + registeredDate + '</span>' +
                                '</div>' +
                                '<div class="info-display-item">' +
                                    '<span class="info-label">' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + ':</span>' +
                                    '<span class="info-value">' + ktpAddress + '</span>' +
                                '</div>' +
                                '<div class="info-display-item">' +
                                    '<span class="info-label">' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + ':</span>' +
                                    '<span class="info-value">' + livingAddress + '</span>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        
                        '<div class="form-section">' +
                            '<div class="form-section-title">📋 ' + (lang === 'id' ? 'Statistik Pesanan' : '订单统计') + '</div>' +
                            orderStatsHtml +
                        '</div>' +
                        
                        '<div style="display:flex; gap:12px; justify-content:flex-end; margin-top:16px; padding-top:16px; border-top:1px solid var(--border-light); flex-wrap:wrap;">' +
                            (canEdit ? '<button onclick="APP.editCustomerFromCard(\'' + Utils.escapeAttr(customerId) + '\')" class="btn-small" style="background:var(--primary-dark);color:white;">✏️ ' + (lang === 'id' ? 'Edit' : '编辑') + '</button>' : '') +
                            (canBlacklist ? '<button onclick="APP.blacklistFromCard(\'' + Utils.escapeAttr(customer.id) + '\', \'' + Utils.escapeAttr(customer.name) + '\')" class="btn-small btn-blacklist" style="background:#f97316;color:#fff;">🚫 ' + (lang === 'id' ? 'Blacklist' : '拉黑') + '</button>' : '') +
                            (canUnblacklist ? '<button onclick="APP.unblacklistFromCard(\'' + Utils.escapeAttr(customer.id) + '\')" class="btn-small warning">🔓 ' + (lang === 'id' ? 'Buka Blacklist' : '解除拉黑') + '</button>' : '') +
                            '<button onclick="document.getElementById(\'customerDetailCard\').remove()" class="btn-back">✖ ' + t('cancel') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            var oldModal = document.getElementById('customerDetailCard');
            if (oldModal) oldModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
        } catch (error) {
            console.error("showCustomerDetailCard error:", error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? '加载客户详情失败：' + error.message : 'Gagal memuat detail nasabah: ' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal memuat detail nasabah: ' + error.message : '加载客户详情失败：' + error.message);
            }
        }
    },
    
    // ========== 从卡片编辑客户 ==========
    editCustomerFromCard: async function(customerId) {
        var modal = document.getElementById('customerDetailCard');
        if (modal) modal.remove();
        await this.editCustomer(customerId);
    },
    
    // ========== 从卡片拉黑客户 ==========
    blacklistFromCard: async function(customerUuid, customerName) {
        var lang = Utils.lang;
        
        var modal = document.getElementById('customerDetailCard');
        if (modal) modal.remove();
        
        var reason = prompt(
            lang === 'id' 
                ? 'Masukkan alasan blacklist untuk nasabah "' + customerName + '":\n\nContoh: Telat bayar, Penipuan, dll.'
                : '请输入拉黑客户 "' + customerName + '" 的原因：\n\n例如：逾期未还、欺诈等。',
            lang === 'id' ? 'Telat bayar' : '逾期未还'
        );
        
        if (!reason || reason.trim() === '') {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
            } else {
                alert(lang === 'id' ? 'Alasan harus diisi' : '请填写拉黑原因');
            }
            return;
        }
        
        var confirmMsg = lang === 'id' 
            ? '⚠️ Yakin akan blacklist nasabah ini?\n\nNama: ' + customerName + '\nAlasan: ' + reason + '\n\nNasabah yang di-blacklist tidak dapat membuat order baru.'
            : '⚠️ 确认拉黑此客户？\n\n客户名: ' + customerName + '\n原因: ' + reason + '\n\n被拉黑的客户将无法创建新订单。';
        
        var confirmed = window.Toast ? await window.Toast.confirmPromise(confirmMsg) : confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            await window.APP.addToBlacklist(customerUuid, reason);
            if (window.Toast) {
                window.Toast.success(lang === 'id' ? '✅ Nasabah "' + customerName + '" telah ditambahkan ke blacklist.' : '✅ 客户 "' + customerName + '" 已加入黑名单。');
            } else {
                alert(lang === 'id' ? '✅ Nasabah "' + customerName + '" telah ditambahkan ke blacklist.' : '✅ 客户 "' + customerName + '" 已加入黑名单。');
            }
            await APP.showCustomers();
        } catch (error) {
            var errMsg = error.message || error.details || error.code || JSON.stringify(error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + errMsg : '拉黑失败：' + errMsg);
            } else {
                alert(lang === 'id' ? 'Gagal menambahkan ke blacklist: ' + errMsg : '拉黑失败：' + errMsg);
            }
        }
    },
    
    // ========== 从卡片解除拉黑 ==========
    unblacklistFromCard: async function(customerUuid) {
        var lang = Utils.lang;
        
        var confirmMsg = lang === 'id' ? 'Yakin ingin membuka blacklist nasabah ini?' : '确认解除此客户的拉黑？';
        var confirmed = window.Toast ? await window.Toast.confirmPromise(confirmMsg) : confirm(confirmMsg);
        if (!confirmed) return;
        
        try {
            await window.APP.removeFromBlacklist(customerUuid);
            if (window.Toast) {
                window.Toast.success(lang === 'id' ? '✅ Blacklist berhasil dibuka' : '✅ 已解除拉黑');
            } else {
                alert(lang === 'id' ? '✅ Blacklist berhasil dibuka' : '✅ 已解除拉黑');
            }
            
            var modal = document.getElementById('customerDetailCard');
            if (modal) modal.remove();
            
            await APP.showCustomers();
        } catch (error) {
            var errMsg = error.message || error.details || error.code || JSON.stringify(error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal membuka blacklist: ' + errMsg : '解除拉黑失败：' + errMsg);
            } else {
                alert(lang === 'id' ? 'Gagal membuka blacklist: ' + errMsg : '解除拉黑失败：' + errMsg);
            }
        }
    },
    
    // ========== 按状态查看客户订单 ==========
    showCustomerOrdersByStatus: async function(customerId, statusType) {
        var lang = Utils.lang;
        
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            if (!customer) return;
            
            let query = supabaseClient
                .from('orders')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            
            if (statusType === 'active') {
                query = query.eq('status', 'active');
            } else if (statusType === 'completed') {
                query = query.eq('status', 'completed');
            } else if (statusType === 'abnormal') {
                query = query.or('status.eq.liquidated,and(status.eq.active,overdue_days.gte.30)');
            }
            
            const { data: orders, error } = await query;
            if (error) throw error;
            
            var modal = document.getElementById('customerDetailCard');
            if (modal) modal.remove();
            
            APP.currentCustomerId = customerId;
            APP.showCustomerOrders(customerId);
            
        } catch (error) {
            console.error("showCustomerOrdersByStatus error:", error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat pesanan' : '加载订单失败');
            }
        }
    },

    // ========== 保留原有方法 ==========
    
    toggleLivingAddress: function(value) {
        var el = document.getElementById('customerLivingAddress');
        if (el) el.style.display = value === 'different' ? 'block' : 'none';
    },

    addCustomer: async function() {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (isAdmin) {
            if (window.Toast) {
                window.Toast.warning(t('store_operation'));
            } else {
                alert(t('store_operation'));
            }
            return;
        }
        
        var addBtn = document.getElementById('addCustomerBtn');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
        }
        
        var name = document.getElementById("customerName").value.trim();
        var ktp = document.getElementById("customerKtp").value.trim();
        var phone = document.getElementById("customerPhone").value.trim();
        var occupation = document.getElementById("customerOccupation").value.trim();
        var ktpAddress = document.getElementById("customerKtpAddress").value.trim();
        var livingOpt = document.querySelector('input[name="livingAddrOpt"]:checked')?.value || 'same';
        var livingSameAsKtp = livingOpt === 'same';
        var livingAddress = livingSameAsKtp ? null : document.getElementById("customerLivingAddress").value.trim();

        if (!name) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); }
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写');
            } else {
                alert(lang === 'id' ? 'Nama nasabah harus diisi' : '客户姓名必须填写');
            }
            return;
        }
        if (!phone) {
            if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); }
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写');
            } else {
                alert(lang === 'id' ? 'Nomor telepon harus diisi' : '手机号必须填写');
            }
            return;
        }

        try {
            const profile = await SUPABASE.getCurrentProfile();
            const storeId = profile?.store_id;
            
            if (!storeId) {
                if (addBtn) { addBtn.disabled = false; addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); }
                if (window.Toast) {
                    window.Toast.error(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                } else {
                    alert(lang === 'id' ? 'User tidak memiliki toko' : '用户没有关联门店');
                }
                return;
            }
            
            // 黑名单重复检查
            if (ktp || phone) {
                try {
                    let blacklistCheckQuery = supabaseClient
                        .from('blacklist')
                        .select('customers!blacklist_customer_id_fkey(id, name, ktp_number, phone, customer_id)');
                    
                    let conditions = [];
                    if (ktp) conditions.push(`customers.ktp_number.eq.${ktp}`);
                    if (phone) conditions.push(`customers.phone.eq.${phone}`);
                    
                    if (conditions.length > 0) {
                        blacklistCheckQuery = blacklistCheckQuery.or(conditions.join(','));
                        const { data: blacklistedCustomers, error: blCheckError } = await blacklistCheckQuery;
                        
                        if (!blCheckError && blacklistedCustomers && blacklistedCustomers.length > 0) {
                            const matchedCustomer = blacklistedCustomers[0].customers;
                            let reason = '';
                            if (ktp && matchedCustomer.ktp_number === ktp) {
                                reason = lang === 'id' 
                                    ? `❌ Nomor KTP ${ktp} sudah terdaftar di blacklist (Nasabah: ${matchedCustomer.name})\n\nTidak dapat menambahkan nasabah baru dengan data yang sama.`
                                    : `❌ 身份证号 ${ktp} 已被拉黑（客户：${matchedCustomer.name}）\n\n无法添加相同信息的客户。`;
                            } else if (phone && matchedCustomer.phone === phone) {
                                reason = lang === 'id'
                                    ? `❌ Nomor telepon ${phone} sudah terdaftar di blacklist (Nasabah: ${matchedCustomer.name})\n\nTidak dapat menambahkan nasabah baru dengan data yang sama.`
                                    : `❌ 手机号 ${phone} 已被拉黑（客户：${matchedCustomer.name}）\n\n无法添加相同信息的客户。`;
                            }
                            
                            if (window.Toast) {
                                window.Toast.error(reason, 5000);
                            } else {
                                alert(reason);
                            }
                            if (addBtn) {
                                addBtn.disabled = false;
                                addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户');
                            }
                            return;
                        }
                    }
                } catch (blErr) {
                    console.warn('黑名单重复检查失败:', blErr.message);
                }
            }
            
            let maxRetries = 8;
            let lastError = null;
            let newCustomer = null;
            
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const prefix = await SUPABASE._getStorePrefix(storeId);
                    
                    const { data: customers, error: queryError } = await supabaseClient
                        .from('customers')
                        .select('customer_id')
                        .like('customer_id', prefix + '%')
                        .order('customer_id', { ascending: false })
                        .limit(1);
                    
                    if (queryError) {
                        console.warn("查询最大客户ID失败:", queryError);
                    }
                    
                    let maxNumber = 0;
                    if (customers && customers.length > 0) {
                        const match = customers[0].customer_id.match(new RegExp(prefix + '(\\d{3})$'));
                        if (match) {
                            maxNumber = parseInt(match[1], 10);
                        }
                    }
                    
                    const nextNumber = maxNumber + 1;
                    const serial = String(nextNumber).padStart(3, '0');
                    const customerId = prefix + serial;
                    
                    const customerData = {
                        customer_id: customerId,
                        store_id: storeId,
                        name: name,
                        ktp_number: ktp || null,
                        phone: phone,
                        occupation: occupation || null,
                        ktp_address: ktpAddress || null,
                        address: ktpAddress || null,
                        living_same_as_ktp: livingSameAsKtp,
                        living_address: livingAddress || null,
                        registered_date: Utils.getLocalToday(),
                        created_by: profile.id
                    };
                    
                    const { data, error } = await supabaseClient
                        .from('customers')
                        .insert(customerData)
                        .select()
                        .single();
                    
                    if (error) {
                        if (error.code === '23505') {
                            console.warn(`客户ID ${customerId} 冲突，重试第 ${attempt + 1}/${maxRetries} 次`);
                            lastError = error;
                            await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
                            continue;
                        }
                        throw error;
                    }
                    
                    newCustomer = data;
                    break;
                    
                } catch (err) {
                    if (err.code === '23505' && attempt < maxRetries - 1) {
                        continue;
                    }
                    throw err;
                }
            }
            
            if (!newCustomer) {
                throw lastError || new Error(lang === 'id' ? 'Gagal menghasilkan ID nasabah unik' : '无法生成唯一的客户ID');
            }
            
            if (addBtn) {
                addBtn.disabled = false;
                addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户');
            }
            if (window.Toast) {
                window.Toast.success(lang === 'id' ? 'Nasabah berhasil ditambahkan! ID: ' + newCustomer.customer_id : '客户添加成功！ID: ' + newCustomer.customer_id);
            } else {
                alert(lang === 'id' ? 'Nasabah berhasil ditambahkan! ID: ' + newCustomer.customer_id : '客户添加成功！ID: ' + newCustomer.customer_id);
            }
            await APP.showCustomers();
            
        } catch (error) {
            if (addBtn) { 
                addBtn.disabled = false; 
                addBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan Nasabah' : '保存客户'); 
            }
            console.error("addCustomer error:", error);
            var errMsg = error.message || error.details || error.code || (lang === 'id' ? 'Gagal menyimpan' : '保存失败');
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal menyimpan: ' + errMsg : '保存失败：' + errMsg);
            } else {
                alert(lang === 'id' ? 'Gagal menyimpan: ' + errMsg : '保存失败：' + errMsg);
            }
        }
    },

    editCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (!isAdmin) {
            if (window.Toast) {
                window.Toast.warning(t('store_operation'));
            } else {
                alert(t('store_operation'));
            }
            return;
        }
        
        try {
            const { data: c, error } = await supabaseClient.from('customers').select('*').eq('id', customerId).single();
            if (error) throw error;
            var livingSame = c.living_same_as_ktp !== false;
            var occupation = c.occupation || '';

            var modal = document.createElement('div');
            modal.id = 'editCustomerModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = '' +
                '<div class="modal-content" style="max-width:600px;">' +
                    '<h3>✏️ ' + (lang === 'id' ? 'Ubah Data Nasabah' : '修改客户信息') + '</h3>' +
                    '<div class="form-grid order-first-row">' +
                        '<div class="form-group"><label>' + t('customer_name') + ' *</label><input id="ec_name" value="' + Utils.escapeHtml(c.name) + '"></div>' +
                        '<div class="form-group"><label>' + t('phone') + ' *</label><input id="ec_phone" value="' + Utils.escapeHtml(c.phone || '') + '"></div>' +
                        '<div class="form-group"><label>' + t('ktp_number') + '</label><input id="ec_ktp" value="' + Utils.escapeHtml(c.ktp_number || '') + '"></div>' +
                        '<div class="form-group"><label>' + (lang === 'id' ? 'Pekerjaan' : '职业') + '</label><input id="ec_occupation" value="' + Utils.escapeHtml(occupation) + '"></div>' +
                        '<div class="form-group full-width"><label>' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + '</label><textarea id="ec_ktpAddr" rows="2">' + Utils.escapeHtml(c.ktp_address || c.address || '') + '</textarea></div>' +
                        '<div class="form-group full-width">' +
                            '<label>' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + '</label>' +
                            '<div class="address-option">' +
                                '<label><input type="radio" name="ec_livingOpt" value="same" ' + (livingSame ? 'checked' : '') + ' onchange="APP._toggleEditLiving(this.value)"> ' + (lang === 'id' ? 'Sama dengan KTP' : '同上KTP') + '</label>' +
                                '<label><input type="radio" name="ec_livingOpt" value="different" ' + (!livingSame ? 'checked' : '') + ' onchange="APP._toggleEditLiving(this.value)"> ' + (lang === 'id' ? 'Berbeda' : '不同') + '</label>' +
                            '</div>' +
                            '<textarea id="ec_livingAddr" rows="2" style="margin-top:8px;' + (livingSame ? 'display:none;' : '') + '">' + Utils.escapeHtml(c.living_address || '') + '</textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP._saveEditCustomer(\'' + Utils.escapeAttr(customerId) + '\')" class="success">💾 ' + t('save') + '</button>' +
                            '<button onclick="document.getElementById(\'editCustomerModal\').remove()">✖ ' + t('cancel') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);
            
        } catch (e) {
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data: ' + e.message : '加载失败：' + e.message);
            } else {
                alert(lang === 'id' ? 'Gagal memuat data: ' + e.message : '加载失败：' + e.message);
            }
        }
    },

    _toggleEditLiving: function(val) {
        var el = document.getElementById('ec_livingAddr');
        if (el) el.style.display = val === 'different' ? 'block' : 'none';
    },

    _saveEditCustomer: async function(customerId) {
        var isAdmin = AUTH.isAdmin();
        var lang = Utils.lang;
        var t = Utils.t;
        
        if (!isAdmin) {
            if (window.Toast) {
                window.Toast.warning(t('store_operation'));
            } else {
                alert(t('store_operation'));
            }
            return;
        }
        
        var name = document.getElementById('ec_name').value.trim();
        var phone = document.getElementById('ec_phone').value.trim();
        var ktp = document.getElementById('ec_ktp').value.trim();
        var occupation = document.getElementById('ec_occupation').value.trim();
        var ktpAddr = document.getElementById('ec_ktpAddr').value.trim();
        var livingOpt = document.querySelector('input[name="ec_livingOpt"]:checked')?.value || 'same';
        var livingSame = livingOpt === 'same';
        var livingAddr = livingSame ? null : document.getElementById('ec_livingAddr').value.trim();

        if (!name || !phone) { 
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'Nama dan telepon wajib diisi' : '姓名和手机号必须填写');
            } else {
                alert(lang === 'id' ? 'Nama dan telepon wajib diisi' : '姓名和手机号必须填写');
            }
            return; 
        }

        try {
            const { error } = await supabaseClient.from('customers').update({
                name: name,
                phone: phone,
                ktp_number: ktp || null,
                occupation: occupation || null,
                ktp_address: ktpAddr || null,
                address: ktpAddr || null,
                living_same_as_ktp: livingSame,
                living_address: livingAddr || null,
                updated_at: Utils.getLocalDateTime()
            }).eq('id', customerId);
            
            if (error) throw error;
            
            document.getElementById('editCustomerModal')?.remove();
            if (window.Toast) {
                window.Toast.success(lang === 'id' ? 'Data nasabah diperbarui' : '客户信息已更新');
            } else {
                alert(lang === 'id' ? 'Data nasabah diperbarui' : '客户信息已更新');
            }
            
            if (window.APP.clearAnomalyCache) {
                window.APP.clearAnomalyCache();
            }
            
            await APP.showCustomers();
        } catch (e) {
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal menyimpan: ' + e.message : '保存失败：' + e.message);
            } else {
                alert(lang === 'id' ? 'Gagal menyimpan: ' + e.message : '保存失败：' + e.message);
            }
        }
    },

    deleteCustomer: async function(customerId) {
        var lang = Utils.lang;
        var confirmed = window.Toast ? await window.Toast.confirmPromise(Utils.t('confirm_delete')) : confirm(Utils.t('confirm_delete'));
        if (!confirmed) return;
        
        try {
            const { data: orders, error: ordersError } = await supabaseClient.from('orders').select('id').eq('customer_id', customerId);
            if (ordersError) throw ordersError;
            
            if (orders && orders.length > 0) {
                for (var i = 0; i < orders.length; i++) {
                    await supabaseClient.from('payment_history').delete().eq('order_id', orders[i].id);
                }
                await supabaseClient.from('orders').delete().eq('customer_id', customerId);
            }
            
            await supabaseClient.from('blacklist').delete().eq('customer_id', customerId);
            
            const { error: customerError } = await supabaseClient.from('customers').delete().eq('id', customerId);
            if (customerError) throw customerError;
            
            if (window.Toast) {
                window.Toast.success(lang === 'id' ? 'Nasabah berhasil dihapus' : '客户已删除');
            } else {
                alert(lang === 'id' ? 'Nasabah berhasil dihapus' : '客户已删除');
            }
            
            if (window.APP.clearAnomalyCache) {
                window.APP.clearAnomalyCache();
            }
            
            await APP.showCustomers();
        } catch (e) {
            console.error('删除客户异常:', e);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message);
            } else {
                alert(lang === 'id' ? 'Gagal hapus: ' + e.message : '删除失败：' + e.message);
            }
        }
    },

    // ==================== 创建订单页面 ====================
    createOrderForCustomer: async function(customerId) {
        var lang = Utils.lang || 'id';
        var t = function(key) { return Utils.t(key); };

        var profile = null;
        try {
            profile = await SUPABASE.getCurrentProfile();
        } catch(e) {
            console.error('获取用户资料失败:', e);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data user' : '加载用户数据失败');
            } else {
                alert(lang === 'id' ? 'Gagal memuat data user' : '加载用户数据失败');
            }
            return;
        }

        var isAdmin = profile?.role === 'admin';

        if (isAdmin) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'Operasi ini hanya untuk operator toko' : '此操作仅限门店操作员');
            } else {
                alert(lang === 'id' ? 'Operasi ini hanya untuk operator toko' : '此操作仅限门店操作员');
            }
            return;
        }

        if (!customerId) {
            if (window.Toast) {
                window.Toast.warning(lang === 'id' ? 'ID nasabah tidak valid' : '客户ID无效');
            } else {
                alert(lang === 'id' ? 'ID nasabah tidak valid' : '客户ID无效');
            }
            return;
        }

        try {
            const { data: customer, error: customerError } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            if (customerError || !customer) {
                throw new Error(lang === 'id' ? 'Data nasabah tidak ditemukan' : '找不到客户数据');
            }

            var blacklistCheck = { isBlacklisted: false };
            try {
                const { data: blData } = await supabaseClient
                    .from('blacklist')
                    .select('id, reason')
                    .eq('customer_id', customer.id)
                    .maybeSingle();
                blacklistCheck = blData ? { isBlacklisted: true, reason: blData.reason } : { isBlacklisted: false };
            } catch(blErr) {
                console.warn('黑名单检查失败:', blErr.message);
            }

            if (blacklistCheck && blacklistCheck.isBlacklisted) {
                if (window.Toast) {
                    window.Toast.error(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。', 4000);
                } else {
                    alert(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。');
                }
                return;
            }

            try {
                const { data: existingOrders } = await supabaseClient
                    .from('orders')
                    .select('status')
                    .eq('customer_id', customerId)
                    .eq('status', 'active');
                if (existingOrders && existingOrders.length > 0) {
                    if (window.Toast) {
                        window.Toast.warning(lang === 'id' ? 'Nasabah ini masih memiliki pesanan aktif.' : '该客户还有未结清的订单。');
                    } else {
                        alert(lang === 'id' ? 'Nasabah ini masih memiliki pesanan aktif.' : '该客户还有未结清的订单。');
                    }
                    return;
                }
            } catch(ordErr) {
                console.warn('活跃订单检查失败:', ordErr.message);
            }

            APP.currentPage = 'createOrder';
            APP.currentCustomerId = customerId;
            
            var occupationDisplay = Utils.escapeHtml(customer.occupation || '-');
            
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📝 ' + t('create_order') + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                
                '<div class="card">' +
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">👤</span> ' + t('customer_info') +
                        '</div>' +
                        '<div class="info-display">' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.customer_id || '-') + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('customer_name') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.name) + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('ktp_number') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.ktp_number || '-') + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + t('phone') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.phone) + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + (lang === 'id' ? 'Pekerjaan' : '职业') + '</span>' +
                                '<span class="info-value">' + occupationDisplay + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + (lang === 'id' ? 'Alamat KTP' : 'KTP地址') + '</span>' +
                                '<span class="info-value">' + Utils.escapeHtml(customer.ktp_address || customer.address || '-') + '</span>' +
                            '</div>' +
                            '<div class="info-display-item">' +
                                '<span class="info-label">' + (lang === 'id' ? 'Alamat Tinggal' : '居住地址') + '</span>' +
                                '<span class="info-value">' + (customer.living_same_as_ktp !== false ? (lang === 'id' ? 'Sama KTP' : '同KTP') : Utils.escapeHtml(customer.living_address || '-')) + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">💎</span> ' + t('collateral_info') +
                        '</div>' +
                        '<div class="order-first-row">' +
                            '<div class="form-group">' +
                                '<label>' + t('collateral_name') + ' *</label>' +
                                '<input id="collateral" placeholder="' + t('collateral_name') + '">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' + (lang === 'id' ? 'Keterangan Barang' : '物品备注') + '</label>' +
                                '<input id="collateralNote" placeholder="' + (lang === 'id' ? 'Contoh: emas 24k, kondisi baik, tahun 2020' : '例如: 24k金, 状况良好, 2020年') + '">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' + (lang === 'id' ? 'Jumlah Gadai' : '当金金额') + ' *</label>' +
                                '<input type="text" id="amount" placeholder="0" class="amount-input" oninput="APP.recalculateAllFees()">' +
                            '</div>' +
                            '<div class="form-group">' +
                                '<label>' + (lang === 'id' ? 'Sumber Dana' : '资金来源') + '</label>' +
                                '<div class="payment-method-selector compact">' +
                                    '<label><input type="radio" name="loanSource" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                    '<label><input type="radio" name="loanSource" value="bank"> 🏧 ' + t('bank') + '</label>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">💰</span> ' + (lang === 'id' ? 'Rincian Biaya' : '费用明细') +
                        '</div>' +
                        '<div class="fee-cards-row">' +
                            '<div class="fee-card">' +
                                '<div class="fee-card-label">📋 ' + (lang === 'id' ? 'Admin Fee' : '管理费') + '</div>' +
                                '<div class="fee-card-body">' +
                                    '<input type="text" id="adminFeeInput" value="0" class="amount-input" oninput="APP.onAdminFeeManualChange()">' +
                                '</div>' +
                                '<div class="fee-card-hint">💡 ' + (lang === 'id' ? 'Dihitung otomatis' : '自动计算') + '</div>' +
                            '</div>' +
                            '<div class="fee-card">' +
                                '<div class="fee-card-label">✨ ' + (lang === 'id' ? 'Service Fee' : '服务费') + '</div>' +
                                '<div class="fee-card-body">' +
                                    '<select id="serviceFeePercentSelect" onchange="APP.recalculateServiceFee()" style="min-width:80px;">' +
                                        Utils.getServiceFeePercentOptions(2) +
                                    '</select>' +
                                    '<input type="text" id="serviceFeeInput" value="0" class="amount-input" oninput="APP.onServiceFeeManualChange()">' +
                                '</div>' +
                                '<div class="fee-card-hint">💡 ' + (lang === 'id' ? 'Dihitung otomatis berdasarkan jumlah gadai' : '根据当金金额自动计算') + '</div>' +
                            '</div>' +
                        '</div>' +
                        
                        '<div class="payment-method-row">' +
                            '<span class="payment-method-label">📥 ' + (lang === 'id' ? 'Metode Pemasukan' : '入账方式') + '</span>' +
                            '<div class="payment-method-selector compact" style="padding:0;">' +
                                '<label><input type="radio" name="feePaymentMethod" value="cash" checked> 🏦 ' + t('cash') + '</label>' +
                                '<label><input type="radio" name="feePaymentMethod" value="bank"> 🏧 ' + t('bank') + '</label>' +
                            '</div>' +
                            '<div class="payment-method-hint">💡 ' + (lang === 'id' ? 'Admin Fee & Service Fee akan dicatat bersama' : '管理费和服务费将一起入账') + '</div>' +
                        '</div>' +
                        
                        '<div class="form-group interest-rate-group">' +
                            '<label>📈 ' + (lang === 'id' ? 'Suku Bunga (Pilih)' : '利率（可选）') + '</label>' +
                            '<select id="agreedInterestRateSelect" onchange="APP.recalculateAllFees()">' +
                                Utils.getInterestRateOptions(8) +
                            '</select>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="form-section">' +
                        '<div class="form-section-title">' +
                            '<span class="section-icon">📅</span> ' + (lang === 'id' ? 'Metode Cicilan' : '还款方式') +
                        '</div>' +
                        '<div class="repayment-cards-row">' +
                            '<div class="repayment-card selected" id="flexibleCard" onclick="document.getElementById(\'flexibleRadio\').checked=true;APP.toggleRepaymentForm(\'flexible\')">' +
                                '<div class="repayment-card-header">' +
                                    '<input type="radio" name="repaymentType" id="flexibleRadio" value="flexible" checked onchange="APP.toggleRepaymentForm(this.value)">' +
                                    '<span class="repayment-card-title">💰 ' + t('flexible_repayment') + '</span>' +
                                '</div>' +
                                '<div class="repayment-card-desc">' + (lang === 'id' ? 'Bayar bunga dulu, pokok bisa kapan saja' : '先付利息，本金随时可还') + '</div>' +
                                '<div class="repayment-card-note">' + (lang === 'id' ? 'Maksimal 10 bulan' : '最长10个月') + '</div>' +
                            '</div>' +
                            '<div class="repayment-card" id="fixedCard" onclick="document.getElementById(\'fixedRadio\').checked=true;APP.toggleRepaymentForm(\'fixed\')">' +
                                '<div class="repayment-card-header">' +
                                    '<input type="radio" name="repaymentType" id="fixedRadio" value="fixed" onchange="APP.toggleRepaymentForm(this.value)">' +
                                    '<span class="repayment-card-title">📅 ' + t('fixed_repayment') + '</span>' +
                                '</div>' +
                                '<div class="repayment-card-desc">' + (lang === 'id' ? 'Angsuran tetap per bulan (bunga + pokok)' : '每月固定还款（本金+利息）') + '</div>' +
                                '<div class="repayment-card-note">' + (lang === 'id' ? 'Pilihan 1-10 bulan' : '可选1-10个月') + '</div>' +
                            '</div>' +
                            '<div id="flexibleMaxMonthsCard" class="repayment-card extension-card">' +
                                '<div class="repayment-card-header">' +
                                    '<span class="repayment-card-title">📅 ' + (lang === 'id' ? 'Maksimal Perpanjangan' : '最大展期') + '</span>' +
                                '</div>' +
                                '<div class="extension-select">' +
                                    '<select id="maxExtensionMonths">' +
                                        '<option value="6">6 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                        '<option value="10" selected>10 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                        '<option value="12">12 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                        '<option value="24">24 ' + (lang === 'id' ? 'bulan' : '个月') + '</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div class="repayment-card-note extension-note">' + (lang === 'id' ? 'Batas maksimal perpanjangan bunga sebelum harus lunasi pokok' : '利息延期上限，超出后须结清本金') + '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div id="fixedRepaymentForm" style="display:none;" class="fixed-repayment-form">' +
                            '<div class="form-grid">' +
                                '<div class="form-group">' +
                                    '<label>📅 ' + (lang === 'id' ? 'Jangka Waktu' : '还款期限') + '</label>' +
                                    '<select id="repaymentTermSelect" onchange="APP.recalculateAllFees()">' +
                                        Utils.getRepaymentTermOptions(5) +
                                    '</select>' +
                                '</div>' +
                                '<div class="form-group">' +
                                    '<label>💰 ' + (lang === 'id' ? 'Angsuran Bulanan' : '每月还款') + '</label>' +
                                    '<input type="text" id="monthlyPaymentInput" value="0" class="amount-input" oninput="APP.onMonthlyPaymentManualChange()">' +
                                    '<div class="form-hint">' + (lang === 'id' ? 'Dibulatkan ke Rp 10.000, bisa disesuaikan' : '取整到Rp 10,000，可手动调整') + '</div>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    
                    '<div class="form-section">' +
                        '<div class="form-group full-width">' +
                            '<label>' + t('notes') + '</label>' +
                            '<textarea id="notes" rows="2" placeholder="' + t('notes') + '"></textarea>' +
                        '</div>' +
                        '<div class="form-actions">' +
                            '<button onclick="APP.saveOrderForCustomer(\'' + Utils.escapeAttr(customerId) + '\')" class="success" id="saveOrderBtn">💾 ' + (lang === 'id' ? 'Simpan' : '保存') + '</button>' +
                            '<button onclick="APP.goBack()">↩️ ' + t('cancel') + '</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            var amountInput = document.getElementById("amount");
            if (amountInput && Utils.bindAmountFormat) Utils.bindAmountFormat(amountInput);
            
            var adminFeeInput = document.getElementById("adminFeeInput");
            if (adminFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(adminFeeInput);
            
            var serviceFeeInput = document.getElementById("serviceFeeInput");
            if (serviceFeeInput && Utils.bindAmountFormat) Utils.bindAmountFormat(serviceFeeInput);
            
            var monthlyPaymentInput = document.getElementById("monthlyPaymentInput");
            if (monthlyPaymentInput && Utils.bindAmountFormat) Utils.bindAmountFormat(monthlyPaymentInput);
            
            APP.recalculateAllFees();
            
        } catch (error) {
            console.error("createOrderForCustomer 错误:", error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
            } else {
                alert(lang === 'id' ? 'Gagal memuat data nasabah: ' + error.message : '加载客户数据失败：' + error.message);
            }
        }
    },

    saveOrderForCustomer: async function(customerId) {
        var lang = Utils.lang;
        var t = Utils.t.bind(Utils);
        
        var saveBtn = document.getElementById('saveOrderBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ ' + (lang === 'id' ? 'Menyimpan...' : '保存中...');
        }
        
        var collateral = document.getElementById("collateral").value.trim();
        var collateralNote = document.getElementById("collateralNote").value.trim();
        var amountStr = document.getElementById("amount").value;
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var notes = document.getElementById("notes").value;
        
        var adminFeeStr = document.getElementById("adminFeeInput").value;
        var adminFee = Utils.parseNumberFromCommas(adminFeeStr) || Utils.calculateAdminFee(amount);
        
        var serviceFeePercent = parseFloat(document.getElementById("serviceFeePercentSelect")?.value) || 0;
        var serviceFeeStr = document.getElementById("serviceFeeInput").value;
        var serviceFee = Utils.parseNumberFromCommas(serviceFeeStr) || 0;
        if (serviceFee === 0 && serviceFeePercent > 0) {
            serviceFee = Math.round(amount * serviceFeePercent / 100);
        }
        
        var feePaymentMethod = document.querySelector('input[name="feePaymentMethod"]:checked')?.value || 'cash';
        var agreedInterestRate = parseFloat(document.getElementById("agreedInterestRateSelect")?.value) || 8;
        
        var repaymentTypeRadio = document.querySelector('input[name="repaymentType"]:checked');
        var repaymentType = repaymentTypeRadio ? repaymentTypeRadio.value : 'flexible';
        var repaymentTerm = null;
        var monthlyFixedPayment = null;
        var maxExtensionMonths = 10;
        
        if (repaymentType === 'fixed') {
            repaymentTerm = parseInt(document.getElementById("repaymentTermSelect")?.value) || 5;
            var monthlyStr = document.getElementById("monthlyPaymentInput").value;
            monthlyFixedPayment = Utils.parseNumberFromCommas(monthlyStr) || 0;
            if (monthlyFixedPayment === 0 && amount > 0) {
                var monthlyRate = agreedInterestRate / 100;
                monthlyFixedPayment = Utils.roundMonthlyPayment(Utils.calculateFixedMonthlyPayment(amount, monthlyRate, repaymentTerm));
            }
        } else {
            maxExtensionMonths = parseInt(document.getElementById('maxExtensionMonths')?.value) || 10;
        }
        
        var loanSource = document.querySelector('input[name="loanSource"]:checked')?.value || 'cash';
        var fullCollateralName = collateralNote ? collateral + ' (' + collateralNote + ')' : collateral;
        
        if (!collateral || !amount || amount <= 0) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存'); }
            if (window.Toast) {
                window.Toast.warning(t('fill_all_fields'));
            } else {
                alert(t('fill_all_fields'));
            }
            return;
        }
        
        try {
            const { data: customer } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();
            
            const { data: blacklistData } = await supabaseClient
                .from('blacklist')
                .select('id')
                .eq('customer_id', customer.id)
                .maybeSingle();
            
            if (blacklistData) {
                if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存'); }
                if (window.Toast) {
                    window.Toast.error(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。', 4000);
                } else {
                    alert(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。');
                }
                return;
            }
            
            var orderData = {
                customer: { 
                    name: customer.name, 
                    ktp: customer.ktp_number || '', 
                    phone: customer.phone, 
                    address: customer.ktp_address || customer.address || '' 
                },
                collateral_name: fullCollateralName,
                loan_amount: amount,
                notes: notes,
                customer_id: customerId,
                store_id: null,
                admin_fee: adminFee,
                service_fee_percent: serviceFeePercent,
                service_fee_amount: serviceFee,
                agreed_interest_rate: agreedInterestRate,
                repayment_type: repaymentType,
                repayment_term: repaymentTerm,
                monthly_fixed_payment: monthlyFixedPayment,
                max_extension_months: maxExtensionMonths
            };
            
            var newOrder = await Order.create(orderData);
            
            if (adminFee > 0) {
                try {
                    await Order.recordAdminFee(newOrder.order_id, feePaymentMethod, adminFee);
                } catch (adminFeeError) {
                    console.error("管理费收取失败:", adminFeeError);
                }
            }
            
            if (serviceFee > 0) {
                try {
                    await Order.recordServiceFee(newOrder.order_id, 1, feePaymentMethod);
                } catch (serviceFeeError) {
                    console.error("服务费收取失败:", serviceFeeError);
                }
            }
            
            if (amount > 0) {
                try {
                    var disbursementDesc = lang === 'id' 
                        ? 'Pencairan gadai dari ' + (loanSource === 'cash' ? 'Brankas' : 'Bank BNI')
                        : '当金发放自 ' + (loanSource === 'cash' ? '保险柜' : '银行BNI');
                    await Order.recordLoanDisbursement(newOrder.order_id, amount, loanSource, disbursementDesc);
                } catch (loanError) {
                    console.error("当金发放记录失败:", loanError);
                }
            }
            
            var successMsg = repaymentType === 'fixed'
                ? (lang === 'id' 
                    ? '✅ Pesanan berhasil dibuat!\n\nID Pesanan: ' + newOrder.order_id + '\nJenis: Cicilan Tetap\nJangka: ' + repaymentTerm + ' bulan\nAngsuran per bulan: ' + Utils.formatCurrency(monthlyFixedPayment)
                    : '✅ 订单创建成功！\n\n订单号: ' + newOrder.order_id + '\n还款方式: 固定还款\n期限: ' + repaymentTerm + '个月\n每月还款: ' + Utils.formatCurrency(monthlyFixedPayment))
                : (lang === 'id'
                    ? '✅ Pesanan berhasil dibuat!\n\nID Pesanan: ' + newOrder.order_id + '\nJenis: Cicilan Fleksibel\nMaksimal perpanjangan: ' + maxExtensionMonths + ' bulan'
                    : '✅ 订单创建成功！\n\n订单号: ' + newOrder.order_id + '\n还款方式: 灵活还款\n最长可延期: ' + maxExtensionMonths + '个月');
            
            if (window.Toast) {
                window.Toast.success(successMsg, 5000);
            } else {
                alert(successMsg);
            }
            
            document.getElementById("collateral").value = '';
            document.getElementById("collateralNote").value = '';
            document.getElementById("amount").value = '';
            document.getElementById("notes").value = '';
            
            var amountInput = document.getElementById("amount");
            if (amountInput) amountInput.value = '';
            
            var adminFeeInput = document.getElementById("adminFeeInput");
            if (adminFeeInput) {
                adminFeeInput.value = '0';
                delete adminFeeInput.dataset.manual;
            }
            
            var serviceFeePercentSelect = document.getElementById("serviceFeePercentSelect");
            if (serviceFeePercentSelect) {
                serviceFeePercentSelect.value = '2';
                delete serviceFeePercentSelect.dataset.manual;
            }
            
            var serviceFeeInput = document.getElementById("serviceFeeInput");
            if (serviceFeeInput) {
                serviceFeeInput.value = '0';
                delete serviceFeeInput.dataset.manual;
            }
            
            var cashRadio = document.querySelector('input[name="feePaymentMethod"][value="cash"]');
            if (cashRadio) cashRadio.checked = true;
            
            var loanCashRadio = document.querySelector('input[name="loanSource"][value="cash"]');
            if (loanCashRadio) loanCashRadio.checked = true;
            
            var interestSelect = document.getElementById("agreedInterestRateSelect");
            if (interestSelect) interestSelect.value = '8';
            
            var flexibleRadio = document.getElementById("flexibleRadio");
            if (flexibleRadio) {
                flexibleRadio.checked = true;
                APP.toggleRepaymentForm('flexible');
            }
            
            APP.recalculateAllFees();
            
            var monthlyInput = document.getElementById("monthlyPaymentInput");
            if (monthlyInput) {
                monthlyInput.value = '0';
                delete monthlyInput.dataset.manual;
            }
            
            document.getElementById("collateral").focus();
            
        } catch (error) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存'); }
            console.error("saveOrderForCustomer error:", error);
            var errMsg = error.message || error.details || error.code || JSON.stringify(error);
            if (window.Toast) {
                window.Toast.error(t('save_failed') + ': ' + errMsg);
            } else {
                alert(t('save_failed') + ': ' + errMsg);
            }
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = '💾 ' + (lang === 'id' ? 'Simpan' : '保存');
            }
        }
    },

    recalculateAllFees: function() {
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        
        var adminFee = Utils.calculateAdminFee(amount);
        var adminFeeInput = document.getElementById('adminFeeInput');
        if (adminFeeInput && !adminFeeInput.dataset.manual) {
            adminFeeInput.value = Utils.formatNumberWithCommas(adminFee);
        }
        
        var serviceFeeData = Utils.calculateServiceFeeNew(amount);
        var serviceFeeSelect = document.getElementById('serviceFeePercentSelect');
        var serviceFeeInput = document.getElementById('serviceFeeInput');
        if (serviceFeeSelect && !serviceFeeSelect.dataset.manual) {
            serviceFeeSelect.value = serviceFeeData.percent;
        }
        if (serviceFeeInput && !serviceFeeInput.dataset.manual) {
            serviceFeeInput.value = Utils.formatNumberWithCommas(serviceFeeData.amount);
        }
        
        var repaymentType = document.querySelector('input[name="repaymentType"]:checked')?.value;
        if (repaymentType === 'fixed') {
            var rateSelect = document.getElementById('agreedInterestRateSelect');
            var monthlyRate = rateSelect ? (parseFloat(rateSelect.value) || 8) / 100 : 0.08;
            var termSelect = document.getElementById('repaymentTermSelect');
            var months = termSelect ? parseInt(termSelect.value) : 5;
            
            if (amount > 0 && months > 0) {
                var monthlyPayment = Utils.calculateFixedMonthlyPayment(amount, monthlyRate, months);
                var rounded = Utils.roundMonthlyPayment(monthlyPayment);
                var monthlyInput = document.getElementById('monthlyPaymentInput');
                if (monthlyInput && !monthlyInput.dataset.manual) {
                    monthlyInput.value = Utils.formatNumberWithCommas(rounded);
                }
            }
        }
    },

    onAdminFeeManualChange: function() {
        var input = document.getElementById('adminFeeInput');
        if (input) input.dataset.manual = 'true';
    },

    recalculateServiceFee: function() {
        var select = document.getElementById('serviceFeePercentSelect');
        if (select) select.dataset.manual = 'true';
        
        var amountStr = document.getElementById('amount')?.value || '0';
        var amount = Utils.parseNumberFromCommas(amountStr) || 0;
        var percent = select ? parseFloat(select.value) : 0;
        var fee = Math.round(amount * percent / 100);
        
        var input = document.getElementById('serviceFeeInput');
        if (input) {
            input.value = Utils.formatNumberWithCommas(fee);
            input.dataset.manual = 'true';
        }
    },

    onServiceFeeManualChange: function() {
        var input = document.getElementById('serviceFeeInput');
        if (input) input.dataset.manual = 'true';
    },

    onMonthlyPaymentManualChange: function() {
        var input = document.getElementById('monthlyPaymentInput');
        if (input) input.dataset.manual = 'true';
    },

    toggleRepaymentForm: function(value) {
        var fixedForm = document.getElementById('fixedRepaymentForm');
        var flexibleCard = document.getElementById('flexibleMaxMonthsCard');
        var flexibleCardDiv = document.getElementById('flexibleCard');
        var fixedCardDiv = document.getElementById('fixedCard');
        
        if (fixedForm) fixedForm.style.display = value === 'fixed' ? 'block' : 'none';
        if (flexibleCard) flexibleCard.style.display = value === 'flexible' ? 'block' : 'none';
        
        if (flexibleCardDiv) {
            flexibleCardDiv.classList.toggle('selected', value === 'flexible');
        }
        if (fixedCardDiv) {
            fixedCardDiv.classList.toggle('selected', value === 'fixed');
        }
        
        if (value === 'fixed') APP.recalculateAllFees();
    },

    showCustomerOrders: async function(customerId) {
        APP.currentPage = 'customerOrders';
        APP.currentCustomerId = customerId;
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            const { data: orders, error } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            var statusMap = { active: t('status_active'), completed: t('status_completed'), liquidated: t('status_liquidated') };
            
            var rows = '';
            if (!orders || orders.length === 0) {
                rows = '<tr><td colspan="7" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var i = 0; i < orders.length; i++) {
                    var o = orders[i];
                    var sc = o.status === 'active' ? 'active' : (o.status === 'completed' ? 'completed' : 'liquidated');
                    var repaymentClass = o.repayment_type === 'fixed' ? 'fixed' : 'flexible';
                    var repaymentTypeText = o.repayment_type === 'fixed' 
                        ? (lang === 'id' ? 'Tetap' : '固定') 
                        : (lang === 'id' ? 'Fleksibel' : '灵活');
                    
                    rows += '<tr>' +
                        '<td class="order-id">' + Utils.escapeHtml(o.order_id) + '</td>' +
                        '<td class="date-cell">' + Utils.formatDate(o.created_at) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.loan_amount) + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(o.principal_paid) + '</td>' +
                        '<td class="text-center">' + o.interest_paid_months + ' ' + (lang === 'id' ? 'bln' : '个月') + '</td>' +
                        '<td class="text-center"><span class="repayment-badge ' + repaymentClass + '">' + repaymentTypeText + '</span></td>' +
                        '<td class="text-center"><span class="status-badge ' + sc + '">' + (statusMap[o.status] || o.status) + '</span></td>' +
                    '</tr>';
                    
                    var actionButtons = '';
                    if (o.status === 'active' && !AUTH.isAdmin()) {
                        actionButtons += '<button onclick="APP.navigateTo(\'payment\',{orderId:\'' + Utils.escapeAttr(o.order_id) + '\'})" class="btn-small success">💰 ' + (lang === 'id' ? 'Bayar' : '缴费') + '</button>';
                    }
                    actionButtons += '<button onclick="APP.navigateTo(\'viewOrder\',{orderId:\'' + Utils.escapeAttr(o.order_id) + '\'})" class="btn-small">👁️ ' + t('view') + '</button>';
                    
                    rows += '<tr class="action-row">' +
                        '<td class="action-label">' + (lang === 'id' ? 'Aksi' : '操作') + '</td>' +
                        '<td colspan="6">' +
                            '<div class="action-buttons">' + actionButtons + '</div>' +
                        '</td>' +
                    '</tr>';
                }
            }

            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>📋 ' + (lang === 'id' ? 'Order Nasabah' : '客户订单') + ' - ' + Utils.escapeHtml(customer.name) + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card customer-summary">' +
                    '<p><strong>' + (lang === 'id' ? 'ID Nasabah' : '客户ID') + ':</strong> ' + Utils.escapeHtml(customer.customer_id || '-') + '</p>' +
                    '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                    '<p><strong>' + t('ktp_number') + ':</strong> ' + Utils.escapeHtml(customer.ktp_number || '-') + '</p>' +
                    '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Pekerjaan' : '职业') + ':</strong> ' + Utils.escapeHtml(customer.occupation || '-') + '</p>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>📋 ' + t('order_list') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead><tr><th class="col-id">ID</th><th class="col-date">' + (lang === 'id' ? 'Tanggal' : '日期') + '</th><th class="col-amount amount">' + t('loan_amount') + '</th><th class="col-amount amount">' + (lang === 'id' ? 'Pokok Dibayar' : '已还本金') + '</th><th class="col-months text-center">' + (lang === 'id' ? 'Bunga Dibayar' : '已付利息') + '</th><th class="col-status text-center">' + (lang === 'id' ? 'Jenis' : '方式') + '</th><th class="col-status text-center">' + (lang === 'id' ? 'Status' : '状态') + '</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
        } catch (error) {
            console.error("showCustomerOrders error:", error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败');
            } else {
                alert(lang === 'id' ? 'Gagal memuat order nasabah' : '加载客户订单失败');
            }
        }
    },

    showCustomerPaymentHistory: async function(customerId) {
        APP.currentPage = 'customerPaymentHistory';
        APP.currentCustomerId = customerId;
        APP.saveCurrentPageState();
        var lang = Utils.lang;
        var t = function(key) { return Utils.t(key); };
        var methodMap = { cash: lang === 'id' ? '🏦 Tunai' : '💰 现金', bank: lang === 'id' ? '🏧 Bank BNI' : '🏦 银行BNI' };
        try {
            const customer = await SUPABASE.getCustomer(customerId);
            const { data: orders } = await supabaseClient.from('orders').select('id, order_id').eq('customer_id', customerId);
            var orderIds = [];
            if (orders) {
                for (var i = 0; i < orders.length; i++) {
                    orderIds.push(orders[i].id);
                }
            }
            var allPayments = [];
            if (orderIds.length > 0) {
                const { data } = await supabaseClient.from('payment_history').select('*, orders(order_id, customer_name)').in('order_id', orderIds).order('date', { ascending: false });
                allPayments = data || [];
            }
            var typeMap = { admin_fee: lang === 'id' ? 'Admin Fee' : '管理费', service_fee: lang === 'id' ? 'Service Fee' : '服务费', interest: lang === 'id' ? 'Bunga' : '利息', principal: lang === 'id' ? 'Pokok' : '本金' };
            
            var rows = '';
            if (allPayments.length === 0) {
                rows = '<tr><td colspan="7" class="text-center">' + t('no_data') + '</td></tr>';
            } else {
                for (var i = 0; i < allPayments.length; i++) {
                    var p = allPayments[i];
                    var methodClass = p.payment_method === 'cash' ? 'cash' : 'bank';
                    rows += '<tr>' +
                        '<td class="date-cell">' + Utils.formatDate(p.date) + '</td>' +
                        '<td class="order-id">' + Utils.escapeHtml(p.orders?.order_id || '-') + '</td>' +
                        '<td>' + (typeMap[p.type] || p.type) + '</td>' +
                        '<td class="text-center">' + (p.months ? p.months + (lang === 'id' ? ' bln' : ' 个月') : '-') + '</td>' +
                        '<td class="amount">' + Utils.formatCurrency(p.amount) + '</td>' +
                        '<td class="text-center"><span class="payment-method-badge ' + methodClass + '">' + (methodMap[p.payment_method] || '-') + '</span></td>' +
                        '<td class="desc-cell">' + Utils.escapeHtml(p.description || '-') + '</td>' +
                    '</tr>';
                }
            }
            document.getElementById("app").innerHTML = '' +
                '<div class="page-header">' +
                    '<h2>💰 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '付款记录') + ' - ' + Utils.escapeHtml(customer.name) + '</h2>' +
                    '<div class="header-actions">' +
                        '<button onclick="APP.goBack()" class="btn-back">↩️ ' + t('back') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="card customer-summary">' +
                    '<p><strong>' + t('customer_name') + ':</strong> ' + Utils.escapeHtml(customer.name) + '</p>' +
                    '<p><strong>' + t('phone') + ':</strong> ' + Utils.escapeHtml(customer.phone) + '</p>' +
                    '<p><strong>' + (lang === 'id' ? 'Pekerjaan' : '职业') + ':</strong> ' + Utils.escapeHtml(customer.occupation || '-') + '</p>' +
                '</div>' +
                '<div class="card">' +
                    '<h3>💰 ' + (lang === 'id' ? 'Riwayat Pembayaran' : '付款记录') + '</h3>' +
                    '<div class="table-container">' +
                        '<table class="data-table">' +
                            '<thead>' +
                                '<tr>' +
                                    '<th class="col-date">' + t('date') + '</th>' +
                                    '<th class="col-id">' + t('order_id') + '</th>' +
                                    '<th class="col-type">' + t('type') + '</th>' +
                                    '<th class="col-months text-center">' + (lang === 'id' ? 'Bulan' : '月数') + '</th>' +
                                    '<th class="col-amount amount">' + t('amount') + '</th>' +
                                    '<th class="col-method text-center">' + (lang === 'id' ? 'Metode' : '支付方式') + '</th>' +
                                    '<th class="col-desc">' + t('description') + '</th>' +
                                '</tr>' +
                            '</thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>';
        } catch (error) {
            console.error("showCustomerPaymentHistory error:", error);
            if (window.Toast) {
                window.Toast.error(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败');
            } else {
                alert(lang === 'id' ? 'Gagal memuat riwayat' : '加载记录失败');
            }
        }
    }
};

// 挂载到 window.APP
for (var key in CustomersModule) {
    if (typeof CustomersModule[key] === 'function') {
        window.APP[key] = CustomersModule[key];
    }
}

window.APP.recalculateAllFees = CustomersModule.recalculateAllFees;
window.APP.onAdminFeeManualChange = CustomersModule.onAdminFeeManualChange;
window.APP.recalculateServiceFee = CustomersModule.recalculateServiceFee;
window.APP.onServiceFeeManualChange = CustomersModule.onServiceFeeManualChange;
window.APP.onMonthlyPaymentManualChange = CustomersModule.onMonthlyPaymentManualChange;
window.APP.toggleRepaymentForm = CustomersModule.toggleRepaymentForm;
window.APP.toggleLivingAddress = CustomersModule.toggleLivingAddress;
window.APP._toggleEditLiving = CustomersModule._toggleEditLiving;
window.APP._saveEditCustomer = CustomersModule._saveEditCustomer;
window.APP.saveOrderForCustomer = CustomersModule.saveOrderForCustomer;
