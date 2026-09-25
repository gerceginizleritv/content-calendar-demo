#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reels teslim klasorunu izler, yeni reel'i kapagiyla birlikte yukler.

    python reels-izle.py                 surekli izle
    python reels-izle.py --bir-kez       tek tur at ve cik

    E:\\CLAUDE VIDEOS\\TESLIM\\REELS_V2\\2026-10-12_reels_sokollu.mp4
    E:\\CLAUDE VIDEOS\\TESLIM\\REELS_V2\\2026-10-12_reels_sokollu.jpg
        -> ikisi de R2'ye yuklenir
        -> 2026-10-12 tarihli reels kaydina baglanir (mediaUrl + coverUrl)
        -> autoPublish acilir, worker zamani gelince yayinlar

NEDEN AYRI BIR IZLEYICI
  story-izle.py ile ayni isi yapmiyor:
    · Reels VIDEO olmak zorunda; story fotograf da olabiliyor.
    · Boyut siniri farkli (1 GB / 100 MB).
    · Kapak var: klasorde iki dosya BIR ISE karsilik geliyor.
  Tek izleyiciye sigdirmak, her dosyada "bu hangi kurala tabi" diye
  sormak demekti. Ayri klasor, ayri kural, ayri gorev.

⚠ KAPAK DOSYALARI TEK BASINA YUKLENMIYOR
  Izleyici YALNIZCA videolari donuyor. Kapak, videonun kokunden
  bulunuyor. Aksi halde klasordeki her .jpg bir kayit arar, bulamaz ve
  her turda "kayit yok" diye tekrar denerdi.

ISLENENLER DEFTERI
  Klasorde `.shootboard-reels-defter.json` tutuluyor. story izleyicisi
  ile AYRI dosya: ayni klasor iki izleyici tarafindan izlenirse
  defterler birbirini ezmesin.

  Defter IMZAYI videodan VE kapaktan birlikte aliyor. Yalnizca video
  imzasina bakilsaydi, kapagi sonradan eklenen ya da duzeltilen bir
  reel yeniden yuklenmez ve kapak hic gitmezdi.

⛔ BU SCRIPT DE `uploaded` ALANINA DOKUNMUYOR
  Sartname Bolum 1.

KURULUM
  reels-yukle.py ve story-yukle.py ile AYNI KLASORDE durmali; ortam
  degiskenleri de ayni. Ek olarak:

    REELS_KLASOR   izlenecek klasor
                   varsayilan: E:\\CLAUDE VIDEOS\\TESLIM\\REELS_V2

SUREKLI CALISTIRMAK
  Windows Gorev Zamanlayici'ya `--bir-kez` ile bes dakikada bir koy.
  story-izle.py'den AYRI bir gorev olarak: klasorler ve kurallar ayri.
