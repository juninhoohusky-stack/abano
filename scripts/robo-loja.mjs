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

// ---------- Regras dos Achadinhos (valem para todas as lojas) ----------
// Só entra no site produto de pet, de loja confiável, bem avaliado e que já vendeu bastante.
const REGRAS = {
  notaProdutoMinima: 4.7,       // nota do anúncio (0 a 5)
  notaLojaMinima: 4.7,          // nota da loja na Shopee (0 a 5), quando a Shopee informa
  vendasMinimas: 6,             // a loja já vendeu pelo menos 6 unidades daquele mesmo anúncio
  tiposShopee: [1, 2, 4],       // 1 = Shopee Mall (loja oficial), 2 = Indicado, 4 = Indicado+. Loja comum não entra.
  nivelML: "5_green",           // Mercado Livre: termômetro verde (o melhor nível de reputação)
  medalhasML: ["gold", "platinum"],   // MercadoLíder Gold ou Platinum (ou loja oficial)
  positivasML: 0.95,            // pelo menos 95% de avaliações positivas do vendedor
  vendasLojaML: 500,            // vendedor com pelo menos 500 vendas concluídas
  // Itens essenciais (rações, ar-condicionado, aspiradores: campo "essencial" no catálogo) precisam estar sempre no site.
  // Para eles vale qualquer loja da Shopee com nota a partir de 4, e o produto também com nota a partir de 4.
  essencialNotaLoja: 4,
  essencialNotaProduto: 4,
};
const bloqueadas = JSON.parse(await readFile(new URL("../dados/lojas-bloqueadas.json", import.meta.url), "utf8"));
const bloqueada = (loja, id, nome) => (bloqueadas[loja] || []).some((b) => String(b).trim().toLowerCase() === String(id).toLowerCase() ||
  String(b).trim().toLowerCase() === String(nome || "").trim().toLowerCase());

const catalogo = JSON.parse(await readFile(new URL("../dados/loja-catalogo.json", import.meta.url), "utf8")).itens;
// Cada rodada começa num ponto diferente do catálogo: se o tempo acabar, a próxima continua de onde esta parou
const giro = Math.floor(Date.now() / (6 * 3600e3)) * 97 % catalogo.length;
const itens = LIMITE ? catalogo.slice(0, LIMITE) : [...catalogo.slice(giro), ...catalogo.slice(0, giro)];
const INICIO = Date.now();
const MINUTOS = Number(process.env.MINUTOS || 75);         // tempo máximo de busca por rodada (o GitHub corta em 90)
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
const LIGACAO = new Set(["de", "da", "do", "das", "dos", "para", "pra", "com", "sem", "e", "em", "no", "na", "o", "a", "ou", "que", "por", "tipo"]);
const raiz = (p) => (p.length > 5 ? p.slice(0, p.length - 2) : p);
const SO_NA_BUSCA =new Set(["premium", "super", "especial", "extrusada", "vario", "caixa", "grande", "pequeno", "pequena"]);
const PROIBIDO = /\b(usado|usada|replica|revenda|atacado|humano|infantil|bebe|crianca)\b/;
// Nos produtos para os animais, o título precisa deixar claro que é de pet.
// Os itens "Para quem ama pets" (aspirador, ar-condicionado, capa de sofá...) não precisam: servem para a casa toda.
const DE_PET = /\b(pet|pets|cachorr\w*|cao|caes|dog|dogs|canin\w*|gat[oa]s?|gatinh\w*|cat|cats|felin\w*|filhote\w*|animal|animais|patinha\w*|patas?|pelagem|tira pelos?|tirar pelos?|remove\w* (?:de )?pelos?|pelos? de (?:pet|cachorro|cao|gato)|racao|racoes|petisco\w*|coleira\w*|peitoral|guia|arranhador\w*|areia|sanitari\w*|adestramento|aves?|passar\w*|calopsita\w*|periquito\w*|canario\w*|gaiola\w*|poleiro\w*|hamster\w*|roedor\w*|coelho\w*|porquinho\w*|chinchila\w*|peixe\w*|betta|aquario\w*|terrario\w*|reptil\w*|repteis|tartaruga\w*|jabuti\w*|iguana\w*|galinha\w*|cavalo\w*|equin\w*)\b/;

