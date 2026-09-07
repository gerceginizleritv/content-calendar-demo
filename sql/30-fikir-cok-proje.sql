-- 30 — Bir fikir birden çok projeye bağlanabilsin
--
-- Neden: aynı fikir iki projede birden işe yarayabiliyor ("Bizans su
-- yolları" hem sarnıç bölümüne hem su kemeri bölümüne gidiyor). Bugün
-- fikrin tek bir project_id'si var; ikinci projeye bağlamak için fikri
-- kopyalamak gerekiyordu ve kopyalar birbirinden bağımsız yaşıyordu.
--
-- Yaklaşım scripts tablosundakiyle (sql/23) aynı: project_id DURUYOR ve
-- listenin ilki olarak tutuluyor — mevcut yabancı anahtar, silme
-- davranışı ve eski sürümler bozulmasın. Yeni project_ids dizisi tam
-- listeyi taşıyor.
--
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.
-- Tekrar çalıştırılabilir.

alter table public.ideas
  add column if not exists project_ids text[] not null default '{}';

-- Eski kayıtlar: tek projeli olanların listesi tek elemanla dolduruluyor.
update public.ideas
   set project_ids = array[project_id]
 where project_id is not null
   and cardinality(project_ids) = 0;

-- Kontrol
select id, left(text, 40) as fikir, project_id, project_ids
  from public.ideas
 order by updated_at desc
 limit 10;
