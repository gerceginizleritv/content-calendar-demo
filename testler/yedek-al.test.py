#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""YEDEK ALMA — ağ olmadan, karar mantığı ölçülüyor.

Supabase ÜCRETSİZ planda ve ücretsiz planın otomatik yedeği YOK
(12 Ekim 2026, kullanıcı Pro'ya geçmedi). Yani bu script tek koruma.
Sessizce yarım iş yapan bir yedek, yedeksizlikten kötüdür: insan
"yedeğim var" sanır ve ancak ihtiyaç duyduğu gün öğrenir.

⚠ EN ÖNEMLİ DÖRT ÖLÇÜM (yıldızlı):
 · 90 günlük pencere — aracın `until` alanı "en fazla since+90" diyor;
   daha genişi uç hatası, daha darı boşuna istek
 · tekilleştirme — pencere sınırları ve sayfalama üst üste binebiliyor
 · BOŞ YEDEK YAZILMIYOR — ağ koparsa boş dosya bir öncekinin üstüne
   yazar ve asıl yedeği yok eder
 · ⛔ HİÇBİR ŞEY YAZMIYOR — yalnızca listeleme araçları çağrılıyor
"""
import io
import os
import re
import sys
import json
import shutil
import tempfile
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
    def __getattr__(s, a): return SahteModul()
    def __call__(s, *a, **k): return SahteModul()


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


ya = modul_al('yedek-al.py', 'yedek_al')


# ══════════════════════════════════════════════════════════════════
print('[pencereler: aracın 90 gün sınırı]')
p = list(ya.pencereler(datetime.date(2026, 1, 1), datetime.date(2026, 1, 1)))
bak('tek günlük aralık tek pencere', p == [(datetime.date(2026, 1, 1),
                                            datetime.date(2026, 1, 1))], p)

p = list(ya.pencereler(datetime.date(2025, 1, 1), datetime.date(2026, 12, 31)))
# ⚠ SABİTE DEĞİL, UCUN GERÇEK SINIRINA BAKILIYOR.
# İlk hâli `< ya.PENCERE_GUN` idi: sabit 180 yapılınca ölçüm de 180'e
# bakıyor ve hep geçiyordu. Kendi kendini doğrulayan bir ölçüm hiçbir
# şey ölçmez. 90, shootboard_list_entries'in `until` alanının sınırı.
bak('★ hiçbir pencere 90 günü GEÇMİYOR (ucun sınırı)',
    all((b - a).days < 90 for a, b in p),
    max((b - a).days for a, b in p))
bak('★ sabit de 90 (uçla aynı)', ya.PENCERE_GUN == 90, ya.PENCERE_GUN)
bak('★ pencerelerde BOŞLUK yok (atlanan gün olmaz)',
    all(p[i + 1][0] - p[i][1] == datetime.timedelta(days=1) for i in range(len(p) - 1)))
bak('★ pencerelerde ÜST ÜSTE binme yok', all(a <= b for a, b in p))
bak('ilk gün ve son gün kapsanıyor',
    p[0][0] == datetime.date(2025, 1, 1) and p[-1][1] == datetime.date(2026, 12, 31))

# Aralık geniş tutuldu: dar bir aralık, dışında kalan kaydı SESSİZCE
# yedeklemezdi.
bak('★ başlangıç tarihi geriye dönük geniş (2025 ya da öncesi)',
    ya.ILK_TARIH <= datetime.date(2025, 1, 1), ya.ILK_TARIH)
bak('★ bugünden en az bir yıl ileriyi kapsıyor', ya.SON_TARIH_PAYI >= 365,
    ya.SON_TARIH_PAYI)


# ══════════════════════════════════════════════════════════════════
print('\n[toplama: sayfalama ve tekilleştirme]')


class SahteSunucu:
    """Verilen sayfaları sırayla döndürür. Çağrıları da kaydeder."""
    def __init__(s, sayfalar, projeler=None):
        s.sayfalar = list(sayfalar)
        s.projeler = projeler or []
        s.cagrilar = []

    def arac(s, ad, **arg):
        s.cagrilar.append((ad, arg))
        if ad == 'shootboard_list_projects':
            return {'ok': True, 'projects': s.projeler}
        if s.sayfalar:
            return s.sayfalar.pop(0)
        return {'ok': True, 'entries': [], 'nextCursor': None}


def K(*idler):
    return [{'id': i, 'date': '2026-03-01'} for i in idler]


s = SahteSunucu([{'entries': K('a', 'b'), 'nextCursor': 'c1'},
                 {'entries': K('c'), 'nextCursor': None}])
with contextlib.redirect_stdout(io.StringIO()):
    sonuc = ya.kayitlari_topla(s)
bak('sayfalar birleştiriliyor', [k['id'] for k in sonuc] == ['a', 'b', 'c'],
    [k['id'] for k in sonuc])

# Pencere sınırında aynı kayıt iki kez dönebiliyor.
s = SahteSunucu([{'entries': K('a', 'b'), 'nextCursor': None},
                 {'entries': K('b', 'c'), 'nextCursor': None}])
with contextlib.redirect_stdout(io.StringIO()):
    sonuc = ya.kayitlari_topla(s)
bak('★ aynı id iki kez yazılmıyor', [k['id'] for k in sonuc] == ['a', 'b', 'c'],
    [k['id'] for k in sonuc])

# İmleç dönüyor ama yeni kayıt gelmiyor: sonsuz döngü tuzağı.
s = SahteSunucu([{'entries': K('a'), 'nextCursor': 'x'}] * 50)
with contextlib.redirect_stdout(io.StringIO()):
    sonuc = ya.kayitlari_topla(s)
bak('★ imleç dönüp duruyorsa sonsuz döngüye girmiyor',
    len(sonuc) == 1 and len(s.cagrilar) < 40, (len(sonuc), len(s.cagrilar)))


# ══════════════════════════════════════════════════════════════════
print('\n[baştan sona: dosya yazımı]')
gecici = tempfile.mkdtemp(prefix='shb-yedek-')
try:
    class SahteSY:
        def ayar(s, ad, zorunlu=True):
            return {'SHOOTBOARD_MCP_URL': 'https://x/mcp',
                    'SHOOTBOARD_KEY': 'shb_test'}[ad]

    global kostur
    def kostur(sayfalar, projeler=None, klasor=None):
        s = SahteSunucu(sayfalar, projeler)
        eski_argv, eski_al, eski_sunucu = sys.argv, ya.story_yukleyiciyi_al, ya.Sunucu
        sys.argv = ['yedek-al.py', '--klasor', klasor or gecici]
        ya.story_yukleyiciyi_al = lambda: SahteSY()
        ya.Sunucu = lambda kok, anahtar: s
        yazi = io.StringIO()
        kod = 0
        try:
            with contextlib.redirect_stdout(yazi):
                ya.main()
        except SystemExit as e:
            kod = e.code
        finally:
            sys.argv, ya.story_yukleyiciyi_al, ya.Sunucu = eski_argv, eski_al, eski_sunucu
        return s, yazi.getvalue(), kod

    s, cikti, kod = kostur([{'entries': K('a', 'b', 'c'), 'nextCursor': None}],
                           projeler=[{'id': 'p1', 'name': 'KOL B'}])
    dosyalar = [x for x in os.listdir(gecici) if x.endswith('.json')]
    bak('yedek dosyası yazıldı', len(dosyalar) == 1, dosyalar)

    govde = json.load(open(os.path.join(gecici, dosyalar[0]), encoding='utf-8'))
    bak('kayıtlar dosyada', [k['id'] for k in govde['kayitlar']] == ['a', 'b', 'c'])
    bak('projeler dosyada', govde['projeler'] == [{'id': 'p1', 'name': 'KOL B'}])
    bak('sayılar başlıkta', govde['kayit_sayisi'] == 3 and govde['proje_sayisi'] == 1)
    bak('ne zaman alındığı yazılı', bool(govde.get('alindi')))
    bak('dosya adında tarih VE saat-dakika-saniye var',
        re.match(r'shootboard-yedek-\d{4}-\d{2}-\d{2}_\d{6}\.json', dosyalar[0]) is not None,
        dosyalar[0])
    bak('.tmp artığı kalmadı',
        not any(x.endswith('.tmp') for x in os.listdir(gecici)), os.listdir(gecici))

    # ⚠ EN ÖNEMLİSİ: boş cevap geldiğinde ESKİ YEDEĞİN ÜSTÜNE YAZMAMAK.
    oncesi = sorted(os.listdir(gecici))
    s2, cikti2, kod2 = kostur([{'entries': [], 'nextCursor': None}])
    bak('★ hiç kayıt gelmezse dosya YAZILMIYOR',
        sorted(os.listdir(gecici)) == oncesi, os.listdir(gecici))
    bak('★ boş yedekte sıfırdan farklı çıkış kodu', kod2 not in (0, None), kod2)
    bak('★ sebebi ekrana yazılıyor', 'HIC KAYIT GELMEDI' in str(kod2), str(kod2)[:60])

    # İkinci yedek öncekini SİLMİYOR.
    import time as _t
    _t.sleep(1.1)   # ayni dakika, FARKLI saniye
    kostur([{'entries': K('a'), 'nextCursor': None}])
    bak('★ eski yedek silinmiyor, yanına yazılıyor',
        len([x for x in os.listdir(gecici) if x.endswith('.json')]) == 2,
        os.listdir(gecici))
finally:
    shutil.rmtree(gecici, ignore_errors=True)


# ══════════════════════════════════════════════════════════════════
print('\n[⛔ salt okur]')
kaynak = open(os.path.join(PC, 'yedek-al.py'), encoding='utf-8').read()
bak('★ yalnızca listeleme araçları çağrılıyor',
    sorted(set(re.findall(r"arac\('([a-z_]+)'", kaynak)))
    == ['shootboard_list_entries', 'shootboard_list_projects'],
    sorted(set(re.findall(r"arac\('([a-z_]+)'", kaynak))))
bak('★ shootboard_update_entry HİÇ geçmiyor', 'update_entry' not in kaynak)
bak('★ shootboard_import HİÇ geçmiyor', 'shootboard_import' not in kaynak)
# ⚠ ARANAN ŞEY KELİMENİN VARLIĞI DEĞİL, ALAN OLARAK KULLANILMASI.
# İlk hâli 'uploaded' not in kaynak idi ve DOKUNMADIĞIMIZI anlatan yorum
# satırına takıldı. Yorumu silmek ölçümü kurtarırdı ama ölçüm yanlış
# şeye bakıyordu. (Aynı hatayı OTOMATIK_YAYIN testinde de yapmıştım.)
bak('⛔ uploaded bir ALAN olarak kullanılmıyor (yalnızca yorumda geçiyor)',
    re.search(r"""['\"]uploaded['\"]|\.uploaded\b|uploaded\s*=""", kaynak) is None)
