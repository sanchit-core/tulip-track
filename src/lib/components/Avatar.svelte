<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Icon from "./Icon.svelte";

  let {
    name = "Anonymous",
    size = 44,
    subtitle,
  }: { name?: string; size?: number; subtitle?: string } = $props();

  let initials = $state("");
  let hue = $state(220);

  $effect(() => {
    const parts = (name || "?").trim().split(/\s+/);
    initials = parts
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
    let h = 7;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    hue = h;
  });
</script>

{#if subtitle}
  <button class="wrap" style={`--sz:${size}px`} onclick={() => goto("/settings")} title="Account settings">
    <span class="avatar" style={`--sz:${size}px; --hue:${hue}`}>{initials}</span>
    <span class="meta">
      <span class="nm">{name}</span>
      <span class="sub">{subtitle}</span>
    </span>
    <span class="more"><Icon name="chevron-right" size={16} /></span>
  </button>
{:else}
  <span class="avatar" style={`--sz:${size}px; --hue:${hue}`}>{initials}</span>
{/if}

<style>
  .avatar {
    --sz: 44px;
    width: var(--sz);
    height: var(--sz);
    border-radius: var(--radius-md);
    border: 3px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: calc(var(--sz) * 0.34);
    letter-spacing: 0.02em;
    color: hsl(var(--hue) 45% 25%);
    background: hsl(var(--hue) 75% 82%);
    flex-shrink: 0;
    user-select: none;
  }

  .wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: none;
    background: transparent;
    padding: 6px;
    border-radius: var(--radius-md);
    text-align: left;
    transition: background var(--t);
  }
  .wrap:hover {
    background: var(--accent-soft);
  }

  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
  }

  .nm {
    font-size: 14px;
    font-weight: 800;
    color: var(--text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sub {
    font-size: 12px;
    color: var(--text-3);
  }

  .more {
    margin-left: auto;
    color: var(--text-3);
    display: flex;
  }
</style>