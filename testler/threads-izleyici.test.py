#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""THREADS IZLEYICISI — klasorden kayda giden yol (davranis olcumu).

Bu test AG KULLANMIYOR: R2 yuklemesi, adres denemesi ve Shootboard
cagrilari sahte. Olculen sey KARAR MANTIGI:

  · hangi dosyalar ise giriyor (fotograf evet, video hayir),
  · 8 MB ustu ne oluyor,
  · aday kayitlar Threads degilse ne oluyor,
  · yanlis gunde R2'ye bayt gidiyor mu,
  · otomatik yayin tiki gercekten aciliyor mu.

⚠ KARDES TEST testler/threads-izleyici.test.js KAYNAGA BAKIYOR, bu
dosya DAVRANISA. Ikisi ayri sey olcuyor ve ikisi de gerekli: 16 Ekim
2026'da bir mutasyon (hata mesajindaki `gorulen` satirini silmek)
kaynak olcumunden gecti ama kod CALISMA ANINDA patliyordu. Davranis
testi onu ilk turda yakaladi.

⚠ EN ONEMLI OLCUM: ADAY KAYIT THREADS DEGILSE.
Dosya adi kayitla tutmazsa kaydi_bul TARIHE dusuyor ve tarih aramasi
platforma BAKMIYOR. 16 Ekim 2026'da olculdu: 25 Ekim icin on aday
dondu (instagram, facebook, youtube, tiktok), hicbiri threads degildi.
O gun zarar olmadi cunku aday birden cokken yukleyici durup soruyor --
ama TEK aday olsaydi izleyici Threads gorselini ornegin bir Instagram
story kaydina baglar ve ONUN tikini acardi. Geri alinamaz yanlis yayin.

⚠ BU DOSYAYLA MUTASYON TESTI YAPARKEN: pc/__pycache__'i SIL.
Moduller importlib ile kaynaktan yukleniyor ama Python bayt kodunu
onbellege aliyor; kaynagi geri aldiktan sonra eski bayt kodu
kullanilabiliyor ve test "hala kirik" gorunuyor. Her turdan once:
  rm -rf pc/__pycache__
