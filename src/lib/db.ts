import type {
  AttendanceRow,
  AttendanceStatus,
  Group,
  HolidayEvent,
  Membership,
  PersonalDay,
  PersonalStatus,
  ProfileUser,
  User,
} from "./types";
import { toISO, dateRange, dayIndex } from "./dates";

// ---------------------------------------------------------------------------
// Backend selection: real Supabase when env vars are present, otherwise a
// self-contained demo mode backed by localStorage. This lets the app run
// immediately (and on first login) without any credentials.
//
// v2 data model: groups are SHARED. A group has a join_code; anyone with the
// code joins. Each member tracks their OWN attendance (self-service), and
// everyone in a group can see everyone's records (transparency).
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const backendMode: "supabase" | "demo" =
  SUPABASE_URL && SUPABASE_ANON_KEY ? "supabase" : "demo";

const DEMO_DB_KEY = "tulip.demo.db.v2";
const DEMO_DB_KEY_V1 = "tulip.demo.db.v1";
const DEMO_SESSION_KEY = "tulip.demo.session.v1";

interface DemoUserRec {
  email: string;
  password: string;
  name: string;
  created_at: string;
}

interface DemoDB {
  version: 2;
  users: Record<string, DemoUserRec>;
  groups: Group[];
  memberships: Membership[];
  attendance: AttendanceRow[];
  holidays: HolidayEvent[];
  personal: Record<string, { expected: number; present: number }>;
  personal_days: PersonalDay[];
}

function newID(prefix = ""): string {
  const rnd = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

// Join codes: short, unambiguous (no O/0/I/1) uppercase codes.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function makeJoinCode(): string {
  const arr = new Uint8Array(CODE_LENGTH);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < CODE_LENGTH; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
  return out;
}

let demoDB: DemoDB | null = null;

function member(groupId: string, userId: string): Membership {
  return { id: newID(), group_id: groupId, user_id: userId, joined_at: new Date().toISOString() };
}

/** Fill in defaults for values that older v2 data may lack (normalisation). */
function normalizeDB(db: DemoDB): DemoDB {
  if (!Array.isArray(db.holidays)) db.holidays = [];
  if (db.personal == null || typeof db.personal !== "object") db.personal = {};
  if (!Array.isArray(db.personal_days)) db.personal_days = [];
  for (const g of db.groups) {
    if (!Array.isArray(g.off_weekdays)) g.off_weekdays = [];
  }
  return db;
}

/** Migrate the old (owner-based) demo database into the v2 shared-groups
 *  format. Old member cards become real demo accounts so the seeded roster
 *  stays intact. */
function migrateV1() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DEMO_DB_KEY_V1);
  } catch {
    return;
  }
  if (!raw) return;
  try {
    const old = JSON.parse(raw) as {
      users?: Record<string, DemoUserRec>;
      groups?: any[];
      members?: any[];
      attendance?: any[];
    };
    const db: DemoDB = {
      version: 2,
      users: old.users ?? {},
      groups: [],
      memberships: [],
      attendance: [],
      holidays: [],
      personal: {},
      personal_days: [],
    };

    const memberUser: Record<string, string> = {};

    for (const g of old.groups ?? []) {
      db.groups.push({
        id: g.id ?? newID(),
        created_by: g.user_id ?? "demo",
        name: g.name ?? "Untitled group",
        description: g.description ?? "",
        join_code: makeJoinCode(),
        off_weekdays: [],
        created_at: g.created_at ?? new Date().toISOString(),
      });
      if (g.user_id) db.memberships.push(member(g.id, g.user_id));
    }

    for (const m of old.members ?? []) {
      const groupId = m.group_id;
      if (!db.groups.find((g) => g.id === groupId)) continue;
      const email = ((m.email || "").trim() || `${slugify(m.name || "member")}@school.demo`).toLowerCase();
      let uid = Object.keys(db.users).find((k) => db.users[k].email === email);
      if (!uid) {
        uid = `user_${newID().slice(0, 8)}`;
        db.users[uid] = {
          email,
          password: "demo1234",
          name: m.name || email.split("@")[0],
          created_at: m.created_at ?? new Date().toISOString(),
        };
      }
      memberUser[m.id] = uid;
      db.memberships.push(member(groupId, uid));
    }

    for (const a of old.attendance ?? []) {
      const uid = memberUser[a.member_id];
      if (!uid || !db.groups.find((g) => g.id === a.group_id)) continue;
      db.attendance.push({
        id: a.id ?? newID(),
        group_id: a.group_id,
        user_id: uid,
        date: a.date,
        status: a.status,
        created_at: a.created_at,
      });
    }

    localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
    localStorage.removeItem(DEMO_DB_KEY_V1);
    demoDB = db;
  } catch {
    /* corrupted v1 — just start fresh */
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
}

