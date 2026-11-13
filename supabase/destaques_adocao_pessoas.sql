-- =========================================================
-- Abanô — Opções do chat (silenciar e marcar como não lida),
-- membros destaque com Instagram, clube Samoieda e adoção por
-- pessoas comuns (telefone confirmado + anúncio aprovado antes
-- de aparecer no site).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- clubes_chat_adocao.sql (e os anteriores). Não cria dados de exemplo.
-- =========================================================

-- ---------- 1. Clube Samoieda ----------
insert into public.clubes (id, nome, descricao, tipo, ordem) values
  ('samoieda', 'Samoieda', 'Tutores de Samoieda: pelagem, escovação, passeios nos dias quentes e muitas fotos para compartilhar.', 'raca', 15)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, tipo = excluded.tipo, ordem = excluded.ordem;

-- ---------- 2. Chat: silenciar e marcar como não lida ----------
create table if not exists public.conversas_silenciadas (
  conversa   uuid not null references public.conversas (id) on delete cascade,
  usuario    uuid not null references public.perfis (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (conversa, usuario)
);
alter table public.conversas_silenciadas enable row level security;
drop policy if exists "minhas silenciadas" on public.conversas_silenciadas;
create policy "minhas silenciadas" on public.conversas_silenciadas for select to authenticated using (usuario = auth.uid());
revoke all on public.conversas_silenciadas from anon, authenticated;
grant select on public.conversas_silenciadas to authenticated;

create or replace function public.silenciar_conversa(p_conversa uuid, p_silenciar boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversas where id = p_conversa and auth.uid() in (pessoa_a, pessoa_b)) then
    raise exception 'Conversa não encontrada.' using errcode = 'P0001';
  end if;
  if p_silenciar then
    insert into public.conversas_silenciadas (conversa, usuario) values (p_conversa, auth.uid()) on conflict do nothing;
  else
    delete from public.conversas_silenciadas where conversa = p_conversa and usuario = auth.uid();
  end if;
  return p_silenciar;
end $$;
revoke all on function public.silenciar_conversa(uuid, boolean) from public, anon;
grant execute on function public.silenciar_conversa(uuid, boolean) to authenticated;

-- Marca como não lida a última mensagem recebida
create or replace function public.marcar_conversa_nao_lida(p_conversa uuid) returns void
language sql security definer set search_path = public as $$
  update public.mensagens set lida = false
   where id = (select max(m.id) from public.mensagens m join public.conversas c on c.id = m.conversa
                where m.conversa = p_conversa and m.autor <> auth.uid() and auth.uid() in (c.pessoa_a, c.pessoa_b));
$$;
revoke all on function public.marcar_conversa_nao_lida(uuid) from public, anon;
grant execute on function public.marcar_conversa_nao_lida(uuid) to authenticated;

-- Conversas silenciadas não contam no sininho
create or replace function public.mensagens_nao_lidas() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.mensagens m join public.conversas c on c.id = m.conversa
   where auth.uid() in (c.pessoa_a, c.pessoa_b) and m.autor <> auth.uid() and not m.lida
     and not exists (select 1 from public.conversas_silenciadas s where s.conversa = c.id and s.usuario = auth.uid());
$$;
revoke all on function public.mensagens_nao_lidas() from public, anon;
grant execute on function public.mensagens_nao_lidas() to authenticated;

drop function if exists public.minhas_conversas();
create function public.minhas_conversas()
returns table (id uuid, outro uuid, outro_usuario text, outro_nome text, outro_foto text,
               ultima_texto text, ultima_minha boolean, ultima_em timestamptz, nao_lidas int, silenciada boolean)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.usuario, o.nome, o.foto_url,
         left(m.texto, 120), m.autor = auth.uid(), c.ultima_em,
         (select count(*)::int from public.mensagens x where x.conversa = c.id and x.autor <> auth.uid() and not x.lida),
         exists (select 1 from public.conversas_silenciadas s where s.conversa = c.id and s.usuario = auth.uid())
    from public.conversas c
    join public.perfis o on o.id = case when c.pessoa_a = auth.uid() then c.pessoa_b else c.pessoa_a end
    left join lateral (select texto, autor from public.mensagens where conversa = c.id order by id desc limit 1) m on true
   where auth.uid() in (c.pessoa_a, c.pessoa_b)
     and public.perfil_ativo(o.id)
     and (m.texto is not null or c.criada_por = auth.uid())
   order by c.ultima_em desc
   limit 100;
$$;
revoke all on function public.minhas_conversas() from public, anon;
grant execute on function public.minhas_conversas() to authenticated;

-- ---------- 3. Instagram no perfil (aparece no perfil e no mural de destaques) ----------
alter table public.perfis add column if not exists instagram text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_instagram_check') then
    alter table public.perfis add constraint perfis_instagram_check check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
  end if;
end $$;
grant select (instagram) on public.perfis to anon, authenticated;
grant update (instagram) on public.perfis to authenticated;

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
    'telefone', u.phone, 'telefone_confirmado', u.phone_confirmed_at is not null, 'criado_em', p.criado_em);
