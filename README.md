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

## LGPD

- **Consentimento:** caixa obrigatória (desmarcada) no formulário. Cada cadastro guarda `consentiu_em`, `versao_politica` e `maior_de_idade`. Ao mudar a política, atualize a data em `privacidade.html` e `VERSAO_POLITICA` em `lista.js`.
- **Política:** `privacidade.html` (controlador, finalidades e bases legais, operadores, transferência internacional, retenção, direitos, cookies, incidentes).
- **Pedidos do titular:** `seus-dados.html` grava em `solicitacoes_titular` e avisa `privacidade@abano.com.br`. Prazo de resposta: 15 dias. Marque como `respondida` no Table Editor.
- **Exclusão em autoatendimento:** o link dos e-mails (`descadastrar.html`) permite cancelar ou apagar tudo na hora.
- **Retenção:** quem cancela é apagado em 30 dias (job diário `abano-limpar-descadastrados` no pg_cron).
- **SQL:** `supabase/lgpd.sql` (rode depois de `lista_espera.sql` e `emails.sql`).

## Divulgue no Abanô (anunciantes)

Seção no fim da página inicial (`index.html#anuncie`) para organizadores de eventos e negócios pet pedirem divulgação.

1. Rode `supabase/anunciantes.sql` no SQL Editor (depois de `emails.sql`).
2. No ImprovMX, encaminhe `contato@abano.com.br` para o seu e-mail. Cada pedido novo chega lá, e é só responder.
3. Os pedidos ficam em **Table Editor → anunciantes**. Atualize o `status` (`em_conversa`, `fechado` ou `descartado`). Pedidos com mais de 2 anos são apagados sozinhos.

## Cadastro com conta Google

Botão "Continuar com o Google" no formulário da lista (`google.js`). Usa o login do Supabase com o provedor Google; a sessão fica só na memória da página e serve para preencher e confirmar nome e e-mail. O banco só aceita cadastro via Google com o e-mail da própria conta.

1. Google Cloud: tela de consentimento OAuth e um *OAuth client ID* (Web) com a URI de redirecionamento `https://igpwzidpiypzukmnskdb.supabase.co/auth/v1/callback`.
2. Supabase: Authentication → Providers → Google (Client ID e Client Secret) e URL Configuration (Site URL `https://abano.com.br`, Redirect URL `https://abano.com.br/**`).
3. Rode `supabase/google.sql`.
4. Em `lista.js`, troque `LOGIN_GOOGLE_ATIVO` para `true`.

## Publicar

Todo envio (`git push`) para a branch `main` atualiza o site no GitHub Pages em alguns minutos.
