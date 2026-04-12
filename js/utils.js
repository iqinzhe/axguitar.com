// 添加 generateOrderIdForSupabase 方法
Utils.generateOrderIdForSupabase = function(role) {
    const prefix = role === 'admin' ? 'AD' : 'ST';
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    return `${prefix}-${yy}${mm}-${random}`;
};
