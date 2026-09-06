import { writable, get } from "svelte/store";
import type { User } from "./types";
import { restoreSession, signIn as dbSignIn, signOut as dbSignOut } from "./db";

export const user = writable<User | null>(null);
export const booting = writable(true);

export async function boot() {
  const u = await restoreSession();
  user.set(u);
  booting.set(false);
}

export async function login(input: { email: string; password: string }) {
  const u = await dbSignIn(input);
  user.set(u);
}

export async function logout() {
  await dbSignOut();
  user.set(null);
}

export const currentUser = () => get(user);