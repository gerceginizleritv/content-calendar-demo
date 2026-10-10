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
  3. Shootboard'da o dosyaya ait story kaydini (ya da KAYITLARINI) bulur
  4. Her birine mediaUrl/mediaBytes/mediaMime/mediaName yazar ve
     autoPublish'i acar

  Neden birden cok kayit: Shootboard'da her sosyal medya AYRI kayit.
  Ayni story hem Instagram'a hem Facebook'a gidiyorsa iki kayit var ve
  ikisi de ayni dosyayi gosteriyor. Kayitlarda mediaName yaziliysa
  ikisine de baglanir -- tahmin degil, kayitlarin kendi istegi.

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
import threading
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


# ADDAN TUR. Izleyiciler buna bakip BASKA turun dosyasini atliyor.
#
# 7 Ekim 2026, 16:20: story izleyicisi `story\cikti` icindeki dokuz REELS
# dosyasina "Instagram sinirli 100 MB" hatasi verdi. Kod yanlis degildi --
# turu belirleyen tek sey DOSYANIN HANGI KLASORDE DURDUGU idi; izleyici
# klasordeki her videoyu kendi turu saniyordu. Reels tavani 1 GB
# (reels-yukle.py), story'ninki 100 MB; ayni dosya bir yerde gecerli,
# otekinde reddediliyor.
#
# ⚠ BILINMEYEN AD ELENMIYOR. Yalnizca "bu ad OTEKI turu soyluyor" durumunda
# atlaniyor; isaretsiz bir ad eskisi gibi isleniyor. Aksi halde adlandirma
# kuralina uymayan bir dosya SESSIZCE gorunmez olurdu -- duzeltmeye
# calistigimiz hatanin aynisi, yalnizca ters yonde.
def ad_turu(ad):
    """Dosya adindan tur: 'story', 'reels' ya da '' (bilinmiyor)."""
    a = str(ad or '').lower()
    if '_story_' in a:
        return 'story'
    if '_reels_' in a:
        return 'reels'
    return ''


# ══════════════════════════════════════════════════════════════════
# OTOMATIK YAYIN POLITIKASI -- HANGI PLATFORM KENDILIGINDEN CIKAR
#
# Bu tablo olmadan yukleyici KORDU: `otomatik_ac` tek bir global
# bayrakti ve eslesen HER kayda uygulaniyordu. Bir reels dosyasi dort
# kayit buluyor (ig/fb/tt reels + yt shorts) ve dordunun de
# autoPublish'ini aciyordu.
#
# 10 Ekim 2026'da bunun bedeli olculdu: 66 kayit (26 tiktok, 24
# youtube, 16 facebook) otomatik yayinda duruyordu. Ikisi iki gun
# sonraydi ve biri YouTube'du -- denetim kapisi kapaliyken oraya video
# gidecekti. Kayitlar elle kapatildi, ama izleyici bir sonraki dosyada
# hepsini YENIDEN ACACAKTI. Asil ariza buydu; tek seferlik duzeltme
# ariza devam ettigi surece her hafta tekrarlanan bir is demek.
#
# ⚠ TABLODA OLMAYAN CIFT KAPALI SAYILIYOR. Yeni bir platform ya da tur
# eklendiginde sessizce yayina baslamiyor; once buraya yazilmasi
# gerekiyor. Ters varsayim (bilinmeyeni ac) tam olarak yukaridaki
# arizanin genel hali olurdu.
#
# ⚠ ACIK OLANLAR "CALISTIGI OLCULDU" DEMEK, "mumkun" DEGIL:
#   instagram/story  22 Eylul'den beri sorunsuz
#   facebook/story   22 Eylul'den beri sorunsuz
#   instagram/reels  2-3 Ekim'de 8.148 ve 3.819 oynatma
# Kapali olanlarin sebebi de olculdu:
#   facebook/reels   ayni dosya, ayni dakika, ayni hat: IG 8.148 /
#                    FB 19 goruntulenme. 5 Ekim'den beri ELLE.
#   tiktok/reels     video.publish onayi yok
#   youtube/shorts   kullanicinin denetim kapisi kapali
#
# Bir cift acilacaksa DEGISECEK TEK YER BURASI.
OTOMATIK_YAYIN = {
    ('instagram', 'story'):  True,
    ('facebook',  'story'):  True,
    ('instagram', 'reels'):  True,
    ('facebook',  'reels'):  False,
    ('tiktok',    'reels'):  False,
    ('youtube',   'shorts'): False,
}


