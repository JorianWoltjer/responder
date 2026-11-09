<script>
  import { buildCsrfFormHtml, parseRequest } from '@/utils/csrfPoc'
  import Icon from './Icon.svelte'

  let { ongenerate, ontoast } = $props()

  const exampleRequest =
    'POST /path HTTP/1.1\nHost: example.com\nContent-Type: application/x-www-form-urlencoded\n\nname=value'
  const placeholder = `${exampleRequest}\n\n--- or “Copy as fetch” ---\n\nfetch(...)`

  let rawRequest = $state(exampleRequest)
  let lastGeneratedRequest = $state(null)
  let generationPending = $derived(
    lastGeneratedRequest === null || rawRequest !== lastGeneratedRequest
  )

  function generate() {
    try {
      ongenerate?.(buildCsrfFormHtml(parseRequest(rawRequest)))
      lastGeneratedRequest = rawRequest
    } catch (error) {
      ontoast?.(
        'Could not parse request',
        error instanceof Error ? error.message : String(error),
        'warning',
        6000
      )
    }
  }

  function handleKeydown(event) {
    if (
      (!event.ctrlKey && !event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      event.key !== 'Enter'
    )
      return

    event.preventDefault()
    if (!event.repeat) generate()
  }
</script>

<div class="subpanel csrf-panel">
  <div class="csrf-input-wrap">
    <textarea
      bind:value={rawRequest}
      {placeholder}
      spellcheck="false"
      aria-label="Raw HTTP request"
      aria-keyshortcuts="Control+Enter Meta+Enter"
      onkeydown={handleKeydown}
    ></textarea>
    <button
      class="primary-button compact csrf-generate-button"
      class:quiet={!generationPending}
      type="button"
      onclick={generate}
      title="Generate CSRF PoC (Ctrl+Enter)"
    >
      <Icon name="wand" size={15} />
      <span>Generate</span>
    </button>
  </div>
</div>

<style>
  .subpanel {
    min-height: 0;
    border-top: 1px solid var(--border);
    background: var(--surface-inset);
  }

  .csrf-panel {
    display: grid;
    grid-template-rows: 1fr;
    padding: 0.75rem 0.75rem 0.7rem;
  }

  .csrf-input-wrap {
    position: relative;
    min-height: 0;
  }

  textarea {
    width: 100%;
    height: 100%;
    min-height: 5rem;
    padding: 0.7rem 0.7rem 3.8rem;
    resize: none;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .csrf-generate-button {
    position: absolute;
    right: 0.65rem;
    bottom: 0.65rem;
    min-height: 2.35rem;
    font-size: 0.82rem;
  }

  .primary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 2.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    color: #06120a;
    background: var(--accent);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .primary-button:hover {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
  }

  .primary-button.compact {
    flex: none;
    padding: 0.42rem 0.68rem;
  }

  .primary-button.quiet {
    border-color: var(--border-strong);
    color: var(--text-muted);
    background: var(--surface-raised);
  }

  .primary-button.quiet:hover {
    border-color: var(--border-strong);
    color: var(--text);
    background: #202521;
  }
</style>
