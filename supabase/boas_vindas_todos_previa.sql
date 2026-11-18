-- =========================================================
-- Abanô — PRÉVIA do post de boas-vindas a todos os membros
-- Só MOSTRA o texto. Não publica nada e não muda nada.
-- Copie em texto puro (link "raw" do GitHub, tradução do
-- navegador DESLIGADA), cole no SQL Editor e clique em "Run".
-- =========================================================
with abano as (
  select p.id from auth.users u join public.perfis p on p.id = u.id
   where lower(u.email) = 'somosabano@gmail.com'
),
membros as (
  select p.usuario, row_number() over (order by coalesce(p.aceitou_em, p.criado_em)) as n
    from public.perfis p
   where p.versao_politica is not null and not p.suspenso
     and p.id not in (select id from abano)
),
partes as (   -- até 200 marcações por post (o post aceita até 5.000 letras)
  select (n - 1) / 200 + 1 as parte, string_agg('@' || usuario, ', ' order by n) as lista
    from membros group by 1
),
total as (select count(*) as membros, max(parte) as posts from membros, partes)
select t.membros as membros_marcados,
       t.posts as quantidade_de_posts,
       (select count(*) from abano) as perfil_abano_existe,
       pa.parte,
       '🐾 Um abraço de boas-vindas a todo mundo que já faz parte da Comunidade Abanô!'
       || case when t.posts > 1 then ' (' || pa.parte || ' de ' || t.posts || ')' else '' end || E'\n\n'
       || pa.lista || '.' || E'\n\n'
       || 'Obrigado por chegarem cedo e ajudarem a construir este cantinho de quem ama cães e gatos. '
       || 'Por aqui vocês podem apresentar o seu pet com foto, entrar no clube da sua raça ou do seu estado, '
       || 'tirar dúvidas com outros tutores e ajudar na adoção e na busca por pets desaparecidos.' || E'\n\n'
       || 'A partir de agora, toda segunda-feira damos as boas-vindas a quem chegou na semana. '
       || 'Convide os tutores que você conhece para fazer parte também! 💛' as texto_do_post
  from partes pa cross join total t
 order by pa.parte;
