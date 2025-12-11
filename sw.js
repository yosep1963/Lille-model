/**
 * Service Worker for Lille Score Calculator
 * 오프라인 지원 및 캐시 관리
 */

const CACHE_NAME = 'lille-score-v3';
const urlsToCache = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// 설치 이벤트 - 캐시 초기화
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('캐시 열림');
                return cache.addAll(urlsToCache);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// 활성화 이벤트 - 이전 캐시 정리
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('이전 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch 이벤트 - 캐시 우선 전략
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // 캐시에서 찾으면 반환
                if (response) {
                    return response;
                }

                // 캐시에 없으면 네트워크 요청
                return fetch(event.request).then(function(response) {
                    // 유효한 응답인지 확인
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // 응답을 복제하여 캐시에 저장
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
            .catch(function() {
                // 오프라인이고 캐시에도 없는 경우
                return new Response('오프라인 상태입니다. 인터넷 연결을 확인해주세요.', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain; charset=utf-8'
                    })
                });
            })
    );
});
