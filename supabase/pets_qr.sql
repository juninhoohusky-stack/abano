-- =========================================================
-- Abanô — Perfil do pet com QR Code: o tutor ativa, escolhe o
-- que mostrar (WhatsApp, recado, cuidados de saúde, cidade) e
-- imprime a plaquinha. Quem escanear vê só o que o tutor liberou.
-- Como usar: copie em texto puro (link "raw" do GitHub, com a
-- tradução do navegador DESLIGADA), cole no SQL Editor e clique
-- em "Run". Pode rodar de novo. Precisa ter rodado antes:
-- contas.sql, moderacao.sql e pets_perdidos.sql.
-- =========================================================

-- Código curto e fácil de digitar (sem 0/O, 1/I/L)
create or replace function public._codigo_qr() returns text
language plpgsql volatile as $$
declare
  letras constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..7 loop
      c := c || substr(letras, 1 + floor(random() * length(letras))::int, 1);
    end loop;
    exit when not exists (select 1 from public.pets_qr where codigo = c);
  end loop;
  return c;
end $$;

create table if not exists public.pets_qr (
  pet            uuid primary key references public.pets (id) on delete cascade,
  dono           uuid not null references public.perfis (id) on delete cascade,
  codigo         text not null unique,
  ativo          boolean not null default true,
  whatsapp       text check (whatsapp is null or whatsapp ~ '^[0-9]{10,13}$'),
  mensagem       text check (char_length(mensagem) <= 300),
  saude          text check (char_length(saude) <= 300),       -- alergias, remédios, condições
  mostrar_cidade boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
alter table public.pets_qr alter column codigo set default public._codigo_qr();
alter table public.pets_qr enable row level security;

-- Só o dono vê e mexe direto na tabela; o público lê pela função perfil_qr
drop policy if exists "dono ve qr" on public.pets_qr;
create policy "dono ve qr" on public.pets_qr for select to authenticated using (dono = auth.uid());
drop policy if exists "dono cria qr" on public.pets_qr;
create policy "dono cria qr" on public.pets_qr for insert to authenticated
  with check (dono = auth.uid() and public.perfil_ativo(auth.uid())
              and exists (select 1 from public.pets p where p.id = pet and p.dono = auth.uid()));
drop policy if exists "dono edita qr" on public.pets_qr;
create policy "dono edita qr" on public.pets_qr for update to authenticated using (dono = auth.uid()) with check (dono = auth.uid());
drop policy if exists "dono apaga qr" on public.pets_qr;
create policy "dono apaga qr" on public.pets_qr for delete to authenticated using (dono = auth.uid());

revoke all on public.pets_qr from anon, authenticated;
grant select on public.pets_qr to authenticated;
grant insert (pet, dono, ativo, whatsapp, mensagem, saude, mostrar_cidade) on public.pets_qr to authenticated;
grant update (ativo, whatsapp, mensagem, saude, mostrar_cidade) on public.pets_qr to authenticated;
grant delete on public.pets_qr to authenticated;

create or replace function public._validar_qr() returns trigger
language plpgsql set search_path = public as $$
begin
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9]', '', 'g'), '');
  new.mensagem := nullif(btrim(new.mensagem), '');
  new.saude := nullif(btrim(new.saude), '');
  new.atualizado_em := now();
  if tg_op = 'INSERT' then new.criado_em := now(); end if;
  return new;
end $$;
drop trigger if exists pets_qr_validar on public.pets_qr;
create trigger pets_qr_validar before insert or update on public.pets_qr
  for each row execute function public._validar_qr();

-- O que aparece para quem escaneia (nada de e-mail; WhatsApp só se o tutor colocou)
create or replace function public.perfil_qr(p_codigo text)
returns table (ativo boolean, nome text, especie text, raca text, idade text, sexo text, personalidade text, foto_url text,
               whatsapp text, mensagem text, saude text, tutor_nome text, tutor_usuario text, cidade text, estado text,
               alerta uuid)
language sql stable security definer set search_path = public as $$
  select q.ativo, p.nome, p.especie, p.raca, p.idade, p.sexo, p.personalidade, p.foto_url,
         case when q.ativo then q.whatsapp end,
         case when q.ativo then q.mensagem end,
         case when q.ativo then q.saude end,
         split_part(pf.nome, ' ', 1), pf.usuario,
         case when q.ativo and q.mostrar_cidade then pf.cidade end,
         case when q.ativo and q.mostrar_cidade then pf.estado end,
         (select a.id from public.alertas_pets a
           where a.pet = p.id and a.tipo = 'perdido' and a.status = 'ativo'
           order by a.criado_em desc limit 1)
    from public.pets_qr q
    join public.pets p on p.id = q.pet
    join public.perfis pf on pf.id = q.dono
   where q.codigo = upper(btrim(p_codigo)) and public.perfil_ativo(q.dono);
$$;
revoke all on function public.perfil_qr(text) from public;
grant execute on function public.perfil_qr(text) to anon, authenticated;

notify pgrst, 'reload schema';
