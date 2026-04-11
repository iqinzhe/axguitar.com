function addLoan(data) {

    const loan = {
        id: Date.now(),
        ...data,
        remainingPrincipal: data.principal,
        paymentHistory: [],
        createdBy: DB.currentUser.username,
        createdAt: new Date().toISOString()
    };

    DB.loans.push(loan);

    addLog("CREATE_LOAN", loan);
}

function renderLoans() {
    return `
        <div>
            <h2>Loans</h2>
            <button onclick="createDemoLoan()">+ Add Demo</button>
        </div>
    `;
}

function createDemoLoan() {
    addLoan({
        name:"Demo User",
        principal:1000000,
        interestRate:10
    });

    renderPage();
}
