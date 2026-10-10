#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OTOMATİK YAYIN POLİTİKASI — hangi platform kendiliğinden çıkar.

10 Ekim 2026'da ölçülen arıza: yükleyicide `otomatik_ac` TEK BİR GLOBAL
BAYRAKTI ve eşleşen her kayda uygulanıyordu. Bir reels dosyası dört
kayıt buluyor (ig/fb/tt reels + yt shorts) ve dördünün de autoPublish'ini
açıyordu. O gün 66 kayıt (26 tiktok, 24 youtube, 16 facebook) otomatik
yayında duruyordu; ikisi iki gün sonraydı ve biri YouTube'du — denetim
kapısı kapalıyken oraya video gidecekti.

Kayıtları elle kapatmak yetmiyordu: izleyici bir sonraki dosyada hepsini
YENİDEN AÇACAKTI. Bu test o geri dönüşü ölçüyor.

⚠ EN ÖNEMLİ ÜÇ ÖLÇÜM (yıldızlı):
  · tabloda olmayan çift KAPALI sayılıyor — yeni bir platform sessizce
    yayına başlamıyor
  · karar KAYIT BAŞINA veriliyor — aynı dosyanın dört kaydı aynı kaderi
    paylaşmıyor
  · --id yolunda platform bilinmiyor; politikayı YAZDIKTAN SONRAKI
    denetim uyguluyor, yoksa orada sessiz bir delik kalırdı

