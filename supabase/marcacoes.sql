-- =========================================================
-- Abanô — marcar pessoas com @ em publicações e comentários.
-- Quem é marcado recebe um aviso no sininho: "marcou você".
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Não publica nada ao rodar.
-- =========================================================

-- Novo tipo de aviso no sininho
alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('curtida', 'comentario', 'resposta', 'curtida_comentario', 'seguidor', 'pedido_adocao', 'pedido_aceito', 'adocao_concluida', 'convite_clube', 'boas_vindas', 'mencao'));

-- Avisa cada @usuario que aparece no texto novo e não estava no texto antigo
-- (assim, editar o texto não repete o aviso). No máximo 10 pessoas por texto.
create or replace function public._avisar_mencoes(p_novo text, p_antigo text, p_de uuid, p_post uuid, p_comentario uuid, p_pular uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_para uuid;
begin
  if p_novo is null or position('@' in p_novo) = 0 then return; end if;
  if coalesce(current_setting('abano.post_sistema', true), '') = '1' then return; end if;   -- posts automáticos já avisam do jeito deles
  for v_para in
    select p.id from (
      select distinct lower(m[2]) as u from regexp_matches(p_novo, '(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,30})', 'g') as m
      except
      select lower(m[2]) from regexp_matches(coalesce(p_antigo, ''), '(^|[^a-zA-Z0-9_@])@([a-zA-Z0-9_]{3,30})', 'g') as m
      limit 10
    ) x join public.perfis p on p.usuario = x.u
    where not p.suspenso and not (p.id = any (coalesce(p_pular, '{}')))
  loop
    perform public._notificar(v_para, p_de, 'mencao', p_post, p_comentario);
  end loop;
exception when others then
  raise warning 'Abanô: aviso de marcação não criado: %', sqlerrm;   -- nunca impede a publicação
end $$;
revoke all on function public._avisar_mencoes(text, text, uuid, uuid, uuid, uuid[]) from public, anon, authenticated;

-- Publicações
create or replace function public._mencoes_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._avisar_mencoes(new.texto, case when tg_op = 'UPDATE' then old.texto end, new.autor, new.id, null, null);
  return null;
end $$;
drop trigger if exists posts_mencoes on public.posts;
create trigger posts_mencoes after insert or update of texto on public.posts
  for each row execute function public._mencoes_post();

-- Comentários e respostas (o dono do post e quem foi respondido já recebem o aviso de comentário)
create or replace function public._mencoes_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pular uuid[];
begin
  if tg_op = 'INSERT' then
    select array_remove(array[(select autor from public.posts where id = new.post),
                              (select autor from public.comentarios where id = new.resposta_a)], null) into v_pular;
  end if;
  perform public._avisar_mencoes(new.texto, case when tg_op = 'UPDATE' then old.texto end, new.autor, new.post, new.id, v_pular);
  return null;
end $$;
drop trigger if exists comentarios_mencoes on public.comentarios;
create trigger comentarios_mencoes after insert or update of texto on public.comentarios
  for each row execute function public._mencoes_comentario();

-- ---------- Conferência: tudo deve mostrar "ok" ----------
select 'marcar em publicações' as item, case when exists (select 1 from pg_trigger where tgname = 'posts_mencoes') then 'ok' else 'FALTA' end as situacao
union all select 'marcar em comentários', case when exists (select 1 from pg_trigger where tgname = 'comentarios_mencoes') then 'ok' else 'FALTA' end;
