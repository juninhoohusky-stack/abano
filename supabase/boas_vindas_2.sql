-- =========================================================
-- Abanô — e-mail de boas-vindas novo (sem "tutor fundador")
-- Apresenta o que tem no Abanô: Comunidade, clubes, adoção,
-- pet desaparecido, Agenda Pet, perfil QR, guias e mais.
-- Também atualiza o visual dos e-mails para as cores atuais
-- (vale para as boas-vindas e para as novidades).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Não envia nenhum e-mail ao rodar.
-- =========================================================

-- Visual dos e-mails (cores do Abanô e rodapé atualizado)
create or replace function public._email_html(titulo text, corpo text, botao_texto text, botao_link text, link_sair text)
returns text language sql immutable as $$
  select
  '<!doctype html><html lang="pt-BR"><body style="margin:0;padding:0;background:#FFF7F5;">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7F5;padding:32px 12px;"><tr><td align="center">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;color:#2B1622;">'
  || '<tr><td style="padding:28px 32px 0;"><img src="https://abano.com.br/icone-192.png" width="40" height="40" alt="" style="vertical-align:middle;border-radius:10px;"> '
  || '<span style="vertical-align:middle;font-size:22px;font-weight:800;color:#D10F5E;">abanô</span></td></tr>'
  || '<tr><td style="padding:18px 32px 0;font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;">' || titulo || '</td></tr>'
  || '<tr><td style="padding:14px 32px 0;font-size:16px;line-height:1.6;color:#4A3440;">' || corpo || '</td></tr>'
  || case when botao_link is not null then
       '<tr><td style="padding:24px 32px 0;"><a href="' || botao_link || '" style="display:inline-block;background:#D10F5E;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:13px 24px;border-radius:999px;">' || botao_texto || '</a></td></tr>'
     else '' end
  || '<tr><td style="padding:32px 32px 28px;font-size:12px;line-height:1.6;color:#6B5462;">Você recebe este e-mail porque criou sua conta no Abanô e pediu para receber as novidades. '
  || '<a href="' || link_sair || '" style="color:#6B5462;">Cancelar inscrição</a></td></tr>'
  || '</table></td></tr></table></body></html>';
$$;

-- Item da lista "o que tem no Abanô"
create or replace function public._email_item(icone text, titulo text, texto text, link text)
returns text language sql immutable as $$
  select '<tr><td style="padding:10px 0;border-top:1px solid #F3E4EA;">'
    || '<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
    || '<td style="width:40px;font-size:24px;vertical-align:top;">' || icone || '</td>'
    || '<td style="font-size:15px;line-height:1.5;color:#4A3440;"><a href="' || link || '" style="color:#D10F5E;font-weight:700;text-decoration:none;">' || titulo || '</a><br>' || texto || '</td>'
    || '</tr></table></td></tr>';
$$;

-- Boas-vindas: dispara logo depois de cada cadastro
create or replace function public._boas_vindas() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg public.config_email; sair text; s text;
begin
  select * into cfg from public.config_email where id = 1;
  if cfg is null then return new; end if;            -- e-mails ainda não ativados
  sair := cfg.site_url || '/descadastrar.html?t=' || new.token;
  s := cfg.site_url;
  perform public._resend_lote(jsonb_build_array(jsonb_build_object(
    'from', cfg.remetente,
    'to', jsonb_build_array(new.email),
    'subject', 'Boas-vindas ao Abanô! Veja tudo o que você encontra aqui',
    'html', public._email_html(
      'Que bom ter você aqui' || case when coalesce(new.nome,'') <> '' then ', ' || public._esc(split_part(new.nome, ' ', 1)) else '' end || '!',
      'O Abanô reúne num lugar só tudo o que faz bem para quem vive com pets, seja cão, gato, ave, coelho, peixe ou réptil.'
        || case when coalesce(new.nome_pet,'') <> '' then ' Mande um carinho pro(a) <b>' || public._esc(new.nome_pet) || '</b> por nós.' else '' end
        || ' Olha o que já está esperando por você:'
        || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">'
        || public._email_item('💬', 'Comunidade', 'Poste fotos, tire dúvidas e converse com outros tutores.', s || '/comunidade/')
        || public._email_item('🐾', 'Clubes', 'Entre no clube da raça do seu pet, do seu estado ou no Clube dos Vira-latas.', s || '/comunidade/')
        || public._email_item('🏠', 'Adoção', 'Pets esperando um lar, anunciados por ONGs, protetores e tutores.', s || '/adocao.html')
        || public._email_item('📢', 'Pet desaparecido', 'Alertas de pets perdidos e encontrados perto de você.', s || '/perdidos.html')
        || public._email_item('📅', 'Agenda Pet', 'Encontros de raça, feiras de adoção e eventos pet de todo o Brasil.', s || '/eventos.html')
        || public._email_item('🪪', 'Perfil do pet com QR Code', 'Uma plaquinha com QR Code para quem encontrar o seu pet falar com você.', s || '/perfil-qr.html')
        || public._email_item('🩸', 'Doação de sangue', 'Cadastre seu pet como doador e ajude a salvar vidas.', s || '/doador-de-sangue.html')
        || public._email_item('📚', 'Guia pet e calculadora', 'Dicas práticas de cuidado e quanto custa ter um cão ou gato.', s || '/guia/')
        || '</table>'
        || '<br>Para começar, monte o perfil do seu pet e entre num clube. As novidades e os grandes eventos pet vão chegar por aqui, no seu e-mail.',
      'Entrar na Comunidade', s || '/comunidade/', sair),
    'headers', jsonb_build_object('List-Unsubscribe', '<' || sair || '>')
  )));
  return new;
exception when others then
  raise warning 'Abanô: boas-vindas não enviada para %: %', new.email, sqlerrm;
  return new;                                         -- o cadastro nunca falha por causa do e-mail
end $$;

-- Conferência: deve mostrar "ok" nas duas colunas
select
  case when exists (select 1 from pg_proc where proname = '_boas_vindas' and prosrc like '%Clube dos Vira-latas%') then 'ok' else 'FALTA' end as boas_vindas,
  case when exists (select 1 from pg_proc where proname = '_email_html' and prosrc like '%#D10F5E%') then 'ok' else 'FALTA' end as visual;
