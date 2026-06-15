alter table public.google_connections
  drop constraint if exists google_connections_service_check;

alter table public.google_connections
  add constraint google_connections_service_check
  check (service = any (array['drive'::text, 'youtube'::text, 'sheets'::text, 'analytics'::text]));
