/* Abanô — comportamento compartilhado do topo */
(function () {
  var topo = document.querySelector('.topo');
  var nav = document.querySelector('.abas');
  if (!topo || !nav) return;

  // Sombra no topo só depois que a página rola
  function aoRolar() { topo.classList.toggle('rolou', window.scrollY > 4); }
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  // ---------- Submenus "Serviços" e "Mais" ----------
  var grupos = Array.prototype.slice.call(nav.querySelectorAll('.grupo-menu'));
  function fecharTodos(exceto) {
    grupos.forEach(function (g) {
      if (g === exceto) return;
      g.classList.remove('aberto');
      var b = g.querySelector('.aba-menu');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  grupos.forEach(function (g) {
    var botao = g.querySelector('.aba-menu');
    if (!botao) return;
    botao.addEventListener('click', function (e) {
      e.stopPropagation();
      var abrir = !g.classList.contains('aberto');
      fecharTodos(g);
      g.classList.toggle('aberto', abrir);
      botao.setAttribute('aria-expanded', String(abrir));
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.grupo-menu')) fecharTodos();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') fecharTodos();
  });

  // ---------- Pílula que desliza da aba anterior até a aba atual ----------
  var abas = Array.prototype.slice.call(nav.querySelectorAll('.aba'));
  var pilula = nav.querySelector('.aba-pilula');
  var atual = abas.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; });

  Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
    a.addEventListener('click', function () {
      try { sessionStorage.setItem('abano-aba', String(atual)); } catch (e) {}
    });
  });

  if (!pilula || atual < 0) return;

  function colocar(i, semAnimar) {
    var a = abas[i];
    if (!a.offsetWidth) return;                       // aba escondida nesta tela
    var x = a.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    if (semAnimar) pilula.style.transition = 'none';
    pilula.style.transform = 'translateX(' + x + 'px)';
    pilula.style.width = a.offsetWidth + 'px';
    if (semAnimar) { pilula.getBoundingClientRect(); pilula.style.transition = ''; }
  }

  var anterior = -1;
  try {
    anterior = parseInt(sessionStorage.getItem('abano-aba') || '-1', 10);
    sessionStorage.removeItem('abano-aba');
  } catch (e) {}

  var poucoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  nav.classList.add('com-pilula');

  if (anterior >= 0 && anterior < abas.length && anterior !== atual && abas[anterior].offsetWidth && !poucoMovimento) {
    colocar(anterior, true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { colocar(atual); }); });
  } else {
    colocar(atual, true);
  }

  // Reajusta quando as fontes carregam ou a tela muda de tamanho
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { colocar(atual); });
  window.addEventListener('resize', function () { colocar(atual, true); });
})();

/* ---------- Páginas internas: movimento com GSAP + neurodesign ----------
   Usa o GSAP (window.gsap, com ScrollTrigger e SplitText, carregados antes deste
   arquivo). Os blocos do <main> entram com mola quando aparecem na tela; o título
   entra palavra por palavra; listas e ícones entram em sequência. Também liga a
   aura, a luz nos cartões e o brilho no botão principal.
   Fica de fora: a página inicial (tem a própria animação), páginas sem GSAP
   e quem pediu menos movimento no aparelho. */
