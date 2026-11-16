#!/bin/bash
# PARALEL KOSUCU. kosu.sh ile AYNI testleri kosar, yalnizca hizlidir.
#
#   ./testler/hizli.sh              hepsi
#   ./testler/hizli.sh mekan sifre  yalnizca adi gecenler
#   ISCI=2 ./testler/hizli.sh       isci sayisini degistir (varsayilan 3)
#
# NEDEN VAR
#   Kullanici 16 Kasim 2026'da soyledi: "Cok fazla bekleme sureci
#   harcıyorum." Olculdu: kosu.sh 210 testi TEK SIRA kosuyor ve
#   27,8 dakika suruyor; makinede 4 cekirdek var, yani uc cekirdek
#   bos duruyor.
#
# OLCULDU (16 Kasim 2026, ayni makine, ayni 210 test):
#   kosu.sh   tek sira          27 dakika 50 saniye   210/210
#   hizli.sh  3 isci + 3 seri   10 dakika 43 saniye   210/210
#   => 2,6 kat hizli, SONUC AYNI.
#
# ⛔ kosu.sh'A DOKUNULMADI. O hala tek sira kosan, bilinen kapi.
#   Bu dosya onun YANINDA durur; ikisi ayni testleri ayni argumanlarla
#   kosar. Bir sey tuhaf gorunurse kosu.sh ile dogrula.
#
# ⚠ ESZAMANLI KOSMANIN ONU NEDEN ACIK (16 Kasim 2026'da denetlendi):
#   - Kendi sunucusunu kuran test 6 tane ve HEPSININ PORTU FARKLI
#     (8104, 8125, 8127, 8128, 8129, 8131). Cakisma yok.
#   - 159 test paylasilan 8098'i kullaniyor; o sunucu salt okunur.
#   - Dosyaya yazan tek test yedek.test.js, kendi gecici yoluna yaziyor.
#   - Ekran goruntusu adlari (ciktilar/) ayri ayri.
#   ⚠ Yeni bir test SABIT PORT kullaniyorsa, portun bu listede
#     olmadigindan emin ol; yoksa iki test ayni porta baglanip
#     RASTGELE kirmizi yanar ve sebebi gorunmez.
#
# ⛔ ZAMANA DUYARLI TESTLER PARALEL KOSMAZ. Asagidaki SERI listesi
#   sonda, tek sira kosuyor. Sebebi 27 Ekim 2026: ayni commit'in iki
#   CI kosusunda iki test YALNIZCA "Timeout exceeded" ile kaldi; kod
#   dogruydu, kosucu ~4 kat yavasti. Dort chromium'u dort cekirdege
#   bindirmek ayni tuzak. Iddiasi gecen SUREYE dayanan testler
#   arandi (tahmin edilmedi):
#     ai-gorunur    -> "gecen < 15000"
#     gezinme-tavani-> "surdu < 10000"
#     hatirlatma    -> en uzun test (52sn) ve zamanli hatirlatma
#                      kosullarini olcuyor
#   ⚠ Baska bir test paralelde RASTGELE kirmizi yanmaya baslarsa once
#     buraya ekle, testi zayiflatma.
set -u
# ⛔ MUTLAK YOL, cd'DEN ONCE. $0 goreli gelirse (ornegin
#   `bash testler/hizli.sh`) asagidaki cd'den sonra o yol artik
#   cozulmez ve her isci "No such file or directory" der: ilk
#   denemede tam bu oldu, dort test de "kaldi" diye sayildi.
BEN="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")"

ISCI="${ISCI:-3}"
SERI="ai-gorunur gezinme-tavani hatirlatma"

export NODE_OPTIONS="${NODE_OPTIONS:-} --experimental-strip-types"
KOK="$(cd .. && pwd)"

# ── Tek bir testi kosan ic mod. xargs bu dosyayi boyle cagiriyor. ────
if [ "${1:-}" = "--tek" ]; then
  f="$2"; ad="${f%.test.js}"; ad="${ad%.test.py}"
  D_TIPI="arama duzeltme hafta modal proje projeler sablon3 senkron surukle tablo2 termin tz uygulama dil slate-tablo"
  LOK_TIPI="lok-klon lok-surukle"
  case " $D_TIPI " in *" $ad "*) arg=". ";; *) arg="";; esac
  case " $LOK_TIPI " in *" $ad "*) arg=". 8099";; esac
  case "$ad" in hatirlatma) sure=420;; *) sure=200;; esac
  basladi=$SECONDS
  case "$f" in
    *.test.py) out=$(timeout $sure python3 "$f" 2>&1); kod=$? ;;
    *)         out=$(timeout $sure node "$f" $arg 2>&1); kod=$? ;;
  esac
  surdu=$((SECONDS-basladi))
  printf '%s\n' "$out" > "ciktilar/$ad.cikti"
  echo "$kod"   > "ciktilar/$ad.kod"
  echo "$surdu" > "ciktilar/$ad.sure"
  [ $kod -eq 0 ] && isaret="ok" || isaret="XX"
  # Tek satir, tek seferde: paralel yazimda satirlar birbirine girmesin.
  printf '%s\n' "$(printf '  %s  %-34s %4dsn' "$isaret" "$f" "$surdu")"
  exit 0
