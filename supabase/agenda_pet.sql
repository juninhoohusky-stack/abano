-- =========================================================
-- Abanô — Agenda Pet: eventos pet de todo o Brasil (encontros,
-- feiras de adoção, cãominhadas, feiras e congressos), com foto,
-- horário, preço e contato. A administração edita tudo pelo painel.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo: eventos já cadastrados (mesmo
-- "slug") não são duplicados nem sobrescritos.
-- =========================================================

-- ---------- 1. Campos novos ----------
alter table public.eventos add column if not exists fim         timestamptz;
alter table public.eventos add column if not exists horario     text check (char_length(horario) <= 80);
alter table public.eventos add column if not exists foto_url    text;
alter table public.eventos add column if not exists categoria   text not null default 'encontro';
alter table public.eventos add column if not exists preco       text check (char_length(preco) <= 80);
alter table public.eventos add column if not exists gratuito    boolean;
alter table public.eventos add column if not exists instagram   text check (char_length(instagram) <= 60);
alter table public.eventos add column if not exists contato     text check (char_length(contato) <= 120);
alter table public.eventos add column if not exists profissional boolean not null default false;
alter table public.eventos add column if not exists slug        text;
alter table public.eventos add column if not exists atualizado_em timestamptz not null default now();
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_categoria_check') then
    alter table public.eventos add constraint eventos_categoria_check
      check (categoria in ('adocao', 'encontro', 'caminhada', 'feira', 'saude', 'profissional', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eventos_foto_check') then
    alter table public.eventos add constraint eventos_foto_check check (foto_url is null
      or foto_url like 'https://igpwzidpiypzukmnskdb.supabase.co/storage/v1/object/public/fotos/%'
      or foto_url ~ '^imagens/eventos/[a-z0-9-]+\.(webp|jpg|png)$');
  end if;
end $$;
create unique index if not exists eventos_slug on public.eventos (slug) where slug is not null;
create index if not exists eventos_estado on public.eventos (estado, inicio);

create or replace function public._eventos_atualizado() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.instagram := nullif(regexp_replace(btrim(coalesce(new.instagram, '')), '^@+', ''), '');
  return new;
end $$;
drop trigger if exists eventos_atualizado on public.eventos;
create trigger eventos_atualizado before insert or update on public.eventos
  for each row execute function public._eventos_atualizado();

-- ---------- 2. Eventos (sem duplicar: o "slug" identifica cada um) ----------
-- Datas ao meio-dia de Brasília, para não "pular" de dia; o horário vai no campo horario.
insert into public.eventos (slug, titulo, inicio, fim, horario, cidade, estado, local, categoria, preco, gratuito, instagram, contato, link, foto_url, profissional, descricao) values
  ('caominhada-cpa-cuiaba-2026-11-15', 'Cãominhada CPA', '2026-11-15 12:00-03', null, 'Das 16h às 20h', 'Cuiabá', 'MT', 'Parque Tia Nair', 'caminhada', null, null, 'colegioadventistadocpa', null, 'https://www.instagram.com/colegioadventistadocpa/', 'imagens/eventos/caominhada-cpa-cuiaba-2026-11-15.webp', false,
   'Tarde de caminhada no parque com a família e os pets, ponto de adoção com a ONG Anjo de 4 Patas, sorteio de brindes e espaço para fotos.'),
  ('feira-adocao-petropolis-2026-11-17', 'Feira de adoção em Petrópolis', '2026-11-17 12:00-03', null, null, 'Petrópolis', 'RJ', null, 'adocao', null, null, null, null, null, null, false,
   'Feira de adoção de cães e gatos em Petrópolis. Confirme o local e o horário com a organização.'),
  ('feira-adocao-carioca-shopping-2026-11-21', 'Feira de adoção no Carioca Shopping', '2026-11-21 12:00-03', null, null, 'Rio de Janeiro', 'RJ', 'Carioca Shopping', 'adocao', null, null, null, null, null, null, false,
   'Feira de adoção de cães e gatos no Carioca Shopping. Confirme o horário com o shopping.'),
  ('mundo-animal-vicente-pires-2026-11-21', 'Manhã especial na Mundo Animal', '2026-11-21 12:00-03', null, 'Das 9h às 12h', 'Vicente Pires', 'DF', 'Agroveterinária Mundo Animal, Q3 Conjunto 09 Trecho 03 Loja 01', 'saude', 'Gratuito', true, 'agromundoanimall', '(61) 98555-4185', 'https://www.instagram.com/agromundoanimall/', 'imagens/eventos/mundo-animal-vicente-pires-2026-11-21.webp', false,
   'Vermifugação grátis para cães e gatos, amostras de ração e café da manhã para receber os tutores. Leve o seu pet.'),
  ('mutirao-passeio-caes-2026-11-22', 'Mutirão de passeio com cães', '2026-11-22 12:00-03', null, null, null, null, 'Local a confirmar', 'adocao', null, null, 'patinhasonline', null, 'https://www.instagram.com/patinhasonline/', 'imagens/eventos/mutirao-passeio-caes-2026-11-22.webp', false,
   'Um dia para passear com os cães de abrigo e conhecer quem está esperando adoção. As inscrições serão por formulário: acompanhe o perfil da organização.'),
  ('feira-pet-dracena-2026-11-26', '1ª Feira Pet de Dracena', '2026-11-26 12:00-03', '2026-11-27 12:00-03', 'Qui (26) das 10h às 18h · Sex (27) das 8h às 22h', 'Dracena', 'SP', 'Recinto da Fapidra, dentro da 2ª Expo Agro Dracena', 'feira', 'Entrada gratuita', true, 'acedracena', null, 'https://www.instagram.com/acedracena/', 'imagens/eventos/feira-pet-dracena-2026-11-26.webp', false,
   'Adoção responsável com ONGs, arrecadação de ração para os animais assistidos, orientação da Vigilância Sanitária e apresentação do canil da Polícia Militar.'),
  ('uzca-patas-pela-vida-2026-11-28', 'UZCA em Movimento – Patas pela Vida', '2026-11-28 12:00-03', null, null, 'São Pedro da Aldeia', 'RJ', null, 'caminhada', 'Caminhada gratuita · kits solidários pagos', true, null, null, 'https://abihrj.com.br/noticias/sao-pedro-da-aldeia-caominhada-solidaria-uzca-patas-pela-vida-28-novembro-2026', null, false,
   'Cãominhada solidária de 1 km com feira de adoção e atividades culturais e educativas.'),
  ('hyppet-festival-curitiba-2026-11-28', 'Hyppet Festival – adoção e bem-estar', '2026-11-28 12:00-03', null, null, 'Curitiba', 'PR', null, 'feira', null, null, null, null, null, null, false,
   'Festival com adoção e atividades de bem-estar animal. Confirme o local e o horário com a organização.'),
  ('feira-adocao-indefesos-2026-11-28', 'Feira de adoção Indefesos', '2026-11-28 12:00-03', null, null, 'Rio de Janeiro', 'RJ', null, 'adocao', null, null, null, null, null, null, false,
   'Feira de adoção de cães e gatos com a Indefesos. Confirme o local e o horário com a organização.'),
  ('encontro-shih-tzu-vitoria-da-conquista-2026-11-28', '1º Encontro de Shih Tzu', '2026-11-28 12:00-03', null, 'Às 15h', 'Vitória da Conquista', 'BA', 'Praça Pet do Shopping Boulevard', 'encontro', 'Entrada gratuita', true, 'palacio_leaodourado', null, 'https://www.instagram.com/palacio_leaodourado/', 'imagens/eventos/encontro-shih-tzu-vitoria-da-conquista-2026-11-28.webp', false,
   'Tarde de socialização para Shih Tzus e tutores, com brindes, sorteios e mini concursos.'),
  ('caominhada-marica-2026-11-29', '1ª Cãominhada de Maricá', '2026-11-29 12:00-03', null, 'A partir das 7h', 'Maricá', 'RJ', 'Orla de Araçatiba', 'caminhada', null, null, 'seba.marica', null, 'https://www.instagram.com/seba.marica/', 'imagens/eventos/caominhada-marica-2026-11-29.webp', false,
   'Manhã de caminhada com tutores e seus cães, organizada pela Secretaria de Bem-Estar Animal de Maricá. Atenção às regras da lei estadual para raças que precisam de focinheira.'),
  ('caominhada-vila-mascote-2026-11-29', '1ª Cãominhada da Vila Mascote', '2026-11-29 12:00-03', null, 'Concentração às 8h30 · saída às 9h', 'São Paulo', 'SP', 'Playcão, Rua Maratona, 162 – Vila Mascote', 'caminhada', 'Inscrição: 2 kg de ração', null, 'playcao_vilamascote', null, 'https://www.instagram.com/playcao_vilamascote/', 'imagens/eventos/caominhada-vila-mascote-2026-11-29.webp', false,
   'Passeio com o seu cão, brindes e surpresas. Inscrições de 23 a 27/11 (das 7h às 20h) e também no dia do evento.'),
  ('encontro-schnauzer-rio-2026-12-05', 'Encontro de Schnauzer Rio de Janeiro', '2026-12-05 12:00-03', null, 'Às 9h', 'Rio de Janeiro', 'RJ', 'Parcão da Lagoa Rodrigo de Freitas', 'encontro', null, null, 'meupetesteticaanimal', null, 'https://www.instagram.com/meupetesteticaanimal/', 'imagens/eventos/encontro-schnauzer-rio-2026-12-05.webp', false,
   'Encontro natalino de Schnauzers: traga o seu a caráter. Arrecadação de ração (a partir de 1 kg) e produtos para as ONGs Casa dos Anjos e Vira-Lovel.'),
  ('pets-day-guaruja-2026-12-06', '5º Pets Day', '2026-12-06 12:00-03', null, null, 'Guarujá', 'SP', null, 'feira', null, null, null, null, null, null, false,
   'Adoção, desfile e atividades para pets e famílias. Confirme o local e o horário com a organização.'),
  ('festival-pet-family-ribeirao-pires-2026-12-06', 'Festival Pet Family', '2026-12-06 12:00-03', null, null, 'Ribeirão Pires', 'SP', null, 'feira', null, null, null, null, null, null, false,
   'Festival pet para a família toda. Confirme o local e o horário com a organização.'),
  ('encontro-golden-itupeva-2026-12-12', 'Encontro de Golden Retriever com piscina', '2026-12-12 12:00-03', null, 'Às 9h30', 'Itupeva', 'SP', 'Recanto 4 Patas, Rua Perdiz, 245 – Chácaras do Guacuri', 'encontro', 'R$ 60 por pessoa · pet não paga', false, 'liga.dos.goldens', '(11) 93441-7587', 'https://www.instagram.com/liga.dos.goldens/', 'imagens/eventos/encontro-golden-itupeva-2026-12-12.webp', false,
   'Dia de piscina para os goldens, organizado pela Liga dos Goldens. É preciso confirmar presença e pagar antes; cada participante leva um prato de comida e a sua bebida.'),
  ('natal-dos-maltes-sp-2026-12-13', 'Natal dos Maltês', '2026-12-13 12:00-03', null, null, 'São Paulo', 'SP', null, 'encontro', null, null, null, null, null, null, false,
   'Encontro de Natal para Maltês e tutores. Confirme o local e o horário com a organização.'),
  ('natal-salsichas-caxias-2026-12-13', 'Encontro de Natal dos Salsichas Gaúchos', '2026-12-13 12:00-03', null, 'Das 15h às 18h30', 'Caxias do Sul', 'RS', 'Villagio Caxias – Villagio Pet, Rodovia RSC 453, 2780 – Desvio Rizzo', 'encontro', null, null, 'salsichasgauchos', '(54) 99240-2849', 'https://www.instagram.com/salsichasgauchos/', 'imagens/eventos/natal-salsichas-caxias-2026-12-13.webp', false,
   'Confraternização de Natal: todas as raças são bem-vindas. Arrecadação para a Help Vira-Latas. Nomes para os brindes até 30/11. Em caso de chuva, no Life Style Villagio Caxias.'),
  ('apaixonados-sao-goncalo-2026-12-19', 'Inauguração da Apaixonados em São Gonçalo', '2026-12-19 12:00-03', null, 'A partir das 9h', 'São Gonçalo', 'RJ', 'Rua Salvatori, 1156 – perto da Praça do Rocha', 'adocao', null, null, 'apaixonadosporquatropatas', '(21) 99799-2808', 'https://www.instagram.com/apaixonadosporquatropatas/', 'imagens/eventos/apaixonados-sao-goncalo-2026-12-19.webp', false,
   'Festa de inauguração da nova unidade da Apaixonados Veterinária, com adoção de cães e gatos filhotes, personagens da Patrulha Canina, pipoca e algodão-doce.'),
  ('congresso-oftalmologia-vet-2027-03-10', 'Congresso Brasileiro de Oftalmologia Veterinária', '2027-03-10 12:00-03', '2027-03-12 12:00-03', null, 'Fortaleza', 'CE', null, 'profissional', null, null, null, null, null, null, true,
   'Congresso para médicos-veterinários da área de oftalmologia.'),
  ('science4vets-2027-03-20', 'Science4Vets', '2027-03-20 12:00-03', '2027-03-21 12:00-03', null, 'São Paulo', 'SP', null, 'profissional', null, null, null, null, null, null, true,
   'Evento científico para médicos-veterinários.'),
  ('pet-soul-expo-2027-03-25', 'PET SOUL EXPO 2027', '2027-03-25 12:00-03', '2027-03-27 12:00-03', null, 'Florianópolis', 'SC', 'CentroSul', 'feira', null, null, null, null, null, null, false,
   'Feira voltada ao mercado e ao público pet.'),
  ('feira-superpet-2027-04-13', 'Feira SuperPet 2027', '2027-04-13 12:00-03', '2027-04-15 12:00-03', null, 'Campinas', 'SP', 'Expo Dom Pedro', 'profissional', null, null, null, null, null, null, true,
   'Feira de produtos, fornecedores e negócios para profissionais do setor pet. Não é uma feira de passeio com animais.'),
  ('congresso-vet-em-foco-2027-04-13', 'Congresso Vet em Foco', '2027-04-13 12:00-03', '2027-04-15 12:00-03', null, 'Campinas', 'SP', null, 'profissional', null, null, null, null, null, null, true,
   'Congresso para médicos-veterinários.'),
  ('congresso-anclivepa-2027-05-19', 'Congresso Brasileiro da Anclivepa', '2027-05-19 12:00-03', '2027-05-21 12:00-03', null, 'Florianópolis', 'SC', null, 'profissional', null, null, null, null, null, null, true,
   'Congresso nacional de clínicos veterinários de pequenos animais.'),
  ('feipet-2027-06-05', 'FEIPET 2027', '2027-06-05 12:00-03', '2027-06-07 12:00-03', null, 'Novo Hamburgo', 'RS', 'Fenac', 'profissional', null, null, null, null, 'https://feipet.com.br/', null, true,
   'Feira profissional com capacitação veterinária e competições de estética animal. Não permite a entrada de animais de visitantes.'),
  ('feira-pets-curitiba-2027-06-19', 'Feira Pets Curitiba 2027', '2027-06-19 12:00-03', '2027-06-21 12:00-03', null, 'Curitiba', 'PR', 'Centro de Eventos Positivo, Parque Barigui', 'feira', null, null, null, null, null, null, false,
   'Marcas, profissionais, tutores e serviços pet num só lugar.'),
  ('ortovet-expert-congress-2027-07-15', 'Ortovet Expert Congress', '2027-07-15 12:00-03', '2027-07-17 12:00-03', null, 'Rio de Janeiro', 'RJ', null, 'profissional', null, null, null, null, null, null, true,
   'Congresso de ortopedia veterinária.'),
  ('cat-in-rio-2027-08-05', 'Cat In Rio', '2027-08-05 12:00-03', '2027-08-06 12:00-03', null, 'Rio de Janeiro', 'RJ', null, 'profissional', null, null, null, null, null, null, true,
   'Evento do setor veterinário no Rio de Janeiro.'),
  ('pet-vet-expo-2027-08-11', 'PET VET Expo 2027', '2027-08-11 12:00-03', '2027-08-13 12:00-03', null, 'São Paulo', 'SP', 'Distrito Anhembi', 'profissional', null, null, null, null, null, null, true,
   'Exposição de marcas, tecnologia e serviços com congresso veterinário.')
on conflict (slug) where slug is not null do nothing;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar quantos eventos futuros existem (30 na primeira vez)
select count(*) as eventos_futuros from public.eventos where coalesce(fim, inicio) >= now() - interval '1 day';
