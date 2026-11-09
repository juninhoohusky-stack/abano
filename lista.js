/* =========================================================
   ✏️ CONFIGURAÇÃO DO SUPABASE
   No painel do Supabase: Project Settings → API (ou "Data API")
   1) SUPABASE_URL: a "Project URL" (ex.: https://abcd1234.supabase.co)
   2) SUPABASE_CHAVE: a chave pública "anon" ou "publishable".
      Ela foi feita para ficar no site. NUNCA cole aqui a chave
      "service_role" ou "secret".
   ========================================================= */
const SUPABASE_URL = "https://igpwzidpiypzukmnskdb.supabase.co";
const SUPABASE_CHAVE = "sb_publishable_PRC9f8FexEHaH6ZGNCaGig_EVXz8JcY";

/* Versão da Política de privacidade (a data do topo de privacidade.html).
   Fica gravada em cada cadastro como registro do consentimento.
   Atualize as duas juntas quando a política mudar. */
const VERSAO_POLITICA = "2026-11-08";

/* Botão "Continuar com o Google" na lista de espera.
   Deixe false até configurar o Google no Supabase (veja o README). */
const LOGIN_GOOGLE_ATIVO = true;
/* ======================= fim da área ===================== */

(function () {
  var form = document.getElementById("form-lista");
  if (!form) return;
  var botao = form.querySelector("button[type=submit]");
  var aviso = document.getElementById("form-aviso");
  var textoBotao = botao.textContent;

  function mostrarErro(msg) {
    aviso.textContent = msg;
    aviso.hidden = false;
    botao.disabled = false;
    botao.textContent = textoBotao;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    aviso.hidden = true;

    var d = new FormData(form);
    // Campo-armadilha: se um robô preencheu, finge que deu certo
    if (d.get("campo-robo")) { window.location.href = "obrigado.html"; return; }

    if (SUPABASE_URL.indexOf("COLE_AQUI") === 0 || SUPABASE_CHAVE.indexOf("COLE_AQUI") === 0) {
      mostrarErro("A lista de espera ainda está sendo configurada. Tente de novo em breve.");
      return;
    }

    if (!d.get("consentimento")) {
      mostrarErro("Para entrar na lista, marque a caixa de consentimento.");
      return;
    }

    botao.disabled = true;
    botao.textContent = "Enviando…";

    var dados = {
      versao_politica: VERSAO_POLITICA,
      maior_de_idade: true,
      nome: String(d.get("nome") || "").trim(),
      email: String(d.get("email") || "").trim().toLowerCase(),
      nome_pet: String(d.get("nome-do-pet") || "").trim() || null,
      cidade: String(d.get("cidade") || "").trim(),
      pet: String(d.get("pet") || ""),
      interesse: String(d.get("interesse") || "")
    };

    // Conectado com o Google (google.js)? Envia com a sessão, e o banco
    // confere que o e-mail é mesmo da pessoa
    var google = window.abanoGoogle;
    var token = google && google.token && dados.email === google.email ? google.token : null;
    if (token) dados.origem = "google";

    function enviar(corpo, comToken) {
      var headers = {
        "apikey": SUPABASE_CHAVE,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      };
      if (comToken) headers.Authorization = "Bearer " + comToken;
      return fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/lista_espera", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(corpo)
      });
    }

    function semGoogle() { delete dados.origem; return enviar(dados, null); }

    enviar(dados, token).then(function (r) {
      // Sessão do Google expirada ou recusada: cadastra pelo jeito comum
      if (token && (r.status === 401 || r.status === 403)) return semGoogle();
      // Compatibilidade: se o banco ainda não tem colunas novas
      // (lgpd.sql ou google.sql não rodados), tenta de novo sem elas
      if (r.status !== 400) return r;
      return r.clone().json().then(function (erro) {
        if (erro && erro.code === "PGRST204") {
          delete dados.versao_politica;
          delete dados.maior_de_idade;
          return semGoogle();
        }
        return r;
      }, function () { return r; });
    }).then(function (r) {
      // 409 = e-mail já cadastrado: para a pessoa, tudo certo
      if (r.ok || r.status === 409) { window.location.href = "obrigado.html"; return; }
      mostrarErro("Não conseguimos salvar seu cadastro agora. Confira os dados e tente de novo.");
    }).catch(function () {
      mostrarErro("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
    });
  });
})();

/* ---------- Formulário "Divulgue no Abanô" (anunciantes) ---------- */
(function () {
  var form = document.getElementById("form-anuncie");
  if (!form) return;
  var botao = form.querySelector("button[type=submit]");
  var aviso = document.getElementById("anuncie-aviso");
  var textoBotao = botao.textContent;

  function mostrarErro(msg) {
    aviso.textContent = msg;
    aviso.hidden = false;
    botao.disabled = false;
    botao.textContent = textoBotao;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    aviso.hidden = true;

    var d = new FormData(form);
    var ok = document.getElementById("anuncie-ok");
    function concluir() {
      form.hidden = true;
      ok.hidden = false;
      ok.focus();
    }
    // Campo-armadilha: se um robô preencheu, finge que deu certo
    if (d.get("campo-robo")) { concluir(); return; }

    if (!d.get("ciente")) {
      mostrarErro("Para enviar, marque que leu a Política de privacidade.");
      return;
    }

    botao.disabled = true;
    botao.textContent = "Enviando…";

    var corpo = {
      tipo: String(d.get("tipo") || ""),
      nome: String(d.get("nome") || "").trim(),
      email: String(d.get("email") || "").trim().toLowerCase(),
      whatsapp: String(d.get("whatsapp") || "").trim() || null,
      negocio: String(d.get("negocio") || "").trim(),
      cidade: String(d.get("cidade") || "").trim(),
      mensagem: String(d.get("mensagem") || "").trim() || null,
      versao_politica: VERSAO_POLITICA
    };

    fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/anunciantes", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_CHAVE,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      if (r.ok) { concluir(); return; }
      mostrarErro("Não conseguimos enviar agora. Confira os dados ou escreva para contato@abano.com.br.");
    }).catch(function () {
      mostrarErro("Sem conexão no momento. Tente de novo ou escreva para contato@abano.com.br.");
    });
  });
})();
