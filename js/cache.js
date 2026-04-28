// cache.js - v1.0
// 统一缓存模块：合并 AnomalyCache 与 DashboardCache 的功能
// 特性：TTL过期、LRU淘汰、自动清理、支持强制刷新

window.JFCache = (function() {
    'use strict';
    
    // ==================== 配置常量 ====================
    const DEFAULT_TTL = 5 * 60 * 1000;   // 默认5分钟过期
    const MAX_SIZE = 100;                // 最大缓存条目数
    const CLEANUP_INTERVAL = 60 * 1000;  // 清理间隔1分钟
    
    // ==================== 私有变量 ====================
    let _data = new Map();               // key -> { value, time, ttl }
    let _accessOrder = [];               // LRU 访问顺序记录
    let _cleanupInterval = null;
    let _enabled = true;
    
    // ==================== 私有方法 ====================
    
    // 初始化定时清理器
    function _initCleanup() {
        if (_cleanupInterval) return;
        _cleanupInterval = setInterval(() => {
            _cleanupExpired();
        }, CLEANUP_INTERVAL);
        
        if (window._debugCache !== false) {
            console.log('[JFCache] 缓存清理定时器已启动，间隔 ' + (CLEANUP_INTERVAL / 1000) + ' 秒');
        }
    }
    
    // 清理过期缓存
    function _cleanupExpired() {
        if (!_enabled) return;
        
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, value] of _data) {
            const ttl = value.ttl !== undefined ? value.ttl : DEFAULT_TTL;
            if (now - value.time > ttl) {
                _data.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            // 清理访问顺序记录中已删除的条目
            _accessOrder = _accessOrder.filter(key => _data.has(key));
            
            if (window._debugCache !== false) {
                console.log(`[JFCache] 清理过期缓存: ${cleanedCount} 条，剩余: ${_data.size} 条`);
            }
        }
    }
    
    // 记录访问顺序（LRU）
    function _recordAccess(key) {
        const index = _accessOrder.indexOf(key);
        if (index !== -1) {
            _accessOrder.splice(index, 1);
        }
        _accessOrder.push(key);
    }
    
    // 当超过最大容量时，删除最久未使用的条目
    function _enforceMaxSize() {
        if (!_enabled) return;
        
        while (_data.size > MAX_SIZE && _accessOrder.length > 0) {
            const lruKey = _accessOrder.shift();
            if (lruKey && _data.has(lruKey)) {
                _data.delete(lruKey);
                if (window._debugCache !== false) {
                    console.log(`[JFCache] LRU淘汰: ${lruKey}`);
                }
            }
        }
    }
    
    // ==================== 公共 API ====================
    
    const JFCache = {
        /**
         * 获取缓存值，若不存在或过期则调用 fetcher 重新获取
         * @param {string} key - 缓存键
         * @param {Function} fetcher - 获取数据的异步函数
         * @param {Object} options - 可选配置
         * @param {boolean} options.forceRefresh - 是否强制刷新（忽略缓存）
         * @param {number} options.ttl - 自定义过期时间（毫秒）
         * @returns {Promise<any>} 缓存或新获取的值
         */
        async get(key, fetcher, options = {}) {
            const { forceRefresh = false, ttl = DEFAULT_TTL } = options;
            
            if (!_enabled) {
                // 缓存禁用时直接调用 fetcher
                return await fetcher();
            }
            
            _initCleanup();
            
            const cached = _data.get(key);
            const now = Date.now();
            const cacheTtl = cached ? (cached.ttl !== undefined ? cached.ttl : DEFAULT_TTL) : ttl;
            
            if (!forceRefresh && cached && (now - cached.time) < cacheTtl) {
                if (window._debugCache !== false) {
                    console.log('[JFCache] Hit:', key);
                }
                _recordAccess(key);
                return cached.value;
            }
            
            if (cached && window._debugCache !== false) {
                console.log('[JFCache] Miss (expired):', key);
            } else if (window._debugCache !== false) {
                console.log('[JFCache] Miss:', key);
            }
            
            if (cached) {
                _data.delete(key);
            }
            
            const value = await fetcher();
            
            _data.set(key, { 
                value, 
                time: Date.now(),
                ttl: ttl
            });
            _recordAccess(key);
            _enforceMaxSize();
            
            return value;
        },
        
        /**
         * 直接设置缓存值
         * @param {string} key - 缓存键
         * @param {any} value - 缓存值
         * @param {number} ttl - 过期时间（毫秒），默认 DEFAULT_TTL
         */
        set(key, value, ttl = DEFAULT_TTL) {
            if (!_enabled) return;
            
            _initCleanup();
            _data.set(key, { 
                value, 
                time: Date.now(),
                ttl: ttl
            });
            _recordAccess(key);
            _enforceMaxSize();
            
            if (window._debugCache !== false) {
                console.log('[JFCache] Set:', key);
            }
        },
        
        /**
         * 检查缓存是否存在且未过期
         * @param {string} key - 缓存键
         * @returns {boolean}
         */
        has(key) {
            if (!_enabled) return false;
            
            const cached = _data.get(key);
            if (!cached) return false;
            
            const now = Date.now();
            const ttl = cached.ttl !== undefined ? cached.ttl : DEFAULT_TTL;
            return (now - cached.time) < ttl;
        },
        
        /**
         * 获取缓存值（同步，不检查过期）
         * @param {string} key - 缓存键
         * @returns {any} 缓存值或 undefined
         */
        getSync(key) {
            if (!_enabled) return undefined;
            
            const cached = _data.get(key);
            return cached ? cached.value : undefined;
        },
        
        /**
         * 使缓存失效
         * @param {string|null} key - 缓存键，为 null 时清空所有缓存
         */
        invalidate(key) {
            if (key) {
                _data.delete(key);
                const index = _accessOrder.indexOf(key);
                if (index !== -1) _accessOrder.splice(index, 1);
                if (window._debugCache !== false) {
                    console.log('[JFCache] Invalidated:', key);
                }
            } else {
                this.clear();
            }
        },
        
        /**
         * 清空所有缓存
         */
        clear() {
            _data.clear();
            _accessOrder = [];
            if (window._debugCache !== false) {
                console.log('[JFCache] Cleared all');
            }
        },
        
        /**
         * 获取缓存统计信息
         * @returns {Object} { total, active, expired, maxSize }
         */
        getStats() {
            const now = Date.now();
            let activeCount = 0;
            for (const [key, value] of _data) {
                const ttl = value.ttl !== undefined ? value.ttl : DEFAULT_TTL;
                if (now - value.time < ttl) {
                    activeCount++;
                }
            }
            return {
                total: _data.size,
                active: activeCount,
                expired: _data.size - activeCount,
                maxSize: MAX_SIZE,
                ttl: DEFAULT_TTL
            };
        },
        
        /**
         * 启用/禁用缓存
         * @param {boolean} enabled
         */
        setEnabled(enabled) {
            _enabled = enabled;
            if (!enabled) {
                this.clear();
            }
            if (window._debugCache !== false) {
                console.log('[JFCache] Enabled:', enabled);
            }
        },
        
        /**
         * 获取当前是否启用
         * @returns {boolean}
         */
        isEnabled() {
            return _enabled;
        },
        
        /**
         * 销毁缓存（停止定时器）
         */
        destroy() {
            if (_cleanupInterval) {
                clearInterval(_cleanupInterval);
                _cleanupInterval = null;
            }
            this.clear();
            if (window._debugCache !== false) {
                console.log('[JFCache] Destroyed');
            }
        }
    };
    
    // 导出到全局
    window.JFCache = JFCache;
    
    // 向后兼容：为 DashboardCache 和 AnomalyCache 提供别名
    window.DashboardCache = {
        getKey: function(...parts) { return parts.join(':'); },
        get: async function(key, fetcher, forceRefresh = false) {
            return JFCache.get(key, fetcher, { forceRefresh });
        },
        invalidate: function(key) { JFCache.invalidate(key); },
        clear: function() { JFCache.clear(); }
    };
    
    window.AnomalyCache = {
        async get(key, fetcher) {
            return JFCache.get(key, fetcher, { ttl: 3 * 60 * 1000 });
        },
        set: function(key, value, customTtl = null) {
            JFCache.set(key, value, customTtl || 3 * 60 * 1000);
        },
        invalidate: function(key) { JFCache.invalidate(key); },
        clear: function() { JFCache.clear(); },
        getStats: function() { return JFCache.getStats(); }
    };
    
    console.log('✅ JFCache 统一缓存模块已初始化');
    
    return JFCache;
})();
