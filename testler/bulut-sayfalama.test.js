// BULUTTAN OKUMA — SAYFALAMA VE SESSİZ KESME
//
// ══════════════════════════════════════════════════════════════════
// NEDEN VAR — 22 Ekim 2026
// ══════════════════════════════════════════════════════════════════
// Kullanici 1 Ocak 2027'de Facebook 18:00 hikayesinin uygulamada
// gorunmedigini bildirdi. Ayni gun ayni saatteki Instagram hikayesi
// GORUNUYORDU -- yani eksik olan sey bir filtre ya da bir tarih hatasi
// degildi.
//
// Sebep: pullRemote `limit`siz yaziliydi ve "hepsini ver" demek
// saniliyordu. PostgREST'in kendi ust siniri 1000 satirda kesiyor ve
// HATA DONDURMUYOR. Tarayici konsolundan olculdu:
//
//   GELEN: 1000   TOPLAM: 1074   HATA: null
//
// 74 kayit uygulamada hic gorunmuyordu ve uygulama bunu fark
// etmiyordu. Ekrandaki "1000 / 100000" bir sinir degil, YUKLENEN
// kayit sayisiydi -- tam 1000'de durmasi kesmenin imzasiydi.
//
// ⛔ YAYINI ETKILEMIYORDU. Yayin zinciri (pg_cron -> story-yayin ->
// story_kuyruk_al) dogrudan calendar_events'ten okuyor. Bu bir
// GORUNURLUK arizasiydi, yayin arizasi degil.
//
// ══════════════════════════════════════════════════════════════════
// NE OLCULUYOR
// ══════════════════════════════════════════════════════════════════
//   1. pullRemote GERCEKTEN sayfaliyor mu: 1000'den fazla kayit varsa
//      hepsi geliyor mu. (Kaynakta `.range(` aramak yetmez -- yanlis
//      aritmetikle yazilmis bir dongu de o aramayi gecerdi.)
//   2. SIRALAMA VAR MI. `order` olmadan sayfalama ARIZAYI DAHA SINSI
//      HALE GETIRIR: satir sirasi belirsiz oldugu icin ayni kayit iki
//      kez gelirken baskasi hic gelmeyebilir. Bu dosyadaki en onemli
//      olcum bu -- cunku sonucu "biraz eksik" degil, "sessizce yanlis".
//   3. Dongu duruyor mu: eksik sayfada kesiliyor, tavani var.
//   4. Kesme artik SESSIZ DEGIL mi (console.error + kullaniciya uyari).
//   5. MAX_EVENTS gercek kullanimin cok uzerinde mi.
//
// ⚠ BU OLCUMLER DAVRANIS OLCUYOR, METIN DEGIL: pullRemote kaynaktan
// cikarilip sahte bir `sb` ile GERCEKTEN kosturuluyor. Tarayici
// gerekmiyor.
const fs = require('fs');
const vm = require('vm');
const yol = require('path');
const KOK = yol.join(__dirname, '..');
let g = 0, k = 0;
const bak = (ad, ko, ek)=>{ if(ko){ g++; console.log('  ok  '+ad); } else { k++; console.log('  YOK '+ad+(ek?' -> '+ek:'')); } };

const HTML = fs.readFileSync(yol.join(KOK, 'app.html'), 'utf8');

function parca(bas, son, ad){
  const i = HTML.indexOf(bas);
  if(i < 0) throw new Error(ad + ': baslangic bulunamadi -> ' + bas);
  const j = HTML.indexOf(son, i);
  if(j < 0) throw new Error(ad + ': bitis bulunamadi -> ' + son);
  return HTML.slice(i, j + son.length);
}

const OKUMA = parca('const SAYFA_BOYU', 'return sanitizeEvents(hepsi.map(fromRow));\n}', 'pullRemote');
const KESME = parca('let kesilenKayitSayisi = 0;',
                    'return list.slice(0, MAX_EVENTS).map(sanitizeEvent).filter(Boolean);\n}', 'sanitizeEvents');

// ── Sahte Supabase istemcisi ─────────────────────────────────────
// Zincirleme kurucu: .select().is().order().range() -> then
function sahteSb(satirlar, kayit){
  return {
    from(){ 
      const q = {
        _order: null,
        select(){ return q; },
        is(){ return q; },
        order(alan, secenek){ q._order = { alan, secenek }; return q; },
        async range(bas, bit){
          kayit.istekler.push({ bas, bit, order: q._order });
          if(kayit.hata) return { data: null, error: kayit.hata };
          return { data: satirlar.slice(bas, bit + 1), error: null };
        }
      };
      return q;
    }
  };
}

async function kosturOkuma(adet, ek = {}){
  const satirlar = Array.from({ length: adet }, (_, i)=> ({ id: 'k' + i }));
  const kayit = { istekler: [], hata: ek.hata || null };
  const kutu = {
    sb: sahteSb(satirlar, kayit),
    sanitizeEvents: (x)=> x,
    fromRow: (x)=> x,
    console
  };
  vm.createContext(kutu);
  new vm.Script(OKUMA + '\n;globalThis.__pr = pullRemote;').runInContext(kutu);
  let sonuc = null, hata = null;
  try{ sonuc = await kutu.__pr(); }catch(e){ hata = e; }
  return { sonuc, hata, kayit };
}

