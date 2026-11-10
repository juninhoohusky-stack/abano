-- =========================================================
-- Abanô — moderação e segurança da Comunidade:
-- denúncias, bloqueios, suspensão de contas e painel do admin
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes: comunidade.sql.
-- =========================================================

-- ---------- 1. Suspensão de conta ----------
-- Conta suspensa continua podendo entrar, ver e excluir os próprios dados,
-- mas não publica, comenta, curte, vota, segue nem entra em clubes.
alter table public.perfis add column if not exists suspenso boolean not null default false;

create or replace function public.perfil_ativo(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = p_id and versao_politica is not null and not suspenso);
$$;

-- Pets continuam visíveis enquanto o perfil for público (suspensão não apaga nada)
create or replace function public.perfil_publico(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = p_id and versao_politica is not null);
$$;
revoke all on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to anon, authenticated;
drop policy if exists "pets visiveis" on public.pets;
create policy "pets visiveis" on public.pets for select to anon, authenticated
  using (dono = auth.uid() or public.perfil_publico(dono));

-- "Minha conta" passa a avisar quando a conta está suspensa
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
    'admin', public.eh_admin(), 'suspenso', p.suspenso);
end $$;

-- ---------- 2. Bloqueios (cada um vê só os próprios) ----------
create table if not exists public.bloqueios (
  bloqueador  uuid not null references public.perfis (id) on delete cascade,
  bloqueado   uuid not null references public.perfis (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (bloqueador, bloqueado),
  check (bloqueador <> bloqueado)
);
alter table public.bloqueios enable row level security;
drop policy if exists "bloqueios proprios" on public.bloqueios;
create policy "bloqueios proprios" on public.bloqueios for select to authenticated using (bloqueador = auth.uid());
drop policy if exists "bloquear" on public.bloqueios;
create policy "bloquear" on public.bloqueios for insert to authenticated with check (bloqueador = auth.uid());
drop policy if exists "desbloquear" on public.bloqueios;
create policy "desbloquear" on public.bloqueios for delete to authenticated using (bloqueador = auth.uid());
revoke all on public.bloqueios from anon, authenticated;
grant select, delete on public.bloqueios to authenticated;
grant insert (bloqueador, bloqueado) on public.bloqueios to authenticated;

-- Quem eu bloqueei some do meu feed e dos comentários (para visitantes, sempre "não")
create or replace function public.bloqueei(p_autor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.bloqueios where bloqueador = auth.uid() and bloqueado = p_autor);
$$;
revoke all on function public.bloqueei(uuid) from public;
grant execute on function public.bloqueei(uuid) to anon, authenticated;

-- Algum dos dois bloqueou o outro?
create or replace function public._bloqueio_entre(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bloqueios where (bloqueador = a and bloqueado = b) or (bloqueador = b and bloqueado = a));
$$;
revoke all on function public._bloqueio_entre(uuid, uuid) from public, anon, authenticated;

drop policy if exists "posts visiveis" on public.posts;
create policy "posts visiveis" on public.posts for select to anon, authenticated
  using ((not removido and not public.bloqueei(autor)) or autor = auth.uid() or public.eh_admin());
drop policy if exists "comentarios visiveis" on public.comentarios;
create policy "comentarios visiveis" on public.comentarios for select to anon, authenticated
  using ((not removido and not public.bloqueei(autor)) or autor = auth.uid() or public.eh_admin());

-- Ao bloquear: desfaz o "seguir" nos dois sentidos
create or replace function public._ao_bloquear() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.seguidores where (seguidor = new.bloqueador and seguido = new.bloqueado) or (seguidor = new.bloqueado and seguido = new.bloqueador);
  return null;
end $$;
drop trigger if exists bloqueios_ao_bloquear on public.bloqueios;
create trigger bloqueios_ao_bloquear after insert on public.bloqueios
  for each row execute function public._ao_bloquear();

-- Bloqueado não segue quem o bloqueou
grant execute on function public._bloqueio_entre(uuid, uuid) to authenticated;
drop policy if exists "seguir" on public.seguidores;
create policy "seguir" on public.seguidores for insert to authenticated
  with check (seguidor = auth.uid() and public.perfil_ativo(auth.uid()) and public.perfil_publico(seguido)
              and not public._bloqueio_entre(seguidor, seguido));

-- Bloqueado não comenta nas publicações de quem o bloqueou (e vice-versa)
create or replace function public._validar_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_autor_post uuid;
begin
  new.texto := btrim(new.texto); new.removido := false; new.criado_em := now();
  if public.parece_venda_de_animal(new.texto) then
    raise exception 'Venda de animais não é permitida na Comunidade Abanô.' using errcode = 'P0001';
  end if;
  select autor into v_autor_post from public.posts where id = new.post and not removido;
  if v_autor_post is null then
    raise exception 'Essa publicação não está mais disponível.' using errcode = 'P0001';
  end if;
  if public._bloqueio_entre(v_autor_post, new.autor) then
    raise exception 'Não é possível comentar nesta publicação.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.comentarios where autor = new.autor and criado_em > now() - interval '5 seconds') then
    raise exception 'Espere alguns segundos antes de comentar de novo.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.comentarios where autor = new.autor and criado_em > now() - interval '1 hour') >= 60 then
    raise exception 'Você atingiu o limite de comentários por hora. Tente mais tarde.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------- 3. Denúncias ----------
create table if not exists public.denuncias (
  id             bigint generated always as identity primary key,
  criado_em      timestamptz not null default now(),
  denunciante    uuid references public.perfis (id) on delete set null,
  alvo_tipo      text not null check (alvo_tipo in ('post', 'comentario', 'perfil')),
  post           uuid references public.posts (id) on delete cascade,
  comentario     uuid references public.comentarios (id) on delete cascade,
  perfil         uuid references public.perfis (id) on delete cascade,
  motivo         text not null check (motivo in ('spam', 'venda', 'ofensa', 'golpe', 'improprio', 'dados_pessoais', 'saude', 'outro')),
  detalhe        text check (char_length(detalhe) <= 500),
  status         text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  acao           text,
  resolvida_em   timestamptz,
  resolvida_por  text
);
create index if not exists denuncias_status on public.denuncias (status, criado_em desc);
create unique index if not exists denuncias_uma_por_pessoa
  on public.denuncias (denunciante, alvo_tipo, coalesce(post, comentario, perfil)) where status = 'aberta';

alter table public.denuncias enable row level security;
drop policy if exists "denunciar" on public.denuncias;
create policy "denunciar" on public.denuncias for insert to authenticated
  with check (denunciante = auth.uid() and public.perfil_publico(auth.uid()));
revoke all on public.denuncias from anon, authenticated;
grant insert (denunciante, alvo_tipo, post, comentario, perfil, motivo, detalhe) on public.denuncias to authenticated;

create or replace function public._validar_denuncia() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_denuncias int;
begin
  new.status := 'aberta'; new.acao := null; new.resolvida_em := null; new.resolvida_por := null; new.criado_em := now();
  new.detalhe := nullif(btrim(new.detalhe), '');
  if (new.alvo_tipo = 'post' and (new.post is null or new.comentario is not null or new.perfil is not null))
     or (new.alvo_tipo = 'comentario' and (new.comentario is null or new.post is not null or new.perfil is not null))
     or (new.alvo_tipo = 'perfil' and (new.perfil is null or new.post is not null or new.comentario is not null)) then
    raise exception 'Denúncia inválida.' using errcode = 'P0001';
  end if;
  if new.perfil = new.denunciante then raise exception 'Você não pode denunciar o próprio perfil.' using errcode = 'P0001'; end if;
  if (select count(*) from public.denuncias where denunciante = new.denunciante and criado_em > now() - interval '1 day') >= 20 then
    raise exception 'Você atingiu o limite de denúncias por dia. Se for urgente, escreva para contato@abano.com.br.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists denuncias_validar on public.denuncias;
create trigger denuncias_validar before insert on public.denuncias
  for each row execute function public._validar_denuncia();

-- Proteção automática: com 5 denúncias abertas de pessoas diferentes, o conteúdo sai do ar até a revisão
create or replace function public._ocultar_por_denuncias() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.post is not null and (select count(distinct denunciante) from public.denuncias where post = new.post and status = 'aberta') >= 5 then
    update public.posts set removido = true where id = new.post;
  elsif new.comentario is not null and (select count(distinct denunciante) from public.denuncias where comentario = new.comentario and status = 'aberta') >= 5 then
    update public.comentarios set removido = true where id = new.comentario;
  end if;
  return null;
end $$;
drop trigger if exists denuncias_ocultar on public.denuncias;
create trigger denuncias_ocultar after insert on public.denuncias
  for each row execute function public._ocultar_por_denuncias();

-- ---------- 4. Painel de moderação (só administradores) ----------
create or replace function public.moderacao_lista(p_status text default 'aberta') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by x ->> 'criado_em' desc) from (
      select jsonb_build_object(
        'id', d.id, 'criado_em', d.criado_em, 'alvo_tipo', d.alvo_tipo, 'motivo', d.motivo, 'detalhe', d.detalhe,
        'status', d.status, 'acao', d.acao, 'resolvida_por', d.resolvida_por,
        'denunciante', (select usuario from public.perfis where id = d.denunciante),
        'total_denuncias', (select count(*) from public.denuncias d2 where d2.status = 'aberta' and coalesce(d2.post, d2.comentario, d2.perfil) = coalesce(d.post, d.comentario, d.perfil)),
        'post', case when d.post is not null then (select jsonb_build_object('id', p.id, 'tipo', p.tipo, 'texto', p.texto, 'fotos', p.fotos, 'video_url', p.video_url, 'removido', p.removido,
                   'autor', (select jsonb_build_object('id', a.id, 'usuario', a.usuario, 'nome', a.nome, 'suspenso', a.suspenso) from public.perfis a where a.id = p.autor))
                 from public.posts p where p.id = d.post) end,
        'comentario', case when d.comentario is not null then (select jsonb_build_object('id', c.id, 'post', c.post, 'texto', c.texto, 'removido', c.removido,
                   'autor', (select jsonb_build_object('id', a.id, 'usuario', a.usuario, 'nome', a.nome, 'suspenso', a.suspenso) from public.perfis a where a.id = c.autor))
                 from public.comentarios c where c.id = d.comentario) end,
        'perfil', case when d.perfil is not null then (select jsonb_build_object('id', a.id, 'usuario', a.usuario, 'nome', a.nome, 'bio', a.bio, 'foto_url', a.foto_url, 'suspenso', a.suspenso)
                 from public.perfis a where a.id = d.perfil) end
      ) as x
      from public.denuncias d
      where d.status = p_status or (p_status = 'fechadas' and d.status <> 'aberta')
      order by d.criado_em desc
      limit 200
    ) t), '[]'::jsonb);
