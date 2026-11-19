// Robô dos Achadinhos da Abanô.
// Todo dia, para cada produto de dados/loja-catalogo.json, procura o melhor anúncio na Shopee e no
// Mercado Livre, monta o link de afiliado e publica na tabela "ofertas" do Supabase (Achadinhos da Abanô, loja.html).
// Roda no GitHub Actions (.github/workflows/robo-loja.yml). Para testar sem gravar nada:
//   node scripts/robo-loja.mjs --teste
//
// Segredos (GitHub: Settings → Secrets and variables → Actions). Loja sem segredo é pulada.
//   SUPABASE_SECRET_KEY                    grava as ofertas
//   SHOPEE_APP_ID, SHOPEE_SECRET           API de afiliados da Shopee (affiliate.shopee.com.br/open_api)
//   ML_CLIENT_ID, ML_CLIENT_SECRET         aplicativo do Mercado Livre (developers.mercadolivre.com.br)
//   ML_ETIQUETA, ML_MATT_TOOL              sua etiqueta de afiliado (matt_word) e o número dela (matt_tool)

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const TESTE = process.argv.includes("--teste");
const LIMITE = Number(process.env.LIMITE || 0);          // processa só os N primeiros itens (para testes)
const DIAS_PARA_SAIR = 2;                                  // anúncio que o robô não reencontra há 2 dias sai do site
const env = process.env;

const catalogo = JSON.parse(await readFile(new URL("../dados/loja-catalogo.json", import.meta.url), "utf8")).itens;
const itens = LIMITE ? catalogo.slice(0, LIMITE) : catalogo;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const aviso = (m) => console.log(`::warning::${m}`);

// ---------- Escolher o anúncio certo ----------
const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const singular = (p) => {
  if (p.length <= 3 || !p.endsWith("s")) return p;
  if (/[oa]es$/.test(p)) return p.slice(0, -3) + "ao";       // racoes -> racao, caes -> cao
  if (/[rzl]es$/.test(p)) return p.slice(0, -2);              // seniores -> senior
  return p.slice(0, -1);                                       // filhotes -> filhote, saches -> sache
};
const palavras = (s) => normal(s).split(" ").filter(Boolean).map(singular);
const GENERICAS = new Set(["pet", "cachorro", "cao", "gato", "felino", "passaro", "roedor", "aquario", "reptil"]);
const DE_CAO = /\b(cachorro|cachorros|cao|caes|canino|canina|dog|dogs)\b/;
const DE_GATO = /\b(gato|gatos|felino|felina|cat|cats)\b/;
const SO_NA_BUSCA = new Set(["premium", "super", "especial", "extrusada", "vario", "caixa", "grande", "pequeno", "pequena"]);
const PROIBIDO =/\b(usado|usada|replica|revenda|atacado)\b/;

function combina(item, titulo) {
  const t = normal(titulo);
  if (PROIBIDO.test(t)) return false;
  const tp = new Set(t.split(" ").map(singular));
  // Nas rações, quem garante a qualidade é a marca: anúncio quase nunca escreve "super premium" no título
  const chave = palavras(item.busca).filter((p) => !GENERICAS.has(p) && !(item.nicho === "racao" && SO_NA_BUSCA.has(p)));
  if (!chave.length || !tp.has(chave[0])) return false;               // a palavra principal tem de estar no título
  const achou = chave.filter((p) => tp.has(p)).length;
  if (achou / chave.length < 0.6) return false;
  if (item.pet === "cao" && DE_GATO.test(t) && !DE_CAO.test(t)) return false;  // produto de gato no lugar de cão
  if (item.pet === "gato" && DE_CAO.test(t) && !DE_GATO.test(t)) return false;
  if (item.nicho === "racao") {                                           // só ração premium ou super premium
    // A marca vale quando todas as palavras dela aparecem no título ("Hill's" acha "Hills", "Purina Pro Plan" acha "Pro Plan Purina")
    const marcas = (item.marcas || []).map((m) => palavras(m).filter((p) => p.length > 1 && !["gato", "formula"].includes(p)));
    if (!marcas.some((m) => m.length && m.every((p) => tp.has(p)))) return false;
  }
  return true;
}

const nota = (o) => Math.log10((o.vendas || 0) + 1) + (o.avaliacao || 4.5) * 0.8 + (o.comissao || 0) * 10;

