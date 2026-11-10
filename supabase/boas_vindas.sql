-- =========================================================
-- Abanô — novo e-mail de boas-vindas (foco na Comunidade)
-- Troca o texto "tutor fundador" pelo convite para a Comunidade.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Não envia nenhum e-mail ao rodar.
-- =========================================================

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
    'subject', 'Boas-vindas à Comunidade Abanô',
    'html', public._email_html(
      'Que bom ter você aqui, ' || public._esc(split_part(new.nome, ' ', 1)) || '!',
      'Agora você faz parte da <b>Comunidade Abanô</b>, um espaço para compartilhar experiências, conhecer outros tutores e descobrir o universo pet.'
        || case when coalesce(new.nome_pet,'') <> '' then ' Mande um carinho pro(a) <b>' || public._esc(new.nome_pet) || '</b> por nós.' else '' end
        || '<br><br>Para começar: monte o perfil do seu pet, entre no clube da sua raça ou do seu estado e faça a sua primeira pergunta. '
        || 'As novidades do Abanô vão chegar por aqui, no seu e-mail.',
      'Ir para a Comunidade', cfg.site_url || '/comunidade/', sair),
    'headers', jsonb_build_object('List-Unsubscribe', '<' || sair || '>')
  )));
  return new;
exception when others then
  raise warning 'Abanô: boas-vindas não enviada para %: %', new.email, sqlerrm;
  return new;                                         -- o cadastro nunca falha por causa do e-mail
end $$;

-- Conferência: deve mostrar "ok"
select case when exists (select 1 from pg_proc where proname = '_boas_vindas' and prosrc like '%Comunidade Abanô%') then 'ok' else 'FALTA' end as boas_vindas;
