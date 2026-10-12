#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shootboard takvimini diske yedekler. SALT OKUR.

    python yedek-al.py                 # varsayilan klasore
    python yedek-al.py --klasor D:\\yedek

NEDEN VAR
  Supabase UCRETSIZ planda ve ucretsiz planin OTOMATIK YEDEGI YOK.
  12 Ekim 2026'da kullanici Pro'ya (aylik 25 dolar, gunluk yedek, 7 gun
  saklama) gecmemeye karar verdi; yedek tamamen bu dosyaya kaldi.

  ⚠ ASIL RISK SUPABASE'IN COKMESI DEGIL, BIZIM HATAMIZ.
  Ekim 2026 boyunca canli veritabaninda elle UPDATE'ler kosuldu: 64
  kayit, 25 kayit, tek kayitlar. Hepsi tuttu cunku her seferinde once
  SELECT ile bakildi. Bir gun bir `where` satiri eksik kalirsa bugun
  geri donus YOK. Bu dosya onun icin var.

  Pro'ya gecilse bile gerekli kalir: Pro'nun yedegi 7 gun sakliyor, uc
  hafta sonra fark edilen bir bozulmaya yetmez. Bu kopya senin diskinde
  ve suresiz.

NE YEDEKLER
  · butun takvim kayitlari (calendar_events)   -- alt yazi, etiketler,
    baslik, medya adi/adresi, yayin durumu dahil
  · projeler
  Medya dosyalari YEDEKLENMIYOR: onlar zaten R2'de ve asillari senin
  diskinde. Worker/uygulama kodu da yedeklenmiyor: GitHub'da.

⛔ HICBIR SEY YAZMAZ
  Yalnizca shootboard_list_entries ve shootboard_list_projects cagiriyor.
  Ne PATCH, ne silme. `uploaded` sutunu dahil hicbir alana dokunmuyor.
  Yedek alirken veri bozmak, yedeksiz kalmaktan kotu.

KURULUM
  story-yukle.py ile AYNI KLASORDE durmali: ayarlari oradan okuyor.
  Gereken ortam degiskenleri zaten tanimli:
      SHOOTBOARD_MCP_URL   https://<proje>.supabase.co/functions/v1/mcp
      SHOOTBOARD_KEY       shb_...
