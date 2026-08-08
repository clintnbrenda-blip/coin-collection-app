-- Split vending from one combined line item into per-machine tracking
-- (Pop / Snack / Soap), each with its own cash_collected/coins_collected.
-- No turns calculation applies to any of these — income only, per spec.

create table public.vending_machines (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  name text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.vending_machines is 'Individual vending machines (Pop, Snack, Soap, ...) tracked as separate income line items, not turns-based.';

insert into public.vending_machines (location_id, name, display_order)
select id, v.name, v.display_order
from public.locations, (values
  ('Pop Vending', 1),
  ('Snack Vending', 2),
  ('Soap Vending', 3)
) as v(name, display_order)
where locations.name = 'Main Location';

alter table public.vending_machines enable row level security;

create policy "vending_machines: any authenticated user reads"
  on public.vending_machines for select
  using (auth.role() = 'authenticated');

create policy "vending_machines: owner writes"
  on public.vending_machines for all
  using (public.is_owner())
  with check (public.is_owner());

-- Old vending_totals was one row per entry; drop and recreate as one row
-- per (entry, vending_machine). Safe at this stage — dev-only test data.
drop table if exists public.vending_totals cascade;

create table public.vending_totals (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.collection_entries(id) on delete cascade,
  vending_machine_id uuid not null references public.vending_machines(id),
  cash_collected numeric(10,2) not null default 0 check (cash_collected >= 0),
  coins_collected numeric(10,2) not null default 0 check (coins_collected >= 0),
  unique (entry_id, vending_machine_id)
);

create index on public.vending_totals (entry_id);

alter table public.vending_totals enable row level security;

create policy "vending: follow parent entry read"
  on public.vending_totals for select
  using (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id and (e.employee_id = auth.uid() or public.is_owner())
  ));

create policy "vending: follow parent entry write"
  on public.vending_totals for all
  using (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id
      and ((e.employee_id = auth.uid() and e.created_at > now() - interval '1 hour') or public.is_owner())
  ))
  with check (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id
      and ((e.employee_id = auth.uid() and e.created_at > now() - interval '1 hour') or public.is_owner())
  ));
