-- Delivery: banco completo, políticas RLS e criação transacional de pedidos.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- O script é repetível: pode ser executado novamente após futuras atualizações.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- =========================================================
-- TABELAS PRINCIPAIS
-- Os relacionamentos do catálogo usam IDs em texto para serem
-- compatíveis tanto com projetos antigos (bigint) quanto UUID.
-- =========================================================

create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  sobrenome text not null default '',
  telefone text not null default '',
  cpf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.usuarios add column if not exists nome text not null default '';
alter table public.usuarios add column if not exists sobrenome text not null default '';
alter table public.usuarios add column if not exists telefone text not null default '';
alter table public.usuarios add column if not exists cpf text;
alter table public.usuarios add column if not exists created_at timestamptz not null default now();
alter table public.usuarios add column if not exists updated_at timestamptz not null default now();

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  telefone text,
  cnpj text,
  descricao text,
  categoria text,
  tipo text,
  logo text,
  banner text,
  taxa_entrega numeric(12,2) not null default 0 check (taxa_entrega >= 0),
  pedido_minimo numeric(12,2) not null default 0 check (pedido_minimo >= 0),
  status boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresas add column if not exists usuario_id uuid references auth.users(id) on delete cascade;
alter table public.empresas add column if not exists nome text;
alter table public.empresas add column if not exists email text;
alter table public.empresas add column if not exists telefone text;
alter table public.empresas add column if not exists cnpj text;
alter table public.empresas add column if not exists descricao text;
alter table public.empresas add column if not exists categoria text;
alter table public.empresas add column if not exists tipo text;
alter table public.empresas add column if not exists logo text;
alter table public.empresas add column if not exists banner text;
alter table public.empresas add column if not exists taxa_entrega numeric(12,2) not null default 0;
alter table public.empresas add column if not exists pedido_minimo numeric(12,2) not null default 0;
alter table public.empresas add column if not exists status boolean not null default true;
alter table public.empresas add column if not exists created_at timestamptz not null default now();
alter table public.empresas add column if not exists updated_at timestamptz not null default now();

-- Apenas estes campos são expostos no catálogo público. Dados administrativos
-- como usuario_id, e-mail e CNPJ continuam protegidos na tabela empresas.
create or replace view public.empresas_catalogo
with (security_barrier = true)
as
select
  id::text as id,
  nome,
  descricao,
  categoria,
  tipo,
  logo,
  banner,
  taxa_entrega,
  pedido_minimo,
  status
from public.empresas;

revoke all on public.empresas_catalogo from public, anon, authenticated;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categorias add column if not exists empresa_id text;
alter table public.categorias add column if not exists nome text;
alter table public.categorias add column if not exists ordem integer not null default 0;
alter table public.categorias add column if not exists ativo boolean not null default true;
alter table public.categorias add column if not exists created_at timestamptz not null default now();
alter table public.categorias add column if not exists updated_at timestamptz not null default now();

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id text not null,
  categoria_id text,
  nome text not null,
  descricao text,
  imagem text,
  preco numeric(12,2) not null default 0 check (preco >= 0),
  promocao numeric(12,2) check (promocao is null or promocao >= 0),
  disponivel boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.produtos add column if not exists empresa_id text;
alter table public.produtos add column if not exists categoria_id text;
alter table public.produtos add column if not exists nome text;
alter table public.produtos add column if not exists descricao text;
alter table public.produtos add column if not exists imagem text;
alter table public.produtos add column if not exists preco numeric(12,2) not null default 0;
alter table public.produtos add column if not exists promocao numeric(12,2);
alter table public.produtos add column if not exists disponivel boolean not null default true;
alter table public.produtos add column if not exists created_at timestamptz not null default now();
alter table public.produtos add column if not exists updated_at timestamptz not null default now();

