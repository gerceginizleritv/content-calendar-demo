#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R2 SUPURGESI — neyin silineceğine nasıl karar veriyor.

Bu test AĞ VE R2 KULLANMIYOR. Ölçülen şey tek bir şey: KARAR. Süpürge
silen bir araç; yanlış kararı geri alınamaz, o yüzden kuralların her
dalı ayrı ayrı ölçülüyor.

⚠ EN ÖNEMLİ İKİ ÖLÇÜM (ikisi de yıldızlı):

  · matchedBy 'date' bir EŞLEŞME SAYILMIYOR. /api/entries/find tam ad
    bulamazsa o günün BAŞKA kayıtlarını döndürüyor. Onların durumuna
    bakıp silmek, "başkası yayınlandı" diye bizim dosyamızı silmek
    olurdu — sonra bizimki yayınlanmaya çalışır ve adres 404 döner.

  · KAPAK TEK BAŞINA DEĞERLENDİRİLMİYOR. Hiçbir kaydın mediaName'i
    .jpg göstermez; kapak kendi başına sorulsaydı HER kapak "öksüz"
    çıkar ve yayında olan reels'lerin kapakları silinirdi.

⚠ BU DOSYAYLA MUTASYON TESTİ YAPARKEN: pc/__pycache__'i SİL.
Modül importlib ile kaynaktan yükleniyor ama Python bayt kodunu
önbelleğe alıyor; kaynağı geri aldıktan sonra eski bayt kodu
kullanılabiliyor ve test "hâlâ kırık" görünüyor.
"""
import io
import os
import sys
import datetime
import contextlib
import importlib.util

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PC = os.path.join(KOK, 'pc')

gecen = 0
kalan = 0


def bak(ad, kosul, ek=None):
    global gecen, kalan
    if kosul:
        gecen += 1
        print('  ok  ' + ad)
    else:
        kalan += 1
        print('  YOK ' + ad + (' -> ' + str(ek) if ek is not None else ''))


class SahteModul:
    def __getattr__(self, ad):
        return SahteModul()

    def __call__(self, *a, **k):
        return SahteModul()


for ad in ('boto3', 'requests'):
    if ad not in sys.modules:
        try:
            __import__(ad)
        except ImportError:
            sys.modules[ad] = SahteModul()
if 'botocore.config' not in sys.modules:
    try:
        __import__('botocore.config')
    except ImportError:
        sys.modules['botocore'] = SahteModul()
        sys.modules['botocore.config'] = SahteModul()


def modul_al(dosya, ad):
    yol = os.path.join(PC, dosya)
    spec = importlib.util.spec_from_file_location(ad, yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


sup = modul_al('r2-supurge.py', 'r2_supurge')

BUGUN = datetime.date(2026, 10, 10)
GECMIS = '2026-10-03'
GELECEK = '2026-12-20'


def cevap_ad(kayitlar):
    """Tam ad eşleşmesi döndüren find cevabı."""
    return {'ok': True, 'matchedBy': 'mediaName',
            'count': len(kayitlar), 'entries': kayitlar}


def k(oto, durum, platform='instagram'):
    return {'autoPublish': oto, 'publishState': durum, 'platform': platform}


# ══════════════════════════════════════════════════════════════════
print('[addan_tarih]')
bak('baştaki tarihi okuyor',
    sup.addan_tarih('2026-10-03_reels_konu.mp4') == datetime.date(2026, 10, 3))
bak('tarihsiz adda None', sup.addan_tarih('elle_yuklenen.mp4') is None)
# 2026-13-45 desene uyuyor ama tarih değil. date() ValueError atar;
# yakalanmazsa süpürge çöker ve hiçbir şey temizlenmez.
bak('★ geçersiz tarihte çökmüyor, None dönüyor',
    sup.addan_tarih('2026-13-45_reels_konu.mp4') is None)
bak('boş adda None', sup.addan_tarih('') is None)


# ══════════════════════════════════════════════════════════════════
print('\n[gruplar: kapak videosuna bağlanıyor]')
g = sup.gruplar(['2026-10-03_reels_a.mp4', '2026-10-03_reels_a.jpg'])
bak('★ aynı gövdeli kapak videonun grubuna giriyor',
    g == {'2026-10-03_reels_a.mp4': ['2026-10-03_reels_a.mp4',
                                     '2026-10-03_reels_a.jpg']}, g)

g = sup.gruplar(['2026-10-03_reels_a.mp4', '2026-10-03_reels_a_kapak.jpg'])
bak('★ _kapak ekli kapak da aynı videoya bağlanıyor',
    g == {'2026-10-03_reels_a.mp4': ['2026-10-03_reels_a.mp4',
                                     '2026-10-03_reels_a_kapak.jpg']}, g)

g = sup.gruplar(['2026-10-03_reels_a.jpg'])
bak('sahipsiz kapak kendi başına öge oluyor',
    g == {'2026-10-03_reels_a.jpg': ['2026-10-03_reels_a.jpg']}, g)

g = sup.gruplar(['2026-10-05_story_a.mp4', '2026-10-05_story_b.mov'])
bak('iki video iki ayrı öge',
    sorted(g) == ['2026-10-05_story_a.mp4', '2026-10-05_story_b.mov'], sorted(g))

g = sup.gruplar(['x.MP4', 'x.JPG'])
bak('büyük harfli uzantılar da eşleşiyor', g == {'x.MP4': ['x.MP4', 'x.JPG']}, g)


# ══════════════════════════════════════════════════════════════════
print('\n[karar: tam ad ile eşleşen dosyalar]')
karar, sebep = sup.nesne_karari('2026-10-03_reels_a.mp4',
                                cevap_ad([k(True, 'published'), k(True, 'published', 'facebook')]),
                                BUGUN, 30)
bak('otomatiklerin hepsi yayınlandı -> sil', karar == 'sil', (karar, sebep))

karar, sebep = sup.nesne_karari('2026-10-03_reels_a.mp4',
                                cevap_ad([k(True, 'published'), k(True, 'pending', 'facebook')]),
                                BUGUN, 30)
bak('★ bekleyen otomatik kayıt varsa DURUYOR', karar == 'dur', (karar, sebep))
bak('duruyor sebebi hangi platform olduğunu söylüyor', 'facebook' in sebep, sebep)

# Yayınlanmamış manuel kayıtlar dosyayı rehin tutmuyor: 7 Ekim 2026'da
# düzelttiğimiz asıl hata buydu (tiktok/youtube sonsuza kadar pending).
karar, sebep = sup.nesne_karari(
    '2026-10-03_reels_a.mp4',
    cevap_ad([k(True, 'published'), k(False, 'pending', 'tiktok'),
              k(False, 'pending', 'youtube'), k(False, 'pending', 'facebook')]),
    BUGUN, 30)
bak('★ otomatiği kapalı kayıtlar dosyayı rehin tutmuyor -> sil',
    karar == 'sil', (karar, sebep))

# tekfur_bes_hayat vakası: bağlı ama hiçbir kaydın otomatiği açık değil.
karar, sebep = sup.nesne_karari('2026-10-03_reels_a.mp4',
                                cevap_ad([k(False, 'pending', 'youtube')]),
                                BUGUN, 30)
bak('★ hiç otomatik kayıt yoksa SİLMİYOR, incelemeye koyuyor',
    karar == 'incele', (karar, sebep))


# ══════════════════════════════════════════════════════════════════
print('\n[karar: hiçbir kaydın taşımadığı adlar (öksüz)]')
yok = {'ok': False, 'error': 'no entry carries the file name'}

karar, sebep = sup.nesne_karari(GECMIS + '_story_deneme_k1.mp4', yok, BUGUN, 19)
bak('★ öksüz + tarihi geçmiş + eski -> sil', karar == 'sil', (karar, sebep))

karar, sebep = sup.nesne_karari(GELECEK + '_story_x.mp4', yok, BUGUN, 19)
bak('★ öksüz ama tarihi GELECEKTE -> duruyor', karar == 'dur', (karar, sebep))

karar, sebep = sup.nesne_karari(GECMIS + '_story_x.mp4', yok, BUGUN, 2)
bak('★ öksüz ama R2ye yeni yüklendi -> duruyor (yükleme yarışı)',
    karar == 'dur', (karar, sebep))

karar, sebep = sup.nesne_karari('elle_yuklenen.mp4', yok, BUGUN, 400)
bak('★ adında tarih yok -> İNCELE (asla kendiliğinden silinmiyor)',
    karar == 'incele', (karar, sebep))

karar, sebep = sup.nesne_karari(GECMIS + '_story_x.mp4', yok, BUGUN, None)
bak('R2 zamanı okunamadıysa -> incele', karar == 'incele', (karar, sebep))

karar, sebep = sup.nesne_karari(GECMIS + '_story_x.mp4', None, BUGUN, 400)
bak('takvime sorulamadıysa -> incele (silme kararı ağ hatasına dayanmıyor)',
    karar == 'incele', (karar, sebep))

# Bugünün kendisi "geçmiş" değil: o günün yayını henüz çıkmamış olabilir.
karar, _ = sup.nesne_karari('2026-10-10_story_x.mp4', yok, BUGUN, 30)
bak('★ bugün tarihli öksüz dosya silinmiyor', karar == 'dur', karar)


# ══════════════════════════════════════════════════════════════════
print('\n[karar: tarihe düşen cevap EŞLEŞME SAYILMIYOR]')
# En tehlikeli dal. find tam ad bulamayınca o günün kayıtlarını
# döndürüyor ve hepsi published olabilir. Bunu "eşleşti, yayınlandı"
# sayan bir süpürge, aynı gündeki BAŞKA bir dosyayı siler.
tarihe_dusen = {'ok': True, 'matchedBy': 'date', 'date': GECMIS,
                'count': 2, 'entries': [k(True, 'published'), k(True, 'published')]}
karar, sebep = sup.nesne_karari(GECMIS + '_story_baska.mp4', tarihe_dusen, BUGUN, 2)
bak('★ matchedBy=date + hepsi published + YENİ dosya -> DURUYOR',
    karar == 'dur', (karar, sebep))
bak('★ sebep "yayınlandı" demiyor, öksüz diyor',
    'yayinlan' not in sebep and 'oksuz' in sebep, sebep)


# ══════════════════════════════════════════════════════════════════
print('\n[r2_listele: sayfalar]')


class SahteS3:
    def __init__(self, sayfalar):
        self.sayfalar = sayfalar
        self.cagri = 0
        self.silinen = []

    def list_objects_v2(self, **kw):
        s = self.sayfalar[self.cagri]
        self.cagri += 1
        return s

    def delete_object(self, Bucket=None, Key=None):
        self.silinen.append(Key)


def nesne(ad, boyut=1048576, gun_once=30):
    return {'Key': ad, 'Size': boyut,
            'LastModified': datetime.datetime(2026, 10, 10) - datetime.timedelta(days=gun_once)}


s3 = SahteS3([
    {'Contents': [nesne('a.mp4')], 'IsTruncated': True, 'NextContinuationToken': 'j1'},
    {'Contents': [nesne('b.mp4')], 'IsTruncated': False},
])
liste = sup.r2_listele(s3, 'kova')
bak('★ ikinci sayfa da okunuyor (kova 1000 nesneyi geçince yarım kalmıyor)',
    [x['ad'] for x in liste] == ['a.mp4', 'b.mp4'], liste)

# IsTruncated true ama jeton yok: sonsuz döngüye girmemeli.
s3b = SahteS3([{'Contents': [nesne('a.mp4')], 'IsTruncated': True}])
bak('★ jetonsuz truncated cevapta sonsuz döngüye girmiyor',
    len(sup.r2_listele(s3b, 'kova')) == 1)


# ══════════════════════════════════════════════════════════════════
print('\n[baştan sona: --sil YALNIZCA silinebilir grubu siliyor]')

BUGUN_GERCEK = datetime.date.today()
ESKI = (BUGUN_GERCEK - datetime.timedelta(days=40)).isoformat()
YARIN = (BUGUN_GERCEK + datetime.timedelta(days=40)).isoformat()

KOVA = [
    # yayınlandı -> silinmeli, kapağıyla birlikte
    nesne(ESKI + '_reels_yayinlandi.mp4', gun_once=40),
    nesne(ESKI + '_reels_yayinlandi.jpg', gun_once=40),
    # bekleyen otomatik kaydı var -> DURMALI (kapağı da)
    nesne(ESKI + '_reels_bekliyor.mp4', gun_once=40),
    nesne(ESKI + '_reels_bekliyor.jpg', gun_once=40),
    # hiçbir kayıt taşımıyor, eski -> silinmeli
    nesne(ESKI + '_story_oksuz.mp4', gun_once=40),
    # hiç otomatik kaydı yok -> İNCELE, silinmemeli
    nesne(ESKI + '_reels_elle.mp4', gun_once=40),
    # geleceğe planlı öksüz -> durmalı
    nesne(YARIN + '_story_sonra.mp4', gun_once=40),
    # adında tarih yok -> incele
    nesne('elle_konan.mp4', gun_once=400),
]

CEVAPLAR = {
    ESKI + '_reels_yayinlandi.mp4': cevap_ad([k(True, 'published'),
                                              k(False, 'pending', 'tiktok')]),
    ESKI + '_reels_bekliyor.mp4': cevap_ad([k(True, 'pending')]),
    ESKI + '_reels_elle.mp4': cevap_ad([k(False, 'pending', 'youtube')]),
}


class SahteCevap:
    def __init__(self, govde):
        self.govde = govde
        self.content = b'{}'

    def json(self):
        return self.govde


class SahteIstek:
    def __init__(self):
        self.sorulan = []

    def get(self, url, params=None, headers=None, timeout=None):
        ad = (params or {}).get('file')
        self.sorulan.append(ad)
        return SahteCevap(CEVAPLAR.get(ad, {'ok': False, 'error': 'yok'}))


class SahteSY:
    def __init__(self, s3):
        self.s3 = s3

    def ayar(self, ad, zorunlu=True):
        return {'SHOOTBOARD_MCP_URL': 'https://x/mcp', 'SHOOTBOARD_KEY': 'shb_test',
                'R2_BUCKET': 'kova'}[ad]

    def r2_istemci(self):
        return self.s3

    def r2_sil(self, adlar):
        for a in adlar:
            self.s3.delete_object(Bucket='kova', Key=a)
        return list(adlar), []


def supurgeyi_kostur(argv):
    s3 = SahteS3([{'Contents': list(KOVA), 'IsTruncated': False}])
    sahte_sy = SahteSY(s3)
    eski_argv, eski_istek, eski_al = sys.argv, sup.requests, sup.story_yukleyiciyi_al
    istek = SahteIstek()
    sys.argv = ['r2-supurge.py'] + argv
    sup.requests = istek
    sup.story_yukleyiciyi_al = lambda: sahte_sy
    yazi = io.StringIO()
    try:
        with contextlib.redirect_stdout(yazi):
            sup.main()
    finally:
        sys.argv, sup.requests, sup.story_yukleyiciyi_al = eski_argv, eski_istek, eski_al
    return s3.silinen, yazi.getvalue(), istek.sorulan


silinen, cikti, sorulan = supurgeyi_kostur([])
bak('★ --sil VERİLMEDEN hiçbir şey silinmiyor', silinen == [], silinen)
bak('kuru turda ne kazanılacağı yazılıyor', 'silinebilir' in cikti, cikti[-300:])
bak('★ kapak kendi başına takvime SORULMUYOR (video adıyla soruluyor)',
    not any(s.endswith('.jpg') for s in sorulan), sorulan)
# '.jpg' < '.mp4': düz sıralama grubu kapağın adıyla başlıklandırıyordu
# ve karar kapağa aitmiş gibi okunuyordu. Başlık videonun adı olmalı.
satirlar = [x.strip() for x in cikti.splitlines()]
bak('★ grup başlığı VİDEONUN adı, kapağın değil',
    any(x.startswith(ESKI + '_reels_yayinlandi.mp4  (') for x in satirlar)
    and any(x == '+ ' + ESKI + '_reels_yayinlandi.jpg' for x in satirlar),
    [x for x in satirlar if 'yayinlandi' in x])

silinen, cikti, _ = supurgeyi_kostur(['--sil'])
bak('★ yayınlanan dosya SİLİNDİ', ESKI + '_reels_yayinlandi.mp4' in silinen, silinen)
bak('★ kapağı da silindi', ESKI + '_reels_yayinlandi.jpg' in silinen, silinen)
bak('★ öksüz eski dosya silindi', ESKI + '_story_oksuz.mp4' in silinen, silinen)
bak('★ bekleyen yayını olan dosya SİLİNMEDİ',
    ESKI + '_reels_bekliyor.mp4' not in silinen, silinen)
bak('★ bekleyenin kapağı da silinmedi',
    ESKI + '_reels_bekliyor.jpg' not in silinen, silinen)
bak('★ hiç otomatiği olmayan dosya SİLİNMEDİ (incele grubunda)',
    ESKI + '_reels_elle.mp4' not in silinen, silinen)
bak('★ geleceğe planlı dosya SİLİNMEDİ', YARIN + '_story_sonra.mp4' not in silinen, silinen)
bak('★ tarihsiz dosya SİLİNMEDİ', 'elle_konan.mp4' not in silinen, silinen)
bak('silinen sayısı tam olarak 3 (2 nesne + 1 kapak)', len(silinen) == 3, silinen)


# ══════════════════════════════════════════════════════════════════
print('\n[kaynak güvenceleri]')
kaynak = open(os.path.join(PC, 'r2-supurge.py'), encoding='utf-8').read()
bak('★ --sil varsayılan DEĞİL (kazara silme yok)',
    "'--sil', action='store_true'" in kaynak)
# Süpürge SALT OKUR + SİLER. Takvime hiçbir şey yazmaz; yazsaydı
# ⛔ `uploaded` kuralı (Şartname Bölüm 1) burada da riske girerdi.
bak('★ takvime hiçbir şey YAZMIYOR (yalnızca okur ve R2den siler)',
    'requests.patch' not in kaynak and 'requests.post' not in kaynak
    and 'uploaded' not in kaynak)
bak('silme yalnızca sonuc["sil"] üzerinden',
    "silinebilir = sonuc['sil']" in kaynak and kaynak.count('sy.r2_sil(') == 1)


# ══════════════════════════════════════════════════════════════════
print('\n[yükleyici: mediaName yazılmadıysa uyarıyor]')
sy_kaynak = open(os.path.join(PC, 'story-yukle.py'), encoding='utf-8').read()
bak('★ kayda_yaz dönen mediaName\'i gönderilenle karşılaştırıyor',
    'if str(kayit.get("mediaName") or "") != ad:' in sy_kaynak)
bak('uyarı sys.exit etmiyor (kalan kayıtlar yazılsın)',
    'mediaName yazilmadi' in sy_kaynak
    and 'sys.exit("  ⚠ mediaName' not in sy_kaynak)

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
