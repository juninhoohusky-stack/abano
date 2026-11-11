/* Abanô — Página "Doador de sangue": números da rede e lista de pets doadores.
   O contato é sempre pelo perfil do tutor na Comunidade (nada de telefone público).
   Depende de supabase-js, lista.js e conta.js. */
(() => {
  "use strict";
  const app = document.getElementById("doador-app");
  const C = window.abanoConta;
  if (!app || !C) return;
  const sb = C.sb;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PASTA = SUPABASE_URL + "/storage/v1/object/public/fotos/";
  const GOTA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8s6.6 7 6.6 11.7a6.6 6.6 0 0 1-13.2 0C5.4 9.8 12 2.8 12 2.8z" fill="currentColor"/><path d="M12 10.6v6.2M8.9 13.7h6.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  const ESPECIE = { cachorro: "Cachorro", gato: "Gato" };
  const SEXO = { macho: "Macho", femea: "Fêmea" };
  const TIPO = { dea1_positivo: "DEA 1 positivo", dea1_negativo: "DEA 1 negativo", a: "Tipo A", b: "Tipo B", ab: "Tipo AB" };
  let uf = "", especie = "";

  // Quem não tem conta vai para o cadastro e volta para os pets
  sb.auth.getSession().then((s) => {
    if (s.data.session) return;
    ["doa-cadastrar"].forEach((id) => { const a = $(id); if (a) a.href = "cadastro.html?volta=" + encodeURIComponent("/conta.html#pets"); });
    const cta = document.querySelector(".doa-cta"); if (cta) cta.href = "cadastro.html?volta=" + encodeURIComponent("/conta.html#pets");
  });

  async function numeros() {
    const r = await sb.rpc("doadores_contagem");
    if (r.error) return;
    const t = (r.data || []).reduce((a, x) => ({ d: a.d + x.doadores, q: a.q + x.querem }), { d: 0, q: 0 });
    $("doa-n-doadores").textContent = t.d.toLocaleString("pt-BR");
    $("doa-n-querem").textContent = t.q.toLocaleString("pt-BR");
  }

  function cartao(p) {
    const foto = p.foto_url && p.foto_url.indexOf(PASTA) === 0
      ? `<img src="${esc(p.foto_url)}" alt="" loading="lazy" decoding="async">`
      : `<span>${esc(p.nome.trim().charAt(0).toUpperCase())}</span>`;
    const doador = p.doador_sangue === "doador";
    const meta = [ESPECIE[p.especie], p.raca, p.idade, SEXO[p.sexo]].filter(Boolean).join(" · ");
    const local = [p.cidade, p.estado].filter(Boolean).join(" / ");
    return `<article class="doa-pet${doador ? " eh-doador" : ""}">
      <div class="doa-foto">${foto}</div>
      <span class="selo-doador${doador ? "" : " quer"}">${GOTA}${doador ? "Doador de sangue" : "Quer ser doador"}</span>
      <h3>${esc(p.nome)}</h3>
      <p class="doa-meta">${esc(meta)}</p>
      ${p.tipo_sanguineo ? `<p class="doa-tipo">${esc(TIPO[p.tipo_sanguineo] || "")}</p>` : ""}
      ${local ? `<p class="doa-local">${esc(local)}</p>` : ""}
      <a class="btn btn-sec doa-perfil" href="comunidade/?u=${encodeURIComponent(p.tutor_usuario)}">Falar com ${esc(String(p.tutor_nome || "").split(" ")[0] || "o tutor")}</a>
    </article>`;
  }

  async function carregar() {
    const grade = $("doa-grade");
    grade.innerHTML = '<p class="doa-carregando">Carregando…</p>';
    const r = await sb.rpc("doadores_sangue", { p_estado: uf || null, p_especie: especie || null });
    if (r.error || !r.data || !r.data.length) {
      const onde = uf ? " em " + uf : "";
      grade.innerHTML = `<div class="doa-vazio">${GOTA}<p><b>Ainda não há doadores${esc(onde)}${especie ? " desta espécie" : ""}.</b> Seja o primeiro: marque o seu cão ou gato como doador no perfil dele.</p>
        <a class="btn" href="${$("doa-cadastrar").getAttribute("href")}">Cadastrar meu pet</a></div>`;
      return;
    }
    grade.innerHTML = r.data.map(cartao).join("");
  }

  $("doa-uf").addEventListener("change", (e) => { uf = e.target.value; carregar(); });
  document.querySelectorAll("[data-esp]").forEach((b) => b.addEventListener("click", () => {
    especie = b.dataset.esp;
    document.querySelectorAll("[data-esp]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    carregar();
  }));

  // Começa pelo estado do perfil de quem está logado
  (async () => {
    const s = await sb.auth.getSession();
    if (s.data.session) {
      const r = await sb.rpc("minha_conta");
      if (!r.error && r.data && r.data.estado) { uf = r.data.estado; $("doa-uf").value = uf; }
    }
    numeros();
    carregar();
  })();
})();
