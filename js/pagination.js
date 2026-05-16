// pagination.js - JF! by Gadai 通用分页模块
// 使用方式：JF.Pagination.render(containerId, items, pageNum, pageSize, renderRowFn, options)
'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    // ==================== 分页状态存储 ====================
    // key: containerId, value: { page, pageSize, total, items }
    const _state = {};

    // ==================== 核心渲染函数 ====================
    /**
     * 渲染分页列表
     * @param {string} containerId   - tbody 或列表容器的 id
     * @param {Array}  items         - 全量数据数组（已在前端的）
     * @param {number} page          - 当前页（从1开始）
     * @param {number} pageSize      - 每页条数
     * @param {Function} renderRowFn - 将单条数据渲染为 HTML 字符串的函数
     * @param {object} options       - 可选配置
     *   @param {string} options.paginatorId  - 分页控件插入位置的容器 id（默认 containerId + '_paginator'）
     *   @param {string} options.counterId    - 显示"共N条"的元素 id
     *   @param {string} options.emptyHtml    - 空数据时显示的 HTML
     *   @param {number[]} options.pageSizes  - 每页条数选项，默认 [15, 25, 50]
     *   @param {boolean} options.showSizeSelector - 是否显示每页条数选择器，默认 true
     */
    function render(containerId, items, page, pageSize, renderRowFn, options) {
        options = options || {};
        const lang = (window.Utils && Utils.lang) || 'zh';
        const paginatorId = options.paginatorId || (containerId + '_paginator');
        const pageSizes = options.pageSizes || [15, 25, 50];
        const showSizeSelector = options.showSizeSelector !== false;
        const emptyHtml = options.emptyHtml || `<tr><td colspan="99" style="text-align:center;padding:24px;color:var(--text-muted);">${lang === 'id' ? 'Tidak ada data' : '暂无数据'}</td></tr>`;

        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(Math.max(1, page), totalPages);

        // 保存状态
        _state[containerId] = { page, pageSize, total, items, renderRowFn, options };

        // 切片当页数据
        const start = (page - 1) * pageSize;
        const slice = items.slice(start, start + pageSize);

        // 渲染行
        const tbody = document.getElementById(containerId);
        if (tbody) {
            tbody.innerHTML = slice.length > 0
                ? slice.map(renderRowFn).join('')
                : emptyHtml;
        }

        // 渲染分页控件
        const paginator = document.getElementById(paginatorId);
        if (paginator) {
            paginator.innerHTML = _buildPaginatorHtml(containerId, page, totalPages, pageSize, total, pageSizes, showSizeSelector, lang);
        }

        // 更新计数器
        if (options.counterId) {
            const counter = document.getElementById(options.counterId);
            if (counter) {
                const from = total === 0 ? 0 : start + 1;
                const to = Math.min(start + pageSize, total);
                counter.textContent = lang === 'id'
                    ? `${from}–${to} dari ${total}`
                    : `第 ${from}–${to} 条，共 ${total} 条`;
            }
        }
    }

    // ==================== 跳转到指定页 ====================
    function goToPage(containerId, page) {
        const s = _state[containerId];
        if (!s) return;
        render(containerId, s.items, page, s.pageSize, s.renderRowFn, s.options);
    }

    // ==================== 更改每页条数 ====================
    function changePageSize(containerId, newSize) {
        const s = _state[containerId];
        if (!s) return;
        render(containerId, s.items, 1, parseInt(newSize, 10), s.renderRowFn, s.options);
    }

    // ==================== 构建分页控件 HTML ====================
    function _buildPaginatorHtml(containerId, page, totalPages, pageSize, total, pageSizes, showSizeSelector, lang) {
        if (total === 0) return '';

        const cid = containerId.replace(/'/g, "\\'");

        // 页码按钮：最多显示7个，超出用省略号
        let pageButtons = '';
        const pages = _getPageNumbers(page, totalPages);
        for (const p of pages) {
            if (p === '...') {
                pageButtons += `<span class="jf-page-ellipsis">…</span>`;
            } else {
                const active = p === page ? ' jf-page-active' : '';
                pageButtons += `<button class="jf-page-btn${active}" onclick="JF.Pagination.goToPage('${cid}',${p})">${p}</button>`;
            }
        }

        const prevDisabled = page <= 1 ? ' disabled' : '';
        const nextDisabled = page >= totalPages ? ' disabled' : '';
        const prevLabel = lang === 'id' ? '‹ Prev' : '‹ 上一页';
        const nextLabel = lang === 'id' ? 'Next ›' : '下一页 ›';

        // 每页条数选择器
        let sizeSelector = '';
        if (showSizeSelector && total > pageSizes[0]) {
            const opts = pageSizes.map(s =>
                `<option value="${s}"${s === pageSize ? ' selected' : ''}>${s}</option>`
            ).join('');
            const label = lang === 'id' ? 'per hal' : '条/页';
            sizeSelector = `<select class="jf-page-size-select" onchange="JF.Pagination.changePageSize('${cid}',this.value)">${opts}</select><span class="jf-page-size-label">${label}</span>`;
        }

        // 总数信息
        const from = (page - 1) * pageSize + 1;
        const to = Math.min(page * pageSize, total);
        const info = lang === 'id'
            ? `<span class="jf-page-info">${from}–${to} / ${total}</span>`
            : `<span class="jf-page-info">第 ${from}–${to} 条 / 共 ${total} 条</span>`;

        return `<div class="jf-paginator">
            ${info}
            <div class="jf-page-controls">
                <button class="jf-page-btn jf-page-nav"${prevDisabled} onclick="JF.Pagination.goToPage('${cid}',${page-1})">${prevLabel}</button>
                ${pageButtons}
                <button class="jf-page-btn jf-page-nav"${nextDisabled} onclick="JF.Pagination.goToPage('${cid}',${page+1})">${nextLabel}</button>
            </div>
            ${sizeSelector}
        </div>`;
    }

    // ==================== 计算显示哪些页码 ====================
    function _getPageNumbers(current, total) {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages = [];
        if (current <= 4) {
            for (let i = 1; i <= 5; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        } else if (current >= total - 3) {
            pages.push(1);
            pages.push('...');
            for (let i = total - 4; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            for (let i = current - 1; i <= current + 1; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        }
        return pages;
    }

    // ==================== 生成分页容器占位 HTML ====================
    // 在列表 HTML 字符串里调用，生成 tbody + paginator 容器
    function scaffold(tbodyId, paginatorId, theadHtml, tableClass) {
        tableClass = tableClass || 'data-table';
        paginatorId = paginatorId || (tbodyId + '_paginator');
        return `<div class="table-container">
            <table class="${tableClass}">
                ${theadHtml}
                <tbody id="${tbodyId}"></tbody>
            </table>
        </div>
        <div id="${paginatorId}"></div>`;
    }

    JF.Pagination = { render, goToPage, changePageSize, scaffold };
})();
