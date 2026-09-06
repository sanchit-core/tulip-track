import { writable } from "svelte/store";

const PREF_KEY = "tulip.window.hide-title-bar";

/** True when the frameless window shows NO in-app title bar (fully undecorated). */
export const hideWindowTitle = writable(false);

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Running in the desktop Tauri shell (not the browser, not Android/iOS). */
export function isDesktopApp(): boolean {
  if (!isTauri()) return false;
  const ua = navigator.userAgent.toLowerCase();
  return !ua.includes("android") && !ua.includes("ios");
}

function readStored(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function store(v: boolean) {
  try {
    if (v) localStorage.setItem(PREF_KEY, "1");
    else localStorage.removeItem(PREF_KEY);
  } catch {
    /* ignore */
  }
}

/** Persist + update the "hide title bar" preference (fully frameless when on). */
export function setHideWindowTitle(hide: boolean): void {
  store(hide);
  hideWindowTitle.set(hide);
}

/**
 * Load the stored preference on boot.
 * The window itself is always frameless (see `decorations: false` in tauri.conf.json).
 */
export function applyWindowDecorations(): void {
  hideWindowTitle.set(readStored());
}

export async function minimizeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  } catch {
    /* ignore */
  }
}

export async function closeWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch {
    /* ignore */
  }
}