/* Produtos dos guias: cada guia indica produtos (nome e descrição) e diz quais itens dos Achadinhos combinam
   com cada um (ids de dados/loja-catalogo.json). Este script busca na tabela ofertas os anúncios ativos desses
   itens e mostra o mais vendido de cada um, com foto, preço e o link de afiliado. O link tem rel="sponsored",
   então o aviso "Li e estou ciente" (site.js) aparece antes de ir para a loja.
   Produto sem anúncio ativo não aparece. Se nenhum tiver, a seção "Produtos que ajudam" some. */
(function () {
  var SB = "https://igpwzidpiypzukmnskdb.supabase.co";
  var CHAVE = "sb_publishable_PRC9f8FexEHaH6ZGNCaGig_EVXz8JcY";
  var LOJA = { shopee: "Shopee", mercadolivre: "Mercado Livre" };

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var real = function (v) { return "R$ " + Number(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
  var seguro = function (u) { return /^https:\/\//.test(String(u || "")) ? u : ""; };

  function tirarSecao(lista) {
    var titulo = lista.previousElementSibling, aviso = lista.nextElementSibling;
    if (titulo && titulo.tagName === "H2") titulo.remove();
    if (aviso && aviso.classList.contains("aviso")) aviso.remove();
    lista.remove();
  }

  function cartao(p, o) {
    var link = esc(o ? o.link : p.link);
    var loja = o ? LOJA[o.loja] || "loja" : "";
    var foto = o && seguro(o.imagem_url);
    var antigo = o && o.preco_antigo > o.preco ? " <s>" + real(o.preco_antigo) + "</s>" : "";
    return '<div class="produto gp">' +
      (foto ? '<a class="gp-foto" href="' + link + '" target="_blank" rel="sponsored nofollow noopener" tabindex="-1" aria-hidden="true">' +
        '<img src="' + esc(foto) + '" alt="" loading="lazy" decoding="async" width="300" height="300"></a>' : "") +
      "<h3>" + esc(p.nome) + "</h3><p>" + esc(p.descricao) + "</p>" +
      (o ? '<p class="gp-anuncio">' + esc(o.titulo) + "</p>" +
        '<p class="gp-preco"><b>' + real(o.preco) + "</b>" + antigo + " <span>na " + esc(loja) + "</span></p>" : "") +
      '<a class="btn" href="' + link + '" target="_blank" rel="sponsored nofollow noopener">' + (o ? "Ver na " + esc(loja) : "Ver produto") + "</a>" +
      "</div>";
  }

  window.abanoProdutosGuia = function (produtos) {
    var lista = document.getElementById("produtos");
    if (!lista) return;
    var ids = [];
    produtos.forEach(function (p) { (p.ids || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
    var url = SB + "/rest/v1/ofertas?select=produto,titulo,loja,link,imagem_url,preco,preco_antigo,vendas" +
      "&ativo=eq.true&produto=in.(" + ids.map(encodeURIComponent).join(",") + ")&order=vendas.desc.nullslast&limit=300";
    var pronto = ids.length ? fetch(url, { headers: { apikey: CHAVE } }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
      : Promise.resolve([]);
    pronto.then(function (ofertas) {
      var usados = {};
      var html = produtos.map(function (p) {
        // O anúncio mais vendido entre os itens que combinam com este produto (sem repetir anúncio no mesmo guia)
        var o = (ofertas || []).filter(function (x) { return (p.ids || []).indexOf(x.produto) >= 0 && !usados[x.link] && x.preco > 0; })[0];
        if (o) { usados[o.link] = 1; return cartao(p, o); }
        return p.link ? cartao(p, null) : "";
      }).join("");
      if (!html) { tirarSecao(lista); return; }
      lista.innerHTML = html;
      var aviso = lista.nextElementSibling;
      if (aviso && aviso.classList.contains("aviso")) {
        aviso.innerHTML = "Estes produtos não são vendidos pela Abanô: são anunciados e vendidos por lojas da Shopee (e do Mercado Livre), que respondem pela venda e pela entrega. " +
          "Os links são de afiliado: se você comprar por eles, a Abanô recebe uma pequena comissão, sem custo extra para você. Preço e frete podem mudar: confira no anúncio. " +
          '<a href="loja.html">Ver mais nos Achadinhos</a>.';
      }
    });
  };
})();
