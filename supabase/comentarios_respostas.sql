-- =========================================================
-- Abanô — Curtir comentários e responder comentários (respostas
-- num nível só, como no Facebook: responder uma resposta continua
-- na mesma conversa).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- comunidade.sql e moderacao.sql. Não apaga nenhum comentário.
-- =========================================================

-- ---------- 1. Respostas ----------
alter table public.comentarios add column if not exists resposta_a uuid references public.comentarios (id) on delete cascade;
alter table public.comentarios add column if not exists total_curtidas int not null default 0;
create index if not exists comentarios_resposta on public.comentarios (resposta_a) where resposta_a is not null;
grant insert (resposta_a) on public.comentarios to authenticated;

-- A resposta precisa ser da mesma publicação; resposta de resposta vai para a conversa de cima
create or replace function public._validar_resposta() returns trigger
language plpgsql security definer set search_path = public as $$
declare pai record;
begin
  if new.resposta_a is null then return new; end if;
  select id, post, resposta_a, removido into pai from public.comentarios where id = new.resposta_a;
  if pai.id is null or pai.removido or pai.post <> new.post then
    raise exception 'Esse comentário não está mais disponível.' using errcode = 'P0001';
  end if;
  if pai.resposta_a is not null then new.resposta_a := pai.resposta_a; end if;
  new.total_curtidas := 0;
  return new;
end $$;
drop trigger if exists comentarios_validar_resposta on public.comentarios;
create trigger comentarios_validar_resposta before insert on public.comentarios
  for each row execute function public._validar_resposta();

-- ---------- 2. Curtidas de comentários (cada um só vê as próprias) ----------
create table if not exists public.curtidas_comentarios (
  comentario  uuid not null references public.comentarios (id) on delete cascade,
  usuario     uuid not null references public.perfis (id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (comentario, usuario)
);
create index if not exists curtidas_comentarios_usuario on public.curtidas_comentarios (usuario);
alter table public.curtidas_comentarios enable row level security;
drop policy if exists "curtidas de comentario proprias" on public.curtidas_comentarios;
create policy "curtidas de comentario proprias" on public.curtidas_comentarios for select to authenticated using (usuario = auth.uid());
drop policy if exists "curtir comentario" on public.curtidas_comentarios;
create policy "curtir comentario" on public.curtidas_comentarios for insert to authenticated
  with check (usuario = auth.uid() and public.perfil_ativo(auth.uid())
              and exists (select 1 from public.comentarios c where c.id = comentario and not c.removido));
drop policy if exists "descurtir comentario" on public.curtidas_comentarios;
create policy "descurtir comentario" on public.curtidas_comentarios for delete to authenticated using (usuario = auth.uid());
revoke all on public.curtidas_comentarios from anon, authenticated;
grant select, delete on public.curtidas_comentarios to authenticated;
grant insert (comentario, usuario) on public.curtidas_comentarios to authenticated;

create or replace function public._contar_curtidas_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.comentarios set total_curtidas = total_curtidas + 1 where id = new.comentario;
  else update public.comentarios set total_curtidas = greatest(total_curtidas - 1, 0) where id = old.comentario; end if;
  return null;
end $$;
drop trigger if exists curtidas_comentarios_contar on public.curtidas_comentarios;
create trigger curtidas_comentarios_contar after insert or delete on public.curtidas_comentarios
  for each row execute function public._contar_curtidas_comentario();
drop trigger if exists a_trava_curtidas_comentarios on public.curtidas_comentarios;
create trigger a_trava_curtidas_comentarios before insert on public.curtidas_comentarios
  for each row execute function public._trava_por_pessoa('usuario');

notify pgrst, 'reload schema';
