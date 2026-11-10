-- =========================================================
-- Abanô — novas espécies de pet: ave, pequeno mamífero, réptil e peixe
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Não apaga nem muda nenhum pet.
-- =========================================================

-- Tira a regra antiga (só cachorro, gato ou outro), seja qual for o nome dela
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
     where con.conrelid = 'public.pets'::regclass and con.contype = 'c' and att.attname = 'especie'
  loop
    execute format('alter table public.pets drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.pets add constraint pets_especie_check
  check (especie in ('cachorro', 'gato', 'ave', 'pequeno_mamifero', 'reptil', 'peixe', 'outro'));

-- Conferência: deve mostrar "ok"
select case when exists (
  select 1 from pg_constraint where conname = 'pets_especie_check' and pg_get_constraintdef(oid) like '%pequeno_mamifero%'
) then 'ok' else 'FALTA' end as especies_novas;
