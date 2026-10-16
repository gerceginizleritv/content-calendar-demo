#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Threads'e TEK bir deneme gonderisi atar. Shootboard'a DOKUNMAZ.

    python threads-deneme.py --metin "merhaba"
    python threads-deneme.py --metin "altyazi" --gorsel https://.../a.jpg

NEDEN VAR
  16 Ekim 2026: "Threads'e Shootboard'dan gonderi atabilir miyiz?"
  sorusunun cevabi tek bir olcume bagli ve o olcum henuz yapilmadi:

    ⛔ Development modda API ile atilan bir gonderi HERKESE gorunuyor
       mu, yoksa yalnizca uygulamada rolu olanlara mi?

  Dort ayri arama yapildi, hicbir kaynak soylemiyor. Hepsi "kim
  gonderebilir"i anlatiyor, "kime gorunur"u degil. Ikisi farkli sey ve
  bu ayrimi bilmemek Facebook'ta sekiz gun kaybettirdi: yayinlama
  calisiyordu, dagitim yoktu, hicbir yerde hata gorunmuyordu.

  Bu betik o soruyu cevaplamak icin var. Shootboard'a, worker'a,
  takvime, veritabanina HIC DOKUNMUYOR -- tek basina durur, tek is
  yapar. Olcum olumlu cikarsa gercek entegrasyon ayrica yazilacak.

⛔ NE YAPMAZ
  · Shootboard takvimine bakmaz, kayit okumaz, kayit yazmaz
  · `uploaded` dahil hicbir sutuna dokunmaz (Sartname Bolum 1)
  · Zamanlamaz, kuyruga girmez, tekrar denemez
  · Mevcut Meta uygulamamizi kullanmaz -- AYRI bir uygulamanin
    jetonuyla calisir. Facebook/Instagram yayinimiz etkilenmez.

JETON
  Ortam degiskeni: SHOOTBOARD_THREADS_TOKEN
  Meta panelinden uretiliyor (Use cases > Access the Threads API >
  Settings > User Token Generator). Uzun omurlu, ~60 gun.
  ⛔ Jeton koda yazilmaz, sohbete yazilmaz.

⚠ GONDERI GERCEKTEN YAYINLANIR
  Threads'in sandbox'i yok. Attigin sey gercek profilinde gorunur.
  O yuzden betik onay SORAR; --onayla verilmedikce yayinlamaz.
