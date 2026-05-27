alter table public.post_metrics add column if not exists thumbnail_url text;
alter table public.post_metrics add column if not exists source_url text;
alter table public.post_metrics add column if not exists embed_url text;
