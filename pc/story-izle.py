#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render klasorunu izler, yeni story dosyasini kendiliginden yukler.

    python story-izle.py                 surekli izle
    python story-izle.py --bir-kez       tek tur at ve cik

`story-yukle.py`'nin elle calistirilan halini sarmalar: ayni yukleme,
ayni adres denemesi, ayni kayit baglama. Fark, dosyayi senin
soylemen yerine klasorde belirmesinden anlamasi.

    E:\\CLAUDE VIDEOS\\story\\cikti\\2026-09-22_story_balikli_k1.mp4
        -> R2'ye yuklenir
        -> Shootboard'daki 2026-09-22 tarihli story kaydina baglanir
        -> autoPublish acilir, worker zamani gelince yayinlar

KURULUM
    pip install boto3 requests
  story-yukle.py ile AYNI KLASORDE durmali; ortam degiskenleri de ayni
  (SHOOTBOARD_MCP_URL, SHOOTBOARD_KEY, R2_*). Ek olarak:

    STORY_KLASOR   izlenecek klasor
                   varsayilan: E:\\CLAUDE VIDEOS\\story\\cikti

SUREKLI CALISTIRMAK
  Ya bu pencereyi acik birak, ya da Windows Gorev Zamanlayici'ya
  `--bir-kez` ile bes dakikada bir koy. Ikincisi daha saglam: bilgisayar
  yeniden baslasa da is devam eder, unutulmus bir pencereye bagli kalmaz.

ISLENENLER DEFTERI
  Klasorde `.shootboard-defter.json` tutuluyor: hangi dosya ne zaman
  yuklendi. Ayni dosya iki kez yuklenmiyor. Dosya yeniden render
  edilirse (boyut ya da tarih degisirse) yeniden yukleniyor -- duzeltilmis
  bir render'in eskisiyle yer degistirmesi beklenen bir sey.

⛔ BU SCRIPT DE `uploaded` ALANINA DOKUNMUYOR
  Sartname Bolum 1. Yukleme story-yukle.py uzerinden yapiliyor ve orada
  da uploaded gecmiyor. Buraya da hic girmedi.
