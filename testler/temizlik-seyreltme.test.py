#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""TEMIZLIK SORGUSU — IKI KAPI (davranis olcumu).

Bu test AG KULLANMIYOR: Shootboard'a giden `yayin_durumlari` sahte.
Olculen sey SORUNUN NE ZAMAN SORULDUGU.

NEDEN VAR
20 Ekim 2026: Supabase "Fair Use" uyarisi gonderdi, 558.630 Edge
Function cagrisi (sinir 500.000). Sebep olculdu: temizlenecekler()
defterdeki her temizlenmemis dosyayi HER TURDA soruyordu.

  240 dosya x 288 tur/gun = 69.120 cagri/gun = ayda 2.073.600

Ve bedel tersine donmustu: bu sorgunun amaci R2'de yer acmak, ama R2
olculdu -- 50 GB bile ayda 60 sent, kullanici sifir oduyor. Ayda birkac
sentlik depolamadan kacinmak icin ayda iki milyon cagri.

Kullanicinin defterinden olculen dagilim (20 Ekim 2026):
  story   112 dosya -> tarihi gecmis 0,  gelecek 112
  threads  94 dosya -> tarihi gecmis 1,  gelecek 93
  reels    34 dosya -> tarihi gecmis 1,  gelecek 33
Yani sorulan 240 dosyanin 238'i HENUZ TARIHI GELMEMIS dosyaydi.

⚠ BU TESTIN ASIL ISI: IKI KAPININ SESSIZCE BOZULMASINI ENGELLEMEK.
Seyreltme bozulursa hicbir sey patlamiyor, hicbir yayin kacmiyor --
yalnizca fatura geri geliyor. Gorunur bir belirtisi YOK. Olcum tek
bekci.

⚠ VE AYNI SEY TERS YONDE DE GECERLI: kapilar fazla genis olursa
temizlik HIC calismaz ve dosyalar R2'de birikir. Onun icin burada
"sorulmayanlar" kadar "sorulmasi GEREKENLER" de olculuyor.

⚠ BU DOSYAYLA MUTASYON TESTI YAPARKEN: pc/__pycache__'i SIL.
"""
import os
import sys
import time
import datetime
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

spec = importlib.util.spec_from_file_location(
    'story_yukle', os.path.join(PC, 'story-yukle.py'))
sy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sy)

BUGUN = datetime.date.today()
DUN = BUGUN - datetime.timedelta(days=1)
YARIN = BUGUN + datetime.timedelta(days=1)
GELECEK = BUGUN + datetime.timedelta(days=73)


def gun(d):
    return d.strftime('%Y-%m-%d')


def girdi(**k):
    g = {'durum': 'baglandi'}
    g.update(k)
    return g


sorulanlar = []


def sahte_durumlar(donus):
    """yayin_durumlari yerine gecer, sorulan adlari biriktirir."""
    def f(kok, anahtar, ad):
        sorulanlar.append(ad)
        return donus
    return f


def kos(defter, donus=None):
    """temizlenecekler'i sahte ag ile kosturur; (cikti, sorulanlar)."""
    global sorulanlar
    sorulanlar = []
    asil = sy.yayin_durumlari
    sy.yayin_durumlari = sahte_durumlar(donus)
    try:
        cikti = sy.temizlenecekler('http://yok', 'anahtar', defter)
    finally:
        sy.yayin_durumlari = asil
    return cikti, list(sorulanlar)


YAYINLANDI = [{'oto': True, 'durum': 'published'}]
BEKLIYOR = [{'oto': True, 'durum': 'pending'}]

