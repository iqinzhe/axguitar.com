// app-dashboard-wa.js - v1.0 WA提醒模块

window.APP = window.APP || {};

const DashboardWA = {

    // ==================== WA 提醒功能 ====================
    getSenderWANumber: async function(storeId) {
        return await SUPABASE.getStoreWANumber(storeId);
    },

    generateWAText: function(order, senderNumber) {
        var lang = Utils.lang;
        var remainingPrincipal = (order.loan_amount || 0) - (order.principal_paid || 0);
        var monthlyInterest = remainingPrincipal * (Utils.MONTHLY_INTEREST_RATE || 0.10);
        var dueDate = order.next_interest_due_date ? Utils.formatDate(order.next_interest_due_date) : '-';
        
        if (lang === 'id') {
            return `*Pengingat Pembayaran Bunga - JF! by Gadai*

Kepada Yth. Bapak/Ibu ${order.customer_name}

Kami ingatkan bahwa pembayaran bunga untuk pesanan dengan detail berikut:
📋 *ID Pesanan:* ${order.order_id}
💰 *Sisa Pokok:* ${Utils.formatCurrency(remainingPrincipal)}
📈 *Bunga per Bulan (10%):* ${Utils.formatCurrency(monthlyInterest)}
📅 *Jatuh Tempo:* ${dueDate}

Harap melakukan pembayaran tepat waktu.

Terima kasih atas kepercayaan Anda.

- ${senderNumber || 'JF! by Gadai'}`;
        } else {
            return `*利息缴费提醒 - JF! by Gadai*

尊敬的 ${order.customer_name} 先生/女士：

提醒您以下订单的利息缴费：
📋 *订单号:* ${order.order_id}
💰 *剩余本金:* ${Utils.formatCurrency(remainingPrincipal)}
📈 *月利息 (10%):* ${Utils.formatCurrency(monthlyInterest)}
📅 *到期日:* ${dueDate}

请按时缴费。

感谢您的信任。

- ${senderNumber || 'JF! by Gadai'}`;
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

    sendWAReminder: async function(orderId) {
        var lang = Utils.lang;
        try {
            var order = await SUPABASE.getOrder(orderId);
            if (!order) {
                alert(lang === 'id' ? 'Order tidak ditemukan' : '订单不存在');
                return;
            }
            
            var storeId = order.store_id;
            var senderNumber = await SUPABASE.getStoreWANumber(storeId);
            
            if (!senderNumber) {
                alert(lang === 'id' 
                    ? 'Nomor WhatsApp toko belum diatur. Silakan atur di menu Manajemen Toko.'
                    : '门店 WhatsApp 号码未设置，请在门店管理中设置。');
                return;
            }
            
            var customerPhone = order.customer_phone;
            if (!customerPhone) {
                alert(lang === 'id' ? 'Nomor telepon pelanggan tidak tersedia' : '客户手机号不可用');
                return;
            }
            
            var waText = encodeURIComponent(this.generateWAText(order, senderNumber));
            var waUrl = `https://wa.me/${customerPhone}?text=${waText}`;
            window.open(waUrl, '_blank');
            
        } catch (error) {
            console.error("sendWAReminder error:", error);
            alert(lang === 'id' ? 'Gagal mengirim pengingat WA' : '发送 WA 提醒失败');
        }
    },

    sendDailyReminders: async function() {
        var lang = Utils.lang;
        var hasSent = await this.hasSentRemindersToday();
        if (hasSent) {
            alert(lang === 'id' 
                ? 'Pengingat sudah dikirim hari ini. Silakan coba lagi besok.'
                : '今日已发送过提醒，请明天再试。');
            return;
        }
        
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
        
        for (var order of needRemindOrders) {
            try {
                var storeId = order.store_id;
                var senderNumber = await SUPABASE.getStoreWANumber(storeId);
                if (!senderNumber) {
                    failCount++;
                    continue;
                }
                
                var customerPhone = order.customer_phone;
                if (!customerPhone) {
                    failCount++;
                    continue;
                }
                
                var waText = encodeURIComponent(this.generateWAText(order, senderNumber));
                var waUrl = `https://wa.me/${customerPhone}?text=${waText}`;
                window.open(waUrl, '_blank');
                await new Promise(resolve => setTimeout(resolve, 1500));
                successCount++;
            } catch (e) {
                console.error("发送提醒失败:", e);
                failCount++;
            }
        }
        
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
        
        alert(lang === 'id'
            ? `✅ Pengingat terkirim! Berhasil: ${successCount}, Gagal: ${failCount}`
            : `✅ 提醒发送完成！成功: ${successCount}, 失败: ${failCount}`);
        
        await APP.renderDashboard();
    },

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

