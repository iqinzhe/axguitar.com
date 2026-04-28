// 在 createOrderForCustomer 方法中，黑名单检查部分修改为：

var blacklistCheck = { isBlacklisted: false };
try {
    const { data: blData } = await supabaseClient
        .from('blacklist')
        .select('id, reason')
        .eq('customer_id', customer.id)  // 修复：使用 customer.id 而不是 customerId
        .maybeSingle();
    blacklistCheck = blData ? { isBlacklisted: true, reason: blData.reason } : { isBlacklisted: false };
} catch(blErr) {
    console.warn('黑名单检查失败:', blErr.message);
}

if (blacklistCheck && blacklistCheck.isBlacklisted) {
    alert(lang === 'id' ? '❌ Nasabah ini telah di-blacklist, tidak dapat membuat pesanan baru.' : '❌ 此客户已被拉黑，无法创建新订单。');
    return;
}
