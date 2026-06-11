alter table public.post_publications add column if not exists carousel_assets jsonb not null default '[]'::jsonb;
