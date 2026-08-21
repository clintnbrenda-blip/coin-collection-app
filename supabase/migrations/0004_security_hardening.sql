-- Security hardening: RLS's USING clause on a few "own row" policies allows
-- any authenticated user to write to their own row via direct API calls
-- (bypassing the app's server-side role checks entirely), with no column
-- restriction. Two real gaps closed here with BEFORE UPDATE triggers,
-- since RLS policies alone can't compare NEW vs OLD column values:
--
-- 1. profiles: an employee could self-promote by calling
--    `update profiles set role='owner' where id=auth.uid()` directly —
--    the "own row" USING clause has no WITH CHECK restricting which
--    columns change. Now blocked unless the actor is already owner.
-- 2. collection_entries: an employee could reassign their own entry to a
--    different employee_id/location_id via direct API, same root cause.
--    Now blocked unless the actor is owner.

create function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_owner() then
    if new.role is distinct from old.role then
      raise exception 'Only the owner can change a profile''s role.';
    end if;
    if new.active is distinct from old.active then
      raise exception 'Only the owner can change a profile''s active status.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_profile_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_privilege_escalation();

create function public.prevent_entry_reassignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_owner() then
    if new.employee_id is distinct from old.employee_id then
      raise exception 'Only the owner can reassign an entry to a different employee.';
    end if;
    if new.location_id is distinct from old.location_id then
      raise exception 'Only the owner can move an entry to a different location.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_entry_reassignment
  before update on public.collection_entries
  for each row execute function public.prevent_entry_reassignment();