end $$;
revoke all on function public.moderacao_lista(text) from public, anon;
grant execute on function public.moderacao_lista(text) to authenticated;

-- Ações: descartar, remover (tira do ar), restaurar, suspender ou reativar o autor
create or replace function public.moderar(p_denuncia bigint, p_acao text) returns boolean
language plpgsql security definer set search_path = public as $$
declare d public.denuncias; v_autor uuid; v_admin text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  if p_acao not in ('descartar', 'remover', 'restaurar', 'suspender', 'reativar') then raise exception 'Ação inválida.'; end if;
  select * into d from public.denuncias where id = p_denuncia;
  if d.id is null then raise exception 'Denúncia não encontrada.'; end if;

  v_autor := coalesce(d.perfil, (select autor from public.posts where id = d.post), (select autor from public.comentarios where id = d.comentario));

  if p_acao = 'remover' then
    update public.posts set removido = true where id = d.post;
    update public.comentarios set removido = true where id = d.comentario;
  elsif p_acao = 'restaurar' then
    update public.posts set removido = false where id = d.post;
    update public.comentarios set removido = false where id = d.comentario;
  elsif p_acao = 'suspender' then
    update public.perfis set suspenso = true where id = v_autor;
  elsif p_acao = 'reativar' then
    update public.perfis set suspenso = false where id = v_autor;
  end if;

  -- Fecha todas as denúncias abertas sobre o mesmo conteúdo
  update public.denuncias
     set status = case when p_acao in ('descartar', 'restaurar', 'reativar') then 'descartada' else 'resolvida' end,
         acao = p_acao, resolvida_em = now(), resolvida_por = v_admin
   where (id = d.id or (status = 'aberta' and coalesce(post, comentario, perfil) = coalesce(d.post, d.comentario, d.perfil)));
  return true;
