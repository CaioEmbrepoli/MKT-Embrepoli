create table if not exists public.google_connections (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade unique,
  google_email text not null default '',
  scopes text[] not null default '{}'::text[],
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  connected_by text references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_connections enable row level security;

drop policy if exists "members read google connection status" on public.google_connections;
create policy "members read google connection status" on public.google_connections for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage google connection" on public.google_connections;
create policy "admins and managers manage google connection" on public.google_connections for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'google_connections'
  ) then
    alter publication supabase_realtime add table public.google_connections;
  end if;
end $$;
