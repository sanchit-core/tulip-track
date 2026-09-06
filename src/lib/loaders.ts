import type { Group, GroupStats, ProfileUser } from "./types";
import { activeDates, getAttendance, listGroupMembers, listHolidays } from "./db";
import { computeStats } from "./stats";

export interface GroupSnapshot {
  group: Group;
  members: ProfileUser[];
  stats: GroupStats;
}

export async function loadGroupSnapshot(
  group: Group,
  from: string,
  to: string,
): Promise<GroupSnapshot> {
  const [members, rows, holidays] = await Promise.all([
    listGroupMembers(group.id),
    getAttendance(group.id, from, to),
    listHolidays(group.id),
  ]);
  const stats = computeStats(
    group,
    members,
    rows,
    activeDates(group, holidays, from, to),
  );
  return { group, members, stats };
}

export async function loadAllSnapshots(from: string, to: string): Promise<GroupSnapshot[]> {
  const { listGroups } = await import("./db");
  const groups = await listGroups();
  return Promise.all(groups.map((g) => loadGroupSnapshot(g, from, to)));
}