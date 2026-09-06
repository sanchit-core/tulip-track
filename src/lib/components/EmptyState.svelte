<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    icon = "info",
    title = "",
    message = "",
    children,
  }: {
    icon?: string;
    title?: string;
    message?: string;
    children?: import("svelte").Snippet;
  } = $props();
</script>

<div class="empty">
  <span class="glyph"><Icon name={icon} size={26} /></span>
  {#if title}<h3>{title}</h3>{/if}
  {#if message}<p>{message}</p>{/if}
  <span class="action">{@render children?.()}</span>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 42px 24px;
  }

  .glyph {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md);
    border: 3px solid var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink);
    background: var(--accent);
    box-shadow: 5px 5px 0 var(--ink);
    transform: rotate(-3deg);
    margin-bottom: 8px;
  }

  h3 {
    font-size: 17px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  p {
    margin: 0;
    color: var(--text-3);
    font-size: 14px;
    max-width: 320px;
    line-height: 1.5;
  }

  .action {
    margin-top: 8px;
  }
</style>