end $$;
revoke all on function public.minha_conta() from public, anon;
grant execute on function public.minha_conta() to authenticated;

-- ---------- 4. Membros destaque ----------
-- Pontos dos últimos N dias: publicação 5, resposta a pergunta 4, comentário 2, curtida recebida 1.
-- Só conta participação com os outros (comentar no próprio post ou curtir a si mesmo não vale).
create or replace function public.membros_destaque(p_dias int default 30, p_clube text default null, p_limite int default 12)
returns table (id uuid, usuario text, nome text, foto_url text, cidade text, estado text, instagram text,
               publicacoes int, comentarios int, respostas int, curtidas int, pontos int)
language sql stable security definer set search_path = public as $$
  with desde as (select now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 7), 365)) as t),
  pub as (
    select p.autor as u, count(*)::int as n from public.posts p, desde
     where not p.removido and p.especial is null and p.criado_em > desde.t and (p_clube is null or p.clube = p_clube)
     group by p.autor),
  com as (
    select c.autor as u, count(*) filter (where p.tipo <> 'pergunta')::int as n, count(*) filter (where p.tipo = 'pergunta')::int as r
      from public.comentarios c join public.posts p on p.id = c.post, desde
     where not c.removido and not p.removido and c.autor <> p.autor and c.criado_em > desde.t and (p_clube is null or p.clube = p_clube)
     group by c.autor),
  cur as (
    select p.autor as u, count(*)::int as n from public.curtidas k join public.posts p on p.id = k.post, desde
     where k.usuario <> p.autor and not p.removido and k.criado_em > desde.t and (p_clube is null or p.clube = p_clube)
     group by p.autor),
  todos as (select u from pub union select u from com union select u from cur)
  select pf.id, pf.usuario, pf.nome, pf.foto_url, pf.cidade, pf.estado, pf.instagram,
         coalesce(pub.n, 0), coalesce(com.n, 0), coalesce(com.r, 0), coalesce(cur.n, 0),
         coalesce(pub.n, 0) * 5 + coalesce(com.r, 0) * 4 + coalesce(com.n, 0) * 2 + coalesce(cur.n, 0)
    from todos
    join public.perfis pf on pf.id = todos.u
    left join pub on pub.u = todos.u
    left join com on com.u = todos.u
    left join cur on cur.u = todos.u
   where public.perfil_ativo(pf.id)
     and coalesce(pub.n, 0) * 5 + coalesce(com.r, 0) * 4 + coalesce(com.n, 0) * 2 + coalesce(cur.n, 0) >= 10
   order by 12 desc, pf.nome
   limit least(greatest(coalesce(p_limite, 12), 1), 50);
$$;
revoke all on function public.membros_destaque(int, text, int) from public;
grant execute on function public.membros_destaque(int, text, int) to anon, authenticated;