// Ração de marca: o anúncio tem de ser de comida (seca ou úmida) e não um acessório com o nome da marca
const DE_COMIDA = /\b(racao|racoes|sache|saches|pate|pates|lata|latas|umida|umido|alimento|food|wet|dry)\b/;
const NAO_E_COMIDA = /\b(comedouro|bebedouro|pote|porta racao|dosador|tapete|brinquedo|camiseta|caneca|adesivo|vasilha|organizador|container|medidor|colher|amostra)\b/;
const temMarca = (item, tp) => (item.marcas || []).map((m) => palavras(m).filter((p) => p.length > 1 && !["gato", "formula"].includes(p)))
  .some((m) => m.length && m.every((p) => tp.has(p)));

function combina(item, titulo) {
  const t = normal(titulo);
  const tp = new Set(t.split(" ").map(singular));
  if (PROIBIDO.test(t)) return false;
  if (item.pet === "cao" && DE_GATO.test(t) && !DE_CAO.test(t)) return false;  // produto de gato no lugar de cão
  if (item.pet === "gato" && DE_CAO.test(t) && !DE_GATO.test(t)) return false;
  if (item.porMarca) {                                                    // todas as rações (pesos e tipos) de uma marca
    if (!temMarca(item, tp) || !DE_COMIDA.test(t) || NAO_E_COMIDA.test(t)) return false;
    return !item.exige || new RegExp(item.exige).test(t);
  }
  if (item.area !== "tutor" && !DE_PET.test(t)) return false;
  // Nas rações, quem garante a qualidade é a marca: anúncio quase nunca escreve "super premium" no título
  const chave = palavras(item.busca).filter((p) => !GENERICAS.has(p) && !LIGACAO.has(p) && !(item.nicho === "racao" && SO_NA_BUSCA.has(p)));
  // Aceita variações da mesma palavra: automático/automática, aquecida/aquecido, natural/naturais
  const raizes = new Set([...tp].map(raiz));
  const tem = (p) => tp.has(p) || raizes.has(raiz(p));
  if (!chave.length || !tem(chave[0])) return false;                  // a palavra principal tem de estar no título
  const achou = chave.filter(tem).length;
  if (achou / chave.length < 0.6) return false;
  if (item.exige && !new RegExp(item.exige).test(t)) return false;   // palavra obrigatória (ex.: "portatil", "split")
  // Só ração premium ou super premium. A marca vale quando todas as palavras dela aparecem no título
  // ("Hill's" acha "Hills", "Purina Pro Plan" acha "Pro Plan Purina")
  if (item.nicho === "racao" && !temMarca(item, tp)) return false;
  return true;
}

// Quem passa nas regras é ordenado por: chance de vender muito, preço bom, desconto, nota e comissão
const descontoDe = (o) => (o.preco_antigo > o.preco ? (1 - o.preco / o.preco_antigo) * 100 : 0);
function pontuar(lista) {
  const precos = lista.map((o) => o.preco).sort((a, b) => a - b);
  const mediana = precos[Math.floor(precos.length / 2)] || 1;
  for (const o of lista) {
    const barato = Math.max(-1, Math.min(1, (mediana - o.preco) / mediana));      // mais barato que os parecidos ganha ponto
    o.pontos = Math.log10((o.vendas || 0) + 1) * 1.5 + (o.avaliacao || 4.7) + barato * 1.2 + descontoDe(o) * 0.04 + (o.comissao || 0) * 5;
  }
  return lista.sort((a, b) => b.pontos - a.pontos);
}

const motivos = {};   // por que anúncios ficaram de fora (vai para o resumo da rodada)
const recusa = (m) => { motivos[m] = (motivos[m] || 0) + 1; return false; };

// Regras do anúncio que valem antes de olhar a loja
function anuncioBom(item, o, usados) {
  if (!(o.preco > 0) || usados.has(o.codigo_externo)) return false;
  if (!combina(item, o.titulo)) return recusa("não é o produto pet procurado");
  // Acessório ou peça no lugar do aparelho (ex.: "mini ar-condicionado USB", panos de reposição do robô)
  if (item.evitar && new RegExp(item.evitar).test(normal(o.titulo))) return recusa("não é o produto procurado (peça, refil ou miniatura)");
  if (item.precoMin && o.preco < item.precoMin) return recusa("não é o produto procurado (preço de peça ou miniatura)");
  if (item.essencial && o.loja === "shopee") {
    if (!(o.avaliacao >= REGRAS.essencialNotaProduto)) return recusa("nota do produto baixa");
  } else if (o.loja === "shopee") {
    if (!o.tipoLoja.some((t) => REGRAS.tiposShopee.includes(t))) return recusa("loja comum (não é Mall nem Indicada)");
    if (!(o.avaliacao >= REGRAS.notaProdutoMinima)) return recusa("nota do produto baixa");
  }
  if ((o.vendas || 0) < REGRAS.vendasMinimas && o.loja === "shopee") return recusa("poucas vendas");
  if (bloqueada(o.loja, o.loja_id, o.loja_nome)) return recusa("loja bloqueada");
  return true;
}

