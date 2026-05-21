-- Banco de Dúvidas inteligente e fluxo Comentários -> IA -> Base de Conhecimento.
-- Rode no SQL Editor do Supabase para atualizar um banco existente.

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
  video_id text,
  video_title text,
  author_name text,
  text text not null,
  likes integer not null default 0,
  response text,
  status text not null default 'novo',
  added_to_bank boolean not null default false,
  bank_question_id text references public.customer_questions(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

alter table public.comments add column if not exists bank_question_id text references public.customer_questions(id) on delete set null;
alter table public.comments drop constraint if exists comments_source_check;
alter table public.comments add constraint comments_source_check check (source in ('youtube', 'instagram', 'facebook', 'tiktok'));
alter table public.comments drop constraint if exists comments_status_check;
alter table public.comments add constraint comments_status_check check (status in ('novo', 'respondido', 'ignorado'));
create index if not exists idx_comments_org on public.comments(organization_id);
create index if not exists idx_comments_bank on public.comments(organization_id, added_to_bank);

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

drop policy if exists "org members can manage questions" on public.customer_questions;
create policy "org members can manage questions"
on public.customer_questions for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "org members can manage comments" on public.comments;
create policy "org members can manage comments"
on public.comments for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

drop policy if exists "org members can manage auto filters" on public.auto_filters;
create policy "org members can manage auto filters"
on public.auto_filters for all
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_questions'
  ) then
    alter publication supabase_realtime add table public.customer_questions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comments'
  ) then
    alter publication supabase_realtime add table public.comments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'auto_filters'
  ) then
    alter publication supabase_realtime add table public.auto_filters;
  end if;
end $$;
