# -*- coding: utf-8 -*-
"""YouTube denetim basvurusu icin kanit PDF'i uretir.

    python denetim/kanit-pdf.py [goruntu-klasoru] [cikti.pdf]

Varsayilan klasor: denetim/kanit-goruntuleri
Varsayilan cikti : denetim/shootboard-oauth-and-upload-evidence.pdf

NEDEN VAR
  Form "CONDITIONAL EVIDENCE" alaninda TEK bir dosya istiyor, ama bizim
  kullanim senaryomuz iki sey gerektiriyor: OAuth akisi ve yukleme
  arayuzu. Hepsi tek PDF'te birlesiyor.

  YouTube denetimi PERIYODIK olarak tekrarlaniyor. Yeniden denetimde
  sifirdan ugrasmak yerine ekran goruntulerini yenileyip bunu
  kosturmak yeter -- uret.js diyagramlar icin ne yapiyorsa bu da
  ekran goruntuleri icin onu yapiyor.

  ⚠ EKRAN GORUNTULERI DEPODA DURMUYOR. Icinde kullanicinin e-posta
  adresleri var ve her denetimde yenilenmeleri gerekiyor (arayuz
  degisiyor). Uretilen PDF duruyor: gonderdigimiz seyin kaydi o.

GEREKEN DOSYALAR (asagidaki SAYFALAR listesindeki adlarla)
  01-baglanti-sayfasi.png   Shootboard youtube.html, baglanmadan once
  02-izin-ekrani.png        Google izin ekrani
  03-verilen-kapsam.png     Google Hesabi > ucuncu taraf > Shootboard
  04-baglandi.png           Shootboard "YouTube baglandi"
  05-baglantiyi-kes.png     Shootboard "Baglantiyi kes" dugmesi
  06-yukleme-arayuzu.png    Shorts kaydinin otomatik yayin paneli

KURULUM
  pip install reportlab pillow
"""
import sys
import os
from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor

G = '/usr/share/fonts/truetype/dejavu'
pdfmetrics.registerFont(TTFont('DJ', os.path.join(G, 'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DJB', os.path.join(G, 'DejaVuSans-Bold.ttf')))

BURASI = os.path.dirname(os.path.abspath(__file__))
RESIM = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BURASI, 'kanit-goruntuleri')
CIKTI = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    BURASI, 'shootboard-oauth-and-upload-evidence.pdf')

SAYFALAR = [
    ('01-baglanti-sayfasi.png', 'OAuth flow - step 1 of 3: entry point',
     'Shootboard\'s YouTube connection page (https://shootboard.app/youtube.html) before any '
     'channel is connected. The user starts here and presses "Google ile devam et" '
     '("Continue with Google"). The interface language is Turkish.'),

    ('02-izin-ekrani.png', 'OAuth flow - step 2 of 3: consent screen',
     'Google\'s consent screen for shootboard.app. The app is not yet verified, so Google shows '
     'its unverified-app notice and the user continues deliberately. The account shown is the '
     'channel owner\'s own Google account.'),

    ('03-verilen-kapsam.png', 'OAuth flow - step 3 of 3: granted scope and revocation',
     'The grant as it appears in the user\'s own Google Account (Security > Third-party apps > '
     'Shootboard). "Shootboard sunlari yapabilir" means "Shootboard can do the following", and '
     'the single line under it reads "Manage your YouTube videos" - the youtube.upload scope, '
     'which is the only scope we request. The button on the right, "Tum erisimi kaldir", is '
     '"Remove all access": the user can revoke at any time from Google\'s own settings.'),

    ('04-baglandi.png', 'Connected state',
     'Shootboard after the channel is connected. The text states plainly that scheduled videos '
     'will be uploaded to the owner\'s channel at the planned time, and that until the app is '
     'audited YouTube locks uploaded videos to private. This audit request exists to lift that '
     'lock.'),

    ('05-baglantiyi-kes.png', 'Revocation inside the application',
     'The same page also offers revocation inside Shootboard itself: "Baglantiyi kes" means '
     '"Disconnect". The note below it says the connection can also be removed from Google '
     'Account settings, and that the stored tokens are deleted when disconnected.'),

    ('06-yukleme-arayuzu.png', 'Upload interface',
     'The upload interface: a Short planned in the content calendar. The owner ticks "Publish '
     'automatically"; Shootboard then uploads this file through videos.insert and YouTube '
     'publishes it at the time shown. Title and description come from this entry. Nothing is '
     'uploaded unless the owner scheduled it here.'),
]

