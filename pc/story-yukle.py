#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render bitince: dosyayi R2'ye yukle, Shootboard kaydina bagla.

Sartname Bolum 2, SECENEK B (kullanici karari): Shootboard'a upload
arayuzu eklenmiyor. Render PC'de bitiyor, bu script dosyayi disariya
cikariyor.

    python story-yukle.py "E:\\CLAUDE VIDEOS\\2026-12-05_story_balikli_k1.mp4"

NE YAPAR
  1. Dosyayi Cloudflare R2'ye (ya da S3'e) koyar, dogru Content-Type ile
  2. Yayinlanan adresi GERCEKTEN DENER -- Meta'nin cekebilecegi bir
     adres mi diye (asagida "NEDEN DENIYOR")
  3. Shootboard'da o dosyaya ait story kaydini bulur
  4. Kayda mediaUrl/mediaBytes/mediaMime/mediaName yazar ve
     autoPublish'i acar

NEDEN ADRESI DENIYOR
  Instagram dosyayi PUBLIC BIR HTTPS URL'DEN CEKIYOR ve:
    · 301/302 yonlendirmesini IZLEMIYOR
    · Content-Type dogru degilse reddediyor
    · Content-Length yoksa sorun cikariyor
  Bunlarin hepsi yayin anina birakilirsa, hatayi story'nin cikmasi
  gereken gun ogrenirsin. Story 24 saatlik; kacan gun geri gelmez.
  Yukleme aninda ogrenmek bedava, yayin aninda ogrenmek bir gun.

⛔ BU SCRIPT `uploaded` ALANINA DOKUNMAZ
  Sartname Bolum 1. `uploaded` senin kendi isaretin ("bunu portala
  yukledim"); `publishState` sistemin durumu. Ikisi ayri seyler ve bu
  kural bir veri kaybindan dogdu. Asagida uploaded hic gecmiyor -- ve
  Shootboard tarafi da gonderilse bile yazmiyor.

KURULUM
    pip install boto3 requests
  Ayarlar ASLA bu dosyaya yazilmaz, ortam degiskeninden okunur:

    SHOOTBOARD_MCP_URL   https://<proje>.supabase.co/functions/v1/mcp
    SHOOTBOARD_KEY       shb_...            (Hesabim -> Baglanti adresi)
    R2_ENDPOINT          https://<hesap>.r2.cloudflarestorage.com
    R2_BUCKET            shootboard-medya
    R2_ACCESS_KEY_ID     ...
    R2_SECRET_ACCESS_KEY ...
    R2_PUBLIC_BASE       https://medya.alanadin.com   (R2 public/CDN adresi)

  Windows'ta kalici yapmak icin:
    setx SHOOTBOARD_KEY "shb_..."
  (yeni bir terminal acmayi unutma)

  ⚠ Anahtarlari bir sohbete, ekran goruntusune ya da depoya YAZMA.
"""
import os
import sys
import mimetypes
import argparse

try:
    import boto3
    from botocore.config import Config
except ImportError:
    sys.exit("boto3 yok. Kur:  pip install boto3 requests")
try:
    import requests
except ImportError:
    sys.exit("requests yok. Kur:  pip install boto3 requests")


# Instagram story siniri. Buyugu yayin aninda reddediliyor, o yuzden
# burada durduruluyor.
EN_BUYUK = 100 * 1024 * 1024
IZINLI_TUR = {".mp4": "video/mp4", ".mov": "video/quicktime",
              ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


def ayar(ad, zorunlu=True):
    v = os.environ.get(ad, "").strip()
    if zorunlu and not v:
        sys.exit(f"Ortam degiskeni eksik: {ad}\n(Ayrinti icin bu dosyanin basindaki KURULUM bolumu.)")
    return v


def tur_bul(yol):
    uzanti = os.path.splitext(yol)[1].lower()
    if uzanti in IZINLI_TUR:
        return IZINLI_TUR[uzanti]
    tahmin = mimetypes.guess_type(yol)[0]
    sys.exit(f"Desteklenmeyen dosya turu: {uzanti or '(uzantisiz)'}"
             f"{' (tahmin: ' + tahmin + ')' if tahmin else ''}\n"
             f"Story icin: .mp4 .mov .jpg .png")


def r2_yukle(yol, ad, mime):
    s3 = boto3.client(
        "s3",
        endpoint_url=ayar("R2_ENDPOINT"),
        aws_access_key_id=ayar("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=ayar("R2_SECRET_ACCESS_KEY"),
        # R2 imza surumu v4; bolge adi onemsiz ama bos birakilamiyor.
        config=Config(signature_version="s3v4", region_name="auto"),
    )
    kova = ayar("R2_BUCKET")
    print(f"  yukleniyor -> r2://{kova}/{ad}")
    with open(yol, "rb") as f:
        s3.put_object(
            Bucket=kova, Key=ad, Body=f,
            # Content-Type SART: Meta yanlis turu reddediyor.
            ContentType=mime,
            # Story 24 saatlik; dosya yayindan sonra 7 gun yetiyor.
            # Kova tarafinda yasam dongusu kurali da koy, depo sismesin.
            CacheControl="public, max-age=604800",
        )
    return ayar("R2_PUBLIC_BASE").rstrip("/") + "/" + ad


def adresi_dene(url, beklenen_mime, beklenen_boyut):
    """Meta'nin cekebilecegi bir adres mi? Yayin gunune birakma."""
    print("  adres deneniyor (Meta gibi)...")
    try:
        r = requests.head(url, allow_redirects=False, timeout=20)
    except requests.RequestException as e:
        return [f"adrese ulasilamadi: {e}"]

    sorun = []
    if r.status_code in (301, 302, 303, 307, 308):
        sorun.append(f"adres {r.status_code} ile yonlendiriyor -> Instagram yonlendirmeyi IZLEMIYOR. "
                     f"R2 public adresini dogrudan ver (Hedef: {r.headers.get('location', '?')})")
    elif r.status_code != 200:
        sorun.append(f"adres {r.status_code} donduruyor, 200 bekleniyor. Kova public okunabilir mi?")

    tur = (r.headers.get("content-type") or "").split(";")[0].strip()
    if tur and tur != beklenen_mime:
        sorun.append(f"Content-Type '{tur}', beklenen '{beklenen_mime}'")
    uzunluk = r.headers.get("content-length")
    if not uzunluk:
        sorun.append("Content-Length donmuyor -- Meta bunu istiyor")
    elif int(uzunluk) != beklenen_boyut:
        sorun.append(f"Content-Length {uzunluk}, dosya {beklenen_boyut} bayt")
    return sorun


def kaydi_bul(kok, anahtar, dosya_adi, kayit_id=None):
    if kayit_id:
        return kayit_id
    r = requests.get(f"{kok}/api/entries/find",
                     params={"file": dosya_adi},
                     headers={"Authorization": f"Bearer {anahtar}"}, timeout=30)
    veri = r.json() if r.content else {}
    if not veri.get("ok"):
        sys.exit("Kayit bulunamadi: " + str(veri.get("error") or r.status_code))
    kayitlar = veri.get("entries") or []
    if len(kayitlar) == 1:
        k = kayitlar[0]
        print(f"  kayit: {k['id']}  {k['date']} {k['time']}  {k.get('title') or '(basliksiz)'}")
        return k["id"]
    # Birden cok aday varsa SECIM YAPILMIYOR: yanlis kayda yazmak,
    # yazmamaktan kotu.
    print("\nO tarihte birden cok story var. --id ile birini sec:\n")
    for k in kayitlar:
        print(f"  --id {k['id']}   {k['date']} {k['time']}  {k.get('title') or '(basliksiz)'}")
    sys.exit(1)


def kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad, otomatik):
    govde = {"mediaUrl": url, "mediaBytes": boyut, "mediaMime": mime,
             "mediaName": ad, "autoPublish": bool(otomatik)}
    # ⛔ uploaded BURADA YOK ve olmayacak. Sartname Bolum 1.
    r = requests.patch(f"{kok}/api/entries/{kayit_id}", json=govde,
                       headers={"Authorization": f"Bearer {anahtar}"}, timeout=30)
    veri = r.json() if r.content else {}
    if not veri.get("ok"):
        sys.exit("Kayda yazilamadi: " + str(veri.get("error") or veri.get("message") or r.status_code))
    return veri["entry"]


