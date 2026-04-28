// toast.js - v1.0 新增文件
window.Toast = window.Toast || {};

(function() {
    'use strict';
    
    let toastContainer = null;
    let confirmModal = null;
    
    // 初始化 Toast 容器
    function initContainer() {
        if (toastContainer) return;
        
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            z-index: 10050;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // 显示 Toast 通知
    function show(message, type = 'info', duration = 3000) {
        initContainer();
        
        const toast = document.createElement('div');
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        const bgColors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        
        toast.style.cssText = `
            background: ${bgColors[type] || bgColors.info};
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            pointer-events: auto;
            animation: slideIn 0.3s ease;
            cursor: pointer;
        `;
        
        toast.innerHTML = `
            <span style="font-size: 18px;">${icons[type] || icons.info}</span>
            <span style="flex:1;">${message}</span>
            <span style="cursor:pointer; opacity:0.7;">✖</span>
        `;
        
        // 点击关闭
        const closeBtn = toast.querySelector('span:last-child');
        closeBtn.onclick = () => {
            toast.style.animation = 'slideOut 0.2s ease';
            setTimeout(() => toast.remove(), 200);
        };
        
        // 点击任意位置关闭
        toast.onclick = (e) => {
            if (e.target !== closeBtn) {
                toast.style.animation = 'slideOut 0.2s ease';
                setTimeout(() => toast.remove(), 200);
            }
        };
        
        toastContainer.appendChild(toast);
        
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.animation = 'slideOut 0.2s ease';
                    setTimeout(() => toast.remove(), 200);
                }
            }, duration);
        }
    }
    
    // 添加动画样式
    function addAnimations() {
        if (document.getElementById('toast-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(-100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 确认对话框（替换 confirm）
    function confirm(message, title, onConfirm, onCancel) {
        // 移除已有的确认框
        if (confirmModal) confirmModal.remove();
        
        const lang = Utils.lang;
        const defaultTitle = lang === 'id' ? 'Konfirmasi' : '确认操作';
        const confirmText = lang === 'id' ? 'Ya, Lanjutkan' : '确认';
        const cancelText = lang === 'id' ? 'Batal' : '取消';
        
        confirmModal = document.createElement('div');
        confirmModal.className = 'confirm-modal-overlay';
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10060;
            animation: fadeIn 0.2s ease;
        `;
        
        confirmModal.innerHTML = `
            <div class="confirm-modal-content" style="
                background: white;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                padding: 20px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                animation: scaleIn 0.2s ease;
            ">
                <h3 style="margin: 0 0 12px 0; font-size: 18px;">${Utils.escapeHtml(title || defaultTitle)}</h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; white-space: pre-line;">${Utils.escapeHtml(message)}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="confirm-cancel-btn" style="
                        padding: 8px 20px;
                        background: #e2e8f0;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${cancelText}</button>
                    <button class="confirm-ok-btn" style="
                        padding: 8px 20px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">${confirmText}</button>
                </div>
            </div>
        `;
        
        // 添加动画样式
        if (!document.getElementById('confirm-animations')) {
            const style = document.createElement('style');
            style.id = 'confirm-animations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from {
                        transform: scale(0.95);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        const cancelBtn = confirmModal.querySelector('.confirm-cancel-btn');
        const okBtn = confirmModal.querySelector('.confirm-ok-btn');
        
        const cleanup = () => {
            if (confirmModal && confirmModal.parentElement) {
                confirmModal.remove();
                confirmModal = null;
            }
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            if (onCancel) onCancel();
        };
        
        okBtn.onclick = () => {
            cleanup();
            if (onConfirm) onConfirm();
        };
        
        // 点击背景关闭
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                cleanup();
                if (onCancel) onCancel();
            }
        };
        
        document.body.appendChild(confirmModal);
        
        return { modal: confirmModal, cleanup };
    }
    
    // 声明式确认框（返回 Promise）
    function confirmPromise(message, title) {
        return new Promise((resolve) => {
            confirm(message, title, () => resolve(true), () => resolve(false));
        });
    }
    
    // 内联确认按钮组件（用于表格操作行）
    function createInlineConfirmButtons(onConfirm, onCancel) {
        const lang = Utils.lang;
        const container = document.createElement('div');
        container.style.display = 'inline-flex';
        container.style.gap = '4px';
        container.style.marginLeft = '8px';
        
        container.innerHTML = `
            <button class="confirm-yes" style="
                background: #10b981;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 11px;
                cursor: pointer;
            ">✓</button>
            <button class="confirm-no" style="
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 11px;
                cursor: pointer;
            ">✗</button>
        `;
        
        container.querySelector('.confirm-yes').onclick = () => {
            container.remove();
            onConfirm();
        };
        
        container.querySelector('.confirm-no').onclick = () => {
            container.remove();
            if (onCancel) onCancel();
        };
        
        return container;
    }
    
    // 包装原始 alert 和 confirm（降级兼容）
    let _originalAlert = window.alert;
    let _originalConfirm = window.confirm;
    
    function overrideNativeDialogs() {
        window.alert = function(message) {
            show(String(message), 'info', 4000);
        };
        
        window.confirm = function(message) {
            console.warn('confirm 被调用，请使用 Toast.confirm() 替代:', message);
            return true;
        };
    }
    
    function restoreNativeDialogs() {
        window.alert = _originalAlert;
        window.confirm = _originalConfirm;
    }
    
    // 导出 API
    Toast.show = show;
    Toast.success = (msg, duration) => show(msg, 'success', duration);
    Toast.error = (msg, duration) => show(msg, 'error', duration);
    Toast.warning = (msg, duration) => show(msg, 'warning', duration);
    Toast.info = (msg, duration) => show(msg, 'info', duration);
    Toast.confirm = confirm;
    Toast.confirmPromise = confirmPromise;
    Toast.createInlineConfirmButtons = createInlineConfirmButtons;
    Toast.overrideNativeDialogs = overrideNativeDialogs;
    Toast.restoreNativeDialogs = restoreNativeDialogs;
    
    // 初始化
    addAnimations();
    
    // 可选：覆盖原生弹窗（谨慎使用）
    // Toast.overrideNativeDialogs();
})();
