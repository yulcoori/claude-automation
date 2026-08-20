// 최소 서비스워커: PWA 설치 지원용. 네트워크 우선으로 동작합니다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
