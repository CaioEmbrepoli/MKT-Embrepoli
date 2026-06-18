create table if not exists public.integration_health (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null,
  service text not null,
  status text not null default 'ok' check (status in ('ok', 'warning', 'error')),
  last_error_code text,
  last_error_message text,
  last_technical_message text,
  action text,
  reconnect_target text,
  last_failed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, service)
);

create index if not exists integration_health_org_status_idx
on public.integration_health (organization_id, status, updated_at desc);

alter table public.integration_health enable row level security;

drop policy if exists "members read integration health" on public.integration_health;
create policy "members read integration health" on public.integration_health for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage integration health" on public.integration_health;
create policy "members manage integration health" on public.integration_health for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  alter publication supabase_realtime add table public.integration_health;
exception
  when duplicate_object then null;
end $$;
