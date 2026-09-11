#!/bin/bash
# Butun testleri kosar, sonucu sonuc.txt'ye yazar.
#
#   ./testler/kosu.sh              hepsi
#   ./testler/kosu.sh mekan sifre  yalnizca adi gecenler
#
# Testin KENDI ciktisi ekrana DEGIL sonuc.txt'ye gidiyor: takim yuzlerce
# satir uretiyor, ekranda bogulup gecen/kalan gorunmez oluyordu. Ekrana
# her testten yalnizca tek satir dusuyor -- koserken nerede kalindigi,
# hangisinin takildigi ve ne kadar surdugu gorunsun diye:
#
#   [ 12/132] ok  mekan.test.js                        4sn
#   [ 13/132] XX  script2.test.js                      9sn
set -u
cd "$(dirname "$0")"
KOK="$(cd .. && pwd)"

# Testlerin arguman duzeni tek tip degil; her biri bekledigini alsin.
#   D-tipi     : argv[2] = fikstur/ekran goruntusu dizini  -> "."
#   PORT-tipi  : argv[2] = port (varsayilan 8098)          -> argumansiz
#   HEDEF-tipi : argv[2] = tam adres (varsayilan app.html)  -> argumansiz
#   lok-*      : argv[2] = dizin, argv[3] = port           -> ". 8099"
# Sunucular: 8098 = depo koku, 8099 = lokasyon uygulamasi (index.html
# lokasyon.html'e bakiyor), 8097 = eski anlik goruntu (eski/).
sunucu() {   # $1 = port, $2 = dizin
  if ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$1/index.html"; then
    ( cd "$2" && nohup python3 -m http.server "$1" >/dev/null 2>&1 & )
    sleep 1
  fi
}

# Lokasyon uygulamasi depo kokunden servis ediliyor ama index.html
# lokasyon.html olmali. Depoya sembolik bag koymamak icin klasor kosu
# aninda kuruluyor.
LOKSERV="${TMPDIR:-/tmp}/shootboard-lokserv"
mkdir -p "$LOKSERV"
for d in "$KOK"/*.html "$KOK"/*.png "$KOK"/*.ico "$KOK"/*.json; do
  [ -e "$d" ] && ln -sf "$d" "$LOKSERV/$(basename "$d")"
done
ln -sf "$KOK/lokasyon.html" "$LOKSERV/index.html"

sunucu 8098 "$KOK"
sunucu 8099 "$LOKSERV"
sunucu 8097 "$PWD/eski"

mkdir -p ciktilar
: > sonuc.txt
for pt in 8097 8098 8099; do
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$pt/index.html" \
    || echo "UYARI: $pt sunucusu ayaga kalkmadi" >> sonuc.txt
done

D_TIPI="arama duzeltme hafta modal proje projeler sablon3 senkron surukle tablo2 termin tz uygulama dil slate-tablo"
LOK_TIPI="lok-klon lok-surukle"

# Kosacak testler ONCE toplaniyor: ekranda "12/132" yazabilmek icin
# toplamin bastan bilinmesi gerekiyor.
kosacak=()
for f in *.test.js; do
  ad="${f%.test.js}"
  # Arguman verildiyse yalnizca adi gecenler kossun.
  if [ $# -gt 0 ]; then
    uyuyor=0
    for istek in "$@"; do case "$ad" in *"$istek"*) uyuyor=1;; esac; done
    [ $uyuyor -eq 1 ] || continue
  fi
  kosacak+=("$f")
done
toplam=${#kosacak[@]}
echo "$toplam test kosuyor"

gecen=0; kalan=0; sira=0
for f in "${kosacak[@]}"; do
  ad="${f%.test.js}"
  sira=$((sira+1))
  case " $D_TIPI " in *" $ad "*) arg=". ";; *) arg="";; esac
  case " $LOK_TIPI " in *" $ad "*) arg=". 8099";; esac
  # hatirlatma takimi 60 kontrol kosuyor ve 200 saniyeyi asiyor.
  case "$ad" in hatirlatma) sure=420;; *) sure=200;; esac
  basladi=$SECONDS
  out=$(timeout $sure node "$f" $arg 2>&1); kod=$?
  surdu=$((SECONDS-basladi))
  if [ $kod -ne 0 ]; then
    kalan=$((kalan+1))
    isaret="XX"
    echo "### BASARISIZ ($kod) $f" >> sonuc.txt
    echo "$out" | tail -14 >> sonuc.txt
    echo "" >> sonuc.txt
  else
    gecen=$((gecen+1))
    isaret="ok"
    echo "ok  $f" >> sonuc.txt
  fi
  # Ekrana tek satir: kacinci / kac, gecti mi, ne kadar surdu.
  printf '[%3d/%d] %s  %-34s %4dsn\n' "$sira" "$toplam" "$isaret" "$f" "$surdu"
done
echo "=== BITTI — $gecen gecti, $kalan kaldi ===" >> sonuc.txt
tail -1 sonuc.txt
[ $kalan -eq 0 ]
