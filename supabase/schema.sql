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
  created_by text references public.profiles(id) on delete set null,
  title text not null,
  status public.post_status not null default 'Ideia',
  format text not null default 'Post',
  sort_order integer not null default 1,
  publish_at timestamptz,
  description text not null default '',
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
  created_by text references public.profiles(id) on delete set null,
  title text not null,
  type text not null default 'Postagem',
  priority text not null default 'Média',
  sort_order integer not null default 1,
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

alter table public.profiles add column if not exists notification_sound boolean not null default true;
alter table public.campaigns add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.posts add column if not exists sort_order integer not null default 1;
alter table public.posts add column if not exists format text not null default 'Post';
alter table public.ideas add column if not exists sort_order integer not null default 1;
alter table public.post_metrics add column if not exists campaign_id text references public.campaigns(id) on delete set null;
alter table public.post_metrics add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.post_metrics add column if not exists content_type_id text references public.content_types(id) on delete set null;
alter table public.post_metrics add column if not exists metric_date date not null default current_date;
alter table public.post_metrics add column if not exists learning text not null default '';
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
alter table public.posts enable row level security;
alter table public.post_review_assets enable row level security;
alter table public.post_review_comments enable row level security;
alter table public.ideas enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.campaign_assignees enable row level security;
alter table public.post_assignees enable row level security;
alter table public.idea_assignees enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.post_metrics enable row level security;
alter table public.notifications enable row level security;

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

create policy "members manage metrics" on public.post_metrics for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage own notifications" on public.notifications for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Embrepoli')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values
  ('task-attachments', 'task-attachments', true),
  ('profile-avatars', 'profile-avatars', true),
  ('post-review-assets', 'post-review-assets', true)
on conflict (id) do nothing;

insert into public.funnel_stages (organization_id, name, color, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Topo - Descoberta', '#38bdf8', 1),
  ('00000000-0000-0000-0000-000000000001', 'Meio - Interesse', '#2563eb', 2),
  ('00000000-0000-0000-0000-000000000001', 'Fundo - Decisão', '#1d4ed8', 3),
  ('00000000-0000-0000-0000-000000000001', 'Pós-venda - Relacionamento', '#334155', 4);

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

insert into public.channels (organization_id, name, color)
values
  ('00000000-0000-0000-0000-000000000001', 'Instagram', '#e25588'),
  ('00000000-0000-0000-0000-000000000001', 'TikTok', '#111827'),
  ('00000000-0000-0000-0000-000000000001', 'YouTube', '#ef4444'),
  ('00000000-0000-0000-0000-000000000001', 'Facebook', '#2563eb'),
  ('00000000-0000-0000-0000-000000000001', 'LinkedIn', '#0a66c2');

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

insert into public.content_types (organization_id, name)
values
  ('00000000-0000-0000-0000-000000000001', 'Antes/depois'),
  ('00000000-0000-0000-0000-000000000001', 'Dúvidas técnicas'),
  ('00000000-0000-0000-0000-000000000001', 'Bastidores'),
  ('00000000-0000-0000-0000-000000000001', 'Instalação'),
  ('00000000-0000-0000-0000-000000000001', 'Clientes'),
  ('00000000-0000-0000-0000-000000000001', 'Provas/resultados');

insert into public.campaigns (id, organization_id, name, objective, audience, message, status)
values
  ('campanha-neutra', '00000000-0000-0000-0000-000000000001', 'Campanha neutra', '', 'Geral', '', 'Planejada')
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
  public.campaign_assignees,
  public.posts,
  public.post_assignees,
  public.post_review_assets,
  public.post_review_comments,
  public.ideas,
  public.tasks,
  public.task_assignees,
  public.task_checklist_items,
  public.task_comments,
  public.task_attachments,
  public.post_metrics,
  public.notifications;


