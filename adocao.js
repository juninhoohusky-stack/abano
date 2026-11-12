/* Abanô — Página Adoção: lista com filtros, página do pet, "Quero adotar"
   (questionário padrão) e "Meus pedidos de adoção".
   Depende de supabase-js, lista.js, conta.js e adocao-comum.js. */
(() => {
  "use strict";
  const C = window.abanoConta, A = window.ABANO_ADOCAO;
  const centro = document.getElementById("ado-centro");
  if (!C || !A || !centro) return;
  const sb = C.sb;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PASTA = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const fotoOk = (u) => String(u || "").indexOf(PASTA) === 0;
  const ORG = "org:organizacoes!pets_adocao_org_fkey(id,nome,tipo,cidade,estado,instagram,site,descricao)";
  const SVG_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const SVG_VOLTAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  let eu = null, sessao = null;

  let tt;
  function toast(m) { const t = $("toast-ado"); t.textContent = m; t.classList.add("ver"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("ver"), 3200); }
  function aviso(el, msg) { el.textContent = msg || ""; el.hidden = !msg; }
  function meta(titulo, desc, canon) {
    document.title = titulo;
    const d = document.querySelector('meta[name="description"]'); if (d && desc) d.setAttribute("content", desc);
    const c = document.querySelector('link[rel="canonical"]'); if (c) c.setAttribute("href", "https://abano.com.br/" + canon);
  }
  const selo = (o) => o ? `<span class="verificada">${SVG_OK}${o.tipo === "ong" ? "ONG verificada" : "Protetor verificado"}</span>` : "";
  const voltar = (destino) => `<a class="voltar-ado" href="${destino}" data-voltar>${SVG_VOLTAR}<span>Voltar</span></a>`;
  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-voltar]"); if (!v) return;
    let daqui = false;
    try { const r = new URL(document.referrer); daqui = r.origin === location.origin && /adocao/.test(r.pathname); } catch (err) {}
    if (daqui && history.length > 1) { e.preventDefault(); history.back(); }
  });

  // ---------- Conta (opcional para ver; obrigatória para pedir) ----------
  async function carregarEu() {
    const s = await sb.auth.getSession();
    sessao = s.data.session;
    if (!sessao) return;
    const r = await sb.rpc("minha_conta");
    if (!r.error) eu = await C.completarEstado(r.data);
  }
  function exigirConta() {
    if (sessao && eu && eu.aceitou && eu.estado) return true;
    const volta = encodeURIComponent(location.pathname + location.search);
    if (sessao) { location.href = "conta.html?volta=" + volta; return false; }
    $("ado-entrar").href = "entrar.html?volta=" + volta;
    $("ado-criar").href = "cadastro.html?volta=" + volta;
    $("dialogo-entrar-ado").showModal();
    return false;
  }

  // ---------- Lista com filtros ----------
  function filtrosHTML() {
    const op = (mapa, vazio, atual) => `<option value="">${vazio}</option>` + Object.keys(mapa).map((k) => `<option value="${k}"${k === atual ? " selected" : ""}>${esc(mapa[k])}</option>`).join("");
    return `<form class="filtros" id="filtros" role="search" aria-label="Filtrar pets">
      <label class="sr" for="f-especie">Espécie</label><select id="f-especie" name="especie">${op(A.ESPECIES, "Todas as espécies", q.get("especie"))}</select>
      <label class="sr" for="f-porte">Porte</label><select id="f-porte" name="porte">${op({ pequeno: "Pequeno", medio: "Médio", grande: "Grande" }, "Qualquer porte", q.get("porte"))}</select>
      <label class="sr" for="f-idade">Idade</label><select id="f-idade" name="idade">${op(A.IDADES, "Qualquer idade", q.get("idade"))}</select>
      <label class="sr" for="f-sexo">Sexo</label><select id="f-sexo" name="sexo">${op(A.SEXOS, "Macho ou fêmea", q.get("sexo"))}</select>
      <label class="sr" for="f-estado">Estado</label><select id="f-estado" name="estado"><option value="">Todos os estados</option>${A.UFS.map((u) => `<option${u === q.get("estado") ? " selected" : ""}>${u}</option>`).join("")}</select>
      <button type="button" class="limpar" id="f-limpar">Limpar filtros</button>
    </form>`;
  }
  function cartao(p) {
    const o = p.org || {};
    return `<a class="card-ado" href="adocao.html?pet=${encodeURIComponent(p.id)}">
      <div class="foto">${fotoOk(p.fotos[0]) ? `<img src="${esc(p.fotos[0])}" alt="Foto de ${esc(p.nome)}" loading="lazy" decoding="async">` : ""}
        ${p.status === "em_processo" ? '<span class="selo-status em_processo">Em processo de adoção</span>' : ""}</div>
      <div class="corpo"><h3>${esc(p.nome)}</h3>
        <p class="meta">${esc([A.ESPECIES[p.especie], A.SEXOS[p.sexo], A.IDADES[p.idade], p.porte ? A.PORTES[p.porte] : ""].filter(Boolean).join(" · "))}</p>
        <p class="meta">${esc(p.cidade)} / ${esc(p.estado)}</p>
        <span class="org">${esc(o.nome || "")}</span></div></a>`;
  }
  async function telaLista() {
    meta("Adoção de cães, gatos e outros pets | Abanô", "Adote um cão, gato ou outro pet de ONGs e protetores verificados pelo Abanô. Veja fotos, saúde e temperamento e peça para adotar.", "adocao.html");
    centro.innerHTML = `<header class="ado-topo"><div><span class="eyebrow">Adoção</span><h1>Adote um amigo</h1></div>
      <p>Cães, gatos e outros bichos de ONGs e protetores verificados pelo Abanô, esperando por uma família.${sessao ? ' <a href="adocao.html?v=pedidos">Ver meus pedidos</a>' : ""}</p></header>
      ${filtrosHTML()}<div id="grade" class="grade-ado"><p class="carregando">Carregando os pets…</p></div>`;
    const f = $("filtros");
    f.addEventListener("change", () => {
      const p = new URLSearchParams();
      ["especie", "porte", "idade", "sexo", "estado"].forEach((k) => { if (f[k].value) p.set(k, f[k].value); });
      history.replaceState(null, "", "adocao.html" + (p.toString() ? "?" + p : ""));
      ["especie", "porte", "idade", "sexo", "estado"].forEach((k) => q.delete(k));
      p.forEach((v, k) => q.set(k, v));
      buscar();
    });
    $("f-limpar").addEventListener("click", () => { f.reset(); [...f.elements].forEach((el) => { if (el.tagName === "SELECT") el.value = ""; }); f.dispatchEvent(new Event("change")); });
    buscar();
  }
  async function buscar() {
    const g = $("grade");
    g.innerHTML = '<p class="carregando">Carregando os pets…</p>';
    let s = sb.from("pets_adocao").select("*, " + ORG).in("status", ["disponivel", "em_processo"]).eq("removido", false)
      .gt("expira_em", new Date().toISOString()).order("criado_em", { ascending: false }).limit(120);
    ["especie", "porte", "idade", "sexo", "estado"].forEach((k) => { if (q.get(k)) s = s.eq(k, q.get(k)); });
    const r = await s;
    if (r.error) { g.innerHTML = '<p class="carregando">Não deu para carregar os pets agora. Tente de novo em instantes.</p>'; return; }
    const lista = (r.data || []).filter((p) => p.org);
    const filtrando = ["especie", "porte", "idade", "sexo", "estado"].some((k) => q.get(k));
    g.innerHTML = lista.length ? lista.map(cartao).join("")
      : `<div class="vazio-ado" style="grid-column:1/-1"><h3>${filtrando ? "Nenhum pet com esses filtros" : "Os primeiros pets chegam em breve"}</h3>
         <p>${filtrando ? "Tente outro estado ou tire algum filtro." : "Estamos cadastrando ONGs e protetores verificados. Volte logo, ou avise uma ONG que você conhece."}</p></div>`;
  }

  // ---------- Página do pet ----------
  async function telaPet(id) {
    centro.innerHTML = '<p class="carregando">Carregando…</p>';
    const r = await sb.from("pets_adocao").select("*, " + ORG).eq("id", id).maybeSingle();
    const p = r.data;
    if (r.error || !p || !p.org) {
      meta("Pet não encontrado | Abanô", null, "adocao.html");
      centro.innerHTML = voltar("adocao.html") + '<div class="vazio-ado"><h3>Este anúncio não está mais no ar</h3><p>Ele pode ter sido adotado ou removido. Veja outros pets esperando por uma família.</p><a class="btn" href="adocao.html">Ver pets para adoção</a></div>';
      return;
    }
    const o = p.org;
    const descr = [A.ESPECIES[p.especie], A.SEXOS[p.sexo], A.IDADES[p.idade], p.porte ? A.PORTES[p.porte] : ""].filter(Boolean).join(" · ");
    meta(p.nome + " para adoção em " + p.cidade + " | Abanô", (p.nome + ": " + descr + ", em " + p.cidade + "/" + p.estado + ". " + (p.descricao || "")).slice(0, 155), "adocao.html?pet=" + encodeURIComponent(p.id));
    const vencido = new Date(p.expira_em) < new Date();
    const saude = [["vacinado", "Vacinado"], ["castrado", "Castrado"], ["vermifugado", "Vermifugado"]].map(([k, t]) => `<li class="${p[k] ? "sim" : ""}">${p[k] ? SVG_OK : ""}${p[k] ? t : "Não " + t.toLowerCase()}</li>`).join("");
    const conv = [["bom_criancas", "crianças"], ["bom_caes", "cães"], ["bom_gatos", "gatos"]].filter(([k]) => p[k] !== null).map(([k, t]) => `<li class="${p[k] ? "sim" : ""}">${p[k] ? SVG_OK + "Convive com " + t : "Não convive com " + t}</li>`).join("");
    const fotos = p.fotos.filter(fotoOk);
    const podePedir = p.status !== "adotado" && !vencido;
    centro.innerHTML = `${voltar("adocao.html")}
      <div class="pet-ado">
        <div class="galeria">
          <div class="principal"><img id="foto-principal" src="${esc(fotos[0] || "")}" alt="Foto de ${esc(p.nome)}"></div>
          ${fotos.length > 1 ? `<div class="miniaturas">${fotos.map((f, i) => `<button type="button" data-foto="${esc(f)}" aria-label="Ver foto ${i + 1}"${i === 0 ? ' aria-current="true"' : ""}><img src="${esc(f)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
        </div>
        <div class="pet-info">
          ${p.status !== "disponivel" ? `<span class="selo-status ${p.status}">${A.STATUS[p.status]}</span>` : ""}
          <h1>${esc(p.nome)}</h1>
          <p class="meta">${esc(descr)}<br>${esc(p.cidade)} / ${esc(p.estado)}</p>
          <ul class="saude">${saude}${conv}</ul>
          ${p.descricao ? `<div class="caixa-ado"><h2>Sobre ${esc(p.nome)}</h2><p>${esc(p.descricao)}</p></div>` : ""}
          ${p.necessidades ? `<div class="caixa-ado"><h2>Necessidades especiais</h2><p>${esc(p.necessidades)}</p></div>` : ""}
          ${p.compromissos ? `<div class="caixa-ado assumir"><h2>O que o adotante vai precisar assumir</h2><p>${esc(p.compromissos)}</p></div>` : ""}
          <div class="caixa-ado"><h2>${esc(o.nome)}</h2><p>${selo(o)} ${esc(o.cidade)} / ${esc(o.estado)}${o.instagram ? " · " + esc(o.instagram) : ""}</p>${o.descricao ? `<p style="margin-top:var(--e-2)">${esc(o.descricao)}</p>` : ""}</div>
          <div class="cta-ado">
            ${podePedir ? `<button type="button" class="btn" id="btn-adotar">Quero adotar ${esc(p.nome)}</button><small>Você responde algumas perguntas e a ONG avalia. Se ela aceitar, vocês trocam o WhatsApp.</small>`
              : `<p class="caixa-ado">${p.status === "adotado" ? esc(p.nome) + " já encontrou uma família!" : "Este anúncio venceu."} <a href="adocao.html">Ver outros pets</a></p>`}
            <button type="button" class="link-botao" id="btn-compartilhar-ado" style="min-height:44px">Compartilhar</button>
            <button type="button" class="link-botao" id="btn-denunciar-ado" style="min-height:44px;color:var(--suave)">Denunciar este anúncio</button>
          </div>
        </div>
      </div>`;
    centro.querySelectorAll("[data-foto]").forEach((b) => b.addEventListener("click", () => {
      $("foto-principal").src = b.dataset.foto;
      centro.querySelectorAll("[data-foto]").forEach((x) => x.setAttribute("aria-current", x === b ? "true" : "false"));
    }));
    const ba = $("btn-adotar");
    if (ba) ba.addEventListener("click", () => {
      if (!exigirConta()) return;
      if (!eu.foto_url) {
        if (confirm("Para pedir para adotar, coloque uma foto sua no perfil. Ela traz mais segurança para a ONG e para você.\n\nIr para Minha conta agora?")) location.href = "conta.html?volta=" + encodeURIComponent(location.pathname + location.search);
        return;
      }
      abrirQuestionario(p);
    });
    $("btn-compartilhar-ado").addEventListener("click", async () => {
      const url = "https://abano.com.br/adocao.html?pet=" + encodeURIComponent(p.id);
      if (navigator.share) { try { await navigator.share({ title: p.nome + " para adoção", url: url }); } catch (e) {} return; }
      try { await navigator.clipboard.writeText(url); toast("Link copiado!"); } catch (e) { prompt("Copie o link:", url); }
    });
    $("btn-denunciar-ado").addEventListener("click", async () => {
      if (!exigirConta()) return;
      const detalhe = prompt("O que há de errado com este anúncio? (venda disfarçada, golpe, maus-tratos…)");
      if (detalhe === null) return;
      const r2 = await sb.from("denuncias").insert({ denunciante: eu.id, alvo_tipo: "perfil", perfil: p.autor, motivo: "outro", detalhe: ("Anúncio de adoção de " + p.nome + ": " + detalhe).slice(0, 500) });
      if (r2.error && r2.error.code !== "23505") { toast(C.traduzir(r2.error)); return; }
      toast("Denúncia enviada. Obrigado por cuidar dos pets!");
    });
  }

  // ---------- Questionário "Quero adotar" ----------
  const dq = $("dialogo-adotar"), fq = $("form-adotar");
  $("ad-ciente").textContent = A.CIENTE;
  $("adotar-perguntas").innerHTML = A.PERGUNTAS.map((p) => {
    if (p.tipo === "opcoes") return `<fieldset data-pergunta="${p.id}"><legend>${esc(p.rotulo)}</legend><div class="opcoes">${p.opcoes.map((o) => `<label class="opcao"><input type="radio" name="${p.id}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join("")}</div></fieldset>`;
    const campo = p.tipo === "texto_longo" ? `<textarea id="q-${p.id}" name="${p.id}" maxlength="600"></textarea>` : `<input id="q-${p.id}" name="${p.id}" type="text" maxlength="200">`;
    return `<fieldset data-pergunta="${p.id}"><label class="rot" for="q-${p.id}">${esc(p.rotulo)}</label>${p.dica ? `<span class="ajuda">${esc(p.dica)}</span>` : ""}${campo}</fieldset>`;
  }).join("");
  let petAtual = null;
  function abrirQuestionario(p) {
    petAtual = p;
    fq.reset(); aviso($("adotar-aviso"), "");
    $("adotar-titulo").textContent = "Quero adotar " + p.nome;
    $("ad-cidade").value = eu.cidade || "";
    dq.showModal();
  }
  $("fechar-adotar").addEventListener("click", () => dq.close());
  fq.addEventListener("submit", async (e) => {
    e.preventDefault();
    const av = $("adotar-aviso");
    const respostas = {};
    for (const p of A.PERGUNTAS) {
      const v = p.tipo === "opcoes" ? ((fq.querySelector(`input[name="${p.id}"]:checked`) || {}).value || "") : fq[p.id].value.trim();
      if (!v) {
        aviso(av, "Responda: " + p.rotulo);
        const alvo = fq.querySelector(`[data-pergunta="${p.id}"]`);
        alvo.scrollIntoView({ block: "center", behavior: "smooth" });
        const foco = alvo.querySelector("input, textarea"); if (foco) setTimeout(() => foco.focus({ preventScroll: true }), 300);
        return;
      }
      respostas[p.id] = v;
    }
    const whatsapp = A.soDigitos(fq.whatsapp.value);
    if (!A.whatsappValido(whatsapp)) { aviso(av, "Digite seu WhatsApp com DDD, por exemplo (21) 99999-9999."); fq.whatsapp.focus(); return; }
    if (fq.cidade.value.trim().length < 2) { aviso(av, "Digite sua cidade."); fq.cidade.focus(); return; }
    if (!fq.ciente.checked) { aviso(av, "Marque que está ciente dos cuidados e gastos com o pet."); fq.ciente.focus(); return; }
    respostas.ciente = "Sim";
    const b = $("adotar-enviar"); b.disabled = true; b.textContent = "Enviando…";
    const r = await sb.from("pedidos_adocao").insert({ pet: petAtual.id, adotante: eu.id, respostas: respostas, whatsapp: whatsapp, cidade: fq.cidade.value.trim(), estado: eu.estado });
    b.disabled = false; b.textContent = "Enviar pedido de adoção";
    if (r.error) {
      aviso(av, r.error.code === "23505" ? "Você já enviou um pedido para este pet. Acompanhe em Meus pedidos." : C.traduzir(r.error));
      return;
    }
    dq.close();
    toast("Pedido enviado! A ONG recebe um aviso por e-mail.");
    setTimeout(() => { location.href = "adocao.html?v=pedidos"; }, 1400);
  });

  // ---------- Meus pedidos ----------
  async function telaPedidos() {
    meta("Meus pedidos de adoção | Abanô", null, "adocao.html");
    if (!sessao) { centro.innerHTML = voltar("adocao.html") + '<div class="vazio-ado"><h3>Seus pedidos de adoção</h3><p>Entre na sua conta para acompanhar seus pedidos.</p><a class="btn" href="entrar.html?volta=%2Fadocao.html%3Fv%3Dpedidos">Entrar</a></div>'; return; }
    centro.innerHTML = voltar("adocao.html") + '<header class="ado-topo"><div><h1>Meus pedidos de adoção</h1></div><p>Quando a ONG aceita, o WhatsApp dela aparece aqui.</p></header><div class="lista-ong" id="meus-pedidos"><p class="carregando">Carregando…</p></div>';
    const r = await sb.from("pedidos_adocao")
      .select("id, status, criado_em, respondido_em, post_compartilhado, pet:pets_adocao!pedidos_adocao_pet_fkey(id,nome,fotos,cidade,estado), org:organizacoes!pedidos_adocao_org_fkey(nome,tipo)")
      .eq("adotante", eu ? eu.id : sessao.user.id).order("criado_em", { ascending: false });
    const box = $("meus-pedidos");
    if (r.error) { box.innerHTML = '<p class="carregando">' + esc(C.traduzir(r.error)) + "</p>"; return; }
    if (!r.data.length) { box.innerHTML = '<div class="vazio-ado"><h3>Você ainda não pediu para adotar</h3><p>Veja os pets esperando por uma família.</p><a class="btn" href="adocao.html">Ver pets para adoção</a></div>'; return; }
    const ROT = { enviado: "Aguardando a resposta da ONG", aceito: "Aceito!", recusado: "Não seguiu desta vez", cancelado: "Cancelado por você", adotado: "Adoção concluída! 🎉" };
    const porId = new Map(r.data.map((pd) => [pd.id, pd]));
    box.innerHTML = r.data.map((pd) => {
      const pet = pd.pet || {}, o = pd.org || {};
      return `<article class="pedido" data-pedido="${esc(pd.id)}">
        <div class="pedido-topo">${pet.fotos && fotoOk(pet.fotos[0]) ? `<img src="${esc(pet.fotos[0])}" alt="">` : ""}
          <div><h3><a href="adocao.html?pet=${encodeURIComponent(pet.id || "")}">${esc(pet.nome || "Pet")}</a> · ${esc(o.nome || "")}</h3>
          <p class="meta">Pedido de ${new Date(pd.criado_em).toLocaleDateString("pt-BR")} · <b>${ROT[pd.status]}</b></p></div></div>
        ${pd.status === "aceito" ? '<div class="contato" data-contato><span>A ONG aceitou seu pedido.</span><button type="button" class="btn btn-sec" data-ver-contato>Ver WhatsApp da ONG</button></div>' : ""}
        ${pd.status === "adotado" ? `<div class="adotou">${pd.post_compartilhado
          ? `<span>Você compartilhou essa alegria com a Comunidade. 💛</span><a class="btn btn-sec" href="comunidade/?p=${encodeURIComponent(pd.post_compartilhado)}">Ver a publicação</a>`
          : `<span>Bem-vindo à família, ${esc(pet.nome || "pet")}! Quer contar para a Comunidade? Só publica se você quiser.</span><button type="button" class="btn" data-compartilhar>Compartilhar com a Comunidade</button>`}</div>` : ""}
        ${pd.status === "enviado" || pd.status === "aceito" ? '<div class="ado-acoes"><button type="button" class="link-botao" data-cancelar style="min-height:44px">Cancelar pedido</button></div>' : ""}
      </article>`;
    }).join("");
    const abrirPartilha = q.get("compartilhar");
    if (abrirPartilha && porId.get(abrirPartilha) && porId.get(abrirPartilha).status === "adotado" && !porId.get(abrirPartilha).post_compartilhado) compartilharAdocao(porId.get(abrirPartilha));
    box.addEventListener("click", async (e) => {
      const card = e.target.closest("[data-pedido]"); if (!card) return;
      const id = card.dataset.pedido;
      if (e.target.closest("[data-compartilhar]")) { compartilharAdocao(porId.get(id)); return; }
      if (e.target.closest("[data-ver-contato]")) {
        const c = await sb.rpc("contato_pedido", { p_pedido: id });
        if (c.error || !c.data) { toast("Não deu para abrir o contato agora."); return; }
        card.querySelector("[data-contato]").innerHTML = `<span>${esc(c.data.nome)}: ${esc(A.formatarWhatsapp(c.data.whatsapp))}</span><a class="btn" href="${esc(A.linkWhatsapp(c.data.whatsapp, "Olá! Meu pedido de adoção foi aceito pelo Abanô."))}" target="_blank" rel="noopener">Abrir no WhatsApp</a>`;
      } else if (e.target.closest("[data-cancelar]")) {
        if (!confirm("Cancelar este pedido de adoção?")) return;
        const c = await sb.rpc("cancelar_pedido", { p_pedido: id });
        if (c.error) { toast(C.traduzir(c.error)); return; }
        toast("Pedido cancelado."); telaPedidos();
      }
    });
  }

  // ---------- Compartilhar a adoção (opcional, o texto vem pronto) ----------
  function compartilharAdocao(pd) {
    const pet = pd.pet || {}, o = pd.org || {};
    const foto = pet.fotos && fotoOk(pet.fotos[0]) ? pet.fotos[0] : "";
    const texto = `🏡💛 Hoje é dia de festa: ${pet.nome || "meu novo pet"} chegou para fazer parte da família! Adotei pelo Abanô${o.nome ? ", com a ajuda de " + o.nome : ""}. Adotar é um ato de amor! 🐾🎉`;
    const d = document.createElement("dialog");
    d.className = "dialogo-ado dialogo-partilha";
    d.setAttribute("aria-labelledby", "partilha-titulo");
    d.innerHTML = `<form class="form-ado" novalidate>
      <div class="cab"><h2 id="partilha-titulo">Comemore com a Comunidade</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">&times;</button></div>
      <p class="sub">Montamos a publicação para você. Mude o texto como quiser, ou feche se preferir não compartilhar.</p>
      <div class="partilha-previa">${foto ? `<img src="${esc(foto)}" alt="Foto de ${esc(pet.nome || "pet")}">` : ""}<span class="partilha-selo">Adotou pelo Abanô</span></div>
      <label class="rot" for="partilha-texto">Texto da publicação</label>
      <textarea id="partilha-texto" maxlength="2000" rows="4">${esc(texto)}</textarea>
      <p class="aviso-conta" data-aviso role="alert" hidden></p>
      <button type="submit" class="btn">Publicar no feed</button>
      <button type="button" class="link-botao partilha-nao" data-fechar>Agora não</button>
    </form>`;
    document.body.appendChild(d);
    const fechar = () => { d.close(); d.remove(); };
    d.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fechar));
    d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
    d.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const b = d.querySelector("[type=submit]"); b.disabled = true; b.textContent = "Publicando…";
      const r = await sb.rpc("compartilhar_adocao", { p_pedido: pd.id, p_texto: d.querySelector("textarea").value.trim() });
      if (r.error) { b.disabled = false; b.textContent = "Publicar no feed"; aviso(d.querySelector("[data-aviso]"), C.traduzir(r.error)); return; }
      fechar();
      toast("Publicado! A Comunidade vai adorar. 💛");
      setTimeout(() => { location.href = "comunidade/?p=" + encodeURIComponent(r.data); }, 1200);
    });
    d.showModal();
  }

  (async function iniciar() {
    await carregarEu();
    if (q.get("pet")) return telaPet(q.get("pet"));
    if (q.get("v") === "pedidos") return telaPedidos();
    return telaLista();
  })();
})();