function loadDemo(): DemoDB {
  if (demoDB) return demoDB;
  migrateV1();
  try {
    const raw = localStorage.getItem(DEMO_DB_KEY);
    if (raw) {
      demoDB = normalizeDB(JSON.parse(raw) as DemoDB);
      return demoDB;
    }
  } catch {
    /* corrupted -> fresh */
  }
  demoDB = normalizeDB({ version: 2, users: {}, groups: [], memberships: [], attendance: [], holidays: [], personal: {}, personal_days: [] });
  return demoDB;
}

function saveDemo() {
  try {
    if (demoDB) localStorage.setItem(DEMO_DB_KEY, JSON.stringify(demoDB));
  } catch {
    /* storage might be full — swallow */
  }
}

function demoUser(): User | null {
  const id = localStorage.getItem(DEMO_SESSION_KEY);
  if (!id || !demoDB || !demoDB.users[id]) return null;
  const u = demoDB.users[id];
  return { id, email: u.email, name: u.name, isDemo: true };
}

function setDemoSession(id: string | null) {
  if (id) localStorage.setItem(DEMO_SESSION_KEY, id);
  else localStorage.removeItem(DEMO_SESSION_KEY);
}

// ---------------------------------------------------------------------------
// Supabase backend
// ---------------------------------------------------------------------------

let supabase: any = null;

