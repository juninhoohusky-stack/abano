-- =========================================================
-- Abanô — Agenda Pet: mais eventos (novembro e dezembro de 2026).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Precisa ter rodado antes: agenda_pet.sql.
-- Pode rodar de novo: nada é duplicado nem sobrescrito.
-- =========================================================

insert into public.eventos (slug, titulo, inicio, fim, horario, cidade, estado, local, categoria, preco, gratuito, instagram, contato, link, foto_url, profissional, descricao) values
  ('pet-run-canoas-2026-11-22', '1º Pet Run Mil Grau', '2026-11-22 12:00-03', null, 'Às 10h30', 'Canoas', 'RS', 'Canoas Shopping', 'caminhada', 'Inscrição: 1 kg de ração para cão ou gato', null, 'correcanoasmilgrau', null, 'https://www.instagram.com/correcanoasmilgrau/', 'imagens/eventos/pet-run-canoas-2026-11-22.webp', false,
   'Corrida solidária com grande feira de adoção. A ração arrecadada ajuda os animais do Instituto Eu Salvo Vidas.'),
  ('caominhada-pampulha-2026-11-22', 'Cãominhada do Festival Encontro de Pets Pampulha', '2026-11-22 12:00-03', null, null, 'Belo Horizonte', 'MG', 'Pampulha', 'caminhada', 'Com kit (vendido pela organização)', false, 'festivalencontrodepetspampulha', null, 'https://www.instagram.com/festivalencontrodepetspampulha/', 'imagens/eventos/caominhada-pampulha-2026-11-22.webp', false,
   'Cãominhada do Festival Encontro de Pets Pampulha. Quem comprou o kit recebe as informações por e-mail; fale com a organização pelo direct.'),
  ('pet-lervet-fest-sao-goncalo-2026-11-28', 'Pet Lervet Fest', '2026-11-28 12:00-03', null, 'Das 14h às 19h', 'São Gonçalo', 'RJ', 'Clínica Veterinária Popular Lervet, Rua Doutor Alfredo Backer, 269 e 273 – Mutondo', 'feira', 'Evento gratuito', true, 'franquialervet', null, 'https://www.instagram.com/franquialervet/', 'imagens/eventos/pet-lervet-fest-sao-goncalo-2026-11-28.webp', false,
   'Tarde com sorteios, concursos (pet mais fofo, tutor com mais pets), campanha de vacinação, vermifugação e check-up, animador e área pet friendly.'),
  ('caominhada-mesquita-2026-11-28', '2ª Cãominhada de Mesquita', '2026-11-28 12:00-03', null, 'Concentração às 7h · saída às 8h', 'Mesquita', 'RJ', 'Paço Municipal de Mesquita, Rua Paraná, s/n', 'caminhada', null, null, 'matriz_saojosemesquita', null, 'https://www.instagram.com/matriz_saojosemesquita/', 'imagens/eventos/caominhada-mesquita-2026-11-28.webp', false,
   'Cãominhada da Comissão de Proteção e Defesa dos Animais da OAB Mesquita com a Paróquia São José Operário. Os participantes recebem medalha, certificado e brindes, e há bênção aos animais. Inscrição pelo QR Code do cartaz.'),
  ('encontro-salsichas-centro-rio-2026-11-29', 'Encontro de Salsichas no Centro do Rio', '2026-11-29 12:00-03', null, 'Às 10h', 'Rio de Janeiro', 'RJ', 'Área de lazer da Avenida Mem de Sá, em frente ao nº 183 – Centro', 'encontro', null, null, 'meuamigoclubepet', null, 'https://www.instagram.com/meuamigoclubepet/', 'imagens/eventos/encontro-salsichas-centro-rio-2026-11-29.webp', false,
   'Manhã para reunir Dachshunds e tutores, trocar experiências e tirar muitas fotos. Organização: Meu Amigo Clube Pet e Clube dos Dachshunds RJ.'),
  ('encontro-spitz-sp-2026-12-05', '3º Encontro Os Spitz-SP', '2026-12-05 12:00-03', null, 'Das 10h às 13h', 'São Paulo', 'SP', 'Rua Augusta, 2380 – Cerqueira César', 'encontro', null, null, 'osspitz.saopaulo', null, 'https://www.instagram.com/osspitz.saopaulo/', 'imagens/eventos/encontro-spitz-sp-2026-12-05.webp', false,
   'Encontro de fim de ano dos Spitz de São Paulo, com diversão, novas amizades e muitos brindes.'),
  ('natal-goldens-goiania-2026-12-06', 'Encontro de Natal dos Goldens Goiânia', '2026-12-06 12:00-03', null, 'Às 8h30', 'Goiânia', 'GO', 'Entrada do Goiânia Shopping, em frente ao Vaca Brava', 'encontro', null, null, 'goldensgoiania', null, 'https://www.instagram.com/goldensgoiania/', 'imagens/eventos/natal-goldens-goiania-2026-12-06.webp', false,
   'Encontro de Natal dos Goldens de Goiânia. A camiseta do evento é opcional e o grupo promete uma surpresa este ano.'),
  ('caominhada-pet-de-todos-ipatinga-2026-12-06', '4ª Cãominhada Pet de Todos', '2026-12-06 12:00-03', null, 'Às 9h30', 'Ipatinga', 'MG', 'Galpão do Parque Ipanema', 'caminhada', null, null, 'petdetodosipatinga', '(31) 98214-7331', 'https://petdetodosipatinga.com.br/', 'imagens/eventos/caominhada-pet-de-todos-ipatinga-2026-12-06.webp', false,
   'Cãominhada com Natal Solidário: leve um brinquedo, que será doado a crianças. Inscrição pelo site da organização.'),
  ('caominhada-oab-americana-2026-12-13', '1ª Cãominhada Pet OAB Americana', '2026-12-13 12:00-03', null, 'A partir das 7h30', 'Americana', 'SP', 'Em frente à OAB Americana (48ª Subseção)', 'caminhada', 'Kit: R$ 60 (camiseta, bandana e saquinho)', false, 'oabamericana', null, 'https://forms.gle/YFGGZ8z2DxNWnGGr5', 'imagens/eventos/caominhada-oab-americana-2026-12-13.webp', false,
   'Caminhada com o seu pet por uma causa: a luta contra os maus-tratos. Inscrição pelo formulário; o pagamento do kit é combinado depois, com a equipe.')
on conflict (slug) where slug is not null do nothing;

-- Conferência: deve mostrar 39 (30 da primeira lista + 9 novos)
select count(*) as total_eventos from public.eventos where slug is not null;
