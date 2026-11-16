#!/usr/bin/env node
// Push fonksiyonunun UC dosyasini TEK dosyada birlestirir.
//
// NEDEN VAR
//   Supabase panelindeki editorde birden cok dosya olusturmak
//   kullaniciyi zorladi: 16 Kasim 2026'da dagitim
//   'Module not found "webpush.ts"' ile patladi, cunku panele yalnizca
//   index.ts ulasmisti. Tek dosyada import diye bir sey kalmiyor,
//   yani bu hata da kalmiyor.
//
// ⛔ ASIL KAYNAK UC DOSYADIR. Bu betigin uretttigi TEK-DOSYA.ts bir
//    CIKTIDIR; elle duzenlenmez. Duzenleme uc dosyada yapilir, sonra
//    bu betik tekrar kosturulur.
//
// ⚠ AYRISMA testler/push-tek-dosya.test.js ile yakalaniyor: test
//   birlestirmeyi yeniden yapip diskteki dosyayla karsilastiriyor.
//   Uc dosyadan biri degisip bu betik kosturulmazsa test kirmizi yanar.
//
// Kullanim:  node araclar/push-tek-dosya.js

const fs = require('fs');
const path = require('path');

const KLASOR = path.join(__dirname, '..', 'supabase', 'functions', 'push-gonder');
const CIKTI = path.join(KLASOR, 'TEK-DOSYA.ts');

// Sira onemli: index.ts otekilerin tanimlarini kullaniyor, en sona.
const SIRA = ['webpush.ts', 'terminler.ts', 'index.ts'];

function temizle(kod, dosya) {
  let s = kod;
  // Kendi aralarindaki import'lar: tek dosyada gereksiz.
  s = s.replace(/^import\s+[\s\S]*?from\s+'\.\/(webpush|terminler)\.ts';\s*$/gm, '');
  // export yalnizca basta duran anahtar kelime olarak siliniyor.
  s = s.replace(/^export\s+/gm, '');
  return '// ═══ ' + dosya + ' ' + '═'.repeat(Math.max(0, 60 - dosya.length)) +
         '\n' + s.trim() + '\n';
}

const BASLIK = `// ═══════════════════════════════════════════════════════════════════
// push-gonder — TEK DOSYA SURUMU
// ═══════════════════════════════════════════════════════════════════
//
// ⛔ BU DOSYA ELLE DUZENLENMEZ. Uretilmis bir ciktidir.
//    Asil kaynak su uc dosya:
//      supabase/functions/push-gonder/webpush.ts
//      supabase/functions/push-gonder/terminler.ts
//      supabase/functions/push-gonder/index.ts
//    Degisiklik orada yapilir, sonra:  node araclar/push-tek-dosya.js
//
// NEDEN VAR
//    Supabase panelindeki editorde uc ayri dosya olusturmak zor;
//    16 Kasim 2026'da dagitim 'Module not found "webpush.ts"' ile
//    patladi cunku panele yalnizca index.ts ulasmisti. Bu surumde
//    import yok, yani o hata da yok.
//
// ⚠ Ayrisma testler/push-tek-dosya.test.js ile yakalaniyor.
//
// ═══════════════════════════════════════════════════════════════════

`;

function uret() {
  const parcalar = SIRA.map((d) =>
    temizle(fs.readFileSync(path.join(KLASOR, d), 'utf8'), d));
  return BASLIK + parcalar.join('\n');
}

module.exports = { uret, CIKTI };

if (require.main === module) {
  const metin = uret();
  fs.writeFileSync(CIKTI, metin, 'utf8');
  console.log('yazildi: ' + CIKTI);
  console.log('  ' + metin.split('\n').length + ' satir, ' +
              Buffer.byteLength(metin, 'utf8') + ' bayt');
  const kalanImport = (metin.match(/^import\s/gm) || []).length;
  const kalanExport = (metin.match(/^export\s/gm) || []).length;
  console.log('  kalan import: ' + kalanImport + ', kalan export: ' + kalanExport);
  if (kalanImport || kalanExport) {
    console.error('⛔ import/export kalmis -- tek dosya calismaz');
    process.exit(1);
  }
}
