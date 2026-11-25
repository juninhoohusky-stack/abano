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
    clima: '<path d="M3 8.5h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12.5h16a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 16.5h8a2.5 2.5 0 1 1-2.5 2.5"/>',
    protecao: '<path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z"/><path d="M9 12.5l2 2 4-4"/>',
    quintal: '<path d="M3.5 20.5h17"/><path d="M5 20.5v-8M9 20.5v-8M13 20.5v-8"/><path d="M3.5 14h11M3.5 17.5h11"/><circle cx="18" cy="9" r="3"/><path d="M18 12v8.5"/>',
    tecnologia: '<rect x="4" y="8" width="13" height="10" rx="2"/><circle cx="10.5" cy="13" r="2.5"/><path d="m17 11.5 3.5-2v7l-3.5-2"/><path d="M7.5 4.5a6 6 0 0 1 6 0"/>',
    carro: '<path d="M4.5 16.5V12l2-5h11l2 5v4.5"/><path d="M3.5 16.5h17v2h-17z"/><circle cx="7.5" cy="13.5" r="1" fill="currentColor"/><circle cx="16.5" cy="13.5" r="1" fill="currentColor"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    fechar: '<path d="M7 7l10 10M17 7 7 17"/>',
    filtro: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    alerta: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    sacola: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m6 12.5 4 4 8-9"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="m9 14.5 2 2 4-4"/>',
    loja: '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5 12v8.5h14V12"/><path d="M10 20.5v-5h4v5"/>',
    etiqueta: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.4"/>',
    fogo: '<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.8-8.3.4 1.7 1.4 2.8 2.4 3.4.2-2.6 1.3-5.3 3.4-6.9-.2 2.7 3.4 5.6 3.4 9.8 0 4.6-2.9 8.2-6.5 8.2z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.9 0-1.6 1.3-2.6 2.1-3.9.8 1.4 3.5 2.2 3.5 4 0 1.6-1.2 2.8-2.8 2.8z"/>',
    porcento: '<path d="M18.5 5.5 5.5 18.5"/><circle cx="7.3" cy="7.3" r="2.3"/><circle cx="16.7" cy="16.7" r="2.3"/>',
    estrela: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    casa: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5v11h13v-11"/><path d="M10 20.5v-5.5h4v5.5"/>',
    raio: '<path d="M13.5 2.5 5 13.5h6.5l-1 8 8.5-11h-6.5z"/>',
    externo: '<path d="M9 5H5v14h14v-4"/><path d="M13 4h7v7M20 4l-9 9"/>',
    abaixo: '<path d="m6 9 6 6 6-6"/>',
    direita: '<path d="m9 6 6 6-6 6"/>'
  };
  ICO.outros = ICO.pata;

  // ---------- Como a página é organizada ----------
  var AREAS = {
    animais: { nome: "Para os animais", frase: "Rações, brinquedos, camas, gaiolas, aquários e acessórios.", ico: "pata" },
    tutor: { nome: "Para quem ama pets", frase: "Limpeza, organização, móveis, tecnologia e a rotina da casa.", ico: "casa" }
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
      ["sem-pelos", "Limpeza e remoção de pelos", "Aspiradores, robôs, mops, rodos, rolos e escovas tira-pelos."],
      ["limpeza", "Limpeza e odores", "Limpador enzimático, neutralizadores, limpa estofados e removedores de manchas."],
      ["protecao", "Proteção de móveis", "Capas de sofá, poltrona e colchão, protetores contra arranhões e telas."],
      ["organizada", "Organização da casa", "Potes de ração, cestos, caixas, organizadores e estações de alimentação."],
      ["passeio", "Transporte e passeio", "Capas e cadeirinhas para o carro, bolsas, mochilas, carrinhos e garrafas."],
      ["quintal", "Quintal, varanda e jardim", "Cercados, portões, chuveirinho, grama sintética e bebedouros externos."],
      ["tecnologia", "Tecnologia", "Câmeras, alimentadores automáticos, fontes inteligentes e rastreadores GPS."],
      ["clima", "Ar e clima", "Ar-condicionado, climatizador, ventilador, purificador e umidificador."],
      ["conforto", "Para o tutor", "Canecas, camisetas, pantufas, quadros, chaveiros e carteira de vacinação."]
    ]
  };
  var SUBS = { alimentacao: "Alimentação", brinquedos: "Brinquedos", acessorios: "Acessórios", coleiras: "Coleiras e guias", camas: "Camas",
    higiene: "Higiene", transporte: "Transporte", saude: "Saúde", arranhadores: "Arranhadores", gaiolas: "Gaiolas", poleiros: "Poleiros",
    tocas: "Tocas", rodinhas: "Rodinhas", aquarios: "Aquários", filtros: "Filtros", iluminacao: "Iluminação", terrarios: "Terrários", luz: "Aquecimento e luz" };
  var NOME_SUB = function (cat, s) { return cat === "gato" && s === "higiene" ? "Areia e higiene" : SUBS[s] || s; };
  var CAT = {}; ["animais", "tutor"].forEach(function (a) { CATS[a].forEach(function (c) { CAT[c[0]] = { area: a, nome: c[1], extra: c[2] }; }); });

  var LOJAS = { shopee: "Shopee", mercadolivre: "Mercado Livre", amazon: "Amazon", magalu: "Magalu", petz: "Petz", cobasi: "Cobasi", petlove: "Petlove", outra: "Outra loja" };
  var NA_LOJA = { shopee: "na Shopee", mercadolivre: "no Mercado Livre", amazon: "na Amazon", magalu: "na Magalu", petz: "na Petz", cobasi: "na Cobasi", petlove: "na Petlove", outra: "na loja" };
  var FAIXAS = [["ate50", "Até R$ 50", 0, 50], ["50a100", "R$ 50 a 100", 50, 100], ["100a200", "R$ 100 a 200", 100, 200], ["200mais", "Acima de R$ 200", 200, Infinity]];
  var ORDENS = [["procurados", "Mais procurados"], ["recentes", "Mais recentes"], ["menor", "Menor preço"], ["maior", "Maior preço"], ["desconto", "Maiores descontos"]];
  var DIAS_NOVO = 7;     // produto que entrou há até 7 dias é "novidade"
  var POR_PAGINA = 24;
  var DESC_MAX = 80;     // "de/por" com 80% ou mais costuma ser preço antigo inflado: não mostramos esse desconto
  var CB_NOTA = 4.8, CB_VENDAS = 500;   // custo-benefício: nota alta e muitas vendas, do mais barato para o mais caro
  // Descobertas da Abanô: atalhos que ligam filtros que já existem
  var ATALHOS = [["procurados", "Mais procurados", "fogo"], ["ofertas", "Ofertas da semana", "porcento"], ["novidades", "Novidades", "estrela"],
    ["custo", "Custo-benefício", "etiqueta"], ["casa", "Rotina da casa", "casa"], ["ate50", "Até R$ 50", "raio"], ["favoritos", "Meus favoritos", "coracao"]];
  var ATALHO = {}; ATALHOS.forEach(function (a) { ATALHO[a[0]] = a[1]; });

  // ---------- Favoritos: guardados só neste navegador, sem precisar de conta ----------
  var CHAVE_FAV = "abano-achadinhos-favoritos";
  var favs = (function () {
    try { var l = JSON.parse(localStorage.getItem(CHAVE_FAV) || "[]"); return Array.isArray(l) ? l.map(String) : []; } catch (e) { return []; }
  })();
  var ehFav = function (o) { return favs.indexOf(String(o.id)) >= 0; };
  function trocarFav(id) {
    id = String(id);
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.unshift(id);
    try { localStorage.setItem(CHAVE_FAV, JSON.stringify(favs.slice(0, 500))); } catch (e) {}
    return i < 0;
  }

  var real = function (v) { return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var desconto = function (o) {
    if (!o.preco || !o.preco_antigo || Number(o.preco_antigo) <= Number(o.preco)) return 0;
    var d = Math.round((1 - o.preco / o.preco_antigo) * 100);
    return d < DESC_MAX ? d : 0;
  };
  var custoBeneficio = function (o) { return o.preco != null && +o.avaliacao >= CB_NOTA && +o.vendas >= CB_VENDAS; };
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
    cb: q.get("cb") === "1",
    fav: q.get("fav") === "1" || q.get("ver") === "favoritos",
    ver: ATALHO[q.get("ver")] ? q.get("ver") : null,
    ordem: ORDENS.some(function (o) { return o[0] === q.get("ordem"); }) ? q.get("ordem") : "procurados",
    busca: q.get("q") || "",
    pagina: 1
  };
  if (!estado.cat && CAT[q.get("pet")]) estado.cat = q.get("pet");          // links antigos da Pet Store (?pet=cao)
  if (estado.cat) estado.area = CAT[estado.cat].area;
  if (estado.area === "tutor") estado.sub = null;                          // tipo de produto só vale para os animais
  if (estado.sub && !estado.area) estado.area = "animais";
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
    var nivel = { area: 0, cat: 1, sub: 2 }[ignorar], animal = ignorar === "animal";
    return todas.filter(function (o) {
      if (!animal && !(nivel <= 0) && estado.area && o.area !== estado.area) return false;
      if (!animal && !(nivel <= 1) && estado.cat && o.cats.indexOf(estado.cat) < 0) return false;
      if (!(nivel <= 2) && estado.sub && o.sub !== estado.sub) return false;
      if (ignorar !== "loja" && estado.loja && o.loja !== estado.loja) return false;
      if (ignorar !== "preco" && f && !naFaixa(o, f)) return false;
      if (ignorar !== "desc" && estado.desc && desconto(o) < 1) return false;
      if (ignorar !== "novo" && estado.novo && !ehNovo(o)) return false;
      if (ignorar !== "cb" && estado.cb && !custoBeneficio(o)) return false;
      if (ignorar !== "fav" && estado.fav && !ehFav(o)) return false;
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
    return hoje ? "hoje às " + h : "em " + d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "") + " às " + h;
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
    // Uma etiqueta discreta só quando o dado sustenta: já passou de mil vendas ou entrou nesta semana
    var tag = o.vendas >= 1000 ? '<span class="lj-tag">' + svg(ICO.fogo) + "Muito vendido</span>" : ehNovo(o) ? '<span class="lj-tag lj-tag-novo">Novidade</span>' : "";
    var fav = ehFav(o);
    return '<li class="lj-card">' +
      '<button type="button" class="lj-fav" data-fav="' + esc(o.id) + '" aria-pressed="' + fav + '" aria-label="Favoritar: ' + esc(o.titulo) + '" title="' + (fav ? "Tirar dos favoritos" : "Salvar nos favoritos") + '">' +
        svg(ICO.coracao) + "</button>" +
      '<a class="lj-foto" href="' + link + '" target="_blank" rel="sponsored nofollow noopener" tabindex="-1" aria-hidden="true">' + foto + tag + "</a>" +
      '<div class="lj-corpo">' +
        '<h3><a href="' + link + '" target="_blank" rel="sponsored nofollow noopener">' + esc(o.titulo) + "</a></h3>" +
        (prova.length ? '<p class="lj-prova">' + prova.join("") + "</p>" : "") +
        '<div class="lj-preco">' +
          (d >= 1 ? '<span class="lj-de"><s><span class="sr">De </span>' + real(o.preco_antigo) + '</s><span class="lj-off">-' + d + '%<span class="sr"> de desconto</span></span></span>' : "") +
          (o.preco != null ? "<b>" + (d >= 1 ? '<span class="sr">por </span>' : "") + real(o.preco) + "</b>" : '<b class="lj-ver-preco">Preço na loja</b>') +
        "</div>" +
        '<p class="lj-selo lj-' + esc(o.loja) + '"><span class="lj-ponto" aria-hidden="true"></span>' + esc(loja) + "</p>" +
        '<a class="btn lj-comprar" href="' + link + '" target="_blank" rel="sponsored nofollow noopener">Ver oferta' + svg(ICO.externo) + '<span class="sr"> ' + esc(NA_LOJA[o.loja] || NA_LOJA.outra) + " (abre em outra aba)</span></a>" +
      "</div></li>";
  }

  // ---------- Explore por aqui: as duas áreas ----------
  function desenharAreas() {
    var box = document.getElementById("lj-areas"), base = filtradas("area");
    if (!box.children.length) {
      box.innerHTML = ["animais", "tutor"].map(function (a) {
        var A = AREAS[a];
        return '<button type="button" class="lj-area lj-area-' + a + '" data-area="' + a + '" aria-pressed="false">' +
          '<span class="lj-area-foto" aria-hidden="true"><img src="imagens/achadinhos/area-' + a + '.webp" alt="" width="560" height="570" loading="lazy" decoding="async"></span>' +
          '<span class="lj-area-txt"><span class="lj-area-nome">' + svg(ICO[A.ico]) + A.nome + '</span><span class="lj-area-frase">' + A.frase + "</span>" +
          '<span class="lj-area-qtd"></span></span>' +
          '<span class="lj-area-seta" aria-hidden="true">' + svg(ICO.direita, "lj-ico lj-area-ir") + svg(ICO.check, "lj-ico lj-area-ok") + "</span></button>";
      }).join("");
    }
    box.querySelectorAll(".lj-area").forEach(function (b) {
      var a = b.dataset.area, n = base.filter(function (o) { return o.area === a; }).length;
      b.setAttribute("aria-pressed", String(estado.area === a));
      b.querySelector(".lj-area-qtd").textContent = n + (n === 1 ? " produto" : " produtos");
    });
    box.classList.toggle("lj-escolhida", !!estado.area);
  }

  // ---------- Escolha o seu animal (ou, na área dos tutores, os grupos da casa) ----------
  function desenharCats() {
    var box = document.getElementById("lj-cats"), area = estado.area === "tutor" ? "tutor" : "animais";
    var base = area === "tutor" ? filtradas("cat") : filtradas("animal");
    if (box.dataset.area !== area) {
      var primeira = !box.dataset.area;
      box.dataset.area = area;
      box.innerHTML = '<h2 class="lj-titulo" id="lj-t-cats">' + (area === "animais" ? "Escolha o seu animal" : "O que facilita a sua rotina") + "</h2>" +
        '<div class="lj-cats lj-cats-' + area + '" role="group" aria-labelledby="lj-t-cats">' + CATS[area].map(function (c) {
          return '<button type="button" class="lj-cat" data-cat="' + c[0] + '" aria-pressed="false">' +
            (area === "animais" ? '<span class="lj-cat-foto"><img src="imagens/achadinhos/animal-' + c[0] + '.webp" alt="" width="275" height="182" loading="lazy" decoding="async"></span>'
              : '<span class="lj-cat-ico">' + svg(ICO[c[0]]) + "</span>") +
            '<span class="lj-cat-txt"><span class="lj-cat-nome">' + esc(c[1]) + "</span>" +
            (area === "tutor" ? '<span class="lj-cat-frase">' + esc(c[2]) + "</span>" : "") +
            '<span class="lj-cat-qtd"></span></span></button>';
        }).join("") + "</div>";
      if (!primeira) { box.classList.remove("lj-surge"); void box.offsetWidth; box.classList.add("lj-surge"); }
    }
    box.querySelectorAll(".lj-cat").forEach(function (b) {
      var c = b.dataset.cat, n = base.filter(function (o) { return o.cats.indexOf(c) >= 0; }).length;
      b.setAttribute("aria-pressed", String(estado.cat === c));
      b.querySelector(".lj-cat-qtd").textContent = n + (n === 1 ? " produto" : " produtos");
      b.classList.toggle("lj-zerada", !n && estado.cat !== c);
    });
  }

  // ---------- Descobertas da Abanô: atalhos para filtros que já existem ----------
  function limparFiltros() {
    estado.area = estado.cat = estado.sub = estado.loja = estado.preco = null;
    estado.desc = estado.novo = estado.cb = estado.fav = false;
    estado.ordem = "procurados";
  }
  function aplicarAtalho(id) {
    var desliga = estado.ver === id || (id === "favoritos" && estado.fav);
    limparFiltros();
    if (desliga) { estado.ver = null; return; }   // clicar de novo desliga
    estado.ver = id;
    if (id === "ofertas") { estado.desc = true; estado.ordem = "desconto"; }
    if (id === "novidades") { estado.novo = true; estado.ordem = "recentes"; }
    if (id === "custo") { estado.cb = true; estado.ordem = "menor"; }
    if (id === "casa") estado.area = "tutor";
    if (id === "ate50") estado.preco = "ate50";
    if (id === "favoritos") estado.fav = true;
  }
  // Quantos favoritos ainda estão no ar (os que saíram dos Achadinhos não contam)
  var nFavs = function () { return todas.filter(ehFav).length; };
  function desenharAtalhos() {
    var box = document.getElementById("lj-atalhos");
    if (!box.children.length) box.innerHTML = ATALHOS.map(function (a) {
      return '<button type="button" class="lj-atalho lj-atalho-' + a[0] + '" data-atalho="' + a[0] + '" aria-pressed="false">' + svg(ICO[a[2]]) + "<span>" + a[1] + "</span>" +
        (a[0] === "favoritos" ? '<small class="lj-atalho-n" hidden></small>' : "") + "</button>";
    }).join("");
    box.querySelectorAll(".lj-atalho").forEach(function (b) {
      var id = b.dataset.atalho;
      b.setAttribute("aria-pressed", String(id === "favoritos" ? estado.fav : estado.ver === id));
    });
    contarFavs();
  }
  function contarFavs() {
    var n = nFavs(), s = document.querySelector(".lj-atalho-favoritos .lj-atalho-n");
    if (!s) return;
    s.hidden = !n;
    s.textContent = n;
    s.setAttribute("aria-label", n + (n === 1 ? " produto salvo" : " produtos salvos"));
  }

  // ---------- Painel de filtros (lateral no computador, gaveta no celular) ----------
  function quantos(ignorar, teste) { return filtradas(ignorar).filter(teste).length; }
  var tudo = function () { return true; };
  var CURTO = { roedores: "Hamsters e cia", outros: "Outros" };
  var TODOS_TIPOS = ["alimentacao", "brinquedos", "camas", "higiene", "saude", "coleiras", "transporte", "arranhadores", "gaiolas", "poleiros",
    "tocas", "rodinhas", "aquarios", "filtros", "iluminacao", "terrarios", "luz", "acessorios"];
  // Botão de filtro: nome, quantidade e um sinal de "escolhido"
  function botao(nome, v, rotulo, n, ligado, ico) {
    return '<button type="button" class="lj-chip' + (ico ? " lj-chip-ico" : "") + '" data-f="' + nome + '" data-v="' + v + '" aria-pressed="' + ligado + '"' + (n === 0 && !ligado ? " disabled" : "") + ">" +
      (ico ? svg(ico) + '<span class="lj-chip-txt"><span class="lj-chip-nome">' + esc(rotulo) + "</span>" +
        (n != null ? "<small>" + n + (n === 1 ? " produto" : " produtos") + "</small>" : "") + "</span>"
      : '<span class="lj-chip-nome">' + esc(rotulo) + "</span>" +
        (n != null ? '<small aria-label="' + n + (n === 1 ? ' produto">' : ' produtos">') + n + "</small>" : "")) +
      svg(ICO.check, "lj-chip-ok") + "</button>";
  }
  // Grupos recolhíveis: o que a pessoa abriu ou fechou continua assim; grupo com filtro ligado abre sozinho
  var abertos = { animal: true, sub: true, preco: true };
  function grupoF(id, titulo, classe, miolo, limpar) {
    var aberto = id in abertos ? abertos[id] : !!limpar;
    return '<details class="lj-f" data-g="' + id + '"' + (aberto ? " open" : "") + "><summary><span>" + titulo + "</span>" +
      (limpar ? '<span class="lj-f-ligado">ligado</span>' : "") + svg(ICO.abaixo, "lj-ico lj-f-seta") + "</summary>" +
      '<div class="' + classe + '" role="group" aria-label="' + titulo + '">' + miolo + "</div>" +
      (limpar ? '<button type="button" class="lj-f-limpar" data-tirar="' + limpar + '">Limpar ' + titulo.toLowerCase() + "</button>" : "") + "</details>";
  }
  function desenharPainel() {
    var corpo = document.getElementById("lj-painel-corpo"), h = "";
    var animal = estado.area === "animais" ? estado.cat : null;
    // 1) Animal
    h += grupoF("animal", "Animal", "lj-chips lj-chips-ico",
      botao("animal", "", "Todos", quantos("animal", function (o) { return o.area === "animais"; }), estado.area === "animais" && !estado.cat, ICO.pata) +
      CATS.animais.map(function (c) {
        return botao("animal", c[0], CURTO[c[0]] || c[1], quantos("animal", function (o) { return o.cats.indexOf(c[0]) >= 0; }), animal === c[0], ICO[c[0]]);
      }).join(""), animal ? "animal" : null);
    // 2) Tipo de produto (do animal escolhido, ou de todos)
    var tipos = animal ? CAT[animal].extra : TODOS_TIPOS;
    var chipsTipo = tipos.map(function (s) {
      return [s, quantos("sub", function (o) { return o.sub === s; })];
    }).filter(function (x) { return x[1] > 0 || estado.sub === x[0]; });
    if (estado.area !== "tutor" && chipsTipo.length) h += grupoF("sub", "Tipo de produto", "lj-chips",
      chipsTipo.map(function (x) { return botao("sub", x[0], NOME_SUB(animal, x[0]), x[1], estado.sub === x[0]); }).join(""), estado.sub ? "sub" : null);
    // 3) Para quem ama pets
    h += grupoF("tutor", "Para quem ama pets", "lj-chips lj-chips-ico",
      CATS.tutor.map(function (c) {
        return botao("tutor", c[0], c[1], quantos("area", function (o) { return o.cats.indexOf(c[0]) >= 0; }), estado.cat === c[0], ICO[c[0]]);
      }).join(""), estado.area === "tutor" ? "area" : null);
    // 4) Preço, desconto e loja
    h += grupoF("preco", "Faixa de preço", "lj-chips", FAIXAS.map(function (f) {
      return botao("preco", f[0], f[1], quantos("preco", function (o) { return naFaixa(o, f); }), estado.preco === f[0]);
    }).join(""), estado.preco ? "preco" : null);
    var nDesc = quantos("desc", function (o) { return desconto(o) >= 1; }), nNovo = quantos("novo", ehNovo), nCb = quantos("cb", custoBeneficio);
    var chave = function (f, rotulo, n, ligado) {
      return '<label class="lj-chave"><input type="checkbox" role="switch" data-f="' + f + '"' + (ligado ? " checked" : "") + (!n && !ligado ? " disabled" : "") +
        '><span class="lj-trilha" aria-hidden="true"></span><span>' + rotulo + "</span><small>" + n + "</small></label>";
    };
    var ligados = estado.desc || estado.novo || estado.cb;
    h += grupoF("desc", "Desconto", "lj-chaves",
      chave("desc", "Só com desconto", nDesc, estado.desc) + chave("novo", "Só novidades da semana", nNovo, estado.novo) +
      chave("cb", "Só custo-benefício", nCb, estado.cb), ligados ? "ofertas" : null);
    var lojas = [["mercadolivre", "Mercado Livre"], ["shopee", "Shopee"]].filter(function (l) { return todas.some(function (o) { return o.loja === l[0]; }); });
    if (lojas.length || estado.loja) h += grupoF("loja", "Loja", "lj-chips", lojas.map(function (l) {
      return botao("loja", l[0], l[1], quantos("loja", function (o) { return o.loja === l[0]; }), estado.loja === l[0]);
    }).join(""), estado.loja ? "loja" : null);
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
    if (estado.cb) l.push(["cb", "Custo-benefício"]);
    if (estado.fav) l.push(["fav", "Meus favoritos"]);
    if (estado.busca) l.push(["busca", "“" + estado.busca + "”"]);
    return l;
  }
  function tituloLista() {
    if (estado.ver && !estado.cat && !estado.sub && !estado.busca) return ATALHO[estado.ver];
    if (estado.fav && !estado.cat && !estado.sub && !estado.busca) return "Meus favoritos";
    if (estado.cat) return estado.sub ? NOME_SUB(estado.cat, estado.sub) + ": " + CAT[estado.cat].nome.toLowerCase() : CAT[estado.cat].nome;
    if (estado.sub) return NOME_SUB(null, estado.sub) + " para todos os animais";
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
    document.getElementById("lj-num").innerHTML = "<b>" + total + "</b> " + (total === 1 ? "produto" : "produtos") +
      (horaPrecos ? '<span class="lj-num-hora">Preços atualizados ' + esc(horaPrecos) + "</span>" : "");
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

  var jaDesenhou = false, horaPrecos = "";
  function desenharLista() {
    var l = ordenar(filtradas()), alvo = document.getElementById("lj-grade"), mais = document.getElementById("lj-mais");
    desenharBarra(l.length);
    if (jaDesenhou) { alvo.classList.remove("lj-trocou"); void alvo.offsetWidth; alvo.classList.add("lj-trocou"); }
    document.getElementById("lj-aviso-saude").hidden = !(estado.sub === "saude" || /antipulga|vermifug|suplement|bravecto|simparic/.test(semAcento(estado.busca)));
    if (!l.length && estado.fav && !nFavs()) {
      alvo.innerHTML = '<li class="lj-vazio lj-vazio-fav">' + svg(ICO.coracao) + "<b>Você ainda não salvou nenhum achadinho.</b>" +
        "<span>Toque no coração de um produto para guardar e comprar depois. Os favoritos ficam salvos neste navegador.</span>" +
        '<button type="button" class="btn" data-tirar="tudo">Ver todos os achadinhos</button></li>';
      mais.hidden = true;
      return;
    }
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
    if (estado.cb) p.set("cb", "1");
    if (estado.fav && estado.ver !== "favoritos") p.set("fav", "1");
    if (estado.ver) p.set("ver", estado.ver);
    if (estado.ordem !== "procurados") p.set("ordem", estado.ordem);
    if (estado.busca) p.set("q", estado.busca);
    var s = p.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "")); } catch (e) {}
  }

  function atualizar() {
    estado.pagina = 1;
    desenharAreas(); desenharCats(); desenharAtalhos(); desenharPainel(); desenharLista(); guardarNaUrl();
    jaDesenhou = true;
  }

  // ---------- Estrutura da página ----------
  // Os mascotes da Abanô (PNG/WebP com fundo transparente)
  var MASCOTES = function (cls) {
    return '<picture class="' + cls + '"><source srcset="imagens/abano-mascotes.webp" type="image/webp">' +
      '<img src="imagens/abano-mascotes.png" alt="" width="900" height="529" decoding="async"></picture>';
  };
  var RISCOS = '<svg class="lj-riscos" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M30 34 46 8M36 40 60 24M26 30 28 4"/></svg>';
  // Formas orgânicas atrás dos mascotes (rosa-claro e verde-limão)
  var FORMAS = '<svg class="lj-formas" viewBox="0 0 600 420" aria-hidden="true" focusable="false">' +
    '<path class="lj-forma-rosa" d="M118 92c54-70 178-96 282-58 98 36 176 116 168 214-8 96-104 160-214 168-120 8-246-18-300-98C2 238 64 162 118 92z"/>' +
    '<path class="lj-forma-lima" d="M430 40c60-14 128 18 146 78 16 52-12 104-60 120-52 18-116-4-138-58-22-56-6-126 52-140z"/>' +
    '<path class="lj-forma-lima2" d="M34 330c34-30 92-34 132-8 30 20 28 62-6 78-42 20-104 16-130-14-16-18-14-40 4-56z"/>' +
    '</svg>' + RISCOS;
  var selohora = function (hora) {
    return hora ? '<p class="lj-atualizado lj-entra"><span class="of-ponto" aria-hidden="true"></span>Preços atualizados ' + esc(hora) + "</p>" : "";
  };
  function cabecalho(hora) {
    return '<header class="lj-hero">' +
      '<div class="lj-hero-txt">' +
        '<p class="lj-etiqueta lj-entra">Achadinhos da Abanô</p>' +
        '<h1 class="lj-entra">Descobertas, ofertas e produtos para o seu pet e para a sua rotina.</h1>' +
        '<p class="lj-lead lj-entra">Seleções atualizadas para cuidar, brincar, organizar e viver melhor com os seus animais.</p>' + selohora(hora) +
      "</div>" +
      '<div class="lj-hero-arte" aria-hidden="true">' + FORMAS + MASCOTES("lj-mascotes") + "</div>" +
    "</header>";
  }
  var TRANSPARENCIA = "A Abanô reúne produtos anunciados em lojas e marketplaces, selecionando opções com base em informações disponíveis nos anúncios, como avaliações e quantidade de vendas. Alguns links são de afiliados. Isso significa que podemos receber uma comissão quando você realiza uma compra por meio deles, sem nenhum custo adicional para você. A compra é realizada diretamente na plataforma de venda. Preços, estoque, entrega, pagamento, trocas e atendimento são de responsabilidade dos respectivos vendedores e marketplaces.";
  function desenhar() {
    var hora = horaPrecos = horaAtualizacao();
    centro.innerHTML = cabecalho(hora) +
      '<form class="lj-busca lj-entra" role="search" id="lj-form">' + svg(ICO.lupa, "lj-ico lj-busca-ico") +
        '<label for="lj-q">O que você está procurando hoje?</label>' +
        '<span class="lj-campo"><input type="search" id="lj-q" placeholder="Ração, caminha, brinquedo, aspirador…" autocomplete="off" enterkeyhint="search" value="' + esc(estado.busca) + '">' +
        '<button type="submit" class="lj-buscar">Buscar</button></span></form>' +
      '<ul class="lj-confianca lj-entra" aria-label="Como funcionam os Achadinhos">' +
        "<li>" + svg(ICO.calendario) + "<span>Ofertas atualizadas diariamente</span></li>" +
        "<li>" + svg(ICO.loja) + "<span>Produtos de lojas e vendedores anunciantes</span></li>" +
        "<li>" + svg(ICO.etiqueta) + "<span>Sem custo extra para você</span></li>" +
      "</ul>" +
      '<aside class="lj-transparencia lj-entra" aria-labelledby="lj-t-transp">' +
        '<div class="lj-transp-linha">' +
          '<h2 id="lj-t-transp">' + svg(ICO.info) + "Transparência Abanô</h2>" +
          '<p class="lj-transp-resumo">Alguns links são de afiliados. Podemos receber uma comissão quando você realiza uma compra, sem custo adicional para você.</p>' +
          '<button type="button" class="lj-transp-btn" id="lj-transp-btn" aria-expanded="false" aria-controls="lj-transp-texto">Entenda como funciona' + svg(ICO.abaixo, "lj-ico lj-transp-seta") + "</button>" +
        "</div>" +
        '<div class="lj-transp-texto" id="lj-transp-texto" hidden><p>' + TRANSPARENCIA + "</p></div>" +
      "</aside>" +
      '<section class="lj-explore" aria-labelledby="lj-t-explore"><h2 class="lj-titulo" id="lj-t-explore">Explore por aqui</h2>' +
        '<div class="lj-areas" id="lj-areas" role="group" aria-labelledby="lj-t-explore"></div></section>' +
      '<section class="lj-cats-box" id="lj-cats" aria-labelledby="lj-t-cats"></section>' +
      '<section class="lj-descobertas" aria-labelledby="lj-t-desc">' +
        '<div class="lj-desc-cab"><span class="lj-desc-ico" aria-hidden="true">' + svg(ICO.sacola) + "</span>" +
          '<div><h2 id="lj-t-desc">Descobertas da Abanô</h2><p>Seleções especiais para você e o seu pet.</p></div></div>' +
        '<div class="lj-atalhos" id="lj-atalhos" role="group" aria-labelledby="lj-t-desc"></div>' +
      "</section>" +
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
          '<p class="sr" id="lj-avisa" role="status" aria-live="polite"></p>' +
          '<button type="button" class="lj-ver lj-mostrar" id="lj-mais" hidden></button>' +
        "</div>" +
      "</section>" +
      '<section class="lj-compara" aria-labelledby="lj-t-compara">' +
        '<span class="lj-compara-ico" aria-hidden="true">' + svg(ICO.etiqueta) + "</span>" +
        '<div class="lj-compara-txt"><h2 id="lj-t-compara">Compare preços e encontre a melhor oferta!</h2>' +
          '<button type="button" class="btn lj-compara-btn" data-buscar>Pesquisar um produto</button></div>' +
        '<ul class="lj-compara-passos">' + ["Pesquise o produto", "Veja as ofertas disponíveis", "Escolha o melhor preço para você"].map(function (p) {
          return "<li>" + svg(ICO.check) + p + "</li>"; }).join("") + "</ul>" +
        '<div class="lj-compara-arte" aria-hidden="true">' + RISCOS + MASCOTES("lj-compara-cao") + "</div>" +
      "</section>" +
      '<p class="lj-aviso">Aviso: os produtos dos Achadinhos não são vendidos pela Abanô. Eles são anunciados e vendidos por lojas que vendem pela Shopee (e pelo Mercado Livre), que respondem pela venda, pelo pagamento, pela entrega, pela troca e pela garantia. A Abanô não tem responsabilidade sobre qualquer problema ocorrido durante ou depois da compra. Os links são de afiliado: a Abanô recebe apenas uma comissão pela venda, de acordo com a legislação, sem nenhum custo extra para você. Preço, frete e estoque podem mudar a qualquer momento: confira sempre no anúncio antes de finalizar.</p>';
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
      var f = document.querySelectorAll("#lj-painel summary, #lj-painel button:not([disabled]), #lj-painel input:not([disabled])"), um = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === um) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); um.focus(); }
    }
  });

  var avisoT;
  function avisar(txt) {
    var a = document.getElementById("lj-avisa");
    if (!a) return;
    a.textContent = txt;
    clearTimeout(avisoT); avisoT = setTimeout(function () { a.textContent = ""; }, 3000);
  }
  function irParaLista() {
    var b = document.getElementById("lj-lista"), topo = b.getBoundingClientRect().top;
    if (topo < 0 || topo > innerHeight * 0.6) b.scrollIntoView({ behavior: suave(), block: "start" });
  }

  // ---------- Interações ----------
  centro.addEventListener("click", function (e) {
    var b = e.target.closest("button,[data-fechar-filtros]");
    if (!b || b.disabled) return;
    if (b.id === "lj-abrir-filtros") { abrirFiltros(); return; }
    if (b.id === "lj-transp-btn") {
      var abre = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(abre));
      document.getElementById("lj-transp-texto").hidden = !abre;
      return;
    }
    if (b.hasAttribute("data-buscar")) {
      var campo = document.getElementById("lj-q");
      document.getElementById("lj-form").scrollIntoView({ behavior: suave(), block: "center" });
      campo.focus({ preventScroll: true });
      return;
    }
    if (b.dataset.fav) {
      var salvou = trocarFav(b.dataset.fav);
      b.setAttribute("aria-pressed", String(salvou));
      b.title = salvou ? "Tirar dos favoritos" : "Salvar nos favoritos";
      b.classList.remove("lj-fav-pulo"); void b.offsetWidth; if (salvou) b.classList.add("lj-fav-pulo");
      avisar(salvou ? "Salvo nos seus favoritos." : "Tirado dos seus favoritos.");
      if (estado.fav) {                       // na lista de favoritos, o produto tirado sai da lista
        var cards = Array.prototype.slice.call(document.querySelectorAll("#lj-grade > .lj-card")), pos = cards.indexOf(b.closest(".lj-card"));
        desenharLista();
        var resto = document.querySelectorAll("#lj-grade > .lj-card .lj-fav");
        var alvoFoco = resto[Math.min(pos, resto.length - 1)] || document.querySelector("#lj-grade .btn");
        if (alvoFoco) alvoFoco.focus({ preventScroll: true });
      }
      contarFavs();
      return;
    }
    if (b.hasAttribute("data-fechar-filtros")) { fecharFiltros(); return; }
    if (b.id === "lj-mais") {
      var antes = document.querySelectorAll("#lj-grade > .lj-card").length;
      estado.pagina++; desenharLista();
      var novo = document.querySelectorAll("#lj-grade > .lj-card")[antes];
      if (novo) novo.querySelector("h3 a").focus({ preventScroll: true });
      return;
    }
    var noPainel = !!b.closest(".lj-painel"), rolar = false;
    if (b.dataset.atalho) {
      aplicarAtalho(b.dataset.atalho); rolar = !!estado.ver;
    } else if (b.dataset.area) {
      estado.area = estado.area === b.dataset.area ? null : b.dataset.area; estado.cat = null; estado.sub = null;
    } else if (b.dataset.cat) {
      estado.cat = estado.cat === b.dataset.cat ? null : b.dataset.cat; estado.sub = null; rolar = !!estado.cat;
      if (estado.cat) estado.area = CAT[estado.cat].area;
    } else if (b.dataset.f) {
      var f = b.dataset.f, v = b.dataset.v || null;
      if (f === "area") { estado.area = v; estado.cat = null; estado.sub = null; }
      else if (f === "cat") { estado.cat = v; estado.sub = null; }
      else if (f === "animal") {           // animal: mantém o tipo de produto se esse animal também tiver
        var mesmo = v && estado.cat === v;
        estado.area = "animais"; estado.cat = mesmo ? null : v;
        if (estado.cat && estado.sub && CAT[estado.cat].extra.indexOf(estado.sub) < 0) estado.sub = null;
      } else if (f === "tutor") { estado.area = "tutor"; estado.cat = estado.cat === v ? null : v; estado.sub = null; }
      else if (f === "sub") { estado.sub = estado.sub === v ? null : v; if (estado.area !== "animais") { estado.area = "animais"; estado.cat = null; } }
      else estado[f] = estado[f] === v ? null : v;   // loja e preço: clicar de novo desliga
    } else if (b.dataset.tirar) {
      var t = b.dataset.tirar, todos = t === "tudo";
      if (todos || t === "area") { estado.area = null; estado.cat = null; estado.sub = null; }
      if (todos || t === "cat") { estado.cat = null; estado.sub = null; }
      if (t === "animal") estado.cat = null;
      if (todos || t === "sub") estado.sub = null;
      if (todos || t === "loja") estado.loja = null;
      if (todos || t === "preco") estado.preco = null;
      if (todos || t === "desc") estado.desc = false;
      if (todos || t === "novo" || t === "ofertas") estado.novo = false;
      if (todos || t === "cb" || t === "ofertas") estado.cb = false;
      if (t === "ofertas") estado.desc = false;
      if (todos || t === "fav") estado.fav = false;
      if (todos || t === "busca") { estado.busca = ""; document.getElementById("lj-q").value = ""; }
    } else return;
    if (!b.dataset.atalho) estado.ver = null;   // mexer em outro filtro desfaz o atalho (os filtros que ele ligou continuam)
    var foco = noPainel && b.dataset.f ? '#lj-painel [data-f="' + b.dataset.f + '"][data-v="' + (b.dataset.v || "") + '"]' : null;
    atualizar();
    if (foco) { var x = document.querySelector(foco); if (x) x.focus(); }
    if (rolar && !noPainel) irParaLista();
  });
  centro.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "lj-ordem") { estado.ordem = el.value; estado.pagina = 1; desenharLista(); guardarNaUrl(); return; }
    if (el.dataset && (el.dataset.f === "desc" || el.dataset.f === "novo" || el.dataset.f === "cb")) {
      estado[el.dataset.f] = el.checked; estado.ver = null;
      atualizar();
      var y = document.querySelector('#lj-painel input[data-f="' + el.dataset.f + '"]'); if (y) y.focus();
    }
  });
  centro.addEventListener("toggle", function (e) {
    var d = e.target;
    if (d.dataset && d.dataset.g) abertos[d.dataset.g] = d.open;
  }, true);
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
    centro.innerHTML = cabecalho() +
      '<div class="lj-vazio">' + svg(ICO.sacola) + "<b>Os primeiros achadinhos chegam em breve.</b><span>Estamos separando produtos para cães, gatos, aves, hamsters, peixes e répteis, e também para a casa, o passeio e o conforto de quem convive com eles.</span><a class=\"btn\" href=\"guia/\">Ver o Guia pet</a></div>";
  }

  function iniciar() {
    var C = window.abanoConta;
    if (!C || !C.sb) { centro.innerHTML = '<p class="carregando">Não deu para carregar os achadinhos. Recarregue a página.</p>'; return; }
    carregando();
    var cat = fetch("dados/loja-catalogo.json?v=20261123").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
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