end $$;
revoke all on function public.moderar(bigint, text) from public, anon;
grant execute on function public.moderar(bigint, text) to authenticated;

-- ---------- 5. Limite de arquivos por pessoa no armazenamento ----------
drop policy if exists "fotos: dono envia" on storage.objects;
create policy "fotos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
              and public.perfil_ativo(auth.uid())
              and (select count(*) from storage.objects o where o.bucket_id = 'fotos' and (storage.foldername(o.name))[1] = auth.uid()::text) < 400);

-- =========================================================
-- 6. Correções da revisão de segurança
-- =========================================================

-- 6.1 Enquetes: o voto é contado DEPOIS de gravado (votos repetidos não somam)
create or replace function public._registrar_voto() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  select cardinality(opcoes) into v_n from public.posts where id = new.post and tipo = 'enquete' and not removido;
  if v_n is null or new.opcao >= v_n then raise exception 'Opção inválida.' using errcode = 'P0001'; end if;
  return new;
end $$;
create or replace function public._contar_voto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.posts set votos[new.opcao + 1] = votos[new.opcao + 1] + 1, total_votos = total_votos + 1 where id = new.post;
  return null;
end $$;
drop trigger if exists enquete_votos_contar on public.enquete_votos;
create trigger enquete_votos_contar after insert on public.enquete_votos
  for each row execute function public._contar_voto();

