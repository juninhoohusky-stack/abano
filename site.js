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

/* ---------- Páginas internas: movimento com Motion + neurodesign ----------
   Usa o Motion (window.Motion, carregado antes deste arquivo). Os blocos do <main>
   entram com mola quando aparecem na tela; o título entra palavra por palavra;
   listas e ícones entram em sequência. Também liga a aura, a luz nos cartões e o
   brilho no botão principal.
   Fica de fora: a página inicial (tem a própria animação), páginas sem Motion
   e quem pediu menos movimento no aparelho. */
(function () {
  var main = document.querySelector('main');
  var M = window.Motion;
  if (!main || !M || !M.animate || document.querySelector('[data-revelar]')) return;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var alturaTela = window.innerHeight || 800;
  // Se a página já foi desenhada, o que está na tela fica como está (sem piscar)
  var jaPintou = performance.getEntriesByType && performance.getEntriesByType('paint').length > 0;
  var lista = function (x) { return Array.prototype.slice.call(x); };
  var mola = { type: 'spring', bounce: 0.32, duration: 0.9 };
  var molaSalto = { type: 'spring', bounce: 0.55, duration: 0.7 };
  function com(base, extra) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in extra) o[k] = extra[k]; return o; }

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
  // Antes do primeiro desenho, as entradas antigas (.surge) passam para o Motion
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

  // Título: cada palavra vira um <span> para entrar em sequência
  function quebrarPalavras(h) {
    var palavras = [];
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    (function andar(no) {
      lista(no.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          if (!n.textContent.trim()) return;
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (!p.trim()) { frag.appendChild(document.createTextNode(p)); return; }
            var s = document.createElement('span');
            s.className = 'palavra';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = p;
            frag.appendChild(s);
            palavras.push(s);
          });
          no.replaceChild(frag, n);
        } else if (n.nodeType === 1 && !/^(BR|SVG|IMG)$/i.test(n.tagName)) {
          andar(n);
        }
      });
    })(h);
    return palavras;
  }

  function esconder(nos, transform) {
    nos.forEach(function (n) {
      n.style.transition = 'none';
      n.style.opacity = '0';
      n.style.transform = transform;
    });
  }
  function limpar(nos) {
    nos.forEach(function (n) { n.style.opacity = ''; n.style.transform = ''; n.style.transition = ''; });
  }

  // ---------- Estado inicial (escondido) ----------
  var pendentes = [];
  blocos.forEach(function (el) {
    if (jaPintou && el.getBoundingClientRect().top < alturaTela) return;
    var info = { el: el, palavras: null, itens: [], icones: [], pop: [] };
    if (el.tagName === 'H1') {
      info.palavras = quebrarPalavras(el);
      esconder(info.palavras, 'translateY(24px)');
    } else {
      esconder([el], 'translateY(28px)');
    }
    // Itens de lista e cartões lado a lado entram em sequência
    var itens = el.matches('.familia, .atalhos') ? el.children
      : el.querySelectorAll(':scope > li, :scope ul > li, :scope .familia > *, :scope .atalhos > *');
    // Listas com animação própria (ex.: resultado da calculadora) ficam de fora
    info.itens = lista(itens).filter(function (it) { return !it.closest('[data-motion-proprio]'); });
    esconder(info.itens, 'translateY(14px)');
    // O "check" de cada item aparece com um pulinho (sensação de conquista)
    info.icones = info.itens.map(function (li) { return li.querySelector(':scope > svg'); }).filter(Boolean);
    esconder(info.icones, 'scale(0)');
    // Ícone do serviço entra girando de leve
    info.pop = lista(el.querySelectorAll('.ico'));
    esconder(info.pop, 'scale(.4) rotate(-14deg)');
    el.__neuro = info;
    pendentes.push(info);
  });
  if (!pendentes.length) return;

  // ---------- Entrada com Motion ----------
  function mostrar(info, ordem, semAnimar) {
    var k = pendentes.indexOf(info);
    if (k < 0) return;
    pendentes.splice(k, 1);
    obs.unobserve(info.el);

    var alvo = info.palavras || [info.el];
    var todos = alvo.concat(info.itens, info.icones, info.pop);
    if (semAnimar) { limpar(todos); return; }

    var base = ordem * 0.08;
    var anims = [
      M.animate(alvo, { opacity: [0, 1], y: [info.palavras ? 24 : 28, 0] },
        com(mola, { delay: info.palavras ? M.stagger(0.06, { startDelay: base }) : base }))
    ];
    if (info.itens.length) anims.push(M.animate(info.itens, { opacity: [0, 1], y: [14, 0] },
      com(mola, { delay: M.stagger(0.07, { startDelay: base + 0.18 }) })));
    if (info.icones.length) anims.push(M.animate(info.icones, { opacity: [0, 1], scale: [0, 1], rotate: [-25, 0] },
      com(molaSalto, { delay: M.stagger(0.07, { startDelay: base + 0.32 }) })));
    if (info.pop.length) anims.push(M.animate(info.pop, { opacity: [0, 1], scale: [0.4, 1], rotate: [-14, 0] },
      com(molaSalto, { delay: base + 0.12 })));

    Promise.all(anims.map(function (a) { return a.finished; })).then(function () { limpar(todos); }, function () { limpar(todos); });
  }

  var obs = new IntersectionObserver(function (entradas) {
    var ordem = 0;
    entradas.forEach(function (en) {
      var info = en.target.__neuro;
      if (!info) return;
      if (en.isIntersecting) mostrar(info, ordem++);
      else if (en.boundingClientRect.top < 0) mostrar(info, 0, true);   // já ficou para trás
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  pendentes.forEach(function (info) { obs.observe(info.el); });

  // Pulos na página (link para uma seção, vídeo que carrega e empurra o texto)
  // podem levar um bloco de baixo para cima da tela sem ele passar por ela.
  var conferindo = false;
  window.addEventListener('scroll', function () {
    if (conferindo || !pendentes.length) return;
    conferindo = true;
    requestAnimationFrame(function () {
      conferindo = false;
      pendentes.slice().forEach(function (info) {
        if (info.el.getBoundingClientRect().bottom < 0) mostrar(info, 0, true);
      });
    });
  }, { passive: true });
})();
