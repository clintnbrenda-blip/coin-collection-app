-- Storage bucket for deposit slips, coin collection sheets, coin balance sheets.
-- Private bucket — access goes through RLS-checked signed URLs, not public links.

insert into storage.buckets (id, name, public)
values ('entry-photos', 'entry-photos', false)
on conflict (id) do nothing;

-- Path convention: {entry_id}/{filename} — lets us check ownership via the entry.
create policy "entry-photos: read own or owner"
  on storage.objects for select
  using (
    bucket_id = 'entry-photos'
    and exists (
      select 1 from public.collection_entries e
      where e.id::text = (storage.foldername(name))[1]
        and (e.employee_id = auth.uid() or public.is_owner())
    )
  );

create policy "entry-photos: upload own within window or owner"
  on storage.objects for insert
  with check (
    bucket_id = 'entry-photos'
    and exists (
      select 1 from public.collection_entries e
      where e.id::text = (storage.foldername(name))[1]
        and ((e.employee_id = auth.uid() and e.created_at > now() - interval '1 hour') or public.is_owner())
    )
  );

create policy "entry-photos: delete own within window or owner"
  on storage.objects for delete
  using (
    bucket_id = 'entry-photos'
    and exists (
      select 1 from public.collection_entries e
      where e.id::text = (storage.foldername(name))[1]
        and ((e.employee_id = auth.uid() and e.created_at > now() - interval '1 hour') or public.is_owner())
    )
  );
