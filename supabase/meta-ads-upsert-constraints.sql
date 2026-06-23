-- O importador Meta Ads usa ON CONFLICT sem predicado. Indices unicos
-- parciais nao servem para essa inferencia, entao usamos constraints completas.
drop index if exists public.ad_campaigns_org_account_external_idx;
alter table public.ad_campaigns
  add constraint ad_campaigns_org_account_external_key
  unique (organization_id, account_id, external_id);

drop index if exists public.ad_sets_org_campaign_external_idx;
alter table public.ad_sets
  add constraint ad_sets_org_campaign_external_key
  unique (organization_id, campaign_id, external_id);

drop index if exists public.ads_org_campaign_external_idx;
alter table public.ads
  add constraint ads_org_campaign_external_key
  unique (organization_id, campaign_id, external_id);
