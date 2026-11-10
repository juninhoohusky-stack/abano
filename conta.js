/* Abanô — contas de tutor (Supabase Auth).
   Uma única sessão para o site todo: entrar, criar conta, Google,
   recuperar senha, perfil, pets e fotos. Depende de supabase-js e lista.js.
   Cada parte só roda se a página tiver o formulário correspondente. */
(function () {
  "use strict";
  if (!window.supabase || typeof SUPABASE_URL === "undefined") return;

  // Guardado antes de criar o cliente, que limpa o endereço depois de ler
  var busca = new URLSearchParams(location.search);
  var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  var veioComCodigo = busca.has("code");
  var erroNoLink = busca.get("error_description") || hash.get("error_description") || "";

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var PASTA_FOTOS = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Utilidades ----------
  // Para onde voltar depois de entrar: só caminhos deste site
  function destino() {
    var v = busca.get("volta") || "";
    return /^\/(?!\/)[^\s\\]*$/.test(v) ? v : "/conta.html";
  }
  function ir(caminho) { location.replace(caminho); }

  function traduzir(e) {
    var c = (e && e.code) || "", m = String((e && e.message) || "").toLowerCase();
    if (c === "invalid_credentials" || m.indexOf("invalid login") > -1) return "E-mail ou senha incorretos.";
    if (c === "email_not_confirmed" || m.indexOf("not confirmed") > -1) return "Você ainda não confirmou seu e-mail. Abra o link que enviamos (confira também o spam).";
    if (c === "weak_password" || m.indexOf("password should") > -1) return "Escolha uma senha mais forte: pelo menos 8 caracteres, com letras e números.";
    if (c === "user_already_exists" || m.indexOf("already registered") > -1) return "Este e-mail já tem conta. Entre ou recupere a senha.";
    if (c === "same_password") return "A nova senha precisa ser diferente da anterior.";
    if (c.indexOf("over_") === 0 || m.indexOf("rate limit") > -1) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
    if (c === "23505") return "Esse nome de usuário já está em uso. Escolha outro.";
    if (c === "P0001" && e.message) return e.message;
    if (m.indexOf("failed to fetch") > -1 || m.indexOf("network") > -1) return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
    if (m.indexOf("jwt") > -1 || c === "PGRST301" || c === "PGRST303") return "Sua sessão expirou. Saia e entre de novo na sua conta.";
    if (c === "42501" || m.indexOf("row-level security") > -1) return "Sua conta não tem permissão para isso agora. Confira em Minha conta se o cadastro está completo. (código " + (c || "42501") + ")";
    // Erro desconhecido: mostra o código técnico para facilitar o suporte
    return "Não deu certo agora. Tente de novo em instantes." + (c || m ? " (código: " + (c || "?") + (e && e.message ? " · " + String(e.message).slice(0, 120) : "") + ")" : "");
  }
  var UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  // Conta sem estado: usa o estado informado no cadastro (se houver) e grava no perfil
  function completarEstado(conta) {
    if (!conta || conta.estado || !conta.aceitou) return Promise.resolve(conta);
    return sb.auth.getSession().then(function (r) {
      var uf = String(((r.data.session || {}).user || {}).user_metadata && r.data.session.user.user_metadata.estado || "").toUpperCase();
      if (UFS.indexOf(uf) < 0) return conta;
      return sb.from("perfis").update({ estado: uf }).eq("id", conta.id).then(function (u) {
        if (!u.error) conta.estado = uf;
        return conta;
      });
    });
  }
  function emailValido(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
  function senhaBoa(v) { return v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v); }

  function aviso(el, msg, ok) {
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("ok", !!ok);
    el.hidden = !msg;
  }
  function marcar(campo, invalido) { campo.setAttribute("aria-invalid", invalido ? "true" : "false"); }
  function ocupado(botao, sim, texto) {
    if (!botao.dataset.texto) botao.dataset.texto = botao.textContent;
    botao.disabled = sim;
    botao.textContent = sim ? (texto || "Aguarde…") : botao.dataset.texto;
  }

  // ---------- Verificação contra robôs (Cloudflare Turnstile) ----------
  // Só funciona quando TURNSTILE_CHAVE_SITE estiver preenchida em lista.js
  var CAPTCHA = typeof TURNSTILE_CHAVE_SITE !== "undefined" && TURNSTILE_CHAVE_SITE ? TURNSTILE_CHAVE_SITE : "";
  var widgets = {}, carregandoTS = null;
  function carregarTurnstile() {
    if (!carregandoTS) carregandoTS = new Promise(function (ok, falha) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = ok; s.onerror = falha;
      document.head.appendChild(s);
    });
    return carregandoTS;
  }
  function prepararCaptcha(id) {
    var el = $(id);
    if (!CAPTCHA || !el) return;
    el.hidden = false;
    carregarTurnstile().then(function () {
      widgets[id] = window.turnstile.render(el, { sitekey: CAPTCHA, language: "pt-br", theme: "auto", size: "flexible" });
    }, function () { el.textContent = "Não deu para carregar a verificação. Recarregue a página."; });
  }
  function tokenCaptcha(id) {
    if (!CAPTCHA) return undefined;
    return window.turnstile && widgets[id] != null ? window.turnstile.getResponse(widgets[id]) || "" : "";
  }
  function renovarCaptcha(id) { if (CAPTCHA && window.turnstile && widgets[id] != null) window.turnstile.reset(widgets[id]); }
  var MSG_CAPTCHA = "Conclua a verificação \u201cNão sou um robô\u201d logo acima do botão e tente de novo.";
  function erroCaptcha(e) { return /captcha/i.test(String((e && e.message) || "")) ? MSG_CAPTCHA : traduzir(e); }

  // Mostrar/ocultar senha
  document.querySelectorAll(".campo-senha button").forEach(function (b) {
    b.addEventListener("click", function () {
      var input = b.parentNode.querySelector("input");
      var ver = input.type === "password";
      input.type = ver ? "text" : "password";
      b.textContent = ver ? "Ocultar" : "Mostrar";
      b.setAttribute("aria-pressed", ver ? "true" : "false");
    });
  });

  function entrarComGoogle(botao, avisoEl) {
    botao.disabled = true;
    sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + "/entrar.html?volta=" + encodeURIComponent(destino()) }
    }).then(function (r) {
      if (r.error) { botao.disabled = false; aviso(avisoEl, traduzir(r.error)); }
    });
  }

  // ---------- Entrar (entrar.html) ----------
  var formEntrar = $("form-entrar");
  if (formEntrar) {
    var avisoEntrar = $("aviso-entrar");
    var formRecuperar = $("form-recuperar");
    var avisoRec = $("aviso-recuperar");

    // Mantém o "volta" no link de criar conta
    var criar = $("link-criar");
    if (criar && busca.get("volta")) criar.href = "cadastro.html?volta=" + encodeURIComponent(destino());

    if (erroNoLink) aviso(avisoEntrar, /expired|invalid/i.test(erroNoLink) ? "Esse link expirou ou já foi usado. Entre com seu e-mail e senha ou peça um novo link." : "Não deu para concluir pelo link. Tente entrar de novo.");

    sb.auth.getSession().then(function (r) {
      if (r.data.session) { ir(destino()); return; }
      // Link de confirmação aberto em outro navegador: o e-mail já foi confirmado
      if (veioComCodigo && !erroNoLink) aviso(avisoEntrar, "E-mail confirmado! Agora é só entrar com seu e-mail e senha.", true);
    });
    sb.auth.onAuthStateChange(function (ev, s) { if (ev === "SIGNED_IN" && s) ir(destino()); });

    $("btn-google").addEventListener("click", function () { entrarComGoogle(this, avisoEntrar); });
    prepararCaptcha("captcha-entrar");

    formEntrar.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = formEntrar.email.value.trim().toLowerCase(), senha = formEntrar.senha.value;
      marcar(formEntrar.email, !emailValido(email)); marcar(formEntrar.senha, !senha);
      if (!emailValido(email)) { aviso(avisoEntrar, "Confira o e-mail: parece que falta alguma parte."); formEntrar.email.focus(); return; }
      if (!senha) { aviso(avisoEntrar, "Digite sua senha."); formEntrar.senha.focus(); return; }
      var tkE = tokenCaptcha("captcha-entrar");
      if (tkE === "") { aviso(avisoEntrar, MSG_CAPTCHA); return; }
      aviso(avisoEntrar, "");
      var botao = formEntrar.querySelector("button[type=submit]");
      ocupado(botao, true, "Entrando…");
      sb.auth.signInWithPassword({ email: email, password: senha, options: { captchaToken: tkE } }).then(function (r) {
        if (r.error) { renovarCaptcha("captcha-entrar"); ocupado(botao, false); aviso(avisoEntrar, erroCaptcha(r.error)); return; }
        ir(destino());
      });
    });

    $("btn-esqueci").addEventListener("click", function () {
      formEntrar.hidden = true; formRecuperar.hidden = false;
      if (widgets["captcha-recuperar"] == null) prepararCaptcha("captcha-recuperar");
      if (formEntrar.email.value) formRecuperar.email.value = formEntrar.email.value;
      formRecuperar.email.focus();
    });
    $("btn-voltar-entrar").addEventListener("click", function () {
      formRecuperar.hidden = true; formEntrar.hidden = false; formEntrar.email.focus();
    });
    formRecuperar.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = formRecuperar.email.value.trim().toLowerCase();
      marcar(formRecuperar.email, !emailValido(email));
      if (!emailValido(email)) { aviso(avisoRec, "Confira o e-mail: parece que falta alguma parte."); return; }
      var tkR = tokenCaptcha("captcha-recuperar");
      if (tkR === "") { aviso(avisoRec, MSG_CAPTCHA); return; }
      var botao = formRecuperar.querySelector("button[type=submit]");
      ocupado(botao, true, "Enviando…");
      sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/nova-senha.html", captchaToken: tkR }).then(function (r) {
        ocupado(botao, false);
        renovarCaptcha("captcha-recuperar");
        if (r.error) { aviso(avisoRec, erroCaptcha(r.error)); return; }
        // Mesma resposta exista ou não a conta, para não revelar quem tem cadastro
        aviso(avisoRec, "Se houver uma conta com " + email + ", você vai receber um link para criar uma nova senha. Confira também o spam.", true);
      });
    });
  }

  // ---------- Criar conta (cadastro.html) ----------
  var formCriar = $("form-criar");
  if (formCriar) {
    var avisoCriar = $("aviso-criar");
    var linkEntrar = $("link-entrar");
    if (linkEntrar && busca.get("volta")) linkEntrar.href = "entrar.html?volta=" + encodeURIComponent(destino());

    sb.auth.getSession().then(function (r) { if (r.data.session) $("ja-conectado").hidden = false; });

    $("btn-google").addEventListener("click", function () {
      try {
        sessionStorage.setItem("abano-novidades", formCriar.novidades.checked ? "1" : "0");
        if (formCriar.estado.value) sessionStorage.setItem("abano-estado", formCriar.estado.value);
      } catch (err) {}
      entrarComGoogle(this, avisoCriar);
    });
    prepararCaptcha("captcha-criar");

    formCriar.addEventListener("submit", function (e) {
      e.preventDefault();
      if (formCriar["campo-robo"].value) return;
      var nome = formCriar.nome.value.trim().replace(/\s+/g, " ");
      var email = formCriar.email.value.trim().toLowerCase();
      var senha = formCriar.senha.value;
      var estado = formCriar.estado.value;
      var erros = [];
      marcar(formCriar.nome, nome.length < 2); if (nome.length < 2) erros.push([formCriar.nome, "Digite seu nome (pelo menos 2 letras)."]);
      marcar(formCriar.email, !emailValido(email)); if (!emailValido(email)) erros.push([formCriar.email, "Confira o e-mail: parece que falta alguma parte."]);
      marcar(formCriar.senha, !senhaBoa(senha)); if (!senhaBoa(senha)) erros.push([formCriar.senha, "A senha precisa ter pelo menos 8 caracteres, com letras e números."]);
      marcar(formCriar.estado, UFS.indexOf(estado) < 0); if (UFS.indexOf(estado) < 0) erros.push([formCriar.estado, "Escolha o estado onde você mora."]);
      if (!formCriar.aceite.checked) erros.push([formCriar.aceite, "Para criar a conta, marque que leu a Política de privacidade e tem 18 anos ou mais."]);
      if (erros.length) { aviso(avisoCriar, erros[0][1]); erros[0][0].focus(); return; }
      var tkC = tokenCaptcha("captcha-criar");
      if (tkC === "") { aviso(avisoCriar, MSG_CAPTCHA); return; }
      aviso(avisoCriar, "");

      var botao = formCriar.querySelector("button[type=submit]");
      ocupado(botao, true, "Criando sua conta…");
      sb.auth.signUp({
        email: email,
        password: senha,
        options: {
          emailRedirectTo: location.origin + "/entrar.html?volta=" + encodeURIComponent(destino()),
          captchaToken: tkC,
          data: { nome: nome, estado: estado, versao_politica: VERSAO_POLITICA, maior_de_idade: true, novidades: formCriar.novidades.checked }
        }
      }).then(function (r) {
        if (r.error) { renovarCaptcha("captcha-criar"); ocupado(botao, false); aviso(avisoCriar, erroCaptcha(r.error)); return; }
        if (r.data.session) { ir(destino()); return; }
        // Precisa confirmar o e-mail (a mesma tela aparece se o e-mail já tinha conta)
        formCriar.hidden = true;
        $("criar-confirme-email").textContent = email;
        var ok = $("criar-ok");
        ok.hidden = false;
        ok.focus();
      });
    });
  }

  // ---------- Nova senha (nova-senha.html) ----------
  var formSenha = $("form-nova-senha");
  if (formSenha) {
    var avisoSenha = $("aviso-senha");
    var pronto = false;
    function liberar() { pronto = true; formSenha.hidden = false; $("senha-carregando").hidden = true; formSenha.senha.focus(); }
    sb.auth.onAuthStateChange(function (ev, s) { if ((ev === "PASSWORD_RECOVERY" || ev === "SIGNED_IN") && s && !pronto) liberar(); });
    sb.auth.getSession().then(function (r) {
      if (r.data.session) { liberar(); return; }
      $("senha-carregando").hidden = true;
      aviso(avisoSenha, erroNoLink
        ? "Esse link expirou ou já foi usado. Peça um novo na página Entrar."
        : "Abra o link do e-mail no mesmo navegador em que você pediu a nova senha, ou peça um novo link na página Entrar.");
      $("senha-pedir-novo").hidden = false;
    });
    formSenha.addEventListener("submit", function (e) {
      e.preventDefault();
      var s1 = formSenha.senha.value, s2 = formSenha.senha2.value;
      marcar(formSenha.senha, !senhaBoa(s1)); marcar(formSenha.senha2, s1 !== s2);
      if (!senhaBoa(s1)) { aviso(avisoSenha, "A senha precisa ter pelo menos 8 caracteres, com letras e números."); formSenha.senha.focus(); return; }
      if (s1 !== s2) { aviso(avisoSenha, "As duas senhas não são iguais."); formSenha.senha2.focus(); return; }
      var botao = formSenha.querySelector("button[type=submit]");
      ocupado(botao, true, "Salvando…");
      sb.auth.updateUser({ password: s1 }).then(function (r) {
        if (r.error) { ocupado(botao, false); aviso(avisoSenha, traduzir(r.error)); return; }
        formSenha.hidden = true;
        aviso(avisoSenha, "Senha alterada! Você já está conectado.", true);
        $("senha-ir-conta").hidden = false;
      });
    });
  }

  // ---------- Fotos: reduz, tira dados de localização e envia ----------
  function prepararFoto(arquivo) {
    return new Promise(function (ok, falha) {
      if (!arquivo || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(arquivo.type)) { falha(new Error("Escolha uma foto em JPG, PNG ou WebP.")); return; }
      if (arquivo.size > 20 * 1024 * 1024) { falha(new Error("Essa foto é muito grande. Escolha uma de até 20 MB.")); return; }
      var img = new Image();
      var url = URL.createObjectURL(arquivo);
      img.onload = function () {
        var max = 1280, w = img.naturalWidth, h = img.naturalHeight;
        var escala = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * escala); c.height = Math.round(h * escala);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);   // redesenhar descarta EXIF/GPS
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (b && b.type === "image/webp") { ok(b); return; }
          c.toBlob(function (j) { j ? ok(j) : falha(new Error("Não deu para ler essa foto.")); }, "image/jpeg", 0.85);
        }, "image/webp", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error("Não deu para ler essa foto. Tente outra em JPG ou PNG.")); };
      img.src = url;
    });
  }
  function enviarFoto(uid, prefixo, arquivo) {
    return prepararFoto(arquivo).then(function (blob) {
      var ext = blob.type === "image/webp" ? "webp" : "jpg";
      var caminho = uid + "/" + prefixo + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "." + ext;
      return sb.storage.from("fotos").upload(caminho, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false })
        .then(function (r) {
          if (r.error) throw new Error("Não deu para enviar a foto. Tente de novo.");
          return PASTA_FOTOS + caminho;
        });
    });
  }
  function apagarFoto(url) {
    if (!url || url.indexOf(PASTA_FOTOS) !== 0) return Promise.resolve();
    return sb.storage.from("fotos").remove([url.slice(PASTA_FOTOS.length)]).then(function () {}, function () {});
  }

  // ---------- Minha conta (conta.html) ----------
  var painel = $("conta-painel");
  if (painel) {
    var conta = null, pets = [];
    var avisoPerfil = $("aviso-perfil");

    sb.auth.getSession().then(function (r) {
      if (!r.data.session) { ir("/entrar.html?volta=" + encodeURIComponent("/conta.html")); return; }
      carregar();
    });
    sb.auth.onAuthStateChange(function (ev) { if (ev === "SIGNED_OUT") ir("/entrar.html"); });

    function carregar() {
      sb.rpc("minha_conta").then(function (r) {
        $("conta-carregando").hidden = true;
        if (r.error) { aviso($("aviso-geral"), traduzir(r.error)); return; }
        return completarEstado(r.data).then(function (c) {
        conta = c;
        if (!conta.aceitou || !conta.estado) { mostrarAceite(); return; }
        $("conta-aceite").hidden = true;
        painel.hidden = false;
        preencherPerfil();
        carregarPets();
        if (busca.get("bemvindo") || veioComCodigo) $("conta-boasvindas").hidden = false;
        });
      });
    }

    // Primeira vez (principalmente quem entrou pelo Google): aceite da política
    function mostrarAceite() {
      var f = $("form-aceite");
      var precisaAceite = !conta.aceitou;
      $("conta-aceite").hidden = false;
      $("aceite-nome").textContent = (conta.nome || "").split(" ")[0];
      $("aceite-termos").hidden = !precisaAceite;
      if (!precisaAceite) {
        $("aceite-titulo").textContent = "Em qual estado você mora?";
        $("aceite-sub").textContent = "Agora pedimos o estado de todos os tutores, para mostrar quem está perto de você e planejar encontros na sua região.";
      }
      try {
        if (sessionStorage.getItem("abano-novidades") === "1") f.novidades.checked = true;
        var ufGuardada = sessionStorage.getItem("abano-estado");
        if (ufGuardada && UFS.indexOf(ufGuardada) > -1) f.estado.value = ufGuardada;
      } catch (err) {}
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var uf = f.estado.value;
        marcar(f.estado, UFS.indexOf(uf) < 0);
        if (UFS.indexOf(uf) < 0) { aviso($("aviso-aceite"), "Escolha o estado onde você mora."); f.estado.focus(); return; }
        if (precisaAceite && !f.aceite.checked) { aviso($("aviso-aceite"), "Para usar a conta, marque que leu a Política de privacidade e tem 18 anos ou mais."); f.aceite.focus(); return; }
        var botao = f.querySelector("button[type=submit]");
        ocupado(botao, true, "Salvando…");
        var passo = precisaAceite ? sb.rpc("aceitar_politica", { p_versao: VERSAO_POLITICA, p_novidades: f.novidades.checked }) : Promise.resolve({});
        passo.then(function (r) {
          if (r.error) return r;
          return sb.from("perfis").update({ estado: uf }).eq("id", conta.id);
        }).then(function (r) {
          ocupado(botao, false);
          if (r.error) { aviso($("aviso-aceite"), traduzir(r.error)); return; }
          try { sessionStorage.removeItem("abano-estado"); } catch (err) {}
          try { sessionStorage.removeItem("abano-novidades"); } catch (err) {}
          if (busca.get("volta")) { ir(destino()); return; }
          busca.set("bemvindo", "1");
          carregar();
        });
      });
    }

    // Perfil
    var fp = $("form-perfil");
    function avatar(el, url, nome) {
      el.textContent = "";
      if (url) { var i = new Image(); i.src = url; i.alt = ""; el.appendChild(i); }
      else el.textContent = (nome || "?").trim().charAt(0).toUpperCase();
      if (el.id === "conta-avatar") $("tirar-foto-perfil").hidden = !url;
    }
    function preencherPerfil() {
      $("conta-nome").textContent = conta.nome;
      $("conta-usuario").textContent = "@" + conta.usuario;
      $("conta-email").textContent = conta.email;
      avatar($("conta-avatar"), conta.foto_url, conta.nome);
      fp.nome.value = conta.nome || "";
      fp.usuario.value = conta.usuario || "";
      fp.bio.value = conta.bio || "";
      fp.cidade.value = conta.cidade || "";
      fp.estado.value = conta.estado || "";
      contar(fp.bio, $("bio-conta"), 300);
      $("pref-novidades").checked = !!conta.novidades;
      $("bloco-senha").hidden = conta.provedor !== "email";
    }
    function contar(campo, el, max) { el.textContent = campo.value.length + " de " + max; }
    fp.bio.addEventListener("input", function () { contar(fp.bio, $("bio-conta"), 300); });
    fp.usuario.addEventListener("input", function () {
      var limpo = fp.usuario.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (limpo !== fp.usuario.value) fp.usuario.value = limpo;
    });

    $("foto-perfil").addEventListener("change", function () {
      var arq = this.files[0], input = this;
      if (!arq) return;
      aviso(avisoPerfil, "Enviando foto…", true);
      var antiga = conta.foto_url;
      enviarFoto(conta.id, "perfil", arq).then(function (url) {
        return sb.from("perfis").update({ foto_url: url }).eq("id", conta.id).then(function (r) {
          if (r.error) throw r.error;
          conta.foto_url = url;
          avatar($("conta-avatar"), url, conta.nome);
          aviso(avisoPerfil, "Foto atualizada.", true);
          return apagarFoto(antiga);
        });
      }).catch(function (err) { aviso(avisoPerfil, err.code ? traduzir(err) : err.message); })
        .then(function () { input.value = ""; });
    });
    $("tirar-foto-perfil").addEventListener("click", function () {
      if (!conta.foto_url) return;
      var antiga = conta.foto_url;
      sb.from("perfis").update({ foto_url: null }).eq("id", conta.id).then(function (r) {
        if (r.error) { aviso(avisoPerfil, traduzir(r.error)); return; }
        conta.foto_url = null; avatar($("conta-avatar"), null, conta.nome); apagarFoto(antiga);
        aviso(avisoPerfil, "Foto removida.", true);
      });
    });

    fp.addEventListener("submit", function (e) {
      e.preventDefault();
      var dados = {
        nome: fp.nome.value.trim().replace(/\s+/g, " "),
        usuario: fp.usuario.value.trim().toLowerCase(),
        bio: fp.bio.value.trim() || null,
        cidade: fp.cidade.value.trim() || null,
        estado: fp.estado.value || null
      };
      marcar(fp.nome, dados.nome.length < 2); marcar(fp.usuario, !/^[a-z0-9][a-z0-9_]{2,29}$/.test(dados.usuario));
      if (dados.nome.length < 2) { aviso(avisoPerfil, "O nome precisa ter pelo menos 2 letras."); fp.nome.focus(); return; }
      marcar(fp.estado, !dados.estado);
      if (!dados.estado) { aviso(avisoPerfil, "Escolha o estado onde você mora."); fp.estado.focus(); return; }
      if (!/^[a-z0-9][a-z0-9_]{2,29}$/.test(dados.usuario)) { aviso(avisoPerfil, "O nome de usuário precisa ter de 3 a 30 caracteres: letras minúsculas, números ou _."); fp.usuario.focus(); return; }
      var botao = fp.querySelector("button[type=submit]");
      ocupado(botao, true, "Salvando…");
      sb.from("perfis").update(dados).eq("id", conta.id).then(function (r) {
        ocupado(botao, false);
        if (r.error) { aviso(avisoPerfil, traduzir(r.error)); return; }
        Object.keys(dados).forEach(function (k) { conta[k] = dados[k]; });
        $("conta-nome").textContent = conta.nome;
        $("conta-usuario").textContent = "@" + conta.usuario;
        aviso(avisoPerfil, "Perfil salvo.", true);
      });
    });

    // Pets
    var ESPECIES = { cachorro: "Cachorro", gato: "Gato", ave: "Ave", pequeno_mamifero: "Pequeno mamífero", reptil: "Réptil", peixe: "Peixe", outro: "Outro" };
    var SEXOS = { macho: "Macho", femea: "Fêmea" };
    var dialogo = $("dialogo-pet"), fpet = $("form-pet"), avisoPet = $("aviso-pet");
    var editando = null, fotoNova = null;

    function carregarPets() {
      sb.from("pets").select("*").eq("dono", conta.id).order("criado_em").then(function (r) {
        if (r.error) { aviso($("aviso-pets"), traduzir(r.error)); return; }
        pets = r.data || [];
        desenharPets();
      });
    }
    function desenharPets() {
      var lista = $("lista-pets");
      lista.textContent = "";
      $("pets-vazio").hidden = pets.length > 0;
      pets.forEach(function (p) {
        var li = document.createElement("li");
        li.className = "pet-card";
        var foto = document.createElement("span");
        foto.className = "pet-foto";
        avatar(foto, p.foto_url, p.nome);
        var txt = document.createElement("div");
        var h = document.createElement("h3"); h.textContent = p.nome;
        var meta = document.createElement("p");
        meta.textContent = [ESPECIES[p.especie], p.raca, p.idade, SEXOS[p.sexo]].filter(Boolean).join(" · ");
        txt.appendChild(h); txt.appendChild(meta);
        if (p.personalidade) { var pe = document.createElement("p"); pe.className = "pet-perso"; pe.textContent = p.personalidade; txt.appendChild(pe); }
        var acoes = document.createElement("div");
        acoes.className = "pet-acoes";
        var ed = document.createElement("button"); ed.type = "button"; ed.className = "btn btn-sec"; ed.textContent = "Editar";
        ed.setAttribute("aria-label", "Editar " + p.nome);
        ed.addEventListener("click", function () { abrirPet(p); });
        var rm = document.createElement("button"); rm.type = "button"; rm.className = "link-botao"; rm.textContent = "Remover";
        rm.setAttribute("aria-label", "Remover " + p.nome);
        rm.addEventListener("click", function () { removerPet(p); });
        acoes.appendChild(ed); acoes.appendChild(rm);
        li.appendChild(foto); li.appendChild(txt); li.appendChild(acoes);
        lista.appendChild(li);
      });
    }
    function abrirPet(p) {
      editando = p || null; fotoNova = null;
      fpet.reset();
      aviso(avisoPet, "");
      $("titulo-pet").textContent = p ? "Editar " + p.nome : "Adicionar pet";
      if (p) {
        fpet.nome.value = p.nome; fpet.especie.value = p.especie; fpet.raca.value = p.raca || "";
        fpet.idade.value = p.idade || ""; fpet.sexo.value = p.sexo || ""; fpet.personalidade.value = p.personalidade || "";
        fpet.descricao.value = p.descricao || "";
      }
      avatar($("pet-previa"), p && p.foto_url, p ? p.nome : "+");
      dialogo.showModal();
      fpet.nome.focus();
    }
    $("btn-add-pet").addEventListener("click", function () { abrirPet(null); });
    $("fechar-pet").addEventListener("click", function () { dialogo.close(); });
    $("foto-pet").addEventListener("change", function () {
      fotoNova = this.files[0] || null;
      if (fotoNova) {
        var el = $("pet-previa"); el.textContent = "";
        var i = new Image(); i.alt = ""; i.src = URL.createObjectURL(fotoNova); el.appendChild(i);
      }
    });
    fpet.addEventListener("submit", function (e) {
      e.preventDefault();
      var dados = {
        nome: fpet.nome.value.trim(),
        especie: fpet.especie.value,
        raca: fpet.raca.value.trim() || null,
        idade: fpet.idade.value.trim() || null,
        sexo: fpet.sexo.value || null,
        personalidade: fpet.personalidade.value.trim() || null,
        descricao: fpet.descricao.value.trim() || null
      };
      marcar(fpet.nome, !dados.nome); marcar(fpet.especie, !dados.especie);
      if (!dados.nome) { aviso(avisoPet, "Digite o nome do pet."); fpet.nome.focus(); return; }
      if (!dados.especie) { aviso(avisoPet, "Escolha a espécie."); fpet.especie.focus(); return; }
      var botao = fpet.querySelector("button[type=submit]");
      ocupado(botao, true, "Salvando…");
      var antiga = editando && editando.foto_url;
      var foto = fotoNova ? enviarFoto(conta.id, "pet", fotoNova) : Promise.resolve(undefined);
      foto.then(function (url) {
        if (url) dados.foto_url = url;
        var q = editando
          ? sb.from("pets").update(dados).eq("id", editando.id)
          : sb.from("pets").insert(Object.assign({ dono: conta.id }, dados));
        return q.then(function (r) {
          if (r.error) { if (url) apagarFoto(url); throw r.error; }
          if (url && antiga) apagarFoto(antiga);
          dialogo.close();
          carregarPets();
        });
      }).catch(function (err) { aviso(avisoPet, err.code ? traduzir(err) : err.message); })
        .then(function () { ocupado(botao, false); });
    });
    function removerPet(p) {
      if (!confirm("Remover " + p.nome + " do seu perfil? Isso não pode ser desfeito.")) return;
      sb.from("pets").delete().eq("id", p.id).then(function (r) {
        if (r.error) { aviso($("aviso-pets"), traduzir(r.error)); return; }
        apagarFoto(p.foto_url);
        carregarPets();
      });
    }

    // Preferências e conta
    $("pref-novidades").addEventListener("change", function () {
      var caixa = this, quer = caixa.checked;
      caixa.disabled = true;
      sb.rpc("definir_novidades", { p_quer: quer }).then(function (r) {
        caixa.disabled = false;
        if (r.error) { caixa.checked = !quer; aviso($("aviso-pref"), r.error.message || traduzir(r.error)); return; }
        aviso($("aviso-pref"), quer ? "Pronto! Você vai receber as novidades por e-mail." : "Você não vai mais receber as novidades por e-mail.", true);
      });
    });

    var fs = $("form-trocar-senha");
    fs.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = fs.senha.value;
      marcar(fs.senha, !senhaBoa(s));
      if (!senhaBoa(s)) { aviso($("aviso-trocar"), "A senha precisa ter pelo menos 8 caracteres, com letras e números."); fs.senha.focus(); return; }
      var botao = fs.querySelector("button[type=submit]");
      ocupado(botao, true, "Salvando…");
      sb.auth.updateUser({ password: s }).then(function (r) {
        ocupado(botao, false);
        if (r.error) { aviso($("aviso-trocar"), traduzir(r.error)); return; }
        fs.reset();
        aviso($("aviso-trocar"), "Senha alterada.", true);
      });
    });

    $("btn-sair").addEventListener("click", function () { sb.auth.signOut().then(function () { ir("/index.html"); }); });

    var dExcluir = $("dialogo-excluir"), fx = $("form-excluir");
    $("btn-excluir").addEventListener("click", function () { fx.reset(); aviso($("aviso-excluir"), ""); dExcluir.showModal(); fx.confirmar.focus(); });
    $("fechar-excluir").addEventListener("click", function () { dExcluir.close(); });
    fx.addEventListener("submit", function (e) {
      e.preventDefault();
      if (fx.confirmar.value.trim().toUpperCase() !== "EXCLUIR") { aviso($("aviso-excluir"), "Digite EXCLUIR para confirmar."); fx.confirmar.focus(); return; }
      var botao = fx.querySelector("button[type=submit]");
      ocupado(botao, true, "Excluindo…");
      // 1) apaga as fotos da pasta da conta; 2) apaga conta, perfil, pets e inscrição
      sb.storage.from("fotos").list(conta.id, { limit: 1000 }).then(function (r) {
        var nomes = (r.data || []).map(function (o) { return conta.id + "/" + o.name; });
        return nomes.length ? sb.storage.from("fotos").remove(nomes) : null;
      }).then(function () {
        return sb.rpc("excluir_minha_conta");
      }).then(function (r) {
        if (r && r.error) throw r.error;
        return sb.auth.signOut({ scope: "local" });
      }).then(function () {
        ir("/index.html");
      }).catch(function (err) {
        ocupado(botao, false);
        aviso($("aviso-excluir"), traduzir(err));
      });
    });
  }

  window.abanoConta = { sb: sb, completarEstado: completarEstado, destino: destino, enviarFoto: enviarFoto, apagarFoto: apagarFoto, traduzir: traduzir };
})();
