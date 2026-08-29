"use strict";

const CACHE_NAME = "oscp-arsenal-v4";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./knowledge.js",
  "./search.js",
  "./knowledge-ui.js",
  "./profile-crypto.js",
  "./profile-store.js",
  "./app.js",
  "./app.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("oscp-arsenal-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && !response.headers.get("Cache-Control")?.includes("no-store")) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
        return cached || caches.match("./index.html");
      }),
  );
});
