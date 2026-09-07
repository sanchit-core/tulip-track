<script lang="ts">
  import NeuButton from "../../lib/components/NeuButton.svelte";
  import NeuInput from "../../lib/components/NeuInput.svelte";
  import NeuCard from "../../lib/components/NeuCard.svelte";
  import { login, user } from "../../lib/session";
  import { signUp } from "../../lib/db";
  import { toast } from "../../lib/toasts";
  import { goto } from "$app/navigation";
  import { backendMode } from "../../lib/db";
  import { seedDemoData } from "../../lib/db";

  let mode = $state<"in" | "up">("in");
  let email = $state("");
  let password = $state("");
  let name = $state("");
  let busy = $state(false);
  let error = $state("");

  async function submit() {
    error = "";
    if (!email || !password) {
      error = "Please fill in your email and password.";
      return;
    }
    busy = true;
    try {
      if (mode === "up") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        await signUp({ email, password, name });
        toast("Account created — welcome to Tulip Track!", "success");
      } else {
        await login({ email, password });
        toast("Signed in!", "success");
      }
      goto("/");
    } catch (e) {
      error = e instanceof Error ? e.message : "Something went wrong.";
    } finally {
      busy = false;
    }
  }

  async function useDemo() {
    error = "";
    busy = true;
    try {
      await seedDemoData();
      await login({ email: "demo@tulip.app", password: "demo1234" });
      toast("Welcome to the demo sandbox! Data is stored on this device.", "info");
      goto("/");
    } catch (e) {
      error = e instanceof Error ? e.message : "Demo failed.";
    } finally {
      busy = false;
    }
  }

  const SHOW_DEMO_ACCOUNTS = backendMode === "demo";
</script>

<div class="login-page">
  <div class="card-wrap">
    <div class="brand">
      <span class="logo"><img class="logo-img" src="/tulip-track-icon.png" alt="" /></span>
      <h1>Tulip Track</h1>
      <p>Shared groups. Join codes. Everyone tracks themselves.</p>
    </div>

    <NeuCard>
      <div class="tabs">
        <button class="tab" class:on={mode === "in"} onclick={() => (mode = "in")}>Sign in</button>
        <button class="tab" class:on={mode === "up"} onclick={() => (mode = "up")}>Create account</button>
      </div>

      <form class="fields" onsubmit={(e) => { e.preventDefault(); submit(); }}>
        {#if mode === "up"}
          <NeuInput label="Name" placeholder="Your name" bind:value={name} icon="user" />
        {/if}
        <NeuInput label="Email" type="email" placeholder="you@example.com" bind:value={email} icon="user" />
        <NeuInput label="Password" type="password" placeholder="••••••••" bind:value={password} icon="key" />

        {#if error}
          <p class="error">{error}</p>
        {/if}

        <NeuButton type="submit" variant="primary" size="lg" full {busy} disabled={busy}>
          {mode === "in" ? "Sign in" : "Create account"}
        </NeuButton>

        {#if backendMode === "demo"}
          <button type="button" class="demo" onclick={useDemo}>
            <img class="demo-logo" src="/tulip-track-icon.png" alt="" />
            Explore the demo (no account needed)
          </button>
          {#if SHOW_DEMO_ACCOUNTS}
            <div class="demo-accounts">
              <span class="da-lbl">Try the join-code flow:</span>
              {#each ["mia@tulip.app", "leon@tulip.app", "ava@tulip.app", "raj@tulip.app"] as mail (mail)}
                <span class="da">{mail}</span>
              {/each}
              <span class="da-lbl">password: <b>demo1234</b></span>
            </div>
          {/if}
          <p class="hint">
            Demo mode stores data locally on this device. Sign into the seeded accounts above to simulate members
            joining your group with its code.
          </p>
        {/if}
      </form>
    </NeuCard>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .card-wrap {
    width: min(440px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 26px;
  }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .logo {
    width: 68px;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .logo-img {
    width: 100%;
    height: 100%;
    display: block;
  }

  .demo-logo {
    width: 15px;
    height: 15px;
    object-fit: cover;
    display: inline-block;
    vertical-align: -3px;
  }

  h1 {
    font-size: 28px;
    text-transform: uppercase;
    letter-spacing: 0.01em;
  }

  .brand p {
    font-weight: 700;
    color: var(--text-2);
  }

  p {
    margin: 0;
    color: var(--text-2);
    font-size: 14px;
  }

  .tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 20px;
    padding: 5px;
    background: var(--surface-2);
    border: 2px solid var(--ink);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-inset);
  }

  .tab {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-weight: 800;
    font-size: 13.5px;
    color: var(--text-2);
    transition: box-shadow var(--t), color var(--t), background var(--t);
  }
  .tab.on {
    background: var(--accent);
    color: var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .error {
    color: var(--absent);
    font-size: 13px;
    font-weight: 700;
    padding-left: 4px;
  }

  .demo {
    border: 3px solid var(--ink);
    background: var(--present-soft);
    color: var(--ink);
    padding: 12px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-weight: 800;
    font-size: 14px;
    box-shadow: 3px 3px 0 var(--ink);
    transition: background var(--t), box-shadow var(--t), transform var(--t);
  }
  .demo:hover {
    background: var(--present);
    color: #fff;
  }
  .demo:active {
    box-shadow: none;
    transform: translate(3px, 3px);
  }

  .demo-accounts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }
  .da-lbl {
    color: var(--text-3);
    font-weight: 700;
    width: 100%;
    text-align: center;
  }
  .da {
    font-family: ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    background: var(--accent-soft);
    border: 2px solid var(--ink);
    border-radius: var(--radius-sm);
    padding: 3px 8px;
  }

  .hint {
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
    line-height: 1.5;
  }
</style>