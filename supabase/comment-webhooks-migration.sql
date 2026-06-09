create table if not exists public.comment_webhook_events (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('youtube', 'instagram', 'facebook', 'tiktok')),
  event_id text,
  external_comment_id text,
  external_media_id text,
  event_type text not null default 'comment',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

drop index if exists comment_webhook_events_org_source_event_uidx;
create unique index if not exists comment_webhook_events_org_source_event_uidx
on public.comment_webhook_events (organization_id, source, event_id);

create index if not exists comment_webhook_events_org_source_created_idx
on public.comment_webhook_events (organization_id, source, created_at desc);

create index if not exists comment_webhook_events_unprocessed_idx
on public.comment_webhook_events (organization_id, source, created_at)
where processed_at is null;

alter table public.comment_webhook_events enable row level security;

drop policy if exists "org members can read comment webhook events" on public.comment_webhook_events;

create policy "org members can read comment webhook events"
on public.comment_webhook_events
for select
using (organization_id = public.current_organization_id());

do $$
begin
  alter publication supabase_realtime add table public.comment_webhook_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
