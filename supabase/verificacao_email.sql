-- =========================================================
-- Abanô — Cadastro sem confirmar o e-mail; confirmação só para
-- adotar ou anunciar um animal para adoção
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e "Run".
-- Pode rodar de novo. Rode ANTES de desligar "Confirm email" no
-- painel do Supabase (Authentication → Sign In / Providers → Email).
-- Precisa ter rodado antes: contas.sql, moderacao.sql, adocao.sql
-- e destaques_adocao_pessoas.sql.
-- =========================================================

-- ---------- 1. Marca de e-mail confirmado (nossa, não a do Supabase) ----------
-- Com "Confirm email" desligado, o Supabase marca todo e-mail como confirmado
-- na hora do cadastro. Por isso a confirmação de verdade passa a ficar aqui.
alter table public.perfis add column if not exists email_verificado_em timestamptz;

-- Quem já tinha confirmado o e-mail (antes desta mudança) continua confirmado.
-- Só conta a confirmação feita alguns segundos depois do cadastro (alguém abriu o link):
-- se este arquivo rodar de novo, as contas criadas já com o "Confirm email" desligado
-- (confirmadas no mesmo instante do cadastro) ficam de fora.
update public.perfis p set email_verificado_em = u.email_confirmed_at
  from auth.users u
 where u.id = p.id and p.email_verificado_em is null and u.email_confirmed_at is not null
   and u.email_confirmed_at > u.created_at + interval '5 seconds';
-- Contas do Google: o próprio Google já confirmou o e-mail
update public.perfis p set email_verificado_em = now()
  from auth.users u
 where u.id = p.id and p.email_verificado_em is null
   and coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google';

create or replace function public.email_verificado(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = p_id and email_verificado_em is not null)
      or exists (select 1 from auth.users where id = p_id and coalesce(raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google');
$$;
revoke all on function public.email_verificado(uuid) from public;
grant execute on function public.email_verificado(uuid) to authenticated;

-- A página chama esta função depois que a pessoa digita o código (ou abre o link)
-- que chegou no e-mail. Ela só marca se a sessão atual veio mesmo desse código:
-- isso fica no token assinado pelo Supabase (campo "amr"), que ninguém consegue forjar.
create or replace function public.marcar_email_verificado() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
              where e ->> 'method' in ('otp', 'magiclink', 'recovery', 'invite', 'email_change')) then
    update public.perfis set email_verificado_em = coalesce(email_verificado_em, now()) where id = v_uid;
  end if;
  return public.email_verificado(v_uid);
end $$;
revoke all on function public.marcar_email_verificado() from public, anon;
grant execute on function public.marcar_email_verificado() to authenticated;

-- ---------- 2. "Minha conta" passa a dizer se o e-mail está confirmado ----------
create or replace function public.minha_conta() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); u auth.users; p public.perfis; v_novidades boolean;
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into u from auth.users where id = v_uid;
  if u.id is null then raise exception 'Conta não encontrada.' using errcode = '42501'; end if;
  perform public._criar_perfil(u.id, u.email, u.raw_user_meta_data);
  select * into p from public.perfis where id = v_uid;
  select l.inscrito into v_novidades from public.lista_espera l where lower(l.email) = lower(u.email);
  return jsonb_build_object(
    'id', p.id, 'usuario', p.usuario, 'nome', p.nome, 'bio', p.bio, 'cidade', p.cidade, 'estado', p.estado,
    'foto_url', p.foto_url, 'aceitou', p.versao_politica is not null, 'email', u.email,
    'provedor', coalesce(u.raw_app_meta_data ->> 'provider', 'email'), 'novidades', coalesce(v_novidades, false),
    'admin', public.eh_admin(), 'suspenso', p.suspenso, 'instagram', p.instagram,
    'telefone', u.phone, 'telefone_confirmado', u.phone_confirmed_at is not null, 'criado_em', p.criado_em,
    'email_verificado', public.email_verificado(v_uid));
end $$;
revoke all on function public.minha_conta() from public, anon;
grant execute on function public.minha_conta() to authenticated;

-- ---------- 3. Adotar e anunciar exigem o e-mail confirmado ----------
drop policy if exists "pedir adocao" on public.pedidos_adocao;
create policy "pedir adocao" on public.pedidos_adocao for insert to authenticated
  with check (adotante = auth.uid() and public.perfil_ativo(auth.uid()) and public.email_verificado(auth.uid()));

drop policy if exists "pedir verificacao" on public.organizacoes;
create policy "pedir verificacao" on public.organizacoes for insert to authenticated
  with check (dono = auth.uid() and public.perfil_ativo(auth.uid()) and public.email_verificado(auth.uid()));

-- ---------- 4. Administrador: só com o e-mail confirmado de verdade ----------
-- Sem isso, alguém poderia criar uma conta com o e-mail de um administrador
-- que ainda não tem conta e entrar direto, sem provar que o e-mail é dele.
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join public.admins a on a.email = lower(u.email)
     where u.id = auth.uid() and public.email_verificado(u.id)
  );
$$;
revoke all on function public.eh_admin() from public;
grant execute on function public.eh_admin() to anon, authenticated;

-- ---------- 5. Conferência ----------
select
  (select count(*) from public.perfis where email_verificado_em is not null) as contas_com_email_confirmado,
  (select count(*) from public.perfis where email_verificado_em is null)     as contas_sem_confirmar,
  (select count(*) from public.admins a join auth.users u on lower(u.email) = a.email
     where public.email_verificado(u.id))                                    as admins_ok;
