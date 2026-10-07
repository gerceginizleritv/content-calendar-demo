#!/usr/bin/env python3
"""Reels mp4'lerinin bit hizini dusurur, sonra istege bagli olarak yeniden yukler.

NEDEN VAR: 1-2 Ekim 2026'da Shootboard'in Facebook'a gonderdigi reels'ler
sifir dagitim aldi (1, 6, 7, 9 goruntulenme), elle atilanlar 1.400-6.000
aliyordu. Sayfanin 16 dakikalik videolari 58 bin goruntulenme aldigi icin
uzunluk elendi; telif, gizlilik, en/boy orani ve uc da olcumle elendi.
Geriye iki fark kaldi: `title` alani ve DOSYA BUYUKLUGU -- 96 saniyelik
video 108 MB, yani ~9 Mbit/sn. 1080x1920 bir reel normalde 15-30 MB olur.
Bu betik ikinci farki kapatiyor.

  python reels-bitrate.py "E:\\CLAUDE VIDEOS\\TESLIM\\REELS_V2"
  python reels-bitrate.py "...\\REELS_V2" --yukle      # kodla VE R2'ye gonder

⚠ ELLE R2'YE YUKLEME YAPMA. story-yayin/index.ts:1727'de boyut
`k.media_bytes` ONCE okunuyor, HTTP content-length sonra. R2'deki nesneyi
tek basina degistirirsen kayit eski boyutu soylemeye devam eder; Facebook'a
yanlis `file_size` gider ve yukleme asilir. Dosya degistiyse kayit da
degismeli -- `reels-yukle.py` ikisini birlikte yapiyor, o yuzden yukleme
adimi onun uzerinden geciyor.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

# Bu esigin ALTINDAKI dosyaya dokunulmuyor: betik tekrar tekrar
# kosturulabilsin diye. Yoksa her kosuda ayni dosyalar yeniden kodlanir ve
# her kodlama bir nesil kalite kaybi demek.
ESIK_BIT = 6_000_000          # 6 Mbit/sn
HEDEF_CRF = "23"              # tipik olarak 3-5 Mbit/sn
TEPE_BIT = "6M"
ARABELLEK = "12M"


def komut_var(ad):
    return shutil.which(ad) is not None


def olc(yol):
    """Sure ve bit hizi. ffprobe yoksa ya da dosya bozuksa None doner."""
    try:
        ham = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "format=duration,bit_rate,size", "-of", "json", yol],
            capture_output=True, text=True, timeout=120, check=True).stdout
        b = json.loads(ham).get("format", {})
        return {"sure": float(b.get("duration") or 0),
                "bit": int(b.get("bit_rate") or 0),
                "boyut": int(b.get("size") or 0)}
    except Exception as e:
        print(f"    ffprobe okuyamadi: {e}")
        return None


def kodla(girdi, cikti):
    """Yeniden kodlama. Cozunurluge DOKUNULMUYOR: dosyalar zaten 1080x1920 ve
    olceklemek sadece bozulma ihtimali ekler. fps_mode cfr degisken kare
    hizini sabitliyor ama kare hizini DEGISTIRMIYOR. +faststart moov atom'unu
    basa aliyor; Facebook akistan cozumleyebilsin diye onemli."""
    return subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", girdi,
        "-c:v", "libx264", "-preset", "slow", "-crf", HEDEF_CRF,
        "-maxrate", TEPE_BIT, "-bufsize", ARABELLEK,
        "-profile:v", "high", "-pix_fmt", "yuv420p", "-fps_mode", "cfr",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", cikti
    ]).returncode == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("klasor", help="Icinde mp4 bulunan klasor")
    ap.add_argument("--yukle", action="store_true",
                    help="Kodlamadan sonra reels-yukle.py ile R2'ye gonder")
    ap.add_argument("--esik", type=int, default=ESIK_BIT,
                    help=f"Bu bit hizinin altindakilere dokunma (varsayilan {ESIK_BIT})")
    a = ap.parse_args()

    for c in ("ffmpeg", "ffprobe"):
        if not komut_var(c):
            sys.exit(f"{c} bulunamadi. Kur:  winget install Gyan.FFmpeg\n"
                     f"Kurduktan sonra terminali kapat/ac.")

    if not os.path.isdir(a.klasor):
        sys.exit(f"Klasor yok: {a.klasor}")

    # Eski dosyalar SILINMIYOR, yana tasiniyor. Yeniden kodlama geri
    # alinamaz; bir kare kaybi fark edilirse donulecek bir yer kalsin.
    yedek = os.path.join(a.klasor, "_eski_bitrate")
    os.makedirs(yedek, exist_ok=True)

    mp4 = sorted(f for f in os.listdir(a.klasor)
                 if f.lower().endswith(".mp4")
                 and os.path.isfile(os.path.join(a.klasor, f)))
    if not mp4:
        sys.exit(f"Klasorde mp4 yok: {a.klasor}")

    print(f"{len(mp4)} dosya bulundu. Esik: {a.esik / 1e6:.1f} Mbit/sn\n")
    kodlanan, atlanan, basarisiz = [], [], []

    for ad in mp4:
        yol = os.path.join(a.klasor, ad)
        print(f"{ad}")
        # ⚠ YEDEK VARSA DUR. Iki hata birden buradan cikti (2 Ekim 2026,
        # betigin ilk olcumu): ikinci kosuda dosya YENIDEN kodlaniyordu --
        # ikinci nesil kalite kaybi -- ve shutil.move yedegi EZIYORDU, yani
        # gercek orijinal kayboluyordu. CRF cikti bit hizini garanti
        # etmedigi icin "esigin altina indi mi" kontrolu bunu yakalamiyor:
        # sikismasi zor bir kaynak esigin ustunde kalabiliyor ve her kosuda
        # yeniden kodlanmaya devam ediyor. Yedegin VARLIGI "bu dosya islendi"
        # demek; tek kural hem nesil kaybini hem veri kaybini kesiyor.
        if os.path.exists(os.path.join(yedek, ad)):
            print("    daha once islenmis (yedegi var) -- dokunulmadi")
            atlanan.append(ad)
            continue
        once = olc(yol)
        if not once or not once["bit"]:
            print("    OLCULEMEDI -- atlandi")
            basarisiz.append(ad)
            continue
        print(f"    once : {once['boyut'] / 1048576:6.1f} MB  "
              f"{once['bit'] / 1e6:5.2f} Mbit/sn  {once['sure']:.1f} sn")
        if once["bit"] < a.esik:
            print("    esigin altinda -- dokunulmadi")
            atlanan.append(ad)
            continue

        gecici = yol + ".yeni.mp4"
        if not kodla(yol, gecici):
            print("    ffmpeg HATA -- dosya oldugu gibi birakildi")
            if os.path.exists(gecici):
                os.remove(gecici)
            basarisiz.append(ad)
            continue

        sonra = olc(gecici)
        # ⚠ DOGRULAMA ZORUNLU. ffmpeg 0 donup yine de budanmis dosya
        # birakabiliyor (bozuk girdi, disk dolmasi). Sureyi karsilastirmadan
        # orijinali kenara almak, sessizce yarim video yayinlamak demek.
        if (not sonra or sonra["boyut"] <= 0
                or abs(sonra["sure"] - once["sure"]) > 0.5):
            print(f"    DOGRULAMA BASARISIZ (sure {once['sure']:.1f} -> "
                  f"{sonra['sure'] if sonra else '?'}) -- orijinal korundu")
            os.remove(gecici)
            basarisiz.append(ad)
            continue
        if sonra["boyut"] >= once["boyut"]:
            print("    yeni dosya kucuk DEGIL -- orijinal korundu")
            os.remove(gecici)
            atlanan.append(ad)
            continue

        shutil.move(yol, os.path.join(yedek, ad))
        shutil.move(gecici, yol)
        kazanc = 100 - (sonra["boyut"] / once["boyut"] * 100)
        print(f"    sonra: {sonra['boyut'] / 1048576:6.1f} MB  "
              f"{sonra['bit'] / 1e6:5.2f} Mbit/sn   (-%{kazanc:.0f})")
        if sonra["bit"] >= a.esik:
            # Gercek saha goruntusu CRF 23'te 3-5 Mbit/sn'ye iniyor. Buraya
            # dusen dosya ya cok hareketli ya da gurultulu; bir daha
            # kodlanmayacagi icin kullanici bilsin.
            print(f"    ⚠ hala esigin ustunde ({sonra['bit'] / 1e6:.2f} "
                  f"Mbit/sn) -- bu dosyayi elle gozden gecir")
        kodlanan.append(ad)

    print(f"\n=== {len(kodlanan)} kodlandi, {len(atlanan)} atlandi, "
          f"{len(basarisiz)} basarisiz ===")
    if basarisiz:
        print("basarisiz: " + ", ".join(basarisiz))
    if yedek and not os.listdir(yedek):
        os.rmdir(yedek)
    elif kodlanan:
        print(f"orijinaller: {yedek}")

    if not kodlanan:
        return

    yukleyici = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "reels-yukle.py")
    if not a.yukle:
        print("\nSimdi R2'ye gondermek icin (kayittaki mediaBytes de guncellenir):")
        for ad in kodlanan:
            print(f'  "{sys.executable}" "{yukleyici}" "{os.path.join(a.klasor, ad)}"')
        return

    print("\nR2'ye gonderiliyor...")
    for ad in kodlanan:
        print(f"-> {ad}")
        if subprocess.run([sys.executable, yukleyici,
                           os.path.join(a.klasor, ad)]).returncode != 0:
            print(f"   YUKLENEMEDI: {ad} -- kalanlara devam ediliyor")


if __name__ == "__main__":
    main()
