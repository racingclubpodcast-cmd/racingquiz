const CACHE = 'rc-quiz-v62';
const PRECACHE = [
  './',
  './index.html',
  './terrain-foot-web.jpg',
  './logo_700x700.png',
  './background_emission_rouge_2.png',
  './background_black.png',
  './Calleo-Trial-ExtraBoldItalic.otf',
  './Calleo-Trial-Hairline.otf',
  './YT.png',
  './Insta.png',
  './X.png',
  './manifest.json',
  // Favicon sorti du <head> (il y vivait en base64, 106 Ko sur le chemin
  // critique) + vignette de partage des liens.
  './favicon.ico',
  './favicon-32.png',
  './apple-touch-icon.png',
  './og-card.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Un fichier à la fois, et surtout PAS `addAll` : celui-ci est
      // tout-ou-rien — un seul 404 (un asset de cette liste oublié dans le
      // dépôt GitHub) faisait échouer l'installation entière, donc aucun
      // cache hors-ligne du tout, alors que les 18 autres fichiers étaient
      // là. Un asset manquant est maintenant simplement ignoré.
      Promise.all(PRECACHE.map(u => c.add(u).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Coquille applicative = la page elle-même (navigation ou index.html).
  // Tout le jeu vit dans ce seul fichier : c'est lui qui doit toujours être à
  // jour, sinon un joueur reste bloqué sur une ancienne version et ne voit pas
  // les nouvelles fonctionnalités (boîte de réception, fils de discussion…).
  const isAppShell = e.request.mode === 'navigate'
    || url.pathname === '/'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('/index.html');

  if (isAppShell) {
    // Network-first : en ligne, on sert TOUJOURS la dernière version et on
    // rafraîchit le cache ; le cache ne sert que de repli hors-ligne.
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(c => c || caches.match('./index.html'))
      )
    );
    return;
  }

  // Autres ressources (images, polices, manifest) : stables → cache-first,
  // avec rafraîchissement en arrière-plan.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
