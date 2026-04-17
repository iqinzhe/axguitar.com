// 原来的代码（删除）：
// <div class="cashflow-item"><div class="label">📊 ${lang === 'id' ? 'Laba Bersih' : '净利'}</div><div class="value">${Utils.formatCurrency(cashFlow.profit?.balance || 0)}</div></div>

// 修改后的 cashflow-stats 只保留三个卡片：
<div class="cashflow-stats">
    <div class="cashflow-item">
        <div class="label">🏦 ${lang === 'id' ? 'Brankas (Tunai)' : '保险柜 (现金)'}</div>
        <div class="value ${cashFlow.cash.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.cash.balance)}</div>
        <div class="cashflow-detail">
            ${lang === 'id' ? 'Pemasukan' : '收入'}: +${Utils.formatCurrency(cashFlow.cash.income)}<br>
            ${lang === 'id' ? 'Pengeluaran' : '支出'}: -${Utils.formatCurrency(cashFlow.cash.expense)}
        </div>
    </div>
    <div class="cashflow-item">
        <div class="label">🏧 ${lang === 'id' ? 'Bank BNI' : '银行 BNI'}</div>
        <div class="value ${cashFlow.bank.balance < 0 ? 'negative' : ''}">${Utils.formatCurrency(cashFlow.bank.balance)}</div>
        <div class="cashflow-detail">
            ${lang === 'id' ? 'Pemasukan' : '收入'}: +${Utils.formatCurrency(cashFlow.bank.income)}<br>
            ${lang === 'id' ? 'Pengeluaran' : '支出'}: -${Utils.formatCurrency(cashFlow.bank.expense)}
        </div>
    </div>
    <div class="cashflow-item">
        <div class="label">📊 ${lang === 'id' ? 'Total Kas' : '总现金'}</div>
        <div class="value">${Utils.formatCurrency(cashFlow.total.balance)}</div>
        <div class="cashflow-detail">
            📈 ${lang === 'id' ? 'Pendapatan' : '收入'}: +${Utils.formatCurrency(cashFlow.total.income)}<br>
            📉 ${lang === 'id' ? 'Pengeluaran' : '支出'}: -${Utils.formatCurrency(cashFlow.total.expense)}
        </div>
    </div>
</div>
