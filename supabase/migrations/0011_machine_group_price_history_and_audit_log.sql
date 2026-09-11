-- Two related features Clint asked for on machine groups:
--
-- 1. Price changes are now dated ("effective date"), not just "whatever it
--    is right now" -- so a price change that actually took effect in the
--    real store on a certain day, but wasn't entered into the app until
--    later, can be corrected retroactively instead of being stuck wrong on
--    every entry submitted in between. machine_groups.price stays as the
--    "current price" convenience column every existing read in the app
--    already uses -- it's just now kept in sync from this history instead
--    of being the only record.
--
-- 2. Every add/retire/reactivate/price-change is logged, so Clint can
--    review what changed and when.

-- ============================================================================
-- PRICE HISTORY
-- ============================================================================
create table public.machine_group_price_history (
  id uuid primary key default gen_random_uuid(),
  machine_group_id uuid not null references public.machine_groups(id) on delete cascade,
  price numeric(10,2) not null check (price > 0),
  effective_date date not null,
  changed_by uuid references public.profiles(id),
  changed_by_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.machine_group_price_history is 'Every price a machine group has had, dated by when it actually took effect in the real store. Lets a forgotten real-world price change be corrected after the fact -- see correct_machine_group_price().';

create index on public.machine_group_price_history (machine_group_id, effective_date);

-- Baseline row for every existing group at its current price, dated well
-- before any real collection data (which starts Dec 2025) -- "as far back
-- as our records go, this was the price" until a real correction says
-- otherwise.
insert into public.machine_group_price_history
  (machine_group_id, price, effective_date, changed_by, changed_by_name)
select id, price, date '2020-01-01', null, 'System (migration baseline)'
from public.machine_groups;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
create table public.machine_group_audit_log (
  id uuid primary key default gen_random_uuid(),
  machine_group_id uuid references public.machine_groups(id) on delete set null,
  machine_group_name text not null, -- snapshot, stays readable even if the group is later gone
  action text not null check (action in ('added', 'retired', 'reactivated', 'price_changed')),
  details jsonb not null default '{}',
  changed_by uuid references public.profiles(id),
  changed_by_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.machine_group_audit_log is 'Human-readable history of every add/retire/reactivate/price change to a machine group.';

create index on public.machine_group_audit_log (created_at desc);

-- ============================================================================
-- RLS -- owner-only, same as machine_groups writes. This is financial
-- configuration detail, not something employees need to see.
-- ============================================================================
alter table public.machine_group_price_history enable row level security;
alter table public.machine_group_audit_log enable row level security;

create policy "price_history: owner reads and writes"
  on public.machine_group_price_history for all
  using (public.is_owner())
  with check (public.is_owner());

create policy "audit_log: owner reads and writes"
  on public.machine_group_audit_log for all
  using (public.is_owner())
  with check (public.is_owner());

-- ============================================================================
-- CORRECTION FUNCTION
--
-- Records a dated price change and, in the same transaction:
--  - retroactively fixes price_at_time on every already-submitted entry
--    whose date falls in the window this price is effective for (from its
--    effective_date up to whatever price change comes next, if any) --
--    entry_group_snapshots' own BEFORE trigger recomputes dollars/turns,
--    and its AFTER trigger rolls that up into collection_entries, so a
--    plain UPDATE here is all it takes;
--  - keeps machine_groups.price in sync as "whatever's effective today";
--  - logs the change (old price, new price, effective date, how many past
--    entries got corrected) to machine_group_audit_log.
-- ============================================================================
create function public.correct_machine_group_price(
  p_machine_group_id uuid,
  p_new_price numeric,
  p_effective_date date,
  p_changed_by uuid,
  p_changed_by_name text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_group_name text;
  v_old_price numeric;
  v_next_effective_date date;
  v_affected_count integer;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can change machine group prices.';
  end if;

  if p_new_price is null or p_new_price <= 0 then
    raise exception 'Price must be a positive number.';
  end if;

  if p_effective_date is null then
    raise exception 'Effective date is required.';
  end if;

  select name, price into v_group_name, v_old_price
    from public.machine_groups where id = p_machine_group_id;

  if v_group_name is null then
    raise exception 'Machine group not found.';
  end if;

  insert into public.machine_group_price_history
    (machine_group_id, price, effective_date, changed_by, changed_by_name)
  values
    (p_machine_group_id, p_new_price, p_effective_date, p_changed_by, p_changed_by_name);

  -- This price holds until whatever change comes after it, if any.
  select min(effective_date) into v_next_effective_date
    from public.machine_group_price_history
    where machine_group_id = p_machine_group_id
      and effective_date > p_effective_date;

  with affected as (
    update public.entry_group_snapshots s
    set price_at_time = p_new_price
    from public.collection_entries e
    where s.entry_id = e.id
      and s.machine_group_id = p_machine_group_id
      and e.date >= p_effective_date
      and (v_next_effective_date is null or e.date < v_next_effective_date)
    returning s.id
  )
  select count(*) into v_affected_count from affected;

  -- Whatever price history row is effective as of today wins -- protects
  -- against a backdated correction accidentally regressing the price
  -- currently used for brand-new entries if something more recent exists.
  update public.machine_groups mg
  set price = h.price
  from (
    select price from public.machine_group_price_history
    where machine_group_id = p_machine_group_id and effective_date <= current_date
    order by effective_date desc, created_at desc
    limit 1
  ) h
  where mg.id = p_machine_group_id;

  insert into public.machine_group_audit_log
    (machine_group_id, machine_group_name, action, details, changed_by, changed_by_name)
  values (
    p_machine_group_id,
    v_group_name,
    'price_changed',
    jsonb_build_object(
      'old_price', v_old_price,
      'new_price', p_new_price,
      'effective_date', p_effective_date,
      'entries_corrected', v_affected_count
    ),
    p_changed_by,
    p_changed_by_name
  );

  return jsonb_build_object('entries_corrected', v_affected_count);
end;
$$;
