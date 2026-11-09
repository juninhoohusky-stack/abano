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
