// Hoşgeldin e-postası şablonları.
// Deno (Edge Function) ve Node (önizleme üretimi) ikisinde de çalışsın diye
// düz ESM; tip yok, dış bağımlılık yok. Metinleri burada değiştir, sonra
// fonksiyonu yeniden dağıt: supabase functions deploy hosgeldin --no-verify-jwt

const RENK = {
  zemin: '#F4F7FA', kart: '#FFFFFF', metin: '#141C27', soluk: '#5B6B7F',
  vurgu: '#2563C7', cizgi: '#DFE5EC', yumusak: '#EDF1F6'
};
const YAZI = "'IBM Plex Sans','Segoe UI',system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif";

export function kacir(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const METIN = {
  tr: {
    konu: "Shootboard'a hoş geldin",
    onizleme: 'Bir çekim, her paylaşım. İlk üç adım içeride.',
    selam: ad => ad ? `Merhaba ${ad},` : 'Merhaba,',
    giris: "Shootboard'a hoş geldin. Burası bir planlama panosu: bir çekimden çıkan bütün paylaşımları, her birinin kendi açıklaması, kapak yazısı ve saatiyle tek yerde tutar. Yayınlamaz; yayınlayan sensin, plan düz kalır.",
    adimBaslik: 'İlk üç adım',
    adimlar: [
      ['Bir fikir yaz.', 'Fikirler sayfasında bir kart aç; yarım cümle bile olur.'],
      ['Bir proje aç.', 'Çekimin yedi adımı ve terminleri orada; geciken kendiliğinden kırmızıya döner.'],
      ['Paylaşımları takvime koy.', "Aynı çekim Instagram'da Reel, YouTube'da Short; ikisini ayrı kayıt olarak yerleştir."]
    ],
    dugme: "Shootboard'u aç",
    ipucu: 'İpucu: sol menüdeki "AI (Gemini)" ile ücretsiz bir Google Gemini anahtarı bağlarsan script, başlık ve açıklama taslaklarını Shootboard yazar. Anahtar tarayıcında kalır, bize hiç gelmez.',
    kapanis: "Bir sorun ya da fikrin olursa bu e-postayı cevapla; Shootboard'u yapan kişi okur.",
    altbilgi: "Bu e-postayı Shootboard'da hesap açtığın için aldın. Bülten değil; sormadan tanıtım e-postası göndermeyiz."
  },
  en: {
    konu: 'Welcome to Shootboard',
    onizleme: 'One shoot, every post. Your first three steps are inside.',
    selam: ad => ad ? `Hi ${ad},` : 'Hi,',
    giris: "Welcome to Shootboard. It is a planning board: every post that comes out of one shoot, each with its own caption, cover text and time slot, on one board. It does not publish; you do, and the plan stays straight.",
    adimBaslik: 'Your first three steps',
    adimlar: [
      ['Write down an idea.', 'Open a card on the Ideas page; half a sentence is enough.'],
      ['Open a project.', 'The seven steps of a shoot and their deadlines live there; anything overdue turns red on its own.'],
      ['Put the posts on the calendar.', 'The same footage goes out as a Reel on Instagram and a Short on YouTube; place them as two entries.']
    ],
    dugme: 'Open Shootboard',
    ipucu: 'Tip: connect a free Google Gemini key from "AI (Gemini)" in the left rail and Shootboard drafts scripts, titles and captions for you. The key stays in your browser; it never reaches us.',
    kapanis: 'Questions or ideas? Reply to this email; the person who builds Shootboard reads it.',
    altbilgi: "You are receiving this because you created a Shootboard account. It is not a newsletter; we do not send promotional email without asking."
  }
};

function blokHtml(m, ad, appUrl) {
  const adimlar = m.adimlar.map(([b, a], i) =>
    `<tr><td valign="top" style="padding:6px 10px 6px 0;font-family:${YAZI};font-size:15px;line-height:1.5;color:${RENK.vurgu};font-weight:700;">${i + 1}.</td>` +
    `<td valign="top" style="padding:6px 0;font-family:${YAZI};font-size:15px;line-height:1.5;color:${RENK.metin};"><strong>${kacir(b)}</strong> ${kacir(a)}</td></tr>`
  ).join('');
  return `
<p style="margin:0 0 14px;font-family:${YAZI};font-size:16px;line-height:1.6;color:${RENK.metin};">${kacir(m.selam(ad))}</p>
<p style="margin:0 0 18px;font-family:${YAZI};font-size:16px;line-height:1.6;color:${RENK.metin};">${kacir(m.giris)}</p>
<p style="margin:0 0 6px;font-family:${YAZI};font-size:12px;line-height:1.4;letter-spacing:.08em;text-transform:uppercase;color:${RENK.soluk};font-weight:600;">${kacir(m.adimBaslik)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 6px;">${adimlar}</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 20px;"><tr><td style="background:${RENK.vurgu};border-radius:8px;"><a href="${kacir(appUrl)}" style="display:inline-block;padding:12px 22px;font-family:${YAZI};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">${kacir(m.dugme)}</a></td></tr></table>
<p style="margin:0 0 14px;padding:12px 14px;background:${RENK.yumusak};border-radius:8px;font-family:${YAZI};font-size:14px;line-height:1.55;color:${RENK.metin};">${kacir(m.ipucu)}</p>
<p style="margin:0;font-family:${YAZI};font-size:15px;line-height:1.6;color:${RENK.metin};">${kacir(m.kapanis)}</p>`;
}

function blokMetin(m, ad, appUrl) {
  return [
    m.selam(ad), '', m.giris, '', m.adimBaslik.toUpperCase(),
    ...m.adimlar.map(([b, a], i) => `${i + 1}. ${b} ${a}`),
    '', `${m.dugme}: ${appUrl}`, '', m.ipucu, '', m.kapanis
  ].join('\n');
}

function zarf({ dil, onizleme, baslik, icerik, altbilgi }) {
  return `<!DOCTYPE html>
<html lang="${dil}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${kacir(baslik)}</title></head>
<body style="margin:0;padding:0;background:${RENK.zemin};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${kacir(onizleme)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${RENK.zemin};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 14px;font-family:${YAZI};font-size:18px;font-weight:700;letter-spacing:-.01em;color:${RENK.metin};">&#127916; Shootboard</td></tr>
<tr><td style="background:${RENK.kart};border:1px solid ${RENK.cizgi};border-radius:12px;padding:28px 28px 24px;">${icerik}</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${YAZI};font-size:12px;line-height:1.55;color:${RENK.soluk};">
Shootboard &middot; <a href="https://shootboard.app" style="color:${RENK.soluk};">shootboard.app</a> &middot; <a href="mailto:hello@shootboard.app" style="color:${RENK.soluk};">hello@shootboard.app</a><br>${altbilgi}
</td></tr>
</table></td></tr></table></body></html>`;
}

const AYRAC = `<hr style="border:0;border-top:1px solid ${RENK.cizgi};margin:26px 0;">`;

// lang: 'tr' | 'en' | 'both'. Dili bilinmeyen hesaba iki dilli gider.
export function hosgeldinEposta({ lang = 'both', ad = '', appUrl = 'https://shootboard.app/app.html' } = {}) {
  const diller = lang === 'tr' ? ['tr'] : lang === 'en' ? ['en'] : ['tr', 'en'];
  const konu = diller.map(d => METIN[d].konu).join(' · ');
  const onizleme = diller.map(d => METIN[d].onizleme).join(' · ');
  const icerik = diller.map(d => blokHtml(METIN[d], ad, appUrl)).join(AYRAC);
  const altbilgi = diller.map(d => kacir(METIN[d].altbilgi)).join('<br>');
  const html = zarf({ dil: diller[0], onizleme, baslik: konu, icerik, altbilgi });
  const text = diller.map(d => blokMetin(METIN[d], ad, appUrl)).join('\n\n' + '-'.repeat(32) + '\n\n')
    + '\n\n' + diller.map(d => METIN[d].altbilgi).join('\n') + '\nShootboard · https://shootboard.app · hello@shootboard.app\n';
  return { subject: konu, html, text };
}