"""
import os
import sys
import json
import time
import argparse
import importlib.util

BURASI = os.path.dirname(os.path.abspath(__file__))
DEFTER_ADI = '.shootboard-reels-defter.json'
# Render dosyayi yazarken almamak icin: boyut iki olcumde ayni kalmali.
DURULMA_SN = 6
TUR_ARASI_SN = 60
VARSAYILAN_KLASOR = r'E:\CLAUDE VIDEOS\TESLIM\REELS_V2'


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
        print(f"  ! defter yazilamadi: {e}")


def imza(yol):
    d = os.stat(yol)
    return f"{d.st_size}:{int(d.st_mtime)}"


def cift_imza(video_yolu, kapak_yolu):
    """Video + kapak birlikte. Kapak degisirse imza da degisiyor."""
    v = imza(video_yolu)
    return v if not kapak_yolu else f"{v}|{imza(kapak_yolu)}"


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


def videolar(klasor, ry):
    """Klasordeki VIDEO dosyalari. Kapaklar buraya girmiyor."""
    try:
        adlar = sorted(os.listdir(klasor))
    except OSError as e:
        print(f"Klasor okunamadi: {klasor}\n{e}")
        return None
    cikti = []
    for ad in adlar:
        if ad.startswith('.'):
            continue
        yol = os.path.join(klasor, ad)
        if not os.path.isfile(yol):
            continue
        if os.path.splitext(ad)[1].lower() not in ry.IZINLI_TUR:
            continue
        cikti.append((ad, yol))
    return cikti


def bir_tur(ry, sy, klasor, otomatik_ac, zorla):
    defter = defter_oku(klasor)
    liste = videolar(klasor, ry)
    if liste is None:
        return

    yeni = 0
    for ad, yol in liste:
        kapak_yolu, kapak_mime = ry.kapagi_bul(yol)
        simdiki = cift_imza(yol, kapak_yolu)
        onceki = defter.get(ad, {})
        if onceki.get('imza') == simdiki and onceki.get('durum') == 'baglandi':
            continue

        if not durdu_mu(yol):
            print(f"{ad}: hala yaziliyor, sonraki tura birakildi")
            continue
        if kapak_yolu and not durdu_mu(kapak_yolu):
            print(f"{ad}: kapagi hala yaziliyor, sonraki tura birakildi")
            continue
        # Bekleme sirasinda dosyalar degismis olabilir.
        kapak_yolu, kapak_mime = ry.kapagi_bul(yol)
        simdiki = cift_imza(yol, kapak_yolu)

        yeni += 1
        print(f"\n=== {ad}" + (f"  (+ {os.path.basename(kapak_yolu)})" if kapak_yolu else "  (kapaksiz)"))
        try:
            sonuc = dosyayi_isle(ry, sy, yol, ad, kapak_yolu, kapak_mime, otomatik_ac, zorla)
        except SystemExit as e:
            # yukleyiciler hatalarda sys.exit ediyor; izleyici olmemeli.
            kod = e.code
            sonuc = ('hata', kod if isinstance(kod, str) and kod.strip() else 'yukleyici durdu')
        except Exception as e:
            sonuc = ('hata', f"{type(e).__name__}: {e}")

        durum, not_ = sonuc
        print(f"  -> {durum}: {not_}")
        # BASARISIZ OLAN DEFTERE 'baglandi' DIYE YAZILMIYOR: en sik hata
        # "kayit henuz yok" ve bu gecici -- takvim kaydi acildigi anda
        # bir sonraki tur dosyayi bulur.
        defter[ad] = {'imza': simdiki, 'durum': durum, 'not': not_,
                      'kapak': os.path.basename(kapak_yolu) if kapak_yolu else '',
                      'zaman': time.strftime('%Y-%m-%d %H:%M:%S')}
        defter_yaz(klasor, defter)

    if not yeni:
        print(f"[{time.strftime('%H:%M:%S')}] yeni dosya yok")


def dosyayi_isle(ry, sy, yol, ad, kapak_yolu, kapak_mime, otomatik_ac, zorla):
    boyut = os.path.getsize(yol)
    mime = ry.tur_bul(yol)          # desteklenmeyen turde sys.exit eder
    if boyut > ry.EN_BUYUK:
        return ('hata', f"{boyut / 1048576:.0f} MB -- Instagram reels siniri "
                        f"{ry.EN_BUYUK / 1048576:.0f} MB")

    kok = sy.ayar('SHOOTBOARD_MCP_URL').rstrip('/')
    anahtar = sy.ayar('SHOOTBOARD_KEY')

    # ONCE KAYDI ARA, SONRA YUKLE. Izleyicide kaydin var oldugunu
    # bilmiyoruz -- render, takvim kaydindan once bitebilir. Once
    # yukleseydik, kayit acilana kadar her turda R2'ye ayni dosyayi
    # bir daha koyardik. (story-izle.py'deki ayni gerekce.)
    try:
        kayit_idler = sy.kaydi_bul(kok, anahtar, ad, None, 'reels')
    except SystemExit as e:
        kod = e.code
        return ('kayit-yok', kod if isinstance(kod, str) and kod.strip()
                else 'o tarihte reels kaydi yok, ya da birden cok aday var '
                     '(yukaridaki listeye bak, elle bagla)')

    url = sy.r2_yukle(yol, ad, mime)
    print(f"  adres: {url}")
    sorunlar = sy.adresi_dene(url, mime, boyut)
    if sorunlar:
        print("  ADRES SORUNLU:")
        for s in sorunlar:
            print(f"    · {s}")
        if not zorla:
            return ('adres-sorunlu', '; '.join(sorunlar))
        print("  (--zorla verildi, devam ediliyor)")

    # ---- Kapak: yayini DURDURMUYOR --------------------------------------
    kapak_url = None
    if kapak_yolu:
        kapak_url, kapak_sorun = ry.kapak_yukle(sy, kapak_yolu, kapak_mime, zorla)
        if kapak_sorun:
            print("  KAPAK ADRESI SORUNLU:")
            for s in kapak_sorun:
                print(f"    · {s}")
        if not kapak_url:
            print("  -> kapaksiz devam ediliyor")

    # Birden cok kayit olabilir: her sosyal medya ayri kayit, ayni reel
    # IG'ye ve FB'ye gidiyorsa iki kayit ayni dosyayi gosteriyor.
    notlar = []
    for kayit_id in kayit_idler:
        kayit = sy.kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad,
                             otomatik_ac, kapak_url)
        notlar.append(f"{kayit.get('platform') or '?'} {kayit['id']} · "
                      f"yayin {kayit.get('publishAt') or '?'} · "
                      f"kapak {'var' if kayit.get('coverUrl') else 'yok'} · "
                      f"otomatik {'ACIK' if kayit.get('autoPublish') else 'kapali'}")
    return ('baglandi', ' | '.join(notlar))


def main():
    ap = argparse.ArgumentParser(description="Reels teslim klasorunu izler, yeni reel'leri kapagiyla Shootboard'a baglar.")
    ap.add_argument('--klasor', help="Izlenecek klasor. Varsayilan REELS_KLASOR ortam degiskeni.")
    ap.add_argument('--bir-kez', action='store_true', help="Tek tur at ve cik (Gorev Zamanlayici icin).")
    ap.add_argument('--otomatik-acma', action='store_true', help="autoPublish'i ACMA, elle acacaksan.")
    ap.add_argument('--zorla', action='store_true', help="Adres denemesi sorun bulsa da devam et.")
    ap.add_argument('--aralik', type=int, default=TUR_ARASI_SN, help="Turlar arasi saniye (varsayilan 60).")
    a = ap.parse_args()

    klasor = a.klasor or os.environ.get('REELS_KLASOR', VARSAYILAN_KLASOR)
    if not os.path.isdir(klasor):
        sys.exit(f"Klasor yok: {klasor}\n"
                 f"--klasor ile ver ya da REELS_KLASOR ortam degiskenini ayarla.")

    ry = modul_al('reels-yukle.py', 'reels_yukle')
    sy = modul_al('story-yukle.py', 'story_yukle')
    print(f"Izlenen klasor: {klasor}")
    print(f"Video turleri : {', '.join(sorted(ry.IZINLI_TUR))}")
    print(f"Kapak turleri : {', '.join(u for u, _ in ry.KAPAK_TUR)}")

    if a.bir_kez:
        bir_tur(ry, sy, klasor, not a.otomatik_acma, a.zorla)
        return

    print(f"Her {a.aralik} saniyede bir bakilacak. Durdurmak icin Ctrl+C.\n")
    try:
        while True:
            bir_tur(ry, sy, klasor, not a.otomatik_acma, a.zorla)
            time.sleep(a.aralik)
    except KeyboardInterrupt:
        print("\nDurduruldu.")


if __name__ == '__main__':
    main()
