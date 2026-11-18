-- =========================================================
-- Abanô — editar comentários, boas-vindas semanais no feed
-- e vitrine de ofertas (produtos de afiliado).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Não publica nada ao rodar.
-- =========================================================

-- ---------- 1. Editar o próprio comentário ----------
alter table public.comentarios add column if not exists editado_em timestamptz;
drop policy if exists "editar o proprio comentario" on public.comentarios;
create policy "editar o proprio comentario" on public.comentarios for update to authenticated
  using (autor = auth.uid() and not removido) with check (autor = auth.uid());
grant update (texto) on public.comentarios to authenticated;

create or replace function public._editar_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.texto is distinct from old.texto then
    new.texto := btrim(coalesce(new.texto, ''));
    if new.texto = '' then
      raise exception 'O comentário não pode ficar vazio.' using errcode = 'P0001';
    end if;
    if char_length(new.texto) > 2000 then
      raise exception 'O comentário pode ter até 2.000 letras.' using errcode = 'P0001';
    end if;
    if public.parece_venda_de_animal(new.texto) then
      raise exception 'Venda de animais não é permitida na Comunidade Abanô.' using errcode = 'P0001';
    end if;
    new.editado_em := now();
  end if;
  return new;
end $$;
drop trigger if exists comentarios_editar on public.comentarios;
create trigger comentarios_editar before update on public.comentarios
  for each row execute function public._editar_comentario();

-- ---------- 2. Boas-vindas semanais no feed (conta somosabano@gmail.com) ----------
-- Toda segunda-feira, às 10h (Brasília), o perfil do Abanô publica no feed
-- as boas-vindas para quem entrou na Comunidade nos últimos 7 dias,
-- e cada pessoa recebe um aviso no sininho.
create table if not exists public.config_comunidade (
  id                  int primary key default 1 check (id = 1),
  perfil_boas_vindas  uuid references public.perfis (id) on delete set null,
  ultima_boas_vindas  timestamptz
);
alter table public.config_comunidade enable row level security;   -- ninguém de fora lê

insert into public.config_comunidade (id, perfil_boas_vindas)
select 1, p.id from auth.users u join public.perfis p on p.id = u.id
 where lower(u.email) = 'somosabano@gmail.com'
on conflict (id) do update set perfil_boas_vindas = excluded.perfil_boas_vindas;

-- Novo tipo de aviso no sininho: "deu as boas-vindas a você"
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('curtida', 'comentario', 'resposta', 'curtida_comentario', 'seguidor', 'pedido_adocao', 'pedido_aceito', 'adocao_concluida', 'convite_clube', 'boas_vindas'));