def otomatik_mi(platform, tur, istenen=True):
    """Bu kayitta autoPublish ACILACAK mi.

    `istenen` cagiranin niyeti (--otomatik-acma verildiyse False). Politika
    yalnizca KISITLIYOR: istenmeyen bir seyi acmiyor, izin verilmeyen bir
    seyi de istense bile acmiyor.
    """
    if not istenen:
        return False
    return OTOMATIK_YAYIN.get(
        (str(platform or '').lower(), str(tur or '').lower()), False)


def tur_bul(yol):
    uzanti = os.path.splitext(yol)[1].lower()
    if uzanti in IZINLI_TUR:
        return IZINLI_TUR[uzanti]
    tahmin = mimetypes.guess_type(yol)[0]
    sys.exit(f"Desteklenmeyen dosya turu: {uzanti or '(uzantisiz)'}"
             f"{' (tahmin: ' + tahmin + ')' if tahmin else ''}\n"
             f"Story icin: .mp4 .mov .jpg .png")


def ilerleme_yazici(toplam):
    """Yukleme ilerlemesini basan geri cagirma uretir.

    put_object'te ilerleme YOKTU: yukleme suresince ekran olu kaliyordu
    ve 27 Eylul 2026'da ilk gercek reel yuklenirken "ekran dondu mu?"
    diye soruldu. 60 MB'lik bir dosya bir dakika sessiz durdu.

    IKI KIP, cunku bu betik iki yerde kosuyor:

      terminalde  -> ayni satir tazeleniyor, akici bir yuzde
      gunluge     -> her %25'te BIR SATIR dusuyor

    Gunluge \r yazmak dosyayi tek satirlik bir curufa cevirirdi ve
    Gorev Zamanlayici hep gunluge yaziyor. Ayrim isatty() ile.
    """
    ekranda = bool(getattr(sys.stdout, "isatty", None) and sys.stdout.isatty())
    durum = {"gecen": 0, "esik": 25}
    # ⚠ KILIT SART. upload_fileobj cok parcali yuklemede Callback'i
    # BIRDEN FAZLA IS PARCACIGINDAN cagiriyor. `durum["gecen"] += bayt`
    # atomik degil (oku/degistir/yaz), yani araya girilince sayim
    # kayboluyor. Cokme olmuyor ama yuzde %100'e hic ulasmayabiliyor;
    # o zaman terminal kipindeki satir sonu hic basilmiyor ve sonraki
    # cikti ilerleme satirinin ustune biniyor.
    kilit = threading.Lock()

    def geri(bayt):
        with kilit:
            durum["gecen"] += bayt
            gecen = durum["gecen"]
        if not toplam:
            return
        yuzde = min(100, gecen * 100 // toplam)
        if ekranda:
            print(f"\r    %{yuzde:3d}  "
                  f"({gecen / 1048576:.0f}/{toplam / 1048576:.0f} MB)",
                  end="", flush=True)
            if yuzde >= 100:
                print()
        else:
            # Esik de kilidin altinda: iki is parcacigi ayni kilometre
            # tasini iki kez basmasin.
            with kilit:
                basilacak = yuzde >= durum["esik"]
                if basilacak:
                    durum["esik"] += 25
            if basilacak:
                print(f"    %{yuzde}  ({gecen / 1048576:.0f} MB)")

    return geri


def r2_istemci():
    """R2 baglantisi. Yukleme ve silme AYNI istemciyi kuruyor: ayarlardan
    biri degisirse iki yerde degismesin."""
    return boto3.client(
        "s3",
        endpoint_url=ayar("R2_ENDPOINT"),
        aws_access_key_id=ayar("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=ayar("R2_SECRET_ACCESS_KEY"),
        # R2 imza surumu v4; bolge adi onemsiz ama bos birakilamiyor.
        config=Config(signature_version="s3v4", region_name="auto"),
    )


def r2_yukle(yol, ad, mime):
    s3 = r2_istemci()
    kova = ayar("R2_BUCKET")
    boyut = os.path.getsize(yol)
    print(f"  yukleniyor -> r2://{kova}/{ad}  ({boyut / 1048576:.0f} MB)")
    # ⚠ upload_fileobj, put_object DEGIL. Tek sebep: put_object'in
    # Callback'i yok, yani ilerleme basilamiyor. Islevsel fark
    # upload_fileobj'in buyuk dosyayi cok parcali (multipart) gondermesi;
    # R2 bunu destekliyor ve adresi_dene'nin baktigi seyleri
    # (Content-Type, Content-Length) degistirmiyor.
    with open(yol, "rb") as f:
        s3.upload_fileobj(
            f, kova, ad,
            ExtraArgs={
                # Content-Type SART: Meta yanlis turu reddediyor.
                "ContentType": mime,
                # Story 24 saatlik; dosya yayindan sonra 7 gun yetiyor.
                # Kova tarafinda yasam dongusu kurali da koy, depo sismesin.
                "CacheControl": "public, max-age=604800",
            },
            Callback=ilerleme_yazici(boyut),
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


def kaydi_bul(kok, anahtar, dosya_adi, kayit_id=None, tur_adi="story"):
    """Bu dosyanin baglanacagi KAYITLAR. Her zaman liste doner.

    ⚠ KIMLIK DEGIL KAYIT DONUYOR. Eskiden yalnizca id listesi donuyordu
    ve cagiran kaydin PLATFORMUNU bilmiyordu; otomatik yayin karari da
    bu yuzden tek bir global bayrakla, ayrim yapmadan veriliyordu
    (OTOMATIK_YAYIN tablosunun basindaki 66 kayit olayi). Platform
    kararin girdisi oldugu icin artik kararin verildigi yere kadar
    tasiniyor.

    --id ile cagrildiginda platform BILINMIYOR: elde yalnizca kimlik var
    ve tek kayit getiren bir uc yok. O dal {'id': ...} donuyor; politikayi
    kayda_yaz'daki YAZDIKTAN SONRAKI denetim uyguluyor.

    tur_adi YALNIZCA ekrana yazilan kelime. Eslestirme mantigi ortak ve
    OYLE KALMALI: reels yukleyicisi de bu islevi cagiriyor. Ayri bir
    kopya cikarilsaydi, buradaki bir duzeltme oteki tarafa hic gecmezdi.

    Birden cok olabilmesinin sebebi Shootboard'in kendi modeli: her sosyal
    medya icin AYRI kayit aciliyor. Ayni story Instagram'a ve Facebook'a
    gidiyorsa takvimde iki kayit var ve ikisi de AYNI dosyayi gosteriyor.

    Ama "birden cok" her zaman ayni sey degil:

      mediaName ile eslesti -> kayitlarin KENDISI bu dosyayi adiyla
        istemis. Tahmin yok, hepsine baglaniyor.

      tarih ile eslesti     -> dosya adindaki gunde birden cok story var
        ve hangisi oldugu BILINMIYOR. Burada secim yapilmiyor; yanlis
        kayda yazmak, yazmamaktan kotu.
    """
    if kayit_id:
        return [{"id": kayit_id}]
    r = requests.get(f"{kok}/api/entries/find",
                     params={"file": dosya_adi},
                     headers={"Authorization": f"Bearer {anahtar}"}, timeout=30)
    veri = r.json() if r.content else {}
    if not veri.get("ok"):
        sys.exit("Kayit bulunamadi: " + str(veri.get("error") or r.status_code))
    kayitlar = veri.get("entries") or []
    nasil = veri.get("matchedBy")

    if nasil == "mediaName" and kayitlar:
        for k in kayitlar:
            print(f"  kayit: {k['id']}  {k['date']} {k['time']}  "
                  f"{k.get('platform') or '?'}  {k.get('title') or '(basliksiz)'}")
        if len(kayitlar) > 1:
            print(f"  ({len(kayitlar)} kayit ayni dosyayi istiyor, hepsine baglanacak)")
        return kayitlar

    if len(kayitlar) == 1:
        k = kayitlar[0]
        print(f"  kayit: {k['id']}  {k['date']} {k['time']}  {k.get('title') or '(basliksiz)'}")
        return [k]

    print(f"\nO tarihte birden cok {tur_adi} var ve hangisi oldugu belli degil.")
    print("Kaliciysa: planlama tarafinda kayitlara mediaName yaz, bu is bir")
    print("daha sormaz. Simdilik --id ile birini sec:\n")
    for k in kayitlar:
        print(f"  --id {k['id']}   {k['date']} {k['time']}  "
              f"{k.get('platform') or '?'}  {k.get('title') or '(basliksiz)'}")
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════
# YAYINLANMIS DOSYALARIN TEMIZLIGI
#
# Instagram videoyu yayin aninda R2'den CEKIYOR ve kendi kopyasini
# aliyor. O saniyeden sonra R2'deki dosyanin isi bitiyor: yeniden
# denemeler saatler icinde tukeniyor, Meta yayinlanmis gonderiyi kendi
# CDN'inden sunuyor, orijinal zaten kullanicinin diskinde.
#
# Buna ragmen dosya sonsuza kadar duruyordu -- 206 MB'lik bir reel,
# HERKESE ACIK bir adreste. Hesap silinse bile kaliyordu (app.html'in
# R2 anahtari yok; HESAP_KOVALARI yalnizca Supabase kovalari).
#
# Kullanicinin sorusu bunu ortaya cikardi: "video Instagram'a gittiyse
# neden saklamaya devam ediyoruz?" Bir sebep YOK.


def yayin_durumlari(kok, anahtar, dosya_adi):
    """Bu dosyaya bagli kayitlar: [{'oto': bool, 'durum': str}]. Bilinmiyorsa None.

    ⚠ `oto` DA DONUYOR, yalnizca durum degil. Sebebi temizlenecekler'de:
    otomatik yayini KAPALI bir kayit asla 'published' olmuyor ve tek
    basina butun dosyayi R2'de rehin tutuyordu.

    ⚠ YALNIZCA TAM AD ESLESMESI KABUL EDILIYOR.
    /api/entries/find tam ad bulamazsa dosya adindaki TARIHE dusuyor ve o
    gunun baska kayitlarini donduruyor. Silme kararini ona dayandirmak
    felaket olurdu: baska bir kayit yayinlandi diye BIZIM dosyamiz
    silinir, sonra bizimki yayinlanmaya calisir ve adres 404 doner.
    Bilinmiyorsa None donuyor ve cagiran DOKUNMUYOR.
    """
    try:
        r = requests.get(f"{kok}/api/entries/find",
                         params={"file": dosya_adi},
                         headers={"Authorization": f"Bearer {anahtar}"}, timeout=30)
        veri = r.json() if r.content else {}
    except Exception as e:
        print(f"  durum sorulamadi ({dosya_adi}): {e}")
        return None
    if not veri.get("ok") or veri.get("matchedBy") != "mediaName":
        return None
    kayitlar = veri.get("entries") or []
    if not kayitlar:
        return None
    return [{'oto': k.get("autoPublish") is True,
             'durum': str(k.get("publishState") or "")} for k in kayitlar]


def r2_sil(adlar):
    """R2'den nesne siler. Doner: (silinenler, sorunlular)."""
    s3 = r2_istemci()
    kova = ayar("R2_BUCKET")
    silinen, sorun = [], []
    for ad in adlar:
        try:
            s3.delete_object(Bucket=kova, Key=ad)
            silinen.append(ad)
        except Exception as e:
            sorun.append(f"{ad}: {e}")
    return silinen, sorun


def temizlenecekler(kok, anahtar, defter):
    """Defterde R2'den silinebilecek girdilerin adlari.

    Uc sart birden:
      · durum 'baglandi'        -- kayda gercekten baglanmis
      · 'temiz' isareti YOK     -- daha once silinmemis
      · OTOMATIK YAYINI ACIK kayitlarin HEPSI published (ve en az bir tane
        boyle kayit var)

    Ucuncusunun ilk hali "TUM bagli kayitlar published" idi. Gerekcesi
    dogruydu -- ayni dosya Instagram ve Facebook kayitlarina birden bagli,
    biri cikmis oteki beklerken silersek bekleyen yayin 404 alir -- ama
    kosul fazla genisti ve reels'te hic tutmadi:

      7 Ekim 2026, yayinlanan 10 reels'ten yalnizca 2'si temizlenmisti.
      Bir reels dosyasi DORT kayda bagli (fb/ig/tt reels + yt shorts) ve
      ucunun otomatik yayini kapali: TikTok video.publish onayi yok,
      YouTube denetim kapisi kapali, Facebook reels 5 Ekim'den beri ELLE
      atiliyor. Ucu de sonsuza kadar 'pending' kaliyor, yani all(published)
      hicbir zaman dogru olmuyor ve dosya R2'de kaliyor. Story'de sorun
      cikmamasinin sebebi iki kayda bagli olmasi ve ikisinin de
      yayinlanmasi.

    ⚠ KORUMA AYNEN DURUYOR: otomatik yayini acik ama henuz cikmamis bir
    kayit varsa dosya yine DURUYOR. Degisen tek sey, hicbir zaman
    yayinlanmayacak bir kaydin dosyayi rehin tutmamasi.

    ⚠ HIC OTOMATIK KAYIT YOKSA SILINMIYOR. Her platformu elle atan bir
    dosyada silmek icin bir sebep yok: o dosyayi sistem hic kullanmadi,
    publishState'i de kimse 'published' yapmayacak. Silmemek pahali degil;
    yanlis silmek geri alinamaz.
    """
    cikti = []
    for ad, kayit in defter.items():
        if kayit.get('durum') != 'baglandi' or kayit.get('temiz'):
            continue
        kayitlar = yayin_durumlari(kok, anahtar, ad)
        if kayitlar is None:
            continue                       # bilinmiyor -> dokunma
        otomatikler = [k for k in kayitlar if k.get('oto')]
        if otomatikler and all(k.get('durum') == 'published' for k in otomatikler):
            cikti.append(ad)
    return cikti


def temizlik_turu(klasor, defter, defter_yaz, nesneleri_bul):
    """Yayinlanmislari R2'den siler, defteri gunceller. Doner: silinen sayisi.

    ⚠ DEFTERDE `durum` DEGISMIYOR, AYRI BIR `temiz` ISARETI KONUYOR.
    Izleyicinin atlama sarti `durum == 'baglandi'`; durumu 'temizlendi'
    yapsaydik dosya "yeni" sayilip HER TURDA YENIDEN YUKLENIRDI -- yani
    sildigimiz seyi geri koyardik. Sessiz ve sonsuz bir dongu.

    `temiz` isareti dosya yeniden uretilirse KENDILIGINDEN dusuyor:
    izleyici o girdiyi bastan yaziyor (imza degisti), yeni sozlukte
    `temiz` yok.
    """
    kok = ayar('SHOOTBOARD_MCP_URL').rstrip('/')
    anahtar = ayar('SHOOTBOARD_KEY')
    sayi = 0
    for ad in temizlenecekler(kok, anahtar, defter):
        nesneler = nesneleri_bul(ad, defter[ad])
        silinen, sorun = r2_sil(nesneler)
        for s in sorun:
            print(f"  R2 silinemedi -> {s}")
        if sorun:
            continue                       # yarim isaret koyma: sonraki tur dener
        print(f"  temizlendi: {', '.join(silinen)}")
        defter[ad]['temiz'] = True
        defter_yaz(klasor, defter)
        sayi += 1
    return sayi


def _yama(kok, anahtar, kayit_id, govde):
    """PATCH /api/entries/{id}. Basarisizsa sys.exit eder, yoksa kaydi doner."""
    # ⛔ uploaded BURADA YOK ve olmayacak. Sartname Bolum 1.
    r = requests.patch(f"{kok}/api/entries/{kayit_id}", json=govde,
                       headers={"Authorization": f"Bearer {anahtar}"}, timeout=30)
    veri = r.json() if r.content else {}
    if not veri.get("ok"):
        sys.exit("Kayda yazilamadi: " + str(veri.get("error") or veri.get("message") or r.status_code))
    return veri["entry"]


def kayda_yaz(kok, anahtar, kayit_id, url, boyut, mime, ad, otomatik, kapak_url=None):
    govde = {"mediaUrl": url, "mediaBytes": boyut, "mediaMime": mime,
             "mediaName": ad, "autoPublish": bool(otomatik)}
    # REELS KAPAGI. Yalnizca verilirse gonderiliyor: None gecmek
    # "kapagi sil" demek olurdu ve story yolunda her cagri kapagi
    # bosaltirdi.
    if kapak_url:
        govde["coverUrl"] = kapak_url
    kayit = _yama(kok, anahtar, kayit_id, govde)

    # ⚠ POLITIKA YAZDIKTAN SONRA DA DENETLENIYOR.
    # Cagiran kararini kayitlari_bul'un verdigi platformla veriyor, ama
    # --id dalinda platform BILINMIYOR: orada otomatik=True gecilirse
    # tiktok ya da youtube kaydi sessizce yayina girerdi. Donen kayit
    # platformu tasiyor; politika ihlal edildiyse burada geri aliniyor.
    #
    # Normal yolda bu dal HIC CALISMIYOR (karar zaten dogru verildi),
    # yani ikinci bir istek maliyeti yok. Yalnizca ihlalde devreye
    # giriyor -- ve ihlalin sessiz kalmamasi, kapanmasindan once geliyor.
    if kayit.get("autoPublish") is True and not otomatik_mi(kayit.get("platform"),
                                                            kayit.get("type")):
        print(f"  ⚠ {kayit.get('platform') or '?'}/{kayit.get('type') or '?'} "
              f"otomatik yayinda DEGIL (politika) -- autoPublish geri kapatiliyor.")
        kayit = _yama(kok, anahtar, kayit_id, {"autoPublish": False})
    # ⚠ mediaName GERCEKTEN YAZILDI MI. Gonderdik diye yazildigini
    # varsaymak, 9 Ekim 2026'da ortaya cikan sessiz arizanin ta kendisi:
    # 2026-10-03_reels_tekfur_bes_hayat.mp4 R2'de duruyordu, bagli tek
    # kaydin mediaName'i ise BOSTU. Bedeli iki yonlu ve ikisi de sessiz --
    # o kayit bir daha dosyasini bulamiyor (yayinlanamaz), temizlik de
    # dosyayi tam adla eslestiremiyor (R2'de sonsuza kadar kaliyor).
    #
    # SYS.EXIT DEGIL, UYARI: yazma basarili dondu, dosya R2'de ve kayitta
    # mediaUrl var. Burada durmak, geri kalan kayitlari da yazilmamis
    # birakirdi -- yarim is, hicbir isten kotu.
    if str(kayit.get("mediaName") or "") != ad:
        print(f"  ⚠ mediaName yazilmadi: kayitta "
              f"'{kayit.get('mediaName') or '(bos)'}' goruyor, '{ad}' olmaliydi.")
        print(f"     Bu kayit dosyasini bulamaz ve R2 temizligi de onu "
              f"eslestiremez. Shootboard'da kaydi acip dosya adini elle yaz.")
    return kayit


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

    kayitlar = kaydi_bul(kok, anahtar, ad, a.id)
    for aday in kayitlar:
        oto = otomatik_mi(aday.get("platform"), aday.get("type"),
                          not a.otomatik_acma)
        kayit = kayda_yaz(kok, anahtar, aday["id"], url, boyut, mime, ad, oto)
        print(f"\nBAGLANDI  {kayit['id']}  ({kayit.get('platform') or '?'})")
        print(f"  yayin    : {kayit.get('publishAt') or '(tarih/saat eksik)'}")
        print(f"  otomatik : {'ACIK' if kayit.get('autoPublish') else 'kapali'}")
        print(f"  durum    : {kayit.get('publishState')}")
        if kayit.get("uyari") or kayit.get("warning"):
            print(f"  ⚠ {kayit.get('warning') or kayit.get('uyari')}")
        if not kayit.get("autoPublish"):
            print("  (Shootboard'da 'Otomatik yayinla' kutusunu isaretlemeyi unutma)")
    print()


if __name__ == "__main__":
    main()
