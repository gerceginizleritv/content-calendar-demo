#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Threads teslim klasorunu izler, yeni gorseli kendiliginden yukler.

    python threads-izle.py                 surekli izle
    python threads-izle.py --bir-kez       tek tur at ve cik

    E:\\CLAUDE VIDEOS\\TESLIM\\THREADS\\2026-10-17_threads_sumela.jpg
        -> R2'ye yuklenir
        -> Shootboard'daki 2026-10-17 tarihli threads kaydina baglanir
        -> autoPublish acilir, worker zamani gelince yayinlar

NEDEN AYRI BIR IZLEYICI (16 Ekim 2026)
  story-izle.py ile ayni isi yapmiyor:
    · Threads gonderisi GORSEL ya da duz metin; VIDEO yok. Worker'in
      Threads yolu yalnizca IMAGE ve TEXT kapsayicisi yaratiyor.
    · Boyut siniri bambaska: Threads gorselde 8 MB, story'de 100 MB.
      Ayni dosya story'de gecer, Threads'te reddedilir.
    · Klasor ayri, Gorev Zamanlayici isi ayri.
  Kullanici 16 Ekim 2026'da "uc izleyici birbirinden tamamen ayri
  olsun" dedi; paylasilan tek izleyici teklifi bu yuzden kullanilmadi.

  ⚠ PAYLASILAN TEK SEY YUKLEYICI: story-yukle.py. Uc izleyici de ONU
  cagiriyor ve bu KASITLI -- R2'ye yukleme, adres denemesi, kayit
  baglama ve OTOMATIK YAYIN POLITIKASI tek yerde duruyor. O politikayi
  kopyalamak, bu projenin en pahali hatasinin (ayni kararin bes yerde
  yazili olmasi) bir ornegini daha uretmek olurdu.

GORSEL SINIRLARI — META'NIN BELGESINDEN (16 Ekim 2026'da okundu)
  JPEG ve PNG; en fazla 8 MB; en-boy orani en cok 10:1; genislik
  320-1440 piksel arasina ölceklenir.
    https://developers.facebook.com/docs/threads/create-posts
  Burada YALNIZCA tur ve boyut olculuyor. En-boy orani olculmuyor:
  olcmek icin bir goruntu kutuphanesi (Pillow) gerekir ve bu scriptin
  bagimliligi yok. Orani asan bir gorseli Threads kendi reddediyor ve
  o zaman kapsayici ERROR donuyor -- worker bunu KALICI hata yazip
  e-posta gonderiyor, yani sessiz kalmiyor.

ISLENENLER DEFTERI
  Klasorde `.shootboard-threads-defter.json` tutuluyor. story ve reels
  defterlerinden AYRI dosya: ayni klasor iki izleyici tarafindan
  izlenirse defterler birbirini ezmesin.

  Ayni dosya iki kez yuklenmiyor. Dosya yeniden uretilirse (boyut ya da
  tarih degisirse) yeniden yukleniyor -- duzeltilmis bir gorselin
  eskisiyle yer degistirmesi beklenen bir sey.

⛔ BU SCRIPT DE `uploaded` ALANINA DOKUNMUYOR
  Sartname Bolum 1. Yukleme story-yukle.py uzerinden yapiliyor ve orada
  da uploaded gecmiyor. Buraya da hic girmedi.

KURULUM
    pip install boto3 requests
  story-yukle.py ile AYNI KLASORDE durmali; ortam degiskenleri de ayni
  (SHOOTBOARD_MCP_URL, SHOOTBOARD_KEY, R2_*). Ek olarak:

    THREADS_KLASOR   izlenecek klasor
                     varsayilan: E:\\CLAUDE VIDEOS\\TESLIM\\THREADS

SUREKLI CALISTIRMAK
  Windows Gorev Zamanlayici'ya `--bir-kez` ile bes dakikada bir koy.
  story-izle.py ve reels-izle.py'den AYRI bir gorev olarak: klasorler
  ve kurallar ayri. Sarmalayici: threads-izle.bat
