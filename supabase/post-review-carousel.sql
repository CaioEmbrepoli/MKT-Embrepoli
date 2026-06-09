alter table public.post_review_assets add column if not exists carousel_group_id text;
alter table public.post_review_assets add column if not exists carousel_order integer;

create index if not exists post_review_assets_carousel_idx
  on public.post_review_assets (organization_id, post_id, carousel_group_id, carousel_order)
  where carousel_group_id is not null;
