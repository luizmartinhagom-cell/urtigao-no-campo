/* Urtigão no Campo — service worker
   Guarda o app no celular para abrir SEM SINAL. Os dados (lançamentos)
   ficam no banco offline do Firebase — este arquivo cuida só das telas e
   bibliotecas. Ao publicar uma versão nova do index.html ela é baixada
   automaticamente quando houver internet. */
const VERSAO = 'urtigao-v1';
const ESSENCIAIS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const BIBLIOTECAS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/layers.png',
  'https://unpkg.com/leaflet@1.9.4/dist/images/layers-2x.png',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(VERSAO).then(async cache=>{
    await Promise.all(ESSENCIAIS.concat(BIBLIOTECAS).map(u=>cache.add(u).catch(err=>console.warn('não guardou', u, err))));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSAO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// Telas: tenta a internet (versão mais nova) e, se demorar mais de 4 s ou falhar, abre a guardada.
function paginaRedeOuCache(req){
  return new Promise(resolve=>{
    let pronto = false;
    const doCache = ()=> caches.match('./index.html').then(r=> r || caches.match(req));
    const t = setTimeout(()=>{ doCache().then(r=>{ if(r && !pronto){ pronto = true; resolve(r); } }); }, 4000);
    fetch(req).then(res=>{
      if(res && res.ok){ const cp = res.clone(); caches.open(VERSAO).then(c=>c.put('./index.html', cp)); }
      if(!pronto){ pronto = true; clearTimeout(t); resolve(res); }
    }).catch(()=>{
      if(pronto) return; clearTimeout(t);
      doCache().then(r=>{ pronto = true; resolve(r || new Response('<h3 style="font-family:sans-serif;padding:20px">Sem conexão — abra o app uma vez com internet para ele ficar disponível sem sinal.</h3>', { status:503, headers:{'Content-Type':'text/html; charset=utf-8'} })); });
    });
  });
}
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = req.url;
  // banco de dados, mapas, previsão do tempo e buscas: sempre direto na internet
  if(/firestore\.googleapis\.com|firebaseinstallations|open-meteo|arcgisonline|openstreetmap|google\.com\/search/.test(url)) return;
  if(req.mode === 'navigate'){ e.respondWith(paginaRedeOuCache(req)); return; }
  const mesmoSite = url.startsWith(self.location.origin);
  if(mesmoSite || BIBLIOTECAS.includes(url)){
    e.respondWith(caches.match(req).then(r=> r || fetch(req).then(res=>{
      if(res && res.ok){ const cp = res.clone(); caches.open(VERSAO).then(c=>c.put(req, cp)); }
      return res;
    })));
  }
});
