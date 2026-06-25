-- O indice unico ad_insights_daily_unique_idx (meta-ads-foundation.sql) usa
-- coalesce() em colunas nullable, o que o onConflict do PostgREST/Supabase nao
-- consegue casar diretamente num upsert. Substitui por uma coluna dedup_key
-- (mesma chave logica, gerada em TS) com constraint unica simples.

alter table public.ad_insights_daily add column if not exists dedup_key text;

update public.ad_insights_daily
set dedup_key = concat_ws('|',
  organization_id,
  platform,
  account_id,
  coalesce(campaign_id, ''),
  coalesce(ad_set_id, ''),
  coalesce(ad_id, ''),
  date::text,
  coalesce(breakdown_placement, ''),
  coalesce(breakdown_age, ''),
  coalesce(breakdown_gender, ''),
  coalesce(breakdown_region, ''),
  coalesce(breakdown_device, '')
)
where dedup_key is null;

alter table public.ad_insights_daily alter column dedup_key set not null;

drop index if exists public.ad_insights_daily_unique_idx;

create unique index if not exists ad_insights_daily_dedup_key_idx
on public.ad_insights_daily (dedup_key);