-- 6.2 A lista de espera antiga não aceita mais cadastros diretos pelo site
-- (quem quer novidades se inscreve pela conta). Evita disparo de e-mails para terceiros.
drop policy if exists "visitantes podem se cadastrar" on public.lista_espera;
drop policy if exists "contas google podem se cadastrar" on public.lista_espera;
revoke insert on public.lista_espera from anon, authenticated;

-- 6.3 Limites que não dá para furar com pedidos simultâneos:
-- cada pessoa entra numa "fila" antes das contagens de spam
create or replace function public._trava_por_pessoa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || ':' || coalesce(to_jsonb(new) ->> tg_argv[0], ''), 0));
  return new;
end $$;
drop trigger if exists a_trava_posts on public.posts;
create trigger a_trava_posts before insert on public.posts for each row execute function public._trava_por_pessoa('autor');
drop trigger if exists a_trava_comentarios on public.comentarios;
create trigger a_trava_comentarios before insert on public.comentarios for each row execute function public._trava_por_pessoa('autor');
drop trigger if exists a_trava_pets on public.pets;
create trigger a_trava_pets before insert on public.pets for each row execute function public._trava_por_pessoa('dono');
drop trigger if exists a_trava_denuncias on public.denuncias;
create trigger a_trava_denuncias before insert on public.denuncias for each row execute function public._trava_por_pessoa('denunciante');

-- 6.4 Freio por aparelho nos formulários abertos (pesquisa, divulgação e pedidos de privacidade).
-- Guarda só um código embaralhado do endereço de internet (não dá para voltar ao IP), por até 1 dia.
create table if not exists public.freio_envios (
  chave      text not null,
  criado_em  timestamptz not null default now()
);
create index if not exists freio_envios_chave on public.freio_envios (chave, criado_em);
alter table public.freio_envios enable row level security;
revoke all on public.freio_envios from anon, authenticated;

