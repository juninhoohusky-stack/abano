-- =========================================================
-- Abanô — Comunidade: publicações, comentários, curtidas,
-- salvos, enquetes, seguidores, clubes e eventos
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes: contas.sql.
-- Não cria nenhuma publicação: a comunidade começa vazia, de verdade.
-- =========================================================

-- Visitantes sem login também passam pela checagem de administrador (que responde "não")
grant execute on function public.eh_admin() to anon;

-- ---------- 1. Clubes ----------
create table if not exists public.clubes (
  id             text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  nome           text not null,
  descricao      text not null,
  tipo           text not null check (tipo in ('raca', 'especie', 'local')),
  ordem          int not null default 100,
  total_membros  int not null default 0,
  criado_em      timestamptz not null default now()
);
alter table public.clubes enable row level security;
drop policy if exists "clubes visiveis" on public.clubes;
create policy "clubes visiveis" on public.clubes for select to anon, authenticated using (true);
revoke all on public.clubes from anon, authenticated;
grant select on public.clubes to anon, authenticated;

-- Os clubes iniciais (só nome e descrição: nenhum membro ou publicação inventada)
insert into public.clubes (id, nome, descricao, tipo, ordem) values
  ('huskies',     'Huskies',            'Tutores de Husky Siberiano: pelagem, energia, uivos e passeios no calor do Brasil.', 'raca', 10),
  ('golden',      'Golden Retrievers',  'Tutores de Golden: rotina, adestramento, saúde e muita foto.', 'raca', 20),
  ('spitz',       'Spitz Alemão',       'Lulus e Spitz de todos os tamanhos: tosa, cuidados e dicas do dia a dia.', 'raca', 30),
  ('shih-tzu',    'Shih Tzu',           'Tutores de Shih Tzu: tosa, pelagem, rotina e muitas fotos para compartilhar.', 'raca', 40),
  ('border-collie', 'Border Collie',    'Tutores de Border Collie: energia, brincadeiras, passeios e experiências do dia a dia.', 'raca', 42),
  ('pug',         'Pug',                'Tutores de Pug: rotina, passeios nos dias quentes e muitas fotos para compartilhar.', 'raca', 44),
  ('bulldog-frances', 'Bulldog Francês', 'Tutores de Bulldog Francês: rotina, passeios nos dias quentes e experiências do dia a dia.', 'raca', 46),
  ('gatos',       'Gatos',              'Para quem divide a casa com gatos: comportamento, rotina, enriquecimento e muitas fotos.', 'especie', 50),
  ('tutores-rj',  'Tutores do RJ',      'Tutores do Rio de Janeiro: passeios, eventos, encontros e conexão com quem está perto.', 'local', 60),
  ('tutores-sp',  'Tutores de SP',      'Tutores de São Paulo: passeios, eventos, encontros e conexão com quem está perto.', 'local', 70)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, tipo = excluded.tipo, ordem = excluded.ordem;

