-- Estrutura Marketing/Vendas: equipes, permissões por módulo e realtime.
-- Rode este arquivo no SQL Editor do Supabase para atualizar um banco existente.

create table if not exists public.profile_areas (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  area text not null check (area in ('marketing', 'vendas')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, area)
);

create table if not exists public.profile_module_permissions (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  area text not null check (area in ('marketing', 'vendas')),
  module_id text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_manage boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, area, module_id)
);

create or replace function public.has_area_access(required_area text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select p.active
      and (
        p.role = 'admin'
        or exists (
          select 1
          from public.profile_areas pa
          where pa.organization_id = p.organization_id
            and pa.profile_id = p.id
            and pa.area = required_area
            and pa.active = true
        )
      )
    from public.profiles p
    where p.id = auth.uid()::text
  ), false)
$$;

create or replace function public.has_module_permission(required_area text, required_module text, required_action text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select p.active
      and (
        p.role = 'admin'
        or (
          p.role = 'gestor'
          and public.has_area_access(required_area)
        )
        or exists (
          select 1
          from public.profile_module_permissions pmp
          where pmp.organization_id = p.organization_id
            and pmp.profile_id = p.id
            and pmp.area = required_area
            and pmp.module_id = required_module
            and case required_action
              when 'view' then pmp.can_view
              when 'create' then pmp.can_create
              when 'edit' then pmp.can_edit
              when 'delete' then pmp.can_delete
              when 'approve' then pmp.can_approve
              when 'manage' then pmp.can_manage
              else false
            end
        )
      )
    from public.profiles p
    where p.id = auth.uid()::text
  ), false)
$$;

create or replace function public.can_manage_team_permissions()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select p.active and p.role in ('admin', 'gestor')
    from public.profiles p
    where p.id = auth.uid()::text
  ), false)
$$;

alter table public.profile_areas enable row level security;
alter table public.profile_module_permissions enable row level security;

drop policy if exists "members can read profile areas" on public.profile_areas;
create policy "members can read profile areas"
on public.profile_areas for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers can manage profile areas" on public.profile_areas;
create policy "admins and managers can manage profile areas"
on public.profile_areas for all
using (organization_id = public.current_organization_id() and public.can_manage_team_permissions())
with check (organization_id = public.current_organization_id() and public.can_manage_team_permissions());

drop policy if exists "members can read module permissions" on public.profile_module_permissions;
create policy "members can read module permissions"
on public.profile_module_permissions for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers can manage module permissions" on public.profile_module_permissions;
create policy "admins and managers can manage module permissions"
on public.profile_module_permissions for all
using (organization_id = public.current_organization_id() and public.can_manage_team_permissions())
with check (organization_id = public.current_organization_id() and public.can_manage_team_permissions());

insert into public.profile_areas (id, organization_id, profile_id, area, active)
select p.id || ':marketing', p.organization_id, p.id, 'marketing', true
from public.profiles p
where p.organization_id = '00000000-0000-0000-0000-000000000001'
  and p.active = true
  and p.role in ('admin', 'gestor')
on conflict (profile_id, area) do nothing;

insert into public.profile_areas (id, organization_id, profile_id, area, active)
select p.id || ':vendas', p.organization_id, p.id, 'vendas', true
from public.profiles p
where p.organization_id = '00000000-0000-0000-0000-000000000001'
  and p.active = true
  and p.role = 'admin'
on conflict (profile_id, area) do nothing;

with modules(area, module_id) as (
  values
    ('marketing', 'painel'),
    ('marketing', 'calendario'),
    ('marketing', 'ideias'),
    ('marketing', 'tarefas'),
    ('marketing', 'revisoes'),
    ('marketing', 'campanhas'),
    ('marketing', 'metricas'),
    ('marketing', 'comentarios'),
    ('marketing', 'banco-duvidas'),
    ('marketing', 'configuracoes'),
    ('vendas', 'painel'),
    ('vendas', 'clientes'),
    ('vendas', 'leads'),
    ('vendas', 'funil-comercial'),
    ('vendas', 'atividades'),
    ('vendas', 'propostas'),
    ('vendas', 'configuracoes')
)
insert into public.profile_module_permissions (
  id, organization_id, profile_id, area, module_id,
  can_view, can_create, can_edit, can_delete, can_approve, can_manage
)
select
  p.id || ':' || modules.area || ':' || modules.module_id,
  p.organization_id,
  p.id,
  modules.area,
  modules.module_id,
  true,
  true,
  true,
  true,
  true,
  true
from public.profiles p
join modules on p.role = 'admin' or modules.area = 'marketing'
where p.organization_id = '00000000-0000-0000-0000-000000000001'
  and p.active = true
  and p.role in ('admin', 'gestor')
on conflict (profile_id, area, module_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profile_areas'
  ) then
    alter publication supabase_realtime add table public.profile_areas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profile_module_permissions'
  ) then
    alter publication supabase_realtime add table public.profile_module_permissions;
  end if;
end $$;
