-- =========================================================
-- Abanô — pedidos de quem quer divulgar no site
-- (organizadores de eventos, hotéis, clínicas, lojas, ONGs...)
-- Como usar: copie este arquivo em texto puro (link "raw" do
-- GitHub, com a tradução do navegador DESLIGADA), cole no
-- SQL Editor do Supabase e clique em "Run". Pode rodar de novo.
-- Precisa ter rodado antes: emails.sql (para o aviso por e-mail).
--
-- Os pedidos aparecem em Table Editor → anunciantes.
-- Depois de responder, mude o "status" para em_conversa,
-- fechado ou descartado.
-- =========================================================

create table if not exists public.anunciantes (
  id               bigint generated always as identity primary key,
  criado_em        timestamptz not null default now(),
  tipo             text not null check (tipo in ('evento','hospedagem','veterinario','banho_tosa','adestramento','loja','ong','outro')),
  nome             text not null check (char_length(nome) between 1 and 120),
  email            text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp         text check (char_length(whatsapp) <= 30),
  negocio          text not null check (char_length(negocio) between 1 and 160),
  cidade           text not null check (char_length(cidade) between 1 and 120),
  mensagem         text check (char_length(mensagem) <= 2000),
  versao_politica  text not null,
  status           text not null default 'novo' check (status in ('novo','em_conversa','fechado','descartado')),
  observacoes      text
);
alter table public.anunciantes enable row level security;

-- Visitantes só podem ENVIAR. Ninguém de fora lê a tabela.
drop policy if exists "visitantes podem pedir divulgacao" on public.anunciantes;
create policy "visitantes podem pedir divulgacao"
  on public.anunciantes for insert to anon
  with check (status = 'novo' and observacoes is null);
revoke all on public.anunciantes from anon;
grant insert (tipo, nome, email, whatsapp, negocio, cidade, mensagem, versao_politica) on public.anunciantes to anon;

-- ---------- Aviso por e-mail a cada pedido novo ----------
-- ✏️ Troque o endereço abaixo se quiser receber em outro e-mail.
--    Ele precisa estar encaminhado no ImprovMX (como o privacidade@).
create or replace function public._aviso_anunciante() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cfg public.config_email;
  destino constant text := 'contato@abano.com.br';
begin
  select * into cfg from public.config_email where id = 1;
  if cfg is null then return new; end if;
  perform public._resend_lote(jsonb_build_array(jsonb_build_object(
    'from', cfg.remetente,
    'to', jsonb_build_array(destino),
    'reply_to', new.email,
    'subject', 'Quer divulgar no Abanô: ' || left(new.negocio, 80) || ' (' || new.cidade || ')',
    'html', '<p><b>Novo pedido de divulgação</b></p>'
         || '<p>Tipo: ' || public._esc(new.tipo)
         || '<br>Evento ou negócio: ' || public._esc(new.negocio)
         || '<br>Cidade: ' || public._esc(new.cidade)
         || '<br>Nome: ' || public._esc(new.nome)
         || '<br>E-mail: ' || public._esc(new.email)
         || '<br>WhatsApp: ' || public._esc(coalesce(new.whatsapp, '(não informado)'))
         || '<br>Recebido em: ' || to_char(new.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '</p>'
         || '<p>Mensagem:<br>' || replace(public._esc(coalesce(new.mensagem, '(sem mensagem)')), E'\n', '<br>') || '</p>'
         || '<p>Responda este e-mail para falar direto com a pessoa. Depois, atualize o status em Table Editor → anunciantes.</p>'
  )));
  return new;
exception when others then
  raise warning 'Abanô: aviso de anunciante não enviado: %', sqlerrm;
  return new;
end $$;

drop trigger if exists anunciantes_aviso on public.anunciantes;
create trigger anunciantes_aviso
  after insert on public.anunciantes
  for each row execute function public._aviso_anunciante();

-- ---------- Retenção: apaga pedidos com mais de 2 anos ----------
-- (prazo informado na Política de privacidade)
create or replace function public.limpar_anunciantes_antigos() returns int
language sql security definer set search_path = public as $$
  with apagados as (
    delete from public.anunciantes where criado_em < now() - interval '2 years' returning 1
  ) select count(*)::int from apagados;
$$;
revoke all on function public.limpar_anunciantes_antigos() from public, anon, authenticated;

do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-anunciantes';
  perform cron.schedule('abano-limpar-anunciantes', '15 6 * * *', 'select public.limpar_anunciantes_antigos()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza (ative pg_cron em Database > Extensions e rode de novo): %', sqlerrm;
end $$;

-- Avisa a API do Supabase sobre as mudanças
notify pgrst, 'reload schema';

-- Conferência: deve listar 3 itens com "ok"
select 'tabela de anunciantes' as item, case when to_regclass('public.anunciantes') is not null then 'ok' else 'FALTA' end as status
union all select 'aviso por e-mail', case when exists (select 1 from pg_trigger where tgname = 'anunciantes_aviso') then 'ok' else 'FALTA' end
union all select 'limpeza automática', case when exists (select 1 from pg_extension where extname = 'pg_cron') then 'ok' else 'FALTA (ative pg_cron em Database > Extensions e rode de novo)' end;
