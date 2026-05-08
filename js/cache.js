// cache.js - v2.0 统一缓存模块

'use strict';

(function () {
    const JF = window.JF || {};
    window.JF = JF;

    /* ==================== 配置常量 ==================== */
    const DEFAULT_TTL = 5 * 60 * 1000;       // 默认 5 分钟
    const MAX_SIZE = 200;                  // 最大缓存条目数
    const CLEANUP_INTERVAL = 2 * 60 * 1000;     // 清理间隔 2 分钟

    /* ==================== 私有状态 ==================== */
    let _data        = new Map();            // key → { value, time, ttl }
    let _accessOrder = [];                   // LRU 顺序
    let _cleanupTimer = null;
    let _enabled     = true;

    /* ==================== 内部工具 ==================== */
    const now = () => Date.now();

    const debugLog = (...args) => {
        if (window.__debugCache !== false) {
            console.log('[JF.Cache]', ...args);
        }
    };

    // 清理过期条目
    function cleanupExpired() {
        if (!_enabled) return;
        const currentTime = now();
        let removed = 0;
        for (const [key, entry] of _data) {
            const ttl = entry.ttl ?? DEFAULT_TTL;
            if (currentTime - entry.time > ttl) {
                _data.delete(key);
                removed++;
            }
        }
        if (removed > 0) {
            _accessOrder = _accessOrder.filter(key => _data.has(key));
            debugLog(`Cleaned ${removed} expired entries, remaining: ${_data.size}`);
        }
    }

    // 启动定时清理
    function startCleanupTimer() {
        if (_cleanupTimer) return;
        _cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL);
        debugLog(`Cleanup timer started (interval: ${CLEANUP_INTERVAL / 1000}s)`);
    }

    // 记录 LRU 访问
    function touchKey(key) {
        const idx = _accessOrder.indexOf(key);
        if (idx !== -1) _accessOrder.splice(idx, 1);
        _accessOrder.push(key);
    }

    // 强制淘汰最久未使用的条目
    function evictIfNeeded() {
        while (_data.size > MAX_SIZE && _accessOrder.length > 0) {
            const lruKey = _accessOrder.shift();
            if (lruKey && _data.has(lruKey)) {
                _data.delete(lruKey);
                debugLog(`Evicted LRU: ${lruKey}`);
            }
        }
    }

    /* ==================== 公开 API ==================== */
    const Cache = {

        /**
         * 异步获取缓存，若未命中或过期则调用 fetcher
         * @param {string} key
         * @param {Function} fetcher - 异步函数
         * @param {Object} [options]
         * @param {boolean} [options.forceRefresh=false]
         * @param {number} [options.ttl] - 覆盖默认 TTL（毫秒）
         * @returns {Promise<any>}
         */
        async get(key, fetcher, options = {}) {
            const { forceRefresh = false, ttl = DEFAULT_TTL } = options;

            if (!_enabled) return await fetcher();

            startCleanupTimer();

            const cached = _data.get(key);
            const currentTime = now();

            if (!forceRefresh && cached && (currentTime - cached.time) < (cached.ttl ?? DEFAULT_TTL)) {
                debugLog(`Hit: ${key}`);
                touchKey(key);
                return cached.value;
            }

            debugLog(`Miss: ${key}${cached ? ' (expired)' : ''}`);
            if (cached) _data.delete(key);

            const value = await fetcher();

            _data.set(key, { value, time: now(), ttl });
            touchKey(key);
            evictIfNeeded();
            return value;
        },

        /**
         * 直接设置缓存
         * @param {string} key
         * @param {any} value
         * @param {number} [ttl] - 过期时间（毫秒）
         */
        set(key, value, ttl = DEFAULT_TTL) {
            if (!_enabled) return;
            startCleanupTimer();
            _data.set(key, { value, time: now(), ttl });
            touchKey(key);
            evictIfNeeded();
            debugLog(`Set: ${key}`);
        },

        /**
         * 检查缓存是否存在且未过期
         */
        has(key) {
            if (!_enabled) return false;
            const cached = _data.get(key);
            if (!cached) return false;
            return (now() - cached.time) < (cached.ttl ?? DEFAULT_TTL);
        },

        /**
         * 同步获取缓存值（不检查过期）
         */
        getSync(key) {
            if (!_enabled) return undefined;
            const cached = _data.get(key);
            return cached ? cached.value : undefined;
        },

        /**
         * 使缓存失效
         * @param {string|null} key - 为 null 时清空全部
         */
        invalidate(key) {
            if (key) {
                _data.delete(key);
                const idx = _accessOrder.indexOf(key);
                if (idx !== -1) _accessOrder.splice(idx, 1);
                debugLog(`Invalidated: ${key}`);
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
            debugLog('All cleared');
        },

        /**
         * 获取统计信息
         */
        getStats() {
            const currentTime = now();
            let active = 0;
            for (const [, entry] of _data) {
                if (currentTime - entry.time < (entry.ttl ?? DEFAULT_TTL)) active++;
            }
            return {
                total: _data.size,
                active,
                expired: _data.size - active,
                maxSize: MAX_SIZE,
                ttl: DEFAULT_TTL,
            };
        },

        /**
         * 启用或禁用缓存（禁用时会清空现有缓存）
         */
        setEnabled(enabled) {
            _enabled = enabled;
            if (!enabled) this.clear();
            debugLog(`Enabled: ${enabled}`);
        },

        /**
         * 当前是否启用
         */
        isEnabled() {
            return _enabled;
        },

        /**
         * 销毁：停止定时器并清空数据
         */
        destroy() {
            if (_cleanupTimer) {
                clearInterval(_cleanupTimer);
                _cleanupTimer = null;
            }
            this.clear();
            debugLog('Destroyed');
        },
    };

    /* ==================== 挂载命名空间 ==================== */
    JF.Cache = Cache;
    window.JFCache = Cache;          // 保留直接别名
    // 向后兼容（标记为 deprecated）
    window.DashboardCache = {
        getKey(...parts) { return parts.join(':'); },
        get: async function (key, fetcher, forceRefresh) {
            return Cache.get(key, fetcher, { forceRefresh });
        },
        invalidate(key) { Cache.invalidate(key); },
        clear() { Cache.clear(); },
    };
    window.AnomalyCache = {
        async get(key, fetcher) { return Cache.get(key, fetcher, { ttl: 3 * 60 * 1000 }); },
        set(key, value, ttl) { Cache.set(key, value, ttl || 3 * 60 * 1000); },
        invalidate(key) { Cache.invalidate(key); },
        clear() { Cache.clear(); },
        getStats() { return Cache.getStats(); },
    };

    console.log('✅ JF.Cache v2.0 初始化完成');
})();
