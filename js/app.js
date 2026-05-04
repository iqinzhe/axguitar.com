// app.js - v2.2 轻量门面层（委托给 DashboardCore）
// JF 命名空间下的主入口，提供快捷键、强制恢复、导出/导入等辅助功能

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    const APP = {
        // ==================== 强制清除并重新加载 ====================
        forceClearAndReload() {
            console.log('[APP] 强制清除所有存储并重新加载');
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (
                        key.startsWith('supabase.') ||
                        key.startsWith('sb-') ||
                        key.startsWith('jf_')
                    )) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
                sessionStorage.clear();
                document.cookie.split(";").forEach(c => {
                    document.cookie = c.replace(/^ +/, "")
                        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                });
                console.log('[APP] 已清除 ' + keysToRemove.length + ' 个存储项');
            } catch (e) {
                console.warn('[APP] 清除存储失败:', e.message);
            }
            setTimeout(() => location.reload(), 500);
        },

        // ==================== 导出/导入（兼容旧版） ====================
        exportData() {
            if (typeof BackupStorage !== 'undefined' && BackupStorage.backup) {
                BackupStorage.backup();
            } else {
                Utils.toast.error(Utils.t('backup_restore') + ' ' + (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
            }
        },

        importData() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                if (e.target.files?.[0]) {
                    if (typeof BackupStorage !== 'undefined' && BackupStorage.restore) {
                        await BackupStorage.restore(e.target.files[0]);
                    } else {
                        Utils.toast.error(Utils.t('backup_restore') + ' ' + (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
                    }
                }
            };
            input.click();
        },

        // ==================== WA 提醒（独立工具） ====================
        async sendWAReminder(orderId) {
            try {
                const result = await SUPABASE.getPaymentHistory(orderId);
                const order = result.order;
                if (!order) {
                    Utils.toast.error(Utils.t('order_not_found'));
                    return;
                }
                const storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                if (!storeWA) {
                    Utils.toast.warning(Utils.lang === 'id' ? 'Nomor WhatsApp toko belum diatur' : '门店 WhatsApp 号码未设置');
                    return;
                }
                const customerPhone = order.customer_phone;
                if (!customerPhone) {
                    Utils.toast.warning(Utils.lang === 'id' ? 'Nomor telepon nasabah tidak tersedia' : '客户电话不存在');
                    return;
                }
                let cleanPhone = customerPhone.replace(/[^0-9]/g, '');
                if (!cleanPhone.startsWith('62') && !cleanPhone.startsWith('0')) {
                    cleanPhone = '62' + cleanPhone;
                }
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = '62' + cleanPhone.substring(1);
                }
                const waMessage = JF.WAPage ? JF.WAPage.generateWAText(order, storeWA) : '';
                const encodedMessage = encodeURIComponent(waMessage);
                window.open('https://wa.me/' + cleanPhone + '?text=' + encodedMessage, '_blank');
                await SUPABASE.logReminder(order.id);
                Utils.toast.success(Utils.lang === 'id' ? 'Membuka WhatsApp...' : '正在打开 WhatsApp...');
            } catch (error) {
                console.error("sendWAReminder error:", error);
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
            }
        },

        // ==================== 打印（已委托给 PrintPage，保留兼容） ====================
        printCurrentPage() {
            if (JF.PrintPage && typeof JF.PrintPage.printCurrentPage === 'function') {
                JF.PrintPage.printCurrentPage();
            } else {
                window.print();
            }
        }
    };

    // 挂载到命名空间及全局
    window.APP = Object.assign(window.APP || {}, APP);
    JF.APP = window.APP;

    console.log('[APP] app.js v2.2 加载完成（门面层）');
    console.log('[APP] 快捷键: Alt+R 恢复页面 | Alt+Shift+R 清除缓存并刷新');

    // ==================== 全局快捷键 ====================
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'r') {
            e.preventDefault();
            if (typeof JF.DashboardCore?.forceRecovery === 'function') {
                JF.DashboardCore.forceRecovery();
            } else if (typeof window.APP?.forceRecovery === 'function') {
                window.APP.forceRecovery();
            } else {
                location.reload();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            APP.forceClearAndReload();
        }
    });
})();
