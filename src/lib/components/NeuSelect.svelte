<script lang="ts">
  import Icon from "./Icon.svelte";

  interface Option {
    value: string;
    label: string;
  }

  let {
    label,
    value = $bindable(""),
    options = [] as Option[],
    icon,
    disabled = false,
    ...rest
  }: {
    label?: string;
    value?: string;
    options?: Option[];
    icon?: string;
    disabled?: boolean;
    [key: string]: any;
  } = $props();

  let fieldId = $state(Math.random().toString(36).slice(2));
</script>

<div class="neu-field">
  {#if label}
    <label class="lbl" for={fieldId}>{label}</label>
  {/if}
  <div class="wrap" class:with-icon={!!icon}>
    {#if icon}
      <span class="ic"><Icon name={icon} size={17} /></span>
    {/if}
    <select id={fieldId} bind:value {disabled} {...rest}>
      <option value="" disabled hidden></option>
      {#each options as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
    <span class="arrow"><Icon name="chevron-down" size={15} /></span>
  </div>
</div>

<style>
  .neu-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .lbl {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-2);
    padding-left: 2px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .ic {
    position: absolute;
    left: 13px;
    color: var(--text-3);
    display: flex;
    pointer-events: none;
  }

  select {
    width: 100%;
    border: var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-inset);
    padding: 12px 38px 12px 14px;
    font-size: 14px;
    color: var(--text-1);
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  .with-icon select {
    padding-left: 42px;
  }

  select:focus {
    border-color: var(--primary);
    box-shadow: 4px 4px 0 var(--accent);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .arrow {
    position: absolute;
    right: 13px;
    color: var(--text-3);
    display: flex;
    pointer-events: none;
  }
</style>