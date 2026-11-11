-- =========================================================
-- Abanô — Painel de cadastros (só administradores): números da
-- Comunidade, cadastros por dia, tutores por estado e os mais recentes.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql e moderacao.sql. Não altera nenhum dado.
-- =========================================================

create or replace function public.cadastros_resumo()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r jsonb;
begin
  if not public.eh_admin() then raise exception 'Só a administração.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'contas',        (select count(*) from auth.users),
    'tutores',       (select count(*) from public.perfis where versao_politica is not null),
    'incompletos',   (select count(*) from public.perfis where versao_politica is null),
    'hoje',          (select count(*) from public.perfis where (criado_em at time zone 'America/Sao_Paulo')::date = hoje),
    'semana',        (select count(*) from public.perfis where criado_em >= now() - interval '7 days'),
    'mes',           (select count(*) from public.perfis where criado_em >= now() - interval '30 days'),
    'pets',          (select count(*) from public.pets),
    'posts',         (select count(*) from public.posts),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'n', coalesce(c.n, 0)) order by d), '[]'::jsonb)
        from generate_series(hoje - 29, hoje, interval '1 day') d
        left join (select (criado_em at time zone 'America/Sao_Paulo')::date dia, count(*) n
                     from public.perfis group by 1) c on c.dia = d::date),
    'por_estado', (
      select coalesce(jsonb_agg(jsonb_build_object('estado', coalesce(estado, '?'), 'n', n) order by n desc), '[]'::jsonb)
        from (select estado, count(*) n from public.perfis where versao_politica is not null group by estado) e),
    'por_especie', (
      select coalesce(jsonb_agg(jsonb_build_object('especie', especie, 'n', n) order by n desc), '[]'::jsonb)
        from (select especie, count(*) n from public.pets group by especie) s),
    'recentes', (
      select coalesce(jsonb_agg(x order by x->>'criado_em' desc), '[]'::jsonb) from (
        select jsonb_build_object(
                 'nome', p.nome, 'usuario', p.usuario, 'cidade', p.cidade, 'estado', p.estado,
                 'criado_em', p.criado_em, 'completo', p.versao_politica is not null,
                 'email', u.email, 'entrada', coalesce(u.raw_app_meta_data->>'provider', 'email'),
                 'ultimo_acesso', u.last_sign_in_at,
                 'pets', (select count(*) from public.pets t where t.dono = p.id)) x
          from public.perfis p join auth.users u on u.id = p.id
         order by p.criado_em desc limit 100) y)
  ) into r;
  return r;
end $$;
revoke all on function public.cadastros_resumo() from public, anon;
grant execute on function public.cadastros_resumo() to authenticated;

notify pgrst, 'reload schema';