-- p_testar = true só mostra o texto, sem publicar
create or replace function public.boas_vindas_semana(p_testar boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare v_autor uuid; v_desde timestamptz; v_total int; v_lista text; v_texto text; v_post uuid;
begin
  select perfil_boas_vindas, ultima_boas_vindas into v_autor, v_desde from public.config_comunidade where id = 1;
  if v_autor is null then
    return 'Falta criar o perfil da conta somosabano@gmail.com na Comunidade (entre com ela, aceite as regras e rode este arquivo de novo).';
  end if;
  v_desde := greatest(coalesce(v_desde, now() - interval '7 days'), now() - interval '8 days');

  create temporary table if not exists _novos (id uuid, usuario text, n int) on commit drop;
  truncate _novos;
  insert into _novos
  select p.id, p.usuario, row_number() over (order by coalesce(p.aceitou_em, p.criado_em))
    from public.perfis p
   where p.versao_politica is not null and not p.suspenso and p.id <> v_autor
     and coalesce(p.aceitou_em, p.criado_em) > v_desde;
  select count(*), string_agg('@' || usuario, ', ' order by n) filter (where n <= 30) into v_total, v_lista from _novos;
  if v_total = 0 then return 'Nenhum membro novo desde a última vez.'; end if;

  v_texto := '🐾 Boas-vindas a quem chegou na Comunidade Abanô esta semana!' || E'\n\n'
    || v_lista || case when v_total > 30 then ' e mais ' || (v_total - 30) || ' tutores' else '' end || '.' || E'\n\n'
    || 'Que bom ter vocês aqui! Para começar, apresente o seu pet aqui no feed com uma foto, entre no clube da sua raça ou do seu estado e puxe conversa com outros tutores. '
    || 'Ficou com alguma dúvida? É só perguntar. 💛';
  if p_testar then return v_texto; end if;

  perform set_config('abano.post_sistema', '1', true);   -- publicação automática: não entra no freio de spam
  insert into public.posts (autor, tipo, texto) values (v_autor, 'texto', v_texto) returning id into v_post;
  insert into public.notificacoes (para, de, tipo, post) select id, v_autor, 'boas_vindas', v_post from _novos;
  update public.config_comunidade set ultima_boas_vindas = now() where id = 1;
  return 'Boas-vindas publicadas para ' || v_total || ' membro(s).';
end $$;
revoke all on function public.boas_vindas_semana(boolean) from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule('abano-boas-vindas-semana') where exists (select 1 from cron.job where jobname = 'abano-boas-vindas-semana');
  perform cron.schedule('abano-boas-vindas-semana', '0 13 * * 1', 'select public.boas_vindas_semana()');   -- segunda, 10h de Brasília
exception when others then
  raise warning 'Abanô: não foi possível agendar as boas-vindas (ative pg_cron em Database > Extensions e rode de novo): %', sqlerrm;
end $$;

-- ---------- 3. Ofertas (produtos de afiliado) ----------
create table if not exists public.ofertas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null check (char_length(btrim(titulo)) between 3 and 160),
  loja            text not null check (loja in ('amazon', 'mercadolivre', 'shopee', 'magalu', 'petz', 'cobasi', 'petlove', 'outra')),
  link            text not null check (link ~* '^https://' and char_length(link) <= 1000),
  imagem_url      text check (imagem_url is null or (imagem_url ~* '^https://' and char_length(imagem_url) <= 1000)),
  preco           numeric(10,2) check (preco is null or preco >= 0),
  preco_antigo    numeric(10,2) check (preco_antigo is null or preco_antigo >= 0),
  cupom           text check (char_length(cupom) <= 40),
  pet             text not null default 'ambos' check (pet in ('cao', 'gato', 'ambos')),
  categoria       text not null default 'outros' check (categoria in ('racao', 'petiscos', 'brinquedos', 'higiene', 'saude', 'acessorios', 'camas', 'passeio', 'outros')),
  destaque        boolean not null default false,
  ativo           boolean not null default true,
  valido_ate      timestamptz,
  origem          text not null default 'manual' check (origem in ('manual', 'robo')),
  codigo_externo  text unique,   -- o robô usa para atualizar a mesma oferta sem duplicar
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists ofertas_vitrine on public.ofertas (destaque desc, atualizado_em desc) where ativo;

create or replace function public._ofertas_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists ofertas_atualizado on public.ofertas;
create trigger ofertas_atualizado before update on public.ofertas
  for each row execute function public._ofertas_atualizado();

alter table public.ofertas enable row level security;
drop policy if exists "ofertas visiveis" on public.ofertas;
create policy "ofertas visiveis" on public.ofertas for select to anon, authenticated
  using ((ativo and (valido_ate is null or valido_ate > now())) or public.eh_admin());
drop policy if exists "admins cuidam das ofertas" on public.ofertas;
create policy "admins cuidam das ofertas" on public.ofertas for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.ofertas from anon, authenticated;
grant select on public.ofertas to anon, authenticated;
grant insert, update, delete on public.ofertas to authenticated;

-- ---------- Conferência: tudo deve mostrar "ok" ----------
select 'editar comentário' as item, case when exists (select 1 from pg_trigger where tgname = 'comentarios_editar') then 'ok' else 'FALTA' end as situacao
union all select 'perfil das boas-vindas', case when exists (select 1 from public.config_comunidade where perfil_boas_vindas is not null) then 'ok' else 'FALTA: entre na Comunidade com somosabano@gmail.com, aceite as regras e rode de novo' end
union all select 'boas-vindas toda segunda', case when exists (select 1 from pg_extension where extname = 'pg_cron') then 'ok' else 'FALTA (ative pg_cron em Database > Extensions e rode de novo)' end
union all select 'ofertas', case when to_regclass('public.ofertas') is not null then 'ok' else 'FALTA' end;
