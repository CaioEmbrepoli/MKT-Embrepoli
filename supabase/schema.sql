create extension if not exists "pgcrypto";

drop type if exists public.member_role cascade;
drop type if exists public.post_status cascade;
drop type if exists public.task_status cascade;
drop type if exists public.campaign_status cascade;
drop type if exists public.task_priority cascade;
drop type if exists public.task_progress cascade;

create type public.member_role as enum ('admin', 'gestor', 'colaborador');
create type public.post_status as enum ('Ideia', 'Produção', 'Revisão', 'Aprovado', 'Agendado', 'Publicado');
create type public.task_status as enum ('A fazer', 'Em andamento', 'Em revisão', 'Concluído');
create type public.campaign_status as enum ('Planejada', 'Ativa', 'Pausada', 'Encerrada');
create type public.task_priority as enum ('Alta', 'Média', 'Baixa');
create type public.task_progress as enum ('Bloqueada', 'No prazo', 'Atenção', 'Finalizando');

create table if not exists public.organizations (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id text primary key default auth.uid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null default '',
  email text not null,
  phone text not null default '',
  bio text not null default '',
  role public.member_role not null default 'colaborador',
  avatar_url text not null default '',
  active boolean not null default false,
  notification_sound boolean not null default true,
  approved_at timestamptz,
  approved_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.channels (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  created_at timestamptz not null default now()
);

create table if not exists public.product_lines (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_types (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_types (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.funnel_stages (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.task_boards (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order integer not null default 1,
  is_fixed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.task_columns (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_board_id text references public.task_boards(id) on delete cascade,
  name text not null,
  color text not null default '#dbeafe',
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  product_line_id text references public.product_lines(id) on delete set null,
  vehicle_type_id text references public.vehicle_types(id) on delete set null,
  funnel_stage_id text references public.funnel_stages(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  name text not null,
  objective text not null default '',
  audience text not null default '',
  message text not null default '',
  start_date date,
  end_date date,
  status public.campaign_status not null default 'Planejada',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_audiences (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_templates (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  content_type_id text references public.content_types(id) on delete set null,
  channel_id text references public.channels(id) on delete set null,
  format text not null default '',
  suggested_time text not null default '',
  funnel_stage_id text references public.funnel_stages(id) on delete set null,
  structure text not null default '',
  checklist text not null default '',
  structure_items jsonb not null default '[]'::jsonb,
  checklist_items jsonb not null default '[]'::jsonb,
  visual_guidance text not null default '',
  caption_example text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.campaign_assignees (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  unique (campaign_id, profile_id)
);

create table if not exists public.posts (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  channel_id text references public.channels(id) on delete set null,
  campaign_id text references public.campaigns(id) on delete set null,
  product_line_id text references public.product_lines(id) on delete set null,
  vehicle_type_id text references public.vehicle_types(id) on delete set null,
  content_type_id text references public.content_types(id) on delete set null,
  funnel_stage_id text references public.funnel_stages(id) on delete set null,
  template_id text references public.post_templates(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  title text not null,
  status public.post_status not null default 'Ideia',
  format text not null default 'Post',
  sort_order integer not null default 1,
  publish_at timestamptz,
  description text not null default '',
  production_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.post_assignees (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text not null references public.posts(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  unique (post_id, profile_id)
);

create table if not exists public.post_review_assets (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text not null references public.posts(id) on delete cascade,
  uploaded_by text references public.profiles(id) on delete set null,
  reviewed_by text references public.profiles(id) on delete set null,
  name text not null,
  file_type text not null,
  source text not null default 'upload',
  storage_path text not null,
  public_url text not null default '',
  preview_url text not null default '',
  original_size bigint not null default 0,
  compressed_size bigint not null default 0,
  mime_type text not null default '',
  status text not null default 'Aguardando revisão',
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.post_review_comments (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  asset_id text not null references public.post_review_assets(id) on delete cascade,
  post_id text not null references public.posts(id) on delete cascade,
  author_id text references public.profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  channel_id text references public.channels(id) on delete set null,
  product_line_id text references public.product_lines(id) on delete set null,
  vehicle_type_id text references public.vehicle_types(id) on delete set null,
  content_type_id text references public.content_types(id) on delete set null,
  funnel_stage_id text references public.funnel_stages(id) on delete set null,
  template_id text references public.post_templates(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  title text not null,
  description text not null default '',
  type text not null default 'Postagem',
  format text not null default 'Post',
  priority text not null default 'Média',
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.idea_attachments (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  idea_id text not null references public.ideas(id) on delete cascade,
  uploaded_by text references public.profiles(id) on delete set null,
  name text not null,
  file_type text not null,
  source text not null default 'upload',
  storage_path text not null,
  public_url text not null default '',
  preview_url text not null default '',
  original_size bigint not null default 0,
  compressed_size bigint not null default 0,
  mime_type text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_dates (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  date date,
  type text not null default 'Data comemorativa',
  color text not null default '#2563eb',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.idea_assignees (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  idea_id text not null references public.ideas(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  unique (idea_id, profile_id)
);

create table if not exists public.tasks (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text references public.posts(id) on delete set null,
  campaign_id text references public.campaigns(id) on delete set null,
  parent_task_id text references public.tasks(id) on delete cascade,
  task_column_id text references public.task_columns(id) on delete set null,
  funnel_stage_id text references public.funnel_stages(id) on delete set null,
  created_by text references public.profiles(id) on delete set null,
  title text not null,
  status public.task_status not null default 'A fazer',
  priority public.task_priority not null default 'Média',
  progress public.task_progress not null default 'No prazo',
  related_to text not null default '',
  description text not null default '',
  due_date date,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.task_assignees (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  unique (task_id, profile_id)
);

create table if not exists public.task_checklist_items (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  author_id text references public.profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_attachments (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  uploaded_by text references public.profiles(id) on delete set null,
  name text not null,
  file_type text not null,
  source text not null default 'upload',
  storage_path text not null,
  public_url text not null default '',
  preview_url text not null default '',
  original_size bigint not null default 0,
  compressed_size bigint not null default 0,
  mime_type text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.task_reset_history (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  task_id text references public.tasks(id) on delete set null,
  reset_source_id text references public.tasks(id) on delete set null,
  frequency text not null,
  scheduled_for timestamptz,
  executed_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.post_metrics (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text references public.posts(id) on delete set null,
  channel_id text references public.channels(id) on delete set null,
  campaign_id text references public.campaigns(id) on delete set null,
  product_line_id text references public.product_lines(id) on delete set null,
  vehicle_type_id text references public.vehicle_types(id) on delete set null,
  content_type_id text references public.content_types(id) on delete set null,
  funnel_stage_id text references public.funnel_stages(id) on delete set null,
  post_title text not null,
  metric_date date not null default current_date,
  reach integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  clicks integer not null default 0,
  leads integer not null default 0,
  notes text not null default '',
  learning text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  read boolean not null default false,
  target_kind text not null,
  target_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.google_connections (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  service text not null default 'drive',
  google_email text not null default '',
  scopes text[] not null default '{}'::text[],
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  connected_by text references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, service),
  constraint google_connections_service_check check (service in ('drive', 'youtube'))
);

alter table public.google_connections add column if not exists service text not null default 'drive';
alter table public.google_connections drop constraint if exists google_connections_organization_id_key;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'google_connections_service_check'
      and conrelid = 'public.google_connections'::regclass
  ) then
    alter table public.google_connections
      add constraint google_connections_service_check check (service in ('drive', 'youtube'));
  end if;
end $$;
create unique index if not exists google_connections_organization_service_idx
on public.google_connections (organization_id, service);

alter table public.profiles add column if not exists notification_sound boolean not null default true;
alter table public.campaigns add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.posts add column if not exists sort_order integer not null default 1;
alter table public.posts add column if not exists format text not null default 'Post';
alter table public.posts add column if not exists idea_id text references public.ideas(id) on delete set null;
alter table public.posts add column if not exists template_id text references public.post_templates(id) on delete set null;
alter table public.posts add column if not exists production_checklist jsonb not null default '[]'::jsonb;
alter table public.ideas add column if not exists sort_order integer not null default 1;
alter table public.ideas add column if not exists description text not null default '';
alter table public.ideas add column if not exists template_id text references public.post_templates(id) on delete set null;
alter table public.ideas add column if not exists format text not null default 'Post';
alter table public.post_templates add column if not exists structure_items jsonb not null default '[]'::jsonb;
alter table public.post_templates add column if not exists checklist_items jsonb not null default '[]'::jsonb;
alter table public.post_templates add column if not exists suggested_time text not null default '';
alter table public.post_metrics add column if not exists campaign_id text references public.campaigns(id) on delete set null;
alter table public.post_metrics add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.post_metrics add column if not exists content_type_id text references public.content_types(id) on delete set null;
alter table public.post_metrics add column if not exists metric_date date not null default current_date;
alter table public.post_metrics add column if not exists learning text not null default '';

-- Histórico de snapshots de métricas (capturado antes de cada reimport do YouTube)
create table if not exists public.post_metric_snapshots (
  id              text        primary key default gen_random_uuid()::text,
  organization_id text        not null references public.organizations(id) on delete cascade,
  metric_id       text        not null references public.post_metrics(id) on delete cascade,
  captured_at     timestamptz not null default now(),
  reach           integer     not null default 0,
  likes           integer     not null default 0,
  comments        integer     not null default 0,
  shares          integer     not null default 0,
  clicks          integer     not null default 0,
  leads           integer     not null default 0
);
alter table public.post_metric_snapshots enable row level security;
create policy "members read own snapshots" on public.post_metric_snapshots for select
  using (organization_id = current_organization_id());
create policy "members insert own snapshots" on public.post_metric_snapshots for insert
  with check (organization_id = current_organization_id());

alter table public.posts add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.posts add column if not exists content_type_id text references public.content_types(id) on delete set null;
alter table public.ideas add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.ideas add column if not exists content_type_id text references public.content_types(id) on delete set null;
alter table public.post_review_assets add column if not exists source text not null default 'upload';
alter table public.post_review_assets add column if not exists preview_url text not null default '';
alter table public.post_review_assets add column if not exists original_size bigint not null default 0;
alter table public.post_review_assets add column if not exists compressed_size bigint not null default 0;
alter table public.post_review_assets add column if not exists mime_type text not null default '';
alter table public.task_attachments add column if not exists source text not null default 'upload';
alter table public.task_attachments add column if not exists preview_url text not null default '';
alter table public.task_attachments add column if not exists original_size bigint not null default 0;
alter table public.task_attachments add column if not exists compressed_size bigint not null default 0;
alter table public.task_attachments add column if not exists mime_type text not null default '';
alter table public.tasks add column if not exists reset_frequency text not null default 'none';
alter table public.tasks add column if not exists reset_time text not null default '23:59';
alter table public.tasks add column if not exists reset_weekday integer;
alter table public.tasks add column if not exists reset_month_day integer;
alter table public.tasks add column if not exists reset_month_last_day boolean not null default false;
alter table public.tasks add column if not exists fixed_goal_key text;
alter table public.tasks add column if not exists reset_source_id text references public.tasks(id) on delete set null;
alter table public.tasks add column if not exists last_reset_at timestamptz;
alter table public.tasks add column if not exists next_reset_at timestamptz;

create or replace function public.current_organization_id()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid()::text
$$;

create or replace function public.current_member_role()
returns public.member_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()::text
$$;

create or replace function public.can_access_item(created_by text, assigned_to text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_member_role() in ('admin', 'gestor')
    or auth.uid()::text = created_by
    or auth.uid()::text = assigned_to
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, organization_id, name, email, role, active)
  values (
    new.id::text,
    '00000000-0000-0000-0000-000000000001',
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Novo usuário'),
    coalesce(new.email, ''),
    'colaborador',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.product_lines enable row level security;
alter table public.vehicle_types enable row level security;
alter table public.content_types enable row level security;
alter table public.funnel_stages enable row level security;
alter table public.task_boards enable row level security;
alter table public.task_columns enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_audiences enable row level security;
alter table public.post_templates enable row level security;
alter table public.posts enable row level security;
alter table public.post_review_assets enable row level security;
alter table public.post_review_comments enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_attachments enable row level security;
alter table public.calendar_dates enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.campaign_assignees enable row level security;
alter table public.post_assignees enable row level security;
alter table public.idea_assignees enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_reset_history enable row level security;
alter table public.post_metrics enable row level security;
alter table public.notifications enable row level security;
alter table public.google_connections enable row level security;

drop policy if exists "members can read own organization" on public.organizations;
create policy "members can read own organization"
on public.organizations for select
using (id = public.current_organization_id());

drop policy if exists "members can read profiles" on public.profiles;
create policy "members can read profiles"
on public.profiles for select
using (organization_id = public.current_organization_id());

drop policy if exists "users can read own pending profile" on public.profiles;
create policy "users can read own pending profile"
on public.profiles for select
using (id = auth.uid()::text);

drop policy if exists "users can create own pending profile" on public.profiles;
create policy "users can create own pending profile"
on public.profiles for insert
with check (
  id = auth.uid()::text
  and organization_id = '00000000-0000-0000-0000-000000000001'
  and role = 'colaborador'
  and active = false
);

drop policy if exists "admins and managers can manage profiles" on public.profiles;
create policy "admins and managers can manage profiles"
on public.profiles for all
using (public.current_member_role() in ('admin', 'gestor') and organization_id = public.current_organization_id())
with check (public.current_member_role() in ('admin', 'gestor') and organization_id = public.current_organization_id());

create policy "members manage channels" on public.channels for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage product lines" on public.product_lines for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage vehicle types" on public.vehicle_types for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage content types" on public.content_types for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage funnel stages" on public.funnel_stages for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task boards" on public.task_boards for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task columns" on public.task_columns for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "role scoped campaigns" on public.campaigns for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage campaign audiences" on public.campaign_audiences for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage post templates" on public.post_templates for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "role scoped posts" on public.posts for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage post review assets" on public.post_review_assets for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage post review comments" on public.post_review_comments for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "role scoped ideas" on public.ideas for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage idea attachments" on public.idea_attachments for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage calendar dates" on public.calendar_dates for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "role scoped tasks" on public.tasks for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task assignees" on public.task_assignees for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage campaign assignees" on public.campaign_assignees for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage post assignees" on public.post_assignees for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage idea assignees" on public.idea_assignees for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task checklist" on public.task_checklist_items for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task comments" on public.task_comments for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task attachments" on public.task_attachments for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage task reset history" on public.task_reset_history for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage metrics" on public.post_metrics for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage own notifications" on public.notifications for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members read google connection status" on public.google_connections;
create policy "members read google connection status" on public.google_connections for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage google connection" on public.google_connections;
create policy "admins and managers manage google connection" on public.google_connections for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Embrepoli')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values
  ('task-attachments', 'task-attachments', true),
  ('idea-attachments', 'idea-attachments', true),
  ('profile-avatars', 'profile-avatars', true),
  ('post-review-assets', 'post-review-assets', true)
on conflict (id) do nothing;

drop policy if exists "authenticated can read embrepoli storage" on storage.objects;
create policy "authenticated can read embrepoli storage"
on storage.objects for select
to authenticated
using (bucket_id in ('task-attachments', 'idea-attachments', 'profile-avatars', 'post-review-assets'));

drop policy if exists "authenticated can upload embrepoli storage" on storage.objects;
create policy "authenticated can upload embrepoli storage"
on storage.objects for insert
to authenticated
with check (bucket_id in ('task-attachments', 'idea-attachments', 'profile-avatars', 'post-review-assets'));

drop policy if exists "authenticated can update embrepoli storage" on storage.objects;
create policy "authenticated can update embrepoli storage"
on storage.objects for update
to authenticated
using (bucket_id in ('task-attachments', 'idea-attachments', 'profile-avatars', 'post-review-assets'))
with check (bucket_id in ('task-attachments', 'idea-attachments', 'profile-avatars', 'post-review-assets'));

drop policy if exists "authenticated can delete embrepoli storage" on storage.objects;
create policy "authenticated can delete embrepoli storage"
on storage.objects for delete
to authenticated
using (bucket_id in ('task-attachments', 'idea-attachments', 'profile-avatars', 'post-review-assets'));

insert into public.funnel_stages (id, organization_id, name, color, sort_order)
values
  ('topo', '00000000-0000-0000-0000-000000000001', 'Topo - Descoberta', '#38bdf8', 1),
  ('meio', '00000000-0000-0000-0000-000000000001', 'Meio - Interesse', '#2563eb', 2),
  ('fundo', '00000000-0000-0000-0000-000000000001', 'Fundo - Decisão', '#1d4ed8', 3),
  ('pos', '00000000-0000-0000-0000-000000000001', 'Pós-venda - Relacionamento', '#334155', 4)
on conflict (id) do nothing;

insert into public.task_boards (id, organization_id, name, sort_order, is_fixed)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Tarefas', 1, true),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Metas', 2, true);

insert into public.task_columns (organization_id, task_board_id, name, color, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'A fazer', '#dbeafe', 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Em andamento', '#cffafe', 2),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Em revisão', '#e0e7ff', 3),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Concluído', '#dcfce7', 4),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'A fazer', '#dbeafe', 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Em andamento', '#cffafe', 2),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Em revisão', '#e0e7ff', 3),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'Concluído', '#dcfce7', 4);

with metas_column as (
  select id
  from public.task_columns
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and task_board_id = '00000000-0000-0000-0000-000000000102'
    and name = 'A fazer'
  order by created_at
  limit 1
)
insert into public.tasks (
  id, organization_id, task_column_id, funnel_stage_id, created_by, title, priority, progress,
  related_to, description, due_date, sort_order, reset_frequency, reset_time, reset_weekday,
  reset_month_last_day, fixed_goal_key, next_reset_at
)
select
  'goal-weekly-schedule',
  '00000000-0000-0000-0000-000000000001',
  metas_column.id,
  'topo',
  null,
  'Organizar agendamento semanal',
  'Alta',
  'No prazo',
  'Metas',
  'Planejar e revisar os posts da semana antes do fechamento do domingo.',
  '2026-05-17',
  1,
  'weekly',
  '23:59',
  0,
  false,
  'weekly_schedule',
  '2026-05-18T02:59:00.000Z'::timestamptz
from metas_column
on conflict (id) do update set
  fixed_goal_key = excluded.fixed_goal_key,
  reset_frequency = excluded.reset_frequency,
  reset_time = excluded.reset_time,
  reset_weekday = excluded.reset_weekday,
  next_reset_at = coalesce(public.tasks.next_reset_at, excluded.next_reset_at);

with metas_column as (
  select id
  from public.task_columns
  where organization_id = '00000000-0000-0000-0000-000000000001'
    and task_board_id = '00000000-0000-0000-0000-000000000102'
    and name = 'A fazer'
  order by created_at
  limit 1
)
insert into public.tasks (
  id, organization_id, task_column_id, funnel_stage_id, created_by, title, priority, progress,
  related_to, description, due_date, sort_order, reset_frequency, reset_time,
  reset_month_last_day, fixed_goal_key, next_reset_at
)
select
  'goal-monthly-targets',
  '00000000-0000-0000-0000-000000000001',
  metas_column.id,
  'meio',
  null,
  'Metas mensais',
  'Média',
  'No prazo',
  'Metas',
  'Acompanhar as metas mensais de marketing e registrar aprendizados do mês.',
  '2026-05-31',
  2,
  'monthly',
  '23:59',
  true,
  'monthly_goals',
  '2026-06-01T02:59:00.000Z'::timestamptz
from metas_column
on conflict (id) do update set
  fixed_goal_key = excluded.fixed_goal_key,
  reset_frequency = excluded.reset_frequency,
  reset_time = excluded.reset_time,
  reset_month_last_day = excluded.reset_month_last_day,
  next_reset_at = coalesce(public.tasks.next_reset_at, excluded.next_reset_at);

insert into public.task_checklist_items (id, organization_id, task_id, label, done, sort_order)
values
  ('goal-weekly-check-1', '00000000-0000-0000-0000-000000000001', 'goal-weekly-schedule', 'Revisar calendário da semana', false, 1),
  ('goal-weekly-check-2', '00000000-0000-0000-0000-000000000001', 'goal-weekly-schedule', 'Conferir responsáveis', false, 2),
  ('goal-weekly-check-3', '00000000-0000-0000-0000-000000000001', 'goal-weekly-schedule', 'Validar artes pendentes', false, 3),
  ('goal-monthly-check-1', '00000000-0000-0000-0000-000000000001', 'goal-monthly-targets', 'Definir objetivo do mês', false, 1),
  ('goal-monthly-check-2', '00000000-0000-0000-0000-000000000001', 'goal-monthly-targets', 'Acompanhar métricas principais', false, 2),
  ('goal-monthly-check-3', '00000000-0000-0000-0000-000000000001', 'goal-monthly-targets', 'Registrar próximos ajustes', false, 3)
on conflict (id) do nothing;

insert into public.channels (id, organization_id, name, color)
values
  ('instagram', '00000000-0000-0000-0000-000000000001', 'Instagram', '#e25588'),
  ('tiktok', '00000000-0000-0000-0000-000000000001', 'TikTok', '#111827'),
  ('youtube', '00000000-0000-0000-0000-000000000001', 'YouTube', '#ef4444'),
  ('facebook', '00000000-0000-0000-0000-000000000001', 'Facebook', '#2563eb'),
  ('linkedin', '00000000-0000-0000-0000-000000000001', 'LinkedIn', '#0a66c2')
on conflict (id) do nothing;

insert into public.product_lines (organization_id, name)
values
  ('00000000-0000-0000-0000-000000000001', 'Kits turbo para caminhonetes'),
  ('00000000-0000-0000-0000-000000000001', 'Turbo/intercooler linha agrícola'),
  ('00000000-0000-0000-0000-000000000001', 'Kits para caminhões'),
  ('00000000-0000-0000-0000-000000000001', 'Intercooler'),
  ('00000000-0000-0000-0000-000000000001', 'Remap');

insert into public.vehicle_types (organization_id, name)
values
  ('00000000-0000-0000-0000-000000000001', 'Diesel performance'),
  ('00000000-0000-0000-0000-000000000001', 'Caminhonetes'),
  ('00000000-0000-0000-0000-000000000001', 'Tratores'),
  ('00000000-0000-0000-0000-000000000001', 'Caminhões');

insert into public.content_types (id, organization_id, name)
values
  ('antes-depois', '00000000-0000-0000-0000-000000000001', 'Antes/depois'),
  ('duvidas-tecnicas', '00000000-0000-0000-0000-000000000001', 'Dúvidas técnicas'),
  ('bastidores', '00000000-0000-0000-0000-000000000001', 'Bastidores'),
  ('instalacao', '00000000-0000-0000-0000-000000000001', 'Instalação'),
  ('clientes', '00000000-0000-0000-0000-000000000001', 'Clientes'),
  ('provas-resultados', '00000000-0000-0000-0000-000000000001', 'Provas/resultados')
on conflict (id) do nothing;

insert into public.campaigns (id, organization_id, name, objective, audience, message, status)
values
  ('campanha-neutra', '00000000-0000-0000-0000-000000000001', 'Campanha neutra', '', 'Geral', '', 'Planejada')
on conflict (id) do nothing;

insert into public.campaign_audiences (id, organization_id, name)
values
  ('geral', '00000000-0000-0000-0000-000000000001', 'Geral'),
  ('clientes-atuais', '00000000-0000-0000-0000-000000000001', 'Clientes atuais'),
  ('leads', '00000000-0000-0000-0000-000000000001', 'Leads'),
  ('equipe-interna', '00000000-0000-0000-0000-000000000001', 'Equipe interna'),
  ('outros', '00000000-0000-0000-0000-000000000001', 'Outros')
on conflict (id) do nothing;

insert into public.post_templates (id, organization_id, name, description, content_type_id, channel_id, format, funnel_stage_id, structure, checklist, visual_guidance, caption_example)
values
  ('template-antes-depois-tecnico', '00000000-0000-0000-0000-000000000001', 'Antes/depois técnico', 'Mostrar a condição inicial, a solução aplicada e o resultado percebido.', 'antes-depois', 'instagram', 'Feed', 'meio', '1. Problema inicial
2. Peça/kit aplicado
3. Resultado após instalação
4. Chamada para tirar dúvidas', 'Foto do antes
Foto do depois
Aplicação correta identificada
Legenda sem promessa exagerada', 'Usar comparação clara, setas ou marcações simples e foco na aplicação real.', 'Antes e depois de uma aplicação diesel com upgrade bem dimensionado.'),
  ('template-duvida-tecnica', '00000000-0000-0000-0000-000000000001', 'Dúvida técnica', 'Responder uma pergunta frequente de forma simples, técnica e direta.', 'duvidas-tecnicas', 'youtube', 'Shorts', 'topo', '1. Pergunta do cliente
2. Resposta curta
3. Explicação técnica
4. Quando procurar a Embrepoli', 'Pergunta clara
Resposta sem termos confusos
Exemplo prático
CTA leve', 'Usar close da peça, texto curto na tela e fala objetiva.', 'Essa é uma dúvida comum em motores diesel.'),
  ('template-bastidor-instalacao', '00000000-0000-0000-0000-000000000001', 'Bastidor de instalação', 'Mostrar o processo de montagem ou preparação como conteúdo de confiança.', 'bastidores', 'tiktok', 'Vídeo', 'topo', '1. Cena rápida da oficina
2. Detalhe técnico
3. Cuidados na montagem
4. Resultado final', 'Ambiente organizado
Peça em destaque
Mostrar cuidado técnico
Evitar informação sensível do cliente', 'Vídeo dinâmico, cortes curtos e áudio/legenda explicando o detalhe técnico.', 'Um pouco dos bastidores de uma instalação diesel feita com atenção em cada detalhe.'),
  ('template-prova-resultado', '00000000-0000-0000-0000-000000000001', 'Prova de resultado', 'Evidenciar resultado, aplicação real ou feedback de cliente.', 'provas-resultados', 'instagram', 'Reels', 'fundo', '1. Contexto da aplicação
2. O que foi instalado
3. Resultado/feedback
4. Próximo passo para orçamento', 'Resultado verificável
Contexto do veículo/máquina
Autorização para uso
CTA para atendimento', 'Priorizar imagens reais, depoimento curto e texto destacando a aplicação.', 'Aplicação real, resultado na prática e solução pensada para o uso do cliente.'),
  ('template-cliente-aplicacao-real', '00000000-0000-0000-0000-000000000001', 'Cliente/aplicação real', 'Apresentar uma aplicação real de cliente com foco em contexto e confiança.', 'clientes', 'facebook', 'Post', 'meio', '1. Tipo de cliente/aplicação
2. Necessidade
3. Solução Embrepoli
4. Benefício percebido', 'Cliente autorizado
Aplicação bem explicada
Linha de produto correta
Foto ou vídeo real', 'Mostrar veículo, máquina ou peça aplicada sem poluir a arte.', 'Cada aplicação tem uma necessidade. Por isso, o dimensionamento correto faz diferença.'),
  ('template-oferta-produto', '00000000-0000-0000-0000-000000000001', 'Oferta de produto', 'Divulgar produto/linha com chamada comercial sem perder clareza técnica.', 'instalacao', 'instagram', 'Story', 'fundo', '1. Produto ou kit
2. Aplicação indicada
3. Diferencial
4. Chamada para orçamento', 'Produto correto
Aplicações claras
Preço só se autorizado
CTA direto', 'Arte limpa com produto em destaque, pouco texto e chamada visível.', 'Kit indicado para quem busca uma solução bem dimensionada para aplicação diesel.'),
  ('template-educativo-diesel-performance', '00000000-0000-0000-0000-000000000001', 'Conteúdo educativo diesel performance', 'Explicar conceitos de performance diesel e posicionar a Embrepoli como referência técnica.', 'duvidas-tecnicas', 'youtube', 'Vídeo', 'topo', '1. Conceito principal
2. Erro comum
3. Explicação técnica simples
4. Aplicação prática', 'Tema útil
Linguagem simples
Exemplo real
Evitar promessa absoluta', 'Misturar fala técnica com imagens de peças, gráficos simples ou exemplos reais.', 'Performance diesel não é só potência. Dimensionamento, aplicação e confiabilidade caminham juntos.')
on conflict (id) do nothing;

insert into public.calendar_dates (id, organization_id, name, date, type, color, notes)
values
  ('ano-novo-2026', '00000000-0000-0000-0000-000000000001', 'Ano Novo', '2026-01-01', 'Feriado', '#2563eb', ''),
  ('tiradentes-2026', '00000000-0000-0000-0000-000000000001', 'Tiradentes', '2026-04-21', 'Feriado', '#2563eb', ''),
  ('dia-do-trabalho-2026', '00000000-0000-0000-0000-000000000001', 'Dia do Trabalho', '2026-05-01', 'Feriado', '#2563eb', ''),
  ('dia-dos-namorados-2026', '00000000-0000-0000-0000-000000000001', 'Dia dos Namorados', '2026-06-12', 'Data comemorativa', '#e25588', 'Possível gancho para campanhas leves.'),
  ('dia-do-cliente-2026', '00000000-0000-0000-0000-000000000001', 'Dia do Cliente', '2026-09-15', 'Data comemorativa', '#0891b2', 'Bom para provas sociais e pós-venda.'),
  ('black-friday-2026', '00000000-0000-0000-0000-000000000001', 'Black Friday', '2026-11-27', 'Data comemorativa', '#111827', 'Planejar ofertas e criativos com antecedência.'),
  ('natal-2026', '00000000-0000-0000-0000-000000000001', 'Natal', '2026-12-25', 'Feriado', '#16a34a', '')
on conflict (id) do nothing;

alter publication supabase_realtime add table
  public.profiles,
  public.channels,
  public.product_lines,
  public.vehicle_types,
  public.content_types,
  public.funnel_stages,
  public.task_boards,
  public.task_columns,
  public.campaigns,
  public.campaign_audiences,
  public.post_templates,
  public.campaign_assignees,
  public.posts,
  public.post_assignees,
  public.post_review_assets,
  public.post_review_comments,
  public.ideas,
  public.idea_attachments,
  public.calendar_dates,
  public.tasks,
  public.task_assignees,
  public.task_checklist_items,
  public.task_comments,
  public.task_attachments,
  public.task_reset_history,
  public.post_metrics,
  public.notifications,
  public.google_connections;
