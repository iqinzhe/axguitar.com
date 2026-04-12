const Migration = {
    isMigrating: false,
    progress: { total: 0, current: 0, success: 0, failed: 0 },
    
    async startMigration() {
        this.isMigrating = true;
        this.resetProgress();
        const oldDb = this.loadLocalStorage();
        if (!oldDb || !oldDb.orders) {
            alert(Utils.lang === 'id' ? 'Tidak ada data untuk dimigrasi' : '没有需要迁移的数据');
            this.isMigrating = false;
            return;
        }
        const orders = oldDb.orders;
        this.progress.total = orders.length;
        const stores = await SUPABASE.getAllStores();
        const storeMap = {};
        for (const store of stores) storeMap[store.name] = store.id;
        const adminUser = (await SUPABASE.getAllUsers()).find(u => u.role === 'admin');
        if (!adminUser) {
            alert(Utils.lang === 'id' ? 'Admin user tidak ditemukan' : '未找到管理员用户');
            this.isMigrating = false;
            return;
        }
        for (const order of orders) {
            try {
                await this.migrateOrder(order, storeMap, adminUser.id);
                this.progress.success++;
            } catch (error) {
                this.progress.failed++;
            }
            this.progress.current++;
            this.updateProgressDisplay();
        }
        this.isMigrating = false;
        this.showMigrationResult();
    },
    
    loadLocalStorage() {
        const data = localStorage.getItem("jf_enterprise_db");
        return data ? JSON.parse(data) : null;
    },
    
    async migrateOrder(oldOrder, storeMap, adminUserId) {
        let storeId = null;
        if (oldOrder.branch && storeMap[oldOrder.branch]) storeId = storeMap[oldOrder.branch];
        else {
            const stores = await SUPABASE.getAllStores();
            if (stores.length > 0) storeId = stores[0].id;
        }
        if (!storeId) throw new Error('No store available');
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
            monthly_interest: oldOrder.monthly_interest || (oldOrder.loan_amount * 0.10),
            interest_paid_months: oldOrder.interest_paid_months || 0,
            interest_paid_total: oldOrder.interest_paid_total || 0,
            next_interest_due_date: oldOrder.next_interest_due_date || null,
            principal_paid: oldOrder.principal_paid || 0,
            principal_remaining: oldOrder.principal_remaining || oldOrder.loan_amount,
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
        const { data: newOrder, error: orderError } = await SUPABASE.getClient().from('orders').insert(orderData).select().single();
        if (orderError) throw orderError;
        if (oldOrder.payment_history && oldOrder.payment_history.length > 0) {
            for (const payment of oldOrder.payment_history) {
                await SUPABASE.getClient().from('payment_history').insert({
                    order_id: newOrder.id, date: payment.date || new Date().toISOString().split('T')[0],
                    type: payment.type, months: payment.months || null, amount: payment.amount,
                    description: payment.description || '', recorded_by: adminUserId
                });
            }
        }
        return newOrder;
    },
    
    resetProgress() { this.progress = { total: 0, current: 0, success: 0, failed: 0 }; },
    
    updateProgressDisplay() {
        const progressDiv = document.getElementById('migrationProgress');
        if (progressDiv) {
            const percent = (this.progress.current / this.progress.total * 100).toFixed(1);
            progressDiv.innerHTML = `<div style="background:#1e293b;padding:15px;border-radius:8px;margin-top:15px;"><p>📊 ${Utils.lang === 'id' ? 'Migrasi Berjalan' : '迁移中'}... ${this.progress.current}/${this.progress.total}</p><div style="background:#334155;border-radius:10px;height:20px;overflow:hidden;"><div style="background:#10b981;width:${percent}%;height:100%;border-radius:10px;"></div></div><p>✅ ${Utils.lang === 'id' ? 'Berhasil' : '成功'}: ${this.progress.success} | ❌ ${Utils.lang === 'id' ? 'Gagal' : '失败'}: ${this.progress.failed}</p></div>`;
        }
    },
    
    showMigrationResult() {
        alert(`${Utils.lang === 'id' ? 'Migrasi selesai!\nBerhasil: ' : '迁移完成！\n成功: '}${this.progress.success}\n${Utils.lang === 'id' ? 'Gagal: ' : '失败: '}${this.progress.failed}`);
        if (this.progress.success > 0) location.reload();
    },
    
    renderMigrationUI() {
        const lang = Utils.lang;
        const html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2>📦 ${lang === 'id' ? 'Migrasi Data' : '数据迁移'}</h2><div><button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button><button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button></div></div><div class="card"><h3>${lang === 'id' ? 'Migrasi dari localStorage ke Supabase' : '从 localStorage 迁移到 Supabase'}</h3><p style="color:#f59e0b;margin-bottom:15px;">⚠️ ${lang === 'id' ? 'Pastikan Anda sudah login sebagai admin sebelum migrasi.' : '请确保在迁移前已以管理员身份登录。'}</p><div id="migrationProgress"></div><button onclick="Migration.startMigration()" class="success">🚀 ${lang === 'id' ? 'Mulai Migrasi' : '开始迁移'}</button></div>`;
        document.getElementById("app").innerHTML = html;
    }
};

window.Migration = Migration;
