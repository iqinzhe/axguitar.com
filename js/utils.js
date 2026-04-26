// 示例：创建订单时自动支持离线队列
async function createOrderWithOfflineSupport(orderData) {
    try {
        return await Order.create(orderData);
    } catch (error) {
        if (error.message && (error.message.includes('network') || error.message.includes('fetch'))) {
            // 自动加入队列，已在 Utils.wrapWithOfflineSupport 中实现
            throw new Error(Utils.lang === 'id' 
                ? 'Tidak ada koneksi. Pesanan akan disimpan dan diproses nanti.'
                : '无网络连接。订单已保存，将在恢复后处理。');
        }
        throw error;
    }
}
