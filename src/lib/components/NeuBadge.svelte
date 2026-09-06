<script lang="ts">
  import Icon from "./Icon.svelte";

  const META = {
    present: { label: "Present", icon: "check-circle", color: "var(--present)", soft: "var(--present-soft)" },
    absent: { label: "Absent", icon: "x", color: "var(--absent)", soft: "var(--absent-soft)" },
    late: { label: "Late", icon: "clock", color: "var(--late)", soft: "var(--late-soft)" },
    excused: { label: "Excused", icon: "check", color: "var(--excused)", soft: "var(--excused-soft)" },
    neutral: { label: "—", icon: "", color: "var(--text-3)", soft: "var(--surface-3)" },
    primary: { label: "Info", icon: "info", color: "var(--primary)", soft: "var(--primary-soft)" },
  } as const;

  let {
    status,
    label,
    icon,
    noIcon = false,
    filled = false,
    ...rest
  }: {
    status?: keyof typeof META;
    label?: string;
    icon?: string;
    noIcon?: boolean;
    filled?: boolean;
    [key: string]: any;
  } = $props();

  const meta = $derived(META[status ?? "neutral"]);
</script>

<span
  class="badge"
  class:filled
  style="color: {meta.color}; background: {filled ? meta.soft : 'var(--surface)'}; border-color: currentColor;"
  {...rest}
>
  {#if !noIcon && (icon ?? meta.icon)}<Icon name={icon ?? meta.icon} size={13} strokeWidth={2.6} />{/if}
  {label ?? meta.label}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--ink);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
    box-shadow: 2px 2px 0 var(--ink);
  }

  .badge.present { color: var(--present); }
  .badge.absent { color: var(--absent); }
  .badge.late { color: var(--late); }
  .badge.excused { color: var(--excused); }
</style>