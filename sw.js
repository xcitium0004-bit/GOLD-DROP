/* ════════════════════════════════════════════════════════════════
   골드드롭 - 서비스 워커 (오프라인 지원의 심장)
   ──────────────────────────────────────────────────────────────
   ★ 이 파일이 있어서 인터넷이 끊긴 환경에서도 게임이 돌아갑니다!
   ★ 게임 파일을 수정해서 다시 올릴 때는 아래 CACHE_NAME 문자열을
     조금씩 바꿔 주세요. (예: 'gold-drop-core' → 'gold-drop-core-b')
     안 바꾸면 방문자들이 예전 파일을 계속 보게 될 수 있습니다.
     자세한 내용은 README 문서의 "업데이트 배포" 항목 참고.
   ════════════════════════════════════════════════════════════════ */
var CACHE_NAME = 'gold-drop-core';

/* 미리 저장해둘 파일 목록 */
var PRECACHE = [
  './',
  './index.html',
  './privacy.html',
  './404.html',
  './css/style.css',
  './js/config.js',
  './js/audio.js',
  './js/board.js',
  './js/renderer.js',
  './js/main.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.png'
];

/* 설치: 핵심 파일을 전부 캐시에 담기 */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () { return self.skipWaiting(); })
  );
});

/* 활성화: 예전 버전 캐시 청소 */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* 요청 처리: 캐시 우선, 없으면 네트워크 (그리고 성공하면 저장) */
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // 광고 등 외부요소는 그냥 통과

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(e.request, copy);
        });
        return res;
      });
    }).catch(function () {
      /* 완전 오프라인 + 캐시에도 없을 때: 최소한 게임 화면이라도 */
      if (e.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
