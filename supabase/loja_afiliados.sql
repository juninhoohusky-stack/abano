-- Abanô: Loja pet (produtos de afiliado da Shopee e do Mercado Livre, publicados pelo robô)
-- Rode uma vez no SQL Editor do Supabase, depois do editar_boasvindas_ofertas.sql.
-- Pode rodar de novo sem problema.

-- 1. A tabela de ofertas passa a aceitar todos os pets e todos os nichos da loja
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.ofertas'::regclass and c.contype = 'c'
      and (pg_get_constraintdef(c.oid) ilike '%pet = ANY%' or pg_get_constraintdef(c.oid) ilike '%categoria = ANY%')
  loop
    execute format('alter table public.ofertas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.ofertas add constraint ofertas_pet_check
  check (pet in ('cao', 'gato', 'ambos', 'aves', 'roedores', 'peixes', 'repteis', 'todos'));
alter table public.ofertas add constraint ofertas_categoria_check
  check (categoria in ('racao', 'petiscos', 'alimentacao', 'brinquedos', 'higiene', 'escovacao', 'saude', 'acessorios', 'camas',
                       'potes', 'passeio', 'arranhadores', 'gaiolas', 'aquario', 'terrario', 'casa', 'outros'));

-- 2. Dados que o robô traz das lojas
alter table public.ofertas add column if not exists produto   text;            -- item do catálogo (dados/loja-catalogo.json)
alter table public.ofertas add column if not exists avaliacao numeric(2,1) check (avaliacao is null or avaliacao between 0 and 5);
alter table public.ofertas add column if not exists vendas    integer check (vendas is null or vendas >= 0);

create index if not exists ofertas_loja_nicho on public.ofertas (categoria, pet) where ativo;

-- Conferência: tudo deve mostrar "ok"
select 'nichos da loja' as item,
       case when exists (select 1 from pg_constraint where conname = 'ofertas_categoria_check' and pg_get_constraintdef(oid) ilike '%arranhadores%') then 'ok' else 'FALTA' end as situacao
union all select 'pets da loja',
       case when exists (select 1 from pg_constraint where conname = 'ofertas_pet_check' and pg_get_constraintdef(oid) ilike '%repteis%') then 'ok' else 'FALTA' end
union all select 'colunas do robô',
       case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'ofertas'
                  and column_name in ('produto', 'avaliacao', 'vendas')) = 3 then 'ok' else 'FALTA' end;
