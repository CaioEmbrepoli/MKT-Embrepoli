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
