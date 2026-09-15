const { chromium } = require('playwright');
const fs = require('fs');
const out = 'kartlar';
const base = `<style>
body{margin:0;width:1920px;height:1080px;background:#0e0f12;font-family:"DejaVu Sans","Noto Sans",Arial,sans-serif;color:#f2eee6;display:flex;align-items:center;justify-content:center;overflow:hidden}
.gold{color:#C8A24A}.small{font-size:40px;letter-spacing:.12em;text-transform:uppercase;color:#C8A24A}
.big{font-size:150px;font-weight:700;letter-spacing:.02em;text-align:center;line-height:1.1}
.mid{font-size:96px;font-weight:700;text-align:center;line-height:1.2}
.stamp{border:14px solid var(--c);color:var(--c);padding:30px 70px;font-size:140px;font-weight:800;letter-spacing:.08em;transform:rotate(-6deg);border-radius:18px;text-transform:uppercase;background:rgba(0,0,0,.35)}
.transp{background:transparent}
.card{display:flex;flex-direction:column;align-items:center;gap:30px}
.line{width:900px;height:6px;background:#C8A24A}
.quote{font-size:72px;line-height:1.35;text-align:center;max-width:1500px;font-style:italic}
.author{font-size:44px;color:#C8A24A;letter-spacing:.1em}
.timeline{width:1700px;position:relative;height:400px}
.timeline .bar{position:absolute;top:200px;left:0;right:0;height:8px;background:#5a5a5a}
.timeline .pt{position:absolute;top:172px;width:64px;height:64px;border-radius:50%;background:#C8A24A;transform:translateX(-32px)}
.timeline .lbl{position:absolute;top:70px;transform:translateX(-50%);text-align:center;font-size:56px;font-weight:700;white-space:nowrap}
.timeline .sub{position:absolute;top:270px;transform:translateX(-50%);text-align:center;font-size:34px;color:#bdb6a8;white-space:nowrap;line-height:1.3}
.counter{position:absolute;top:60px;right:80px;background:rgba(14,15,18,.8);border:4px solid #C8A24A;border-radius:20px;padding:24px 44px;font-size:64px;font-weight:700}
.counter span{color:#C8A24A}
.tag{position:absolute;left:60px;bottom:50px;font-size:34px;letter-spacing:.2em;color:#f2eee6;background:rgba(0,0,0,.55);padding:14px 28px;border:2px solid #C8A24A}
.q{display:flex;gap:120px}
.q div{font-size:80px;font-weight:700;text-align:center}
.q .ok{color:#C8A24A}.q .no{color:#e0574f}
.split{display:flex;width:100%;height:100%}
.split div{flex:1;display:flex;align-items:flex-end;justify-content:center;padding-bottom:80px;font-size:96px;font-weight:800;color:#C8A24A}
.split div+div{border-left:6px solid #C8A24A}
</style>`;
const cards = [
 ['C2_damga_KAYIT', `<div class="stamp" style="--c:#C8A24A">KAYIT</div>`, true],
 ['C2_damga_RIVAYET', `<div class="stamp" style="--c:#e0574f">RİVAYET</div>`, true],
 ['C2_damga_BAZI_ARASTIRMACILARA_GORE', `<div class="stamp" style="--c:#b8b8b8;font-size:84px">BAZI ARAŞTIRMACILARA GÖRE</div>`, true],
 ['C2_damga_BAZI_KAYNAKLARA_GORE', `<div class="stamp" style="--c:#b8b8b8;font-size:84px">BAZI KAYNAKLARA GÖRE</div>`, true],
 ['C2_damga_KAYITLI_ORNEK_YOK', `<div class="stamp" style="--c:#e0574f;font-size:96px">KAYITLI ÖRNEK YOK</div>`, true],
 ['C2_damga_DOGRULANAMIYOR', `<div class="stamp" style="--c:#b8b8b8;font-size:96px">DOĞRULANAMIYOR</div>`, true],
 ['C3_tarih_1760_Ayazma', `<div class="card"><div class="big">1760</div><div class="line"></div><div class="small">Ayazma Camii · III. Mustafa</div></div>`],
 ['C3_tarih_1708_YeniValide', `<div class="card"><div class="big">1708–1710</div><div class="line"></div><div class="small">Yeni Valide Camii · Gülnuş Valide Sultan</div></div>`],
 ['C3_tarih_1801_Selimiye', `<div class="card"><div class="big">1801–1805</div><div class="line"></div><div class="small">Selimiye Camii · III. Selim</div></div>`],
 ['C3_tarih_1745_SeyyidHasanPasa', `<div class="card"><div class="big">1745</div><div class="line"></div><div class="small">Seyyid Hasan Paşa Medresesi · Beyazıt</div></div>`],
 ['C4_tarih_seridi', `<div class="timeline"><div class="bar"></div>
  <div class="lbl" style="left:10%">13. yy</div><div class="pt" style="left:10%"></div><div class="sub" style="left:10%">Tokat Ulu Camii<br>(bazı kaynaklara göre)</div>
  <div class="lbl" style="left:37%">16. yy</div><div class="pt" style="left:37%"></div><div class="sub" style="left:37%">Sinan · Büyükçekmece<br>Bali Paşa</div>
  <div class="lbl" style="left:63%">18. yy</div><div class="pt" style="left:63%"></div><div class="sub" style="left:63%">Barok zirve<br>Ayazma · Yeni Valide<br>Selimiye</div>
  <div class="lbl" style="left:90%">19. yy</div><div class="pt" style="left:90%"></div><div class="sub" style="left:90%">Bursa<br>leylek bakımevi</div></div>`],
 ['C5_20_KUS_EVI', `<div class="card"><div class="big">20</div><div class="line"></div><div class="small">kuş evi · Ayazma Camii (sahada sayılacak)</div></div>`],
 ['C5_GELIR_0', `<div class="card"><div class="small">yumurta yok · kuş satışı yok</div><div class="big">GELİR: 0</div></div>`],
 ['C5_KUS_CAMISI', `<div class="card"><div class="big">KUŞ CAMİSİ</div><div class="line"></div><div class="small">3 kubbe · 2 minare · Yeni Valide</div></div>`],
 ['C5_KEDIYE_KAPALI', `<div class="card"><div class="big">KEDİYE KAPALI</div><div class="line"></div><div class="small">kuşa açık · ajurlu pencere · Selimiye</div></div>`],
 ['C5_OYMA_MONTE', `<div class="split"><div>OYMA</div><div>MONTE</div></div>`, true],
 ['C5_1760_vs_1805', `<div class="split"><div style="flex-direction:column;gap:20px"><span style="font-size:150px">20</span><span style="font-size:48px;color:#f2eee6">küçük ev · 1760</span></div><div style="flex-direction:column;gap:20px"><span style="font-size:150px">2</span><span style="font-size:48px;color:#f2eee6">büyük konak · 1805</span></div></div>`],
 ['C6_pusula', `<div class="card"><div class="big">G → D</div><div class="line"></div><div class="small">hep güney ve doğu cephelerde</div></div>`],
 ['C7_uc_soru', `<div class="q"><div>Neden?<br><span class="ok">✔</span></div><div>Ne zaman?<br><span class="ok">✔</span></div><div>Dünyada başka?<br><span class="no">?</span></div></div>`],
 ['C9_alinti_Bektas', `<div class="card"><div class="quote">"Dünyanın önemli bölümünü dolaştım.<br>Türkiye dışında bir örnek anımsamıyorum."</div><div class="line"></div><div class="author">CENGİZ BEKTAŞ · MİMAR</div></div>`],
 ['C10_deney_sonucu_SABLON', `<div class="card"><div class="small">30 dakika · Ordu Caddesi</div><div class="big">yukarı bakan: <span class="gold">N</span></div><div class="small" style="color:#bdb6a8">yorum tahminleri: en çok ... dendi</div></div>`],
 ['C11_CTA', `<div class="card"><div class="mid">Merhamet mi, hesap mı?</div><div class="line"></div><div class="mid" style="font-size:64px;font-weight:400">Türkiye dışında kuş evi gördünüz mü?</div><div class="small">yorumlarda buluşalım</div></div>`],
 ['C12_TEMSILI_etiket', `<div class="tag">TEMSİLİ CANLANDIRMA</div>`, true],
 ['C1_sayac_SABLON', `<div class="counter">Yukarı bakan: <span>?</span></div>`, true],
 ['C1_sayac_30dk_SABLON', `<div class="counter">00:00 &nbsp;/&nbsp; <span>0</span></div>`, true],
 ['C13_gordunuz_mu', `<div class="card"><div class="big">Gördünüz mü?</div><div class="small">pencere hizasının üstü · kemerlerin arası</div></div>`],
 ['C14_Sinan_kayit_iddia', `<div class="card" style="gap:50px"><div class="mid">Sinan kuş evi yaptı → <span class="gold">KAYIT</span></div><div class="mid">Kuşlara para bıraktı → <span style="color:#e0574f">İDDİA</span></div></div>`],
 ['C15_leylek_1890_2008', `<div class="card"><div class="mid">Gurabahane-i Laklakan</div><div class="big" style="font-size:110px">1890'lar → 2008</div><div class="small">kimsesiz leylekler evi · Bursa</div></div>`],
];
(async()=>{
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(()=>chromium.launch());
  const pg = await b.newPage({ viewport:{width:1920,height:1080} });
  for(const [name, html, transparent] of cards){
    const body = transparent ? base.replace('background:#0e0f12','background:transparent') : base;
    await pg.setContent(`<!doctype html><html><head><meta charset="utf-8">${body}</head><body>${html}</body></html>`);
    await pg.screenshot({ path:`${out}/${name}.png`, omitBackground: !!transparent });
  }
  await b.close();
  console.log(fs.readdirSync(out).length + ' kart');
})();