-- ---------- 5. Adoção: pessoas comuns também anunciam ----------
-- Três tipos de anunciante: ONG, protetor independente (os dois continuam com aprovação manual)
-- e pessoa ("Quero colocar um animal para adoção"): confirma o telefone por código e cada anúncio
-- passa pela moderação antes de aparecer no site.
do $$
declare r record;
begin
  for r in select con.conname from pg_constraint con
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
           where con.conrelid = 'public.organizacoes'::regclass and con.contype = 'c' and att.attname = 'tipo'
  loop execute format('alter table public.organizacoes drop constraint %I', r.conname); end loop;
end $$;
alter table public.organizacoes add constraint organizacoes_tipo_check check (tipo in ('ong', 'protetor', 'pessoa'));
alter table public.organizacoes add column if not exists telefone_confirmado boolean not null default false;
grant select (telefone_confirmado) on public.organizacoes to anon, authenticated;

-- Pessoa comum: o cadastro é liberado pelo sistema (sem análise manual); o controle fica nos anúncios
create or replace function public._organizacao_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'pessoa' then
    new.cnpj := null;
    if tg_op = 'INSERT' or old.tipo <> 'pessoa' or old.status in ('pendente', 'recusada') then
      if tg_op = 'INSERT' or old.status <> 'suspensa' then
        new.status := 'aprovada'; new.motivo := null; new.aprovada_em := coalesce(new.aprovada_em, now());
      end if;
    end if;
  elsif tg_op = 'UPDATE' and old.tipo = 'pessoa' and old.status <> 'suspensa' then
    new.status := 'pendente'; new.aprovada_em := null;   -- virou ONG ou protetor: passa pela análise
  end if;
  new.telefone_confirmado := exists (select 1 from auth.users where id = new.dono and phone_confirmed_at is not null);
  return new;
end $$;
drop trigger if exists organizacoes_z_pessoa on public.organizacoes;
create trigger organizacoes_z_pessoa before insert or update on public.organizacoes
  for each row execute function public._organizacao_pessoa();

-- Depois de confirmar o código no celular, a página chama esta função para atualizar o selo
create or replace function public.confirmar_telefone() returns boolean
language plpgsql security definer set search_path = public as $$
declare v boolean;
begin
  select phone_confirmed_at is not null into v from auth.users where id = auth.uid();
  update public.organizacoes set telefone_confirmado = coalesce(v, false) where dono = auth.uid();
  return coalesce(v, false);
end $$;
revoke all on function public.confirmar_telefone() from public, anon;
grant execute on function public.confirmar_telefone() to authenticated;

-- Campos novos do anúncio (obrigatórios para pessoa comum)
alter table public.pets_adocao add column if not exists motivo text check (char_length(motivo) <= 500);
alter table public.pets_adocao add column if not exists regiao text check (char_length(regiao) <= 80);
alter table public.pets_adocao add column if not exists saude text check (char_length(saude) <= 500);
alter table public.pets_adocao add column if not exists onde_esta text check (onde_esta in ('comigo', 'lar_temporario'));
alter table public.pets_adocao add column if not exists por_terceiros boolean not null default false;
alter table public.pets_adocao add column if not exists autorizado boolean;
alter table public.pets_adocao add column if not exists declarou boolean not null default false;
alter table public.pets_adocao add column if not exists declaracao_em timestamptz;
alter table public.pets_adocao add column if not exists moderacao text not null default 'aprovado';
alter table public.pets_adocao add column if not exists moderacao_motivo text check (char_length(moderacao_motivo) <= 300);
alter table public.pets_adocao add column if not exists moderado_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pets_adocao_moderacao_check') then
    alter table public.pets_adocao add constraint pets_adocao_moderacao_check check (moderacao in ('pendente', 'aprovado', 'recusado'));
  end if;
