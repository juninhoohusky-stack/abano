-- =========================================================
-- Abanô — estrutura de LGPD
-- Como usar: copie este arquivo em texto puro (link "raw" do
-- GitHub, com a tradução do navegador DESLIGADA), cole no
-- SQL Editor do Supabase e clique em "Run". Pode rodar de novo.
-- Precisa ter rodado antes: lista_espera.sql e emails.sql.
-- =========================================================

-- ---------- 1. Registro do consentimento em cada cadastro ----------
alter table public.lista_espera add column if not exists consentiu_em      timestamptz default now();
alter table public.lista_espera add column if not exists versao_politica   text;
alter table public.lista_espera add column if not exists maior_de_idade    boolean;
alter table public.lista_espera add column if not exists descadastrado_em  timestamptz;

-- Cadastros novos só entram com consentimento e maioridade declarados
-- (NOT VALID: não mexe nos cadastros antigos, só nos novos)
do $$ begin
  alter table public.lista_espera add constraint lista_espera_consentimento
    check (versao_politica is not null and maior_de_idade is true) not valid;
exception when duplicate_object then null; end $$;

-- ---------- 2. Pedidos do titular (acesso, correção, exclusão...) ----------
create table if not exists public.solicitacoes_titular (
  id             bigint generated always as identity primary key,
  criado_em      timestamptz not null default now(),
  tipo           text not null check (tipo in ('acesso','correcao','exclusao','revogacao','portabilidade','informacao','outro')),
  nome           text not null check (char_length(nome) between 1 and 120),
  email          text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  mensagem       text check (char_length(mensagem) <= 2000),
  status         text not null default 'aberta' check (status in ('aberta','em_andamento','respondida')),
  respondida_em  timestamptz,
  observacoes    text
);
alter table public.solicitacoes_titular enable row level security;

drop policy if exists "visitantes podem enviar pedidos" on public.solicitacoes_titular;
create policy "visitantes podem enviar pedidos"
  on public.solicitacoes_titular for insert to anon with check (status = 'aberta' and respondida_em is null and observacoes is null);
revoke all on public.solicitacoes_titular from anon;
grant insert (tipo, nome, email, mensagem) on public.solicitacoes_titular to anon;

-- Aviso por e-mail para privacidade@abano.com.br a cada pedido novo
create or replace function public._aviso_pedido_titular() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.config_email;
begin
  select * into cfg from public.config_email where id = 1;
  if cfg is null then return new; end if;
  perform public._resend_lote(jsonb_build_array(jsonb_build_object(
    'from', cfg.remetente,
    'to', jsonb_build_array('privacidade@abano.com.br'),
    'reply_to', new.email,
    'subject', 'Pedido LGPD #' || new.id || ' (' || new.tipo || ') - responder em até 15 dias',
    'html', '<p><b>Novo pedido de titular de dados</b></p>'
         || '<p>Tipo: ' || public._esc(new.tipo) || '<br>Nome: ' || public._esc(new.nome)
         || '<br>E-mail: ' || public._esc(new.email) || '<br>Recebido em: ' || to_char(new.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '</p>'
         || '<p>Mensagem:<br>' || replace(public._esc(coalesce(new.mensagem,'(sem mensagem)')), E'\n', '<br>') || '</p>'
         || '<p>Prazo legal: 15 dias. Depois de responder, marque o pedido como "respondida" no Table Editor (solicitacoes_titular).</p>'
  )));
  return new;
exception when others then
  raise warning 'Abanô: aviso de pedido LGPD não enviado: %', sqlerrm;
  return new;
end $$;

drop trigger if exists solicitacoes_titular_aviso on public.solicitacoes_titular;
create trigger solicitacoes_titular_aviso
  after insert on public.solicitacoes_titular
  for each row execute function public._aviso_pedido_titular();

-- ---------- 3. Cancelar inscrição registra a data; excluir apaga tudo ----------
create or replace function public.descadastrar(p_token uuid) returns boolean
language sql security definer set search_path = public as $$
  update public.lista_espera
     set inscrito = false, descadastrado_em = coalesce(descadastrado_em, now())
   where token = p_token
  returning true;
$$;
revoke all on function public.descadastrar(uuid) from public;
grant execute on function public.descadastrar(uuid) to anon;

create or replace function public.excluir_meus_dados(p_token uuid) returns boolean
language sql security definer set search_path = public as $$
  delete from public.lista_espera where token = p_token returning true;
$$;
revoke all on function public.excluir_meus_dados(uuid) from public;
grant execute on function public.excluir_meus_dados(uuid) to anon;

-- ---------- 4. Retenção: apaga quem saiu da lista há mais de 30 dias ----------
create or replace function public.limpar_descadastrados() returns int
language sql security definer set search_path = public as $$
  with apagados as (
    delete from public.lista_espera
     where inscrito = false and descadastrado_em < now() - interval '30 days'
    returning 1
  ) select count(*)::int from apagados;
$$;
revoke all on function public.limpar_descadastrados() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-descadastrados';
  perform cron.schedule('abano-limpar-descadastrados', '0 6 * * *', 'select public.limpar_descadastrados()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza automática (ative a extensão pg_cron em Database > Extensions e rode de novo): %', sqlerrm;
end $$;

-- ---------- 5. Rodapé dos e-mails com link da política ----------
create or replace function public._email_html(titulo text, corpo text, botao_texto text, botao_link text, link_sair text)
returns text language sql immutable as $$
  select
  '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F2F2F7;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F7;padding:32px 12px;"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F;">'
  || '<tr><td style="padding:28px 32px 0;font-size:20px;font-weight:700;color:#1E4D45;">Abanô</td></tr>'
  || '<tr><td style="padding:16px 32px 0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;">' || titulo || '</td></tr>'
  || '<tr><td style="padding:14px 32px 0;font-size:16px;line-height:1.6;color:#3A3A3C;">' || corpo || '</td></tr>'
  || case when botao_link is not null then
       '<tr><td style="padding:24px 32px 0;"><a href="' || botao_link || '" style="display:inline-block;background:#1E4D45;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:999px;">' || botao_texto || '</a></td></tr>'
     else '' end
  || '<tr><td style="padding:32px 32px 28px;font-size:12px;line-height:1.6;color:#6E6E73;">Você recebe este e-mail porque entrou na lista de espera do Abanô. '
  || '<a href="' || link_sair || '" style="color:#6E6E73;">Cancelar inscrição ou excluir meus dados</a> · '
  || '<a href="' || split_part(link_sair, '/descadastrar.html', 1) || '/privacidade.html" style="color:#6E6E73;">Política de privacidade</a></td></tr>'
  || '</table></td></tr></table></body></html>';
$$;

-- Avisa a API do Supabase sobre as mudanças
notify pgrst, 'reload schema';

-- Conferência: deve listar 4 itens com "ok"
select 'consentimento na lista'   as item, case when exists (select 1 from information_schema.columns where table_name='lista_espera' and column_name='versao_politica') then 'ok' else 'FALTA' end as status
union all select 'tabela de pedidos',      case when to_regclass('public.solicitacoes_titular') is not null then 'ok' else 'FALTA' end
union all select 'excluir meus dados',     case when exists (select 1 from pg_proc where proname='excluir_meus_dados') then 'ok' else 'FALTA' end
union all select 'limpeza automática',     case when to_regclass('cron.job') is not null then 'ok' else 'FALTA (ative pg_cron em Database > Extensions e rode de novo)' end;
