/* Abanô — "Continuar com o Google" na lista de espera.
   Usa o login do Supabase (provedor Google). A sessão fica só na
   memória desta página: serve apenas para confirmar nome e e-mail
   no cadastro. Liga/desliga em lista.js (LOGIN_GOOGLE_ATIVO). */
(function () {
  if (typeof LOGIN_GOOGLE_ATIVO === "undefined" || !LOGIN_GOOGLE_ATIVO) return;
  var form = document.getElementById("form-lista");
  var bloco = document.getElementById("google-bloco");
  var conectado = document.getElementById("google-conectado");
  if (!form || !bloco || !conectado) return;

  var botao = document.getElementById("btn-google");
  var aviso = document.getElementById("form-aviso");
  bloco.hidden = false;

  function mostrarAviso(msg) { aviso.textContent = msg; aviso.hidden = false; }

  function irParaLista() {
    var lista = document.getElementById("lista");
    if (lista) lista.scrollIntoView({ block: "start" });
  }

  // 1) Clique no botão: vai para o Google e volta para esta mesma página
  botao.addEventListener("click", function () {
    botao.disabled = true;
    var volta = location.origin + location.pathname;
    location.href = SUPABASE_URL + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(volta);
  });

  // 2) Voltando do Google: a sessão vem no fim do endereço (#access_token=...)
  if (!location.hash || location.hash.length < 2) return;
  var p = new URLSearchParams(location.hash.slice(1));
  var token = p.get("access_token");
  var erro = p.get("error_description") || p.get("error");
  if (!token && !erro) return;

  // Tira a sessão do endereço na hora (não fica no histórico nem é compartilhada)
  history.replaceState(null, "", location.pathname + location.search + "#lista");
  irParaLista();

  if (erro) {
    mostrarAviso("Não deu para entrar com o Google agora. Você pode preencher o formulário normalmente.");
    return;
  }

  fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { "apikey": SUPABASE_CHAVE, "Authorization": "Bearer " + token }
  })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (u) {
      var email = String(u.email || "").toLowerCase();
      if (!email) throw new Error("sem e-mail");
      var meta = u.user_metadata || {};
      var nome = meta.full_name || meta.name || "";

      window.abanoGoogle = { token: token, email: email };

      if (nome && !form.nome.value) form.nome.value = nome;
      form.email.value = email;
      form.email.readOnly = true;

      bloco.hidden = true;
      conectado.hidden = false;
      document.getElementById("google-email").textContent = email;

      var proximo = form.cidade.value ? form.pet : form.cidade;
      setTimeout(function () { proximo.focus({ preventScroll: true }); }, 300);
    })
    .catch(function () {
      mostrarAviso("Não conseguimos confirmar sua conta Google. Você pode preencher o formulário normalmente.");
    });

  // 3) "Usar outro e-mail": desconecta e libera o campo
  document.getElementById("google-sair").addEventListener("click", function () {
    var g = window.abanoGoogle;
    window.abanoGoogle = null;
    if (g && g.token) {
      fetch(SUPABASE_URL + "/auth/v1/logout", {
        method: "POST",
        headers: { "apikey": SUPABASE_CHAVE, "Authorization": "Bearer " + g.token }
      }).catch(function () {});
    }
    form.email.readOnly = false;
    form.email.value = "";
    conectado.hidden = true;
    bloco.hidden = false;
    form.email.focus();
  });
})();
