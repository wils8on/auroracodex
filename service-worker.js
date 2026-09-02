const CACHE_NAME = "aurora-codex-shell-v13";
const SHELL_FILES = [
    "./",
    "./index.html",
    "./dashboard.html",
    "./biblioteca.html",
    "./tour.html",
    "./trilhas.html",
    "./css/style.css",
    "./css/dashboard.css",
    "./css/ux.css",
    "./css/tour.css",
    "./css/trilhas.css",
    "./js/mobile-nav.js",
    "./js/pwa.js",
    "./js/trilhas.js",
    "./js/vendor/mammoth.browser.min.js",
    "./manifest.webmanifest",
    "./assets/icons/aurora-codex-192.png",
    "./assets/icons/aurora-codex-512.png"
];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then(response => response || caches.match("./index.html")))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
                }
                return response;
            });
            return cached || network;
        })
    );
});
