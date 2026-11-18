/* Abanô — Ofertas pet do dia (ofertas.html)
   Produtos de afiliado em promoção. As ofertas ficam na tabela "ofertas" do Supabase:
   o administrador cadastra pelo painel e o robô de ofertas atualiza todo dia. */
(function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var LOJAS = { amazon: "Amazon", mercadolivre: "Mercado Livre", shopee: "Shopee", magalu: "Magalu", petz: "Petz", cobasi: "Cobasi", petlove: "Petlove", outra: "Loja parceira" };
  var CATEGORIAS = { racao: "Ração", petiscos: "Petiscos", brinquedos: "Brinquedos", higiene: "Higiene", saude: "Saúde", acessorios: "Acessórios", camas: "Camas", passeio: "Passeio", outros: "Outros" };
  var PETS = [["todos", "Todos"], ["cao", "Cães"], ["gato", "Gatos"]];
  var real = function (v) { return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var desconto = function (o) { return o.preco && o.preco_antigo && Number(o.preco_antigo) > Number(o.preco) ? Math.round((1 - o.preco / o.preco_antigo) * 100) : 0; };
  var centro = document.getElementById("ofertas-centro");
  if (!centro) return;

  var estado = { pet: "todos", cat: "todas", ordem: "destaque" };
  var q = new URLSearchParams(location.search);
  if (q.get("pet") === "cao" || q.get("pet") === "gato") estado.pet = q.get("pet");
  if (CATEGORIAS[q.get("cat")]) estado.cat = q.get("cat");
  var todas = [];

  function horaAtualizacao(lista) {
    var max = lista.reduce(function (m, o) { var t = new Date(o.atualizado_em).getTime(); return t > m ? t : m; }, 0);
    if (!max) return "";
    var d = new Date(max), hoje = new Date();
    var h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    var mesmoDia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === hoje.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    return mesmoDia ? "Atualizado hoje às " + h : "Atualizado em " + d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }) + " às " + h;
  }

  function cartao(o) {
    var d = desconto(o), loja = LOJAS[o.loja] || LOJAS.outra;
    var img = o.imagem_url ? '<img src="' + esc(o.imagem_url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '<span class="of-sem-foto" aria-hidden="true">🐾</span>';
    return '<li class="of' + (o.destaque ? " of-destaque" : "") + '">' +
      '<a class="of-foto" href="' + esc(o.link) + '" target="_blank" rel="sponsored nofollow noopener" tabindex="-1" aria-hidden="true">' + img +
        (d >= 5 ? '<span class="of-desc">-' + d + '%</span>' : "") + (o.destaque ? '<span class="of-fita">Destaque do dia</span>' : "") + "</a>" +
      '<div class="of-txt">' +
        '<p class="of-loja loja-' + esc(o.loja) + '">' + esc(loja) + "</p>" +
        "<h3>" + esc(o.titulo) + "</h3>" +
        '<p class="of-precos">' + (o.preco_antigo && d >= 1 ? '<s aria-label="De ' + real(o.preco_antigo) + '">' + real(o.preco_antigo) + "</s>" : "") +
          (o.preco != null ? '<b>' + real(o.preco) + "</b>" : '<b class="of-ver">Ver preço na loja</b>') + "</p>" +
        (o.cupom ? '<p class="of-cupom">Cupom <button type="button" data-cupom="' + esc(o.cupom) + '" aria-label="Copiar o cupom ' + esc(o.cupom) + '">' + esc(o.cupom) + "</button></p>" : "") +
        '<a class="btn of-btn" href="' + esc(o.link) + '" target="_blank" rel="sponsored nofollow noopener">Ver oferta<span class="of-na"> na ' + esc(loja) + "</span></a>" +
      "</div></li>";
  }

  function filtradas() {
    var l = todas.filter(function (o) {
      return (estado.pet === "todos" || o.pet === estado.pet || o.pet === "ambos") && (estado.cat === "todas" || o.categoria === estado.cat);
    });
    if (estado.ordem === "desconto") l.sort(function (a, b) { return desconto(b) - desconto(a); });
    else if (estado.ordem === "preco") l.sort(function (a, b) { return (a.preco == null ? 1e9 : +a.preco) - (b.preco == null ? 1e9 : +b.preco); });
    else l.sort(function (a, b) { return (b.destaque - a.destaque) || (desconto(b) - desconto(a)); });
    return l;
  }

  function desenharLista() {
    var l = filtradas(), ul = document.getElementById("of-lista"), n = document.getElementById("of-num");
    n.textContent = l.length === 1 ? "1 oferta" : l.length + " ofertas";
    ul.innerHTML = l.length ? l.map(cartao).join("")
      : '<li class="of-vazio"><b>Nenhuma oferta com esse filtro agora.</b><span>Volte amanhã: as ofertas mudam todo dia.</span></li>';
  }

  function desenhar() {
    var usadas = {}; todas.forEach(function (o) { usadas[o.categoria] = true; });
    var cats = Object.keys(CATEGORIAS).filter(function (k) { return usadas[k]; });
    var maior = todas.reduce(function (m, o) { return Math.max(m, desconto(o)); }, 0);
    centro.innerHTML =
      '<header class="of-hero">' +
        '<p class="of-ao-vivo"><span class="of-ponto" aria-hidden="true"></span>' + esc(horaAtualizacao(todas) || "Ofertas atualizadas todo dia") + "</p>" +
        "<h1>Ofertas pet do dia</h1>" +
        "<p>Os melhores preços em ração, petiscos, brinquedos e cuidados para cães e gatos, garimpados nas maiores lojas do Brasil.</p>" +
        (maior >= 10 ? '<p class="of-maior">Descontos de até <b>' + maior + "%</b></p>" : "") +
      "</header>" +
      '<div class="of-filtros">' +
        '<div class="of-chips" role="group" aria-label="Pet">' + PETS.map(function (p) { return '<button type="button" data-pet="' + p[0] + '" aria-pressed="' + (estado.pet === p[0]) + '">' + p[1] + "</button>"; }).join("") + "</div>" +
        (cats.length > 1 ? '<div class="of-chips" role="group" aria-label="Categoria"><button type="button" data-cat="todas" aria-pressed="' + (estado.cat === "todas") + '">Tudo</button>' +
          cats.map(function (k) { return '<button type="button" data-cat="' + k + '" aria-pressed="' + (estado.cat === k) + '">' + CATEGORIAS[k] + "</button>"; }).join("") + "</div>" : "") +
        '<label class="of-ordem"><span class="sr">Ordenar</span><select id="of-ordem"><option value="destaque">Destaques primeiro</option><option value="desconto">Maior desconto</option><option value="preco">Menor preço</option></select></label>' +
      "</div>" +
      '<p class="of-num" id="of-num" aria-live="polite"></p>' +
      '<ul class="of-grade" id="of-lista"></ul>' +
      '<p class="of-aviso">Os links desta página são de afiliado: quando você compra por eles, o Abanô pode ganhar uma pequena comissão, sem nenhum custo extra para você. É assim que mantemos o site gratuito. Preços, cupons e estoque podem mudar a qualquer momento: confira sempre na loja antes de finalizar a compra.</p>';
    document.getElementById("of-ordem").value = estado.ordem;
    desenharLista();
  }

  centro.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pet],[data-cat]");
    if (b) {
      if (b.dataset.pet) estado.pet = b.dataset.pet; else estado.cat = b.dataset.cat;
      b.parentElement.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      desenharLista();
      return;
    }
    var c = e.target.closest("[data-cupom]");
    if (c) {
      var t = c.dataset.cupom;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        c.textContent = "Copiado!"; setTimeout(function () { c.textContent = t; }, 1600);
      }).catch(function () { prompt("Copie o cupom:", t); });
    }
  });
  centro.addEventListener("change", function (e) { if (e.target.id === "of-ordem") { estado.ordem = e.target.value; desenharLista(); } });

  function vazio() {
    centro.innerHTML = '<header class="of-hero"><p class="of-ao-vivo"><span class="of-ponto" aria-hidden="true"></span>Ofertas atualizadas todo dia</p><h1>Ofertas pet do dia</h1>' +
      "<p>Estamos preparando a vitrine com os melhores preços em ração, petiscos, brinquedos e cuidados para cães e gatos.</p></header>" +
      '<div class="of-em-breve"><b>As primeiras ofertas chegam em breve.</b><span>Crie sua conta grátis e fique sabendo em primeira mão dos melhores preços e dos grandes eventos pet.</span><a class="btn" href="cadastro.html?volta=%2Fofertas.html">Quero receber as ofertas</a></div>';
  }

  function iniciar() {
    var C = window.abanoConta;
    if (!C || !C.sb) { centro.innerHTML = '<p class="carregando">Não deu para carregar as ofertas. Recarregue a página.</p>'; return; }
    C.sb.from("ofertas").select("*").eq("ativo", true).order("atualizado_em", { ascending: false }).limit(300).then(function (r) {
      if (r.error) { vazio(); return; }
      var agora = Date.now();
      todas = (r.data || []).filter(function (o) { return !o.valido_ate || new Date(o.valido_ate).getTime() > agora; });
      if (!todas.length) { vazio(); return; }
      desenhar();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
