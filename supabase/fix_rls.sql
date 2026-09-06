-- Tulip Track · RLS / recursion fix (run in Supabase SQL Editor, AFTER schema.sql)
-- Safe to re-run. Does NOT touch tables or data.
--
-- Fixes:
--   1. "infinite recursion detected in policy for relation group_memberships"
--   2. missing INSERT/UPDATE policies on profiles (upsert 500 `on_conflict=id`)
--   3. join-by-code blocked because groups_select hides groups from non-members
--
-- Root cause of #1: every membership check did `exists(select 1 from
-- group_memberships ...)` inside a policy, but scanning group_memberships fires
-- memberships_select again -> recursion. Solved with SECURITY DEFINER helper
-- functions that run as the table owner and never re-enter RLS.

-- ========================== HELPERS ==========================
-- Is the current user a member of p_group?
create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_memberships
    where group_id = p_group and user_id = auth.uid()
  );
$$;

-- Join a group by its public join code. The code is the gatekeeper; running
-- as owner lets a non-member look the group up and add themselves WITHOUT
-- exposing group rows through normal RLS.
create or replace function public.join_group(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usr uuid := auth.uid();
  g public.groups%rowtype;
begin
  if usr is null then
    raise exception 'Not signed in';
  end if;

  select * into g
  from public.groups
  where upper(join_code) = upper(p_code)
  limit 1;

  if not found then
    raise exception 'No group found with that code. Ask the creator to double-check it.';
  end if;

  -- idempotent: joining again is a no-op and still returns the group
  insert into public.group_memberships (group_id, user_id)
  values (g.id, usr)
  on conflict (group_id, user_id) do nothing;

  return to_jsonb(g);
end;
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.join_group(text) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ========================== PROFILES ==========================
-- The old schema only allowed SELECT on your own profile; ensureProfile
-- (upsert on conflict=id) needs INSERT + UPDATE too.
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;

create policy profiles_select on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.group_memberships shared
      where shared.user_id = profiles.id
        and public.is_group_member(shared.group_id)
    )
  );
create policy profiles_insert on public.profiles for insert
  with check (auth.uid() = id);
create policy profiles_update on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- ========================== GROUPS ==========================
drop policy if exists groups_select on public.groups;
drop policy if exists groups_insert on public.groups;
drop policy if exists groups_update on public.groups;
drop policy if exists groups_delete on public.groups;

create policy groups_select on public.groups for select
  using (created_by = auth.uid() or public.is_group_member(groups.id));
create policy groups_insert on public.groups for insert
  with check (created_by = auth.uid());
create policy groups_update on public.groups for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy groups_delete on public.groups for delete
  using (created_by = auth.uid());

-- ========================== GROUP MEMBERSHIPS ==========================
drop policy if exists memberships_select on public.group_memberships;
drop policy if exists memberships_insert on public.group_memberships;
drop policy if exists memberships_delete on public.group_memberships;

create policy memberships_select on public.group_memberships for select
  using (
    user_id = auth.uid()
    or public.is_group_member(group_memberships.group_id)
  );
create policy memberships_insert on public.group_memberships for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.group_memberships existing_m
      where existing_m.group_id = group_memberships.group_id
        and existing_m.user_id = auth.uid()
    )
    and exists (select 1 from public.groups g where g.id = group_memberships.group_id)
  );
create policy memberships_delete on public.group_memberships for delete
  using (user_id = auth.uid());

-- ========================== ATTENDANCE ==========================
drop policy if exists attendance_select on public.attendance;
drop policy if exists attendance_insert on public.attendance;
drop policy if exists attendance_update on public.attendance;
drop policy if exists attendance_delete on public.attendance;

create policy attendance_select on public.attendance for select
  using (user_id = auth.uid() or public.is_group_member(attendance.group_id));
create policy attendance_insert on public.attendance for insert
  with check (user_id = auth.uid() and public.is_group_member(attendance.group_id));
create policy attendance_update on public.attendance for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy attendance_delete on public.attendance for delete
  using (user_id = auth.uid());

-- ========================== HOLIDAYS ==========================
drop policy if exists holidays_select on public.holidays;
drop policy if exists holidays_insert on public.holidays;
drop policy if exists holidays_delete on public.holidays;

create policy holidays_select on public.holidays for select
  using (public.is_group_member(holidays.group_id));
create policy holidays_insert on public.holidays for insert
  with check (
    exists (
      select 1 from public.groups g
      where g.id = holidays.group_id and g.created_by = auth.uid()
    )
  );
create policy holidays_delete on public.holidays for delete
  using (
    exists (
      select 1 from public.groups g
      where g.id = holidays.group_id and g.created_by = auth.uid()
    )
  );

-- ========================== PERSONAL (private, unchanged) ==========================
drop policy if exists personal_att_select on public.personal_attendance;
drop policy if exists personal_att_insert on public.personal_attendance;
drop policy if exists personal_att_update on public.personal_attendance;
drop policy if exists personal_days_select on public.personal_days;
drop policy if exists personal_days_insert on public.personal_days;
drop policy if exists personal_days_update on public.personal_days;
drop policy if exists personal_days_delete on public.personal_days;

create policy personal_att_select on public.personal_attendance for select
  using (user_id = auth.uid());
create policy personal_att_insert on public.personal_attendance for insert
  with check (user_id = auth.uid());
create policy personal_att_update on public.personal_attendance for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy personal_days_select on public.personal_days for select
  using (user_id = auth.uid());
create policy personal_days_insert on public.personal_days for insert
  with check (user_id = auth.uid());
create policy personal_days_update on public.personal_days for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy personal_days_delete on public.personal_days for delete
  using (user_id = auth.uid());