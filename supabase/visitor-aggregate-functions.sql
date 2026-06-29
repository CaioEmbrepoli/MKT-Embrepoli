-- Agregados de visitantes calculados no Postgres em vez de baixar linhas
-- cruas pro navegador (reduz Egress do Supabase). Sem security definer —
-- rodam com a permissao de quem chama, entao a RLS ja existente em
-- visitors/tracking_sessions (organization_id = current_organization_id())
-- continua protegendo os dados independente do p_org_id passado.

create or replace function public.count_visitors_in_range(
  p_org_id text,
  p_since timestamptz,
  p_until timestamptz
)
returns integer
language sql
stable
as $$
  select case
    when p_since is null then
      (select count(*)::integer from public.visitors where organization_id = p_org_id)
    else
      (select count(distinct visitor_id)::integer from public.tracking_sessions
       where organization_id = p_org_id
         and started_at >= p_since
         and started_at < p_until)
  end
$$;

create or replace function public.visitor_sources_in_range(
  p_org_id text,
  p_since timestamptz,
  p_until timestamptz,
  p_limit integer default 5
)
returns table(source text, medium text, visitor_count integer)
language sql
stable
as $$
  with ranged as (
    select
      coalesce(ts.utm_source, v.first_touch_source) as source,
      coalesce(ts.utm_medium, v.first_touch_medium) as medium,
      ts.visitor_id as visitor_id
    from public.tracking_sessions ts
    join public.visitors v on v.id = ts.visitor_id
    where ts.organization_id = p_org_id
      and p_since is not null
      and ts.started_at >= p_since
      and ts.started_at < p_until
  ),
  unranged as (
    select
      v.first_touch_source as source,
      v.first_touch_medium as medium,
      v.id as visitor_id
    from public.visitors v
    where v.organization_id = p_org_id
      and p_since is null
  )
  select source, medium, count(distinct visitor_id)::integer as visitor_count
  from (select * from ranged union all select * from unranged) combined
  group by source, medium
  order by visitor_count desc
  limit p_limit
$$;

grant execute on function public.count_visitors_in_range(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.visitor_sources_in_range(text, timestamptz, timestamptz, integer) to authenticated;
