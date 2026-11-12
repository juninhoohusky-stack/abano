/* Abanô — Pet desaparecido: alertas de pet perdido ou encontrado.
   Telas: lista (com filtros), detalhe (?a=id), formulário (?novo=perdido|encontrado ou ?a=id&editar=1)
   e cartaz em imagem para compartilhar. Depende de supabase-js, lista.js e conta.js. */
(() => {
  "use strict";
  const app = document.getElementById("per-centro");
  const C = window.abanoConta;
  if (!app || !C) return;
  const sb = C.sb;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PASTA = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const fotoOk = (u) => String(u || "").indexOf(PASTA) === 0;
  const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  const ESPECIES = { cachorro: "Cachorro", gato: "Gato", ave: "Ave", pequeno_mamifero: "Pequeno mamífero", reptil: "Réptil", peixe: "Peixe", outro: "Outro" };
  const SEXOS = { macho: "Macho", femea: "Fêmea" };
  const PORTES = { pequeno: "Porte pequeno", medio: "Porte médio", grande: "Porte grande" };
  const ICO = {
    voltar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.7-1.2.2-.6.2-1 .1-1.1l-.5-.3z"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="M12 8.5v4M12 15.5h.01"/></svg>',
    coracao: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/></svg>'
  };
  let sessao = null, eu = null;

  // ---------- Utilidades ----------
  let tt;
  function toast(m) { const t = $("toast-per"); t.textContent = m; t.classList.add("ver"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("ver"), 3200); }
  function meta(titulo, desc, canon) {
    document.title = titulo;
    const d = document.querySelector('meta[name="description"]'); if (d && desc) d.setAttribute("content", desc);
    const c = document.querySelector('link[rel="canonical"]'); if (c) c.setAttribute("href", "https://abano.com.br/" + canon);
  }
  const dataBR = (d) => new Date(String(d).slice(0, 10) + "T12:00").toLocaleDateString("pt-BR");
  function haQuanto(d) {
    const dias = Math.round((Date.now() - new Date(String(d).slice(0, 10) + "T12:00")) / 864e5);
    if (dias <= 0) return "hoje";
    if (dias === 1) return "ontem";
    if (dias < 30) return "há " + dias + " dias";
    const m = Math.round(dias / 30);
    return m === 1 ? "há 1 mês" : "há " + m + " meses";
  }
  const zapNum = (n) => { let d = String(n || "").replace(/\D/g, ""); if (d.length <= 11) d = "55" + d; return d; };
  const zapFmt = (n) => { const d = String(n || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };
  const linkAlerta = (a) => location.origin + "/perdidos.html?a=" + a.id;
  function titulo(a) {
    if (a.status === "resolvido") return a.tipo === "perdido" ? `${a.nome} voltou para casa!` : "Pet devolvido ao tutor!";
    if (a.tipo === "perdido") return `${a.nome} está ${a.sexo === "femea" ? "desaparecida" : "desaparecido"}`;
    return a.nome ? `Encontrado: ${a.nome}?` : `${ESPECIES[a.especie] || "Pet"} encontrado`;
  }
  const local = (a) => `${a.bairro}, ${a.cidade} / ${a.estado}`;
  const selo = (a) => a.status === "resolvido"
    ? `<span class="per-selo ok">${ICO.coracao}Reencontrado</span>`
    : `<span class="per-selo ${a.tipo}">${a.tipo === "perdido" ? "Perdido" : "Encontrado"}</span>`;

  async function carregarEu() {
    const s = await sb.auth.getSession();
    sessao = s.data.session;
    if (!sessao) return;
    const r = await sb.rpc("minha_conta");
    if (!r.error) eu = await C.completarEstado(r.data);
  }
  function exigirConta(motivo) {
    if (sessao && eu && eu.aceitou && eu.estado) return true;
    const volta = encodeURIComponent(location.pathname + location.search);
    if (sessao) { location.href = "conta.html?volta=" + volta; return false; }
    $("per-entrar-motivo").textContent = motivo || "Para criar um alerta, entre na sua conta";
    $("per-entrar").href = "entrar.html?volta=" + volta;
    $("per-criar").href = "cadastro.html?volta=" + volta;
    $("dialogo-entrar-per").showModal();
    return false;
  }
  function nav(url) { history.pushState(null, "", url); rota(); window.scrollTo(0, 0); }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-nav]");
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); nav(a.getAttribute("href"));
  });
  window.addEventListener("popstate", rota);

  // ---------- Lista ----------
  let filtro = { uf: "", tipo: "", status: "ativo", escolheu: false };
  function cartao(a) {
    const quando = a.status === "resolvido" ? "Reencontrado " + haQuanto(a.resolvido_em || a.criado_em) : (a.tipo === "perdido" ? "Sumiu " : "Encontrado ") + haQuanto(a.quando);
    const info = [ESPECIES[a.especie], a.raca, SEXOS[a.sexo]].filter(Boolean).join(" · ");
    return `<a class="per-card ${a.status === "resolvido" ? "resolvido" : a.tipo}" href="perdidos.html?a=${a.id}" data-nav>
      <span class="per-card-foto">${fotoOk(a.foto_url) ? `<img src="${esc(a.foto_url)}" alt="" loading="lazy" decoding="async">` : ""}${selo(a)}</span>
      <span class="per-card-txt">
        <b>${esc(a.nome || (ESPECIES[a.especie] || "Pet") + (a.tipo === "encontrado" ? " encontrado" : ""))}</b>
        <small>${esc(info)}</small>
        <span class="per-card-local">${ICO.pin}${esc(local(a))}</span>
        <span class="per-card-quando">${ICO.cal}${esc(quando)}</span>
      </span>
    </a>`;
  }
  async function telaLista() {
    meta("Pet desaparecido: perdidos e encontrados | Abanô", "Alertas de cães, gatos e outros pets perdidos e encontrados perto de você. Crie um alerta grátis, com cartaz pronto para compartilhar.", "perdidos.html");
    $("per-hero").hidden = false;
    if (!filtro.escolheu && eu && eu.estado) filtro.uf = eu.estado;
    app.innerHTML = `
      <section class="per-lista" aria-labelledby="per-lista-t">
        <div class="per-cab">
          <h2 id="per-lista-t">Alertas ${filtro.uf ? "em " + esc(filtro.uf) : "no Brasil"}</h2>
          <form class="per-filtros" id="per-filtros" role="search" aria-label="Filtrar alertas">
            <label class="sr" for="per-uf">Estado</label>
            <select id="per-uf"><option value="">Todos os estados</option>${UFS.map((u) => `<option${u === filtro.uf ? " selected" : ""}>${u}</option>`).join("")}</select>
            <div class="per-chips" role="group" aria-label="Tipo de alerta">
              ${[["", "ativo", "Todos"], ["perdido", "ativo", "Perdidos"], ["encontrado", "ativo", "Encontrados"], ["", "resolvido", "Reencontrados"]].map(([t, s, r]) =>
                `<button type="button" data-tipo="${t}" data-status="${s}" aria-pressed="${filtro.tipo === t && filtro.status === s}">${r}</button>`).join("")}
            </div>
          </form>
        </div>
        <div class="per-grade" id="per-grade"><p class="per-carregando">Carregando…</p></div>
      </section>`;
    $("per-uf").addEventListener("change", (e) => { filtro.uf = e.target.value; filtro.escolheu = true; telaLista(); });
    app.querySelectorAll("[data-tipo]").forEach((b) => b.addEventListener("click", () => { filtro.tipo = b.dataset.tipo; filtro.status = b.dataset.status; telaLista(); }));
    const r = await sb.rpc("alertas_lista", { p_estado: filtro.uf || null, p_tipo: filtro.tipo || null, p_status: filtro.status });
    const g = $("per-grade");
    if (r.error || !r.data || !r.data.length) {
      const reenc = filtro.status === "resolvido";
      g.innerHTML = `<div class="per-vazio"><p><b>${reenc ? "Ainda não há reencontros por aqui." : "Nenhum alerta " + (filtro.uf ? "em " + esc(filtro.uf) : "no momento") + "."}</b> ${reenc ? "Quando um pet voltar para casa, a história aparece aqui." : "Que bom! Se o seu pet sumir ou você encontrar um pet na rua, crie um alerta."}</p>
        ${filtro.uf ? '<button type="button" class="btn btn-sec" id="per-todos">Ver todos os estados</button>' : ""}</div>`;
      const t = $("per-todos"); if (t) t.addEventListener("click", () => { filtro.uf = ""; filtro.escolheu = true; telaLista(); });
      return;
    }
    g.innerHTML = r.data.map(cartao).join("");
  }

  // ---------- Detalhe ----------
  async function telaDetalhe(id) {
    $("per-hero").hidden = true;
    app.innerHTML = '<p class="per-carregando">Carregando…</p>';
    const r = await sb.rpc("alerta_detalhe", { p_id: id });
    const a = r.data && r.data[0];
    if (r.error || !a) {
      app.innerHTML = `<div class="per-vazio"><p><b>Alerta não encontrado.</b> Ele pode ter sido apagado pelo autor.</p><a class="btn" href="perdidos.html" data-nav>Ver todos os alertas</a></div>`;
      return;
    }
    const meu = sessao && sessao.user.id === a.autor;
    meta(titulo(a) + " em " + a.cidade + " | Abanô", a.descricao.slice(0, 150), "perdidos.html?a=" + a.id);
    const info = [ESPECIES[a.especie], a.raca, SEXOS[a.sexo], PORTES[a.porte]].filter(Boolean);
    const msgZap = encodeURIComponent((a.tipo === "perdido" ? `Olá! Vi o alerta de ${a.nome} no Abanô e tenho uma informação: ` : `Olá! Vi no Abanô o pet que você encontrou em ${a.bairro}. Acho que pode ser meu: `));
    const compartilhar = encodeURIComponent(`${a.status === "resolvido" ? "" : "🚨 "}${titulo(a)} em ${local(a)}. ${a.tipo === "perdido" && a.status !== "resolvido" ? "Se você viu, ajude! " : ""}Veja no Abanô: ${linkAlerta(a)}`);
    const mapa = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([a.referencia, a.bairro, a.cidade, a.estado].filter(Boolean).join(", "));
    app.innerHTML = `
      <a class="per-voltar" href="perdidos.html" data-nav>${ICO.voltar}<span>Todos os alertas</span></a>
      <article class="per-det ${a.status === "resolvido" ? "resolvido" : a.tipo}">
        <div class="per-det-foto">${fotoOk(a.foto_url) ? `<img src="${esc(a.foto_url)}" alt="Foto de ${esc(a.nome || "pet")}">` : ""}${selo(a)}</div>
        <div class="per-det-info">
          <h1>${esc(titulo(a))}</h1>
          <p class="per-det-tags">${info.map((i) => `<span>${esc(i)}</span>`).join("")}</p>
          <ul class="per-det-dados">
            <li>${ICO.pin}<span><b>${a.tipo === "perdido" ? "Visto por último em" : "Encontrado em"}</b> ${esc(local(a))}${a.referencia ? `<br><small>${esc(a.referencia)}</small>` : ""}<br><a href="${mapa}" target="_blank" rel="noopener">Ver a região no mapa</a></span></li>
            <li>${ICO.cal}<span><b>${a.tipo === "perdido" ? "Sumiu em" : "Encontrado em"}</b> ${dataBR(a.quando)} (${haQuanto(a.quando)})</span></li>
          </ul>
          <p class="per-det-desc">${esc(a.descricao)}</p>
          ${a.status === "resolvido" ? `<p class="per-feliz">${ICO.coracao}<span>Final feliz! Obrigado a todos que compartilharam.</span></p>` : `
          <div class="per-contato">
            <h2>${a.tipo === "perdido" ? `Viu ${a.sexo === "femea" ? "a" : "o"} ${esc(a.nome)}?` : "É o seu pet?"}</h2>
            ${a.whatsapp ? `<a class="btn per-zap" href="https://wa.me/${zapNum(a.whatsapp)}?text=${msgZap}" target="_blank" rel="noopener">${ICO.zap}Chamar no WhatsApp</a>` : ""}
            <a class="btn btn-sec" href="comunidade/?u=${encodeURIComponent(a.autor_usuario)}">Ver o perfil de ${esc(String(a.autor_nome || "").split(" ")[0] || "quem publicou")}</a>
          </div>`}
          <div class="per-partilha">
            <a class="per-acao" href="https://wa.me/?text=${compartilhar}" target="_blank" rel="noopener">${ICO.zap}Compartilhar</a>
            <button type="button" class="per-acao" id="per-cartaz">${ICO.baixar}${a.status === "resolvido" ? "Card de encontrado" : a.tipo === "perdido" ? "Card de desaparecido" : "Card de encontrado na rua"}</button>
            <button type="button" class="per-acao" id="per-copiar">${ICO.link}Copiar link</button>
          </div>
          ${meu ? `<div class="per-dono">
            ${a.status === "ativo" ? `<button type="button" class="btn" id="per-resolver">${a.tipo === "perdido" ? "Meu pet voltou para casa!" : "Já devolvi ao tutor"}</button>` : a.status === "resolvido" ? '<button type="button" class="btn btn-sec" id="per-reabrir">Reabrir o alerta</button>' : '<p class="per-aviso">Este alerta foi tirado do ar pela moderação.</p>'}
            <a class="btn btn-sec" href="perdidos.html?a=${a.id}&editar=1" data-nav>Editar</a>
            <button type="button" class="per-apagar" id="per-apagar">Apagar alerta</button>
          </div>` : (sessao ? '<button type="button" class="per-denunciar" id="per-denunciar">Denunciar este alerta</button>' : "")}
          <aside class="per-seguranca">${ICO.escudo}<p><b>Cuidado com golpes.</b> Nunca pague nada antes de ver o pet pessoalmente e de confirmar que é ele. Combine o encontro em um lugar movimentado.</p></aside>
        </div>
      </article>`;
    $("per-cartaz").addEventListener("click", (e) => baixarCartaz(a, e.currentTarget));
    $("per-copiar").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(linkAlerta(a)); toast("Link copiado!"); } catch (err) { prompt("Copie o link:", linkAlerta(a)); }
    });
    if (meu) {
      const mudar = async (status, msg) => {
        const u = await sb.from("alertas_pets").update({ status }).eq("id", a.id);
        if (u.error) { toast(C.traduzir(u.error)); return; }
        toast(msg); telaDetalhe(a.id);
      };
      const res = $("per-resolver"); if (res) res.addEventListener("click", () => mudar("resolvido", "Que notícia boa! Baixe o card de encontrado e conte para todo mundo."));
      const rea = $("per-reabrir"); if (rea) rea.addEventListener("click", () => mudar("ativo", "Alerta reaberto."));
      $("per-apagar").addEventListener("click", async () => {
        if (!confirm("Apagar este alerta? Ele some do Abanô e não dá para desfazer. Se o pet voltou, prefira marcar como resolvido.")) return;
        const d = await sb.from("alertas_pets").delete().eq("id", a.id);
        if (d.error) { toast(C.traduzir(d.error)); return; }
        toast("Alerta apagado."); nav("perdidos.html");
      });
    }
    const den = $("per-denunciar");
    if (den) den.addEventListener("click", async () => {
      if (!exigirConta("Para denunciar, entre na sua conta")) return;
      const detalhe = prompt("O que há de errado com este alerta? (golpe, pedido de dinheiro, conteúdo falso…)");
      if (detalhe === null) return;
      const r2 = await sb.from("denuncias").insert({ denunciante: eu.id, alvo_tipo: "perfil", perfil: a.autor, motivo: "outro", detalhe: ("Alerta de pet " + a.tipo + " (" + (a.nome || a.especie) + "): " + detalhe).slice(0, 500) });
      if (r2.error && r2.error.code !== "23505") { toast(C.traduzir(r2.error)); return; }
      toast("Denúncia enviada. Obrigado!");
    });
  }

  // ---------- Formulário ----------
  async function telaForm(tipo, id) {
    $("per-hero").hidden = true;
    if (!exigirConta(tipo === "encontrado" ? "Para avisar que encontrou um pet, entre na sua conta" : "Para criar o alerta do seu pet, entre na sua conta")) {
      if (!sessao) { nav("perdidos.html"); }
      return;
    }
    let a = null;
    if (id) {
      const r = await sb.from("alertas_pets").select("*").eq("id", id).maybeSingle();
      a = r.data;
      if (!a || a.autor !== eu.id) { nav("perdidos.html?a=" + id); return; }
      tipo = a.tipo;
    }
    const meusPets = tipo === "perdido" ? ((await sb.from("pets").select("id,nome,especie,raca,sexo,foto_url").eq("dono", eu.id).order("criado_em")).data || []) : [];
    const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const v = (k, pad) => esc(a ? (a[k] == null ? "" : a[k]) : (pad == null ? "" : pad));
    const op = (mapa, atual, vazio) => (vazio ? `<option value="">${vazio}</option>` : "") + Object.keys(mapa).map((k) => `<option value="${k}"${k === atual ? " selected" : ""}>${esc(mapa[k])}</option>`).join("");
    app.innerHTML = `
      <a class="per-voltar" href="${a ? "perdidos.html?a=" + a.id : "perdidos.html"}" data-nav>${ICO.voltar}<span>Voltar</span></a>
      <form class="per-form" id="per-form" novalidate>
        <h1>${a ? "Editar alerta" : tipo === "perdido" ? "Meu pet sumiu" : "Encontrei um pet"}</h1>
        <p class="per-form-sub">${tipo === "perdido" ? "Quanto antes o alerta sair, maiores as chances. Depois de publicar, baixe o cartaz e compartilhe nos grupos do seu bairro." : "Obrigado por ajudar! Publique a foto e onde o pet foi encontrado para o tutor achar."}</p>
        ${meusPets.length ? `<label class="rot" for="f-pet">Qual dos seus pets?</label>
          <select id="f-pet" name="pet"><option value="">Outro pet (preencher abaixo)</option>${meusPets.map((p) => `<option value="${p.id}"${a && a.pet === p.id ? " selected" : ""}>${esc(p.nome)}</option>`).join("")}</select>` : ""}
        <div class="per-foto-linha">
          <span class="per-previa" id="f-previa">${a && fotoOk(a.foto_url) ? `<img src="${esc(a.foto_url)}" alt="">` : "Foto"}</span>
          <div><label class="btn btn-sec per-arquivo">Escolher foto<input type="file" id="f-foto" accept="image/jpeg,image/png,image/webp,image/heic"></label>
          <p class="per-dica">Use uma foto nítida, de corpo inteiro, em que dê para ver a cor e os sinais.</p></div>
        </div>
        <div class="duas">
          <div><label class="rot" for="f-nome">${tipo === "perdido" ? "Nome do pet" : 'Nome na coleira <span class="opcional">(se tiver)</span>'}</label>
            <input id="f-nome" name="nome" maxlength="40" value="${v("nome")}"${tipo === "perdido" ? " required" : ""}></div>
          <div><label class="rot" for="f-especie">Espécie</label><select id="f-especie" name="especie" required>${op(ESPECIES, a ? a.especie : "", "Escolha")}</select></div>
          <div><label class="rot" for="f-raca">Raça <span class="opcional">(opcional)</span></label><input id="f-raca" name="raca" maxlength="60" value="${v("raca")}" placeholder="Ex.: Husky, SRD"></div>
          <div><label class="rot" for="f-sexo">Sexo <span class="opcional">(opcional)</span></label><select id="f-sexo" name="sexo">${op(SEXOS, a ? a.sexo : "", "Não sei / não informar")}</select></div>
          <div><label class="rot" for="f-porte">Porte <span class="opcional">(opcional)</span></label><select id="f-porte" name="porte">${op({ pequeno: "Pequeno", medio: "Médio", grande: "Grande" }, a ? a.porte : "", "Não informar")}</select></div>
          <div><label class="rot" for="f-quando">${tipo === "perdido" ? "Quando sumiu?" : "Quando encontrou?"}</label><input id="f-quando" name="quando" type="date" max="${hoje}" value="${v("quando", hoje)}" required></div>
        </div>
        <label class="rot" for="f-desc">Como ele é?</label>
        <textarea id="f-desc" name="descricao" maxlength="700" rows="4" required placeholder="Cor, coleira, manchas, cicatrizes, se é medroso ou se atende pelo nome…">${v("descricao")}</textarea>
        <h2 class="per-form-h2">${tipo === "perdido" ? "Onde foi visto pela última vez?" : "Onde encontrou?"}</h2>
        <div class="duas">
          <div><label class="rot" for="f-bairro">Bairro</label><input id="f-bairro" name="bairro" maxlength="80" value="${v("bairro")}" required></div>
          <div><label class="rot" for="f-cidade">Cidade</label><input id="f-cidade" name="cidade" maxlength="80" value="${v("cidade", eu.cidade || "")}" required></div>
          <div><label class="rot" for="f-estado">Estado</label><select id="f-estado" name="estado" required>${UFS.map((u) => `<option${u === (a ? a.estado : eu.estado) ? " selected" : ""}>${u}</option>`).join("")}</select></div>
          <div><label class="rot" for="f-ref">Ponto de referência <span class="opcional">(opcional)</span></label><input id="f-ref" name="referencia" maxlength="160" value="${v("referencia")}" placeholder="Ex.: perto da praça da igreja"></div>
        </div>
        <h2 class="per-form-h2">Como falar com você</h2>
        <label class="per-check"><input type="checkbox" id="f-mostrar-zap"${a && a.whatsapp ? " checked" : ""}><span>Mostrar meu WhatsApp no alerta e no cartaz, para quem viu o pet me chamar na hora</span></label>
        <div id="f-zap-linha"${a && a.whatsapp ? "" : " hidden"}><label class="rot" for="f-zap">WhatsApp com DDD</label><input id="f-zap" name="whatsapp" inputmode="tel" maxlength="20" value="${v("whatsapp")}" placeholder="(21) 99999-9999"></div>
        <p class="per-dica">Sem WhatsApp, as pessoas falam com você pelo seu perfil na Comunidade. O alerta fica público, com a foto, o bairro e a cidade.</p>
        <p class="aviso-conta" id="f-aviso" role="alert" hidden></p>
        <button type="submit" class="btn btn-grande">${a ? "Salvar alterações" : "Publicar alerta"}</button>
      </form>`;
    const f = $("per-form");
    let fotoNova = null, fotoDoPet = null;
    const previa = (url) => { $("f-previa").innerHTML = url ? `<img src="${esc(url)}" alt="">` : "Foto"; };
    $("f-foto").addEventListener("change", (e) => { fotoNova = e.target.files[0] || null; if (fotoNova) previa(URL.createObjectURL(fotoNova)); });
    $("f-mostrar-zap").addEventListener("change", (e) => { $("f-zap-linha").hidden = !e.target.checked; if (e.target.checked) $("f-zap").focus(); });
    const fp = $("f-pet");
    if (fp) fp.addEventListener("change", () => {
      const p = meusPets.find((x) => x.id === fp.value); if (!p) return;
      f.nome.value = p.nome; f.especie.value = p.especie; f.raca.value = p.raca || ""; f.sexo.value = p.sexo || "";
      fotoDoPet = fotoOk(p.foto_url) && p.foto_url.indexOf(PASTA + eu.id + "/") === 0 ? p.foto_url : null;
      if (!fotoNova && fotoDoPet) previa(fotoDoPet);
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const aviso = $("f-aviso"), botao = f.querySelector("[type=submit]");
      const erro = (m, campo) => { aviso.textContent = m; aviso.hidden = false; if (campo) campo.focus(); botao.disabled = false; botao.textContent = a ? "Salvar alterações" : "Publicar alerta"; };
      aviso.hidden = true;
      const petEscolhido = fp ? meusPets.find((x) => x.id === fp.value) : null;
      const fotoAtual = fotoDoPet || (a ? a.foto_url : null);
      if (tipo === "perdido" && !f.nome.value.trim()) return erro("Digite o nome do pet.", f.nome);
      if (!f.especie.value) return erro("Escolha a espécie.", f.especie);
      if (f.descricao.value.trim().length < 10) return erro("Descreva o pet com pelo menos algumas palavras: cor, coleira, sinais.", f.descricao);
      if (f.bairro.value.trim().length < 2) return erro("Digite o bairro.", f.bairro);
      if (f.cidade.value.trim().length < 2) return erro("Digite a cidade.", f.cidade);
      if (!f.quando.value) return erro("Escolha a data.", f.quando);
      const zap = $("f-mostrar-zap").checked ? f.whatsapp.value.replace(/\D/g, "") : "";
      if ($("f-mostrar-zap").checked && (zap.length < 10 || zap.length > 13)) return erro("Digite o WhatsApp com DDD, só números.", f.whatsapp);
      if (!fotoNova && !fotoAtual) return erro("Escolha uma foto do pet. Ela é o que mais ajuda a reconhecer.", $("f-foto"));
      botao.disabled = true; botao.textContent = "Publicando…";
      let url = fotoAtual;
      try { if (fotoNova) url = await C.enviarFoto(eu.id, "alerta", fotoNova); }
      catch (err) { return erro(err.message || "Não deu para enviar a foto."); }
      const dados = {
        tipo, pet: petEscolhido ? petEscolhido.id : null, nome: f.nome.value.trim() || null, especie: f.especie.value,
        raca: f.raca.value.trim() || null, sexo: f.sexo.value || null, porte: f.porte.value || null,
        descricao: f.descricao.value.trim(), foto_url: url, bairro: f.bairro.value.trim(), cidade: f.cidade.value.trim(),
        estado: f.estado.value, referencia: f.referencia.value.trim() || null, quando: f.quando.value, whatsapp: zap || null
      };
      const r = a ? await sb.from("alertas_pets").update(dados).eq("id", a.id).select("id").single()
                  : await sb.from("alertas_pets").insert(Object.assign({ autor: eu.id }, dados)).select("id").single();
      if (r.error) {
        if (fotoNova && url) C.apagarFoto(url);
        return erro(/P0001/.test(r.error.code || "") ? r.error.message : C.traduzir(r.error));
      }
      if (a && fotoNova && a.foto_url && a.foto_url !== url && !meusPets.some((p) => p.foto_url === a.foto_url)) C.apagarFoto(a.foto_url);
      toast(a ? "Alerta atualizado." : "Alerta publicado! Agora baixe o cartaz e compartilhe.");
      nav("perdidos.html?a=" + r.data.id);
    });
  }

  // ---------- Cartaz (imagem 1080 x 1350 para WhatsApp e Instagram) ----------
  function carregarImg(src) {
    return new Promise((ok, falha) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = falha; i.src = src; });
  }
  function quebrar(ctx, texto, larg, max) {
    const palavras = String(texto).split(/\s+/), linhas = [];
    let l = "";
    for (const p of palavras) {
      const t = l ? l + " " + p : p;
      if (ctx.measureText(t).width > larg && l) { linhas.push(l); l = p; if (linhas.length === max) break; } else l = t;
    }
    if (linhas.length < max && l) linhas.push(l);
    if (linhas.length === max && palavras.join(" ").length > linhas.join(" ").length) {
      let u = linhas[max - 1];
      while (ctx.measureText(u + "…").width > larg && u.length) u = u.slice(0, -1);
      linhas[max - 1] = u.replace(/\s+\S*$/, "") + "…";
    }
    return linhas;
  }
  function retRed(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  async function baixarCartaz(a, botao) {
    const textoBotao = botao.innerHTML;
    botao.disabled = true; botao.textContent = "Gerando…";
    try {
      if (document.fonts) await document.fonts.ready;
      const W = 1080, H = 1350, c = document.createElement("canvas");
      c.width = W; c.height = H;
      const ctx = c.getContext("2d");
      const perdido = a.tipo === "perdido", ok = a.status === "resolvido";
      const cor1 = ok ? "#1F9D63" : perdido ? "#E5484D" : "#FF8A1E", cor2 = ok ? "#0E7A4B" : perdido ? "#D10F5E" : "#E8641B";
      ctx.fillStyle = "#FFF7F5"; ctx.fillRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, W, 220); g.addColorStop(0, cor1); g.addColorStop(1, cor2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 190);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "900 92px Nunito, Arial, sans-serif";
      ctx.fillText(ok ? "ENCONTRADO! 🎉" : perdido ? "PROCURA-SE" : "PET ENCONTRADO", W / 2, 100);
      // Foto
      const fx = 60, fy = 225, fw = W - 120, fh = 590;
      ctx.save(); retRed(ctx, fx, fy, fw, fh, 40); ctx.clip();
      ctx.fillStyle = "#F3E3E8"; ctx.fillRect(fx, fy, fw, fh);
      if (fotoOk(a.foto_url)) {
        const img = await carregarImg(a.foto_url);
        const esc2 = Math.max(fw / img.width, fh / img.height), iw = img.width * esc2, ih = img.height * esc2;
        ctx.drawImage(img, fx + (fw - iw) / 2, fy + (fh - ih) / 2, iw, ih);
      }
      ctx.restore();
      // Encontrado: faixa sobre a foto com o crédito do Abanô
      if (ok) {
        ctx.fillStyle = "rgba(14,122,75,.92)"; retRed(ctx, fx + 30, fy + fh - 96, fw - 60, 70, 35); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "900 36px Nunito, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("💛 Encontrado com a ajuda da comunidade Abanô", W / 2, fy + fh - 60);
      }
      // Nome e dados
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#2B1622";
      ctx.font = "900 80px Nunito, Arial, sans-serif";
      const nome = a.nome || ESPECIES[a.especie] || "Pet";
      ctx.fillText(quebrar(ctx, nome, W - 120, 1)[0], 60, 900);
      ctx.font = "700 34px Nunito, Arial, sans-serif"; ctx.fillStyle = "#6B5462";
      ctx.fillText([ESPECIES[a.especie], a.raca, SEXOS[a.sexo], PORTES[a.porte]].filter(Boolean).join(" · "), 60, 950);
      ctx.font = "800 36px Nunito, Arial, sans-serif"; ctx.fillStyle = cor2;
      const onde = (ok ? (perdido ? "Sumiu em: " : "Encontrado em: ") : perdido ? "Visto por último: " : "Encontrado em: ") + local(a) + " · " + dataBR(a.quando);
      const linhasOnde = quebrar(ctx, onde, W - 120, 2);
      linhasOnde.forEach((l, i) => ctx.fillText(l, 60, 1008 + i * 44));
      ctx.font = "600 32px Nunito, Arial, sans-serif"; ctx.fillStyle = "#2B1622";
      quebrar(ctx, a.descricao, W - 120, linhasOnde.length > 1 ? 1 : 2).forEach((l, i) => ctx.fillText(l, 60, 1008 + linhasOnde.length * 44 + 10 + i * 40));
      // Contato
      ctx.textAlign = "center"; ctx.fillStyle = cor2; ctx.font = "900 42px Nunito, Arial, sans-serif";
      const contato = ok ? "Obrigado a todos que compartilharam! 💛" : a.whatsapp ? "Viu? Chame: " + zapFmt(a.whatsapp) : "Viu? Fale com @" + a.autor_usuario + " no Abanô";
      ctx.fillText(quebrar(ctx, contato, W - 120, 1)[0], W / 2, H - 150);
      // Rodapé com a marca do Abanô
      const gm = ctx.createLinearGradient(0, H - 110, W, H); gm.addColorStop(0, "#D10F5E"); gm.addColorStop(1, "#FF8A1E");
      ctx.fillStyle = gm; ctx.fillRect(0, H - 110, W, 110);
      if (window.abanoMarca) await window.abanoMarca.desenhar(ctx, 56, H - 87, 64, { claro: true });
      ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.font = "800 30px Nunito, Arial, sans-serif";
      ctx.fillText(ok ? "Pets reencontrados em abano.com.br" : "Mais alertas em abano.com.br", W - 56, H - 55);
      const blob = await new Promise((ok2) => c.toBlob(ok2, "image/png"));
      const nomeArq = (ok ? "encontrado-" : "alerta-") + (a.nome || a.especie).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-") + ".png";
      const arquivo = new File([blob], nomeArq, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        try { await navigator.share({ files: [arquivo], title: titulo(a), text: titulo(a) + " — " + linkAlerta(a) }); return; } catch (err) { if (err && err.name === "AbortError") return; }
      }
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = nomeArq;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      toast(a.status === "resolvido" ? "Card baixado! Poste no Instagram e conte a boa notícia." : "Card baixado! Poste no Instagram e nos grupos do bairro.");
    } catch (err) {
      toast("Não deu para gerar o cartaz agora. Tente de novo.");
    } finally {
      botao.disabled = false; botao.innerHTML = textoBotao;
    }
  }

  // ---------- Rotas ----------
  function rota() {
    const p = new URLSearchParams(location.search);
    if (p.get("a") && p.get("editar")) return telaForm(null, p.get("a"));
    if (p.get("a")) return telaDetalhe(p.get("a"));
    if (p.get("novo") === "perdido" || p.get("novo") === "encontrado") return telaForm(p.get("novo"));
    return telaLista();
  }
  document.querySelectorAll("[data-novo]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    if (!exigirConta(b.dataset.novo === "encontrado" ? "Para avisar que encontrou um pet, entre na sua conta" : "Para criar o alerta do seu pet, entre na sua conta")) return;
    nav("perdidos.html?novo=" + b.dataset.novo);
  }));
  carregarEu().then(rota);
})();
