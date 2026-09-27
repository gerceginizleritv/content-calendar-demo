#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""REELS YUKLEYICISI — klasorden kayda giden yol.

Bu test AG KULLANMIYOR: R2 yuklemesi, adres denemesi ve Shootboard
cagrilari sahte. Olculen sey KARAR MANTIGI:

  · hangi dosyalar ise giriyor (video evet, kapak hayir),
  · kapak hangi dosyayla eslesiyor,
  · defter neyi bir daha yuklemiyor,
  · kapak eklenince/degisince ne oluyor.

⚠ EN ONEMLI OLCUM: KAPAK SONRADAN EKLENDIGINDE.
Defter yalnizca videonun imzasina bakiyor olsaydi, kapagi sonradan
konan bir reel "zaten baglandi" diye atlanir ve kapak HIC gitmezdi --
hicbir yerde hata gorunmeden.

⚠ BU DOSYAYLA MUTASYON TESTI YAPARKEN: pc/__pycache__'i SIL.
Moduller importlib ile kaynaktan yukleniyor ama Python bayt kodunu
onbellege aliyor. Kaynagi mutasyondan geri aldiktan sonra eski bayt
kodu kullanilabiliyor ve test "hala kirik" gorunuyor -- 27 Eylul
2026'da tam bu oldu ve bes dakika bosa gitti. Her mutasyon turundan
once:  rm -rf pc/__pycache__
"""
import io
import os
import re
import sys
import json
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


def modul_al(dosya, ad):
    yol = os.path.join(PC, dosya)
    spec = importlib.util.spec_from_file_location(ad, yol)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# boto3/requests kurulu olmayabilir: story-yukle.py ikisini de import
# ediyor ve yoksa sys.exit ediyor. Testin konusu onlar degil.
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

ry = modul_al('reels-yukle.py', 'reels_yukle')
sy = modul_al('story-yukle.py', 'story_yukle')
ri = modul_al('reels-izle.py', 'reels_izle')


def dosya_yaz(yol, icerik=b'x' * 64):
    with open(yol, 'wb') as f:
        f.write(icerik)


# ══════════════════════════════════════════════════════════════════
print('[tur kurallari]')
bak('mp4 kabul', ry.tur_bul('a.mp4') == 'video/mp4')
bak('mov kabul', ry.tur_bul('a.mov') == 'video/quicktime')
# Reels VIDEO olmak zorunda. Fotografi burada durdurmak, worker'in
# kalici hatasini yayin gunune birakmaktan iyi.
try:
    ry.tur_bul('a.jpg')
    bak('★ fotograf reddediliyor', False, 'kabul edildi')
except SystemExit as e:
    bak('★ fotograf reddediliyor', 'video olmak zorunda' in str(e.code), str(e.code)[:70])

print('[boyut siniri MCP ile ayni]')
# Iki yerde duran bir sayi: burada gecen dosya kayda yazilirken
# reddedilirse kullanici sebebini anlayamaz.
mcp = open(os.path.join(KOK, 'supabase', 'functions', 'mcp', 'index.ts'), encoding='utf-8').read()
bak('★ reels tavani MCP tarafinda da 1 GB',
    'reel ? 1024 * 1024 * 1024 : 100 * 1024 * 1024' in mcp,
    'mcp/index.ts icinde bulunamadi')
bak('yukleyici tavani 1 GB', ry.EN_BUYUK == 1024 * 1024 * 1024, ry.EN_BUYUK)
bak('story tavani DEGISMEDI (100 MB)', sy.EN_BUYUK == 100 * 1024 * 1024, sy.EN_BUYUK)

# ══════════════════════════════════════════════════════════════════
print('[yukleme ilerlemesi (27 Eylul 2026)]')
# put_object'te ilerleme yoktu: 60 MB'lik ilk gercek reel yuklenirken
# ekran bir dakika olu kaldi ve "dondu mu?" diye soruldu.
#
# ⚠ ASIL OLCUM GUNLUK KIPI. Bu betigi Gorev Zamanlayici cagiriyor ve
# cikti HEP bir dosyaya gidiyor. Terminal icin yazilan \r'li akici
# yuzde, gunluge yazildiginda dosyayi tek satirlik bir curufa cevirir
# ve gunluk bu hattaki TEK tani araci.


class SahteEkran(io.StringIO):
    """isatty() True -- terminal kipini olcebilmek icin."""

    def isatty(self):
        return True


yakala = io.StringIO()            # isatty() False -> gunluk kipi
with contextlib.redirect_stdout(yakala):
    geri = sy.ilerleme_yazici(100)
    for _ in range(10):
        geri(10)
gunluk = yakala.getvalue()
bak('★ gunluge \\r YAZILMIYOR', '\r' not in gunluk, repr(gunluk))
# ⚠ ETIKETLERIN KENDISI OLCULMUYOR. Ilk yazimda "%25/%50/%75/%100"
# araniyordu ve test dustu: esik 25'ten baslayip 25 artiyor ama basilan
# deger geri cagirmanin denk geldigi yer, yani %30/%50/%80/%100. Kod
# dogruydu, olcum yanlisti.
#
# Asil ozellik SINIRLAMA: 10 geri cagirma geldi, gunluge 10 satir
# DUSMEDI. Bu olcum kilitlenirse esik mantigi kaldirilinca yakalanir.
satirlar = [s for s in gunluk.splitlines() if s.strip()]
bak('★ gunluk bogulmuyor (10 geri cagirma -> en cok 4 satir)',
    0 < len(satirlar) <= 4, satirlar)
bak('son satir %100', satirlar and satirlar[-1].strip().startswith('%100'), satirlar)
bak('yuzdeler artan',
    (lambda y: y == sorted(y))([int(x) for x in re.findall(r'%\s*(\d+)', gunluk)]),
    gunluk)

ekran = SahteEkran()
with contextlib.redirect_stdout(ekran):
    sy.ilerleme_yazici(100)(50)
bak('★ terminalde \\r ile ayni satir tazeleniyor', '\r' in ekran.getvalue(),
    repr(ekran.getvalue()))

# Bos dosya: bolme hatasi olmamali ve ekrana bir sey basilmamali.
bos = io.StringIO()
with contextlib.redirect_stdout(bos):
    sy.ilerleme_yazici(0)(0)
bak('bos dosyada cikti yok, cokme yok', bos.getvalue() == '', repr(bos.getvalue()))

# Cok parcali yuklemede geri cagirmalarin toplami tavani asabiliyor;
# ekranda "%500" gormek guven kaybettirir.
asan = io.StringIO()
with contextlib.redirect_stdout(asan):
    sy.ilerleme_yazici(100)(500)
yuzdeler = [int(x) for x in re.findall(r'%\s*(\d+)', asan.getvalue())]
bak('★ yuzde 100 ustune cikmiyor', bool(yuzdeler) and max(yuzdeler) <= 100, yuzdeler)

# ⚠ BU OLCUM YAPISAL, DAVRANISSAL DEGIL -- BILEREK.
# upload_fileobj cok parcali yuklemede Callback'i BIRDEN FAZLA is
# parcacigindan cagiriyor. Kilit olmazsa `durum["gecen"] += bayt`
# (oku/degistir/yaz) araya girilip sayim kaybediyor; yuzde %100'e hic
# ulasmiyor ve terminalde satir sonu basilmadigi icin sonraki cikti
# ilerleme satirinin ustune biniyor.
#
# Paralel bir olcum yazmak KIRILGAN olurdu: GIL is parcacigini her
# koguda ayni yerde degistirmiyor, yani kayip her kosuda olusmuyor --
# hatanin yasandigi gun test yesil yanabilirdi. Olculen sey kosulun
# kendisi: sayac kilidin altinda mi. (Ayni gerekce mobil-filtre
# testinde de yazili.)
_yk = io.open(os.path.join(PC, 'story-yukle.py'), encoding='utf-8').read()
_govde = _yk.split('def ilerleme_yazici(')[1].split('\ndef ')[0]
bak('★ sayac kilit altinda artiriliyor',
    'threading.Lock()' in _govde and 'with kilit:' in _govde,
    'ilerleme_yazici govdesinde kilit yok')
bak('esik de kilidin altinda (ayni kilometre tasi iki kez basilmasin)',
    _govde.count('with kilit:') >= 2, _govde.count('with kilit:'))

# ══════════════════════════════════════════════════════════════════
gecici = tempfile.mkdtemp(prefix='reels-test-')
try:
    print('[kapak eslesmesi]')
    v = os.path.join(gecici, '2026-10-12_reels_sokollu.mp4')
    dosya_yaz(v)
    bak('kapak yokken (None, None)', ry.kapagi_bul(v) == (None, None), ry.kapagi_bul(v))

    png = os.path.join(gecici, '2026-10-12_reels_sokollu.png')
    dosya_yaz(png)
    bak('png kapak bulunuyor', ry.kapagi_bul(v) == (png, 'image/png'), ry.kapagi_bul(v))

    jpg = os.path.join(gecici, '2026-10-12_reels_sokollu.jpg')
    dosya_yaz(jpg)
    # ⚠ SIRA SABIT. Belirsiz bir secim, ara sira yanlis kapak demek.
    bak('★ jpg ve png birlikteyse HER ZAMAN jpg',
        ry.kapagi_bul(v) == (jpg, 'image/jpeg'), ry.kapagi_bul(v))
    bak('secim tekrarlanabilir', ry.kapagi_bul(v) == ry.kapagi_bul(v))

    # Baska bir videonun kapagi bu videoya BULASMAMALI.
    baska = os.path.join(gecici, '2026-10-13_reels_baska.mp4')
    dosya_yaz(baska)
    bak('★ baska videonun kapagi alinmiyor', ry.kapagi_bul(baska) == (None, None),
        ry.kapagi_bul(baska))

    print('[_kapak eki (27 Eylul 2026)]')
    # Reels'lari ureten sohbet kapagi "_kapak" ekiyle basiyor. Ilk gercek
    # testte tam ad araniyordu ve dosya eslesMEDI: reel kapaksiz cikacak,
    # hicbir yerde hata gorunmeyecekti.
    e_v = os.path.join(gecici, '2026-10-20_reels_ekli.mp4')
    dosya_yaz(e_v)
    bak('eki olmayan kapak yokken (None, None)',
        ry.kapagi_bul(e_v) == (None, None), ry.kapagi_bul(e_v))

    e_kapak = os.path.join(gecici, '2026-10-20_reels_ekli_kapak.jpg')
    dosya_yaz(e_kapak)
    bak('★ _kapak ekli dosya BULUNUYOR',
        ry.kapagi_bul(e_v) == (e_kapak, 'image/jpeg'), ry.kapagi_bul(e_v))

    e_kapak_png = os.path.join(gecici, '2026-10-20_reels_ekli_kapak.png')
    dosya_yaz(e_kapak_png)
    bak('ekli dosyalarda da sira sabit (jpg once)',
        ry.kapagi_bul(e_v) == (e_kapak, 'image/jpeg'), ry.kapagi_bul(e_v))

    # ⚠ TAM AD HER ZAMAN KAZANIYOR. Ek bir tolerans; belgelenmis kural
    # tam ad. Ikisi birden varsa ekli olana BAKILMAMALI, yoksa hangi
    # kapagin gittigi klasorun icerigine gore degisir.
    e_tam = os.path.join(gecici, '2026-10-20_reels_ekli.png')
    dosya_yaz(e_tam)
    bak('★ tam ad ekli addan ONCE geliyor (uzanti daha kotu olsa bile)',
        ry.kapagi_bul(e_v) == (e_tam, 'image/png'), ry.kapagi_bul(e_v))

    # Ek listesi TEK YERDE dursun: sira degisirse test de degismeli.
    bak('KAPAK_EKLERI bos ekle basliyor',
        ry.KAPAK_EKLERI[0] == '' and '_kapak' in ry.KAPAK_EKLERI, ry.KAPAK_EKLERI)

    # Ekli kapak defterin imzasina da GIRMELI: kapak sonradan
    # duzeltilirse reel yeniden yuklenmeli.
    imza_kapakli = ri.cift_imza(e_v, ry.kapagi_bul(e_v)[0])
    bak('ekli kapak cift imzaya giriyor',
        imza_kapakli != ri.cift_imza(e_v, None), imza_kapakli)

    print('[klasorde ne ise giriyor]')
    dosya_yaz(os.path.join(gecici, '.gizli.mp4'))
    liste = ri.videolar(gecici, ry)
    adlar = sorted(a for a, _ in liste)
    bak('★ kapaklar tek basina ise girmiyor',
        all(not a.endswith(('.jpg', '.png')) for a in adlar), adlar)
    # ⚠ TAM LISTEYE BAKILMIYOR. Once oyleydi ve klasore ucuncu bir
    # video ekleyen yeni bir olcum bu satiri dusurdu (27 Eylul 2026) --
    # oysa olculmek istenen sey "her video listede mi", "klasorde tam
    # olarak su iki dosya var mi" degil. Ayni sinif kirilma bu depoda
    # bugun dokuz test dusurdu; sabit liste varsaymak kirilgan.
    bak('yazilan her video listede', set(adlar) >= {'2026-10-12_reels_sokollu.mp4',
                                                   '2026-10-13_reels_baska.mp4'}, adlar)
    bak('nokta ile baslayan dosya atlaniyor',
        not any(a.startswith('.') for a in adlar), adlar)

    print('[ASIL OLCUM: kapak sonradan eklenince]')
    # Video imzasi degismiyor, kapak yeni geliyor. Defter yalnizca
    # videoya bakiyor olsaydi bu reel bir daha hic yuklenmezdi.
    v2 = os.path.join(gecici, 'tek.mp4')
    dosya_yaz(v2)
    imza_kapaksiz = ri.cift_imza(v2, None)
    k2 = os.path.join(gecici, 'tek.jpg')
    dosya_yaz(k2)
    kp, _ = ry.kapagi_bul(v2)
    imza_kapakli = ri.cift_imza(v2, kp)
    bak('★ kapak eklenince imza DEGISIYOR', imza_kapaksiz != imza_kapakli,
        imza_kapaksiz + ' vs ' + imza_kapakli)
    # Kapak DEGISTIGINDE de: duzeltilmis bir kapak gitmeli.
    dosya_yaz(k2, b'y' * 128)
    os.utime(k2, (0, 0))
    bak('★ kapak degisince imza yine DEGISIYOR',
        ri.cift_imza(v2, kp) != imza_kapakli,
        ri.cift_imza(v2, kp) + ' vs ' + imza_kapakli)
    bak('video degismediyse video imzasi ayni',
        ri.cift_imza(v2, None) == imza_kapaksiz)

    print('[defter]')
    d = {'a.mp4': {'imza': 'x', 'durum': 'baglandi'}}
    ri.defter_yaz(gecici, d)
    bak('defter yazilip okunuyor', ri.defter_oku(gecici) == d, ri.defter_oku(gecici))
    bak('defter adi story defterinden AYRI',
        ri.DEFTER_ADI != '.shootboard-defter.json', ri.DEFTER_ADI)
    bak('defter dosyasi klasorde', os.path.isfile(os.path.join(gecici, ri.DEFTER_ADI)))

    # ══════════════════════════════════════════════════════════════
    print('[kayda yazma: kapak yalnizca verilirse gidiyor]')
    gonderilen = []

    class SahteYanit:
        content = b'{}'

        def json(self):
            return {'ok': True, 'entry': {'id': 'e1', 'coverUrl': 'x'}}

    def sahte_patch(url, json=None, headers=None, timeout=None):
        gonderilen.append(json)
        return SahteYanit()

    eski = sy.requests
    class SahteRequests:
        RequestException = Exception
        @staticmethod
        def patch(*a, **k):
            return sahte_patch(*a, **k)
    sy.requests = SahteRequests()
    try:
        sy.kayda_yaz('http://k', 'a', 'e1', 'https://u/v.mp4', 10, 'video/mp4', 'v.mp4', True,
                     'https://u/v.jpg')
        bak('★ kapak verilince coverUrl gidiyor',
            gonderilen[-1].get('coverUrl') == 'https://u/v.jpg', gonderilen[-1])
        sy.kayda_yaz('http://k', 'a', 'e1', 'https://u/v.mp4', 10, 'video/mp4', 'v.mp4', True)
        # ⚠ STORY YOLU: kapak gecmiyorsa alan HIC gonderilmemeli.
        # None gonderilseydi "kapagi sil" demek olurdu ve her story
        # kaydi kapagi bosaltirdi.
        bak('★ kapak verilmezse coverUrl HIC gonderilmiyor',
            'coverUrl' not in gonderilen[-1], gonderilen[-1])
    finally:
        sy.requests = eski

    print('[kayit arama: tur adi ekrana yansiyor]')
    kaynak = open(os.path.join(PC, 'story-yukle.py'), encoding='utf-8').read()
    bak('kaydi_bul tur adini disaridan aliyor',
        re.search(r'def kaydi_bul\(.*tur_adi="story"\)', kaynak) is not None)
    bak('★ eslestirme mantigi TEK KOPYA (reels kendi kopyasini cikarmiyor)',
        'def kaydi_bul' not in open(os.path.join(PC, 'reels-yukle.py'), encoding='utf-8').read())
finally:
    shutil.rmtree(gecici, ignore_errors=True)

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
