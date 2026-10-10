#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R2'de kalmis dosyalari bulur; onaylarsan siler.

    python r2-supurge.py            # YALNIZCA LISTELER, hicbir sey silmez
    python r2-supurge.py --sil      # listedeki 'SILINEBILIR' grubu siler

NEDEN AYRI BIR KOMUT VAR
  Izleyicilerin icindeki temizlik (story-yukle.py: temizlenecekler) R2'ye
  HIC BAKMIYOR. PC'deki klasorde duran deftere bakip "bunlardan hangisi
  yayinlandi?" diye soruyor. Yani defterde girdisi olmayan bir nesneyi
  hicbir kod goremiyor -- ve girdi su durumlarin hepsinde kayboluyor:

    · klasor bosaltildi          · defter dosyasi silindi / PC degisti
    · dosya elle R2'ye kondu     · yuklendikten sonra adi degistirildi

  9 Ekim 2026'da kovada iki ornegi goruldu:
    2026-10-05_story_deneme_k1.mp4     21 Eylul'de yuklenmis bir deneme;
                                       hicbir kayit bu adi tasimiyor.
    2026-10-03_reels_tekfur_bes_hayat  bagli tek kaydin (yt shorts)
      .mp4 + .jpg                      mediaName'i BOS, otomatigi kapali.

  Bu komut tersinden calisiyor: KOVAYI listeliyor, her nesne icin
  takvime soruyor. Defterden bagimsiz, hangi PC'de kosarsa kossun.

NE SILER, NE SILMEZ
  SILINEBILIR  · bagli kayitlarin otomatik yayinlari tamamlandi
               · ya da: hicbir kayit bu adi tasimiyor, adindaki tarih
                 gecmis ve nesne R2'de en az BEKLEME_GUN gundur duruyor
  DURUYOR      · otomatik yayini acik ama henuz cikmamis kayit var
               · tarihi gelecekte, ya da nesne daha cok yeni
  INCELE       · takvime sorulamadi (ag hatasi)
               · adinda tarih yok ve hicbir kayda bagli degil
               · bagli ama HICBIR kaydin otomatik yayini acik degil
                 -- sistem bu dosyayi hic kullanmayacak, kararini sen ver

  ⚠ --sil YALNIZCA 'SILINEBILIR' grubu siler. 'INCELE' ve 'DURUYOR'
  gruplarina hicbir kipte dokunulmuyor. Yanlis silmek geri alinamaz;
  silmemek yalnizca yer kaplar.

  ⚠ KAPAK VIDEOSUYLA AYNI KADERI PAYLASIYOR. Reels kapagi (.jpg) ayri
  bir nesne ve hicbir kaydin mediaName'i onu gostermiyor -- tek basina
  degerlendirilseydi HER kapak "oksuz" cikar ve yayinda olan reels'lerin
  kapaklari silinirdi. Bu yuzden kapak, ayni govdeli videonun kararina
  bagli.

KURULUM
  story-yukle.py ile ayni klasorde durmali: R2 baglantisi, ayar okuma ve
  silme oradan geliyor. Ortam degiskenleri de ayni (bak: story-yukle.py
  basindaki KURULUM bolumu).
