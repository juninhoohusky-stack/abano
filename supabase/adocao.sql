-- =========================================================
-- Abanô — Adoção: ONGs e protetores verificados, pets para
-- adoção, pedidos com questionário e contato liberado no aceite
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql, comunidade.sql, moderacao.sql e pets_especies.sql.
-- Não cria nenhum pet nem organização de exemplo.
-- =========================================================

-- ---------- 0. Valores em reais não entram nos anúncios (combine direto com a ONG) ----------
create or replace function public.tem_valor_em_reais(p_texto text) returns boolean
language sql immutable as $$
  select coalesce(p_texto, '') ~* '(r\$ ?[0-9]|[0-9]+ ?(reais|real)\M|[0-9]+,[0-9]{2})';
$$;
grant execute on function public.tem_valor_em_reais(text) to anon, authenticated;

-- ---------- 1. Organizações (ONGs e protetores) ----------
create table if not exists public.organizacoes (
  id             uuid primary key default gen_random_uuid(),
  dono           uuid not null unique references public.perfis (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 2 and 80),
  tipo           text not null check (tipo in ('ong', 'protetor')),
  cidade         text not null check (char_length(btrim(cidade)) between 2 and 80),
  estado         text not null check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  instagram      text check (char_length(instagram) <= 60),
  site           text check (site is null or (char_length(site) <= 200 and site ~* '^https://')),
  cnpj           text check (cnpj is null or cnpj ~ '^[0-9./-]{14,18}$'),
  whatsapp       text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  descricao      text check (char_length(descricao) <= 600),
  status         text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada', 'suspensa')),
  motivo         text check (char_length(motivo) <= 300),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  aprovada_em    timestamptz
);
alter table public.organizacoes enable row level security;

drop policy if exists "organizacoes visiveis" on public.organizacoes;
create policy "organizacoes visiveis" on public.organizacoes for select to anon, authenticated
  using (status = 'aprovada' or dono = auth.uid() or public.eh_admin());
drop policy if exists "pedir verificacao" on public.organizacoes;
create policy "pedir verificacao" on public.organizacoes for insert to authenticated
  with check (dono = auth.uid() and public.perfil_ativo(auth.uid()));
drop policy if exists "dono edita organizacao" on public.organizacoes;
create policy "dono edita organizacao" on public.organizacoes for update to authenticated
  using (dono = auth.uid()) with check (dono = auth.uid());

-- WhatsApp e CNPJ nunca são públicos: só o dono (pela função minha_organizacao) e a administração veem
revoke all on public.organizacoes from anon, authenticated;
grant select (id, dono, nome, tipo, cidade, estado, instagram, site, descricao, status, criado_em, aprovada_em) on public.organizacoes to anon, authenticated;
grant insert (dono, nome, tipo, cidade, estado, instagram, site, cnpj, whatsapp, descricao) on public.organizacoes to authenticated;
grant update (nome, tipo, cidade, estado, instagram, site, cnpj, whatsapp, descricao) on public.organizacoes to authenticated;

create or replace function public._validar_organizacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.nome := btrim(regexp_replace(new.nome, '\s+', ' ', 'g'));
  new.cidade := btrim(new.cidade);
  new.descricao := nullif(btrim(new.descricao), '');
  new.instagram := nullif(btrim(new.instagram), '');
  new.site := nullif(btrim(new.site), '');
  new.cnpj := nullif(btrim(new.cnpj), '');
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.status := 'pendente'; new.motivo := null; new.aprovada_em := null; new.criado_em := now();
  elsif old.status = 'recusada' then
    new.status := 'pendente'; new.motivo := null;   -- corrigiu os dados: volta para análise
  end if;
  if public.tem_valor_em_reais(new.descricao) or public.parece_venda_de_animal(new.descricao) then
    raise exception 'A descrição não pode ter valores em reais nem anúncio de venda.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists organizacoes_validar on public.organizacoes;
create trigger organizacoes_validar before insert or update on public.organizacoes
  for each row execute function public._validar_organizacao();

