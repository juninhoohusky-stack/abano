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
  var paginaInicial = !!document.querySelector('.titulo-hero');
  juntar(main, 0);
  if (!blocos.length) return;

  // ---------- Estado inicial (escondido) ----------
  var pendentes = [];
  blocos.forEach(function (el) {
    if (jaPintou && el.getBoundingClientRect().top < alturaTela) return;
    // Fora da página inicial, só o que aparece ao abrir tem entrada; o resto já está lá
    if (!paginaInicial && el.getBoundingClientRect().top > alturaTela * 0.95) return;
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

/* ---------- Atalho "Pular para o conteúdo" (teclado e leitores de tela) ---------- */
(function () {
  var main = document.querySelector("main");
  if (!main || document.querySelector(".pular")) return;
  if (!main.id) main.id = "conteudo";
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  var a = document.createElement("a");
  a.className = "pular";
  a.href = "#" + main.id;
  a.textContent = "Pular para o conteúdo";
  a.addEventListener("click", function (e) { e.preventDefault(); main.focus(); main.scrollIntoView(); });
  document.body.insertBefore(a, document.body.firstChild);
})();

/* ---------- Busca do site (lupa no topo) ----------
   A pessoa digita uma palavra ("vacina", "fugiu", "hotel") e vê as páginas ligadas a ela.
   Tudo roda no navegador, a partir da lista abaixo: nenhuma busca sai do site.
   Ao criar uma página nova, acrescente-a aqui com as palavras que alguém usaria para achá-la. */
(function () {
  var topo = document.querySelector(".topo-in");
  if (!topo || document.querySelector(".topo-busca")) return;

  var ICO = {
    lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/>',
    casa: '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9v11h12V9"/>',
    pessoas: '<circle cx="12" cy="8" r="3"/><circle cx="5.5" cy="10" r="2.2"/><circle cx="18.5" cy="10" r="2.2"/><path d="M6.5 19.5a5.5 5.5 0 0 1 11 0zM2.5 17.5a3.5 3.5 0 0 1 3.8-3.4M21.5 17.5a3.5 3.5 0 0 0-3.8-3.4"/>',
    calc: '<rect x="4.5" y="3" width="15" height="18" rx="3.5"/><path d="M8 7.5h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    livro: '<path d="M12 6.5C10.3 5 7.6 4.5 3.5 4.8v13.4c4.1-.3 6.8.2 8.5 1.7 1.7-1.5 4.4-2 8.5-1.7V4.8c-4.1-.3-6.8.2-8.5 1.7z"/><path d="M12 6.5v13.4"/>',
    agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    cama: '<path d="M3 6v13M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/>',
    vet: '<path d="M6 3.5H4.5v5a4.5 4.5 0 0 0 9 0v-5H12"/><path d="M9 13v1.5a5 5 0 0 0 10 0V12"/><circle cx="19" cy="10" r="2"/>',
    coracao: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1.3"/><rect x="14" y="4" width="6" height="6" rx="1.3"/><rect x="4" y="14" width="6" height="6" rx="1.3"/><path d="M14 14h2.5v2.5H14zM18.5 18.5H20V20h-1.5z"/>',
    gota: '<path d="M12 3.5s6 6.4 6 10.7a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/><path d="M12 11v5M9.5 13.5h5"/>',
    sino: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.6 2.4H4.4z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
    mapa: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    alto: '<path d="M3.5 10.2v3.6a1 1 0 0 0 1 1H7l7 4.4V4.8L7 9.2H4.5a1 1 0 0 0-1 1z"/><path d="M17.6 9.3a3.9 3.9 0 0 1 0 5.4"/>',
    perfil: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    escudo: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/>',
    tesoura: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8.2 7.8 20 17M8.2 16.2 20 7"/>',
    sacola: '<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    medalha: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7 21l5-2.5 5 2.5-1.6-7.6"/>'
  };

  // url, título, descrição, ícone, situação ("" = no ar), palavras que alguém usaria
  var PAGINAS = [
    ["comunidade/", "Comunidade Abanô", "Publique, tire dúvidas e entre nos clubes da sua raça e do seu estado.", "pessoas", "",
      "comunidade forum fórum grupo clube clubes rede social postar publicar post foto fotos dúvida duvida pergunta perguntar conversar amigos tutores tutor raça estado conselho dica dicas"],
    ["comunidade/?v=tutores", "Encontrar tutores", "Busque pessoas pelo nome ou @usuário, em qualquer estado.", "pessoas", "",
      "pessoa pessoas buscar pessoa encontrar tutor tutores perfil seguir amigo amiga usuário usuario nome procurar alguém alguem"],
    ["calculadora.html", "Calculadora de custos", "Quanto custa manter um cachorro ou um gato por mês e por ano.", "calc", "",
      "calculadora custo custos gasto gastos quanto custa preço preços valor dinheiro orçamento mensal anual ração racao petisco antipulgas vermífugo vacina veterinário areia banho conta economizar"],
    ["husky-solta-muito-pelo.html", "Guia pet: husky solta muito pelo?", "O que fazer com a queda de pelo do husky, de quem tem quatro.", "livro", "",
      "guia artigo dica dicas husky pelo pelos queda troca muda escovar escova escovação rasqueadeira soprador banho tosa calor alimentação cuidado cuidados raça siberiano"],
    ["adocao.html", "Adoção", "Cães, gatos e outros pets de ONGs e protetores verificados.", "coracao", "Novo",
      "adoção adocao adotar adote filhote filhotes cachorro cão cao gato gatinho resgate resgatado ong ongs protetor protetora abrigo lar doação doar ganhar pet"],
    ["ong.html", "Painel da ONG ou protetor", "Cadastre sua ONG, anuncie pets para adoção e veja os pedidos.", "coracao", "",
      "ong ongs protetor protetora anunciar adoção cadastrar ong painel pedidos de adoção abrigo resgate"],
    ["veterinarios.html", "Veterinários perto de você", "Clínicas, hospitais e veterinários 24 horas no mapa, e parceiros avaliados.", "vet", "",
      "cachorro cão gato veterinário veterinario vet clínica clinica hospital emergência emergencia urgência 24h 24 horas plantão madrugada doente passou mal vacina consulta perto de mim mapa"],
    ["banho-e-tosa.html", "Banho e tosa perto de você", "Banho, tosa higiênica, tosa da raça e leva e traz no mapa.", "tesoura", "",
      "banho e tosa banho tosa tosador tosadora higiênica higienica leva e traz pet shop perto de mim cachorro gato pelo cheiroso"],
    ["pet-shop.html", "Pet shops perto de você", "Ração, petiscos, acessórios e farmácia veterinária no mapa.", "sacola", "",
      "pet shop petshop loja ração racao casa de ração petisco acessório brinquedo coleira caminha areia farmácia veterinária remédio comprar perto de mim"],
    ["adestramento.html", "Adestradores perto de você", "Filhotes, comportamento e agility no mapa.", "medalha", "",
      "adestrador adestradora adestramento adestrar treinar treinamento obediência comportamento late muito puxa a guia morde agressivo filhote agility perto de mim"],
    ["eventos.html", "Eventos pet", "Encontros, feiras e passeios perto de você.", "agenda", "Em breve",
      "evento eventos encontro encontros feira feiras passeio passeios cãominhada caominhada agenda programação fim de semana husky experience"],
    ["hospedagem.html", "Hospedagem pet perto de você", "Hotéis, creches e pet sitters no mapa.", "cama", "",
      "hospedagem hotel hotelzinho creche daycare anfitrião pet sitter babá baba cuidador viagem viajar férias ferias feriado deixar o pet"],
    ["perdidos.html", "Pet desaparecido", "Cartaz pronto e alerta para quem está perto.", "lupa", "Em breve",
      "cachorro cão gato pet perdido perdida desaparecido desaparecida sumiu fugiu fuga fugir achado achei encontrei cartaz alerta procurar procura"],
    ["perfil-qr.html", "Perfil do pet com QR", "Quem encontrar o seu pet fala com você na hora.", "qr", "Em breve",
      "qr qrcode qr code plaquinha plaqueta coleira identificação identificacao tag pingente contato perfil do pet"],
    ["doador-de-sangue.html", "Doador de sangue", "Cães e gatos doadores perto de você. Cadastre o seu pet para ajudar.", "gota", "Novo",
      "sangue doador doadora doadores doação doar transfusão transfusao cirurgia anemia tipo sanguíneo dea banco de sangue emergência herói"],
    ["pesquisa-huskies/", "Onde estão os Huskies do Brasil?", "Pesquisa nacional dos tutores de husky. Leva 2 minutos.", "mapa", "",
      "pesquisa questionário mapa husky huskies brasil tutores encontro husky experience"],
    ["novidades.html", "Novidades", "O que há de novo no Abanô.", "sino", "",
      "novidades novidade notícias noticias atualização lançamento lançamentos o que mudou"],
    ["sobre.html", "Nossa história", "Como o Abanô nasceu, numa casa com quatro huskies e dois gatos.", "coracao", "",
      "história historia sobre quem somos juninho família familia fundador abanô abano"],
    ["anuncie.html", "Divulgue no Abanô", "Seja parceiro em destaque ou divulgue o seu evento.", "alto", "",
      "parceiro parceria destaque anunciar anuncie divulgar divulgue propaganda publicidade negócio negocio empresa loja pet shop parceiro parceria marca evento"],
    ["cadastro.html?volta=%2Fcomunidade%2F", "Criar conta", "Grátis: libera a Comunidade e o perfil dos seus pets.", "perfil", "",
      "criar conta cadastro cadastrar cadastre inscrever registrar participar entrar na comunidade grátis gratis"],
    ["entrar.html", "Entrar", "Acesse a sua conta com e-mail ou Google.", "perfil", "",
      "entrar login logar acessar acesso conta senha google"],
    ["conta.html", "Minha conta e meus pets", "Seu perfil, o perfil dos seus pets e a sua senha.", "perfil", "",
      "minha conta perfil meus pets meu pet foto senha trocar senha configurações configuracoes dados editar"],
    ["adocao.html?v=pedidos", "Meus pedidos de adoção", "Acompanhe os pedidos de adoção que você fez.", "coracao", "",
      "meus pedidos pedido de adoção acompanhar adoção status"],
    ["privacidade.html", "Política de privacidade", "Como o Abanô cuida dos seus dados.", "escudo", "",
      "privacidade política lgpd dados cookies segurança termos"],
    ["seus-dados.html", "Seus dados (LGPD)", "Veja, baixe ou peça a exclusão dos seus dados.", "escudo", "",
      "meus dados seus dados lgpd excluir apagar deletar conta exclusão descadastrar cancelar e-mail email"],
    ["index.html", "Página inicial", "Tudo o que o seu pet precisa em um só lugar.", "casa", "",
      "início inicio home página inicial começo"]
  ];
  var SUGESTOES = [0, 1, 2, 3, 5];
  var VAZIAS = { de: 1, do: 1, da: 1, dos: 1, das: 1, o: 1, a: 1, os: 1, as: 1, e: 1, um: 1, uma: 1, para: 1, pra: 1, pro: 1, com: 1, no: 1, na: 1, em: 1, meu: 1, minha: 1, que: 1, como: 1, quero: 1, onde: 1, se: 1 };

  function norm(t) { return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function raiz(t) { return t.length > 4 ? t.replace(/(oes|aes|ais|eis|es|s)$/, "") : t; }
  var BASE = PAGINAS.map(function (p) {
    var titulo = norm(p[1]), palavras = norm(p[1] + " " + p[5]).split(/[^a-z0-9]+/).filter(Boolean).map(raiz);
    return { titulo: titulo, palavras: palavras, frase: norm(p[5]), desc: norm(p[2]) };
  });

  function pontuar(i, termos, consulta) {
    var b = BASE[i], total = 0, acertos = 0;
    for (var k = 0; k < termos.length; k++) {
      var t = termos[k], melhor = 0;
      if (b.titulo.indexOf(t) >= 0) melhor = 6;
      for (var j = 0; j < b.palavras.length && melhor < 4; j++) {
        var w = b.palavras[j];
        if (w === t) melhor = Math.max(melhor, 4);
        else if (t.length >= 3 && w.indexOf(t) === 0) melhor = Math.max(melhor, 3);
        else if (w.length >= 4 && t.indexOf(w) === 0) melhor = Math.max(melhor, 2);
      }
      if (!melhor && b.desc.indexOf(t) >= 0) melhor = 1;
      if (melhor) { total += melhor; acertos++; }
    }
    if (termos.length > 1 && b.frase.indexOf(consulta) >= 0) total += 4;   // frase inteira, ex.: "banho e tosa"
    return { n: total, acertos: acertos };
  }

  function buscar(q) {
    var consulta = norm(q).trim();
    var termos = consulta.split(/[^a-z0-9]+/).filter(function (t) { return t && !VAZIAS[t]; }).map(raiz);
    if (!termos.length) return null;
    var notas = PAGINAS.map(function (p, i) { var r = pontuar(i, termos, consulta); r.i = i; return r; });
    // Primeiro, as páginas que combinam com todas as palavras; se nenhuma, as que combinam com a maioria
    var todas = notas.filter(function (r) { return r.acertos === termos.length; });
    var achados = todas.length ? todas : notas.filter(function (r) { return r.acertos > 0 && r.acertos >= Math.ceil(termos.length / 2); });
    return achados.sort(function (a, b) { return b.acertos - a.acertos || b.n - a.n; })
      .slice(0, 7).map(function (r) { return r.i; });
  }

  function svg(nome, classe) {
    return '<svg' + (classe ? ' class="' + classe + '"' : "") + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[nome] + "</svg>";
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Botão da lupa no topo, antes de "Entrar"/"Participar"
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "topo-busca";
  botao.setAttribute("aria-label", "Buscar no Abanô");
  botao.setAttribute("aria-haspopup", "dialog");
  botao.innerHTML = svg("lupa") + '<span class="topo-busca-txt">Buscar</span>';
  var antes = topo.querySelector(".topo-entrar") || topo.querySelector(".topo-cta");
  topo.insertBefore(botao, antes);

  var dlg = document.createElement("dialog");
  dlg.className = "busca";
  dlg.setAttribute("aria-label", "Buscar no Abanô");
  dlg.innerHTML =
    '<div class="busca-caixa">' +
      '<form class="busca-campo" role="search">' + svg("lupa") +
        '<input type="search" id="busca-q" placeholder="O que você procura? Ex.: vacina, hotel, adoção" autocomplete="off" enterkeyhint="search" aria-label="O que você procura?" aria-controls="busca-lista">' +
        '<button type="button" class="busca-fechar" aria-label="Fechar a busca">Esc</button>' +
      "</form>" +
      '<p class="busca-status" id="busca-status" aria-live="polite"></p>' +
      '<ul class="busca-lista" id="busca-lista"></ul>' +
    "</div>";
  document.body.appendChild(dlg);
  var campo = dlg.querySelector("#busca-q"), lista = dlg.querySelector("#busca-lista"), status = dlg.querySelector("#busca-status");

  function mostrar(q) {
    var achados = buscar(q);
    var ids = achados || SUGESTOES;
    if (achados && !achados.length) {
      status.textContent = "Nada encontrado para “" + q.trim() + "”. Que tal perguntar na Comunidade?";
      ids = [0, 3, 1];
    } else {
      status.textContent = achados ? (achados.length === 1 ? "1 resultado" : achados.length + " resultados") : "Mais procurados";
    }
    lista.innerHTML = ids.map(function (i) {
      var p = PAGINAS[i];
      return '<li><a href="' + p[0] + '"><span class="busca-ico">' + svg(p[3]) + '</span><span class="busca-txt"><b>' + esc(p[1]) + "</b><small>" + esc(p[2]) + "</small></span>" +
        (p[4] ? '<span class="chip' + (p[4] === "Novo" ? " no-ar" : "") + '">' + p[4] + "</span>" : "") + "</a></li>";
    }).join("");
  }

  function abrir() {
    if (dlg.open) return;
    mostrar(campo.value);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    campo.focus();
    campo.select();
  }
  function fechar() { if (dlg.open) { dlg.close ? dlg.close() : dlg.removeAttribute("open"); } }

  botao.addEventListener("click", abrir);
  dlg.querySelector(".busca-fechar").addEventListener("click", fechar);
  dlg.addEventListener("close", function () { botao.focus(); });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) fechar(); });   // clique fora da caixa
  campo.addEventListener("input", function () { mostrar(campo.value); });
  dlg.querySelector("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var primeiro = lista.querySelector("a");
    if (primeiro && campo.value.trim()) location.href = primeiro.href;
  });
  // Setas para cima e para baixo andam pelos resultados
  dlg.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    var links = Array.prototype.slice.call(lista.querySelectorAll("a"));
    if (!links.length) return;
    var i = links.indexOf(document.activeElement);
    e.preventDefault();
    if (e.key === "ArrowDown") (links[i + 1] || links[0]).focus();
    else if (i <= 0) campo.focus();
    else links[i - 1].focus();
  });
  // Atalhos: "/" ou Ctrl+K abrem a busca
  document.addEventListener("keydown", function (e) {
    var digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !digitando)) { e.preventDefault(); abrir(); }
  });
})();
