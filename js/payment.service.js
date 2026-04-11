const PaymentService = {

    payInterest(id) {

        if (!PERMISSION.has("PAY")) return;

        const loan = DB.loans.find(l => l.id === id);

        const amount = LoanService.interest(loan);

        loan.history.push({
            type: "interest",
            amount,
            date: Utils.today()
        });

        loan.lastInterest = Utils.today();
    },

    payPrincipal(id, amount) {

        if (!PERMISSION.has("PAY")) return;

        const loan = DB.loans.find(l => l.id === id);

        loan.remaining -= amount;

        loan.history.push({
            type: "principal",
            amount,
            date: Utils.today()
        });
    }
};
