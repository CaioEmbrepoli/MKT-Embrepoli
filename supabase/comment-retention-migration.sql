-- Stable 90-day retention for raw imported comments.
-- Run this in Supabase SQL Editor before deploying the app changes.

alter table public.comments add column if not exists import_signature text;
alter table public.comments add column if not exists retention_until timestamptz;
alter table public.comments add column if not exists processed_at timestamptz;
alter table public.comments add column if not exists is_relevant boolean;
alter table public.comments add column if not exists classification_status text;
alter table public.comments add column if not exists classification_reason text;

alter table public.comments drop constraint if exists comments_classification_status_check;
alter table public.comments add constraint comments_classification_status_check
check (classification_status is null or classification_status in ('pendente', 'relevante', 'normal', 'erro'));

update public.comments
set retention_until = coalesce(retention_until, created_at + interval '90 days')
where retention_until is null;

create index if not exists idx_comments_retention
on public.comments(organization_id, retention_until)
where retention_until is not null;

create unique index if not exists idx_comments_org_source_external_unique
on public.comments(organization_id, source, external_id)
where external_id is not null;

create unique index if not exists idx_comments_org_signature_unique
on public.comments(organization_id, import_signature)
where import_signature is not null;
