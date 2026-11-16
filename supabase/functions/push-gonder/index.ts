// Push bildirimi göndericisi — Supabase Edge Function.
//
// NE YAPAR
//   Zamanlanmış görev (cron) bunu saatte bir çağırıyor. Fonksiyon
//   push aboneliklerini geziyor, her kullanıcının KENDİ saat diliminde
//   hatırlatma saati gelmiş mi diye bakıyor, gelmişse o günün termin
//   listesini hesaplayıp bildirimi gönderiyor.
//
// GİZLİ AYARLAR (supabase secrets set ...)
//   VAPID_ACIK           VAPID açık anahtarı (base64url, 65 bayt ham)
//   VAPID_OZEL           VAPID özel anahtarı (base64url, 32 bayt ham)
//   VAPID_KONU           "mailto:hello@shootboard.app" gibi
//   PUSH_TETIK_SIRRI     cron'un x-push-secret başlığında yolladığı
//                        uzun rastgele metin. Uyuşmazsa istek reddedilir.
//   SUPABASE_URL                 Supabase kendisi tanımlıyor
//   SUPABASE_SERVICE_ROLE_KEY    Supabase kendisi tanımlıyor
//
// DAĞITIM: supabase/functions/push-gonder/README.md — adım adım.
//
// ⚠ KISA AD KLASÖR ADI DEĞİL. Panelden kurulunca adresteki kısa ad
//   RASTGELE üretiliyor ve sonradan değiştirilemiyor. Bu tuzak bu
//   depoda iki kez 404'e yol açtı (sql/20'nin başı ve hosgeldin
//   README'si). Dağıttıktan sonra GERÇEK adresi README'ye yaz.
//
// ⚠ SURUM: metin ya da mantık değişince ARTIR. Yoksa "dağıtım tuttu mu"
//   sorusunun dışarıdan cevabı olmuyor — story-yayin'de bir kez eski
//   sürüm "doğrulandı" sanıldı ve sorun günlerce yanlış yerde arandı.

import { pushGonder } from './webpush.ts';
import {
  hatirlatmaSecili, bugunKey, type ProjeSatiri, type Termin,
} from './terminler.ts';

const SURUM = 1;

// ── Metinler ────────────────────────────────────────────────────────
// ⛔ İKİ DİL ŞART. Kullanıcının kuralı: "hazırlanan her şey mutlaka
//    İngilizcede olmalı" (15 Kasım 2026). Dil prefs.lang'den geliyor.
const METIN = {
  tr: {
    baslik: (n: number) => n === 1 ? '1 termin seni bekliyor'
                                   : n + ' termin seni bekliyor',
    gecikti: 'gecikti',
    bugun: 'bugün',
    yarin: 'yarın',
    adim: {
      script: 'Senaryo', filmed: 'Çekim', audio: 'Ses', edited: 'Kurgu',
      approved: 'Onay', package: 'Paketleme', published: 'Yayın',
    } as Record<string, string>,
  },
  en: {
    baslik: (n: number) => n === 1 ? '1 deadline is waiting'
                                   : n + ' deadlines are waiting',
    gecikti: 'late',
    bugun: 'today',
    yarin: 'tomorrow',
    adim: {
      script: 'Script', filmed: 'Filming', audio: 'Audio', edited: 'Edit',
      approved: 'Approval', package: 'Packaging', published: 'Publish',
    } as Record<string, string>,
  },
};

function govdeYaz(terminler: Termin[], dil: 'tr' | 'en'): string {
  const m = METIN[dil];
  // En fazla üç satır: bildirim zaten kısalıyor, dördüncü satır
  // kullanıcıya hiçbir şey söylemeden yer kaplıyor.
  const ilk = terminler.slice(0, 3).map((t) => {
    const adimAdi = m.adim[t.adim] || t.adim;
    const ne = t.cins === 'gecikti' ? m.gecikti
             : t.cins === 'bugun' ? m.bugun : m.yarin;
    const proje = t.projeAdi || '—';
    return proje + ' · ' + adimAdi + ' (' + ne + ')';
  });
  const kalan = terminler.length - ilk.length;
  if (kalan > 0) {
    ilk.push(dil === 'tr' ? '+' + kalan + ' tane daha'
                          : '+' + kalan + ' more');
  }
  return ilk.join('\n');
}