// Escolhe os melhores anúncios que passam em todas as regras, inclusive a da loja (checada só para os primeiros da fila).
// A maioria dos itens do catálogo leva 1 anúncio; as rações por marca levam vários (item.quantos), um para cada peso e tipo.
async function melhores(item, candidatos, usados, lojaConfiavel) {
  const quantos = item.quantos || 1, escolhidos = [];
  const fila = pontuar(candidatos.filter((o) => anuncioBom(item, o, usados)));
  if (item.menorPreco) {
    // Rações: uma opção para cada variação (idade, porte, linha, sabor, peso), sempre a mais barata entre as lojas aceitas
    const grupos = new Map();
    for (const o of fila) {
      const k = variacao(o.titulo);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(o);
    }
    for (const lista of grupos.values()) {
      if (escolhidos.length >= quantos) break;
      lista.sort((a, b) => a.preco - b.preco);
      for (const o of lista.slice(0, 4)) if (await lojaConfiavel(o, item)) { escolhidos.push(o); break; }
    }
  } else for (const o of fila.slice(0, quantos * 2 + 3)) {
    if (escolhidos.length >= quantos) break;
    if (await lojaConfiavel(o, item)) escolhidos.push(o);
  }
  // Para ajustar a busca depois: mostra o que a loja devolveu quando nada passou
  if (!escolhidos.length) console.log(`sem  ${item.nome} [busca: ${item.busca}]: ` + (candidatos.length
    ? `${candidatos.length} anúncios, ${fila.length} passaram no título/nota/vendas. Ex.: ${candidatos.slice(0, 2).map((o) => `"${o.titulo.slice(0, 60)}"`).join(" | ")}`
    : "a busca não trouxe nada"));
  return escolhidos;
}

// ---------- Shopee (API oficial de afiliados) ----------
async function shopeeGraphQL(consulta) {
  const corpo = JSON.stringify({ query: consulta });
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
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
      // 10030 = muitas consultas; 10000 = falha passageira da Shopee: espera e tenta de novo
      if ((codigo === 10030 || codigo === 10000) && tentativa < 4) { await espera((codigo === 10030 ? 12000 : 3000) * tentativa); continue; }
      throw new Error(`Shopee recusou (${codigo || r.status}): ${erro.message}`);
    }
    return j.data || {};
  }
  return {};
}

// Busca os mais vendidos e os mais relevantes (duas listas), já com o tipo e o código da loja
// O que diferencia uma ração da outra da mesma marca: idade, porte, linha, sabor, tipo e peso.
// Anúncios com a mesma combinação são o mesmo produto em lojas diferentes: fica só o mais barato.
const TRACOS = new Set(["filhote", "junior", "adulto", "senior", "idoso", "mini", "pequeno", "medio", "grande", "gigante", "toy",
  "castrado", "light", "obeso", "sensitive", "sensivel", "urinary", "urinario", "renal", "hipoalergenico", "dermato", "digestive",
  "hairball", "indoor", "persian", "gourmet", "prime", "ancestral", "grain", "quinoa", "pumpkin", "abobora", "roma",
  "cordeiro", "frango", "carne", "salmao", "peixe", "atum", "peru", "pato", "javali", "cervo", "mandioca", "arroz", "vegetal",
  "sache", "pate", "lata", "umida", "kit", "combo", "caixa", "cookie", "snack", "biscoito"]);
function variacao(titulo) {
  const m = String(titulo).toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|quilos?|g|gr|gramas)\b/);
  const gramas = m ? Math.round(parseFloat(m[1].replace(",", ".")) * (/^k|^q/.test(m[2]) ? 1000 : 1)) : 0;
  const t = palavras(titulo).filter((p) => TRACOS.has(p));
  return [...new Set(t)].sort().join(" ") + " | " + gramas;
}

