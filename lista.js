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
   Fica gravada em cada conta e formulário como registro do consentimento.
   Atualize as duas juntas quando a política mudar. */
const VERSAO_POLITICA = "2026-11-09";

/* Verificação "Não sou um robô" (Cloudflare Turnstile) em criar conta,
   entrar e recuperar senha. Cole aqui a "Site Key" (chave pública do site).
   Vazio = sem verificação. Só ligue o CAPTCHA no Supabase DEPOIS de preencher. */
const TURNSTILE_CHAVE_SITE = "0x4AAAAAAF6rkLspJ1IFTLYf";

/* Mapa do Google nas páginas de serviços (veterinários, banho e tosa, pet shop,
   adestramento, hospedagem). Cole aqui a chave da "Maps Embed API" criada no
   Google Cloud, restrita ao site abano.com.br. Ela é pública por natureza e
   gratuita (sem limite). Vazio = usa o mapa público do Google, sem chave. */
const GOOGLE_MAPS_CHAVE = "";

/* ======================= fim da área ===================== */

/* ---------- Formulário "Divulgue no Abanô" (anunciantes) ---------- */
(function () {
  var form = document.getElementById("form-anuncie");
  if (!form) return;
  var botao = form.querySelector("button[type=submit]");
  var aviso = document.getElementById("anuncie-aviso");
  var textoBotao = botao.textContent;

  // Vindo de "Quero ser parceiro" numa página de serviço: já escolhe o tipo de negócio
  var tipoPedido = new URLSearchParams(location.search).get("tipo");
  if (tipoPedido && form.tipo && form.tipo.querySelector('option[value="' + tipoPedido.replace(/[^a-z_]/g, "") + '"]')) form.tipo.value = tipoPedido;

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
