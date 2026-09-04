// Hoşgeldin e-postası — Supabase Edge Function.
//
// Ne yapar: auth.users tablosuna yeni satır girince (sql/20-hosgeldin-webhook.sql
// tetikleyicisi) çağrılır ve Resend üzerinden hoşgeldin e-postasını gönderir.
//
// Gizli ayarlar (supabase secrets set ...):
//   RESEND_API_KEY            Resend API anahtarı (re_...)
//   HOSGELDIN_WEBHOOK_SECRET  Tetikleyicinin x-webhook-secret başlığında yolladığı
//                             uzun rastgele metin. Uyuşmazsa istek reddedilir.
//   MAIL_FROM                 isteğe bağlı; varsayılan "Shootboard <hello@shootboard.app>"
//   MAIL_REPLY_TO             isteğe bağlı; varsayılan hello@shootboard.app
//   APP_URL                   isteğe bağlı; varsayılan https://shootboard.app/app.html
//
// Dağıtım: supabase functions deploy hosgeldin --no-verify-jwt
// (--no-verify-jwt şart: tetikleyici kullanıcı JWT'si taşımaz, kimlik doğrulama
//  yukarıdaki gizli anahtarla yapılır.)
//
// Dil: hesap e-posta bağlantısıyla açıldıysa app.html kayıt sırasında
// raw_user_meta_data.lang yazıyor (tr/en) ve e-posta o dilde gider. Google ile
// açılan hesapta bu alan yoktur; e-posta iki dilli gider.
//
// Tekrar güvenliği: Resend'e Idempotency-Key olarak kullanıcı kimliği gidiyor;
// tetikleyici bir sebeple iki kez çalışsa da ikinci e-posta gönderilmez.

import { hosgeldinEposta } from './sablonlar.js';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('HOSGELDIN_WEBHOOK_SECRET') ?? '';
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'Shootboard <hello@shootboard.app>';
const MAIL_REPLY_TO = Deno.env.get('MAIL_REPLY_TO') ?? 'hello@shootboard.app';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://shootboard.app/app.html';

function json(govde: unknown, durum = 200): Response {
  return new Response(JSON.stringify(govde), { status: durum, headers: { 'Content-Type': 'application/json' } });
}

// Google "full_name" veriyor; selamlamada yalnızca ilk ad kullanılıyor.
// E-postaya benzeyen ya da 40 karakterden uzun bir şey gelirse boş sayılıyor.
function ilkAd(tam: unknown): string {
  const s = String(tam ?? '').trim();
  if (!s || s.includes('@') || s.length > 40) return '';
  return s.split(/\s+/)[0];
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, sebep: 'yalnizca POST' }, 405);
  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ ok: false, sebep: 'gizli anahtar uyusmuyor' }, 401);
  }
  if (!RESEND_API_KEY) return json({ ok: false, sebep: 'RESEND_API_KEY tanimli degil' }, 500);

  let yuk: any;
  try { yuk = await req.json(); } catch { return json({ ok: false, sebep: 'gecersiz JSON' }, 400); }

  // Yalnızca auth.users INSERT olayı ilgilendiriyor; başka olay gelirse
  // sessizce atlanır (200), tetikleyici hata sanmasın.
  if (yuk?.type !== 'INSERT' || yuk?.table !== 'users' || yuk?.schema !== 'auth') {
    return json({ ok: true, atlandi: 'ilgisiz olay' });
  }
  const kayit = yuk.record ?? {};
  const email: string = String(kayit.email ?? '').trim();
  if (!email) return json({ ok: true, atlandi: 'e-posta yok' });

  const meta = kayit.raw_user_meta_data ?? {};
  const lang: 'tr' | 'en' | 'both' = meta.lang === 'tr' || meta.lang === 'en' ? meta.lang : 'both';
  const ad = ilkAd(meta.full_name ?? meta.name ?? '');
  const e = hosgeldinEposta({ lang, ad, appUrl: APP_URL });

  const yanit = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `hosgeldin/${kayit.id ?? email}`
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [email],
      reply_to: MAIL_REPLY_TO,
      subject: e.subject,
      html: e.html,
      text: e.text,
      tags: [{ name: 'tur', value: 'hosgeldin' }, { name: 'dil', value: lang }]
    })
  });
  const govde = await yanit.text();
  if (!yanit.ok) {
    console.error('[hosgeldin] Resend reddetti', yanit.status, govde);
    return json({ ok: false, resend: yanit.status }, 502);
  }
  console.log('[hosgeldin] gonderildi', kayit.id, lang);
  return json({ ok: true, lang });
});
