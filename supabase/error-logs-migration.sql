create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null references public.organizations(id) on delete cascade,
  provider text not null,
  service text not null,
  error_code text,
  user_message text,
  technical_message text,
  action text,
  profile_id text,
  created_at timestamptz not null default now()
);

create index if not exists error_logs_org_created_idx
  on public.error_logs (organization_id, created_at desc);

alter table public.error_logs enable row level security;

drop policy if exists "admins read error logs" on public.error_logs;
create policy "admins read error logs" on public.error_logs for select
  using (organization_id = public.current_organization_id());

drop policy if exists "service insert error logs" on public.error_logs;
create policy "service insert error logs" on public.error_logs for insert
  with check (organization_id = public.current_organization_id());
