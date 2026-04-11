function renderDashboard() {

    const totalLoan = DB.loans.reduce((a,b)=>a+b.principal,0);
    const remain = DB.loans.reduce((a,b)=>a+b.remainingPrincipal,0);
    const active = DB.loans.length;

    return `
        <div class="grid">
            <div class="card">💰 Total Loan<br><b>${totalLoan}</b></div>
            <div class="card">📉 Remaining<br><b>${remain}</b></div>
            <div class="card">👥 Active Loans<br><b>${active}</b></div>
        </div>
    `;
}
