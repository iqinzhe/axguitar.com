// toast.js - v1.0
// Toast 通知系统 - 替换所有 alert/confirm 弹窗
// 使用方法：
//   Toast.success('操作成功')
//   Toast.error('操作失败')
//   Toast.warning('警告信息')
//   Toast.info('提示信息')
//   const confirmed = await Toast.confirmPromise('确认删除？')
//   Toast.createInlineConfirmButtons(onConfirm, onCancel) - 用于表格内联确认

window.Toast = window.Toast || {};

(function() {
    'use strict';
    
    let toastContainer = null;
    let confirmModal = null;
    let toastCounter = 0;
    
    // ==================== 初始化容器 ====================
    function initContainer() {
        if (toastContainer) return;
        
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            left: auto;
            z-index: 10050;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            max-width: 380px;
        `;
        document.body.appendChild(toastContainer);
    }
    
    // ==================== 添加动画样式 ====================
    function addAnimations() {
        if (document.getElementById('toast-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes toastSlideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes toastSlideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            @keyframes confirmFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes confirmScaleIn {
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
    
    // ==================== 显示 Toast 通知 ====================
    function show(message, type = 'info', duration = 3000) {
        initContainer();
        
        const id = 'toast_' + (++toastCounter) + '_' + Date.now();
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
        
        const toast = document.createElement('div');
        toast.id = id;
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
            animation: toastSlideInRight 0.3s ease;
            cursor: pointer;
            backdrop-filter: blur(0px);
            line-height: 1.4;
        `;
        
        // 处理多行消息
        const messageLines = String(message).split('\n');
        const messageHtml = messageLines.map(line => {
            if (line.trim() === '') return '<br>';
            return Utils.escapeHtml ? Utils.escapeHtml(line) : line.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }).join('<br>');
        
        toast.innerHTML = `
            <span style="font-size: 18px; flex-shrink: 0;">${icons[type] || icons.info}</span>
            <span style="flex:1; word-break: break-word;">${messageHtml}</span>
            <span style="cursor:pointer; opacity:0.7; flex-shrink:0; font-size:16px;">✖</span>
        `;
        
        // 点击关闭按钮
        const closeBtn = toast.querySelector('span:last-child');
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeToast(toast);
        };
        
        // 点击 Toast 本体也关闭
        toast.onclick = (e) => {
            if (e.target !== closeBtn) {
                closeToast(toast);
            }
        };
        
        toastContainer.appendChild(toast);
        
        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    closeToast(toast);
                }
            }, duration);
        }
        
        return toast;
    }
    
    function closeToast(toast) {
        if (!toast || !toast.parentElement) return;
        toast.style.animation = 'toastSlideOutRight 0.2s ease';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 200);
    }
    
    // ==================== 确认对话框（替换 confirm） ====================
    function confirmDialog(message, title, onConfirm, onCancel) {
        // 移除已有的确认框
        if (confirmModal && confirmModal.parentElement) {
            confirmModal.remove();
            confirmModal = null;
        }
        
        const lang = window.Utils ? Utils.lang : 'id';
        const defaultTitle = lang === 'id' ? 'Konfirmasi' : '确认操作';
        const confirmText = lang === 'id' ? 'Ya, Lanjutkan' : '确认';
        const cancelText = lang === 'id' ? 'Batal' : '取消';
        const titleText = title || defaultTitle;
        
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
            animation: confirmFadeIn 0.2s ease;
        `;
        
        // 转义消息内容
        const escapedMessage = (window.Utils && Utils.escapeHtml) 
            ? Utils.escapeHtml(message).replace(/\n/g, '<br>')
            : String(message).replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
              }).replace(/\n/g, '<br>');
        
        confirmModal.innerHTML = `
            <div class="confirm-modal-content" style="
                background: white;
                border-radius: 12px;
                max-width: 400px;
                width: 90%;
                padding: 20px;
                box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                animation: confirmScaleIn 0.2s ease;
            ">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">${Utils.escapeHtml ? Utils.escapeHtml(titleText) : titleText}</h3>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5; white-space: pre-line;">${escapedMessage}</p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="confirm-cancel-btn" style="
                        padding: 8px 20px;
                        background: #e2e8f0;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#cbd5e1'" onmouseout="this.style.background='#e2e8f0'">${cancelText}</button>
                    <button class="confirm-ok-btn" style="
                        padding: 8px 20px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">${confirmText}</button>
                </div>
            </div>
        `;
        
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
            else if (typeof onCancel === 'function') onCancel();
        };
        
        okBtn.onclick = () => {
            cleanup();
            if (onConfirm) onConfirm();
            else if (typeof onConfirm === 'function') onConfirm();
        };
        
        // 点击背景关闭
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                cleanup();
                if (onCancel) onCancel();
                else if (typeof onCancel === 'function') onCancel();
            }
        };
        
        // ESC 键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                if (onCancel) onCancel();
                else if (typeof onCancel === 'function') onCancel();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        document.body.appendChild(confirmModal);
        
        return { modal: confirmModal, cleanup };
    }
    
    // ==================== Promise 风格的确认框 ====================
    function confirmPromise(message, title) {
        return new Promise((resolve) => {
            confirmDialog(message, title, () => resolve(true), () => resolve(false));
        });
    }
    
    // ==================== 内联确认按钮组件（用于表格操作行） ====================
    function createInlineConfirmButtons(onConfirm, onCancel) {
        const lang = window.Utils ? Utils.lang : 'id';
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
                transition: background 0.2s;
            " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">✓</button>
            <button class="confirm-no" style="
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 2px 8px;
                font-size: 11px;
                cursor: pointer;
                transition: background 0.2s;
            " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">✗</button>
        `;
        
        container.querySelector('.confirm-yes').onclick = (e) => {
            e.stopPropagation();
            container.remove();
            if (onConfirm) onConfirm();
        };
        
        container.querySelector('.confirm-no').onclick = (e) => {
            e.stopPropagation();
            container.remove();
            if (onCancel) onCancel();
        };
        
        return container;
    }
    
    // ==================== 快捷方法 ====================
    const success = (msg, duration) => show(msg, 'success', duration);
    const error = (msg, duration) => show(msg, 'error', duration);
    const warning = (msg, duration) => show(msg, 'warning', duration);
    const info = (msg, duration) => show(msg, 'info', duration);
    
    // ==================== 移除所有 Toast ====================
    function clearAll() {
        if (toastContainer) {
            toastContainer.innerHTML = '';
        }
        if (confirmModal && confirmModal.parentElement) {
            confirmModal.remove();
            confirmModal = null;
        }
    }
    
    // ==================== 导出 API ====================
    Toast.show = show;
    Toast.success = success;
    Toast.error = error;
    Toast.warning = warning;
    Toast.info = info;
    Toast.confirm = confirmDialog;
    Toast.confirmPromise = confirmPromise;
    Toast.createInlineConfirmButtons = createInlineConfirmButtons;
    Toast.clearAll = clearAll;
    
    // 初始化
    addAnimations();
    initContainer();
    
    console.log('✅ Toast 通知系统已初始化');
})();
