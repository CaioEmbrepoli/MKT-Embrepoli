-- RPC generica para upsert de person por qualquer tipo de identificador
-- (telefone, email, etc.), espelhando upsert_person_by_phone mas reutilizavel.
-- Usada pelo endpoint /api/tracking/conversion para ligar uma venda da Tray
-- (que so traz email) a um person + sales_client.
create or replace function public.upsert_person_by_identifier(
  p_org text,
  p_type text,
  p_value text,
  p_name text,
  p_channel text,
  p_channel_detail text,
  p_visitor_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_person_id text;
begin
  select person_id into v_person_id
  from public.person_identifiers
  where organization_id = p_org
    and type = p_type
    and value = p_value
  limit 1;

  if v_person_id is null then
    insert into public.persons (organization_id, name, channel, channel_detail, visitor_id)
    values (p_org, p_name, p_channel, p_channel_detail, p_visitor_id)
    returning id into v_person_id;

    insert into public.person_identifiers (organization_id, person_id, type, value)
    values (p_org, v_person_id, p_type, p_value)
    on conflict (organization_id, type, value) do nothing;
  else
    update public.persons
    set
      name = coalesce(nullif(p_name, ''), name),
      visitor_id = coalesce(visitor_id, p_visitor_id),
      channel_detail = coalesce(channel_detail, p_channel_detail)
    where id = v_person_id;
  end if;

  return v_person_id;
end;
$$;
