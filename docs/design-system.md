# Design system do Abanô

Guia de referência para criar ou ajustar páginas sem perder a cara do Abanô.
Todos os tokens ficam no começo do `site.css` (`:root`), com versão para o modo escuro logo abaixo.
**Regra de ouro:** use sempre um token. Se nenhum serve, crie um token novo aqui, em vez de escrever um número solto na página.

---

## Auditoria (9 de novembro de 2026)

**Peças revisadas:** 9 componentes e 6 grupos de tokens | **Problemas encontrados:** 12 | **Nota:** 90/100 depois das correções (era 58)

### Cobertura de tokens

| Categoria | Tokens | Valores soltos antes | Valores soltos depois |
|---|---|---|---|
| Tipografia | 17 | 29 tamanhos fixos e 29 tamanhos de título | 0, exceto logo e letras dos avatares |
| Cores | 25 por tema | 107 códigos de cor nas páginas | 61, quase todos branco puro sobre a marca e cores do desenho do logo |
| Cantos | 6 + círculo | 24 valores diferentes | 0, exceto detalhes de 2 e 6 px |
| Sombras | 4 | 38 sombras diferentes | anéis de foco e bordas internas, que são funcionais |
| Movimento | 3 durações + 3 curvas | durações variadas | durações criadas agora; usar daqui em diante |
| Espaçamento | 13 (`--e-1` a `--e-24`) | 1.123 espaçamentos com valores soltos (116 combinações) | 55, só no menu do topo, nas abas e no logo, que têm encaixe justo |

### O que foi corrigido nesta revisão
1. Escala de cantos com hierarquia, no lugar de 24 valores soltos.
2. Sombras em 3 níveis com papel definido.
3. Cores repetidas viraram tokens com nome: faixa, perigo, marca sobre branco, texto sobre fundo claro.
4. Retiradas as marcas de "site genérico":
   - números 01/02/03 em itens que não são sequência;
   - rótulos em CAIXA ALTA espaçada;
   - seta "→" grudada em links;
   - rótulos acima de cada título da página inicial;
   - animação de "subir ao rolar" em todo bloco de todas as páginas.

5. Espaçamentos (padding, margin e gap) trocados pela escala de 13 degraus. As páginas ficaram de 0,6% a 4% mais curtas e nenhuma ganhou rolagem lateral.
6. Topo do site: com o "Entrar", o menu passava da borda em telas a partir de 1200 px. Agora "Nossa história" e "Divulgue" ficam no "Mais" no computador (e "Novidades" também, entre 901 e 1023 px).

### Próximas prioridades
1. **Componentes nas páginas antigas:** algumas páginas de serviço repetem estilos de cartão e botão no próprio `<style>`. Mover o que se repete para o `site.css`.
2. **Durações:** trocar `.2s`, `.25s` etc. por `var(--dur-rapida)`, `var(--dur)` e `var(--dur-lenta)` ao editar cada arquivo.

---

## Princípios

- **Uma peça marcante por tela.** A página inicial tem o Juninho passeando; as outras páginas ficam calmas e objetivas.
- **Movimento responde à pessoa.** Animação de entrada só no topo da página; abrir, confirmar e curtir têm resposta visual. Nada de efeito em todo bloco ao rolar.
- **Estrutura é informação.** Números só para sequências reais (passos da calculadora, "Como funciona"). Rótulo acima do título só quando diz algo que o título não diz.
- **Texto como pessoa fala.** Só a primeira letra maiúscula, verbos claros, botões dizem o que acontece ("Criar minha conta", "Publicar"). Erros dizem o que fazer, sem pedir desculpas.

---

## Tokens

