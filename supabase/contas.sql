-- =========================================================
-- Abanô — contas de tutor: perfil, pets, fotos e novidades
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- lista_espera.sql, emails.sql, lgpd.sql, google.sql e
-- pesquisa_huskies.sql (que cria a tabela admins).
-- Não apaga nenhum dado existente.
-- =========================================================

-- ---------- 1. Lista de novidades aceita inscrições vindas da conta ----------
-- Quem cria conta informa só nome, e-mail e senha: cidade e tipo de pet ficam opcionais.
alter table public.lista_espera alter column cidade drop not null;
alter table public.lista_espera alter column pet drop not null;
alter table public.lista_espera drop constraint if exists lista_espera_origem;
alter table public.lista_espera add constraint lista_espera_origem check (origem in ('formulario', 'google', 'conta'));

-- ---------- 2. Perfil do tutor (um por conta) ----------
create table if not exists public.perfis (
  id               uuid primary key references auth.users (id) on delete cascade,
  usuario          text not null unique check (usuario ~ '^[a-z0-9][a-z0-9_]{2,29}$'),
  nome             text not null check (char_length(btrim(nome)) between 2 and 60),
  bio              text check (char_length(bio) <= 300),
  cidade           text check (char_length(cidade) <= 80),
  estado           text check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  foto_url         text,
  versao_politica  text,
  maior_de_idade   boolean not null default false,
  aceitou_em       timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  -- A foto só pode vir da pasta do próprio usuário no armazenamento do Abanô
  constraint perfis_foto check (foto_url is null or foto_url like 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/' || id::text || '/%')
);

alter table public.perfis enable row level security;

-- Perfil público só depois que a pessoa aceitou a política; cada um sempre vê o seu
drop policy if exists "perfis visiveis" on public.perfis;
create policy "perfis visiveis" on public.perfis for select to anon, authenticated
  using (versao_politica is not null or id = auth.uid());

drop policy if exists "dono edita o proprio perfil" on public.perfis;
create policy "dono edita o proprio perfil" on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.perfis from anon, authenticated;
grant select (id, usuario, nome, bio, cidade, estado, foto_url, criado_em) on public.perfis to anon, authenticated;
grant update (usuario, nome, bio, cidade, estado, foto_url) on public.perfis to authenticated;

create or replace function public._perfil_atualizado() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.usuario := lower(new.usuario);
  new.bio := nullif(btrim(new.bio), '');
  new.cidade := nullif(btrim(new.cidade), '');
  return new;
end $$;
drop trigger if exists perfis_atualizado on public.perfis;
create trigger perfis_atualizado before update on public.perfis
  for each row execute function public._perfil_atualizado();

-- Cria o perfil com um nome de usuário único a partir do nome
create or replace function public._criar_perfil(p_id uuid, p_email text, p_meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_nome text; v_base text; v_usuario text; v_tentativa int := 0;
begin
  if exists (select 1 from public.perfis where id = p_id) then return; end if;
  v_nome := left(btrim(regexp_replace(coalesce(nullif(p_meta ->> 'nome', ''), nullif(p_meta ->> 'full_name', ''),
              nullif(p_meta ->> 'name', ''), split_part(p_email, '@', 1), ''), '\s+', ' ', 'g')), 60);
  if char_length(v_nome) < 2 then v_nome := 'Tutor do Abanô'; end if;
  v_base := regexp_replace(translate(lower(v_nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '', 'g');
  v_base := left(v_base, 20);
  if char_length(v_base) < 3 then v_base := 'tutor'; end if;
  v_usuario := v_base;
  while exists (select 1 from public.perfis where usuario = v_usuario) loop
    v_tentativa := v_tentativa + 1;
    v_usuario := v_base || (1000 + floor(random() * 9000))::int::text;
    if v_tentativa > 20 then v_usuario := 'tutor' || replace(left(p_id::text, 13), '-', ''); exit; end if;
  end loop;
  insert into public.perfis (id, usuario, nome) values (p_id, v_usuario, v_nome)
  on conflict (id) do nothing;
end $$;
revoke all on function public._criar_perfil(uuid, text, jsonb) from public, anon, authenticated;

-- ---------- 3. Novidades por e-mail (opcional, ligado à conta) ----------
create or replace function public._inscrever_novidades(p_email text, p_nome text, p_versao text) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Novo inscrito recebe as boas-vindas (gatilho da lista); quem já estava só é reativado
  insert into public.lista_espera (nome, email, versao_politica, maior_de_idade, origem)
  values (left(coalesce(nullif(btrim(p_nome), ''), split_part(p_email, '@', 1)), 120), lower(p_email), coalesce(p_versao, 'conta'), true, 'conta')
  on conflict ((lower(email))) do update
    set inscrito = true, descadastrado_em = null,
        versao_politica = coalesce(excluded.versao_politica, lista_espera.versao_politica), maior_de_idade = true;
end $$;
revoke all on function public._inscrever_novidades(text, text, text) from public, anon, authenticated;

-- ---------- 4. Gatilhos da conta de acesso ----------
-- Conta nova: cria o perfil e registra o consentimento informado no cadastro
create or replace function public._conta_nova() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._criar_perfil(new.id, new.email, new.raw_user_meta_data);
  if coalesce(new.raw_user_meta_data ->> 'maior_de_idade', '') = 'true' and coalesce(new.raw_user_meta_data ->> 'versao_politica', '') <> '' then
    update public.perfis set versao_politica = left(new.raw_user_meta_data ->> 'versao_politica', 20), maior_de_idade = true, aceitou_em = now()
     where id = new.id;
  end if;
  -- E-mail já confirmado na criação (ex.: Google) e pediu novidades
  if new.email_confirmed_at is not null and coalesce(new.raw_user_meta_data ->> 'novidades', '') = 'true' then
    perform public._inscrever_novidades(new.email, new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'versao_politica');
  end if;
  return new;
exception when others then
  raise warning 'Abanô: perfil não criado para %: %', new.email, sqlerrm;
  return new;                                          -- o cadastro nunca falha por causa do perfil
end $$;
drop trigger if exists abano_conta_nova on auth.users;
create trigger abano_conta_nova after insert on auth.users
  for each row execute function public._conta_nova();

-- E-mail confirmado: só então entra na lista de novidades (se pediu)
create or replace function public._conta_confirmada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
     and coalesce(new.raw_user_meta_data ->> 'novidades', '') = 'true' then
    perform public._inscrever_novidades(new.email, new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'versao_politica');
  end if;
  return new;
exception when others then
  raise warning 'Abanô: inscrição em novidades falhou para %: %', new.email, sqlerrm;
  return new;
end $$;
drop trigger if exists abano_conta_confirmada on auth.users;
create trigger abano_conta_confirmada after update of email_confirmed_at on auth.users
  for each row execute function public._conta_confirmada();

-- ---------- 5. Funções que a página "Minha conta" usa ----------
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
    'admin', public.eh_admin());
end $$;
revoke all on function public.minha_conta() from public, anon;
grant execute on function public.minha_conta() to authenticated;

-- Aceite da política (quem entrou pelo Google confirma aqui na primeira vez)
create or replace function public.aceitar_politica(p_versao text, p_novidades boolean default false) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); u auth.users;
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if coalesce(btrim(p_versao), '') = '' or char_length(p_versao) > 20 then raise exception 'Versão da política inválida.'; end if;
  select * into u from auth.users where id = v_uid;
  perform public._criar_perfil(u.id, u.email, u.raw_user_meta_data);
  update public.perfis set versao_politica = p_versao, maior_de_idade = true, aceitou_em = now() where id = v_uid;
  if p_novidades and u.email_confirmed_at is not null then
    perform public._inscrever_novidades(u.email, (select nome from public.perfis where id = v_uid), p_versao);
  end if;
  return true;
end $$;
revoke all on function public.aceitar_politica(text, boolean) from public, anon;
grant execute on function public.aceitar_politica(text, boolean) to authenticated;

-- Liga/desliga as novidades por e-mail
create or replace function public.definir_novidades(p_quer boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); u auth.users; p public.perfis;
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into u from auth.users where id = v_uid;
  select * into p from public.perfis where id = v_uid;
  if p_quer then
    if u.email_confirmed_at is null then raise exception 'Confirme seu e-mail primeiro.'; end if;
    if p.versao_politica is null then raise exception 'Aceite a política de privacidade primeiro.'; end if;
    perform public._inscrever_novidades(u.email, p.nome, p.versao_politica);
  else
    update public.lista_espera set inscrito = false, descadastrado_em = now()
     where lower(email) = lower(u.email) and inscrito;
  end if;
  return p_quer;
end $$;
revoke all on function public.definir_novidades(boolean) from public, anon;
grant execute on function public.definir_novidades(boolean) to authenticated;

-- Excluir a conta: apaga perfil, pets (em cascata), inscrição nas novidades e o acesso.
-- As fotos são apagadas antes pela página, pelo armazenamento.
create or replace function public.excluir_minha_conta() returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text;
begin
  if v_uid is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select email into v_email from auth.users where id = v_uid;
  delete from public.lista_espera where lower(email) = lower(v_email);
  delete from auth.users where id = v_uid;
  return true;
end $$;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- Perfil já aceitou a política? (usado pelas regras de acesso; não expõe dados)
create or replace function public.perfil_ativo(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = p_id and versao_politica is not null);
$$;
revoke all on function public.perfil_ativo(uuid) from public;
grant execute on function public.perfil_ativo(uuid) to anon, authenticated;

-- ---------- 6. Pets (vários por tutor, todos opcionais) ----------
create table if not exists public.pets (
  id             uuid primary key default gen_random_uuid(),
  dono           uuid not null references public.perfis (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 1 and 40),
  especie        text not null check (especie in ('cachorro', 'gato', 'outro')),
  raca           text check (char_length(raca) <= 60),
  idade          text check (char_length(idade) <= 30),
  sexo           text check (sexo in ('macho', 'femea')),
  personalidade  text check (char_length(personalidade) <= 120),
  descricao      text check (char_length(descricao) <= 500),
  foto_url       text,
  criado_em      timestamptz not null default now(),
  constraint pets_foto check (foto_url is null or foto_url like 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/' || dono::text || '/%')
);
create index if not exists pets_dono on public.pets (dono);

alter table public.pets enable row level security;

drop policy if exists "pets visiveis" on public.pets;
create policy "pets visiveis" on public.pets for select to anon, authenticated
  using (dono = auth.uid() or public.perfil_ativo(dono));

drop policy if exists "dono cadastra pet" on public.pets;
create policy "dono cadastra pet" on public.pets for insert to authenticated
  with check (dono = auth.uid() and public.perfil_ativo(auth.uid()));

drop policy if exists "dono edita pet" on public.pets;
create policy "dono edita pet" on public.pets for update to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

drop policy if exists "dono apaga pet" on public.pets;
create policy "dono apaga pet" on public.pets for delete to authenticated
  using (dono = auth.uid());

revoke all on public.pets from anon, authenticated;
grant select on public.pets to anon, authenticated;
grant insert (dono, nome, especie, raca, idade, sexo, personalidade, descricao, foto_url) on public.pets to authenticated;
grant update (nome, especie, raca, idade, sexo, personalidade, descricao, foto_url) on public.pets to authenticated;
grant delete on public.pets to authenticated;

-- No máximo 20 pets por tutor
create or replace function public._limite_pets() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.pets where dono = new.dono) >= 20 then
    raise exception 'Limite de 20 pets por perfil.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pets_limite on public.pets;
create trigger pets_limite before insert on public.pets
  for each row execute function public._limite_pets();

-- ---------- 7. Fotos (perfil e pets) ----------
-- Pasta pública "fotos": cada pessoa só envia, troca e apaga na própria pasta (fotos/<id da conta>/...).
-- Até 5 MB, só JPG, PNG ou WebP. A página reduz a foto e tira os dados de localização antes de enviar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: dono ve a propria pasta" on storage.objects;
create policy "fotos: dono ve a propria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: dono envia" on storage.objects;
create policy "fotos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: dono troca" on storage.objects;
create policy "fotos: dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: dono apaga" on storage.objects;
create policy "fotos: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 8. Limpeza diária (substitui a regra antiga) ----------
-- Antes, toda conta de acesso fora da lista de espera era apagada em 1 dia.
-- Agora existem contas de verdade, então a limpeza:
-- a) apaga da lista quem cancelou as novidades há mais de 30 dias (a conta continua);
-- b) apaga contas antigas do login Google da lista de espera que nunca viraram perfil;
-- c) apaga cadastros com e-mail nunca confirmado depois de 7 dias.
create or replace function public.limpar_descadastrados() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.lista_espera
   where inscrito = false and descadastrado_em < now() - interval '30 days';
  get diagnostics n = row_count;

  delete from auth.users au
   where au.created_at < now() - interval '1 day'
     and not exists (select 1 from public.perfis p where p.id = au.id)
     and not exists (select 1 from public.lista_espera l where lower(l.email) = lower(au.email))
     and not exists (select 1 from public.admins a where lower(a.email) = lower(au.email));

  delete from auth.users au
   where au.email_confirmed_at is null and au.created_at < now() - interval '7 days';

  return n;
