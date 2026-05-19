alter table public.tasks add column if not exists reset_frequency text not null default 'none';
alter table public.tasks add column if not exists reset_time text not null default '23:59';
alter table public.tasks add column if not exists reset_weekday integer;
alter table public.tasks add column if not exists reset_month_day integer;
alter table public.tasks add column if not exists reset_month_last_day boolean not null default false;
alter table public.tasks add column if not exists fixed_goal_key text;
alter table public.tasks add column if not exists reset_source_id text references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists last_reset_at timestamptz;
alter table public.tasks add column if not exists next_reset_at timestamptz;

create table if not exists public.task_reset_history (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_id text references public.tasks(id) on delete set null,
  reset_source_id text references public.tasks(id) on delete set null,
  frequency text not null,
  scheduled_for timestamptz,
  executed_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb
);

alter table public.task_reset_history enable row level security;

drop policy if exists "members manage task reset history" on public.task_reset_history;

create policy "members manage task reset history"
on public.task_reset_history
for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());
