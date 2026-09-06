-- Tulip Track · Supabase schema (v2 — self-service groups)
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- Then add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env
--
-- Model: groups are shared. A group has a short join_code. Anyone with the
-- code adds themselves as a member. Each member tracks their OWN attendance;
-- everyone in the group can see everyone's records (transparency).

-- ========================== PROFILES ==========================
-- Display info for each app user. Populated automatically on sign-in by the
-- frontend (upsert in db.ts) — kept separate from auth.users for RLS.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default ''
);

-- ========================== GROUPS ==========================
drop table if exists public.members;
drop table if exists public.attendance;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  join_code text not null unique,
  off_weekdays integer[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ========================== GROUP MEMBERSHIPS ==========================
create table if not exists public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- ========================== ATTENDANCE ==========================
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'excused')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id, date)
);

create index if not exists attendance_group_date_idx on public.attendance (group_id, date);
create index if not exists attendance_date_idx on public.attendance (date);

-- ========================== HOLIDAYS / OFF DAYS ==========================
-- Named off periods (e.g. "Winter break"). Recurring off weekdays live on
-- groups.off_weekdays (0=Sun .. 6=Sat); days that never count toward
-- attendance are excluded from stats and from marking.
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null default '',
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint holidays_range check (starts_on <= ends_on)
);

create index if not exists holidays_group_idx on public.holidays (group_id);

-- ========================== PERSONAL ATTENDANCE ==========================
-- Solo tracking with no group needed. `personal_attendance` holds the two
-- headline numbers ("days supposed to be present" vs "days present");
-- `personal_days` records individual daily marks (present/absent/holiday) so
-- marking a day twice doesn't double-count.  Holiday-marked days contribute
-- nothing to either number.
create table if not exists public.personal_attendance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expected integer not null default 0 check (expected >= 0),
  present integer not null default 0 check (present >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'holiday')),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists personal_days_user_idx on public.personal_days (user_id, date);

-- ========================== ROW LEVEL SECURITY ==========================
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.attendance enable row level security;
alter table public.holidays enable row level security;
alter table public.personal_attendance enable row level security;
alter table public.personal_days enable row level security;

-- Users can always see their own profile; other profiles are visible to
-- people who share a group with them.
create policy profiles_select on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1
      from public.group_memberships shared
      join public.group_memberships mine on mine.group_id = shared.group_id and mine.user_id = auth.uid()
      where shared.user_id = profiles.id
    )
  );

-- Groups: members can view, only the creator can edit/delete.
create policy groups_select on public.groups for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_memberships gm
      where gm.group_id = groups.id and gm.user_id = auth.uid()
    )
  );
create policy groups_insert on public.groups for insert
  with check (created_by = auth.uid());
create policy groups_update on public.groups for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy groups_delete on public.groups for delete
  using (created_by = auth.uid());

-- Memberships: members can see the roster; anyone can add THEMSELVES to a
-- group (this is what the join code does — the code is the gatekeeper at the
-- app layer, RLS also requires you to already be absent from the group).
create policy memberships_select on public.group_memberships for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_memberships mine
      where mine.group_id = group_memberships.group_id and mine.user_id = auth.uid()
    )
  );
create policy memberships_insert on public.group_memberships for insert
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.group_memberships existing
      where existing.group_id = group_memberships.group_id and existing.user_id = auth.uid()
    )
    and exists (select 1 from public.groups g where g.id = group_memberships.group_id)
  );
create policy memberships_delete on public.group_memberships for delete
  using (user_id = auth.uid());

-- Attendance: everyone in a group sees everyone (transparency), but only the
-- owner of a record can create/update/delete it (self-service marking).
create policy attendance_select on public.attendance for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_memberships mine
      where mine.group_id = attendance.group_id and mine.user_id = auth.uid()
    )
  );
create policy attendance_insert on public.attendance for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_memberships mine
      where mine.group_id = attendance.group_id and mine.user_id = auth.uid()
    )
  );
create policy attendance_update on public.attendance for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy attendance_delete on public.attendance for delete
  using (user_id = auth.uid());

-- Holidays: members (people sharing the group) can view; only the creator of
-- the group can add/remove holidays.
create policy holidays_select on public.holidays for select
  using (
    exists (
      select 1 from public.group_memberships mine
      where mine.group_id = holidays.group_id and mine.user_id = auth.uid()
    )
  );
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

-- Personal attendance: completely private — only the owning user can read,
-- insert, or update their own totals and daily marks.
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