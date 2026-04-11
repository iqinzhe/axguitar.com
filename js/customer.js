const Customer = {

    create(db, data) {

        const id = Date.now();

        db.customers.push({
            id,
            name: data.name,
            phone: data.phone,
            createdAt: new Date().toISOString()
        });

        return id;
    },

    find(db, keyword) {
        return db.customers.filter(c =>
            c.name.includes(keyword) || c.phone.includes(keyword)
        );
    }
};

window.Customer = Customer;
