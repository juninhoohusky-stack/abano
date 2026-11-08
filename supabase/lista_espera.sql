-- =========================================================
-- Abanô — tabela da lista de espera
-- Como usar: no painel do Supabase, abra "SQL Editor",
-- cole este arquivo inteiro e clique em "Run".
-- =========================================================

create table if not exists public.lista_espera (
  id         bigint generated always as identity primary key,
  criado_em  timestamptz not null default now(),
  nome       text not null check (char_length(nome) between 1 and 120),
  email      text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nome_pet   text check (char_length(nome_pet) <= 80),
  cidade     text not null check (char_length(cidade) between 1 and 120),
  pet        text not null check (char_length(pet) between 1 and 60),
  interesse  text check (char_length(interesse) <= 80)
);

-- Um cadastro por e-mail
create unique index if not exists lista_espera_email_unico
  on public.lista_espera (lower(email));

-- Segurança: visitantes do site só podem SE CADASTRAR.
-- Ninguém de fora consegue ler, alterar ou apagar a lista.
-- Você vê os cadastros pelo "Table Editor" do painel.
alter table public.lista_espera enable row level security;

drop policy if exists "visitantes podem se cadastrar" on public.lista_espera;
create policy "visitantes podem se cadastrar"
  on public.lista_espera
  for insert
  to anon
  with check (true);

revoke all on public.lista_espera from anon;
grant insert on public.lista_espera to anon;
