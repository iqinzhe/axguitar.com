/* app-init.js — APP门面层、全局快捷键、应用启动（从 index.html 内联块提取） */
(function () {
    'use strict';

    var JF = window.JF || {};
    window.JF = JF;

    var APP = {
        forceClearAndReload: function () {
            try {
                var keysToRemove = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (key && (
                        key.indexOf('supabase.') === 0 ||
                        key.indexOf('sb-') === 0 ||
                        key.indexOf('jf_') === 0
                    )) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(function (k) { localStorage.removeItem(k); });
                sessionStorage.clear();
                document.cookie.split(';').forEach(function (c) {
                    document.cookie = c.replace(/^ +/, '')
                        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
                });
            } catch (e) { /* ignore */ }
            setTimeout(function () { location.reload(); }, 500);
        },

        exportData: function () {
            if (typeof BackupStorage !== 'undefined' && BackupStorage.backup) {
                BackupStorage.backup();
            } else {
                Utils.toast.error(Utils.t('backup_restore') + ' ' +
                    (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
            }
        },

        importData: function () {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function (e) {
                if (e.target.files && e.target.files[0]) {
                    if (typeof BackupStorage !== 'undefined' && BackupStorage.restore) {
                        BackupStorage.restore(e.target.files[0]);
                    } else {
                        Utils.toast.error(Utils.t('backup_restore') + ' ' +
                            (Utils.lang === 'id' ? 'tidak tersedia' : '不可用'));
                    }
                }
            };
            input.click();
        },

        sendWAReminder: async function (orderId) {
            try {
                var result = await SUPABASE.getPaymentHistory(orderId);
                var order = result.order;
                if (!order) { Utils.toast.error(Utils.t('order_not_found')); return; }
                var storeWA = await SUPABASE.getStoreWANumber(order.store_id);
                if (!storeWA) {
                    Utils.toast.warning(Utils.lang === 'id'
                        ? 'Nomor WhatsApp toko belum diatur' : '门店 WhatsApp 号码未设置');
                    return;
                }
                var customerPhone = order.customer_phone;
                if (!customerPhone) {
                    Utils.toast.warning(Utils.lang === 'id'
                        ? 'Nomor telepon nasabah tidak tersedia' : '客户电话不存在');
                    return;
                }
                var cleanPhone = customerPhone.replace(/[^0-9]/g, '');
                if (cleanPhone.indexOf('0') === 0) {
                    cleanPhone = '62' + cleanPhone.substring(1);
                } else if (cleanPhone.indexOf('62') !== 0) {
                    cleanPhone = '62' + cleanPhone;
                }
                var waMessage = JF.WAPage ? JF.WAPage.generateWAText(order, storeWA) : '';
                window.open('https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(waMessage), '_blank');
                await SUPABASE.logReminder(order.id);
                Utils.toast.success(Utils.lang === 'id' ? 'Membuka WhatsApp...' : '正在打开 WhatsApp...');
            } catch (error) {
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal mengirim pengingat' : '发送提醒失败');
            }
        },

        printCurrentPage: function () {
            if (JF.PrintPage && typeof JF.PrintPage.printCurrentPage === 'function') {
                JF.PrintPage.printCurrentPage();
            } else {
                window.print();
            }
        }
    };

    window.APP = Object.assign(window.APP || {}, APP);
    JF.APP = window.APP;

    /* 全局快捷键 */
    document.addEventListener('keydown', function (e) {
        if (e.altKey && !e.shiftKey && e.key === 'r') {
            e.preventDefault();
            if (JF.DashboardCore && typeof JF.DashboardCore.forceRecovery === 'function') {
                JF.DashboardCore.forceRecovery();
            } else if (window.APP && typeof window.APP.forceRecovery === 'function') {
                window.APP.forceRecovery();
            } else {
                location.reload();
            }
        }
        if (e.altKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            APP.forceClearAndReload();
        }
    });

    /* 应用启动 */
    var loadingOverlay   = document.getElementById('loadingOverlay');
    var dashboardContent = document.getElementById('dashboardContent');

    function hideLoading() {
        if (window.__updateLoadingProgress) window.__updateLoadingProgress(100);
        setTimeout(function () {
            if (loadingOverlay) {
                loadingOverlay.style.transition = 'opacity 0.5s ease';
                loadingOverlay.style.opacity = '0';
                setTimeout(function () { loadingOverlay.style.display = 'none'; }, 500);
            }
            if (dashboardContent) dashboardContent.classList.add('loaded');
        }, 300);
    }

    window.__hideLoadingOverlay = hideLoading;

    var fallbackObserver = new MutationObserver(function () {
        var appEl = document.getElementById('app');
        if (appEl && appEl.querySelector('.dashboard-v2')) {
            hideLoading();
            fallbackObserver.disconnect();
        }
    });

    function startApp() {
        if (typeof JF !== 'undefined' && JF.DashboardCore && JF.DashboardCore.init) {
            if (window.__onFullReady) window.__onFullReady();
            var originalRender = JF.DashboardCore.originalRenderDashboard;
            if (originalRender) {
                JF.DashboardCore.originalRenderDashboard = async function () {
                    var result = await originalRender.apply(this, arguments);
                    hideLoading();
                    return result;
                };
            }
            var initPromise = JF.DashboardCore.init();
            if (initPromise && typeof initPromise.then === 'function') {
                initPromise.then(function () {
                    setTimeout(function () {
                        if (loadingOverlay && loadingOverlay.style.display !== 'none') {
                            hideLoading();
                        }
                    }, 500);
                }).catch(function () { hideLoading(); });
            }
            var appEl = document.getElementById('app');
            if (appEl) {
                fallbackObserver.observe(appEl, { childList: true, subtree: true });
                setTimeout(function () {
                    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
                        hideLoading();
                        fallbackObserver.disconnect();
                    }
                }, 8000);
            }
        } else {
            setTimeout(startApp, 100);
        }
    }

    startApp();
})();
