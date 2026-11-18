-- =========================================================
-- Abanô — PUBLICA o post de boas-vindas a todos os membros
-- (o mesmo texto da prévia: boas_vindas_todos_previa.sql).
-- Publica pelo perfil do Abanô (somosabano@gmail.com), avisa
-- cada pessoa no sininho e não publica duas vezes.
-- Copie em texto puro (link "raw" do GitHub, tradução do
-- navegador DESLIGADA), cole no SQL Editor e clique em "Run".
-- =========================================================
do $$
declare v_autor uuid; v_total int; v_posts int; v_parte int; v_lista text; v_texto text; v_post uuid;
begin
  select p.id into v_autor from auth.users u join public.perfis p on p.id = u.id
   where lower(u.email) = 'somosabano@gmail.com';
  if v_autor is null then
    raise exception 'Falta o perfil da conta somosabano@gmail.com: entre na Comunidade com ela, aceite as regras e rode de novo.';
  end if;
  if exists (select 1 from public.posts where autor = v_autor and texto like '🐾 Um abraço de boas-vindas a todo mundo que já faz parte da Comunidade Abanô!%') then
    raise exception 'Esse post de boas-vindas já foi publicado. Nada foi feito.';
  end if;

  create temporary table _todos on commit drop as
  select p.id, p.usuario, row_number() over (order by coalesce(p.aceitou_em, p.criado_em)) as n
    from public.perfis p
   where p.versao_politica is not null and not p.suspenso and p.id <> v_autor;
  select count(*), coalesce(max((n - 1) / 200 + 1), 0) into v_total, v_posts from _todos;
  if v_total = 0 then raise exception 'Ainda não há membros para marcar.'; end if;

  perform set_config('abano.post_sistema', '1', true);   -- publicação automática: não entra no freio de spam
  for v_parte in reverse v_posts .. 1 loop                 -- a parte 1 fica no topo do feed
    select string_agg('@' || usuario, ', ' order by n) into v_lista from _todos where (n - 1) / 200 + 1 = v_parte;
    v_texto := '🐾 Um abraço de boas-vindas a todo mundo que já faz parte da Comunidade Abanô!'
      || case when v_posts > 1 then ' (' || v_parte || ' de ' || v_posts || ')' else '' end || E'\n\n'
      || v_lista || '.' || E'\n\n'
      || 'Obrigado por chegarem cedo e ajudarem a construir este cantinho de quem ama pets: cães, gatos, aves, coelhos, peixes, répteis e todos os bichos de estimação. '
      || 'Por aqui vocês podem apresentar o seu pet com foto, entrar no clube da sua raça ou do seu estado, '
      || 'tirar dúvidas com outros tutores e ajudar na adoção e na busca por pets desaparecidos.' || E'\n\n'
      || 'A partir de agora, toda segunda-feira damos as boas-vindas a quem chegou na semana. '
      || 'Convide os tutores que você conhece para fazer parte também! 💛';
    insert into public.posts (autor, tipo, texto) values (v_autor, 'texto', v_texto) returning id into v_post;
    begin
      insert into public.notificacoes (para, de, tipo, post)
      select id, v_autor, 'boas_vindas', v_post from _todos where (n - 1) / 200 + 1 = v_parte;
    exception when others then
      raise warning 'Abanô: o post saiu, mas os avisos no sininho não (rode antes o editar_boasvindas_ofertas.sql): %', sqlerrm;
    end;
  end loop;
  perform set_config('abano.post_sistema', '0', true);

  -- As boas-vindas de segunda-feira passam a contar só quem chegar depois de agora
  if to_regclass('public.config_comunidade') is not null then
    execute 'update public.config_comunidade set ultima_boas_vindas = now() where id = 1';
  end if;
  raise notice 'Boas-vindas publicadas para % membro(s) em % post(s).', v_total, v_posts;
end $$;

select 'post de boas-vindas' as item,
       case when exists (select 1 from public.posts where texto like '🐾 Um abraço de boas-vindas a todo mundo que já faz parte da Comunidade Abanô!%') then 'publicado' else 'FALTA' end as situacao;
