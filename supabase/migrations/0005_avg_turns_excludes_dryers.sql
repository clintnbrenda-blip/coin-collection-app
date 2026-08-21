-- Bug fix: avg_turns was averaging across ALL machine groups including dryers.
-- Dryer "turns" is a totally different metric (group total hours-of-use/day,
-- typically 70-90+) vs washer turns (per-machine cycles/day, typically 2-6) —
-- mixing them massively inflates the average. Confirmed against the owner's
-- real spreadsheet: its monthly average-turns formula (e.g. `=SUM(AG4:AG10)/6`)
-- explicitly stops before the dryer row. avg_turns should only average washer
-- groups, matching that.

create or replace function public.recompute_entry_totals()
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

  select avg(s.turns) into v_avg_turns
    from public.entry_group_snapshots s
    join public.machine_groups mg on mg.id = s.machine_group_id
    where s.entry_id = v_entry_id and s.quarters_collected > 0 and mg.type = 'washer';

  select days_since_last into v_days from public.collection_entries where id = v_entry_id;

  update public.collection_entries
    set total_income = v_total,
        avg_turns = v_avg_turns,
        income_per_day = case when v_days > 0 then v_total / v_days else null end
    where id = v_entry_id;

  return null;
end;
$$;

-- Force every existing entry to recompute avg_turns under the corrected logic.
-- (the `where true` is only there to satisfy Supabase's "missing WHERE clause"
-- safety check — we do intend to touch every row.)
update public.entry_group_snapshots set quarters_collected = quarters_collected where true;
