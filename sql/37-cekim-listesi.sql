-- 37 — Çekim listesi (projenin kontrol listesi)
--
-- Neden: kullanıcılar çekim öncesi kontrol listesini telefon notlarında
-- tutuyor — "powerbank, ışık, yaka mikrofonu, görevliden izin al, dört
-- taşın da yakın planı". O liste uygulamanın dışında kalınca iki şey
-- oluyor: mekan kartındaki izin ve dikkat notları ikinci kez elle
-- yazılıyor, ve çekimden dönünce neyin atlandığı görünmüyor.
--
-- Liste projeye ait ve JSON olarak tek sütunda duruyor:
--   [{ id, metin, grup, not, bitti, kaynak }]
-- kaynak: 'elle' | 'kutuphane' | 'mekan'
--
-- Kişinin kendi malzeme kütüphanesi BU TABLODA DEĞİL: o hesaba bağlı ve
-- user_prefs.prefs.ihtiyaclar içinde duruyor — yeni tablo gerekmiyor.
--
-- Uygulama bu betik çalıştırılmadan da çalışır: sütun yoksa liste
-- tarayıcıda kalır, kaybolmaz; betik çalışınca sonraki kayıtta buluta
-- gider. ÖNCE sql/24 çalıştırılmış olmalı. Tekrar çalıştırılabilir.
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.

alter table public.projects
  add column if not exists checklist jsonb not null default '[]'::jsonb;

-- Bozuk bir istemci listenin yerine nesne/metin yazmasın: sütun dizi
-- olmalı. RLS zaten satırı sahibine kilitliyor, bu yalnızca şeklin
-- kontrolü.
alter table public.projects
  drop constraint if exists projects_checklist_dizi;
alter table public.projects
  add constraint projects_checklist_dizi
  check (jsonb_typeof(checklist) = 'array');
