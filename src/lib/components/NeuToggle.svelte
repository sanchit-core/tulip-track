<script lang="ts">
  let {
    checked = $bindable(false),
    disabled = false,
    label,
    sublabel,
    ...rest
  }: {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    sublabel?: string;
    [key: string]: any;
  } = $props();
</script>

<label class="neu-toggle" class:disabled>
  <span class="track" class:on={checked}>
    <span class="knob"></span>
  </span>
  {#if label || sublabel}
    <span class="txt">
      {#if label}<span class="main">{label}</span>{/if}
      {#if sublabel}<span class="sub">{sublabel}</span>{/if}
    </span>
  {/if}
  <input type="checkbox" bind:checked {disabled} {...rest} />
</label>

<style>
  .neu-toggle {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    user-select: none;
  }

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .track {
    position: relative;
    width: 52px;
    height: 30px;
    border-radius: 4px;
    border: 3px solid var(--ink);
    background: var(--surface);
    box-shadow: 3px 3px 0 var(--ink);
    transition: background var(--t), box-shadow var(--t), transform var(--t);
    flex-shrink: 0;
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 2px;
    background: var(--paper);
    box-shadow: 2px 2px 0 var(--ink);
    transition: transform var(--t), background var(--t);
  }

  .track.on {
    background: var(--primary);
  }

  .track.on .knob {
    transform: translateX(22px);
    background: var(--accent);
  }

  .txt {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .main {
    font-size: 14px;
    font-weight: 800;
    color: var(--text-1);
  }

  .sub {
    font-size: 12px;
    color: var(--text-3);
  }

  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>