-- =========================================================
-- Abanô — Parceiros em destaque (veterinários, hospedagem,
-- adestramento, pet shop, banho e tosa) e avaliações dos tutores
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql, comunidade.sql e moderacao.sql.
-- Não cria nenhum parceiro nem avaliação de exemplo.
--
-- Como funciona: o negócio pede pela página "Divulgue no Abanô",
-- você combina o valor fora do site e cadastra o parceiro no painel
-- de administração (aba Parceiros) com a data "destaque até".
-- Quando a data passa, o parceiro some das páginas sozinho.
-- =========================================================

-- ---------- 1. Parceiros (só a administração cadastra e edita) ----------
create table if not exists public.parceiros (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(btrim(nome)) between 2 and 80),
  categoria      text not null check (categoria in ('veterinario', 'hospedagem', 'adestramento', 'petshop', 'banho_tosa')),
  descricao      text check (char_length(descricao) <= 500),
  cidade         text not null check (char_length(btrim(cidade)) between 2 and 80),
  estado         text not null check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  endereco       text check (char_length(endereco) <= 160),
  whatsapp       text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  instagram      text check (char_length(instagram) <= 60),
  site           text check (site is null or (char_length(site) <= 200 and site ~* '^https://')),
  foto_url       text check (foto_url is null or foto_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/fotos/'),
  atende_24h     boolean not null default false,
  destaque_ate   date not null,
  status         text not null default 'ativo' check (status in ('ativo', 'pausado')),
  observacao     text check (char_length(observacao) <= 300),   -- anotação interna (pagamento, contato); nunca é pública
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists parceiros_busca on public.parceiros (categoria, estado, destaque_ate);
alter table public.parceiros enable row level security;

drop policy if exists "parceiros visiveis" on public.parceiros;
create policy "parceiros visiveis" on public.parceiros for select to anon, authenticated
  using ((status = 'ativo' and destaque_ate >= current_date) or public.eh_admin());
drop policy if exists "admin cadastra parceiro" on public.parceiros;
create policy "admin cadastra parceiro" on public.parceiros for insert to authenticated with check (public.eh_admin());
drop policy if exists "admin edita parceiro" on public.parceiros;
create policy "admin edita parceiro" on public.parceiros for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
drop policy if exists "admin apaga parceiro" on public.parceiros;
create policy "admin apaga parceiro" on public.parceiros for delete to authenticated using (public.eh_admin());

-- A anotação interna não sai para o público: só a administração lê (pela função parceiros_admin)
revoke all on public.parceiros from anon, authenticated;
grant select (id, nome, categoria, descricao, cidade, estado, endereco, whatsapp, instagram, site, foto_url, atende_24h, destaque_ate, status, criado_em)
  on public.parceiros to anon, authenticated;
grant insert, update, delete on public.parceiros to authenticated;

create or replace function public._validar_parceiro() returns trigger
language plpgsql set search_path = public as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.cidade := btrim(new.cidade);
  new.descricao := nullif(btrim(new.descricao), '');
  new.endereco := nullif(btrim(new.endereco), '');
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'), '');
  new.instagram := nullif(btrim(new.instagram), '');
  new.site := nullif(btrim(new.site), '');
  new.observacao := nullif(btrim(new.observacao), '');
  new.atualizado_em := now();
  if tg_op = 'INSERT' then new.criado_em := now(); end if;
  return new;
end $$;
drop trigger if exists parceiros_validar on public.parceiros;
create trigger parceiros_validar before insert or update on public.parceiros
  for each row execute function public._validar_parceiro();

-- ---------- 2. Avaliações dos tutores (uma por pessoa e parceiro) ----------
create table if not exists public.avaliacoes_parceiros (
  id          uuid primary key default gen_random_uuid(),
  parceiro    uuid not null references public.parceiros (id) on delete cascade,
  autor       uuid not null references public.perfis (id) on delete cascade,
  nota        smallint not null check (nota between 1 and 5),
  comentario  text check (char_length(comentario) <= 500),
  oculta      boolean not null default false,
  criado_em   timestamptz not null default now(),
  unique (parceiro, autor)
);
create index if not exists avaliacoes_parceiro_idx on public.avaliacoes_parceiros (parceiro, criado_em desc);
alter table public.avaliacoes_parceiros enable row level security;

drop policy if exists "avaliacoes visiveis" on public.avaliacoes_parceiros;
create policy "avaliacoes visiveis" on public.avaliacoes_parceiros for select to anon, authenticated
  using (not oculta or autor = auth.uid() or public.eh_admin());
drop policy if exists "tutor avalia" on public.avaliacoes_parceiros;
create policy "tutor avalia" on public.avaliacoes_parceiros for insert to authenticated
  with check (autor = auth.uid() and public.perfil_ativo(auth.uid())
              and exists (select 1 from public.parceiros p where p.id = parceiro and p.status = 'ativo' and p.destaque_ate >= current_date));
drop policy if exists "tutor muda a propria avaliacao" on public.avaliacoes_parceiros;
create policy "tutor muda a propria avaliacao" on public.avaliacoes_parceiros for update to authenticated
  using (autor = auth.uid()) with check (autor = auth.uid());
drop policy if exists "apagar avaliacao" on public.avaliacoes_parceiros;
create policy "apagar avaliacao" on public.avaliacoes_parceiros for delete to authenticated
  using (autor = auth.uid() or public.eh_admin());

revoke all on public.avaliacoes_parceiros from anon, authenticated;
grant select (id, parceiro, autor, nota, comentario, oculta, criado_em) on public.avaliacoes_parceiros to anon, authenticated;
grant insert (parceiro, autor, nota, comentario) on public.avaliacoes_parceiros to authenticated;
grant update (nota, comentario) on public.avaliacoes_parceiros to authenticated;
grant delete on public.avaliacoes_parceiros to authenticated;

create or replace function public._validar_avaliacao() returns trigger
language plpgsql set search_path = public as $$
begin
  new.comentario := nullif(btrim(new.comentario), '');
  if new.comentario ~* '(https?://|www\.)' then
    raise exception 'A avaliação não pode ter links.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then new.criado_em := now(); new.oculta := false; end if;
  return new;
end $$;
drop trigger if exists avaliacoes_validar on public.avaliacoes_parceiros;
create trigger avaliacoes_validar before insert or update on public.avaliacoes_parceiros
  for each row execute function public._validar_avaliacao();

-- ---------- 3. Leitura pública: parceiros com a média das avaliações ----------
-- Primeiro os do estado escolhido; depois os de nota maior.
create or replace function public.parceiros_destaque(p_categoria text, p_estado text default null)
returns table (id uuid, nome text, categoria text, descricao text, cidade text, estado text, endereco text,
               whatsapp text, instagram text, site text, foto_url text, atende_24h boolean, media numeric, total int)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.categoria, p.descricao, p.cidade, p.estado, p.endereco,
         p.whatsapp, p.instagram, p.site, p.foto_url, p.atende_24h,
         round(avg(a.nota)::numeric, 1), count(a.id)::int
    from public.parceiros p
    left join public.avaliacoes_parceiros a on a.parceiro = p.id and not a.oculta
   where p.categoria = p_categoria and p.status = 'ativo' and p.destaque_ate >= current_date
   group by p.id
   order by (p.estado = coalesce(p_estado, '')) desc, avg(a.nota) desc nulls last, p.criado_em
   limit 30;
$$;
revoke all on function public.parceiros_destaque(text, text) from public;
grant execute on function public.parceiros_destaque(text, text) to anon, authenticated;

-- Avaliações de um parceiro, com o nome de quem avaliou (sem e-mail nem dados privados)
create or replace function public.avaliacoes_do_parceiro(p_parceiro uuid)
returns table (id uuid, autor uuid, nome text, usuario text, foto_url text, nota smallint, comentario text, criado_em timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.autor, pf.nome, pf.usuario, pf.foto_url, a.nota, a.comentario, a.criado_em
    from public.avaliacoes_parceiros a
    join public.perfis pf on pf.id = a.autor
   where a.parceiro = p_parceiro and not a.oculta
   order by a.criado_em desc
   limit 50;
$$;
revoke all on function public.avaliacoes_do_parceiro(uuid) from public;
grant execute on function public.avaliacoes_do_parceiro(uuid) to anon, authenticated;

-- ---------- 4. Administração ----------
create or replace function public.parceiros_admin()
returns setof public.parceiros
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração.' using errcode = '42501'; end if;
  return query select * from public.parceiros order by destaque_ate desc, nome;
end $$;
revoke all on function public.parceiros_admin() from public, anon;
grant execute on function public.parceiros_admin() to authenticated;

create or replace function public.avaliacoes_admin()
returns table (id uuid, parceiro text, autor text, nota smallint, comentario text, oculta boolean, criado_em timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração.' using errcode = '42501'; end if;
  return query
    select a.id, p.nome, '@' || pf.usuario, a.nota, a.comentario, a.oculta, a.criado_em
      from public.avaliacoes_parceiros a
      join public.parceiros p on p.id = a.parceiro
      join public.perfis pf on pf.id = a.autor
     order by a.criado_em desc limit 200;
end $$;
revoke all on function public.avaliacoes_admin() from public, anon;
grant execute on function public.avaliacoes_admin() to authenticated;

create or replace function public.ocultar_avaliacao(p_id uuid, p_ocultar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração.' using errcode = '42501'; end if;
  update public.avaliacoes_parceiros set oculta = p_ocultar where id = p_id;
end $$;
revoke all on function public.ocultar_avaliacao(uuid, boolean) from public, anon;
grant execute on function public.ocultar_avaliacao(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