### Cores

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--fundo` | #FFF7F5 | #14090F | fundo da página |
| `--superficie` | #FFFFFF | #22131B | cartões, painéis, janelas |
| `--tinta` | #2B1622 | #FFF1F6 | texto principal |
| `--suave` | #6B5462 | #CDB0BF | texto de apoio (contraste ≥ 6:1) |
| `--marca` | #D10F5E | #FF5C97 | botão principal, links, destaque |
| `--sobre-marca` | #FFFFFF | #2A0716 | texto em cima de `--marca` |
| `--marca-clara` | rosa 10% | rosa 18% | fundos suaves, anel de foco |
| `--acento` / `--laranja` | #B84A00 / #FF8A1E | — | texto laranja / formas decorativas |
| `--lima` / `--sobre-lima` | #B7E12F / #253300 | — | selos de sucesso e notas de saúde |
| `--faixa` / `--sobre-faixa` | #C40E58 / #FFE9F1 | #8A0B40 / #FFE3EE | faixas de chamada |
| `--perigo` | #B3123E | — | excluir, denunciar |
| `--degrade` | rosa → laranja | — | **só decorativo** (barras, formas) |
| `--degrade-forte` | magenta → laranja queimado | — | **atrás de texto branco** (contraste ≥ 5:1) |

Nunca coloque texto branco sobre `--degrade`: no lado laranja o contraste cai para 2,4.

### Tipografia
Uma família: **Nunito** (400 a 900), servida pelo próprio site.

| Token | Tamanho | Uso |
|---|---|---|
| `--t-mini` | 11 px | rótulos da barra de baixo, selos |
| `--t-xs` | 13 px | legendas, datas |
| `--t-sm` | 14 px | ajudas de campo, textos de apoio |
| `--t-ui` | 15 px | botões pequenos, menus, chips |
| `--t-base` | 16 px | texto de cartões |
| `--t-corpo` | 17 px | texto corrido, campos de formulário |
| `--t-lg` / `--t-xl` / `--t-2xl` / `--t-3xl` | 18 / 20 / 22 / 24 px | títulos de cartão e subtítulos |
| `--t-lead` | 17 → 20 px | parágrafo de abertura |
| `--t-h4` / `--t-h3` / `--t-h2` / `--t-h1` | 22→28 / 26→34 / 30→44 / 36→56 px | caixa / artigo / seção / página |
| `--t-hero` | 42 → 68 px | só o título da página inicial |
| `--t-num` | 44 → 58 px | totais e números em destaque |

Pesos: títulos 800–900, botões 800, texto 400–600. Números que mudam na tela usam `class="num-fixo"` (algarismos de largura fixa).

### Cantos

| Token | Valor | Uso |
|---|---|---|
| `--raio-xs` | 12 px | miniaturas, opções de enquete |
| `--raio-sm` | 14 px | campos, avisos |
| `--raio-md` | 18 px | cartões pequenos, itens de lista |
| `--raio` | 22 px | cartões e painéis |
| `--raio-lg` | 28 px | capas e blocos de destaque |
| `--raio-pill` | 999 px | botões, chips, abas |
| `50%` | — | avatares |

### Sombras

| Token | Uso |
|---|---|
| `--sombra` | todo cartão |
| `--sombra-alta` | o que fica por cima: janelas, menus, avisos flutuantes |
| `--sombra-marca` | capas na cor da marca |
| `--sombra-botao` | botão principal em destaque |

### Largura do conteúdo
`--largura`: 1280 px (1360 px em telas a partir de 1600 px). Vale para topo, conteúdo (`.wrap`), Comunidade e rodapé. Páginas de leitura longa mantêm a própria coluna mais estreita.

### Espaçamento

| Token | Valor | Uso típico |
|---|---|---|
| `--e-1` / `--e-2` | 4 / 8 px | entre ícone e texto, entre chips |
| `--e-3` / `--e-4` | 12 / 16 px | entre itens de lista, entre cartões |
| `--e-5` / `--e-6` | 20 / 24 px | dentro de cartões, margem lateral da página |
| `--e-8` / `--e-10` | 32 / 40 px | dentro de blocos grandes, entre grupos |
| `--e-12` / `--e-14` / `--e-16` | 48 / 56 / 64 px | entre seções no celular |
| `--e-20` / `--e-24` | 80 / 96 px | entre seções no computador |

O número do token é o valor dividido por 4. Exceções: o menu do topo, as abas e o logo usam medidas próprias, porque 1 ou 2 px já desencaixam.

### Movimento

| Token | Valor | Uso |
|---|---|---|
| `--dur-rapida` | .15 s | toque, hover, foco |
| `--dur` | .25 s | abrir e fechar |
| `--dur-lenta` | .5 s | entradas e números |
| `--mola` | curva suave | movimento padrão |
| `--mola-salto` | com "quique" | confirmações (curtir, selo de sucesso) |

Toda animação tem a versão sem movimento em `prefers-reduced-motion`.

---

## Componentes

### Botão (`.btn`)

| Variante | Classe | Quando usar |
|---|---|---|
| Principal | `.btn` | a ação principal da tela (uma por bloco) |
| Secundário | `.btn .btn-sec` | ações de apoio, "Voltar", "Sair" |
| Perigo | `.btn .btn-perigo` | excluir conta e ações sem volta |
| Google | `.btn-google` | entrar com Google |

- **Estados:**
  - hover: cor mais escura;
  - pressionado: encolhe para 97%;
  - foco: anel rosa;
  - desabilitado: 60% de opacidade e cursor de espera, com o texto trocado para "Salvando…" ou equivalente.
- **Altura e forma:** mínimo de 46 px (44 px de área de toque), formato pílula.
- **Texto:** um verbo e o que acontece ("Publicar", "Enviar denúncia"), sem setas.

### Campo de formulário (`.fc` no formulário)
- **Rótulo:** sempre visível acima do campo (`label.rot`); "(opcional)" em `.opcional`.
- **Tamanho:** altura de 48 px e texto de 17 px. Assim o iPhone não dá zoom ao tocar.
- **Erro:** `aria-invalid="true"` deixa a borda rosa e a mensagem aparece em `.aviso-conta`, perto do botão.
- **Senha:** `.campo-senha` com o botão "Mostrar".

### Cartão
Fundo `--superficie`, `--raio` e `--sombra`. Dentro, padding de 18 a 24 px. Cartões de destaque usam `--degrade-forte`, `--raio-lg` e `--sombra-marca`.

### Chip e aba
Formato pílula, altura de 38 a 46 px. Ativo: fundo `--marca` com texto `--sobre-marca`. Grupos de chips usam `role="radiogroup"`; abas de navegação usam `aria-current="page"`.

### Aviso (`.aviso-conta`)
Rosa para erro e verde (`.ok`) para sucesso. Use `role="alert"` para erros e `role="status"` para confirmações.

### Janela (`<dialog>`)
Use `showModal()`, `--raio-lg` e `--sombra-alta`, e fundo desfocado. Fecha com Esc e com o botão "Cancelar" ou "Agora não".

### Aviso flutuante (`.toast`)
Confirma uma ação ("Salvo!", "Link copiado!"). Fica embaixo, some em 3 s e é anunciado por leitores de tela.

### Estado vazio (`.vazio`)
Ícone de patinha em SVG, um título curto e um convite para agir. Nunca deixe uma lista em branco.

### Avatar (`.av`, `.avatar`)
Foto redonda; sem foto, mostra a inicial sobre `--degrade-forte`.

---

## Faça e evite

| Faça | Evite |
|---|---|
| Usar tokens para cor, tamanho, canto e sombra | Escrever `#C40E58`, `20px` ou `14px` soltos |
| Texto branco só sobre `--degrade-forte` ou `--marca` (claro) | Texto branco sobre `--degrade` ou rosa claro |
| Primeira letra maiúscula nos rótulos | CAIXA ALTA espaçada |
| Numerar só passos de verdade | 01 / 02 / 03 em itens soltos |
| Uma animação marcante por página | Efeito de entrada em todo bloco |
| Ícones em SVG com `aria-hidden="true"` | Emoji como ícone |
| Área de toque de 44 px em botões e links soltos | Links de 20 px de altura fora de um parágrafo |
