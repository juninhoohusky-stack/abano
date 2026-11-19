/* Abanô — Loja pet (loja.html)
   Produtos de afiliado da Shopee e do Mercado Livre, separados por pet e por nicho.
   O robô (scripts/robo-loja.mjs) publica e atualiza tudo sozinho todo dia na tabela "ofertas".
   Quem clica vai direto para o anúncio na loja e compra do vendedor original. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var svg = function (d, cls) { return '<svg class="' + (cls || "lj-ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };
  var OLHO = '<circle cx="9.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="14.5" cy="11.5" r=".9" fill="currentColor"/>';
  var ICO = {
    todos: '<ellipse cx="6.8" cy="9.2" rx="1.9" ry="2.3"/><ellipse cx="12" cy="6.4" rx="1.9" ry="2.3"/><ellipse cx="17.2" cy="9.2" rx="1.9" ry="2.3"/><path d="M12 11.6c2.6 0 5 3 5 5 0 1.6-1.2 2.3-2.6 2.3-1 0-1.5-.5-2.4-.5s-1.4.5-2.4.5c-1.4 0-2.6-.7-2.6-2.3 0-2 2.4-5 5-5z"/>',
    cao: '<path d="M6.5 8.5 4 5l4.5 1.2M17.5 8.5 20 5l-4.5 1.2"/><path d="M6.2 9.5C6.2 6.6 8.8 5 12 5s5.8 1.6 5.8 4.5V14a5.8 5.8 0 0 1-11.6 0z"/>' + OLHO + '<path d="M11 15h2l-1 1.2z"/>',
    gato: '<path d="M5.5 4.5 8.5 8h7l3-3.5V13a6.5 6.5 0 0 1-13 0z"/>' + OLHO + '<path d="M11 15h2l-1 1zM7 15H3.5M7 16.6l-3 1.2M17 15h3.5M17 16.6l3 1.2"/>',
    aves: '<path d="M15.8 6.2a4 4 0 0 0-7.4 2.4L4 18h7.2a7 7 0 0 0 7-7V9.4L20.5 8z"/><circle cx="15" cy="8" r=".8" fill="currentColor"/><path d="M11 18l1 3M8 18l.5 3"/>',
    roedores: '<circle cx="7.5" cy="8" r="3"/><circle cx="16.5" cy="8" r="3"/><path d="M5 15.5a7 6 0 0 1 14 0c0 2.8-3 4.5-7 4.5s-7-1.7-7-4.5z"/><circle cx="10" cy="14.5" r=".8" fill="currentColor"/><circle cx="14" cy="14.5" r=".8" fill="currentColor"/>',
    peixes: '<path d="M5 12c2.6-4 6.4-5.5 9.6-5.5 3.4 0 5.6 2.8 6.4 5.5-.8 2.7-3 5.5-6.4 5.5-3.2 0-7-1.5-9.6-5.5z"/><path d="M5 12 2 8.5v7z"/><circle cx="16.5" cy="11" r=".9" fill="currentColor"/>',
    repteis: '<path d="M4.5 15a7.5 6.5 0 0 1 15 0z"/><path d="M19.5 14.5l2.5-1.8M7.5 15l-1 3M16.5 15l1 3M4.5 15H2.5"/><path d="M8 15l4-4 4 4M12 8.5V11"/>',
    racao: '<path d="M3 11h18a9 7 0 0 1-18 0z"/><path d="M7.5 11c.4-1.8 1.6-2.8 3-3M12.5 11c.2-2.3 1.6-3.8 3.5-4"/><path d="M8 21h8"/>',
    petiscos: '<path d="M15.5 4.5a2.5 2.5 0 0 1 3.5 3.5 2.5 2.5 0 0 1-1.7 4.2l-5.1 5.1A2.5 2.5 0 0 1 8 19.5a2.5 2.5 0 0 1-3.5-3.5 2.5 2.5 0 0 1 1.7-4.2l5.1-5.1a2.5 2.5 0 0 1 4.2-2.2z"/>',
    alimentacao: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l8-8"/>',
    potes: '<path d="M12 3.5s6 6.4 6 10.7a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
    camas: '<path d="M3 19V8M3 15h18v4M21 15v-2.5a3 3 0 0 0-3-3h-7V15"/><circle cx="7" cy="12" r="1.7"/>',
    brinquedos: '<circle cx="12" cy="12" r="8"/><path d="M4.6 9c4.6 1.3 10.2 1.3 14.8 0M4.6 15c4.6-1.3 10.2-1.3 14.8 0"/>',
    arranhadores: '<path d="M7 9V5h10v4zM10 21V9h4v12M6 21h12"/><path d="M10 12.5h4M10 16h4"/>',
    higiene: '<path d="M4 12h16v1.5a6.5 6.5 0 0 1-6.5 6.5h-3A6.5 6.5 0 0 1 4 13.5z"/><path d="M6.5 12V6.5a2.2 2.2 0 0 1 4-1.2"/><path d="M15.5 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
    escovacao: '<rect x="4" y="8" width="16" height="5" rx="1.5"/><path d="M6.5 13v5.5M9.5 13v5.5M12.5 13v5.5M15.5 13v5.5M10 8V4.5h4V8"/>',
    saude: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M12 9v6M9 12h6"/>',
    passeio: '<circle cx="7" cy="17" r="3"/><path d="M9.2 14.8 19 5"/><path d="M15.5 4.5H19.5v4"/>',
    casa: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    gaiolas: '<path d="M5 20V10a7 7 0 0 1 14 0v10"/><path d="M9 20V6.2M12 20V3M15 20V6.2M3.5 20h17"/>',
    aquario: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M7 13c1.4-1.9 3.8-2.4 5.8-1 .8.6 1.5.9 2.4.9-.9.1-1.6.4-2.4 1-2 1.4-4.4.9-5.8-.9z"/>',
    terrario: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    acessorios: '<path d="M3.5 12.5 11 5h8v8l-7.5 7.5z"/><circle cx="15" cy="9" r="1.4"/>',
    tudo: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
    fechar: '<path d="M7 7l10 10M17 7 7 17"/>',
    alerta: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    loja: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'
  };
  ICO.outros = ICO.acessorios;

  var LOJAS = { shopee: "Shopee", mercadolivre: "Mercado Livre", amazon: "Amazon", magalu: "Magalu", petz: "Petz", cobasi: "Cobasi", petlove: "Petlove", outra: "Loja parceira" };
  var NA_LOJA = { shopee: "na Shopee", mercadolivre: "no Mercado Livre", amazon: "na Amazon", magalu: "na Magalu", petz: "na Petz", cobasi: "na Cobasi", petlove: "na Petlove", outra: "na loja" };
  var NICHOS = [
    ["racao", "Rações", "Só premium e super premium, das marcas que os veterinários mais indicam."],
    ["petiscos", "Petiscos", "Para agradar, treinar e cuidar dos dentes."],
    ["alimentacao", "Feno e sementes", "Feno, sementes e complementos para aves, roedores, coelhos e répteis."],
    ["potes", "Potes e fontes", "Comedouros, fontes e bebedouros para cada tamanho de pet."],
    ["camas", "Camas e casinhas", "Conforto para dormir dentro e fora de casa."],
    ["brinquedos", "Brinquedos", "Gasto de energia, enriquecimento e diversão."],
    ["arranhadores", "Arranhadores", "Arranhadores, prateleiras e nichos para o gato ganhar altura."],
    ["higiene", "Higiene e banho", "Shampoos, areias, tapetes higiênicos e limpeza."],
    ["escovacao", "Escovas e unhas", "Escovas, removedores de pelo e cortadores."],
    ["saude", "Saúde", ""],
    ["passeio", "Passeio", "Peitorais, guias, bolsas e caixas de transporte."],
    ["casa", "Casa e treino", "Telas, portões, aspiradores e itens de adestramento."],
    ["gaiolas", "Gaiolas", "Gaiolas, viveiros, poleiros e tocas."],
    ["aquario", "Aquário", "Aquários, filtros, aquecedores e testes de água."],
    ["terrario", "Terrário", "Lâmpadas UVB, aquecimento e abrigos para répteis."],
    ["acessorios", "Acessórios", ""],
    ["outros", "Outros achados", ""]
  ];
  var NOME_NICHO = {}; NICHOS.forEach(function (n) { NOME_NICHO[n[0]] = n[1]; });
  var PETS = [["todos", "Todos"], ["cao", "Cães"], ["gato", "Gatos"], ["aves", "Aves"], ["roedores", "Roedores e coelhos"], ["peixes", "Peixes"], ["repteis", "Répteis"]];
  var NOME_PET = {}; PETS.forEach(function (p) { NOME_PET[p[0]] = p[1]; });
  var ORDENS = [["vendidos", "Mais vendidos"], ["preco", "Menor preço"], ["desconto", "Maior desconto"], ["nota", "Melhor nota"]];
  var NA_VITRINE = 8;      // produtos por nicho antes do "Ver todos"
  var NICHOS_CELULAR = 7;  // no celular, os outros nichos ficam atrás do botão "+ N nichos"

  var real = function (v) { return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var desconto = function (o) { return o.preco && o.preco_antigo && Number(o.preco_antigo) > Number(o.preco) ? Math.round((1 - o.preco / o.preco_antigo) * 100) : 0; };
  var vendidos = function (n) { return n >= 10000 ? Math.floor(n / 1000) + " mil vendidos" : n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",").replace(",0", "") + " mil vendidos" : n + " vendidos"; };
  var centro = document.getElementById("loja-centro");
  if (!centro) return;

  var q = new URLSearchParams(location.search);
  var estado = {
    pet: NOME_PET[q.get("pet")] ? q.get("pet") : "todos",
    nicho: NOME_NICHO[q.get("nicho")] ? q.get("nicho") : "todos",
    loja: q.get("loja") === "shopee" || q.get("loja") === "mercadolivre" ? q.get("loja") : "todas",
    ordem: ORDENS.some(function (o) { return o[0] === q.get("ordem"); }) ? q.get("ordem") : "vendidos",
    busca: q.get("q") || "",
    maisNichos: false
  };
  var todas = [];

  var semAcento = function (s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  function doPet(o, pet) {
    if (pet === "todos") return true;
    return o.pet === pet || o.pet === "todos" || (o.pet === "ambos" && (pet === "cao" || pet === "gato"));
  }
  function filtradas(ignorar) {
    var termos = semAcento(estado.busca).split(/\s+/).filter(Boolean);
    return todas.filter(function (o) {
      if (ignorar !== "pet" && !doPet(o, estado.pet)) return false;
      if (ignorar !== "loja" && estado.loja !== "todas" && o.loja !== estado.loja) return false;
      if (ignorar !== "nicho" && estado.nicho !== "todos" && o.categoria !== estado.nicho) return false;
      if (termos.length) {
        var t = semAcento(o.titulo + " " + (NOME_NICHO[o.categoria] || ""));
        if (!termos.every(function (p) { return t.indexOf(p) >= 0; })) return false;
      }
      return true;
    });
  }
  function contar(lista, campo) { var c = {}; lista.forEach(function (o) { c[o[campo]] = (c[o[campo]] || 0) + 1; }); return c; }

  function horaAtualizacao() {
    var max = todas.reduce(function (m, o) { var t = new Date(o.atualizado_em).getTime(); return t > m ? t : m; }, 0);
    if (!max) return "Preços atualizados todo dia";
    var d = new Date(max), fuso = { timeZone: "America/Sao_Paulo" };
    var h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    var hoje = d.toLocaleDateString("pt-BR", fuso) === new Date().toLocaleDateString("pt-BR", fuso);
    return hoje ? "Preços atualizados hoje às " + h : "Preços atualizados em " + d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });
  }

  // ---------- Cartão de produto ----------
  function cartao(o) {
    var d = desconto(o), loja = LOJAS[o.loja] || LOJAS.outra, link = esc(o.link);
    var foto = o.imagem_url
      ? '<img src="' + esc(o.imagem_url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="300" height="300">'
      : '<span class="lj-sem-foto">' + svg(ICO.todos) + "</span>";
    var prova = [];
    if (o.avaliacao) prova.push('<span class="lj-nota"><span aria-hidden="true">★</span> ' + Number(o.avaliacao).toFixed(1).replace(".", ",") + '<span class="sr"> de 5</span></span>');
    if (o.vendas >= 10) prova.push("<span>" + vendidos(o.vendas) + "</span>");
    return '<li class="lj-card">' +
      '<a class="lj-foto" href="' + link + '" target="_blank" rel="sponsored nofollow noopener" tabindex="-1" aria-hidden="true">' + foto +
        (d >= 5 ? '<span class="lj-desc">-' + d + "%</span>" : "") + "</a>" +
      '<div class="lj-corpo">' +
        '<p class="lj-selo lj-' + esc(o.loja) + '"><span class="lj-ponto" aria-hidden="true"></span>' + esc(loja) + "</p>" +
        '<h3><a href="' + link + '" target="_blank" rel="sponsored nofollow noopener">' + esc(o.titulo) + "</a></h3>" +
        (prova.length ? '<p class="lj-prova">' + prova.join("") + "</p>" : "") +
        '<div class="lj-preco">' +
          (o.preco_antigo && d >= 1 ? '<s><span class="sr">De </span>' + real(o.preco_antigo) + "</s>" : "") +
          (o.preco != null ? "<b>" + (d >= 1 ? '<span class="sr">por </span>' : "") + real(o.preco) + "</b>" : '<b class="lj-ver-preco">Ver preço na loja</b>') +
          '<small>Frete e parcelas na loja</small>' +
        "</div>" +
        '<a class="btn lj-comprar" href="' + link + '" target="_blank" rel="sponsored nofollow noopener"><span>Comprar<span class="lj-na"> ' + esc(NA_LOJA[o.loja] || "na loja") + '</span></span><span class="sr"> (abre em outra aba)</span></a>' +
      "</div></li>";
  }

  function ordenar(l) {
    var por = {
      vendidos: function (a, b) { return (b.destaque - a.destaque) || ((b.vendas || 0) - (a.vendas || 0)) || (desconto(b) - desconto(a)); },
      preco: function (a, b) { return (a.preco == null ? 1e9 : +a.preco) - (b.preco == null ? 1e9 : +b.preco); },
      desconto: function (a, b) { return (desconto(b) - desconto(a)) || ((b.vendas || 0) - (a.vendas || 0)); },
      nota: function (a, b) { return ((b.avaliacao || 0) - (a.avaliacao || 0)) || ((b.vendas || 0) - (a.vendas || 0)); }
    }[estado.ordem];
    return l.slice().sort(por);
  }

  // ---------- Escolha do pet (na abertura) ----------
  // Os botões são montados uma vez e depois só mudam de estado, para as transições do CSS acontecerem
  var CHECK = svg('<path d="m6 12.5 4 4 8-9"/>', "lj-check-ico");
  function desenharPets() {
    var box = document.getElementById("lj-pets"), base = filtradas("pet");
    if (!box.children.length) {
      box.innerHTML = PETS.filter(function (p) { return p[0] === "todos" || todas.some(function (o) { return doPet(o, p[0]); }); }).map(function (p) {
        return '<button type="button" class="lj-pet" data-pet="' + p[0] + '" aria-pressed="false">' +
          '<span class="lj-pet-ico">' + svg(ICO[p[0]]) + '<span class="lj-check">' + CHECK + "</span></span>" +
          '<span class="lj-pet-nome">' + esc(p[1]) + '</span><span class="lj-pet-qtd"></span></button>';
      }).join("");
    }
    box.querySelectorAll(".lj-pet").forEach(function (b) {
      var p = b.dataset.pet;
      b.setAttribute("aria-pressed", String(estado.pet === p));
      b.querySelector(".lj-pet-qtd").textContent = p === "todos" ? base.length : base.filter(function (o) { return doPet(o, p); }).length;
    });
  }

  // ---------- Atalhos por nicho ----------
  function desenharNichos() {
    var nav = document.getElementById("lj-nichos"), base = filtradas("nicho"), c = contar(base, "categoria");
    if (!nav.children.length) {
      var usados = contar(todas, "categoria");
      nav.innerHTML = '<div class="lj-nichos" role="group" aria-label="Nichos">' +
        [["todos", "Tudo"]].concat(NICHOS.filter(function (n) { return usados[n[0]]; })).map(function (n) {
          return '<button type="button" class="lj-nicho" data-nicho="' + n[0] + '" aria-pressed="false">' + svg(ICO[n[0] === "todos" ? "tudo" : n[0]]) +
            "<span>" + esc(n[1]) + "</span><small></small></button>";
        }).join("") +
        '<button type="button" class="lj-nicho lj-mais" data-mais-nichos aria-expanded="false"></button></div>';
    }
    var visiveis = 0, botoes = nav.querySelectorAll(".lj-nicho[data-nicho]");
    botoes.forEach(function (b) {
      var n = b.dataset.nicho, qtd = n === "todos" ? base.length : (c[n] || 0);
      b.hidden = !qtd && n !== estado.nicho && n !== "todos";
      b.setAttribute("aria-pressed", String(estado.nicho === n));
      b.querySelector("small").textContent = qtd;
      b.classList.toggle("lj-extra", !b.hidden && visiveis++ >= NICHOS_CELULAR);
    });
    var ativo = nav.querySelector('.lj-nicho[aria-pressed="true"]');
    var aberto = estado.maisNichos || (ativo && ativo.classList.contains("lj-extra"));
    var escondidos = Math.max(0, visiveis - NICHOS_CELULAR), mais = nav.querySelector(".lj-mais");
    nav.firstChild.classList.toggle("aberto", !!aberto);
    mais.hidden = !escondidos || aberto;
    mais.textContent = "+ " + escondidos + " nichos";
  }

  // ---------- Barra de resultado: filtros ativos, loja e ordem ----------
  function desenharBarra(total) {
    var ativos = [];
    if (estado.pet !== "todos") ativos.push(["pet", NOME_PET[estado.pet]]);
    if (estado.nicho !== "todos") ativos.push(["nicho", NOME_NICHO[estado.nicho]]);
    if (estado.loja !== "todas") ativos.push(["loja", LOJAS[estado.loja]]);
    if (estado.busca) ativos.push(["busca", "“" + estado.busca + "”"]);
    var lojas = [["todas", "Todas"], ["shopee", "Shopee"], ["mercadolivre", "Mercado Livre"]].filter(function (l) { return l[0] === "todas" || todas.some(function (o) { return o.loja === l[0]; }); });
    document.getElementById("lj-barra").innerHTML =
      '<div class="lj-resumo"><p class="lj-num" aria-live="polite"><b>' + total + "</b> " + (total === 1 ? "produto" : "produtos") + "</p>" +
        (ativos.length ? '<ul class="lj-ativos">' + ativos.map(function (a) {
          return '<li><button type="button" data-tirar="' + a[0] + '" aria-label="Tirar o filtro ' + esc(a[1]) + '">' + esc(a[1]) + svg(ICO.fechar, "lj-x") + "</button></li>";
        }).join("") + (ativos.length > 1 ? '<li><button type="button" class="lj-limpar" data-tirar="tudo">Limpar tudo</button></li>' : "") + "</ul>" : "") +
      "</div>" +
      '<div class="lj-controles">' +
        (lojas.length > 2 ? '<div class="lj-seg" role="group" aria-label="Loja">' + lojas.map(function (l) {
          return '<button type="button" data-loja="' + l[0] + '" aria-pressed="' + (estado.loja === l[0]) + '">' + l[1] + "</button>";
        }).join("") + "</div>" : "") +
        '<label class="lj-ordem"><span>Ordenar</span><select id="lj-ordem">' + ORDENS.map(function (o) {
          return '<option value="' + o[0] + '"' + (estado.ordem === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") + "</select></label>" +
      "</div>";
  }

  function secao(n, lista, completa) {
    var mostrar = completa ? lista : lista.slice(0, NA_VITRINE);
    var aviso = n[0] === "saude"
      ? '<p class="lj-alerta">' + svg(ICO.alerta) + "<span>Antipulgas, vermífugos e suplementos: use sempre com orientação do veterinário, de acordo com a espécie e o peso do seu pet.</span></p>"
      : (n[2] ? '<p class="lj-sub">' + esc(n[2]) + "</p>" : "");
    return '<section class="lj-secao" id="nicho-' + n[0] + '" aria-labelledby="t-' + n[0] + '">' +
      '<div class="lj-cab">' +
        '<span class="lj-cab-ico">' + svg(ICO[n[0]] || ICO.acessorios) + "</span>" +
        '<div class="lj-cab-txt"><h2 id="t-' + n[0] + '">' + esc(n[1]) + ' <span class="lj-qtd">' + lista.length + "</span></h2>" + aviso + "</div>" +
        (!completa && lista.length > NA_VITRINE ? '<button type="button" class="lj-ver" data-nicho="' + n[0] + '">Ver todos os ' + lista.length + "</button>" : "") +
        (completa ? '<button type="button" class="lj-ver" data-nicho="todos">Ver todos os nichos</button>' : "") +
      "</div>" +
      '<ul class="lj-grade' + (completa ? "" : " lj-trilho") + '">' + mostrar.map(cartao).join("") + "</ul></section>";
  }

  function desenharLista() {
    var l = filtradas(), alvo = document.getElementById("lj-lista");
    desenharBarra(l.length);
    alvo.classList.remove("lj-trocou"); void alvo.offsetWidth; if (jaDesenhou) alvo.classList.add("lj-trocou");
    if (!l.length) {
      alvo.innerHTML = '<div class="lj-vazio">' + svg(ICO.lupa) + "<b>Nenhum produto com esses filtros agora.</b><span>Tente outro pet, outro nicho ou outra palavra. A loja muda todo dia.</span>" +
        '<button type="button" class="btn" data-tirar="tudo">Limpar os filtros</button></div>';
      return;
    }
    if (estado.nicho !== "todos") {
      alvo.innerHTML = secao(NICHOS.filter(function (x) { return x[0] === estado.nicho; })[0], ordenar(l), true);
      return;
    }
    alvo.innerHTML = NICHOS.map(function (n) {
      var doNicho = l.filter(function (o) { return o.categoria === n[0]; });
      return doNicho.length ? secao(n, ordenar(doNicho), false) : "";
    }).join("");
  }

  function guardarNaUrl() {
    var p = new URLSearchParams();
    if (estado.pet !== "todos") p.set("pet", estado.pet);
    if (estado.nicho !== "todos") p.set("nicho", estado.nicho);
    if (estado.loja !== "todas") p.set("loja", estado.loja);
    if (estado.ordem !== "vendidos") p.set("ordem", estado.ordem);
    if (estado.busca) p.set("q", estado.busca);
    var s = p.toString();
    try { history.replaceState(null, "", location.pathname + (s ? "?" + s : "")); } catch (e) {}
  }

  var jaDesenhou = false;
  function atualizar() { desenharPets(); desenharNichos(); desenharLista(); guardarNaUrl(); jaDesenhou = true; }

  function desenhar() {
    centro.innerHTML =
      '<header class="lj-hero">' +
        '<div class="lj-hero-txt">' +
          '<p class="lj-ao-vivo lj-entra"><span class="of-ponto" aria-hidden="true"></span>' + esc(horaAtualizacao()) + "</p>" +
          '<h1 class="lj-entra">Loja pet</h1>' +
          '<p class="lj-entra">Os produtos que a gente indica para cada pet, com o preço da Shopee e do Mercado Livre. Você escolhe aqui e compra direto na loja, do vendedor original.</p>' +
          '<form class="lj-busca lj-entra" role="search" id="lj-form"><label for="lj-q">Procurar na loja</label>' +
            '<span class="lj-campo">' + svg(ICO.lupa) + '<input type="search" id="lj-q" placeholder="Ração, arranhador, peitoral…" autocomplete="off" enterkeyhint="search" value="' + esc(estado.busca) + '"></span></form>' +
        "</div>" +
        '<div class="lj-hero-pets lj-entra"><p class="lj-rotulo" id="lj-rot-pet">Para qual pet?</p><div class="lj-pets" id="lj-pets" role="group" aria-labelledby="lj-rot-pet"></div></div>' +
      "</header>" +
      '<ol class="lj-passos lj-entra" aria-label="Como funciona">' +
        "<li><b>Escolha aqui</b><span>Produtos indicados para cada pet, com preço atualizado todo dia.</span></li>" +
        "<li><b>Compre na loja</b><span>O botão leva para o anúncio na Shopee ou no Mercado Livre.</span></li>" +
        "<li><b>Receba do vendedor</b><span>Pagamento, entrega e garantia são feitos pela loja.</span></li>" +
      "</ol>" +
      '<nav id="lj-nichos" aria-label="Nichos da loja"></nav>' +
      '<div class="lj-barra" id="lj-barra"></div>' +
      '<div id="lj-lista"></div>' +
      '<p class="lj-aviso">Os links desta página são de afiliado: quando você compra por eles, o Abanô ganha uma pequena comissão da loja, sem nenhum custo extra para você. É assim que mantemos o site gratuito. A compra, a entrega e a garantia são feitas pela loja e pelo vendedor. Preço, frete e estoque podem mudar a qualquer momento: confira sempre no anúncio antes de finalizar.</p>';
    atualizar();
  }

  // ---------- Interações ----------
  centro.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pet],[data-nicho],[data-loja],[data-tirar],[data-mais-nichos]");
    if (!b) return;
    if (b.hasAttribute("data-mais-nichos")) { estado.maisNichos = true; desenharNichos(); var x = centro.querySelector(".lj-extra:not([hidden])"); if (x) x.focus(); return; }
    if (b.dataset.tirar) {
      var t = b.dataset.tirar;
      if (t === "pet" || t === "tudo") estado.pet = "todos";
      if (t === "nicho" || t === "tudo") estado.nicho = "todos";
      if (t === "loja" || t === "tudo") estado.loja = "todas";
      if (t === "busca" || t === "tudo") { estado.busca = ""; document.getElementById("lj-q").value = ""; }
    } else if (b.dataset.pet) estado.pet = b.dataset.pet;
    else if (b.dataset.nicho) estado.nicho = b.dataset.nicho;
    else estado.loja = b.dataset.loja;
    atualizar();
    if (b.classList.contains("lj-ver") || b.closest(".lj-nichos")) {
      var alvo = document.getElementById("lj-barra");
      if (alvo.getBoundingClientRect().top < 0 || b.classList.contains("lj-ver")) alvo.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  });
  var pausa;
  centro.addEventListener("input", function (e) {
    if (e.target.id !== "lj-q") return;
    clearTimeout(pausa);
    pausa = setTimeout(function () { estado.busca = e.target.value.trim(); atualizar(); }, 220);
  });
  centro.addEventListener("submit", function (e) {
    e.preventDefault();
    estado.busca = document.getElementById("lj-q").value.trim(); atualizar();
    document.getElementById("lj-barra").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  centro.addEventListener("change", function (e) { if (e.target.id === "lj-ordem") { estado.ordem = e.target.value; desenharLista(); guardarNaUrl(); } });

  // ---------- Carregando, vazio e início ----------
  function carregando() {
    var c = ""; for (var i = 0; i < 8; i++) c += '<li class="lj-card lj-fantasma" aria-hidden="true"><span></span><i></i><i></i><i></i></li>';
    centro.innerHTML = '<p class="sr" role="status">Carregando a loja…</p><div class="lj-hero lj-hero-fantasma" aria-hidden="true"></div><ul class="lj-grade">' + c + "</ul>";
  }
  function vazio() {
    centro.innerHTML = '<header class="lj-hero"><div class="lj-hero-txt"><p class="lj-ao-vivo"><span class="of-ponto" aria-hidden="true"></span>Preços atualizados todo dia</p><h1>Loja pet</h1>' +
      "<p>Estamos montando a loja com os produtos que a gente indica para cada pet: rações premium, camas, arranhadores, brinquedos, higiene e muito mais.</p></div></header>" +
      '<div class="lj-vazio">' + svg(ICO.loja) + "<b>Os primeiros produtos chegam em breve.</b><span>Enquanto isso, veja os guias de cuidados de cada pet.</span><a class=\"btn\" href=\"guia/\">Ver o Guia pet</a></div>";
  }

  function iniciar() {
    var C = window.abanoConta;
    if (!C || !C.sb) { centro.innerHTML = '<p class="carregando">Não deu para carregar a loja. Recarregue a página.</p>'; return; }
    carregando();
    C.sb.from("ofertas")
      .select("id,titulo,loja,link,imagem_url,preco,preco_antigo,pet,categoria,destaque,valido_ate,atualizado_em,avaliacao,vendas")
      .eq("ativo", true).limit(1000).then(function (r) {
        // Antes de rodar o loja_afiliados.sql as colunas novas não existem: tenta o formato antigo
        return r.error ? C.sb.from("ofertas").select("*").eq("ativo", true).limit(1000) : r;
      }).then(function (r) {
        if (!r || r.error) { vazio(); return; }
        var agora = Date.now();
        todas = (r.data || []).filter(function (o) { return /^https:\/\//.test(o.link || "") && (!o.valido_ate || new Date(o.valido_ate).getTime() > agora); });
        if (!todas.length) { vazio(); return; }
        desenhar();
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