⚠ BU DOSYAYLA MUTASYON TESTİ YAPARKEN: pc/__pycache__'i SİL.
"""
import io
import os
import sys
import shutil
import tempfile
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
    def __getattr__(self, ad): return SahteModul()
    def __call__(self, *a, **k): return SahteModul()


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


sy = modul_al('story-yukle.py', 'story_yukle')
ry = modul_al('reels-yukle.py', 'reels_yukle')
ri = modul_al('reels-izle.py', 'reels_izle')
si = modul_al('story-izle.py', 'story_izle')


# ══════════════════════════════════════════════════════════════════
print('[tablo: kullanıcının 10 Ekim 2026 kararı]')
ACIK = [('instagram', 'story'), ('facebook', 'story'), ('instagram', 'reels')]
KAPALI = [('facebook', 'reels'), ('tiktok', 'reels'), ('youtube', 'shorts')]

for p, t in ACIK:
    bak(f'{p}/{t} AÇIK', sy.otomatik_mi(p, t) is True)
for p, t in KAPALI:
    bak(f'★ {p}/{t} kapalı', sy.otomatik_mi(p, t) is False)

# Tabloda fazlası olmasın: ileride biri "zaten açıktı" diye eklemesin.
bak('★ tabloda açık olan TAM OLARAK bu üçü',
    sorted(x for x, v in sy.OTOMATIK_YAYIN.items() if v) == sorted(ACIK),
    [x for x, v in sy.OTOMATIK_YAYIN.items() if v])


# ══════════════════════════════════════════════════════════════════
print('\n[bilinmeyen çift KAPALI varsayılıyor]')
# Ters varsayım (bilinmeyeni aç) yukarıdaki arızanın genel hali olurdu:
# yeni bir platform eklenir ve kimse fark etmeden yayına başlar.
bak('★ tabloda olmayan platform kapalı', sy.otomatik_mi('threads', 'reels') is False)
bak('★ tabloda olmayan tür kapalı', sy.otomatik_mi('instagram', 'video') is False)
bak('boş platform kapalı', sy.otomatik_mi('', 'story') is False)
bak('None kapalı', sy.otomatik_mi(None, None) is False)
bak('büyük harf de tanınıyor', sy.otomatik_mi('Instagram', 'STORY') is True)


# ══════════════════════════════════════════════════════════════════
print('\n[--otomatik-acma politikayı GENİŞLETMİYOR, sadece kısıtlıyor]')
bak('★ istenen False ise açık çift bile kapalı',
    sy.otomatik_mi('instagram', 'story', False) is False)
bak('istenen False ise kapalı çift yine kapalı',
    sy.otomatik_mi('tiktok', 'reels', False) is False)


# ══════════════════════════════════════════════════════════════════
print('\n[kayda_yaz: yazdıktan sonraki denetim (--id yolundaki delik)]')


class SahteYanit:
    def __init__(s, govde): s.govde = govde; s.content = b'{}'
    def json(s): return s.govde


class SahteIstek:
    """PATCH'leri sayar. Sunucu autoPublish'i gönderildiği gibi döndürür."""
    def __init__(s, platform, tur):
        s.patchler = []
        s.platform, s.tur = platform, tur
        s.oto = False

    def patch(s, url, json=None, headers=None, timeout=None):
        s.patchler.append(dict(json or {}))
        if 'autoPublish' in (json or {}):
            s.oto = bool(json['autoPublish'])
        return SahteYanit({'ok': True, 'entry': {
            'id': 'x', 'platform': s.platform, 'type': s.tur,
            'mediaName': 'v.mp4', 'autoPublish': s.oto, 'publishState': 'pending'}})


def yaz(platform, tur, otomatik):
    istek = SahteIstek(platform, tur)
    eski = sy.requests
    sy.requests = istek
    yazi = io.StringIO()
    try:
        with contextlib.redirect_stdout(yazi):
            kayit = sy.kayda_yaz('http://k', 'a', 'x', 'https://u/v.mp4', 10,
                                 'video/mp4', 'v.mp4', otomatik)
    finally:
        sy.requests = eski
    return kayit, istek.patchler, yazi.getvalue()


kayit, patchler, cikti = yaz('instagram', 'reels', True)
bak('izinli çiftte TEK patch (düzeltme maliyeti yok)', len(patchler) == 1, patchler)
bak('izinli çiftte autoPublish açık kalıyor', kayit['autoPublish'] is True)

# --id ile çağrıldığında kaydi_bul platformu bilmiyor ve çağıran
# otomatik=True geçebiliyor. Denetim olmasaydı tiktok sessizce açılırdı.
kayit, patchler, cikti = yaz('tiktok', 'reels', True)
bak('★ yasak çiftte İKİNCİ patch atılıyor', len(patchler) == 2, patchler)
bak('★ ikinci patch autoPublish: False',
    len(patchler) > 1 and patchler[1] == {'autoPublish': False}, patchler)
bak('★ dönen kayıtta autoPublish kapalı', kayit['autoPublish'] is False, kayit)
bak('★ geri alma SESSİZ DEĞİL, sebebiyle yazılıyor',
    'politika' in cikti and 'tiktok' in cikti, cikti.strip()[:90])

kayit, patchler, cikti = yaz('youtube', 'shorts', True)
bak('★ youtube/shorts da geri alınıyor (denetim kapısı)',
    len(patchler) == 2 and kayit['autoPublish'] is False, patchler)

kayit, patchler, _ = yaz('tiktok', 'reels', False)
bak('zaten kapalıysa ikinci patch yok', len(patchler) == 1, patchler)


# ══════════════════════════════════════════════════════════════════
print('\n[baştan sona: aynı dosyanın dört kaydı aynı kaderi paylaşmıyor]')
gecici = tempfile.mkdtemp(prefix='shb-politika-')
try:
    class SahteRY:
        EN_BUYUK = 1024 * 1024 * 1024
        def tur_bul(self, yol): return 'video/mp4'
        def kapak_yukle(self, sy_, yol, mime, zorla): return 'https://r2/k.jpg', []

    class SahteSY:
        """Yalnızca ağ/R2 sahte. POLİTİKA GERÇEK."""
        def __init__(s, kayitlar):
            s.kayitlar = kayitlar
            s.yazilan = {}
        def ayar(s, ad, zorunlu=True): return 'https://x' if 'URL' in ad else 'k'
        def kaydi_bul(s, kok, anahtar, ad, kayit_id=None, tur_adi='reels'):
            return s.kayitlar
        def r2_yukle(s, yol, ad, mime): return 'https://r2/' + ad
        def adresi_dene(s, *a, **k): return []
        otomatik_mi = staticmethod(sy.otomatik_mi)
        def kayda_yaz(s, kok, anahtar, kayit_id, url, boyut, mime, ad,
                      otomatik, kapak_url=None):
            s.yazilan[kayit_id] = otomatik
            return {'id': kayit_id, 'platform': kayit_id, 'type': 'reels',
                    'mediaName': ad, 'autoPublish': otomatik, 'coverUrl': kapak_url,
                    'publishAt': '2026-11-07T07:00:00Z', 'publishState': 'pending'}

    DORTLU = [{'id': 'instagram', 'platform': 'instagram', 'type': 'reels'},
              {'id': 'facebook',  'platform': 'facebook',  'type': 'reels'},
              {'id': 'tiktok',    'platform': 'tiktok',    'type': 'reels'},
              {'id': 'youtube',   'platform': 'youtube',   'type': 'shorts'}]

    v = os.path.join(gecici, '2026-11-07_reels_ishak_pasa_kapilar.mp4')
    open(v, 'wb').write(b'x' * 2048)

    rsy = SahteSY(DORTLU)
    with contextlib.redirect_stdout(io.StringIO()):
        ri.dosyayi_isle(SahteRY(), rsy, v, os.path.basename(v), None, None, True, False)

    bak('★ instagram/reels AÇILDI', rsy.yazilan.get('instagram') is True, rsy.yazilan)
    bak('★ facebook/reels açılmadı', rsy.yazilan.get('facebook') is False, rsy.yazilan)
    bak('★ tiktok/reels açılmadı', rsy.yazilan.get('tiktok') is False, rsy.yazilan)
    bak('★ youtube/shorts açılmadı (denetim kapısı kapalı)',
        rsy.yazilan.get('youtube') is False, rsy.yazilan)
    bak('dört kaydın dördü de yazıldı (politika kaydı atlamıyor)',
        len(rsy.yazilan) == 4, rsy.yazilan)

    # --otomatik-acma: hepsi kapalı.
    rsy2 = SahteSY(DORTLU)
    with contextlib.redirect_stdout(io.StringIO()):
        ri.dosyayi_isle(SahteRY(), rsy2, v, os.path.basename(v), None, None, False, False)
    bak('★ --otomatik-acma ile dördü de kapalı',
        set(rsy2.yazilan.values()) == {False}, rsy2.yazilan)

    # Story yolu: ig + fb story İKİSİ DE açık kalmalı. Facebook story
    # sorunsuz çalışıyor; reels kapanması onu kapatmamalı.
    class SahteStorySY(SahteSY):
        EN_BUYUK = 100 * 1024 * 1024
        def tur_bul(s, yol): return 'video/mp4'
        def kayda_yaz(s, kok, anahtar, kayit_id, url, boyut, mime, ad, otomatik):
            s.yazilan[kayit_id] = otomatik
            return {'id': kayit_id, 'platform': kayit_id, 'type': 'story',
                    'mediaName': ad, 'autoPublish': otomatik,
                    'publishAt': '2026-11-07T06:00:00Z', 'publishState': 'pending'}

    sv = os.path.join(gecici, '2026-11-07_story_konu_k1.mp4')
    open(sv, 'wb').write(b'x' * 1024)
    # ⚠ ÜÇÜNCÜ KAYIT BİLEREK yt/shorts. İki story kaydıyla ölçmek
    # YETMİYORDU: ikisi de izinli olduğu için politikayı tamamen atlayan
    # bir story-izle.py de aynı sonucu veriyordu (mutasyon 7 hayatta
    # kaldı). Oysa /api/entries/find mediaName'i YAYIN_TURLERI boyunca
    # eşleştiriyor (story + reels + shorts), yani bir story dosyasına
    # bağlı bir shorts kaydı gerçek bir durum -- 27 Eylül 2026'da tam
    # olarak bu oldu.
    ssy = SahteStorySY([{'id': 'instagram', 'platform': 'instagram', 'type': 'story'},
                        {'id': 'facebook',  'platform': 'facebook',  'type': 'story'},
                        {'id': 'youtube',   'platform': 'youtube',   'type': 'shorts'}])
    with contextlib.redirect_stdout(io.StringIO()):
        si.dosyayi_isle(ssy, sv, os.path.basename(sv), True, False)
    bak('★ instagram/story AÇIK kalıyor', ssy.yazilan.get('instagram') is True, ssy.yazilan)
    bak('★ facebook/story AÇIK kalıyor (reels kapanması story\'yi kapatmadı)',
        ssy.yazilan.get('facebook') is True, ssy.yazilan)
    bak('★ story yolunda da politika işliyor: yt/shorts kaydı açılmadı',
        ssy.yazilan.get('youtube') is False, ssy.yazilan)
finally:
    shutil.rmtree(gecici, ignore_errors=True)


# ══════════════════════════════════════════════════════════════════
print('\n[tablo TEK YERDE]')
# Aynı kümeyi taşıyan ikinci bir kopya, buradaki bir değişikliğin öteki
# tarafa hiç geçmemesi demek. Depoda bu hata üç kez yaşandı.
#
# ⚠ ARANAN ŞEY TABLONUN TANIMI, ADIN GEÇMESİ DEĞİL. İlk hâli
# 'OTOMATIK_YAYIN' not in kaynak idi ve story-izle.py'deki bir YORUMA
# takıldı ("politika story-yukle.py'de"). Yorumu silmek ölçümü
# kurtarırdı ama ölçüm yanlış şeye bakıyordu: kopya, tablonun ikinci kez
# TANIMLANMASI.
for dosya in ('reels-izle.py', 'story-izle.py', 'reels-yukle.py'):
    kaynak = open(os.path.join(PC, dosya), encoding='utf-8').read()
    bak(f'★ {dosya} tabloyu yeniden tanımlamıyor',
        'OTOMATIK_YAYIN = ' not in kaynak and 'def otomatik_mi' not in kaynak)

sy_kaynak = open(os.path.join(PC, 'story-yukle.py'), encoding='utf-8').read()
bak('tablo story-yukle.py\'de', 'OTOMATIK_YAYIN = {' in sy_kaynak)
bak('⛔ politika uploaded sütununa dokunmuyor',
    'uploaded' not in sy_kaynak.split('def kayda_yaz')[1].split('def main')[0])

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