ALTYAZI = 'Shootboard  ·  https://shootboard.app  ·  Google Cloud project 505142582656'

EN, BOY = A4
KENAR = 42
MET = HexColor('#1a1a1a')
SOLUK = HexColor('#6b6b6b')

def sar(c, metin, font, punto, genislik):
    """Metni genislige sigacak satirlara bol."""
    satirlar, simdi = [], ''
    for kelime in metin.split():
        deneme = (simdi + ' ' + kelime).strip()
        if c.stringWidth(deneme, font, punto) <= genislik:
            simdi = deneme
        else:
            if simdi:
                satirlar.append(simdi)
            simdi = kelime
    if simdi:
        satirlar.append(simdi)
    return satirlar

c = canvas.Canvas(CIKTI, pagesize=A4)
c.setTitle('Shootboard - OAuth flow and upload interface evidence')
c.setAuthor('Shootboard')
c.setSubject('YouTube API Services compliance audit - conditional evidence')

for sira, (dosya, baslik, aciklama) in enumerate(SAYFALAR, 1):
    y = BOY - KENAR

    # Sayfa numarasi
    c.setFont('DJ', 8.5)
    c.setFillColor(SOLUK)
    c.drawRightString(EN - KENAR, y - 2, '%d / %d' % (sira, len(SAYFALAR)))

    # Baslik
    c.setFont('DJB', 13)
    c.setFillColor(MET)
    c.drawString(KENAR, y - 4, baslik)
    y -= 22

    # Aciklama
    c.setFont('DJ', 9.6)
    c.setFillColor(MET)
    for satir in sar(c, aciklama, 'DJ', 9.6, EN - 2 * KENAR):
        c.drawString(KENAR, y, satir)
        y -= 13.2
    y -= 10

    # Ince ayrac
    c.setStrokeColor(HexColor('#d9d9d9'))
    c.setLineWidth(0.6)
    c.line(KENAR, y, EN - KENAR, y)
    y -= 18

    # Gorsel: alfa kanali duz beyaza yedirilmeden PDF'te kararabiliyor.
    im = Image.open(os.path.join(RESIM, dosya))
    if im.mode in ('RGBA', 'LA', 'P'):
        im = im.convert('RGBA')
        zemin = Image.new('RGB', im.size, (255, 255, 255))
        zemin.paste(im, mask=im.split()[-1])
        im = zemin
    gw, gh = im.size
    kul_en = EN - 2 * KENAR
    kul_boy = y - KENAR - 16
    olcek = min(kul_en / gw, kul_boy / gh)
    cw, ch = gw * olcek, gh * olcek
    cx = (EN - cw) / 2
    # Kalan alanda DIKEY ORTALA: ust hizali birakmak kisa goruntulerde
    # sayfanin altinda buyuk bir bosluk birakiyordu.
    alt = KENAR + 16
    cy = alt + (kul_boy - ch) / 2

    # Koyu ekran goruntulerinin siniri belli olsun
    c.setStrokeColor(HexColor('#c4c4c4'))
    c.rect(cx - 0.5, cy - 0.5, cw + 1, ch + 1, stroke=1, fill=0)
    c.drawImage(ImageReader(im), cx, cy, width=cw, height=ch)

    # Altyazi
    c.setFont('DJ', 7.6)
    c.setFillColor(SOLUK)
    c.drawString(KENAR, KENAR - 14, ALTYAZI)

    c.showPage()

c.save()
print('yazildi:', CIKTI, os.path.getsize(CIKTI), 'bayt')
