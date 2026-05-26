-- Fix Supabase Advisor warnings:
-- RLS Disabled in Public for public.comments and public.auto_filters.
--
-- Run this file in the Supabase SQL Editor for the production project.
-- It is intentionally idempotent and keeps the current app behavior:
-- organization members can manage records from their own organization only.

alter table public.comments enable row level security;
alter table public.auto_filters enable row level security;

drop policy if exists "org members can manage comments" on public.comments;

create policy "org members can manage comments"
on public.comments
for all
using (organization_id::text = public.current_organization_id())
with check (organization_id::text = public.current_organization_id());

drop policy if exists "org members can manage auto filters" on public.auto_filters;

create policy "org members can manage auto filters"
on public.auto_filters
for all
using (organization_id::text = public.current_organization_id())
with check (organization_id::text = public.current_organization_id());