function melhor(item, candidatos, usados) {
  return candidatos
    .filter((o) => o.preco > 0 && !usados.has(o.codigo_externo) && combina(item, o.titulo) && !(o.avaliacao && o.avaliacao < 4.3))
    .sort((a, b) => nota(b) - nota(a))[0];
}

// ---------- Shopee (API oficial de afiliados) ----------
async function shopee(item) {
  const consulta = `{productOfferV2(keyword:${JSON.stringify(item.busca)},sortType:1,page:1,limit:30){nodes{` +
    "itemId productName imageUrl priceMin priceDiscountRate sales ratingStar commissionRate offerLink shopName}}}";
  const corpo = JSON.stringify({ query: consulta });
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const ts = Math.floor(Date.now() / 1000);
    const assinatura = createHash("sha256").update(env.SHOPEE_APP_ID + ts + corpo + env.SHOPEE_SECRET).digest("hex");
    const r = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `SHA256 Credential=${env.SHOPEE_APP_ID}, Timestamp=${ts}, Signature=${assinatura}` },
      body: corpo,
    });
    const j = await r.json().catch(() => ({}));
    const erro = j.errors && j.errors[0];
    if (erro) {
      const codigo = erro.extensions && erro.extensions.code;
      if (codigo === 10030 && tentativa < 3) { await espera(15000 * tentativa); continue; }  // muitas consultas: espera e tenta de novo
      throw new Error(`Shopee recusou (${codigo || r.status}): ${erro.message}`);
    }
    const nos = (j.data && j.data.productOfferV2 && j.data.productOfferV2.nodes) || [];
    return nos.map((n) => {
      const preco = Number(n.priceMin);
      const desc = Number(n.priceDiscountRate) || 0;
      return {
        codigo_externo: `shopee:${n.itemId}`, loja: "shopee", titulo: String(n.productName || "").slice(0, 160),
        link: n.offerLink, imagem_url: n.imageUrl || null, preco,
        preco_antigo: desc >= 5 && desc < 90 ? Math.round((preco / (1 - desc / 100)) * 100) / 100 : null,
        avaliacao: Number(n.ratingStar) || null, vendas: Number(n.sales) || 0, comissao: Number(n.commissionRate) || 0,
      };
    }).filter((o) => /^https:\/\//.test(o.link || ""));
  }
  return [];
}

// ---------- Mercado Livre (catálogo + etiqueta de afiliado no link) ----------
let tokenML = null;
async function entrarML() {
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.ML_CLIENT_ID, client_secret: env.ML_CLIENT_SECRET }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Mercado Livre não liberou o acesso (${r.status}): ${j.message || j.error || ""}`);
  tokenML = j.access_token;
}
async function getML(caminho) {
  const r = await fetch("https://api.mercadolibre.com" + caminho, { headers: { Authorization: `Bearer ${tokenML}` } });
  if (r.status === 429) { await espera(10000); return getML(caminho); }
  if (!r.ok) throw new Error(`Mercado Livre respondeu ${r.status} em ${caminho.split("?")[0]}`);
  return r.json();
}
const linkML = (id) => `https://www.mercadolivre.com.br/p/${id}?matt_word=${encodeURIComponent(env.ML_ETIQUETA)}&matt_tool=${encodeURIComponent(env.ML_MATT_TOOL)}`;

async function mercadolivre(item, usados) {
  const busca = await getML(`/products/search?status=active&site_id=MLB&limit=15&q=${encodeURIComponent(item.busca)}`);
  const candidatos = (busca.results || [])
    .filter((p) => !usados.has(`ml:${p.id}`) && combina(item, p.name))
    .slice(0, 3);
  const lista = [];
  for (const p of candidatos) {
    await espera(250);
    const d = await getML(`/products/${p.id}`).catch(() => null);
    const vencedor = d && d.buy_box_winner;
    if (!vencedor || !(vencedor.price > 0)) continue;                    // sem vendedor ativo agora
    const foto = ((d.pictures || p.pictures || [])[0] || {}).url;
    lista.push({
      codigo_externo: `ml:${p.id}`, loja: "mercadolivre", titulo: String(p.name || d.name).slice(0, 160), link: linkML(p.id),
      imagem_url: foto ? foto.replace(/^http:/, "https:") : null, preco: Number(vencedor.price),
      preco_antigo: vencedor.original_price > vencedor.price ? Number(vencedor.original_price) : null,
      avaliacao: null, vendas: Number(vencedor.sold_quantity) || 0, comissao: 0,
    });
  }
  return lista;
}

