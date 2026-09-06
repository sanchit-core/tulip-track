import type {
  AttendanceRow,
  AttendanceStatus,
  Group,
  GroupStats,
  MemberTotals,
  ProfileUser,
} from "./types";
import { fromISO, weekdayShort } from "./dates";

export const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

export const STATUS_META: Record<
  AttendanceStatus,
  { label: string; className: string }
> = {
  present: { label: "Present", className: "present" },
  absent: { label: "Absent", className: "absent" },
  late: { label: "Late", className: "late" },
  excused: { label: "Excused", className: "excused" },
};

export function emptyTotals(): MemberTotals {
  return { present: 0, absent: 0, late: 0, excused: 0, total: 0, percent: 0, presentPct: 0 };
}

export function computeStats(
  group: Group,
  members: ProfileUser[],
  attendance: AttendanceRow[],
  dates: string[],
): GroupStats {
  const dateSet = new Set(dates);
  const byMember: Record<string, MemberTotals> = {};
  const memberDaily: Record<string, Record<string, AttendanceStatus>> = {};
  const daily: Record<string, Record<AttendanceStatus, number>> = {};

  for (const m of members) byMember[m.id] = emptyTotals();
  for (const m of members) memberDaily[m.id] = {};

  for (const iso of dates) {
    daily[iso] = { present: 0, absent: 0, late: 0, excused: 0 };
  }

  for (const a of attendance) {
    if (!dateSet.has(a.date)) continue;
    const t = byMember[a.user_id];
    if (!t) continue;
    t[a.status] += 1;
    t.total += 1;
    memberDaily[a.user_id][a.date] = a.status;
    const d = daily[a.date];
    if (d) d[a.status] += 1;
  }

  const totals = emptyTotals();
  for (const m of members) {
    const t = byMember[m.id];
    for (const s of STATUSES) totals[s] += t[s];
    totals.total += t.total;
  }

  for (const m of members) {
    const t = byMember[m.id];
    t.percent = t.total > 0 ? round((t.present / t.total) * 100) : 0;
    t.presentPct = round(((t.present + t.late * 0.5) / Math.max(1, t.total)) * 100);
  }

  const totalSlots = members.length * dates.length;
  totals.percent = totalSlots > 0 ? round((totals.present / totalSlots) * 100) : 0;

  const trend = dates.map((iso) => {
    const d = daily[iso];
    return {
      date: iso,
      label: weekdayShort(iso),
      present: d.present,
      absent: d.absent,
      late: d.late,
      excused: d.excused,
    };
  });

  return { group, user: group.created_by, members, dates, byMember, memberDaily, daily, totals, trend };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isoLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function fmtPct(n: number): string {
  return `${n}%`;
}