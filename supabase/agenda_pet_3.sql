-- =========================================================
-- Abanô — Agenda Pet: mais 2 eventos.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Precisa ter rodado antes: agenda_pet.sql.
-- Pode rodar de novo: nada é duplicado nem sobrescrito.
-- =========================================================

insert into public.eventos (slug, titulo, inicio, fim, horario, cidade, estado, local, categoria, preco, gratuito, instagram, contato, link, foto_url, profissional, descricao) values
  ('encontro-caramelo-araraquara-2026-11-22', 'Encontro de Caramelo no Pet Café', '2026-11-22 12:00-03', null, 'Às 10h e às 17h', 'Araraquara', 'SP', 'Pet Café', 'encontro', 'Aberto ao público', null, 'petcafeararaquara', null, 'https://www.instagram.com/petcafeararaquara/', 'imagens/eventos/encontro-caramelo-araraquara-2026-11-22.webp', false,
   'Encontro dos vira-latas caramelo, com sorteio de mimos do Pet Café. Leve a família e o seu caramelo.'),
  ('caofra-canisorocaba-2026-12-06', 'Cãofra Canisorocaba', '2026-12-06 12:00-03', null, null, 'Sorocaba', 'SP', null, 'encontro', null, null, 'canisorocaba', null, 'https://www.instagram.com/canisorocaba/', 'imagens/eventos/caofra-canisorocaba-2026-12-06.webp', false,
   'Confraternização do grupo Canicross Sorocaba com os cães. Local e horário serão divulgados pela organização.')
on conflict (slug) where slug is not null do nothing;

-- Conferência: deve mostrar 41
select count(*) as total_eventos from public.eventos where slug is not null;
