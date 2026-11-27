document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('models-container');
  if (!container) return;

  const seriesId = new URLSearchParams(location.search).get('series');

  // 没有参数：回到总览页。
  // 用 replace 而不是 href，否则「返回」键会回到本页再被跳走，用户被卡住。
  if (!seriesId) {
    location.replace('instruments.html');
    return;
  }

  // 安全：只允许字母、数字、下划线、连字符。
  // 原版把 ?series= 的内容原样拼进 URL，失败时又用 innerHTML 把 URL 显示出来，
  // 访问 products.html?series=<img src=x onerror=alert(1)> 就会执行脚本（反射型 XSS）。
  if (!/^[A-Za-z0-9_-]+$/.test(seriesId)) {
    showError('没有找到这个系列，请返回首页重新选择。', `invalid series: ${seriesId}`);
    return;
  }

  const jsonUrl = `data/${seriesId}.json`;
  container.innerHTML = '<p>加载中...</p>';

  // cache:'no-cache' = 每次向服务器确认是否有更新（有 ETag 则 304 不重新下载），
  // 比原来的 ?t=Date.now() 省流量，也不会让 CDN 缓存失效。
  fetch(jsonUrl, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const models = data && data.series && data.series[0] && data.series[0].models;
      if (!Array.isArray(models)) {
        throw new Error('数据格式错误：缺少 series 或 models 字段');
      }
      if (models.length === 0) {
        container.innerHTML = '<p>该系列暂无产品，敬请期待。</p>';
        return;
      }

      container.innerHTML = models.map((m) => `
        <div class="product-card">
          <img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy" decoding="async">
          <h3>${esc(m.name)}</h3>
          <p>${m.features /* 来自自己的 JSON；若其中不含 HTML 标签，建议也改成 esc(m.features) */}</p>
          <a class="order-button" href="pricing.html">订购</a>
        </div>
      `).join('');
    })
    .catch((error) => {
      showError('产品加载失败，请检查网络后重试。', `${jsonUrl} -> ${error.message}`);
    });

  // 错误信息：给用户看友好提示，技术细节只写控制台；全程用 textContent，不会注入 HTML
  function showError(message, detail) {
    console.error('产品加载失败:', detail);
    container.textContent = '';

    const box = document.createElement('div');
    box.style.cssText = 'text-align:center;padding:20px;color:#ff9b9b;';

    const text = document.createElement('p');
    text.textContent = message;

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'base-button';
    retry.textContent = '重新加载';
    retry.addEventListener('click', () => location.reload());

    box.append(text, retry);
    container.appendChild(box);
  }

  // HTML 转义
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
});
