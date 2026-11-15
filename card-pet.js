/* Abanô — "Compartilhar meu pet": o tutor escolhe um dos pets da conta e gera um
   card de apresentação (feed 1080x1350 ou stories 1080x1920) com a foto real,
   o nome e a assinatura do Abanô. Dá para baixar, compartilhar e publicar no feed.
   Depende de supabase-js, lista.js, conta.js e site.js (abanoMarca). */
(() => {
  "use strict";
  const app = document.getElementById("card-centro");
  const C = window.abanoConta;
  if (!app || !C) return;
  const sb = C.sb;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PASTA = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const fotoOk = (u) => String(u || "").indexOf(PASTA) === 0;
  const FORMATOS = { feed: { w: 1080, h: 1350, nome: "Feed" }, stories: { w: 1080, h: 1920, nome: "Stories" } };
  const COR = { creme: "#FBF4EE", vinho: "#5B1532", magenta: "#C8135F", rosa: "#F06A9A", laranja: "#FF8A1E" };
  let eu = null, pets = [], escolhido = null, formato = "feed", gerado = null, publicados = new Set();

  let tt;
  function toast(m) { const t = $("toast-card"); t.textContent = m; t.classList.add("ver"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("ver"), 3400); }
  try { publicados = new Set(JSON.parse(sessionStorage.getItem("abano-cards-publicados") || "[]")); } catch (e) {}
  const lembrarPublicado = (id) => { publicados.add(id); try { sessionStorage.setItem("abano-cards-publicados", JSON.stringify([...publicados])); } catch (e) {} };

  // ---------- Desenho ----------
  function carregarImg(src) {
    return new Promise((ok, falha) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = falha; i.src = src; });
  }
  function retRed(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // Mancha orgânica nos cantos (como a referência), em degradê suave
  function mancha(ctx, cx, cy, r, c1, c2, giro) {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(giro || 0); ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(-r, -r * 0.2);
    ctx.bezierCurveTo(-r, -r * 0.9, -r * 0.2, -r * 1.05, r * 0.35, -r * 0.8);
    ctx.bezierCurveTo(r * 0.95, -r * 0.55, r * 1.05, r * 0.25, r * 0.6, r * 0.7);
    ctx.bezierCurveTo(r * 0.15, r * 1.1, -r * 0.7, r * 0.95, -r * 0.95, r * 0.4);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // Recorte da foto: preenche o quadro e, em fotos verticais, puxa para cima (onde costuma estar o rosto)
  function desenharFoto(ctx, img, x, y, w, h) {
    const esc2 = Math.max(w / img.width, h / img.height);
    const iw = img.width * esc2, ih = img.height * esc2;
    const dx = x + (w - iw) / 2;
    const sobra = ih - h;
    const dy = y - (img.height > img.width * 1.05 ? sobra * 0.28 : sobra / 2);
    ctx.drawImage(img, dx, dy, iw, ih);
  }
  function caberTexto(ctx, texto, fonte, max, larg) {
    let t = max;
    do { ctx.font = fonte.replace("{t}", t); t -= 4; } while (ctx.measureText(texto).width > larg && t > 40);
    return t + 4;
  }
  async function gerarCard(pet, fmt) {
    const { w: W, h: H } = FORMATOS[fmt];
    const st = fmt === "stories";
    if (document.fonts) {
      try { await Promise.all([document.fonts.load('700 120px "Dancing Script"'), document.fonts.load("800 40px Nunito"), document.fonts.load("italic 600 30px Nunito")]); } catch (e) {}
    }
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    // Fundo creme e as duas manchas suaves (magenta em cima, laranja embaixo)
    ctx.fillStyle = COR.creme; ctx.fillRect(0, 0, W, H);
    mancha(ctx, -40, -30, 250, COR.magenta, COR.rosa, 0.3);
    mancha(ctx, W + 30, H + 20, 270, "#FFB347", COR.laranja, 2.6);
    ctx.globalAlpha = 0.9; mancha(ctx, -60, H + 40, 170, COR.magenta, "#E0397A", -0.4); ctx.globalAlpha = 1;
    // Marca no topo
    const topo = st ? 120 : 64;
    if (window.abanoMarca) await window.abanoMarca.desenhar(ctx, W / 2, topo, st ? 92 : 80, { alinhar: "centro" });
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = COR.vinho;
    ctx.font = "700 " + (st ? 32 : 28) + "px Nunito, Arial, sans-serif";
    const yComu = topo + (st ? 130 : 112);
    ctx.fillText("Comunidade Pet", W / 2, yComu);
    const lc = ctx.measureText("Comunidade Pet").width / 2 + 22;
    ctx.strokeStyle = COR.vinho; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.moveTo(W / 2 - lc - 46, yComu); ctx.lineTo(W / 2 - lc, yComu); ctx.moveTo(W / 2 + lc, yComu); ctx.lineTo(W / 2 + lc + 46, yComu); ctx.stroke();
    // Foto: protagonista, com cantos bem arredondados, borda branca e sombra delicada
    const fx = 80, fw = W - 160, fy = st ? 340 : 222, fh = st ? 1000 : 720, raio = 64;
    ctx.save(); ctx.shadowColor = "rgba(91,21,50,.22)"; ctx.shadowBlur = 44; ctx.shadowOffsetY = 18;
    ctx.fillStyle = "#fff"; retRed(ctx, fx - 14, fy - 14, fw + 28, fh + 28, raio + 12); ctx.fill(); ctx.restore();
    ctx.save(); retRed(ctx, fx, fy, fw, fh, raio); ctx.clip();
    ctx.fillStyle = "#F3E3E8"; ctx.fillRect(fx, fy, fw, fh);
    const img = await carregarImg(pet.foto_url);
    desenharFoto(ctx, img, fx, fy, fw, fh);
    ctx.restore();
    // Nome em letra cursiva, com um traço laranja embaixo
    const yNome = fy + fh + (st ? 150 : 118);
    const tam = caberTexto(ctx, pet.nome, '700 {t}px "Dancing Script", "Segoe Script", cursive', st ? 170 : 140, W - 180);
    ctx.fillStyle = COR.vinho; ctx.textBaseline = "alphabetic";
    ctx.fillText(pet.nome, W / 2, yNome);
    const ln = Math.min(ctx.measureText(pet.nome).width, W - 240) / 2 + 30;
    ctx.strokeStyle = COR.laranja; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath();
    ctx.moveTo(W / 2 - ln, yNome + tam * 0.2); ctx.quadraticCurveTo(W / 2, yNome + tam * 0.12, W / 2 + ln, yNome + tam * 0.24); ctx.stroke();
    // Frase, assinatura e site
    ctx.textBaseline = "middle";
    const yFrase = yNome + (st ? 112 : 84);
    ctx.font = "800 " + (st ? 46 : 40) + "px Nunito, Arial, sans-serif"; ctx.fillStyle = COR.magenta;
    ctx.fillText("Agora faço parte do Abanô!", W / 2, yFrase);
    const yAss = st ? H - 210 : H - 118;
    ctx.font = "italic 600 " + (st ? 34 : 29) + "px Nunito, Arial, sans-serif"; ctx.fillStyle = COR.vinho;
    ctx.fillText("O universo pet em um só lugar.", W / 2, yAss);
    ctx.font = "800 " + (st ? 34 : 30) + "px Nunito, Arial, sans-serif";
    const site = "abano.com.br", sw = ctx.measureText(site).width + 64, sh = st ? 70 : 60, sy = yAss + (st ? 50 : 40);
    ctx.fillStyle = "rgba(255,255,255,.75)"; retRed(ctx, W / 2 - sw / 2, sy, sw, sh, sh / 2); ctx.fill();
    ctx.strokeStyle = COR.laranja; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = COR.vinho; ctx.fillText(site, W / 2, sy + sh / 2 + 1);
    return c;
  }
  const nomeArquivo = (pet, fmt) => "abano-" + String(pet.nome).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + fmt + ".jpg";
  const paraArquivo = (canvas, nome) => new Promise((ok, falha) => canvas.toBlob((b) => b ? ok(new File([b], nome, { type: "image/jpeg" })) : falha(new Error("Não deu para gerar a imagem.")), "image/jpeg", 0.92));

  // ---------- Telas ----------
  async function telaEscolha() {
    escolhido = escolhido || null;
    const fotoDe = (p) => fotoOk(p.foto_url) ? `<img src="${esc(p.foto_url)}" alt="" loading="lazy">` : `<span class="card-sem-foto">${esc(String(p.nome).charAt(0).toUpperCase())}</span>`;
    app.innerHTML = `<section class="card-escolha" aria-labelledby="card-t">
      <h1 id="card-t">Qual pet vamos apresentar ao mundo?</h1>
      <p class="card-sub">Escolha um pet e o Abanô monta um card bonito com a foto dele, pronto para o feed, os stories e o WhatsApp.</p>
      <div class="card-grade" role="radiogroup" aria-label="Seus pets">${pets.map((p) => `
        <label class="card-pet${fotoOk(p.foto_url) ? "" : " sem-foto"}">
          <input type="radio" name="pet" value="${esc(p.id)}"${escolhido && escolhido.id === p.id ? " checked" : ""}>
          <span class="card-pet-foto">${fotoDe(p)}<span class="card-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12.5 4 4L18 8"/></svg></span></span>
          <b>${esc(p.nome)}</b>
          ${fotoOk(p.foto_url) ? "" : '<small>Sem foto ainda</small>'}
        </label>`).join("")}
      </div>
      <p class="aviso-conta" id="card-aviso" role="alert" hidden></p>
      <div class="card-botoes"><button type="button" class="btn btn-grande" id="card-criar" disabled>Criar meu card</button></div>
    </section>`;
    const botao = $("card-criar"), aviso = $("card-aviso");
    const atualizar = () => {
      const v = (app.querySelector('input[name="pet"]:checked') || {}).value;
      escolhido = pets.find((p) => p.id === v) || null;
      botao.disabled = !escolhido;
      if (escolhido && !fotoOk(escolhido.foto_url)) {
        aviso.innerHTML = `${esc(escolhido.nome)} ainda não tem foto. <a href="conta.html#pets">Adicione uma foto em Meus pets</a> para criar o card.`;
        aviso.hidden = false; botao.disabled = true;
      } else aviso.hidden = true;
    };
    app.querySelectorAll('input[name="pet"]').forEach((r) => r.addEventListener("change", atualizar));
    atualizar();
    botao.addEventListener("click", () => { if (escolhido) telaPrevia(); });
  }

  async function telaPrevia() {
    const pet = escolhido;
    history.replaceState(null, "", "card-pet.html?pet=" + encodeURIComponent(pet.id));
    app.innerHTML = `<section class="card-previa-tela" aria-labelledby="card-pt">
      <button type="button" class="card-voltar" id="card-voltar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Escolher outro pet</span></button>
      <h1 id="card-pt">O card de ${esc(pet.nome)}</h1>
      <div class="card-formatos" role="group" aria-label="Formato do card">
        ${Object.keys(FORMATOS).map((k) => `<button type="button" data-formato="${k}" aria-pressed="${k === formato}">${FORMATOS[k].nome}<small>${FORMATOS[k].w}×${FORMATOS[k].h}</small></button>`).join("")}
      </div>
      <div class="card-palco ${formato}" id="card-palco"><p class="card-gerando">Criando o card…</p></div>
      <div class="card-acoes">
        <button type="button" class="btn" id="card-baixar" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>Baixar imagem</button>
        <button type="button" class="btn btn-sec" id="card-partilhar" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2v-6"/></svg>Compartilhar</button>
        <button type="button" class="btn btn-sec" id="card-publicar" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16M4 12h16M4 18.5h10"/></svg>Publicar no feed do Abanô</button>
      </div>
      <p class="card-nota" id="card-nota">Nada é publicado sem você tocar em "Publicar no feed". Baixar e compartilhar não postam nada no Abanô.</p>
    </section>`;
    $("card-voltar").addEventListener("click", () => { history.replaceState(null, "", "card-pet.html"); telaEscolha(); window.scrollTo(0, 0); });
    app.querySelectorAll("[data-formato]").forEach((b) => b.addEventListener("click", () => {
      formato = b.dataset.formato;
      app.querySelectorAll("[data-formato]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      desenhar();
    }));
    const botoes = ["card-baixar", "card-partilhar", "card-publicar"].map($);
    async function desenhar() {
      const palco = $("card-palco");
      palco.className = "card-palco " + formato;
      palco.innerHTML = '<p class="card-gerando">Criando o card…</p>';
      botoes.forEach((b) => { b.disabled = true; });
      try {
        const c = await gerarCard(pet, formato);
        gerado = { canvas: c, formato };
        const img = new Image();
        img.alt = "Card de " + pet.nome + " no formato " + FORMATOS[formato].nome;
        img.src = c.toDataURL("image/jpeg", 0.9);
        palco.innerHTML = ""; palco.appendChild(img);
        botoes.forEach((b) => { b.disabled = false; });
        marcarPublicado();
      } catch (e) {
        palco.innerHTML = `<p class="card-gerando">Não deu para abrir a foto de ${esc(pet.nome)}. Confira a conexão e tente de novo, ou troque a foto em <a href="conta.html#pets">Meus pets</a>.</p>`;
      }
    }
    function marcarPublicado() {
      const b = $("card-publicar");
      if (publicados.has(pet.id)) { b.disabled = true; b.lastChild.textContent = "Publicado no feed"; }
    }
    $("card-baixar").addEventListener("click", async () => {
      const arq = await paraArquivo(gerado.canvas, nomeArquivo(pet, gerado.formato));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(arq); a.download = arq.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Card baixado! Agora é só postar.");
    });
    $("card-partilhar").addEventListener("click", async () => {
      const arq = await paraArquivo(gerado.canvas, nomeArquivo(pet, gerado.formato));
      const texto = `${pet.nome} agora faz parte do Abanô! 🐾 abano.com.br`;
      if (navigator.canShare && navigator.canShare({ files: [arq] })) {
        try { await navigator.share({ files: [arq], text: texto }); } catch (e) {}
        return;
      }
      // Sem compartilhamento de arquivos (computador): baixa a imagem e abre o WhatsApp com o texto
      $("card-baixar").click();
      window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank", "noopener");
    });
    $("card-publicar").addEventListener("click", async () => {
      if (publicados.has(pet.id)) return;
      const b = $("card-publicar"); b.disabled = true; b.lastChild.textContent = "Publicando…";
      try {
        // No feed vai sempre o formato 4:5, o que fica melhor entre as outras publicações
        const c = gerado.formato === "feed" ? gerado.canvas : await gerarCard(pet, "feed");
        const arq = await paraArquivo(c, nomeArquivo(pet, "feed"));
        const url = await C.enviarFoto(eu.id, "card", arq);
        const r = await sb.from("posts").insert({ autor: eu.id, tipo: "foto", texto: `Apresento a vocês: ${pet.nome}! 🐾 Agora faço parte do Abanô.`, fotos: [url] }).select("id").single();
        if (r.error) { C.apagarFoto(url); throw r.error; }
        lembrarPublicado(pet.id);
        b.lastChild.textContent = "Publicado no feed";
        $("card-nota").innerHTML = `Publicado! <a href="comunidade/?p=${encodeURIComponent(r.data.id)}">Ver no feed da Comunidade</a>`;
        toast("Publicado no feed do Abanô!");
      } catch (e) {
        b.disabled = false; b.lastChild.textContent = "Publicar no feed do Abanô";
        toast(e && e.code ? C.traduzir(e) : (e && e.message) || "Não deu para publicar agora.");
      }
    });
    desenhar();
  }

  // ---------- Início ----------
  (async function iniciar() {
    const s = await sb.auth.getSession();
    if (!s.data.session) {
      app.innerHTML = `<div class="card-vazio"><h1>Qual pet vamos apresentar ao mundo?</h1><p>Entre na sua conta para criar o card do seu pet.</p><a class="btn" href="entrar.html?volta=${encodeURIComponent("/card-pet.html")}">Entrar</a> <a class="btn btn-sec" href="cadastro.html?volta=${encodeURIComponent("/card-pet.html")}">Criar conta grátis</a></div>`;
      return;
    }
    const r = await sb.rpc("minha_conta");
    if (r.error) { app.innerHTML = `<p class="aviso-conta">${esc(C.traduzir(r.error))}</p>`; return; }
    eu = r.data;
    if (!eu.aceitou) { location.replace("conta.html?volta=" + encodeURIComponent("/card-pet.html")); return; }
    const p = await sb.from("pets").select("id,nome,foto_url,criado_em").eq("dono", eu.id).order("criado_em");
    pets = p.data || [];
    if (!pets.length) {
      app.innerHTML = `<div class="card-vazio"><h1>Qual pet vamos apresentar ao mundo?</h1><p>Você ainda não cadastrou nenhum pet. Cadastre o primeiro, com uma foto bem bonita, e volte aqui para criar o card dele.</p><a class="btn" href="conta.html#pets">Cadastrar meu pet</a></div>`;
      return;
    }
    const pedido = new URLSearchParams(location.search).get("pet");
    escolhido = pets.find((x) => x.id === pedido) || (pets.length === 1 ? pets[0] : null);
    if (escolhido && fotoOk(escolhido.foto_url) && pedido) telaPrevia(); else telaEscolha();
  })();
})();
