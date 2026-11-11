/* Abanô — Perfil do pet com QR Code.
   ?c=CODIGO  → página de quem escaneou a plaquinha (pública)
   ?pet=ID    → tela do tutor: ativar, escolher o que mostrar e baixar a plaquinha
   sem nada   → explicação e atalho para os pets do tutor
   Depende de supabase-js, lista.js, conta.js e qrcode-generator. */
(() => {
  "use strict";
  const app = document.getElementById("qr-centro");
  const C = window.abanoConta;
  if (!app || !C) return;
  const sb = C.sb;
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PASTA = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const fotoOk = (u) => String(u || "").indexOf(PASTA) === 0;
  const ESPECIES = { cachorro: "Cachorro", gato: "Gato", ave: "Ave", pequeno_mamifero: "Pequeno mamífero", reptil: "Réptil", peixe: "Peixe", outro: "Outro" };
  const SEXOS = { macho: "Macho", femea: "Fêmea" };
  const linkQR = (codigo) => "https://abano.com.br/perfil-qr.html?c=" + codigo;
  const zapNum = (n) => { let d = String(n || "").replace(/\D/g, ""); if (d.length <= 11) d = "55" + d; return d; };
  const zapFmt = (n) => { const d = String(n || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""); return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d; };
  const ICO = {
    zap: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.7-1.2.2-.6.2-1 .1-1.1l-.5-.3z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    saude: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    pata: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="6" cy="10" rx="2.2" ry="2.7"/><ellipse cx="10" cy="6" rx="2.2" ry="2.8"/><ellipse cx="14.5" cy="6" rx="2.2" ry="2.8"/><ellipse cx="18.4" cy="10" rx="2.2" ry="2.7"/><path d="M12.2 11.5c2.6 0 5.3 3.4 5.3 5.8 0 1.9-1.5 2.7-3 2.7-1 0-1.6-.5-2.3-.5s-1.4.5-2.4.5c-1.5 0-3-.8-3-2.7 0-2.4 2.8-5.8 5.4-5.8z"/></svg>',
    baixar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>'
  };
  let tt;
  function toast(m) { const t = $("toast-qr"); t.textContent = m; t.classList.add("ver"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("ver"), 3200); }
  function semIndice() { const m = document.createElement("meta"); m.name = "robots"; m.content = "noindex"; document.head.appendChild(m); }
  const foto = (p, cls) => `<span class="${cls}">${fotoOk(p.foto_url) ? `<img src="${esc(p.foto_url)}" alt="">` : esc(String(p.nome || "?").charAt(0).toUpperCase())}</span>`;

  // ---------- QR Code (desenho em canvas) ----------
  function matrizQR(texto) {
    const qr = window.qrcode(0, "M");
    qr.addData(texto);
    qr.make();
    return qr;
  }
  function desenharQR(ctx, qr, x, y, tamanho, cor) {
    const n = qr.getModuleCount(), m = tamanho / n;
    ctx.fillStyle = cor;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * m), Math.floor(y + r * m), Math.ceil(m), Math.ceil(m));
  }
  function retRed(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function carregarImg(src) { return new Promise((ok, falha) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = falha; i.src = src; }); }

  async function plaquinha(pet, codigo, soQR) {
    if (document.fonts) await document.fonts.ready;
    const qr = matrizQR(linkQR(codigo));
    const c = document.createElement("canvas"), ctx = c.getContext("2d");
    if (soQR) {
      c.width = c.height = 1200;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1200, 1200);
      desenharQR(ctx, qr, 80, 80, 1040, "#2B1622");
      return c;
    }
    const W = 1000, H = 1400; c.width = W; c.height = H;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#D10F5E"); g.addColorStop(1, "#FF8A1E");
    ctx.fillStyle = g; retRed(ctx, 0, 0, W, H, 90); ctx.fill();
    ctx.fillStyle = "#fff"; retRed(ctx, 50, 330, W - 100, H - 380, 60); ctx.fill();
    // Foto redonda no topo
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 250, 150, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.clip();
    if (fotoOk(pet.foto_url)) {
      try {
        const img = await carregarImg(pet.foto_url);
        const e = Math.max(290 / img.width, 290 / img.height);
        ctx.drawImage(img, W / 2 - img.width * e / 2, 250 - img.height * e / 2, img.width * e, img.height * e);
      } catch (err) {}
    } else {
      ctx.fillStyle = "#D10F5E"; ctx.font = "900 140px Nunito, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(pet.nome).charAt(0).toUpperCase(), W / 2, 258);
    }
    ctx.restore();
    ctx.lineWidth = 12; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2, 250, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "900 46px Nunito, Arial, sans-serif";
    ctx.fillText("ME ENCONTROU?", W / 2, 66);
    // Nome e QR
    ctx.fillStyle = "#2B1622"; ctx.font = "900 92px Nunito, Arial, sans-serif";
    let nome = String(pet.nome);
    while (ctx.measureText(nome).width > W - 180 && nome.length > 3) nome = nome.slice(0, -1);
    ctx.fillText(nome, W / 2, 500);
    desenharQR(ctx, qr, W / 2 - 300, 560, 600, "#2B1622");
    ctx.fillStyle = "#D10F5E"; ctx.font = "900 44px Nunito, Arial, sans-serif";
    ctx.fillText("Aponte a câmera e avise meu tutor", W / 2, 1240);
    ctx.fillStyle = "#6B5462"; ctx.font = "700 32px Nunito, Arial, sans-serif";
    ctx.fillText("abano.com.br  ·  código " + codigo, W / 2, 1300);
    return c;
  }
  async function baixar(canvas, nome) {
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------- Quem escaneou ----------
  async function telaPublica(codigo) {
    semIndice();
    $("qr-hero").hidden = true;
    app.innerHTML = '<p class="qr-carregando">Carregando…</p>';
    const r = await sb.rpc("perfil_qr", { p_codigo: codigo });
    const p = r.data && r.data[0];
    if (r.error || !p || !p.ativo) {
      app.innerHTML = `<div class="qr-vazio"><p><b>${p ? "Este perfil está desativado pelo tutor." : "Não encontramos este código."}</b> Se você encontrou um pet, publique um alerta: o tutor pode estar procurando por ele.</p>
        <a class="btn" href="perdidos.html?novo=encontrado">Encontrei um pet</a></div>`;
      return;
    }
    document.title = `Olá, eu sou ${p.nome}! | Abanô`;
    const ehFemea = p.sexo === "femea";
    const msg = `Olá! Encontrei ${ehFemea ? "a" : "o"} ${p.nome} (li o QR Code da plaquinha no Abanô). `;
    const info = [ESPECIES[p.especie], p.raca, p.idade, SEXOS[p.sexo]].filter(Boolean).join(" · ");
    app.innerHTML = `
      <article class="qr-pub">
        ${p.alerta ? `<a class="qr-perdido" href="perdidos.html?a=${p.alerta}"><b>Estou ${ehFemea ? "desaparecida" : "desaparecido"}!</b><span>Meu tutor está me procurando. Por favor, avise ele agora.</span></a>` : ""}
        ${foto(p, "qr-pub-foto")}
        <h1>Oi! Eu sou ${ehFemea ? "a" : "o"} <em>${esc(p.nome)}</em></h1>
        ${info ? `<p class="qr-pub-info">${esc(info)}</p>` : ""}
        ${p.mensagem ? `<p class="qr-pub-msg">“${esc(p.mensagem)}”</p>` : ""}
        <div class="qr-pub-acoes">
          ${p.whatsapp ? `
            <button type="button" class="btn btn-grande qr-zap" id="qr-local">${ICO.pin}Enviar onde estou ao tutor</button>
            <a class="btn btn-grande btn-sec" href="https://wa.me/${zapNum(p.whatsapp)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${ICO.zap}Chamar no WhatsApp</a>
            <p class="qr-pub-tel">WhatsApp do tutor: <b>${esc(zapFmt(p.whatsapp))}</b></p>` : `
            <a class="btn btn-grande" href="comunidade/?u=${encodeURIComponent(p.tutor_usuario)}">Ver o perfil de ${esc(p.tutor_nome)}</a>
            <a class="btn btn-grande btn-sec" href="perdidos.html?novo=encontrado">Publicar que encontrei</a>`}
        </div>
        ${p.saude ? `<div class="qr-pub-saude">${ICO.saude}<p><b>Cuidados importantes</b>${esc(p.saude)}</p></div>` : ""}
        <p class="qr-pub-tutor">${ICO.pata}<span>Meu tutor é ${esc(p.tutor_nome)}${p.cidade ? `, de ${esc(p.cidade)}${p.estado ? " / " + esc(p.estado) : ""}` : ""}.</span></p>
        <p class="qr-pub-dica">Se puder, ofereça água e mantenha ${ehFemea ? "ela" : "ele"} em um lugar seguro até o tutor chegar. Obrigado!</p>
      </article>`;
    const bl = $("qr-local");
    if (bl) bl.addEventListener("click", () => {
      const abrir = (texto) => { location.href = "https://wa.me/" + zapNum(p.whatsapp) + "?text=" + encodeURIComponent(texto); };
      if (!navigator.geolocation) { abrir(msg); return; }
      bl.disabled = true; bl.textContent = "Pegando a localização…";
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude.toFixed(6), lng = pos.coords.longitude.toFixed(6);
        abrir(msg + "Estou aqui: https://maps.google.com/?q=" + lat + "," + lng);
      }, () => { abrir(msg + "Estou em: (escreva o endereço ou ponto de referência)"); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
  }

  // ---------- Tela do tutor ----------
  async function sessaoEu() {
    const s = await sb.auth.getSession();
    if (!s.data.session) return null;
    const r = await sb.rpc("minha_conta");
    return r.error ? null : r.data;
  }
  async function telaTutor(petId) {
    semIndice();
    $("qr-hero").hidden = true;
    const eu = await sessaoEu();
    if (!eu) { location.href = "entrar.html?volta=" + encodeURIComponent(location.pathname + location.search); return; }
    if (!eu.aceitou) { location.href = "conta.html?volta=" + encodeURIComponent(location.pathname + location.search); return; }
    app.innerHTML = '<p class="qr-carregando">Carregando…</p>';
    const [rp, rq] = await Promise.all([
      sb.from("pets").select("id,nome,especie,raca,sexo,foto_url,dono").eq("id", petId).maybeSingle(),
      sb.from("pets_qr").select("*").eq("pet", petId).maybeSingle()
    ]);
    const pet = rp.data;
    if (!pet || pet.dono !== eu.id) { app.innerHTML = '<div class="qr-vazio"><p><b>Pet não encontrado.</b> Escolha um dos seus pets em Minha conta.</p><a class="btn" href="conta.html#pets">Meus pets</a></div>'; return; }
    if (rq.error && /pets_qr/.test(rq.error.message || "")) { app.innerHTML = '<div class="qr-vazio"><p><b>Quase pronto!</b> Falta ativar o Perfil QR no banco de dados do Abanô (arquivo pets_qr.sql).</p></div>'; return; }
    let qr = rq.data;
    const f = (k, pad) => esc(qr ? (qr[k] == null ? "" : qr[k]) : (pad || ""));
    const msgPadrao = `Se eu estiver sozinh${pet.sexo === "femea" ? "a" : "o"} na rua, estou perdid${pet.sexo === "femea" ? "a" : "o"}. Por favor, avise meu tutor!`;
    app.innerHTML = `
      <a class="qr-voltar" href="conta.html#pets">‹ Meus pets</a>
      <div class="qr-gerencia">
        <section class="qr-cartao">
          <div class="qr-cab">${foto(pet, "qr-mini")}<div><h1>Perfil QR de ${esc(pet.nome)}</h1><p>${qr ? (qr.ativo ? '<span class="qr-on">Ativo</span>' : '<span class="qr-off">Desativado</span>') + " · código " + esc(qr.codigo) : "Ainda não ativado"}</p></div></div>
          <form id="qr-form" novalidate>
            <label class="qr-check"><input type="checkbox" id="q-zap-on"${!qr || qr.whatsapp ? " checked" : ""}><span><b>Mostrar meu WhatsApp</b> para quem escanear poder me chamar e enviar a localização. É o jeito mais rápido de o pet voltar.</span></label>
            <div id="q-zap-linha"${qr && !qr.whatsapp ? " hidden" : ""}><label class="rot" for="q-zap">WhatsApp com DDD</label><input id="q-zap" inputmode="tel" maxlength="20" value="${esc(qr && qr.whatsapp ? zapFmt(qr.whatsapp) : "")}" placeholder="(21) 99999-9999"></div>
            <label class="rot" for="q-msg">Recado para quem encontrar <span class="opcional">(opcional)</span></label>
            <textarea id="q-msg" maxlength="300" rows="2">${f("mensagem", msgPadrao)}</textarea>
            <label class="rot" for="q-saude">Cuidados importantes <span class="opcional">(opcional)</span></label>
            <textarea id="q-saude" maxlength="300" rows="2" placeholder="Ex.: toma remédio para o coração; é alérgico a frango; é surdo.">${f("saude")}</textarea>
            <label class="qr-check"><input type="checkbox" id="q-cidade"${!qr || qr.mostrar_cidade ? " checked" : ""}><span>Mostrar a cidade e o estado do meu perfil</span></label>
            ${qr ? `<label class="qr-check"><input type="checkbox" id="q-ativo"${qr.ativo ? " checked" : ""}><span><b>Perfil QR ativo.</b> Desmarque para esconder tudo de quem escanear (a plaquinha continua valendo se você ativar de novo).</span></label>` : ""}
            <p class="aviso-conta" id="q-aviso" role="alert" hidden></p>
            <button type="submit" class="btn btn-grande">${qr ? "Salvar" : "Ativar o Perfil QR"}</button>
          </form>
        </section>
        <section class="qr-placa" id="qr-placa"${qr ? "" : " hidden"}>
          <h2>Plaquinha para imprimir</h2>
          <div class="qr-previa" id="qr-previa"></div>
          <div class="qr-botoes">
            <button type="button" class="btn" id="qr-baixar">${ICO.baixar}Baixar plaquinha</button>
            <button type="button" class="btn btn-sec" id="qr-baixar-so">${ICO.baixar}Só o QR Code</button>
            <button type="button" class="qr-acao" id="qr-copiar">${ICO.link}Copiar link</button>
            <a class="qr-acao" id="qr-ver" href="#" target="_blank" rel="noopener">Ver como fica</a>
          </div>
          <ul class="qr-dicas">
            <li>Imprima em adesivo resistente à água e cole numa plaquinha, ou leve o arquivo a uma loja de gravação.</li>
            <li>Teste com a câmera do celular antes de prender na coleira.</li>
            <li>Mantenha o WhatsApp sempre atualizado aqui: a plaquinha não muda.</li>
          </ul>
        </section>
      </div>`;
    const atualizarPlaca = async () => {
      if (!qr) return;
      $("qr-placa").hidden = false;
      $("qr-ver").href = "perfil-qr.html?c=" + qr.codigo;
      const c = await plaquinha(pet, qr.codigo);
      c.className = "qr-canvas"; c.setAttribute("role", "img"); c.setAttribute("aria-label", "Plaquinha com o QR Code de " + pet.nome);
      $("qr-previa").innerHTML = ""; $("qr-previa").appendChild(c);
    };
    $("q-zap-on").addEventListener("change", (e) => { $("q-zap-linha").hidden = !e.target.checked; });
    $("qr-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const aviso = $("q-aviso"), botao = e.target.querySelector("[type=submit]");
      const erro = (m) => { aviso.textContent = m; aviso.hidden = false; botao.disabled = false; };
      aviso.hidden = true;
      const zap = $("q-zap-on").checked ? $("q-zap").value.replace(/\D/g, "") : "";
      if ($("q-zap-on").checked && (zap.length < 10 || zap.length > 13)) return erro("Digite o WhatsApp com DDD, só números.");
      const dados = { whatsapp: zap || null, mensagem: $("q-msg").value.trim() || null, saude: $("q-saude").value.trim() || null, mostrar_cidade: $("q-cidade").checked };
      if ($("q-ativo")) dados.ativo = $("q-ativo").checked;
      botao.disabled = true;
      const r = qr ? await sb.from("pets_qr").update(dados).eq("pet", pet.id).select("*").single()
                   : await sb.from("pets_qr").insert(Object.assign({ pet: pet.id, dono: eu.id }, dados)).select("*").single();
      if (r.error) return erro(C.traduzir(r.error));
      const novo = !qr; qr = r.data;
      toast(novo ? "Perfil QR ativado! Agora baixe a plaquinha." : "Salvo.");
      botao.disabled = false; botao.textContent = "Salvar";
      telaTutor(pet.id);
    });
    if (qr) {
      atualizarPlaca();
      const nomeArq = (sufixo) => "qr-" + pet.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-") + sufixo + ".png";
      $("qr-baixar").addEventListener("click", async () => { await baixar(await plaquinha(pet, qr.codigo), nomeArq("-plaquinha")); toast("Plaquinha baixada!"); });
      $("qr-baixar-so").addEventListener("click", async () => { await baixar(await plaquinha(pet, qr.codigo, true), nomeArq("")); toast("QR Code baixado!"); });
      $("qr-copiar").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(linkQR(qr.codigo)); toast("Link copiado!"); } catch (err) { prompt("Copie o link:", linkQR(qr.codigo)); }
      });
    }
  }

  // ---------- Explicação + meus pets ----------
  async function telaInicio() {
    const eu = await sessaoEu();
    if (!eu) { app.innerHTML = ""; return; }
    const r = await sb.from("pets").select("id,nome,especie,foto_url").eq("dono", eu.id).order("criado_em");
    const pets = r.data || [];
    app.innerHTML = `<section class="qr-meus"><h2>Seus pets</h2>${pets.length
      ? `<ul class="qr-lista">${pets.map((p) => `<li><a href="perfil-qr.html?pet=${p.id}">${foto(p, "qr-mini")}<span><b>${esc(p.nome)}</b><small>${esc(ESPECIES[p.especie] || "")}</small></span><span class="qr-ir">Criar ou ver o QR</span></a></li>`).join("")}</ul>`
      : '<div class="qr-vazio"><p><b>Você ainda não cadastrou pets.</b> Cadastre o primeiro e volte aqui para criar o QR.</p><a class="btn" href="conta.html#pets">Cadastrar meu pet</a></div>'}</section>`;
  }

  if (q.get("c")) telaPublica(q.get("c"));
  else if (q.get("pet")) telaTutor(q.get("pet"));
  else telaInicio();
})();
