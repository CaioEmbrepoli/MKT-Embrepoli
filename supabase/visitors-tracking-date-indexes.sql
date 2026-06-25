create index if not exists visitors_org_lastseen_idx
on public.visitors (organization_id, last_seen_at desc);

create index if not exists tracking_sessions_org_startedat_idx
on public.tracking_sessions (organization_id, started_at desc);
