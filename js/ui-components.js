// ui-components.js - v1.0
// 全局 Toast 通知 + 模态确认框（替代 alert/confirm/prompt）
// 部署方式：将此文件与原有 JS 文件放在同一目录，并在 HTML 中按顺序引入
//          <script src="ui-components.js"></script>
//          （建议在 utils.js 之后、其他业务文件之前引入）

window.UI = window.UI || {};

(function() {
    'use strict';

    // ==================== 注入全局样式 ====================
    var _stylesInjected = false;
    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;

        var style = document.createElement('style');
        style.id = 'ui-components-style';
        style.textContent = '' +
            '/* Toast 容器 */' +
            '#toast-container {' +
                'position:fixed;top:16px;right:16px;z-index:10000;' +
                'display:flex;flex-direction:column;gap:10px;pointer-events:none;' +
            '}' +
            '.toast {' +
                'pointer-events:all;padding:12px 20px;border-radius:8px;color:#fff;' +
                'font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,0.18);' +
                'cursor:pointer;max-width:380px;word-break:break-word;' +
                'animation:toastSlideIn 0.35s ease-out;' +
                'display:flex;align-items:center;gap:8px;' +
            '}' +
            '.toast-success{background:#10b981;}' +
            '.toast-error{background:#ef4444;}' +
            '.toast-warning{background:#f59e0b;}' +
            '.toast-info{background:#3b82f6;}' +
            '.toast-removing{animation:toastSlideOut 0.3s ease-in forwards;}' +
            '@keyframes toastSlideIn{' +
                'from{transform:translateX(120%);opacity:0;}' +
                'to{transform:translateX(0);opacity:1;}' +
            '}' +
            '@keyframes toastSlideOut{' +
                'from{transform:translateX(0);opacity:1;}' +
                'to{transform:translateX(120%);opacity:0;}' +
            '}' +
            '/* 全局模态弹窗 */' +
            '.global-modal-overlay{' +
                'position:fixed;top:0;left:0;right:0;bottom:0;' +
                'background:rgba(0,0,0,0.55);display:flex;' +
                'align-items:center;justify-content:center;z-index:10001;' +
                'animation:globalFadeIn 0.2s ease;' +
            '}' +
            '.global-modal-content{' +
                'background:#fff;border-radius:12px;padding:24px;' +
                'max-width:460px;width:90%;' +
                'box-shadow:0 8px 30px rgba(0,0,0,0.25);' +
                'animation:globalPopIn 0.25s ease-out;' +
            '}' +
            '.global-modal-title{' +
                'font-size:18px;font-weight:700;margin-bottom:12px;color:#1e293b;' +
            '}' +
            '.global-modal-body{' +
                'font-size:14px;line-height:1.6;color:#475569;' +
                'margin-bottom:20px;white-space:pre-line;' +
            '}' +
            '.global-modal-actions{' +
                'display:flex;justify-content:flex-end;gap:12px;' +
            '}' +
            '.global-modal-btn{' +
                'padding:8px 20px;border:none;border-radius:6px;' +
                'font-size:14px;font-weight:600;cursor:pointer;transition:all 0.15s;' +
            '}' +
            '.global-modal-btn-cancel{background:#f1f5f9;color:#475569;}' +
            '.global-modal-btn-cancel:hover{background:#e2e8f0;}' +
            '.global-modal-btn-danger{background:#ef4444;color:#fff;}' +
            '.global-modal-btn-danger:hover{background:#dc2626;}' +
            '.global-modal-btn-warning{background:#f59e0b;color:#fff;}' +
            '.global-modal-btn-warning:hover{background:#d97706;}' +
            '.global-modal-btn-success{background:#10b981;color:#fff;}' +
            '.global-modal-btn-success:hover{background:#059669;}' +
            '.global-modal-btn-info{background:#3b82f6;color:#fff;}' +
            '.global-modal-btn-info:hover{background:#2563eb;}' +
            '#prompt-input{' +
                'width:100%;padding:10px 12px;border:1px solid #cbd5e1;' +
                'border-radius:6px;font-size:14px;box-sizing:border-box;' +
            '}' +
            '#prompt-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1);}' +
            '#prompt-error{color:#ef4444;font-size:12px;margin-top:4px;display:none;}' +
            '@keyframes globalFadeIn{from{opacity:0;}to{opacity:1;}}' +
            '@keyframes globalPopIn{from{transform:scale(0.9);opacity:0;}to{transform:scale(1);opacity:1;}}';
        document.head.appendChild(style);
    }

    // ==================== HTML 转义（安全） ====================
    window.UI.escapeHtml = function(str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    };

    // ==================== Toast 通知（替代 alert） ====================
    var _toastIdCounter = 0;
    var _toastTimerMap = {};

    window.UI.showToast = function(message, type, duration) {
        if (!type) type = 'info';
        if (!duration && duration !== 0) duration = 3000;

        _injectStyles();

        var container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        var id = 'toast-' + (++_toastIdCounter);
        var toast = document.createElement('div');
        toast.id = id;
        toast.className = 'toast toast-' + type;
        toast.textContent = message;

        // 点击关闭
        toast.addEventListener('click', function() {
            window.UI.removeToast(id);
        });

        container.appendChild(toast);

        // 自动移除
        if (_toastTimerMap[id]) clearTimeout(_toastTimerMap[id]);
        if (duration > 0) {
            var timer = setTimeout(function() {
                window.UI.removeToast(id);
            }, duration);
            _toastTimerMap[id] = timer;
        }

        return id;
    };

    window.UI.removeToast = function(id) {
        var toast = document.getElementById(id);
        if (!toast) return;
        if (_toastTimerMap[id]) {
            clearTimeout(_toastTimerMap[id]);
            delete _toastTimerMap[id];
        }
        toast.classList.add('toast-removing');
        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, 300);
    };

    // ==================== 模态确认框（替代 confirm） ====================
    window.UI.showConfirm = function(options) {
        if (!options) options = {};

        _injectStyles();

        var title = options.title || 'Konfirmasi';
        var message = options.message || '';
        var confirmText = options.confirmText || (window.Utils && Utils.t ? Utils.t('save') : 'OK');
        var cancelText = options.cancelText || (window.Utils && Utils.t ? Utils.t('cancel') : 'Cancel');
        var type = options.type || 'info';
        var icon = options.icon || null;

        return new Promise(function(resolve) {
            // 移除可能已存在的 modal
            var existing = document.querySelector('.global-modal-overlay');
            if (existing) existing.remove();

            var overlay = document.createElement('div');
            overlay.className = 'global-modal-overlay';

            var iconHtml = icon ? '<span style="font-size:20px;">' + icon + '</span> ' : '';
            overlay.innerHTML = '' +
                '<div class="global-modal-content">' +
                    '<div class="global-modal-title">' + window.UI.escapeHtml(title) + '</div>' +
                    '<div class="global-modal-body">' + iconHtml + window.UI.escapeHtml(message) + '</div>' +
                    '<div class="global-modal-actions">' +
                        '<button class="global-modal-btn global-modal-btn-cancel" id="confirm-cancel">' + window.UI.escapeHtml(cancelText) + '</button>' +
                        '<button class="global-modal-btn global-modal-btn-' + type + '" id="confirm-ok">' + window.UI.escapeHtml(confirmText) + '</button>' +
                    '</div>' +
                '</div>';

            var close = function(result) {
                overlay.remove();
                resolve(result);
            };

            overlay.querySelector('#confirm-ok').addEventListener('click', function() { close(true); });
            overlay.querySelector('#confirm-cancel').addEventListener('click', function() { close(false); });
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) close(false);
            });

            document.body.appendChild(overlay);

            // 自动聚焦确认按钮
            setTimeout(function() {
                var okBtn = overlay.querySelector('#confirm-ok');
                if (okBtn) okBtn.focus();
            }, 100);

            // ESC 键关闭
            var escHandler = function(e) {
                if (e.key === 'Escape') {
                    close(false);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    };

    // ==================== 带输入框的模态框（替代 prompt） ====================
    window.UI.showPrompt = function(options) {
        if (!options) options = {};

        _injectStyles();

        var title = options.title || 'Input';
        var message = options.message || '';
        var placeholder = options.placeholder || '';
        var defaultValue = options.defaultValue || '';
        var confirmText = options.confirmText || 'OK';
        var cancelText = options.cancelText || (window.Utils && window.Utils.t ? Utils.t('cancel') : 'Cancel');
        var type = options.type || 'info';
        var required = options.required === true;
        var requiredMessage = options.requiredMessage || 'Harap isi bidang ini';

        return new Promise(function(resolve) {
            var existing = document.querySelector('.global-modal-overlay');
            if (existing) existing.remove();

            var overlay = document.createElement('div');
            overlay.className = 'global-modal-overlay';

            overlay.innerHTML = '' +
                '<div class="global-modal-content">' +
                    '<div class="global-modal-title">' + window.UI.escapeHtml(title) + '</div>' +
                    '<div class="global-modal-body">' + window.UI.escapeHtml(message) + '</div>' +
                    '<div style="margin-bottom:16px;">' +
                        '<input id="prompt-input" type="text" ' +
                               'placeholder="' + window.UI.escapeHtml(placeholder) + '" ' +
                               'value="' + window.UI.escapeHtml(defaultValue) + '">' +
                        '<div id="prompt-error"></div>' +
                    '</div>' +
                    '<div class="global-modal-actions">' +
                        '<button class="global-modal-btn global-modal-btn-cancel" id="prompt-cancel">' + window.UI.escapeHtml(cancelText) + '</button>' +
                        '<button class="global-modal-btn global-modal-btn-' + type + '" id="prompt-ok">' + window.UI.escapeHtml(confirmText) + '</button>' +
                    '</div>' +
                '</div>';

            var inputEl = overlay.querySelector('#prompt-input');
            var errorEl = overlay.querySelector('#prompt-error');

            var close = function(result) {
                overlay.remove();
                resolve(result);
            };

            overlay.querySelector('#prompt-ok').addEventListener('click', function() {
                var value = inputEl.value.trim();
                if (required && !value) {
                    errorEl.textContent = requiredMessage;
                    errorEl.style.display = 'block';
                    inputEl.focus();
                    return;
                }
                close(value);
            });

            overlay.querySelector('#prompt-cancel').addEventListener('click', function() { close(null); });
            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) close(null);
            });

            document.body.appendChild(overlay);

            setTimeout(function() { inputEl.focus(); }, 150);

            // Enter 提交
            inputEl.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    overlay.querySelector('#prompt-ok').click();
                }
            });

            // ESC 关闭
            var escHandler = function(e) {
                if (e.key === 'Escape') {
                    close(null);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    };

    console.log('✅ UI Components 已加载 (Toast + Confirm + Prompt)');
})();
