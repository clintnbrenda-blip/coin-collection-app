-- Checklist items move from hardcoded (src/lib/checklist.ts) into the DB so
-- the owner can edit wording/sections himself from a new /dashboard/checklist
-- page, without needing a code change every time.
--
-- `key` (not `id`) is what checklist_completions.checked_items stores — kept
-- as a separate stable column, seeded here to match the exact strings the
-- old hardcoded array used, so every existing historical completion still
-- matches correctly against these rows with zero data migration needed.
-- Any NEW item added later just gets its own id used as its key (see
-- addChecklistItem in dashboard/checklist/actions.ts) — nothing about that
-- needs to be exposed to the owner, it's internal plumbing.
--
-- Text values below use $txt$...$txt$ dollar-quoting rather than plain
-- '...' single quotes. Single-quoted long text values got silently
-- corrupted somewhere in the copy path when this was applied by hand
-- through the Supabase SQL Editor (symptom: "relation X does not exist",
-- where X was an arbitrary word from partway through the sentence — the
-- closing quote was landing in the wrong place). Short values were
-- unaffected; only the longer sentences tripped it. Dollar-quoting sidesteps
-- the issue entirely and is a good habit for any nontrivial string literal
-- applied this way in the future.
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  key text not null,
  section text not null,
  text text not null,
  display_order integer not null default 0,
  active boolean not null default true, -- false = retired, kept for historical entries that referenced it
  created_at timestamptz not null default now()
);

create unique index if not exists checklist_items_location_key_idx
  on public.checklist_items (location_id, key);

comment on table public.checklist_items is 'Owner-editable checklist steps. Retiring (active=false) instead of deleting keeps historical entries'' checked/unchecked state intact for items no longer in current use.';

alter table public.checklist_items enable row level security;

drop policy if exists "checklist_items: any authenticated user reads" on public.checklist_items;
create policy "checklist_items: any authenticated user reads"
  on public.checklist_items for select
  using (auth.role() = 'authenticated');

drop policy if exists "checklist_items: owner writes" on public.checklist_items;
create policy "checklist_items: owner writes"
  on public.checklist_items for all
  using (public.is_owner())
  with check (public.is_owner());

-- Seed with the exact items/keys/sections/order the hardcoded array had.
insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'washers_dryers_collected', 'Washers and Dryers', $txt$Collect coins from all washers and record totals.$txt$, 1
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'dryers_collected', 'Washers and Dryers', $txt$Collect coins from all dryers and record totals.$txt$, 2
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'vending_collected', 'Washers and Dryers', $txt$Remove all cash and coins from snack and soda vending machines and record totals.$txt$, 3
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'changer_cash_to_pouch', 'Money changers', $txt$Open and remove cash from changers. Put cash into the zipper bank pouch. Put the pouch into the safe until ready to leave.$txt$, 4
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'changer_refill_coin_boxes', 'Money changers', $txt$Refill coin boxes in changers.$txt$, 5
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'leftover_coins_to_safe', 'Money changers', $txt$Put leftover coins into containers in the safe.$txt$, 6
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'check_staff_container_balance', 'Money changers', $txt$Check the balance of coins in the small container used for staff use.$txt$, 7
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'leave_40_start_new_balance', 'Money changers', $txt$Leave at least $40 in that container and start a new balance paper.$txt$, 8
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'check_lock_box_cash', 'Money changers', $txt$Check cash in the lock box.$txt$, 9
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;

insert into public.checklist_items (location_id, key, section, text, display_order)
select id, 'bank_deposit', 'Money changers', $txt$Take cash to the bank deposit.$txt$, 10
from public.locations where name = 'Main Location'
on conflict (location_id, key) do nothing;