# ── 1. KAPI 1: TARIHI GELMEMIS DOSYA SORULMUYOR ──────────────────
print('[kapi 1: tarih]')
{}
defter = {
    gun(GELECEK) + '_story_aralik_k1.mp4': girdi(),
    gun(YARIN) + '_story_yarin_k1.mp4': girdi(),
    gun(BUGUN) + '_story_bugun_k1.mp4': girdi(),
    gun(DUN) + '_story_dun_k1.mp4': girdi(),
}
cikti, soruldu = kos(defter, YAYINLANDI)
bak('73 gun sonraki dosya SORULMUYOR', gun(GELECEK) + '_story_aralik_k1.mp4' not in soruldu, soruldu)
bak('yarinki dosya SORULMUYOR', gun(YARIN) + '_story_yarin_k1.mp4' not in soruldu, soruldu)
bak('BUGUNKU dosya soruluyor', gun(BUGUN) + '_story_bugun_k1.mp4' in soruldu, soruldu)
bak('dunku dosya soruluyor', gun(DUN) + '_story_dun_k1.mp4' in soruldu, soruldu)
bak('dort dosyadan yalnizca iki soru cikti', len(soruldu) == 2, soruldu)

# ⚠ Tarihsiz ad atlanmiyor: "bilmiyorum" ile "gelmedi" ayri seyler.
print('[kapi 1: tarihsiz ad]')
cikti, soruldu = kos({'kapak-elle-konmus.mp4': girdi()}, YAYINLANDI)
bak('adinda tarih olmayan dosya SORULUYOR', soruldu == ['kapak-elle-konmus.mp4'], soruldu)

print('[kapi 1: bozuk tarih]')
cikti, soruldu = kos({'2026-13-45_story_bozuk.mp4': girdi()}, YAYINLANDI)
bak('gecersiz tarihli ad SORULUYOR', soruldu == ['2026-13-45_story_bozuk.mp4'], soruldu)

# ── 2. KAPI 2: SAATTE BIR ────────────────────────────────────────
print('[kapi 2: seyreltme]')
ad = gun(DUN) + '_story_dun_k1.mp4'

d = {ad: girdi()}
cikti, soruldu = kos(d, BEKLIYOR)
bak('ilk turda soruluyor', soruldu == [ad], soruldu)
bak('damga defterde birakildi', isinstance(d[ad].get('son_soru'), float), d[ad])

cikti, soruldu = kos(d, BEKLIYOR)
bak('hemen ardindan SORULMUYOR', soruldu == [], soruldu)

d[ad]['son_soru'] = time.time() - 3599
cikti, soruldu = kos(d, BEKLIYOR)
bak('59 dakika sonra hala sorulmuyor', soruldu == [], soruldu)

d[ad]['son_soru'] = time.time() - 3601
cikti, soruldu = kos(d, BEKLIYOR)
bak('bir saat dolunca tekrar soruluyor', soruldu == [ad], soruldu)

# ⚠ Damga SORUDAN ONCE basiliyor: sorgu patlasa da seyreltme calissin.
print('[kapi 2: sorgu patlarsa]')
d2 = {ad: girdi()}
cikti, soruldu = kos(d2, None)          # yayin_durumlari None dondu
bak('patlayan sorgudan sonra damga yine var', isinstance(d2[ad].get('son_soru'), float), d2[ad])
cikti, soruldu = kos(d2, None)
bak('patlayan sorgu HER TURDA tekrarlanmiyor', soruldu == [], soruldu)

print('[kapi 2: bozuk damga]')
for bozuk in (None, '', 'dun', {}):
    d3 = {ad: girdi(son_soru=bozuk)}
    cikti, soruldu = kos(d3, BEKLIYOR)
    bak('damga ' + repr(bozuk) + ' ise soruluyor (kilitlenmiyor)', soruldu == [ad], soruldu)

# ── 3. ESKI KORUMALAR AYNEN DURUYOR ──────────────────────────────
# Degisen sey SORUNUN NE ZAMAN sorulacagi; hangi dosyanin SILINECEGI
# degil. Bu bolum o siniri bekliyor.
print('[eski korumalar]')
d = {ad: girdi()}
cikti, _ = kos(d, YAYINLANDI)
bak('otomatikler yayinlandiysa siliniyor', cikti == [ad], cikti)

d = {ad: girdi()}
cikti, _ = kos(d, BEKLIYOR)
bak('otomatik kayit bekliyorsa SILINMIYOR', cikti == [], cikti)

