const LoanService = {

    create(data) {

        if (!PERMISSION.has("CREATE")) return;

        DB.loans.push({
            id: Date.now(),
            ...data,
            remaining: data.principal,
            history: []
        });
    },

    interest(loan) {

        const days = Utils.diffDays(loan.lastInterest);
        if (days <= 0) return 0;

        return loan.remaining * (loan.rate / 100 / 30) * days;
    }
};
