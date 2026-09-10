-- 23 — Bir script birden çok projeye ve fikre bağlanabilsin
--
-- Neden: "Bu fikirlerden script yaz" akışında kullanıcı birden fazla
-- fikri ve birden fazla projeyi tek bir scriptte birleştirmek isteyebiliyor.
-- Bugün scripts.project_id TEK bir projeye bakıyor.
--
-- Yaklaşım: project_id DURUYOR ve listenin ilki olarak tutuluyor — mevcut
-- yabancı anahtar, silme davranışı ve eski sürümler bozulmasın. Yeni
-- project_ids dizisi tam listeyi taşıyor. idea_ids ise scriptin hangi
-- fikirlerden doğduğunu saklıyor; pencere yeniden açıldığında aynı
-- seçimle geliyor.
--
-- Nasıl kullanılır: SQL Editor'de çalıştır. Tekrar çalıştırılabilir.

begin;

alter table public.scripts
  add column if not exists project_ids text[] not null default '{}',
  add column if not exists idea_ids    text[] not null default '{}';

-- Eski kayitlar: tek projeli olanlarin listesi tek elemanla dolduruluyor.
update public.scripts
   set project_ids = array[project_id]
 where project_id is not null
   and cardinality(project_ids) = 0;

commit;

-- Kontrol
select id, title, project_id, project_ids, idea_ids
  from public.scripts
 order by updated_at desc
 limit 10;
