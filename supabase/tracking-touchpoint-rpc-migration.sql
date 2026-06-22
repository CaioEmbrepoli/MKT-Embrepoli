-- RPC para registrar touchpoints (clique no WhatsApp, envio de formulario,
-- inicio de checkout, clique em CTA) vinculados ao visitor_id.
-- Usa o ultimo tracking_session do visitante quando nenhum session_id e informado.
create or replace function public.insert_touchpoint(
  p_org text,
  p_visitor text,
  p_event_type text,
  p_event_data jsonb default '{}',
  p_session_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id text;
begin
  v_session_id := p_session_id;

  if v_session_id is null then
    select id into v_session_id
    from public.tracking_sessions
    where visitor_id = p_visitor and organization_id = p_org
    order by started_at desc
    limit 1;
  end if;

  insert into public.tracking_touchpoints (
    organization_id, visitor_id, session_id, event_type, event_data
  )
  values (
    p_org, p_visitor, v_session_id, p_event_type, coalesce(p_event_data, '{}')
  );
end;
$$;
