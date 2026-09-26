#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reels teslim dosyasini R2'ye yukler, Shootboard kaydina baglar.

    python reels-yukle.py "E:\\CLAUDE VIDEOS\\TESLIM\\REELS_V2\\2026-10-12_reels_sokollu.mp4"

STORY'DEN FARKI: KAPAK
  Reels'in kapagi AYRI BIR DOSYA ve Instagram onu AYRI BIR ADRESTEN
  cekiyor (`cover_url`). Bu yuzden burada iki dosya yukleniyor:

      2026-10-12_reels_sokollu.mp4   -> mediaUrl
      2026-10-12_reels_sokollu.jpg   -> coverUrl

  Eslesme DOSYA ADINDAN: ayni kok, gorsel uzantisi. Ayri bir liste ya
  da adlandirma kurali yok -- kok ayni oldugu surece render ciktisi ne
  ad alirsa alsin cifti bulunuyor.

  KAPAK ZORUNLU DEGIL. Yoksa Instagram videodan kendi karesini seciyor
  ve yayin DURMUYOR. Kapaksiz cikan bir reel, hic cikmayan bir
  reel'den iyidir.

⛔ BU SCRIPT DE `uploaded` ALANINA DOKUNMUYOR
  Sartname Bolum 1. `uploaded` senin kendi isaretin, `publishState`
  sistemin durumu.

ORTAK KOD
  R2 yuklemesi, adres denemesi ve kayit eslestirmesi story-yukle.py'den
  ALINIYOR, kopyalanmiyor. O dosyadaki ince kurallar (yonlendirme yok,
  Content-Type dogru, Content-Length var) burada da aynen gecerli ve
  tek yerde durmalari sart: birinde duzeltilen bir hata otekinde
  kalirsa aradaki fark yayin gunune kadar gorunmez.

KURULUM
  story-yukle.py ile AYNI klasorde durmali; ortam degiskenleri de ayni
  (SHOOTBOARD_MCP_URL, SHOOTBOARD_KEY, R2_*). Ayrinti icin
  story-yukle.py'nin basindaki KURULUM bolumu.
