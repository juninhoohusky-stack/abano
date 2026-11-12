-- =========================================================
-- Abanô — Clubes: foto do clube e publicação fixada (regras),
-- definidas só pela administração.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- comunidade.sql e moderacao.sql. Não apaga nada.
-- =========================================================

alter table public.clubes add column if not exists foto_url text;
alter table public.clubes add column if not exists post_fixado uuid references public.posts (id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clubes_foto_check') then
    alter table public.clubes add constraint clubes_foto_check
      check (foto_url is null or foto_url like 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/%');
  end if;
end $$;

-- Trocar a foto do clube (ou tirar, com p_foto vazio)
create or replace function public.foto_do_clube(p_clube text, p_foto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração pode trocar a foto do clube.' using errcode = '42501'; end if;
  update public.clubes set foto_url = nullif(btrim(coalesce(p_foto, '')), '') where id = p_clube;
  if not found then raise exception 'Clube não encontrado.' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.foto_do_clube(text, text) from public, anon;
grant execute on function public.foto_do_clube(text, text) to authenticated;

-- Fixar uma publicação do clube no topo (regras); p_post vazio desafixa
create or replace function public.fixar_no_clube(p_clube text, p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração pode fixar publicações.' using errcode = '42501'; end if;
  if p_post is not null and not exists (select 1 from public.posts where id = p_post and clube = p_clube and not removido) then
    raise exception 'Essa publicação não é deste clube.' using errcode = 'P0001';
  end if;
  update public.clubes set post_fixado = p_post where id = p_clube;
  if not found then raise exception 'Clube não encontrado.' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.fixar_no_clube(text, uuid) from public, anon;
grant execute on function public.fixar_no_clube(text, uuid) to authenticated;

notify pgrst, 'reload schema';
