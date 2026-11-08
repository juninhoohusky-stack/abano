-- =========================================================
-- Abanô — e-mails automáticos (boas-vindas e novidades)
-- Como usar: no Supabase, abra "SQL Editor", cole este
-- arquivo inteiro e clique em "Run". Pode rodar de novo
-- sem problema (ele não apaga cadastros).
--
-- Ele NÃO envia nada sozinho até você rodar o arquivo
-- supabase/ativar_emails.sql (com o domínio e a chave do Resend).
-- =========================================================

create extension if not exists pg_net;

-- ---------- Lista de espera: inscrição e token de descadastro ----------
alter table public.lista_espera add column if not exists inscrito boolean not null default true;
alter table public.lista_espera add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists lista_espera_token_unico on public.lista_espera (token);

-- ---------- Configuração (remetente e endereço do site) ----------
create table if not exists public.config_email (
  id        int primary key default 1 check (id = 1),
  remetente text not null,   -- ex.: Abanô <novidades@abano.com.br>
  site_url  text not null    -- ex.: https://juninhoohusky-stack.github.io/abano
);
alter table public.config_email enable row level security;   -- ninguém de fora lê

-- ---------- Registro das novidades já enviadas (evita envio duplicado) ----------
create table if not exists public.novidades_enviadas (
  id             text primary key,
  titulo         text not null,
  destinatarios  int  not null,
  enviada_em     timestamptz not null default now()
);
alter table public.novidades_enviadas enable row level security;

-- ---------- Funções auxiliares ----------

-- Escapa texto digitado pelo visitante antes de colocar no e-mail
create or replace function public._esc(t text) returns text
language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t,''), '&','&amp;'), '<','&lt;'), '>','&gt;'), '"','&quot;');
$$;

-- Monta o HTML do e-mail no visual do Abanô
create or replace function public._email_html(titulo text, corpo text, botao_texto text, botao_link text, link_sair text)
returns text language sql immutable as $$
  select
  '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#F2F2F7;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F7;padding:32px 12px;"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;color:#1D1D1F;">'
  || '<tr><td style="padding:28px 32px 0;font-size:20px;font-weight:700;color:#1F5A4F;">Abanô</td></tr>'
  || '<tr><td style="padding:16px 32px 0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;">' || titulo || '</td></tr>'
  || '<tr><td style="padding:14px 32px 0;font-size:16px;line-height:1.6;color:#3A3A3C;">' || corpo || '</td></tr>'
  || case when botao_link is not null then
       '<tr><td style="padding:24px 32px 0;"><a href="' || botao_link || '" style="display:inline-block;background:#1F5A4F;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:999px;">' || botao_texto || '</a></td></tr>'
     else '' end
  || '<tr><td style="padding:32px 32px 28px;font-size:12px;line-height:1.6;color:#6E6E73;">Você recebe este e-mail porque entrou na lista de espera do Abanô. '
  || '<a href="' || link_sair || '" style="color:#6E6E73;">Cancelar inscrição</a></td></tr>'
  || '</table></td></tr></table></body></html>';
$$;

-- Envia um lote de até 100 e-mails pelo Resend (a chave fica no Vault do Supabase)
create or replace function public._resend_lote(emails jsonb) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare chave text; pedido bigint;
begin
  select decrypted_secret into chave from vault.decrypted_secrets where name = 'resend_api_key';
  if chave is null then
    raise exception 'Chave do Resend não encontrada no Vault (nome: resend_api_key)';
  end if;
  select net.http_post(
    url     := 'https://api.resend.com/emails/batch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || chave, 'Content-Type', 'application/json'),
    body    := emails
  ) into pedido;
  return pedido;
end $$;
revoke all on function public._resend_lote(jsonb) from public, anon, authenticated;

