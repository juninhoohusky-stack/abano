/* Abanô — Agenda Pet: eventos pet de todo o Brasil, com filtros por estado e tipo.
   Usada na página eventos.html e na Comunidade (?v=agenda).
   window.abanoAgenda.mostrar(container, { sb, estado, voltar }) */
window.abanoAgenda = (function () {
  "use strict";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  var CATEGORIAS = { adocao: "Adoção", encontro: "Encontros", caminhada: "Cãominhadas", feira: "Feiras e festivais", saude: "Saúde", profissional: "Para profissionais", outro: "Outros" };
  var PASTA = "https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/";
  var fotoOk = function (u) { return !!u && (String(u).indexOf(PASTA) === 0 || /^imagens\/eventos\/[a-z0-9-]+\.(webp|jpg|png)$/.test(u)); };
  var ICO = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    hora: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    preco: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.5 11 5h8v8l-7.5 7.5z"/><circle cx="15" cy="9" r="1.4"/></svg>',
    tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l1.5 4-2.5 1.5a11 11 0 0 0 6.5 6.5L16 13.5l4 1.5v4a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/></svg>',
    insta: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 13v4M10 15h4"/></svg>',
    zap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/></svg>'
  };
  var MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  // Datas sempre no fuso de Brasília (os eventos são gravados ao meio-dia)
  function partes(iso) {
    var d = new Date(iso), f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", weekday: "short" }).formatToParts(d);
    var o = {}; f.forEach(function (p) { o[p.type] = p.value; });
    return { dia: +o.day, mes: +o.month - 1, ano: +o.year, sem: (o.weekday || "").replace(".", "") };
  }
  function dataCurta(e) {
    var a = partes(e.inicio);
    if (!e.fim) return { topo: a.dia, baixo: MESES[a.mes], texto: a.sem + ", " + a.dia + " de " + MESES[a.mes].toLowerCase() + ". de " + a.ano };
    var b = partes(e.fim);
    var mesmo = a.mes === b.mes;
    return { topo: a.dia + "–" + b.dia, baixo: mesmo ? MESES[a.mes] : MESES[a.mes] + "/" + MESES[b.mes], texto: "De " + a.dia + (mesmo ? "" : " de " + MESES[a.mes].toLowerCase() + ".") + " a " + b.dia + " de " + MESES[b.mes].toLowerCase() + ". de " + b.ano };
  }
  function nomeMes(iso) { var p = partes(iso); return ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][p.mes] + " de " + p.ano; }
  function linkCalendario(e) {
    var a = partes(e.inicio), b = partes(e.fim || e.inicio);
    var z = function (n) { return (n < 10 ? "0" : "") + n; };
    var fimDia = new Date(Date.UTC(b.ano, b.mes, b.dia + 1));
    var datas = a.ano + z(a.mes + 1) + z(a.dia) + "/" + fimDia.getUTCFullYear() + z(fimDia.getUTCMonth() + 1) + z(fimDia.getUTCDate());
    var det = [e.horario, e.descricao, e.link].filter(Boolean).join("\n") + "\n\nVisto na Agenda Pet do Abanô: https://abano.com.br/eventos.html";
    return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(e.titulo) + "&dates=" + datas +
      "&details=" + encodeURIComponent(det) + "&location=" + encodeURIComponent([e.local, e.cidade, e.estado].filter(Boolean).join(", "));
  }
  function zap(numero) { var d = String(numero || "").replace(/\D/g, ""); if (d.length <= 11) d = "55" + d; return d.length >= 12 ? "https://wa.me/" + d : null; }
  function cartao(e) {
    var d = dataCurta(e), onde = [e.cidade, e.estado].filter(Boolean).join("/");
    var partilha = encodeURIComponent("🐾 " + e.titulo + " — " + d.texto + (onde ? " em " + onde : "") + ". Vi na Agenda Pet do Abanô: https://abano.com.br/eventos.html?e=" + e.id);
    var linkZap = zap(e.contato);
    return '<article class="ev" id="ev-' + esc(e.id) + '">' +
      '<div class="ev-foto">' + (fotoOk(e.foto_url) ? '<a href="' + esc(e.foto_url) + '" target="_blank" rel="noopener" aria-label="Ver o cartaz de ' + esc(e.titulo) + '"><img src="' + esc(e.foto_url) + '" alt="Cartaz do evento ' + esc(e.titulo) + '" loading="lazy" decoding="async"></a>' : '<span class="ev-sem-foto ' + esc(e.categoria) + '" aria-hidden="true"></span>') +
      '<span class="ev-data" aria-hidden="true"><b>' + esc(d.topo) + '</b><small>' + esc(d.baixo) + '</small></span></div>' +
      '<div class="ev-txt">' +
        '<p class="ev-tags"><span class="ev-cat ' + esc(e.categoria) + '">' + esc(CATEGORIAS[e.categoria] || "Evento") + "</span>" + (e.gratuito ? '<span class="ev-gratis">Gratuito</span>' : "") + "</p>" +
        "<h3>" + esc(e.titulo) + "</h3>" +
        '<ul class="ev-info">' +
          '<li>' + ICO.cal + "<span>" + esc(d.texto) + "</span></li>" +
          (e.horario ? "<li>" + ICO.hora + "<span>" + esc(e.horario) + "</span></li>" : "") +
          ((onde || e.local) ? "<li>" + ICO.pin + "<span>" + esc([e.local, onde].filter(Boolean).join(" · ")) + "</span></li>" : "") +
          (e.preco ? "<li>" + ICO.preco + "<span>" + esc(e.preco) + "</span></li>" : "") +
          (e.contato ? "<li>" + ICO.tel + "<span>" + (linkZap ? '<a href="' + linkZap + '" target="_blank" rel="noopener">' + esc(e.contato) + "</a>" : esc(e.contato)) + "</span></li>" : "") +
        "</ul>" +
        (e.descricao ? '<p class="ev-desc">' + esc(e.descricao) + "</p>" : "") +
        '<div class="ev-acoes">' +
          (e.link ? '<a class="btn" href="' + esc(e.link) + '" target="_blank" rel="noopener">' + ICO.link + "<span>Saiba mais</span></a>" : "") +
          (e.instagram && !(e.link && e.link.indexOf("instagram.com/" + e.instagram) > -1) ? '<a class="btn btn-sec" href="https://www.instagram.com/' + encodeURIComponent(e.instagram) + '/" target="_blank" rel="noopener">' + ICO.insta + "<span>@" + esc(e.instagram) + "</span></a>" : "") +
          '<a class="btn btn-sec" href="' + linkCalendario(e) + '" target="_blank" rel="noopener">' + ICO.cal + "<span>Salvar na agenda</span></a>" +
          '<a class="btn btn-sec" href="https://wa.me/?text=' + partilha + '" target="_blank" rel="noopener">' + ICO.zap + "<span>Compartilhar</span></a>" +
        "</div>" +
      "</div></article>";
  }

  function mostrar(el, op) {
    op = op || {};
    var filtro = { uf: op.estado || "", cat: "", prof: false };
    var todos = [];
    el.innerHTML = '<section class="agenda">' +
      (op.voltar || "") +
      '<header class="agenda-topo"><h1>Agenda Pet</h1><p>Encontros de raça, feiras de adoção, cãominhadas, festivais e eventos pet de todo o Brasil, num só lugar.</p></header>' +
      '<div class="agenda-filtros" role="search" aria-label="Filtrar eventos">' +
        '<label class="sr" for="ag-uf">Estado</label><select id="ag-uf"><option value="">Todo o Brasil</option>' + UFS.map(function (u) { return "<option" + (u === filtro.uf ? " selected" : "") + ">" + u + "</option>"; }).join("") + "</select>" +
        '<div class="agenda-chips" role="group" aria-label="Tipo de evento">' +
          [["", "Todos"]].concat(Object.keys(CATEGORIAS).filter(function (k) { return k !== "outro"; }).map(function (k) { return [k, CATEGORIAS[k]]; }))
            .map(function (c) { return '<button type="button" data-cat="' + c[0] + '" aria-pressed="' + (c[0] === "") + '">' + c[1] + "</button>"; }).join("") +
        "</div></div>" +
      '<div id="ag-lista" class="agenda-lista"><p class="carregando">Carregando a agenda…</p></div>' +
      '<aside class="agenda-divulgue"><div><b>Organiza um evento pet?</b><span>Encontro, feira de adoção, cãominhada: mande para a gente colocar na Agenda Pet.</span></div><a class="btn btn-sec" href="anuncie.html?tipo=evento">Divulgar meu evento</a></aside>' +
      "</section>";
    var lista = el.querySelector("#ag-lista");
    function desenhar() {
      var vis = todos.filter(function (e) {
        if (filtro.uf && e.estado !== filtro.uf) return false;
        if (filtro.cat) return filtro.cat === "profissional" ? e.profissional || e.categoria === "profissional" : e.categoria === filtro.cat && !e.profissional;
        return !e.profissional && e.categoria !== "profissional";
      });
      if (!vis.length) {
        lista.innerHTML = '<div class="agenda-vazio"><p><b>Nenhum evento ' + (filtro.uf ? "em " + esc(filtro.uf) : "por aqui") + " com esse filtro.</b> Tente outro estado ou outro tipo de evento.</p>" +
          (filtro.uf ? '<button type="button" class="btn btn-sec" id="ag-todos">Ver todo o Brasil</button>' : "") + "</div>";
        var t = lista.querySelector("#ag-todos");
        if (t) t.addEventListener("click", function () { filtro.uf = ""; el.querySelector("#ag-uf").value = ""; desenhar(); });
        return;
      }
      var html = "", mesAtual = "";
      vis.forEach(function (e) {
        var m = nomeMes(e.inicio);
        if (m !== mesAtual) { html += (mesAtual ? "</div>" : "") + '<h2 class="agenda-mes">' + esc(m) + '</h2><div class="agenda-grade">'; mesAtual = m; }
        html += cartao(e);
      });
      lista.innerHTML = html + "</div>" + (filtro.cat !== "profissional" && todos.some(function (e) { return e.profissional || e.categoria === "profissional"; })
        ? '<p class="agenda-nota">Congressos e feiras de negócios ficam no filtro <button type="button" class="link-botao" data-ir-prof>Para profissionais</button>.</p>' : "");
      var ir = lista.querySelector("[data-ir-prof]");
      if (ir) ir.addEventListener("click", function () { var b = el.querySelector('[data-cat="profissional"]'); if (b) b.click(); });
    }
    el.querySelector("#ag-uf").addEventListener("change", function (ev) { filtro.uf = ev.target.value; desenhar(); });
    el.querySelectorAll("[data-cat]").forEach(function (b) {
      b.addEventListener("click", function () {
        filtro.cat = b.dataset.cat;
        el.querySelectorAll("[data-cat]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        desenhar();
      });
    });
    var ontem = new Date(Date.now() - 864e5).toISOString();
    op.sb.from("eventos").select("*").or("inicio.gte." + ontem + ",fim.gte." + ontem).order("inicio").limit(400).then(function (r) {
      if (r.error) { lista.innerHTML = '<p class="carregando">Não deu para carregar a agenda agora. Tente de novo em instantes.</p>'; return; }
      todos = (r.data || []).slice().sort(function (x, y) { return new Date(x.inicio) - new Date(y.inicio); });
      // Se o estado da pessoa não tem eventos, mostra o Brasil todo
      if (filtro.uf && !todos.some(function (e) { return e.estado === filtro.uf; })) { filtro.uf = ""; el.querySelector("#ag-uf").value = ""; }
      desenhar();
      var alvo = new URLSearchParams(location.search).get("e");
      if (alvo) {
        var a = document.getElementById("ev-" + alvo);
        if (!a && todos.some(function (e) { return e.id === alvo; })) { filtro.uf = ""; filtro.cat = ""; el.querySelector("#ag-uf").value = ""; desenhar(); a = document.getElementById("ev-" + alvo); }
        if (a) { a.classList.add("ev-destaque"); setTimeout(function () { a.scrollIntoView({ block: "center" }); }, 60); }
      }
    });
  }
  return { mostrar: mostrar, CATEGORIAS: CATEGORIAS };
})();

// Página eventos.html: abre a agenda já no estado de quem está logado
(function () {
  var el = document.getElementById("agenda-centro");
  if (!el || !window.abanoConta) return;
  var C = window.abanoConta;
  C.sb.auth.getSession().then(function (s) {
    if (!s.data.session) return window.abanoAgenda.mostrar(el, { sb: C.sb });
    C.sb.rpc("minha_conta").then(function (r) { window.abanoAgenda.mostrar(el, { sb: C.sb, estado: (r.data && r.data.estado) || "" }); });
  });
})();