create or replace function public._freio_ip() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ip text; v_chave text; v_max int := tg_argv[0]::int;
begin
  v_ip := nullif(btrim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  if v_ip is null then return new; end if;                       -- sem IP conhecido, não trava ninguém
  v_chave := tg_table_name || ':' || md5(v_ip || ':abano-freio');
  perform pg_advisory_xact_lock(hashtextextended(v_chave, 0));
  delete from public.freio_envios where criado_em < now() - interval '1 day';
  if (select count(*) from public.freio_envios where chave = v_chave and criado_em > now() - interval '1 hour') >= v_max then
    raise exception 'Muitos envios seguidos deste aparelho. Tente de novo mais tarde.' using errcode = 'P0001';
  end if;
  insert into public.freio_envios (chave) values (v_chave);
  return new;
end $$;
drop trigger if exists a_freio_pesquisa on public.pesquisa_huskies;
create trigger a_freio_pesquisa before insert on public.pesquisa_huskies for each row execute function public._freio_ip('20');
drop trigger if exists a_freio_anunciantes on public.anunciantes;
create trigger a_freio_anunciantes before insert on public.anunciantes for each row execute function public._freio_ip('10');
drop trigger if exists a_freio_titular on public.solicitacoes_titular;
create trigger a_freio_titular before insert on public.solicitacoes_titular for each row execute function public._freio_ip('10');

-- 6.5 Fotos: só na pasta principal da pessoa e no máximo 300 arquivos por conta
create or replace function public.qtd_fotos(p_uid uuid) returns int
language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects where bucket_id = 'fotos' and name like p_uid::text || '/%';
$$;
revoke all on function public.qtd_fotos(uuid) from public, anon;
grant execute on function public.qtd_fotos(uuid) to authenticated;
drop policy if exists "fotos: dono envia" on storage.objects;
create policy "fotos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
              and array_length(storage.foldername(name), 1) = 1
              and public.perfil_ativo(auth.uid())
              and public.qtd_fotos(auth.uid()) < 300);

-- Fotos de contas que não existem mais (para a limpeza automática do GitHub, que usa a chave secreta)
create or replace function public.fotos_orfas() returns setof text
language sql stable security definer set search_path = public, storage as $$
  select o.name from storage.objects o
   where o.bucket_id = 'fotos'
     and not exists (select 1 from public.perfis p where p.id::text = split_part(o.name, '/', 1))
   limit 1000;
$$;
revoke all on function public.fotos_orfas() from public, anon, authenticated;
grant execute on function public.fotos_orfas() to service_role;

-- 6.6 Administrador: só com e-mail confirmado na própria conta (não confia em dados editáveis)
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u join public.admins a on a.email = lower(u.email)
     where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.eh_admin() from public;
grant execute on function public.eh_admin() to anon, authenticated;

-- 6.7 O link dos e-mails de novidades apaga só a inscrição nas novidades.
-- A conta da Comunidade só é excluída por quem está logado, em Minha conta.
create or replace function public.excluir_meus_dados(p_token uuid) returns boolean
language sql security definer set search_path = public as $$
  delete from public.lista_espera where token = p_token returning true;
$$;
revoke all on function public.excluir_meus_dados(uuid) from public;
grant execute on function public.excluir_meus_dados(uuid) to anon;

notify pgrst, 'reload schema';

-- 6.8 Denúncias resolvidas há mais de 1 ano são apagadas todo dia
create or replace function public.limpar_denuncias_antigas() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.denuncias where status <> 'aberta' and resolvida_em < now() - interval '1 year';
  get diagnostics n = row_count;
  delete from public.freio_envios where criado_em < now() - interval '1 day';
  return n;
end $$;
revoke all on function public.limpar_denuncias_antigas() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-denuncias';
  perform cron.schedule('abano-limpar-denuncias', '45 6 * * *', 'select public.limpar_denuncias_antigas()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza das denúncias (ative pg_cron e rode de novo): %', sqlerrm;
end $$;

-- Conferência: deve listar 5 itens com "ok"
select 'suspensão' as item, case when exists (select 1 from information_schema.columns where table_name = 'perfis' and column_name = 'suspenso') then 'ok' else 'FALTA' end as status
union all select 'bloqueios', case when to_regclass('public.bloqueios') is not null then 'ok' else 'FALTA' end
union all select 'denúncias', case when to_regclass('public.denuncias') is not null then 'ok' else 'FALTA' end
union all select 'painel de moderação', case when exists (select 1 from pg_proc where proname = 'moderar') then 'ok' else 'FALTA' end
union all select 'correções de segurança', case when exists (select 1 from pg_trigger where tgname = 'enquete_votos_contar') and not exists (select 1 from pg_policies where tablename = 'lista_espera' and cmd = 'INSERT') then 'ok' else 'FALTA' end;
