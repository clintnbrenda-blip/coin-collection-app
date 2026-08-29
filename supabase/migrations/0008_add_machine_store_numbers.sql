-- Physical machine numbers as labeled in the store, per Clint's real paper
-- checklist ("Printable For Coin Collection.xlsx") — free text, not a
-- simple range, since some groups span non-contiguous numbers (the
-- Wascomat group is machines 10-11 AND 15-16, not one continuous run).
-- Nullable and editable later from /dashboard/machine-groups, since this
-- can change if machines get replaced or renumbered.
alter table public.machine_groups
  add column if not exists store_numbers text;

update public.machine_groups set store_numbers = '1' where name = '50 lb Speed Queen Washer';
update public.machine_groups set store_numbers = '2-5' where name = '50 lb Continental Washer';
update public.machine_groups set store_numbers = '8-9' where name = '80 lb IPSO Washer';
update public.machine_groups set store_numbers = '10-11, 15-16' where name = '20 lb Wascomat Washer (W620 CC)';
update public.machine_groups set store_numbers = '12-14' where name = '20 lb Huebsch Washer';
update public.machine_groups set store_numbers = '17-23' where name = '30 lb Dexter Washer (T400)';
update public.machine_groups set store_numbers = '24-28' where name = '40 lb Dexter Washer (T600)';
-- Dryers intentionally left null — the source sheet doesn't number them.
