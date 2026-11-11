-- =========================================================
-- Abanô — Busca de pessoas na Comunidade (nome ou @usuário,
-- em qualquer estado), sem diferenciar acentos: "joao" acha "João".
-- Só encontra perfis públicos e ativos (quem aceitou a política e
-- não está suspenso). Não mostra e-mail nem nenhum dado privado.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql e moderacao.sql.
-- =========================================================

create or replace function public._sem_acento(p text) returns text
language sql immutable as $$
  select lower(translate(coalesce(p, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'));
$$;

create or replace function public.buscar_pessoas(p_termo text, p_estado text default null)
returns table (id uuid, usuario text, nome text, cidade text, estado text, foto_url text)
language sql stable security definer set search_path = public as $$
  with t as (
    -- tira o "@" do começo e protege os caracteres especiais da busca
    select regexp_replace(public._sem_acento(btrim(ltrim(btrim(coalesce(p_termo, '')), '@'))), '([%_\\])', '\\\1', 'g') as q
  )
  select p.id, p.usuario, p.nome, p.cidade, p.estado, p.foto_url
    from public.perfis p, t
   where char_length(t.q) >= 2
     and public.perfil_ativo(p.id)
     and (p_estado is null or p.estado = p_estado)
     and (p.usuario like '%' || t.q || '%' escape '\' or public._sem_acento(p.nome) like '%' || t.q || '%' escape '\')
   order by (p.usuario = t.q) desc,
            (p.usuario like t.q || '%' escape '\' or public._sem_acento(p.nome) like t.q || '%' escape '\') desc,
            p.nome
   limit 40;
$$;
revoke all on function public.buscar_pessoas(text, text) from public;
grant execute on function public.buscar_pessoas(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
