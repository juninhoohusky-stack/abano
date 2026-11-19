/* Abanô — Achadinhos da Abanô (loja.html)
   Produtos de afiliado da Shopee e do Mercado Livre em duas áreas: "Para os animais" e "Para quem ama pets".
   O robô (scripts/robo-loja.mjs) publica e atualiza tudo sozinho todo dia na tabela "ofertas".
   A área, a categoria e a subcategoria de cada produto vêm de dados/loja-catalogo.json (campos area, cat e sub).
   Quem clica vai direto para o anúncio na loja e compra do vendedor original. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var svg = function (d, cls) { return '<svg class="' + (cls || "lj-ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  var OLHO = '<circle cx="9.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="14.5" cy="11.5" r=".9" fill="currentColor"/>';
  var ICO = {
    pata: '<ellipse cx="6.8" cy="9.2" rx="1.9" ry="2.3"/><ellipse cx="12" cy="6.4" rx="1.9" ry="2.3"/><ellipse cx="17.2" cy="9.2" rx="1.9" ry="2.3"/><path d="M12 11.6c2.6 0 5 3 5 5 0 1.6-1.2 2.3-2.6 2.3-1 0-1.5-.5-2.4-.5s-1.4.5-2.4.5c-1.4 0-2.6-.7-2.6-2.3 0-2 2.4-5 5-5z"/>',
    coracao: '<path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/>',
    cao: '<path d="M6.5 8.5 4 5l4.5 1.2M17.5 8.5 20 5l-4.5 1.2"/><path d="M6.2 9.5C6.2 6.6 8.8 5 12 5s5.8 1.6 5.8 4.5V14a5.8 5.8 0 0 1-11.6 0z"/>' + OLHO + '<path d="M11 15h2l-1 1.2z"/>',
    gato: '<path d="M5.5 4.5 8.5 8h7l3-3.5V13a6.5 6.5 0 0 1-13 0z"/>' + OLHO + '<path d="M11 15h2l-1 1zM7 15H3.5M7 16.6l-3 1.2M17 15h3.5M17 16.6l3 1.2"/>',
    aves: '<path d="M15.8 6.2a4 4 0 0 0-7.4 2.4L4 18h7.2a7 7 0 0 0 7-7V9.4L20.5 8z"/><circle cx="15" cy="8" r=".8" fill="currentColor"/><path d="M11 18l1 3M8 18l.5 3"/>',
    roedores: '<circle cx="7.5" cy="8" r="3"/><circle cx="16.5" cy="8" r="3"/><path d="M5 15.5a7 6 0 0 1 14 0c0 2.8-3 4.5-7 4.5s-7-1.7-7-4.5z"/><circle cx="10" cy="14.5" r=".8" fill="currentColor"/><circle cx="14" cy="14.5" r=".8" fill="currentColor"/>',
    peixes: '<path d="M5 12c2.6-4 6.4-5.5 9.6-5.5 3.4 0 5.6 2.8 6.4 5.5-.8 2.7-3 5.5-6.4 5.5-3.2 0-7-1.5-9.6-5.5z"/><path d="M5 12 2 8.5v7z"/><circle cx="16.5" cy="11" r=".9" fill="currentColor"/>',
    repteis: '<path d="M4.5 15a7.5 6.5 0 0 1 15 0z"/><path d="M19.5 14.5l2.5-1.8M7.5 15l-1 3M16.5 15l1 3M4.5 15H2.5"/><path d="M8 15l4-4 4 4M12 8.5V11"/>',
    "sem-pelos": '<path d="M5 20h9a3 3 0 0 0 3-3v-1H5z"/><path d="M8 16V9a4 4 0 0 1 8 0"/><path d="M19 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6zM13.5 3l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4z"/>',
    organizada: '<path d="M3.5 8.5h17V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/><path d="M2.5 4.5h19v4h-19z"/><path d="M10 12.5h4"/>',
    limpeza: '<path d="M14.5 3 10 13"/><path d="M6.5 13h7l1.5 8H5z"/><path d="M8 17v4M11 17v4"/>',
    passeio: '<circle cx="7" cy="17" r="3"/><path d="M9.2 14.8 19 5"/><path d="M15.5 4.5H19.5v4"/>',
    conforto: '<path d="M4 8.5h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/>',
    carro: '<path d="M4.5 16.5V12l2-5h11l2 5v4.5"/><path d="M3.5 16.5h17v2h-17z"/><circle cx="7.5" cy="13.5" r="1" fill="currentColor"/><circle cx="16.5" cy="13.5" r="1" fill="currentColor"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    fechar: '<path d="M7 7l10 10M17 7 7 17"/>',
    filtro: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    alerta: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    sacola: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m6 12.5 4 4 8-9"/>'
  };
  ICO.outros = ICO.pata;

  // ---------- Como a página é organizada ----------
  var AREAS = {
    animais: { nome: "Para os animais", frase: "Ração, brinquedos, camas, gaiolas, aquários e tudo o que o seu bicho usa.", ico: "pata" },
    tutor: { nome: "Para quem ama pets", frase: "Casa sem pelos, organização, passeio e conforto para a rotina de quem convive com animais.", ico: "coracao" }
  };
  var CATS = {
    animais: [
      ["cao", "Cães", ["alimentacao", "brinquedos", "acessorios", "coleiras", "camas", "higiene", "transporte", "saude"]],
      ["gato", "Gatos", ["alimentacao", "higiene", "arranhadores", "brinquedos", "camas", "acessorios", "transporte", "saude"]],
      ["aves", "Aves", ["alimentacao", "gaiolas", "poleiros", "brinquedos", "acessorios"]],
      ["roedores", "Hamsters e pequenos animais", ["alimentacao", "gaiolas", "tocas", "rodinhas", "brinquedos", "acessorios"]],
      ["peixes", "Peixes", ["aquarios", "filtros", "alimentacao", "iluminacao", "acessorios"]],
      ["repteis", "Répteis", ["terrarios", "alimentacao", "luz", "acessorios"]],
      ["outros", "Outros animais", ["alimentacao", "acessorios"]]
    ],
    tutor: [
      ["sem-pelos", "Casa sem pelos", "Aspiradores, removedores, rolos tira-pelos e capas para o sofá."],
      ["organizada", "Casa organizada", "Cestos, caixas e organizadores para as coisas do pet."],
      ["limpeza", "Limpeza e lavanderia", "Mops, microfibra, escovas e pega-pelos para a máquina."],
      ["passeio", "Passeio e rotina", "Bolsas, mochilas, pochetes, garrafas e capas de chuva."],
      ["conforto", "Conforto do tutor", "Mantas, almofadas, canecas, copos térmicos e pantufas."],
      ["carro", "Carro e viagens", "Capas de banco, organizadores e aspiradores para o carro."]
    ]
  };
  var SUBS = { alimentacao: "Alimentação", brinquedos: "Brinquedos", acessorios: "Acessórios", coleiras: "Coleiras e guias", camas: "Camas",
    higiene: "Higiene", transporte: "Transporte", saude: "Saúde", arranhadores: "Arranhadores", gaiolas: "Gaiolas", poleiros: "Poleiros",
    tocas: "Tocas", rodinhas: "Rodinhas", aquarios: "Aquários", filtros: "Filtros", iluminacao: "Iluminação", terrarios: "Terrários", luz: "Aquecimento e luz" };
  var NOME_SUB = function (cat, s) { return cat === "gato" && s === "higiene" ? "Areia e higiene" : SUBS[s] || s; };
  var CAT = {}; ["animais", "tutor"].forEach(function (a) { CATS[a].forEach(function (c) { CAT[c[0]] = { area: a, nome: c[1], extra: c[2] }; }); });

  var LOJAS = { shopee: "Shopee", mercadolivre: "Mercado Livre", amazon: "Amazon", magalu: "Magalu", petz: "Petz", cobasi: "Cobasi", petlove: "Petlove", outra: "Loja parceira" };
  var NA_LOJA = { shopee: "na Shopee", mercadolivre: "no Mercado Livre", amazon: "na Amazon", magalu: "na Magalu", petz: "na Petz", cobasi: "na Cobasi", petlove: "na Petlove", outra: "na loja" };
  var FAIXAS = [["ate50", "Até R$ 50", 0, 50], ["50a100", "R$ 50 a 100", 50, 100], ["100a200", "R$ 100 a 200", 100, 200], ["200mais", "Acima de R$ 200", 200, Infinity]];
  var ORDENS = [["procurados", "Mais procurados"], ["recentes", "Mais recentes"], ["menor", "Menor preço"], ["maior", "Maior preço"], ["desconto", "Maiores descontos"]];
  var DIAS_NOVO = 7;     // produto que entrou há até 7 dias é "novidade"
  var POR_PAGINA = 24;

  var real = function (v) { return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var desconto = function (o) { return o.preco && o.preco_antigo && Number(o.preco_antigo) > Number(o.preco) ? Math.round((1 - o.preco / o.preco_antigo) * 100) : 0; };
  var vendidos = function (n) { return n >= 10000 ? Math.floor(n / 1000) + " mil vendidos" : n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",").replace(",0", "") + " mil vendidos" : n + " vendidos"; };
  var semAcento = function (s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var suave = function () { return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; };
  var centro = document.getElementById("loja-centro");
  if (!centro) return;

  // ---------- Estado (fica na URL, para dar para compartilhar um filtro) ----------
  var q = new URLSearchParams(location.search);
  var estado = {
    area: AREAS[q.get("area")] ? q.get("area") : null,
    cat: CAT[q.get("cat")] ? q.get("cat") : null,
    sub: SUBS[q.get("sub")] ? q.get("sub") : null,
    loja: q.get("loja") === "shopee" || q.get("loja") === "mercadolivre" ? q.get("loja") : null,
    preco: FAIXAS.some(function (f) { return f[0] === q.get("preco"); }) ? q.get("preco") : null,
    desc: q.get("desc") === "1",
    novo: q.get("novo") === "1",
    ordem: ORDENS.some(function (o) { return o[0] === q.get("ordem"); }) ? q.get("ordem") : "procurados",
    busca: q.get("q") || "",
    pagina: 1
  };
  if (!estado.cat && CAT[q.get("pet")]) estado.cat = q.get("pet");          // links antigos da Pet Store (?pet=cao)
  if (estado.cat) estado.area = CAT[estado.cat].area;
  if (!estado.cat || estado.area !== "animais") estado.sub = null;
  var todas = [], catalogo = {};

  // ---------- De onde vem a área, a categoria e a subcategoria de cada produto ----------
  var SUB_DO_NICHO = { racao: "alimentacao", petiscos: "alimentacao", alimentacao: "alimentacao", potes: "alimentacao", brinquedos: "brinquedos",
    higiene: "higiene", escovacao: "higiene", saude: "saude", camas: "camas", passeio: "coleiras", arranhadores: "arranhadores",
    gaiolas: "gaiolas", aquario: "aquarios", terrario: "terrarios" };
  var ANIMAIS = CATS.animais.map(function (c) { return c[0]; });
  function organizar(o) {
    var c = catalogo[o.produto];
    if (c && c.area && CAT[c.cat]) { o.area = c.area; o.cats = [c.cat]; o.sub = c.sub || null; o.nomeCat = c.nome || ""; return o; }
    // Oferta cadastrada à mão (sem item do catálogo): usa o pet e o nicho da tabela
    o.area = "animais";
    o.cats = o.pet === "ambos" ? ["cao", "gato"] : CAT[o.pet] ? [o.pet] : ANIMAIS;
    o.sub = SUB_DO_NICHO[o.categoria] || "acessorios";
    if (o.sub === "coleiras" && o.cats[0] !== "cao") o.sub = "acessorios";
    o.nomeCat = "";
    return o;
  }
  var ehNovo = function (o) { return !!o.criado_em && Date.now() - new Date(o.criado_em).getTime() < DIAS_NOVO * 864e5; };
  var faixa = function (id) { return FAIXAS.filter(function (f) { return f[0] === id; })[0]; };
  var naFaixa = function (o, f) { return o.preco != null && +o.preco >= f[2] && +o.preco < f[3]; };

  // ignorar: o filtro que não entra na conta (para mostrar quantos produtos cada opção daria)
  function filtradas(ignorar) {
    var termos = semAcento(estado.busca).split(/\s+/).filter(Boolean), f = faixa(estado.preco);
    var nivel = { area: 0, cat: 1, sub: 2 }[ignorar];
    return todas.filter(function (o) {
      if (!(nivel <= 0) && estado.area && o.area !== estado.area) return false;
      if (!(nivel <= 1) && estado.cat && o.cats.indexOf(estado.cat) < 0) return false;
      if (!(nivel <= 2) && estado.sub && o.sub !== estado.sub) return false;
      if (ignorar !== "loja" && estado.loja && o.loja !== estado.loja) return false;
      if (ignorar !== "preco" && f && !naFaixa(o, f)) return false;
      if (ignorar !== "desc" && estado.desc && desconto(o) < 1) return false;
      if (ignorar !== "novo" && estado.novo && !ehNovo(o)) return false;
      if (termos.length) {
        var t = semAcento(o.titulo + " " + o.nomeCat + " " + o.cats.map(function (c) { return CAT[c].nome; }).join(" ") + " " + (o.sub ? SUBS[o.sub] : "") + " " + AREAS[o.area].nome);
        if (!termos.every(function (p) { return t.indexOf(p) >= 0; })) return false;
      }
      return true;
    });
  }

  var data = function (o) { return new Date(o.criado_em || o.atualizado_em || 0).getTime(); };
  var ORDEM = {
    procurados: function (a, b) { return (b.destaque - a.destaque) || ((b.vendas || 0) - (a.vendas || 0)) || ((b.avaliacao || 0) - (a.avaliacao || 0)); },
    recentes: function (a, b) { return (data(b) - data(a)) || ((b.vendas || 0) - (a.vendas || 0)); },
    menor: function (a, b) { return (a.preco == null ? 1e9 : +a.preco) - (b.preco == null ? 1e9 : +b.preco); },
    maior: function (a, b) { return (b.preco == null ? -1 : +b.preco) - (a.preco == null ? -1 : +a.preco); },
    desconto: function (a, b) { return (desconto(b) - desconto(a)) || ((b.vendas || 0) - (a.vendas || 0)); }
  };
  var ordenar = function (l, ordem) { return l.slice().sort(ORDEM[ordem || estado.ordem]); };

  function horaAtualizacao() {
    var max = todas.reduce(function (m, o) { var t = new Date(o.atualizado_em).getTime(); return t > m ? t : m; }, 0);
    if (!max) return "";
    var d = new Date(max), fuso = { timeZone: "America/Sao_Paulo" };
    var h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    var hoje = d.toLocaleDateString("pt-BR", fuso) === new Date().toLocaleDateString("pt-BR", fuso);
    return hoje ? "Atualizado hoje às " + h : "Atualizado em " + d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
  }

  // ---------- Cartão de produto ----------
  function cartao(o) {
    var d = desconto(o), loja = LOJAS[o.loja] || LOJAS.outra, link = esc(o.link);
    var foto = o.imagem_url
      ? '<img src="' + esc(o.imagem_url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="300" height="300">'
      : '<span class="lj-sem-foto">' + svg(ICO[o.cats[0]] || ICO.pata) + "</span>";
    var prova = [];
    if (o.avaliacao) prova.push('<span class="lj-nota"><span aria-hidden="true">★</span> ' + Number(o.avaliacao).toFixed(1).replace(".", ",") + '<span class="sr"> de 5</span></span>');
    if (o.vendas >= 10) prova.push("<span>" + vendidos(o.vendas) + "</span>");
    return '<li class="lj-card">' +
      '<a class="lj-foto" href="' + link + '" target="_blank" rel="sponsored nofollow noopener" tabindex="-1" aria-hidden="true">' + foto +
        (d >= 1 ? '<span class="lj-desc">-' + d + "%</span>" : ehNovo(o) ? '<span class="lj-novo">Novo</span>' : "") + "</a>" +
      '<div class="lj-corpo">' +
        '<p class="lj-selo lj-' + esc(o.loja) + '"><span class="lj-ponto" aria-hidden="true"></span>' + esc(loja) + "</p>" +
        '<h3><a href="' + link + '" target="_blank" rel="sponsored nofollow noopener">' + esc(o.titulo) + "</a></h3>" +
        (prova.length ? '<p class="lj-prova">' + prova.join("") + "</p>" : "") +
        '<div class="lj-preco">' +
          (o.preco_antigo && d >= 1 ? '<s><span class="sr">De </span>' + real(o.preco_antigo) + "</s>" : "") +
          (o.preco != null ? "<b>" + (d >= 1 ? '<span class="sr">por </span>' : "") + real(o.preco) + "</b>" : '<b class="lj-ver-preco">Preço na loja</b>') +
          (d >= 1 ? '<span class="lj-off">' + d + "% de desconto</span>" : "") +
        "</div>" +
        '<a class="btn lj-comprar" href="' + link + '" target="_blank" rel="sponsored nofollow noopener">Ver oferta<span class="sr"> ' + esc(NA_LOJA[o.loja] || NA_LOJA.outra) + " (abre em outra aba)</span></a>" +
      "</div></li>";
  }

  // ---------- Áreas: as duas portas de entrada ----------
  var CHECK = '<span class="lj-check" aria-hidden="true">' + svg(ICO.check, "lj-check-ico") + "</span>";
  function desenharAreas() {
    var box = document.getElementById("lj-areas"), base = filtradas("area");
    if (!box.children.length) {
      box.innerHTML = ["animais", "tutor"].map(function (a) {
        var A = AREAS[a], icones = CATS[a].slice(0, 6).map(function (c) { return '<span class="lj-mini">' + svg(ICO[c[0]]) + "</span>"; }).join("");
        return '<button type="button" class="lj-area lj-area-' + a + '" data-area="' + a + '" aria-pressed="false">' + CHECK +
          '<span class="lj-area-nome">' + A.nome + '</span><span class="lj-area-frase">' + A.frase + "</span>" +
          '<span class="lj-area-pe"><span class="lj-minis" aria-hidden="true">' + icones + '</span><span class="lj-area-qtd"></span></span></button>';
      }).join("");
    }
    box.querySelectorAll(".lj-area").forEach(function (b) {
      var a = b.dataset.area, n = base.filter(function (o) { return o.area === a; }).length;
      b.setAttribute("aria-pressed", String(estado.area === a));
      b.querySelector(".lj-area-qtd").textContent = n + (n === 1 ? " achadinho" : " achadinhos");
    });
    box.classList.toggle("lj-escolhida", !!estado.area);
  }

  // ---------- Categorias da área escolhida ----------
  function desenharCats() {
    var box = document.getElementById("lj-cats");
    if (!estado.area) { box.hidden = true; box.innerHTML = ""; box.dataset.area = ""; return; }
    var base = filtradas("cat");
    if (box.dataset.area !== estado.area) {
      box.dataset.area = estado.area;
      box.innerHTML = '<h2 class="lj-titulo-cats" id="lj-t-cats">' + (estado.area === "animais" ? "Escolha o animal" : "O que facilita a sua rotina") + "</h2>" +
        '<div class="lj-cats lj-cats-' + estado.area + '" role="group" aria-labelledby="lj-t-cats">' + CATS[estado.area].map(function (c) {
          return '<button type="button" class="lj-cat" data-cat="' + c[0] + '" aria-pressed="false">' +
            '<span class="lj-cat-ico">' + svg(ICO[c[0]]) + "</span>" +
            '<span class="lj-cat-txt"><span class="lj-cat-nome">' + esc(c[1]) + "</span>" +
            (estado.area === "tutor" ? '<span class="lj-cat-frase">' + esc(c[2]) + "</span>" : "") + "</span>" +
            '<span class="lj-cat-qtd"></span></button>';
        }).join("") + "</div>";
      box.classList.remove("lj-surge"); void box.offsetWidth; box.classList.add("lj-surge");
    }
    box.hidden = false;
    box.querySelectorAll(".lj-cat").forEach(function (b) {
      var c = b.dataset.cat, n = base.filter(function (o) { return o.cats.indexOf(c) >= 0; }).length;
      b.setAttribute("aria-pressed", String(estado.cat === c));
      b.querySelector(".lj-cat-qtd").textContent = n;
      b.classList.toggle("lj-zerada", !n && estado.cat !== c);
    });
  }

  // ---------- Vitrines de destaque (só na abertura, sem nenhum filtro) ----------
  function semFiltro() { return !estado.area && !estado.busca && !estado.loja && !estado.preco && !estado.desc && !estado.novo; }
  function desenharVitrines() {
    var box = document.getElementById("lj-vitrines");
    if (!semFiltro()) { box.hidden = true; return; }
    var usados = {};   // o mesmo produto não aparece em duas vitrines
    var pega = function (l, ordem) { var r = ordenar(l.filter(function (o) { return !usados[o.id]; }), ordem).slice(0, 8); r.forEach(function (o) { usados[o.id] = 1; }); return r; };
    var V = [
      ["ofertas", "Ofertas do dia", "Os maiores descontos de hoje.", function () { return pega(todas.filter(function (o) { return desconto(o) >= 5; }), "desconto"); }, "Ver todas as ofertas"],
      ["novidades", "Novidades", "O que acabou de chegar.", function () { return pega(todas.filter(ehNovo), "recentes"); }, "Ver as novidades"],
      ["procurados", "Mais procurados", "Os mais vendidos nas lojas.", function () { return pega(todas.filter(function (o) { return o.area === "animais"; }), "procurados"); }, "Ver os mais procurados"],
      ["tutores", "Achadinhos para os tutores", "Para a casa, o passeio e o seu conforto.", function () { return pega(todas.filter(function (o) { return o.area === "tutor"; }), "procurados"); }, "Ver tudo para tutores"]
    ];
    var html = V.map(function (v) {
      var l = v[3]();
      if (l.length < 3) return "";
      return '<section class="lj-vitrine lj-v-' + v[0] + '" aria-labelledby="lj-v-' + v[0] + '">' +
        '<div class="lj-v-cab"><div><h2 id="lj-v-' + v[0] + '">' + v[1] + "</h2><p>" + v[2] + "</p></div>" +
        '<button type="button" class="lj-ver" data-vitrine="' + v[0] + '">' + v[4] + svg(ICO.seta, "lj-ico lj-seta") + "</button></div>" +
        '<ul class="lj-trilho">' + l.map(cartao).join("") + "</ul></section>";
    }).join("");
    box.innerHTML = html;
    box.hidden = !html;
  }

  // ---------- Painel de filtros (lateral no computador, gaveta no celular) ----------
  function grupo(titulo, nome, opcoes, atual) {
    return '<fieldset class="lj-f"><legend>' + titulo + '</legend><div class="lj-chips">' + opcoes.map(function (o) {
      var ligado = atual === o[0];
      return '<button type="button" class="lj-chip" data-f="' + nome + '" data-v="' + o[0] + '" aria-pressed="' + ligado + '"' + (o[2] === 0 && !ligado ? " disabled" : "") + ">" +
        esc(o[1]) + (o[2] != null ? "<small>" + o[2] + "</small>" : "") + "</button>";
    }).join("") + "</div></fieldset>";
  }
  function quantos(ignorar, teste) { return filtradas(ignorar).filter(teste).length; }
  var tudo = function () { return true; };
  function desenharPainel() {
    var corpo = document.getElementById("lj-painel-corpo"), h = "";
    h += grupo("Área", "area", [["", "Tudo", quantos("area", tudo)]].concat(["animais", "tutor"].map(function (a) {
      return [a, AREAS[a].nome, quantos("area", function (o) { return o.area === a; })];
    })), estado.area || "");
    if (estado.area) h += grupo(estado.area === "animais" ? "Animal" : "Categoria", "cat", [["", "Todos", quantos("cat", tudo)]].concat(CATS[estado.area].map(function (c) {
      return [c[0], c[1], quantos("cat", function (o) { return o.cats.indexOf(c[0]) >= 0; })];
    })), estado.cat || "");
    if (estado.area === "animais" && estado.cat) h += grupo("Subcategoria", "sub", [["", "Todas", quantos("sub", tudo)]].concat(CAT[estado.cat].extra.map(function (s) {
      return [s, NOME_SUB(estado.cat, s), quantos("sub", function (o) { return o.sub === s; })];
    })), estado.sub || "");
    var lojas = [["mercadolivre", "Mercado Livre"], ["shopee", "Shopee"]].filter(function (l) { return todas.some(function (o) { return o.loja === l[0]; }); });
    if (lojas.length > 1 || estado.loja) h += grupo("Loja", "loja", [["", "As duas", quantos("loja", tudo)]].concat(lojas.map(function (l) {
      return [l[0], l[1], quantos("loja", function (o) { return o.loja === l[0]; })];
    })), estado.loja || "");
    h += grupo("Faixa de preço", "preco", [["", "Qualquer preço"]].concat(FAIXAS.map(function (f) {
      return [f[0], f[1], quantos("preco", function (o) { return naFaixa(o, f); })];
    })), estado.preco || "");
    var nDesc = quantos("desc", function (o) { return desconto(o) >= 1; }), nNovo = quantos("novo", ehNovo);
    h += '<fieldset class="lj-f"><legend>Ofertas e novidades</legend><div class="lj-chaves">' +
      '<label class="lj-chave"><input type="checkbox" role="switch" data-f="desc"' + (estado.desc ? " checked" : "") + (!nDesc && !estado.desc ? " disabled" : "") + '><span class="lj-trilha" aria-hidden="true"></span><span>Só com desconto</span><small>' + nDesc + "</small></label>" +
      '<label class="lj-chave"><input type="checkbox" role="switch" data-f="novo"' + (estado.novo ? " checked" : "") + (!nNovo && !estado.novo ? " disabled" : "") + '><span class="lj-trilha" aria-hidden="true"></span><span>Só novidades da semana</span><small>' + nNovo + "</small></label>" +
      "</div></fieldset>";
    corpo.innerHTML = h;
  }

  // ---------- Barra da lista: título, filtros ativos e ordem ----------
  function ativos() {
    var l = [];
    if (estado.area && !estado.cat) l.push(["area", AREAS[estado.area].nome]);
    if (estado.cat) l.push(["cat", CAT[estado.cat].nome]);
    if (estado.sub) l.push(["sub", NOME_SUB(estado.cat, estado.sub)]);
    if (estado.loja) l.push(["loja", LOJAS[estado.loja]]);
    if (estado.preco) l.push(["preco", faixa(estado.preco)[1]]);
    if (estado.desc) l.push(["desc", "Com desconto"]);
    if (estado.novo) l.push(["novo", "Novidades"]);
    if (estado.busca) l.push(["busca", "“" + estado.busca + "”"]);
    return l;
  }
  function tituloLista() {
    if (estado.cat) return estado.sub ? NOME_SUB(estado.cat, estado.sub) + ": " + CAT[estado.cat].nome.toLowerCase() : CAT[estado.cat].nome;
    if (estado.area) return AREAS[estado.area].nome;
    if (estado.busca) return "Resultados para “" + estado.busca + "”";
    if (estado.desc) return "Ofertas do dia";
    if (estado.novo) return "Novidades";
    return "Todos os achadinhos";
  }
  function desenharBarra(total) {
    var a = ativos(), nFiltros = a.filter(function (x) { return x[0] !== "busca"; }).length;
    var temDesc = todas.some(function (o) { return desconto(o) >= 1; });
    document.getElementById("lj-lista-titulo").textContent = tituloLista();
    document.getElementById("lj-num").innerHTML = "<b>" + total + "</b> " + (total === 1 ? "produto" : "produtos");
    document.getElementById("lj-ativos").innerHTML = a.length ? a.map(function (x) {
      return '<li><button type="button" data-tirar="' + x[0] + '" aria-label="Tirar o filtro ' + esc(x[1]) + '">' + esc(x[1]) + svg(ICO.fechar, "lj-x") + "</button></li>";
    }).join("") + (a.length > 1 ? '<li><button type="button" class="lj-limpar" data-tirar="tudo">Limpar tudo</button></li>' : "") : "";
    document.getElementById("lj-ordem").innerHTML = ORDENS.filter(function (o) { return o[0] !== "desconto" || temDesc || estado.ordem === "desconto"; }).map(function (o) {
      return '<option value="' + o[0] + '"' + (estado.ordem === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");
    var conta = document.querySelector("#lj-abrir-filtros small");
    conta.textContent = nFiltros || "";
    conta.hidden = !nFiltros;
    document.getElementById("lj-ver-n").textContent = "Ver " + total + (total === 1 ? " produto" : " produtos");
  }

  var jaDesenhou = false;
  function desenharLista() {
    var l = ordenar(filtradas()), alvo = document.getElementById("lj-grade"), mais = document.getElementById("lj-mais");
    desenharBarra(l.length);
    if (jaDesenhou) { alvo.classList.remove("lj-trocou"); void alvo.offsetWidth; alvo.classList.add("lj-trocou"); }
    document.getElementById("lj-aviso-saude").hidden = !(estado.sub === "saude" || /antipulga|vermifug|suplement|bravecto|simparic/.test(semAcento(estado.busca)));
    if (!l.length) {
      alvo.innerHTML = '<li class="lj-vazio">' + svg(ICO.lupa) + "<b>Nenhum achadinho com esses filtros agora.</b><span>Tente outra categoria, outra faixa de preço ou outra palavra. Os produtos mudam todo dia.</span>" +
        '<button type="button" class="btn" data-tirar="tudo">Limpar os filtros</button></li>';
      mais.hidden = true;
      return;
    }
    var n = estado.pagina * POR_PAGINA;
    alvo.innerHTML = l.slice(0, n).map(cartao).join("");
    mais.hidden = l.length <= n;
    mais.textContent = "Mostrar mais " + Math.min(POR_PAGINA, l.length - n) + " (faltam " + (l.length - n) + ")";
  }

  function guardarNaUrl() {
    var p = new URLSearchParams();
    if (estado.cat) p.set("cat", estado.cat); else if (estado.area) p.set("area", estado.area);
    if (estado.sub) p.set("sub", estado.sub);
    if (estado.loja) p.set("loja", estado.loja);
    if (estado.preco) p.set("preco", estado.preco);
    if (estado.desc) p.set("desc", "1");
    if (estado.novo) p.set("novo", "1");
    if (estado.ordem !== "procurados") p.set("ordem", estado.ordem);
    if (estado.busca) p.set("q", estado.busca);
    var s = p.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "")); } catch (e) {}
  }

  function atualizar() {
    estado.pagina = 1;
    desenharAreas(); desenharCats(); desenharVitrines(); desenharPainel(); desenharLista(); guardarNaUrl();
    jaDesenhou = true;
  }

  // ---------- Estrutura da página ----------
  function cabecalho(hora) {
    return '<header class="lj-hero">' +
      '<div class="lj-hero-txt">' +
        '<p class="lj-selos-hero lj-entra"><span class="lj-ao-vivo"><span class="of-ponto" aria-hidden="true"></span>Ofertas atualizadas todos os dias!</span>' +
          (hora ? '<span class="lj-hora">' + esc(hora) + "</span>" : "") + "</p>" +
        '<h1 class="lj-entra">Achadinhos da Abanô</h1>' +
        '<p class="lj-lead lj-entra">Descobertas, produtos e ofertas para cuidar dos seus pets e facilitar a vida de quem ama animais.</p>' +
      "</div>";
  }
  function desenhar() {
    centro.innerHTML = cabecalho(horaAtualizacao()) +
        '<form class="lj-busca lj-entra" role="search" id="lj-form"><label for="lj-q">Procurar um produto</label>' +
          '<span class="lj-campo">' + svg(ICO.lupa) + '<input type="search" id="lj-q" placeholder="Ração, aspirador, aquário…" autocomplete="off" enterkeyhint="search" value="' + esc(estado.busca) + '">' +
          '<button type="submit" class="lj-buscar">Buscar</button></span></form>' +
      "</header>" +
      '<div class="lj-areas lj-entra" id="lj-areas" role="group" aria-label="Áreas dos Achadinhos"></div>' +
      '<section class="lj-cats-box" id="lj-cats" aria-labelledby="lj-t-cats" hidden></section>' +
      '<div class="lj-vitrines" id="lj-vitrines"></div>' +
      '<section class="lj-lista" id="lj-lista" aria-labelledby="lj-lista-titulo">' +
        '<aside class="lj-painel" id="lj-painel" aria-labelledby="lj-painel-titulo">' +
          '<div class="lj-painel-cab"><h2 id="lj-painel-titulo">Filtros</h2><button type="button" class="lj-fechar" data-fechar-filtros aria-label="Fechar os filtros">' + svg(ICO.fechar) + "</button></div>" +
          '<div class="lj-painel-corpo" id="lj-painel-corpo"></div>' +
          '<div class="lj-painel-pe"><button type="button" class="lj-limpar-tudo" data-tirar="tudo">Limpar</button><button type="button" class="btn" id="lj-ver-n" data-fechar-filtros>Ver produtos</button></div>' +
        "</aside>" +
        '<div class="lj-fundo-painel" data-fechar-filtros hidden></div>' +
        '<div class="lj-resultado">' +
          '<div class="lj-barra" id="lj-barra">' +
            '<div class="lj-barra-topo"><h2 id="lj-lista-titulo"></h2><p class="lj-num" id="lj-num" aria-live="polite"></p></div>' +
            '<div class="lj-controles">' +
              '<button type="button" class="lj-abrir-filtros" id="lj-abrir-filtros" aria-controls="lj-painel" aria-expanded="false">' + svg(ICO.filtro) + "Filtros<small hidden></small></button>" +
              '<label class="lj-ordem"><span>Ordenar por</span><select id="lj-ordem"></select></label>' +
            "</div>" +
            '<ul class="lj-ativos" id="lj-ativos"></ul>' +
          "</div>" +
          '<p class="lj-alerta" id="lj-aviso-saude" hidden>' + svg(ICO.alerta) + "<span>Antipulgas, vermífugos e suplementos: use sempre com orientação do veterinário, de acordo com a espécie e o peso do seu pet.</span></p>" +
          '<ul class="lj-grade" id="lj-grade"></ul>' +
          '<button type="button" class="lj-ver lj-mostrar" id="lj-mais" hidden></button>' +
        "</div>" +
      "</section>" +
      '<p class="lj-aviso">Os links desta página são de afiliado: quando você compra por eles, o Abanô ganha uma pequena comissão da loja, sem nenhum custo extra para você. É assim que mantemos o site gratuito. A compra, a entrega e a garantia são feitas pela loja e pelo vendedor. Preço, frete e estoque podem mudar a qualquer momento: confira sempre no anúncio antes de finalizar.</p>';
    atualizar();
  }

  // ---------- Gaveta de filtros no celular ----------
  var voltarFoco = null;
  var painelAberto = function () { var p = document.getElementById("lj-painel"); return p && p.classList.contains("aberto"); };
  function abrirFiltros() {
    var p = document.getElementById("lj-painel");
    voltarFoco = document.activeElement;
    p.classList.add("aberto"); p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true");
    document.querySelector(".lj-fundo-painel").hidden = false;
    document.getElementById("lj-abrir-filtros").setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("lj-travado");
    p.querySelector(".lj-fechar").focus();
  }
  function fecharFiltros() {
    if (!painelAberto()) return;
    var p = document.getElementById("lj-painel");
    p.classList.remove("aberto"); p.removeAttribute("role"); p.removeAttribute("aria-modal");
    document.querySelector(".lj-fundo-painel").hidden = true;
    document.getElementById("lj-abrir-filtros").setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("lj-travado");
    if (voltarFoco && voltarFoco !== document.body && document.contains(voltarFoco)) voltarFoco.focus(); else document.getElementById("lj-abrir-filtros").focus();
  }
  var celular = matchMedia("(max-width: 900px)");
  if (celular.addEventListener) celular.addEventListener("change", function (e) { if (!e.matches) fecharFiltros(); });
  document.addEventListener("keydown", function (e) {
    if (!painelAberto()) return;
    if (e.key === "Escape") { fecharFiltros(); return; }
    if (e.key === "Tab") {                    // o foco não sai da gaveta enquanto ela está aberta
      var f = document.querySelectorAll("#lj-painel button:not([disabled]), #lj-painel input:not([disabled])"), um = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === um) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); um.focus(); }
    }
  });

  function irParaLista() {
    var b = document.getElementById("lj-lista"), topo = b.getBoundingClientRect().top;
    if (topo < 0 || topo > innerHeight * 0.6) b.scrollIntoView({ behavior: suave(), block: "start" });
  }

  // ---------- Interações ----------
  centro.addEventListener("click", function (e) {
    var b = e.target.closest("button,[data-fechar-filtros]");
    if (!b || b.disabled) return;
    if (b.id === "lj-abrir-filtros") { abrirFiltros(); return; }
    if (b.hasAttribute("data-fechar-filtros")) { fecharFiltros(); return; }
    if (b.id === "lj-mais") {
      var antes = document.querySelectorAll("#lj-grade > .lj-card").length;
      estado.pagina++; desenharLista();
      var novo = document.querySelectorAll("#lj-grade > .lj-card")[antes];
      if (novo) novo.querySelector("h3 a").focus({ preventScroll: true });
      return;
    }
    var noPainel = !!b.closest(".lj-painel"), rolar = false;
    if (b.dataset.area) {
      estado.area = estado.area === b.dataset.area ? null : b.dataset.area; estado.cat = null; estado.sub = null;
    } else if (b.dataset.cat) {
      estado.cat = estado.cat === b.dataset.cat ? null : b.dataset.cat; estado.sub = null; rolar = !!estado.cat;
    } else if (b.dataset.f) {
      var f = b.dataset.f, v = b.dataset.v || null;
      if (f === "area") { estado.area = v; estado.cat = null; estado.sub = null; }
      else if (f === "cat") { estado.cat = v; estado.sub = null; }
      else estado[f] = v;
    } else if (b.dataset.vitrine) {
      var vt = b.dataset.vitrine;
      if (vt === "ofertas") { estado.desc = true; estado.ordem = "desconto"; }
      if (vt === "novidades") { estado.novo = true; estado.ordem = "recentes"; }
      if (vt === "procurados") { estado.area = "animais"; estado.ordem = "procurados"; }
      if (vt === "tutores") estado.area = "tutor";
      rolar = true;
    } else if (b.dataset.tirar) {
      var t = b.dataset.tirar, todos = t === "tudo";
      if (todos || t === "area") { estado.area = null; estado.cat = null; estado.sub = null; }
      if (todos || t === "cat") { estado.cat = null; estado.sub = null; }
      if (todos || t === "sub") estado.sub = null;
      if (todos || t === "loja") estado.loja = null;
      if (todos || t === "preco") estado.preco = null;
      if (todos || t === "desc") estado.desc = false;
      if (todos || t === "novo") estado.novo = false;
      if (todos || t === "busca") { estado.busca = ""; document.getElementById("lj-q").value = ""; }
    } else return;
    var foco = noPainel && b.dataset.f ? '#lj-painel [data-f="' + b.dataset.f + '"][data-v="' + (b.dataset.v || "") + '"]' : null;
    atualizar();
    if (foco) { var x = document.querySelector(foco); if (x) x.focus(); }
    if (rolar && !noPainel) irParaLista();
  });
  centro.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "lj-ordem") { estado.ordem = el.value; estado.pagina = 1; desenharLista(); guardarNaUrl(); return; }
    if (el.dataset && (el.dataset.f === "desc" || el.dataset.f === "novo")) {
      estado[el.dataset.f] = el.checked;
      atualizar();
      var y = document.querySelector('#lj-painel input[data-f="' + el.dataset.f + '"]'); if (y) y.focus();
    }
  });
  var pausa;
  centro.addEventListener("input", function (e) {
    if (e.target.id !== "lj-q") return;
    clearTimeout(pausa);
    pausa = setTimeout(function () { estado.busca = e.target.value.trim(); atualizar(); }, 250);
  });
  centro.addEventListener("submit", function (e) {
    e.preventDefault();
    clearTimeout(pausa);
    estado.busca = document.getElementById("lj-q").value.trim(); atualizar();
    document.getElementById("lj-lista").scrollIntoView({ behavior: suave(), block: "start" });
  });

  // ---------- Carregando, vazio e início ----------
  function carregando() {
    var c = ""; for (var i = 0; i < 8; i++) c += '<li class="lj-card lj-fantasma" aria-hidden="true"><span></span><i></i><i></i><i></i></li>';
    centro.innerHTML = '<p class="sr" role="status">Carregando os achadinhos…</p><div class="lj-hero lj-hero-fantasma" aria-hidden="true"></div><ul class="lj-grade">' + c + "</ul>";
  }
  function vazio() {
    centro.innerHTML = cabecalho("") + "</header>" +
      '<div class="lj-vazio">' + svg(ICO.sacola) + "<b>Os primeiros achadinhos chegam em breve.</b><span>Estamos separando produtos para cães, gatos, aves, hamsters, peixes e répteis, e também para a casa, o passeio e o conforto de quem convive com eles.</span><a class=\"btn\" href=\"guia/\">Ver o Guia pet</a></div>";
  }

  function iniciar() {
    var C = window.abanoConta;
    if (!C || !C.sb) { centro.innerHTML = '<p class="carregando">Não deu para carregar os achadinhos. Recarregue a página.</p>'; return; }
    carregando();
    var cat = fetch("dados/loja-catalogo.json?v=20261119").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    var ofertas = C.sb.from("ofertas")
      .select("id,titulo,loja,link,imagem_url,preco,preco_antigo,pet,categoria,produto,destaque,valido_ate,criado_em,atualizado_em,avaliacao,vendas")
      .eq("ativo", true).limit(2000).then(function (r) {
        // Antes de rodar o loja_afiliados.sql as colunas novas não existem: tenta o formato antigo
        return r.error ? C.sb.from("ofertas").select("*").eq("ativo", true).limit(2000) : r;
      });
    Promise.all([cat, ofertas]).then(function (res) {
      (res[0].itens || []).forEach(function (i) { catalogo[i.id] = i; });
      var r = res[1];
      if (!r || r.error) { vazio(); return; }
      var agora = Date.now();
      todas = (r.data || []).filter(function (o) { return /^https:\/\//.test(o.link || "") && (!o.valido_ate || new Date(o.valido_ate).getTime() > agora); }).map(organizar);
      if (!todas.length) { vazio(); return; }
      desenhar();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
