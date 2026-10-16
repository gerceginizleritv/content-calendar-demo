#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""YANIT KUYRUGU — GERCEK POSTGRES'TE KOSTURULAN OLCUM.

Bu test sql/65 ve sql/66'yi BOS BIR VERITABANINA kuruyor, sahte
kayitlar yaziyor ve kuyruk islevlerini CAGIRIYOR. Olculen sey metin
degil DAVRANIS:

  · hangi kayit kuyruga giriyor (yayinlanmis, cevabi/dizisi olan,
    7 gunden yeni, threads)
  · ayni islev iki kez kosunca satir COGALMIYOR
  · gecikme 24 saat, 1-168 arasina sikistiriliyor
  · dizi SIRAYLA cikiyor: 2. parca, 1. parca yayinlanmadan ALINMIYOR
  · zincir baglaniyor: 2. parcanin hedefi 1. parcanin GONDERI KIMLIGI
  · ucuncu parca patlarsa ilk ikisi YENIDEN GITMIYOR
  · erteleme deneme hakkini geri veriyor, hata harciyor

⚠ NEDEN GEREKLI. Bu mantigin tamami SQL'de ve kaynaga bakan bir olcum
onu goremiyor: "for update skip locked yazili mi" sorusu ile "iki tur
ust uste binince ayni yanit iki kez gider mi" sorusu ayni soru degil.
16 Ekim 2026'da ayni gun iki kez, olcum dogru gorunup YANLIS SEYI
olcmustu (yedek adlarinin cakismasi, dosyada baska yerde duran
'poll' kelimesi). Burada kuyrugun kendisi kosuyor.

⚠ POSTGRES YOKSA ATLANIYOR, kirmizi vermiyor. Baglanti:
    SHOOTBOARD_TEST_PG="host=/tmp/sock user=postgres dbname=postgres"
Yoksa yerel soket denenmiyor ve test "atlandi" diyerek 0 donuyor --
bir gelistiricinin makinesinde Postgres olmamasi arizanin kendisi
degil.
"""
import io
import os
import re
import sys
import subprocess

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BAGLANTI = os.environ.get('SHOOTBOARD_TEST_PG', '').strip()

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


def psql_var():
    for y in ('/usr/lib/postgresql/16/bin/psql', 'psql'):
        try:
            subprocess.run([y, '--version'], capture_output=True, check=True)
            return y
        except Exception:
            continue
    return None


PSQL = psql_var()
if not BAGLANTI or not PSQL:
    print('ATLANDI: Postgres yok ya da SHOOTBOARD_TEST_PG tanimli degil.')
    print('  Kurmak icin: SHOOTBOARD_TEST_PG="host=... user=... dbname=..." python3 %s'
          % os.path.basename(__file__))
    sys.exit(0)


def kos(sql, dosya=None):
    """psql'i calistirir; (cikti, hata) doner. Hata bos ise basarili."""
    komut = [PSQL, BAGLANTI, '-v', 'ON_ERROR_STOP=1', '-At']
    if dosya:
        komut += ['-f', dosya]
        r = subprocess.run(komut, capture_output=True, text=True)
    else:
        r = subprocess.run(komut + ['-c', sql], capture_output=True, text=True)
    return r.stdout.strip(), ('' if r.returncode == 0 else (r.stderr.strip() or 'cikis %d' % r.returncode))


def tek(sql):
    cikti, hata = kos(sql)
    if hata:
        return '!HATA! ' + hata.splitlines()[-1][:160]
    return cikti


# ══════════════════════════════════════════════════════════════════
print('[kurulum]')
# Temiz baslangic: her kosumda sifirdan.
hazirlik = """
drop schema if exists public cascade;
create schema public;
drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key);
-- Gercek tabloda onlarca sutun var; buraya kuyrugun OKUDUGU alanlar
-- aliniyor. Fazlasi testi gercege yaklastirmiyor, yalnizca uzatirdi.
create table public.calendar_events (
  id            text primary key,
  user_id       uuid not null,
  type          text,
  platform      text,
  title         text default '',
  content       jsonb not null default '{}'::jsonb,
  publish_state text,
  external_id   text,
  published_at  timestamptz,
  deleted_at    timestamptz,
  post_date     date,
  post_time     time
);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role')   then create role service_role;   end if;
  if not exists (select 1 from pg_roles where rolname = 'anon')           then create role anon;           end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')  then create role authenticated;  end if;
end $$;
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
"""
cikti, hata = kos(hazirlik)
bak('bos veritabani hazirlandi', not hata, hata)