end $$;
revoke all on function public.limpar_descadastrados() from public, anon, authenticated;

-- ---------- 9. E-mails com a nova identidade visual ----------
create or replace function public._email_html(titulo text, corpo text, botao_texto text, botao_link text, link_sair text)
returns text language sql immutable as $$
  select
  '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#FFF7F5;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F5;padding:32px 12px;"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:22px;font-family:Nunito,-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;color:#2B1622;">'
  || '<tr><td style="padding:28px 32px 0;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#D10F5E;">aban<span style="color:#FF8A1E;">ô</span></td></tr>'
  || '<tr><td style="padding:16px 32px 0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">' || titulo || '</td></tr>'
  || '<tr><td style="padding:14px 32px 0;font-size:16px;line-height:1.6;color:#4A3542;">' || corpo || '</td></tr>'
  || case when botao_link is not null then
       '<tr><td style="padding:24px 32px 0;"><a href="' || botao_link || '" style="display:inline-block;background:#D10F5E;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:16px;padding:13px 24px;border-radius:999px;">' || botao_texto || '</a></td></tr>'
     else '' end
  || '<tr><td style="padding:32px 32px 28px;font-size:12px;line-height:1.6;color:#6B5462;">Você recebe este e-mail porque pediu para receber as novidades do Abanô. '
  || '<a href="' || link_sair || '" style="color:#6B5462;">Cancelar inscrição ou excluir meus dados</a> · '
  || '<a href="' || split_part(link_sair, '/descadastrar.html', 1) || '/privacidade.html" style="color:#6B5462;">Política de privacidade</a></td></tr>'
  || '</table></td></tr></table></body></html>';
$$;

notify pgrst, 'reload schema';

-- Conferência: deve listar 5 itens com "ok"
select 'perfis' as item, case when to_regclass('public.perfis') is not null then 'ok' else 'FALTA' end as status
union all select 'pets', case when to_regclass('public.pets') is not null then 'ok' else 'FALTA' end
union all select 'pasta de fotos', case when exists (select 1 from storage.buckets where id = 'fotos') then 'ok' else 'FALTA' end
union all select 'gatilho de conta nova', case when exists (select 1 from pg_trigger where tgname = 'abano_conta_nova') then 'ok' else 'FALTA' end
union all select 'limpeza corrigida', case when exists (select 1 from pg_proc where proname = 'limpar_descadastrados' and prosrc like '%perfis%') then 'ok' else 'FALTA' end;
