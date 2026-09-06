import { getPref, ensurePermission, scheduleNextReminder } from "./notify";
import { backendMode } from "./db";

/** Called once on app boot: asks for notification permission and (on Tauri)
 *  schedules the next daily reminder. */
export async function bootReminders(): Promise<void> {
  const pref = getPref();
  if (!pref.enabled) return;
  scheduleNextReminder(pref).catch(() => {});
  ensurePermission().catch(() => {});
  if (backendMode === "demo") return;
}

/** True when the current user hasn't marked today's attendance in at least one group. */
export async function hasIncompleteToday(): Promise<boolean> {
  const { myUnmarkedGroups } = await import("./db");
  const { todayISO } = await import("./dates");
  try {
    const groups = await myUnmarkedGroups(todayISO());
    return groups.length > 0;
  } catch {
    return false;
  }
}