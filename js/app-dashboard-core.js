// app-dashboard-core.js - v2.7 修复版
// 修复内容：Enter 键防重复触发 + 统一登录页 Enter 处理

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ========== 模块降级 ==========
    const ModuleFallback = {
        _degradedModules: {},
        async safeCall(moduleName, fn, args, fallbackFn) {
            try {
                if (typeof fn !== 'function') throw new Error('module_not_loaded');
                return await fn.apply(null, args || []);
            } catch (error) {
                const lang = Utils.lang;
                const moduleKey = moduleName + '_' + (error.message || 'unknown');
                if (!this._degradedModules[moduleKey]) {
                    this._degradedModules[moduleKey] = true;
                    const msg = lang === 'id'
                        ? `Modul "${moduleName}" gagal dimuat, kembali ke dashboard.`
                        : `模块 "${moduleName}" 加载失败，已返回仪表盘。`;
                    if (window.Toast) window.Toast.warning(msg, 5000);
                    this._showBanner(moduleName, error.message);
                }
                if (typeof fallbackFn === 'function') return await fallbackFn();
                if (JF.DashboardCore && typeof JF.DashboardCore.renderDashboard === 'function') {
                    await JF.DashboardCore.renderDashboard();
                    return true;
                }
                location.reload();
                return null;
            }
        },
        _showBanner(moduleName, errorMsg) {
            const existingBanner = document.getElementById('moduleFallbackBanner');
            if (existingBanner) {
                const content = existingBanner.querySelector('.info-bar-content');
                if (content && !content.textContent.includes(moduleName)) content.textContent += ' | ' + moduleName;
                return;
            }
            const lang = Utils.lang;
            const banner = document.createElement('div');
            banner.id = 'moduleFallbackBanner';
            banner.className = 'info-bar warning';
            banner.style.cssText = 'position:sticky;top:0;z-index:9999;margin-bottom:12px;border-radius:6px;';
            banner.innerHTML = '<span class="info-bar-icon">⚠️</span><div class="info-bar-content"><strong>' + (lang === 'id' ? 'Fitur terdegradasi' : '功能降级') + '</strong> — ' + (lang === 'id' ? `Modul "${moduleName}" gagal dimuat.` : `模块 "${moduleName}" 加载失败。`) + '</div><button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;padding:0 8px;">✖</button>';
            const app = document.getElementById('app');
            if (app && app.firstChild) app.insertBefore(banner, app.firstChild);
        },
        clearAll() { this._degradedModules = {}; const b = document.getElementById('moduleFallbackBanner'); if (b) b.remove(); }
    };
    window.ModuleFallback = ModuleFallback;
    JF.ModuleFallback = ModuleFallback;

    let _overdueInterval = null;

    // ========== 工作日历构建函数 ==========
    function buildWorkCalendarHTML(dueOrders, lang, dueMap) {
        const today = Utils.getJakartaDate();
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth();

        const monthNames = lang === 'id'
            ? ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
            : ['January','February','March','April','May','June','July','August','September','October','November','December'];

        const weekDays = lang === 'id'
            ? ['Sen','Sel','Rab','Kam','Jum','Sab','Min']
            : ['一','二','三','四','五','六','日'];

        const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
        const startIndex = (firstDay + 6) % 7;

        if (!dueMap) {
            dueMap = {};
            dueOrders.forEach(o => {
                const d = o.next_interest_due_date;
                if (!d) return;
                if (!dueMap[d]) dueMap[d] = [];
                dueMap[d].push(o);
            });
        }

        let tableRows = '<tr>';
        for (let i = 0; i < 7; i++) {
            tableRows += `<th>${weekDays[i]}</th>`;
        }
        tableRows += '<tr>';

        let day = 1;
        for (let r = 0; r < 6; r++) {
            let row = '<tr>';
            for (let c = 0; c < 7; c++) {
                if (r === 0 && c < startIndex) {
                    row += '<td></td>';
                    continue;
                }
                if (day > totalDays) {
                    row += '<td></td>';
                    continue;
                }
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const ordersOnDay = dueMap[dateStr] || [];
                const count = ordersOnDay.length;
                let cellContent = `<span class="cal-date">${day}</span>`;
                if (count > 0) {
                    cellContent += `<span class="cal-due-count" data-date="${dateStr}" title="${count} ${lang==='id'?'pesanan':'orders'}">${count}</span>`;
                }
                row += `<td class="cal-cell${count>0?' has-due':''}">${cellContent}</td>`;
                day++;
            }
            row += '</tr>';
            tableRows += row;
            if (day > totalDays) break;
        }

        return `
            <div class="work-calendar">
                <div class="calendar-header">${monthNames[month]} ${year}</div>
                <table class="cal-table">
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
        `;
    }

    // ========== DashboardCore 主模块 ==========
    const DashboardCore = {
        currentFilter: "all",
        historyStack: [],
        currentPage: "login",
        currentOrderId: null,
        currentCustomerId: null,
        _isInitialized: false,
        _popStateNavigation: false,
        // 【修复 #18】添加防重复标志
        _enterProcessing: false,

        // ========== 清理残留遮罩层 ==========
        _cleanupOverlays() {
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.style.display = '';
            }
            const sidebar = document.getElementById('dashSidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                document.body.classList.remove('menu-open');
            }
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => modal.remove());
            document.body.style.overflow = '';
            document.body.style.position = '';
        },

        // ========== 全局键盘管理器 ==========
        _initGlobalKeyboard() {
            // 【修复 #18】添加防重复标志
            this._enterProcessing = false;
            
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this._handleGlobalEsc();
                    return;
                }
                if (e.key === 'Enter') {
                    this._handleGlobalEnter(e);
                    return;
                }
            });

            window.addEventListener('popstate', (e) => {
                if (this.historyStack.length === 0) return;
                this._popStateNavigation = true;
                this.goBack();
            });

            console.log('[Keyboard] 全局快捷键已就绪: Esc=关闭弹窗 | Enter=确认/搜索 | 浏览器返回=app内返回');
        },

        _handleGlobalEsc() {
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                const closeBtn = modal.querySelector('button[onclick*="remove"]') ||
                                 modal.querySelector('.confirm-cancel-btn') ||
                                 modal.querySelector('[onclick*="close"]') ||
                                 modal.querySelector('[onclick*="Close"]');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    modal.remove();
                }
                return;
            }

            const sidebar = document.getElementById('dashSidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                this._toggleSidebar();
                return;
            }

            const confirmModal = document.querySelector('.confirm-modal-overlay');
            if (confirmModal) {
                const cancelBtn = confirmModal.querySelector('.confirm-cancel-btn');
                if (cancelBtn) cancelBtn.click();
                else confirmModal.remove();
                return;
            }
        },

        // 【修复 #18】增加防重复触发标志
        _handleGlobalEnter(e) {
            if (this._enterProcessing) return;
            
            const confirmModal = document.querySelector('.confirm-modal-overlay');
            if (confirmModal) {
                const okBtn = confirmModal.querySelector('.confirm-ok-btn');
                if (okBtn) {
                    this._enterProcessing = true;
                    okBtn.click();
                    setTimeout(() => { this._enterProcessing = false; }, 300);
                }
                return;
            }

            const loginBox = document.querySelector('.login-box');
            if (loginBox) {
                const loginBtn = document.getElementById('loginBtn');
                if (loginBtn && !loginBtn.disabled) {
                    e.preventDefault();
                    this._enterProcessing = true;
                    loginBtn.click();
                    setTimeout(() => { this._enterProcessing = false; }, 300);
                }
                return;
            }

            const activeEl = document.activeElement;
            if (activeEl && activeEl.tagName === 'INPUT' && activeEl.type === 'text') {
                const id = activeEl.id || '';
                if (id.includes('Filter') || id.includes('Search') || id.includes('search')) {
                    const filterBtn = document.querySelector(`button[onclick*="${id}"]`) ||
                                      activeEl.closest('.card')?.querySelector('button.btn--sm');
                    if (filterBtn) {
                        e.preventDefault();
                        this._enterProcessing = true;
                        filterBtn.click();
                        setTimeout(() => { this._enterProcessing = false; }, 300);
                    }
                    return;
                }
                if (id.includes('Desc') || id.includes('desc')) {
                    const parent = activeEl.closest('.modal-content') || activeEl.closest('.card') || document;
                    const searchBtn = parent.querySelector('button[onclick*="Filter"]') ||
                                      parent.querySelector('button[onclick*="filter"]');
                    if (searchBtn) {
                        e.preventDefault();
                        this._enterProcessing = true;
                        searchBtn.click();
                        setTimeout(() => { this._enterProcessing = false; }, 300);
                    }
                    return;
                }
            }
            
            this._enterProcessing = false;
        },

        // ========== 页面状态持久化 ==========
        saveCurrentPageState(extraParams = {}) {
            try {
                if (!AUTH.isLoggedIn() || this.currentPage === 'login') return;
                const state = {
                    page: this.currentPage,
                    filter: this.currentFilter,
                    orderId: this.currentOrderId || null,
                    customerId: this.currentCustomerId || null,
                    ...extraParams
                };
                sessionStorage.setItem('jf_current_state', JSON.stringify(state));
                localStorage.setItem('jf_last_state', JSON.stringify(state));
            } catch (e) { /* ignore */ }
        },

        restorePageState() {
            try {
                let raw = sessionStorage.getItem('jf_current_state') || localStorage.getItem('jf_last_state');
                if (!raw) return { page: null, filter: "all", orderId: null, customerId: null };

                const state = JSON.parse(raw);
                const validPages = ['dashboard','orderTable','createOrder','viewOrder','payment','anomaly','userManagement','storeManagement','expenses','customers','paymentHistory','messageCenter','customerOrders','customerPaymentHistory','blacklist'];
                const validFilters = ['all', 'active', 'completed', 'liquidated'];
                if (!state.filter || !validFilters.includes(state.filter)) {
                    state.filter = 'all';
                }

                if (state.page && validPages.includes(state.page) && AUTH.isLoggedIn()) {
                    if (['viewOrder','payment'].includes(state.page) && !state.orderId) {
                        return { page: null, filter: "all", orderId: null, customerId: null };
                    }
                    if (['customerOrders','customerPaymentHistory'].includes(state.page) && !state.customerId) {
                        return { page: null, filter: "all", orderId: null, customerId: null };
                    }
                    return {
                        page: state.page,
                        filter: state.filter,
                        orderId: state.orderId || null,
                        customerId: state.customerId || null
                    };
                }
                return { page: null, filter: "all", orderId: null, customerId: null };
            } catch (e) { return { page: null, filter: "all", orderId: null, customerId: null }; }
        },

        clearPageState() {
            try {
                sessionStorage.removeItem('jf_current_state');
                localStorage.removeItem('jf_last_state');
            } catch (e) { /* ignore */ }
            this.currentOrderId = null;
            this.currentCustomerId = null;
        },

        // ========== 逾期更新定时器 ==========
        _clearOverdueInterval() { if (_overdueInterval) { clearInterval(_overdueInterval); _overdueInterval = null; } },
        _startOverdueInterval() {
            this._clearOverdueInterval();
            if (!AUTH.isLoggedIn()) return;
            _overdueInterval = setInterval(async () => {
                try { await SUPABASE.updateOverdueDays(); if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') await this.refreshCurrentPage(); } catch (err) { console.warn('[逾期更新] 失败:', err.message); }
            }, 30 * 60 * 1000);
            setTimeout(async () => { try { await SUPABASE.updateOverdueDays(); if (this.currentPage === 'dashboard' || this.currentPage === 'anomaly') await this.refreshCurrentPage(); } catch (err) { /* ignore */ } }, 5000);
        },

        // ========== 统一外壳与内容切换 ==========
        async _ensureShell() {
            let shell = document.querySelector('.dashboard-v2');
            if (shell) return shell;
            await this.originalRenderDashboard();
            return document.querySelector('.dashboard-v2');
        },

        async _fullRenderDashboard() { await this.originalRenderDashboard(); },

        async _updateMainContent(htmlContent) {
            const mainEl = document.querySelector('.dash-main');
            if (!mainEl) return;
            mainEl.style.opacity = '0';
            mainEl.innerHTML = htmlContent;
            requestAnimationFrame(() => {
                mainEl.style.transition = 'opacity 0.2s ease';
                mainEl.style.opacity = '1';
                setTimeout(() => { mainEl.style.transition = ''; }, 200);
            });
            mainEl.scrollTop = 0;
        },

        // ========== 刷新当前页面 ==========
        async refreshCurrentPage() {
            if (!AUTH.isLoggedIn()) {
                console.log('[DashboardCore] 用户未登录，显示登录页');
                await this.renderLogin();
                return;
            }
            
            this._cleanupOverlays();
            await this._ensureShell();
            await this._updateSidebarActive();

            const page = this.currentPage;
            if (page === 'dashboard') {
                await this.originalRenderDashboard();
                return;
            }

            let contentHtml = '<div class="card"><p>' + (Utils.lang === 'id' ? 'Memuat...' : '加载中...') + '</p></div>';
            try {
                if (page === 'orderTable') {
                    if (JF.OrdersPage && typeof JF.OrdersPage.buildOrderTableHTML === 'function') {
                        contentHtml = await JF.OrdersPage.buildOrderTableHTML({ status: this.currentFilter }, 0, 50);
                    }
                } else if (page === 'customers') {
                    if (JF.CustomersPage && typeof JF.CustomersPage.buildCustomersHTML === 'function') {
                        contentHtml = await JF.CustomersPage.buildCustomersHTML();
                    }
                } else if (page === 'expenses') {
                    if (JF.ExpensesPage && typeof JF.ExpensesPage.buildExpensesHTML === 'function') {
                        contentHtml = await JF.ExpensesPage.buildExpensesHTML();
                    }
                } else if (page === 'paymentHistory') {
                    if (JF.FundsPage && typeof JF.FundsPage.buildCashFlowPageHTML === 'function') {
                        contentHtml = await JF.FundsPage.buildCashFlowPageHTML();
                    }
                } else if (page === 'anomaly') {
                    if (JF.AnomalyPage && typeof JF.AnomalyPage.buildAnomalyHTML === 'function') {
                        contentHtml = await JF.AnomalyPage.buildAnomalyHTML();
                    }
                } else if (page === 'userManagement') {
                    if (JF.UsersPage && typeof JF.UsersPage.buildUserManagementHTML === 'function') {
                        contentHtml = await JF.UsersPage.buildUserManagementHTML();
                    }
                } else if (page === 'storeManagement') {
                    if (JF.StoreManager && typeof JF.StoreManager.buildStoreManagementHTML === 'function') {
                        contentHtml = await JF.StoreManager.buildStoreManagementHTML();
                    }
                } else if (page === 'backupRestore') {
                    if (JF.BackupStorage && typeof JF.BackupStorage.renderBackupUI === 'function') {
                        await JF.BackupStorage.renderBackupUI();
                        this.saveCurrentPageState();
                        return;
                    }
                    contentHtml = '<div class="card"><p>备份模块不可用</p></div>';
                } else if (page === 'blacklist') {
                    if (JF.BlacklistPage && typeof JF.BlacklistPage.buildBlacklistHTML === 'function') {
                        contentHtml = await JF.BlacklistPage.buildBlacklistHTML();
                    }
                } else if (page === 'messageCenter') {
                    if (JF.MessageCenter && typeof JF.MessageCenter.showMessageCenter === 'function') {
                        await JF.MessageCenter.showMessageCenter();
                        this.saveCurrentPageState();
                        return;
                    }
                    contentHtml = '<div class="card"><p>消息中心模块不可用</p></div>';
                } else if (page === 'viewOrder' && this.currentOrderId) {
                    if (JF.OrdersPage && typeof JF.OrdersPage.renderViewOrderHTML === 'function') {
                        contentHtml = await JF.OrdersPage.renderViewOrderHTML(this.currentOrderId);
                    }
                } else if (page === 'payment' && this.currentOrderId) {
                    if (JF.PaymentPage && typeof JF.PaymentPage.showPayment === 'function') {
                        await JF.PaymentPage.showPayment(this.currentOrderId);
                        this.saveCurrentPageState();
                        return;
                    }
                } else if (page === 'customerOrders' && this.currentCustomerId) {
                    if (JF.CustomersPage && typeof JF.CustomersPage.buildCustomerOrdersHTML === 'function') {
                        contentHtml = await JF.CustomersPage.buildCustomerOrdersHTML(this.currentCustomerId);
                    }
                } else if (page === 'customerPaymentHistory' && this.currentCustomerId) {
                    if (JF.CustomersPage && typeof JF.CustomersPage.buildCustomerPaymentHistoryHTML === 'function') {
                        contentHtml = await JF.CustomersPage.buildCustomerPaymentHistoryHTML(this.currentCustomerId);
                    }
                } else {
                    contentHtml = '<div class="card"><p>⚠️ ' + (Utils.lang === 'id' ? 'Halaman tidak ditemukan' : '页面不存在') + '</p></div>';
                }
                await this._updateMainContent(contentHtml);
                document.querySelectorAll('.amount-input').forEach(el => Utils.bindAmountFormat && Utils.bindAmountFormat(el));
                this.saveCurrentPageState();
            } catch (err) {
                console.error('[refreshCurrentPage] 渲染失败，自动返回仪表盘:', err);
                this.currentOrderId = null;
                this.currentCustomerId = null;
                this.clearPageState();
                await this.originalRenderDashboard();
            }
        },

        async _updateSidebarActive() {
            const navItems = document.querySelectorAll('.nav-item');
            if (!navItems.length) return;
            for (const item of navItems) {
                const onclick = item.getAttribute('onclick') || '';
                const match = onclick.match(/navigateTo\('([^']+)'\)/);
                if (match && match[1] === this.currentPage) item.classList.add('active');
                else item.classList.remove('active');
            }
            const activeOrders = await this._getActiveOrdersCount();
            const badgeSpan = document.querySelector('.nav-item[onclick*="orderTable"] .nav-badge');
            if (badgeSpan) badgeSpan.textContent = activeOrders || '';
        },

        async _getActiveOrdersCount() {
            try {
                const profile = await SUPABASE.getCurrentProfile();
                const client = SUPABASE.getClient();
                let q = client.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'active');
                if (profile?.role !== 'admin' && profile?.store_id) {
                    q = q.eq('store_id', profile.store_id);
                } else if (profile?.role === 'admin') {
                    const practiceIds = await SUPABASE._getPracticeStoreIds();
                    if (practiceIds.length > 0) {
                        q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                    }
                }
                const { count } = await q;
                return count || 0;
            } catch (e) { return 0; }
        },

        // ========== 侧边栏控制 ==========
        _toggleSidebar(e) {
            const sidebar = document.getElementById('dashSidebar');
            const overlay = document.getElementById('sidebarOverlay');
            if (!sidebar) return;
            const isOpen = sidebar.classList.contains('open');
            if (isOpen) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
                document.body.classList.remove('menu-open');
            } else {
                sidebar.classList.add('open');
                if (overlay) overlay.classList.add('active');
                document.body.classList.add('menu-open');
            }
            if (e && e.stopPropagation) e.stopPropagation();
        },

        _initSidebarCloseOnMain() {
            const mainEl = document.querySelector('.dash-main');
            if (!mainEl) return;
            mainEl.removeEventListener('click', this._handleMainClick);
            this._handleMainClick = (e) => {
                const sidebar = document.getElementById('dashSidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar && sidebar.classList.contains('open')) {
                    if (!sidebar.contains(e.target)) {
                        this._toggleSidebar();
                    }
                }
            };
            mainEl.addEventListener('click', this._handleMainClick);
        },

        _setLang(lang) {
            Utils.setLanguage(lang);
            Utils.forceSyncLanguage();
            this.refreshCurrentPage();
        },

        // ========== 路由和导航 ==========
        navigateTo(page, params) {
            if (!AUTH.isLoggedIn() && page !== 'login') {
                this.renderLogin();
                return;
            }
            
            this._cleanupOverlays();
            window.scrollTo(0, 0);
            this.historyStack.push({
                page: this.currentPage,
                orderId: this.currentOrderId,
                customerId: this.currentCustomerId,
                filter: this.currentFilter
            });
            this.currentPage = page;
            if (params) {
                if (params.orderId) this.currentOrderId = params.orderId;
                if (params.customerId) this.currentCustomerId = params.customerId;
            }
            this.saveCurrentPageState();

            if (!this._popStateNavigation) {
                window.history.pushState(
                    { page, orderId: this.currentOrderId, customerId: this.currentCustomerId },
                    '',
                    window.location.href
                );
            }
            this._popStateNavigation = false;

            this.refreshCurrentPage().catch(err => {
                console.error('导航失败', err);
                this.renderDashboard();
            });
        },

        goBack() {
            this._cleanupOverlays();
            if (this.historyStack.length > 0) {
                const prev = this.historyStack.pop();
                this.currentPage = prev.page;
                this.currentOrderId = prev.orderId || null;
                this.currentCustomerId = prev.customerId || null;
                this.currentFilter = prev.filter || "all";
                this.saveCurrentPageState();

                if (!this._popStateNavigation) {
                    window.history.pushState(
                        { page: this.currentPage },
                        '',
                        window.location.href
                    );
                }
                this._popStateNavigation = false;

                this.refreshCurrentPage();
            } else {
                this.navigateTo('dashboard');
            }
        },

        // ========== 仪表盘局部更新函数 ==========
        _updateDashboardDetails(details, lang, isAdmin, kpiReport) {
            const cashFlow = details.cashFlow;
            const totalExpenses = details.totalExpenses;
            const messages = details.messages || [];
            
            const cashBalance = (cashFlow.cash && cashFlow.cash.balance) ? cashFlow.cash.balance : 0;
            const bankBalance = (cashFlow.bank && cashFlow.bank.balance) ? cashFlow.bank.balance : 0;
            const cashIncome = (cashFlow.cash && cashFlow.cash.income) ? cashFlow.cash.income : 0;
            const cashExpense = (cashFlow.cash && cashFlow.cash.expense) ? cashFlow.cash.expense : 0;
            const bankIncome = (cashFlow.bank && cashFlow.bank.income) ? cashFlow.bank.income : 0;
            const bankExpense = (cashFlow.bank && cashFlow.bank.expense) ? cashFlow.bank.expense : 0;
            
            const cashValEl = document.querySelector('.cash-bank-item:nth-child(1) .cb-val');
            if (cashValEl) cashValEl.textContent = Utils.formatCurrency(cashBalance);
            const cashFlowEl = document.querySelector('.cash-bank-item:nth-child(1) .cb-flow');
            if (cashFlowEl) {
                cashFlowEl.innerHTML = '<span class="in">↑ +' + Utils.formatCurrency(cashIncome) + '</span><span class="out">↓ −' + Utils.formatCurrency(cashExpense) + '</span>';
            }
            
            const bankValEl = document.querySelector('.cash-bank-item:nth-child(2) .cb-val');
            if (bankValEl) bankValEl.textContent = Utils.formatCurrency(bankBalance);
            const bankFlowEl = document.querySelector('.cash-bank-item:nth-child(2) .cb-flow');
            if (bankFlowEl) {
                bankFlowEl.innerHTML = '<span class="in">↑ +' + Utils.formatCurrency(bankIncome) + '</span><span class="out">↓ −' + Utils.formatCurrency(bankExpense) + '</span>';
            }
            
            const totalIncome = (kpiReport.admin_fees_collected || 0) + (kpiReport.service_fees_collected || 0) + (kpiReport.interest_collected || 0);
            const netProfit = totalIncome - totalExpenses;
            const npValEl = document.querySelector('.np-val');
            if (npValEl) npValEl.textContent = Utils.formatCurrency(netProfit);
            
            const expenseAmtEl = document.querySelector('.income-item .income-amt.expense');
            if (expenseAmtEl) expenseAmtEl.textContent = '−' + Utils.formatCurrency(totalExpenses);
            
            const messagePreview = document.querySelector('.message-preview');
            if (messagePreview) {
                const pendingCount = messages.length;
                if (pendingCount === 0) {
                    messagePreview.innerHTML = '<div class="empty-preview">✅ ' + (lang === 'id' ? 'Tidak ada pesan tertunda' : '暂无待发送消息') + '</div>';
                } else {
                    const topMessages = messages.slice(0, 3);
                    let previewHtml = '<div class="preview-list">';
                    for (const m of topMessages) {
                        previewHtml += '<div class="preview-item' + (m.overdueDays > 0 ? ' urgent' : '') + '"><span class="preview-order">' + Utils.escapeHtml(m.orderId) + '</span><span class="preview-name">' + Utils.escapeHtml(m.customerName) + '</span><span class="preview-badge">' + m.typeLabel + '</span></div>';
                    }
                    if (pendingCount > 3) {
                        previewHtml += '<div class="preview-more" onclick="JF.MessageCenter.showMessageCenter()">' + (lang === 'id' ? 'dan ' + (pendingCount - 3) + ' pesan lainnya...' : '还有 ' + (pendingCount - 3) + ' 条消息...') + '</div>';
                    }
                    previewHtml += '</div>';
                    messagePreview.innerHTML = previewHtml;
                }
            }
            
            console.log('[Dashboard] 详细信息已更新');
        },

        // ========== 仪表盘渲染（核心）==========
        async originalRenderDashboard() {
            if (!AUTH.isLoggedIn()) {
                await this.renderLogin();
                return;
            }
            
            this.currentPage = 'dashboard';
            this.saveCurrentPageState();
            this._cleanupOverlays();

            const appDiv = document.getElementById("app");
            
            try {
                const lang = Utils.lang;
                const t = Utils.t.bind(Utils);
                const profile = await SUPABASE.getCurrentProfile();
                const isAdmin = PERMISSION.isAdmin();
                const storeId = profile?.store_id;

                const kpiCacheKey = 'dashboard_kpi_' + (isAdmin ? 'admin' : storeId);
                const kpiReport = await JF.Cache.get(kpiCacheKey, async () => {
                    const client = SUPABASE.getClient();
                    const practiceIds = isAdmin ? await SUPABASE._getPracticeStoreIds() : [];
                    
                    const applyFilter = function(q) {
                        if (isAdmin && practiceIds.length > 0) {
                            q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                        } else if (!isAdmin && storeId) {
                            q = q.eq('store_id', storeId);
                        }
                        return q;
                    };

                    const [
                        totalRes,
                        activeRes,
                        completedRes,
                        overdueRes,
                        activeOrdersData,
                        allOrdersData,
                        dueOrdersRes,
                        newThisMonthRes,
                        newLoanThisMonthRes,
                        injectedCapitalRes,
                        deployedCapitalRes
                    ] = await Promise.all([
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'completed'),
                        applyFilter(client.from('orders').select('*', { count: 'exact', head: true })).eq('status', 'active').gte('overdue_days', 1),
                        applyFilter(client.from('orders').select('loan_amount, admin_fee, admin_fee_paid, service_fee_amount, service_fee_paid, interest_paid_total, principal_paid')).eq('status', 'active'),
                        applyFilter(client.from('orders').select('loan_amount')),
                        applyFilter(client.from('orders').select('order_id, customer_name, next_interest_due_date').eq('status', 'active')),
                        (async () => {
                            try {
                                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                                let q = client.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', monthStart);
                                if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                                else if (isAdmin && practiceIds.length > 0) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                                const r = await q;
                                return r.count || 0;
                            } catch (e) { return 0; }
                        })(),
                        (async () => {
                            try {
                                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                                let q = client.from('orders').select('loan_amount').gte('created_at', monthStart);
                                if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                                else if (isAdmin && practiceIds.length > 0) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                                const r = await q;
                                return (r.data || []).reduce((s, o) => s + (o.loan_amount || 0), 0);
                            } catch (e) { return 0; }
                        })(),
                        (async () => {
                            try {
                                let injQuery = client.from('capital_injections').select('amount').eq('is_voided', false);
                                if (!isAdmin && storeId) injQuery = injQuery.eq('store_id', storeId);
                                else if (isAdmin && practiceIds.length > 0) injQuery = injQuery.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                                const injResult = await injQuery;
                                return (injResult.data || []).reduce((s, i) => s + (i.amount || 0), 0);
                            } catch (e) { return 0; }
                        })(),
                        (async () => {
                            try {
                                let depQuery = client.from('orders').select('loan_amount').eq('status', 'active');
                                if (!isAdmin && storeId) depQuery = depQuery.eq('store_id', storeId);
                                else if (isAdmin && practiceIds.length > 0) depQuery = depQuery.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                                const depResult = await depQuery;
                                return (depResult.data || []).reduce((s, o) => s + (o.loan_amount || 0), 0);
                            } catch (e) { return 0; }
                        })()
                    ]);

                    let totalLoanActive = 0, adminFeesCollected = 0, serviceFeesCollected = 0, interestCollected = 0, principalCollected = 0;
                    for (const o of (activeOrdersData.data || [])) {
                        totalLoanActive += (o.loan_amount || 0);
                        if (o.admin_fee_paid) adminFeesCollected += (o.admin_fee || 0);
                        serviceFeesCollected += (o.service_fee_paid || 0);
                        interestCollected += (o.interest_paid_total || 0);
                        principalCollected += (o.principal_paid || 0);
                    }
                    let totalLoanAll = 0;
                    for (const o of (allOrdersData.data || [])) totalLoanAll += (o.loan_amount || 0);

                    const injected = injectedCapitalRes || 0;
                    const deployed = deployedCapitalRes || 0;

                    return {
                        total_orders: totalRes.count || 0,
                        active_orders: activeRes.count || 0,
                        completed_orders: completedRes.count || 0,
                        overdue_orders: overdueRes.count || 0,
                        new_this_month: newThisMonthRes,
                        new_loan_this_month: newLoanThisMonthRes,
                        total_loan_amount: totalLoanAll,
                        admin_fees_collected: adminFeesCollected,
                        service_fees_collected: serviceFeesCollected,
                        interest_collected: interestCollected,
                        principal_collected: principalCollected,
                        total_injected_capital: injected,
                        deployed_capital: deployed,
                        available_capital: injected - deployed,
                        due_orders: dueOrdersRes.data || []
                    };
                }, { ttl: 3 * 60 * 1000 });

                const totalOrders = kpiReport.total_orders;
                const activeOrders = kpiReport.active_orders;
                const completedOrders = kpiReport.completed_orders;
                const overdueOrders = kpiReport.overdue_orders;
                const newThisMonth = kpiReport.new_this_month;
                const newLoanThisMonth = kpiReport.new_loan_this_month;
                const injected = kpiReport.total_injected_capital;
                const deployed = kpiReport.deployed_capital;
                const available = kpiReport.available_capital;
                const utilizationRate = injected > 0 ? ((deployed / injected) * 100).toFixed(1) : '0';

                const cashBalance = 0;
                const bankBalance = 0;
                const cashIncome = 0;
                const cashExpense = 0;
                const bankIncome = 0;
                const bankExpense = 0;
                
                const activeNormal = activeOrders - overdueOrders;
                
                const donutData = [
                    { label: lang === 'id' ? 'Selesai' : '已完成', count: completedOrders, color: '#10b981', pct: totalOrders > 0 ? ((completedOrders/totalOrders)*100).toFixed(1) : '0' },
                    { label: lang === 'id' ? 'Aktif Normal' : '活跃·正常', count: activeNormal >= 0 ? activeNormal : 0, color: '#6366f1', pct: totalOrders > 0 ? ((activeNormal/totalOrders)*100).toFixed(1) : '0' },
                    { label: lang === 'id' ? 'Aktif Terlambat' : '活跃·逾期', count: overdueOrders, color: '#ef4444', pct: totalOrders > 0 ? ((overdueOrders/totalOrders)*100).toFixed(1) : '0' },
                ];
                const totalDonut = donutData.reduce((s, d) => s + d.count, 0) || 1;
                const circumference = 2 * Math.PI * 36;
                let dashOffset = 0;
                let donutPaths = '';
                for (const seg of donutData) {
                    const segLen = (seg.count / totalDonut) * circumference;
                    donutPaths += `<circle cx="50" cy="50" r="36" fill="none" stroke="${seg.color}" stroke-width="14" stroke-dasharray="${segLen} ${circumference - segLen}" stroke-dashoffset="${-dashOffset}" stroke-linecap="round" transform="rotate(-90 50 50)"/>`;
                    dashOffset += segLen;
                }

                const userInitial = (profile?.name || 'A').charAt(0).toUpperCase();
                const userRoleText = isAdmin ? (lang === 'id' ? 'Administrator' : '管理员') : (lang === 'id' ? 'Manajer Toko' : '店长');
                const storeDisplay = isAdmin ? (lang === 'id' ? 'Kantor Pusat' : '总部') : Utils.escapeHtml(profile?.stores?.name || (lang === 'id' ? 'Toko' : '门店'));
                const topbarSubtitle = isAdmin ? (lang === 'id' ? 'Semua Toko · Data Real-time' : '全部门店 · 实时数据') : (lang === 'id' ? 'Data Toko · Real-time' : '门店数据 · 实时更新');
                const activeBadgeCount = activeOrders;

                let quickActions = [];
                if (isAdmin) {
                    quickActions = [
                        { icon: '👥', label: t('customers'), action: "JF.DashboardCore.navigateTo('customers')", cls: '' },
                        { icon: '📋', label: t('order_list'), action: "JF.DashboardCore.navigateTo('orderTable')", cls: '' },
                        { icon: '📝', label: lang === 'id' ? 'Pengeluaran Baru' : '新增支出', action: "JF.DashboardCore.navigateTo('expenses')", cls: '' },
                        { icon: '💸', label: lang === 'id' ? 'Distribusi Laba' : '收益处置', action: "JF.ProfitPage.showDistributionPage()", cls: '' },   
                    ];
                } else {
                    quickActions = [
                        { icon: '👥', label: t('customers'), action: "JF.DashboardCore.navigateTo('customers')", cls: '' },
                        { icon: '📋', label: t('order_list'), action: "JF.DashboardCore.navigateTo('orderTable')", cls: '' },
                        { icon: '💰', label: lang === 'id' ? 'Bayar Biaya' : '缴费收款', action: "JF.DashboardCore.navigateTo('orderTable');setTimeout(function(){if(window.APP && APP.filterOrders)APP.filterOrders('active');},300)", cls: '' },
                        { icon: '📝', label: lang === 'id' ? 'Pengeluaran Baru' : '新增支出', action: "JF.DashboardCore.navigateTo('expenses')", cls: '' },   
                    ];
                }
                const quickActionsHtml = quickActions.map(q => `<div class="quick-btn${q.cls ? ' ' + q.cls : ''}" onclick="${q.action}"><span class="qb-icon">${q.icon}</span><span class="qb-label">${q.label}</span></div>`).join('');

                const totalIncomeInitial = kpiReport.admin_fees_collected + kpiReport.service_fees_collected + kpiReport.interest_collected;
                const incomeItems = [
                    { dot: '#6366f1', label: t('admin_fee'), sub: lang === 'id' ? 'Terkumpul' : '已收取', amt: kpiReport.admin_fees_collected, cls: '' },
                    { dot: '#8b5cf6', label: t('service_fee'), sub: lang === 'id' ? 'Bulan ini' : '月累计', amt: kpiReport.service_fees_collected, cls: '' },
                    { dot: '#06b6d4', label: t('interest'), sub: lang === 'id' ? 'Bulan ini' : '月累计', amt: kpiReport.interest_collected, cls: '' },
                    { dot: '#ef4444', label: lang === 'id' ? 'Pengeluaran' : '支出合计', sub: lang === 'id' ? 'Memuat...' : '加载中...', amt: 0, cls: 'expense' },
                ];
                const incomeItemsHtml = incomeItems.map(item => `<div class="income-item"><div class="income-dot" style="background:${item.dot}"></div><div><div class="income-name">${item.label}</div><div class="income-sub">${item.sub}</div></div><div class="income-amt${item.cls === 'expense' ? ' expense' : ''}">${item.cls === 'expense' ? '−' : ''}${Utils.formatCurrency(item.amt)}</div></div>`).join('');

                let previewHtml = '<div class="empty-preview">⏳ ' + (lang === 'id' ? 'Memuat...' : '加载中...') + '</div>';
                const netProfitInitial = 0;

                const dueOrders = kpiReport.due_orders || [];
                const dueMap = {};
                dueOrders.forEach(o => {
                    const d = o.next_interest_due_date;
                    if (!d) return;
                    if (!dueMap[d]) dueMap[d] = [];
                    dueMap[d].push(o);
                });

                const kpiRowHTML = `
<div class="kpi-row kpi-row--calendar">
    <div class="kpi-card kpi-card--blue">
        <div class="kpi-icon">📋</div>
        <div class="kpi-label">${lang === 'id' ? 'Total Pesanan' : '累计订单总数'}</div>
        <div class="kpi-val">${totalOrders}</div>
        <div class="kpi-trend">${lang === 'id' ? 'Bulan ini +' : '本月新增 +'}${newThisMonth}</div>
    </div>
    <div class="kpi-card kpi-card--green">
        <div class="kpi-icon">💵</div>
        <div class="kpi-label">${lang === 'id' ? 'Total Pinjaman' : '累计放贷总额'}</div>
        <div class="kpi-val green">${Utils.formatCurrency(kpiReport.total_loan_amount)}</div>
        <div class="kpi-trend">${lang === 'id' ? 'Bulan ini +' : '本月发放 +'}${Utils.formatCurrency(newLoanThisMonth)}</div>
    </div>
    <div class="kpi-card kpi-card--amber">
        <div class="kpi-icon">🔄</div>
        <div class="kpi-label">${lang === 'id' ? 'Pesanan Aktif' : '活跃在押订单'}</div>
        <div class="kpi-val green">${activeOrders}</div>
        ${overdueOrders > 0 ? `<div class="kpi-trend down">${lang === 'id' ? 'Terlambat' : '逾期'} ${overdueOrders} ${lang === 'id' ? 'pesanan' : '笔'} ⚠️</div>` : `<div class="kpi-trend">${lang === 'id' ? 'Semua normal' : '全部正常'} ✅</div>`}
    </div>
    <div class="kpi-card kpi-card--calendar">
        ${buildWorkCalendarHTML(dueOrders, lang, dueMap)}
    </div>
</div>`;

                const finalHtml = `
        <div class="dashboard-v2">
            <div class="sidebar-overlay" id="sidebarOverlay" onclick="JF.DashboardCore._toggleSidebar()"></div>
            <div class="dash-sidebar" id="dashSidebar">
                <div class="sidebar-logo"><div class="logo-mark"><div class="logo-icon">JF</div><div><div class="logo-text">JF! by Gadai</div><div class="logo-sub">${lang === 'id' ? 'Sistem Manajemen Gadai' : '典当管理系统'}</div></div></div></div>
                <div class="sidebar-user">
                    <div class="user-av">${userInitial}</div>
                    <div class="user-info">
                        <div class="user-name-top">${Utils.escapeHtml(profile?.name || 'User')}</div>
                        <div class="user-detail-row">
                            <span class="user-role">${userRoleText}</span>
                            <span class="user-store-badge">${storeDisplay}</span>
                        </div>
                    </div>
                </div>
                <div class="sidebar-nav">
                    <div class="nav-section-label">${lang === 'id' ? 'Menu Utama' : '主菜单'}</div>
                    <div class="nav-item active" onclick="JF.DashboardCore.navigateTo('dashboard')"><span class="nav-icon">◼</span> ${lang === 'id' ? 'Dasbor' : '仪表盘'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('customers')"><span class="nav-icon">👥</span> ${t('customers')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('orderTable')"><span class="nav-icon">📋</span> ${t('order_list')}${activeBadgeCount > 0 ? `<span class="nav-badge">${activeBadgeCount}</span>` : ''}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('paymentHistory')"><span class="nav-icon">💰</span> ${lang === 'id' ? 'Arus Kas' : '资金流水'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('expenses')"><span class="nav-icon">📝</span> ${t('expenses')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('messageCenter')"><span class="nav-icon">💬</span> ${lang === 'id' ? 'Pusat Pesan' : '消息中心'}</div>
                    ${isAdmin ? `<div class="nav-section-label" style="margin-top:8px;">${lang === 'id' ? 'Manajemen' : '管理'}</div>
                    <div class="nav-item" onclick="JF.CapitalModule.showCapitalInjectionModal()"><span class="nav-icon">💉</span> ${lang === 'id' ? 'Injeksi Modal' : '资本注入'}</div>
                    <div class="nav-item" onclick="JF.ProfitPage.showDistributionPage()"><span class="nav-icon">💸</span> ${lang === 'id' ? 'Distribusi Laba' : '收益处置'}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('anomaly')"><span class="nav-icon">⚠️</span> ${t('anomaly_title')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('userManagement')"><span class="nav-icon">👤</span> ${t('user_management')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('storeManagement')"><span class="nav-icon">🏪</span> ${t('store_management')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('backupRestore')"><span class="nav-icon">📦</span> ${t('backup_restore')}</div>` : `
                    <div class="nav-section-label" style="margin-top:8px;">${lang === 'id' ? 'Manajemen' : '管理'}</div>
                    ${profile?.role === 'store_manager' ? `<div class="nav-item" onclick="JF.ProfitPage.showDistributionPage()"><span class="nav-icon">💸</span> ${lang === 'id' ? 'Distribusi Laba' : '收益处置'}</div>` : ''}
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('anomaly')"><span class="nav-icon">⚠️</span> ${t('anomaly_title')}</div>
                    <div class="nav-item" onclick="JF.DashboardCore.navigateTo('backupRestore')"><span class="nav-icon">📦</span> ${t('backup_restore')}</div>`}
                    <div style="flex:1;"></div>
                    <div class="nav-item danger" onclick="JF.DashboardCore.logout()"><span class="nav-icon">🚪</span> ${t('save_exit')}</div>
                </div>
                <div class="sidebar-footer"><div class="lang-toggle"><div class="lang-btn-side${Utils.lang === 'zh' ? ' active-lang' : ''}" onclick="JF.DashboardCore._setLang('zh')">中文</div><div class="lang-btn-side${Utils.lang === 'id' ? ' active-lang' : ''}" onclick="JF.DashboardCore._setLang('id')">Bahasa</div></div></div>
            </div>
            <div class="dash-topbar">
                <div class="topbar-left"><div class="btn btn--outline" id="hamburgerBtn" onclick="JF.DashboardCore._toggleSidebar()">☰</div><div><div class="topbar-title">${lang === 'id' ? 'Dasbor' : '仪表盘总览'}</div><div class="topbar-sub">${topbarSubtitle}</div></div></div>
                <div class="topbar-right">${overdueOrders > 0 ? `<div class="btn btn--warning" onclick="JF.DashboardCore.navigateTo('anomaly')">⚠️</div>` : ''}<div class="topbar-store-badge">${storeDisplay} · ${userRoleText}</div><div class="btn btn--outline" onclick="JF.DashboardCore.invalidateDashboardCache()">🔄</div></div>
            </div>
            <div class="dash-main">
                ${kpiRowHTML}
                <div class="mid-row">
                    <div class="fund-flow-card">
                        <div class="card-header"><div class="card-title">💰 ${lang === 'id' ? 'Struktur Dana' : '资金结构总览'}</div></div>
                        <div class="fund-total-row">
                            <div class="fund-block fund-block--injected"><div class="fund-block-label">${lang === 'id' ? 'Total Modal Disetor' : '总投入资本'}</div><div class="fund-block-val">${Utils.formatCurrency(injected)}</div><div class="fund-block-sub">${lang === 'id' ? 'Dasar Operasional Gadai' : '典当运营基础'}</div></div>
                            <div class="fund-block fund-block--deployed"><div class="fund-block-label">${lang === 'id' ? 'Dalam Gadai' : '在押资金'}</div><div class="fund-block-val">${Utils.formatCurrency(deployed)}</div><div class="fund-block-sub">${activeOrders} ${lang === 'id' ? 'pesanan aktif' : '笔活跃订单'}</div></div>
                            <div class="fund-block fund-block--free"><div class="fund-block-label">${lang === 'id' ? 'Dana Tersedia' : '可动用资金'}</div><div class="fund-block-val">${Utils.formatCurrency(available)}</div><div class="fund-block-sub">${lang === 'id' ? 'Kas + Bank' : '现金 + 银行'}</div></div>
                        </div>
                        <div class="util-bar-wrap"><div class="util-bar-label"><span>${lang === 'id' ? 'Tingkat Utilisasi' : '资金利用率'}</span><span class="util-bar-pct">${utilizationRate}%</span></div><div class="util-bar-track"><div class="util-bar-fill" style="width:${Math.min(utilizationRate, 100)}%;"></div></div></div>
                        <div class="cash-bank-row">
                            <div class="cash-bank-item">
                                <div class="cb-label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜（现金）'}</div>
                                <div class="cb-val">${Utils.formatCurrency(cashBalance)}</div>
                                <div class="cb-flow">
                                    <span class="in">↑ +${Utils.formatCurrency(cashIncome)}</span>
                                    <span class="out">↓ −${Utils.formatCurrency(cashExpense)}</span>
                                </div>
                            </div>
                            <div class="cash-bank-item">
                                <div class="cb-label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
                                <div class="cb-val">${Utils.formatCurrency(bankBalance)}</div>
                                <div class="cb-flow">
                                    <span class="in">↑ +${Utils.formatCurrency(bankIncome)}</span>
                                    <span class="out">↓ −${Utils.formatCurrency(bankExpense)}</span>
                                </div>
                            </div>
                        </div>
                        <div class="transfer-row-v2">
                            <div class="tx-btn-v2" onclick="JF.FundsPage.showTransferModal('cash_to_bank')">🏦→🏧 ${lang === 'id' ? 'Setor ke Bank' : '现金存入银行'}</div>
                            <div class="tx-btn-v2" onclick="JF.FundsPage.showTransferModal('bank_to_cash')">🏧→🏦 ${lang === 'id' ? 'Tarik Tunai dari Bank' : '银行取现金'}</div>
                            ${isAdmin ? `<div class="tx-btn-v2" onclick="JF.FundsPage.showTransferModal('store_to_hq')">🏢 ${t('submit_to_hq')}</div>` : ''}
                        </div>
                    </div>
                    <div class="income-card"><div class="card-header"><div class="card-title">📊 ${lang === 'id' ? 'Komposisi Pendapatan' : '收入构成'}</div></div><div class="income-items">${incomeItemsHtml}</div><div class="net-profit-box"><div><div class="np-label">${t('net_profit')}</div><div class="np-sub">${lang === 'id' ? 'Admin + Layanan + Bunga − Pengeluaran' : '管理费 + 服务费 + 利息 − 支出'}</div></div><div class="np-val">${Utils.formatCurrency(netProfitInitial)}</div></div></div>
                </div>
                <div class="bottom-row">
                    <div class="quick-card">
                        <div class="card-header"><div class="card-title">⚡ ${lang === 'id' ? 'Aksi Cepat' : '快捷操作'}</div></div>
                        <div class="quick-grid">${quickActionsHtml}</div>
                    </div>
                    <div class="order-status-card">
                        <div class="card-header"><div class="card-title">🗂 ${lang === 'id' ? 'Distribusi Status Pesanan' : '订单状态分布'}</div></div>
                        <div class="donut-area">
                            <svg class="donut-svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="#f1f5f9" stroke-width="14"/>${donutPaths}<text x="50" y="48" text-anchor="middle" font-size="16" font-weight="700" fill="#1a1a2e" font-family="var(--font-mono)">${totalOrders}</text><text x="50" y="60" text-anchor="middle" font-size="7" fill="#94a3b8" font-family="var(--font-sans)">${lang === 'id' ? 'Total Pesanan' : '总订单'}</text></svg>
                            <div class="donut-legend">${donutData.map(d => `<div class="legend-item"><div class="legend-dot" style="background:${d.color}"></div><div><div class="legend-name">${d.label}</div><div class="legend-pct">${d.pct}%</div></div><div class="legend-count">${d.count}</div></div>`).join('')}</div>
                        </div>
                    </div>
                    <div class="message-center-card" style="display:flex; flex-direction:column;">
                        <div class="card-header">
                            <div class="card-title">💬 ${lang === 'id' ? 'Pusat Pesan' : '消息中心'}</div>
                            <div class="card-action" onclick="JF.MessageCenter.showMessageCenter()">${lang === 'id' ? 'Lihat Semua →' : '查看全部 →'}</div>
                        </div>
                        <div class="message-preview">
                            ${previewHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
                
                document.getElementById("app").innerHTML = finalHtml;
                this._initSidebarCloseOnMain();
                
                if (!document.getElementById('messageCenterStyle')) {
                    const style = document.createElement('style');
                    style.id = 'messageCenterStyle';
                    style.textContent = `
                        .message-center-card {
                            background: #fff;
                            border-radius: 12px;
                            border: 1px solid #c8d8e8;
                            box-shadow: 0 1px 3px rgba(14, 116, 144, 0.06);
                            padding: 12px;
                            transition: box-shadow 0.2s ease, transform 0.2s ease;
                        }
                        .message-center-card:hover {
                            box-shadow: 0 4px 14px rgba(14, 116, 144, 0.1);
                            transform: translateY(-1px);
                        }
                        .message-badge {
                            background: #ef4444;
                            color: white;
                            font-size: 11px;
                            font-weight: 600;
                            padding: 2px 8px;
                            border-radius: 20px;
                            margin-left: 8px;
                        }
                        .message-preview {
                            margin-top: 8px;
                            flex: 1;
                        }
                        .empty-preview { text-align: center; padding: 20px; color: #94a3b8; font-size: 13px; }
                        .preview-list { display: flex; flex-direction: column; gap: 8px; }
                        .preview-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #f8fafc; border-radius: 8px; font-size: 12px; border-left: 3px solid #cbd5e1; }
                        .preview-item.urgent { border-left-color: #ef4444; background: #fef2f2; }
                        .preview-order { font-weight: 600; color: #0e7490; min-width: 80px; }
                        .preview-name { flex: 1; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                        .preview-badge { font-size: 10px; padding: 2px 6px; border-radius: 12px; background: #e2e8f0; white-space: nowrap; }
                        .preview-item.urgent .preview-badge { background: #fee2e2; color: #dc2626; }
                        .preview-more { text-align: center; font-size: 11px; color: #64748b; padding: 6px; cursor: pointer; }
                        .preview-more:hover { color: #0e7490; text-decoration: underline; }
                        .bottom-row { display: grid; gap: 12px; }
                        @media (max-width: 768px) { .bottom-row { grid-template-columns: 1fr !important; } }
                        @keyframes dashFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                        .kpi-card, .fund-flow-card, .income-card, .quick-card, .order-status-card, .message-center-card { animation: dashFadeIn 0.4s ease forwards; }
                        .kpi-card:nth-child(2) { animation-delay: 0.05s; } .kpi-card:nth-child(3) { animation-delay: 0.10s; } .kpi-card:nth-child(4) { animation-delay: 0.15s; }
                    `;
                    document.head.appendChild(style);
                }

                const dashMain = document.querySelector('.dash-main');
                if (dashMain) {
                    dashMain.addEventListener('click', function(e) {
                        const target = e.target.closest('.cal-due-count');
                        if (!target) return;
                        e.stopPropagation();
                        const date = target.dataset.date;
                        const orders = dueMap[date];
                        if (!orders || !orders.length) return;
                        let listHtml = `<div class="cal-popup" id="calPopup"><div class="cal-popup-title">📅 ${Utils.formatDate(date)}</div><ul>`;
                        orders.forEach(o => {
                            const safeOrderId = Utils.escapeAttr(o.order_id);
                            listHtml += `<li><a href="#" onclick="event.preventDefault(); JF.DashboardCore.navigateTo('viewOrder',{orderId:'${safeOrderId}'})">${Utils.escapeHtml(o.order_id)} - ${Utils.escapeHtml(o.customer_name)}</a></li>`;
                        });
                        listHtml += '</ul></div>';
                        const oldPopup = document.querySelector('.cal-popup');
                        if (oldPopup) oldPopup.remove();
                        document.body.insertAdjacentHTML('beforeend', listHtml);
                        const popup = document.getElementById('calPopup');
                        if (!popup) return;
                        const rect = target.getBoundingClientRect();
                        popup.style.position = 'fixed';
                        popup.style.top = (rect.bottom + 5) + 'px';
                        popup.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
                        popup.style.zIndex = '10000';
                        setTimeout(() => {
                            const closeHandler = function(ev) {
                                if (popup && !popup.contains(ev.target) && ev.target !== target) {
                                    popup.remove();
                                    document.removeEventListener('click', closeHandler);
                                }
                            };
                            document.addEventListener('click', closeHandler);
                        }, 10);
                    });
                }

                this.saveCurrentPageState();

                const detailCacheKey = 'dashboard_details_' + (isAdmin ? 'admin' : storeId);
                JF.Cache.get(detailCacheKey, async () => {
                    const [cashFlowResult, totalExpensesResult, messageDataResult] = await Promise.all([
                        SUPABASE.getCashFlowSummary(),
                        (async () => {
                            const client = SUPABASE.getClient();
                            let q = client.from('expenses').select('amount, store_id');
                            if (!isAdmin && storeId) q = q.eq('store_id', storeId);
                            else if (isAdmin) {
                                const practiceIds = await SUPABASE._getPracticeStoreIds();
                                if (practiceIds.length) q = q.not('store_id', 'in', '(' + practiceIds.join(',') + ')');
                            }
                            const expResult = await q;
                            return (expResult.data || []).reduce((s, e) => s + (e.amount || 0), 0);
                        })(),
                        (async () => {
                            try {
                                if (JF.MessageCenter && typeof JF.MessageCenter.getPendingMessages === 'function') {
                                    return await JF.MessageCenter.getPendingMessages();
                                }
                            } catch (e) { /* ignore */ }
                            return [];
                        })()
                    ]);
                    return {
                        cashFlow: cashFlowResult,
                        totalExpenses: totalExpensesResult,
                        messages: messageDataResult
                    };
                }, { ttl: 3 * 60 * 1000 }).then(details => {
                    this._updateDashboardDetails(details, lang, isAdmin, kpiReport);
                }).catch(err => {
                    console.warn('[Dashboard] 详细信息加载失败:', err);
                });

            } catch (err) {
                console.error("originalRenderDashboard error:", err);
                document.getElementById("app").innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p>⚠️ ' + (Utils.lang === 'id' ? 'Gagal memuat dashboard: ' + err.message : '仪表盘加载失败: ' + err.message) + '</p><button onclick="APP.forceRecovery()" class="btn btn--warning" style="margin-right:8px;">🔄 ' + (Utils.lang === 'id' ? 'Pulihkan Paksa' : '强制恢复') + '</button><button onclick="location.reload()" class="btn btn--outline">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button></div>';
            }
        },

        async renderDashboard() {
            if (!AUTH.isLoggedIn()) {
                await this.renderLogin();
                return;
            }
            this.currentPage = 'dashboard';
            this.saveCurrentPageState();
            this._cleanupOverlays();
            if (!document.querySelector('.dashboard-v2')) {
                await this.originalRenderDashboard();
            } else {
                await this.refreshCurrentPage();
            }
        },

        async renderLogin() {
            this.currentPage = 'login';
            this.clearPageState();
            this._cleanupOverlays();
            this._clearOverdueInterval();
            
            const lang = Utils.lang;
            document.getElementById("app").innerHTML = `
                <div class="login-container" style="background: linear-gradient(135deg, #e0f2fe 0%, #f1f5f9 100%);">
                    <div class="login-box" style="max-width: 360px; width: 100%; padding: 28px 25px 28px 25px; border-radius: var(--radius-xl); box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.03); border: 1px solid rgba(14, 116, 144, 0.15); transition: box-shadow 0.2s ease;">
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 8px;">
                        <button onclick="APP.toggleLanguage()" class="btn btn--sm btn--outline" style="padding: 4px 12px; font-size: var(--font-xs); border-radius: var(--radius-sm);">🌐 ${lang === 'id' ? '中文' : 'Bahasa Indonesia'}</button>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px;">
                        <img src="icons/pagehead-logo.png" alt="JF!" style="height: 32px; width: auto;">
                        <h2 class="login-title" style="margin: 0; font-size: 1.35rem; font-weight: 600; color: var(--text-primary);">JF! by Gadai</h2>
                    </div>
                    <div id="loginError" class="info-bar danger" style="display: none; margin-bottom: 16px; padding: 8px 12px; border-radius: var(--radius-md);">
                        <span class="info-bar-icon">⚠️</span>
                        <div class="info-bar-content" id="loginErrorMessage" style="font-size: var(--font-xs);"></div>
                    </div>
                    <div class="form-group" style="margin-bottom: 14px;">
                        <label style="font-size: var(--font-sm); margin-bottom: 4px; color: var(--text-secondary); display: block;">${lang === 'id' ? 'Email / Username' : '邮箱 / 用户名'}</label>
                        <input id="username" placeholder="email@domain.com" autocomplete="username" style="padding: 10px 12px; font-size: var(--font-sm); width: 100%; border: 1px solid var(--border-medium); border-radius: var(--radius-md); background: var(--bg-card); box-sizing: border-box;">
                    </div>
                    <div class="form-group" style="position: relative; margin-bottom: 16px;">
                        <label style="font-size: var(--font-sm); margin-bottom: 4px; color: var(--text-secondary); display: block;">${Utils.t('password')}</label>
                        <div style="position: relative;">
                            <input id="password" type="password" placeholder="${Utils.t('password')}" autocomplete="current-password" style="padding: 10px 12px; font-size: var(--font-sm); width: 100%; border: 1px solid var(--border-medium); border-radius: var(--radius-md); background: var(--bg-card); box-sizing: border-box;">
                            <span onclick="Utils.togglePasswordVisibility('password', this)" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 16px; opacity: 0.6;">👁️</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom: 22px;">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--font-xs); color: var(--text-secondary);">
                            <input type="checkbox" id="rememberMe" style="width: 14px; height: 14px; cursor: pointer; margin: 0; accent-color: var(--primary);"> ${lang === 'id' ? 'Ingat saya' : '记住我'}
                        </label>
                    </div>
                    <button onclick="APP.login()" id="loginBtn" class="btn btn--primary btn--block" style="padding: 10px 16px; font-size: var(--font-sm); font-weight: 600; border-radius: var(--radius-md); background: linear-gradient(135deg, #0e7490, #06b6d4); border: none; color: white; cursor: pointer; transition: transform 0.1s, opacity 0.2s; width: 100%;">${Utils.t('login')}</button>
                    <p class="login-note" style="font-size: var(--font-xs); color: var(--text-muted); text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--border-light);">ℹ️ ${lang === 'id' ? 'Hubungi administrator untuk akun' : '请联系管理员获取账号'}</p>
                </div>
            </div>`;
            
            const inputs = document.querySelectorAll('#username, #password');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.style.borderColor = 'var(--primary)';
                    this.style.boxShadow = '0 0 0 2px rgba(14, 116, 144, 0.1)';
                    this.style.outline = 'none';
                });
                input.addEventListener('blur', function() {
                    this.style.borderColor = 'var(--border-medium)';
                    this.style.boxShadow = 'none';
                });
            });
        },

        async login() {
            if (this._loginLock) return;
            this._loginLock = true;
            try {
                const username = document.getElementById("username")?.value.trim();
                const password = document.getElementById("password")?.value;
                const rememberMe = document.getElementById("rememberMe")?.checked;
                const errorDiv = document.getElementById("loginError");
                const errorMsg = document.getElementById("loginErrorMessage");
                const btn = document.getElementById("loginBtn");
                if (errorDiv) errorDiv.style.display = 'none';
                if (!username || !password) { if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = Utils.t('fill_all_fields'); } return; }
                if (btn) { btn.disabled = true; btn.textContent = '...'; }
                
                AUTH.setRememberMe(rememberMe);
                if (rememberMe) { localStorage.setItem('jf_remembered_user', username); }
                else { localStorage.removeItem('jf_remembered_user'); }
                
                const user = await AUTH.login(username, password);
                if (!user) {
                    if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = Utils.lang === 'id' ? 'Login gagal. Periksa kembali email/username dan password Anda.' : '登录失败，请检查邮箱/用户名和密码。'; }
                    if (btn) { btn.disabled = false; btn.textContent = Utils.t('login'); }
                    return;
                }
                this.clearPageState();
                this._isInitialized = true;
                this._startOverdueInterval();
                await this.renderDashboard();
            } catch (error) {
                console.error('[DashboardCore] 登录异常:', error);
                const errorDiv = document.getElementById("loginError");
                const errorMsg = document.getElementById("loginErrorMessage");
                if (errorDiv) { errorDiv.style.display = 'flex'; errorMsg.textContent = error.message || Utils.t('login_failed'); }
            } finally {
                this._loginLock = false;
                const btn = document.getElementById("loginBtn");
                if (btn) { btn.disabled = false; btn.textContent = Utils.t('login'); }
            }
        },

        async logout() {
            this._clearOverdueInterval();
            
            if (Utils.NetworkMonitor && typeof Utils.NetworkMonitor.destroy === 'function') {
                Utils.NetworkMonitor.destroy();
            }
            
            const confirmed = await Utils.toast.confirm(Utils.t('save_exit_confirm'));
            if (!confirmed) return;
            this.clearPageState();
            sessionStorage.clear();
            this._isInitialized = false;
            await AUTH.logout();
            await this.renderLogin();
        },

        toggleLanguage() {
            const newLang = Utils.lang === 'id' ? 'zh' : 'id';
            Utils.setLanguage(newLang);
            if (this.currentPage === 'login' || !AUTH.isLoggedIn()) this.renderLogin();
            else this.refreshCurrentPage();
        },

        forceRecovery() {
            console.log('[Recovery] 手动强制恢复');
            const appDiv = document.getElementById('app');
            if (!appDiv) return;
            const loadingText = Utils.lang === 'id' ? 'Sedang memulihkan...' : '恢复中...';
            appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;margin:20px;"><div class="loader" style="margin:20px auto;"></div><p>' + loadingText + '</p></div>';
            setTimeout(async () => {
                try {
                    if (AUTH.isLoggedIn()) { await this.refreshCurrentPage(); }
                    else { await this.renderLogin(); }
                } catch (err) { 
                    appDiv.innerHTML = '<div class="card" style="text-align:center;padding:40px;"><p>⚠️ ' + (Utils.lang === 'id' ? 'Pemulihan gagal, muat ulang halaman.' : '恢复失败，请刷新页面。') + '</p><button onclick="location.reload()" class="btn btn--primary" style="margin-top:12px;">🔄 ' + (Utils.lang === 'id' ? 'Muat Ulang' : '刷新') + '</button></div>'; 
                }
            }, 100);
        },

        invalidateDashboardCache() {
            JF.Cache.clear();
            this.refreshCurrentPage();
            Utils.toast.info(Utils.lang === 'id' ? 'Cache dihapus, data diperbarui' : '缓存已清除，数据已刷新', 2000);
        },

        async init() {
            console.log('[DashboardCore] 开始初始化...');
            ModuleFallback.clearAll();
            
            try {
                await AUTH.init();
                
                if (!AUTH.isLoggedIn()) {
                    console.log('[DashboardCore] 用户未登录，显示登录页面');
                    await this.renderLogin();
                    return;
                }
                
                console.log('[DashboardCore] 用户已登录:', AUTH.user?.name);

                this._initGlobalKeyboard();

                const saved = this.restorePageState();
                if (saved.page && saved.page !== 'login') {
                    console.log('[DashboardCore] 恢复页面状态:', saved.page);
                    this.currentPage = saved.page;
                    this.currentOrderId = saved.orderId || null;
                    this.currentCustomerId = saved.customerId || null;
                    this.currentFilter = saved.filter || "all";
                    await this.refreshCurrentPage();
                } else {
                    console.log('[DashboardCore] 无保存状态，显示仪表盘');
                    await this.renderDashboard();
                }
                
                this._startOverdueInterval();
                this._isInitialized = true;
                
            } catch (error) {
                console.error('[DashboardCore] 初始化异常:', error);
                
                try { await AUTH.forceClearAuth(); } catch (e) { console.warn('[DashboardCore] 清除认证状态失败:', e); }
                
                this.clearPageState();
                Utils.toast.error(Utils.lang === 'id' ? 'Gagal memuat sistem, silakan login ulang' : '系统加载失败，请重新登录', 5000);
                
                setTimeout(() => { this.renderLogin(); }, 1000);
            }
        },
    };

    JF.DashboardCore = DashboardCore;

    if (!window.APP) {
        window.APP = DashboardCore;
    } else {
        for (const key of Object.keys(DashboardCore)) {
            if (typeof DashboardCore[key] === 'function' && !window.APP[key]) {
                window.APP[key] = DashboardCore[key].bind(DashboardCore);
            }
        }
        window.APP.navigateTo = DashboardCore.navigateTo.bind(DashboardCore);
        window.APP.goBack = DashboardCore.goBack.bind(DashboardCore);
        window.APP.refreshCurrentPage = DashboardCore.refreshCurrentPage.bind(DashboardCore);
        window.APP.renderDashboard = DashboardCore.renderDashboard.bind(DashboardCore);
        window.APP.logout = DashboardCore.logout.bind(DashboardCore);
        window.APP.forceRecovery = DashboardCore.forceRecovery.bind(DashboardCore);
        window.APP.invalidateDashboardCache = DashboardCore.invalidateDashboardCache.bind(DashboardCore);
        window.APP.toggleLanguage = DashboardCore.toggleLanguage.bind(DashboardCore);
        window.APP.login = DashboardCore.login.bind(DashboardCore);
        window.APP.renderLogin = DashboardCore.renderLogin.bind(DashboardCore);
        window.APP.init = DashboardCore.init.bind(DashboardCore);
    }

    window.addEventListener('beforeunload', () => {
        if (JF.DashboardCore) JF.DashboardCore.saveCurrentPageState();
    });

    console.log('✅ JF.DashboardCore v2.7 修复版（Enter 键防重复触发 + 统一登录页处理）');
})();
