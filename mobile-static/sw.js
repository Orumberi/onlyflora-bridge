const CACHE='onlyflora-mobile-v46';
const APP=['/','/index.html','/styles.css?v=20','/catalog-index.json?v=7','/manifest.webmanifest?v=2','/assets/logo.svg','/assets/icon-192-v2.png','/assets/icon-512-v2.png','/assets/marketplace-hero-autumn.webp','/assets/category-deciduous.webp','/assets/category-conifers.webp','/assets/category-shrubs.webp','/assets/category-euonymus.webp','/assets/category-perennials.webp','/assets/category-fruits.webp','/assets/category-hedges.webp','/assets/category-roses.webp','/assets/category-grasses.webp','/assets/sub-maple.webp','/assets/sub-ash.webp','/assets/sub-apple.webp','/assets/sub-other-deciduous.webp','/assets/sub-poplar.webp','/assets/sub-linden.webp','/assets/sub-autumn-tree.webp','/assets/sub-willow.webp','/assets/sub-oak.webp','/assets/sub-elm.webp','/assets/sub-birch.webp','/assets/sub-cherry.webp','/assets/sub-rowan.webp','/assets/product-placeholder.webp','/assets/categories/barbarisy.webp','/assets/categories/beresklet.webp','/assets/categories/boyaryshnik.webp','/assets/categories/veygela.webp','/assets/categories/gortenziya.webp','/assets/categories/dyoren.webp','/assets/categories/zhimolost.webp','/assets/categories/kalina.webp','/assets/categories/kizilnik.webp','/assets/categories/lapchatka.webp','/assets/categories/puzyreplodnik.webp','/assets/categories/siren.webp','/assets/categories/spireya.webp','/assets/categories/chubushnik.webp','/assets/categories/drugie-kustarniki.webp','/assets/categories/kustarniki.webp','/assets/categories/sosna.webp','/assets/categories/mozhzhevelnik.webp','/assets/categories/eli.webp','/assets/categories/listvennitsa.webp','/assets/categories/khvoynye.webp'];
APP.push('/app.js?v=36','/product-model.js?v=1','/variants.css?v=1','/assets/montserrat-regular.ttf','/assets/montserrat-bold.ttf','/offers-snapshot.json?v=1','/assets/sub-maple-v2.webp','/assets/category-topiary-v3.webp','/assets/category-bird-cherry-v2.webp');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).origin!==self.location.origin){event.respondWith(fetch(event.request));return}
  if(['/privacy/','/account-deletion/','/marketplace-rules/'].includes(new URL(event.request.url).pathname)){event.respondWith(fetch(event.request));return}
  if(new URL(event.request.url).pathname.startsWith('/api/')){event.respondWith(fetch(event.request));return}
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put('/index.html',copy));
      return response;
    }).catch(()=>caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match('/index.html'))));
});
