<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { boot, booting, user } from "../lib/session";
  import { bootReminders } from "../lib/reminders";
  import { backendMode } from "../lib/db";
  import { applyWindowDecorations } from "../lib/window";
  import Toast from "../lib/components/Toast.svelte";

  let { children }: { children?: import("svelte").Snippet } = $props();

  let ready = $state(false);

  onMount(async () => {
    await boot();
    bootReminders();
    applyWindowDecorations();
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    const path = $page.url.pathname;
    const authed = $user !== null;
    if (!authed && path !== "/login") goto("/login");
    if (authed && path === "/login") goto("/");
  });
</script>

{#if !ready}
  <div class="splash">
    <span class="dot"><span></span></span>
  </div>
{:else}
  <Toast />
  {@render children?.()}
{/if}

<style>
  .splash {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dot {
    width: 54px;
    height: 54px;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: var(--shadow-raised);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dot span {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--primary);
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.25;
      transform: scale(0.7);
    }
  }
</style>