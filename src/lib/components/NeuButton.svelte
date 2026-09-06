<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    label,
    icon,
    variant = "raised",
    size = "md",
    type = "button",
    disabled = false,
    full = false,
    title,
    children,
    ...rest
  }: {
    label?: string;
    icon?: string;
    variant?: "raised" | "primary" | "inset" | "ghost";
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    full?: boolean;
    title?: string;
    children?: import("svelte").Snippet;
    [key: string]: any;
  } = $props();

  const SIZE = { sm: "sm", md: "md", lg: "lg" };
</script>

<button
  class="neu-btn {variant} {SIZE[size]}"
  class:full
  class:disabled
  type={type}
  disabled={disabled}
  {title}
  {...rest}
>
  {#if icon}
    <Icon name={icon} size={size === "sm" ? 15 : size === "lg" ? 20 : 17} />
  {/if}
  {#if label}<span class="lbl">{label}</span>{/if}
  {@render children?.()}
</button>

<style>
  .neu-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: var(--border);
    border-radius: var(--radius-md);
    font-weight: 800;
    color: var(--text-1);
    background: var(--surface);
    box-shadow: var(--shadow-raised);
    transition: box-shadow var(--t), transform var(--t), background var(--t), color var(--t);
    flex-shrink: 0;
    user-select: none;
  }

  .neu-btn:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  .sm {
    padding: 7px 13px;
    font-size: 13px;
    border-radius: var(--radius-sm);
    gap: 6px;
    box-shadow: var(--shadow-flat);
  }
  .md {
    padding: 12px 20px;
    font-size: 14px;
  }
  .lg {
    padding: 14px 24px;
    font-size: 15px;
  }

  .raised {
    background: var(--surface);
  }
  .raised:hover:not(:disabled) {
    background: var(--accent);
  }
  .raised:active:not(:disabled) {
    box-shadow: var(--shadow-pressed);
    transform: translate(3px, 3px);
  }

  .primary {
    background: var(--primary);
    color: #fff;
    border-color: var(--ink);
  }
  .primary:hover:not(:disabled) {
    background: var(--primary-strong);
  }
  .primary:active:not(:disabled) {
    box-shadow: var(--shadow-pressed);
    transform: translate(3px, 3px);
  }

  .inset {
    background: var(--surface-2);
    box-shadow: var(--shadow-flat);
    color: var(--text-2);
  }
  .inset:hover:not(:disabled) {
    color: var(--text-1);
    background: var(--accent-soft);
  }
  .inset:active:not(:disabled) {
    box-shadow: var(--shadow-pressed);
    transform: translate(3px, 3px);
  }

  .ghost {
    background: transparent;
    box-shadow: none;
    border: 3px dashed var(--ink);
    color: var(--text-2);
  }
  .ghost:hover:not(:disabled) {
    color: var(--ink);
    background: var(--accent-soft);
  }

  .full {
    width: 100%;
  }

  .disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
  }
</style>