/* Abanô — Adoção: dados compartilhados entre a página Adoção e o painel da ONG.
   O questionário padrão fica aqui, para os dois lados verem as mesmas perguntas. */
window.ABANO_ADOCAO = (function () {
  "use strict";
  var PERGUNTAS = [
    { id: "moradia", tipo: "opcoes", rotulo: "Você mora em casa ou apartamento?", opcoes: ["Casa", "Apartamento", "Sítio ou chácara"] },
    { id: "imovel", tipo: "opcoes", rotulo: "O imóvel é próprio ou alugado?", opcoes: ["Próprio", "Alugado"] },
    { id: "aceita_pets", tipo: "opcoes", rotulo: "O imóvel aceita pets?", opcoes: ["Sim", "Não", "Não sei"] },
    { id: "seguranca", tipo: "opcoes", rotulo: "As janelas têm tela e o quintal ou muro é seguro?", opcoes: ["Sim, tudo seguro", "Em parte", "Não"] },
    { id: "moradores", tipo: "texto", rotulo: "Quem mora com você?", dica: "Ex.: eu, meu marido e um filho de 8 anos" },
    { id: "criancas", tipo: "opcoes", rotulo: "Tem crianças em casa?", opcoes: ["Sim", "Não"] },
    { id: "concordam", tipo: "opcoes", rotulo: "Todos em casa concordam com a adoção?", opcoes: ["Sim", "Ainda não conversei com todos", "Moro sozinho(a)"] },
    { id: "outros_pets", tipo: "texto", rotulo: "Tem outros pets? Quais? Estão vacinados e castrados?", dica: "Se não tiver, escreva \"não\"" },
    { id: "sozinho", tipo: "opcoes", rotulo: "Quanto tempo o pet ficaria sozinho por dia?", opcoes: ["Até 4 horas", "De 4 a 8 horas", "Mais de 8 horas"] },
    { id: "experiencia", tipo: "texto_longo", rotulo: "Já teve pets antes? O que aconteceu com eles?" },
    { id: "motivo", tipo: "texto_longo", rotulo: "Por que você quer adotar este pet?" }
  ];
  var CIENTE = "Estou ciente dos cuidados e dos gastos com ração, vacinas, veterinário e castração.";

  var ESPECIES = { cachorro: "Cachorro", gato: "Gato", ave: "Ave", pequeno_mamifero: "Pequeno mamífero", reptil: "Réptil", peixe: "Peixe", outro: "Outro" };
  var SEXOS = { macho: "Macho", femea: "Fêmea" };
  var IDADES = { filhote: "Filhote", jovem: "Jovem", adulto: "Adulto", idoso: "Idoso" };
  var PORTES = { pequeno: "Porte pequeno", medio: "Porte médio", grande: "Porte grande" };
  var STATUS = { disponivel: "Disponível", em_processo: "Em processo de adoção", adotado: "Adotado" };
  var UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

  function soDigitos(v) { return String(v || "").replace(/\D/g, ""); }
  // Aceita (21) 99999-9999 ou +55 21 99999-9999; guarda só os números
  function whatsappValido(v) { var d = soDigitos(v); return d.length >= 10 && d.length <= 13; }
  function linkWhatsapp(numero, texto) {
    var d = soDigitos(numero);
    if (d.length <= 11) d = "55" + d;
    return "https://wa.me/" + d + (texto ? "?text=" + encodeURIComponent(texto) : "");
  }
  function formatarWhatsapp(numero) {
    var d = soDigitos(numero);
    if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return numero;
  }
  // Mesma regra do banco: o anúncio não leva valores em reais
  function temValorEmReais(t) { return /(r\$ ?[0-9]|[0-9]+ ?(reais|real)\b|[0-9]+,[0-9]{2})/i.test(t || ""); }

  return { PERGUNTAS: PERGUNTAS, CIENTE: CIENTE, ESPECIES: ESPECIES, SEXOS: SEXOS, IDADES: IDADES, PORTES: PORTES, STATUS: STATUS, UFS: UFS,
           soDigitos: soDigitos, whatsappValido: whatsappValido, linkWhatsapp: linkWhatsapp, formatarWhatsapp: formatarWhatsapp, temValorEmReais: temValorEmReais };
})();
