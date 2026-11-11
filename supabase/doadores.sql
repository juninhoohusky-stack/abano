-- =========================================================
-- Abanô — Doadores de sangue: o tutor marca no perfil do pet
-- (cão ou gato) se ele já é doador ou quer ser doador.
-- O pet aparece com selo no perfil da Comunidade e na página
-- "Doador de sangue", com a cidade do tutor e o link do perfil.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql, moderacao.sql e pets_especies.sql.
-- Não cria nenhum doador de exemplo.
-- =========================================================

-- ---------- 1. Campos novos no pet ----------
alter table public.pets add column if not exists doador_sangue text;
alter table public.pets add column if not exists tipo_sanguineo text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_doador_sangue_check') then
    alter table public.pets add constraint pets_doador_sangue_check check (doador_sangue in ('doador', 'quer_ser'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pets_tipo_sanguineo_check') then
    alter table public.pets add constraint pets_tipo_sanguineo_check check (tipo_sanguineo in ('dea1_positivo', 'dea1_negativo', 'a', 'b', 'ab'));
  end if;
end $$;
create index if not exists pets_doadores on public.pets (doador_sangue) where doador_sangue is not null;

grant insert (doador_sangue, tipo_sanguineo) on public.pets to authenticated;
grant update (doador_sangue, tipo_sanguineo) on public.pets to authenticated;

-- Só cães e gatos doam; o tipo sanguíneo precisa ser da espécie certa
create or replace function public._validar_doador() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.especie not in ('cachorro', 'gato') or new.doador_sangue is null then
    new.doador_sangue := null;
    new.tipo_sanguineo := null;
  elsif new.especie = 'cachorro' and new.tipo_sanguineo not in ('dea1_positivo', 'dea1_negativo') then
    new.tipo_sanguineo := null;
  elsif new.especie = 'gato' and new.tipo_sanguineo not in ('a', 'b', 'ab') then
    new.tipo_sanguineo := null;
  end if;
  return new;
end $$;
drop trigger if exists pets_validar_doador on public.pets;
create trigger pets_validar_doador before insert or update on public.pets
  for each row execute function public._validar_doador();

-- ---------- 2. Lista pública de doadores ----------
-- Só pets de perfis públicos e ativos. Mostra a cidade e o estado que o tutor já
-- deixou públicos no perfil, nunca e-mail ou telefone: o contato é pelo perfil.
create or replace function public.doadores_sangue(p_estado text default null, p_especie text default null)
returns table (id uuid, nome text, especie text, raca text, idade text, sexo text, foto_url text,
               doador_sangue text, tipo_sanguineo text, tutor_usuario text, tutor_nome text, cidade text, estado text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.especie, p.raca, p.idade, p.sexo, p.foto_url,
         p.doador_sangue, p.tipo_sanguineo, pf.usuario, pf.nome, pf.cidade, pf.estado
    from public.pets p
    join public.perfis pf on pf.id = p.dono
   where p.doador_sangue is not null
     and public.perfil_ativo(p.dono)
     and (p_estado is null or pf.estado = p_estado)
     and (p_especie is null or p.especie = p_especie)
   order by (p.doador_sangue = 'doador') desc, p.criado_em desc
   limit 200;
$$;
revoke all on function public.doadores_sangue(text, text) from public;
grant execute on function public.doadores_sangue(text, text) to anon, authenticated;

-- Quantos doadores há (no país e por estado), para a página mostrar
create or replace function public.doadores_contagem()
returns table (estado text, doadores int, querem int)
language sql stable security definer set search_path = public as $$
  select pf.estado,
         count(*) filter (where p.doador_sangue = 'doador')::int,
         count(*) filter (where p.doador_sangue = 'quer_ser')::int
    from public.pets p
    join public.perfis pf on pf.id = p.dono
   where p.doador_sangue is not null and public.perfil_ativo(p.dono)
   group by pf.estado;
$$;
revoke all on function public.doadores_contagem() from public;
grant execute on function public.doadores_contagem() to anon, authenticated;

notify pgrst, 'reload schema';
