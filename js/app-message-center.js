// app-message-center.js - v1.2 修复印尼文显示 + 返回按钮

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const MessageCenter = {
        STORAGE_KEY: 'jf_sent_reminders',
        
        // 获取已发送记录
        _getSentRecords() {
            try {
                const records = localStorage.getItem(this.STORAGE_KEY);
                return records ? JSON.parse(records) : {};
            } catch (e) {
                return {};
            }
        },
        
        // 标记已发送
        _markAsSent(orderId, type) {
            const records = this._getSentRecords();
            const today = Utils.getLocalToday();
            const key = `${orderId}_${type}`;
            records[key] = { orderId, type, date: today, sentAt: new Date().toISOString() };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
        },
        
        // 检查今日是否已发送
        _isSentToday(orderId, type) {
            const records = this._getSentRecords();
            const today = Utils.getLocalToday();
            const key = `${orderId}_${type}`;
            const record = records[key];
            return record && record.date === today;
        },
        
        // 清除7天前的记录
        _cleanOldRecords() {
            const records = this._getSentRecords();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            let changed = false;
            for (const key in records) {
                const recordDate = new Date(records[key].date);
                if (recordDate < sevenDaysAgo) {
                    delete records[key];
                    changed = true;
                }
            }
            if (changed) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
            }
        },

        // 获取需要提醒的消息列表
        async getPendingMessages() {
            this._cleanOldRecords();
            const lang = Utils.lang;
            const profile = await SUPABASE.getCurrentProfile();
            const isAdmin = PERMISSION.isAdmin();
            const storeId = profile?.store_id;
            
            const client = SUPABASE.getClient();
            
            let query = client.from('orders').select('*').eq('status', 'active');
            if (!isAdmin && storeId) {
                query = query.eq('store_id', storeId);
            }
            const { data: orders, error } = await query;
            if (error) throw error;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const messages = [];
            const storeWA = await SUPABASE.getStoreWANumber(storeId);
            
            for (const order of orders || []) {
                // 1. 到期前 2 天提醒
                const dueDate = order.next_interest_due_date;
                if (dueDate) {
                    const due = new Date(dueDate);
                    due.setHours(0, 0, 0, 0);
                    const daysUntilDue = Math.ceil((due - today) / 86400000);
                    
                    if (daysUntilDue === 2 && !this._isSentToday(order.id, 'upcoming')) {
                        const waMessage = JF.WAPage.generateWAText(order, storeWA);
                        messages.push({
                            orderId: order.order_id,
                            type: 'upcoming',
                            typeLabel: lang === 'id' ? '🔔 Segera Jatuh Tempo (2 hari lagi)' : '🔔 即将到期 (2天后)',
                            customerName: order.customer_name,
                            customerPhone: order.customer_phone,
                            dueDate: Utils.formatDate(dueDate),
                            waMessage: waMessage,
                            overdueDays: 0
                        });
                    }
                }
                
                // 2. 逾期提醒
                const overdueDays = order.overdue_days || 0;
                if (overdueDays > 0 && !this._isSentToday(order.id, `overdue_${overdueDays}`)) {
                    const waMessage = JF.WAPage.generateWAText(order, storeWA);
                    messages.push({
                        orderId: order.order_id,
                        type: 'overdue',
                        typeLabel: lang === 'id' ? `⚠️ Terlambat ${overdueDays} hari` : `⚠️ 逾期 ${overdueDays} 天`,
                        customerName: order.customer_name,
                        customerPhone: order.customer_phone,
                        overdueDays: overdueDays,
                        dueDate: order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-',
                        waMessage: waMessage,
                        amount: this._getPaymentAmount(order)
                    });
                }
            }
            
            // 按逾期天数排序（逾期多的在前）
            messages.sort((a, b) => (b.overdueDays || 0) - (a.overdueDays || 0));
            
            // 去重：同一订单只保留第一条（逾期提醒优先）
            const seen = new Set();
            const uniqueMessages = [];
            for (const msg of messages) {
                if (!seen.has(msg.orderId)) {
                    seen.add(msg.orderId);
                    uniqueMessages.push(msg);
                }
            }
            
            return uniqueMessages;
        },
        
        _getPaymentAmount(order) {
            if (order.repayment_type === 'fixed') {
                return order.monthly_fixed_payment || 0;
            } else {
                const remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
                const monthlyRate = order.agreed_interest_rate || 0.08;
                return remainingPrincipal * monthlyRate;
            }
        },

        // 显示消息中心页面
        async showMessageCenter() {
            APP.currentPage = 'messageCenter';
            APP.saveCurrentPageState();
            
            const lang = Utils.lang;
            const t = Utils.t.bind(Utils);
            
            try {
                const messages = await this.getPendingMessages();
                const storeWA = await SUPABASE.getStoreWANumber(null);
                
                let rows = '';
                if (messages.length === 0) {
                    rows = `<tr><td colspan="5" class="text-center">✅ ${lang === 'id' ? 'Tidak ada pesan tertunda' : '暂无待发送消息'}</td></tr>`;
                } else {
                    for (let i = 0; i < messages.length; i++) {
                        const m = messages[i];
                        rows += `<tr>
                            <td class="text-center" style="width:40px;">${i + 1}</td>
                            <td class="order-id">${Utils.escapeHtml(m.orderId)}</td>
                            <td class="col-name">${Utils.escapeHtml(m.customerName)}</td>
                            <td class="col-status">${m.typeLabel}</td>
                            <td class="text-center" style="white-space:nowrap;">
                                <button onclick="MessageCenter.copyToClipboard('${Utils.escapeAttr(m.waMessage)}', '${Utils.escapeAttr(m.orderId)}')" class="btn btn--sm btn--primary">📋 ${lang === 'id' ? 'Salin Pesan' : '复制消息'}</button>
                                <button onclick="MessageCenter.markAsSentAndRemove('${Utils.escapeAttr(m.orderId)}', '${m.type}')" class="btn btn--sm btn--success">✅ ${lang === 'id' ? 'Tandai Terkirim' : '标记已发送'}</button>
                                <button onclick="MessageCenter.openWhatsApp('${Utils.escapeAttr(m.customerPhone)}', '${Utils.escapeAttr(m.waMessage)}')" class="btn btn--sm btn--warning">📱 ${lang === 'id' ? 'Buka WA' : '打开WA'}</button>
                            </td>
                        </tr>`;
                    }
                }
                
                // 生成汇总文本（批量复制用）
                let bulkText = '';
                for (const m of messages) {
                    bulkText += m.waMessage + '\n\n---\n\n';
                }
                
                const content = `
                    <div class="page-header">
                        <h2>💬 ${lang === 'id' ? 'Pusat Pesan' : '消息中心'}</h2>
                        <div class="header-actions">
                            <button id="messageCenterBackBtn" class="btn btn--outline">↩️ ${t('back')}</button>
                            <button onclick="MessageCenter.refresh()" class="btn btn--outline">🔄 ${lang === 'id' ? 'Refresh' : '刷新'}</button>
                        </div>
                    </div>
                    
                    <div class="info-bar info">
                        <span class="info-bar-icon">💡</span>
                        <div class="info-bar-content">
                            <strong>${lang === 'id' ? 'Panduan:' : '使用说明：'}</strong><br>
                            ${lang === 'id' 
                                ? '1. Klik 「Salin Pesan」 → 2. Buka WhatsApp → 3. Tempel dan kirim<br>4. Setelah terkirim, klik 「Tandai Terkirim」 untuk menghindari pengingat ganda'
                                : '1. 点击「复制消息」→ 2. 打开 WhatsApp → 3. 粘贴并发送<br>4. 发送后点击「标记已发送」避免重复提醒'}
                        </div>
                    </div>
                    
                    ${messages.length > 0 ? `
                    <div class="card" style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div><strong>📊 ${lang === 'id' ? 'Pesan Tertunda' : '待发送消息'}: ${messages.length} ${lang === 'id' ? 'pesan' : '条'}</strong></div>
                            <button onclick="MessageCenter.copyAllToClipboard()" class="btn btn--success" id="copyAllBtn">📋 ${lang === 'id' ? 'Salin Semua Pesan' : '复制全部消息'}</button>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="card">
                        <h3>${lang === 'id' ? 'Daftar Pesan Tertunda' : '待发送消息列表'}</h3>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th class="text-center" style="width:40px;">#</th>
                                        <th class="col-id">${t('order_id')}</th>
                                        <th class="col-name">${t('customer_name')}</th>
                                        <th class="col-status">${lang === 'id' ? 'Jenis Pengingat' : '提醒类型'}</th>
                                        <th class="text-center">${lang === 'id' ? 'Aksi' : '操作'}</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                    </div>
                    
                    <textarea id="bulkMessageTextarea" style="position: fixed; left: -9999px; top: -9999px;">${Utils.escapeHtml(bulkText)}</textarea>
                `;
                
                document.getElementById("app").innerHTML = content;
                
                // 修复返回按钮：手动绑定事件
                const backBtn = document.getElementById('messageCenterBackBtn');
                if (backBtn) {
                    backBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (typeof APP !== 'undefined' && APP.goBack) {
                            APP.goBack();
                        } else if (typeof JF !== 'undefined' && JF.DashboardCore && JF.DashboardCore.goBack) {
                            JF.DashboardCore.goBack();
                        } else {
                            window.history.back();
                        }
                    };
                }
                
            } catch (error) {
                console.error("showMessageCenter error:", error);
                Utils.toast.error(lang === 'id' ? 'Gagal memuat pesan' : '加载消息失败');
            }
        },
        
        // 复制单条消息
        copyToClipboard(message, orderId) {
            const lang = Utils.lang;
            navigator.clipboard.writeText(message).then(() => {
                Utils.toast.success(lang === 'id' ? `Pesan untuk ${orderId} disalin` : `${orderId} 的消息已复制`);
            }).catch(() => {
                Utils.toast.error(lang === 'id' ? 'Gagal menyalin' : '复制失败');
            });
        },
        
        // 复制全部消息
        copyAllToClipboard() {
            const textarea = document.getElementById('bulkMessageTextarea');
            if (!textarea) return;
            const lang = Utils.lang;
            textarea.select();
            document.execCommand('copy');
            Utils.toast.success(lang === 'id' ? 'Semua pesan disalin' : '全部消息已复制');
        },
        
        // 标记已发送并移除
        async markAsSentAndRemove(orderId, type) {
            await this._markAsSent(orderId, type);
            Utils.toast.success(Utils.lang === 'id' ? 'Telah ditandai terkirim' : '已标记为已发送');
            await this.showMessageCenter();
        },
        
        // 打开 WhatsApp
        openWhatsApp(phone, message) {
            let cleanPhone = phone.replace(/[^0-9]/g, '');
            if (!cleanPhone.startsWith('62')) {
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '62' + cleanPhone.substring(1);
                } else {
                    cleanPhone = '62' + cleanPhone;
                }
            }
            const encodedMessage = encodeURIComponent(message);
            window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, '_blank');
        },
        
        // 刷新页面
        refresh() {
            this.showMessageCenter();
        }
    };

    // 挂载到命名空间
    JF.MessageCenter = MessageCenter;
    
    // 挂载到 APP
    if (window.APP) {
        window.APP.showMessageCenter = MessageCenter.showMessageCenter.bind(MessageCenter);
    } else {
        window.APP = { showMessageCenter: MessageCenter.showMessageCenter.bind(MessageCenter) };
    }

    console.log('✅ JF.MessageCenter v1.2 修复完成（印尼文显示 + 返回按钮）');
})();
