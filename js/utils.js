const Utils = {

    formatIDR(n) {
        return new Intl.NumberFormat('id-ID').format(Math.floor(n));
    },

    today() {
        return new Date().toISOString().slice(0, 10);
    },

    diffDays(date) {
        return Math.floor((new Date() - new Date(date)) / 86400000);
    }
};
