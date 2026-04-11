const PaymentService = {

    payInterest(id) {

        const loan = DB.loans.find(l => l.id === id);

        const amount = LoanService.interest(loan);

        loan.history.push({
            type: "interest",
            amount,
            date: Utils.today()
        });

        loan.lastInterest = Utils.today();
    },

    payPrincipal(id) {

        const loan = DB.loans.find(l => l.id === id);

        const amount = parseFloat(prompt("Amount"));

        loan.remaining -= amount;

        loan.history.push({
            type: "principal",
            amount,
            date: Utils.today()
        });
    }
};