async function shopee(item) {
  const campos = "itemId productName imageUrl priceMin priceDiscountRate sales ratingStar commissionRate offerLink shopName shopId shopType";
  const vistos = new Map();
  // Além da busca principal, os itens podem ter buscas extras (ex.: cada porte e idade da ração)
  const buscas = [item.busca, ...(item.buscas || [])];
  for (const [i, busca] of buscas.entries()) {   // sortType 2 = mais vendidos
    if (i) await espera(800);
    const d = await shopeeGraphQL(`{productOfferV2(keyword:${JSON.stringify(busca)},sortType:2,page:1,limit:50){nodes{${campos}}}}`);
    for (const n of (d.productOfferV2 && d.productOfferV2.nodes) || []) {
      if (vistos.has(n.itemId)) continue;
      const preco = Number(n.priceMin);
      const desc = Number(n.priceDiscountRate) || 0;
      vistos.set(n.itemId, {
        codigo_externo: `shopee:${n.itemId}`, loja: "shopee", titulo: String(n.productName || "").slice(0, 160),
        link: n.offerLink, imagem_url: n.imageUrl || null, preco,
        preco_antigo: desc >= 5 && desc < 90 ? Math.round((preco / (1 - desc / 100)) * 100) / 100 : null,
        avaliacao: Number(n.ratingStar) || null, vendas: Number(n.sales) || 0, comissao: Number(n.commissionRate) || 0,
        loja_id: String(n.shopId || ""), loja_nome: n.shopName || "",
        tipoLoja: (Array.isArray(n.shopType) ? n.shopType : [n.shopType]).map(Number).filter(Boolean),
      });
    }
  }
  return [...vistos.values()].filter((o) => /^https:\/\//.test(o.link || ""));
}

// Nota da loja na Shopee (consultada uma vez por loja em cada rodada)
const notasLojaShopee = new Map();
async function lojaShopeeConfiavel(o, item = {}) {
  if (!o.loja_id) return recusa("loja sem identificação");
  const indicada = o.tipoLoja.some((t) => REGRAS.tiposShopee.includes(t));
  // Item essencial em loja Mall/Indicada: a própria Shopee já avaliou a loja, não precisa consultar
  if (item.essencial && indicada) return true;
  if (!notasLojaShopee.has(o.loja_id)) {
    let nota = null;
    try {
      const d = await shopeeGraphQL(`{shopOfferV2(shopId:${Number(o.loja_id)},page:1,limit:1){nodes{shopId shopName ratingStar shopType}}}`);
      const n = ((d.shopOfferV2 && d.shopOfferV2.nodes) || [])[0];
      nota = n && Number(n.ratingStar) ? Number(n.ratingStar) : null;
    } catch (e) { console.log(`  (não consegui ler a nota da loja ${o.loja_nome}: ${e.message})`); }
    notasLojaShopee.set(o.loja_id, nota);
  }
  const nota = notasLojaShopee.get(o.loja_id);
  // Loja Mall ou Indicada já passou pelo crivo da própria Shopee; se a nota vier, ela também precisa ser alta
  if (item.essencial) {   // loja comum: só entra se a Shopee informar a nota e ela for de pelo menos 4
    if (nota === null) return recusa("loja comum sem nota informada");
    return nota >= REGRAS.essencialNotaLoja ? true : recusa("nota da loja baixa");
  }
  if (nota !== null && nota < REGRAS.notaLojaMinima) return recusa("nota da loja baixa");
  return true;
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
  const busca = await getML(`/products/search?status=active&site_id=MLB&limit=${item.quantos ? 50 : 15}&q=${encodeURIComponent(item.busca)}`);
  const candidatos = (busca.results || [])
    .filter((p) => !usados.has(`ml:${p.id}`) && combina(item, p.name))
    .slice(0, Math.max(5, (item.quantos || 1) + 3));
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
      loja_id: String(vencedor.seller_id || ""), loja_nome: "", oficial: Boolean(vencedor.official_store_id), tipoLoja: [],
    });
  }
  return lista;
}

