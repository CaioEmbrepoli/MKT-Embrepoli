create table if not exists public.tray_integration (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  api_address text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

alter table public.tray_integration enable row level security;

drop policy if exists "members read tray integration status" on public.tray_integration;
create policy "members read tray integration status" on public.tray_integration for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage tray integration" on public.tray_integration;
create policy "admins and managers manage tray integration" on public.tray_integration for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));
