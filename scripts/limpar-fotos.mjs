// Apaga as fotos de contas que já foram excluídas (perfil, pets e publicações).
// Roda no GitHub Actions (.github/workflows/limpar-fotos.yml), uma vez por dia.
// O banco não pode apagar arquivos sozinho, então o banco só lista e este script apaga.

const SUPABASE_URL = process.env.SUPABASE_URL;
const CHAVE = process.env.SUPABASE_SECRET_KEY;

if (!CHAVE) {
  console.log("::warning::O segredo SUPABASE_SECRET_KEY não está configurado no GitHub. Nada foi apagado.");
  process.exit(0);
}

const headers = { apikey: CHAVE, "Content-Type": "application/json" };
if (!CHAVE.startsWith("sb_")) headers.Authorization = `Bearer ${CHAVE}`; // chaves antigas (JWT)

const lista = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fotos_orfas`, { method: "POST", headers, body: "{}" });
if (!lista.ok) {
  console.log(`::error::Não deu para listar as fotos (${lista.status}) ${await lista.text()}`);
  process.exit(1);
}
const nomes = await lista.json();
if (!nomes.length) {
  console.log("Nenhuma foto de conta excluída. Tudo limpo.");
  process.exit(0);
}

let apagadas = 0;
for (let i = 0; i < nomes.length; i += 100) {
  const lote = nomes.slice(i, i + 100);
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/fotos`, { method: "DELETE", headers, body: JSON.stringify({ prefixes: lote }) });
  if (!r.ok) {
    console.log(`::error::Falha ao apagar um lote (${r.status}) ${await r.text()}`);
    process.exit(1);
  }
  apagadas += lote.length;
}
console.log(`${apagadas} foto(s) de contas excluídas foram apagadas.`);
