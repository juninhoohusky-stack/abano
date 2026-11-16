-- =========================================================
-- Abanô — Clube dos Vira-latas (SRD).
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo: não duplica.
-- =========================================================

insert into public.clubes (id, nome, descricao, tipo, ordem) values
  ('vira-latas', 'Vira-latas', 'Para quem divide a casa com um vira-lata (SRD): caramelos, pretinhos, malhados e todos os amores sem raça definida. Fotos, histórias de adoção e o dia a dia.', 'raca', 12)
on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, tipo = excluded.tipo, ordem = excluded.ordem;

-- Conferência: deve mostrar o clube
select id, nome from public.clubes where id = 'vira-latas';
