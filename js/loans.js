function renderLoans() {

    return `
        <div>

            <h2>💰 Loans Management</h2>

            <button onclick="openCreateLoan()">+ New Loan</button>

            <div style="margin-top:15px;">

                ${DB.loans.map(l => {

                    const interest = calcInterest(l);

                    return `
                        <div class="card">

                            <b>${l.name}</b> <br>

                            💰 Principal: ${l.principal} <br>
                            📉 Remaining: ${l.remainingPrincipal} <br>
                            💸 Interest: ${interest} <br>

                            <button onclick="openDetail(${l.id})">
                                View Detail
                            </button>

                        </div>
                    `;
                }).join("")}

            </div>

        </div>
    `;
}
