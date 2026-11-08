-- =========================================================
-- Abanô — ATIVAR os e-mails (rode só depois de:
--   1) comprar o domínio e verificá-lo no Resend
--   2) criar a chave de API no Resend)
--
-- Troque só o valor marcado com ✏️ (a chave do Resend) e rode no SQL Editor.
-- Pode rodar quantas vezes quiser: se a chave já existir, ela é atualizada.
-- A chave do Resend fica guardada no Vault (cofre criptografado)
-- do Supabase. Não envie essa chave para ninguém e, depois de rodar,
-- apague a chave deste editor (troque por APAGADA ou feche sem salvar).
-- =========================================================

-- 1) Chave do Resend: cria ou atualiza
do $$
declare chave text := 'COLE_AQUI_A_CHAVE_DO_RESEND';   -- ✏️ cole a chave (começa com re_)
begin
  if chave like 'COLE_AQUI%' or chave = 'APAGADA' then
    raise exception 'Cole a chave do Resend no lugar de COLE_AQUI_A_CHAVE_DO_RESEND antes de rodar.';
  end if;
  if exists (select 1 from vault.secrets where name = 'resend_api_key') then
    perform vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), chave);
  else
    perform vault.create_secret(chave, 'resend_api_key', 'Chave do Resend para os e-mails do Abanô');
  end if;
end $$;

-- 2) Remetente (domínio abano.com.br, verificado no Resend)
-- 3) Endereço do site (sem barra no final)
insert into public.config_email (id, remetente, site_url)
values (1, 'Abanô <novidades@abano.com.br>', 'https://abano.com.br')
on conflict (id) do update set remetente = excluded.remetente, site_url = excluded.site_url;
