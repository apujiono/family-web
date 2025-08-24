self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('family-web-cache').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/dashboard.html',
        '/css/style.css',
        '/js/auth.js',
        '/js/chat.js',
        '/js/photo.js',
        '/js/diary.js',
        '/js/calendar.js',
        '/js/poll.js',
        '/js/tree.js',
        '/js/call.js',
        '/js/utils.js',
        '/js/i18n.js'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});