"""
import os
import re
import sys
import argparse
import datetime
import importlib.util

try:
    import requests
except ImportError:
    sys.exit("requests yok. Kur:  pip install boto3 requests")

BURASI = os.path.dirname(os.path.abspath(__file__))

# Oksuz bir nesne silinmeden once R2'de beklemesi gereken sure.
#
# ⚠ BU SAYI BIR YARISIN PANZEHIRI. Yukleyici once R2'ye koyuyor, SONRA
# kayda mediaName yaziyor. Arasinda saniyeler var ama sifir degil; ve
# kayit henuz acilmamissa yukleyici 'kayit yok' deyip cikiyor, dosya
# kovada kaliyor, kayit ertesi gun aciliyor. Bekleme olmasaydi supurge
# o araliga denk gelen her dosyayi "oksuz" sayip silerdi.
BEKLEME_GUN = 7

VIDEO_UZANTI = {'.mp4', '.mov'}
KAPAK_UZANTI = {'.jpg', '.jpeg', '.png'}
# reels-yukle.py'deki KAPAK_EKLERI ile ayni: kapak ya videonun tam adini
# tasiyor ya da sonuna bu eki aliyor.
KAPAK_EKLERI = ['', '_kapak']

TARIH_DESENI = re.compile(r'(\d{4})-(\d{2})-(\d{2})')


def story_yukleyiciyi_al():
    """story-yukle.py'yi ice aktar. Ad tire icerdigi icin duz import olmuyor."""
    yol = os.path.join(BURASI, 'story-yukle.py')
    if not os.path.isfile(yol):
        sys.exit(f"story-yukle.py bulunamadi: {yol}\n"
                 f"Iki script ayni klasorde durmali (ortak kod oradan geliyor).")
    spec = importlib.util.spec_from_file_location('story_yukle', yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def addan_tarih(ad):
    """Dosya adinin basindaki tarih. Yoksa None.

    Desen adin HER YERINDE araniyor degil, ILK eslesme aliniyor: adlandirma
    kurali tarihi basa koyuyor (2026-10-03_reels_konu.mp4) ve icerideki bir
    sayi dizisi yanlislikla tarih sayilmasin diye tam bicim zorunlu.
    """
    m = TARIH_DESENI.search(str(ad or ''))
    if not m:
        return None
    try:
        return datetime.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None          # 2026-13-45 gibi bir sey: tarih degil


def gruplar(adlar):
    """Nesne adlarini {birincil_ad: [gruptaki tum adlar]} seklinde toplar.

    Birincil olan VIDEO. Ayni govdeli kapak (.jpg/.png) ona ekleniyor;
    eslesecek video bulamayan kapak kendi basina birincil oluyor (o zaman
    gercekten oksuz olabilir ve oyle degerlendirilmeli).
    """
    videolar = {}
    for ad in adlar:
        govde, uzanti = os.path.splitext(ad)
        if uzanti.lower() in VIDEO_UZANTI:
            videolar.setdefault(govde, ad)

    cikti = {ad: [ad] for ad in videolar.values()}
    for ad in adlar:
        govde, uzanti = os.path.splitext(ad)
        if uzanti.lower() not in KAPAK_UZANTI:
            continue
        sahibi = None
        for ek in KAPAK_EKLERI:
            aday = govde[:-len(ek)] if ek and govde.endswith(ek) else govde
            if ek and aday == govde:
                continue     # ek bu ada uymuyor
            if aday in videolar:
                sahibi = videolar[aday]
                break
        if sahibi:
            cikti[sahibi].append(ad)
        else:
            cikti.setdefault(ad, [ad])
    return cikti


def nesne_karari(ad, cevap, bugun, yas_gun, bekleme=BEKLEME_GUN):
    """Bir nesne icin karar. Doner: ('sil'|'dur'|'incele', sebep).

    SAF ISLEV: ag yok, saat yok, R2 yok. Tum girdiler disaridan geliyor ki
    testi kurallari dogrudan olcsun. `cevap`, /api/entries/find govdesi;
    ag hatasinda None.
    """
    if cevap is None:
        return ('incele', 'takvime sorulamadi (ag hatasi) -- bir daha dene')

    # ⚠ YALNIZCA TAM AD ESLESMESI "bu dosyanin kaydi" demek.
    # matchedBy 'date' oldugunda endpoint o GUNUN baska kayitlarini
    # donduruyor; onlarin durumuna bakip silmek, baskasi yayinlandi diye
    # bizim dosyamizi silmek olurdu. story-yukle.py'deki yayin_durumlari
    # ayni korumayi tasiyor.
    if cevap.get('ok') and cevap.get('matchedBy') == 'mediaName':
        kayitlar = cevap.get('entries') or []
        otomatikler = [k for k in kayitlar if k.get('autoPublish') is True]
        if not otomatikler:
            return ('incele',
                    'bagli ama hicbir kaydin otomatik yayini acik degil -- '
                    'sistem bu dosyayi hic kullanmayacak')
        bekleyen = [k for k in otomatikler
                    if str(k.get('publishState') or '') != 'published']
        if bekleyen:
            nerede = ', '.join(sorted({str(k.get('platform') or '?') for k in bekleyen}))
            return ('dur', f'otomatik yayini acik ama henuz cikmamis kayit var ({nerede})')
        return ('sil', f'bagli {len(otomatikler)} otomatik kaydin hepsi yayinlandi')

    # Buraya gelmek "hicbir kayit bu adi tasimiyor" demek: ya 404, ya da
    # endpoint tarihe dusmus.
    tarih = addan_tarih(ad)
    if tarih is None:
        return ('incele', 'hicbir kayda bagli degil ve adinda tarih yok')
    if tarih >= bugun:
        return ('dur', f'oksuz ama tarihi gelecekte ({tarih}) -- kayit sonra acilabilir')
    if yas_gun is None:
        return ('incele', 'hicbir kayda bagli degil; R2 yuklenme tarihi okunamadi')
    if yas_gun < bekleme:
        return ('dur', f'oksuz ama R2ye {yas_gun} gun once yuklendi '
                       f'({bekleme} gun bekleniyor)')
    return ('sil', f'oksuz: hicbir kayit bu adi tasimiyor, tarihi {tarih} (gecmis)')


def r2_listele(s3, kova):
    """Kovadaki tum nesneler: [{'ad','boyut','zaman'}]. Sayfalari dolasir."""
    nesneler = []
    jeton = None
    while True:
        ek = {'ContinuationToken': jeton} if jeton else {}
        cevap = s3.list_objects_v2(Bucket=kova, **ek)
        for n in cevap.get('Contents') or []:
            nesneler.append({'ad': n['Key'], 'boyut': n.get('Size') or 0,
                             'zaman': n.get('LastModified')})
        if not cevap.get('IsTruncated'):
            break
        jeton = cevap.get('NextContinuationToken')
        if not jeton:
            break            # IsTruncated true ama jeton yok: sonsuz donguye girme
    return nesneler


def takvime_sor(kok, anahtar, ad):
    """/api/entries/find govdesi; ag hatasinda None.

    404 HATA DEGIL: "bu adi tasiyan kayit yok" demek ve karar icin gecerli
    bir cevap. Yalnizca istegin kendisi basarisiz olursa None donuyor.
    """
    try:
        r = requests.get(f"{kok}/api/entries/find", params={'file': ad},
                         headers={'Authorization': f'Bearer {anahtar}'}, timeout=30)
        return r.json() if r.content else {}
    except Exception as e:
        print(f"  ! {ad}: {e}")
        return None


def mb(bayt):
    return f"{bayt / 1048576:.1f} MB"


def main():
    ap = argparse.ArgumentParser(
        description="R2'de kalmis dosyalari listeler; --sil verilirse silinebilir olanlari siler.")
    ap.add_argument('--sil', action='store_true',
                    help="SILINEBILIR grubu gercekten sil. Verilmezse hicbir sey silinmez.")
    ap.add_argument('--gun', type=int, default=BEKLEME_GUN,
                    help=f"Oksuz bir nesne silinmeden once beklenecek gun (varsayilan {BEKLEME_GUN}).")
    ap.add_argument('--onek', default='',
                    help="Yalnizca bu onekle baslayan nesnelere bak (orn. 2026-09).")
    a = ap.parse_args()

    sy = story_yukleyiciyi_al()
    kok = sy.ayar('SHOOTBOARD_MCP_URL').rstrip('/')
    anahtar = sy.ayar('SHOOTBOARD_KEY')
    kova = sy.ayar('R2_BUCKET')
    s3 = sy.r2_istemci()

    print(f"\nr2://{kova} listeleniyor...")
    nesneler = r2_listele(s3, kova)
    if a.onek:
        nesneler = [n for n in nesneler if n['ad'].startswith(a.onek)]
    bilgi = {n['ad']: n for n in nesneler}
    print(f"{len(nesneler)} nesne, toplam {mb(sum(n['boyut'] for n in nesneler))}\n")
    if not nesneler:
        return

    bugun = datetime.date.today()
    kumeler = gruplar([n['ad'] for n in nesneler])
    print(f"{len(kumeler)} oge icin takvime soruluyor "
          f"(kapaklar videosuyla birlikte degerlendiriliyor)...\n")

    sonuc = {'sil': [], 'dur': [], 'incele': []}
    for birincil in sorted(kumeler):
        # ⚠ BIRINCIL BASTA DURUYOR, duz sort DEGIL. '.jpg' < '.mp4'
        # oldugu icin alfabetik siralama grubu KAPAGIN adiyla
        # basliklandiriyordu: ekranda 52 MB'lik bir ".jpg" gorunuyor ve
        # karar da ona aitmis gibi okunuyordu. Karari veren video.
        adlar = [birincil] + sorted(x for x in kumeler[birincil] if x != birincil)
        n = bilgi[birincil]
        zaman = n.get('zaman')
        yas = (bugun - zaman.date()).days if zaman is not None else None
        karar, sebep = nesne_karari(birincil, takvime_sor(kok, anahtar, birincil),
                                    bugun, yas, a.gun)
        sonuc[karar].append({'adlar': adlar, 'sebep': sebep,
                             'boyut': sum(bilgi[x]['boyut'] for x in adlar)})

    basliklar = [('sil', 'SILINEBILIR'), ('incele', 'INCELE'), ('dur', 'DURUYOR')]
    for anahtar_g, baslik in basliklar:
        oge = sonuc[anahtar_g]
        toplam = sum(o['boyut'] for o in oge)
        print(f"\n{'=' * 66}\n{baslik}  --  {len(oge)} oge, {mb(toplam)}\n{'=' * 66}")
        for o in sorted(oge, key=lambda x: x['adlar'][0]):
            print(f"  {o['adlar'][0]}  ({mb(o['boyut'])})")
            for ek in o['adlar'][1:]:
                print(f"    + {ek}")
            print(f"    {o['sebep']}")

    silinebilir = sonuc['sil']
    kazanc = sum(o['boyut'] for o in silinebilir)
    print()
    if not silinebilir:
        print("Silinecek bir sey yok.")
        return
    if not a.sil:
        print(f"{len(silinebilir)} oge silinebilir, {mb(kazanc)} yer acilir.")
        print("Listeyi onayliyorsan ayni komutu --sil ile calistir:")
        print("    python r2-supurge.py --sil")
        return

    print(f"Siliniyor: {len(silinebilir)} oge, {mb(kazanc)}\n")
    silinen_oge = 0
    for o in sorted(silinebilir, key=lambda x: x['adlar'][0]):
        silinen, sorun = sy.r2_sil(o['adlar'])
        for s in sorun:
            print(f"  silinemedi -> {s}")
        if silinen:
            print(f"  silindi: {', '.join(silinen)}")
        if not sorun:
            silinen_oge += 1
    print(f"\n{silinen_oge}/{len(silinebilir)} oge silindi.")


if __name__ == '__main__':
    main()
