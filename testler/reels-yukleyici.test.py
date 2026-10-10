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
si = modul_al('story-izle.py', 'story_izle')


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
#
# ⚠ KAYNAK METNI DEGIL, SAYIYI OLCUYORUZ. Eskiden MCP'deki
# `reel ? 1024*1024*1024 : 100*1024*1024` uclugu metin olarak araniyordu.
# 29 Eylul 2026'da `shorts` eklenince o uclu bir TAVANLAR tablosuna
# donustu; sayilar ayni kaldi ama olcum dustu. Yanlis bir sey olmadan
# dusen olcum, bir dahaki sefere bakilmayan olcum oluyor.
mcp = open(os.path.join(KOK, 'supabase', 'functions', 'mcp', 'index.ts'), encoding='utf-8').read()

def mcp_tavan(tur):
    """MCP'deki TAVANLAR tablosundan bir turun tavanini bayt olarak okur."""
    m = re.search(tur + r"\s*:\s*\{\s*tavan:\s*([0-9*\s]+?),", mcp)
    if not m:
        return None
    # '1024 * 1024 * 1024' -> 1073741824. eval yerine elle carpiyoruz.
    carpanlar = [int(x.strip()) for x in m.group(1).split('*')]
    sonuc = 1
    for c in carpanlar:
        sonuc *= c
    return sonuc

bak('MCP TAVANLAR tablosu okunabiliyor',
    mcp_tavan('reels') is not None and mcp_tavan('story') is not None,
    'reels=%s story=%s' % (mcp_tavan('reels'), mcp_tavan('story')))
bak('★ reels tavani MCP tarafinda da 1 GB',
    mcp_tavan('reels') == 1024 * 1024 * 1024, mcp_tavan('reels'))
bak('★ story tavani MCP tarafinda da 100 MB',
    mcp_tavan('story') == 100 * 1024 * 1024, mcp_tavan('story'))
bak('yukleyici tavani 1 GB', ry.EN_BUYUK == 1024 * 1024 * 1024, ry.EN_BUYUK)
bak('story tavani DEGISMEDI (100 MB)', sy.EN_BUYUK == 100 * 1024 * 1024, sy.EN_BUYUK)
# ⛔ ASIL BAG: yukleyicinin tavani ile MCP'nin tavani AYNI OLMAK ZORUNDA.
# Ayrisirlarsa yukleyici dosyayi kabul eder, MCP kayda yazmayi reddeder
# ve kullanici sebebini hicbir yerde goremez.
bak('★ yukleyici ve MCP reels tavani AYNI', ry.EN_BUYUK == mcp_tavan('reels'),
    '%s vs %s' % (ry.EN_BUYUK, mcp_tavan('reels')))
