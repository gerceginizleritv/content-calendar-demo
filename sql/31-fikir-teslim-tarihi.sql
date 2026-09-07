-- 31 — Fikirlere isteğe bağlı teslim tarihi ("yapılacaklar")
--
-- Neden: fikirler bölümü aynı zamanda bir yapılacaklar listesi gibi
-- çalışabilsin. Ama fikirlerin gücü DAĞINIK olabilmelerinde: her fikre
-- tarih sormak o gücü bozardı. Bu yüzden tarih tamamen isteğe bağlı —
-- boş kaldığında kart eskisi gibi sade bir fikir, tarih verildiğinde
-- aynı kart bir yapılacağa dönüşüyor ve "bitti" tiki kazanıyor.
--
-- İki sütun ekleniyor:
--   due_date : teslim tarihi (boş olabilir)
--   done     : bitti mi (tarihi olmayan kartta hiç kullanılmıyor)
--
-- Supabase panelinde: SQL Editor -> New query -> yapıştır -> Run.
-- Tekrar çalıştırılabilir; eski satırlar olduğu gibi kalıyor.

alter table public.ideas
  add column if not exists due_date date,
  add column if not exists done boolean not null default false;

-- Gecikmiş / bugünkü işleri hızlı bulmak için: tarihi olmayan satırlar
-- dizine hiç girmiyor, yani tarih kullanmayan hesap hiçbir bedel ödemiyor.
create index if not exists ideas_due_idx
  on public.ideas (user_id, due_date)
  where due_date is not null and deleted_at is null;

-- Kontrol
select id, left(text, 40) as fikir, due_date, done
  from public.ideas
 where due_date is not null
 order by due_date
 limit 10;
