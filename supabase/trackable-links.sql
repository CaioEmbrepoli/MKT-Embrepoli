create table if not exists public.trackable_links (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  slug text not null unique,
  destination_url text not null,
  label text not null default '',
  click_count integer not null default 0,
  created_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trackable_link_clicks (
  id bigint generated always as identity primary key,
  link_id text not null references public.trackable_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text,
  user_agent text
);

create index if not exists trackable_link_clicks_link_id_idx on public.trackable_link_clicks (link_id);

alter table public.trackable_links enable row level security;

drop policy if exists "members read trackable links" on public.trackable_links;
create policy "members read trackable links" on public.trackable_links for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage trackable links" on public.trackable_links;
create policy "members manage trackable links" on public.trackable_links for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trackable_links'
  ) then
    alter publication supabase_realtime add table public.trackable_links;
  end if;
end $$;

create or replace function public.increment_trackable_link_clicks(p_link_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.trackable_links set click_count = click_count + 1, updated_at = now() where id = p_link_id;
$$;
