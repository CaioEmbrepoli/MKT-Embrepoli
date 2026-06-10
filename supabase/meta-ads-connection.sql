alter table public.meta_connections add column if not exists ad_account_id text;
alter table public.meta_connections add column if not exists ad_account_name text;
alter table public.meta_connections add column if not exists business_id text;
alter table public.meta_connections alter column instagram_account_id drop not null;

alter table public.meta_connections drop constraint if exists meta_connections_service_check;
alter table public.meta_connections
  add constraint meta_connections_service_check check (service in ('instagram', 'ads'));

comment on column public.meta_connections.ad_account_id is 'Meta Ads account id selected for the organization connection.';
comment on column public.meta_connections.ad_account_name is 'Human-readable Meta Ads account name.';
comment on column public.meta_connections.business_id is 'Meta Business id associated with the ads connection when available.';