"""
import os
import sys
import json
import time
import argparse
import urllib.parse

try:
    import requests
except ImportError:
    sys.exit("requests yok. Kur:  pip install requests")

TABAN = os.environ.get('THREADS_TABANI', 'https://graph.threads.net/v1.0')
JETON = os.environ.get('SHOOTBOARD_THREADS_TOKEN', '').strip()

# Threads metin siniri. Asarsa API reddediyor; burada kesmiyoruz
# cunku sessizce kisaltilmis bir gonderi, reddedilmis bir gonderiden
# kotu -- kullanici neyin gittigini bilmeli.
METIN_SINIRI = 500


def cagir(yol, alan):
    """POST at, cevabi JSON olarak dondur. Hata varsa ANLASILIR yaz."""
    adres = TABAN + yol
    try:
        r = requests.post(adres, data=alan, timeout=60)
    except Exception as e:
        sys.exit(f"Aga ulasilamadi: {e}")
    try:
        cevap = r.json()
    except Exception:
        cevap = {'ham': r.text[:400]}
    if not r.ok:
        # ⚠ HATAYI OLDUGU GIBI YAZ. Bu betigin isi zaten "ne oluyor"
        # sorusunu cevaplamak; ozetlenmis bir hata mesaji is gormez.
        print(f"\n✗ {r.status_code} {yol}")
        print(json.dumps(cevap, ensure_ascii=False, indent=2))
        hata = (cevap.get('error') or {})
        mesaj = str(hata.get('message') or '')
        if 'permission' in mesaj.lower() or hata.get('code') in (10, 200, 803):
            print("\n→ Bu bir IZIN hatasi gibi duruyor. Muhtemel sebep:")
            print("  threads_content_publish development modda verilmiyor")
            print("  ve App Review gerekiyor. ASIL OGRENMEK ISTEDIGIMIZ")
            print("  SEY BUYDU -- sonucu Claude'a yaz.")
        sys.exit(1)
    return cevap


def kapsayici_yap(metin, gorsel):
    alan = {'access_token': JETON}
    if gorsel:
        alan['media_type'] = 'IMAGE'
        alan['image_url'] = gorsel
        if metin:
            alan['text'] = metin
    else:
        alan['media_type'] = 'TEXT'
        alan['text'] = metin
    c = cagir('/me/threads', alan)
    kimlik = str(c.get('id') or '')
    if not kimlik:
        sys.exit(f"Kapsayici kimligi donmedi: {c}")
    return kimlik


def yayinla(kapsayici):
    c = cagir('/me/threads_publish', {'access_token': JETON,
                                      'creation_id': kapsayici})
    return str(c.get('id') or '')


def main():
    ap = argparse.ArgumentParser(description='Threads deneme gonderisi')
    ap.add_argument('--metin', required=True, help='Gonderi metni')
    ap.add_argument('--gorsel', default=None,
                    help='Herkese acik gorsel adresi (istege bagli). '
                         'Threads dosyayi ADRESTEN CEKIYOR, yukleme yok.')
    ap.add_argument('--onayla', action='store_true',
                    help='Sormadan yayinla')
    ap.add_argument('--bekleme', type=int, default=20,
                    help='Kapsayici ile yayin arasindaki saniye (vars. 20). '
                         'Gorselde islenme zaman aliyor.')
    a = ap.parse_args()

    if not JETON:
        sys.exit("SHOOTBOARD_THREADS_TOKEN tanimli degil.\n"
                 "PowerShell'de:  setx SHOOTBOARD_THREADS_TOKEN \"...\"\n"
                 "Sonra PowerShell'i KAPATIP yeniden ac.")

    if len(a.metin) > METIN_SINIRI:
        sys.exit(f"Metin {len(a.metin)} karakter; Threads siniri "
                 f"{METIN_SINIRI}. Kisalt ve tekrar dene.")

    print("\n⚠ BU GONDERI GERCEKTEN YAYINLANACAK -- Threads'in sandbox'i yok.")
    print(f"  Tur   : {'GORSEL + metin' if a.gorsel else 'yalniz METIN'}")
    print(f"  Metin : {a.metin}")
    if a.gorsel:
        print(f"  Gorsel: {a.gorsel}")

    if not a.onayla:
        # ⚠ EOFError YAKALANIYOR. Gorev Zamanlayici gibi girdisiz bir
        # ortamda input() cokuyordu ve traceback basiyordu. Girdi yoksa
        # cevap HAYIR: onay alinamadiysa yayinlamamak dogru taraf.
        try:
            cevap = input("\nYayinlansin mi? (evet yazip Enter): ")
        except EOFError:
            sys.exit("Onay alinamadi (girdi yok), hicbir sey gonderilmedi.")
        if cevap.strip().lower() != 'evet':
            sys.exit("Vazgecildi, hicbir sey gonderilmedi.")

    print("\n1/2 kapsayici olusturuluyor...")
    kapsayici = kapsayici_yap(a.metin, a.gorsel)
    print(f"    kapsayici: {kapsayici}")

    # ⚠ BEKLEME GEREKLI. Yayin cagrisi kapsayici hazir olmadan
    # yapilirsa hata donuyor; gorselde islenme birkac saniye suruyor.
    print(f"2/2 {a.bekleme} sn bekleniyor, sonra yayinlanacak...")
    time.sleep(a.bekleme)

    kimlik = yayinla(kapsayici)
    print(f"\n✓ YAYINLANDI. Gonderi kimligi: {kimlik}")
    print("\nSIRADAKI IS -- olcum:")
    print("  1. Threads uygulamasinda gonderiyi ac, goruntulenmeyi NOT AL")
    print("  2. AYNI GUN elle bir gonderi at, onun sayisini da not al")
    print("  3. Tek olcum YETMEZ: Threads oynak, birkac gun esli olc")
    print("  4. Sayilari Claude'a yaz")


if __name__ == '__main__':
    main()
