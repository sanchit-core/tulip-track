import { backendMode } from "./db";

const PREF_KEY = "tulip.reminder";

export interface ReminderPref {
  enabled: boolean;
  time: string; // "HH:MM"
  days: number[]; // 0=Sun .. 6=Sat
}

export const defaultPref: ReminderPref = {
  enabled: true,
  time: "18:00",
  days: [1, 2, 3, 4, 5],
};

export function getPref(): ReminderPref {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return { ...defaultPref, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultPref;
}

export function savePref(pref: ReminderPref) {
  localStorage.setItem(PREF_KEY, JSON.stringify(pref));
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Show an immediate system notification (push-style) when in Tauri. */
export async function pushNow(title: string, body: string): Promise<void> {
  try {
    if (isTauri()) {
      const { isPermissionGranted, requestPermission, sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === "granted";
      if (granted) sendNotification({ title, body });
      return;
    }
  } catch {
    /* not available */
  }
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch {
    /* ignore */
  }
}

/** Ensure OS notification permission in Tauri contexts. */
export async function ensurePermission(): Promise<void> {
  try {
    if (isTauri()) {
      const { isPermissionGranted, requestPermission } = await import(
        "@tauri-apps/plugin-notification"
      );
      let granted = await isPermissionGranted();
      if (!granted) await requestPermission();
    } else if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}

/** Compute the next ISO datetime matching the reminder's weekday + time. */
export function nextDueDate(pref: ReminderPref): Date | null {
  if (!pref.enabled || pref.days.length === 0) return null;
  const [h, m] = pref.time.split(":").map(Number);
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (!pref.days.includes(d.getDay())) continue;
    if (i === 0 && d.getHours() * 60 + d.getMinutes() > h * 60 + m) continue;
    d.setHours(h, m, 0, 0);
    return d;
  }
  return null;
}

let reminderTimer: ReturnType<typeof setTimeout> | null = null;

/** Schedule the daily reminder as an in-app timer. While Tulip Track is open,
 *  it fires a system notification at the configured time and reschedules for
 *  the next matching day. (True background scheduling needs platform plugins.) */
export async function scheduleNextReminder(pref: ReminderPref): Promise<void> {
  if (reminderTimer) clearTimeout(reminderTimer);
  const due = nextDueDate(pref);
  if (!due) return;
  const delay = due.getTime() - Date.now();
  if (delay <= 0) return;
  reminderTimer = setTimeout(() => {
    pushNow("Tulip Track", "It's time to mark today's attendance.");
    scheduleNextReminder(pref);
  }, delay);
}

/** In-app: how many of MY groups are missing today's record (self-service). */
export async function missingTodayCount(): Promise<number> {
  const { myUnmarkedGroups } = await import("./db");
  const { todayISO } = await import("./dates");
  try {
    const groups = await myUnmarkedGroups(todayISO());
    return groups.length;
  } catch {
    return 0;
  }
}

export function isTauriRuntime(): boolean {
  return isTauri();
}