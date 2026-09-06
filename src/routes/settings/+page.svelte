<script lang="ts">
  import AppShell from "../../lib/components/AppShell.svelte";
  import NeuCard from "../../lib/components/NeuCard.svelte";
  import NeuToggle from "../../lib/components/NeuToggle.svelte";
  import NeuInput from "../../lib/components/NeuInput.svelte";
  import NeuButton from "../../lib/components/NeuButton.svelte";
  import Icon from "../../lib/components/Icon.svelte";
  import Avatar from "../../lib/components/Avatar.svelte";
  import { user, logout } from "../../lib/session";
  import { toast } from "../../lib/toasts";
  import { backendMode } from "../../lib/db";
  import { goto } from "$app/navigation";
  import { getPref, savePref, defaultPref, pushNow, ensurePermission, scheduleNextReminder, type ReminderPref } from "../../lib/notify";
  import { isDesktopApp, setHideWindowTitle, hideWindowTitle } from "../../lib/window";

  let pref = $state<ReminderPref>(getPref());
  const desktopApp = isDesktopApp();
  const DAYS = [
    { n: 0, label: "Sun" },
    { n: 1, label: "Mon" },
    { n: 2, label: "Tue" },
    { n: 3, label: "Wed" },
    { n: 4, label: "Thu" },
    { n: 5, label: "Fri" },
    { n: 6, label: "Sat" },
  ];

  async function persistReminder() {
    savePref(pref);
    scheduleNextReminder(pref).catch(() => {});
    toast("Reminder preferences saved.", "success");
  }

  function toggleDay(n: number) {
    if (pref.days.includes(n)) pref = { ...pref, days: pref.days.filter((d) => d !== n) };
    else pref = { ...pref, days: [...pref.days, n].sort() };
  }

  async function testPush() {
    await ensurePermission();
    await pushNow("Tulip Track", "Notifications are working. Nothing to mark — just a test.");
    toast("Test notification sent.", "info");
  }

  async function handleLogout() {
    await logout();
    goto("/login");
  }

  function resetPref() {
    pref = defaultPref;
    savePref(pref);
    toast("Reminders reset to the default schedule.", "info");
  }
</script>

<AppShell active="settings">
  {#snippet children()}
  <div class="page settings-page">
    <div class="page-head">
      <div>
        <h1>Settings</h1>
        <p class="muted small">Reminders, profile, and account.</p>
      </div>
    </div>

    <div class="grid">
      <NeuCard>
        <h3 class="card-title">Daily reminder</h3>
        <p class="muted small sub">Get pinged when it's time to mark the day — in-app banner plus a system notification when possible.</p>

        <div class="row-field">
          <NeuToggle label="Enable reminders" sublabel="Ask Tulip to nudge you daily" bind:checked={pref.enabled} />
        </div>

        <div class="row-field time-wrap" class:dim={!pref.enabled}>
          <NeuInput label="Remind me at" type="time" bind:value={pref.time} style="width: 140px" />
        </div>

        <div class="row-field" class:dim={!pref.enabled}>
          <span class="lbl">Days</span>
          <div class="day-grid">
            {#each DAYS as d (d.n)}
              <button class="day" class:on={pref.days.includes(d.n)} onclick={() => toggleDay(d.n)}>{d.label}</button>
            {/each}
          </div>
        </div>

        <div class="acts">
          <NeuButton icon="bell" label="Test notification" variant="inset" onclick={testPush} />
          <NeuButton icon="check" label="Save reminder" variant="primary" onclick={persistReminder} />
          <button class="reset" onclick={resetPref}>Reset to default</button>
        </div>
      </NeuCard>

      <NeuCard>
        <h3 class="card-title">Profile</h3>
        <div class="profile">
          <Avatar name={$user?.name || $user?.email || "?"} size={64} />
          <div>
            <div class="p-name">{$user?.name || "—"}</div>
            <div class="p-mail muted small">{$user?.email || ""}</div>
            <span class="mode">
              <Icon name={backendMode === "demo" ? "tulip" : "check-circle"} size={13} />
              {backendMode === "demo" ? "Demo mode · data stays on this device" : "Synced via Supabase"}
            </span>
          </div>
        </div>

        <div class="row-field">
          <span class="lbl">About</span>
          <p class="muted small" style="margin:0">Tulip Track: shared groups, join codes, and everyone tracking their own attendance.</p>
        </div>

        <div class="acts">
          <NeuButton icon="logout" label="Sign out" onclick={handleLogout} />
        </div>
      </NeuCard>

      <NeuCard>
        <h3 class="card-title">Data & sync</h3>
        <div class="kv-row">
          <span class="kv-k">
            <Icon name="users" size={16} /> Backend
          </span>
          <span class="kv-v">
            <span class="pill">{backendMode === "demo" ? "Local demo" : "Supabase"}</span>
          </span>
        </div>
        {#if backendMode === "demo"}
          <p class="muted small">
            Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to a <code>.env</code>
            file and run the SQL in <code>supabase/schema.sql</code> to enable cloud sync across your devices.
          </p>
          <div class="hint-box">
            <Icon name="info" size={15} />
            <span>Demo data is stored in this browser's localStorage and will not sync.</span>
          </div>
        {:else}
          <p class="muted small">Your reports sync securely across this device and your other devices using the same account.</p>
        {/if}
      </NeuCard>

      {#if desktopApp}
        <NeuCard>
          <h3 class="card-title">Window</h3>
          <p class="muted small sub">Desktop app only.</p>
          <div class="row-field">
            <NeuToggle
              label="Hide window decorations"
              sublabel="Fully frameless: removes the styled title bar. Move the window by dragging the sidebar or the top of the page; close from the OS taskbar or Alt+F4."
              checked={$hideWindowTitle}
              oninput={(e: Event) => setHideWindowTitle((e.currentTarget as HTMLInputElement).checked)}
            />
          </div>
        </NeuCard>
      {/if}
    </div>
  </div>
  {/snippet}
</AppShell>

<style>
  .settings-page {
    max-width: 760px;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .card-title {
    font-size: 17px;
    margin-bottom: 6px;
  }
  .sub {
    margin: 0 0 18px;
    max-width: 460px;
  }

  .row-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 18px;
  }
  .dim {
    opacity: 0.55;
    pointer-events: none;
  }

  .lbl {
    font-size: 13px;
    font-weight: 800;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .time-wrap {
    align-items: flex-start;
  }

  .day-grid {
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

  .acts {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .reset {
    border: none;
    background: transparent;
    color: var(--text-3);
    font-size: 12.5px;
    font-weight: 700;
    padding: 6px;
    border-radius: var(--radius-sm);
    transition: color var(--t);
  }
  .reset:hover {
    color: var(--absent);
  }

  .profile {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }
  .p-name {
    font-size: 17px;
    font-weight: 800;
  }
  .p-mail {
    margin-bottom: 6px;
  }
  .mode {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 800;
    color: var(--ink);
    background: var(--accent-soft);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    box-shadow: 2px 2px 0 var(--ink);
  }

  .kv-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .kv-k {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    font-size: 14px;
    color: var(--text-1);
  }
  .pill {
    font-size: 12px;
    font-weight: 800;
    color: var(--ink);
    background: var(--accent);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    box-shadow: 2px 2px 0 var(--ink);
  }
  code {
    background: var(--surface-2);
    border: 1px solid var(--ink);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-size: 12px;
  }
  .hint-box {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: var(--late-soft);
    border: 2px solid var(--ink);
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.4;
  }
</style>