// ---------- Supabase ----------
const SB = env.SUPABASE_URL || "https://igpwzidpiypzukmnskdb.supabase.co";
const cab = { apikey: env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" };
if (env.SUPABASE_SECRET_KEY && !env.SUPABASE_SECRET_KEY.startsWith("sb_")) cab.Authorization = `Bearer ${env.SUPABASE_SECRET_KEY}`;

async function gravar(linhas) {
  for (let i = 0; i < linhas.length; i += 100) {
    const r = await fetch(`${SB}/rest/v1/ofertas?on_conflict=codigo_externo`, {
      method: "POST", headers: { ...cab, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(linhas.slice(i, i + 100)),
    });
    if (!r.ok) throw new Error(`Supabase não gravou (${r.status}): ${await r.text()}`);
  }
}
async function tirarAntigas(loja) {
  const limite = new Date(Date.now() - DIAS_PARA_SAIR * 864e5).toISOString();
  const r = await fetch(`${SB}/rest/v1/ofertas?origem=eq.robo&loja=eq.${loja}&ativo=eq.true&atualizado_em=lt.${limite}`, {
    method: "PATCH", headers: { ...cab, Prefer: "return=representation" }, body: JSON.stringify({ ativo: false }),
  });
  if (!r.ok) throw new Error(`Supabase não tirou as antigas (${r.status}): ${await r.text()}`);
  return (await r.json()).length;
}

// ---------- Rodada ----------
const LOJAS = [
  { nome: "shopee", rotulo: "Shopee", pronta: env.SHOPEE_APP_ID && env.SHOPEE_SECRET, pausa: 700,
    buscar: async (item, usados) => melhor(item, await shopee(item), usados) },
  { nome: "mercadolivre", rotulo: "Mercado Livre", pronta: env.ML_CLIENT_ID && env.ML_CLIENT_SECRET && env.ML_ETIQUETA && env.ML_MATT_TOOL, pausa: 300,
    preparar: entrarML, buscar: async (item, usados) => melhor(item, await mercadolivre(item, usados), usados) },
];

if (!TESTE && !env.SUPABASE_SECRET_KEY) {
  aviso("O segredo SUPABASE_SECRET_KEY não está configurado no GitHub. Nada foi publicado.");
  process.exit(0);
}

let falhou = false;
for (const loja of LOJAS) {
  if (!loja.pronta) { aviso(`${loja.rotulo}: faltam os segredos de afiliado. Loja pulada.`); continue; }
  console.log(`\n=== ${loja.rotulo}: ${itens.length} produtos do catálogo ===`);
  try { if (loja.preparar) await loja.preparar(); } catch (e) { aviso(`${loja.rotulo}: ${e.message}`); falhou = true; continue; }
  const usados = new Set(), linhas = [], faltaram = [];
  let erros = 0;
  for (const item of itens) {
    try {
      const o = await loja.buscar(item, usados);
      if (o) {
        usados.add(o.codigo_externo);
        const { comissao, ...publico } = o;
        linhas.push({ ...publico, pet: item.pet, categoria: item.nicho, produto: item.id, origem: "robo", ativo: true });
        console.log(`ok   ${item.nome} → ${o.titulo.slice(0, 70)} | R$ ${o.preco}${comissao ? ` | comissão ${(comissao * 100).toFixed(1)}%` : ""}`);
      } else faltaram.push(item.nome);
    } catch (e) {
      erros++;
      console.log(`erro ${item.nome}: ${e.message}`);
      if (erros >= 15 && erros > linhas.length) { aviso(`${loja.rotulo}: erros demais, rodada interrompida.`); break; }
    }
    await espera(loja.pausa);
  }
  console.log(`${loja.rotulo}: ${linhas.length} anúncios escolhidos, ${faltaram.length} produtos sem anúncio bom hoje, ${erros} erros.`);
  if (faltaram.length) console.log("Sem anúncio hoje: " + faltaram.join("; "));
  if (TESTE) continue;
  try {
    if (linhas.length) await gravar(linhas);
    // Só limpa as antigas se a rodada foi boa (assim um dia com a loja fora do ar não esvazia a vitrine)
    const saiu = linhas.length >= itens.length * 0.3 ? await tirarAntigas(loja.nome) : 0;
    console.log(`${loja.rotulo}: publicado no site. ${saiu} anúncio(s) antigo(s) saíram da vitrine.`);
  } catch (e) { aviso(`${loja.rotulo}: ${e.message}`); falhou = true; }
  if (erros > linhas.length) falhou = true;
}
process.exit(falhou ? 1 : 0);