"""
import io
import os
import sys
import json
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

sy = modul_al('story-yukle.py', 'story_yukle')
ti = modul_al('threads-izle.py', 'threads_izle')


# ── Sahte yukleyici ──────────────────────────────────────────────
# GERCEK olan: ad_turu ve otomatik_mi (politika tek yerde, onu
# olcmek istiyoruz). SAHTE olan: aga ve Shootboard'a giden her sey.
class SahteYukleyici:
    def __init__(self, adaylar):
        self.adaylar = adaylar
        self.yuklenenler = []      # r2_yukle cagrildi mi, kac kez
        self.yazilanlar = []       # hangi kayda ne yazildi
        self.IZINLI_TUR = sy.IZINLI_TUR
        self.ad_turu = sy.ad_turu
        self.otomatik_mi = sy.otomatik_mi
        self.EN_BUYUK = sy.EN_BUYUK

    def ayar(self, ad, zorunlu=True):
        return 'sahte-' + ad

    def kaydi_bul(self, kok, anahtar, ad, kayit_id=None, tur_adi='story'):
        if not self.adaylar:
            sys.exit('o tarihte kayit yok')
        return list(self.adaylar)

    def r2_yukle(self, yol, ad, mime):
        self.yuklenenler.append(ad)
        return 'https://ornek.invalid/' + ad

    def adresi_dene(self, url, mime, boyut):
        return []

    def kayda_yaz(self, kok, anahtar, kayit_id, url, boyut, mime, ad, oto, kapak_url=None):
        self.yazilanlar.append({'id': kayit_id, 'url': url, 'ad': ad, 'oto': oto})
        aday = next((a for a in self.adaylar if a.get('id') == kayit_id), {})
        return {'id': kayit_id, 'platform': aday.get('platform'),
                'publishAt': '2026-10-25T08:00:00Z', 'autoPublish': bool(oto)}

    def temizlik_turu(self, klasor, defter, defter_yaz, nesneleri_bul):
        return 0


def gorsel_yaz(yol, boyut=2048):
    with open(yol, 'wb') as f:
        f.write(b'x' * boyut)


def sessiz(fn, *a, **k):
    """Ciktiyi yutar, donus degerini ve yazilani birlikte verir."""
    tampon = io.StringIO()
    with contextlib.redirect_stdout(tampon):
        sonuc = fn(*a, **k)
    return sonuc, tampon.getvalue()


# ══════════════════════════════════════════════════════════════════
print('[kendi kurallari]')
bak('★ yalnizca fotograf kabul ediliyor',
    set(ti.IZINLI_TUR) == {'.jpg', '.jpeg', '.png'}, sorted(ti.IZINLI_TUR))
# Meta belgesi: Threads gorselde 8 MB. story'nin 100 MB'i BURADA yanlis
# olur -- 9 MB'lik bir dosya yuklenir, Threads reddeder ve sebebi yayin
# gunune kalirdi.
bak('★ sinir 8 MB', ti.EN_BUYUK == 8 * 1024 * 1024, ti.EN_BUYUK)
bak('★ story tavani DEGISMEDI (100 MB)', sy.EN_BUYUK == 100 * 1024 * 1024, sy.EN_BUYUK)
bak('★ defteri story/reels defterinden ayri',
    ti.DEFTER_ADI == '.shootboard-threads-defter.json', ti.DEFTER_ADI)
bak('★ kendi klasoru', ti.VARSAYILAN_KLASOR.endswith('TESLIM\\THREADS'),
    ti.VARSAYILAN_KLASOR)
# Politika TEK YERDE: story-yukle.py. Izleyici kendi kopyasini
# tasimiyor, oraya soruyor.
bak('★ threads/text_post politikada acik',
    sy.otomatik_mi('threads', 'text_post') is True)
bak('★ tabloda olmayan cift kapali', sy.otomatik_mi('threads', 'reels') is False)

# ══════════════════════════════════════════════════════════════════
print('[aday kayitlar Threads degilse — 16 Ekim 2026]')
with tempfile.TemporaryDirectory() as klasor:
    yol = os.path.join(klasor, '2026-10-25_threads_eyup.jpg')
    gorsel_yaz(yol)
    # O gunun gercek aday listesinden: hicbiri threads degil.
    y = SahteYukleyici([
        {'id': 'ig1', 'platform': 'instagram', 'type': 'story'},
        {'id': 'fb1', 'platform': 'facebook', 'type': 'story'},
    ])
    (durum, not_, ek), _ = sessiz(ti.dosyayi_isle, y, yol,
                                  os.path.basename(yol), True, False, {})
    bak('★ hicbir kayda baglanmiyor', durum == 'kayit-yok', durum)
    bak('★ hicbir kayda YAZILMADI', y.yazilanlar == [], y.yazilanlar)
    # ⛔ ASIL OLCUM: yanlis gunde R2'ye TEK BAYT gitmiyor. Suzgec
    # yuklemeden once; tersi her bes dakikada bir bedava yukleme.
    bak('★ R2\'ye hic yukleme yapilmadi', y.yuklenenler == [], y.yuklenenler)
    bak('★ mesaj gorulen platformlari sayiyor',
        'instagram' in not_ and 'facebook' in not_, not_[:90])
    bak('★ mesaj ne yapilacagini soyluyor', 'dosya adini yaz' in not_, not_[:90])

    # TEK aday ve threads DEGIL: eski halde en tehlikeli durum buydu --
    # "tek aday var, demek ki bu".
    y2 = SahteYukleyici([{'id': 'ig9', 'platform': 'instagram', 'type': 'story'}])
    (durum2, not2, _e), _ = sessiz(ti.dosyayi_isle, y2, yol,
                                   os.path.basename(yol), True, False, {})
    bak('★ TEK aday bile Threads degilse baglanmiyor',
        durum2 == 'kayit-yok' and y2.yazilanlar == [], (durum2, y2.yazilanlar))
    bak('★ tek adayda da R2\'ye yukleme yok', y2.yuklenenler == [], y2.yuklenenler)

# ══════════════════════════════════════════════════════════════════
print('[dogru kayit: baglaniyor ve tiki aciliyor]')
with tempfile.TemporaryDirectory() as klasor:
    ad = '2026-10-25_threads_eyup_25_ekim_1800.jpg'
    yol = os.path.join(klasor, ad)
    gorsel_yaz(yol)
    # Karisik liste: tarihe dusulmus gibi. Yalnizca threads olani
    # alinmali, otekiler atlanmali.
    y = SahteYukleyici([
        {'id': 'ig1', 'platform': 'instagram', 'type': 'story'},
        {'id': 'th1', 'platform': 'threads', 'type': 'text_post'},
        {'id': 'yt1', 'platform': 'youtube', 'type': 'shorts'},
    ])
    (durum, not_, ek), cikti = sessiz(ti.dosyayi_isle, y, yol, ad, True, False, {})
    bak('★ baglandi', durum == 'baglandi', (durum, not_))
    bak('★ YALNIZCA threads kaydina yazildi',
        [z['id'] for z in y.yazilanlar] == ['th1'], y.yazilanlar)
    bak('★ otomatik yayin tiki ACILDI',
        y.yazilanlar and y.yazilanlar[0]['oto'] is True, y.yazilanlar)
    bak('★ R2\'ye bir kez yuklendi', y.yuklenenler == [ad], y.yuklenenler)
    bak('atlananlar ekrana yazildi', 'Threads' in cikti, cikti.strip()[:80])

    # --otomatik-acma verildiyse politika ACMIYOR: gozden gecirip elle
    # acmak isteyen kullanicinin niyeti ezilmemeli.
    y3 = SahteYukleyici([{'id': 'th1', 'platform': 'threads', 'type': 'text_post'}])
    sessiz(ti.dosyayi_isle, y3, yol, ad, False, False, {})
    bak('★ --otomatik-acma tiki acmiyor',
        y3.yazilanlar and y3.yazilanlar[0]['oto'] is False, y3.yazilanlar)

# ══════════════════════════════════════════════════════════════════
print('[8 MB siniri]')
with tempfile.TemporaryDirectory() as klasor:
    ad = '2026-10-25_threads_buyuk.jpg'
    yol = os.path.join(klasor, ad)
    gorsel_yaz(yol, 9 * 1024 * 1024)
    y = SahteYukleyici([{'id': 'th1', 'platform': 'threads', 'type': 'text_post'}])
    (durum, not_, ek), _ = sessiz(ti.dosyayi_isle, y, yol, ad, True, False, {})
    bak('★ 9 MB reddediliyor', durum == 'hata', (durum, not_))
    bak('★ sebep 8 MB siniri olarak yaziliyor', '8 MB' in not_, not_[:80])
    bak('★ buyuk dosya R2\'ye yuklenmiyor', y.yuklenenler == [], y.yuklenenler)

# ══════════════════════════════════════════════════════════════════
print('[klasor turu: ne ise giriyor]')
with tempfile.TemporaryDirectory() as klasor:
    for ad in ('2026-10-25_threads_eyup.jpg',      # ise girer
               '2026-10-25_reels_bergama.mp4',     # video: atlanir
               '2026-10-25_story_test.jpg',        # story: atlanir
               'notlar.txt'):                      # medya degil: atlanir
        gorsel_yaz(os.path.join(klasor, ad))
    y = SahteYukleyici([{'id': 'th1', 'platform': 'threads', 'type': 'text_post'}])
    # durdu_mu'nun 6 saniyelik beklemesi testi yavaslatir; olcum konusu
    # o degil.
    ti.DURULMA_SN = 0
    _, cikti = sessiz(ti.bir_tur, y, klasor, True, False)
    bak('★ yalnizca threads gorseli yuklendi',
        y.yuklenenler == ['2026-10-25_threads_eyup.jpg'], y.yuklenenler)
    bak('★ video atlandi ve sebebi yazildi',
        'video degil' in cikti, [s for s in cikti.splitlines() if 'mp4' in s])
    bak('★ story dosyasi atlandi ve sebebi yazildi',
        'story dosyasi' in cikti, [s for s in cikti.splitlines() if '_story_' in s])
    defter = json.load(open(os.path.join(klasor, ti.DEFTER_ADI), encoding='utf-8'))
    bak('★ deftere yalnizca islenen dosya yazildi',
        list(defter) == ['2026-10-25_threads_eyup.jpg'], list(defter))
    bak('durum defterde baglandi', defter['2026-10-25_threads_eyup.jpg']['durum'] == 'baglandi',
        defter['2026-10-25_threads_eyup.jpg'])

    # Ikinci tur: ayni dosya BIR DAHA yuklenmiyor.
    _, _ = sessiz(ti.bir_tur, y, klasor, True, False)
    bak('★ ikinci turda yeniden yuklenmiyor',
        y.yuklenenler == ['2026-10-25_threads_eyup.jpg'], y.yuklenenler)

# ⛔ SARTNAME BOLUM 1: hicbir kod `uploaded` sutununa yazmaz.
print('[uploaded sutunu]')
# ⚠ YORUMLAR VE BELGE METNI ATILIYOR. Dosyanin basinda "bu script de
# `uploaded` alanina dokunmuyor" diye bir uyari duruyor ve ham metinde
# arama o uyariya takiliyordu: olcum, kendi belgesini ariza sanacakti.
# Olculen sey KOD.
import re as _re

_ham = open(os.path.join(PC, 'threads-izle.py'), encoding='utf-8').read()
_kod = _re.sub(r'"""[\s\S]*?"""', '', _ham)
_kod = _re.sub(r"'''[\s\S]*?'''", '', _kod)
_kod = _re.sub(r'(?m)^[ \t]*#[^\n]*\n', '', _kod)
_kod = _re.sub(r'(?m)(^|[^:])#[^\n]*', r'\1', _kod)
bak('★ KODDA `uploaded` hic gecmiyor', 'uploaded' not in _kod,
    [s for s in _kod.splitlines() if 'uploaded' in s][:2])

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
