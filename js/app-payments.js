// app-payments.js - 修复版

window.APP = window.APP || {};

const PaymentModule = {
    currentPage: 'paymentHistory',
    currentFilter: 'all',
    searchKeyword: '',

    saveCurrentPageState: function() {
        localStorage.setItem('lastPage', this.currentPage);
    },

    goBack: function() {
        if (typeof window.APP.navigateTo === 'function') {
            window.APP.navigateTo('dashboard');
        } else {
            window.location.reload();
        }
    },

    showPaymentHistory: async function () {
        this.currentPage = 'paymentHistory';
        this.saveCurrentPageState();
        var lang = Utils.lang;
        var t = (key) => Utils.t(key);

        try {
            var profile = await SUPABASE.getCurrentProfile();
            var isAdmin = profile?.role === 'admin';
            var storeId = profile?.store_id;

            let query = supabaseClient
                .from('payment_history')
                .select(`
                    *,
                    orders:order_id (
                        order_id,
                        customer_name,
                        collateral_name,
                        store_id
                    )
                `)
                .order('payment_date', { ascending: false });

            if (!isAdmin && storeId) {
                query = query.eq('orders.store_id', storeId);
            }

            const { data: payments, error } = await query;
            if (error) throw error;

            let rows = '';
            if (payments && payments.length > 0) {
                for (const p of payments) {
                    let method = p.payment_method === 'cash'
                        ? (lang === 'id' ? 'Tunai' : '现金')
                        : (lang === 'id' ? 'Bank BNI' : '银行');

                    let type = p.payment_type === 'interest'
                        ? (lang === 'id' ? 'Bunga' : '利息')
                        : (lang === 'id' ? 'Pelunasan' : '结清');

                    rows += `
                    <tr>
                        <td>${Utils.formatDate(p.payment_date)}</td>
                        <td>${p.orders?.order_id || '-'}</td>
                        <td>${p.orders?.customer_name || '-'}</td>
                        <td>${p.orders?.collateral_name || '-'}</td>
                        <td>${Utils.formatCurrency(p.amount)}</td>
                        <td>${method}</td>
                        <td>${type}</td>
                        <td>${p.receipt_number || '-'}</td>
                    </tr>`;
                }
            } else {
                rows = `<tr><td colspan="8" class="text-center">${t('no_data')}</td><\/tr>`;
            }

            document.getElementById('app').innerHTML = `
                <div class="page-header">
                    <h2>💰 ${t('payment_history')}</h2>
                    <div class="header-actions">
                        <button onclick="APP.printCurrentPage()" class="btn-print">🖨️ ${lang === 'id' ? 'Cetak' : '打印'}</button>
                        <button onclick="APP.goBack()" class="btn-back">↩️ ${t('back')}</button>
                    </div>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>${lang === 'id' ? 'Tanggal' : '日期'}</th>
                                <th>${lang === 'id' ? 'ID Pesanan' : '订单编号'}</th>
                                <th>${lang === 'id' ? 'Nasabah' : '客户'}</th>
                                <th>${lang === 'id' ? 'Agunan' : '当品'}</th>
                                <th>${lang === 'id' ? 'Jumlah' : '金额'}</th>
                                <th>${lang === 'id' ? 'Metode' : '支付方式'}</th>
                                <th>${lang === 'id' ? 'Tipe' : '类型'}</th>
                                <th>${lang === 'id' ? 'No. Resi' : '收据号'}</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;

        } catch (err) {
            console.error('showPaymentHistory error:', err);
            alert(lang === 'id' ? 'Gagal memuat riwayat pembayaran' : '加载缴费记录失败');
        }
    }
};

// 安全绑定
for (const key in PaymentModule) {
    if (PaymentModule.hasOwnProperty(key) && typeof PaymentModule[key] === 'function') {
        window.APP[key] = PaymentModule[key].bind(PaymentModule);
    }
}

// 确保核心方法存在
if (typeof window.APP.saveCurrentPageState !== 'function') {
    window.APP.saveCurrentPageState = function() {
        if (this.currentPage) {
            localStorage.setItem('lastPage', this.currentPage);
        }
    };
}

if (typeof window.APP.goBack !== 'function') {
    window.APP.goBack = function() {
        const lastPage = localStorage.getItem('lastPage') || 'dashboard';
        if (typeof this.navigateTo === 'function') {
            this.navigateTo(lastPage);
        } else if (typeof window.APP.navigateTo === 'function') {
            window.APP.navigateTo(lastPage);
        } else {
            window.location.href = '#dashboard';
            location.reload();
        }
    };
}

console.log('✅ app-payments.js 修复版已加载');
