# Abanô

Tem pet? Tem no Abanô. Tudo pra cães e gatos, num lugar só, perto de você. Site estático (HTML, CSS e JavaScript puros), publicado no GitHub Pages. A lista de espera é salva no Supabase.

## Páginas

| Arquivo | O que é |
| --- | --- |
| `index.html` | Página inicial: apresentação, serviços e história |
| `cadastro.html` | Cadastre-se (lista de espera, com login Google) |
| `anuncie.html` | Divulgue no Abanô (pedidos de anunciantes) |
| `eventos.html`, `hospedagem.html`, `veterinarios.html`, `adocao.html`, `perdidos.html`, `perfil-qr.html`, `doador-de-sangue.html` | Serviços "Em breve" (estrutura inicial, para completar) |
| `calculadora.html` | Calculadora de custos do pet |
| `loja.html` | Achadinhos da Abanô (aba própria no menu): produtos de afiliado da Shopee e do Mercado Livre, em duas áreas, "Para os animais" e "Para quem ama pets" (robô diário) |
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

Página própria (`anuncie.html`) para organizadores de eventos e negócios pet pedirem divulgação.

1. Rode `supabase/anunciantes.sql` no SQL Editor (depois de `emails.sql`).
2. No ImprovMX, encaminhe `contato@abano.com.br` para o seu e-mail. Cada pedido novo chega lá, e é só responder.
3. Os pedidos ficam em **Table Editor → anunciantes**. Atualize o `status` (`em_conversa`, `fechado` ou `descartado`). Pedidos com mais de 2 anos são apagados sozinhos.

## Cadastro com conta Google

Botão "Continuar com o Google" no formulário da lista (`google.js`). Usa o login do Supabase com o provedor Google; a sessão fica só na memória da página e serve para preencher e confirmar nome e e-mail. O banco só aceita cadastro via Google com o e-mail da própria conta.

1. Google Cloud: tela de consentimento OAuth e um *OAuth client ID* (Web) com a URI de redirecionamento `https://igpwzidpiypzukmnskdb.supabase.co/auth/v1/callback`.
2. Supabase: Authentication → Providers → Google (Client ID e Client Secret) e URL Configuration (Site URL `https://abano.com.br`, Redirect URL `https://abano.com.br/**`).
3. Rode `supabase/google.sql`.
4. Em `lista.js`, troque `LOGIN_GOOGLE_ATIVO` para `true`.

## Achadinhos da Abanô (afiliados Shopee e Mercado Livre)

A página `loja.html` mostra os produtos de `dados/loja-catalogo.json` em duas áreas: **Para os animais** (cães, gatos, aves, hamsters e pequenos animais, peixes, répteis e outros animais, cada um com suas subcategorias) e **Para quem ama pets** (casa sem pelos, limpeza e lavanderia, casa organizada, ar e clima, passeio e rotina, conforto do tutor, carro e viagens). Na abertura ficam as vitrines Ofertas do dia, Novidades, Mais procurados e Achadinhos para os tutores. Depois vem a lista completa, com busca, filtros (área, categoria, subcategoria, loja, faixa de preço, só com desconto, só novidades) e ordenação. Três vezes por dia, à 0h, às 6h e às 18h (horário de Brasília), o robô `scripts/robo-loja.mjs` (pela automação `.github/workflows/robo-loja.yml`) faz o seguinte:

