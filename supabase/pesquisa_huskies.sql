-- =========================================================
-- Abanô — Pesquisa nacional "Onde estão os Huskies do Brasil?"
-- Tabela própria (não se mistura com contas nem com a lista).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e "Run".
-- Pode rodar de novo.
-- =========================================================

-- ---------- 1. Administradores do Abanô ----------
-- Quem está aqui (por e-mail confirmado pelo login Google) vê os painéis.
create table if not exists public.admins (
  email      text primary key check (email = lower(email)),
  criado_em  timestamptz not null default now()
);
alter table public.admins enable row level security;     -- ninguém de fora lê

-- ✏️ E-mail do administrador (troque ou adicione outros)
insert into public.admins (email) values ('juninhoohusky@gmail.com') on conflict do nothing;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and coalesce((auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, true)
  );
$$;
revoke all on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

-- ---------- 2. Respostas ----------
create table if not exists public.pesquisa_huskies (
  id                      bigint generated always as identity primary key,
  criado_em               timestamptz not null default now(),
  situacao                text not null check (situacao in ('tenho', 'quero_ter', 'admiro')),
  estado                  text not null check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  cidade                  text not null check (char_length(btrim(cidade)) between 2 and 80),
  qtd_huskies             int  check (qtd_huskies between 0 and 50),
  idades                  text[] check (idades <@ array['filhote','1a3','4a7','8mais']::text[]),
  outros_animais          text[] check (outros_animais <@ array['nenhum','caes','gatos','aves','outros']::text[]),
  outros_animais_texto    text check (char_length(outros_animais_texto) <= 200),
  encontros_regiao        text not null check (encontros_regiao in ('sim', 'talvez', 'nao')),
  interesse_experience    text not null check (interesse_experience in ('sim', 'talvez', 'nao')),
  viajaria                text not null check (viajaria in ('sim', 'talvez', 'nao', 'moro_rj')),
  acompanhantes           int  not null check (acompanhantes between 0 and 20),
  expectativas            text[] check (expectativas <@ array['encontro','veterinarios','atividades','feira','concursos','descanso']::text[]),
  expectativa_texto       text check (char_length(expectativa_texto) <= 600),
  nome                    text check (char_length(nome) <= 120),
  instagram               text check (char_length(instagram) <= 60),
  email                   text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  consente_estudo         boolean not null check (consente_estudo),
  consente_novidades      boolean not null default false,
  versao_aviso            text not null,
  -- quem pede novidades precisa deixar um e-mail
  constraint pesquisa_novidades_com_email check (not consente_novidades or email is not null),
  -- quem tem Husky informa quantos
  constraint pesquisa_qtd_quando_tem check (situacao <> 'tenho' or qtd_huskies >= 1)
);
alter table public.pesquisa_huskies enable row level security;

-- Visitantes só podem RESPONDER (nunca ler as respostas de ninguém)
drop policy if exists "visitantes respondem a pesquisa" on public.pesquisa_huskies;
create policy "visitantes respondem a pesquisa"
  on public.pesquisa_huskies for insert to anon, authenticated
  with check (consente_estudo);
revoke all on public.pesquisa_huskies from anon, authenticated;
grant insert (situacao, estado, cidade, qtd_huskies, idades, outros_animais, outros_animais_texto,
              encontros_regiao, interesse_experience, viajaria, acompanhantes, expectativas,
              expectativa_texto, nome, instagram, email, consente_estudo, consente_novidades, versao_aviso)
  on public.pesquisa_huskies to anon, authenticated;

-- Um e-mail responde uma vez (sem e-mail, a resposta é anônima)
create unique index if not exists pesquisa_huskies_email_unico
  on public.pesquisa_huskies (lower(email)) where email is not null;

-- Freio contra robôs: no máximo 30 respostas por minuto no site inteiro
create or replace function public._pesquisa_freio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.pesquisa_huskies where criado_em > now() - interval '1 minute') >= 30 then
    raise exception 'Muitas respostas ao mesmo tempo. Tente de novo em instantes.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pesquisa_huskies_freio on public.pesquisa_huskies;
create trigger pesquisa_huskies_freio before insert on public.pesquisa_huskies
  for each row execute function public._pesquisa_freio();

