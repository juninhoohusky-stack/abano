-- =========================================================
-- Abanô — Notificações da Comunidade (o sininho): curtidas,
-- comentários, respostas, curtidas em comentário e novos seguidores.
-- Os avisos são criados sozinhos pelo banco. Ninguém é avisado das
-- próprias ações nem de quem bloqueou. Avisos com mais de 90 dias
-- são apagados todo dia.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- comunidade.sql, moderacao.sql e comentarios_respostas.sql.
-- =========================================================

create table if not exists public.notificacoes (
  id          bigint generated always as identity primary key,
  para        uuid not null references public.perfis (id) on delete cascade,
  de          uuid not null references public.perfis (id) on delete cascade,
  tipo        text not null check (tipo in ('curtida', 'comentario', 'resposta', 'curtida_comentario', 'seguidor')),
  post        uuid references public.posts (id) on delete cascade,
  comentario  uuid references public.comentarios (id) on delete cascade,
  lida        boolean not null default false,
  criado_em   timestamptz not null default now()
);
create index if not exists notificacoes_para on public.notificacoes (para, criado_em desc);
create index if not exists notificacoes_nao_lidas on public.notificacoes (para) where not lida;
alter table public.notificacoes enable row level security;

drop policy if exists "minhas notificacoes" on public.notificacoes;
create policy "minhas notificacoes" on public.notificacoes for select to authenticated using (para = auth.uid());
drop policy if exists "marcar como lida" on public.notificacoes;
create policy "marcar como lida" on public.notificacoes for update to authenticated using (para = auth.uid()) with check (para = auth.uid());
drop policy if exists "apagar notificacao" on public.notificacoes;
create policy "apagar notificacao" on public.notificacoes for delete to authenticated using (para = auth.uid());
revoke all on public.notificacoes from anon, authenticated;
grant select, delete on public.notificacoes to authenticated;
grant update (lida) on public.notificacoes to authenticated;

