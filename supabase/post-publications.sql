create table if not exists public.post_publications (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text references public.posts(id) on delete cascade,
  platform text not null,
  status text not null default 'pending',
  title text not null default '',
  caption text not null default '',
  format text not null default '',
  asset_url text not null default '',
  thumbnail_url text,
  external_id text,
  permalink text,
  processing_stage text,
  instagram_creation_id text,
  prepared_asset_url text,
  prepared_content_type text,
  meta_status text,
  next_attempt_at timestamptz,
  last_heartbeat_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  error text,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  created_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts add column if not exists extra_channels jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists published_video_id text;
alter table public.posts add column if not exists published_at timestamptz;

alter table public.post_publications add column if not exists organization_id text references public.organizations(id) on delete cascade;
alter table public.post_publications add column if not exists post_id text references public.posts(id) on delete cascade;
alter table public.post_publications add column if not exists platform text not null default 'instagram';
alter table public.post_publications add column if not exists status text not null default 'pending';
alter table public.post_publications add column if not exists title text not null default '';
alter table public.post_publications add column if not exists caption text not null default '';
alter table public.post_publications add column if not exists format text not null default '';
alter table public.post_publications add column if not exists asset_url text not null default '';
alter table public.post_publications add column if not exists carousel_assets jsonb not null default '[]'::jsonb;
alter table public.post_publications add column if not exists thumbnail_url text;
alter table public.post_publications add column if not exists external_id text;
alter table public.post_publications add column if not exists permalink text;
alter table public.post_publications add column if not exists processing_stage text;
alter table public.post_publications add column if not exists instagram_creation_id text;
alter table public.post_publications add column if not exists prepared_asset_url text;
alter table public.post_publications add column if not exists prepared_content_type text;
alter table public.post_publications add column if not exists meta_status text;
alter table public.post_publications add column if not exists next_attempt_at timestamptz;
alter table public.post_publications add column if not exists last_heartbeat_at timestamptz;
alter table public.post_publications add column if not exists scheduled_at timestamptz;
alter table public.post_publications add column if not exists published_at timestamptz;
alter table public.post_publications add column if not exists error text;
alter table public.post_publications add column if not exists attempts integer not null default 0;
alter table public.post_publications add column if not exists last_attempt_at timestamptz;
alter table public.post_publications add column if not exists created_by text references public.profiles(id) on delete set null;
alter table public.post_publications add column if not exists created_at timestamptz not null default now();
alter table public.post_publications add column if not exists updated_at timestamptz not null default now();

create index if not exists post_publications_org_platform_status_idx
on public.post_publications (organization_id, platform, status, scheduled_at);

create index if not exists post_publications_instagram_queue_idx
on public.post_publications (platform, status, next_attempt_at, scheduled_at)
where platform = 'instagram';

alter table public.post_publications enable row level security;

drop policy if exists "members manage post publications" on public.post_publications;
create policy "members manage post publications"
on public.post_publications
for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  alter publication supabase_realtime add table public.post_publications;
exception
  when duplicate_object then null;
end $$;
