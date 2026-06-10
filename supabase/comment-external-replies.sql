alter table public.comments add column if not exists external_replies jsonb not null default '[]'::jsonb;
