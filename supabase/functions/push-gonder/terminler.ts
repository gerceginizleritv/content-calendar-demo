// Termin hesabı — SUNUCU KOPYASI.
//
// ⛔ BU KOD app.html'deki hatirlatilacaklar() + hatirlatmaSecili()
//    İKİZİDİR. İkisi aynı sonucu vermek ZORUNDA.
//
// NEDEN İKİ KOPYA VAR (16 Kasım 2026, kullanıcı kararı)
//   Kullanıcı sordu: *"Normal şartlar altında sunucu daha sağlıklı
//   değil mi? Sonuçta sunucu her zaman açık ve saati çalışıyor"* —
//   ve haklıydı. Sunucu veritabanındaki ASIL kaynağı okuyor; araya
//   "tarayıcı hesaplayıp yüklesin" adımı girmiyor. O adım bir kez
//   başarısız olsa bildirim sessizce gelmezdi.
//
//   Tek kopya seçeneği zaten YOKTU: tarayıcı internetsizken ve
//   hesapsız kullanıcıda da hatırlatmayı göstermek zorunda, yani
//   kendi hesabını her hâlükârda tutuyor.
//
// ⚠ AYRIŞMA NASIL YAKALANIYOR
//   testler/termin-ikiz.test.js aynı örnek verileri İKİSİNE de verip
//   çıktıları karşılaştırıyor. Bu dosyada ya da app.html'deki
//   ikizinde bir kural değişirse o test kırmızı yanar.
//   Bu depo "iki kopya sessizce ayrıştı" hatasını defalarca yaşadı:
//   otomatik yayın politikası tablosu, palet, ikon ailesi.
//
// ⚠ "BUGÜN" KULLANICININ GÜNÜ
//   Tarayıcıda bugunKey() yerel tarihi veriyor. Sunucuda yerel diye
//   bir şey yok: UTC'de koşuyor. O yüzden gün, kullanıcının IANA
//   saat diliminde hesaplanıyor (push_abonelikleri.saat_dilimi).
//   Dilim bilinmiyorsa UTC'ye düşülüyor — bu, dilimi bilinmeyen
//   kullanıcıda bildirimi en fazla bir gün kaydırır, yanlış içerik
//   göndermez.

export const PROJE_ADIMLARI = [
  'script', 'filmed', 'audio', 'edited', 'approved', 'package', 'published',
] as const;

export type Cins = 'gecikti' | 'bugun' | 'yarin';

export interface ProjeSatiri {
  id: string;
  name?: string | null;
  cancelled?: boolean | null;
  deleted_at?: string | null;
  steps?: Record<string, boolean> | null;
  deadlines?: Record<string, string> | null;
}

export interface Ayarlar {
  gecikti?: boolean;
  gun?: boolean;
  once?: boolean;
}

export interface Termin {
  projeId: string;
  projeAdi: string;
  adim: string;
  tarih: string;
  cins: Cins;
}

// Kullanıcının saat diliminde bugünün YYYY-AA-GG anahtarı.
// Intl her Deno sürümünde var; geçersiz dilim atar, o yüzden UTC'ye
// düşülüyor (sessizce yanlış gün hesaplamaktansa bilinen bir gün).
export function bugunKey(saatDilimi?: string | null, simdi = new Date()): string {
  const dilim = saatDilimi || 'UTC';
  try {
    // en-CA biçimi zaten YYYY-MM-DD veriyor.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: dilim, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(simdi);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(simdi);
  }
}

// Gün anahtarına n gün ekler. app.html'deki gunEkleKey ile aynı iş.
export function gunEkleKey(key: string, n: number): string {
  const [y, a, g] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, a - 1, g));
  d.setUTCDate(d.getUTCDate() + n);
  const iki = (x: number) => String(x).padStart(2, '0');
  return d.getUTCFullYear() + '-' + iki(d.getUTCMonth() + 1) + '-' + iki(d.getUTCDate());
}

// ⛔ app.html:hatirlatilacaklar() İKİZİ.
// Ayarlardan BAĞIMSIZ: "seni bekleyen" terminlerin tamamı.
export function hatirlatilacaklar(
  projeler: ProjeSatiri[], bugun: string,
): Termin[] {
  const yarin = gunEkleKey(bugun, 1);
  const liste: Termin[] = [];
  for (const p of projeler) {
    // Mezar taşı satırları listelerden düşüyor (projects.deleted_at).
    // Tarayıcıda bu satırlar zaten hiç yüklenmiyor.
    if (p.deleted_at) continue;
    if (p.cancelled) continue;
    const adimlar = p.steps || {};
    const tarihler = p.deadlines || {};
    for (const k of PROJE_ADIMLARI) {
      const d = tarihler[k] || '';
      if (!d || adimlar[k] === true) continue;
      let cins: Cins | '' = '';
      if (d < bugun) cins = 'gecikti';
      else if (d === bugun) cins = 'bugun';
      else if (d === yarin) cins = 'yarin';
      if (cins) {
        liste.push({
          projeId: p.id, projeAdi: p.name || '', adim: k, tarih: d, cins,
        });
      }
    }
  }
  return liste;
}

// ⛔ app.html:hatirlatmaSecili() İKİZİ.
// Kullanıcının açtığı kanallara göre süzüyor.
export function hatirlatmaSecili(
  projeler: ProjeSatiri[], bugun: string, ayar: Ayarlar,
): Termin[] {
  return hatirlatilacaklar(projeler, bugun).filter((x) =>
    (x.cins === 'gecikti' && ayar.gecikti === true) ||
    (x.cins === 'bugun' && ayar.gun === true) ||
    (x.cins === 'yarin' && ayar.once === true)
  );
}