-- Dados completos da própria organização (inclui WhatsApp e CNPJ)
create or replace function public.minha_organizacao() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o) from public.organizacoes o where o.dono = auth.uid();
$$;
revoke all on function public.minha_organizacao() from public, anon;
grant execute on function public.minha_organizacao() to authenticated;

create or replace function public.org_aprovada(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizacoes where id = p_org and status = 'aprovada');
$$;
revoke all on function public.org_aprovada(uuid) from public;
grant execute on function public.org_aprovada(uuid) to anon, authenticated;

-- ---------- 2. Pets para adoção ----------
create table if not exists public.pets_adocao (
  id             uuid primary key default gen_random_uuid(),
  org            uuid not null references public.organizacoes (id) on delete cascade,
  autor          uuid not null references public.perfis (id) on delete cascade,
  nome           text not null check (char_length(btrim(nome)) between 1 and 40),
  especie        text not null check (especie in ('cachorro', 'gato', 'ave', 'pequeno_mamifero', 'reptil', 'peixe', 'outro')),
  sexo           text not null check (sexo in ('macho', 'femea')),
  idade          text not null check (idade in ('filhote', 'jovem', 'adulto', 'idoso')),
  porte          text check (porte in ('pequeno', 'medio', 'grande')),
  fotos          text[] not null,
  vacinado       boolean not null default false,
  castrado       boolean not null default false,
  vermifugado    boolean not null default false,
  bom_criancas   boolean,
  bom_caes       boolean,
  bom_gatos      boolean,
  necessidades   text check (char_length(necessidades) <= 300),
  descricao      text check (char_length(descricao) <= 1000),
  compromissos   text check (char_length(compromissos) <= 500),
  cidade         text not null check (char_length(btrim(cidade)) between 2 and 80),
  estado         text not null check (estado in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  status         text not null default 'disponivel' check (status in ('disponivel', 'em_processo', 'adotado')),
  removido       boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  expira_em      timestamptz not null default now() + interval '60 days'
);
create index if not exists pets_adocao_lista on public.pets_adocao (status, criado_em desc) where not removido;
create index if not exists pets_adocao_org on public.pets_adocao (org);
alter table public.pets_adocao enable row level security;

drop policy if exists "pets para adocao visiveis" on public.pets_adocao;
create policy "pets para adocao visiveis" on public.pets_adocao for select to anon, authenticated
  using ((not removido and public.org_aprovada(org)) or autor = auth.uid() or public.eh_admin());
drop policy if exists "ong anuncia pet" on public.pets_adocao;
create policy "ong anuncia pet" on public.pets_adocao for insert to authenticated
  with check (autor = auth.uid() and exists (select 1 from public.organizacoes o where o.id = org and o.dono = auth.uid() and o.status = 'aprovada'));
drop policy if exists "ong edita pet" on public.pets_adocao;
create policy "ong edita pet" on public.pets_adocao for update to authenticated
  using (autor = auth.uid()) with check (autor = auth.uid());
drop policy if exists "ong apaga pet" on public.pets_adocao;
create policy "ong apaga pet" on public.pets_adocao for delete to authenticated
  using (autor = auth.uid() or public.eh_admin());

revoke all on public.pets_adocao from anon, authenticated;
grant select on public.pets_adocao to anon, authenticated;
grant insert (org, autor, nome, especie, sexo, idade, porte, fotos, vacinado, castrado, vermifugado, bom_criancas, bom_caes, bom_gatos, necessidades, descricao, compromissos, cidade, estado) on public.pets_adocao to authenticated;
grant update (nome, especie, sexo, idade, porte, fotos, vacinado, castrado, vermifugado, bom_criancas, bom_caes, bom_gatos, necessidades, descricao, compromissos, cidade, estado, status) on public.pets_adocao to authenticated;
grant delete on public.pets_adocao to authenticated;

create or replace function public._validar_pet_adocao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prefixo text; v_foto text;
begin
  perform pg_advisory_xact_lock(hashtextextended('pets_adocao:' || new.autor::text, 0));
  v_prefixo := 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/' || new.autor::text || '/';
  new.nome := btrim(new.nome); new.cidade := btrim(new.cidade);
  new.necessidades := nullif(btrim(new.necessidades), '');
  new.descricao := nullif(btrim(new.descricao), '');
  new.compromissos := nullif(btrim(new.compromissos), '');
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.removido := false; new.status := 'disponivel'; new.criado_em := now(); new.expira_em := now() + interval '60 days';
    if (select count(*) from public.pets_adocao where autor = new.autor and criado_em > now() - interval '1 day') >= 20 then
      raise exception 'Limite de 20 anúncios por dia. Tente amanhã.' using errcode = 'P0001';
    end if;
  else
    new.removido := old.removido; new.expira_em := old.expira_em; new.org := old.org; new.autor := old.autor;
  end if;
  if new.fotos is null or cardinality(new.fotos) not between 1 and 6 then
    raise exception 'Coloque de 1 a 6 fotos do pet.' using errcode = 'P0001';
  end if;
  foreach v_foto in array new.fotos loop
    if v_foto is null or left(v_foto, char_length(v_prefixo)) <> v_prefixo then raise exception 'Foto inválida.' using errcode = 'P0001'; end if;
  end loop;
  if public.tem_valor_em_reais(concat_ws(' ', new.descricao, new.compromissos, new.necessidades)) then
    raise exception 'O anúncio não pode ter valores em reais. Escreva o que o adotante vai assumir (por exemplo, a castração) e combine os valores direto com quem quiser adotar.' using errcode = 'P0001';
  end if;
  if public.parece_venda_de_animal(concat_ws(' ', new.nome, new.descricao, new.compromissos)) then
    raise exception 'Venda de animais não é permitida no Abanô.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists pets_adocao_validar on public.pets_adocao;
create trigger pets_adocao_validar before insert or update on public.pets_adocao
  for each row execute function public._validar_pet_adocao();

-- Renovar o anúncio por mais 60 dias
create or replace function public.renovar_pet_adocao(p_pet uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz;
begin
  update public.pets_adocao set expira_em = now() + interval '60 days'
   where id = p_pet and autor = auth.uid() and not removido
  returning expira_em into v;
  if v is null then raise exception 'Anúncio não encontrado.' using errcode = 'P0001'; end if;
  return v;
end $$;
revoke all on function public.renovar_pet_adocao(uuid) from public, anon;
grant execute on function public.renovar_pet_adocao(uuid) to authenticated;

-- ---------- 3. Pedidos de adoção ----------
create table if not exists public.pedidos_adocao (
  id             uuid primary key default gen_random_uuid(),
  pet            uuid not null references public.pets_adocao (id) on delete cascade,
  org            uuid not null references public.organizacoes (id) on delete cascade,
  adotante       uuid not null references public.perfis (id) on delete cascade,
  respostas      jsonb not null,
  whatsapp       text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  cidade         text check (char_length(cidade) <= 80),
  estado         text,
  status         text not null default 'enviado' check (status in ('enviado', 'aceito', 'recusado', 'cancelado')),
  criado_em      timestamptz not null default now(),
  respondido_em  timestamptz,
  unique (pet, adotante)
);
create index if not exists pedidos_adocao_org on public.pedidos_adocao (org, criado_em desc);
create index if not exists pedidos_adocao_adotante on public.pedidos_adocao (adotante, criado_em desc);
alter table public.pedidos_adocao enable row level security;

drop policy if exists "pedidos visiveis aos dois lados" on public.pedidos_adocao;
create policy "pedidos visiveis aos dois lados" on public.pedidos_adocao for select to authenticated
  using (adotante = auth.uid() or exists (select 1 from public.organizacoes o where o.id = org and o.dono = auth.uid()) or public.eh_admin());
drop policy if exists "pedir adocao" on public.pedidos_adocao;
create policy "pedir adocao" on public.pedidos_adocao for insert to authenticated
  with check (adotante = auth.uid() and public.perfil_ativo(auth.uid()));

-- O WhatsApp do pedido não é lido direto: só sai pela função contato_pedido, depois do aceite
revoke all on public.pedidos_adocao from anon, authenticated;
grant select (id, pet, org, adotante, respostas, cidade, estado, status, criado_em, respondido_em) on public.pedidos_adocao to authenticated;
grant insert (pet, adotante, respostas, whatsapp, cidade, estado) on public.pedidos_adocao to authenticated;

create or replace function public._validar_pedido_adocao() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pet public.pets_adocao;
begin
  perform pg_advisory_xact_lock(hashtextextended('pedidos_adocao:' || new.adotante::text, 0));
  select * into v_pet from public.pets_adocao where id = new.pet;
  if v_pet.id is null or v_pet.removido or v_pet.status = 'adotado' or v_pet.expira_em < now() or not public.org_aprovada(v_pet.org) then
    raise exception 'Este pet não está mais disponível para adoção.' using errcode = 'P0001';
  end if;
  if v_pet.autor = new.adotante then raise exception 'Você não pode pedir para adotar o seu próprio anúncio.' using errcode = 'P0001'; end if;
  if (select count(*) from public.pedidos_adocao where adotante = new.adotante and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'Limite de 5 pedidos de adoção por dia. Tente amanhã.' using errcode = 'P0001';
  end if;
  if pg_column_size(new.respostas) > 6000 then raise exception 'Respostas muito longas.' using errcode = 'P0001'; end if;
  new.org := v_pet.org; new.status := 'enviado'; new.respondido_em := null; new.criado_em := now();
  return new;
end $$;
drop trigger if exists pedidos_adocao_validar on public.pedidos_adocao;
create trigger pedidos_adocao_validar before insert on public.pedidos_adocao
  for each row execute function public._validar_pedido_adocao();

-- ---------- 4. E-mails da adoção (avisos, não são novidades) ----------
create or replace function public._email_aviso(titulo text, corpo text, botao_texto text, botao_link text) returns text
language sql immutable as $$
  select
  '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#FFF7F5;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F5;padding:32px 12px;"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:22px;font-family:Nunito,-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;color:#2B1622;">'
  || '<tr><td style="padding:28px 32px 0;font-size:26px;font-weight:900;letter-spacing:-0.02em;color:#D10F5E;">aban<span style="color:#FF8A1E;">ô</span></td></tr>'
  || '<tr><td style="padding:16px 32px 0;font-size:24px;line-height:1.2;font-weight:800;">' || titulo || '</td></tr>'
  || '<tr><td style="padding:14px 32px 0;font-size:16px;line-height:1.6;color:#4A3542;">' || corpo || '</td></tr>'
  || '<tr><td style="padding:24px 32px 0;"><a href="' || botao_link || '" style="display:inline-block;background:#D10F5E;color:#FFFFFF;text-decoration:none;font-weight:800;font-size:16px;padding:13px 24px;border-radius:999px;">' || botao_texto || '</a></td></tr>'
  || '<tr><td style="padding:32px 32px 28px;font-size:12px;line-height:1.6;color:#6B5462;">Você recebe este aviso por causa de um pedido de adoção no Abanô. '
  || '<a href="https://abano.com.br/privacidade.html" style="color:#6B5462;">Política de privacidade</a></td></tr>'
  || '</table></td></tr></table></body></html>';
$$;
revoke all on function public._email_aviso(text, text, text, text) from public, anon, authenticated;

create or replace function public._enviar_aviso(p_para uuid, p_assunto text, p_titulo text, p_corpo text, p_botao text, p_caminho text) returns void
language plpgsql security definer set search_path = public as $$
declare cfg public.config_email; v_email text;
begin
  select * into cfg from public.config_email where id = 1;
  if cfg is null then return; end if;
  select email into v_email from auth.users where id = p_para;
  if v_email is null then return; end if;
  perform public._resend_lote(jsonb_build_array(jsonb_build_object(
    'from', cfg.remetente, 'to', jsonb_build_array(v_email), 'subject', p_assunto,
    'html', public._email_aviso(p_titulo, p_corpo, p_botao, cfg.site_url || p_caminho))));
exception when others then
  raise warning 'Abanô: aviso de adoção não enviado: %', sqlerrm;
end $$;
revoke all on function public._enviar_aviso(uuid, text, text, text, text, text) from public, anon, authenticated;

-- Pedido novo: avisa a ONG
create or replace function public._aviso_pedido_novo() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pet text; v_dono uuid;
begin
  select p.nome, o.dono into v_pet, v_dono from public.pets_adocao p join public.organizacoes o on o.id = p.org where p.id = new.pet;
  perform public._enviar_aviso(v_dono, 'Novo pedido de adoção para ' || v_pet,
    'Alguém quer adotar ' || public._esc(v_pet) || '!',
    'Chegou um novo pedido de adoção pelo Abanô. Leia as respostas do questionário e, se fizer sentido, aceite o pedido para trocar o WhatsApp com a pessoa.',
    'Ver o pedido', '/ong.html#pedidos');
  return null;
end $$;
drop trigger if exists pedidos_adocao_aviso_novo on public.pedidos_adocao;
create trigger pedidos_adocao_aviso_novo after insert on public.pedidos_adocao
  for each row execute function public._aviso_pedido_novo();

-- ---------- 5. Respostas da ONG e do adotante ----------
create or replace function public.responder_pedido(p_pedido uuid, p_aceitar boolean) returns text
language plpgsql security definer set search_path = public as $$
declare v public.pedidos_adocao; v_pet text; v_org text;
begin
  select pa.* into v from public.pedidos_adocao pa join public.organizacoes o on o.id = pa.org
   where pa.id = p_pedido and o.dono = auth.uid();
  if v.id is null then raise exception 'Pedido não encontrado.' using errcode = 'P0001'; end if;
  if v.status <> 'enviado' then raise exception 'Este pedido já foi respondido.' using errcode = 'P0001'; end if;
  update public.pedidos_adocao set status = case when p_aceitar then 'aceito' else 'recusado' end, respondido_em = now() where id = p_pedido;
  select p.nome, o.nome into v_pet, v_org from public.pets_adocao p join public.organizacoes o on o.id = p.org where p.id = v.pet;
  if p_aceitar then
    update public.pets_adocao set status = 'em_processo' where id = v.pet and status = 'disponivel';
    perform public._enviar_aviso(v.adotante, 'Seu pedido para adotar ' || v_pet || ' foi aceito',
      'Boa notícia: ' || public._esc(v_org) || ' aceitou seu pedido!',
      'Agora vocês podem conversar pelo WhatsApp para combinar os próximos passos da adoção de <b>' || public._esc(v_pet) || '</b>. O contato está liberado no Abanô.',
      'Ver o contato', '/adocao.html?v=pedidos');
    return 'aceito';
  else
    perform public._enviar_aviso(v.adotante, 'Sobre o seu pedido para adotar ' || v_pet,
      'Seu pedido para ' || public._esc(v_pet) || ' não seguiu desta vez',
      'Cada ONG e protetor avalia vários pedidos para encontrar o lar certo para cada pet. Não desanime: há outros pets esperando por uma família no Abanô.',
      'Ver outros pets', '/adocao.html');
    return 'recusado';
  end if;
end $$;
revoke all on function public.responder_pedido(uuid, boolean) from public, anon;
grant execute on function public.responder_pedido(uuid, boolean) to authenticated;

create or replace function public.cancelar_pedido(p_pedido uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.pedidos_adocao set status = 'cancelado', respondido_em = now()
   where id = p_pedido and adotante = auth.uid() and status in ('enviado', 'aceito');
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0001'; end if;
  return true;
end $$;
revoke all on function public.cancelar_pedido(uuid) from public, anon;
grant execute on function public.cancelar_pedido(uuid) to authenticated;

-- WhatsApp do outro lado: só depois do aceite, só para quem participa do pedido
create or replace function public.contato_pedido(p_pedido uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v public.pedidos_adocao; o public.organizacoes;
begin
  select * into v from public.pedidos_adocao where id = p_pedido;
  if v.id is null or v.status <> 'aceito' then return null; end if;
  select * into o from public.organizacoes where id = v.org;
  if auth.uid() = v.adotante then
    return jsonb_build_object('nome', o.nome, 'whatsapp', o.whatsapp);
  elsif auth.uid() = o.dono then
    return jsonb_build_object('nome', (select nome from public.perfis where id = v.adotante), 'whatsapp', v.whatsapp);
  end if;
  return null;
end $$;
revoke all on function public.contato_pedido(uuid) from public, anon;
grant execute on function public.contato_pedido(uuid) to authenticated;

-- ---------- 6. Administração: aprovar organizações ----------
create or replace function public.organizacoes_lista(p_status text default 'pendente') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc) from (
    select o.*, (select email from auth.users where id = o.dono) as email_dono,
           (select usuario from public.perfis where id = o.dono) as usuario_dono,
           (select count(*) from public.pets_adocao where org = o.id) as total_pets
      from public.organizacoes o
     where (p_status = 'todas' or o.status = p_status)
     order by o.criado_em desc limit 200) x), '[]'::jsonb);
end $$;
revoke all on function public.organizacoes_lista(text) from public, anon;
grant execute on function public.organizacoes_lista(text) to authenticated;

create or replace function public.moderar_organizacao(p_org uuid, p_acao text, p_motivo text default null) returns text
language plpgsql security definer set search_path = public as $$
declare o public.organizacoes; v_novo text;
begin
  if not public.eh_admin() then raise exception 'Acesso restrito a administradores.' using errcode = '42501'; end if;
  v_novo := case p_acao when 'aprovar' then 'aprovada' when 'recusar' then 'recusada' when 'suspender' then 'suspensa' when 'reativar' then 'aprovada' end;
  if v_novo is null then raise exception 'Ação inválida.'; end if;
  update public.organizacoes set status = v_novo, motivo = nullif(btrim(p_motivo), ''),
         aprovada_em = case when v_novo = 'aprovada' then coalesce(aprovada_em, now()) else aprovada_em end
   where id = p_org returning * into o;
  if o.id is null then raise exception 'Organização não encontrada.'; end if;
  if p_acao = 'aprovar' then
    perform public._enviar_aviso(o.dono, 'Sua organização foi aprovada no Abanô',
      public._esc(o.nome) || ' foi aprovada!',
      'Agora você já pode anunciar pets para adoção no Abanô. Os pedidos chegam por e-mail e ficam no seu painel.',
      'Abrir o painel da ONG', '/ong.html');
  elsif p_acao = 'recusar' then
    perform public._enviar_aviso(o.dono, 'Sobre o cadastro da sua organização no Abanô',
      'Não conseguimos aprovar ' || public._esc(o.nome) || ' ainda',
      coalesce('Motivo: ' || public._esc(nullif(btrim(p_motivo), '')) || '<br><br>', '') || 'Você pode corrigir os dados no painel da ONG e enviar de novo para análise.',
      'Abrir o painel da ONG', '/ong.html');
  end if;
  return v_novo;
end $$;
revoke all on function public.moderar_organizacao(uuid, text, text) from public, anon;
grant execute on function public.moderar_organizacao(uuid, text, text) to authenticated;

-- Fotos de pets para adoção ficam na pasta do dono da organização (mesmas regras de envio)

-- ---------- 7. Limpeza: pedidos encerrados há mais de 6 meses ----------
create or replace function public.limpar_pedidos_adocao() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.pedidos_adocao where coalesce(respondido_em, criado_em) < now() - interval '6 months';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.limpar_pedidos_adocao() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-pedidos-adocao';
  perform cron.schedule('abano-limpar-pedidos-adocao', '15 7 * * *', 'select public.limpar_pedidos_adocao()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza dos pedidos (ative pg_cron e rode de novo): %', sqlerrm;
end $$;

-- Fotos órfãs: a limpeza diária do GitHub também cobre as fotos de anúncios (mesma pasta da conta)

notify pgrst, 'reload schema';

-- Conferência: deve listar 4 itens com "ok"
select 'organizações' as item, case when to_regclass('public.organizacoes') is not null then 'ok' else 'FALTA' end as status
union all select 'pets para adoção', case when to_regclass('public.pets_adocao') is not null then 'ok' else 'FALTA' end
union all select 'pedidos', case when to_regclass('public.pedidos_adocao') is not null then 'ok' else 'FALTA' end
union all select 'e-mails e aprovação', case when exists (select 1 from pg_proc where proname = 'moderar_organizacao') then 'ok' else 'FALTA' end;
