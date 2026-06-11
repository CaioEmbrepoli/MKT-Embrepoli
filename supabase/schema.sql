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

create table if not exists public.post_publications (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  post_id text references public.posts(id) on delete cascade,
  platform text not null,
  status text not null default 'pending',
  title text not null default '',
  caption text not null default '',
  format text not null default '',
  asset_url text not null default '',
  carousel_assets jsonb not null default '[]'::jsonb,
  thumbnail_url text,
  external_id text,
  permalink text,
  scheduled_at timestamptz,
  published_at timestamptz,
  error text,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  created_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_publications_org_platform_status_idx
on public.post_publications (organization_id, platform, status, scheduled_at);

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
  carousel_group_id text,
  carousel_order integer,
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
  external_id text,
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
  video_type text,
  privacy_status text,
  watch_time_minutes numeric,
  average_view_duration_seconds numeric,
  average_view_percentage numeric,
  subscribers_gained integer,
  subscribers_lost integer,
  impressions integer,
  impression_click_through_rate numeric,
  thumbnail_url text,
  source_url text,
  embed_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.ad_accounts (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta',
  external_id text,
  name text not null,
  currency text not null default 'BRL',
  status text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_accounts_org_platform_external_idx
on public.ad_accounts (organization_id, platform, external_id)
where external_id is not null;

create table if not exists public.ad_campaigns (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  internal_campaign_id text references public.campaigns(id) on delete set null,
  external_id text,
  name text not null,
  objective text not null default '',
  status text not null default 'unknown',
  budget_amount numeric,
  budget_type text not null default 'unknown',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_org_account_idx
on public.ad_campaigns (organization_id, account_id);

create table if not exists public.ad_sets (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  external_id text,
  name text not null,
  audience_name text,
  status text not null default 'unknown',
  budget_amount numeric,
  budget_type text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_sets_org_campaign_idx
on public.ad_sets (organization_id, campaign_id);

create table if not exists public.ads (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  account_id text not null references public.ad_accounts(id) on delete cascade,
  campaign_id text not null references public.ad_campaigns(id) on delete cascade,
  ad_set_id text references public.ad_sets(id) on delete set null,
  external_id text,
  name text not null,
  creative_name text,
  status text not null default 'unknown',
  thumbnail_url text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_org_campaign_idx
on public.ads (organization_id, campaign_id);

create table if not exists public.ad_insights_daily (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta',
  account_id text not null references public.ad_accounts(id) on delete cascade,
  campaign_id text references public.ad_campaigns(id) on delete cascade,
  ad_set_id text references public.ad_sets(id) on delete set null,
  ad_id text references public.ads(id) on delete set null,
  date date not null,
  spend numeric not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  frequency numeric not null default 0,
  cpm numeric not null default 0,
  clicks integer not null default 0,
  link_clicks integer not null default 0,
  ctr numeric not null default 0,
  cpc numeric not null default 0,
  landing_page_views integer not null default 0,
  leads integer not null default 0,
  cost_per_lead numeric not null default 0,
  conversations integer not null default 0,
  cost_per_conversation numeric not null default 0,
  purchases integer not null default 0,
  purchase_value numeric not null default 0,
  cost_per_purchase numeric not null default 0,
  roas numeric not null default 0,
  engagements integer not null default 0,
  video_views integer not null default 0,
  cost_per_engagement numeric not null default 0,
  breakdown_placement text,
  breakdown_age text,
  breakdown_gender text,
  breakdown_region text,
  breakdown_device text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ad_insights_daily_unique_entity_idx
on public.ad_insights_daily (
  organization_id,
  platform,
  account_id,
  coalesce(campaign_id, ''),
  coalesce(ad_set_id, ''),
  coalesce(ad_id, ''),
  date,
  coalesce(breakdown_placement, ''),
  coalesce(breakdown_age, ''),
  coalesce(breakdown_gender, ''),
  coalesce(breakdown_region, ''),
  coalesce(breakdown_device, '')
);

create table if not exists public.ad_alerts (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  platform text not null default 'meta',
  severity text not null default 'atencao',
  status text not null default 'open',
  entity_type text not null,
  entity_id text not null,
  title text not null,
  description text not null default '',
  recommendation text not null default '',
  metric_key text not null default '',
  metric_value numeric,
  benchmark_value numeric,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists ad_alerts_org_status_idx
on public.ad_alerts (organization_id, status, severity);

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
  constraint google_connections_service_check check (service in ('drive', 'youtube', 'sheets'))
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
      add constraint google_connections_service_check check (service in ('drive', 'youtube', 'sheets'));
  end if;
end $$;
create unique index if not exists google_connections_organization_service_idx
on public.google_connections (organization_id, service);

create table if not exists public.tiktok_connections (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  environment text not null default 'sandbox',
  tiktok_open_id text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  scopes text[] not null default '{}'::text[],
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  connected_by text references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiktok_connections_environment_check check (environment in ('sandbox', 'production'))
);

create unique index if not exists tiktok_connections_organization_environment_idx
on public.tiktok_connections (organization_id, environment);

create table if not exists public.meta_connections (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  service text not null default 'instagram',
  instagram_account_id text,
  page_id text,
  ad_account_id text,
  ad_account_name text,
  business_id text,
  username text not null default '',
  display_name text not null default '',
  avatar_url text not null default '',
  scopes text[] not null default '{}'::text[],
  access_token text not null,
  expires_at timestamptz,
  connected_by text references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_connections_service_check check (service in ('instagram', 'ads'))
);

create unique index if not exists meta_connections_organization_service_idx
on public.meta_connections (organization_id, service);

alter table public.profiles add column if not exists notification_sound boolean not null default true;
alter table public.campaigns add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.posts add column if not exists sort_order integer not null default 1;
alter table public.posts add column if not exists format text not null default 'Post';
alter table public.posts add column if not exists idea_id text references public.ideas(id) on delete set null;
alter table public.posts add column if not exists template_id text references public.post_templates(id) on delete set null;
alter table public.posts add column if not exists production_checklist jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists extra_channels jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists published_video_id text;
alter table public.posts add column if not exists published_at timestamptz;
alter table public.ideas add column if not exists sort_order integer not null default 1;
alter table public.ideas add column if not exists description text not null default '';
alter table public.ideas add column if not exists template_id text references public.post_templates(id) on delete set null;
alter table public.ideas add column if not exists format text not null default 'Post';
alter table public.post_templates add column if not exists structure_items jsonb not null default '[]'::jsonb;
alter table public.post_templates add column if not exists checklist_items jsonb not null default '[]'::jsonb;
alter table public.post_templates add column if not exists suggested_time text not null default '';
alter table public.post_metrics add column if not exists campaign_id text references public.campaigns(id) on delete set null;
alter table public.post_metrics add column if not exists external_id text;
alter table public.post_metrics add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.post_metrics add column if not exists content_type_id text references public.content_types(id) on delete set null;
alter table public.post_metrics add column if not exists metric_date date not null default current_date;
alter table public.post_metrics add column if not exists learning text not null default '';
alter table public.post_metrics add column if not exists video_type text;
alter table public.post_metrics add column if not exists privacy_status text;
alter table public.post_metrics add column if not exists watch_time_minutes numeric;
alter table public.post_metrics add column if not exists average_view_duration_seconds numeric;
alter table public.post_metrics add column if not exists average_view_percentage numeric;
alter table public.post_metrics add column if not exists subscribers_gained integer;
alter table public.post_metrics add column if not exists subscribers_lost integer;
alter table public.post_metrics add column if not exists impressions integer;
alter table public.post_metrics add column if not exists impression_click_through_rate numeric;
alter table public.post_metrics add column if not exists thumbnail_url text;
alter table public.post_metrics add column if not exists source_url text;
alter table public.post_metrics add column if not exists embed_url text;
create unique index if not exists post_metrics_external_id_idx on public.post_metrics (external_id);

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
alter table public.post_review_assets add column if not exists is_cover boolean default false;
alter table public.post_review_assets add column if not exists carousel_group_id text;
alter table public.post_review_assets add column if not exists carousel_order integer;
create index if not exists post_review_assets_carousel_idx
  on public.post_review_assets (organization_id, post_id, carousel_group_id, carousel_order)
  where carousel_group_id is not null;
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
alter table public.profile_areas enable row level security;
alter table public.profile_module_permissions enable row level security;
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
alter table public.post_publications enable row level security;
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
alter table public.ad_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_sets enable row level security;
alter table public.ads enable row level security;
alter table public.ad_insights_daily enable row level security;
alter table public.ad_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.google_connections enable row level security;
alter table public.tiktok_connections enable row level security;
alter table public.meta_connections enable row level security;

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

create policy "members manage ad accounts" on public.ad_accounts for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage ad campaigns" on public.ad_campaigns for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage ad sets" on public.ad_sets for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage ads" on public.ads for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage ad insights daily" on public.ad_insights_daily for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

create policy "members manage ad alerts" on public.ad_alerts for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage post publications" on public.post_publications;
create policy "members manage post publications" on public.post_publications for all
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

drop policy if exists "members read tiktok connection status" on public.tiktok_connections;
create policy "members read tiktok connection status" on public.tiktok_connections for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage tiktok connection" on public.tiktok_connections;
create policy "admins and managers manage tiktok connection" on public.tiktok_connections for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));

drop policy if exists "members read meta connection status" on public.meta_connections;
create policy "members read meta connection status" on public.meta_connections for select
using (organization_id = public.current_organization_id());

drop policy if exists "admins and managers manage meta connection" on public.meta_connections;
create policy "admins and managers manage meta connection" on public.meta_connections for all
using (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'))
with check (organization_id = public.current_organization_id() and public.current_member_role() in ('admin', 'gestor'));

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Embrepoli')
on conflict (name) do nothing;

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

-- Comentários e Banco de Dúvidas dos Clientes
create table if not exists public.customer_questions (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  source text not null default 'manual',
  external_id text,
  video_id text,
  video_title text,
  question_text text not null,
  answer_text text,
  author_name text,
  likes integer default 0,
  status text not null default 'pendente',
  category text,
  reviewer_id text references public.profiles(id) on delete set null,
  learning text,
  from_comment_id text,
  source_comment_id text,
  needs_review boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by text references public.profiles(id) on delete set null,
  ai_confidence numeric,
  ai_reason text,
  published_at timestamptz,
  answered_at timestamptz,
  created_at timestamptz default now(),
  unique (organization_id, external_id)
);

alter table public.customer_questions add column if not exists from_comment_id text;
alter table public.customer_questions add column if not exists source_comment_id text;
alter table public.customer_questions add column if not exists needs_review boolean not null default false;
alter table public.customer_questions add column if not exists reviewed_at timestamptz;
alter table public.customer_questions add column if not exists reviewed_by text references public.profiles(id) on delete set null;
alter table public.customer_questions add column if not exists ai_confidence numeric;
alter table public.customer_questions add column if not exists ai_reason text;
alter table public.customer_questions drop constraint if exists customer_questions_source_check;
alter table public.customer_questions add constraint customer_questions_source_check check (source in ('youtube', 'instagram', 'facebook', 'tiktok', 'manual'));
alter table public.customer_questions drop constraint if exists customer_questions_status_check;
alter table public.customer_questions add constraint customer_questions_status_check check (status in ('pendente', 'respondido', 'aprovado', 'descartado'));
create index if not exists idx_customer_questions_org on public.customer_questions(organization_id);
create index if not exists idx_customer_questions_status on public.customer_questions(organization_id, status);
create index if not exists idx_customer_questions_review on public.customer_questions(organization_id, needs_review);

create table if not exists public.comments (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  source text not null default 'youtube',
  external_id text,
  import_signature text,
  video_id text,
  video_title text,
  media_thumbnail_url text,
  media_url text,
  media_permalink text,
  author_name text,
  text text not null,
  likes integer not null default 0,
  external_replies jsonb not null default '[]'::jsonb,
  response text,
  response_external_id text,
  response_history jsonb not null default '[]'::jsonb,
  status text not null default 'novo',
  added_to_bank boolean not null default false,
  bank_question_id text references public.customer_questions(id) on delete set null,
  published_at timestamptz,
  retention_until timestamptz,
  processed_at timestamptz,
  is_relevant boolean,
  classification_status text,
  classification_reason text,
  suggested_reply text,
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

alter table public.comments add column if not exists import_signature text;
alter table public.comments add column if not exists bank_question_id text references public.customer_questions(id) on delete set null;
alter table public.comments add column if not exists media_thumbnail_url text;
alter table public.comments add column if not exists media_url text;
alter table public.comments add column if not exists media_permalink text;
alter table public.comments add column if not exists external_replies jsonb not null default '[]'::jsonb;
alter table public.comments add column if not exists response_external_id text;
alter table public.comments add column if not exists response_history jsonb not null default '[]'::jsonb;
alter table public.comments add column if not exists retention_until timestamptz;
alter table public.comments add column if not exists processed_at timestamptz;
alter table public.comments add column if not exists is_relevant boolean;
alter table public.comments add column if not exists classification_status text;
alter table public.comments add column if not exists classification_reason text;
alter table public.comments add column if not exists suggested_reply text;
alter table public.comments drop constraint if exists comments_source_check;
alter table public.comments add constraint comments_source_check check (source in ('youtube', 'instagram', 'facebook', 'tiktok'));
alter table public.comments drop constraint if exists comments_status_check;
alter table public.comments add constraint comments_status_check check (status in ('novo', 'respondido', 'ignorado'));
alter table public.comments drop constraint if exists comments_classification_status_check;
alter table public.comments add constraint comments_classification_status_check check (classification_status is null or classification_status in ('pendente', 'relevante', 'normal', 'erro'));
update public.comments
set retention_until = coalesce(retention_until, created_at + interval '90 days')
where retention_until is null;
create index if not exists idx_comments_org on public.comments(organization_id);
create index if not exists idx_comments_bank on public.comments(organization_id, added_to_bank);
create index if not exists idx_comments_retention on public.comments(organization_id, retention_until) where retention_until is not null;
create unique index if not exists idx_comments_org_source_external_unique
on public.comments(organization_id, source, external_id)
where external_id is not null;
create unique index if not exists idx_comments_org_signature_unique
on public.comments(organization_id, import_signature)
where import_signature is not null;

create table if not exists public.auto_filters (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  keyword text not null,
  match_type text not null default 'contains',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.auto_filters drop constraint if exists auto_filters_match_type_check;
alter table public.auto_filters add constraint auto_filters_match_type_check check (match_type in ('contains', 'startsWith', 'exact'));
create index if not exists idx_auto_filters_org on public.auto_filters(organization_id);

alter table public.customer_questions enable row level security;
alter table public.comments enable row level security;
alter table public.auto_filters enable row level security;

create table if not exists public.comment_webhook_events (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('youtube', 'instagram', 'facebook', 'tiktok')),
  event_id text,
  external_comment_id text,
  external_media_id text,
  event_type text not null default 'comment',
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

drop index if exists comment_webhook_events_org_source_event_uidx;
create unique index if not exists comment_webhook_events_org_source_event_uidx
on public.comment_webhook_events (organization_id, source, event_id);

create index if not exists comment_webhook_events_org_source_created_idx
on public.comment_webhook_events (organization_id, source, created_at desc);

create index if not exists comment_webhook_events_unprocessed_idx
on public.comment_webhook_events (organization_id, source, created_at)
where processed_at is null;

alter table public.comment_webhook_events enable row level security;

drop policy if exists "org members can manage questions" on public.customer_questions;
create policy "org members can manage questions"
on public.customer_questions for all
using (organization_id::text = public.current_organization_id())
with check (organization_id::text = public.current_organization_id());

drop policy if exists "org members can manage comments" on public.comments;
create policy "org members can manage comments"
on public.comments for all
using (organization_id::text = public.current_organization_id())
with check (organization_id::text = public.current_organization_id());

drop policy if exists "org members can read comment webhook events" on public.comment_webhook_events;
create policy "org members can read comment webhook events"
on public.comment_webhook_events for select
using (organization_id::text = public.current_organization_id());

drop policy if exists "org members can manage auto filters" on public.auto_filters;
create policy "org members can manage auto filters"
on public.auto_filters for all
using (organization_id::text = public.current_organization_id())
with check (organization_id::text = public.current_organization_id());

create table if not exists public.knowledge_chat_sessions (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  date_key date not null,
  status text not null default 'active',
  title text not null default 'Chat do dia',
  archived_at timestamptz,
  expires_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_chat_sessions_status_check check (status in ('active', 'archived')),
  constraint knowledge_chat_sessions_user_day_unique unique (organization_id, user_id, date_key)
);

create table if not exists public.knowledge_gaps (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  session_id text not null references public.knowledge_chat_sessions(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  question_text text not null,
  status text not null default 'aguardando_resposta',
  customer_question_id text references public.customer_questions(id) on delete set null,
  answered_at timestamptz,
  resolved_by text references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_gaps_status_check check (status in ('aguardando_resposta', 'convertido', 'ignorado', 'erro'))
);

create table if not exists public.knowledge_chat_messages (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  session_id text not null references public.knowledge_chat_sessions(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  provider text,
  model text,
  unknown boolean not null default false,
  confidence numeric,
  reason text,
  gap_id text references public.knowledge_gaps(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint knowledge_chat_messages_role_check check (role in ('user', 'ai', 'system', 'error'))
);

create table if not exists public.knowledge_chat_matches (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  session_id text not null references public.knowledge_chat_sessions(id) on delete cascade,
  message_id text not null references public.knowledge_chat_messages(id) on delete cascade,
  question_id text references public.customer_questions(id) on delete set null,
  confidence numeric,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_chat_sessions_user_day on public.knowledge_chat_sessions(organization_id, user_id, date_key);
create index if not exists idx_knowledge_chat_sessions_cleanup on public.knowledge_chat_sessions(status, expires_at);
create index if not exists idx_knowledge_chat_messages_session on public.knowledge_chat_messages(session_id, created_at);
create index if not exists idx_knowledge_gaps_session on public.knowledge_gaps(session_id, status);
create index if not exists idx_knowledge_chat_matches_message on public.knowledge_chat_matches(message_id);

alter table public.knowledge_chat_sessions enable row level security;
alter table public.knowledge_chat_messages enable row level security;
alter table public.knowledge_chat_matches enable row level security;
alter table public.knowledge_gaps enable row level security;

drop policy if exists "users manage own knowledge chat sessions" on public.knowledge_chat_sessions;
create policy "users manage own knowledge chat sessions"
on public.knowledge_chat_sessions for all
using (organization_id = public.current_organization_id() and user_id = auth.uid()::text)
with check (organization_id = public.current_organization_id() and user_id = auth.uid()::text);

drop policy if exists "users manage own knowledge chat messages" on public.knowledge_chat_messages;
create policy "users manage own knowledge chat messages"
on public.knowledge_chat_messages for all
using (
  organization_id = public.current_organization_id()
  and exists (select 1 from public.knowledge_chat_sessions s where s.id = session_id and s.user_id = auth.uid()::text)
)
with check (
  organization_id = public.current_organization_id()
  and exists (select 1 from public.knowledge_chat_sessions s where s.id = session_id and s.user_id = auth.uid()::text)
);

drop policy if exists "users read own knowledge chat matches" on public.knowledge_chat_matches;
create policy "users read own knowledge chat matches"
on public.knowledge_chat_matches for select
using (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.knowledge_chat_messages m
    join public.knowledge_chat_sessions s on s.id = m.session_id
    where m.id = message_id and s.user_id = auth.uid()::text
  )
);

drop policy if exists "users manage own knowledge gaps" on public.knowledge_gaps;
create policy "users manage own knowledge gaps"
on public.knowledge_gaps for all
using (organization_id = public.current_organization_id() and user_id = auth.uid()::text)
with check (organization_id = public.current_organization_id() and user_id = auth.uid()::text);

-- Vendas: clientes, funil comercial e agenda de ligações
create table if not exists public.sales_clients (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  external_code text,
  name text not null default '',
  client_type text not null default '',
  email text not null default '',
  phone text not null default '',
  company text not null default '',
  segment text not null default '',
  state_uf text not null default '',
  city text not null default '',
  last_purchase_at date,
  status text not null default 'lead',
  source text not null default 'manual',
  assigned_to text references public.profiles(id) on delete set null,
  notes text not null default '',
  proposals jsonb not null default '[]'::jsonb,
  sales_funnel_stage text not null default 'lead',
  created_at timestamptz not null default now()
);

alter table public.sales_clients add column if not exists external_code text;
alter table public.sales_clients add column if not exists client_type text not null default '';
alter table public.sales_clients add column if not exists state_uf text not null default '';
alter table public.sales_clients add column if not exists city text not null default '';
alter table public.sales_clients add column if not exists last_purchase_at date;
alter table public.sales_clients add column if not exists sales_funnel_stage text not null default 'lead';

create unique index if not exists sales_clients_org_external_code_idx
on public.sales_clients (organization_id, external_code)
where external_code is not null and btrim(external_code) <> '';

create table if not exists public.sales_funnel_stages (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  name text not null default '',
  color text not null default '#64748b',
  emoji text not null default '',
  sort_order integer not null default 0,
  half_width boolean not null default false
);

alter table public.sales_funnel_stages add column if not exists half_width boolean not null default false;

create table if not exists public.call_schedules (
  id text primary key default gen_random_uuid()::text,
  organization_id text not null references public.organizations(id) on delete cascade,
  client_id text references public.sales_clients(id) on delete cascade,
  client_name text not null default '',
  phone text not null default '',
  frequency text not null default 'weekly',
  next_call_at date not null default current_date,
  call_history jsonb not null default '[]'::jsonb,
  assigned_to text references public.profiles(id) on delete set null,
  active boolean not null default true,
  paused boolean not null default false,
  archived boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.call_schedules add column if not exists paused boolean not null default false;
alter table public.call_schedules add column if not exists archived boolean not null default false;

alter table public.sales_clients enable row level security;
alter table public.sales_funnel_stages enable row level security;
alter table public.call_schedules enable row level security;

drop policy if exists "members manage sales clients" on public.sales_clients;
create policy "members manage sales clients"
on public.sales_clients for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage sales funnel stages" on public.sales_funnel_stages;
create policy "members manage sales funnel stages"
on public.sales_funnel_stages for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "members manage call schedules" on public.call_schedules;
create policy "members manage call schedules"
on public.call_schedules for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

alter publication supabase_realtime add table
  public.profiles,
  public.profile_areas,
  public.profile_module_permissions,
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
  public.post_publications,
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
  public.ad_accounts,
  public.ad_campaigns,
  public.ad_sets,
  public.ads,
  public.ad_insights_daily,
  public.ad_alerts,
  public.notifications,
  public.google_connections,
  public.tiktok_connections,
  public.meta_connections,
  public.customer_questions,
  public.comments,
  public.auto_filters,
  public.sales_clients,
  public.sales_funnel_stages,
  public.call_schedules,
  public.knowledge_chat_sessions,
  public.knowledge_chat_messages,
  public.knowledge_chat_matches,
  public.knowledge_gaps;
