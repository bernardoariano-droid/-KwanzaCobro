-- NEUROJUS: migração faseada para Supabase Auth e RLS
-- Preserva as tabelas e os registos existentes. Não apaga utilizadores nem dados.
-- Executar no Supabase SQL Editor depois de criar o primeiro utilizador administrador
-- em Authentication > Users. Ver instruções em docs/NEUROJUS-SUPABASE-AUTH.md.

begin;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seller_id text unique references public.sellers(id) on delete set null,
  full_name text not null default '',
  role text not null default 'vendedor' check (role in ('admin','vendedor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_seller_id on public.user_profiles(seller_id);
alter table public.user_profiles enable row level security;

create or replace function public.neurojus_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.user_profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.neurojus_current_seller_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.seller_id from public.user_profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.neurojus_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.neurojus_current_role() = 'admin', false);
$$;

-- Associar automaticamente apenas contas Auth já existentes com e-mail correspondente.
-- Estas contas recebem papel vendedor; o administrador inicial é promovido manualmente.
insert into public.user_profiles (user_id, seller_id, full_name, role)
select au.id, s.id, coalesce(s.name, ''), 'vendedor'
from auth.users au
join public.sellers s on lower(trim(s.email)) = lower(trim(au.email))
where coalesce(trim(s.email), '') <> ''
on conflict (user_id) do update
set seller_id = excluded.seller_id,
    full_name = excluded.full_name,
    updated_at = now();

-- Eliminar TODAS as políticas antigas das tabelas protegidas. Políticas permissivas
-- antigas combinam-se por OR; simplesmente acrescentar novas políticas não é seguro.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('user_profiles','kwanzacobro_sync','company_settings','sellers','clients','debts','debt_items','payments','audit_trail')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- As credenciais antigas em texto simples deixam de ser consultáveis mesmo por utilizadores autenticados.
-- As colunas são preservadas nesta fase, mas sem privilégios de leitura/escrita via API.
revoke select (password), insert (password), update (password) on public.sellers from anon, authenticated;
revoke select (senha, password), insert (senha, password), update (senha, password) on public.company_settings from anon, authenticated;

-- Sem acesso anónimo. O acesso autenticado continua sujeito às políticas abaixo.
revoke all on public.user_profiles, public.kwanzacobro_sync, public.company_settings,
  public.sellers, public.clients, public.debts, public.debt_items, public.payments,
  public.audit_trail from anon, authenticated;

grant select on public.user_profiles to authenticated;
grant select, insert, update, delete on public.kwanzacobro_sync,
  public.clients, public.debts, public.debt_items, public.payments, public.audit_trail to authenticated;

-- Conceder apenas colunas não sensíveis nas tabelas que ainda contêm credenciais antigas.
grant select (id,name,phone,branch,email,role,created_at) on public.sellers to authenticated;
grant delete on public.sellers to authenticated;
grant select (id,name,nif,phone,email,address,city,bank_name,iban,express_phone,currency,logo_url,penalty_per_day_rate,days_before_due_alert,auto_alert_notifications,updated_at)
  on public.company_settings to authenticated;
grant insert (id,name,nif,phone,email,address,city,bank_name,iban,express_phone,currency,logo_url,penalty_per_day_rate,days_before_due_alert,auto_alert_notifications,updated_at)
  on public.company_settings to authenticated;
grant update (name,nif,phone,email,address,city,bank_name,iban,express_phone,currency,logo_url,penalty_per_day_rate,days_before_due_alert,auto_alert_notifications,updated_at)
  on public.company_settings to authenticated;

create policy "profile_read_self_or_admin" on public.user_profiles
for select to authenticated
using (user_id = auth.uid() or public.neurojus_is_admin());

create policy "snapshot_admin_only" on public.kwanzacobro_sync
for all to authenticated
using (public.neurojus_is_admin())
with check (public.neurojus_is_admin());

create policy "company_read_authenticated" on public.company_settings
for select to authenticated using (auth.uid() is not null);
create policy "company_admin_write" on public.company_settings
for all to authenticated
using (public.neurojus_is_admin())
with check (public.neurojus_is_admin());

create policy "sellers_read_admin_or_self" on public.sellers
for select to authenticated
using (public.neurojus_is_admin() or id = public.neurojus_current_seller_id());
create policy "sellers_admin_insert" on public.sellers
for insert to authenticated with check (public.neurojus_is_admin());
create policy "sellers_admin_update" on public.sellers
for update to authenticated using (public.neurojus_is_admin())
with check (public.neurojus_is_admin());
create policy "sellers_admin_delete" on public.sellers
for delete to authenticated using (public.neurojus_is_admin());

create policy "clients_read_owner_or_admin" on public.clients
for select to authenticated
using (
  public.neurojus_is_admin()
  or created_by_seller_id = public.neurojus_current_seller_id()
  or exists (
    select 1 from public.debts d
    where d.client_id = clients.id
      and d.seller_id = public.neurojus_current_seller_id()
  )
);
create policy "clients_insert_owner_or_admin" on public.clients
for insert to authenticated
with check (public.neurojus_is_admin() or created_by_seller_id = public.neurojus_current_seller_id());
create policy "clients_update_owner_or_admin" on public.clients
for update to authenticated
using (public.neurojus_is_admin() or created_by_seller_id = public.neurojus_current_seller_id())
with check (public.neurojus_is_admin() or created_by_seller_id = public.neurojus_current_seller_id());
create policy "clients_delete_owner_or_admin" on public.clients
for delete to authenticated
using (public.neurojus_is_admin() or created_by_seller_id = public.neurojus_current_seller_id());

create policy "debts_read_owner_or_admin" on public.debts
for select to authenticated
using (public.neurojus_is_admin() or seller_id = public.neurojus_current_seller_id());
create policy "debts_insert_owner_or_admin" on public.debts
for insert to authenticated
with check (public.neurojus_is_admin() or seller_id = public.neurojus_current_seller_id());
create policy "debts_update_owner_or_admin" on public.debts
for update to authenticated
using (public.neurojus_is_admin() or seller_id = public.neurojus_current_seller_id())
with check (public.neurojus_is_admin() or seller_id = public.neurojus_current_seller_id());
create policy "debts_delete_owner_or_admin" on public.debts
for delete to authenticated
using (public.neurojus_is_admin() or seller_id = public.neurojus_current_seller_id());

create policy "debt_items_access_parent_debt" on public.debt_items
for all to authenticated
using (
  public.neurojus_is_admin() or exists (
    select 1 from public.debts d
    where d.id = debt_items.debt_id
      and d.seller_id = public.neurojus_current_seller_id()
  )
)
with check (
  public.neurojus_is_admin() or exists (
    select 1 from public.debts d
    where d.id = debt_items.debt_id
      and d.seller_id = public.neurojus_current_seller_id()
  )
);

create policy "payments_access_parent_debt" on public.payments
for all to authenticated
using (
  public.neurojus_is_admin() or exists (
    select 1 from public.debts d
    where d.id = payments.debt_id
      and d.seller_id = public.neurojus_current_seller_id()
  )
)
with check (
  public.neurojus_is_admin() or exists (
    select 1 from public.debts d
    where d.id = payments.debt_id
      and d.seller_id = public.neurojus_current_seller_id()
  )
);

create policy "audit_read_parent_debt" on public.audit_trail
for select to authenticated
using (
  public.neurojus_is_admin() or exists (
    select 1 from public.debts d
    where d.id = audit_trail.debt_id
      and d.seller_id = public.neurojus_current_seller_id()
  )
);
create policy "audit_insert_parent_debt" on public.audit_trail
for insert to authenticated
with check (
  public.neurojus_is_admin() or exists (
    select 1 from public.debts d
    where d.id = audit_trail.debt_id
      and d.seller_id = public.neurojus_current_seller_id()
  )
);

-- As rotinas antigas de snapshot copiavam senhas em texto simples para JSONB.
-- Desactivá-las sem apagar a tabela nem os registos relacionais.
drop trigger if exists trigger_sync_debts_to_snapshot on public.debts;
drop trigger if exists trigger_sync_clients_to_snapshot on public.clients;
drop trigger if exists trigger_sync_sellers_to_snapshot on public.sellers;
drop trigger if exists trigger_sync_payments_to_snapshot on public.payments;
drop trigger if exists trigger_sync_items_to_snapshot on public.debt_items;
drop trigger if exists trigger_sync_company_to_snapshot on public.company_settings;

update public.kwanzacobro_sync
set sellers = coalesce((
      select jsonb_agg(item - 'password')
      from jsonb_array_elements(coalesce(sellers, '[]'::jsonb)) item
    ), '[]'::jsonb),
    company = coalesce(company, '{}'::jsonb) - 'senha' - 'password';

-- Remover acesso directo à view legada; usar public.clients.
revoke all on public.clientes from anon, authenticated;

commit;

-- PASSO MANUAL OBRIGATÓRIO (após executar esta migração):
-- 1. Criar o utilizador administrador em Authentication > Users (e-mail + senha).
-- 2. Copiar o UUID desse utilizador e executar:
--    insert into public.user_profiles (user_id, full_name, role)
--    values ('UUID-DO-ADMIN', 'Administrador Geral', 'admin');
-- 3. Para vendedores com conta Auth já criada, a associação por e-mail acima é automática.
-- 4. Não activar registo público de utilizadores. Contas novas devem ser criadas pelo administrador.
-- 5. Configurar SMTP em Authentication > SMTP Settings para recuperação/convites.
