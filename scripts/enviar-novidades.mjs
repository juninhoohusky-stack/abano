// Envia por e-mail cada novidade de novidades.json que ainda não foi enviada.
// Roda no GitHub Actions (.github/workflows/novidades.yml).
// O Supabase registra o que já foi enviado, então rodar de novo não duplica e-mails.

import { readFile } from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SECRET_KEY;
const SITE_URL = process.env.SITE_URL;

if (!CHAVE) {
  console.log("::warning::O segredo SUPABASE_SECRET_KEY não está configurado no GitHub. Nenhum e-mail foi enviado.");
  process.exit(0);
}

const headers = { apikey: CHAVE, "Content-Type": "application/json" };
if (!CHAVE.startsWith("sb_")) headers.Authorization = `Bearer ${CHAVE}`; // chaves antigas (JWT)

const novidades = JSON.parse(await readFile("novidades.json", "utf8"));
let falhou = false;

for (const n of novidades) {
  // "enviar_email": false no post = aparece no site, mas não vai por e-mail
  if (n.enviar_email === false) {
    console.log(`"${n.titulo}": marcado para não enviar por e-mail.`);
    continue;
  }
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/rpc/disparar_novidade`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_id: n.id,
      p_titulo: n.titulo,
      p_resumo: n.resumo,
      p_link: `${SITE_URL}/novidades.html#${n.id}`,
    }),
  });
  const corpo = await resposta.text();
  if (!resposta.ok) {
    falhou = true;
    console.log(`::error::"${n.titulo}": falhou (${resposta.status}) ${corpo}`);
  } else if (corpo === "0") {
    console.log(`"${n.titulo}": já tinha sido enviada antes.`);
  } else {
    console.log(`"${n.titulo}": enviada para ${corpo} inscrito(s).`);
  }
}

process.exit(falhou ? 1 : 0);
