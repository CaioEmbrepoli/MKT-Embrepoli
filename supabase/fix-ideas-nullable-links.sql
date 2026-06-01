-- Fix optional Idea relationship fields that should be NULL when unselected.
-- Safe to run more than once. It does not delete or recreate ideas.

alter table public.ideas add column if not exists description text not null default '';
alter table public.ideas add column if not exists template_id text references public.post_templates(id) on delete set null;
alter table public.ideas add column if not exists format text not null default 'Post';
alter table public.ideas add column if not exists vehicle_type_id text references public.vehicle_types(id) on delete set null;
alter table public.ideas add column if not exists content_type_id text references public.content_types(id) on delete set null;

update public.ideas
set
  channel_id = nullif(channel_id, ''),
  product_line_id = nullif(product_line_id, ''),
  vehicle_type_id = nullif(vehicle_type_id, ''),
  content_type_id = nullif(content_type_id, ''),
  funnel_stage_id = nullif(funnel_stage_id, ''),
  template_id = nullif(template_id, '')
where
  channel_id = ''
  or product_line_id = ''
  or vehicle_type_id = ''
  or content_type_id = ''
  or funnel_stage_id = ''
  or template_id = '';