async function supabaseClient() {
  if (!supabase) {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return supabase;
}

/** Keep the public `profiles` row in sync with the auth user. */
async function ensureProfile(u: { id: string; name: string; email: string }): Promise<void> {
  try {
    const client = await supabaseClient();
    await client.from("profiles").upsert(
      { id: u.id, name: u.name, email: u.email },
      { onConflict: "id" },
    );
  } catch {
    /* profile sync is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(input: { email: string; password: string }): Promise<User> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const lower = input.email.trim().toLowerCase();
    const existing = Object.values(db.users).find((u) => u.email.toLowerCase() === lower);
    if (!existing) {
      throw new Error("No account found with that email. Create one instead.");
    }
    const id = Object.keys(db.users).find((k) => db.users[k].email.toLowerCase() === lower)!;
    if (existing.password !== input.password) {
      throw new Error("Incorrect password.");
    }
    setDemoSession(id);
    return { id, email: existing.email, name: existing.name, isDemo: true };
  }
  const client = await supabaseClient();
  const { data, error } = await client.auth.signInWithPassword(input);
  if (error) throw new Error(error.message);
  const user = {
    id: data.user.id,
    email: data.user.email ?? input.email,
    name: data.user.user_metadata?.name ?? "",
    isDemo: false,
  };
  await ensureProfile(user);
  return user;
}

export async function signUp(input: {
  email: string;
  password: string;
  name: string;
}): Promise<User> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const lower = input.email.trim().toLowerCase();
    if (Object.values(db.users).some((u) => u.email.toLowerCase() === lower)) {
      throw new Error("An account with that email already exists.");
    }
    const id = newID();
    db.users[id] = {
      email: input.email,
      password: input.password,
      name: input.name || input.email.split("@")[0],
      created_at: new Date().toISOString(),
    };
    saveDemo();
    setDemoSession(id);
    return {
      id,
      email: input.email,
      name: input.name || input.email.split("@")[0],
      isDemo: true,
    };
  }
  const client = await supabaseClient();
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name || input.email.split("@")[0] } },
  });
  if (error) throw new Error(error.message);
  const user = {
    id: data.user.id,
    email: data.user.email ?? input.email,
    name: input.name || input.email.split("@")[0],
    isDemo: false,
  };
  await ensureProfile(user);
  return user;
}

export async function signOut(): Promise<void> {
  if (backendMode === "demo") {
    setDemoSession(null);
    return;
  }
  const client = await supabaseClient();
  await client.auth.signOut();
}

export async function restoreSession(): Promise<User | null> {
  if (backendMode === "demo") {
    const db = loadDemo();
    return demoUser();
  }
  const client = await supabaseClient();
  const { data } = await client.auth.getSession();
  if (!data.session?.user) return null;
  const user = {
    id: data.session.user.id,
    email: data.session.user.email ?? "",
    name: data.session.user.user_metadata?.name ?? "",
    isDemo: false,
  };
  await ensureProfile(user);
  return user;
}

// ---------------------------------------------------------------------------
// Demo seed data (multiple real accounts so "joining" can be tried)
// ---------------------------------------------------------------------------

export async function seedDemoData() {
  if (backendMode !== "demo") return;
  await ensureDemoUser();
  const db = loadDemo();
  if (db.groups.length > 0) return;

  const seedNames: [string, string][] = [
    ["Aarav Mehta", "aarav@school.edu"],
    ["Priya Sharma", "priya@school.edu"],
    ["Rohan Iyer", "rohan@school.edu"],
    ["Ishita Verma", "ishita@school.edu"],
    ["Kabir Kulkarni", "kabir@school.edu"],
    ["Ananya Rao", "ananya@school.edu"],
    ["Dev Patel", "dev@school.edu"],
    ["Meera Nair", "meera@school.edu"],
  ];

  const g1: Group = {
    id: newID(),
    created_by: "demo",
    name: "Physics X-B",
    description: "Grade 11 · Period 2",
    join_code: makeJoinCode(),
    off_weekdays: [0],
    created_at: new Date().toISOString(),
  };
  const g2: Group = {
    id: newID(),
    created_by: "demo",
    name: "Robotics Club",
    description: "Mondays & Thursdays",
    join_code: makeJoinCode(),
    off_weekdays: [5, 6],
    created_at: new Date().toISOString(),
  };
  db.groups.push(g1, g2);
  db.memberships.push(member(g1.id, "demo"), member(g2.id, "demo"));

  const lastSunday = new Date();
  lastSunday.setDate(lastSunday.getDate() - lastSunday.getDay());
  const hFrom = new Date(lastSunday);
  hFrom.setDate(hFrom.getDate() - 3);
  const hTo = new Date(lastSunday);
  hTo.setDate(hTo.getDate() + 2);
  db.holidays.push({
    id: newID(),
    group_id: g1.id,
    name: "Pongal weekend",
    starts_on: toISO(hFrom),
    ends_on: toISO(hTo),
    created_at: new Date().toISOString(),
  });

  const memberIds: string[] = [];
  for (const [name, email] of seedNames) {
    const uid = `seed_${newID().slice(0, 10)}`;
    db.users[uid] = {
      email,
      password: "demo1234",
      name,
      created_at: new Date().toISOString(),
    };
    db.memberships.push(member(g1.id, uid));
    memberIds.push(uid);
  }
  const allInPhysics = ["demo", ...memberIds];

  const days = 14;
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const iso = toISO(date);
    if (isHoliday(g1, db.holidays, iso)) continue;
    for (const uid of allInPhysics) {
      const r = Math.random();
      const status: AttendanceStatus =
        r < 0.68 ? "present" : r < 0.8 ? "late" : r < 0.9 ? "absent" : "excused";
      db.attendance.push({
        id: newID(),
        group_id: g1.id,
        user_id: uid,
        date: iso,
        status,
      });
    }
  }
  db.personal["demo"] = { expected: 72, present: 65 };
  saveDemo();
}

export async function ensureDemoUser() {
  if (backendMode !== "demo") return;
  const db = loadDemo();
  if (!db.users["demo"]) {
    db.users["demo"] = {
      email: "demo@tulip.app",
      password: "demo1234",
      name: "Demo Explorer",
      created_at: new Date().toISOString(),
    };
    saveDemo();
  }
}

// ---------------------------------------------------------------------------
// Groups (shared — membership-based)
// ---------------------------------------------------------------------------

export async function listGroups(): Promise<Group[]> {
  if (backendMode === "demo") {
    const u = demoUser();
    if (!u) return [];
    const db = loadDemo();
    const ids = new Set(db.memberships.filter((m) => m.user_id === u.id).map((m) => m.group_id));
    return db.groups
      .filter((g) => ids.has(g.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  const { data: ms, error: msErr } = await client
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", user.id);
  if (msErr) throw new Error(msErr.message);
  const ids = (ms ?? []).map((r: any) => r.group_id);
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("groups")
    .select("*")
    .in("id", ids)
    .order("name");
  if (error) throw new Error(error.message);
  return data as Group[];
}

export async function createGroup(input: {
  name: string;
  description: string;
}): Promise<Group> {
  if (backendMode === "demo") {
    const u = demoUser();
    if (!u) throw new Error("Not signed in");
    const db = loadDemo();
    const g: Group = {
      id: newID(),
      created_by: u.id,
      name: input.name,
      description: input.description,
      join_code: makeJoinCode(),
      off_weekdays: [],
      created_at: new Date().toISOString(),
    };
    db.groups.push(g);
    db.memberships.push(member(g.id, u.id));
    saveDemo();
    return g;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  const g: Group = {
    id: newID(),
    created_by: user.id,
    name: input.name,
    description: input.description,
    join_code: makeJoinCode(),
    off_weekdays: [],
    created_at: new Date().toISOString(),
  };
  const { error } = await client.from("groups").insert(g);
  if (error) throw new Error(error.message);
  const { error: mErr } = await client
    .from("group_memberships")
    .insert({ group_id: g.id, user_id: user.id });
  if (mErr) throw new Error(mErr.message);
  return g;
}

export async function updateGroup(id: string, patch: Partial<Group>): Promise<void> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const g = db.groups.find((x) => x.id === id);
    if (g) Object.assign(g, patch);
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const { error } = await client.from("groups").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteGroup(id: string): Promise<void> {
  if (backendMode === "demo") {
    const db = loadDemo();
    db.groups = db.groups.filter((g) => g.id !== id);
    db.memberships = db.memberships.filter((m) => m.group_id !== id);
    db.attendance = db.attendance.filter((a) => a.group_id !== id);
    db.holidays = db.holidays.filter((h) => h.group_id !== id);
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const { error } = await client.from("groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function regenerateJoinCode(id: string): Promise<string> {
  const code = makeJoinCode();
  await updateGroup(id, { join_code: code } as Partial<Group>);
  return code;
}

/** Join a group by its join code. Returns the group, or null when the caller
 *  is already a member (also returns the group's current state). */
export async function joinGroup(code: string): Promise<Group | null> {
  const clean = code.trim().toUpperCase();
  if (clean.length === 0) throw new Error("Enter the group's join code.");

  if (backendMode === "demo") {
    const u = demoUser();
    if (!u) throw new Error("Not signed in");
    const db = loadDemo();
    const g = db.groups.find((x) => x.join_code.toUpperCase() === clean);
    if (!g) throw new Error("No group found with that code. Ask the creator to double-check it.");
    if (db.memberships.some((m) => m.group_id === g.id && m.user_id === u.id)) return g;
    db.memberships.push(member(g.id, u.id));
    saveDemo();
    return g;
  }

  const client = await supabaseClient();
  const { data, error } = await client.rpc("join_group", { p_code: clean });
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("No group found with that code. Ask the creator to double-check it.");
  }
  return data as unknown as Group;
}

export async function leaveGroup(id: string): Promise<void> {
  if (backendMode === "demo") {
    const u = demoUser();
    if (!u) return;
    const db = loadDemo();
    db.memberships = db.memberships.filter((m) => !(m.group_id === id && m.user_id === u.id));
    db.attendance = db.attendance.filter((a) => !(a.group_id === id && a.user_id === u.id));
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  await client.from("group_memberships").delete().eq("group_id", id).eq("user_id", user.id);
  await client.from("attendance").delete().eq("group_id", id).eq("user_id", user.id);
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export async function listGroupMembers(groupId: string): Promise<ProfileUser[]> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const ids = new Set(
      db.memberships.filter((m) => m.group_id === groupId).map((m) => m.user_id),
    );
    return Object.entries(db.users)
      .filter(([id]) => ids.has(id))
      .map(([id, u]) => ({ id, name: u.name, email: u.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const client = await supabaseClient();
  const { data: ms } = await client
    .from("group_memberships")
    .select("user_id")
    .eq("group_id", groupId);
  const ids = (ms ?? []).map((r: any) => r.user_id);
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("profiles")
    .select("id, name, email")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const roster = (data as ProfileUser[]).sort((a, b) => a.name.localeCompare(b.name));
  return roster;
}

// ---------------------------------------------------------------------------
// Attendance (self-service — only your own records)
// ---------------------------------------------------------------------------

export async function getAttendance(
  groupId: string,
  from: string,
  to: string,
): Promise<AttendanceRow[]> {
  if (backendMode === "demo") {
    return loadDemo()
      .attendance
      .filter((a) => a.group_id === groupId && a.date >= from && a.date <= to);
  }
  const client = await supabaseClient();
  const { data, error } = await client
    .from("attendance")
    .select("*")
    .eq("group_id", groupId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw new Error(error.message);
  return data as AttendanceRow[];
}

export async function setAttendance(
  userId: string,
  groupId: string,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  if (backendMode === "demo") {
    const me = demoUser();
    if (!me || me.id !== userId) throw new Error("You can only mark your own attendance.");
    const db = loadDemo();
    const existing = db.attendance.find(
      (a) => a.user_id === userId && a.date === date && a.group_id === groupId,
    );
    if (existing) existing.status = status;
    else
      db.attendance.push({
        id: newID(),
        group_id: groupId,
        user_id: userId,
        date,
        status,
      });
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  if (user.id !== userId) throw new Error("You can only mark your own attendance.");
  const { error } = await client
    .from("attendance")
    .upsert(
      { group_id: groupId, user_id: userId, date, status },
      { onConflict: "group_id,user_id,date" },
    );
  if (error) throw new Error(error.message);
}

export async function removeAttendance(userId: string, date: string): Promise<void> {
  if (backendMode === "demo") {
    const me = demoUser();
    if (!me || me.id !== userId) return;
    const db = loadDemo();
    db.attendance = db.attendance.filter(
      (a) => !(a.user_id === userId && a.date === date),
    );
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  if (user.id !== userId) throw new Error("You can only clear your own attendance.");
  const { error } = await client
    .from("attendance")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw new Error(error.message);
}

/** The current user's ID (demo or supabase). */
export async function currentUserId(): Promise<string | null> {
  if (backendMode === "demo") {
    const u = demoUser();
    return u ? u.id : null;
  }
  const client = await supabaseClient();
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/** Groups where the current user has not marked attendance for `date`. */
export async function myUnmarkedGroups(date: string): Promise<Group[]> {
  const me = await currentUserId();
  if (!me) return [];
  const groups = await listGroups();
  const out: Group[] = [];
  for (const g of groups) {
    const holidays = await listHolidays(g.id);
    if (isHoliday(g, holidays, date)) continue;
    const busy: string = g.id;
    const rows = await getAttendance(busy, date, date);
    if (!rows.some((r) => r.user_id === me)) out.push(g);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Holidays & off days (never counted toward attendance)
// ---------------------------------------------------------------------------

/** True when `date` falls on a recurring off weekday or inside a holiday range. */
export function isHoliday(group: Group, holidays: HolidayEvent[], date: string): boolean {
  if (group.off_weekdays.includes(dayIndex(date))) return true;
  return holidays.some((h) => date >= h.starts_on && date <= h.ends_on);
}

/** Which holiday (if any) covers `date`, for display. */
export function holidayFor(
  group: Group,
  holidays: HolidayEvent[],
  date: string,
): HolidayEvent | null {
  if (group.off_weekdays.includes(dayIndex(date))) return null; // recurring day
  return holidays.find((h) => date >= h.starts_on && date <= h.ends_on) ?? null;
}

/** The calendar days in [from, to] that count — holidays and off days excluded. */
export function activeDates(
  group: Group,
  holidays: HolidayEvent[],
  from: string,
  to: string,
): string[] {
  return dateRange(from, to).filter((d) => !isHoliday(group, holidays, d));
}

export async function listHolidays(groupId: string): Promise<HolidayEvent[]> {
  if (backendMode === "demo") {
    return loadDemo()
      .holidays
      .filter((h) => h.group_id === groupId)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  }
  const client = await supabaseClient();
  const { data, error } = await client
    .from("holidays")
    .select("*")
    .eq("group_id", groupId)
    .order("starts_on");
  if (error) throw new Error(error.message);
  return data as HolidayEvent[];
}

function assertCreator(group: Group, userId: string): void {
  if (group.created_by !== userId) throw new Error("Only the group creator can change holidays.");
}

function findGroup(id: string): Group {
  const g = loadDemo().groups.find((x) => x.id === id);
  if (!g) throw new Error("Group not found.");
  return g;
}

export async function addHoliday(
  groupId: string,
  input: { name: string; starts_on: string; ends_on: string },
): Promise<HolidayEvent> {
  if (!input.name.trim()) throw new Error("Give the holiday a name.");
  if (input.starts_on > input.ends_on) throw new Error("The range must start on or before it ends.");

  if (backendMode === "demo") {
    const user = await currentUserId();
    const db = loadDemo();
    assertCreator(findGroup(groupId), user ?? "");
    const h: HolidayEvent = {
      id: newID(),
      group_id: groupId,
      name: input.name.trim(),
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      created_at: new Date().toISOString(),
    };
    db.holidays.push(h);
    saveDemo();
    return h;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  const { data: groups } = await client.from("groups").select("*").eq("id", groupId).single();
  assertCreator(groups as Group, user.id);
  const { data, error } = await client
    .from("holidays")
    .insert({
      group_id: groupId,
      name: input.name.trim(),
      starts_on: input.starts_on,
      ends_on: input.ends_on,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HolidayEvent;
}

export async function removeHoliday(groupId: string, holidayId: string): Promise<void> {
  if (backendMode === "demo") {
    const user = await currentUserId();
    const db = loadDemo();
    assertCreator(findGroup(groupId), user ?? "");
    db.holidays = db.holidays.filter((h) => !(h.group_id === groupId && h.id === holidayId));
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  const { data: groups } = await client.from("groups").select("*").eq("id", groupId).single();
  assertCreator(groups as Group, user.id);
  const { error } = await client.from("holidays").delete().eq("id", holidayId);
  if (error) throw new Error(error.message);
}

/** Set which weekdays never count (recurring off days). */
export async function setOffWeekdays(groupId: string, days: number[]): Promise<void> {
  const clean = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort();
  if (backendMode === "demo") {
    const user = await currentUserId();
    const db = loadDemo();
    const g = findGroup(groupId);
    assertCreator(g, user ?? "");
    g.off_weekdays = clean;
    saveDemo();
    return;
  }
  const client = await supabaseClient();
  const user = (await client.auth.getUser()).data.user;
  const { data: groups } = await client.from("groups").select("*").eq("id", groupId).single();
  assertCreator(groups as Group, user.id);
  const { error } = await client.from("groups").update({ off_weekdays: clean }).eq("id", groupId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Personal attendance (solo — no group needed)
// ---------------------------------------------------------------------------

function clampPersonalTotals(expected: number, present: number): { expected: number; present: number } {
  const exp = Math.max(0, Math.floor(expected) || 0);
  const pre = Math.max(0, Math.floor(present) || 0);
  return { expected: exp, present: Math.min(pre, exp) };
}

function recomputedTotals(
  totals: { expected: number; present: number },
  previousStatus: PersonalStatus | null,
  newStatus: PersonalStatus | null,
): { expected: number; present: number } {
  let e = totals.expected;
  let p = totals.present;
  if (previousStatus === "present") { p -= 1; e -= 1; }
  else if (previousStatus === "absent") { e -= 1; }
  if (newStatus === "present") { e += 1; p += 1; }
  else if (newStatus === "absent") { e += 1; }
  return clampPersonalTotals(e, p);
}

export async function getPersonalAttendance(
  userId: string,
): Promise<{ expected: number; present: number; days: PersonalDay[] }> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const t = db.personal[userId] ?? { expected: 0, present: 0 };
    return {
      ...t,
      days: db.personal_days
        .filter((d) => d.user_id === userId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }
  const client = await supabaseClient();
  const [tResult, dResult] = await Promise.all([
    client
      .from("personal_attendance")
      .select("expected, present")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("personal_days")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false }),
  ]);
  if (tResult.error) throw new Error(tResult.error.message);
  if (dResult.error) throw new Error(dResult.error.message);
  return {
    expected: tResult.data?.expected ?? 0,
    present: tResult.data?.present ?? 0,
    days: (dResult.data ?? []) as PersonalDay[],
  };
}

export async function getGroupMemberAttendance(
  userIds: string[],
): Promise<Record<string, { expected: number; present: number }>> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const out: Record<string, { expected: number; present: number }> = {};
    for (const id of userIds) out[id] = db.personal[id] ?? { expected: 0, present: 0 };
    return out;
  }
  const client = await supabaseClient();
  const { data, error } = await client
    .from("personal_attendance")
    .select("user_id, expected, present")
    .in("user_id", userIds);
  if (error) throw new Error(error.message);
  const out: Record<string, { expected: number; present: number }> = {};
  for (const id of userIds) out[id] = { expected: 0, present: 0 };
  for (const row of data ?? []) out[row.user_id] = { expected: row.expected, present: row.present };
  return out;
}

export async function setPersonalTotals(
  userId: string,
  expected: number,
  present: number,
): Promise<{ expected: number; present: number }> {
  const t = clampPersonalTotals(expected, present);
  if (backendMode === "demo") {
    const db = loadDemo();
    db.personal[userId] = t;
    saveDemo();
    return t;
  }
  const client = await supabaseClient();
  const { error } = await client.from("personal_attendance").upsert(
    { user_id: userId, expected: t.expected, present: t.present },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return t;
}

export async function markPersonalDay(
  userId: string,
  date: string,
  status: PersonalStatus,
): Promise<{ expected: number; present: number }> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const t = db.personal[userId] ?? { expected: 0, present: 0 };
    const existing = db.personal_days.find((d) => d.user_id === userId && d.date === date);
    const next = recomputedTotals(t, existing?.status ?? null, status);
    db.personal[userId] = next;
    if (existing) existing.status = status;
    else db.personal_days.push({ id: newID(), user_id: userId, date, status });
    saveDemo();
    return next;
  }
  const client = await supabaseClient();
  const [tRes, exRes] = await Promise.all([
    client
      .from("personal_attendance")
      .select("expected, present")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("personal_days")
      .select("status")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),
  ]);
  if (tRes.error) throw new Error(tRes.error.message);
  if (exRes.error) throw new Error(exRes.error.message);
  const prev = (exRes.data?.status as PersonalStatus | null) ?? null;
  const next = recomputedTotals(
    { expected: tRes.data?.expected ?? 0, present: tRes.data?.present ?? 0 },
    prev,
    status,
  );
  const [{ error: uErr }, { error: dErr }] = await Promise.all([
    client
      .from("personal_attendance")
      .upsert(
        { user_id: userId, expected: next.expected, present: next.present },
        { onConflict: "user_id" },
      ),
    prev
      ? client.from("personal_days").update({ status }).eq("user_id", userId).eq("date", date)
      : client.from("personal_days").insert({ user_id: userId, date, status }),
  ]);
  if (uErr) throw new Error(uErr.message);
  if (dErr) throw new Error(dErr.message);
  return next;
}

export async function unmarkPersonalDay(
  userId: string,
  date: string,
): Promise<{ expected: number; present: number }> {
  if (backendMode === "demo") {
    const db = loadDemo();
    const t = db.personal[userId] ?? { expected: 0, present: 0 };
    const existing = db.personal_days.find((d) => d.user_id === userId && d.date === date);
    if (!existing) return t;
    const next = recomputedTotals(t, existing.status, null);
    db.personal[userId] = next;
    db.personal_days = db.personal_days.filter(
      (d) => !(d.user_id === userId && d.date === date),
    );
    saveDemo();
    return next;
  }
  const client = await supabaseClient();
  const [tRes, exRes] = await Promise.all([
    client
      .from("personal_attendance")
      .select("expected, present")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("personal_days")
      .select("status")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle(),
  ]);
  if (tRes.error) throw new Error(tRes.error.message);
  if (exRes.error) throw new Error(exRes.error.message);
  if (!exRes.data) {
    return { expected: tRes.data?.expected ?? 0, present: tRes.data?.present ?? 0 };
  }
  const next = recomputedTotals(
    { expected: tRes.data?.expected ?? 0, present: tRes.data?.present ?? 0 },
    exRes.data.status as PersonalStatus,
    null,
  );
  const [{ error: uErr }, { error: dErr }] = await Promise.all([
    client
      .from("personal_attendance")
      .upsert(
        { user_id: userId, expected: next.expected, present: next.present },
        { onConflict: "user_id" },
      ),
    client
      .from("personal_days")
      .delete()
      .eq("user_id", userId)
      .eq("date", date),
  ]);
  if (uErr) throw new Error(uErr.message);
  if (dErr) throw new Error(dErr.message);
  return next;
}

/** Names for the static build (no op, imported to keep SvelteKit happy). */
export function isDemoMode(): boolean {
  return backendMode === "demo";
}