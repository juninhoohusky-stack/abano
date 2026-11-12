/* Abanô — Comunidade (feed, publicações, clubes, perfis).
   Leitura aberta para todos; ações (curtir, comentar, publicar, votar,
   salvar, seguir, participar) pedem conta e voltam para a ação depois do login.
   Depende de supabase-js, lista.js e conta.js (window.abanoConta). */
(() => {
  "use strict";
  const C = window.abanoConta;
  const centro = document.getElementById("com-centro");
  if (!C || !centro) return;
  const sb = C.sb;
  const q = new URLSearchParams(location.search);
  const POR_PAGINA = 15;
  const SEL = "*, perfil:perfis!posts_autor_fkey(id,usuario,nome,foto_url), clube_info:clubes!posts_clube_fkey(id,nome)";
  const PASTA_FOTOS = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const est = { admin: false, fixados: new Map(), sessao: null, eu: null, curtidas: new Set(), salvos: new Set(), votos: new Map(), clubes: new Set(), seguindo: new Set(), bloqueados: new Set(), posts: new Map(), previas: new Map() };

  // ---------- Utilidades ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Number(n || 0).toLocaleString("pt-BR");
  const plural = (n, um, varios) => num(n) + " " + (Number(n) === 1 ? um : varios);
  const aqui = () => location.pathname + location.search;
  const linkPost = (id) => "comunidade/?p=" + encodeURIComponent(id);
  const linkPerfil = (u) => "comunidade/?u=" + encodeURIComponent(u);
  const linkClube = (c) => "comunidade/?c=" + encodeURIComponent(c);

  function tempo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return "há " + Math.floor(s / 60) + " min";
    if (s < 86400) return "há " + Math.floor(s / 3600) + " h";
    if (s < 86400 * 7) { const d = Math.floor(s / 86400); return "há " + d + (d === 1 ? " dia" : " dias"); }
    return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  }
  function avatar(perfil, classe) {
    if (!perfil) return `<span class="av av-vazio ${classe || ""}" aria-hidden="true"><img src="logo-pata.svg" alt="" width="30" height="30"></span>`;
    const p = perfil;
    const fotoOk = p.foto_url && String(p.foto_url).indexOf(PASTA_FOTOS) === 0;
    return `<span class="av ${classe || ""}" aria-hidden="true">${fotoOk ? `<img src="${esc(p.foto_url)}" alt="" loading="lazy">` : esc((p.nome || "?").trim().charAt(0).toUpperCase())}</span>`;
  }
  const ICONE = {
    curtir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1z"/></svg>',
    comentar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V17h0A2.5 2.5 0 0 1 4 14.5z"/></svg>',
    salvar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z"/></svg>',
    compartilhar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2v-6"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
    mensagem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.5a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.4-4.4A8.5 8.5 0 1 1 20.5 11.5z"/></svg>',
    verificado: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" fill="currentColor"/><path d="m8.4 12.2 2.4 2.4 4.8-4.9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("ver");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("ver"), 3200);
  }
  function erroMsg(e) { return C.traduzir(e); }

  function definirMeta(titulo, descricao, canonico) {
    document.title = titulo;
    const d = document.querySelector('meta[name="description"]');
    if (d && descricao) d.setAttribute("content", descricao);
    const c = document.querySelector('link[rel="canonical"]');
    if (c && canonico) c.setAttribute("href", "https://abano.com.br/" + canonico);
    const ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute("content", titulo);
  }

  // Mesma regra do banco: só anúncios explícitos de venda de animais
  function pareceVenda(t) {
    return /(filhote|ninhada|cachorr|cadel|\bgat[oa]s?\b|gatinh|husky|huskies|golden|spitz|lulu|labrador|\bpets?\b|\bc[ãa]es\b|\bc[ãa]o\b)/i.test(t)
      && /(\bvende-se\b|\bvendem-se\b|[àa] venda\b|\bvendo ([0-9]+ )?(filhote|ninhada|cachorrinh|gatinh))/i.test(t);
  }

  // ---------- Login para agir (com volta para a ação) ----------
  const CHAVE_ACAO = "abano-acao";
  function exigir(acao) {
    if (est.eu && est.eu.suspenso && acao && acao.tipo !== "denunciar") {
      toast("Sua conta está suspensa pela moderação. Escreva para contato@abano.com.br se achar que foi um engano.");
      return false;
    }
    if (est.sessao && est.eu && est.eu.aceitou && est.eu.estado) return true;
    if (est.sessao && est.eu && (!est.eu.aceitou || !est.eu.estado)) {
      guardarAcao(acao);
      location.href = "conta.html?volta=" + encodeURIComponent(aqui());
      return false;
    }
    guardarAcao(acao);
    abrirLogin(acao);
    return false;
  }
  function guardarAcao(acao) {
    try { localStorage.setItem(CHAVE_ACAO, JSON.stringify({ acao: acao, url: aqui(), ts: Date.now() })); } catch (e) {}
  }
  const TITULOS_LOGIN = {
    curtir: "Gostou dessa publicação?", comentar: "Quer participar da conversa?", salvar: "Quer guardar essa publicação?",
    votar: "Quer votar nessa enquete?", publicar: "Quer compartilhar com a comunidade?", participar: "Quer participar desse clube?",
    seguir: "Quer acompanhar esse tutor?", denunciar: "Viu algo errado?", bloquear: "Quer bloquear alguém?", salvos: "Quer ver suas publicações salvas?", perfil: "Quer montar seu perfil?",
    membros: "Quer conhecer os membros do clube?", mensagem: "Quer conversar com esse tutor?", mensagens: "Quer ver suas conversas?"
  };
  function abrirLogin(acao) {
    const d = document.getElementById("dialogo-login");
    const volta = encodeURIComponent(aqui());
    document.getElementById("login-titulo").textContent = (TITULOS_LOGIN[acao && acao.tipo] || "Gostou dessa publicação?") + " Entre para a Comunidade Abanô e participe da conversa!";
    document.getElementById("login-entrar").href = "entrar.html?volta=" + volta;
    document.getElementById("login-criar").href = "cadastro.html?volta=" + volta;
    d.showModal();
  }
  // "Agora não": esquece a ação guardada
  const dl = document.getElementById("dialogo-login");
  if (dl) dl.addEventListener("close", () => { try { localStorage.removeItem(CHAVE_ACAO); } catch (e) {} });
  function executarPendente() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(CHAVE_ACAO) || "null"); } catch (e) {}
    if (!p) return;
    if (!est.sessao || !est.eu || !est.eu.aceitou) return;
    try { localStorage.removeItem(CHAVE_ACAO); } catch (e) {}
    if (Date.now() - p.ts > 30 * 60 * 1000 || p.url !== aqui()) return;
    const a = p.acao || {};
    const alvo = () => centro.querySelector(`[data-acao="${a.tipo}"][data-id="${a.id}"]` + (a.opcao != null ? `[data-opcao="${a.opcao}"]` : ""));
    setTimeout(() => {
      if (a.tipo === "curtir" && !est.curtidas.has(a.id)) acoes.curtir(a.id);
      else if (a.tipo === "salvar" && !est.salvos.has(a.id)) acoes.salvar(a.id);
      else if (a.tipo === "votar") acoes.votar(a.id, a.opcao);
      else if (a.tipo === "participar" && !est.clubes.has(a.id)) acoes.participar(a.id);
      else if (a.tipo === "seguir" && !est.seguindo.has(a.id)) acoes.seguir(a.id);
      else if (a.tipo === "comentar") { const c = document.getElementById("comentario-texto"); if (c) c.focus(); }
      else if (a.tipo === "publicar") { const c = document.getElementById("compor-texto"); if (c) c.focus(); }
      const el = alvo(); if (el) el.scrollIntoView({ block: "center" });
    }, 400);
  }

  // ---------- Estado do usuário ----------
  async function carregarEu() {
    const s = await sb.auth.getSession();
    est.sessao = s.data.session;
    if (!est.sessao) return;
    const r = await sb.rpc("minha_conta");
    if (r.error) return;
    est.eu = await C.completarEstado(r.data);
    const [cl, sg, bl] = await Promise.all([
      sb.from("clube_membros").select("clube").eq("usuario", est.eu.id),
      sb.from("seguidores").select("seguido").eq("seguidor", est.eu.id),
      sb.from("bloqueios").select("bloqueado").eq("bloqueador", est.eu.id)
    ]);
    (bl.data || []).forEach((x) => est.bloqueados.add(x.bloqueado));
    (cl.data || []).forEach((x) => est.clubes.add(x.clube));
    (sg.data || []).forEach((x) => est.seguindo.add(x.seguido));
    const adm = await sb.rpc("eh_admin");
    est.admin = !adm.error && adm.data === true;
  }
  async function carregarMeusEstados(posts) {
    if (!est.eu || !posts.length) return;
    const ids = posts.map((p) => p.id);
    const enquetes = posts.filter((p) => p.tipo === "enquete").map((p) => p.id);
    const [c, s, v] = await Promise.all([
      sb.from("curtidas").select("post").eq("usuario", est.eu.id).in("post", ids),
      sb.from("salvos").select("post").eq("usuario", est.eu.id).in("post", ids),
      enquetes.length ? sb.from("enquete_votos").select("post,opcao").eq("usuario", est.eu.id).in("post", enquetes) : Promise.resolve({ data: [] })
    ]);
    (c.data || []).forEach((x) => est.curtidas.add(x.post));
    (s.data || []).forEach((x) => est.salvos.add(x.post));
    (v.data || []).forEach((x) => est.votos.set(x.post, x.opcao));
  }

  // ---------- Cartão de publicação ----------
  function idYoutube(url) {
    const m = String(url).match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function blocoVideo(p) {
    if (!p.video_url) return "";
    const yt = idYoutube(p.video_url);
    if (yt) return `<div class="video" data-yt="${esc(yt)}"><button type="button" class="video-play" data-acao="video" data-id="${esc(p.id)}"><span class="play" aria-hidden="true"></span>Assistir ao vídeo do YouTube</button></div>`;
    const rede = /tiktok/i.test(p.video_url) ? "TikTok" : "Instagram";
    return `<a class="video-link" href="${esc(p.video_url)}" target="_blank" rel="noopener nofollow ugc"><span class="play" aria-hidden="true"></span>Ver o vídeo no ${rede}</a>`;
  }
  function blocoFotos(p) {
    const fotos = (p.fotos || []).filter((f) => String(f).indexOf(PASTA_FOTOS) === 0);
    if (!fotos.length) return "";
    return `<div class="fotos n${fotos.length}">${fotos.map((f, i) => `<a href="${esc(f)}" data-galeria="${esc(p.id)}" data-i="${i}" aria-label="Ver foto ${i + 1} de ${fotos.length} em tela cheia"><img src="${esc(f)}" alt="Foto ${i + 1} da publicação de ${esc((p.perfil || {}).nome)}" loading="lazy" decoding="async"></a>`).join("")}</div>`;
  }
  function blocoEnquete(p) {
    if (p.tipo !== "enquete" || !p.opcoes) return "";
    const meu = est.votos.get(p.id);
    const ehMeu = est.eu && p.autor === est.eu.id;
    const mostrar = meu != null || ehMeu;
    const total = p.total_votos || 0;
    const itens = p.opcoes.map((o, i) => {
      const v = (p.votos || [])[i] || 0;
      const pct = total ? Math.round((v / total) * 100) : 0;
      if (mostrar) return `<li class="opc res${meu === i ? " minha" : ""}"><span class="barra" style="--p:${pct}%"></span><span class="txt">${esc(o)}${meu === i ? " <b>(seu voto)</b>" : ""}</span><span class="pct">${pct}%</span></li>`;
      return `<li><button type="button" class="opc" data-acao="votar" data-id="${esc(p.id)}" data-opcao="${i}">${esc(o)}</button></li>`;
    }).join("");
    return `<div class="enquete"><ul>${itens}</ul><p class="enq-total">${plural(total, "voto", "votos")}${mostrar ? "" : " · vote para ver o resultado"}</p></div>`;
  }
  function textoPost(p, completo) {
    if (!p.texto) return "";
    const limite = 480;
    if (completo || p.texto.length <= limite) return `<p class="txt">${esc(p.texto)}</p>`;
    return `<p class="txt">${esc(p.texto.slice(0, limite).replace(/\s+\S*$/, ""))}… <a href="${linkPost(p.id)}" class="ver-mais">ver mais</a></p>`;
  }
  function cartao(p, completo) {
    est.posts.set(p.id, p);
    const a = p.perfil || {};
    const curtido = est.curtidas.has(p.id), salvo = est.salvos.has(p.id);
    const ehMeu = est.eu && p.autor === est.eu.id;
    const pergunta = p.tipo === "pergunta", abano = p.especial === "adocao_abano", adotou = p.especial === "adocao_tutor";
    const autorHTML = abano
      ? `<a href="adocao.html" class="post-autor"><span class="av av-abano" aria-hidden="true"><img src="logo-pata.svg" alt="" width="30" height="30"></span><span><b>Abanô</b><small>Adoção concluída · <time datetime="${esc(p.criado_em)}">${tempo(p.criado_em)}</time></small></span></a>`
      : `<a href="${linkPerfil(a.usuario)}" class="post-autor">${avatar(a)}<span><b>${esc(a.nome || "Tutor")}</b><small>@${esc(a.usuario)} · <time datetime="${esc(p.criado_em)}">${tempo(p.criado_em)}</time>${p.editado_em ? " · editado" : ""}</small></span></a>`;
    return `<article class="post${pergunta ? " pergunta" : ""}${abano || adotou ? " post-adocao" : ""}" id="post-${esc(p.id)}" data-post="${esc(p.id)}" data-autor="${esc(p.autor)}">
      <header class="post-topo">
        ${autorHTML}
        ${p.clube_info ? `<a class="post-clube" href="${linkClube(p.clube_info.id)}">${esc(p.clube_info.nome)}</a>` : ""}
        <button type="button" class="post-mais" data-acao="opcoes" data-id="${esc(p.id)}" aria-label="${ehMeu ? "Opções da sua publicação" : "Mais opções: denunciar ou bloquear"}">${ICONE.mais}</button>
      </header>
      ${pergunta ? '<span class="selo-pergunta">Pergunta</span>' : ""}${abano || adotou ? `<span class="selo-adocao">${abano ? "Mais um pet adotado" : "Adotou pelo Abanô"}</span>` : ""}
      ${textoPost(p, completo)}
      ${blocoFotos(p)}${blocoVideo(p)}${blocoEnquete(p)}
      ${abano ? '<a class="post-cta" href="adocao.html">Conheça os pets que ainda esperam por uma família</a>' : ""}
      ${pergunta ? '<p class="nota-vet">Dúvida de saúde? A comunidade ajuda com experiências, mas só um veterinário pode examinar e tratar o seu pet. Em emergências, procure atendimento na hora.</p>' : ""}
      <footer class="post-acoes">
        <button type="button" class="acao${curtido ? " ativa" : ""}" data-acao="curtir" data-id="${esc(p.id)}" aria-pressed="${curtido}">${ICONE.curtir}<span>${p.total_curtidas ? num(p.total_curtidas) : ""}</span><span class="sr">Curtir</span></button>
        <a class="acao" href="${linkPost(p.id)}#comentarios" data-abrir-coment="${esc(p.id)}">${ICONE.comentar}<span>${p.total_comentarios ? num(p.total_comentarios) : ""}</span><span class="sr">${pergunta ? "Responder" : "Comentar"}</span></a>
        <button type="button" class="acao${salvo ? " ativa" : ""}" data-acao="salvar" data-id="${esc(p.id)}" aria-pressed="${salvo}">${ICONE.salvar}<span class="sr">Salvar</span></button>
        <button type="button" class="acao" data-acao="compartilhar" data-id="${esc(p.id)}">${ICONE.compartilhar}<span class="sr">Compartilhar</span></button>
      </footer>
      ${completo ? "" : blocoComentarios(p)}
    </article>`;
  }
  // Prévia dos comentários no feed: "Ver todos", os 2 mais recentes e o campo para comentar
  function blocoComentarios(p) {
    const n = p.total_comentarios || 0, pergunta = p.tipo === "pergunta";
    const previa = (est.previas.get(p.id) || []).filter((c) => !est.bloqueados.has(c.autor));
    const verTodos = n > previa.length
      ? `<a class="ver-coment" href="${linkPost(p.id)}#comentarios" data-abrir-coment="${esc(p.id)}">${n === 1 ? (pergunta ? "Ver 1 resposta" : "Ver 1 comentário") : `Ver ${n > 2 ? "todos os " : "os "}${num(n)} ${pergunta ? "respostas" : "comentários"}`}</a>` : "";
    const itens = previa.map((c) => `<li><a href="${linkPerfil((c.perfil || {}).usuario)}"><b>${esc((c.perfil || {}).nome || "Tutor")}</b></a> ${esc(c.texto)}</li>`).join("");
    const campo = est.eu && est.eu.aceitou
      ? `<form class="coment-rapido" data-post="${esc(p.id)}">${avatar(est.eu)}<label class="sr" for="cr-${esc(p.id)}">${pergunta ? "Sua resposta" : "Seu comentário"}</label><input id="cr-${esc(p.id)}" maxlength="2000" autocomplete="off" enterkeyhint="send" placeholder="${pergunta ? "Responda com a sua experiência…" : "Adicione um comentário…"}"><button type="submit" disabled>Publicar</button></form>`
      : `<button type="button" class="coment-rapido coment-login" data-acao="comentar-login" data-id="${esc(p.id)}">${avatar(null)}<span>${pergunta ? "Entre para responder…" : "Entre para comentar…"}</span></button>`;
    return `<div class="post-coment" data-coment="${esc(p.id)}">${verTodos}${itens ? `<ul class="previa-coment">${itens}</ul>` : ""}${campo}</div>`;
  }
  // Busca os comentários mais recentes dos posts que acabaram de aparecer no feed
  async function previasComentarios(posts) {
    const ids = posts.filter((p) => p.total_comentarios > 0).map((p) => p.id);
    if (!ids.length) return;
    const r = await sb.from("comentarios").select("*, perfil:perfis!comentarios_autor_fkey(usuario,nome)")
      .in("post", ids).order("criado_em", { ascending: false }).limit(Math.min(200, ids.length * 6));
    if (r.error || !r.data) return;
    const por = new Map();
    r.data.filter((c) => !c.resposta_a).forEach((c) => { const l = por.get(c.post) || []; if (l.length < 2) { l.push(c); por.set(c.post, l); } });
    por.forEach((l, id) => {
      est.previas.set(id, l.reverse());
      const p = est.posts.get(id);
      document.querySelectorAll(`[data-coment="${id}"]`).forEach((el) => { if (p) el.outerHTML = blocoComentarios(p); });
    });
  }
  function atualizarCartao(id) {
    const p = est.posts.get(id);
    document.querySelectorAll(`[data-post="${id}"]`).forEach((el) => {
      const completo = el.closest(".ver-post") != null;
      const novo = document.createElement("div");
      novo.innerHTML = cartao(p, completo);
      el.replaceWith(novo.firstElementChild);
    });
  }

  // ---------- Lista paginada (rolagem infinita com botão de reserva) ----------
  async function buscar(fonte, cursor) {
    let r;
    if (fonte.tipo === "em-alta") {
      r = await sb.rpc("feed_para_voce", { p_offset: cursor || 0, p_limite: POR_PAGINA }).select(SEL);
      return { erro: r.error, posts: r.data || [], proximo: (cursor || 0) + POR_PAGINA };
    }
    if (fonte.tipo === "seguindo") {
      r = await sb.rpc("feed_seguindo", { p_antes: cursor || null, p_limite: POR_PAGINA }).select(SEL);
    } else if (fonte.tipo === "salvos") {
      let s = sb.from("salvos").select("criado_em, post:posts(" + SEL + ")").eq("usuario", est.eu.id).order("criado_em", { ascending: false }).limit(POR_PAGINA);
      if (cursor) s = s.lt("criado_em", cursor);
      r = await s;
      const linhas = r.data || [];
      return { erro: r.error, posts: linhas.map((x) => x.post).filter(Boolean), proximo: linhas.length ? linhas[linhas.length - 1].criado_em : null, fim: linhas.length < POR_PAGINA };
    } else {
      let s = sb.from("posts").select(SEL).order("criado_em", { ascending: false }).limit(POR_PAGINA);
      if (fonte.tipo === "perguntas") s = s.eq("tipo", "pergunta");
      if (fonte.clube) s = s.eq("clube", fonte.clube);
      if (fonte.soPerguntas) s = s.eq("tipo", "pergunta");
      if (fonte.autor) s = s.eq("autor", fonte.autor);
      if (cursor) s = s.lt("criado_em", cursor);
      r = await s;
    }
    const todos = r.data || [];
    const posts = fonte.excluir ? todos.filter((x) => x.id !== fonte.excluir) : todos;
    return { erro: r.error, posts: posts, proximo: todos.length ? todos[todos.length - 1].criado_em : null, fim: todos.length < POR_PAGINA };
  }
  function lista(container, fonte, vazio) {
    container.innerHTML = '<div class="posts" aria-live="polite"></div><p class="carregando">Carregando publicações…</p><button type="button" class="btn btn-sec mais-posts" hidden>Carregar mais</button>';
    const caixa = container.querySelector(".posts"), msg = container.querySelector(".carregando"), botao = container.querySelector(".mais-posts");
    let cursor = null, ocupado = false, acabou = false, total = 0;
    async function proxima() {
      if (ocupado || acabou) return;
      ocupado = true; botao.hidden = true; msg.hidden = false; msg.textContent = "Carregando publicações…";
      const r = await buscar(fonte, cursor);
      ocupado = false; msg.hidden = true;
      if (r.erro) { msg.hidden = false; msg.textContent = "Não deu para carregar as publicações. Verifique sua internet e tente de novo."; botao.hidden = false; botao.textContent = "Tentar de novo"; return; }
      await carregarMeusEstados(r.posts);
      caixa.insertAdjacentHTML("beforeend", r.posts.map((p) => cartao(p)).join(""));
      previasComentarios(r.posts);
      total += r.posts.length;
      cursor = r.proximo;
      acabou = r.fim != null ? r.fim : r.posts.length < POR_PAGINA;
      if (!total) { caixa.innerHTML = vazio; return; }
      if (acabou) { msg.hidden = false; msg.textContent = "Você chegou ao fim."; }
      else { botao.hidden = false; botao.textContent = "Carregar mais"; }
    }
    botao.addEventListener("click", proxima);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((ent) => { if (ent[0].isIntersecting && !botao.hidden && !acabou) proxima(); }, { rootMargin: "600px" }).observe(botao);
    }
    proxima();
    return { inserirNoTopo: (p) => { if (caixa.querySelector(".vazio")) caixa.innerHTML = ""; caixa.insertAdjacentHTML("afterbegin", cartao(p)); } };
  }
  // Botão "Voltar": volta para a tela anterior da Comunidade; se a pessoa chegou
  // por um link de fora, leva para o lugar indicado (início da Comunidade ou clubes)
  const voltar = (destino) => `<a class="voltar" href="${destino || "comunidade/"}" data-voltar><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>Voltar</span></a>`;
  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-voltar]");
    if (!v) return;
    let veioDaComunidade = false;
    try { veioDaComunidade = new URL(document.referrer).origin === location.origin && /\/comunidade\//.test(new URL(document.referrer).pathname); } catch (err) {}
    if (veioDaComunidade && history.length > 1) { e.preventDefault(); history.back(); }
  });
  const vazio = (titulo, texto, extra) => `<div class="vazio"><span class="vazio-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="15.5" rx="4.6" ry="3.8"/><ellipse cx="6.4" cy="10.4" rx="2" ry="2.5"/><ellipse cx="10" cy="6.8" rx="2" ry="2.6"/><ellipse cx="14" cy="6.8" rx="2" ry="2.6"/><ellipse cx="17.6" cy="10.4" rx="2" ry="2.5"/></svg></span><h3>${titulo}</h3><p>${texto}</p>${extra || ""}</div>`;

  // ---------- Caixa de publicar ----------
  function caixaPublicar(opcoes) {
    opcoes = opcoes || {};
    if (!est.eu || !est.eu.aceitou || !est.eu.estado) {
      return `<button type="button" class="compor-fake" data-acao="publicar">${avatar(null)}<span>Compartilhe uma foto, uma dúvida ou uma história do seu pet…</span></button>`;
    }
    const clubes = [...est.clubes];
    return `<form class="compor" id="form-compor" novalidate>
      <div class="compor-linha">${avatar(est.eu)}
        <label class="sr" for="compor-texto">Sua publicação</label>
        <textarea id="compor-texto" name="texto" maxlength="5000" rows="2" placeholder="Compartilhe algo com a comunidade…"></textarea>
      </div>
      <div class="compor-extra" data-para="foto" hidden>
        <label class="btn btn-sec arquivo">Escolher fotos (até 4)<input type="file" id="compor-fotos" accept="image/jpeg,image/png,image/webp" multiple></label>
        <div class="previas" id="compor-previas"></div>
      </div>
      <div class="compor-extra" data-para="video" hidden>
        <label class="rot" for="compor-video">Link do vídeo</label>
        <input id="compor-video" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=… ou Instagram / TikTok" autocapitalize="none" spellcheck="false">
      </div>
      <div class="compor-extra" data-para="enquete" hidden>
        <div id="compor-opcoes">
          <input type="text" class="opcao-enq" maxlength="80" placeholder="Opção 1" aria-label="Opção 1">
          <input type="text" class="opcao-enq" maxlength="80" placeholder="Opção 2" aria-label="Opção 2">
        </div>
        <button type="button" class="link-botao" id="compor-mais-opcao">+ Adicionar opção</button>
      </div>
      <p class="compor-extra nota-vet" data-para="pergunta" hidden>Para sintomas, remédios e emergências, procure um veterinário. Aqui a comunidade troca experiências.</p>
      <div class="compor-rodape">
        <div class="tipos" role="radiogroup" aria-label="Tipo de publicação">
          ${[["texto", "Texto"], ["foto", "Foto"], ["video", "Vídeo"], ["pergunta", "Pergunta"], ["enquete", "Enquete"]].map(([v, t], i) => `<label class="chip-tipo"><input type="radio" name="tipo" value="${v}"${i === 0 ? " checked" : ""}><span>${t}</span></label>`).join("")}
        </div>
        <div class="compor-envio">
          <label class="sr" for="compor-clube">Publicar em</label>
          <select id="compor-clube" name="clube">
            <option value="">Feed geral</option>
            ${clubes.map((c) => `<option value="${esc(c)}"${opcoes.clube === c ? " selected" : ""}>${esc(nomeClube(c))}</option>`).join("")}
          </select>
          <button type="submit" class="btn">Publicar</button>
        </div>
      </div>
      <p class="aviso-conta" id="compor-aviso" role="alert" hidden></p>
    </form>`;
  }
  const nomesClubes = {};
  const nomeClube = (id) => nomesClubes[id] || id;

  function ligarPublicar(aoPublicar) {
    const f = document.getElementById("form-compor");
    if (!f) return;
    const aviso = document.getElementById("compor-aviso");
    const texto = f.texto, fotosInput = document.getElementById("compor-fotos");
    let fotos = [];
    const PLACE = { texto: "Compartilhe algo com a comunidade…", foto: "Escreva uma legenda (opcional)", video: "Conte sobre o vídeo (opcional)", pergunta: "Qual é a sua dúvida? Dê detalhes: idade, raça, há quanto tempo…", enquete: "Qual é a pergunta da enquete?" };
    const tipo = () => f.querySelector('input[name="tipo"]:checked').value;
    function trocarTipo() {
      const t = tipo();
      f.querySelectorAll(".compor-extra").forEach((el) => { el.hidden = el.dataset.para !== t; });
      texto.placeholder = PLACE[t];
    }
    f.addEventListener("change", (e) => { if (e.target.name === "tipo") trocarTipo(); });
    texto.addEventListener("input", () => { texto.style.height = "auto"; texto.style.height = Math.min(texto.scrollHeight, 360) + "px"; });
    fotosInput.addEventListener("change", () => {
      fotos = fotos.concat([...fotosInput.files]).slice(0, 4);
      fotosInput.value = "";
      desenharPrevias();
    });
    function desenharPrevias() {
      const box = document.getElementById("compor-previas");
      box.innerHTML = "";
      fotos.forEach((arq, i) => {
        const d = document.createElement("div"); d.className = "previa";
        const img = new Image(); img.alt = ""; img.src = URL.createObjectURL(arq);
        const x = document.createElement("button"); x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Tirar foto " + (i + 1));
        x.addEventListener("click", () => { fotos.splice(i, 1); desenharPrevias(); });
        d.appendChild(img); d.appendChild(x); box.appendChild(d);
      });
    }
    document.getElementById("compor-mais-opcao").addEventListener("click", function () {
      const box = document.getElementById("compor-opcoes");
      const n = box.querySelectorAll("input").length;
      if (n >= 4) return;
      const i = document.createElement("input");
      i.type = "text"; i.className = "opcao-enq"; i.maxLength = 80; i.placeholder = "Opção " + (n + 1); i.setAttribute("aria-label", "Opção " + (n + 1));
      box.appendChild(i); i.focus();
      if (n + 1 >= 4) this.hidden = true;
    });
    const avisar = (m) => { aviso.textContent = m; aviso.hidden = !m; };

    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      avisar("");
      const t = tipo();
      const dados = { autor: est.eu.id, tipo: t, texto: texto.value.trim() || null, clube: f.clube.value || null };
      if (["texto", "pergunta", "enquete"].includes(t) && !dados.texto) { avisar("Escreva alguma coisa antes de publicar."); texto.focus(); return; }
      if (t === "pergunta" && dados.texto.length < 10) { avisar("Conte um pouco mais na pergunta (pelo menos 10 letras)."); texto.focus(); return; }
      if (dados.texto && pareceVenda(dados.texto)) { avisar("Venda de animais não é permitida na Comunidade Abanô. Para adoção responsável, use a área de adoção."); return; }
      if (t === "foto" && !fotos.length) { avisar("Escolha pelo menos uma foto."); return; }
      if (t === "video") {
        const v = document.getElementById("compor-video").value.trim();
        if (!/^https:\/\/([a-z0-9-]+\.)?(youtube\.com|youtu\.be|instagram\.com|tiktok\.com)\//i.test(v)) { avisar("Cole um link do YouTube, Instagram ou TikTok, começando com https://"); document.getElementById("compor-video").focus(); return; }
        dados.video_url = v;
      }
      if (t === "enquete") {
        const ops = [...f.querySelectorAll(".opcao-enq")].map((i) => i.value.trim()).filter(Boolean);
        if (ops.length < 2) { avisar("A enquete precisa de pelo menos 2 opções."); return; }
        dados.opcoes = ops;
      }
      const botao = f.querySelector("button[type=submit]");
      botao.disabled = true; botao.textContent = "Publicando…";
      const enviadas = [];
      try {
        if (t === "foto") {
          for (const arq of fotos) enviadas.push(await C.enviarFoto(est.eu.id, "post", arq));
          dados.fotos = enviadas;
        }
        let r = await sb.from("posts").insert(dados).select(SEL).single();
        if (r.error && /jwt|PGRST30[13]/i.test((r.error.code || "") + " " + (r.error.message || ""))) {
          await sb.auth.refreshSession();
          r = await sb.from("posts").insert(dados).select(SEL).single();
        }
        if (r.error) { console.error("Abanô: erro ao publicar", r.error); throw r.error; }
        f.reset(); fotos = []; desenharPrevias(); trocarTipo(); texto.style.height = "";
        toast("Publicado!");
        if (aoPublicar) aoPublicar(r.data);
      } catch (err) {
        enviadas.forEach((u) => C.apagarFoto(u));
        avisar(err && err.code ? erroMsg(err) : (err && err.message) || "Não deu para publicar agora.");
      } finally {
        botao.disabled = false; botao.textContent = "Publicar";
      }
    });
  }

  // ---------- Ações ----------
  const acoes = {
    async curtir(id) {
      const p = est.posts.get(id); if (!p) return;
      const tinha = est.curtidas.has(id);
      if (tinha) { est.curtidas.delete(id); p.total_curtidas = Math.max(0, p.total_curtidas - 1); }
      else { est.curtidas.add(id); p.total_curtidas++; }
      atualizarCartao(id);
      const r = tinha
        ? await sb.from("curtidas").delete().eq("post", id).eq("usuario", est.eu.id)
        : await sb.from("curtidas").insert({ post: id, usuario: est.eu.id });
      if (r.error && r.error.code !== "23505") {
        if (tinha) { est.curtidas.add(id); p.total_curtidas++; } else { est.curtidas.delete(id); p.total_curtidas--; }
        atualizarCartao(id); toast(erroMsg(r.error));
      }
    },
    async salvar(id) {
      const tinha = est.salvos.has(id);
      if (tinha) est.salvos.delete(id); else est.salvos.add(id);
      atualizarCartao(id);
      const r = tinha
        ? await sb.from("salvos").delete().eq("post", id).eq("usuario", est.eu.id)
        : await sb.from("salvos").insert({ post: id, usuario: est.eu.id });
      if (r.error && r.error.code !== "23505") { if (tinha) est.salvos.add(id); else est.salvos.delete(id); atualizarCartao(id); toast(erroMsg(r.error)); return; }
      toast(tinha ? "Removido dos salvos." : "Salvo! Veja em Salvos, no menu.");
    },
    async votar(id, opcao) {
      const p = est.posts.get(id); if (!p || est.votos.has(id)) return;
      const r = await sb.from("enquete_votos").insert({ post: id, usuario: est.eu.id, opcao: Number(opcao) });
      if (r.error && r.error.code !== "23505") { toast(erroMsg(r.error)); return; }
      est.votos.set(id, Number(opcao));
      const f = await sb.from("posts").select("votos,total_votos").eq("id", id).single();
      if (f.data) { p.votos = f.data.votos; p.total_votos = f.data.total_votos; }
      atualizarCartao(id);
    },
    async compartilhar(id) {
      const p = est.posts.get(id);
      const url = "https://abano.com.br/" + linkPost(id);
      const titulo = p && p.texto ? p.texto.slice(0, 80) : "Publicação na Comunidade Abanô";
      if (navigator.share) { try { await navigator.share({ title: titulo, url: url }); } catch (e) {} return; }
      try { await navigator.clipboard.writeText(url); toast("Link copiado!"); } catch (e) { prompt("Copie o link:", url); }
    },
    async apagar(id) {
      const p = est.posts.get(id); if (!p) return;
      if (!confirm("Apagar esta publicação? Isso não pode ser desfeito.")) return;
      const r = await sb.from("posts").delete().eq("id", id);
      if (r.error) { toast(erroMsg(r.error)); return; }
      (p.fotos || []).forEach((u) => C.apagarFoto(u));
      document.querySelectorAll(`[data-post="${id}"]`).forEach((el) => el.remove());
      toast("Publicação apagada.");
      if (q.get("p") === id) location.href = "comunidade/";
    },
    async participar(clube) {
      const dentro = est.clubes.has(clube);
      const r = dentro
        ? await sb.from("clube_membros").delete().eq("clube", clube).eq("usuario", est.eu.id)
        : await sb.from("clube_membros").insert({ clube: clube, usuario: est.eu.id });
      if (r.error && r.error.code !== "23505") { toast(erroMsg(r.error)); return; }
      if (dentro) est.clubes.delete(clube); else est.clubes.add(clube);
      toast(dentro ? "Você saiu do clube." : "Bem-vindo(a) ao clube!");
      const cont = await sb.from("clubes").select("total_membros").eq("id", clube).single();
      document.querySelectorAll(`[data-clube="${clube}"]`).forEach((el) => {
        const b = el.querySelector('[data-acao="participar"]');
        if (b) { b.textContent = est.clubes.has(clube) ? "Participando" : "Participar"; b.classList.toggle("btn-sec", est.clubes.has(clube)); b.setAttribute("aria-pressed", est.clubes.has(clube)); }
        const m = el.querySelector(".membros");
        if (m && cont.data) m.textContent = textoMembros(cont.data.total_membros);
      });
      if (q.get("c") === clube) rota();
    },
    async membros(clube) {
      const j = janelaSimples("Membros de " + (nomesClubes[clube] || "clube"));
      const r = await sb.from("clube_membros").select("criado_em, perfil:perfis!clube_membros_usuario_fkey(id,usuario,nome,foto_url,cidade,estado)")
        .eq("clube", clube).order("criado_em", { ascending: false }).limit(300);
      if (!j.aberta()) return;
      if (r.error) { j.corpo.innerHTML = vazio("Não deu para carregar", erroMsg(r.error)); return; }
      const lista = (r.data || []).filter((m) => m.perfil && !est.bloqueados.has(m.perfil.id));
      j.corpo.innerHTML = lista.length ? `<ul class="lista-pessoas">${lista.map((m) => {
        const u = m.perfil, local = [u.cidade, u.estado].filter(Boolean).join(" / ");
        const ehEu = est.eu && est.eu.id === u.id, sigo = est.seguindo.has(u.id);
        return `<li><a class="pessoa" href="${linkPerfil(u.usuario)}">${avatar(u)}<span><b>${esc(u.nome)}</b><small>@${esc(u.usuario)}${local ? " · " + esc(local) : ""}</small></span></a>${ehEu ? '<span class="pessoa-eu">Você</span>' : `<button type="button" class="btn btn-peq${sigo ? " btn-sec" : ""}" data-acao="seguir" data-id="${esc(u.id)}" aria-pressed="${sigo}">${sigo ? "Seguindo" : "Seguir"}</button>`}</li>`;
      }).join("")}</ul>` : vazio("Ainda sem membros", "Seja o primeiro a participar deste clube.");
    },
    async mensagem(perfilId, _o, b) {
      const usuario = (b && b.dataset.usuario) || "";
      if (b) b.disabled = true;
      const r = await sb.rpc("abrir_conversa", { p_com: perfilId });
      if (b) b.disabled = false;
      if (r.error) {
        if (/abrir_conversa/.test(r.error.message || "")) { toast("As mensagens ainda estão sendo ativadas no Abanô."); return; }
        if (/Siga este perfil/i.test(r.error.message || "")) { avisoSeguir(perfilId, usuario); return; }
        toast(erroMsg(r.error)); return;
      }
      location.href = "comunidade/?v=mensagens&conversa=" + encodeURIComponent(r.data);
    },
    async seguir(perfilId) {
      const sigo = est.seguindo.has(perfilId);
      const r = sigo
        ? await sb.from("seguidores").delete().eq("seguidor", est.eu.id).eq("seguido", perfilId)
        : await sb.from("seguidores").insert({ seguidor: est.eu.id, seguido: perfilId });
      if (r.error && r.error.code !== "23505") { toast(erroMsg(r.error)); return; }
      if (sigo) est.seguindo.delete(perfilId); else est.seguindo.add(perfilId);
      document.querySelectorAll(`[data-acao="seguir"][data-id="${perfilId}"]`).forEach((b) => { b.textContent = sigo ? "Seguir" : "Seguindo"; b.classList.toggle("btn-sec", !sigo); b.setAttribute("aria-pressed", !sigo); });
      const n = document.getElementById("num-seguidores");
      if (n) n.textContent = Math.max(0, Number(n.textContent.replace(/\D/g, "")) + (sigo ? -1 : 1)).toLocaleString("pt-BR");
    }
  };
  // ---------- Menu ⋯, denúncias e bloqueios ----------
  function abrirOpcoes(itens) {
    const d = document.getElementById("dialogo-opcoes"), corpo = document.getElementById("opcoes-corpo");
    corpo.innerHTML = "";
    itens.forEach(([texto, fn, perigo]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "menu-item" + (perigo ? " perigo" : ""); b.textContent = texto;
      b.addEventListener("click", () => { d.close(); fn(); });
      corpo.appendChild(b);
    });
    d.showModal();
  }
  async function fixar(p, fixar) {
    const r = await sb.rpc("fixar_no_clube", { p_clube: p.clube, p_post: fixar ? p.id : null });
    if (r.error) { toast(/fixar_no_clube/.test(r.error.message || "") ? "Falta ativar a publicação fixada no banco de dados." : erroMsg(r.error)); return; }
    est.fixados.set(p.clube, fixar ? p.id : null);
    toast(fixar ? "Publicação fixada no topo do clube." : "Publicação desafixada.");
    if (q.get("c") === p.clube) telaClube(p.clube);
  }
  acoes.opcoes = (id) => {
    const p = est.posts.get(id); if (!p) return;
    const u = (p.perfil || {}).usuario;
    const adm = est.admin && p.clube ? [est.fixados.get(p.clube) === p.id ? ["Desafixar do clube", () => fixar(p, false)] : ["Fixar no topo do clube (regras)", () => fixar(p, true)]] : [];
    if (est.eu && p.autor === est.eu.id) {
      abrirOpcoes(adm.concat([["Copiar link", () => acoes.compartilhar(id)], ["Apagar publicação", () => acoes.apagar(id), true]]));
      return;
    }
    abrirOpcoes(adm.concat([
      ["Copiar link", () => acoes.compartilhar(id)],
      ["Denunciar publicação", () => abrirDenuncia({ tipo: "post", id: id }), true],
      ["Bloquear @" + u, () => bloquear(p.autor, u), true]
    ]));
  };
  acoes["opcoes-perfil"] = (id, _o, el) => {
    const u = el.dataset.usuario;
    abrirOpcoes(est.bloqueados.has(id)
      ? [["Desbloquear @" + u, () => desbloquear(id)], ["Denunciar perfil", () => abrirDenuncia({ tipo: "perfil", id: id }), true]]
      : [["Denunciar perfil", () => abrirDenuncia({ tipo: "perfil", id: id }), true], ["Bloquear @" + u, () => bloquear(id, u), true]]);
  };
  acoes.desbloquear = (id) => desbloquear(id);

  async function bloquear(perfilId, usuario) {
    if (!exigir({ tipo: "bloquear", id: perfilId })) return;
    if (!confirm("Bloquear @" + usuario + "?\n\nVocê deixa de ver as publicações e comentários dessa pessoa. Ela não poderá comentar nas suas publicações nem seguir você. Ela não é avisada.")) return;
    const r = await sb.from("bloqueios").insert({ bloqueador: est.eu.id, bloqueado: perfilId });
    if (r.error && r.error.code !== "23505") { toast(erroMsg(r.error)); return; }
    est.bloqueados.add(perfilId); est.seguindo.delete(perfilId);
    document.querySelectorAll(`[data-autor="${perfilId}"]`).forEach((el) => el.remove());
    toast("@" + usuario + " foi bloqueado.");
    if (q.get("u")) rota();
  }
  async function desbloquear(perfilId) {
    const r = await sb.from("bloqueios").delete().eq("bloqueador", est.eu.id).eq("bloqueado", perfilId);
    if (r.error) { toast(erroMsg(r.error)); return; }
    est.bloqueados.delete(perfilId);
    toast("Perfil desbloqueado.");
    rota();
  }

  let alvoDenuncia = null;
  function abrirDenuncia(alvo) {
    if (!exigir({ tipo: "denunciar", id: alvo.id })) return;
    alvoDenuncia = alvo;
    const f = document.getElementById("form-denuncia");
    f.reset();
    document.getElementById("den-aviso").hidden = true;
    document.getElementById("den-titulo").textContent = { post: "Denunciar publicação", comentario: "Denunciar comentário", perfil: "Denunciar perfil" }[alvo.tipo];
    document.getElementById("dialogo-denuncia").showModal();
  }
  (function ligarDenuncia() {
    const f = document.getElementById("form-denuncia");
    if (!f) return;
    const d = document.getElementById("dialogo-denuncia"), av = document.getElementById("den-aviso");
    document.getElementById("den-cancelar").addEventListener("click", () => d.close());
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const motivo = (f.querySelector('input[name="motivo"]:checked') || {}).value;
      if (!motivo) { av.textContent = "Escolha um motivo."; av.hidden = false; return; }
      const dados = { denunciante: est.eu.id, alvo_tipo: alvoDenuncia.tipo, motivo: motivo, detalhe: f.detalhe.value.trim() || null };
      dados[alvoDenuncia.tipo] = alvoDenuncia.id;
      const b = f.querySelector('button[type="submit"]'); b.disabled = true;
      const r = await sb.from("denuncias").insert(dados);
      b.disabled = false;
      if (r.error && r.error.code !== "23505") { av.textContent = erroMsg(r.error); av.hidden = false; return; }
      d.close();
      toast("Denúncia enviada. Obrigado por cuidar da comunidade!");
    });
  })();

  const PRECISA_LOGIN = { membros: 1, mensagem: 1, curtir: 1, salvar: 1, votar: 1, apagar: 1, participar: 1, seguir: 1, publicar: 1, desbloquear: 1, "comentar-login": 1 };

  // ---------- Visualizador de fotos (tela cheia, sem sair da página) ----------
  const galeria = (() => {
    const d = document.createElement("dialog");
    d.className = "galeria";
    d.setAttribute("aria-label", "Fotos da publicação");
    d.innerHTML = `<div class="gal-topo"><span class="gal-cont" aria-live="polite"></span><button type="button" class="gal-fechar" aria-label="Fechar as fotos">&times;</button></div>
      <button type="button" class="gal-seta gal-ant" aria-label="Foto anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="gal-palco"><img alt=""></div>
      <button type="button" class="gal-seta gal-prox" aria-label="Próxima foto"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
      <div class="gal-pontos" aria-hidden="true"></div>`;
    document.body.appendChild(d);
    const img = d.querySelector("img"), cont = d.querySelector(".gal-cont"), pontos = d.querySelector(".gal-pontos");
    let fotos = [], i = 0, nomeAutor = "", comHistorico = false;
    function mostrar(n) {
      i = (n + fotos.length) % fotos.length;
      img.src = fotos[i];
      img.alt = `Foto ${i + 1} de ${fotos.length} da publicação de ${nomeAutor}`;
      cont.textContent = fotos.length > 1 ? `${i + 1} / ${fotos.length}` : "";
      d.classList.toggle("uma", fotos.length < 2);
      pontos.innerHTML = fotos.length > 1 ? fotos.map((_, k) => `<span${k === i ? ' class="ativo"' : ""}></span>`).join("") : "";
    }
    function abrir(lista, n, autor) {
      fotos = lista; nomeAutor = autor || "";
      mostrar(n);
      d.showModal();
      document.documentElement.classList.add("sem-rolar");
      // O botão "voltar" do celular fecha as fotos em vez de sair da página
      try { history.pushState({ galeria: 1 }, ""); comHistorico = true; } catch (e) { comHistorico = false; }
    }
    function fechar(peloVoltar) {
      if (!d.open) return;
      d.close();
      document.documentElement.classList.remove("sem-rolar");
      if (comHistorico && !peloVoltar) { comHistorico = false; history.back(); }
      comHistorico = false;
    }
    d.querySelector(".gal-fechar").addEventListener("click", () => fechar());
    d.querySelector(".gal-ant").addEventListener("click", () => mostrar(i - 1));
    d.querySelector(".gal-prox").addEventListener("click", () => mostrar(i + 1));
    d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
    d.addEventListener("click", (e) => { if (e.target === d || e.target.classList.contains("gal-palco")) fechar(); });
    d.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") mostrar(i - 1); if (e.key === "ArrowRight") mostrar(i + 1); });
    window.addEventListener("popstate", () => { if (d.open) fechar(true); });
    // Arrastar para o lado troca a foto; arrastar para baixo fecha
    let x0 = null, y0 = null;
    d.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    d.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) mostrar(i + (dx < 0 ? 1 : -1));
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) fechar();
    });
    return { abrir };
  })();
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-galeria]");
    if (!a || e.metaKey || e.ctrlKey) return;
    const p = est.posts.get(a.dataset.galeria);
    if (!p) return;
    e.preventDefault();
    const fotos = (p.fotos || []).filter((f) => String(f).indexOf(PASTA_FOTOS) === 0);
    galeria.abrir(fotos, Number(a.dataset.i) || 0, (p.perfil || {}).nome);
  });

  // ---------- Comentar direto do feed ----------
  document.addEventListener("input", (e) => {
    const f = e.target.closest(".coment-rapido");
    if (f && f.tagName === "FORM") f.querySelector("button").disabled = !e.target.value.trim();
  });
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("form.coment-rapido");
    if (!f) return;
    e.preventDefault();
    const id = f.dataset.post, campo = f.querySelector("input"), botao = f.querySelector("button"), texto = campo.value.trim();
    if (!texto || !exigir({ tipo: "comentar", id: id })) return;
    if (pareceVenda(texto)) { toast("Venda de animais não é permitida na Comunidade Abanô."); return; }
    botao.disabled = true; campo.disabled = true;
    const r = await sb.from("comentarios").insert({ post: id, autor: est.eu.id, texto: texto }).select("id,post,autor,texto,criado_em, perfil:perfis!comentarios_autor_fkey(usuario,nome)").single();
    campo.disabled = false;
    if (r.error) { botao.disabled = false; toast(erroMsg(r.error)); return; }
    const p = est.posts.get(id);
    if (p) {
      p.total_comentarios = (p.total_comentarios || 0) + 1;
      const l = (est.previas.get(id) || []).concat([r.data]).slice(-2);
      est.previas.set(id, l);
      atualizarCartao(id);
    }
    toast("Comentário publicado!");
  });


  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-acao]");
    if (!b || !document.body.contains(b)) return;
    const tipo = b.dataset.acao, id = b.dataset.id;
    if (tipo === "video") {
      const caixa = b.closest(".video");
      caixa.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(caixa.dataset.yt)}?autoplay=1" title="Vídeo do YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
      return;
    }
    if (tipo === "compartilhar") { acoes.compartilhar(id); return; }
    if (PRECISA_LOGIN[tipo] && !exigir({ tipo: tipo, id: id, opcao: b.dataset.opcao != null ? Number(b.dataset.opcao) : null })) return;
    if (tipo === "publicar") { const c = document.getElementById("compor-texto"); if (c) c.focus(); return; }
    if (tipo === "comentar-login") return;
    if (acoes[tipo]) acoes[tipo](id, b.dataset.opcao, b);
  });

  // ---------- Telas ----------
  const ABAS = [["recentes", "Mais recentes"], ["seguindo", "Seguindo"], ["perguntas", "Perguntas"], ["em-alta", "Em alta"]];

  function telaFeed() {
    let f = q.get("f") || "recentes";
    if (f === "para-voce") f = "em-alta";
    if (!ABAS.some((a) => a[0] === f)) f = "recentes";
    definirMeta(f === "perguntas" ? "Perguntas e respostas | Comunidade Abanô" : "Comunidade Abanô | Tutores de cães, gatos e outros pets",
      "Um espaço para compartilhar experiências, conhecer outros tutores e descobrir o universo pet.", "comunidade/" + (f === "perguntas" ? "?f=perguntas" : ""));
    centro.innerHTML = `
      <section class="com-capa">
        <h1>Comunidade Abanô</h1>
        <p>Um espaço para compartilhar experiências, conhecer outros tutores e descobrir o universo pet.</p>
      </section>
      ${caixaPublicar()}
      <nav class="abas-feed" aria-label="Filtros do feed">
        ${ABAS.map(([v, t]) => `<a href="comunidade/${v === "recentes" ? "" : "?f=" + v}"${v === f ? ' aria-current="page"' : ""}>${t}</a>`).join("")}
      </nav>
      <div id="feed"></div>`;
    const feed = document.getElementById("feed");
    if (f === "seguindo" && !est.eu) {
      feed.innerHTML = vazio("Veja quem você segue", "Entre na sua conta para ver as publicações dos tutores que você acompanha.", '<button type="button" class="btn" data-acao="seguir-login">Entrar</button>');
      feed.querySelector("button").addEventListener("click", () => abrirLogin({ tipo: "seguir" }));
      return;
    }
    const vazios = {
      "em-alta": vazio("A comunidade está começando", "Ainda não há publicações. Que tal ser o primeiro a compartilhar uma foto ou uma história do seu pet?"),
      "recentes": vazio("A comunidade está começando", "Ainda não há publicações. Que tal ser o primeiro?"),
      "perguntas": vazio("Nenhuma pergunta ainda", "Tem uma dúvida sobre rotina, alimentação ou comportamento? Pergunte para a comunidade."),
      "seguindo": vazio("Nada por aqui ainda", "Você ainda não segue ninguém, ou quem você segue não publicou. Visite perfis e toque em Seguir.")
    };
    const l = lista(feed, { tipo: f }, vazios[f]);
    ligarPublicar((p) => { if (f !== "seguindo" && (f !== "perguntas" || p.tipo === "pergunta")) l.inserirNoTopo(p); });
  }

  async function telaPost(id) {
    centro.innerHTML = '<p class="carregando">Carregando…</p>';
    const r = await sb.from("posts").select(SEL).eq("id", id).maybeSingle();
    if (r.error || !r.data) {
      definirMeta("Publicação não encontrada | Comunidade Abanô", null, "comunidade/");
      centro.innerHTML = vazio("Publicação não encontrada", "Ela pode ter sido apagada pelo autor.", '<a class="btn" href="comunidade/">Voltar para a Comunidade</a>');
      return;
    }
    const p = r.data;
    await carregarMeusEstados([p]);
    const resumo = (p.texto || (p.tipo === "foto" ? "Foto" : "Vídeo") + " de " + p.perfil.nome).replace(/\s+/g, " ");
    definirMeta(resumo.slice(0, 60) + (resumo.length > 60 ? "…" : "") + " | Comunidade Abanô", resumo.slice(0, 155), linkPost(p.id));
    centro.innerHTML = `
      ${voltar("comunidade/")}
      <div class="ver-post">${cartao(p, true)}</div>
      ${secaoComentarios(p)}`;
    // Dados estruturados para buscadores
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "DiscussionForumPosting", "headline": resumo.slice(0, 110), "text": p.texto || "", "datePublished": p.criado_em, "url": "https://abano.com.br/" + linkPost(p.id), "author": { "@type": "Person", "name": p.perfil.nome, "url": "https://abano.com.br/" + linkPerfil(p.perfil.usuario) }, "interactionStatistic": [{ "@type": "InteractionCounter", "interactionType": "https://schema.org/LikeAction", "userInteractionCount": p.total_curtidas }, { "@type": "InteractionCounter", "interactionType": "https://schema.org/CommentAction", "userInteractionCount": p.total_comentarios }] });
    document.head.appendChild(ld);

    ligarComentarios(p);
    if (location.hash === "#comentarios") setTimeout(() => document.getElementById("comentarios").scrollIntoView(), 50);
  }
  // Seção de comentários (lista + campo de comentar), usada na página do post e na janela do feed
  function secaoComentarios(p) {
    const pergunta = p.tipo === "pergunta";
    return `<section class="comentarios" id="comentarios" aria-label="${pergunta ? "Respostas" : "Comentários"}">
        <h2>${pergunta ? "Respostas" : "Comentários"} <small id="num-coment">${p.total_comentarios ? num(p.total_comentarios) : ""}</small></h2>
        <ol class="lista-comentarios" id="lista-comentarios"><li class="carregando">Carregando…</li></ol>
        ${est.eu && est.eu.aceitou
          ? `<form class="comentar" id="form-comentar" novalidate>${avatar(est.eu)}<label class="sr" for="comentario-texto">${pergunta ? "Sua resposta" : "Seu comentário"}</label><textarea id="comentario-texto" maxlength="2000" rows="1" placeholder="${pergunta ? "Escreva uma resposta…" : "Escreva um comentário…"}"></textarea><button type="submit" class="btn">${pergunta ? "Responder" : "Publicar"}</button><p class="aviso-conta" id="comentar-aviso" role="alert" hidden></p></form>`
          : `<button type="button" class="compor-fake" id="comentar-login">${avatar(null)}<span>${pergunta ? "Entre para responder" : "Entre para comentar"}</span></button>`}
      </section>`;
  }
  function ligarComentarios(p) {
    const lb = document.getElementById("comentar-login");
    if (lb) lb.addEventListener("click", () => exigir({ tipo: "comentar", id: p.id }));
    carregarComentarios(p);
    const f = document.getElementById("form-comentar");
    if (!f) return;
    const ta = f.querySelector("textarea"), av = document.getElementById("comentar-aviso");
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = ta.value.trim();
      av.hidden = true;
      if (!texto) { ta.focus(); return; }
      if (pareceVenda(texto)) { av.textContent = "Venda de animais não é permitida na Comunidade Abanô."; av.hidden = false; return; }
      const b = f.querySelector("button"); b.disabled = true;
      const r2 = await sb.from("comentarios").insert({ post: p.id, autor: est.eu.id, texto: texto }).select("*, perfil:perfis!comentarios_autor_fkey(id,usuario,nome,foto_url)").single();
      b.disabled = false;
      if (r2.error) { av.textContent = erroMsg(r2.error); av.hidden = false; return; }
      ta.value = ""; ta.style.height = "";
      p.total_comentarios = (p.total_comentarios || 0) + 1;
      const ol = document.getElementById("lista-comentarios");
      if (ol.querySelector(".vazio-c")) ol.innerHTML = "";
      ol.insertAdjacentHTML("beforeend", conversa(r2.data, new Map(), p));
      ol.lastElementChild.scrollIntoView({ block: "nearest" });
      atualizarNumComentarios(p);
    });
  }

  // ---------- Janela simples por cima da página (membros do clube, avisos) ----------
  function janelaSimples(titulo) {
    const d = document.createElement("dialog");
    d.className = "janela-coment janela-simples";
    d.setAttribute("aria-label", titulo);
    d.innerHTML = `<div class="jc-caixa"><div class="jc-topo"><span class="jc-pega" aria-hidden="true"></span><h2 class="js-titulo">${esc(titulo)}</h2><button type="button" class="jc-fechar" aria-label="Fechar">&times;</button></div><div class="jc-corpo"><p class="carregando">Carregando…</p></div></div>`;
    document.body.appendChild(d);
    const fechar = () => { if (!d.open) return; d.close(); d.remove(); document.documentElement.classList.remove("sem-rolar"); };
    d.querySelector(".jc-fechar").addEventListener("click", fechar);
    d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
    d.addEventListener("click", (e) => { if (e.target === d) fechar(); });
    d.showModal();
    document.documentElement.classList.add("sem-rolar");
    return { d, corpo: d.querySelector(".jc-corpo"), fechar, aberta: () => d.open };
  }
  function avisoSeguir(perfilId, usuario) {
    const j = janelaSimples("Siga para conversar");
    const sigo = est.seguindo.has(perfilId);
    j.corpo.innerHTML = `<div class="aviso-seguir"><span class="vazio-ico" aria-hidden="true">${ICONE.mensagem}</span>
      <p>Para iniciar uma conversa, você precisa seguir ${usuario ? "<b>@" + esc(usuario) + "</b>" : "este tutor"}. Assim, as mensagens chegam só de quem você escolheu acompanhar.</p>
      <div class="aviso-seguir-botoes"><button type="button" class="btn${sigo ? " btn-sec" : ""}" data-acao="seguir" data-id="${esc(perfilId)}" aria-pressed="${sigo}">${sigo ? "Seguindo" : "Seguir"}</button>
      <button type="button" class="btn btn-sec" id="aviso-seguir-conversar">Iniciar conversa</button></div></div>`;
    j.corpo.querySelector("#aviso-seguir-conversar").addEventListener("click", () => {
      if (!est.seguindo.has(perfilId)) { toast("Toque em Seguir primeiro."); return; }
      j.fechar(); acoes.mensagem(perfilId, null, { dataset: { usuario } });
    });
  }

  // ---------- Janela de comentários por cima do feed (sem trocar de página) ----------
  const janelaComentarios = (() => {
    let d = null, postAtual = null, comHistorico = false;
    function fechar(peloVoltar) {
      if (!d || !d.open) return;
      d.close(); d.remove(); d = null;
      document.documentElement.classList.remove("sem-rolar");
      if (comHistorico && !peloVoltar) { comHistorico = false; history.back(); }
      comHistorico = false;
      // Atualiza o cartão no feed com o novo número e os comentários mais recentes
      if (postAtual) { const p = postAtual; postAtual = null; est.previas.delete(p.id); atualizarCartao(p.id); previasComentarios([p]); }
    }
    window.addEventListener("popstate", () => { if (d && d.open) fechar(true); });
    function abrir(id) {
      const p = est.posts.get(id); if (!p) return false;
      postAtual = p;
      d = document.createElement("dialog");
      d.className = "janela-coment";
      d.setAttribute("aria-label", p.tipo === "pergunta" ? "Respostas" : "Comentários");
      d.innerHTML = `<div class="jc-caixa"><div class="jc-topo"><span class="jc-pega" aria-hidden="true"></span><a class="jc-abrir" href="${linkPost(p.id)}">Ver publicação</a><button type="button" class="jc-fechar" aria-label="Fechar">&times;</button></div><div class="jc-corpo">${secaoComentarios(p)}</div></div>`;
      document.body.appendChild(d);
      d.querySelector(".jc-fechar").addEventListener("click", () => fechar());
      d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
      d.addEventListener("click", (e) => { if (e.target === d) fechar(); });
      d.showModal();
      document.documentElement.classList.add("sem-rolar");
      try { history.pushState({ comentarios: 1 }, ""); comHistorico = true; } catch (e) { comHistorico = false; }
      ligarComentarios(p);
      const ta = d.querySelector("#comentario-texto");
      if (ta && window.matchMedia("(hover: hover)").matches) ta.focus();
      return true;
    }
    return { abrir };
  })();
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-abrir-coment]");
    if (!a || e.metaKey || e.ctrlKey || a.closest(".ver-post")) return;
    if (janelaComentarios.abrir(a.dataset.abrirComent)) e.preventDefault();
  });

  // ---------- Comentários: curtir, responder e conversas (respostas num nível só) ----------
  const CORACAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/></svg>';
  const comCurtidos = new Set();
  function itemComentario(c, p, resposta, extra) {
    const a = c.perfil || {};
    const posso = est.eu && (c.autor === est.eu.id || p.autor === est.eu.id);
    const meu = est.eu && c.autor === est.eu.id;
    const curti = comCurtidos.has(c.id), n = c.total_curtidas || 0;
    return `<li class="comentario${resposta ? " resposta" : ""}" data-comentario="${esc(c.id)}" data-autor="${esc(c.autor)}" data-usuario="${esc(a.usuario)}">
      <a href="${linkPerfil(a.usuario)}" class="c-av" tabindex="-1" aria-hidden="true">${avatar(a)}</a>
      <div class="c-corpo">
        <div class="c-balao"><a class="c-nome" href="${linkPerfil(a.usuario)}">${esc(a.nome || "Tutor")}</a><p class="c-txt">${textoComMencao(c.texto)}</p>
          ${n ? `<span class="c-curtidas" aria-label="${plural(n, "curtida", "curtidas")}">${CORACAO}${num(n)}</span>` : ""}</div>
        <p class="c-meta"><time datetime="${esc(c.criado_em)}">${tempo(c.criado_em)}</time>
          <button type="button" class="c-curtir${curti ? " ativa" : ""}" data-c="${esc(c.id)}" aria-pressed="${curti}">${curti ? "Curtido" : "Curtir"}</button>
          <button type="button" class="c-responder" data-c="${esc(c.id)}" data-pai="${esc(c.resposta_a || c.id)}">Responder</button>
          ${posso ? `<button type="button" class="c-apagar" data-c="${esc(c.id)}">Apagar</button>` : ""}${meu ? "" : `<button type="button" class="c-denunciar" data-c="${esc(c.id)}">Denunciar</button>`}</p>
        ${extra || ""}
      </div>
    </li>`;
  }
  // "@usuario" no começo da resposta vira link para o perfil
  function textoComMencao(t) {
    const m = /^@([a-z0-9_]{3,30})\b/.exec(t || "");
    if (!m) return esc(t);
    return `<a class="c-mencao" href="${linkPerfil(m[1])}">@${esc(m[1])}</a>${esc(t.slice(m[0].length))}`;
  }
  function conversa(c, respostas, p) {
    const filhas = respostas.get(c.id) || [];
    return itemComentario(c, p, false, `<ol class="c-respostas" data-respostas="${esc(c.id)}">${filhas.map((r) => itemComentario(r, p, true)).join("")}</ol>`);
  }
  async function carregarComentarios(p) {
    const ol = document.getElementById("lista-comentarios");
    const r = await sb.from("comentarios").select("*, perfil:perfis!comentarios_autor_fkey(id,usuario,nome,foto_url)").eq("post", p.id).order("criado_em").limit(500);
    if (r.error) { ol.innerHTML = `<li class="vazio-c">Não deu para carregar. ${esc(erroMsg(r.error))}</li>`; return; }
    const todos = (r.data || []).filter((c) => !est.bloqueados.has(c.autor));
    if (est.eu && todos.length) {
      const k = await sb.from("curtidas_comentarios").select("comentario").eq("usuario", est.eu.id).in("comentario", todos.map((c) => c.id));
      if (!k.error) (k.data || []).forEach((x) => comCurtidos.add(x.comentario));
    }
    const ids = new Set(todos.map((c) => c.id));
    const respostas = new Map();
    const raiz = todos.filter((c) => {
      if (c.resposta_a && ids.has(c.resposta_a)) { const l = respostas.get(c.resposta_a) || []; l.push(c); respostas.set(c.resposta_a, l); return false; }
      return true;
    });
    ol.innerHTML = raiz.length ? raiz.map((c) => conversa(c, respostas, p)).join("") : `<li class="vazio-c">${p.tipo === "pergunta" ? "Ninguém respondeu ainda. Compartilhe sua experiência!" : "Ainda sem comentários. Comece a conversa!"}</li>`;
    ol.addEventListener("click", async (e) => {
      const d = e.target.closest(".c-denunciar");
      if (d) { abrirDenuncia({ tipo: "comentario", id: d.dataset.c }); return; }
      const cu = e.target.closest(".c-curtir");
      if (cu) { curtirComentario(cu); return; }
      const re = e.target.closest(".c-responder");
      if (re) { abrirResposta(re, p); return; }
      const b = e.target.closest(".c-apagar"); if (!b) return;
      if (!confirm("Apagar este comentário? As respostas a ele também somem.")) return;
      const r2 = await sb.from("comentarios").delete().eq("id", b.dataset.c);
      if (r2.error) { toast(erroMsg(r2.error)); return; }
      const li = b.closest(".comentario");
      const quantos = 1 + li.querySelectorAll(".c-respostas .comentario").length;
      p.total_comentarios = Math.max(0, (p.total_comentarios || 0) - quantos);
      li.remove();
      atualizarNumComentarios(p);
      toast("Comentário apagado.");
    });
    ol.addEventListener("submit", (e) => {
      const f = e.target.closest(".form-resposta"); if (!f) return;
      e.preventDefault();
      enviarResposta(f, p);
    });
  }
  function atualizarNumComentarios(p) {
    const n = document.getElementById("num-coment");
    if (n) n.textContent = num(p.total_comentarios || 0);
    est.posts.set(p.id, p);
    const acao = document.querySelector(`.ver-post [data-post="${p.id}"] .post-acoes a.acao span`);
    if (acao) acao.textContent = p.total_comentarios ? num(p.total_comentarios) : "";
  }
  async function curtirComentario(b) {
    if (!exigir({ tipo: "comentar" })) return;
    const id = b.dataset.c, li = b.closest(".comentario"), curti = comCurtidos.has(id);
    b.disabled = true;
    const r = curti
      ? await sb.from("curtidas_comentarios").delete().eq("comentario", id).eq("usuario", est.eu.id)
      : await sb.from("curtidas_comentarios").insert({ comentario: id, usuario: est.eu.id });
    b.disabled = false;
    if (r.error && r.error.code !== "23505") { toast(/curtidas_comentarios/.test(r.error.message || "") ? "Curtir comentários fica disponível em instantes." : erroMsg(r.error)); return; }
    if (curti) comCurtidos.delete(id); else comCurtidos.add(id);
    b.classList.toggle("ativa", !curti); b.setAttribute("aria-pressed", !curti); b.textContent = curti ? "Curtir" : "Curtido";
    const balao = li.querySelector(":scope > .c-corpo > .c-balao");
    let cont = balao.querySelector(".c-curtidas");
    const atual = cont ? Number(cont.textContent.replace(/\D/g, "")) || 0 : 0;
    const novo = Math.max(0, atual + (curti ? -1 : 1));
    if (!novo) { if (cont) cont.remove(); return; }
    if (!cont) { balao.insertAdjacentHTML("beforeend", `<span class="c-curtidas"></span>`); cont = balao.querySelector(".c-curtidas"); }
    cont.innerHTML = CORACAO + num(novo);
    cont.setAttribute("aria-label", plural(novo, "curtida", "curtidas"));
  }
  function abrirResposta(b, p) {
    if (!exigir({ tipo: "comentar" })) return;
    const pai = b.dataset.pai, alvo = b.closest(".comentario");
    const lista = document.querySelector(`[data-respostas="${pai}"]`);
    if (!lista) return;
    let f = lista.parentElement.querySelector(":scope > .form-resposta");
    if (!f) {
      lista.insertAdjacentHTML("afterend", `<form class="form-resposta" data-pai="${esc(pai)}">${avatar(est.eu)}<label class="sr" for="resp-${esc(pai)}">Sua resposta</label><input id="resp-${esc(pai)}" maxlength="2000" autocomplete="off" enterkeyhint="send" placeholder="Escreva uma resposta…"><button type="submit">Enviar</button></form>`);
      f = lista.parentElement.querySelector(":scope > .form-resposta");
    }
    const campo = f.querySelector("input");
    // Responder a uma resposta marca a pessoa com @, como no Facebook
    const usuario = alvo.dataset.usuario;
    if (alvo.classList.contains("resposta") && usuario && (!est.eu || usuario !== est.eu.usuario) && !campo.value.startsWith("@" + usuario)) campo.value = "@" + usuario + " " + campo.value;
    campo.focus();
    campo.setSelectionRange(campo.value.length, campo.value.length);
  }
  async function enviarResposta(f, p) {
    const campo = f.querySelector("input"), botao = f.querySelector("button"), texto = campo.value.trim();
    if (!texto) { campo.focus(); return; }
    if (pareceVenda(texto)) { toast("Venda de animais não é permitida na Comunidade Abanô."); return; }
    botao.disabled = true;
    const r = await sb.from("comentarios").insert({ post: p.id, autor: est.eu.id, texto: texto, resposta_a: f.dataset.pai }).select("*, perfil:perfis!comentarios_autor_fkey(id,usuario,nome,foto_url)").single();
    botao.disabled = false;
    if (r.error) { toast(/resposta_a/.test(r.error.message || "") ? "Responder comentários fica disponível em instantes." : erroMsg(r.error)); return; }
    campo.value = "";
    const lista = document.querySelector(`[data-respostas="${r.data.resposta_a || f.dataset.pai}"]`);
    lista.insertAdjacentHTML("beforeend", itemComentario(r.data, p, true));
    lista.lastElementChild.scrollIntoView({ block: "nearest" });
    f.remove();
    p.total_comentarios = (p.total_comentarios || 0) + 1;
    atualizarNumComentarios(p);
  }

  const textoMembros = (n) => n ? plural(n, "membro", "membros") : "Seja o primeiro a participar";

  function cartaoClube(c) {
    const dentro = est.clubes.has(c.id);
    return `<article class="clube" data-clube="${esc(c.id)}">
      <a href="${linkClube(c.id)}" class="clube-link"><span class="clube-ico t-${esc(c.tipo)}" aria-hidden="true">${fotoClube(c) ? `<img src="${esc(c.foto_url)}" alt="">` : esc(c.nome.charAt(0))}</span><span><b>${esc(c.nome)}</b><small class="membros">${textoMembros(c.total_membros)}</small></span></a>
      <p>${esc(c.descricao)}</p>
      <button type="button" class="btn${dentro ? " btn-sec" : ""}" data-acao="participar" data-id="${esc(c.id)}" aria-pressed="${dentro}">${dentro ? "Participando" : "Participar"}</button>
    </article>`;
  }

  async function telaClubes(meus) {
    definirMeta((meus ? "Minhas comunidades" : "Clubes") + " | Comunidade Abanô", "Clubes por raça, espécie e cidade: Huskies, Golden, Spitz, Shih Tzu, Border Collie, Pug, Bulldog Francês, Gatos, tutores do RJ e de SP.", "comunidade/?v=clubes");
    if (meus && !exigir({ tipo: "participar" })) { centro.innerHTML = vazio("Suas comunidades", "Entre na sua conta para ver os clubes de que você participa."); return; }
    centro.innerHTML = `${voltar("comunidade/")}<header class="tela-topo"><h1>${meus ? "Minhas comunidades" : "Explorar clubes"}</h1><p>${meus ? "Os clubes de que você participa." : "Grupos por raça, espécie e cidade para se conectar com outros tutores, compartilhar experiências e trocar dicas do dia a dia."}</p></header><div class="grade-clubes" id="grade-clubes"><p class="carregando">Carregando…</p></div>`;
    const r = await sb.from("clubes").select("*").order("ordem");
    const g = document.getElementById("grade-clubes");
    if (r.error) { g.innerHTML = vazio("Não deu para carregar", erroMsg(r.error)); return; }
    const lista = meus ? r.data.filter((c) => est.clubes.has(c.id)) : r.data;
    g.innerHTML = lista.length ? lista.map(cartaoClube).join("") : vazio("Você ainda não participa de nenhum clube", "Escolha um clube da sua raça ou da sua cidade.", '<a class="btn" href="comunidade/?v=clubes">Explorar clubes</a>');
  }

  const fotoClube = (c) => c.foto_url && String(c.foto_url).indexOf(PASTA_FOTOS) === 0 ? c.foto_url : null;
  async function telaClube(id) {
    centro.innerHTML = '<p class="carregando">Carregando…</p>';
    const r = await sb.from("clubes").select("*").eq("id", id).maybeSingle();
    if (r.error || !r.data) { centro.innerHTML = vazio("Clube não encontrado", "Veja a lista de clubes.", '<a class="btn" href="comunidade/?v=clubes">Explorar clubes</a>'); return; }
    const c = r.data;
    const aba = q.get("aba") === "perguntas" ? "perguntas" : "posts";
    definirMeta(c.nome + " | Clubes da Comunidade Abanô", c.descricao, linkClube(c.id));
    const dentro = est.clubes.has(c.id), logado = !!est.sessao, foto = fotoClube(c);
    est.fixados.set(c.id, c.post_fixado || null);
    centro.innerHTML = `
      ${voltar("comunidade/?v=clubes")}
      <section class="clube-capa t-${esc(c.tipo)}${foto ? " com-foto" : ""}" data-clube="${esc(c.id)}">
        <div class="clube-capa-topo">
          <span class="clube-foto">${foto ? `<img src="${esc(foto)}" alt="">` : esc(c.nome.charAt(0))}</span>
          <div><h1>${esc(c.nome)}</h1><p>${esc(c.descricao)}</p></div>
        </div>
        <div class="clube-capa-rodape"><button type="button" class="membros-ver" data-acao="membros" data-id="${esc(c.id)}"><span class="membros">${textoMembros(c.total_membros)}</span><span class="membros-link">Ver membros</span></button>
        <button type="button" class="btn${dentro ? " btn-sec" : ""}" data-acao="participar" data-id="${esc(c.id)}" aria-pressed="${dentro}">${dentro ? "Participando" : "Participar"}</button></div>
        ${est.admin ? `<div class="clube-admin"><label class="clube-admin-btn">Trocar foto do clube<input type="file" id="foto-clube" accept="image/jpeg,image/png,image/webp,image/heic"></label>${foto ? '<button type="button" class="clube-admin-btn" id="tirar-foto-clube">Tirar foto</button>' : ""}<span>Só a administração vê estes botões.</span></div>` : ""}
      </section>
      <div id="clube-fixado"></div>
      ${!logado ? "" : dentro ? caixaPublicar({ clube: c.id }) : `<p class="convite-clube">Participe do clube para publicar e perguntar aqui.</p>`}
      ${logado ? `<nav class="abas-feed" aria-label="Seções do clube">
        <a href="${linkClube(c.id)}"${aba === "posts" ? ' aria-current="page"' : ""}>Publicações</a>
        <a href="${linkClube(c.id)}&aba=perguntas"${aba === "perguntas" ? ' aria-current="page"' : ""}>Perguntas e respostas</a>
      </nav>` : ""}
      <div id="feed"></div>`;
    // Publicação fixada pela administração (regras do clube): aparece para todos, logo abaixo da capa
    if (c.post_fixado) {
      const fx = await sb.from("posts").select(SEL).eq("id", c.post_fixado).maybeSingle();
      if (fx.data && !fx.data.removido) {
        await carregarMeusEstados([fx.data]);
        document.getElementById("clube-fixado").innerHTML = `<p class="selo-fixado"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 3 3v2h-4v6l-1 1-1-1v-6H7v-2l3-3z"/></svg>Fixado pela administração · regras do clube</p>${cartao(fx.data)}`;
        previasComentarios([fx.data]);
      }
    }
    ligarAdminClube(c);
    if (!logado) {
      // Visitante: vê a apresentação do clube; as publicações ficam para quem entra
      document.getElementById("feed").innerHTML = `<div class="clube-trancado">
        <span class="vazio-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg></span>
        <h2>As publicações do clube são para quem faz parte da Comunidade</h2>
        <p>Entre ou crie sua conta grátis para ver as fotos, as dúvidas e as conversas de ${esc(c.nome)}.</p>
        <div class="clube-trancado-botoes"><a class="btn" href="entrar.html?volta=${encodeURIComponent(location.pathname + location.search)}">Entrar</a><a class="btn btn-sec" href="cadastro.html?volta=${encodeURIComponent(location.pathname + location.search)}">Criar conta grátis</a></div>
      </div>`;
      return;
    }
    const l = lista(document.getElementById("feed"), { tipo: "clube", clube: c.id, soPerguntas: aba === "perguntas", excluir: c.post_fixado || null },
      vazio(aba === "perguntas" ? "Nenhuma pergunta no clube ainda" : "O clube está começando", aba === "perguntas" ? "Faça a primeira pergunta para os tutores do clube." : "Ainda não há publicações aqui. Participe e seja o primeiro a publicar!"));
    ligarPublicar((p) => { if (p.clube === c.id && (aba === "posts" || p.tipo === "pergunta")) l.inserirNoTopo(p); });
  }
  // Administração: trocar a foto do clube
  function ligarAdminClube(c) {
    const inp = document.getElementById("foto-clube");
    if (inp) inp.addEventListener("change", async () => {
      const arq = inp.files[0]; inp.value = "";
      if (!arq) return;
      try {
        const cortada = await C.enquadrar(arq, { redondo: true });
        if (!cortada) return;
        toast("Enviando a foto do clube…");
        const url = await C.enviarFoto(est.eu.id, "clube", cortada);
        const r = await sb.rpc("foto_do_clube", { p_clube: c.id, p_foto: url });
        if (r.error) { C.apagarFoto(url); toast(/foto_do_clube/.test(r.error.message || "") ? "Falta ativar a foto dos clubes no banco de dados." : erroMsg(r.error)); return; }
        if (fotoClube(c)) C.apagarFoto(c.foto_url);
        toast("Foto do clube atualizada.");
        telaClube(c.id);
      } catch (e) { toast(e.message || "Não deu para trocar a foto."); }
    });
    const tirar = document.getElementById("tirar-foto-clube");
    if (tirar) tirar.addEventListener("click", async () => {
      if (!confirm("Tirar a foto do clube?")) return;
      const r = await sb.rpc("foto_do_clube", { p_clube: c.id, p_foto: null });
      if (r.error) { toast(erroMsg(r.error)); return; }
      C.apagarFoto(c.foto_url);
      telaClube(c.id);
    });
  }


  const ESPECIES = { cachorro: "Cachorro", gato: "Gato", ave: "Ave", pequeno_mamifero: "Pequeno mamífero", reptil: "Réptil", peixe: "Peixe", outro: "Outro" };
  const SEXOS = { macho: "Macho", femea: "Fêmea" };

  async function telaPerfil(usuario) {
    if (usuario === "eu") {
      if (!exigir({ tipo: "perfil" })) { centro.innerHTML = vazio("Seu perfil", "Entre na sua conta para ver e editar seu perfil."); return; }
      usuario = est.eu.usuario;
    }
    centro.innerHTML = '<p class="carregando">Carregando…</p>';
    const r = await sb.from("perfis").select("id,usuario,nome,bio,cidade,estado,foto_url,criado_em").eq("usuario", usuario.toLowerCase()).maybeSingle();
    if (r.error || !r.data) { centro.innerHTML = vazio("Perfil não encontrado", "Esse tutor pode ter mudado o nome de usuário ou excluído a conta.", '<a class="btn" href="comunidade/">Voltar para a Comunidade</a>'); return; }
    const u = r.data;
    const ehEu = est.eu && est.eu.id === u.id;
    definirMeta(u.nome + " (@" + u.usuario + ") | Comunidade Abanô", u.bio || ("Perfil de " + u.nome + " na Comunidade Abanô."), linkPerfil(u.usuario));
    const [pets, clubes, seg1, seg2, orgR] = await Promise.all([
      sb.from("pets").select("*").eq("dono", u.id).order("criado_em"),
      sb.from("clube_membros").select("clube, clubes(id,nome)").eq("usuario", u.id),
      sb.from("seguidores").select("seguidor", { count: "exact", head: true }).eq("seguido", u.id),
      sb.from("seguidores").select("seguido", { count: "exact", head: true }).eq("seguidor", u.id),
      sb.from("organizacoes").select("id,nome,tipo,status").eq("dono", u.id).eq("status", "aprovada").maybeSingle()
    ]);
    const sigo = est.seguindo.has(u.id);
    const org = orgR && !orgR.error ? orgR.data : null;
    let pedidosNovos = 0;
    if (org && ehEu) {
      const pn = await sb.from("pedidos_adocao").select("id", { count: "exact", head: true }).eq("org", org.id).eq("status", "enviado");
      pedidosNovos = pn.count || 0;
    }
    const seloOrg = org ? `<a class="selo-ong" href="adocao.html" title="${esc(org.nome)}: verificada pela equipe do Abanô">${ICONE.verificado}<span>${org.tipo === "ong" ? "ONG verificada" : "Protetor verificado"}</span></a>` : "";
    const botoesEu = `<div class="perfil-botoes">${org ? `<a class="btn" href="ong.html#pedidos">Pedidos de adoção${pedidosNovos ? ` <b class="menu-num">${pedidosNovos > 99 ? "99+" : pedidosNovos}</b>` : ""}</a>` : ""}<a class="btn btn-sec" href="conta.html">Editar perfil</a></div>`;
    const local = [u.cidade, u.estado].filter(Boolean).join(" / ");
    centro.innerHTML = `
      ${voltar("comunidade/")}
      <section class="perfil-capa">
        ${avatar(u, "grande")}
        <div class="perfil-info">
          <h1>${esc(u.nome)}</h1>
          <p class="perfil-user">@${esc(u.usuario)}${local ? " · " + esc(local) : ""}</p>
          ${seloOrg}
          ${u.bio ? `<p class="perfil-bio">${esc(u.bio)}</p>` : ""}
          ${(pets.data || []).some((p) => p.doador_sangue) ? `<a class="perfil-doador" href="doador-de-sangue.html">${GOTA}<span>${(pets.data || []).some((p) => p.doador_sangue === "doador") ? "Família doadora de sangue" : "Família que quer doar sangue"}</span></a>` : ""}
          <p class="perfil-num"><b id="num-seguidores">${num(seg1.count)}</b> ${seg1.count === 1 ? "seguidor" : "seguidores"} · <b>${num(seg2.count)}</b> seguindo</p>
        </div>
        ${ehEu ? botoesEu : `<div class="perfil-botoes">${est.bloqueados.has(u.id) ? "" : `<button type="button" class="btn${sigo ? " btn-sec" : ""}" data-acao="seguir" data-id="${esc(u.id)}" aria-pressed="${sigo}">${sigo ? "Seguindo" : "Seguir"}</button><button type="button" class="btn btn-sec btn-msg" data-acao="mensagem" data-id="${esc(u.id)}" data-usuario="${esc(u.usuario)}">${ICONE.mensagem}<span>Mensagem</span></button>`}<button type="button" class="post-mais" data-acao="opcoes-perfil" data-id="${esc(u.id)}" data-usuario="${esc(u.usuario)}" aria-label="Mais opções: denunciar ou bloquear">${ICONE.mais}</button></div>`}
      </section>
      ${!ehEu && est.bloqueados.has(u.id) ? `<p class="convite-clube">Você bloqueou este perfil: as publicações e comentários dessa pessoa não aparecem para você. <button type="button" class="link-botao" data-acao="desbloquear" data-id="${esc(u.id)}">Desbloquear</button></p>` : ""}
      <section class="perfil-bloco">
        <h2>Pets</h2>
        ${(pets.data || []).length ? `<ul class="grade-pets">${pets.data.map((p) => `<li class="pet${p.doador_sangue === "doador" ? " pet-doador" : ""}">${avatar(p, "pet-av")}<b>${esc(p.nome)}</b><small>${esc([ESPECIES[p.especie], p.raca, p.idade, SEXOS[p.sexo]].filter(Boolean).join(" · "))}</small>${seloDoador(p)}${p.personalidade ? `<span class="pet-tag">${esc(p.personalidade)}</span>` : ""}${p.descricao ? `<p>${esc(p.descricao)}</p>` : ""}</li>`).join("")}</ul>`
          : `<p class="sub">${ehEu ? 'Você ainda não cadastrou pets. <a href="conta.html#pets">Adicionar pet</a>' : "Nenhum pet cadastrado ainda."}</p>`}
      </section>
      ${(clubes.data || []).length ? `<section class="perfil-bloco"><h2>Clubes</h2><p class="chips-clubes">${clubes.data.filter((x) => x.clubes).map((x) => `<a href="${linkClube(x.clubes.id)}">${esc(x.clubes.nome)}</a>`).join("")}</p></section>` : ""}
      <section class="perfil-bloco" id="publicacoes"><h2>Publicações</h2><div id="feed"></div></section>`;
    lista(document.getElementById("feed"), { tipo: "autor", autor: u.id }, vazio(ehEu ? "Você ainda não publicou" : "Nenhuma publicação ainda", ehEu ? "Volte ao feed e compartilhe algo com a comunidade." : "Quando " + esc(u.nome.split(" ")[0]) + " publicar, aparece aqui."));
    if (location.hash === "#publicacoes") setTimeout(() => document.getElementById("publicacoes").scrollIntoView(), 50);
  }

  // Selo de doador de sangue no cartão do pet (incentiva a comunidade a doar)
  const GOTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8s6.6 7 6.6 11.7a6.6 6.6 0 0 1-13.2 0C5.4 9.8 12 2.8 12 2.8z" fill="currentColor"/><path d="M12 10.6v6.2M8.9 13.7h6.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  const TIPO_SANGUE = { dea1_positivo: "DEA 1 positivo", dea1_negativo: "DEA 1 negativo", a: "Tipo A", b: "Tipo B", ab: "Tipo AB" };
  const seloDoador = (p) => !p.doador_sangue ? "" :
    `<span class="selo-doador${p.doador_sangue === "quer_ser" ? " quer" : ""}">${GOTA}${p.doador_sangue === "doador" ? "Doador de sangue" : "Quer ser doador"}</span>` +
    (p.tipo_sanguineo ? `<small class="tipo-sangue">${TIPO_SANGUE[p.tipo_sanguineo] || ""}</small>` : "");

  const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  // Encontrar tutores: busca por nome ou @usuário (todo o Brasil) e lista por estado
  async function telaTutores() {
    const termo = (q.get("q") || "").slice(0, 60);
    const uf = (q.get("uf") || (termo ? "" : (est.eu && est.eu.estado)) || "").toUpperCase();
    definirMeta("Encontrar tutores | Comunidade Abanô", "Busque tutores de cães, gatos e outros pets pelo nome ou @usuário, em qualquer estado.", "comunidade/?v=tutores");
    centro.innerHTML = `${voltar("comunidade/")}<header class="tela-topo"><h1>Encontrar tutores</h1><p>Busque pelo nome ou @usuário, em qualquer estado, ou veja quem mora perto de você.</p>
      <form class="busca-pessoas" id="busca-pessoas" role="search" action="comunidade/" method="get"><input type="hidden" name="v" value="tutores">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>
        <label class="sr" for="q-pessoas">Buscar pessoas</label>
        <input type="search" id="q-pessoas" name="q" value="${esc(termo)}" placeholder="Buscar por nome ou @usuário" autocomplete="off" enterkeyhint="search" maxlength="60">
      </form>
      <form class="filtro-uf" action="comunidade/" method="get"><input type="hidden" name="v" value="tutores"><label for="uf">Estado</label>
      <select id="uf" name="uf"><option value="">${termo ? "Todos os estados" : "Escolha o estado"}</option>${UFS.map((x) => `<option${x === uf ? " selected" : ""}>${x}</option>`).join("")}</select>
      <noscript><button class="btn">Ver</button></noscript></form></header><p class="sr" id="pessoas-status" aria-live="polite"></p><div id="tutores"></div>`;
    const box = document.getElementById("tutores"), campo = document.getElementById("q-pessoas"), sel = document.getElementById("uf");

    function linha(u) {
      const ehEu = est.eu && est.eu.id === u.id, sigo = est.seguindo.has(u.id);
      const local = [u.cidade, u.estado].filter(Boolean).join(" / ");
      return `<li><a class="pessoa" href="${linkPerfil(u.usuario)}">${avatar(u)}<span><b>${esc(u.nome)}</b><small>@${esc(u.usuario)}${local ? " · " + esc(local) : ""}</small></span></a>
        ${ehEu ? '<span class="pessoa-eu">Você</span>' : est.bloqueados.has(u.id) ? "" : `<button type="button" class="btn${sigo ? " btn-sec" : ""}" data-acao="seguir" data-id="${esc(u.id)}" aria-pressed="${sigo}">${sigo ? "Seguindo" : "Seguir"}</button>`}</li>`;
    }
    async function buscar(t, estado) {
      const r = await sb.rpc("buscar_pessoas", { p_termo: t, p_estado: estado || null });
      if (!r.error) return r;
      // Sem a função no banco ainda: busca simples (diferencia acentos)
      const limpo = t.replace(/^@/, "").replace(/[,()*%\\]/g, " ").trim();
      let consulta = sb.from("perfis").select("id,usuario,nome,cidade,estado,foto_url").or(`usuario.ilike.*${limpo}*,nome.ilike.*${limpo}*`).order("nome").limit(40);
      if (estado) consulta = consulta.eq("estado", estado);
      return consulta;
    }
    let vez = 0;
    async function mostrar() {
      const t = campo.value.trim(), estado = sel.value, minha = ++vez;
      const url = new URL(location.href);
      url.searchParams.set("v", "tutores");
      if (t) url.searchParams.set("q", t); else url.searchParams.delete("q");
      if (estado) url.searchParams.set("uf", estado); else url.searchParams.delete("uf");
      history.replaceState(history.state, "", url.pathname + url.search);
      sel.options[0].textContent = t ? "Todos os estados" : "Escolha o estado";
      if (t.replace(/^@/, "").length >= 2) {
        box.innerHTML = '<p class="carregando">Buscando…</p>';
        const r = await buscar(t, estado);
        if (minha !== vez) return;
        if (r.error) { box.innerHTML = vazio("Não deu para buscar", erroMsg(r.error)); return; }
        const lista = (r.data || []).filter((u) => !est.bloqueados.has(u.id));
        document.getElementById("pessoas-status").textContent = lista.length ? lista.length + (lista.length === 1 ? " pessoa encontrada" : " pessoas encontradas") : "Ninguém encontrado";
        box.innerHTML = lista.length ? `<ul class="lista-pessoas">${lista.map(linha).join("")}</ul>`
          : vazio("Ninguém encontrado com “" + esc(t) + "”", estado ? "Tente em todos os estados ou confira como se escreve o nome." : "Confira como se escreve o nome ou o @usuário. Só aparecem perfis públicos.");
        return;
      }
      if (t) { box.innerHTML = vazio("Digite pelo menos 2 letras", "Pode ser o nome ou o @usuário da pessoa."); return; }
      if (!UFS.includes(estado)) { box.innerHTML = vazio("Busque alguém ou escolha um estado", "Digite o nome ou o @usuário acima, ou escolha um estado para ver os tutores da região."); return; }
      box.innerHTML = '<p class="carregando">Carregando…</p>';
      const r = await sb.from("perfis").select("id,usuario,nome,cidade,estado,foto_url").eq("estado", estado).order("criado_em", { ascending: false }).limit(60);
      if (minha !== vez) return;
      if (r.error) { box.innerHTML = vazio("Não deu para carregar", erroMsg(r.error)); return; }
      box.innerHTML = r.data.length
        ? `<h2 class="pessoas-sub">Tutores de ${esc(estado)}</h2><ul class="grade-tutores">${r.data.map((u) => `<li><a href="${linkPerfil(u.usuario)}">${avatar(u)}<b>${esc(u.nome)}</b><small>${esc([u.cidade, u.estado].filter(Boolean).join(" / "))}</small></a></li>`).join("")}</ul>`
        : vazio("Ainda não há tutores de " + estado + " com perfil público", "Convide amigos tutores para a Comunidade Abanô!");
    }
    let espera;
    campo.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(mostrar, 300); });
    document.getElementById("busca-pessoas").addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(espera); mostrar(); });
    sel.addEventListener("change", mostrar);
    mostrar();
    if (!termo && !uf) campo.focus();
  }

  // ---------- Notificações (o sininho) ----------
  const TEXTO_AVISO = {
    curtida: (n) => n > 1 ? "curtiram sua publicação" : "curtiu sua publicação",
    comentario: () => "comentou na sua publicação",
    resposta: () => "respondeu seu comentário",
    curtida_comentario: (n) => n > 1 ? "curtiram seu comentário" : "curtiu seu comentário",
    seguidor: () => "começou a seguir você",
    pedido_adocao: (n, g) => `enviou um pedido para adotar <b>${esc(g.pet_nome || "um dos seus pets")}</b>. Toque para ver as respostas`,
    pedido_aceito: (n, g) => `aceitou seu pedido para adotar <b>${esc(g.pet_nome || "o pet")}</b>! O WhatsApp está liberado`,
    adocao_concluida: (n, g) => `concluiu a adoção de <b>${esc(g.pet_nome || "seu novo pet")}</b> 🎉 Que tal compartilhar essa alegria com a Comunidade?`
  };
  const ICONE_AVISO = {
    curtida: '<path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/>',
    curtida_comentario: '<path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/>',
    comentario: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17.5H9l-4.5 3.5v-3.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z"/>',
    resposta: '<path d="M10 8 4 13l6 5v-3.5c5 0 8 1 10 4.5 0-6-3-10-10-10z"/>',
    seguidor: '<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20a6.5 6.5 0 0 1 11.2-4.5M18.5 13v6M15.5 16h6"/>',
    pedido_adocao: '<path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>',
    pedido_aceito: '<path d="M3.5 11 12 4l8.5 7v8.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>',
    adocao_concluida: '<path d="M12 20.5s-8-4.9-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.7-8 10.6-8 10.6z"/>'
  };
  function agruparAvisos(lista) {
    // Curtidas no mesmo post (ou no mesmo comentário) viram um aviso só: "Fulana e mais 3 pessoas curtiram"
    const grupos = [], porChave = new Map();
    lista.forEach((n) => {
      const agrupa = n.tipo === "curtida" || n.tipo === "curtida_comentario";
      const chave = agrupa ? n.tipo + ":" + (n.comentario || n.post) : "u" + n.id;
      let g = porChave.get(chave);
      if (!g) { g = { ...n, pessoas: [], lida: true }; porChave.set(chave, g); grupos.push(g); }
      if (!g.pessoas.some((x) => x.de === n.de)) g.pessoas.push(n);
      if (!n.lida) g.lida = false;
    });
    return grupos;
  }
  function itemAviso(g) {
    const quem = g.pessoas[0], outros = g.pessoas.length - 1;
    const daOng = g.tipo === "pedido_aceito" || g.tipo === "adocao_concluida";
    const nomes = `<b>${esc(daOng ? (g.org_nome || quem.de_nome) : quem.de_nome)}</b>${outros ? ` e mais ${outros === 1 ? "1 pessoa" : outros + " pessoas"}` : ""}`;
    const link = g.tipo === "seguidor" ? linkPerfil(quem.de_usuario)
      : g.tipo === "pedido_adocao" ? "ong.html#pedidos"
      : g.tipo === "pedido_aceito" ? "adocao.html?v=pedidos"
      : g.tipo === "adocao_concluida" ? "adocao.html?v=pedidos&compartilhar=" + encodeURIComponent(g.pedido || "")
      : linkPost(g.post) + (g.comentario ? "#comentarios" : "");
    const trecho = g.tipo === "comentario" || g.tipo === "resposta" ? g.trecho_comentario : g.tipo === "curtida_comentario" ? g.trecho_comentario : g.tipo === "curtida" ? g.trecho_post : "";
    return `<li><a class="aviso${g.lida ? "" : " novo"}" href="${link}">
      <span class="aviso-av">${avatar({ nome: quem.de_nome, foto_url: quem.de_foto })}<span class="aviso-ico t-${g.tipo}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONE_AVISO[g.tipo] || ICONE_AVISO.curtida}</svg></span></span>
      <span class="aviso-txt">${nomes} ${(TEXTO_AVISO[g.tipo] || (() => "mandou um aviso"))(g.pessoas.length, g)}${trecho ? `: <span class="aviso-trecho">“${esc(trecho)}”</span>` : g.tipo === "adocao_concluida" ? "" : "."}<small>${tempo(g.criado_em)}</small></span>
    </a></li>`;
  }
  async function telaNotificacoes() {
    definirMeta("Notificações | Comunidade Abanô", null, "comunidade/?v=notificacoes");
    if (!exigir({ tipo: "notificacoes" })) { centro.innerHTML = vazio("Suas notificações", "Entre na sua conta para ver quem curtiu, comentou e começou a seguir você."); return; }
    centro.innerHTML = `${voltar("comunidade/")}<header class="tela-topo"><h1>Notificações</h1><p>Curtidas, comentários, respostas e novos seguidores.</p></header><ul class="avisos" id="avisos"><li class="carregando">Carregando…</li></ul>`;
    const r = await sb.rpc("minhas_notificacoes", { p_limite: 120 });
    const ul = document.getElementById("avisos");
    if (r.error) {
      ul.outerHTML = vazio("Notificações quase prontas", /minhas_notificacoes/.test(r.error.message || "") ? "Falta ativar as notificações no banco de dados do Abanô." : erroMsg(r.error));
      return;
    }
    const lista = (r.data || []).filter((n) => !est.bloqueados.has(n.de));
    const msgs = await sb.rpc("mensagens_nao_lidas");
    if (!msgs.error && msgs.data) ul.insertAdjacentHTML("beforebegin", `<a class="aviso-msgs" href="comunidade/?v=mensagens">${ICONE.mensagem}<span>Você tem <b>${msgs.data === 1 ? "1 mensagem nova" : num(msgs.data) + " mensagens novas"}</b></span></a>`);
    ul.innerHTML = lista.length ? agruparAvisos(lista).map(itemAviso).join("")
      : `<li class="avisos-vazio">${vazio("Nada por aqui ainda", "Quando alguém curtir, comentar ou começar a seguir você, aparece aqui.", '<a class="btn" href="comunidade/">Ir para o feed</a>')}</li>`;
    if (lista.some((n) => !n.lida)) { await sb.rpc("marcar_notificacoes_lidas"); contarAvisos(); }
  }
  // Contador do sininho (no menu da Comunidade e no topo do site)
  function atualizarSino(n) {
    const item = document.querySelector('.com-menu [data-rota="notificacoes"]');
    if (item && !item.querySelector("[data-sino-num]")) item.insertAdjacentHTML("beforeend", '<b class="menu-num" data-sino-num hidden></b>');
    document.querySelectorAll("[data-sino-num]").forEach((el) => { el.textContent = n > 99 ? "99+" : String(n || ""); el.hidden = !n; });
  }
  async function contarAvisos() {
    if (!est.eu) return;
    const [r, m] = await Promise.all([sb.rpc("notificacoes_nao_lidas"), sb.rpc("mensagens_nao_lidas")]);
    if (!r.error) atualizarSino(r.data || 0);
    const item = document.querySelector('.com-menu [data-rota="mensagens"]');
    if (item && !m.error) {
      let b = item.querySelector("[data-msg-num]");
      if (!b) { item.insertAdjacentHTML("beforeend", '<b class="menu-num" data-msg-num hidden></b>'); b = item.querySelector("[data-msg-num]"); }
      b.textContent = m.data > 99 ? "99+" : String(m.data || ""); b.hidden = !m.data;
    }
  }

  // ---------- Mensagens: lista de conversas e a conversa ----------
  const horaMsg = (iso) => {
    const d = new Date(iso), hoje = new Date();
    const h = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === hoje.toDateString() ? h : d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) + " " + h;
  };
  async function telaMensagens() {
    definirMeta("Mensagens | Comunidade Abanô", null, "comunidade/?v=mensagens");
    if (!exigir({ tipo: "mensagens" })) { centro.innerHTML = vazio("Suas mensagens", "Entre na sua conta para conversar com os tutores que você segue."); return; }
    if (q.get("conversa")) return telaConversa(q.get("conversa"));
    centro.innerHTML = `${voltar("comunidade/")}<header class="tela-topo"><h1>Mensagens</h1><p>Converse com os tutores que você segue. Para começar, abra o perfil de alguém e toque em Mensagem.</p></header><ul class="conversas" id="conversas"><li class="carregando">Carregando…</li></ul>`;
    const r = await sb.rpc("minhas_conversas");
    const ul = document.getElementById("conversas");
    if (r.error) { ul.outerHTML = vazio("Mensagens quase prontas", /minhas_conversas/.test(r.error.message || "") ? "Falta ativar as mensagens no banco de dados do Abanô." : erroMsg(r.error)); return; }
    const lista = (r.data || []).filter((c) => !est.bloqueados.has(c.outro));
    ul.innerHTML = lista.length ? lista.map((c) => `<li><a class="conversa-item${c.nao_lidas ? " nova" : ""}" href="comunidade/?v=mensagens&conversa=${encodeURIComponent(c.id)}">
        ${avatar({ nome: c.outro_nome, foto_url: c.outro_foto })}
        <span class="conversa-txt"><b>${esc(c.outro_nome)}</b><small>${c.ultima_texto ? (c.ultima_minha ? "Você: " : "") + esc(c.ultima_texto) : "Conversa iniciada"}</small></span>
        <span class="conversa-meta"><small>${tempo(c.ultima_em)}</small>${c.nao_lidas ? `<b class="menu-num">${c.nao_lidas}</b>` : ""}</span></a></li>`).join("")
      : `<li class="avisos-vazio">${vazio("Nenhuma conversa ainda", "Siga um tutor e toque em Mensagem no perfil dele para começar.", '<a class="btn" href="comunidade/?v=tutores">Encontrar tutores</a>')}</li>`;
  }
  async function telaConversa(id) {
    centro.innerHTML = '<p class="carregando">Carregando…</p>';
    const c = await sb.from("conversas").select("*").eq("id", id).maybeSingle();
    if (c.error || !c.data) { centro.innerHTML = vazio("Conversa não encontrada", "Ela pode ter sido apagada.", '<a class="btn" href="comunidade/?v=mensagens">Ver mensagens</a>'); return; }
    const outroId = c.data.pessoa_a === est.eu.id ? c.data.pessoa_b : c.data.pessoa_a;
    const o = (await sb.from("perfis").select("id,usuario,nome,foto_url").eq("id", outroId).maybeSingle()).data;
    if (!o) { centro.innerHTML = vazio("Perfil indisponível", "Esse tutor excluiu a conta ou o perfil não está disponível.", '<a class="btn" href="comunidade/?v=mensagens">Ver mensagens</a>'); return; }
    definirMeta("Conversa com " + o.nome + " | Comunidade Abanô", null, "comunidade/?v=mensagens");
    const bloqueado = est.bloqueados.has(o.id);
    centro.innerHTML = `<section class="chat">
      <header class="chat-topo"><a class="chat-voltar" href="comunidade/?v=mensagens" aria-label="Voltar para as mensagens"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></a>
        <a class="chat-quem" href="${linkPerfil(o.usuario)}">${avatar(o)}<span><b>${esc(o.nome)}</b><small>@${esc(o.usuario)}</small></span></a></header>
      <div class="chat-corpo" id="chat-corpo"><button type="button" class="link-botao chat-antigas" id="chat-antigas" hidden>Carregar mensagens anteriores</button><ol class="chat-lista" id="chat-lista" aria-live="polite"></ol></div>
      ${bloqueado ? '<p class="convite-clube">Você bloqueou este perfil. Desbloqueie para voltar a conversar.</p>' : `<form class="chat-form" id="chat-form">
        <label class="sr" for="chat-texto">Mensagem para ${esc(o.nome)}</label>
        <textarea id="chat-texto" rows="1" maxlength="2000" placeholder="Escreva uma mensagem…" enterkeyhint="send"></textarea>
        <button type="submit" class="btn" disabled aria-label="Enviar">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 20 4l-5 16-3.5-6.5z"/></svg>'}</button>
      </form>`}
      <p class="chat-nota">Nunca envie senhas ou pague nada a quem você não conhece. Viu algo estranho? Bloqueie ou denuncie pelo perfil.</p>
    </section>`;
    const ol = document.getElementById("chat-lista"), corpo = document.getElementById("chat-corpo");
    let primeiro = null, ultimo = 0;
    const item = (m) => `<li class="msg${m.autor === est.eu.id ? " minha" : ""}" data-id="${m.id}"><p>${esc(m.texto)}</p><time datetime="${esc(m.criado_em)}">${horaMsg(m.criado_em)}</time></li>`;
    function noFim() { corpo.scrollTop = corpo.scrollHeight; }
    async function carregar(antes) {
      let qy = sb.from("mensagens").select("*").eq("conversa", id).order("id", { ascending: false }).limit(50);
      if (antes) qy = qy.lt("id", antes);
      const r = await qy;
      if (r.error) { toast(erroMsg(r.error)); return; }
      const msgs = (r.data || []).reverse();
      if (!msgs.length) { if (!antes) ol.innerHTML = `<li class="chat-vazio">Diga olá para ${esc(o.nome.split(" ")[0])}! 👋</li>`; return; }
      const altura = corpo.scrollHeight;
      ol.insertAdjacentHTML(antes ? "afterbegin" : "beforeend", msgs.map(item).join(""));
      primeiro = msgs[0].id;
      if (!antes) { ultimo = msgs[msgs.length - 1].id; noFim(); } else corpo.scrollTop = corpo.scrollHeight - altura;
      document.getElementById("chat-antigas").hidden = (r.data || []).length < 50;
    }
    async function novas() {
      if (document.hidden) return;
      const r = await sb.from("mensagens").select("*").eq("conversa", id).gt("id", ultimo).order("id").limit(50);
      if (r.error || !r.data || !r.data.length) return;
      const v = ol.querySelector(".chat-vazio"); if (v) v.remove();
      const perto = corpo.scrollHeight - corpo.scrollTop - corpo.clientHeight < 120;
      r.data.filter((m) => !ol.querySelector(`[data-id="${m.id}"]`)).forEach((m) => ol.insertAdjacentHTML("beforeend", item(m)));
      ultimo = r.data[r.data.length - 1].id;
      if (perto) noFim();
      if (r.data.some((m) => m.autor !== est.eu.id)) { await sb.rpc("ler_conversa", { p_conversa: id }); contarAvisos(); }
    }
    await carregar();
    await sb.rpc("ler_conversa", { p_conversa: id }); contarAvisos();
    document.getElementById("chat-antigas").addEventListener("click", () => carregar(primeiro));
    const timer = setInterval(novas, 4000);
    window.addEventListener("pagehide", () => clearInterval(timer));
    const f = document.getElementById("chat-form");
    if (!f) return;
    const ta = f.querySelector("textarea"), bt = f.querySelector("button");
    const ajustar = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; bt.disabled = !ta.value.trim(); };
    ta.addEventListener("input", ajustar);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const texto = ta.value.trim(); if (!texto) return;
      bt.disabled = true;
      const r = await sb.rpc("enviar_mensagem", { p_conversa: id, p_texto: texto });
      if (r.error) { bt.disabled = false; toast(erroMsg(r.error)); return; }
      ta.value = ""; ajustar();
      const v = ol.querySelector(".chat-vazio"); if (v) v.remove();
      const m = Array.isArray(r.data) ? r.data[0] : r.data;
      if (m && !ol.querySelector(`[data-id="${m.id}"]`)) { ol.insertAdjacentHTML("beforeend", item(m)); ultimo = Math.max(ultimo, m.id); }
      noFim(); ta.focus();
    });
    if (window.matchMedia("(hover: hover)").matches) ta.focus();
  }

  function telaSalvos() {
    definirMeta("Salvos | Comunidade Abanô", null, "comunidade/?v=salvos");
    if (!exigir({ tipo: "salvos" })) { centro.innerHTML = vazio("Suas publicações salvas", "Entre na sua conta para ver o que você salvou."); return; }
    centro.innerHTML = voltar("comunidade/") + '<header class="tela-topo"><h1>Salvos</h1><p>Só você vê o que salvou.</p></header><div id="feed"></div>';
    lista(document.getElementById("feed"), { tipo: "salvos" }, vazio("Nada salvo ainda", "Toque no marcador de uma publicação para guardar e ler depois."));
  }

  // ---------- Coluna lateral ----------
  async function lateral() {
    const ev = document.getElementById("lado-eventos"), cl = document.getElementById("lado-clubes");
    const [e, c] = await Promise.all([
      sb.from("eventos").select("*").gte("inicio", new Date().toISOString()).order("inicio").limit(3),
      sb.from("clubes").select("*").order("total_membros", { ascending: false }).order("ordem").limit(7)
    ]);
    if (ev) ev.innerHTML = (e.data || []).length
      ? `<ul class="lado-lista">${e.data.map((x) => `<li><b>${esc(x.titulo)}</b><small>${new Date(x.inicio).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}${x.cidade ? " · " + esc(x.cidade) + (x.estado ? "/" + esc(x.estado) : "") : ""}</small>${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">Saiba mais</a>` : ""}</li>`).join("")}</ul>`
      : '<p class="sub">Nenhum evento marcado ainda. Organiza um encontro pet? <a href="anuncie.html">Divulgue no Abanô</a>.</p>';
    if (cl) cl.innerHTML = (c.data || []).length
      ? `<ul class="lado-lista">${c.data.map((x) => `<li data-clube="${esc(x.id)}"><a href="${linkClube(x.id)}"><b>${esc(x.nome)}</b></a><small class="membros">${textoMembros(x.total_membros)}</small></li>`).join("")}</ul><a class="ver-todos" href="comunidade/?v=clubes">Ver todos os clubes</a>`
      : '<p class="sub">Não deu para carregar os clubes.</p>';
    alertasPerto();
  }

  // Pets desaparecidos no estado de quem está vendo (ou no Brasil todo, para visitantes)
  async function alertasPerto() {
    const lado = document.querySelector(".com-lado");
    if (!lado || document.getElementById("lado-perdidos")) return;
    const uf = est.eu && est.eu.estado;
    const r = await sb.rpc("alertas_lista", { p_estado: uf || null, p_tipo: null, p_status: "ativo" });
    if (r.error || !r.data || !r.data.length) return;
    const pasta = SUPABASE_URL + "/storage/v1/object/public/fotos/";
    const caixa = document.createElement("section");
    caixa.className = "lado-caixa lado-perdidos";
    caixa.id = "lado-perdidos";
    caixa.innerHTML = `<h2>Pets desaparecidos${uf ? " em " + esc(uf) : ""}</h2><ul class="lado-alertas">${r.data.slice(0, 3).map((x) =>
      `<li><a href="perdidos.html?a=${esc(x.id)}">${String(x.foto_url || "").indexOf(pasta) === 0 ? `<img src="${esc(x.foto_url)}" alt="" loading="lazy">` : "<span></span>"}<span><b>${esc(x.nome || (x.tipo === "encontrado" ? "Pet encontrado" : "Pet"))}</b><small><em class="${x.tipo}">${x.tipo === "perdido" ? "Perdido" : "Encontrado"}</em> · ${esc(x.bairro)}, ${esc(x.cidade)}</small></span></a></li>`).join("")}</ul>
      <a class="ver-todos" href="perdidos.html">Ver todos os alertas</a>`;
    const pesquisa = lado.querySelector(".lado-pesquisa");
    lado.insertBefore(caixa, pesquisa ? pesquisa.nextSibling : lado.firstChild);
  }

  function marcarMenu() {
    let rotaAtual = "feed";
    if (q.get("f") === "perguntas") rotaAtual = "perguntas";
    else if (q.get("v") === "clubes") rotaAtual = q.get("meus") ? "meus-clubes" : "clubes";
    else if (q.get("v")) rotaAtual = q.get("v");
    else if (q.get("u") === "eu" || (est.eu && q.get("u") === est.eu.usuario)) rotaAtual = location.hash === "#publicacoes" ? "publicacoes" : "perfil";
    else if (q.get("c")) rotaAtual = "clubes";
    document.querySelectorAll(".com-menu [data-rota]").forEach((a) => {
      if (a.dataset.rota === rotaAtual) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function rota() {
    if (q.get("p")) return telaPost(q.get("p"));
    if (q.get("c")) return telaClube(q.get("c"));
    if (q.get("u")) return telaPerfil(q.get("u"));
    const v = q.get("v");
    if (v === "clubes") return telaClubes(!!q.get("meus"));
    if (v === "tutores") return telaTutores();
    if (v === "salvos") return telaSalvos();
    if (v === "notificacoes") return telaNotificacoes();
    if (v === "mensagens") return telaMensagens();
    return telaFeed();
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) contarAvisos(); });
  setTimeout(contarAvisos, 1500);
  (async function iniciar() {
    const [, nomes] = await Promise.all([carregarEu(), sb.from("clubes").select("id,nome")]);
    (nomes.data || []).forEach((x) => { nomesClubes[x.id] = x.nome; });
    if (est.eu && est.eu.suspenso) {
      const aviso = document.getElementById("com-aviso-suspenso");
      if (aviso) aviso.hidden = false;
    }
    if (est.eu && (!est.eu.aceitou || !est.eu.estado)) {
      const aviso = document.getElementById("com-aviso-conta");
      if (aviso) {
        aviso.hidden = false;
        const link = aviso.querySelector("a");
        link.href = "conta.html?volta=" + encodeURIComponent(aqui());
        if (est.eu.aceitou) link.textContent = "informe o estado onde você mora";
      }
    }
    marcarMenu();
    await Promise.all([lateral(), rota()]);
    executarPendente();
  })();
})();
