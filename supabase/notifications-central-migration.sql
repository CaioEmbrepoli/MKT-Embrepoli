alter table public.notifications
  add column if not exists category text not null default 'system',
  add column if not exists priority text not null default 'normal',
  add column if not exists source text,
  add column if not exists event_key text,
  add column if not exists action_label text,
  add column if not exists archived_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_org_user_created_idx
on public.notifications (organization_id, user_id, created_at desc);

create index if not exists notifications_org_user_unread_idx
on public.notifications (organization_id, user_id, read, archived_at);

create unique index if not exists notifications_org_user_event_key_uidx
on public.notifications (organization_id, user_id, event_key)
where event_key is not null;