(function () {
  var main = document.querySelector('main');
  var G = window.gsap;
  if (!main || !G || document.querySelector('[data-revelar]')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var ST = window.ScrollTrigger, Split = window.SplitText;
  if (ST) G.registerPlugin(ST);
  if (Split) G.registerPlugin(Split);

  // Tempos e curvas num lugar só (o movimento do site inteiro fala a mesma língua)
  var DURACAO = 0.8, MOLA = 'back.out(1.4)', SALTO = 'back.out(2.2)', SUAVE = 'power3.out';
  var PASSO_PALAVRA = 0.06, PASSO_ITEM = 0.07, PASSO_BLOCO = 0.08;

  var alturaTela = window.innerHeight || 800;
  // Se a página já foi desenhada, o que está na tela fica como está (sem piscar)
  var jaPintou = performance.getEntriesByType && performance.getEntriesByType('paint').length > 0;
  var lista = function (x) { return Array.prototype.slice.call(x); };

  // ---------- Neurodesign ----------
  // Aura: brilhos que "respiram" atrás do topo
  var aura = document.createElement('div');
  aura.className = 'aura';
  aura.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(aura, document.body.firstChild);

  // Cartões com luz que segue o cursor
  // Só cartões soltos na página (na calculadora, ".bloco" é parte do formulário)
  lista(main.querySelectorAll('main > .bloco, main > .avise, main > .faixa-cta, .pet, .atalhos > *')).forEach(function (c) { c.classList.add('luz'); });
  document.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.luz');
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--x', (e.clientX - r.left) + 'px');
    c.style.setProperty('--y', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // Botão principal com reflexo
  lista(main.querySelectorAll('.btn:not(.btn-sec)')).forEach(function (b) { b.classList.add('brilha'); });

  // ---------- Quais blocos animar ----------
  // Antes do primeiro desenho, as entradas antigas (.surge) passam para o GSAP
  if (!jaPintou) lista(main.querySelectorAll('.surge')).forEach(function (el) { el.classList.remove('surge'); });

  var blocos = [];
  function pular(el) {
    return el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.hidden ||
      el.classList.contains('surge') || el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
  }
  function juntar(pai, nivel) {
    var filhos = lista(pai.children).filter(function (el) { return !pular(el); });
    // Embrulho com um filho só (section > .wrap > div): desce um nível
    if (filhos.length === 1 && filhos[0].children.length && nivel < 4) return juntar(filhos[0], nivel + 1);
    filhos.forEach(function (el) {
      var temSurge = el.querySelector('.surge');
      var muitoAlto = el.offsetHeight > alturaTela * 1.2 && el.children.length > 1;
      // Bloco com entrada própria por dentro, ou texto longo: anima parte por parte
      if ((temSurge || muitoAlto) && nivel < 4) juntar(el, nivel + 1);
      else if (!temSurge) blocos.push(el);
    });
  }
  juntar(main, 0);
  if (!blocos.length) return;

  // ---------- Estado inicial (escondido) ----------
  var pendentes = [];
  blocos.forEach(function (el) {
    if (jaPintou && el.getBoundingClientRect().top < alturaTela) return;
    var info = { el: el, split: null, palavras: null, itens: [], icones: [], pop: [] };
    if (el.tagName === 'H1' && Split) {
      // Título palavra por palavra; o texto original volta inteiro no fim (leitor de tela e Google)
      info.split = new Split(el, { type: 'words', wordsClass: 'palavra' });
      info.palavras = info.split.words;
      G.set(info.palavras, { opacity: 0, y: 24 });
    } else {
      G.set(el, { opacity: 0, y: 28 });
    }
    // Itens de lista e cartões lado a lado entram em sequência
    var itens = el.matches('.familia, .atalhos') ? el.children
      : el.querySelectorAll(':scope > li, :scope ul > li, :scope .familia > *, :scope .atalhos > *');
    // Listas com animação própria (ex.: resultado da calculadora) ficam de fora
    info.itens = lista(itens).filter(function (it) { return !it.closest('[data-motion-proprio]'); });
    if (info.itens.length) G.set(info.itens, { opacity: 0, y: 14 });
    // O "check" de cada item aparece com um pulinho (sensação de conquista)
    info.icones = info.itens.map(function (li) { return li.querySelector(':scope > svg'); }).filter(Boolean);
    if (info.icones.length) G.set(info.icones, { opacity: 0, scale: 0 });
    // Ícone do serviço entra girando de leve
    info.pop = lista(el.querySelectorAll('.ico'));
    if (info.pop.length) G.set(info.pop, { opacity: 0, scale: 0.4, rotation: -14 });
    el.__neuro = info;
    pendentes.push(info);
  });
  if (!pendentes.length) return;

  // ---------- Entrada ----------
  function terminar(info) {
    var todos = (info.palavras || [info.el]).concat(info.itens, info.icones, info.pop);
    G.set(todos, { clearProps: 'opacity,transform' });
    if (info.split) { info.split.revert(); info.split = null; }
  }

  function mostrar(info, ordem, semAnimar) {
    var k = pendentes.indexOf(info);
    if (k < 0) return;
    pendentes.splice(k, 1);
    if (semAnimar) { terminar(info); return; }

    var tl = G.timeline({ delay: ordem * PASSO_BLOCO, defaults: { duration: DURACAO, ease: MOLA }, onComplete: function () { terminar(info); } });
    tl.to(info.palavras || info.el, { opacity: 1, y: 0, stagger: info.palavras ? PASSO_PALAVRA : 0, ease: info.palavras ? SUAVE : MOLA });
    if (info.pop.length) tl.to(info.pop, { opacity: 1, scale: 1, rotation: 0, ease: SALTO, duration: 0.7 }, 0.12);
    if (info.itens.length) tl.to(info.itens, { opacity: 1, y: 0, stagger: PASSO_ITEM }, 0.18);
    if (info.icones.length) tl.to(info.icones, { opacity: 1, scale: 1, ease: SALTO, duration: 0.6, stagger: PASSO_ITEM }, 0.32);
  }

  // Garantia: se a animação não rodar (aba aberta em segundo plano, conexão lenta),
  // o que está na tela aparece mesmo assim — o texto nunca fica invisível
  setTimeout(function () {
    pendentes.slice().forEach(function (info) {
      if (info.el.getBoundingClientRect().top < window.innerHeight) mostrar(info, 0, true);
    });
  }, 2500);

  // Revela em grupos quando entram na tela; ao pular a página (link, vídeo que
  // empurra o texto), os blocos que ficaram para trás aparecem sem animar
  if (ST) {
    ST.batch(pendentes.map(function (i) { return i.el; }), {
      start: 'top 92%',
      once: true,
      onEnter: function (els) { els.forEach(function (el, i) { mostrar(el.__neuro, i); }); },
      onEnterBack: function (els) { els.forEach(function (el) { mostrar(el.__neuro, 0, true); }); }
    });
    window.addEventListener('load', function () { ST.refresh(); });
  } else {
    pendentes.slice().forEach(function (info, i) { mostrar(info, i); });
  }
})();

/* ---------- Conta no topo: "Entrar" para visitantes, "Minha conta" para quem está conectado ----------
   Só olha se há sessão salva neste navegador; não carrega o login em todas as páginas. */
(function () {
  var cta = document.querySelector(".topo-cta");
  if (!cta) return;
  var conectado = false;
  try { conectado = !!localStorage.getItem("sb-igpwzidpiypzukmnskdb-auth-token"); } catch (e) {}
  var pagina = location.pathname.split("/").pop();
  if (conectado) {
    cta.textContent = "Minha conta";
    cta.href = "conta.html";
    if (pagina === "conta.html") cta.setAttribute("aria-current", "page"); else cta.removeAttribute("aria-current");
    return;
  }
  if (pagina === "entrar.html") return;
  var entrar = document.createElement("a");
  entrar.href = "entrar.html";
  entrar.className = "topo-entrar";
  entrar.textContent = "Entrar";
  cta.parentNode.insertBefore(entrar, cta);
})();