"""
import os
import sys
import argparse
import importlib.util

BURASI = os.path.dirname(os.path.abspath(__file__))

# Instagram reels siniri story'ninkinden cok yuksek. MCP tarafindaki
# tavan da 1 GB (supabase/functions/mcp/index.ts); ikisi ayrisirsa
# dosya burada gecer, kayda yazilirken reddedilir.
EN_BUYUK = 1024 * 1024 * 1024

# Reels VIDEO. Fotograf reel olamiyor ve worker da kalici hata veriyor;
# burada durdurmak, o hatayi yayin gunune birakmaktan iyi.
IZINLI_TUR = {".mp4": "video/mp4", ".mov": "video/quicktime"}
# Kapak icin kabul edilen gorsel turleri, DENEME SIRASIYLA.
KAPAK_TUR = [(".jpg", "image/jpeg"), (".jpeg", "image/jpeg"), (".png", "image/png")]


def story_yukleyiciyi_al():
    """story-yukle.py'yi ice aktar. Ad tire icerdigi icin duz import olmuyor."""
    yol = os.path.join(BURASI, "story-yukle.py")
    if not os.path.isfile(yol):
        sys.exit(f"story-yukle.py bulunamadi: {yol}\n"
                 f"Iki script ayni klasorde durmali (ortak kod oradan geliyor).")
    spec = importlib.util.spec_from_file_location("story_yukle", yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def tur_bul(yol):
    uzanti = os.path.splitext(yol)[1].lower()
    if uzanti in IZINLI_TUR:
        return IZINLI_TUR[uzanti]
    sys.exit(f"Reels icin desteklenmeyen dosya turu: {uzanti or '(uzantisiz)'}\n"
             f"Kabul edilenler: {', '.join(sorted(IZINLI_TUR))}\n"
             f"(Reels video olmak zorunda; fotograf reel olamiyor.)")


def kapagi_bul(video_yolu):
    """Videonun yanindaki kapak gorseli. Yoksa (None, None).

    Kok = uzantisiz dosya adi. Ayni klasorde ayni koku tasiyan ilk
    gorsel kapak sayiliyor; sira KAPAK_TUR'de sabit, yani ayni klasorde
    hem .jpg hem .png varsa HER SEFERINDE aynisi seciliyor. Belirsiz
    bir secim, ara sira yanlis kapak demek olurdu.
    """
    kok = os.path.splitext(video_yolu)[0]
    for uzanti, mime in KAPAK_TUR:
        aday = kok + uzanti
        if os.path.isfile(aday):
            return aday, mime
        # Windows disinda buyuk/kucuk harf ayri: .JPG da kabul.
        aday = kok + uzanti.upper()
        if os.path.isfile(aday):
            return aday, mime
    return None, None


def kapak_yukle(y, kapak_yolu, kapak_mime, zorla):
    """Kapagi R2'ye koyar ve adresini dondurur. Sorun varsa (None, notlar).

    ⚠ KAPAK YAYINI DURDURMUYOR. Adres sorunluysa kapaksiz devam
    ediliyor: Instagram videodan kare seciyor ve reel yine cikiyor.
    Kapak yuzunden yayin iptal etmek, kucuk bir eksigi buyuk bir
    kayba cevirmek olurdu.
    """
    ad = os.path.basename(kapak_yolu)
    boyut = os.path.getsize(kapak_yolu)
    if boyut == 0:
        return None, ["kapak dosyasi bos"]
    print(f"  kapak: {ad}  ({boyut / 1024:.0f} KB, {kapak_mime})")
    url = y.r2_yukle(kapak_yolu, ad, kapak_mime)
    print(f"  kapak adresi: {url}")
    sorunlar = y.adresi_dene(url, kapak_mime, boyut)
    if sorunlar and not zorla:
        return None, sorunlar
    return url, sorunlar


def main():
    ap = argparse.ArgumentParser(description="Reels dosyasini (ve kapagini) R2'ye yukleyip Shootboard kaydina baglar.")
    ap.add_argument("dosya", help=r"Yuklenecek video (E:\CLAUDE VIDEOS\TESLIM\REELS_V2\2026-10-12_reels_konu.mp4)")
    ap.add_argument("--id", help="Kayit kimligi. Verilmezse dosya adindan bulunur.")
    ap.add_argument("--kapak", help="Kapak gorseli. Verilmezse video adiyla ayni olan aranir.")
    ap.add_argument("--otomatik-acma", action="store_true", help="autoPublish'i ACMA.")
    ap.add_argument("--zorla", action="store_true", help="Adres denemesi sorun bulsa da devam et.")
    a = ap.parse_args()

    y = story_yukleyiciyi_al()

    yol = a.dosya
    if not os.path.isfile(yol):
        sys.exit(f"Dosya yok: {yol}")
    ad = os.path.basename(yol)
    boyut = os.path.getsize(yol)
    mime = tur_bul(yol)

    print(f"\n{ad}  ({boyut / 1048576:.1f} MB, {mime})")
    if boyut > EN_BUYUK:
        sys.exit(f"Dosya {boyut / 1048576:.0f} MB -- Instagram reels siniri "
                 f"{EN_BUYUK / 1048576:.0f} MB. Once kucult.")
    if boyut == 0:
        sys.exit("Dosya bos.")

    kok = y.ayar("SHOOTBOARD_MCP_URL").rstrip("/")
    anahtar = y.ayar("SHOOTBOARD_KEY")

    url = y.r2_yukle(yol, ad, mime)
    print(f"  adres: {url}")
    sorunlar = y.adresi_dene(url, mime, boyut)
    if sorunlar:
        print("\n  ADRES SORUNLU -- Instagram bu dosyayi cekemeyebilir:")
        for x in sorunlar:
            print(f"    · {x}")
        if not a.zorla:
            sys.exit("\nDurduruldu. Duzelt, ya da yine de devam etmek icin --zorla ver.")
        print("  (--zorla verildi, devam ediliyor)")
    else:
        print("  adres temiz: 200, dogru tur, yonlendirme yok")

    # ---- Kapak -----------------------------------------------------------
    kapak_url = None
    if a.kapak:
        if not os.path.isfile(a.kapak):
            sys.exit(f"Kapak dosyasi yok: {a.kapak}")
        kapak_yolu = a.kapak
        kapak_mime = dict(KAPAK_TUR).get(os.path.splitext(kapak_yolu)[1].lower())
        if not kapak_mime:
            sys.exit(f"Kapak turu desteklenmiyor: {os.path.splitext(kapak_yolu)[1]}\n"
                     f"Kabul edilenler: {', '.join(u for u, _ in KAPAK_TUR)}")
    else:
        kapak_yolu, kapak_mime = kapagi_bul(yol)

    if kapak_yolu:
        kapak_url, kapak_sorun = kapak_yukle(y, kapak_yolu, kapak_mime, a.zorla)
        if kapak_sorun:
            print("  KAPAK ADRESI SORUNLU:")
            for x in kapak_sorun:
                print(f"    · {x}")
        if not kapak_url:
            print("  -> kapaksiz devam ediliyor (Instagram videodan kare secer)")
    else:
        print("  kapak dosyasi yok -- Instagram videodan kare secer")

    # ---- Kayda bagla -----------------------------------------------------
    kayit_idler = y.kaydi_bul(kok, anahtar, ad, a.id, "reels")
    for kayit_id in kayit_idler:
        kayit = y.kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad,
                            not a.otomatik_acma, kapak_url)
        print(f"\nBAGLANDI  {kayit['id']}  ({kayit.get('platform') or '?'})")
        print(f"  yayin    : {kayit.get('publishAt') or '(tarih/saat eksik)'}")
        print(f"  kapak    : {'ACIK' if kayit.get('coverUrl') else 'yok'}")
        print(f"  otomatik : {'ACIK' if kayit.get('autoPublish') else 'kapali'}")
        print(f"  durum    : {kayit.get('publishState')}")
        if not kayit.get("autoPublish"):
            print("  (Shootboard'da 'Otomatik yayinla' kutusunu isaretlemeyi unutma)")
    print()


if __name__ == "__main__":
    main()
