<script lang="ts">
  import { user } from "../lib/session";
  import { loadAllSnapshots, type GroupSnapshot } from "../lib/loaders";
  import { todayISO, addDaysISO } from "../lib/dates";
  import {
    currentUserId,
    myUnmarkedGroups,
    getAttendance,
    getPersonalAttendance,
    markPersonalDay,
    unmarkPersonalDay,
  } from "../lib/db";
  import { STATUSES } from "../lib/stats";
  import AppShell from "../lib/components/AppShell.svelte";
  import NeuCard from "../lib/components/NeuCard.svelte";
  import NeuBadge from "../lib/components/NeuBadge.svelte";
  import NeuButton from "../lib/components/NeuButton.svelte";
  import ProgressRing from "../lib/components/ProgressRing.svelte";
  import EmptyState from "../lib/components/EmptyState.svelte";
  import AttendanceTotalsModal from "../lib/components/AttendanceTotalsModal.svelte";
  import Icon from "../lib/components/Icon.svelte";
  import { goto } from "$app/navigation";
  import { toast } from "../lib/toasts";
  import type { AttendanceStatus, PersonalStatus } from "../lib/types";

  const DAYS = 30;
  const rangeFrom = addDaysISO(todayISO(), -(DAYS - 1));
  const rangeTo = todayISO();
  const today = todayISO();

  let snapshots = $state<GroupSnapshot[]>([]);
  let me = $state<string | null>(null);
  let unmarkedToday = $state<string[]>([]);
  let myAttendance = $state<Record<string, Partial<Record<AttendanceStatus, number>>>>({});
  let personalExpected = $state(0);
  let personalPresent = $state(0);
  let personalDays = $state<Record<string, PersonalStatus>>({});
  let loaded = $state(false);
  let totalsOpen = $state(false);

  async function loadAll() {
    me = await currentUserId();
    snapshots = await loadAllSnapshots(rangeFrom, rangeTo);
    if (me) {
      unmarkedToday = (await myUnmarkedGroups(today)).map((g) => g.id);
      const perGroup: Record<string, Partial<Record<AttendanceStatus, number>>> = {};
      for (const s of snapshots) {
        const rows = (await getAttendance(s.group.id, rangeFrom, rangeTo)).filter((r) => r.user_id === me);
        const c: Partial<Record<AttendanceStatus, number>> = {};
        for (const k of STATUSES) c[k] = 0;
        for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
        perGroup[s.group.id] = c;
      }
      myAttendance = perGroup;
      await loadPersonal();
    }
    loaded = true;
  }

  async function loadPersonal() {
    if (!me) return;
    const pa = await getPersonalAttendance(me);
    personalExpected = pa.expected;
    personalPresent = pa.present;
    const dayMap: Record<string, PersonalStatus> = {};
    for (const d of pa.days) dayMap[d.date] = d.status;
    personalDays = dayMap;
  }

  $effect(() => {
    loadAll();
  });

  const todayStatus = $derived(personalDays[today] ?? null);

  const pct = $derived(
    personalExpected > 0
      ? Math.round((Math.min(personalPresent, personalExpected) / personalExpected) * 100)
      : 0,
  );

  const missed = $derived(
    Math.max(0, personalExpected - personalPresent),
  );

  const markedCount = $derived(snapshots.length - unmarkedToday.length);

  const myOverallPct = $derived.by(() => {
    let total = 0;
    let present = 0;
    for (const s of snapshots) {
      const c = myAttendance[s.group.id];
      if (!c) continue;
      total += (c.present ?? 0) + (c.absent ?? 0) + (c.late ?? 0) + (c.excused ?? 0);
      present += c.present ?? 0;
    }
    return total ? Math.round((present / total) * 100) : 0;
  });

  function myTotal(s: GroupSnapshot): number {
    const c = myAttendance[s.group.id];
    if (!c) return 0;
    return STATUSES.reduce((n, k) => n + (c[k] ?? 0), 0);
  }

  function myPct(s: GroupSnapshot): number {
    const c = myAttendance[s.group.id];
    if (!c) return 0;
    const total = myTotal(s);
    return total ? Math.round(((c.present ?? 0) / total) * 100) : 0;
  }

  function greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }

  async function handleMark(status: PersonalStatus) {
    if (!me) return;
    if (todayStatus === status) {
      personalDays = { ...personalDays };
      delete personalDays[today];
      const t = await unmarkPersonalDay(me, today);
      personalExpected = t.expected;
      personalPresent = t.present;
      toast("Mark removed.", "info");
      return;
    }
    personalDays = { ...personalDays, [today]: status };
    const t = await markPersonalDay(me, today, status);
    personalExpected = t.expected;
    personalPresent = t.present;
  }

  const MARK_BTNS: { status: PersonalStatus; icon: string; label: string; color: string }[] = [
    { status: "present", icon: "check-circle", label: "Present", color: "var(--present)" },
    { status: "absent",  icon: "x",            label: "Absent",  color: "var(--absent)" },
    { status: "holiday", icon: "calendar",     label: "Holiday", color: "var(--excused)" },
  ];
