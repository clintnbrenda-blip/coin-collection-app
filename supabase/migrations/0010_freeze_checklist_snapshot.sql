-- A historical entry's checklist should be completely detached from the
-- checklist_items that will be used going forward — editing, retiring, or
-- deleting a checklist item today must never change what an already-
-- submitted entry displays. Previously, checklist_completions only stored
-- `checked_items` (an array of keys) and the display page resolved those
-- keys against the LIVE checklist_items table every time it was viewed —
-- which is exactly why deleting a used item was unsafe.
--
-- items_snapshot freezes the whole picture at submit time: every item that
-- was on the form, its section/text as written then, and whether it was
-- checked — mirroring the qty_at_time/price_at_time pattern
-- entry_group_snapshots already uses for machine groups.
alter table public.checklist_completions
  add column if not exists items_snapshot jsonb;

comment on column public.checklist_completions.items_snapshot is 'Frozen at submit/edit time: [{section, text, checked}, ...] — independent of the current checklist_items table.';

-- Backfill every existing row using today's checklist_items definitions,
-- matched against each row's already-stored checked_items keys. This is a
-- best-effort reconstruction (older item wording may have since changed —
-- there's no better historical record available for rows written before
-- this migration existed), but it's still strictly more accurate and more
-- durable than the old live-lookup behavior it replaces.
update public.checklist_completions cc
set items_snapshot = (
  select jsonb_agg(
    jsonb_build_object(
      'section', ci.section,
      'text', ci.text,
      'checked', ci.key = any(cc.checked_items)
    )
    order by ci.display_order
  )
  from public.checklist_items ci
  join public.collection_entries ce on ce.id = cc.entry_id
  where ci.location_id = ce.location_id
)
where items_snapshot is null;
