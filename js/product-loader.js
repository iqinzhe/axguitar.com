document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const seriesId = urlParams.get('series');

  if (!seriesId) {
    // 没有参数就回到总览页
    window.location.href = 'instruments.html';
    return;
  }

  const jsonUrl = `data/${seriesId}.json?t=${Date.now()}`;
  const container = document.getElementById('models-container');
  container.innerHTML = `<p>加载中...</p>`;

  fetch(jsonUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (!data.series || !data.series[0] || !data.series[0].models) {
        throw new Error('数据格式错误：缺少 series 或 models 字段');
      }

      const series = data.series[0];
      container.innerHTML = series.models.map(m => `
        <div class="product-card">
          <img src="${m.image}" alt="${m.name}">
          <h3>${m.name}</h3>
          <p>${m.features}</p>
          <a class="order-button" href="pricing.html">订购</a>
        </div>
      `).join('');
    })
    .catch(error => {
      console.error('加载失败详情:', error);
      container.innerHTML = `<div style="color:red; text-align:center; padding:20px;">
        产品加载失败: ${error.message}<br>
        请求URL: ${jsonUrl}
      </div>`;
    });
});
