-- Fase 2: Identidade — persons e person_identifiers
-- persons: "cadastro vivo" da pessoa real, criado automaticamente via webhook
create table if not exists public.persons (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text,
  channel text not null default 'outro',
  channel_detail text,
  visitor_id text references public.visitors(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists persons_org_idx on public.persons (organization_id);
create index if not exists persons_visitor_idx on public.persons (visitor_id);

alter table public.persons enable row level security;

drop policy if exists "members read persons" on public.persons;
create policy "members read persons" on public.persons for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage persons" on public.persons;
create policy "members manage persons" on public.persons for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

-- person_identifiers: phone, email, cpf, etc. normalizados para deduplicação
create table if not exists public.person_identifiers (
  id bigint generated always as identity primary key,
  organization_id text not null references public.organizations(id) on delete cascade,
  person_id text not null references public.persons(id) on delete cascade,
  type text not null,
  value text not null,
  unique(organization_id, type, value)
);

create index if not exists person_identifiers_person_idx on public.person_identifiers (person_id);
create index if not exists person_identifiers_lookup_idx on public.person_identifiers (organization_id, type, value);

alter table public.person_identifiers enable row level security;

drop policy if exists "members read person identifiers" on public.person_identifiers;
create policy "members read person identifiers" on public.person_identifiers for select
using (organization_id = public.current_organization_id());

drop policy if exists "members manage person identifiers" on public.person_identifiers;
create policy "members manage person identifiers" on public.person_identifiers for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

-- RPC: upsert person via webhook (service definer, sem RLS)
-- Recebe phone normalizado; cria ou atualiza persons + person_identifiers
-- Retorna o person_id (existente ou novo)
create or replace function public.upsert_person_by_phone(
  p_org text,
  p_phone text,
  p_name text,
  p_channel text,
  p_channel_detail text,
  p_visitor_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id text;
begin
  -- Buscar person existente pelo phone
  select person_id into v_person_id
  from public.person_identifiers
  where organization_id = p_org
    and type = 'phone'
    and value = p_phone
  limit 1;

  if v_person_id is null then
    -- Criar novo person
    insert into public.persons (organization_id, name, channel, channel_detail, visitor_id)
    values (p_org, p_name, p_channel, p_channel_detail, p_visitor_id)
    returning id into v_person_id;

    -- Criar identifier
    insert into public.person_identifiers (organization_id, person_id, type, value)
    values (p_org, v_person_id, 'phone', p_phone)
    on conflict (organization_id, type, value) do nothing;
  else
    -- Atualizar dados se tiver informação nova
    update public.persons
    set
      name = coalesce(nullif(p_name, ''), name),
      visitor_id = coalesce(visitor_id, p_visitor_id),
      channel_detail = coalesce(channel_detail, p_channel_detail)
    where id = v_person_id;
  end if;

  return v_person_id;
end;
$$;
