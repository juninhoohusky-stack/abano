-- =========================================================
-- Abanô — cadastro na lista de espera com conta Google
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- lista_espera.sql, emails.sql e lgpd.sql.
-- =========================================================

-- ---------- 1. De onde veio o cadastro ----------
alter table public.lista_espera add column if not exists origem text not null default 'formulario';
do $$ begin
  alter table public.lista_espera add constraint lista_espera_origem check (origem in ('formulario', 'google'));
exception when duplicate_object then null; end $$;

-- ---------- 2. Quem pode cadastrar o quê ----------
-- Visitantes e contas Google só podem preencher os campos do formulário.
-- Data do consentimento, token, inscrição etc. são sempre do banco.
revoke insert on public.lista_espera from anon, authenticated;
grant insert (nome, email, nome_pet, cidade, pet, interesse, versao_politica, maior_de_idade, origem)
  on public.lista_espera to anon, authenticated;

-- Visitante comum: cadastro pelo formulário
drop policy if exists "visitantes podem se cadastrar" on public.lista_espera;
create policy "visitantes podem se cadastrar"
  on public.lista_espera for insert to anon
  with check (origem = 'formulario');

-- Conta Google: só pode cadastrar o PRÓPRIO e-mail (confirmado pelo Google)
drop policy if exists "contas google podem se cadastrar" on public.lista_espera;
create policy "contas google podem se cadastrar"
  on public.lista_espera for insert to authenticated
  with check (origem = 'google' and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------- 3. Excluir dados também apaga a conta de acesso ----------
create or replace function public.excluir_meus_dados(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  delete from public.lista_espera where token = p_token returning email into v_email;
  if v_email is null then return null; end if;
  delete from auth.users where lower(email) = lower(v_email);
  return true;
end $$;
revoke all on function public.excluir_meus_dados(uuid) from public;
grant execute on function public.excluir_meus_dados(uuid) to anon;

-- ---------- 4. Limpeza diária ----------
-- a) quem cancelou há mais de 30 dias (cadastro + conta de acesso)
-- b) contas Google que entraram mas não concluíram o cadastro em 1 dia
-- Atenção: este projeto usa o login só para a lista de espera. Se um dia
-- o Abanô tiver contas de usuário de verdade, revise a regra (b).
create or replace function public.limpar_descadastrados() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with apagados as (
    delete from public.lista_espera
     where inscrito = false and descadastrado_em < now() - interval '30 days'
    returning email
  ), contas as (
    delete from auth.users au using apagados a where lower(au.email) = lower(a.email) returning 1
  )
  select count(*) into n from apagados;

  delete from auth.users au
   where au.created_at < now() - interval '1 day'
     and not exists (select 1 from public.lista_espera l where lower(l.email) = lower(au.email));

  return n;
end $$;
revoke all on function public.limpar_descadastrados() from public, anon, authenticated;

notify pgrst, 'reload schema';

-- Conferência: deve listar 3 itens com "ok"
select 'coluna origem' as item, case when exists (select 1 from information_schema.columns where table_name = 'lista_espera' and column_name = 'origem') then 'ok' else 'FALTA' end as status
union all select 'regra das contas Google', case when exists (select 1 from pg_policies where tablename = 'lista_espera' and policyname = 'contas google podem se cadastrar') then 'ok' else 'FALTA' end
union all select 'limpeza de contas', case when exists (select 1 from pg_proc where proname = 'limpar_descadastrados' and prosrc like '%auth.users%') then 'ok' else 'FALTA' end;
