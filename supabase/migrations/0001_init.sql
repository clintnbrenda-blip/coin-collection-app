-- Coin Collection Tracker — initial schema
-- Matches Coin Collection Tracker.docx spec, formulas validated against the owner's
-- real spreadsheet (2026 Coin collection.xlsx).

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- PROFILES (extends auth.users with role + display name)
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('owner', 'employee')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per app user. Role drives permissions: owner = full access, employee = submit/edit-own-recent only.';

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'employee');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the current user the owner?
create function public.is_owner()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- ============================================================================
-- LOCATIONS
-- ============================================================================
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.locations (name) values ('Main Location');

-- ============================================================================
-- MACHINE GROUPS (current qty/price — entries snapshot these at creation time)
-- ============================================================================
create table public.machine_groups (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  name text not null,
  type text not null check (type in ('washer', 'dryer')),
  qty integer not null check (qty > 0),
  price numeric(10,2) not null check (price > 0),
  display_order integer not null default 0,
  active boolean not null default true, -- false = retired, kept for historical reporting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.machine_groups is 'A group of identical machines (not one physical unit). Editing qty/price only affects future entries — past entries keep their own snapshot.';

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_machine_groups_updated_at
  before update on public.machine_groups
  for each row execute function public.touch_updated_at();

-- Seed with the owner's current machine groups (see spec Section 2).
insert into public.machine_groups (location_id, name, type, qty, price, display_order)
select id, v.name, v.type, v.qty, v.price, v.display_order
from public.locations, (values
  ('50 lb Speed Queen Washer', 'washer', 1, 6.00, 1),
  ('50 lb Continental Washer', 'washer', 4, 6.50, 2),
  ('80 lb IPSO Washer', 'washer', 2, 9.50, 3),
  ('20 lb Wascomat Washer (W620 CC)', 'washer', 4, 3.50, 4),
  ('20 lb Huebsch Washer', 'washer', 3, 3.50, 5),
  ('30 lb Dexter Washer (T400)', 'washer', 7, 4.50, 6),
  ('40 lb Dexter Washer (T600)', 'washer', 5, 5.50, 7),
  ('Dryers', 'dryer', 20, 0.25, 8)
) as v(name, type, qty, price, display_order)
where locations.name = 'Main Location';

-- ============================================================================
-- COLLECTION ENTRIES (one per visit)
-- ============================================================================
create table public.collection_entries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  employee_id uuid not null references public.profiles(id),
  date date not null,
  days_since_last numeric(6,2) not null check (days_since_last > 0),
  -- aggregates recomputed by trigger whenever entry_group_snapshots change
  total_income numeric(12,2),
  avg_turns numeric(10,4),
  income_per_day numeric(12,2),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  unique (location_id, date) -- one visit per day per location — see spec decision
);

comment on table public.collection_entries is 'One row per collection visit. total_income/avg_turns/income_per_day are maintained by triggers on entry_group_snapshots.';

create index on public.collection_entries (location_id, date desc);
create index on public.collection_entries (employee_id);

-- ============================================================================
-- ENTRY GROUP SNAPSHOTS (per machine group, per entry)
-- ============================================================================
create table public.entry_group_snapshots (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.collection_entries(id) on delete cascade,
  machine_group_id uuid not null references public.machine_groups(id),
  qty_at_time integer not null,
  price_at_time numeric(10,2) not null,
  quarters_collected integer not null default 0 check (quarters_collected >= 0),
  -- computed by trigger, matching the spreadsheet formulas exactly:
  dollars numeric(12,2),
  turns numeric(10,4),
  unique (entry_id, machine_group_id)
);

comment on table public.entry_group_snapshots is 'qty_at_time/price_at_time are frozen at entry creation so later price edits never change past turns/income. dollars/turns computed by trigger per spec Section 3.';

create index on public.entry_group_snapshots (entry_id);
create index on public.entry_group_snapshots (machine_group_id);

-- Compute dollars/turns per the spec's exact formulas.
-- Washer: dollars = quarters * 0.25 ; turns = (dollars/qty)/price/days_since_last
-- Dryer:  dollars = quarters * 0.25 ; turns = (quarters*8/60)/days_since_last  (group total hours/day, NOT per-machine)
create function public.compute_entry_group_snapshot()
returns trigger
language plpgsql
as $$
declare
  v_days numeric;
  v_type text;
begin
  select days_since_last into v_days from public.collection_entries where id = new.entry_id;
  select type into v_type from public.machine_groups where id = new.machine_group_id;

  if v_days is null or v_days <= 0 then
    raise exception 'collection_entries.days_since_last must be a positive number before snapshots can be computed';
  end if;

  new.dollars := round(new.quarters_collected * 0.25, 2);

  if v_type = 'dryer' then
    new.turns := (new.quarters_collected * 8.0 / 60) / v_days;
  else
    new.turns := (new.dollars / new.qty_at_time) / new.price_at_time / v_days;
  end if;

  return new;
end;
$$;

create trigger trg_compute_entry_group_snapshot
  before insert or update on public.entry_group_snapshots
  for each row execute function public.compute_entry_group_snapshot();

-- Roll snapshot changes up into the parent entry's aggregates.
-- total_income = sum(dollars) ; avg_turns = avg(turns) where quarters > 0 ; income_per_day = total_income/days_since_last
create function public.recompute_entry_totals()
returns trigger
language plpgsql
as $$
declare
  v_entry_id uuid;
  v_total numeric;
  v_avg_turns numeric;
  v_days numeric;