create table if not exists public.clube_membros (
  clube      text not null references public.clubes (id) on delete cascade,
  usuario    uuid not null references public.perfis (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (clube, usuario)
);
create index if not exists clube_membros_usuario on public.clube_membros (usuario);
alter table public.clube_membros enable row level security;
drop policy if exists "membros visiveis" on public.clube_membros;
create policy "membros visiveis" on public.clube_membros for select to anon, authenticated using (true);
drop policy if exists "entrar no clube" on public.clube_membros;
create policy "entrar no clube" on public.clube_membros for insert to authenticated
  with check (usuario = auth.uid() and public.perfil_ativo(auth.uid()));
drop policy if exists "sair do clube" on public.clube_membros;
create policy "sair do clube" on public.clube_membros for delete to authenticated using (usuario = auth.uid());
revoke all on public.clube_membros from anon, authenticated;
grant select on public.clube_membros to anon, authenticated;
grant insert (clube, usuario), delete on public.clube_membros to authenticated;

create or replace function public._contar_membros() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.clubes set total_membros = total_membros + 1 where id = new.clube;
  else update public.clubes set total_membros = greatest(total_membros - 1, 0) where id = old.clube; end if;
  return null;
end $$;
drop trigger if exists clube_membros_contar on public.clube_membros;
create trigger clube_membros_contar after insert or delete on public.clube_membros
  for each row execute function public._contar_membros();

-- ---------- 2. Publicações ----------
create table if not exists public.posts (
  id                 uuid primary key default gen_random_uuid(),
  autor              uuid not null references public.perfis (id) on delete cascade,
  tipo               text not null check (tipo in ('texto', 'foto', 'video', 'pergunta', 'enquete')),
  texto              text check (char_length(texto) <= 5000),
  fotos              text[],
  video_url          text check (video_url is null or (char_length(video_url) <= 300 and video_url ~* '^https://([a-z0-9-]+\.)?(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)/')),
  clube              text references public.clubes (id) on delete set null,
  opcoes             text[],
  votos              int[],
  total_votos        int not null default 0,
  total_curtidas     int not null default 0,
  total_comentarios  int not null default 0,
  removido           boolean not null default false,
  criado_em          timestamptz not null default now(),
  editado_em         timestamptz
);
create index if not exists posts_recentes on public.posts (criado_em desc) where not removido;
create index if not exists posts_autor on public.posts (autor, criado_em desc);
create index if not exists posts_clube on public.posts (clube, criado_em desc);
create index if not exists posts_tipo on public.posts (tipo, criado_em desc);

alter table public.posts enable row level security;
drop policy if exists "posts visiveis" on public.posts;
create policy "posts visiveis" on public.posts for select to anon, authenticated
  using (not removido or autor = auth.uid() or public.eh_admin());
drop policy if exists "publicar" on public.posts;
create policy "publicar" on public.posts for insert to authenticated
  with check (autor = auth.uid() and public.perfil_ativo(auth.uid()));
drop policy if exists "editar a propria publicacao" on public.posts;
create policy "editar a propria publicacao" on public.posts for update to authenticated
  using (autor = auth.uid()) with check (autor = auth.uid());
drop policy if exists "apagar a propria publicacao" on public.posts;
create policy "apagar a propria publicacao" on public.posts for delete to authenticated
  using (autor = auth.uid() or public.eh_admin());
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert (autor, tipo, texto, fotos, video_url, clube, opcoes) on public.posts to authenticated;
grant update (texto) on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- Regra da comunidade: nada de venda de animais (vale para publicações e comentários)
create or replace function public.parece_venda_de_animal(p_texto text) returns boolean
language sql immutable as $$
  -- Só anúncios explícitos: "vende-se", "à venda" ou "vendo filhote/cachorro/gato...".
  -- Frases como "estou vendo meu cachorro" ou "qual o preço da ração" passam normalmente.
  select coalesce(p_texto, '') ~* '(filhote|ninhada|cachorr|cadel|\mgat[oa]s?\M|gatinh|husky|huskies|golden|spitz|lulu|labrador|\mpets?\M|\mc[ãa]es\M|\mc[ãa]o\M)'
     and coalesce(p_texto, '') ~* '(\mvende-se\M|\mvendem-se\M|[àa] venda\M|\mvendo ([0-9]+ )?(filhote|ninhada|cachorrinh|gatinh))';
$$;
grant execute on function public.parece_venda_de_animal(text) to anon, authenticated;

-- Regras de cada publicação + freio contra spam
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

-- ---------- 3. Comentários (e respostas das perguntas) ----------
create table if not exists public.comentarios (
  id         uuid primary key default gen_random_uuid(),
  post       uuid not null references public.posts (id) on delete cascade,
  autor      uuid not null references public.perfis (id) on delete cascade,
  texto      text not null check (char_length(btrim(texto)) between 1 and 2000),
  removido   boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists comentarios_post on public.comentarios (post, criado_em);
alter table public.comentarios enable row level security;
drop policy if exists "comentarios visiveis" on public.comentarios;
create policy "comentarios visiveis" on public.comentarios for select to anon, authenticated
  using (not removido or autor = auth.uid() or public.eh_admin());
drop policy if exists "comentar" on public.comentarios;
create policy "comentar" on public.comentarios for insert to authenticated
  with check (autor = auth.uid() and public.perfil_ativo(auth.uid()));
drop policy if exists "apagar comentario" on public.comentarios;
create policy "apagar comentario" on public.comentarios for delete to authenticated
  using (autor = auth.uid() or public.eh_admin()
         or exists (select 1 from public.posts p where p.id = post and p.autor = auth.uid()));
revoke all on public.comentarios from anon, authenticated;
grant select on public.comentarios to anon, authenticated;
grant insert (post, autor, texto) on public.comentarios to authenticated;
grant delete on public.comentarios to authenticated;

create or replace function public._validar_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.texto := btrim(new.texto); new.removido := false; new.criado_em := now();
  if public.parece_venda_de_animal(new.texto) then
    raise exception 'Venda de animais não é permitida na Comunidade Abanô.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.posts where id = new.post and not removido) then
    raise exception 'Essa publicação não está mais disponível.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.comentarios where autor = new.autor and criado_em > now() - interval '5 seconds') then
    raise exception 'Espere alguns segundos antes de comentar de novo.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.comentarios where autor = new.autor and criado_em > now() - interval '1 hour') >= 60 then
    raise exception 'Você atingiu o limite de comentários por hora. Tente mais tarde.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists comentarios_validar on public.comentarios;
create trigger comentarios_validar before insert on public.comentarios
  for each row execute function public._validar_comentario();

create or replace function public._contar_comentarios() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.posts set total_comentarios = total_comentarios + 1 where id = new.post;
  else update public.posts set total_comentarios = greatest(total_comentarios - 1, 0) where id = old.post; end if;
  return null;
end $$;
drop trigger if exists comentarios_contar on public.comentarios;
create trigger comentarios_contar after insert or delete on public.comentarios
  for each row execute function public._contar_comentarios();

-- ---------- 4. Curtidas e salvos (cada um só vê os próprios) ----------
create table if not exists public.curtidas (
  post       uuid not null references public.posts (id) on delete cascade,
  usuario    uuid not null references public.perfis (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (post, usuario)
);
create index if not exists curtidas_usuario on public.curtidas (usuario);
alter table public.curtidas enable row level security;
drop policy if exists "curtidas proprias" on public.curtidas;
create policy "curtidas proprias" on public.curtidas for select to authenticated using (usuario = auth.uid());
drop policy if exists "curtir" on public.curtidas;
create policy "curtir" on public.curtidas for insert to authenticated with check (usuario = auth.uid() and public.perfil_ativo(auth.uid()));
drop policy if exists "descurtir" on public.curtidas;
create policy "descurtir" on public.curtidas for delete to authenticated using (usuario = auth.uid());
revoke all on public.curtidas from anon, authenticated;
grant select, delete on public.curtidas to authenticated;
grant insert (post, usuario) on public.curtidas to authenticated;

create or replace function public._contar_curtidas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.posts set total_curtidas = total_curtidas + 1 where id = new.post;
  else update public.posts set total_curtidas = greatest(total_curtidas - 1, 0) where id = old.post; end if;
  return null;
end $$;
drop trigger if exists curtidas_contar on public.curtidas;
create trigger curtidas_contar after insert or delete on public.curtidas
  for each row execute function public._contar_curtidas();

create table if not exists public.salvos (
  post       uuid not null references public.posts (id) on delete cascade,
  usuario    uuid not null references public.perfis (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (post, usuario)
);
create index if not exists salvos_usuario on public.salvos (usuario, criado_em desc);
alter table public.salvos enable row level security;
drop policy if exists "salvos proprios" on public.salvos;
create policy "salvos proprios" on public.salvos for all to authenticated
  using (usuario = auth.uid()) with check (usuario = auth.uid());
revoke all on public.salvos from anon, authenticated;
grant select, delete on public.salvos to authenticated;
grant insert (post, usuario) on public.salvos to authenticated;

-- ---------- 5. Votos das enquetes (voto secreto: cada um vê só o seu) ----------
create table if not exists public.enquete_votos (
  post       uuid not null references public.posts (id) on delete cascade,
  usuario    uuid not null references public.perfis (id) on delete cascade,
  opcao      smallint not null check (opcao between 0 and 3),
  criado_em  timestamptz not null default now(),
  primary key (post, usuario)
);
alter table public.enquete_votos enable row level security;
drop policy if exists "votos proprios" on public.enquete_votos;
create policy "votos proprios" on public.enquete_votos for select to authenticated using (usuario = auth.uid());
drop policy if exists "votar" on public.enquete_votos;
create policy "votar" on public.enquete_votos for insert to authenticated with check (usuario = auth.uid() and public.perfil_ativo(auth.uid()));
revoke all on public.enquete_votos from anon, authenticated;
grant select on public.enquete_votos to authenticated;
grant insert (post, usuario, opcao) on public.enquete_votos to authenticated;

create or replace function public._registrar_voto() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  select cardinality(opcoes) into v_n from public.posts where id = new.post and tipo = 'enquete' and not removido;
  if v_n is null or new.opcao >= v_n then raise exception 'Opção inválida.' using errcode = 'P0001'; end if;
  update public.posts set votos[new.opcao + 1] = votos[new.opcao + 1] + 1, total_votos = total_votos + 1 where id = new.post;
  return new;
end $$;
drop trigger if exists enquete_votos_registrar on public.enquete_votos;
create trigger enquete_votos_registrar before insert on public.enquete_votos
  for each row execute function public._registrar_voto();

-- ---------- 6. Seguidores ----------
create table if not exists public.seguidores (
  seguidor   uuid not null references public.perfis (id) on delete cascade,
  seguido    uuid not null references public.perfis (id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (seguidor, seguido),
  check (seguidor <> seguido)
);
create index if not exists seguidores_seguido on public.seguidores (seguido);
alter table public.seguidores enable row level security;
drop policy if exists "seguidores visiveis" on public.seguidores;
create policy "seguidores visiveis" on public.seguidores for select to anon, authenticated using (true);
drop policy if exists "seguir" on public.seguidores;
create policy "seguir" on public.seguidores for insert to authenticated
  with check (seguidor = auth.uid() and public.perfil_ativo(auth.uid()) and public.perfil_ativo(seguido));
drop policy if exists "deixar de seguir" on public.seguidores;
create policy "deixar de seguir" on public.seguidores for delete to authenticated using (seguidor = auth.uid());
revoke all on public.seguidores from anon, authenticated;
grant select on public.seguidores to anon, authenticated;
grant insert (seguidor, seguido), delete on public.seguidores to authenticated;

-- ---------- 7. Eventos (só a administração cadastra) ----------
create table if not exists public.eventos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (char_length(titulo) between 3 and 120),
  descricao    text check (char_length(descricao) <= 2000),
  inicio       timestamptz not null,
  local        text check (char_length(local) <= 160),
  cidade       text check (char_length(cidade) <= 80),
  estado       text,
  link         text check (link is null or link ~* '^https://'),
  clube        text references public.clubes (id) on delete set null,
  criado_em    timestamptz not null default now()
);
create index if not exists eventos_inicio on public.eventos (inicio);
alter table public.eventos enable row level security;
drop policy if exists "eventos visiveis" on public.eventos;
create policy "eventos visiveis" on public.eventos for select to anon, authenticated using (true);
drop policy if exists "admins cuidam dos eventos" on public.eventos;
create policy "admins cuidam dos eventos" on public.eventos for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());
revoke all on public.eventos from anon, authenticated;
grant select on public.eventos to anon, authenticated;
grant insert, update, delete on public.eventos to authenticated;

-- ---------- 8. Feeds ----------
-- "Para você": publicações recentes com mais conversa sobem; clubes que a pessoa participa ganham peso.
create or replace function public.feed_para_voce(p_offset int default 0, p_limite int default 20)
returns setof public.posts
language sql stable security invoker set search_path = public as $$
  select p.* from public.posts p
   where not p.removido and p.criado_em > now() - interval '60 days'
   order by
     ((1 + p.total_curtidas + 2 * p.total_comentarios + p.total_votos * 0.5)
       * case when p.clube is not null and exists (select 1 from public.clube_membros m where m.clube = p.clube and m.usuario = auth.uid()) then 1.6 else 1 end
       * case when exists (select 1 from public.seguidores s where s.seguidor = auth.uid() and s.seguido = p.autor) then 1.6 else 1 end)
     / power(extract(epoch from (now() - p.criado_em)) / 3600 + 2, 1.3) desc,
     p.criado_em desc
   offset greatest(p_offset, 0) limit least(greatest(p_limite, 1), 50);
$$;
grant execute on function public.feed_para_voce(int, int) to anon, authenticated;

-- "Seguindo": publicações de quem a pessoa segue, das mais novas para as mais antigas
create or replace function public.feed_seguindo(p_antes timestamptz default null, p_limite int default 20)
returns setof public.posts
language sql stable security invoker set search_path = public as $$
  select p.* from public.posts p
   where not p.removido
     and p.autor in (select s.seguido from public.seguidores s where s.seguidor = auth.uid())
     and (p_antes is null or p.criado_em < p_antes)
   order by p.criado_em desc
   limit least(greatest(p_limite, 1), 50);
$$;
revoke all on function public.feed_seguindo(timestamptz, int) from public, anon;
grant execute on function public.feed_seguindo(timestamptz, int) to authenticated;

notify pgrst, 'reload schema';

-- Conferência: deve listar 6 itens com "ok"
select 'clubes' as item, case when (select count(*) from public.clubes) >= 7 then 'ok' else 'FALTA' end as status
union all select 'publicações', case when to_regclass('public.posts') is not null then 'ok' else 'FALTA' end
union all select 'comentários', case when to_regclass('public.comentarios') is not null then 'ok' else 'FALTA' end
union all select 'curtidas e salvos', case when to_regclass('public.curtidas') is not null and to_regclass('public.salvos') is not null then 'ok' else 'FALTA' end
union all select 'enquetes e seguidores', case when to_regclass('public.enquete_votos') is not null and to_regclass('public.seguidores') is not null then 'ok' else 'FALTA' end
union all select 'feeds', case when exists (select 1 from pg_proc where proname = 'feed_para_voce') then 'ok' else 'FALTA' end;
