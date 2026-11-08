# Abanô

Tem pet? Tem no Abanô. Tudo pra cães e gatos, num lugar só, perto de você. Site estático (HTML, CSS e JavaScript puros), publicado no GitHub Pages. A lista de espera é salva no Supabase.

## Páginas

| Arquivo | O que é |
| --- | --- |
| `index.html` | Página inicial e formulário da lista de espera |
| `calculadora.html` | Calculadora de custos do pet |
| `husky-solta-muito-pelo.html` | Artigo do Guia do Husky |
| `obrigado.html` | Página exibida depois do cadastro |

Arquivos compartilhados: `site.css` (visual), `site.js` (abas) e `lista.js` (envio da lista de espera para o Supabase).

## Como editar o que muda com frequência

- **Preços da calculadora:** em `calculadora.html`, no bloco `PRECOS` do script.
- **Vídeo e produtos do artigo:** em `husky-solta-muito-pelo.html`, em `VIDEO_ID` e `PRODUTOS`.
- **Supabase:** em `lista.js`, em `SUPABASE_URL` e `SUPABASE_CHAVE` (use só a chave pública *anon/publishable*).

## Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode o arquivo `supabase/lista_espera.sql`.
3. Copie a *Project URL* e a chave pública para `lista.js`.
4. Os cadastros aparecem em **Table Editor → lista_espera**.

## E-mails automáticos

- **Boas-vindas:** enviadas pelo Supabase logo depois de cada cadastro.
- **Novidades:** cada post novo em `novidades.json` aparece na página `novidades.html` e é enviado uma única vez para todos os inscritos, pela automação `.github/workflows/novidades.yml`.
- **Cancelar inscrição:** todo e-mail tem o link para `descadastrar.html`.

Envio pelo [Resend](https://resend.com), com remetente no domínio próprio.

### Ativar (uma vez)

1. Rode `supabase/emails.sql` no SQL Editor do Supabase.
2. No Resend, adicione e verifique o domínio e crie uma chave de API.
3. Preencha e rode `supabase/ativar_emails.sql` (chave do Resend fica no Vault do Supabase).
4. No GitHub: Settings → Secrets and variables → Actions → *New repository secret* chamado `SUPABASE_SECRET_KEY`, com a chave secreta do Supabase (`sb_secret_...`).

### Publicar uma novidade

Adicione um item no começo de `novidades.json` com um `id` novo e único, e envie para o GitHub. O e-mail sai sozinho cerca de 2 minutos depois.

## Publicar

Todo envio (`git push`) para a branch `main` atualiza o site no GitHub Pages em alguns minutos.