- procura cada produto na Shopee (entre os mais vendidos e os mais relevantes) e no Mercado Livre;
- nos produtos para os animais, só aceita **produto de pet** (o título precisa falar de pet, cão, gato, ave, peixe etc.). Os itens "Para quem ama pets" (aspirador, ar-condicionado, capa de sofá, limpeza...) não precisam, porque servem para a casa toda;
- nas rações, só marcas premium e super premium. Royal Canin, Hill's, PremieR, Pro Plan, Farmina N&D, Guabi Natural, Fórmula Natural Fresh Meat, Biofresh, BioNatural e Quatree têm itens próprios no catálogo (`porMarca`), que trazem vários anúncios de cada marca (`quantos`), de todos os pesos e tipos, secas e úmidas;
- só aceita **loja confiável**. Na Shopee: Shopee Mall ou loja Indicada/Indicada+, nota do produto e da loja de pelo menos 4,7 e pelo menos 6 vendas daquele mesmo anúncio. No Mercado Livre: termômetro verde, MercadoLíder Gold ou Platinum (ou loja oficial), pelo menos 500 vendas e 95% de avaliações positivas. Os números ficam em `REGRAS`, no começo do robô;
- nunca aceita as lojas de `dados/lojas-bloqueadas.json` (coloque ali o nome ou o código de qualquer loja com reclamação);
- entre os que passam, escolhe o que tem mais chance de vender: mais vendas, preço abaixo dos parecidos, desconto, nota e comissão;
- grava os anúncios escolhidos na tabela `ofertas`, já com o link de afiliado;
- tira do site o anúncio que não reencontra há 2 dias.

Na Shopee, o link vem pronto da API oficial de afiliados. No Mercado Livre, o robô coloca sua etiqueta no link (`matt_word` e `matt_tool`). Quem clica compra direto do vendedor, e a comissão fica registrada na sua conta de afiliado. A página `ofertas.html` mostra só os produtos com desconto.

**Aviso ao comprador.** A página dos Achadinhos tem um aviso fixo: a Abanô não vende os produtos, eles são vendidos por lojas da Shopee (e do Mercado Livre), a Abanô não responde por problemas na compra e só recebe comissão de afiliado. Em qualquer página do site, o clique num link de afiliado (`rel="sponsored"`) abre antes uma janela com esse aviso (feita em `site.js`). A pessoa só segue para a loja depois de marcar "Li e estou ciente".

### Ativar (uma vez)

1. Rode `supabase/loja_afiliados.sql` no SQL Editor.
2. **Shopee:** em [affiliate.shopee.com.br/open_api](https://affiliate.shopee.com.br/open_api), peça acesso à API e copie o *AppID* e a *Secret*.
3. **Mercado Livre:**
   - no portal de afiliados, abra o Gerador de links, gere o link de um produto qualquer e copie os valores de `matt_word` (sua etiqueta) e de `matt_tool`;
   - em [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br/devcenter), crie um aplicativo e copie o *Client ID* e a *Client Secret*.
4. No GitHub, em Settings → Secrets and variables → Actions, crie os segredos `SHOPEE_APP_ID`, `SHOPEE_SECRET`, `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_ETIQUETA` e `ML_MATT_TOOL`. O `SUPABASE_SECRET_KEY` já existe.
5. Na aba Actions, abra "Robô dos Achadinhos" e clique em *Run workflow*. O resumo da rodada mostra o que entrou e o que ficou sem anúncio. Se faltarem os segredos de uma loja, o robô pula só essa loja.

### Mudar os produtos

Edite `dados/loja-catalogo.json` direto. Em cada item:

- `busca` é o que o robô procura nas lojas;
- `marcas` define as marcas que uma ração precisa ter no título;
- `area` (`animais` ou `tutor`), `cat` e `sub` dizem onde o produto aparece na página;
- `pet` e `nicho` são o que o robô grava na tabela `ofertas` e precisam ser valores que o banco aceita (veja `supabase/loja_afiliados.sql`). Para os itens do tutor e de "outros animais", use `pet` = `todos`.

## Publicar

Todo envio (`git push`) para a branch `main` atualiza o site no GitHub Pages em alguns minutos.

O GitHub Pages deixa os navegadores guardarem arquivos por 10 minutos. Ao mudar `lista.js` ou `google.js`, troque o número em `?v=` nas tags `<script>` das páginas (ex.: `lista.js?v=20261109` → `?v=20261110`) para todos baixarem a versão nova na hora.
