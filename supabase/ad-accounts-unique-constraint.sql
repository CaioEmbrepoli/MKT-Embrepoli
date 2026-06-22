-- Corrige o upsert de ad_accounts (lib/meta-ads-server.ts usa
-- onConflict: "organization_id,platform,external_id"), mas a tabela só tinha
-- um índice único parcial (where external_id is not null), que o Postgres não
-- usa para inferência de ON CONFLICT (cols) sem WHERE. Isso causava o erro
-- recorrente "no unique or exclusion constraint matching the ON CONFLICT specification".

drop index if exists public.ad_accounts_org_platform_external_idx;

alter table public.ad_accounts
  add constraint ad_accounts_org_platform_external_key
  unique (organization_id, platform, external_id);
