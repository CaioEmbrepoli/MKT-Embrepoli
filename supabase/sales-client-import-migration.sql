-- Vendas: campos reais de clientes e base para importacao XLSX

create table if not exists public.sales_clients (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  external_code text,
  name text not null default '',
  client_type text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  segment text not null default '',
  state_uf text not null default '',
  city text not null default '',
  last_purchase_at date,
  status text not null default 'lead',
  source text not null default 'manual',
  assigned_to text references public.profiles(id) on delete set null,
  notes text not null default '',
  proposals jsonb not null default '[]'::jsonb,
  sales_funnel_stage text not null default 'lead',
  created_at timestamptz not null default now()
);

alter table public.sales_clients add column if not exists external_code text;
alter table public.sales_clients add column if not exists client_type text not null default '';
alter table public.sales_clients add column if not exists state_uf text not null default '';
alter table public.sales_clients add column if not exists city text not null default '';
alter table public.sales_clients add column if not exists last_purchase_at date;
alter table public.sales_clients add column if not exists sales_funnel_stage text not null default 'lead';

create unique index if not exists sales_clients_org_external_code_idx
on public.sales_clients (organization_id, external_code)
where external_code is not null and btrim(external_code) <> '';

create table if not exists public.sales_funnel_stages (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null default '',
  color text not null default '#64748b',
  emoji text not null default '',
  sort_order integer not null default 0,
  half_width boolean not null default false
);

alter table public.sales_funnel_stages add column if not exists half_width boolean not null default false;

create table if not exists public.call_schedules (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  client_id text references public.sales_clients(id) on delete cascade,
  client_name text not null default '',
  phone text not null default '',
  frequency text not null default 'weekly',
  next_call_at date not null default current_date,
  call_history jsonb not null default '[]'::jsonb,
  assigned_to text references public.profiles(id) on delete set null,
  active boolean not null default true,
  paused boolean not null default false,
  archived boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.call_schedules add column if not exists paused boolean not null default false;
alter table public.call_schedules add column if not exists archived boolean not null default false;

alter table public.sales_clients enable row level security;
alter table public.sales_funnel_stages enable row level security;
alter table public.call_schedules enable row level security;

drop policy if exists "members manage sales clients" on public.sales_clients;
create policy "members manage sales clients"
on public.sales_clients
for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage sales funnel stages" on public.sales_funnel_stages;
create policy "members manage sales funnel stages"
on public.sales_funnel_stages
for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage call schedules" on public.call_schedules;
create policy "members manage call schedules"
on public.call_schedules
for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  alter publication supabase_realtime add table public.sales_clients;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.sales_funnel_stages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.call_schedules;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
