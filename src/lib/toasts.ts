import { writable } from "svelte/store";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let counter = 0;

export const toasts = writable<Toast[]>([]);

export function toast(message: string, type: ToastType = "info", duration = 3400) {
  const id = ++counter;
  toasts.update((t) => [...t, { id, type, message }]);
  setTimeout(() => dismiss(id), duration);
}

function dismiss(id: number) {
  toasts.update((t) => t.filter((x) => x.id !== id));
}

/** Hard-dismiss a toast manually from a component. */
export function dismissToast(id: number) {
  dismiss(id);
}