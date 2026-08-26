-- Splits bank deposit entry from coin collection entry: a *different*
-- employee than the original collector may be the one who takes the deposit
-- to the bank and records it, possibly much later (bank hours, delays).
-- Deposits therefore need to be writable/readable by any authenticated
-- employee, not just the entry's own employee_id — unlike everything else
-- (quarters, checklist), which stays tied to the original collector.

drop policy if exists "deposits: follow parent entry read" on public.deposits;
drop policy if exists "deposits: follow parent entry write" on public.deposits;

create policy "deposits: any authenticated user reads"
  on public.deposits for select
  using (auth.role() = 'authenticated');

create policy "deposits: any authenticated user writes"
  on public.deposits for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Deposit slip photos: same reasoning — whoever submits the deposit needs to
-- be able to upload the slip photo, regardless of who collected the coins.
drop policy if exists "entry-photos: upload own within window or owner" on storage.objects;

create policy "entry-photos: any authenticated user uploads"
  on storage.objects for insert
  with check (bucket_id = 'entry-photos' and auth.role() = 'authenticated');

-- Minimal, privacy-conscious helper for the "pending deposits" list: returns
-- just id + date for entries with no deposit recorded yet, without exposing
-- quarters/income/turns to employees who didn't collect that entry (the main
-- collection_entries table stays locked down to "own or owner" as before).
create or replace function public.entries_pending_deposit()
returns table (id uuid, date date)
language sql
stable
security definer set search_path = public
as $$
  select e.id, e.date
  from public.collection_entries e
  where not exists (select 1 from public.deposits d where d.entry_id = e.id)
  order by e.date desc;
$$;

grant execute on function public.entries_pending_deposit() to authenticated;