"""
import os
import sys
import json
import time
import argparse
import importlib.util

BURASI = os.path.dirname(os.path.abspath(__file__))
DEFTER_ADI = '.shootboard-defter.json'
# Render dosyayi yazarken almamak icin: boyut iki olcumde ayni kalmali.
DURULMA_SN = 6
TUR_ARASI_SN = 60


def yukleyiciyi_al():
    """story-yukle.py'yi ice aktar. Ad tire icerdigi icin duz import olmuyor."""
    yol = os.path.join(BURASI, 'story-yukle.py')
    if not os.path.isfile(yol):
        sys.exit(f"story-yukle.py bulunamadi: {yol}\n"
                 f"Iki script ayni klasorde durmali.")
    spec = importlib.util.spec_from_file_location('story_yukle', yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def defter_oku(klasor):
    try:
        with open(os.path.join(klasor, DEFTER_ADI), encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def defter_yaz(klasor, defter):
    gecici = os.path.join(klasor, DEFTER_ADI + '.tmp')
    try:
        with open(gecici, 'w', encoding='utf-8') as f:
            json.dump(defter, f, ensure_ascii=False, indent=1)
        os.replace(gecici, os.path.join(klasor, DEFTER_ADI))
    except Exception as e:
        # Defter yazilamazsa ayni dosya bir daha yuklenebilir. Sessiz
        # gecmiyoruz: cift yayin degil ama cift yukleme demek.
        print(f"  ! defter yazilamadi: {e}")


def imza(yol):
    d = os.stat(yol)
    return f"{d.st_size}:{int(d.st_mtime)}"


def durdu_mu(yol):
    """Render hala yaziyor mu? Iki olcum arasinda boyut degisiyorsa evet."""
    try:
        ilk = os.path.getsize(yol)
    except OSError:
        return False
    time.sleep(DURULMA_SN)
    try:
        return os.path.getsize(yol) == ilk and ilk > 0
    except OSError:
        return False


def bir_tur(yukleyici, klasor, otomatik_ac, zorla):
    defter = defter_oku(klasor)
    try:
        adlar = sorted(os.listdir(klasor))
    except OSError as e:
        print(f"Klasor okunamadi: {klasor}\n{e}")
        return

    yeni = 0
    for ad in adlar:
        if ad.startswith('.'):
            continue
        yol = os.path.join(klasor, ad)
        if not os.path.isfile(yol):
            continue
        if os.path.splitext(ad)[1].lower() not in yukleyici.IZINLI_TUR:
            continue

        simdiki = imza(yol)
        onceki = defter.get(ad, {})
        if onceki.get('imza') == simdiki and onceki.get('durum') == 'baglandi':
            continue

        if not durdu_mu(yol):
            print(f"{ad}: hala yaziliyor, sonraki tura birakildi")
            continue
        # Bekleme sirasinda dosya degismis olabilir.
        simdiki = imza(yol)

        yeni += 1
        print(f"\n=== {ad}")
        try:
            sonuc = dosyayi_isle(yukleyici, yol, ad, otomatik_ac, zorla)
        except SystemExit as e:
            # story-yukle.py hatalarda sys.exit ediyor; izleyici olmemeli.
            sonuc = ('hata', str(e))
        except Exception as e:
            sonuc = ('hata', f"{type(e).__name__}: {e}")

        durum, not_ = sonuc
        print(f"  -> {durum}: {not_}")
        # BASARISIZ OLAN DEFTERE 'baglandi' DIYE YAZILMIYOR: en sik hata
        # "kayit henuz yok" ve bu gecici -- takvim kaydi acildigi anda
        # bir sonraki tur dosyayi bulur. Kalici saymak, kullanicinin
        # dosyayi silip yeniden koymasini gerektirirdi.
        defter[ad] = {'imza': simdiki, 'durum': durum, 'not': not_,
                      'zaman': time.strftime('%Y-%m-%d %H:%M:%S')}
        defter_yaz(klasor, defter)

    if not yeni:
        print(f"[{time.strftime('%H:%M:%S')}] yeni dosya yok")


def dosyayi_isle(y, yol, ad, otomatik_ac, zorla):
    boyut = os.path.getsize(yol)
    mime = y.tur_bul(yol)          # desteklenmeyen turde sys.exit eder
    if boyut > y.EN_BUYUK:
        return ('hata', f"{boyut / 1048576:.0f} MB -- Instagram siniri 100 MB")

    kok = y.ayar('SHOOTBOARD_MCP_URL').rstrip('/')
    anahtar = y.ayar('SHOOTBOARD_KEY')

    # ONCE KAYDI ARA, SONRA YUKLE. story-yukle.py'de sira tersi ve orada
    # dogru: insan bir dosyayi elle verirken kaydin var oldugunu bilir.
    # Izleyicide bilmiyoruz -- render, takvim kaydindan once bitebilir.
    # Once yukleseydik, kayit acilana kadar her turda R2'ye ayni dosyayi
    # bir daha koyardik.
    try:
        kayit_id = y.kaydi_bul(kok, anahtar, ad)
    except SystemExit as e:
        # sys.exit(1) SystemExit(1) uretiyor; str() alinirsa ekrana "1"
        # yaziliyor ve hicbir sey anlatmiyor. Metin varsa o, yoksa
        # anlasilir bir cumle.
        kod = e.code
        return ('kayit-yok', kod if isinstance(kod, str) and kod.strip()
                else 'o tarihte story kaydi yok, ya da birden cok aday var '
                     '(yukaridaki listeye bak, --id ile elle bagla)')

    url = y.r2_yukle(yol, ad, mime)
    print(f"  adres: {url}")
    sorunlar = y.adresi_dene(url, mime, boyut)
    if sorunlar:
        print("  ADRES SORUNLU:")
        for s in sorunlar:
            print(f"    · {s}")
        if not zorla:
            return ('adres-sorunlu', '; '.join(sorunlar))
        print("  (--zorla verildi, devam ediliyor)")

    kayit = y.kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad, otomatik_ac)
    return ('baglandi', f"{kayit['id']} · yayin {kayit.get('publishAt') or '?'} · "
                        f"otomatik {'ACIK' if kayit.get('autoPublish') else 'kapali'}")


def main():
    ap = argparse.ArgumentParser(description="Render klasorunu izler, yeni story dosyalarini Shootboard'a baglar.")
    ap.add_argument('--klasor', help="Izlenecek klasor. Varsayilan STORY_KLASOR ortam degiskeni.")
    ap.add_argument('--bir-kez', action='store_true', help="Tek tur at ve cik (Gorev Zamanlayici icin).")
    ap.add_argument('--otomatik-acma', action='store_true', help="autoPublish'i ACMA, elle acacaksan.")
    ap.add_argument('--zorla', action='store_true', help="Adres denemesi sorun bulsa da devam et.")
    ap.add_argument('--aralik', type=int, default=TUR_ARASI_SN, help="Turlar arasi saniye (varsayilan 60).")
    a = ap.parse_args()

    klasor = a.klasor or os.environ.get('STORY_KLASOR', r'E:\CLAUDE VIDEOS\story\cikti')
    if not os.path.isdir(klasor):
        sys.exit(f"Klasor yok: {klasor}\n"
                 f"--klasor ile ver ya da STORY_KLASOR ortam degiskenini ayarla.")

    yukleyici = yukleyiciyi_al()
    print(f"Izlenen klasor: {klasor}")
    print(f"Desteklenen turler: {', '.join(sorted(yukleyici.IZINLI_TUR))}")

    if a.bir_kez:
        bir_tur(yukleyici, klasor, not a.otomatik_acma, a.zorla)
        return

    print(f"Her {a.aralik} saniyede bir bakilacak. Durdurmak icin Ctrl+C.\n")
    try:
        while True:
            bir_tur(yukleyici, klasor, not a.otomatik_acma, a.zorla)
            time.sleep(a.aralik)
    except KeyboardInterrupt:
        print("\nDurduruldu.")


if __name__ == '__main__':
    main()