create table if not exists public.grupos_adicionais (
  id uuid primary key default gen_random_uuid(),
  empresa_id text,
  nome text not null,
  minimo integer not null default 0 check (minimo >= 0),
  maximo integer not null default 1 check (maximo >= 1),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grupos_adicionais add column if not exists empresa_id text;
alter table public.grupos_adicionais add column if not exists nome text;
alter table public.grupos_adicionais add column if not exists minimo integer not null default 0;
alter table public.grupos_adicionais add column if not exists maximo integer not null default 1;
alter table public.grupos_adicionais add column if not exists ativo boolean not null default true;
alter table public.grupos_adicionais add column if not exists created_at timestamptz not null default now();
alter table public.grupos_adicionais add column if not exists updated_at timestamptz not null default now();

create table if not exists public.adicionais (
  id uuid primary key default gen_random_uuid(),
  grupo_id text not null,
  nome text not null,
  preco numeric(12,2) not null default 0 check (preco >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.adicionais add column if not exists grupo_id text;
alter table public.adicionais add column if not exists nome text;
alter table public.adicionais add column if not exists preco numeric(12,2) not null default 0;
alter table public.adicionais add column if not exists ativo boolean not null default true;
alter table public.adicionais add column if not exists created_at timestamptz not null default now();
alter table public.adicionais add column if not exists updated_at timestamptz not null default now();

create table if not exists public.produto_grupos (
  produto_id text not null,
  grupo_id text not null,
  created_at timestamptz not null default now(),
  primary key (produto_id, grupo_id)
);

alter table public.produto_grupos add column if not exists produto_id text;
alter table public.produto_grupos add column if not exists grupo_id text;
alter table public.produto_grupos add column if not exists created_at timestamptz not null default now();

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated by default as identity unique,
  usuario_id uuid not null references auth.users(id) on delete restrict,
  empresa_id text not null,
  empresa_nome text not null default 'Restaurante',
  endereco text not null,
  pagamento text not null check (pagamento in ('PIX','Cartão','Dinheiro')),
  observacoes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  taxa_entrega numeric(12,2) not null default 0 check (taxa_entrega >= 0),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  cupom text,
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'recebido'
    check (status in ('recebido','preparando','saiu_para_entrega','entregue','cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  produto_id text,
  nome_produto text not null,
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  quantidade integer not null check (quantidade > 0 and quantidade <= 99),
  observacao text,
  adicionais jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Colunas abaixo permitem atualizar instalações que já possuíam versões
-- incompletas das tabelas de pedidos.
alter table public.pedidos add column if not exists numero bigint generated by default as identity;
alter table public.pedidos add column if not exists usuario_id uuid references auth.users(id) on delete restrict;
alter table public.pedidos add column if not exists empresa_id text;
alter table public.pedidos add column if not exists empresa_nome text not null default 'Restaurante';
alter table public.pedidos add column if not exists endereco text;
alter table public.pedidos add column if not exists pagamento text;
alter table public.pedidos add column if not exists observacoes text;
alter table public.pedidos add column if not exists subtotal numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists taxa_entrega numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists desconto numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists cupom text;
alter table public.pedidos add column if not exists total numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists status text not null default 'recebido';
alter table public.pedidos add column if not exists created_at timestamptz not null default now();
alter table public.pedidos add column if not exists updated_at timestamptz not null default now();

alter table public.pedido_itens add column if not exists produto_id text;
alter table public.pedido_itens add column if not exists nome_produto text;
alter table public.pedido_itens add column if not exists preco_unitario numeric(12,2) not null default 0;
alter table public.pedido_itens add column if not exists quantidade integer not null default 1;
alter table public.pedido_itens add column if not exists observacao text;
alter table public.pedido_itens add column if not exists adicionais jsonb not null default '[]'::jsonb;
alter table public.pedido_itens add column if not exists created_at timestamptz not null default now();

-- Restrições NOT VALID não bloqueiam a migração por dados históricos, mas
-- já protegem todas as novas inserções e atualizações.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delivery_empresas_valores_check') then
    alter table public.empresas add constraint delivery_empresas_valores_check
      check (coalesce(taxa_entrega, 0) >= 0 and coalesce(pedido_minimo, 0) >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_produtos_valores_check') then
    alter table public.produtos add constraint delivery_produtos_valores_check
      check (coalesce(preco, 0) >= 0 and (promocao is null or (promocao > 0 and promocao < preco))) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_grupos_limites_check') then
    alter table public.grupos_adicionais add constraint delivery_grupos_limites_check
      check (coalesce(minimo, 0) >= 0 and coalesce(maximo, 1) >= greatest(coalesce(minimo, 0), 1)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_adicionais_preco_check') then
    alter table public.adicionais add constraint delivery_adicionais_preco_check
      check (coalesce(preco, 0) >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_pedidos_valores_check') then
    alter table public.pedidos add constraint delivery_pedidos_valores_check
      check (coalesce(subtotal, 0) >= 0 and coalesce(taxa_entrega, 0) >= 0 and coalesce(desconto, 0) >= 0 and coalesce(total, 0) >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_pedidos_pagamento_check') then
    alter table public.pedidos add constraint delivery_pedidos_pagamento_check
      check (pagamento in ('PIX','Cartão','Dinheiro')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_pedidos_status_check') then
    alter table public.pedidos add constraint delivery_pedidos_status_check
      check (status in ('recebido','preparando','saiu_para_entrega','entregue','cancelado')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'delivery_itens_valores_check') then
    alter table public.pedido_itens add constraint delivery_itens_valores_check
      check (coalesce(preco_unitario, 0) >= 0 and quantidade between 1 and 99) not valid;
  end if;
end $$;

-- =========================================================
-- ÍNDICES
-- =========================================================

create unique index if not exists usuarios_cpf_unique
  on public.usuarios (cpf) where cpf is not null and cpf <> '';
drop index if exists public.empresas_usuario_id_unique;
create unique index empresas_usuario_id_unique
  on public.empresas(usuario_id);
create unique index if not exists empresas_cnpj_unique
  on public.empresas(cnpj) where cnpj is not null and cnpj <> '';
create unique index if not exists categorias_empresa_nome_unique
  on public.categorias(empresa_id, lower(nome)) where nome is not null;
create index if not exists categorias_empresa_id_idx on public.categorias(empresa_id);
create index if not exists produtos_empresa_id_idx on public.produtos(empresa_id);
create index if not exists produtos_categoria_id_idx on public.produtos(categoria_id);
create index if not exists grupos_empresa_id_idx on public.grupos_adicionais(empresa_id);
create index if not exists adicionais_grupo_id_idx on public.adicionais(grupo_id);
create index if not exists produto_grupos_produto_id_idx on public.produto_grupos(produto_id);
create index if not exists produto_grupos_grupo_id_idx on public.produto_grupos(grupo_id);
create index if not exists pedidos_usuario_id_idx on public.pedidos(usuario_id);
create index if not exists pedidos_empresa_id_idx on public.pedidos(empresa_id);
create index if not exists pedidos_created_at_idx on public.pedidos(created_at desc);
create index if not exists pedido_itens_pedido_id_idx on public.pedido_itens(pedido_id);

-- =========================================================
-- DATAS DE ATUALIZAÇÃO
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare
  tabela text;
begin
  foreach tabela in array array['usuarios','empresas','categorias','produtos','grupos_adicionais','adicionais','pedidos']
  loop
    execute format('drop trigger if exists %I on public.%I', tabela || '_set_updated_at', tabela);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      tabela || '_set_updated_at', tabela
    );
  end loop;
end $$;

-- =========================================================
-- CRIAÇÃO AUTOMÁTICA DE PERFIL/RESTAURANTE
-- =========================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, nome, sobrenome, telefone, cpf)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    coalesce(new.raw_user_meta_data ->> 'sobrenome', ''),
    coalesce(new.raw_user_meta_data ->> 'telefone', ''),
    nullif(new.raw_user_meta_data ->> 'cpf', '')
  )
  on conflict (id) do update set
    nome = excluded.nome,
    sobrenome = excluded.sobrenome,
    telefone = excluded.telefone,
    cpf = coalesce(excluded.cpf, public.usuarios.cpf);

  if new.raw_user_meta_data ->> 'tipo_conta' = 'restaurante' then
    insert into public.empresas (
      usuario_id, nome, email, telefone, cnpj, status, taxa_entrega, pedido_minimo
    ) values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), 'Restaurante'),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'telefone', ''),
      nullif(new.raw_user_meta_data ->> 'cnpj', ''),
      true,
      0,
      0
    )
    on conflict (usuario_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_delivery on auth.users;
create trigger on_auth_user_created_delivery
after insert on auth.users
for each row execute function private.handle_new_user();

-- =========================================================
-- GRANTS E RLS
-- =========================================================

grant usage on schema public to anon, authenticated;
revoke select on public.empresas from anon, authenticated;
grant select on public.empresas_catalogo to anon, authenticated;
grant select on public.categorias, public.produtos, public.produto_grupos,
  public.grupos_adicionais, public.adicionais to anon, authenticated;
grant select on public.empresas to authenticated;
grant select, insert, update on public.usuarios to authenticated;
grant insert, update, delete on public.empresas, public.categorias, public.produtos,
  public.produto_grupos, public.grupos_adicionais, public.adicionais to authenticated;
grant select on public.pedidos, public.pedido_itens to authenticated;
grant update(status) on public.pedidos to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.empresas enable row level security;
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_grupos enable row level security;
alter table public.grupos_adicionais enable row level security;
alter table public.adicionais enable row level security;
alter table public.usuarios enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

-- Catálogo público. A tabela empresas fica restrita ao proprietário;
-- visitantes consultam somente a view empresas_catalogo.
drop policy if exists "catalogo empresas publico" on public.empresas;
drop policy if exists "proprietario le empresa" on public.empresas;
create policy "proprietario le empresa" on public.empresas for select to authenticated
using ((select auth.uid()) = usuario_id);
drop policy if exists "catalogo categorias publico" on public.categorias;
create policy "catalogo categorias publico" on public.categorias for select to anon, authenticated using (ativo = true);
drop policy if exists "proprietario le categorias" on public.categorias;
create policy "proprietario le categorias" on public.categorias for select to authenticated
using (exists (select 1 from public.empresas e where e.id::text = categorias.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "catalogo produtos publico" on public.produtos;
create policy "catalogo produtos publico" on public.produtos for select to anon, authenticated using (disponivel = true);
drop policy if exists "proprietario le produtos" on public.produtos;
create policy "proprietario le produtos" on public.produtos for select to authenticated
using (exists (select 1 from public.empresas e where e.id::text = produtos.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "catalogo produto grupos publico" on public.produto_grupos;
create policy "catalogo produto grupos publico" on public.produto_grupos for select to anon, authenticated using (true);
drop policy if exists "catalogo grupos adicionais publico" on public.grupos_adicionais;
create policy "catalogo grupos adicionais publico" on public.grupos_adicionais for select to anon, authenticated using (ativo = true);
drop policy if exists "proprietario le grupos" on public.grupos_adicionais;
create policy "proprietario le grupos" on public.grupos_adicionais for select to authenticated
using (exists (select 1 from public.empresas e where e.id::text = grupos_adicionais.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "catalogo adicionais publico" on public.adicionais;
create policy "catalogo adicionais publico" on public.adicionais for select to anon, authenticated using (ativo = true);
drop policy if exists "proprietario le adicionais" on public.adicionais;
create policy "proprietario le adicionais" on public.adicionais for select to authenticated
using (exists (
  select 1 from public.grupos_adicionais g join public.empresas e on e.id::text = g.empresa_id::text
  where g.id::text = adicionais.grupo_id::text and e.usuario_id = (select auth.uid())
));

-- Perfil do cliente.
drop policy if exists "usuario le proprio perfil" on public.usuarios;
create policy "usuario le proprio perfil" on public.usuarios for select to authenticated
using ((select auth.uid()) = id);
drop policy if exists "usuario cria proprio perfil" on public.usuarios;
create policy "usuario cria proprio perfil" on public.usuarios for insert to authenticated
with check ((select auth.uid()) = id);
drop policy if exists "usuario atualiza proprio perfil" on public.usuarios;
create policy "usuario atualiza proprio perfil" on public.usuarios for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Restaurante: somente o proprietário administra sua empresa.
drop policy if exists "proprietario cria empresa" on public.empresas;
create policy "proprietario cria empresa" on public.empresas for insert to authenticated
with check ((select auth.uid()) = usuario_id);
drop policy if exists "proprietario atualiza empresa" on public.empresas;
create policy "proprietario atualiza empresa" on public.empresas for update to authenticated
using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
drop policy if exists "proprietario remove empresa" on public.empresas;
create policy "proprietario remove empresa" on public.empresas for delete to authenticated
using ((select auth.uid()) = usuario_id);

-- Categorias do próprio restaurante.
drop policy if exists "proprietario cria categoria" on public.categorias;
create policy "proprietario cria categoria" on public.categorias for insert to authenticated
with check (exists (select 1 from public.empresas e where e.id::text = categorias.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "proprietario atualiza categoria" on public.categorias;
create policy "proprietario atualiza categoria" on public.categorias for update to authenticated
using (exists (select 1 from public.empresas e where e.id::text = categorias.empresa_id::text and e.usuario_id = (select auth.uid())))
with check (exists (select 1 from public.empresas e where e.id::text = categorias.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "proprietario remove categoria" on public.categorias;
create policy "proprietario remove categoria" on public.categorias for delete to authenticated
using (exists (select 1 from public.empresas e where e.id::text = categorias.empresa_id::text and e.usuario_id = (select auth.uid())));

-- Produtos do próprio restaurante.
drop policy if exists "proprietario cria produto" on public.produtos;
create policy "proprietario cria produto" on public.produtos for insert to authenticated
with check (exists (select 1 from public.empresas e where e.id::text = produtos.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "proprietario atualiza produto" on public.produtos;
create policy "proprietario atualiza produto" on public.produtos for update to authenticated
using (exists (select 1 from public.empresas e where e.id::text = produtos.empresa_id::text and e.usuario_id = (select auth.uid())))
with check (exists (select 1 from public.empresas e where e.id::text = produtos.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "proprietario remove produto" on public.produtos;
create policy "proprietario remove produto" on public.produtos for delete to authenticated
using (exists (select 1 from public.empresas e where e.id::text = produtos.empresa_id::text and e.usuario_id = (select auth.uid())));

-- Grupos e adicionais do próprio restaurante.
drop policy if exists "proprietario gerencia grupos" on public.grupos_adicionais;
create policy "proprietario gerencia grupos" on public.grupos_adicionais for all to authenticated
using (exists (select 1 from public.empresas e where e.id::text = grupos_adicionais.empresa_id::text and e.usuario_id = (select auth.uid())))
with check (exists (select 1 from public.empresas e where e.id::text = grupos_adicionais.empresa_id::text and e.usuario_id = (select auth.uid())));
drop policy if exists "proprietario gerencia adicionais" on public.adicionais;
create policy "proprietario gerencia adicionais" on public.adicionais for all to authenticated
using (exists (
  select 1 from public.grupos_adicionais g join public.empresas e on e.id::text = g.empresa_id::text
  where g.id::text = adicionais.grupo_id::text and e.usuario_id = (select auth.uid())
))
with check (exists (
  select 1 from public.grupos_adicionais g join public.empresas e on e.id::text = g.empresa_id::text
  where g.id::text = adicionais.grupo_id::text and e.usuario_id = (select auth.uid())
));
drop policy if exists "proprietario gerencia produto grupos" on public.produto_grupos;
create policy "proprietario gerencia produto grupos" on public.produto_grupos for all to authenticated
using (exists (
  select 1 from public.produtos p join public.empresas e on e.id::text = p.empresa_id
  where p.id::text = produto_grupos.produto_id::text and e.usuario_id = (select auth.uid())
))
with check (exists (
  select 1 from public.produtos p join public.empresas e on e.id::text = p.empresa_id
  where p.id::text = produto_grupos.produto_id::text and e.usuario_id = (select auth.uid())
));

-- Pedidos: cliente lê os próprios; restaurante lê e atualiza somente os recebidos.
drop policy if exists "cliente le pedidos" on public.pedidos;
create policy "cliente le pedidos" on public.pedidos for select to authenticated
using (
  (select auth.uid()) = usuario_id
  or exists (
    select 1 from public.empresas e
    where e.id::text = pedidos.empresa_id and e.usuario_id = (select auth.uid())
  )
);
drop policy if exists "restaurante atualiza pedidos" on public.pedidos;
create policy "restaurante atualiza pedidos" on public.pedidos for update to authenticated
using (exists (
  select 1 from public.empresas e
  where e.id::text = pedidos.empresa_id and e.usuario_id = (select auth.uid())
))
with check (exists (
  select 1 from public.empresas e
  where e.id::text = pedidos.empresa_id and e.usuario_id = (select auth.uid())
));

drop policy if exists "participantes leem itens" on public.pedido_itens;
create policy "participantes leem itens" on public.pedido_itens for select to authenticated
using (exists (
  select 1 from public.pedidos p
  where p.id = pedido_itens.pedido_id
    and (
      p.usuario_id = (select auth.uid())
      or exists (
        select 1 from public.empresas e
        where e.id::text = p.empresa_id and e.usuario_id = (select auth.uid())
      )
    )
));

-- =========================================================
-- PEDIDO TRANSACIONAL E VALIDADO NO BANCO
-- =========================================================

create or replace function private.criar_pedido_impl(
  p_empresa_id text,
  p_endereco text,
  p_pagamento text,
  p_observacoes text default null,
  p_cupom text default null,
  p_itens jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := (select auth.uid());
  v_empresa record;
  v_item jsonb;
  v_produto record;
  v_grupo record;
  v_quantidade integer;
  v_adicionais jsonb;
  v_adicionais_normalizados jsonb;
  v_adicionais_total numeric(12,2);
  v_solicitados integer;
  v_validos integer;
  v_selecionados integer;
  v_subtotal numeric(12,2) := 0;
  v_taxa numeric(12,2) := 0;
  v_desconto numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_pedido public.pedidos%rowtype;
begin
  if v_usuario_id is null then
    raise exception 'Faça login para finalizar o pedido.';
  end if;

  if nullif(trim(p_endereco), '') is null or length(trim(p_endereco)) < 8 then
    raise exception 'Informe um endereço de entrega completo.';
  end if;

  if p_pagamento is null or p_pagamento not in ('PIX', 'Cartão', 'Dinheiro') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido não possui itens.';
  end if;

  select e.id::text as id, e.nome, e.taxa_entrega, e.pedido_minimo
    into v_empresa
  from public.empresas e
  where e.id::text = p_empresa_id and e.status = true
  limit 1;

  if not found then
    raise exception 'O restaurante está fechado ou não foi encontrado.';
  end if;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    if coalesce(v_item ->> 'quantidade', '') !~ '^[0-9]+$' then
      raise exception 'Quantidade de produto inválida.';
    end if;
    v_quantidade := (v_item ->> 'quantidade')::integer;
    if v_quantidade < 1 or v_quantidade > 99 then
      raise exception 'Quantidade de produto inválida.';
    end if;

    select p.id::text as id,
           p.nome,
           case when coalesce(p.promocao, 0) > 0 then p.promocao else p.preco end as preco
      into v_produto
    from public.produtos p
    where p.id::text = v_item ->> 'produto_id'
      and p.empresa_id::text = p_empresa_id
      and p.disponivel = true
    limit 1;

    if not found then
      raise exception 'Um produto do carrinho não está mais disponível.';
    end if;

    v_adicionais := coalesce(v_item -> 'adicionais', '[]'::jsonb);
    if jsonb_typeof(v_adicionais) <> 'array' then
      raise exception 'Adicionais inválidos.';
    end if;

    for v_grupo in
      select g.id::text as id,
             g.nome,
             coalesce(g.minimo, 0) as minimo,
             greatest(coalesce(g.maximo, 1), 1) as maximo
      from public.produto_grupos pg
      join public.grupos_adicionais g on g.id::text = pg.grupo_id::text
      where pg.produto_id::text = v_produto.id and g.ativo = true
    loop
      select count(distinct a.id)
        into v_selecionados
      from public.adicionais a
      where a.grupo_id::text = v_grupo.id
        and a.ativo = true
        and a.id::text in (
          select adicional ->> 'id'
          from jsonb_array_elements(v_adicionais) adicional
        );

      if v_selecionados < v_grupo.minimo then
        raise exception 'Selecione pelo menos % opção(ões) em %.', v_grupo.minimo, v_grupo.nome;
      end if;
      if v_selecionados > v_grupo.maximo then
        raise exception 'Selecione no máximo % opção(ões) em %.', v_grupo.maximo, v_grupo.nome;
      end if;
    end loop;

    select count(distinct (adicional ->> 'id'))
      into v_solicitados
    from jsonb_array_elements(v_adicionais) adicional
    where nullif(adicional ->> 'id', '') is not null;

    select count(distinct a.id), coalesce(sum(a.preco), 0)
      into v_validos, v_adicionais_total
    from public.adicionais a
    where a.ativo = true
      and a.id::text in (
        select adicional ->> 'id'
        from jsonb_array_elements(v_adicionais) adicional
      )
      and exists (
        select 1 from public.produto_grupos pg
        where pg.produto_id::text = v_produto.id and pg.grupo_id::text = a.grupo_id::text
      );

    if v_solicitados <> v_validos then
      raise exception 'Um adicional selecionado não pertence ao produto.';
    end if;

    v_subtotal := v_subtotal + ((v_produto.preco + v_adicionais_total) * v_quantidade);
  end loop;

  if v_subtotal < coalesce(v_empresa.pedido_minimo, 0) then
    raise exception 'O pedido mínimo deste restaurante é R$ %.',
      to_char(coalesce(v_empresa.pedido_minimo, 0), 'FM999999990D00');
  end if;

  v_taxa := coalesce(v_empresa.taxa_entrega, 0);
  case upper(trim(coalesce(p_cupom, '')))
    when 'BEMVINDO20' then v_desconto := round(v_subtotal * 0.20, 2);
    when 'DELIVERY10' then v_desconto := least(10, v_subtotal);
    when 'FRETEGRATIS' then v_desconto := v_taxa;
    else v_desconto := 0;
  end case;
  v_total := greatest(0, v_subtotal + v_taxa - v_desconto);

  insert into public.pedidos (
    usuario_id, empresa_id, empresa_nome, endereco, pagamento, observacoes,
    subtotal, taxa_entrega, desconto, cupom, total, status
  ) values (
    v_usuario_id, v_empresa.id, coalesce(v_empresa.nome, 'Restaurante'), left(trim(p_endereco), 500), p_pagamento,
    nullif(left(trim(coalesce(p_observacoes, '')), 500), ''), v_subtotal, v_taxa, v_desconto,
    nullif(upper(trim(coalesce(p_cupom, ''))), ''), v_total, 'recebido'
  ) returning * into v_pedido;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_quantidade := (v_item ->> 'quantidade')::integer;
    v_adicionais := coalesce(v_item -> 'adicionais', '[]'::jsonb);

    select p.id::text as id,
           p.nome,
           case when coalesce(p.promocao, 0) > 0 then p.promocao else p.preco end as preco
      into v_produto
    from public.produtos p
    where p.id::text = v_item ->> 'produto_id'
      and p.empresa_id::text = p_empresa_id
      and p.disponivel = true
    limit 1;

    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', a.id::text, 'nome', a.nome, 'preco', a.preco)
        order by a.nome
      ),
      '[]'::jsonb
    ) into v_adicionais_normalizados
    from public.adicionais a
    where a.ativo = true
      and a.id::text in (
        select adicional ->> 'id'
        from jsonb_array_elements(v_adicionais) adicional
      )
      and exists (
        select 1 from public.produto_grupos pg
        where pg.produto_id::text = v_produto.id and pg.grupo_id::text = a.grupo_id::text
      );

    insert into public.pedido_itens (
      pedido_id, produto_id, nome_produto, preco_unitario,
      quantidade, observacao, adicionais
    ) values (
      v_pedido.id, v_produto.id, v_produto.nome, v_produto.preco,
      v_quantidade, nullif(left(trim(coalesce(v_item ->> 'observacao', '')), 300), ''),
      v_adicionais_normalizados
    );
  end loop;

  return jsonb_build_object(
    'id', v_pedido.id,
    'numero', v_pedido.numero,
    'status', v_pedido.status,
    'created_at', v_pedido.created_at,
    'subtotal', v_pedido.subtotal,
    'taxa_entrega', v_pedido.taxa_entrega,
    'desconto', v_pedido.desconto,
    'total', v_pedido.total
  );
end;
$$;

revoke all on function private.criar_pedido_impl(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.criar_pedido_impl(text, text, text, text, text, jsonb) to authenticated;

create or replace function public.criar_pedido(
  p_empresa_id text,
  p_endereco text,
  p_pagamento text,
  p_observacoes text default null,
  p_cupom text default null,
  p_itens jsonb default '[]'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.criar_pedido_impl(
    p_empresa_id, p_endereco, p_pagamento, p_observacoes, p_cupom, p_itens
  );
$$;

revoke all on function public.criar_pedido(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.criar_pedido(text, text, text, text, text, jsonb) to authenticated;

-- O navegador só cria pedidos pela função validada acima.
revoke insert, delete on public.pedidos, public.pedido_itens from anon, authenticated;
-- Multi Delivery - endurecimento de permissões e RLS
-- Execute DEPOIS de 001_delivery_core.sql.
-- Este arquivo pode ser executado novamente com segurança.

-- =========================================================
-- 1) PRINCÍPIO DE MENOR PRIVILÉGIO
-- =========================================================

-- O frontend não precisa acessar sequências diretamente: pedidos são criados
-- pela função criar_pedido e as demais tabelas usam UUIDs gerados pelo banco.
revoke usage, select on all sequences in schema public from anon, authenticated;

-- O catálogo continua disponível somente pela view segura.
revoke all on public.empresas from anon;
revoke all on public.empresas_catalogo from public, anon, authenticated;
grant select on public.empresas_catalogo to anon, authenticated;

-- Garante que a numeração pública do pedido seja realmente única em bancos
-- que já existiam antes desta migração.
create unique index if not exists pedidos_numero_unique
  on public.pedidos(numero);

-- =========================================================
-- 2) VIEW DO CATÁLOGO PÚBLICO
-- =========================================================

-- A view expõe somente informações de catálogo. Dados administrativos
-- (usuario_id, e-mail, telefone administrativo e CNPJ) continuam fora dela.
create or replace view public.empresas_catalogo
with (security_barrier = true)
as
select
  e.id::text as id,
  e.nome,
  e.descricao,
  e.categoria,
  e.tipo,
  e.logo,
  e.banner,
  e.taxa_entrega,
  e.pedido_minimo,
  e.status
from public.empresas e;

revoke all on public.empresas_catalogo from public, anon, authenticated;
grant select on public.empresas_catalogo to anon, authenticated;

-- =========================================================
-- 3) POLÍTICAS RLS DE LEITURA DO CATÁLOGO
-- =========================================================
-- Uma única política de SELECT por tabela evita a combinação de várias
-- políticas permissivas para authenticated. Usuários anônimos só satisfazem
-- a parte pública; proprietários também podem enxergar registros inativos
-- do próprio restaurante para administrá-los no painel.

-- CATEGORIAS

drop policy if exists "catalogo categorias publico" on public.categorias;
drop policy if exists "proprietario le categorias" on public.categorias;
drop policy if exists "catalogo_categorias_select" on public.categorias;
create policy "catalogo_categorias_select"
on public.categorias
for select
to anon, authenticated
using (
  ativo = true
  or exists (
    select 1
    from public.empresas e
    where e.id::text = categorias.empresa_id::text
      and e.usuario_id = (select auth.uid())
  )
);

-- PRODUTOS

drop policy if exists "catalogo produtos publico" on public.produtos;
drop policy if exists "proprietario le produtos" on public.produtos;
drop policy if exists "catalogo_produtos_select" on public.produtos;
create policy "catalogo_produtos_select"
on public.produtos
for select
to anon, authenticated
using (
  disponivel = true
  or exists (
    select 1
    from public.empresas e
    where e.id::text = produtos.empresa_id::text
      and e.usuario_id = (select auth.uid())
  )
);

-- GRUPOS DE ADICIONAIS

drop policy if exists "catalogo grupos adicionais publico" on public.grupos_adicionais;
drop policy if exists "proprietario le grupos" on public.grupos_adicionais;
drop policy if exists "catalogo_grupos_select" on public.grupos_adicionais;
create policy "catalogo_grupos_select"
on public.grupos_adicionais
for select
to anon, authenticated
using (
  ativo = true
  or exists (
    select 1
    from public.empresas e
    where e.id::text = grupos_adicionais.empresa_id::text
      and e.usuario_id = (select auth.uid())
  )
);

-- ADICIONAIS

drop policy if exists "catalogo adicionais publico" on public.adicionais;
drop policy if exists "proprietario le adicionais" on public.adicionais;
drop policy if exists "catalogo_adicionais_select" on public.adicionais;
create policy "catalogo_adicionais_select"
on public.adicionais
for select
to anon, authenticated
using (
  ativo = true
  or exists (
    select 1
    from public.grupos_adicionais g
    join public.empresas e
      on e.id::text = g.empresa_id::text
    where g.id::text = adicionais.grupo_id::text
      and e.usuario_id = (select auth.uid())
  )
);

-- VÍNCULOS PRODUTO -> GRUPO
-- Público só enxerga vínculos de produtos disponíveis e grupos ativos.

drop policy if exists "catalogo produto grupos publico" on public.produto_grupos;
drop policy if exists "catalogo_produto_grupos_select" on public.produto_grupos;
create policy "catalogo_produto_grupos_select"
on public.produto_grupos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.produtos p
    join public.grupos_adicionais g
      on g.id::text = produto_grupos.grupo_id::text
    where p.id::text = produto_grupos.produto_id::text
      and p.disponivel = true
      and g.ativo = true
  )
  or exists (
    select 1
    from public.produtos p
    join public.empresas e
      on e.id::text = p.empresa_id::text
    where p.id::text = produto_grupos.produto_id::text
      and e.usuario_id = (select auth.uid())
  )
);

-- =========================================================
-- 4) MANTÉM RLS EXPLICITAMENTE ATIVO
-- =========================================================

alter table public.usuarios enable row level security;
alter table public.empresas enable row level security;
alter table public.categorias enable row level security;
alter table public.produtos enable row level security;
alter table public.produto_grupos enable row level security;
alter table public.grupos_adicionais enable row level security;
alter table public.adicionais enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

-- =========================================================
-- 5) FUNÇÃO INTERNA DE PEDIDO
-- =========================================================
-- O cliente deve usar apenas public.criar_pedido. A função interna executa
-- com privilégios elevados para gravar pedidos, mas continua inacessível
-- diretamente ao papel anon e só é executável por authenticated porque o
-- wrapper público depende dela.

revoke all on function private.criar_pedido_impl(text, text, text, text, text, jsonb)
from public, anon, authenticated;
grant execute on function private.criar_pedido_impl(text, text, text, text, text, jsonb)
to authenticated;

revoke all on function public.criar_pedido(text, text, text, text, text, jsonb)
from public, anon;
grant execute on function public.criar_pedido(text, text, text, text, text, jsonb)
to authenticated;

-- Não permitir criação direta de pedidos pelo navegador.
revoke insert, delete on public.pedidos, public.pedido_itens from anon, authenticated;

-- =========================================================
-- 6) RESUMO DOS PAPÉIS
-- =========================================================
-- anon:
--   leitura do catálogo público + execução de nenhum procedimento privado.
-- authenticated:
--   perfil próprio; administração do próprio restaurante; leitura dos seus
--   pedidos; atualização apenas do status dos pedidos do próprio restaurante;
--   criação de pedidos exclusivamente por public.criar_pedido.
-- service_role:
--   permanece com o acesso administrativo padrão do Supabase.

comment on table public.usuarios is 'Perfil do cliente vinculado a auth.users; protegido por RLS.';
comment on table public.empresas is 'Dados administrativos e de catálogo dos restaurantes; dados sensíveis não são expostos diretamente ao anon.';
comment on table public.pedidos is 'Pedidos criados exclusivamente pela função public.criar_pedido e protegidos por RLS.';
comment on table public.pedido_itens is 'Itens de pedidos; leitura permitida somente a cliente ou restaurante participante.';

-- =========================================================
-- RECURSOS AVANÇADOS
-- Conteúdo equivalente à migration 004_recursos_avancados.sql.
-- =========================================================
-- Multi Delivery: recursos avançados, histórico, endereços, cupons e avaliações.
-- Execute após as migrações 001, 002 e 003.

create table if not exists public.enderecos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  apelido text not null default 'Casa',
  cep text,
  logradouro text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  uf text not null,
  referencia text,
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.historico_status_pedido (
  id bigint generated always as identity primary key,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  status text not null check (status in ('recebido','preparando','saiu_para_entrega','entregue','cancelado')),
  alterado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  empresa_id text,
  codigo text not null,
  tipo text not null check (tipo in ('percentual','fixo','frete')),
  valor numeric(12,2) not null check (valor >= 0),
  pedido_minimo numeric(12,2) not null default 0 check (pedido_minimo >= 0),
  limite_usos integer check (limite_usos is null or limite_usos > 0),
  usos integer not null default 0 check (usos >= 0),
  primeiro_pedido boolean not null default false,
  inicio timestamptz not null default now(),
  fim timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);

create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  empresa_id text not null,
  nota integer not null check (nota between 1 and 5),
  comentario text check (char_length(comentario) <= 1000),
  resposta text check (char_length(resposta) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enderecos_usuario_idx on public.enderecos(usuario_id);
create index if not exists historico_pedido_idx on public.historico_status_pedido(pedido_id, created_at);
create index if not exists cupons_codigo_idx on public.cupons(upper(codigo));
create index if not exists avaliacoes_empresa_idx on public.avaliacoes(empresa_id, created_at desc);

alter table public.enderecos enable row level security;
alter table public.historico_status_pedido enable row level security;
alter table public.cupons enable row level security;
alter table public.avaliacoes enable row level security;

-- Endereços: somente o dono.
drop policy if exists "usuario gerencia enderecos" on public.enderecos;
create policy "usuario gerencia enderecos" on public.enderecos for all to authenticated
using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Histórico: cliente do pedido ou proprietário do restaurante.
drop policy if exists "participantes leem historico" on public.historico_status_pedido;
create policy "participantes leem historico" on public.historico_status_pedido for select to authenticated using (
  exists (select 1 from public.pedidos p where p.id = pedido_id and (
    p.usuario_id = auth.uid() or exists (select 1 from public.empresas e where e.id::text = p.empresa_id and e.usuario_id = auth.uid())
  ))
);

-- Cupons ativos podem ser consultados; somente o restaurante gerencia os próprios.
drop policy if exists "cupons ativos leitura" on public.cupons;
create policy "cupons ativos leitura" on public.cupons for select to authenticated using (
  ativo = true and inicio <= now() and (fim is null or fim >= now()) and (limite_usos is null or usos < limite_usos)
  or exists (select 1 from public.empresas e where e.id::text = empresa_id and e.usuario_id = auth.uid())
);
drop policy if exists "restaurante gerencia cupons" on public.cupons;
create policy "restaurante gerencia cupons" on public.cupons for all to authenticated using (
  exists (select 1 from public.empresas e where e.id::text = empresa_id and e.usuario_id = auth.uid())
) with check (
  exists (select 1 from public.empresas e where e.id::text = empresa_id and e.usuario_id = auth.uid())
);

-- Avaliações públicas para leitura. Criação apenas pelo cliente após entrega.
drop policy if exists "avaliacoes leitura publica" on public.avaliacoes;
create policy "avaliacoes leitura publica" on public.avaliacoes for select to anon, authenticated using (true);
drop policy if exists "cliente cria avaliacao" on public.avaliacoes;
create policy "cliente cria avaliacao" on public.avaliacoes for insert to authenticated with check (
  usuario_id = auth.uid() and exists (
    select 1 from public.pedidos p where p.id = pedido_id and p.usuario_id = auth.uid() and p.empresa_id = empresa_id and p.status = 'entregue'
  )
);
drop policy if exists "cliente atualiza avaliacao" on public.avaliacoes;
create policy "cliente atualiza avaliacao" on public.avaliacoes for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create or replace function private.registrar_status_pedido()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.historico_status_pedido(pedido_id,status,alterado_por)
    values(new.id,new.status,auth.uid());
  end if;
  return new;
end;$$;

drop trigger if exists registrar_status_pedido on public.pedidos;
create trigger registrar_status_pedido after insert or update of status on public.pedidos
for each row execute function private.registrar_status_pedido();

-- Apenas um endereço principal por usuário.
create unique index if not exists enderecos_um_principal_idx on public.enderecos(usuario_id) where principal = true;

-- Permissões mínimas da API.
grant select, insert, update, delete on public.enderecos to authenticated;
grant select on public.historico_status_pedido to authenticated;
grant select on public.cupons to authenticated;
grant insert, update, delete on public.cupons to authenticated;
grant select on public.avaliacoes to anon, authenticated;
grant insert, update on public.avaliacoes to authenticated;
grant usage, select on sequence public.historico_status_pedido_id_seq to authenticated;

-- Habilita eventos Realtime quando a tabela ainda não está na publicação.
do $$ begin
  alter publication supabase_realtime add table public.pedidos;
exception when duplicate_object then null; when undefined_object then null;
end $$;
