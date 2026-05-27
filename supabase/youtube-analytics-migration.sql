alter table public.post_metrics add column if not exists external_id text;
alter table public.post_metrics add column if not exists video_type text;
alter table public.post_metrics add column if not exists privacy_status text;
alter table public.post_metrics add column if not exists watch_time_minutes numeric;
alter table public.post_metrics add column if not exists average_view_duration_seconds numeric;
alter table public.post_metrics add column if not exists average_view_percentage numeric;
alter table public.post_metrics add column if not exists subscribers_gained integer;
alter table public.post_metrics add column if not exists subscribers_lost integer;
alter table public.post_metrics add column if not exists impressions integer;
alter table public.post_metrics add column if not exists impression_click_through_rate numeric;
alter table public.post_metrics add column if not exists thumbnail_url text;
alter table public.post_metrics add column if not exists source_url text;
alter table public.post_metrics add column if not exists embed_url text;

create unique index if not exists post_metrics_external_id_idx
on public.post_metrics (external_id);
