-- =========================================================
-- Abanô — Clubes novos, conversas entre tutores, avisos de
-- adoção no sininho, adoção concluída (com comemoração no feed),
-- foto de perfil obrigatória na adoção e ajustes nos alertas.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- comunidade.sql, moderacao.sql, adocao.sql, notificacoes.sql
-- e pets_perdidos.sql. Não cria nenhum dado de exemplo.
-- =========================================================

-- ---------- 1. Clubes ----------
insert into public.clubes (id, nome, descricao, tipo, ordem) values
  ('shih-tzu',        'Shih Tzu',        'Tutores de Shih Tzu: tosa, pelagem, rotina e muitas fotos para compartilhar.', 'raca', 40),
  ('border-collie',   'Border Collie',   'Tutores de Border Collie: energia, brincadeiras, passeios e experiências do dia a dia.', 'raca', 42),
  ('pug',             'Pug',             'Tutores de Pug: rotina, passeios nos dias quentes e muitas fotos para compartilhar.', 'raca', 44),
  ('bulldog-frances', 'Bulldog Francês', 'Tutores de Bulldog Francês: rotina, passeios nos dias quentes e experiências do dia a dia.', 'raca', 46)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, tipo = excluded.tipo, ordem = excluded.ordem;

update public.clubes set descricao = 'Para quem divide a casa com gatos: comportamento, rotina, enriquecimento e muitas fotos.' where id = 'gatos';
update public.clubes set descricao = 'Tutores do Rio de Janeiro: passeios, eventos, encontros e conexão com quem está perto.' where id = 'tutores-rj';
update public.clubes set descricao = 'Tutores de São Paulo: passeios, eventos, encontros e conexão com quem está perto.' where id = 'tutores-sp';

-- O clube de Labradores sai (as publicações dele continuam no feed, só sem o clube)
delete from public.clubes where id = 'labradores';

