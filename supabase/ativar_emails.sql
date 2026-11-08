-- =========================================================
-- Abanô — ATIVAR os e-mails (rode só depois de:
--   1) comprar o domínio e verificá-lo no Resend
--   2) criar a chave de API no Resend)
--
-- Troque só o valor marcado com ✏️ (a chave do Resend) e rode no SQL Editor.
-- A chave do Resend fica guardada no Vault (cofre criptografado)
-- do Supabase. Não envie essa chave para ninguém.
-- =========================================================

-- ✏️ 1) Cole a chave do Resend (começa com re_)
select vault.create_secret('COLE_AQUI_A_CHAVE_DO_RESEND', 'resend_api_key', 'Chave do Resend para os e-mails do Abanô');

-- 2) Remetente (domínio abano.com.br, verificado no Resend)
-- 3) Endereço do site (sem barra no final)
insert into public.config_email (id, remetente, site_url)
values (1, 'Abanô <novidades@abano.com.br>', 'https://juninhoohusky-stack.github.io/abano')
on conflict (id) do update set remetente = excluded.remetente, site_url = excluded.site_url;

-- Para trocar a chave depois:
--   select vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), 'NOVA_CHAVE');
