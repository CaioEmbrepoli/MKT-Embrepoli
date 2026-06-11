alter table public.comments add column if not exists response_external_id text;
alter table public.comments add column if not exists response_history jsonb not null default '[]'::jsonb;