-- ---------- Criar o aviso (com as regras de quando não avisar) ----------
create or replace function public._notificar(p_para uuid, p_de uuid, p_tipo text, p_post uuid, p_comentario uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_para is null or p_de is null or p_para = p_de then return; end if;
  if exists (select 1 from public.bloqueios where bloqueador = p_para and bloqueado = p_de) then return; end if;
  -- Curtir, descurtir e curtir de novo não repete o aviso no mesmo dia
  if p_tipo in ('curtida', 'curtida_comentario', 'seguidor') and exists (
       select 1 from public.notificacoes
        where para = p_para and de = p_de and tipo = p_tipo
          and post is not distinct from p_post and comentario is not distinct from p_comentario
          and criado_em > now() - interval '1 day') then
    return;
  end if;
  insert into public.notificacoes (para, de, tipo, post, comentario) values (p_para, p_de, p_tipo, p_post, p_comentario);
exception when others then
  raise warning 'Abanô: aviso não criado: %', sqlerrm;   -- nunca impede a curtida ou o comentário
end $$;
revoke all on function public._notificar(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

-- Curtida em publicação
create or replace function public._aviso_curtida() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._notificar((select autor from public.posts where id = new.post), new.usuario, 'curtida', new.post, null);
  else
    delete from public.notificacoes where tipo = 'curtida' and de = old.usuario and post = old.post and not lida;
  end if;
  return null;
end $$;
drop trigger if exists curtidas_avisar on public.curtidas;
create trigger curtidas_avisar after insert or delete on public.curtidas for each row execute function public._aviso_curtida();

-- Comentário e resposta
create or replace function public._aviso_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
declare dono_post uuid; dono_pai uuid;
begin
  select autor into dono_post from public.posts where id = new.post;
  if new.resposta_a is not null then
    select autor into dono_pai from public.comentarios where id = new.resposta_a;
    perform public._notificar(dono_pai, new.autor, 'resposta', new.post, new.id);
  end if;
  -- O dono da publicação também é avisado (uma vez só, se ele mesmo é o dono do comentário respondido)
  if dono_post is distinct from dono_pai then
    perform public._notificar(dono_post, new.autor, 'comentario', new.post, new.id);
  end if;
  return null;
end $$;
drop trigger if exists comentarios_avisar on public.comentarios;
create trigger comentarios_avisar after insert on public.comentarios for each row execute function public._aviso_comentario();

-- Curtida em comentário
create or replace function public._aviso_curtida_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if tg_op = 'INSERT' then
    select autor, post into c from public.comentarios where id = new.comentario;
    perform public._notificar(c.autor, new.usuario, 'curtida_comentario', c.post, new.comentario);
  else
    delete from public.notificacoes where tipo = 'curtida_comentario' and de = old.usuario and comentario = old.comentario and not lida;
  end if;
  return null;
end $$;
drop trigger if exists curtidas_comentarios_avisar on public.curtidas_comentarios;
create trigger curtidas_comentarios_avisar after insert or delete on public.curtidas_comentarios for each row execute function public._aviso_curtida_comentario();

-- Novo seguidor
create or replace function public._aviso_seguidor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._notificar(new.seguido, new.seguidor, 'seguidor', null, null);
  else
    delete from public.notificacoes where tipo = 'seguidor' and de = old.seguidor and para = old.seguido and not lida;
  end if;
  return null;
end $$;
drop trigger if exists seguidores_avisar on public.seguidores;
create trigger seguidores_avisar after insert or delete on public.seguidores for each row execute function public._aviso_seguidor();

-- ---------- Leitura: a lista com o nome e a foto de quem fez, e o trecho do post/comentário ----------
create or replace function public.minhas_notificacoes(p_limite int default 60)
returns table (id bigint, tipo text, lida boolean, criado_em timestamptz, post uuid, comentario uuid,
               de uuid, de_nome text, de_usuario text, de_foto text, trecho_post text, trecho_comentario text)
language sql stable security definer set search_path = public as $$
  select n.id, n.tipo, n.lida, n.criado_em, n.post, n.comentario,
         n.de, pf.nome, pf.usuario, pf.foto_url,
         left(coalesce(nullif(p.texto, ''), case p.tipo when 'foto' then 'sua foto' when 'video' then 'seu vídeo' when 'enquete' then 'sua enquete' else 'sua publicação' end), 90),
         left(c.texto, 90)
    from public.notificacoes n
    join public.perfis pf on pf.id = n.de
    left join public.posts p on p.id = n.post
    left join public.comentarios c on c.id = n.comentario
   where n.para = auth.uid() and public.perfil_ativo(n.de)
   order by n.criado_em desc
   limit least(coalesce(p_limite, 60), 200);
$$;
revoke all on function public.minhas_notificacoes(int) from public, anon;
grant execute on function public.minhas_notificacoes(int) to authenticated;

create or replace function public.notificacoes_nao_lidas() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notificacoes where para = auth.uid() and not lida;
$$;
revoke all on function public.notificacoes_nao_lidas() from public, anon;
grant execute on function public.notificacoes_nao_lidas() to authenticated;

create or replace function public.marcar_notificacoes_lidas() returns void
language sql security definer set search_path = public as $$
  update public.notificacoes set lida = true where para = auth.uid() and not lida;
$$;
revoke all on function public.marcar_notificacoes_lidas() from public, anon;
grant execute on function public.marcar_notificacoes_lidas() to authenticated;

-- ---------- Limpeza diária: avisos com mais de 90 dias ----------
create or replace function public.limpar_notificacoes_antigas() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.notificacoes where criado_em < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.limpar_notificacoes_antigas() from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'abano-limpar-notificacoes';
  perform cron.schedule('abano-limpar-notificacoes', '35 7 * * *', 'select public.limpar_notificacoes_antigas()');
exception when others then
  raise warning 'Abanô: não foi possível agendar a limpeza das notificações (ative pg_cron e rode de novo): %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
