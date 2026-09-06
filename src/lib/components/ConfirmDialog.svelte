<script lang="ts">
  import Modal from "./Modal.svelte";
  import NeuButton from "./NeuButton.svelte";
  import Icon from "./Icon.svelte";

  let {
    open = false,
    title = "Are you sure?",
    message = "",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    danger = true,
    onConfirm,
    onCancel,
  }: {
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  } = $props();

  function close() {
    onCancel?.();
  }
</script>

<Modal {open} {title} onclose={close} width={380}>
  <div class="confirm">
    {#if danger}
      <span class="glyph" style="--tint: var(--absent); --soft: var(--absent-soft)">
        <Icon name="alert-circle" size={26} />
      </span>
    {:else}
      <span class="glyph" style="--tint: var(--primary); --soft: var(--primary-soft)">
        <Icon name="info" size={26} />
      </span>
    {/if}
    <p>{message}</p>
    <div class="actions">
      <NeuButton variant="inset" onclick={close} full>{cancelLabel}</NeuButton>
      <NeuButton
        variant={danger ? "primary" : "raised"}
        onclick={() => {
          onConfirm?.();
        }}
        style={danger ? "background:var(--absent-soft);color:var(--absent);" : ""}
        full
      >
        {confirmLabel}
      </NeuButton>
    </div>
  </div>
</Modal>

<style>
  .confirm {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    padding-top: 6px;
  }

  .glyph {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-md);
    border: 3px solid var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tint);
    background: var(--soft);
    box-shadow: 4px 4px 0 var(--ink);
    transform: rotate(-3deg);
  }

  p {
    margin: 0;
    color: var(--text-2);
    font-size: 14px;
    line-height: 1.5;
  }

  .actions {
    display: flex;
    gap: 12px;
    width: 100%;
    margin-top: 6px;
  }
  .actions :global(.neu-btn) {
    flex: 1;
  }
</style>