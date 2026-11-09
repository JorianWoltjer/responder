<script>
  import { parseGistReference } from '@/utils/gist'
  import Icon from './Icon.svelte'

  let { gistUrl = $bindable(''), onfile } = $props()

  let touched = $state(false)
  let reference = $derived(parseGistReference(gistUrl))
  let invalid = $derived(reference === null)
  let hasUnsupportedFragment = $derived(gistUrl.includes('#'))

  function update(event) {
    gistUrl = event.currentTarget.value
    touched = true

    const nextReference = parseGistReference(gistUrl)
    if (nextReference?.file) onfile?.(nextReference.file)
  }

  function clear() {
    gistUrl = ''
    touched = false
  }
</script>

<div class="subpanel gist-panel">
  <div class="gist-panel-header">
    <p>
      Use a <strong>GitHub Gist</strong> instead of the editor contents. This is useful for larger bodies
      that won't fit in a URL.
    </p>
    <a class="create-gist-link" href="https://gist.github.com/" target="_blank" rel="noreferrer">
      Create gist
      <Icon name="external" size={13} />
    </a>
  </div>
  <div class="gist-input-wrap">
    <div class="gist-input-control">
      <label class="sr-only" for="gist-url">GitHub gist URL</label>
      <span class="gist-input-icon"><Icon name="github" size={16} /></span>
      <input
        id="gist-url"
        value={gistUrl}
        class:has-value={Boolean(gistUrl)}
        class:invalid={touched && invalid}
        type="text"
        inputmode="url"
        placeholder="https://gist.github.com/user/gist-id"
        spellcheck="false"
        aria-invalid={touched && invalid}
        aria-describedby={touched && invalid
          ? 'gist-url-error'
          : reference
            ? 'gist-reference-parts'
            : undefined}
        oninput={update}
        onblur={() => (touched = true)}
      />
      {#if gistUrl}
        <button
          class="clear-gist-button"
          type="button"
          onclick={clear}
          title="Clear gist URL"
          aria-label="Clear gist URL"
        >
          <Icon name="close" size={16} />
        </button>
      {/if}
    </div>
    {#if touched && invalid}
      <p id="gist-url-error" class="gist-input-error">
        {#if hasUnsupportedFragment}
          URLs with <code>#</code> are unsupported, copy a Raw URL for your specific filename.
        {:else}
          Enter a 32-character Gist ID or URL.
        {/if}
      </p>
    {:else if reference}
      <dl id="gist-reference-parts" class="gist-reference-parts">
        <div class="gist-reference-part">
          <dt>Gist ID</dt>
          <dd title={reference.id}>{reference.id}</dd>
        </div>
        {#if reference.revision}
          <div class="gist-reference-part">
            <dt>Revision</dt>
            <dd title={reference.revision}>{reference.revision}</dd>
          </div>
        {/if}
        {#if reference.file}
          <div class="gist-reference-part file-part">
            <dt>File</dt>
            <dd title={reference.file}>{reference.file}</dd>
          </div>
        {/if}
      </dl>
    {/if}
  </div>
</div>

<style>
  .subpanel {
    min-height: 0;
    border-top: 1px solid var(--border);
    background: var(--surface-inset);
  }

  .gist-panel {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem 1rem 1rem;
  }

  .gist-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .gist-panel-header p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .gist-input-wrap {
    display: grid;
    gap: 0.5rem;
  }

  .gist-input-control {
    position: relative;
  }

  input {
    width: 100%;
    min-height: 2.5rem;
    padding: 0.55rem 0.75rem 0.55rem 2.25rem;
    border-color: var(--border-strong);
    border-radius: var(--radius-sm);
    background: #0b0e0c;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  input.has-value {
    padding-right: 2.5rem;
  }

  input.invalid {
    border-color: color-mix(in srgb, var(--danger) 65%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 8%, transparent);
  }

  .gist-input-error {
    margin: -0.15rem 0 0;
    color: var(--danger);
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .gist-reference-parts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin: 0;
  }

  .gist-reference-part {
    display: grid;
    flex: 1 1 14rem;
    min-width: 0;
    gap: 0.2rem;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--surface-raised) 55%, transparent);
  }

  .gist-reference-part.file-part {
    flex-basis: 9rem;
  }

  .gist-reference-part dt {
    color: var(--text-subtle);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
  }

  .gist-reference-part dd {
    overflow: hidden;
    margin: 0;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gist-input-icon {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 0.75rem;
    display: grid;
    color: var(--text-subtle);
    pointer-events: none;
    transform: translateY(-50%);
  }

  .create-gist-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2rem;
    margin-right: -0.5rem;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  .create-gist-link:hover {
    color: var(--accent);
    background: var(--interactive-hover);
  }

  .clear-gist-button {
    position: absolute;
    z-index: 1;
    top: 50%;
    right: 0.35rem;
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--text-subtle);
    background: transparent;
    transform: translateY(-50%);
  }

  .clear-gist-button:hover {
    color: var(--text);
    background: var(--interactive-hover);
  }
</style>
