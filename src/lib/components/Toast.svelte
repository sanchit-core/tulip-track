<script lang="ts">
  import { toasts, dismissToast } from "../toasts";
  import Icon from "./Icon.svelte";

  const ICON = {
    success: "check-circle",
    error: "alert-circle",
    info: "info",
  } as const;

  const COLOR = {
    success: "var(--present)",
    error: "var(--absent)",
    info: "var(--primary)",
  } as const;
</script>

<div class="toast-stack">
  {#each $toasts as t (t.id)}
    <div class="toast {t.type}" style={`--tint:${COLOR[t.type]}`} role="status">
      <span class="dot"><Icon name={ICON[t.type]} size={18} strokeWidth={2.3} /></span>
      <span class="msg">{t.message}</span>
      <button class="close" onclick={() => dismissToast(t.id)} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-stack {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(360px, calc(100vw - 36px));
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--surface);
    color: var(--text-1);
    border: 3px solid var(--ink);
    border-left-width: 8px;
    border-left-color: var(--tint);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    box-shadow: 5px 5px 0 var(--ink);
    animation: slideIn 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(24px) rotate(0.6deg);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .dot {
    color: var(--tint);
    display: flex;
    flex-shrink: 0;
  }

  .msg {
    flex: 1;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.35;
  }

  .close {
    border: none;
    background: transparent;
    color: var(--text-3);
    display: flex;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: background var(--t), color var(--t);
  }
  .close:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
</style>