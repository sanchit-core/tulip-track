<script lang="ts">
  import AppShell from "../../lib/components/AppShell.svelte";
  import NeuCard from "../../lib/components/NeuCard.svelte";
  import NeuSelect from "../../lib/components/NeuSelect.svelte";
  import NeuButton from "../../lib/components/NeuButton.svelte";
  import NeuBadge from "../../lib/components/NeuBadge.svelte";
  import ProgressRing from "../../lib/components/ProgressRing.svelte";
  import EmptyState from "../../lib/components/EmptyState.svelte";
  import Icon from "../../lib/components/Icon.svelte";
  import { loadAllSnapshots, type GroupSnapshot } from "../../lib/loaders";
  import { todayISO, addDaysISO } from "../../lib/dates";
  import { isoLabel } from "../../lib/stats";
  import { makeChart } from "../../lib/charts";
  import { exportAttendanceCSV, exportAttendancePDF } from "../../lib/export";
  import { toast } from "../../lib/toasts";
  import { onDestroy } from "svelte";

  let snapshots = $state<GroupSnapshot[]>([]);
  let loaded = $state(false);
  let groupId = $state("");
  let days = $state(30);

  const rangeFrom = $derived(addDaysISO(todayISO(), -(days - 1)));
  const rangeTo = $derived(todayISO());

  let lineCanvas = $state<HTMLCanvasElement | null>(null);
  let doughnutCanvas = $state<HTMLCanvasElement | null>(null);
  let barCanvas = $state<HTMLCanvasElement | null>(null);

  let lineChart: any = null;
  let doughnutChart: any = null;
  let barChart: any = null;

  const groupOptions = $derived(
    [{ value: "", label: "All groups" },
      ...snapshots.map((s) => ({ value: s.group.id, label: s.group.name }))],
  );

  const current = $derived.by(() =>
    groupId ? snapshots.filter((s) => s.group.id === groupId) : snapshots,
  );
  const currentGroup = $derived(current[0]?.group ?? null);

  const totals = $derived.by(() => {
    let present = 0, absent = 0, late = 0, excused = 0, slots = 0;
    for (const s of current) {
      present += s.stats.totals.present;
      absent += s.stats.totals.absent;
      late += s.stats.totals.late;
      excused += s.stats.totals.excused;
      slots += s.members.length * s.stats.dates.length;
    }
    return {
      present, absent, late, excused,
      total: present + absent + late + excused,
      slots,
      pct: slots ? Math.round((present / slots) * 100) : 0,
    };
  });

  async function load() {
    snapshots = await loadAllSnapshots(rangeFrom, rangeTo);
    loaded = true;
  }

  $effect(() => {
    load();
  });

  $effect(() => {
    if (!loaded) return;
    const token = ++renderToken;
    renderCharts(token);
    return () => {
      lineChart?.destroy();
      doughnutChart?.destroy();
      barChart?.destroy();
      lineChart = doughnutChart = barChart = null;
    };
  });

  let renderToken = 0;

  async function renderCharts(token: number) {
    if (!lineCanvas || !doughnutCanvas || !barCanvas) return;
    // Trend line
    const dates = current[0]?.stats.dates ?? [];
    const sums = dates.map((d, i) => {
      let present = 0;
      for (const s of current) present += s.stats.trend[i]?.present ?? 0;
      return present;
    });
    const labels = dates.map((d) => isoLabel(d));
    lineChart = await makeChart({
      canvas: lineCanvas,
      type: "line",
      labels,
      datasets: [{ label: "Present", data: sums, color: "#ff4d6d", fill: true }],
    });
    if (token !== renderToken) return; // stale render, abort

    // Doughnut: single dataset with per-segment colors
    doughnutChart = await makeChart({
      canvas: doughnutCanvas,
      type: "doughnut",
      labels: ["Present", "Late", "Excused", "Absent"],
      datasets: [
        {
          label: "Status",
          data: [totals.present, totals.late, totals.excused, totals.absent],
          color: "#16a34a",
          colors: ["#16a34a", "#f59e0b", "#7c6cf0", "#ef4444"],
        },
      ],
    });
    if (token !== renderToken) return;

    // Bars: per group present-rate
    const barLabels = current.map((s) => s.group.name);
    const barData = current.map((s) => s.stats.totals.percent);
    barChart = await makeChart({
      canvas: barCanvas,
      type: "bar",
      labels: barLabels,
      datasets: [{ label: "Attendance %", data: barData, color: "#ff4d6d", fill: true }],
    });
  }

  onDestroy(() => {
    lineChart?.destroy();
    doughnutChart?.destroy();
    barChart?.destroy();
  });

  function exportCSV() {
    if (current.length === 1) {
      exportAttendanceCSV({
        group: current[0].group,
        groupName: current[0].group.name,
        members: current[0].members,
        stats: current[0].stats,
        filename: `tulip-${slug(current[0].group.name)}-${todayISO()}.csv`,
      });
      toast("Exporting CSV…", "info");
    } else {
      toast("Select a single group to export.", "info");
    }
  }

  function exportPDF() {
    if (current.length === 1) {
      exportAttendancePDF({
        group: current[0].group,
        groupName: current[0].group.name,
        members: current[0].members,
        stats: current[0].stats,
        filename: `tulip-${slug(current[0].group.name)}-${todayISO()}.pdf`,
      });
      toast("Preparing PDF…", "info");
    } else {
      toast("Select a single group to export.", "info");
    }
  }

  function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function memberRows() {
    const rows: { name: string; group: string; t: any }[] = [];
    for (const s of current) {
      for (const m of s.members) {
        rows.push({ name: m.name, group: s.group.name, t: s.stats.byMember[m.id] });
      }
    }
    rows.sort((a, b) => b.t.percent - a.t.percent);
    return rows;
  }

  const presets = [7, 14, 30, 90];

  function sumAll(snapshots: GroupSnapshot[]): number {
    return snapshots.reduce((n, s) => n + s.members.length, 0);
  }
  function positive(n: number): string {
    return n > 0 ? "g" : "";
  }
