/* 수댕로그 — 오프라인 지원
   헬스장 지하처럼 신호가 없는 곳에서도 앱이 열리도록,
   앱 화면과 한 번 본 운동 GIF를 이 기기에 캐시해 둔다.
   기록 데이터는 여기서 다루지 않는다(브라우저 저장 공간에 따로 들어감). */
const VERSION = 'sudaenglog-v1';
const SHELL = VERSION + '-shell';   // 앱 화면(HTML·폰트)
const MEDIA = VERSION + '-media';   // 운동 GIF·이미지

// 설치되자마자 새 버전을 쓰도록
self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // 예전 버전 캐시 정리
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isMedia = url =>
  /fitnessprogramer\.com\/wp-content\/uploads\//.test(url) ||
  /fonts\.gstatic\.com/.test(url);

const isShell = (url, req) =>
  req.mode === 'navigate' ||
  url.startsWith(self.registration.scope) ||
  /fonts\.googleapis\.com/.test(url);

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // 운동 이미지: 캐시 우선. 한 번 본 GIF는 오프라인에서도 그대로 나온다.
  if (isMedia(url)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          const cache = await caches.open(MEDIA);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // 앱 화면: 네트워크 우선(있으면 최신 버전을 받고), 실패하면 캐시로 연다.
  if (isShell(url, req)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(SHELL);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // 새로고침인데 캐시에도 없으면 시작 페이지라도 보여준다
        if (req.mode === 'navigate') {
          const home = await caches.match(self.registration.scope);
          if (home) return home;
        }
        throw err;
      }
    })());
  }
});
