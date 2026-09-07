<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import AppShell from "../../../lib/components/AppShell.svelte";
  import NeuCard from "../../../lib/components/NeuCard.svelte";
  import NeuButton from "../../../lib/components/NeuButton.svelte";
  import NeuInput from "../../../lib/components/NeuInput.svelte";
  import Modal from "../../../lib/components/Modal.svelte";
  import ConfirmDialog from "../../../lib/components/ConfirmDialog.svelte";
  import EmptyState from "../../../lib/components/EmptyState.svelte";
  import Icon from "../../../lib/components/Icon.svelte";
  import Avatar from "../../../lib/components/Avatar.svelte";
  import AttendanceTotalsModal from "../../../lib/components/AttendanceTotalsModal.svelte";
  import {
    listGroups,
    listGroupMembers,
    getGroupMemberAttendance,
    regenerateJoinCode,
    leaveGroup,
    deleteGroup,
    currentUserId,
    listHolidays,
    addHoliday,
    removeHoliday,
    setOffWeekdays,
  } from "../../../lib/db";
  import { toast } from "../../../lib/toasts";
  import type { Group, ProfileUser, HolidayEvent } from "../../../lib/types";

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const groupId = $derived($page.params.id ?? "");

  let group = $state<Group | null>(null);
  let me = $state<string | null>(null);
  let members = $state<ProfileUser[]>([]);
  let loaded = $state(false);
  let holidays = $state<HolidayEvent[]>([]);
  let stats = $state<Record<string, { expected: number; present: number }>>({});

  let copied = $state(false);
  let regenerating = $state(false);
  let confirmLeave = $state(false);
  let confirmDelete = $state(false);

  let holidayOpen = $state(false);
  let hName = $state("");
  let hFrom = $state("");
  let hTo = $state("");
  let hBusy = $state(false);

  let totalsOpen = $state(false);

  $effect(() => {
    load();
    currentUserId().then((id) => (me = id));
  });

  async function load() {
    loaded = false;
    const groups = await listGroups();
    group = groups.find((g) => g.id === groupId) ?? null;
    if (!group) {
      goto("/groups");
      return;
    }
    await Promise.all([loadMembers(), refreshHolidays()]);
    loaded = true;
  }

  async function loadMembers() {
    members = await listGroupMembers(groupId);
    const rows = await getGroupMemberAttendance(members.map((m) => m.id));
    stats = rows;
  }

  async function refreshHolidays() {
    holidays = await listHolidays(groupId);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group?.join_code ?? "");
      copied = true;
      setTimeout(() => (copied = false), 1500);
      toast("Join code copied.", "success");
    } catch {
      toast("Couldn't copy — select the code manually.", "error");
    }
  }

  async function handleRegenerate() {
    if (!group) return;
    regenerating = true;
    try {
      group = { ...group, join_code: await regenerateJoinCode(group.id) };
      toast("New join code generated.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to regenerate code.", "error");
    } finally {
      regenerating = false;
    }
  }

  async function handleLeave() {
    if (!group) return;
    await leaveGroup(group.id);
    toast(`Left ${group.name}.`, "info");
    goto("/groups");
  }

  async function handleDelete() {
    if (!group) return;
    await deleteGroup(group.id);
    toast(`Deleted ${group.name}.`, "info");
    goto("/groups");
  }

  const meCard = $derived(group ? group.created_by === me : false);

  // --- Holidays -----------------------------------------------------------

  async function toggleWeekday(d: number) {
    if (!group || !meCard) return;
    const next = group.off_weekdays.includes(d)
      ? group.off_weekdays.filter((x) => x !== d)
      : [...group.off_weekdays, d];
    group = { ...group, off_weekdays: next };
    try {
      await setOffWeekdays(group.id, next);
    } catch (e) {
      group = { ...group, off_weekdays: group.off_weekdays.filter((x) => x !== d) };
      toast(e instanceof Error ? e.message : "Failed to save off days.", "error");
    }
  }

  async function addHolidayEvt() {
    if (!group) return;
    if (!hName.trim()) {
      toast("Give the holiday a name.", "error");
      return;
    }
    if (!hFrom || !hTo) {
      toast("Pick a date range.", "error");
      return;
    }
    hBusy = true;
    try {
      await addHoliday(group.id, { name: hName, starts_on: hFrom, ends_on: hTo });
      hName = "";
      hFrom = "";
      hTo = "";
      await refreshHolidays();
      toast("Holiday added — those days won't count.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add holiday.", "error");
    } finally {
      hBusy = false;
    }
  }

  async function deleteHolidayEvt(h: HolidayEvent) {
    if (!group) return;
    try {
      await removeHoliday(group.id, h.id);
      await refreshHolidays();
      toast("Holiday removed.", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to remove holiday.", "error");
    }
  }
</script>

<AppShell active="groups">
  {#snippet children()}
  <div class="page">
    {#if group}
      <div class="page-head">
        <div class="head-left">
          <button class="back" onclick={() => goto("/groups")} aria-label="Back to groups">
            <Icon name="chevron-left" size={18} />
          </button>
          <div>
            <h1>{group.name}</h1>
            <p class="muted small">{group.description || "Attendance comparison"}</p>
          </div>
        </div>
        <div class="head-acts">
          {#if meCard}
            <NeuButton size="sm" variant="inset" icon="calendar" label="Holidays" onclick={() => (holidayOpen = true)} />
          {/if}
          <NeuButton size="sm" variant="inset" icon="logout" label="Leave" onclick={() => (confirmLeave = true)} />
          {#if meCard}
            <NeuButton size="sm" variant="primary" icon="trash" label="Delete" onclick={() => (confirmDelete = true)} />
          {/if}
        </div>
      </div>

      <div class="code-card">
        <span class="code-lbl"><Icon name="key" size={15} /> Join code</span>
        <span class="code">{group.join_code}</span>
        <NeuButton size="sm" icon={copied ? "check" : "copy"} label={copied ? "Copied!" : "Copy"} onclick={copyCode} />
        {#if meCard}
          <NeuButton
            size="sm"
            variant="inset"
            icon="refresh"
            label="Regenerate"
            disabled={regenerating}
            onclick={handleRegenerate}
            title="Anyone with the old code can still join until you regenerate."
          />
        {/if}
        <p class="code-hint muted-3 small">
          Share this code — anyone with it can join and compare their attendance.
        </p>
      </div>

      {#if !loaded}
        <p class="muted small" style="padding:24px 4px">Loading…</p>
      {:else if group && members.length === 0}
        <NeuCard>
          <EmptyState
            icon="users"
            title="No one has joined yet"
            message="Share the join code above — members join the group themselves and their attendance shows up here for comparison."
          />
        </NeuCard>
      {:else if group}
        <NeuCard pressed>
          <div class="list-head">
            <h2 style="margin:0">Attendance · {members.length} {members.length === 1 ? "member" : "members"}</h2>
            <div class="list-acts">
              <NeuButton size="sm" variant="inset" icon="edit" label="My attendance" onclick={() => (totalsOpen = true)} title="Set your personal attendance totals." />
              <span class="muted-3 small">Your totals are set on the dashboard — here everyone is compared side by side.</span>
            </div>
          </div>

          <div class="cmp-list">
            {#each members as m (m.id)}
              {@const t = stats[m.id] ?? { expected: 0, present: 0 }}
              {@const pct = t.expected > 0 ? Math.round((t.present / t.expected) * 100) : 0}
              <div class="cmp-row">
                <Avatar name={m.name} size={38} />
                <div class="cmp-name">
                  <b>
                    {m.name}
                    {#if m.id === me}<span class="you">you</span>{/if}
                  </b>
                  <span class="muted-3 small">{m.email || "—"}</span>
                </div>
                <div class="cmp-nums">
                  <span class="muted small">{t.present} / {t.expected} days</span>
                  <span class="cmp-pct">{pct}%</span>
                </div>
                <div class="cmp-bar">
                  <div class="cmp-fill" class:low={pct < 75 && t.expected > 0} style="width:{pct}%"></div>
                </div>
              </div>
            {/each}
          </div>
        </NeuCard>
      {/if}
    {/if}
  </div>
  {/snippet}
</AppShell>

<Modal open={holidayOpen} title="Holidays & off days" width={540} onclose={() => (holidayOpen = false)}>
  {#if meCard && group}
    <div class="hol-form">
      <h4 class="hol-head"><Icon name="clock" size={17} /> Recurring off days</h4>
      <p class="muted small" style="margin:0 0 10px">
        Days that repeat every week and never count attendance (e.g. weekends).
      </p>
      <div class="week-grid">
        {#each [0, 1, 2, 3, 4, 5, 6] as d (d)}
          <button class="day" class:on={group.off_weekdays.includes(d)} onclick={() => toggleWeekday(d)}>
            {WEEKDAYS[d]}
          </button>
        {/each}
      </div>

      <h4 class="hol-head" style="margin-top:22px"><Icon name="calendar" size={17} /> Named holidays</h4>
      <p class="muted small" style="margin:0 0 10px">One-off breaks or closures — attendance on these days is skipped too.</p>

      <div class="hol-list">
        {#if holidays.length === 0}
          <p class="muted-3 small" style="padding:6px 2px">No named holidays yet.</p>
        {:else}
          {#each holidays as h (h.id)}
            <div class="hol-row">
              <Icon name="calendar" size={15} />
              <span class="hol-name">{h.name}</span>
              <span class="hol-range muted small">{h.starts_on} → {h.ends_on}</span>
              <button class="hol-del" onclick={() => deleteHolidayEvt(h)} aria-label={`Remove ${h.name}`} title="Remove holiday">
                <Icon name="trash" size={15} />
              </button>
            </div>
          {/each}
        {/if}
      </div>

      <div class="hol-add">
        <NeuInput label="Name" placeholder="e.g. Winter break" bind:value={hName} />
        <div class="hol-range-inputs">
          <NeuInput label="From" type="date" bind:value={hFrom} />
          <NeuInput label="To" type="date" bind:value={hTo} />
        </div>
        <NeuButton icon="plus" variant="primary" {hBusy} disabled={hBusy} onclick={addHolidayEvt}>
          Add holiday
        </NeuButton>
      </div>
    </div>
  {/if}
</Modal>

<AttendanceTotalsModal bind:open={totalsOpen} />

<ConfirmDialog
  open={confirmLeave}
  title="Leave group?"
  message={`You'll stop appearing in ${group?.name ?? "this group"} but your past records stay.`}
  confirmLabel="Leave"
  danger={false}
  onConfirm={handleLeave}
  onCancel={() => (confirmLeave = false)}
/>

<ConfirmDialog
  open={confirmDelete}
  title="Delete group?"
  message={`All attendance records for ${group?.name ?? "this group"} will be deleted for every member. This can't be undone.`}
  confirmLabel="Delete"
  onConfirm={handleDelete}
  onCancel={() => (confirmDelete = false)}
/>

<style>
  .head-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .back {
    border: 3px solid var(--ink);
    background: var(--surface);
    color: var(--text-2);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    box-shadow: 3px 3px 0 var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 6px;
    transition: box-shadow var(--t), transform var(--t);
  }
  .back:active {
    box-shadow: none;
    transform: translate(3px, 3px);
  }

  .head-acts {
    display: flex;
    gap: 8px;
  }

  .code-card {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    background: var(--accent);
    border: 3px solid var(--ink);
    border-radius: var(--radius-lg);
    box-shadow: 5px 5px 0 var(--ink);
    padding: 14px 18px;
    margin-bottom: 18px;
  }
  .code-lbl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-2);
  }
  .code {
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 0.18em;
    border: 3px solid var(--ink);
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 6px 16px;
    box-shadow: 3px 3px 0 var(--ink);
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .code-hint {
    width: 100%;
    margin: 0;
  }

  .list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  .list-acts {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .cmp-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cmp-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 4px;
    border-bottom: 2px dashed var(--surface-3);
  }
  .cmp-row:last-child {
    border-bottom: none;
  }
  .cmp-name {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .cmp-name b {
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .you {
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink);
    background: var(--accent);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 1px 7px;
    margin-left: 8px;
    vertical-align: 1px;
  }
  .cmp-nums {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-shrink: 0;
  }
  .cmp-pct {
    font-size: 16px;
    font-weight: 900;
    color: var(--primary-strong);
    width: 46px;
    text-align: right;
  }
  .cmp-bar {
    width: 140px;
    height: 16px;
    background: var(--surface-2);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: var(--shadow-inset);
  }
  .cmp-fill {
    height: 100%;
    background: var(--primary);
    border-right: 2px solid var(--ink);
    transition: width var(--t);
  }
  .cmp-fill.low {
    background: var(--absent);
  }


  /* Holiday modal */
  .hol-form {
    display: flex;
    flex-direction: column;
  }
  .hol-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    margin: 0 0 8px;
  }
  .week-grid {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .day {
    border: 2px solid var(--ink);
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--ink);
    color: var(--text-2);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 12.5px;
    font-weight: 800;
    transition: box-shadow var(--t), color var(--t), background var(--t);
  }
  .day:hover {
    background: var(--accent-soft);
  }
  .day.on {
    color: var(--ink);
    background: var(--accent);
    box-shadow: none;
    transform: translate(2px, 2px);
  }

  .hol-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 16px;
  }
  .hol-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .hol-name {
    font-weight: 800;
    font-size: 14px;
  }
  .hol-range {
    margin-left: auto;
  }
  .hol-del {
    border: none;
    background: transparent;
    color: var(--text-3);
    display: flex;
    padding: 4px;
    border-radius: var(--radius-sm);
    transition: color var(--t), background var(--t);
  }
  .hol-del:hover {
    color: var(--absent);
    background: var(--absent-soft);
  }

  .hol-add {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-top: 3px dashed var(--ink);
    padding-top: 16px;
  }
  .hol-range-inputs {
    display: flex;
    gap: 12px;
  }
  .hol-range-inputs :global(.neu-field) {
    flex: 1;
  }

  @media (max-width: 640px) {
    .cmp-bar {
      width: 80px;
    }
    .cmp-nums {
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .cmp-pct {
      width: auto;
      font-size: 14px;
    }
    .code {
      font-size: 18px;
      letter-spacing: 0.12em;
      padding: 5px 12px;
    }
    .hol-range-inputs {
      flex-direction: column;
    }
    .hol-name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .head-acts {
      width: 100%;
      flex-wrap: wrap;
    }
  }

  @media (max-width: 420px) {
    .cmp-row {
      flex-wrap: wrap;
    }
    .cmp-bar {
      width: 100%;
      order: 3;
    }
    .cmp-name {
      min-width: 0;
    }
  }
</style>