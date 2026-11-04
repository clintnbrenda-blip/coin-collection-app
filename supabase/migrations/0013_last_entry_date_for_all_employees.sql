-- "Days since last collection" must be measured from the previous visit by
-- ANYONE, not just the logged-in employee. collection_entries RLS only lets an
-- employee read their own rows, so with two or more collectors the app was
-- computing days (and therefore avg turns and income/day) from that
-- employee's own last visit, which can be much older than the real last visit.
--
-- This returns just a date (no quarters, income, or who collected), so it
-- exposes nothing an employee shouldn't see. Same idea as
-- entries_pending_deposit() in 0006.
--
-- p_before = null  -> the most recent visit overall (new-entry form)
-- p_before = date  -> the most recent visit strictly before that date
--                     (edit form, when re-deriving days for an existing entry)

create or replace function public.last_entry_date(
  p_location_id uuid,
  p_before date default null
)
returns date
language sql
stable
security definer set search_path = public
as $$
  select max(e.date)
  from public.collection_entries e
  where e.location_id = p_location_id
    and (p_before is null or e.date < p_before);
$$;

revoke all on function public.last_entry_date(uuid, date) from public;
grant execute on function public.last_entry_date(uuid, date) to authenticated;

-- Bank deposits are often submitted by a different employee than the one who
-- collected (see 0006). The pending-deposits list shows every entry, but the
-- deposit page looked the entry up with a plain query, which RLS hides from
-- anyone but the collector, so those employees hit "not found". This returns
-- just the visit date for a given entry id.
create or replace function public.entry_date_for_deposit(p_entry_id uuid)
returns date
language sql
stable
security definer set search_path = public
as $$
  select e.date from public.collection_entries e where e.id = p_entry_id;
$$;

revoke all on function public.entry_date_for_deposit(uuid) from public;
grant execute on function public.entry_date_for_deposit(uuid) to authenticated;
