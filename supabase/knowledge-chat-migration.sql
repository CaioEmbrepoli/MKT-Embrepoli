-- Chat individual do Banco de Dúvidas com reset diário.
-- Rode este arquivo no SQL Editor do Supabase depois do schema principal.

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

create index if not exists idx_knowledge_chat_sessions_user_day
on public.knowledge_chat_sessions(organization_id, user_id, date_key);

create index if not exists idx_knowledge_chat_sessions_cleanup
on public.knowledge_chat_sessions(status, expires_at);

create index if not exists idx_knowledge_chat_messages_session
on public.knowledge_chat_messages(session_id, created_at);

create index if not exists idx_knowledge_gaps_session
on public.knowledge_gaps(session_id, status);

create index if not exists idx_knowledge_chat_matches_message
on public.knowledge_chat_matches(message_id);

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
  and exists (
    select 1 from public.knowledge_chat_sessions s
    where s.id = session_id and s.user_id = auth.uid()::text
  )
)
with check (
  organization_id = public.current_organization_id()
  and exists (
    select 1 from public.knowledge_chat_sessions s
    where s.id = session_id and s.user_id = auth.uid()::text
  )
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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_chat_sessions'
  ) then
    alter publication supabase_realtime add table public.knowledge_chat_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_chat_messages'
  ) then
    alter publication supabase_realtime add table public.knowledge_chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_chat_matches'
  ) then
    alter publication supabase_realtime add table public.knowledge_chat_matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'knowledge_gaps'
  ) then
    alter publication supabase_realtime add table public.knowledge_gaps;
  end if;
end $$;