bak('PATCH/DELETE isteği yok',
    'patch(' not in kaynak.lower() and 'delete(' not in kaynak.lower())
bak('tek HTTP yöntemi POST (JSON-RPC)',
    kaynak.count('requests.post') == 1 and 'requests.get' not in kaynak)

print('\n[dosya bütünlüğü]')
bak('★ önce .tmp, sonra os.replace (yarım dosya kalmaz)',
    "gecici = yol + '.tmp'" in kaynak and 'os.replace(gecici, yol)' in kaynak)
bak('yazdıktan sonra geri okunuyor (kaynakta)',
    'geri = json.load(f)' in kaynak)

# ⚠ DAVRANIŞLA ÖLÇÜLÜYOR, metinde aramakla değil. Karşılaştırma satırı
# silindiğinde kaynak metni aynı kalıyordu ve ölçüm geçiyordu.
# Geri okumayı EKSİK döndürüp çıkışı bekliyoruz: diski dolu bir
# makinede fark tam burada çıkar.
gecici2 = tempfile.mkdtemp(prefix='shb-yedek2-')
try:
    class EksikOkuyan:
        """json.dump aynen, json.load EKSİK döndürüyor."""
        def dump(s, *a, **k): return json.dump(*a, **k)
        def load(s, f):
            v = json.load(f)
            v['kayitlar'] = v['kayitlar'][:-1]     # bir kayıt eksik
            return v

    eski_json = ya.json
    ya.json = EksikOkuyan()
    try:
        _s, _c, _kod = kostur([{'entries': K('a', 'b', 'c'), 'nextCursor': None}],
                              klasor=gecici2)
    finally:
        ya.json = eski_json
    bak('★ geri okuma eksik gelirse DURUYOR (sessiz geçmiyor)',
        _kod not in (0, None) and 'DOGRULANAMADI' in str(_kod), _kod)
finally:
    shutil.rmtree(gecici2, ignore_errors=True)

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