end $$;
grant insert (motivo, regiao, saude, onde_esta, por_terceiros, autorizado, declarou) on public.pets_adocao to authenticated;
grant update (motivo, regiao, saude, onde_esta, por_terceiros, autorizado, declarou) on public.pets_adocao to authenticated;

create or replace function public._regras_anuncio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_moderando boolean := coalesce(current_setting('abano.moderando', true), '') = '1';
        v_ignorar text[] := array['status', 'atualizado_em', 'expira_em', 'moderacao', 'moderacao_motivo', 'moderado_em', 'adotado_em', 'removido'];
begin
  if v_moderando then return new; end if;
  select tipo into v_tipo from public.organizacoes where id = new.org;
  new.motivo := nullif(btrim(new.motivo), ''); new.regiao := nullif(btrim(new.regiao), ''); new.saude := nullif(btrim(new.saude), '');
  if v_tipo = 'pessoa' then
    if tg_op = 'INSERT' and not exists (select 1 from auth.users where id = new.autor and phone_confirmed_at is not null) then
      raise exception 'Confirme seu telefone por código antes de anunciar.' using errcode = 'P0001';
    end if;
    if char_length(coalesce(new.motivo, '')) < 10 then raise exception 'Conte o motivo de colocar o animal para adoção.' using errcode = 'P0001'; end if;
    if new.regiao is null then raise exception 'Informe o bairro ou a região.' using errcode = 'P0001'; end if;
    if new.saude is null then raise exception 'Conte as informações de saúde que você conhece (ou escreva "nenhuma conhecida").' using errcode = 'P0001'; end if;
    if new.onde_esta is null then raise exception 'Diga se o animal está com você ou em lar temporário.' using errcode = 'P0001'; end if;
    if new.por_terceiros and new.autorizado is not true then raise exception 'Para divulgar por outra pessoa, você precisa ter a autorização do responsável.' using errcode = 'P0001'; end if;
    if not new.declarou then raise exception 'Confirme a declaração do anunciante.' using errcode = 'P0001'; end if;
    if tg_op = 'INSERT' then
      new.moderacao := 'pendente'; new.moderacao_motivo := null; new.moderado_em := null; new.declaracao_em := now();
    else
      new.declaracao_em := coalesce(old.declaracao_em, now());
      -- Mudou o conteúdo do anúncio: volta para a análise
      if (to_jsonb(new) - v_ignorar) is distinct from (to_jsonb(old) - v_ignorar) then
        new.moderacao := 'pendente'; new.moderacao_motivo := null; new.declaracao_em := now();
      else
        new.moderacao := old.moderacao; new.moderacao_motivo := old.moderacao_motivo;
      end if;
      new.moderado_em := old.moderado_em;
    end if;
  else
    if tg_op = 'INSERT' then new.moderacao := 'aprovado';
    else new.moderacao := old.moderacao; new.moderacao_motivo := old.moderacao_motivo; new.moderado_em := old.moderado_em; end if;
  end if;
  return new;
end $$;
drop trigger if exists pets_adocao_z_regras on public.pets_adocao;
create trigger pets_adocao_z_regras before insert or update on public.pets_adocao
  for each row execute function public._regras_anuncio();

-- Anúncio só aparece depois de aprovado (o anunciante e a administração sempre veem)
drop policy if exists "pets para adocao visiveis" on public.pets_adocao;
create policy "pets para adocao visiveis" on public.pets_adocao for select to anon, authenticated
  using ((not removido and moderacao = 'aprovado' and public.org_aprovada(org)) or autor = auth.uid() or public.eh_admin());

create or replace function public._pedido_so_aprovado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.pets_adocao where id = new.pet and moderacao = 'aprovado') then
    raise exception 'Este anúncio ainda está em análise.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pedidos_adocao_so_aprovado on public.pedidos_adocao;
create trigger pedidos_adocao_so_aprovado before insert on public.pedidos_adocao
  for each row execute function public._pedido_so_aprovado();

