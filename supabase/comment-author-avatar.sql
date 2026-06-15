alter table public.comments
  add column if not exists author_avatar_url text;