</script>

<AppShell active="dashboard">
  {#snippet children()}
  <div class="page">
    <div class="page-head">
      <div>
        <h1>{greeting()}, {$user?.name || "friend"}.</h1>
        <p class="muted small">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          {#if loaded && snapshots.length > 0}
            · {snapshots.length} group{snapshots.length === 1 ? "" : "s"}
          {/if}
        </p>
      </div>
      {#if unmarkedToday.length > 0 && loaded}
        <button
          class="mark-now"
          onclick={() => goto(`/groups/${snapshots.find((s) => s.group.id === unmarkedToday[0])?.group.id ?? "/groups"}`)}
        >
          <Icon name="calendar" size={17} />
          Mark my group attendance
        </button>
      {/if}
    </div>

    {#if loaded}
      <NeuCard class="hero-card">
        <div class="hero-inner">
          <div class="hero-ring">
            <ProgressRing value={pct} size={130} trackLabel="attendance" />
          </div>
          <div class="hero-mid">
            <h2>My attendance</h2>
            <p class="hero-nums">
              <b>{personalPresent}</b> of <b>{personalExpected}</b> expected days
              {#if personalExpected > 0}
                · {pct}%
              {/if}
            </p>
            <p class="hero-missed muted-3 small">
              {#if missed > 0}
                {missed} day{missed === 1 ? "" : "s"} you were expected but weren't marked present
              {:else if personalExpected > 0}
                No missed days
              {:else}
                Set your expected days to get started
              {/if}
            </p>
          </div>
          <div class="hero-right">
            <NeuButton icon="edit" label="Set my totals" onclick={() => (totalsOpen = true)} />
          </div>
        </div>
        <div class="hero-mark">
          <span class="mark-label muted-3 small">
            {#if todayStatus}
              Today: <b class="today-{todayStatus}">{todayStatus}</b> · tap again to undo
            {:else}
              How are you today?
            {/if}
          </span>
          <div class="mark-btns">
            {#each MARK_BTNS as btn (btn.status)}
              <button
                class="mk"
                class:on={todayStatus === btn.status}
                style={`--mk-color: ${btn.color}`}
                onclick={() => handleMark(btn.status)}
                title={todayStatus === btn.status ? `Unmark today` : `Mark today ${btn.status}`}
              >
                <Icon name={btn.icon} size={16} />
                {btn.label}
              </button>
            {/each}
          </div>
        </div>
      </NeuCard>

      {#if unmarkedToday.length > 0}
        <div class="reminder">
          <span class="rem-ic"><Icon name="bell" size={18} /></span>
          <div class="rem-txt">
            <b>
              {unmarkedToday.length === 1
                ? `You haven't marked yourself in ${snapshots.find((s) => s.group.id === unmarkedToday[0])?.group.name ?? "a group"} today.`
                : `You haven't marked yourself in ${unmarkedToday.length} groups today.`}
            </b>
            <span class="muted small">Open a group and tap your status — present, late, excused, or absent.</span>
          </div>
        </div>
      {/if}

      <div class="stat-grid">
        <NeuCard>
          <div class="stat-row">
            <span class="stat-ic" style="--tint: var(--present); --soft: var(--present-soft)"><Icon name="check-circle" size={19} /></span>
            <div>
              <div class="stat-v">{personalExpected}</div>
              <div class="stat-l">Expected days</div>
            </div>
          </div>
        </NeuCard>
        <NeuCard>
          <div class="stat-row">
            <span class="stat-ic" style="--tint: var(--present); --soft: var(--present-soft)"><Icon name="check" size={19} /></span>
            <div>
              <div class="stat-v">{personalPresent}</div>
              <div class="stat-l">Days present</div>
            </div>
          </div>
        </NeuCard>
        <NeuCard>
          <div class="stat-row">
            <span class="stat-ic" style="--tint: var(--absent); --soft: var(--absent-soft)"><Icon name="clock" size={19} /></span>
            <div>
              <div class="stat-v">{missed}</div>
              <div class="stat-l">Missed days</div>
            </div>
          </div>
        </NeuCard>
        {#if snapshots.length > 0}
          <NeuCard>
            <div class="stat-row">
              <span class="stat-ic" style="--tint: var(--primary); --soft: var(--primary-soft)"><Icon name="users" size={19} /></span>
              <div>
                <div class="stat-v">{snapshots.length}</div>
                <div class="stat-l">Groups</div>
              </div>
            </div>
          </NeuCard>
        {/if}
      </div>

      <section class="section">
        <h2>Groups {#if snapshots.length > 0}<span class="muted-3 small" style="font-weight:700;text-transform:none;letter-spacing:0"> · optional</span>{/if}</h2>
        {#if snapshots.length === 0}
          <NeuCard>
            <EmptyState
              icon="users"
              title="No groups yet"
              message="Groups are optional — add one to share attendance with a team or club, or just keep tracking yourself above."
            >
              <button class="inline-cta" onclick={() => goto("/groups")}>
                <Icon name="plus" size={16} /> Create or join a group
              </button>
            </EmptyState>
          </NeuCard>
        {:else}
          <div class="group-grid">
            {#each snapshots as s (s.group.id)}
              <NeuCard hoverable class={unmarkedToday.includes(s.group.id) ? "needs-me" : undefined}>
                <button class="group-card" onclick={() => goto(`/groups/${s.group.id}`)}>
                  <div class="gc-top">
                    <span class="gc-ic"><Icon name="users" size={18} /></span>
                    <div class="gc-title">
                      <b>{s.group.name}</b>
                      <span class="muted-3 small">{s.group.description || `${s.stats.dates.length} days tracked`}</span>
                    </div>
                    {#if unmarkedToday.includes(s.group.id)}
                      <span class="needs-tag">needs you</span>
                    {/if}
                  </div>
                  <div class="gc-mid">
                    <div class="gc-my">
                      <b>{myPct(s)}%</b>
                      <span class="muted-3 small">· {myTotal(s)} records</span>
                    </div>
                    <div class="gc-right">
                      <div class="pills">
                        <NeuBadge status="present" label={`${s.stats.totals.present} present`} />
                        <NeuBadge status="late" label={`${s.stats.totals.late} late`} />
                        <NeuBadge status="excused" label={`${s.stats.totals.excused} excused`} />
                        <NeuBadge status="absent" label={`${s.stats.totals.absent} absent`} />
                      </div>
                      <div class="mn"><b>{s.members.length}</b> members · everyone sees everyone</div>
                    </div>
                  </div>
                  <div class="gc-foot">
                    <span class="muted-3 small">In this group · {DAYS} days</span>
                    <span class="open">Open <Icon name="chevron-right" size={15} /></span>
                  </div>
                </button>
              </NeuCard>
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </div>
  {/snippet}
</AppShell>

<AttendanceTotalsModal bind:open={totalsOpen} onSaved={loadPersonal} />

<style>
  .mark-now {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 3px solid var(--ink);
    background: var(--primary);
    color: #fff;
    padding: 12px 18px;
    border-radius: var(--radius-md);
    font-weight: 800;
    font-size: 14px;
    box-shadow: 3px 3px 0 var(--ink);
    transition: background var(--t), box-shadow var(--t), transform var(--t);
    white-space: normal;
    text-align: center;
  }
  .mark-now:hover {
    background: var(--primary-strong);
  }
  .mark-now:active {
    box-shadow: none;
    transform: translate(3px, 3px);
  }

  /* Hero card */
  .hero-card :global(.neu-card-body) {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hero-inner {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .hero-ring {
    flex-shrink: 0;
  }
  .hero-mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hero-mid h2 {
    margin: 0;
    font-size: 18px;
  }
  .hero-nums {
    font-size: 15px;
    margin: 0;
  }
  .hero-nums b {
    font-size: 20px;
    font-weight: 900;
  }
  .hero-right {
    flex-shrink: 0;
  }

  .hero-mark {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 3px dashed var(--ink);
    padding-top: 14px;
    flex-wrap: wrap;
  }
  .mark-label {
    font-size: 13px;
  }
  .today-present { color: var(--present); font-weight: 800; }
  .today-absent  { color: var(--absent);  font-weight: 800; }
  .today-holiday { color: var(--excused); font-weight: 800; }
  .mark-btns {
    display: flex;
    gap: 8px;
  }
  .mk {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 2px solid var(--ink);
    background: var(--surface);
    color: var(--text-2);
    padding: 8px 14px;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 800;
    box-shadow: 2px 2px 0 var(--ink);
    transition: box-shadow var(--t), transform var(--t), color var(--t), background var(--t);
  }
  .mk:hover {
    color: var(--mk-color);
    background: color-mix(in srgb, var(--mk-color) 10%, var(--surface));
  }
  .mk:active {
    box-shadow: none;
    transform: translate(2px, 2px);
  }
  .mk.on {
    color: var(--mk-color);
    background: color-mix(in srgb, var(--mk-color) 18%, var(--surface));
    box-shadow: none;
    transform: translate(2px, 2px);
  }

  .reminder {
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--accent);
    border: 3px solid var(--ink);
    border-radius: var(--radius-md);
    padding: 14px 18px;
    margin-bottom: 22px;
    box-shadow: 4px 4px 0 var(--ink);
  }
  .rem-ic {
    color: var(--ink);
    display: flex;
  }
  .rem-txt {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 14px;
  }
  .rem-txt b {
    font-weight: 800;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 18px;
    margin-bottom: 30px;
  }

  .stat-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .stat-ic {
    width: 46px;
    height: 46px;
    border-radius: var(--radius-md);
    border: 3px solid var(--ink);
    color: var(--tint);
    background: var(--soft);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 3px 3px 0 var(--ink);
    flex-shrink: 0;
  }
  .stat-v {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .stat-l {
    font-size: 12.5px;
    color: var(--text-3);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .section {
    margin-top: 8px;
  }
  .section h2 {
    font-size: 18px;
    margin-bottom: 14px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .group-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .group-card {
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 22px;
  }

  .group-grid :global(.needs-me.neu-card) {
    box-shadow: 3px 3px 0 var(--primary);
  }

  .gc-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  .gc-ic {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    border: 3px solid var(--ink);
    color: var(--ink);
    background: var(--primary-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 3px 3px 0 var(--ink);
  }
  .gc-title {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .gc-title b {
    font-size: 15.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .needs-tag {
    font-size: 10.5px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fff;
    background: var(--primary);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 2px 8px;
    box-shadow: 2px 2px 0 var(--ink);
    white-space: nowrap;
  }

  .gc-mid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .gc-my {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .gc-my b {
    font-size: 26px;
    font-weight: 900;
    line-height: 1.2;
  }
  .gc-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mn {
    font-size: 13px;
    color: var(--text-2);
  }

  .gc-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 2px dashed var(--ink);
    margin-top: 14px;
    padding-top: 12px;
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--primary);
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
  }

  .inline-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 3px solid var(--ink);
    background: var(--primary);
    color: #fff;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    font-weight: 800;
    font-size: 14px;
    box-shadow: 3px 3px 0 var(--ink);
  }
  .inline-cta:active {
    box-shadow: none;
    transform: translate(3px, 3px);
  }

  @media (max-width: 640px) {
    .hero-inner {
      flex-direction: column;
      text-align: center;
    }
    .hero-mid {
      align-items: center;
    }
    .hero-mark {
      flex-direction: column;
      align-items: flex-start;
    }
    .hero-right {
      margin-bottom: 8px;
    }
    .mark-btns {
      width: 100%;
      flex-wrap: wrap;
    }
    .stat-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .group-card {
      padding: 16px;
    }
    .gc-title b {
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
    }
    .open {
      display: none;
    }
  }
</style>
