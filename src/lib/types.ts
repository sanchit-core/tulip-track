export type AttendanceStatus = "present" | "absent" | "late" | "excused";

/** Status used for personal (solo) daily marking. "holiday" means a day you
 *  were not supposed to be present — it contributes nothing to any count. */
export type PersonalStatus = "present" | "absent" | "holiday";

/** A single marked day in the solo tracker (de-dupes daily tapping). */
export interface PersonalDay {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: PersonalStatus;
}

/** "Days you were supposed to be present" vs "days you were present". */
export interface PersonalTotals {
  expected: number;
  present: number;
}

export interface Group {
  id: string;
  created_by: string;
  name: string;
  description: string;
  join_code: string;
  /** Recurring weekly off days — 0 = Sunday … 6 = Saturday. Attendance on these days is never counted. */
  off_weekdays: number[];
  created_at: string;
}

/** A named off period (e.g. "Winter break"), inclusive range. */
export interface HolidayEvent {
  id: string;
  group_id: string;
  name: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string; // YYYY-MM-DD (inclusive)
  created_at?: string;
}

/** A person in a group's roster (a real user who joined). */
export interface ProfileUser {
  id: string;
  name: string;
  email: string;
}

export interface Membership {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface AttendanceRow {
  id?: string;
  group_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  created_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isDemo: boolean;
}

export interface MemberTotals {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  percent: number; // present / total
  presentPct: number; // (present + half late) / total
}

export interface GroupStats {
  group: Group;
  user: string;
  members: ProfileUser[];
  dates: string[];
  byMember: Record<string, MemberTotals>;
  memberDaily: Record<string, Record<string, AttendanceStatus>>;
  daily: Record<string, Record<AttendanceStatus, number>>;
  totals: MemberTotals;
  trend: {
    date: string;
    label: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
  }[];
}