-- =========================================================
-- Abanô — Pet desaparecido: alertas de pet perdido ou encontrado,
-- com foto, onde e quando foi visto, cartaz para compartilhar e
-- contato pelo WhatsApp (só se o autor autorizar) ou pelo perfil.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql, comunidade.sql, moderacao.sql e pets_especies.sql.
-- Não cria nenhum alerta de exemplo.
-- =========================================================

-- A função tem_valor_em_reais vem do adocao.sql; se ele ainda não rodou, cria aqui
create or replace function public.tem_valor_em_reais(p_texto text) returns boolean
language sql immutable as $$
  select coalesce(p_texto, '') ~* '(r\$ ?[0-9]|[0-9]+ ?(reais|real)\M|[0-9]+,[0-9]{2})';
$$;
grant execute on function public.tem_valor_em_reais(text) to anon, authenticated;

-- ---------- 1. Alertas ----------
create table if not exists public.alertas_pets (
  id             uuid primary key default gen_random_uuid(),
  autor          uuid not null references public.perfis (id) on delete cascade,
  tipo           text not null check (tipo in ('perdido', 'encontrado')),
  pet            uuid references public.pets (id) on delete set null,      -- quando é um pet do próprio perfil
  nome           text check (char_length(btrim(nome)) between 1 and 40),     -- no "encontrado" pode ficar vazio
  especie        text not null check (especie in ('cachorro', 'gato', 'ave', 'pequeno_mamifero', 'reptil', 'outro')),
  raca           text check (char_length(raca) <= 60),
  sexo           text check (sexo in ('macho', 'femea')),
  porte          text check (porte in ('pequeno', 'medio', 'grande')),
  descricao      text not null check (char_length(btrim(descricao)) between 10 and 700),  -- cor, coleira, sinais, comportamento
  foto_url       text not null,
  cidade         text not null check (char_length(btrim(cidade)) between 2 and 80),
  estado         text not null check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  bairro         text not null check (char_length(btrim(bairro)) between 2 and 80),
  referencia     text check (char_length(referencia) <= 160),
  quando         date not null,
  whatsapp       text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),  -- só aparece se o autor quiser
  status         text not null default 'ativo' check (status in ('ativo', 'resolvido', 'removido')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  resolvido_em   timestamptz,
  constraint alertas_foto check (foto_url like 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/' || autor::text || '/%')
);
create index if not exists alertas_lista on public.alertas_pets (status, estado, criado_em desc);
create index if not exists alertas_autor on public.alertas_pets (autor);
alter table public.alertas_pets enable row level security;

drop policy if exists "alertas visiveis" on public.alertas_pets;
create policy "alertas visiveis" on public.alertas_pets for select to anon, authenticated
  using ((status <> 'removido' and public.perfil_ativo(autor)) or autor = auth.uid() or public.eh_admin());
drop policy if exists "criar alerta" on public.alertas_pets;
create policy "criar alerta" on public.alertas_pets for insert to authenticated
  with check (autor = auth.uid() and public.perfil_ativo(auth.uid()));
drop policy if exists "autor edita alerta" on public.alertas_pets;
create policy "autor edita alerta" on public.alertas_pets for update to authenticated
  using (autor = auth.uid() and status <> 'removido') with check (autor = auth.uid());
drop policy if exists "autor apaga alerta" on public.alertas_pets;
create policy "autor apaga alerta" on public.alertas_pets for delete to authenticated
  using (autor = auth.uid() or public.eh_admin());

revoke all on public.alertas_pets from anon, authenticated;
grant select on public.alertas_pets to anon, authenticated;
grant insert (autor, tipo, pet, nome, especie, raca, sexo, porte, descricao, foto_url, cidade, estado, bairro, referencia, quando, whatsapp)
  on public.alertas_pets to authenticated;
grant update (tipo, pet, nome, especie, raca, sexo, porte, descricao, foto_url, cidade, estado, bairro, referencia, quando, whatsapp, status)
  on public.alertas_pets to authenticated;
grant delete on public.alertas_pets to authenticated;

create or replace function public._validar_alerta() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.nome := nullif(btrim(regexp_replace(coalesce(new.nome, ''), '\s+', ' ', 'g')), '');
  new.raca := nullif(btrim(new.raca), '');
  new.descricao := btrim(new.descricao);
  new.cidade := btrim(new.cidade);
  new.bairro := btrim(new.bairro);
  new.referencia := nullif(btrim(new.referencia), '');
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'), '');
  new.atualizado_em := now();
  if new.tipo = 'perdido' and new.nome is null then
    raise exception 'Digite o nome do pet.' using errcode = 'P0001';
  end if;
  if new.quando > current_date or new.quando < current_date - 730 then
    raise exception 'Confira a data: ela não pode ser no futuro nem de mais de 2 anos atrás.' using errcode = 'P0001';
  end if;
  if new.pet is not null and not exists (select 1 from public.pets where id = new.pet and dono = new.autor) then
    new.pet := null;
  end if;
  -- Golpe comum: pedir dinheiro em troca do pet. Valores em reais não entram no alerta.
  if public.tem_valor_em_reais(concat_ws(' ', new.descricao, new.referencia)) then
    raise exception 'O alerta não pode ter valores em reais. Combine qualquer recompensa direto com quem encontrar o pet.' using errcode = 'P0001';
  end if;
  if tg_op = 'INSERT' then
    new.status := 'ativo'; new.criado_em := now(); new.resolvido_em := null;
    if (select count(*) from public.alertas_pets where autor = new.autor and status = 'ativo') >= 10 then
      raise exception 'Você já tem 10 alertas ativos. Marque como resolvidos os que não precisam mais.' using errcode = 'P0001';
    end if;
  else
    if old.status = 'removido' and not public.eh_admin() then new.status := 'removido'; end if;   -- só a administração tira do ar e devolve
    if new.status = 'resolvido' and old.status <> 'resolvido' then new.resolvido_em := now(); end if;
    if new.status = 'ativo' then new.resolvido_em := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists alertas_validar on public.alertas_pets;
create trigger alertas_validar before insert or update on public.alertas_pets
  for each row execute function public._validar_alerta();
drop trigger if exists a_trava_alertas on public.alertas_pets;
create trigger a_trava_alertas before insert on public.alertas_pets for each row execute function public._trava_por_pessoa('autor');


-- ---------- 2. Leitura pública com o autor (sem e-mail nem dados privados) ----------
create or replace function public.alertas_lista(p_estado text default null, p_tipo text default null, p_status text default 'ativo')
returns table (id uuid, tipo text, nome text, especie text, raca text, sexo text, porte text, descricao text, foto_url text,
               cidade text, estado text, bairro text, referencia text, quando date, whatsapp text, status text,
               criado_em timestamptz, resolvido_em timestamptz, autor uuid, autor_usuario text, autor_nome text)
language sql stable security definer set search_path = public as $$
  select a.id, a.tipo, a.nome, a.especie, a.raca, a.sexo, a.porte, a.descricao, a.foto_url,
         a.cidade, a.estado, a.bairro, a.referencia, a.quando, a.whatsapp, a.status,
         a.criado_em, a.resolvido_em, a.autor, pf.usuario, pf.nome
    from public.alertas_pets a
    join public.perfis pf on pf.id = a.autor
   where a.status = coalesce(p_status, 'ativo') and a.status <> 'removido'
     and public.perfil_ativo(a.autor)
     and (p_estado is null or a.estado = p_estado)
     and (p_tipo is null or a.tipo = p_tipo)
   order by a.criado_em desc
   limit 120;
$$;
revoke all on function public.alertas_lista(text, text, text) from public;
grant execute on function public.alertas_lista(text, text, text) to anon, authenticated;

create or replace function public.alerta_detalhe(p_id uuid)
returns table (id uuid, tipo text, pet uuid, nome text, especie text, raca text, sexo text, porte text, descricao text, foto_url text,
               cidade text, estado text, bairro text, referencia text, quando date, whatsapp text, status text,
               criado_em timestamptz, resolvido_em timestamptz, autor uuid, autor_usuario text, autor_nome text, autor_foto text)
language sql stable security definer set search_path = public as $$
  select a.id, a.tipo, a.pet, a.nome, a.especie, a.raca, a.sexo, a.porte, a.descricao, a.foto_url,
         a.cidade, a.estado, a.bairro, a.referencia, a.quando, a.whatsapp, a.status,
         a.criado_em, a.resolvido_em, a.autor, pf.usuario, pf.nome, pf.foto_url
    from public.alertas_pets a
    join public.perfis pf on pf.id = a.autor
   where a.id = p_id
     and ((a.status <> 'removido' and public.perfil_ativo(a.autor)) or a.autor = auth.uid() or public.eh_admin());
$$;
revoke all on function public.alerta_detalhe(uuid) from public;
grant execute on function public.alerta_detalhe(uuid) to anon, authenticated;

-- ---------- 3. Administração: tirar do ar ou devolver ----------
create or replace function public.moderar_alerta(p_id uuid, p_acao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração.' using errcode = '42501'; end if;
  if p_acao = 'remover' then
    update public.alertas_pets set status = 'removido' where id = p_id;
  elsif p_acao = 'restaurar' then
    update public.alertas_pets set status = 'ativo' where id = p_id;
  else
    raise exception 'Ação inválida.' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.moderar_alerta(uuid, text) from public, anon;
grant execute on function public.moderar_alerta(uuid, text) to authenticated;

create or replace function public.alertas_admin()
returns table (id uuid, tipo text, nome text, especie text, descricao text, foto_url text, cidade text, estado text, bairro text,
               quando date, status text, criado_em timestamptz, autor_usuario text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Só a administração.' using errcode = '42501'; end if;
  return query
    select a.id, a.tipo, a.nome, a.especie, a.descricao, a.foto_url, a.cidade, a.estado, a.bairro, a.quando, a.status, a.criado_em, pf.usuario
      from public.alertas_pets a join public.perfis pf on pf.id = a.autor
     order by a.criado_em desc limit 200;
end $$;
revoke all on function public.alertas_admin() from public, anon;
grant execute on function public.alertas_admin() to authenticated;

-- ---------- 4. Limpeza: alertas resolvidos há mais de 1 ano são apagados ----------
create or replace function public.limpar_alertas_antigos() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.alertas_pets where status in ('resolvido', 'removido') and coalesce(resolvido_em, atualizado_em) < now() - interval '1 year';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.limpar_alertas_antigos() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-alertas';
  perform cron.schedule('abano-limpar-alertas', '25 7 * * *', 'select public.limpar_alertas_antigos()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza dos alertas (ative pg_cron e rode de novo): %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