-- Administração: fila de anúncios e decisão (com e-mail para o anunciante)
create or replace function public.anuncios_moderacao(p_status text default 'pendente') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc) from (
    select p.id, p.nome, p.especie, p.sexo, p.idade, p.fotos, p.cidade, p.estado, p.regiao, p.descricao, p.motivo, p.saude,
           p.onde_esta, p.por_terceiros, p.autorizado, p.vacinado, p.vermifugado, p.castrado, p.status, p.moderacao, p.moderacao_motivo, p.criado_em,
           o.nome as anunciante, o.tipo as tipo_anunciante, o.telefone_confirmado,
           pf.usuario, (select email from auth.users where id = p.autor) as email,
           (select count(*) from public.pets_adocao x where x.autor = p.autor) as total_anuncios
      from public.pets_adocao p
      join public.organizacoes o on o.id = p.org
      join public.perfis pf on pf.id = p.autor
     where (p_status = 'todos' or p.moderacao = p_status) and not p.removido
     order by p.criado_em desc limit 200) x), '[]'::jsonb);
end $$;
revoke all on function public.anuncios_moderacao(text) from public, anon;
grant execute on function public.anuncios_moderacao(text) to authenticated;

create or replace function public.moderar_anuncio(p_pet uuid, p_acao text, p_motivo text default null) returns text
language plpgsql security definer set search_path = public as $$
declare v public.pets_adocao; v_novo text;
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  v_novo := case p_acao when 'aprovar' then 'aprovado' when 'recusar' then 'recusado' end;
  if v_novo is null then raise exception 'Ação inválida.' using errcode = 'P0001'; end if;
  perform set_config('abano.moderando', '1', true);
  update public.pets_adocao set moderacao = v_novo, moderacao_motivo = case when v_novo = 'recusado' then nullif(btrim(p_motivo), '') end,
         moderado_em = now(), expira_em = case when v_novo = 'aprovado' then now() + interval '60 days' else expira_em end
   where id = p_pet returning * into v;
  perform set_config('abano.moderando', '0', true);
  if v.id is null then raise exception 'Anúncio não encontrado.' using errcode = 'P0001'; end if;
  if v_novo = 'aprovado' then
    perform public._enviar_aviso(v.autor, 'Seu anúncio de ' || v.nome || ' foi aprovado',
      'O anúncio de ' || public._esc(v.nome) || ' está no ar!',
      'A equipe do Abanô revisou o anúncio e ele já aparece na página de adoção. Os pedidos chegam por e-mail e no seu painel.',
      'Ver meus anúncios', '/ong.html');
  else
    perform public._enviar_aviso(v.autor, 'Sobre o seu anúncio de ' || v.nome,
      'O anúncio de ' || public._esc(v.nome) || ' precisa de ajustes',
      coalesce('Motivo: ' || public._esc(nullif(btrim(p_motivo), '')) || '<br><br>', '') || 'Corrija o anúncio no seu painel e ele volta automaticamente para a análise.',
      'Corrigir o anúncio', '/ong.html');
  end if;
  return v_novo;
end $$;
revoke all on function public.moderar_anuncio(uuid, text, text) from public, anon;
grant execute on function public.moderar_anuncio(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Conferência: deve listar 5 itens com "ok"
select 'clube samoieda' as item, case when exists (select 1 from public.clubes where id = 'samoieda') then 'ok' else 'FALTA' end as status
union all select 'opções do chat', case when exists (select 1 from pg_proc where proname = 'silenciar_conversa') then 'ok' else 'FALTA' end
union all select 'membros destaque', case when exists (select 1 from pg_proc where proname = 'membros_destaque') then 'ok' else 'FALTA' end
union all select 'anunciante pessoa', case when exists (select 1 from pg_trigger where tgname = 'organizacoes_z_pessoa') then 'ok' else 'FALTA' end
union all select 'moderação de anúncios', case when exists (select 1 from pg_proc where proname = 'moderar_anuncio') then 'ok' else 'FALTA' end;
