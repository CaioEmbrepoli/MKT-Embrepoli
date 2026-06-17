create table if not exists public.conversions (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  person_id text references public.persons(id) on delete set null,
  sales_client_id text references public.sales_clients(id) on delete set null,
  visitor_id text references public.visitors(id) on delete set null,
  sale_value numeric not null,
  product_name text not null default '',
  sale_date date not null,
  source text not null default 'manual',
  external_order_id text,
  invoice_number text,
  invoice_key text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_order_id)
);

create index if not exists conversions_org_date_idx on public.conversions(organization_id, sale_date);
create index if not exists conversions_person_idx on public.conversions(person_id);

alter table public.conversions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversions'
      and policyname = 'org members can read conversions'
  ) then
    create policy "org members can read conversions"
      on public.conversions for select
      using (organization_id = current_organization_id());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversions'
      and policyname = 'org members can insert conversions'
  ) then
    create policy "org members can insert conversions"
      on public.conversions for insert
      with check (organization_id = current_organization_id());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'conversions'
      and policyname = 'org members can update conversions'
  ) then
    create policy "org members can update conversions"
      on public.conversions for update
      using (organization_id = current_organization_id())
      with check (organization_id = current_organization_id());
  end if;
end $$;
