<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    open = false,
    title = "",
    width = 440,
    padded = true,
    dismissable = true,
    onclose,
    children,
    ...rest
  }: {
    open?: boolean;
    title?: string;
    width?: number;
    padded?: boolean;
    dismissable?: boolean;
    onclose?: () => void;
    children?: import("svelte").Snippet;
    [key: string]: any;
  } = $props();

  function onClose() {
    if (!dismissable) return;
    onclose?.();
  }

  function onOverlay(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if open}
  <div class="overlay" role="presentation" onmousedown={onOverlay}>
    <div
      class="modal"
      class:plain={!padded}
      style={`width:min(${width}px, calc(100vw - 32px))`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      {...rest}
    >
      {#if title}
        <header>
          <h3>{title}</h3>
          {#if dismissable}
            <button class="x" onclick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          {/if}
        </header>
      {/if}
      <div class="body">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(23, 23, 23, 0.55);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 120;
    padding: 16px;
    animation: fadeIn 0.15s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
  }

  .modal {
    background: var(--surface);
    border: 4px solid var(--ink);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-pop);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    animation: popIn 0.18s cubic-bezier(0.2, 0.9, 0.3, 1);
    overflow: hidden;
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.97) rotate(-0.5deg);
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 22px 14px;
    border-bottom: 3px solid var(--ink);
    background: var(--accent);
  }

  header h3 {
    font-size: 18px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .x {
    border: 3px solid var(--ink);
    background: var(--surface);
    color: var(--text-1);
    display: flex;
    padding: 6px;
    border-radius: var(--radius-sm);
    box-shadow: 2px 2px 0 var(--ink);
    transition: background var(--t), color var(--t), transform var(--t);
  }
  .x:hover {
    background: var(--ink);
    color: #fff;
  }
  .x:active {
    transform: translate(2px, 2px);
    box-shadow: none;
  }

  .body {
    padding: 18px 22px 24px;
    overflow-y: auto;
  }

  .plain .body {
    padding: 0;
  }
</style>