-- ---------- 2. Conversas (chat entre tutores) ----------
-- Só começa uma conversa quem segue a outra pessoa. Depois de aberta, os dois podem
-- responder. Bloqueio, em qualquer direção, impede novas mensagens.
create table if not exists public.conversas (
  id          uuid primary key default gen_random_uuid(),
  pessoa_a    uuid not null references public.perfis (id) on delete cascade,
  pessoa_b    uuid not null references public.perfis (id) on delete cascade,
  criada_por  uuid not null references public.perfis (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  ultima_em   timestamptz not null default now(),
  check (pessoa_a < pessoa_b),
  unique (pessoa_a, pessoa_b)
);
create index if not exists conversas_b on public.conversas (pessoa_b);
alter table public.conversas enable row level security;
drop policy if exists "minhas conversas" on public.conversas;
create policy "minhas conversas" on public.conversas for select to authenticated
  using (auth.uid() in (pessoa_a, pessoa_b));
revoke all on public.conversas from anon, authenticated;
grant select on public.conversas to authenticated;

create table if not exists public.mensagens (
  id         bigint generated always as identity primary key,
  conversa   uuid not null references public.conversas (id) on delete cascade,
  autor      uuid not null references public.perfis (id) on delete cascade,
  texto      text not null check (char_length(btrim(texto)) between 1 and 2000),
  lida       boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists mensagens_conversa on public.mensagens (conversa, id desc);
create index if not exists mensagens_nao_lidas on public.mensagens (conversa) where not lida;
alter table public.mensagens enable row level security;
drop policy if exists "mensagens das minhas conversas" on public.mensagens;
create policy "mensagens das minhas conversas" on public.mensagens for select to authenticated
  using (exists (select 1 from public.conversas c where c.id = conversa and auth.uid() in (c.pessoa_a, c.pessoa_b)));
revoke all on public.mensagens from anon, authenticated;
grant select on public.mensagens to authenticated;

create or replace function public.abrir_conversa(p_com uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := auth.uid(); v uuid;
begin
  if v_eu is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if not public.perfil_ativo(v_eu) then raise exception 'Complete seu cadastro para conversar.' using errcode = 'P0001'; end if;
  if p_com is null or p_com = v_eu or not public.perfil_ativo(p_com) then raise exception 'Perfil não encontrado.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.bloqueios where (bloqueador = v_eu and bloqueado = p_com) or (bloqueador = p_com and bloqueado = v_eu)) then
    raise exception 'Não é possível conversar com este perfil.' using errcode = 'P0001';
  end if;
  select id into v from public.conversas where pessoa_a = least(v_eu, p_com) and pessoa_b = greatest(v_eu, p_com);
  if v is not null then return v; end if;
  if not exists (select 1 from public.seguidores where seguidor = v_eu and seguido = p_com) then
    raise exception 'Siga este perfil para iniciar uma conversa.' using errcode = 'P0001';
  end if;
  insert into public.conversas (pessoa_a, pessoa_b, criada_por) values (least(v_eu, p_com), greatest(v_eu, p_com), v_eu)
  on conflict (pessoa_a, pessoa_b) do update set ultima_em = public.conversas.ultima_em
  returning id into v;
  return v;
end $$;
revoke all on function public.abrir_conversa(uuid) from public, anon;
grant execute on function public.abrir_conversa(uuid) to authenticated;

create or replace function public.enviar_mensagem(p_conversa uuid, p_texto text) returns public.mensagens
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := auth.uid(); c public.conversas; v_outro uuid; m public.mensagens; v_texto text := btrim(coalesce(p_texto, ''));
begin
  select * into c from public.conversas where id = p_conversa and v_eu in (pessoa_a, pessoa_b);
  if c.id is null then raise exception 'Conversa não encontrada.' using errcode = 'P0001'; end if;
  v_outro := case when c.pessoa_a = v_eu then c.pessoa_b else c.pessoa_a end;
  if not public.perfil_ativo(v_eu) or not public.perfil_ativo(v_outro) then raise exception 'Não é possível enviar mensagens para este perfil.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.bloqueios where (bloqueador = v_eu and bloqueado = v_outro) or (bloqueador = v_outro and bloqueado = v_eu)) then
    raise exception 'Não é possível conversar com este perfil.' using errcode = 'P0001';
  end if;
  if char_length(v_texto) not between 1 and 2000 then raise exception 'Escreva uma mensagem de até 2.000 letras.' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mensagens:' || v_eu::text, 0));
  if (select count(*) from public.mensagens where autor = v_eu and criado_em > now() - interval '1 minute') >= 20 then
    raise exception 'Muitas mensagens seguidas. Espere um minutinho.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.mensagens where autor = v_eu and criado_em > now() - interval '1 day') >= 500 then
    raise exception 'Você atingiu o limite de mensagens de hoje.' using errcode = 'P0001';
  end if;
  insert into public.mensagens (conversa, autor, texto) values (c.id, v_eu, v_texto) returning * into m;
  update public.conversas set ultima_em = now() where id = c.id;
  return m;
end $$;
revoke all on function public.enviar_mensagem(uuid, text) from public, anon;
grant execute on function public.enviar_mensagem(uuid, text) to authenticated;

create or replace function public.ler_conversa(p_conversa uuid) returns void
language sql security definer set search_path = public as $$
  update public.mensagens m set lida = true
   where m.conversa = p_conversa and m.autor <> auth.uid() and not m.lida
     and exists (select 1 from public.conversas c where c.id = p_conversa and auth.uid() in (c.pessoa_a, c.pessoa_b));
$$;
revoke all on function public.ler_conversa(uuid) from public, anon;
grant execute on function public.ler_conversa(uuid) to authenticated;

create or replace function public.minhas_conversas()
returns table (id uuid, outro uuid, outro_usuario text, outro_nome text, outro_foto text,
               ultima_texto text, ultima_minha boolean, ultima_em timestamptz, nao_lidas int)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.usuario, o.nome, o.foto_url,
         left(m.texto, 120), m.autor = auth.uid(), c.ultima_em,
         (select count(*)::int from public.mensagens x where x.conversa = c.id and x.autor <> auth.uid() and not x.lida)
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

create or replace function public.mensagens_nao_lidas() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.mensagens m join public.conversas c on c.id = m.conversa
   where auth.uid() in (c.pessoa_a, c.pessoa_b) and m.autor <> auth.uid() and not m.lida;
$$;
revoke all on function public.mensagens_nao_lidas() from public, anon;
grant execute on function public.mensagens_nao_lidas() to authenticated;

-- ---------- 3. Adoção: pedido concluído e publicações especiais ----------
do $$
declare r record;
begin
  for r in select con.conname from pg_constraint con
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
           where con.conrelid = 'public.pedidos_adocao'::regclass and con.contype = 'c' and att.attname = 'status'
  loop execute format('alter table public.pedidos_adocao drop constraint %I', r.conname); end loop;
end $$;
alter table public.pedidos_adocao add constraint pedidos_adocao_status_check
  check (status in ('enviado', 'aceito', 'recusado', 'cancelado', 'adotado'));
alter table public.pedidos_adocao add column if not exists post_compartilhado uuid references public.posts (id) on delete set null;
grant select (post_compartilhado) on public.pedidos_adocao to authenticated;
alter table public.pets_adocao add column if not exists adotado_em timestamptz;

-- Publicações especiais: comemoração automática do Abanô e a do tutor que adotou
alter table public.posts add column if not exists especial text;
alter table public.posts add column if not exists pet_adocao uuid references public.pets_adocao (id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_especial_check') then
    alter table public.posts add constraint posts_especial_check check (especial in ('adocao_abano', 'adocao_tutor'));
  end if;
end $$;
-- (esses dois campos não entram nos grants de insert: só as funções abaixo preenchem)

-- Regras da publicação, agora aceitando as publicações automáticas
create or replace function public._validar_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prefixo text := 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/' || new.autor::text || '/';
        v_foto text; v_opcao text;
        -- Publicações automáticas do Abanô (adoção concluída): a foto é a do anúncio e não entram no freio
        v_sistema boolean := coalesce(current_setting('abano.post_sistema', true), '') = '1';
begin
  if tg_op = 'UPDATE' then
    if coalesce(btrim(new.texto), '') = '' and new.tipo in ('texto', 'pergunta', 'enquete') then
      raise exception 'A publicação precisa de um texto.' using errcode = 'P0001';
    end if;
    if new.texto is distinct from old.texto then
      new.texto := nullif(btrim(new.texto), '');
      if public.parece_venda_de_animal(new.texto) then
        raise exception 'Venda de animais não é permitida na Comunidade Abanô.' using errcode = 'P0001';
      end if;
      new.editado_em := now();
    end if;
    return new;
  end if;

  new.texto := nullif(btrim(new.texto), '');
  new.removido := false; new.total_curtidas := 0; new.total_comentarios := 0; new.total_votos := 0; new.votos := null;
  new.criado_em := now(); new.editado_em := null;

  if new.tipo in ('texto', 'pergunta', 'enquete') and new.texto is null then
    raise exception 'Escreva alguma coisa antes de publicar.' using errcode = 'P0001';
  end if;
  if public.parece_venda_de_animal(new.texto) then
    raise exception 'Venda de animais não é permitida na Comunidade Abanô. Para adoção responsável, use a área de adoção.' using errcode = 'P0001';
  end if;
  if new.tipo = 'pergunta' and char_length(new.texto) < 10 then
    raise exception 'Conte um pouco mais na pergunta (pelo menos 10 letras).' using errcode = 'P0001';
  end if;

  -- Fotos: até 4, só da pasta do próprio autor
  if new.fotos is not null and cardinality(new.fotos) = 0 then new.fotos := null; end if;
  if new.tipo = 'foto' and new.fotos is null then raise exception 'Escolha pelo menos uma foto.' using errcode = 'P0001'; end if;
  if new.fotos is not null then
    if cardinality(new.fotos) > 4 then raise exception 'Até 4 fotos por publicação.' using errcode = 'P0001'; end if;
    foreach v_foto in array new.fotos loop
      if v_foto is null or (left(v_foto, char_length(v_prefixo)) <> v_prefixo and not v_sistema) or char_length(v_foto) > 300 then
        raise exception 'Foto inválida.' using errcode = 'P0001';
      end if;
    end loop;
  end if;

  if new.tipo = 'video' and new.video_url is null then raise exception 'Cole o link do vídeo (YouTube, Instagram ou TikTok).' using errcode = 'P0001'; end if;
  if new.tipo <> 'video' then new.video_url := null; end if;

  -- Enquete: de 2 a 4 opções
  if new.tipo = 'enquete' then
    if new.opcoes is null or cardinality(new.opcoes) not between 2 and 4 then
      raise exception 'A enquete precisa de 2 a 4 opções.' using errcode = 'P0001';
    end if;
    foreach v_opcao in array new.opcoes loop
      if v_opcao is null or char_length(btrim(v_opcao)) not between 1 and 80 then
        raise exception 'Cada opção da enquete precisa ter de 1 a 80 letras.' using errcode = 'P0001';
      end if;
    end loop;
    new.votos := array_fill(0, array[cardinality(new.opcoes)]);
  else
    new.opcoes := null;
  end if;

  -- Publicar num clube: só quem participa dele
  if new.clube is not null and not v_sistema and not exists (select 1 from public.clube_membros m where m.clube = new.clube and m.usuario = new.autor) then
    raise exception 'Participe do clube para publicar nele.' using errcode = 'P0001';
  end if;

  -- Freio: 1 publicação a cada 20 segundos e no máximo 15 por hora
  if not v_sistema then
    if exists (select 1 from public.posts where autor = new.autor and criado_em > now() - interval '20 seconds') then
      raise exception 'Espere alguns segundos antes de publicar de novo.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.posts where autor = new.autor and criado_em > now() - interval '1 hour') >= 15 then
      raise exception 'Você atingiu o limite de publicações por hora. Tente mais tarde.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists posts_validar on public.posts;
create trigger posts_validar before insert or update on public.posts
  for each row execute function public._validar_post();

-- A ONG marca o pet como adotado (de preferência dizendo qual pedido deu certo)
create or replace function public.concluir_adocao(p_pet uuid, p_pedido uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_pet public.pets_adocao; v_org public.organizacoes; v_ped public.pedidos_adocao; v_post uuid; v_texto text;
begin
  select * into v_pet from public.pets_adocao where id = p_pet;
  select * into v_org from public.organizacoes where id = v_pet.org;
  if v_pet.id is null or v_org.dono is distinct from auth.uid() then raise exception 'Anúncio não encontrado.' using errcode = 'P0001'; end if;
  if v_org.status <> 'aprovada' then raise exception 'Sua organização não está aprovada no momento.' using errcode = 'P0001'; end if;
  if v_pet.status = 'adotado' then raise exception 'Este pet já está marcado como adotado.' using errcode = 'P0001'; end if;
  if p_pedido is not null then
    select * into v_ped from public.pedidos_adocao where id = p_pedido and pet = p_pet;
    if v_ped.id is null or v_ped.status <> 'aceito' then
      raise exception 'Escolha um pedido que você já aceitou.' using errcode = 'P0001';
    end if;
  end if;
  update public.pets_adocao set status = 'adotado', adotado_em = now() where id = p_pet;
  if v_ped.id is null then return null; end if;

  update public.pedidos_adocao set status = 'adotado', respondido_em = now() where id = v_ped.id;
  -- Os outros pedidos que ainda esperavam resposta são encerrados com carinho
  update public.pedidos_adocao set status = 'recusado', respondido_em = now() where pet = p_pet and status = 'enviado';

  v_texto := '🎉🐾 Mais um pet adotado pelo Abanô! ' || v_pet.nome || ' encontrou uma família e já está no novo lar. '
          || 'Obrigado, ' || v_org.nome || ', por todo o cuidado, e parabéns à nova família! 💛🏡✨';
  perform set_config('abano.post_sistema', '1', true);
  insert into public.posts (autor, tipo, texto, fotos, especial, pet_adocao)
  values (auth.uid(), case when cardinality(v_pet.fotos) > 0 then 'foto' else 'texto' end, v_texto,
          case when cardinality(v_pet.fotos) > 0 then array[v_pet.fotos[1]] end, 'adocao_abano', v_pet.id)
  returning id into v_post;
  perform set_config('abano.post_sistema', '0', true);
  return v_post;
end $$;
revoke all on function public.concluir_adocao(uuid, uuid) from public, anon;
grant execute on function public.concluir_adocao(uuid, uuid) to authenticated;

-- Quem adotou escolhe se quer compartilhar a novidade com a Comunidade
create or replace function public.compartilhar_adocao(p_pedido uuid, p_texto text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_ped public.pedidos_adocao; v_pet public.pets_adocao; v_texto text; v_post uuid;
begin
  select * into v_ped from public.pedidos_adocao where id = p_pedido and adotante = auth.uid();
  if v_ped.id is null or v_ped.status <> 'adotado' then raise exception 'Esta adoção ainda não foi concluída pela ONG.' using errcode = 'P0001'; end if;
  if v_ped.post_compartilhado is not null and exists (select 1 from public.posts where id = v_ped.post_compartilhado and not removido) then
    raise exception 'Você já compartilhou esta adoção.' using errcode = 'P0001';
  end if;
  select * into v_pet from public.pets_adocao where id = v_ped.pet;
  v_texto := nullif(btrim(coalesce(p_texto, '')), '');
  if v_texto is null then
    v_texto := '🏡💛 Hoje é dia de festa: ' || coalesce(v_pet.nome, 'meu novo pet') || ' chegou para fazer parte da família! Adotei pelo Abanô. Adotar é um ato de amor! 🐾🎉';
  end if;
  if char_length(v_texto) > 2000 then raise exception 'O texto pode ter até 2.000 letras.' using errcode = 'P0001'; end if;
  perform set_config('abano.post_sistema', '1', true);
  insert into public.posts (autor, tipo, texto, fotos, especial, pet_adocao)
  values (auth.uid(), case when cardinality(v_pet.fotos) > 0 then 'foto' else 'texto' end, v_texto,
          case when cardinality(v_pet.fotos) > 0 then array[v_pet.fotos[1]] end, 'adocao_tutor', v_pet.id)
  returning id into v_post;
  perform set_config('abano.post_sistema', '0', true);
  update public.pedidos_adocao set post_compartilhado = v_post where id = v_ped.id;
  return v_post;
end $$;
revoke all on function public.compartilhar_adocao(uuid, text) from public, anon;
grant execute on function public.compartilhar_adocao(uuid, text) to authenticated;

-- ---------- 4. Foto de perfil obrigatória para anunciar e para pedir adoção ----------
create or replace function public._exigir_foto_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.perfis where id = (to_jsonb(new) ->> tg_argv[0])::uuid and foto_url is not null) then
    raise exception 'Coloque uma foto sua no perfil antes de continuar. Ela traz mais segurança para a adoção.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pets_adocao_foto_perfil on public.pets_adocao;
create trigger pets_adocao_foto_perfil before insert on public.pets_adocao for each row execute function public._exigir_foto_perfil('autor');
drop trigger if exists pedidos_adocao_foto_perfil on public.pedidos_adocao;
create trigger pedidos_adocao_foto_perfil before insert on public.pedidos_adocao for each row execute function public._exigir_foto_perfil('adotante');

-- ---------- 5. Sininho: avisos de adoção ----------
alter table public.notificacoes add column if not exists pedido uuid references public.pedidos_adocao (id) on delete cascade;
alter table public.notificacoes add column if not exists pet_nome text;
do $$
declare r record;
begin
  for r in select con.conname from pg_constraint con
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
           where con.conrelid = 'public.notificacoes'::regclass and con.contype = 'c' and att.attname = 'tipo'
  loop execute format('alter table public.notificacoes drop constraint %I', r.conname); end loop;
end $$;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('curtida', 'comentario', 'resposta', 'curtida_comentario', 'seguidor', 'pedido_adocao', 'pedido_aceito', 'adocao_concluida'));

create or replace function public._notificar_pedido(p_para uuid, p_de uuid, p_tipo text, p_pedido uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_para is null or p_de is null or p_para = p_de then return; end if;
  insert into public.notificacoes (para, de, tipo, pedido, pet_nome)
  values (p_para, p_de, p_tipo, p_pedido,
          (select p.nome from public.pedidos_adocao pa join public.pets_adocao p on p.id = pa.pet where pa.id = p_pedido));
exception when others then
  raise warning 'Abanô: aviso de adoção não criado: %', sqlerrm;
end $$;
revoke all on function public._notificar_pedido(uuid, uuid, text, uuid) from public, anon, authenticated;

create or replace function public._aviso_pedido_sininho() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dono uuid;
begin
  select dono into v_dono from public.organizacoes where id = new.org;
  if tg_op = 'INSERT' then
    perform public._notificar_pedido(v_dono, new.adotante, 'pedido_adocao', new.id);
  elsif new.status is distinct from old.status then
    if new.status = 'aceito' then perform public._notificar_pedido(new.adotante, v_dono, 'pedido_aceito', new.id); end if;
    if new.status = 'adotado' then perform public._notificar_pedido(new.adotante, v_dono, 'adocao_concluida', new.id); end if;
  end if;
  return null;
end $$;
drop trigger if exists pedidos_adocao_sininho on public.pedidos_adocao;
create trigger pedidos_adocao_sininho after insert or update of status on public.pedidos_adocao
  for each row execute function public._aviso_pedido_sininho();

drop function if exists public.minhas_notificacoes(int);
create function public.minhas_notificacoes(p_limite int default 60)
returns table (id bigint, tipo text, lida boolean, criado_em timestamptz, post uuid, comentario uuid,
               de uuid, de_nome text, de_usuario text, de_foto text, trecho_post text, trecho_comentario text,
               pedido uuid, pet_nome text, org_nome text)
language sql stable security definer set search_path = public as $$
  select n.id, n.tipo, n.lida, n.criado_em, n.post, n.comentario,
         n.de, pf.nome, pf.usuario, pf.foto_url,
         left(coalesce(nullif(p.texto, ''), case p.tipo when 'foto' then 'sua foto' when 'video' then 'seu vídeo' when 'enquete' then 'sua enquete' else 'sua publicação' end), 90),
         left(c.texto, 90),
         n.pedido, n.pet_nome,
         (select o.nome from public.organizacoes o where o.dono = n.de)
    from public.notificacoes n
    join public.perfis pf on pf.id = n.de
    left join public.posts p on p.id = n.post
    left join public.comentarios c on c.id = n.comentario
   where n.para = auth.uid() and public.perfil_ativo(n.de)
   order by n.criado_em desc
   limit least(coalesce(p_limite, 60), 200);
$$;
revoke all on function public.minhas_notificacoes(int) from public, anon;
grant execute on function public.minhas_notificacoes(int) to authenticated;

-- O número do sininho soma os avisos e as mensagens não lidas
create or replace function public.notificacoes_nao_lidas() returns int
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.notificacoes where para = auth.uid() and not lida)
       + public.mensagens_nao_lidas();
$$;
revoke all on function public.notificacoes_nao_lidas() from public, anon;
grant execute on function public.notificacoes_nao_lidas() to authenticated;

-- ---------- 6. Alertas de pet desaparecido: peixe também ----------
do $$
declare r record;
begin
  for r in select con.conname from pg_constraint con
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
           where con.conrelid = 'public.alertas_pets'::regclass and con.contype = 'c' and att.attname = 'especie'
  loop execute format('alter table public.alertas_pets drop constraint %I', r.conname); end loop;
end $$;
alter table public.alertas_pets add constraint alertas_pets_especie_check
  check (especie in ('cachorro', 'gato', 'ave', 'pequeno_mamifero', 'reptil', 'peixe', 'outro'));

notify pgrst, 'reload schema';

-- Conferência: deve listar 5 itens com "ok"
select 'clubes novos' as item, case when (select count(*) from public.clubes where id in ('shih-tzu', 'border-collie', 'pug', 'bulldog-frances')) = 4
         and not exists (select 1 from public.clubes where id = 'labradores') then 'ok' else 'FALTA' end as status
union all select 'conversas', case when to_regclass('public.mensagens') is not null then 'ok' else 'FALTA' end
union all select 'adoção concluída', case when exists (select 1 from pg_proc where proname = 'compartilhar_adocao') then 'ok' else 'FALTA' end
union all select 'avisos de adoção', case when exists (select 1 from pg_trigger where tgname = 'pedidos_adocao_sininho') then 'ok' else 'FALTA' end
union all select 'foto obrigatória', case when exists (select 1 from pg_trigger where tgname = 'pedidos_adocao_foto_perfil') then 'ok' else 'FALTA' end;