"""
import os
import sys
import json
import time
import argparse
import datetime
import importlib.util

try:
    import requests
except ImportError:
    sys.exit("requests yok. Kur:  pip install requests")

BURASI = os.path.dirname(os.path.abspath(__file__))

VARSAYILAN_KLASOR = r'E:\SHOOTBOARD\yedek'

# Kaydin olabilecegi en erken/en gec tarih. Genis tutuldu: dar bir
# aralik, aralik disinda kalan kaydi SESSIZCE yedeklemezdi ve bunu
# ancak veri kaybedildigi gun fark ederdik.
ILK_TARIH = datetime.date(2025, 1, 1)
SON_TARIH_PAYI = 400          # bugunden kac gun ileri

# ⚠ 90 GUNLUK PENCERE, KEYFI DEGIL: shootboard_list_entries'in `until`
# alani "at most 90 days after since" diyor. Daha genis bir aralik
# istenirse uc hata doner.
PENCERE_GUN = 90
SAYFA = 500                   # aracin izin verdigi en buyuk limit


def story_yukleyiciyi_al():
    """story-yukle.py'yi ice aktar. Ad tire icerdigi icin duz import olmuyor."""
    yol = os.path.join(BURASI, 'story-yukle.py')
    if not os.path.isfile(yol):
        sys.exit(f"story-yukle.py bulunamadi: {yol}\n"
                 f"Iki script ayni klasorde durmali (ayarlar oradan geliyor).")
    spec = importlib.util.spec_from_file_location('story_yukle', yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class Sunucu:
    """MCP ucuna JSON-RPC cagrisi. Yalnizca okuma araclari cagriliyor."""

    def __init__(self, kok, anahtar):
        self.kok = kok.rstrip('/')
        self.anahtar = anahtar
        self.sira = 0

    def arac(self, ad, **arg):
        self.sira += 1
        govde = {'jsonrpc': '2.0', 'id': self.sira, 'method': 'tools/call',
                 'params': {'name': ad, 'arguments': arg}}
        r = requests.post(self.kok, json=govde, timeout=60, headers={
            'authorization': f'Bearer {self.anahtar}',
            'content-type': 'application/json'})
        try:
            veri = r.json()
        except Exception:
            sys.exit(f"{ad}: sunucu JSON dondurmedi ({r.status_code}).\n"
                     f"{r.text[:300]}")
        if isinstance(veri, list):
            veri = veri[0] if veri else {}
        if veri.get('error'):
            sys.exit(f"{ad}: {veri['error'].get('message', veri['error'])}")
        sonuc = (veri.get('result') or {}).get('structuredContent')
        if sonuc is None:
            sys.exit(f"{ad}: beklenen cevap gelmedi.\n{str(veri)[:300]}")
        if sonuc.get('ok') is False:
            sys.exit(f"{ad}: {sonuc.get('error') or sonuc}")
        return sonuc


def pencereler(bas, son):
    """[bas, son] arasini en fazla PENCERE_GUN'luk dilimlere boler."""
    while bas <= son:
        bit = min(bas + datetime.timedelta(days=PENCERE_GUN - 1), son)
        yield bas, bit
        bas = bit + datetime.timedelta(days=1)


def kayitlari_topla(s):
    """Butun kayitlar. Pencere pencere, sayfa sayfa; id'ye gore tekil.

    ⚠ TEKILLESTIRME SART. Pencere sinirlari ve sayfalama ust uste
    binebiliyor; ayni kaydi iki kez yazmak yedegi okunmaz yapardi.
    """
    son_tarih = datetime.date.today() + datetime.timedelta(days=SON_TARIH_PAYI)
    gorulen, hepsi = set(), []
    for bas, bit in pencereler(ILK_TARIH, son_tarih):
        imlec, sayfa = None, 0
        while True:
            arg = {'since': bas.isoformat(), 'until': bit.isoformat(), 'limit': SAYFA}
            if imlec:
                arg['cursor'] = imlec
            cevap = s.arac('shootboard_list_entries', **arg)
            yeni = 0
            for k in cevap.get('entries') or []:
                kimlik = k.get('id')
                if kimlik and kimlik in gorulen:
                    continue
                if kimlik:
                    gorulen.add(kimlik)
                hepsi.append(k)
                yeni += 1
            sayfa += 1
            imlec = cevap.get('nextCursor')
            if not imlec:
                break
            # Sonsuz donguye karsi: imlec donuyor ama yeni kayit
            # gelmiyorsa durmak, sonsuza kadar istek atmaktan iyi.
            if yeni == 0:
                break
        print(f"  {bas} .. {bit}  ->  toplam {len(hepsi)} kayit", flush=True)
    return hepsi


def main():
    ap = argparse.ArgumentParser(
        description="Shootboard takvimini diske yedekler (salt okur).")
    ap.add_argument('--klasor', default=os.environ.get('SHOOTBOARD_YEDEK_KLASOR')
                    or VARSAYILAN_KLASOR,
                    help=f"Yedeklerin yazilacagi klasor. Varsayilan: {VARSAYILAN_KLASOR}")
    a = ap.parse_args()

    sy = story_yukleyiciyi_al()
    kok = sy.ayar('SHOOTBOARD_MCP_URL')
    anahtar = sy.ayar('SHOOTBOARD_KEY')
    s = Sunucu(kok, anahtar)

    os.makedirs(a.klasor, exist_ok=True)
    basladi = time.time()

    print("\nKayitlar aliniyor...")
    kayitlar = kayitlari_topla(s)
    print("\nProjeler aliniyor...")
    projeler = (s.arac('shootboard_list_projects').get('projects') or [])
    print(f"  {len(projeler)} proje")

    # ⚠ BOS YEDEK YAZILMIYOR. Ag yarida koparsa ya da anahtar iptal
    # edilmisse elde bos bir dosya kalirdi; o dosya "yedegim var"
    # yanilsamasi verir ve bir oncekinin uzerine de yazabilirdi.
    if not kayitlar:
        sys.exit("\nHIC KAYIT GELMEDI. Yedek YAZILMADI -- bos bir dosya,\n"
                 "yedek olmamasindan kotudur. Baglantiyi ve anahtari kontrol et.")

    # ⚠ SANIYE DE VAR, SUS DEGIL. Dakika hassasiyetiyle ayni dakika
    # icinde iki kez kosmak AYNI dosya adini uretiyordu ve ikinci yedek
    # birincinin USTUNE yaziyordu -- "eski yedekler silinmiyor" sozu tam
    # da yedek almaya en cok ihtiyac duyulan anda (arka arkaya denemeler)
    # tutulmazdi. Testte yakalandi.
    damga = time.strftime('%Y-%m-%d_%H%M%S')
    yol = os.path.join(a.klasor, f'shootboard-yedek-{damga}.json')
    govde = {
        'alindi': datetime.datetime.now().isoformat(timespec='seconds'),
        'kaynak': kok,
        'kayit_sayisi': len(kayitlar),
        'proje_sayisi': len(projeler),
        'projeler': projeler,
        'kayitlar': kayitlar,
    }
    gecici = yol + '.tmp'
    with open(gecici, 'w', encoding='utf-8') as f:
        json.dump(govde, f, ensure_ascii=False, indent=1)
    # ⚠ ONCE GECICIYE, SONRA YERINE TASI. Yazarken kesilen bir islem
    # yarim bir JSON birakirdi ve bu yarim dosya, en cok ihtiyac
    # duyuldugu gun okunamazdi.
    os.replace(gecici, yol)

    # Yazdigimizi GERI OKUYUP sayiyoruz: "yazdim" demek, "yazildi"
    # demek degil. Diski dolu bir makinede fark ancak burada cikar.
    with open(yol, encoding='utf-8') as f:
        geri = json.load(f)
    if len(geri.get('kayitlar') or []) != len(kayitlar):
        sys.exit(f"\nDOSYA DOGRULANAMADI: {len(kayitlar)} yazildi, "
                 f"{len(geri.get('kayitlar') or [])} geri okundu. {yol}")

    mb = os.path.getsize(yol) / 1048576
    print(f"\nYEDEK TAMAM  {yol}")
    print(f"  {len(kayitlar)} kayit, {len(projeler)} proje, "
          f"{mb:.1f} MB, {time.time() - basladi:.0f} sn")

    eskiler = sorted(x for x in os.listdir(a.klasor)
                     if x.startswith('shootboard-yedek-') and x.endswith('.json'))
    print(f"  klasorde toplam {len(eskiler)} yedek "
          f"(en eskisi: {eskiler[0][18:28] if eskiler else '-'})")
    # ⚠ ESKI YEDEKLER SILINMIYOR. Bir bozulma haftalar sonra fark
    # edilebiliyor; "son 3 yedegi tut" kurali tam o durumda ise
    # yarayacak dosyayi silerdi. Dosyalar kucuk; yer sorun olursa
    # kullanici elle siler.


if __name__ == '__main__':
    main()