"""
import os
import sys
import json
import time
import argparse
import importlib.util

BURASI = os.path.dirname(os.path.abspath(__file__))
DEFTER_ADI = '.shootboard-threads-defter.json'
# Dosya yazilirken almamak icin: boyut iki olcumde ayni kalmali.
DURULMA_SN = 6
TUR_ARASI_SN = 60
VARSAYILAN_KLASOR = r'E:\CLAUDE VIDEOS\TESLIM\THREADS'

# ⚠ KENDI SINIRI, YUKLEYICININ SINIRI DEGIL. story-yukle.py'de
# EN_BUYUK 100 MB (Instagram story siniri) ve IZINLI_TUR videoyu da
# kabul ediyor. Threads'te ikisi de yanlis olur: video gitmiyor, 8 MB
# ustu gorsel reddediliyor. Yukleyiciyi degistirmek story hattini
# bozardi, o yuzden sinir BURADA.
EN_BUYUK = 8 * 1024 * 1024
IZINLI_TUR = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}


def modul_al(dosya_adi, modul_adi):
    """Tire iceren dosya adlari duz import olmuyor."""
    yol = os.path.join(BURASI, dosya_adi)
    if not os.path.isfile(yol):
        sys.exit(f"{dosya_adi} bulunamadi: {yol}\nScriptler ayni klasorde durmali.")
    spec = importlib.util.spec_from_file_location(modul_adi, yol)
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
    """Dosya hala yaziliyor mu? Iki olcum arasinda boyut degisiyorsa evet."""
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
        uzanti = os.path.splitext(ad)[1].lower()
        # ⚠ ATLAMA SESSIZ DEGIL. Threads'e video gitmiyor; klasore bir
        # .mp4 dusmusse kullanici onu yayinlanacak saniyor. Sebebi
        # yazilmazsa dosya sonsuza kadar orada bekler.
        if uzanti not in IZINLI_TUR:
            if uzanti in getattr(yukleyici, 'IZINLI_TUR', {}):
                print(f"{ad}: Threads gorsel ya da metin kabul ediyor, video degil "
                      f"-- atlandi (reels ise reels klasorune koy)")
            continue
        # ⚠ KLASOR TEK BASINA TURU BELIRLEMIYOR. story-izle.py'deki
        # ayni koruma: 7 Ekim 2026'da story klasorune dusen dokuz reels
        # dosyasi story sanilmisti. Simetrigi burada da duruyor.
        if yukleyici.ad_turu(ad) in ('story', 'reels'):
            print(f"{ad}: {yukleyici.ad_turu(ad)} dosyasi, Threads klasorunde "
                  f"-- atlandi (kendi izleyicisi kendi klasorunden isliyor)")
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
            sonuc = dosyayi_isle(yukleyici, yol, ad, otomatik_ac, zorla,
                                 onceki if onceki.get('imza') == simdiki else {})
        except SystemExit as e:
            # story-yukle.py hatalarda sys.exit ediyor; izleyici olmemeli.
            # ⚠ str(e) DEGIL: sys.exit(1) icin ekrana "1" yazar ve
            # hicbir sey anlatmaz. Metin varsa o, yoksa anlasilir cumle.
            kod = e.code
            sonuc = ('hata', kod if isinstance(kod, str) and kod.strip()
                     else 'yukleyici durdu', {})
        except Exception as e:
            sonuc = ('hata', f"{type(e).__name__}: {e}", {})

        durum, not_, sonuc_ek = sonuc
        print(f"  -> {durum}: {not_}")
        # BASARISIZ OLAN DEFTERE 'baglandi' DIYE YAZILMIYOR: en sik hata
        # "kayit henuz yok" ve bu gecici -- takvim kaydi acildigi anda
        # bir sonraki tur dosyayi bulur.
        girdi = {'imza': simdiki, 'durum': durum, 'not': not_,
                 'zaman': time.strftime('%Y-%m-%d %H:%M:%S')}
        # ⚠ YUKLENEN ADRES SAKLANIYOR, DURUM NE OLURSA OLSUN. Adres
        # defterde durdugu surece imzasi ayni dosya ikinci kez
        # yuklenmiyor; hata gecici oldugunda tur bedava tekrarlaniyor.
        if sonuc_ek.get('url'):
            girdi['url'] = sonuc_ek['url']
        defter[ad] = girdi
        defter_yaz(klasor, defter)

    if not yeni:
        print(f"[{time.strftime('%H:%M:%S')}] yeni dosya yok")

    # Yayinlanmis dosyalari R2'den kaldir. Threads'te kapak yok, tek nesne.
    # ⚠ YAYINDAN SONRA SILINIYOR, ONCE DEGIL: Threads gorseli yayin
    # aninda adresten kendisi cekiyor.
    yukleyici.temizlik_turu(klasor, defter, defter_yaz, lambda ad, kayit: [ad])


def dosyayi_isle(y, yol, ad, otomatik_ac, zorla, onceki=None):
    onceki = onceki or {}
    ek = {}
    boyut = os.path.getsize(yol)
    mime = IZINLI_TUR[os.path.splitext(ad)[1].lower()]
    if boyut > EN_BUYUK:
        return ('hata', f"{boyut / 1048576:.1f} MB -- Threads gorsel siniri 8 MB. "
                        f"Once kucult, sonra klasore koy.", ek)
    if boyut == 0:
        return ('hata', 'dosya bos', ek)

    kok = y.ayar('SHOOTBOARD_MCP_URL').rstrip('/')
    anahtar = y.ayar('SHOOTBOARD_KEY')

    # ONCE KAYDI ARA, SONRA YUKLE. story-yukle.py'de sira tersi ve orada
    # dogru: insan bir dosyayi elle verirken kaydin var oldugunu bilir.
    # Izleyicide bilmiyoruz -- gorsel, takvim kaydindan once hazir
    # olabilir. Once yukleseydik, kayit acilana kadar her turda R2'ye
    # ayni dosyayi bir daha koyardik.
    try:
        kayitlar = y.kaydi_bul(kok, anahtar, ad, None, 'metin postu')
    except SystemExit as e:
        kod = e.code
        return ('kayit-yok', kod if isinstance(kod, str) and kod.strip()
                else 'o tarihte Threads kaydi yok, ya da birden cok aday var '
                     '(kayda dosya adini yaz, ya da --id ile elle bagla)', ek)

    # ⚠ PLATFORM SUZGECI -- 16 EKIM 2026, OLCULEN BIR ACIK.
    # kaydi_bul dosya adi tutmazsa TARIHE dusuyor ve tarih aramasi
    # platforma BAKMIYOR: o gun hangi platformda kayit varsa hepsi aday.
    # 25 Ekim icin on aday dondu (instagram, facebook, youtube, tiktok)
    # ve hicbiri threads degildi.
    #
    # O gun zarar olmadi cunku aday BIRDEN COKKEN yukleyici durup
    # soruyor. Tehlike TEK aday halinde: izleyici "demek ki bu" deyip
    # Threads gorselini ornegin bir Instagram story kaydina baglar ve
    # politika geregi ONUN tikini acar -- Threads icin hazirlanan gorsel
    # Instagram'a story olarak cikardi. Geri alinamaz bir yanlis yayin.
    #
    # ⚠ SUZGEC YUKLEMEDEN ONCE: kaydi_bul yuklemeden once cagriliyor,
    # yani yanlis gunde R2'ye tek bir bayt gitmiyor.
    #
    # Bu izleyici --id kabul etmiyor, yani her aday uctan geliyor ve
    # platformu yazili. (Elle secimde platform bilinmez ve suzgec
    # calismaz; orada secimi insan yapiyor, politika denetimi de
    # kayda_yaz'in icinde duruyor.)
    uygun = [a for a in kayitlar
             if str(a.get('platform') or '').lower() == 'threads'
             and str(a.get('type') or '').lower() == 'text_post']
    if not uygun:
        gorulen = sorted({str(a.get('platform') or '?') for a in kayitlar})
        return ('kayit-yok',
                f"{len(kayitlar)} aday var ama hicbiri Threads metin postu degil "
                f"({', '.join(gorulen)}). Kayda dosya adini yaz ya da Threads "
                f"kaydini olustur; bu gorsel baska platforma BAGLANMADI.", ek)
    if len(uygun) < len(kayitlar):
        print(f"  ({len(kayitlar)} adaydan {len(uygun)} tanesi Threads; otekiler atlandi)")
    kayitlar = uygun

    # `onceki` yalnizca imza AYNI ise doluyor (cagiran oyle veriyor);
    # dosya degismediyse R2'deki nesne de ayni, ikinci yukleme bos is.
    if onceki.get('url'):
        url = onceki['url']
        print(f"  adres (gecen turdan): {url}")
    else:
        url = y.r2_yukle(yol, ad, mime)
        print(f"  adres: {url}")
    ek['url'] = url
    sorunlar = y.adresi_dene(url, mime, boyut)
    if sorunlar:
        print("  ADRES SORUNLU:")
        for s in sorunlar:
            print(f"    · {s}")
        if not zorla:
            return ('adres-sorunlu', '; '.join(sorunlar), ek)
        print("  (--zorla verildi, devam ediliyor)")

    # ⚠ BIR KAYIT DUSERSE DONGU DEVAM EDIYOR. 27 Eylul 2026'da reels
    # hattinda kayda_yaz'in sys.exit'i turu ortada birakti: biri
    # baglanmis, oteki baglanmamisti ve hangisi oldugu hicbir yerde
    # yazmiyordu.
    notlar, basarisiz = [], []
    for aday in kayitlar:
        kayit_id = aday['id']
        # Otomatik yayin karari KAYIT BASINA ve politika TEK YERDE:
        # story-yukle.py'deki OTOMATIK_YAYIN tablosu.
        oto = y.otomatik_mi(aday.get('platform'), aday.get('type'), otomatik_ac)
        try:
            kayit = y.kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad, oto)
        except SystemExit as e:
            kod = e.code
            basarisiz.append(f"{kayit_id} KAYDA YAZILAMADI: " +
                             (kod if isinstance(kod, str) and kod.strip() else 'yukleyici durdu'))
            continue
        except Exception as e:
            basarisiz.append(f"{kayit_id} KAYDA YAZILAMADI: {type(e).__name__}: {e}")
            continue
        notlar.append(f"{kayit.get('platform') or '?'} {kayit['id']} · "
                      f"yayin {kayit.get('publishAt') or '?'} · "
                      f"otomatik {'ACIK' if kayit.get('autoPublish') else 'kapali'}")
    if basarisiz:
        return ('eksik-baglanti',
                f"{len(notlar)}/{len(kayitlar)} yazildi · " + ' | '.join(basarisiz), ek)
    return ('baglandi', ' | '.join(notlar), ek)


def main():
    ap = argparse.ArgumentParser(
        description="Threads teslim klasorunu izler, yeni gorselleri Shootboard'a baglar.")
    ap.add_argument('--klasor', help="Izlenecek klasor. Varsayilan THREADS_KLASOR ortam degiskeni.")
    ap.add_argument('--bir-kez', action='store_true', help="Tek tur at ve cik (Gorev Zamanlayici icin).")
    ap.add_argument('--otomatik-acma', action='store_true', help="autoPublish'i ACMA, elle acacaksan.")
    ap.add_argument('--zorla', action='store_true', help="Adres denemesi sorun bulsa da devam et.")
    ap.add_argument('--aralik', type=int, default=TUR_ARASI_SN, help="Turlar arasi saniye (varsayilan 60).")
    a = ap.parse_args()

    klasor = a.klasor or os.environ.get('THREADS_KLASOR', VARSAYILAN_KLASOR)
    if not os.path.isdir(klasor):
        sys.exit(f"Klasor yok: {klasor}\n"
                 f"--klasor ile ver ya da THREADS_KLASOR ortam degiskenini ayarla.")

    yukleyici = modul_al('story-yukle.py', 'story_yukle')
    print(f"Izlenen klasor: {klasor}")
    print(f"Desteklenen turler: {', '.join(sorted(IZINLI_TUR))}  (sinir 8 MB)")

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
