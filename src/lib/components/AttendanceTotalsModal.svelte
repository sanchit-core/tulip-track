<script lang="ts">
  import Modal from "./Modal.svelte";
  import NeuInput from "./NeuInput.svelte";
  import NeuButton from "./NeuButton.svelte";
  import { currentUserId, getPersonalAttendance, setPersonalTotals } from "../db";
  import { toast } from "../toasts";

  let {
    open = $bindable(false),
    onSaved,
  }: {
    open?: boolean;
    onSaved?: () => void;
  } = $props();

  let expected = $state(0);
  let present = $state(0);
  let busy = $state(false);

  $effect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const uid = await currentUserId();
      if (!uid) return;
      const t = await getPersonalAttendance(uid);
      if (cancelled) return;
      expected = t.expected;
      present = t.present;
    })();
    return () => {
      cancelled = true;
    };
  });

  const expNum = $derived(Math.max(0, Math.floor(expected) || 0));
  const preNum = $derived(Math.max(0, Math.floor(present) || 0));
  const pct = $derived(expNum > 0 ? Math.round((Math.min(preNum, expNum) / expNum) * 100) : 0);

  async function save() {
    busy = true;
    try {
      const uid = await currentUserId();
      if (!uid) throw new Error("Not signed in.");
      await setPersonalTotals(uid, expected, present);
      toast("Attendance updated.", "success");
      open = false;
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.", "error");
    } finally {
      busy = false;
    }
  }
</script>

<Modal {open} title="My attendance" width={460} onclose={() => (open = false)}>
  <div class="total-form">
    <p class="muted small" style="margin:0 0 4px">
      These two numbers are the source of your personal attendance percentage.
      Marking a day Present / Absent on the dashboard adjusts them automatically,
      or set them here in bulk.
    </p>
    <NeuInput
      label="Days you were supposed to be present"
      type="number"
      min="0"
      bind:value={expected}
    />
    <NeuInput
      label="Days you were present"
      type="number"
      min="0"
      max={String(expNum)}
      bind:value={present}
      hint={`Must not exceed ${expNum}`}
    />
    <div class="preview">
      <span class="pct">{pct}%</span>
      <span class="muted small">{preNum} present of {expNum} expected</span>
    </div>
    <div class="form-acts">
      <NeuButton variant="inset" full onclick={() => (open = false)}>Cancel</NeuButton>
      <NeuButton variant="primary" full {busy} disabled={busy} onclick={save}>
        Save
      </NeuButton>
    </div>
  </div>
</Modal>

<style>
  .total-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .preview {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .pct {
    font-size: 22px;
    font-weight: 900;
    color: var(--present);
  }
  .form-acts {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }
  .form-acts :global(.neu-btn) {
    flex: 1;
  }
</style>
