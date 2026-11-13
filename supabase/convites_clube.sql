-- =========================================================
-- Abanô — Convidar para o clube: quem participa de um clube pode
-- convidar quem segue (ou quem segue você). O convite chega no
-- sininho. Sem convites repetidos e com limite diário contra spam.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- destaques_adocao_pessoas.sql (e os anteriores).
-- =========================================================

alter table public.notificacoes add column if not exists clube text references public.clubes (id) on delete cascade;
do $$
declare r record;
begin
  for r in select con.conname from pg_constraint con
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
           where con.conrelid = 'public.notificacoes'::regclass and con.contype = 'c' and att.attname = 'tipo'
  loop execute format('alter table public.notificacoes drop constraint %I', r.conname); end loop;
end $$;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('curtida', 'comentario', 'resposta', 'curtida_comentario', 'seguidor', 'pedido_adocao', 'pedido_aceito', 'adocao_concluida', 'convite_clube'));

create or replace function public.convidar_para_clube(p_clube text, p_para uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := auth.uid();
begin
  if v_eu is null or not public.perfil_ativo(v_eu) then raise exception 'Entre na sua conta para convidar.' using errcode = '42501'; end if;
  if not exists (select 1 from public.clubes where id = p_clube) then raise exception 'Clube não encontrado.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.clube_membros where clube = p_clube and usuario = v_eu) then
    raise exception 'Participe do clube para convidar outras pessoas.' using errcode = 'P0001';
  end if;
  if p_para is null or p_para = v_eu or not public.perfil_ativo(p_para) then raise exception 'Perfil não encontrado.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.seguidores where (seguidor = v_eu and seguido = p_para) or (seguidor = p_para and seguido = v_eu)) then
    raise exception 'Você só pode convidar quem você segue ou quem segue você.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bloqueios where (bloqueador = v_eu and bloqueado = p_para) or (bloqueador = p_para and bloqueado = v_eu)) then
    raise exception 'Não é possível convidar este perfil.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clube_membros where clube = p_clube and usuario = p_para) then
    raise exception 'Essa pessoa já participa do clube.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.notificacoes where tipo = 'convite_clube' and de = v_eu and para = p_para and clube = p_clube and criado_em > now() - interval '30 days') then
    raise exception 'Você já convidou essa pessoa para este clube.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.notificacoes where tipo = 'convite_clube' and de = v_eu and criado_em > now() - interval '1 day') >= 40 then
    raise exception 'Você atingiu o limite de convites de hoje. Tente amanhã.' using errcode = 'P0001';
  end if;
  insert into public.notificacoes (para, de, tipo, clube) values (p_para, v_eu, 'convite_clube', p_clube);
end $$;
revoke all on function public.convidar_para_clube(text, uuid) from public, anon;
grant execute on function public.convidar_para_clube(text, uuid) to authenticated;

-- Quem eu já convidei para um clube (para a lista mostrar "Convidado")
create or replace function public.meus_convites_clube(p_clube text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select para from public.notificacoes
   where tipo = 'convite_clube' and de = auth.uid() and clube = p_clube and criado_em > now() - interval '30 days';
$$;
revoke all on function public.meus_convites_clube(text) from public, anon;
grant execute on function public.meus_convites_clube(text) to authenticated;

drop function if exists public.minhas_notificacoes(int);
create function public.minhas_notificacoes(p_limite int default 60)
returns table (id bigint, tipo text, lida boolean, criado_em timestamptz, post uuid, comentario uuid,
               de uuid, de_nome text, de_usuario text, de_foto text, trecho_post text, trecho_comentario text,
               pedido uuid, pet_nome text, org_nome text, clube text, clube_nome text)
language sql stable security definer set search_path = public as $$
  select n.id, n.tipo, n.lida, n.criado_em, n.post, n.comentario,
         n.de, pf.nome, pf.usuario, pf.foto_url,
         left(coalesce(nullif(p.texto, ''), case p.tipo when 'foto' then 'sua foto' when 'video' then 'seu vídeo' when 'enquete' then 'sua enquete' else 'sua publicação' end), 90),
         left(c.texto, 90),
         n.pedido, n.pet_nome,
         (select o.nome from public.organizacoes o where o.dono = n.de),
         n.clube, cl.nome
    from public.notificacoes n
    join public.perfis pf on pf.id = n.de
    left join public.posts p on p.id = n.post
    left join public.comentarios c on c.id = n.comentario
    left join public.clubes cl on cl.id = n.clube
   where n.para = auth.uid() and public.perfil_ativo(n.de)
   order by n.criado_em desc
   limit least(coalesce(p_limite, 60), 200);
$$;
revoke all on function public.minhas_notificacoes(int) from public, anon;
grant execute on function public.minhas_notificacoes(int) to authenticated;

notify pgrst, 'reload schema';

-- Conferência: deve mostrar "ok"
select case when exists (select 1 from pg_proc where proname = 'convidar_para_clube') then 'ok' else 'FALTA' end as convites_clube;
