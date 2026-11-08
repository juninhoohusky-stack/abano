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

    botao.disabled = true;
    botao.textContent = "Enviando…";

    var dados = {
      nome: String(d.get("nome") || "").trim(),
      email: String(d.get("email") || "").trim().toLowerCase(),
      nome_pet: String(d.get("nome-do-pet") || "").trim() || null,
      cidade: String(d.get("cidade") || "").trim(),
      pet: String(d.get("pet") || ""),
      interesse: String(d.get("interesse") || "")
    };

    fetch(SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/lista_espera", {
      method: "POST",
      headers: {
        "apikey": SUPABASE_CHAVE,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(dados)
    }).then(function (r) {
      // 409 = e-mail já cadastrado: para a pessoa, tudo certo
      if (r.ok || r.status === 409) { window.location.href = "obrigado.html"; return; }
      mostrarErro("Não conseguimos salvar seu cadastro agora. Confira os dados e tente de novo.");
    }).catch(function () {
      mostrarErro("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
    });
  });
})();