begin
  v_entry_id := coalesce(new.entry_id, old.entry_id);

  select coalesce(sum(dollars), 0) into v_total
    from public.entry_group_snapshots where entry_id = v_entry_id;

  select avg(turns) into v_avg_turns
    from public.entry_group_snapshots where entry_id = v_entry_id and quarters_collected > 0;

  select days_since_last into v_days from public.collection_entries where id = v_entry_id;

  update public.collection_entries
    set total_income = v_total,
        avg_turns = v_avg_turns,
        income_per_day = case when v_days > 0 then v_total / v_days else null end
    where id = v_entry_id;

  return null;
end;
$$;

create trigger trg_recompute_entry_totals
  after insert or update or delete on public.entry_group_snapshots
  for each row execute function public.recompute_entry_totals();

-- If days_since_last is edited after snapshots already exist, recompute everything.
create function public.recompute_on_days_change()
returns trigger
language plpgsql
as $$
begin
  if new.days_since_last is distinct from old.days_since_last then
    update public.entry_group_snapshots
      set quarters_collected = quarters_collected -- no-op update triggers recompute
      where entry_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_entry_days_changed
  after update on public.collection_entries
  for each row execute function public.recompute_on_days_change();

-- ============================================================================
-- VENDING (snack/soda — income only, no turns)
-- ============================================================================
create table public.vending_totals (
  entry_id uuid primary key references public.collection_entries(id) on delete cascade,
  cash_collected numeric(10,2) not null default 0 check (cash_collected >= 0),
  coins_collected numeric(10,2) not null default 0 check (coins_collected >= 0)
);

-- ============================================================================
-- BANK DEPOSIT
-- ============================================================================
create table public.deposits (
  entry_id uuid primary key references public.collection_entries(id) on delete cascade,
  deposit_amount numeric(10,2) not null check (deposit_amount >= 0),
  deposit_slip_photo_path text -- path within the 'entry-photos' storage bucket
);

-- ============================================================================
-- CHECKLIST COMPLETION (checklist item text is hardcoded in-app, see spec 4a)
-- ============================================================================
create table public.checklist_completions (
  entry_id uuid primary key references public.collection_entries(id) on delete cascade,
  checked_items text[] not null default '{}', -- keys of hardcoded checklist items checked off
  signed_by text not null,
  signed_date date not null
);

-- ============================================================================
-- PHOTOS (deposit slip, coin collection sheet, coin balance sheet, other)
-- ============================================================================
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.collection_entries(id) on delete cascade,
  storage_path text not null, -- path within the 'entry-photos' storage bucket
  kind text not null check (kind in ('deposit_slip', 'coin_collection_sheet', 'coin_balance_sheet', 'other')),
  uploaded_at timestamptz not null default now()
);

create index on public.photos (entry_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.machine_groups enable row level security;
alter table public.collection_entries enable row level security;
alter table public.entry_group_snapshots enable row level security;
alter table public.vending_totals enable row level security;
alter table public.deposits enable row level security;
alter table public.checklist_completions enable row level security;
alter table public.photos enable row level security;

-- profiles
create policy "profiles: read own or owner reads all"
  on public.profiles for select
  using (id = auth.uid() or public.is_owner());

create policy "profiles: owner manages all, user updates own name"
  on public.profiles for update
  using (id = auth.uid() or public.is_owner());

create policy "profiles: owner deletes"
  on public.profiles for delete
  using (public.is_owner());

-- locations — read-only for everyone signed in for now (single location)
create policy "locations: any authenticated user reads"
  on public.locations for select
  using (auth.role() = 'authenticated');

-- machine_groups
create policy "machine_groups: any authenticated user reads"
  on public.machine_groups for select
  using (auth.role() = 'authenticated');

create policy "machine_groups: owner writes"
  on public.machine_groups for all
  using (public.is_owner())
  with check (public.is_owner());

-- collection_entries
create policy "entries: own or owner reads"
  on public.collection_entries for select
  using (employee_id = auth.uid() or public.is_owner());

create policy "entries: employee inserts own"
  on public.collection_entries for insert
  with check (employee_id = auth.uid());

create policy "entries: own within 1hr, or owner, updates"
  on public.collection_entries for update
  using (
    (employee_id = auth.uid() and created_at > now() - interval '1 hour')
    or public.is_owner()
  );

create policy "entries: own within 1hr, or owner, deletes"
  on public.collection_entries for delete
  using (
    (employee_id = auth.uid() and created_at > now() - interval '1 hour')
    or public.is_owner()
  );

-- entry_group_snapshots / vending_totals / deposits / checklist_completions / photos
-- all follow the parent entry's permissions.
create policy "snapshots: follow parent entry read"
  on public.entry_group_snapshots for select
  using (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id and (e.employee_id = auth.uid() or public.is_owner())
  ));

create policy "snapshots: follow parent entry write"
  on public.entry_group_snapshots for all
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

create policy "deposits: follow parent entry read"
  on public.deposits for select
  using (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id and (e.employee_id = auth.uid() or public.is_owner())
  ));
create policy "deposits: follow parent entry write"
  on public.deposits for all
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

create policy "checklist: follow parent entry read"
  on public.checklist_completions for select
  using (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id and (e.employee_id = auth.uid() or public.is_owner())
  ));
create policy "checklist: follow parent entry write"
  on public.checklist_completions for all
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

create policy "photos: follow parent entry read"
  on public.photos for select
  using (exists (
    select 1 from public.collection_entries e
    where e.id = entry_id and (e.employee_id = auth.uid() or public.is_owner())
  ));
create policy "photos: follow parent entry write"
  on public.photos for all
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