</script>

<AppShell active="reports">
  {#snippet children()}
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Reports</h1>
        <p class="muted small">Attendance rates, trends, and exports.</p>
      </div>
      <div class="head-acts">
        <NeuButton icon="download" label="CSV" variant="inset" onclick={exportCSV} />
        <NeuButton icon="fileText" label="PDF" onclick={exportPDF} />
      </div>
    </div>

    <div class="controls">
      <div style="min-width:200px">
        <NeuSelect
          label="Group"
          icon="users"
          bind:value={groupId}
          options={groupOptions}
        />
      </div>
      <div>
        <span class="lbl">Range</span>
        <div class="presets">
          {#each presets as p (p)}
            <button class="preset" class:on={days === p} onclick={() => (days = p)}>{p}d</button>
          {/each}
        </div>
      </div>
    </div>

    {#if !loaded}
      <p class="muted small" style="padding:24px 4px">Loading…</p>
    {:else if current.length === 0}
      <NeuCard>
        <EmptyState icon="chart" title="Nothing to report" message="Create a group and record some attendance first." />
      </NeuCard>
    {:else}
      <div class="stats-row">
        <NeuCard>
          <div class="center-cell">
            <ProgressRing value={totals.pct} size={128} stroke={13} trackLabel="attendance" />
          </div>
        </NeuCard>
        <NeuCard>
          <div class="kv">
            <span class="kv-k">Recorded entries</span>
            <span class="kv-v">{totals.total}</span>
            <span class="kv-lim muted-3 small">{totals.slots} expected</span>
          </div>
        </NeuCard>
        <NeuCard>
          <div class="kv">
            <span class="kv-k">Present day-rate</span>
            <span class="kv-v" style="color:var(--present)">{totals.present}</span>
            <span class="kv-sub">{Math.round((totals.present / Math.max(1, totals.total)) * 100)}% of marked</span>
          </div>
        </NeuCard>
        <NeuCard>
          <div class="kv">
            <span class="kv-k">Late / Excused / Absent</span>
            <span class="kv-v">{totals.late} / {totals.excused} / {totals.absent}</span>
            <span class="kv-sub">{sumAll(current)} members tracked</span>
          </div>
        </NeuCard>
      </div>

      <div class="chart-grid">
        <NeuCard>
          <h3 class="chart-title">Daily trend</h3>
          <div class="chart-box"><canvas bind:this={lineCanvas}></canvas></div>
        </NeuCard>
        <NeuCard>
          <h3 class="chart-title">Status breakdown</h3>
          <div class="chart-box small"><canvas bind:this={doughnutCanvas}></canvas></div>
        </NeuCard>
        <NeuCard wide>
          <h3 class="chart-title">Group comparison{groupId ? "" : " · 30d %"}</h3>
          <div class="chart-box"><canvas bind:this={barCanvas}></canvas></div>
        </NeuCard>
      </div>

      <section class="section">
        <h2>Member breakdown {currentGroup ? `· ${currentGroup.name}` : ""}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Present</th>
                <th>Late</th>
                <th>Excused</th>
                <th>Absent</th>
                <th style="width:26%">Rate</th>
              </tr>
            </thead>
            <tbody>
              {#each memberRows() as r (r.group + r.name)}
                <tr>
                  <td>
                    <div class="cell-name">
                      {#if current.length > 1}<span class="grp">{r.group}</span>{/if}
                      {r.name}
                    </div>
                  </td>
                  <td class="num {positive(r.t.present)}">{r.t.present}</td>
                  <td class="num warnc">{r.t.late}</td>
                  <td class="num excusedc">{r.t.excused}</td>
                  <td class="num badc">{r.t.absent}</td>
                  <td>
                    <div class="rate">
                      <span class="rate-bar" style={`width:${r.t.percent}%`}></span>
                      <span class="rate-lbl">{r.t.percent}%</span>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  </div>
  {/snippet}
</AppShell>

<style>
  .head-acts {
    display: flex;
    gap: 8px;
  }

  .controls {
    display: flex;
    gap: 26px;
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .lbl {
    display: block;
    font-size: 13px;
    font-weight: 800;
    color: var(--text-2);
    padding-left: 2px;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .presets {
    display: flex;
    gap: 6px;
    padding: 5px;
    background: var(--surface-2);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-inset);
  }
  .preset {
    border: none;
    background: transparent;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-2);
    transition: box-shadow var(--t), color var(--t), background var(--t);
  }
  .preset.on {
    background: var(--accent);
    color: var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
  }

  .stats-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    margin-bottom: 20px;
  }
  .center-cell {
    display: flex;
    justify-content: center;
  }
  .kv {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    height: 100%;
  }
  .kv-k {
    font-size: 13px;
    color: var(--text-2);
    font-weight: 600;
  }
  .kv-v {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .kv-sub,
  .kv-lim {
    font-size: 12px;
  }

  .chart-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 18px;
    margin-bottom: 26px;
  }
  .chart-grid :global(.wide) {
    grid-column: 1 / -1;
  }
  .chart-title {
    font-size: 15px;
    margin-bottom: 14px;
  }
  .chart-box {
    height: 240px;
    position: relative;
  }
  .chart-box.small {
    height: 240px;
  }

  .section h2 {
    font-size: 18px;
    margin-bottom: 14px;
  }

  .table-wrap {
    background: var(--surface);
    border: 3px solid var(--ink);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-raised);
    overflow-x: auto;
    padding: 6px 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 520px;
  }
  th {
    text-align: left;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 12px 14px;
  }
  td {
    padding: 10px 14px;
    font-size: 14px;
    border-top: 2px solid var(--surface-3);
  }
  .cell-name {
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .grp {
    font-size: 11px;
    font-weight: 800;
    color: var(--ink);
    background: var(--accent-soft);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
  }
  .num {
    text-align: center;
    font-weight: 700;
  }
  .num.g {
    color: var(--present);
  }
  .warnc {
    color: var(--late);
  }
  .excusedc {
    color: var(--excused);
  }
  .badc {
    color: var(--absent);
  }
  .rate {
    position: relative;
    background: var(--surface);
    border: 2px solid var(--ink);
    box-shadow: var(--shadow-inset);
    border-radius: var(--radius-sm);
    height: 14px;
  }
  .rate-bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-radius: var(--radius-sm);
    background: var(--present);
    transition: width 0.5s cubic-bezier(0.3, 0.7, 0.3, 1);
  }
  .rate-lbl {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    font-weight: 900;
    color: var(--ink);
  }

  @media (max-width: 760px) {
    .chart-grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .chart-grid :global(.wide) {
      grid-column: auto;
    }
  }

  @media (max-width: 420px) {
    .kv-v {
      font-size: 22px;
    }
  }
</style>