d = {ad: girdi()}
cikti, _ = kos(d, [{'oto': False, 'durum': 'pending'}])
bak('hic otomatik kayit yoksa SILINMIYOR', cikti == [], cikti)

d = {ad: girdi()}
cikti, _ = kos(d, None)
bak('durum bilinmiyorsa SILINMIYOR', cikti == [], cikti)

d = {ad: girdi(temiz=True)}
cikti, soruldu = kos(d, YAYINLANDI)
bak('zaten temiz dosya hic sorulmuyor', soruldu == [] and cikti == [], (soruldu, cikti))

d = {ad: girdi(durum='kayit-yok')}
cikti, soruldu = kos(d, YAYINLANDI)
bak('baglanmamis dosya hic sorulmuyor', soruldu == [] and cikti == [], (soruldu, cikti))

d = {ad: girdi(), gun(GELECEK) + '_story_x_k1.mp4': girdi()}
cikti, _ = kos(d, [{'oto': True, 'durum': 'published'},
                   {'oto': True, 'durum': 'pending'}])
bak('biri cikmis oteki bekliyorsa SILINMIYOR', cikti == [], cikti)

# ── 4. GERCEK OLCEK ──────────────────────────────────────────────
# Kullanicinin 20 Ekim 2026'daki defteri: 240 dosya, 238'i gelecek.
print('[gercek olcek]')
buyuk = {}
for i in range(238):
    t = BUGUN + datetime.timedelta(days=1 + (i % 73))
    buyuk[gun(t) + f'_story_gelecek_{i}_k1.mp4'] = girdi()
for i in range(2):
    buyuk[gun(DUN) + f'_reels_gecmis_{i}.mp4'] = girdi()

cikti, soruldu = kos(buyuk, BEKLIYOR)
bak('240 dosyadan yalnizca 2 soru cikiyor', len(soruldu) == 2, len(soruldu))
cikti, soruldu = kos(buyuk, BEKLIYOR)
bak('ikinci turda hic soru cikmiyor (seyreltme)', len(soruldu) == 0, len(soruldu))

gunluk = 2 * 24      # iki dosya, saatte bir
bak('gunluk cagri 100un altinda', gunluk < 100, gunluk)

# ── 5. DAMGALAR DISKE YAZILIYOR ──────────────────────────────────
# ⚠ EN SINSI ARIZA BURADA. temizlenecekler damgayi defter SOZLUGUNE
# koyuyor; temizlik_turu onu diske yazmazsa damga surec bitince
# kaybolur ve seyreltme HIC CALISMAZ. Hicbir sey patlamaz, hicbir
# yayin kacmaz -- yalnizca fatura geri gelir. Gorunur belirti yok.
print('[damgalar diske yaziliyor]')
yazilanlar = []


def sahte_yaz(klasor, defter):
    # Diske yazmayi taklit ediyor: o anki damgalarin kopyasi.
    yazilanlar.append({a: dict(k) for a, k in defter.items()})


asil_durumlar = sy.yayin_durumlari
asil_sil = sy.r2_sil
asil_ayar = sy.ayar
sy.yayin_durumlari = sahte_durumlar(BEKLIYOR)   # hicbir sey silinmeyecek
sy.r2_sil = lambda nesneler: (list(nesneler), [])
sy.ayar = lambda ad: 'http://yok' if 'URL' in ad else 'anahtar'
try:
    d = {gun(DUN) + '_story_dun_k1.mp4': girdi()}
    yazilanlar.clear()
    sy.temizlik_turu('/klasor/yok', d, sahte_yaz, lambda a, k: [a])
    bak('silinecek dosya olmasa da defter yaziliyor', len(yazilanlar) >= 1, len(yazilanlar))
    bak('yazilan defterde damga var',
        bool(yazilanlar) and isinstance(
            list(yazilanlar[0].values())[0].get('son_soru'), float),
        yazilanlar[:1])
finally:
    sy.yayin_durumlari = asil_durumlar
    sy.r2_sil = asil_sil
    sy.ayar = asil_ayar

print('\ngecti: %d   kaldi: %d' % (gecen, kalan))
sys.exit(1 if kalan else 0)
