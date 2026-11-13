/* Abanô — Painel da ONG ou protetor: cadastro da organização, anúncios
   de pets para adoção e pedidos recebidos (aceitar/recusar e ver o WhatsApp).
   Depende de supabase-js, lista.js, conta.js e adocao-comum.js. */
(() => {
  "use strict";
  const C = window.abanoConta, A = window.ABANO_ADOCAO;
  const raiz = document.getElementById("painel-ong");
  if (!C || !A || !raiz) return;
  const sb = C.sb;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PASTA = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const fotoOk = (u) => String(u || "").indexOf(PASTA) === 0;
  const data = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  let eu = null, org = null, pets = [], petsPorId = new Map();

  function aviso(el, msg, ok) { el.textContent = msg || ""; el.classList.toggle("ok", !!ok); el.hidden = !msg; }
  let tt;
  function toast(m) { const t = $("toast-ado"); t.textContent = m; t.classList.add("ver"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("ver"), 3200); }
  function opcoesSelect(sel, mapa, extraPrimeiro) {
    sel.innerHTML = (extraPrimeiro || "") + Object.keys(mapa).map((k) => `<option value="${k}">${esc(mapa[k])}</option>`).join("");
  }
  const UF_OPCOES = '<option value="">Escolha</option>' + A.UFS.map((u) => `<option>${u}</option>`).join("");
  $("o-estado").innerHTML = UF_OPCOES;
  $("pa-estado").innerHTML = UF_OPCOES;
  opcoesSelect($("pa-especie"), A.ESPECIES, '<option value="">Escolha</option>');
  opcoesSelect($("pa-idade"), A.IDADES, '<option value="">Escolha</option>');
  opcoesSelect($("pa-porte"), { pequeno: "Pequeno", medio: "Médio", grande: "Grande" }, '<option value="">Não se aplica</option>');
  $("pa-sexo").innerHTML = Object.keys(A.SEXOS).map((k, i) => `<label class="opcao"><input type="radio" name="sexo" value="${k}"${i === 0 ? " checked" : ""}><span>${A.SEXOS[k]}</span></label>`).join("");

  // ---------- Início ----------
  (async function iniciar() {
    const s = await sb.auth.getSession();
    if (!s.data.session) { location.replace("/entrar.html?volta=" + encodeURIComponent("/ong.html")); return; }
    const r = await sb.rpc("minha_conta");
    if (r.error) { $("ong-carregando").hidden = true; aviso($("ong-erro"), C.traduzir(r.error)); return; }
    eu = await C.completarEstado(r.data);
    if (!eu.aceitou || !eu.estado) { location.replace("/conta.html?volta=" + encodeURIComponent("/ong.html")); return; }
    await carregarOrg();
  })();

  async function carregarOrg() {
    const r = await sb.rpc("minha_organizacao");
    $("ong-carregando").hidden = true;
    if (r.error) { aviso($("ong-erro"), "Não deu para abrir o painel. " + C.traduzir(r.error)); return; }
    org = r.data;
    const st = $("ong-status"), form = $("form-org");
    if (!org) {
      st.hidden = true; form.hidden = false; $("ong-painel").hidden = true;
      $("o-estado").value = eu.estado || ""; $("o-cidade").value = eu.cidade || "";
      const pre = new URLSearchParams(location.search).get("tipo");
      const rp = pre && fo.querySelector(`input[name="tipo"][value="${pre}"]`); if (rp) rp.checked = true;
      trocarTipo();
      return;
    }
    preencherForm();
    if (org.status === "aprovada") {
      $("ong-titulo").textContent = org.tipo === "pessoa" ? "Seus anúncios de adoção" : org.nome;
      $("btn-anunciar").textContent = org.tipo === "pessoa" ? "Anunciar um animal para adoção" : "Anunciar pet para adoção";
      if (org.tipo === "pessoa" && !org.telefone_confirmado && eu.telefone_confirmado) {
        const c = await sb.rpc("confirmar_telefone");
        if (!c.error && c.data) org.telefone_confirmado = true;
      }
      $("tel-box").hidden = !(org.tipo === "pessoa" && !org.telefone_confirmado);
      if (!$("tel-box").hidden && !$("tel-num").value) $("tel-num").value = A.formatarWhatsapp(org.whatsapp || "");
      st.hidden = true;
      $("ong-painel").hidden = false;
      $("aba-dados").appendChild(form);
      form.hidden = false;
      $("org-form-titulo").textContent = org.tipo === "pessoa" ? "Seus dados de anunciante" : "Dados da organização";
      $("org-enviar").textContent = "Salvar dados";
      carregarPets();
      carregarPedidos();
      if (location.hash === "#pedidos") abrirAba("pedidos");
      return;
    }
    $("ong-painel").hidden = true;
    st.hidden = false;
    form.hidden = org.status === "suspensa";
    if (org.status === "pendente") {
      st.innerHTML = '<h2>Cadastro em análise</h2><p>Recebemos os dados de <b>' + esc(org.nome) + '</b>. A equipe do Abanô vai conferir e avisar por e-mail. Enquanto isso, você pode corrigir os dados abaixo.</p>';
      $("org-form-titulo").textContent = "Seus dados"; $("org-enviar").textContent = "Salvar alterações";
    } else if (org.status === "recusada") {
      st.innerHTML = '<h2>Cadastro não aprovado</h2><p>' + (org.motivo ? "Motivo: " + esc(org.motivo) + "<br>" : "") + 'Corrija os dados abaixo e envie de novo para análise.</p>';
      $("org-form-titulo").textContent = "Corrigir dados"; $("org-enviar").textContent = "Enviar de novo para análise";
    } else {
      st.innerHTML = '<h2>Organização suspensa</h2><p>Os anúncios desta organização estão fora do ar. Se achar que foi um engano, escreva para <a href="mailto:contato@abano.com.br">contato@abano.com.br</a>.</p>';
    }
  }

  // ---------- Cadastro da organização ----------
  const fo = $("form-org");
  function preencherForm() {
    fo.querySelector(`input[name="tipo"][value="${org.tipo}"]`).checked = true;
    fo.nome.value = org.nome || ""; fo.cidade.value = org.cidade || ""; fo.estado.value = org.estado || "";
    fo.whatsapp.value = A.formatarWhatsapp(org.whatsapp || ""); fo.instagram.value = org.instagram || "";
    fo.site.value = org.site || ""; fo.cnpj.value = org.cnpj || ""; fo.descricao.value = org.descricao || "";
    trocarTipo();
  }
  const TEXTOS_TIPO = {
    ong: ["Nome da ONG ou instituição", "Conte sobre o trabalho", "A equipe do Abanô confere os dados (redes sociais, CNPJ, site) e libera os anúncios. Seu WhatsApp e CNPJ não aparecem no site."],
    protetor: ["Nome do seu trabalho de proteção (ou o seu nome)", "Conte sobre o trabalho", "A equipe do Abanô confere seus dados e redes sociais e libera os anúncios. Seu WhatsApp não aparece no site."],
    pessoa: ["Seu nome", "Conte um pouco sobre você", "Depois de salvar, você confirma seu telefone por código. Cada anúncio é revisado pela equipe antes de aparecer. Seu WhatsApp só é mostrado para quem tiver o pedido aceito por você."]
  };
  function trocarTipo() {
    const tipo = fo.querySelector('input[name="tipo"]:checked').value, tx = TEXTOS_TIPO[tipo];
    $("o-cnpj-box").hidden = tipo !== "ong";
    $("o-site-box").hidden = tipo === "pessoa";
    $("o-nome-rot").textContent = tx[0];
    $("o-descricao-rot").innerHTML = tx[1] + ' <span class="opcional">(opcional)</span>';
    $("org-sub").textContent = tx[2];
    if (tipo === "pessoa" && !fo.nome.value && eu) fo.nome.value = eu.nome || "";
    if (!org) $("org-enviar").textContent = tipo === "pessoa" ? "Salvar e continuar" : "Enviar para análise";
  }
  fo.addEventListener("change", (e) => { if (e.target.name === "tipo") trocarTipo(); });
  fo.addEventListener("submit", async (e) => {
    e.preventDefault();
    const av = $("org-aviso");
    const tipo = fo.querySelector('input[name="tipo"]:checked').value;
    const dados = {
      nome: fo.nome.value.trim(), tipo: tipo, cidade: fo.cidade.value.trim(), estado: fo.estado.value,
      whatsapp: A.soDigitos(fo.whatsapp.value), instagram: fo.instagram.value.trim() || null,
      site: fo.site.value.trim() || null, cnpj: tipo === "ong" ? (fo.cnpj.value.trim() || null) : null,
      descricao: fo.descricao.value.trim() || null
    };
    const erros = [];
    if (tipo === "pessoa") dados.site = null;
    if (dados.nome.length < 2) erros.push([fo.nome, tipo === "pessoa" ? "Digite o seu nome." : "Digite o nome da ONG ou do trabalho de proteção."]);
    if (dados.cidade.length < 2) erros.push([fo.cidade, "Digite a cidade."]);
    if (!dados.estado) erros.push([fo.estado, "Escolha o estado."]);
    if (!A.whatsappValido(dados.whatsapp)) erros.push([fo.whatsapp, "Digite o WhatsApp com DDD, por exemplo (21) 99999-9999."]);
    if (dados.site && !/^https:\/\//i.test(dados.site)) erros.push([fo.site, "O site precisa começar com https://"]);
    if (dados.cnpj && !/^[0-9./-]{14,18}$/.test(dados.cnpj)) erros.push([fo.cnpj, "Confira o CNPJ: 14 números, com ou sem pontos."]);
    if (A.temValorEmReais(dados.descricao)) erros.push([fo.descricao, "A descrição não pode ter valores em reais."]);
    if (erros.length) { aviso(av, erros[0][1]); erros[0][0].focus(); return; }
    const b = $("org-enviar"), txt = b.textContent; b.disabled = true; b.textContent = "Salvando…";
    const r = org
      ? await sb.from("organizacoes").update(dados).eq("id", org.id)
      : await sb.from("organizacoes").insert(Object.assign({ dono: eu.id }, dados));
    b.disabled = false; b.textContent = txt;
    if (r.error) { aviso(av, C.traduzir(r.error)); return; }
    aviso(av, "");
    toast(org ? "Dados salvos." : tipo === "pessoa" ? "Pronto! Agora confirme seu telefone para anunciar." : "Enviado para análise! Você recebe um e-mail quando for aprovado.");
    await carregarOrg();
  });

  // ---------- Confirmação do telefone por código (SMS) ----------
  let telE164 = "";
  function erroSms(e) {
    const m = String((e && e.message) || "");
    if (/provider|sms|twilio|disabled|not enabled|unsupported/i.test(m)) return "A confirmação por SMS ainda está sendo ativada no Abanô. Tente de novo em breve.";
    if (/rate|seconds|too many/i.test(m)) return "Espere um pouco antes de pedir outro código.";
    if (/already|registered|exists/i.test(m)) return "Este número já está confirmado em outra conta do Abanô.";
    if (/expired|invalid|token/i.test(m)) return "Código incorreto ou vencido. Confira ou peça outro.";
    return C.traduzir(e);
  }
  $("tel-form-num").addEventListener("submit", async (e) => {
    e.preventDefault();
    const av = $("tel-aviso"), d = A.soDigitos($("tel-num").value).replace(/^55(?=\d{10,11}$)/, "");
    if (d.length < 10 || d.length > 11) { aviso(av, "Digite o celular com DDD, por exemplo (21) 99999-9999."); $("tel-num").focus(); return; }
    telE164 = "+55" + d;
    const b = e.target.querySelector("button"); b.disabled = true; b.textContent = "Enviando…";
    const r = await sb.auth.updateUser({ phone: telE164 });
    b.disabled = false; b.textContent = "Enviar código";
    if (r.error) { aviso(av, erroSms(r.error)); return; }
    aviso(av, "");
    $("tel-form-num").hidden = true; $("tel-form-cod").hidden = false; $("tel-cod").focus();
    toast("Código enviado por SMS para " + A.formatarWhatsapp(d) + ".");
  });
  $("tel-form-cod").addEventListener("submit", async (e) => {
    e.preventDefault();
    const av = $("tel-aviso"), cod = $("tel-cod").value.replace(/\D/g, "");
    if (cod.length < 6) { aviso(av, "Digite o código de 6 números que chegou por SMS."); return; }
    const b = e.target.querySelector("button[type=submit]"); b.disabled = true; b.textContent = "Confirmando…";
    const r = await sb.auth.verifyOtp({ phone: telE164, token: cod, type: "phone_change" });
    if (r.error) { b.disabled = false; b.textContent = "Confirmar"; aviso(av, erroSms(r.error)); return; }
    const c = await sb.rpc("confirmar_telefone");
    b.disabled = false; b.textContent = "Confirmar";
    if (c.error || !c.data) { aviso(av, "Telefone confirmado, mas não deu para atualizar o selo agora. Recarregue a página."); return; }
    toast("Telefone confirmado! Agora você já pode anunciar.");
    eu.telefone_confirmado = true;
    await carregarOrg();
  });
  $("tel-trocar").addEventListener("click", () => { $("tel-form-cod").hidden = true; $("tel-form-num").hidden = false; $("tel-num").focus(); });

  // ---------- Abas ----------
  function abrirAba(nome) {
    ["pets", "pedidos", "dados"].forEach((n) => {
      $("tab-" + n).setAttribute("aria-selected", n === nome ? "true" : "false");
      $("aba-" + n).hidden = n !== nome;
    });
  }
  ["pets", "pedidos", "dados"].forEach((n) => $("tab-" + n).addEventListener("click", () => abrirAba(n)));

  // ---------- Pets para adoção ----------
  async function carregarPets() {
    const r = await sb.from("pets_adocao").select("*").eq("org", org.id).order("criado_em", { ascending: false });
    const box = $("lista-pets-ong");
    if (r.error) { box.innerHTML = '<p class="carregando">' + esc(C.traduzir(r.error)) + "</p>"; return; }
    pets = r.data || [];
    petsPorId = new Map(pets.map((p) => [p.id, p]));
    if (!pets.length) {
      box.innerHTML = '<div class="vazio-ado"><h3>Nenhum pet anunciado ainda</h3><p>Anuncie o primeiro pet: fotos, saúde, temperamento e o que o adotante vai precisar assumir.</p></div>';
      return;
    }
    box.innerHTML = pets.map((p) => {
      const vencido = new Date(p.expira_em) < new Date();
      return `<article class="item-ong" data-id="${esc(p.id)}">
        <img src="${fotoOk(p.fotos[0]) ? esc(p.fotos[0]) : ""}" alt="" loading="lazy">
        <div><h3>${esc(p.nome)}</h3>
          <p class="meta">${esc([A.ESPECIES[p.especie], A.SEXOS[p.sexo], A.IDADES[p.idade]].join(" · "))}</p>
          ${p.moderacao === "pendente" ? '<p class="moderacao pendente">Em análise pela equipe do Abanô. Ainda não aparece no site.</p>'
            : p.moderacao === "recusado" ? `<p class="moderacao recusado"><b>Precisa de ajustes.</b> ${esc(p.moderacao_motivo || "Confira as regras e edite o anúncio.")} Ao salvar, ele volta para a análise.</p>`
            : `<p class="meta">${vencido ? "<b>Anúncio vencido</b> em " : "Fica no ar até "}${data(p.expira_em)}</p>`}</div>
        <div class="acoes-item">
          <label class="sr" for="st-${esc(p.id)}">Situação de ${esc(p.nome)}</label>
          <select id="st-${esc(p.id)}" data-status>${Object.keys(A.STATUS).map((k) => `<option value="${k}"${k === p.status ? " selected" : ""}>${A.STATUS[k]}</option>`).join("")}</select>
          <button type="button" class="btn btn-sec" data-renovar>Renovar 60 dias</button>
          <button type="button" class="btn btn-sec" data-editar>Editar</button>
          <a class="btn btn-sec" href="adocao.html?pet=${encodeURIComponent(p.id)}">Ver anúncio</a>
          <button type="button" class="link-botao" data-apagar>Apagar</button>
        </div></article>`;
    }).join("");
  }
  $("lista-pets-ong").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-status]"); if (!sel) return;
    const id = sel.closest("[data-id]").dataset.id;
    if (sel.value === "adotado") { abrirConcluir(petsPorId.get(id), sel); return; }
    const r = await sb.from("pets_adocao").update({ status: sel.value }).eq("id", id);
    if (r.error) { toast(C.traduzir(r.error)); carregarPets(); return; }
    toast(sel.value === "adotado" ? "Que alegria! Marcado como adotado." : "Situação atualizada.");
  });
  $("lista-pets-ong").addEventListener("click", async (e) => {
    const item = e.target.closest("[data-id]"); if (!item) return;
    const p = petsPorId.get(item.dataset.id);
    if (e.target.closest("[data-editar]")) abrirPet(p);
    else if (e.target.closest("[data-renovar]")) {
      const r = await sb.rpc("renovar_pet_adocao", { p_pet: p.id });
      if (r.error) { toast(C.traduzir(r.error)); return; }
      toast("Anúncio renovado por mais 60 dias."); carregarPets();
    } else if (e.target.closest("[data-apagar]")) {
      if (!confirm("Apagar o anúncio de " + p.nome + "? Os pedidos dele também somem. Não dá para desfazer.")) return;
      const r = await sb.from("pets_adocao").delete().eq("id", p.id);
      if (r.error) { toast(C.traduzir(r.error)); return; }
      (p.fotos || []).forEach((u) => C.apagarFoto(u));
      toast("Anúncio apagado."); carregarPets(); carregarPedidos();
    }
  });

  // ---------- Adoção concluída: a ONG diz quem adotou ----------
  async function abrirConcluir(p, sel) {
    const r = await sb.from("pedidos_adocao")
      .select("id, adotante:perfis!pedidos_adocao_adotante_fkey(nome,usuario,foto_url)")
      .eq("pet", p.id).eq("status", "aceito").order("respondido_em", { ascending: false });
    const aceitos = r.data || [];
    const d = document.createElement("dialog");
    d.className = "dialogo-ado dialogo-concluir";
    d.setAttribute("aria-labelledby", "concluir-titulo");
    d.innerHTML = `<form class="form-ado" novalidate>
      <div class="cab"><h2 id="concluir-titulo">${esc(p.nome)} foi ${p.sexo === "femea" ? "adotada" : "adotado"}? 🎉</h2><button type="button" class="fechar" data-fechar aria-label="Fechar">&times;</button></div>
      <p class="sub">Conte quem adotou para concluir a adoção. Assim temos certeza de que ${esc(p.nome)} já foi entregue, a família recebe um aviso para compartilhar a novidade e a Comunidade comemora junto no feed.</p>
      <fieldset class="concluir-opcoes"><legend class="rot">Quem adotou?</legend>
        ${aceitos.map((x, i) => `<label class="opcao-linha"><input type="radio" name="pedido" value="${esc(x.id)}"${i === 0 ? " checked" : ""}><span><b>${esc((x.adotante || {}).nome || "Tutor")}</b><small>@${esc((x.adotante || {}).usuario || "")} · pedido aceito</small></span></label>`).join("")}
        <label class="opcao-linha"><input type="radio" name="pedido" value=""${aceitos.length ? "" : " checked"}><span><b>Foi adotado fora do Abanô</b><small>Marca como adotado, sem publicação no feed</small></span></label>
      </fieldset>
      ${aceitos.length ? "" : '<p class="ajuda">Nenhum pedido aceito para este pet. Se a família pediu pelo Abanô, aceite o pedido na aba Pedidos antes de concluir.</p>'}
      <p class="aviso-conta" data-aviso role="alert" hidden></p>
      <button type="submit" class="btn">Concluir adoção</button>
    </form>`;
    document.body.appendChild(d);
    let concluiu = false;
    const fechar = () => { d.close(); d.remove(); if (!concluiu) sel.value = p.status; };
    d.querySelector("[data-fechar]").addEventListener("click", fechar);
    d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
    d.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const pedido = (d.querySelector('input[name="pedido"]:checked') || {}).value || null;
      const b = d.querySelector("[type=submit]"); b.disabled = true; b.textContent = "Concluindo…";
      const c = await sb.rpc("concluir_adocao", { p_pet: p.id, p_pedido: pedido });
      if (c.error) {
        b.disabled = false; b.textContent = "Concluir adoção";
        aviso(d.querySelector("[data-aviso]"), /concluir_adocao/.test(c.error.message || "") ? "Falta ativar a adoção concluída no banco de dados do Abanô." : C.traduzir(c.error));
        return;
      }
      concluiu = true; fechar();
      toast(pedido ? "Adoção concluída! A comemoração já está no feed da Comunidade. 🎉" : "Que alegria! Marcado como adotado.");
      carregarPets(); carregarPedidos();
    });
    d.showModal();
  }

  // Formulário do pet
  const dp = $("dialogo-pet-ado"), fp = $("form-pet-ado");
  let editando = null, fotosAtuais = [], fotosNovas = [];
  function abrirPet(p) {
    editando = p || null; fp.reset(); aviso($("pa-aviso"), "");
    fotosAtuais = p ? (p.fotos || []).slice() : []; fotosNovas = [];
    $("pet-ado-titulo").textContent = p ? "Editar " + p.nome : "Anunciar pet para adoção";
    $("pa-salvar").textContent = p ? "Salvar alterações" : "Publicar anúncio";
    const v = (b) => b === true ? "1" : b === false ? "0" : "";
    if (p) {
      fp.nome.value = p.nome; fp.especie.value = p.especie; fp.idade.value = p.idade; fp.porte.value = p.porte || "";
      fp.querySelector(`input[name="sexo"][value="${p.sexo}"]`).checked = true;
      fp.vacinado.checked = p.vacinado; fp.castrado.checked = p.castrado; fp.vermifugado.checked = p.vermifugado;
      fp.bom_criancas.value = v(p.bom_criancas); fp.bom_caes.value = v(p.bom_caes); fp.bom_gatos.value = v(p.bom_gatos);
      fp.cidade.value = p.cidade; fp.estado.value = p.estado;
      fp.descricao.value = p.descricao || ""; fp.necessidades.value = p.necessidades || ""; fp.compromissos.value = p.compromissos || "";
    } else {
      fp.cidade.value = org.cidade; fp.estado.value = org.estado;
    }
    const pessoa = org.tipo === "pessoa";
    $("pa-pessoa").hidden = !pessoa;
    if (pessoa) {
      fp.regiao.value = (p && p.regiao) || ""; fp.motivo.value = (p && p.motivo) || ""; fp.saude.value = (p && p.saude) || "";
      fp.querySelectorAll('input[name="onde_esta"]').forEach((r) => { r.checked = !!p && p.onde_esta === r.value; });
      fp.por_terceiros.checked = !!(p && p.por_terceiros); fp.autorizado.checked = !!(p && p.autorizado);
      fp.declarou.checked = false;
      $("pa-autorizado-box").hidden = !fp.por_terceiros.checked;
    }
    desenharFotos();
    dp.showModal();
  }
  $("pa-terceiros").addEventListener("change", (e) => { $("pa-autorizado-box").hidden = !e.target.checked; });
  $("btn-anunciar").addEventListener("click", () => {
    if (org.tipo === "pessoa" && !org.telefone_confirmado) {
      toast("Confirme seu telefone por código antes de anunciar.");
      $("tel-box").scrollIntoView({ behavior: "smooth", block: "center" }); $("tel-num").focus();
      return;
    }
    if (!eu.foto_url) {
      if (confirm("Para anunciar pets para adoção, coloque uma foto sua no perfil. Ela traz mais segurança para quem vai adotar.\n\nIr para Minha conta agora?")) location.href = "conta.html?volta=" + encodeURIComponent("/ong.html");
      return;
    }
    abrirPet(null);
  });
  $("fechar-pet-ado").addEventListener("click", () => dp.close());
  $("pa-fotos").addEventListener("change", function () {
    const cabe = 6 - fotosAtuais.length - fotosNovas.length;
    fotosNovas = fotosNovas.concat([...this.files].slice(0, Math.max(0, cabe)));
    this.value = "";
    desenharFotos();
  });
  function desenharFotos() {
    const box = $("pa-previas"); box.innerHTML = "";
    const todas = fotosAtuais.map((u) => ({ tipo: "atual", src: u })).concat(fotosNovas.map((f) => ({ tipo: "nova", arq: f, src: URL.createObjectURL(f) })));
    todas.forEach((f, i) => {
      const d = document.createElement("div"); d.className = "previa";
      d.innerHTML = `<img src="${esc(f.src)}" alt=""><button type="button" aria-label="Tirar foto ${i + 1}">×</button>`;
      d.querySelector("button").addEventListener("click", () => {
        if (f.tipo === "atual") fotosAtuais.splice(fotosAtuais.indexOf(f.src), 1); else fotosNovas.splice(fotosNovas.indexOf(f.arq), 1);
        desenharFotos();
      });
      box.appendChild(d);
    });
  }
  fp.addEventListener("submit", async (e) => {
    e.preventDefault();
    const av = $("pa-aviso");
    const bool = (v) => v === "1" ? true : v === "0" ? false : null;
    const dados = {
      nome: fp.nome.value.trim(), especie: fp.especie.value, idade: fp.idade.value, porte: fp.porte.value || null,
      sexo: fp.querySelector('input[name="sexo"]:checked').value,
      vacinado: fp.vacinado.checked, castrado: fp.castrado.checked, vermifugado: fp.vermifugado.checked,
      bom_criancas: bool(fp.bom_criancas.value), bom_caes: bool(fp.bom_caes.value), bom_gatos: bool(fp.bom_gatos.value),
      cidade: fp.cidade.value.trim(), estado: fp.estado.value,
      descricao: fp.descricao.value.trim() || null, necessidades: fp.necessidades.value.trim() || null, compromissos: fp.compromissos.value.trim() || null
    };
    const erros = [];
    if (fotosAtuais.length + fotosNovas.length < 1) erros.push([$("pa-fotos"), "Coloque pelo menos uma foto do pet."]);
    if (!dados.nome) erros.push([fp.nome, "Digite o nome do pet."]);
    if (!dados.especie) erros.push([fp.especie, "Escolha a espécie."]);
    if (!dados.idade) erros.push([fp.idade, "Escolha a idade."]);
    if (dados.cidade.length < 2) erros.push([fp.cidade, "Digite a cidade."]);
    if (!dados.estado) erros.push([fp.estado, "Escolha o estado."]);
    if (org.tipo === "pessoa") {
      Object.assign(dados, {
        regiao: fp.regiao.value.trim() || null, motivo: fp.motivo.value.trim() || null, saude: fp.saude.value.trim() || null,
        onde_esta: (fp.querySelector('input[name="onde_esta"]:checked') || {}).value || null,
        por_terceiros: fp.por_terceiros.checked, autorizado: fp.por_terceiros.checked ? fp.autorizado.checked : null, declarou: fp.declarou.checked
      });
      if (!dados.regiao) erros.push([fp.regiao, "Informe o bairro ou a região."]);
      if (!dados.motivo || dados.motivo.length < 10) erros.push([fp.motivo, "Conte o motivo de colocar o animal para adoção."]);
      if (!dados.saude) erros.push([fp.saude, "Conte as informações de saúde que você conhece (ou escreva \"nenhuma conhecida\")."]);
      if (!dados.onde_esta) erros.push([fp.querySelector('input[name="onde_esta"]'), "Diga se o animal está com você ou em lar temporário."]);
      if (dados.por_terceiros && !dados.autorizado) erros.push([fp.autorizado, "Para divulgar por outra pessoa, você precisa ter a autorização do responsável."]);
      if (!dados.declarou) erros.push([fp.declarou, "Marque a declaração do anunciante para continuar."]);
      if (!dados.descricao) erros.push([fp.descricao, "Conte um pouco sobre o animal: personalidade, rotina, como convive."]);
    }
    if (A.temValorEmReais([dados.descricao, dados.necessidades, dados.compromissos, dados.motivo, dados.saude].join(" "))) erros.push([fp.compromissos, "Tire os valores em reais do anúncio: eles são combinados direto com quem quiser adotar."]);
    if (erros.length) { aviso(av, erros[0][1]); erros[0][0].focus(); return; }
    const b = $("pa-salvar"), txt = b.textContent; b.disabled = true; b.textContent = "Salvando…";
    const enviadas = [];
    try {
      for (const f of fotosNovas) enviadas.push(await C.enviarFoto(eu.id, "adocao", f));
      dados.fotos = fotosAtuais.concat(enviadas);
      const r = editando
        ? await sb.from("pets_adocao").update(dados).eq("id", editando.id)
        : await sb.from("pets_adocao").insert(Object.assign({ org: org.id, autor: eu.id }, dados));
      if (r.error) throw r.error;
      if (editando) (editando.fotos || []).filter((u) => dados.fotos.indexOf(u) < 0).forEach((u) => C.apagarFoto(u));
      dp.close();
      toast(org.tipo === "pessoa" ? "Anúncio enviado para análise! Você recebe um e-mail quando for aprovado." : editando ? "Anúncio atualizado." : "Anúncio publicado!");
      carregarPets();
    } catch (err) {
      enviadas.forEach((u) => C.apagarFoto(u));
      aviso(av, err && err.code ? C.traduzir(err) : (err && err.message) || "Não deu para salvar agora.");
    } finally { b.disabled = false; b.textContent = txt; }
  });

  // ---------- Pedidos recebidos ----------
  async function carregarPedidos() {
    const box = $("lista-pedidos-ong");
    const r = await sb.from("pedidos_adocao")
      .select("id, status, respostas, cidade, estado, criado_em, respondido_em, pet:pets_adocao!pedidos_adocao_pet_fkey(id,nome,fotos), adotante:perfis!pedidos_adocao_adotante_fkey(nome,usuario,foto_url)")
      .eq("org", org.id).order("criado_em", { ascending: false }).limit(200);
    if (r.error) { box.innerHTML = '<p class="carregando">' + esc(C.traduzir(r.error)) + "</p>"; return; }
    const lista = r.data || [];
    const novos = lista.filter((x) => x.status === "enviado").length;
    $("num-pedidos").textContent = novos ? "(" + novos + ")" : "";
    if (!lista.length) { box.innerHTML = '<div class="vazio-ado"><h3>Nenhum pedido ainda</h3><p>Quando alguém pedir para adotar um dos seus pets, o pedido aparece aqui e você recebe um e-mail.</p></div>'; return; }
    const ROT = { enviado: "Aguardando sua resposta", aceito: "Aceito", recusado: "Recusado", cancelado: "Cancelado pela pessoa", adotado: "Adoção concluída 🎉" };
    box.innerHTML = lista.map((pd) => {
      const pet = pd.pet || {}, ad = pd.adotante || {};
      const resp = A.PERGUNTAS.map((q) => pd.respostas && pd.respostas[q.id] ? `<li><b>${esc(q.rotulo)}</b>${esc(pd.respostas[q.id])}</li>` : "").join("");
      return `<article class="pedido" data-pedido="${esc(pd.id)}">
        <div class="pedido-topo">${pet.fotos && fotoOk(pet.fotos[0]) ? `<img src="${esc(pet.fotos[0])}" alt="">` : ""}
          <div><h3>${esc(ad.nome || "Tutor")} quer adotar ${esc(pet.nome || "")}</h3>
          <p class="meta">${esc([pd.cidade, pd.estado].filter(Boolean).join(" / "))} · ${data(pd.criado_em)} · <b>${ROT[pd.status]}</b> · <a href="comunidade/?u=${encodeURIComponent(ad.usuario || "")}" target="_blank" rel="noopener">ver perfil</a></p></div></div>
        <ul class="respostas">${resp}</ul>
        ${pd.status === "enviado" ? '<div class="ado-acoes"><button type="button" class="btn" data-aceitar>Aceitar e liberar WhatsApp</button><button type="button" class="btn btn-sec" data-recusar>Recusar</button></div>' : ""}
        ${pd.status === "aceito" ? '<div class="contato" data-contato><span>Contato liberado. Quando entregar o pet, marque a adoção como concluída na aba Pets.</span><button type="button" class="btn btn-sec" data-ver-contato>Ver WhatsApp</button></div>' : ""}
      </article>`;
    }).join("");
  }
  $("lista-pedidos-ong").addEventListener("click", async (e) => {
    const card = e.target.closest("[data-pedido]"); if (!card) return;
    const id = card.dataset.pedido;
    if (e.target.closest("[data-aceitar]") || e.target.closest("[data-recusar]")) {
      const aceitar = !!e.target.closest("[data-aceitar]");
      if (!aceitar && !confirm("Recusar este pedido? A pessoa recebe um aviso gentil por e-mail.")) return;
      e.target.disabled = true;
      const r = await sb.rpc("responder_pedido", { p_pedido: id, p_aceitar: aceitar });
      if (r.error) { e.target.disabled = false; toast(C.traduzir(r.error)); return; }
      toast(aceitar ? "Pedido aceito! O WhatsApp foi liberado para os dois lados." : "Pedido recusado.");
      await carregarPedidos(); carregarPets();
    } else if (e.target.closest("[data-ver-contato]")) {
      const r = await sb.rpc("contato_pedido", { p_pedido: id });
      if (r.error || !r.data) { toast("Não deu para abrir o contato agora."); return; }
      const box = card.querySelector("[data-contato]");
      box.innerHTML = `<span>${esc(r.data.nome)}: ${esc(A.formatarWhatsapp(r.data.whatsapp))}</span><a class="btn" href="${esc(A.linkWhatsapp(r.data.whatsapp, "Olá! Vi seu pedido de adoção no Abanô."))}" target="_blank" rel="noopener">Abrir no WhatsApp</a>`;
    }
  });
})();
