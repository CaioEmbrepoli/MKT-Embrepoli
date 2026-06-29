create index if not exists ad_insights_daily_org_date_idx
on public.ad_insights_daily (organization_id, date desc);

create index if not exists tracking_touchpoints_org_occurredat_idx
on public.tracking_touchpoints (organization_id, occurred_at desc);

create index if not exists comments_org_status_createdat_idx
on public.comments (organization_id, status, created_at desc);