for dosya in ('sql/65-threads-anket-cevabi.sql', 'sql/66-threads-dizi.sql'):
    cikti, hata = kos(None, dosya=os.path.join(KOK, dosya))
    bak('★ ' + dosya + ' hatasiz kostu', not hata, hata)

# Dogrulama sorgularinin kendisi de calisti mi: sql/65 ve sql/66'nin
# sonunda duran "OK/YOK" sorgulari.
bak('★ tablo ve yedi islev yerinde',
    tek("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace"
        " where n.nspname='public' and p.proname like 'threads_yanit%'") == '7',
    tek("select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace"
        " where n.nspname='public' and p.proname like 'threads_yanit%'"))
bak('★ sira ve tur sutunlari eklendi',
    tek("select count(*) from information_schema.columns where table_name='threads_yanitlari'"
        " and column_name in ('tur','sira')") == '2')
bak('★ eski tek-satir kisiti kaldirildi',
    tek("select count(*) from pg_constraint where conname='threads_yanitlari_kayit_id_key'") == '0')

# ══════════════════════════════════════════════════════════════════
print('\n[kuyruga alma: kim giriyor, kim girmiyor]')
U = "'11111111-1111-1111-1111-111111111111'"
fikstur = """
insert into public.calendar_events (id, user_id, type, platform, publish_state, external_id, published_at, content) values
 ('A', %s, 'poll', 'threads', 'published', 'P1', now() - interval '1 hour',
   '{"caption":"soru","anketCevap":"CEVAP A"}'::jsonb),
 ('B', %s, 'text_post', 'threads', 'published', 'T1', now() - interval '1 hour',
   '{"caption":"1. parca","dizi":["2. parca","3. parca"]}'::jsonb),
 ('C', %s, 'poll', 'threads', 'pending', null, null,
   '{"caption":"soru","anketCevap":"CEVAP C"}'::jsonb),
 ('D', %s, 'poll', 'threads', 'published', 'P4', now() - interval '10 days',
   '{"caption":"soru","anketCevap":"CEVAP D"}'::jsonb),
 ('E', %s, 'poll', 'threads', 'published', 'P5', now() - interval '1 hour',
   '{"caption":"soru","anketCevap":"CEVAP E","anketCevapGecikme":1000}'::jsonb),
 ('F', %s, 'text_post', 'threads', 'published', 'T6', now() - interval '1 hour',
   '{"caption":"1","dizi":["p2","","p4","p5","p6","p7","p8","p9","p10","p11","p12","p13"]}'::jsonb),
 ('G', %s, 'poll', 'facebook', 'published', 'FB1', now() - interval '1 hour',
   '{"caption":"soru","anketCevap":"CEVAP G"}'::jsonb);
""" % (U, U, U, U, U, U, U)
cikti, hata = kos(fikstur)
bak('fikstur yazildi', not hata, hata)

eklenen = tek("select public.threads_yanit_kuyruga_al()")
bak('★ kuyruga alma bir sayi donduruyor', eklenen.isdigit(), eklenen)

def say(kayit, tur=None):
    k = "select count(*) from public.threads_yanitlari where kayit_id='%s'" % kayit
    if tur:
        k += " and tur='%s'" % tur
    return tek(k)

bak('★ A (yayinlanmis anket, cevabi var) -> 1 cevap satiri', say('A', 'cevap') == '1', say('A'))
bak('★ B (dizi: iki parca) -> 2 dizi satiri', say('B', 'dizi') == '2', say('B'))
# ⛔ YAYINLANMAMIS KAYIT: altina yanit yazilacak gonderi YOK.
bak('★ C (yayinlanmamis) -> hic satir yok', say('C') == '0', say('C'))
# ⛔ ESKI YAYIN: 7 gun penceresi. Bu dosya canliya uygulandigi an
# haftalar oncesinin cevaplari bir arada gitmesin.
bak('★ D (10 gun once yayinlanmis) -> hic satir yok', say('D') == '0', say('D'))
bak('★ E (gecikme 1000 saat) -> 1 cevap satiri', say('E', 'cevap') == '1', say('E'))
# ⛔ ON PARCA TAVANI ve bos parcalarin atilmasi.
bak('★ F (12 parca, biri bos) -> 10 dizi satiri (tavan, bos atildi)',
    say('F', 'dizi') == '10', say('F'))
bak('★ F\'de bos parca yok',
    tek("select count(*) from public.threads_yanitlari where kayit_id='F' and btrim(metin)=''") == '0')
