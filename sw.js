// sw.js - JF! by Gadai Service Worker
const CACHE_NAME = 'jf-gadai-v1';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/icons/pagehead-logo.png',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] 预缓存核心文件');
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// 请求拦截：优先网络，失败时用缓存
self.addEventListener('fetch', (event) => {
    // 跳过 Supabase API 请求
    if (event.request.url.includes('supabase.co')) return;
    
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 缓存成功的 GET 请求
                if (event.request.method === 'GET' && response.status === 200) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cloned);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
