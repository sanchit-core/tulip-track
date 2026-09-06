<script lang="ts">
  import AppShell from "../../lib/components/AppShell.svelte";
  import NeuCard from "../../lib/components/NeuCard.svelte";
  import NeuButton from "../../lib/components/NeuButton.svelte";
  import NeuInput from "../../lib/components/NeuInput.svelte";
  import Modal from "../../lib/components/Modal.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import EmptyState from "../../lib/components/EmptyState.svelte";
  import Icon from "../../lib/components/Icon.svelte";
  import {
    listGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    joinGroup,
    listGroupMembers,
    currentUserId,
  } from "../../lib/db";
  import { toast } from "../../lib/toasts";
  import { goto } from "$app/navigation";
  import type { Group } from "../../lib/types";

  let groups = $state<Group[]>([]);
  let counts = $state<Record<string, number>>({});
  let me = $state<string | null>(null);
  let loaded = $state(false);

  let modalOpen = $state(false);
  let editing: Group | null = $state(null);
  let name = $state("");
  let description = $state("");
  let saving = $state(false);
  let confirmDelete: Group | null = $state(null);

  let joinOpen = $state(false);
  let joinCode = $state("");
  let joining = $state(false);

  async function load() {
    me = await currentUserId();
    groups = await listGroups();
    const c: Record<string, number> = {};
    await Promise.all(
      groups.map(async (g) => {
        const m = await listGroupMembers(g.id);
        c[g.id] = m.length;
      }),
    );
    counts = c;
    loaded = true;
  }

  $effect(() => {
    load();
  });

  function openCreate() {
    editing = null;
    name = "";
    description = "";
    modalOpen = true;
  }

  function openEdit(g: Group) {
    editing = g;
    name = g.name;
    description = g.description;
    modalOpen = true;
  }

  async function save() {
    if (!name.trim()) {
      toast("Give your group a name.", "error");
      return;
    }
    saving = true;
    try {
      if (editing) {
        await updateGroup(editing.id, { name: name.trim(), description: description.trim() });
        toast("Group updated.", "success");
      } else {
        await createGroup({ name: name.trim(), description: description.trim() });
        toast("Group created.", "success");
      }
      modalOpen = false;
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save group.", "error");
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!confirmDelete) return;
    try {
      await deleteGroup(confirmDelete.id);
      toast(`"${confirmDelete.name}" deleted.`, "info");
      confirmDelete = null;
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete group.", "error");
    }
  }

  async function join() {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast("Enter the 6-character join code.", "error");
      return;
    }
    joining = true;
    try {
      const g = await joinGroup(code);
      if (!g) {
        toast("No group found with that code.", "error");
        return;
      }
      toast(`Joined ${g.name}.`, "success");
      joinOpen = false;
      joinCode = "";
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to join group.", "error");
    } finally {
      joining = false;
    }
  }
</script>