# ⛔ SIRA BOSLUKSUZ OLMALI. Bos parca atlanirken numara atlanirsa
# (1,3,4...) sira sarti "onceki yayinlanmis olsun" diyor ve OLMAYAN
# bir parca beklenir: zincir SESSIZCE kilitlenir. Gercek kosum bunu
# yakaladi; ilk surumde numaralandirma dizinin kendi sirasini
# kullaniyordu.
bak('★ F\'nin sira numaralari boşluksuz 1..10',
    tek("select string_agg(sira::text, ',' order by sira) from public.threads_yanitlari"
        " where kayit_id='F'") == '1,2,3,4,5,6,7,8,9,10',
    tek("select string_agg(sira::text, ',' order by sira) from public.threads_yanitlari where kayit_id='F'"))
# ⛔ THREADS DISI PLATFORM: bu yol yalnizca Threads'te var.
bak('★ G (facebook) -> hic satir yok', say('G') == '0', say('G'))

# ⚠ IDEMPOTENS: islev her turda kosuyor. Satirlar cogalirsa cevap
# ONLARCA kez giderdi.
oncesi = tek("select count(*) from public.threads_yanitlari")
tekrar = tek("select public.threads_yanit_kuyruga_al()")
sonrasi = tek("select count(*) from public.threads_yanitlari")
bak('★ ikinci kosumda yeni satir YOK (idempotens)',
    tekrar == '0' and oncesi == sonrasi, 'eklenen=%s %s->%s' % (tekrar, oncesi, sonrasi))

print('\n[gecikme]')
bak('★ A: cevap yayindan 24 saat sonra',
    tek("select abs(extract(epoch from (gonderilecek_an - (now() - interval '1 hour' + interval '24 hours'))))::int < 120"
        " from public.threads_yanitlari where kayit_id='A'") == 't',
    tek("select gonderilecek_an from public.threads_yanitlari where kayit_id='A'"))
# 1000 saat istendi; tavan 168.
bak('★ E: 1000 saat 168\'e sikistirildi',
    tek("select abs(extract(epoch from (gonderilecek_an - (now() - interval '1 hour' + interval '168 hours'))))::int < 120"
        " from public.threads_yanitlari where kayit_id='E'") == 't',
    tek("select gonderilecek_an from public.threads_yanitlari where kayit_id='E'"))
# Dizi parcalari BEKLEMIYOR: zincirin arasi acilirsa okuyan devamini
# hic gormuyor.
bak('★ dizi parcalari yayin aninda (beklemiyor)',
    tek("select count(*) from public.threads_yanitlari where tur='dizi' and gonderilecek_an <= now()") ==
    tek("select count(*) from public.threads_yanitlari where tur='dizi'"))

# ══════════════════════════════════════════════════════════════════
print('\n[dizi: sira sarti ve zincir]')
# Yalnizca B'yi birakip oteki satirlari temizliyoruz: olcum net olsun.
kos("delete from public.threads_yanitlari where kayit_id <> 'B'")

alinan, hata = kos("select kayit_id||'/'||tur||'/'||sira||'/'||coalesce(ana_gonderi_id,'-')"
                   " from public.threads_yanit_al(10)")
bak('★ ilk turda YALNIZCA 1. parca aliniyor', alinan == 'B/dizi/1/T1', alinan or hata)
# ⛔ 2. PARCA, 1. PARCA YAYINLANMADAN ALINMIYOR. Eksik zincir, hic
# olmayan zincirden kotu; ustelik hedef gonderi kimligi de YOK.
bak('★ 2. parca beklemede (durum pending)',
    tek("select durum from public.threads_yanitlari where kayit_id='B' and sira=2") == 'pending')
bak('★ 2. parcanin hedefi henuz bos',
    tek("select coalesce(ana_gonderi_id,'-') from public.threads_yanitlari where kayit_id='B' and sira=2") == '-')

# 1. parca yayinlandi: kimligi R1.
kos("select public.threads_yanit_bitti((select id from public.threads_yanitlari"
    " where kayit_id='B' and sira=1), 'R1')")
alinan2, hata2 = kos("select kayit_id||'/'||sira||'/'||coalesce(ana_gonderi_id,'-')"
                     " from public.threads_yanit_al(10)")
# ⚠ ZINCIR: 2. parcanin hedefi 1. parcanin CIKAN gonderisi olmali,
# kaydin kendi gonderisi (T1) DEGIL. Aksi halde butun parcalar ana
# gonderinin altina duz bir yigin olarak duserdi, zincir olmazdi.
bak('★ 2. parca simdi aliniyor ve hedefi 1. parcanin gonderisi',
    alinan2 == 'B/2/R1', alinan2 or hata2)