fi

# ── Sunucular (kosu.sh ile birebir ayni) ─────────────────────────────
sunucu() {
  if ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$1/index.html"; then
    ( cd "$2" && nohup python3 -m http.server "$1" >/dev/null 2>&1 & )
    sleep 1
  fi
}
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

# ── Kosacak testler toplaniyor (kosu.sh ile ayni suzgec) ─────────────
kosacak=()
for f in *.test.js *.test.py; do
  [ -e "$f" ] || continue
  ad="${f%.test.js}"; ad="${ad%.test.py}"
  if [ $# -gt 0 ]; then
    uyuyor=0
    for istek in "$@"; do case "$ad" in *"$istek"*) uyuyor=1;; esac; done
    [ $uyuyor -eq 1 ] || continue
  fi
  kosacak+=("$f")
done
toplam=${#kosacak[@]}
[ $toplam -eq 0 ] && { echo "hic test secilmedi"; exit 1; }

# Paralel ve seri kumeler
paralel=(); seri=()
for f in "${kosacak[@]}"; do
  ad="${f%.test.js}"; ad="${ad%.test.py}"
  case " $SERI " in *" $ad "*) seri+=("$f");; *) paralel+=("$f");; esac
done

# ⚠ UZUN TESTLER ONCE. Son kosunun sureleri sureler.txt'de duruyor;
#   en uzunu en sona kalirsa butun isciler onu bekler ve kazanc erir.
#   Dosya yoksa alfabetik kosar (yalnizca daha yavas, yanlis degil).
if [ -s sureler.txt ] && [ ${#paralel[@]} -gt 0 ]; then
  sirali=()
  while IFS= read -r f; do sirali+=("$f"); done < <(
    for f in "${paralel[@]}"; do
      s=$(awk -F'\t' -v a="$f" '$1==a{print $2; exit}' sureler.txt)
      printf '%s\t%s\n' "${s:-0}" "$f"
    done | sort -k1 -rn | cut -f2
  )
  paralel=("${sirali[@]}")
fi

basladi=$SECONDS
echo "$toplam test kosuyor — $ISCI isci paralel, ${#seri[@]} tanesi sonda tek sira"

if [ ${#paralel[@]} -gt 0 ]; then
  printf '%s\0' "${paralel[@]}" | xargs -0 -P "$ISCI" -I{} bash "$BEN" --tek {}
fi
for f in "${seri[@]}"; do bash "$BEN" --tek "$f"; done

# ── Toplama ──────────────────────────────────────────────────────────
gecen=0; kalan=0
: > sureler.yeni
for f in "${kosacak[@]}"; do
  ad="${f%.test.js}"; ad="${ad%.test.py}"
  kod=$(cat "ciktilar/$ad.kod" 2>/dev/null || echo 99)
  sur=$(cat "ciktilar/$ad.sure" 2>/dev/null || echo 0)
  printf '%s\t%s\n' "$f" "$sur" >> sureler.yeni
  if [ "$kod" -ne 0 ]; then
    kalan=$((kalan+1))
    echo "### BASARISIZ ($kod) $f" >> sonuc.txt
    tail -14 "ciktilar/$ad.cikti" 2>/dev/null >> sonuc.txt
    echo "" >> sonuc.txt
  else
    gecen=$((gecen+1))
    echo "ok  $f" >> sonuc.txt
  fi
done
# Sureler guncellensin ki bir dahaki kosu daha iyi siralasin.
# ⚠ Yalnizca TAM kosuda yaz: suzgecli kosu listeyi budardi.
[ $# -eq 0 ] && sort -k2 -rn sureler.yeni > sureler.txt
rm -f sureler.yeni

echo "=== BITTI — $gecen gecti, $kalan kaldi ===" >> sonuc.txt
printf '=== BITTI — %d gecti, %d kaldi — %d dakika %d saniye ===\n' \
  "$gecen" "$kalan" $(( (SECONDS-basladi)/60 )) $(( (SECONDS-basladi)%60 ))
[ $kalan -eq 0 ]
