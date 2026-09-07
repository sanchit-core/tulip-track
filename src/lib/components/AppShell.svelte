<script lang="ts">
  import { user, logout } from "../session";
  import { toast } from "../toasts";
  import { goto } from "$app/navigation";
  import Icon from "./Icon.svelte";
  import Avatar from "./Avatar.svelte";
  import {
    hideWindowTitle,
    isDesktopApp,
    minimizeWindow,
    closeWindow,
  } from "../window";

  let {
    active = "dashboard",
    children,
  }: { active?: string; children?: import("svelte").Snippet } = $props();

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "groups", label: "Groups", icon: "users" },
    { id: "reports", label: "Reports", icon: "chart" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  let drawer = $state(false);

  const isDesktop = isDesktopApp();
  let showBar = $derived(isDesktop && !$hideWindowTitle);

  function go(id: string, href: string) {
    drawer = false;
    goto(href);
  }

  async function handleLogout() {
    await logout();
    toast("Signed out. See you soon!", "info");
    goto("/login");
  }
</script>

<div class="layout" class:with-bar={showBar}>
  {#if showBar}
    <div class="win-bar">
      <span class="win-drag" data-tauri-drag-region>
        <img class="win-logo" src="/tulip-track-icon.png" alt="" />
        Tulip Track
      </span>
      <div class="drag-fill" data-tauri-drag-region></div>
      <div class="win-btns">
        <button class="win-btn" onclick={minimizeWindow} aria-label="Minimize">
          <Icon name="minus" size={15} />
        </button>
        <button class="win-btn close" onclick={closeWindow} aria-label="Close">
          <Icon name="x" size={15} />
        </button>
      </div>
    </div>
  {/if}

  <aside class="sidebar" class:open={drawer}>
    <div class="brand" data-tauri-drag-region="deep">
      <span class="logo"><img class="logo-img" src="/tulip-track-icon.png" alt="" /></span>
      <span class="name">Tulip Track</span>
    </div>

    <nav class="nav">
      {#each NAV as item (item.id)}
        <button
          class="nav-item"
          class:on={active === item.id}
          onclick={() => go(item.id, item.id === "dashboard" ? "/" : `/${item.id}`)}
        >
          <span class="ic"><Icon name={item.icon} size={19} /></span>
          <span class="lbl">{item.label}</span>
        </button>
      {/each}
    </nav>

    <div class="foot">
      {#if $user}
        <Avatar name={$user.name || $user.email} subtitle={$user.isDemo ? "Demo account" : "Signed in"} />
        <button class="logout" onclick={handleLogout} title="Sign out">
          <Icon name="logout" size={18} />
        </button>
      {/if}
    </div>
  </aside>

  {#if drawer}
    <div
      class="scrim"
      role="button"
      tabindex="-1"
      aria-label="Close menu"
      onclick={() => (drawer = false)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") drawer = false;
      }}
    ></div>
  {/if}

  <div class="main">
    <header class="topbar">
      <button class="burger" onclick={() => (drawer = true)} aria-label="Open menu">
        <Icon name="menu" size={20} />
      </button>
      <div class="drag-fill" data-tauri-drag-region></div>
    </header>
    {@render children?.()}
  </div>
</div>

<style>
  .layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: var(--sidebar-w);
    background: var(--surface);
    padding: 22px 16px;
    display: flex;
    flex-direction: column;
    gap: 26px;
    position: sticky;
    top: 0;
    height: 100vh;
    flex-shrink: 0;
    z-index: 30;
    border-right: 3px solid var(--ink);
    box-shadow: 6px 0 0 rgba(23, 23, 23, 0.05);
    transition: transform var(--t);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px;
  }

  .logo {
    width: 44px;
    height: 44px;
    border-radius: var(--radius-md);
    border: 3px solid var(--ink);
    background: var(--accent);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 3px 3px 0 var(--ink);
    transform: rotate(-4deg);
  }

  .logo-img {
    width: 100%;
    height: 100%;
    border-radius: calc(var(--radius-md) - 3px);
    object-fit: cover;
    display: block;
  }

  .name {
    font-size: 19px;
    font-weight: 900;
    letter-spacing: -0.01em;
    color: var(--text-1);
    text-transform: uppercase;
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 3px solid transparent;
    background: transparent;
    padding: 11px 14px;
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 800;
    color: var(--text-2);
    transition: box-shadow var(--t), color var(--t), background var(--t), border-color var(--t);
    text-align: left;
  }
  .nav-item:hover {
    color: var(--text-1);
    background: var(--accent-soft);
  }
  .nav-item.on {
    color: var(--ink);
    background: var(--accent);
    border-color: var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .nav-item .ic {
    display: flex;
  }

  .foot {
    display: flex;
    align-items: center;
    gap: 6px;
    border-top: 3px dashed var(--ink);
    padding-top: 14px;
  }

  .logout {
    border: 2px solid var(--ink);
    background: var(--surface);
    color: var(--text-3);
    display: flex;
    padding: 9px;
    border-radius: var(--radius-sm);
    box-shadow: 2px 2px 0 var(--ink);
    transition: color var(--t), background var(--t), transform var(--t);
    margin-left: auto;
    flex-shrink: 0;
  }
  .logout:hover {
    color: var(--absent);
    background: var(--absent-soft);
  }
  .logout:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }

  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    display: none;
    align-items: stretch;
    padding: 12px 18px;
  }

  .burger {
    border: 3px solid var(--ink);
    background: var(--surface);
    color: var(--text-2);
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .burger:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }

  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(23, 23, 23, 0.5);
    backdrop-filter: blur(2px);
    z-index: 25;
  }

  .win-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 38px;
    z-index: 70;
    display: flex;
    align-items: stretch;
    gap: 8px;
    padding: 0 8px 0 0;
    background: var(--surface);
    border-bottom: 3px solid var(--ink);
    user-select: none;
  }
  .drag-fill {
    flex: 1;
    align-self: stretch;
  }
  .win-drag {
    display: flex;
    align-items: center;
    gap: 7px;
    padding-left: 14px;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-2);
  }
  .win-logo {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    object-fit: cover;
    display: block;
  }
  .win-btns {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .win-btn {
    width: 34px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-2);
    box-shadow: 2px 2px 0 var(--ink);
    transition: color var(--t), background var(--t), transform var(--t);
  }
  .win-btn:hover {
    background: var(--accent-soft);
    color: var(--ink);
  }
  .win-btn.close:hover {
    background: var(--absent);
    color: #fff;
  }
  .win-btn:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }

  .with-bar .sidebar {
    top: 38px;
    height: calc(100vh - 38px);
  }
  .with-bar .main {
    padding-top: 38px;
  }

  @media (max-width: 760px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      height: 100dvh;
      max-width: 86vw;
      transform: translateX(-100%);
      box-shadow: var(--shadow-pop);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .sidebar.open {
      transform: none;
    }
    .topbar {
      display: flex;
    }
  }
</style>