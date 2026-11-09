<script>
  import Icon from './Icon.svelte'

  let { toasts, ondismiss } = $props()
</script>

<div class="toast-region" aria-live="polite" aria-atomic="false">
  {#each toasts as toast (toast.id)}
    <div class="toast" class:warning={toast.type === 'warning'}>
      <span class="toast-icon">
        <Icon name="info" size={16} />
      </span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.detail}</p>
      </div>
      <button type="button" onclick={() => ondismiss?.(toast.id)} aria-label="Dismiss notification">
        <Icon name="close" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-region {
    position: fixed;
    z-index: 100;
    left: 1.25rem;
    bottom: 1.25rem;
    display: grid;
    gap: 0.55rem;
    width: min(24rem, calc(100vw - 2.5rem));
    pointer-events: none;
  }

  .toast {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.7rem;
    align-items: start;
    padding: 0.8rem;
    border: 1px solid var(--border-strong);
    border-radius: 9px;
    background: rgba(23, 27, 24, 0.97);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
    animation: toast-in 180ms ease-out;
    pointer-events: auto;
    backdrop-filter: blur(12px);
  }

  .toast-icon {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: 5px;
    color: var(--accent);
    background: rgba(94, 232, 139, 0.08);
  }

  .toast.warning .toast-icon {
    color: var(--warning);
    background: rgba(246, 200, 108, 0.08);
  }

  .toast strong {
    display: block;
    margin-top: 0.05rem;
    font-size: 0.78rem;
  }

  .toast p {
    margin: 0.25rem 0 0;
    color: var(--text-muted);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  .toast button {
    display: grid;
    padding: 0.2rem;
    border: 0;
    border-radius: var(--radius-sm);
    place-items: center;
    color: var(--text-subtle);
    background: transparent;
  }

  .toast button:hover {
    color: var(--text);
    background: var(--interactive-hover);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
</style>