def main():
    ap = argparse.ArgumentParser(description="Story dosyasini R2'ye yukleyip Shootboard kaydina baglar.")
    ap.add_argument("dosya", help="Yuklenecek dosya (E:\\CLAUDE VIDEOS\\2026-12-05_story_konu_k1.mp4)")
    ap.add_argument("--id", help="Kayit kimligi. Verilmezse dosya adindan bulunur.")
    ap.add_argument("--otomatik-acma", action="store_true",
                    help="autoPublish'i ACMA. Once gozden gecirip elle acmak istersen.")
    ap.add_argument("--zorla", action="store_true",
                    help="Adres denemesi sorun bulsa da devam et.")
    a = ap.parse_args()

    yol = a.dosya
    if not os.path.isfile(yol):
        sys.exit(f"Dosya yok: {yol}")
    ad = os.path.basename(yol)
    boyut = os.path.getsize(yol)
    mime = tur_bul(yol)

    print(f"\n{ad}  ({boyut / 1048576:.1f} MB, {mime})")
    if boyut > EN_BUYUK:
        sys.exit(f"Dosya {boyut / 1048576:.0f} MB -- Instagram story siniri 100 MB. "
                 f"Once kucult, sonra yukle.")
    if boyut == 0:
        sys.exit("Dosya bos.")

    kok = ayar("SHOOTBOARD_MCP_URL").rstrip("/")
    anahtar = ayar("SHOOTBOARD_KEY")

    url = r2_yukle(yol, ad, mime)
    print(f"  adres: {url}")

    sorunlar = adresi_dene(url, mime, boyut)
    if sorunlar:
        print("\n  ADRES SORUNLU -- Instagram bu dosyayi cekemeyebilir:")
        for x in sorunlar:
            print(f"    · {x}")
        if not a.zorla:
            sys.exit("\nDurduruldu. Duzelt, ya da yine de devam etmek icin --zorla ver.")
        print("  (--zorla verildi, devam ediliyor)")
    else:
        print("  adres temiz: 200, dogru tur, yonlendirme yok")

    kayit_id = kaydi_bul(kok, anahtar, ad, a.id)
    kayit = kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad, not a.otomatik_acma)

    print(f"\nBAGLANDI  {kayit['id']}")
    print(f"  yayin    : {kayit.get('publishAt') or '(tarih/saat eksik)'}")
    print(f"  otomatik : {'ACIK' if kayit.get('autoPublish') else 'kapali'}")
    print(f"  durum    : {kayit.get('publishState')}")
    if not kayit.get("autoPublish"):
        print("  (Shootboard'da 'Otomatik yayinla' kutusunu isaretlemeyi unutma)")
    print()


if __name__ == "__main__":
    main()
