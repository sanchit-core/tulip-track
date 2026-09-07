<script lang="ts">
  let {
    value = 0,
    size = 120,
    stroke = 12,
    trackLabel = "",
  }: { value?: number; size?: number; stroke?: number; trackLabel?: string } = $props();

  const pct = $derived(Math.max(0, Math.min(100, value)));
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const color = $derived(
    pct >= 80 ? "var(--present)" : pct >= 60 ? "var(--late)" : pct >= 40 ? "var(--excused)" : "var(--absent)",
  );
</script>

<div class="ring" style={`--size:${size}px; width:${size}px; height:${size}px`}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke="var(--surface-3)"
      stroke-width={stroke}
    />
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={color}
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={`${c}`}
      stroke-dashoffset={`${c - (pct / 100) * c}`}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      style="transition: stroke-dashoffset .6s cubic-bezier(.3,.7,.3,1), stroke .3s; filter: drop-shadow(0 2px 3px rgba(23,23,23,.18));"
    />
  </svg>
  <div class="center">
    <span class="val" style={`color:${color}`}>{Math.round(pct)}%</span>
    {#if trackLabel}
      <span class="cap">{trackLabel}</span>
    {/if}
  </div>
</div>

<style>
  .ring {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    pointer-events: none;
  }

  .val {
    font-size: calc(var(--size, 120px) * 0.18);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .cap {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 800;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>