<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    label,
    value = $bindable(""),
    placeholder,
    type = "text",
    icon,
    error = false,
    hint,
    required = false,
    min,
    max,
    rows = 3,
    ...rest
  }: {
    label?: string;
    value?: string | number;
    placeholder?: string;
    type?: string;
    icon?: string;
    error?: boolean;
    hint?: string;
    required?: boolean;
    min?: string;
    max?: string;
    rows?: number;
    [key: string]: any;
  } = $props();

  let fieldId = $state(Math.random().toString(36).slice(2));
</script>

<div class="neu-field" class:has-error={error}>
  {#if label}
    <label class="lbl" for={fieldId}>{label}{#if required}<span class="req"> *</span>{/if}</label>
  {/if}
  <div class="wrap" class:with-icon={!!icon}>
    {#if icon}
      <span class="ic"><Icon name={icon} size={17} /></span>
    {/if}
    {#if type === "textarea"}
      <textarea id={fieldId} bind:value rows={rows} placeholder={placeholder} {required} {...rest}></textarea>
    {:else}
      <input
        id={fieldId}
        type={type}
        bind:value
        {placeholder}
        {required}
        {min}
        {max}
        {...rest}
      />
    {/if}
  </div>
  {#if hint && !error}
    <span class="hint">{hint}</span>
  {/if}
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

  .req {
    color: var(--absent);
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
    transition: color var(--t);
  }

  input,
  textarea {
    width: 100%;
    border: var(--border);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: var(--shadow-inset);
    padding: 12px 14px;
    font-size: 14px;
    color: var(--text-1);
    transition: box-shadow var(--t), background var(--t), border-color var(--t);
    resize: none;
    outline: none;
  }

  .with-icon input,
  .with-icon textarea {
    padding-left: 42px;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-3);
  }

  input:focus,
  textarea:focus {
    border-color: var(--primary);
    box-shadow: 4px 4px 0 var(--accent);
  }

  input[type="date"] {
    appearance: none;
    -webkit-appearance: none;
  }

  .hint {
    font-size: 12px;
    color: var(--text-3);
    padding-left: 4px;
  }

  .has-error input,
  .has-error textarea {
    border-color: var(--absent);
    box-shadow: 4px 4px 0 var(--absent);
  }
</style>