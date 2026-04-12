// ============================================
// 数据迁移工具 - 从 localStorage 迁移到 Supabase
// ============================================

const Migration = {
    // 是否正在迁移
    isMigrating: false,
    
    // 迁移进度
    progress: {
        total: 0,
        current: 0,
        success: 0,
        failed: 0
    },
    
    // 开始迁移
    async startMigration() {
        this.isMigrating = true;
        this.resetProgress();
        
        // 从 localStorage 读取旧数据
        const oldDb = this.loadLocalStorage();
        if (!oldDb || !oldDb.orders) {
            alert(Utils.lang === 'id' ? 'Tidak ada data untuk dimigrasi' : '没有需要迁移的数据');
            this.isMigrating = false;
            return;
        }
        
        const orders = oldDb.orders;
        this.progress.total = orders.length;
        
        // 获取门店映射
        const stores = await SUPABASE.getAllStores();
        const storeMap = {};
        for (const store of stores) {
            storeMap[store.name] = store.id;
        }
        
        // 获取管理员用户（用于 created_by）
        const users = await SUPABASE.getAllUsers();
        const adminUser = users.find(u => u.role === 'admin');
        
        if (!adminUser) {
            alert(Utils.lang === 'id' ? 'Admin user tidak ditemukan' : '未找到管理员用户');
            this.isMigrating = false;
            return;
        }
        
        // 逐个迁移订单
        for (const order of orders) {
            try {
                await this.migrateOrder(order, storeMap, adminUser.id);
                this.progress.success++;
            } catch (error) {
                console.error('Migration failed for order:', order.order_id, error);
                this.progress.failed++;
            }
            this.progress.current++;
            this.updateProgressDisplay();
        }
        
        this.isMigrating = false;
        this.showMigrationResult();
    },
    
    // 加载 localStorage 数据
    loadLocalStorage() {
        const key = "jf_enterprise_db";
        const data = localStorage.getItem(key);
        if (data) {
            return JSON.parse(data);
        }
        return null;
    },
    
    // 迁移单个订单
    async migrateOrder(oldOrder, storeMap, adminUserId) {
        // 确定门店ID（旧数据中可能有 branch 字段，否则使用第一个门店）
        let storeId = null;
        if (oldOrder.branch && storeMap[oldOrder.branch]) {
            storeId = storeMap[oldOrder.branch];
        } else {
            const stores = await SUPABASE.getAllStores();
            if (stores.length > 0) {
                storeId = stores[0].id;
            }
        }
        
        if (!storeId) {
            throw new Error('No store available');
        }
        
        // 准备订单数据
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
        
        // 计算 principal_remaining 如果没有
        if (!orderData.principal_remaining) {
            orderData.principal_remaining = orderData.loan_amount - orderData.principal_paid;
        }
        
        // 插入订单
        const { data: newOrder, error: orderError } = await SUPABASE.getClient()
            .from('orders')
            .insert(orderData)
            .select()
            .single();
        
        if (orderError) throw orderError;
        
        // 迁移支付记录
        if (oldOrder.payment_history && oldOrder.payment_history.length > 0) {
            for (const payment of oldOrder.payment_history) {
                const paymentData = {
                    order_id: newOrder.id,
                    date: payment.date || new Date().toISOString().split('T')[0],
                    type: payment.type,
                    months: payment.months || null,
                    amount: payment.amount,
                    description: payment.description || '',
                    recorded_by: adminUserId,
                    created_at: new Date().toISOString()
                };
                
                const { error: paymentError } = await SUPABASE.getClient()
                    .from('payment_history')
                    .insert(paymentData);
                
                if (paymentError) {
                    console.error('Payment migration error:', paymentError);
                }
            }
        }
        
        return newOrder;
    },
    
    // 重置进度
    resetProgress() {
        this.progress = {
            total: 0,
            current: 0,
            success: 0,
            failed: 0
        };
    },
    
    // 更新进度显示
    updateProgressDisplay() {
        const progressDiv = document.getElementById('migrationProgress');
        if (progressDiv) {
            const percent = (this.progress.current / this.progress.total * 100).toFixed(1);
            progressDiv.innerHTML = `
                <div style="background: #1e293b; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <p>📊 ${Utils.lang === 'id' ? 'Migrasi Berjalan' : '迁移中'}... ${this.progress.current}/${this.progress.total}</p>
                    <div style="background: #334155; border-radius: 10px; height: 20px; overflow: hidden;">
                        <div style="background: #10b981; width: ${percent}%; height: 100%; border-radius: 10px;"></div>
                    </div>
                    <p>✅ ${Utils.lang === 'id' ? 'Berhasil' : '成功'}: ${this.progress.success} | ❌ ${Utils.lang === 'id' ? 'Gagal' : '失败'}: ${this.progress.failed}</p>
                </div>
            `;
        }
    },
    
    // 显示迁移结果
    showMigrationResult() {
        const lang = Utils.lang;
        const message = lang === 'id' 
            ? `Migrasi selesai!\nBerhasil: ${this.progress.success}\nGagal: ${this.progress.failed}`
            : `迁移完成！\n成功: ${this.progress.success}\n失败: ${this.progress.failed}`;
        alert(message);
        
        // 刷新页面
        if (this.progress.success > 0) {
            location.reload();
        }
    },
    
    // 渲染迁移界面
    renderMigrationUI() {
        const lang = Utils.lang;
        const html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>📦 ${lang === 'id' ? 'Migrasi Data' : '数据迁移'}</h2>
                <div>
                    <button onclick="APP.toggleLanguage()">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    <button onclick="APP.goBack()">↩️ ${Utils.t('back')}</button>
                </div>
            </div>
            
            <div class="card">
                <h3>${lang === 'id' ? 'Migrasi dari localStorage ke Supabase' : '从 localStorage 迁移到 Supabase'}</h3>
                <p style="color: #f59e0b; margin-bottom: 15px;">
                    ⚠️ ${lang === 'id' 
                        ? 'Pastikan Anda sudah login sebagai admin sebelum migrasi. Migrasi akan mengimpor semua data orders dari browser Anda ke cloud.' 
                        : '请确保在迁移前已以管理员身份登录。迁移会将您浏览器中的所有订单数据导入云端。'}
                </p>
                <div id="migrationProgress"></div>
                <button onclick="Migration.startMigration()" class="success" ${this.isMigrating ? 'disabled' : ''}>
                    🚀 ${lang === 'id' ? 'Mulai Migrasi' : '开始迁移'}
                </button>
            </div>
        `;
        
        document.getElementById("app").innerHTML = html;
    }
};

window.Migration = Migration;
