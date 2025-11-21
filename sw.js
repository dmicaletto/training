const CACHE_NAME = 'gym-app-laura-v1';
// Lista delle risorse principali da salvare subito
const URLS_TO_CACHE = [
  './training-laura.html', // Questo si riferisce a index.html
  './training-davide.html', // Questo si riferisce a index.html
  'manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// 1. Installazione del Service Worker e Caching
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aperta');
        // Aggiunge tutte le risorse principali alla cache
        // "addAll" fallisce se anche solo una risorsa non è raggiungibile
        return cache.addAll(URLS_TO_CACHE).catch(err => {
            console.warn('Impossibile caricare tutte le risorse nella cache:', err);
            // Non bloccare l'installazione se alcuni CDN falliscono, 
            // verranno comunque cachati al primo accesso (vedi 'fetch')
        });
      })
  );
});

// 2. Intercettazione delle richieste (Strategia: Stale-While-Revalidate)
// Prova prima la rete per avere dati freschi, 
// ma se sei offline, usa la cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      // 1. Prova a prendere la risorsa dalla rete
      return fetch(event.request).then(networkResponse => {
        // Se la richiesta ha successo, la salviamo nella cache per il futuro
        cache.put(event.request, networkResponse.clone());
        // E la restituiamo al browser
        return networkResponse;
      }).catch(() => {
        // 2. Se la rete fallisce (offline), prova a prenderla dalla cache
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se non è nemmeno nella cache, restituisci un errore (o una pagina offline)
          console.warn('Richiesta non trovata in cache:', event.request.url);
          return undefined;
        });
      });
    })
  );
});

// 3. Attivazione e pulizia vecchie cache
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Rimuove le vecchie cache
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
