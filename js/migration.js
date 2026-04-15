const Migration = {
    isMigrating: false,
    progress: { total: 0, current: 0, success: 0, failed: 0, skipped: 0 },
    failedOrders: [],

    async startMigration() {
        if (this.isMigrating) return;
        this.isMigrating = true;
        this.failedOrders = [];
        this.resetProgress();

        const oldDb = this.loadLocalStorage();
        if (!oldDb || !oldDb.orders || oldDb.orders.length === 0) {
            alert(Utils.lang === 'id' ? 'Tidak ada data untuk dimigrasi' : '没有需要迁移的数据');
            this.isMigrating = false;
            return;
        }

        const orders = oldDb.orders;
        this.progress.total = orders.length;

        let stores, adminUser;
        try {
            stores = await SUPABASE.getAllStores();
            const allUsers = await SUPABASE.getAllUsers();
            adminUser = allUsers.find(u => u.role === 'admin');
        } catch (err) {
            alert(Utils.lang === 'id' ? 'Gagal memuat data awal: ' + err.message : '加载初始数据失败：' + err.message);
            this.isMigrating = false;
            return;
        }

        if (!adminUser) {
            alert(Utils.lang === 'id' ? 'Admin user tidak ditemukan' : '未找到管理员用户');
            this.isMigrating = false;
            return;
        }

        const storeMap = {};
        for (const store of stores) storeMap[store.name] = store.id;
        const defaultStoreId = stores.length > 0 ? stores[0].id : null;

        let existingIds = new Set();
        try {
            const existing = await SUPABASE.getOrders();
            existingIds = new Set(existing.map(o => o.order_id));
        } catch (e) { }

        const BATCH_SIZE = 10;
        for (let i = 0; i < orders.length; i += BATCH_SIZE) {
            const batch = orders.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(order =>
                this._migrateSingleOrder(order, storeMap, defaultStoreId, adminUser.id, existingIds)
            );
            const results = await Promise.allSettled(batchPromises);
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    if (result.value === 'skipped') this.progress.skipped++;
                    else this.progress.success++;
                } else {
                    this.progress.failed++;
                    this.failedOrders.push(result.reason?.orderId || '未知');
                }
                this.progress.current++;
                this.updateProgressDisplay();
            }
        }

        this.isMigrating = false;
        this.showMigrationResult();
    },

    async _migrateSingleOrder(oldOrder, storeMap, defaultStoreId, adminUserId, existingIds) {
        if (existingIds.has(oldOrder.order_id)) return 'skipped';

        let storeId = (oldOrder.branch && storeMap[oldOrder.branch])
            ? storeMap[oldOrder.branch]
            : defaultStoreId;

        if (!storeId) throw Object.assign(new Error('No store available'), { orderId: oldOrder.order_id });

        const orderData = {
            order_id: oldOrder.order_id,
            customer_name: oldOrder.customer?.name || 'Unknown',
            customer_ktp: oldOrder.customer?.ktp || '',
            customer_phone: oldOrder.customer?.phone || '',
            customer_address: oldOrder.customer?.address || '',
            collateral_name: oldOrder.collateral_name || '',
            loan_amount: oldOrder.loan_amount || 0,
            admin_fee: oldOrder.admin_fee || 30000,
            admin_fee_paid: oldOrder.admin_fee_paid || false,
            admin_fee_paid_date: oldOrder.admin_fee_paid_date || null,
            monthly_interest: oldOrder.monthly_interest || ((oldOrder.loan_amount || 0) * 0.10),
            interest_paid_months: oldOrder.interest_paid_months || 0,
            interest_paid_total: oldOrder.interest_paid_total || 0,
            next_interest_due_date: oldOrder.next_interest_due_date || null,
            principal_paid: oldOrder.principal_paid || 0,
            principal_remaining: oldOrder.principal_remaining || oldOrder.loan_amount || 0,
            status: oldOrder.status || 'active',
            store_id: storeId,
            created_by: adminUserId,
            created_at: oldOrder.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by: adminUserId,
            notes: oldOrder.notes || ''
        };

        const { data: newOrder, error: orderError } = await SUPABASE.getClient()
            .from('orders').insert(orderData).select().single();
        if (orderError) throw Object.assign(orderError, { orderId: oldOrder.order_id });

        if (oldOrder.payment_history && oldOrder.payment_history.length > 0) {
            const paymentRows = oldOrder.payment_history.map(payment => ({
                order_id: newOrder.id,
                date: payment.date || new Date().toISOString().split('T')[0],
                type: payment.type,
                months: payment.months || null,
                amount: payment.amount,
                description: payment.description || '',
                recorded_by: adminUserId
            }));
            const { error: paymentError } = await SUPABASE.getClient()
                .from('payment_history').insert(paymentRows);
            if (paymentError) console.warn('付款记录迁移失败:', oldOrder.order_id, paymentError);
        }

        return newOrder;
    },

    loadLocalStorage() {
        const data = localStorage.getItem("jf_enterprise_db");
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    resetProgress() {
        this.progress = { total: 0, current: 0, success: 0, failed: 0, skipped: 0 };
    },

    updateProgressDisplay() {
        const progressDiv = document.getElementById('migrationProgress');
        if (!progressDiv) return;
        const percent = this.progress.total > 0
            ? ((this.progress.current / this.progress.total) * 100).toFixed(1)
            : 0;
        const lang = Utils.lang;
        progressDiv.innerHTML = `
            <div class="migration-progress">
                <p>📊 ${lang === 'id' ? 'Migrasi Berjalan' : '迁移中'}... ${this.progress.current}/${this.progress.total}</p>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width:${percent}%;"></div>
                </div>
                <p class="progress-stats">
                    ✅ ${lang === 'id' ? 'Berhasil' : '成功'}: ${this.progress.success} &nbsp;
                    ⏭️ ${lang === 'id' ? 'Dilewati' : '已跳过'}: ${this.progress.skipped} &nbsp;
                    ❌ ${lang === 'id' ? 'Gagal' : '失败'}: ${this.progress.failed}
                </p>
            </div>`;
    },

    showMigrationResult() {
        const lang = Utils.lang;
        let msg = lang === 'id'
            ? `Migrasi selesai!\nBerhasil: ${this.progress.success}\nDilewati (sudah ada): ${this.progress.skipped}\nGagal: ${this.progress.failed}`
            : `迁移完成！\n成功: ${this.progress.success}\n已跳过（已存在）: ${this.progress.skipped}\n失败: ${this.progress.failed}`;
        if (this.failedOrders.length > 0) {
            msg += '\n' + (lang === 'id' ? 'ID gagal: ' : '失败ID: ') + this.failedOrders.slice(0, 5).join(', ');
            if (this.failedOrders.length > 5) msg += '...';
        }
        alert(msg);
        if (this.progress.success > 0) location.reload();
    },

    renderMigrationUI() {
        const lang = Utils.lang;
        const html = `
            <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2>📦 ${lang === 'id' ? 'Migrasi Data' : '数据迁移'}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()" class="lang-btn">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
                </div>
            </div>
            <div class="card">
                <h3>${lang === 'id' ? 'Migrasi dari localStorage ke Supabase' : '从 localStorage 迁移到 Supabase'}</h3>
                <p class="migration-info">
                    ${lang === 'id'
                        ? '• Data yang sudah ada di Supabase akan dilewati otomatis<br>• Migrasi berjalan paralel (lebih cepat)<br>• Jika gagal sebagian, data yang sudah berhasil tetap tersimpan'
                        : '• 已存在于 Supabase 的数据将自动跳过<br>• 并行迁移（速度更快）<br>• 部分失败不影响已成功的记录'}
                </p>
                <p class="migration-warning">
                    ⚠️ ${lang === 'id' ? 'Pastikan Anda sudah login sebagai admin sebelum migrasi.' : '请确保在迁移前已以管理员身份登录。'}
                </p>
                <div id="migrationProgress"></div>
                <button onclick="Migration.startMigration()" class="success" id="migrateBtn">
                    🚀 ${lang === 'id' ? 'Mulai Migrasi' : '开始迁移'}
                </button>
            </div>
            <style>
                .migration-progress { background: #1e293b; padding: 15px; border-radius: 8px; margin-top: 15px; }
                .progress-bar-container { background: #334155; border-radius: 10px; height: 20px; overflow: hidden; }
                .progress-bar-fill { background: #10b981; height: 100%; border-radius: 10px; transition: width 0.3s; }
                .progress-stats { margin-top: 8px; color: #94a3b8; font-size: 13px; }
                .migration-info { color: #94a3b8; margin-bottom: 8px; line-height: 1.5; }
                .migration-warning { color: #f59e0b; margin-bottom: 15px; }
            </style>`;
        document.getElementById("app").innerHTML = html;
    }
};

window.Migration = Migration;