// Vendedor do Mercado Livre: termômetro verde, MercadoLíder Gold/Platinum (ou loja oficial), muitas vendas e quase nenhuma reclamação
const vendedoresML = new Map();
async function lojaMLConfiavel(o) {
  if (!o.loja_id) return recusa("vendedor sem identificação");
  if (!vendedoresML.has(o.loja_id)) vendedoresML.set(o.loja_id, await getML(`/users/${o.loja_id}`).catch(() => null));
  const v = vendedoresML.get(o.loja_id);
  if (!v) return recusa("não consegui checar o vendedor");
  o.loja_nome = v.nickname || "";
  if (bloqueada("mercadolivre", o.loja_id, o.loja_nome)) return recusa("loja bloqueada");
  const rep = v.seller_reputation || {};
  const tr = rep.transactions || {};
  if (rep.level_id !== REGRAS.nivelML) return recusa("vendedor sem termômetro verde");
  if (!o.oficial && !REGRAS.medalhasML.includes(rep.power_seller_status)) return recusa("vendedor não é MercadoLíder Gold/Platinum");
  if ((tr.completed || 0) < REGRAS.vendasLojaML) return recusa("vendedor com poucas vendas");
  if (tr.ratings && tr.ratings.positive < REGRAS.positivasML) return recusa("vendedor com muitas avaliações negativas");
  return true;
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
  { nome: "shopee", rotulo: "Shopee", pronta: env.SHOPEE_APP_ID && env.SHOPEE_SECRET, pausa: 1500,
    buscar: async (item, usados) => melhores(item, await shopee(item), usados, lojaShopeeConfiavel) },
  { nome: "mercadolivre", rotulo: "Mercado Livre", pronta: env.ML_CLIENT_ID && env.ML_CLIENT_SECRET && env.ML_ETIQUETA && env.ML_MATT_TOOL, pausa: 300,
    preparar: entrarML, buscar: async (item, usados) => melhores(item, await mercadolivre(item, usados), usados, lojaMLConfiavel) },
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
  let erros = 0, seguidos = 0, gravadas = 0, vistos = 0;
  // Grava aos poucos: se a rodada for interrompida, o que já foi achado não se perde
  const gravarPendentes = async () => {
    if (TESTE || gravadas >= linhas.length) return;
    try { await gravar(linhas.slice(gravadas)); gravadas = linhas.length; } catch (e) { aviso(`${loja.rotulo}: ${e.message}`); falhou = true; }
  };
  for (const item of itens) {
    if ((Date.now() - INICIO) / 60000 > MINUTOS) { console.log(`Tempo da rodada acabou: ${vistos} de ${itens.length} produtos vistos. A próxima rodada continua.`); break; }
    vistos++;
    try {
      const achados = await loja.buscar(item, usados);
      seguidos = 0;
      for (const o of achados) {
        usados.add(o.codigo_externo);
        // Só vão para o banco as colunas da tabela ofertas
        const { comissao, loja_id, loja_nome, tipoLoja, oficial, pontos, ...publico } = o;
        linhas.push({ ...publico, pet: item.pet, categoria: item.nicho, produto: item.id, origem: "robo", ativo: true });
        console.log(`ok   ${item.nome} → ${o.titulo.slice(0, 60)} | R$ ${o.preco} | ${o.vendas} vendas | nota ${o.avaliacao || "-"} | loja ${loja_nome || loja_id}${comissao ? ` | comissão ${(comissao * 100).toFixed(1)}%` : ""}`);
      }
      if (!achados.length) faltaram.push(item.nome);
      if (linhas.length - gravadas >= 15) await gravarPendentes();
    } catch (e) {
      erros++;
      console.log(`erro ${item.nome}: ${e.message}`);
      if (++seguidos >= 12) { aviso(`${loja.rotulo}: erros demais, rodada interrompida.`); break; }
    }
    await espera(loja.pausa);
  }
  console.log(`${loja.rotulo}: ${linhas.length} anúncios escolhidos, ${faltaram.length} produtos sem anúncio bom hoje, ${erros} erros.`);
  if (faltaram.length) console.log("Sem anúncio bom hoje: " + faltaram.join("; "));
  console.log("Anúncios recusados pelas regras: " + (Object.entries(motivos).map(([m, n]) => `${m} (${n})`).join("; ") || "nenhum"));
  for (const m in motivos) delete motivos[m];
  if (TESTE) continue;
  try {
    await gravarPendentes();
    // Só limpa as antigas se a rodada foi boa (assim um dia com a loja fora do ar não esvazia a vitrine)
    const saiu = linhas.length >= 40 ? await tirarAntigas(loja.nome) : 0;
    console.log(`${loja.rotulo}: publicado no site. ${saiu} anúncio(s) antigo(s) saíram da vitrine.`);
  } catch (e) { aviso(`${loja.rotulo}: ${e.message}`); falhou = true; }
  if (erros > linhas.length) falhou = true;
}
process.exit(falhou ? 1 : 0);