bak('★ yukleyici ve MCP story tavani AYNI', sy.EN_BUYUK == mcp_tavan('story'),
    '%s vs %s' % (sy.EN_BUYUK, mcp_tavan('story')))

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
    liste = ri.videolar(gecici, ry, sy)
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

    # ══════════════════════════════════════════════════════════════
    print('[yanlis klasore dusen dosya: TURU AD SOYLUYOR]')
    # 7 Ekim 2026, 16:20 -- story izleyicisi `story\\cikti` icindeki DOKUZ
    # REELS dosyasina "Instagram sinirli 100 MB" hatasi verdi. Kod yanlis
    # degildi: turu belirleyen tek sey DOSYANIN HANGI KLASORDE DURDUGU
    # idi, izleyici klasordeki her videoyu kendi turu saniyordu. Reels
    # tavani 1 GB, story'ninki 100 MB -- ayni dosya bir yerde gecerli,
    # otekinde reddediliyor. Hata her turda tekrarlanip defteri kirletti.
    bak('ad_turu story okuyor', sy.ad_turu('2026-10-20_story_konu_k1.mp4') == 'story')
    bak('ad_turu reels okuyor', sy.ad_turu('2026-10-12_reels_sokollu.mp4') == 'reels')
    # ⚠ ISARETSIZ AD ELENMIYOR: '' donuyor ve izleyiciler dokunmuyor.
    # Aksi halde adlandirma kuralina uymayan bir dosya SESSIZCE gorunmez
    # olurdu -- duzeltmeye calistigimiz hatanin aynisi, ters yonde.
    bak('★ işaretsiz ad BİLİNMİYOR sayılıyor (sessizce elenmiyor)',
        sy.ad_turu('rastgele.mp4') == '', sy.ad_turu('rastgele.mp4'))

    # Reels klasorune dusen bir STORY dosyasi listeye girmiyor.
    dosya_yaz(os.path.join(gecici, '2026-10-20_story_yabanci_k1.mp4'))
    liste2 = ri.videolar(gecici, ry, sy)
    adlar2 = sorted(a for a, _ in liste2)
    bak('★ reels klasöründeki STORY dosyası işlenmiyor',
        '2026-10-20_story_yabanci_k1.mp4' not in adlar2, adlar2)
    bak('reels dosyaları hâlâ işleniyor',
        '2026-10-12_reels_sokollu.mp4' in adlar2, adlar2)

    # Simetrik olcum: story izleyicisine dusen bir REELS dosyasi
    # yukleyiciye HIC gitmiyor -- 100 MB hatasinin ciktigi yer orasiydi.
    st_gecici = tempfile.mkdtemp(prefix='story-test-')
    try:
        dosya_yaz(os.path.join(st_gecici, '2026-10-20_story_konu_k1.mp4'))
        dosya_yaz(os.path.join(st_gecici, '2026-10-06_reels_derinkuyu.mp4'))

        class SahteYukleyici:
            IZINLI_TUR = sy.IZINLI_TUR
            ad_turu = staticmethod(sy.ad_turu)
            @staticmethod
            def temizlik_turu(klasor, defter, defter_yaz, nesneleri_bul):
                return 0

        islenen = []
        durdu_yedek, isle_yedek = si.durdu_mu, si.dosyayi_isle
        try:
            si.durdu_mu = lambda yol: True          # render bitti say
            si.dosyayi_isle = (lambda y, yol, ad, oto, zorla, onceki=None:
                               islenen.append(ad) or ('baglandi', 'tamam', {}))
            with contextlib.redirect_stdout(io.StringIO()):
                si.bir_tur(SahteYukleyici, st_gecici, False, False)
        finally:
            si.durdu_mu, si.dosyayi_isle = durdu_yedek, isle_yedek

        bak('★ story klasöründeki REELS dosyası yükleyiciye GİTMİYOR',
            '2026-10-06_reels_derinkuyu.mp4' not in islenen, islenen)
        bak('story dosyası normal işleniyor',
            '2026-10-20_story_konu_k1.mp4' in islenen, islenen)
    finally:
        shutil.rmtree(st_gecici, ignore_errors=True)
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

    # ══════════════════════════════════════════════════════════════
    print('[tek kayit hatasi butun turu dusurmemeli]')
    # 27 Eylul 2026: bir reel dosyasi DORT kayitla eslesti (fb/ig/tt
    # reels + yt shorts). kayda_yaz shorts kaydinda boyut tavanina
    # takilip sys.exit etti ve DONGU ORADA KESILDI: kayitlarin bir kismi
    # yazili bir kismi yazisiz kaldi -- Instagram kaydinda coverUrl
    # eksikti, o haliyle yayinlansa reel KAPAKSIZ cikardi.
    #
    # Ayrica defterde 'baglandi' yazilmadigi icin izleyici dosyayi her
    # turda bastan isledi ve sira "kaydi bul, YUKLE, kayda yaz" oldugu
    # icin 114 MB her bes dakikada bir R2'ye gitti.

    class SahteRY:
        EN_BUYUK = 1024 * 1024 * 1024
        def __init__(self): self.kapak_sayisi = 0
        def tur_bul(self, yol): return 'video/mp4'
        def kapak_yukle(self, sy, yol, mime, zorla):
            self.kapak_sayisi += 1
            return 'https://r2/kapak.jpg', []

    class SahteSY:
        def __init__(self, patlat=()):
            self.yuklenen = []
            self.yazilan = []
            self.patlat = set(patlat)
        def ayar(self, ad, zorunlu=True): return 'https://x' if 'URL' in ad else 'k'
        # ⚠ KIMLIK DEGIL KAYIT DONUYOR (10 Ekim 2026). Cagiran otomatik
        # yayin kararini platforma gore veriyor; sahte de ayni sekli
        # dondurmezse test gercek yoldan sapar.
        def kaydi_bul(self, kok, anahtar, ad, kayit_id=None, tur_adi='reels'):
            return [{'id': 'ig', 'platform': 'instagram', 'type': 'reels'},
                    {'id': 'fb', 'platform': 'facebook',  'type': 'reels'},
                    {'id': 'tt', 'platform': 'tiktok',    'type': 'reels'}]
        # Politika SAHTE DEGIL: gercek tablo olculsun.
        otomatik_mi = staticmethod(sy.otomatik_mi)
        def r2_yukle(self, yol, ad, mime):
            self.yuklenen.append(ad)
            return 'https://r2/' + ad
        def adresi_dene(self, *a, **k): return []
        def kayda_yaz(self, kok, anahtar, kayit_id, url, boyut, mime, ad,
                      otomatik, kapak_url=None):
            if kayit_id in self.patlat:
                raise SystemExit('mediaBytes: 114 MB is over the limit for stories')
            self.yazilan.append((kayit_id, kapak_url))
            return {'id': kayit_id, 'platform': kayit_id, 'publishAt': '2026-10-15T07:00:00Z',
                    'coverUrl': kapak_url, 'autoPublish': otomatik}

    v2 = os.path.join(gecici, '2026-10-15_reels_aizanoi.mp4')
    dosya_yaz(v2, b'x' * 2048)
    k2 = os.path.join(gecici, '2026-10-15_reels_aizanoi_kapak.jpg')
    dosya_yaz(k2)

    ry2, sy2 = SahteRY(), SahteSY(patlat={'fb'})
    # ⚠ SystemExit'i BURADA YAKALIYORUZ ve ADLANDIRILMIS bir olcume
    # ceviriyoruz. Yakalamasaydik dongu korumasi kaldirildiginda test
    # CAKARDI -- ve coken bir test, "kor test" ile ayni goruntuyu verir:
    # ne "YOK" satiri ne sonuc ozeti. 27 Eylul 2026'da bu iki kez
    # birbirine karisti.
    patladi = False
    try:
        durum, not_, ek = ri.dosyayi_isle(ry2, sy2, v2, os.path.basename(v2),
                                          k2, 'image/jpeg', True, False)
    except SystemExit as e:
        patladi, durum, not_, ek = True, 'cokti', str(e), {}
    bak('★ tek kayıt hatası turu ÇÖKERTMİYOR (SystemExit sızmıyor)',
        not patladi, not_)
    bak('★ bir kayıt patlasa da ötekiler yazılıyor',
        sorted(a for a, _ in sy2.yazilan) == ['ig', 'tt'], sy2.yazilan)
    bak('★ yazılanların hepsinde kapak var (yarım kalmıyor)',
        all(kp for _, kp in sy2.yazilan), sy2.yazilan)
    bak('durum "baglandi" DEĞİL', durum == 'eksik-baglanti', durum)
    bak('kaç kaydın yazıldığı söyleniyor', '2/3' in not_, not_)

    # ★ IKINCI TUR: ayni imza, adres defterde -> YENIDEN YUKLEME YOK.
    ry3, sy3 = SahteRY(), SahteSY()
    durum2, not2, ek2 = ri.dosyayi_isle(ry3, sy3, v2, os.path.basename(v2),
                                        k2, 'image/jpeg', True, False, ek)
    bak('★ ikinci turda dosya YENİDEN YÜKLENMİYOR', sy3.yuklenen == [], sy3.yuklenen)
    bak('★ ikinci turda kapak da yeniden yüklenmiyor', ry3.kapak_sayisi == 0,
        ry3.kapak_sayisi)
    bak('ikinci turda kalan kayıtlar yazılıyor',
        durum2 == 'baglandi' and len(sy3.yazilan) == 3, (durum2, sy3.yazilan))
    bak('adres defterde saklanıyor', ek.get('url') and ek.get('kapak_url'), ek)

    # Ilk turda (onceki YOK) gercekten yukleniyor -- yukaridaki olcum
    # "hic yuklemiyor" diye bos gecmesin.
    ry4, sy4 = SahteRY(), SahteSY()
    ri.dosyayi_isle(ry4, sy4, v2, os.path.basename(v2), k2, 'image/jpeg', True, False)
    bak('ilk turda YÜKLENİYOR (ölçüm boş geçmiyor)',
        sy4.yuklenen == [os.path.basename(v2)] and ry4.kapak_sayisi == 1,
        (sy4.yuklenen, ry4.kapak_sayisi))

    print('[R2 temizligi: yayinlanan dosya siliniyor]')
    # Instagram videoyu yayin aninda cekip kendi kopyasini aliyor; o
    # saniyeden sonra R2'deki dosyanin isi bitiyor. Ama silen kimse
    # yoktu: 206 MB'lik bir reel HERKESE ACIK adreste kaliyordu, hesap
    # silinse bile (app.html'in R2 anahtari yok).
    #
    # ⚠ SILME GERI ALINAMAZ. Bu blogun her olcumu "ne zaman SILMEMELI"
    # sorusuna bakiyor; "siliyor mu" yalnizca bir tanesi.

    class SahteS3:
        def __init__(self, patlat=None):
            self.silinen = []
            self.patlat = patlat or set()

        def delete_object(self, Bucket=None, Key=None):
            if Key in self.patlat:
                raise RuntimeError('R2 reddetti')
            self.silinen.append(Key)

    def kur(bulgu, patlat=None):
        """yayin_durumlari'nin cevabini ve R2'yi sahtele."""
        s3 = SahteS3(patlat)
        sy.r2_istemci = lambda: s3
        sy.ayar = lambda ad, zorunlu=True: {'R2_BUCKET': 'kova',
                                            'SHOOTBOARD_MCP_URL': 'https://x',
                                            'SHOOTBOARD_KEY': 'k'}.get(ad, 'x')
        sy.yayin_durumlari = lambda kok, anahtar, ad: bulgu.get(ad, None)
        return s3

    def K(*cift):
        """(otomatikYayin, publishState) ciftlerinden kayit listesi."""
        return [{'oto': o, 'durum': d} for o, d in cift]

    ayar_yedek, istemci_yedek, durum_yedek = sy.ayar, sy.r2_istemci, sy.yayin_durumlari
    yazilan = []
    def sahte_defter_yaz(klasor, defter):
        yazilan.append(1)
    nesneler = lambda ad, kayit: [ad] + ([kayit['kapak']] if kayit.get('kapak') else [])

    try:
        # 1. Hepsi published -> video VE kapak siliniyor.
        defter = {'a.mp4': {'durum': 'baglandi', 'kapak': 'a.jpg'}}
        s3 = kur({'a.mp4': K((True, 'published'), (True, 'published'))})
        n = sy.temizlik_turu(gecici, defter, sahte_defter_yaz, nesneler)
        bak('★ yayınlanan dosya ve kapağı siliniyor',
            n == 1 and sorted(s3.silinen) == ['a.jpg', 'a.mp4'], s3.silinen)
        bak('defterde temiz işareti var', defter['a.mp4'].get('temiz') is True, defter)
        # ⚠ EN SESSIZ TUZAK: durum degisirse izleyici dosyayi "yeni"
        # sayar ve HER TURDA YENIDEN YUKLER -- sildigimizi geri koyariz.
        bak('★ durum hâlâ "baglandi" (yoksa sonsuz yeniden yükleme)',
            defter['a.mp4']['durum'] == 'baglandi', defter['a.mp4']['durum'])

        # Ikinci tur ayni girdiye DOKUNMAMALI.
        s3b = kur({'a.mp4': K((True, 'published'), (True, 'published'))})
        n2 = sy.temizlik_turu(gecici, defter, sahte_defter_yaz, nesneler)
        bak('temizlenen girdi bir daha silinmiyor', n2 == 0 and s3b.silinen == [], s3b.silinen)

        # 2. ★ BIR KAYIT BEKLIYOR -> DOKUNMA. Ayni dosya Instagram ve
        # Facebook kayitlarina bagli; biri ciktı diye silersek oteki 404 alir.
        defter2 = {'b.mp4': {'durum': 'baglandi'}}
        s3c = kur({'b.mp4': K((True, 'published'), (True, 'pending'))})
        n3 = sy.temizlik_turu(gecici, defter2, sahte_defter_yaz, nesneler)
        bak('★ bir kayıt bekliyorsa SİLİNMİYOR',
            n3 == 0 and s3c.silinen == [] and not defter2['b.mp4'].get('temiz'), s3c.silinen)

        # 3. ★ Durum BILINMIYOR (ag hatasi, tarih eslesmesi) -> DOKUNMA.
        defter3 = {'c.mp4': {'durum': 'baglandi'}}
        s3d = kur({})                      # None donuyor
        n4 = sy.temizlik_turu(gecici, defter3, sahte_defter_yaz, nesneler)
        bak('★ durum bilinmiyorsa SİLİNMİYOR', n4 == 0 and s3d.silinen == [], s3d.silinen)

        # 4. Henuz baglanmamis girdi (kayit-yok) -> dokunma.
        defter4 = {'d.mp4': {'durum': 'kayit-yok'}}
        s3e = kur({'d.mp4': K((True, 'published'))})
        n5 = sy.temizlik_turu(gecici, defter4, sahte_defter_yaz, nesneler)
        bak('bağlanmamış girdiye dokunulmuyor', n5 == 0 and s3e.silinen == [], s3e.silinen)

        # 5. ★ R2 silme patlarsa temiz isareti KONMUYOR: sonraki tur dener.
        defter5 = {'e.mp4': {'durum': 'baglandi'}}
        s3f = kur({'e.mp4': K((True, 'published'))}, patlat={'e.mp4'})
        n6 = sy.temizlik_turu(gecici, defter5, sahte_defter_yaz, nesneler)
        bak('★ silme başarısızsa temiz işareti KONMUYOR',
            n6 == 0 and not defter5['e.mp4'].get('temiz'), defter5)

        # ── OTOMATIK YAYINI KAPALI KAYITLAR DOSYAYI REHIN TUTMUYOR ──
        # 7 Ekim 2026: yayinlanan 10 reels'ten yalnizca 2'si temizlenmisti.
        # Bir reels dosyasi DORT kayda bagli ve ucunun otomatik yayini
        # kapali (TikTok onayi yok, YouTube denetim kapisi kapali, Facebook
        # 5 Ekim'den beri elle). Ucu de sonsuza kadar 'pending' kaliyor;
        # eski kosul "TUM kayitlar published" oldugu icin dosya hic
        # silinmiyordu.
        defter6 = {'f.mp4': {'durum': 'baglandi', 'kapak': 'f.jpg'}}
        s3g = kur({'f.mp4': K((True,  'published'),   # instagram  — cikti
                              (False, 'pending'),     # facebook   — elle
                              (False, 'pending'),     # tiktok     — onay yok
                              (False, 'pending'))})   # youtube    — kapi kapali
        n7 = sy.temizlik_turu(gecici, defter6, sahte_defter_yaz, nesneler)
        bak('★ GERÇEK REELS VAKASI: elle atılanlar dosyayı rehin tutmuyor',
            n7 == 1 and sorted(s3g.silinen) == ['f.jpg', 'f.mp4'], s3g.silinen)

        # ⚠ ESKI KORUMA AYNEN DURUYOR. Otomatik yayini ACIK ama henuz
        # cikmamis bir kayit varsa dosya DURUYOR -- silseydik o yayin
        # sirasi gelince 404 alirdi. Bu olcum kaldirilirsa yeni kural
        # eskisinin korudugu seyi kaybeder.
        defter7 = {'g.mp4': {'durum': 'baglandi'}}
        s3h = kur({'g.mp4': K((True,  'published'),   # instagram — cikti
                              (True,  'pending'),     # facebook  — SIRADA
                              (False, 'pending'))})   # tiktok    — elle
        n8 = sy.temizlik_turu(gecici, defter7, sahte_defter_yaz, nesneler)
        bak('★ otomatik ama BEKLEYEN kayıt varsa hâlâ silinmiyor',
            n8 == 0 and s3h.silinen == [] and not defter7['g.mp4'].get('temiz'),
            s3h.silinen)

        # Hicbir kayitta otomatik yayin yoksa dosyayi sistem hic
        # kullanmadi; publishState'i de kimse 'published' yapmayacak.
        # Silmemek bedava, yanlis silmek geri alinamaz.
        defter8 = {'h.mp4': {'durum': 'baglandi'}}
        s3i = kur({'h.mp4': K((False, 'pending'), (False, 'pending'))})
        n9 = sy.temizlik_turu(gecici, defter8, sahte_defter_yaz, nesneler)
        bak('★ hiç otomatik kayıt yoksa SİLİNMİYOR', n9 == 0 and s3i.silinen == [],
            s3i.silinen)
    finally:
        sy.ayar, sy.r2_istemci, sy.yayin_durumlari = ayar_yedek, istemci_yedek, durum_yedek

    print('[R2 temizligi: tarih eslesmesine GUVENILMIYOR]')
    # /api/entries/find tam ad bulamazsa dosya adindaki TARIHE dusuyor ve
    # o gunun BASKA kayitlarini donduruyor. Silme karari ona dayansaydi:
    # baska bir kayit yayinlandi diye bizim dosyamiz silinir, sonra bizimki
    # yayinlanmaya calisir ve adres 404 doner.
    class SahteR:
        RequestException = Exception
        def __init__(self, govde): self.govde = govde
        def get(self, *a, **k):
            g = self.govde
            class Y:
                content = b'{}'
                def json(self_inner): return g
            return Y()
    r_yedek = sy.requests
    try:
        sy.requests = SahteR({'ok': True, 'matchedBy': 'tarih',
                              'entries': [{'publishState': 'published'}]})
        bak('★ tarih eşleşmesinde durum BİLİNMİYOR sayılıyor',
            sy.yayin_durumlari('https://x', 'k', 'f.mp4') is None,
            sy.yayin_durumlari('https://x', 'k', 'f.mp4'))
        sy.requests = SahteR({'ok': True, 'matchedBy': 'mediaName',
                              'entries': [{'publishState': 'published',
                                           'autoPublish': True}]})
        bak('tam ad eşleşmesinde durum okunuyor',
            sy.yayin_durumlari('https://x', 'k', 'f.mp4')
            == [{'oto': True, 'durum': 'published'}],
            sy.yayin_durumlari('https://x', 'k', 'f.mp4'))
        # ★ autoPublish DE OKUNUYOR. Temizlik karari buna dayaniyor;
        # alan dusurulurse her kayit "elle" sayilir ve hicbir dosya
        # silinmez (ya da kosul ters kurulursa HEPSI silinir).
        sy.requests = SahteR({'ok': True, 'matchedBy': 'mediaName',
                              'entries': [{'publishState': 'pending',
                                           'autoPublish': False}]})
        bak('★ autoPublish alanı taşınıyor',
            sy.yayin_durumlari('https://x', 'k', 'f.mp4')
            == [{'oto': False, 'durum': 'pending'}],
            sy.yayin_durumlari('https://x', 'k', 'f.mp4'))
        # Alan hic gelmezse 'elle' sayiliyor -- yani eksik veri silmeye
        # DEGIL, saklamaya yoneliyor.
        sy.requests = SahteR({'ok': True, 'matchedBy': 'mediaName',
                              'entries': [{'publishState': 'published'}]})
        bak('alan yoksa elle sayılıyor (eksik veri silmeye yönelmiyor)',
            sy.yayin_durumlari('https://x', 'k', 'f.mp4')
            == [{'oto': False, 'durum': 'published'}],
            sy.yayin_durumlari('https://x', 'k', 'f.mp4'))
        sy.requests = SahteR({'ok': False, 'error': 'yok'})
        bak('ok:false ise BİLİNMİYOR', sy.yayin_durumlari('https://x', 'k', 'f.mp4') is None)
    finally:
        sy.requests = r_yedek

    print('[story izleyicisi: ayni dayaniklilik]')
    # 27 Eylul 2026: bu duzeltme once YALNIZCA reels-izle.py'ye yazildi
    # ve story-izle.py'de ayni acik birakildi -- "ayni liste iki yerde"
    # hatasinin bir baskasi. Story dosyalari kucuk oldugu icin yeniden
    # yukleme maliyeti dusuk, ama KISMI BAGLANMA riski birebir ayni:
    # Instagram baglanir, Facebook baglanmaz, defterde tek satir yazar.

    class SahteSYs:
        def __init__(self, patlat=()):
            self.yuklenen = []
            self.yazilan = []
            self.patlat = set(patlat)
        EN_BUYUK = 1024 * 1024 * 1024
        def tur_bul(self, yol): return 'video/mp4'
        def ayar(self, ad, zorunlu=True): return 'https://x' if 'URL' in ad else 'k'
        def kaydi_bul(self, kok, anahtar, ad, kayit_id=None, tur_adi='story'):
            return [{'id': 'ig', 'platform': 'instagram', 'type': 'story'},
                    {'id': 'fb', 'platform': 'facebook',  'type': 'story'}]
        otomatik_mi = staticmethod(sy.otomatik_mi)
        def r2_yukle(self, yol, ad, mime):
            self.yuklenen.append(ad)
            return 'https://r2/' + ad
        def adresi_dene(self, *a, **k): return []
        def kayda_yaz(self, kok, anahtar, kayit_id, url, boyut, mime, ad, otomatik):
            if kayit_id in self.patlat:
                raise SystemExit('kayit yazilamadi: 409')
            self.yazilan.append(kayit_id)
            return {'id': kayit_id, 'platform': kayit_id,
                    'publishAt': '2026-10-15T06:00:00Z', 'autoPublish': otomatik}

    sv = os.path.join(gecici, '2026-10-15_story_konu_k1.mp4')
    dosya_yaz(sv, b'x' * 1024)

    sys1 = SahteSYs(patlat={'fb'})
    patladi = False
    try:
        sdurum, snot, sek = si.dosyayi_isle(sys1, sv, os.path.basename(sv), True, False)
    except SystemExit as e:
        patladi, sdurum, snot, sek = True, 'cokti', str(e), {}
    bak('★ story: tek kayıt hatası turu ÇÖKERTMİYOR', not patladi, snot)
    bak('★ story: bir kayıt patlasa da öteki yazılıyor', sys1.yazilan == ['ig'], sys1.yazilan)
    bak('story: durum "baglandi" DEĞİL', sdurum == 'eksik-baglanti', sdurum)
    bak('story: kaç kaydın yazıldığı söyleniyor', '1/2' in snot, snot)
    bak('★ story: adres deftere yazılmak üzere dönüyor', sek.get('url') == 'https://r2/' + os.path.basename(sv), sek)

    sys2 = SahteSYs()
    sdurum2, snot2, sek2 = si.dosyayi_isle(sys2, sv, os.path.basename(sv), True, False, sek)
    bak('★ story: ikinci turda dosya YENİDEN YÜKLENMİYOR', sys2.yuklenen == [], sys2.yuklenen)
    bak('story: ikinci turda kalan kayıtlar yazılıyor',
        sdurum2 == 'baglandi' and sys2.yazilan == ['ig', 'fb'], (sdurum2, sys2.yazilan))

    sys3 = SahteSYs()
    si.dosyayi_isle(sys3, sv, os.path.basename(sv), True, False)
    bak('story: ilk turda YÜKLENİYOR (ölçüm boş geçmiyor)',
        sys3.yuklenen == [os.path.basename(sv)], sys3.yuklenen)

    # ⚠ str(e) yerine e.code: sys.exit(1) loga yalnizca "1" yaziyordu.
    kaynak_si = open(os.path.join(PC, 'story-izle.py'), encoding='utf-8').read()
    bak('★ story: dış SystemExit yakalayıcısı str(e) kullanmıyor',
        "sonuc = ('hata', str(e))" not in kaynak_si)

    print('[kayit arama: tur adi ekrana yansiyor]')
    kaynak = open(os.path.join(PC, 'story-yukle.py'), encoding='utf-8').read()
    bak('kaydi_bul tur adini disaridan aliyor',
        re.search(r'def kaydi_bul\(.*tur_adi="story"\)', kaynak) is not None)
    bak('★ kaydi_bul KAYIT döndürüyor (platform karara kadar taşınsın)',
        'return kayitlar' in kaynak and 'return [k["id"] for k in kayitlar]' not in kaynak)
    bak('★ eslestirme mantigi TEK KOPYA (reels kendi kopyasini cikarmiyor)',
        'def kaydi_bul' not in open(os.path.join(PC, 'reels-yukle.py'), encoding='utf-8').read())
finally:
    shutil.rmtree(gecici, ignore_errors=True)

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
