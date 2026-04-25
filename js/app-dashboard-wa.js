// app-dashboard-wa.js - v2.0（WA提醒模板优化：每订单独立信息，杜绝张冠李戴）

window.APP = window.APP || {};

const DashboardWA = {

    // ==================== WA 提醒功能 ====================
    getSenderWANumber: async function(storeId) {
        return await SUPABASE.getStoreWANumber(storeId);
    },

    // ========== 修复：使用订单自己的利率，而非全局常量 ==========
    generateWAText: function(order, senderNumber) {
        var lang = Utils.lang;
        
        // 关键修复：使用订单自己的利率（agreed_interest_rate）
        // 如果订单没有设置利率，默认使用 8%（0.08）
        var monthlyRate = order.agreed_interest_rate || 0.08;
        
        // 计算剩余本金
        var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
        
        // 计算当前月利息 = 剩余本金 × 该订单的月利率
        var currentMonthlyInterest = remainingPrincipal * monthlyRate;
        
        // 获取到期日（如果订单有自己的到期日，否则计算）
        var dueDate = order.next_interest_due_date 
            ? Utils.formatDate(order.next_interest_due_date) 
            : '-';
        
        // 获取订单的还款类型
        var repaymentType = order.repayment_type || 'flexible';
        var repaymentTypeText = (repaymentType === 'fixed') 
            ? (lang === 'id' ? 'Cicilan Tetap' : '固定还款')
            : (lang === 'id' ? 'Cicilan Fleksibel' : '灵活还款');
        
        // 如果是固定还款，获取每月应还金额
        var monthlyFixedPayment = order.monthly_fixed_payment || 0;
        
        if (lang === 'id') {
            // ========== 印尼语模板 ==========
            var baseText = `*Pengingat Pembayaran - JF! by Gadai*

Kepada Yth. Bapak/Ibu ${order.customer_name}

Kami ingatkan bahwa tagihan untuk pesanan dengan detail berikut:

📋 *ID Pesanan:* ${order.order_id}
💰 *Sisa Pokok:* ${Utils.formatCurrency(remainingPrincipal)}
📈 *Suku Bunga:* ${(monthlyRate * 100).toFixed(0)}% per bulan
📅 *Jatuh Tempo:* ${dueDate}`;

            if (repaymentType === 'fixed') {
                baseText += `
💳 *Jenis Cicilan:* ${repaymentTypeText}
💰 *Angsuran Bulanan:* ${Utils.formatCurrency(monthlyFixedPayment)}
✅ *Angsuran Ke-:* ${(order.fixed_paid_months || 0) + 1} / ${order.repayment_term || '?'}`;
            } else {
                baseText += `
💳 *Jenis Cicilan:* ${repaymentTypeText}
📈 *Bunga Bulan Ini:* ${Utils.formatCurrency(currentMonthlyInterest)}`;
            }

            baseText += `

Harap melakukan pembayaran tepat waktu.

Terima kasih atas kepercayaan Anda.

- ${senderNumber || 'JF! by Gadai'}`;
            
            return baseText;
            
        } else {
            // ========== 中文模板 ==========
            var baseText = `*缴费提醒 - JF! by Gadai*

尊敬的 ${order.customer_name} 先生/女士：

提醒您以下订单需要缴费：

📋 *订单号:* ${order.order_id}
💰 *剩余本金:* ${Utils.formatCurrency(remainingPrincipal)}
📈 *月利率:* ${(monthlyRate * 100).toFixed(0)}%
📅 *到期日:* ${dueDate}`;

            if (repaymentType === 'fixed') {
                baseText += `
💳 *还款方式:* ${repaymentTypeText}
💰 *每月应还:* ${Utils.formatCurrency(monthlyFixedPayment)}
✅ *第几期:* ${(order.fixed_paid_months || 0) + 1} / ${order.repayment_term || '?'}`;
            } else {
                baseText += `
💳 *还款方式:* ${repaymentTypeText}
📈 *本月利息:* ${Utils.formatCurrency(currentMonthlyInterest)}`;
            }

            baseText += `

请按时缴费。

感谢您的信任。

- ${senderNumber || 'JF! by Gadai'}`;
            
            return baseText;
        }
    },

    hasSentRemindersToday: async function() {
        var profile = await SUPABASE.getCurrentProfile();
        var today = new Date().toISOString().split('T')[0];
        var storeId = profile?.store_id;
        
        if (!storeId) return false;
        
        var { data, error } = await supabaseClient
            .from('reminder_logs')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('reminder_date', today);
        
        if (error) return false;
        return (data?.length || 0) > 0;
    },

    // ========== 发送单个订单的 WA 提醒 ==========
    sendWAReminder: async function(orderId) {
        var lang = Utils.lang;
        try {
            // 获取完整的订单信息（包含所有字段）
            var order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(lang === 'id' ? 'Order tidak ditemukan' : '订单不存在');
                return;
            }
            
            // 获取门店的 WA 号码
            var storeId = order.store_id;
            var senderNumber = await SUPABASE.getStoreWANumber(storeId);
            
            if (!senderNumber) {
                alert(lang === 'id' 
                    ? 'Nomor WhatsApp toko belum diatur. Silakan atur di menu Manajemen Toko.'
                    : '门店 WhatsApp 号码未设置，请在门店管理中设置。');
                return;
            }
            
            // 获取客户手机号
            var customerPhone = order.customer_phone;
            if (!customerPhone) {
                alert(lang === 'id' ? 'Nomor telepon pelanggan tidak tersedia' : '客户手机号不可用');
                return;
            }
            
            // 生成针对该订单的个性化 WA 文本
            var waText = encodeURIComponent(this.generateWAText(order, senderNumber));
            var waUrl = `https://wa.me/${customerPhone}?text=${waText}`;
            
            // 在新窗口打开 WA
            window.open(waUrl, '_blank');
            
        } catch (error) {
            console.error("sendWAReminder error:", error);
            alert(lang === 'id' ? 'Gagal mengirim pengingat WA' : '发送 WA 提醒失败');
        }
    },

    // ========== 批量发送每日提醒 ==========
    sendDailyReminders: async function() {
        var lang = Utils.lang;
        
        // 检查今日是否已发送
        var hasSent = await this.hasSentRemindersToday();
        if (hasSent) {
            alert(lang === 'id' 
                ? 'Pengingat sudah dikirim hari ini. Silakan coba lagi besok.'
                : '今日已发送过提醒，请明天再试。');
            return;
        }
        
        // 获取需要提醒的订单列表
        var needRemindOrders = await SUPABASE.getOrdersNeedReminder();
        if (needRemindOrders.length === 0) {
            alert(lang === 'id' 
                ? 'Tidak ada pesanan yang perlu diingatkan hari ini.'
                : '今天没有需要提醒的订单。');
            return;
        }
        
        var confirmMsg = lang === 'id'
            ? `Akan mengirimkan pengingat WA ke ${needRemindOrders.length} nasabah. Lanjutkan?`
            : `将向 ${needRemindOrders.length} 位客户发送 WA 提醒。继续吗？`;
        
        if (!confirm(confirmMsg)) return;
        
        var successCount = 0;
        var failCount = 0;
        var failedOrders = [];
        
        for (var order of needRemindOrders) {
            try {
                // 获取门店 WA 号码
                var storeId = order.store_id;
                var senderNumber = await SUPABASE.getStoreWANumber(storeId);
                if (!senderNumber) {
                    failCount++;
                    failedOrders.push({ orderId: order.order_id, reason: 'No WA toko tidak tersedia' });
                    continue;
                }
                
                // 获取客户手机号
                var customerPhone = order.customer_phone;
                if (!customerPhone) {
                    failCount++;
                    failedOrders.push({ orderId: order.order_id, reason: 'No telepon pelanggan tidak tersedia' });
                    continue;
                }
                
                // 生成个性化 WA 文本
                var waText = encodeURIComponent(this.generateWAText(order, senderNumber));
                var waUrl = `https://wa.me/${customerPhone}?text=${waText}`;
                
                // 打开 WA（批量发送时会有多个窗口，稍作延迟避免浏览器拦截）
                window.open(waUrl, '_blank');
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒延迟
                successCount++;
                
            } catch (e) {
                console.error("发送提醒失败:", e);
                failCount++;
                failedOrders.push({ orderId: order.order_id, reason: e.message });
            }
        }
        
        // 记录发送日志
        if (successCount > 0) {
            var profile = await SUPABASE.getCurrentProfile();
            var today = new Date().toISOString().split('T')[0];
            await supabaseClient.from('reminder_logs').insert({
                store_id: profile?.store_id,
                reminder_date: today,
                sent_by: profile?.id,
                recipients_count: successCount
            });
        }
        
        // 显示结果
        var resultMsg = lang === 'id'
            ? `✅ Pengingat terkirim! Berhasil: ${successCount}, Gagal: ${failCount}`
            : `✅ 提醒发送完成！成功: ${successCount}, 失败: ${failCount}`;
        
        if (failedOrders.length > 0 && lang === 'id') {
            resultMsg += `\n\n❌ Gagal untuk order: ${failedOrders.map(f => f.orderId).join(', ')}`;
        } else if (failedOrders.length > 0) {
            resultMsg += `\n\n❌ 失败的订单: ${failedOrders.map(f => f.orderId).join(', ')}`;
        }
        
        alert(resultMsg);
        
        // 刷新仪表盘
        await APP.renderDashboard();
    },

    // ========== 更新门店 WA 号码 ==========
    updateStoreWANumber: async function(storeId, waNumber) {
        var lang = Utils.lang;
        try {
            await SUPABASE.updateStoreWANumber(storeId, waNumber);
            alert(lang === 'id' ? 'Nomor WA berhasil diperbarui' : 'WA 号码已更新');
        } catch (error) {
            alert(lang === 'id' ? 'Gagal memperbarui: ' + error.message : '更新失败：' + error.message);
        }
    }
};

// 合并到 window.APP
Object.assign(window.APP, DashboardWA);