// ── Supabase REST ───────────────────────────────────────────────────
// Dış kütüphane yok; depodaki gelenek bu.
async function sor(
  yol: string, url: string, anahtar: string,
): Promise<unknown[]> {
  const cevap = await fetch(url + '/rest/v1/' + yol, {
    headers: {
      apikey: anahtar,
      Authorization: 'Bearer ' + anahtar,
      Accept: 'application/json',
    },
  });
  if (!cevap.ok) {
    throw new Error('REST ' + yol.split('?')[0] + ' -> ' + cevap.status +
                    ' ' + (await cevap.text()).slice(0, 200));
  }
  return await cevap.json();
}

async function yaz(
  yol: string, url: string, anahtar: string, yontem: string, govde?: unknown,
): Promise<void> {
  const cevap = await fetch(url + '/rest/v1/' + yol, {
    method: yontem,
    headers: {
      apikey: anahtar,
      Authorization: 'Bearer ' + anahtar,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  if (!cevap.ok && cevap.status !== 404) {
    throw new Error('REST ' + yontem + ' ' + yol.split('?')[0] + ' -> ' +
                    cevap.status + ' ' + (await cevap.text()).slice(0, 200));
  }
}

// Kullanıcının saat diliminde şu anki "SS:DD".
function simdiSaat(dilim: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: dilim || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date());
  }
}

interface Abonelik {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  saat_dilimi: string | null;
  son_gonderim_gunu: string | null;
}

// ── Giriş ───────────────────────────────────────────────────────────

Deno.serve(async (istek: Request) => {
  const vapidAcik = Deno.env.get('VAPID_ACIK') || '';
  const vapidOzel = Deno.env.get('VAPID_OZEL') || '';
  const vapidKonu = Deno.env.get('VAPID_KONU') || 'mailto:hello@shootboard.app';
  const tetikSirri = Deno.env.get('PUSH_TETIK_SIRRI') || '';
  const url = Deno.env.get('SUPABASE_URL') || '';
  const servisAnahtari = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  // ── GET: durum + VAPID AÇIK anahtarı ──────────────────────────────
  // Açık anahtar gizli değil: tarayıcıya zaten gidiyor. Buradan
  // verilmesinin sebebi, app.html'e GÖMÜLMEMESİ — kullanıcı hiçbir
  // dosyayı elle düzenlemek zorunda kalmasın diye.
  // ⛔ ÖZEL anahtar buradan ASLA dönmüyor; yalnızca tanımlı mı bilgisi.
  if (istek.method === 'GET') {
    return new Response(JSON.stringify({
      surum: SURUM,
      vapidAcik,
      sirlar: {
        VAPID_ACIK: !!vapidAcik,
        VAPID_OZEL: !!vapidOzel,
        VAPID_KONU: !!Deno.env.get('VAPID_KONU'),
        PUSH_TETIK_SIRRI: !!tetikSirri,
        SUPABASE_URL: !!url,
        SUPABASE_SERVICE_ROLE_KEY: !!servisAnahtari,
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // app.html baska bir kokenden (shootboard.app) cagiriyor.
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  if (istek.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    });
  }

  if (istek.method !== 'POST') {
    return new Response('yontem desteklenmiyor', { status: 405 });
  }

  // ── POST: gönderim turu ───────────────────────────────────────────
  if (!tetikSirri || istek.headers.get('x-push-secret') !== tetikSirri) {
    // ⛔ Sebep YAZILMIYOR: sirrin tanimli olup olmadigi disaridan
    //    anlasilmasin.
    return new Response('yetkisiz', { status: 401 });
  }
  if (!vapidAcik || !vapidOzel) {
    return new Response(JSON.stringify({ hata: 'VAPID anahtarlari tanimli degil' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const rapor = {
    surum: SURUM, abonelik: 0, gonderildi: 0, atlandi: 0,
    silindi: 0, hata: 0, ayrinti: [] as string[],
  };

  try {
    const abonelikler = await sor(
      'push_abonelikleri?select=id,user_id,endpoint,p256dh,auth,saat_dilimi,son_gonderim_gunu',
      url, servisAnahtari) as Abonelik[];
    rapor.abonelik = abonelikler.length;

    // Kullanıcı başına tercih ve proje BİR KEZ okunuyor: aynı kişinin
    // üç tarayıcısı varsa üç kez sorgulamanın anlamı yok.
    const tercihOnbellek = new Map<string, { ayar: Record<string, boolean>; saat: string; dil: 'tr' | 'en' }>();
    const projeOnbellek = new Map<string, ProjeSatiri[]>();

    for (const a of abonelikler) {
      try {
        if (!tercihOnbellek.has(a.user_id)) {
          const satirlar = await sor(
            'user_prefs?select=prefs&user_id=eq.' + a.user_id, url, servisAnahtari,
          ) as Array<{ prefs?: Record<string, unknown> }>;
          const prefs = (satirlar[0] && satirlar[0].prefs) || {};
          const r = (prefs.reminders || {}) as Record<string, unknown>;
          tercihOnbellek.set(a.user_id, {
            ayar: {
              gecikti: r.gecikti === true,
              gun: r.gun === true,
              once: r.once === true,
            },
            // ⚠ saat prefs'e 16 Kasim 2026'da eklendi. Eski satirlarda
            //   yok; varsayilan 09:00 (HATIRLATMA_VARSAYILAN ile ayni).
            saat: typeof r.saat === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.saat)
                  ? r.saat : '09:00',
            dil: prefs.lang === 'tr' ? 'tr' : 'en',
          });
        }
        const tercih = tercihOnbellek.get(a.user_id)!;

        // Hiçbir kanal açık değilse bu kullanıcıya hiç bakma.
        if (!tercih.ayar.gecikti && !tercih.ayar.gun && !tercih.ayar.once) {
          rapor.atlandi++; continue;
        }

        const bugun = bugunKey(a.saat_dilimi);

        // Bugün zaten gönderildi mi?
        if (a.son_gonderim_gunu === bugun) { rapor.atlandi++; continue; }

        // Saat geldi mi? Kullanıcının KENDİ saatine bakılıyor.
        if (simdiSaat(a.saat_dilimi) < tercih.saat) { rapor.atlandi++; continue; }

        if (!projeOnbellek.has(a.user_id)) {
          projeOnbellek.set(a.user_id, await sor(
            'projects?select=id,name,cancelled,deleted_at,steps,deadlines' +
            '&user_id=eq.' + a.user_id, url, servisAnahtari) as ProjeSatiri[]);
        }
        const terminler = hatirlatmaSecili(
          projeOnbellek.get(a.user_id)!, bugun, tercih.ayar);

        if (!terminler.length) { rapor.atlandi++; continue; }

        const m = METIN[tercih.dil];
        const sonuc = await pushGonder(a, {
          baslik: m.baslik(terminler.length),
          govde: govdeYaz(terminler, tercih.dil),
          etiket: 'shootboard-termin',
        }, vapidAcik, vapidOzel, vapidKonu);

        if (sonuc.ok) {
          rapor.gonderildi++;
          await yaz('push_abonelikleri?id=eq.' + a.id, url, servisAnahtari, 'PATCH',
                    { son_gonderim_gunu: bugun, son_gorulme: new Date().toISOString() });
        } else if (sonuc.durum === 404 || sonuc.durum === 410) {
          // ⛔ Abonelik ÖLDÜ ve bir daha dirilmez: satir siliniyor.
          //    Mezar tasi tutmanin faydasi yok, burada kullanicinin
          //    verisi degil yalnizca bir teslimat adresi var.
          await yaz('push_abonelikleri?id=eq.' + a.id, url, servisAnahtari, 'DELETE');
          rapor.silindi++;
        } else {
          rapor.hata++;
          rapor.ayrinti.push('push ' + sonuc.durum + ': ' + sonuc.metin);
        }
      } catch (e) {
        rapor.hata++;
        rapor.ayrinti.push(String(e instanceof Error ? e.message : e).slice(0, 200));
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({
      surum: SURUM, hata: String(e instanceof Error ? e.message : e).slice(0, 300),
    }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  // Ayrıntı listesi sınırlanıyor: bin abonelik bozuksa kayıt dosyası
  // okunmaz hâle gelmesin.
  rapor.ayrinti = rapor.ayrinti.slice(0, 20);
  return new Response(JSON.stringify(rapor), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
});
