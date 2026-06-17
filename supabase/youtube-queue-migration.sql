create table if not exists public.youtube_upload_queue (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text references public.posts(id) on delete set null,
  post_publication_id text references public.post_publications(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  asset_url text not null,
  title text not null default '',
  description text not null default '',
  format text not null default 'video',
  scheduled_at timestamptz,
  thumbnail_url text,
  allow_duplicate boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'processing', 'uploaded', 'failed', 'canceled')),
  upload_url text,
  bytes_uploaded bigint not null default 0,
  file_size bigint not null default 0,
  content_type text not null default 'video/mp4',
  video_id text,
  error_message text,
  attempts integer not null default 0,
  locked_at timestamptz,
  last_heartbeat_at timestamptz,
  next_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.youtube_upload_queue add column if not exists organization_id text references public.organizations(id) on delete cascade;
alter table public.youtube_upload_queue add column if not exists post_id text references public.posts(id) on delete set null;
alter table public.youtube_upload_queue add column if not exists post_publication_id text references public.post_publications(id) on delete set null;
alter table public.youtube_upload_queue add column if not exists created_by text references public.profiles(id) on delete set null;
alter table public.youtube_upload_queue add column if not exists asset_url text not null default '';
alter table public.youtube_upload_queue add column if not exists title text not null default '';
alter table public.youtube_upload_queue add column if not exists description text not null default '';
alter table public.youtube_upload_queue add column if not exists format text not null default 'video';
alter table public.youtube_upload_queue add column if not exists scheduled_at timestamptz;
alter table public.youtube_upload_queue add column if not exists thumbnail_url text;
alter table public.youtube_upload_queue add column if not exists allow_duplicate boolean not null default false;
alter table public.youtube_upload_queue add column if not exists status text not null default 'pending';
alter table public.youtube_upload_queue add column if not exists upload_url text;
alter table public.youtube_upload_queue add column if not exists bytes_uploaded bigint not null default 0;
alter table public.youtube_upload_queue add column if not exists file_size bigint not null default 0;
alter table public.youtube_upload_queue add column if not exists content_type text not null default 'video/mp4';
alter table public.youtube_upload_queue add column if not exists video_id text;
alter table public.youtube_upload_queue add column if not exists error_message text;
alter table public.youtube_upload_queue add column if not exists attempts integer not null default 0;
alter table public.youtube_upload_queue add column if not exists locked_at timestamptz;
alter table public.youtube_upload_queue add column if not exists last_heartbeat_at timestamptz;
alter table public.youtube_upload_queue add column if not exists next_attempt_at timestamptz;
alter table public.youtube_upload_queue add column if not exists completed_at timestamptz;
alter table public.youtube_upload_queue add column if not exists created_at timestamptz not null default now();
alter table public.youtube_upload_queue add column if not exists updated_at timestamptz not null default now();

create index if not exists youtube_upload_queue_org_status_idx
on public.youtube_upload_queue (organization_id, status, created_at);

create index if not exists youtube_upload_queue_post_idx
on public.youtube_upload_queue (organization_id, post_id, status);

alter table public.youtube_upload_queue enable row level security;

drop policy if exists "members read youtube upload queue" on public.youtube_upload_queue;
create policy "members read youtube upload queue" on public.youtube_upload_queue for select
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()::text
    and p.organization_id = youtube_upload_queue.organization_id
    and p.active = true
));

drop policy if exists "admins and managers create youtube upload queue" on public.youtube_upload_queue;
create policy "admins and managers create youtube upload queue" on public.youtube_upload_queue for insert
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()::text
    and p.organization_id = youtube_upload_queue.organization_id
    and p.active = true
    and p.role in ('admin', 'gestor')
));

drop policy if exists "admins and managers cancel youtube upload queue" on public.youtube_upload_queue;
create policy "admins and managers cancel youtube upload queue" on public.youtube_upload_queue for update
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()::text
    and p.organization_id = youtube_upload_queue.organization_id
    and p.active = true
    and p.role in ('admin', 'gestor')
))
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid()::text
    and p.organization_id = youtube_upload_queue.organization_id
    and p.active = true
    and p.role in ('admin', 'gestor')
));

grant select, insert, update on public.youtube_upload_queue to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.youtube_upload_queue;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- Production setup notes:
-- 1. Supabase Dashboard > Database > Webhooks:
--    create an INSERT webhook on public.youtube_upload_queue to call
--    https://<project-ref>.supabase.co/functions/v1/youtube-upload-processor
-- 2. Configure a pg_cron/pg_net fallback every 5 minutes to call the same Edge Function.
--    Keep secrets in Supabase Function secrets, not in this SQL file.
