/* Abanô — comportamento compartilhado do topo */
(function () {
  var topo = document.querySelector('.topo');
  var nav = document.querySelector('.abas');
  if (!topo || !nav) return;

  // Sombra no topo só depois que a página rola
  function aoRolar() { topo.classList.toggle('rolou', window.scrollY > 4); }
  window.addEventListener('scroll', aoRolar, { passive: true });
  aoRolar();

  // Pílula que desliza da aba anterior até a aba atual
  var abas = Array.prototype.slice.call(nav.querySelectorAll('.aba'));
  var pilula = nav.querySelector('.aba-pilula');
  var atual = abas.findIndex(function (a) { return a.getAttribute('aria-current') === 'page'; });

  abas.forEach(function (a) {
    a.addEventListener('click', function () {
      try { sessionStorage.setItem('abano-aba', String(atual)); } catch (e) {}
    });
  });

  if (!pilula || atual < 0) return;

  function colocar(i, semAnimar) {
    var a = abas[i];
    if (semAnimar) pilula.style.transition = 'none';
    pilula.style.transform = 'translateX(' + a.offsetLeft + 'px)';
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

  if (anterior >= 0 && anterior < abas.length && anterior !== atual && !poucoMovimento) {
    colocar(anterior, true);
    requestAnimationFrame(function () { requestAnimationFrame(function () { colocar(atual); }); });
  } else {
    colocar(atual, true);
  }

  // Reajusta quando as fontes carregam ou a tela muda de tamanho
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { colocar(atual); });
  window.addEventListener('resize', function () { colocar(atual, true); });
})();
