export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDaysISO(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime();
  return Math.round(ms / 86400000);
}

/** Inclusive list of ISO dates between from and to. */
export function dateRange(from: string, to: string): string[] {
  const days = Math.max(0, daysBetween(from, to));
  const out: string[] = [];
  for (let i = 0; i <= days; i++) out.push(addDaysISO(from, i));
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDisplay(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return fromISO(iso).toLocaleDateString(undefined, opts ?? { month: "short", day: "numeric" });
}

export function formatLong(iso: string): string {
  return fromISO(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[fromISO(iso).getDay()];
}

/** Weekday index for an ISO date: 0 = Sunday … 6 = Saturday. */
export function dayIndex(iso: string): number {
  return fromISO(iso).getDay();
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDaysISO(todayISO(), -i));
  return out;
}

export function sameDay(a: string, b: string): boolean {
  return a === b;
}