-- ---------- 3. Painel (só administradores) ----------
create or replace function public.pesquisa_resumo() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'total',            (select count(*) from pesquisa_huskies),
    'total_huskies',    (select coalesce(sum(qtd_huskies), 0) from pesquisa_huskies),
    'por_situacao',     (select coalesce(jsonb_object_agg(situacao, n), '{}') from (select situacao, count(*) n from pesquisa_huskies group by 1) s),
    'por_estado',       (select coalesce(jsonb_agg(jsonb_build_object('estado', estado, 'respostas', n, 'huskies', h) order by n desc), '[]')
                           from (select estado, count(*) n, coalesce(sum(qtd_huskies), 0) h from pesquisa_huskies group by 1) s),
    'por_cidade',       (select coalesce(jsonb_agg(jsonb_build_object('cidade', cidade, 'estado', estado, 'respostas', n, 'huskies', h) order by n desc), '[]')
                           from (select initcap(lower(btrim(cidade))) cidade, estado, count(*) n, coalesce(sum(qtd_huskies), 0) h
                                   from pesquisa_huskies group by 1, 2 order by 3 desc limit 50) s),
    'encontros_regiao', (select coalesce(jsonb_object_agg(encontros_regiao, n), '{}') from (select encontros_regiao, count(*) n from pesquisa_huskies group by 1) s),
    'experience',       (select coalesce(jsonb_object_agg(interesse_experience, n), '{}') from (select interesse_experience, count(*) n from pesquisa_huskies group by 1) s),
    'viajaria',         (select coalesce(jsonb_object_agg(viajaria, n), '{}') from (select viajaria, count(*) n from pesquisa_huskies group by 1) s),
    'acompanhantes_interessados', (select coalesce(sum(acompanhantes), 0) from pesquisa_huskies where interesse_experience in ('sim', 'talvez')),
    'pessoas_estimadas_experience', (select coalesce(sum(acompanhantes + 1), 0) from pesquisa_huskies where interesse_experience = 'sim'),
    'expectativas',     (select coalesce(jsonb_object_agg(e, n), '{}') from (select unnest(expectativas) e, count(*) n from pesquisa_huskies group by 1) s),
    'aceitam_novidades',(select count(*) from pesquisa_huskies where consente_novidades)
  ) into r;
  return r;
end $$;
revoke all on function public.pesquisa_resumo() from public, anon;
grant execute on function public.pesquisa_resumo() to authenticated;

-- Exportação para CSV. com_contatos = false: sem nome, e-mail e Instagram.
-- com_contatos = true: só quem autorizou receber novidades.
create or replace function public.pesquisa_exportar(com_contatos boolean default false)
returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  if com_contatos then
    return query select jsonb_build_object('data', to_char(criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
      'nome', nome, 'email', email, 'instagram', instagram, 'estado', estado, 'cidade', cidade, 'situacao', situacao)
      from pesquisa_huskies where consente_novidades order by id;
  else
    return query select jsonb_build_object('id', id, 'data', to_char(criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
      'situacao', situacao, 'estado', estado, 'cidade', initcap(lower(btrim(cidade))), 'qtd_huskies', qtd_huskies,
      'idades', array_to_string(idades, '|'), 'outros_animais', array_to_string(outros_animais, '|'),
      'encontros_regiao', encontros_regiao, 'interesse_experience', interesse_experience, 'viajaria', viajaria,
      'acompanhantes', acompanhantes, 'expectativas', array_to_string(expectativas, '|'))
      from pesquisa_huskies order by id;
  end if;
end $$;
revoke all on function public.pesquisa_exportar(boolean) from public, anon;
grant execute on function public.pesquisa_exportar(boolean) to authenticated;

-- Retenção: contatos de quem não pediu novidades saem em 12 meses;
-- respostas inteiras são apagadas 3 anos depois do envio.
create or replace function public.limpar_pesquisa_huskies() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.pesquisa_huskies set nome = null, email = null, instagram = null
   where not consente_novidades and criado_em < now() - interval '12 months'
     and (nome is not null or email is not null or instagram is not null);
  delete from public.pesquisa_huskies where criado_em < now() - interval '3 years';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.limpar_pesquisa_huskies() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-pesquisa';
  perform cron.schedule('abano-limpar-pesquisa', '30 6 * * *', 'select public.limpar_pesquisa_huskies()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza da pesquisa (ative pg_cron e rode de novo): %', sqlerrm;
end $$;

notify pgrst, 'reload schema';

-- Conferência: deve listar 3 itens com "ok"
select 'tabela da pesquisa' as item, case when to_regclass('public.pesquisa_huskies') is not null then 'ok' else 'FALTA' end as status
union all select 'administradores', case when exists (select 1 from public.admins) then 'ok' else 'FALTA' end
union all select 'painel', case when exists (select 1 from pg_proc where proname = 'pesquisa_resumo') then 'ok' else 'FALTA' end;
