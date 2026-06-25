create table if not exists public.meta_ads_import_jobs (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  batch_id text not null,
  range_type text not null check (range_type in ('last_30d', 'last_12m', 'all_time')),
  chunk_index integer not null default 0,
  chunk_total integer not null default 1,
  since_date date not null,
  until_date date not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'canceled')),
  attempts integer not null default 0,
  error_message text,
  result_accounts integer,
  result_campaigns integer,
  result_ad_sets integer,
  result_ads integer,
  result_insights integer,
  created_by text references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meta_ads_import_jobs_org_status_idx
on public.meta_ads_import_jobs (organization_id, status, created_at);

create index if not exists meta_ads_import_jobs_batch_idx
on public.meta_ads_import_jobs (organization_id, batch_id);

alter table public.meta_ads_import_jobs enable row level security;

drop policy if exists "members manage meta ads import jobs" on public.meta_ads_import_jobs;
create policy "members manage meta ads import jobs" on public.meta_ads_import_jobs for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  alter publication supabase_realtime add table public.meta_ads_import_jobs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
