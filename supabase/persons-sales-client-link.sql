-- Vincula persons (CDP) com sales_clients (CRM)
-- Quando um lead chega via webhook, o sistema busca/cria um sales_client vinculado ao person

alter table public.sales_clients
  add column if not exists person_id text references public.persons(id) on delete set null;

create index if not exists sales_clients_person_idx on public.sales_clients (person_id);
