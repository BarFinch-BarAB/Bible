/* Bar Finch Bible – offline support.
   The app shell and fonts are kept on the device.
   The drinks data is always fetched fresh when there's signal,
   and the last copy is used when there isn't. */
var VERSION = "bf-bible-v2";
var SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "BarBible_Export.json"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // Drinks data: network first, fall back to the saved copy.
  if (url.pathname.endsWith("BarBible_Export.json")) {
    e.respondWith(fetch(req, { cache: "no-store" }).then(function (res) {
      var copy = res.clone();
      if (res.ok) caches.open(VERSION).then(function (c) { c.put("BarBible_Export.json", copy); });
      return res;
    }).catch(function () { return caches.match("BarBible_Export.json"); }));
    return;
  }

  // Fonts: keep forever once downloaded.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); return res;
      });
    }));
    return;
  }

  // App itself: use the saved copy instantly, refresh it in the background.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit || caches.match("index.html"); });
      return hit || net;
    }));
  }
});