(async ()=>{

// ── 1. SAYFALAMA GERÇEKTEN ÇALIŞIYOR ─────────────────────────────
console.log('[sayfalama]');
{
  // Arizanin tam olcegi: 1074 kayit, sunucu 1000'de kesiyor.
  const { sonuc, kayit } = await kosturOkuma(1074);
  bak('1074 kaydin HEPSI geliyor', sonuc && sonuc.length === 1074, sonuc && sonuc.length);
  bak('iki istek atiliyor', kayit.istekler.length === 2, kayit.istekler.length);
  bak('kayitlar tekrarsiz', sonuc && new Set(sonuc.map(r=>r.id)).size === 1074,
      sonuc && new Set(sonuc.map(r=>r.id)).size);
  // Aritmetik: araliklar bitisik ve ortusmuyor.
  const i0 = kayit.istekler[0], i1 = kayit.istekler[1];
  bak('ilk aralik 0-999', i0 && i0.bas === 0 && i0.bit === 999, i0 && (i0.bas+'-'+i0.bit));
  bak('ikinci aralik 1000-1999', i1 && i1.bas === 1000 && i1.bit === 1999, i1 && (i1.bas+'-'+i1.bit));
}

console.log('[sinir durumlari]');
{
  const a = await kosturOkuma(0);
  bak('bos hesap: tek istek, bos liste', a.sonuc && a.sonuc.length === 0 && a.kayit.istekler.length === 1,
      a.sonuc && a.sonuc.length + '/' + a.kayit.istekler.length);

  const b = await kosturOkuma(999);
  bak('999 kayit: tek istekte bitiyor', b.kayit.istekler.length === 1, b.kayit.istekler.length);

  // ⚠ TAM 1000 SINIR DURUMU. Dolu sayfa geldiginde dongu DEVAM etmeli;
  // "1000 geldi, demek ki hepsi bu" varsayimi tam da duzeltilen hatanin
  // kendisiydi.
  const c = await kosturOkuma(1000);
  bak('tam 1000: ikinci istek de atiliyor', c.kayit.istekler.length === 2, c.kayit.istekler.length);
  bak('tam 1000: sonuc yine 1000', c.sonuc && c.sonuc.length === 1000, c.sonuc && c.sonuc.length);

  const d = await kosturOkuma(2500);
  bak('2500 kayit: uc istek, hepsi geliyor',
      d.kayit.istekler.length === 3 && d.sonuc.length === 2500,
      d.kayit.istekler.length + '/' + (d.sonuc && d.sonuc.length));
}

// ── 2. SIRALAMA ──────────────────────────────────────────────────
// Sayfalamayi siralamasiz eklemek arizayi daha sinsi hale getirir.
console.log('[siralama]');
{
  const { kayit } = await kosturOkuma(1074);
  const hepsi = kayit.istekler.every(i=> i.order && i.order.alan);
  bak('her istekte order var', hepsi, JSON.stringify(kayit.istekler.map(i=>i.order)));
  bak('siralama alani id (benzersiz ve degismiyor)',
      kayit.istekler[0].order && kayit.istekler[0].order.alan === 'id',
      kayit.istekler[0].order && kayit.istekler[0].order.alan);
  const ayni = new Set(kayit.istekler.map(i=> i.order && i.order.alan)).size === 1;
  bak('sayfalar arasi siralama degismiyor', ayni);
}

// ── 3. DÖNGÜ DURUYOR ─────────────────────────────────────────────
console.log('[dongu guvenligi]');
{
  bak('sayfa tavani var', /EN_COK_SAYFA\s*=\s*\d+/.test(OKUMA));
  bak('eksik sayfada kesiliyor', /parca\.length\s*<\s*SAYFA_BOYU/.test(OKUMA));
  const { hata } = await kosturOkuma(10, { hata: { message: 'sunucu kizdi' } });
  bak('sunucu hatasi yutulmuyor', !!hata, hata && hata.message);
}

// ── 4. KESME SESSİZ DEĞİL ────────────────────────────────────────
console.log('[kesme gorunur]');
{
  const gunluk = [], uyarilar = [];
  const kutu = {
    MAX_EVENTS: 3,
    sanitizeEvent: (x)=> x,
    uyari: (m)=> { uyarilar.push(m); },
    t: ()=> ((a, b)=> 'kesildi:' + a + '/' + b),
    console: { error: (...a)=> gunluk.push(a.join(' ')), log(){}, warn(){} }
  };
  vm.createContext(kutu);
  new vm.Script(KESME + '\n;globalThis.__se = sanitizeEvents;').runInContext(kutu);

  const az = kutu.__se([1, 2]);
  bak('sinirin altinda uyari YOK', gunluk.length === 0 && uyarilar.length === 0);
  bak('sinirin altinda liste bozulmuyor', az.length === 2);

  const cok = kutu.__se([1, 2, 3, 4, 5]);
  bak('kesilen liste yine kesiliyor', cok.length === 3, cok.length);
  bak('konsola hata yaziliyor', gunluk.length === 1, gunluk.join(' | '));
  bak('kullaniciya uyari gosteriliyor', uyarilar.length === 1, uyarilar.join(' | '));
  bak('uyari kac kaydin dustugunu soyluyor', /2/.test(uyarilar[0] || ''), uyarilar[0]);
}

// ── 5. KAYNAK ÜZERİNDEN KORUMALAR ────────────────────────────────
console.log('[kaynak]');
{
  const m = HTML.match(/const MAX_EVENTS\s*=\s*(\d+)/);
  bak('MAX_EVENTS tanimli', !!m);
  bak('MAX_EVENTS gercek kullanimin cok uzerinde', m && Number(m[1]) >= 10000, m && m[1]);
  bak('uyari metni iki dilde var',
      (HTML.match(/kayit_kesildi:/g) || []).length >= 2,
      (HTML.match(/kayit_kesildi:/g) || []).length);
  // Okuma yolunda `.limit(` tekrar belirirse sayfalama anlamsizlasir.
  bak('okuma yolunda limit() yok', !/\.limit\(/.test(OKUMA));
}

console.log('\ngecti: ' + g + '   kaldi: ' + k);
process.exit(k ? 1 : 0);
})();
