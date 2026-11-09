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

/* ---------- Revelação ao rolar nas páginas internas ----------
   Acha sozinha os blocos do <main> e faz cada um aparecer quando entra na tela.
   Fica de fora: a página inicial (tem a própria animação), o que já tem .surge,
   o que está escondido e quem pediu menos movimento no aparelho. */
(function () {
  var main = document.querySelector('main');
  if (!main || document.querySelector('[data-revelar]')) return;
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var alturaTela = window.innerHeight || 800;
  var blocos = [];

  function pular(el) {
    return el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.hidden ||
      el.classList.contains('surge') || el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
  }
  function juntar(pai, nivel) {
    var filhos = Array.prototype.filter.call(pai.children, function (el) { return !pular(el); });
    // Embrulho com um filho só (section > .wrap > div): desce um nível
    if (filhos.length === 1 && filhos[0].children.length && nivel < 4) return juntar(filhos[0], nivel + 1);
    filhos.forEach(function (el) {
      var temSurge = el.querySelector('.surge');
      var muitoAlto = el.offsetHeight > alturaTela * 1.2 && el.children.length > 1;
      // Bloco com entrada própria por dentro, ou texto longo: revela parte por parte
      if ((temSurge || muitoAlto) && nivel < 4) juntar(el, nivel + 1);
      else if (!temSurge) blocos.push(el);
    });
  }
  juntar(main, 0);
  if (!blocos.length) return;

  // Se a página já foi desenhada, o que está na tela fica como está (sem piscar)
  var jaPintou = performance.getEntriesByType && performance.getEntriesByType('paint').length > 0;

  var pendentes = [];
  function mostrar(el, semAnimar) {
    if (semAnimar) {
      el.style.transition = 'none';
      Array.prototype.forEach.call(el.querySelectorAll('.ra-f'), function (it) { it.style.transition = 'none'; });
    }
    el.classList.add('visivel');
    obs.unobserve(el);
    var k = pendentes.indexOf(el);
    if (k >= 0) pendentes.splice(k, 1);
  }
  var obs = new IntersectionObserver(function (entradas) {
    var i = 0;
    entradas.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.style.setProperty('--d', String(i++));
        mostrar(en.target);
      } else if (en.boundingClientRect.top < 0) {
        mostrar(en.target, true);   // já ficou para trás: aparece sem animar
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  // Pulos na página (link para uma seção, vídeo que carrega e empurra o texto)
  // podem levar um bloco de baixo para cima da tela sem ele passar por ela.
  var conferindo = false;
  window.addEventListener('scroll', function () {
    if (conferindo || !pendentes.length) return;
    conferindo = true;
    requestAnimationFrame(function () {
      conferindo = false;
      pendentes.slice().forEach(function (el) {
        if (el.getBoundingClientRect().bottom < 0) mostrar(el, true);
      });
    });
  }, { passive: true });

  var marcados = [];
  blocos.forEach(function (el) {
    if (jaPintou && el.getBoundingClientRect().top < alturaTela) return;
    el.style.transition = 'none';   // esconde na hora, sem animar o "sumir"
    el.classList.add('ra');
    marcados.push(el);
    // Itens de lista e cartões lado a lado entram em sequência
    var itens = el.matches('.familia, .atalhos') ? el.children
      : el.querySelectorAll(':scope > li, :scope ul > li, :scope .familia > *, :scope .atalhos > *');
    Array.prototype.forEach.call(itens, function (it, k) {
      if (it.closest('.ra') !== el) return;
      it.style.transition = 'none';
      it.classList.add('ra-f');
      it.style.setProperty('--f', String(Math.min(k, 8)));
    });
  });
  if (!marcados.length) return;

  // Aplica o estado escondido de uma vez e devolve as transições para a entrada
  void document.body.offsetHeight;
  marcados.forEach(function (el) {
    el.style.transition = '';
    Array.prototype.forEach.call(el.querySelectorAll('.ra-f'), function (it) { it.style.transition = ''; });
    pendentes.push(el);
    obs.observe(el);
  });
})();
