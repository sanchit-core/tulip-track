<script lang="ts">
  let {
    pad = true,
    pressed = false,
    hoverable = false,
    strong = false,
    class: cls = "",
    children,
    ...rest
  }: {
    pad?: boolean;
    pressed?: boolean;
    hoverable?: boolean;
    strong?: boolean;
    class?: string;
    children?: import("svelte").Snippet;
    [key: string]: any;
  } = $props();
</script>

<section
  class="neu-card {cls}"
  class:pressed
  class:hoverable
  class:strong
  class:no-pad={!pad}
  {...rest}
>
  {@render children?.()}
</section>

<style>
  .neu-card {
    background: var(--surface);
    border: var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-raised);
    transition: box-shadow var(--t), transform var(--t);
    position: relative;
    padding: 22px;
  }

  .no-pad {
    padding: 0;
  }

  .pressed {
    box-shadow: var(--shadow-pressed);
    transform: translate(3px, 3px);
  }

  .strong {
    background: var(--surface);
    box-shadow: var(--shadow-raised-lg);
  }

  .hoverable:hover {
    box-shadow: var(--shadow-raised-lg);
    transform: translate(-2px, -2px);
  }

  .hoverable:active {
    box-shadow: var(--shadow-flat);
    transform: none;
  }
</style>