/* =====================================================================
   Slate — service worker
   =====================================================================
   Iki is yapiyor:

   1) BILDIRIM. Termin hatirlatmalarinin tarayici bacagi. Bugun bildirim
      uygulama ACILDIGINDA gonderiliyor (sayfa tarafindan); service worker
      bildirime TIKLANDIGINDA uygulamayi one getiriyor. Uygulama kapaliyken
      gonderim (push) sonraki adim: o zaman asagidaki 'push' dinleyicisi
      devreye girecek, simdiden duruyor ki surum degistirmek gerekmesin.

   2) CEVRIMDISI ACILIS. Uygulama tek dosya oldugu icin onbellek de basit:
      ilk ziyarette kabuk saklaniyor, ag yoksa oradan aciliyor. Veri
      zaten tarayicida (localStorage) duruyor, yani agsiz da calisir.

   ONBELLEK STRATEJISI — "once ag, sonra onbellek":
   Uygulama tek bir HTML dosyasi ve sik guncelleniyor. "Once onbellek"
   olsaydi kullanici gunlerce eski surumu gorurdu. Bu yuzden ag denenip
   basarisiz olursa onbellege dusuluyor, ve her basarili yanit onbellege
   yeniden yaziliyor.
   ===================================================================== */

const SURUM = 'slate-v1';
const KABUK = [
  './app.html',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (olay)=>{
  olay.waitUntil(
    caches.open(SURUM)
      // Tek bir dosya bulunamazsa kurulumun tamami dusmesin: addAll
      // hepsi-ya-hicbiri, add ise tek tek.
      .then(k => Promise.allSettled(KABUK.map(y => k.add(y))))
      .then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', (olay)=>{
  olay.waitUntil(
    caches.keys()
      .then(adlar => Promise.all(adlar.filter(a => a !== SURUM).map(a => caches.delete(a))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', (olay)=>{
  const istek = olay.request;
  // Yalnizca kendi kaynagimizdaki GET istekleri. Supabase, Google ve
  // Gemini istekleri onbellege HIC girmemeli: biri veri, oteki kimlik.
  if(istek.method !== 'GET') return;
  // Sayfa "no-store" ya da "reload" dediyse ARAYA GIRMIYORUZ. Bu bir nezaket
  // degil, dogruluk meselesi: gelen kutusu (gelen/kayitlar.json) tam olarak
  // taze veri istedigi icin no-store kullaniyor. Service worker araya girince
  // istek onun kapsamindan cikiyor ve sayfa tarafindan kesilemez hale geliyor
  // — testlerde bu fark edildi, uygulamada da bayat veri riski demekti.
  if(istek.cache === 'no-store' || istek.cache === 'reload') return;
  let adres;
  try{ adres = new URL(istek.url); }catch(e){ return; }
  if(adres.origin !== self.location.origin) return;

  olay.respondWith(
    fetch(istek)
      .then(yanit=>{
        if(yanit && yanit.ok){
          const kopya = yanit.clone();
          caches.open(SURUM).then(k => k.put(istek, kopya)).catch(()=>{});
        }
        return yanit;
      })
      .catch(()=> caches.match(istek).then(v => v || caches.match('./app.html')))
  );
});

/* ---------- Bildirime tiklayinca uygulamayi one getir ---------- */
self.addEventListener('notificationclick', (olay)=>{
  olay.notification.close();
  const hedef = new URL('./app.html', self.location.href).href;
  olay.waitUntil(
    self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(pencereler=>{
      for(const p of pencereler){
        if(p.url.startsWith(self.location.origin) && 'focus' in p){
          // Zaten acik bir sekme varsa yenisini acmiyoruz; kullanicinin
          // yazdigi yarim kayit kaybolmasin.
          p.postMessage({ slate:'hatirlatma-acildi' });
          return p.focus();
        }
      }
      return self.clients.openWindow(hedef);
    })
  );
});

/* ---------- Uygulama kapaliyken gonderim (sonraki adim) ----------
   Zamanlanmis push henuz kurulmadi. Dinleyici simdiden duruyor: kurulunca
   service worker'i degistirmek gerekmeyecek. Icerik gelmezse sessiz
   kalmiyoruz — bos bir bildirim gostermek kullaniciyi bosa dusurur, o
   yuzden govde yoksa hic gostermiyoruz. */
self.addEventListener('push', (olay)=>{
  let veri = null;
  try{ veri = olay.data ? olay.data.json() : null; }catch(e){ veri = null; }
  if(!veri || !veri.govde) return;
  olay.waitUntil(
    self.registration.showNotification(veri.baslik || 'Slate', {
      body: veri.govde,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: veri.etiket || 'slate-termin',
      renotify: false
    })
  );
});
