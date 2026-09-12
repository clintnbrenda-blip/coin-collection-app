-- Bug: the vending "Coins collected" field has always meant a count of
-- quarters (the physical coins pulled from the machine), but the app stored
-- whatever number was typed in directly as a dollar amount, with no
-- conversion. Every vending_totals.coins_collected value on record is
-- therefore 4x too high (e.g. 40 quarters = $10, but the app has $40 on
-- file). Cash collected is unaffected -- that one's always been correct.
--
-- Fix mirrors how machine groups already handle quarters
-- (entry_group_snapshots.dollars = quarters_collected * 0.25): add a real
-- quarters_collected count column, and make coins_collected a value the
-- database computes from it via trigger, not something the app sets
-- directly -- so this exact class of bug (a raw count treated as dollars)
-- can't happen again.

alter table public.vending_totals
  add column quarters_collected integer not null default 0 check (quarters_collected >= 0);

-- Every existing coins_collected value IS the quarters count that was
-- actually typed in (that's the bug) -- capture it before the column's
-- meaning changes below.
update public.vending_totals
set quarters_collected = round(coins_collected)::integer;

comment on column public.vending_totals.quarters_collected is 'Raw count of quarters collected from the machine -- coins_collected is computed from this, not set directly.';
comment on column public.vending_totals.coins_collected is 'Computed by trigger as quarters_collected * 0.25 -- do not set directly.';

create function public.compute_vending_coins()
returns trigger
language plpgsql
as $$
begin
  new.coins_collected := round(new.quarters_collected * 0.25, 2);
  return new;
end;
$$;

create trigger trg_compute_vending_coins
  before insert or update on public.vending_totals
  for each row execute function public.compute_vending_coins();

-- Correct every already-submitted entry now that quarters_collected is
-- populated -- a genuine UPDATE, so the trigger above fires per row and
-- recomputes coins_collected correctly. This is the actual historical fix.
update public.vending_totals
set quarters_collected = quarters_collected;