bak('★ 1. parca bir daha ALINMIYOR (yeniden yayin yok)',
    'sira=1' not in alinan2 and alinan2.count('/') == 2)

print('\n[ucuncu parca patlarsa ilk ikisi yeniden gitmiyor]')
# B'nin 2. parcasini gecici hatayla dusurelim.
kos("select public.threads_yanit_hata((select id from public.threads_yanitlari"
    " where kayit_id='B' and sira=2), 'deneme hatasi', false)")
bak('★ hatali parca pending\'e dondu',
    tek("select durum from public.threads_yanitlari where kayit_id='B' and sira=2") == 'pending')
bak('★ cokus izi temizlendi',
    tek("select coalesce(cagri_ani::text,'-') from public.threads_yanitlari where kayit_id='B' and sira=2") == '-')
bak('★ yarim saat beklemeye alindi',
    tek("select tekrar_sonra > now() + interval '20 minutes' from public.threads_yanitlari"
        " where kayit_id='B' and sira=2") == 't')
bos, _ = kos("select count(*) from public.threads_yanit_al(10)")
bak('★ bekleme suresi gecmeden hicbir sey alinmiyor', bos == '0', bos)
bak('★ YAYINLANMIS 1. parca hala published (yeniden gitmedi)',
    tek("select durum from public.threads_yanitlari where kayit_id='B' and sira=1") == 'published')

print('\n[deneme hakki]')
# Erteleme hakki GERI VERIYOR: butce ya da jeton yuzunden bekleyen bir
# yanit uc turda hakkini tuketmemeli.
kos("update public.threads_yanitlari set tekrar_sonra = null where kayit_id='B' and sira=2")
onceki_deneme = tek("select deneme from public.threads_yanitlari where kayit_id='B' and sira=2")
kos("select count(*) from public.threads_yanit_al(10)")
alindi_deneme = tek("select deneme from public.threads_yanitlari where kayit_id='B' and sira=2")
kos("select public.threads_yanit_ertele((select id from public.threads_yanitlari"
    " where kayit_id='B' and sira=2), 0, 'butce doldu')")
ertelendi_deneme = tek("select deneme from public.threads_yanitlari where kayit_id='B' and sira=2")
bak('★ alma denemeyi artiriyor', int(alindi_deneme) == int(onceki_deneme) + 1,
    '%s -> %s' % (onceki_deneme, alindi_deneme))
bak('★ erteleme denemeyi geri veriyor', int(ertelendi_deneme) == int(onceki_deneme),
    '%s -> %s' % (alindi_deneme, ertelendi_deneme))

# Uc deneme sonra 'failed'.
kos("update public.threads_yanitlari set deneme = 3, tekrar_sonra = null where kayit_id='B' and sira=2")
kos("select public.threads_yanit_hata((select id from public.threads_yanitlari"
    " where kayit_id='B' and sira=2), 'ucuncu hata', false)")
bak('★ ucuncu denemede failed',
    tek("select durum from public.threads_yanitlari where kayit_id='B' and sira=2") == 'failed')
bak('★ failed satir bir daha ALINMIYOR',
    tek("select count(*) from public.threads_yanit_al(10)") == '0')

print('\n[kisitlar]')
# ⛔ AYNI (kayit, tur, sira) IKI KEZ YAZILAMAZ: cevabin ya da parcanin
# iki kez gitmesinin onundeki birinci katman.
ayni = """
insert into public.threads_yanitlari (user_id, kayit_id, tur, sira, ana_gonderi_id, metin, gonderilecek_an)
values ('11111111-1111-1111-1111-111111111111', 'B', 'dizi', 1, 'T1', 'kopya', now());
"""
_, hata_kopya = kos(ayni)
bak('★ ayni (kayit, tur, sira) ikinci kez yazilamiyor', bool(hata_kopya),
    (hata_kopya or 'yazildi!').splitlines()[-1][:80])
# Ama ayni kayit icin BASKA sira yazilabiliyor (eski kisit kalkti).
_, hata_yeni = kos(ayni.replace("'dizi', 1", "'dizi', 7"))
bak('★ ayni kayit icin baska sira yazilabiliyor', not hata_yeni,
    (hata_yeni or '').splitlines()[-1:][:1])
# Gecersiz tur reddediliyor.
_, hata_tur = kos(ayni.replace("'dizi', 1", "'baska', 1"))
bak('★ tanimsiz tur reddediliyor', bool(hata_tur))

print('\n%d gecti, %d kaldi' % (gecen, kalan))
sys.exit(1 if kalan else 0)
