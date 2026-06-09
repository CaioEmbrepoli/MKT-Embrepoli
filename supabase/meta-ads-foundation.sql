create table if not exists public.ad_accounts (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta',
  external_id text,
  name text not null,
  currency text not null default 'BRL',
  status text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_accounts_org_platform_external_idx
on public.ad_accounts (organization_id, platform, external_id)
where external_id is not null;

create table if not exists public.ad_campaigns (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  internal_campaign_id text references public.campaigns(id) on delete set null,
  external_id text,
  name text not null,
  objective text not null default '',
  status text not null default 'unknown',
  budget_amount numeric,
  budget_type text not null default 'unknown',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_campaigns_org_account_external_idx
on public.ad_campaigns (organization_id, account_id, external_id)
where external_id is not null;

create table if not exists public.ad_sets (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  external_id text,
  name text not null,
  audience_name text,
  status text not null default 'unknown',
  budget_amount numeric,
  budget_type text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_sets_org_campaign_external_idx
on public.ad_sets (organization_id, campaign_id, external_id)
where external_id is not null;

create table if not exists public.ads (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  ad_set_id text references public.ad_sets(id) on delete set null,
  external_id text,
  name text not null,
  creative_name text,
  status text not null default 'unknown',
  thumbnail_url text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ads_org_campaign_external_idx
on public.ads (organization_id, campaign_id, external_id)
where external_id is not null;

create table if not exists public.ad_insights_daily (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta',
  account_id text not null references public.ad_accounts(id) on delete cascade,
  campaign_id text references public.ad_campaigns(id) on delete cascade,
  ad_set_id text references public.ad_sets(id) on delete cascade,
  ad_id text references public.ads(id) on delete cascade,
  date date not null,
  spend numeric not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  frequency numeric not null default 0,
  cpm numeric not null default 0,
  clicks integer not null default 0,
  link_clicks integer not null default 0,
  ctr numeric not null default 0,
  cpc numeric not null default 0,
  landing_page_views integer not null default 0,
  leads integer not null default 0,
  cost_per_lead numeric not null default 0,
  conversations integer not null default 0,
  cost_per_conversation numeric not null default 0,
  purchases integer not null default 0,
  purchase_value numeric not null default 0,
  cost_per_purchase numeric not null default 0,
  roas numeric not null default 0,
  engagements integer not null default 0,
  video_views integer not null default 0,
  cost_per_engagement numeric not null default 0,
  breakdown_placement text,
  breakdown_age text,
  breakdown_gender text,
  breakdown_region text,
  breakdown_device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_insights_daily_unique_idx
on public.ad_insights_daily (
  organization_id,
  platform,
  account_id,
  coalesce(campaign_id, ''),
  coalesce(ad_set_id, ''),
  coalesce(ad_id, ''),
  date,
  coalesce(breakdown_placement, ''),
  coalesce(breakdown_age, ''),
  coalesce(breakdown_gender, ''),
  coalesce(breakdown_region, ''),
  coalesce(breakdown_device, '')
);

create table if not exists public.ad_alerts (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta',
  severity text not null default 'atencao',
  status text not null default 'open',
  entity_type text not null,
  entity_id text not null,
  title text not null,
  description text not null default '',
  recommendation text not null default '',
  metric_key text not null default '',
  metric_value numeric,
  benchmark_value numeric,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ads enable row level security;
alter table public.ad_insights_daily enable row level security;
alter table public.ad_alerts enable row level security;

drop policy if exists "members manage ad accounts" on public.ad_accounts;
create policy "members manage ad accounts" on public.ad_accounts for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage ad campaigns" on public.ad_campaigns;
create policy "members manage ad campaigns" on public.ad_campaigns for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage ad sets" on public.ad_sets;
create policy "members manage ad sets" on public.ad_sets for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage ads" on public.ads;
create policy "members manage ads" on public.ads for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage ad insights daily" on public.ad_insights_daily;
create policy "members manage ad insights daily" on public.ad_insights_daily for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage ad alerts" on public.ad_alerts;
create policy "members manage ad alerts" on public.ad_alerts for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  alter publication supabase_realtime add table public.ad_accounts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ad_campaigns;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ad_sets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ads;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ad_insights_daily;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ad_alerts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