<AppShell active="groups">
  {#snippet children()}
  <div class="page">
    <div class="page-head">
      <div>
        <h1>Groups</h1>
        <p class="muted small">Classes, clubs, teams — create one, share the code, everyone tracks themselves.</p>
      </div>
      <div class="acts">
        <NeuButton icon="key" label="Join" onclick={() => (joinOpen = true)} />
        <NeuButton icon="plus" variant="primary" label="New group" onclick={openCreate} />
      </div>
    </div>

    {#if !loaded}
      <p class="muted small" style="padding:24px 4px">Loading…</p>
    {:else if groups.length === 0}
      <NeuCard>
        <EmptyState
          icon="users"
          title="No groups yet"
          message="Create a group to get a join code. Share it — each member joins and tracks their own attendance."
        >
          <NeuButton icon="plus" variant="primary" label="New group" onclick={openCreate} />
        </EmptyState>
      </NeuCard>
    {:else}
      <div class="list">
        {#each groups as g (g.id)}
          <NeuCard hoverable>
            <div class="row">
              <span class="g-ic"><Icon name="users" size={18} /></span>
              <div class="g-title">
                <b>
                  {g.name}
                  {#if g.created_by === me}
                    <span class="owner">owner</span>
                  {/if}
                </b>
                <span class="muted-3 small">{g.description || "No description"}</span>
              </div>
              <button class="code-chip" onclick={() => goto(`/groups/${g.id}`)} title="Open group">
                <Icon name="key" size={13} />
                {g.join_code}
              </button>
              <span class="count">
                <span class="count-v">{counts[g.id] ?? 0}</span>
                <span class="count-l">members</span>
              </span>
              <div class="row-acts">
                <NeuButton size="sm" icon="calendar" label="Attendance" onclick={() => goto(`/groups/${g.id}`)} />
                {#if g.created_by === me}
                  <NeuButton size="sm" icon="edit" title="Edit" aria-label="Edit" onclick={() => openEdit(g)} />
                  <NeuButton size="sm" variant="inset" icon="trash" title="Delete" aria-label="Delete" onclick={() => (confirmDelete = g)} />
                {/if}
              </div>
            </div>
          </NeuCard>
        {/each}
      </div>
    {/if}
  </div>
  {/snippet}
</AppShell>

<Modal open={modalOpen} title={editing ? "Edit group" : "New group"} onclose={() => (modalOpen = false)}>
  <div class="form">
    <NeuInput label="Group name" placeholder="e.g. Physics X-B" bind:value={name} icon="users" />
    <NeuInput label="Description (optional)" type="textarea" rows={2} placeholder="e.g. Grade 11 · Period 2" bind:value={description} icon="fileText" />
    <p class="muted-3 small" style="margin:0; padding-left:4px">
      {editing ? "Your members keep their old join code." : "You'll get a join code to share after creating — anyone with it can join and track their own attendance."}
    </p>
    <div class="form-acts">
      <NeuButton variant="inset" full onclick={() => (modalOpen = false)}>Cancel</NeuButton>
      <NeuButton variant="primary" full {saving} disabled={saving} onclick={save}>Save group</NeuButton>
    </div>
  </div>
</Modal>

<Modal open={joinOpen} title="Join a group" onclose={() => (joinOpen = false)}>
  <div class="form">
    <NeuInput
      label="Join code"
      placeholder="ABC123"
      bind:value={joinCode}
      icon="key"
      maxlength="6"
      style="text-transform: uppercase; letter-spacing: 0.2em; font-weight: 900;"
      oninput={joinCode = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)}
    />
    <div class="form-acts">
      <NeuButton variant="inset" full onclick={() => (joinOpen = false)}>Cancel</NeuButton>
      <NeuButton variant="primary" full {joining} disabled={joining} onclick={join}>Join group</NeuButton>
    </div>
  </div>
</Modal>

<ConfirmDialog
  open={confirmDelete !== null}
  title="Delete this group?"
  message={`"${confirmDelete?.name}" and all its attendance records will be permanently removed for every member.`}
  confirmLabel="Delete"
  onConfirm={remove}
  onCancel={() => (confirmDelete = null)}
/>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .g-ic {
    width: 44px;
    height: 44px;
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

  .g-title {
    display: flex;
    flex-direction: column;
    min-width: 160px;
    flex: 1;
  }
  .g-title b {
    font-size: 15.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .owner {
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--excused);
    border: 2px solid var(--excused);
    border-radius: var(--radius-sm);
    padding: 1px 7px;
  }

  .code-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 2px solid var(--ink);
    background: var(--accent-soft);
    color: var(--ink);
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.12em;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    box-shadow: 2px 2px 0 var(--ink);
    transition: box-shadow var(--t), transform var(--t);
  }
  .code-chip:hover {
    background: var(--accent);
  }
  .code-chip:active {
    box-shadow: none;
    transform: translate(2px, 2px);
  }

  .count {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 14px;
    border-radius: var(--radius-md);
    border: 2px solid var(--ink);
    background: var(--surface);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .count-v {
    font-weight: 900;
    font-size: 18px;
    line-height: 1.1;
  }
  .count-l {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .row-acts {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-acts {
    display: flex;
    gap: 12px;
    margin-top: 6px;
  }
  .form-acts :global(.neu-btn) {
    flex: 1;
  }

  @media (max-width: 640px) {
    .g-title {
      min-width: 120px;
    }
    .count {
      display: none;
    }
    .row-acts :global(.neu-btn:first-child) {
      display: none;
    }
  }
</style>