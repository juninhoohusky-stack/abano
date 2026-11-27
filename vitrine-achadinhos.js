/* Abanô — Vitrine "Achadinhos do dia": mostra alguns achadinhos da loja passando
   um de cada vez (shampoo, arranhador, petisco…) para chamar a atenção.
   Uso: <a class="vitrine-ach" href="loja.html" data-vitrine-achadinhos>…</a>
   O próprio cartão já vem pronto no HTML; os produtos entram quando carregam. */
(function () {
  "use strict";
  var URL_SB = "https://igpwzidpiypzukmnskdb.supabase.co";
  var CHAVE = "sb_publishable_PRC9f8FexEHaH6ZGNCaGig_EVXz8JcY";
  var TROCA_MS = 3200;
  var caixas = document.querySelectorAll("[data-vitrine-achadinhos]");
  if (!caixas.length) return;

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var real = function (v) { return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };
  var calmo = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nomeLoja = function (l) { l = String(l || "").toLowerCase(); return l.indexOf("shopee") >= 0 ? "Shopee" : l.indexOf("mercado") >= 0 ? "Mercado Livre" : l.indexOf("amazon") >= 0 ? "Amazon" : ""; };
  // Nome curto e legível: "Shampoo Pet Clean Neutro 500ml para Cães..." vira as primeiras palavras
  var curto = function (t) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > 60 ? t.slice(0, 60).replace(/\s+\S*$/, "") + "…" : t; };

  function embaralhar(l) { for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = l[i]; l[i] = l[j]; l[j] = x; } return l; }

  function montar(caixa, produtos) {
    var palco = caixa.querySelector(".va-palco");
    if (!palco || !produtos.length) return;
    palco.innerHTML = produtos.map(function (o, i) {
      var preco = o.preco != null ? '<b class="va-preco">' + real(o.preco) + "</b>" : "";
      var loja = nomeLoja(o.loja);
      return '<span class="va-item' + (i === 0 ? " ativo" : "") + '" aria-hidden="' + (i === 0 ? "false" : "true") + '">' +
        '<span class="va-foto"><img src="' + esc(o.imagem_url) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>' +
        '<span class="va-info"><span class="va-nome">' + esc(curto(o.titulo)) + "</span>" +
        '<span class="va-linha">' + preco + (loja ? '<small>' + loja + "</small>" : "") + "</span></span></span>";
    }).join("");
    caixa.classList.add("com-produtos");
    // Foto que não carregar sai da roda
    palco.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () { var it = img.closest(".va-item"); if (it && palco.children.length > 1) { if (it.classList.contains("ativo")) proximo(); it.remove(); } });
    });
    if (calmo || produtos.length < 2) return;
    var parado = false, timer = 0;
    function proximo() {
      var itens = palco.children, n = itens.length; if (n < 2) return;
      var atual = 0; for (var i = 0; i < n; i++) if (itens[i].classList.contains("ativo")) { atual = i; break; }
      var seg = (atual + 1) % n;
      itens[atual].classList.remove("ativo"); itens[atual].setAttribute("aria-hidden", "true");
      itens[seg].classList.add("ativo"); itens[seg].setAttribute("aria-hidden", "false");
    }
    function rodar() { clearInterval(timer); timer = setInterval(function () { if (!parado && !document.hidden) proximo(); }, TROCA_MS); }
    caixa.addEventListener("mouseenter", function () { parado = true; });
    caixa.addEventListener("mouseleave", function () { parado = false; });
    caixa.addEventListener("focusin", function () { parado = true; });
    caixa.addEventListener("focusout", function () { parado = false; });
    rodar();
  }

  var url = URL_SB + "/rest/v1/ofertas?select=titulo,loja,imagem_url,preco,destaque" +
    "&ativo=eq.true&imagem_url=not.is.null&order=destaque.desc,atualizado_em.desc&limit=60";
  fetch(url, { headers: { apikey: CHAVE, Authorization: "Bearer " + CHAVE } })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (lista) {
      lista = (lista || []).filter(function (o) { return o.titulo && /^https:\/\//.test(o.imagem_url || ""); });
      // Mistura para cada visita mostrar achadinhos diferentes, sem repetir o mesmo nome
      var vistos = {}, escolhidos = embaralhar(lista).filter(function (o) { var k = curto(o.titulo).slice(0, 24).toLowerCase(); if (vistos[k]) return false; vistos[k] = 1; return true; }).slice(0, 12);
      caixas.forEach(function (c) { montar(c, escolhidos); });
    })
    .catch(function () { /* sem produtos, o cartão continua como convite para os Achadinhos */ });
})();
