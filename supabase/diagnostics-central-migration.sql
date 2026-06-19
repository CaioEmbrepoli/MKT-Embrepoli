alter table public.error_logs
  add column if not exists category text not null default 'integration',
  add column if not exists severity text not null default 'error',
  add column if not exists event_key text,
  add column if not exists title text,
  add column if not exists target_kind text,
  add column if not exists target_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists last_seen_at timestamptz,
  add column if not exists resolved_at timestamptz;

update public.error_logs
set last_seen_at = created_at
where last_seen_at is null;

create index if not exists error_logs_org_category_created_idx
  on public.error_logs (organization_id, category, created_at desc);

create index if not exists error_logs_org_severity_created_idx
  on public.error_logs (organization_id, severity, created_at desc);

create unique index if not exists error_logs_org_event_key_uidx
  on public.error_logs (organization_id, event_key)
  where event_key is not null;

create or replace function public.upsert_error_log_event(
  p_organization_id text,
  p_provider text,
  p_service text,
  p_error_code text,
  p_user_message text,
  p_technical_message text,
  p_action text,
  p_profile_id text,
  p_category text,
  p_severity text,
  p_event_key text,
  p_title text,
  p_target_kind text,
  p_target_id text,
  p_metadata jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.error_logs (
    organization_id, provider, service, error_code, user_message,
    technical_message, action, profile_id, category, severity,
    event_key, title, target_kind, target_id, metadata,
    occurrence_count, last_seen_at, created_at
  ) values (
    p_organization_id, p_provider, p_service, p_error_code, p_user_message,
    p_technical_message, p_action, p_profile_id, coalesce(p_category, 'integration'),
    coalesce(p_severity, 'error'), nullif(p_event_key, ''), p_title,
    p_target_kind, p_target_id, coalesce(p_metadata, '{}'::jsonb),
    1, now(), now()
  )
  on conflict (organization_id, event_key) where event_key is not null
  do update set
    provider = excluded.provider,
    service = excluded.service,
    error_code = excluded.error_code,
    user_message = excluded.user_message,
    technical_message = excluded.technical_message,
    action = excluded.action,
    profile_id = excluded.profile_id,
    category = excluded.category,
    severity = excluded.severity,
    title = excluded.title,
    target_kind = excluded.target_kind,
    target_id = excluded.target_id,
    metadata = excluded.metadata,
    occurrence_count = public.error_logs.occurrence_count + 1,
    last_seen_at = now(),
    resolved_at = null
  returning id into v_id;
  return v_id;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.error_logs;
exception
  when duplicate_object then null;
end $$;
