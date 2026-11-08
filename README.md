# Abanô

Tudo pro seu pet, perto de você. Site estático (HTML, CSS e JavaScript puros), publicado no GitHub Pages. A lista de espera é salva no Supabase.

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

## Publicar

Todo envio (`git push`) para a branch `main` atualiza o site no GitHub Pages em alguns minutos.