-- ---------- Boas-vindas: dispara logo depois de cada cadastro ----------
create or replace function public._boas_vindas() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.config_email; sair text;
begin
  select * into cfg from public.config_email where id = 1;
  if cfg is null then return new; end if;            -- e-mails ainda não ativados
  sair := cfg.site_url || '/descadastrar.html?t=' || new.token;
  perform public._resend_lote(jsonb_build_array(jsonb_build_object(
    'from', cfg.remetente,
    'to', jsonb_build_array(new.email),
    'subject', 'Bem-vindo(a) ao Abanô, tutor fundador',
    'html', public._email_html(
      'Que bom ter você aqui, ' || public._esc(split_part(new.nome, ' ', 1)) || '!',
      'Você agora é um <b>tutor fundador</b> do Abanô.'
        || case when coalesce(new.nome_pet,'') <> '' then ' Mande um carinho pro(a) <b>' || public._esc(new.nome_pet) || '</b> por nós.' else '' end
        || '<br><br>Toda novidade que publicarmos chega primeiro no seu e-mail: novas ferramentas, guias de cuidado e os encontros de tutores. '
        || 'Enquanto isso, já dá pra usar a calculadora de custos e ler o Guia do Husky.',
      'Conhecer o Abanô', cfg.site_url || '/', sair),
    'headers', jsonb_build_object('List-Unsubscribe', '<' || sair || '>')
  )));
  return new;
exception when others then
  raise warning 'Abanô: boas-vindas não enviada para %: %', new.email, sqlerrm;
  return new;                                         -- o cadastro nunca falha por causa do e-mail
end $$;

drop trigger if exists lista_espera_boas_vindas on public.lista_espera;
create trigger lista_espera_boas_vindas
  after insert on public.lista_espera
  for each row execute function public._boas_vindas();

-- ---------- Novidades: envia um post para todos os inscritos (uma vez só) ----------
create or replace function public.disparar_novidade(p_id text, p_titulo text, p_resumo text, p_link text)
returns int language plpgsql security definer set search_path = public as $$
declare cfg public.config_email; lote jsonb := '[]'::jsonb; n int := 0; total int := 0; r record; sair text;
begin
  if exists (select 1 from public.novidades_enviadas where id = p_id) then return 0; end if;
  select * into cfg from public.config_email where id = 1;
  if cfg is null then raise exception 'E-mails ainda não ativados (config_email vazia)'; end if;

  for r in select email, token from public.lista_espera where inscrito order by id loop
    sair := cfg.site_url || '/descadastrar.html?t=' || r.token;
    lote := lote || jsonb_build_array(jsonb_build_object(
      'from', cfg.remetente,
      'to', jsonb_build_array(r.email),
      'subject', 'Novidade no Abanô: ' || p_titulo,
      'html', public._email_html(public._esc(p_titulo), public._esc(p_resumo), 'Ler a novidade', p_link, sair),
      'headers', jsonb_build_object('List-Unsubscribe', '<' || sair || '>')
    ));
    n := n + 1; total := total + 1;
    if n = 100 then perform public._resend_lote(lote); lote := '[]'::jsonb; n := 0; end if;
  end loop;
  if n > 0 then perform public._resend_lote(lote); end if;

  insert into public.novidades_enviadas (id, titulo, destinatarios) values (p_id, p_titulo, total);
  return total;
end $$;
revoke all on function public.disparar_novidade(text, text, text, text) from public, anon, authenticated;
grant execute on function public.disparar_novidade(text, text, text, text) to service_role;

-- ---------- Cancelar inscrição (usado pela página descadastrar.html) ----------
create or replace function public.descadastrar(p_token uuid) returns boolean
language sql security definer set search_path = public as $$
  update public.lista_espera set inscrito = false where token = p_token returning true;
$$;
revoke all on function public.descadastrar(uuid) from public;
grant execute on function public.descadastrar(uuid) to anon;

-- Avisa a API do Supabase que existem funções novas
notify pgrst, 'reload schema';

-- Conferência: deve listar 4 funções
select proname as funcao_criada from pg_proc
where proname in ('_boas_vindas', '_resend_lote', 'disparar_novidade', 'descadastrar')
order by 1;
