-- All 53 entries currently showing on the "pending deposit" list are
-- historical/imported data (created via one-off import scripts on
-- 2026-08-21 through 2026-08-26, well before real day-to-day use of the
-- deposit-tracking feature) — that money was already banked the old way,
-- long before this app could track it per-entry, and will never get a real
-- deposit record here. They were just cluttering the list for the owner.
--
-- Fixed cutoff, not a rolling "now()" — this must exclude exactly what
-- already existed at cleanup time and nothing else, so every entry
-- genuinely submitted through the app from here on still shows up and
-- needs a real deposit as normal. Confirmed before writing this: as of the
-- cutoff below, NOT ONE entry in the table had ever been created through a
-- real app submission — every existing row was historical import data.
create or replace function public.entries_pending_deposit()
returns table (id uuid, date date)
language sql
stable
security definer set search_path = public
as $$
  select e.id, e.date
  from public.collection_entries e
  where not exists (select 1 from public.deposits d where d.entry_id = e.id)
    and e.created_at > timestamptz '2026-08-27T00:16:35+00:00'
  order by e.date desc;
$$;
