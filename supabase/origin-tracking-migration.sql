-- Fase 1: Rastreamento de Origem de Leads
-- visitors: um registro por visitante anônimo (UUID persistido no localStorage)
create table if not exists public.visitors (
  id text primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  first_touch_source text,
  first_touch_medium text,
  first_touch_campaign text,
  first_touch_referrer text,
  first_touch_fbclid text,
  first_touch_gclid text,
  first_touch_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  session_count integer not null default 1
);

create index if not exists visitors_org_idx on public.visitors (organization_id);
create index if not exists visitors_source_idx on public.visitors (organization_id, first_touch_source);

alter table public.visitors enable row level security;

drop policy if exists "members read visitors" on public.visitors;
create policy "members read visitors" on public.visitors for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage visitors" on public.visitors;
create policy "members manage visitors" on public.visitors for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

-- tracking_sessions: cada visita/retorno — last touch é a sessão mais recente
create table if not exists public.tracking_sessions (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  visitor_id text not null references public.visitors(id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  fbclid text,
  gclid text,
  landing_page text,
  started_at timestamptz not null default now()
);

create index if not exists tracking_sessions_visitor_idx on public.tracking_sessions (visitor_id);
create index if not exists tracking_sessions_org_idx on public.tracking_sessions (organization_id);

alter table public.tracking_sessions enable row level security;

drop policy if exists "members read tracking sessions" on public.tracking_sessions;
create policy "members read tracking sessions" on public.tracking_sessions for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage tracking sessions" on public.tracking_sessions;
create policy "members manage tracking sessions" on public.tracking_sessions for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

-- tracking_touchpoints: eventos dentro de uma sessão (clique no WA, etc.)
create table if not exists public.tracking_touchpoints (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  visitor_id text not null references public.visitors(id) on delete cascade,
  session_id text references public.tracking_sessions(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

create index if not exists tracking_touchpoints_visitor_idx on public.tracking_touchpoints (visitor_id);
create index if not exists tracking_touchpoints_org_idx on public.tracking_touchpoints (organization_id);

alter table public.tracking_touchpoints enable row level security;

drop policy if exists "members read tracking touchpoints" on public.tracking_touchpoints;
create policy "members read tracking touchpoints" on public.tracking_touchpoints for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage tracking touchpoints" on public.tracking_touchpoints;
create policy "members manage tracking touchpoints" on public.tracking_touchpoints for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

-- RPC: upsert visitor preservando first touch, sempre criando nova sessão
create or replace function public.upsert_visitor(
  p_id text,
  p_org text,
  p_source text,
  p_medium text,
  p_campaign text,
  p_referrer text,
  p_fbclid text,
  p_gclid text,
  p_page text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitors (
    id, organization_id,
    first_touch_source, first_touch_medium, first_touch_campaign,
    first_touch_referrer, first_touch_fbclid, first_touch_gclid
  )
  values (
    p_id, p_org,
    p_source, p_medium, p_campaign,
    p_referrer, p_fbclid, p_gclid
  )
  on conflict (id) do update set
    last_seen_at = now(),
    session_count = visitors.session_count + 1;

  insert into public.tracking_sessions (
    organization_id, visitor_id,
    utm_source, utm_medium, utm_campaign,
    referrer, fbclid, gclid, landing_page
  )
  values (
    p_org, p_id,
    p_source, p_medium, p_campaign,
    p_referrer, p_fbclid, p_gclid, p_page
  );
$$;
