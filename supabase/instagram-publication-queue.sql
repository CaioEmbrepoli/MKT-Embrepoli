alter table public.post_publications add column if not exists processing_stage text;
alter table public.post_publications add column if not exists instagram_creation_id text;
alter table public.post_publications add column if not exists prepared_asset_url text;
alter table public.post_publications add column if not exists prepared_content_type text;
alter table public.post_publications add column if not exists meta_status text;
alter table public.post_publications add column if not exists next_attempt_at timestamptz;
alter table public.post_publications add column if not exists last_heartbeat_at timestamptz;

create index if not exists post_publications_instagram_queue_idx
on public.post_publications (platform, status, next_attempt_at, scheduled_at)
where platform = 'instagram';
