/* Abanô — Páginas de serviços (veterinários, hospedagem, adestramento, pet shop, banho e tosa)
   1) Mapa do Google com o que existe perto da pessoa (gratuito, Maps Embed API)
   2) Parceiros em destaque no Abanô (pagos), com avaliações dos tutores
   Depende de supabase-js, lista.js (GOOGLE_MAPS_CHAVE) e conta.js. */
(() => {
  "use strict";
  const app = document.getElementById("servicos-app");
  if (!app) return;
  const C = window.abanoConta, sb = C && C.sb;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CHAVE = typeof GOOGLE_MAPS_CHAVE !== "undefined" ? GOOGLE_MAPS_CHAVE : "";
  const PASTA = typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL + "/storage/v1/object/public/fotos/" : "x";
  const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

  // Cada página tem os seus atalhos de busca: o rótulo do botão e o que vai para o Google Maps
  const CATEGORIAS = {
    veterinario: { nome: "veterinário", artigo: "um veterinário", tipos: [
      ["Todos", "veterinário"], ["24 horas", "clínica veterinária 24 horas"], ["Hospital", "hospital veterinário"],
      ["Gatos", "veterinário especialista em gatos"], ["Silvestres e exóticos", "veterinário de animais silvestres e exóticos"]] },
    hospedagem: { nome: "hospedagem", artigo: "uma hospedagem", tipos: [
      ["Todos", "hotel para cachorro"], ["Creche", "creche para cães"], ["Hotel para gatos", "hotel para gatos"], ["Pet sitter", "pet sitter"]] },
    adestramento: { nome: "adestrador", artigo: "um adestrador", tipos: [
      ["Todos", "adestrador de cães"], ["Filhotes", "adestramento de filhotes"], ["Comportamento", "adestrador comportamento canino"], ["Agility", "agility para cães"]] },
    petshop: { nome: "pet shop", artigo: "um pet shop", tipos: [
      ["Todos", "pet shop"], ["Ração", "casa de ração"], ["Farmácia veterinária", "farmácia veterinária"], ["Aves e peixes", "loja de aquarismo e aves"]] },
    banho_tosa: { nome: "banho e tosa", artigo: "um banho e tosa", tipos: [
      ["Todos", "banho e tosa"], ["Leva e traz", "banho e tosa com leva e traz"], ["Gatos", "banho e tosa para gatos"], ["Tosa da raça", "tosa da raça"]] }
  };
  const cat = app.dataset.categoria, CAT = CATEGORIAS[cat];
  if (!CAT) return;

  let tipo = 0, onde = null;        // onde = { cidade } ou { lat, lng }
  let sessao = null, eu = null;

  // ---------- 1. Busca no mapa ----------
  const chips = $("srv-tipos");
  chips.innerHTML = CAT.tipos.map((t, i) => `<button type="button" class="srv-chip" aria-pressed="${i === 0}" data-i="${i}">${esc(t[0])}</button>`).join("");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    tipo = +b.dataset.i;
    chips.querySelectorAll("[data-i]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    if (onde) mostrarMapa();
  });

  function consulta() {
    const termo = CAT.tipos[tipo][1];
    return onde.cidade ? termo + " em " + onde.cidade : termo + " near " + onde.lat.toFixed(4) + "," + onde.lng.toFixed(4);
  }
  function mostrarMapa() {
    const q = consulta();
    let src;
    if (CHAVE) {
      src = "https://www.google.com/maps/embed/v1/search?key=" + encodeURIComponent(CHAVE) + "&language=pt-BR&region=BR&q=" + encodeURIComponent(q);
      if (onde.lat != null) src += "&center=" + onde.lat.toFixed(4) + "," + onde.lng.toFixed(4) + "&zoom=14";
    } else {
      // Sem chave configurada: mapa público do Google (funciona, mas sem as garantias da API oficial)
      src = "https://maps.google.com/maps?hl=pt-BR&output=embed&z=" + (onde.lat != null ? 14 : 12) + "&q=" + encodeURIComponent(q);
    }
    const area = $("srv-mapa");
    area.innerHTML = `<iframe title="Mapa do Google com ${esc(CAT.tipos[tipo][1])}" src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`;
    area.classList.add("com-mapa");
    $("srv-abrir").href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
    $("srv-abrir").hidden = false;
    $("srv-status").textContent = "Mostrando " + CAT.tipos[tipo][1] + (onde.cidade ? " em " + onde.cidade + "." : " perto de você.");
  }

  $("srv-perto").addEventListener("click", () => {
    const st = $("srv-status");
    if (!navigator.geolocation) { st.textContent = "Seu navegador não informa a localização. Digite a cidade."; return; }
    st.textContent = "Pedindo a sua localização…";
    navigator.geolocation.getCurrentPosition((p) => {
      onde = { lat: p.coords.latitude, lng: p.coords.longitude };
      mostrarMapa();
    }, (err) => {
      st.textContent = err.code === 1
        ? "Sem permissão para usar a localização. Tudo bem: digite a sua cidade."
        : "Não conseguimos achar a sua localização agora. Digite a sua cidade.";
      $("srv-cidade").focus();
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });

  $("srv-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const c = $("srv-cidade").value.trim().replace(/\s+/g, " ");
    if (c.length < 2) { $("srv-status").textContent = "Digite o nome da cidade ou do bairro."; $("srv-cidade").focus(); return; }
    onde = { cidade: c };
    try { localStorage.setItem("abano-cidade", c); } catch (err) {}
    const uf = (c.match(/(?:[,/-]\s*|\s)([A-Za-z]{2})$/) || [])[1];
    if (uf && UFS.indexOf(uf.toUpperCase()) >= 0) carregarParceiros(uf.toUpperCase());
    mostrarMapa();
  });

  // Volta com a última cidade pesquisada neste navegador
  try {
    const ultima = localStorage.getItem("abano-cidade");
    if (ultima) { $("srv-cidade").value = ultima; onde = { cidade: ultima }; mostrarMapa(); }
  } catch (err) {}

  // ---------- 2. Parceiros em destaque ----------
  const lista = $("srv-parceiros");
  const ICO = {
    zap: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.7-1.2.2-.6.2-1 .1-1.1l-.5-.3z"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>'
  };
  const estrelas = (n) => {
    const cheia = Math.round(n || 0);
    return `<span class="estrelas" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= cheia ? "cheia" : ""}">★</span>`).join("")}</span>`;
  };
  const zap = (n) => { let d = String(n || "").replace(/\D/g, ""); if (d.length <= 11) d = "55" + d; return "https://wa.me/" + d + "?text=" + encodeURIComponent("Olá! Encontrei vocês no Abanô."); };
  const insta = (u) => "https://www.instagram.com/" + encodeURIComponent(String(u).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "")) + "/";

  function cartao(p) {
    const foto = p.foto_url && p.foto_url.indexOf(PASTA) === 0
      ? `<img src="${esc(p.foto_url)}" alt="" loading="lazy" decoding="async">`
      : `<span>${esc(p.nome.trim().charAt(0).toUpperCase())}</span>`;
    const nota = p.total ? `<p class="parc-nota">${estrelas(p.media)}<b>${String(p.media).replace(".", ",")}</b><span>(${p.total} ${p.total === 1 ? "avaliação" : "avaliações"})</span></p>`
      : `<p class="parc-nota parc-nova">Ainda sem avaliações</p>`;
    const local = p.endereco ? `${esc(p.endereco)} · ${esc(p.cidade)}/${esc(p.estado)}` : `${esc(p.cidade)}/${esc(p.estado)}`;
    const mapa = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([p.nome, p.endereco, p.cidade, p.estado].filter(Boolean).join(", "));
    return `<article class="parc" data-id="${p.id}">
      <div class="parc-topo">
        <div class="parc-foto">${foto}</div>
        <div class="parc-id">
          <span class="parc-selo">Parceiro Abanô</span>
          <h3>${esc(p.nome)}</h3>
          ${nota}
        </div>
      </div>
      ${p.atende_24h ? '<span class="parc-24h">Atende 24 horas</span>' : ""}
      ${p.descricao ? `<p class="parc-desc">${esc(p.descricao)}</p>` : ""}
      <p class="parc-local">${ICO.mapa}<span>${local}</span></p>
      <div class="parc-acoes">
        ${p.whatsapp ? `<a class="btn parc-zap" href="${zap(p.whatsapp)}" target="_blank" rel="noopener">${ICO.zap}WhatsApp</a>` : ""}
        <a class="parc-link" href="${mapa}" target="_blank" rel="noopener" aria-label="Ver ${esc(p.nome)} no Google Maps">${ICO.mapa}</a>
        ${p.instagram ? `<a class="parc-link" href="${insta(p.instagram)}" target="_blank" rel="noopener" aria-label="Instagram de ${esc(p.nome)}">${ICO.insta}</a>` : ""}
        ${p.site ? `<a class="parc-link" href="${esc(p.site)}" target="_blank" rel="noopener nofollow" aria-label="Site de ${esc(p.nome)}">${ICO.site}</a>` : ""}
      </div>
      <button type="button" class="parc-avaliacoes" aria-expanded="false" data-avaliacoes="${p.id}">${p.total ? "Ver avaliações" : "Avaliar"}</button>
      <div class="parc-painel" id="painel-${p.id}" hidden></div>
    </article>`;
  }

  let estadoAtual = null;
  async function carregarParceiros(uf) {
    if (!sb) { lista.innerHTML = vazio(); return; }
    if (uf) estadoAtual = uf;
    const r = await sb.rpc("parceiros_destaque", { p_categoria: cat, p_estado: estadoAtual });
    if (r.error || !r.data || !r.data.length) { lista.innerHTML = vazio(); return; }
    lista.innerHTML = r.data.map(cartao).join("");
  }
  function vazio() {
    return `<div class="parc-vazio"><p><b>Ainda não há parceiros de ${esc(CAT.nome)} em destaque.</b> Enquanto isso, o mapa acima mostra o que existe perto de você.</p></div>`;
  }

  // ---------- 3. Avaliações ----------
  async function carregarConta() {
    if (!sb) return;
    const s = await sb.auth.getSession();
    sessao = s.data.session;
    if (!sessao) return;
    const r = await sb.rpc("minha_conta");
    if (!r.error) { eu = await C.completarEstado(r.data); if (eu && eu.estado && !estadoAtual) estadoAtual = eu.estado; }
  }

  async function abrirAvaliacoes(id, botao) {
    const painel = $("painel-" + id);
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    botao.setAttribute("aria-expanded", abrir ? "true" : "false");
    if (!abrir) return;
    painel.innerHTML = '<p class="parc-carregando">Carregando…</p>';
    const r = await sb.rpc("avaliacoes_do_parceiro", { p_parceiro: id });
    const itens = r.error ? [] : r.data || [];
    const minha = sessao ? itens.find((a) => a.autor === sessao.user.id) : null;
    const lista = itens.length ? `<ul class="aval-lista">${itens.map((a) => `<li>
        <p class="aval-quem"><b>${esc(a.nome)}</b> <span>@${esc(a.usuario)} · ${new Date(a.criado_em).toLocaleDateString("pt-BR")}</span></p>
        <p class="aval-nota" aria-label="Nota ${a.nota} de 5">${estrelas(a.nota)}</p>
        ${a.comentario ? `<p class="aval-txt">${esc(a.comentario)}</p>` : ""}
      </li>`).join("")}</ul>` : '<p class="aval-vazio">Ninguém avaliou ainda. Seja a primeira pessoa.</p>';
    let form;
    if (!sessao) {
      const volta = encodeURIComponent(location.pathname + location.search);
      form = `<p class="aval-entrar"><a href="entrar.html?volta=${volta}">Entre</a> ou <a href="cadastro.html?volta=${volta}">crie sua conta grátis</a> para avaliar.</p>`;
    } else {
      form = `<form class="aval-form" data-form="${id}">
        <fieldset><legend>${minha ? "Sua avaliação" : "Sua nota"}</legend>
          <div class="aval-estrelas">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="n${n}-${id}" name="nota" value="${n}"${minha && minha.nota === n ? " checked" : ""} required><label for="n${n}-${id}" title="${n} de 5">★<span class="sr">${n} de 5</span></label>`).join("")}</div>
        </fieldset>
        <label class="sr" for="c-${id}">Comentário</label>
        <textarea id="c-${id}" name="comentario" maxlength="500" rows="3" placeholder="Conte como foi o atendimento (opcional)">${minha && minha.comentario ? esc(minha.comentario) : ""}</textarea>
        <p class="aval-aviso" role="alert" hidden></p>
        <div class="aval-botoes"><button type="submit" class="btn">${minha ? "Atualizar avaliação" : "Enviar avaliação"}</button>
        ${minha ? `<button type="button" class="aval-apagar" data-apagar="${minha.id}" data-parceiro="${id}">Apagar a minha</button>` : ""}</div>
      </form>`;
    }
    painel.innerHTML = lista + form;
  }

  async function enviarAvaliacao(form) {
    const id = form.dataset.form, aviso = form.querySelector(".aval-aviso"), botao = form.querySelector("[type=submit]");
    if (!eu || !eu.aceitou) { location.href = "conta.html?volta=" + encodeURIComponent(location.pathname); return; }
    const dados = { nota: +form.nota.value, comentario: form.comentario.value.trim() || null };
    botao.disabled = true;
    const existe = await sb.from("avaliacoes_parceiros").select("id").eq("parceiro", id).eq("autor", sessao.user.id).maybeSingle();
    const r = existe.data
      ? await sb.from("avaliacoes_parceiros").update(dados).eq("id", existe.data.id)
      : await sb.from("avaliacoes_parceiros").insert(Object.assign({ parceiro: id, autor: sessao.user.id }, dados));
    botao.disabled = false;
    if (r.error) { aviso.textContent = /links/.test(r.error.message) ? "A avaliação não pode ter links." : "Não deu para salvar agora. Tente de novo."; aviso.hidden = false; return; }
    await carregarParceiros();
    const novoBotao = lista.querySelector(`[data-avaliacoes="${id}"]`);
    if (novoBotao) abrirAvaliacoes(id, novoBotao);
  }

  lista.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-avaliacoes]");
    if (b) { abrirAvaliacoes(b.dataset.avaliacoes, b); return; }
    const ap = e.target.closest("[data-apagar]");
    if (ap && confirm("Apagar a sua avaliação?")) {
      await sb.from("avaliacoes_parceiros").delete().eq("id", ap.dataset.apagar);
      await carregarParceiros();
    }
  });
  lista.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-form]"); if (!f) return;
    e.preventDefault();
    enviarAvaliacao(f);
  });

  carregarConta().then(() => carregarParceiros());
})();
