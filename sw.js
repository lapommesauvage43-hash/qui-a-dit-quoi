// Service worker minimal : met en cache la coquille de l'application
// (HTML/CSS/JS statiques) pour un chargement instantané et une tolérance
// aux coupures réseau brèves. Les images et les données restent toujours
// interrogées en direct auprès de Supabase (jamais périmées).

const CACHE_NAME = "qadq-shell-v2";
const SHELL_FILES = [
  "/index.html",
  "/admin.html",
  "/css/style.css",
  "/js/public.js",
  "/js/admin.js",
  "/js/zoom.js",
  "/js/supabase-config.js",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels vers Supabase (données/images).
  if (url.hostname.endsWith("supabase.co")) return;

  if (event.request.method !== "GET") return;

  // Réseau en priorité, pour que chaque mise à jour du site soit visible
  // immédiatement. Le cache ne sert que si le réseau est indisponible.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
