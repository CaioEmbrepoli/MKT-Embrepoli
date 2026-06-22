create table if not exists public.tiktok_upload_queue (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text references public.posts(id) on delete set null,
  post_publication_id text references public.post_publications(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  asset_url text not null,
  title text not null default '',
  description text not null default '',
  format text not null default 'video',
  privacy_level text not null default 'PUBLIC_TO_EVERYONE',
  scheduled_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'processing', 'uploaded', 'failed', 'canceled')),
  publish_id text,
  upload_url text,
  bytes_uploaded bigint not null default 0,
  file_size bigint not null default 0,
  content_type text not null default 'video/mp4',
  error_message text,
  attempts integer not null default 0,
  locked_at timestamptz,
  last_heartbeat_at timestamptz,
  next_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tiktok_upload_queue_org_status_idx
on public.tiktok_upload_queue (organization_id, status, created_at);

create index if not exists tiktok_upload_queue_publication_idx
on public.tiktok_upload_queue (organization_id, post_publication_id, status);

alter table public.tiktok_upload_queue enable row level security;

drop policy if exists "members read tiktok upload queue" on public.tiktok_upload_queue;
create policy "members read tiktok upload queue" on public.tiktok_upload_queue for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers create tiktok upload queue" on public.tiktok_upload_queue;
create policy "admins and managers create tiktok upload queue" on public.tiktok_upload_queue for insert
with check (
  organization_id = public.current_organization_id()
  and public.current_member_role() in ('admin', 'gestor')
);

drop policy if exists "admins and managers cancel tiktok upload queue" on public.tiktok_upload_queue;
create policy "admins and managers cancel tiktok upload queue" on public.tiktok_upload_queue for update
using (
  organization_id = public.current_organization_id()
  and public.current_member_role() in ('admin', 'gestor')
)
with check (
  organization_id = public.current_organization_id()
  and public.current_member_role() in ('admin', 'gestor')
);

grant select, insert, update on public.tiktok_upload_queue to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tiktok_upload_queue'
  ) then
    alter publication supabase_realtime add table public.tiktok_upload_queue;
  end if;
end $$;

-- Produção: criar um Database Webhook de INSERT para chamar
-- https://<project-ref>.supabase.co/functions/v1/tiktok-upload-processor
-- e manter uma chamada GET periódica à Edge Function para recuperar jobs travados.
