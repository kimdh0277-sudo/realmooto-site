// 앱 설치(PWA)용 최소 서비스워커. 캐시를 쓰지 않아 항상 최신 사이트를 보여준다.
self.addEventListener('install', function () { self.skipWaiting() });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()) });
self.addEventListener('fetch', function () { });
